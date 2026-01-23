import { v } from "convex/values";

/**
 * Contacts table field definitions
 */
export const contactsFields = {
	email: v.string(),
	firstName: v.optional(v.string()),
	lastName: v.optional(v.string()),
	userId: v.optional(v.string()),
	source: v.optional(v.string()),
	subscribed: v.optional(v.boolean()),
	userGroup: v.optional(v.string()),
	loopsContactId: v.optional(v.string()),
	createdAt: v.number(),
	updatedAt: v.number(),
};
