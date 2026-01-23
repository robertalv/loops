import { v } from "convex/values";

/**
 * Validators for Loops API requests and component operations
 */

/**
 * Validator for contact data
 * Used for creating and updating contacts
 */
export const contactValidator = v.object({
	email: v.string(),
	firstName: v.optional(v.string()),
	lastName: v.optional(v.string()),
	userId: v.optional(v.string()),
	source: v.optional(v.string()),
	subscribed: v.optional(v.boolean()),
	userGroup: v.optional(v.string()),
});

/**
 * Validator for transactional email requests
 */
export const transactionalEmailValidator = v.object({
	transactionalId: v.optional(v.string()),
	email: v.string(),
	dataVariables: v.optional(v.record(v.string(), v.any())),
});

/**
 * Validator for event requests
 * Used for sending events that trigger email workflows
 */
export const eventValidator = v.object({
	email: v.string(),
	eventName: v.string(),
	eventProperties: v.optional(v.record(v.string(), v.any())),
});

/**
 * Validator for operation type enum
 */
export const operationTypeValidator = v.union(
	v.literal("transactional"),
	v.literal("event"),
	v.literal("campaign"),
	v.literal("loop"),
);

/**
 * Common return validators used across functions
 */
export const successResponseValidator = v.object({
	success: v.boolean(),
});

export const successWithIdResponseValidator = v.object({
	success: v.boolean(),
	id: v.optional(v.string()),
});

export const successWithMessageIdResponseValidator = v.object({
	success: v.boolean(),
	messageId: v.optional(v.string()),
});

export const successWithWarningResponseValidator = v.object({
	success: v.boolean(),
	warning: v.optional(v.string()),
});

/**
 * Contact document validator for query returns
 */
export const contactDocValidator = v.object({
	_id: v.string(),
	email: v.string(),
	firstName: v.optional(v.string()),
	lastName: v.optional(v.string()),
	userId: v.optional(v.string()),
	source: v.optional(v.string()),
	subscribed: v.boolean(),
	userGroup: v.optional(v.string()),
	loopsContactId: v.optional(v.string()),
	createdAt: v.number(),
	updatedAt: v.number(),
});

/**
 * Paginated contacts response validator
 */
export const paginatedContactsResponseValidator = v.object({
	contacts: v.array(contactDocValidator),
	continueCursor: v.union(v.string(), v.null()),
	isDone: v.boolean(),
});

/**
 * Rate limit response validator
 */
export const rateLimitResponseValidator = v.object({
	allowed: v.boolean(),
	count: v.number(),
	limit: v.number(),
	timeWindowMs: v.number(),
	retryAfter: v.optional(v.number()),
});

/**
 * Email stats response validator
 */
export const emailStatsResponseValidator = v.object({
	totalOperations: v.number(),
	successfulOperations: v.number(),
	failedOperations: v.number(),
	operationsByType: v.record(v.string(), v.number()),
	uniqueRecipients: v.number(),
	uniqueActors: v.number(),
});

/**
 * Spam detection validators
 */
export const recipientSpamValidator = v.object({
	email: v.string(),
	count: v.number(),
	timeWindowMs: v.number(),
});

export const actorSpamValidator = v.object({
	actorId: v.string(),
	count: v.number(),
	timeWindowMs: v.number(),
});

export const rapidFirePatternValidator = v.object({
	email: v.optional(v.string()),
	actorId: v.optional(v.string()),
	count: v.number(),
	timeWindowMs: v.number(),
	firstTimestamp: v.number(),
	lastTimestamp: v.number(),
});

/**
 * Batch create response validator
 */
export const batchCreateResponseValidator = v.object({
	success: v.boolean(),
	created: v.optional(v.number()),
	failed: v.optional(v.number()),
	results: v.optional(
		v.array(
			v.object({
				email: v.string(),
				success: v.boolean(),
				error: v.optional(v.string()),
			}),
		),
	),
});

/**
 * Find contact response validator
 * Note: Loops API returns additional fields beyond our contact model
 */
export const findContactResponseValidator = v.object({
	success: v.boolean(),
	contact: v.optional(
		v.object({
			id: v.optional(v.union(v.string(), v.null())),
			email: v.optional(v.union(v.string(), v.null())),
			firstName: v.optional(v.union(v.string(), v.null())),
			lastName: v.optional(v.union(v.string(), v.null())),
			source: v.optional(v.union(v.string(), v.null())),
			subscribed: v.optional(v.union(v.boolean(), v.null())),
			userGroup: v.optional(v.union(v.string(), v.null())),
			userId: v.optional(v.union(v.string(), v.null())),
			createdAt: v.optional(v.union(v.string(), v.null())),
			// Additional fields from Loops API
			audienceId: v.optional(v.union(v.string(), v.null())),
			timestamp: v.optional(v.union(v.string(), v.null())),
			dataVariables: v.optional(v.any()),
			mailingLists: v.optional(v.any()),
		}),
	),
});

/**
 * Backfill response validator
 */
export const backfillResponseValidator = v.object({
	processed: v.number(),
	cursor: v.union(v.string(), v.null()),
	isDone: v.boolean(),
});
