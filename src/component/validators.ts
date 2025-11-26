import { z } from "zod";

/**
 * Validators for Loops API requests and component operations
 */

/**
 * Validator for contact data
 * Used for creating and updating contacts
 */
export const contactValidator = z.object({
	email: z.string().email(),
	firstName: z.string().optional(),
	lastName: z.string().optional(),
	userId: z.string().optional(),
	source: z.string().optional(),
	subscribed: z.boolean().optional(),
	userGroup: z.string().optional(),
});

/**
 * Validator for transactional email requests
 */
export const transactionalEmailValidator = z.object({
	transactionalId: z.string().optional(),
	email: z.string().email(),
	dataVariables: z.record(z.string(), z.any()).optional(),
});

/**
 * Validator for event requests
 * Used for sending events that trigger email workflows
 */
export const eventValidator = z.object({
	email: z.string().email(),
	eventName: z.string(),
	eventProperties: z.record(z.string(), z.any()).optional(),
});

