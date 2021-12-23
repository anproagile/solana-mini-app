import { Keypair } from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';

export function getPayerKeypair(): Keypair {
	const privateKeyString = fs.readFileSync(path.join(__dirname, '..', '..', 'id.json'), { encoding: 'utf-8' });
	const privateKey = Uint8Array.from(JSON.parse(privateKeyString));
	return Keypair.fromSecretKey(privateKey);
}

export function getProgramKeypair() {
	const privateKeyString = fs.readFileSync(path.join(__dirname, '..', 'program', 'target', 'deploy', 'learn_solana-keypair.json'), { encoding: 'utf-8' });
	const privateKey = Uint8Array.from(JSON.parse(privateKeyString));
	return Keypair.fromSecretKey(privateKey);
}
