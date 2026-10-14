"use client";
import type React from "react";

/**
 * WAS a staggered entrance (each block rose in a beat after the one above).
 * Since 14 Oct 2026 it draws its children at once: menus open on the tap's
 * own frame (ui-house-style skill).
 *
 *   <RiseIn index={0}>…</RiseIn>
 *   <RiseIn index={1}>…</RiseIn>
 *
 * `step` is the gap between blocks (80 ms). `delay` adds a fixed wait first.
 * `onPageActive` ties it to the swipe pages instead of the mount: the block
 * rises each time its page is swiped to (the home screens use this).
 */
export default function RiseIn({ index = 0, step = 80, delay = 0, onPageActive = false, className = "", style, children }: {
  index?: number;
  step?: number;
  delay?: number;
  onPageActive?: boolean;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}) {
  // No entrance any more (Harry, 14 Oct 2026: "If I click on something, it
  // should just go straight in"). The block is there on the first frame; the
  // props stay so every screen that uses RiseIn keeps compiling unchanged.
  void index; void step; void delay; void onPageActive;
  return (
    <div className={className || undefined} style={style}>
      {children}
    </div>
  );
}
