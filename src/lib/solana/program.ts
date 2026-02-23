import {
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { getConnection } from "./connection";
import { PROGRAM_ID, STUDENT_SEED, DataType, type DataTypeValue } from "./constants";

// ================================================================
// PDA Derivation
// ================================================================

/** Derive the student profile PDA for a given wallet */
export function getStudentPDA(ownerWallet: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [STUDENT_SEED, ownerWallet.toBuffer()],
    PROGRAM_ID
  );
}

/** Derive a data record PDA */
export function getRecordPDA(
  dataType: DataTypeValue,
  ownerWallet: PublicKey,
  index: number
): [PublicKey, number] {
  const indexBuf = Buffer.alloc(4);
  indexBuf.writeUInt32LE(index);
  return PublicKey.findProgramAddressSync(
    [Buffer.from([dataType]), ownerWallet.toBuffer(), indexBuf],
    PROGRAM_ID
  );
}

// ================================================================
// Anchor Discriminator Helpers
// ================================================================

/** Compute Anchor instruction discriminator: first 8 bytes of sha256("global:<name>") */
async function instructionDiscriminator(name: string): Promise<Buffer> {
  const data = new TextEncoder().encode(`global:${name}`);
  const hash = await crypto.subtle.digest("SHA-256", data as unknown as ArrayBuffer);
  return Buffer.from(new Uint8Array(hash).slice(0, 8));
}

// ================================================================
// Borsh Serialization Helpers
// ================================================================

function encodeString(str: string): Buffer {
  const encoded = Buffer.from(str, "utf-8");
  const len = Buffer.alloc(4);
  len.writeUInt32LE(encoded.length);
  return Buffer.concat([len, encoded]);
}

function encodePubkey(pubkey: PublicKey): Buffer {
  return pubkey.toBuffer();
}

function encodeU8(val: number): Buffer {
  return Buffer.from([val]);
}

function encodeU32(val: number): Buffer {
  const buf = Buffer.alloc(4);
  buf.writeUInt32LE(val);
  return buf;
}

function encodeOptionString(val: string | null): Buffer {
  if (val === null) {
    return Buffer.from([0]); // None
  }
  return Buffer.concat([Buffer.from([1]), encodeString(val)]); // Some
}

// ================================================================
// Backend Keypair (server-side only)
// ================================================================

export function getBackendKeypair(): Keypair | null {
  const raw = process.env.SOLANA_BACKEND_KEYPAIR;
  if (!raw) return null;
  try {
    const bytes = JSON.parse(raw) as number[];
    return Keypair.fromSecretKey(Uint8Array.from(bytes));
  } catch {
    return null;
  }
}

// ================================================================
// Instruction Builders
// ================================================================

/** Initialize a student profile on-chain */
export async function buildInitializeStudentIx(
  payer: PublicKey,
  ownerWallet: PublicKey,
  fullName: string,
  email: string
): Promise<TransactionInstruction> {
  const [studentPDA] = getStudentPDA(ownerWallet);
  const disc = await instructionDiscriminator("initialize_student");

  const data = Buffer.concat([
    disc,
    encodePubkey(ownerWallet),
    encodeString(fullName),
    encodeString(email),
  ]);

  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: studentPDA, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
}

/** Update a student profile */
export async function buildUpdateStudentIx(
  payer: PublicKey,
  ownerWallet: PublicKey,
  fullName: string | null,
  email: string | null
): Promise<TransactionInstruction> {
  const [studentPDA] = getStudentPDA(ownerWallet);
  const disc = await instructionDiscriminator("update_student");

  const data = Buffer.concat([
    disc,
    encodeOptionString(fullName),
    encodeOptionString(email),
  ]);

  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: payer, isSigner: true, isWritable: false },
      { pubkey: studentPDA, isSigner: false, isWritable: true },
    ],
    data,
  });
}

/** Create a new data record on-chain */
export async function buildCreateRecordIx(
  payer: PublicKey,
  ownerWallet: PublicKey,
  dataType: DataTypeValue,
  index: number,
  jsonData: string
): Promise<TransactionInstruction> {
  const [studentPDA] = getStudentPDA(ownerWallet);
  const [recordPDA] = getRecordPDA(dataType, ownerWallet, index);
  const disc = await instructionDiscriminator("create_record");

  const data = Buffer.concat([
    disc,
    encodeU8(dataType),
    encodeU32(index),
    encodeString(jsonData),
  ]);

  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: studentPDA, isSigner: false, isWritable: true },
      { pubkey: recordPDA, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
}

/** Update an existing data record */
export async function buildUpdateRecordIx(
  payer: PublicKey,
  ownerWallet: PublicKey,
  dataType: DataTypeValue,
  index: number,
  jsonData: string
): Promise<TransactionInstruction> {
  const [recordPDA] = getRecordPDA(dataType, ownerWallet, index);
  const disc = await instructionDiscriminator("update_record");

  const data = Buffer.concat([
    disc,
    encodeU8(dataType),
    encodeU32(index),
    encodeString(jsonData),
  ]);

  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: payer, isSigner: true, isWritable: false },
      { pubkey: recordPDA, isSigner: false, isWritable: true },
    ],
    data,
  });
}

/** Close (delete) a data record and reclaim rent */
export async function buildCloseRecordIx(
  payer: PublicKey,
  ownerWallet: PublicKey,
  dataType: DataTypeValue,
  index: number
): Promise<TransactionInstruction> {
  const [recordPDA] = getRecordPDA(dataType, ownerWallet, index);
  const disc = await instructionDiscriminator("close_record");

  const data = Buffer.concat([disc, encodeU8(dataType), encodeU32(index)]);

  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: recordPDA, isSigner: false, isWritable: true },
    ],
    data,
  });
}

// ================================================================
// Transaction Sender (server-side)
// ================================================================

/** Send a transaction signed by the backend keypair */
export async function sendServerTransaction(
  ix: TransactionInstruction
): Promise<string | null> {
  const keypair = getBackendKeypair();
  if (!keypair) {
    console.warn("[Solana] No backend keypair configured — skipping on-chain write");
    return null;
  }

  const connection = getConnection();
  const tx = new Transaction().add(ix);
  tx.feePayer = keypair.publicKey;

  try {
    const sig = await sendAndConfirmTransaction(connection, tx, [keypair], {
      commitment: "confirmed",
    });
    return sig;
  } catch (err) {
    console.error("[Solana] Transaction failed:", err);
    return null;
  }
}
