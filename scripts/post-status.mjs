#!/usr/bin/env node
/**
 * Send a progress update to the team board (/admin/team).
 *
 *   node scripts/post-status.mjs --dev Harry --file update.txt
 *   echo "<bars>" | node scripts/post-status.mjs --dev Harry
 *
 * Needs DEV_STATUS_TOKEN in the environment; without it this exits quietly.
 * Person: --dev, else DEV_NAME, else the git branch if it is Harry/Mikey/Leo.
 * Never prints the token. 5 s timeout. Never fails its caller (exit 0).
 */
import { readFileSync, unlinkSync } from "node:fs";
import { execSync } from "node:child_process";

const args = process.argv.slice(2);
const arg = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const token = (process.env.DEV_STATUS_TOKEN || "").trim();
if (!token) process.exit(0);

let branch = "";
try { branch = execSync("git rev-parse --abbrev-ref HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim(); } catch { /* not a repo */ }
const PEOPLE = ["Harry", "Mikey", "Leo"];
const who = arg("--dev") || process.env.DEV_NAME || PEOPLE.find((p) => p.toLowerCase() === branch.toLowerCase());
if (!who) { console.error("status not sent: set DEV_NAME (Harry, Mikey or Leo)"); process.exit(0); }

let body = "";
const file = arg("--file");
try { body = file ? readFileSync(file, "utf8") : readFileSync(0, "utf8"); } catch { process.exit(0); }
if (file && args.includes("--delete")) { try { unlinkSync(file); } catch { /* gone */ } }
if (!body.trim()) process.exit(0);

const url = (process.env.DEV_STATUS_URL || "https://knowitball.co.uk/api/dev-status").trim();
const session = arg("--session") || process.env.CLAUDE_CODE_REMOTE_SESSION_ID || null;
try {
  const r = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", "x-dev-status-token": token },
    body: JSON.stringify({ person: who, body, branch, session }),
    signal: AbortSignal.timeout(5000),
  });
  if (!r.ok) console.error(`status not sent (${r.status})`);
} catch {
  console.error("status not sent (site not reached)");
}
process.exit(0);
