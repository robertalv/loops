/* eslint-disable */
/**
 * Generated `ComponentApi` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type { FunctionReference } from "convex/server";

/**
 * A utility for referencing a Convex component's exposed API.
 *
 * Useful when expecting a parameter like `components.myComponent`.
 * Usage:
 * ```ts
 * async function myFunction(ctx: QueryCtx, component: ComponentApi) {
 *   return ctx.runQuery(component.someFile.someQuery, { ...args });
 * }
 * ```
 */
export type ComponentApi<Name extends string | undefined = string | undefined> =
  {
    lib: {
      addContact: FunctionReference<
        "action",
        "internal",
        {
          apiKey: string;
          contact: {
            email: string;
            firstName?: string;
            lastName?: string;
            source?: string;
            subscribed?: boolean;
            userGroup?: string;
            userId?: string;
          };
        },
        { id?: string; success: boolean },
        Name
      >;
      batchCreateContacts: FunctionReference<
        "action",
        "internal",
        {
          apiKey: string;
          contacts: Array<{
            email: string;
            firstName?: string;
            lastName?: string;
            source?: string;
            subscribed?: boolean;
            userGroup?: string;
            userId?: string;
          }>;
        },
        {
          created?: number;
          failed?: number;
          results?: Array<{ email: string; error?: string; success: boolean }>;
          success: boolean;
        },
        Name
      >;
      checkActorRateLimit: FunctionReference<
        "query",
        "internal",
        { actorId: string; maxEmails: number; timeWindowMs: number },
        {
          allowed: boolean;
          count: number;
          limit: number;
          retryAfter?: number;
          timeWindowMs: number;
        },
        Name
      >;
      checkGlobalRateLimit: FunctionReference<
        "query",
        "internal",
        { maxEmails: number; timeWindowMs: number },
        {
          allowed: boolean;
          count: number;
          limit: number;
          timeWindowMs: number;
        },
        Name
      >;
      checkRecipientRateLimit: FunctionReference<
        "query",
        "internal",
        { email: string; maxEmails: number; timeWindowMs: number },
        {
          allowed: boolean;
          count: number;
          limit: number;
          retryAfter?: number;
          timeWindowMs: number;
        },
        Name
      >;
      countContacts: FunctionReference<
        "query",
        "internal",
        { source?: string; subscribed?: boolean; userGroup?: string },
        number,
        Name
      >;
      deleteContact: FunctionReference<
        "action",
        "internal",
        { apiKey: string; email: string },
        { success: boolean },
        Name
      >;
      detectActorSpam: FunctionReference<
        "query",
        "internal",
        { maxEmailsPerActor?: number; timeWindowMs?: number },
        Array<{ actorId: string; count: number; timeWindowMs: number }>,
        Name
      >;
      detectRapidFirePatterns: FunctionReference<
        "query",
        "internal",
        { minEmailsInWindow?: number; timeWindowMs?: number },
        Array<{
          actorId?: string;
          count: number;
          email?: string;
          firstTimestamp: number;
          lastTimestamp: number;
          timeWindowMs: number;
        }>,
        Name
      >;
      detectRecipientSpam: FunctionReference<
        "query",
        "internal",
        { maxEmailsPerRecipient?: number; timeWindowMs?: number },
        Array<{ count: number; email: string; timeWindowMs: number }>,
        Name
      >;
      findContact: FunctionReference<
        "action",
        "internal",
        { apiKey: string; email: string },
        {
          contact?: {
            createdAt?: string | null;
            email?: string | null;
            firstName?: string | null;
            id?: string | null;
            lastName?: string | null;
            source?: string | null;
            subscribed?: boolean | null;
            userGroup?: string | null;
            userId?: string | null;
          };
          success: boolean;
        },
        Name
      >;
      getEmailStats: FunctionReference<
        "query",
        "internal",
        { timeWindowMs?: number },
        {
          failedOperations: number;
          operationsByType: Record<string, number>;
          successfulOperations: number;
          totalOperations: number;
          uniqueActors: number;
          uniqueRecipients: number;
        },
        Name
      >;
      listContacts: FunctionReference<
        "query",
        "internal",
        {
          limit?: number;
          offset?: number;
          source?: string;
          subscribed?: boolean;
          userGroup?: string;
        },
        {
          contacts: Array<{
            _id: string;
            createdAt: number;
            email: string;
            firstName?: string;
            lastName?: string;
            loopsContactId?: string;
            source?: string;
            subscribed: boolean;
            updatedAt: number;
            userGroup?: string;
            userId?: string;
          }>;
          hasMore: boolean;
          limit: number;
          offset: number;
          total: number;
        },
        Name
      >;
      logEmailOperation: FunctionReference<
        "mutation",
        "internal",
        {
          actorId?: string;
          campaignId?: string;
          email: string;
          eventName?: string;
          loopId?: string;
          messageId?: string;
          metadata?: Record<string, any>;
          operationType: "transactional" | "event" | "campaign" | "loop";
          success: boolean;
          transactionalId?: string;
        },
        any,
        Name
      >;
      removeContact: FunctionReference<
        "mutation",
        "internal",
        { email: string },
        any,
        Name
      >;
      resubscribeContact: FunctionReference<
        "action",
        "internal",
        { apiKey: string; email: string },
        { success: boolean },
        Name
      >;
      sendEvent: FunctionReference<
        "action",
        "internal",
        {
          apiKey: string;
          email: string;
          eventName: string;
          eventProperties?: Record<string, any>;
        },
        { success: boolean },
        Name
      >;
      sendTransactional: FunctionReference<
        "action",
        "internal",
        {
          apiKey: string;
          dataVariables?: Record<string, any>;
          email: string;
          transactionalId: string;
        },
        { messageId?: string; success: boolean },
        Name
      >;
      storeContact: FunctionReference<
        "mutation",
        "internal",
        {
          email: string;
          firstName?: string;
          lastName?: string;
          loopsContactId?: string;
          source?: string;
          subscribed?: boolean;
          userGroup?: string;
          userId?: string;
        },
        any,
        Name
      >;
      triggerLoop: FunctionReference<
        "action",
        "internal",
        {
          apiKey: string;
          dataVariables?: Record<string, any>;
          email: string;
          eventName?: string;
          loopId: string;
        },
        { success: boolean; warning?: string },
        Name
      >;
      unsubscribeContact: FunctionReference<
        "action",
        "internal",
        { apiKey: string; email: string },
        { success: boolean },
        Name
      >;
      updateContact: FunctionReference<
        "action",
        "internal",
        {
          apiKey: string;
          dataVariables?: Record<string, any>;
          email: string;
          firstName?: string;
          lastName?: string;
          source?: string;
          subscribed?: boolean;
          userGroup?: string;
          userId?: string;
        },
        { success: boolean },
        Name
      >;
    };
  };
