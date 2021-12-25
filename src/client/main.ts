import { Keypair } from '@solana/web3.js';
import PromptSync from 'prompt-sync';
import { TOKEN_DECIMALS } from './config';
import { Player } from './model/player';
import { AdminModule } from './module/admin';
import { PlayerModule } from './module/player';
import { createGameAccount, createNewToken, createTokenAccount, getDeployedProgramKeypairOrThrow, getPayerKeypair, initializeGame, mintToken } from './utils';
const prompt = PromptSync();

let feePayerKeypair = getPayerKeypair();
let ownerKeypair = feePayerKeypair;
let authorityKeypair = feePayerKeypair;
let mintAccount: Keypair;
let gameTokenAccount: Keypair;
let gameAccount: Keypair;
const players: Player[] = [];
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
	console.log('Initializing ...');
	await getDeployedProgramKeypairOrThrow();
	mintAccount = await createNewToken(TOKEN_DECIMALS, authorityKeypair, feePayerKeypair);
	gameTokenAccount = await createTokenAccount(mintAccount, ownerKeypair, feePayerKeypair);
	await mintToken(1000 * Math.pow(10, TOKEN_DECIMALS), mintAccount, gameTokenAccount, authorityKeypair, feePayerKeypair);
	gameAccount = await createGameAccount(feePayerKeypair);
	await initializeGame(gameTokenAccount.publicKey, ownerKeypair, gameAccount.publicKey, feePayerKeypair);

	const payoutModule = new AdminModule(feePayerKeypair, ownerKeypair, authorityKeypair, mintAccount, gameTokenAccount, gameAccount, players);
	const playerModule = new PlayerModule(feePayerKeypair, ownerKeypair, authorityKeypair, mintAccount, gameTokenAccount, gameAccount, players);
	return {
		payoutModule,
		playerModule,
	};
}

start()
	.then(() => process.exit(0))
	.catch(console.error);
