import { connection, TOKEN_DECIMALS } from './config';
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

async function start() {
	const feePayerKeypair = getPayerKeypair();
	const ownerKeypair = feePayerKeypair;
	const authorityKeypair = feePayerKeypair;
	const mintAccount = await createNewToken(TOKEN_DECIMALS, authorityKeypair, feePayerKeypair);
	const gameTokenAccount = await createTokenAccount(mintAccount, ownerKeypair, feePayerKeypair);
	await mintToken(1000 * Math.pow(10, TOKEN_DECIMALS), mintAccount, gameTokenAccount, authorityKeypair, feePayerKeypair);
	const gameTokenAccountInfo = await connection.getParsedAccountInfo(gameTokenAccount.publicKey);
	console.log(toJSONStringAndBeautify(gameTokenAccountInfo.value));
	const gameAccount = await createGameAccount(feePayerKeypair);
	await initializeGame(gameTokenAccount, ownerKeypair, gameAccount, feePayerKeypair);
	const gameAccountInfo = await connection.getAccountInfo(gameAccount.publicKey);
	const playerOneKeypair = await createPlayerKeypair();
	const playerOneAccount = await createPlayerAccount(playerOneKeypair);

	const playerTwoKeypair = await createPlayerKeypair();
	const playerTwoAccount = await createPlayerAccount(playerTwoKeypair);

	await registerPlayer(playerOneKeypair, playerOneAccount, playerOneKeypair);
	await registerPlayer(playerTwoKeypair, playerTwoAccount, playerTwoKeypair, playerOneKeypair);

	await addReward(100, ownerKeypair, ownerKeypair, gameAccount, playerTwoAccount, playerOneAccount);
	await addReward(100, ownerKeypair, ownerKeypair, gameAccount, playerOneAccount);

	const playerOneTokenAccount = await createTokenAccount(mintAccount, playerOneKeypair, playerOneKeypair);
	await claimReward(playerOneKeypair, gameAccount, playerOneAccount, gameTokenAccount, playerOneTokenAccount);

	// const [playerOneAccountInfo, playerTwoAccountInfo] = await Promise.all([
	// 	connection.getAccountInfo(playerOneAccount.publicKey),
	// 	connection.getAccountInfo(playerTwoAccount.publicKey),
	// ]);
	// if (playerOneAccountInfo) {
	// 	const playerOneState = fromSchemaDataToPlayerState(SchemaBuilder.deserialize(PlayerStateSchema, playerOneAccountInfo.data));
	// 	console.log('Player one');
	// 	console.log('is_initialized', playerOneState.is_initialized);
	// 	console.log('has_upline', playerOneState.has_upline);
	// 	console.log('reward_to_claim', playerOneState.reward_to_claim.div(new BN(LAMPORTS_PER_SOL)).toString());
	// 	console.log('owner', playerOneState.owner.toBase58());
	// }
	// if (playerTwoAccountInfo) {
	// 	const playerTwoState = fromSchemaDataToPlayerState(SchemaBuilder.deserialize(PlayerStateSchema, playerTwoAccountInfo.data));
	// 	console.log('Player two');
	// 	console.log('is_initialized', playerTwoState.is_initialized);
	// 	console.log('has_upline', playerTwoState.has_upline);
	// 	console.log('reward_to_claim', playerTwoState.reward_to_claim.div(new BN(LAMPORTS_PER_SOL)).toString());
	// 	console.log('owner', playerTwoState.owner.toBase58());
	// }

	// const playerOneTokenAccountInfo = await connection.getParsedAccountInfo(playerOneTokenAccount.publicKey);
	// console.log(toJSONStringAndBeautify(playerOneTokenAccountInfo.value));
}

start()
	.then(() => process.exit(0))
	.catch(console.error);
