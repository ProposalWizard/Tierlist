import type { CareerState } from "./types";

const KEY = "star-career-v2";
const OLD_KEY = "star-career-v1";

export function saveCareer(state: CareerState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {}
}

export function loadCareer(): CareerState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CareerState;
    if (parsed.version !== 2) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearCareer() {
  try {
    localStorage.removeItem(KEY);
    localStorage.removeItem(OLD_KEY);
  } catch {}
}
