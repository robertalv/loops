import { TableAggregate } from "@convex-dev/aggregate";
import type { GenericMutationCtx, GenericQueryCtx } from "convex/server";
import type { DataModel, Doc } from "./_generated/dataModel";
import { components } from "./_generated/api";

// Cast components to the expected type for the aggregate library
// biome-ignore lint/suspicious/noExplicitAny: Component API type mismatch with aggregate library
const contactAggregateComponent = components.contactAggregate as any;

/**
 * Aggregate for counting contacts.
 * Uses userGroup as namespace for efficient filtered counting.
 * Key is null since we only need counts, not ordering.
 */
export const contactAggregate = new TableAggregate<{
	Namespace: string | undefined;
	Key: null;
	DataModel: DataModel;
	TableName: "contacts";
}>(contactAggregateComponent, {
	namespace: (doc) => doc.userGroup,
	sortKey: () => null,
});

type MutationCtx = GenericMutationCtx<DataModel>;
type QueryCtx = GenericQueryCtx<DataModel>;

/**
 * Insert a contact into the aggregate
 */
export async function aggregateInsert(
	ctx: MutationCtx,
	doc: Doc<"contacts">,
): Promise<void> {
	await contactAggregate.insertIfDoesNotExist(ctx, doc);
}

/**
 * Delete a contact from the aggregate
 */
export async function aggregateDelete(
	ctx: MutationCtx,
	doc: Doc<"contacts">,
): Promise<void> {
	await contactAggregate.deleteIfExists(ctx, doc);
}

/**
 * Replace a contact in the aggregate (when userGroup changes)
 */
export async function aggregateReplace(
	ctx: MutationCtx,
	oldDoc: Doc<"contacts">,
	newDoc: Doc<"contacts">,
): Promise<void> {
	await contactAggregate.replaceOrInsert(ctx, oldDoc, newDoc);
}

/**
 * Count contacts by userGroup namespace
 */
export async function aggregateCountByUserGroup(
	ctx: QueryCtx,
	userGroup: string | undefined,
): Promise<number> {
	return await contactAggregate.count(ctx, { namespace: userGroup });
}

/**
 * Count all contacts across all userGroups
 */
export async function aggregateCountTotal(ctx: QueryCtx): Promise<number> {
	let total = 0;
	for await (const namespace of contactAggregate.iterNamespaces(ctx)) {
		total += await contactAggregate.count(ctx, { namespace });
	}
	return total;
}

/**
 * Clear and reinitialize the aggregate (for backfill)
 */
export async function aggregateClear(
	ctx: MutationCtx,
	namespace?: string,
): Promise<void> {
	await contactAggregate.clear(ctx, { namespace });
}

