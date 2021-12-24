import { deserialize, serialize } from 'borsh';

class Assignable {
	constructor(properties: Object) {
		Object.keys(properties).forEach((key) => {
			//@ts-expect-error
			this[key] = properties[key];
		});
	}
}

export class SchemaData extends Assignable {}

export const SchemaBuilder = {
	serialize: (schema: Map<any, any>, schemaData: SchemaData): Buffer => {
		return Buffer.from(serialize(schema, schemaData));
	},

	deserialize: (schema: Map<any, any>, data: Buffer) => {
		return deserialize(schema, SchemaData, data);
	},
};
