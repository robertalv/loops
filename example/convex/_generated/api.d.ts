/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as example from "../example.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  example: typeof example;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  loops: {
    actions: {
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
        { id?: string; success: boolean }
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
        }
      >;
      deleteContact: FunctionReference<
        "action",
        "internal",
        { apiKey: string; email: string },
        { success: boolean }
      >;
      findContact: FunctionReference<
        "action",
        "internal",
        { apiKey: string; email: string },
        {
          contact?: {
            audienceId?: string | null;
            createdAt?: string | null;
            dataVariables?: any;
            email?: string | null;
            firstName?: string | null;
            id?: string | null;
            lastName?: string | null;
            mailingLists?: any;
            source?: string | null;
            subscribed?: boolean | null;
            timestamp?: string | null;
            userGroup?: string | null;
            userId?: string | null;
          };
          success: boolean;
        }
      >;
      resubscribeContact: FunctionReference<
        "action",
        "internal",
        { apiKey: string; email: string },
        { success: boolean }
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
        { success: boolean }
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
        { messageId?: string; success: boolean }
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
        { success: boolean; warning?: string }
      >;
      unsubscribeContact: FunctionReference<
        "action",
        "internal",
        { apiKey: string; email: string },
        { success: boolean }
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
        { success: boolean }
      >;
    };
    mutations: {
      backfillContactAggregate: FunctionReference<
        "mutation",
        "internal",
        { batchSize?: number; clear?: boolean; cursor?: string | null },
        { cursor: string | null; isDone: boolean; processed: number }
      >;
    };
    queries: {
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
        }
      >;
      checkGlobalRateLimit: FunctionReference<
        "query",
        "internal",
        { maxEmails: number; timeWindowMs: number },
        { allowed: boolean; count: number; limit: number; timeWindowMs: number }
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
        }
      >;
      countContacts: FunctionReference<
        "query",
        "internal",
        { source?: string; subscribed?: boolean; userGroup?: string },
        number
      >;
      detectActorSpam: FunctionReference<
        "query",
        "internal",
        { maxEmailsPerActor?: number; timeWindowMs?: number },
        Array<{ actorId: string; count: number; timeWindowMs: number }>
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
        }>
      >;
      detectRecipientSpam: FunctionReference<
        "query",
        "internal",
        { maxEmailsPerRecipient?: number; timeWindowMs?: number },
        Array<{ count: number; email: string; timeWindowMs: number }>
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
        }
      >;
      listContacts: FunctionReference<
        "query",
        "internal",
        {
          cursor?: string | null;
          limit?: number;
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
          continueCursor: string | null;
          isDone: boolean;
        }
      >;
    };
  };
};
