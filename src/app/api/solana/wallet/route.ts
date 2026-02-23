import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** POST — Link a wallet address to the current user */
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { wallet_address } = await req.json();
  if (!wallet_address || typeof wallet_address !== "string") {
    return NextResponse.json(
      { error: "wallet_address is required" },
      { status: 400 }
    );
  }

  // Upsert — one wallet per user
  const { data, error } = await supabase
    .from("wallet_links")
    .upsert(
      { user_id: user.id, wallet_address },
      { onConflict: "user_id" }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ wallet: data });
}

/** DELETE — Unlink the wallet from the current user */
export async function DELETE() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { error } = await supabase
    .from("wallet_links")
    .delete()
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

/** GET — Get the linked wallet for the current user */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data } = await supabase
    .from("wallet_links")
    .select("*")
    .eq("user_id", user.id)
    .single();

  return NextResponse.json({ wallet: data ?? null });
}
