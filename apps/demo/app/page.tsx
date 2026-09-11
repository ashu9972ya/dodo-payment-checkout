"use client";

import { DodoCheckout } from "@dodo-checkout/sdk";
import { useState } from "react";

type CheckoutLog = {
  id: number;
  type: "success" | "close" | "error";
  message: string;
  timestamp: string;
};

export default function Home() {
  const [logs, setLogs] = useState<CheckoutLog[]>([]);

  const addLog = (
    type: CheckoutLog["type"],
    message: string
  ) => {
    setLogs((currentLogs) => [
      {
        id: Date.now(),
        type,
        message,
        timestamp: new Date().toLocaleTimeString(),
      },
      ...currentLogs,
    ]);
  };

  const openCheckout = () => {
    DodoCheckout.open({
      productId: "prod_123",

      onSuccess: ({ sessionId }) => {
        addLog(
          "success",
          `Payment successful · ${sessionId}`
        );
      },

      onClose: ({ reason }) => {
        addLog(
          "close",
          `Checkout closed · ${reason}`
        );
      },

      onError: ({ code, message }) => {
        addLog(
          "error",
          `${code} · ${message}`
        );
      },
    });
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-12 sm:px-6">
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center">
        {/* Header */}
        <header className="text-center">
          <div className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 shadow-sm">
            Dodo Checkout SDK
          </div>

          <h1 className="mt-5 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
            Embeddable checkout demo
          </h1>

          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-500 sm:text-base">
            A lightweight TypeScript checkout SDK embedded with an iframe.
            Payment details stay inside the checkout and never touch the host
            page.
          </p>
        </header>

        {/* Product */}
        <section
          aria-labelledby="product-title"
          className="mt-10 w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <div className="flex items-start justify-between gap-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Test product
              </p>

              <h2
                id="product-title"
                className="mt-2 text-lg font-semibold text-slate-900"
              >
                Pro Plan
              </h2>

              <p className="mt-1 text-sm leading-6 text-slate-500">
                Full access to the Pro experience.
              </p>
            </div>

            <p className="shrink-0 text-lg font-semibold text-slate-900">
              ₹999
            </p>
          </div>

          <button
            type="button"
            onClick={openCheckout}
            className="mt-6 w-full rounded-xl bg-slate-900 px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2 active:scale-[0.99]"
          >
            Buy now
          </button>
        </section>

        {/* Test cards */}
        <section className="mt-6 w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Test cards
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              Use these cards to test each checkout state.
            </p>
          </div>

          <div className="mt-4 space-y-3">
            <TestCard
              number="4242 4242 4242 4242"
              description="Payment succeeds"
            />

            <TestCard
              number="4000 0000 0000 0002"
              description="Payment is declined"
            />

            <TestCard
              number="4000 0000 0000 0341"
              description="Fails once, then succeeds"
            />
          </div>

          <p className="mt-4 text-xs text-slate-400">
            Use any future expiry date and a 3–4 digit CVC.
          </p>
        </section>

        {/* Event log */}
        <section
          aria-labelledby="events-title"
          className="mt-8 w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2
                id="events-title"
                className="text-base font-semibold text-slate-900"
              >
                Checkout events
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                SDK callbacks received from the checkout.
              </p>
            </div>

            {logs.length > 0 && (
              <button
                type="button"
                onClick={() => setLogs([])}
                className="shrink-0 rounded-lg px-2 py-1 text-sm font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2"
              >
                Clear
              </button>
            )}
          </div>

          <div className="mt-5">
            {logs.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 px-4 py-10 text-center">
                <p className="text-sm font-medium text-slate-500">
                  Waiting for checkout activity
                </p>

                <p className="mt-1 text-xs text-slate-400">
                  Events from the SDK will appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {logs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-start justify-between gap-4 rounded-xl bg-slate-50 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          aria-hidden="true"
                          className={`h-2 w-2 shrink-0 rounded-full ${
                            log.type === "success"
                              ? "bg-emerald-500"
                              : log.type === "error"
                                ? "bg-red-500"
                                : "bg-slate-400"
                          }`}
                        />

                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                          {log.type}
                        </span>
                      </div>

                      <p className="mt-1 break-words text-sm text-slate-700">
                        {log.message}
                      </p>
                    </div>

                    <time className="shrink-0 text-xs text-slate-400">
                      {log.timestamp}
                    </time>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Footer */}
        <p className="mt-8 text-center text-xs text-slate-400">
          Demo environment · Fake payments only
        </p>
      </div>
    </main>
  );
}

function TestCard({
  number,
  description,
}: {
  number: string;
  description: string;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <code className="text-xs font-medium text-slate-700">
        {number}
      </code>

      <span className="text-xs text-slate-400">
        {description}
      </span>
    </div>
  );
}