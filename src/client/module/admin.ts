import { Keypair } from '@solana/web3.js';
import PromptSync from 'prompt-sync';
import { connection, TOKEN_DECIMALS } from '../config';
import { Player } from '../model/player';
import { SchemaBuilder } from '../schema/builder';
import { fromSchemaDataToPlayerState, PlayerStateSchema } from '../schema/states';
import { addReward, mintToken } from '../utils';
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
			console.log('3. Add reward to player');
			console.log('0. Back');
			choice = Number(prompt('Enter your choice: '));

			switch (choice) {
				case 1:
					await showAvailablePayoutAmount(this.gameTokenAccount);
					break;
				case 2:
					await mintTokenForPayout(this.mintAccount, this.gameTokenAccount, this.authorityKeypair, this.feePayerKeypair);
					break;
				case 3:
					await addRewardToPlayer(this.players, this.ownerKeypair, this.gameAccount, this.gameTokenAccount);
					break;
				case 0:
					break;
				default:
					console.log('Invalid choice');
			}
		}
	}
}

async function checkSufficientAmountToPayout(reward: number, gameTokenAccount: Keypair) {
	const gameTokenAccountInfo = await connection.getTokenAccountBalance(gameTokenAccount.publicKey);
	if (reward > (gameTokenAccountInfo.value.uiAmount || 0)) {
		throw new Error('Insufficient amount to payout for player');
	}
}

async function addRewardToPlayer(players: Player[], ownerKeypair: Keypair, gameAccount: Keypair, gameTokenAccount: Keypair) {
	if (players.length > 0) {
		try {
			console.log('');
			console.log('Players');
			for (let i = 0; i < players.length; i++) {
				console.log(`${i + 1}. ${players[i].account.publicKey.toBase58()}`);
			}
			console.log('0 - To cancel');
			const choice = Number(prompt('Select player to add reward: '));
			if (choice >= 1 && choice <= players.length) {
				const player = players[choice - 1];
				const amount = Number.parseInt(prompt('Enter reward amount: '));
				if (amount > 0) {
					await checkSufficientAmountToPayout(amount, gameTokenAccount);
					const playerAccountInfo = await connection.getAccountInfo(player.account.publicKey);
					if (playerAccountInfo) {
						const playerState = fromSchemaDataToPlayerState(SchemaBuilder.deserialize(PlayerStateSchema, playerAccountInfo.data));
						if (playerState.has_upline && playerState.upline) {
							await addReward(amount, ownerKeypair, ownerKeypair, gameAccount.publicKey, player.account.publicKey, playerState.upline);
						} else {
							await addReward(amount, ownerKeypair, ownerKeypair, gameAccount.publicKey, player.account.publicKey);
						}
						console.log('Reward added');
					} else {
						console.log('Player not found');
					}
				} else {
					console.log('Invalid reward amount');
				}
			}
		} catch (error: any) {
			console.error(error.message);
		}
	} else {
		console.log('No players');
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
