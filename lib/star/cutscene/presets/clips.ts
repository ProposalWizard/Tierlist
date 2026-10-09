/**
 * BODY CLIPS — the names a script may ask for, and what plays when the body
 * hasn't got that clip yet (the mocap builder adds real ones under the same
 * names; until then a stand-in plays, at a speed that suits it).
 *
 * Clips today: people3d anims.glb (idle, sitdown, sitidle, pickup, wave,
 * celebrate, jog, boss-idle, boss-talk, boss-sit, boss-wave), football.glb
 * (kick_r … slump_walk) and casino.glb (cheer_win, groan_loss …).
 */

export interface ClipChoice { clip: string; speed?: number; from?: number; hold?: number; upright?: number }

/** Asked-for name → stand-ins in order. The first the body has wins. */
export const CLIP_ALIASES: Record<string, ClipChoice[]> = {
  // gaits
  walk: [{ clip: "walk" }, { clip: "slump_walk", speed: 1.05, upright: 1 }, { clip: "jog", speed: 0.55 }],
  "walk-proud": [{ clip: "walk-proud" }, { clip: "walk" }, { clip: "slump_walk", speed: 1.0, upright: 1 }],
  "walk-sad": [{ clip: "walk-sad" }, { clip: "slump_walk", speed: 0.9 }],
  jog: [{ clip: "jog" }, { clip: "celebrate_safe", speed: 0.8 }],
  run: [{ clip: "run" }, { clip: "sprint", speed: 0.8 }, { clip: "jog", speed: 1.3 }],
  sprint: [{ clip: "sprint" }, { clip: "jog", speed: 1.8 }],
  dribble: [{ clip: "dribble_run" }, { clip: "jog" }],
  // standing
  idle: [{ clip: "idle" }],
  "idle-boss": [{ clip: "boss-idle" }, { clip: "idle" }],
  talk: [{ clip: "talk" }, { clip: "boss-talk" }, { clip: "idle" }],
  "talk-boss": [{ clip: "boss-talk" }, { clip: "idle" }],
  wave: [{ clip: "wave" }, { clip: "boss-wave" }],
  "wave-boss": [{ clip: "boss-wave" }, { clip: "wave" }],
  applaud: [{ clip: "applaud" }, { clip: "idle" }],
  // seated
  sit: [{ clip: "sitidle", hold: 0.45 }, { clip: "boss-sit", hold: 0.45 }],
  "sit-boss": [{ clip: "boss-sit", hold: 0.45 }, { clip: "sitidle", hold: 0.45 }],
  "sit-talk": [{ clip: "sit-talk" }, { clip: "sitidle", hold: 0.45 }],
  /** Getting up from a chair: the sitdown clip played backwards (sat 4.3 s → stood 0.75 s). */
  "stand-up": [{ clip: "stand-up" }, { clip: "sitdown", from: 4.3, speed: -1.1 }],
  "sit-down": [{ clip: "sit-down" }, { clip: "sitdown", from: 0.75, speed: 1.1 }],
  // football
  shot: [{ clip: "shot_r" }, { clip: "kick_r" }],
  kick: [{ clip: "kick_r" }],
  celebrate: [{ clip: "celebrate" }, { clip: "celebrate_fist" }],
  "celebrate-fist": [{ clip: "celebrate_fist" }, { clip: "celebrate" }],
  "celebrate-run": [{ clip: "celebrate_safe" }, { clip: "jog" }],
  cheer: [{ clip: "cheer_win" }, { clip: "celebrate" }],
  frustrated: [{ clip: "frustrated" }, { clip: "groan_loss" }],
  despair: [{ clip: "groan_loss" }, { clip: "frustrated" }],
  "keeper-ready": [{ clip: "ready_shuffle" }],
  "dive-left": [{ clip: "dive_left" }],
  "dive-right": [{ clip: "dive_right" }],
  "knee-slide": [{ clip: "knee_slide" }, { clip: "celebrate_fist", from: 0.3, speed: 0.5 }],
  pickup: [{ clip: "pickup" }],
  stretch: [{ clip: "stretch" }],
  juggle: [{ clip: "juggle" }],
};

/** Running speed (m/s) of a gait clip at speed 1, so a path's pace sets its speed. */
export const GAIT_SPEED: Record<string, number> = {
  walk: 1.35, "walk-proud": 1.3, "walk-sad": 1.0, slump_walk: 1.15,
  jog: 3.0, celebrate_safe: 3.4, sprint: 7.4, dribble_run: 4.6, run: 5.5,
};

/** What a role stands doing when nothing else is asked. */
export function defaultIdle(role: string, body: string): string {
  return body === "manager" || role === "manager" || role === "chairman" || role === "presenter" || role === "journalist" ? "idle-boss" : "idle";
}

/** Resolve an asked-for clip on a body that has `has`. Unknown names fall back to themselves, then idle. */
export function resolveClip(name: string, has: (c: string) => boolean): ClipChoice | null {
  if (has(name)) return { clip: name };
  for (const c of CLIP_ALIASES[name] ?? []) if (has(c.clip)) return c;
  if (has("idle")) return { clip: "idle" };
  return null;
}
