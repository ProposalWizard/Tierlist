import { previewCareer, PREVIEW_SHAPES } from "../../lib/star/retirementPreview";
import { careerOverview } from "../../lib/star/careerOverview";
import { makeInitialCareer } from "../../lib/star/careerFlow";
import { skipTo } from "../../lib/star/devSkip";
import { retire, CAREER_SEASONS } from "../../lib/star/retirement";
import { generateSquad, clubNameSeed } from "../../lib/star/squadData";
import { PREMIER_LEAGUE_CLUBS } from "../../lib/star/clubs";
import type { CareerState, LeagueSquad, LeaguePlayer, StarPlayer } from "../../lib/star/types";

/**
 * THE HALL OF FAME (Leo, 5 Oct 2026): retiring never loses a career.
 *
 *  - The slim copy kept in the Hall draws EXACTLY the same overview as the
 *    full career, and is small enough to keep many of.
 *  - A retired career goes in once, from any save slot, and stays out once
 *    removed — on this device and when two copies are merged.
 *  - A career that retired before the Hall existed goes in from its slot.
 *  - A device that will not store it says so (the career is then not deleted).
 */
const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

let failWrites = false;
function freshStore() {
  const store = new Map<string, string>();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      if (failWrites && k.startsWith("star-hall-of-fame")) throw Object.assign(new Error("full"), { name: "QuotaExceededError" });
      store.set(k, String(v));
    },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => store.clear(),
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() { return store.size; },
  };
  return store;
}
const store = freshStore();
const H = await import("../../lib/star/hallOfFame");
const S = await import("../../lib/star/storage");

// ── 1. The slim copy draws the same overview, and is small ─────────────────
function squadFor(club: string): LeagueSquad {
  return {
    club,
    players: generateSquad(clubNameSeed(club)).map((p, i): LeaguePlayer => ({
      id: `${club}:${i}`, name: `${p.name} (${club})`, position: p.position,
      positions: p.positions ?? [p.position], overall: 62 + (clubNameSeed(p.name) % 20), goals: 0, assists: 0,
    })),
  };
}
/** A real career, played (simulated) to the end of its last season. */
function playedCareer(): CareerState {
  const player = { firstName: "Sim", lastName: "Ulated", age: 16, skinTone: "light", club: "Arsenal", clubBadge: null, position: "ST", nationality: "England", startYear: 2026 } as StarPlayer;
  let c: CareerState = { ...makeInitialCareer(player, [...PREMIER_LEAGUE_CLUBS]), leagueSquads: PREMIER_LEAGUE_CLUBS.map(squadFor) };
  for (let s = 1; s < CAREER_SEASONS; s++) c = skipTo(c, { season: s + 1, week: 1 }).career;
  // The last season, played to its end (a skip stops there: devSkip.ts).
  c = skipTo(c, { season: CAREER_SEASONS + 1, week: 1 }).career;
  return retire(c);
}
const played = playedCareer();
check(played.season === CAREER_SEASONS && played.retired === true, `a simulated career ends retired at season ${CAREER_SEASONS} (got ${played.season}, ${played.retired})`);

const sizes: string[] = [];
const careers: [string, CareerState][] = [
  ...PREVIEW_SHAPES.flatMap(({ id }) => [1, 2].map((seed): [string, CareerState] => [`${id}#${seed}`, previewCareer(id, seed)])),
  ["played", played],
];
for (const [tag, full] of careers) {
  const slim = H.slimCareer(full);
  // Through JSON, as it is stored: what is read back must draw the same.
  const back = JSON.parse(JSON.stringify(slim)) as CareerState;
  const a = JSON.stringify(careerOverview(full));
  const b = JSON.stringify(careerOverview(back));
  check(a === b, `${tag}: the slim copy draws the same overview`);
  const kb = JSON.stringify(slim).length / 1024;
  const fullKb = JSON.stringify(full).length / 1024;
  sizes.push(`${tag} ${fullKb.toFixed(0)}→${kb.toFixed(0)} KB`);
  check(kb < 120, `${tag}: the slim copy is small (${kb.toFixed(0)} KB)`);
  for (const k of ["leagueSquads", "externalSquads", "squad", "media", "league", "fixtures"] as const) {
    if (k === "fixtures") continue; // kept: the records read the last season's matches
    check(!(k in slim), `${tag}: the slim copy drops ${k}`);
  }
}

// ── 2. The id: the same career, the same id, on any device ─────────────────
{
  const c = previewCareer("legend", 1);
  const id = H.hallIdFor(c);
  check(/^hof-[a-z0-9]{1,16}$/.test(id), `the id has the shape the database checks (${id})`);
  check(H.hallIdFor(JSON.parse(JSON.stringify(c))) === id, "the same id after a trip through storage");
  check(H.hallIdFor(H.slimCareer(c)) === id, "the slim copy has the same id");
  check(H.hallIdFor({ ...c, media: undefined, money: c.money + 5 }) === id, "money or the phone's feed do not change it");
  const ids = new Set(PREVIEW_SHAPES.flatMap(({ id: shape }) => [1, 2, 3].map(seed => H.hallIdFor(previewCareer(shape, seed)))));
  check(ids.size === PREVIEW_SHAPES.length * 3, `different careers, different ids (${ids.size} of ${PREVIEW_SHAPES.length * 3})`);
}

// ── 3. In once, from any slot; out for good ─────────────────────────────────
{
  store.clear();
  const ACC = "user-hall";
  const legend = previewCareer("legend", 1);
  const notRetired = previewCareer("oneClub", 1, { upTo: 12 });

  check(H.addToHall(ACC, notRetired).added === false, "a career still going does not go in");
  // Saving a retired career (any slot) puts it in the account's one Hall.
  S.saveCareer(legend, S.slotScope(ACC, 2));
  let book = H.loadHall(ACC);
  check(book.entries.length === 1 && book.entries[0].id === H.hallIdFor(legend), "saving a retired career in slot 2 puts it in the Hall");
  check(book.entries[0].card.name === "Jamie Calloway" && book.entries[0].card.seasons === CAREER_SEASONS, "with its card");
  check(book.entries[0].card.mainClub === "Manchester City", `the card's club is where he played most (${book.entries[0].card.mainClub})`);
  S.saveCareer(legend, S.slotScope(ACC, 2));
  S.saveCareer(legend, S.slotScope(ACC, 1));
  check(H.loadHall(ACC).entries.length === 1, "saving it again (or in another slot) adds nothing");
  S.saveCareer(notRetired, S.slotScope(ACC, 3));
  check(H.loadHall(ACC).entries.length === 1, "saving a career still going adds nothing");
  check(H.loadHall("someone-else").entries.length === 0, "another account's Hall is untouched");

  // Remove: gone, and it does not come back.
  book = H.removeFromHall(ACC, H.hallIdFor(legend));
  check(book.entries.length === 0 && book.removed.length === 1, "removed: out of the list, remembered as removed");
  S.saveCareer(legend, S.slotScope(ACC, 2));
  check(H.loadHall(ACC).entries.length === 0, "saving the removed career again does not bring it back");
}

// ── 4. A career retired before the Hall existed goes in from its slot ──────
{
  store.clear();
  const ACC = "user-old";
  const old = previewCareer("journeyman", 2);
  // Written straight into slot 3, the way a save from before the Hall sits.
  store.set(`star-career-v2::${S.slotScope(ACC, 3)}`, JSON.stringify(old));
  check(H.loadHall(ACC).entries.length === 0, "an old retired save is not in the Hall yet");
  check(S.collectRetiredIntoHall(ACC) === 1, "collecting the slots puts it in");
  check(S.collectRetiredIntoHall(ACC) === 0, "and only once");
  const e = H.loadHall(ACC).entries[0];
  check(!!e && JSON.stringify(careerOverview(e.career)) === JSON.stringify(careerOverview(S.peekSlotCareer(ACC, 3)!)), "its Hall copy draws the same overview as the save");
}

// ── 5. Two copies (this device and the cloud) made into one ─────────────────
{
  const a = H.hallEntryFor(previewCareer("legend", 1), 1000);
  const b = H.hallEntryFor(previewCareer("oneClub", 1), 2000);
  const c = H.hallEntryFor(previewCareer("grafter", 1), 3000);
  const aLater = { ...a, addedAt: 5000 };
  const merged = H.mergeHall({ entries: [aLater, b], removed: [] }, { entries: [a, c], removed: [b.id] });
  check(merged.entries.map(e => e.id).join() === [c.id, a.id].join(), "every entry either has, minus the removed, newest first");
  check(merged.entries.find(e => e.id === a.id)?.addedAt === 1000, "the same career twice keeps its earlier date");
  check(merged.removed.includes(b.id), "the removal is kept");
  const again = H.mergeHall(merged, { entries: [b], removed: [] });
  check(!again.entries.some(e => e.id === b.id), "a removed career stays out when a copy still has it");
}

// ── 6. Anything read back is made safe ──────────────────────────────────────
{
  const e = H.hallEntryFor(previewCareer("quiet", 1), 10);
  check(H.sanitizeHallBook(null).entries.length === 0, "nothing: an empty Hall");
  check(H.sanitizeHallBook({ entries: "x", removed: 4 }).entries.length === 0, "rubbish: an empty Hall");
  check(H.sanitizeHallBook({ entries: [e, e, { id: 3 }], removed: [] }).entries.length === 1, "duplicates and broken entries dropped");
  check(H.sanitizeHallBook({ entries: [e], removed: [e.id] }).entries.length === 0, "a removed id never shows");
  check(H.accountOfScope("abc#slot3") === "abc" && H.accountOfScope("abc") === "abc" && H.accountOfScope("anon#slot2") === "anon", "one Hall per account, whatever the slot");
}

// ── 7. A device that will not store it says so ─────────────────────────────
{
  store.clear();
  failWrites = true;
  const r = H.addToHall("user-full", previewCareer("legend", 3));
  check(r.ok === false && r.added === false, "a full device: not added, and it says so (ok = false)");
  // The save itself still works; only the Hall copy failed.
  check(S.saveCareer(previewCareer("legend", 3), "user-full") === true, "the save itself still goes through");
  failWrites = false;
  check(H.addToHall("user-full", previewCareer("legend", 3)).added === true, "once there is room, it goes in");
}

console.log(`hallOfFame sizes (full→slim): ${sizes.join(" · ")}`);
if (problems.length) { console.error("hallOfFame FAILED:\n  - " + problems.join("\n  - ")); process.exit(1); }
console.log("hallOfFame: all checks passed");
