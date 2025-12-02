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
