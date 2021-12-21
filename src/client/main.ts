import { AccountInfo, Connection, Keypair, PublicKey, sendAndConfirmTransaction, SystemProgram, Transaction, TransactionInstruction } from '@solana/web3.js';
import { deserialize, deserializeUnchecked, serialize } from 'borsh';
import { getPayerKeypair, getProgramKeypair } from './utils';

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

async function start() {
	const programAccountPublicKey = await getOrcreateProgramAccountIfNotExists();
	const info = await connection.getAccountInfo(programAccountPublicKey);
	// await test(programAccountPublicKey);
	// await printProgramAccountData(programAccountPublicKey);
	const payerKeyPair = getPayerKeypair();
	const programKeyPair = getProgramKeypair();
	const programId = programKeyPair.publicKey;
	console.log(info?.owner.toString(), programId.toString());
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
	const programKeyPair = getProgramKeypair();
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

async function getOrcreateProgramAccountIfNotExists() {
	const payerKeyPair = getPayerKeypair();
	const programKeyPair = getProgramKeypair();
	const programId = programKeyPair.publicKey;

	const programInfo = await connection.getAccountInfo(programId);
	if (programInfo === null) {
		throw new Error('Please deploy the program');
	}
	if (!programInfo.executable) {
		throw new Error('The program is not executable');
	}

	const PROGRAM_ACCOUNT_SEED = 'random_seed';
	const programAccountPublicKey = await PublicKey.createWithSeed(payerKeyPair.publicKey, PROGRAM_ACCOUNT_SEED, programId);
	let programAccountInfo = await connection.getAccountInfo(programAccountPublicKey);

	if (programAccountInfo === null) {
		console.log(`Program ${programId} doesn't have account for program state`);
		// Solana default max account size = 10 MB, here we put only 1 MB
		// const space = 1048576;
		const space = 33;
		const lamportsToExemptRent = await connection.getMinimumBalanceForRentExemption(space);
		const transaction = new Transaction().add(
			SystemProgram.createAccountWithSeed({
				fromPubkey: payerKeyPair.publicKey,
				basePubkey: payerKeyPair.publicKey,
				seed: PROGRAM_ACCOUNT_SEED,
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
