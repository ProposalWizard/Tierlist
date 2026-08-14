import {
  clampOffset, coverScale, initialView, portraitBytes, sourceRect, MAX_PORTRAIT_BYTES,
} from "../../lib/star/portrait";

/**
 * THE CROP.
 *
 * Everything about a photograph in this game is geometry, and geometry is the
 * part that fails quietly: a crop that lets you drag past the edge exports a
 * square with a strip of blank canvas down one side, and the export happens
 * offscreen so nobody sees it happen. So the invariant is stated once and then
 * fuzzed — whatever the picture's shape and wherever it has been dragged, the
 * rectangle taken from it lies entirely inside it.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

function mulberry(a: number) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const V = 224;
const near = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) < eps;

// ── Cover, not contain ──────────────────────────────────────────────────────
{
  // A phone photograph: tall. The square has to be filled by its width.
  check(near(coverScale(1080, 1920, V), V / 1080), "a tall picture is scaled by its width");
  // A laptop webcam: wide. Filled by its height.
  check(near(coverScale(1920, 1080, V), V / 1080), "a wide picture is scaled by its height");
  check(near(coverScale(500, 500, V), V / 500), "a square picture fits exactly");
  check(coverScale(0, 0, V) === 1, "a picture with no size does not divide by zero");
}

// ── It opens centred ────────────────────────────────────────────────────────
{
  const v = initialView(1080, 1920, V);
  check(v.zoom === 1, "it opens at the scale that just covers");
  check(near(v.x, 0), "a tall picture has no room to move sideways");
  check(v.y < 0, `and is pulled up to centre it (${v.y.toFixed(1)})`);

  const w = initialView(1920, 1080, V);
  check(w.x < 0 && near(w.y, 0), "a wide one is centred the other way");

  // Centred means centred: the source rectangle sits in the middle.
  const r = sourceRect(v, 1080, 1920, V);
  check(near(r.sx, 0) && near(r.sw, 1080), "the full width of a tall picture is used");
  check(near(r.sy, (1920 - 1080) / 2), `and the middle of its height (${r.sy})`);
}

// ── Whatever you do to it, the square stays covered ─────────────────────────
{
  const rng = mulberry(4);
  let escaped = 0, outside = 0;
  for (let i = 0; i < 4000; i++) {
    const iw = 60 + Math.floor(rng() * 4000);
    const ih = 60 + Math.floor(rng() * 4000);
    // Drags well past both edges, and zooms below the minimum.
    const dragged = {
      zoom: rng() * 4 - 0.5,
      x: (rng() - 0.5) * 4000,
      y: (rng() - 0.5) * 4000,
    };
    const c = clampOffset(dragged, iw, ih, V);
    const s = coverScale(iw, ih, V) * c.zoom;

    if (c.zoom < 1) escaped++;
    // The drawn image must still reach both far edges of the viewport.
    if (c.x > 1e-6 || c.y > 1e-6 || c.x + iw * s < V - 1e-6 || c.y + ih * s < V - 1e-6) escaped++;

    const r = sourceRect(dragged, iw, ih, V);
    if (r.sx < -1e-6 || r.sy < -1e-6 || r.sx + r.sw > iw + 1e-6 || r.sy + r.sh > ih + 1e-6) outside++;
  }
  check(escaped === 0, `no drag or zoom can uncover the square (${escaped} of 4000)`);
  check(outside === 0, `and no crop takes pixels the picture does not have (${outside} of 4000)`);
}

// ── Zooming in takes less of the picture ────────────────────────────────────
{
  const a = sourceRect({ zoom: 1, x: 0, y: 0 }, 1000, 1000, V);
  const b = sourceRect({ zoom: 2, x: 0, y: 0 }, 1000, 1000, V);
  check(b.sw < a.sw, `zoomed in is a smaller crop (${b.sw.toFixed(0)} < ${a.sw.toFixed(0)})`);
  check(near(b.sw, a.sw / 2), "and twice the zoom is half the crop");
  check(near(a.sw, a.sh) && near(b.sw, b.sh), "the crop is always square");
}

// ── The size guard ──────────────────────────────────────────────────────────
{
  // Base64 is four characters for every three bytes, and the header is not data.
  const uri = "data:image/webp;base64," + "A".repeat(4000);
  check(Math.abs(portraitBytes(uri) - 3000) <= 1, `bytes are counted, not characters (${portraitBytes(uri)})`);
  check(portraitBytes("nonsense") === 8, "a string that is not a data URI is measured as itself");
  // A career that will not save is worse than a career with no photograph on it,
  // and the failure arrives on a later write with nothing to connect it to.
  check(MAX_PORTRAIT_BYTES < 200_000, `the cap leaves the save budget alone (${MAX_PORTRAIT_BYTES})`);
}

if (problems.length) {
  console.error("FAIL");
  for (const p of problems.slice(0, 15)) console.error("  ✗ " + p);
  if (problems.length > 15) console.error(`  …and ${problems.length - 15} more`);
  process.exit(1);
}
console.log("PASS — a square crop that always lies inside the picture it was taken from");
