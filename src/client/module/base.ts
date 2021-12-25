import { Keypair } from '@solana/web3.js';
import { Player } from '../model/player';

export class BaseModule {
	feePayerKeypair: Keypair;
	ownerKeypair: Keypair;
	authorityKeypair: Keypair;
	mintAccount: Keypair;
	gameTokenAccount: Keypair;
	gameAccount: Keypair;
	players: Player[];

	constructor(
		feePayerKeypair: Keypair,
		ownerKeypair: Keypair,
		authorityKeypair: Keypair,
		mintAccount: Keypair,
		gameTokenAccount: Keypair,
		gameAccount: Keypair,
		players: Player[],
	) {
		this.feePayerKeypair = feePayerKeypair;
		this.ownerKeypair = ownerKeypair;
		this.mintAccount = mintAccount;
		this.authorityKeypair = authorityKeypair;
		this.gameTokenAccount = gameTokenAccount;
		this.gameAccount = gameAccount;
		this.players = players;
	}
}
