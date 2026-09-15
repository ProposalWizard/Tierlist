/**
 * lib/star/faceOutline.ts — the real detected-face outline shape.
 *
 * Two things are genuinely testable without a browser: ellipseFromBox (pure
 * math) and the get/request cache-and-memoise logic, via requestFaceOutline's
 * injectable `detect` param. The actual face-api.js detection call itself
 * (lib/faceDetection.ts's detectFaceBoxFromUrl) needs a real DOM/canvas this
 * test environment doesn't have — same limitation this whole faces feature
 * has always had for drawPlayerHead itself. See CLAUDE.md's own note on this.
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
  ellipseFromBox, getFaceOutline, requestFaceOutline, PAD_X, PAD_Y_TOP, PAD_Y_BOTTOM,
} = await import("../../lib/star/faceOutline");

// ── ellipseFromBox: a real worked example against the real constants ──────
{
  const box = { x: 0.3, y: 0.2, width: 0.2, height: 0.3 };
  const padX = box.width * PAD_X;
  const padTop = box.height * PAD_Y_TOP;
  const padBottom = box.height * PAD_Y_BOTTOM;
  const expected = {
    cx: box.x + box.width / 2,
    cy: (box.y - padTop + box.y + box.height + padBottom) / 2,
    rx: box.width / 2 + padX,
    ry: (box.height + padTop + padBottom) / 2,
  };
  const got = ellipseFromBox(box);
  const close = (a: number, b: number) => Math.abs(a - b) < 1e-9;
  check(close(got.cx, expected.cx), `cx matches the real padded-box centre (${got.cx} vs ${expected.cx})`);
  check(close(got.cy, expected.cy), `cy matches the real padded-box centre (${got.cy} vs ${expected.cy})`);
  check(close(got.rx, expected.rx), `rx matches half the real padded width (${got.rx} vs ${expected.rx})`);
  check(close(got.ry, expected.ry), `ry matches half the real padded height (${got.ry} vs ${expected.ry})`);
}

// ── The padding is genuinely asymmetric top/bottom — biased up toward the
// hairline, same reasoning lib/faceDetection.ts's own boxToFaceCenter uses ──
{
  const box = { x: 0.1, y: 0.4, width: 0.15, height: 0.15 };
  const e = ellipseFromBox(box);
  const boxCy = box.y + box.height / 2;
  check(e.cy < boxCy, `the ellipse centre sits ABOVE the raw box's own centre (${e.cy} vs ${boxCy})`);
  check(PAD_Y_TOP > PAD_Y_BOTTOM, "…because the real constants pad more above than below");
}

// ── Nothing known yet ───────────────────────────────────────────────────
{
  check(getFaceOutline("https://example.com/never-seen.png") === undefined,
    "a URL never requested: undefined, not null — genuinely unknown, not a known miss");
}

// ── A real detection resolving to a real box ────────────────────────────
{
  const box = { x: 0.25, y: 0.15, width: 0.3, height: 0.35 };
  let calls = 0;
  const fakeDetect = async (_url: string) => { calls++; return box; };
  await requestFaceOutline("https://example.com/a.png", fakeDetect);
  const shape = getFaceOutline("https://example.com/a.png");
  check(shape !== null && shape !== undefined, "a real box resolves to a real, known ellipse");
  check(JSON.stringify(shape) === JSON.stringify(ellipseFromBox(box)),
    `…the exact ellipseFromBox(box) result, not a re-derived approximation (${JSON.stringify(shape)})`);
  check(calls === 1, "the fake detector was actually called exactly once");
}

// ── Memoised: a second request for the SAME url never detects again ────
{
  let calls = 0;
  const fakeDetect = async (_url: string) => { calls++; return { x: 0, y: 0, width: 0.1, height: 0.1 }; };
  await requestFaceOutline("https://example.com/a.png", fakeDetect);
  check(calls === 0, "already-known URL: the detector is never called a second time");
}

// ── A real "no face found" is a known null, not left perpetually unknown ──
{
  const fakeDetect = async (_url: string) => null;
  await requestFaceOutline("https://example.com/b.png", fakeDetect);
  const shape = getFaceOutline("https://example.com/b.png");
  check(shape === null, `no face found: a real known null, not undefined (${shape})`);
}

// ── A rejected detection resolves the same as "found nothing" — never throws ──
{
  let threw = false;
  const fakeDetect = async (_url: string): Promise<{ x: number; y: number; width: number; height: number } | null> => {
    throw new Error("network error, or the model failed to load");
  };
  try {
    await requestFaceOutline("https://example.com/c.png", fakeDetect);
  } catch {
    threw = true;
  }
  check(!threw, "a rejected detector promise does not throw out of requestFaceOutline");
  check(getFaceOutline("https://example.com/c.png") === null,
    "…and still resolves to a real known null, exactly like a clean 'no face found'");
}

// ── A cold read from localStorage — no detection needed, another device/
// session already found this one ───────────────────────────────────────
{
  const preSeeded = { cx: 0.5, cy: 0.4, rx: 0.2, ry: 0.25 };
  store.set("star-face-outline-v1", JSON.stringify({ "https://example.com/d.png": preSeeded }));
  const shape = getFaceOutline("https://example.com/d.png");
  check(JSON.stringify(shape) === JSON.stringify(preSeeded),
    `a value already in localStorage reads back without ever calling a detector (${JSON.stringify(shape)})`);
}

// ── Corrupt localStorage never throws, never crashes the game ──────────
{
  store.set("star-face-outline-v1", "{not valid json");
  let threw = false;
  let shape: unknown;
  try { shape = getFaceOutline("https://example.com/e.png"); } catch { threw = true; }
  check(!threw, "malformed cache JSON does not throw");
  check(shape === undefined, "…and reads back as genuinely unknown, not a corrupted value");
}

if (problems.length) {
  console.error("FAIL");
  for (const p of problems) console.error("  ✗ " + p);
  process.exit(1);
}
console.log("PASS — the face outline ellipse math, cache, memoisation, and error handling all check out");
