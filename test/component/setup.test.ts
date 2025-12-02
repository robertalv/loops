import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { convexTest as convexT } from "convex-test";
import schema from "../../src/component/schema";

const __dirname = dirname(fileURLToPath(import.meta.url));
const componentDir = join(__dirname, "../../src/component");

const files = await Array.fromAsync(
	new Bun.Glob("**/*.{ts,js}").scan({ cwd: componentDir }),
);

export const modules = Object.fromEntries(
	files
		.filter((f) => !f.includes(".test."))
		.map((f) => [`./${f}`, () => import(join(componentDir, f))]),
);

export const convexTest = () => {
	return convexT(schema, modules);
};
