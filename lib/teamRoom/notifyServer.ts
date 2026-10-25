/**
 * lib/teamRoom/notifyServer.ts — the server half of the Team room's phone
 * notifications (who and what: notify.ts). Server only: it holds the
 * private key (TEAM_PUSH_PRIVATE_KEY, set once in Vercel) and the service
 * role. Never import it from a page.
 *
 * Each person's devices are in their own sign-in account's details
 * (user_metadata.teamPush, written by their phone: push.ts). Which pushed
 * jobs they have had is in app_metadata.teamPushJobs, which only the server
 * can write. Found through team_members (who is Harry, Mikey, Leo).
 */
import webpush from "web-push";
import type { SupabaseClient } from "@supabase/supabase-js";
import { TEAM_ROOM, isTeamPerson, type TeamPerson } from "./config";
import { cleanDevices, deliver, type Delivery, type PushDevice, type PushPayload } from "./notify";
import { BELLS_KEY, cleanBells, type BellPrefs } from "./bells";
import { cleanStatus, liveStatus } from "./status";

/** The private key is set (the button says "not switched on yet" until it is). */
export const pushReady = () => !!process.env.TEAM_PUSH_PRIVATE_KEY?.trim() && !!TEAM_ROOM.push.publicKey;

type Admin = SupabaseClient;

/** Harry / Mikey / Leo → their account id (team_members). */
export async function teamAccounts(sb: Admin): Promise<Partial<Record<TeamPerson, string>>> {
  const { data, error } = await sb.from("team_members").select("user_id, person");
  if (error) throw new Error(error.message);
  const out: Partial<Record<TeamPerson, string>> = {};
  for (const r of (data ?? []) as { user_id: string; person: string }[]) if (isTeamPerson(r.person)) out[r.person] = r.user_id;
  return out;
}

/** An account's details, read fresh. Null if it can't be read. */
async function account(sb: Admin, id: string) {
  const { data, error } = await sb.auth.admin.getUserById(id);
  return error ? null : data.user;
}

export async function devicesOf(sb: Admin, id: string): Promise<PushDevice[] | null> {
  const u = await account(sb, id);
  return u ? cleanDevices((u.user_metadata as Record<string, unknown> | undefined)?.[TEAM_ROOM.push.devicesKey]) : null;
}

/** Pushed jobs this account has already been rung for. */
export async function rungJobsOf(sb: Admin, id: string): Promise<string[]> {
  const u = await account(sb, id);
  const v = (u?.app_metadata as Record<string, unknown> | undefined)?.[TEAM_ROOM.push.jobsKey];
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

export async function saveRungJobs(sb: Admin, id: string, ids: string[]) {
  // Supabase merges this into app_metadata: the other keys stay.
  await sb.auth.admin.updateUserById(id, { app_metadata: { [TEAM_ROOM.push.jobsKey]: ids } });
}

/** Patch-note versions this account has already been rung for (lib/teamRoom/inbox.ts). */
export async function rungPatchesOf(sb: Admin, id: string): Promise<string[]> {
  const u = await account(sb, id);
  const v = (u?.app_metadata as Record<string, unknown> | undefined)?.[TEAM_ROOM.push.patchesKey];
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

export async function saveRungPatches(sb: Admin, id: string, versions: string[]) {
  await sb.auth.admin.updateUserById(id, { app_metadata: { [TEAM_ROOM.push.patchesKey]: versions } });
}

/** Each person's 🔔 choices (user_metadata.teamBells, written by their own browser). */
export async function bellsOf(sb: Admin, accounts: Partial<Record<TeamPerson, string>>): Promise<Partial<Record<TeamPerson, BellPrefs>>> {
  const out: Partial<Record<TeamPerson, BellPrefs>> = {};
  await Promise.all((Object.keys(accounts) as TeamPerson[]).map(async (p) => {
    const u = await account(sb, accounts[p]!);
    out[p] = cleanBells((u?.user_metadata as Record<string, unknown> | undefined)?.[BELLS_KEY]);
  }));
  return out;
}

/** Who has buzzes paused right now (do not disturb, or a schedule that pauses them; team_status). Missing table = nobody. */
export async function quietPeople(sb: Admin, now = new Date()): Promise<TeamPerson[]> {
  const { data, error } = await sb.from("team_status").select("*");
  if (error) return [];
  return ((data ?? []) as Record<string, unknown>[]).filter((r) => isTeamPerson(r.person))
    .filter((r) => liveStatus(cleanStatus(r, r.person as TeamPerson), now).quiet).map((r) => r.person as TeamPerson);
}

/** Send one push to one device with the site's key. Throws (with statusCode) when refused. */
function sendOne(d: PushDevice, body: string) {
  return webpush.sendNotification(
    { endpoint: d.endpoint, keys: { p256dh: d.p256dh, auth: d.auth } },
    body,
    {
      vapidDetails: { subject: TEAM_ROOM.push.subject, publicKey: TEAM_ROOM.push.publicKey, privateKey: process.env.TEAM_PUSH_PRIVATE_KEY!.trim() },
      TTL: 24 * 3600,
      urgency: "high",
      timeout: 10_000,
      // A test machine behind a proxy (never set on Vercel).
      ...(process.env.HTTPS_PROXY && !process.env.VERCEL ? { proxy: process.env.HTTPS_PROXY } : {}),
    },
  );
}

/** Ring these people with these words. Devices that have gone are dropped from their account. */
export async function ring(sb: Admin, accounts: Partial<Record<TeamPerson, string>>, rings: { person: TeamPerson; payload: PushPayload }[]): Promise<Delivery> {
  return deliver({
    rings: rings.filter((r) => accounts[r.person]),
    devicesOf: (p) => devicesOf(sb, accounts[p]!),
    saveDevices: async (p, list) => {
      // Supabase merges this into user_metadata: the other keys (name, picture) stay.
      await sb.auth.admin.updateUserById(accounts[p]!, { user_metadata: { [TEAM_ROOM.push.devicesKey]: list } });
    },
    send: sendOne,
  });
}
