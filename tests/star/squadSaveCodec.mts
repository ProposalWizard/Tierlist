import { makeInitialCareer } from "../../lib/star/careerFlow";
import { PREMIER_LEAGUE_CLUBS } from "../../lib/star/clubs";
import type { CareerState, LeaguePlayer, LeagueSquad, StarPlayer } from "../../lib/star/types";

/**
 * The other clubs' squads, saved thin — lib/star/squadSaveCodec.ts.
 *
 * The one property that matters: nothing the CAREER did to those squads is
 * lost between saving and loading. Goals, grown ratings, players moved
 * between clubs, a club you own signing somebody, your son, a merger's
 * emptied club — all of it must come back exactly. Only what the database
 * already says (photos, flags, attributes) is left out, and it must come
 * back from the next fetch.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { store.set(k, String(v)); },
  removeItem: (k: string) => { store.delete(k); },
  clear: () => store.clear(),
};

const codec = await import("../../lib/star/squadSaveCodec");
const { saveCareer, loadCareer } = await import("../../lib/star/storage");
const { reconcileExternalSquads } = await import("../../lib/star/leagueSquads");

/** Key-order-independent JSON, so "the same player" means the same fields. */
function canon(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canon).join(",")}]`;
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o).filter(k => o[k] !== undefined).sort().map(k => `${JSON.stringify(k)}:${canon(o[k])}`).join(",")}}`;
  }
  return JSON.stringify(v);
}
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));

// ── A realistic fetched world: what fetchLeagueSquads would build ──
function fetchedPlayer(club: string, i: number): LeaguePlayer {
  const id = `${100000 + club.length * 1000 + i}`;
  return {
    id, name: `${club} Player ${i}`, position: (["GK", "CB", "CM", "ST"] as const)[i % 4],
    overall: 60 + (i * 7) % 30, goals: 0, assists: 0,
    image: `https://cagkgfketucousksgtbk.supabase.co/storage/v1/object/public/tierlist-images/player-portraits/${id}.png`,
    nation: ["England", "Spain", "Brazil"][i % 3], age: 18 + (i % 15),
    ...(i === 3 ? { highPotential: true } : {}),
    pace: 50 + i, shooting: 51 + i, passing: 52 + i, dribbling: 53 + i, defending: 54 + i, physical: 55 + i,
    positions: [(["GK", "CB", "CM", "ST"] as const)[i % 4]],
  };
}
function generatedPlayer(club: string, i: number): LeaguePlayer {
  return { id: `gen:${club}:${i}`, name: `Invented ${i}`, position: "CM", overall: 55, goals: 0, assists: 0, image: "/fake-face-1.png" };
}
const EXT_CLUBS = ["Real Madrid", "Ajax", "Celtic", "Barnsley", "Hearts"];
const fetchedExternal: LeagueSquad[] = EXT_CLUBS.map(c => ({
  club: c,
  players: c === "Barnsley"
    ? Array.from({ length: 6 }, (_, i) => generatedPlayer(c, i))
    : Array.from({ length: 8 }, (_, i) => fetchedPlayer(c, i)),
}));
const LEAGUE_CLUBS = ["Chelsea", "Everton"];
const fetchedLeague: LeagueSquad[] = LEAGUE_CLUBS.map(c => ({
  club: c, players: Array.from({ length: 8 }, (_, i) => fetchedPlayer(c, i)),
}));

codec.forgetFetchedSquads();
codec.rememberFetchedSquads(fetchedExternal);
codec.rememberFetchedSquads(fetchedLeague);

// ── …and everything a career does to it ──
const player: StarPlayer = {
  firstName: "Test", lastName: "Codec", age: 17, skinTone: "light",
  club: "Arsenal", clubBadge: null, position: "ST", nationality: "England", startYear: 2027,
} as StarPlayer;
const base = makeInitialCareer(player, [...PREMIER_LEAGUE_CLUBS]) as CareerState;

const ext = clone(fetchedExternal);
const madrid = ext[0].players, ajax = ext[1].players, celtic = ext[2].players, barnsley = ext[3].players;
madrid[0].goals = 4; madrid[0].assists = 2;                      // European goals (settleEuro)
madrid[3].overall += 5;                                            // wonderkid growth (growWonderkids)
const moved = ajax.splice(2, 1)[0]; moved.goals = 1; celtic.push(moved); // international window move
const signed = { ...fetchedPlayer("Chelsea", 5) }; ajax.push(signed);   // owned-club signing from the division
const windowRebuilt: LeaguePlayer = { id: celtic[1].id, name: celtic[1].name, position: celtic[1].position,
  positions: celtic[1].positions, overall: celtic[1].overall, goals: 0, assists: 0,
  image: celtic[1].image, nation: celtic[1].nation, age: celtic[1].age }; // toLeaguePlayer drops attributes
celtic[1] = windowRebuilt;
celtic[4] = { ...celtic[4], age: 40 };                             // anything the career changed
barnsley.push({ id: "son:Junior:Barnsley", name: "Junior", position: "ST", overall: 71, goals: 3, assists: 0 }); // your son
ext[4].players = [];                                               // a merger's absorbed club (Hearts)
const lg = clone(fetchedLeague);
lg[0].players[1].goals = 7; lg[0].players[6].overall = 88;

const career: CareerState = { ...base, externalSquads: ext, leagueSquads: lg };

// ── 1. Round trip with the fetch known on both sides ──
{
  const blob = clone(codec.toSavedForm(career));
  check(!("externalSquads" in blob) && !("leagueSquads" in blob), "the full squad arrays are not in the saved blob");
  const back = codec.fromSavedForm(blob as CareerState);
  const extBack = codec.hydrateSquads(back.externalSquads ?? []);
  const lgBack = codec.hydrateSquads(back.leagueSquads ?? []);

  // Exact, apart from ONE documented difference: a player a transfer window
  // rebuilt without his six attributes gets them back from the database.
  const expectedExt = clone(ext);
  const rebuilt = expectedExt[2].players.find(p => p.id === windowRebuilt.id)!;
  const fromDb = fetchedExternal[2].players.find(p => p.id === windowRebuilt.id)!;
  for (const k of ["pace", "shooting", "passing", "dribbling", "defending", "physical"] as const) rebuilt[k] = fromDb[k];
  check(canon(extBack) === canon(expectedExt), "external squads round-trip exactly (goals, growth, moves, signings, son, emptied club)");
  check(canon(lgBack) === canon(lg), "league squads round-trip exactly");
  check(extBack[4].club === "Hearts" && extBack[4].players.length === 0, "a merger's emptied club stays empty");
  check(canon(back.fixtures) === canon(career.fixtures) && back.player.club === career.player.club, "the rest of the career is untouched");

  const full = JSON.stringify([career.leagueSquads, career.externalSquads]).length;
  const thin = JSON.stringify((blob as { savedSquads?: unknown }).savedSquads).length;
  check(thin < full * 0.35, `the saved squads are much smaller (${full} → ${thin} bytes)`);
}

// ── 2. Offline / before the fetch lands: saving again loses nothing ──
{
  const blob1 = clone(codec.toSavedForm(career));
  codec.forgetFetchedSquads(); // a new page load: nothing fetched yet
  const thinCareer = codec.fromSavedForm(clone(blob1) as CareerState);
  const son = thinCareer.externalSquads!.find(s => s.club === "Barnsley")!.players.find(p => p.id.startsWith("son:"));
  check(!!son && son.name === "Junior" && son.goals === 3, "before any fetch, invented players are whole");
  check(thinCareer.externalSquads![0].players[0].name === madrid[0].name && thinCareer.externalSquads![0].players[0].goals === 4,
    "before any fetch, every real player still has his name and goals (usable offline)");
  check(codec.hydrateSquads(thinCareer.externalSquads!) === thinCareer.externalSquads, "with nothing fetched, filling in changes nothing");
  const blob2 = clone(codec.toSavedForm(thinCareer));
  check(canon(blob2) === canon(blob1), "re-saving a thin career before the fetch lands writes the identical thin save");

  // …and when the fetch does land, everything comes back.
  codec.rememberFetchedSquads(fetchedExternal);
  codec.rememberFetchedSquads(fetchedLeague);
  const later = codec.hydrateSquads(codec.fromSavedForm(clone(blob2) as CareerState).externalSquads!);
  const m0 = later[0].players[0];
  check(m0.image === madrid[0].image && m0.nation === madrid[0].nation && m0.pace === madrid[0].pace, "the fetch fills the photo, flag and attributes back in");
  check(later[0].players[3].overall === madrid[3].overall, "…without overwriting a grown rating");
}

// ── 3. No fetch this session at all: the save keeps everything ──
{
  codec.forgetFetchedSquads();
  const blob = clone(codec.toSavedForm(career));
  const back = codec.fromSavedForm(blob as CareerState);
  check(canon(back.externalSquads) === canon(ext) && canon(back.leagueSquads) === canon(lg),
    "with nothing known about the database, every field is kept (never thinner than the player had)");
  codec.rememberFetchedSquads(fetchedExternal);
  codec.rememberFetchedSquads(fetchedLeague);
}

// ── 4. The database changed since the save: new photos arrive, career data stays ──
{
  const blob = clone(codec.toSavedForm(career));
  codec.forgetFetchedSquads();
  const newer = clone(fetchedExternal);
  newer[0].players[0].image = "https://example.test/new-photo.png";
  newer[0].players[3].overall = 50; // an admin edit to a player whose rating the career grew
  codec.rememberFetchedSquads(newer);
  const back = codec.hydrateSquads(codec.fromSavedForm(blob as CareerState).externalSquads!);
  check(back[0].players[0].image === "https://example.test/new-photo.png", "a photo updated in the database reaches an old save");
  check(back[0].players[3].overall === madrid[3].overall, "…but the career's own grown rating is kept, not the database's");
  codec.forgetFetchedSquads();
  codec.rememberFetchedSquads(fetchedExternal);
  codec.rememberFetchedSquads(fetchedLeague);
}

// ── 5. Old saves and odd blobs ──
{
  const old = clone(career);
  check(canon(codec.fromSavedForm(old)) === canon(career), "a save from before this (full arrays, no savedSquads) loads unchanged");
  const both = { ...clone(codec.toSavedForm(career)), externalSquads: clone(fetchedExternal) } as CareerState;
  const back = codec.hydrateSquads(codec.fromSavedForm(both).externalSquads!);
  check(back[0].players[0].goals === 4, "if a blob has both forms, the thin one (with the career's changes) wins");
  check(codec.decodeSquads("garbage").length === 0 && codec.decodeSquads([["X", [42, null]]])[0].players.length === 0,
    "malformed saved squads decode to nothing rather than throwing");
  const noSquads = clone(base);
  check(canon(codec.toSavedForm(noSquads)) === canon(noSquads), "a career with no squads yet is saved exactly as it is");
}

// ── 6. Through the real storage functions ──
{
  saveCareer(career, "user-codec");
  const raw = store.get("star-career-v2::user-codec")!;
  check(!raw.includes("player-portraits/"), "localStorage never holds a photo URL the database already gives");
  const loaded = loadCareer("user-codec")!;
  const ext2 = codec.hydrateSquads(loaded.externalSquads!);
  check(ext2[0].players[0].goals === 4 && ext2[2].players.some(p => p.id === moved.id), "saveCareer/loadCareer keep goals and moved players");
  check(raw.length < JSON.stringify(career).length, "…and the stored save is smaller");
}

// ── 7. reconcileExternalSquads — the load-time refresh that used to wipe it all ──
{
  const fresh: LeagueSquad[] = [
    { club: "Real Madrid", players: fetchedExternal[0].players.slice(0, 5) },    // DB roster differs
    { club: "Barnsley", players: [fetchedPlayer("Barnsley", 0)] },                // real data arrived
    { club: "Celtic", players: [] },
    { club: "Hearts", players: fetchedExternal[4].players },                      // dissolved: must stay empty
    { club: "Brand New FC", players: [fetchedPlayer("Brand New FC", 1)] },        // missing from the save
  ];
  const current: LeagueSquad[] = [
    { club: "Real Madrid", players: madrid },
    { club: "Barnsley", players: fetchedExternal[3].players.map(p => ({ ...p, goals: p.id.endsWith(":0") ? 2 : 0 })) },
    { club: "Celtic", players: celtic },
    { club: "Hearts", players: [] },
    { club: "Owned Elsewhere", players: [fetchedPlayer("Owned Elsewhere", 2)] }, // filed by setSquad, not fetched
  ];
  const out = reconcileExternalSquads(current, fresh, c => c === "Hearts");
  const by = new Map(out.map(s => [s.club, s]));
  check(by.get("Real Madrid")!.players === madrid, "a club the career has real players for is kept as the career has it");
  check(by.get("Barnsley")!.players[0].id === fetchedPlayer("Barnsley", 0).id, "an all-invented club is upgraded when real players arrive");
  check(by.get("Celtic")!.players === celtic, "an empty fetch never empties a real roster");
  check(by.get("Hearts")!.players.length === 0, "a club emptied by a merger stays empty");
  check(by.has("Brand New FC"), "a club the save never had is added");
  check(by.has("Owned Elsewhere"), "a club only the save has is kept");

  // A failed fetch comes back all invented: nothing real may be replaced.
  const offline: LeagueSquad[] = current.map(s => ({ club: s.club, players: [generatedPlayer(s.club, 0)] }));
  const kept = reconcileExternalSquads(current, offline);
  check(kept.find(s => s.club === "Real Madrid")!.players === madrid && kept.find(s => s.club === "Celtic")!.players === celtic,
    "a failed (all-invented) fetch never replaces a real roster");
}

if (problems.length) {
  console.error("FAIL");
  for (const p of problems) console.error("  ✗ " + p);
  process.exit(1);
}
console.log("PASS — squads save thin and come back whole: goals, growth, moves, signings, invented players and emptied clubs all kept; photos refilled from the fetch");
