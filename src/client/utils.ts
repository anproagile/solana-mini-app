import * as SplToken from '@solana/spl-token';
import { AccountMeta, Keypair, LAMPORTS_PER_SOL, PublicKey, sendAndConfirmTransaction, SystemProgram, Transaction, TransactionInstruction } from '@solana/web3.js';
import * as fs from 'fs';
import os from 'os';
import * as path from 'path';
import yaml from 'yaml';
import { connection, PDA_SEED, programKeypairPath } from './config';
import { SchemaBuilder, SchemaData } from './schema/builder';
import {
	AddRewardIxScheme,
	ClaimRewardIxSchema,
	GameInitIxSchema,
	IAddRewardIx,
	IClaimRewardIx,
	IGameInitIx,
	IPlayerRegisterIx,
	PlayerRegisterIxSchema,
} from './schema/instructions';
import { GAME_STATE_BYTE, PLAYER_STATE_BYTE } from './schema/states';
import { Tag } from './schema/tag';

export async function requestAirdropIfInsufficientBalance(feePayerKeypair: Keypair, signatureCount: number, bytes?: number[]) {
	const feePayerBalance = await connection.getBalance(feePayerKeypair.publicKey);
	const { feeCalculator } = await connection.getRecentBlockhash();
	let fee = 0;
	if (bytes) {
		for (const byte of bytes) {
			fee += await connection.getMinimumBalanceForRentExemption(byte);
		}
	}
	fee += feeCalculator.lamportsPerSignature * signatureCount;
	// console.log('Estimated fee', fee / LAMPORTS_PER_SOL);
	// console.log(feePayerKeypair.publicKey.toBase58(), feePayerBalance / LAMPORTS_PER_SOL + ' SOL');
	if (feePayerBalance <= fee) {
		const signature = await connection.requestAirdrop(feePayerKeypair.publicKey, fee);
		console.log('Airdrop transaction', signature);
		await connection.confirmTransaction(signature);
	}
}

// 0 - [signer]   - The player (holder) account
// 1 - [writable] - Program account
// 2 - [writable] - The player program account
// 3 - [writable] - The token account of the current program
// 4-  []         - The PDA, owner (in term of token, not account owner) of token account
// 5 - [writable] - The player token account
// 6 - []         - The token program
export async function claimReward(
	playerKeypair: Keypair,
	programAccountPubkey: PublicKey,
	playerAccountPubkey: PublicKey,
	gameTokenAccountPubkey: PublicKey,
	playerTokenAccountPubkey: PublicKey,
	feePayerKeypair: Keypair,
) {
	const programId = (await getDeployedProgramKeypairOrThrow()).publicKey;
	const [PDA] = await PublicKey.findProgramAddress([Buffer.from(PDA_SEED)], programId);
	const transaction = new Transaction().add(
		new TransactionInstruction({
			keys: [
				{ isSigner: true, isWritable: false, pubkey: playerKeypair.publicKey },
				{ isSigner: false, isWritable: true, pubkey: programAccountPubkey },
				{ isSigner: false, isWritable: true, pubkey: playerAccountPubkey },
				{ isSigner: false, isWritable: true, pubkey: gameTokenAccountPubkey },
				{ isSigner: false, isWritable: false, pubkey: PDA },
				{ isSigner: false, isWritable: true, pubkey: playerTokenAccountPubkey },
				{ isSigner: false, isWritable: false, pubkey: SplToken.TOKEN_PROGRAM_ID },
			],
			programId,
			data: SchemaBuilder.serialize(
				ClaimRewardIxSchema,
				new SchemaData({
					tag: Tag.Claim,
				} as IClaimRewardIx),
			),
		}),
	);
	await requestAirdropIfInsufficientBalance(feePayerKeypair, 1);
	const transactionSignature = await sendAndConfirmTransaction(connection, transaction, [feePayerKeypair, playerKeypair]);
	console.log('Claim reward instruction', transactionSignature);
}

// 0 - [signer]   - The admin (holder) account
// 1 - [writable] - Program account
// 2 - [writable] - The player program account
// 3 - [writable] - The player upline program account
export async function addReward(
	rewardAmountInSol: number,
	feePayerKeypair: Keypair,
	adminKeypair: Keypair,
	programAccountPubkey: PublicKey,
	playerAccountPubkey: PublicKey,
	playerUplineAccountPubkey?: PublicKey,
) {
	rewardAmountInSol = rewardAmountInSol * LAMPORTS_PER_SOL;
	const programId = (await getDeployedProgramKeypairOrThrow()).publicKey;
	const keys: AccountMeta[] = [
		{ isSigner: true, isWritable: false, pubkey: adminKeypair.publicKey },
		{ isSigner: false, isWritable: true, pubkey: programAccountPubkey },
		{ isSigner: false, isWritable: true, pubkey: playerAccountPubkey },
	];
	if (playerUplineAccountPubkey) {
		keys.push({ isSigner: false, isWritable: true, pubkey: playerUplineAccountPubkey });
	}
	const transaction = new Transaction().add(
		new TransactionInstruction({
			keys,
			programId,
			data: SchemaBuilder.serialize(
				AddRewardIxScheme,
				new SchemaData({
					tag: Tag.AddReward,
					reward_amount: rewardAmountInSol,
				} as IAddRewardIx),
			),
		}),
	);
	await requestAirdropIfInsufficientBalance(feePayerKeypair, 1);
	const transactionSignature = await sendAndConfirmTransaction(connection, transaction, [feePayerKeypair, adminKeypair]);
	console.log('Add reward instruction', transactionSignature);
}

// 0 - [signer]   - The admin (holder) account
// 1 - [writable] - Program account
// 2 - [writable] - An token account created by the admin, and pre-funded
// 3 - []         - The token program
export async function initializeGame(tokenAccountPublicKey: PublicKey, adminKeypair: Keypair, gameAccountPubkey: PublicKey, feePayerKeypair: Keypair) {
	const programId = (await getDeployedProgramKeypairOrThrow()).publicKey;
	const transaction = new Transaction().add(
		new TransactionInstruction({
			keys: [
				{ isSigner: true, isWritable: false, pubkey: adminKeypair.publicKey },
				{ isSigner: false, isWritable: true, pubkey: gameAccountPubkey },
				{ isSigner: false, isWritable: true, pubkey: tokenAccountPublicKey },
				{ isSigner: false, isWritable: false, pubkey: SplToken.TOKEN_PROGRAM_ID },
			],
			programId,
			data: SchemaBuilder.serialize(
				GameInitIxSchema,
				new SchemaData({
					tag: Tag.Init,
				} as IGameInitIx),
			),
		}),
	);
	await requestAirdropIfInsufficientBalance(feePayerKeypair, 1);
	const transactionSignature = await sendAndConfirmTransaction(connection, transaction, [feePayerKeypair, adminKeypair]);
	console.log('Initialize game account instruction', transactionSignature);
}

// 0 - [signer]   - The player (holder) account
// 1 - [writable] - The player account for the program
// 2 - []         - The program account
// 3 - []         - The upline player account for the program
export async function registerPlayer(playerKeypair: Keypair, playerAccountPubkey: PublicKey, programAccountPubkey: PublicKey, feePayerKeypair: Keypair, uplinePubkey?: PublicKey) {
	const programId = (await getDeployedProgramKeypairOrThrow()).publicKey;
	const playerRegisterInstruction: IPlayerRegisterIx = {
		tag: Tag.Register,
	};
	const keys: AccountMeta[] = [
		{ isSigner: true, isWritable: false, pubkey: playerKeypair.publicKey },
		{ isSigner: false, isWritable: true, pubkey: playerAccountPubkey },
		{ isSigner: false, isWritable: false, pubkey: programAccountPubkey },
	];
	if (uplinePubkey) {
		keys.push({ isSigner: false, isWritable: false, pubkey: uplinePubkey });
	}
	const transaction = new Transaction().add(
		new TransactionInstruction({
			keys,
			programId,
			data: SchemaBuilder.serialize(PlayerRegisterIxSchema, new SchemaData(playerRegisterInstruction)),
		}),
	);
	await requestAirdropIfInsufficientBalance(feePayerKeypair, 1);
	const transactionSignature = await sendAndConfirmTransaction(connection, transaction, [feePayerKeypair, playerKeypair]);
	console.log('Register player instruction', transactionSignature);
}

export async function createPlayerKeypair(): Promise<Keypair> {
	const playerKeypair = Keypair.generate();
	const signature = await connection.requestAirdrop(playerKeypair.publicKey, LAMPORTS_PER_SOL);
	await connection.confirmTransaction(signature);
	return playerKeypair;
}

export async function createPlayerAccount(feePayerKeypair: Keypair): Promise<Keypair> {
	const programId = (await getDeployedProgramKeypairOrThrow()).publicKey;
	const playerAccount = Keypair.generate();
	const lamportsForPlayerAccountRentExeption = await connection.getMinimumBalanceForRentExemption(PLAYER_STATE_BYTE);
	const transaction = new Transaction().add(
		SystemProgram.createAccount({
			fromPubkey: feePayerKeypair.publicKey,
			lamports: lamportsForPlayerAccountRentExeption,
			newAccountPubkey: playerAccount.publicKey,
			space: PLAYER_STATE_BYTE,
			programId,
		}),
	);
	await requestAirdropIfInsufficientBalance(feePayerKeypair, 1, [PLAYER_STATE_BYTE]);
	const transactionSignature = await sendAndConfirmTransaction(connection, transaction, [feePayerKeypair, playerAccount]);
	console.log('Player account created', transactionSignature);
	return playerAccount;
}

export async function createGameAccount(feePayerKeypair: Keypair): Promise<Keypair> {
	const programId = (await getDeployedProgramKeypairOrThrow()).publicKey;
	const gameAccount = Keypair.generate();
	const lamportsForGameAccountRentExeption = await connection.getMinimumBalanceForRentExemption(GAME_STATE_BYTE);
	const transaction = new Transaction().add(
		SystemProgram.createAccount({
			fromPubkey: feePayerKeypair.publicKey,
			lamports: lamportsForGameAccountRentExeption,
			newAccountPubkey: gameAccount.publicKey,
			space: GAME_STATE_BYTE,
			programId,
		}),
	);
	await requestAirdropIfInsufficientBalance(feePayerKeypair, 2, [GAME_STATE_BYTE]);
	const transactionSignature = await sendAndConfirmTransaction(connection, transaction, [feePayerKeypair, gameAccount]);
	console.log('Game account created', transactionSignature);
	return gameAccount;
}

export function toJSONStringAndBeautify(obj: any): string {
	return JSON.stringify(obj, null, 3);
}

export function getPayerKeypair(): Keypair {
	const CONFIG_FILE_PATH = path.resolve(os.homedir(), '.config', 'solana', 'cli', 'config.yml');
	const configYml = fs.readFileSync(CONFIG_FILE_PATH, { encoding: 'utf8' });
	const config = yaml.parse(configYml);
	const privateKeyString = fs.readFileSync(config.keypair_path, { encoding: 'utf-8' });
	const privateKey = Uint8Array.from(JSON.parse(privateKeyString));
	return Keypair.fromSecretKey(privateKey);
}

export async function getDeployedProgramKeypairOrThrow(): Promise<Keypair> {
	if (!fs.existsSync(programKeypairPath)) {
		throw new Error('Please deploy the program first before run the app');
	}
	const privateKeyString = fs.readFileSync(programKeypairPath, { encoding: 'utf-8' });
	const privateKey = Uint8Array.from(JSON.parse(privateKeyString));
	const programKeypair = Keypair.fromSecretKey(privateKey);

	const programAccount = await connection.getAccountInfo(programKeypair.publicKey);
	if (programAccount === null) {
		throw new Error('Program not found on the chain, are you sure you deployed to the correct chain ?');
	}
	if (programAccount.executable === false) {
		throw new Error('Program account is not executable');
	}
	return programKeypair;
}

export async function mintToken(amount: number, mintAccountKeypair: Keypair, receiverAccountKeypair: Keypair, authorityKeypair: Keypair, feePayerKeypair: Keypair) {
	const transaction = new Transaction().add(
		SplToken.Token.createMintToInstruction(SplToken.TOKEN_PROGRAM_ID, mintAccountKeypair.publicKey, receiverAccountKeypair.publicKey, authorityKeypair.publicKey, [], amount),
	);
	await requestAirdropIfInsufficientBalance(feePayerKeypair, 1);
	const transactionSignature = await sendAndConfirmTransaction(connection, transaction, [feePayerKeypair, authorityKeypair]);
	console.log('Token minted', transactionSignature);
}

export async function createNewToken(decimals: number, authorityKeypair: Keypair, feePayerKeypair: Keypair): Promise<Keypair> {
	const mintAccountKeypair = Keypair.generate();
	const lamportsForMintAccountRentExemption = await connection.getMinimumBalanceForRentExemption(SplToken.MintLayout.span);
	const transaction = new Transaction().add(
		SystemProgram.createAccount({
			fromPubkey: feePayerKeypair.publicKey,
			newAccountPubkey: mintAccountKeypair.publicKey,
			space: SplToken.MintLayout.span,
			lamports: lamportsForMintAccountRentExemption,
			programId: SplToken.TOKEN_PROGRAM_ID,
		}),
		SplToken.Token.createInitMintInstruction(SplToken.TOKEN_PROGRAM_ID, mintAccountKeypair.publicKey, decimals, authorityKeypair.publicKey, authorityKeypair.publicKey),
	);
	await requestAirdropIfInsufficientBalance(feePayerKeypair, 2, SplToken.MintLayout.span);
	const transactionSignature = await sendAndConfirmTransaction(connection, transaction, [feePayerKeypair, mintAccountKeypair]);
	console.log('Token created', transactionSignature);
	return mintAccountKeypair;
}

export async function createTokenAccount(mintAccountKeypair: Keypair, ownerKeypair: Keypair, feePayerKeypair: Keypair): Promise<Keypair> {
	const tokenAccountKeypair = Keypair.generate();
	const lamportsForTokenAccountRentExemption = await connection.getMinimumBalanceForRentExemption(SplToken.AccountLayout.span);
	const transaction = new Transaction().add(
		SystemProgram.createAccount({
			fromPubkey: feePayerKeypair.publicKey,
			newAccountPubkey: tokenAccountKeypair.publicKey,
			lamports: lamportsForTokenAccountRentExemption,
			space: SplToken.AccountLayout.span,
			programId: SplToken.TOKEN_PROGRAM_ID,
		}),
		SplToken.Token.createInitAccountInstruction(SplToken.TOKEN_PROGRAM_ID, mintAccountKeypair.publicKey, tokenAccountKeypair.publicKey, ownerKeypair.publicKey),
	);
	await requestAirdropIfInsufficientBalance(feePayerKeypair, 2, SplToken.AccountLayout.span);
	const transactionSignature = await sendAndConfirmTransaction(connection, transaction, [feePayerKeypair, tokenAccountKeypair]);
	console.log('Token account created', transactionSignature);
	return tokenAccountKeypair;
}
