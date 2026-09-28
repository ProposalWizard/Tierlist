/**
 * lib/star/figureSkin.ts + the parts of lib/star/figure3d.ts that are not
 * drawing: which look the players are drawn in, and every player's own hair.
 *
 * The drawing itself needs a real canvas (not here) — it was checked by eye
 * at phone size (see the 28 Sep 2026 3D round's pictures).
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { store.set(k, String(v)); },
  removeItem: (k: string) => { store.delete(k); },
  clear: () => store.clear(),
};

const { figureSkin, setStoredFigureSkin, storedFigureSkin, setFigureSkinOverride, FIGURE_SKIN_KEY, FIGURE_SKIN_DEFAULT } =
  await import("../../lib/star/figureSkin");
const { hairFor, skinFor } = await import("../../lib/star/figure3d");

// ── The real game stays Classic until Harry says so ────────────────────────
check(FIGURE_SKIN_DEFAULT === "classic", "the default look is Classic");
check(figureSkin() === "classic", "nothing chosen → Classic");

// ── This device's choice, then a page's override on top ────────────────────
setStoredFigureSkin("3d");
check(store.get(FIGURE_SKIN_KEY) === "3d", "Settings' choice is kept on this device");
check(figureSkin() === "3d", "a stored 3D choice is used");
const undo = setFigureSkinOverride("classic");
check(figureSkin() === "classic", "the test screen's override wins while it is open");
check(storedFigureSkin() === "3d", "an override never rewrites the stored choice");
undo();
check(figureSkin() === "3d", "closing the test screen hands the look back");
setStoredFigureSkin(null);
check(figureSkin() === "classic" && !store.has(FIGURE_SKIN_KEY), "clearing the choice goes back to Classic");

// ── Hair: never bald, the same every frame, and genuinely varied ────────────
const keys = Array.from({ length: 200 }, (_, i) => `sp_${i}`);
const styles = new Set(keys.map((k) => hairFor(k).style));
const colours = new Set(keys.map((k) => hairFor(k).colour));
check(keys.every((k) => hairFor(k).style === hairFor(k).style && hairFor(k).colour === hairFor(k).colour), "a player's hair is the same every time");
check(styles.size >= 4, `at least 4 hair styles across 200 players (got ${styles.size})`);
check(colours.size >= 6, `at least 6 hair colours across 200 players (got ${colours.size})`);
const skins = new Set(keys.map(skinFor));
check(skins.size >= 5, `drawn heads get varied skin tones (got ${skins.size})`);

if (problems.length) {
  console.error("FAIL");
  for (const p of problems) console.error("  ✗ " + p);
  process.exit(1);
}
console.log("PASS — Classic by default, Settings then the test screen decide the look, and every drawn head has its own stable hair");
