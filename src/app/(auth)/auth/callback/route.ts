import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.session) {
      const user = data.session.user;
      const providerToken = data.session.provider_token;
      const providerRefreshToken = data.session.provider_refresh_token;

      // Store Google OAuth tokens for Gmail + Calendar API access
      if (providerToken) {
        await supabase.from("google_accounts").upsert(
          {
            user_id: user.id,
            google_email: user.email || "",
            access_token: providerToken,
            refresh_token: providerRefreshToken || "",
            token_expires_at: new Date(
              Date.now() + 3600 * 1000
            ).toISOString(),
            scopes: [
              "gmail.readonly",
              "calendar",
              "calendar.events",
            ],
          },
          { onConflict: "user_id" }
        );
      }

      // Check if user has completed onboarding
      const { data: profile } = await supabase
        .from("profiles")
        .select("onboarding_completed")
        .eq("id", user.id)
        .single();

      if (profile && !profile.onboarding_completed) {
        return NextResponse.redirect(`${origin}/onboarding`);
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
