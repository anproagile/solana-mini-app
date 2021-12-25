import { Connection, LAMPORTS_PER_SOL } from '@solana/web3.js';
import * as path from 'path';

export const PDA_SEED = 'game_seed'; // Must match with the seed used in contract to derive PDA
export const TOKEN_DECIMALS = (String(LAMPORTS_PER_SOL).match(/0/g) || []).length;
export const RPC_URL = process.env.NODE_ENV === 'devnet' ? 'https://api.devnet.solana.com' : 'http://127.0.0.1:8899';
export const connection = new Connection(RPC_URL, 'confirmed');
export const programKeypairPath = path.join(__dirname, '..', 'program', 'target', 'deploy', 'learn_solana-keypair.json');

export const GAME_ACCOUNT_SEED = 'game_account_seed';
export const GAME_TOKEN_ACCOUNT_SEED = 'game_token_account_seed';
export const MINT_ACCOUNT_SEED = 'mint_account_seed';
