import { paginator } from "convex-helpers/server/pagination";
import type { PaginationResult } from "convex/server";
import { z } from "zod";
import { internalLib } from "../types";
import { za, zm, zq } from "../utils.js";
import type { Doc } from "./_generated/dataModel.js";
import {
	aggregateClear,
	aggregateCountByUserGroup,
	aggregateCountTotal,
	aggregateDelete,
	aggregateInsert,
	aggregateReplace,
} from "./aggregates";
import { loopsFetch, sanitizeLoopsError } from "./helpers";
import schema from "./schema";
import { contactValidator } from "./validators.js";

/**
 * Internal mutation to store/update a contact in the database
 */
export const storeContact = zm({
	args: z.object({
		email: z.string().email(),
		firstName: z.string().optional(),
		lastName: z.string().optional(),
		userId: z.string().optional(),
		source: z.string().optional(),
		subscribed: z.boolean().optional(),
		userGroup: z.string().optional(),
		loopsContactId: z.string().optional(),
	}),
	returns: z.void(),
	handler: async (ctx, args) => {
		const now = Date.now();
		const existing = await ctx.db
			.query("contacts")
			.withIndex("email", (q) => q.eq("email", args.email))
			.unique();

		if (existing) {
			// Update the contact
			await ctx.db.patch(existing._id, {
				firstName: args.firstName,
				lastName: args.lastName,
				userId: args.userId,
				source: args.source,
				subscribed: args.subscribed ?? existing.subscribed,
				userGroup: args.userGroup,
				loopsContactId: args.loopsContactId,
				updatedAt: now,
			});

			// Get the updated document and update aggregate if userGroup changed
			const updated = await ctx.db.get(existing._id);
			if (updated && existing.userGroup !== updated.userGroup) {
				await aggregateReplace(ctx, existing, updated);
			}
		} else {
			// Insert new contact
			const id = await ctx.db.insert("contacts", {
				email: args.email,
				firstName: args.firstName,
				lastName: args.lastName,
				userId: args.userId,
				source: args.source,
				subscribed: args.subscribed ?? true,
				userGroup: args.userGroup,
				loopsContactId: args.loopsContactId,
				createdAt: now,
				updatedAt: now,
			});

			// Add to aggregate for counting
			const newDoc = await ctx.db.get(id);
			if (newDoc) {
				await aggregateInsert(ctx, newDoc);
			}
		}
	},
});

/**
 * Internal mutation to delete a contact from the database
 */
export const removeContact = zm({
	args: z.object({
		email: z.string().email(),
	}),
	returns: z.void(),
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query("contacts")
			.withIndex("email", (q) => q.eq("email", args.email))
			.unique();

		if (existing) {
			// Remove from aggregate first (before deleting the document)
			await aggregateDelete(ctx, existing);
			await ctx.db.delete(existing._id);
		}
	},
});

/**
 * Internal mutation to log an email operation for monitoring
 */
export const logEmailOperation = zm({
	args: z.object({
		operationType: z.enum(["transactional", "event", "campaign", "loop"]),
		email: z.string().email(),
		actorId: z.string().optional(),
		transactionalId: z.string().optional(),
		campaignId: z.string().optional(),
		loopId: z.string().optional(),
		eventName: z.string().optional(),
		success: z.boolean(),
		messageId: z.string().optional(),
		metadata: z.record(z.string(), z.any()).optional(),
	}),
	returns: z.void(),
	handler: async (ctx, args) => {
		const operationData: Omit<
			Doc<"emailOperations">,
			"_id" | "_creationTime"
		> = {
			operationType: args.operationType,
			email: args.email,
			timestamp: Date.now(),
			success: args.success,
			actorId: args.actorId,
			transactionalId: args.transactionalId,
			campaignId: args.campaignId,
			loopId: args.loopId,
			eventName: args.eventName,
			messageId: args.messageId,
			metadata: args.metadata,
		};

		await ctx.db.insert("emailOperations", operationData);
	},
});

/**
 * Maximum number of documents to read when counting with filters.
 * This limit prevents query read limit errors while still providing accurate
 * counts for most use cases. If you have more contacts than this, consider
 * using the aggregate-based counting with userGroup only.
 */
const MAX_COUNT_LIMIT = 8000;

/**
 * Count contacts in the database
 * Can filter by audience criteria (userGroup, source, subscribed status)
 *
 * For userGroup-only filtering, uses efficient O(log n) aggregate counting.
 * For other filters (source, subscribed), uses indexed queries with a read limit.
 *
 * IMPORTANT: Before using this with existing data, run the backfillContactAggregate
 * mutation to populate the aggregate with existing contacts.
 *
 * NOTE: When filtering by source or subscribed, counts are capped at MAX_COUNT_LIMIT
 * to avoid query read limit errors. For exact counts with large datasets, use
 * userGroup-only filtering which uses efficient aggregate counting.
 */
export const countContacts = zq({
	args: z.object({
		userGroup: z.string().optional(),
		source: z.string().optional(),
		subscribed: z.boolean().optional(),
	}),
	returns: z.number(),
	handler: async (ctx, args) => {
		// If only userGroup is specified (or no filters), use efficient aggregate counting
		const onlyUserGroupFilter =
			args.source === undefined && args.subscribed === undefined;

		if (onlyUserGroupFilter) {
			// Use O(log n) aggregate counting - much more efficient than .collect()
			if (args.userGroup === undefined) {
				// Count ALL contacts across all namespaces
				return await aggregateCountTotal(ctx);
			}
			// Count contacts in specific userGroup namespace
			return await aggregateCountByUserGroup(ctx, args.userGroup);
		}

		// For other filters, we need to use indexed queries with in-memory filtering
		// We use .take() with a reasonable limit to avoid query read limit errors
		let contacts: Doc<"contacts">[];

		if (args.userGroup !== undefined) {
			contacts = await ctx.db
				.query("contacts")
				.withIndex("userGroup", (q) => q.eq("userGroup", args.userGroup))
				.take(MAX_COUNT_LIMIT);
		} else if (args.source !== undefined) {
			contacts = await ctx.db
				.query("contacts")
				.withIndex("source", (q) => q.eq("source", args.source))
				.take(MAX_COUNT_LIMIT);
		} else if (args.subscribed !== undefined) {
			contacts = await ctx.db
				.query("contacts")
				.withIndex("subscribed", (q) => q.eq("subscribed", args.subscribed))
				.take(MAX_COUNT_LIMIT);
		} else {
			// This branch shouldn't be reached due to onlyUserGroupFilter check above
			contacts = await ctx.db.query("contacts").take(MAX_COUNT_LIMIT);
		}

		// Apply additional filters if multiple criteria were provided
		const filtered = contacts.filter((c) => {
			if (args.userGroup !== undefined && c.userGroup !== args.userGroup) {
				return false;
			}
			if (args.source !== undefined && c.source !== args.source) {
				return false;
			}
			if (args.subscribed !== undefined && c.subscribed !== args.subscribed) {
				return false;
			}
			return true;
		});

		return filtered.length;
	},
});

/**
 * List contacts from the database with cursor-based pagination
 * Can filter by audience criteria (userGroup, source, subscribed status)
 * Returns actual contact data, not just a count
 *
 * Uses cursor-based pagination for efficient querying - only reads documents
 * from the cursor position forward, not all preceding documents.
 *
 * Note: When multiple filters are provided, only one index can be used.
 * Additional filters are applied in-memory after fetching.
 */
export const listContacts = zq({
	args: z.object({
		userGroup: z.string().optional(),
		source: z.string().optional(),
		subscribed: z.boolean().optional(),
		limit: z.number().min(1).max(1000).default(100),
		cursor: z.string().nullable().optional(),
	}),
	returns: z.object({
		contacts: z.array(
			z.object({
				_id: z.string(),
				email: z.string(),
				firstName: z.string().optional(),
				lastName: z.string().optional(),
				userId: z.string().optional(),
				source: z.string().optional(),
				subscribed: z.boolean(),
				userGroup: z.string().optional(),
				loopsContactId: z.string().optional(),
				createdAt: z.number(),
				updatedAt: z.number(),
			}),
		),
		continueCursor: z.string().nullable(),
		isDone: z.boolean(),
	}),
	handler: async (ctx, args) => {
		const paginationOpts = {
			cursor: args.cursor ?? null,
			numItems: args.limit,
		};

		// Determine which index to use based on filters
		const needsFiltering =
			(args.userGroup !== undefined ? 1 : 0) +
				(args.source !== undefined ? 1 : 0) +
				(args.subscribed !== undefined ? 1 : 0) >
			1;

		let result: PaginationResult<Doc<"contacts">>;

		if (args.userGroup !== undefined) {
			result = await paginator(ctx.db, schema)
				.query("contacts")
				.withIndex("userGroup", (q) => q.eq("userGroup", args.userGroup))
				.order("desc")
				.paginate(paginationOpts);
		} else if (args.source !== undefined) {
			result = await paginator(ctx.db, schema)
				.query("contacts")
				.withIndex("source", (q) => q.eq("source", args.source))
				.order("desc")
				.paginate(paginationOpts);
		} else if (args.subscribed !== undefined) {
			result = await paginator(ctx.db, schema)
				.query("contacts")
				.withIndex("subscribed", (q) => q.eq("subscribed", args.subscribed))
				.order("desc")
				.paginate(paginationOpts);
		} else {
			result = await paginator(ctx.db, schema)
				.query("contacts")
				.order("desc")
				.paginate(paginationOpts);
		}

		let contacts = result.page;

		// Apply additional filters if multiple criteria were provided
		if (needsFiltering) {
			contacts = contacts.filter((c) => {
				if (args.userGroup !== undefined && c.userGroup !== args.userGroup) {
					return false;
				}
				if (args.source !== undefined && c.source !== args.source) {
					return false;
				}
				if (args.subscribed !== undefined && c.subscribed !== args.subscribed) {
					return false;
				}
				return true;
			});
		}

		const mappedContacts = contacts.map((contact) => ({
			...contact,
			subscribed: contact.subscribed ?? true,
		}));

		return {
			contacts: mappedContacts,
			continueCursor: result.continueCursor,
			isDone: result.isDone,
		};
	},
});

/**
 * Add or update a contact in Loops
 * This function tries to create a contact, and if the email already exists (409),
 * it falls back to updating the contact instead.
 */
export const addContact = za({
	args: z.object({
		apiKey: z.string(),
		contact: contactValidator,
	}),
	returns: z.object({
		success: z.boolean(),
		id: z.string().optional(),
	}),
	handler: async (ctx, args) => {
		const createResponse = await loopsFetch(args.apiKey, "/contacts/create", {
			method: "POST",
			json: args.contact,
		});

		if (!createResponse.ok) {
			const errorText = await createResponse.text();

			if (createResponse.status === 409) {
				console.log(
					`Contact ${args.contact.email} already exists, updating instead`,
				);

				const findResponse = await loopsFetch(
					args.apiKey,
					`/contacts/find?email=${encodeURIComponent(args.contact.email)}`,
					{ method: "GET" },
				);

				if (!findResponse.ok) {
					const findErrorText = await findResponse.text();
					console.error(
						`Failed to find existing contact [${findResponse.status}]:`,
						findErrorText,
					);
				}

				const updateResponse = await loopsFetch(
					args.apiKey,
					"/contacts/update",
					{
						method: "PUT",
						json: {
							email: args.contact.email,
							firstName: args.contact.firstName,
							lastName: args.contact.lastName,
							userId: args.contact.userId,
							source: args.contact.source,
							subscribed: args.contact.subscribed,
							userGroup: args.contact.userGroup,
						},
					},
				);

				if (!updateResponse.ok) {
					const updateErrorText = await updateResponse.text();
					console.error(
						`Loops API error [${updateResponse.status}]:`,
						updateErrorText,
					);
					throw sanitizeLoopsError(updateResponse.status, updateErrorText);
				}

				// Get contact ID if available
				let contactId: string | undefined;
				if (findResponse.ok) {
					const findData = (await findResponse.json()) as { id?: string };
					contactId = findData.id;
				}

				// Store/update in our database
				await ctx.runMutation(internalLib.storeContact, {
					email: args.contact.email,
					firstName: args.contact.firstName,
					lastName: args.contact.lastName,
					userId: args.contact.userId,
					source: args.contact.source,
					subscribed: args.contact.subscribed,
					userGroup: args.contact.userGroup,
					loopsContactId: contactId,
				});

				return {
					success: true,
					id: contactId,
				};
			}

			console.error(`Loops API error [${createResponse.status}]:`, errorText);
			throw sanitizeLoopsError(createResponse.status, errorText);
		}

		// Contact was created successfully
		const data = (await createResponse.json()) as { id?: string };

		await ctx.runMutation(internalLib.storeContact, {
			email: args.contact.email,
			firstName: args.contact.firstName,
			lastName: args.contact.lastName,
			userId: args.contact.userId,
			source: args.contact.source,
			subscribed: args.contact.subscribed,
			userGroup: args.contact.userGroup,
			loopsContactId: data.id,
		});

		return {
			success: true,
			id: data.id,
		};
	},
});

/**
 * Update an existing contact in Loops
 */
export const updateContact = za({
	args: z.object({
		apiKey: z.string(),
		email: z.string().email(),
		dataVariables: z.record(z.string(), z.any()).optional(),
		firstName: z.string().optional(),
		lastName: z.string().optional(),
		userId: z.string().optional(),
		source: z.string().optional(),
		subscribed: z.boolean().optional(),
		userGroup: z.string().optional(),
	}),
	returns: z.object({
		success: z.boolean(),
	}),
	handler: async (ctx, args) => {
		const response = await loopsFetch(args.apiKey, "/contacts/update", {
			method: "PUT",
			json: {
				email: args.email,
				dataVariables: args.dataVariables,
				firstName: args.firstName,
				lastName: args.lastName,
				userId: args.userId,
				source: args.source,
				subscribed: args.subscribed,
				userGroup: args.userGroup,
			},
		});

		if (!response.ok) {
			const errorText = await response.text();
			console.error(`Loops API error [${response.status}]:`, errorText);
			throw sanitizeLoopsError(response.status, errorText);
		}

		await ctx.runMutation(internalLib.storeContact, {
			email: args.email,
			firstName: args.firstName,
			lastName: args.lastName,
			userId: args.userId,
			source: args.source,
			subscribed: args.subscribed,
			userGroup: args.userGroup,
		});

		return { success: true };
	},
});

/**
 * Send a transactional email using a transactional ID
 */
export const sendTransactional = za({
	args: z.object({
		apiKey: z.string(),
		transactionalId: z.string(),
		email: z.string().email(),
		dataVariables: z.record(z.string(), z.any()).optional(),
	}),
	returns: z.object({
		success: z.boolean(),
		messageId: z.string().optional(),
	}),
	handler: async (ctx, args) => {
		const response = await loopsFetch(args.apiKey, "/transactional", {
			method: "POST",
			json: {
				transactionalId: args.transactionalId,
				email: args.email,
				dataVariables: args.dataVariables,
			},
		});

		if (!response.ok) {
			const errorText = await response.text();
			console.error(`Loops API error [${response.status}]:`, errorText);
			await ctx.runMutation(internalLib.logEmailOperation, {
				operationType: "transactional",
				email: args.email,
				success: false,
				transactionalId: args.transactionalId,
			});

			throw sanitizeLoopsError(response.status, errorText);
		}

		const data = (await response.json()) as { messageId?: string };

		await ctx.runMutation(internalLib.logEmailOperation, {
			operationType: "transactional",
			email: args.email,
			success: true,
			transactionalId: args.transactionalId,
			messageId: data.messageId,
		});

		return {
			success: true,
			messageId: data.messageId,
		};
	},
});

/**
 * Send an event to Loops to trigger email workflows
 */
export const sendEvent = za({
	args: z.object({
		apiKey: z.string(),
		email: z.string().email(),
		eventName: z.string(),
		eventProperties: z.record(z.string(), z.any()).optional(),
	}),
	returns: z.object({
		success: z.boolean(),
	}),
	handler: async (ctx, args) => {
		const response = await loopsFetch(args.apiKey, "/events/send", {
			method: "POST",
			json: {
				email: args.email,
				eventName: args.eventName,
				eventProperties: args.eventProperties,
			},
		});

		if (!response.ok) {
			const errorText = await response.text();
			console.error(`Loops API error [${response.status}]:`, errorText);
			await ctx.runMutation(internalLib.logEmailOperation, {
				operationType: "event",
				email: args.email,
				success: false,
				eventName: args.eventName,
			});
			throw sanitizeLoopsError(response.status, errorText);
		}

		await ctx.runMutation(internalLib.logEmailOperation, {
			operationType: "event",
			email: args.email,
			success: true,
			eventName: args.eventName,
		});

		return { success: true };
	},
});

/**
 * Delete a contact from Loops
 */
export const deleteContact = za({
	args: z.object({
		apiKey: z.string(),
		email: z.string().email(),
	}),
	returns: z.object({
		success: z.boolean(),
	}),
	handler: async (ctx, args) => {
		const response = await loopsFetch(args.apiKey, "/contacts/delete", {
			method: "POST",
			json: { email: args.email },
		});

		if (!response.ok) {
			const errorText = await response.text();
			console.error(`Loops API error [${response.status}]:`, errorText);
			throw sanitizeLoopsError(response.status, errorText);
		}

		await ctx.runMutation(internalLib.removeContact, {
			email: args.email,
		});

		return { success: true };
	},
});

/**
 * Trigger a loop for a contact
 * Note: Loops in Loops.so are triggered through events, not a direct API endpoint.
 * This function uses the events endpoint to trigger the loop.
 * The loop must be configured in the Loops dashboard to listen for events.
 *
 * IMPORTANT: Loops.so doesn't have a direct /loops/trigger endpoint.
 * Loops are triggered by sending events. Make sure your loop in the dashboard
 * is configured to trigger on an event name (e.g., "loop_trigger").
 *
 * If you need to trigger a specific loop, you should:
 * 1. Configure the loop in the dashboard to listen for a specific event name
 * 2. Use sendEvent() with that event name instead
 *
 * This function is kept for backwards compatibility but works by sending an event.
 */
export const triggerLoop = za({
	args: z.object({
		apiKey: z.string(),
		loopId: z.string(),
		email: z.string().email(),
		dataVariables: z.record(z.string(), z.any()).optional(),
		eventName: z.string().optional(), // Event name that triggers the loop
	}),
	returns: z.object({
		success: z.boolean(),
		warning: z.string().optional(),
	}),
	handler: async (ctx, args) => {
		// Loops.so doesn't have a /loops/trigger endpoint
		// Loops are triggered through events. We'll use the events endpoint.
		// Default event name if not provided
		const eventName = args.eventName || `loop_${args.loopId}`;

		try {
			// Send event to trigger the loop
			await ctx.runAction(internalLib.sendEvent, {
				apiKey: args.apiKey,
				email: args.email,
				eventName,
				eventProperties: {
					...args.dataVariables,
					loopId: args.loopId, // Include loopId in event properties
				},
			});

			// Log as loop operation
			await ctx.runMutation(internalLib.logEmailOperation, {
				operationType: "loop",
				email: args.email,
				success: true,
				loopId: args.loopId,
				eventName,
			});

			return {
				success: true,
				warning:
					"Loops are triggered via events. Ensure your loop is configured to listen for this event.",
			};
		} catch (error) {
			// Log failed loop operation
			await ctx.runMutation(internalLib.logEmailOperation, {
				operationType: "loop",
				email: args.email,
				success: false,
				loopId: args.loopId,
				eventName,
				metadata: {
					error: error instanceof Error ? error.message : String(error),
				},
			});

			throw error;
		}
	},
});

/**
 * Find a contact by email
 * Retrieves contact information from Loops
 * Note: Loops API may return either an object or an array
 */
export const findContact = za({
	args: z.object({
		apiKey: z.string(),
		email: z.string().email(),
	}),
	returns: z.object({
		success: z.boolean(),
		contact: z
			.object({
				id: z.string().nullable().optional(),
				email: z.string().nullable().optional(),
				firstName: z.string().nullable().optional(),
				lastName: z.string().nullable().optional(),
				source: z.string().nullable().optional(),
				subscribed: z.boolean().nullable().optional(),
				userGroup: z.string().nullable().optional(),
				userId: z.string().nullable().optional(),
				createdAt: z.string().nullable().optional(),
			})
			.optional(),
	}),
	handler: async (_ctx, args) => {
		const response = await loopsFetch(
			args.apiKey,
			`/contacts/find?email=${encodeURIComponent(args.email)}`,
			{ method: "GET" },
		);

		if (!response.ok) {
			if (response.status === 404) {
				return { success: false, contact: undefined };
			}
			const errorText = await response.text();
			console.error(`Loops API error [${response.status}]:`, errorText);
			throw sanitizeLoopsError(response.status, errorText);
		}

		type LoopsContactRecord = Record<string, unknown>;
		const data = (await response.json()) as
			| LoopsContactRecord
			| Array<LoopsContactRecord>;

		// Handle case where Loops returns an array instead of a single object
		let contact = Array.isArray(data) ? data[0] : data;

		// Convert null values to undefined for optional fields (Zod handles undefined but not null in optional())
		if (contact) {
			contact = Object.fromEntries(
				Object.entries(contact).map(([key, value]) => [
					key,
					value === null ? undefined : value,
				]),
			) as LoopsContactRecord;
		}

		return {
			success: true,
			contact: contact as LoopsContactRecord | undefined,
		};
	},
});

/**
 * Batch create contacts
 * Creates multiple contacts sequentially using the single contact create endpoint.
 * Note: Loops.so doesn't have a batch endpoint, so we create contacts one by one.
 */
export const batchCreateContacts = za({
	args: z.object({
		apiKey: z.string(),
		contacts: z.array(contactValidator),
	}),
	returns: z.object({
		success: z.boolean(),
		created: z.number().optional(),
		failed: z.number().optional(),
		results: z
			.array(
				z.object({
					email: z.string(),
					success: z.boolean(),
					error: z.string().optional(),
				}),
			)
			.optional(),
	}),
	handler: async (ctx, args) => {
		let created = 0;
		let failed = 0;
		const results: Array<{ email: string; success: boolean; error?: string }> =
			[];

		// Create contacts one by one since Loops.so doesn't have a batch endpoint
		for (const contact of args.contacts) {
			try {
				// Use the addContact function which handles create/update logic
				const result = await ctx.runAction(internalLib.addContact, {
					apiKey: args.apiKey,
					contact,
				});

				if (result.success) {
					created++;
					results.push({ email: contact.email, success: true });
				} else {
					failed++;
					results.push({
						email: contact.email,
						success: false,
						error: "Unknown error",
					});
				}
			} catch (error) {
				failed++;
				results.push({
					email: contact.email,
					success: false,
					error: error instanceof Error ? error.message : String(error),
				});
			}
		}

		return {
			success: created > 0,
			created,
			failed,
			results,
		};
	},
});

/**
 * Unsubscribe a contact
 * Unsubscribes a contact from receiving emails (they remain in the system)
 */
export const unsubscribeContact = za({
	args: z.object({
		apiKey: z.string(),
		email: z.string().email(),
	}),
	returns: z.object({
		success: z.boolean(),
	}),
	handler: async (ctx, args) => {
		const response = await loopsFetch(args.apiKey, "/contacts/unsubscribe", {
			method: "POST",
			json: { email: args.email },
		});

		if (!response.ok) {
			const errorText = await response.text();
			console.error(`Loops API error [${response.status}]:`, errorText);
			throw sanitizeLoopsError(response.status, errorText);
		}

		await ctx.runMutation(internalLib.storeContact, {
			email: args.email,
			subscribed: false,
		});

		return { success: true };
	},
});

/**
 * Resubscribe a contact
 * Resubscribes a previously unsubscribed contact
 */
export const resubscribeContact = za({
	args: z.object({
		apiKey: z.string(),
		email: z.string().email(),
	}),
	returns: z.object({
		success: z.boolean(),
	}),
	handler: async (ctx, args) => {
		const response = await loopsFetch(args.apiKey, "/contacts/resubscribe", {
			method: "POST",
			json: { email: args.email },
		});

		if (!response.ok) {
			const errorText = await response.text();
			console.error(`Loops API error [${response.status}]:`, errorText);
			throw sanitizeLoopsError(response.status, errorText);
		}

		await ctx.runMutation(internalLib.storeContact, {
			email: args.email,
			subscribed: true,
		});

		return { success: true };
	},
});

/**
 * Maximum number of email operations to read for spam detection.
 * This limit prevents query read limit errors while covering most spam scenarios.
 * If you need to analyze more operations, consider using scheduled jobs with pagination.
 */
const MAX_SPAM_DETECTION_LIMIT = 8000;

/**
 * Check for spam patterns: too many emails to the same recipient in a time window
 * Returns email addresses that received too many emails.
 *
 * NOTE: Analysis is limited to the most recent MAX_SPAM_DETECTION_LIMIT operations
 * in the time window to avoid query read limit errors.
 */
export const detectRecipientSpam = zq({
	args: z.object({
		timeWindowMs: z.number().default(3600000),
		maxEmailsPerRecipient: z.number().default(10),
	}),
	returns: z.array(
		z
			.object({
				email: z.string(),
				count: z.number(),
				timeWindowMs: z.number(),
			})
			.catchall(z.any()),
	),
	handler: async (ctx, args) => {
		const cutoffTime = Date.now() - args.timeWindowMs;

		const operations = await ctx.db
			.query("emailOperations")
			.withIndex("timestamp", (q) => q.gte("timestamp", cutoffTime))
			.take(MAX_SPAM_DETECTION_LIMIT);

		const emailCounts = new Map<string, number>();
		for (const op of operations) {
			if (op.email && op.email !== "audience") {
				emailCounts.set(op.email, (emailCounts.get(op.email) ?? 0) + 1);
			}
		}

		const suspicious: Array<{
			email: string;
			count: number;
			timeWindowMs: number;
		}> = [];
		for (const [email, count] of emailCounts.entries()) {
			if (count > args.maxEmailsPerRecipient) {
				suspicious.push({
					email,
					count,
					timeWindowMs: args.timeWindowMs,
				});
			}
		}

		return suspicious;
	},
});

/**
 * Check for spam patterns: too many emails from the same actor/user
 * Returns actor IDs that sent too many emails.
 *
 * NOTE: Analysis is limited to the most recent MAX_SPAM_DETECTION_LIMIT operations
 * in the time window to avoid query read limit errors.
 */
export const detectActorSpam = zq({
	args: z.object({
		timeWindowMs: z.number().default(3600000),
		maxEmailsPerActor: z.number().default(100),
	}),
	returns: z.array(
		z.object({
			actorId: z.string(),
			count: z.number(),
			timeWindowMs: z.number(),
		}),
	),
	handler: async (ctx, args) => {
		const cutoffTime = Date.now() - args.timeWindowMs;

		const operations = await ctx.db
			.query("emailOperations")
			.withIndex("timestamp", (q) => q.gte("timestamp", cutoffTime))
			.take(MAX_SPAM_DETECTION_LIMIT);

		const actorCounts = new Map<string, number>();
		for (const op of operations) {
			if (op.actorId) {
				actorCounts.set(op.actorId, (actorCounts.get(op.actorId) ?? 0) + 1);
			}
		}

		const suspicious: Array<{
			actorId: string;
			count: number;
			timeWindowMs: number;
		}> = [];
		for (const [actorId, count] of actorCounts.entries()) {
			if (count > args.maxEmailsPerActor) {
				suspicious.push({
					actorId,
					count,
					timeWindowMs: args.timeWindowMs,
				});
			}
		}

		return suspicious;
	},
});

/**
 * Get recent email operation statistics for monitoring.
 *
 * NOTE: Statistics are calculated from the most recent MAX_SPAM_DETECTION_LIMIT
 * operations in the time window to avoid query read limit errors. For high-volume
 * applications, consider using scheduled jobs with pagination for exact statistics.
 */
export const getEmailStats = zq({
	args: z.object({
		timeWindowMs: z.number().default(86400000),
	}),
	returns: z
		.object({
			totalOperations: z.number(),
			successfulOperations: z.number(),
			failedOperations: z.number(),
			operationsByType: z.record(z.string(), z.number()),
			uniqueRecipients: z.number(),
			uniqueActors: z.number(),
		})
		.catchall(z.any()),
	handler: async (ctx, args) => {
		const cutoffTime = Date.now() - args.timeWindowMs;

		const operations = await ctx.db
			.query("emailOperations")
			.withIndex("timestamp", (q) => q.gte("timestamp", cutoffTime))
			.take(MAX_SPAM_DETECTION_LIMIT);

		const stats = {
			totalOperations: operations.length,
			successfulOperations: operations.filter((op) => op.success).length,
			failedOperations: operations.filter((op) => !op.success).length,
			operationsByType: {} as Record<string, number>,
			uniqueRecipients: new Set<string>(),
			uniqueActors: new Set<string>(),
		};

		for (const op of operations) {
			stats.operationsByType[op.operationType] =
				(stats.operationsByType[op.operationType] ?? 0) + 1;

			if (op.email && op.email !== "audience") {
				stats.uniqueRecipients.add(op.email);
			}

			if (op.actorId) {
				stats.uniqueActors.add(op.actorId);
			}
		}

		return {
			...stats,
			uniqueRecipients: stats.uniqueRecipients.size,
			uniqueActors: stats.uniqueActors.size,
		};
	},
});

/**
 * Detect rapid-fire email sending patterns (multiple emails sent in quick succession)
 * Returns suspicious patterns indicating potential spam.
 *
 * NOTE: Analysis is limited to the most recent MAX_SPAM_DETECTION_LIMIT operations
 * in the time window to avoid query read limit errors.
 */
export const detectRapidFirePatterns = zq({
	args: z.object({
		timeWindowMs: z.number().default(60000),
		minEmailsInWindow: z.number().default(5),
	}),
	returns: z.array(
		z.object({
			email: z.string().optional(),
			actorId: z.string().optional(),
			count: z.number(),
			timeWindowMs: z.number(),
			firstTimestamp: z.number(),
			lastTimestamp: z.number(),
		}),
	),
	handler: async (ctx, args) => {
		const cutoffTime = Date.now() - args.timeWindowMs;

		const operations = await ctx.db
			.query("emailOperations")
			.withIndex("timestamp", (q) => q.gte("timestamp", cutoffTime))
			.take(MAX_SPAM_DETECTION_LIMIT);

		const sortedOps = [...operations].sort((a, b) => a.timestamp - b.timestamp);

		const patterns: Array<{
			email?: string;
			actorId?: string;
			count: number;
			timeWindowMs: number;
			firstTimestamp: number;
			lastTimestamp: number;
		}> = [];

		const emailGroups = new Map<string, typeof sortedOps>();
		for (const op of sortedOps) {
			if (op.email && op.email !== "audience") {
				if (!emailGroups.has(op.email)) {
					emailGroups.set(op.email, []);
				}
				emailGroups.get(op.email)?.push(op);
			}
		}

		for (const [email, ops] of emailGroups.entries()) {
			for (let i = 0; i < ops.length; i++) {
				const op = ops[i];
				if (!op) continue;

				const windowStart = op.timestamp;
				const windowEnd = windowStart + args.timeWindowMs;
				const opsInWindow = ops.filter(
					(op) => op.timestamp >= windowStart && op.timestamp <= windowEnd,
				);

				if (opsInWindow.length >= args.minEmailsInWindow) {
					patterns.push({
						email,
						count: opsInWindow.length,
						timeWindowMs: args.timeWindowMs,
						firstTimestamp: windowStart,
						lastTimestamp: windowEnd,
					});
				}
			}
		}

		const actorGroups = new Map<string, typeof sortedOps>();
		for (const op of sortedOps) {
			if (op.actorId) {
				if (!actorGroups.has(op.actorId)) {
					actorGroups.set(op.actorId, []);
				}
				actorGroups.get(op.actorId)?.push(op);
			}
		}

		for (const [actorId, ops] of actorGroups.entries()) {
			for (let i = 0; i < ops.length; i++) {
				const op = ops[i];
				if (!op) continue;

				const windowStart = op.timestamp;
				const windowEnd = windowStart + args.timeWindowMs;
				const opsInWindow = ops.filter(
					(op) => op.timestamp >= windowStart && op.timestamp <= windowEnd,
				);

				if (opsInWindow.length >= args.minEmailsInWindow) {
					patterns.push({
						actorId,
						count: opsInWindow.length,
						timeWindowMs: args.timeWindowMs,
						firstTimestamp: windowStart,
						lastTimestamp: windowEnd,
					});
				}
			}
		}

		return patterns;
	},
});

/**
 * Rate limiting: Check if an email can be sent to a recipient
 * Based on recent email operations in the database.
 *
 * Uses efficient .take() query - only reads the minimum number of documents
 * needed to determine if the rate limit is exceeded.
 */
export const checkRecipientRateLimit = zq({
	args: z.object({
		email: z.string().email(),
		timeWindowMs: z.number(),
		maxEmails: z.number(),
	}),
	returns: z
		.object({
			allowed: z.boolean(),
			count: z.number(),
			limit: z.number(),
			timeWindowMs: z.number(),
			retryAfter: z.number().optional(),
		})
		.catchall(z.any()),
	handler: async (ctx, args) => {
		const cutoffTime = Date.now() - args.timeWindowMs;

		// Use the compound index (email, timestamp) to efficiently query
		// Only fetch up to maxEmails + 1 to check if limit exceeded
		const operations = await ctx.db
			.query("emailOperations")
			.withIndex("email", (q) =>
				q.eq("email", args.email).gte("timestamp", cutoffTime),
			)
			.take(args.maxEmails + 1);

		// Filter for successful operations only
		const recentOps = operations.filter((op) => op.success);
		const count = recentOps.length;
		const allowed = count < args.maxEmails;

		let retryAfter: number | undefined;
		if (!allowed && recentOps.length > 0) {
			const oldestOp = recentOps.reduce((oldest, op) =>
				op.timestamp < oldest.timestamp ? op : oldest,
			);
			retryAfter = oldestOp.timestamp + args.timeWindowMs - Date.now();
			if (retryAfter < 0) retryAfter = 0;
		}

		return {
			allowed,
			count,
			limit: args.maxEmails,
			timeWindowMs: args.timeWindowMs,
			retryAfter,
		};
	},
});

/**
 * Rate limiting: Check if an actor/user can send more emails
 * Based on recent email operations in the database.
 *
 * Uses efficient .take() query - only reads the minimum number of documents
 * needed to determine if the rate limit is exceeded.
 */
export const checkActorRateLimit = zq({
	args: z.object({
		actorId: z.string(),
		timeWindowMs: z.number(),
		maxEmails: z.number(),
	}),
	returns: z.object({
		allowed: z.boolean(),
		count: z.number(),
		limit: z.number(),
		timeWindowMs: z.number(),
		retryAfter: z.number().optional(),
	}),
	handler: async (ctx, args) => {
		const cutoffTime = Date.now() - args.timeWindowMs;

		// Use the compound index (actorId, timestamp) to efficiently query
		// Only fetch up to maxEmails + 1 to check if limit exceeded
		const operations = await ctx.db
			.query("emailOperations")
			.withIndex("actorId", (q) =>
				q.eq("actorId", args.actorId).gte("timestamp", cutoffTime),
			)
			.take(args.maxEmails + 1);

		// Filter for successful operations only
		const recentOps = operations.filter((op) => op.success);
		const count = recentOps.length;
		const allowed = count < args.maxEmails;

		let retryAfter: number | undefined;
		if (!allowed && recentOps.length > 0) {
			const oldestOp = recentOps.reduce((oldest, op) =>
				op.timestamp < oldest.timestamp ? op : oldest,
			);
			retryAfter = oldestOp.timestamp + args.timeWindowMs - Date.now();
			if (retryAfter < 0) retryAfter = 0;
		}

		return {
			allowed,
			count,
			limit: args.maxEmails,
			timeWindowMs: args.timeWindowMs,
			retryAfter,
		};
	},
});

/**
 * Rate limiting: Check global email sending rate
 * Checks total email operations across all senders.
 *
 * Uses efficient .take() query - only reads the minimum number of documents
 * needed to determine if the rate limit is exceeded.
 */
export const checkGlobalRateLimit = zq({
	args: z.object({
		timeWindowMs: z.number(),
		maxEmails: z.number(),
	}),
	returns: z.object({
		allowed: z.boolean(),
		count: z.number(),
		limit: z.number(),
		timeWindowMs: z.number(),
	}),
	handler: async (ctx, args) => {
		const cutoffTime = Date.now() - args.timeWindowMs;

		// Use the timestamp index to efficiently query recent operations
		// Only fetch up to maxEmails + 1 to check if limit exceeded
		const operations = await ctx.db
			.query("emailOperations")
			.withIndex("timestamp", (q) => q.gte("timestamp", cutoffTime))
			.take(args.maxEmails + 1);

		// Filter for successful operations only
		const recentOps = operations.filter((op) => op.success);
		const count = recentOps.length;
		const allowed = count < args.maxEmails;

		return {
			allowed,
			count,
			limit: args.maxEmails,
			timeWindowMs: args.timeWindowMs,
		};
	},
});

/**
 * Backfill the contact aggregate with existing contacts.
 * Run this mutation after upgrading to a version with aggregate support.
 *
 * This processes contacts in batches to avoid timeout issues with large datasets.
 * Call repeatedly with the returned cursor until isDone is true.
 *
 * Usage:
 * 1. First call with clear: true to reset the aggregate
 * 2. Subsequent calls with the returned cursor until isDone is true
 */
export const backfillContactAggregate = zm({
	args: z.object({
		cursor: z.string().nullable().optional(),
		batchSize: z.number().min(1).max(500).default(100),
		clear: z.boolean().optional(), // Set to true on first call to clear existing aggregate
	}),
	returns: z.object({
		processed: z.number(),
		cursor: z.string().nullable(),
		isDone: z.boolean(),
	}),
	handler: async (ctx, args) => {
		// Clear aggregate on first call if requested
		if (args.clear && !args.cursor) {
			await aggregateClear(ctx);
		}

		const paginationOpts = {
			cursor: args.cursor ?? null,
			numItems: args.batchSize,
		};

		const result = await paginator(ctx.db, schema)
			.query("contacts")
			.order("asc")
			.paginate(paginationOpts);

		// Insert each contact into the aggregate
		for (const contact of result.page) {
			await aggregateInsert(ctx, contact);
		}

		return {
			processed: result.page.length,
			cursor: result.continueCursor,
			isDone: result.isDone,
		};
	},
});
