import { createClient } from "@/lib/supabase/server";
import { getValidAccessToken } from "@/lib/google/auth";
import {
  fetchCalendarEvents,
  createCalendarEvent,
} from "@/lib/google/calendar";
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
  const timeMin =
    searchParams.get("timeMin") || new Date().toISOString();
  const timeMax =
    searchParams.get("timeMax") ||
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: googleAccount } = await supabase
    .from("google_accounts")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (!googleAccount) {
    return NextResponse.json(
      { error: "Google account not connected" },
      { status: 400 }
    );
  }

  const { accessToken, refreshed, expiresAt } = await getValidAccessToken(
    googleAccount.access_token,
    googleAccount.refresh_token,
    new Date(googleAccount.token_expires_at)
  );

  if (refreshed && expiresAt) {
    await supabase
      .from("google_accounts")
      .update({
        access_token: accessToken,
        token_expires_at: expiresAt.toISOString(),
      })
      .eq("id", googleAccount.id);
  }

  const events = await fetchCalendarEvents(accessToken, timeMin, timeMax);
  return NextResponse.json({ events });
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

  const { data: googleAccount } = await supabase
    .from("google_accounts")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (!googleAccount) {
    return NextResponse.json(
      { error: "Google account not connected" },
      { status: 400 }
    );
  }

  const { accessToken } = await getValidAccessToken(
    googleAccount.access_token,
    googleAccount.refresh_token,
    new Date(googleAccount.token_expires_at)
  );

  const event = await createCalendarEvent(accessToken, {
    summary: body.summary,
    description: body.description,
    startTime: body.startTime,
    endTime: body.endTime,
    timeZone: body.timeZone,
    colorId: body.colorId,
  });

  return NextResponse.json({ event });
}
