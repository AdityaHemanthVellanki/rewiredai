import { createClient } from "@/lib/supabase/server";
import {
  fetchCanvasCourses,
  fetchCanvasAssignments,
  getValidCanvasToken,
} from "@/lib/canvas";
import { NextResponse } from "next/server";

// Sync courses and assignments from Canvas LMS
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

  // Refresh token if needed
  let accessToken = canvasConn.access_token;
  try {
    const result = await getValidCanvasToken(
      canvasConn.access_token,
      canvasConn.refresh_token,
      canvasConn.token_expires_at ? new Date(canvasConn.token_expires_at) : null
    );
    accessToken = result.accessToken;

    if (result.refreshed && result.expiresAt) {
      await supabase
        .from("canvas_connections")
        .update({
          access_token: result.accessToken,
          token_expires_at: result.expiresAt.toISOString(),
        })
        .eq("id", canvasConn.id);
    }
  } catch {
    return NextResponse.json(
      { error: "Canvas token expired. Please reconnect Canvas." },
      { status: 401 }
    );
  }

  try {
    // 1. Fetch courses from Canvas
    const canvasCourses = await fetchCanvasCourses(accessToken);

    let coursesCreated = 0;
    let assignmentsCreated = 0;

    for (const cc of canvasCourses) {
      // Skip non-active courses
      if (cc.workflow_state !== "available") continue;

      // Check if course already exists (by matching code)
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
        // Create the course
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

      // 2. Fetch assignments for each course
      try {
        const canvasAssignments = await fetchCanvasAssignments(
          accessToken,
          cc.id
        );

        for (const ca of canvasAssignments) {
          if (!ca.due_at) continue;

          const { data: existingAssignment } = await supabase
            .from("assignments")
            .select("id")
            .eq("user_id", user.id)
            .eq("course_id", courseId)
            .eq("title", ca.name)
            .single();

          if (existingAssignment) continue;

          await supabase.from("assignments").insert({
            user_id: user.id,
            course_id: courseId,
            title: ca.name,
            description: ca.description
              ? ca.description.replace(/<[^>]*>/g, "").substring(0, 500)
              : null,
            due_date: ca.due_at,
            weight: ca.points_possible,
            source: "lms",
            priority: determinePriority(ca.due_at),
          });

          assignmentsCreated++;
        }
      } catch {
        // Skip this course's assignments if they fail to fetch
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
      totalCourses: canvasCourses.length,
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

function determinePriority(
  dueDate: string
): "low" | "medium" | "high" | "critical" {
  const now = new Date();
  const due = new Date(dueDate);
  const daysUntilDue = (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

  if (daysUntilDue < 1) return "critical";
  if (daysUntilDue < 3) return "high";
  if (daysUntilDue < 7) return "medium";
  return "low";
}

const COURSE_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#f43f5e",
  "#f97316", "#eab308", "#22c55e", "#06b6d4",
];

function getColorForIndex(index: number): string {
  return COURSE_COLORS[index % COURSE_COLORS.length];
}
