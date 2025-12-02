import { httpRouter } from "convex/server";
import {
	type ContactPayload,
	type DeleteContactPayload,
	type EventPayload,
	type HeadersInitParam,
	internalLib,
	type TransactionalPayload,
	type TriggerPayload,
	type UpdateContactPayload,
} from "../types";
import { httpAction } from "./_generated/server";

const http = httpRouter();

const allowedOrigin =
	process.env.LOOPS_HTTP_ALLOWED_ORIGIN ?? process.env.CLIENT_ORIGIN ?? "*";

const buildCorsHeaders = (extra?: HeadersInitParam) => {
	const headers = new Headers(extra ?? {});
	headers.set("Access-Control-Allow-Origin", allowedOrigin);
	headers.set("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
	headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
	headers.set("Access-Control-Max-Age", "86400");
	headers.set("Vary", "Origin");
	return headers;
};

const jsonResponse = (data: unknown, init?: ResponseInit) => {
	const headers = buildCorsHeaders(
		(init?.headers as HeadersInitParam | undefined) ?? undefined,
	);
	headers.set("Content-Type", "application/json");
	return new Response(JSON.stringify(data), { ...init, headers });
};

const emptyResponse = (init?: ResponseInit) => {
	const headers = buildCorsHeaders(
		(init?.headers as HeadersInitParam | undefined) ?? undefined,
	);
	return new Response(null, { ...init, headers });
};

const readJsonBody = async <T>(request: Request): Promise<T> => {
	try {
		return (await request.json()) as T;
	} catch (_error) {
		throw new Error("Invalid JSON body");
	}
};

const booleanFromQuery = (value: string | null) => {
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

const numberFromQuery = (value: string | null, fallback: number) => {
	if (!value) {
		return fallback;
	}
	const parsed = Number.parseInt(value, 10);
	return Number.isNaN(parsed) ? fallback : parsed;
};

const requireLoopsApiKey = () => {
	const apiKey = process.env.LOOPS_API_KEY;
	if (!apiKey) {
		throw new Error(
			"LOOPS_API_KEY environment variable must be set to use the HTTP API.",
		);
	}
	return apiKey;
};

const respondError = (error: unknown) => {
	console.error("[loops:http]", error);
	const message = error instanceof Error ? error.message : "Unexpected error";
	const status =
		error instanceof Error &&
		error.message.includes("LOOPS_API_KEY environment variable")
			? 500
			: 400;
	return jsonResponse({ error: message }, { status });
};

http.route({
	pathPrefix: "/loops",
	method: "OPTIONS",
	handler: httpAction(async (_ctx, request) => {
		const headers = buildCorsHeaders();
		const requestedHeaders = request.headers.get(
			"Access-Control-Request-Headers",
		);
		if (requestedHeaders) {
			headers.set("Access-Control-Allow-Headers", requestedHeaders);
		}
		const requestedMethod = request.headers.get(
			"Access-Control-Request-Method",
		);
		if (requestedMethod) {
			headers.set("Access-Control-Allow-Methods", `${requestedMethod},OPTIONS`);
		}
		return new Response(null, { status: 204, headers });
	}),
});

http.route({
	path: "/loops/contacts",
	method: "POST",
	handler: httpAction(async (ctx, request) => {
		try {
			const contact = await readJsonBody<ContactPayload>(request);
			const data = await ctx.runAction(internalLib.addContact, {
				apiKey: requireLoopsApiKey(),
				contact,
			});
			return jsonResponse(data, { status: 201 });
		} catch (error) {
			return respondError(error);
		}
	}),
});

http.route({
	path: "/loops/contacts",
	method: "PUT",
	handler: httpAction(async (ctx, request) => {
		try {
			const payload = await readJsonBody<UpdateContactPayload>(request);
			if (!payload.email) {
				throw new Error("email is required");
			}
			const data = await ctx.runAction(internalLib.updateContact, {
				apiKey: requireLoopsApiKey(),
				email: payload.email,
				dataVariables: payload.dataVariables,
				firstName: payload.firstName,
				lastName: payload.lastName,
				userId: payload.userId,
				source: payload.source,
				subscribed: payload.subscribed,
				userGroup: payload.userGroup,
			});
			return jsonResponse(data);
		} catch (error) {
			return respondError(error);
		}
	}),
});

http.route({
	path: "/loops/contacts",
	method: "GET",
	handler: httpAction(async (ctx, request) => {
		try {
			const url = new URL(request.url);
			const email = url.searchParams.get("email");
			if (email) {
				const data = await ctx.runAction(internalLib.findContact, {
					apiKey: requireLoopsApiKey(),
					email,
				});
				return jsonResponse(data);
			}

			const data = await ctx.runQuery(internalLib.listContacts, {
				userGroup: url.searchParams.get("userGroup") ?? undefined,
				source: url.searchParams.get("source") ?? undefined,
				subscribed: booleanFromQuery(url.searchParams.get("subscribed")),
				limit: numberFromQuery(url.searchParams.get("limit"), 100),
				offset: numberFromQuery(url.searchParams.get("offset"), 0),
			});
			return jsonResponse(data);
		} catch (error) {
			return respondError(error);
		}
	}),
});

http.route({
	path: "/loops/contacts",
	method: "DELETE",
	handler: httpAction(async (ctx, request) => {
		try {
			const payload = await readJsonBody<DeleteContactPayload>(request);
			if (!payload.email) {
				throw new Error("email is required");
			}
			await ctx.runAction(internalLib.deleteContact, {
				apiKey: requireLoopsApiKey(),
				email: payload.email,
			});
			return emptyResponse({ status: 204 });
		} catch (error) {
			return respondError(error);
		}
	}),
});

http.route({
	path: "/loops/transactional",
	method: "POST",
	handler: httpAction(async (ctx, request) => {
		try {
			const payload = await readJsonBody<TransactionalPayload>(request);
			if (!payload.transactionalId) {
				throw new Error("transactionalId is required");
			}
			if (!payload.email) {
				throw new Error("email is required");
			}
			const data = await ctx.runAction(internalLib.sendTransactional, {
				apiKey: requireLoopsApiKey(),
				transactionalId: payload.transactionalId,
				email: payload.email,
				dataVariables: payload.dataVariables,
			});
			return jsonResponse(data);
		} catch (error) {
			return respondError(error);
		}
	}),
});

http.route({
	path: "/loops/events",
	method: "POST",
	handler: httpAction(async (ctx, request) => {
		try {
			const payload = await readJsonBody<EventPayload>(request);
			if (!payload.email) {
				throw new Error("email is required");
			}
			if (!payload.eventName) {
				throw new Error("eventName is required");
			}
			const data = await ctx.runAction(internalLib.sendEvent, {
				apiKey: requireLoopsApiKey(),
				email: payload.email,
				eventName: payload.eventName,
				eventProperties: payload.eventProperties,
			});
			return jsonResponse(data);
		} catch (error) {
			return respondError(error);
		}
	}),
});

http.route({
	path: "/loops/trigger",
	method: "POST",
	handler: httpAction(async (ctx, request) => {
		try {
			const payload = await readJsonBody<TriggerPayload>(request);
			if (!payload.loopId) {
				throw new Error("loopId is required");
			}
			if (!payload.email) {
				throw new Error("email is required");
			}
			const data = await ctx.runAction(internalLib.triggerLoop, {
				apiKey: requireLoopsApiKey(),
				loopId: payload.loopId,
				email: payload.email,
				dataVariables: payload.dataVariables,
				eventName: payload.eventName,
			});
			return jsonResponse(data);
		} catch (error) {
			return respondError(error);
		}
	}),
});

http.route({
	path: "/loops/stats",
	method: "GET",
	handler: httpAction(async (ctx, request) => {
		try {
			const url = new URL(request.url);
			const timeWindowMs = numberFromQuery(
				url.searchParams.get("timeWindowMs"),
				86400000,
			);
			const data = await ctx.runQuery(internalLib.getEmailStats, {
				timeWindowMs,
			});
			return jsonResponse(data);
		} catch (error) {
			return respondError(error);
		}
	}),
});

export default http;
