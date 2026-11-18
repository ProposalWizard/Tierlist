/**
 * THE CAREER, ONE COPY FOR THE WHOLE APP.
 * Every screen reads it with useCareer() and changes it with setCareer();
 * each change is saved on the phone straight away (game/save.ts).
 */
import { useSyncExternalStore } from "react";
import type { CareerState } from "@/lib/star/types";
import { loadCareer, saveCareer, clearCareer } from "./save";

let current: CareerState | null = loadCareer();
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

export function getCareer() { return current; }
export function setCareer(next: CareerState | null | ((c: CareerState) => CareerState)) {
  current = typeof next === "function" ? (current ? next(current) : null) : next;
  if (current) saveCareer(current); else clearCareer();
  emit();
}
export function useCareer(): CareerState | null {
  return useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => current, () => current);
}
