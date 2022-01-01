use learn_solana::{
    entrypoint::main,
    state::{GameInfo, Player},
};
use solana_program::{
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

// Use outer attribute to mark this function as extended tokio unit test
#[tokio::test]
async fn test_init_instruction() {
    let mint_account_keypair = Keypair::new();
    let admin_account_keypair = Keypair::new();
    let program_account_keypair = Keypair::new();
    let token_account_keypair = Keypair::new();
    let player_one_holder_keypair = Keypair::new();
    let player_one_account_keypair = Keypair::new();
    let player_two_holder_keypair = Keypair::new();
    let player_two_account_keypair = Keypair::new();

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

    let create_and_init_account_instructions = [
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

    let mut transaction =
        Transaction::new_with_payer(&create_and_init_account_instructions, Some(&payer.pubkey()));
    transaction.partial_sign(
        &[
            &payer,
            &program_account_keypair,
            &mint_account_keypair,
            &token_account_keypair,
        ],
        recent_blockhash,
    );
    banks_client.process_transaction(transaction).await.unwrap();

    let mint_to_instruction = [mint_to(
        &spl_token::id(),
        &mint_account_keypair.pubkey(),
        &token_account_keypair.pubkey(),
        &admin_account_keypair.pubkey(),
        &[],
        1000000000000,
    )
    .unwrap()];
    transaction = Transaction::new_with_payer(&mint_to_instruction, Some(&payer.pubkey()));
    transaction.partial_sign(&[&payer, &admin_account_keypair], recent_blockhash);
    banks_client.process_transaction(transaction).await.unwrap();

    // 0 - [signer]   - The admin (holder) account
    // 1 - [writable] - Program account
    // 2 - [writable] - An token account created by the admin, and pre-funded
    // 3 - []         - The token program
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
    init_instruction_transaction.partial_sign(&[&payer, &admin_account_keypair], recent_blockhash);
    banks_client
        .process_transaction(init_instruction_transaction)
        .await
        .unwrap();
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
            &payer,
            &player_one_account_keypair,
            &player_two_account_keypair,
        ],
        recent_blockhash,
    );
    banks_client
        .process_transaction(create_player_account_transaction)
        .await
        .unwrap();

    // 0 - [signer]   - The player (holder) account
    // 1 - [writable] - The player account for the program
    // 2 - []         - The program account
    // 3 - []         - The upline player account for the program
    let create_and_register_player_instruction = [
        // Register player one
        Instruction {
            program_id,
            accounts: vec![
                AccountMeta::new_readonly(player_one_holder_keypair.pubkey(), true),
                AccountMeta::new(player_one_account_keypair.pubkey(), false),
                AccountMeta::new_readonly(program_account_keypair.pubkey(), false),
            ],
            data: vec![1_u8], // Tag 1
        },
        // Register player two
        Instruction {
            program_id,
            accounts: vec![
                AccountMeta::new_readonly(player_two_holder_keypair.pubkey(), true),
                AccountMeta::new(player_two_account_keypair.pubkey(), false),
                AccountMeta::new_readonly(program_account_keypair.pubkey(), false),
                AccountMeta::new_readonly(player_one_account_keypair.pubkey(), false),
            ],
            data: vec![1_u8], // Tag 1
        },
    ];
    let mut register_player_transaction = Transaction::new_with_payer(
        &create_and_register_player_instruction,
        Some(&payer.pubkey()),
    );
    register_player_transaction.partial_sign(
        &[
            &payer,
            &player_one_holder_keypair,
            &player_two_holder_keypair,
        ],
        recent_blockhash,
    );
    banks_client
        .process_transaction(register_player_transaction)
        .await
        .unwrap();

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
    }

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
    }
}