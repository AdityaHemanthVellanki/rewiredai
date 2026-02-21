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
  const listRes = await fetch(
    `${GMAIL_API_BASE}/messages?maxResults=${maxResults}&labelIds=INBOX`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!listRes.ok) throw new Error(`Gmail API error: ${listRes.statusText}`);

  const listData = await listRes.json();
  const messageIds: { id: string }[] = listData.messages || [];

  const messages = await Promise.all(
    messageIds.map(async ({ id }) => {
      const msgRes = await fetch(`${GMAIL_API_BASE}/messages/${id}?format=full`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!msgRes.ok) return null;
      const msg = await msgRes.json();
      return parseGmailMessage(msg);
    })
  );

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
