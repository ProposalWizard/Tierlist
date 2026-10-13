// Runs first in `npm run build`. Prints a start line, so a Vercel log shows our
// build has begun (Harry, 12 Oct 2026: three live builds sat after "npm install"
// with nothing after it). On Vercel's live builds it also throws away the cache
// restored from an older live build: the stuck builds all restored the same one,
// while branch builds (their own cache) finished in 4-7 min.
import { rmSync } from "node:fs";
const env = process.env.VERCEL_ENV || "local";
console.log(`[build] start ${new Date().toISOString()} (${env})`);
if (env === "production") {
  rmSync(".next/cache", { recursive: true, force: true });
  console.log("[build] live build: old .next/cache removed, building fresh");
}
