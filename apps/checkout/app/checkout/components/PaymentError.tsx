type PaymentErrorProps = {
    type: "declined" | "failed";
    message: string;
    onRetry: () => void;
};

export function PaymentError({
    type,
    message,
    onRetry,
}: PaymentErrorProps) {
    const isDeclined = type === "declined";

    return (
        <div
            role="alert"
            className={
                isDeclined
                    ? "rounded-xl border border-red-100 bg-red-50 p-4"
                    : "rounded-xl border border-amber-100 bg-amber-50 p-4"
            }
        >
            <p
                className={
                    isDeclined
                        ? "text-sm font-semibold text-red-900"
                        : "text-sm font-semibold text-amber-900"
                }
            >
                {isDeclined
                    ? "Payment declined"
                    : "Something went wrong"}
            </p>

            <p
                className={
                    isDeclined
                        ? "mt-1 text-sm leading-relaxed text-red-700"
                        : "mt-1 text-sm leading-relaxed text-amber-800"
                }
            >
                {message}
            </p>

            <button
                type="button"
                onClick={onRetry}
                className={
                    isDeclined
                        ? "mt-3 text-sm font-semibold text-red-900 underline underline-offset-4 transition-colors hover:text-red-800"
                        : "mt-3 text-sm font-semibold text-amber-900 underline underline-offset-4 transition-colors hover:text-amber-800"
                }
            >
                Try again
            </button>
        </div>
    );
}
