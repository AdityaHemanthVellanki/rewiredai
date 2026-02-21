import { createClient } from "@/lib/supabase/server";
import { getAzureOpenAI } from "@/lib/azure-openai";
import { buildSystemPrompt } from "@/lib/agent/system-prompt";
import { agentTools } from "@/lib/agent/tools";
import { getGoogleAccessToken } from "@/lib/google/auth";
import { createCalendarEvent } from "@/lib/google/calendar";
import { fetchRecentEmails } from "@/lib/google/gmail";
import {
  fetchCanvasCourses,
  fetchCanvasAssignments,
  fetchCanvasSubmissions,
} from "@/lib/canvas";
import { NextResponse } from "next/server";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import type { Profile, CanvasSubmission } from "@/types";

const MAX_TOOL_ITERATIONS = 8;

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

              const result = await executeToolCall(
                tc.function.name,
                parsedArgs,
                user.id,
                supabase
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

        // Save assistant response
        if (fullResponse) {
          await supabase.from("chat_messages").insert({
            user_id: user.id,
            role: "assistant",
            content: fullResponse,
          });
        }

        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch (error) {
        console.error("Chat error:", error);
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ content: "Sorry, something went wrong. Try again?" })}\n\n`
          )
        );
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function executeToolCall(name: string, args: any, userId: string, supabase: any) {
  switch (name) {
    case "get_deadlines": {
      let query = supabase
        .from("assignments")
        .select("*, course:courses(name, code, color)")
        .eq("user_id", userId)
        .order("due_date", { ascending: true });

      if (args.status) query = query.eq("status", args.status);
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

      const { data } = await query;
      return data || [];
    }

    case "get_calendar_events": {
      const { data: studyBlocks } = await supabase
        .from("study_blocks")
        .select("*")
        .eq("user_id", userId)
        .gte("start_time", args.start_date)
        .lte("start_time", args.end_date);

      return studyBlocks || [];
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

      // Sync to Google Calendar if requested
      let calendarEventId = null;
      if (args.sync_to_google && data) {
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
            // Update study block with Google Calendar event ID
            await supabase
              .from("study_blocks")
              .update({ google_event_id: calEvent.id })
              .eq("id", data.id);
          }
        } catch {
          // Non-critical: calendar sync failed but study block was created
        }
      }

      return {
        created: true,
        studyBlock: data,
        google_calendar_synced: !!calendarEventId,
      };
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
      const { data: grades } = await supabase
        .from("grades")
        .select("score, max_score, weight")
        .eq("user_id", userId)
        .eq("course_id", args.course_id);

      if (!grades || grades.length === 0) {
        return { error: "No grades found for this course" };
      }

      let earnedWeighted = 0;
      let totalWeightUsed = 0;

      for (const g of grades) {
        if (g.score !== null && g.max_score !== null && g.max_score > 0) {
          const pct = (g.score / g.max_score) * 100;
          const w = g.weight || 1;
          earnedWeighted += pct * w;
          totalWeightUsed += w;
        }
      }

      const remainingWeight = args.remaining_assignment_weight || (100 - totalWeightUsed);
      const currentAvg = totalWeightUsed > 0 ? earnedWeighted / totalWeightUsed : 0;
      const needed =
        remainingWeight > 0
          ? ((args.target_grade * 100 - earnedWeighted) / remainingWeight)
          : 0;

      return {
        current_average: Math.round(currentAvg * 10) / 10,
        weight_completed: totalWeightUsed,
        remaining_weight: remainingWeight,
        score_needed: Math.round(needed * 10) / 10,
        achievable: needed <= 100,
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
    // New agentic tools
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
        let synced = 0;

        for (const cc of canvasCourses) {
          if (cc.workflow_state !== "available") continue;

          const { data: course } = await supabase
            .from("courses")
            .select("id")
            .eq("user_id", userId)
            .eq("code", cc.course_code)
            .single();

          if (!course) continue;

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

              let status: string;
              if (isCompleted) {
                status = "completed";
              } else {
                status = new Date(ca.due_at) < new Date() ? "overdue" : "pending";
              }

              // Update existing assignments
              const { data: existing } = await supabase
                .from("assignments")
                .select("id")
                .eq("user_id", userId)
                .eq("canvas_assignment_id", ca.id)
                .single();

              if (existing) {
                await supabase
                  .from("assignments")
                  .update({ status })
                  .eq("id", existing.id);
                synced++;
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

        return { synced, message: `Synced ${synced} assignments from Canvas.` };
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
      const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: existingBlocks } = await supabase
        .from("study_blocks")
        .select("*")
        .eq("user_id", userId)
        .gte("start_time", new Date().toISOString())
        .lte("start_time", nextWeek);

      if (!upcoming || upcoming.length === 0) {
        return { message: "No upcoming assignments to schedule study time for." };
      }

      const peakHours = profileData?.productivity_peak_hours || ["09:00", "10:00", "14:00", "15:00"];
      const sleepWindow = profileData?.sleep_window || { sleep: "23:00", wake: "08:00" };
      const created: Array<{ title: string; start: string; end: string }> = [];

      // Simple scheduling: for each top assignment, try to find a free peak-hour slot
      for (const assignment of (upcoming || []).slice(0, 5)) {
        if (created.length >= 5) break; // Max 5 blocks at a time

        const dueDate = new Date(assignment.due_date);
        const now = new Date();

        // Schedule study blocks in the next few days before the due date
        for (let dayOffset = 0; dayOffset < 7 && dayOffset < Math.ceil((dueDate.getTime() - now.getTime()) / 86400000); dayOffset++) {
          if (created.length >= 5) break;

          const targetDay = new Date(now);
          targetDay.setDate(now.getDate() + dayOffset);

          // Try each peak hour
          for (const hour of peakHours) {
            if (created.length >= 5) break;

            const [h, m] = hour.split(":").map(Number);
            const blockStart = new Date(targetDay);
            blockStart.setHours(h, m || 0, 0, 0);

            // Skip if in the past
            if (blockStart < now) continue;

            // Skip if during sleep window
            const sleepH = parseInt(sleepWindow.sleep?.split(":")[0] || "23");
            const wakeH = parseInt(sleepWindow.wake?.split(":")[0] || "8");
            if (h >= sleepH || h < wakeH) continue;

            const blockEnd = new Date(blockStart.getTime() + 60 * 60 * 1000); // 1 hour

            // Check for conflicts with existing blocks
            const hasConflict = (existingBlocks || []).some(
              (eb: { start_time: string; end_time: string }) => {
                const ebStart = new Date(eb.start_time).getTime();
                const ebEnd = new Date(eb.end_time).getTime();
                return (
                  blockStart.getTime() < ebEnd && blockEnd.getTime() > ebStart
                );
              }
            );

            // Also check against just-created blocks
            const hasNewConflict = created.some((c) => {
              const cStart = new Date(c.start).getTime();
              const cEnd = new Date(c.end).getTime();
              return blockStart.getTime() < cEnd && blockEnd.getTime() > cStart;
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
                  title,
                  start: blockStart.toISOString(),
                  end: blockEnd.toISOString(),
                });

                // Try to sync to Google Calendar
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
                  }
                } catch {
                  // Non-critical
                }
              }
              break; // Move to next assignment after scheduling one block
            }
          }
        }
      }

      return {
        scheduled: created.length,
        blocks: created,
        message:
          created.length > 0
            ? `Scheduled ${created.length} study block(s) for your upcoming assignments.`
            : "Could not find available time slots. Try adjusting your peak hours in Settings.",
      };
    }

    default:
      return { error: `Unknown tool: ${name}` };
  }
}
