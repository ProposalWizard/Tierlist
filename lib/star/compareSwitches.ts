/**
 * COMPARE SWITCHES — see the old behaviour again, in the Play Area only.
 *
 * Harry, planning v0.15: film every change so it can be judged before it is
 * kept. Most of the v0.15 changes are now permanent; he kept two switches to
 * flip between old and new in the test screens: "Penalty rules" and "Shot
 * power". Plus the keeper brain's Hard / Middle / Easier dial
 * (lib/star/keeperBrain.ts, `BRAIN_DIAL_FLAG`) lives on the same rule.
 *
 * Set from the Play Area (/star-play-dev → "Compare old and new"). Stored in
 * this browser only. They never reach the real game: on /star-dev (a career,
 * its matches, the trial, training, shootouts) every switch reads ON and the
 * dial reads its default, whatever this device has saved. Off a browser (the
 * test suite, a script) every switch reads ON too.
 */

export type CompareSwitch =
  /** A penalty's hard rules: keeper centred on his line, ball on the spot,
   *  you behind it, everyone else on the edge of the box, one fixed camera. */
  | "penaltyRules"
  /** Shot speed keeps climbing to power 80 and much more slowly after it. */
  | "powerCurve";

export const COMPARE_SWITCHES: { id: CompareSwitch; label: string; hint: string }[] = [
  { id: "penaltyRules", label: "Penalty rules", hint: "New: keeper central on his line, ball on the spot, you behind it, others on the box edge, one camera. Test screens only." },
  { id: "powerCurve", label: "Shot power", hint: "New: 99 power hits it at 103 km/h, like an 82. Old: 113 km/h. Test screens only." },
];

const keyFor = (name: CompareSwitch) => `star-compare-${name}`;

/**
 * The real game — a career on /star-dev, with its matches, trial, training
 * and shootouts. Test-area settings never apply there.
 */
export function inRealGame(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const p = window.location.pathname.replace(/\/+$/, "");
    return p === "/star-dev";
  } catch {
    return true;
  }
}

/** A Play Area setting saved on this device, or null in the real game / off a browser. */
export function testAreaSetting(key: string): string | null {
  if (typeof window === "undefined" || inRealGame()) return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function switchOn(name: CompareSwitch): boolean {
  return testAreaSetting(keyFor(name)) !== "off";
}

export function setSwitch(name: CompareSwitch, on: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (on) window.localStorage.removeItem(keyFor(name));
    else window.localStorage.setItem(keyFor(name), "off");
  } catch { /* private mode */ }
}

/** Every switch back to New, and any retired switch's key cleared. */
export function resetSwitches(): void {
  if (typeof window === "undefined") return;
  try {
    for (const c of COMPARE_SWITCHES) window.localStorage.removeItem(keyFor(c.id));
    // Retired in the v0.15 build (now permanent).
    window.localStorage.removeItem("star-compare-goalOnLine");
    window.localStorage.removeItem("star-compare-keeperOneDive");
  } catch { /* private mode */ }
}
