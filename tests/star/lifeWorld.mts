/**
 * THE STORY WORLD'S ENGINE HOOKS (job B, 28 Nov 2026; docs/plans/STORY_WORLD_PLAN.md part 5b).
 *
 *  1. The unlocks registry: 43 ids, unique codes, life.ul never trimmed, the old 4 words mapped.
 *  2. Every new start condition, true and false, read from a real career.
 *  3. The parser fails an unknown club, unlock, competition, milestone or scrapbook tag.
 *  4. Milestones: just(...) for 3 weeks after each one, never from before the first snapshot.
 *  5. The scrapbook: book(), since(), the 48-line cap, fading; echoes delivered or dropped.
 *  6. An ending that unlocks shows "Unlocked · <name>"; a scrapbook write books an echo.
 *  7. The fixed legends: only at a club you moved to; a pin stays; the first club keeps the pool.
 *  8. The checker fails unknown slugs and ids, old words, and a scrapbook tag read but never written.
 *  9. Old saves: no new field appears on load; a save with every new part loads back the same.
 *
 *   npx tsx tests/star/lifeWorld.mts
 */
const store = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v); }, removeItem: (k: string) => { store.delete(k); }, clear: () => store.clear(), key: () => null, length: 0 } as Storage;

const A = await import("../../lib/star/life/arcs.ts");
const UL = await import("../../lib/star/life/unlocks.ts");
const SB = await import("../../lib/star/life/scrapbook.ts");
const MS = await import("../../lib/star/life/milestones.ts");
const { parseCond, holds } = await import("../../lib/star/life/cond.ts");
const { ctxFor, factsOf } = await import("../../lib/star/life/facts.ts");
const { freshLife, personInfo, clubCode, lifeWeek } = await import("../../lib/star/life/people.ts");
const { migrateLife } = await import("../../lib/star/life/migrate.ts");
const { CLUB_LEGENDS } = await import("../../lib/star/life/clubLegends.ts");
const { POOL } = await import("../../lib/star/life/pool.ts");
const BOOK = await import("../../lib/star/life/arcBook.ts");
const { validateArcBook } = await import("../../lib/star/life/validateArcs.ts");
const { EVENTS } = await import("../../lib/star/life/book.ts");
const { starLevel } = await import("../../lib/star/starPoints.ts");
const { makeInitialCareer } = await import("../../lib/star/careerFlow.ts");
const { PREMIER_LEAGUE_CLUBS } = await import("../../lib/star/clubs.ts");
const { mulberry32 } = await import("../../lib/star/season.ts");
import type { CareerState, StarPlayer } from "../../lib/star/types";
import type { LifeState } from "../../lib/star/life/types";

let fails = 0;
const check = (ok: boolean, msg: string) => { if (!ok) { fails++; console.log("FAIL", msg); } else if (process.env.V) console.log("ok  ", msg); };

function career(club = "Sunderland"): CareerState {
  const player = { firstName: "Sam", lastName: "Carter", age: 22, skinTone: "light", club, clubBadge: null, position: "ST", nationality: "England", startYear: 2027 } as StarPlayer;
  const c = makeInitialCareer(player, [...PREMIER_LEAGUE_CLUBS], "premier");
  return { ...c, season: 3, week: 10, energy: 80, weekActions: 3, money: 50_000 };
}
const on = (c: CareerState, cond: string, life: LifeState = c.life ?? freshLife()) => holds(cond, ctxFor(c, life, {}, factsOf(c)));

// ── 1. The registry ──
{
  check(UL.UNLOCKS.length === 43, `43 unlocks (${UL.UNLOCKS.length})`);
  const kinds = (k: string) => UL.UNLOCKS.filter((u) => u.kind === k).length;
  check(kinds("place") === 12 && kinds("cutscene") === 7 && kinds("skill") === 6 && kinds("item") === 8 && kinds("mode") === 10, "12 places, 7 cut scenes, 6 skills, 8 items, 10 modes");
  check(new Set(UL.UNLOCKS.map((u) => u.id)).size === 43 && new Set(UL.UNLOCKS.map((u) => u.code)).size === 43 && UL.UNLOCKS.every((u) => /^[a-z0-9]{3}$/.test(u.code)), "ids and 3-letter codes all different");
  check(UL.UNLOCKS.filter((u) => u.kind === "item").every((u) => !!UL.ITEM_WORDS[u.id]), "every item has its card words (ITEM_WORDS)");
  const life = freshLife();
  life.got = Array.from({ length: 30 }, (_, i) => `item:junk-${i}`);
  UL.grantUnlocks(life, UL.UNLOCKS.map((u) => u.id));
  check(UL.unlocksOf(life).size === 43 && (life.ul ?? "").split(" ").length === 43, "all 43 kept in life.ul, never trimmed");
  check(JSON.stringify(life.ul).length <= 200, `life.ul with all 43 is ${JSON.stringify(life.ul).length} bytes (≤ 200)`);
  check(UL.grantUnlocks(life, ["heritage-room"]).length === 0, "an unlock already held is not added twice");
  const old = freshLife();
  old.got = ["item:dens-ball-bag", "garden:hundred-balls-corner", "garden:den-visits", "trophy:the-kit-room-door", "item:legends-boots"];
  const ids = UL.unlocksOf(old);
  check(["item-dens-ball-bag", "hundred-balls-corner", "den-visits", "kit-room-door", "item-legends-boots"].every((x) => ids.has(x)) && !old.ul, "an old save's 4 words read as their new ids, with nothing rewritten");
  check(UL.TOP26.length === 26 && UL.TOP26.every((s) => UL.ALL_CLUB_SLUGS.has(s)), "the 26 hook clubs are real clubs");
  check(UL.clubSlug("Brighton & Hove Albion") === "brighton-hove-albion" && UL.clubSlug("FC Bayern München") === "fc-bayern-munchen", "club slugs drop & and accents");
}

// ── 2. The new conditions ──
{
  let c = career("Sunderland");
  c = {
    ...c,
    seasonHistory: [
      { season: 1, age: 20, club: "Leeds United", division: "premier", position: 8, teams: 20, winners: {}, overall: 60, fame: 10, money: 0, wage: 0, caps: 0, intlGoals: 0 },
      { season: 2, age: 21, club: "Sunderland", division: "premier", position: 5, teams: 20, winners: {}, overall: 62, fame: 12, money: 0, wage: 0, caps: 0, intlGoals: 0 },
    ],
    fixtures: [
      { week: 9, opponent: "Newcastle United", home: true, played: true, homeScore: 1, awayScore: 0 },
      { week: 12, opponent: "Real Madrid", home: false, played: false, kind: "europe", competition: "Champions League" },
    ],
    trophies: [{ season: 1, competition: "Premier League", club: "Leeds United" }, { season: 2, competition: "FA Cup", club: "Sunderland" }, { season: 2, competition: "FA Cup", club: "Sunderland" }],
    international: { decided: [], callUps: 2, snubs: 0, matches: [] }, internationalGoals: 1, ballonDorWins: 1,
  } as CareerState;
  check(on(c, "club:sunderland") && !on(c, "club:chelsea"), "club:<slug>");
  check(on(c, "everClub:leeds-united") && on(c, "everClub:sunderland") && !on(c, "everClub:arsenal"), "everClub:<slug> (history and now)");
  check(on(c, "opponent:newcastle-united") && on(c, "opponent:real-madrid") && !on(c, "opponent:chelsea"), "opponent:<slug> (last and next match)");
  check(on(c, "derby") && !on({ ...c, fixtures: [] } as CareerState, "derby"), "derby (Sunderland v Newcastle)");
  check(on(c, "clubTop26") && !on(career("Watford"), "clubTop26"), "clubTop26");
  check(on(c, "seasonsAtClub==2") && on(career(), "seasonsAtClub==1"), "seasonsAtClub (this is your 2nd season in a row)");
  check(on(c, "callUps>=2") && on(c, "intlGoals>=1") && on(c, "ballonDor>=1") && !on(career(), "callUps>=1"), "callUps, intlGoals, ballonDor");
  check(!on(c, "inTournament") && on({ ...c, tournament: { season: 3, selected: true } } as unknown as CareerState, "inTournament"), "inTournament");
  check(on(c, "won(fa-cup)>=2") && !on(c, "won(fa-cup)>=3") && on(c, "won(league)") && on(c, "won(premier-league)") && !on(c, "won(champions-league)"), "won(<comp>) and won(<comp>)>=n");
  check(on(c, "wonAt(league,leeds-united)") && !on(c, "wonAt(league,sunderland)") && on(c, "wonAt(fa-cup,sunderland)"), "wonAt(<comp>,<slug>)");
  check(on(c, "!club:chelsea && club:sunderland || club:arsenal"), "the new words join with ! && ||");
  const life = freshLife();
  UL.grantUnlocks(life, ["heritage-room"]);
  check(on(c, "has(heritage-room)", life) && !on(c, "has(statue-plinth)", life), "has(<unlock>)");
  const old = { ...freshLife(), got: ["item:dens-ball-bag"] };
  check(on(c, "has(item-dens-ball-bag)", old), "has() reads an old save's old word");
  // The Star Pass level is the same 1-100 number for an old 1-10 save.
  const oldScale = { ...c, stars: undefined, starBest: { stars: 54, scale: 10, match: 0, trophies: 0, awards: 0 } } as unknown as CareerState;
  check(starLevel(oldScale) === factsOf(oldScale).num.starLevel, `starLevel reads an old-scale save on the 1-100 scale (${starLevel(oldScale)})`);
}

// ── 3. The parser fails unknown words ──
{
  const err = (s: string, re: RegExp) => { const p = parseCond(s); check(typeof p === "string" && re.test(p), `"${s}" fails (${typeof p === "string" ? p : "parsed"})`); };
  err("club:man-utd", /unknown club/);
  err("everClub:nowhere-fc", /unknown club/);
  err("opponent:real-madri", /unknown club/);
  err("wonAt(league,nowhere)", /unknown club/);
  err("won(the-cup)", /unknown competition/);
  err("has(the-moon)", /unknown unlock/);
  err("book('nothing-here')", /unknown scrapbook tag/);
  err("since('nothing-here')>=2", /unknown scrapbook tag/);
  err("just(wedding)", /unknown milestone/);
  err("just(trophy:the-cup)", /unknown milestone/);
  check(typeof parseCond("clubApps<=10") !== "string" && typeof parseCond("hasPartner") !== "string", "the old words that start the same still parse");
}

// ── 4. Milestones ──
{
  let c = career();
  const life = freshLife();
  const now = () => lifeWeek(c);
  MS.noteMilestones(c, life, now());
  check(!!life.ms && !life.msw, "the first moment only takes the snapshot");
  const step = (edit: Partial<CareerState>, weeks = 1) => { c = { ...c, ...edit, week: c.week + weeks }; MS.noteMilestones(c, life, now()); };
  step({ player: { ...c.player, age: 23 } });
  check(on(c, "just(birthday)", life) && on(c, "just(birthday) && age==23", life), "just(birthday)");
  step({}, 3);
  check(!on(c, "just(birthday)", life) && !life.msw, "…gone after 3 weeks, and the save drops it");
  step({ player: { ...c.player, club: "Chelsea" } });
  check(on(c, "just(new-club) && club:chelsea", life), "just(new-club)");
  step({ international: { decided: [], callUps: 1, snubs: 0, matches: [] } });
  check(on(c, "just(first-call-up)", life) && !on(c, "just(call-up)", life), "just(first-call-up)");
  step({ international: { decided: [], callUps: 2, snubs: 0, matches: [] } });
  check(on(c, "just(call-up)", life), "just(call-up)");
  step({ trophies: [{ season: 3, competition: "FA Cup", club: "Chelsea" }] });
  check(on(c, "just(trophy)", life) && on(c, "just(trophy:fa-cup)", life) && !on(c, "just(trophy:league)", life), "just(trophy) and just(trophy:<comp>)");
  step({ trophies: [...c.trophies, { season: 3, competition: "Premier League", club: "Chelsea" }] });
  check(on(c, "just(trophy:league)", life) && !on(c, "just(trophy:fa-cup)", life), "just(trophy:<comp>) reads only the newest trophies");
  const row = { season: 3, age: 23, club: "Chelsea", division: "premier" as const, position: 18, teams: 20, winners: {}, overall: 60, fame: 10, money: 0, wage: 0, caps: 0, intlGoals: 0 };
  step({ seasonHistory: [{ ...row, move: "relegated" }] });
  check(on(c, "just(relegated)", life) && !on(c, "just(promoted)", life), "just(relegated)");
  step({ seasonHistory: [{ ...row, move: "relegated" }, { ...row, season: 4, move: "promoted" }] });
  check(on(c, "just(promoted)", life), "just(promoted)");
  const sl = c.stars ?? 1;
  step({ stars: Math.max(sl, 24) } as Partial<CareerState>);
  step({ stars: 26 } as Partial<CareerState>);
  check(on(c, "just(star-level)", life), "just(star-level) when it crosses 25");
  check(JSON.stringify(life.ms).length + JSON.stringify(life.msw ?? {}).length <= 100, `milestones part ${JSON.stringify(life.ms).length + JSON.stringify(life.msw ?? {}).length} bytes (≤ 100)`);
}

// ── 5. The scrapbook ──
{
  const c = career();
  const life = freshLife();
  const now = lifeWeek(c);
  SB.bookWrite(life, "derby-winner", now - 160, 3);
  SB.bookWrite(life, "clay-tray-cracked", now - 160, 2);
  SB.bookWrite(life, "fined-at-court", now, 1);
  check(on(c, "book('derby-winner')", life) && !on(c, "book('clay-tray-cracked')", life) && on(c, "book('fined-at-court')", life), "book(): strength 3 stays, 2 has faded after three seasons");
  check(on(c, "since('derby-winner')>=3", life) && !on(c, "since('derby-winner')>=4", life) && !on(c, "since('white-rose')>=0", life), "since(): whole seasons since; a tag never written is false");
  check(on(c, "book('white-rose'|'derby-winner')", life) && !on(c, "!book('derby-winner')", life), "book('a'|'b') and !book()");
  check(!SB.bookWrite(life, "not-a-tag", now), "a tag not in scrapbook.json is never written");
  const tags = Object.keys(SB.SCRAPBOOK);
  const full = freshLife();
  for (let i = 0; i < 60; i++) {
    // Pretend there are 60 tags: write the 10 real ones over and over at 3 strengths, then fill with fakes.
    SB.bookWrite(full, tags[i % tags.length], now - i, ((i % 3) + 1) as 1 | 2 | 3);
  }
  full.sb = Array.from({ length: 48 }, (_, i) => `x${String(i).padStart(3, "0")}.${9999 - i}.3`).join(" ");
  SB.bookWrite(full, "white-rose", 9999, 3);
  check((full.sb ?? "").split(" ").length === 48 && on(career(), "book('white-rose')", full), "48 lines at most; a new line pushes the oldest weakest out");
  check(JSON.stringify(full.sb).length <= 600, `a full scrapbook is ${JSON.stringify(full.sb).length} bytes (≤ 600)`);
  check(SB.scrapbookOf(life, now)[0]?.line.length > 0, "the scrapbook reads as plain lines for the People page");
}

// ── 6. An ending that unlocks, writes the scrapbook and books an echo ──
{
  const rng = mulberry32(3);
  const ID = "arc-the-bins";
  const arc = BOOK.arcById(ID)!;
  const outs = arc.beats[0].event.talk!.ends.quote;
  const keep = JSON.stringify(outs);
  for (const o of outs) { o.unlock = "heritage-room"; o.book = { tag: "derby-winner", echo: { seasons: [2, 3], who: "tabloid", line: "\"Remember that derby? I do. {tabloid.short}.\"" } }; }
  let c = career();
  c = A.arcMoment(c, "home:evening", { rng, force: ID }).career;
  const op = A.openBeat(c, ID, arc.beats[0].id)!;
  const r = A.playEnding(op.career, op.live, "quote", { rng });
  c = r.career;
  check(r.extras.unlocked?.[0]?.name === "The heritage room" && r.result.changes.some((x) => x.label === "Unlocked · The heritage room"), `the ending card: Unlocked · The heritage room (${JSON.stringify(r.extras.unlocked)})`);
  check(UL.unlocksOf(c.life).has("heritage-room") && on(c, "has(heritage-room)"), "it is in life.ul and has() reads it");
  check(on(c, "book('derby-winner')") && (c.life?.ech?.length ?? 0) === 1, "the scrapbook line is written and one echo is booked");
  const due = c.life!.ech![0][0];
  check(due - lifeWeek(c) >= 100 && due - lifeWeek(c) <= 150, `the echo is due 2 to 3 seasons on (${due - lifeWeek(c)} weeks)`);
  const later = { ...c, season: c.season + 3, week: 10 } as CareerState;
  const m = A.arcMoment(later, "home:evening", { rng });
  const echo = m.notices.find((n) => n.kind === "echo");
  check(!!echo && /Remember that derby/.test(echo.text) && !/\{/.test(echo.text) && !m.career.life?.ech, `the echo arrives as a text from him (${echo?.text})`);
  // Forgotten by then: dropped.
  const who = c.life!.ech![0][1];
  const gone = { ...later, life: { ...c.life!, people: Object.fromEntries(Object.entries(c.life!.people).filter(([id]) => id !== who)) } } as CareerState;
  const m2 = A.arcMoment(gone, "home:evening", { rng });
  check(!m2.notices.some((n) => n.kind === "echo") && !m2.career.life?.ech, "an echo from someone forgotten is dropped");
  const rest = JSON.parse(keep);
  arc.beats[0].event.talk!.ends.quote.splice(0, outs.length, ...rest);
}

// ── 7. The fixed legends ──
{
  check(CLUB_LEGENDS.length === 26 && new Set(CLUB_LEGENDS.map((l) => l.slug)).size === 26 && CLUB_LEGENDS.every((l) => UL.TOP26.includes(l.slug) && UL.clubSlug(l.club) === l.slug), "26 fixed legends, one per hook club");
  const poolIds = new Set(Object.values(POOL).flat().map((p) => p.id));
  check(CLUB_LEGENDS.every((l) => !poolIds.has(l.id)), "their ids never clash with the pool");
  const c0 = career("Watford");
  const life = { ...freshLife(), home: "Watford" };
  const atUnited = { ...c0, life, player: { ...c0.player, club: "Manchester United" } } as CareerState;
  const id = `club:legend@${clubCode("Manchester United")}`;
  check(personInfo(atUnited, id)?.name === "Walter Penhale" && personInfo(atUnited, id)?.short === "Penhale", "at a club you moved to (Manchester United): the fixed legend");
  const pinned = { ...atUnited, life: { ...life, cpool: { [`legend@${clubCode("Manchester United")}`]: "terry" } } } as CareerState;
  check(personInfo(pinned, id)?.name === "Terry Marsh", "a legend already pinned there stays (old saves keep theirs)");
  const first = career("Manchester United");
  check(personInfo(first, "club:legend")?.name !== "Walter Penhale", "the career's first club keeps its pool legend");
  const idAt = `club:legend@${clubCode("Watford")}`;
  check(!CLUB_LEGENDS.some((l) => l.first + " " + l.last === personInfo(atUnited, idAt)?.name), "any other club keeps the pool");
  // No story hard-codes a fixed legend's surname.
  const strings = (o: unknown, out: string[] = []): string[] => { if (typeof o === "string") out.push(o); else if (Array.isArray(o)) o.forEach((x) => strings(x, out)); else if (o && typeof o === "object") Object.values(o).forEach((x) => strings(x, out)); return out; };
  const all = strings(BOOK.ALL_ARCS);
  const hard = CLUB_LEGENDS.filter((l) => all.some((t) => new RegExp(`(^|[^A-Za-z])${l.last}([^A-Za-z]|$)`).test(t)));
  check(!hard.length, `no story writes a fixed legend's name (${hard.map((l) => l.last).join(", ")})`);
}

// ── 8. The checker ──
{
  type Arc = (typeof BOOK.ALL_ARCS)[number];
  const copy = () => JSON.parse(JSON.stringify(BOOK.ALL_ARCS)) as Arc[];
  const by = (b: Arc[], id: string) => b.find((a) => a.id === id)!;
  const base = validateArcBook(copy(), EVENTS);
  check(base.length === 0, `today's book passes the checker (${base.slice(0, 3).map((p) => `${p.id}: ${p.problem}`).join(" | ")})`);
  const broken = (why: string, edit: (b: Arc[]) => void, expect: RegExp) => {
    const b = copy();
    edit(b);
    const got = validateArcBook(b, EVENTS).map((p) => p.problem);
    check(got.some((p) => expect.test(p)), `the checker rejects ${why} (got: ${got.slice(0, 2).join(" | ") || "nothing"})`);
  };
  const out0 = (b: Arc[]) => by(b, "arc-the-bins").beats[0].event.talk!.ends.quote[0];
  broken("an unknown club slug in start.when", (b) => { by(b, "arc-the-bins").start!.when = ["club:man-utd"]; }, /unknown club/);
  broken("an unknown club slug in a beat", (b) => { by(b, "arc-the-bins").beats[0].requires = ["opponent:nowhere"]; }, /unknown club/);
  broken("an unknown unlock in has()", (b) => { by(b, "arc-the-bins").start!.when = ["has(the-moon)"]; }, /unknown unlock/);
  broken("an unknown unlock id", (b) => { out0(b).unlock = "the-moon"; }, /not in the unlocks list/);
  broken("an old unlock word", (b) => { out0(b).unlock = "garden:hundred-balls-corner"; }, /old word/);
  broken("giving a place as an item", (b) => { out0(b).give = "heritage-room"; }, /not an item/);
  broken("an item whose card names someone not in the story", (b) => { out0(b).give = "item-dens-ball-bag"; }, /not in the cast/);
  broken("a scrapbook tag read but never written", (b) => { by(b, "arc-the-bins").start!.when = ["book('white-rose')"]; }, /no story writes/);
  broken("since() on a tag never written", (b) => { by(b, "arc-the-bins").beats[0].requires = ["since('white-rose')>=2"]; }, /no story writes/);
  broken("a scrapbook tag not in scrapbook.json", (b) => { out0(b).book = "made-up-tag"; }, /not in lib\/star\/life\/book\/scrapbook.json/);
  broken("an echo from someone not in the story", (b) => { out0(b).book = { tag: "white-rose", echo: { seasons: [1, 2], who: "kitman", line: "x" } }; }, /not in the cast/);
  broken("an echo line naming another person", (b) => { out0(b).book = { tag: "white-rose", echo: { seasons: [1, 2], who: "tabloid", line: "{kitman.short} says hi" } }; }, /an echo knows only/);
  // Written once, it can be read.
  const ok = copy();
  out0(ok).book = "white-rose";
  by(ok, "arc-the-bins").beats[0].requires = ["since('white-rose')>=0 || !book('white-rose')"];
  const okProbs = validateArcBook(ok, EVENTS).filter((p) => /scrapbook/.test(p.problem));
  check(!okProbs.length, `a tag some story writes can be read (${okProbs[0]?.problem ?? ""})`);
}

// ── 9. Old saves ──
{
  const raw = { v: 2, people: {}, squad: [], self: [], fired: {}, pending: [], groups: {}, cats: {}, wk: [0, 0, 0], lastBig: -999, soc: [0, {}], flags: [], teamCarry: 0, log: [], got: ["item:dens-ball-bag"] };
  const l = migrateLife(raw) as unknown as Record<string, unknown>;
  check(!("ul" in l) && !("sb" in l) && !("ms" in l) && !("msw" in l) && !("ech" in l), "an old save gets none of the new fields on load");
  const full = freshLife();
  UL.grantUnlocks(full, ["heritage-room", "mode-penalties"]);
  SB.bookWrite(full, "derby-winner", 300, 3);
  full.ms = [25, 40, 1, 2, 3, "ab12"];
  full.msw = { bd: 300, tr: 299, tn: 1 };
  full.ech = [[450, "hack:tabloid", "derby-winner", "abcd"]];
  const back = migrateLife(JSON.parse(JSON.stringify(full)));
  check(JSON.stringify({ ul: back.ul, sb: back.sb, ms: back.ms, msw: back.msw, ech: back.ech }) === JSON.stringify({ ul: full.ul, sb: full.sb, ms: full.ms, msw: full.msw, ech: full.ech }), "a save with every new part loads back the same");
  const junk = migrateLife({ ...raw, ul: "toolong xx her", sb: "bad wtch.3.9 wtch.3.3", ms: [1, 2], msw: { bd: "x", tr: 4 }, ech: [[1, 2, 3]] });
  check(junk.ul === "her" && junk.sb === "wtch.3.3" && !junk.ms && JSON.stringify(junk.msw) === '{"tr":4}' && !junk.ech, "broken new parts are dropped piece by piece");
}

console.log(fails ? `${fails} FAILED` : "life world: all passed");
process.exit(fails ? 1 : 0);
