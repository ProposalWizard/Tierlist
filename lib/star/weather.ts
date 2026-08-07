import { mulberry32 } from "./season";

/**
 * WEATHER AND THE STATE OF THE PITCH
 *
 * Every match was played on a perfect surface in still air. The ball behaved
 * identically in August and in February, which is the one thing about English
 * football nobody would recognise.
 *
 * This is the smallest possible version of the idea and deliberately so: it
 * changes the SURFACE and the AIR, not the rules. Nothing here reaches into the
 * keeper, the defence, the scenario or the odds — it multiplies three physics
 * constants and tells the player which way. §1.13: "avoid arbitrary randomness"
 * — the conditions are shown before you take aim, so a heavy pitch is a fact you
 * play around rather than a hidden dice roll.
 */

export type Weather = "clear" | "wind" | "rain" | "heavy";

export interface Conditions {
  weather: Weather;
  /** 0 perfect, 1 a bog. */
  pitch: number;
  label: string;
  note: string;
  /** Multipliers applied to the ball. 1 means "as it always was". */
  drag: number;
  friction: number;
  bounce: number;
  /** Sideways push, m/s². Only ever non-zero in wind. */
  wind: number;
}

const CLEAR: Conditions = {
  weather: "clear", pitch: 0,
  label: "Clear", note: "Perfect conditions.",
  drag: 1, friction: 1, bounce: 1, wind: 0,
};

/**
 * The conditions for a fixture.
 *
 * Seeded off the season and the week so they are the same every time you look
 * at that match, and so a career replayed from a save is the career you were
 * playing. Weighted heavily toward "nothing much", because weather that is
 * remarkable every week is not weather.
 */
export function conditionsFor(season: number, week: number, homeCity = ""): Conditions {
  const rng = mulberry32(season * 7307 + week * 131 + homeCity.length);
  const roll = rng();

  if (roll < 0.58) return CLEAR;

  if (roll < 0.76) {
    const strength = 0.4 + rng() * 0.6;
    return {
      weather: "wind",
      pitch: rng() * 0.2,
      label: "Windy",
      note: "It is swirling. The ball will not hold its line.",
      drag: 1,
      friction: 1,
      bounce: 1,
      // Signed, so it blows one way for the whole match rather than shimmering.
      wind: (rng() < 0.5 ? -1 : 1) * strength * 2.6,
    };
  }

  if (roll < 0.92) {
    return {
      weather: "rain",
      pitch: 0.35 + rng() * 0.3,
      label: "Rain",
      note: "Greasy on top. It will skid on and it will run away from you.",
      // A wet surface is faster: the ball slides rather than gripping.
      drag: 1,
      friction: 0.62,
      bounce: 0.9,
      wind: 0,
    };
  }

  return {
    weather: "heavy",
    pitch: 0.72 + rng() * 0.28,
    label: "Heavy pitch",
    note: "Cutting up badly. Nothing is running, and it is dying under you.",
    // A bog eats everything: the ball stops and it does not come up.
    drag: 1.25,
    friction: 1.75,
    bounce: 0.6,
    wind: 0,
  };
}

/** One line for the team sheet. */
export function conditionsLine(c: Conditions): string {
  return c.weather === "clear" ? c.label : `${c.label} — ${c.note}`;
}
