/**
 * lib/campaigns.ts — AD LANDING PAGES, as data (Harry, 25 Oct 2026: "custom
 * landing pages and custom accounts straight from TikTok/Instagram ads").
 *
 * Each entry is one page at /play/<slug> (middleware.ts rewrites it to
 * app/campaign/[campaign]). The page is written for that ad; its one button
 * makes a guest account (lib/guest/start.ts), records the campaign on it, and
 * drops the player straight into a ready-made career (the trial), skipping the
 * set-up screen.
 *
 * Add a campaign = add an entry here. The slug must not look like a tierlist
 * id (those are long random ids), so keep slugs short words with dashes.
 * Only live while NEXT_PUBLIC_GUEST_ACCOUNTS=on (lib/guest/config.ts).
 *
 * Every name here is invented.
 */

import type { CareerDivision } from "@/lib/star/calendar";

export interface Campaign {
  /** The address: /play/<slug>. Lowercase words and dashes only. */
  slug: string;
  /** Where the ad runs; the default utm_source when the link has none. */
  source: "tiktok" | "instagram" | "other";
  /** Big words at the top. Short: it must fit a phone in two lines. */
  headline: string;
  /** One line under the headline. */
  sub: string;
  /** Three quick points, shown as chips. */
  points: [string, string, string];
  /** The button. */
  cta: string;
  /** Small line under the button. */
  footnote: string;
  /** Two colours for the page's glow (hex). */
  colours: [string, string];
  /** The ready-made player the career starts with. */
  player: {
    firstName: string;
    lastName: string;
    /** The set-up screen always makes a striker ("ST"); keep it unless the game learns other positions. */
    position: string;
    nationality: string;
    preferredNumber: number;
  };
  /** Link preview (TikTok/Instagram in-app browsers show it). */
  meta: { title: string; description: string };
  /**
   * The player's name is fixed (Harry, 25 Oct 2026: "unless it's a very
   * specific reason to keep the name the same, I think always let them have
   * it"). Absent or false = the landing page lets them type their own name,
   * with `player`'s name filled in to start. Neither example sets it.
   */
  lockName?: boolean;
  /**
   * A custom start point (Harry: "If it's a league two ad, we could have a
   * custom start point. Why not?"). The trial's one club offer comes from
   * this division instead of the usual National League / North / South roll
   * (TrialProgress.startDivision, lib/star/scoutedPlacement.ts). Absent = the
   * normal roll.
   */
  startLeague?: CareerDivision;
}

/** Longest first or last name, the same as the game's set-up screen (ProfileSetup.tsx). */
export const NAME_MAX = 20;

/**
 * The name typed on a landing page, tidied: extra spaces gone, cut to
 * NAME_MAX. Null when either half is blank (the button then asks for a name).
 * There is no rude-word list in the repo, so this checks only blank and length.
 */
export function cleanPlayerName(first: string, last: string): { firstName: string; lastName: string } | null {
  const tidy = (s: string) => s.replace(/\s+/g, " ").trim().slice(0, NAME_MAX).trim();
  const firstName = tidy(first), lastName = tidy(last);
  if (!firstName || !lastName) return null;
  return { firstName, lastName };
}

export const CAMPAIGNS: Campaign[] = [
  {
    slug: "league-two-striker",
    source: "tiktok",
    headline: "League Two to the Ballon d'Or",
    sub: "You're 16. One trial. Score your way to the top.",
    points: ["Free to play", "No sign-up", "Saves as you go"],
    cta: "Start my career",
    footnote: "Plays in your browser. Save it to Google whenever you like.",
    colours: ["#10b981", "#f59e0b"],
    player: { firstName: "Jay", lastName: "Carter", position: "ST", nationality: "England", preferredNumber: 9 },
    meta: {
      title: "From League Two to the Ballon d'Or — play free",
      description: "Start as a 16-year-old striker and play your way to the Ballon d'Or. No sign-up.",
    },
    // The trial's club comes from League Two, as the ad says.
    startLeague: "league_two",
  },
  {
    slug: "wonderkid",
    source: "instagram",
    headline: "Can you make a wonderkid a legend?",
    sub: "Twenty seasons. Every goal is yours to take.",
    points: ["Real clubs", "Real leagues", "No sign-up"],
    cta: "Play now",
    footnote: "Free. One tap to start; save it with Google any time.",
    colours: ["#8b5cf6", "#ec4899"],
    player: { firstName: "Leon", lastName: "Hart", position: "ST", nationality: "England", preferredNumber: 10 },
    meta: {
      title: "Wonderkid to legend — Road to Ballon d'Or",
      description: "A football career game you can start in one tap. No sign-up.",
    },
  },
];

export function campaignFor(slug: string | null | undefined): Campaign | null {
  if (!slug) return null;
  return CAMPAIGNS.find((c) => c.slug === slug) ?? null;
}

/** The UTM words a landing page reads from its link (and the ad click ids). */
export const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "ttclid", "fbclid"] as const;
export type Utm = Partial<Record<(typeof UTM_KEYS)[number], string>>;

/** Picks the UTM words out of a link's query, each cut to 200 characters. */
export function utmFrom(params: { get(name: string): string | null }, campaign?: Campaign | null): Utm {
  const out: Utm = {};
  for (const k of UTM_KEYS) {
    const v = params.get(k);
    if (v) out[k] = v.slice(0, 200);
  }
  if (campaign) {
    if (!out.utm_source) out.utm_source = campaign.source;
    if (!out.utm_campaign) out.utm_campaign = campaign.slug;
  }
  return out;
}
