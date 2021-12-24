import * as SplToken from '@solana/spl-token';
import { AccountMeta, Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, sendAndConfirmTransaction, SystemProgram, Transaction, TransactionInstruction } from '@solana/web3.js';
import BN from 'bn.js';
import { deserialize, deserializeUnchecked, serialize } from 'borsh';
import { getPayerKeypair, getDeployedProgramKeypair } from './utils';

const RPC_URL = 'http://127.0.0.1:8899';
const connection = new Connection(RPC_URL, 'confirmed');

class Assignable {
	constructor(properties: Object) {
		Object.keys(properties).map((key) => {
			//@ts-expect-error
			this[key] = properties[key];
		});
	}
}

class Payload extends Assignable {}
class StorageData extends Assignable {}
class GameInfo extends Assignable {}

const StorageSchema = new Map([
	[
		StorageData,
		{
			kind: 'struct',
			fields: [
				['is_initialized', 'u8'],
				[
					'btree_storage',
					{
						kind: 'map',
						key: 'string',
						value: 'string',
					},
				],
			],
		},
	],
]);

const PayloadSchema = new Map([
	[
		Payload,
		{
			kind: 'struct',
			fields: [
				['choice', 'u8'],
				['key', 'string'],
				['value', 'string'],
			],
		},
	],
]);

const GameInfoSchema = new Map([
	[
		GameInfo,
		{
			kind: 'struct',
			fields: [
				['is_initialized', 'u8'],
				['spl_token_account', ['u8', 32]],
			],
		},
	],
]);

async function start() {
	const line = '-'.repeat(process.stdout.columns);
	const { mintAccountKeypair, tokenAccountKeypair } = await createNewToken();
	const playerKeypair = await createPlayerKeypair();
	console.log('Player account address', playerKeypair.publicKey.toBase58());
	const uplineKeypair = await createPlayerKeypair();
	// console.log('Upline player account address', uplineKeypair.publicKey.toBase58());
	console.log(line);
	// console.log('Before init', JSON.stringify(await (await connection.getParsedAccountInfo(tokenAccountKeypair.publicKey)).value?.data, null, 5));
	await testInit(tokenAccountKeypair);
	// console.log('After init', JSON.stringify(await (await connection.getParsedAccountInfo(tokenAccountKeypair.publicKey)).value?.data, null, 5));
	// const pdaKeypair = await PublicKey.findProgramAddress([Buffer.from('game_seed')], getProgramKeypair().publicKey);
	// console.log('PDA pub key', pdaKeypair[0].toBase58());
	console.log(line);
	await testRegister(uplineKeypair);
	console.log(line);
	await testRegister(playerKeypair, uplineKeypair);
	console.log(line);
	await testAddReward(playerKeypair);
	console.log(line);
	await deserializePlayer(await getOrcreateProgramAccountIfNotExists('ply_' + playerKeypair.publicKey.toBase58().slice(5, 15), 85));
	await deserializePlayer(await getOrcreateProgramAccountIfNotExists('ply_' + uplineKeypair.publicKey.toBase58().slice(5, 15), 85));
	console.log(line);
	const playerTokenAccountKeypair = await createTokenAccount(mintAccountKeypair, playerKeypair);
	console.log('Player token account', playerTokenAccountKeypair.publicKey.toBase58());
	await testClaimReward(tokenAccountKeypair, playerKeypair, playerTokenAccountKeypair);
	console.log('Player token account', JSON.stringify(await (await connection.getParsedAccountInfo(playerTokenAccountKeypair.publicKey)).value?.data, null, 5));
	console.log(line);
	await deserializePlayer(await getOrcreateProgramAccountIfNotExists('ply_' + playerKeypair.publicKey.toBase58().slice(5, 15), 85));
}

// 0 - [signer]   - The player (holder) account
// 1 - [writable] - Program account
// 2 - [writable] - The player program account
// 3 - []         - The token account of the current program
// 4-  []         - The PDA, owner (in term of token, not account owner) of token account
// 5 - []         - The player token account
// 6 - []         - The token program
async function testClaimReward(programTokenAccountKeypair: Keypair, playerKeypair: Keypair, playerTokenAccountKeypair: Keypair) {
	const SCHEMA = new Map([
		[
			Payload,
			{
				kind: 'struct',
				fields: [['tag', 'u8']],
			},
		],
	]);
	const gameProgramAccountPublicKey = await getOrcreateProgramAccountIfNotExists('game_info', 65);
	const playerProgramAccountPublicKey = await getOrcreateProgramAccountIfNotExists('ply_' + playerKeypair.publicKey.toBase58().slice(5, 15), 85);
	// const payerKeyPair = getPayerKeypair();
	const programKeyPair = getDeployedProgramKeypair();
	const programId = programKeyPair.publicKey;
	const pdaKeypair = await PublicKey.findProgramAddress([Buffer.from('game_seed')], programId);
	console.log(pdaKeypair[0].toBytes());
	const transaction = new Transaction().add(
		new TransactionInstruction({
			keys: [
				{ pubkey: playerKeypair.publicKey, isWritable: false, isSigner: true },
				{ pubkey: gameProgramAccountPublicKey, isSigner: false, isWritable: true },
				{ pubkey: playerProgramAccountPublicKey, isSigner: false, isWritable: true },
				{ pubkey: programTokenAccountKeypair.publicKey, isSigner: false, isWritable: true },
				{ pubkey: pdaKeypair[0], isSigner: false, isWritable: false },
				{ pubkey: playerTokenAccountKeypair.publicKey, isSigner: false, isWritable: true },
				{ pubkey: SplToken.TOKEN_PROGRAM_ID, isWritable: false, isSigner: false },
			],
			programId,
			data: Buffer.from(
				serialize(
					SCHEMA,
					new Payload({
						tag: 3,
					}),
				),
			),
		}),
	);
	await sendAndConfirmTransaction(connection, transaction, [playerKeypair]);
}

async function deserializePlayer(playerAccountPublicKey: PublicKey) {
	const account = await connection.getAccountInfo(playerAccountPublicKey);
	const SCHEMA = new Map([
		[
			Payload,
			{
				kind: 'struct',
				fields: [
					['is_initialized', 'u8'],
					['owner', ['u8', 32]],
					['reward_to_claim', 'u128'],
					['has_upline', ['u8', 4]],
					['upline', ['u8', 32]],
				],
			},
		],
	]);
	if (account) {
		const deserializedPlayerAccountData = deserialize(SCHEMA, Payload, account.data);
		//@ts-expect-error
		const { is_initialized, owner, reward_to_claim, has_upline, upline } = deserializedPlayerAccountData;
		console.log('is_initialized', Boolean(is_initialized));
		console.log('owner', new PublicKey(owner).toBase58());
		console.log('reward_to_claim', reward_to_claim);
		console.log('has_upline', Boolean(has_upline));
		if (Boolean(has_upline)) {
			console.log('upline', new PublicKey(upline).toBase58());
		}
		if (Boolean(is_initialized)) {
			return deserializedPlayerAccountData;
		}
	}
}

// 0 - [signer]   - The admin (holder) account
// 1 - [writable] - Program account
// 2 - [writable] - An token account created by the admin, and pre-funded
// 3 - []         - The token program
async function testInit(tokenAccountKeypair: Keypair) {
	const SCHEMA = new Map([
		[
			Payload,
			{
				kind: 'struct',
				fields: [['tag', 'u8']],
			},
		],
	]);
	const programAccountPublicKey = await getOrcreateProgramAccountIfNotExists('game_info', 65);
	const adminKeyPair = getPayerKeypair();
	const programKeyPair = getDeployedProgramKeypair();
	const programId = programKeyPair.publicKey;
	const instruction = new TransactionInstruction({
		keys: [
			{ isSigner: true, isWritable: false, pubkey: adminKeyPair.publicKey },
			{ isSigner: false, isWritable: true, pubkey: programAccountPublicKey },
			{ isSigner: false, isWritable: true, pubkey: tokenAccountKeypair.publicKey },
			{ isSigner: false, isWritable: false, pubkey: SplToken.TOKEN_PROGRAM_ID },
		],
		programId,
		data: Buffer.from(
			serialize(
				SCHEMA,
				new Payload({
					tag: 0,
				}),
			),
		),
	});
	const transaction = new Transaction().add(instruction);
	await sendAndConfirmTransaction(connection, transaction, [adminKeyPair]);
	// console.log('After call game init');
	// console.log('Token account info', JSON.stringify(await (await connection.getParsedAccountInfo(tokenAccountKeypair.publicKey)).value?.data, null, 5));
}

// 0 - [signer]   - The admin (holder) account
// 1 - [writable] - Program account
// 2 - [writable] - The player program account
// 3 - [writable] - The player upline program account
async function testAddReward(playerToReceiveRewardKeypair: Keypair) {
	const SCHEMA = new Map([
		[
			Payload,
			{
				kind: 'struct',
				fields: [
					['tag', 'u8'],
					['reward_amount', 'u128'],
				],
			},
		],
	]);
	const gameProgramAccountKeypair = await getOrcreateProgramAccountIfNotExists('game_info', 65);
	const playerProgramAccoutKeypair = await getOrcreateProgramAccountIfNotExists('ply_' + playerToReceiveRewardKeypair.publicKey.toBase58().slice(5, 15), 85);
	const uplinePlayerProgramAccountData = await deserializePlayer(playerProgramAccoutKeypair);
	const payerKeyPair = getPayerKeypair();
	const adminKeyPair = payerKeyPair;
	const programKeyPair = getDeployedProgramKeypair();
	const programId = programKeyPair.publicKey;
	const keys: AccountMeta[] = [
		{ pubkey: adminKeyPair.publicKey, isSigner: true, isWritable: false },
		{ pubkey: gameProgramAccountKeypair, isSigner: false, isWritable: true },
		{ pubkey: playerProgramAccoutKeypair, isSigner: false, isWritable: true },
	];
	if (uplinePlayerProgramAccountData) {
		//@ts-expect-error
		const uplineProgramAccountKeypair = await getOrcreateProgramAccountIfNotExists('ply_' + new PublicKey(uplinePlayerProgramAccountData.upline).toBase58().slice(5, 15), 85);
		keys.push({ pubkey: uplineProgramAccountKeypair, isSigner: false, isWritable: true });
	}
	const instruction = new TransactionInstruction({
		keys,
		programId,
		data: Buffer.from(
			serialize(
				SCHEMA,
				new Payload({
					tag: 2,
					reward_amount: new BN(10000000000), // 100
				}),
			),
		),
	});
	const transaction = new Transaction();
	transaction.add(instruction);
	await sendAndConfirmTransaction(connection, transaction, [payerKeyPair]);
}

// 0 - [signer]   - The player (holder) account
// 1 - [writable] - The player account for the program
async function testRegister(playerKeypair: Keypair, uplineKeypair?: Keypair) {
	const SCHEMA = new Map([
		[
			Payload,
			{
				kind: 'struct',
				fields: [
					['tag', 'u8'],
					[
						'upline',
						{
							kind: 'option',
							type: ['u8', 32],
						},
					],
				],
			},
		],
	]);
	const playerAccountPublicKey = await getOrcreateProgramAccountIfNotExists('ply_' + playerKeypair.publicKey.toBase58().slice(5, 15), 85);
	const programKeyPair = getDeployedProgramKeypair();
	const programId = programKeyPair.publicKey;
	const payloadParam = {
		tag: 1,
	};
	if (uplineKeypair) {
		//@ts-expect-error
		payloadParam.upline = uplineKeypair.publicKey.toBytes();
	}
	const instruction = new TransactionInstruction({
		keys: [
			{ pubkey: playerKeypair.publicKey, isSigner: true, isWritable: false },
			{ pubkey: playerAccountPublicKey, isSigner: false, isWritable: true },
		],
		programId,
		data: Buffer.from(serialize(SCHEMA, new Payload(payloadParam))),
	});
	const transaction = new Transaction();
	transaction.add(instruction);
	await sendAndConfirmTransaction(connection, transaction, [playerKeypair]);
}

async function testAccountDataSerializationAndDeserialization() {
	const programAccountPublicKey = await getOrcreateProgramAccountIfNotExists('test', 0);
	const payerKeyPair = getPayerKeypair();
	const programKeyPair = getDeployedProgramKeypair();
	const programId = programKeyPair.publicKey;
	// console.log(info?.owner.toString(), programId.toString());
	const instruction = new TransactionInstruction({
		keys: [
			{ pubkey: programAccountPublicKey, isSigner: false, isWritable: true },
			{ pubkey: programAccountPublicKey, isSigner: false, isWritable: true },
			{ pubkey: programAccountPublicKey, isSigner: false, isWritable: true },
		],
		programId,
		data: Buffer.alloc(0),
	});
	const transaction = new Transaction();
	transaction.add(instruction);
	const transactionSignature = await sendAndConfirmTransaction(connection, transaction, [payerKeyPair]);
	console.log(transactionSignature);
	const info = await connection.getAccountInfo(programAccountPublicKey);
	const deserializedGameInfo = deserialize(GameInfoSchema, GameInfo, info?.data || Buffer.alloc(0));
	console.log(deserializedGameInfo);
}

async function printProgramAccountData(programAccountPublicKey: PublicKey) {
	const programData = await connection.getAccountInfo(programAccountPublicKey);
	if (programData === null) {
		throw new Error('Program account not exists');
	}
	// let emulatedBTree = new Map();
	// emulatedBTree.set('hello', 'world');
	// const sampleStorageData = new StorageData({
	// 	is_initialized: true,
	// 	btree_storage: emulatedBTree,
	// });
	// const serialized = Buffer.from(serialize(StorageSchema, sampleStorageData));
	// const deserialized = deserialize(StorageSchema, StorageData, serialized);
	// console.log(deserialized);
	const deserializedStorage = deserializeUnchecked(StorageSchema, StorageData, programData.data);
	console.log(programData.data.length);
	console.log(`Program account ${programAccountPublicKey.toBase58()}`);
	console.log('Data', deserializedStorage);
}

async function test(programAccountPublicKey: PublicKey) {
	const payerKeyPair = getPayerKeypair();
	const programKeyPair = getDeployedProgramKeypair();
	const programId = programKeyPair.publicKey;
	const payload = new Payload({
		choice: 100,
		key: 'Hello2',
		value: 'World2',
	});
	const serializedPayloadBuffer = Buffer.from(serialize(PayloadSchema, payload));
	const instruction = new TransactionInstruction({
		keys: [{ pubkey: programAccountPublicKey, isSigner: false, isWritable: true }],
		programId,
		data: serializedPayloadBuffer,
	});
	const transaction = new Transaction();
	transaction.add(instruction);
	const transactionSignature = await sendAndConfirmTransaction(connection, transaction, [payerKeyPair]);
	console.log(transactionSignature);
}

async function createPlayerKeypair() {
	const playerKeypair = Keypair.generate();
	await connection.requestAirdrop(playerKeypair.publicKey, LAMPORTS_PER_SOL);
	return playerKeypair;
}

async function createTokenAccount(mintAccountKeypair: Keypair, tokenOwnerKeypair: Keypair) {
	const payerKeyPair = getPayerKeypair();
	const tokenAccountKeypair = Keypair.generate();
	const lamportsForTokenAccount = await connection.getMinimumBalanceForRentExemption(SplToken.AccountLayout.span);
	let transaction = new Transaction().add(
		// Token account
		SystemProgram.createAccount({
			fromPubkey: payerKeyPair.publicKey,
			newAccountPubkey: tokenAccountKeypair.publicKey,
			space: SplToken.AccountLayout.span,
			lamports: lamportsForTokenAccount,
			programId: SplToken.TOKEN_PROGRAM_ID,
		}),
		SplToken.Token.createInitAccountInstruction(SplToken.TOKEN_PROGRAM_ID, mintAccountKeypair.publicKey, tokenAccountKeypair.publicKey, tokenOwnerKeypair.publicKey),
	);
	await sendAndConfirmTransaction(connection, transaction, [payerKeyPair, tokenAccountKeypair]);
	return tokenAccountKeypair;
}

async function createNewToken() {
	const payerKeyPair = getPayerKeypair();
	const tokenAccountKeypair = Keypair.generate();
	const mintAccountKeypair = Keypair.generate();
	const [lamportsForMintAccount, lamportsForTokenAccount] = await Promise.all([
		connection.getMinimumBalanceForRentExemption(SplToken.MintLayout.span),
		connection.getMinimumBalanceForRentExemption(SplToken.AccountLayout.span),
	]);
	let transaction = new Transaction().add(
		// Mint account
		SystemProgram.createAccount({
			fromPubkey: payerKeyPair.publicKey,
			newAccountPubkey: mintAccountKeypair.publicKey,
			space: SplToken.MintLayout.span,
			lamports: lamportsForMintAccount,
			programId: SplToken.TOKEN_PROGRAM_ID,
		}),
		// Token account
		SystemProgram.createAccount({
			fromPubkey: payerKeyPair.publicKey,
			newAccountPubkey: tokenAccountKeypair.publicKey,
			space: SplToken.AccountLayout.span,
			lamports: lamportsForTokenAccount,
			programId: SplToken.TOKEN_PROGRAM_ID,
		}),
	);
	await sendAndConfirmTransaction(connection, transaction, [payerKeyPair, mintAccountKeypair, tokenAccountKeypair]);
	// Initialize mint account, minting / freeze will require signature from payerKeypair
	transaction = new Transaction().add(
		SplToken.Token.createInitMintInstruction(SplToken.TOKEN_PROGRAM_ID, mintAccountKeypair.publicKey, 8, payerKeyPair.publicKey, payerKeyPair.publicKey),
		SplToken.Token.createInitAccountInstruction(SplToken.TOKEN_PROGRAM_ID, mintAccountKeypair.publicKey, tokenAccountKeypair.publicKey, payerKeyPair.publicKey),
	);
	await sendAndConfirmTransaction(connection, transaction, [payerKeyPair]);
	// console.log('Before mint');
	// console.log('Mint account info', JSON.stringify(await (await connection.getParsedAccountInfo(mintAccountKeypair.publicKey)).value?.data, null, 5));
	// console.log('Token account info', JSON.stringify(await (await connection.getParsedAccountInfo(tokenAccountKeypair.publicKey)).value?.data, null, 5));
	// Mint token
	transaction = new Transaction().add(
		SplToken.Token.createMintToInstruction(SplToken.TOKEN_PROGRAM_ID, mintAccountKeypair.publicKey, tokenAccountKeypair.publicKey, payerKeyPair.publicKey, [], 100000e8),
	);
	await sendAndConfirmTransaction(connection, transaction, [payerKeyPair]);
	// console.log('After mint');
	// console.log('Mint account info', JSON.stringify(await (await connection.getParsedAccountInfo(mintAccountKeypair.publicKey)).value?.data, null, 5));
	// console.log('Token account info', JSON.stringify(await (await connection.getParsedAccountInfo(tokenAccountKeypair.publicKey)).value?.data, null, 5));
	return {
		tokenAccountKeypair,
		mintAccountKeypair,
	};
}

async function getOrcreateProgramAccountIfNotExists(seed: string, space: number) {
	const payerKeyPair = getPayerKeypair();
	const programKeyPair = getDeployedProgramKeypair();
	const programId = programKeyPair.publicKey;

	const programInfo = await connection.getAccountInfo(programId);
	if (programInfo === null) {
		throw new Error('Please deploy the program');
	}
	if (!programInfo.executable) {
		throw new Error('The program is not executable');
	}

	const programAccountPublicKey = await PublicKey.createWithSeed(payerKeyPair.publicKey, seed, programId);
	let programAccountInfo = await connection.getAccountInfo(programAccountPublicKey);

	if (programAccountInfo === null) {
		console.log(`Program ${programId} doesn't have account for program state`);
		// Solana default max account size = 10 MB, here we put only 1 MB
		// const space = 1048576;
		const lamportsToExemptRent = await connection.getMinimumBalanceForRentExemption(space);
		const transaction = new Transaction().add(
			SystemProgram.createAccountWithSeed({
				fromPubkey: payerKeyPair.publicKey,
				basePubkey: payerKeyPair.publicKey,
				seed,
				newAccountPubkey: programAccountPublicKey,
				lamports: lamportsToExemptRent,
				space,
				programId,
			}),
		);
		const transactionSignature = await sendAndConfirmTransaction(connection, transaction, [payerKeyPair]);
		console.log('Program account created. Transaction hash', transactionSignature);
	}
	console.log('Program account public key', programAccountPublicKey.toBase58());
	return programAccountPublicKey;
}

start()
	.then(() => process.exit(0))
	.catch(console.error);
