import { Keypair } from '@solana/web3.js';

export class Player {
	keypair: Keypair;
	account: Keypair;
	tokenAccount: Keypair;
	constructor(keypair: Keypair, account: Keypair, tokenAccount: Keypair) {
		this.keypair = keypair;
		this.account = account;
		this.tokenAccount = tokenAccount;
	}
}
