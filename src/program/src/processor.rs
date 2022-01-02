use solana_program::{
    account_info::{next_account_info, AccountInfo},
    entrypoint::ProgramResult,
    msg,
    program::{invoke, invoke_signed},
    program_error::ProgramError,
    program_option::COption,
    program_pack::Pack,
    pubkey::Pubkey,
};
pub struct Processor;

// Import command module, for parsing instruction_data
use crate::instruction::Command;
// Import state module
use crate::error::GameError;
use crate::state::{GameInfo, Player};

const PDA_SEED: &str = "game_seed";

impl Processor {
    pub fn process(
        program_id: &Pubkey,
        accounts: &[AccountInfo],
        instruction_data: &[u8],
    ) -> ProgramResult {
        let instruction = Command::unpack(instruction_data)?;
        match instruction {
            Command::Init => Self::process_init(program_id, accounts),
            Command::Register => Self::process_register(program_id, accounts),
            Command::AddReward { reward_amount } => {
                Self::process_add_reward(program_id, accounts, reward_amount)
            }
            Command::Claim => Self::process_claim_reward(program_id, accounts),
        }
    }

    // 0 - [signer]   - The player (holder) account
    // 1 - []         - Program account
    // 2 - [writable] - The player program account
    // 3 - []         - The token account of the current program
    // 4-  []         - The PDA, owner (in term of token, not account owner) of token account
    // 5 - []         - The player token account
    // 6 - []         - The token program
    pub fn process_claim_reward(program_id: &Pubkey, accounts: &[AccountInfo]) -> ProgramResult {
        msg!("process_claim_reward");
        let account_iter = &mut accounts.iter();
        let player_holder_account = next_account_info(account_iter)?;

        // Make sure signature for player who claim the reward is provided
        if !player_holder_account.is_signer {
            msg!("Player program account must be signed");
            return Err(ProgramError::MissingRequiredSignature);
        }

        let program_account = next_account_info(account_iter)?;

        // Make sure program account owner is the current program
        if program_account.owner != program_id {
            msg!("Program account owner is not current program");
            return Err(ProgramError::IncorrectProgramId);
        }

        let program_account_data = GameInfo::unpack(&program_account.try_borrow_data()?)?;
        let player_program_account = next_account_info(account_iter)?;

        // Make sure player program account owner is the current program
        if player_program_account.owner != program_id {
            msg!("Player program account owner is not current program");
            return Err(ProgramError::IncorrectProgramId);
        }

        let mut player_program_account_data =
            Player::unpack(&player_program_account.try_borrow_data()?)?;

        // Make sure player program account owned by signer
        if player_program_account_data.owner != *player_holder_account.key {
            msg!("Player program account do not belongs to signer");
            return Err(ProgramError::MissingRequiredSignature);
        }

        // Make sure there's reward to claim
        if player_program_account_data.reward_to_claim == 0 {
            msg!("No reward to claim");
            return Err(GameError::UnclaimableAmount.into());
        }

        let program_token_account = next_account_info(account_iter)?;
        let pda_account = next_account_info(account_iter)?;

        // When init, program_token_account ownership (not account owner) has been transfer to pda (an account without private key)
        let (pda, nonce) = Pubkey::find_program_address(&[PDA_SEED.as_bytes()], program_id);

        // Make sure it is the token account used during the program initialization
        if *program_token_account.key != program_account_data.spl_token_account {
            msg!("Program token account do not match with current program token account");
            return Err(ProgramError::InvalidAccountData);
        }

        let player_token_account = next_account_info(account_iter)?;
        // No need to check player_token_account owner == spl_token::id(), if invalid owner, program will panic when do transfer
        let token_program = next_account_info(account_iter)?;
        if !spl_token::check_id(token_program.key) {
            msg!("Token program is not SPL TOKEN program");
            return Err(ProgramError::IncorrectProgramId);
        }

        //https://docs.rs/spl-token/3.2.0/spl_token/instruction/fn.transfer.html
        let transfer_to_player_instruction = spl_token::instruction::transfer(
            &spl_token::id(),
            program_token_account.key,
            player_token_account.key,
            &pda,
            &[&pda],
            player_program_account_data.reward_to_claim,
        )?;

        msg!("Claim reward by transfer from program token account to the player");
        // All account involved in the instruction need to be passed when invoke
        invoke_signed(
            &transfer_to_player_instruction,
            &[
                program_token_account.clone(),
                player_token_account.clone(),
                token_program.clone(),
                pda_account.clone(),
            ],
            &[&[PDA_SEED.as_bytes(), &[nonce]]],
        )?;

        // After transfer, reset reward amount for player
        player_program_account_data.reward_to_claim = 0;

        Player::pack(
            player_program_account_data,
            &mut player_program_account.try_borrow_mut_data()?,
        )?;

        Ok(())
    }

    // 0 - [signer]   - The admin (holder) account
    // 1 - []         - Program account
    // 2 - [writable] - The player program account
    // 3 - [writable] - The player upline program account
    pub fn process_add_reward(
        program_id: &Pubkey,
        accounts: &[AccountInfo],
        reward_amount: u64,
    ) -> ProgramResult {
        msg!("process_add_reward");
        let account_iter = &mut accounts.iter();
        let admin_holder_account = next_account_info(account_iter)?;

        if !admin_holder_account.is_signer {
            msg!("Admin account must be signed");
            return Err(ProgramError::IllegalOwner);
        }

        let program_account = next_account_info(account_iter)?;
        if program_account.owner != program_id {
            msg!("Program account owner is not the current program");
            return Err(ProgramError::IncorrectProgramId);
        }

        let player_program_account = next_account_info(account_iter)?;
        if player_program_account.owner != program_id {
            msg!("Player program account owner is not the current program");
            return Err(ProgramError::IncorrectProgramId);
        }

        let program_account_data = GameInfo::unpack_unchecked(&program_account.try_borrow_data()?)?;
        if !program_account_data.is_initialized {
            msg!("Program account not initialized");
            return Err(GameError::NotInitialize.into());
        }

        if program_account_data.admin != *admin_holder_account.key {
            msg!("Add reward only can be executed by admin");
            return Err(ProgramError::MissingRequiredSignature);
        }

        let mut player_program_account_data =
            Player::unpack_unchecked(&player_program_account.try_borrow_data()?)?;

        if !player_program_account_data.is_initialized {
            msg!("Player program account is not initialized");
            return Err(GameError::NotInitialize.into());
        }

        if player_program_account_data.upline != COption::None {
            let upline_player_program_account = next_account_info(account_iter)?;

            if upline_player_program_account.owner != program_id {
                msg!("Upline program account owner is not current program");
                return Err(ProgramError::IncorrectProgramId);
            }

            let mut upline_player_program_account_data =
                Player::unpack_unchecked(&upline_player_program_account.try_borrow_data()?)?;

            if !upline_player_program_account_data.is_initialized {
                msg!("Upline player program account is not initialized");
                return Err(GameError::NotInitialize.into());
            }

            if *upline_player_program_account.key != player_program_account_data.upline.unwrap() {
                msg!("Upline account passed was not current player upline");
                return Err(GameError::InvalidUpline.into());
            }

            let upline_reward = reward_amount * 10 / 100;
            let player_reward = reward_amount * 90 / 100;

            player_program_account_data.reward_to_claim =
                u64::checked_add(player_program_account_data.reward_to_claim, player_reward)
                    .ok_or(GameError::RewardAmountOverflow)?;

            upline_player_program_account_data.reward_to_claim = u64::checked_add(
                upline_player_program_account_data.reward_to_claim,
                upline_reward,
            )
            .ok_or(GameError::RewardAmountOverflow)?;

            msg!("Player reward {}", player_reward);
            Player::pack(
                player_program_account_data,
                &mut player_program_account.try_borrow_mut_data()?,
            )?;

            msg!("Upline reward {}", upline_reward);
            Player::pack(
                upline_player_program_account_data,
                &mut upline_player_program_account.try_borrow_mut_data()?,
            )?;
        } else {
            player_program_account_data.reward_to_claim =
                u64::checked_add(player_program_account_data.reward_to_claim, reward_amount)
                    .ok_or(GameError::RewardAmountOverflow)?;

            Player::pack(
                player_program_account_data,
                &mut player_program_account.try_borrow_mut_data()?,
            )?;
        }

        // msg!("Add reward {}", reward_amount);
        Ok(())
    }

    // 0 - [signer]   - The admin (holder) account
    // 1 - [writable] - Program account
    // 2 - [writable] - An token account created by the admin, and pre-funded
    // 3 - []         - The token program
    pub fn process_init(program_id: &Pubkey, accounts: &[AccountInfo]) -> ProgramResult {
        msg!("process_init");
        // Make the account info array iterable
        let account_iter = &mut accounts.iter();
        let admin_account = next_account_info(account_iter)?;
        // Make sure the account is signed. This is to prevent holder pass other holder account into the program
        if !admin_account.is_signer {
            msg!("Admin account must be signed");
            return Err(ProgramError::MissingRequiredSignature);
        }

        let program_account = next_account_info(account_iter)?;
        // Make sure the program account passed is for this program
        if program_account.owner != program_id {
            msg!("Program account owner is not current program");
            return Err(ProgramError::IncorrectProgramId);
        }

        let mut program_account_data =
            GameInfo::unpack_unchecked(&program_account.try_borrow_data()?)?;
        if program_account_data.is_initialized {
            msg!("Program account already initialized");
            return Err(GameError::AlreadyInitialize.into());
        }

        let token_account = next_account_info(account_iter)?;
        // Make sure token_account belongs to TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA (SPL TOKEN)
        if *token_account.owner != spl_token::id() {
            msg!("Token account owner is not SPL TOKEN program");
            return Err(ProgramError::IllegalOwner);
        }

        // How to check whether the token_account is an account for token program ? Eg: rent space ? Or, should I check it ?
        // Todo: Transfer token_account ownership to current program PDA
        // Derive program address
        // Destructure pubkey as pda, put _ to avoid compiler complain unused nonce
        let (pda, _nonce) = Pubkey::find_program_address(&[PDA_SEED.as_bytes()], program_id);

        let token_program = next_account_info(account_iter)?;
        // Make sure the token_program is the SPL_TOKEN on-chain program
        if !spl_token::check_id(token_program.key) {
            msg!("Token program is not SPL TOKEN program");
            return Err(ProgramError::IncorrectProgramId);
        }

        // Transfer token_account ownership (not the program owner, the owner here is the owner in token_account data) to the pda
        let set_authority_instruction = spl_token::instruction::set_authority(
            token_program.key,
            token_account.key,
            Some(&pda),
            spl_token::instruction::AuthorityType::AccountOwner,
            admin_account.key,
            &[&admin_account.key],
        )?;

        // Invoke token_account ownership transfer
        // Order need to match https://github.com/solana-labs/solana-program-library/blob/master/token/program/src/instruction.rs ?
        // All account involved in the instruction need to be passed when invoke
        invoke(
            &set_authority_instruction,
            &[token_account.clone(), admin_account.clone()],
        )?;

        // Update program account data
        program_account_data.admin = *admin_account.key;
        program_account_data.is_initialized = true;
        program_account_data.spl_token_account = *token_account.key;

        // Pack / serialize the updated program account data
        GameInfo::pack(
            program_account_data,
            &mut program_account.try_borrow_mut_data()?,
        )?;

        Ok(())
    }

    // 0 - [signer]   - The player (holder) account
    // 1 - [writable] - The player account for the program
    // 2 - []         - The program account
    // 3 - []         - The upline player account for the program
    pub fn process_register(program_id: &Pubkey, accounts: &[AccountInfo]) -> ProgramResult {
        msg!("process_register");
        let account_iter = &mut accounts.iter();
        let player_holder_account = next_account_info(account_iter)?;

        if !player_holder_account.is_signer {
            msg!("Player holder account must be signed");
            return Err(ProgramError::MissingRequiredSignature);
        }

        let player_program_account = next_account_info(account_iter)?;
        if player_program_account.owner != program_id {
            msg!("Player program account owner is not the current program");
            return Err(ProgramError::IncorrectProgramId);
        }

        let mut player_data = Player::unpack_unchecked(&player_program_account.try_borrow_data()?)?;
        if player_data.is_initialized {
            msg!("Player program account already initialized (registered)");
            return Err(ProgramError::AccountAlreadyInitialized);
        }

        let program_account = next_account_info(account_iter)?;
        // Bind player account with program account to prevent user create another program account, add reward to themselves, and pass the "fake" player account
        // Check program owner = current program
        if program_account.owner != program_id {
            msg!("Program account owner is not the current program");
            return Err(ProgramError::IncorrectProgramId);
        }

        let has_upline = accounts.len() == 4;

        if has_upline {
            let upline_player_program_account = next_account_info(account_iter)?;
            // Check upline owner = current program
            if upline_player_program_account.owner != program_id {
                msg!("Upline player program account owner is not the current program");
                return Err(ProgramError::IncorrectProgramId);
            }

            // Check upline is not self-recursive
            if upline_player_program_account.key == player_program_account.key {
                msg!("Upline cannot be same account as current player");
                return Err(GameError::SelfRecursiveUpline.into());
            }

            player_data.upline = COption::Some(*upline_player_program_account.key);
        } else {
            player_data.upline = COption::None;
        }

        player_data.is_initialized = true;
        player_data.owner = *player_holder_account.key;
        player_data.reward_to_claim = 0;

        Player::pack(
            player_data,
            &mut player_program_account.try_borrow_mut_data()?,
        )?;

        Ok(())
    }
}
