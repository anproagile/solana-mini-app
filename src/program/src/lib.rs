pub mod error;
pub mod instruction;
pub mod processor;
pub mod state;

// If other solana program import our program, the entrypoint of this program can be switch off at Cargo.toml
#[cfg(not(feature = "no-entrypoint"))]
pub mod entrypoint;
