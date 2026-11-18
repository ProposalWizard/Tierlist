/**
 * THE THREE SAVES, END TO END (headless): world/slots.ts on the phone's save
 * store (in memory here, MMKV on a phone), the way the title's Load Game and
 * Settings' Saves card use it.
 *
 *   cd phone && npx tsx tools/slots-check.ts
 *
 * Two and three careers side by side; switching keeps each one's progress;
 * a new game in an empty slot leaves the others alone; deleting one leaves the
 * others; the career open when the app closes is the one it opens on.
 * Exit 1 on any failure.
 */
(globalThis as Record<string, unknown>).__KIB_HEADLESS__ = true;
import type { CareerState } from "@/lib/star/types";
import { testCareer } from "./match-run-career";

async function main() {
  const store = await import("../src/game/store");
  const save = await import("../src/game/save");
  const slots = await import("../src/world/slots");
  let failed = 0;
  const ok = (c: boolean, what: string) => { console.log(`${c ? "ok  " : "FAIL"}  ${what}`); if (!c) failed++; };
  const named = (first: string): CareerState => { const c = testCareer(); return { ...c, player: { ...c.player, firstName: first } }; };
  const names = () => slots.listSlots().map((s) => (s.empty ? "-" : s.playerName!.split(" ")[0])).join(",");

  store.setCareer(named("Alan"));
  ok(slots.activeSlot() === 1 && names() === "Alan,-,-", `first career is save 1 (${names()})`);

  slots.newInSlot(2);
  ok(store.getCareer() === null && slots.activeSlot() === 2, "a new game in save 2 opens on no career");
  store.setCareer(named("Bobby"));
  ok(names() === "Alan,Bobby,-", `two saves (${names()})`);

  // Progress in Bobby, then switch to Alan and back: both keep theirs.
  store.setCareer((c) => ({ ...c, money: 12345 }));
  ok(slots.loadSlot(1) && store.getCareer()?.player.firstName === "Alan", "switch to save 1 opens Alan");
  store.setCareer((c) => ({ ...c, money: 777 }));
  ok(slots.loadSlot(2) && store.getCareer()?.money === 12345, "back to save 2: Bobby's money kept");
  ok(slots.loadSlot(1) && store.getCareer()?.money === 777, "back to save 1: Alan's money kept");

  slots.newInSlot(3);
  store.setCareer(named("Colin"));
  ok(names() === "Alan,Bobby,Colin", `three saves (${names()})`);
  ok(save.loadCareer()?.player.firstName === "Colin", "the app reopens on the save last played");

  slots.deleteSlot(2);
  ok(names() === "Alan,-,Colin" && store.getCareer()?.player.firstName === "Colin", `deleting save 2 leaves the others (${names()})`);
  slots.deleteSlot(3);
  ok(store.getCareer() === null && names() === "Alan,-,-", `deleting the save being played empties it (${names()})`);
  ok(slots.loadSlot(1) && store.getCareer()?.money === 777, "save 1 still opens after the others went");
  ok(!slots.loadSlot(2), "an empty save does not open");

  console.log(failed ? `\n${failed} failed` : "\nAll save-slot checks passed.");
  process.exit(failed ? 1 : 0);
}
void main();
