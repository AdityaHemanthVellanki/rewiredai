const CALENDAR_API_BASE = "https://www.googleapis.com/calendar/v3";

export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: { dateTime: string; timeZone?: string };
  end: { dateTime: string; timeZone?: string };
  colorId?: string;
}

export async function fetchCalendarEvents(
  accessToken: string,
  timeMin: string,
  timeMax: string
): Promise<CalendarEvent[]> {
  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "100",
  });

  const res = await fetch(
    `${CALENDAR_API_BASE}/calendars/primary/events?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!res.ok) throw new Error(`Calendar API error: ${res.statusText}`);

  const data = await res.json();
  return data.items || [];
}

export async function createCalendarEvent(
  accessToken: string,
  event: {
    summary: string;
    description?: string;
    startTime: string;
    endTime: string;
    timeZone?: string;
    colorId?: string;
  }
): Promise<CalendarEvent> {
  const body = {
    summary: event.summary,
    description: event.description,
    start: {
      dateTime: event.startTime,
      timeZone: event.timeZone || "America/New_York",
    },
    end: {
      dateTime: event.endTime,
      timeZone: event.timeZone || "America/New_York",
    },
    colorId: event.colorId,
    reminders: { useDefault: false, overrides: [{ method: "popup", minutes: 10 }] },
  };

  const res = await fetch(`${CALENDAR_API_BASE}/calendars/primary/events`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`Failed to create event: ${res.statusText}`);
  return res.json();
}

export async function updateCalendarEvent(
  accessToken: string,
  eventId: string,
  updates: {
    summary?: string;
    description?: string;
    startTime?: string;
    endTime?: string;
    timeZone?: string;
    colorId?: string;
  }
): Promise<CalendarEvent> {
  const body: Record<string, unknown> = {};
  if (updates.summary !== undefined) body.summary = updates.summary;
  if (updates.description !== undefined) body.description = updates.description;
  if (updates.startTime) {
    body.start = {
      dateTime: updates.startTime,
      timeZone: updates.timeZone || "America/New_York",
    };
  }
  if (updates.endTime) {
    body.end = {
      dateTime: updates.endTime,
      timeZone: updates.timeZone || "America/New_York",
    };
  }
  if (updates.colorId) body.colorId = updates.colorId;

  const res = await fetch(
    `${CALENDAR_API_BASE}/calendars/primary/events/${eventId}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) throw new Error(`Failed to update event: ${res.statusText}`);
  return res.json();
}

export async function deleteCalendarEvent(
  accessToken: string,
  eventId: string
): Promise<void> {
  const res = await fetch(
    `${CALENDAR_API_BASE}/calendars/primary/events/${eventId}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!res.ok && res.status !== 404) {
    throw new Error(`Failed to delete event: ${res.statusText}`);
  }
}
