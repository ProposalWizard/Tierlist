import { makeInitialCareer } from "../../lib/star/careerFlow";
import type { StarPlayer } from "../../lib/star/types";

/**
 * The red dot on the Phone button (Harry, 1 Oct 2026, P89: "the red dot should
 * only go when you've read them"): it shows while something on the phone is
 * unread and clears once you have opened it. lib/star/phoneUnread.ts is the one
 * place the dot and the phone's own app badges both read.
 */
const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { store.set(k, String(v)); },
  removeItem: (k: string) => { store.delete(k); },
  clear: () => store.clear(),
};
let fired = 0;
(globalThis as { window?: unknown }).window = { dispatchEvent: () => { fired++; return true; } };

const { phoneUnreadCount, buildMessages, msgKey, MSGS_SEEN, writeLS } = await import("../../lib/star/phoneUnread");

const player = { firstName: "Test", lastName: "Player", age: 18, position: "CAM", club: "Chelsea", nationality: "England" } as StarPlayer;
const CLUBS = ["Arsenal", "Chelsea", "Liverpool", "Man City", "Man Utd", "Spurs", "Newcastle", "Aston Villa", "Brighton", "West Ham"];
const career = makeInitialCareer(player, CLUBS);

// A fresh phone: every message is unread, so the dot is on.
const msgs = buildMessages(career);
check(msgs.length > 0, "a career always has messages");
check(phoneUnreadCount(career) >= msgs.length, `a fresh phone has its ${msgs.length} messages unread (${phoneUnreadCount(career)})`);

// Reading them all clears the dot (no posts, no sponsor offers on a new save).
const before = fired;
writeLS(MSGS_SEEN, JSON.stringify(msgs.map(msgKey)));
check(fired === before + 1, "marking something read tells the page, so the dot updates at once");
check(phoneUnreadCount(career) === 0, `once read, nothing is unread (${phoneUnreadCount(career)})`);

// A NEW message (the physio, when energy drops) brings the dot back, only for itself.
const tired = { ...career, energy: 20 };
const n = phoneUnreadCount(tired);
check(n === 1, `one new message → exactly one unread (${n})`);

if (problems.length) { console.error("FAIL"); for (const p of problems) console.error("  ✗ " + p); process.exit(1); }
console.log("PASS — the Phone dot shows while something is unread and clears when read");
