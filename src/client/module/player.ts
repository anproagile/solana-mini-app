import { Keypair, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import BN from 'bn.js';
import PromptSync from 'prompt-sync';
import { connection } from '../config';
import { Player } from '../model/player';
import { SchemaBuilder } from '../schema/builder';
import { fromSchemaDataToPlayerState, PlayerStateSchema } from '../schema/states';
import { claimReward, createPlayerAccount, createPlayerKeypair, createTokenAccount, registerPlayer } from '../utils';
import { BaseModule } from './base';

const prompt = PromptSync();
const EXIT = 0;

export class PlayerModule extends BaseModule {
	async execute() {
		let choice = 1;
		while (choice != EXIT) {
			console.log('');
			console.log('Player module');
			console.log('1. Register new player');
			console.log('2. Show player details');
			console.log('3. Player claim reward');
			console.log('0. Back');
			choice = Number(prompt('Enter your choice: '));

			switch (choice) {
				case 1:
					let newPlayer = await registerNewPlayer(this.gameAccount, this.mintAccount, this.players);
					if (newPlayer) {
						this.players.push(newPlayer);
					}
					break;
				case 2:
					if (this.players.length > 0) {
						await showPlayerDetailsMenu(this.players);
					} else {
						console.log('Player list empty');
					}
					break;
				case 3:
					await claim(this.players, this.gameAccount.publicKey, this.gameTokenAccount.publicKey);
					break;
				case 0:
					break;
				default:
					console.log('Invalid choice');
			}
		}
	}
}

async function showPlayerDetailsMenu(players: Player[]) {
	let choice = 1;
	while (choice != EXIT) {
		console.log('');
		console.log('Players');
		for (let i = 0; i < players.length; i++) {
			console.log(`${i + 1}. ${players[i].account.publicKey.toBase58()}`);
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
		console.log('Reward amount   - ' + playerState.reward_to_claim.div(new BN(LAMPORTS_PER_SOL)).toString());
		console.log('Owner           - ' + playerState.owner.toBase58());
	}
	console.log('');
}

async function selectUplineFromPlayerList(players: Player[]): Promise<PublicKey | undefined> {
	if (players.length > 0) {
		console.log('');
		console.log('Players');
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

async function registerNewPlayer(gameAccount: Keypair, mintAccount: Keypair, players: Player[]) {
	try {
		const playerKeypair = await createPlayerKeypair();
		const playerAccount = await createPlayerAccount(playerKeypair);
		const uplinePubkey = await selectUplineFromPlayerList(players);
		if (uplinePubkey) {
			await registerPlayer(playerKeypair, playerAccount.publicKey, gameAccount.publicKey, playerKeypair, uplinePubkey);
		} else {
			await registerPlayer(playerKeypair, playerAccount.publicKey, gameAccount.publicKey, playerKeypair);
		}
		const playerTokenAccount = await createTokenAccount(mintAccount, playerKeypair, playerKeypair);
		console.log('Player created');
		return new Player(playerKeypair, playerAccount, playerTokenAccount);
	} catch (error: any) {
		console.error(error.message);
	}
}

async function claim(players: Player[], gameAccountPubkey: PublicKey, gameTokenAccountPubkey: PublicKey) {
	if (players.length > 0) {
		console.log('');
		console.log('Players');
		for (let i = 0; i < players.length; i++) {
			console.log(`${i + 1}. ${players[i].account.publicKey.toBase58()}`);
		}
		console.log('0 - Back');
		const choice = Number(prompt('Select the player to claim reward: '));
		if (choice >= 1 && choice <= players.length) {
			const player = players[choice - 1];
			const playerAccountInfo = await connection.getAccountInfo(player.account.publicKey);
			if (playerAccountInfo) {
				const playerState = fromSchemaDataToPlayerState(SchemaBuilder.deserialize(PlayerStateSchema, playerAccountInfo.data));
				if (playerState.reward_to_claim.eq(new BN(0))) {
					console.log('No claimable reward');
				} else {
					await claimReward(player.keypair, gameAccountPubkey, player.account.publicKey, gameTokenAccountPubkey, player.tokenAccount.publicKey, player.keypair);
					console.log(`Claimed ${playerState.reward_to_claim.div(new BN(LAMPORTS_PER_SOL)).toString()} SPL token to ${player.tokenAccount.publicKey.toBase58()}`);
				}
			}
		} else if (choice === EXIT) {
			return;
		} else {
			console.log('Invalid choice');
		}
	} else {
		console.log('No players');
	}
}
