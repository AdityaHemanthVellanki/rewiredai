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
 * Paginated Canvas fetch — follows Link headers to get all results.
 * Canvas uses `Link: <url>; rel="next"` for pagination.
 */
async function canvasFetchAll<T>(
  baseUrl: string,
  accessToken: string,
  path: string,
  params?: Record<string, string>
): Promise<T[]> {
  const url = new URL(`/api/v1${path}`, baseUrl);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }

  let allResults: T[] = [];
  let nextUrl: string | null = url.toString();

  while (nextUrl) {
    const res = await fetch(nextUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Canvas API error (${res.status}): ${text}`);
    }

    const data = (await res.json()) as T[];
    allResults = allResults.concat(data);

    // Parse Link header for next page
    const linkHeader = res.headers.get("Link");
    nextUrl = parseLinkHeaderNext(linkHeader);
  }

  return allResults;
}

function parseLinkHeaderNext(linkHeader: string | null): string | null {
  if (!linkHeader) return null;
  const links = linkHeader.split(",");
  for (const link of links) {
    const match = link.match(/<([^>]+)>;\s*rel="next"/);
    if (match) return match[1];
  }
  return null;
}

/**
 * Validate a Canvas token by fetching the user's profile.
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
  return canvasFetchAll<CanvasCourse>(baseUrl, accessToken, "/courses", {
    enrollment_state: "active",
    "include[]": "total_scores",
    per_page: "50",
  });
}

export async function fetchCanvasAssignments(
  baseUrl: string,
  accessToken: string,
  courseId: number
): Promise<CanvasAssignment[]> {
  return canvasFetchAll<CanvasAssignment>(
    baseUrl,
    accessToken,
    `/courses/${courseId}/assignments`,
    {
      per_page: "100",
      order_by: "due_at",
    }
  );
}

/**
 * Fetch the current user's submissions for a course.
 * Uses student_ids[]=self so each student only sees their own submissions.
 */
export async function fetchCanvasSubmissions(
  baseUrl: string,
  accessToken: string,
  courseId: number
): Promise<CanvasSubmission[]> {
  return canvasFetchAll<CanvasSubmission>(
    baseUrl,
    accessToken,
    `/courses/${courseId}/students/submissions`,
    {
      "student_ids[]": "self",
      per_page: "100",
    }
  );
}
