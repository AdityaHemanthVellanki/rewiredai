import { createClient } from "@/lib/supabase/server";
import {
  fetchCanvasCourses,
  fetchCanvasAssignments,
  fetchCanvasSubmissions,
} from "@/lib/canvas";
import { NextResponse } from "next/server";
import type { CanvasSubmission } from "@/types";

// Sync courses, assignments, submissions, and grades from Canvas LMS
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get Canvas connection
  const { data: canvasConn } = await supabase
    .from("canvas_connections")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (!canvasConn) {
    return NextResponse.json(
      { error: "Canvas not connected" },
      { status: 400 }
    );
  }

  const baseUrl = canvasConn.canvas_base_url;
  const token = canvasConn.api_token;

  try {
    const canvasCourses = await fetchCanvasCourses(baseUrl, token);

    let coursesCreated = 0;
    let assignmentsCreated = 0;
    let assignmentsUpdated = 0;
    let gradesImported = 0;

    for (const cc of canvasCourses) {
      if (cc.workflow_state !== "available") continue;

      // Upsert course
      const { data: existingCourse } = await supabase
        .from("courses")
        .select("id")
        .eq("user_id", user.id)
        .eq("code", cc.course_code)
        .single();

      let courseId: string;

      if (existingCourse) {
        courseId = existingCourse.id;
      } else {
        const { data: newCourse } = await supabase
          .from("courses")
          .insert({
            user_id: user.id,
            name: cc.name,
            code: cc.course_code,
            color: getColorForIndex(coursesCreated),
          })
          .select("id")
          .single();

        if (!newCourse) continue;
        courseId = newCourse.id;
        coursesCreated++;
      }

      // Fetch assignments AND submissions in parallel
      try {
        const [canvasAssignments, canvasSubmissions] = await Promise.all([
          fetchCanvasAssignments(baseUrl, token, cc.id),
          fetchCanvasSubmissions(baseUrl, token, cc.id),
        ]);

        // Build submission lookup: canvas assignment_id → submission
        const submissionMap = new Map<number, CanvasSubmission>();
        for (const sub of canvasSubmissions) {
          submissionMap.set(sub.assignment_id, sub);
        }

        for (const ca of canvasAssignments) {
          if (!ca.due_at) continue;

          const submission = submissionMap.get(ca.id);
          const isSubmitted =
            submission !== undefined && isSubmissionCompleted(submission);
          const isGraded =
            submission !== undefined &&
            submission.workflow_state === "graded" &&
            submission.score !== null;

          // Determine correct status from Canvas data
          let status: "pending" | "completed" | "overdue";
          if (isSubmitted || isGraded) {
            status = "completed";
          } else {
            const dueDate = new Date(ca.due_at);
            status = dueDate < new Date() ? "overdue" : "pending";
          }

          // Try to find existing assignment by canvas_assignment_id first
          const { data: existingById } = await supabase
            .from("assignments")
            .select("id, status")
            .eq("user_id", user.id)
            .eq("canvas_assignment_id", ca.id)
            .single();

          let assignmentId: string;

          if (existingById) {
            assignmentId = existingById.id;
            // Always refresh status and priority on re-sync
            await supabase
              .from("assignments")
              .update({
                status,
                priority: determinePriority(ca.due_at, status),
                due_date: ca.due_at,
              })
              .eq("id", existingById.id);
            assignmentsUpdated++;
          } else {
            // Fallback: check by title+course for previously synced data
            const { data: existingByTitle } = await supabase
              .from("assignments")
              .select("id, status")
              .eq("user_id", user.id)
              .eq("course_id", courseId)
              .eq("title", ca.name)
              .single();

            if (existingByTitle) {
              assignmentId = existingByTitle.id;
              // Backfill canvas_assignment_id and refresh status
              await supabase
                .from("assignments")
                .update({
                  canvas_assignment_id: ca.id,
                  status,
                  priority: determinePriority(ca.due_at, status),
                  due_date: ca.due_at,
                })
                .eq("id", existingByTitle.id);
              assignmentsUpdated++;
            } else {
              // Create new assignment
              const { data: newAssignment } = await supabase
                .from("assignments")
                .insert({
                  user_id: user.id,
                  course_id: courseId,
                  title: ca.name,
                  description: ca.description
                    ? ca.description.replace(/<[^>]*>/g, "").substring(0, 500)
                    : null,
                  due_date: ca.due_at,
                  weight: ca.points_possible,
                  source: "lms",
                  priority: determinePriority(ca.due_at, status),
                  status,
                  canvas_assignment_id: ca.id,
                })
                .select("id")
                .single();

              if (!newAssignment) continue;
              assignmentId = newAssignment.id;
              assignmentsCreated++;
            }
          }

          // Import grade if graded
          if (
            isGraded &&
            submission.score !== null &&
            ca.points_possible !== null &&
            ca.points_possible > 0
          ) {
            const { data: existingGrade } = await supabase
              .from("grades")
              .select("id")
              .eq("user_id", user.id)
              .eq("assignment_id", assignmentId)
              .single();

            if (existingGrade) {
              await supabase
                .from("grades")
                .update({
                  score: submission.score,
                  max_score: ca.points_possible,
                })
                .eq("id", existingGrade.id);
            } else {
              await supabase.from("grades").insert({
                user_id: user.id,
                course_id: courseId,
                assignment_id: assignmentId,
                title: ca.name,
                score: submission.score,
                max_score: ca.points_possible,
                weight: ca.points_possible,
              });
            }
            gradesImported++;
          }
        }
      } catch {
        // Skip this course if assignments/submissions fail to fetch
      }
    }

    // Update last synced timestamp
    await supabase
      .from("canvas_connections")
      .update({ last_synced_at: new Date().toISOString() })
      .eq("user_id", user.id);

    return NextResponse.json({
      success: true,
      coursesCreated,
      assignmentsCreated,
      assignmentsUpdated,
      gradesImported,
      totalCourses: canvasCourses.filter((c) => c.workflow_state === "available")
        .length,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to sync with Canvas",
      },
      { status: 500 }
    );
  }
}

function isSubmissionCompleted(submission: CanvasSubmission): boolean {
  const completedStates = ["submitted", "graded", "complete"];
  return (
    completedStates.includes(submission.workflow_state) ||
    submission.submitted_at !== null
  );
}

function determinePriority(
  dueDate: string,
  status: string
): "low" | "medium" | "high" | "critical" {
  if (status === "completed") return "low";

  const now = new Date();
  const due = new Date(dueDate);
  const daysUntilDue =
    (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

  if (daysUntilDue < 0) return "critical";
  if (daysUntilDue < 1) return "critical";
  if (daysUntilDue < 3) return "high";
  if (daysUntilDue < 7) return "medium";
  return "low";
}

const COURSE_COLORS = [
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#f43f5e",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#06b6d4",
];

function getColorForIndex(index: number): string {
  return COURSE_COLORS[index % COURSE_COLORS.length];
}
