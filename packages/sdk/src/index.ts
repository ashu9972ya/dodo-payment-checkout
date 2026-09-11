export type CheckoutOptions = {
    productId: string;

    onSuccess?: (data: {
        sessionId: string;
    }) => void;

    onClose?: (data: {
        reason: "user" | "success" | "error";
    }) => void;

    onError?: (data: {
        code: string;
        message: string;
    }) => void;
};

type CheckoutMessage = {
    type: "CHECKOUT_INIT";
    productId: string;
};

type CheckoutEvent =
    | {
        type: "CHECKOUT_READY";
    }
    | {
        type: "CHECKOUT_SUCCESS";
        sessionId: string;
    }
    | {
        type: "CHECKOUT_ERROR";
        code: string;
        message: string;
    }
    | {
        type: "CHECKOUT_CLOSE";
        reason: "user" | "success" | "error";
    };

declare const process: {
    env: Record<string, string | undefined>;
};

const CHECKOUT_ORIGIN =
    process.env.NEXT_PUBLIC_DODO_CHECKOUT_ORIGIN ??
    process.env.DODO_CHECKOUT_ORIGIN ??
    "http://localhost:3000";
const CHECKOUT_URL = `${CHECKOUT_ORIGIN}/checkout`;

class DodoCheckoutSDK {
    private iframe: HTMLIFrameElement | null = null;

    private options: CheckoutOptions | null = null;

    private messageHandler: ((event: MessageEvent) => void) | null = null;

    private initRetryTimer: ReturnType<typeof setInterval> | null = null;

    private isCheckoutReady = false;
    private loadTimeout: ReturnType<typeof setTimeout> | null = null;

    open(options: CheckoutOptions) {
        if (this.iframe) return;

        if (!options?.productId) {
            options?.onError?.({
                code: "INVALID_OPTIONS",
                message: "productId is required.",
            });

            return;
        }

        this.options = options;
        this.isCheckoutReady = false;
        this.createCheckout();
    }

    close() {
        if (!this.iframe) return;

        const onClose = this.options?.onClose;

        this.cleanup();

        onClose?.({
            reason: "user",
        });
    }

    private createCheckout() {
        const iframe = document.createElement("iframe");

        iframe.src =
            `${CHECKOUT_URL}?productId=${encodeURIComponent(
                this.options!.productId
            )}`;

        iframe.title = "Dodo Checkout";

        iframe.setAttribute("allow", "payment");

        Object.assign(iframe.style, {
            position: "fixed",
            inset: "0",
            width: "100%",
            height: "100%",
            border: "0",
            zIndex: "999999",
            background: "transparent",
        });

        this.iframe = iframe;

        this.messageHandler = this.handleMessage.bind(this);

        window.addEventListener("message", this.messageHandler);

        iframe.addEventListener("load", () => {
            this.startInitHandshake();
        });

        iframe.addEventListener("error", () => {
            const onError = this.options?.onError;

            this.cleanup();

            onError?.({
                code: "CHECKOUT_LOAD_FAILED",
                message: "Checkout failed to load. Please try again.",
            });
        });

        document.body.appendChild(iframe);

        this.loadTimeout = setTimeout(() => {
            if (this.isCheckoutReady) return;

            const onError = this.options?.onError;

            this.cleanup();

            onError?.({
                code: "CHECKOUT_LOAD_TIMEOUT",
                message: "Checkout took too long to load. Please try again.",
            });
        }, 10_000);
    }

    private startInitHandshake() {
        const productId = this.options?.productId;

        if (!productId) return;

        const sendInit = () => {
            if (this.isCheckoutReady) return;

            this.sendMessage({
                type: "CHECKOUT_INIT",
                productId,
            });
        };

        // Send immediately.
        sendInit();

        // Retry in case React inside the iframe hasn't
        // registered its message listener yet.
        this.initRetryTimer = setInterval(sendInit, 500);
    }

    private handleMessage(event: MessageEvent<CheckoutEvent>) {
        // Only accept messages from our checkout application
        if (event.origin !== CHECKOUT_ORIGIN) {
            return;
        }

        // Only accept messages from our iframe
        if (event.source !== this.iframe?.contentWindow) {
            return;
        }

        const message = event.data;

        if (!message || typeof message !== "object") {
            return;
        }

        if (typeof message.type !== "string") {
            return;
        }

        switch (message.type) {
            // case "CHECKOUT_READY":
            //     const productId = this.options?.productId;

            //     if (!productId) return;
            //     this.sendMessage({
            //         type: "CHECKOUT_INIT",
            //         productId,
            //     });
            //     break;

            case "CHECKOUT_READY": {
                this.isCheckoutReady = true;

                if (this.initRetryTimer) {
                    clearInterval(this.initRetryTimer);
                    this.initRetryTimer = null;
                }
                if (this.loadTimeout) {
                    clearTimeout(this.loadTimeout);
                    this.loadTimeout = null;
                }

                break;
            }

            case "CHECKOUT_SUCCESS": {
                if (
                    typeof message.sessionId !== "string" ||
                    !message.sessionId
                ) {
                    this.options?.onError?.({
                        code: "INVALID_CHECKOUT_EVENT",
                        message: "Checkout returned an invalid session ID.",
                    });

                    return;
                }

                const onSuccess = this.options?.onSuccess;

                this.cleanup();

                onSuccess?.({
                    sessionId: message.sessionId,
                });

                break;
            }

            case "CHECKOUT_ERROR": {
                if (
                    typeof message.code !== "string" ||
                    typeof message.message !== "string"
                ) {
                    this.options?.onError?.({
                        code: "INVALID_CHECKOUT_EVENT",
                        message: "Checkout returned an invalid error.",
                    });

                    return;
                }

                this.options?.onError?.({
                    code: message.code,
                    message: message.message,
                });

                break;
            }

            case "CHECKOUT_CLOSE": {
                const validReasons = ["user", "success", "error"];

                if (!validReasons.includes(message.reason)) {
                    this.options?.onError?.({
                        code: "INVALID_CHECKOUT_EVENT",
                        message: "Checkout returned an invalid close reason.",
                    });

                    return;
                }

                const onClose = this.options?.onClose;

                this.cleanup();

                onClose?.({
                    reason: message.reason,
                });

                break;
            }
        }
    }

    private sendMessage(message: CheckoutMessage) {
        this.iframe?.contentWindow?.postMessage(message, CHECKOUT_ORIGIN);
    }

    private cleanup() {
        if (this.initRetryTimer) {
            clearInterval(this.initRetryTimer);
            this.initRetryTimer = null;
        }

        if (this.loadTimeout) {
            clearTimeout(this.loadTimeout);
            this.loadTimeout = null;
        }

        if (this.messageHandler) {
            window.removeEventListener("message", this.messageHandler);
        }

        this.iframe?.remove();

        this.iframe = null;
        this.messageHandler = null;
        this.options = null;
        this.isCheckoutReady = false;
    }
}

export const DodoCheckout = new DodoCheckoutSDK();