import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { dualWriteCreate } from "@/lib/solana/dual-write";
import { DataType, type DataTypeValue } from "@/lib/solana/constants";

/** POST — Bulk sync all existing Supabase data to Solana for the current user */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check wallet linked
  const { data: walletLink } = await supabase
    .from("wallet_links")
    .select("wallet_address")
    .eq("user_id", user.id)
    .single();

  if (!walletLink?.wallet_address) {
    return NextResponse.json(
      { error: "No wallet linked" },
      { status: 400 }
    );
  }

  const results = {
    courses: 0,
    assignments: 0,
    grades: 0,
    study_blocks: 0,
    chat_messages: 0,
    email_summaries: 0,
    nudges: 0,
    mood_entries: 0,
    errors: 0,
  };

  // Helper: sync a table
  async function syncTable(
    table: string,
    dataType: DataTypeValue,
    resultKey: keyof typeof results
  ) {
    const { data: rows } = await supabase
      .from(table)
      .select("*")
      .eq("user_id", user!.id)
      .is("solana_index", null)
      .order("created_at", { ascending: true });

    if (!rows) return;

    let index = 0;

    // Get current counter from already-synced records
    const { data: maxRow } = await supabase
      .from(table)
      .select("solana_index")
      .eq("user_id", user!.id)
      .not("solana_index", "is", null)
      .order("solana_index", { ascending: false })
      .limit(1)
      .single();

    index = maxRow ? (maxRow.solana_index as number) + 1 : 0;

    for (const row of rows) {
      // Strip internal fields before sending to chain
      const { id, user_id, solana_index, ...onChainData } = row;

      const result = await dualWriteCreate(
        user!.id,
        dataType,
        index,
        onChainData
      );

      if (result) {
        // Update Supabase with the solana_index
        await supabase
          .from(table)
          .update({ solana_index: index })
          .eq("id", id);

        results[resultKey]++;
        index++;
      } else {
        results.errors++;
      }
    }
  }

  // Sync each table sequentially to maintain counter ordering
  await syncTable("courses", DataType.Course, "courses");
  await syncTable("assignments", DataType.Assignment, "assignments");
  await syncTable("grades", DataType.Grade, "grades");
  await syncTable("study_blocks", DataType.StudyBlock, "study_blocks");
  await syncTable("chat_messages", DataType.Chat, "chat_messages");
  await syncTable("email_summaries", DataType.Email, "email_summaries");
  await syncTable("nudges", DataType.Nudge, "nudges");
  await syncTable("mood_entries", DataType.Mood, "mood_entries");

  return NextResponse.json({
    success: true,
    synced: results,
  });
}
