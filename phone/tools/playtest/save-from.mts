/**
 * ANY CAREER, FOR BOTH APPS (the inventory, 21 Nov 2026). Reads a career JSON file
 * (a bare CareerState, or { career, phase } as the older playtest saves keep it) and
 * prints the same { packed: {...}, next: {...} } as ../look/make-save.mts, so a
 * late-season career (posts in the feed, a cup run, a Europe bracket) can be loaded
 * into both apps with drive.mjs's reload("packed", save.packed) / reload("next", save.next).
 *
 *   npx tsx phone/tools/playtest/save-from.mts career.json [--no-tour] > save.json
 *
 * --no-tour: unlocks off (every screen open, no first-visit tours), as make-save.mts.
 */
import fs from "node:fs";
import { saveCareer, ANON_SCOPE } from "../../../lib/star/storage";
import type { CareerState } from "../../../lib/star/types";

const store = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { store.set(k, String(v)); },
  removeItem: (k: string) => { store.delete(k); },
  clear: () => store.clear(),
  key: (i: number) => [...store.keys()][i] ?? null,
  get length() { return store.size; },
} as Storage;

const file = process.argv[2];
if (!file) throw new Error("usage: save-from.mts career.json [--no-tour]");
const raw = JSON.parse(fs.readFileSync(file, "utf8"));
let career = (raw && typeof raw === "object" && "career" in raw ? raw.career : raw) as CareerState;
if (typeof career === "string") career = JSON.parse(career);
if (process.argv.includes("--no-tour")) career = { ...career, unlocks: undefined };
saveCareer(career, ANON_SCOPE);
const packed = Object.fromEntries(store);
const next = { "knowitball-career\\career-v2": JSON.stringify(career) };
console.log(JSON.stringify({ packed, next }));
