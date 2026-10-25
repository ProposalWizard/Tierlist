"use client";

/**
 * SHOOTOUT: THE KEEPER READS YOUR HABITS — a test page (Leo, 22 Oct 2026).
 *
 * "Shootouts you play kick by kick already exist. New: the keeper remembers
 * where you put your last kicks and leans that way. Mix it up or get read. On
 * a new test page only; the game is unchanged."
 *
 * The shootout is ShootoutPlay (the same one Infinite Highlights plays, on
 * EnginePlay — the real match) with `readsHabits`. The read is
 * lib/star/penaltyKeeper.ts `readKickHabits`; this page only shows it.
 * Nothing is saved.
 */

import { useCallback, useState } from "react";
import ShootoutPlay from "@/components/star/ShootoutPlay";
import PageGuide from "@/components/admin/PageGuide";
import { BroadcastPage, Panel, Btn, Pill } from "@/components/admin/broadcast/BroadcastPage";
import { readKickHabits, type KeeperHabitRead, type PastKick } from "@/lib/star/penaltyKeeper";

const ARROW: Record<PastKick["side"], string> = { left: "←", centre: "↑", right: "→" };
const SIDE: Record<PastKick["side"], string> = { left: "Left", centre: "Middle", right: "Right" };

/** Left ← → right: where he leans and how hard. */
function ReadBar({ read, on }: { read: KeeperHabitRead; on: boolean }) {
  const lean = on ? read.share : 0;
  const dir = read.dir;
  const pct = Math.round(lean * 100);
  const colour = pct >= 70 ? "#dc2626" : pct >= 35 ? "#d97706" : "#16a34a";
  // A side lean fills from the middle out; a middle habit fills both ways.
  const half = 50 * lean;
  const fill = dir < 0 ? { left: `${50 - half}%`, width: `${half}%` }
    : dir > 0 ? { left: "50%", width: `${half}%` }
    : { left: `${50 - half / 2}%`, width: `${half}%` };
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 800, color: "#64748b" }}>
        <span>← Left</span><span>Middle</span><span>Right →</span>
      </div>
      <div style={{ position: "relative", height: 18, borderRadius: 9, background: "rgba(100,116,139,0.18)", border: "1px solid rgba(100,116,139,0.55)", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: 0, bottom: 0, ...fill, background: colour }} />
        <div style={{ position: "absolute", top: 0, bottom: 0, left: "50%", width: 2, marginLeft: -1, background: "rgba(100,116,139,0.8)" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 800 }}>
          {on ? read.words : "Off: he only reads this kick"}
        </span>
        <span style={{ fontSize: 13, fontWeight: 900, color: on ? colour : "#64748b", whiteSpace: "nowrap" }}>
          Reading you {pct}%
        </span>
      </div>
    </div>
  );
}

export default function ShootoutHabitsPage() {
  const [on, setOn] = useState(true);
  const [round, setRound] = useState(0);
  const [kicks, setKicks] = useState<PastKick[]>([]);
  const [read, setRead] = useState<KeeperHabitRead>(() => readKickHabits([]));
  const onHabits = useCallback((k: PastKick[], r: KeeperHabitRead) => { setKicks(k); setRead(r); }, []);
  const reset = () => { setRound((n) => n + 1); setKicks([]); setRead(readKickHabits([])); };

  return (
    <BroadcastPage title="Shootout: the keeper reads you" sub="Mix it up or get read" width={520}>
      <PageGuide page="/star-shootout-dev" />
      <div style={{ display: "grid", gap: 10 }}>
        <Panel>
          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 13, fontWeight: 800 }}>Keeper reads habits</span>
              <Pill on={on} onClick={() => setOn(true)}>On</Pill>
              <Pill on={!on} onClick={() => setOn(false)}>Off</Pill>
              <span style={{ marginLeft: "auto" }}><Btn onClick={reset}>Reset</Btn></span>
            </div>
            <ReadBar read={read} on={on} />
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", minHeight: 28 }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: "#64748b" }}>Your kicks:</span>
              {kicks.length === 0 && <span style={{ fontSize: 12, color: "#64748b" }}>none yet</span>}
              {kicks.map((k, i) => (
                <span key={i} title={`Kick ${i + 1}: ${SIDE[k.side]}, ${k.height}`}
                  style={{ fontSize: 12.5, fontWeight: 800, padding: "3px 8px", borderRadius: 8, background: "rgba(100,116,139,0.14)", border: "1px solid rgba(100,116,139,0.45)" }}>
                  {i + 1} {ARROW[k.side]} {SIDE[k.side]} · {k.height}
                </span>
              ))}
            </div>
          </div>
        </Panel>
        <ShootoutPlay key={round} seed={1 + round} readsHabits={on} onHabits={onHabits} youTakeEvery rememberKicks />
      </div>
    </BroadcastPage>
  );
}
