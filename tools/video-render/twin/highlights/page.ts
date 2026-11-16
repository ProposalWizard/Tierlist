/**
 * HIGHLIGHTS REEL — the browser half (bundled by make_reel.cjs with esbuild).
 *
 * Turns a list of goals into the game's own goal clips: each goal is made by
 * lib/star/goalClip/synth.ts (the same "goal from a match you did not play"
 * the social feed uses), cut as one Edit (live spider-cam behind the scorer, then a slow replay
 * from behind the goal), drawn by the game's drawEditFrame at 1080 x 1920,
 * with a small caption per goal on top. Sound: the game's own mix
 * (goalClip/audio.ts planAudio + mixAudio: crowd, kicks, net, commentary).
 *
 * Nothing under lib/ is changed. Clubs the game has no kit for are added to
 * the game's kit table at run time (CLUB_KITS, in this page only).
 */
import { synthTrack, type SynthGoal, type SynthKind } from "@/lib/star/goalClip/synth";
import { CLUB_KITS, kitsOf, type ClubKits } from "@/lib/star/kits";
import { drawEditFrame, prepareClipSprites, roundRect, FONT } from "@/lib/star/goalClip/render";
import { closeWindow, editDuration, momentAt, shotLength, type Edit, type Shot } from "@/lib/star/goalClip/edit";
import { trackDuration, type GoalTrack } from "@/lib/star/goalClip/track";
import type { ClipAngle } from "@/lib/star/goalClip/cameras";
import { planAudio, mixAudio } from "@/lib/star/goalClip/audio";

export interface ReelGoal {
  opp: string;
  home: boolean;
  comp?: string;
  round?: string;
  /** Final score from his club's side, "3-0". */
  score?: string;
  minute: number;
  /** Optional: run_in | header | long_range | tap_in | penalty. */
  kind?: SynthKind;
}
export interface ReelSpec {
  scorer: string;
  scorerShort?: string;
  club: string;
  goals: ReelGoal[];
  /** Optional kits by club name: { "Club": { "home": {"shirt":"#hex","trim":"#hex"}, "away": {...} } }. */
  kits?: Record<string, ClubKits>;
  /** Optional: live camera (default "high", the spider-cam behind the scorer: reads best upright) and replay camera (default "net", behind the goal). */
  liveAngle?: ClipAngle;
  replayAngle?: ClipAngle;
  /** Optional: false = no slow replay after each goal. */
  replay?: boolean;
  /** Optional: replay speed (default 0.5). */
  replayRate?: number;
  /** Optional: "3d" (default, the game's default) or "2d" (top-down). */
  look?: "3d" | "2d";
}

const W = 1080, H = 1920, FPS = 30;

// ── Kits for clubs outside England ──────────────────────────────────────────
// Plain shirt + trim (the game draws shorts in the trim colour). Real club
// colours; stripes (Atlético, Inter, Barcelona…) are drawn as the main colour.
const k = (shirt: string, trim: string) => ({ shirt, trim });
const FOREIGN: Record<string, ClubKits> = {
  "Bayern München": { home: k("#DC052D", "#FFFFFF"), away: k("#FFFFFF", "#DC052D") },
  "Borussia Dortmund": { home: k("#FDE100", "#111111"), away: k("#111111", "#FDE100") },
  "RB Leipzig": { home: k("#FFFFFF", "#DD0741"), away: k("#0B2240", "#DD0741") },
  "Bayer Leverkusen": { home: k("#E32221", "#111111"), away: k("#111111", "#E32221") },
  "Eintracht Frankfurt": { home: k("#111111", "#E1000F"), away: k("#FFFFFF", "#111111") },
  "VfB Stuttgart": { home: k("#FFFFFF", "#E32219"), away: k("#E32219", "#FFFFFF") },
  "Atlético Madrid": { home: k("#CB3524", "#272E61"), away: k("#272E61", "#CB3524") },
  "Real Madrid": { home: k("#FFFFFF", "#00529F"), away: k("#1B1B3A", "#FEBE10") },
  "Barcelona": { home: k("#A50044", "#004D98"), away: k("#F5E14C", "#A50044") },
  "Sevilla": { home: k("#FFFFFF", "#D0103A"), away: k("#D0103A", "#FFFFFF") },
  "Real Sociedad": { home: k("#0067B1", "#FFFFFF"), away: k("#FFFFFF", "#0067B1") },
  "Athletic Club": { home: k("#EE2523", "#FFFFFF"), away: k("#111111", "#EE2523") },
  "Villarreal": { home: k("#FFE667", "#005187"), away: k("#005187", "#FFE667") },
  "Inter": { home: k("#0068A8", "#111111"), away: k("#FFFFFF", "#0068A8") },
  "AC Milan": { home: k("#C8102E", "#111111"), away: k("#FFFFFF", "#C8102E") },
  "Juventus": { home: k("#FFFFFF", "#111111"), away: k("#111111", "#F5E14C") },
  "Napoli": { home: k("#12A0D7", "#FFFFFF"), away: k("#FFFFFF", "#12A0D7") },
  "Roma": { home: k("#8E1F2F", "#F0BC42"), away: k("#FFFFFF", "#8E1F2F") },
  "Lazio": { home: k("#87D8F7", "#FFFFFF"), away: k("#111111", "#87D8F7") },
  "Atalanta": { home: k("#1E71B8", "#111111"), away: k("#FFFFFF", "#1E71B8") },
  "Paris Saint-Germain": { home: k("#004170", "#DA291C"), away: k("#FFFFFF", "#004170") },
  "Marseille": { home: k("#FFFFFF", "#2FAEE0"), away: k("#2FAEE0", "#FFFFFF") },
  "Monaco": { home: k("#E51F2B", "#FFFFFF"), away: k("#FFFFFF", "#E51F2B") },
  "Lyon": { home: k("#FFFFFF", "#1C3F94"), away: k("#1C3F94", "#FFFFFF") },
  "Benfica": { home: k("#E20E0E", "#FFFFFF"), away: k("#111111", "#E20E0E") },
  "Porto": { home: k("#0047AB", "#FFFFFF"), away: k("#FFFFFF", "#0047AB") },
  "Sporting CP": { home: k("#008057", "#FFFFFF"), away: k("#FFFFFF", "#008057") },
  "Ajax": { home: k("#FFFFFF", "#D2122E"), away: k("#111111", "#D2122E") },
  "PSV": { home: k("#ED1C24", "#FFFFFF"), away: k("#111111", "#ED1C24") },
  "Feyenoord": { home: k("#E30613", "#111111"), away: k("#FFFFFF", "#E30613") },
  "Celtic": { home: k("#018749", "#FFFFFF"), away: k("#111111", "#018749") },
  "Rangers": { home: k("#1B458F", "#FFFFFF"), away: k("#FFFFFF", "#1B458F") },
  "Galatasaray": { home: k("#A90432", "#FDB912"), away: k("#FFFFFF", "#A90432") },
  "Fenerbahçe": { home: k("#163962", "#FFED00"), away: k("#FFFFFF", "#163962") },
  "Club Brugge": { home: k("#0068B5", "#111111"), away: k("#FFFFFF", "#0068B5") },
};
// Other spellings people (and the game's own club lists) use.
const ALIAS: Record<string, string> = {
  "FC Bayern München": "Bayern München", "Bayern Munich": "Bayern München", "Bayern": "Bayern München",
  "BVB": "Borussia Dortmund", "Dortmund": "Borussia Dortmund", "Leipzig": "RB Leipzig", "Leverkusen": "Bayer Leverkusen",
  "Atletico Madrid": "Atlético Madrid", "Club Atlético de Madrid": "Atlético Madrid", "Atlético de Madrid": "Atlético Madrid", "Atleti": "Atlético Madrid",
  "FC Barcelona": "Barcelona", "Barça": "Barcelona", "Internazionale": "Inter", "Inter Milan": "Inter", "FC Internazionale Milano": "Inter",
  "Milan": "AC Milan", "Juve": "Juventus", "SSC Napoli": "Napoli", "AS Roma": "Roma", "PSG": "Paris Saint-Germain",
  "Olympique de Marseille": "Marseille", "Olympique Marseille": "Marseille", "AS Monaco": "Monaco", "Olympique Lyonnais": "Lyon",
  "SL Benfica": "Benfica", "FC Porto": "Porto", "Sporting": "Sporting CP", "AFC Ajax": "Ajax", "PSV Eindhoven": "PSV",
  "Galatasaray SK": "Galatasaray", "Club Brugge KV": "Club Brugge", "Real Madrid CF": "Real Madrid",
};
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z]/g, "");

/** Where each club's kit came from, for the log. */
const kitNotes: string[] = [];
const NEUTRAL = kitsOf("\u0000no such club\u0000");

function ensureKit(club: string, given?: Record<string, ClubKits>): void {
  if (given?.[club]) { CLUB_KITS[club] = given[club]; kitNotes.push(`${club}: from GOALS.json`); return; }
  if (kitsOf(club) !== NEUTRAL) { kitNotes.push(`${club}: the game's own kit (lib/star/kits.ts) ${kitsOf(club).home.shirt}/${kitsOf(club).home.trim}`); return; }
  const n = norm(club);
  const canon = ALIAS[club] ?? Object.entries(ALIAS).find(([a]) => norm(a) === n)?.[1]
    ?? Object.keys(FOREIGN).find(c => norm(c) === n) ?? club;
  // 1. The game's own kit under the name the game spells it ("FC Bayern München", "FC Barcelona").
  for (const name of [canon, `FC ${canon}`, `${canon} FC`, `${canon} CF`]) {
    const kk = kitsOf(name);
    if (kk !== NEUTRAL) {
      CLUB_KITS[club] = kk;
      kitNotes.push(`${club}: the game's own kit, filed as "${name}" (lib/star/kits.ts) ${kk.home.shirt}/${kk.home.trim}`);
      return;
    }
  }
  // 2. This tool's table of club colours.
  const own = FOREIGN[canon];
  if (own) { CLUB_KITS[club] = own; kitNotes.push(`${club}: highlights tool's club colours (page.ts FOREIGN) ${own.home.shirt}/${own.home.trim}`); return; }
  kitNotes.push(`${club}: NO KIT FOUND — the game's neutral green (${NEUTRAL.home.shirt}). Add one under "kits" in GOALS.json.`);
}

// ── The goals ───────────────────────────────────────────────────────────────

const OPEN_PLAY: SynthKind[] = ["run_in", "long_range", "header", "tap_in"];
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

interface Built { tracks: GoalTrack[]; goals: ReelGoal[] }

function buildTracks(spec: ReelSpec): Built {
  ensureKit(spec.club, spec.kits);
  const tracks: GoalTrack[] = [];
  const goals: ReelGoal[] = [];
  const used = new Set<SynthKind>();
  spec.goals.forEach((g, i) => {
    ensureKit(g.opp, spec.kits);
    const [us, them] = (g.score ?? "1-0").split("-").map(x => parseInt(x, 10) || 0);
    const seed = `reel|${spec.scorer}|${spec.club}|${g.opp}|${g.comp ?? ""}|${g.round ?? ""}|${g.minute}|${i}`;
    // A different kind of finish per goal where possible (never a penalty unless asked).
    let kind = g.kind;
    if (!kind) {
      const start = hash(seed) % OPEN_PLAY.length;
      kind = OPEN_PLAY[start];
      for (let s = 0; s < OPEN_PLAY.length && used.has(kind); s++) kind = OPEN_PLAY[(start + s) % OPEN_PLAY.length];
      if (used.size >= OPEN_PLAY.length) used.clear();
    }
    used.add(kind);
    const sg: SynthGoal = {
      home: g.home ? spec.club : g.opp,
      away: g.home ? g.opp : spec.club,
      scorer: spec.scorer,
      scorerShort: spec.scorerShort ?? spec.scorer.split(" ").pop()!,
      scorerHome: g.home,
      minute: g.minute,
      scoreAfter: g.home ? [us, them] : [them, us],
      competition: g.comp,
      seed,
      kind,
    };
    const t = synthTrack(sg);
    if (!t) throw new Error(`goal ${i + 1} could not be made`);
    t.meta.id = `reel-${i}-${hash(seed).toString(36)}`;
    tracks.push(t);
    goals.push(g);
  });
  return { tracks, goals };
}

function buildEdit(spec: ReelSpec, tracks: GoalTrack[]): Edit {
  const live = spec.liveAngle ?? "high";
  const rep = spec.replayAngle ?? "net";
  const rate = spec.replayRate ?? 0.5;
  const shots: Shot[] = [];
  tracks.forEach((t, i) => {
    shots.push({ track: i, angle: live, from: 0, to: trackDuration(t), rate: 1, replay: false });
    if (spec.replay !== false) {
      const w = closeWindow(t);
      shots.push({ track: i, angle: rep, from: w.from, to: w.to + 0.35, rate, replay: true });
    }
  });
  return {
    style: "broadcast", variant: 0, moves: "new", w: W, h: H, fps: FPS, tracks, shots,
    ...(spec.look === "2d" ? { flat: true as const } : {}),
  };
}

// ── The caption: competition, round, opponent ──────────────────────────────

function drawReelCaption(ctx: CanvasRenderingContext2D, edit: Edit, goals: ReelGoal[], club: string, outT: number): void {
  const m = momentAt(edit, outT);
  const shot = edit.shots[m.shot];
  if (!shot) return;
  const g = goals[shot.track];
  // Fade in at the start of each goal's live shot; stays through its replay.
  let first = m.shot;
  while (first > 0 && edit.shots[first - 1].track === shot.track) first--;
  let since = m.intoShot;
  for (let i = first; i < m.shot; i++) since += shotLength(edit.shots[i]);
  const a = Math.min(1, since / 0.35);
  const s = W / 1080;
  const top = 150 * s;
  const kitUs = kitsOf(club).home.shirt;
  const kitThem = kitsOf(g.opp).home.shirt;
  const line1 = [g.comp, g.round].filter(Boolean).join(" · ").toUpperCase();
  const line2 = `${g.home ? "v" : "at"} ${g.opp}`.toUpperCase();
  ctx.save();
  ctx.globalAlpha = a;
  ctx.translate(0, (1 - a) * -20 * s);
  ctx.font = `800 ${34 * s}px ${FONT}`;
  const w1 = ctx.measureText(line1).width;
  ctx.font = `900 ${50 * s}px ${FONT}`;
  const w2 = ctx.measureText(line2).width;
  const bw = Math.min(W - 80 * s, Math.max(w1, w2) + 90 * s);
  const bx = (W - bw) / 2, bh = (line1 ? 128 : 84) * s;
  ctx.fillStyle = "rgba(10,12,20,0.82)";
  roundRect(ctx, bx, top, bw, bh, 18 * s);
  ctx.fill();
  // Two club colour bars, ours left, theirs right.
  ctx.fillStyle = kitUs; ctx.fillRect(bx, top + 16 * s, 10 * s, bh - 32 * s);
  ctx.fillStyle = kitThem; ctx.fillRect(bx + bw - 10 * s, top + 16 * s, 10 * s, bh - 32 * s);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if (line1) {
    ctx.fillStyle = "#FACC15";
    ctx.font = `800 ${34 * s}px ${FONT}`;
    ctx.fillText(line1, W / 2, top + 40 * s, bw - 60 * s);
  }
  ctx.fillStyle = "#FFFFFF";
  ctx.font = `900 ${50 * s}px ${FONT}`;
  ctx.fillText(line2, W / 2, top + (line1 ? 90 : 44) * s, bw - 60 * s);
  ctx.restore();
}

// ── The page API (driven by make_reel.cjs) ─────────────────────────────────

let canvas: HTMLCanvasElement;
let ctx: CanvasRenderingContext2D;
let state: { spec: ReelSpec; edit: Edit; goals: ReelGoal[] } | null = null;

function drawAt(t: number): void {
  if (!state) return;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);
  drawEditFrame(ctx, state.edit, t);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  drawReelCaption(ctx, state.edit, state.goals, state.spec.club, t);
}

function wavBase64(buf: AudioBuffer): string {
  const ch = Math.min(2, buf.numberOfChannels), n = buf.length, rate = buf.sampleRate;
  const out = new DataView(new ArrayBuffer(44 + n * ch * 2));
  const str = (o: number, s: string) => { for (let i = 0; i < s.length; i++) out.setUint8(o + i, s.charCodeAt(i)); };
  str(0, "RIFF"); out.setUint32(4, 36 + n * ch * 2, true); str(8, "WAVE"); str(12, "fmt ");
  out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, ch, true);
  out.setUint32(24, rate, true); out.setUint32(28, rate * ch * 2, true); out.setUint16(32, ch * 2, true); out.setUint16(34, 16, true);
  str(36, "data"); out.setUint32(40, n * ch * 2, true);
  const data = Array.from({ length: ch }, (_, c) => buf.getChannelData(c));
  let o = 44;
  for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) {
    const v = Math.max(-1, Math.min(1, data[c][i]));
    out.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7fff, true); o += 2;
  }
  const bytes = new Uint8Array(out.buffer);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

declare global {
  interface Window {
    reelBoot: (spec: ReelSpec) => Promise<{ duration: number; frames: number; kits: string[]; goals: { kind: string; start: number; strike: number; goal: number; end: number; replayMid: number }[] }>;
    reelDraw: (t: number) => void;
    reelFrame: (t: number, type: string, q?: number) => string;
    reelAudio: () => Promise<string | null>;
  }
}

window.reelBoot = async (spec) => {
  canvas = document.getElementById("c") as HTMLCanvasElement;
  canvas.width = W; canvas.height = H;
  ctx = canvas.getContext("2d", { alpha: false })!;
  await prepareClipSprites("new", 15000);
  const { tracks, goals } = buildTracks(spec);
  const edit = buildEdit(spec, tracks);
  state = { spec, edit, goals };
  const duration = editDuration(edit);
  // Video times worth a still, per goal.
  let acc = 0;
  const out: { kind: string; start: number; strike: number; goal: number; end: number; replayMid: number }[] = [];
  edit.shots.forEach((s) => {
    const len = shotLength(s);
    const tr = edit.tracks[s.track];
    if (!s.replay) {
      out.push({ kind: String(tr.meta.how), start: acc + 0.4, strike: acc + (tr.strikeT - s.from), goal: acc + (tr.goalT - s.from) + 0.1, end: acc + len - 0.3, replayMid: -1 });
    } else out[out.length - 1].replayMid = acc + len * 0.6;
    acc += len;
  });
  return { duration, frames: Math.round(duration * FPS), kits: kitNotes, goals: out };
};
window.reelDraw = (t) => drawAt(t);
window.reelFrame = (t, type, q) => { drawAt(t); return canvas.toDataURL(type, q); };
window.reelAudio = async () => {
  if (!state) return null;
  try {
    const buf = await mixAudio(planAudio(state.edit));
    return buf ? wavBase64(buf) : null;
  } catch { return null; }
};
