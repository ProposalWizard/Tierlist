/**
 * The kit man story's voice clips (public/star/life/voice/hundred-balls/manifest.json).
 *  1. Every manifest entry has an mp3 that exists, is not empty, and has a plausible length.
 *  2. Ids are unique, and every clip's words are a real quote in the story (or its caller / end line).
 *  3. Every Den and gaffer quote without a {placeholder} has a clip (scripts/life/voice-lines.mts lists the rest).
 */
import fs from "node:fs";
import path from "node:path";
import { plan } from "../../scripts/life/voice-lines.mts";

let fails = 0;
const check = (ok: boolean, msg: string) => { if (!ok) { fails++; console.error("FAIL:", msg); } };
const norm = (s: string) => s.toLowerCase().replace(/[“”"]/g, "").replace(/[^a-z0-9' ]+/g, " ").replace(/\s+/g, " ").trim();

const DIR = path.resolve("public/star/life/voice/hundred-balls");
const man: { id: string; speaker: string; voice: string; text: string; file: string; seconds: number }[] = JSON.parse(fs.readFileSync(path.join(DIR, "manifest.json"), "utf8"));
const story = fs.readFileSync(path.resolve("lib/star/life/book/arcs/hundred-balls.json"), "utf8");
const storyN = ` ${norm(story.replace(/\{kitman\.(short|first)\}/g, "Den"))} `;

check(man.length >= 45, `at least the first 45 clips (${man.length})`);
const ids = new Set<string>();
for (const c of man) {
  check(!ids.has(c.id), `unique id ${c.id}`);
  ids.add(c.id);
  const f = path.join(DIR, c.file);
  check(fs.existsSync(f) && fs.statSync(f).size > 1000, `file for ${c.id}`);
  check(c.seconds > 0.3 && c.seconds < 30, `seconds for ${c.id} (${c.seconds})`);
  check(c.speaker === "den" || c.speaker === "gaffer", `speaker of ${c.id}`);
  check(!!c.text && storyN.includes(` ${norm(c.text)} `), `${c.id} is a real line of the story`);
}
check(new Set(man.map((c) => c.file)).size === man.length, "one file per clip");

const { todo } = plan();
check(todo.length === 0, `every Den/gaffer quote without a placeholder has a clip (missing: ${todo.map((l) => l.id).join(", ")})`);

console.log(fails ? `${fails} FAILED` : `life voice: all passed (${man.length} clips)`);
process.exit(fails ? 1 : 0);
