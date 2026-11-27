/**
 * "Give me money (testing)" in Settings (Mikey): adds exactly the typed amount to the career's cash
 * (`career.money`, the same field the shop, wages and sponsors change). Junk is ignored. The save is
 * marked as a tester save, as the website's cheats do (lib/star/godMode.ts).
 */
import type { CareerState } from "@/lib/star/types";
import { markGodMode } from "@/lib/star/godMode";

/** The amount typed, as a whole number of stars, or null if it is not a plain positive number. */
export function parseMoneyInput(text: string): number | null {
  const t = String(text ?? "").trim().replace(/[★,\s_]/g, "");
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  const n = Math.floor(Number(t));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(n, Number.MAX_SAFE_INTEGER);
}

/** The career with the typed amount added to its money; the same career back if the text is junk. */
export function giveMoney(career: CareerState, text: string): CareerState {
  const n = parseMoneyInput(text);
  if (n === null) return career;
  const sum = (career.money ?? 0) + n;
  return markGodMode({ ...career, money: Math.min(sum, Number.MAX_SAFE_INTEGER) }) as CareerState;
}
