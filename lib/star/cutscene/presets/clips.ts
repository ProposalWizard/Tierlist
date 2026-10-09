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
  "walk-proud": [{ clip: "walk-proud" }, { clip: "walk_confident" }, { clip: "walk" }, { clip: "slump_walk", speed: 1.0, upright: 1 }],
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
  applaud: [{ clip: "applaud" }, { clip: "applause" }, { clip: "idle" }],
  // acting (Motion: Mocap — captured or adapted from captures, tools/mocap3d; Old plays the stand-in)
  "walk-confident": [{ clip: "walk_confident" }, { clip: "walk" }, { clip: "slump_walk", speed: 1.0, upright: 1 }],
  handshake: [{ clip: "handshake" }, { clip: "wave", speed: 0.8 }, { clip: "idle" }],
  hug: [{ clip: "hug" }, { clip: "idle" }],
  nod: [{ clip: "nod" }, { clip: "idle" }],
  point: [{ clip: "point" }, { clip: "boss-talk" }, { clip: "idle" }],
  "talk-hands": [{ clip: "talk" }, { clip: "boss-talk" }, { clip: "idle" }],
  "get-up": [{ clip: "get_up_side" }, { clip: "sitdown", from: 4.3, speed: -1.1 }],
  // seated
  sit: [{ clip: "sit_idle", hold: 0.35 }, { clip: "sitidle", hold: 0.45 }, { clip: "boss-sit", hold: 0.45 }],
  "sit-boss": [{ clip: "boss-sit", hold: 0.45 }, { clip: "sitidle", hold: 0.45 }],
  "sit-talk": [{ clip: "sit-talk" }, { clip: "sitidle", hold: 0.45 }],
  /** Getting up from a chair: the sitdown clip played backwards (sat 4.3 s → stood 0.75 s). */
  "stand-up": [{ clip: "stand-up" }, { clip: "stand_up" }, { clip: "sitdown", from: 4.3, speed: -1.1 }],
  "sit-down": [{ clip: "sit-down" }, { clip: "sit_down" }, { clip: "sitdown", from: 0.75, speed: 1.1 }],
  // football
  shot: [{ clip: "shot_r" }, { clip: "kick_r" }],
  kick: [{ clip: "kick_r" }],
  celebrate: [{ clip: "celebrate" }, { clip: "celebrate_fist" }],
  "celebrate-fist": [{ clip: "celebrate_fist" }, { clip: "celebrate" }],
  "celebrate-roar": [{ clip: "celebrate_roar" }, { clip: "celebrate_fist" }, { clip: "celebrate" }],
  "fist-pump": [{ clip: "celebrate_pump" }, { clip: "celebrate_fist" }, { clip: "celebrate" }],
  "celebrate-run": [{ clip: "celebrate_safe" }, { clip: "jog" }],
  cheer: [{ clip: "cheer_win" }, { clip: "celebrate" }],
  frustrated: [{ clip: "frustrated" }, { clip: "groan_loss" }],
  despair: [{ clip: "groan_loss" }, { clip: "frustrated" }],
  "keeper-ready": [{ clip: "ready_shuffle" }],
  "dive-left": [{ clip: "dive_left" }],
  "dive-right": [{ clip: "dive_right" }],
  "dive-left-low": [{ clip: "dive_left_low" }, { clip: "dive_left" }],
  "dive-right-low": [{ clip: "dive_right_low" }, { clip: "dive_right" }],
  "dive-left-high": [{ clip: "dive_left_high" }, { clip: "dive_left" }],
  "dive-right-high": [{ clip: "dive_right_high" }, { clip: "dive_right" }],
  "slide-tackle": [{ clip: "sliding_tackle" }],
  "poke-tackle": [{ clip: "poke_tackle" }],
  "chest-control": [{ clip: "chest_control" }],
  "thigh-control": [{ clip: "thigh_control" }],
  "knee-slide": [{ clip: "knee_slide" }, { clip: "celebrate_fist", from: 0.3, speed: 0.5 }],
  pickup: [{ clip: "pickup" }],
  stretch: [{ clip: "stretch" }],
  juggle: [{ clip: "juggle" }],
};

/** Running speed (m/s) of a gait clip at speed 1, so a path's pace sets its speed. */
export const GAIT_SPEED: Record<string, number> = {
  walk: 1.35, "walk-proud": 1.3, walk_confident: 1.4, "walk-sad": 1.0, slump_walk: 1.15,
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

/**
 * HOW GOOD EACH MOVE LOOKS (the cinematographer hides the weak ones).
 *   good  real mocap that holds up in a wide (celebrations, the strike, idles)
 *   ok    fine at mid size (talking, sitting)
 *   weak  a stand-in or a hand-made hold that looks stiff from far away
 *         (standing up from a chair, the handshake, walking, the pen, the
 *         trophy held up, the shirt held up, clapping)
 * cinema.ts `filmPass` never holds a wide shot on a weak move for more than
 * about a second: it cuts to a face, a prop or a reaction instead.
 * Names not listed count as "ok".
 */
export type MoveQuality = "good" | "ok" | "weak";

export const CLIP_QUALITY: Record<string, MoveQuality> = {
  idle: "good", "idle-boss": "good", jog: "good", run: "good", sprint: "good", dribble: "good",
  shot: "good", kick: "good", celebrate: "good", "celebrate-fist": "good", "celebrate-roar": "good", "fist-pump": "good",
  "celebrate-run": "good", "knee-slide": "good", "keeper-ready": "good", "dive-left": "good", "dive-right": "good",
  cheer: "ok", talk: "ok", "talk-boss": "ok", "talk-hands": "ok", sit: "ok", "sit-boss": "ok", "sit-talk": "ok", nod: "ok", wave: "ok", "wave-boss": "ok",
  frustrated: "ok", despair: "ok",
  "stand-up": "weak", "sit-down": "weak", "get-up": "weak", handshake: "weak", hug: "weak", point: "weak", applaud: "weak",
  walk: "weak", "walk-proud": "weak", "walk-sad": "weak", "walk-confident": "weak", pickup: "weak",
};

/** Body holds laid over the clips (perform3d.ts). */
export const POSE_QUALITY: Partial<Record<string, MoveQuality>> = {
  "trophy-overhead": "weak", "trophy-chest": "weak", "hold-shirt-up": "weak", "hand-on-shoulder": "weak",
  applaud: "weak", "salute-crowd": "weak", "badge-kiss": "weak", "arms-up": "ok", "knee-slide": "good",
  "lean-in": "ok", "lean-back": "ok", sit: "ok", stand: "ok", nod: "ok",
};

/** Walking gaits on a move track are weak (the feet slide); running ones hold up. */
export const GAIT_QUALITY: Record<string, MoveQuality> = {
  walk: "weak", "walk-proud": "weak", "walk-sad": "weak", "walk-confident": "weak",
  jog: "good", run: "good", sprint: "good", dribble: "good",
};

export const clipQuality = (name: string): MoveQuality => CLIP_QUALITY[name] ?? "ok";
