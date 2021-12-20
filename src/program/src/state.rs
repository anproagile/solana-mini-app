use std::collections::{BTreeMap, HashMap};

use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::pubkey::Pubkey;

// struct Player {
//     address upline;
//     uint256 reward;
//     uint256 rewardFromDownlines;
//     address[] downlines;
// }
// mapping(address => Player) playerMapping;

// Every holder have their account for the contract to save state, we can think it as scope by holder
#[derive(BorshSerialize, BorshDeserialize, Debug)]
pub struct Storage {
    pub is_initialized: bool,
    pub btree_storage: BTreeMap<String, String>,
}

// #[derive[BorshSerialize, BorshDeserialize]]
// pub struct Player {
//     pub owner: Pubkey,
//     pub
// }
