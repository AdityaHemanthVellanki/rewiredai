import { createClient } from "@/lib/supabase/server";
import { runBackgroundReasoning } from "@/lib/agent/reasoning";
import { NextResponse } from "next/server";
import type { Profile } from "@/types";
import { dualWriteCreate } from "@/lib/solana/dual-write";
import { DataType } from "@/lib/solana/constants";

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
      .select("*, course:courses(name, code)")
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

  // Auto-mark past-due assignments as overdue (only if not completed)
  const now = new Date().toISOString();
  const pendingPastDue = (assignments || []).filter(
    (a: { status: string; due_date: string }) =>
      a.status === "pending" && a.due_date < now
  );
  for (const a of pendingPastDue) {
    await supabase
      .from("assignments")
      .update({ status: "overdue" })
      .eq("id", (a as { id: string }).id);
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
    const { data: nudgeRow } = await supabase.from("nudges").insert({
      user_id: user.id,
      message: nudge.message,
      severity: nudge.severity,
      assignment_id: nudge.assignment_id || null,
      status: "pending",
    }).select().single();

    // Dual-write nudge to Solana
    if (nudgeRow) {
      const { id: nudgeId, user_id: _uid, solana_index: _si, assignment, ...onChainNudge } = nudgeRow;
      const { count: nudgeCount } = await supabase
        .from("nudges")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .not("solana_index", "is", null);
      dualWriteCreate(user.id, DataType.Nudge, nudgeCount ?? 0, onChainNudge)
        .then((result) => {
          if (result) {
            supabase.from("nudges").update({ solana_index: result.index }).eq("id", nudgeId).then(() => {});
          }
        })
        .catch(console.error);
    }

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

  // Save grade alert nudges
  for (const alert of output.gradeAlerts) {
    const severity = alert.risk_level === "critical" ? "nuclear" as const
      : alert.risk_level === "at_risk" ? "urgent" as const
      : "firm" as const;
    const { data: alertRow } = await supabase.from("nudges").insert({
      user_id: user.id,
      message: alert.message,
      severity,
      status: "pending",
    }).select().single();

    if (alertRow) {
      const { id: alertId, user_id: _uid2, solana_index: _si2, assignment: _a, ...onChainAlert } = alertRow;
      const { count: alertCount } = await supabase
        .from("nudges")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .not("solana_index", "is", null);
      dualWriteCreate(user.id, DataType.Nudge, alertCount ?? 0, onChainAlert)
        .then((result) => {
          if (result) {
            supabase.from("nudges").update({ solana_index: result.index }).eq("id", alertId).then(() => {});
          }
        })
        .catch(console.error);
    }
  }

  // Log agent activity with full intelligence data
  const { data: activityRow } = await supabase.from("agent_activity_log").insert({
    user_id: user.id,
    action: "background_reasoning",
    description: `Generated ${output.nudges.length} nudges, ${output.gradeAlerts.length} grade alerts, ${output.gradeCliffs.length} grade cliffs, ${output.insights.length} insights | Procrastination: ${output.procrastinationScore}/100 | Burnout: ${output.burnoutRisk}${output.semesterProjection ? ` | Projected GPA: ${output.semesterProjection.projected_gpa}` : ""}`,
    metadata: {
      nudges: output.nudges.length,
      gradeAlerts: output.gradeAlerts,
      gradeCliffs: output.gradeCliffs,
      insights: output.insights,
      priorityTask: output.priorityTask,
      procrastinationScore: output.procrastinationScore,
      burnoutRisk: output.burnoutRisk,
      semesterProjection: output.semesterProjection,
    },
  }).select().single();

  // Dual-write activity log to Solana
  if (activityRow) {
    const { id: actId, user_id: _uid3, solana_index: _si3, ...onChainActivity } = activityRow;
    const { count: actCount } = await supabase
      .from("agent_activity_log")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .not("solana_index", "is", null);
    dualWriteCreate(user.id, DataType.Activity, actCount ?? 0, onChainActivity)
      .then((result) => {
        if (result) {
          supabase.from("agent_activity_log").update({ solana_index: result.index }).eq("id", actId).then(() => {});
        }
      })
      .catch(console.error);
  }

  return NextResponse.json(output);
}
