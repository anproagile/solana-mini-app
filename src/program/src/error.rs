use solana_program::program_error::ProgramError;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum CommandError {
    // Invalid command from instruction
    #[error("Invalid command")]
    InvalidCommand,
}

#[derive(Error, Debug)]
pub enum GameError {
    // The program account already initialized
    #[error("Program already initialized")]
    AlreadyInitialize,

    // The program account not initialized
    #[error("Program not initialized")]
    NotInitialize,

    #[error("Reward amount overflow")]
    RewardAmountOverflow,

    #[error("Invalid upline")]
    InvalidUpline,
}

// Implement conversion for GameError to ProgramError
impl From<GameError> for ProgramError {
    fn from(e: GameError) -> Self {
        ProgramError::Custom(e as u32)
    }
}

impl From<CommandError> for ProgramError {
    fn from(e: CommandError) -> Self {
        ProgramError::Custom(e as u32)
    }
}
