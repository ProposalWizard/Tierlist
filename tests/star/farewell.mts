import { previewCareer, PREVIEW_SHAPES } from "../../lib/star/retirementPreview";
import {
  farewellSides, farewellCareer, farewellFixture, farewellRecordFrom, farewellSkipped, farewellDuties,
  yourMatesPool, rivalsPool, titleRivals, ballonDorRivals, farewellTeamName, farewellFormationFor,
  YOU_ID, RIVALS_XI, FAREWELL_OFF_AT,
} from "../../lib/star/farewell";
import { matchdayFor, opponentStartingXI, startingTeammateRoles } from "../../lib/star/teamsheet";
import { formationOf } from "../../lib/star/formations";
import { makeInitialCareer } from "../../lib/star/careerFlow";
import { PREMIER_LEAGUE_CLUBS } from "../../lib/star/clubs";
import { newMatch, advanceUntilInvolved, resolveScenario, FAREWELL_INVOLVEMENT, type HiddenMatchInputs } from "../../lib/star/hiddenMatch";
import { mulberry32 } from "../../lib/star/season";
import { GUARD, youZAt, startZ, lineZ, clapGap, walkProgress, waveWeight, lineLength, clappers } from "../../lib/star/guardOfHonour";
import type { CareerState, MatchStats, StarPlayer } from "../../lib/star/types";

/**
 * THE FAREWELL MATCH (Leo, 6 Oct 2026): one last game after the final
 * whistle. Your XI (your best team-mates from every club) against the Rivals
 * XI (the clubs that beat you to titles, the men who beat you to Ballon
 * d'Ors). See lib/star/farewell.ts.
 */
const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// ── 1. Both sides, for every kind of career ────────────────────────────────
for (const { id } of PREVIEW_SHAPES) {
  for (const seed of [1, 2, 3]) {
    const tag = `${id}#${seed}`;
    const c = previewCareer(id, seed, { upTo: 20 });
    const s = farewellSides(c);
    const ours = s.ours.lineup.xi;
    const theirs = s.rivals.lineup.xi;
    check(ours.filter(Boolean).length === 11, `${tag}: Your XI has eleven (${ours.filter(Boolean).length})`);
    check(theirs.filter(Boolean).length === 11, `${tag}: the Rivals XI has eleven (${theirs.filter(Boolean).length})`);
    check(ours.filter(x => x === YOU_ID).length === 1, `${tag}: you are in your XI, once`);
    // You stand in your own position's slot.
    const f = formationOf(s.ours.lineup.formation);
    const at = ours.indexOf(YOU_ID);
    check(f.slots[at]?.role === c.player.position, `${tag}: you play your own position (${f.slots[at]?.role} v ${c.player.position})`);
    check(f.id === farewellFormationFor(c.player.position as never), `${tag}: in a shape that has your position`);
    // A keeper in each side.
    const gkOurs = ours.some(x => s.ours.players.find(p => p.id === x)?.position === "GK");
    const gkTheirs = theirs.some(x => s.rivals.players.find(p => p.id === x)?.position === "GK");
    check(gkOurs && gkTheirs, `${tag}: both sides have a keeper (${gkOurs}, ${gkTheirs})`);
    // Nobody on both sides.
    const ourNames = new Set(s.ours.players.map(p => norm(p.name)));
    check(s.rivals.players.every(p => !ourNames.has(norm(p.name))), `${tag}: nobody plays for both sides`);
    check(!s.rivals.players.some(p => norm(p.name) === norm(`${c.player.firstName} ${c.player.lastName}`)), `${tag}: you are not a rival of yourself`);
    // Every man who beat you to a Ballon d'Or starts for the rivals (up to eleven).
    const bdo = ballonDorRivals(c);
    const starters = new Set(theirs.map(x => norm(s.rivals.who.find(r => r.id === x)?.name ?? "")));
    const missing = bdo.slice(0, 5).filter(b => !starters.has(norm(b.name)));
    check(missing.length === 0, `${tag}: the Ballon d'Or winners start (${missing.map(m => m.name).join(", ")} left out)`);
    // A real game: within six either way.
    check(Math.abs(s.ours.strength - s.rivals.strength) <= 6, `${tag}: the sides are within six (${s.ours.strength} v ${s.rivals.strength})`);
    // Deterministic.
    check(JSON.stringify(farewellSides(c)) === JSON.stringify(s), `${tag}: the same career gives the same sides`);
    // The longest together are in: the most seasons of any team-mate makes the XI or the bench.
    const pool = yourMatesPool(c);
    const longest = [...pool].sort((a, b) => b.seasons - a.seasons)[0];
    const squadNames = new Set(s.ours.players.map(p => p.name));
    check(!longest || squadNames.has(longest.name), `${tag}: the team-mate you played with longest is in the squad (${longest?.name}, ${longest?.seasons} seasons)`);
  }
}

// ── 2. Why the rivals are there ─────────────────────────────────────────────
{
  const c = previewCareer("journeyman", 1, { upTo: 20 });
  const titles = titleRivals(c);
  check(titles.length > 0, "a career that won little has clubs that beat it to titles");
  check(titles.every(t => /^Won the /.test(t.why)), `each says what it won (${titles[0]?.why})`);
  const mine = new Set((c.seasonHistory ?? []).map(r => r.club));
  const firstMine = titles.findIndex(t => mine.has(t.club));
  check(firstMine === -1 || titles.slice(firstMine).every(t => mine.has(t.club)), "your own old clubs rank behind the real rivals");
  const legend = previewCareer("legend", 1, { upTo: 20 });
  const won = (legend.seasonHistory ?? []).filter(r => r.ballonDor?.yourRank === 1).map(r => r.season);
  check(ballonDorRivals(legend).every(b => b.seasons.every(sn => !won.includes(sn))), "a Ballon d'Or you won is nobody's rival entry");
}

// ── 3. Thin careers still get a match ───────────────────────────────────────
{
  // No history at all (a career from before 6 Oct 2026, no squads held).
  const c = makeInitialCareer({ firstName: "Old", lastName: "Save", age: 35, position: "ST", club: "Arsenal", nationality: "England" } as StarPlayer, [...PREMIER_LEAGUE_CLUBS]);
  const bare: CareerState = { ...c, seasonHistory: [], leagueSquads: [], externalSquads: [] };
  const s = farewellSides(bare);
  check(s.ours.lineup.xi.filter(Boolean).length === 11, `a career with no history still fields eleven (${s.ours.lineup.xi.filter(Boolean).length})`);
  check(s.rivals.lineup.xi.filter(Boolean).length === 11, `and so do its rivals (${s.rivals.lineup.xi.filter(Boolean).length})`);
  check(rivalsPool(bare, new Set()).length >= 11, "made-up rivals when nobody is held");
  check(s.ours.name === "Save XI" && farewellTeamName(bare) === "Save XI", `your side carries your name (${s.ours.name})`);
}

// ── 4. The stand-in career plays the real match: team sheets and casting ───
{
  const c = previewCareer("oneClub", 2, { upTo: 20 });
  const s = farewellSides(c);
  const fc = farewellCareer(c, s);
  const fx = farewellFixture(c, s);
  check(fx.opponent === RIVALS_XI && fx.home === true && fx.kind === "league", "at your ground, against the Rivals XI, no extra time");
  check(fc.player.club === s.ours.name && fc.energy === 100 && fc.injury === null, "a stand-in: your side's name, fresh legs, no injury");
  check(fc.player.firstName === c.player.firstName && fc.skills.power === c.skills.power, "and still you: your name, your skills");
  check(c.player.club !== fc.player.club && c.squad !== fc.squad, "the real career is never touched");
  const md = matchdayFor(fc, fx, true, undefined, s.ours.lineup.bench, { formation: formationOf(s.ours.lineup.formation), xi: s.ours.lineup.xi });
  const mine = md.home.yours ? md.home : md.away;
  const them = md.home.yours ? md.away : md.home;
  check(mine.xi.length === 11 && them.xi.length === 11, `the team sheets show 11 v 11 (${mine.xi.length} v ${them.xi.length})`);
  check(mine.xi.filter(p => p.isYou).length === 1, "you are on your sheet, once");
  check(mine.club === s.ours.name && them.club === RIVALS_XI, `named ${mine.club} v ${them.club}`);
  const theirsXI = opponentStartingXI(fc, fx);
  check(!!theirsXI && theirsXI.length === 11, "the match can name the Rivals XI's scorers (their eleven are known)");
  const roles = startingTeammateRoles(fc, fx);
  check(!!roles && roles.size === 10, `ten team-mates to cast in your chances (${roles?.size})`);
  check(Array.from(roles?.keys() ?? []).every(id => fc.squad.some(p => p.id === id)), "every one of them is in the stand-in squad");
  const kits = fc.clubKits ?? {};
  check(!!kits[s.ours.name] && !!kits[RIVALS_XI], "both sides have a kit");
  const d = farewellDuties();
  check(d.penalties && d.freeKicks, "every set piece is yours");
}

// ── 5. What the career keeps ────────────────────────────────────────────────
{
  const c = previewCareer("legend", 1, { upTo: 20 });
  const s = farewellSides(c);
  const stats = { goals: 2, assists: 1, rating: 8.66, homeScore: 4, awayScore: 3 } as MatchStats;
  const r = farewellRecordFrom(stats, s);
  check(r.played && r.yourScore === 4 && r.theirScore === 3 && r.goals === 2 && r.assists === 1, `the score and your afternoon (${r.yourScore}-${r.theirScore}, ${r.goals})`);
  check(r.rating === 8.7 && r.offAt === FAREWELL_OFF_AT, `rounded rating, off at ${FAREWELL_OFF_AT}' (${r.rating})`);
  check(r.club === c.player.club && r.team === s.ours.name && r.opponent === RIVALS_XI, "who put it on, and who played");
  const sk = farewellSkipped(c);
  check(!sk.played && sk.yourScore === undefined, "skipping keeps no score");
}

// ── 6. The hidden match: every chance is yours ──────────────────────────────
{
  const play = (inputs: HiddenMatchInputs, seed: number) => {
    const rng = mulberry32(seed);
    const st = newMatch(rng);
    let mine = 0, mates = 0;
    while (st.minute < FAREWELL_OFF_AT) {
      const step = advanceUntilInvolved(st, inputs, rng, FAREWELL_OFF_AT);
      mates += step.events.filter(e => e.teammateGoal).length;
      if (!step.request) break;
      mine++;
      resolveScenario(st, "saved");
    }
    return { mine, mates };
  };
  const base: HiddenMatchInputs = { teamStrength: 78, oppStrength: 82, playerSkill: 70 };
  let nm = 0, nt = 0, fm = 0, ft = 0;
  const N = 300;
  for (let i = 0; i < N; i++) {
    const a = play(base, 11 + i * 7919);
    const b = play({ ...base, farewell: true }, 11 + i * 7919);
    nm += a.mine; nt += a.mates; fm += b.mine; ft += b.mates;
  }
  check(fm / N > (nm / N) * 1.15, `more chances come to you in the farewell (${(nm / N).toFixed(1)} → ${(fm / N).toFixed(1)} by ${FAREWELL_OFF_AT}')`);
  check(ft / N < (nt / N) * 0.3, `team-mates hardly score without you (${(nt / N).toFixed(2)} → ${(ft / N).toFixed(2)} goals)`);
  check(FAREWELL_INVOLVEMENT > 0.9 && FAREWELL_INVOLVEMENT < 1, "nearly every chance, not every one");
}

// ── 7. The guard of honour's timeline ───────────────────────────────────────
{
  const n = lineLength("medium");
  check(lineLength("low") < lineLength("medium") && lineLength("medium") < lineLength("high"), "a longer line on a stronger phone");
  check(clappers("low") <= lineLength("low") && clappers("high") === lineLength("high"), "everyone claps on High; fewer on Low");
  check(startZ(n) < lineZ(n - 1), "you start beyond the far pair");
  check(Math.abs(youZAt(0, n) - startZ(n)) < 1e-9 && Math.abs(youZAt(GUARD.end, n) - GUARD.stopZ) < 1e-9, "you walk from the tunnel to just past the last pair");
  let prev = -Infinity, monotone = true;
  for (let t = 0; t <= GUARD.end; t += 0.05) { const z = youZAt(t, n); if (z < prev - 1e-9) monotone = false; prev = z; }
  check(monotone, "always forwards, never back");
  check(walkProgress(GUARD.walkTo) === 1 && waveWeight(GUARD.walkFrom) === 0 && waveWeight(GUARD.end) === 1, "the wave comes after the walk");
  let lo = Infinity, hi = -Infinity;
  for (let t = 0; t < 3; t += 0.01) { const g = clapGap(t, 0.7); lo = Math.min(lo, g); hi = Math.max(hi, g); }
  check(lo < 0.03 && hi > 0.12 && hi < 0.2, `a clap: hands meet, then part a hand's width (${lo.toFixed(3)}–${hi.toFixed(3)} m)`);
}

if (problems.length) { console.error("farewell FAILED:\n  - " + problems.join("\n  - ")); process.exit(1); }
console.log("farewell: all checks passed");
