use std::collections::BTreeMap;

use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::{
    account_info::{next_account_info, AccountInfo},
    entrypoint::ProgramResult,
    msg,
    pubkey::Pubkey,
};
pub struct Processor;

use crate::{instruction::Payload, state::Storage};

impl Processor {
    pub fn process(
        program_id: &Pubkey,
        accounts: &[AccountInfo],
        instruction_data: &[u8],
    ) -> ProgramResult {
        let deserialized_payload = Payload::try_from_slice(instruction_data).unwrap();
        let accounts_iter = &mut accounts.iter();
        let program_account = next_account_info(accounts_iter)?;
        let mut storage = match Storage::try_from_slice(&program_account.data.borrow()) {
            Ok(data) => data,
            Err(error) => {
                msg!("{}", error.to_string());
                // Account not initialized
                Storage {
                    is_initialized: true,
                    btree_storage: BTreeMap::new(),
                }
            }
        };
        storage
            .btree_storage
            .insert(deserialized_payload.key, deserialized_payload.value);
        storage.serialize(&mut &mut program_account.data.borrow_mut()[..])?;
        Ok(())
    }
}
