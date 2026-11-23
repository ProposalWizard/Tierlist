/**
 * SPEED FIX 1 (20 Nov 2026): the team sheet colours the match's 3D players in
 * the SAME four kits the match draws (CanvasMatch's kitsRef / ourKeeperKitRef
 * and its own warmSpriteKits call), so kick off finds every one ready and the
 * picture is the same. lib/star/matchSpriteWarm.ts.
 */
import { matchSpriteKits } from "../../lib/star/matchSpriteWarm";
import { kitsFor, keeperKit } from "../../lib/star/kits";
import type { CareerState, Fixture } from "../../lib/star/types";

const problems: string[] = [];
const career = { player: { club: "Arsenal" }, clubKits: {} } as unknown as CareerState;
for (const home of [true, false]) {
  for (const opp of ["Manchester City", "Chelsea", "Wolverhampton Wanderers", "Fulham"]) {
    const fixture = { home, opponent: opp, week: 1 } as unknown as Fixture;
    // exactly as CanvasMatch builds them
    const k = home ? kitsFor("Arsenal", opp) : kitsFor(opp, "Arsenal");
    const ours = home ? k.home : k.away, theirs = home ? k.away : k.home;
    const sk = (x: { shirt: string; trim: string }) => ({ shirt: x.shirt, shorts: x.trim, socks: x.shirt });
    const want = [sk(ours), sk(theirs), sk(k.keeper), sk(keeperKit(ours.shirt, k.keeper.shirt))];
    const got = matchSpriteKits(career, fixture);
    if (JSON.stringify(got) !== JSON.stringify(want)) problems.push(`${home ? "home" : "away"} v ${opp}: ${JSON.stringify(got)} != ${JSON.stringify(want)}`);
  }
}
if (problems.length) { console.error("FAIL matchSpriteWarm\n  " + problems.join("\n  ")); process.exit(1); }
console.log("ok matchSpriteWarm — the team sheet colours the same four kits the match draws");
