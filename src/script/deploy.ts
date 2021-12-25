import { getPayerKeypair, requestAirdropIfInsufficientBalance } from '../client/utils';
import { exec } from 'child_process';
import { RPC_URL } from '../client/config';

async function deploy() {
	const payerKeypair = getPayerKeypair();
	await requestAirdropIfInsufficientBalance(payerKeypair, 2, [185453, 36]);
	await new Promise((res, rej) => {
		console.log('Deploying program ...');
		exec(`solana program deploy --url ${RPC_URL} src/program/target/deploy/learn_solana.so`, (err, stdout) => {
			if (err) {
				rej(err.message);
			}
			console.log(stdout);
			res(null);
		});
	});
}

deploy()
	.then(() => process.exit(0))
	.catch(console.error);
