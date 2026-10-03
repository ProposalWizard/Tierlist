"use client";

/**
 * /star-chances-dev — the NEW chance library, on its own.
 *
 * Harry, 3 Oct 2026: "these new scenarios need to be separate to the scenario
 * gallery for now please - just in case they suck." So the gallery never
 * lists or reads them, every test screen plays Classic (EnginePlay pins it,
 * lib/star/chanceSet.ts), and this is the one place to look at the new set.
 *
 * Per kind: every picture the library can serve (lib/star/chanceLibrary.ts),
 * drawn read-only with the gallery's own picture painter at the new match
 * view's framing, with the rest of both teams round it the way a match adds
 * them. Tap one to see it big and "Play this one" through EnginePlay — the
 * one way a test screen plays the game — with the pin lifted for this page.
 *
 * Nothing here saves or commits. There is no Save and no Commit button, and a
 * chance served from the library is refused by every Save/Commit path anyway
 * (lib/star/libraryMark.ts).
 *
 * Gated like the other dev sandboxes: admins, or a local development build.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import PageGuide from "@/components/admin/PageGuide";
import EnginePlay, { usePlayWidth } from "@/components/star/EnginePlay";
import { offlineDevPlayEnabled } from "@/lib/star/devMode";
import { libraryFor, libraryKinds, serveEntry, type LibEntry } from "@/lib/star/chanceLibrary";
import { markNewChance } from "@/lib/star/libraryMark";
import { buildScenario, type Scenario, type ScenarioKind } from "@/lib/star/canvasEngine";
import { mulberry32 } from "@/lib/star/season";
import { formationOf } from "@/lib/star/formations";
import { PLAYSTYLES, type Playstyle as BlockStyle } from "@/lib/star/playstyle";
import { frameForNewView } from "@/lib/star/matchView";
import { frameFromScenario, paint } from "@/lib/star/scenarioFrame";

const INK = "#f2f5f9";
const MUTED = "#8a97aa";
const kindLabel = (k: string) => k.replace(/_/g, " ");

/** The phone the library was drawn for: the new view's 38 m across, 71 m tall
 *  (scripts/chance-library.mts). */
const HW = 71 / 38;

/** The opponent's shape round each picture turns over picture by picture,
 *  exactly as the library's contact sheets did, so all of them get seen. */
const FORMS = ["433", "4231", "442", "352", "4321", "4141", "3421"];
const STYLES: BlockStyle[] = ["mid-block", "low-block", "high-press", "possession", "counter"];
const shapeFor = (i: number) => ({ form: FORMS[i % FORMS.length], style: STYLES[i % STYLES.length] });

/** One library picture, served the way the match serves it: the engine's own
 *  build, the picture laid on, the rest of both teams added. Fresh each call,
 *  so playing it never changes the picture. */
function servedPicture(kind: string, e: LibEntry, i: number): Scenario {
  const sc = buildScenario(kind as ScenarioKind, mulberry32(e.seed), 62, 60, 55);
  const { form, style } = shapeFor(i);
  serveEntry(sc, e, { keeperStrength: 62, context: { formation: formationOf(form), playstyle: PLAYSTYLES[style] } });
  markNewChance(sc, { from: "library", id: e.id });
  return sc;
}

/** The picture at the new match view's framing, painted once. */
function Picture({ kind, entry, index, width }: { kind: string; entry: LibEntry; index: number; width: number }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const sc = servedPicture(kind, entry, index);
    frameForNewView(sc, HW);
    paint(c, frameFromScenario(sc), { baseW: width, maxW: width, maxH: Math.round(width * 2.4) });
  }, [kind, entry, index, width]);
  return <canvas ref={ref} style={{ display: "block", borderRadius: 8 }} />;
}

const PAGE = 24;

export default function StarChancesDevPage() {
  const [gate, setGate] = useState<"loading" | "ok" | "denied">("loading");
  useEffect(() => {
    if (offlineDevPlayEnabled()) { setGate("ok"); return; }
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { setGate("denied"); return; }
      try {
        const res = await fetch("/api/profile/admin-check");
        const d = res.ok ? await res.json() : { isAdmin: false };
        setGate(d.isAdmin ? "ok" : "denied");
      } catch { setGate("denied"); }
    });
  }, []);

  if (gate === "loading") return <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center text-sm">Loading…</div>;
  if (gate === "denied") {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center text-center px-4">
        <div><div className="text-lg font-black mb-1">Admin only</div><div className="text-sm text-gray-400">This is a development sandbox.</div></div>
      </div>
    );
  }
  return (
    <>
      <Library />
      <PageGuide page="/star-chances-dev" />
    </>
  );
}

function Library() {
  const kinds = useMemo(() => libraryKinds(), []);
  const counts = useMemo(() => Object.fromEntries(kinds.map((k) => [k, libraryFor(k).length])), [kinds]);
  const total = kinds.reduce((s, k) => s + counts[k], 0);
  const [kind, setKind] = useState<string>(kinds[0] ?? "");
  const [shown, setShown] = useState(PAGE);
  const [open, setOpen] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [playKey, setPlayKey] = useState(0);
  const entries = useMemo(() => libraryFor(kind), [kind]);
  const playW = usePlayWidth();
  // The open picture fills the card: the screen less the page and card padding.
  const [bigW, setBigW] = useState(340);
  useEffect(() => {
    const on = () => setBigW(Math.max(240, Math.min(400, Math.min(460, window.innerWidth) - 46)));
    on();
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);

  const pick = (k: string) => { setKind(k); setShown(PAGE); setOpen(null); setPlaying(false); };
  const openOne = (i: number) => { setOpen(i); setPlaying(false); window.scrollTo({ top: 0 }); };
  const chosen = open !== null ? entries[open] : null;

  return (
    <div style={{ minHeight: "100vh", background: "#05070d", color: INK }}>
      <div style={{ maxWidth: 460, margin: "0 auto", padding: "12px 12px 40px" }}>
        <div style={{ fontSize: 17, fontWeight: 800 }}>New Chances</div>
        <p style={{ margin: "4px 0 10px", fontSize: 12.5, fontWeight: 600, color: MUTED, lineHeight: 1.45 }}>
          The new chance library: {total} pictures in {kinds.length} kinds. Kept apart from the Scenario Gallery on
          purpose. Nothing here saves or commits.
        </p>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {kinds.map((k) => (
            <button
              key={k}
              onClick={() => pick(k)}
              style={{
                ...chip,
                background: k === kind ? "rgba(56,189,248,0.18)" : "rgba(255,255,255,0.05)",
                borderColor: k === kind ? "rgba(56,189,248,0.6)" : "rgba(255,255,255,0.1)",
              }}
            >
              <span style={{ textTransform: "capitalize" }}>{kindLabel(k)}</span>
              <span style={{ color: MUTED, marginLeft: 5 }}>{counts[k]}</span>
            </button>
          ))}
        </div>

        {chosen && open !== null && (
          <div style={{ marginTop: 12, padding: 10, borderRadius: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", display: "grid", gap: 8, justifyItems: "center" }}>
            <div style={{ width: "100%", display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 800, textTransform: "capitalize" }}>
                {kindLabel(kind)} #{open + 1}
                <div style={{ fontSize: 11, fontWeight: 600, color: MUTED, textTransform: "none" }}>
                  {chosen.id} · from {chosen.src.replace(/^gen:/, "the generator: ")} · their shape {shapeFor(open).form}, {shapeFor(open).style}
                </div>
              </div>
              <button style={btn} onClick={() => { setOpen(null); setPlaying(false); }}>Close</button>
            </div>
            {playing ? (
              <EnginePlay
                key={`${kind}-${chosen.id}-${playKey}`}
                newChances
                bare
                width={playW}
                openOn={() => servedPicture(kind, chosen, open)}
              />
            ) : (
              <Picture kind={kind} entry={chosen} index={open} width={bigW} />
            )}
            <div style={{ width: "100%", display: "flex", gap: 8 }}>
              <button
                style={{ ...btn, flex: 1, height: 44, color: "#bbf7d0", borderColor: "rgba(34,197,94,0.45)" }}
                onClick={() => { setPlaying((p) => !p); setPlayKey((n) => n + 1); }}
              >
                {playing ? "■ Stop" : "▶ Play this one"}
              </button>
              <button style={{ ...btn, height: 44 }} disabled={open <= 0} onClick={() => openOne(open - 1)}>‹ Prev</button>
              <button style={{ ...btn, height: 44 }} disabled={open >= entries.length - 1} onClick={() => openOne(open + 1)}>Next ›</button>
            </div>
          </div>
        )}

        <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {entries.slice(0, shown).map((e, i) => (
            <button
              key={e.id}
              onClick={() => openOne(i)}
              aria-label={`Open ${kindLabel(kind)} picture ${i + 1}`}
              style={{ padding: 4, borderRadius: 10, background: open === i ? "rgba(56,189,248,0.15)" : "rgba(255,255,255,0.03)", border: `1px solid ${open === i ? "rgba(56,189,248,0.6)" : "rgba(255,255,255,0.07)"}`, display: "grid", justifyItems: "center", gap: 3 }}
            >
              <Picture kind={kind} entry={e} index={i} width={160} />
              <span style={{ fontSize: 10.5, fontWeight: 700, color: MUTED }}>#{i + 1} · {e.id}</span>
            </button>
          ))}
        </div>
        {shown < entries.length && (
          <button style={{ ...btn, width: "100%", height: 44, marginTop: 10 }} onClick={() => setShown((n) => n + PAGE)}>
            Show {Math.min(PAGE, entries.length - shown)} more ({entries.length - shown} left)
          </button>
        )}
      </div>
    </div>
  );
}

const chip: React.CSSProperties = {
  minHeight: 36, padding: "0 10px", borderRadius: 999, border: "1px solid", color: INK,
  fontSize: 12, fontWeight: 800, display: "inline-flex", alignItems: "center",
};
const btn: React.CSSProperties = {
  minHeight: 36, padding: "0 12px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.06)", color: INK, fontSize: 13, fontWeight: 800,
};
