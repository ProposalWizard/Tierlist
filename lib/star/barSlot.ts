"use client";
/**
 * lib/star/barSlot.ts — ONE bottom bar for the whole game (app frame, step 1;
 * Harry, 19 Nov 2026: "go ahead, small steps").
 *
 * Before: every screen built its own MainBar, so every tap threw the bar away
 * and built it again (a big part of "it feels like a website"). Now the bar is
 * built ONCE by <PersistentBar/> (mounted in app/star-dev/layout.tsx, which
 * never unmounts) and screens only say what it should show, through
 * <BarSlot …/> (renders nothing itself). The newest slot wins; when the last
 * slot goes (a match, a full-screen moment), the bar hides.
 */
import { useSyncExternalStore } from "react";
import type { ComponentProps } from "react";
import type MainBar from "@/components/star/MainBar";

export type BarProps = ComponentProps<typeof MainBar>;

let current: { owner: number; props: BarProps } | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((f) => f());

export function setBar(owner: number, props: BarProps): void {
  current = { owner, props };
  emit();
}
export function clearBar(owner: number): void {
  if (current?.owner !== owner) return; // a newer screen already took the bar
  current = null;
  emit();
}
export function useBar(): BarProps | null {
  return useSyncExternalStore(
    (f) => { listeners.add(f); return () => { listeners.delete(f); }; },
    () => current?.props ?? null,
    () => null,
  );
}
