import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { action } from "./_generated/server";
import { loopsFetch, sanitizeLoopsError } from "./helpers";
import {
	batchCreateResponseValidator,
	contactValidator,
	findContactResponseValidator,
	successResponseValidator,
	successWithIdResponseValidator,
	successWithMessageIdResponseValidator,
	successWithWarningResponseValidator,
} from "./validators";

/**
 * Add or update a contact in Loops
 * This function tries to create a contact, and if the email already exists (409),
 * it falls back to updating the contact instead.
 */
export const addContact = action({
	args: {
		apiKey: v.string(),
		contact: contactValidator,
	},
	returns: successWithIdResponseValidator,
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
				await ctx.runMutation(internal.mutations.storeContact, {
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

		await ctx.runMutation(internal.mutations.storeContact, {
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
export const updateContact = action({
	args: {
		apiKey: v.string(),
		email: v.string(),
		dataVariables: v.optional(v.record(v.string(), v.any())),
		firstName: v.optional(v.string()),
		lastName: v.optional(v.string()),
		userId: v.optional(v.string()),
		source: v.optional(v.string()),
		subscribed: v.optional(v.boolean()),
		userGroup: v.optional(v.string()),
	},
	returns: successResponseValidator,
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

		await ctx.runMutation(internal.mutations.storeContact, {
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
export const sendTransactional = action({
	args: {
		apiKey: v.string(),
		transactionalId: v.string(),
		email: v.string(),
		dataVariables: v.optional(v.record(v.string(), v.any())),
	},
	returns: successWithMessageIdResponseValidator,
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
			await ctx.runMutation(internal.mutations.logEmailOperation, {
				operationType: "transactional",
				email: args.email,
				success: false,
				transactionalId: args.transactionalId,
			});

			throw sanitizeLoopsError(response.status, errorText);
		}

		const data = (await response.json()) as { messageId?: string };

		await ctx.runMutation(internal.mutations.logEmailOperation, {
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
export const sendEvent = action({
	args: {
		apiKey: v.string(),
		email: v.string(),
		eventName: v.string(),
		eventProperties: v.optional(v.record(v.string(), v.any())),
	},
	returns: successResponseValidator,
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
			await ctx.runMutation(internal.mutations.logEmailOperation, {
				operationType: "event",
				email: args.email,
				success: false,
				eventName: args.eventName,
			});
			throw sanitizeLoopsError(response.status, errorText);
		}

		await ctx.runMutation(internal.mutations.logEmailOperation, {
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
export const deleteContact = action({
	args: {
		apiKey: v.string(),
		email: v.string(),
	},
	returns: successResponseValidator,
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

		await ctx.runMutation(internal.mutations.removeContact, {
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
export const triggerLoop = action({
	args: {
		apiKey: v.string(),
		loopId: v.string(),
		email: v.string(),
		dataVariables: v.optional(v.record(v.string(), v.any())),
		eventName: v.optional(v.string()),
	},
	returns: successWithWarningResponseValidator,
	handler: async (ctx, args) => {
		// Loops.so doesn't have a /loops/trigger endpoint
		// Loops are triggered through events. We'll use the events endpoint.
		// Default event name if not provided
		const eventName = args.eventName || `loop_${args.loopId}`;

		try {
			// Send event to trigger the loop
			await ctx.runAction(api.actions.sendEvent, {
				apiKey: args.apiKey,
				email: args.email,
				eventName,
				eventProperties: {
					...args.dataVariables,
					loopId: args.loopId, // Include loopId in event properties
				},
			});

			// Log as loop operation
			await ctx.runMutation(internal.mutations.logEmailOperation, {
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
			await ctx.runMutation(internal.mutations.logEmailOperation, {
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
export const findContact = action({
	args: {
		apiKey: v.string(),
		email: v.string(),
	},
	returns: findContactResponseValidator,
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

		// Convert null values to undefined for optional fields
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
export const batchCreateContacts = action({
	args: {
		apiKey: v.string(),
		contacts: v.array(contactValidator),
	},
	returns: batchCreateResponseValidator,
	handler: async (ctx, args) => {
		let created = 0;
		let failed = 0;
		const results: Array<{ email: string; success: boolean; error?: string }> =
			[];

		// Create contacts one by one since Loops.so doesn't have a batch endpoint
		for (const contact of args.contacts) {
			try {
				// Use the addContact function which handles create/update logic
				const result = await ctx.runAction(api.actions.addContact, {
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
 * Uses the update endpoint with subscribed: false as per Loops API
 */
export const unsubscribeContact = action({
	args: {
		apiKey: v.string(),
		email: v.string(),
	},
	returns: successResponseValidator,
	handler: async (ctx, args) => {
		const response = await loopsFetch(args.apiKey, "/contacts/update", {
			method: "PUT",
			json: { email: args.email, subscribed: false },
		});

		if (!response.ok) {
			const errorText = await response.text();
			console.error(`Loops API error [${response.status}]:`, errorText);
			throw sanitizeLoopsError(response.status, errorText);
		}

		await ctx.runMutation(internal.mutations.storeContact, {
			email: args.email,
			subscribed: false,
		});

		return { success: true };
	},
});

/**
 * Resubscribe a contact
 * Resubscribes a previously unsubscribed contact
 * Uses the update endpoint with subscribed: true as per Loops API
 */
export const resubscribeContact = action({
	args: {
		apiKey: v.string(),
		email: v.string(),
	},
	returns: successResponseValidator,
	handler: async (ctx, args) => {
		const response = await loopsFetch(args.apiKey, "/contacts/update", {
			method: "PUT",
			json: { email: args.email, subscribed: true },
		});

		if (!response.ok) {
			const errorText = await response.text();
			console.error(`Loops API error [${response.status}]:`, errorText);
			throw sanitizeLoopsError(response.status, errorText);
		}

		await ctx.runMutation(internal.mutations.storeContact, {
			email: args.email,
			subscribed: true,
		});

		return { success: true };
	},
});
