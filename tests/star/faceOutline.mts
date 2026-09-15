/**
 * lib/star/faceOutline.ts — the real detected-face jaw CONTOUR outline.
 *
 * Two things are genuinely testable without a browser: contourFromLandmarks
 * (pure math) and the get/request cache-and-memoise logic, via
 * requestFaceContour's injectable `detect` param. The actual face-api.js
 * detection call itself (lib/faceDetection.ts's detectFaceLandmarksFromUrl)
 * needs a real DOM/canvas this test environment doesn't have — same
 * limitation this whole faces feature has always had for drawPlayerHead
 * itself. See CLAUDE.md's own note on this.
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
const { contourFromLandmarks, getFaceContour, requestFaceContour } = await import("../../lib/star/faceOutline");

// A real, plausible 17-point jaw outline: roughly symmetric, ear-height
// endpoints at y=0.35, chin tip (index 8) at the bottom, y=0.70.
function fakeJaw() {
  const jaw = [];
  for (let i = 0; i <= 16; i++) {
    const t = i / 16; // 0 → 1 across the 17 points
    const x = 0.3 + t * 0.4; // 0.3 → 0.7
    // A rough U: high at the ends (ears), low in the middle (chin).
    const bow = Math.sin(t * Math.PI); // 0 at ends, 1 in the middle
    const y = 0.35 + bow * 0.35;
    jaw.push({ x, y });
  }
  return jaw;
}

// ── contourFromLandmarks: real geometry, not an arbitrary guess ────────────
{
  const jaw = fakeJaw();
  const browTop = 0.20; // above the jaw's own ear-height points (0.35)
  const contour = contourFromLandmarks({ jaw, browTop });

  check(contour.length === jaw.length + 3,
    `the jaw's own 17 points plus exactly 3 cap points (${contour.length})`);

  // The first 17 points are the real jaw data, verbatim — never altered.
  const jawPart = contour.slice(0, jaw.length);
  check(JSON.stringify(jawPart) === JSON.stringify(jaw),
    "the real detected jaw points pass through completely unchanged");

  const [rightTemple, crown, leftTemple] = contour.slice(jaw.length);
  const jawTop = Math.min(jaw[0].y, jaw[jaw.length - 1].y);
  const gap = jawTop - browTop;

  check(rightTemple.x === jaw[jaw.length - 1].x, "the right temple sits directly above the jaw's own right end");
  check(leftTemple.x === jaw[0].x, "the left temple sits directly above the jaw's own left end");
  check(rightTemple.y === leftTemple.y, "both temples sit at the same height — a level cap, not a tilted one");
  check(rightTemple.y < browTop, "the cap sits ABOVE the eyebrows, not at or below them — real forehead room");
  check(crown.y < rightTemple.y, "the crown peaks above the temples — a dome, not a flat top");
  check(Math.abs(crown.x - (jaw[0].x + jaw[jaw.length - 1].x) / 2) < 1e-9,
    "the crown sits centred between the jaw's own two ends");

  // A real, PROPORTIONAL cap — a face with a bigger brow-to-jaw gap gets a
  // taller cap too, not one fixed guess regardless of that face's own scale.
  const gap2x = contourFromLandmarks({ jaw, browTop: jawTop - gap * 2 });
  const capHeight1 = jawTop - rightTemple.y;
  const capHeight2 = jawTop - gap2x[jaw.length].y;
  check(capHeight2 > capHeight1 * 1.5,
    `a real double-size brow gap produces a real taller cap, not the same fixed offset (${capHeight1} vs ${capHeight2})`);
}

// ── Nothing known yet ───────────────────────────────────────────────────
{
  check(getFaceContour("https://example.com/never-seen.png") === undefined,
    "a URL never requested: undefined, not null — genuinely unknown, not a known miss");
}

// ── A real detection resolving to a real contour ────────────────────────
{
  const jaw = fakeJaw();
  const data = { jaw, browTop: 0.20 };
  let calls = 0;
  const fakeDetect = async (_url: string) => { calls++; return data; };
  await requestFaceContour("https://example.com/a.png", fakeDetect);
  const contour = getFaceContour("https://example.com/a.png");
  check(contour !== null && contour !== undefined, "real landmark data resolves to a real, known contour");
  check(JSON.stringify(contour) === JSON.stringify(contourFromLandmarks(data)),
    `…the exact contourFromLandmarks(data) result, not a re-derived approximation (${JSON.stringify(contour)})`);
  check(calls === 1, "the fake detector was actually called exactly once");
}

// ── Memoised: a second request for the SAME url never detects again ────
{
  let calls = 0;
  const fakeDetect = async (_url: string) => { calls++; return { jaw: fakeJaw(), browTop: 0.1 }; };
  await requestFaceContour("https://example.com/a.png", fakeDetect);
  check(calls === 0, "already-known URL: the detector is never called a second time");
}

// ── A real "no face found" is a known null, not left perpetually unknown ──
{
  const fakeDetect = async (_url: string) => null;
  await requestFaceContour("https://example.com/b.png", fakeDetect);
  const contour = getFaceContour("https://example.com/b.png");
  check(contour === null, `no face found: a real known null, not undefined (${contour})`);
}

// ── A rejected detection resolves the same as "found nothing" — never throws ──
{
  let threw = false;
  const fakeDetect = async (_url: string): Promise<{ jaw: { x: number; y: number }[]; browTop: number } | null> => {
    throw new Error("network error, or the model failed to load");
  };
  try {
    await requestFaceContour("https://example.com/c.png", fakeDetect);
  } catch {
    threw = true;
  }
  check(!threw, "a rejected detector promise does not throw out of requestFaceContour");
  check(getFaceContour("https://example.com/c.png") === null,
    "…and still resolves to a real known null, exactly like a clean 'no face found'");
}

// ── A cold read from localStorage — no detection needed, another device/
// session already found this one ───────────────────────────────────────
{
  const preSeeded = [{ x: 0.4, y: 0.4 }, { x: 0.5, y: 0.5 }, { x: 0.6, y: 0.4 }];
  store.set("star-face-contour-v1", JSON.stringify({ "https://example.com/d.png": preSeeded }));
  const contour = getFaceContour("https://example.com/d.png");
  check(JSON.stringify(contour) === JSON.stringify(preSeeded),
    `a value already in localStorage reads back without ever calling a detector (${JSON.stringify(contour)})`);
}

// ── Corrupt localStorage never throws, never crashes the game ──────────
{
  store.set("star-face-contour-v1", "{not valid json");
  let threw = false;
  let contour: unknown;
  try { contour = getFaceContour("https://example.com/e.png"); } catch { threw = true; }
  check(!threw, "malformed cache JSON does not throw");
  check(contour === undefined, "…and reads back as genuinely unknown, not a corrupted value");
}

if (problems.length) {
  console.error("FAIL");
  for (const p of problems) console.error("  ✗ " + p);
  process.exit(1);
}
console.log("PASS — the face contour geometry, cache, memoisation, and error handling all check out");
