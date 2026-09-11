import * as esbuild from "esbuild";
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(__dirname, "..");
const outFile = join(packageRoot, "dist", "dodo-checkout.js");

const origin =
  process.env.DODO_CHECKOUT_ORIGIN ??
  process.env.NEXT_PUBLIC_DODO_CHECKOUT_ORIGIN;

if (process.env.BROWSER_BUILD === "production" && !origin) {
  throw new Error(
    "DODO_CHECKOUT_ORIGIN (or NEXT_PUBLIC_DODO_CHECKOUT_ORIGIN) is required for production browser builds"
  );
}

mkdirSync(dirname(outFile), { recursive: true });

await esbuild.build({
  entryPoints: [join(packageRoot, "src", "index.ts")],
  bundle: true,
  platform: "browser",
  format: "iife",
  globalName: "__DodoCheckoutBundle",
  outfile: outFile,
  target: "es2020",
  define: {
    "process.env.NEXT_PUBLIC_DODO_CHECKOUT_ORIGIN": origin
      ? JSON.stringify(origin)
      : "undefined",
  },
  footer: {
    js: "window.DodoCheckout = __DodoCheckoutBundle.DodoCheckout;",
  },
});

const demoPublicDir = join(packageRoot, "..", "..", "apps", "demo", "public");
const demoBundlePath = join(demoPublicDir, "dodo-checkout.js");

try {
  mkdirSync(demoPublicDir, { recursive: true });
  copyFileSync(outFile, demoBundlePath);
} catch {
  // Demo app may not exist in all environments.
}

console.log(`Built browser bundle: ${outFile}`);
