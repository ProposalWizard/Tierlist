"use client";
import type React from "react";

/**
 * A STAGGERED ENTRANCE: each child block rises and fades in a beat after the
 * one above it.
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
  return (
    <div className={`${onPageActive ? "kib-rise" : "kit-rise"}${className ? ` ${className}` : ""}`} style={{ animationDelay: `${delay + index * step}ms`, ...style }}>
      {children}
    </div>
  );
}
