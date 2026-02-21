import { createClient } from "@/lib/supabase/server";
import { validateCanvasToken } from "@/lib/canvas";
import { NextResponse } from "next/server";

// Connect Canvas — validate token and store connection
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { canvasUrl, accessToken } = body;

  if (!canvasUrl || !accessToken) {
    return NextResponse.json(
      { error: "Canvas URL and access token are required" },
      { status: 400 }
    );
  }

  // Normalize URL — strip trailing slash
  const baseUrl = canvasUrl.replace(/\/+$/, "");

  // Validate the token by fetching user profile
  try {
    const profile = await validateCanvasToken(baseUrl, accessToken);

    // Upsert the Canvas connection
    const { error: dbError } = await supabase
      .from("canvas_connections")
      .upsert(
        {
          user_id: user.id,
          canvas_base_url: baseUrl,
          api_token: accessToken,
          student_name: profile.name || null,
        },
        { onConflict: "user_id" }
      );

    if (dbError) {
      return NextResponse.json(
        { error: "Failed to save Canvas connection" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      studentName: profile.name,
    });
  } catch {
    return NextResponse.json(
      {
        error:
          "Could not connect to Canvas. Check your URL and access token.",
      },
      { status: 400 }
    );
  }
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
