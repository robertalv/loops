import { v } from "convex/values";
import { paginator } from "convex-helpers/server/pagination";
import type { Doc } from "./_generated/dataModel";
import { internalMutation, mutation } from "./_generated/server";
import {
	aggregateClear,
	aggregateDelete,
	aggregateInsert,
	aggregateReplace,
} from "./aggregates";
import schema from "./schema";
import {
	backfillResponseValidator,
	operationTypeValidator,
} from "./validators";

/**
 * Internal mutation to store/update a contact in the database
 */
export const storeContact = internalMutation({
	args: {
		email: v.string(),
		firstName: v.optional(v.string()),
		lastName: v.optional(v.string()),
		userId: v.optional(v.string()),
		source: v.optional(v.string()),
		subscribed: v.optional(v.boolean()),
		userGroup: v.optional(v.string()),
		loopsContactId: v.optional(v.string()),
	},
	returns: v.null(),
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
		return null;
	},
});

/**
 * Internal mutation to delete a contact from the database
 */
export const removeContact = internalMutation({
	args: {
		email: v.string(),
	},
	returns: v.null(),
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
		return null;
	},
});

/**
 * Internal mutation to log an email operation for monitoring
 */
export const logEmailOperation = internalMutation({
	args: {
		operationType: operationTypeValidator,
		email: v.string(),
		actorId: v.optional(v.string()),
		transactionalId: v.optional(v.string()),
		campaignId: v.optional(v.string()),
		loopId: v.optional(v.string()),
		eventName: v.optional(v.string()),
		success: v.boolean(),
		messageId: v.optional(v.string()),
		metadata: v.optional(v.record(v.string(), v.any())),
	},
	returns: v.null(),
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
		return null;
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
export const backfillContactAggregate = mutation({
	args: {
		cursor: v.optional(v.union(v.string(), v.null())),
		batchSize: v.optional(v.number()),
		clear: v.optional(v.boolean()),
	},
	returns: backfillResponseValidator,
	handler: async (ctx, args) => {
		const batchSize = args.batchSize ?? 100;

		// Clear aggregate on first call if requested
		if (args.clear && !args.cursor) {
			await aggregateClear(ctx);
		}

		const paginationOpts = {
			cursor: args.cursor ?? null,
			numItems: Math.min(Math.max(1, batchSize), 500),
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
