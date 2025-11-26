import { z } from "zod";
import { zodTable } from "zodvex";

export const Contacts = zodTable("contacts", {
	email: z.string().email(),
	firstName: z.string().optional(),
	lastName: z.string().optional(),
	userId: z.string().optional(),
	source: z.string().optional(),
	subscribed: z.boolean().default(true),
	userGroup: z.string().optional(),
	loopsContactId: z.string().optional(),
	createdAt: z.number(),
	updatedAt: z.number(),
});

