import { createClient } from "@/lib/supabase/server";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

/**
 * Refreshes a Google access token using a refresh token.
 */
export async function refreshAccessToken(refreshToken: string) {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to refresh token: ${response.statusText}`);
  }

  return response.json() as Promise<{
    access_token: string;
    expires_in: number;
  }>;
}

/**
 * Gets a valid Google access token for the current user.
 * Automatically refreshes if expired and updates the DB.
 */
export async function getGoogleAccessToken(
  userId: string
): Promise<string | null> {
  const supabase = await createClient();

  const { data: googleAccount } = await supabase
    .from("google_accounts")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (!googleAccount) return null;

  const expiresAt = new Date(googleAccount.token_expires_at);
  const now = new Date();

  // If token is still valid (with 5 min buffer), return it
  if (now < new Date(expiresAt.getTime() - 5 * 60 * 1000)) {
    return googleAccount.access_token;
  }

  // Token expired — refresh it
  if (!googleAccount.refresh_token) return null;

  try {
    const tokens = await refreshAccessToken(googleAccount.refresh_token);

    const newExpiresAt = new Date(
      Date.now() + tokens.expires_in * 1000
    ).toISOString();

    await supabase
      .from("google_accounts")
      .update({
        access_token: tokens.access_token,
        token_expires_at: newExpiresAt,
      })
      .eq("id", googleAccount.id);

    return tokens.access_token;
  } catch {
    return null;
  }
}
