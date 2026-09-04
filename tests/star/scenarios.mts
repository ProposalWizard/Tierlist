// A tiny localStorage so scenarioStore.ts can run headless — see
// tests/star/opponentSavedLineup.mts for the same pattern.
const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { store.set(k, String(v)); },
  removeItem: (k: string) => { store.delete(k); },
  clear: () => store.clear(),
};

import { PITCH_W, HALF_LEN } from "../../lib/star/pitch";
import { blankScenario, addPlayer, newScenarioId, SCENARIO_KINDS } from "../../lib/star/scenarios";
import { listScenarios, loadScenario, saveScenario, deleteScenario } from "../../lib/star/scenarioStore";

/**
 * THE SCENARIO EDITOR'S DATA MODEL — A DRAFT TOOL, NOT WIRED IN YET.
 *
 * See lib/star/scenarios.ts's own header. What has to hold: a blank
 * scenario is genuinely on the pitch (not off the edge of it), adding a
 * player never collides it with the ball, and the local store round-trips
 * a save exactly. Nothing here tests the editor UI itself — just the data
 * it reads and writes.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

const PITCH_LEN = HALF_LEN * 2;
const onPitch = (x: number, y: number) => x >= 0 && x <= PITCH_W && y >= 0 && y <= PITCH_LEN;

// ── A blank scenario is real: on the pitch, one player (you), a real ball ──
for (const kind of SCENARIO_KINDS) {
  const s = blankScenario(kind);
  check(onPitch(s.ball.x, s.ball.y), `${kind}: the ball starts on the actual pitch (${s.ball.x}, ${s.ball.y})`);
  check(s.players.length === 1 && s.players[0].side === "you", `${kind}: starts with just you on it`);
  check(onPitch(s.players[0].x, s.players[0].y), `${kind}: you start on the actual pitch`);
  check(onPitch(s.camera.centerX, s.camera.centerY), `${kind}: the camera centres somewhere real (${s.camera.centerX}, ${s.camera.centerY})`);
  check(s.camera.viewHeight > 0, `${kind}: the camera actually shows something (${s.camera.viewHeight}m)`);
}

// ── Adding a player keeps them on the pitch and doesn't touch anyone else ──
{
  let s = blankScenario("corner");
  const before = s.players.length;
  s = addPlayer(s, "teammate");
  check(s.players.length === before + 1, "adding a teammate adds exactly one player");
  const added = s.players[s.players.length - 1];
  check(added.side === "teammate", "…and it's genuinely a teammate, not defaulted wrong");
  check(onPitch(added.x, added.y), `…and lands on the actual pitch (${added.x}, ${added.y})`);

  s = addPlayer(s, "opponent");
  const addedOpp = s.players[s.players.length - 1];
  check(addedOpp.side === "opponent", "adding an opponent is genuinely an opponent");
  check(s.players.length === before + 2, "the original teammate is still there — adding never overwrites");
}

// ── Ids are unique, not a coincidence of Date.now() colliding ──────────────
{
  const ids = new Set(Array.from({ length: 200 }, () => newScenarioId()));
  check(ids.size === 200, `two hundred ids generated back to back are all distinct (${ids.size})`);
}

// ── The local store: save, list, load, delete — a real round trip ─────────
{
  check(listScenarios().length === 0, "nothing saved yet, nothing listed");

  const a = blankScenario("free_kick");
  a.name = "Wide right, edge of the box";
  const b = blankScenario("kickoff");
  b.name = "Standard kickoff";

  saveScenario(a);
  saveScenario(b);
  const list = listScenarios();
  check(list.length === 2, `both saves show up in the list (${list.length})`);
  check(list.every(s => s.updatedAt > 0), "every listed scenario carries a real save timestamp");

  const reloaded = loadScenario(a.id);
  check(reloaded?.name === "Wide right, edge of the box", "loading by id gets back the real, named scenario");
  check(reloaded?.kind === "free_kick", "…with the real kind intact");
  check(JSON.stringify(reloaded?.players) === JSON.stringify(a.players), "…and the exact players, positions included");

  check(loadScenario("sc_does_not_exist") === null, "loading an id that was never saved is null, not a crash");

  // Saving again under the same id overwrites rather than duplicating.
  const edited = { ...a, name: "Wide right, edge of the box (renamed)" };
  saveScenario(edited);
  check(listScenarios().length === 2, `re-saving the same id still leaves exactly two, not three (${listScenarios().length})`);
  check(loadScenario(a.id)?.name === "Wide right, edge of the box (renamed)", "…and the rename actually took");

  deleteScenario(a.id);
  check(listScenarios().length === 1, "deleting removes exactly the one scenario");
  check(loadScenario(a.id) === null, "…and it's genuinely gone, not just hidden from the list");
  check(loadScenario(b.id)?.name === "Standard kickoff", "…while the other one is untouched");
}

if (problems.length) {
  console.log("FAIL");
  for (const p of problems) console.log(`  ✗ ${p}`);
  process.exit(1);
}
console.log("PASS — a hand-built scenario is real geometry, and the local store round-trips it exactly");
