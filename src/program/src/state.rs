// use std::collections::{BTreeMap, HashMap};

use arrayref::{array_mut_ref, array_ref, array_refs, mut_array_refs};
use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::{
    program_error::ProgramError,
    program_pack::{IsInitialized, Pack, Sealed},
    pubkey::Pubkey,
};

// struct Player {
//     address upline;
//     uint256 reward;
//     uint256 rewardFromDownlines;
//     address[] downlines;
// }
// mapping(address => Player) playerMapping;

// Every holder have their account for the contract to save state, we can think it as scope by holder
// #[derive(BorshSerialize, BorshDeserialize, Debug)]
// pub struct Storage {
//     pub is_initialized: bool,
//     pub btree_storage: BTreeMap<String, String>,
// }

#[derive(BorshDeserialize, BorshSerialize, Debug)]
pub struct GameInfo {
    pub is_initialized: bool, // 1
    // Account authorized to add reward to player
    pub owner: Pubkey, // 32
    // Token account which has been pre-funded
    pub spl_token_account: Pubkey, // 32
}

// Pack expect Sealed and IsInitialized
// Sealed = Rust version of Sized trait, allow constant size known at compile time
// IsInitialized is for unpack_from_unchecked, which is useful for initialization
impl Sealed for GameInfo {}

impl IsInitialized for GameInfo {
    fn is_initialized(&self) -> bool {
        self.is_initialized
    }
}

impl Pack for GameInfo {
    const LEN: usize = 1 + 32 + 32;
    // Unpack account data (byte buffer) to GameInfo
    fn unpack_from_slice(src: &[u8]) -> Result<Self, ProgramError> {
        // Shadow src argument, and use array_ref! to make src slice-able
        let src = array_ref![src, 0, GameInfo::LEN];
        // Slice src based on struct property byte
        let (is_initialized, owner, spl_token_account) = array_refs![&src, 1, 32, 32];
        // Convert is_initialized from byte to bool
        let is_initialized = match is_initialized {
            // First element is 0
            [0] => true,
            // First element is 1
            [1] => false,
            _ => return Err(ProgramError::InvalidAccountData),
        };
        // Return GameInfo struct, which unpacked from account data
        Ok(GameInfo {
            is_initialized,
            // Dereference owner to get the byte array in heap
            owner: Pubkey::new_from_array(*owner),
            // Dereference spl_token_account to get the byte array in heap
            spl_token_account: Pubkey::new_from_array(*spl_token_account),
        })
    }

    // Pack GameInfo struct into account data (byte buffer)
    fn pack_into_slice(&self, dst: &mut [u8]) {
        // Shadow dst argument, and make it slice-able
        let dst = array_mut_ref![dst, 0, GameInfo::LEN];
        // Slice dst into mutable byte chunks
        // Added _dst postfix to avoid shadowing when destructure from GameInfo struct
        let (is_initialized_dst, owner_dst, spl_token_account_dst) =
            mut_array_refs![dst, 1, 32, 32];
        // Destructure GameInfo struct
        let GameInfo {
            is_initialized,
            owner,
            spl_token_account,
        } = self;
        // Since the sliced chunks are mutable, direct modify the chunks content will reflect in account data
        is_initialized_dst[0] = *is_initialized as u8;
        // Convert owner from Pubkey struct to byte array, then copy it into owner_dst
        owner_dst.copy_from_slice(owner.as_ref());
        // Convert spl_token_account from Pubkey struct to byte array, then copy it into spl_token_account_dst
        spl_token_account_dst.copy_from_slice(spl_token_account.as_ref());
    }

    fn unpack_unchecked(input: &[u8]) -> Result<Self, ProgramError> {
        // If the account data is empty, return default value
        if input.len() == 0 {
            return Ok(GameInfo {
                is_initialized: false,
                owner: Pubkey::new_from_array([0; 32]),
                spl_token_account: Pubkey::new_from_array([0; 32]),
            });
        }
        if input.len() != GameInfo::LEN {
            return Err(ProgramError::InvalidAccountData);
        }
        Self::unpack_from_slice(input)
    }
}

#[derive(BorshSerialize, BorshDeserialize, Debug)]
pub struct Player {
    pub owner: Pubkey,
    pub reward_to_claim: u128,
    pub upline: Pubkey,
}
