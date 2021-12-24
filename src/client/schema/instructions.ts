import { SchemaData } from './builder';
import { Tag } from './tag';

export const GameInitIxSchema = new Map([
	[
		SchemaData,
		{
			kind: 'struct',
			fields: [['tag', 'u8']],
		},
	],
]);

export const AddRewardIxScheme = new Map([
	[
		SchemaData,
		{
			kind: 'struct',
			fields: [
				['tag', 'u8'],
				['reward_amount', 'u64'],
			],
		},
	],
]);

export const ClaimRewardIxSchema = GameInitIxSchema;
export const PlayerRegisterIxSchema = GameInitIxSchema;

interface BaseIx {
	tag: Tag;
}

export interface IAddRewardIx extends BaseIx {
	reward_amount: number;
}

export interface IGameInitIx extends BaseIx {}
export interface IClaimRewardIx extends BaseIx {}
export interface IPlayerRegisterIx extends BaseIx {}
