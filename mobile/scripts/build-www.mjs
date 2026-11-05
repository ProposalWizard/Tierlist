/**
 * mobile/scripts/build-www.mjs — MAKE THE APP'S FILES (mobile/www).
 *
 *   cd mobile && npm run www            (after `npm run pack`)
 *   node mobile/scripts/build-www.mjs --skip-build   (reuse the last app build)
 *
 * 1. Builds the game alone as plain files (KIB_APP_BUILD=1, next.config.mjs:
 *    only `*.app.tsx` pages, no server) into .next-app/.
 * 2. Copies it to mobile/www, leaving out what only the website uses (admin
 *    videos and pictures, the homepage's art).
 * 3. Adds the packed data and pictures (mobile/packed, from pack.mts).
 * Capacitor then puts mobile/www inside the app (`npx cap sync`).
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MOBILE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ROOT = path.resolve(MOBILE, "..");
const BUILT = path.join(ROOT, ".next-app");
const WWW = path.join(MOBILE, "www");
const PACKED = path.join(MOBILE, "packed");

// Website-only files in public/: never read by the game (checked 5 Nov 2026).
const LEAVE_OUT = [
  "admin/motion-refs", "admin/previews", "admin/app-icon-180.png", "admin/app-icon-192.png",
  "admin/app-icon-512.png", "admin/app-icon-maskable-512.png", "admin/team-sw.js", "admin-app.webmanifest",
  "Bruno Fernandes.png", "Petr Cech.png", "Jose Mourinho.png", "Erling Haaland.png", "Klopp and Pep.png",
  "Arsenal Invincibles.png", "United 9-0.png", "draft-hero.jpg",
  "ChatGPT Image Aug 28, 2026, 03_55_20 AM.png", "ChatGPT Image Jul 26, 2026, 09_48_46 PM-Photoroom.png",
  "f3d83465-95e8-48a7-b770-8bedcd65e0c1-Photoroom.png",
];

if (!fs.existsSync(path.join(PACKED, "index.json"))) {
  console.error("No packed data: run `npm run pack` first (mobile/README.md).");
  process.exit(1);
}
if (!process.argv.includes("--skip-build")) {
  execSync("npx next build", { cwd: ROOT, stdio: "inherit", env: { ...process.env, KIB_APP_BUILD: "1" } });
}
fs.rmSync(WWW, { recursive: true, force: true });
fs.cpSync(BUILT, WWW, { recursive: true });
for (const f of LEAVE_OUT) fs.rmSync(path.join(WWW, f), { recursive: true, force: true });
fs.cpSync(PACKED, path.join(WWW, "packed"), { recursive: true });
fs.rmSync(path.join(WWW, "packed", "problems.txt"), { force: true });

const size = (d) => fs.readdirSync(d, { withFileTypes: true }).reduce((n, e) => n + (e.isDirectory() ? size(path.join(d, e.name)) : fs.statSync(path.join(d, e.name)).size), 0);
console.log(`mobile/www ready: ${(size(WWW) / 1e6).toFixed(0)} MB`);
