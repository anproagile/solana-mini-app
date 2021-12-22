// use std::collections::BTreeMap;

use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::{
    account_info::{next_account_info, AccountInfo},
    entrypoint::ProgramResult,
    msg,
    program_error::ProgramError,
    program_option::COption,
    program_pack::Pack,
    pubkey::Pubkey,
};
use spl_token::id;
pub struct Processor;

// use crate::{instruction::Payload, state::Storage};
// Import command module, for parsing instruction_data
use crate::instruction::Command;
// Import state module
use crate::state::GameInfo;

impl Processor {
    pub fn process(
        program_id: &Pubkey,
        accounts: &[AccountInfo],
        instruction_data: &[u8],
    ) -> ProgramResult {
        let instruction = Command::unpack(instruction_data)?;
        match instruction {
            Command::Init => Self::process_init(),
            Command::Register { upline } => Self::process_register(program_id, accounts, upline),
            Command::AddReward { reward_amount } => {
                Self::process_add_reward(program_id, accounts, reward_amount)
            }
            _ => return Err(ProgramError::InvalidInstructionData),
        };
        // let accounts_iter = &mut accounts.iter();
        // let program_account = next_account_info(accounts_iter)?;
        // if *program_account.owner != *program_id {
        //     return Err(ProgramError::IllegalOwner);
        // }
        // let token_account = next_account_info(accounts_iter)?;
        // let token_program = next_account_info(accounts_iter)?;
        // let result = program_account.try_borrow_data()?;
        // msg!("{}", result.len());

        // let mut program_info = GameInfo::unpack_unchecked(&program_account.try_borrow_data()?)?;
        // msg!("{:?}", program_account.signer_key());
        // msg!("{:?}", program_info);
        // program_info.is_initialized = true;
        // program_info.spl_token_account = *token_account.key;
        // GameInfo::pack(program_info, &mut program_account.try_borrow_mut_data()?)?;

        // let deserialized_payload = Payload::try_from_slice(instruction_data).unwrap();
        // let accounts_iter = &mut accounts.iter();
        // let program_account = next_account_info(accounts_iter)?;
        // let mut storage = match Storage::try_from_slice(&program_account.data.borrow()) {
        //     Ok(data) => data,
        //     Err(error) => {
        //         msg!("{}", error.to_string());
        //         // Account not initialized
        //         Storage {
        //             is_initialized: true,
        //             btree_storage: BTreeMap::new(),
        //         }
        //     }
        // };
        // storage
        //     .btree_storage
        //     .insert(deserialized_payload.key, deserialized_payload.value);
        // storage.serialize(&mut &mut program_account.data.borrow_mut()[..])?;
        Ok(())
    }

    pub fn process_add_reward(program_id: &Pubkey, accounts: &[AccountInfo], reward_amount: u128) {
        msg!("Add reward {}", reward_amount);
    }

    pub fn process_init() {
        msg!("Init");
    }

    pub fn process_register(
        program_id: &Pubkey,
        accounts: &[AccountInfo],
        upline: COption<Pubkey>,
    ) {
        msg!("Register");
        match upline {
            COption::Some(upline) => msg!("Upline {}", upline),
            COption::None => msg!("No upline"),
            _ => {}
        }
    }
}
