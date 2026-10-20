"use client";
/**
 * THE TEST AREAS' BUILD-UP ADJUST (Infinite Highlights, Infinite Match).
 *
 * Harry, 20 Oct 2026: "Can we have a way to adjust build up? I would prefer if
 * it was just automatic and natural, but maybe we can adjust it to certain
 * things. For example … in a final, you get a big, longer build-up in the 90th
 * minute." Automatic is the default (the match's own minute and score); these
 * three dials are on the test pages only, never in Settings, stored on this
 * phone (lib/star/fhr/builders.ts). The career never reads them.
 *
 *   Moment     Auto (the match's) · Normal · Big (a level final, 90th minute)
 *   Length     Short · Auto · Long
 *   Intensity  Calm · Auto · High (quicker touches, a tighter press)
 *
 * `useFhrBuildUps` gives a page the builder to hand EnginePlay's `leadIn` —
 * the career's own, with these dials — and the dials' state.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useFhrMode } from "@/lib/star/fhr/toggle";
import { setLookRow } from "@/lib/star/lookRows";
import { FHR_ADJUST_AUTO, type FhrAdjust } from "@/lib/star/fhr/buildUp";
import { loadFhrAdjust, saveFhrAdjust, testAreaBuildUp } from "@/lib/star/fhr/builders";

export function useFhrBuildUps() {
  const [adjust, setAdjust] = useState<Required<FhrAdjust>>({ ...FHR_ADJUST_AUTO });
  useEffect(() => { setAdjust(loadFhrAdjust()); }, []);
  const ref = useRef(adjust);
  ref.current = adjust;
  const set = (p: FhrAdjust) => {
    const next = { ...ref.current, ...p } as Required<FhrAdjust>;
    ref.current = next;
    saveFhrAdjust(next);
    setAdjust(next);
  };
  // One function for the life of the page: the match asks it at every chance.
  const builder = useMemo(() => testAreaBuildUp(() => ref.current), []);
  return { adjust, set, builder };
}

const ROWS: { key: keyof FhrAdjust; label: string; opts: [string, string][] }[] = [
  { key: "moment", label: "Moment", opts: [["auto", "Auto"], ["normal", "Normal"], ["big", "Big: final, 90'"]] },
  { key: "length", label: "Length", opts: [["short", "Short"], ["auto", "Auto"], ["long", "Long"]] },
  { key: "intensity", label: "Intensity", opts: [["calm", "Calm"], ["auto", "Auto"], ["high", "High"]] },
];

/** The switch (this phone) and, while it is On, the three dials. Dark test-page look. */
export function FhrAdjustBar({ adjust, set }: { adjust: Required<FhrAdjust>; set: (p: FhrAdjust) => void }) {
  const on = useFhrMode() === "on";
  const chip = (active: boolean): React.CSSProperties => ({
    height: 30, padding: "0 10px", borderRadius: 8, cursor: "pointer", whiteSpace: "nowrap",
    fontSize: 12, fontWeight: 800,
    border: `1px solid ${active ? "rgba(52,211,153,0.8)" : "rgba(255,255,255,0.14)"}`,
    background: active ? "rgba(16,185,129,0.25)" : "rgba(255,255,255,0.05)",
    color: "#f2f5f9",
  });
  return (
    <div data-fhr-adjust style={{ display: "grid", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12, fontWeight: 800, color: "#f2f5f9", minWidth: 74 }}>Build-ups</span>
        <button style={chip(!on)} onClick={() => setLookRow("fhr", "off")}>Off</button>
        <button style={chip(on)} onClick={() => setLookRow("fhr", "on")}>On</button>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#f2f5f9", opacity: 0.85 }}>Full highlights rebuild, this phone</span>
      </div>
      {on && ROWS.map((r) => (
        <div key={r.key} style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: "#f2f5f9", minWidth: 74 }}>{r.label}</span>
          {r.opts.map(([v, l]) => (
            <button key={v} style={chip(adjust[r.key] === v)} onClick={() => set({ [r.key]: v } as FhrAdjust)}>{l}</button>
          ))}
        </div>
      ))}
    </div>
  );
}
