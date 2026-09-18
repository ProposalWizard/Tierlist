import { makeInitialCareer, makeIdentity } from "../../lib/star/careerFlow";
import type { CareerState, StarPlayer } from "../../lib/star/types";

/**
 * Multiple save slots — see the "Saves" section of Settings
 * (components/star/SaveSlotsPanel.tsx) and lib/star/storage.ts's slotScope.
 *
 * The one thing that actually matters here, above everything else: an
 * account that never opens the new saves screen must see ZERO change in
 * behaviour, forever. That is what makes slot 1 deliberately just
 * `accountScope` — the exact key every account's one-and-only save has
 * always lived under — rather than a new, separate key of its own. Most of
 * what follows is really that one property, checked from a few different
 * angles, plus slots 2/3 being genuinely independent of it and of each
 * other.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

function freshStore() {
  const store = new Map<string, string>();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, String(v)); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => store.clear(),
  };
  return store;
}

freshStore();
const {
  saveCareer, loadCareer, clearCareer, slotScope, listSaveSlots,
  loadActiveSlot, saveActiveSlot, MAX_SAVE_SLOTS,
} = await import("../../lib/star/storage");

const ACCOUNT = "user-alice";

const player = (firstName: string, club: string): StarPlayer => ({
  firstName, lastName: "Player", age: 18, position: "CAM", club, nationality: "England",
} as StarPlayer);

const CLUBS = [
  "Arsenal", "Chelsea", "Liverpool", "Man City", "Man Utd", "Spurs",
  "Newcastle", "Aston Villa", "Brighton", "West Ham",
];

// ── Slot 1 IS the account scope, unchanged ──────────────────────────────────
{
  check(slotScope(ACCOUNT, 1) === ACCOUNT, "slot 1 is exactly the bare account scope, not a derived key");
  check(slotScope(ACCOUNT, 2) !== ACCOUNT, "slot 2 is a different key from the account scope");
  check(slotScope(ACCOUNT, 3) !== ACCOUNT, "slot 3 is a different key from the account scope");
  check(slotScope(ACCOUNT, 2) !== slotScope(ACCOUNT, 3), "slot 2 and slot 3 are different keys from each other");
  check(MAX_SAVE_SLOTS === 3, `three save slots are offered (${MAX_SAVE_SLOTS})`);
}

// ── An account with an existing save (i.e. every real account today) sees
// that save as slot 1 with no migration step, and nothing about how it is
// read or written changes ───────────────────────────────────────────────────
{
  freshStore();
  const before = makeInitialCareer(player("Legacy", "Arsenal"), CLUBS);
  // Written the OLD way, exactly as every session before this feature
  // existed — no slot concept at all.
  saveCareer(before, ACCOUNT);

  const viaSlot1 = loadCareer(slotScope(ACCOUNT, 1));
  check(viaSlot1?.player.firstName === "Legacy", "a save written the old, unslotted way reads back through slot 1");

  const summary = listSaveSlots(ACCOUNT);
  check(summary.length === MAX_SAVE_SLOTS, `listSaveSlots reports all ${MAX_SAVE_SLOTS} slots (${summary.length})`);
  check(summary[0].slot === 1 && summary[0].empty === false && summary[0].club === "Arsenal",
    "slot 1 is reported as occupied, with the pre-existing save's own club");
  check(summary[1].empty === true && summary[2].empty === true,
    "slots 2 and 3 are reported empty for an account that has never used them");
}

// ── A trial in progress is a real save, and must not read as a spare slot ──
//
// A career now genuinely exists before anybody has signed it: `makeIdentity`
// (careerFlow.ts) gives the trial a real, saveable CareerState with no club,
// no league and no fixtures. It is NOT an empty slot — overwriting it loses
// the trial — but it has no club name to print, so a summary that only ever
// reported a name and a club would render a dangling separator and quietly
// invite the player to start over on top of the career they are mid-way
// through.
{
  freshStore();
  const trial = makeIdentity({
    firstName: "Trialist", lastName: "Player", age: 18, position: "CAM",
    club: "", nationality: "England",
  } as StarPlayer);
  const signed = makeInitialCareer(player("Signed", "Arsenal"), CLUBS);
  saveCareer(trial, slotScope(ACCOUNT, 1));
  saveCareer(signed, slotScope(ACCOUNT, 2));

  const summary = listSaveSlots(ACCOUNT);
  check(summary[0].empty === false, "a trial in progress occupies its slot rather than reading as empty");
  check(summary[0].signed === false, "…and is reported as not yet signed by anybody");
  check(summary[0].club === undefined, "…with no club name to print rather than an empty one");
  check(summary[0].playerName === "Trialist Player", "…while still naming the player it belongs to");

  check(summary[1].empty === false && summary[1].signed === true,
    "a career with a club is still reported as signed");
  check(summary[1].club === "Arsenal", "…and still names its club");

  // And it survives a round trip like any other save — the whole point of
  // splitting career creation was that the trial is saved by the machinery
  // that already exists, not by a parallel one.
  const back = loadCareer(slotScope(ACCOUNT, 1));
  check(back?.player.firstName === "Trialist", "a trial save loads back out of the ordinary save slot");
  check((back?.league ?? []).length === 0, "…still with no league, because nobody has signed it");
  check(back?.starRating === trial.starRating, "…and with the player's own rating intact");

  // Switching away and back is the whole point of it being a real save — a
  // trial started on one device has to still be a trial when it is picked up
  // again, not a half-filled career or an empty slot.
  saveActiveSlot(ACCOUNT, 2);
  saveActiveSlot(ACCOUNT, 1);
  const afterSwitch = loadCareer(slotScope(ACCOUNT, loadActiveSlot(ACCOUNT)));
  check(afterSwitch?.player.firstName === "Trialist", "a trial survives switching to another slot and back");
  check((afterSwitch?.league ?? []).length === 0, "…and is still unsigned when it comes back");

  // And it clears like any other save, rather than leaving a ghost behind.
  clearCareer(slotScope(ACCOUNT, 1));
  check(loadCareer(slotScope(ACCOUNT, 1)) === null, "a trial save clears like any other");
  check(listSaveSlots(ACCOUNT)[0].empty === true, "…and the slot reads as genuinely empty afterwards");
  check(loadCareer(slotScope(ACCOUNT, 2))?.player.firstName === "Signed",
    "…without touching the signed career in the next slot");
}

// ── Slots are genuinely independent ─────────────────────────────────────────
{
  freshStore();
  const s1 = makeInitialCareer(player("One", "Arsenal"), CLUBS);
  const s2 = makeInitialCareer(player("Two", "Chelsea"), CLUBS);
  const s3 = makeInitialCareer(player("Three", "Liverpool"), CLUBS);
  saveCareer(s1, slotScope(ACCOUNT, 1));
  saveCareer(s2, slotScope(ACCOUNT, 2));
  saveCareer(s3, slotScope(ACCOUNT, 3));

  check(loadCareer(slotScope(ACCOUNT, 1))?.player.firstName === "One", "slot 1 loads its own save");
  check(loadCareer(slotScope(ACCOUNT, 2))?.player.firstName === "Two", "slot 2 loads its own save, independent of slot 1");
  check(loadCareer(slotScope(ACCOUNT, 3))?.player.firstName === "Three", "slot 3 loads its own save, independent of the other two");

  const summary = listSaveSlots(ACCOUNT);
  check(summary.every(s => !s.empty), "all three slots report occupied");
  check(summary.map(s => s.playerName).join(",") === "One Player,Two Player,Three Player",
    "each slot's summary names its own player, in slot order");

  // Overwriting one slot must not touch the others.
  const s1Updated: CareerState = { ...s1, money: s1.money + 999999 };
  saveCareer(s1Updated, slotScope(ACCOUNT, 1));
  check(loadCareer(slotScope(ACCOUNT, 1))?.money === s1Updated.money, "updating slot 1 is reflected in slot 1");
  check(loadCareer(slotScope(ACCOUNT, 2))?.player.firstName === "Two", "…and leaves slot 2 completely unaffected");
  check(loadCareer(slotScope(ACCOUNT, 3))?.player.firstName === "Three", "…and slot 3 too");

  // Deleting one slot must not touch the others.
  clearCareer(slotScope(ACCOUNT, 2));
  check(loadCareer(slotScope(ACCOUNT, 2)) === null, "clearing slot 2 empties it");
  check(loadCareer(slotScope(ACCOUNT, 1)) !== null, "…without clearing slot 1");
  check(loadCareer(slotScope(ACCOUNT, 3)) !== null, "…or slot 3");

  const afterDelete = listSaveSlots(ACCOUNT);
  check(afterDelete[1].empty === true, "listSaveSlots reflects slot 2 being emptied");
  check(afterDelete[0].empty === false && afterDelete[2].empty === false, "…while slots 1 and 3 still report occupied");
}

// ── Two different accounts on one device still never see each other's
// saves, slot for slot — the same guarantee career.mts already proves for
// the single-save case, re-checked here because slotScope composes the
// account into the key differently for slots 2/3 than slot 1 does ─────────
{
  freshStore();
  const aliceSlot2 = makeInitialCareer(player("Alice", "Arsenal"), CLUBS);
  const bobSlot2 = makeInitialCareer(player("Bob", "Chelsea"), CLUBS);
  saveCareer(aliceSlot2, slotScope("user-alice", 2));
  saveCareer(bobSlot2, slotScope("user-bob", 2));

  check(loadCareer(slotScope("user-alice", 2))?.player.firstName === "Alice", "Alice's slot 2 loads for Alice");
  check(loadCareer(slotScope("user-bob", 2))?.player.firstName === "Bob", "Bob's slot 2 loads for Bob, not Alice's");
  check(loadCareer(slotScope("user-alice", 3)) === null, "Alice's OWN unused slot 3 is empty, not Bob's slot 2 leaking across");
}

// ── A pre-slots legacy save is claimed into slot 1 specifically, never
// mistakenly picked up by listSaveSlots peeking at slot 2 or 3 first ──────
{
  freshStore();
  const legacy = makeInitialCareer(player("PreSlots", "Arsenal"), CLUBS);
  // Simulate a real save from before this feature existed: the flat,
  // pre-scoping key claimLegacySave/claimAnonSave already handle — see
  // career.mts's own "claimed once" tests for the base mechanism.
  (globalThis as { localStorage: Storage }).localStorage.setItem("star-career-v2", JSON.stringify(legacy));

  const summary = listSaveSlots("user-carol");
  check(summary[0].empty === false && summary[0].playerName === "PreSlots Player",
    "a pre-slots save is claimed into slot 1, not left stranded");
  check(summary[1].empty === true && summary[2].empty === true,
    "…and does NOT get mistakenly claimed into slot 2 or 3 while listing them");
}

// ── Which slot was last open persists per account, and defaults sanely ─────
{
  freshStore();
  check(loadActiveSlot(ACCOUNT) === 1, "an account that has never switched slots defaults to slot 1");

  saveActiveSlot(ACCOUNT, 2);
  check(loadActiveSlot(ACCOUNT) === 2, "the active slot round-trips");
  check(loadActiveSlot("user-bob") === 1, "…without affecting a different account's own default");

  // Garbage on disk (a future version, a hand-edited value, corruption) is
  // refused back to the safe default rather than trusted.
  (globalThis as { localStorage: Storage }).localStorage.setItem(`star-career-active-slot-v1::${ACCOUNT}`, "99");
  check(loadActiveSlot(ACCOUNT) === 1, "an out-of-range stored slot is refused, not trusted");
  (globalThis as { localStorage: Storage }).localStorage.setItem(`star-career-active-slot-v1::${ACCOUNT}`, "not a number");
  check(loadActiveSlot(ACCOUNT) === 1, "a corrupt stored value is refused the same way");
}

if (problems.length) {
  console.error("FAIL");
  for (const p of problems) console.error("  ✗ " + p);
  process.exit(1);
}
console.log("PASS — save slots are independent, slot 1 is byte-identical to the pre-slots save, and switching is per-account");
