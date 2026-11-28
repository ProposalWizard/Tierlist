/**
 * Turned down (lib/star/life/snubs.ts): the first no leaves a memory; the second no to the same
 * person, from any story, costs more and says so; an outcome with no `snub` is untouched.
 *   npx tsx tests/star/lifeSnubs.mts
 */
import { withSnub, SNUB_TAG, SNUB_TWICE_TAG } from "../../lib/star/life/snubs";
import type { ArcOutcome, LifeState } from "../../lib/star/life/types";

let fails = 0;
const check = (ok: boolean, msg: string) => { if (!ok) { fails++; console.error("FAIL:", msg); } };

const life = (mem: [string, number, 1 | 2 | 3][]): LifeState => ({
  v: 2, people: { "mum": { r: 50, b: 50, g: 0, m: mem, s: 0 } }, squad: [], self: [], fired: {}, pending: [], groups: {}, cats: {},
  wk: [0, 0, 0], lastBig: 0, soc: [0, {}], flags: [], teamCarry: 0, log: [],
});
const cast = { mum: "mum" };
const o: ArcOutcome = { text: "\"Another time, then.\"", snub: "mum" };

const first = withSnub(o, life([]), cast);
check(first.text === o.text, "the first no keeps its own line");
check(!!first.remember?.some((r) => r.tag === SNUB_TAG && r.strength === 2 && r.slot === "mum"), "the first no leaves a strength-2 memory");
check(!first.npc?.length, "the first no costs nothing extra");

const second = withSnub(o, life([[SNUB_TAG, 3, 2]]), cast);
check(second.text.startsWith(o.text) && second.text.length > o.text.length && second.text.includes("{mum.short}"), "the second no adds her line");
check(!!second.remember?.some((r) => r.tag === SNUB_TWICE_TAG && r.strength === 3), "the second no leaves a strength-3 memory");
check(!!second.npc?.some((d) => (d.bond ?? 0) < 0 && (d.grudge ?? 0) > 0), "the second no costs bond and adds a grudge");

const own = withSnub({ ...o, snubTwice: "\"Don't bother, {you.short}.\"" }, life([[SNUB_TAG, 3, 2]]), cast);
check(own.text.endsWith("\"Don't bother, {you.short}.\""), "a story's own second-time line is used");

const plain: ArcOutcome = { text: "x" };
check(withSnub(plain, life([[SNUB_TAG, 3, 2]]), cast) === plain, "no snub: unchanged");
check(withSnub({ ...o, snub: "dad" }, life([]), cast).remember === undefined, "a slot not cast: unchanged");

console.log(fails ? `${fails} FAILED` : "life snubs: all passed");
process.exit(fails ? 1 : 0);
