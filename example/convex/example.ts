import { Loops } from "@devwithbobby/loops";
import { action, query, mutation } from "./_generated/server";
import { components } from "./_generated/api";
import { v } from "convex/values";

/**
 * Initialize the Loops client with the mounted component.
 *
 * For this demo, we accept the API key as a parameter to allow testing
 * without setting up environment variables. In production, you should
 * use environment variables instead (LOOPS_API_KEY).
 */
const loops = new Loops(components.loops);

// ============================================================================
// HELPER: Create a Loops client with a custom API key
// ============================================================================

function getLoopsWithKey(apiKey?: string) {
	if (apiKey) {
		return new Loops(components.loops, { apiKey });
	}
	return loops;
}

// ============================================================================
// CONTACT MANAGEMENT
// ============================================================================

/**
 * Add or update a contact in Loops.
 */
export const addContact = action({
	args: {
		apiKey: v.optional(v.string()),
		email: v.string(),
		firstName: v.optional(v.string()),
		lastName: v.optional(v.string()),
		userId: v.optional(v.string()),
		source: v.optional(v.string()),
		subscribed: v.optional(v.boolean()),
		userGroup: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const { apiKey, ...contact } = args;
		const client = getLoopsWithKey(apiKey);
		return await client.addContact(ctx, contact);
	},
});

/**
 * Update an existing contact's information.
 */
export const updateContact = action({
	args: {
		apiKey: v.optional(v.string()),
		email: v.string(),
		firstName: v.optional(v.string()),
		lastName: v.optional(v.string()),
		userId: v.optional(v.string()),
		source: v.optional(v.string()),
		subscribed: v.optional(v.boolean()),
		userGroup: v.optional(v.string()),
		dataVariables: v.optional(v.any()),
	},
	handler: async (ctx, args) => {
		const { apiKey, email, ...updates } = args;
		const client = getLoopsWithKey(apiKey);
		return await client.updateContact(ctx, email, updates);
	},
});

/**
 * Find a contact by email address.
 */
export const findContact = action({
	args: {
		apiKey: v.optional(v.string()),
		email: v.string(),
	},
	handler: async (ctx, args) => {
		const client = getLoopsWithKey(args.apiKey);
		return await client.findContact(ctx, args.email);
	},
});

/**
 * Delete a contact from Loops.
 */
export const deleteContact = action({
	args: {
		apiKey: v.optional(v.string()),
		email: v.string(),
	},
	handler: async (ctx, args) => {
		const client = getLoopsWithKey(args.apiKey);
		return await client.deleteContact(ctx, args.email);
	},
});

/**
 * Create multiple contacts in a single operation.
 */
export const batchCreateContacts = action({
	args: {
		apiKey: v.optional(v.string()),
		contacts: v.array(
			v.object({
				email: v.string(),
				firstName: v.optional(v.string()),
				lastName: v.optional(v.string()),
				userId: v.optional(v.string()),
				source: v.optional(v.string()),
				subscribed: v.optional(v.boolean()),
				userGroup: v.optional(v.string()),
			}),
		),
	},
	handler: async (ctx, args) => {
		const client = getLoopsWithKey(args.apiKey);
		return await client.batchCreateContacts(ctx, args.contacts);
	},
});

/**
 * Unsubscribe a contact from receiving emails.
 */
export const unsubscribeContact = action({
	args: {
		apiKey: v.optional(v.string()),
		email: v.string(),
	},
	handler: async (ctx, args) => {
		const client = getLoopsWithKey(args.apiKey);
		return await client.unsubscribeContact(ctx, args.email);
	},
});

/**
 * Resubscribe a previously unsubscribed contact.
 */
export const resubscribeContact = action({
	args: {
		apiKey: v.optional(v.string()),
		email: v.string(),
	},
	handler: async (ctx, args) => {
		const client = getLoopsWithKey(args.apiKey);
		return await client.resubscribeContact(ctx, args.email);
	},
});

// ============================================================================
// EMAIL OPERATIONS
// ============================================================================

/**
 * Send a transactional email using a pre-configured template.
 */
export const sendTransactional = action({
	args: {
		apiKey: v.optional(v.string()),
		transactionalId: v.string(),
		email: v.string(),
		dataVariables: v.optional(v.any()),
	},
	handler: async (ctx, args) => {
		const { apiKey, ...options } = args;
		const client = getLoopsWithKey(apiKey);
		return await client.sendTransactional(ctx, options);
	},
});

/**
 * Send an event to trigger email workflows in Loops.
 */
export const sendEvent = action({
	args: {
		apiKey: v.optional(v.string()),
		email: v.string(),
		eventName: v.string(),
		eventProperties: v.optional(v.any()),
	},
	handler: async (ctx, args) => {
		const { apiKey, ...options } = args;
		const client = getLoopsWithKey(apiKey);
		return await client.sendEvent(ctx, options);
	},
});

/**
 * Trigger a loop (automated email sequence) for a contact.
 */
export const triggerLoop = action({
	args: {
		apiKey: v.optional(v.string()),
		loopId: v.string(),
		email: v.string(),
		dataVariables: v.optional(v.any()),
		eventName: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const { apiKey, ...options } = args;
		const client = getLoopsWithKey(apiKey);
		return await client.triggerLoop(ctx, options);
	},
});

// ============================================================================
// CONTACT QUERIES (Local Database - no API key needed)
// ============================================================================

/**
 * Count contacts in the local database.
 */
export const countContacts = query({
	args: {
		userGroup: v.optional(v.string()),
		source: v.optional(v.string()),
		subscribed: v.optional(v.boolean()),
	},
	handler: async (ctx, args) => {
		return await loops.countContacts(ctx, args);
	},
});

/**
 * List contacts with cursor-based pagination.
 */
export const listContacts = query({
	args: {
		userGroup: v.optional(v.string()),
		source: v.optional(v.string()),
		subscribed: v.optional(v.boolean()),
		limit: v.optional(v.number()),
		cursor: v.optional(v.union(v.string(), v.null())),
	},
	handler: async (ctx, args) => {
		return await loops.listContacts(ctx, args);
	},
});

// ============================================================================
// SPAM DETECTION & RATE LIMITING (Local Database - no API key needed)
// ============================================================================

/**
 * Detect spam patterns: recipients receiving too many emails.
 */
export const detectRecipientSpam = query({
	args: {
		timeWindowMs: v.optional(v.number()),
		maxEmailsPerRecipient: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		return await loops.detectRecipientSpam(ctx, args);
	},
});

/**
 * Detect spam patterns: actors/users sending too many emails.
 */
export const detectActorSpam = query({
	args: {
		timeWindowMs: v.optional(v.number()),
		maxEmailsPerActor: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		return await loops.detectActorSpam(ctx, args);
	},
});

/**
 * Detect rapid-fire email sending patterns.
 */
export const detectRapidFirePatterns = query({
	args: {
		timeWindowMs: v.optional(v.number()),
		minEmailsInWindow: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		return await loops.detectRapidFirePatterns(ctx, args);
	},
});

/**
 * Check rate limit for a specific recipient.
 */
export const checkRecipientRateLimit = query({
	args: {
		email: v.string(),
		timeWindowMs: v.number(),
		maxEmails: v.number(),
	},
	handler: async (ctx, args) => {
		return await loops.checkRecipientRateLimit(ctx, args);
	},
});

/**
 * Check rate limit for an actor/user sending emails.
 */
export const checkActorRateLimit = query({
	args: {
		actorId: v.string(),
		timeWindowMs: v.number(),
		maxEmails: v.number(),
	},
	handler: async (ctx, args) => {
		return await loops.checkActorRateLimit(ctx, args);
	},
});

/**
 * Check global rate limit across all senders.
 */
export const checkGlobalRateLimit = query({
	args: {
		timeWindowMs: v.number(),
		maxEmails: v.number(),
	},
	handler: async (ctx, args) => {
		return await loops.checkGlobalRateLimit(ctx, args);
	},
});

// ============================================================================
// MONITORING & STATISTICS (Local Database - no API key needed)
// ============================================================================

/**
 * Get email operation statistics for monitoring dashboards.
 */
export const getEmailStats = query({
	args: {
		timeWindowMs: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		return await loops.getEmailStats(ctx, args);
	},
});

// ============================================================================
// AGGREGATE MANAGEMENT
// ============================================================================

/**
 * Backfill the contact aggregate with existing contacts.
 */
export const backfillContactAggregate = mutation({
	args: {
		cursor: v.optional(v.union(v.string(), v.null())),
		batchSize: v.optional(v.number()),
		clear: v.optional(v.boolean()),
	},
	handler: async (ctx, args) => {
		return await loops.backfillContactAggregate(ctx, args);
	},
});
