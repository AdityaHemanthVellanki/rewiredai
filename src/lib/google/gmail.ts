const GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

export interface GmailMessage {
  id: string;
  threadId: string;
  snippet: string;
  from: string;
  to: string;
  subject: string;
  date: string;
  body: string;
}

export async function fetchRecentEmails(
  accessToken: string,
  maxResults: number = 20
): Promise<GmailMessage[]> {
  // Use query-based filtering instead of labelIds to catch all emails
  // including those in categories (Promotions, Updates, Social)
  const params = new URLSearchParams({
    maxResults: String(maxResults),
    q: "newer_than:7d -in:spam -in:trash",
  });

  const listRes = await fetch(
    `${GMAIL_API_BASE}/messages?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!listRes.ok) {
    const errText = await listRes.text();
    throw new Error(
      `Gmail API error (${listRes.status}): ${listRes.statusText} — ${errText}`
    );
  }

  const listData = await listRes.json();
  const messageIds: { id: string }[] = listData.messages || [];

  // Fetch messages in batches of 5 to avoid rate limits
  const messages: (GmailMessage | null)[] = [];
  for (let i = 0; i < messageIds.length; i += 5) {
    const batch = messageIds.slice(i, i + 5);
    const batchResults = await Promise.all(
      batch.map(async ({ id }) => {
        try {
          const msgRes = await fetch(
            `${GMAIL_API_BASE}/messages/${id}?format=full`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
          );
          if (!msgRes.ok) return null;
          const msg = await msgRes.json();
          return parseGmailMessage(msg);
        } catch {
          return null;
        }
      })
    );
    messages.push(...batchResults);
  }

  return messages.filter((m): m is GmailMessage => m !== null);
}

function parseGmailMessage(msg: Record<string, unknown>): GmailMessage {
  const headers = (msg.payload as Record<string, unknown>)?.headers as Array<{
    name: string;
    value: string;
  }>;

  const getHeader = (name: string) =>
    headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || "";

  const body = extractBody(msg.payload as Record<string, unknown>);

  return {
    id: msg.id as string,
    threadId: msg.threadId as string,
    snippet: msg.snippet as string,
    from: getHeader("From"),
    to: getHeader("To"),
    subject: getHeader("Subject"),
    date: getHeader("Date"),
    body,
  };
}

function extractBody(payload: Record<string, unknown>): string {
  if (!payload) return "";

  const body = payload.body as Record<string, unknown> | undefined;
  if (body?.data) {
    return Buffer.from(body.data as string, "base64").toString("utf-8");
  }

  const parts = payload.parts as Array<Record<string, unknown>> | undefined;
  if (parts) {
    for (const part of parts) {
      const mimeType = part.mimeType as string;
      if (mimeType === "text/plain" || mimeType === "text/html") {
        const partBody = part.body as Record<string, unknown>;
        if (partBody?.data) {
          return Buffer.from(partBody.data as string, "base64").toString("utf-8");
        }
      }
      // Recurse into nested parts
      if (part.parts) {
        const nested = extractBody(part);
        if (nested) return nested;
      }
    }
  }

  return "";
}
