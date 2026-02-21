import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const { data: googleAccounts } = await supabase
    .from("google_accounts")
    .select("id, google_email")
    .eq("user_id", user.id);

  const { data: canvasConn } = await supabase
    .from("canvas_connections")
    .select("id, canvas_base_url, student_name, last_synced_at")
    .eq("user_id", user.id)
    .single();

  return NextResponse.json({
    profile,
    googleConnected: (googleAccounts || []).length > 0,
    googleEmail: googleAccounts?.[0]?.google_email || null,
    canvasConnected: !!canvasConn,
    canvasInfo: canvasConn || null,
  });
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
    .from("profiles")
    .update({
      full_name: body.full_name,
      timezone: body.timezone,
      semester_goals: body.semester_goals,
      personal_why: body.personal_why,
      personal_fears: body.personal_fears,
      mantras: body.mantras,
      productivity_peak_hours: body.productivity_peak_hours,
      sleep_window: body.sleep_window,
      escalation_mode: body.escalation_mode,
      gpa_target: body.gpa_target,
      onboarding_completed: body.onboarding_completed,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
