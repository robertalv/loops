/**
 * This file is the entry point for the React app, it sets up the root
 * element and renders the App component to the DOM.
 *
 * It is included in `src/index.html`.
 */

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { createRoot } from "react-dom/client";
import { App } from "./App";

// Get CONVEX_URL from window (injected by server into HTML)
// We use window instead of import.meta.env because Bun's dev server
// doesn't auto-inject env vars into client bundles
declare global {
	interface Window {
		CONVEX_URL?: string;
	}
}
const convexURL = window.CONVEX_URL;

if (!convexURL) {
	throw new Error("No convex URL provided!");
}

const convex = new ConvexReactClient(convexURL);

function start() {
	const rootElement = document.getElementById("root");

	if (!rootElement) {
		throw new Error("Could not find root");
	}

	const root = createRoot(rootElement);
	root.render(
		<ConvexProvider client={convex}>
			<App />
		</ConvexProvider>,
	);
}

if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", start);
} else {
	start();
}
