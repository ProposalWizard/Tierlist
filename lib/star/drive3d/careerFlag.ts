/**
 * THE DRIVE-TO-TRAINING SETTING — one switch, OFF until Harry tries it (driving phase 2, 28 Nov 2026: "behind a
 * setting OFF by default, like the garden levels flag").
 *
 * Off: the garden's training gate opens the training pitch exactly as before.
 * On (this device only): the garden's training gate opens THE DRIVE (components/star/DriveToTraining.tsx): your car,
 * the street, the lane, a call or an event on the way, then the real training compound (the barrier, your bay, you
 * at your car's door). The gym door opens the 3D gym; "Drive home" is the drive back, ending at the fork:
 * Home (the garden), Casino or Shop. An event's small effect (fans, mood, a fine…) goes on the career.
 *
 * Switched on from the drive's test page (/star-drive3d-dev → "In my career: On"), or ?drive=1 on any page.
 * DRIVE_IN_GAME = true later turns it on for everyone.
 */
export const DRIVE_IN_GAME = false;
export const DRIVE_KEY = "kib-drive-to-training";

export function driveToTrainingOn(): boolean {
  if (DRIVE_IN_GAME) return true;
  try {
    if (typeof window === "undefined") return false;
    const q = new URLSearchParams(window.location.search).get("drive");
    if (q === "1") return true;
    if (q === "0") return false;
    return localStorage.getItem(DRIVE_KEY) === "on";
  } catch { return false; }
}

export function setDriveToTrainingOn(on: boolean) {
  try { if (on) localStorage.setItem(DRIVE_KEY, "on"); else localStorage.removeItem(DRIVE_KEY); } catch { /* private window: nothing kept */ }
}

/** The day's seed for the drive (the same day, the same call and event): season, week and the clock's day. */
export function driveSeed(season: number, week: number, day: number, leg: "in" | "back"): number {
  return season * 10007 + week * 101 + day * 7 + (leg === "back" ? 3 : 0);
}
