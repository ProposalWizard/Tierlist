/**
 * Visual Effects Lab (lib/star/vfxLab.ts, /star-vfx-lab-dev): every event has
 * at least six made-up variants plus "Current" and "Off"; every recipe draws
 * at every filmstrip moment (and with every dial at both ends) without
 * throwing, and actually draws something; the drawing is deterministic;
 * dials clamp; the export text has the shape we read back; and the real
 * match is untouched unless a screen passes `vfxOverride` (every use of it in
 * CanvasMatch sits behind the prop, and the career screen never passes it).
 */
import { readFileSync } from "node:fs";
import {
  VFX_EVENTS, VFX_VARIANTS, PARAM_INFO, NUM_KEYS, STYLE_PARAMS, FILM_SLICES, DEFAULT_PARAMS,
  drawVfx, drawVfxTrail, paintThumb, clampParams, editedRecipe, exportVfxPicks, picksToOverride,
  sanitizeNotes, vfxShake, vfxZoom, variantById, EMPTY_VFX_NOTES, type VfxRecipe,
} from "../../lib/star/vfxLab";

const problems: string[] = [];
const check = (ok: boolean, msg: string) => { if (!ok) problems.push(msg); };

/** A 2D context that records every call; gradients are recorded objects too. */
function fakeCtx() {
  const calls: string[] = [];
  const grad = () => ({ addColorStop: (o: number, c: string) => { if (!Number.isFinite(o) || o < 0 || o > 1) throw new Error(`bad stop ${o}`); calls.push(`stop ${c}`); } });
  const num = (name: string, args: unknown[]) => { for (const a of args) if (typeof a === "number" && !Number.isFinite(a)) throw new Error(`${name}: non-finite ${a}`); };
  const target: Record<string, unknown> = {
    createRadialGradient: (...a: unknown[]) => { num("createRadialGradient", a); if ((a[2] as number) < 0 || (a[5] as number) < 0) throw new Error("negative gradient radius"); return grad(); },
    createLinearGradient: (...a: unknown[]) => { num("createLinearGradient", a); return grad(); },
    arc: (...a: unknown[]) => { num("arc", a); if ((a[2] as number) < 0) throw new Error(`negative arc radius ${a[2]}`); calls.push("arc"); },
    ellipse: (...a: unknown[]) => { num("ellipse", a); if ((a[2] as number) < 0 || (a[3] as number) < 0) throw new Error("negative ellipse radius"); calls.push("ellipse"); },
    measureText: () => ({ width: 10 }),
  };
  const ctx = new Proxy(target, {
    get(t, k: string) {
      if (k in t) return t[k];
      return (...a: unknown[]) => { num(k, a); calls.push(k); };
    },
    set(t, k: string, v) { if (typeof v === "number" && !Number.isFinite(v)) throw new Error(`${k} = ${v}`); t[k] = v; calls.push(`set ${k}`); return true; },
  });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls };
}
const paints = (calls: string[]) => calls.filter((c) => /^(fill|stroke|fillRect|fillText|strokeText|strokeRect)$/.test(c)).length;

// 1. Every event has ≥6 real variants plus Current and Off; ids unique.
const ids = new Set<string>();
let variants = 0;
for (const e of VFX_EVENTS) {
  const list = VFX_VARIANTS[e.id];
  check(!!list, `${e.id}: has variants`);
  const made = list.filter((v) => !v.current && !v.off);
  check(made.length >= 6, `${e.id}: ${made.length} made-up variants (need ≥6)`);
  check(new Set(made.map((v) => v.recipe.style)).size >= 6, `${e.id}: at least 6 different styles (not one effect with other numbers)`);
  check(list.filter((v) => v.current).length === 1, `${e.id}: one "Current" entry`);
  check(list.filter((v) => v.off).length === 1, `${e.id}: one "Off" entry`);
  for (const v of list) {
    check(!ids.has(v.id), `unique id ${v.id}`);
    ids.add(v.id);
    check(v.event === e.id && v.id.startsWith(`${e.id}/`), `${v.id}: belongs to ${e.id}`);
    check(variantById(v.id) === v, `${v.id}: found by id`);
    check(JSON.stringify(clampParams(v.recipe.params)) === JSON.stringify(v.recipe.params), `${v.id}: shipped params are inside their sliders`);
    variants++;
  }
}

// 2. Every recipe draws at every filmstrip moment, as a thumb and in the
//    match's own call, without throwing — with dials as made, at their
//    minimums and at their maximums. Made-up variants actually paint.
let draws = 0;
for (const e of VFX_EVENTS) for (const v of VFX_VARIANTS[e.id]) {
  const lo: Record<string, number> = {}, hi: Record<string, number> = {};
  for (const k of NUM_KEYS) { lo[k] = PARAM_INFO[k].min; hi[k] = PARAM_INFO[k].max; }
  for (const [label, r] of [["made", v.recipe], ["min", editedRecipe(v, lo)], ["max", editedRecipe(v, hi)]] as [string, VfxRecipe][]) {
    let painted = 0;
    for (const u of [0, ...FILM_SLICES, 0.999]) {
      try {
        const a = fakeCtx(); paintThumb(a.ctx, e.id, r, u, 96, 120); draws++;
        const b = fakeCtx();
        if (e.id === "trail") drawVfxTrail(b.ctx, r, [{ x: 10, y: 50 }, { x: 30, y: 40 }, { x: 50, y: 36 }, { x: 70, y: 38 }], 4, 0.8, u);
        else drawVfx(b.ctx, e.id, r, u, { x: 100, y: 120, dx: 1, dy: -0.5, s: 40, power: 0.9, w: 390, h: 600, salt: 3 });
        draws++;
        painted += paints(b.calls);
        const save = b.calls.filter((c) => c === "save").length, restore = b.calls.filter((c) => c === "restore").length;
        check(save === restore, `${v.id} (${label}) at u=${u}: save/restore balanced (${save}/${restore})`);
      } catch (err) {
        problems.push(`${v.id} (${label}) at u=${u}: threw ${(err as Error).message}`);
      }
    }
    // Pure camera styles (shake, punch-in) may draw little; everything else must show.
    const quiet = v.off || v.current || r.params.intensity === 0;
    if (!quiet && label === "made") check(painted > 0, `${v.id}: draws something`);
  }
  if (v.off) {
    const a = fakeCtx();
    if (e.id === "trail") drawVfxTrail(a.ctx, v.recipe, [{ x: 0, y: 0 }, { x: 10, y: 0 }], 4, 1, 0.5);
    else for (const u of FILM_SLICES) drawVfx(a.ctx, e.id, v.recipe, u, { x: 0, y: 0, dx: 1, dy: 0, s: 40, power: 1, w: 100, h: 100 });
    check(paints(a.calls) === 0, `${v.id}: Off draws nothing`);
  }
}

// 3. Deterministic: same recipe, same calls.
for (const e of VFX_EVENTS) for (const v of VFX_VARIANTS[e.id]) {
  const a = fakeCtx(), b = fakeCtx();
  paintThumb(a.ctx, e.id, v.recipe, 0.4, 96, 120);
  paintThumb(b.ctx, e.id, v.recipe, 0.4, 96, 120);
  check(a.calls.join("|") === b.calls.join("|"), `${v.id}: same picture every time`);
}

// 4. Dials clamp; junk is made safe; every style lists real dials.
const wild = clampParams({ size: 99, durationMs: -5, intensity: NaN, count: 7.6, spread: 3, shakePx: -1, hitStopMs: 1e9, zoom: 9, color: "red", color2: "#00ff00", text: "A VERY LONG WORD INDEED" });
check(wild.size === PARAM_INFO.size.max, "size clamps to max");
check(wild.durationMs === PARAM_INFO.durationMs.min, "length clamps to min");
check(wild.intensity === DEFAULT_PARAMS.intensity, "NaN keeps the default");
check(wild.count === 8, "count rounds");
check(wild.spread === 1 && wild.shakePx === 0 && wild.hitStopMs === PARAM_INFO.hitStopMs.max && wild.zoom === PARAM_INFO.zoom.max, "the rest clamp");
check(wild.color === DEFAULT_PARAMS.color && wild.color2 === "#00ff00", "colours must be #rrggbb");
check(wild.text.length <= 14, "the word is kept short");
check(JSON.stringify(clampParams("junk")) === JSON.stringify(DEFAULT_PARAMS), "junk → defaults");
for (const [style, keys] of Object.entries(STYLE_PARAMS)) for (const k of keys) check(k in DEFAULT_PARAMS, `${style}: dial ${k} exists`);

// 5. Camera: shake and zoom end at rest, are bounded, and are zero when off.
for (const e of VFX_EVENTS) for (const v of VFX_VARIANTS[e.id]) {
  const r = v.recipe;
  for (let u = 0; u < 1; u += 0.05) {
    const s = vfxShake(r, u, 1, 0);
    check(Math.hypot(s.x, s.y) <= r.params.shakePx * 1.1 + 1e-9, `${v.id}: shake within its dial`);
    const z = vfxZoom(r, u);
    check(z >= 1 && z <= 1 + r.params.zoom + 1e-9, `${v.id}: zoom within its dial`);
  }
  check(vfxShake(r, 1, 1, 0).x === 0 && vfxZoom(r, 1) === 1, `${v.id}: camera back at rest at the end`);
}

// 6. Export text and picks.
const strike = VFX_VARIANTS.strike.find((v) => v.id === "strike/pow")!;
const notes = sanitizeNotes({
  edits: { "strike/pow": { size: 1.6, text: "BANG" }, "nope/x": { size: 2 } },
  ratings: { "strike/pow": 5, "net/confetti": 3, "strike/ring": 9 },
  notes: { "strike/pow": "love it" },
  picks: { strike: "strike/pow", net: "strike/ring", trail: "trail/comet" },
});
check(!("nope/x" in notes.edits), "unknown variants are dropped");
check(notes.picks.net === undefined, "a pick from another event is dropped");
check(!("strike/ring" in notes.ratings), "a rating past 5 is dropped");
const text = exportVfxPicks(notes);
check(text.startsWith("Visual Effects Lab picks (Leo)"), "export title");
check(text.includes("Hard shot:") && text.includes("PICK → Comic POW [strike/pow] style=comic ★★★★★"), "export names the pick, id, style and stars");
check(text.includes("dials: Size 1.6") && text.includes('Word "BANG"'), "export lists the changed dials");
check(text.includes('"text":"BANG"') && text.includes("note: love it"), "export carries the recipe and the note");
check(text.includes("Ball in flight:") && text.includes("[trail/comet]"), "export includes the trail pick");
check(text.includes("Ball in the net:") && text.includes("[net/confetti] ★★★"), "rated but not picked is listed");
check(exportVfxPicks(EMPTY_VFX_NOTES).includes("(nothing picked or rated yet)"), "empty export says so");
const ov = picksToOverride(notes);
check(ov.strike?.style === "comic" && ov.strike.params.size === 1.6 && ov.strike.params.text === "BANG", "picks become the match's override, with edits");
check(ov.trail?.style === "tComet" && !ov.net, "only picked events are overridden");
const ov2 = picksToOverride(notes, { id: "save/gloves" });
check(ov2.save?.style === "gloves", "the variant being edited goes into the match too");
check(strike.recipe.params.size !== 1.6, "editing never changes the shipped variant");

// 7. The real match is untouched without the prop.
const cm = readFileSync(new URL("../../components/star/CanvasMatch.tsx", import.meta.url), "utf8");
const page = readFileSync(new URL("../../app/star-dev/page.tsx", import.meta.url), "utf8");
check(!/vfxOverride/.test(page), "the career match never passes vfxOverride");
const guard = readFileSync(new URL("../../scripts/one-engine-guard.mjs", import.meta.url), "utf8");
check(/\bvfxOverride:/.test(guard), "vfxOverride is listed in the guard's TEST_ONLY");
// Every place CanvasMatch emits, draws or freezes for the lab sits behind the prop:
// vfxEmit returns at once without a recipe, and the draw/camera blocks only run
// over effects vfxEmit made.
const emitBody = cm.match(/const vfxEmit = \([^]*?\n  \};/);
check(!!emitBody && /const r = vfxRef\.current\?\.\[ev\];\s*\n\s*if \(!r\) return;/.test(emitBody[0]), "vfxEmit does nothing without a recipe for that event");
check(/const feelOn = matchFeelOn\(\) && !vfxRef\.current;/.test(cm), "match feel draws as before when the prop is absent");
for (const m of cm.matchAll(/vfxFxRef\.current(?!\s*=\s*\[\])/g)) {
  const line = cm.slice(cm.lastIndexOf("\n", m.index!) + 1, cm.indexOf("\n", m.index!));
  check(/vfxFxRef\.current\.(length|push|filter|shift)|const vfxFx = vfxFxRef\.current|for \(const e of vfxFxRef\.current\)|live|vfxFxRef\.current\.some/.test(line), `vfxFxRef use is read-only or behind emit: ${line.trim()}`);
}
const trailUse = cm.match(/const vfxTrail = vfxRef\.current\?\.trail;/);
check(!!trailUse, "the trail override reads the prop (absent → the old trail code runs)");

console.log(`vfxLab: ${VFX_EVENTS.length} events, ${variants} variants, ${draws} draws.`);
if (problems.length) {
  console.error(`FAIL (${problems.length}):\n  ${problems.slice(0, 40).join("\n  ")}`);
  process.exit(1);
}
console.log("PASS");
