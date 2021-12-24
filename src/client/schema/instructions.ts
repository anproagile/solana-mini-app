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

export const PlayerRegisterIxSchema = new Map([
	[
		SchemaData,
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

export const AddRewardIxScheme = new Map([
	[
		SchemaData,
		{
			kind: 'struct',
			fields: [
				['tag', 'u8'],
				['reward_amount', 'u128'],
			],
		},
	],
]);

export const ClaimRewardIxSchema = GameInitIxSchema;

export interface IAddRewardIx {
	tag: Tag;
	reward_amount: number;
}

export interface IPlayerRegisterIx {
	tag: Tag;
	upline?: Buffer;
}

export interface IGameInitIx {
	tag: Tag;
}

export interface IClaimRewardIx extends IGameInitIx {}
