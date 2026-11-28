/**
 * Kit man story voices: list every quoted line by Den (kitman) and the gaffer (manager) that has no
 * recorded clip, and make them with ElevenLabs.
 *
 *   npx tsx scripts/life/voice-lines.mts               list: lines with a clip, lines to make, lines skipped
 *   npx tsx scripts/life/voice-lines.mts --dry-run     same, plus the character total the paid calls would use
 *   npx tsx scripts/life/voice-lines.mts --make [--budget 2400] [--only b3,b4]
 *
 * The key is read from $ELEVENLABS_API_KEY only (never printed, never written). One credit per character;
 * --make stops before a call would take the run over --budget. Clips go in
 * public/star/life/voice/hundred-balls/ and the manifest gets one entry each (seconds measured by ffprobe).
 * A line is matched on screen by its exact text (lib/star/life/voice.ts), so:
 *   - {kitman.short} / {kitman.first} become "Den" (only Den has a voice; other kit men are silent text).
 *   - a line with any other {placeholder} (a score, a name, an {if} inside the quote) is skipped.
 * Ids: beat.node.say<i>.q<j> (q = quote outside an {if}, c = inside one), beat.setup<i>.q<j>,
 * beat.end.<end>.<i>.q<j>, beat.choice<c>.out<o>.q<j>.
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const STORY = path.join(ROOT, "lib/star/life/book/arcs/hundred-balls.json");
const DIR = path.join(ROOT, "public/star/life/voice/hundred-balls");
const MANIFEST = path.join(DIR, "manifest.json");

const VOICES = {
  den: { name: "Peter - Mature Northern British", id: "BH9MXBxDsBzwMiouIxpj" },
  gaffer: { name: "Paul - Deep & Warm Yorkshire", id: "oCXdm5WkYoKVEdlbPLev" },
} as const;
const MODEL = "eleven_multilingual_v2";
const SETTINGS = { stability: 0.5, similarity_boost: 0.75 };

type Speaker = "den" | "gaffer";
interface Clip { id: string; speaker: string; voice: string; text: string; file: string; seconds: number }
interface Line { id: string; speaker: Speaker; text: string; beat: string; where: string }
interface Skip { id: string; text: string; why: string }

const WHO: Record<string, Speaker> = { kitman: "den", manager: "gaffer" };
/** Beats that are not spoken scenes (text messages, the kid's own talk) never get a voice. */
const SILENT_BEATS = new Set(["b6b-letter", "b7b-text-den"]);
/** Where the event's speaker is not who really says an ending/outcome line (checked by hand). */
const SPEAKER_OVERRIDE: Record<string, Speaker> = {};

/** Quoted segments of one string, in order: [text, insideIf]. */
export function quotes(s: string): { text: string; inIf: boolean }[] {
  const out: { text: string; inIf: boolean }[] = [];
  let depth = 0;
  let i = 0;
  while (i < s.length) {
    if (s.startsWith("{if", i)) { const e = s.indexOf("}", i); depth++; i = e + 1; continue; }
    if (s.startsWith("{/if}", i)) { depth = Math.max(0, depth - 1); i += 5; continue; }
    if (s[i] === '"') {
      const e = s.indexOf('"', i + 1);
      if (e < 0) break;
      out.push({ text: s.slice(i + 1, e), inIf: depth > 0 });
      i = e + 1; continue;
    }
    i++;
  }
  return out;
}

const norm = (s: string) => s.toLowerCase().replace(/[“”"]/g, "").replace(/[^a-z0-9' ]+/g, " ").replace(/\s+/g, " ").trim();

function resolveText(raw: string, speaker: Speaker): { text?: string; why?: string } {
  let t = raw;
  if (/\{\/?if/.test(t)) return { why: "an {if} inside the quote" };
  // Den speaks every kit man's slot as Den: only his name is filled in (other kit men are silent text).
  t = t.replace(/\{kitman\.(short|first)\}/g, "Den");
  if (/\{[^}]*\}/.test(t)) return { why: `placeholder ${(t.match(/\{[^}]*\}/) ?? [""])[0]}` };
  return { text: t.trim().replace(/[,;:]$/, "") };
}

export function collect(story: any): { lines: Line[]; skipped: Skip[] } {
  const lines: Line[] = [];
  const skipped: Skip[] = [];
  const add = (id: string, beat: string, who: string | undefined, raw: string, where: string) => {
    const sp = SPEAKER_OVERRIDE[id] ?? (who ? WHO[who] : undefined);
    if (!sp) return; // someone else's line (the kid, a narrator): never voiced
    const r = resolveText(raw, sp);
    if (!r.text) { skipped.push({ id, text: raw, why: r.why ?? "?" }); return; }
    if (/^\s*\{?\w+\}?\s*$/.test(r.text)) return;
    lines.push({ id, speaker: sp, text: r.text, beat, where });
  };
  const scan = (idBase: string, beat: string, who: string | undefined, s: string, where: string) => {
    let q = 0, c = 0;
    for (const x of quotes(s)) add(`${idBase}.${x.inIf ? "c" + c++ : "q" + q++}`, beat, who, x.text, where);
  };
  for (const b of story.beats) {
    if (SILENT_BEATS.has(b.id)) continue;
    const e = b.event;
    const talk = e.talk;
    if (talk) {
      (e.setup ?? []).forEach((t: string, i: number) => scan(`${b.id}.setup${i}`, b.id, e.speaker, t, `${b.id} setup ${i}`));
      for (const [nid, n] of Object.entries<any>(talk.nodes ?? {})) {
        (n.say ?? []).forEach((t: string, i: number) => scan(`${b.id}.${nid}.say${i}`, b.id, n.who, t, `${b.id} ${nid} say ${i}`));
        const caller = n.activity?.caller?.lines;
        if (Array.isArray(caller)) caller.forEach((t: string, i: number) => add(`${b.id}.${nid}.caller${i}`, b.id, n.who ?? e.speaker ?? "kitman", t, `${b.id} ${nid} caller ${i}`));
      }
      for (const [eid, arr] of Object.entries<any>(talk.ends ?? {}))
        (arr as any[]).forEach((x, i) => scan(`${b.id}.end.${eid}.${i}`, b.id, e.speaker, x.text ?? "", `${b.id} end ${eid} ${i}`));
    }
    (e.choices ?? []).forEach((ch: any, ci: number) =>
      (ch.outcomes ?? []).forEach((o: any, oi: number) => scan(`${b.id}.choice${ci}.out${oi}`, b.id, e.speaker, o.text ?? "", `${b.id} choice ${ci} outcome ${oi}`)));
  }
  return { lines, skipped };
}

function readManifest(): Clip[] { return JSON.parse(fs.readFileSync(MANIFEST, "utf8")); }

export function plan() {
  const story = JSON.parse(fs.readFileSync(STORY, "utf8"));
  const { lines, skipped } = collect(story);
  const man = readManifest();
  const have = new Set(man.map((c) => norm(c.text)));
  const haveId = new Set(man.map((c) => c.id));
  const todo = lines.filter((l) => !haveId.has(l.id) && !have.has(norm(l.text)));
  const done = lines.filter((l) => !todo.includes(l));
  return { lines, skipped, todo, done, man };
}

const BEAT_ORDER = ["b1-the-offer", "b2-the-gaffer", "b2b-ten-fingers", "b3-thursdays", "b4-the-door", "b5-last-season", "b6-the-night", "b7-your-turn"];

function main() {
  const args = process.argv.slice(2);
  const make = args.includes("--make");
  const bi = args.indexOf("--budget");
  const budget = bi >= 0 ? Number(args[bi + 1]) : 2400;
  const oi = args.indexOf("--only");
  const only = oi >= 0 ? args[oi + 1].split(",") : null;
  const { skipped, todo, done, man } = plan();
  const order = (l: Line) => BEAT_ORDER.indexOf(l.beat);
  // Story order: Den's later beats first (b3..b7), then the gaffer's b2/b6; ids keep their order inside a beat.
  const rank = (l: Line) => (l.speaker === "den" ? 0 : 1) * 100 + order(l);
  let list = [...todo].sort((a, b) => rank(a) - rank(b));
  if (only) list = list.filter((l) => only.some((p) => l.id.startsWith(p)));
  console.log(`in the story: ${done.length + todo.length} voiced-speaker lines; with a clip: ${done.length}; to make: ${list.length}; skipped: ${skipped.length}`);
  let total = 0;
  for (const l of list) { total += l.text.length; console.log(`  ${l.speaker.padEnd(6)} ${l.id}  (${l.text.length})  ${l.text}`); }
  console.log(`characters to send: ${total} (budget ${budget})`);
  console.log("skipped:");
  for (const s of skipped) console.log(`  ${s.id}  [${s.why}]  ${s.text.slice(0, 80)}`);
  if (!make) return;
  if (total > budget) { console.error("over budget, nothing sent"); process.exit(1); }
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) { console.error("ELEVENLABS_API_KEY is not set"); process.exit(1); }
  let used = 0;
  for (const l of list) {
    if (used + l.text.length > budget) { console.log(`stop: next line would pass ${budget} characters`); break; }
    const v = VOICES[l.speaker];
    const file = `${l.id}.mp3`;
    const raw = path.join(DIR, `${l.id}.raw.mp3`);
    const body = JSON.stringify({ text: l.text, model_id: MODEL, voice_settings: SETTINGS });
    used += l.text.length; // counted before the call: a failed call may still cost
    const r = execFileSync("curl", ["-sS", "-m", "120", "-w", "%{http_code}", "-o", raw, "-X", "POST",
      `https://api.elevenlabs.io/v1/text-to-speech/${v.id}?output_format=mp3_44100_128`,
      "-H", "Content-Type: application/json", "-H", `xi-api-key: ${key}`, "--data-binary", "@-"], { input: body }).toString();
    if (r !== "200") { const m = fs.existsSync(raw) ? fs.readFileSync(raw, "utf8").slice(0, 200) : ""; fs.rmSync(raw, { force: true }); console.error(`FAILED ${l.id}: HTTP ${r} ${m}`); break; }
    // Trim the dead air at both ends, mono 64 kbit like the first 45 clips.
    execFileSync("ffmpeg", ["-v", "error", "-y", "-i", raw, "-af",
      "silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse",
      "-ac", "1", "-ar", "44100", "-b:a", "64k", path.join(DIR, file)]);
    fs.rmSync(raw, { force: true });
    const seconds = Math.round(Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path.join(DIR, file)]).toString()) * 100) / 100;
    man.push({ id: l.id, speaker: l.speaker, voice: v.name, text: l.text, file, seconds });
    fs.writeFileSync(MANIFEST, JSON.stringify(man, null, 1) + "\n");
    console.log(`made ${l.id} ${seconds}s  (characters used so far: ${used})`);
  }
  console.log(`characters sent: ${used}`);
}

if (process.argv[1] && process.argv[1].endsWith("voice-lines.mts")) main();
