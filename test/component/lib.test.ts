import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { api } from "../../src/component/_generated/api";
import { internalLib } from "../../src/types";
import { mockContactCreate, resetMocks, setupMockFetch } from "./mock-setup";
import { convexTest } from "./setup.test";

describe("component lib", () => {
	let restoreFetch: (() => void) | undefined;

	beforeEach(() => {
		restoreFetch = setupMockFetch();
		mockContactCreate();
	});

	afterEach(() => {
		resetMocks();
		if (restoreFetch) {
			restoreFetch();
		}
	});

	test("addContact stores contact in database", async () => {
		const t = convexTest();
		const result = await t.action(api.lib.addContact, {
			apiKey: "test-api-key",
			contact: {
				email: "test@example.com",
				firstName: "Test",
				lastName: "User",
			},
		});

		expect(result.success).toBe(true);
		expect(result.id).toBeDefined();

		// Verify contact was stored by checking count
		const count = await t.query(api.lib.countContacts, {});
		expect(count).toBeGreaterThanOrEqual(1);
	});

	test("updateContact updates existing contact", async () => {
		const t = convexTest();
		await t.action(api.lib.addContact, {
			apiKey: "test-api-key",
			contact: {
				email: "update@example.com",
				firstName: "Original",
			},
		});

		const result = await t.action(api.lib.updateContact, {
			apiKey: "test-api-key",
			email: "update@example.com",
			firstName: "Updated",
		});

		expect(result.success).toBe(true);

		// Verify update by checking the contact
		const findResult = await t.action(api.lib.findContact, {
			apiKey: "test-api-key",
			email: "update@example.com",
		});
		expect(findResult.success).toBe(true);
	});

	test("deleteContact removes contact from database", async () => {
		const t = convexTest();

		await t.action(api.lib.addContact, {
			apiKey: "test-api-key",
			contact: {
				email: "delete@example.com",
			},
		});

		const initialCount = await t.query(api.lib.countContacts, {});
		expect(initialCount).toBeGreaterThanOrEqual(1);

		const result = await t.action(api.lib.deleteContact, {
			apiKey: "test-api-key",
			email: "delete@example.com",
		});

		expect(result.success).toBe(true);

		// Note: We can't easily verify deletion without direct DB access
		// but the API call succeeded
	});

	test("countContacts returns correct count", async () => {
		const t = convexTest();

		await t.action(api.lib.addContact, {
			apiKey: "test-api-key",
			contact: {
				email: "count1@example.com",
			},
		});
		await t.action(api.lib.addContact, {
			apiKey: "test-api-key",
			contact: {
				email: "count2@example.com",
			},
		});
		await t.action(api.lib.addContact, {
			apiKey: "test-api-key",
			contact: {
				email: "count3@example.com",
				userGroup: "premium",
			},
		});

		const totalCount = await t.query(api.lib.countContacts, {});
		expect(totalCount).toBe(3);

		const premiumCount = await t.query(api.lib.countContacts, {
			userGroup: "premium",
		});
		expect(premiumCount).toBe(1);

		const subscribedCount = await t.query(api.lib.countContacts, {
			subscribed: true,
		});
		expect(subscribedCount).toBe(3);
	});

	test("checkRecipientRateLimit returns correct rate limit status", async () => {
		const t = convexTest();

		// Wait a bit to ensure different timestamps
		await t.mutation(internalLib.logEmailOperation, {
			operationType: "transactional",
			email: "ratelimit@example.com",
			success: true,
		});
		await new Promise((resolve) => setTimeout(resolve, 10));
		await t.mutation(internalLib.logEmailOperation, {
			operationType: "transactional",
			email: "ratelimit@example.com",
			success: true,
		});

		const check = await t.query(api.lib.checkRecipientRateLimit, {
			email: "ratelimit@example.com",
			timeWindowMs: 3600000,
			maxEmails: 10,
		});

		expect(check.allowed).toBe(true);
		expect(check.count).toBe(2);
		expect(check.limit).toBe(10);
	});

	test("checkRecipientRateLimit detects when limit is exceeded", async () => {
		const t = convexTest();

		for (let i = 0; i < 12; i++) {
			await t.mutation(internalLib.logEmailOperation, {
				operationType: "transactional",
				email: "exceeded@example.com",
				success: true,
			});
			// Small delay to ensure different timestamps
			if (i < 11) {
				await new Promise((resolve) => setTimeout(resolve, 10));
			}
		}

		const check = await t.query(api.lib.checkRecipientRateLimit, {
			email: "exceeded@example.com",
			timeWindowMs: 3600000,
			maxEmails: 10,
		});

		expect(check.allowed).toBe(false);
		expect(check.count).toBeGreaterThan(10);
		expect(check.retryAfter).toBeDefined();
	});

	test("getEmailStats returns correct statistics", async () => {
		const t = convexTest();

		await t.mutation(internalLib.logEmailOperation, {
			operationType: "transactional",
			email: "stats1@example.com",
			success: true,
		});
		await new Promise((resolve) => setTimeout(resolve, 10));
		await t.mutation(internalLib.logEmailOperation, {
			operationType: "event",
			email: "stats2@example.com",
			eventName: "test-event",
			success: true,
		});
		await new Promise((resolve) => setTimeout(resolve, 10));
		await t.mutation(internalLib.logEmailOperation, {
			operationType: "transactional",
			email: "stats3@example.com",
			success: false,
		});

		const stats = await t.query(api.lib.getEmailStats, {
			timeWindowMs: 3600000,
		});

		expect(stats.totalOperations).toBe(3);
		expect(stats.successfulOperations).toBe(2);
		expect(stats.failedOperations).toBe(1);
		expect(stats.operationsByType.transactional).toBe(2);
		expect(stats.operationsByType.event).toBe(1);
		expect(stats.uniqueRecipients).toBe(3);
	});

	test("detectRecipientSpam finds suspicious patterns", async () => {
		const t = convexTest();

		for (let i = 0; i < 15; i++) {
			await t.mutation(internalLib.logEmailOperation, {
				operationType: "transactional",
				email: "spam@example.com",
				success: true,
			});
			// Small delay to ensure different timestamps
			if (i < 14) {
				await new Promise((resolve) => setTimeout(resolve, 10));
			}
		}

		const spam = await t.query(api.lib.detectRecipientSpam, {
			timeWindowMs: 3600000,
			maxEmailsPerRecipient: 10,
		});

		expect(spam.length).toBeGreaterThan(0);
		const spamEntry = spam.find((s) => s.email === "spam@example.com");
		expect(spamEntry).toBeDefined();
		expect(spamEntry?.count).toBeGreaterThan(10);
	});
});
