/**
 * lib/star/playerIdentity.ts — the profile-setup screen's own pure helpers.
 *
 * Two things matter most here and both are about NOT breaking a save that
 * already exists on somebody's phone:
 *
 *  1. Skin tone widened from a `"light" | "dark"` binary to eight tones. An
 *     old save names one of the two old values and must still resolve to the
 *     exact colour it has always drawn — not a default, not nothing.
 *  2. Nickname is brand new and absent everywhere. `displayName` must return
 *     byte-identical output to the `${firstName} ${lastName}` every call site
 *     builds by hand today, or adopting it would silently rename every
 *     existing career.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

const {
  SKIN_TONES, DEFAULT_SKIN_TONE, resolveSkinTone, skinToneHex,
  displayName, shortDisplayName,
  DEFAULT_FOOT, resolveFoot,
  MIN_SQUAD_NUMBER, MAX_SQUAD_NUMBER, clampSquadNumber,
} = await import("../../lib/star/playerIdentity");

// ── The spread itself ───────────────────────────────────────────────────────

check(SKIN_TONES.length >= 5 && SKIN_TONES.length <= 10,
  `SKIN_TONES should be a real choice of 5-10 tones, got ${SKIN_TONES.length}`);

const ids = SKIN_TONES.map(t => t.id);
check(new Set(ids).size === ids.length, "every skin tone id must be unique");

const hexes = SKIN_TONES.map(t => t.hex);
check(new Set(hexes).size === hexes.length, "every skin tone must be a genuinely different colour");
check(hexes.every(h => /^#[0-9a-f]{6}$/i.test(h)), "every skin tone hex must be a real 6-digit hex colour");
check(SKIN_TONES.every(t => t.label.trim().length > 0), "every skin tone needs a label for its aria-label/title");

// Ordered light to dark, which is the order the picker lays them out in. Read
// off real luminance rather than trusting the array's order by eye.
const lum = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255);
};
let ordered = true;
for (let i = 1; i < SKIN_TONES.length; i++) {
  if (lum(SKIN_TONES[i].hex) >= lum(SKIN_TONES[i - 1].hex)) ordered = false;
}
check(ordered, "SKIN_TONES should run light to dark — the picker lays them out in array order");

check(ids.includes(DEFAULT_SKIN_TONE), "DEFAULT_SKIN_TONE must actually be one of the tones");

// ── The migration: an old save must not change colour ───────────────────────

check(ids.includes("light" as never), '"light" must survive as a real tone id, or every old save loses its colour');
check(ids.includes("dark" as never), '"dark" must survive as a real tone id, or every old save loses its colour');

// The two hex values the old two-button picker actually shipped. Pinned as
// literals on purpose: the point of this test is that they did not move.
check(skinToneHex("light") === "#d4a373", `an old "light" save must still draw #d4a373, got ${skinToneHex("light")}`);
check(skinToneHex("dark") === "#4a2b18", `an old "dark" save must still draw #4a2b18, got ${skinToneHex("dark")}`);

check(resolveSkinTone("light") === "light", 'resolveSkinTone("light") must be a no-op, not a remap');
check(resolveSkinTone("dark") === "dark", 'resolveSkinTone("dark") must be a no-op, not a remap');

// Every tone round-trips through resolve unchanged.
check(SKIN_TONES.every(t => resolveSkinTone(t.id) === t.id), "every tone must resolve to itself");
check(SKIN_TONES.every(t => skinToneHex(t.id) === t.hex), "every tone's hex must come back out of skinToneHex");

// ── Garbage in, a plausible player out ──────────────────────────────────────

for (const junk of [undefined, null, "", "mauve", 7, {}, [], NaN, true]) {
  check(resolveSkinTone(junk) === DEFAULT_SKIN_TONE,
    `resolveSkinTone(${JSON.stringify(junk) ?? String(junk)}) should fall back to the default tone`);
  check(/^#[0-9a-f]{6}$/i.test(skinToneHex(junk)),
    `skinToneHex(${JSON.stringify(junk) ?? String(junk)}) must still return a drawable colour`);
}

// ── displayName ─────────────────────────────────────────────────────────────

const plain = { firstName: "Mikey", lastName: "Vass" };
check(displayName(plain) === "Mikey Vass", `no nickname must read exactly as today, got "${displayName(plain)}"`);
check(shortDisplayName(plain) === "Vass", `no nickname short form must be the surname, got "${shortDisplayName(plain)}"`);

const nicked = { firstName: "Mikey", lastName: "Vass", nickname: "The Vasscodemon" };
check(displayName(nicked) === "The Vasscodemon", "a nickname must win over the real name");
check(shortDisplayName(nicked) === "The Vasscodemon", "a nickname must win over the surname too");

// A nickname that is only whitespace is not a nickname.
check(displayName({ ...plain, nickname: "   " }) === "Mikey Vass", "a blank nickname must not blank the name");
check(shortDisplayName({ ...plain, nickname: "   " }) === "Vass", "a blank nickname must not blank the short name");
check(displayName({ ...plain, nickname: "" }) === "Mikey Vass", "an empty nickname must not blank the name");

// And one with stray spaces around it is still that nickname.
check(displayName({ ...plain, nickname: "  Vasco  " }) === "Vasco", "a nickname should be trimmed, not returned padded");

// Never returns a leading/trailing space even from a half-filled player.
check(displayName({ firstName: "Mikey", lastName: "" }) === "Mikey", "a missing surname must not leave a trailing space");

// ── Foot ────────────────────────────────────────────────────────────────────

check(DEFAULT_FOOT === "right", "the default foot should be right — the common case, not a coin flip");
check(resolveFoot("left") === "left", "a left-footed player must stay left-footed");
check(resolveFoot("right") === "right", "a right-footed player must stay right-footed");
for (const junk of [undefined, null, "", "both", 0, {}]) {
  check(resolveFoot(junk) === DEFAULT_FOOT,
    `resolveFoot(${JSON.stringify(junk) ?? String(junk)}) should fall back to the default foot`);
}

// ── Preferred number ────────────────────────────────────────────────────────

check(MIN_SQUAD_NUMBER === 1 && MAX_SQUAD_NUMBER === 99, "squad numbers run 1-99");
check(clampSquadNumber(10) === 10, "a legal number passes straight through");
check(clampSquadNumber(0) === MIN_SQUAD_NUMBER, "0 clamps up to 1");
check(clampSquadNumber(-5) === MIN_SQUAD_NUMBER, "a negative number clamps up to 1");
check(clampSquadNumber(100) === MAX_SQUAD_NUMBER, "100 clamps down to 99");
check(clampSquadNumber(9.6) === 10, "a fractional number rounds rather than truncating to something odd");
check(clampSquadNumber("7") === 7, "a numeric string is read as the number it is");
for (const junk of [undefined, null, "nine", NaN, {}]) {
  const v = clampSquadNumber(junk);
  check(Number.isInteger(v) && v >= MIN_SQUAD_NUMBER && v <= MAX_SQUAD_NUMBER,
    `clampSquadNumber(${JSON.stringify(junk) ?? String(junk)}) must still be a wearable number, got ${v}`);
}

// ── ───────────────────────────────────────────────────────────────────────

if (problems.length) {
  console.error(`playerIdentity: ${problems.length} problem(s)`);
  for (const p of problems) console.error(" ✗ " + p);
  process.exit(1);
}
console.log("playerIdentity: all checks passed");
