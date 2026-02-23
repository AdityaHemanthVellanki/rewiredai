import { PublicKey } from "@solana/web3.js";
import { createClient } from "@/lib/supabase/server";
import {
  buildCreateRecordIx,
  buildUpdateRecordIx,
  buildCloseRecordIx,
  buildUpdateStudentIx,
  getBackendKeypair,
  sendServerTransaction,
} from "./program";
import { type DataTypeValue } from "./constants";

// ================================================================
// Wallet Lookup
// ================================================================

/** Get the linked wallet address for a Supabase user */
export async function getWalletForUser(
  userId: string
): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("wallet_links")
    .select("wallet_address")
    .eq("user_id", userId)
    .single();
  return data?.wallet_address ?? null;
}

/** Get the current on-chain counter for a data type */
export async function getOnChainCounter(
  walletAddress: string,
  dataType: DataTypeValue
): Promise<number | null> {
  // Read the student profile PDA to get the counter
  // This requires fetching and deserializing the account
  // For now, we use the solana_index from Supabase as the source of truth
  return null;
}

// ================================================================
// Dual-Write Helpers
// ================================================================

/**
 * Fire-and-forget Solana write for a new record.
 * Returns the solana_index used, or null if skipped.
 */
export async function dualWriteCreate(
  userId: string,
  dataType: DataTypeValue,
  solanaIndex: number,
  jsonData: Record<string, unknown>
): Promise<{ txSig: string | null; index: number } | null> {
  try {
    const walletAddress = await getWalletForUser(userId);
    if (!walletAddress) return null;

    const keypair = getBackendKeypair();
    if (!keypair) return null;

    const ownerPubkey = new PublicKey(walletAddress);
    const data = JSON.stringify(jsonData);

    // Truncate if over 4KB
    const truncated = data.length > 4096 ? data.slice(0, 4096) : data;

    const ix = await buildCreateRecordIx(
      keypair.publicKey,
      ownerPubkey,
      dataType,
      solanaIndex,
      truncated
    );

    const txSig = await sendServerTransaction(ix);
    return { txSig, index: solanaIndex };
  } catch (err) {
    console.error("[DualWrite] Create failed:", err);
    return null;
  }
}

/**
 * Fire-and-forget Solana write for updating a record.
 */
export async function dualWriteUpdate(
  userId: string,
  dataType: DataTypeValue,
  solanaIndex: number,
  jsonData: Record<string, unknown>
): Promise<string | null> {
  try {
    const walletAddress = await getWalletForUser(userId);
    if (!walletAddress) return null;

    const keypair = getBackendKeypair();
    if (!keypair) return null;

    const ownerPubkey = new PublicKey(walletAddress);
    const data = JSON.stringify(jsonData);
    const truncated = data.length > 4096 ? data.slice(0, 4096) : data;

    const ix = await buildUpdateRecordIx(
      keypair.publicKey,
      ownerPubkey,
      dataType,
      solanaIndex,
      truncated
    );

    return await sendServerTransaction(ix);
  } catch (err) {
    console.error("[DualWrite] Update failed:", err);
    return null;
  }
}

/**
 * Fire-and-forget Solana close for deleting a record.
 */
export async function dualWriteClose(
  userId: string,
  dataType: DataTypeValue,
  solanaIndex: number
): Promise<string | null> {
  try {
    const walletAddress = await getWalletForUser(userId);
    if (!walletAddress) return null;

    const keypair = getBackendKeypair();
    if (!keypair) return null;

    const ownerPubkey = new PublicKey(walletAddress);

    const ix = await buildCloseRecordIx(
      keypair.publicKey,
      ownerPubkey,
      dataType,
      solanaIndex
    );

    return await sendServerTransaction(ix);
  } catch (err) {
    console.error("[DualWrite] Close failed:", err);
    return null;
  }
}

/**
 * Update the on-chain student profile.
 */
export async function dualWriteUpdateStudent(
  userId: string,
  fullName: string | null,
  email: string | null
): Promise<string | null> {
  try {
    const walletAddress = await getWalletForUser(userId);
    if (!walletAddress) return null;

    const keypair = getBackendKeypair();
    if (!keypair) return null;

    const ownerPubkey = new PublicKey(walletAddress);

    const ix = await buildUpdateStudentIx(
      keypair.publicKey,
      ownerPubkey,
      fullName,
      email
    );

    return await sendServerTransaction(ix);
  } catch (err) {
    console.error("[DualWrite] UpdateStudent failed:", err);
    return null;
  }
}
