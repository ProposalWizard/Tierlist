/**
 * THE DRIVE'S EVENTS (driving phase 2, 28 Nov 2026; lib/star/drive3d/events.ts, run by drive.ts). Pure:
 *  1. seeded: the same day has the same event; about three drives in five have one; every event comes up;
 *  2. at most ONE event a drive besides a call, and its card never covers the call's (nor the call the event's);
 *  3. effects are small and real: applied through dilemmas.ts applyEffects, a fine comes off your money (a share of
 *     your weekly wage, never under £100), fans / dressing room / mood / reputation move by 1-2;
 *  4. the speed camera: slow down in time and nothing happens; don't, and you are fined; the race is seeded and a
 *     better car wins more often; a race day has the other lane clear (his car never meets anyone);
 *  5. the words: nothing left to fill in, short enough for the card, invented names only (no real brands).
 */
import { DRIVE_EVENTS, DRIVE_EVENT_IDS, pickEvent, eventOutcome, fineFor, raceWon, fillEvent, EVENT_CHANCE, CAMERA_LIMIT, type DriveEffect } from "../../lib/star/drive3d/events";
import { newDrive, stepDrive, answerEvent, answerCall, type DriveOptions } from "../../lib/star/drive3d/drive";
import { applyEffects } from "../../lib/star/dilemmas";
import { makeInitialCareer } from "../../lib/star/careerFlow";
import { PREMIER_LEAGUE_CLUBS } from "../../lib/star/clubs";
import type { StarPlayer } from "../../lib/star/types";

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };
const base: Omit<DriveOptions, "tier" | "seed"> = { leg: "in", mode: "lanes", spec: { wheelR: 0.42, wheelbase: 2.6 }, names: { mate: "Kai", car: "sports car", club: "Aston Villa" }, call: "none", handover: true, carId: "sports", wage: 24000 };

/** A whole drive on auto; `yes` answers every card yes as it opens (the camera's Slow down too). */
function run(o: Partial<DriveOptions> & { seed: number }, yes = false) {
  const S = newDrive({ ...base, tier: "medium", ...o } as DriveOptions);
  let n = 0, opens = 0, both = 0, was = S.eventState;
  while (S.phase !== "done" && S.phase !== "fork" && n < 60 * 120) {
    stepDrive(S, { hold: false }); n++;
    if (was === "waiting" && (S.eventState === "open" || S.eventState === "done")) opens++;
    if (yes && S.eventState === "open") answerEvent(S, "yes");
    if (S.callState === "ringing" && S.t - S.callSince > 1.5) answerCall(S, "no");
    const evUp = S.eventState === "open" || S.eventState === "done";
    const callUp = S.callState === "ringing" || S.callState === "answered";
    if (evUp && callUp) both++;
    was = S.eventState;
  }
  return { S, opens, both };
}

// 1. seeded, about three in five, every event comes up
{
  let n = 0; const seen = new Set<string>();
  for (let s = 0; s < 3000; s++) { const e = pickEvent(s, "in"); if (e) { n++; seen.add(e.id); } }
  check(n > 3000 * (EVENT_CHANCE - 0.06) && n < 3000 * (EVENT_CHANCE + 0.06), `about ${EVENT_CHANCE * 100}% of drives have an event (${(n / 30).toFixed(1)}%)`);
  check(DRIVE_EVENT_IDS.every((id) => seen.has(id)), `every event comes up (${Array.from(seen).join(", ")})`);
  for (const s of [1, 5, 9, 42]) check(pickEvent(s, "in")?.id === pickEvent(s, "in")?.id, `same day, same event (seed ${s})`);
  check(pickEvent(3, "in", "none") === null && pickEvent(3, "in", "rain")?.id === "rain", "an event can be forced or switched off");
}

// 2. at most one a drive; never two cards at once (with a call forced too)
{
  for (const id of DRIVE_EVENT_IDS) for (const leg of ["in", "back"] as const) {
    const { S, opens, both } = run({ seed: 11, event: id, leg, call: "agent-interest" }, true);
    check(opens <= 1, `${id} (${leg}): one card at most (${opens})`);
    check(S.effects.length <= 1, `${id} (${leg}): one effect at most (${S.effects.length})`);
    check(both === 0, `${id} (${leg}): never over the call's card (${both} steps)`);
    check(opens === 1 && S.outcome !== null, `${id} (${leg}): it plays out (${opens} opened, ${S.eventState})`);
  }
  let most = 0;
  for (let s = 0; s < 60; s++) { const { S, opens } = run({ seed: s, call: undefined }, true); most = Math.max(most, opens, S.effects.length); }
  check(most <= 1, `over 60 seeded drives, never more than one event (${most})`);
}

// 3. the effects reach the career, small
{
  const player = { firstName: "Test", lastName: "Player", age: 24, skinTone: "medium", club: "Aston Villa", clubBadge: null, position: "ST", nationality: "England", startYear: 2027 } as unknown as StarPlayer;
  const c0 = makeInitialCareer(player, [...PREMIER_LEAGUE_CLUBS], "premier");
  c0.money = 50_000;
  const wage = c0.contract.wage;
  const all: [string, DriveEffect][] = [];
  for (const ev of Object.values(DRIVE_EVENTS)) for (const answer of ["yes", "no"] as const) for (const x of [{}, { fast: true }, { won: true }, { won: false }]) {
    const o = eventOutcome(ev, { answer, wage, mate: "Kai", ...x });
    all.push([`${ev.id}/${answer}/${JSON.stringify(x)}`, o.apply]);
    check(o.line.length > 0 && o.effect.length > 0, `${ev.id}: says what happened and what it changed`);
    check(Object.keys(o.apply).length === 0 ? /Nothing changes/.test(o.effect) : !/Nothing changes/.test(o.effect), `${ev.id}/${answer}: the yellow line matches the change`);
  }
  for (const [k, e] of all) {
    for (const f of ["fans", "team", "happiness", "reputation"] as const) if (e[f] !== undefined) check(Math.abs(e[f]!) <= 2, `${k}: ${f} moves by 2 at most (${e[f]})`);
    const c1 = applyEffects(c0, e);
    if (e.money) check(c1.money === c0.money + e.money && e.money < 0 && -e.money <= Math.max(100, wage * 0.02), `${k}: the fine comes off your money and is small (${e.money} of a ${wage} week)`);
    if (e.fans) check(c1.relationships.fans === Math.min(100, c0.relationships.fans + e.fans), `${k}: fans change`);
    if (e.team) check(c1.relationships.team === Math.min(100, Math.max(0, c0.relationships.team + e.team)), `${k}: the dressing room changes`);
    if (e.reputation) check(c1.reputation === Math.min(100, c0.reputation + e.reputation), `${k}: reputation changes`);
    if (e.happiness) check(c1.happiness === Math.max(0, Math.min(100, c0.happiness + e.happiness)), `${k}: mood changes`);
  }
  check(fineFor(0) === 100 && fineFor(24000) === 360 && fineFor(24000) % 10 === 0, `a fine: 1.5% of a week, never under £100 (${fineFor(24000)})`);
}

// 4. the camera, the race
{
  const slow = run({ seed: 4, event: "speed-camera", tier: "low" }, true).S;
  check(slow.outcome?.apply.money === undefined, "slowed in time: no fine");
  const fast = run({ seed: 4, event: "speed-camera", tier: "low" }, false).S;
  check(fast.outcome?.apply.money === -fineFor(24000), `not slowed: fined (${JSON.stringify(fast.outcome?.apply)})`);
  // passing it slowed, you are under the limit
  {
    const S = newDrive({ ...base, tier: "low", seed: 4, event: "speed-camera" } as DriveOptions);
    let vAt = -1;
    for (let n = 0; n < 60 * 60 && S.phase !== "done"; n++) { stepDrive(S, { hold: true }); if (S.eventState === "open") answerEvent(S, "yes"); if (vAt < 0 && S.car.s >= S.cameraS) vAt = S.car.v; }
    check(vAt > 0 && vAt <= CAMERA_LIMIT, `slowed (even holding): past the camera at ${(vAt * 2.237).toFixed(0)} mph`);
  }
  let hatch = 0, superW = 0;
  for (let s = 0; s < 1000; s++) { if (raceWon(s, "hatch")) hatch++; if (raceWon(s, "super")) superW++; }
  check(superW > hatch + 300, `a better car wins the race more often (super ${superW / 10}%, hatch ${hatch / 10}%)`);
  check(raceWon(7, "sports") === raceWon(7, "sports"), "the race is seeded");
  for (const tier of ["low", "medium", "high"] as const) for (const leg of ["in", "back"] as const) {
    const S = newDrive({ ...base, tier, seed: 8, leg, event: "mate-race" } as DriveOptions);
    let meet = Infinity, raced = false;
    for (let n = 0; n < 60 * 90 && S.phase !== "done" && S.phase !== "fork"; n++) {
      stepDrive(S, { hold: false });
      if (S.eventState === "open" && S.raceT0 < 0) answerEvent(S, "yes");
      if (S.raceT0 >= 0) raced = true;
      if (S.mateCar) for (const c of S.traffic) if (c.dir === -1) meet = Math.min(meet, Math.abs(c.s - S.mateCar.s));
    }
    check(raced && S.outcome !== null, `${tier} ${leg}: the race happens and ends before the drive does`);
    check(meet > 12, `${tier} ${leg}: his car never meets anyone coming (${meet.toFixed(0)} m)`);
  }
}

// 5. the words
{
  const BRANDS = /\b(ford|bmw|audi|mercedes|toyota|honda|nissan|vauxhall|volkswagen|vw|kia|tesla|porsche|ferrari|nike|adidas|puma|gatso|costa|starbucks|greggs|aa|rac)\b/i;
  for (const ev of Object.values(DRIVE_EVENTS)) {
    const f = fillEvent(ev, "Kai");
    const words = [f.title, ...f.lines, f.yes ?? "", f.no ?? ""];
    for (const answer of ["yes", "no"] as const) for (const x of [{ fast: true }, { won: true }, { won: false }, {}]) { const o = eventOutcome(ev, { answer, wage: 24000, mate: "Kai", ...x }); words.push(o.line, o.effect); }
    const all = words.join(" ");
    check(!/[{}]|TODO|lorem|placeholder|xxx/i.test(all), `${ev.id}: nothing left to fill in`);
    check(!BRANDS.test(all), `${ev.id}: no real brand (${all.match(BRANDS)?.[0]})`);
    check(f.lines.length >= 1 && f.lines.length <= 3 && f.lines.every((l) => l.length <= 70), `${ev.id}: one to three short lines`);
    check((f.yes ?? "").length <= 22 && (f.no ?? "").length <= 22, `${ev.id}: answers fit a button`);
    check(ev.kind !== "choice" || (!!ev.yes && !!ev.no), `${ev.id}: a choice has two answers`);
  }
}

if (problems.length) { console.error(`driveEvents: ${problems.length} problem(s)\n - ${problems.join("\n - ")}`); process.exit(1); }
console.log("driveEvents: all checks passed");
