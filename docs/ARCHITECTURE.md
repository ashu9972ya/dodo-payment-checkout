# Dodo Checkout — Architecture

## 1. Overview

Dodo Checkout is designed around a simple separation of responsibilities:

```text
┌──────────────────────────┐
│     Merchant / Demo      │
│                          │
│  DodoCheckout.open(...)  │
└────────────┬─────────────┘
             │
             │ SDK
             ▼
┌──────────────────────────┐
│      Checkout SDK        │
│                          │
│  • iframe lifecycle      │
│  • initialization        │
│  • postMessage            │
│  • validation            │
│  • callbacks             │
│  • cleanup               │
└────────────┬─────────────┘
             │
             │ iframe
             ▼
┌──────────────────────────┐
│     Hosted Checkout      │
│                          │
│  • product               │
│  • customer information  │
│  • payment form          │
│  • validation            │
│  • payment state         │
│  • success/error UI      │
└──────────────────────────┘
```

The core design principle is:

> **Merchant owns the integration. Checkout owns the payment experience. SDK owns the boundary between them.**

This keeps the merchant-facing API small while allowing the checkout application to own its internal UI and payment lifecycle.

---

# 2. Repository Architecture

The repository is organized as a small monorepo:

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

## Responsibilities

### `apps/demo`

Acts as the merchant application.

It:

- displays the product
- provides the Buy button
- initializes the SDK
- receives SDK callbacks
- displays checkout events

It does **not** own the checkout payment form.

---

### `apps/checkout`

Acts as the separately hosted checkout application.

It owns:

- product rendering
- email input
- card number
- expiry
- CVC
- validation
- payment processing state
- success state
- declined state
- failed state
- retry behavior

---

### `packages/sdk`

Contains the plain TypeScript SDK.

It owns:

- checkout iframe creation
- iframe lifecycle
- initialization handshake
- cross-window communication
- message validation
- merchant callbacks
- timeout handling
- cleanup

---

# 3. High-Level Request Flow

A normal checkout flow looks like:

```text
Merchant
   │
   │ DodoCheckout.open({
   │   productId,
   │   callbacks
   │ })
   │
   ▼
SDK
   │
   │ Create iframe
   ▼
Checkout
   │
   │ Resolve product
   │
   │ Render payment form
   ▼
Customer
   │
   │ Enter payment details
   ▼
Checkout
   │
   │ Process fake payment
   ▼
Payment result
   │
   ├───────────────┬────────────────┐
   │               │                │
   ▼               ▼                ▼
Success         Declined          Failed
   │               │                │
   ▼               │                ▼
Success UI         │              Retry
   │               │                │
   ▼               │                │
Done               │                │
   │               │                │
   └───────────────┴────────────────┘
                   │
                   ▼
             SDK callback
```

---

# 4. Why an iframe?

The checkout is intentionally rendered inside an iframe.

Without an iframe, the architecture could look like:

```text
Merchant Application
        │
        ├── Card input
        ├── Expiry input
        ├── CVC input
        └── Payment logic
```

That would make the merchant application directly responsible for payment UI and payment-related state.

Instead:

```text
Merchant Application
        │
        │ SDK
        ▼
     iframe
        │
        ▼
Hosted Checkout
        │
        ├── Card input
        ├── Expiry input
        ├── CVC input
        └── Payment logic
```

The merchant application therefore interacts with a small integration API rather than directly owning the payment form.

## Important security distinction

The iframe provides an isolation boundary between the merchant page and the checkout document.

However, an iframe by itself does not make a payment integration production-secure.

A production implementation would additionally require appropriate payment-provider tokenization or hosted payment fields, secure payment-session handling, CSP/security headers, server-side verification, and other payment-specific controls.

For this assignment, payment processing is intentionally simulated.

---

# 5. SDK API

The merchant-facing API is intentionally small:

```ts
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

The merchant does not need to know:

- how the iframe is created
- how checkout initialization works
- how payment state is represented
- how messages are transmitted
- how cleanup is performed

Those are SDK/checkout implementation details.

---

# 6. iframe Lifecycle

When `DodoCheckout.open()` is called, the SDK performs the following:

```text
DodoCheckout.open()
        │
        ▼
Validate options
        │
        ▼
Create iframe
        │
        ▼
Attach iframe to document
        │
        ▼
Register message listener
        │
        ▼
Start initialization handshake
        │
        ▼
Wait for CHECKOUT_READY
        │
        ▼
Checkout becomes interactive
```

The SDK also prevents opening another checkout while one is already active.

Conceptually:

```ts
if (this.iframe) {
  return;
}
```

This prevents multiple checkout overlays from being created accidentally.

---

# 7. Initialization Handshake

A single `postMessage` call can theoretically race with the checkout application's initialization.

For example:

```text
SDK                         Checkout

 │                             │
 │ iframe loads                │
 │                             │
 │ CHECKOUT_INIT               │
 ├────────────────────────────►│
 │                             │
 │                             │ listener not ready
 │                             │
 │                             │
 │ CHECKOUT_INIT               │
 ├────────────────────────────►│
 │                             │
 │ CHECKOUT_READY              │
 ◄─────────────────────────────┤
 │                             │
 ▼                             │
Stop retrying                  │
```

The SDK therefore retries the initialization message until the checkout responds with:

```ts
{
  type: "CHECKOUT_READY"
}
```

Once `CHECKOUT_READY` is received:

```text
Initialization retry timer
          │
          ▼
       stopped
```

The SDK also has a checkout-load timeout so a checkout that never becomes ready does not remain indefinitely open.

---

# 8. Cross-Window Communication

The SDK and checkout communicate using the browser's:

```ts
window.postMessage()
```

API.

This is necessary because the checkout is designed as a separately hosted application and may run on a different origin from the merchant.

The protocol is intentionally small.

---

## 8.1 SDK → Checkout

Initialization:

```ts
{
  type: "CHECKOUT_INIT",
  productId: string
}
```

The SDK sends the product ID to the checkout.

The checkout then resolves the corresponding product.

---

## 8.2 Checkout → SDK

### Ready

```ts
{
  type: "CHECKOUT_READY"
}
```

Indicates that checkout initialization completed successfully.

---

### Success

```ts
{
  type: "CHECKOUT_SUCCESS",
  sessionId: string
}
```

Indicates that the customer completed the successful checkout flow.

---

### Error

```ts
{
  type: "CHECKOUT_ERROR",
  code: string,
  message: string
}
```

Represents checkout or payment errors.

---

### Close

```ts
{
  type: "CHECKOUT_CLOSE",
  reason: "user" | "success" | "error"
}
```

Represents checkout closure.

The current implementation uses:

```text
reason = "user"
```

for manual customer closure.

Successful checkout completion is reported through `CHECKOUT_SUCCESS` and the SDK's `onSuccess` callback.

---

# 9. Message Security

Messages received through `postMessage` must not automatically be trusted.

The SDK validates the message origin:

```ts
if (event.origin !== CHECKOUT_ORIGIN) {
  return;
}
```

It also validates that the message originated from the currently active checkout iframe:

```ts
if (event.source !== this.iframe?.contentWindow) {
  return;
}
```

The effective trust boundary is:

```text
Incoming message
       │
       ▼
Is origin expected?
       │
       ├── No ──► Ignore
       │
       ▼
Is source the active iframe?
       │
       ├── No ──► Ignore
       │
       ▼
Is message valid?
       │
       ├── No ──► Ignore
       │
       ▼
Handle event
```

The SDK therefore does not simply accept any window message.

---

# 10. Parent Origin Handling

The checkout needs to know where it should send events.

Instead of sending messages to:

```ts
"*"
```

the checkout records the origin of the initialization message:

```text
SDK
 │
 │ CHECKOUT_INIT
 │
 │ event.origin
 ▼
Checkout
 │
 │ store parent origin
 ▼
postMessage(..., parentOrigin)
```

The checkout can then use that origin when sending messages back to the merchant.

This keeps message delivery scoped to the established parent origin rather than using a wildcard target.

---

# 11. Checkout State Machine

The checkout uses explicit payment states:

```text
                 ┌──────────────┐
                 │     idle     │
                 └──────┬───────┘
                        │
                        │ Submit
                        ▼
                 ┌──────────────┐
                 │  processing  │
                 └──────┬───────┘
                        │
          ┌─────────────┼──────────────┐
          │             │              │
          ▼             ▼              ▼
      success       declined        failed
          │             │              │
          ▼             │              ▼
   Success screen       │            Retry
          │             │              │
          ▼             │              │
         Done            │              │
          │              │              │
          ▼              │              │
 CHECKOUT_SUCCESS       │              │
                         │              │
                         └──────┬───────┘
                                │
                                ▼
                              Retry
                                │
                                ▼
                           processing
```

The explicit state model prevents different payment outcomes from being represented through unrelated boolean flags.

---

# 12. Payment Processing

The assignment uses a deterministic fake payment processor.

The processor waits briefly to simulate asynchronous payment processing and then determines the result from the card number.

## Successful card

```text
4242 4242 4242 4242
```

Result:

```text
success
```

A session ID is generated for the successful payment.

---

## Declined card

```text
4000 0000 0000 0002
```

Result:

```text
declined
```

The checkout remains open so the customer can correct the payment information and retry.

---

## Fail-once card

```text
4000 0000 0000 0341
```

First attempt:

```text
failed
```

Second attempt:

```text
success
```

This demonstrates recovery from a temporary payment failure.

---

# 13. Successful Checkout Lifecycle

A successful payment does not immediately remove the checkout.

The flow is:

```text
Payment succeeds
       │
       ▼
Success screen
       │
       ▼
Display session ID
       │
       ▼
Customer clicks Done
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

This gives the customer a clear confirmation state before the checkout disappears.

It also keeps the distinction between:

```text
Payment succeeded
```

and:

```text
Checkout lifecycle completed
```

explicit.

---

# 14. Declined Payment Lifecycle

For the decline test card:

```text
4000 0000 0000 0002
```

the flow is:

```text
Submit
  │
  ▼
Processing
  │
  ▼
Declined
  │
  ▼
Display error
  │
  ▼
Checkout remains open
  │
  ▼
Customer can retry
```

The checkout reports:

```ts
{
  type: "CHECKOUT_ERROR",
  code: "CARD_DECLINED",
  message: "Your bank declined this payment."
}
```

The SDK forwards this through:

```ts
onError({
  code,
  message,
});
```

---

# 15. Temporary Failure Lifecycle

For:

```text
4000 0000 0000 0341
```

the first attempt intentionally fails.

```text
First attempt
     │
     ▼
Payment failed
     │
     ▼
Display retry state
     │
     ▼
Customer retries
     │
     ▼
Payment succeeds
     │
     ▼
Success screen
```

The checkout therefore distinguishes between:

```text
Permanent-looking decline
```

and:

```text
Recoverable processing failure
```

---

# 16. Timeout Handling

There are two important timeout boundaries.

## Checkout initialization timeout

The SDK waits for:

```text
CHECKOUT_READY
```

If the checkout never becomes ready within the configured timeout:

```text
CHECKOUT_LOAD_TIMEOUT
```

is reported.

---

## Payment timeout

Payment processing is also protected by a timeout.

Conceptually:

```text
Payment request
      │
      ├──────────────► Payment result
      │
      │
      └──────────────► Timeout
```

If the timeout wins:

```text
PAYMENT_TIMEOUT
```

is reported.

The customer can then retry.

---

# 17. Error Categories

Errors can originate from different layers.

## SDK errors

Examples:

```text
INVALID_OPTIONS
CHECKOUT_LOAD_FAILED
CHECKOUT_LOAD_TIMEOUT
```

These relate to SDK or checkout lifecycle problems.

---

## Payment errors

Examples:

```text
CARD_DECLINED
PAYMENT_FAILED
PAYMENT_TIMEOUT
```

These relate to payment processing.

The SDK exposes a common callback shape:

```ts
onError({
  code,
  message,
});
```

This keeps the merchant API simple even though errors originate from different parts of the system.

---

# 18. Manual Close

When the customer manually closes checkout:

```text
Customer
   │
   │ Close
   ▼
Checkout
   │
   │ CHECKOUT_CLOSE
   ▼
SDK
   │
   ├── Remove iframe
   ├── Remove listener
   ├── Clear timers
   └── Clear state
   │
   ▼
onClose({
  reason: "user"
})
```

The SDK owns the cleanup rather than requiring the merchant to manage iframe resources.

---

# 19. SDK Cleanup

Cleanup is an important part of the SDK lifecycle.

When checkout completes or closes, the SDK removes:

```text
iframe
message listener
initialization retry timer
load timeout
stored checkout options
```

The lifecycle becomes:

```text
open
 │
 ▼
resources created
 │
 ▼
checkout running
 │
 ▼
success / close / fatal error
 │
 ▼
cleanup
 │
 ▼
resources released
```

This reduces the risk of:

- stale message listeners
- orphaned iframes
- timers continuing after checkout
- stale checkout state
- duplicate callbacks

---

# 20. Double-Open Protection

The SDK prevents another checkout from being opened while one is already active.

```text
DodoCheckout.open()
       │
       ▼
iframe exists?
   │       │
  yes      no
   │       │
   ▼       ▼
 ignore   create
```

This avoids situations such as:

```text
Buy
 ↓
Checkout A
 ↓
Buy again
 ↓
Checkout B
```

and keeps the integration deterministic.

---

# 21. Product Resolution

The merchant only provides:

```ts
productId: "prod_123"
```

The checkout resolves the product internally.

Conceptually:

```text
Merchant
   │
   │ productId
   ▼
Checkout
   │
   │ getProduct(productId)
   ▼
Product
   │
   ├── name
   ├── description
   └── price
```

If the product cannot be resolved, the checkout displays an appropriate error state, sends `CHECKOUT_READY` to stop the SDK handshake timer, and reports `PRODUCT_NOT_FOUND` to the host through `CHECKOUT_ERROR`.

---

# 22. Sensitive Data Boundary

The merchant-facing SDK does not expose payment input values.

The flow is:

```text
Merchant
   │
   │ productId + callbacks
   ▼
SDK
   │
   │ iframe
   ▼
Checkout
   │
   ├── card number
   ├── expiry
   └── CVC
```

The checkout handles those values internally.

The merchant receives high-level events:

```text
success
error
close
```

rather than the payment fields themselves.

Again, because this assignment uses fake payments, this should not be interpreted as a complete production payment-security architecture.

---

# 23. Failure Scenarios

The implementation considers several abnormal conditions.

| Scenario | Handling |
|---|---|
| Missing `productId` | SDK validation |
| Unknown product | Error UI + `CHECKOUT_READY` + `PRODUCT_NOT_FOUND` |
| iframe load failure | `CHECKOUT_LOAD_FAILED` |
| Checkout never becomes ready | `CHECKOUT_LOAD_TIMEOUT` |
| Payment takes too long | `PAYMENT_TIMEOUT` |
| Card declined | Error state + retry |
| Temporary payment failure | Retry |
| User closes checkout | `CHECKOUT_CLOSE` |
| Successful payment | Success screen → `CHECKOUT_SUCCESS` |
| Multiple opens | Existing checkout remains active |

---

# 24. Security Model

The security model for this assignment is based on clear boundaries.

```text
┌─────────────────────┐
│ Merchant            │
│                     │
│ No payment fields   │
└──────────┬──────────┘
           │
           │ SDK API
           ▼
┌─────────────────────┐
│ SDK                 │
│                     │
│ Origin validation   │
│ Source validation   │
│ Lifecycle control   │
└──────────┬──────────┘
           │
           │ iframe
           ▼
┌─────────────────────┐
│ Hosted Checkout     │
│                     │
│ Payment fields      │
│ Payment state       │
└─────────────────────┘
```

The important controls implemented here are:

### Expected checkout origin

Messages from unexpected origins are ignored.

### Expected iframe source

Messages must originate from the active checkout iframe.

### Explicit protocol

Only known checkout message types are processed.

### No wildcard target origin

The checkout sends messages to the established parent origin.

---

# 25. Trade-offs

## iframe

### Benefits

- Clear checkout ownership
- Isolation from merchant DOM
- Merchant integration remains small
- Checkout can evolve independently
- Payment UI is not coupled to merchant UI

### Costs

- Cross-window communication
- Origin management
- Additional loading lifecycle
- Responsive behavior
- Browser/iframe edge cases

For this assignment, the isolation benefits outweigh the added complexity.

---

## `postMessage`

### Benefits

- Native browser API
- Supports cross-origin communication
- Simple event-based protocol
- No additional communication dependency

### Costs

- Messages require validation
- Protocol must be maintained
- Runtime payloads need validation
- Origin handling is security-sensitive

---

## Fake Payment Processor

### Benefits

- Deterministic
- No external dependencies
- Easy to test
- Covers required payment states

### Costs

- Not real payment infrastructure
- No authorization
- No tokenization
- No persistence
- No webhooks

This is appropriate for the timeboxed assignment.

---

# 26. Why the SDK Owns the iframe

An alternative design would expose the iframe directly to the merchant.

For example:

```ts
const iframe = createCheckoutIframe();
```

I chose not to do that.

Instead:

```ts
DodoCheckout.open(...)
```

hides the implementation details.

The merchant does not need to know:

- iframe URL
- iframe DOM management
- message listener setup
- initialization retries
- cleanup
- timeout handling

This produces a smaller and more ergonomic integration surface.

---

# 27. Why Use Explicit Events?

The checkout could theoretically expose a generic event:

```ts
{
  type: "EVENT",
  data: ...
}
```

Instead, the implementation uses explicit events:

```text
CHECKOUT_READY
CHECKOUT_SUCCESS
CHECKOUT_ERROR
CHECKOUT_CLOSE
```

This makes the protocol easier to reason about and gives each event a clear semantic meaning.

It also makes the SDK event handling easier to type.

---

# 28. Production Architecture Evolution

The current system intentionally stops at a fake payment processor.

A production architecture could evolve into:

```text
Merchant
   │
   ▼
Checkout SDK
   │
   ▼
Hosted Checkout
   │
   ▼
Payment Provider
   │
   ▼
Backend
   │
   ├── Payment session
   ├── Order
   ├── Idempotency
   ├── Webhook processing
   └── Reconciliation
```

A production implementation would need additional concerns.

---

## Payment Sessions

Create a server-side payment session rather than relying on client-side payment state.

```text
Merchant
   │
   ▼
Backend
   │
   ▼
Payment session
   │
   ▼
Checkout
```

---

## Payment Provider

Integrate a real payment provider using tokenized or provider-hosted payment collection.

The goal would be:

```text
Card details
     │
     ▼
Payment provider
     │
     ▼
Token / payment method
     │
     ▼
Merchant backend
```

rather than passing raw card details through merchant infrastructure.

---

## Webhooks

The backend should rely on verified provider webhooks for authoritative payment state.

```text
Payment Provider
       │
       │ webhook
       ▼
Merchant Backend
       │
       ▼
Update payment/order
```

The browser callback should not be treated as the sole source of truth for successful payment.

---

## Idempotency

Production payment operations should support idempotency to prevent duplicate charges caused by:

- retries
- network failures
- browser refreshes
- duplicate submissions

---

## Payment Session Expiry

Checkout sessions should have an explicit expiration mechanism.

For example:

```text
Created
   │
   ├── Payment completed
   │
   ├── Cancelled
   │
   └── Expired
```

---

# 29. Production Security Considerations

A production implementation should additionally evaluate:

### Content Security Policy

Restrict which scripts, frames, connections, and resources are allowed.

### Frame security

Use appropriate iframe and browser security headers.

### Origin configuration

The SDK reads `NEXT_PUBLIC_DODO_CHECKOUT_ORIGIN` with a local default of `http://localhost:3000`. Set this at demo build time for deployed environments.

### Runtime validation

Validate all cross-window messages at runtime.

### Server-side verification

Never rely solely on client-side success callbacks for payment confirmation.

### Webhook verification

Verify provider signatures before accepting payment status updates.

### Sensitive logging

Never log:

- full card numbers
- CVC
- payment secrets
- authentication credentials

### Session security

Use short-lived, scoped payment sessions.

---

# 30. Observability

A production version should provide structured telemetry around important lifecycle events.

Potential events:

```text
checkout_opened
checkout_ready
checkout_load_failed
checkout_load_timeout
payment_started
payment_failed
payment_declined
payment_succeeded
checkout_closed
```

Telemetry should help answer:

- How often does checkout fail to load?
- How often do payments fail?
- Where do users abandon checkout?
- How long does checkout initialization take?
- How long does payment processing take?

Sensitive payment information should never be included in telemetry.

---

# 31. Accessibility

The checkout should be independently accessible because it owns the payment experience.

Important areas include:

- Keyboard navigation
- Focus management
- Visible focus indicators
- Form labels
- Validation messages
- Error announcements
- Screen reader support
- Loading state announcements
- Success state announcements

The iframe boundary does not remove the responsibility to make the checkout accessible.

---

# 32. Browser and Network Resilience

A production checkout should be tested under:

- slow network conditions
- intermittent connectivity
- browser refresh
- browser back/forward navigation
- iframe restrictions
- mobile viewport sizes
- Safari
- Firefox
- Chrome
- mobile browsers

The current implementation addresses the most relevant assignment-level cases through initialization and payment timeouts.

---

# 33. Testing Strategy

The current implementation can be tested through deterministic payment scenarios.

### Happy path

```text
4242 4242 4242 4242
```

Expected:

```text
success → Done → onSuccess
```

### Decline path

```text
4000 0000 0000 0002
```

Expected:

```text
declined → error state → retry possible
```

### Recoverable failure

```text
4000 0000 0000 0341
```

Expected:

```text
first attempt → failed
second attempt → success
```

### Close path

```text
Open checkout → Close
```

Expected:

```text
CHECKOUT_CLOSE → cleanup → onClose
```

### Loading failure

Expected:

```text
iframe failure → CHECKOUT_LOAD_FAILED
```

### Loading timeout

Expected:

```text
no CHECKOUT_READY → CHECKOUT_LOAD_TIMEOUT
```

### Payment timeout

Expected:

```text
slow payment → PAYMENT_TIMEOUT → retry
```

---

# 34. Current Scope

This architecture is intentionally limited to the requirements of the assignment.

Included:

- TypeScript SDK
- Hosted checkout
- iframe integration
- Cross-window messaging
- Checkout initialization handshake
- Payment states
- Fake payment processor
- Error handling
- Retry flow
- Success flow
- Merchant callbacks
- Basic message security
- Resource cleanup

Not included:

- Real payment provider
- Backend
- Persistent database
- Authentication
- Webhooks
- Production payment sessions
- SDK package publishing
- Production observability
- Full accessibility audit
- Full browser compatibility testing

---

# 35. Future Exploration

If the implementation were continued beyond the assignment, I would prioritize:

1. Real payment-provider integration
2. Secure payment sessions
3. Server-side payment verification
4. Webhook handling
5. Idempotency
6. Production SDK distribution
7. Configurable checkout origin
8. Runtime message schema validation
9. Accessibility audit
10. Observability
11. Cross-browser testing
12. Mobile checkout optimization

The goal would be to preserve the simple merchant API while progressively strengthening the underlying payment and infrastructure layers.

---

# 36. Architectural Summary

The architecture can be summarized as:

```text
                    Merchant
                       │
                       │
                       ▼
              ┌────────────────┐
              │   SDK API       │
              │                 │
              │ open()          │
              │ callbacks       │
              └───────┬────────┘
                      │
                      │ creates
                      ▼
              ┌────────────────┐
              │     iframe      │
              └───────┬────────┘
                      │
                      ▼
              ┌────────────────┐
              │ Hosted Checkout│
              │                │
              │ Product        │
              │ Payment Form   │
              │ Validation     │
              │ Payment State  │
              └───────┬────────┘
                      │
                      │ postMessage
                      ▼
              ┌────────────────┐
              │      SDK       │
              │                │
              │ origin check   │
              │ source check   │
              │ event handling │
              │ cleanup        │
              └───────┬────────┘
                      │
                      ▼
                  Merchant
```

The key architectural boundary is:

```text
Merchant
   │
   │ Small public API
   ▼
SDK
   │
   │ iframe + postMessage
   ▼
Hosted Checkout
```

This keeps the integration surface small, gives the checkout ownership of the payment experience, and provides explicit lifecycle and communication boundaries.

For the scope of this assignment, the architecture intentionally favors **clarity, isolation, predictable behavior, and a small implementation surface** over production-scale infrastructure.