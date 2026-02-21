import type {
  CanvasCourse,
  CanvasAssignment,
  CanvasSubmission,
} from "@/types";

// ============================================
// Canvas API — Personal Access Token Approach
// ============================================
// Students generate a token at: Canvas → Account → Settings → New Access Token
// Works with any Canvas instance (UMass, MIT, etc.)

async function canvasFetch<T>(
  baseUrl: string,
  accessToken: string,
  path: string,
  params?: Record<string, string>
): Promise<T> {
  const url = new URL(`/api/v1${path}`, baseUrl);
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

/**
 * Validate a Canvas token by fetching the user's profile.
 * Returns the profile if valid, throws if not.
 */
export async function validateCanvasToken(
  baseUrl: string,
  accessToken: string
): Promise<{ id: number; name: string; primary_email: string }> {
  return canvasFetch(baseUrl, accessToken, "/users/self/profile");
}

export async function fetchCanvasCourses(
  baseUrl: string,
  accessToken: string
): Promise<CanvasCourse[]> {
  return canvasFetch<CanvasCourse[]>(baseUrl, accessToken, "/courses", {
    enrollment_state: "active",
    include: "total_scores",
    per_page: "50",
  });
}

export async function fetchCanvasAssignments(
  baseUrl: string,
  accessToken: string,
  courseId: number
): Promise<CanvasAssignment[]> {
  return canvasFetch<CanvasAssignment[]>(
    baseUrl,
    accessToken,
    `/courses/${courseId}/assignments`,
    {
      per_page: "100",
      order_by: "due_at",
    }
  );
}

export async function fetchCanvasSubmissions(
  baseUrl: string,
  accessToken: string,
  courseId: number
): Promise<CanvasSubmission[]> {
  return canvasFetch<CanvasSubmission[]>(
    baseUrl,
    accessToken,
    `/courses/${courseId}/students/submissions`,
    {
      student_ids: "all",
      per_page: "100",
    }
  );
}
