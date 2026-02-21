import type {
  CanvasCourse,
  CanvasAssignment,
  CanvasSubmission,
} from "@/types";

// UMass Amherst Canvas
const CANVAS_BASE_URL = "https://umass.instructure.com";

// ============================================
// Canvas OAuth
// ============================================

/**
 * Build the Canvas OAuth authorization URL for UMass Amherst.
 */
export function getCanvasOAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.CANVAS_CLIENT_ID!,
    response_type: "code",
    redirect_uri: process.env.CANVAS_REDIRECT_URI!,
    state,
  });

  return `${CANVAS_BASE_URL}/login/oauth2/auth?${params.toString()}`;
}

/**
 * Exchange an authorization code for access + refresh tokens.
 */
export async function exchangeCanvasCode(code: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: { id: number; name: string };
}> {
  const res = await fetch(`${CANVAS_BASE_URL}/login/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: process.env.CANVAS_CLIENT_ID!,
      client_secret: process.env.CANVAS_CLIENT_SECRET!,
      redirect_uri: process.env.CANVAS_REDIRECT_URI!,
      code,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Canvas token exchange failed (${res.status}): ${text}`);
  }

  return res.json();
}

/**
 * Refresh an expired Canvas access token.
 */
export async function refreshCanvasToken(
  refreshToken: string
): Promise<{ access_token: string; expires_in: number }> {
  const res = await fetch(`${CANVAS_BASE_URL}/login/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: process.env.CANVAS_CLIENT_ID!,
      client_secret: process.env.CANVAS_CLIENT_SECRET!,
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) {
    throw new Error(`Canvas token refresh failed: ${res.statusText}`);
  }

  return res.json();
}

/**
 * Get a valid Canvas access token, refreshing if expired.
 */
export async function getValidCanvasToken(
  accessToken: string,
  refreshToken: string | null,
  expiresAt: Date | null
): Promise<{ accessToken: string; refreshed: boolean; expiresAt?: Date }> {
  // If no expiry info or still valid, return current token
  if (!expiresAt || new Date() < new Date(expiresAt.getTime() - 5 * 60 * 1000)) {
    return { accessToken, refreshed: false };
  }

  if (!refreshToken) {
    return { accessToken, refreshed: false };
  }

  const tokens = await refreshCanvasToken(refreshToken);
  return {
    accessToken: tokens.access_token,
    refreshed: true,
    expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
  };
}

// ============================================
// Canvas API
// ============================================

async function canvasFetch<T>(
  accessToken: string,
  path: string,
  params?: Record<string, string>
): Promise<T> {
  const url = new URL(`/api/v1${path}`, CANVAS_BASE_URL);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Canvas API error (${res.status}): ${text}`);
  }

  return res.json() as Promise<T>;
}

export async function fetchCanvasCourses(
  accessToken: string
): Promise<CanvasCourse[]> {
  return canvasFetch<CanvasCourse[]>(accessToken, "/courses", {
    enrollment_state: "active",
    include: "total_scores",
    per_page: "50",
  });
}

export async function fetchCanvasAssignments(
  accessToken: string,
  courseId: number
): Promise<CanvasAssignment[]> {
  return canvasFetch<CanvasAssignment[]>(
    accessToken,
    `/courses/${courseId}/assignments`,
    {
      per_page: "100",
      order_by: "due_at",
    }
  );
}

export async function fetchCanvasSubmissions(
  accessToken: string,
  courseId: number
): Promise<CanvasSubmission[]> {
  return canvasFetch<CanvasSubmission[]>(
    accessToken,
    `/courses/${courseId}/students/submissions`,
    {
      student_ids: "all",
      per_page: "100",
    }
  );
}

export async function fetchCanvasProfile(
  accessToken: string
): Promise<{ id: number; name: string; primary_email: string }> {
  return canvasFetch(accessToken, "/users/self/profile");
}

export { CANVAS_BASE_URL };
