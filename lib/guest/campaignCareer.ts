/**
 * lib/guest/campaignCareer.ts — the ready-made career an ad's landing page
 * drops a player into.
 *
 * The landing page (app/campaign/[campaign]) leaves a note in this browser
 * ("start the league-two-striker career"), then opens /star-dev. When the game
 * finds no career on this account it takes the note and starts the career
 * straight away, with the campaign's player, instead of the set-up screen.
 * A player who already has a career keeps it: the note is only read when the
 * game would otherwise show the set-up screen.
 *
 * The player is built exactly like the set-up screen builds one
 * (components/star/ProfileSetup.tsx `submit`): age 16, no club (the trial
 * decides it), the default look.
 */

import type { StarPlayer } from "@/lib/star/types";
import { STAR_FIFA_YEAR } from "@/lib/star/edition";
import {
  DEFAULT_SKIN_TONE, DEFAULT_FOOT, DEFAULT_HAIR_STYLE, DEFAULT_HAIR_COLOUR, clampSquadNumber,
} from "@/lib/star/playerIdentity";
import { campaignFor, type Campaign } from "@/lib/campaigns";

const PENDING_KEY = "kib-campaign-start-v1";
/** A note older than this is ignored (the player wandered off and came back days later). */
const PENDING_MAX_AGE_MS = 6 * 60 * 60 * 1000;

/** Same age the set-up screen starts every career at. */
const STARTING_AGE = 16;

export function campaignPlayer(c: Campaign): StarPlayer {
  return {
    firstName: c.player.firstName,
    lastName: c.player.lastName,
    age: STARTING_AGE,
    skinTone: DEFAULT_SKIN_TONE,
    club: "",
    clubBadge: null,
    position: c.player.position,
    nationality: c.player.nationality,
    startYear: STAR_FIFA_YEAR,
    preferredNumber: clampSquadNumber(c.player.preferredNumber),
    preferredFoot: DEFAULT_FOOT,
    hairStyle: DEFAULT_HAIR_STYLE,
    hairColour: DEFAULT_HAIR_COLOUR,
  };
}

/** The landing page's note: "start this campaign's career when the game opens". */
export function setPendingCampaign(slug: string): void {
  try { localStorage.setItem(PENDING_KEY, JSON.stringify({ slug, at: Date.now() })); } catch { /* private window: the set-up screen shows instead */ }
}

/** Reads AND removes the note, so it can only start one career. */
export function takePendingCampaign(): Campaign | null {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    localStorage.removeItem(PENDING_KEY);
    const v = JSON.parse(raw) as { slug?: unknown; at?: unknown };
    if (typeof v.slug !== "string" || typeof v.at !== "number") return null;
    if (Date.now() - v.at > PENDING_MAX_AGE_MS) return null;
    return campaignFor(v.slug);
  } catch {
    return null;
  }
}

/** Whether a note is waiting, without taking it (the title screen is skipped for it). */
export function hasPendingCampaign(): boolean {
  try { return !!localStorage.getItem(PENDING_KEY); } catch { return false; }
}
