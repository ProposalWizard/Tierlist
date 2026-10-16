/**
 * Sound Lab (lib/star/sfxLab.ts, /star-sound-lab-dev): every event has at
 * least six made-up candidates, every recipe renders to real (non-silent,
 * non-clipping, finite) samples, the render is deterministic, the dials do
 * what they say, and the "Current file" entries point at files that exist.
 */
import { existsSync } from "node:fs";
import {
  LAB_EVENTS, renderRecipe, processFile, peakOf, rmsOf, spectrumBands, waveformColumns, encodeWav,
  exportPicks, chosenFor, fullTweak, SEQUENCES, EMPTY_NOTES, type Recipe,
} from "../../lib/star/sfxLab";

const problems: string[] = [];
const check = (ok: boolean, msg: string) => { if (!ok) problems.push(msg); };
const SR = 22050;

const ids = new Set<string>();
let rendered = 0;
for (const e of LAB_EVENTS) {
  const made = e.candidates.filter(c => c.recipe);
  check(made.length >= 6, `${e.id}: ${made.length} recipe candidates (need ≥6)`);
  check(e.candidates.some(c => c.current), `${e.id}: has a "Current" entry`);
  for (const c of e.candidates) {
    check(!ids.has(c.id), `unique id ${c.id}`);
    ids.add(c.id);
    check(!!c.recipe !== !!c.file, `${c.id}: exactly one of recipe/file`);
    if (c.file) check(existsSync(new URL(`../../public/sfx/${c.file}.mp3`, import.meta.url)), `${c.id}: public/sfx/${c.file}.mp3 exists`);
    if (!c.recipe) continue;
    const s = renderRecipe(c.recipe, undefined, SR);
    rendered++;
    const finite = s.every(Number.isFinite);
    check(finite, `${c.id}: finite samples`);
    const peak = peakOf(s), rms = rmsOf(s);
    check(peak > 0.05, `${c.id}: audible (peak ${peak.toFixed(3)})`);
    check(rms > 0.003, `${c.id}: not silent (rms ${rms.toFixed(4)})`);
    check(peak <= 1, `${c.id}: never past full scale (peak ${peak.toFixed(3)})`);
    // Same recipe, same samples.
    const again = renderRecipe(c.recipe, undefined, SR);
    check(again.length === s.length && again.every((v, i) => v === s[i]), `${c.id}: deterministic`);
    // Every dial pushed to its extreme still gives real sound.
    for (const tw of [
      { volume: 2, pitch: 12, length: 0.5, brightness: 1, punch: 1, body: 1, room: 1 },
      { volume: 0.3, pitch: -12, length: 2, brightness: -1, punch: -1, body: -1, room: 0 },
    ]) {
      const x = renderRecipe(c.recipe, tw, SR);
      check(x.every(Number.isFinite) && peakOf(x) > 0.001 && peakOf(x) <= 1, `${c.id}: extreme dials ${JSON.stringify(tw).slice(0, 40)}… peak ${peakOf(x).toFixed(3)}`);
    }
  }
}

// The dials move the sound the right way.
const kick = LAB_EVENTS[0].candidates.find(c => c.recipe)!.recipe as Recipe;
const base = renderRecipe(kick, undefined, SR);
check(renderRecipe(kick, { length: 2 }, SR).length > base.length * 1.5, "Length ×2 makes it longer");
check(renderRecipe(kick, { room: 0.8 }, SR).length > base.length + SR * 0.5, "Room adds a tail");
check(rmsOf(renderRecipe(kick, { volume: 0.5 }, SR)) < rmsOf(base) * 0.6, "Volume ×0.5 is quieter");
const bright = spectrumBands(renderRecipe(kick, { brightness: 1 }, SR), SR), dark = spectrumBands(renderRecipe(kick, { brightness: -1 }, SR), SR);
check(bright.slice(14).reduce((a, b) => a + b, 0) > dark.slice(14).reduce((a, b) => a + b, 0), "Brightness lifts the top bands");
check(JSON.stringify(fullTweak({ pitch: 99, volume: NaN })) === JSON.stringify({ ...fullTweak(), pitch: 12 }), "dials are clamped and NaN-safe");

// Files go through the same chain.
const fake = new Float32Array(SR).map((_, i) => Math.sin(i / 10) * 0.5);
check(processFile(fake, SR, { pitch: 12 }).length < SR * 0.6, "file pitch up shortens it");
check(peakOf(processFile(fake, SR, { volume: 2 })) <= 1, "file never past full scale");

// Pictures and WAV.
check(waveformColumns(base, 96).length === 96, "96 waveform columns");
check(spectrumBands(base, SR, 20).every(v => v >= 0 && v <= 1), "spectrum in 0..1");
const wav = encodeWav(base, SR);
check(wav.length === 44 + base.length * 2 && String.fromCharCode(...wav.slice(0, 4)) === "RIFF", "WAV header");

// Picks and sequences.
check(exportPicks(EMPTY_NOTES).includes("nothing picked"), "empty export says so");
const notes = { ...EMPTY_NOTES, picks: { "kick-hard": "kick-hard/crack" }, ratings: { "kick-hard/crack": 5, "net/swish": 3 }, notes: { "net/swish": "nice" }, tweaks: { "kick-hard/crack": { pitch: 2 } } };
const ex = exportPicks(notes);
check(ex.includes("Leather crack") && ex.includes("Pitch +2") && ex.includes("nice") && ex.includes("★★★★★"), "export lists the pick, dials, rating and note");
check(chosenFor("kick-hard", notes)?.id === "kick-hard/crack", "sequence uses the pick");
check(chosenFor("net", notes)?.id === "net/swish", "sequence falls back to the best rated");
for (const s of SEQUENCES) for (const st of s.steps) check(LAB_EVENTS.some(e => e.id === st.event), `sequence ${s.id}: event ${st.event} exists`);

console.log(`sfxLab: ${LAB_EVENTS.length} events, ${ids.size} candidates, ${rendered} recipes rendered`);
if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log("sfxLab: all checks pass");
