"use client";
/**
 * lib/teamRoom/push.ts — phone notifications on THIS device (who gets what:
 * notify.ts; sending: /api/admin/team/notify).
 *
 * "Turn on phone notifications" asks the phone's permission (only from the
 * tap), starts the small worker that shows them (public/admin/team-sw.js,
 * scoped to /admin, never the game or the public site), subscribes, and
 * keeps the device in your own sign-in account's details (no table, no SQL;
 * up to TEAM_ROOM.push.maxDevices per person).
 *
 * On iPhone it only works in the app added to the Home Screen (iOS 16.4+),
 * so outside it the button is replaced by one line saying how.
 *
 * Also the two calls the Team room makes after saving: ringAfter (a message
 * or a job given) and ringNewJobs (pushed jobs). Both are fire-and-forget:
 * a buzz that fails never stops a message being sent.
 */
import { useSyncExternalStore } from "react";
import { createClient } from "@/lib/supabase/client";
import { offlineDevPlayEnabled } from "@/lib/star/devMode";
import { TEAM_ROOM } from "./config";
import { cleanDevices, deviceFrom, mayRing, withDevice, withoutDevices } from "./notify";
import type { TeamJob } from "./jobs";

export type PushState =
  | "checking" | "unsupported" | "iphone" | "notReady" | "signedOut" | "blocked" | "off" | "on" | "working";
export interface PushView { state: PushState; error: string | null; note: string | null }

const P = TEAM_ROOM.push;
/** "account id|address" that turned this device on (a phone shared between two accounts never moves silently). */
const OWNER_KEY = "kib-team-push-owner";
const ASKED_JOBS_KEY = "kib-team-push-jobs";

/**
 * A dev build only (never the live site): ?teampush=off|on|iphone|blocked|notReady|unsupported
 * shows that state, to look at. Read when the page first loads (pages tidy their address after).
 */
const FORCE = typeof window !== "undefined" && offlineDevPlayEnabled() ? /[?&]teampush=(\w+)/.exec(window.location.search)?.[1] : undefined;

let view: PushView = { state: "checking", error: null, note: null };
const listeners = new Set<() => void>();
const set = (patch: Partial<PushView>) => { view = { ...view, ...patch }; listeners.forEach((l) => l()); };
let checked = false;

const isIPhone = () => typeof navigator !== "undefined"
  && (/iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));
const installed = () => typeof window !== "undefined"
  && (window.matchMedia?.("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true);
const supported = () => typeof window !== "undefined" && window.isSecureContext
  && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

function keyBytes(b64url: string): Uint8Array {
  const pad = "=".repeat((4 - (b64url.length % 4)) % 4);
  const raw = atob((b64url + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}
const read = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k: string, v: string | null) => { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* private mode */ } };

let sb: ReturnType<typeof createClient> | null = null;
const client = () => (sb ??= createClient());

async function registration(): Promise<ServiceWorkerRegistration> {
  const had = await navigator.serviceWorker.getRegistration(P.scope);
  const reg = had ?? await navigator.serviceWorker.register(P.worker, { scope: P.scope });
  if (reg.active) return reg;
  // Wait for the worker to be running before subscribing.
  await new Promise<void>((done) => {
    const w = reg.installing ?? reg.waiting;
    if (!w) { done(); return; }
    w.addEventListener("statechange", () => { if (w.state === "activated") done(); });
    setTimeout(done, 8000);
  });
  return reg;
}

/** Your account's devices, read fresh. */
async function myDevices() {
  const { data } = await client().auth.getUser();
  if (!data.user) return null;
  return { id: data.user.id, list: cleanDevices((data.user.user_metadata as Record<string, unknown> | undefined)?.[P.devicesKey]) };
}
async function saveDevices(list: ReturnType<typeof cleanDevices>) {
  const { error } = await client().auth.updateUser({ data: { [P.devicesKey]: list } });
  if (error) throw new Error(error.message);
}

/** Work out this device's state (the button reads it). Safe to call often. */
export async function checkPush(): Promise<void> {
  if (typeof window === "undefined") return;
  if (FORCE) { set({ state: FORCE as PushState, error: null }); return; }
  if (isIPhone() && !installed()) { set({ state: "iphone", error: null }); return; }
  if (!supported()) { set({ state: "unsupported", error: null }); return; }
  try {
    const r = await fetch(P.api, { cache: "no-store" });
    const j = (await r.json().catch(() => ({}))) as { ready?: boolean };
    if (!r.ok || !j.ready) { set({ state: "notReady", error: null }); return; }
  } catch { set({ state: "notReady", error: null }); return; }
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) { set({ state: "signedOut" }); return; }
  const mine = await myDevices().catch(() => null);
  if (!mine) { set({ state: "signedOut", error: null }); return; }
  if (Notification.permission === "denied") { set({ state: "blocked", error: null }); return; }
  const reg = await navigator.serviceWorker.getRegistration(P.scope).catch(() => undefined);
  const sub = await reg?.pushManager.getSubscription().catch(() => null);
  const dev = sub ? deviceFrom(sub.toJSON(), Date.now()) : null;
  if (dev && Notification.permission === "granted") {
    if (mine.list.some((d) => d.endpoint === dev.endpoint)) { set({ state: "on", error: null }); return; }
    // The browser swapped its address (they do, now and then): keep the new one, for the
    // same account only. The same old address missing means the site dropped it as gone: Off.
    const [owner, last] = (read(OWNER_KEY) ?? "").split("|");
    if (owner === mine.id && last !== dev.endpoint) {
      try {
        await saveDevices(withDevice(mine.list, dev));
        write(OWNER_KEY, `${mine.id}|${dev.endpoint}`);
        set({ state: "on", error: null });
        return;
      } catch { /* fall through to Off */ }
    }
  }
  set({ state: "off", error: null });
  // Get the worker ready now, so the tap only has to ask and subscribe.
  registration().catch(() => { /* tried again on the tap */ });
}

/** The tap on "Turn on phone notifications". Asks permission first, inside the tap (iPhone needs that). */
export async function turnOnPush(): Promise<void> {
  if (!supported()) return;
  const asking = Notification.requestPermission();
  set({ state: "working", error: null, note: null });
  try {
    const perm = await asking;
    if (perm !== "granted") { set({ state: perm === "denied" ? "blocked" : "off" }); return; }
    const mine = await myDevices();
    if (!mine) { set({ state: "signedOut" }); return; }
    const reg = await registration();
    const old = await reg.pushManager.getSubscription();
    // An old subscription no longer on the account may be dead: start clean.
    if (old && !mine.list.some((d) => d.endpoint === old.endpoint)) await old.unsubscribe().catch(() => false);
    const sub = (old && mine.list.some((d) => d.endpoint === old.endpoint)) ? old
      : await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(P.publicKey) as BufferSource });
    const dev = deviceFrom(sub.toJSON(), Date.now());
    if (!dev) throw new Error("The phone gave an address the site can't use.");
    await saveDevices(withDevice(mine.list, dev));
    write(OWNER_KEY, `${mine.id}|${dev.endpoint}`);
    set({ state: "on", note: "On. A test buzz comes in a few seconds." });
    // A brand-new subscription can be refused for a few seconds (seen with Google's push service).
    setTimeout(() => { sendTest(); }, 6000);
  } catch (e) {
    set({ state: "off", error: `Couldn't turn them on: ${(e as Error).message || "unknown problem"}` });
  }
}

export async function turnOffPush(): Promise<void> {
  set({ state: "working", error: null, note: null });
  try {
    const reg = await navigator.serviceWorker.getRegistration(P.scope);
    const sub = await reg?.pushManager.getSubscription();
    const mine = await myDevices();
    if (sub && mine) await saveDevices(withoutDevices(mine.list, [sub.endpoint]));
    await sub?.unsubscribe();
    write(OWNER_KEY, null);
    set({ state: "off", note: "Off on this device." });
  } catch (e) {
    set({ state: "on", error: `Couldn't turn them off: ${(e as Error).message || "unknown problem"}` });
  }
}

/** A test buzz to your own devices. */
export async function sendTest(): Promise<void> {
  try {
    const r = await fetch(P.api, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ test: true }) });
    const j = (await r.json().catch(() => ({}))) as { sent?: number; error?: string };
    if (!r.ok) set({ error: j.error ?? `The site answered ${r.status}.` });
    else if (!j.sent) set({ note: "No device took it yet. Try Send a test in a minute; if it still fails, Turn off, then on again." });
    else set({ note: `Test sent to ${j.sent} device${j.sent === 1 ? "" : "s"}.` });
  } catch { set({ error: "Couldn't reach the site to send a test." }); }
}

/** This device's push state right now (the computer pop-ups stay quiet when push already covers it). */
export const pushStateNow = (): PushState => view.state;

export function usePush(): PushView {
  return useSyncExternalStore(
    (l) => { listeners.add(l); if (!checked) { checked = true; checkPush(); } return () => listeners.delete(l); },
    () => view,
    () => view,
  );
}

/* ── After saving: ask the site to ring ───────────────────────────────── */

function post(body: unknown) {
  return fetch(P.api, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), keepalive: true });
}

/** A message or a job was just saved: ring whoever it is for (the site decides, from the saved row). */
export function ringAfter(table: "team_messages" | "team_tasks" | "team_notes" | "team_dms", row: { id?: unknown; body?: unknown; owner?: unknown; made_by?: unknown }) {
  const id = Number(row.id);
  if (!Number.isSafeInteger(id) || id <= 0) return;
  // Every channel message may ring now: someone's 🔔 may say "every new message" (bells.ts, 25 Oct 2026).
  if (table === "team_notes" && !mayRing(String(row.body ?? ""))) return;
  if (table === "team_tasks" && row.owner === row.made_by) return;
  post({ table, id }).catch(() => { /* a missed buzz never blocks the chat */ });
}

let jobsOff = false;
const inFlight = new Set<string>();
/**
 * Pushed jobs just read from GitHub: ask the site to ring the new ones (added
 * in the last day, not asked about from this browser before). The site rings
 * each person once per job, however many phones ask.
 */
export function ringNewJobs(jobs: TeamJob[]) {
  if (jobsOff || typeof window === "undefined") return;
  let asked: string[] = [];
  try { asked = JSON.parse(read(ASKED_JOBS_KEY) ?? "[]"); } catch { asked = []; }
  const now = Date.now();
  const ids = jobs.filter((j) => {
    const age = now - (Date.parse(j.added) || 0);
    return age >= -5 * 60_000 && age <= P.jobFreshMs && !asked.includes(j.id) && !inFlight.has(j.id);
  }).map((j) => j.id);
  if (!ids.length) return;
  ids.forEach((id) => inFlight.add(id));
  post({ jobs: ids }).then(async (r) => {
    const j = (await r.json().catch(() => ({}))) as { ok?: boolean; off?: boolean };
    if (j.off || r.status === 401 || r.status === 403) { jobsOff = true; return; }
    if (j.ok) write(ASKED_JOBS_KEY, JSON.stringify([...asked, ...ids].slice(-300)));
  }).catch(() => { /* asked again next minute */ }).finally(() => ids.forEach((id) => inFlight.delete(id)));
}

const ASKED_PATCHES_KEY = "kib-team-push-patches";
let patchesAsked = false;
/**
 * New patch notes in this deploy (Harry, 21 Oct 2026: tell everyone when a
 * patch note goes onto the site). The Inbox bell calls this with the newest
 * version in the archive it was built with; each browser asks the site once
 * per new version. The site decides who is rung (everyone but the author,
 * once per version, however many phones ask: lib/teamRoom/inbox.ts).
 */
export function ringNewPatches(newestVersion: string | undefined) {
  if (patchesAsked || !newestVersion || typeof window === "undefined" || offlineDevPlayEnabled()) return;
  if (read(ASKED_PATCHES_KEY) === newestVersion) return;
  patchesAsked = true;
  post({ patches: true }).then(async (r) => {
    const j = (await r.json().catch(() => ({}))) as { ok?: boolean; off?: boolean };
    // Rung, notifications off (no key yet), or not on the team: ask again at the next new version.
    if (j.ok || j.off || r.status === 401 || r.status === 403) write(ASKED_PATCHES_KEY, newestVersion);
    else patchesAsked = false;
  }).catch(() => { patchesAsked = false; /* asked again on the next page */ });
}
