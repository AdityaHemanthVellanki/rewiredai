import { createClient } from "@/lib/supabase/server";
import { getAzureOpenAI } from "@/lib/azure-openai";
import { buildSystemPrompt } from "@/lib/agent/system-prompt";
import { agentTools } from "@/lib/agent/tools";
import { getGoogleAccessToken } from "@/lib/google/auth";
import {
  fetchCalendarEvents,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
} from "@/lib/google/calendar";
import { fetchRecentEmails } from "@/lib/google/gmail";
import {
  fetchCanvasCourses,
  fetchCanvasAssignments,
  fetchCanvasSubmissions,
} from "@/lib/canvas";
import { NextResponse } from "next/server";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import type { Profile, CanvasSubmission } from "@/types";

const MAX_TOOL_ITERATIONS = 12;

// GET — load chat history
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: messages } = await supabase
    .from("chat_messages")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(50);

  return NextResponse.json({ messages: messages || [] });
}

// POST — send message and get streaming response
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { message } = await request.json();

  // Save user message
  await supabase.from("chat_messages").insert({
    user_id: user.id,
    role: "user",
    content: message,
  });

  // Get profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  // Get recent chat history
  const { data: history } = await supabase
    .from("chat_messages")
    .select("role, content")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(20);

  const chatHistory: ChatCompletionMessageParam[] = (history || []).map(
    (m) => ({ role: m.role as "user" | "assistant", content: m.content })
  );

  const systemPrompt = buildSystemPrompt(profile as unknown as Profile);
  const client = getAzureOpenAI();

  // Create streaming response
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        let fullResponse = "";
        let messages: ChatCompletionMessageParam[] = [
          { role: "system", content: systemPrompt },
          ...chatHistory,
        ];

        // Track created events for inline cards
        const createdEvents: Array<{
          type: "study_block_created" | "calendar_event_created";
          title: string;
          start: string;
          end: string;
          id: string;
        }> = [];

        // Tool execution loop with iteration limit
        let continueLoop = true;
        let iterations = 0;
        while (continueLoop && iterations < MAX_TOOL_ITERATIONS) {
          iterations++;

          const completion = await client.chat.completions.create({
            model: process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4o",
            messages,
            tools: agentTools,
            stream: true,
          });

          let toolCalls: Array<{
            id: string;
            function: { name: string; arguments: string };
          }> = [];
          let currentToolCallIndex = -1;

          for await (const chunk of completion) {
            const delta = chunk.choices[0]?.delta;

            if (delta?.content) {
              fullResponse += delta.content;
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ content: delta.content })}\n\n`
                )
              );
            }

            if (delta?.tool_calls) {
              for (const tc of delta.tool_calls) {
                if (tc.index !== undefined && tc.index !== currentToolCallIndex) {
                  currentToolCallIndex = tc.index;
                  if (!toolCalls[tc.index]) {
                    toolCalls[tc.index] = {
                      id: tc.id || "",
                      function: { name: "", arguments: "" },
                    };
                  }
                }
                if (tc.id) toolCalls[currentToolCallIndex].id = tc.id;
                if (tc.function?.name)
                  toolCalls[currentToolCallIndex].function.name +=
                    tc.function.name;
                if (tc.function?.arguments)
                  toolCalls[currentToolCallIndex].function.arguments +=
                    tc.function.arguments;
              }
            }
          }

          if (toolCalls.length > 0) {
            messages.push({
              role: "assistant",
              tool_calls: toolCalls.map((tc) => ({
                id: tc.id,
                type: "function" as const,
                function: tc.function,
              })),
            });

            for (const tc of toolCalls) {
              let parsedArgs;
              try {
                parsedArgs = JSON.parse(tc.function.arguments || "{}");
              } catch {
                parsedArgs = {};
              }

              // Emit tool status so the UI can show live progress
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ tool_status: { name: tc.function.name, status: "running" } })}\n\n`
                )
              );

              const result = await executeToolCall(
                tc.function.name,
                parsedArgs,
                user.id,
                supabase
              );

              // Detect creation events for inline cards
              if (tc.function.name === "create_study_block" && result.created && result.studyBlock) {
                createdEvents.push({
                  type: "study_block_created",
                  title: result.studyBlock.title,
                  start: result.studyBlock.start_time,
                  end: result.studyBlock.end_time,
                  id: result.studyBlock.id,
                });
              }
              if (tc.function.name === "create_google_calendar_event" && result.created && result.event) {
                createdEvents.push({
                  type: "calendar_event_created",
                  title: parsedArgs.title,
                  start: parsedArgs.start_time,
                  end: parsedArgs.end_time,
                  id: result.event.id || "",
                });
              }
              if (tc.function.name === "auto_schedule_study" && result.blocks?.length > 0) {
                for (const blk of result.blocks) {
                  createdEvents.push({
                    type: "study_block_created",
                    title: blk.title,
                    start: blk.start,
                    end: blk.end,
                    id: blk.id || "",
                  });
                }
              }

              // Emit tool completion
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ tool_status: { name: tc.function.name, status: "done" } })}\n\n`
                )
              );

              messages.push({
                role: "tool",
                tool_call_id: tc.id,
                content: JSON.stringify(result),
              });
            }
          } else {
            continueLoop = false;
          }
        }

        // Save assistant response (only if there's real content)
        const trimmedResponse = fullResponse.trim();
        if (trimmedResponse) {
          await supabase.from("chat_messages").insert({
            user_id: user.id,
            role: "assistant",
            content: trimmedResponse,
          });
        }

        // Emit event cards for created study blocks / calendar events
        for (const card of createdEvents) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ event_card: card })}\n\n`
            )
          );
        }

        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch (error) {
        console.error("Chat error:", error);
        const errorMsg =
          error instanceof Error
            ? error.message.includes("401")
              ? "AI service auth failed. Check your Azure OpenAI API key."
              : error.message.includes("429")
                ? "Rate limited — too many requests. Try again in a moment."
                : error.message.includes("404")
                  ? "AI model deployment not found. Check your Azure OpenAI settings."
                  : `Something went wrong: ${error.message.substring(0, 100)}`
            : "Sorry, something went wrong. Try again?";
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ content: errorMsg })}\n\n`
          )
        );
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

// Helper: convert percentage to letter grade
function getLetterGradeFromPercent(pct: number): string {
  if (pct >= 93) return "A";
  if (pct >= 90) return "A-";
  if (pct >= 87) return "B+";
  if (pct >= 83) return "B";
  if (pct >= 80) return "B-";
  if (pct >= 77) return "C+";
  if (pct >= 73) return "C";
  if (pct >= 70) return "C-";
  if (pct >= 67) return "D+";
  if (pct >= 60) return "D";
  return "F";
}

// Helper: convert GPA target to approximate minimum percentage needed
function gpaTargetToPercent(gpa: number): number {
  if (gpa >= 4.0) return 93;
  if (gpa >= 3.7) return 90;
  if (gpa >= 3.3) return 87;
  if (gpa >= 3.0) return 83;
  if (gpa >= 2.7) return 80;
  if (gpa >= 2.3) return 77;
  if (gpa >= 2.0) return 73;
  if (gpa >= 1.7) return 70;
  if (gpa >= 1.3) return 67;
  if (gpa >= 1.0) return 60;
  return 50;
}

// Helper: convert percentage to GPA points (4.0 scale)
function percentToGpaPoints(pct: number): number {
  if (pct >= 93) return 4.0;
  if (pct >= 90) return 3.7;
  if (pct >= 87) return 3.3;
  if (pct >= 83) return 3.0;
  if (pct >= 80) return 2.7;
  if (pct >= 77) return 2.3;
  if (pct >= 73) return 2.0;
  if (pct >= 70) return 1.7;
  if (pct >= 67) return 1.3;
  if (pct >= 60) return 1.0;
  return 0.0;
}

// Helper: get next Monday date string
function getNextMonday(): string {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
  const nextMon = new Date(now);
  nextMon.setDate(now.getDate() + daysUntilMonday);
  return nextMon.toISOString().split("T")[0];
}

// Helper: fetch Google Calendar events for a date range (with graceful fallback)
async function fetchGoogleCalendarEvents(
  userId: string,
  startDate: string,
  endDate: string
): Promise<Array<{ id: string; title: string; start: string; end: string; source: "google_calendar" }>> {
  try {
    const accessToken = await getGoogleAccessToken(userId);
    if (!accessToken) return [];

    const events = await fetchCalendarEvents(accessToken, startDate, endDate);
    return events.map((e) => ({
      id: e.id,
      title: e.summary || "(No title)",
      start: e.start.dateTime,
      end: e.end.dateTime,
      source: "google_calendar" as const,
    }));
  } catch {
    return [];
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function executeToolCall(name: string, args: any, userId: string, supabase: any) {
  switch (name) {
    case "get_deadlines": {
      let query = supabase
        .from("assignments")
        .select("*, course:courses(name, code, color)")
        .eq("user_id", userId)
        .order("due_date", { ascending: true });

      if (args.status) {
        query = query.eq("status", args.status);
      } else {
        // By default, exclude completed assignments — only show actionable ones
        query = query.neq("status", "completed");
      }
      if (args.course_id) query = query.eq("course_id", args.course_id);

      const daysAhead = args.days_ahead || 7;
      query = query.lte(
        "due_date",
        new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000).toISOString()
      );

      const { data } = await query;
      return data || [];
    }

    case "get_grades": {
      let query = supabase
        .from("grades")
        .select("*, course:courses(name, code)")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (args.course_id) query = query.eq("course_id", args.course_id);

      const { data: gradeRows } = await query;
      const allGrades = gradeRows || [];

      // Calculate per-course averages
      const courseMap = new Map<string, { name: string; code: string; earned: number; possible: number; count: number }>();
      for (const g of allGrades) {
        if (g.score == null || g.max_score == null || g.max_score <= 0) continue;
        const key = g.course_id;
        const existing = courseMap.get(key);
        if (existing) {
          existing.earned += g.score;
          existing.possible += g.max_score;
          existing.count++;
        } else {
          courseMap.set(key, {
            name: g.course?.name || "Unknown",
            code: g.course?.code || "",
            earned: g.score,
            possible: g.max_score,
            count: 1,
          });
        }
      }

      const courseAverages = Array.from(courseMap.entries()).map(([courseId, c]) => {
        const avg = (c.earned / c.possible) * 100;
        return {
          course_id: courseId,
          course_name: c.name,
          course_code: c.code,
          average_percent: Math.round(avg * 10) / 10,
          letter_grade: getLetterGradeFromPercent(avg),
          graded_items: c.count,
          total_earned: c.earned,
          total_possible: c.possible,
        };
      });

      return {
        grades: allGrades,
        course_averages: courseAverages,
        total_grades: allGrades.length,
      };
    }

    case "get_calendar_events": {
      // Fetch BOTH study blocks AND Google Calendar events
      const { data: studyBlocks } = await supabase
        .from("study_blocks")
        .select("*, course:courses(name, code)")
        .eq("user_id", userId)
        .gte("start_time", args.start_date)
        .lte("start_time", args.end_date);

      const formattedBlocks = (studyBlocks || []).map(
        (sb: { id: string; title: string; start_time: string; end_time: string; status: string; course?: { name: string } }) => ({
          id: sb.id,
          title: sb.title,
          start: sb.start_time,
          end: sb.end_time,
          status: sb.status,
          course: sb.course?.name || null,
          source: "study_block",
        })
      );

      // Also fetch real Google Calendar events (classes, meetings, etc.)
      const googleEvents = await fetchGoogleCalendarEvents(
        userId,
        args.start_date,
        args.end_date
      );

      // Also get assignments with due dates in this range
      const { data: assignments } = await supabase
        .from("assignments")
        .select("id, title, due_date, status, course:courses(name)")
        .eq("user_id", userId)
        .gte("due_date", args.start_date)
        .lte("due_date", args.end_date);

      const formattedDeadlines = (assignments || []).map(
        (a: { id: string; title: string; due_date: string; status: string; course?: { name: string } }) => ({
          id: a.id,
          title: `DUE: ${a.title}`,
          start: a.due_date,
          end: a.due_date,
          status: a.status,
          course: a.course?.name || null,
          source: "deadline",
        })
      );

      return {
        events: [...googleEvents, ...formattedBlocks, ...formattedDeadlines]
          .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()),
        google_calendar_count: googleEvents.length,
        study_block_count: formattedBlocks.length,
        deadline_count: formattedDeadlines.length,
      };
    }

    case "get_email_summaries": {
      let query = supabase
        .from("email_summaries")
        .select("*")
        .eq("user_id", userId)
        .order("received_at", { ascending: false })
        .limit(10);

      if (args.category) query = query.eq("category", args.category);
      if (args.min_priority) query = query.gte("priority_score", args.min_priority);
      if (args.unhandled_only) query = query.eq("is_handled", false);

      const { data } = await query;
      return data || [];
    }

    case "create_study_block": {
      const { data } = await supabase
        .from("study_blocks")
        .insert({
          user_id: userId,
          title: args.title,
          course_id: args.course_id || null,
          assignment_id: args.assignment_id || null,
          start_time: args.start_time,
          end_time: args.end_time,
        })
        .select()
        .single();

      // Sync to Google Calendar (default true)
      let calendarEventId = null;
      let calendarSyncError: string | null = null;
      const shouldSync = args.sync_to_google !== false;
      if (shouldSync && data) {
        try {
          const accessToken = await getGoogleAccessToken(userId);
          if (accessToken) {
            const calEvent = await createCalendarEvent(accessToken, {
              summary: `📚 ${args.title}`,
              description: "Study block created by Rewired AI",
              startTime: args.start_time,
              endTime: args.end_time,
              colorId: "9", // blueberry
            });
            calendarEventId = calEvent.id;
            await supabase
              .from("study_blocks")
              .update({ google_event_id: calEvent.id })
              .eq("id", data.id);
          } else {
            calendarSyncError = "Google account not connected — study block created but not synced to Google Calendar.";
          }
        } catch (err) {
          calendarSyncError = `Calendar sync failed: ${err instanceof Error ? err.message : "unknown error"}. Study block was created but may not appear on Google Calendar.`;
        }
      }

      return {
        created: true,
        studyBlock: data,
        google_calendar_synced: !!calendarEventId,
        ...(calendarSyncError ? { calendar_sync_error: calendarSyncError } : {}),
      };
    }

    case "update_study_block": {
      // Resolve study block: prefer UUID, fall back to title+date lookup
      let resolvedBlockId: string | null = args.study_block_id || null;

      if (!resolvedBlockId && args.title) {
        const lookupDate = args.date || new Date().toISOString().split("T")[0];
        const { data: found } = await supabase
          .from("study_blocks")
          .select("id")
          .eq("user_id", userId)
          .ilike("title", `%${args.title}%`)
          .gte("start_time", `${lookupDate}T00:00:00`)
          .lte("start_time", `${lookupDate}T23:59:59`)
          .limit(1)
          .single();
        if (found) resolvedBlockId = found.id;
      }

      if (!resolvedBlockId) {
        return { error: "Study block not found. Try providing the title and date, or call get_calendar_events to find the ID." };
      }

      const updates: Record<string, unknown> = {};
      if (args.new_title) updates.title = args.new_title;
      else if (args.title && args.study_block_id) updates.title = args.title;
      if (args.start_time) updates.start_time = args.start_time;
      if (args.end_time) updates.end_time = args.end_time;
      if (args.status) updates.status = args.status;

      // Get the existing block first (to check for google_event_id)
      const { data: existing } = await supabase
        .from("study_blocks")
        .select("*")
        .eq("id", resolvedBlockId)
        .eq("user_id", userId)
        .single();

      if (!existing) {
        return { error: "Study block not found" };
      }

      await supabase
        .from("study_blocks")
        .update(updates)
        .eq("id", resolvedBlockId)
        .eq("user_id", userId);

      // If time changed and it's synced to Google, update the Google event too
      const newTitle = (updates.title as string) || existing.title;
      let updateSyncError: string | null = null;
      if ((args.start_time || args.end_time || updates.title) && existing.google_event_id) {
        try {
          const accessToken = await getGoogleAccessToken(userId);
          if (accessToken) {
            await deleteCalendarEvent(accessToken, existing.google_event_id);
            const calEvent = await createCalendarEvent(accessToken, {
              summary: `📚 ${newTitle}`,
              description: "Study block created by Rewired AI",
              startTime: args.start_time || existing.start_time,
              endTime: args.end_time || existing.end_time,
              colorId: "9",
            });
            await supabase
              .from("study_blocks")
              .update({ google_event_id: calEvent.id })
              .eq("id", resolvedBlockId);
          } else {
            updateSyncError = "Google account not connected — study block updated but Google Calendar not synced.";
          }
        } catch (err) {
          updateSyncError = `Google Calendar sync failed: ${err instanceof Error ? err.message : "unknown error"}`;
        }
      }

      return {
        updated: true,
        message: "Study block updated.",
        ...(updateSyncError ? { calendar_sync_error: updateSyncError } : {}),
      };
    }

    case "delete_study_block": {
      // Resolve study block: prefer UUID, fall back to title+date lookup
      let deleteBlockId: string | null = args.study_block_id || null;

      if (!deleteBlockId && args.title) {
        const lookupDate = args.date || new Date().toISOString().split("T")[0];
        const { data: found } = await supabase
          .from("study_blocks")
          .select("id")
          .eq("user_id", userId)
          .ilike("title", `%${args.title}%`)
          .gte("start_time", `${lookupDate}T00:00:00`)
          .lte("start_time", `${lookupDate}T23:59:59`)
          .limit(1)
          .single();
        if (found) deleteBlockId = found.id;
      }

      if (!deleteBlockId) {
        return { error: "Study block not found. Try providing the title and date, or call get_calendar_events to find the ID." };
      }

      // Get the block to check for google_event_id
      const { data: block } = await supabase
        .from("study_blocks")
        .select("google_event_id")
        .eq("id", deleteBlockId)
        .eq("user_id", userId)
        .single();

      if (!block) {
        return { error: "Study block not found" };
      }

      // Delete from Google Calendar if synced
      let deleteSyncError: string | null = null;
      if (block.google_event_id) {
        try {
          const accessToken = await getGoogleAccessToken(userId);
          if (accessToken) {
            await deleteCalendarEvent(accessToken, block.google_event_id);
          } else {
            deleteSyncError = "Google account not connected — study block deleted but Google Calendar event may remain.";
          }
        } catch (err) {
          deleteSyncError = `Google Calendar sync failed: ${err instanceof Error ? err.message : "unknown error"}. The study block was deleted but the Google Calendar event may remain.`;
        }
      }

      await supabase
        .from("study_blocks")
        .delete()
        .eq("id", deleteBlockId)
        .eq("user_id", userId);

      return {
        deleted: true,
        message: "Study block deleted.",
        ...(deleteSyncError ? { calendar_sync_error: deleteSyncError } : {}),
      };
    }

    case "create_google_calendar_event": {
      try {
        const accessToken = await getGoogleAccessToken(userId);
        if (!accessToken) {
          return { error: "Google account not connected." };
        }

        const calEvent = await createCalendarEvent(accessToken, {
          summary: args.title,
          description: args.description || "",
          startTime: args.start_time,
          endTime: args.end_time,
        });

        return {
          created: true,
          event: { id: calEvent.id, title: calEvent.summary },
          message: `Created "${args.title}" on Google Calendar.`,
        };
      } catch (err) {
        return { error: err instanceof Error ? err.message : "Failed to create calendar event" };
      }
    }

    case "update_google_calendar_event": {
      try {
        const accessToken = await getGoogleAccessToken(userId);
        if (!accessToken) {
          return { error: "Google account not connected." };
        }

        const updated = await updateCalendarEvent(accessToken, args.event_id, {
          summary: args.title,
          description: args.description,
          startTime: args.start_time,
          endTime: args.end_time,
        });

        return {
          updated: true,
          event: { id: updated.id, title: updated.summary },
          message: `Updated "${updated.summary}" on Google Calendar.`,
        };
      } catch (err) {
        return { error: err instanceof Error ? err.message : "Failed to update calendar event" };
      }
    }

    case "delete_google_calendar_event": {
      try {
        const accessToken = await getGoogleAccessToken(userId);
        if (!accessToken) {
          return { error: "Google account not connected." };
        }

        await deleteCalendarEvent(accessToken, args.event_id);
        return { deleted: true, message: "Calendar event deleted." };
      } catch (err) {
        return { error: err instanceof Error ? err.message : "Failed to delete calendar event" };
      }
    }

    case "create_nudge": {
      const { data } = await supabase
        .from("nudges")
        .insert({
          user_id: userId,
          message: args.message,
          severity: args.severity,
          assignment_id: args.assignment_id || null,
        })
        .select()
        .single();

      return { created: true, nudge: data };
    }

    case "update_assignment_status": {
      await supabase
        .from("assignments")
        .update({ status: args.status })
        .eq("id", args.assignment_id)
        .eq("user_id", userId);

      return { updated: true };
    }

    case "calculate_grade_needed": {
      // Fetch grades for this course
      const { data: calcGrades } = await supabase
        .from("grades")
        .select("score, max_score, weight")
        .eq("user_id", userId)
        .eq("course_id", args.course_id);

      if (!calcGrades || calcGrades.length === 0) {
        return { error: "No grades found for this course. Sync Canvas first to import grades." };
      }

      // Also try to use Canvas enrollment score (most accurate)
      let canvasCurrentScore: number | null = null;
      try {
        const { data: canvasConn } = await supabase
          .from("canvas_connections")
          .select("canvas_base_url, api_token")
          .eq("user_id", userId)
          .single();
        if (canvasConn) {
          const { data: courseData } = await supabase
            .from("courses")
            .select("code")
            .eq("id", args.course_id)
            .eq("user_id", userId)
            .single();
          if (courseData) {
            const canvasCourses = await fetchCanvasCourses(canvasConn.canvas_base_url, canvasConn.api_token);
            const matchedCourse = canvasCourses.find((c) => c.course_code === courseData.code);
            if (matchedCourse?.enrollments?.[0]?.computed_current_score != null) {
              canvasCurrentScore = matchedCourse.enrollments[0].computed_current_score;
            }
          }
        }
      } catch {
        // Non-critical: fall back to manual calculation
      }

      // Manual calculation: weighted average from individual grades
      let totalEarned = 0;
      let totalPossible = 0;
      for (const g of calcGrades) {
        if (g.score !== null && g.max_score !== null && g.max_score > 0) {
          totalEarned += g.score;
          totalPossible += g.max_score;
        }
      }

      const manualAvg = totalPossible > 0 ? (totalEarned / totalPossible) * 100 : 0;
      // Prefer Canvas score (it respects assignment group weights), fall back to manual
      const currentAvg = canvasCurrentScore ?? manualAvg;

      // target_grade is a percentage (e.g. 90 for an A)
      const target = args.target_grade;
      const remainingWeight = args.remaining_assignment_weight || 100;

      // Formula: to get target overall, what % do you need on remaining work?
      // Simplified: if you have N% of points graded at currentAvg, and remaining is R%,
      // then: (currentAvg * gradedPortion + needed * remainingPortion) / 100 = target
      const gradedPortion = 100 - remainingWeight;
      const needed = remainingWeight > 0
        ? (target * 100 - currentAvg * gradedPortion) / remainingWeight
        : 0;

      return {
        current_average: Math.round(currentAvg * 10) / 10,
        canvas_score: canvasCurrentScore,
        total_earned: totalEarned,
        total_possible: totalPossible,
        target_grade: target,
        remaining_weight_percent: remainingWeight,
        score_needed_on_remaining: Math.round(needed * 10) / 10,
        achievable: needed <= 100 && needed >= 0,
        letter_grade_current: getLetterGradeFromPercent(currentAvg),
      };
    }

    case "get_agent_memory": {
      let query = supabase
        .from("agent_memory")
        .select("*")
        .eq("user_id", userId);

      if (args.category) query = query.eq("category", args.category);
      if (args.key) query = query.eq("key", args.key);

      const { data } = await query;
      return data || [];
    }

    case "save_agent_memory": {
      await supabase.from("agent_memory").upsert(
        {
          user_id: userId,
          key: args.key,
          value: args.value,
          category: args.category,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,key" }
      );

      return { saved: true };
    }

    case "get_study_stats": {
      const now = new Date();
      let startDate: Date;

      switch (args.period) {
        case "today":
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case "this_month":
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        default: // this_week
          startDate = new Date(now);
          startDate.setDate(now.getDate() - now.getDay());
          break;
      }

      const { data: blocks } = await supabase
        .from("study_blocks")
        .select("*")
        .eq("user_id", userId)
        .gte("start_time", startDate.toISOString());

      const totalHours = (blocks || []).reduce(
        (sum: number, b: { start_time: string; end_time: string; status: string }) => {
          if (b.status === "completed") {
            return (
              sum +
              (new Date(b.end_time).getTime() - new Date(b.start_time).getTime()) /
                3600000
            );
          }
          return sum;
        },
        0
      );

      const { data: completedAssignments } = await supabase
        .from("assignments")
        .select("id")
        .eq("user_id", userId)
        .eq("status", "completed")
        .gte("created_at", startDate.toISOString());

      return {
        study_hours: Math.round(totalHours * 10) / 10,
        study_blocks_completed: (blocks || []).filter(
          (b: { status: string }) => b.status === "completed"
        ).length,
        study_blocks_scheduled: (blocks || []).filter(
          (b: { status: string }) => b.status === "scheduled"
        ).length,
        assignments_completed: (completedAssignments || []).length,
      };
    }

    // ============================================
    // Agentic tools
    // ============================================

    case "sync_canvas": {
      const { data: canvasConn } = await supabase
        .from("canvas_connections")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (!canvasConn) {
        return { error: "Canvas not connected. Ask the student to connect Canvas in Settings." };
      }

      try {
        const baseUrl = canvasConn.canvas_base_url;
        const token = canvasConn.api_token;
        const canvasCourses = await fetchCanvasCourses(baseUrl, token);
        let assignmentsSynced = 0;
        let gradesImported = 0;
        const courseGradeSummary: Array<{ course: string; score: number | null; grade: string | null }> = [];

        for (const cc of canvasCourses) {
          if (cc.workflow_state !== "available") continue;

          const { data: course } = await supabase
            .from("courses")
            .select("id")
            .eq("user_id", userId)
            .eq("code", cc.course_code)
            .single();

          if (!course) continue;

          // Capture Canvas enrollment score (most accurate grade)
          const enrollment = cc.enrollments?.[0];
          if (enrollment) {
            courseGradeSummary.push({
              course: cc.name,
              score: enrollment.computed_current_score,
              grade: enrollment.computed_current_grade,
            });
          }

          try {
            const [assignments, submissions] = await Promise.all([
              fetchCanvasAssignments(baseUrl, token, cc.id),
              fetchCanvasSubmissions(baseUrl, token, cc.id),
            ]);

            const submissionMap = new Map<number, CanvasSubmission>();
            for (const sub of submissions) {
              submissionMap.set(sub.assignment_id, sub);
            }

            for (const ca of assignments) {
              if (!ca.due_at) continue;
              const sub = submissionMap.get(ca.id);
              const isCompleted =
                sub !== undefined &&
                (["submitted", "graded", "complete"].includes(sub.workflow_state) ||
                  sub.submitted_at !== null);
              const isGraded =
                sub !== undefined &&
                sub.workflow_state === "graded" &&
                sub.score !== null;

              let status: string;
              if (isCompleted || isGraded) {
                status = "completed";
              } else {
                status = new Date(ca.due_at) < new Date() ? "overdue" : "pending";
              }

              // Find existing assignment
              const { data: existing } = await supabase
                .from("assignments")
                .select("id")
                .eq("user_id", userId)
                .eq("canvas_assignment_id", ca.id)
                .single();

              let assignmentId: string | null = existing?.id || null;

              if (existing) {
                await supabase
                  .from("assignments")
                  .update({ status })
                  .eq("id", existing.id);
                assignmentsSynced++;
              }

              // Import grade if graded
              if (
                isGraded &&
                sub.score !== null &&
                ca.points_possible !== null &&
                ca.points_possible > 0 &&
                assignmentId
              ) {
                const { data: existingGrade } = await supabase
                  .from("grades")
                  .select("id")
                  .eq("user_id", userId)
                  .eq("assignment_id", assignmentId)
                  .single();

                if (existingGrade) {
                  await supabase
                    .from("grades")
                    .update({ score: sub.score, max_score: ca.points_possible })
                    .eq("id", existingGrade.id);
                } else {
                  await supabase.from("grades").insert({
                    user_id: userId,
                    course_id: course.id,
                    assignment_id: assignmentId,
                    title: ca.name,
                    score: sub.score,
                    max_score: ca.points_possible,
                    weight: ca.points_possible,
                  });
                }
                gradesImported++;
              }
            }
          } catch {
            // Skip course on error
          }
        }

        await supabase
          .from("canvas_connections")
          .update({ last_synced_at: new Date().toISOString() })
          .eq("user_id", userId);

        return {
          assignments_synced: assignmentsSynced,
          grades_imported: gradesImported,
          canvas_grades: courseGradeSummary,
          message: `Synced ${assignmentsSynced} assignments and ${gradesImported} grades from Canvas.`,
        };
      } catch (err) {
        return { error: err instanceof Error ? err.message : "Canvas sync failed" };
      }
    }

    case "sync_emails": {
      try {
        const accessToken = await getGoogleAccessToken(userId);
        if (!accessToken) {
          return { error: "Google account not connected." };
        }

        const emails = await fetchRecentEmails(accessToken, 10);
        let newCount = 0;

        for (const email of emails) {
          const { data: existing } = await supabase
            .from("email_summaries")
            .select("id")
            .eq("user_id", userId)
            .eq("gmail_message_id", email.id)
            .single();

          if (!existing) newCount++;
        }

        return {
          fetched: emails.length,
          new: newCount,
          message: newCount > 0
            ? `Found ${newCount} new email(s). Use the Settings page to process them with AI.`
            : "No new emails since last sync.",
        };
      } catch (err) {
        return { error: err instanceof Error ? err.message : "Email sync failed" };
      }
    }

    case "auto_schedule_study": {
      // Get profile for peak hours and sleep window
      const { data: profileData } = await supabase
        .from("profiles")
        .select("productivity_peak_hours, sleep_window, timezone")
        .eq("id", userId)
        .single();

      // Get upcoming deadlines
      const { data: upcoming } = await supabase
        .from("assignments")
        .select("*, course:courses(name)")
        .eq("user_id", userId)
        .neq("status", "completed")
        .order("due_date", { ascending: true })
        .limit(10);

      // Get existing study blocks for the next 7 days
      const now = new Date();
      const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: existingBlocks } = await supabase
        .from("study_blocks")
        .select("*")
        .eq("user_id", userId)
        .gte("start_time", now.toISOString())
        .lte("start_time", nextWeek);

      // CRITICAL: Also fetch Google Calendar events to avoid scheduling over classes
      const googleEvents = await fetchGoogleCalendarEvents(
        userId,
        now.toISOString(),
        nextWeek
      );

      if (!upcoming || upcoming.length === 0) {
        return { message: "No upcoming assignments to schedule study time for." };
      }

      const peakHours = profileData?.productivity_peak_hours || ["09:00", "10:00", "14:00", "15:00"];
      const sleepWindow = profileData?.sleep_window || { sleep: "23:00", wake: "08:00" };
      const created: Array<{ id: string; title: string; start: string; end: string; google_synced?: boolean }> = [];

      // Build a unified busy-times list from study blocks + Google Calendar
      const busyTimes: Array<{ start: number; end: number }> = [];

      for (const eb of existingBlocks || []) {
        busyTimes.push({
          start: new Date(eb.start_time).getTime(),
          end: new Date(eb.end_time).getTime(),
        });
      }
      for (const ge of googleEvents) {
        busyTimes.push({
          start: new Date(ge.start).getTime(),
          end: new Date(ge.end).getTime(),
        });
      }

      // Schedule study blocks in free peak-hour slots
      for (const assignment of (upcoming || []).slice(0, 5)) {
        if (created.length >= 5) break;

        const dueDate = new Date(assignment.due_date);

        for (let dayOffset = 0; dayOffset < 7 && dayOffset < Math.ceil((dueDate.getTime() - now.getTime()) / 86400000); dayOffset++) {
          if (created.length >= 5) break;

          const targetDay = new Date(now);
          targetDay.setDate(now.getDate() + dayOffset);

          for (const hour of peakHours) {
            if (created.length >= 5) break;

            const [h, m] = hour.split(":").map(Number);
            const blockStart = new Date(targetDay);
            blockStart.setHours(h, m || 0, 0, 0);

            if (blockStart < now) continue;

            // Skip if during sleep window
            const sleepH = parseInt(sleepWindow.sleep?.split(":")[0] || "23");
            const wakeH = parseInt(sleepWindow.wake?.split(":")[0] || "8");
            if (h >= sleepH || h < wakeH) continue;

            const blockEnd = new Date(blockStart.getTime() + 60 * 60 * 1000); // 1 hour

            // Check against ALL busy times (study blocks + Google Calendar + just-created)
            const startMs = blockStart.getTime();
            const endMs = blockEnd.getTime();

            const hasConflict = busyTimes.some(
              (bt) => startMs < bt.end && endMs > bt.start
            );

            const hasNewConflict = created.some((c) => {
              const cStart = new Date(c.start).getTime();
              const cEnd = new Date(c.end).getTime();
              return startMs < cEnd && endMs > cStart;
            });

            if (!hasConflict && !hasNewConflict) {
              const courseName = assignment.course?.name || "Study";
              const title = `Study: ${assignment.title} (${courseName})`;

              const { data: newBlock } = await supabase
                .from("study_blocks")
                .insert({
                  user_id: userId,
                  title,
                  course_id: assignment.course_id || null,
                  assignment_id: assignment.id,
                  start_time: blockStart.toISOString(),
                  end_time: blockEnd.toISOString(),
                })
                .select()
                .single();

              if (newBlock) {
                created.push({
                  id: newBlock.id,
                  title,
                  start: blockStart.toISOString(),
                  end: blockEnd.toISOString(),
                  google_synced: false,
                });

                // Sync to Google Calendar
                try {
                  const accessToken = await getGoogleAccessToken(userId);
                  if (accessToken) {
                    const calEvent = await createCalendarEvent(accessToken, {
                      summary: `📚 ${title}`,
                      description: `Study block for: ${assignment.title}`,
                      startTime: blockStart.toISOString(),
                      endTime: blockEnd.toISOString(),
                      colorId: "9",
                    });
                    await supabase
                      .from("study_blocks")
                      .update({ google_event_id: calEvent.id })
                      .eq("id", newBlock.id);
                    created[created.length - 1].google_synced = true;
                  }
                } catch {
                  // Calendar sync failed for this block but study block was created
                }
              }
              break; // Move to next assignment after scheduling one block
            }
          }
        }
      }

      const syncedCount = created.filter(c => c.google_synced).length;
      return {
        scheduled: created.length,
        blocks: created,
        google_events_checked: googleEvents.length,
        google_calendar_synced: syncedCount,
        message:
          created.length > 0
            ? `Scheduled ${created.length} study block(s) around your existing ${googleEvents.length} calendar events.${syncedCount < created.length ? ` Warning: ${created.length - syncedCount} block(s) failed to sync to Google Calendar.` : ""}`
            : "Could not find available time slots that don't conflict with your existing calendar. Try adjusting your peak hours in Settings or ask me to schedule at a specific time.",
      };
    }

    case "mark_email_handled": {
      await supabase
        .from("email_summaries")
        .update({ is_handled: true })
        .eq("id", args.email_id)
        .eq("user_id", userId);

      return { updated: true, message: "Email marked as handled." };
    }

    case "get_course_summary": {
      const [
        { data: course },
        { data: courseAssignments },
        { data: courseGrades },
        { data: courseStudyBlocks },
      ] = await Promise.all([
        supabase
          .from("courses")
          .select("*")
          .eq("id", args.course_id)
          .eq("user_id", userId)
          .single(),
        supabase
          .from("assignments")
          .select("*")
          .eq("user_id", userId)
          .eq("course_id", args.course_id)
          .order("due_date", { ascending: true }),
        supabase
          .from("grades")
          .select("*")
          .eq("user_id", userId)
          .eq("course_id", args.course_id)
          .order("created_at", { ascending: false }),
        supabase
          .from("study_blocks")
          .select("*")
          .eq("user_id", userId)
          .eq("course_id", args.course_id)
          .gte("start_time", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
      ]);

      if (!course) return { error: "Course not found" };

      // Calculate grade from our stored grades
      let totalEarned = 0;
      let totalPossible = 0;
      for (const g of courseGrades || []) {
        if (g.score !== null && g.max_score !== null && g.max_score > 0) {
          totalEarned += g.score;
          totalPossible += g.max_score;
        }
      }
      const manualAvg = totalPossible > 0 ? (totalEarned / totalPossible) * 100 : null;

      // Try to get Canvas enrollment score (most accurate — respects assignment group weights)
      let canvasScore: number | null = null;
      let canvasGrade: string | null = null;
      try {
        const { data: canvasConn } = await supabase
          .from("canvas_connections")
          .select("canvas_base_url, api_token")
          .eq("user_id", userId)
          .single();
        if (canvasConn) {
          const canvasCourses = await fetchCanvasCourses(canvasConn.canvas_base_url, canvasConn.api_token);
          const matched = canvasCourses.find((c) => c.course_code === course.code);
          if (matched?.enrollments?.[0]) {
            canvasScore = matched.enrollments[0].computed_current_score;
            canvasGrade = matched.enrollments[0].computed_current_grade;
          }
        }
      } catch {
        // Non-critical
      }

      const currentAvg = canvasScore ?? manualAvg;
      const letterGrade = canvasGrade || (currentAvg !== null ? getLetterGradeFromPercent(currentAvg) : null);

      // Grade trend: compare last 3 grades vs first 3 grades
      const validGrades = (courseGrades || []).filter(
        (g: { score: number | null; max_score: number | null }) => g.score !== null && g.max_score !== null && g.max_score > 0
      );
      let trend: "improving" | "declining" | "stable" | "insufficient_data" = "insufficient_data";
      if (validGrades.length >= 4) {
        const recent = validGrades.slice(0, 3);
        const older = validGrades.slice(-3);
        const recentAvg = recent.reduce((s: number, g: { score: number; max_score: number }) => s + (g.score / g.max_score), 0) / recent.length;
        const olderAvg = older.reduce((s: number, g: { score: number; max_score: number }) => s + (g.score / g.max_score), 0) / older.length;
        const diff = recentAvg - olderAvg;
        trend = diff > 0.03 ? "improving" : diff < -0.03 ? "declining" : "stable";
      }

      // Risk assessment
      let riskLevel: "on_track" | "warning" | "at_risk" | "critical" = "on_track";
      let riskReason = "";
      const { data: profileForGPA } = await supabase
        .from("profiles")
        .select("gpa_target")
        .eq("id", userId)
        .single();
      const gpaTarget = profileForGPA?.gpa_target;

      if (currentAvg !== null) {
        if (currentAvg < 60) {
          riskLevel = "critical";
          riskReason = "Failing grade — immediate action required.";
        } else if (currentAvg < 70) {
          riskLevel = "at_risk";
          riskReason = "Below C — at risk of not passing.";
        } else if (gpaTarget && currentAvg < gpaTargetToPercent(gpaTarget)) {
          riskLevel = "warning";
          riskReason = `Below your GPA target of ${gpaTarget} (need ${gpaTargetToPercent(gpaTarget)}%).`;
        } else if (trend === "declining") {
          riskLevel = "warning";
          riskReason = "Grades are trending downward.";
        }
      }

      const pending = (courseAssignments || []).filter(
        (a: { status: string }) => a.status !== "completed"
      );
      const completed = (courseAssignments || []).filter(
        (a: { status: string }) => a.status === "completed"
      );
      const studyHours = (courseStudyBlocks || [])
        .filter((b: { status: string }) => b.status === "completed")
        .reduce(
          (sum: number, b: { start_time: string; end_time: string }) =>
            sum + (new Date(b.end_time).getTime() - new Date(b.start_time).getTime()) / 3600000,
          0
        );

      return {
        course: {
          name: course.name,
          code: course.code,
          professor: course.professor,
          has_rubric: Array.isArray(course.grading_rubric) && course.grading_rubric.length > 0,
        },
        current_average: currentAvg !== null ? Math.round(currentAvg * 10) / 10 : null,
        letter_grade: letterGrade,
        canvas_score: canvasScore,
        grade_trend: trend,
        risk_level: riskLevel,
        risk_reason: riskReason,
        total_grades: validGrades.length,
        points_earned: totalEarned,
        points_possible: totalPossible,
        pending_assignments: pending.length,
        completed_assignments: completed.length,
        upcoming: pending.slice(0, 5).map((a: { title: string; due_date: string; status: string; weight: number | null }) => ({
          title: a.title,
          due_date: a.due_date,
          status: a.status,
          points: a.weight,
        })),
        recent_grades: (courseGrades || []).slice(0, 5).map((g: { title: string; score: number; max_score: number }) => ({
          title: g.title,
          score: g.score,
          max_score: g.max_score,
          percent: g.max_score > 0 ? Math.round((g.score / g.max_score) * 1000) / 10 : null,
        })),
        study_hours_this_month: Math.round(studyHours * 10) / 10,
      };
    }

    case "get_all_courses": {
      const { data: allCourses } = await supabase
        .from("courses")
        .select("id, name, code, color")
        .eq("user_id", userId);

      return allCourses || [];
    }

    case "update_profile": {
      const updates: Record<string, unknown> = {};
      if (args.productivity_peak_hours) updates.productivity_peak_hours = args.productivity_peak_hours;
      if (args.sleep_window) updates.sleep_window = args.sleep_window;
      if (args.escalation_mode) updates.escalation_mode = args.escalation_mode;
      if (args.gpa_target !== undefined) updates.gpa_target = args.gpa_target;
      if (args.semester_goals) updates.semester_goals = args.semester_goals;

      if (Object.keys(updates).length === 0) {
        return { error: "No fields to update" };
      }

      await supabase
        .from("profiles")
        .update(updates)
        .eq("id", userId);

      return { updated: true, fields: Object.keys(updates), message: "Profile updated." };
    }

    case "get_profile": {
      const { data: profileData } = await supabase
        .from("profiles")
        .select(
          "full_name, productivity_peak_hours, sleep_window, escalation_mode, gpa_target, semester_goals, mantras, streak_count, personal_why"
        )
        .eq("id", userId)
        .single();

      return profileData || { error: "Profile not found" };
    }

    case "analyze_course_grade": {
      // Fetch course with grading rubric
      const { data: courseData } = await supabase
        .from("courses")
        .select("id, name, code, grading_rubric")
        .eq("id", args.course_id)
        .eq("user_id", userId)
        .single();

      if (!courseData) return { error: "Course not found" };

      if (
        !courseData.grading_rubric ||
        (Array.isArray(courseData.grading_rubric) && courseData.grading_rubric.length === 0)
      ) {
        return {
          error: "No grading rubric found for this course. The student needs to upload their syllabus first (via the Courses page) so I can extract the grading breakdown.",
        };
      }

      // Fetch all grades for this course
      const { data: courseGrades } = await supabase
        .from("grades")
        .select("title, score, max_score, weight")
        .eq("user_id", userId)
        .eq("course_id", args.course_id);

      // Fetch all assignments for context (pending + completed)
      const { data: courseAssignments } = await supabase
        .from("assignments")
        .select("title, status, due_date, weight")
        .eq("user_id", userId)
        .eq("course_id", args.course_id)
        .order("due_date", { ascending: true });

      // Use Azure OpenAI to analyze grades against rubric
      const azureClient = getAzureOpenAI();
      const analysisResponse = await azureClient.chat.completions.create({
        model: process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are a grade analysis expert. Given a course's grading rubric, existing grades, and assignments, calculate:
1. Current grade percentage (weighted by rubric categories)
2. Projected final grade based on current trajectory
3. What scores are needed on remaining assignments to achieve specific letter grades (A, B, C)
4. Which categories are pulling the grade down

Return valid JSON:
{
  "current_grade_percent": number,
  "current_letter_grade": "A/A-/B+/B/B-/C+/C/C-/D/F",
  "projected_final_percent": number,
  "projected_letter_grade": "string",
  "category_breakdown": [{"category": "string", "weight_percent": number, "current_avg": number or null, "grades_count": number, "status": "strong/on_track/needs_improvement/no_data"}],
  "targets": {"for_A": {"min_avg_needed": number, "achievable": boolean}, "for_B": {"min_avg_needed": number, "achievable": boolean}, "for_C": {"min_avg_needed": number, "achievable": boolean}},
  "insights": ["string array of 2-3 key observations"],
  "remaining_assignments_count": number
}`,
          },
          {
            role: "user",
            content: `Course: ${courseData.name} (${courseData.code})

Grading Rubric:
${JSON.stringify(courseData.grading_rubric, null, 2)}

Existing Grades (${(courseGrades || []).length} graded items):
${(courseGrades || []).map((g: { title: string; score: number; max_score: number }) => `- ${g.title}: ${g.score}/${g.max_score} (${((g.score / g.max_score) * 100).toFixed(1)}%)`).join("\n") || "No grades yet"}

All Assignments (${(courseAssignments || []).length} total):
${(courseAssignments || []).map((a: { title: string; status: string; due_date: string; weight: number | null }) => `- ${a.title} [${a.status}] due ${a.due_date}${a.weight ? ` (${a.weight} pts)` : ""}`).join("\n") || "No assignments"}`,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
      });

      const analysisContent = analysisResponse.choices[0]?.message?.content;
      if (!analysisContent) return { error: "Grade analysis failed — no AI response" };

      try {
        const analysis = JSON.parse(analysisContent);
        return {
          course: courseData.name,
          ...analysis,
        };
      } catch {
        return { error: "Grade analysis returned invalid data" };
      }
    }

    case "generate_daily_plan": {
      const planDate = args.date || new Date().toISOString().split("T")[0];

      // Fetch all context in parallel
      const [
        { data: planAssignments },
        { data: planGrades },
        { data: planCourses },
        { data: planBlocks },
        { data: planEmails },
        { data: planProfile },
      ] = await Promise.all([
        supabase
          .from("assignments")
          .select("*, course:courses(name, code, color)")
          .eq("user_id", userId)
          .neq("status", "completed")
          .order("due_date"),
        supabase
          .from("grades")
          .select("*, course:courses(name)")
          .eq("user_id", userId)
          .order("created_at", { ascending: false }),
        supabase.from("courses").select("*").eq("user_id", userId),
        supabase
          .from("study_blocks")
          .select("*")
          .eq("user_id", userId)
          .gte("start_time", `${planDate}T00:00:00`)
          .lte("start_time", `${planDate}T23:59:59`),
        supabase
          .from("email_summaries")
          .select("*")
          .eq("user_id", userId)
          .eq("action_required", true)
          .eq("is_handled", false)
          .limit(5),
        supabase.from("profiles").select("*").eq("id", userId).single(),
      ]);

      // Fetch Google Calendar events for the day
      let calendarEventsForPlan: Array<{ summary: string; start: string; end: string }> = [];
      const googleToken = await getGoogleAccessToken(userId);
      if (googleToken) {
        try {
          const events = await fetchCalendarEvents(
            googleToken,
            `${planDate}T00:00:00Z`,
            `${planDate}T23:59:59Z`
          );
          calendarEventsForPlan = events.map((e: { summary?: string; start?: { dateTime?: string }; end?: { dateTime?: string } }) => ({
            summary: e.summary || "Untitled",
            start: e.start?.dateTime || "",
            end: e.end?.dateTime || "",
          }));
        } catch {
          // Calendar unavailable
        }
      }

      // Calculate per-course grade health
      const courseHealth: Array<{ name: string; avg: number; risk: string }> = [];
      for (const course of planCourses || []) {
        const cGrades = (planGrades || []).filter((g: { course_id: string }) => g.course_id === course.id);
        const valid = cGrades.filter((g: { score: number | null; max_score: number | null }) => g.score != null && g.max_score != null && g.max_score > 0);
        if (valid.length > 0) {
          const earned = valid.reduce((s: number, g: { score: number }) => s + g.score, 0);
          const possible = valid.reduce((s: number, g: { max_score: number }) => s + g.max_score, 0);
          const avg = (earned / possible) * 100;
          const risk = avg < 60 ? "critical" : avg < 70 ? "at_risk" : avg < 80 ? "warning" : "on_track";
          courseHealth.push({ name: course.name, avg: Math.round(avg * 10) / 10, risk });
        }
      }

      // Build AI plan using Azure OpenAI
      const planClient = getAzureOpenAI();
      const peakHours = planProfile?.productivity_peak_hours || [];
      const sleepWindow = planProfile?.sleep_window || { sleep: "23:00", wake: "08:00" };

      const planResponse = await planClient.chat.completions.create({
        model: process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are an AI academic planner for a college student. Generate an optimal daily plan as JSON.

RULES:
- NEVER schedule over existing calendar events (classes, meetings)
- Schedule study sessions during peak productivity hours when possible
- Prioritize courses with "at_risk" or "critical" grades
- Prioritize high-weight assignments due soonest
- Include breaks (10-15 min) between sessions
- Respect sleep window
- Each study block should be 45-90 minutes
- Include a brief reason for WHY each item matters

Return JSON:
{
  "plan": [
    {
      "time": "HH:MM",
      "end_time": "HH:MM",
      "type": "study|deadline|class|email|break",
      "title": "string",
      "course_name": "string or null",
      "priority": "high|medium|low",
      "reason": "brief reason this matters"
    }
  ],
  "summary": "1-2 sentence overview of the day's priorities",
  "top_priority": "the single most important thing today"
}`,
          },
          {
            role: "user",
            content: `Date: ${planDate}
Peak hours: ${peakHours.length > 0 ? peakHours.join(", ") : "9:00-12:00, 14:00-17:00"}
Sleep: ${sleepWindow.sleep} - ${sleepWindow.wake}
GPA Target: ${planProfile?.gpa_target || "Not set"}

EXISTING CALENDAR (DO NOT SCHEDULE OVER THESE):
${calendarEventsForPlan.length > 0 ? calendarEventsForPlan.map((e) => `- ${e.summary}: ${e.start} - ${e.end}`).join("\n") : "No calendar events"}

EXISTING STUDY BLOCKS:
${(planBlocks || []).map((b: { title: string; start_time: string; end_time: string }) => `- ${b.title}: ${b.start_time} - ${b.end_time}`).join("\n") || "None"}

PENDING ASSIGNMENTS (sorted by due date):
${(planAssignments || []).slice(0, 12).map((a: { title: string; due_date: string; weight: number | null; status: string; course?: { name?: string } }) => `- ${a.title} [${a.status}] due ${a.due_date}${a.weight ? ` (${a.weight} pts)` : ""} — ${a.course?.name || "General"}`).join("\n") || "No assignments"}

COURSE GRADE HEALTH:
${courseHealth.length > 0 ? courseHealth.map((c) => `- ${c.name}: ${c.avg}% (${c.risk})`).join("\n") : "No grade data"}

ACTION-REQUIRED EMAILS:
${(planEmails || []).map((e: { subject: string; suggested_action: string | null }) => `- ${e.subject}${e.suggested_action ? ` → ${e.suggested_action}` : ""}`).join("\n") || "None"}`,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
      });

      const planContent = planResponse.choices[0]?.message?.content;
      if (!planContent) return { error: "Failed to generate daily plan" };

      try {
        const plan = JSON.parse(planContent);
        return {
          date: planDate,
          ...plan,
          course_health: courseHealth,
          existing_events: calendarEventsForPlan.length,
          existing_study_blocks: (planBlocks || []).length,
        };
      } catch {
        return { error: "Daily plan generation returned invalid data" };
      }
    }

    case "predict_semester_gpa": {
      // Fetch all courses, grades, and assignments
      const [
        { data: gpaCoursesRaw },
        { data: gpaGradesRaw },
        { data: gpaAssignmentsRaw },
        { data: gpaProfileRaw },
      ] = await Promise.all([
        supabase.from("courses").select("*").eq("user_id", userId),
        supabase.from("grades").select("*, course:courses(name, code, color)").eq("user_id", userId),
        supabase.from("assignments").select("*, course:courses(name)").eq("user_id", userId).neq("status", "completed").order("due_date"),
        supabase.from("profiles").select("gpa_target").eq("id", userId).single(),
      ]);

      const gpaCourses = gpaCoursesRaw || [];
      const gpaGrades = gpaGradesRaw || [];
      const gpaAssignments = gpaAssignmentsRaw || [];

      const projections: Array<{
        course_name: string;
        course_code: string | null;
        current_average: number | null;
        current_letter: string;
        projected_final: number | null;
        projected_letter: string;
        trend: string;
        remaining_assignments: number;
        remaining_weight: number;
        risk_level: string;
        recommendation: string;
      }> = [];

      for (const course of gpaCourses) {
        const cGrades = gpaGrades.filter((g: { course_id: string }) => g.course_id === course.id);
        const valid = cGrades.filter((g: { score: number | null; max_score: number | null }) => g.score != null && g.max_score != null && (g.max_score as number) > 0);

        let currentAvg: number | null = null;
        if (valid.length > 0) {
          const earned = valid.reduce((s: number, g: { score: number }) => s + g.score, 0);
          const possible = valid.reduce((s: number, g: { max_score: number }) => s + g.max_score, 0);
          currentAvg = (earned / possible) * 100;
        }

        // Trend analysis
        let trend = "new";
        if (valid.length >= 4) {
          const sorted = [...valid].sort((a: { created_at: string }, b: { created_at: string }) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          const recent3 = sorted.slice(0, 3);
          const older3 = sorted.slice(-3);
          const rAvg = recent3.reduce((s: number, g: { score: number; max_score: number }) => s + g.score / g.max_score, 0) / recent3.length;
          const oAvg = older3.reduce((s: number, g: { score: number; max_score: number }) => s + g.score / g.max_score, 0) / older3.length;
          trend = rAvg > oAvg + 0.03 ? "improving" : rAvg < oAvg - 0.03 ? "declining" : "stable";
        } else if (valid.length > 0) {
          trend = "stable";
        }

        // Remaining work
        const remaining = gpaAssignments.filter((a: { course_id: string | null }) => a.course_id === course.id);
        const remainingWeight = remaining.reduce((s: number, a: { weight: number | null }) => s + (a.weight || 0), 0);

        // Project final grade based on trend
        let projected = currentAvg;
        if (currentAvg !== null && trend === "improving") {
          projected = Math.min(currentAvg + 3, 100); // optimistic bump
        } else if (currentAvg !== null && trend === "declining") {
          projected = Math.max(currentAvg - 4, 0); // pessimistic adjustment
        }

        const risk = currentAvg === null ? "unknown"
          : currentAvg < 60 ? "critical"
          : currentAvg < 70 ? "at_risk"
          : currentAvg < 80 ? "warning"
          : "on_track";

        const recommendation = risk === "critical"
          ? "Immediate intervention needed. Schedule daily study sessions and visit office hours."
          : risk === "at_risk"
          ? "Increase study time significantly. Focus all available hours here."
          : trend === "declining"
          ? "Grades are trending down. Reverse the trend before it gets worse."
          : risk === "warning"
          ? "Below GPA target. Allocate extra study sessions."
          : "Maintain current effort. Stay consistent.";

        projections.push({
          course_name: course.name,
          course_code: course.code,
          current_average: currentAvg !== null ? Math.round(currentAvg * 10) / 10 : null,
          current_letter: currentAvg !== null ? getLetterGradeFromPercent(currentAvg) : "N/A",
          projected_final: projected !== null ? Math.round(projected * 10) / 10 : null,
          projected_letter: projected !== null ? getLetterGradeFromPercent(projected) : "N/A",
          trend,
          remaining_assignments: remaining.length,
          remaining_weight: remainingWeight,
          risk_level: risk,
          recommendation,
        });
      }

      // Calculate projected GPA
      const withProjections = projections.filter((p) => p.projected_final !== null);
      let projectedGpa: number | null = null;
      if (withProjections.length > 0) {
        const totalGpaPoints = withProjections.reduce((s, p) => s + percentToGpaPoints(p.projected_final!), 0);
        projectedGpa = Math.round((totalGpaPoints / withProjections.length) * 100) / 100;
      }

      const currentGpa = withProjections.length > 0
        ? Math.round((withProjections.filter((p) => p.current_average !== null).reduce((s, p) => s + percentToGpaPoints(p.current_average!), 0) / withProjections.filter((p) => p.current_average !== null).length) * 100) / 100
        : null;

      return {
        current_gpa: currentGpa,
        projected_gpa: projectedGpa,
        gpa_target: gpaProfileRaw?.gpa_target || null,
        on_track_for_target: projectedGpa !== null && gpaProfileRaw?.gpa_target ? projectedGpa >= gpaProfileRaw.gpa_target : null,
        courses: projections,
        courses_at_risk: projections.filter((p) => p.risk_level === "at_risk" || p.risk_level === "critical").length,
        courses_declining: projections.filter((p) => p.trend === "declining").length,
      };
    }

    case "detect_grade_cliffs": {
      const { data: cliffGrades } = await supabase
        .from("grades")
        .select("*, course:courses(name, code)")
        .eq("user_id", userId);

      const { data: cliffCourses } = await supabase
        .from("courses")
        .select("*")
        .eq("user_id", userId);

      // Grade boundaries
      const boundaries = [
        { letter: "A", min: 93 },
        { letter: "A-", min: 90 },
        { letter: "B+", min: 87 },
        { letter: "B", min: 83 },
        { letter: "B-", min: 80 },
        { letter: "C+", min: 77 },
        { letter: "C", min: 73 },
        { letter: "C-", min: 70 },
        { letter: "D+", min: 67 },
        { letter: "D", min: 60 },
      ];

      const cliffs: Array<{
        course_name: string;
        current_average: number;
        current_letter: string;
        nearest_boundary: number;
        grade_below: string;
        margin: number;
        risk: string;
        message: string;
      }> = [];

      for (const course of cliffCourses || []) {
        const cGrades = (cliffGrades || []).filter((g: { course_id: string }) => g.course_id === course.id);
        const valid = cGrades.filter((g: { score: number | null; max_score: number | null }) => g.score != null && g.max_score != null && (g.max_score as number) > 0);
        if (valid.length === 0) continue;

        const earned = valid.reduce((s: number, g: { score: number }) => s + g.score, 0);
        const possible = valid.reduce((s: number, g: { max_score: number }) => s + g.max_score, 0);
        const avg = (earned / possible) * 100;
        const currentLetter = getLetterGradeFromPercent(avg);

        // Find nearest boundary below current average
        for (const boundary of boundaries) {
          const margin = avg - boundary.min;
          if (margin >= 0 && margin <= 3) {
            const belowIdx = boundaries.indexOf(boundary) + 1;
            const gradeBelow = belowIdx < boundaries.length ? boundaries[belowIdx].letter : "F";

            cliffs.push({
              course_name: course.name,
              current_average: Math.round(avg * 10) / 10,
              current_letter: currentLetter,
              nearest_boundary: boundary.min,
              grade_below: gradeBelow,
              margin: Math.round(margin * 10) / 10,
              risk: margin <= 1 ? "critical" : margin <= 2 ? "high" : "moderate",
              message: `${course.name}: ${avg.toFixed(1)}% (${currentLetter}) — only ${margin.toFixed(1)}% above ${gradeBelow}. One bad grade could drop you.`,
            });
            break;
          }
        }
      }

      return {
        cliffs: cliffs.sort((a, b) => a.margin - b.margin),
        total_cliff_courses: cliffs.length,
        critical_count: cliffs.filter((c) => c.risk === "critical").length,
        summary: cliffs.length === 0
          ? "No grade cliffs detected. You have comfortable margins in all courses."
          : `${cliffs.length} course${cliffs.length > 1 ? "s" : ""} near a grade boundary. ${cliffs.filter((c) => c.risk === "critical").length} critical.`,
      };
    }

    case "get_study_effectiveness": {
      // Fetch study blocks from last 30 days with course info
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const [
        { data: effBlocks },
        { data: effGrades },
        { data: effCourses },
      ] = await Promise.all([
        supabase.from("study_blocks").select("*, course:courses(name)").eq("user_id", userId).gte("start_time", thirtyDaysAgo),
        supabase.from("grades").select("*, course:courses(name)").eq("user_id", userId).gte("created_at", thirtyDaysAgo),
        supabase.from("courses").select("*").eq("user_id", userId),
      ]);

      const blocks = effBlocks || [];
      const grades = effGrades || [];

      // Time-of-day analysis
      const timeSlots = { morning: { hours: 0, blocks: 0 }, afternoon: { hours: 0, blocks: 0 }, evening: { hours: 0, blocks: 0 }, night: { hours: 0, blocks: 0 } };
      const completedBlocksList = blocks.filter((b: { status: string }) => b.status === "completed");
      const skippedBlocksList = blocks.filter((b: { status: string }) => b.status === "skipped");

      for (const b of completedBlocksList) {
        const startHour = new Date(b.start_time).getHours();
        const duration = (new Date(b.end_time).getTime() - new Date(b.start_time).getTime()) / 3600000;
        const slot = startHour < 12 ? "morning" : startHour < 17 ? "afternoon" : startHour < 21 ? "evening" : "night";
        timeSlots[slot].hours += duration;
        timeSlots[slot].blocks += 1;
      }

      // Session length analysis
      const sessionLengths = completedBlocksList.map((b: { start_time: string; end_time: string }) =>
        (new Date(b.end_time).getTime() - new Date(b.start_time).getTime()) / 60000
      );
      const avgSessionMin = sessionLengths.length > 0 ? sessionLengths.reduce((a: number, b: number) => a + b, 0) / sessionLengths.length : 0;

      // Per-course study vs grade correlation
      const courseEffectiveness: Array<{
        course_name: string;
        study_hours: number;
        grade_average: number | null;
        study_to_grade_ratio: string;
        recommendation: string;
      }> = [];

      for (const course of effCourses || []) {
        const courseBlocks = completedBlocksList.filter((b: { course_id: string | null }) => b.course_id === course.id);
        const courseHours = courseBlocks.reduce((s: number, b: { start_time: string; end_time: string }) => {
          return s + (new Date(b.end_time).getTime() - new Date(b.start_time).getTime()) / 3600000;
        }, 0);

        const courseGrades = grades.filter((g: { course_id: string; score: number | null; max_score: number | null }) => g.course_id === course.id && g.score != null && g.max_score != null && (g.max_score as number) > 0);
        let gradeAvg: number | null = null;
        if (courseGrades.length > 0) {
          const e = courseGrades.reduce((s: number, g: { score: number }) => s + g.score, 0);
          const p = courseGrades.reduce((s: number, g: { max_score: number }) => s + g.max_score, 0);
          gradeAvg = (e / p) * 100;
        }

        const ratio = gradeAvg !== null && courseHours > 0
          ? gradeAvg >= 90 && courseHours < 5 ? "efficient"
          : gradeAvg < 70 && courseHours < 3 ? "under-invested"
          : gradeAvg < 70 && courseHours >= 5 ? "struggling"
          : "balanced"
          : "unknown";

        const rec = ratio === "under-invested"
          ? `Significantly increase study time. Only ${courseHours.toFixed(1)}h for a ${gradeAvg?.toFixed(0)}% grade.`
          : ratio === "struggling"
          ? "Study time isn't translating to results. Try different methods: practice problems, office hours, study groups."
          : ratio === "efficient"
          ? "Great ROI. Maintain current approach."
          : "Continue current pace.";

        courseEffectiveness.push({
          course_name: course.name,
          study_hours: Math.round(courseHours * 10) / 10,
          grade_average: gradeAvg !== null ? Math.round(gradeAvg * 10) / 10 : null,
          study_to_grade_ratio: ratio,
          recommendation: rec,
        });
      }

      // Best study time
      const bestTime = Object.entries(timeSlots).sort((a, b) => b[1].hours - a[1].hours)[0];

      return {
        total_study_hours_30d: Math.round(completedBlocksList.reduce((s: number, b: { start_time: string; end_time: string }) => s + (new Date(b.end_time).getTime() - new Date(b.start_time).getTime()) / 3600000, 0) * 10) / 10,
        total_sessions_30d: completedBlocksList.length,
        skipped_sessions_30d: skippedBlocksList.length,
        follow_through_rate: completedBlocksList.length + skippedBlocksList.length > 0
          ? Math.round((completedBlocksList.length / (completedBlocksList.length + skippedBlocksList.length)) * 100)
          : 0,
        avg_session_minutes: Math.round(avgSessionMin),
        best_study_time: bestTime[0],
        time_distribution: Object.fromEntries(Object.entries(timeSlots).map(([k, v]) => [k, { hours: Math.round(v.hours * 10) / 10, sessions: v.blocks }])),
        course_effectiveness: courseEffectiveness,
        optimal_session_length: avgSessionMin > 90 ? "Your sessions average over 90 min — try splitting into 45-60 min focused blocks with breaks." : avgSessionMin < 25 ? "Sessions are very short — try extending to 45 min for better deep focus." : "Good session length.",
      };
    }

    case "generate_weekly_strategy": {
      const weekStart = args.week_start || getNextMonday();

      const [
        { data: stratAssignments },
        { data: stratGrades },
        { data: stratCourses },
        { data: stratProfile },
        { data: stratBlocks },
      ] = await Promise.all([
        supabase.from("assignments").select("*, course:courses(name, code, color)").eq("user_id", userId).neq("status", "completed").order("due_date"),
        supabase.from("grades").select("*, course:courses(name)").eq("user_id", userId).order("created_at", { ascending: false }),
        supabase.from("courses").select("*").eq("user_id", userId),
        supabase.from("profiles").select("*").eq("id", userId).single(),
        supabase.from("study_blocks").select("*").eq("user_id", userId).gte("start_time", new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()),
      ]);

      // Build course health for AI context
      const stratCourseHealth: Array<{ name: string; avg: number; trend: string; risk: string; studyHours: number }> = [];
      for (const c of stratCourses || []) {
        const cg = (stratGrades || []).filter((g: { course_id: string }) => g.course_id === c.id);
        const valid = cg.filter((g: { score: number | null; max_score: number | null }) => g.score != null && g.max_score != null && (g.max_score as number) > 0);
        let avg = 0;
        if (valid.length > 0) {
          const e = valid.reduce((s: number, g: { score: number }) => s + g.score, 0);
          const p = valid.reduce((s: number, g: { max_score: number }) => s + g.max_score, 0);
          avg = (e / p) * 100;
        }
        const courseBlocks = (stratBlocks || []).filter((b: { course_id: string | null; status: string }) => b.course_id === c.id && b.status === "completed");
        const studyH = courseBlocks.reduce((s: number, b: { start_time: string; end_time: string }) => s + (new Date(b.end_time).getTime() - new Date(b.start_time).getTime()) / 3600000, 0);
        const risk = avg < 60 ? "critical" : avg < 70 ? "at_risk" : avg < 80 ? "warning" : "on_track";
        stratCourseHealth.push({ name: c.name, avg: Math.round(avg * 10) / 10, trend: "stable", risk, studyHours: Math.round(studyH * 10) / 10 });
      }

      // Get Google Calendar events for the week
      let weekCalEvents: Array<{ summary: string; start: string; end: string; day: string }> = [];
      const gToken = await getGoogleAccessToken(userId);
      if (gToken) {
        try {
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekEnd.getDate() + 6);
          const events = await fetchCalendarEvents(gToken, `${weekStart}T00:00:00Z`, `${weekEnd.toISOString().split("T")[0]}T23:59:59Z`);
          weekCalEvents = events.map((e: { summary?: string; start?: { dateTime?: string }; end?: { dateTime?: string } }) => {
            const startDt = e.start?.dateTime || "";
            return {
              summary: e.summary || "Untitled",
              start: startDt,
              end: e.end?.dateTime || "",
              day: startDt ? new Date(startDt).toLocaleDateString("en-US", { weekday: "long" }) : "",
            };
          });
        } catch { /* calendar unavailable */ }
      }

      const stratClient = getAzureOpenAI();
      const stratResponse = await stratClient.chat.completions.create({
        model: process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are a strategic academic advisor. Generate a comprehensive weekly study strategy as JSON.

PRINCIPLES:
- Courses with lower grades get MORE study time (inverse allocation)
- Critical/at-risk courses get 2-3x more hours than on-track courses
- Space study sessions across the week (no cramming)
- Account for classes/meetings shown in the calendar
- Assign daily themes when possible ("Monday: Physics deep dive")
- Include specific, actionable items — not vague advice
- If study hours invested are low compared to poor grades, flag it

Return JSON:
{
  "weekly_theme": "One sentence strategic focus for the week",
  "total_recommended_hours": number,
  "daily_plan": [
    {
      "day": "Monday",
      "date": "YYYY-MM-DD",
      "theme": "string",
      "study_hours_target": number,
      "priority_items": [
        {
          "title": "string",
          "course": "string or null",
          "duration_minutes": number,
          "priority": "critical|high|medium",
          "reason": "string"
        }
      ]
    }
  ],
  "course_hour_allocation": [
    { "course": "string", "recommended_hours": number, "current_grade": "string", "rationale": "string" }
  ],
  "strategic_actions": ["string array of 3-5 high-impact actions for the week"],
  "risk_mitigation": ["string array of specific actions for at-risk courses"]
}`,
          },
          {
            role: "user",
            content: `Week starting: ${weekStart}
Student: ${stratProfile?.full_name}
GPA Target: ${stratProfile?.gpa_target || "Not set"}
Peak Hours: ${(stratProfile?.productivity_peak_hours || []).join(", ") || "9:00-12:00, 14:00-17:00"}
Sleep: ${stratProfile?.sleep_window?.sleep || "23:00"} - ${stratProfile?.sleep_window?.wake || "08:00"}

COURSE HEALTH:
${stratCourseHealth.map((c) => `- ${c.name}: ${c.avg}% (${c.risk}) — ${c.studyHours}h studied recently`).join("\n")}

DEADLINES THIS WEEK & BEYOND:
${(stratAssignments || []).slice(0, 15).map((a: { title: string; due_date: string; weight: number | null; course?: { name?: string } }) => `- ${a.title} due ${a.due_date}${a.weight ? ` (${a.weight} pts)` : ""} — ${a.course?.name || "General"}`).join("\n") || "None"}

CALENDAR EVENTS THIS WEEK:
${weekCalEvents.map((e) => `- ${e.day}: ${e.summary} (${e.start} - ${e.end})`).join("\n") || "No events"}`,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
      });

      const stratContent = stratResponse.choices[0]?.message?.content;
      if (!stratContent) return { error: "Failed to generate weekly strategy" };

      try {
        return { week_start: weekStart, ...JSON.parse(stratContent), course_health: stratCourseHealth };
      } catch {
        return { error: "Weekly strategy generation returned invalid data" };
      }
    }

    case "run_what_if": {
      if (!args.course_id || args.hypothetical_score == null) {
        return { error: "course_id and hypothetical_score are required" };
      }

      const [
        { data: wifCourse },
        { data: wifGrades },
      ] = await Promise.all([
        supabase.from("courses").select("*").eq("id", args.course_id).eq("user_id", userId).single(),
        supabase.from("grades").select("*").eq("user_id", userId).eq("course_id", args.course_id),
      ]);

      if (!wifCourse) return { error: "Course not found" };

      const validGrades = (wifGrades || []).filter((g: { score: number | null; max_score: number | null }) => g.score != null && g.max_score != null && (g.max_score as number) > 0);

      let currentEarned = 0;
      let currentPossible = 0;
      for (const g of validGrades) {
        currentEarned += (g as { score: number }).score;
        currentPossible += (g as { max_score: number }).max_score;
      }

      const currentAvg = currentPossible > 0 ? (currentEarned / currentPossible) * 100 : null;
      const currentLetter = currentAvg !== null ? getLetterGradeFromPercent(currentAvg) : "N/A";

      // Simulate adding the hypothetical score
      const hypoWeight = args.assignment_weight || 100; // default to 100-point assignment
      const hypoScore = (args.hypothetical_score / 100) * hypoWeight;
      const newEarned = currentEarned + hypoScore;
      const newPossible = currentPossible + hypoWeight;
      const newAvg = (newEarned / newPossible) * 100;
      const newLetter = getLetterGradeFromPercent(newAvg);

      const letterChanged = currentLetter !== newLetter;
      const gpaImpact = currentAvg !== null ? percentToGpaPoints(newAvg) - percentToGpaPoints(currentAvg) : 0;

      // Calculate what they'd need for key letter grades
      const targets: Record<string, { needed: number; achievable: boolean }> = {};
      for (const [letter, minPct] of [["A", 93], ["A-", 90], ["B+", 87], ["B", 83], ["B-", 80], ["C", 73]] as [string, number][]) {
        const needed = ((minPct / 100) * newPossible - currentEarned) / hypoWeight * 100;
        targets[letter] = {
          needed: Math.round(needed * 10) / 10,
          achievable: needed <= 100 && needed >= 0,
        };
      }

      return {
        course: wifCourse.name,
        assignment: args.assignment_title || "Hypothetical assignment",
        hypothetical_score: args.hypothetical_score,
        before: {
          average: currentAvg !== null ? Math.round(currentAvg * 10) / 10 : null,
          letter_grade: currentLetter,
        },
        after: {
          average: Math.round(newAvg * 10) / 10,
          letter_grade: newLetter,
        },
        impact: {
          letter_grade_changed: letterChanged,
          direction: newAvg > (currentAvg || 0) ? "up" : newAvg < (currentAvg || 0) ? "down" : "same",
          gpa_points_change: Math.round(gpaImpact * 100) / 100,
          message: letterChanged
            ? `This would ${newAvg > (currentAvg || 0) ? "raise" : "drop"} you from ${currentLetter} to ${newLetter}.`
            : `You'd stay at ${newLetter} (${Math.round(newAvg * 10) / 10}%).`,
        },
        targets_from_here: targets,
      };
    }

    default:
      return { error: `Unknown tool: ${name}` };
  }
}
