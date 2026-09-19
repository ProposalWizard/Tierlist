/**
 * lib/star/devMode.ts
 *
 * OFFLINE DEV PLAY — playing Road to Ballon d'Or without signing in.
 *
 * WHY THIS EXISTS
 * ---------------
 * `/star-dev` is a client component with no server auth gate (middleware.ts
 * only guards /tierlist and /create), but its mount effect refuses to start a
 * career for a signed-out visitor. Signing in means Google OAuth, which a
 * sandboxed/headless/CI environment cannot complete.
 *
 * The practical consequence, visible all through SESSION_LOG.md and CLAUDE.md:
 * round after round of real gameplay and rendering work shipped on nothing but
 * a type-check and a unit-test suite, with entries repeatedly conceding "none
 * of this has been seen live". Several genuinely live bugs — a keeper frozen
 * mid-dive, an outline tracing a rectangle instead of a face, Touch Mode
 * catching instantly — survived multiple rounds of exactly that.
 *
 * The signed-out code path was never deleted: `ANON_SCOPE` still exists in
 * storage.ts and is still the default value of `scopeRef`. This just turns it
 * back on, for development only.
 *
 * SAFETY
 * ------
 * `process.env.NODE_ENV` is inlined by Next at build time. A production build
 * (`next build`, which is what Vercel runs) hardcodes "production", so the
 * default branch below is compiled to `false` and the signed-out path is
 * genuinely unreachable in the deployed app — not merely unlikely.
 *
 * The explicit override exists for the one case NODE_ENV alone doesn't cover:
 * verifying a production-mode build locally (`next build && next start`).
 * Setting it to "1" in a real deployment would re-enable signed-out play, so
 * don't. It is deliberately NOT read from anything user-controllable at
 * runtime — only from build-time env.
 */

/**
 * Whether a signed-out visitor may play a local-only career.
 *
 * - "1" → yes, regardless of NODE_ENV (local production-mode builds).
 * - "0" → no, regardless of NODE_ENV (test a real sign-in wall in dev).
 * - unset → yes in development, no in production.
 */
export function offlineDevPlayEnabled(): boolean {
  const flag = process.env.NEXT_PUBLIC_STAR_OFFLINE_DEV;
  if (flag === "1") return true;
  if (flag === "0") return false;
  return process.env.NODE_ENV === "development";
}
