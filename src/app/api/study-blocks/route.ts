import { createClient } from "@/lib/supabase/server";
import { getGoogleAccessToken } from "@/lib/google/auth";
import { createCalendarEvent, deleteCalendarEvent } from "@/lib/google/calendar";
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
  const start = searchParams.get("start");
  const end = searchParams.get("end");

  let query = supabase
    .from("study_blocks")
    .select("*, course:courses(*), assignment:assignments(*)")
    .eq("user_id", user.id)
    .order("start_time", { ascending: true });

  if (start) query = query.gte("start_time", start);
  if (end) query = query.lte("start_time", end);

  const { data: studyBlocks, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ studyBlocks });
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

  const { data: studyBlock, error } = await supabase
    .from("study_blocks")
    .insert({
      user_id: user.id,
      course_id: body.course_id || null,
      assignment_id: body.assignment_id || null,
      title: body.title,
      start_time: body.start_time,
      end_time: body.end_time,
      google_event_id: body.google_event_id || null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Auto-sync to Google Calendar
  if (studyBlock) {
    try {
      const accessToken = await getGoogleAccessToken(user.id);
      if (accessToken) {
        const calEvent = await createCalendarEvent(accessToken, {
          summary: `📚 ${body.title}`,
          description: "Study block created by Rewired",
          startTime: body.start_time,
          endTime: body.end_time,
          colorId: "9",
        });
        await supabase
          .from("study_blocks")
          .update({ google_event_id: calEvent.id })
          .eq("id", studyBlock.id);
        studyBlock.google_event_id = calEvent.id;
      }
    } catch {
      // Non-critical: study block was created even if calendar sync failed
    }
  }

  return NextResponse.json({ studyBlock });
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
    .from("study_blocks")
    .update({ status: body.status })
    .eq("id", body.id)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Missing study block ID" }, { status: 400 });
  }

  // Get the block first to check for google_event_id
  const { data: block } = await supabase
    .from("study_blocks")
    .select("google_event_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (block?.google_event_id) {
    try {
      const accessToken = await getGoogleAccessToken(user.id);
      if (accessToken) {
        await deleteCalendarEvent(accessToken, block.google_event_id);
      }
    } catch {
      // Non-critical
    }
  }

  const { error } = await supabase
    .from("study_blocks")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
