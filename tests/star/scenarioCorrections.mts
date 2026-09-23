/**
 * Corrections: silent evidence, not a base and not an instant rule.
 *
 * The load-bearing property is that a correction only counts as evidence
 * when the move GENUINELY repaired something measurable. Without that, "I
 * nudged a defender" would be read as support for whatever rule happened to
 * be nearby — which is exactly how this project has twice ended up with a
 * plausible rule that was wrong about thousands of pictures.
 */

import {
  movesBetween, faultsRepaired, makeCorrection, proposalsFrom,
  PROPOSAL_THRESHOLD, MIN_MOVE_M, KEEPER_SHIFT, keeperEvidence,
  saveCorrection, loadCorrections, fetchSharedCorrections, clearCorrections,
  type Correction,
} from "@/lib/star/scenarioCorrections";
import type { MatchScenario } from "@/lib/star/scenarios";

let failed = 0;
const ok = (c: boolean, what: string) => { if (!c) { failed++; console.error(`  FAIL ${what}`); } };

const CX = 34;
const base = (players: MatchScenario["players"], ball = { x: CX, y: 12 }): MatchScenario => ({
  id: "t", name: "t", kind: "open_play",
  camera: { centerX: CX, centerY: 17, viewHeight: 42, facing: "up" },
  ball, players, updatedAt: 0,
  source: { kind: "one_on_one", seed: 1, tool: "gallery", planId: null },
});

const YOU = { id: "iY", side: "you", x: CX, y: 13, label: "YOU" };
const GK = { id: "iK", side: "opponent", x: CX, y: 2, label: "GK" };

// ── a move has to be a real move ─────────────────────────────────────────
{
  const a = base([YOU, GK, { id: "i0", side: "opponent", x: 30, y: 8, label: "D1" }]);
  const tiny = base([YOU, GK, { id: "i0", side: "opponent", x: 30.2, y: 8, label: "D1" }]);
  ok(movesBetween(a, tiny).length === 0, `a ${MIN_MOVE_M}m-or-less nudge is not a move`);
  const real = base([YOU, GK, { id: "i0", side: "opponent", x: 24, y: 8, label: "D1" }]);
  ok(movesBetween(a, real).length === 1, "a real drag is one move");
  ok(movesBetween(a, real)[0].dist > 5, "…and it records how far");
}

// ── a defender dragged OUT of the shooting lane ──────────────────────────
{
  // in the corridor between ball and goal, then pulled wide
  const before = base([YOU, GK, { id: "i0", side: "opponent", x: CX, y: 7, label: "D1" }]);
  const after = base([YOU, GK, { id: "i0", side: "opponent", x: 14, y: 7, label: "D1" }]);
  const f = faultsRepaired(before, after);
  ok(f.includes("defender-in-lane"), "pulling a defender out of the lane is evidence of that");
  // and the reverse must NOT read as a repair
  ok(!faultsRepaired(after, before).includes("defender-in-lane"),
    "pushing one INTO the lane repairs nothing");
}

// ── a defender dragged behind the ball ───────────────────────────────────
{
  const before = base([YOU, GK, { id: "i0", side: "opponent", x: 20, y: 6, label: "D1" }]);
  const after = base([YOU, GK, { id: "i0", side: "opponent", x: 20, y: 17, label: "D1" }]);
  ok(faultsRepaired(before, after).includes("defender-goal-side"),
    "dragging a defender behind the ball is evidence of that");
}

// ── a move that fixes NOTHING is recorded but is not evidence ────────────
{
  // a defender well wide and already behind the ball, shuffled sideways
  const before = base([YOU, GK, { id: "i0", side: "opponent", x: 8, y: 20, label: "D1" }]);
  const after = base([YOU, GK, { id: "i0", side: "opponent", x: 12, y: 20, label: "D1" }]);
  const c = makeCorrection("c", "one_on_one", before, after);
  ok(c.moves.length === 1, "the move is still recorded");
  ok(c.faults.length === 0, "…but it is evidence of nothing, because it repaired nothing");
}

// ── one is noise, several is a proposal ──────────────────────────────────
{
  const mk = (i: number): Correction => {
    const before = base([YOU, GK, { id: "i0", side: "opponent", x: CX, y: 7, label: "D1" }]);
    const after = base([YOU, GK, { id: "i0", side: "opponent", x: 14, y: 7, label: "D1" }]);
    return makeCorrection(`c${i}`, "one_on_one", before, after);
  };
  const few = Array.from({ length: PROPOSAL_THRESHOLD - 1 }, (_, i) => mk(i));
  ok(proposalsFrom(few).length === 0,
    `${PROPOSAL_THRESHOLD - 1} corrections propose nothing — one is noise`);

  const enough = Array.from({ length: PROPOSAL_THRESHOLD }, (_, i) => mk(i));
  const props = proposalsFrom(enough);
  ok(props.length === 1, `${PROPOSAL_THRESHOLD} agreeing is one proposal`);
  ok(props[0].fault === "defender-in-lane", "…naming what they agree on");
  ok(props[0].count === PROPOSAL_THRESHOLD, "…and how many said it");
  ok(props[0].from.length === PROPOSAL_THRESHOLD, "…keeping the examples to show");
  ok(/shooting lane/i.test(props[0].rule), "…as a rule in plain English");
}

// ── the same fault in DIFFERENT situations is not one claim ──────────────
{
  const mk = (i: number, kind: string): Correction => {
    const before = base([YOU, GK, { id: "i0", side: "opponent", x: CX, y: 7, label: "D1" }]);
    const after = base([YOU, GK, { id: "i0", side: "opponent", x: 14, y: 7, label: "D1" }]);
    return makeCorrection(`${kind}${i}`, kind, before, after);
  };
  const mixed = [
    ...Array.from({ length: 2 }, (_, i) => mk(i, "one_on_one")),
    ...Array.from({ length: 2 }, (_, i) => mk(i, "long_range")),
  ];
  ok(proposalsFrom(mixed).length === 0,
    "2 + 2 across two kinds is not 4 — a rule is scoped to the situation it is about");
}

// ── the keeper check: the tuner used to be blind to him ──────────────────
// Measured before this existed: of ten tight-angle corrections that each
// dragged the keeper across to his near post, the tuner recognised 0/10.
{
  const wideBall = { x: CX + 12, y: 6 };
  const gkAt = (x: number, y = 2) => ({ ...GK, x, y });
  const you = { ...YOU, x: CX + 12, y: 7 };
  const before = base([you, gkAt(CX + 2)], wideBall);          // near-post share 2/12
  const after = base([you, gkAt(CX + 6)], wideBall);           // 6/12 = 0.5
  const ev = keeperEvidence(before, after);
  ok(ev.faults.includes("keeper-near-post"), "dragging the keeper across to his near post is recognised");
  ok(ev.values["keeper-near-post"] === 0.5, `…with the share he ended at (${ev.values["keeper-near-post"]})`);
  ok(!ev.faults.includes("keeper-advance"), "…and not also read as a change in how far off his line");

  const nudge = base([you, gkAt(CX + 2 + 12 * (KEEPER_SHIFT / 2))], wideBall);
  ok(keeperEvidence(before, nudge).faults.length === 0, "a nudge under KEEPER_SHIFT is not a statement");

  const central = { x: CX, y: 12 };
  ok(!keeperEvidence(base([YOU, gkAt(CX)], central), base([YOU, gkAt(CX + 3)], central))
    .faults.includes("keeper-near-post"), "a central ball has no near post to cover");

  const off = base([you, gkAt(CX + 2, 4)], wideBall);          // advance 4/6
  ok(keeperEvidence(before, off).faults.includes("keeper-advance"), "pulling him off his line is recognised too");

  // makeCorrection carries it, and several of them become a VALUED proposal.
  const shares = [0.45, 0.5, 0.55, 0.62];
  const cs = shares.map((sh, i) =>
    makeCorrection(`k${i}`, "tight_angle", before, base([you, gkAt(CX + 12 * sh)], wideBall)));
  ok(cs.every((c) => c.faults.includes("keeper-near-post")), "each keeper drag is a correction with a fault");
  const pr = proposalsFrom(cs).find((p) => p.fault === "keeper-near-post");
  ok(!!pr, "four agreeing keeper drags make a proposal");
  ok(pr?.value === 0.55, `…at the median share, not the mean (${pr?.value})`);
  ok(pr?.range?.[0] === 0.45 && pr?.range?.[1] === 0.62, `…showing how far apart they were (${pr?.range})`);
  ok(!!pr?.apply && pr.apply.includes("KEEPER_TUNING_BY_KIND.tight_angle") && pr.apply.includes("nearPost: 0.55"),
    `…and the exact line to change (${pr?.apply})`);
}

// ── one list for the whole team ──────────────────────────────────────────
{
  const store = new Map<string, string>();
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => store.clear(), key: () => null, get length() { return store.size; },
  } as Storage;
  const posts: string[] = [];
  let server: Correction[] = [];
  let mode: "ok" | "missing" | "down" = "ok";
  (globalThis as unknown as { fetch: unknown }).fetch = async (_u: string, init?: { method?: string; body?: string }) => {
    if (mode === "down") throw new Error("offline");
    if (init?.method === "POST") {
      const c = JSON.parse(init.body!).correction as Correction;
      posts.push(c.id);
      server = [...server.filter((x) => x.id !== c.id), c];
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }
    return new Response(JSON.stringify(mode === "missing"
      ? { corrections: [], migrationMissing: true } : { corrections: server }), { status: 200 });
  };
  const mk = (id: string, at: number): Correction => ({ id, kind: "one_on_one", faults: ["defender-in-lane"], moves: [], at });
  const tick = () => new Promise((r) => setTimeout(r, 0));

  // A correction made before the table existed lives only here.
  store.set("star-scenario-corrections-v1", JSON.stringify([mk("old", 1)]));
  mode = "missing";
  let r = await fetchSharedCorrections();
  ok(r.corrections.length === 1 && loadCorrections().length === 1,
    "no table yet: the local list is left exactly as it was");
  mode = "down";
  r = await fetchSharedCorrections();
  ok(!r.ok && loadCorrections().length === 1, "offline: nothing is thrown away");

  mode = "ok";
  server = [mk("harry1", 2), mk("leo1", 3)];
  r = await fetchSharedCorrections();
  await tick();
  ok(r.corrections.length === 3, `the team's list plus this browser's own (${r.corrections.length})`);
  ok(posts.includes("old") && server.some((c) => c.id === "old"),
    "a correction only this browser had is uploaded, not dropped");
  ok(loadCorrections().length === 3, "…and the cache now holds the same list as everyone else");

  saveCorrection(mk("new", 4));
  await tick();
  ok(server.some((c) => c.id === "new"), "a new correction goes straight to the team's list");

  clearCorrections();
  store.clear();
  r = await fetchSharedCorrections();
  ok(r.corrections.length === 4, "a fresh browser gets every correction the team has made");
}

if (failed) { console.error(`\n${failed} FAILED`); process.exit(1); }
console.log(`scenarioCorrections: all checks passed (threshold ${PROPOSAL_THRESHOLD})`);
