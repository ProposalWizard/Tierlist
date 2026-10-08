/**
 * SETTINGS → VERSION: Classic | Standard | Preview (lib/star/gameVersions.ts).
 *
 *  1. Every New | Old switch is in all three versions, with a real option.
 *  2. Classic = every switch's OLD option.
 *  3. Standard = what a brand-new phone reads (each switch's real default).
 *  4. Preview = Standard plus the rows being tried, and nothing else.
 *  5. Applying a version, then reading back, gives that version.
 *  6. Changing one row reads as Custom (nearest version, 1 change).
 *  7. The picker never touches the preferences (sound, camera, etc.).
 */

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

const {
  LOOK_ROWS, LOOK_ROW_IDS, VERSION_PRESETS, GAME_VERSIONS, PREVIEW_ROWS,
  readLook, applyGameVersion, setLookRow, gameVersionOf, differencesFrom,
} = await import("../../lib/star/gameVersions");

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

// 3 first, while storage is empty: a brand-new phone reads Standard.
const fresh = readLook();
for (const id of LOOK_ROW_IDS) {
  check(fresh[id] === VERSION_PRESETS.standard[id], `Standard.${id} is "${VERSION_PRESETS.standard[id]}" but a new phone reads "${fresh[id]}"`);
}
check(gameVersionOf().version === "standard", `a new phone reads as ${gameVersionOf().version}, not Standard`);

// 1 and 2.
check(LOOK_ROW_IDS.length >= 20, `only ${LOOK_ROW_IDS.length} switches listed (20 in Settings on 8 Oct 2026)`);
for (const v of GAME_VERSIONS) {
  for (const id of LOOK_ROW_IDS) {
    const val = VERSION_PRESETS[v][id];
    const r = LOOK_ROWS[id];
    check(val === r.newValue || val === r.oldValue, `${v}.${id} = "${val}", not one of its options`);
  }
}
for (const id of LOOK_ROW_IDS) check(VERSION_PRESETS.classic[id] === LOOK_ROWS[id].oldValue, `Classic.${id} is not the old option`);

// 4.
for (const id of LOOK_ROW_IDS) {
  const want = PREVIEW_ROWS.includes(id) ? LOOK_ROWS[id].newValue : VERSION_PRESETS.standard[id];
  check(VERSION_PRESETS.preview[id] === want, `Preview.${id} is "${VERSION_PRESETS.preview[id]}", expected "${want}"`);
}
check(differencesFrom("standard", VERSION_PRESETS.preview).length > 0, "Preview is the same as Standard");

// 5. Apply each version (in a mixed order), read it back.
for (const v of ["classic", "preview", "standard", "classic", "standard"] as const) {
  applyGameVersion(v);
  const now = readLook();
  for (const id of LOOK_ROW_IDS) check(now[id] === VERSION_PRESETS[v][id], `after ${v}, ${id} reads "${now[id]}"`);
  const s = gameVersionOf();
  check(s.version === v, `after applying ${v} it reads as ${s.version}`);
}

// 6. One row changed by hand → Custom, nearest Standard, 1 change.
applyGameVersion("standard");
setLookRow("keepers", "old");
const c = gameVersionOf();
check(c.version === "custom" && c.nearest === "standard" && c.changes === 1, `one change reads ${JSON.stringify(c)}`);
applyGameVersion("classic");
setLookRow("ui", "new");
const c2 = gameVersionOf();
check(c2.version === "custom" && c2.nearest === "classic" && c2.changes === 1, `Classic + 1 reads ${JSON.stringify(c2)}`);

// 7. Preferences stay as they were.
const PREFS = ["star-camera-tilt", "star-look-you", "star-sfx", "star-skip-lineup"];
store.set("star-camera-tilt", "30");
store.set("star-look-you", "shown");
const before = PREFS.map((k) => store.get(k));
for (const v of GAME_VERSIONS) applyGameVersion(v);
check(PREFS.every((k, i) => store.get(k) === before[i]), "a version changed a preference");

if (problems.length) {
  console.log(`FAIL — ${problems.length} problem(s):`);
  for (const p of problems) console.log("  " + p);
  process.exit(1);
}
console.log(`gameVersions: ${LOOK_ROW_IDS.length} switches, 3 versions, all checks pass`);
