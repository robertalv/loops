import { defineSchema, defineTable } from "convex/server";
import { contactsFields } from "./tables/contacts";
import { emailOperationsFields } from "./tables/emailOperations";

export default defineSchema({
	contacts: defineTable(contactsFields)
		.index("email", ["email"])
		.index("userId", ["userId"])
		.index("userGroup", ["userGroup"])
		.index("source", ["source"])
		.index("subscribed", ["subscribed"]),
	emailOperations: defineTable(emailOperationsFields)
		.index("email", ["email", "timestamp"])
		.index("actorId", ["actorId", "timestamp"])
		.index("operationType", ["operationType", "timestamp"])
		.index("timestamp", ["timestamp"]),
});
