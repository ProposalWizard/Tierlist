/**
 * One set of saves per account (Harry, 28 Nov 2026: "my saves are cooked —
 * completely different on my phone and PC"). lib/star/onlineSlots.ts and the
 * save parts of lib/star/storage.ts:
 *   1. the Saves list merge (this device + online → cards; failures; tombstones)
 *   2. the "Start career" guard
 *   3. the server's overwrite check, and the route's step with a fake database
 *   4. the light online list read, with a fake database
 *   5. two different careers in one slot → a choice, never an overwrite;
 *      every choice keeps the other copy (spare slot or 30-day backup)
 *   6. a failed upload says so and retries
 */
import { makeInitialCareer } from "../../lib/star/careerFlow";
import type { CareerState, StarPlayer } from "../../lib/star/types";
import {
  mergeSaveCards, startCareerAllowed, slotOverwriteRefusal, checkSlotUpload, listOnlineSlots,
  onlineSlotFromRow, readSlotCheck, type OnlineSlot, type SlotListDb,
} from "../../lib/star/onlineSlots";

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

const CLUBS = ["Arsenal", "Chelsea", "Liverpool", "Man City", "Man Utd", "Spurs", "Newcastle", "Aston Villa", "Brighton", "West Ham"];
const player = (firstName: string, club: string): StarPlayer => ({
  firstName, lastName: "Player", age: 18, position: "CAM", club, nationality: "England",
} as StarPlayer);
const career = (name: string, club = "Arsenal"): CareerState => makeInitialCareer(player(name, club), CLUBS);
const asRaw = (c: unknown, extra: Record<string, unknown> = {}) => ({ ...(JSON.parse(JSON.stringify(c)) as Record<string, unknown>), ...extra });

// ── 1. The merge ────────────────────────────────────────────────────────────
{
  const local = [
    { slot: 1, empty: false, playerName: "Harry Player" },
    { slot: 2, empty: true },
    { slot: 3, empty: true },
  ];
  const online: OnlineSlot[] = [
    { slot: 1, live: true, updatedAt: 1, playerName: "Harry Player" },
    { slot: 2, live: true, updatedAt: 2, playerName: "Mikey Player", club: "Leeds United", signed: true, season: 3, device: "computer" },
    { slot: 3, live: false, updatedAt: 3 }, // a deleted slot (tombstone)
  ];
  const ok = mergeSaveCards(local, online, "ok");
  check(ok[0].kind === "here" && !ok[0].onlineDiffers, "slot on both, same career → a normal card");
  check(ok[1].kind === "online" && ok[1].online?.season === 3, "empty here, full online → 'On another device', never Empty");
  check(ok[2].kind === "empty", "empty here, tombstone online → Empty (Start career)");

  const failed = mergeSaveCards(local, null, "failed");
  check(failed[1].kind === "unknown" && failed[2].kind === "unknown", "the check failed → 'not checked', never a claimed Empty");
  check(failed[0].kind === "here", "the check failed → this device's career still shows");
  const checking = mergeSaveCards(local, null, "checking");
  check(checking[1].kind === "unknown", "still checking → not claimed Empty");
  const deviceOnly = mergeSaveCards(local, null, "device-only");
  check(deviceOnly[1].kind === "empty", "signed out / packed app → device-only Empty, as before");

  const differs = mergeSaveCards([{ slot: 1, empty: false, playerName: "Harry Player" }], [{ slot: 1, live: true, updatedAt: 1, playerName: "Leo Player" }], "ok");
  check(differs[0].kind === "here" && differs[0].onlineDiffers === true, "a different career online in my slot is flagged");
  const stale = mergeSaveCards(local, online, "failed");
  check(stale[1].kind === "unknown", "online answer is ignored when the check is marked failed");
}

// ── 2. The Start-career guard ───────────────────────────────────────────────
{
  check(startCareerAllowed({ kind: "empty" }).ok, "Start career on an empty-everywhere slot");
  const blocked = startCareerAllowed({ kind: "online" });
  check(!blocked.ok && /another device/.test(blocked.why ?? "") && /Open it, or choose an empty slot/.test(blocked.why ?? ""), "Start career on a slot full online → blocked with the warning");
  check(!startCareerAllowed({ kind: "here" }).ok, "Start career on a slot full here → blocked");
  check(startCareerAllowed({ kind: "unknown" }).ok, "not checked → allowed (the server still refuses an overwrite)");
}

// ── 3. The server's overwrite check ─────────────────────────────────────────
{
  const pc = asRaw(career("Mikey"), { season: 7, sync: { id: "r9-pc", rev: 9, deviceId: "d-pc", device: "computer", at: 1, lineage: ["r8-pc"] } });
  const phoneNew = asRaw(career("Harry"), { sync: { id: "r1-ph", rev: 1, deviceId: "d-ph", device: "phone", at: 2, lineage: [] } });
  check(readSlotCheck(null) === null && readSlotCheck("check") === "check" && readSlotCheck("replace") === "replace" && readSlotCheck("x") === null, "header values read");

  check(slotOverwriteRefusal(pc, phoneNew, null) === null, "old client (no header) → stored as before");
  const r = slotOverwriteRefusal(pc, phoneNew, "check");
  check(r?.error === "slot-taken" && /Mikey Player/.test(r.message), "a new career over a different one it never saw → refused, naming it");
  check(slotOverwriteRefusal(pc, phoneNew, "replace") === null, "the player's deliberate replace → stored");
  check(slotOverwriteRefusal(null, phoneNew, "check") === null, "empty slot → stored");
  check(slotOverwriteRefusal({ tombstone: true, last: pc }, phoneNew, "check") === null, "deleted slot (tombstone) → stored");

  const pcNext = asRaw(pc, { week: 5, sync: { id: "r10-pc", rev: 10, deviceId: "d-pc", device: "computer", at: 3, lineage: ["r8-pc", "r9-pc"] } });
  check(slotOverwriteRefusal(pc, pcNext, "check") === null, "the same career moving on → stored");
  const sawIt = asRaw(career("Harry"), { sync: { id: "r10-x", rev: 10, deviceId: "d-ph", device: "phone", at: 4, lineage: ["r9-pc"] } });
  check(slotOverwriteRefusal(pc, sawIt, "check") === null, "a device that SAW the online copy (a settled choice) → stored");
  const movedSame = asRaw(pc, { sync: { id: "r1-h", rev: 1, deviceId: "d-home", device: "phone", at: 5, lineage: [] } });
  check(slotOverwriteRefusal(pc, movedSame, "check") === null, "same career, same progress, from a new browser → stored");
  const sameNameBehind = asRaw(career("Mikey"), { sync: { id: "r1-z", rev: 1, deviceId: "d-z", device: "phone", at: 6, lineage: [] } });
  const behindRefusal = slotOverwriteRefusal(pc, sameNameBehind, "check");
  check(behindRefusal?.error === "slot-taken" && /further-on copy/.test(behindRefusal.message), "same name, further behind, never saw it → refused");
  const legacyPrev = asRaw(career("Mikey"), { season: 4 });
  check(slotOverwriteRefusal(legacyPrev, phoneNew, "check")?.error === "slot-taken", "an online career from before stamps → still protected");
  check(slotOverwriteRefusal(pc, { not: "a save" }, "check") === null, "a body that is not a career is left to the save guard");

  // The route's step, with the database read faked.
  let reads = 0;
  const row = { career: pc, updated_at: "2026-11-27T10:00:00Z" };
  const a = await checkSlotUpload(async () => { reads++; return row; }, phoneNew, "check");
  check(a.refusal?.error === "slot-taken" && a.prev === row && reads === 1, "route: reads the slot once and refuses");
  const b = await checkSlotUpload(async () => { reads++; return row; }, phoneNew, null);
  check(b.refusal === null && b.prev === undefined && reads === 1, "route: old client → no read, no refusal");
  const c = await checkSlotUpload(async () => { throw new Error("db down"); }, phoneNew, "check");
  check(c.refusal === null && c.prev === undefined, "route: a failed read never stops a save");
  const d = await checkSlotUpload(async () => null, phoneNew, "check");
  check(d.refusal === null && d.prev === null, "route: empty slot → stored");
}

// ── 4. The light online list, fake database ─────────────────────────────────
{
  const asked: string[] = [];
  const rows = [
    { slot: 2, updated_at: "2026-11-26T10:00:00Z", tomb: null, first: "Mikey", last: "Player", club: "Leeds United", league0: "Leeds United", season: "7", week: "12", retired: "false", version: "2", device: "computer", deviceId: "d-pc" },
    { slot: 1, updated_at: "2026-11-27T10:00:00Z", tomb: null, first: "Harry", last: "Player", club: "Arsenal", league0: "Arsenal", season: "3", week: "4", retired: null, version: "2", device: "phone", deviceId: "d-ph" },
    { slot: 3, updated_at: "2026-11-25T10:00:00Z", tomb: "true", first: null, last: null, club: null, league0: null, season: null, week: null, retired: null, version: null, device: null, deviceId: null },
  ];
  const db: SlotListDb = {
    from: (t: string) => ({
      select: (cols: string) => {
        asked.push(`${t}:${cols}`);
        return { eq: async (_c: string, uid: string) => ({ data: uid === "u1" ? rows : [], error: null }) };
      },
    }),
  };
  const list = await listOnlineSlots(db, "u1");
  check(list.map((s) => s.slot).join() === "1,2,3", "slots come back in order");
  check(list[1].live && list[1].season === 7 && list[1].club === "Leeds United" && list[1].signed === true && list[1].device === "computer", "headline: season, club, signed, device");
  check(!list[2].live, "tombstone → not live");
  check(!asked[0].includes("career,") && !/\bcareer\s*$/.test(asked[0]) && asked[0].includes("career->player->>firstName"), "never selects the whole save");
  check(onlineSlotFromRow({ slot: 1, updated_at: "x", first: "A", version: "2", club: "", league0: null })?.signed === false, "a trial (no club) reads as not signed");

  let tries = 0;
  const noSlotDb: SlotListDb = {
    from: () => ({ select: (cols: string) => ({ eq: async () => { tries++; return cols.startsWith("slot") ? { data: null, error: { message: "column slot does not exist" } } : { data: [rows[1]], error: null }; } }) }),
  };
  const one = await listOnlineSlots(noSlotDb, "u1");
  check(tries === 2 && one.length === 1 && one[0].slot === 1, "no slot column yet → the one row is slot 1");
  let threw = false;
  try { await listOnlineSlots({ from: () => ({ select: () => ({ eq: async () => ({ data: null, error: { message: "down" } }) }) }) }, "u1"); } catch { threw = true; }
  check(threw, "a database error throws (route says 'couldn't check'), never an empty list");
}

// ── 5 & 6. storage.ts with a fake server ────────────────────────────────────
function freshStore() {
  const store = new Map<string, string>();
  return {
    store,
    api: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => { store.set(k, String(v)); },
      removeItem: (k: string) => { store.delete(k); },
      clear: () => store.clear(),
      get length() { return store.size; },
      key: (i: number) => [...store.keys()][i] ?? null,
    },
  };
}
const phone = freshStore();
const pcDisk = freshStore();
const on = (d: ReturnType<typeof freshStore>) => { (globalThis as { localStorage?: unknown }).localStorage = d.api; };
on(phone);

// A fake server that runs the REAL overwrite check.
const cloud = new Map<number, { career: unknown; updatedAt: string }>();
let mode: "up" | "offline" | "500" = "up";
let clock = Date.now();
let posts = 0;
(globalThis as { fetch?: unknown }).fetch = async (url: string, init?: { method?: string; body?: string; headers?: Record<string, string> }) => {
  if (mode === "offline") throw new TypeError("Failed to fetch");
  const u = new URL(url, "http://x");
  const method = init?.method ?? "GET";
  if (u.pathname === "/api/star/career/slots") {
    return new Response(JSON.stringify({ mode: "online", slots: [...cloud.entries()].map(([slot, r]) => onlineSlotFromRow({ slot, updated_at: r.updatedAt, first: (r.career as { player?: { firstName?: string } }).player?.firstName, version: "2" })) }));
  }
  const slot = Number(u.searchParams.get("slot") ?? 1);
  if (method === "POST") {
    posts++;
    if (mode === "500") return new Response(JSON.stringify({ ok: false }), { status: 500 });
    const body = JSON.parse(init!.body!);
    const refusal = slotOverwriteRefusal(cloud.get(slot)?.career ?? null, body, readSlotCheck(init?.headers?.["x-star-slot-check"]));
    if (refusal) return new Response(JSON.stringify({ ok: false, ...refusal }), { status: 409 });
    clock += 1000;
    cloud.set(slot, { career: body, updatedAt: new Date(clock).toISOString() });
    return new Response(JSON.stringify({ ok: true }));
  }
  return new Response(JSON.stringify(cloud.get(slot) ?? null));
};

const storage = await import("../../lib/star/storage");
const ACC = "user-harry";
const S = (n: number) => storage.slotScope(ACC, n);

{
  // PC: careers in slots 1 and 2, uploaded.
  on(pcDisk);
  const pc1 = career("Harry"), pc2 = { ...career("Mikey", "Chelsea"), season: 7 };
  storage.saveCareer(pc1, S(1)); await storage.saveCareerToCloud(pc1, 1, { scope: S(1) });
  storage.saveCareer(pc2, S(2)); await storage.saveCareerToCloud(pc2, 2, { scope: S(2) });
  check(cloud.size === 2, "pc uploads both slots");

  // Phone: Saves list asks the server → slot 2 shows as on another device.
  on(phone);
  const ans = await storage.fetchOnlineSlots();
  check(ans.check === "ok", "phone: online list answered");
  const cards = mergeSaveCards(storage.listSaveSlots(ACC), ans.check === "ok" ? ans.slots : null, ans.check);
  check(cards[1].kind === "online" && cards[2].kind === "empty", "phone: Save 2 is 'On another device', Save 3 empty everywhere");

  // Phone, old way: a new career in slot 2 locally → upload REFUSED, PC's career untouched.
  const before = JSON.stringify(cloud.get(2));
  const phone2 = career("Leo", "Spurs");
  storage.saveCareer(phone2, S(2));
  await storage.saveCareerToCloud(phone2, 2, { scope: S(2) });
  check(JSON.stringify(cloud.get(2)) === before, "phone's new career in Save 2 never replaces the PC's online");
  check(storage.getSaveFailure()?.reason === "slot-taken", "…and the player is told");
  const postsBefore = posts;
  await storage.saveCareerToCloud(phone2, 2, { scope: S(2) });
  check(posts === postsBefore, "a refused slot waits before sending the whole save again");

  // Opening Save 2 on the phone: two DIFFERENT careers → a choice, never a timestamp pick.
  const open = await storage.reconcileCareerLoad(ACC, 2);
  check(open.kind === "clash", `two different careers in a slot → the choice (got ${open.kind})`);
  if (open.kind === "clash") {
    check(open.clash.spareSlot === 3, "Save 3 is free everywhere → Keep both is offered");
    // Keep both: phone's stays in 2, PC's copy goes to 3 (here and online).
    const kept = storage.resolveSaveClash(ACC, open.clash, "local", "spare");
    check(kept.player.firstName === "Leo", "keep both: this device's career stays in Save 2");
    // The spare slot's upload is fire-and-forget: wait for it to land.
    for (let i = 0; i < 500 && !cloud.get(3); i++) await new Promise((r) => setTimeout(r, 10));
    await new Promise((r) => setTimeout(r, 20));
    check((cloud.get(3)?.career as CareerState | undefined)?.player.firstName === "Mikey", "keep both: the PC's career is now in Save 3 online");
    check(storage.loadCareer(S(3))?.player.firstName === "Mikey", "keep both: …and on this device");
    // The phone's career may now go up into Save 2: it SAW the PC's copy.
    await storage.saveCareerToCloud(kept, 2, { scope: S(2) });
    check((cloud.get(2)?.career as CareerState).player.firstName === "Leo", "after the choice the upload is accepted");
    check(storage.getSaveFailure()?.reason !== "slot-taken", "…and the warning clears");
  }

  // Keep only one, no free slot: the other goes to a 30-day backup, not deleted.
  on(pcDisk);
  const pcOpen = await storage.reconcileCareerLoad(ACC, 2); // PC has Mikey locally, Leo online
  check(pcOpen.kind === "clash", "pc: its old Save 2 differs from the account's → the choice");
  if (pcOpen.kind === "clash") {
    check(pcOpen.clash.spareSlot === null, "pc: no free slot (1, 2, 3 all used online)");
    const kept = storage.resolveSaveClash(ACC, pcOpen.clash, "cloud", "backup");
    check(kept.player.firstName === "Leo", "pc: kept the account's copy");
    const backups = storage.listCareerBackups(ACC);
    check(backups.length === 1 && backups[0].playerName === "Mikey Player" && backups[0].slot === 2, "pc: its own copy is in the backup list");
    check(storage.careerFromBackup(backups[0])?.season === 7, "pc: the backup opens back up as the full career");
  }
  // Backups younger than 30 days are never dropped, even when space is short.
  const old = storage.listCareerBackups(ACC);
  storage.backupCareer(ACC, 1, career("Again"), "test", Date.now() + 1000);
  check(storage.listCareerBackups(ACC).length === old.length + 1, "a new backup adds, never replaces");

  // 6. A failed upload says so, and retries.
  on(phone);
  mode = "offline";
  const p1 = { ...career("Leo", "Spurs"), week: 9 };
  storage.saveCareer(p1, S(1 + 0));
  // slot 1 on phone: Harry is online; make the phone's slot 1 the same Harry career first.
  mode = "up";
  const phoneSlot1 = await storage.reconcileCareerLoad(ACC, 1);
  void phoneSlot1;
  const harry = storage.loadCareer(S(1))!;
  mode = "offline";
  await storage.saveCareerToCloud({ ...harry, week: harry.week + 1 }, 1, { scope: S(1) });
  check(storage.getSaveFailure()?.reason === "cloud" && /Couldn't save online — will retry/.test(storage.getSaveFailure()!.message), "no signal → 'Couldn't save online — will retry'");
  check(storage.pendingUploadRetry(S(1)), "…and a retry is waiting");
  storage.saveCareer(harry, S(1));
  check(storage.getSaveFailure()?.reason === "cloud", "saving on this device does not hide the online failure");
  mode = "500";
  await storage.saveCareerToCloud({ ...harry, week: harry.week + 2 }, 1, { scope: S(1) });
  check(storage.getSaveFailure()?.reason === "cloud", "a server error → the same message");
  mode = "up";
  await storage.saveCareerToCloud({ ...harry, week: harry.week + 3 }, 1, { scope: S(1) });
  check(storage.getSaveFailure() === null, "the next upload that lands clears it");
  check(!storage.pendingUploadRetry(S(1)), "…and no retry is left waiting");
  // Signed-out saves never claim an online failure.
  mode = "offline";
  await storage.saveCareerToCloud(harry, 1, { scope: storage.ANON_SCOPE });
  check(storage.getSaveFailure() === null, "signed out: no 'couldn't save online' message");
  mode = "up";
}

if (problems.length) {
  console.error("FAIL");
  for (const p of problems) console.error("  ✗ " + p);
  process.exit(1);
}
console.log("PASS — online slots: other devices' saves show, Start career is guarded, the server refuses to replace another career, two careers ask, the loser is backed up, failed uploads say so and retry");
