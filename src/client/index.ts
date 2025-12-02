import { actionGeneric, queryGeneric } from "convex/server";
import { v } from "convex/values";
import type { Mounts } from "../component/_generated/api";
import type { RunActionCtx, RunQueryCtx, UseApi } from "../types";

export type LoopsComponent = UseApi<Mounts>;

export interface ContactData {
	email: string;
	firstName?: string;
	lastName?: string;
	userId?: string;
	source?: string;
	subscribed?: boolean;
	userGroup?: string;
}

export interface TransactionalEmailOptions {
	transactionalId: string;
	email: string;
	dataVariables?: Record<string, unknown>;
}

export interface EventOptions {
	email: string;
	eventName: string;
	eventProperties?: Record<string, unknown>;
}

export class Loops {
	public readonly options?: {
		apiKey?: string;
	};
	private readonly lib: NonNullable<LoopsComponent["lib"]>;

	constructor(
		component: LoopsComponent,
		options?: {
			apiKey?: string;
		},
	) {
		if (!component) {
			throw new Error(
				"Loops component reference is required. " +
					"Make sure the component is mounted in your convex.config.ts and use: " +
					"new Loops(components.loops)",
			);
		}

		if (!component.lib) {
			throw new Error(
				"Invalid component reference. " +
					"The component may not be properly mounted. " +
					"Ensure the component is correctly mounted in convex.config.ts: " +
					"app.use(loops);",
			);
		}

		this.lib = component.lib;
		this.options = options;

		const apiKey = options?.apiKey ?? process.env.LOOPS_API_KEY;
		if (!apiKey) {
			throw new Error(
				"Loops API key is required. Set LOOPS_API_KEY in your Convex environment variables.",
			);
		}

		if (options?.apiKey) {
			console.warn(
				"API key passed directly via options. " +
					"For security, use LOOPS_API_KEY environment variable instead. " +
					"See ENV_SETUP.md for details.",
			);
		}

		this.apiKey = apiKey;
	}

	private readonly apiKey: string;

	/**
	 * Add or update a contact in Loops
	 */
	async addContact(ctx: RunActionCtx, contact: ContactData) {
		return ctx.runAction(this.lib.addContact, {
			apiKey: this.apiKey,
			contact,
		});
	}

	/**
	 * Update an existing contact in Loops
	 */
	async updateContact(
		ctx: RunActionCtx,
		email: string,
		updates: Partial<ContactData> & {
			dataVariables?: Record<string, unknown>;
		},
	) {
		return ctx.runAction(this.lib.updateContact, {
			apiKey: this.apiKey,
			email,
			...updates,
		});
	}

	/**
	 * Send a transactional email using a transactional ID
	 */
	async sendTransactional(
		ctx: RunActionCtx,
		options: TransactionalEmailOptions,
	) {
		return ctx.runAction(this.lib.sendTransactional, {
			apiKey: this.apiKey,
			...options,
		});
	}

	/**
	 * Send an event to Loops to trigger email workflows
	 */
	async sendEvent(ctx: RunActionCtx, options: EventOptions) {
		return ctx.runAction(this.lib.sendEvent, {
			apiKey: this.apiKey,
			...options,
		});
	}

	/**
	 * Find a contact by email
	 * Retrieves contact information from Loops
	 */
	async findContact(ctx: RunActionCtx, email: string) {
		return ctx.runAction(this.lib.findContact, {
			apiKey: this.apiKey,
			email,
		});
	}

	/**
	 * Batch create contacts
	 * Create multiple contacts in a single API call
	 */
	async batchCreateContacts(ctx: RunActionCtx, contacts: ContactData[]) {
		return ctx.runAction(this.lib.batchCreateContacts, {
			apiKey: this.apiKey,
			contacts,
		});
	}

	/**
	 * Unsubscribe a contact
	 * Unsubscribes a contact from receiving emails (they remain in the system)
	 */
	async unsubscribeContact(ctx: RunActionCtx, email: string) {
		return ctx.runAction(this.lib.unsubscribeContact, {
			apiKey: this.apiKey,
			email,
		});
	}

	/**
	 * Resubscribe a contact
	 * Resubscribes a previously unsubscribed contact
	 */
	async resubscribeContact(ctx: RunActionCtx, email: string) {
		return ctx.runAction(this.lib.resubscribeContact, {
			apiKey: this.apiKey,
			email,
		});
	}

	/**
	 * Count contacts in the database
	 * Can filter by audience criteria (userGroup, source, subscribed status)
	 * This queries the component's local database, not Loops API
	 */
	async countContacts(
		ctx: RunQueryCtx,
		options?: {
			userGroup?: string;
			source?: string;
			subscribed?: boolean;
		},
	) {
		return ctx.runQuery(this.lib.countContacts, options ?? {});
	}

	/**
	 * List contacts with pagination and optional filters
	 * Returns actual contact data, not just a count
	 * This queries the component's local database, not Loops API
	 */
	async listContacts(
		ctx: RunQueryCtx,
		options?: {
			userGroup?: string;
			source?: string;
			subscribed?: boolean;
			limit?: number;
			offset?: number;
		},
	) {
		return ctx.runQuery(this.lib.listContacts, {
			userGroup: options?.userGroup,
			source: options?.source,
			subscribed: options?.subscribed,
			limit: options?.limit ?? 100,
			offset: options?.offset ?? 0,
		});
	}

	/**
	 * Detect spam patterns: emails sent to the same recipient too frequently
	 */
	async detectRecipientSpam(
		ctx: RunQueryCtx,
		options?: {
			timeWindowMs?: number;
			maxEmailsPerRecipient?: number;
		},
	) {
		return ctx.runQuery(this.lib.detectRecipientSpam, {
			timeWindowMs: options?.timeWindowMs ?? 3600000,
			maxEmailsPerRecipient: options?.maxEmailsPerRecipient ?? 10,
		});
	}

	/**
	 * Detect spam patterns: emails sent by the same actor/user too frequently
	 */
	async detectActorSpam(
		ctx: RunQueryCtx,
		options?: {
			timeWindowMs?: number;
			maxEmailsPerActor?: number;
		},
	) {
		return ctx.runQuery(this.lib.detectActorSpam, {
			timeWindowMs: options?.timeWindowMs ?? 3600000,
			maxEmailsPerActor: options?.maxEmailsPerActor ?? 100,
		});
	}

	/**
	 * Get email operation statistics for monitoring
	 */
	async getEmailStats(
		ctx: RunQueryCtx,
		options?: {
			timeWindowMs?: number;
		},
	) {
		return ctx.runQuery(this.lib.getEmailStats, {
			timeWindowMs: options?.timeWindowMs ?? 86400000,
		});
	}

	/**
	 * Detect rapid-fire email sending patterns
	 */
	async detectRapidFirePatterns(
		ctx: RunQueryCtx,
		options?: {
			timeWindowMs?: number;
			minEmailsInWindow?: number;
		},
	) {
		return ctx.runQuery(this.lib.detectRapidFirePatterns, {
			timeWindowMs: options?.timeWindowMs ?? 60000,
			minEmailsInWindow: options?.minEmailsInWindow ?? 5,
		});
	}

	/**
	 * Check if an email can be sent to a recipient based on rate limits
	 */
	async checkRecipientRateLimit(
		ctx: RunQueryCtx,
		options: {
			email: string;
			timeWindowMs: number;
			maxEmails: number;
		},
	) {
		return ctx.runQuery(this.lib.checkRecipientRateLimit, options);
	}

	/**
	 * Check if an actor/user can send more emails based on rate limits
	 */
	async checkActorRateLimit(
		ctx: RunQueryCtx,
		options: {
			actorId: string;
			timeWindowMs: number;
			maxEmails: number;
		},
	) {
		return ctx.runQuery(this.lib.checkActorRateLimit, options);
	}

	/**
	 * Check global email sending rate limit
	 */
	async checkGlobalRateLimit(
		ctx: RunQueryCtx,
		options: {
			timeWindowMs: number;
			maxEmails: number;
		},
	) {
		return ctx.runQuery(this.lib.checkGlobalRateLimit, options);
	}

	/**
	 * Delete a contact from Loops
	 */
	async deleteContact(ctx: RunActionCtx, email: string) {
		return ctx.runAction(this.lib.deleteContact, {
			apiKey: this.apiKey,
			email,
		});
	}

	/**
	 * Trigger a loop for a contact
	 * Loops are automated email sequences that can be triggered by events
	 *
	 * Note: Loops.so doesn't have a direct loop trigger endpoint.
	 * Loops are triggered through events. Make sure your loop is configured
	 * in the Loops dashboard to listen for events.
	 *
	 * @param options.eventName - Optional event name. If not provided, uses `loop_{loopId}`
	 */
	async triggerLoop(
		ctx: RunActionCtx,
		options: {
			loopId: string;
			email: string;
			dataVariables?: Record<string, unknown>;
			eventName?: string; // Event name that triggers the loop
		},
	) {
		return ctx.runAction(this.lib.triggerLoop, {
			apiKey: this.apiKey,
			...options,
		});
	}

	/**
	 * For easy re-exporting.
	 * Apps can do
	 * ```ts
	 * export const { addContact, sendTransactional, sendEvent, triggerLoop } = loops.api();
	 * ```
	 */
	api() {
		return {
			addContact: actionGeneric({
				args: {
					email: v.string(),
					firstName: v.optional(v.string()),
					lastName: v.optional(v.string()),
					userId: v.optional(v.string()),
					source: v.optional(v.string()),
					subscribed: v.optional(v.boolean()),
					userGroup: v.optional(v.string()),
				},
				handler: async (ctx, args) => {
					return await this.addContact(ctx, args);
				},
			}),
			updateContact: actionGeneric({
				args: {
					email: v.string(),
					firstName: v.optional(v.string()),
					lastName: v.optional(v.string()),
					userId: v.optional(v.string()),
					source: v.optional(v.string()),
					subscribed: v.optional(v.boolean()),
					userGroup: v.optional(v.string()),
					dataVariables: v.optional(v.any()),
				},
				handler: async (ctx, args) => {
					const { email, ...updates } = args;
					return await this.updateContact(ctx, email, updates);
				},
			}),
			sendTransactional: actionGeneric({
				args: {
					transactionalId: v.string(),
					email: v.string(),
					dataVariables: v.optional(v.any()),
				},
				handler: async (ctx, args) => {
					return await this.sendTransactional(ctx, args);
				},
			}),
			sendEvent: actionGeneric({
				args: {
					email: v.string(),
					eventName: v.string(),
					eventProperties: v.optional(v.any()),
				},
				handler: async (ctx, args) => {
					return await this.sendEvent(ctx, args);
				},
			}),
			deleteContact: actionGeneric({
				args: {
					email: v.string(),
				},
				handler: async (ctx, args) => {
					return await this.deleteContact(ctx, args.email);
				},
			}),
			triggerLoop: actionGeneric({
				args: {
					loopId: v.string(),
					email: v.string(),
					dataVariables: v.optional(v.any()),
				},
				handler: async (ctx, args) => {
					return await this.triggerLoop(ctx, args);
				},
			}),
			findContact: actionGeneric({
				args: {
					email: v.string(),
				},
				handler: async (ctx, args) => {
					return await this.findContact(ctx, args.email);
				},
			}),
			batchCreateContacts: actionGeneric({
				args: {
					contacts: v.array(
						v.object({
							email: v.string(),
							firstName: v.optional(v.string()),
							lastName: v.optional(v.string()),
							userId: v.optional(v.string()),
							source: v.optional(v.string()),
							subscribed: v.optional(v.boolean()),
							userGroup: v.optional(v.string()),
						}),
					),
				},
				handler: async (ctx, args) => {
					return await this.batchCreateContacts(ctx, args.contacts);
				},
			}),
			unsubscribeContact: actionGeneric({
				args: {
					email: v.string(),
				},
				handler: async (ctx, args) => {
					return await this.unsubscribeContact(ctx, args.email);
				},
			}),
			resubscribeContact: actionGeneric({
				args: {
					email: v.string(),
				},
				handler: async (ctx, args) => {
					return await this.resubscribeContact(ctx, args.email);
				},
			}),
			countContacts: queryGeneric({
				args: {
					userGroup: v.optional(v.string()),
					source: v.optional(v.string()),
					subscribed: v.optional(v.boolean()),
				},
				handler: async (ctx, args) => {
					return await this.countContacts(ctx, args);
				},
			}),
			detectRecipientSpam: queryGeneric({
				args: {
					timeWindowMs: v.optional(v.number()),
					maxEmailsPerRecipient: v.optional(v.number()),
				},
				handler: async (ctx, args) => {
					return await this.detectRecipientSpam(ctx, args);
				},
			}),
			detectActorSpam: queryGeneric({
				args: {
					timeWindowMs: v.optional(v.number()),
					maxEmailsPerActor: v.optional(v.number()),
				},
				handler: async (ctx, args) => {
					return await this.detectActorSpam(ctx, args);
				},
			}),
			getEmailStats: queryGeneric({
				args: {
					timeWindowMs: v.optional(v.number()),
				},
				handler: async (ctx, args) => {
					return await this.getEmailStats(ctx, args);
				},
			}),
			detectRapidFirePatterns: queryGeneric({
				args: {
					timeWindowMs: v.optional(v.number()),
					minEmailsInWindow: v.optional(v.number()),
				},
				handler: async (ctx, args) => {
					return await this.detectRapidFirePatterns(ctx, args);
				},
			}),
			checkRecipientRateLimit: queryGeneric({
				args: {
					email: v.string(),
					timeWindowMs: v.number(),
					maxEmails: v.number(),
				},
				handler: async (ctx, args) => {
					return await this.checkRecipientRateLimit(ctx, args);
				},
			}),
			checkActorRateLimit: queryGeneric({
				args: {
					actorId: v.string(),
					timeWindowMs: v.number(),
					maxEmails: v.number(),
				},
				handler: async (ctx, args) => {
					return await this.checkActorRateLimit(ctx, args);
				},
			}),
			checkGlobalRateLimit: queryGeneric({
				args: {
					timeWindowMs: v.number(),
					maxEmails: v.number(),
				},
				handler: async (ctx, args) => {
					return await this.checkGlobalRateLimit(ctx, args);
				},
			}),
		};
	}
}
