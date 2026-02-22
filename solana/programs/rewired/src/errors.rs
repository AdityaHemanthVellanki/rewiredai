use anchor_lang::prelude::*;

#[error_code]
pub enum RewiredError {
    #[msg("String exceeds maximum allowed length")]
    StringTooLong,

    #[msg("Data blob exceeds maximum allowed length (4096 bytes)")]
    DataTooLong,

    #[msg("Invalid data type (must be 0-9)")]
    InvalidDataType,

    #[msg("Record index does not match the expected counter value")]
    InvalidIndex,

    #[msg("Unauthorized operation")]
    Unauthorized,
}
