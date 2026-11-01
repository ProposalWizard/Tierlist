/**
 * Who posts how often, over whole seasons (Football Twitter on).
 *   npx tsx scripts/football-twitter/census.mts [seasons=2] [seed=4242]
 */
import { setMediaUpdate } from "../../lib/star/media/updateFlags";
import { seasonsRun } from "./run.mts";
import { mediaOf } from "../../lib/star/media/feed";
import { PERSONAS } from "../../lib/star/media/twitter/personas";
import type { StoredPost } from "../../lib/star/media/types";

setMediaUpdate({ footballTwitter: true });
const [seasons = "2", seed = "4242"] = process.argv.slice(2);
const all = new Map<string, StoredPost>();
seasonsRun(Number(seasons), Number(seed), c => { for (const p of mediaOf(c).posts) all.set(p.id, p); });
const by = new Map<string, number>();
for (const p of all.values()) by.set(p.persona ?? `(${p.author.archetype})`, (by.get(p.persona ?? `(${p.author.archetype})`) ?? 0) + 1);
console.log(`${all.size} posts`);
for (const p of PERSONAS) console.log(`${String(by.get(p.id) ?? 0).padStart(5)}  ${p.id}`);
for (const [k, n] of by) if (k.startsWith("(")) console.log(`${String(n).padStart(5)}  ${k}`);
