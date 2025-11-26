import { z } from "zod";
import { za, zm, zq } from "../utils.js";
import { internal } from "./_generated/api";
import { contactValidator } from "./validators.js";

const LOOPS_API_BASE_URL = "https://app.loops.so/api/v1";

/**
 * Sanitize error messages to avoid leaking sensitive information
 */
const sanitizeError = (status: number, errorText: string): Error => {
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
		} else {
			await ctx.db.insert("contacts", {
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
		const operationData: Record<string, any> = {
			operationType: args.operationType,
			email: args.email,
			timestamp: Date.now(),
			success: args.success,
		};

		if (args.actorId) operationData.actorId = args.actorId;
		if (args.transactionalId) operationData.transactionalId = args.transactionalId;
		if (args.campaignId) operationData.campaignId = args.campaignId;
		if (args.loopId) operationData.loopId = args.loopId;
		if (args.eventName) operationData.eventName = args.eventName;
		if (args.messageId) operationData.messageId = args.messageId;
		if (args.metadata) operationData.metadata = args.metadata;

		await ctx.db.insert("emailOperations", operationData as any);
	},
});

/**
 * Count contacts in the database
 * Can filter by audience criteria (userGroup, source, subscribed status)
 */
export const countContacts = zq({
	args: z.object({
		userGroup: z.string().optional(),
		source: z.string().optional(),
		subscribed: z.boolean().optional(),
	}),
	returns: z.number(),
	handler: async (ctx, args) => {
		let contacts;
		if (args.userGroup !== undefined) {
			contacts = await ctx.db
				.query("contacts")
				.withIndex("userGroup", (q) => q.eq("userGroup", args.userGroup))
				.collect();
		} else if (args.source !== undefined) {
			contacts = await ctx.db
				.query("contacts")
				.withIndex("source", (q) => q.eq("source", args.source))
				.collect();
		} else if (args.subscribed !== undefined) {
			contacts = await ctx.db
				.query("contacts")
				.withIndex("subscribed", (q) => q.eq("subscribed", args.subscribed))
				.collect();
		} else {
			contacts = await ctx.db.query("contacts").collect();
		}

		if (args.userGroup !== undefined && contacts) {
			contacts = contacts.filter((c) => c.userGroup === args.userGroup);
		}
		if (args.source !== undefined && contacts) {
			contacts = contacts.filter((c) => c.source === args.source);
		}
		if (args.subscribed !== undefined && contacts) {
			contacts = contacts.filter((c) => c.subscribed === args.subscribed);
		}

		return contacts.length;
	},
});

/**
 * List contacts from the database with pagination
 * Can filter by audience criteria (userGroup, source, subscribed status)
 * Returns actual contact data, not just a count
 */
export const listContacts = zq({
	args: z.object({
		userGroup: z.string().optional(),
		source: z.string().optional(),
		subscribed: z.boolean().optional(),
		limit: z.number().min(1).max(1000).default(100),
		offset: z.number().min(0).default(0),
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
		total: z.number(),
		limit: z.number(),
		offset: z.number(),
		hasMore: z.boolean(),
	}),
	handler: async (ctx, args) => {
		let allContacts;
		
		// Get all contacts matching the filters
		if (args.userGroup !== undefined) {
			allContacts = await ctx.db
				.query("contacts")
				.withIndex("userGroup", (q) => q.eq("userGroup", args.userGroup))
				.collect();
		} else if (args.source !== undefined) {
			allContacts = await ctx.db
				.query("contacts")
				.withIndex("source", (q) => q.eq("source", args.source))
				.collect();
		} else if (args.subscribed !== undefined) {
			allContacts = await ctx.db
				.query("contacts")
				.withIndex("subscribed", (q) => q.eq("subscribed", args.subscribed))
				.collect();
		} else {
			allContacts = await ctx.db.query("contacts").collect();
		}

		// Apply additional filters (for cases where we need to filter by multiple criteria)
		if (args.userGroup !== undefined && allContacts) {
			allContacts = allContacts.filter((c) => c.userGroup === args.userGroup);
		}
		if (args.source !== undefined && allContacts) {
			allContacts = allContacts.filter((c) => c.source === args.source);
		}
		if (args.subscribed !== undefined && allContacts) {
			allContacts = allContacts.filter((c) => c.subscribed === args.subscribed);
		}

		// Sort by createdAt (newest first)
		allContacts.sort((a, b) => b.createdAt - a.createdAt);

		const total = allContacts.length;
		const paginatedContacts = allContacts.slice(args.offset, args.offset + args.limit);
		const hasMore = args.offset + args.limit < total;

		return {
			contacts: paginatedContacts,
			total,
			limit: args.limit,
			offset: args.offset,
			hasMore,
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
		const response = await fetch(`${LOOPS_API_BASE_URL}/contacts/create`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${args.apiKey}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify(args.contact),
		});

		if (!response.ok) {
			const errorText = await response.text();
			
			if (response.status === 409) {
				console.log(`Contact ${args.contact.email} already exists, updating instead`);
				
				const findResponse = await fetch(
					`${LOOPS_API_BASE_URL}/contacts/find?email=${encodeURIComponent(args.contact.email)}`,
					{
						method: "GET",
						headers: {
							Authorization: `Bearer ${args.apiKey}`,
							"Content-Type": "application/json",
						},
					}
				);

				if (!findResponse.ok) {
					const findErrorText = await findResponse.text();
					console.error(`Failed to find existing contact [${findResponse.status}]:`, findErrorText);
				}

				const updateResponse = await fetch(`${LOOPS_API_BASE_URL}/contacts/update`, {
					method: "PUT",
					headers: {
						Authorization: `Bearer ${args.apiKey}`,
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						email: args.contact.email,
						firstName: args.contact.firstName,
						lastName: args.contact.lastName,
						userId: args.contact.userId,
						source: args.contact.source,
						subscribed: args.contact.subscribed,
						userGroup: args.contact.userGroup,
					}),
				});

				if (!updateResponse.ok) {
					const updateErrorText = await updateResponse.text();
					console.error(`Loops API error [${updateResponse.status}]:`, updateErrorText);
					throw sanitizeError(updateResponse.status, updateErrorText);
				}

				// Get contact ID if available
				let contactId: string | undefined;
				if (findResponse.ok) {
					const findData = (await findResponse.json()) as { id?: string };
					contactId = findData.id;
				}

				// Store/update in our database
				await ctx.runMutation(((internal as any).lib).storeContact as any, {
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

			// For other errors, throw as normal
			console.error(`Loops API error [${response.status}]:`, errorText);
			throw sanitizeError(response.status, errorText);
		}

		// Contact was created successfully
		const data = (await response.json()) as { id?: string };

		await ctx.runMutation(((internal as any).lib).storeContact as any, {
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
		const response = await fetch(`${LOOPS_API_BASE_URL}/contacts/update`, {
			method: "PUT",
			headers: {
				Authorization: `Bearer ${args.apiKey}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				email: args.email,
				dataVariables: args.dataVariables,
				firstName: args.firstName,
				lastName: args.lastName,
				userId: args.userId,
				source: args.source,
				subscribed: args.subscribed,
				userGroup: args.userGroup,
			}),
		});

		if (!response.ok) {
			const errorText = await response.text();
			console.error(`Loops API error [${response.status}]:`, errorText);
			throw sanitizeError(response.status, errorText);
		}

		await ctx.runMutation(((internal as any).lib).storeContact as any, {
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
		const response = await fetch(`${LOOPS_API_BASE_URL}/transactional`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${args.apiKey}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				transactionalId: args.transactionalId,
				email: args.email,
				dataVariables: args.dataVariables,
			}),
		});

		if (!response.ok) {
			const errorText = await response.text();
			console.error(`Loops API error [${response.status}]:`, errorText);
			await ctx.runMutation(((internal as any).lib).logEmailOperation as any, {
				operationType: "transactional",
				email: args.email,
				success: false,
				transactionalId: args.transactionalId,
			});
			
			throw sanitizeError(response.status, errorText);
		}

		const data = (await response.json()) as { messageId?: string };

		await ctx.runMutation(((internal as any).lib).logEmailOperation as any, {
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
		const response = await fetch(`${LOOPS_API_BASE_URL}/events/send`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${args.apiKey}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				email: args.email,
				eventName: args.eventName,
				eventProperties: args.eventProperties,
			}),
		});

		if (!response.ok) {
			const errorText = await response.text();
			console.error(`Loops API error [${response.status}]:`, errorText);
			throw sanitizeError(response.status, errorText);
		}

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
		const response = await fetch(`${LOOPS_API_BASE_URL}/contacts/delete`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${args.apiKey}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ email: args.email }),
		});

		if (!response.ok) {
			const errorText = await response.text();
			console.error(`Loops API error [${response.status}]:`, errorText);
			throw sanitizeError(response.status, errorText);
		}

		await ctx.runMutation(((internal as any).lib).removeContact as any, {
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
			await ctx.runAction(((internal as any).lib).sendEvent as any, {
				apiKey: args.apiKey,
				email: args.email,
				eventName,
				eventProperties: {
					...args.dataVariables,
					loopId: args.loopId, // Include loopId in event properties
				},
			});

			// Log as loop operation
			await ctx.runMutation(((internal as any).lib).logEmailOperation as any, {
				operationType: "loop",
				email: args.email,
				success: true,
				loopId: args.loopId,
				eventName,
			});

			return {
				success: true,
				warning: "Loops are triggered via events. Ensure your loop is configured to listen for this event.",
			};
		} catch (error) {
			// Log failed loop operation
			await ctx.runMutation(((internal as any).lib).logEmailOperation as any, {
				operationType: "loop",
				email: args.email,
				success: false,
				loopId: args.loopId,
				eventName,
				metadata: { error: error instanceof Error ? error.message : String(error) },
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
	handler: async (ctx, args) => {
		const response = await fetch(
			`${LOOPS_API_BASE_URL}/contacts/find?email=${encodeURIComponent(args.email)}`,
			{
				method: "GET",
				headers: {
					Authorization: `Bearer ${args.apiKey}`,
					"Content-Type": "application/json",
				},
			},
		);

		if (!response.ok) {
			if (response.status === 404) {
				return { success: false, contact: undefined };
			}
			const errorText = await response.text();
			console.error(`Loops API error [${response.status}]:`, errorText);
			throw sanitizeError(response.status, errorText);
		}

		const data = (await response.json()) as Record<string, any> | Array<Record<string, any>>;

		// Handle case where Loops returns an array instead of a single object
		let contact = Array.isArray(data) ? data[0] : data;

		// Convert null values to undefined for optional fields (Zod handles undefined but not null in optional())
		if (contact) {
			contact = Object.fromEntries(
				Object.entries(contact).map(([key, value]) => [key, value === null ? undefined : value])
			) as Record<string, any>;
		}

		return {
			success: true,
			contact: contact as Record<string, any> | undefined,
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
		results: z.array(z.object({
			email: z.string(),
			success: z.boolean(),
			error: z.string().optional(),
		})).optional(),
	}),
	handler: async (ctx, args) => {
		let created = 0;
		let failed = 0;
		const results: Array<{ email: string; success: boolean; error?: string }> = [];

		// Create contacts one by one since Loops.so doesn't have a batch endpoint
		for (const contact of args.contacts) {
			try {
				// Use the addContact function which handles create/update logic
				const result = await ctx.runAction(((internal as any).lib).addContact as any, {
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
						error: "Unknown error" 
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
		const response = await fetch(`${LOOPS_API_BASE_URL}/contacts/unsubscribe`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${args.apiKey}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ email: args.email }),
		});

		if (!response.ok) {
			const errorText = await response.text();
			console.error(`Loops API error [${response.status}]:`, errorText);
			throw sanitizeError(response.status, errorText);
		}

		await ctx.runMutation(((internal as any).lib).storeContact as any, {
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
		const response = await fetch(`${LOOPS_API_BASE_URL}/contacts/resubscribe`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${args.apiKey}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ email: args.email }),
		});

		if (!response.ok) {
			const errorText = await response.text();
			console.error(`Loops API error [${response.status}]:`, errorText);
			throw sanitizeError(response.status, errorText);
		}

		await ctx.runMutation(((internal as any).lib).storeContact as any, {
			email: args.email,
			subscribed: true,
		});

		return { success: true };
	},
});

/**
 * Check for spam patterns: too many emails to the same recipient in a time window
 * Returns email addresses that received too many emails
 */
export const detectRecipientSpam = zq({
	args: z.object({
		timeWindowMs: z.number().default(3600000),
		maxEmailsPerRecipient: z.number().default(10),
	}),
	returns: z.array(
		z.object({
			email: z.string(),
			count: z.number(),
			timeWindowMs: z.number(),
		}),
	),
	handler: async (ctx, args) => {
		const cutoffTime = Date.now() - args.timeWindowMs;
		
		const operations = await ctx.db
			.query("emailOperations")
			.withIndex("timestamp", (q) => q.gte("timestamp", cutoffTime))
			.collect();

		const emailCounts = new Map<string, number>();
		for (const op of operations) {
			if (op.email && op.email !== "audience") {
				emailCounts.set(op.email, (emailCounts.get(op.email) ?? 0) + 1);
			}
		}

		const suspicious: Array<{ email: string; count: number; timeWindowMs: number }> = [];
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
 * Returns actor IDs that sent too many emails
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
			.collect();

		const actorCounts = new Map<string, number>();
		for (const op of operations) {
			if (op.actorId) {
				actorCounts.set(op.actorId, (actorCounts.get(op.actorId) ?? 0) + 1);
			}
		}

		const suspicious: Array<{ actorId: string; count: number; timeWindowMs: number }> = [];
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
 * Get recent email operation statistics for monitoring
 */
export const getEmailStats = zq({
	args: z.object({
		timeWindowMs: z.number().default(86400000),
	}),
	returns: z.object({
		totalOperations: z.number(),
		successfulOperations: z.number(),
		failedOperations: z.number(),
		operationsByType: z.record(z.string(), z.number()),
		uniqueRecipients: z.number(),
		uniqueActors: z.number(),
	}),
	handler: async (ctx, args) => {
		const cutoffTime = Date.now() - args.timeWindowMs;
		
		const operations = await ctx.db
			.query("emailOperations")
			.withIndex("timestamp", (q) => q.gte("timestamp", cutoffTime))
			.collect();

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
 * Returns suspicious patterns indicating potential spam
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
			.collect();

		operations.sort((a, b) => a.timestamp - b.timestamp);

		const patterns: Array<{
			email?: string;
			actorId?: string;
			count: number;
			timeWindowMs: number;
			firstTimestamp: number;
			lastTimestamp: number;
		}> = [];

		const emailGroups = new Map<string, typeof operations>();
		for (const op of operations) {
			if (op.email && op.email !== "audience") {
				if (!emailGroups.has(op.email)) {
					emailGroups.set(op.email, []);
				}
				emailGroups.get(op.email)!.push(op);
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

		const actorGroups = new Map<string, typeof operations>();
		for (const op of operations) {
			if (op.actorId) {
				if (!actorGroups.has(op.actorId)) {
					actorGroups.set(op.actorId, []);
				}
				actorGroups.get(op.actorId)!.push(op);
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
 * Based on recent email operations in the database
 */
export const checkRecipientRateLimit = zq({
	args: z.object({
		email: z.string().email(),
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

		const operations = await ctx.db
			.query("emailOperations")
			.withIndex("email", (q) => q.eq("email", args.email))
			.collect();

		const recentOps = operations.filter(
			(op) => op.timestamp >= cutoffTime && op.success,
		);

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
 * Based on recent email operations in the database
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

		const operations = await ctx.db
			.query("emailOperations")
			.withIndex("actorId", (q) => q.eq("actorId", args.actorId))
			.collect();

		const recentOps = operations.filter(
			(op) => op.timestamp >= cutoffTime && op.success,
		);

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
 * Checks total email operations across all senders
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

		const operations = await ctx.db
			.query("emailOperations")
			.withIndex("timestamp", (q) => q.gte("timestamp", cutoffTime))
			.collect();

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
