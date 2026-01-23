import type { PaginationResult } from "convex/server";
import { v } from "convex/values";
import { paginator } from "convex-helpers/server/pagination";
import type { Doc } from "./_generated/dataModel";
import { query } from "./_generated/server";
import { aggregateCountByUserGroup, aggregateCountTotal } from "./aggregates";
import schema from "./schema";
import {
	actorSpamValidator,
	emailStatsResponseValidator,
	paginatedContactsResponseValidator,
	rapidFirePatternValidator,
	rateLimitResponseValidator,
	recipientSpamValidator,
} from "./validators";

/**
 * Maximum number of documents to read when counting with filters.
 * This limit prevents query read limit errors while still providing accurate
 * counts for most use cases. If you have more contacts than this, consider
 * using the aggregate-based counting with userGroup only.
 */
const MAX_COUNT_LIMIT = 8000;

/**
 * Maximum number of email operations to read for spam detection.
 * This limit prevents query read limit errors while covering most spam scenarios.
 * If you need to analyze more operations, consider using scheduled jobs with pagination.
 */
const MAX_SPAM_DETECTION_LIMIT = 8000;

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
export const countContacts = query({
	args: {
		userGroup: v.optional(v.string()),
		source: v.optional(v.string()),
		subscribed: v.optional(v.boolean()),
	},
	returns: v.number(),
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
export const listContacts = query({
	args: {
		userGroup: v.optional(v.string()),
		source: v.optional(v.string()),
		subscribed: v.optional(v.boolean()),
		limit: v.optional(v.number()),
		cursor: v.optional(v.union(v.string(), v.null())),
	},
	returns: paginatedContactsResponseValidator,
	handler: async (ctx, args) => {
		const limit = Math.min(Math.max(1, args.limit ?? 100), 1000);
		const paginationOpts = {
			cursor: args.cursor ?? null,
			numItems: limit,
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
			_id: contact._id as unknown as string,
			email: contact.email,
			firstName: contact.firstName,
			lastName: contact.lastName,
			userId: contact.userId,
			source: contact.source,
			subscribed: contact.subscribed ?? true,
			userGroup: contact.userGroup,
			loopsContactId: contact.loopsContactId,
			createdAt: contact.createdAt,
			updatedAt: contact.updatedAt,
		}));

		return {
			contacts: mappedContacts,
			continueCursor: result.continueCursor,
			isDone: result.isDone,
		};
	},
});

/**
 * Check for spam patterns: too many emails to the same recipient in a time window
 * Returns email addresses that received too many emails.
 *
 * NOTE: Analysis is limited to the most recent MAX_SPAM_DETECTION_LIMIT operations
 * in the time window to avoid query read limit errors.
 */
export const detectRecipientSpam = query({
	args: {
		timeWindowMs: v.optional(v.number()),
		maxEmailsPerRecipient: v.optional(v.number()),
	},
	returns: v.array(recipientSpamValidator),
	handler: async (ctx, args) => {
		const timeWindowMs = args.timeWindowMs ?? 3600000;
		const maxEmailsPerRecipient = args.maxEmailsPerRecipient ?? 10;
		const cutoffTime = Date.now() - timeWindowMs;

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
			if (count > maxEmailsPerRecipient) {
				suspicious.push({
					email,
					count,
					timeWindowMs,
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
export const detectActorSpam = query({
	args: {
		timeWindowMs: v.optional(v.number()),
		maxEmailsPerActor: v.optional(v.number()),
	},
	returns: v.array(actorSpamValidator),
	handler: async (ctx, args) => {
		const timeWindowMs = args.timeWindowMs ?? 3600000;
		const maxEmailsPerActor = args.maxEmailsPerActor ?? 100;
		const cutoffTime = Date.now() - timeWindowMs;

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
			if (count > maxEmailsPerActor) {
				suspicious.push({
					actorId,
					count,
					timeWindowMs,
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
export const getEmailStats = query({
	args: {
		timeWindowMs: v.optional(v.number()),
	},
	returns: emailStatsResponseValidator,
	handler: async (ctx, args) => {
		const timeWindowMs = args.timeWindowMs ?? 86400000;
		const cutoffTime = Date.now() - timeWindowMs;

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
export const detectRapidFirePatterns = query({
	args: {
		timeWindowMs: v.optional(v.number()),
		minEmailsInWindow: v.optional(v.number()),
	},
	returns: v.array(rapidFirePatternValidator),
	handler: async (ctx, args) => {
		const timeWindowMs = args.timeWindowMs ?? 60000;
		const minEmailsInWindow = args.minEmailsInWindow ?? 5;
		const cutoffTime = Date.now() - timeWindowMs;

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
				const windowEnd = windowStart + timeWindowMs;
				const opsInWindow = ops.filter(
					(op) => op.timestamp >= windowStart && op.timestamp <= windowEnd,
				);

				if (opsInWindow.length >= minEmailsInWindow) {
					patterns.push({
						email,
						count: opsInWindow.length,
						timeWindowMs,
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
				const windowEnd = windowStart + timeWindowMs;
				const opsInWindow = ops.filter(
					(op) => op.timestamp >= windowStart && op.timestamp <= windowEnd,
				);

				if (opsInWindow.length >= minEmailsInWindow) {
					patterns.push({
						actorId,
						count: opsInWindow.length,
						timeWindowMs,
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
export const checkRecipientRateLimit = query({
	args: {
		email: v.string(),
		timeWindowMs: v.number(),
		maxEmails: v.number(),
	},
	returns: rateLimitResponseValidator,
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
export const checkActorRateLimit = query({
	args: {
		actorId: v.string(),
		timeWindowMs: v.number(),
		maxEmails: v.number(),
	},
	returns: rateLimitResponseValidator,
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
export const checkGlobalRateLimit = query({
	args: {
		timeWindowMs: v.number(),
		maxEmails: v.number(),
	},
	returns: v.object({
		allowed: v.boolean(),
		count: v.number(),
		limit: v.number(),
		timeWindowMs: v.number(),
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
