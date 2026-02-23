import { PublicKey } from "@solana/web3.js";

/** Program ID — replace after `anchor deploy` */
export const PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_SOLANA_PROGRAM_ID ||
    "6KK7zhdAuZdnom1hAEGEL4iwg66HxsKhhGXaKwDywzmU"
);

/** Data type identifiers — match Rust constants */
export const DataType = {
  Course: 0,
  Assignment: 1,
  Grade: 2,
  StudyBlock: 3,
  Chat: 4,
  Email: 5,
  Nudge: 6,
  Mood: 7,
  Memory: 8,
  Activity: 9,
} as const;

export type DataTypeValue = (typeof DataType)[keyof typeof DataType];

/** PDA seed for student profiles */
export const STUDENT_SEED = Buffer.from("student");
