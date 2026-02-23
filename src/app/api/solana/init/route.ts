import { NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { createClient } from "@/lib/supabase/server";
import {
  buildInitializeStudentIx,
  getBackendKeypair,
  sendServerTransaction,
} from "@/lib/solana/program";

/** POST — Initialize the on-chain student profile for the linked wallet */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get linked wallet
  const { data: walletLink } = await supabase
    .from("wallet_links")
    .select("wallet_address")
    .eq("user_id", user.id)
    .single();

  if (!walletLink?.wallet_address) {
    return NextResponse.json(
      { error: "No wallet linked. Connect a wallet first." },
      { status: 400 }
    );
  }

  // Get profile for name/email
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", user.id)
    .single();

  const keypair = getBackendKeypair();
  if (!keypair) {
    return NextResponse.json(
      { error: "Solana backend keypair not configured" },
      { status: 500 }
    );
  }

  const ownerPubkey = new PublicKey(walletLink.wallet_address);

  try {
    const ix = await buildInitializeStudentIx(
      keypair.publicKey,
      ownerPubkey,
      profile?.full_name || "Student",
      profile?.email || ""
    );

    const txSig = await sendServerTransaction(ix);
    if (!txSig) {
      return NextResponse.json(
        { error: "Transaction failed" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      tx_signature: txSig,
      explorer_url: `https://explorer.solana.com/tx/${txSig}?cluster=devnet`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";

    // If already initialized, that's OK
    if (message.includes("already in use")) {
      return NextResponse.json({
        success: true,
        message: "Student profile already exists on-chain",
      });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
