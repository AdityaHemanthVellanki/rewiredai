import { createClient } from "@/lib/supabase/server";
import { exchangeCodeForTokens } from "@/lib/google/auth";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state"); // user_id

  if (!code || !state) {
    return NextResponse.redirect(`${origin}/settings?error=missing_params`);
  }

  try {
    const tokens = await exchangeCodeForTokens(code);

    // Get the user's Google email
    const userInfoRes = await fetch(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      { headers: { Authorization: `Bearer ${tokens.access_token}` } }
    );
    const userInfo = await userInfoRes.json();

    const supabase = await createClient();

    // Upsert Google account
    await supabase.from("google_accounts").upsert(
      {
        user_id: state,
        google_email: userInfo.email,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expires_at: new Date(
          Date.now() + tokens.expires_in * 1000
        ).toISOString(),
        scopes: tokens.scope.split(" "),
      },
      { onConflict: "user_id" }
    );

    return NextResponse.redirect(`${origin}/settings?google=connected`);
  } catch {
    return NextResponse.redirect(`${origin}/settings?error=google_auth_failed`);
  }
}
