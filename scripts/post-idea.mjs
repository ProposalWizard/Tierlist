#!/usr/bin/env node
/**
 * Add an idea from Claude to the Team room's Ideas board (/admin/team).
 *
 *   node scripts/post-idea.mjs --for Mikey --title "Turn Knowitball into an app"
 *
 * --for: whose idea it is (Harry, Mikey or Leo); else DEV_NAME, else the git
 * branch. The board shows it in their lane with a "Claude" tag. Needs
 * team_room_claude.sql run. Prints what happened; 10 s timeout.
 */
import { execSync } from "node:child_process";

const args = process.argv.slice(2);
const arg = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
let branch = "";
try { branch = execSync("git rev-parse --abbrev-ref HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim(); } catch { /* not a repo */ }
const PEOPLE = ["Harry", "Mikey", "Leo"];
const who = arg("--for") || process.env.DEV_NAME || PEOPLE.find((p) => p.toLowerCase() === branch.toLowerCase());
const title = arg("--title");
if (!who || !title) { console.error("Usage: node scripts/post-idea.mjs --for Mikey --title \"...\""); process.exit(1); }

const url = (process.env.TEAM_IDEAS_URL || "https://knowitball.co.uk/api/team-ideas").trim();
try {
  const r = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ for: who, title }),
    signal: AbortSignal.timeout(10000),
  });
  console.log(r.status, await r.text());
  process.exit(r.ok ? 0 : 1);
} catch (e) {
  console.error("idea not sent (site not reached)", String(e));
  process.exit(1);
}
