use anchor_lang::prelude::*;

mod constants;
mod errors;
mod state;

use constants::*;
use errors::*;
use state::*;

// IMPORTANT: Replace with your actual program ID after running `anchor build`.
// Run `solana address -k target/deploy/rewired-keypair.json` to get the ID.
declare_id!("6KK7zhdAuZdnom1hAEGEL4iwg66HxsKhhGXaKwDywzmU");

#[program]
pub mod rewired {
    use super::*;

    // ================================================================
    // Student Profile
    // ================================================================

    /// Create a new on-chain student profile.
    /// Called once when the user first links their wallet.
    pub fn initialize_student(
        ctx: Context<InitializeStudent>,
        owner: Pubkey,
        full_name: String,
        email: String,
    ) -> Result<()> {
        require!(full_name.len() <= MAX_NAME_LEN, RewiredError::StringTooLong);
        require!(email.len() <= MAX_EMAIL_LEN, RewiredError::StringTooLong);

        let student = &mut ctx.accounts.student;
        student.owner = owner;
        student.full_name = full_name;
        student.email = email;
        student.counters = [0u32; 10];
        student.created_at = Clock::get()?.unix_timestamp;
        student.updated_at = Clock::get()?.unix_timestamp;
        student.bump = ctx.bumps.student;

        Ok(())
    }

    /// Update the student profile fields.
    pub fn update_student(
        ctx: Context<UpdateStudent>,
        full_name: Option<String>,
        email: Option<String>,
    ) -> Result<()> {
        let student = &mut ctx.accounts.student;

        if let Some(name) = full_name {
            require!(name.len() <= MAX_NAME_LEN, RewiredError::StringTooLong);
            student.full_name = name;
        }
        if let Some(e) = email {
            require!(e.len() <= MAX_EMAIL_LEN, RewiredError::StringTooLong);
            student.email = e;
        }
        student.updated_at = Clock::get()?.unix_timestamp;

        Ok(())
    }

    // ================================================================
    // Generic Data Records
    // ================================================================

    /// Create a new data record of the given type.
    /// The `index` must match the current counter for that type (prevents gaps).
    pub fn create_record(
        ctx: Context<CreateRecord>,
        data_type: u8,
        index: u32,
        data: String,
    ) -> Result<()> {
        require!(
            (data_type as usize) < DATA_TYPE_COUNT,
            RewiredError::InvalidDataType
        );
        require!(data.len() <= MAX_DATA_LEN, RewiredError::DataTooLong);

        let student = &mut ctx.accounts.student;

        // Validate that the caller is using the correct next index
        require!(
            index == student.counters[data_type as usize],
            RewiredError::InvalidIndex
        );

        let record = &mut ctx.accounts.record;
        record.owner = student.owner;
        record.data_type = data_type;
        record.index = index;
        record.data = data;
        record.created_at = Clock::get()?.unix_timestamp;
        record.updated_at = Clock::get()?.unix_timestamp;
        record.bump = ctx.bumps.record;

        // Increment the counter for this data type
        student.counters[data_type as usize] += 1;

        Ok(())
    }

    /// Update the JSON data of an existing record.
    pub fn update_record(
        ctx: Context<UpdateRecord>,
        _data_type: u8,
        _index: u32,
        data: String,
    ) -> Result<()> {
        require!(data.len() <= MAX_DATA_LEN, RewiredError::DataTooLong);

        let record = &mut ctx.accounts.record;
        record.data = data;
        record.updated_at = Clock::get()?.unix_timestamp;

        Ok(())
    }

    /// Close a data record and reclaim the rent SOL.
    pub fn close_record(
        _ctx: Context<CloseRecord>,
        _data_type: u8,
        _index: u32,
    ) -> Result<()> {
        // The `close` attribute on the account handles the lamport transfer
        Ok(())
    }
}

// ================================================================
// Account Contexts
// ================================================================

#[derive(Accounts)]
#[instruction(owner: Pubkey)]
pub struct InitializeStudent<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        init,
        payer = payer,
        space = 8 + StudentProfile::INIT_SPACE,
        seeds = [STUDENT_SEED, owner.as_ref()],
        bump
    )]
    pub student: Account<'info, StudentProfile>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateStudent<'info> {
    pub payer: Signer<'info>,

    #[account(
        mut,
        seeds = [STUDENT_SEED, student.owner.as_ref()],
        bump = student.bump,
    )]
    pub student: Account<'info, StudentProfile>,
}

#[derive(Accounts)]
#[instruction(data_type: u8, index: u32)]
pub struct CreateRecord<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        mut,
        seeds = [STUDENT_SEED, student.owner.as_ref()],
        bump = student.bump,
    )]
    pub student: Account<'info, StudentProfile>,

    #[account(
        init,
        payer = payer,
        space = 8 + DataRecord::INIT_SPACE,
        seeds = [&[data_type], student.owner.as_ref(), &index.to_le_bytes()],
        bump
    )]
    pub record: Account<'info, DataRecord>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(data_type: u8, index: u32)]
pub struct UpdateRecord<'info> {
    pub payer: Signer<'info>,

    #[account(
        mut,
        seeds = [&[data_type], record.owner.as_ref(), &index.to_le_bytes()],
        bump = record.bump,
    )]
    pub record: Account<'info, DataRecord>,
}

#[derive(Accounts)]
#[instruction(data_type: u8, index: u32)]
pub struct CloseRecord<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        mut,
        close = payer,
        seeds = [&[data_type], record.owner.as_ref(), &index.to_le_bytes()],
        bump = record.bump,
    )]
    pub record: Account<'info, DataRecord>,
}
