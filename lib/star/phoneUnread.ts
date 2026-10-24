import { agentHello } from "./story";
import { appInstalled } from "./unlocks";
import type { CareerState } from "@/lib/star/types";
import { nextFixtureFor } from "./competitions";
import { CLUB_SHORT_NAMES } from "@/lib/star/clubs";
import { formatMoney } from "@/lib/star/money";
import { hasFreshMedia, unreadCount } from "@/lib/star/media/feed";
import { brandsOf } from "@/lib/star/sponsorDeals";
import { RECORDS } from "@/lib/star/records";

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

export interface Msg {
  from: string; icon: string; text: string; tone: [string, string];
  /** Tap it: the scout report (inside the phone) or the sponsor's offer (Sponsors). */
  open?: "scout" | "sponsors";
  /** Kept read across small wording changes (a sponsor offer's id). */
  key?: string;
}

/** A team-mate to send the record chase: one of the squad, the same all season. */
function teamMate(career: CareerState): string {
  const me = `${career.player.firstName} ${career.player.lastName}`;
  const mates = (career.squad ?? []).filter((p) => p.name !== me);
  if (!mates.length) return "Team-mate";
  const m = mates[(career.season * 7 + 3) % mates.length];
  return m.shortName || m.name;
}

/** The nearest record you are about to break, in a team-mate's words, or null.
 *  `hall` is your own Hall of Fame chase line (hallRecords.ts hallChaseLine). */
export function recordChaseText(career: CareerState, hall?: string | null): string | null {
  let best: { text: string; ratio: number } | null = null;
  for (const r of RECORDS) {
    const p = r.progress(career);
    const gap = r.value - p;
    if (gap <= 0 || p < r.value * 0.5 || gap > Math.max(2, Math.round(r.value * 0.1))) continue;
    const ratio = gap / r.value;
    const unit = gap === 1 ? r.unit.replace(/s$/, "") : r.unit;
    if (!best || ratio < best.ratio) best = { ratio, text: `You're only ${gap} ${unit} away from ${r.holder}'s record: ${r.label.replace("Premier League", "PL")}. Go get it!` };
  }
  if (best) return best.text;
  return hall ? `${hall}. Go get it!` : null;
}

/** Messages, built from real career facts (Mikey, 22 Oct 2026: the gaffer's scout
 *  report before each match, sponsor offers, a team-mate on a record you can break). */
export function buildMessages(career: CareerState, hallChase?: string | null): Msg[] {
  const next = nextFixtureFor(career);
  const msgs: Msg[] = [];
  // The story order: your agent texts first, on the cracked phone (story.ts).
  const hello = agentHello(career);
  if (hello) msgs.push({ from: "Agent", icon: "💼", text: hello, tone: ["#fbbf24", "#b45309"], key: "agent-hello" });
  if (career.managerNews) msgs.push({ from: "The club", icon: "🏟️", text: career.managerNews, tone: ["#60a5fa", "#1d4ed8"] });
  if (next) msgs.push({ from: career.manager?.name ? `Gaffer (${career.manager.name})` : "Gaffer", icon: "🧢", text: `Here's the scout report for ${short(next.opponent)}. Read it before we play.`, tone: ["#34d399", "#047857"], open: "scout" });
  for (const o of brandsOf(career).offers) {
    msgs.push({
      from: o.brand, icon: "🤝",
      text: o.kind === "milestone" ? `${o.brand} want a one-off deal with you. Take a look.` : `${o.brand} want you on a ${o.seasons}-season deal at ★${formatMoney(o.weekly)} a week.`,
      tone: ["#2dd4bf", "#0f766e"], open: "sponsors", key: `offer|${o.id}`,
    });
  }
  const chase = recordChaseText(career, hallChase);
  if (chase) msgs.push({ from: teamMate(career), icon: "🔥", text: chase, tone: ["#fb923c", "#c2410c"] });
  msgs.push({ from: "Agent", icon: "💼", text: `${career.contract.seasonsRemaining} season${career.contract.seasonsRemaining === 1 ? "" : "s"} left on your deal at ★${formatMoney(career.contract.wage)} a week.`, tone: ["#fbbf24", "#b45309"] });
  if (career.energy < 60) msgs.push({ from: "Physio", icon: "🩺", text: `Energy's at ${Math.round(career.energy)}%. Rest up or drink a can.`, tone: ["#f87171", "#b91c1c"] });
  msgs.push({ from: "Mum", icon: "❤️", text: "Proud of you. Eat something green.", tone: ["#f472b6", "#be185d"] });
  return msgs;
}
export const msgKey = (m: Msg) => m.key ?? `${m.from}|${m.text}`;

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

/** Everything unread on the phone: messages (sponsor offers are messages now) and social. */
export function phoneUnreadCount(career: CareerState, hallChase?: string | null): number {
  const seen = readSeenMsgs();
  // The cracked phone has no Social: its posts are not counted until you
  // have an app that can show them (Mikey's playtest, 24 Oct 2026: 5 on the
  // Phone button, 4 in Messages).
  return buildMessages(career, hallChase).filter((m) => !seen.has(msgKey(m))).length
    + (appInstalled(career, "social") ? socialUnread(career, readSocialSeen()) : 0);
}
