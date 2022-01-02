use num_derive::FromPrimitive;
use solana_program::{decode_error::DecodeError, program_error::ProgramError};
use thiserror::Error;

#[derive(Clone, Debug, Eq, Error, FromPrimitive, PartialEq)]
pub enum CommandError {
    // Invalid command from instruction
    #[error("Invalid command")]
    InvalidCommand,
}

#[derive(Clone, Debug, Eq, Error, FromPrimitive, PartialEq)]
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

    #[error("Unclaimable amount")]
    UnclaimableAmount,

    #[error("Upline cannot be yourself")]
    SelfRecursiveUpline,
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

impl<T> DecodeError<T> for CommandError {
    fn type_of() -> &'static str {
        "CommandError"
    }
}

impl<T> DecodeError<T> for GameError {
    fn type_of() -> &'static str {
        "GameError"
    }
}
