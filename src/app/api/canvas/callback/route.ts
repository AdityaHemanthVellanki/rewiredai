import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { exchangeCanvasCode, fetchCanvasProfile, CANVAS_BASE_URL } from "@/lib/canvas";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const stateParam = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      `${origin}/settings?error=canvas_denied`
    );
  }

  if (!code || !stateParam) {
    return NextResponse.redirect(
      `${origin}/settings?error=canvas_missing_params`
    );
  }

  // Decode state
  let state: { userId: string; redirectTo: string };
  try {
    state = JSON.parse(Buffer.from(stateParam, "base64url").toString());
  } catch {
    return NextResponse.redirect(
      `${origin}/settings?error=canvas_invalid_state`
    );
  }

  try {
    // Exchange code for tokens
    const tokens = await exchangeCanvasCode(code);

    // Fetch the student's Canvas profile
    const profile = await fetchCanvasProfile(tokens.access_token);

    // Store in DB using service key (the user may not have an active cookie session
    // if they were redirected from Canvas)
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SECRET_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // ignored
            }
          },
        },
      }
    );

    // Upsert Canvas connection
    const { error: dbError } = await supabase.from("canvas_connections").upsert(
      {
        user_id: state.userId,
        canvas_base_url: CANVAS_BASE_URL,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || null,
        token_expires_at: tokens.expires_in
          ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
          : null,
        student_name: profile.name || tokens.user?.name || null,
      },
      { onConflict: "user_id" }
    );

    if (dbError) {
      return NextResponse.redirect(
        `${origin}${state.redirectTo}?error=canvas_db_error`
      );
    }

    return NextResponse.redirect(
      `${origin}${state.redirectTo}?canvas=connected`
    );
  } catch {
    return NextResponse.redirect(
      `${origin}${state.redirectTo}?error=canvas_auth_failed`
    );
  }
}
