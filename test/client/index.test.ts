import { describe, expect, test } from "bun:test";
import { defineSchema } from "convex/server";
import { Loops } from "../../src/client";
import { components, initConvexTest } from "./setup.test.js";

// The schema for the tests
const schema = defineSchema({});

describe("Loops thick client", () => {
	test("should create Loops client", () => {
		const loops = new Loops(components.loops, {
			apiKey: "test-api-key",
		});
		expect(loops).toBeDefined();
	});

	test("should throw error if no API key provided", () => {
		const originalEnv = process.env.LOOPS_API_KEY;
		delete process.env.LOOPS_API_KEY;

		expect(() => {
			new Loops(components.loops);
		}).toThrow("Loops API key is required");
		
		if (originalEnv) {
			process.env.LOOPS_API_KEY = originalEnv;
		}
	});

	test("should work with api() helper - generates actions", () => {
		const loops = new Loops(components.loops, {
			apiKey: "test-api-key",
		});
		const api = loops.api();

		expect(api.addContact).toBeDefined();
		expect(api.updateContact).toBeDefined();
		expect(api.findContact).toBeDefined();
		expect(api.batchCreateContacts).toBeDefined();
		expect(api.unsubscribeContact).toBeDefined();
		expect(api.resubscribeContact).toBeDefined();
		expect(api.deleteContact).toBeDefined();
		expect(api.sendTransactional).toBeDefined();
		expect(api.sendEvent).toBeDefined();
		expect(api.triggerLoop).toBeDefined();
		expect(api.countContacts).toBeDefined();
		expect(api.detectRecipientSpam).toBeDefined();
		expect(api.detectActorSpam).toBeDefined();
		expect(api.getEmailStats).toBeDefined();
		expect(api.detectRapidFirePatterns).toBeDefined();
		expect(api.checkRecipientRateLimit).toBeDefined();
		expect(api.checkActorRateLimit).toBeDefined();
		expect(api.checkGlobalRateLimit).toBeDefined();
		expect(typeof api.addContact).toBe("function");
		expect(typeof api.sendTransactional).toBe("function");
		expect(typeof api.countContacts).toBe("function");
		expect(typeof api.detectRecipientSpam).toBe("function");
		expect(typeof api.checkRecipientRateLimit).toBe("function");
	});

	// Note: Integration tests that actually call the Loops API would require
	// mocking the fetch calls or using a test API key. These tests verify
	// the structure and basic functionality of the client.
});
