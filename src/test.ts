import type { TestConvex } from "convex-test";
import type { GenericSchema, SchemaDefinition } from "convex/server";
import schema from "./component/schema.js";

/**
 * Register the Loops component with the test convex instance.
 *
 * @param t - The test convex instance from convexTest().
 * @param name - The name of the component as registered in convex.config.ts.
 * @param modules - The modules object from import.meta.glob. Required.
 */
export function register(
	t: TestConvex<SchemaDefinition<GenericSchema, boolean>>,
	name: string = "loops",
	modules?: Record<string, () => Promise<unknown>>,
) {
	if (!modules) {
		throw new Error(
			"modules parameter is required. Pass import.meta.glob from your test file.",
		);
	}
	t.registerComponent(name, schema, modules);
}

export { schema };

export default { register, schema };
