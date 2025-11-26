import { defineSchema } from "convex/server";
import { Contacts } from "./tables/contacts";
import { EmailOperations } from "./tables/emailOperations";

export default defineSchema({
	contacts: Contacts.table
		.index("email", ["email"])
		.index("userId", ["userId"])
		.index("userGroup", ["userGroup"])
		.index("source", ["source"])
		.index("subscribed", ["subscribed"]),
	emailOperations: EmailOperations.table
		.index("email", ["email", "timestamp"])
		.index("actorId", ["actorId", "timestamp"])
		.index("operationType", ["operationType", "timestamp"])
		.index("timestamp", ["timestamp"]),
});
