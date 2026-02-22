import { getAzureOpenAI } from "@/lib/azure-openai";
import { calculateEscalation } from "./escalation";
import type { Assignment, Profile, Grade, StudyBlock } from "@/types";

/**
 * Background reasoning engine — runs periodically to analyze student data
 * and generate proactive nudges, study block suggestions, insights,
 * grade cliff warnings, procrastination detection, and burnout risk.
 */

export interface ReasoningContext {
  profile: Profile;
  assignments: Assignment[];
  grades: Grade[];
  studyBlocks: StudyBlock[];
  recentMoodScores: number[];
}

export interface ReasoningOutput {
  nudges: Array<{
    message: string;
    severity: "gentle" | "firm" | "urgent" | "nuclear";
    assignment_id?: string;
  }>;
  suggestedStudyBlocks: Array<{
    title: string;
    course_id?: string;
    assignment_id?: string;
    start_time: string;
    end_time: string;
  }>;
  insights: string[];
  priorityTask: {
    title: string;
    reason: string;
    assignment_id?: string;
  } | null;
  gradeAlerts: Array<{
    course_id: string;
    course_name: string;
    average: number;
    letter_grade: string;
    risk_level: "warning" | "at_risk" | "critical";
    message: string;
  }>;
  gradeCliffs: Array<{
    course_name: string;
    average: number;
    current_letter: string;
    grade_below: string;
    margin: number;
  }>;
  procrastinationScore: number; // 0-100, higher = more procrastination
  burnoutRisk: "low" | "moderate" | "high";
  semesterProjection: {
    projected_gpa: number | null;
    on_track: boolean;
  } | null;
}

// Grade boundaries for cliff detection
const GRADE_BOUNDARIES = [
  { letter: "A", min: 93 },
  { letter: "A-", min: 90 },
  { letter: "B+", min: 87 },
  { letter: "B", min: 83 },
  { letter: "B-", min: 80 },
  { letter: "C+", min: 77 },
  { letter: "C", min: 73 },
  { letter: "C-", min: 70 },
  { letter: "D+", min: 67 },
  { letter: "D", min: 60 },
];

function getLetterGrade(pct: number): string {
  if (pct >= 93) return "A";
  if (pct >= 90) return "A-";
  if (pct >= 87) return "B+";
  if (pct >= 83) return "B";
  if (pct >= 80) return "B-";
  if (pct >= 77) return "C+";
  if (pct >= 73) return "C";
  if (pct >= 70) return "C-";
  if (pct >= 67) return "D+";
  if (pct >= 60) return "D";
  return "F";
}

function gpaToMinPercent(gpa: number): number {
  if (gpa >= 4.0) return 93;
  if (gpa >= 3.7) return 90;
  if (gpa >= 3.3) return 87;
  if (gpa >= 3.0) return 83;
  if (gpa >= 2.7) return 80;
  if (gpa >= 2.3) return 77;
  if (gpa >= 2.0) return 73;
  return 70;
}

function percentToGpa(pct: number): number {
  if (pct >= 93) return 4.0;
  if (pct >= 90) return 3.7;
  if (pct >= 87) return 3.3;
  if (pct >= 83) return 3.0;
  if (pct >= 80) return 2.7;
  if (pct >= 77) return 2.3;
  if (pct >= 73) return 2.0;
  if (pct >= 70) return 1.7;
  if (pct >= 67) return 1.3;
  if (pct >= 60) return 1.0;
  return 0.0;
}

export async function runBackgroundReasoning(
  context: ReasoningContext
): Promise<ReasoningOutput> {
  const output: ReasoningOutput = {
    nudges: [],
    suggestedStudyBlocks: [],
    insights: [],
    priorityTask: null,
    gradeAlerts: [],
    gradeCliffs: [],
    procrastinationScore: 0,
    burnoutRisk: "low",
    semesterProjection: null,
  };

  // ═══════════════════════════════════
  // 1. ESCALATION CHECK — pending assignments
  // ═══════════════════════════════════
  for (const assignment of context.assignments) {
    if (assignment.status === "completed") continue;

    const escalation = calculateEscalation(
      assignment,
      context.profile.full_name || "Hey"
    );

    if (escalation && escalation.stage > assignment.reminder_stage) {
      output.nudges.push({
        message: escalation.message,
        severity: escalation.severity,
        assignment_id: assignment.id,
      });
    }
  }

  // ═══════════════════════════════════
  // 2. GRADE RISK ANALYSIS — per-course averages, alerts, and trends
  // ═══════════════════════════════════
  const courseGradeMap = new Map<string, { name: string; earned: number; possible: number; grades: Grade[] }>();
  for (const g of context.grades) {
    if (g.score == null || g.max_score == null || g.max_score <= 0) continue;
    const existing = courseGradeMap.get(g.course_id);
    if (existing) {
      existing.earned += g.score;
      existing.possible += g.max_score;
      existing.grades.push(g);
    } else {
      courseGradeMap.set(g.course_id, {
        name: g.course?.name || "Unknown Course",
        earned: g.score,
        possible: g.max_score,
        grades: [g],
      });
    }
  }

  const gpaTarget = context.profile.gpa_target;
  const targetPercent = gpaTarget ? gpaToMinPercent(gpaTarget) : 80;

  const courseAverages: Array<{ courseId: string; name: string; avg: number; trend: string }> = [];

  for (const [courseId, courseData] of courseGradeMap) {
    const avg = (courseData.earned / courseData.possible) * 100;
    const letter = getLetterGrade(avg);

    // Determine trend
    let trend = "stable";
    if (courseData.grades.length >= 4) {
      const sorted = [...courseData.grades].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      const recent = sorted.slice(0, 3);
      const older = sorted.slice(-3);
      const recentAvg = recent.reduce((s, g) => s + (g.score! / g.max_score!), 0) / recent.length;
      const olderAvg = older.reduce((s, g) => s + (g.score! / g.max_score!), 0) / older.length;
      trend = recentAvg > olderAvg + 0.03 ? "improving" : recentAvg < olderAvg - 0.03 ? "declining" : "stable";
    }

    courseAverages.push({ courseId, name: courseData.name, avg, trend });

    // Grade alerts
    if (avg < 60) {
      output.gradeAlerts.push({
        course_id: courseId,
        course_name: courseData.name,
        average: Math.round(avg * 10) / 10,
        letter_grade: letter,
        risk_level: "critical",
        message: `${courseData.name} is at ${avg.toFixed(1)}% (${letter}) — failing. Immediate action needed.`,
      });
    } else if (avg < 70) {
      output.gradeAlerts.push({
        course_id: courseId,
        course_name: courseData.name,
        average: Math.round(avg * 10) / 10,
        letter_grade: letter,
        risk_level: "at_risk",
        message: `${courseData.name} is at ${avg.toFixed(1)}% (${letter}) — at risk of not passing.`,
      });
    } else if (avg < targetPercent) {
      output.gradeAlerts.push({
        course_id: courseId,
        course_name: courseData.name,
        average: Math.round(avg * 10) / 10,
        letter_grade: letter,
        risk_level: "warning",
        message: `${courseData.name} is at ${avg.toFixed(1)}% (${letter}) — below your GPA target of ${gpaTarget}.`,
      });
    }

    // Declining trend alert (only if not already alerted)
    if (trend === "declining" && !output.gradeAlerts.find((a) => a.course_id === courseId)) {
      const sorted = [...courseData.grades].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      const recentAvg = sorted.slice(0, 3).reduce((s, g) => s + (g.score! / g.max_score!), 0) / Math.min(sorted.length, 3);
      const olderAvg = sorted.slice(-3).reduce((s, g) => s + (g.score! / g.max_score!), 0) / Math.min(sorted.length, 3);
      output.gradeAlerts.push({
        course_id: courseId,
        course_name: courseData.name,
        average: Math.round(avg * 10) / 10,
        letter_grade: letter,
        risk_level: "warning",
        message: `Grades in ${courseData.name} are trending down (recent: ${(recentAvg * 100).toFixed(0)}% vs earlier: ${(olderAvg * 100).toFixed(0)}%).`,
      });
    }

    // ═══════════════════════════════════
    // 3. GRADE CLIFF DETECTION
    // ═══════════════════════════════════
    for (const boundary of GRADE_BOUNDARIES) {
      const margin = avg - boundary.min;
      if (margin >= 0 && margin <= 3) {
        const belowIdx = GRADE_BOUNDARIES.indexOf(boundary) + 1;
        const gradeBelow = belowIdx < GRADE_BOUNDARIES.length ? GRADE_BOUNDARIES[belowIdx].letter : "F";

        output.gradeCliffs.push({
          course_name: courseData.name,
          average: Math.round(avg * 10) / 10,
          current_letter: letter,
          grade_below: gradeBelow,
          margin: Math.round(margin * 10) / 10,
        });

        if (margin <= 1.5) {
          output.nudges.push({
            message: `Grade cliff alert: ${courseData.name} is at ${avg.toFixed(1)}% — only ${margin.toFixed(1)}% above dropping from ${letter} to ${gradeBelow}. Every point matters.`,
            severity: margin <= 0.5 ? "urgent" : "firm",
          });
        }
        break;
      }
    }
  }

  // ═══════════════════════════════════
  // 4. SEMESTER GPA PROJECTION
  // ═══════════════════════════════════
  if (courseAverages.length > 0) {
    const gpaPoints = courseAverages.map((c) => percentToGpa(c.avg));
    const projectedGpa = Math.round((gpaPoints.reduce((a, b) => a + b, 0) / gpaPoints.length) * 100) / 100;
    const onTrack = gpaTarget ? projectedGpa >= gpaTarget : true;

    output.semesterProjection = { projected_gpa: projectedGpa, on_track: onTrack };

    if (!onTrack && gpaTarget) {
      output.insights.push(
        `Projected semester GPA: ${projectedGpa} — below your ${gpaTarget} target. Focus on ${courseAverages.filter((c) => c.avg < targetPercent).map((c) => c.name).join(", ")}.`
      );
    }
  }

  // ═══════════════════════════════════
  // 5. PROCRASTINATION DETECTION
  // ═══════════════════════════════════
  let procScore = 0;

  // Factor 1: Ignored assignments (0-30 points)
  const totalIgnored = context.assignments
    .filter((a) => a.status !== "completed")
    .reduce((sum, a) => sum + a.ignored_count, 0);
  procScore += Math.min(totalIgnored * 5, 30);

  // Factor 2: Overdue assignments (0-25 points)
  const overdueCount = context.assignments.filter((a) => a.status === "overdue").length;
  procScore += Math.min(overdueCount * 10, 25);

  // Factor 3: Skipped study blocks ratio (0-25 points)
  const recentBlocks = context.studyBlocks;
  const completed = recentBlocks.filter((s) => s.status === "completed").length;
  const skipped = recentBlocks.filter((s) => s.status === "skipped").length;
  if (completed + skipped > 0) {
    const skipRatio = skipped / (completed + skipped);
    procScore += Math.round(skipRatio * 25);
  }

  // Factor 4: Last-minute submissions pattern (0-20 points)
  const lastMinuteCount = context.assignments.filter((a) => {
    if (a.status !== "completed") return false;
    // Check if assignment was "overdue" at some point (high reminder_stage)
    return a.reminder_stage >= 3;
  }).length;
  procScore += Math.min(lastMinuteCount * 5, 20);

  output.procrastinationScore = Math.min(procScore, 100);

  if (procScore >= 60) {
    output.nudges.push({
      message: `Procrastination level: high. ${overdueCount > 0 ? `${overdueCount} overdue assignments.` : ""} ${skipped > 2 ? `${skipped} skipped study sessions.` : ""} Let's break the cycle — pick ONE task and start with just 25 minutes.`,
      severity: "firm",
    });
  }

  // ═══════════════════════════════════
  // 6. BURNOUT RISK ASSESSMENT
  // ═══════════════════════════════════
  const totalStudyHours = recentBlocks
    .filter((s) => s.status === "completed")
    .reduce((sum, b) => sum + (new Date(b.end_time).getTime() - new Date(b.start_time).getTime()) / 3600000, 0);

  const avgMood = context.recentMoodScores.length > 0
    ? context.recentMoodScores.reduce((a, b) => a + b, 0) / context.recentMoodScores.length
    : null;

  const decliningCourses = courseAverages.filter((c) => c.trend === "declining").length;

  let burnoutSignals = 0;
  if (totalStudyHours > 35) burnoutSignals++; // Overworking
  if (avgMood !== null && avgMood < 2.5) burnoutSignals++; // Low mood
  if (decliningCourses >= 2) burnoutSignals++; // Grades dropping despite effort
  if (skipped >= 4) burnoutSignals++; // Disengagement
  if (totalStudyHours > 25 && decliningCourses >= 1) burnoutSignals++; // Studying a lot but still declining

  output.burnoutRisk = burnoutSignals >= 3 ? "high" : burnoutSignals >= 2 ? "moderate" : "low";

  if (output.burnoutRisk === "high") {
    output.nudges.push({
      message: `Burnout risk detected: ${totalStudyHours.toFixed(0)} study hours this week${avgMood !== null ? `, mood averaging ${avgMood.toFixed(1)}/5` : ""}${decliningCourses > 0 ? `, ${decliningCourses} courses declining` : ""}. Consider taking a break, adjusting your schedule, or reaching out to campus wellness resources.`,
      severity: "urgent",
    });
    output.insights.push(
      "Your study load may be unsustainable. Diminishing returns kick in after ~25 hours/week. Focus on quality over quantity."
    );
  } else if (output.burnoutRisk === "moderate") {
    output.insights.push(
      "Watch your energy levels. Some signs of strain are showing — make sure you're getting enough rest."
    );
  }

  // ═══════════════════════════════════
  // 7. PRIORITY TASK — grade-risk-aware
  // ═══════════════════════════════════
  const pendingAssignments = context.assignments
    .filter((a) => a.status !== "completed")
    .sort((a, b) => {
      const aDate = new Date(a.due_date).getTime();
      const bDate = new Date(b.due_date).getTime();
      const aWeight = a.weight || 0;
      const bWeight = b.weight || 0;
      const aRiskBoost = output.gradeAlerts.find((ga) => ga.course_id === a.course_id)
        ? (output.gradeAlerts.find((ga) => ga.course_id === a.course_id)!.risk_level === "critical" ? 3 : 2) : 1;
      const bRiskBoost = output.gradeAlerts.find((ga) => ga.course_id === b.course_id)
        ? (output.gradeAlerts.find((ga) => ga.course_id === b.course_id)!.risk_level === "critical" ? 3 : 2) : 1;
      const aScore = (1 / Math.max(aDate - Date.now(), 1)) * (1 + aWeight) * aRiskBoost * (1 + a.ignored_count * 0.5);
      const bScore = (1 / Math.max(bDate - Date.now(), 1)) * (1 + bWeight) * bRiskBoost * (1 + b.ignored_count * 0.5);
      return bScore - aScore;
    });

  if (pendingAssignments.length > 0) {
    const top = pendingAssignments[0];
    const hoursLeft = Math.round((new Date(top.due_date).getTime() - Date.now()) / (1000 * 60 * 60));
    const courseAlert = output.gradeAlerts.find((ga) => ga.course_id === top.course_id);
    const urgencyNote = courseAlert
      ? ` (${courseAlert.course_name} is ${courseAlert.risk_level.replace("_", " ")} at ${courseAlert.average}%)`
      : "";

    output.priorityTask = {
      title: top.title,
      reason: hoursLeft > 0
        ? `Due in ${hoursLeft < 24 ? `${hoursLeft} hours` : `${Math.round(hoursLeft / 24)} days`}${top.weight ? ` — worth ${top.weight} pts` : ""}${urgencyNote}`
        : `OVERDUE${urgencyNote}`,
      assignment_id: top.id,
    };
  }

  // ═══════════════════════════════════
  // 8. WORKLOAD ANALYSIS
  // ═══════════════════════════════════
  const nextWeekDeadlines = context.assignments.filter((a) => {
    if (a.status === "completed") return false;
    const hoursLeft = (new Date(a.due_date).getTime() - Date.now()) / 3600000;
    return hoursLeft > 0 && hoursLeft <= 168;
  });

  if (nextWeekDeadlines.length >= 5) {
    const totalWeight = nextWeekDeadlines.reduce((s, a) => s + (a.weight || 0), 0);
    output.insights.push(
      `Heavy week ahead: ${nextWeekDeadlines.length} deadlines${totalWeight > 0 ? ` worth ${totalWeight} total points` : ""}. Schedule focused study blocks now.`
    );
  }

  // Deadline clustering detection (3+ deadlines within 48 hours)
  const deadlineClusters = findDeadlineClusters(context.assignments.filter((a) => a.status !== "completed"));
  for (const cluster of deadlineClusters) {
    output.nudges.push({
      message: `Deadline pile-up: ${cluster.count} assignments due within 48 hours (${cluster.titles.slice(0, 3).join(", ")}${cluster.count > 3 ? "..." : ""}). Start now — don't wait until the last day.`,
      severity: "urgent",
    });
  }

  // ═══════════════════════════════════
  // 9. STUDY CONSISTENCY CHECK
  // ═══════════════════════════════════
  if (completed + skipped > 0) {
    const followThrough = completed / (completed + skipped);
    if (followThrough < 0.5 && skipped >= 3) {
      output.insights.push(
        `Study follow-through is at ${Math.round(followThrough * 100)}% — you've skipped ${skipped} sessions. Try shorter blocks (30 min) to build consistency.`
      );
    } else if (followThrough >= 0.8 && completed >= 5) {
      output.insights.push(
        `Excellent study consistency — ${Math.round(followThrough * 100)}% follow-through. Keep it up!`
      );
    }
  }

  // ═══════════════════════════════════
  // 10. HIGH-WEIGHT ASSIGNMENT DETECTION
  // ═══════════════════════════════════
  const highWeightUpcoming = context.assignments
    .filter((a) => a.status !== "completed" && a.weight && a.weight >= 50)
    .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());

  if (highWeightUpcoming.length > 0) {
    const hw = highWeightUpcoming[0];
    const daysLeft = Math.round((new Date(hw.due_date).getTime() - Date.now()) / 86400000);
    if (daysLeft <= 7 && daysLeft > 0) {
      output.insights.push(
        `"${hw.title}" is worth ${hw.weight} points and due in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}. This could significantly impact your grade.`
      );
    }
  }

  // ═══════════════════════════════════
  // 11. AI INSIGHTS (if enough data)
  // ═══════════════════════════════════
  if (context.grades.length >= 3 || context.assignments.length >= 5) {
    try {
      const aiInsights = await generateAIInsights(context, output);
      output.insights.push(...aiInsights);
    } catch {
      // Non-critical
    }
  }

  return output;
}

// ═══════════════════════════════════
// HELPER: Find deadline clusters (3+ within 48h)
// ═══════════════════════════════════
function findDeadlineClusters(assignments: Assignment[]): Array<{ count: number; titles: string[] }> {
  const clusters: Array<{ count: number; titles: string[] }> = [];
  const sorted = [...assignments].sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());

  for (let i = 0; i < sorted.length; i++) {
    const windowEnd = new Date(sorted[i].due_date).getTime() + 48 * 3600000;
    const cluster = sorted.filter((a) => {
      const t = new Date(a.due_date).getTime();
      return t >= new Date(sorted[i].due_date).getTime() && t <= windowEnd;
    });

    if (cluster.length >= 3) {
      // Avoid duplicate clusters
      const key = cluster.map((a) => a.id).sort().join(",");
      if (!clusters.some((c) => c.titles.join(",") === cluster.map((a) => a.title).join(","))) {
        clusters.push({ count: cluster.length, titles: cluster.map((a) => a.title) });
      }
    }
  }

  return clusters;
}

// ═══════════════════════════════════
// AI INSIGHTS — enhanced with full reasoning output context
// ═══════════════════════════════════
async function generateAIInsights(
  context: ReasoningContext,
  currentOutput: ReasoningOutput
): Promise<string[]> {
  const client = getAzureOpenAI();

  const courseMap = new Map<string, { name: string; grades: Array<{ title: string; pct: number }> }>();
  for (const g of context.grades) {
    if (g.score == null || g.max_score == null || g.max_score <= 0) continue;
    const courseName = g.course?.name || "Unknown";
    const existing = courseMap.get(g.course_id);
    const entry = { title: g.title, pct: Math.round((g.score / g.max_score) * 1000) / 10 };
    if (existing) {
      existing.grades.push(entry);
    } else {
      courseMap.set(g.course_id, { name: courseName, grades: [entry] });
    }
  }

  const gradesSummary = Array.from(courseMap.values())
    .map((c) => {
      const avg = c.grades.reduce((s, g) => s + g.pct, 0) / c.grades.length;
      return `${c.name} (avg: ${avg.toFixed(1)}%):\n${c.grades.map((g) => `  - ${g.title}: ${g.pct}%`).join("\n")}`;
    })
    .join("\n\n");

  const alertsSummary = currentOutput.gradeAlerts.length > 0
    ? `\nGRADE ALERTS:\n${currentOutput.gradeAlerts.map((a) => `- ${a.message}`).join("\n")}`
    : "";

  const cliffsSummary = currentOutput.gradeCliffs.length > 0
    ? `\nGRADE CLIFFS:\n${currentOutput.gradeCliffs.map((c) => `- ${c.course_name}: ${c.average}% (${c.current_letter}) — ${c.margin}% above ${c.grade_below}`).join("\n")}`
    : "";

  const assignmentsSummary = context.assignments
    .filter((a) => a.status !== "completed")
    .map((a) => `${a.title} — due ${a.due_date} — ${a.status} — ignored ${a.ignored_count}x${a.weight ? ` — ${a.weight} pts` : ""}`)
    .join("\n");

  const avgMood = context.recentMoodScores.length > 0
    ? context.recentMoodScores.reduce((a, b) => a + b, 0) / context.recentMoodScores.length
    : null;

  const completedStudy = context.studyBlocks.filter((s) => s.status === "completed");
  const totalHours = Math.round(completedStudy.reduce((sum, b) => sum + (new Date(b.end_time).getTime() - new Date(b.start_time).getTime()) / 3600000, 0) * 10) / 10;

  const response = await client.chat.completions.create({
    model: process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4o",
    messages: [
      {
        role: "system",
        content: `You are analyzing a college student's academic data to generate 2-4 brief, actionable insights. You have access to their full context including grade trends, cliffs, procrastination score, and burnout risk.

Focus on:
1. Grade trends — courses improving or declining. Reference specific scores.
2. Grade cliffs — courses near letter grade boundaries. Be specific about the margin.
3. Strategic priorities — what should they focus on RIGHT NOW to maximize GPA?
4. Study ROI — where is study time most/least effective?
5. Risk mitigation — what's the single biggest threat to their GPA this week?

Be specific. Reference actual course names and scores. Keep each insight to 1-2 sentences. Use urgency when appropriate.

Return JSON: { "insights": ["string array"] }`,
      },
      {
        role: "user",
        content: `Student: ${context.profile.full_name}
GPA Target: ${context.profile.gpa_target || "Not set"}
Procrastination Score: ${currentOutput.procrastinationScore}/100
Burnout Risk: ${currentOutput.burnoutRisk}
Projected GPA: ${currentOutput.semesterProjection?.projected_gpa ?? "Unknown"}

GRADES BY COURSE:
${gradesSummary || "No grades yet"}
${alertsSummary}${cliffsSummary}

UPCOMING WORK:
${assignmentsSummary || "No pending assignments"}

Average mood (1-5): ${avgMood?.toFixed(1) || "No data"}
Study blocks completed: ${completedStudy.length}
Total study hours: ${totalHours}`,
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.3,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) return [];

  const parsed = JSON.parse(content);
  return Array.isArray(parsed) ? parsed : parsed.insights || [];
}
