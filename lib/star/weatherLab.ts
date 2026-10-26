/**
 * THE WEATHER TEST PAGE'S CONDITIONS AND ITS SHOT/PASS LAB (Leo, 22 Oct 2026).
 *
 * `buildConditions` turns the page's dials (weather, wind direction and
 * speed, pitch quality, dry/wet ground) into the match's `Conditions`, with
 * the new wind/skid/grab fields (pitchWeather.ts). Only /star-weather-dev
 * calls it; the career match still uses `conditionsFor` (weather.ts).
 *
 * `flyBall` flies one strike through the engine's OWN ball step
 * (integrateBallOld / integrateBallReal: the same functions the match calls
 * every step), so the lab's paths are the match's ball, not a drawing of it.
 */
import { integrateBallOld, type Ball } from "./canvasEngine";
import { integrateBallReal } from "./ballPhysics";
import { conditionsFor, type Conditions, type Weather } from "./weather";
import { clubPitch, groundFor, pitchLabel, pitchWord, type Ground } from "./pitchQuality";

export interface WeatherDials {
  weather: Weather;
  /** m/s at 10 m. 0 = still. A breeze is ~5, a strong wind ~10, a gale ~17. */
  windSpeed: number;
  /** Where the wind blows TO, degrees clockwise on screen: 0 towards the goal
   *  you attack (behind you), 90 left to right, 180 into your face. */
  windTo: number;
  /** 0.25..1, 1 a perfect pitch. */
  pitch: number;
  ground: Ground;
  /**
   * How hard a bad pitch is on the ball. "tame" (the default, feel check
   * 22 Oct 2026): it runs almost as normal, then grabs and stops sharply at a
   * crawl, so about 1 normal pass in 11 more dies short on the worst dry pitch
   * than on a clear day. "harsh": the first build, kept to compare (87% of
   * normal passes died short on the worst dry pitch, Old ball).
   */
  worst?: "tame" | "harsh";
}

export const CLEAR_DIALS: WeatherDials = { weather: "clear", windSpeed: 0, windTo: 90, pitch: 1, ground: "normal" };

/** The wind's direction in words, for a player shooting up the screen. */
export function windWords(to: number): string {
  const a = ((to % 360) + 360) % 360;
  const names = ["behind you", "behind you, left to right", "left to right", "into you, left to right",
    "in your face", "into you, right to left", "right to left", "behind you, right to left"];
  return names[Math.round(a / 45) % 8];
}

/** The engine's pitch axes: x across (right on screen), y up the pitch away from the goal. */
export function windVector(speed: number, to: number): { x: number; y: number } {
  const a = (to * Math.PI) / 180;
  return { x: speed * Math.sin(a), y: -speed * Math.cos(a) };
}

/** How hard a baked, bad pitch grips the ball at a bounce (tame). Tuned by scripts/weather/feelCheck.mts. */
export const SKID_DRY = 0.4;

export function buildConditions(d: WeatherDials): Conditions {
  const b = 1 - Math.max(0.25, Math.min(1, d.pitch));   // how bad the pitch is
  let drag = 1, friction = 1, bounce = 1, skid = 0;
  let label = "Clear", note = "Perfect conditions.";
  if (d.weather === "wind") { label = "Windy"; note = "The ball will not hold its line."; }
  if (d.weather === "rain") {
    // As the real game's rain (friction 0.62, bounce 0.9) plus the skid.
    friction = 0.62; bounce = 0.9; skid = 0.3;
    label = "Rain"; note = "Greasy on top. It skids on and runs away from you.";
  }
  if (d.weather === "heavy") {
    // The real game's heavy pitch, a bit stronger (plan: "as now, a bit stronger").
    drag = 1.25; friction = 1.9; bounce = 0.55; skid = 0.1;
    label = "Heavy rain"; note = "A slow, wet pitch. Nothing runs.";
  }
  const wet = d.weather === "rain" || d.weather === "heavy";
  const ground: Ground = wet ? "wet" : d.ground === "wet" ? "normal" : d.ground;
  // A worn pitch: a bit slower and a bit flatter, whatever the weather.
  const harsh = d.worst === "harsh";
  friction *= 1 + (harsh ? 0.5 : 0.05) * b;
  bounce *= 1 - 0.15 * b;
  // Puddles on a bad wet pitch hold the ball: less skid.
  skid *= 1 - 0.4 * b;
  let deadBelow: number | undefined;
  if (ground === "dry" && b > 0.04) {
    // Baked and bare: low bounce, slows fast, and at worst a slow ball stops dead.
    friction *= 1 + (harsh ? 0.9 : 0.08) * b;
    bounce *= 1 - 0.4 * b;
    deadBelow = Math.round((harsh ? 3.2 : 2.5) * Math.pow(b, 1.3) * 100) / 100;
    // Tame: the baked, rough turf grips the ball at each bounce, so a flatter
    // bounce does not let a skipping ball keep more of its pace (without this
    // a ground pass ran FURTHER on a bad dry pitch than on a perfect one).
    if (!harsh) skid = -SKID_DRY * b;
  }
  const windV = d.windSpeed > 0 ? windVector(d.windSpeed, d.windTo) : undefined;
  const pl = pitchLabel(1 - b, ground);
  return {
    weather: d.weather,
    pitch: d.weather === "heavy" ? 0.85 : wet ? 0.45 : b,
    label,
    note: `${note} ${pl}.${windV ? ` Wind ${Math.round(d.windSpeed)} m/s, ${windWords(d.windTo)}.` : ""}`,
    drag, friction: round3(friction), bounce: round3(bounce), wind: 0,
    ...(windV ? { windV } : {}),
    ...(skid !== 0 ? { skid: round3(skid) } : {}),
    ...(deadBelow ? { deadBelow } : {}),
  };
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;

/** "Pitch: poor, dry" for these dials (the pre-match line, shown on the test page only). */
export function dialsPitchLabel(d: WeatherDials): string {
  const wet = d.weather === "rain" || d.weather === "heavy";
  return pitchLabel(d.pitch, wet ? "wet" : d.ground === "wet" ? "normal" : d.ground);
}
export { pitchWord };

// ── The lab ──────────────────────────────────────────────────────────────────

export interface Strike { id: string; name: string; speed: number; angle: number; }
export const STRIKES: Strike[] = [
  { id: "ground", name: "Ground pass", speed: 14, angle: 1.5 },
  { id: "driven", name: "Driven shot", speed: 27, angle: 8 },
  { id: "chip", name: "Lofted pass", speed: 17, angle: 35 },
  { id: "long", name: "Long ball", speed: 25, angle: 30 },
];

export interface Flight {
  path: { x: number; y: number; z: number }[];
  /** Metres along the strike to the first bounce. */
  carry: number;
  /** Metres sideways at the first bounce (+ right). */
  drift: number;
  /** Metres sideways where it stops (+ right). */
  driftEnd: number;
  apex: number;
  /** Highest it gets after the first bounce. */
  bounce: number;
  /** Metres it runs on after the first bounce. */
  roll: number;
  /** Metres it travels in all, start to stop. */
  total: number;
  /** Seconds until it stops (or the 12 s cap). */
  tStop: number;
}

/** Fly one strike, straight up the screen from (0, 0), through the engine's ball. */
export function flyBall(speed: number, angleDeg: number, cond: Conditions | undefined, mode: "old" | "new", aimDeg = 0): Flight {
  const a = (angleDeg * Math.PI) / 180, h = (aimDeg * Math.PI) / 180;
  const vh = speed * Math.cos(a);
  const ball = {
    pos: { x: 0, y: 0 }, vel: { x: vh * Math.sin(h), y: -vh * Math.cos(h) },
    z: 0.11, vz: speed * Math.sin(a), spin: 0, topspin: 0,
    resting: false, loose: false, contactCd: 0, receiverControlT: 0, event: null, inNet: false,
  } as unknown as Ball;
  const dt = 1 / 180;
  const path = [{ x: 0, y: 0, z: 0.11 }];
  let apex = 0.11, landed = false, carry = 0, drift = 0, bounce = 0, t = 0;
  let lx = 0, ly = 0;
  for (; t < 12 && !ball.resting; t += dt) {
    if (mode === "new") integrateBallReal(ball, cond, dt); else integrateBallOld(ball, cond, dt);
    if (!landed) {
      apex = Math.max(apex, ball.z);
      if (ball.z <= 0 && t > 0.02) { landed = true; carry = -ball.pos.y; drift = ball.pos.x; lx = ball.pos.x; ly = ball.pos.y; }
    } else bounce = Math.max(bounce, ball.z);
    if (Math.round(t / dt) % 3 === 0) path.push({ x: ball.pos.x, y: -ball.pos.y, z: ball.z });
  }
  path.push({ x: ball.pos.x, y: -ball.pos.y, z: ball.z });
  if (!landed) { carry = -ball.pos.y; drift = ball.pos.x; lx = ball.pos.x; ly = ball.pos.y; }
  return {
    path, carry, drift, driftEnd: ball.pos.x, apex, bounce,
    roll: Math.hypot(ball.pos.x - lx, ball.pos.y - ly),
    total: Math.hypot(ball.pos.x, ball.pos.y), tStop: t,
  };
}

/** Many strikes of one kind (speed ±12%, angle ±20%, aim ±6°), averaged. */
export function measure(strike: Strike, cond: Conditions | undefined, mode: "old" | "new", n = 200): Omit<Flight, "path"> {
  let s = 12345;
  const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  const sum = { carry: 0, drift: 0, driftEnd: 0, apex: 0, bounce: 0, roll: 0, total: 0, tStop: 0 };
  for (let i = 0; i < n; i++) {
    const f = flyBall(strike.speed * (0.88 + rnd() * 0.24), strike.angle * (0.8 + rnd() * 0.4), cond, mode, (rnd() - 0.5) * 12);
    for (const k of Object.keys(sum) as (keyof typeof sum)[]) sum[k] += f[k];
  }
  for (const k of Object.keys(sum) as (keyof typeof sum)[]) sum[k] /= n;
  return sum;
}

// ── The plan for the real game (NOT wired in: Leo and Harry decide) ─────────

/**
 * What a career fixture WOULD play in if this were switched on: the same
 * weather roll as today (`conditionsFor`, so the same days stay windy or wet),
 * the wind given a speed (7.6-13 m/s, from today's strength) and a fixed
 * direction for the match, the home club's own pitch, and a dry spell from
 * `groundFor`. Only the weather test page's measurements call this.
 */
export function plannedDials(season: number, week: number, homeClub: string, homeCity = ""): WeatherDials {
  const today = conditionsFor(season, week, homeCity);
  const strength = Math.abs(today.wind) / 2.6;          // 0.4..1 on a windy day
  let h = season * 9176 + week * 313 + 7;
  for (let i = 0; i < homeClub.length; i++) h = Math.imul(h ^ homeClub.charCodeAt(i), 16777619);
  h = Math.imul(h, 2654435761) >>> 0;
  h = (h ^ (h >>> 13)) >>> 0;   // unsigned: a negative here gave every match the same direction (fixed 25 Oct)
  return {
    weather: today.weather,
    windSpeed: today.weather === "wind" ? Math.round(4 + strength * 9) : 0,
    windTo: (h % 8) * 45,
    pitch: clubPitch(homeClub).quality,
    ground: groundFor(season, week, today.weather === "rain" || today.weather === "heavy"),
    worst: "tame",
  };
}
