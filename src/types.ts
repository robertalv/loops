import type {
	Expand,
	FunctionArgs,
	FunctionReference,
	FunctionReturnType,
	StorageActionWriter,
	StorageReader,
} from "convex/server";
import type { GenericId } from "convex/values";
import { internal } from "./component/_generated/api";

export type RunQueryCtx = {
	runQuery: <Query extends FunctionReference<"query", "internal">>(
		query: Query,
		args: FunctionArgs<Query>,
	) => Promise<FunctionReturnType<Query>>;
};

export type RunMutationCtx = RunQueryCtx & {
	runMutation: <Mutation extends FunctionReference<"mutation", "internal">>(
		mutation: Mutation,
		args: FunctionArgs<Mutation>,
	) => Promise<FunctionReturnType<Mutation>>;
};

export type RunActionCtx = RunMutationCtx & {
	runAction<Action extends FunctionReference<"action", "internal">>(
		action: Action,
		args: FunctionArgs<Action>,
	): Promise<FunctionReturnType<Action>>;
};

export type ActionCtx = RunActionCtx & {
	storage: StorageActionWriter;
};

export type QueryCtx = RunQueryCtx & {
	storage: StorageReader;
};

export type OpaqueIds<T> = T extends GenericId<infer _T>
	? string
	: T extends (infer U)[]
		? OpaqueIds<U>[]
		: T extends ArrayBuffer
			? ArrayBuffer
			: T extends object
				? {
						[K in keyof T]: OpaqueIds<T[K]>;
					}
				: T;

export type UseApi<API> = Expand<{
	[mod in keyof API]: API[mod] extends FunctionReference<
		infer FType,
		"public",
		infer FArgs,
		infer FReturnType,
		infer FComponentPath
	>
		? FunctionReference<
				FType,
				"internal",
				OpaqueIds<FArgs>,
				OpaqueIds<FReturnType>,
				FComponentPath
			>
		: UseApi<API[mod]>;
}>;

export type HeadersInitParam = ConstructorParameters<typeof Headers>[0];

export interface ContactPayload {
	email: string;
	firstName?: string;
	lastName?: string;
	userId?: string;
	source?: string;
	subscribed?: boolean;
	userGroup?: string;
}

export interface UpdateContactPayload extends Partial<ContactPayload> {
	email: string;
	dataVariables?: Record<string, unknown>;
}

export interface DeleteContactPayload {
	email?: string;
}

export interface TransactionalPayload {
	transactionalId?: string;
	email?: string;
	dataVariables?: Record<string, unknown>;
}

export interface EventPayload {
	email?: string;
	eventName?: string;
	eventProperties?: Record<string, unknown>;
}

export interface TriggerPayload {
	loopId?: string;
	email?: string;
	dataVariables?: Record<string, unknown>;
	eventName?: string;
}

export type InternalActionRef<
	Args extends Record<string, unknown> = Record<string, unknown>,
	Result = unknown,
> = FunctionReference<"action", "internal", Args, Result>;

export type InternalMutationRef<
	Args extends Record<string, unknown> = Record<string, unknown>,
	Result = unknown,
> = FunctionReference<"mutation", "internal", Args, Result>;

export type InternalQueryRef<
	Args extends Record<string, unknown> = Record<string, unknown>,
	Result = unknown,
> = FunctionReference<"query", "internal", Args, Result>;

type AddContactArgs = {
	apiKey: string;
	contact: ContactPayload;
};

type AddContactResult = {
	success: boolean;
	id?: string;
};

export interface InternalActionLib {
	addContact: InternalActionRef<AddContactArgs, AddContactResult>;
	updateContact: InternalActionRef;
	findContact: InternalActionRef;
	deleteContact: InternalActionRef;
	sendTransactional: InternalActionRef;
	sendEvent: InternalActionRef;
	triggerLoop: InternalActionRef;
	batchCreateContacts: InternalActionRef;
	unsubscribeContact: InternalActionRef;
	resubscribeContact: InternalActionRef;
	storeContact: InternalMutationRef;
	removeContact: InternalMutationRef;
	logEmailOperation: InternalMutationRef;
}

export interface InternalQueryLib {
	countContacts: InternalQueryRef;
	listContacts: InternalQueryRef;
	detectRecipientSpam: InternalQueryRef;
	detectActorSpam: InternalQueryRef;
	getEmailStats: InternalQueryRef;
	detectRapidFirePatterns: InternalQueryRef;
	checkRecipientRateLimit: InternalQueryRef;
	checkActorRateLimit: InternalQueryRef;
	checkGlobalRateLimit: InternalQueryRef;
}

export type InternalLibReferences = InternalActionLib & InternalQueryLib;

export const internalLib = (
	internal as unknown as { lib: InternalLibReferences }
).lib;
