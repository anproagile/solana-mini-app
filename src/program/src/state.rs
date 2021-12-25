use arrayref::{array_mut_ref, array_ref, array_refs, mut_array_refs};
use solana_program::{
    msg,
    program_error::ProgramError,
    program_option::COption,
    program_pack::{IsInitialized, Pack, Sealed},
    pubkey::Pubkey,
};

#[derive(Debug)]
pub struct GameInfo {
    pub is_initialized: bool, // 1
    // Account authorized to add reward to player
    pub admin: Pubkey, // 32
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
            [0] => false,
            // First element is 1
            [1] => true,
            _ => return Err(ProgramError::InvalidAccountData),
        };
        // Return GameInfo struct, which unpacked from account data
        Ok(GameInfo {
            is_initialized,
            // Dereference owner to get the byte array in heap
            admin: Pubkey::new_from_array(*owner),
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
        let (is_initialized_dst, admin_dst, spl_token_account_dst) =
            mut_array_refs![dst, 1, 32, 32];
        // Destructure GameInfo struct
        let GameInfo {
            is_initialized,
            admin,
            spl_token_account,
        } = self;
        // Since the sliced chunks are mutable, direct modify the chunks content will reflect in account data
        is_initialized_dst[0] = *is_initialized as u8;
        // Convert owner from Pubkey struct to byte array, then copy it into owner_dst
        admin_dst.copy_from_slice(admin.as_ref());
        // Convert spl_token_account from Pubkey struct to byte array, then copy it into spl_token_account_dst
        spl_token_account_dst.copy_from_slice(spl_token_account.as_ref());
    }

    fn unpack_unchecked(input: &[u8]) -> Result<Self, ProgramError> {
        // Closed: Account that didn't rent space / rented space doesn't match the program state should be rejected
        // If the account data is empty, return default value
        // if input.len() == 0 {
        //     return Ok(GameInfo {
        //         is_initialized: false,
        //         admin: Pubkey::new_from_array([0; 32]),
        //         spl_token_account: Pubkey::new_from_array([0; 32]),
        //     });
        // }
        if input.len() != GameInfo::LEN {
            msg!(
                "Invalid account data storage, required size = {}",
                Self::LEN
            );
            return Err(ProgramError::InvalidAccountData);
        }
        Self::unpack_from_slice(input)
    }
}

#[derive(Debug)]
pub struct Player {
    pub is_initialized: bool,    // 1 byte
    pub owner: Pubkey,           // 32 byte
    pub reward_to_claim: u64,    // 8 byte, follow SPL token amount byte
    pub program_account: Pubkey, // 32 byte
    pub upline: COption<Pubkey>, // 4 + 32 byte  msg!("{:?}", size_of::<COption<Pubkey>>()) shows 36
}

impl Sealed for Player {}

impl IsInitialized for Player {
    fn is_initialized(&self) -> bool {
        self.is_initialized
    }
}

impl Pack for Player {
    const LEN: usize = 1 + 32 + 8 + 32 + 4 + 32;
    // Unpack account data (byte buffer) to Player
    fn unpack_from_slice(src: &[u8]) -> Result<Self, ProgramError> {
        // Shadow src argument, and use array_ref! to make src slice-able
        let src = array_ref![src, 0, Player::LEN];
        // Slice src based on struct property byte
        let (is_initialized, owner, reward_to_claim, program_account, has_upline, upline) =
            array_refs![&src, 1, 32, 8, 32, 4, 32];
        // Convert is_initialized from byte to bool
        let is_initialized = match is_initialized {
            // First element is 0
            [0] => false,
            // First element is 1
            [1] => true,
            _ => return Err(ProgramError::InvalidAccountData),
        };
        let upline = match has_upline {
            [0, 0, 0, 0] => COption::None,
            [1, 0, 0, 0] => COption::Some(Pubkey::new_from_array(*upline)),
            _ => return Err(ProgramError::InvalidAccountData),
        };
        // Return Player struct, which unpacked from account data
        Ok(Player {
            is_initialized,
            // Dereference owner to get the byte array in heap
            owner: Pubkey::new_from_array(*owner),
            reward_to_claim: u64::from_le_bytes(*reward_to_claim),
            program_account: Pubkey::new_from_array(*program_account),
            upline,
        })
    }

    // Pack Player struct into account data (byte buffer)
    fn pack_into_slice(&self, dst: &mut [u8]) {
        // Shadow dst argument, and make it slice-able
        let dst = array_mut_ref![dst, 0, Player::LEN];
        // Slice dst into mutable byte chunks
        // Added _dst postfix to avoid shadowing when destructure from Player struct
        let (
            is_initialized_dst,
            owner_dst,
            reward_to_claim_dst,
            program_account_dst,
            has_upline_dst,
            upline_dst,
        ) = mut_array_refs![dst, 1, 32, 8, 32, 4, 32];
        // Destructure Player struct
        let Player {
            is_initialized,
            owner,
            reward_to_claim,
            program_account,
            upline,
        } = self;
        // Since the sliced chunks are mutable, direct modify the chunks content will reflect in account data
        is_initialized_dst[0] = *is_initialized as u8;
        // Convert owner from Pubkey struct to byte array, then copy it into owner_dst
        owner_dst.copy_from_slice(owner.as_ref());
        // Convert reward_to_chain to byte array, then copy it into reward_to_claim_dst
        reward_to_claim_dst.copy_from_slice(&reward_to_claim.to_le_bytes());
        program_account_dst.copy_from_slice(&program_account.as_ref());
        match upline {
            COption::None => has_upline_dst.copy_from_slice(&[0, 0, 0, 0]),
            COption::Some(pubkey) => {
                has_upline_dst.copy_from_slice(&[1, 0, 0, 0]);
                upline_dst.copy_from_slice(pubkey.as_ref());
            }
        }
    }

    fn unpack_unchecked(input: &[u8]) -> Result<Self, ProgramError> {
        // Closed: Account that didn't rent space / rented space doesn't match the program state should be rejected
        // If the account data is empty, return default value
        // if input.len() == 0 {
        //     return Ok(GameInfo {
        //         is_initialized: false,
        //         admin: Pubkey::new_from_array([0; 32]),
        //         spl_token_account: Pubkey::new_from_array([0; 32]),
        //     });
        // }
        if input.len() != Player::LEN {
            msg!(
                "Invalid account data storage, required size = {}",
                Self::LEN
            );
            return Err(ProgramError::InvalidAccountData);
        }
        Self::unpack_from_slice(input)
    }
}
