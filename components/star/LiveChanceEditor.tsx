"use client";

/**
 * EDIT THE CHANCE YOU ARE PLAYING — Infinite Match's editor.
 *
 * Asked for directly: "in the infinite highlights and play area, you should be
 * able to edit the scenarios that you're in mid-game … when you press save
 * there, it should save it into the scenario section of that highlight type
 * and then be able to commit as well."
 *
 * Opens over the match on the chance it just served you, as it stood before
 * the kick (the match stops still while you aim, so nothing is missed). The
 * live picture becomes an ordinary gallery card of its kind — see
 * lib/star/liveEdit.ts — so Save puts it in that kind's list for everyone,
 * exactly as the gallery's own Save does, and Commit puts it in the game.
 * The match underneath is left alone: close this and carry on playing.
 */

import { useMemo, useState } from "react";
import EditableFrame from "./EditableFrame";
import type { Scenario } from "@/lib/star/canvasEngine";
import { cardForLive, liveMatchScenario } from "@/lib/star/liveEdit";
import {
  applyOverride, addFigureTo, removeFigureFrom, hasEdits, type PosOverride,
} from "@/lib/star/scenarioEdit";
import { saveScenarioShared } from "@/lib/star/scenarioStore";

const INK = "#f2f5f9";
const MUTED = "#8a97aa";
const kindLabel = (k: string) => k.replace(/_/g, " ");

export default function LiveChanceEditor({ scenario, minute, onClose }: {
  scenario: Scenario;
  minute: number;
  onClose: () => void;
}) {
  const card = useMemo(() => cardForLive(scenario), [scenario]);
  // The live picture itself is what you edit; the card's own drag (the part
  // that turns its base into this picture) sits underneath and is kept.
  const baseFrame = useMemo(() => applyOverride(card.base, card.override), [card]);
  const [drag, setDrag] = useState<PosOverride | undefined>(undefined);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState<"saving" | "committing" | null>(null);
  const [flash, setFlash] = useState<{ ok: boolean; text: string } | null>(null);

  const frame = applyOverride(baseFrame, drag);
  // Same helper the match screen's own Save/Commit use — see liveEdit.ts.
  const asSaved = () => liveMatchScenario(scenario, minute, drag, card);
  const selected = frame.items.find((it) => it.id === selectedId);

  const save = async (): Promise<boolean> => {
    setBusy("saving");
    const res = await saveScenarioShared(asSaved());
    setBusy(null);
    setFlash(res.ok
      ? { ok: true, text: `Saved as a ${kindLabel(scenario.kind)} scenario — it is in the gallery now.` }
      : { ok: false, text: `Not saved — ${res.message}` });
    return res.ok;
  };

  const commit = async () => {
    setBusy("committing");
    try {
      const r = await fetch("/api/star/scenarios/commit", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario: asSaved() }),
      });
      const d = await r.json().catch(() => ({})) as { ok?: boolean; error?: string; message?: string };
      setFlash(r.ok && d.ok
        ? { ok: true, text: d.message ?? "Committed — it is in the game." }
        : { ok: false, text: `Not committed — ${d.error ?? r.status}` });
    } catch {
      setFlash({ ok: false, text: "Not committed — couldn't reach the server." });
    }
    setBusy(null);
  };

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 40, background: "#05070d", overflowY: "auto" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 460, margin: "0 auto", padding: "14px 12px 30px", display: "grid", gap: 10, justifyItems: "center" }}
      >
        <div style={{ width: "100%", display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ flex: 1, fontSize: 16, fontWeight: 800, color: INK, textTransform: "capitalize" }}>
            {kindLabel(scenario.kind)} · {minute}&apos;
          </div>
          <button style={btn} onClick={onClose}>Back to the match</button>
        </div>

        <EditableFrame
          editKey="live"
          baseFrame={baseFrame}
          override={drag}
          marks={[]}
          onCommit={(_k, ov) => setDrag(ov)}
          edited={hasEdits(drag)}
          selectedId={selectedId}
          onSelect={setSelectedId}
          fit
        />

        {/* Pinned to the bottom of the editor while you scroll: on a phone
            Save and Commit sat below the fold inside this overlay (Remove at
            614–656, Save at 666–718 on a 664 px screen). */}
        <div style={{
          position: "sticky", bottom: 0, zIndex: 2, width: "100%", display: "grid", gap: 8,
          padding: "8px 0 calc(8px + env(safe-area-inset-bottom))", background: "#05070d",
          borderTop: "1px solid rgba(255,255,255,0.06)",
        }}>
        <div style={{ width: "100%", display: "flex", gap: 6 }}>
          <button style={row} onClick={() => setDrag(addFigureTo(frame, "teammate", drag, [card.override]).override)}>+ Mate</button>
          <button style={row} onClick={() => setDrag(addFigureTo(frame, "opponent", drag, [card.override]).override)}>+ Opp</button>
          <button
            style={{ ...row, opacity: selected?.removable ? 1 : 0.4 }}
            disabled={!selected?.removable}
            onClick={() => { if (selectedId) { setDrag(removeFigureFrom(selectedId, drag)); setSelectedId(null); } }}
          >
            Remove
          </button>
        </div>
        <div style={{ width: "100%", display: "flex", gap: 8 }}>
          <button style={{ ...big, color: "#bbf7d0", borderColor: "rgba(34,197,94,0.45)" }} disabled={!!busy} onClick={() => void save()}>
            {busy === "saving" ? "Saving…" : "Save as a scenario"}
          </button>
          <button style={{ ...big, color: "#e0f2fe", borderColor: "rgba(56,189,248,0.45)" }} disabled={!!busy} onClick={() => void commit()}>
            {busy === "committing" ? "Committing…" : "Commit to the game"}
          </button>
        </div>
        </div>
        {flash && (
          <div style={{ fontSize: 12.5, fontWeight: 700, textAlign: "center", color: flash.ok ? "#4ade80" : "#fca5a5" }}>
            {flash.text}
          </div>
        )}
        <div style={{ fontSize: 11.5, fontWeight: 600, color: MUTED, textAlign: "center", lineHeight: 1.5 }}>
          Drag anyone, or the ball. Save adds it to this chance type in the gallery; Commit also puts it in the game.
          Opponents are red here whatever kit they wore in the match.
        </div>
      </div>
    </div>
  );
}

const btn: React.CSSProperties = {
  height: 38, padding: "0 12px", borderRadius: 12, cursor: "pointer",
  border: "1px solid rgba(255,255,255,0.09)", background: "rgba(255,255,255,0.05)",
  color: INK, fontSize: 12.5, fontWeight: 700, whiteSpace: "nowrap",
};
const row: React.CSSProperties = { ...btn, flex: 1, height: 42 };
const big: React.CSSProperties = { ...btn, flex: 1, height: 52, fontSize: 13.5, fontWeight: 800 };
