"use client";

import { CheckoutLoading } from "@/app/checkout/components/CheckoutLoading";
import { PaymentError } from "@/app/checkout/components/PaymentError";
import { SuccessScreen } from "@/app/checkout/components/SuccessScreen";
import { processPayment } from "@/lib/payment";
import { getProduct, Product } from "@/lib/products";
import { FormEvent, useEffect, useRef, useState } from "react";

type CheckoutMessage =
    | {
        type: "CHECKOUT_INIT";
        productId: string;
    };

type PaymentState =
    | "idle"
    | "processing"
    | "success"
    | "declined"
    | "failed";

const PAYMENT_TIMEOUT = 10_000;

const checkoutScrimCentered =
    "flex min-h-screen items-center justify-center bg-slate-950/60 p-4 sm:p-6 font-sans antialiased";
const checkoutScrim =
    "min-h-screen bg-slate-950/60 p-4 sm:p-6 font-sans antialiased";
const checkoutCard =
    "w-full max-w-[460px] overflow-hidden rounded-[18px] border border-slate-200/80 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.08)]";
const checkoutCardBody = `${checkoutCard} p-8 sm:p-9`;
const fieldLabel = "text-sm font-medium text-slate-700";
const fieldInput =
    "h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10";
const primaryButton =
    "inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60";

export default function CheckoutPage() {
    const [product, setProduct] = useState<Product | null>(null);
    const [paymentState, setPaymentState] =
        useState<PaymentState>("idle");

    const [sessionId, setSessionId] =
        useState<string | null>(null);
    const parentOriginRef = useRef<string | null>(null);

    const [email, setEmail] = useState("");
    const [cardNumber, setCardNumber] = useState("");
    const [expiry, setExpiry] = useState("");
    const [cvc, setCvc] = useState("");

    const [errorMessage, setErrorMessage] = useState("");

    const [isInitialized, setIsInitialized] = useState<boolean>(false);

    useEffect(() => {
        const handleMessage = (
            event: MessageEvent<CheckoutMessage>
        ) => {
            if (event.source !== window.parent) {
                return;
            }

            const message = event.data;

            if (!message || typeof message !== "object") {
                return;
            }

            if (message.type !== "CHECKOUT_INIT") {
                return;
            }

            const selectedProduct = getProduct(message.productId);

            if (!selectedProduct) {
                parentOriginRef.current = event.origin;

                setErrorMessage("We couldn't load this product.");
                setIsInitialized(true);

                window.parent.postMessage(
                    { type: "CHECKOUT_READY" },
                    event.origin
                );

                window.parent.postMessage(
                    {
                        type: "CHECKOUT_ERROR",
                        code: "PRODUCT_NOT_FOUND",
                        message: "We couldn't load this product.",
                    },
                    event.origin
                );

                return;
            }

            parentOriginRef.current = event.origin;

            setProduct(selectedProduct);
            setIsInitialized(true);

            window.parent.postMessage(
                {
                    type: "CHECKOUT_READY",
                },
                event.origin
            );
        };

        window.addEventListener("message", handleMessage);

        return () => {
            window.removeEventListener("message", handleMessage);
        };
    }, []);

    function postToParent(message: unknown) {
        const parentOrigin = parentOriginRef.current;

        if (!parentOrigin) {
            console.warn(
                "Checkout cannot communicate with parent: parent origin is not established."
            );
            return;
        }

        window.parent.postMessage(
            message,
            parentOrigin
        );
    }

    function closeCheckout() {
        postToParent({
            type: "CHECKOUT_CLOSE",
            reason: "user",
        });
    }

    async function handleSubmit(
        event: FormEvent<HTMLFormElement>
    ) {
        event.preventDefault();

        if (paymentState === "processing") {
            return;
        }

        setErrorMessage("");

        if (!email.trim()) {
            setErrorMessage("Please enter your email address.");
            return;
        }

        if (!email.includes("@")) {
            setErrorMessage("Please enter a valid email address.");
            return;
        }

        const normalizedCard = cardNumber.replace(/\s/g, "");

        if (normalizedCard.length !== 16) {
            setErrorMessage("Please enter a valid 16-digit card number.");
            return;
        }

        if (!/^\d{2}\s*\/\s*\d{2}$/.test(expiry)) {
            setErrorMessage("Please enter a valid card expiry.");
            return;
        }

        if (!/^\d{3,4}$/.test(cvc)) {
            setErrorMessage("Please enter a valid CVC.");
            return;
        }

        setPaymentState("processing");

        try {
            const paymentPromise = processPayment(cardNumber);

            const timeoutPromise = new Promise<never>((_, reject) => {
                setTimeout(() => {
                    reject(new Error("PAYMENT_TIMEOUT"));
                }, PAYMENT_TIMEOUT);
            });

            const result = await Promise.race([
                paymentPromise,
                timeoutPromise,
            ]);

            if (result.status === "success") {
                setSessionId(result.sessionId);
                setPaymentState("success");

                return;
            }

            if (result.status === "declined") {
                setPaymentState("declined");
                setErrorMessage(result.message);

                postToParent({
                    type: "CHECKOUT_ERROR",
                    code: result.code,
                    message: result.message,
                });

                return;
            }

            if (result.status === "failed") {
                setPaymentState("failed");
                setErrorMessage(result.message);

                postToParent({
                    type: "CHECKOUT_ERROR",
                    code: result.code,
                    message: result.message,
                });

                return;
            }
        } catch (error) {
            if (
                error instanceof Error &&
                error.message === "PAYMENT_TIMEOUT"
            ) {
                const message =
                    "The payment is taking longer than expected. Please try again.";

                setPaymentState("failed");
                setErrorMessage(message);

                postToParent({
                    type: "CHECKOUT_ERROR",
                    code: "PAYMENT_TIMEOUT",
                    message,
                });

                return;
            }

            const message =
                "We couldn't complete your payment. Please try again.";

            setPaymentState("failed");
            setErrorMessage(message);

            postToParent({
                type: "CHECKOUT_ERROR",
                code: "PAYMENT_FAILED",
                message,
            });
        }
    }

    if (!isInitialized) {
        return <CheckoutLoading />;
    }

    if (!product) {
        return (
            <main className={checkoutScrimCentered}>
                <div className={checkoutCardBody}>
                    <div
                        className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-500"
                        aria-hidden
                    >
                        !
                    </div>

                    <h1 className="mt-5 text-xl font-semibold tracking-tight text-slate-900">
                        Product unavailable
                    </h1>

                    <p className="mt-2 text-sm leading-relaxed text-slate-500">
                        {"We couldn't load this product."}
                    </p>

                    <button
                        type="button"
                        onClick={closeCheckout}
                        disabled={paymentState === "processing"}
                        className={`${primaryButton} mt-8`}
                    >
                        Close
                    </button>
                </div>
            </main>
        );
    }

    if (paymentState === "success") {
        if (!sessionId) {
            return (
                <main className={checkoutScrimCentered}>
                    <section
                        role="alert"
                        className={`${checkoutCardBody} text-center`}
                    >
                        <h1 className="text-xl font-semibold tracking-tight text-slate-900">
                            Something went wrong
                        </h1>

                        <p className="mt-2 text-sm leading-relaxed text-slate-500">
                            {"Your payment completed, but we couldn't retrieve the payment session."}
                        </p>

                        <button
                            type="button"
                            onClick={closeCheckout}
                            className={`${primaryButton} mt-8`}
                        >
                            Close
                        </button>
                    </section>
                </main>
            );
        }

        return (
            <SuccessScreen
                product={product}
                sessionId={sessionId}
                onDone={() => {
                    postToParent({
                        type: "CHECKOUT_SUCCESS",
                        sessionId,
                    });
                }}
            />
        );
    }

    return (
        <main className={checkoutScrim}>
            <div className="flex min-h-[calc(100vh-2rem)] items-center justify-center sm:min-h-[calc(100vh-3rem)]">
                <section
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="checkout-title"
                    className={checkoutCard}
                >
                    <div className="border-b border-slate-100 px-6 py-5 sm:px-7">
                        <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                                    Secure checkout
                                </p>

                                <h1
                                    id="checkout-title"
                                    className="mt-1.5 text-xl font-semibold tracking-tight text-slate-900"
                                >
                                    Complete your purchase
                                </h1>
                            </div>

                            <button
                                type="button"
                                onClick={closeCheckout}
                                disabled={paymentState === "processing"}
                                aria-label="Close checkout"
                                className="shrink-0 rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/20 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                <span className="text-xl leading-none">×</span>
                            </button>
                        </div>
                    </div>

                    <form
                        onSubmit={handleSubmit}
                        className="space-y-5 p-6 sm:space-y-6 sm:p-7"
                    >
                        <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-4">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                                Order summary
                            </p>

                            <div className="mt-3 flex items-start justify-between gap-4">
                                <div className="min-w-0">
                                    <h2 className="font-semibold text-slate-900">
                                        {product.name}
                                    </h2>

                                    <p className="mt-1 text-sm leading-relaxed text-slate-500">
                                        {product.description}
                                    </p>
                                </div>

                                <p className="shrink-0 text-base font-semibold tabular-nums text-slate-900">
                                    ₹{product.price}
                                </p>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label
                                htmlFor="email"
                                className={fieldLabel}
                            >
                                Email
                            </label>

                            <input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(event) =>
                                    setEmail(event.target.value)
                                }
                                placeholder="you@example.com"
                                autoComplete="email"
                                className={fieldInput}
                            />
                        </div>

                        <div className="space-y-2">
                            <label
                                htmlFor="card"
                                className={fieldLabel}
                            >
                                Card information
                            </label>

                            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white transition focus-within:border-slate-900 focus-within:ring-2 focus-within:ring-slate-900/10">
                                <input
                                    id="card"
                                    type="text"
                                    inputMode="numeric"
                                    value={cardNumber}
                                    onChange={(event) => {
                                        const value = event.target.value
                                            .replace(/\D/g, "")
                                            .slice(0, 16);

                                        const formatted = value.replace(
                                            /(\d{4})(?=\d)/g,
                                            "$1 "
                                        );

                                        setCardNumber(formatted);
                                    }}
                                    placeholder="4242 4242 4242 4242"
                                    autoComplete="cc-number"
                                    className="h-11 w-full border-0 bg-transparent px-4 text-sm text-slate-900 outline-none placeholder:text-slate-400"
                                />

                                <div className="grid grid-cols-2 border-t border-slate-200">
                                    <input
                                        id="expiry"
                                        type="text"
                                        inputMode="numeric"
                                        aria-label="Expiry date"
                                        value={expiry}
                                        onChange={(event) => {
                                            const value = event.target.value
                                                .replace(/\D/g, "")
                                                .slice(0, 4);

                                            const formatted =
                                                value.length > 2
                                                    ? `${value.slice(0, 2)} / ${value.slice(2)}`
                                                    : value;

                                            setExpiry(formatted);
                                        }}
                                        placeholder="MM / YY"
                                        autoComplete="cc-exp"
                                        className="h-11 min-w-0 border-0 border-r border-slate-200 bg-transparent px-4 text-sm text-slate-900 outline-none placeholder:text-slate-400"
                                    />

                                    <input
                                        id="cvc"
                                        type="password"
                                        inputMode="numeric"
                                        aria-label="CVC"
                                        value={cvc}
                                        onChange={(event) =>
                                            setCvc(
                                                event.target.value
                                                    .replace(/\D/g, "")
                                                    .slice(0, 4)
                                            )
                                        }
                                        maxLength={4}
                                        placeholder="CVC"
                                        autoComplete="cc-csc"
                                        className="h-11 min-w-0 border-0 bg-transparent px-4 text-sm text-slate-900 outline-none placeholder:text-slate-400"
                                    />
                                </div>
                            </div>
                        </div>

                        {paymentState === "declined" && (
                            <PaymentError
                                type="declined"
                                message={errorMessage}
                                onRetry={() => {
                                    setPaymentState("idle");
                                    setErrorMessage("");
                                }}
                            />
                        )}

                        {paymentState === "failed" && (
                            <PaymentError
                                type="failed"
                                message={errorMessage}
                                onRetry={() => {
                                    setPaymentState("idle");
                                    setErrorMessage("");
                                }}
                            />
                        )}

                        {paymentState === "idle" &&
                            errorMessage && (
                                <div
                                    role="alert"
                                    className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700"
                                >
                                    {errorMessage}
                                </div>
                            )}

                        <div className="flex items-center gap-2 text-xs text-slate-400">
                            <LockIcon />
                            <span>Your payment information is securely handled.</span>
                        </div>

                        <button
                            type="submit"
                            disabled={paymentState === "processing"}
                            className={primaryButton}
                        >
                            {paymentState === "processing" ? (
                                <>
                                    <span
                                        className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-white/30 border-t-white"
                                        aria-hidden
                                    />
                                    Processing payment...
                                </>
                            ) : (
                                `Pay ₹${product.price}`
                            )}
                        </button>
                    </form>
                </section>
            </div>
        </main>
    );
}

function LockIcon() {
    return (
        <svg
            className="h-3.5 w-3.5 shrink-0 text-slate-400"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden
        >
            <path
                d="M4.5 7V5a3.5 3.5 0 1 1 7 0v2"
                stroke="currentColor"
                strokeWidth="1.25"
                strokeLinecap="round"
            />
            <rect
                x="3.25"
                y="7"
                width="9.5"
                height="6.5"
                rx="1.25"
                stroke="currentColor"
                strokeWidth="1.25"
            />
        </svg>
    );
}
