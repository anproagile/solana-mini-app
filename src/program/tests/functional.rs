#![allow(unused_variables)]
use learn_solana::{
    entrypoint::main,
    state::{GameInfo, Player},
};
use solana_program::{
    hash::Hash,
    instruction::{AccountMeta, Instruction},
    program_option::COption,
    program_pack::Pack,
    pubkey::Pubkey,
    rent::Rent,
};
use solana_program_test::*;
use solana_sdk::{
    signature::{Keypair, Signer},
    system_instruction,
    transaction::Transaction,
};
use spl_token::{
    self,
    instruction::{initialize_account, initialize_mint, mint_to},
};

#[tokio::test]
async fn claim_reward() {
    let (
        mint_account_keypair,
        admin_account_keypair,
        program_account_keypair,
        token_account_keypair,
        player_one_holder_keypair,
        player_one_account_keypair,
        player_two_holder_keypair,
        player_two_account_keypair,
        player_one_token_account_keypair,
        player_two_token_account_keypair,
        program_id,
        mut banks_client,
        payer,
        recent_blockhash,
    ) = setup().await;
    let init_instruction_transaction = build_init_instruction_transaction(
        &admin_account_keypair,
        &program_account_keypair,
        &token_account_keypair,
        &payer,
        program_id,
        recent_blockhash,
    );
    banks_client
        .process_transaction(init_instruction_transaction)
        .await
        .unwrap();
    let create_player_account_transaction = build_create_player_account_transaction(
        &player_one_account_keypair,
        &player_two_account_keypair,
        &payer,
        program_id,
        recent_blockhash,
    );
    banks_client
        .process_transaction(create_player_account_transaction)
        .await
        .unwrap();

    // Register player one
    let transaction = build_register_player_transaction(
        &payer,
        &player_one_holder_keypair,
        &player_one_account_keypair,
        &program_account_keypair,
        None,
        program_id,
        recent_blockhash,
    );
    banks_client.process_transaction(transaction).await.unwrap();

    // Register player two, with player one as upline
    let transaction = build_register_player_transaction(
        &payer,
        &player_two_holder_keypair,
        &player_two_account_keypair,
        &program_account_keypair,
        Some(&player_one_account_keypair),
        program_id,
        recent_blockhash,
    );
    banks_client.process_transaction(transaction).await.unwrap();

    // Test add reward to player two with admin
    let add_reward_transaction = build_add_reward_transaction(
        &admin_account_keypair,
        &program_account_keypair,
        &player_two_account_keypair,
        Some(&player_one_account_keypair),
        program_id,
        100,
        &payer,
        recent_blockhash,
    );
    banks_client
        .process_transaction(add_reward_transaction)
        .await
        .unwrap();

    // Test add reward to player one
    let add_reward_transaction = build_add_reward_transaction(
        &admin_account_keypair,
        &program_account_keypair,
        &player_one_account_keypair,
        None,
        program_id,
        100,
        &payer,
        recent_blockhash,
    );
    banks_client
        .process_transaction(add_reward_transaction)
        .await
        .unwrap();

    let (pda, _nonce) = Pubkey::find_program_address(&["game_seed".as_bytes()], &program_id);
    // Test claim other player reward
    let transaction = build_claim_reward_transaction(
        &player_one_holder_keypair,
        &program_account_keypair,
        &player_two_account_keypair, // Claim player two reward using player one signature
        &token_account_keypair,
        pda,
        &player_one_token_account_keypair,
        program_id,
        &payer,
        recent_blockhash,
    );
    let result = banks_client.process_transaction(transaction).await;
    match result {
        Ok(()) => {}
        Err(e) => {
            assert_eq!(e.to_string().contains("missing required signature"), true);
        }
    };

    // Test player one claim reward
    let transaction = build_claim_reward_transaction(
        &player_one_holder_keypair,
        &program_account_keypair,
        &player_one_account_keypair,
        &token_account_keypair,
        pda,
        &player_one_token_account_keypair,
        program_id,
        &payer,
        recent_blockhash,
    );
    banks_client.process_transaction(transaction).await.unwrap();

    let player_one_account = banks_client
        .get_account(player_one_account_keypair.pubkey())
        .await
        .unwrap();
    match player_one_account {
        Some(account) => {
            let player_one_state = Player::unpack(&account.data).unwrap();
            assert_eq!(player_one_state.reward_to_claim, 0);
        }
        _ => {} // Unreachable
    };

    let player_one_token_account = banks_client
        .get_account(player_one_token_account_keypair.pubkey())
        .await
        .unwrap();
    match player_one_token_account {
        Some(account) => {
            let player_one_token_account_state =
                spl_token::state::Account::unpack(&account.data).unwrap();
            assert_eq!(player_one_token_account_state.amount, 110); // 100 + 10% from player two
        }
        _ => {}
    }
}

#[tokio::test]
async fn add_reward() {
    let (
        mint_account_keypair,
        admin_account_keypair,
        program_account_keypair,
        token_account_keypair,
        player_one_holder_keypair,
        player_one_account_keypair,
        player_two_holder_keypair,
        player_two_account_keypair,
        player_one_token_account_keypair,
        player_two_token_account_keypair,
        program_id,
        mut banks_client,
        payer,
        recent_blockhash,
    ) = setup().await;
    let init_instruction_transaction = build_init_instruction_transaction(
        &admin_account_keypair,
        &program_account_keypair,
        &token_account_keypair,
        &payer,
        program_id,
        recent_blockhash,
    );
    banks_client
        .process_transaction(init_instruction_transaction)
        .await
        .unwrap();
    let create_player_account_transaction = build_create_player_account_transaction(
        &player_one_account_keypair,
        &player_two_account_keypair,
        &payer,
        program_id,
        recent_blockhash,
    );
    banks_client
        .process_transaction(create_player_account_transaction)
        .await
        .unwrap();
    // Register player one
    let transaction = build_register_player_transaction(
        &payer,
        &player_one_holder_keypair,
        &player_one_account_keypair,
        &program_account_keypair,
        None,
        program_id,
        recent_blockhash,
    );
    banks_client.process_transaction(transaction).await.unwrap();

    // Register player two, with player one as upline
    let transaction = build_register_player_transaction(
        &payer,
        &player_two_holder_keypair,
        &player_two_account_keypair,
        &program_account_keypair,
        Some(&player_one_account_keypair),
        program_id,
        recent_blockhash,
    );
    banks_client.process_transaction(transaction).await.unwrap();

    // Test add reward with non-admin account
    let fake_admin_account_keypair = Keypair::new();
    let add_reward_transaction = build_add_reward_transaction(
        &fake_admin_account_keypair,
        &program_account_keypair,
        &player_one_account_keypair,
        None,
        program_id,
        100,
        &payer,
        recent_blockhash,
    );
    let result = banks_client
        .process_transaction(add_reward_transaction)
        .await;
    match result {
        Ok(()) => {}
        Err(error) => {
            assert_eq!(
                error.to_string().contains("missing required signature"),
                true
            );
        }
    };
    // End

    // Test add reward with invalid player account
    let add_reward_transaction = build_add_reward_transaction(
        &admin_account_keypair,
        &program_account_keypair,
        &Keypair::new(),
        None,
        program_id,
        100,
        &payer,
        recent_blockhash,
    );
    let result = banks_client
        .process_transaction(add_reward_transaction)
        .await;
    match result {
        Ok(()) => {}
        Err(error) => {
            assert_eq!(error.to_string().contains("incorrect program id"), true);
        }
    };
    // End

    // Test add reward with non-exists upline account
    let add_reward_transaction = build_add_reward_transaction(
        &admin_account_keypair,
        &program_account_keypair,
        &player_two_account_keypair,
        Some(&Keypair::new()),
        program_id,
        100,
        &payer,
        recent_blockhash,
    );
    let result = banks_client
        .process_transaction(add_reward_transaction)
        .await;
    match result {
        Ok(()) => {}
        Err(error) => {
            assert_eq!(error.to_string().contains("incorrect program id"), true);
        }
    };
    // End

    // Test add reward to invalid upline account
    let add_reward_transaction = build_add_reward_transaction(
        &admin_account_keypair,
        &program_account_keypair,
        &player_two_account_keypair,
        Some(&player_two_account_keypair),
        program_id,
        100,
        &payer,
        recent_blockhash,
    );
    let result = banks_client
        .process_transaction(add_reward_transaction)
        .await;
    match result {
        Ok(()) => {}
        Err(error) => {
            assert_eq!(error.to_string().contains("custom program error"), true);
        }
    };
    // End

    // Test add reward to player two with admin
    let add_reward_transaction = build_add_reward_transaction(
        &admin_account_keypair,
        &program_account_keypair,
        &player_two_account_keypair,
        Some(&player_one_account_keypair),
        program_id,
        100,
        &payer,
        recent_blockhash,
    );
    banks_client
        .process_transaction(add_reward_transaction)
        .await
        .unwrap();

    let player_one_account = banks_client
        .get_account(player_one_account_keypair.pubkey())
        .await
        .unwrap();
    match player_one_account {
        Some(account) => {
            let player_one_state = Player::unpack(&account.data).unwrap();
            assert_eq!(player_one_state.reward_to_claim, 10); // 10% from player two
        }
        _ => {} // Unreachable
    };

    let player_two_account = banks_client
        .get_account(player_two_account_keypair.pubkey())
        .await
        .unwrap();
    match player_two_account {
        Some(account) => {
            let player_two_state = Player::unpack(&account.data).unwrap();
            assert_eq!(player_two_state.reward_to_claim, 90);
        }
        _ => {} // Unreachable
    };

    // Test add reward to player one
    let add_reward_transaction = build_add_reward_transaction(
        &admin_account_keypair,
        &program_account_keypair,
        &player_one_account_keypair,
        None,
        program_id,
        100,
        &payer,
        recent_blockhash,
    );
    banks_client
        .process_transaction(add_reward_transaction)
        .await
        .unwrap();

    let player_one_account = banks_client
        .get_account(player_one_account_keypair.pubkey())
        .await
        .unwrap();
    match player_one_account {
        Some(account) => {
            let player_one_state = Player::unpack(&account.data).unwrap();
            assert_eq!(player_one_state.reward_to_claim, 110); // 100 + 10% from player two
        }
        _ => {} // Unreachable
    };
}

#[tokio::test]
async fn register_player() {
    let (
        mint_account_keypair,
        admin_account_keypair,
        program_account_keypair,
        token_account_keypair,
        player_one_holder_keypair,
        player_one_account_keypair,
        player_two_holder_keypair,
        player_two_account_keypair,
        player_one_token_account_keypair,
        player_two_token_account_keypair,
        program_id,
        mut banks_client,
        payer,
        recent_blockhash,
    ) = setup().await;
    let init_instruction_transaction = build_init_instruction_transaction(
        &admin_account_keypair,
        &program_account_keypair,
        &token_account_keypair,
        &payer,
        program_id,
        recent_blockhash,
    );
    banks_client
        .process_transaction(init_instruction_transaction)
        .await
        .unwrap();
    let create_player_account_transaction = build_create_player_account_transaction(
        &player_one_account_keypair,
        &player_two_account_keypair,
        &payer,
        program_id,
        recent_blockhash,
    );
    banks_client
        .process_transaction(create_player_account_transaction)
        .await
        .unwrap();

    // Test register player with invalid program id
    let transaction = build_register_player_transaction(
        &payer,
        &player_one_holder_keypair,
        &Keypair::new(),
        &program_account_keypair,
        None,
        program_id,
        recent_blockhash,
    );
    let result = banks_client.process_transaction(transaction).await;
    match result {
        Ok(()) => {}
        Err(error) => {
            assert_eq!(error.to_string().contains("incorrect program id"), true);
        }
    };
    // End

    // Test register player with invalid program account
    let transaction = build_register_player_transaction(
        &payer,
        &player_one_holder_keypair,
        &player_one_account_keypair,
        &Keypair::new(),
        None,
        program_id,
        recent_blockhash,
    );
    let result = banks_client.process_transaction(transaction).await;
    match result {
        Ok(()) => {}
        Err(error) => {
            assert_eq!(error.to_string().contains("incorrect program id"), true);
        }
    };
    // End

    // Test register player with invalid upline account
    let transaction = build_register_player_transaction(
        &payer,
        &player_one_holder_keypair,
        &player_one_account_keypair,
        &program_account_keypair,
        Some(&Keypair::new()),
        program_id,
        recent_blockhash,
    );
    let result = banks_client.process_transaction(transaction).await;
    match result {
        Ok(()) => {}
        Err(error) => {
            assert_eq!(error.to_string().contains("incorrect program id"), true);
        }
    };
    // End

    // Test register self as upline
    let transaction = build_register_player_transaction(
        &payer,
        &player_one_holder_keypair,
        &player_one_account_keypair,
        &program_account_keypair,
        Some(&player_one_account_keypair),
        program_id,
        recent_blockhash,
    );
    let result = banks_client.process_transaction(transaction).await;
    match result {
        Ok(()) => {}
        Err(error) => {
            assert_eq!(error.to_string().contains("custom program error"), true);
            // Why decode custom error not working?
        }
    };
    // End

    // Test register player
    // Register player one
    let transaction = build_register_player_transaction(
        &payer,
        &player_one_holder_keypair,
        &player_one_account_keypair,
        &program_account_keypair,
        None,
        program_id,
        recent_blockhash,
    );
    let result = banks_client.process_transaction(transaction).await;
    let player_one_account = banks_client
        .get_account(player_one_account_keypair.pubkey())
        .await
        .unwrap();
    match player_one_account {
        Some(account) => {
            let player_one_state = Player::unpack(&account.data).unwrap();
            assert_eq!(player_one_state.is_initialized, true);
            assert_eq!(player_one_state.owner, player_one_holder_keypair.pubkey());
            assert_eq!(player_one_state.reward_to_claim, 0);
            assert_eq!(player_one_state.upline, COption::None);
        }
        _ => {
            panic!("Player one account not found");
        }
    };

    // Register player two, with player one as upline
    let transaction = build_register_player_transaction(
        &payer,
        &player_two_holder_keypair,
        &player_two_account_keypair,
        &program_account_keypair,
        Some(&player_one_account_keypair),
        program_id,
        recent_blockhash,
    );
    let result = banks_client.process_transaction(transaction).await;

    let player_two_account = banks_client
        .get_account(player_two_account_keypair.pubkey())
        .await
        .unwrap();

    match player_two_account {
        Some(account) => {
            let player_two_state = Player::unpack(&account.data).unwrap();
            assert_eq!(player_two_state.is_initialized, true);
            assert_eq!(player_two_state.owner, player_two_holder_keypair.pubkey());
            assert_eq!(player_two_state.reward_to_claim, 0);
            assert_eq!(
                player_two_state.upline,
                COption::Some(player_one_account_keypair.pubkey())
            );
        }
        _ => {
            panic!("Player two account not found");
        }
    };
}

#[tokio::test]
async fn init_instruction() {
    let (
        mint_account_keypair,
        admin_account_keypair,
        program_account_keypair,
        token_account_keypair,
        player_one_holder_keypair,
        player_one_account_keypair,
        player_two_holder_keypair,
        player_two_account_keypair,
        player_one_token_account_keypair,
        player_two_token_account_keypair,
        program_id,
        mut banks_client,
        payer,
        recent_blockhash,
    ) = setup().await;

    // Test init with invalid program_account
    let invalid_program_account_keypair = Keypair::new();
    let init_instruction_transaction = build_init_instruction_transaction(
        &admin_account_keypair,
        &invalid_program_account_keypair,
        &token_account_keypair,
        &payer,
        program_id,
        recent_blockhash,
    );
    let result = banks_client
        .process_transaction(init_instruction_transaction)
        .await;
    match result {
        Ok(()) => {}
        Err(error) => {
            assert_eq!(error.to_string().contains("incorrect program id"), true);
        }
    }
    // End

    // Test init with invalid token account
    let invalid_token_account_keypair = Keypair::new();
    let init_instruction_transaction = build_init_instruction_transaction(
        &admin_account_keypair,
        &program_account_keypair,
        &invalid_token_account_keypair,
        &payer,
        program_id,
        recent_blockhash,
    );
    let result = banks_client
        .process_transaction(init_instruction_transaction)
        .await;
    match result {
        Ok(()) => {}
        Err(error) => {
            assert_eq!(
                error.to_string().contains("Provided owner is not allowed"),
                true
            );
        }
    }
    // End

    // Test init instruction
    let init_instruction_transaction = build_init_instruction_transaction(
        &admin_account_keypair,
        &program_account_keypair,
        &token_account_keypair,
        &payer,
        program_id,
        recent_blockhash,
    );
    banks_client
        .process_transaction(init_instruction_transaction)
        .await
        .unwrap();
    // It should successfully execute init instruction
    let program_account = banks_client
        .get_account(program_account_keypair.pubkey())
        .await
        .unwrap();
    match program_account {
        Some(account) => {
            let program_state = GameInfo::unpack(&account.data).unwrap();
            assert_eq!(program_state.is_initialized, true);
            assert_eq!(&program_state.admin, &admin_account_keypair.pubkey());
            assert_eq!(
                &program_state.spl_token_account,
                &token_account_keypair.pubkey()
            );
        }
        _ => {
            panic!("Program account not found");
        }
    };
}

fn build_claim_reward_transaction(
    player_holder_keypair: &Keypair,
    program_account_keypair: &Keypair,
    player_account_keypair: &Keypair,
    token_account_keypair: &Keypair,
    pda: Pubkey,
    player_token_account_keypair: &Keypair,
    program_id: Pubkey,
    payer: &Keypair,
    recent_blockhash: Hash,
) -> Transaction {
    let claim_reward_instruction = [Instruction {
        accounts: vec![
            AccountMeta::new_readonly(player_holder_keypair.pubkey(), true),
            AccountMeta::new_readonly(program_account_keypair.pubkey(), false),
            AccountMeta::new(player_account_keypair.pubkey(), false), // Claim from player two account
            AccountMeta::new(token_account_keypair.pubkey(), false),
            AccountMeta::new_readonly(pda, false),
            AccountMeta::new(player_token_account_keypair.pubkey(), false), // Receive the claimed token using player one token account
            AccountMeta::new_readonly(spl_token::id(), false),
        ],
        program_id,
        data: vec![3_u8], // Tag = 3
    }];

    let mut transaction =
        Transaction::new_with_payer(&claim_reward_instruction, Some(&payer.pubkey()));
    transaction.partial_sign(&[payer, player_holder_keypair], recent_blockhash);
    transaction
}

fn build_add_reward_transaction(
    admin_account_keypair: &Keypair,
    program_account_keypair: &Keypair,
    player_account_keypair: &Keypair,
    upline_account_keypair: Option<&Keypair>,
    program_id: Pubkey,
    amount: u64,
    payer: &Keypair,
    recent_blockhash: Hash,
) -> Transaction {
    let mut add_reward_data = vec![2_u8]; // Tag = 2
    add_reward_data.extend_from_slice(&u64::to_le_bytes(amount)); // reward
    if upline_account_keypair.is_some() {
        let add_reward_instruction = [Instruction {
            program_id,
            accounts: vec![
                AccountMeta::new_readonly(admin_account_keypair.pubkey(), true),
                AccountMeta::new_readonly(program_account_keypair.pubkey(), false),
                AccountMeta::new(player_account_keypair.pubkey(), false),
                AccountMeta::new(upline_account_keypair.unwrap().pubkey(), false),
            ],
            data: add_reward_data.clone(),
        }];
        let mut transaction =
            Transaction::new_with_payer(&add_reward_instruction, Some(&payer.pubkey()));
        transaction.partial_sign(&[payer, admin_account_keypair], recent_blockhash);
        transaction
    } else {
        let add_reward_instruction = [Instruction {
            program_id,
            accounts: vec![
                AccountMeta::new_readonly(admin_account_keypair.pubkey(), true),
                AccountMeta::new_readonly(program_account_keypair.pubkey(), false),
                AccountMeta::new(player_account_keypair.pubkey(), false),
            ],
            data: add_reward_data.clone(),
        }];
        let mut transaction =
            Transaction::new_with_payer(&add_reward_instruction, Some(&payer.pubkey()));
        transaction.partial_sign(&[payer, admin_account_keypair], recent_blockhash);
        transaction
    }
}

fn build_register_player_transaction(
    payer: &Keypair,
    player_holder_keypair: &Keypair,
    player_account_keypair: &Keypair,
    program_account_keypair: &Keypair,
    upline_account_keypair: Option<&Keypair>,
    program_id: Pubkey,
    recent_blockhash: Hash,
) -> Transaction {
    if upline_account_keypair.is_some() {
        let register_player_instruction = [Instruction {
            program_id,
            accounts: vec![
                AccountMeta::new_readonly(player_holder_keypair.pubkey(), true),
                AccountMeta::new(player_account_keypair.pubkey(), false),
                AccountMeta::new_readonly(program_account_keypair.pubkey(), false),
                AccountMeta::new_readonly(upline_account_keypair.unwrap().pubkey(), false), //upline
            ],
            data: vec![1_u8], // Tag 1
        }];
        let mut transaction =
            Transaction::new_with_payer(&register_player_instruction, Some(&payer.pubkey()));
        transaction.partial_sign(&[payer, player_holder_keypair], recent_blockhash);
        transaction
    } else {
        let register_player_instruction = [Instruction {
            program_id,
            accounts: vec![
                AccountMeta::new_readonly(player_holder_keypair.pubkey(), true),
                AccountMeta::new(player_account_keypair.pubkey(), false),
                AccountMeta::new_readonly(program_account_keypair.pubkey(), false),
            ],
            data: vec![1_u8], // Tag 1
        }];
        let mut transaction =
            Transaction::new_with_payer(&register_player_instruction, Some(&payer.pubkey()));
        transaction.partial_sign(&[payer, player_holder_keypair], recent_blockhash);
        transaction
    }
}

fn build_create_player_account_transaction(
    player_one_account_keypair: &Keypair,
    player_two_account_keypair: &Keypair,
    payer: &Keypair,
    program_id: Pubkey,
    recent_blockhash: Hash,
) -> Transaction {
    let create_player_account_instruction = [
        // Create player one account
        system_instruction::create_account(
            &payer.pubkey(),
            &player_one_account_keypair.pubkey(),
            Rent::default().minimum_balance(Player::LEN),
            Player::LEN.try_into().unwrap(),
            &program_id,
        ),
        // Create player two account
        system_instruction::create_account(
            &payer.pubkey(),
            &player_two_account_keypair.pubkey(),
            Rent::default().minimum_balance(Player::LEN),
            Player::LEN.try_into().unwrap(),
            &program_id,
        ),
    ];
    let mut create_player_account_transaction =
        Transaction::new_with_payer(&create_player_account_instruction, Some(&payer.pubkey()));
    create_player_account_transaction.partial_sign(
        &[
            payer,
            player_one_account_keypair,
            player_two_account_keypair,
        ],
        recent_blockhash,
    );
    create_player_account_transaction
}

fn build_init_instruction_transaction(
    admin_account_keypair: &Keypair,
    program_account_keypair: &Keypair,
    token_account_keypair: &Keypair,
    payer: &Keypair,
    program_id: Pubkey,
    recent_blockhash: Hash,
) -> Transaction {
    let init_instruction = Instruction {
        program_id,
        accounts: vec![
            AccountMeta::new_readonly(admin_account_keypair.pubkey(), true),
            AccountMeta::new(program_account_keypair.pubkey(), false),
            AccountMeta::new(token_account_keypair.pubkey(), false),
            AccountMeta::new_readonly(spl_token::id(), false),
        ],
        data: vec![0_u8], // Tag = 0
    };
    let mut init_instruction_transaction =
        Transaction::new_with_payer(&[init_instruction], Option::Some(&payer.pubkey()));
    init_instruction_transaction.partial_sign(&[payer, admin_account_keypair], recent_blockhash);
    init_instruction_transaction
}

async fn setup() -> (
    Keypair,
    Keypair,
    Keypair,
    Keypair,
    Keypair,
    Keypair,
    Keypair,
    Keypair,
    Keypair,
    Keypair,
    Pubkey,
    BanksClient,
    Keypair,
    Hash,
) {
    let mint_account_keypair = Keypair::new();
    let admin_account_keypair = Keypair::new();
    let program_account_keypair = Keypair::new();
    let token_account_keypair = Keypair::new();
    let player_one_holder_keypair = Keypair::new();
    let player_one_account_keypair = Keypair::new();
    let player_two_holder_keypair = Keypair::new();
    let player_two_account_keypair = Keypair::new();
    let player_one_token_account_keypair = Keypair::new();
    let player_two_token_account_keypair = Keypair::new();

    let program_id = Pubkey::new_unique();
    // The program_test will be run in BPF VM
    let program_test = ProgramTest::new(
        // name must match with the compiled .so
        // https://docs.rs/solana-program-test/latest/src/solana_program_test/lib.rs.html#492-500
        "learn_solana",
        program_id,
        processor!(main),
    );
    let (mut banks_client, payer, recent_blockhash) = program_test.start().await;
    // Create and initialize program, token account, mint account
    banks_client
        .process_transaction(build_create_and_init_token_and_program_account_transaction(
            &payer,
            &program_account_keypair,
            &program_id,
            &mint_account_keypair,
            &token_account_keypair,
            &admin_account_keypair,
            recent_blockhash,
        ))
        .await
        .unwrap();

    // Mint to program token account
    banks_client
        .process_transaction(build_mint_transaction(
            &payer,
            &mint_account_keypair,
            &token_account_keypair,
            &admin_account_keypair,
            1000000000000,
            recent_blockhash,
        ))
        .await
        .unwrap();

    // Create and initialize player 1 token account
    banks_client
        .process_transaction(build_create_and_init_player_token_account(
            &payer,
            &player_one_token_account_keypair,
            &player_one_holder_keypair,
            &mint_account_keypair,
            recent_blockhash,
        ))
        .await
        .unwrap();

    // Create and initialize player 2 token account
    banks_client
        .process_transaction(build_create_and_init_player_token_account(
            &payer,
            &player_two_token_account_keypair,
            &player_two_holder_keypair,
            &mint_account_keypair,
            recent_blockhash,
        ))
        .await
        .unwrap();

    (
        mint_account_keypair,
        admin_account_keypair,
        program_account_keypair,
        token_account_keypair,
        player_one_holder_keypair,
        player_one_account_keypair,
        player_two_holder_keypair,
        player_two_account_keypair,
        player_one_token_account_keypair,
        player_two_token_account_keypair,
        program_id,
        banks_client,
        payer,
        recent_blockhash,
    )
}

fn build_create_and_init_player_token_account(
    payer: &Keypair,
    player_token_account_keypair: &Keypair,
    player_holder_keypair: &Keypair,
    mint_account_keypair: &Keypair,
    recent_blockhash: Hash,
) -> Transaction {
    let transaction = [
        system_instruction::create_account(
            &payer.pubkey(),
            &player_token_account_keypair.pubkey(),
            Rent::default().minimum_balance(spl_token::state::Account::LEN),
            spl_token::state::Account::LEN.try_into().unwrap(),
            &spl_token::id(),
        ),
        initialize_account(
            &spl_token::id(),
            &player_token_account_keypair.pubkey(),
            &mint_account_keypair.pubkey(),
            &player_holder_keypair.pubkey(),
        )
        .unwrap(),
    ];

    let mut transaction = Transaction::new_with_payer(&transaction, Some(&payer.pubkey()));
    transaction.partial_sign(&[payer, player_token_account_keypair], recent_blockhash);
    transaction
}

fn build_mint_transaction(
    payer: &Keypair,
    mint_account_keypair: &Keypair,
    token_account_keypair: &Keypair,
    admin_account_keypair: &Keypair,
    amount: u64,
    recent_blockhash: Hash,
) -> Transaction {
    // Mint to program token account
    let mint_to_instruction = [mint_to(
        &spl_token::id(),
        &mint_account_keypair.pubkey(),
        &token_account_keypair.pubkey(),
        &admin_account_keypair.pubkey(),
        &[],
        amount,
    )
    .unwrap()];
    let mut transaction = Transaction::new_with_payer(&mint_to_instruction, Some(&payer.pubkey()));
    transaction.partial_sign(&[payer, admin_account_keypair], recent_blockhash);
    transaction
}

fn build_create_and_init_token_and_program_account_transaction(
    payer: &Keypair,
    program_account_keypair: &Keypair,
    program_id: &Pubkey,
    mint_account_keypair: &Keypair,
    token_account_keypair: &Keypair,
    admin_account_keypair: &Keypair,
    recent_blockhash: Hash,
) -> Transaction {
    let instructions = [
        system_instruction::create_account(
            &payer.pubkey(),
            &program_account_keypair.pubkey(),
            Rent::default().minimum_balance(GameInfo::LEN),
            GameInfo::LEN.try_into().unwrap(),
            &program_id,
        ),
        system_instruction::create_account(
            &payer.pubkey(),
            &mint_account_keypair.pubkey(),
            Rent::default().minimum_balance(spl_token::state::Mint::LEN),
            spl_token::state::Mint::LEN.try_into().unwrap(),
            &spl_token::id(),
        ),
        system_instruction::create_account(
            &payer.pubkey(),
            &token_account_keypair.pubkey(),
            Rent::default().minimum_balance(spl_token::state::Account::LEN),
            spl_token::state::Account::LEN.try_into().unwrap(),
            &spl_token::id(),
        ),
        initialize_mint(
            &spl_token::id(),
            &mint_account_keypair.pubkey(),
            &admin_account_keypair.pubkey(),
            Some(&admin_account_keypair.pubkey()),
            9,
        )
        .unwrap(),
        initialize_account(
            &spl_token::id(),
            &token_account_keypair.pubkey(),
            &mint_account_keypair.pubkey(),
            &admin_account_keypair.pubkey(),
        )
        .unwrap(),
    ];

    let mut transaction = Transaction::new_with_payer(&instructions, Some(&payer.pubkey()));
    transaction.partial_sign(
        &[
            payer,
            program_account_keypair,
            mint_account_keypair,
            token_account_keypair,
        ],
        recent_blockhash,
    );
    return transaction;
}
