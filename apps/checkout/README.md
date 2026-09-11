# Checkout App

Hosted checkout application for the Dodo Checkout assignment.

## Run locally

From the repository root:

```bash
pnpm --filter checkout dev
```

Runs at [http://localhost:3000](http://localhost:3000).

The checkout UI is at `/checkout`.

## Responsibilities

- Product display
- Email and card form
- Fake payment processing
- Success, decline, and error states
- `postMessage` communication with the embedding SDK

See the root [README](../../README.md) and [docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md) for full documentation.
