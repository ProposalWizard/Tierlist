import type { CareerState } from "@/lib/star/types";
import { CLUB_SHORT_NAMES } from "@/lib/star/clubs";
import { formatMoney } from "@/lib/star/money";
import { hasFreshMedia, unreadCount } from "@/lib/star/media/feed";
import { brandsOf } from "@/lib/star/sponsorDeals";

/**
 * WHAT IS UNREAD ON THE PHONE (Harry, 1 Oct 2026, P89: "the red dot should
 * only go when you've read them" — it shows while something is unread and
 * clears once you have opened it). One place for both the phone's own app
 * badges (PhoneHome.tsx) and the dot on the bottom bar's Phone button
 * (DashboardShell.tsx), so they can never disagree. What has been read is
 * kept per phone, in this browser (a convenience, not game state).
 */
const short = (club: string) => CLUB_SHORT_NAMES[club] ?? club.replace(/\s+(FC|AFC)$/i, "");

export const SOCIAL_SEEN = "star-phone-social-seen";
export const MSGS_SEEN = "star-phone-msgs-seen";
/** Fired on window whenever something is marked read, so the dot can update. */
export const PHONE_SEEN_EVENT = "star-phone-seen";
export function readLS(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
export function writeLS(key: string, v: string) {
  try { localStorage.setItem(key, v); } catch { /* private window */ }
  try { window.dispatchEvent(new Event(PHONE_SEEN_EVENT)); } catch { /* no window */ }
}

export interface Msg { from: string; icon: string; text: string; tone: [string, string] }
/** Messages — a sketch of what the phone could tell you. Built from real
 *  career facts; the wording is placeholder. */
export function buildMessages(career: CareerState): Msg[] {
  const next = career.fixtures.filter((f) => !f.played).sort((a, b) => a.week - b.week)[0];
  const msgs: Msg[] = [];
  if (career.managerNews) msgs.push({ from: "The club", icon: "🏟️", text: career.managerNews, tone: ["#60a5fa", "#1d4ed8"] });
  if (next) msgs.push({ from: career.manager?.name ? `Gaffer (${career.manager.name})` : "Gaffer", icon: "🧢", text: `${short(next.opponent)} next. Be ready.`, tone: ["#34d399", "#047857"] });
  msgs.push({ from: "Agent", icon: "💼", text: `${career.contract.seasonsRemaining} season${career.contract.seasonsRemaining === 1 ? "" : "s"} left on your deal at ★${formatMoney(career.contract.wage)} a week.`, tone: ["#fbbf24", "#b45309"] });
  if (career.energy < 60) msgs.push({ from: "Physio", icon: "🩺", text: `Energy's at ${Math.round(career.energy)}%. Rest up or drink a can.`, tone: ["#f87171", "#b91c1c"] });
  msgs.push({ from: "Mum", icon: "❤️", text: "Proud of you. Eat something green.", tone: ["#f472b6", "#be185d"] });
  return msgs;
}
export const msgKey = (m: Msg) => `${m.from}|${m.text}`;

/** The social app's unread: what the last match stirred up, or posts since you last opened it. */
export function socialUnread(career: CareerState, socialSeen: number | null): number {
  return socialSeen === null ? 0 : socialSeen === -1 ? (hasFreshMedia(career) ? 1 : 0) : unreadCount(career, socialSeen);
}
export function readSeenMsgs(): Set<string> {
  try { return new Set(JSON.parse(readLS(MSGS_SEEN) ?? "[]") as string[]); } catch { return new Set(); }
}
export function readSocialSeen(): number {
  const s = Number(readLS(SOCIAL_SEEN));
  return Number.isFinite(s) && s > 0 ? s : -1;
}

/** Everything unread on the phone: messages, social, sponsor offers waiting. */
export function phoneUnreadCount(career: CareerState): number {
  const seen = readSeenMsgs();
  return buildMessages(career).filter((m) => !seen.has(msgKey(m))).length
    + socialUnread(career, readSocialSeen())
    + brandsOf(career).offers.length;
}
