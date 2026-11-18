/**
 * What you have already read on the phone (the red numbers on Social and
 * Messages). The website keeps these in the browser's storage
 * (lib/star/phoneUnread.ts readLS/writeLS); the phone keeps them in its own
 * small store, apart from the career save.
 */
import { createMMKV } from "react-native-mmkv";
import { MSGS_SEEN, SOCIAL_SEEN } from "@/lib/star/phoneUnread";

const store = createMMKV({ id: "knowitball-phone-seen" });

export function readSeenMsgs(): Set<string> {
  try { return new Set(JSON.parse(store.getString(MSGS_SEEN) ?? "[]") as string[]); } catch { return new Set(); }
}
export function writeSeenMsgs(all: Set<string>) { store.set(MSGS_SEEN, JSON.stringify(Array.from(all).slice(-40))); }
/** -1 = never opened (only what the last match stirred up counts). */
export function readSocialSeen(): number {
  const n = Number(store.getString(SOCIAL_SEEN));
  return Number.isFinite(n) && n > 0 ? n : -1;
}
export function writeSocialSeen(at: number) { store.set(SOCIAL_SEEN, String(at)); }
