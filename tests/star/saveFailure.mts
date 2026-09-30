import { makeIdentity } from "../../lib/star/careerFlow";
import type { StarPlayer } from "../../lib/star/types";

/**
 * "Couldn't save on this device" — lib/star/storage.ts's saveCareer used to
 * catch every localStorage error and say nothing. It now reports it (for
 * components/star/SaveFailedBanner.tsx to show) and clears the report the
 * moment a save works again. Checked against a fake localStorage whose
 * setItem can be made to throw exactly the way a full browser store does.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

const store = new Map<string, string>();
let failWith: Error | null = null;
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { if (failWith) throw failWith; store.set(k, String(v)); },
  removeItem: (k: string) => { store.delete(k); },
  clear: () => store.clear(),
};

const { saveCareer, loadCareer, getSaveFailure, onSaveFailureChange, ANON_SCOPE, slotScope } =
  await import("../../lib/star/storage");

const player: StarPlayer = {
  firstName: "Test", lastName: "Saver", age: 17, skinTone: "light",
  club: "Arsenal", clubBadge: null, position: "ST", nationality: "England", startYear: 2027,
} as StarPlayer;
const career = makeIdentity(player, "premier");

function quotaError(): Error {
  const e = new Error("The quota has been exceeded.");
  e.name = "QuotaExceededError";
  return e;
}

const heard: (string | null)[] = [];
const stop = onSaveFailureChange((f) => heard.push(f ? f.reason : null));

// ── A working save reports nothing ──
check(saveCareer(career, "user-1") === true, "a normal save returns true");
check(getSaveFailure() === null, "a normal save leaves no failure reported");
check(heard.length === 0, "a normal save does not notify anybody");

// ── A full store, signed in ──
const savedAtBefore = store.get("star-career-saved-at-v1::user-1");
failWith = quotaError();
check(saveCareer({ ...career, week: 9 }, "user-1") === false, "a save that throws returns false (it no longer pretends it worked)");
const f1 = getSaveFailure();
check(f1 !== null, "a quota error is reported, not swallowed");
check(f1?.reason === "quota", "…as a quota error");
check(f1?.signedIn === true, "…for a signed-in scope");
check(!!f1?.message.includes("cloud save is still safe"), "a signed-in player is told the cloud save is still safe");
check(store.get("star-career-saved-at-v1::user-1") === savedAtBefore, "a failed save does not move the saved-at stamp (it must never look newer than the cloud)");
check(heard.join(",") === "quota", "listeners hear about it once");

// Failing again keeps the SAME id — a dismissed banner stays dismissed.
saveCareer({ ...career, week: 10 }, "user-1");
check(getSaveFailure()?.id === f1?.id, "repeated failures keep the same id, so a dismissed message stays away");

// ── Recovery clears it ──
failWith = null;
check(saveCareer({ ...career, week: 11 }, "user-1") === true, "saving works again once storage frees up");
check(getSaveFailure() === null, "a working save clears the reported failure");
check(heard[heard.length - 1] === null, "listeners hear that it recovered");
check(loadCareer("user-1")?.week === 11, "the recovered save is really on disk");

// ── Signed out, full store: told to free up space ──
failWith = quotaError();
saveCareer(career, ANON_SCOPE);
const f2 = getSaveFailure();
check(f2?.signedIn === false, "the anon scope counts as signed out");
check(!!f2?.message.toLowerCase().includes("free up"), "a signed-out player is told to free up space");
check((f2?.id ?? 0) > (f1?.id ?? 0), "a new failure after a recovery gets a new id, so the message shows again");

// A signed-out player's other save slots are signed out too.
failWith = null; saveCareer(career, ANON_SCOPE);
failWith = quotaError();
saveCareer(career, slotScope(ANON_SCOPE, 2));
check(getSaveFailure()?.signedIn === false, "an anon slot 2 scope counts as signed out");

// ── Anything else (storage blocked) is reported too, not only quota ──
failWith = null; saveCareer(career, "user-1");
failWith = new Error("SecurityError: storage is disabled");
saveCareer(career, "user-2");
check(getSaveFailure()?.reason === "other", "a non-quota error is reported as 'other'");
check(getSaveFailure()?.signedIn === true, "a signed-in slot scope counts as signed in");

// A listener that throws never breaks saving.
stop();
onSaveFailureChange(() => { throw new Error("bad listener"); });
failWith = null;
let threw = false;
try { saveCareer(career, "user-1"); } catch { threw = true; }
check(!threw, "a throwing listener never breaks saveCareer");

if (problems.length) {
  console.error("FAIL");
  for (const p of problems) console.error("  ✗ " + p);
  process.exit(1);
}
console.log("PASS — a failed device save is reported (quota vs other, signed in vs out), clears on recovery, and never moves the saved-at stamp");
