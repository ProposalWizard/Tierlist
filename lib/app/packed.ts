/**
 * lib/app/packed.ts — "am I the packed phone app?"
 *
 * True only in the packed app build (`npm run app:build`, which sets
 * KIB_APP_BUILD=1; next.config.mjs then defines NEXT_PUBLIC_KIB_APP=1).
 * The website build never sets it, so on the website this is the constant
 * `false` and every `if (PACKED_APP)` branch is removed from the website's
 * code when it is built. The website cannot reach any app-only path.
 *
 * The packed app (Mikey, 5 Nov 2026): only Road to Ballon d'Or, everything
 * inside the download, plays with no signal, saves on the phone, no sign-in,
 * no casino. See mobile/README.md.
 */
export const PACKED_APP = process.env.NEXT_PUBLIC_KIB_APP === "1";
