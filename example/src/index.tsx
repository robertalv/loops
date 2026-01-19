import { serve } from "bun";
import index from "./index.html";

const CONVEX_URL = process.env.CONVEX_URL;

if (!CONVEX_URL) {
	console.error("CONVEX_URL environment variable is not set!");
	console.error("Make sure you have a .env.local file with CONVEX_URL set.");
	process.exit(1);
}

const server = serve({
	routes: {
		// Serve config endpoint for client to fetch CONVEX_URL
		"/_bun/config": new Response(
			JSON.stringify({ CONVEX_URL }),
			{ headers: { "Content-Type": "application/json" } }
		),
		// Serve index.html for all unmatched routes.
		"/*": index,
	},

	development: process.env.NODE_ENV !== "production" && {
		// Enable browser hot reloading in development
		hmr: true,

		// Echo console logs from the browser to the server
		console: true,
	},
});

console.log(`🚀 Server running at ${server.url}`);
console.log(`📡 Convex URL: ${CONVEX_URL}`);
