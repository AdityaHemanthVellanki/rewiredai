import { createClient } from "@/lib/supabase/server";
import { getGoogleAccessToken } from "@/lib/google/auth";
import { fetchRecentEmails } from "@/lib/google/gmail";
import { getAzureOpenAI } from "@/lib/azure-openai";
import { NextResponse } from "next/server";
import { dualWriteCreate } from "@/lib/solana/dual-write";
import { DataType } from "@/lib/solana/constants";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accessToken = await getGoogleAccessToken(user.id);
  if (!accessToken) {
    return NextResponse.json(
      {
        error:
          "Google token expired or missing. Please log out and log back in with Google.",
      },
      { status: 400 }
    );
  }

  // Fetch emails
  let emails;
  try {
    emails = await fetchRecentEmails(accessToken, 20);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to fetch emails";

    // Common: Gmail API not enabled in Google Cloud Console
    if (message.includes("403") || message.includes("Forbidden")) {
      return NextResponse.json(
        {
          error:
            "Gmail API access denied. Make sure the Gmail API is enabled in your Google Cloud Console.",
        },
        { status: 403 }
      );
    }

    if (message.includes("401") || message.includes("Unauthorized")) {
      return NextResponse.json(
        {
          error:
            "Google token expired. Please log out and log back in with Google.",
        },
        { status: 401 }
      );
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }

  if (!emails.length) {
    return NextResponse.json({
      processed: 0,
      summaries: [],
      debug:
        "Gmail API returned 0 emails. Your inbox may be empty, or the Gmail API scope wasn't granted during login. Try logging out and back in with Google.",
    });
  }

  // Use AI to categorize and summarize each email
  const client = getAzureOpenAI();
  const summaries = [];
  let skipped = 0;

  for (const email of emails) {
    // Check if already processed
    const { data: existing } = await supabase
      .from("email_summaries")
      .select("id")
      .eq("user_id", user.id)
      .eq("gmail_message_id", email.id)
      .single();

    if (existing) {
      skipped++;
      continue;
    }

    try {
      const response = await client.chat.completions.create({
        model: process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are an email classifier for a college student. Analyze this email and return JSON:
{
  "summary": "1-3 sentence plain English summary",
  "category": "professor|financial_aid|campus_admin|clubs|spam|personal",
  "priority_score": 1-10,
  "action_required": boolean,
  "suggested_action": "string or null",
  "action_due_date": "ISO date string or null",
  "has_deadline": boolean,
  "deadline_title": "string or null",
  "deadline_date": "ISO date string or null"
}`,
          },
          {
            role: "user",
            content: `From: ${email.from}\nSubject: ${email.subject}\nDate: ${email.date}\n\nBody:\n${email.body.substring(0, 2000)}`,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
      });

      const analysis = JSON.parse(
        response.choices[0]?.message?.content || "{}"
      );

      // Save email summary
      const { data: summary } = await supabase
        .from("email_summaries")
        .insert({
          user_id: user.id,
          gmail_message_id: email.id,
          sender: email.from,
          subject: email.subject,
          summary: analysis.summary || email.snippet,
          category: analysis.category || "personal",
          priority_score: analysis.priority_score || 5,
          action_required: analysis.action_required || false,
          suggested_action: analysis.suggested_action || null,
          action_due_date: analysis.action_due_date || null,
          received_at: new Date(email.date).toISOString(),
        })
        .select()
        .single();

      if (summary) {
        summaries.push(summary);
        // Dual-write to Solana (fire-and-forget)
        const { id: summaryId, user_id, solana_index, ...onChainData } = summary;
        const { count } = await supabase
          .from("email_summaries")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id)
          .not("solana_index", "is", null);
        const nextIndex = count ?? 0;
        dualWriteCreate(user.id, DataType.Email, nextIndex, onChainData)
          .then((result) => {
            if (result) {
              supabase.from("email_summaries").update({ solana_index: result.index }).eq("id", summaryId).then(() => {});
            }
          })
          .catch(console.error);
      }

      // If deadline detected, auto-create assignment
      if (analysis.has_deadline && analysis.deadline_date) {
        await supabase.from("assignments").insert({
          user_id: user.id,
          title: analysis.deadline_title || `Deadline from: ${email.subject}`,
          due_date: analysis.deadline_date,
          source: "email",
          description: `Extracted from email: ${email.subject}`,
        });
      }
    } catch {
      // Skip this email if AI processing fails
    }
  }

  return NextResponse.json({
    processed: summaries.length,
    skipped,
    totalFetched: emails.length,
    summaries,
  });
}
