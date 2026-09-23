/**
 * tests/star/playArea.mts — the Play Area's shared settings.
 *
 * Every field here feeds a real match as a prop, so a bad stored value is a
 * NaN in the physics rather than a wrong-looking number on a screen. The
 * point of these checks is that nothing gets through: a missing field, a
 * hand-edited one, a string where a number should be, and a value from an
 * older version all have to land on something playable.
 */

const store = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { store.set(k, v); },
  removeItem: (k: string) => { store.delete(k); },
  clear: () => store.clear(),
  key: (i: number) => [...store.keys()][i] ?? null,
  get length() { return store.size; },
} as Storage;
(globalThis as unknown as { window: unknown }).window = globalThis;

const {
  sanitizePlaySettings, loadPlaySettings, savePlaySettings,
  DEFAULT_PLAY_SETTINGS, PLAY_RANGES, PLAY_POSITIONS, PLAY_DIVISIONS,
} = await import("../../lib/star/playArea");

let failures = 0;
const check = (name: string, ok: boolean, detail = "") => {
  if (!ok) { failures++; console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`); }
  else console.log(`  ✓ ${name}`);
};

console.log("\nPLAY AREA SETTINGS");

// ── Defaults are themselves valid ────────────────────────────────────────
const d = DEFAULT_PLAY_SETTINGS;
check("the defaults survive their own sanitiser unchanged",
  JSON.stringify(sanitizePlaySettings(d)) === JSON.stringify(d),
  JSON.stringify(sanitizePlaySettings(d)));

// ── Nothing gets through ─────────────────────────────────────────────────
const junk = sanitizePlaySettings({
  power: "loads", technique: NaN, oppStrength: 10_000, keeperStrength: -50,
  position: "GK", division: "sunday_league", matchMinutes: 0, curve: "yes",
});
check("a string where a number should be falls back to the default",
  junk.power === d.power, String(junk.power));
check("NaN falls back rather than through",
  junk.technique === d.technique, String(junk.technique));
check("a number over the ceiling clamps to it",
  junk.oppStrength === PLAY_RANGES.oppStrength[1], String(junk.oppStrength));
check("a negative number clamps to the floor",
  junk.keeperStrength === PLAY_RANGES.keeperStrength[0], String(junk.keeperStrength));
check("a position the game does not offer falls back",
  junk.position === d.position, junk.position);
check("a division that does not exist falls back",
  junk.division === d.division, junk.division);
check("a match too short to be a match clamps to the floor",
  junk.matchMinutes === PLAY_RANGES.matchMinutes[0], String(junk.matchMinutes));
check("a non-boolean toggle becomes a real boolean",
  junk.curve === true && typeof junk.curve === "boolean", String(junk.curve));

// ── An OLD save, from before a field existed ─────────────────────────────
const old = sanitizePlaySettings({ power: 70, technique: 40 });
check("an old save keeps what it had", old.power === 70 && old.technique === 40);
check("…and fills in what it never had",
  old.matchMinutes === d.matchMinutes && old.position === d.position
  && old.division === d.division && old.curve === false);

// ── Round trip ───────────────────────────────────────────────────────────
store.clear();
check("nothing stored reads back as the defaults",
  JSON.stringify(loadPlaySettings()) === JSON.stringify(d));

const mine = { ...d, power: 88, curve: true, position: "LW" as const, matchMinutes: 12345 };
savePlaySettings(mine);
const back = loadPlaySettings();
check("a real set round-trips exactly",
  back.power === 88 && back.curve === true && back.position === "LW" && back.matchMinutes === 12345,
  JSON.stringify(back));

store.set("star-play-settings-v1", "{ not json");
check("corrupt stored JSON falls back instead of throwing",
  JSON.stringify(loadPlaySettings()) === JSON.stringify(d));

// ── The lists the UI renders from ────────────────────────────────────────
check("every offered position is one the sanitiser accepts",
  PLAY_POSITIONS.every((p) => sanitizePlaySettings({ position: p }).position === p));
check("every offered division is one the sanitiser accepts",
  PLAY_DIVISIONS.every((x) => sanitizePlaySettings({ division: x.id }).division === x.id));
// The whole reason the tool exists is to run a match far longer than one, so
// a range that could not reach the number that was asked for would be a bug.
check("the match-length range reaches the 10,000 minutes asked for",
  PLAY_RANGES.matchMinutes[0] <= 10000 && PLAY_RANGES.matchMinutes[1] >= 10000,
  JSON.stringify(PLAY_RANGES.matchMinutes));

console.log(failures === 0 ? "\nAll checks passed.\n" : `\n${failures} FAILED\n`);
if (failures > 0) process.exit(1);
