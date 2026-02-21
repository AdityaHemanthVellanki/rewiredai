import { createClient } from "@/lib/supabase/server";
import { runBackgroundReasoning } from "@/lib/agent/reasoning";
import { NextResponse } from "next/server";
import type { Profile } from "@/types";

/**
 * Background agent processing endpoint.
 * Triggered periodically (via cron) or manually to:
 * - Check for deadlines needing escalation
 * - Generate proactive nudges
 * - Determine priority task
 * - Generate insights
 */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch all context
  const [
    { data: profile },
    { data: assignments },
    { data: grades },
    { data: studyBlocks },
    { data: moodEntries },
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase
      .from("assignments")
      .select("*")
      .eq("user_id", user.id)
      .neq("status", "completed")
      .order("due_date"),
    supabase
      .from("grades")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("study_blocks")
      .select("*")
      .eq("user_id", user.id)
      .gte(
        "start_time",
        new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      ),
    supabase
      .from("mood_entries")
      .select("mood_score")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(7),
  ]);

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const output = await runBackgroundReasoning({
    profile: profile as unknown as Profile,
    assignments: assignments || [],
    grades: grades || [],
    studyBlocks: studyBlocks || [],
    recentMoodScores: (moodEntries || []).map(
      (m: { mood_score: number }) => m.mood_score
    ),
  });

  // Save nudges
  for (const nudge of output.nudges) {
    await supabase.from("nudges").insert({
      user_id: user.id,
      message: nudge.message,
      severity: nudge.severity,
      assignment_id: nudge.assignment_id || null,
      status: "pending",
    });

    // Update assignment reminder stage
    if (nudge.assignment_id) {
      const assignment = (assignments || []).find(
        (a: { id: string }) => a.id === nudge.assignment_id
      );
      if (assignment) {
        await supabase
          .from("assignments")
          .update({
            reminder_stage: Math.max(
              assignment.reminder_stage || 0,
              nudge.severity === "gentle"
                ? 1
                : nudge.severity === "firm"
                  ? 2
                  : nudge.severity === "urgent"
                    ? 3
                    : 4
            ),
          })
          .eq("id", nudge.assignment_id);
      }
    }
  }

  // Log agent activity
  await supabase.from("agent_activity_log").insert({
    user_id: user.id,
    action: "background_reasoning",
    description: `Generated ${output.nudges.length} nudges, ${output.insights.length} insights`,
    metadata: {
      nudges: output.nudges.length,
      insights: output.insights,
      priorityTask: output.priorityTask,
    },
  });

  return NextResponse.json(output);
}
