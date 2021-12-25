import { Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';
import BN from 'bn.js';
import PromptSync from 'prompt-sync';
import { connection, TOKEN_DECIMALS } from './config';
import { AdminModule } from './module/admin';
import { PlayerModule } from './module/player';
import { SchemaBuilder } from './schema/builder';
import { fromSchemaDataToPlayerState, PlayerStateSchema } from './schema/states';
import {
	addReward,
	claimReward,
	createGameAccount,
	createNewToken,
	createPlayerAccount,
	createPlayerKeypair,
	createTokenAccount,
	getPayerKeypair,
	initializeGame,
	mintToken,
	registerPlayer,
	toJSONStringAndBeautify,
} from './utils';
const prompt = PromptSync();

let feePayerKeypair = getPayerKeypair();
let ownerKeypair = feePayerKeypair;
let authorityKeypair = feePayerKeypair;
let mintAccount: Keypair;
let gameTokenAccount: Keypair;
let gameAccount: Keypair;
const EXIT = 0;

async function start() {
	const { payoutModule, playerModule } = await initialize();
	let choice = 1;
	while (choice != EXIT) {
		console.log('');
		console.log('Main menu');
		console.log('1. Admin module');
		console.log('2. Player module');
		console.log('0. Exit');
		choice = Number(prompt('Enter your choice: '));

		switch (choice) {
			case 1:
				await payoutModule.execute();
				break;
			case 2:
				await playerModule.execute();
				break;
			case 0:
				console.log('Bye bye');
				break;
			default:
				console.log('Invalid choice');
		}
	}
}

async function initialize() {
	mintAccount = await createNewToken(TOKEN_DECIMALS, authorityKeypair, feePayerKeypair);
	gameTokenAccount = await createTokenAccount(mintAccount, ownerKeypair, feePayerKeypair);
	await mintToken(1000 * Math.pow(10, TOKEN_DECIMALS), mintAccount, gameTokenAccount, authorityKeypair, feePayerKeypair);
	gameAccount = await createGameAccount(feePayerKeypair);
	await initializeGame(gameTokenAccount, ownerKeypair, gameAccount, feePayerKeypair);

	const payoutModule = new AdminModule(feePayerKeypair, ownerKeypair, authorityKeypair, mintAccount, gameTokenAccount, gameAccount);
	const playerModule = new PlayerModule(feePayerKeypair, ownerKeypair, authorityKeypair, mintAccount, gameTokenAccount, gameAccount);
	return {
		payoutModule,
		playerModule,
	};
}

async function start2() {
	const feePayerKeypair = getPayerKeypair();
	const ownerKeypair = feePayerKeypair;
	const authorityKeypair = feePayerKeypair;
	const mintAccount = await createNewToken(TOKEN_DECIMALS, authorityKeypair, feePayerKeypair);
	const gameTokenAccount = await createTokenAccount(mintAccount, ownerKeypair, feePayerKeypair);
	await mintToken(1000 * Math.pow(10, TOKEN_DECIMALS), mintAccount, gameTokenAccount, authorityKeypair, feePayerKeypair);
	const gameTokenAccountInfo = await connection.getParsedAccountInfo(gameTokenAccount.publicKey);
	// console.log(toJSONStringAndBeautify(gameTokenAccountInfo.value));
	const gameAccount = await createGameAccount(feePayerKeypair);
	await initializeGame(gameTokenAccount, ownerKeypair, gameAccount, feePayerKeypair);
	const gameAccountInfo = await connection.getAccountInfo(gameAccount.publicKey);
	const playerOneKeypair = await createPlayerKeypair();
	const playerOneAccount = await createPlayerAccount(playerOneKeypair);

	const playerTwoKeypair = await createPlayerKeypair();
	const playerTwoAccount = await createPlayerAccount(playerTwoKeypair);

	await registerPlayer(playerOneKeypair, playerOneAccount, gameAccount, playerOneKeypair);
	await registerPlayer(playerTwoKeypair, playerTwoAccount, gameAccount, playerTwoKeypair, playerOneAccount.publicKey);

	await addReward(100, ownerKeypair, ownerKeypair, gameAccount, playerTwoAccount, playerOneAccount);
	await addReward(100, ownerKeypair, ownerKeypair, gameAccount, playerOneAccount);

	const playerOneTokenAccount = await createTokenAccount(mintAccount, playerOneKeypair, playerOneKeypair);
	await claimReward(playerOneKeypair, gameAccount, playerOneAccount, gameTokenAccount, playerOneTokenAccount);

	const [playerOneAccountInfo, playerTwoAccountInfo] = await Promise.all([
		connection.getAccountInfo(playerOneAccount.publicKey),
		connection.getAccountInfo(playerTwoAccount.publicKey),
	]);
	if (playerOneAccountInfo) {
		const playerOneState = fromSchemaDataToPlayerState(SchemaBuilder.deserialize(PlayerStateSchema, playerOneAccountInfo.data));
		console.log('Player one');
		console.log('is_initialized', playerOneState.is_initialized);
		console.log('has_upline', playerOneState.has_upline);
		console.log('upline', playerOneState.upline);
		console.log('reward_to_claim', playerOneState.reward_to_claim.div(new BN(LAMPORTS_PER_SOL)).toString());
		console.log('owner', playerOneState.owner.toBase58());
	}
	if (playerTwoAccountInfo) {
		const playerTwoState = fromSchemaDataToPlayerState(SchemaBuilder.deserialize(PlayerStateSchema, playerTwoAccountInfo.data));
		console.log('Player two');
		console.log('is_initialized', playerTwoState.is_initialized);
		console.log('has_upline', playerTwoState.has_upline);
		console.log('upline', playerTwoState.upline);
		console.log('reward_to_claim', playerTwoState.reward_to_claim.div(new BN(LAMPORTS_PER_SOL)).toString());
		console.log('owner', playerTwoState.owner.toBase58());
	}

	const playerOneTokenAccountInfo = await connection.getParsedAccountInfo(playerOneTokenAccount.publicKey);
	console.log(toJSONStringAndBeautify(playerOneTokenAccountInfo.value));
}

start()
	.then(() => process.exit(0))
	.catch(console.error);
