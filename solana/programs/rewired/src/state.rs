use anchor_lang::prelude::*;

/// Student profile — one per wallet address.
/// Stores identity info and per-type counters used to derive record PDAs.
#[account]
#[derive(InitSpace)]
pub struct StudentProfile {
    /// The user's wallet public key (used in PDA seeds)
    pub owner: Pubkey,

    /// Display name
    #[max_len(64)]
    pub full_name: String,

    /// Email address
    #[max_len(128)]
    pub email: String,

    /// Per-data-type counters: [course, assignment, grade, study_block,
    /// chat, email, nudge, mood, memory, activity]
    /// Each counter is incremented when a new record of that type is created.
    pub counters: [u32; 10],

    /// Unix timestamp of profile creation
    pub created_at: i64,

    /// Unix timestamp of last update
    pub updated_at: i64,

    /// PDA bump seed
    pub bump: u8,
}

/// Generic data record — stores any data type as a JSON string.
/// PDA seeds: [data_type_byte, owner_pubkey, index_le_bytes]
#[account]
#[derive(InitSpace)]
pub struct DataRecord {
    /// The user's wallet public key (matches StudentProfile.owner)
    pub owner: Pubkey,

    /// Data type identifier (0-9, see constants.rs)
    pub data_type: u8,

    /// Sequential index within this data type for this user
    pub index: u32,

    /// JSON-serialized data blob (max 4096 bytes)
    #[max_len(4096)]
    pub data: String,

    /// Unix timestamp of record creation
    pub created_at: i64,

    /// Unix timestamp of last update
    pub updated_at: i64,

    /// PDA bump seed
    pub bump: u8,
}
