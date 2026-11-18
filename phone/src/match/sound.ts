/**
 * THE MATCH'S SOUNDS ON THE PHONE (expo-audio), with the website's triggers.
 *
 * The website makes them in code (lib/star/matchSound.ts, Web Audio); the
 * phone plays the same recipes rendered once to files
 * (tools/match-sfx.py → match/assets/sfx/) and your header's own file
 * (public/sfx/match-header.mp3). The same gate stops a sound repeating on
 * top of itself (lib/star/soundGate.ts), and Settings → Sound off silences
 * them (the website's Sound effects switch).
 *
 * WHEN, read off the driver each frame (CanvasMatch's call sites):
 *   - a chance served: the whistle (loadScenario's playWhistle);
 *   - a strike: the thump by how hard (Match feel: New's playStrike, the
 *     ball's speed through strikeFeel), your header its own file;
 *   - in flight: a pass received or a shot by the receiver, the kick; the
 *     woodwork, the post and a groan; a keeper's glove (catch or parry);
 *     a ball landing from the air, the thud;
 *   - the result (resolveOutcome): a goal, the net and the cheer; a save,
 *     the save and the groan; blocked/tackled, the save; offside, the
 *     whistle; their penalty and your keeper's save the other way round;
 *   - goals in the commentary: their goal, a groan; ours, a cheer;
 *   - half time and full time: the whistle.
 * Not here: Leo's update sounds (the big-moment heartbeat, the late roar;
 * off by default on the website too) and the Arcade pack's files (another
 * texture pack, not the default).
 */
import { createAudioPlayer, type AudioPlayer } from "expo-audio";
import { makeSoundGate } from "@/lib/star/soundGate";
import { strikeFeel, DEFAULT_FEEL_DIALS } from "@/lib/star/matchFeel";
import { OUTCOME_TEXT, type Ball } from "@/lib/star/canvasEngine";
import { autoKickOf } from "@/lib/star/penaltyTaking";
import { isAirKind } from "@/lib/star/airDrawings";
import { getPrefs } from "../game/prefs";
import type { MatchDriver } from "./driver";

/* eslint-disable @typescript-eslint/no-require-imports */
const FILES: Record<string, number> = {
  kick: require("./assets/sfx/kick.wav"), touch: require("./assets/sfx/touch.wav"), net: require("./assets/sfx/net.wav"),
  post: require("./assets/sfx/post.wav"), save: require("./assets/sfx/save.wav"), whistle: require("./assets/sfx/whistle.wav"),
  "crowd-cheer": require("./assets/sfx/crowd-cheer.wav"), "crowd-groan": require("./assets/sfx/crowd-groan.wav"),
  "strike-scuff": require("./assets/sfx/strike-scuff.wav"),
  "strike-15": require("./assets/sfx/strike-15.wav"), "strike-35": require("./assets/sfx/strike-35.wav"), "strike-55": require("./assets/sfx/strike-55.wav"),
  "strike-75": require("./assets/sfx/strike-75.wav"), "strike-95": require("./assets/sfx/strike-95.wav"),
  "thud-25": require("./assets/sfx/thud-25.wav"), "thud-60": require("./assets/sfx/thud-60.wav"), "thud-100": require("./assets/sfx/thud-100.wav"),
  "clang-50": require("./assets/sfx/clang-50.wav"), "clang-100": require("./assets/sfx/clang-100.wav"),
  "glove-hold-40": require("./assets/sfx/glove-hold-40.wav"), "glove-hold-100": require("./assets/sfx/glove-hold-100.wav"),
  "glove-parry-40": require("./assets/sfx/glove-parry-40.wav"), "glove-parry-100": require("./assets/sfx/glove-parry-100.wav"),
  header: require("./assets/sfx/match-header.mp3"),
};
/* eslint-enable @typescript-eslint/no-require-imports */

const players = new Map<string, AudioPlayer>();
function player(file: string): AudioPlayer | null {
  let p = players.get(file);
  if (!p) {
    try { p = createAudioPlayer(FILES[file]); } catch { return null; }
    players.set(file, p);
  }
  return p;
}
/** Load every sound once (the first match), so the first kick never waits on a file. */
function preload() { for (const f of Object.keys(FILES)) player(f); }

const gate = makeSoundGate();
/** Play `file` (gated as `name`, the website's gate names) at `volume`. */
function play(name: string, file: string, volume = 1) {
  if (!getPrefs().sound) return;
  if (!gate(name, Date.now())) return;
  const p = player(file);
  if (!p) return;
  try { p.volume = Math.max(0, Math.min(1, volume)); void p.seekTo(0); p.play(); } catch { /* a sound never breaks the match */ }
}
const nearest = (v: number, steps: number[]) => steps.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a));

// matchSound's play* calls, by name.
const S = {
  kick: () => play("kick", "kick"),
  touch: () => play("kick", "touch"),
  net: () => play("net", "net"),
  post: () => play("post", "post"),
  save: () => play("save", "save"),
  whistle: () => play("whistle", "whistle"),
  cheer: () => play("crowd-cheer", "crowd-cheer"),
  groan: () => play("crowd-groan", "crowd-groan"),
  strike: (power: number, gain: number, scuff: boolean) => {
    if (scuff) { play("kick", "strike-scuff", gain); return; }
    // Rendered at gain 1 for five strengths: the nearest, at this strike's loudness.
    play("kick", `strike-${nearest(power * 100, [15, 35, 55, 75, 95])}`, gain);
  },
  header: (power: number, gain: number) => play("kick", "header", (0.75 + 0.35 * Math.max(0, Math.min(1, power))) * gain),
  thud: (k: number) => play("thud", `thud-${nearest(k * 100, [25, 60, 100])}`),
  clang: (k: number) => play("clang", `clang-${nearest(k * 100, [50, 100])}`),
  glove: (k: number, held: boolean) => play("glove", `glove-${held ? "hold" : "parry"}-${nearest(k * 100, [40, 100])}`),
};

/** The crowd's cheer on its own (the ceremonies' swell as a name is read out). */
export function playCheer() { preload(); S.cheer(); }

/** Follows one match's driver frame by frame and plays what the website plays when. */
export function matchSounds() {
  preload();
  let phase = "", sc: unknown = null, ball: Ball | null = null, saves = 0;
  let prev: { z: number; vz: number; vx: number; vy: number } | null = null;
  let bannerAt = -1, halfTime = false, done = false, us = -1, them = -1;
  return {
    follow(d: MatchDriver) {
      // A chance served (loadScenario's whistle).
      if (d.phase === "aim" && (phase !== "aim" || d.sc !== sc)) S.whistle();
      sc = d.sc;
      // A strike: a new ball on the pitch.
      if (d.ball && d.ball !== ball) {
        const b = d.ball;
        const speed = Math.hypot(b.vel.x, b.vel.y, b.vz);
        const air = isAirKind(d.sc.kind) ? (d.sc.kind === "header" ? "header" : "volley") : undefined;
        // The grade of contact comes from the shot model (off by default on the website): a clean strike.
        const f = strikeFeel(speed, undefined, DEFAULT_FEEL_DIALS, air);
        if (f.header) S.header(Math.max(f.power, 0.5), f.gain); else S.strike(f.power, f.gain, f.scuff);
        saves = b.actionLog?.length ?? 0;
        prev = null;
      }
      ball = d.ball;
      // The ball in flight: landing thuds, the keeper's gloves.
      if (ball && d.phase === "flight") {
        if (prev && prev.z > 0.3 && ball.z < 0.12 && prev.vz < -2) S.thud(Math.min(1, -prev.vz / 11));
        const log = ball.actionLog ?? [];
        for (let i = saves; i < log.length; i++) {
          const a = log[i];
          if (a.kind === "save" && a.actor === "keeper" && a.save && a.save !== "beaten") {
            const sp = prev ? Math.hypot(prev.vx, prev.vy, prev.vz) : 15;
            S.glove(Math.max(0.25, Math.min(1, (sp - 6) / 20)), a.save === "catch");
          }
        }
        saves = log.length;
        prev = { z: ball.z, vz: ball.vz, vx: ball.vel.x, vy: ball.vel.y };
      }
      // Captions in flight: a pass received or a receiver's shot (the kick), the woodwork.
      if (d.banner && d.banner.at !== bannerAt) {
        bannerAt = d.banner.at;
        if (d.phase === "flight") {
          if (d.banner.text === "PASS" || d.banner.text === "DEFLECTED" || d.banner.text === "OFF THE WALL") S.kick();
          if (d.banner.text === "POST") { S.post(); S.groan(); }
        }
      }
      // The result (resolveOutcome's sounds).
      if (d.phase === "result" && phase !== "result" && d.outcome) {
        const res = d.outcome, goal = OUTCOME_TEXT[res].kind === "goal";
        const auto = autoKickOf(d.sc);
        const sp = prev ? Math.hypot(prev.vx, prev.vy, prev.vz) : 15;
        if (auto?.side === "them") {
          if (goal) { S.net(); S.groan(); }
          else if (res === "saved" || res === "caught" || res === "tipped") { S.save(); S.cheer(); }
          else { if (res === "post") S.post(); S.cheer(); }
        } else if (auto && !goal) { if (res === "post") S.post(); else S.save(); S.groan(); }
        else if (goal) { S.net(); S.cheer(); }
        else if (res === "tackled" || res === "blocked") S.save();
        else if (res === "offside") S.whistle();
        else if (res === "post") { S.post(); S.groan(); }
        else if (res === "saved") { S.save(); S.groan(); }
        else if (res === "caught") S.save();
        if (res === "post") S.clang(Math.max(0.3, Math.min(1, (sp - 5) / 20)));
      }
      phase = d.phase;
      // Goals in the commentary: theirs a groan, ours a cheer.
      if (d.phase === "feed") {
        if (us >= 0 && d.oppScore > them) S.groan();
        else if (us >= 0 && d.userScore > us) S.cheer();
      }
      us = d.userScore; them = d.oppScore;
      // Half time and full time.
      const ht = !!d.pause?.halfTime;
      if (ht && !halfTime) S.whistle();
      halfTime = ht;
      if (d.done && !done) S.whistle();
      done = d.done;
    },
    stop() { for (const p of players.values()) { try { p.pause(); } catch { /* gone */ } } },
  };
}
