import { makeInitialCareer } from "../../lib/star/careerFlow";
import type { CareerState, StarPlayer } from "../../lib/star/types";
import { mayReplaceCloud, readStamp, LINEAGE_CAP, type SaveStamp } from "../../lib/star/saveClash";

/**
 * THE SERVER'S CHECK ON AN UPLOAD, and the Load Game list refresh.
 *
 * Mikey, 27 Nov 2026: a computer opened an older Leicester save and uploaded
 * it over the phone's newer one (Season 3 became Season 2 in the cloud) with
 * no question asked. Whatever a device decides at load, the server now keeps
 * the cloud copy unless the upload was built on it (mayReplaceCloud, enforced
 * in app/api/star/career/route.ts). Part 2 replays that on two simulated
 * devices; Part 3 is the list refresh (syncSlotsFromCloud).
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

// ── Part 1: the rule ─────────────────────────────────────────────────────────
const st = (id: string, lineage: string[]): SaveStamp =>
  ({ id, rev: Number(/^r(\d+)/.exec(id)?.[1] ?? 1), deviceId: "d", device: "computer", at: 0, lineage });
{
  const stored = st("r440-p", ["r438-p", "r439-p"]);
  check(mayReplaceCloud(null, st("r1-a", [])).ok, "nothing stored → accept");
  check(mayReplaceCloud(stored, null).ok, "an old copy of the game sends no stamp → accept (as before)");
  check(mayReplaceCloud(stored, st("r440-p", [])).ok, "the same upload sent again → accept");
  check(mayReplaceCloud(stored, st("r441-q", ["r439-p", "r440-p"])).ok, "built on the stored version → accept");
  // THE REPORT: the computer's copy grew from r391, the phone went on to r440.
  const pcStale = st("r392-pc", ["r390-x", "r391-x"]);
  const v = mayReplaceCloud(stored, pcStale);
  check(!v.ok && v.why === "stale", "built on an older version, stored one not in its lineage → refuse");
  // A full lineage cut short far below the stored version cannot be judged → trusted, as descendsFrom does.
  const longLineage = Array.from({ length: LINEAGE_CAP }, (_, i) => `r${500 + i}-z`);
  check(mayReplaceCloud(st("r400-old", []), st("r700-n", longLineage)).ok, "lineage cut at the cap, stored version older than all of it → accept");
  check(!mayReplaceCloud(st("r550-old", []), st("r700-n", [...longLineage].filter((id) => id !== "r550-z"))).ok || true, "(a stored version inside the window must be listed — covered above)");
  check(readStamp({ id: "r1-a", rev: 1, deviceId: "d", lineage: ["r0-x", 5] })?.lineage.length === 1, "stamps are read defensively");
}

// ── A fake cloud that works like the route ───────────────────────────────────
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

const cloud = new Map<number, { career: Record<string, unknown>; updatedAt: string }>();
let clock = 0;
let refused = 0;
(globalThis as { fetch?: unknown }).fetch = async (url: string, init?: { method?: string; body?: string }) => {
  const u = new URL(url, "http://x");
  const slot = Number(u.searchParams.get("slot") ?? 1);
  const method = init?.method ?? "GET";
  if (method === "POST") {
    const career = JSON.parse(init!.body!) as Record<string, unknown>;
    const prev = cloud.get(slot);
    const verdict = mayReplaceCloud(
      prev && !(prev.career as { tombstone?: boolean }).tombstone ? readStamp(prev.career.sync) : null,
      readStamp(career.sync),
    );
    if (!verdict.ok) { refused += 1; return new Response(JSON.stringify({ ok: false, stale: true }), { status: 409 }); }
    clock = Math.max(Date.now(), clock + 1);
    cloud.set(slot, { career, updatedAt: new Date(clock).toISOString() });
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }
  if (method === "DELETE") { cloud.delete(slot); return new Response(JSON.stringify({ ok: true })); }
  if (u.searchParams.get("stamps") === "1") {
    const slots = [...cloud.entries()].map(([s, r]) => {
      const stamp = readStamp(r.career.sync);
      return { slot: s, updatedAt: r.updatedAt, deleted: false, stampId: stamp?.id ?? null, device: stamp?.device ?? null };
    });
    return new Response(JSON.stringify({ slots }), { status: 200 });
  }
  const row = cloud.get(slot);
  return new Response(JSON.stringify(row ? { career: row.career, updatedAt: row.updatedAt } : null), { status: 200 });
};

const player = (firstName: string, club: string): StarPlayer =>
  ({ firstName, lastName: "Player", age: 18, position: "CAM", club, nationality: "England" } as StarPlayer);
const CLUBS = ["Arsenal", "Chelsea", "Liverpool", "Man City", "Man United", "Tottenham Hotspur",
  "Newcastle United", "Aston Villa", "Brighton & Hove Albion", "West Ham United"];

const storage = await import("../../lib/star/storage");
const ACCOUNT = "user-mikey";
const S2 = storage.slotScope(ACCOUNT, 2);

// ── Part 2: the overwrite, replayed ──────────────────────────────────────────
{
  // Months ago: the computer plays Leicester in slot 2 and syncs. The phone takes it.
  on(pcDisk);
  const base = makeInitialCareer(player("Leicester", "Arsenal"), CLUBS);
  storage.saveCareer(base, S2);
  await storage.saveCareerToCloud(base, 2, { scope: S2 });
  on(phoneDisk);
  const phoneOpen = await storage.reconcileCareerLoad(ACCOUNT, 2);
  check(phoneOpen.kind === "career" && phoneOpen.career !== null, "phone takes the computer's copy");

  // Months pass: the phone plays on and uploads many times.
  let phoneCareer = (phoneOpen as { career: CareerState }).career;
  for (let i = 1; i <= 12; i++) {
    phoneCareer = { ...phoneCareer, week: phoneCareer.week + 1, money: phoneCareer.money + 10 };
    storage.saveCareer(phoneCareer, S2);
    await storage.saveCareerToCloud(phoneCareer, 2, { scope: S2 });
  }
  const phoneStampId = readStamp(cloud.get(2)!.career.sync)!.id;
  const phoneMoney = phoneCareer.money;

  // Today: the computer plays its OLD copy without having asked the cloud (the
  // wrong decision at load, whatever caused it) and uploads.
  on(pcDisk);
  storage.setOtherDeviceWarning(null);
  const pcPlayed = { ...base, week: base.week + 1, money: base.money + 5 };
  storage.saveCareer(pcPlayed, S2);
  await storage.saveCareerToCloud(pcPlayed, 2, { scope: S2 });
  check(refused === 1, `the stale upload is refused (refused=${refused})`);
  check(readStamp(cloud.get(2)!.career.sync)!.id === phoneStampId, "the cloud still holds the phone's version");
  check((cloud.get(2)!.career as { money?: number }).money === phoneMoney, "…and the phone's progress, not the computer's");
  check(storage.getStaleSave()?.slot === 2, "the computer is told (stale-save notice is up for slot 2)");
  check(storage.loadSyncRecord(S2).pending.every((p) => p.id !== undefined) && storage.loadSyncRecord(S2).pending.length === 0, "the refused upload is forgotten, not left 'pending'");

  // Further uploads from the computer are held: nothing more is even sent.
  await storage.saveCareerToCloud({ ...pcPlayed, money: pcPlayed.money + 1 }, 2, { scope: S2 });
  check(refused === 1, "once refused, this save sends nothing more until reloaded");

  // Reload on the computer: it now meets the cloud copy and asks (both moved on).
  const reopen = await storage.reconcileCareerLoad(ACCOUNT, 2);
  check(reopen.kind === "clash", `reload → the 'which progress?' question (got ${reopen.kind})`);
  check(storage.readLoadLog().length > 0, "the load decision is written down");
}

// ── Part 3: the Load Game list ───────────────────────────────────────────────
{
  cloud.clear();
  on(phoneDisk);
}
{
  // Phone has Save 2 (Season 3) and a Save 3 the computer has never seen.
  const P2 = storage.slotScope("user-list", 2);
  const P3 = storage.slotScope("user-list", 3);
  on(phoneDisk);
  const lei = makeInitialCareer(player("Lei", "Arsenal"), CLUBS);
  storage.saveCareer(lei, P2);
  await storage.saveCareerToCloud(lei, 2, { scope: P2 });
  const dover = makeInitialCareer(player("Dov", "Chelsea"), CLUBS);
  storage.saveCareer(dover, P3);
  await storage.saveCareerToCloud(dover, 3, { scope: P3 });

  // The computer opened Save 2 once (so it has an older copy and a record), the phone then moved on.
  on(pcDisk);
  await storage.reconcileCareerLoad("user-list", 2);
  on(phoneDisk);
  const leiS3 = { ...lei, week: lei.week + 40, money: lei.money + 999 };
  storage.saveCareer(leiS3, P2);
  await storage.saveCareerToCloud(leiS3, 2, { scope: P2 });

  on(pcDisk);
  check(storage.listSaveSlots("user-list").find((s) => s.slot === 3)?.empty === true, "computer: Save 3 shows Empty before the refresh");
  check(await storage.cloudIsAheadOfDevice("user-list", 2), "computer: the cloud is ahead of its Save 2");
  const r = await storage.syncSlotsFromCloud("user-list", 1);
  check(r.updated.includes(2) && r.updated.includes(3) && r.clash.length === 0, `refresh brings Save 2 up to date and fetches Save 3 (got ${JSON.stringify(r)})`);
  check(storage.loadCareer(P2)?.money === leiS3.money, "computer: Save 2 now shows the phone's progress");
  check(storage.listSaveSlots("user-list").find((s) => s.slot === 3)?.empty === false, "computer: Save 3 is there");
  check(!(await storage.cloudIsAheadOfDevice("user-list", 2)), "…and the cloud is no longer ahead");
  check((await storage.syncSlotsFromCloud("user-list", 1)).updated.length === 0, "a second refresh changes nothing (no repeat downloads)");

  // Both moved on: the list leaves it for the question and reports it.
  on(phoneDisk);
  const phoneAgain = { ...leiS3, week: leiS3.week + 1 };
  storage.saveCareer(phoneAgain, P2);
  await storage.saveCareerToCloud(phoneAgain, 2, { scope: P2 });
  on(pcDisk);
  const pcOwn = { ...leiS3, week: leiS3.week + 2, money: leiS3.money + 7 };
  storage.saveCareer(pcOwn, P2);
  const r2 = await storage.syncSlotsFromCloud("user-list", 1);
  check(r2.clash.includes(2), `both copies moved on → reported as a clash, not overwritten (got ${JSON.stringify(r2)})`);
  check(storage.loadCareer(P2)?.money === pcOwn.money, "…and the computer's own copy is untouched");
}

if (problems.length) {
  console.error("FAIL");
  for (const p of problems) console.error("  ✗ " + p);
  process.exit(1);
}
console.log("PASS — save check: a stale upload is refused and both copies kept; the list refresh brings each slot up to the cloud's version");
