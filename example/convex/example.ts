import { Loops } from "devwithbobby/loops";
import { components } from "./_generated/api";

/**
 * Initialize the Loops client with the mounted component.
 * This provides a type-safe interface to the Loops component.
 *
 * ⚠️ SECURITY: The API key MUST be set in your Convex environment variables.
 *
 * Set it via:
 * - Convex Dashboard: Settings → Environment Variables → Add LOOPS_API_KEY
 * - CLI: npx convex env set LOOPS_API_KEY "your-api-key"
 *
 * See ENV_SETUP.md for detailed setup instructions.
 *
 * ⚠️ NEVER pass the API key directly via options in production code.
 * Only use options.apiKey for local testing.
 */
const loops = new Loops(components.loops);

/**
 * ⚠️ SECURITY WARNING ⚠️
 *
 * This example exports functions directly for demonstration purposes.
 * In production, you MUST:
 *
 * 1. Add authentication checks:
 *    ```ts
 *    const identity = await ctx.auth.getUserIdentity();
 *    if (!identity) throw new Error("Unauthorized");
 *    ```
 *
 * 2. Add authorization/permission checks based on user roles
 *
 * 3. Add rate limiting to prevent abuse
 *
 * 4. Sanitize error messages before returning to clients
 *
 * 5. Audit sensitive operations (delete, unsubscribe, send emails)
 *
 * See SECURITY.md for detailed security guidelines.
 */

/**
 * Export the API functions for use in the React app.
 * ⚠️ These are exported without auth checks for example purposes only.
 *
 * In production, wrap each function with authentication and authorization:
 *
 * ```ts
 * export const addContact = action({
 *   args: { email: v.string(), ... },
 *   handler: async (ctx, args) => {
 *     const identity = await ctx.auth.getUserIdentity();
 *     if (!identity) throw new Error("Unauthorized");
 *
 *     // Add permission checks here
 *     return await loops.addContact(ctx, args);
 *   },
 * });
 * ```
 */
export const {
	addContact,
	updateContact,
	findContact,
	batchCreateContacts,
	unsubscribeContact,
	resubscribeContact,
	countContacts,
	sendTransactional,
	sendEvent,
	triggerLoop,
	deleteContact,
} = loops.api();
