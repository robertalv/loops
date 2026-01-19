import type { HeadersInitParam } from "../types";

const allowedOrigin =
	process.env.CONVEX_URL ??
	process.env.NEXT_PUBLIC_CONVEX_URL ??
	process.env.CONVEX_SITE_URL ??
	process.env.NEXT_PUBLIC_CONVEX_SITE_URL ??
	process.env.LOOPS_HTTP_ALLOWED_ORIGIN ??
	process.env.CLIENT_ORIGIN ??
	"*";

export const LOOPS_API_BASE_URL = "https://app.loops.so/api/v1";

export const sanitizeLoopsError = (
	status: number,
	_errorText: string,
): Error => {
	if (status === 401 || status === 403) {
		return new Error("Authentication failed. Please check your API key.");
	}
	if (status === 404) {
		return new Error("Resource not found.");
	}
	if (status === 429) {
		return new Error("Rate limit exceeded. Please try again later.");
	}
	if (status >= 500) {
		return new Error("Loops service error. Please try again later.");
	}
	return new Error(`Loops API error (${status}). Please try again.`);
};

export type LoopsRequestInit = Omit<RequestInit, "body"> & {
	json?: unknown;
};

export const loopsFetch = async (
	apiKey: string,
	path: string,
	init: LoopsRequestInit = {},
) => {
	const { json, ...rest } = init;
	const headers = new Headers(rest.headers ?? {});
	headers.set("Authorization", `Bearer ${apiKey}`);
	if (json !== undefined && !headers.has("Content-Type")) {
		headers.set("Content-Type", "application/json");
	}

	return fetch(`${LOOPS_API_BASE_URL}${path}`, {
		...rest,
		headers,
		// @ts-expect-error RequestInit in this build doesn't declare body
		body: json !== undefined ? JSON.stringify(json) : rest.body,
	});
};

export const buildCorsHeaders = (extra?: HeadersInitParam) => {
	const headers = new Headers(extra ?? {});
	headers.set("Access-Control-Allow-Origin", allowedOrigin);
	headers.set("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
	headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
	headers.set("Access-Control-Max-Age", "86400");
	headers.set("Vary", "Origin");
	return headers;
};

export const jsonResponse = (data: unknown, init?: ResponseInit) => {
	const headers = buildCorsHeaders(
		(init?.headers as HeadersInitParam | undefined) ?? undefined,
	);
	headers.set("Content-Type", "application/json");
	return new Response(JSON.stringify(data), { ...init, headers });
};

export const emptyResponse = (init?: ResponseInit) => {
	const headers = buildCorsHeaders(
		(init?.headers as HeadersInitParam | undefined) ?? undefined,
	);
	return new Response(null, { ...init, headers });
};

export const readJsonBody = async <T>(request: Request): Promise<T> => {
	try {
		return (await request.json()) as T;
	} catch (_error) {
		throw new Error("Invalid JSON body");
	}
};

export const booleanFromQuery = (value: string | null) => {
	if (value === null) {
		return undefined;
	}
	if (value === "true") {
		return true;
	}
	if (value === "false") {
		return false;
	}
	return undefined;
};

export const numberFromQuery = (value: string | null, fallback: number) => {
	if (!value) {
		return fallback;
	}
	const parsed = Number.parseInt(value, 10);
	return Number.isNaN(parsed) ? fallback : parsed;
};

export const requireLoopsApiKey = () => {
	const apiKey = process.env.LOOPS_API_KEY;
	if (!apiKey) {
		throw new Error(
			"LOOPS_API_KEY environment variable must be set to use the HTTP API.",
		);
	}
	return apiKey;
};

export const respondError = (error: unknown) => {
	console.error("[loops:http]", error);
	const message = error instanceof Error ? error.message : "Unexpected error";
	const status =
		error instanceof Error &&
		error.message.includes("LOOPS_API_KEY environment variable")
			? 500
			: 400;
	return jsonResponse({ error: message }, { status });
};