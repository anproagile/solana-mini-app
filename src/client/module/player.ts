import { Keypair, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import PromptSync from 'prompt-sync';
import { connection } from '../config';
import { Player } from '../models/player';
import { SchemaBuilder } from '../schema/builder';
import { fromSchemaDataToPlayerState, PlayerStateSchema } from '../schema/states';
import { createPlayerAccount, createPlayerKeypair, createTokenAccount, registerPlayer } from '../utils';
import { BaseModule } from './base';

const prompt = PromptSync();
const EXIT = 0;
const players: Player[] = [];

export class PlayerModule extends BaseModule {
	async execute() {
		let choice = 1;
		while (choice != EXIT) {
			console.log('');
			console.log('Player module');
			console.log('1. Register new player');
			console.log('2. Show player details');
			console.log('0. Back');
			choice = Number(prompt('Enter your choice: '));

			switch (choice) {
				case 1:
					let newPlayer = await registerNewPlayer(this.gameAccount, this.mintAccount);
					if (newPlayer) {
						players.push(newPlayer);
					}
					break;
				case 2:
					if (players.length > 0) {
						await showPlayerDetailsMenu();
					} else {
						console.log('Player list empty');
					}
					break;
				case 0:
					break;
				default:
					console.log('Invalid choice');
			}
		}
	}
}

async function showPlayerDetailsMenu() {
	let choice = 1;
	while (choice != EXIT) {
		console.log('');
		console.log('Players');
		for (let i = 0; i < players.length; i++) {
			console.log(`${i + 1}. ${players[i].keypair.publicKey.toBase58()}`);
		}
		console.log('0. Back');
		choice = Number(prompt('Enter number to view player details: '));
		if (choice >= 1 && choice <= players.length) {
			await printPlayerDetails(players[choice - 1]);
		} else {
			console.log('Invalid choice');
		}
	}
}

async function printPlayerDetails(player: Player) {
	console.log('');
	const walletAccountInfo = await connection.getAccountInfo(player.keypair.publicKey);
	const tokenAccountInfo = await connection.getTokenAccountBalance(player.tokenAccount.publicKey);
	const playerAccountInfo = await connection.getAccountInfo(player.account.publicKey);
	if (walletAccountInfo) {
		console.log(player.keypair.publicKey.toBase58(), `${walletAccountInfo.lamports / LAMPORTS_PER_SOL} SOL`);
	}
	if (tokenAccountInfo) {
		console.log(player.tokenAccount.publicKey.toBase58(), `${tokenAccountInfo.value.uiAmountString} SPL token`);
	}
	if (playerAccountInfo) {
		const playerState = fromSchemaDataToPlayerState(SchemaBuilder.deserialize(PlayerStateSchema, playerAccountInfo.data));
		console.log('Player info');
		console.log('Program account - ' + player.account.publicKey.toBase58());
		console.log('Has upline      - ' + playerState.has_upline);
		if (playerState.upline) {
			console.log('Upline          - ' + playerState.upline.toBase58());
		}
		console.log('Reward amount   - ' + playerState.reward_to_claim.toString());
		console.log('Owner           - ' + playerState.owner.toBase58());
	}
	console.log('');
}

async function selectUplineFromPlayerList(): Promise<PublicKey | undefined> {
	if (players.length > 0) {
		console.log('');
		console.log('Players account');
		for (let i = 0; i < players.length; i++) {
			console.log(`${i + 1}. ${players[i].account.publicKey.toBase58()}`);
		}
		console.log('0 - No upline');
		const input: string = prompt('Select upline or manual enter account address: ');
		const isPubkeyEntered: boolean = Number.isNaN(Number(input));
		if (isPubkeyEntered) {
			return new PublicKey(input);
		}
		let choice = Number(input);
		return choice ? players[choice - 1].account.publicKey : undefined;
	}
}

async function registerNewPlayer(gameAccount: Keypair, mintAccount: Keypair) {
	try {
		const playerKeypair = await createPlayerKeypair();
		const playerAccount = await createPlayerAccount(playerKeypair);
		const uplinePubkey = await selectUplineFromPlayerList();
		if (uplinePubkey) {
			await registerPlayer(playerKeypair, playerAccount, gameAccount, playerKeypair, uplinePubkey);
		} else {
			await registerPlayer(playerKeypair, playerAccount, gameAccount, playerKeypair);
		}
		const playerTokenAccount = await createTokenAccount(mintAccount, playerKeypair, playerKeypair);
		console.log('Player created');
		return new Player(playerKeypair, playerAccount, playerTokenAccount);
	} catch (error: any) {
		console.error(error.message);
	}
}
