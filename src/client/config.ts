import { Connection, LAMPORTS_PER_SOL } from '@solana/web3.js';

export const PDA_SEED = 'game_seed'; // Must match with the seed used in contract to derive PDA
export const TOKEN_DECIMALS = (String(LAMPORTS_PER_SOL).match(/0/g) || []).length;
const RPC_URL = 'http://127.0.0.1:8899';
export const connection = new Connection(RPC_URL, 'confirmed');
