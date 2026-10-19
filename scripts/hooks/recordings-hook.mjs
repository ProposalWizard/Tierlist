#!/usr/bin/env node
/**
 * UserPromptSubmit hook: when Harry, Mikey or Leo recorded something on
 * Admin → Videos, their next message to any of their chats starts with
 * "break this recording down first" (Harry, 19 Oct 2026: "shouldn't
 * recordings put by the name of the person be automatically read").
 *
 * Who this chat is: DEV_NAME, else a Harry/Mikey/Leo branch; no name = nothing.
 * Asks /api/dev-recordings/claim (3 s timeout). Anything it prints is added to
 * Claude's context for this turn. Never blocks or fails the message.
 */
import { execSync } from "node:child_process";

const PEOPLE = ["Harry", "Mikey", "Leo"];
function who() {
  const env = (process.env.DEV_NAME || "").trim().toLowerCase();
  let name = PEOPLE.find((p) => p.toLowerCase() === env);
  if (!name) {
    try {
      const b = execSync("git rev-parse --abbrev-ref HEAD", { stdio: ["ignore", "pipe", "ignore"], timeout: 2000 }).toString().trim().toLowerCase();
      name = PEOPLE.find((p) => p.toLowerCase() === b);
    } catch { /* not a repo */ }
  }
  return name;
}

export function contextFor(person, recordings) {
  if (!recordings.length) return "";
  const lines = recordings.map((r) => `- "${r.title}": ${r.link}`);
  return [
    `New screen recording${recordings.length > 1 ? "s" : ""} from ${person} (Admin → Videos), not read yet:`,
    ...lines,
    `Before answering this message, load the screen-video skill and break ${recordings.length > 1 ? "each one" : "it"} down`,
    `(treat it exactly like "Watch this recording: <link>"). Say first, in one line, that you are doing so; then answer the message.`,
  ].join("\n");
}

async function main() {
  const person = who();
  if (!person) return;
  const url = (process.env.DEV_RECORDINGS_URL || "https://knowitball.co.uk/api/dev-recordings/claim").trim();
  try {
    const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ person }), signal: AbortSignal.timeout(3000) });
    if (!r.ok) return;
    const j = await r.json();
    const text = contextFor(person, Array.isArray(j.recordings) ? j.recordings : []);
    if (text) process.stdout.write(text + "\n");
  } catch { /* site not reached: say nothing */ }
}

if (import.meta.url === `file://${process.argv[1]}`) main().finally(() => process.exit(0));
