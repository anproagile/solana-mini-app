use learn_solana::{entrypoint::main, state::GameInfo};
use solana_program::{
    instruction::{AccountMeta, Instruction},
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
    // let source_account = Keypair::new();
    let mint_account = Keypair::new();
    let admin_account = Keypair::new();
    let program_account = Keypair::new();
    let token_account = Keypair::new();

    let program_id = Pubkey::new_unique();
    // The program_test will be run in BPF VM
    let mut program_test = ProgramTest::new(
        // name must match with the compiled .so
        // https://docs.rs/solana-program-test/latest/src/solana_program_test/lib.rs.html#492-500
        "learn_solana",
        program_id,
        processor!(main),
    );
    // program_test.add_account(
    //     source_account.pubkey(),
    //     Account {
    //         lamports: 5 * LAMPORTS_PER_SOL,
    //         ..Account::default()
    //     },
    // );
    let (mut banks_client, payer, recent_blockhash) = program_test.start().await;

    let create_and_init_account_instructions = [
        system_instruction::create_account(
            &payer.pubkey(),
            &program_account.pubkey(),
            Rent::default().minimum_balance(GameInfo::LEN),
            GameInfo::LEN.try_into().unwrap(),
            &program_id,
        ),
        system_instruction::create_account(
            &payer.pubkey(),
            &mint_account.pubkey(),
            Rent::default().minimum_balance(spl_token::state::Mint::LEN),
            spl_token::state::Mint::LEN.try_into().unwrap(),
            &spl_token::id(),
        ),
        system_instruction::create_account(
            &payer.pubkey(),
            &token_account.pubkey(),
            Rent::default().minimum_balance(spl_token::state::Account::LEN),
            spl_token::state::Account::LEN.try_into().unwrap(),
            &spl_token::id(),
        ),
        initialize_mint(
            &spl_token::id(),
            &mint_account.pubkey(),
            &admin_account.pubkey(),
            Some(&admin_account.pubkey()),
            9,
        )
        .unwrap(),
        initialize_account(
            &spl_token::id(),
            &token_account.pubkey(),
            &mint_account.pubkey(),
            &admin_account.pubkey(),
        )
        .unwrap(),
    ];

    let mut transaction =
        Transaction::new_with_payer(&create_and_init_account_instructions, Some(&payer.pubkey()));
    transaction.partial_sign(
        &[&payer, &program_account, &mint_account, &token_account],
        recent_blockhash,
    );
    banks_client.process_transaction(transaction).await.unwrap();

    let mint_to_instruction = [mint_to(
        &spl_token::id(),
        &mint_account.pubkey(),
        &token_account.pubkey(),
        &admin_account.pubkey(),
        &[],
        1000000000000,
    )
    .unwrap()];
    transaction = Transaction::new_with_payer(&mint_to_instruction, Some(&payer.pubkey()));
    transaction.partial_sign(&[&payer, &admin_account], recent_blockhash);
    banks_client.process_transaction(transaction).await.unwrap();

    // 0 - [signer]   - The admin (holder) account
    // 1 - [writable] - Program account
    // 2 - [writable] - An token account created by the admin, and pre-funded
    // 3 - []         - The token program
    let init_instruction = Instruction {
        program_id,
        accounts: vec![
            AccountMeta::new_readonly(admin_account.pubkey(), true),
            AccountMeta::new(program_account.pubkey(), false),
            AccountMeta::new(token_account.pubkey(), false),
            AccountMeta::new_readonly(spl_token::id(), false),
        ],
        data: vec![0_u8], // Tag = 0
    };
    let mut init_instruction_transaction =
        Transaction::new_with_payer(&[init_instruction], Option::Some(&payer.pubkey()));
    init_instruction_transaction.sign(&[&payer, &admin_account], recent_blockhash);
    banks_client
        .process_transaction(init_instruction_transaction)
        .await
        .unwrap();
    let program_acc = banks_client
        .get_account(program_account.pubkey())
        .await
        .unwrap();
    match program_acc {
        Some(acc) => {
            let program_state = GameInfo::unpack(&acc.data).unwrap();
            assert_eq!(program_state.is_initialized, true);
            assert_eq!(&program_state.admin, &admin_account.pubkey());
        }
        _ => {
            panic!("Program account not found");
        }
    };
}
