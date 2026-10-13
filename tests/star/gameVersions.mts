/**
 * SETTINGS: THE VERSION PICKER IS GONE (Harry, 12 Oct 2026: "the new cut
 * scenes will be staying"). The rows left are in lib/star/lookRows.ts.
 *
 *  1. No Classic | Standard picker: lib/star/gameVersions.ts no longer exists
 *     and Settings has no Version card.
 *  2. Cut-scene people and camera are decided New, with no row; an old phone's
 *     stored "old" is ignored.
 *  3. The rows left: Keepers (New by default, Harry 12 Oct: not tested
 *     enough yet), the v0.15 test box (Old by default) and UI: Old | New.
 *  4. A brand-new phone reads every row's default; setting a row reads back.
 *  5. Setting a row never touches the preferences (sound, skip the line-up).
 */
import { existsSync, readFileSync } from "node:fs";

// A stand-in for the browser's storage, in place before anything is read.
const store = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => { store.set(k, String(v)); },
  removeItem: (k: string) => { store.delete(k); },
  clear: () => store.clear(),
  key: (i: number) => [...store.keys()][i] ?? null,
  get length() { return store.size; },
} as Storage;

// An old phone that had picked Old for both cut-scene rows.
store.set("star-look-cutscene-people", "old");
store.set("star-look-cutscene-camera", "old");

const { LOOK_ROWS, LOOK_ROW_IDS, readLook, setLookRow, changedFromDefault } = await import("../../lib/star/lookRows");
const { cutscenePeopleLook, cutsceneCameraLook } = await import("../../lib/star/cutscene/look");

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };
const root = new URL("../../", import.meta.url);
const src = (p: string) => readFileSync(new URL(p, root), "utf8");

// 1.
check(!existsSync(new URL("lib/star/gameVersions.ts", root)), "lib/star/gameVersions.ts still exists");
const settings = src("components/star/DeviceSettings.tsx");
check(!/VersionCard|applyGameVersion|data-version-card|data-version=|GAME_VERSION/.test(settings), "Settings still shows a Version picker");

// 2.
check(cutscenePeopleLook() === "new", `cut-scene people read "${cutscenePeopleLook()}" on an old phone`);
check(cutsceneCameraLook() === "new", `cut-scene camera read "${cutsceneCameraLook()}" on an old phone`);
for (const gone of ["cutscenePeople", "cutsceneCamera", "chances", "animations", "dribble", "matchView", "sprites2d", "badges"]) {
  check(!(gone in LOOK_ROWS), `${gone} is decided and must not be a row`);
}
check(!/cutscenePeople|cutsceneCamera/.test(settings), "Settings still has a cut-scene row");

// 3.
const expected = ["keepers", "keeperPro", "shotsPro", "knucklePower", "ballPhysics", "matchFlow", "matchRadar", "matchFeel", "ui"];
// Match feel (Leo, 13 Oct 2026): a testing row, Old by default.
check(LOOK_ROWS.matchFeel.standard === "old", "Match feel must default to Old while tested");
check(LOOK_ROW_IDS.join() === expected.join(), `rows are ${LOOK_ROW_IDS.join()}`);

check(LOOK_ROWS.keepers.standard === "new", "Keepers must default to New");
check(/<LookRow id="keepers"/.test(settings), "Settings has no Keepers row");

// 4.
const fresh = readLook();
for (const id of LOOK_ROW_IDS) {
  const r = LOOK_ROWS[id];
  check(fresh[id] === r.standard, `a new phone reads ${id} = "${fresh[id]}", default "${r.standard}"`);
  check(r.standard === r.newValue || r.standard === r.oldValue, `${id} default is not one of its options`);
  check(!changedFromDefault(id, fresh), `${id} reads as changed on a new phone`);
}
setLookRow("matchRadar", "new");
check(readLook().matchRadar === "new" && changedFromDefault("matchRadar"), "setting a row does not read back");

// 5.
store.set("star-sfx", "1");
store.set("star-skip-lineup", "1");
for (const id of LOOK_ROW_IDS) setLookRow(id, LOOK_ROWS[id].oldValue);
check(store.get("star-sfx") === "1" && store.get("star-skip-lineup") === "1", "a row changed a preference");

if (problems.length) {
  console.log(`FAIL — ${problems.length} problem(s):`);
  for (const p of problems) console.log("  " + p);
  process.exit(1);
}
console.log(`gameVersions: picker gone, cut scenes decided New, ${LOOK_ROW_IDS.length} rows left, all checks pass`);
