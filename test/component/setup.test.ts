import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { convexTest as convexT } from "convex-test";
import schema from "../../src/component/schema";

const __dirname = dirname(fileURLToPath(import.meta.url));
const componentDir = join(__dirname, "../../src/component");

// Get loops component modules
const files = await Array.fromAsync(
	new Bun.Glob("**/*.{ts,js}").scan({ cwd: componentDir }),
);

export const modules = Object.fromEntries(
	files
		.filter((f) => !f.includes(".test."))
		.map((f) => [`./${f}`, () => import(join(componentDir, f))]),
);

// Get aggregate component modules for testing
const aggregateDir = join(
	__dirname,
	"../../node_modules/@convex-dev/aggregate/src/component",
);
const aggregateFiles = await Array.fromAsync(
	new Bun.Glob("**/*.{ts,js}").scan({ cwd: aggregateDir }),
);

const aggregateModules = Object.fromEntries(
	aggregateFiles
		.filter((f) => !f.includes(".test."))
		.map((f) => [`./${f}`, () => import(join(aggregateDir, f))]),
);

// Import aggregate schema using file path
const aggregateSchemaPath = join(
	__dirname,
	"../../node_modules/@convex-dev/aggregate/dist/component/schema.js",
);
const aggregateSchemaModule = await import(aggregateSchemaPath);
const aggregateSchema = aggregateSchemaModule.default;

export const convexTest = () => {
	const t = convexT(schema, modules);
	// Register the aggregate component for contact counting
	t.registerComponent("contactAggregate", aggregateSchema, aggregateModules);
	return t;
};
