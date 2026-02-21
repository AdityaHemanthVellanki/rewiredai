import { createClient } from "@/lib/supabase/server";
import { getCanvasOAuthUrl } from "@/lib/canvas";
import { NextResponse } from "next/server";

// Initiate Canvas OAuth — returns the redirect URL
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const redirectTo = body.redirectTo || "/settings";

  // Encode state: user_id + where to redirect after
  const state = Buffer.from(
    JSON.stringify({ userId: user.id, redirectTo })
  ).toString("base64url");

  const url = getCanvasOAuthUrl(state);
  return NextResponse.json({ url });
}

// Disconnect Canvas
export async function DELETE() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await supabase
    .from("canvas_connections")
    .delete()
    .eq("user_id", user.id);

  return NextResponse.json({ success: true });
}
