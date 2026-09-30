import { makeInitialCareer } from "../../lib/star/careerFlow";
import type { CareerState, StarPlayer } from "../../lib/star/types";
import {
  decideLoad, descendsFrom, emptySyncRecord, nextStamp, recordAfterConfirm, recordAfterSend,
  progressFingerprint, pickSpareSlot, deviceKindFromUA, sanitizeSyncRecord, readStamp,
  LINEAGE_CAP, RECENT_OTHER_DEVICE_MS,
  type SaveStamp, type SyncRecord, type SyncedVersion, type LoadInput,
} from "../../lib/star/saveClash";

/**
 * TWO DIFFERENT SAVES — lib/star/saveClash.ts, and the storage.ts plumbing
 * around it (reconcileCareerLoad, saveCareerToCloud's stamp, resolveSaveClash).
 *
 * The bug this exists for: play on the phone with no signal (only the phone's
 * copy moves), then on the PC (the cloud gets the PC's copy). The next time
 * the phone opens, the old rule — "whichever was written later" — silently
 * threw the phone's session away. Part 3 below plays exactly that on two
 * simulated devices sharing one fake cloud.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

const NOW = 1_800_000_000_000;
const ver = (id: string, progress: string, lineage: string[] = []): SyncedVersion =>
  ({ id, rev: Number(/^r(\d+)/.exec(id)?.[1] ?? 1), progress, lineage });
const stamp = (id: string, lineage: string[], deviceId = "d-pc", at = NOW - 3600_000): SaveStamp =>
  ({ id, rev: Number(/^r(\d+)/.exec(id)?.[1] ?? 1), deviceId, device: "computer", at, lineage });
const rec = (base: SyncedVersion | null, pending: SyncedVersion[] = []): SyncRecord => ({ base, pending });
const input = (p: Partial<LoadInput>): LoadInput => ({
  local: { at: NOW - 7200_000, progress: "P-local" },
  cloud: null,
  record: emptySyncRecord(),
  deviceId: "d-phone",
  now: NOW,
  ...p,
});

// ── Part 1: the rule, case by case ───────────────────────────────────────────
{
  // Nothing anywhere.
  check(decideLoad(input({ local: null })).use === "none", "no local, no cloud → nothing to load");
  // Never synced to a cloud at all (signed out, or the cloud is empty).
  check(decideLoad(input({})).use === "local", "no cloud copy → this device's copy");
  // A fresh device.
  const fresh = decideLoad(input({ local: null, cloud: { at: NOW, progress: "P-c", stamp: stamp("r3-c", ["r2-b"]) } }));
  check(fresh.use === "cloud" && fresh.record.base?.id === "r3-c", "no local copy → the cloud's, and remember it as the base");

  // OLD SAVES — no stamp on the cloud, or this device never synced under the
  // new scheme: exactly the old "later write wins", and never a clash.
  const oldCloudNewer = decideLoad(input({ cloud: { at: NOW - 60_000, progress: "P-c", stamp: null } }));
  check(oldCloudNewer.use === "cloud" && oldCloudNewer.why === "legacy-cloud-newer", "old cloud save written later → cloud (as before)");
  const oldLocalNewer = decideLoad(input({ local: { at: NOW, progress: "P-l" }, cloud: { at: NOW - 60_000, progress: "P-c", stamp: null } }));
  check(oldLocalNewer.use === "local" && oldLocalNewer.why === "legacy-local-newer", "old cloud save written earlier → local (as before)");
  const neverSynced = decideLoad(input({ cloud: { at: NOW - 60_000, progress: "P-c", stamp: stamp("r9-x", ["r8-y"]) } }));
  check(neverSynced.use === "cloud" && neverSynced.why === "legacy-cloud-newer", "stamped cloud, but this device has no base yet → the old rule, not a clash");
  const baseButOldCloud = decideLoad(input({
    record: rec(ver("r2-b", "P-b")), cloud: { at: NOW - 60_000, progress: "P-c", stamp: null },
  }));
  check(baseButOldCloud.why === "legacy-cloud-newer", "a base, but the cloud was written by an old copy of the game → the old rule");

  // IN SYNC / LOCAL AHEAD: the cloud is still the version we last synced.
  const base = ver("r5-b", "P-base", ["r3-a", "r4-a"]);
  const inSync = decideLoad(input({ local: { at: NOW, progress: "P-base" }, record: rec(base), cloud: { at: NOW - 1, progress: "P-base", stamp: stamp("r5-b", ["r3-a", "r4-a"]) } }));
  check(inSync.use === "local" && inSync.why === "in-sync", "cloud is our base and nothing changed → in sync");
  // Local ahead even when the cloud copy was WRITTEN later — the old rule
  // would have taken the cloud here (its timestamp is newer).
  const ahead = decideLoad(input({ local: { at: NOW - 3_600_000, progress: "P-more" }, record: rec(base), cloud: { at: NOW, progress: "P-base", stamp: stamp("r5-b", ["r3-a", "r4-a"]) } }));
  check(ahead.use === "local" && ahead.why === "local-ahead", "cloud is our base and we played on → keep local, however the clocks read");

  // CLOUD AHEAD: someone moved on from our base and we did nothing.
  const cloudAhead = decideLoad(input({ local: { at: NOW, progress: "P-base" }, record: rec(base), cloud: { at: NOW - 1, progress: "P-pc", stamp: stamp("r7-p", ["r4-a", "r5-b", "r6-p"]) } }));
  check(cloudAhead.use === "cloud" && cloudAhead.why === "cloud-ahead" && cloudAhead.record.base?.id === "r7-p", "cloud built on our base, local unchanged → cloud, and it becomes the base");

  // DIVERGED: both moved on from the same base — the phone/PC case.
  const diverged = decideLoad(input({ local: { at: NOW - 999_999, progress: "P-phone" }, record: rec(base), cloud: { at: NOW, progress: "P-pc", stamp: stamp("r7-p", ["r5-b", "r6-p"]) } }));
  check(diverged.use === "clash" && diverged.why === "both-moved-on", `both moved on from the base → clash (got ${diverged.use}/${diverged.why})`);
  check(diverged.warn === null, "a clash never also shows the other-device warning");

  // DIVERGED: the cloud was written by a device that never saw our base.
  const overwrote = decideLoad(input({ local: { at: NOW, progress: "P-base" }, record: rec(base), cloud: { at: NOW, progress: "P-pc", stamp: stamp("r6-q", ["r3-a", "r4-a"]) } }));
  check(overwrote.use === "clash" && overwrote.why === "cloud-overwrote", "cloud doesn't descend from our base → our base's progress only exists here → clash");

  // Same progress on both sides → no question to ask.
  const same = decideLoad(input({ local: { at: NOW, progress: "P-same" }, record: rec(base), cloud: { at: NOW, progress: "P-same", stamp: stamp("r7-p", ["r5-b"]) } }));
  check(same.use === "cloud" && same.why === "same-progress", "diverged ids but identical progress → take the cloud, don't ask");

  // The cloud is an older copy of ours.
  const older = decideLoad(input({ local: { at: NOW, progress: "P-base" }, record: rec(base), cloud: { at: NOW, progress: "P-a", stamp: stamp("r4-a", ["r3-a"]) } }));
  check(older.use === "local" && older.why === "cloud-is-older-copy", "cloud is one of our own ancestors → keep local");

  // PENDING: our last upload landed but its "ok" never came back (the page
  // closed mid-send). It must read as ours, not somebody else's.
  const sent = ver("r6-mine", "P-sent", ["r3-a", "r4-a", "r5-b"]);
  const landed = decideLoad(input({ local: { at: NOW, progress: "P-sent" }, record: rec(base, [sent]), cloud: { at: NOW, progress: "P-sent", stamp: stamp("r6-mine", sent.lineage, "d-phone") } }));
  check(landed.use === "local" && landed.why === "in-sync", `our own unconfirmed upload in the cloud → in sync (got ${landed.why})`);
  check(landed.record.base?.id === "r6-mine" && landed.record.pending.length === 0, "…and it is promoted to the base");
  // An upload that NEVER landed (offline): the cloud still holds the base.
  const neverLanded = decideLoad(input({ local: { at: NOW, progress: "P-sent" }, record: rec(base, [sent]), cloud: { at: NOW, progress: "P-base", stamp: stamp("r5-b", base.lineage) } }));
  check(neverLanded.use === "local" && neverLanded.why === "local-ahead", "an offline upload that never landed → local is ahead, keep it");
}

// ── The other-device warning ─────────────────────────────────────────────────
{
  const base = ver("r5-b", "P-base");
  const recent = (deviceId: string, ageMs: number) => decideLoad(input({
    local: { at: NOW - 10 * 3600_000, progress: "P-base" }, record: rec(base),
    cloud: { at: NOW - ageMs, progress: "P-pc", stamp: { ...stamp("r6-p", ["r5-b"], deviceId), device: "phone" } },
  }));
  const w = recent("d-other", 3 * 60_000);
  check(w.warn?.device === "phone" && w.warn.minutesAgo === 3, `another device saved 3 min ago → warn (got ${JSON.stringify(w.warn)})`);
  check(recent("d-phone", 3 * 60_000).warn === null, "this same device saved 3 min ago → no warning");
  check(recent("d-other", RECENT_OTHER_DEVICE_MS + 60_000).warn === null, "another device, 11 minutes ago → no warning");
  const noStamp = decideLoad(input({ cloud: { at: NOW - 60_000, progress: "P", stamp: null } }));
  check(noStamp.warn === null, "an unstamped (old) cloud save never warns");
}

// ── Stamps, lineage and the confirm step ─────────────────────────────────────
{
  let r = rec(ver("r5-b", "P-b", ["r4-a"]));
  const a = nextStamp(r, { deviceId: "d1", device: "phone", at: NOW, random: "aaa", progress: "P1" });
  check(a.stamp.rev === 6 && a.stamp.id === "r6-aaa", "a new upload is one past the base");
  check(a.stamp.lineage.join() === "r4-a,r5-b", "…and lists what it was built on, base last");
  r = recordAfterSend(r, a.sent);
  const b = nextStamp(r, { deviceId: "d1", device: "phone", at: NOW, random: "bbb", progress: "P2" });
  check(b.stamp.rev === 7 && b.stamp.lineage.includes("r6-aaa"), "a second upload before the first is confirmed builds on it too");
  r = recordAfterSend(r, b.sent);
  r = recordAfterConfirm(r, b.sent);
  check(r.base?.id === "r7-bbb" && r.pending.length === 0, "confirming the newest clears everything older from pending");
  r = recordAfterConfirm(r, a.sent);
  check(r.base?.id === "r7-bbb", "an older upload confirming late never moves the base backwards");

  const long = Array.from({ length: LINEAGE_CAP }, (_, i) => `r${200 + i}-x`);
  check(descendsFrom(stamp("r300-z", long), ver("r50-old", "P")), "base older than a full (truncated) lineage → can't tell, trust the cloud as before");
  check(!descendsFrom(stamp("r9-z", ["r7-x", "r8-x"]), ver("r5-old", "P")), "short lineage without the base → does not descend");

  check(sanitizeSyncRecord("junk").base === null && sanitizeSyncRecord({ base: { id: 1 } }).base === null, "garbage on disk reads as an empty record");
  check(readStamp(undefined) === null && readStamp({ id: "r1-a", rev: 1, deviceId: "d" })?.lineage.length === 0, "stamps are read defensively");
}

// ── Spare slot ───────────────────────────────────────────────────────────────
{
  const slots = (a: [boolean, boolean], b: [boolean, boolean], c: [boolean, boolean]) =>
    [a, b, c].map(([localEmpty, cloudEmpty], i) => ({ slot: i + 1, localEmpty, cloudEmpty }));
  check(pickSpareSlot(1, slots([false, false], [true, true], [true, true])) === 2, "first free slot other than the one on screen");
  check(pickSpareSlot(1, slots([false, false], [true, false], [true, true])) === 3, "a slot with another device's save in the cloud is NOT free");
  check(pickSpareSlot(1, slots([false, false], [false, false], [false, false])) === null, "every slot taken → no spare (the prompt must say so)");
  check(pickSpareSlot(2, slots([true, true], [true, true], [false, false])) === 1, "the slot on screen is never its own spare");
}

// ── Devices ──────────────────────────────────────────────────────────────────
{
  check(deviceKindFromUA("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148") === "phone", "iPhone → phone");
  check(deviceKindFromUA("Mozilla/5.0 (Linux; Android 14; Pixel 8) Mobile Safari/537.36") === "phone", "Android phone → phone");
  check(deviceKindFromUA("Mozilla/5.0 (Linux; Android 13; SM-X700) Safari/537.36") === "tablet", "Android without Mobile → tablet");
  check(deviceKindFromUA("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/128") === "computer", "Windows → computer");
}

// ── Part 2: the progress fingerprint ─────────────────────────────────────────
const player = (firstName: string, club: string): StarPlayer =>
  ({ firstName, lastName: "Player", age: 18, position: "CAM", club, nationality: "England" } as StarPlayer);
const CLUBS = ["Arsenal", "Chelsea", "Liverpool", "Man City", "Man United", "Tottenham Hotspur",
  "Newcastle United", "Aston Villa", "Brighton & Hove Albion", "West Ham United"];
{
  const c = makeInitialCareer(player("Fp", "Arsenal"), CLUBS);
  const fp = progressFingerprint(c);
  check(progressFingerprint({ ...c }) === fp, "same career → same fingerprint");
  const reordered = Object.fromEntries(Object.entries(c).reverse()) as unknown as CareerState;
  check(progressFingerprint(reordered) === fp, "key order doesn't matter");
  check(progressFingerprint({ ...c, squad: [], league: [], leagueSquads: [], externalSquads: [] }) === fp,
    "squads and the division's strengths are refetched on load — not progress");
  check(progressFingerprint({ ...c, money: c.money + 1 }) !== fp, "one coin more is progress");
  check(progressFingerprint({ ...c, week: c.week + 1 }) !== fp, "a week on is progress");
}

// ── Part 3: two devices, one cloud — the reported bug, end to end ────────────
function freshStore() {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, String(v)); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => store.clear(),
  };
}
const phoneDisk = freshStore();
const pcDisk = freshStore();
const on = (disk: ReturnType<typeof freshStore>) => { (globalThis as { localStorage?: unknown }).localStorage = disk; };
on(phoneDisk);

// A fake /api/star/career for slot 1..3. `offline` makes every request fail
// the way a phone with no signal does (fetch rejects).
const cloud = new Map<number, { career: unknown; updatedAt: string }>();
let offline = false;
let clock = 0;
(globalThis as { fetch?: unknown }).fetch = async (url: string, init?: { method?: string; body?: string }) => {
  if (offline) throw new TypeError("Failed to fetch");
  const slot = Number(new URL(url, "http://x").searchParams.get("slot") ?? 1);
  const method = init?.method ?? "GET";
  if (method === "POST") {
    clock = Math.max(Date.now(), clock + 1);
    cloud.set(slot, { career: JSON.parse(init!.body!), updatedAt: new Date(clock).toISOString() });
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }
  if (method === "DELETE") { cloud.delete(slot); return new Response(JSON.stringify({ ok: true })); }
  return new Response(JSON.stringify(cloud.get(slot) ?? null), { status: 200 });
};

const storage = await import("../../lib/star/storage");
const ACCOUNT = "user-harry";
const S1 = storage.slotScope(ACCOUNT, 1);

{
  // Day 1, phone, online: start a career; it reaches the cloud.
  on(phoneDisk);
  const start = makeInitialCareer(player("Harry", "Arsenal"), CLUBS);
  storage.saveCareer(start, S1);
  await storage.saveCareerToCloud(start, 1, { scope: S1 });
  check(storage.loadSyncRecord(S1).base !== null, "phone: a confirmed upload becomes the base");

  // PC opens it: takes the cloud copy, no prompt.
  on(pcDisk);
  const pcOpen = await storage.reconcileCareerLoad(ACCOUNT, 1);
  check(pcOpen.kind === "career" && pcOpen.career?.player.firstName === "Harry", "pc: fresh device takes the cloud copy");
  check(storage.getOtherDeviceWarning()?.minutesAgo === 0, "pc: the cloud copy was saved moments ago by ANOTHER device → the warning is up");

  // Phone, NO SIGNAL: plays on. Only the phone's copy moves.
  on(phoneDisk);
  offline = true;
  const phonePlayed = { ...start, week: start.week + 2, money: start.money + 900 };
  storage.saveCareer(phonePlayed, S1);
  await storage.saveCareerToCloud(phonePlayed, 1, { scope: S1 });
  offline = false;
  check(storage.loadSyncRecord(S1).pending.length === 1, "phone: the failed upload is remembered as pending, not as synced");
  // Signal comes back (page.tsx uploads when this says so): the offline
  // progress is unsynced; a copy the cloud already confirmed is not.
  check(storage.hasUnsyncedProgress(S1, phonePlayed), "phone: offline progress reads as unsynced, so it uploads when signal returns");
  check(!storage.hasUnsyncedProgress(S1, start), "phone: the copy the cloud confirmed reads as synced, so nothing is re-sent");

  // PC, online: plays on too; the cloud gets the PC's copy.
  on(pcDisk);
  const pcBase = (pcOpen as { career: CareerState }).career;
  const pcPlayed = { ...pcBase, week: pcBase.week + 3, money: pcBase.money + 50 };
  storage.saveCareer(pcPlayed, S1);
  await storage.saveCareerToCloud(pcPlayed, 1, { scope: S1 });

  // Phone opens again. The OLD rule took the cloud here (its timestamp is
  // later) and the offline session vanished. Now: ask.
  on(phoneDisk);
  const legacyWouldPick = cloud.get(1)!.updatedAt > new Date(storage.loadCareerSavedAt(S1)).toISOString() ? "cloud" : "local";
  check(legacyWouldPick === "cloud", "sanity: the old later-write-wins rule would have thrown the phone's session away");
  const phoneOpen = await storage.reconcileCareerLoad(ACCOUNT, 1);
  check(phoneOpen.kind === "clash", `phone: both copies moved on → the prompt (got ${phoneOpen.kind})`);
  if (phoneOpen.kind === "clash") {
    const clash = phoneOpen.clash;
    check(clash.local.career.money === phonePlayed.money && clash.cloud.career.money === pcPlayed.money, "the prompt carries both real copies");
    check(clash.spareSlot === 2, `a free slot is offered for the other one (got ${clash.spareSlot})`);

    // Keep the phone's copy. The PC's goes to Save 2 — nothing lost.
    const kept = storage.resolveSaveClash(ACCOUNT, clash, "local");
    check(kept.money === phonePlayed.money, "keeping 'This device' returns the phone's copy");
    check(storage.loadCareer(storage.slotScope(ACCOUNT, 2))?.money === pcPlayed.money, "the PC's copy now lives in Save 2");
    await new Promise((r) => setTimeout(r, 0));
    check((cloud.get(2)?.career as CareerState | undefined)?.money === pcPlayed.money, "…and in the cloud's Save 2");
    // The page then saves and uploads the kept copy as usual.
    await storage.saveCareerToCloud(kept, 1, { scope: S1 });
    const again = await storage.reconcileCareerLoad(ACCOUNT, 1);
    check(again.kind === "career" && again.why === "in-sync", `phone reopens after choosing → no prompt (got ${again.kind === "career" ? again.why : "clash"})`);
  }

  // PC opens: the phone's choice has moved on from the PC's own last upload,
  // and the PC did nothing since → it simply takes it. And it was saved
  // moments ago by another device → the warning.
  on(pcDisk);
  const pcAgain = await storage.reconcileCareerLoad(ACCOUNT, 1);
  check(pcAgain.kind === "career" && pcAgain.why === "cloud-ahead" && pcAgain.career?.money === phonePlayed.money,
    `pc: takes the kept copy without asking (got ${pcAgain.kind === "career" ? pcAgain.why : "clash"})`);
  check(storage.getOtherDeviceWarning() !== null, "pc: the phone saved moments ago → warned");
  // The phone reopening its own fresh upload is not "another device".
  on(phoneDisk);
  await storage.reconcileCareerLoad(ACCOUNT, 1);
  check(storage.getOtherDeviceWarning() === null, "phone: its own recent save never warns");
}

// Local ahead / cloud ahead, end to end.
{
  cloud.clear();
  const disk1 = freshStore(), disk2 = freshStore();
  const S = storage.slotScope("user-b", 1);
  on(disk1);
  const c = makeInitialCareer(player("Mikey", "Chelsea"), CLUBS);
  storage.saveCareer(c, S);
  await storage.saveCareerToCloud(c, 1, { scope: S });
  on(disk2);
  await storage.reconcileCareerLoad("user-b", 1);
  // Device 1 plays offline, device 2 does nothing: device 1 is simply ahead.
  on(disk1);
  offline = true;
  const moved = { ...c, week: c.week + 1 };
  storage.saveCareer(moved, S);
  await storage.saveCareerToCloud(moved, 1, { scope: S });
  offline = false;
  const r1 = await storage.reconcileCareerLoad("user-b", 1);
  check(r1.kind === "career" && r1.why === "local-ahead" && r1.career?.week === moved.week, "offline progress with an untouched cloud → keep local, no prompt");
  await storage.saveCareerToCloud(moved, 1, { scope: S });
  // Device 2 did nothing → just takes it.
  on(disk2);
  const r2 = await storage.reconcileCareerLoad("user-b", 1);
  check(r2.kind === "career" && r2.why === "cloud-ahead" && r2.career?.week === moved.week, "untouched device → takes the newer cloud, no prompt");
  // …and loading it and saving it again (no play) must not read as progress.
  const loaded = (r2 as { career: CareerState }).career;
  storage.saveCareer(loaded, S);
  const r3 = await storage.reconcileCareerLoad("user-b", 1);
  check(r3.kind === "career" && r3.why === "in-sync", `a load-and-save round trip is not progress (got ${r3.kind === "career" ? r3.why : "clash"})`);
}

// Every slot full: the spare is null and the prompt must say so.
{
  cloud.clear();
  const d1 = freshStore(), d2 = freshStore();
  const A = "user-c";
  on(d1);
  for (const slot of [2, 3]) storage.saveCareer(makeInitialCareer(player(`Other${slot}`, "Liverpool"), CLUBS), storage.slotScope(A, slot));
  const c = makeInitialCareer(player("Full", "Arsenal"), CLUBS);
  storage.saveCareer(c, storage.slotScope(A, 1));
  await storage.saveCareerToCloud(c, 1, { scope: storage.slotScope(A, 1) });
  on(d2);
  await storage.reconcileCareerLoad(A, 1);
  offline = false;
  on(d1);
  offline = true;
  storage.saveCareer({ ...c, week: c.week + 1 }, storage.slotScope(A, 1));
  offline = false;
  on(d2);
  const pc = (await storage.reconcileCareerLoad(A, 1)) as { career: CareerState };
  await storage.saveCareerToCloud({ ...pc.career, money: pc.career.money + 5 }, 1, { scope: storage.slotScope(A, 1) });
  on(d1);
  const r = await storage.reconcileCareerLoad(A, 1);
  check(r.kind === "clash" && r.clash.spareSlot === null, `all slots full → clash with no spare (got ${r.kind}${r.kind === "clash" ? `/${r.clash.spareSlot}` : ""})`);
  if (r.kind === "clash") {
    // Decide later: this device's copy, and nothing is uploaded over the cloud's.
    const before = JSON.stringify(cloud.get(1));
    const local = storage.deferSaveClash(A, r.clash);
    await storage.saveCareerToCloud(local, 1, { scope: storage.slotScope(A, 1) });
    check(JSON.stringify(cloud.get(1)) === before, "'Decide later' uploads nothing over the other copy");
    const again = await storage.reconcileCareerLoad(A, 1);
    check(again.kind === "clash", "…and the next open asks again");
  }
}

if (problems.length) {
  console.error("FAIL");
  for (const p of problems) console.error("  ✗ " + p);
  process.exit(1);
}
console.log("PASS — save clash: diverged copies ask, older/newer copies don't, old saves keep the old rule, the other copy goes to a spare slot");
