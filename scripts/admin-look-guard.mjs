#!/usr/bin/env node
/**
 * ADMIN LOOK GUARD — every Road to Ballon d'Or admin/test page uses the
 * Broadcast frame (components/admin/broadcast). Harry, 19 Oct 2026: "on
 * making a new admin page how do we keep up the look".
 *
 * Reads the page list (lib/adminRegistry.ts, section "rbd"). A page's
 * page.tsx must import components/admin/broadcast — unless it is on
 * NOT_YET below, the pages built before the frame existed. NOT_YET may only
 * shrink: move a page onto the frame, then delete its line. Runs inside
 * `npm run build`, so a new page without the look cannot deploy.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const NOT_YET = new Set([
  "/star-goal-clips-dev",
  "/star-highlights-dev", "/star-play-dev", "/star-update-dev",
  "/star-dribble-stick-dev",
  "/star-tournament-dev", "/lineups", "/admin/clubs",
  "/star-3d-area-dev", "/star-3d-area-dev/signing", "/star-3d-area-dev/office", "/star-shop3d-dev",
  "/star-garden3d-dev", "/star-home3d-dev", "/star-training3d-dev", "/star-style-dev", "/star-animations-dev",
  "/star-anim3d-dev", "/star-people-dev", "/star-sprites-dev", "/admin/star-xp",
  "/star-tuning-dev", "/admin/sound-board",
]);
const SKIP = new Set(["/star-dev"]); // the game itself, not an admin page

const reg = fs.readFileSync(path.join(ROOT, "lib/adminRegistry.ts"), "utf8");
const urls = [...reg.matchAll(/^\s*P\("([^"]+)",[^\n]*?"rbd",/gm)].map((m) => m[1]).filter((u) => !SKIP.has(u));
const missing = [];
let onFrame = 0;
for (const url of urls) {
  const file = path.join(ROOT, "app", url, "page.tsx");
  const src = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
  const uses = /components\/admin\/broadcast/.test(src);
  if (uses) { onFrame++; if (NOT_YET.has(url)) console.log(`admin-look: ${url} is on the frame now — delete it from NOT_YET.`); continue; }
  if (!NOT_YET.has(url)) missing.push(url);
}
if (missing.length) {
  console.error("\nADMIN LOOK GUARD: these Road to Ballon d'Or admin pages don't use the Broadcast frame:");
  for (const u of missing) console.error(`  ${u}  →  wrap it in <BroadcastPage> from @/components/admin/broadcast/BroadcastPage`);
  console.error("See scripts/admin-look-guard.mjs.\n");
  process.exit(1);
}
console.log(`admin-look: ${onFrame} of ${urls.length} RBD admin pages on the Broadcast frame (${NOT_YET.size} still to move).`);
