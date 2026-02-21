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
}

export async function runBackgroundReasoning(
  context: ReasoningContext
): Promise<ReasoningOutput> {
  const output: ReasoningOutput = {
    nudges: [],
    suggestedStudyBlocks: [],
    insights: [],
    priorityTask: null,
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

  // 2. Determine #1 priority task
  const pendingAssignments = context.assignments
    .filter((a) => a.status !== "completed")
    .sort((a, b) => {
      const aDate = new Date(a.due_date).getTime();
      const bDate = new Date(b.due_date).getTime();
      const aWeight = a.weight || 0;
      const bWeight = b.weight || 0;
      // Score = urgency (closer deadline = higher) * importance (weight)
      const aScore = (1 / Math.max(aDate - Date.now(), 1)) * (1 + aWeight) * (1 + a.ignored_count * 0.5);
      const bScore = (1 / Math.max(bDate - Date.now(), 1)) * (1 + bWeight) * (1 + b.ignored_count * 0.5);
      return bScore - aScore;
    });

  if (pendingAssignments.length > 0) {
    const top = pendingAssignments[0];
    const hoursLeft = Math.round(
      (new Date(top.due_date).getTime() - Date.now()) / (1000 * 60 * 60)
    );
    output.priorityTask = {
      title: top.title,
      reason:
        hoursLeft > 0
          ? `Due in ${hoursLeft < 24 ? `${hoursLeft} hours` : `${Math.round(hoursLeft / 24)} days`}${top.weight ? ` — worth ${top.weight}% of your grade` : ""}`
          : "OVERDUE",
      assignment_id: top.id,
    };
  }

  // 3. Use AI for deeper insights if we have enough data
  if (context.grades.length >= 3 || context.assignments.length >= 5) {
    try {
      const aiInsights = await generateAIInsights(context);
      output.insights.push(...aiInsights);
    } catch {
      // Non-critical, skip AI insights if it fails
    }
  }

  return output;
}

async function generateAIInsights(context: ReasoningContext): Promise<string[]> {
  const client = getAzureOpenAI();

  const gradesSummary = context.grades
    .map((g) => `${g.title}: ${g.score}/${g.max_score} (${g.weight || "?"}%)`)
    .join("\n");

  const assignmentsSummary = context.assignments
    .filter((a) => a.status !== "completed")
    .map((a) => `${a.title} — due ${a.due_date} — ${a.status} — ignored ${a.ignored_count}x`)
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
        content:
          'You are analyzing a college student\'s academic data to generate 1-3 brief, actionable insights. Be specific and reference actual data. Keep each insight to 1-2 sentences. Return a JSON array of strings. Example: ["Your quiz scores in CHEM 101 are trending down — consider practice quizzes.", "You tend to leave essays to the last 2 days — starting earlier correlated with your best grades."]',
      },
      {
        role: "user",
        content: `Student: ${context.profile.full_name}\nGPA Target: ${context.profile.gpa_target}\n\nGrades:\n${gradesSummary}\n\nUpcoming assignments:\n${assignmentsSummary}\n\nAverage mood (1-5): ${avgMood || "No data"}\n\nStudy blocks completed this week: ${context.studyBlocks.filter((s) => s.status === "completed").length}`,
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
