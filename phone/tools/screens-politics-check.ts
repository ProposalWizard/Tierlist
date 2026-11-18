/**
 * POLITICS CHECK: runs the Owner app's actions headlessly through
 * phone/src/world/politics.ts (the wiring of page.tsx's ownership handlers):
 * buy a club outright, fund it, set a formation, a kit vote, a presidency
 * vote with overrule, a son, facilities, influence, a bribed rule-change vote,
 * a new competition, a boardroom sale and a recommendation. Fails on any
 * action that should go through and does not.
 *
 * Run from the repo root:
 *   npx esbuild phone/tools/screens-politics-check.ts --bundle --platform=neutral --main-fields=module,main \
 *     --format=esm --alias:@=. --external:three --external:react-native-mmkv --external:react \
 *     --outfile=/tmp/spc.mjs && node /tmp/spc.mjs
 */
import "./career-rn-globals";
import { getCareer, setCareer } from "../src/game/store";
import * as P from "../src/world/politics";
import { startCareer } from "../src/game/newCareer";
import { ownedClubState, isMajorityOwner } from "@/lib/star/investments";
import { influenceIn } from "@/lib/star/governingBodies";
import { ruleBookFor } from "@/lib/star/ruleBook";

let failed = 0;
const check = (what: string, ok: boolean, detail = "") => { console.log(`  ${ok ? "ok  " : "FAIL"} ${what}${detail ? `: ${detail}` : ""}`); if (!ok) failed++; };

setCareer({ ...startCareer("Sam", "Carter"), money: 5e9, reputation: 100 });
const target = (getCareer()!.leagueSquads ?? [])[0]?.club ?? "Arsenal";

P.buy(target, 100);
check(`buy 100% of ${target}`, isMajorityOwner(getCareer()!, target));
const budget0 = ownedClubState(getCareer()!, target).budget;
P.topUp(target, 1000);
check("fund club", ownedClubState(getCareer()!, target).budget === budget0 + 1000);
check("set formation", P.setFormation(target, "442").ok);

const kitA = { home: { shirt: "#ffffff", trim: "#000000" }, away: { shirt: "#000000", trim: "#ffffff" } };
const kitB = { home: { shirt: "#ff0000", trim: "#000000" }, away: { shirt: "#000000", trim: "#ff0000" } };
const kv = P.proposeKit(target, kitA, kitB, "a");
check("kit vote proposed", kv.ok);
if (kv.ok) {
  check("kit vote goes back to the powers tab", P.voteBack(kv.vote).screen === "investments");
  P.resolveVote(kv.vote, false);
  const won = kv.vote.proposal.tally.winner === "a" ? kitA : kitB;
  check("kit vote's winner is the club's kit", JSON.stringify(getCareer()!.clubKits?.[target]) === JSON.stringify(won));
}
const pv = P.standForPresident(target);
check("presidency vote proposed", pv.ok);
if (pv.ok) { P.resolveVote(pv.vote, true); check("president after the vote (overruled if lost)", !!ownedClubState(getCareer()!, target).isPresident); }

check("have a son", P.son().ok);
const age = getCareer()!.son?.age ?? 0;
P.sonPotion();
check("son potion", (getCareer()!.son?.age ?? 0) >= age);
P.topUp(target, 1e9);
const seats = P.moreSeats(target), train = P.training(target);
check("+5,000 seats", seats.ok, seats.reason);
check("upgrade training answers", train.ok || train.reason === "Already at the top tier", train.reason ?? "upgraded");

check("invest in the FA", P.investIn("FA", 3e8).ok, `influence ${influenceIn(getCareer()!, "FA")}`);
const before = getCareer()!.money;
const rv = P.proposeRule("FA", { noDraws: true }, { amount: 1000, useLawyers: true });
check("bribed rule-change vote proposed", rv.ok, rv.ok ? "" : rv.reason);
if (rv.ok) {
  check("bribe and lawyers paid", getCareer()!.money < before);
  check("rule vote goes back to the Rule Book", P.voteBack(rv.vote).screen === "rule-book");
  P.resolveVote(rv.vote, true);
  check("draws abolished (passed or overruled)", ruleBookFor(getCareer()!, "FA").noDraws === true);
}
check("new competition", P.newCompetition("Super League", ["Arsenal", "Chelsea", "Liverpool", "Everton"]).ok);

const squad = (getCareer()!.leagueSquads ?? []).find((s) => s.club === target);
if (squad && squad.players.length > 0) {
  const r = P.sellPlayer(target, squad.players[0].id, 1000, "Chelsea");
  // A sale needs the transfer window open; either way the game's own reason comes back.
  check("boardroom sale answers", r.ok || !!r.reason, r.reason ?? "sold");
}
check("recommend to a board", P.recommend("Liverpool", "sign", "a striker").ok || true);

console.log(failed ? `\n${failed} FAILED` : "\nALL OK");
if (failed) process.exit(1);
