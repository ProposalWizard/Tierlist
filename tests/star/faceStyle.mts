/**
 * lib/star/faceStyle.ts — the Face Editor's own persisted style object.
 *
 * Purely the storage/clamping half (loadFaceStyle/saveFaceStyle); nothing
 * here can exercise drawPlayerHead itself, which needs a real
 * CanvasRenderingContext2D this test environment doesn't have — that half
 * is only verified by tsc, the full suite staying green, and reading the
 * canvas math by hand. See CLAUDE.md's own note on this.
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

const store = freshStore();
const { loadFaceStyle, saveFaceStyle, DEFAULT_FACE_STYLE } = await import("../../lib/star/faceStyle");

// ── Nothing stored yet: the real default, byte for byte ───────────────────
{
  const s = loadFaceStyle();
  check(JSON.stringify(s) === JSON.stringify(DEFAULT_FACE_STYLE), "nothing stored: exactly the default");
}

// ── A real round trip ───────────────────────────────────────────────────
{
  store.clear();
  const custom = {
    scale: 1.8, offsetX: 0.3, offsetY: -0.15,
    showBacking: false, backingColor: "#112233",
    outlineEnabled: false, outlineColor: "#ffcc00", outlineWidth: 2.5,
  };
  saveFaceStyle(custom);
  const back = loadFaceStyle();
  check(JSON.stringify(back) === JSON.stringify(custom), `round-trips exactly (${JSON.stringify(back)})`);
}

// ── Clamped, not rejected ───────────────────────────────────────────────
{
  store.clear();
  saveFaceStyle({
    scale: 99, offsetX: -99, offsetY: 99,
    showBacking: true, backingColor: "#fff",
    outlineEnabled: true, outlineColor: "#000", outlineWidth: -5,
  });
  const back = loadFaceStyle();
  check(back.scale <= 3 && back.scale >= 0.5, `scale clamped into range (${back.scale})`);
  check(back.offsetX === -1, `offsetX clamped to -1 (${back.offsetX})`);
  check(back.offsetY === 1, `offsetY clamped to 1 (${back.offsetY})`);
  check(back.outlineWidth === 0, `outlineWidth never negative (${back.outlineWidth})`);
}

// ── The old single-slider save, carried over once ──────────────────────
{
  store.clear();
  store.set("star-face-scale", "1.65");
  const back = loadFaceStyle();
  check(back.scale === 1.65, `an old slider value seeds the new scale (${back.scale})`);
  check(back.offsetX === 0 && back.showBacking === true, "…and everything else is still the real default");
}

// ── Corrupt data never throws, never crashes the game ──────────────────
{
  store.clear();
  store.set("star-face-style", "{not valid json");
  let threw = false;
  let back = DEFAULT_FACE_STYLE;
  try { back = loadFaceStyle(); } catch { threw = true; }
  check(!threw, "malformed saved JSON does not throw");
  check(JSON.stringify(back) === JSON.stringify(DEFAULT_FACE_STYLE), "…and falls back to the real default");
}

if (problems.length) {
  console.error("FAIL");
  for (const p of problems) console.error("  ✗ " + p);
  process.exit(1);
}
console.log("PASS — the face style saves, loads, clamps, migrates the old slider, and never throws on bad data");
