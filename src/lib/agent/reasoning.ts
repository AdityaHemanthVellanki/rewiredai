import { getAzureOpenAI } from "@/lib/azure-openai";
import { calculateEscalation } from "./escalation";
import type { Assignment, Profile, Grade, StudyBlock } from "@/types";

/**
 * Background reasoning engine — runs periodically to analyze student data
 * and generate proactive nudges, study block suggestions, and insights.
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
}

// Helper: convert percentage to letter grade
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

// Helper: GPA target to minimum percentage
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

export async function runBackgroundReasoning(
  context: ReasoningContext
): Promise<ReasoningOutput> {
  const output: ReasoningOutput = {
    nudges: [],
    suggestedStudyBlocks: [],
    insights: [],
    priorityTask: null,
    gradeAlerts: [],
  };

  // 1. Check escalation for all pending assignments
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

  // 2. Grade risk analysis — per-course averages and alerts
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

  for (const [courseId, courseData] of courseGradeMap) {
    const avg = (courseData.earned / courseData.possible) * 100;
    const letter = getLetterGrade(avg);

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

    // Check for declining trend (if 4+ grades in course)
    if (courseData.grades.length >= 4) {
      const sorted = [...courseData.grades].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      const recent = sorted.slice(0, 3);
      const older = sorted.slice(-3);
      const recentAvg = recent.reduce((s, g) => s + (g.score! / g.max_score!), 0) / recent.length;
      const olderAvg = older.reduce((s, g) => s + (g.score! / g.max_score!), 0) / older.length;
      if (recentAvg < olderAvg - 0.05 && !output.gradeAlerts.find((a) => a.course_id === courseId)) {
        output.gradeAlerts.push({
          course_id: courseId,
          course_name: courseData.name,
          average: Math.round(avg * 10) / 10,
          letter_grade: letter,
          risk_level: "warning",
          message: `Grades in ${courseData.name} are trending down (recent: ${(recentAvg * 100).toFixed(0)}% vs earlier: ${(olderAvg * 100).toFixed(0)}%).`,
        });
      }
    }
  }

  // 3. Determine #1 priority task — factor in grade risk
  const pendingAssignments = context.assignments
    .filter((a) => a.status !== "completed")
    .sort((a, b) => {
      const aDate = new Date(a.due_date).getTime();
      const bDate = new Date(b.due_date).getTime();
      const aWeight = a.weight || 0;
      const bWeight = b.weight || 0;
      // Boost priority for courses with grade alerts
      const aRiskBoost = output.gradeAlerts.find((ga) => ga.course_id === a.course_id)
        ? (output.gradeAlerts.find((ga) => ga.course_id === a.course_id)!.risk_level === "critical" ? 3 : 2)
        : 1;
      const bRiskBoost = output.gradeAlerts.find((ga) => ga.course_id === b.course_id)
        ? (output.gradeAlerts.find((ga) => ga.course_id === b.course_id)!.risk_level === "critical" ? 3 : 2)
        : 1;
      const aScore = (1 / Math.max(aDate - Date.now(), 1)) * (1 + aWeight) * aRiskBoost * (1 + a.ignored_count * 0.5);
      const bScore = (1 / Math.max(bDate - Date.now(), 1)) * (1 + bWeight) * bRiskBoost * (1 + b.ignored_count * 0.5);
      return bScore - aScore;
    });

  if (pendingAssignments.length > 0) {
    const top = pendingAssignments[0];
    const hoursLeft = Math.round(
      (new Date(top.due_date).getTime() - Date.now()) / (1000 * 60 * 60)
    );
    const courseAlert = output.gradeAlerts.find((ga) => ga.course_id === top.course_id);
    const urgencyNote = courseAlert
      ? ` (${courseAlert.course_name} is ${courseAlert.risk_level.replace("_", " ")} at ${courseAlert.average}%)`
      : "";

    output.priorityTask = {
      title: top.title,
      reason:
        hoursLeft > 0
          ? `Due in ${hoursLeft < 24 ? `${hoursLeft} hours` : `${Math.round(hoursLeft / 24)} days`}${top.weight ? ` — worth ${top.weight} pts` : ""}${urgencyNote}`
          : `OVERDUE${urgencyNote}`,
      assignment_id: top.id,
    };
  }

  // 4. Workload analysis — detect overloaded weeks
  const nextWeekDeadlines = context.assignments.filter((a) => {
    if (a.status === "completed") return false;
    const hoursLeft = (new Date(a.due_date).getTime() - Date.now()) / 3600000;
    return hoursLeft > 0 && hoursLeft <= 168; // next 7 days
  });

  if (nextWeekDeadlines.length >= 5) {
    output.insights.push(
      `Heavy week ahead: ${nextWeekDeadlines.length} deadlines in the next 7 days. Schedule focused study blocks now.`
    );
  }

  // 5. Study consistency check
  const completedStudy = context.studyBlocks.filter((s) => s.status === "completed");
  const skippedStudy = context.studyBlocks.filter((s) => s.status === "skipped");
  if (completedStudy.length + skippedStudy.length > 0) {
    const followThrough = completedStudy.length / (completedStudy.length + skippedStudy.length);
    if (followThrough < 0.5 && skippedStudy.length >= 3) {
      output.insights.push(
        `Study follow-through is at ${Math.round(followThrough * 100)}% — you've skipped ${skippedStudy.length} sessions. Shorter blocks (30-45 min) may work better.`
      );
    } else if (followThrough >= 0.8 && completedStudy.length >= 5) {
      output.insights.push(
        `Excellent study consistency — ${Math.round(followThrough * 100)}% follow-through this week. Keep it up!`
      );
    }
  }

  // 6. High-weight assignment detection
  const highWeightUpcoming = context.assignments
    .filter((a) => a.status !== "completed" && a.weight && a.weight >= 50)
    .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());

  if (highWeightUpcoming.length > 0) {
    const hw = highWeightUpcoming[0];
    const daysLeft = Math.round((new Date(hw.due_date).getTime() - Date.now()) / 86400000);
    if (daysLeft <= 7) {
      output.insights.push(
        `"${hw.title}" is worth ${hw.weight} points and due in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}. This could significantly impact your grade.`
      );
    }
  }

  // 7. Use AI for deeper insights if we have enough data
  if (context.grades.length >= 3 || context.assignments.length >= 5) {
    try {
      const aiInsights = await generateAIInsights(context, output.gradeAlerts);
      output.insights.push(...aiInsights);
    } catch {
      // Non-critical, skip AI insights if it fails
    }
  }

  return output;
}

async function generateAIInsights(
  context: ReasoningContext,
  gradeAlerts: ReasoningOutput["gradeAlerts"]
): Promise<string[]> {
  const client = getAzureOpenAI();

  // Build per-course grade summaries
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

  const alertsSummary = gradeAlerts.length > 0
    ? `\nGRADE ALERTS:\n${gradeAlerts.map((a) => `- ${a.message}`).join("\n")}`
    : "";

  const assignmentsSummary = context.assignments
    .filter((a) => a.status !== "completed")
    .map((a) => `${a.title} — due ${a.due_date} — ${a.status} — ignored ${a.ignored_count}x${a.weight ? ` — ${a.weight} pts` : ""}`)
    .join("\n");

  const avgMood =
    context.recentMoodScores.length > 0
      ? context.recentMoodScores.reduce((a, b) => a + b, 0) / context.recentMoodScores.length
      : null;

  const response = await client.chat.completions.create({
    model: process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4o",
    messages: [
      {
        role: "system",
        content: `You are analyzing a college student's academic data to generate 2-4 brief, actionable insights. Focus on:
1. Grade trends — identify courses where performance is changing (improving or declining). Reference specific scores.
2. Grade risks — if any course is below their GPA target, flag it with specific recommendations.
3. Study patterns — correlate study hours with grade performance.
4. Strategic priorities — what should they focus on RIGHT NOW to maximize their GPA?

Be specific. Reference actual course names and scores. Keep each insight to 1-2 sentences. Return JSON: { "insights": ["string array"] }`,
      },
      {
        role: "user",
        content: `Student: ${context.profile.full_name}
GPA Target: ${context.profile.gpa_target || "Not set"}

GRADES BY COURSE:
${gradesSummary || "No grades yet"}
${alertsSummary}

UPCOMING WORK:
${assignmentsSummary || "No pending assignments"}

Average mood (1-5): ${avgMood || "No data"}
Study blocks completed this week: ${context.studyBlocks.filter((s) => s.status === "completed").length}
Total study hours this week: ${Math.round(context.studyBlocks.filter((s) => s.status === "completed").reduce((sum, b) => sum + (new Date(b.end_time).getTime() - new Date(b.start_time).getTime()) / 3600000, 0) * 10) / 10}`,
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
