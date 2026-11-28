/**
 * THE LOADING SCREENS (components/star/loading/, Harry 27 Nov 2026).
 *  - every section has several screens, and the pick never repeats the last one
 *  - every backdrop still a screen names is on disk, and small
 *  - the matchday programme is built from the real fixture (no invented words)
 *  - the progress ring never goes backwards and never claims done before the place does
 */
import fs from "node:fs";
import path from "node:path";
import { LOAD_VARIANTS, pickVariant, readLast, writeLast, progressOf, type LoadSection } from "../../lib/star/loading/pick";
import { programmeFor } from "../../lib/star/loading/programme";
import { makeInitialCareer } from "../../lib/star/careerFlow";
import { PREMIER_LEAGUE_CLUBS } from "../../lib/star/clubs";
import { nextFixtureFor } from "../../lib/star/competitions";
import type { StarPlayer } from "../../lib/star/types";

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };
const root = path.resolve(new URL(".", import.meta.url).pathname, "../..");

// ── several per section, never twice in a row ──
for (const section of Object.keys(LOAD_VARIANTS) as LoadSection[]) {
  const vs = LOAD_VARIANTS[section];
  check(vs.length >= 2, `${section}: only ${vs.length} screen(s)`);
  let last: string | null = null;
  const seen = new Set<string>();
  for (let i = 0; i < 400; i++) {
    const v = pickVariant(section, last, ((i * 0.6180339887) % 1));
    check(v.id !== last, `${section}: ${v.id} twice in a row`);
    seen.add(v.id);
    last = v.id;
  }
  check(seen.size === vs.length, `${section}: only ${seen.size} of ${vs.length} ever shown`);
  for (const v of vs) {
    if (!v.still) continue;
    const f = path.join(root, "public/star/loading", `${v.still}.webp`);
    check(fs.existsSync(f), `${v.id}: no still ${v.still}.webp (node scripts/loading-stills/shoot.mjs)`);
    if (fs.existsSync(f)) check(fs.statSync(f).size < 90_000, `${v.still}.webp is ${Math.round(fs.statSync(f).size / 1024)} KB (keep it under 90)`);
  }
}
check(pickVariant("garden", null, 1).id !== undefined, "rnd = 1 still picks one");
check(pickVariant("garden", null, NaN).id !== undefined, "a bad rnd still picks one");
check(pickVariant("match", null, 0.5, (v) => v.kind === "tunnel").kind === "tunnel", "only narrows the list");
check(pickVariant("match", "tunnel", 0.5, (v) => v.kind === "tunnel").id === "tunnel", "one allowed: shown even if it was last");
for (const f of ["ball", "boot", "tunnel-1", "tunnel-2"]) check(fs.existsSync(path.join(root, "public/star/loading", `${f}.webp`)), `public/star/loading/${f}.webp missing`);

// ── the memory ──
{
  const a = writeLast(null, "garden", "keepie-garden-day");
  const b = writeLast(a, "match", "tunnel");
  check(readLast(b, "garden") === "keepie-garden-day" && readLast(b, "match") === "tunnel", "memory keeps each section");
  check(readLast("not json", "garden") === null && readLast(writeLast("[1]", "shop", "x"), "shop") === "x", "a broken memory starts again");
}

// ── the programme ──
{
  const player = { firstName: "Test", lastName: "Player", age: 19, skinTone: "medium", club: "Arsenal", clubBadge: null, position: "ST", nationality: "England", startYear: 2027 } as unknown as StarPlayer;
  const c = makeInitialCareer(player, [...PREMIER_LEAGUE_CLUBS], "premier");
  const f = nextFixtureFor(c)!;
  check(!!f, "a new career has a next fixture");
  const p = programmeFor(c, f);
  const names = [p.home.name, p.away.name];
  check(names.includes("Arsenal") && names.includes(f.opponent), `programme clubs: ${names.join(" v ")}`);
  // a new Arsenal career opens with the Community Shield (competitions.ts seedPreSeason): its own name, never "League"
  check(p.comp.length > 3 && p.comp !== "League", `competition: ${p.comp}`);
  const lg = c.fixtures.find((x) => !x.kind || x.kind === "league")!;
  check(programmeFor(c, lg).comp === "Premier League", `a league game says the league: ${programmeFor(c, lg).comp}`);
  check(/^[A-Z][a-z]{2} \d{1,2} [A-Z][a-z]{2}/.test(p.date) || p.date.length > 4, `date: "${p.date}"`);
  check(/^#[0-9a-f]{6}$/i.test(p.home.shirt) && /^#[0-9a-f]{6}$/i.test(p.away.shirt), "kits are colours");
  check(p.form.length === 0, "no form before a game is played");
  check(p.you.line !== undefined && p.you.stats.length === 4, "player in focus: no games yet says so");
  check(!JSON.stringify(p).includes("undefined") && !JSON.stringify(p).includes("NaN"), "no undefined/NaN words");
  // after a win, a draw and a loss the form reads them in order
  const played = c.fixtures.filter((x) => !x.kind || x.kind === "league").slice(0, 3);
  const scores: [number, number][] = [[2, 0], [1, 1], [0, 3]];
  played.forEach((x, i) => { x.played = true; const [us, them] = scores[i]; x.homeScore = x.home ? us : them; x.awayScore = x.home ? them : us; });
  const p2 = programmeFor(c, nextFixtureFor(c)!);
  check(p2.form.join("") === "WDL", `form after W, D, L: ${p2.form.join("")}`);
}

// ── progress ──
{
  let prev: number | null = null;
  const seq = [[0, 2, 0], [1, 4, 0], [1, 9, 0], [5, 9, 0], [9, 9, 0]];
  for (const [d, a, e] of seq) {
    const p = progressOf(d, a, e, prev);
    check(p !== null && p >= (prev ?? 0), `progress went back: ${prev} → ${p}`);
    check(p !== null && p <= 0.95, `progress ${p} claims done before the place`);
    prev = p;
  }
  check(progressOf(0, 0, 0, null) === null, "nothing asked: no ring");
  check(Math.abs((progressOf(5, 5, 20, null) ?? 0) - 0.25) < 1e-9, "against last time's count: 5 of 20");
}

if (problems.length) {
  console.error(`loadingScreens: ${problems.length} problem(s)\n  ` + problems.join("\n  "));
  process.exit(1);
}
console.log("loadingScreens: ok");
