import { Keypair } from '@solana/web3.js';
import PromptSync from 'prompt-sync';
import { connection, TOKEN_DECIMALS } from '../config';
import { mintToken, toJSONStringAndBeautify } from '../utils';
import { BaseModule } from './base';

const prompt = PromptSync();
const EXIT = 0;

export class AdminModule extends BaseModule {
	async execute() {
		let choice = 1;
		while (choice != EXIT) {
			console.log('');
			console.log('Admin module');
			console.log('1. Show available payout amount');
			console.log('2. Mint token for payout');
			console.log('0. Back');
			choice = Number(prompt('Enter your choice: '));

			switch (choice) {
				case 1:
					await showAvailablePayoutAmount(this.gameTokenAccount);
					break;
				case 2:
					await mintTokenForPayout(this.mintAccount, this.gameTokenAccount, this.authorityKeypair, this.feePayerKeypair);
					break;
				case 0:
					break;
				default:
					console.log('Invalid choice');
			}
		}
	}
}

async function mintTokenForPayout(mintAccount: Keypair, gameTokenAccount: Keypair, authorityKeypair: Keypair, feePayerKeypair: Keypair) {
	const mintAmount = Number(prompt('Enter amount to mint: '));
	await mintToken(mintAmount * Math.pow(10, TOKEN_DECIMALS), mintAccount, gameTokenAccount, authorityKeypair, feePayerKeypair);
	console.log('Mint success');
}

async function showAvailablePayoutAmount(gameTokenAccount: Keypair) {
	const gameTokenAccountInfo = await connection.getTokenAccountBalance(gameTokenAccount.publicKey);
	console.log('');
	console.log(gameTokenAccount.publicKey.toBase58(), `${gameTokenAccountInfo.value.uiAmountString} SPL token`);
}
