import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const courseId = searchParams.get("course_id");
  const start = searchParams.get("start");
  const end = searchParams.get("end");
  const status = searchParams.get("status");

  let query = supabase
    .from("assignments")
    .select("*, course:courses(*)")
    .eq("user_id", user.id)
    .order("due_date", { ascending: true });

  if (courseId) query = query.eq("course_id", courseId);
  if (status) query = query.eq("status", status);
  if (start) query = query.gte("due_date", start);
  if (end) query = query.lte("due_date", end);

  const { data: assignments, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ assignments });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();

  const { data: assignment, error } = await supabase
    .from("assignments")
    .insert({
      user_id: user.id,
      course_id: body.course_id || null,
      title: body.title,
      description: body.description || null,
      due_date: body.due_date,
      priority: body.priority || "medium",
      status: body.status || "pending",
      weight: body.weight || null,
      estimated_hours: body.estimated_hours || null,
      source: body.source || "manual",
      confidence_score: body.confidence_score || null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ assignment });
}

export async function PUT(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();

  const { error } = await supabase
    .from("assignments")
    .update({
      status: body.status,
      priority: body.priority,
      reminder_stage: body.reminder_stage,
      ignored_count: body.ignored_count,
    })
    .eq("id", body.id)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
