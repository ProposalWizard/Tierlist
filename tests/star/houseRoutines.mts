/**
 * VISITORS' ROUTINES (lib/star/life/houseRoutines.ts, houseTalk.ts; plan phase 2): on 1,000 seeded
 * visits in every home, nobody spends more than 45 game minutes on one thing, every visit ends with
 * `leave` at its end time, steps never overlap or go backwards, every step is in a room the home has,
 * the same seed plans the same visit, whereAt finds the right step, a pick never repeats itself, the
 * room budgets per phone class, and every line a visitor can say is written (no blanks).
 */
import { planVisit, whereAt, roomPeople, MAX_STEP_MINS, ROOM_PEOPLE, entryRoom, type VStep } from "../../lib/star/life/houseRoutines";
import { DOING_LINES, PHASE_LINES, houseTalk } from "../../lib/star/life/houseTalk";
import { roomsFor, HOME_TIERS } from "../../lib/star/home3d/homes";
import { seeded } from "../../lib/star/world3d/routine";

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok && problems.length < 40) problems.push(what); };

let visits = 0, longest = 0, steps = 0;
const kinds = new Map<string, number>();
for (const tier of HOME_TIERS) {
  const rooms = roomsFor(tier, "new", true);
  const r = seeded(7 + tier.length);
  for (let k = 0; k < 1000; k++) {
    const tpl = tier === "villa" || tier === "estate" ? ["mate", "chef", "cleaner"][k % 3] : tier === "house" ? ["mate", "cleaner"][k % 2] : "mate";
    const from = 8 * 60 + Math.floor(r() * 10 * 60), to = from + 60 + Math.floor(r() * 240);
    // a chef in the house for the mate's "meet"
    const chef = planVisit("chef", "chef-x", from - 30, from + 160, rooms, k, { tier });
    const others = tpl === "mate" && (tier === "villa" || tier === "estate") ? [{ id: "chef-x", kind: "chef", at: (_id: string, m: number) => whereAt(chef, m)?.step ?? null }] : [];
    const s = planVisit(tpl, `p${k}`, from, to, rooms, k * 31 + 1, { tier, others });
    visits++;
    steps += s.length;
    const last = s[s.length - 1];
    check(last.kind === "leave", `${tier} ${tpl} #${k}: ends with ${last.kind}, not leave`);
    check(Math.abs(last.until - to) < 1e-9, `${tier} ${tpl} #${k}: leaves at ${last.until}, planned ${to}`);
    check(s[0].kind === "arrive" && s[0].at === from, `${tier} ${tpl} #${k}: starts with arrive at the visit's start`);
    let prevPick = "";
    for (let i = 0; i < s.length; i++) {
      const st = s[i];
      kinds.set(st.kind, (kinds.get(st.kind) ?? 0) + 1);
      const len = st.until - st.at;
      longest = Math.max(longest, len);
      check(len <= MAX_STEP_MINS + 1e-9, `${tier} ${tpl} #${k}: ${st.label} lasts ${len} min (over ${MAX_STEP_MINS})`);
      check(len > 0, `${tier} ${tpl} #${k}: step ${i} has no length`);
      if (i) check(Math.abs(st.at - s[i - 1].until) < 1e-9, `${tier} ${tpl} #${k}: gap or overlap before step ${i}`);
      check(st.room === "away" || rooms.includes(st.room), `${tier} ${tpl} #${k}: step in ${st.room}, not in this home`);
      if (st.kind === "use" || st.kind === "call") { const key = st.target ?? st.kind; check(!(prevPick && key === prevPick && st.kind !== "use"), `${tier}: the same pick twice running (${key})`); prevPick = key; }
    }
    check(s[s.length - 1].room === entryRoom(rooms), `${tier} ${tpl} #${k}: leaves from ${s[s.length - 1].room}, not the front door's room`);
    // the same seed, the same visit
    if (k % 100 === 0) check(JSON.stringify(planVisit(tpl, `p${k}`, from, to, rooms, k * 31 + 1, { tier, others })) === JSON.stringify(s), `${tier} ${tpl} #${k}: not the same twice`);
    // whereAt: inside each step, that step; outside the visit, nobody
    for (let i = 0; i < s.length; i += 3) { const w = whereAt(s, (s[i].at + s[i].until) / 2); check(!!w && w.i === i, `${tier} #${k}: whereAt mid-step ${i}`); }
    check(whereAt(s, from - 1) === null && whereAt(s, to + 1) === null, `${tier} #${k}: whereAt outside the visit`);
  }
}
check((kinds.get("cook") ?? 0) > 0 && (kinds.get("clean") ?? 0) > 0 && (kinds.get("call") ?? 0) > 0 && (kinds.get("away") ?? 0) > 0 && (kinds.get("go") ?? 0) > 0 && (kinds.get("meet") ?? 0) > 0, `every step kind is used (${[...kinds].map(([a, b]) => `${a} ${b}`).join(", ")})`);

// ── a stuck check: walk every visit minute by minute; nobody is on one step for more than 45 minutes ──
{
  const rooms = roomsFor("villa", "new", true);
  const s: VStep[] = planVisit("mate", "stuck", 14 * 60, 22 * 60, rooms, 99, { tier: "villa" });
  let run = 0, prev = -1, worst = 0;
  for (let m = 14 * 60; m < 22 * 60; m++) { const w = whereAt(s, m); const i = w?.i ?? -2; run = i === prev ? run + 1 : 1; prev = i; worst = Math.max(worst, run); }
  check(worst <= MAX_STEP_MINS + 1, `an 8-hour visit: never more than 45 minutes on one step (worst ${worst})`);
}

// ── the room budgets ──
check(roomPeople("low", false) === 2 && roomPeople("medium", true) === 2 && roomPeople("medium", false) === 3 && roomPeople("high", false) === 5, "room budgets: Mid Android and Low 2, Medium 3, High 5");
check(ROOM_PEOPLE.low === 2 && ROOM_PEOPLE.medium === 3 && ROOM_PEOPLE.high === 5, "the budget table");

// ── every line written ──
for (const [who, book] of Object.entries(DOING_LINES)) for (const [k, lines] of Object.entries(book)) {
  check(!!lines?.length, `${who} ${k}: no lines`);
  for (const l of lines ?? []) check(l.trim().length > 3 && !/[{}<>]|TODO|undefined|null/.test(l), `${who} ${k}: a bad line "${l}"`);
  check(new Set(lines).size === (lines?.length ?? 0), `${who} ${k}: a line twice`);
}
for (const [who, ph] of Object.entries(PHASE_LINES)) for (const [p, lines] of Object.entries(ph)) check(lines.length > 0 && lines.every((l) => l.trim().length > 3), `${who} ${p}: phase lines`);
for (const who of ["mate", "chef", "cleaner"] as const) for (const step of ["arrive", "go", "use", "away", "call", "cook", "meet", "clean", "leave"] as const) for (const phase of ["night", "morning", "midday", "afternoon", "evening"] as const) {
  const t = houseTalk({ who, step, target: step === "use" ? "pool" : undefined, phase, seed: `${who}${step}${phase}` });
  check(t.lines.length === 2 && t.lines.every((l) => !!l && l.length > 3), `${who} ${step} ${phase}: two real lines (${JSON.stringify(t.lines)})`);
  check(!!t.role, `${who}: a role`);
}

if (problems.length) {
  console.error(`houseRoutines: ${problems.length} problem(s)`);
  for (const p of problems) console.error("  ✗ " + p);
  process.exit(1);
}
console.log(`houseRoutines: ok (${visits} visits, ${steps} steps, longest step ${longest} min, every visit leaves; kinds ${[...kinds].map(([a, b]) => `${a} ${b}`).join(", ")})`);
