import { Product } from "@/lib/products";

const checkoutScrimCentered =
    "flex min-h-screen items-center justify-center bg-slate-950/60 p-4 sm:p-6 font-sans antialiased";
const checkoutCard =
    "w-full max-w-[460px] overflow-hidden rounded-[18px] border border-slate-200/80 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.08)]";
const checkoutCardBody = `${checkoutCard} p-8 sm:p-9`;
const primaryButton =
    "inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60";

type SuccessScreenProps = {
    product: Product;
    sessionId: string;
    onDone: () => void;
};

export function SuccessScreen({
    product,
    onDone,
    sessionId,
}: SuccessScreenProps) {
    return (
        <main className={checkoutScrimCentered}>
            <section
                role="dialog"
                aria-modal="true"
                className={`${checkoutCardBody} text-center`}
            >
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 ring-1 ring-emerald-100">
                    <span className="text-xl font-semibold text-emerald-600" aria-hidden>
                        ✓
                    </span>
                </div>

                <h1 className="mt-6 text-xl font-semibold tracking-tight text-slate-900">
                    Payment successful
                </h1>

                <p className="mt-2 text-sm leading-relaxed text-slate-500">
                    Your purchase of {product.name} is complete.
                </p>

                <div className="mt-5 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                        Session ID
                    </p>
                    <p className="mt-1 break-all font-mono text-xs text-slate-600">
                        {sessionId}
                    </p>
                </div>

                <button
                    type="button"
                    onClick={onDone}
                    className={`${primaryButton} mt-8`}
                >
                    Done
                </button>
            </section>
        </main>
    );
}
