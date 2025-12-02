/**
 * Mock setup for Loops.so API calls in tests
 */

const LOOPS_API_BASE_URL = "https://app.loops.so/api/v1";

// Store mock responses
const mockResponses: Map<string, Response> = new Map();

/**
 * Reset all mocks
 */
export function resetMocks() {
	mockResponses.clear();
}

/**
 * Create a mock response (cloneable)
 */
function createMockResponse(
	status: number,
	body: unknown,
	headers?: HeadersInit,
): Response {
	const response = new Response(JSON.stringify(body), {
		status,
		headers: {
			"Content-Type": "application/json",
			...headers,
		},
	});
	// Clone method needed for Response reuse
	response.clone = () => createMockResponse(status, body, headers);
	return response;
}

/**
 * Set up mock fetch for Loops.so API calls
 */
export function setupMockFetch() {
	const originalFetch = globalThis.fetch;

	const mockFetch = Object.assign(
		async (input: RequestInfo | URL, init?: RequestInit) => {
			const url =
				typeof input === "string"
					? input
					: input instanceof URL
						? input.href
						: input.url;

			// Only mock Loops API calls
			if (!url.startsWith(LOOPS_API_BASE_URL)) {
				return originalFetch(input, init);
			}

			// Check if we have a custom mock response template
			if (mockResponses.has(url)) {
				// Clone the template to create a new instance
				const template = mockResponses.get(url);
				if (template) {
					return template.clone();
				}
			}

			// Default mock responses based on endpoint (create new instance each time)
			if (url.includes("/contacts/create")) {
				const _body = init?.body ? JSON.parse(init.body as string) : {};
				// Create fresh response each time to avoid "Body already used" errors
				return createMockResponse(200, {
					id: `contact_${Date.now()}_${Math.random()}`,
					success: true,
				});
			}

			if (url.includes("/contacts/update")) {
				return createMockResponse(200, {
					success: true,
				});
			}

			if (url.includes("/contacts/delete")) {
				return createMockResponse(200, {
					success: true,
				});
			}

			if (url.includes("/contacts/find")) {
				const urlObj = new URL(url);
				const email = urlObj.searchParams.get("email") || "";
				// Create fresh response each time
				return createMockResponse(200, {
					id: `contact_${email}`,
					email,
					firstName: "Test",
					lastName: "User",
					subscribed: true,
				});
			}

			if (url.includes("/contacts/unsubscribe")) {
				return createMockResponse(200, {
					success: true,
				});
			}

			if (url.includes("/contacts/resubscribe")) {
				return createMockResponse(200, {
					success: true,
				});
			}

			if (url.includes("/transactional")) {
				return createMockResponse(200, {
					id: `transactional_${Date.now()}`,
					success: true,
				});
			}

			if (url.includes("/events/send")) {
				return createMockResponse(200, {
					success: true,
				});
			}

			// Default 200 response
			return createMockResponse(200, { success: true });
		},
		originalFetch,
	) as typeof fetch;

	globalThis.fetch = mockFetch;

	return () => {
		globalThis.fetch = originalFetch;
	};
}

/**
 * Mock a specific API endpoint
 */
export function mockApiCall(url: string, response: Response) {
	mockResponses.set(url, response);
}

/**
 * Mock a successful contact creation
 */
export function mockContactCreate(contactId: string = `contact_${Date.now()}`) {
	mockApiCall(
		`${LOOPS_API_BASE_URL}/contacts/create`,
		createMockResponse(200, { id: contactId, success: true }),
	);
}

/**
 * Mock a contact already exists (409)
 */
export function mockContactExists(email: string) {
	const findUrl = `${LOOPS_API_BASE_URL}/contacts/find?email=${encodeURIComponent(email)}`;
	mockApiCall(
		findUrl,
		createMockResponse(200, {
			id: `contact_${email}`,
			email,
			subscribed: true,
		}),
	);

	const createUrl = `${LOOPS_API_BASE_URL}/contacts/create`;
	mockApiCall(
		createUrl,
		createMockResponse(409, {
			success: false,
			message: "Contact already exists",
		}),
	);
}
