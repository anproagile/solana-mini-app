import { Keypair } from '@solana/web3.js';

export class BaseModule {
	feePayerKeypair: Keypair;
	ownerKeypair: Keypair;
	authorityKeypair: Keypair;
	mintAccount: Keypair;
	gameTokenAccount: Keypair;
	gameAccount: Keypair;

	constructor(feePayerKeypair: Keypair, ownerKeypair: Keypair, authorityKeypair: Keypair, mintAccount: Keypair, gameTokenAccount: Keypair, gameAccount: Keypair) {
		this.feePayerKeypair = feePayerKeypair;
		this.ownerKeypair = ownerKeypair;
		this.mintAccount = mintAccount;
		this.authorityKeypair = authorityKeypair;
		this.gameTokenAccount = gameTokenAccount;
		this.gameAccount = gameAccount;
	}
}
