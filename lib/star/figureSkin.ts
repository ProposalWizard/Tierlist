/**
 * WHICH LOOK THE PLAYERS ARE DRAWN IN — "classic" or "3d".
 *
 * Harry, 28 Sep 2026, about the home screen's A2 "pseudo-3D" avatar: "how
 * ambitious is it to reskin the whole game to this 3d skin because this looks
 * incredible". "3d" draws every footballer on every screen in that style
 * (lib/star/figure3d.ts): shaded limbs with a lit and a dark side, kit folds,
 * a rim light, socks and boots, a soft shadow and the face-fit head. It is a
 * LOOK only — nothing here or there is read by the engine, so where a man
 * stands, what he reaches and what the ball does are exactly the same.
 *
 * ONE place decides it, read by every renderer at draw time:
 *
 *   1. an override set by a screen that wants a fixed look (the /star-3d-dev
 *      test screen forces "3d", or "classic" for its side-by-side), then
 *   2. this browser's choice, localStorage "star-figure-skin", then
 *   3. FIGURE_SKIN_DEFAULT — "classic", so the real game looks exactly as it
 *      did until Harry says otherwise.
 *
 * It is a module-level value rather than a prop threaded through every mount,
 * so no screen needs a new prop to follow it (and the one-engine guard's
 * "the real match passes X and EnginePlay does not" check has nothing new to
 * compare). A single draw call can still ask for a look outright with the
 * `skin` draw option (fiveASide/render.ts's FigureDrawOpts).
 */

export type FigureSkin = "classic" | "3d";

/** THE ONE LINE: the look everyone gets when nobody has chosen. */
export const FIGURE_SKIN_DEFAULT: FigureSkin = "classic";

export const FIGURE_SKIN_KEY = "star-figure-skin";

let override: FigureSkin | null = null;
let stored: FigureSkin | null | undefined; // undefined = not read yet
const listeners = new Set<() => void>();

function readStored(): FigureSkin | null {
  try {
    if (typeof localStorage === "undefined") return null;
    const v = localStorage.getItem(FIGURE_SKIN_KEY);
    return v === "3d" || v === "classic" ? v : null;
  } catch {
    return null; // private mode / blocked storage: the default stands
  }
}

if (typeof window !== "undefined") {
  // Another tab (or Settings) changed it: pick it up on the next frame.
  window.addEventListener("storage", (e) => {
    if (e.key === FIGURE_SKIN_KEY) { stored = undefined; listeners.forEach((f) => f()); }
  });
}

/** The look to draw in right now. Cheap: called for every figure, every frame. */
export function figureSkin(): FigureSkin {
  if (override) return override;
  if (stored === undefined) stored = readStored();
  return stored ?? FIGURE_SKIN_DEFAULT;
}

/** This browser's own choice (Settings). null clears it back to the default. */
export function setStoredFigureSkin(skin: FigureSkin | null): void {
  try {
    if (skin) localStorage.setItem(FIGURE_SKIN_KEY, skin);
    else localStorage.removeItem(FIGURE_SKIN_KEY);
  } catch { /* the in-memory value below still changes this page */ }
  stored = skin;
  listeners.forEach((f) => f());
}

/** The stored choice only (what Settings shows), ignoring any override. */
export function storedFigureSkin(): FigureSkin {
  if (stored === undefined) stored = readStored();
  return stored ?? FIGURE_SKIN_DEFAULT;
}

/**
 * Force a look while a screen is open (the test screen). Returns the undo,
 * so a React effect can hand it straight back as its cleanup.
 */
export function setFigureSkinOverride(skin: FigureSkin | null): () => void {
  const before = override;
  override = skin;
  listeners.forEach((f) => f());
  return () => { override = before; listeners.forEach((f) => f()); };
}

/** For a still picture (drawn once, not every frame) that must redraw when
 *  the look changes. Returns the unsubscribe. */
export function onFigureSkinChange(f: () => void): () => void {
  listeners.add(f);
  return () => { listeners.delete(f); };
}
