"use client";

/**
 * THE TUNING PANEL — one line, folded, on the Scenario Gallery, Infinite
 * Highlights and Infinite Match (Harry, 14 Oct 2026: "make tuning somehow
 * visible in the scenario gallery/play area").
 *
 * Open, it shows what the chances seen this session add up to (the mix of
 * kinds, how far up the pitch they start, your wing, how often, the longest
 * wait), each with a bar and a plain "feels: about right / a lot / a little"
 * against the DRAFT fun ranges (lib/star/funTargets.ts). Under that, "Say
 * what feels off": chips and a line, stored with what was on screen
 * (lib/star/tuningNotes.ts).
 *
 * Reads what the pages report (lib/star/tuningSession.ts). Never touches the
 * match. No animation (menus open on the tap's own frame, 14 Oct).
 */
import { useEffect, useMemo, useState } from "react";
import { clearSeen, currentSeen, onSeenChange, summarise, type Feel, type Line, type SeenChance, type TuningPage } from "@/lib/star/tuningSession";
import { NOTE_CHIPS, makeNote, saveTuningNote, pendingNotes } from "@/lib/star/tuningNotes";

const INK = "#f2f5f9";
const MUTED = "#8a97aa";
const AMBER = "#fbbf24";
const FEEL_COLOR: Record<Feel, string> = {
  "about right": "#4ade80",
  "a lot": "#f87171",
  "a little": "#38bdf8",
  "too few to tell": MUTED,
};
const LEVEL_LABEL: Record<string, string> = {
  national: "National League", league_two: "League Two", league_one: "League One",
  championship: "Championship", premier: "Premier League", europe: "Europe",
};
const kindLabel = (k: string) => k.replace(/_/g, " ");

export interface TuningContext { kind?: string; seed?: number; minute?: number; league?: string; position?: string }

function fmt(v: number, unit: Line["unit"]) {
  return unit === "pct" ? `${Math.round(v * 100)}%` : unit === "min" ? `${Math.round(v)} min` : v.toFixed(1);
}

/** A bar with the draft range shaded and a tick where you are. */
function RangeBar({ line }: { line: Line }) {
  const pct = (v: number) => `${Math.max(0, Math.min(100, (v / line.scale) * 100))}%`;
  const hi = Math.min(line.band.high, line.scale);
  return (
    <div style={{ position: "relative", height: 10, borderRadius: 5, background: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
      <div style={{
        position: "absolute", top: 0, bottom: 0, left: pct(line.band.low), width: `calc(${pct(hi)} - ${pct(line.band.low)})`,
        background: "rgba(74,222,128,0.22)", borderLeft: "1px solid rgba(74,222,128,0.5)", borderRight: "1px solid rgba(74,222,128,0.5)",
      }} />
      <div style={{
        position: "absolute", top: 0, bottom: 0, left: `calc(${pct(line.value)} - 2px)`, width: 4, borderRadius: 2,
        background: FEEL_COLOR[line.feel] === MUTED ? INK : FEEL_COLOR[line.feel],
      }} />
    </div>
  );
}

export default function TuningSessionPanel({ page, context }: { page: TuningPage; context?: () => TuningContext }) {
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState<SeenChance[]>([]);
  const [chips, setChips] = useState<string[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<{ ok: boolean; text: string } | null>(null);
  const [waiting, setWaiting] = useState(0);

  useEffect(() => {
    setSeen(currentSeen());
    setWaiting(pendingNotes().length);
    return onSeenChange(() => setSeen(currentSeen()));
  }, []);
  const sum = useMemo(() => summarise(seen), [seen]);

  const toggleChip = (c: string) => setChips((cs) => (cs.includes(c) ? cs.filter((x) => x !== c) : [...cs, c]));
  const canSend = (chips.length > 0 || text.trim().length > 0) && !busy;

  const send = async () => {
    if (!canSend) return;
    const ctx = context?.() ?? {};
    setBusy(true);
    const note = makeNote({
      chips, text, page: pageName(page), kind: ctx.kind, league: ctx.league, position: ctx.position,
      seed: ctx.seed, minute: ctx.minute, seen: seen.length,
    });
    const res = await saveTuningNote(note);
    setBusy(false);
    setFlash({ ok: res.where === "shared", text: res.message });
    setWaiting(pendingNotes().length);
    setChips([]);
    setText("");
  };

  const pagesLine = (["gallery", "highlights", "match"] as TuningPage[])
    .filter((p) => sum.byPage[p]).map((p) => `${sum.byPage[p]} ${PAGE_SHORT[p]}`).join(" · ");

  return (
    <div
      data-tuning-panel={open ? "open" : "closed"}
      style={{ width: "100%", maxWidth: 460, borderRadius: 14, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: INK }}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        style={{
          width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "11px 14px", minHeight: 44,
          background: "none", border: "none", color: INK, cursor: "pointer", textAlign: "left",
        }}
      >
        <span style={{ fontSize: 13.5, fontWeight: 800 }}>Tuning</span>
        <span style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 600, color: MUTED, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          · what you&apos;ve seen this session{sum.total ? ` (${sum.total})` : ""}
        </span>
        <span style={{ fontSize: 13, color: MUTED }}>{open ? "▴" : "▾"}</span>
      </button>

      {open && (
        <div style={{ padding: "0 14px 14px", display: "grid", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11.5, fontWeight: 700, color: MUTED }}>
            <span style={{ color: AMBER, border: `1px solid ${AMBER}`, borderRadius: 5, padding: "0 5px", fontWeight: 900, fontSize: 10 }}>DRAFT</span>
            <span style={{ flex: 1, minWidth: 0 }}>
              Ranges are first guesses ({LEVEL_LABEL[sum.level]}{sum.position ? `, ${sum.position}` : ""}). Green band = the range.
            </span>
          </div>

          {sum.total === 0 ? (
            <div style={{ fontSize: 12.5, fontWeight: 600, color: MUTED }}>Nothing seen yet. Play or flick through a few chances.</div>
          ) : (
            <>
              <div style={{ display: "grid", gap: 4 }}>
                <div style={{ fontSize: 11.5, fontWeight: 800, color: MUTED }}>The mix · {pagesLine}</div>
                {sum.mix.slice(0, 6).map((m) => (
                  <div key={m.kind} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 104, flex: "none", fontSize: 12, fontWeight: 700, textTransform: "capitalize", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {kindLabel(m.kind)}
                    </span>
                    <span style={{ flex: 1, height: 8, borderRadius: 4, background: "rgba(255,255,255,0.07)" }}>
                      <span style={{ display: "block", height: "100%", borderRadius: 4, width: `${Math.max(3, m.share * 100)}%`, background: "rgba(56,189,248,0.7)" }} />
                    </span>
                    <span style={{ width: 34, flex: "none", textAlign: "right", fontSize: 11.5, fontWeight: 700, color: MUTED }}>{Math.round(m.share * 100)}%</span>
                  </div>
                ))}
                {sum.mix.length > 6 && <div style={{ fontSize: 11, color: MUTED }}>+{sum.mix.length - 6} more kinds</div>}
              </div>

              {sum.lines.map((l) => (
                <div key={l.key} style={{ display: "grid", gap: 4 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {l.label} <span style={{ fontWeight: 700, color: MUTED }}>{fmt(l.value, l.unit)}</span>
                    </span>
                    <span style={{ flex: "none", fontSize: 12, fontWeight: 800, color: FEEL_COLOR[l.feel], whiteSpace: "nowrap" }}>feels: {l.feel}</span>
                  </div>
                  <RangeBar line={l} />
                  <div style={{ fontSize: 11, fontWeight: 600, color: MUTED }}>{l.plain}</div>
                </div>
              ))}
              {!sum.lines.some((l) => l.key === "perMatch") && (
                <div style={{ fontSize: 11, fontWeight: 600, color: MUTED }}>
                  How often and the longest wait show once you play Infinite Match.
                </div>
              )}
              <button onClick={clearSeen} style={{ ...chipStyle(false), justifySelf: "start", color: MUTED }}>Start the count again</button>
            </>
          )}

          <div style={{ display: "grid", gap: 8, borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 800 }}>Say what feels off</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {NOTE_CHIPS.map((c) => (
                <button key={c} onClick={() => toggleChip(c)} style={chipStyle(chips.includes(c))}>{c}</button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") void send(); e.stopPropagation(); }}
                placeholder="Or say it in your own words"
                maxLength={500}
                style={{
                  flex: 1, minWidth: 0, height: 40, borderRadius: 10, padding: "0 10px", fontSize: 16,
                  background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: INK,
                }}
              />
              <button
                onClick={() => void send()}
                disabled={!canSend}
                style={{
                  flex: "none", height: 40, padding: "0 14px", borderRadius: 10, fontSize: 13, fontWeight: 800,
                  border: "1px solid rgba(34,197,94,0.5)", background: "rgba(34,197,94,0.16)", color: "#bbf7d0",
                  opacity: canSend ? 1 : 0.4, cursor: canSend ? "pointer" : "default",
                }}
              >
                {busy ? "Saving…" : "Send"}
              </button>
            </div>
            {flash && <div style={{ fontSize: 12, fontWeight: 700, color: flash.ok ? "#4ade80" : AMBER }}>{flash.text}</div>}
            {!flash && waiting > 0 && (
              <div style={{ fontSize: 11.5, fontWeight: 700, color: AMBER }}>
                {waiting} {waiting === 1 ? "note" : "notes"} saved on this device only, waiting to send.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const PAGE_SHORT: Record<TuningPage, string> = { gallery: "in the gallery", highlights: "in highlights", match: "in the match" };
const pageName = (p: TuningPage) => (p === "gallery" ? "/star-gallery-dev" : p === "highlights" ? "/star-highlights-dev" : "/star-play-dev");

function chipStyle(on: boolean): React.CSSProperties {
  return {
    padding: "7px 11px", borderRadius: 999, cursor: "pointer", fontSize: 12.5, fontWeight: 700, minHeight: 34,
    border: `1px solid ${on ? "rgba(251,191,36,0.7)" : "rgba(255,255,255,0.12)"}`,
    background: on ? "rgba(251,191,36,0.16)" : "rgba(255,255,255,0.04)",
    color: on ? "#fde68a" : INK,
  };
}
