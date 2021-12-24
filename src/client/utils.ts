import * as SplToken from '@solana/spl-token';
import { AccountMeta, Keypair, LAMPORTS_PER_SOL, PublicKey, sendAndConfirmTransaction, SystemProgram, Transaction, TransactionInstruction } from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';
import { connection, PDA_SEED } from './config';
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

// 0 - [signer]   - The player (holder) account
// 1 - [writable] - Program account
// 2 - [writable] - The player program account
// 3 - [writable] - The token account of the current program
// 4-  []         - The PDA, owner (in term of token, not account owner) of token account
// 5 - [writable] - The player token account
// 6 - []         - The token program
export async function claimReward(playerKeypair: Keypair, programAccount: Keypair, playerAccount: Keypair, gameTokenAccount: Keypair, playerTokenAccount: Keypair) {
	const programId = getDeployedProgramKeypair().publicKey;
	const [PDA] = await PublicKey.findProgramAddress([Buffer.from(PDA_SEED)], programId);
	const transaction = new Transaction().add(
		new TransactionInstruction({
			keys: [
				{ isSigner: true, isWritable: false, pubkey: playerKeypair.publicKey },
				{ isSigner: false, isWritable: true, pubkey: programAccount.publicKey },
				{ isSigner: false, isWritable: true, pubkey: playerAccount.publicKey },
				{ isSigner: false, isWritable: true, pubkey: gameTokenAccount.publicKey },
				{ isSigner: false, isWritable: false, pubkey: PDA },
				{ isSigner: false, isWritable: true, pubkey: playerTokenAccount.publicKey },
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
	await sendAndConfirmTransaction(connection, transaction, [playerKeypair]);
}

// 0 - [signer]   - The admin (holder) account
// 1 - [writable] - Program account
// 2 - [writable] - The player program account
// 3 - [writable] - The player upline program account
export async function addReward(
	rewardAmountInSol: number,
	feePayerKeypair: Keypair,
	adminKeypair: Keypair,
	programAccount: Keypair,
	playerAccount: Keypair,
	playerUplineAccount?: Keypair,
) {
	rewardAmountInSol = rewardAmountInSol * LAMPORTS_PER_SOL;
	const programId = getDeployedProgramKeypair().publicKey;
	const keys: AccountMeta[] = [
		{ isSigner: true, isWritable: false, pubkey: adminKeypair.publicKey },
		{ isSigner: false, isWritable: true, pubkey: programAccount.publicKey },
		{ isSigner: false, isWritable: true, pubkey: playerAccount.publicKey },
	];
	if (playerUplineAccount) {
		keys.push({ isSigner: false, isWritable: true, pubkey: playerUplineAccount.publicKey });
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
	await sendAndConfirmTransaction(connection, transaction, [feePayerKeypair, adminKeypair]);
}

// 0 - [signer]   - The admin (holder) account
// 1 - [writable] - Program account
// 2 - [writable] - An token account created by the admin, and pre-funded
// 3 - []         - The token program
export async function initializeGame(tokenAccountKeypair: Keypair, adminKeypair: Keypair, gameAccountKeypair: Keypair, feePayerKeypair: Keypair) {
	const programId = getDeployedProgramKeypair().publicKey;
	const transaction = new Transaction().add(
		new TransactionInstruction({
			keys: [
				{ isSigner: true, isWritable: false, pubkey: adminKeypair.publicKey },
				{ isSigner: false, isWritable: true, pubkey: gameAccountKeypair.publicKey },
				{ isSigner: false, isWritable: true, pubkey: tokenAccountKeypair.publicKey },
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
	await sendAndConfirmTransaction(connection, transaction, [feePayerKeypair, adminKeypair]);
}

// 0 - [signer]   - The player (holder) account
// 1 - [writable] - The player account for the program
// 2 - []         - The program account
// 3 - []         - The upline player account for the program
export async function registerPlayer(playerKeypair: Keypair, playerAccount: Keypair, programAccount: Keypair, feePayerKeypair: Keypair, uplineKeypair?: Keypair) {
	const programId = getDeployedProgramKeypair().publicKey;
	const playerRegisterInstruction: IPlayerRegisterIx = {
		tag: Tag.Register,
	};
	const keys: AccountMeta[] = [
		{ isSigner: true, isWritable: false, pubkey: playerKeypair.publicKey },
		{ isSigner: false, isWritable: true, pubkey: playerAccount.publicKey },
		{ isSigner: false, isWritable: false, pubkey: programAccount.publicKey },
	];
	if (uplineKeypair) {
		keys.push({ isSigner: false, isWritable: false, pubkey: uplineKeypair.publicKey });
	}
	const transaction = new Transaction().add(
		new TransactionInstruction({
			keys,
			programId,
			data: SchemaBuilder.serialize(PlayerRegisterIxSchema, new SchemaData(playerRegisterInstruction)),
		}),
	);
	await sendAndConfirmTransaction(connection, transaction, [feePayerKeypair, playerKeypair]);
}

export async function createPlayerKeypair(): Promise<Keypair> {
	const playerKeypair = Keypair.generate();
	const signature = await connection.requestAirdrop(playerKeypair.publicKey, LAMPORTS_PER_SOL);
	await connection.confirmTransaction(signature);
	return playerKeypair;
}

export async function createPlayerAccount(feePayerKeypair: Keypair): Promise<Keypair> {
	const programId = getDeployedProgramKeypair().publicKey;
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
	await sendAndConfirmTransaction(connection, transaction, [feePayerKeypair, playerAccount]);
	return playerAccount;
}

export async function createGameAccount(feePayerKeypair: Keypair): Promise<Keypair> {
	const programId = getDeployedProgramKeypair().publicKey;
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
	await sendAndConfirmTransaction(connection, transaction, [feePayerKeypair, gameAccount]);
	return gameAccount;
}

export function toJSONStringAndBeautify(obj: any): string {
	return JSON.stringify(obj, null, 3);
}

export function getPayerKeypair(): Keypair {
	const privateKeyString = fs.readFileSync(path.join(__dirname, '..', '..', 'id.json'), { encoding: 'utf-8' });
	const privateKey = Uint8Array.from(JSON.parse(privateKeyString));
	return Keypair.fromSecretKey(privateKey);
}

export function getDeployedProgramKeypair(): Keypair {
	const privateKeyString = fs.readFileSync(path.join(__dirname, '..', 'program', 'target', 'deploy', 'learn_solana-keypair.json'), { encoding: 'utf-8' });
	const privateKey = Uint8Array.from(JSON.parse(privateKeyString));
	return Keypair.fromSecretKey(privateKey);
}

export async function mintToken(amount: number, mintAccountKeypair: Keypair, receiverAccountKeypair: Keypair, authorityKeypair: Keypair, feePayerKeypair: Keypair) {
	const transaction = new Transaction().add(
		SplToken.Token.createMintToInstruction(SplToken.TOKEN_PROGRAM_ID, mintAccountKeypair.publicKey, receiverAccountKeypair.publicKey, authorityKeypair.publicKey, [], amount),
	);
	await sendAndConfirmTransaction(connection, transaction, [feePayerKeypair, authorityKeypair]);
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
	await sendAndConfirmTransaction(connection, transaction, [feePayerKeypair, mintAccountKeypair]);
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
	await sendAndConfirmTransaction(connection, transaction, [feePayerKeypair, tokenAccountKeypair]);
	return tokenAccountKeypair;
}
