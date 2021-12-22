use arrayref::array_ref;
use borsh::BorshDeserialize;
use solana_program::{msg, program_error::ProgramError, program_option::COption, pubkey::Pubkey};

// #[derive(BorshDeserialize, Debug)]
// pub struct Payload {
//     pub choice: u8,
//     pub key: String,
//     pub value: String,
// }

#[derive(Debug)]
pub enum Command {
    // Start initialize the program account
    // tag = 0
    // 0 - [signer]   - The admin (holder) account
    // 1 - [writable] - Program account
    // 2 - [writable] - An token account created by the admin, and pre-funded
    // 3 - []         - The token program
    Init,

    // User register themselves to the program
    // tag = 1
    // 0 - [signer]   - The player (holder) account
    // 1 - [writable] - The player account for the program
    Register { upline: COption<Pubkey> },

    // Admin add reward to player
    // tag = 2
    // 0 - [signer]   - The admin (holder) account
    // 1 - [writable] - The player program account
    // 2 - [writable] - The player upline program account
    AddReward { reward_amount: u128 },
}

impl Command {
    pub fn unpack(input: &[u8]) -> Result<Self, ProgramError> {
        // Get the first byte, which = command user wish to execute
        let (tag, rest) = input
            .split_first()
            .ok_or(ProgramError::InvalidInstructionData)?;
        Ok(match tag {
            0 => Self::Init, // use statement instead of return, which terminate the function. The Self::Init will be passed into Ok enum return return by unpack function
            1 => {
                let (upline, _rest) = Self::unpack_pubkey_option(rest)?;
                Self::Register { upline }
            }
            2 => {
                // Get 16 bytes (u128)
                // Borsh serialization is little endian, therefore use from_le_bytes
                let reward_amount = u128::from_le_bytes(rest[0..16].try_into().unwrap());
                Self::AddReward { reward_amount }
            }
            _ => return Err(ProgramError::InvalidInstructionData), // early return the unpack function with Err, instead of returning the Err as argument for Ok
        })
    }

    // Assume the received byte buffer, the starting of it will be COption<Pubkey>
    // When COption being serialized, 1st byte will indicate it is Option::None or Option::Some
    // The following 32 bytes will be the Pubkey
    // Return tuple, which consists of COption<Pubkey> and the rest of the byte in &[u8]
    pub fn unpack_pubkey_option(input: &[u8]) -> Result<(COption<Pubkey>, &[u8]), ProgramError> {
        match input.split_first() {
            // 1st byte is 0
            Option::Some((&0, rest)) => Ok((COption::None, rest)),
            // 1st byte is 1
            Option::Some((&1, rest)) => {
                // Take 32 bytes after the indication byte, the following byte after the public key will shadow the rest variable in argument
                let (pub_key, rest) = rest.split_at(32);
                // Create PubKey instance
                let pk = Pubkey::new(pub_key);
                Ok((COption::Some(pk), rest))
            }
            _ => Err(ProgramError::InvalidInstructionData),
        }
    }
}
