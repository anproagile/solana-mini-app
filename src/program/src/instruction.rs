use borsh::BorshDeserialize;

#[derive(BorshDeserialize, Debug)]
pub struct Payload {
    pub choice: u8,
    pub key: String,
    pub value: String,
}
