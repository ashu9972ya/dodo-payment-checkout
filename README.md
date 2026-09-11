# Dodo Checkout SDK

A small embeddable checkout experience built with TypeScript and Next.js.

The project demonstrates how a merchant can integrate a remotely hosted checkout using a lightweight TypeScript SDK while keeping the checkout experience isolated inside an iframe.

---

## Live Demo

> Add the deployed URLs here before submission.

**Demo:** `https://your-demo-url.com`

**Checkout:** `https://your-checkout-url.com`

---

## Overview

The project contains three main parts:

```text
Merchant / Demo
      │
      │ DodoCheckout.open()
      ▼
TypeScript SDK
      │
      │ iframe
      ▼
Hosted Checkout
      │
      │ postMessage
      ▼
SDK callbacks
      │
      ▼
Merchant
```

The merchant only interacts with a small SDK API.

The checkout application owns:

- Product display
- Email input
- Card details
- Payment validation
- Payment processing state
- Success and error states

The merchant application receives only high-level checkout events such as success, error, and close.

---

## Features

- Plain TypeScript checkout SDK
- Hosted checkout application
- iframe-based checkout isolation
- Cross-origin `postMessage` communication
- Typed checkout events
- Checkout initialization handshake
- Origin and iframe source validation
- Loading failure handling
- Checkout loading timeout
- Payment timeout handling
- Payment retry flow
- Success, declined, and failed payment states
- Double-open protection
- SDK resource cleanup
- Merchant callback API
- Demo event log
- Deterministic fake payment scenarios

---

## Tech Stack

- **TypeScript**
- **React**
- **Next.js**
- **Tailwind CSS**
- **pnpm workspaces**
- **Turborepo**
- **iframe + `window.postMessage`**

---

## Project Structure

```text
dodo-checkout/
│
├── apps/
│   ├── checkout/
│   │   └── app/
│   │       └── checkout/
│   │           └── page.tsx
│   │
│   └── demo/
│       └── app/
│           └── page.tsx
│
├── packages/
│   └── sdk/
│       └── src/
│           └── index.ts
│
├── docs/
│   └── ARCHITECTURE.md
│
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
└── README.md
```

### `apps/checkout`

The remotely hosted checkout application.

Responsibilities:

- Receive checkout initialization
- Resolve the requested product
- Collect customer information
- Collect payment information
- Validate the checkout form
- Simulate payment processing
- Handle payment states
- Display success and error states
- Communicate events back to the merchant SDK

### `apps/demo`

A merchant-style demo application.

It demonstrates:

- Opening checkout
- Using the SDK API
- Receiving SDK callbacks
- Displaying checkout events
- Testing the different payment scenarios

### `packages/sdk`

The plain TypeScript SDK.

Responsibilities:

- Create the checkout iframe
- Manage iframe lifecycle
- Initialize the checkout
- Establish the communication handshake
- Validate incoming messages
- Forward checkout events to merchant callbacks
- Handle loading failures and timeouts
- Clean up listeners, timers, and iframe resources

---

# SDK Usage

The merchant integration is intentionally small.

```ts
import { DodoCheckout } from "@dodo-checkout/sdk";

DodoCheckout.open({
  productId: "prod_123",

  onSuccess: ({ sessionId }) => {
    console.log("Payment successful:", sessionId);
  },

  onClose: ({ reason }) => {
    console.log("Checkout closed:", reason);
  },

  onError: ({ code, message }) => {
    console.error(code, message);
  },
});
```

---

## SDK API

### `DodoCheckout.open()`

```ts
DodoCheckout.open(options);
```

### Options

#### `productId`

Required.

Identifies the product that should be displayed by the checkout.

```ts
productId: "prod_123"
```

#### `onSuccess`

Called after:

1. Payment succeeds
2. The success screen is displayed
3. The customer completes the success state

```ts
onSuccess: ({ sessionId }) => {
  console.log("Payment successful:", sessionId);
}
```

The callback receives:

```ts
{
  sessionId: string;
}
```

#### `onClose`

Called when the customer manually closes the checkout.

```ts
onClose: ({ reason }) => {
  console.log("Checkout closed:", reason);
}
```

The current manual close behavior uses:

```ts
reason: "user"
```

Successful checkout completion is reported through `onSuccess`, not `onClose`.

#### `onError`

Called when checkout or payment processing encounters an error.

```ts
onError: ({ code, message }) => {
  console.error(code, message);
}
```

Example error codes:

```text
INVALID_OPTIONS
CHECKOUT_LOAD_FAILED
CHECKOUT_LOAD_TIMEOUT
PRODUCT_NOT_FOUND
CARD_DECLINED
PAYMENT_FAILED
PAYMENT_TIMEOUT
```

---

# Checkout Isolation

The checkout is rendered inside an iframe.

```text
┌─────────────────────────────┐
│       Merchant Page         │
│                             │
│  Buy Now                    │
│      │                      │
│      ▼                      │
│  DodoCheckout.open()        │
│      │                      │
│      ▼                      │
│  ┌───────────────────────┐  │
│  │    Checkout iframe    │  │
│  │                       │  │
│  │  Product              │  │
│  │  Email                │  │
│  │  Card                  │  │
│  │  Expiry               │  │
│  │  CVC                   │  │
│  │                       │  │
│  │  Payment processing   │  │
│  └───────────────────────┘  │
│                             │
└─────────────────────────────┘
```

Payment fields are rendered inside the checkout application rather than directly in the merchant page.

This creates a clear ownership boundary:

```text
Merchant
   │
   │ SDK API
   ▼
Checkout iframe
   │
   │ payment data
   ▼
Payment processing
```

For this assignment, payment processing is simulated.

A production implementation would additionally require real payment-provider tokenization or hosted payment fields and appropriate security controls.

---

# Communication Protocol

The SDK and checkout communicate using:

```ts
window.postMessage()
```

The protocol is intentionally small.

## SDK → Checkout

```ts
{
  type: "CHECKOUT_INIT",
  productId: string
}
```

## Checkout → SDK

### Ready

```ts
{
  type: "CHECKOUT_READY"
}
```

### Success

```ts
{
  type: "CHECKOUT_SUCCESS",
  sessionId: string
}
```

### Error

```ts
{
  type: "CHECKOUT_ERROR",
  code: string,
  message: string
}
```

### Close

```ts
{
  type: "CHECKOUT_CLOSE",
  reason: "user" | "success" | "error"
}
```

The SDK validates:

- `event.origin`
- `event.source`
- message type

before handling checkout messages.

For a detailed explanation of the communication protocol and lifecycle, see:

[`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md)

---

# Initialization Handshake

The SDK does not depend on a single initialization message.

After creating the iframe, it starts an initialization handshake:

```text
SDK                         Checkout

 │                             │
 │ CHECKOUT_INIT               │
 ├────────────────────────────►│
 │                             │
 │ CHECKOUT_INIT               │
 ├────────────────────────────►│
 │                             │
 │ CHECKOUT_INIT               │
 ├────────────────────────────►│
 │                             │
 │ CHECKOUT_READY              │
 ◄─────────────────────────────┤
 │                             │
 │ Stop retrying               │
```

This handles the race where the iframe document has loaded but the checkout application's message listener is not ready yet.

The SDK stops retrying once:

```text
CHECKOUT_READY
```

is received.

A timeout protects against a checkout that never becomes ready.

---

# Payment Test Cards

The payment processor is intentionally fake and deterministic.

| Card Number | Result |
|---|---|
| `4242 4242 4242 4242` | Success |
| `4000 0000 0000 0002` | Declined |
| `4000 0000 0000 0341` | Fails once, then succeeds |

Use any future expiry date and a 3–4 digit CVC.

No real payment is performed.

---

# Running Locally

## Requirements

- Node.js
- pnpm

## Install dependencies

From the repository root:

```bash
pnpm install
```

---

## Start the Checkout

```bash
pnpm --filter checkout dev
```

The checkout application runs at:

```text
http://localhost:3000
```

The dev script binds to port **3000** explicitly.

---

## Start the Demo

In another terminal:

```bash
pnpm --filter demo dev
```

The demo application runs at:

```text
http://localhost:3001
```

The dev script binds to port **3001** explicitly.

Open:

```text
http://localhost:3001
```

---

## Start Both Apps

From the repository root:

```bash
pnpm dev
```

This starts checkout on **http://localhost:3000** and demo on **http://localhost:3001** in parallel. Ports are deterministic regardless of startup order.

---

## Checkout Origin Configuration

The SDK loads the hosted checkout from `NEXT_PUBLIC_DODO_CHECKOUT_ORIGIN`.

Local default:

```text
http://localhost:3000
```

No local env file is required for development.

For a deployed demo, set this at **demo build time** (no trailing slash):

```text
NEXT_PUBLIC_DODO_CHECKOUT_ORIGIN=https://<deployed-checkout-origin>
```

Example:

```bash
NEXT_PUBLIC_DODO_CHECKOUT_ORIGIN=https://checkout.example.com pnpm --filter demo build
```

The demo bundles the SDK through Next.js, which inlines `NEXT_PUBLIC_*` variables into the client bundle at build time.

---

## Browser SDK (script tag)

The SDK also ships as a standalone browser bundle:

```text
packages/sdk/dist/dodo-checkout.js
```

After building the SDK, the file is also copied to `apps/demo/public/dodo-checkout.js` for local testing.

```html
<script src="https://YOUR_SDK_HOST/dodo-checkout.js"></script>
<script>
  DodoCheckout.open({
    productId: "prod_123",
    onSuccess(data) { console.log("success", data); },
    onClose(data) { console.log("close", data); },
    onError(data) { console.log("error", data); },
  });
</script>
```

The bundle exposes `window.DodoCheckout` with the same API as the module import.

### Production browser bundle

Build with the real checkout origin (no trailing slash):

```bash
DODO_CHECKOUT_ORIGIN=https://<deployed-checkout-origin> \
BROWSER_BUILD=production \
pnpm --filter @dodo-checkout/sdk build
```

`BROWSER_BUILD=production` fails the build if no origin is provided, preventing accidental localhost in production artifacts.

Local test page: `http://localhost:3001/sdk-browser-test.html`

---

## Deployment (Vercel)

Deploy **checkout first**, then **demo**.

### Checkout (`apps/checkout`)

| Setting | Value |
|---------|-------|
| Root Directory | `apps/checkout` |
| Framework | Next.js |
| Node.js | 24.x |
| Install | `cd ../.. && pnpm install` |
| Build | `cd ../.. && pnpm turbo run build --filter=checkout` |
| Env vars | none |

### Demo (`apps/demo`)

| Setting | Value |
|---------|-------|
| Root Directory | `apps/demo` |
| Framework | Next.js |
| Node.js | 24.x |
| Install | `cd ../.. && pnpm install` |
| Build | `cd ../.. && pnpm turbo run build --filter=demo` |
| Env vars (build time) | `NEXT_PUBLIC_DODO_CHECKOUT_ORIGIN`, `DODO_CHECKOUT_ORIGIN`, `BROWSER_BUILD=production` |

Set both origin variables to the deployed checkout host (e.g. `https://checkout-xyz.vercel.app`) — no `/checkout`, no trailing slash.

---

## Build and Quality Checks

From the repository root:

```bash
pnpm build
pnpm lint
pnpm check-types
```

---

# Testing

## 1. Successful Payment

Open the checkout and use:

```text
4242 4242 4242 4242
```

Expected flow:

```text
Checkout
   ↓
Processing
   ↓
Success
   ↓
Done
   ↓
CHECKOUT_SUCCESS
   ↓
onSuccess()
```

The demo event log should display a successful payment containing a session ID.

---

## 2. Declined Payment

Use:

```text
4000 0000 0000 0002
```

Expected result:

```text
Payment declined
```

The checkout remains open and reports:

```text
CARD_DECLINED
```

The user can modify the card details and try again.

---

## 3. Temporary Failure + Retry

Use:

```text
4000 0000 0000 0341
```

First attempt:

```text
Processing
   ↓
Payment failed
```

Retry:

```text
Processing
   ↓
Success
```

This demonstrates recovery from a temporary payment failure.

---

## 4. Manual Close

Open checkout and close it using the close button.

Expected callback:

```ts
onClose({
  reason: "user",
});
```

The SDK removes the checkout iframe after closing.

---

# Error Handling

The implementation handles several abnormal states.

### Invalid SDK options

If no product ID is provided:

```ts
DodoCheckout.open({
  productId: "",
});
```

the SDK reports:

```text
INVALID_OPTIONS
```

without opening the checkout.

---

### Unknown Product

If the checkout cannot resolve the requested product, it:

1. Displays a product-unavailable error state
2. Sends `CHECKOUT_READY` to complete the SDK handshake
3. Reports `PRODUCT_NOT_FOUND` through `onError`

The checkout remains open so the customer can close it manually. The SDK does not report `CHECKOUT_LOAD_TIMEOUT` for this case.

---

### Checkout Load Failure

If the checkout iframe fails to load:

```text
CHECKOUT_LOAD_FAILED
```

is reported through `onError`.

---

### Checkout Load Timeout

If the checkout does not become ready within the configured timeout:

```text
CHECKOUT_LOAD_TIMEOUT
```

is reported.

---

### Payment Timeout

Payment processing is protected by a timeout.

If processing takes too long:

```text
PAYMENT_TIMEOUT
```

is reported and the customer can retry.

---

# Checkout Lifecycle

The high-level lifecycle is:

```text
DodoCheckout.open()
        │
        ▼
Create iframe
        │
        ▼
Initialization handshake
        │
        ▼
CHECKOUT_INIT
        │
        ▼
Product resolved
        │
        ▼
CHECKOUT_READY
        │
        ▼
Customer enters payment details
        │
        ▼
Payment processing
        │
        ├───────────────┐
        │               │
        ▼               ▼
     Success          Failure
        │               │
        ▼               ▼
 Success screen      Error state
        │               │
        ▼               ▼
       Done            Retry
        │
        ▼
CHECKOUT_SUCCESS
        │
        ▼
SDK cleanup
        │
        ▼
onSuccess()
```

The detailed state machine and failure behavior are documented in:

[`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md)

---

# Key Design Decisions

## 1. Hosted Checkout Inside an iframe

I chose an iframe because the checkout should own the payment experience rather than requiring the merchant application to render payment fields.

The checkout owns:

- Payment inputs
- Validation
- Payment state
- Success UI
- Error UI

The merchant only interacts with the SDK.

### Trade-off

An iframe introduces additional lifecycle and communication complexity.

To handle this, the SDK owns:

- iframe creation
- origin validation
- source validation
- initialization handshake
- timeout handling
- cleanup

---

## 2. Explicit `postMessage` Protocol

The SDK and checkout communicate through a small event protocol:

```text
CHECKOUT_INIT
CHECKOUT_READY
CHECKOUT_SUCCESS
CHECKOUT_ERROR
CHECKOUT_CLOSE
```

This keeps the merchant API independent from the internal checkout implementation.

The checkout can change its internal React components and payment state without requiring merchants to know about those implementation details.

### Trade-off

`postMessage` is a low-level browser API, so incoming messages must be validated.

The SDK checks:

```text
event.origin
event.source
message.type
```

before processing messages.

---

# Security Considerations

The implementation includes basic security boundaries appropriate for the assignment.

### Origin validation

The SDK accepts messages only from the expected checkout origin.

### Source validation

The SDK verifies that messages came from the currently active iframe.

### No wildcard target origin

The checkout communicates with the parent using the origin established during initialization instead of using:

```ts
"*"
```

for message delivery.

### Payment data isolation

The merchant page does not render the checkout's card fields.

For a production implementation, additional controls would be required, including:

- Payment provider tokenization
- CSP
- Appropriate iframe security headers
- Stronger runtime message validation
- Secure payment session handling
- Server-side payment verification
- Webhook verification
- Idempotency

---

# Double-Open Protection

The SDK prevents multiple checkout instances from being opened simultaneously.

```text
Buy
 ↓
Checkout opens
 ↓
Buy again
 ↓
Ignored
```

This prevents accidental creation of multiple checkout overlays.

---

# Cleanup

When checkout completes or closes, the SDK cleans up resources created during the checkout lifecycle.

This includes:

- iframe
- `message` event listener
- initialization retry timer
- load timeout
- stored checkout options

This prevents stale listeners and orphaned checkout iframes.

---

# Assignment Scope

This project is intentionally timeboxed.

The focus is on demonstrating:

- SDK API design
- Hosted checkout architecture
- iframe isolation
- Cross-window communication
- Checkout state management
- Payment error handling
- Retry behavior
- Loading failure handling
- Merchant callbacks
- Basic security boundaries

Payment processing is simulated and no real payment provider is integrated.

The goal is to demonstrate the architecture and engineering decisions rather than build a production payment system.

---

# Known Limitations

This implementation intentionally does not include:

- Real payment processing
- Backend payment sessions
- Payment provider integration
- Persistent orders
- Webhooks
- Authentication
- Production telemetry
- SDK publishing
- Cross-browser certification
- Full accessibility audit

These would be addressed as the system moves toward production.

---

# What I Would Explore Next

If this were moving beyond the assignment, I would prioritize the following.

## 1. Real Payment Provider Integration

Replace the fake payment processor with a real provider using tokenized payment methods or hosted payment fields.

The goal would be to ensure raw card data does not pass through merchant application servers.

---

## 2. Production SDK Distribution

Package the SDK as a standalone browser-consumable package.

For example:

```ts
import { DodoCheckout } from "@dodo-checkout/sdk";
```

The SDK should be independently versioned and distributed from the checkout application.

---

## 3. Production Origin Configuration

The SDK reads `NEXT_PUBLIC_DODO_CHECKOUT_ORIGIN` with a local default of `http://localhost:3000`.

For production, set this when building the demo so the SDK iframe and postMessage origin checks target the deployed checkout host.

---

## 4. Runtime Message Validation

Introduce runtime schema validation for `postMessage` payloads.

This would protect against malformed or unexpected messages in addition to TypeScript's compile-time checks.

---

## 5. Accessibility

Perform automated and manual accessibility testing for:

- Keyboard navigation
- Focus management
- Screen readers
- Form errors
- Loading states
- Success/error announcements

---

## 6. Observability

Add structured telemetry around:

- Checkout initialization
- Checkout load failures
- Payment failures
- Payment completion
- Callback delivery

Sensitive payment information should never be logged.

---

## 7. Browser and Device Testing

Test the checkout across:

- Chrome
- Firefox
- Safari
- Mobile browsers
- Slow networks
- iframe restrictions
- Navigation/reload scenarios

---

# Architecture Documentation

For the detailed technical architecture, see:

[`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md)

It covers:

- System architecture
- Component responsibilities
- iframe lifecycle
- `postMessage` protocol
- Initialization handshake
- Message security
- Checkout state machine
- Payment flow
- Error handling
- Cleanup
- Failure scenarios
- Production evolution

---

# Summary

The core design principle is:

```text
Merchant owns the integration.
Checkout owns the payment experience.
SDK owns the boundary between them.
```

The SDK keeps the merchant-facing API small while the hosted checkout owns the payment UI and state.

The implementation prioritizes:

- Clear ownership
- Explicit communication
- Predictable callbacks
- Origin validation
- Failure handling
- Retry behavior
- Resource cleanup

while intentionally keeping the implementation small enough to review within the assignment's timeboxed scope.