const checkoutScrimCentered =
    "flex min-h-screen items-center justify-center bg-slate-950/60 p-4 sm:p-6 font-sans antialiased";
const checkoutCard =
    "w-full max-w-[460px] overflow-hidden rounded-[18px] border border-slate-200/80 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.08)]";
const checkoutCardBody = `${checkoutCard} p-8 sm:p-9`;

export function CheckoutLoading() {
    return (
        <main className={checkoutScrimCentered}>
            <div
                role="status"
                className={`${checkoutCardBody} text-center`}
            >
                <div className="mx-auto h-7 w-7 animate-spin rounded-full border-2 border-slate-200 border-t-slate-900" />

                <p className="mt-5 text-sm font-medium text-slate-700">
                    Loading checkout...
                </p>
            </div>
        </main>
    );
}
