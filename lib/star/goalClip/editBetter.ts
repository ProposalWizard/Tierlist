/**
 * BETTER GOAL VIDEOS — THE CUTS (Leo, 31 Oct 2026: "BETTER! MORE VARIETY! …
 * BETTER! EDITS! … BETTER VIDEOS!"). Leo's switch part "betterVideos"
 * (lib/star/leoUpdate.ts). With it off, edit.ts makes exactly the cuts it
 * always did; this file is not reached.
 *
 * Still only cuts and cameras on the recording (CLAUDE.md, Leo 7 Oct: "the
 * goal replays should always be the same"): slow motion is the recording
 * played slower, a freeze is one recorded frame held. Nothing is re-run.
 *
 * Four kinds of video, after how real goals are posted (research:
 * docs/handoffs/2026-10-31-leo/videos-v2/RESEARCH.md):
 *  - broadcast: the TV live, then two or three replays from other cameras
 *    (the reverse angle, a super slow-mo of the strike, behind the goal, the
 *    spider-cam), each with a wipe and a label;
 *  - highlights: a clip page's reel: each goal trimmed to the strike, one
 *    quick replay, flash cuts, then a full-time card with the scorers;
 *  - tiktok: tall; the build-up sped up, a ramp down into the strike, a
 *    freeze with a zoom punch on contact, a flash and a shake on the goal,
 *    captions that pop in word by word, one more time, the player's name;
 *  - fan: a phone in the stand, from one of three seats, pinching in as the
 *    shot comes, jumping when it goes in.
 *  - reverse (papers, pundits): the old cut, trimmed, with a slow-mo label.
 *
 * Every choice (which replays, in which order, which captions, which colour,
 * which seat) is seeded from the account's cut (`variant`) and the goal, so
 * two accounts posting the same goal post two different videos, and the same
 * post is the same video every time.
 */
import { trackDuration, type GoalTrack } from "./track";
import type { ClipAngle } from "./cameras";
import {
  TALL, WIDE, EDIT_FPS, REPLAY_RATE, AIR_REPLAY_RATE, airFinish, celebCut, replayWindow, closeWindow,
  type ClipMoves, type ClipStyle, type Edit, type Shot, type ShotFx,
} from "./edit";

export interface EditOptions {
  /** Leo's switch part "betterVideos" is on (read at the call site). */
  better?: boolean;
  /** The post's own caption lines for a TikTok edit: [hook, reaction, replay]. */
  captions?: string[];
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/** A picker seeded by the cut and the goals: pick(list, "what") is fixed per post. */
function picker(variant: number, tracks: GoalTrack[]) {
  const base = `${variant}|${tracks.map(t => t.meta.id).join(",")}`;
  return <T>(list: readonly T[], what: string): T => list[hash(`${base}|${what}`) % list.length];
}

export const ACCENTS = ["#FACC15", "#22D3EE", "#F472B6", "#A3E635", "#FFFFFF", "#FB923C"] as const;

export const TIKTOK_HOOKS = ["WAIT FOR IT", "WATCH THE KEEPER", "NO WAY HE SCORES THIS", "KEEP WATCHING", "HE REALLY TRIED THIS", "LOOK AT THE FINISH", "THIS IS FILTHY", "SOUND ON FOR THIS"] as const;
export const TIKTOK_HITS = ["UNREAL", "HE'S HIM", "COLD", "ABSOLUTE SCENES", "DISGUSTING FINISH", "SIT DOWN KEEPER", "TOP BINS", "COMPOSURE", "GOLAZO", "BALL KNOWLEDGE"] as const;
export const TIKTOK_AGAIN = ["ONE MORE TIME", "AGAIN.", "RUN IT BACK", "SLOWED DOWN", "WATCH IT AGAIN"] as const;
const AIR_HITS = ["WHAT A HEADER", "BULLET HEADER", "OUT-JUMPED EVERYONE"] as const;
const PEN_HITS = ["ICE COLD", "NO NERVES", "SENT HIM THE WRONG WAY"] as const;

/** Clip seconds: just before the strike to just after it goes in (the super slow-mo). */
function strikeWindow(t: GoalTrack): { from: number; to: number } {
  const dur = trackDuration(t);
  return { from: Math.max(0, t.strikeT - 0.55), to: Math.min(dur, t.goalT + 0.3) };
}

/** A replay of `w` from `angle`, at `rate` but never longer than `maxLen` seconds. */
function replayShot(track: number, angle: ClipAngle, w: { from: number; to: number }, rate: number, fx?: ShotFx, maxLen = 4.2, caption?: string): Shot {
  const r = Math.max(rate, (w.to - w.from) / maxLen);
  return { track, angle, from: w.from, to: w.to, rate: r, replay: true, ...(caption ? { caption } : {}), ...(fx ? { fx } : {}) };
}

/** The live shot(s) of one goal from `angle`, cutting tight on the celebration. */
function liveShots(i: number, t: GoalTrack, angle: ClipAngle, from: number, to: number, fx?: ShotFx): Shot[] {
  const cut = celebCut(t);
  const live = (a: ClipAngle, f: number, e: number, x?: ShotFx): Shot => ({ track: i, angle: a, from: f, to: e, rate: 1, replay: false, ...(x ? { fx: x } : {}) });
  if (cut === null || cut <= from + 0.3 || cut >= to - 0.3) return [live(angle, from, to, fx)];
  return [live(angle, from, cut, fx), live("tight", cut, to)];
}

export function makeBetterEdit(tracks: GoalTrack[], styleIn: ClipStyle, moves: ClipMoves, variant: number, opts: EditOptions): Edit {
  const style = styleIn;
  const v = Math.abs(Math.floor(variant));
  const size = style === "fan" || style === "tiktok" ? TALL : WIDE;
  const pick = picker(v, tracks);
  const shots: Shot[] = [];
  const edit: Edit = { style, better: true, accent: pick(ACCENTS, "accent"), variant: v, moves, ...size, fps: EDIT_FPS, tracks, shots };
  if (tracks.length === 0) return edit;
  const last = tracks.length - 1;
  const lt = tracks[last];
  const reel = tracks.length > 1;

  if (style === "tiktok") {
    const angle = pick<ClipAngle>(["follow", "follow", "spider", "follow", "tv"], "tiktok-angle");
    const freeze = pick([true, true, true, false], "freeze");
    const punch = pick([1.35, 1.5, 1.6], "punch");
    const lead = pick([2.2, 2.8, 3.4], "lead");
    const slowFlight = pick([0.5, 0.6, 0.7], "flight");
    const cap = opts.captions ?? [];
    tracks.forEach((t, i) => {
      const dur = trackDuration(t);
      const s = t.strikeT, g = t.goalT;
      const strike = t.events.filter(e => e.kind === "shot" && e.t <= g + 0.05).pop();
      const hits: readonly string[] = strike?.mode === "header" ? AIR_HITS : t.meta.how === "penalty" ? PEN_HITS : TIKTOK_HITS;
      const hook = i === 0 ? cap[0] ?? pick(TIKTOK_HOOKS, "hook") : undefined;
      const hit = (i === 0 ? cap[1] : undefined) ?? pick(hits, `hit${i}`);
      const start = Math.max(0, s - lead);
      const after = s + 0.02;
      const seg = (from: number, to: number, rate: number, extra: Partial<Shot> = {}) => {
        if (to - from > 0.03) shots.push({ track: i, angle, from, to, rate, replay: false, ...extra });
      };
      // The build-up a little fast, then a ramp down into the strike.
      seg(start, Math.max(start, s - 0.55), 1.25, hook ? { caption: hook } : {});
      seg(Math.max(start, s - 0.55), Math.max(start, s - 0.15), 0.6, hook ? { caption: hook } : {});
      seg(Math.max(start, s - 0.15), after, 0.25, hook ? { caption: hook } : {});
      // Contact: the frame held, the picture punching in on the ball.
      if (freeze) shots.push({ track: i, angle, from: after, to: after, rate: 1, hold: 0.45, replay: false, fx: { zoom: { from: 1, to: punch, over: 0.1 } } });
      // The flight, slowed, the zoom letting go; a flash as it goes in.
      seg(after, Math.min(dur, g + 0.08), slowFlight, { fx: { ...(freeze ? { zoom: { from: punch, to: 1, over: 0.35 } } : {}), flashAt: g } });
      // Real time again: the net, the shake, the reaction caption; tight on the celebration.
      const end = Math.min(dur, g + (reel ? 1.3 : 1.9));
      if (end > g + 0.1) {
        const cut = celebCut(t);
        if (cut !== null && cut > g + 0.4 && cut < end - 0.3) {
          seg(g + 0.08, cut, 1, { caption: hit, fx: { flashAt: g, shakeAt: g } });
          shots.push({ track: i, angle: "tight", from: cut, to: end, rate: 1, replay: false, caption: hit });
        } else seg(g + 0.08, end, 1, { caption: hit, fx: { flashAt: g, shakeAt: g } });
      }
    });
    // One more time, from another camera, then the name card.
    const again = cap[2] ?? pick(TIKTOK_AGAIN, "again");
    // Tall pictures from these cameras are wide: zoomed in on the ball, so it reads on a phone.
    const againAngle = pick<ClipAngle>(["net", "strike", "net", "spider"], "again-angle");
    const z = againAngle === "strike" ? 1 : 1.4;
    shots.push(replayShot(last, againAngle, closeWindow(lt), 0.4, { flashCut: true, zoom: { from: z, to: z, over: 0 } }, 3.2, again));
    shots.push({ track: last, angle: "tight", from: Math.min(trackDuration(lt), lt.goalT + 1.0), to: Math.min(trackDuration(lt), lt.goalT + 1.0), rate: 1, hold: 1.6, replay: true, fx: { card: "name" } });
    return edit;
  }

  if (style === "fan") {
    const angle = pick<ClipAngle>(["fanSide", "fanHigh", "fanSide", "fanHigh", "fan"], "seat");
    const pinch = pick([1, 1.3, 1.45, 1.6], "pinch");
    tracks.forEach((t, i) => {
      const dur = trackDuration(t);
      const start = Math.max(0, t.strikeT - pick([3.5, 4.5, 6], "lead"));
      const at = Math.max(start + 0.2, t.strikeT - 1.1);
      shots.push({ track: i, angle, from: start, to: at, rate: 1, replay: false });
      shots.push({ track: i, angle, from: at, to: dur, rate: 1, replay: false, fx: { zoom: { from: 1, to: pinch, over: 0.45 }, shakeAt: t.goalT } });
    });
    return edit;
  }

  if (style === "highlights") {
    const order = pick<ClipAngle[]>([["net", "strike", "reverse", "spider"], ["strike", "reverse", "net", "spider"], ["reverse", "net", "spider", "strike"]], "order");
    tracks.forEach((t, i) => {
      const dur = trackDuration(t);
      const from = Math.max(0, t.strikeT - pick([2.4, 3, 3.6], `lead${i}`));
      const to = Math.min(dur, t.goalT + (reel ? 1.0 : 1.4));
      shots.push(...liveShots(i, t, "tv", from, to, i > 0 ? { flashCut: true } : undefined));
      const w = { from: Math.max(0, t.strikeT - 0.4), to: Math.min(dur, t.goalT + 0.3) };
      shots.push(replayShot(i, order[i % order.length], w, airFinish(t) ? 0.4 : 0.55, { flashCut: true, label: "REPLAY" }, 2.6));
    });
    const at = Math.min(trackDuration(lt), lt.goalT + 1.2);
    shots.push({ track: last, angle: "tv", from: at, to: at, rate: 1, hold: reel ? 3.0 : 2.4, replay: true, fx: { card: "stats" } });
    return edit;
  }

  if (style === "reverse") {
    const live: ClipAngle = pick<ClipAngle>(["net", "spider", "reverse"], "live");
    tracks.forEach((t, i) => {
      const from = Math.max(0, t.strikeT - 4);
      shots.push(...liveShots(i, t, live, from, trackDuration(t)));
    });
    const again: ClipAngle = live === "reverse" ? pick<ClipAngle>(["tv", "strike"], "again") : pick<ClipAngle>(["tv", "strike", "reverse"], "again");
    shots.push(replayShot(last, again, replayWindow(lt), REPLAY_RATE, { label: "SLOW-MO" }));
    return edit;
  }

  // Broadcast: the TV live, then the replays.
  tracks.forEach((t, i) => shots.push(...liveShots(i, t, "tv", 0, trackDuration(t))));
  const air = airFinish(lt);
  const strike = (lbl = "SUPER SLO-MO") => replayShot(last, "strike", strikeWindow(lt), air ? AIR_REPLAY_RATE : 0.32, { label: lbl }, 4.2);
  const plans: (() => Shot[])[] = [
    () => [replayShot(last, "reverse", replayWindow(lt), 0.5, { label: "REVERSE ANGLE" }), strike(), replayShot(last, "net", closeWindow(lt), 0.45, { label: "BEHIND THE GOAL" })],
    () => [replayShot(last, "net", replayWindow(lt), REPLAY_RATE, { label: "BEHIND THE GOAL" }), strike()],
    () => [replayShot(last, "spider", replayWindow(lt), 0.5, { label: "SPIDERCAM" }), replayShot(last, "reverse", closeWindow(lt), 0.42, { label: "REVERSE ANGLE" }), strike()],
    () => [strike("ISOLATED"), replayShot(last, "reverse", replayWindow(lt), 0.5, { label: "REVERSE ANGLE" })],
  ];
  const plan = pick(plans, "replays")();
  // A reel keeps to one replay, so it stays short.
  shots.push(...(reel ? plan.slice(0, 1) : plan));
  return edit;
}
