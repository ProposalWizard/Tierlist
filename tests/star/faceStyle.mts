/**
 * lib/star/faceStyle.ts — the Face Editor's own persisted style object.
 *
 * The storage/clamping half (loadFaceStyle/saveFaceStyle/hasFaceStyleOverride)
 * plus fetchGlobalDefaultFaceStyle (the admin global default — a real fetch()
 * boundary, faked here the same way localStorage is). Nothing here can
 * exercise drawPlayerHead itself, which needs a real CanvasRenderingContext2D
 * this test environment doesn't have — that half, and where facesEnabled/
 * namesEnabled/the label position math actually draw, is only verified by
 * tsc, the full suite staying green, and reading the canvas math by hand.
 * See CLAUDE.md's own note on this.
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
const {
  loadFaceStyle, saveFaceStyle, DEFAULT_FACE_STYLE, FACE_SCALE_RANGE, FACE_OFFSET_RANGE, CROP_ZOOM_RANGE,
  hasFaceStyleOverride, fetchGlobalDefaultFaceStyle,
} = await import("../../lib/star/faceStyle");

// ── Real freedom, not the original too-tight range ─────────────────────────
//
// Reported directly after the first version: "let me put the faces higher
// and bigger (give me more freedom to customise)". A pinned floor, not an
// exact number, so a future re-tune can still widen this further without
// this test needing to change — it only fails if it ever narrows back down.
{
  check(FACE_SCALE_RANGE[1] >= 5, `scale can go at least to 5x (${FACE_SCALE_RANGE[1]})`);
  check(FACE_OFFSET_RANGE[1] >= 3, `offset can move at least 3 head-radii (${FACE_OFFSET_RANGE[1]})`);
  check(FACE_OFFSET_RANGE[0] === -FACE_OFFSET_RANGE[1], "the offset range is symmetric either side of centred");
}

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
    crop: { zoom: 2.1, x: -40, y: 12 },
    facesEnabled: false, namesEnabled: true,
  };
  saveFaceStyle(custom);
  const back = loadFaceStyle();
  check(JSON.stringify(back) === JSON.stringify(custom), `round-trips exactly (${JSON.stringify(back)})`);
}

// ── Clamped, not rejected ───────────────────────────────────────────────
{
  store.clear();
  saveFaceStyle({
    scale: 999, offsetX: -999, offsetY: 999,
    showBacking: true, backingColor: "#fff",
    outlineEnabled: true, outlineColor: "#000", outlineWidth: -5,
    crop: { zoom: 999, x: 999999, y: -999999 },
    facesEnabled: true, namesEnabled: false,
  });
  const back = loadFaceStyle();
  check(back.scale === FACE_SCALE_RANGE[1], `scale clamped to the real max (${back.scale})`);
  check(back.offsetX === FACE_OFFSET_RANGE[0], `offsetX clamped to the real min (${back.offsetX})`);
  check(back.offsetY === FACE_OFFSET_RANGE[1], `offsetY clamped to the real max (${back.offsetY})`);
  check(back.outlineWidth === 0, `outlineWidth never negative (${back.outlineWidth})`);
  check(back.crop.zoom === CROP_ZOOM_RANGE[1], `crop zoom clamped to the real max (${back.crop.zoom})`);
  check(Number.isFinite(back.crop.x) && Number.isFinite(back.crop.y), "crop x/y stay finite even from an absurd input");
}

// ── The two new toggles coerce to real booleans from anything, never throw ──
{
  store.clear();
  store.set("star-face-style", JSON.stringify({ facesEnabled: "yes", namesEnabled: 0 }));
  const back = loadFaceStyle();
  check(back.facesEnabled === true, `a truthy non-boolean still reads as on (${back.facesEnabled})`);
  check(back.namesEnabled === false, `a falsy non-boolean still reads as off (${back.namesEnabled})`);
}

// ── A missing crop (an old save from before this field existed) still loads ──
{
  store.clear();
  store.set("star-face-style", JSON.stringify({ scale: 1.6 }));
  const back = loadFaceStyle();
  check(JSON.stringify(back.crop) === JSON.stringify(DEFAULT_FACE_STYLE.crop),
    `no crop on record: falls back to the real default (${JSON.stringify(back.crop)})`);
  check(back.scale === 1.6, "…without losing the field that WAS on record");
}

// ── An old save from before facesEnabled/namesEnabled existed still loads,
// with the real defaults filled in (faces on, names off) ─────────────────
{
  store.clear();
  store.set("star-face-style", JSON.stringify({ scale: 2.2, outlineEnabled: false }));
  const back = loadFaceStyle();
  check(back.facesEnabled === true, `no record of it: falls back to the real default, on (${back.facesEnabled})`);
  check(back.namesEnabled === false, `no record of it: falls back to the real default, off (${back.namesEnabled})`);
  check(back.scale === 2.2 && back.outlineEnabled === false, "…without losing the fields that WERE on record");
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

// ── hasFaceStyleOverride: exactly "has this device ever saved its own" ──
{
  store.clear();
  check(hasFaceStyleOverride() === false, "nothing saved yet: no override");
  saveFaceStyle(DEFAULT_FACE_STYLE);
  check(hasFaceStyleOverride() === true, "saved once, even the default verbatim: now an override");

  store.clear();
  store.set("star-face-scale", "1.2");
  check(hasFaceStyleOverride() === true, "the OLD single-slider save counts as an override too");
}

// ── fetchGlobalDefaultFaceStyle: the admin's own default, real fetch shapes ──
// Faked rather than skipped — this is the one new piece of faceStyle.ts that
// isn't pure storage/clamping, and it is fully exercisable without a real
// server: only global fetch() is a boundary, same idea as the localStorage
// fake at the top of this file.
{
  const realFetch = globalThis.fetch;

  (globalThis as { fetch?: unknown }).fetch = async () =>
    ({ ok: true, json: async () => ({ style: { scale: 2.5, offsetY: -1, facesEnabled: false } }) });
  {
    const g = await fetchGlobalDefaultFaceStyle();
    check(g !== null, "a real { style } response resolves to a real style, not null");
    check(g?.scale === 2.5 && g?.offsetY === -1 && g?.facesEnabled === false,
      `…carrying the fields the server actually sent (${JSON.stringify(g)})`);
    check(g?.namesEnabled === false && g?.outlineEnabled === true,
      "…and sanitized through the exact same defaults/clamp as any locally-saved style");
  }

  (globalThis as { fetch?: unknown }).fetch = async () => ({ ok: true, json: async () => ({ style: null }) });
  check(await fetchGlobalDefaultFaceStyle() === null,
    "the migration has run but no admin has set one yet (style: null): no global default, not a crash");

  (globalThis as { fetch?: unknown }).fetch = async () => ({ ok: false, json: async () => ({ error: "boom" }) });
  check(await fetchGlobalDefaultFaceStyle() === null, "a non-ok response (migration not run yet, or a real error): null, not a throw");

  (globalThis as { fetch?: unknown }).fetch = async () => { throw new Error("offline"); };
  check(await fetchGlobalDefaultFaceStyle() === null, "fetch itself rejecting (offline): null, not a throw");

  (globalThis as { fetch?: unknown }).fetch = realFetch;
}

if (problems.length) {
  console.error("FAIL");
  for (const p of problems) console.error("  ✗ " + p);
  process.exit(1);
}
console.log("PASS — the face style saves, loads, clamps, migrates the old slider, and never throws on bad data");
