"use client";

/**
 * RETIREMENT PREVIEW — the test page (Leo, 5 Oct 2026: "give me the
 * opportunity to preview the retirement or end of career easily, because I
 * don't want to have to play 15 seasons … just to test out the retirement
 * feature").
 *
 * Pick a made-up finished career (lib/star/retirementPreview.ts) or one of
 * the saves on this device, then see the end of it: the "Do you go again?"
 * screen, the new career overview, and the old one beside it. Nothing is
 * saved — a real save is only read, and "Hang them up" here retires a copy.
 */
import { useEffect, useMemo, useState } from "react";
import PageGuide from "@/components/admin/PageGuide";
import { pitchFont } from "@/components/star/ui/pitchFont";
import "@/components/star/ui/flat.css";
import CareerOverview from "@/components/star/CareerOverview";
import { RetirementChoice, LegacyScreen } from "@/components/star/Retirement";
import { previewCareer, PREVIEW_SHAPES, type PreviewShape } from "@/lib/star/retirementPreview";
import { retire } from "@/lib/star/retirement";
import { peekDeviceSaves } from "@/lib/star/storage";
import type { CareerState } from "@/lib/star/types";

type Source = { kind: "shape"; shape: PreviewShape } | { kind: "save"; key: string };
type View = "menu" | "choice" | "overview" | "old";

export default function RetirementPreviewPage() {
  const [source, setSource] = useState<Source>({ kind: "shape", shape: "legend" });
  const [seed, setSeed] = useState(1);
  const [view, setView] = useState<View>("menu");
  const [saves, setSaves] = useState<{ key: string; career: CareerState }[]>([]);
  // Read once, after the page is in the browser (localStorage).
  useEffect(() => { setSaves(peekDeviceSaves()); }, []);

  const base = useMemo<CareerState | null>(() => {
    if (source.kind === "shape") return previewCareer(source.shape, seed);
    return saves.find(s => s.key === source.key)?.career ?? null;
  }, [source, seed, saves]);
  // The finished version: a made-up career already is; a real save is
  // retired IN MEMORY only (never written back).
  const finished = useMemo<CareerState | null>(() => {
    if (!base) return null;
    if (base.retired) return base;
    try { return retire(base); } catch { return base; }
  }, [base]);

  // The game's own look (font, bars), and the game's full screen: the site's
  // menu and footer hide, exactly as on /star-dev (globals.css, data-star-game).
  const wrap = (el: React.ReactNode) => <div className={`star-root ${pitchFont.variable}`}><div data-star-game hidden />{el}</div>;
  const toMenu = () => { setView("menu"); window.scrollTo({ top: 0 }); };

  if (view === "choice" && base) {
    // The real "Do you go again?" screen, on a not-yet-retired copy.
    return wrap(
      <RetirementChoice
        career={{ ...base, retired: false }}
        onRetire={() => { setView("overview"); window.scrollTo({ top: 0 }); }}
        onPlayOn={toMenu}
      />,
    );
  }
  if (view === "overview" && finished) {
    return wrap(
      <CareerOverview
        key={`${JSON.stringify(source)}-${seed}`}
        career={finished}
        actions={[
          { icon: "‹", label: "Back", onClick: toMenu },
          { icon: "🗂️", label: "Old screen", onClick: () => { setView("old"); window.scrollTo({ top: 0 }); } },
          { icon: "🥾", label: "Retire again", onClick: () => { setView("choice"); window.scrollTo({ top: 0 }); }, primary: true },
        ]}
      />,
    );
  }
  if (view === "old" && finished) {
    return wrap(
      <div className="relative">
        <LegacyScreen career={finished} onNewCareer={() => { setView("overview"); window.scrollTo({ top: 0 }); }} />
        <button onClick={() => setView("overview")} className="fixed left-2 top-2 z-50 bg-amber-400 px-3 py-2 text-[12px] font-black uppercase text-gray-950" style={{ borderRadius: 3 }}>
          ‹ New screen
        </button>
      </div>,
    );
  }

  const chip = (on: boolean): React.CSSProperties => ({
    padding: "10px 12px", borderRadius: 4, fontWeight: 900, fontSize: 14, textAlign: "left",
    background: on ? "#facc15" : "rgba(255,255,255,.08)", color: on ? "#111" : "#fff",
    boxShadow: on ? "none" : "inset 0 0 0 1px rgba(255,255,255,.12)",
  });
  const isShape = source.kind === "shape";

  return (
    <div className="min-h-screen bg-[#0b1220] px-4 py-5 text-white">
      <div className="mx-auto max-w-sm space-y-4 pb-16">
        <div>
          <div className="text-[20px] font-black uppercase">Retirement preview</div>
          <div className="text-[14px] font-bold text-white/85">The end of a career, without playing one. Nothing is saved.</div>
        </div>

        <div className="space-y-1.5">
          <div className="text-[12px] font-black uppercase tracking-widest text-amber-300">A made-up career</div>
          {PREVIEW_SHAPES.map(s => (
            <button key={s.id} onClick={() => setSource({ kind: "shape", shape: s.id })} style={chip(isShape && source.shape === s.id)} className="kib-press block w-full">
              <div className="text-[15px] font-black uppercase">{s.label}</div>
              <div className="text-[12px] font-bold opacity-80">{s.line}</div>
            </button>
          ))}
          <div className="flex items-center gap-2 pt-1">
            <span className="text-[13px] font-black uppercase text-white/80">Version</span>
            <button onClick={() => setSeed(s => Math.max(1, s - 1))} style={chip(false)} aria-label="Previous version">◀</button>
            <span className="w-8 text-center text-[18px] font-black tabular-nums">{seed}</span>
            <button onClick={() => setSeed(s => s + 1)} style={chip(false)} aria-label="Next version">▶</button>
            <span className="text-[12px] font-bold text-white/60">same shape, other numbers</span>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="text-[12px] font-black uppercase tracking-widest text-amber-300">Your saves on this device</div>
          {saves.length === 0 && <div className="text-[13px] font-bold text-white/60">None on this browser.</div>}
          {saves.map(s => {
            const c = s.career;
            const on = source.kind === "save" && source.key === s.key;
            return (
              <button key={s.key} onClick={() => setSource({ kind: "save", key: s.key })} style={chip(on)} className="kib-press block w-full">
                <div className="text-[15px] font-black uppercase">{c.player.firstName} {c.player.lastName}</div>
                <div className="text-[12px] font-bold opacity-80">{c.player.club || "No club yet"} · season {c.season} · age {c.player.age}{c.retired ? " · retired" : ""}</div>
              </button>
            );
          })}
        </div>

        <div className="space-y-2">
          <button disabled={!base} onClick={() => { setView("choice"); window.scrollTo({ top: 0 }); }} className="kib-press block w-full bg-amber-400 px-3 py-3 text-left text-[15px] font-black uppercase text-gray-950 disabled:opacity-40" style={{ borderRadius: 4 }}>
            ▶ Retire screen, then the overview
          </button>
          <button disabled={!finished} onClick={() => { setView("overview"); window.scrollTo({ top: 0 }); }} className="kib-press block w-full bg-emerald-600 px-3 py-3 text-left text-[15px] font-black uppercase disabled:opacity-40" style={{ borderRadius: 4 }}>
            ▶ Straight to the new overview
          </button>
          <button disabled={!finished} onClick={() => { setView("old"); window.scrollTo({ top: 0 }); }} className="kib-press block w-full bg-white/10 px-3 py-3 text-left text-[15px] font-black uppercase disabled:opacity-40" style={{ borderRadius: 4 }}>
            ▶ The old end screen (today&apos;s)
          </button>
        </div>
      </div>
      <PageGuide page="/star-retirement-dev" corner="bottom-left" />
    </div>
  );
}
