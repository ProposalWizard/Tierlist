"use client";
/**
 * lib/teamRoom/popups.ts — pop-ups on a computer, like WhatsApp (plan U12,
 * A6; Harry, 25 Oct 2026). While the admin is open in a tab, a new message
 * your 🔔 asks for shows as a system pop-up when the tab is hidden, or when
 * you are in another channel. Click it to open the post.
 *
 * With the tab closed, the push the server sends (the same buzz as a phone,
 * public/admin/team-sw.js) does it, if this computer has notifications
 * turned on. A computer that has them on gets the push, so this file then
 * stays quiet to avoid two pop-ups for one message.
 *
 * "Pop-ups on this computer" is per browser (localStorage); the browser asks
 * "Allow notifications?" once.
 */
import { useSyncExternalStore } from "react";
import { TEAM_ROOM, type TeamPerson } from "./config";
import { popupFor } from "./bells";
import { liveStatus } from "./status";
import { channelOf, dmKey } from "./channels";
import { parseMessage, quoteLine } from "./extras";
import { mentionsAll } from "./notify";
import { pushStateNow } from "./push";
import { setIncomingListener, teamRoomState, type Incoming } from "./store";

export type PopupState = "unsupported" | "blocked" | "off" | "on";
const KEY = "kib-tr-popups";
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function popupState(): PopupState {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  if (Notification.permission === "denied") return "blocked";
  let off = false;
  try { off = localStorage.getItem(KEY) === "off"; } catch { /* private window */ }
  return Notification.permission === "granted" && !off ? "on" : "off";
}
export function usePopupState(): PopupState {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, popupState, () => "off");
}
/** Ask "Allow notifications?" (only from a tap) and switch pop-ups on for this computer. */
export async function requestPopups(): Promise<PopupState> {
  if (popupState() === "unsupported") return "unsupported";
  try { localStorage.removeItem(KEY); } catch { /* private window */ }
  try { if (Notification.permission === "default") await Notification.requestPermission(); } catch { /* old Safari */ }
  emit();
  return popupState();
}
export function setPopupsOn(on: boolean) {
  try { if (on) localStorage.removeItem(KEY); else localStorage.setItem(KEY, "off"); } catch { /* private window */ }
  emit();
}

/** Which place the room has on screen ("general", "dm:Mikey"), so a pop-up never repeats what you are looking at. */
let viewing: string | null = null;
export const setViewing = (key: string | null) => { viewing = key; };

async function show(title: string, body: string, tag: string, url: string) {
  try {
    const reg = "serviceWorker" in navigator ? await navigator.serviceWorker.getRegistration(TEAM_ROOM.push.scope) : undefined;
    if (reg) { await reg.showNotification(title, { body, tag, icon: TEAM_ROOM.push.icon, data: { url, count: 1 } }); return; }
  } catch { /* fall back to a plain pop-up */ }
  try {
    const n = new Notification(title, { body, tag, icon: TEAM_ROOM.push.icon });
    n.onclick = () => { window.focus(); window.location.assign(url); n.close(); };
  } catch { /* not allowed here */ }
}

/** Decide and show. Called by the store for every live insert from someone else. */
function onIncoming(x: Incoming) {
  const st = teamRoomState();
  const me = st.me;
  if (!me || popupState() !== "on" || pushStateNow() === "on") return;
  const now = Date.now();
  const quiet = liveStatus(st.statuses[me], new Date(now)).quiet;
  if (x.kind === "message") {
    const m = x.row;
    const slug = channelOf(m.body);
    if (typeof document !== "undefined" && document.visibilityState === "visible" && viewing === slug) return;
    const p = parseMessage(m.body);
    const namesMe = p.mentions.includes(me) || mentionsAll(p.text) || p.cards.some((c) => c.point?.to.includes(me));
    if (!popupFor({ me, sender: m.person, slug, namesMe, prefs: st.bells, quiet, now })) return;
    const url = `${TEAM_ROOM.home}?tab=chat${slug !== "general" ? `&ch=${slug}` : ""}&m=${m.id}${p.replyTo ? `&t=${p.replyTo}` : ""}`;
    void show(`${m.person} in #${slug}`, quoteLine(m, 160), `kib-chat-${slug}`, url);
  } else if (x.kind === "dm") {
    const d = x.row;
    if (d.to_person !== me || quiet) return;
    if (typeof document !== "undefined" && document.visibilityState === "visible" && viewing === dmKey(d.from_person)) return;
    void show(`${d.from_person} sent you a private message`, d.body.slice(0, 160), `kib-dm-${d.from_person}`, `${TEAM_ROOM.home}?tab=chat&dm=${d.from_person}`);
  } else {
    const b = x.row;
    if (typeof document !== "undefined" && document.visibilityState === "visible" && viewing === b.channel) return;
    if (!popupFor({ me, sender: "bot" as TeamPerson, slug: b.channel, namesMe: !!b.everyone, prefs: st.bells, quiet, now })) return;
    const name = b.bot === "bug" ? "Bug bot" : `${b.bot} bot`;
    void show(`${name} in #${b.channel}`, b.title, `kib-bot-${b.channel}`, `${TEAM_ROOM.home}?tab=chat&ch=${b.channel}`);
  }
}

let wired = false;
/** The room turns pop-ups on for this tab once. */
export function wirePopups() {
  if (wired || typeof window === "undefined") return;
  wired = true;
  setIncomingListener(onIncoming);
}
