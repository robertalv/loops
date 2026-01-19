import type {
	GenericActionCtx,
	GenericDataModel,
	GenericMutationCtx,
	GenericQueryCtx,
} from "convex/server";
import { api } from "./component/_generated/api";

// Convenient types for `ctx` args, that only include the bare minimum.
export type RunQueryCtx = Pick<GenericQueryCtx<GenericDataModel>, "runQuery">;

export type RunMutationCtx = Pick<
	GenericMutationCtx<GenericDataModel>,
	"runQuery" | "runMutation"
>;

export type RunActionCtx = Pick<
	GenericActionCtx<GenericDataModel>,
	"runQuery" | "runMutation" | "runAction"
>;

// Type for Headers constructor parameter
export type HeadersInitParam = ConstructorParameters<typeof Headers>[0];

// Payload types for the Loops API
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

// Lib reference for component internals
// This is used internally by the component to call its own functions
export const internalLib = api.lib;
