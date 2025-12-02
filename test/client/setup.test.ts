import { test } from "bun:test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
	componentsGeneric,
	defineSchema,
	type GenericSchema,
	type SchemaDefinition,
} from "convex/server";
import { convexTest } from "convex-test";
import type { LoopsComponent } from "../../src/client/index";
import componentSchema from "../../src/component/schema.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const clientDir = join(__dirname, "../../test/client");
const componentDir = join(__dirname, "../../src/component");

// Auto-discover client test files
const clientFiles = await Array.fromAsync(
	new Bun.Glob("**/*.{ts,js}").scan({ cwd: clientDir }),
);

export const modules = Object.fromEntries(
	clientFiles
		.filter((f) => !f.includes(".test."))
		.map((f) => [`./${f}`, () => import(join(clientDir, f))]),
);

// Auto-discover component files for registration
const componentFiles = await Array.fromAsync(
	new Bun.Glob("**/*.{ts,js}").scan({ cwd: componentDir }),
);

export const componentModules = Object.fromEntries(
	componentFiles
		.filter((f) => !f.includes(".test."))
		.map((f) => [`./${f}`, () => import(join(componentDir, f))]),
);

export { componentSchema };

export function initConvexTest<
	Schema extends SchemaDefinition<GenericSchema, boolean>,
>(schema?: Schema) {
	const t = convexTest(schema ?? defineSchema({}), modules);
	t.registerComponent("loops", componentSchema, componentModules);
	return t;
}

export const components = componentsGeneric() as unknown as {
	loops: LoopsComponent;
};

test("setup", () => {});
