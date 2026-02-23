import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { dualWriteUpdate } from "@/lib/solana/dual-write";
import { DataType } from "@/lib/solana/constants";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  let query = supabase
    .from("nudges")
    .select("*, assignment:assignments(*)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  if (status) query = query.eq("status", status);

  const { data: nudges, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ nudges });
}

export async function PUT(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();

  // Get solana_index before updating
  const { data: existing } = await supabase
    .from("nudges")
    .select("solana_index")
    .eq("id", body.id)
    .eq("user_id", user.id)
    .single();

  const { error } = await supabase
    .from("nudges")
    .update({ status: body.status })
    .eq("id", body.id)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Update on-chain record
  if (existing?.solana_index != null) {
    dualWriteUpdate(user.id, DataType.Nudge, existing.solana_index, {
      status: body.status,
    }).catch(console.error);
  }

  return NextResponse.json({ success: true });
}
