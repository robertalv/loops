import { describe, expect, test } from "bun:test";
import { api, internal } from "../../src/component/_generated/api";
import { convexTest } from "./setup.test.ts";

describe("component lib", () => {
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
		const contacts = await t.db.query("contacts").collect();
		expect(contacts.length).toBe(1);
		expect(contacts[0].email).toBe("test@example.com");
		expect(contacts[0].firstName).toBe("Test");
		expect(contacts[0].lastName).toBe("User");
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

		const contact = await t.db
			.query("contacts")
			.withIndex("email", (q: any) => q.eq("email", "update@example.com"))
			.unique();
		expect(contact?.firstName).toBe("Updated");
	});

	test("deleteContact removes contact from database", async () => {
		const t = convexTest();

		await t.action(api.lib.addContact, {
			apiKey: "test-api-key",
			contact: {
				email: "delete@example.com",
			},
		});

		let contacts = await t.db.query("contacts").collect();
		expect(contacts.length).toBe(1);

		const result = await t.action(api.lib.deleteContact, {
			apiKey: "test-api-key",
			email: "delete@example.com",
		});

		expect(result.success).toBe(true);

		contacts = await t.db.query("contacts").collect();
		expect(contacts.length).toBe(0);
	});

	test("countContacts returns correct count", async () => {
		const t = convexTest();
		const now = Date.now();

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

		const now = Date.now();
		
		await t.mutation(internal.lib.logEmailOperation as any, {
			operationType: "transactional",
			email: "ratelimit@example.com",
			timestamp: now - 1000,
			success: true,
		});
		await t.mutation(internal.lib.logEmailOperation as any, {
			operationType: "transactional",
			email: "ratelimit@example.com",
			timestamp: now - 2000,
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
		const now = Date.now();

		for (let i = 0; i < 12; i++) {
			await t.mutation(internal.lib.logEmailOperation as any, {
				operationType: "transactional",
				email: "exceeded@example.com",
				timestamp: now - i * 1000,
				success: true,
			});
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
		const now = Date.now();

		await t.mutation(internal.lib.logEmailOperation as any, {
			operationType: "transactional",
			email: "stats1@example.com",
			timestamp: now - 1000,
			success: true,
		});
		await t.mutation(internal.lib.logEmailOperation as any, {
			operationType: "event",
			email: "stats2@example.com",
			eventName: "test-event",
			timestamp: now - 2000,
			success: true,
		});
		await t.mutation(internal.lib.logEmailOperation as any, {
			operationType: "transactional",
			email: "stats3@example.com",
			timestamp: now - 3000,
			success: false,
		});

		const stats = await t.query(api.lib.getEmailStats, {
			timeWindowMs: 3600000,
		});

		expect(stats.totalOperations).toBe(3);
		expect(stats.successfulOperations).toBe(2);
		expect(stats.failedOperations).toBe(1);
		expect((stats.operationsByType as any)["transactional"]).toBe(2);
		expect((stats.operationsByType as any)["event"]).toBe(1);
		expect(stats.uniqueRecipients).toBe(3);
	});

	test("detectRecipientSpam finds suspicious patterns", async () => {
		const t = convexTest();
		const now = Date.now();

		for (let i = 0; i < 15; i++) {
			await t.mutation(internal.lib.logEmailOperation as any, {
				operationType: "transactional",
				email: "spam@example.com",
				timestamp: now - i * 1000,
				success: true,
			});
		}

		const spam = await t.query(api.lib.detectRecipientSpam, {
			timeWindowMs: 3600000,
			maxEmailsPerRecipient: 10,
		});

		expect(spam.length).toBeGreaterThan(0);
		const spamEntry = spam.find((s) => s.email === "spam@example.com");
		expect(spamEntry).toBeDefined();
		expect(spamEntry!.count).toBeGreaterThan(10);
	});
});
