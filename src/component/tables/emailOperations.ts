import { v } from "convex/values";

/**
 * Email operations table field definitions
 */
export const emailOperationsFields = {
	operationType: v.union(
		v.literal("transactional"),
		v.literal("event"),
		v.literal("campaign"),
		v.literal("loop"),
	),
	email: v.string(),
	actorId: v.optional(v.string()),
	transactionalId: v.optional(v.string()),
	campaignId: v.optional(v.string()),
	loopId: v.optional(v.string()),
	eventName: v.optional(v.string()),
	timestamp: v.number(),
	success: v.boolean(),
	messageId: v.optional(v.string()),
	metadata: v.optional(v.record(v.string(), v.any())),
};
