const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v); },
  removeItem: (k: string) => { store.delete(k); }, clear: () => store.clear(),
};
import { makeInitialCareer } from "../../lib/star/careerFlow";
import { setPieceTalkDue, markSetPieceTold } from "../../lib/star/setPieceTalk";
import { newsForMatch, signingNews } from "../../lib/star/breakingNews";
import { PREMIER_LEAGUE_CLUBS } from "../../lib/star/clubs";
import type { CareerState, StarPlayer } from "../../lib/star/types";

/** v0.23: the manager's set-piece chat (once, after a first match) and the breaking-news pop-up. */
const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };
const player = { firstName: "Harry", lastName: "Vale", age: 18, skinTone: "light", club: "Liverpool", clubBadge: null,
  position: "ST", nationality: "England", startYear: 2027 } as StarPlayer;
const fresh = (): CareerState => makeInitialCareer(player, [...PREMIER_LEAGUE_CLUBS], "premier");

{
  const c = fresh();
  c.skills = { ...c.skills, freeKick: 99 };
  check(setPieceTalkDue(c) === null, "no chat before the first match");
  const played = { ...c, fixtures: c.fixtures.map((f, i) => (i === 0 ? { ...f, played: true } : f)), status: "1st Team" as CareerState["status"] };
  const talk = setPieceTalkDue(played);
  check(!!talk && talk.duties.length >= 1 && talk.lines.length === 3, "after a first match a 3-line chat is due");
  if (talk) {
    const told = markSetPieceTold(played, talk.duties);
    check(setPieceTalkDue(told) === null, "once told, never again");
  }
}
{
  // P86: both duties at once are TWO chats at two moments, never one.
  const c = fresh();
  c.skills = { ...c.skills, freeKick: 99 };
  const one = { ...c, fixtures: c.fixtures.map((f, i) => (i === 0 ? { ...f, played: true } : f)), status: "1st Team" as CareerState["status"] };
  const t1 = setPieceTalkDue(one);
  check(!!t1 && t1.duties.length === 1 && t1.duties[0] === "penalties", "the penalty chat comes first, on its own");
  const afterPen = markSetPieceTold(one, ["penalties"]);
  check(setPieceTalkDue(afterPen) === null, "the free-kick chat does not follow straight away");
  const two = { ...afterPen, fixtures: afterPen.fixtures.map((f, i) => (i <= 1 ? { ...f, played: true } : f)) };
  const t2 = setPieceTalkDue(two);
  check(!!t2 && t2.duties.length === 1 && t2.duties[0] === "freeKicks", "the free-kick chat comes after the next match, on its own");
  check(!!t2 && !t2.lines.join(" ").includes("penalty"), "and does not mention penalties");
  check(setPieceTalkDue(markSetPieceTold(two, ["freeKicks"])) === null, "then nothing more");
}
{
  const before = fresh(), after = { ...before, careerStats: { ...before.careerStats, goals: 1 } } as CareerState;
  const fx = before.fixtures[0];
  check(newsForMatch(before, after, fx, null).length === 1, "a first goal makes one piece of news");
  check(newsForMatch(after, after, fx, null).length === 0, "the second goal does not");
  const n = signingNews(before, "Brentford");
  check(n.headline.includes("SIGNS FOR") && n.headline.startsWith("YOUNGSTER"), "an 18-year-old signs as a youngster");
}
if (problems.length) { console.log("FAIL"); problems.forEach(p => console.log("  ✗ " + p)); process.exit(1); }
console.log("PASS — set-piece chat and breaking news");
