import { createClient } from "@/lib/supabase/server";
import { getAzureOpenAI } from "@/lib/azure-openai";
import { buildSystemPrompt } from "@/lib/agent/system-prompt";
import { agentTools } from "@/lib/agent/tools";
import { NextResponse } from "next/server";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import type { Profile } from "@/types";

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

        // Tool execution loop
        let continueLoop = true;
        while (continueLoop) {
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

            // Handle content
            if (delta?.content) {
              fullResponse += delta.content;
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ content: delta.content })}\n\n`
                )
              );
            }

            // Handle tool calls
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

          // If there are tool calls, execute them and continue
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
              const result = await executeToolCall(
                tc.function.name,
                JSON.parse(tc.function.arguments || "{}"),
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

      return { created: true, studyBlock: data };
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

    default:
      return { error: `Unknown tool: ${name}` };
  }
}
