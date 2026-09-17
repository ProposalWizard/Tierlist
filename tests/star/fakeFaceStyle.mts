/**
 * lib/star/fakeFaceStyle.ts (the fake-face editor's persisted style) and
 * lib/star/fakeFaces.ts (the picker/hash + the URL round-trip
 * drawPlayerHead.ts's isFakeFaceImage relies on to tell a fake face apart
 * from a real photo).
 *
 * Same split as faceStyle.mts: purely the storage/clamping/hashing half —
 * nothing here can exercise drawPlayerHead itself, which needs a real
 * CanvasRenderingContext2D/HTMLImageElement this test environment doesn't
 * have. isFakeFaceImage specifically can't be called directly (it takes an
 * HTMLImageElement), so what's verified here is the assumption it's BUILT
 * ON — that decodeURIComponent(new URL(resolved).pathname) recovers each
 * real FAKE_FACES path exactly, for all seven, not just spot-checked ones.
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
  loadFakeFaceStyle, saveFakeFaceStyle, DEFAULT_FAKE_FACE_STYLE,
} = await import("../../lib/star/fakeFaceStyle");
const { FACE_SCALE_RANGE, FACE_OFFSET_RANGE, CROP_ZOOM_RANGE } = await import("../../lib/star/faceStyle");
const { FAKE_FACES, DEFAULT_FAKE_FACE, fakeFaceFor } = await import("../../lib/star/fakeFaces");

// ── isFakeFaceImage's own real assumption, checked for every real path ────
//
// A browser resolves `img.src = "/ChatGPT Image Sep 15, 2026, 11_23_12
// PM.png"` to an absolute, percent-encoded URL — the exact reverse of this
// (decode the resolved pathname) is how drawPlayerHead.ts tells a fake face
// apart from a real photo without any caller needing to say so explicitly.
// Verified here for all seven real filenames (spaces, commas and all), not
// assumed from one manual check.
{
  let mismatches = 0;
  for (const path of FAKE_FACES) {
    const resolved = new URL(path, "https://knowitball.co.uk/").href;
    const decoded = decodeURIComponent(new URL(resolved).pathname);
    if (decoded !== path) mismatches++;
  }
  check(mismatches === 0, `every real FAKE_FACES path round-trips through URL resolution exactly (${mismatches}/${FAKE_FACES.length} did not)`);
  check(FAKE_FACES.length === 7, `seven real fake faces, as uploaded (${FAKE_FACES.length})`);
  check(DEFAULT_FAKE_FACE === FAKE_FACES[0], "the default fake face is the first one, as asked");
}

// ── fakeFaceFor: stable, always one of the seven, genuinely spread ────────
{
  const a = fakeFaceFor("player-a");
  const b = fakeFaceFor("player-a");
  check(a === b, "the same key always picks the same face");
  check(FAKE_FACES.includes(a), "always one of the real seven, never something else");

  const seen = new Set<string>();
  for (let i = 0; i < 200; i++) seen.add(fakeFaceFor(`p${i}`));
  check(seen.size >= 5, `200 distinct keys reach a real spread across the seven faces (${seen.size} distinct faces seen)`);

  // The whole reason for keying generateSquad's own call off seed+id, not
  // just id — two different clubs' identically-positioned players (both
  // "sp_0", the generated GK) must NOT collide onto the same face.
  check(fakeFaceFor("11:sp_0") !== fakeFaceFor("22:sp_0") || fakeFaceFor("33:sp_0") !== fakeFaceFor("11:sp_0"),
    "different seeds spread the same positional id across different faces (not guaranteed every pair, but not every pair collides either)");
}

// ── FakeFaceStyle range floors match FaceStyle's own (shared sliders) ─────
{
  check(FACE_SCALE_RANGE[1] >= 5, `scale range shared with FaceStyle (${FACE_SCALE_RANGE[1]})`);
  check(FACE_OFFSET_RANGE[1] >= 3, `offset range shared with FaceStyle (${FACE_OFFSET_RANGE[1]})`);
}

// ── Nothing stored yet: the real default, byte for byte ───────────────────
{
  const s = loadFakeFaceStyle();
  check(JSON.stringify(s) === JSON.stringify(DEFAULT_FAKE_FACE_STYLE), "nothing stored: exactly the default");
}

// ── A real round trip ───────────────────────────────────────────────────
{
  store.clear();
  const custom = { scale: 1.8, offsetX: 0.3, offsetY: -0.15, crop: { zoom: 2.1, x: -40, y: 12 } };
  saveFakeFaceStyle(custom);
  const back = loadFakeFaceStyle();
  check(JSON.stringify(back) === JSON.stringify(custom), `round-trips exactly (${JSON.stringify(back)})`);
}

// ── Clamped, not rejected ───────────────────────────────────────────────
{
  store.clear();
  saveFakeFaceStyle({ scale: 999, offsetX: -999, offsetY: 999, crop: { zoom: 999, x: 999999, y: -999999 } });
  const back = loadFakeFaceStyle();
  check(back.scale === FACE_SCALE_RANGE[1], `scale clamped to the real max (${back.scale})`);
  check(back.offsetX === FACE_OFFSET_RANGE[0], `offsetX clamped to the real min (${back.offsetX})`);
  check(back.offsetY === FACE_OFFSET_RANGE[1], `offsetY clamped to the real max (${back.offsetY})`);
  check(back.crop.zoom === CROP_ZOOM_RANGE[1], `crop zoom clamped to the real max (${back.crop.zoom})`);
  check(Number.isFinite(back.crop.x) && Number.isFinite(back.crop.y), "crop x/y stay finite even from an absurd input");
}

// ── A missing crop (an old/partial save) still loads with the real default ─
{
  store.clear();
  store.set("star-fake-face-style", JSON.stringify({ scale: 1.6 }));
  const back = loadFakeFaceStyle();
  check(JSON.stringify(back.crop) === JSON.stringify(DEFAULT_FAKE_FACE_STYLE.crop),
    `no crop on record: falls back to the real default (${JSON.stringify(back.crop)})`);
  check(back.scale === 1.6, "…without losing the field that WAS on record");
}

// ── Corrupt data never throws, never crashes the game ──────────────────
{
  store.clear();
  store.set("star-fake-face-style", "{not valid json");
  let threw = false;
  let back = DEFAULT_FAKE_FACE_STYLE;
  try { back = loadFakeFaceStyle(); } catch { threw = true; }
  check(!threw, "malformed saved JSON does not throw");
  check(JSON.stringify(back) === JSON.stringify(DEFAULT_FAKE_FACE_STYLE), "…and falls back to the real default");
}

if (problems.length) {
  console.error("FAIL");
  for (const p of problems) console.error("  ✗ " + p);
  process.exit(1);
}
console.log("PASS — the fake face style saves, loads, clamps and never throws on bad data; the URL round-trip isFakeFaceImage relies on holds for all seven real filenames");
