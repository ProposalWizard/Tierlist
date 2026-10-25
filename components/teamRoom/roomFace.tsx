"use client";
/** components/teamRoom/roomFace.tsx — a face with its presence dot (green here now, ring away). */
import type { TeamPerson } from "@/lib/teamRoom/config";
import { useTeamRoom } from "@/lib/teamRoom/store";
import { Av } from "./bits";

export function PersonFace({ p }: { p: TeamPerson }) {
  const s = useTeamRoom();
  const here = s.online.includes(p);
  return (
    <span className="trr-face" title={`${p}: ${here ? "active" : "away"}`}>
      <Av p={p} sm />
      <span className={`trr-dot ${here ? "on" : "away"}`} aria-hidden />
    </span>
  );
}
