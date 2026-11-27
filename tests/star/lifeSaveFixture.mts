/**
 * OLD STORY SAVES STILL LOAD (story storage, 27 Nov 2026).
 *
 * `tests/star/fixtures/lifeSaves-2026-11-27.json` holds two real `career.life` blocks saved by the
 * code BEFORE finished stories were packed small (commit a0c12cc, the 120-story book): the biggest
 * save of the 200-career soak (career 106, 15 seasons, 69 stories, 24.4 KB) at the end, and the
 * same career at season 6 week 20 with 12 stories open. Never regenerate them with newer code: they
 * stand for saves already on players' phones.
 *
 * Next to each save, the same file holds what the old code showed for it: the phone's story list
 * (questLog), the promises, every round-menu bubble, every story's ending and people, and then 30
 * weeks played on from the save by fixed dice (every beat, offer, notice and the life block at the
 * end). This test loads each save the way the game does (migrateLife), plays the same weeks with
 * the new code and checks every one of those is the same, and that the save is much smaller.
 *
 * The book grows (new stories, old stories made deeper: story batch 3, 27 Nov 2026), so the exact
 * replay is played on the book AS IT WAS when the saves were made
 * (`fixtures/lifeBook-2026-11-27.json.gz`, the 121 stories of commit 52a7231, swapped in place
 * below): that checks the CODE still plays an old save exactly as it did. Today's book is checked
 * first, for what a player with an old save sees: every story keeps its ending, its people and the
 * beats it played, and 30 weeks play on with no beat that will not open.
 *
 *   npx tsx tests/star/lifeSaveFixture.mts             check
 *   WRITE_FIXTURE=1 npx tsx tests/star/lifeSaveFixture.mts   only with the OLD code (never again)
 */
const store = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v); }, removeItem: (k: string) => { store.delete(k); }, clear: () => store.clear(), key: () => null, length: 0 } as Storage;

const { readFileSync, writeFileSync } = await import("node:fs");
const { createHash } = await import("node:crypto");
const A = await import("../../lib/star/life/arcs.ts");
const T = await import("../../lib/star/life/talk.ts");
const PR = await import("../../lib/star/life/promises.ts");
const { migrateLife } = await import("../../lib/star/life/migrate.ts");
const { makeInitialCareer } = await import("../../lib/star/careerFlow.ts");
const C = await import("../../lib/star/clubs.ts");
const { mulberry32 } = await import("../../lib/star/season.ts");
import type { CareerState, StarPlayer } from "../../lib/star/types";
import type { ArcRun, LifeArc, LifeMoment } from "../../lib/star/life/types";
const { gunzipSync } = await import("node:zlib");
const BOOK = await import("../../lib/star/life/arcBook.ts");

const FILE = new URL("./fixtures/lifeSaves-2026-11-27.json", import.meta.url);
let fails = 0;
const check = (ok: boolean, msg: string) => { if (!ok) { fails++; console.log("FAIL", msg); } else if (process.env.V) console.log("ok  ", msg); };
const hash = (x: unknown) => createHash("sha256").update(JSON.stringify(x)).digest("hex").slice(0, 16);

interface Saved { player: StarPlayer; season: number; week: number; skills: Record<string, number>; life: unknown }

/** The career around a saved life block, built the same way every time. */
function careerFor(s: Saved): CareerState {
  const c = makeInitialCareer(s.player, [...C.CHAMPIONSHIP_CLUBS], "championship");
  const squad = c.squad.map((p, i) => ({ ...p, age: p.age ?? 17 + ((i * 7 + 106) % 17), overall: p.overall ?? 55 + ((i * 11 + 106) % 25) }));
  return {
    ...c, squad, season: s.season, week: s.week, weekActions: 3, energy: 80, money: 50_000, fame: 40,
    skills: { ...c.skills, ...s.skills } as CareerState["skills"],
    girlfriend: { name: "Soak Partner", happiness: 60, gifts: 0 },
    life: migrateLife(JSON.parse(JSON.stringify(s.life))),
  };
}

/** Everything a player can see of the stories, as one record. */
function view(c: CareerState) {
  const runs = A.arcsOf(c);
  const ids = Object.keys(runs).sort();
  const people = [...new Set(ids.flatMap((id) => Object.values(runs[id].cast)).filter(Boolean))].sort();
  return {
    quest: A.questLog(c).slice().sort((a, b) => a.arc.localeCompare(b.arc)),
    promises: PR.promiseList(c),
    bubbles: people.map((p) => [p, A.bubblesFor(c, p)]),
    stories: ids.map((id) => [id, runs[id].done ?? null, runs[id].cast]),
  };
}

/** The life block without the stories' own storage (which is what changed). */
function rest(c: CareerState) {
  const l = { ...(c.life as unknown as Record<string, unknown>) };
  delete l.arcs; delete l.fin;
  return l;
}

/** 30 weeks on from the save, fixed dice, every reply and game by the dice (as the soak plays). */
function playOn(c0: CareerState, seed: number): { steps: string[]; end: CareerState; dead: string[] } {
  const dead: string[] = [];
  const rng = mulberry32(seed);
  const pick = (k: number) => Math.floor(rng() * k);
  let c = c0;
  const steps: string[] = [];
  for (let i = 0; i < 30; i++) {
    c = c.week >= 46 ? { ...c, season: c.season + 1, week: 1, player: { ...c.player, age: c.player.age + 1 } } : { ...c, week: c.week + 1 };
    c = { ...c, weekActions: 3 };
    const moments: LifeMoment[] = ["walkout", "after-match", "arrive:training", "home:evening", "driving"];
    if (c.week === 46) moments.push("season-end");
    const facts = { lastRating: Math.round((5 + rng() * 4) * 10) / 10, lastWon: rng() < 0.45, lastLost: rng() < 0.3, lastGoals: rng() < 0.3 ? 1 : 0 };
    for (const m of moments) {
      const r = A.arcMoment(c, m, { rng, facts });
      c = r.career;
      steps.push(`${c.season}.${c.week} ${m} screens=${JSON.stringify(r.screens)} offers=${JSON.stringify(r.offers)} notices=${hash(r.notices)}`);
      for (const sc of r.screens) { const a = T.autoBeat(c, sc.arc, sc.beat, { rng, facts, pick }); if (a) { c = a.career; steps.push(`  played ${sc.beat} -> ${a.end}`); } else dead.push(`${c.season}.${c.week} ${sc.beat}`); }
      for (const o of r.offers) if (rng() < 0.6) { const a = T.autoBeat(c, o.arc, o.beat, { rng, facts, pick }); if (a) { c = a.career; steps.push(`  took ${o.beat} -> ${a.end}`); } }
    }
    for (const [, run] of Object.entries(A.arcsOf(c))) {
      const den = run.cast.kitman;
      if (!den) continue;
      for (const bb of A.bubblesFor(c, den, facts)) if (!bb.gold && rng() < 0.5) { const a = T.autoBeat(c, bb.arc, bb.beat, { rng, facts, pick }); if (a) { c = a.career; steps.push(`  thursday ${bb.beat} -> ${a.end}`); } }
    }
    c = A.endOfDay(c, rng).career;
    steps.push(`  view ${hash(view(c))} rest ${hash(rest(c))}`);
  }
  return { steps, end: c, dead };
}

function digest(s: Saved) {
  const c = careerFor(s);
  const p = playOn(c, 4242);
  return {
    loaded: hash(view(c)), loadedRest: hash(rest(c)),
    steps: p.steps.map((x) => hash(x)), stepText: p.steps,
    end: hash(view(p.end)), endRest: hash(rest(p.end)),
    bytesLoaded: JSON.stringify(c.life).length, bytesEnd: JSON.stringify(p.end.life).length,
    // A save made by the new code (stories packed) loads back the same.
    reload: hash(view({ ...p.end, life: migrateLife(JSON.parse(JSON.stringify(p.end.life))) })) === hash(view(p.end)),
    packed: (p.end.life?.fin ?? "").split(" ").filter(Boolean).length,
  };
}

const fx = JSON.parse(readFileSync(FILE, "utf8")) as { saves: Record<string, Saved>; expect?: Record<string, ReturnType<typeof digest>> };
if (process.env.WRITE_FIXTURE) {
  fx.expect = Object.fromEntries(Object.entries(fx.saves).map(([k, s]) => [k, digest(s)]));
  writeFileSync(FILE, JSON.stringify(fx));
  for (const [k, d] of Object.entries(fx.expect)) console.log(`${k}: written; life block ${d.bytesLoaded} bytes loaded, ${d.bytesEnd} after 30 weeks`);
  process.exit(0);
}
// ── 1. Today's book: what a player with an old save sees ──────────────────────────────────────
const LIFE_BLOCK_LIMIT = 50_000;
const doneOf = (f: Record<string, number[]>) => JSON.stringify(Object.keys(f).filter((b) => f[b].length).sort());
for (const [k, s] of Object.entries(fx.saves)) {
  const raw = ((s.life as { arcs?: Record<string, ArcRun> }).arcs ?? {}) as Record<string, ArcRun>;
  const c = careerFor(s);
  const runs = A.arcsOf(c);
  const lost = Object.entries(raw).filter(([id, r]) => !runs[id] || runs[id].done !== r.done || JSON.stringify(runs[id].cast) !== JSON.stringify(r.cast) || doneOf(runs[id].f) !== doneOf(r.f)).map(([id]) => id);
  check(!lost.length && Object.keys(runs).length === Object.keys(raw).length, `${k}, today's book: all ${Object.keys(raw).length} stories load with their endings, people and beats played${lost.length ? ` (changed: ${lost.slice(0, 4).join(", ")})` : ""}`);
  const p = playOn(c, 4242);
  check(!p.dead.length, `${k}, today's book: 30 weeks played on, every due beat opens${p.dead.length ? ` (${p.dead.slice(0, 3).join(", ")})` : ""}`);
  const after = A.arcsOf(p.end);
  const moved = Object.entries(raw).filter(([id, r]) => r.done && !Object.keys(r.s).length && !r.o && after[id]?.done !== r.done).map(([id]) => id);
  check(!moved.length, `${k}, today's book: every story that was over stays over the same way${moved.length ? ` (${moved.slice(0, 4).join(", ")})` : ""}`);
  check(hash(view({ ...p.end, life: migrateLife(JSON.parse(JSON.stringify(p.end.life))) })) === hash(view(p.end)), `${k}, today's book: saved again, it loads back the same`);
  const bytes = JSON.stringify(p.end.life).length;
  check(bytes < LIFE_BLOCK_LIMIT, `${k}, today's book: the life block stays under ${LIFE_BLOCK_LIMIT / 1000} KB (${bytes} bytes)`);
  const started = Object.keys(after).filter((id) => !(id in raw)).length;
  console.log(`${k}, today's book: ${Object.keys(raw).length} stories loaded the same; ${started} new ones met in 30 weeks; life block ${bytes} bytes`);
}

// ── 2. The book as it was: the exact replay ────────────────────────────────────────────────────
// Swapped in place (the same objects, so every module's lookups see it), after today's book is done.
{
  const old = JSON.parse(gunzipSync(readFileSync(new URL("./fixtures/lifeBook-2026-11-27.json.gz", import.meta.url))).toString()) as LifeArc[];
  const live = new Map(BOOK.ALL_ARCS.map((a) => [a.id, a] as [string, LifeArc]));
  const olds = old.map((a) => {
    const cur = live.get(a.id);
    if (!cur) throw new Error(`the old book's story ${a.id} is gone from today's book (never take a story out)`);
    for (const key of Object.keys(cur)) delete (cur as unknown as Record<string, unknown>)[key];
    return Object.assign(cur, a);
  });
  BOOK.ALL_ARCS.splice(0, BOOK.ALL_ARCS.length, ...olds);
  BOOK.ARCS.splice(0, BOOK.ARCS.length, ...olds.filter((a) => !a.needsActivity));
  BOOK.WAITING_ARCS.splice(0, BOOK.WAITING_ARCS.length, ...olds.filter((a) => !!a.needsActivity));
}
for (const [k, s] of Object.entries(fx.saves)) {
  const want = fx.expect![k];
  const raw = JSON.stringify(s.life).length;
  const got = digest(s);
  check(got.loaded === want.loaded, `${k}: the stories read the same straight after loading (phone list, promises, bubbles, endings, people)`);
  check(got.loadedRest === want.loadedRest, `${k}: the rest of the life block loads unchanged`);
  const at = got.steps.findIndex((h, i) => h !== want.steps[i]);
  check(at < 0 && got.steps.length === want.steps.length, `${k}: 30 weeks played on from the save give the same beats, offers and notices${at >= 0 ? ` (first difference: old "${want.stepText[at]}" new "${got.stepText[at]}")` : ""}`);
  check(got.end === want.end && got.endRest === want.endRest, `${k}: the same stories and life block after 30 weeks`);
  check(got.reload, `${k}: a save with packed stories loads back the same (${got.packed} packed)`);
  // The first moment after loading packs the finished stories: the block shrinks.
  check(got.bytesEnd < want.bytesEnd, `${k}: smaller after play (${want.bytesEnd} -> ${got.bytesEnd} bytes; ${raw} as saved)`);
  console.log(`${k}: life block as saved ${raw} bytes; old code after 30 weeks ${want.bytesEnd}, new ${got.bytesEnd}`);
}
console.log(fails ? `${fails} FAILED` : "lifeSaveFixture: all held");
process.exit(fails ? 1 : 0);
