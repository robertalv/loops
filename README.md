# @devwithbobby/loops

[![npm version](https://img.shields.io/npm/v/@devwithbobby/loops.svg)](https://www.npmjs.com/package/@devwithbobby/loops)

A Convex component for integrating with [Loops.so](https://loops.so) email marketing platform. Send transactional emails, manage contacts, trigger loops, and monitor email operations with built-in spam detection and rate limiting.

## Features

- ✅ **Contact Management** - Create, update, find, and delete contacts
- ✅ **Transactional Emails** - Send one-off emails with templates
- ✅ **Events** - Trigger email workflows based on events
- ✅ **Loops** - Trigger automated email sequences
- ✅ **Monitoring** - Track all email operations with spam detection
- ✅ **Rate Limiting** - Built-in rate limiting queries for abuse prevention
- ✅ **Type-Safe** - Full TypeScript support with Zod validation

## Installation

```bash
npm install @devwithbobby/loops
# or
bun add @devwithbobby/loops
```

## Quick Start

### 1. Install and Mount the Component

In your `convex/convex.config.ts`:

```typescript
import loops from "@devwithbobby/loops/convex.config";
import { defineApp } from "convex/server";

const app = defineApp();
app.use(loops);

export default app;
```

### 2. Set Up Environment Variables

**⚠️ IMPORTANT: Set your Loops API key before using the component.**

```bash
npx convex env set LOOPS_API_KEY "your-loops-api-key-here"
```

**Or via Convex Dashboard:**
1. Go to Settings → Environment Variables
2. Add `LOOPS_API_KEY` with your Loops.so API key

Get your API key from [Loops.so Dashboard](https://app.loops.so/settings/api).

### 3. Use the Component

In your `convex/functions.ts` (or any convex file):

```typescript
import { Loops } from "@devwithbobby/loops";
import { components } from "./_generated/api";
import { action } from "./_generated/server";
import { v } from "convex/values";

// Initialize the Loops client
const loops = new Loops(components.loops);

// Export functions wrapped with auth (required in production)
export const addContact = action({
  args: {
    email: v.string(),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Add authentication check
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    return await loops.addContact(ctx, args);
  },
});

export const sendWelcomeEmail = action({
  args: {
    email: v.string(),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    // Send transactional email
    return await loops.sendTransactional(ctx, {
      transactionalId: "welcome-email-template-id",
      email: args.email,
      dataVariables: {
        name: args.name,
      },
    });
  },
});
```

## API Reference

### Contact Management

#### Add or Update Contact

```typescript
await loops.addContact(ctx, {
  email: "user@example.com",
  firstName: "John",
  lastName: "Doe",
  userId: "user123",
  source: "webapp",
  subscribed: true,
  userGroup: "premium",
});
```

#### Update Contact

```typescript
await loops.updateContact(ctx, "user@example.com", {
  firstName: "Jane",
  userGroup: "vip",
});
```

#### Find Contact

```typescript
const contact = await loops.findContact(ctx, "user@example.com");
```

#### Delete Contact

```typescript
await loops.deleteContact(ctx, "user@example.com");
```

#### Batch Create Contacts

```typescript
await loops.batchCreateContacts(ctx, {
  contacts: [
    { email: "user1@example.com", firstName: "John" },
    { email: "user2@example.com", firstName: "Jane" },
  ],
});
```

#### Unsubscribe/Resubscribe

```typescript
await loops.unsubscribeContact(ctx, "user@example.com");
await loops.resubscribeContact(ctx, "user@example.com");
```

#### Count Contacts

```typescript
// Count all contacts
const total = await loops.countContacts(ctx, {});

// Count by filter
const premium = await loops.countContacts(ctx, {
  userGroup: "premium",
  subscribed: true,
});
```

### Email Sending

#### Send Transactional Email

```typescript
await loops.sendTransactional(ctx, {
  transactionalId: "template-id-from-loops",
  email: "user@example.com",
  dataVariables: {
    name: "John",
    orderId: "12345",
  },
});
```

#### Send Event (Triggers Workflows)

```typescript
await loops.sendEvent(ctx, {
  email: "user@example.com",
  eventName: "purchase_completed",
  eventProperties: {
    product: "Premium Plan",
    amount: 99.99,
  },
});
```

#### Trigger Loop (Automated Sequence)

```typescript
await loops.triggerLoop(ctx, {
  loopId: "loop-id-from-loops",
  email: "user@example.com",
  dataVariables: {
    onboardingStep: "welcome",
  },
});
```

### Monitoring & Analytics

#### Get Email Statistics

```typescript
const stats = await loops.getEmailStats(ctx, {
  timeWindowMs: 3600000, // Last hour
});

console.log(stats.totalOperations); // Total emails sent
console.log(stats.successfulOperations); // Successful sends
console.log(stats.failedOperations); // Failed sends
console.log(stats.operationsByType); // Breakdown by type
console.log(stats.uniqueRecipients); // Unique email addresses
```

#### Detect Spam Patterns

```typescript
// Detect recipients with suspicious activity
const spamRecipients = await loops.detectRecipientSpam(ctx, {
  timeWindowMs: 3600000,
  maxEmailsPerRecipient: 10,
});

// Detect actors with suspicious activity
const spamActors = await loops.detectActorSpam(ctx, {
  timeWindowMs: 3600000,
  maxEmailsPerActor: 50,
});

// Detect rapid-fire patterns
const rapidFire = await loops.detectRapidFirePatterns(ctx, {
  timeWindowMs: 60000, // Last minute
  maxEmailsPerWindow: 5,
});
```

### Rate Limiting

#### Check Rate Limits

```typescript
// Check recipient rate limit
const recipientCheck = await loops.checkRecipientRateLimit(ctx, {
  email: "user@example.com",
  timeWindowMs: 3600000, // 1 hour
  maxEmails: 10,
});

if (!recipientCheck.allowed) {
  throw new Error(`Rate limit exceeded. Try again after ${recipientCheck.retryAfter}ms`);
}

// Check actor rate limit
const actorCheck = await loops.checkActorRateLimit(ctx, {
  actorId: "user123",
  timeWindowMs: 60000, // 1 minute
  maxEmails: 20,
});

// Check global rate limit
const globalCheck = await loops.checkGlobalRateLimit(ctx, {
  timeWindowMs: 60000,
  maxEmails: 1000,
});
```

**Example: Rate-limited email sending**

```typescript
export const sendTransactionalWithRateLimit = action({
  args: {
    transactionalId: v.string(),
    email: v.string(),
    actorId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const actorId = args.actorId ?? identity.subject;

    // Check rate limit before sending
    const rateLimitCheck = await loops.checkActorRateLimit(ctx, {
      actorId,
      timeWindowMs: 60000, // 1 minute
      maxEmails: 10,
    });

    if (!rateLimitCheck.allowed) {
      throw new Error(
        `Rate limit exceeded. Please try again after ${rateLimitCheck.retryAfter}ms.`
      );
    }

    // Send email
    return await loops.sendTransactional(ctx, {
      ...args,
      actorId,
    });
  },
});
```

## Using the API Helper

The component also exports an `api()` helper for easier re-exporting:

```typescript
import { Loops } from "@devwithbobby/loops";
import { components } from "./_generated/api";

const loops = new Loops(components.loops);

// Export all functions at once
export const {
  addContact,
  updateContact,
  sendTransactional,
  sendEvent,
  triggerLoop,
  countContacts,
  // ... all other functions
} = loops.api();
```

**⚠️ Security Warning:** The `api()` helper exports functions without authentication. Always wrap these functions with auth checks in production:

```typescript
export const addContact = action({
  args: { email: v.string(), ... },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    return await loops.addContact(ctx, args);
  },
});
```

## Security Best Practices

1. **Always add authentication** - Wrap all functions with auth checks
2. **Use environment variables** - Store API key in Convex environment variables (never hardcode)
3. **Implement rate limiting** - Use the built-in rate limiting queries to prevent abuse
4. **Monitor for abuse** - Use spam detection queries to identify suspicious patterns
5. **Sanitize errors** - Don't expose sensitive error details to clients

### Authentication Example

All functions should be wrapped with authentication:

```typescript
export const addContact = action({
  args: { email: v.string(), ... },
  handler: async (ctx, args) => {
    // Add authentication check
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    
    // Add authorization checks if needed
    // if (!isAdmin(identity)) throw new Error("Forbidden");
    
    return await loops.addContact(ctx, args);
  },
});
```

### Environment Variables

Set `LOOPS_API_KEY` in your Convex environment:

**Via CLI:**
```bash
npx convex env set LOOPS_API_KEY "your-api-key"
```

**Via Dashboard:**
1. Go to your Convex Dashboard
2. Navigate to Settings → Environment Variables
3. Add `LOOPS_API_KEY` with your Loops.so API key value

Get your API key from [Loops.so Dashboard](https://app.loops.so/settings/api).

⚠️ **Never** pass the API key directly in code or via function options in production. Always use environment variables.

## Monitoring & Rate Limiting

The component automatically logs all email operations to the `emailOperations` table for monitoring. Use the built-in queries to:

- **Track email statistics** - See total sends, success/failure rates, breakdowns by type
- **Detect spam patterns** - Identify suspicious activity by recipient or actor
- **Enforce rate limits** - Prevent abuse with recipient, actor, or global rate limits
- **Monitor for abuse** - Detect rapid-fire patterns and unusual sending behavior

All monitoring queries are available through the `Loops` client - see the [Monitoring & Analytics](#monitoring--analytics) section above for usage examples.

## Development

### Local Development

To use this component in development with live reloading:

```bash
bun run dev:backend
```

This starts Convex dev with `--live-component-sources` enabled, allowing changes to be reflected immediately.

### Building

```bash
npm run build
```

### Testing

```bash
npm test
```

## Project Structure

```
src/
  component/               # The Convex component
    convex.config.ts       # Component configuration
    schema.ts              # Database schema
    lib.ts                 # Component functions
    validators.ts          # Zod validators
    tables/                # Table definitions

  client/                  # Client library
    index.ts               # Loops client class
    types.ts               # TypeScript types

example/                   # Example app
  convex/
    example.ts             # Example usage
```

## API Coverage

This component implements the following Loops.so API endpoints:

- ✅ Create/Update Contact
- ✅ Delete Contact
- ✅ Find Contact
- ✅ Batch Create Contacts
- ✅ Unsubscribe/Resubscribe Contact
- ✅ Count Contacts (custom implementation)
- ✅ Send Transactional Email
- ✅ Send Event
- ✅ Trigger Loop

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## License

Apache-2.0

## Resources

- [Loops.so Documentation](https://loops.so/docs)
- [Convex Components Documentation](https://www.convex.dev/components)
- [Convex Environment Variables](https://docs.convex.dev/production/environment-variables)
