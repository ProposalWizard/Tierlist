"use client";
/**
 * components/teamRoom/roomFace.tsx — faces with live status (plan U0.2):
 * green = active (room open, used in the last 10 minutes), empty ring = away,
 * red with a bar = do not disturb, amber = busy on a schedule.
 */
import { createContext, useContext, useEffect, useState } from "react";
import type { TeamPerson } from "@/lib/teamRoom/config";
import { liveStatus, presenceOf, PRESENCE_WORD, statusLine, type LiveStatus, type Presence } from "@/lib/teamRoom/status";
import { useTeamRoom } from "@/lib/teamRoom/store";
import { Av } from "./bits";

/** A clock that moves every 30 s, so "back at 5" and cleared statuses change by themselves. */
export function useNow(ms = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(id); }, [ms]);
  return now;
}

/** One person's status and dot, now. */
export function usePersonStatus(p: TeamPerson): { live: LiveStatus; presence: Presence; line: string } {
  const s = useTeamRoom();
  const now = useNow();
  const live = liveStatus(s.statuses[p], new Date(now));
  return { live, presence: presenceOf(s.online.includes(p), live), line: statusLine(live) };
}

export function PersonFace({ p, big }: { p: TeamPerson; big?: boolean }) {
  const { presence, line } = usePersonStatus(p);
  return (
    <span className={`trr-face${big ? " big" : ""}`} title={`${p}: ${PRESENCE_WORD[presence]}${line ? ` · ${line}` : ""}`} data-person={p}>
      <Av p={p} sm={!big} />
      <span className={`trr-dot ${presence === "active" ? "on" : presence}`} aria-hidden />
    </span>
  );
}

/** The emoji after a name (its words on hover); "back at 5" when busy. */
export function StatusBit({ p, back = false }: { p: TeamPerson; back?: boolean }) {
  const { live } = usePersonStatus(p);
  if (!live.emoji && !(back && live.busy)) return null;
  const words = [live.emoji, live.text].filter(Boolean).join(" ");
  return (
    <span className="trr-sbit" title={live.busy ? `${words || "Busy"} until ${live.busy.to} · nothing expected until then` : words}>
      {live.emoji && <span aria-hidden>{live.emoji}</span>}
      {back && live.busy && <small>back at {live.backAt}</small>}
    </span>
  );
}

/** Opens a person's little profile (hover card on a computer, a sheet on a phone). Provided by the room. */
export const ProfileOpen = createContext<(p: TeamPerson, at: DOMRect) => void>(() => {});
export const useOpenProfile = () => useContext(ProfileOpen);

/** Each person's newest push (from the Team board), for the profile card. */
export type LastPushes = Partial<Record<TeamPerson, { at: string; title: string; version: string | null }>>;
export const LastPush = createContext<LastPushes>({});
