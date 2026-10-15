"use client";
/**
 * HITBOXES — the test panel (Leo, 14 Oct 2026: "a testing area … where I can
 * see hitboxes and adjust the height of the hitboxes").
 *
 * On the test screens only (Infinite Highlights, Infinite Match). Switches
 * the New | Old hitboxes, draws every body's hitbox on the real match
 * (CanvasMatch reads "Show hitboxes", only inside the test area), and moves
 * the dials in lib/star/hitbox.ts. Everything is stored on this phone; a dial
 * takes effect on the next chance (the jump height and keeper at once).
 */
import { useEffect, useState } from "react";
import {
  HITBOX_DEFAULTS, HITBOX_RANGES, hitboxDials, setHitboxDials, resetHitboxDials,
  showHitboxes, setShowHitboxes, setHitboxes, type HitboxDials,
} from "@/lib/star/hitbox";
import { useLook, setLookRow } from "@/lib/star/lookRows";

const MUTED = "#8a97aa";

export default function HitboxPanel({ startOpen = false }: { startOpen?: boolean }) {
  const look = useLook();
  const [open, setOpen] = useState(startOpen);
  // Read from this phone after the first paint (the server has no storage).
  const [show, setShow] = useState(false);
  const [d, setD] = useState<HitboxDials>(HITBOX_DEFAULTS);
  useEffect(() => { setShow(showHitboxes()); setD({ ...hitboxDials() }); }, []);
  const isNew = look.hitboxes === "new";

  const setDial = (k: keyof HitboxDials, v: number) => {
    setHitboxDials({ [k]: v });
    setD({ ...hitboxDials() });
  };

  return (
    <div data-hitbox-panel style={{
      width: "100%", maxWidth: 460, borderRadius: 14, padding: "10px 12px",
      background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
    }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{ all: "unset", cursor: "pointer", display: "flex", width: "100%", alignItems: "center", gap: 8 }}
      >
        <span style={{ fontSize: 15, fontWeight: 800, flex: 1 }}>Hitboxes &amp; jumping</span>
        <span style={{ fontSize: 12, fontWeight: 800, color: isNew ? "#4ade80" : "#fcd34d" }}>{isNew ? "New" : "Old"}{show ? " · shown" : ""}</span>
        <span style={{ color: MUTED }}>{open ? "▴" : "▾"}</span>
      </button>
      {open && (
        <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
          <div style={{ display: "flex", gap: 6 }}>
            {(["new", "old"] as const).map((v) => (
              <button key={v} data-hitbox-version={v}
                onClick={() => { setLookRow("hitboxes", v); setHitboxes(v); }}
                style={pill(look.hitboxes === v)}>
                {v === "new" ? "New" : "Old"}
              </button>
            ))}
            <div style={{ flex: 1 }} />
            <button data-hitbox-show onClick={() => { setShowHitboxes(!show); setShow(!show); }} style={pill(show)}>
              {show ? "Hide hitboxes" : "Show hitboxes"}
            </button>
          </div>
          <div style={{ fontSize: 12.5, color: MUTED, lineHeight: 1.4 }}>
            Red: defenders. Blue: team-mates (dashed ring: a ball played to him). Yellow: in the air.
            {isNew ? "" : " Old: the dials do nothing."}
          </div>
          {(Object.keys(HITBOX_RANGES) as (keyof HitboxDials)[]).map((k) => {
            const r = HITBOX_RANGES[k];
            return (
              <label key={k} style={{ display: "grid", gap: 2, opacity: isNew ? 1 : 0.45 }}>
                <span style={{ display: "flex", fontSize: 13, fontWeight: 700 }}>
                  <span style={{ flex: 1 }}>{r.label}</span>
                  <span style={{ fontFamily: "ui-monospace, monospace", color: d[k] === HITBOX_DEFAULTS[k] ? MUTED : "#fcd34d" }}>
                    {d[k].toFixed(2)}{r.unit}
                  </span>
                </span>
                <input type="range" min={r.min} max={r.max} step={r.step} value={d[k]}
                  data-hitbox-dial={k}
                  onChange={(e) => setDial(k, Number(e.target.value))} />
              </label>
            );
          })}
          <button onClick={() => { resetHitboxDials(); setD({ ...hitboxDials() }); }} style={pill(false)}>
            Reset to defaults
          </button>
        </div>
      )}
    </div>
  );
}

const pill = (on: boolean): React.CSSProperties => ({
  padding: "7px 12px", borderRadius: 999, cursor: "pointer", fontSize: 13, fontWeight: 800,
  border: `1px solid ${on ? "rgba(56,189,248,0.6)" : "rgba(255,255,255,0.12)"}`,
  background: on ? "rgba(14,116,144,0.4)" : "rgba(255,255,255,0.04)",
  color: on ? "#e0f2fe" : "#c7d0dc",
});
