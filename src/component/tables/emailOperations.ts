import { z } from "zod";
import { zodTable } from "zodvex";

export const EmailOperations = zodTable("emailOperations", {
	operationType: z.enum([
		"transactional",
		"event",
		"campaign",
		"loop",
	]),
	email: z.string().email(),
	actorId: z.string().optional(),
	transactionalId: z.string().optional(),
	campaignId: z.string().optional(),
	loopId: z.string().optional(),
	eventName: z.string().optional(),
	timestamp: z.number(),
	success: z.boolean(),
	messageId: z.string().optional(),
	metadata: z.optional(z.record(z.string(), z.any())),
});

