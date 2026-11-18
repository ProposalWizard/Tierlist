/**
 * DATA CHECK: does a phone career get REAL players, the same ones the packed
 * Android app gets? Headless (no phone, no React).
 *
 *   1. The phone's answers (src/data/offline.ts) against the packed app's
 *      (lib/app/offline.ts rules, read straight from mobile/packed/): squads,
 *      a roster, every settings route, the two tables, "no account".
 *   2. A new career through the phone's flow (profile → trial → signing):
 *      your squad, every club in your division and the wider world are real
 *      named players, built by the same lib/star functions from the same rows.
 *   3. A Premier League signing (Arsenal): the known names are there.
 *   4. Pictures: every real photo in those squads has a packed copy in the app.
 *
 * Run (repo root; the packed files must be in place: node phone/scripts/data-pack.js):
 *   npx esbuild phone/tools/data-check.ts --bundle --platform=node --alias:@=. \
 *     --loader:.webp=empty --loader:.png=empty --external:react-native-mmkv --external:react-native \
 *     --outfile=/tmp/dc.cjs --log-level=warning && node /tmp/dc.cjs
 */
import "./career-rn-globals";
import fs from "node:fs";
import path from "node:path";
import type { CareerState, StarPlayer } from "@/lib/star/types";
import * as flow from "../src/game/flow";
import { getCareer } from "../src/game/store";
import { afterSigning, afterNewCareer, keepSquadsInStep } from "../src/game/squads";
import { answerPacked } from "../src/data/offline";
import { packedData } from "../src/data/packed";
import { buildSquadFromRoster, type RosterPlayer } from "@/lib/star/realSquad";
import { buildLeagueSquad } from "@/lib/star/leagueSquads";
import { clubsForDivision } from "@/lib/star/scoutOffers";
import { trialComplete } from "@/lib/star/trial";
import { PREMIER_LEAGUE_CLUBS } from "@/lib/star/clubs";
import { fetchXpConfig } from "@/lib/star/xpStore";
import { mergeXpConfig } from "@/lib/star/xpConfig";
import { STAR_FIFA_YEAR } from "@/lib/star/edition";

let fails = 0;
const ok = (cond: boolean, what: string) => { console.log(`${cond ? "PASS" : "FAIL"}  ${what}`); if (!cond) fails++; };
const settle = () => new Promise((r) => setTimeout(r, 30));

// The packed app's own files, read directly (what lib/app/offline.ts serves).
const REPO = path.resolve(__dirname.includes("/tmp") ? process.cwd() : path.join(__dirname, "../.."));
const PACKED = [process.env.KIB_PACKED_DIR, path.join(REPO, "mobile/packed"), "/home/user/Tierlist/mobile/packed"]
  .filter(Boolean).find((d) => fs.existsSync(path.join(d!, "index.json")))!;
if (!PACKED) { console.log("FAIL  no mobile/packed/ to compare with (set KIB_PACKED_DIR)"); process.exit(1); }
const index = JSON.parse(fs.readFileSync(path.join(PACKED, "index.json"), "utf8"));
const file = (p: string) => JSON.parse(fs.readFileSync(path.join(PACKED, p.replace(/^\/packed\//, "")), "utf8"));
const ALL = file(index.squads) as Record<string, RosterRowLike[]>;
interface RosterRowLike { id: string; name: string; image?: string | null }

async function body(r: Response | null): Promise<unknown> { return r ? r.json() : null; }
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

async function main() {
  // ═══ 1. Same answers as the packed app ═══
  const data = packedData();
  ok(!!data && data.packedAt === index.packedAt, `phone has the packed data (${data?.packedAt ?? "none"}; packed app ${index.packedAt})`);
  ok(data?.year === STAR_FIFA_YEAR, `edition ${data?.year} = the game's ${STAR_FIFA_YEAR}`);

  const clubs = ["Arsenal", "Manchester City", "Hampton & Richmond Borough", "Nowhere FC"];
  const squadsAns = await body(answerPacked(`/api/star/league-squads?clubs=${encodeURIComponent(clubs.join("|"))}&year=${index.year}`));
  const squadsWant = { year: index.year, squads: Object.fromEntries(clubs.map((c) => [c, ALL[c] ?? []])), found: Object.fromEntries(clubs.map((c) => [c, (ALL[c] ?? []).length])) };
  ok(same(squadsAns, squadsWant), "/api/star/league-squads: same answer as the packed app");
  const rosterClub = "Arsenal";
  ok(same(await body(answerPacked(`/api/draft/roster?club=${encodeURIComponent(rosterClub)}&year=${index.year}`)), file(index.rosters[rosterClub])), "/api/draft/roster (Arsenal): same answer");
  ok(answerPacked("/api/draft/roster?club=Nowhere%20FC")?.status === 404, "/api/draft/roster for an unknown club: 404, as the packed app");
  for (const [route, f] of Object.entries(index.routes as Record<string, string>)) {
    ok(same(await body(answerPacked(route)), file(f)), `${route}: same answer`);
  }
  for (const [table, f] of Object.entries(index.supabase as Record<string, string>)) {
    ok(same(await body(answerPacked(`https://cagkgfketucousksgtbk.supabase.co/rest/v1/${table}?select=*`)), file(f)), `table ${table}: same answer`);
  }
  ok(answerPacked("/api/star/career?slot=1")?.status === 404, "online save: \"no account\"");
  ok(answerPacked("/api/star/hall-of-fame")?.status === 503, "other /api/ asks: not available, at once");
  ok(answerPacked("https://example.com/x") === null, "other addresses: left to the network");
  // The game's own call goes through the installed fetch.
  const viaFetch = await (await fetch("/api/star/league-squads?clubs=Arsenal")).json() as { squads: Record<string, unknown[]> };
  ok(viaFetch.squads.Arsenal?.length === ALL.Arsenal.length, `fetch("/api/…") inside the app is answered (${viaFetch.squads.Arsenal?.length} Arsenal rows)`);

  // ═══ 2. A new career through the phone's flow ═══
  const player = {
    firstName: "Test", lastName: "Striker", age: 16, skinTone: "tan", club: "", clubBadge: null,
    position: "ST", nationality: "England", startYear: 2026, preferredNumber: 9, preferredFoot: "right",
  } as unknown as StarPlayer;
  flow.beginCareer(player, "premier", 12345);
  for (const st of flow.trialStages(getCareer()!)) flow.simulateTrialStage(st);
  ok(trialComplete(getCareer()!.trial!), "trial complete");
  let step = flow.afterTrial();
  if (step.screen === "career-manager-talk") step = flow.acceptManagerOffer();
  else { const o = flow.offersWithAgreedTerms(getCareer()!, flow.offersForTrial(getCareer()!)); if (o[0]) step = flow.signTrialOffer(o[0]); }
  for (let i = 0; i < 10; i++) await settle();
  const c = getCareer()!;
  ok(!!c.player.club && step.screen === "career-signed", `signed for ${c.player.club} (${c.division})`);
  checkCareer(c, "new career");

  // ═══ 3. A Premier League club: known names ═══
  const offer = flow.offersForTrial(c)[0];
  flow.beginCareer(player, "premier", 777);
  for (const st of flow.trialStages(getCareer()!)) flow.simulateTrialStage(st);
  flow.signTrialOffer({ ...offer, club: "Arsenal", division: "premier" });
  for (let i = 0; i < 10; i++) await settle();
  const a = getCareer()!;
  ok(a.player.club === "Arsenal" || a.placement?.kind === "loan", `signed for ${a.player.club}${a.placement?.kind === "loan" ? " (a loan)" : ""}`);
  if (a.player.club === "Arsenal") {
    const names = new Set(a.squad.map((p) => p.name));
    for (const n of ["Bukayo Saka", "Declan Rice", "William Saliba", "Martin Ødegaard", "David Raya"]) ok(names.has(n), `Arsenal squad has ${n}`);
    checkCareer(a, "Arsenal career");
  } else {
    // A loan sends you elsewhere: ask for Arsenal's room directly through the same entry point.
    await afterSigning("Arsenal", [...PREMIER_LEAGUE_CLUBS]);
  }
  const city = a.leagueSquads?.find((s) => s.club === "Manchester City") ?? a.externalSquads?.find((s) => s.club === "Manchester City");
  ok(!!city?.players.some((p) => p.name === "Erling Haaland"), "Manchester City (in the world) has Erling Haaland");
  ok((a.freeAgents?.length ?? 0) === (ALL["Free Agents"] ?? []).length && !!a.freeAgents?.some((p) => p.name === "Karim Benzema"), `free agents: ${a.freeAgents?.length} (packed ${(ALL["Free Agents"] ?? []).length}), Karim Benzema among them`);
  const xpRoute = file(index.routes["/api/star/xp-config"]) as { config: unknown };
  const xp = await fetchXpConfig();
  ok(same(xp.config, xpRoute.config ? mergeXpConfig(xpRoute.config) : null), `XP Book as packed (${xpRoute.config ? "the shared row" : "none shared: the code's own amounts"})`);
  void afterNewCareer; void keepSquadsInStep;

  // ═══ 4. Pictures ═══
  const gen = fs.readFileSync(path.join(REPO, "phone/src/data/generated/packedImages.js"), "utf8");
  const packedUrls = new Set([...gen.matchAll(/^ {2}("[^"]+"): require\(("[^"]+")\)/gm)].map((m) => JSON.parse(m[1]) as string));
  const files = [...gen.matchAll(/require\("([^"]+)"\)/g)].map((m) => path.resolve(REPO, "phone/src/data/generated", m[1]));
  ok(files.every((f) => fs.existsSync(f)), `${files.length} packed pictures, every file in phone/assets/packed`);
  const photos = [
    ...a.squad.map((p) => p.imageUrl),
    ...[...(a.leagueSquads ?? []), ...(a.externalSquads ?? [])].flatMap((s) => s.players.map((p) => p.image)),
  ].filter((u): u is string => !!u && /^https:/.test(u));
  const have = photos.filter((u) => packedUrls.has(u)).length;
  const packedAppHas = photos.filter((u) => index.images[u]).length;
  ok(have === packedAppHas, `real photos in the Arsenal career's world: ${have}/${photos.length} packed in the phone app (packed app: ${packedAppHas})`);

  console.log(fails ? `\n${fails} FAILED` : "\nall passed");
  process.exit(fails ? 1 : 0);
}

/** Your squad and the division's: real rows, the same players the packed app builds from the same rows. */
function checkCareer(c: CareerState, label: string) {
  const club = c.player.club;
  const roster = file(index.rosters[club] ?? "") as { roster?: RosterPlayer[] } | null;
  const rows = roster?.roster ?? [];
  if (rows.length) {
    const want = buildSquadFromRoster(rows, club).map((p) => p.sofifaId).sort();
    const got = c.squad.map((p) => p.sofifaId).sort();
    ok(same(want, got), `${label}: your squad = the packed app's ${club} (${got.length} real players, e.g. ${c.squad.slice(0, 3).map((p) => p.name).join(", ")})`);
  } else {
    ok(c.squad.length > 0, `${label}: ${club} has no real roster packed (the packed app shows invented players too): ${c.squad.length} players`);
  }
  const division = c.league.map((t) => t.name);
  ok(same(division.slice().sort(), [...new Set((c.leagueSquads ?? []).map((s) => s.club))].filter((x) => division.includes(x)).sort()), `${label}: every one of the ${division.length} clubs in the division has a squad`);
  let real = 0, invented = 0, mismatch = 0;
  for (const s of c.leagueSquads ?? []) {
    const packedRows = ALL[s.club] ?? [];
    if (!packedRows.length) { invented++; continue; }
    real++;
    if (s.club === club) continue; // your own club also carries its full roster (keepAll)
    const want = buildLeagueSquad(s.club, packedRows as never).players.map((p) => p.id).sort();
    if (!same(want, s.players.map((p) => p.id).sort())) mismatch++;
  }
  ok(mismatch === 0, `${label}: ${real} division clubs on real players, the packed app's same players; ${invented} with none packed (invented there too)`);
  const ext = c.externalSquads ?? [];
  const extReal = ext.filter((s) => s.players.some((p) => !p.id.startsWith("gen:"))).length;
  ok(ext.length > 0 && extReal === ext.filter((s) => (ALL[s.club] ?? []).length).length, `${label}: the wider world, ${extReal}/${ext.length} clubs on real players (every club the packed app has)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
