import { PublicKey } from '@solana/web3.js';
import BN from 'bn.js';
import { SchemaData } from './builder';

export const PlayerStateSchema = new Map([
	[
		SchemaData,
		{
			kind: 'struct',
			fields: [
				['is_initialized', 'u8'],
				['owner', ['u8', 32]],
				['reward_to_claim', 'u64'],
				['program_account', ['u8', 32]],
				['has_upline', ['u8', 4]],
				['upline', ['u8', 32]],
			],
		},
	],
]);

export interface IPlayerState {
	is_initialized: boolean;
	owner: PublicKey;
	reward_to_claim: BN;
	program_account: PublicKey;
	has_upline: boolean;
	upline?: PublicKey;
}

export const GameStateSchema = new Map([
	[
		SchemaData,
		{
			kind: 'struct',
			fields: [
				['is_initialized', 'u8'],
				['admin', ['u8', 32]],
				['spl_token_account', ['u8', 32]],
			],
		},
	],
]);

export interface IGameState {
	is_initialized: boolean;
	admin: PublicKey;
	spl_token_account: PublicKey;
}

export function fromSchemaDataToPlayerState(playerStateSchema: any): IPlayerState {
	const playerState: IPlayerState = {
		is_initialized: playerStateSchema.is_initialized === 1,
		has_upline: playerStateSchema.has_upline[0] === 1,
		reward_to_claim: playerStateSchema.reward_to_claim,
		owner: new PublicKey(playerStateSchema.owner),
		program_account: new PublicKey(playerStateSchema.program_account),
	};
	if (playerState.has_upline) {
		playerState.upline = new PublicKey(playerStateSchema.upline);
	}
	return playerState;
}

export function fromSchemaDataToGameState(gameStateSchema: any): IGameState {
	return {
		is_initialized: gameStateSchema.is_initialized === 1,
		admin: new PublicKey(gameStateSchema.admin),
		spl_token_account: new PublicKey(gameStateSchema.spl_token_account),
	};
}

export const PLAYER_STATE_BYTE = 109;
export const GAME_STATE_BYTE = 65;
