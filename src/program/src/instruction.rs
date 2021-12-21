use borsh::BorshDeserialize;

// #[derive(BorshDeserialize, Debug)]
// pub struct Payload {
//     pub choice: u8,
//     pub key: String,
//     pub value: String,
// }

pub enum Command {
    // Start initialize the program account
    // Accounts expected
    // 0 - [signer, writable] - The account for the program, the signer will be the admin
    // 1 - [writable] - An token account created by the admin, which is pre-funded
    // 2 - [] - The token program
    // To update, 0 = program owner
    Init {},
}
