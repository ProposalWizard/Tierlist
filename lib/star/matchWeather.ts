/**
 * WEATHER IN A REAL CAREER MATCH (Leo's update, part "weather"; hub job 25 Oct 2026).
 *
 * The same plan the weather test page measured (`plannedDials`, weatherLab.ts):
 * today's weather roll for the fixture's date (so the same days stay windy or
 * wet), windy days given a speed and one direction, the HOME club's own pitch
 * (`clubPitch`), and a dry spell at the ends of the season. Internationals
 * are played on a national stadium's perfect pitch.
 *
 * Only read when Leo's update and its "weather" part are on (app/star-dev/page.tsx
 * and LineupIntro check at the call site). Off: the match gets `conditionsFor`,
 * exactly as before.
 */
import type { CareerState, Fixture } from "./types";
import type { Conditions } from "./weather";
import { buildConditions, plannedDials, dialsPitchLabel, type WeatherDials } from "./weatherLab";

/** The home club of a fixture ("" for an international: a perfect national stadium). */
export function homeClubOf(career: Pick<CareerState, "player">, fixture: Pick<Fixture, "home" | "opponent" | "kind">): string {
  if (fixture.kind === "international") return "";
  return fixture.home ? career.player.club : fixture.opponent;
}

export function matchDials(career: Pick<CareerState, "season" | "homeCity" | "player">, fixture: Pick<Fixture, "week" | "home" | "opponent" | "kind">): WeatherDials {
  const home = homeClubOf(career, fixture);
  const d = plannedDials(career.season, fixture.week, home, career.homeCity);
  return home ? d : { ...d, pitch: 1 };
}

/** The match's conditions, with `drawn` set so the match draws the rain and the wind arrow. */
export function matchConditions(career: Pick<CareerState, "season" | "homeCity" | "player">, fixture: Pick<Fixture, "week" | "home" | "opponent" | "kind">): Conditions {
  return { ...buildConditions(matchDials(career, fixture)), drawn: true };
}

const WORD: Record<WeatherDials["weather"], string> = { clear: "Clear", wind: "Windy", rain: "Rain", heavy: "Heavy rain" };

/** The pre-match line, short enough for the team sheet's date line:
 *  "Rain · poor, wet pitch", "Windy 12 m/s · perfect pitch". The wind's
 *  direction is the arrow in the match. */
export function weatherLine(d: WeatherDials): string {
  const w = d.weather === "wind" || (d.windSpeed > 0 && d.weather === "clear") ? `Windy ${Math.round(d.windSpeed)} m/s` : WORD[d.weather];
  const p = dialsPitchLabel(d).replace(/^Pitch: /, "");
  return `${w} · ${p} pitch`;
}
