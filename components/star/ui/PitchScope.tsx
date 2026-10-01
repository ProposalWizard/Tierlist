"use client";
import type React from "react";
import "./pitchLook.css";

/**
 * THE PITCH LOOK, ALWAYS, ON THE SCREENS THAT PLAY FOOTBALL (Harry, 1 Oct 2026,
 * P92: "when it's in the training or drills or match, we definitely use the
 * pitch kind of UI"). Settings → Look still chooses the menus; training, the
 * drills and the match chrome are green with chalk lines in BOTH looks.
 *
 * It is one class: everything under it reads the Pitch look's variables
 * (ui/pitchLook.css), so a screen needs no second set of colours. The match
 * canvas itself is a canvas and is untouched. `on={false}` leaves the page's
 * own look (the wrapper stays, so the tree below does not remount).
 */
export default function PitchScope({ children, on = true, className = "" }: { children: React.ReactNode; on?: boolean; className?: string }) {
  return <div data-pitch-scope={on ? "on" : undefined} className={`${on ? "star-look-pitch " : ""}${className}`}>{children}</div>;
}
