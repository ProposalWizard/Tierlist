"use client";
// GAMECAP — TEMPORARY capture page. Copied to app/zz-gamecap-tmp/ by
// tools/video-factory/gamecap/capture.mjs for one run and deleted after it.
// Never commit this route. Driven by Playwright through window.__gc.
import { useEffect, useState } from "react";
import { GoalRecorder } from "@/lib/star/goalClip/recorder";
import { CLIP_FPS, type ClipBody, type FrameState, type GoalTrack } from "@/lib/star/goalClip/track";
import { drawScene, prepareClipSprites } from "@/lib/star/goalClip/render";
import type { ClipAngle } from "@/lib/star/goalClip/cameras";
import { CELEB_SPECS, planCelebration, type CelebrationMove } from "@/lib/star/celebration";
import { spriteClipReady, type SpriteClip } from "@/lib/star/sprites";
import MikeyPopup, { type PopupItem } from "@/components/star/MikeyPopup";
import { shortClub } from "@/lib/star/media/grammar";
import { popupName } from "@/lib/star/mikeyPopups";
import { planMove, type Kind, type Recreate } from "./moves";

type Kit = { shirt: string; shorts: string; socks?: string };
interface Team { name: string; short?: string; kit: Kit; keeperKit?: Kit; popupTrim?: string }
interface Person { name: string; popupName?: string; skin?: string; hair?: string }
interface ClipSpec {
  id: string; kind: Kind; attacking: "home" | "away"; seed?: string;
  scorer?: string; assister?: string; defenders?: string[]; keeper?: string; teammates?: string[];
  minute?: number; minuteLabel?: string; scoreBefore?: [number, number]; scoreAfter?: [number, number];
  celebration?: string | null; night?: boolean; weather?: string; recreate?: Recreate;
}
export interface Spec { teams: { home: Team; away: Team }; people?: Record<string, Person>; clips: ClipSpec[] }

const W = 720, H = 1280;
const DEFAULT_LOOKS = [
  { skin: "#f1c7a4", hair: "#3b2a1e" }, { skin: "#8d5a3b", hair: "#141010" }, { skin: "#d4a079", hair: "#1d1512" },
  { skin: "#5e3a24", hair: "#0d0a09" }, { skin: "#f2c4a6", hair: "#9a7248" }, { skin: "#c58b62", hair: "#151010" },
];
function idHash(s: string): number { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0; return h; }
const full = (k: Kit) => ({ shirt: k.shirt, shorts: k.shorts, socks: k.socks ?? k.shirt });

interface Built { track: GoalTrack; info: Record<string, unknown> }

/** No two men stand inside each other: push apart any pair closer than 0.95 m
 *  (the scorer and the keeper hold their ground; everyone else gives way). */
function separate(pts: { x: number; y: number; z: number }[], keeper: boolean[]): void {
  const MIN = 0.95;
  for (let it = 0; it < 4; it++) {
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
      const dx = pts[j].x - pts[i].x, dy = pts[j].y - pts[i].y, d = Math.hypot(dx, dy);
      if (d >= MIN) continue;
      const ux = d > 1e-4 ? dx / d : 1, uy = d > 1e-4 ? dy / d : 0, push = MIN - d;
      const fixI = i === 0 || keeper[i], fixJ = j === 0 || keeper[j];
      if (fixI && fixJ) continue;
      const wi = fixI ? 0 : fixJ ? 1 : 0.5, wj = 1 - wi;
      pts[i].x -= ux * push * wi; pts[i].y -= uy * push * wi;
      pts[j].x += ux * push * wj; pts[j].y += uy * push * wj;
    }
  }
}

function buildClip(spec: Spec, c: ClipSpec): Built {
  const atkTeam = spec.teams[c.attacking], defTeam = spec.teams[c.attacking === "home" ? "away" : "home"];
  const people = spec.people ?? {};
  const look = (pid: string | undefined, n: number) => {
    const p = pid ? people[pid] : undefined;
    const d = DEFAULT_LOOKS[n % DEFAULT_LOOKS.length];
    return { skin: p?.skin ?? d.skin, hair: p?.hair ?? d.hair };
  };
  const defenders = c.defenders ?? [];
  const mates = c.teammates ?? [];
  const seed = c.seed ?? `gc-${c.id}`;
  const mv = planMove({ kind: c.kind, seed, defenders: defenders.length || 3, mates: mates.length, recreate: c.recreate ? { ...c.recreate } : undefined });
  const celeb = mv.goal && c.celebration && c.celebration in CELEB_SPECS ? c.celebration as CelebrationMove : null;
  const gkKit = defTeam.keeperKit ?? { shirt: "#e8e04a", shorts: "#1a1a1a", socks: "#e8e04a" };
  const ids: string[] = [];
  const bodies: ClipBody[] = mv.roles.map((r, n) => {
    if (r.role === "scorer") { ids.push(celeb ? "you" : "s0"); return { id: ids[n], role: "mate", side: "us", name: people[c.scorer ?? ""]?.name, kit: { ...full(atkTeam.kit), ...look(c.scorer, 0) } as ClipBody["kit"] }; }
    if (r.role === "assister") { ids.push("a0"); return { id: "a0", role: "mate", side: "us", kit: { ...full(atkTeam.kit), ...look(c.assister, 1) } as ClipBody["kit"] }; }
    if (r.role === "def") { ids.push(`def${r.i}`); return { id: `def${r.i}`, role: "opp", side: "them", kit: { ...full(defTeam.kit), ...look(defenders[r.i], 2 + r.i) } as ClipBody["kit"] }; }
    if (r.role === "keeper") { ids.push("keeper"); return { id: "keeper", role: "keeper", side: "them", kit: { ...full(gkKit), ...look(c.keeper, 5) } as ClipBody["kit"] }; }
    ids.push(`m${r.i}`); return { id: `m${r.i}`, role: "mate", side: "us", kit: { ...full(atkTeam.kit), ...look(mates[r.i], 3 + r.i) } as ClipBody["kit"] };
  });
  const keyOf = (k: string) => k === "scorer" ? ids[0] : k === "assister" ? "a0" : k;
  // The clip id fixes the floodlights (render.ts: night when idHash(id) is even).
  let clipId = `gc-${c.id}`;
  if (c.night !== undefined) for (let k = 0; k < 64 && (idHash(clipId) % 2 === 0) !== c.night; k++) clipId = `gc-${c.id}-${k}`;
  const minute = c.minute ?? 30;
  const homeName = spec.teams.home.name, awayName = spec.teams.away.name;
  const rec = new GoalRecorder(); rec.begin(bodies);
  const dt = 1 / CLIP_FPS;
  const end = mv.endT + (celeb ? 4.8 : 2.3);
  const pending = [...mv.events];
  let marked = false, celebrated = false;
  for (let f = 0; f * dt <= end + 1e-9; f++) {
    const t = f * dt;
    const pts = mv.paths.map((p, i) => {
      const q = p(t);
      if (i === 0 && mv.headerAt !== null) q.z = Math.max(0, 0.55 * (1 - Math.abs(t - mv.headerAt) / 0.3));
      for (const [bi, jt] of mv.jumps) if (bi === i) q.z = Math.max(q.z, 0.45 * Math.max(0, 1 - Math.abs(t - jt - 0.05) / 0.3));
      return q;
    });
    separate(pts, mv.roles.map(r => r.role === "keeper"));
    const frame = { ball: mv.ball(t), bodies: pts, keeper: mv.keeper(t) } as unknown as FrameState;
    rec.frame(f === 0 ? 0 : dt, frame);
    while (pending.length && pending[0][0] <= t + 1e-9) {
      const [, k, who, mode] = pending.shift()!;
      if (k === "save") rec.event("save", "keeper", { save: mode });
      else rec.event(k, keyOf(who), mode ? { mode } : undefined);
    }
    if (!marked && t >= mv.endT) {
      marked = true;
      const sc = people[c.scorer ?? ""]?.name ?? "";
      const as = c.assister ? people[c.assister]?.name : undefined;
      rec.markGoal({
        id: clipId, minute, minuteLabel: c.minuteLabel ?? (minute > 90 ? `90+${minute - 90}` : String(minute)),
        scorer: mv.goal ? sc : "", scorerShort: mv.goal ? sc : "", scorerBody: mv.goal ? ids[0] : "nobody",
        isYou: !!celeb, how: mv.base, home: homeName, away: awayName, youAreHome: c.attacking === "home",
        ...(as && mv.goal ? { assist: as } : {}), ...(c.scoreAfter ? { scoreAfter: c.scoreAfter } : {}),
        ...(c.weather ? { weather: c.weather } : {}),
      });
    }
    if (celeb && marked && !celebrated && t >= mv.endT + 0.25) { celebrated = true; rec.celebrate(celeb, { x: pts[0].x, y: pts[0].y }); }
  }
  rec.finishNow();
  const track = rec.take()[0];
  if (!track) throw new Error(`clip ${c.id}: the recorder cut no clip`);
  track.meta.createdAt = "";
  // Times in the clip (the recorder trims the lead-in).
  const cel = track.meta.celebration;
  let celebMoveT: number | null = null;
  if (cel) { const plan = planCelebration({ x: cel.from[0], y: cel.from[1] }, cel.move as CelebrationMove); celebMoveT = track.goalT + cel.at + plan.moveAt; }
  const info = {
    id: c.id, kind: c.kind, built_as: mv.base, outcome: mv.outcome, fps: track.fps, frames: track.n, duration: +((track.n - 1) / track.fps).toFixed(3),
    pass: track.events.find(e => e.kind === "pass")?.t ?? null,
    shot: +track.strikeT.toFixed(3),
    [mv.goal ? "goal" : mv.outcome === "save" ? "save" : "miss"]: +track.goalT.toFixed(3),
    celebration_start: mv.goal ? +(track.goalT + (cel ? cel.at : 0.35)).toFixed(3) : null,
    celebration_move: celebMoveT !== null ? +celebMoveT.toFixed(3) : null,
    celebration: cel?.move ?? (mv.goal ? "celebrate (the game's default)" : null),
    night: idHash(clipId) % 2 === 0,
    events: track.events.map(e => ({ t: e.t, kind: e.kind, who: e.who, mode: e.mode, save: e.save })),
    bodies: track.bodies.map((b, i) => ({ id: b.id, role: b.role, person: i === 0 ? c.scorer : b.id === "a0" ? c.assister : b.id === "keeper" ? c.keeper : b.id.startsWith("def") ? defenders[+b.id.slice(3)] : mates[+b.id.slice(1)] })),
  };
  return { track, info };
}

/** Every sprite clip a capture can ask for, so nothing switches mid-film. */
const WARM: [("player" | "keeper"), SpriteClip][] = [["player", "shotKick" as SpriteClip], ["keeper", "oneHandR" as SpriteClip]];

export default function Page() {
  const [pop, setPop] = useState<PopupItem | null>(null);
  useEffect(() => {
    const w = window as unknown as Record<string, unknown>;
    const q = new URLSearchParams(location.search);
    if (q.get("scene") === "pop") {
      const g = w.__GC_POP as { home: Team; away: Team; from: [number, number]; to: [number, number]; scorer?: string; assist?: string; scorerShown?: string; assistShown?: string; theirs?: boolean };
      const team = (t: Team) => ({ name: t.short ?? shortClub(t.name), shirt: t.kit.shirt, trim: t.popupTrim ?? t.kit.shorts, ink: "#ffffff" });
      setPop({ id: 1, text: "GOAL", ms: 1500, side: "top", goal: { home: team(g.home), away: team(g.away), from: g.from, to: g.to, scorer: g.scorerShown ?? popupName(g.scorer), assist: g.assistShown ?? popupName(g.assist), theirs: g.theirs } });
      w.__gcPop = { ready: true, popupName };
      return;
    }
    const tracks: Record<string, GoalTrack> = {};
    const cv = document.createElement("canvas"); cv.width = W; cv.height = H; const ctx = cv.getContext("2d")!;
    const small = document.createElement("canvas"); small.width = 180; small.height = 320; const sctx = small.getContext("2d")!;
    (async () => {
      await prepareClipSprites("new", 30000);
      w.__gc = {
        popupName,
        load: async (spec: Spec) => {
          const infos: Record<string, unknown> = {};
          for (const c of spec.clips) { const b = buildClip(spec, c); tracks[c.id] = b.track; infos[c.id] = b.info; }
          // Warm every atlas the clips use: draw each clip once, small, until every clip it needs is in.
          const want: [("player" | "keeper"), SpriteClip][] = [...WARM];
          for (const tr of Object.values(tracks)) { const m = tr.meta.celebration?.move as CelebrationMove | undefined; if (m && CELEB_SPECS[m]) want.push(["player", CELEB_SPECS[m].sprite as SpriteClip]); }
          const t0 = Date.now();
          for (let pass = 0; pass < 4 || (!want.every(([ch, cl]) => spriteClipReady(ch, cl)) && Date.now() - t0 < 40000); pass++) {
            for (const tr of Object.values(tracks)) for (const a of ["tv", "high", "tight"] as ClipAngle[]) for (let t = 0; t < tr.n / tr.fps; t += 0.25) drawScene(sctx, 180, 320, tr, a, t, "new");
            await new Promise(r => setTimeout(r, 250));
          }
          return { infos, warm: want.map(([ch, cl]) => [ch, cl, spriteClipReady(ch, cl)]) };
        },
        draw: (id: string, angle: ClipAngle, t: number, q = 0.9) => { const tr = tracks[id]; ctx.clearRect(0, 0, W, H); drawScene(ctx, W, H, tr, angle, t, "new"); return cv.toDataURL("image/jpeg", q); },
      };
    })();
  }, []);
  return (
    <div id="gcpop" style={{ position: "fixed", inset: 0, zIndex: 99999, background: "transparent", overflow: "hidden" }}>
      <MikeyPopup item={pop} />
    </div>
  );
}
