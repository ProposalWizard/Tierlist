/**
 * lib/star/scenarioStore.ts — the Scenario Builder's saved scenarios, after
 * the Supabase upgrade its own header had been pointing at.
 *
 * Two halves are exercisable here: the synchronous local read cache
 * (list/load/save/delete, and refusing malformed data rather than handing a
 * half-shaped scenario to the editor) and the network boundary — a faked
 * `fetch`, the same way tests/star/faceStyle.mts fakes localStorage and
 * fetch, since there is no server in this environment.
 *
 * The things worth proving hardest:
 *   1. A fetch MIRRORS the server. It used to merge, and a merge cannot
 *      express a delete: a scenario deleted on one device lived on in every
 *      other browser that had seen it, and the next Commit all from there
 *      wrote it back into the code. The one exception is a save made on
 *      THIS device that the server never confirmed — kept until it is.
 *      A server whose table does not exist yet leaves the cache alone.
 *   2. A save reports honestly. It may write the local cache either way (a
 *      draft is never thrown away), but `ok` is true only when the server
 *      confirmed it, so the builder never shows a flat "Saved" for
 *      something that reached no other device.
 *   3. A refused DELETE does not drop the local copy.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

function freshStore() {
  const store = new Map<string, string>();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, String(v)); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => store.clear(),
  };
  return store;
}

interface FakeCall { url: string; init?: { method?: string; body?: string } }
let calls: FakeCall[] = [];
let respond: (call: FakeCall) => { status: number; body: unknown } | "throw" = () => ({ status: 200, body: {} });

(globalThis as { fetch?: unknown }).fetch = async (url: string, init?: { method?: string; body?: string }) => {
  const call = { url, init };
  calls.push(call);
  const r = respond(call);
  if (r === "throw") throw new Error("network down");
  return { ok: r.status >= 200 && r.status < 300, status: r.status, json: async () => r.body };
};

const store = freshStore();
const {
  listScenarios, loadScenario, saveScenario, deleteScenario,
  fetchSharedScenarios, saveScenarioShared, deleteScenarioShared,
} = await import("../../lib/star/scenarioStore");
const { blankScenario } = await import("../../lib/star/scenarios");

const KEY = "star-scenarios-v1";

/** A real scenario from the real builder's own starting point, so these
 *  tests can never drift from the actual MatchScenario shape. */
function scenarioAt(id: string, name: string, x: number) {
  const s = blankScenario("corner");
  return { ...s, id, name, updatedAt: 1, ball: { ...s.ball, x } };
}

// ── The synchronous cache the editor renders from ─────────────────────────
{
  store.clear();
  check(listScenarios().length === 0, "nothing stored: no scenarios");
  check(loadScenario("sc_nope") === null, "an unknown id is null");

  saveScenario(scenarioAt("sc_a", "Back post corner", 2));
  saveScenario(scenarioAt("sc_b", "Wide free kick", 40));
  const list = listScenarios();
  check(list.length === 2, `both stored (${list.length})`);
  check(loadScenario("sc_a")?.name === "Back post corner", "a scenario round-trips by id");
  check(loadScenario("sc_a")!.ball.x === 2, "…with its real pitch-metre coordinates intact");
  check(
    list[0].updatedAt >= list[1].updatedAt,
    "the list is newest-first, which the editor's own Saved panel relies on",
  );

  deleteScenario("sc_a");
  check(loadScenario("sc_a") === null, "delete removes exactly that id");
  check(loadScenario("sc_b") !== null, "…and leaves the other alone");
}

// ── Corrupt or half-shaped storage never reaches the editor ───────────────
{
  store.clear();
  localStorage.setItem(KEY, "{not json");
  check(listScenarios().length === 0, "mangled JSON reads as nothing, not a throw");

  const good = scenarioAt("sc_good", "Good", 12);
  localStorage.setItem(KEY, JSON.stringify({
    sc_good: good,
    sc_noCamera: { ...good, id: "sc_noCamera", camera: undefined },
    sc_nanBall: { ...good, id: "sc_nanBall", ball: { x: NaN, y: 3 } },
    sc_badPlayer: { ...good, id: "sc_badPlayer", players: [{ id: "you", side: "you", x: "3", y: 4 }] },
    sc_string: "not an object",
  }));
  const kept = listScenarios();
  check(
    kept.length === 1 && kept[0].id === "sc_good",
    `only the valid scenario survives (${kept.map(s => s.id)})`,
  );
}

// ── fetchSharedScenarios MIRRORS the server ──────────────────────────────
{
  store.clear();
  saveScenario(scenarioAt("sc_deletedElsewhere", "Deleted on another laptop", 5));
  saveScenario(scenarioAt("sc_both", "Stale local", 5));

  respond = () => ({
    status: 200,
    body: {
      scenarios: {
        sc_both: scenarioAt("sc_both", "Server wins", 61),
        sc_serverOnly: scenarioAt("sc_serverOnly", "Server only", 30),
      },
      migrationMissing: false,
    },
  });
  const r = await fetchSharedScenarios();
  check(r.ok, "a good fetch reports ok");
  check(!r.migrationMissing, "…and no missing migration");
  // THE bug: a merge kept this forever, and the next Commit all from this
  // browser would have written it straight back into the code.
  check(loadScenario("sc_deletedElsewhere") === null,
    "a scenario the server no longer has is GONE from this browser too — a delete reaches everyone");
  check(loadScenario("sc_both")!.ball.x === 61, "the server's copy wins where both exist");
  check(loadScenario("sc_serverOnly") !== null, "an id only the server has is pulled down");
}

// ── …except a save that never reached the server ─────────────────────────
{
  store.clear();
  respond = () => ({ status: 500, body: { error: "down" } });
  const failed = await saveScenarioShared(scenarioAt("sc_unsent", "Saved while the server was down", 12));
  check(failed.ok === false, "a refused save reports not-ok");

  respond = () => ({ status: 200, body: { scenarios: {}, migrationMissing: false } });
  await fetchSharedScenarios();
  check(loadScenario("sc_unsent") !== null,
    "a save the server never confirmed survives a sync — it is not a copy of anything");

  // Once the server has it (same edit or newer), it is not pending any more,
  // and from then on it behaves like every other mirrored scenario.
  respond = () => ({ status: 200, body: { scenarios: { sc_unsent: scenarioAt("sc_unsent", "Now on the server", 12) }, migrationMissing: false } });
  const later = loadScenario("sc_unsent")!;
  (respond as unknown) = () => ({ status: 200, body: { scenarios: { sc_unsent: { ...later, name: "Now on the server" } }, migrationMissing: false } });
  await fetchSharedScenarios();
  respond = () => ({ status: 200, body: { scenarios: {}, migrationMissing: false } });
  await fetchSharedScenarios();
  check(loadScenario("sc_unsent") === null,
    "…and once the server has had it, deleting it there removes it here as well");
}

// ── A table that doesn't exist yet is not an empty table ─────────────────
{
  store.clear();
  saveScenario(scenarioAt("sc_only", "The only copy", 9));
  respond = () => ({ status: 200, body: { scenarios: {}, migrationMissing: true } });
  await fetchSharedScenarios();
  check(loadScenario("sc_only") !== null,
    "a server with no table yet leaves the cache alone — that is the one case a mirror would be worse than nothing");
}

// ── The migration not being run is a NAMED state, not a crash ─────────────
{
  store.clear();
  respond = () => ({
    status: 200,
    body: { scenarios: {}, migrationMissing: true, message: "run star_scenarios.sql" },
  });
  const r = await fetchSharedScenarios();
  check(r.ok, "a migration-missing GET is still a successful call");
  check(r.migrationMissing === true, "…flagged so the builder can banner it");
  check((r.message ?? "").includes("star_scenarios"), "…and names the migration file");
}

// ── A dead or broken server degrades to the local cache ───────────────────
{
  store.clear();
  saveScenario(scenarioAt("sc_keep", "Keep me", 4));
  respond = () => "throw";
  const r = await fetchSharedScenarios();
  check(r.ok === false && !!r.message, "an unreachable server reports not-ok with a reason");
  check(loadScenario("sc_keep") !== null, "…and the local cache is untouched");

  respond = () => ({ status: 500, body: { error: "boom" } });
  const r2 = await fetchSharedScenarios();
  check(r2.ok === false && r2.message === "boom", `a 500 surfaces the server's own reason (${r2.message})`);
}

// ── Saving: local either way, but `ok` only when the server confirmed ─────
{
  store.clear();
  calls = [];
  respond = () => ({ status: 200, body: { ok: true } });
  const r = await saveScenarioShared(scenarioAt("sc_s", "Shared save", 33));
  check(r.ok, "a confirmed save reports ok");
  check(calls[0].init?.method === "POST", "…via POST");
  const sent = JSON.parse(calls[0].init!.body!);
  check(sent.scenario.id === "sc_s", "…carrying the MatchScenario itself");
  check(sent.scenario.camera && typeof sent.scenario.camera.facing === "string", "…camera and all");
  check(sent.scenario.updatedAt > 1, "…re-stamped, so the shared list sorts by a real save time");
  check(loadScenario("sc_s") !== null, "…and it is in the local cache");
}
{
  store.clear();
  respond = () => ({ status: 403, body: { error: "Forbidden — saving a scenario for everyone needs an admin sign-in." } });
  const r = await saveScenarioShared(scenarioAt("sc_f", "Refused", 33));
  check(!r.ok, "a non-admin save reports NOT ok — the builder must not show a flat 'Saved'");
  check((r.message ?? "").includes("admin"), `…with the server's own reason (${r.message})`);
  check(
    loadScenario("sc_f") !== null,
    "…but the draft is still kept locally, so a refused save never loses the work",
  );
}
{
  store.clear();
  respond = () => ({ status: 503, body: { error: "run the migration", migrationMissing: true } });
  const r = await saveScenarioShared(scenarioAt("sc_m", "Pre-migration", 33));
  check(!r.ok && r.migrationMissing === true, "a save before the migration flags migrationMissing");
  check(loadScenario("sc_m") !== null, "…and still keeps the local draft");

  respond = () => "throw";
  const r2 = await saveScenarioShared(scenarioAt("sc_n", "Offline", 33));
  check(!r2.ok && !!r2.message, "a dead network on save fails loudly, not silently");
  check(loadScenario("sc_n") !== null, "…and still keeps the local draft");
}

// ── Deleting is shared-first ──────────────────────────────────────────────
{
  store.clear();
  calls = [];
  saveScenario(scenarioAt("sc_x", "Delete me", 1));
  saveScenario(scenarioAt("sc_y", "Leave me", 2));
  respond = () => ({ status: 200, body: { ok: true } });
  const r = await deleteScenarioShared("sc_x");
  check(r.ok, "a confirmed delete reports ok");
  check(calls[0].init?.method === "DELETE", "…via DELETE");
  check(calls[0].url.includes("id=sc_x"), `…naming the id in the query (${calls[0].url})`);
  check(loadScenario("sc_x") === null, "…and drops the local copy, so a merging fetch can't resurrect it");
  check(loadScenario("sc_y") !== null, "…leaving every other scenario alone");

  respond = () => ({ status: 403, body: { error: "Forbidden" } });
  const bad = await deleteScenarioShared("sc_y");
  check(!bad.ok, "a refused delete reports not ok");
  check(
    loadScenario("sc_y") !== null,
    "…and does NOT drop the local copy — it still exists for everyone else",
  );

  respond = () => "throw";
  const off = await deleteScenarioShared("sc_y");
  check(!off.ok && loadScenario("sc_y") !== null, "an offline delete changes nothing, here or there");
}

if (problems.length) {
  console.error(`scenarioStore: ${problems.length} problem(s)`);
  for (const p of problems) console.error("  ✗", p);
  process.exit(1);
}
console.log("scenarioStore: all checks passed");
