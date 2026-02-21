import { createClient } from "@/lib/supabase/server";
import { getGoogleAccessToken } from "@/lib/google/auth";
import { fetchCalendarEvents } from "@/lib/google/calendar";
import {
  fetchCanvasCourses,
  fetchCanvasAssignments,
  fetchCanvasSubmissions,
} from "@/lib/canvas";
import { NextResponse } from "next/server";
import type { CanvasSubmission } from "@/types";

// ============================================
// Auto-Configure Intelligence Engine
// ============================================
// Analyzes real Canvas + Google Calendar data to generate
// optimal profile settings for the student during onboarding.

interface AutoConfigResult {
  productivity_peak_hours: string[];
  sleep_window: { sleep: string; wake: string };
  escalation_mode: "gentle" | "standard" | "aggressive";
  gpa_target: number | null;
  reasoning: {
    peak_hours_reason: string;
    sleep_reason: string;
    escalation_reason: string;
    gpa_reason: string;
    workload_summary: string;
  };
  signals: {
    total_courses: number;
    total_assignments: number;
    upcoming_assignments: number;
    on_time_rate: number | null;
    late_rate: number | null;
    missing_rate: number | null;
    current_avg_score: number | null;
    weekly_class_hours: number;
    busiest_day: string | null;
    earliest_class: string | null;
    latest_event: string | null;
  };
}

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result: AutoConfigResult = {
    productivity_peak_hours: [],
    sleep_window: { sleep: "23:00", wake: "08:00" },
    escalation_mode: "standard",
    gpa_target: null,
    reasoning: {
      peak_hours_reason: "",
      sleep_reason: "",
      escalation_reason: "",
      gpa_reason: "",
      workload_summary: "",
    },
    signals: {
      total_courses: 0,
      total_assignments: 0,
      upcoming_assignments: 0,
      on_time_rate: null,
      late_rate: null,
      missing_rate: null,
      current_avg_score: null,
      weekly_class_hours: 0,
      busiest_day: null,
      earliest_class: null,
      latest_event: null,
    },
  };

  // ============================================
  // 1. Analyze Google Calendar → Peak Hours + Sleep
  // ============================================
  try {
    const accessToken = await getGoogleAccessToken(user.id);
    if (accessToken) {
      // Fetch past 2 weeks + next 2 weeks of events for pattern analysis
      const twoWeeksAgo = new Date(Date.now() - 14 * 86400000).toISOString();
      const twoWeeksAhead = new Date(Date.now() + 14 * 86400000).toISOString();
      const events = await fetchCalendarEvents(accessToken, twoWeeksAgo, twoWeeksAhead);

      if (events.length > 0) {
        const calendarAnalysis = analyzeCalendar(events);
        result.productivity_peak_hours = calendarAnalysis.peakHours;
        result.sleep_window = calendarAnalysis.sleepWindow;
        result.reasoning.peak_hours_reason = calendarAnalysis.peakReason;
        result.reasoning.sleep_reason = calendarAnalysis.sleepReason;
        result.signals.weekly_class_hours = calendarAnalysis.weeklyClassHours;
        result.signals.busiest_day = calendarAnalysis.busiestDay;
        result.signals.earliest_class = calendarAnalysis.earliestClass;
        result.signals.latest_event = calendarAnalysis.latestEvent;
      } else {
        result.productivity_peak_hours = ["09:00", "10:00", "14:00", "15:00"];
        result.reasoning.peak_hours_reason = "No calendar events found — using typical student study hours.";
        result.reasoning.sleep_reason = "No calendar data — using default 11pm-8am window.";
      }
    } else {
      result.productivity_peak_hours = ["09:00", "10:00", "14:00", "15:00"];
      result.reasoning.peak_hours_reason = "Google not connected — using typical student study hours.";
      result.reasoning.sleep_reason = "Google not connected — using default sleep window.";
    }
  } catch {
    result.productivity_peak_hours = ["09:00", "10:00", "14:00", "15:00"];
    result.reasoning.peak_hours_reason = "Could not access calendar — using defaults.";
    result.reasoning.sleep_reason = "Could not access calendar — using defaults.";
  }

  // ============================================
  // 2. Analyze Canvas → Escalation Mode + GPA
  // ============================================
  try {
    const { data: canvasConn } = await supabase
      .from("canvas_connections")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (canvasConn) {
      const baseUrl = canvasConn.canvas_base_url;
      const token = canvasConn.api_token;
      const canvasAnalysis = await analyzeCanvas(baseUrl, token);

      result.escalation_mode = canvasAnalysis.escalationMode;
      result.gpa_target = canvasAnalysis.gpaTarget;
      result.reasoning.escalation_reason = canvasAnalysis.escalationReason;
      result.reasoning.gpa_reason = canvasAnalysis.gpaReason;
      result.reasoning.workload_summary = canvasAnalysis.workloadSummary;
      result.signals.total_courses = canvasAnalysis.totalCourses;
      result.signals.total_assignments = canvasAnalysis.totalAssignments;
      result.signals.upcoming_assignments = canvasAnalysis.upcomingAssignments;
      result.signals.on_time_rate = canvasAnalysis.onTimeRate;
      result.signals.late_rate = canvasAnalysis.lateRate;
      result.signals.missing_rate = canvasAnalysis.missingRate;
      result.signals.current_avg_score = canvasAnalysis.currentAvg;
    } else {
      result.reasoning.escalation_reason = "Canvas not connected — using balanced 'standard' mode.";
      result.reasoning.gpa_reason = "No grade data available.";
      result.reasoning.workload_summary = "Connect Canvas to analyze your workload.";
    }
  } catch {
    result.reasoning.escalation_reason = "Could not access Canvas — using 'standard' mode.";
    result.reasoning.gpa_reason = "Could not access Canvas grades.";
    result.reasoning.workload_summary = "Could not analyze Canvas workload.";
  }

  return NextResponse.json(result);
}

// ============================================
// Calendar Analysis
// ============================================

interface CalendarAnalysis {
  peakHours: string[];
  sleepWindow: { sleep: string; wake: string };
  peakReason: string;
  sleepReason: string;
  weeklyClassHours: number;
  busiestDay: string | null;
  earliestClass: string | null;
  latestEvent: string | null;
}

function analyzeCalendar(
  events: Array<{
    summary: string;
    start: { dateTime: string };
    end: { dateTime: string };
  }>
): CalendarAnalysis {
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  // Track busy hours across all events
  // hourBusyness[hour] = number of events that occupy this hour
  const hourBusyness = new Array(24).fill(0);
  // dayBusyness[dayOfWeek] = total hours of events
  const dayBusyness = new Array(7).fill(0);
  // Track earliest event per day and latest event per day
  const earliestByDay: number[] = [];
  const latestByDay: number[] = [];
  let totalEventHours = 0;
  let eventDays = 0;

  // Track unique days we've seen events on
  const seenDays = new Set<string>();

  for (const event of events) {
    if (!event.start?.dateTime || !event.end?.dateTime) continue;

    const start = new Date(event.start.dateTime);
    const end = new Date(event.end.dateTime);
    const durationHours = (end.getTime() - start.getTime()) / 3600000;

    if (durationHours <= 0 || durationHours > 12) continue; // Skip all-day or invalid

    const dayKey = start.toISOString().split("T")[0];
    if (!seenDays.has(dayKey)) {
      seenDays.add(dayKey);
      eventDays++;
    }

    const dayOfWeek = start.getDay();
    dayBusyness[dayOfWeek] += durationHours;
    totalEventHours += durationHours;

    // Mark each hour this event spans as busy
    const startHour = start.getHours();
    const endHour = Math.min(end.getHours() + (end.getMinutes() > 0 ? 1 : 0), 23);
    for (let h = startHour; h < endHour; h++) {
      hourBusyness[h]++;
    }

    earliestByDay.push(startHour + start.getMinutes() / 60);
    latestByDay.push(endHour);
  }

  // --- Sleep Window ---
  // Earliest event determines wake time (need to be up 1hr before)
  const earliestEventHour = earliestByDay.length > 0
    ? Math.floor(Math.min(...earliestByDay))
    : 9;
  // Latest event determines sleep time (at least 1hr after + wind down)
  const latestEventHour = latestByDay.length > 0
    ? Math.max(...latestByDay)
    : 21;

  // Wake = 1hr before earliest regular event, clamped 5:00-10:00
  const wakeHour = Math.max(5, Math.min(10, earliestEventHour - 1));
  // Sleep = 2hrs after latest event, clamped 21:00-01:00
  const sleepHour = Math.max(21, Math.min(25, latestEventHour + 2)); // 25 = 1am next day
  const actualSleepHour = sleepHour >= 24 ? sleepHour - 24 : sleepHour;

  const sleepWindow = {
    sleep: `${String(actualSleepHour).padStart(2, "0")}:00`,
    wake: `${String(wakeHour).padStart(2, "0")}:00`,
  };

  const earliestClassStr = earliestByDay.length > 0
    ? `${String(Math.floor(Math.min(...earliestByDay))).padStart(2, "0")}:${String(Math.round((Math.min(...earliestByDay) % 1) * 60)).padStart(2, "0")}`
    : null;
  const latestEventStr = latestByDay.length > 0
    ? `${String(Math.max(...latestByDay)).padStart(2, "0")}:00`
    : null;

  // --- Peak Productivity Hours ---
  // Find hours with LOWEST busyness that are within waking hours
  // These are the free slots where the student can study
  const freeHours: Array<{ hour: number; busyness: number }> = [];
  for (let h = wakeHour; h < (actualSleepHour > wakeHour ? actualSleepHour : 24); h++) {
    // Skip very early (before 7am) and lunch hour (12-13)
    if (h < 7) continue;
    freeHours.push({ hour: h, busyness: hourBusyness[h] });
  }

  // Sort by least busy first, then by hour (prefer morning/afternoon over late night)
  freeHours.sort((a, b) => {
    if (a.busyness !== b.busyness) return a.busyness - b.busyness;
    // Prefer 8am-6pm range for study
    const aPreferred = a.hour >= 8 && a.hour <= 18 ? 0 : 1;
    const bPreferred = b.hour >= 8 && b.hour <= 18 ? 0 : 1;
    return aPreferred - bPreferred;
  });

  // Take top 4-6 free hours as peak productivity hours
  const numPeakHours = Math.min(6, Math.max(4, freeHours.length));
  const peakHours = freeHours
    .slice(0, numPeakHours)
    .map((fh) => `${String(fh.hour).padStart(2, "0")}:00`)
    .sort(); // Sort chronologically

  // --- Busiest Day ---
  let busiestDayIndex = 0;
  let maxDayHours = 0;
  for (let d = 0; d < 7; d++) {
    if (dayBusyness[d] > maxDayHours) {
      maxDayHours = dayBusyness[d];
      busiestDayIndex = d;
    }
  }

  // --- Weekly Class Hours ---
  // Normalize total hours by number of weeks we analyzed (roughly 4 weeks)
  const weeksAnalyzed = Math.max(1, eventDays / 5); // Rough estimate
  const weeklyHours = Math.round((totalEventHours / weeksAnalyzed) * 10) / 10;

  // --- Build reasoning ---
  const busyHoursStr = freeHours
    .filter((fh) => fh.busyness > 2)
    .map((fh) => `${fh.hour}:00`)
    .slice(0, 3)
    .join(", ");

  const peakReason = events.length > 5
    ? `Based on ${events.length} calendar events: your busiest times are around ${busyHoursStr || "midday"}. I found ${peakHours.length} free hours for studying: ${peakHours.join(", ")}.`
    : `Limited calendar data (${events.length} events). Set peak hours to common free slots. Adjust in Settings as needed.`;

  const sleepReason = earliestByDay.length > 3
    ? `Your earliest events start around ${earliestClassStr}. Setting wake time to ${sleepWindow.wake} (1hr buffer). Latest events end around ${latestEventStr}, so sleep at ${sleepWindow.sleep}.`
    : `Based on available schedule data. Adjust in Settings to match your actual routine.`;

  return {
    peakHours,
    sleepWindow,
    peakReason,
    sleepReason,
    weeklyClassHours: weeklyHours,
    busiestDay: maxDayHours > 0 ? dayNames[busiestDayIndex] : null,
    earliestClass: earliestClassStr,
    latestEvent: latestEventStr,
  };
}

// ============================================
// Canvas Analysis
// ============================================

interface CanvasAnalysis {
  escalationMode: "gentle" | "standard" | "aggressive";
  gpaTarget: number | null;
  escalationReason: string;
  gpaReason: string;
  workloadSummary: string;
  totalCourses: number;
  totalAssignments: number;
  upcomingAssignments: number;
  onTimeRate: number | null;
  lateRate: number | null;
  missingRate: number | null;
  currentAvg: number | null;
}

async function analyzeCanvas(
  baseUrl: string,
  token: string
): Promise<CanvasAnalysis> {
  const courses = await fetchCanvasCourses(baseUrl, token);
  const activeCourses = courses.filter((c) => c.workflow_state === "available");

  let totalAssignments = 0;
  let upcomingAssignments = 0;
  let totalSubmissions = 0;
  let onTimeSubmissions = 0;
  let lateSubmissions = 0;
  let missingSubmissions = 0;
  let gradedScores: number[] = []; // percentages
  let totalPointsPossible = 0;

  // Collect enrollment scores for GPA estimation
  const courseScores: number[] = [];
  for (const c of activeCourses) {
    if (c.enrollments) {
      for (const enrollment of c.enrollments) {
        if (enrollment.computed_current_score !== null) {
          courseScores.push(enrollment.computed_current_score);
        }
      }
    }
  }

  const now = new Date();

  for (const course of activeCourses) {
    try {
      const [assignments, submissions] = await Promise.all([
        fetchCanvasAssignments(baseUrl, token, course.id),
        fetchCanvasSubmissions(baseUrl, token, course.id),
      ]);

      const submissionMap = new Map<number, CanvasSubmission>();
      for (const sub of submissions) {
        submissionMap.set(sub.assignment_id, sub);
      }

      for (const assignment of assignments) {
        totalAssignments++;
        if (assignment.points_possible) {
          totalPointsPossible += assignment.points_possible;
        }

        // Count upcoming
        if (assignment.due_at && new Date(assignment.due_at) > now) {
          upcomingAssignments++;
        }

        // Only analyze submission behavior for assignments that are past due
        if (!assignment.due_at) continue;
        const dueDate = new Date(assignment.due_at);
        if (dueDate > now) continue; // Not due yet, skip analysis

        const sub = submissionMap.get(assignment.id);
        totalSubmissions++;

        if (!sub || sub.workflow_state === "unsubmitted") {
          // Never submitted
          missingSubmissions++;
        } else if (sub.submitted_at) {
          const submittedDate = new Date(sub.submitted_at);
          if (submittedDate <= dueDate) {
            onTimeSubmissions++;
          } else {
            lateSubmissions++;
          }

          // Track scores for average calculation
          if (sub.score !== null && assignment.points_possible && assignment.points_possible > 0) {
            gradedScores.push((sub.score / assignment.points_possible) * 100);
          }
        } else {
          // Has submission but no submitted_at (e.g., auto-graded)
          if (sub.workflow_state === "graded" || sub.workflow_state === "complete") {
            onTimeSubmissions++; // Assume on-time if we can't tell
            if (sub.score !== null && assignment.points_possible && assignment.points_possible > 0) {
              gradedScores.push((sub.score / assignment.points_possible) * 100);
            }
          } else {
            missingSubmissions++;
          }
        }
      }
    } catch {
      // Skip course on error
    }
  }

  // --- Calculate Rates ---
  const onTimeRate = totalSubmissions > 0 ? Math.round((onTimeSubmissions / totalSubmissions) * 100) : null;
  const lateRate = totalSubmissions > 0 ? Math.round((lateSubmissions / totalSubmissions) * 100) : null;
  const missingRate = totalSubmissions > 0 ? Math.round((missingSubmissions / totalSubmissions) * 100) : null;

  // --- Current Average Score ---
  // Prefer enrollment scores (Canvas computes these accurately)
  // Fall back to manually calculated average
  let currentAvg: number | null = null;
  if (courseScores.length > 0) {
    currentAvg = Math.round((courseScores.reduce((a, b) => a + b, 0) / courseScores.length) * 10) / 10;
  } else if (gradedScores.length > 0) {
    currentAvg = Math.round((gradedScores.reduce((a, b) => a + b, 0) / gradedScores.length) * 10) / 10;
  }

  // --- Escalation Mode ---
  // Based on submission patterns — this is the core intelligence
  let escalationMode: "gentle" | "standard" | "aggressive" = "standard";
  let escalationReason = "";

  if (totalSubmissions >= 5) {
    // We have enough data to make a judgment
    const onTimePct = onTimeRate || 0;
    const missingPct = missingRate || 0;

    if (onTimePct >= 85 && missingPct <= 5) {
      // Highly disciplined student
      escalationMode = "gentle";
      escalationReason = `You're crushing it — ${onTimePct}% of past assignments submitted on time with only ${missingPct}% missed. You clearly have discipline, so I'll keep nudges light and supportive.`;
    } else if (onTimePct >= 70 && missingPct <= 10) {
      // Generally good but room for improvement
      escalationMode = "standard";
      escalationReason = `Solid track record: ${onTimePct}% on-time submissions. A few late or missed ones (${missingPct}% missed). I'll be direct when deadlines approach but won't overdo it.`;
    } else if (onTimePct >= 50) {
      // Mixed — needs some accountability
      escalationMode = "standard";
      escalationReason = `${onTimePct}% on-time rate with ${missingPct}% missed assignments suggests you sometimes need a push. I'll be honest and direct when things slip.`;
    } else {
      // Struggling with deadlines
      escalationMode = "aggressive";
      escalationReason = `Only ${onTimePct}% of past assignments submitted on time, and ${missingPct}% were missed entirely. I'm setting aggressive mode to help you stay on track — I'll block your calendar and escalate reminders when needed. You can change this anytime.`;
    }
  } else if (totalSubmissions > 0) {
    // Limited data — use what we have with a standard default
    escalationMode = "standard";
    escalationReason = `Limited submission data (${totalSubmissions} past-due assignments analyzed). Starting with balanced mode — I'll adjust as I learn your patterns.`;
  } else {
    escalationMode = "standard";
    escalationReason = "No past-due assignment data yet (semester may be starting). Starting with balanced standard mode.";
  }

  // --- GPA Target ---
  // Convert percentage score to GPA scale and suggest slightly aspirational target
  let gpaTarget: number | null = null;
  let gpaReason = "";

  if (currentAvg !== null) {
    const estimatedGPA = percentageToGPA(currentAvg);
    // Set target = current + 0.2, capped at 4.0
    gpaTarget = Math.round(Math.min(4.0, estimatedGPA + 0.2) * 10) / 10;

    if (estimatedGPA >= 3.7) {
      gpaReason = `Current avg ~${currentAvg}% (≈${estimatedGPA} GPA). You're already performing excellently. Target: ${gpaTarget} — maintain and push for the best.`;
    } else if (estimatedGPA >= 3.0) {
      gpaReason = `Current avg ~${currentAvg}% (≈${estimatedGPA} GPA). Solid performance with room to grow. Target: ${gpaTarget} — a realistic stretch goal.`;
    } else if (estimatedGPA >= 2.5) {
      gpaReason = `Current avg ~${currentAvg}% (≈${estimatedGPA} GPA). There's definite room for improvement. Target: ${gpaTarget} — achievable with consistent effort.`;
    } else {
      gpaReason = `Current avg ~${currentAvg}% (≈${estimatedGPA} GPA). Let's focus on building better habits. Target: ${gpaTarget} — one step at a time.`;
    }
  } else {
    gpaReason = "No grade data available yet. Set your GPA target manually.";
  }

  // --- Workload Summary ---
  const assignmentsPerCourse = activeCourses.length > 0
    ? Math.round(totalAssignments / activeCourses.length)
    : 0;

  let workloadLevel: string;
  if (activeCourses.length >= 6 || totalAssignments > 40) {
    workloadLevel = "heavy";
  } else if (activeCourses.length >= 4 || totalAssignments > 20) {
    workloadLevel = "moderate";
  } else {
    workloadLevel = "light";
  }

  const workloadSummary = activeCourses.length > 0
    ? `${activeCourses.length} active courses with ~${assignmentsPerCourse} assignments each (${totalAssignments} total). ${upcomingAssignments} upcoming. Workload: ${workloadLevel}.`
    : "No courses found in Canvas.";

  return {
    escalationMode,
    gpaTarget,
    escalationReason,
    gpaReason,
    workloadSummary,
    totalCourses: activeCourses.length,
    totalAssignments,
    upcomingAssignments,
    onTimeRate,
    lateRate,
    missingRate,
    currentAvg,
  };
}

/**
 * Convert a percentage score to approximate GPA on a 4.0 scale.
 * Uses a standard US university conversion.
 */
function percentageToGPA(pct: number): number {
  if (pct >= 93) return 4.0;
  if (pct >= 90) return 3.7;
  if (pct >= 87) return 3.3;
  if (pct >= 83) return 3.0;
  if (pct >= 80) return 2.7;
  if (pct >= 77) return 2.3;
  if (pct >= 73) return 2.0;
  if (pct >= 70) return 1.7;
  if (pct >= 67) return 1.3;
  if (pct >= 63) return 1.0;
  if (pct >= 60) return 0.7;
  return 0.0;
}
