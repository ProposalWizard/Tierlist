/**
 * MATCH FEEL on the phone (the website's Settings → Match feel: New, its
 * default; lib/star/matchFeel.ts says what and how much, CanvasMatch does it).
 * Looks and buzz only, run by the screen around the driver, like sound.ts:
 *   - your strike: a wind-up, then the contact lands (a camera punch along the
 *     hit and a buzz scaled by how hard and clean it was), and the picture
 *     holds a beat (the hit-stop) before the flight starts. Nothing is stepped
 *     while it holds, so the flight is step for step the same (CanvasMatch feelTick);
 *   - the keeper's glove and the woodwork: a smaller punch, a tiny freeze, a buzz;
 *   - the camera nudge (CanvasMatch nudge): a goal, a save, a block, the post;
 *   - a buzz when the net bulges.
 * The keeper's slow motion (keeperShow.ts keeperSlowRate) is the "Broadcast"
 * keeper look only; the website's default ("Natural") has none, so neither
 * has the phone. The driver is never changed: it is only stepped later.
 */
import { Platform, Vibration } from "react-native";
import * as Haptics from "expo-haptics";
import { OUTCOME_TEXT } from "@/lib/star/canvasEngine";
import { CX } from "@/lib/star/pitch";
import { autoKickOf } from "@/lib/star/penaltyTaking";
import { matchFeelOn, feelDials, strikeFeel, punchOffset, type StrikeFeel } from "@/lib/star/matchFeel";
import type { Ball } from "@/lib/star/canvasEngine";
import type { MatchDriver } from "./driver";
import { toScreen, type Cam } from "./view";

/** A phone buzz of about `ms` (CanvasMatch feelHaptic → navigator.vibrate(ms)). Never throws. */
export function feelBuzz(ms: number) {
  if (!(ms > 0)) return;
  try {
    if (Platform.OS === "android" || Platform.OS === "web") { Vibration.vibrate(Math.round(ms)); return; }
    const style = ms < 14 ? Haptics.ImpactFeedbackStyle.Light : ms < 26 ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Heavy;
    Haptics.impactAsync(style).catch(() => {});
  } catch { /* no buzz on this phone */ }
}

export function matchFeel() {
  /** Seconds the picture is held (the wind-up + the hit-stop), and of that the wind-up. */
  let hold = 0, windUp = 0;
  let pending: { f: StrikeFeel; vx: number; vy: number } | null = null;
  let punch = { at: -1, dur: 1, px: 0, vx: 0, vy: 0 };
  let shake = { t: 0, dur: 1, mag: 0 };
  let strikeSeen: unknown = null, ballSeen: Ball | null = null, saves = 0, phase = "";
  let prev: { vx: number; vy: number; vz: number } | null = null;
  let now = 0;

  const doPunch = (px: number, dur: number, vx: number, vy: number) => {
    if (!(px > 0)) return;
    const left = punch.at + punch.dur - now;
    if (left > 0 && punch.px * (left / punch.dur) > px) return;
    punch = { at: now, dur, px, vx, vy };
  };
  const freeze = (s: number) => { if (s > 0) hold = Math.max(hold, s); };
  const nudge = (dur: number, mag: number) => { shake = { t: dur, dur, mag }; };
  const land = () => {
    const p = pending;
    pending = null;
    if (!p) return;
    doPunch(p.f.shakePx, 0.22 + 0.12 * p.f.power, p.vx, p.vy);
    feelBuzz(p.f.hapticMs);
  };

  return {
    /** First thing every frame, with the frame's real seconds: true while the picture holds (step nothing). */
    tick(dt: number): boolean {
      now += dt;
      if (!(hold > 0)) return false;
      if (windUp > 0) { windUp -= dt; if (windUp <= 0) { windUp = 0; land(); } }
      hold -= dt;
      if (hold <= 0) { hold = 0; if (pending) land(); return false; }
      return true;
    },
    /** After the frame's steps: what the driver did this frame, felt. `dt` = match seconds stepped. */
    follow(d: MatchDriver, dt: number) {
      if (shake.t > 0) shake.t = Math.max(0, shake.t - dt);
      if (!matchFeelOn()) { phase = d.phase; return; }
      const D = feelDials();
      // Your strike (CanvasMatch handleContact's Match feel block).
      const fs = d.feelStrike;
      if (fs && fs !== strikeSeen) {
        strikeSeen = fs;
        const b = fs.ball;
        const f = strikeFeel(Math.hypot(b.vel.x, b.vel.y, b.vz), fs.grade, D, fs.air);
        pending = { f, vx: b.vel.x, vy: b.vel.y };
        windUp = f.windUpS;
        hold = f.windUpS + f.hitStopS;
        if (!(hold > 0)) { hold = 0; land(); }
      }
      // The ball in flight: the keeper's gloves (feelGlove).
      const b = d.ball;
      if (b !== ballSeen) { ballSeen = b; saves = b?.actionLog?.length ?? 0; prev = null; }
      if (b) {
        const log = b.actionLog ?? [];
        for (let i = saves; i < log.length; i++) {
          const a = log[i];
          if (a.kind === "save" && a.actor === "keeper" && a.save && a.save !== "beaten" && D.gloveImpact > 0) {
            const speed = prev ? Math.hypot(prev.vx, prev.vy, prev.vz) : 15;
            const k = Math.max(0.25, Math.min(1, (speed - 6) / 20));
            const held = a.save === "catch";
            doPunch(D.shakePx * 0.5 * k * D.gloveImpact, 0.22, 0, 1);
            freeze((held ? 0.035 : 0.05) * k * D.gloveImpact);
            feelBuzz(Math.round(D.hapticMs * 0.5 * k));
          }
        }
        saves = log.length;
        prev = { vx: b.vel.x, vy: b.vel.y, vz: b.vz };
      }
      // The result (resolveOutcome's nudges, feelOutcome's net and clang).
      if (d.phase === "result" && phase !== "result" && d.outcome) {
        const res = d.outcome, goal = OUTCOME_TEXT[res].kind === "goal";
        const auto = autoKickOf(d.sc);
        const speed = prev ? Math.hypot(prev.vx, prev.vy, prev.vz) : 15;
        const k = Math.max(0.3, Math.min(1, (speed - 5) / 20));
        const banners = d.feature?.scene?.banners !== false;
        if (auto?.side === "them") { if (!goal && (res === "saved" || res === "caught" || res === "tipped")) nudge(0.18, 0.14); }
        else if (auto && !goal) { /* no nudge */ }
        else if (goal) { if (banners) nudge(0.4, 0.35); }
        else if (res === "tackled" || res === "blocked" || res === "saved" || res === "caught") nudge(0.18, 0.14);
        else if (res === "post") nudge(0.28, 0.25);
        if (goal && b && D.netBulge > 0) feelBuzz(Math.round(D.hapticMs * 1.4));
        if (res === "post" && b) {
          doPunch(D.shakePx * 0.9 * k, 0.4, 1, 0);
          freeze(0.04 * k);
          feelBuzz(Math.round(D.hapticMs * 0.8 * k));
        }
      }
      phase = d.phase;
    },
    /** The camera's offset this frame, px: the nudge and the punch along the hit. */
    offset(cam: Cam): { x: number; y: number } {
      let ox = 0, oy = 0;
      if (shake.t > 0) {
        const across = cam.facing === "up" ? cam.vp.x2 - cam.vp.x1 : cam.vp.y2 - cam.vp.y1;
        const unit = cam.W / across;
        const m = shake.mag * unit * (shake.t / shake.dur);
        ox = Math.sin(shake.t * 73) * m;
        oy = Math.cos(shake.t * 57) * m * 0.7;
      }
      if (punch.px > 0 && now - punch.at <= punch.dur) {
        const a = toScreen(cam, { x: CX, y: 10 }), q = toScreen(cam, { x: CX + punch.vx, y: 10 + punch.vy });
        const dx = q.X - a.X, dy = q.Y - a.Y, l = Math.hypot(dx, dy) || 1;
        const o = punchOffset(now - punch.at, punch.dur, punch.px, dx / l, dy / l);
        ox += o.x; oy += o.y;
      }
      return { x: ox, y: oy };
    },
  };
}
