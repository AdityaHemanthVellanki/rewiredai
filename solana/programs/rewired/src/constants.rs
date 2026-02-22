/// PDA seed for student profiles
pub const STUDENT_SEED: &[u8] = b"student";

/// Maximum length for the student full_name field
pub const MAX_NAME_LEN: usize = 64;

/// Maximum length for the student email field
pub const MAX_EMAIL_LEN: usize = 128;

/// Maximum length for the JSON data blob in DataRecord
pub const MAX_DATA_LEN: usize = 4096;

/// Number of supported data types
pub const DATA_TYPE_COUNT: usize = 10;

// Data type identifiers (used as first byte in record PDA seeds)
// 0 = course
// 1 = assignment
// 2 = grade
// 3 = study_block
// 4 = chat
// 5 = email
// 6 = nudge
// 7 = mood
// 8 = memory
// 9 = activity
