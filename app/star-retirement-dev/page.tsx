"use client";

/**
 * RETIREMENT PREVIEW — the test page (Leo, 5 Oct 2026: "give me the
 * opportunity to preview the retirement or end of career easily, because I
 * don't want to have to play 15 seasons … just to test out the retirement
 * feature").
 *
 * Pick a made-up career (lib/star/retirementPreview.ts) or one of the saves
 * on this device, then see each screen of the end of a career exactly as the
 * game draws it: the final-season warning (after season 19), the final
 * whistle (after season 20), the career overview, the Hall of Fame, and the
 * in-game All seasons page. Nothing is saved — a real save is only read, and
 * "Hang them up" here retires a copy.
 */
import { useEffect, useMemo, useState } from "react";
import PageGuide from "@/components/admin/PageGuide";
import { pitchFont } from "@/components/star/ui/pitchFont";
import "@/components/star/ui/flat.css";
import CareerOverview from "@/components/star/CareerOverview";
import { FinalSeasonNotice, FinalWhistle } from "@/components/star/CareerEnd";
import { HallOfFameList } from "@/components/star/HallOfFame";
import AllSeasonsNew from "@/components/star/AllSeasonsNew";
import { ScreenShell, BottomBar, BarButton } from "@/components/star/ui";
import { previewCareer, PREVIEW_SHAPES, type PreviewShape } from "@/lib/star/retirementPreview";
import { retire, CAREER_SEASONS } from "@/lib/star/retirement";
import { hallEntryFor } from "@/lib/star/hallOfFame";
import { peekDeviceSaves } from "@/lib/star/storage";
import type { CareerState } from "@/lib/star/types";

type Source = { kind: "shape"; shape: PreviewShape } | { kind: "save"; key: string };
type View = "menu" | "notice" | "whistle" | "overview" | "hall" | "hall-entry" | "seasons";

const LAST = CAREER_SEASONS ?? 20;

/** The career at a point: after `upTo` seasons (not retired), or the end. */
function careerAt(source: Source, seed: number, save: CareerState | null, upTo?: number): CareerState | null {
  if (source.kind === "shape") return previewCareer(source.shape, seed, upTo ? { upTo } : {});
  return save ? { ...save, retired: upTo ? false : save.retired } : null;
}

export default function RetirementPreviewPage() {
  const [source, setSource] = useState<Source>({ kind: "shape", shape: "legend" });
  const [seed, setSeed] = useState(1);
  const [view, setView] = useState<View>("menu");
  const [hallOpen, setHallOpen] = useState<string | null>(null);
  const [saves, setSaves] = useState<{ key: string; career: CareerState }[]>([]);
  // Read once, after the page is in the browser (localStorage).
  useEffect(() => { setSaves(peekDeviceSaves()); }, []);

  const save = source.kind === "save" ? saves.find(s => s.key === source.key)?.career ?? null : null;
  const beforeLast = useMemo(() => careerAt(source, seed, save, LAST - 1), [source, seed, save]);
  const lastSeason = useMemo(() => careerAt(source, seed, save, LAST), [source, seed, save]);
  const midway = useMemo(() => careerAt(source, seed, save, 12), [source, seed, save]);
  // The finished version: a made-up career already is; a real save is
  // retired IN MEMORY only (never written back).
  const finished = useMemo<CareerState | null>(() => {
    const c = careerAt(source, seed, save);
    if (!c) return null;
    if (c.retired) return c;
    try { return retire(c); } catch { return c; }
  }, [source, seed, save]);
  // The Hall, made up: one of each shape (nothing stored).
  const hall = useMemo(() => PREVIEW_SHAPES.map(({ id }, k) => hallEntryFor(previewCareer(id, seed), 1_000_000 - k)), [seed]);

  // The game's own look (font, bars), and the game's full screen: the site's
  // menu and footer hide, exactly as on /star-dev (globals.css, data-star-game).
  const wrap = (el: React.ReactNode) => <div className={`star-root ${pitchFont.variable}`}><div data-star-game hidden />{el}</div>;
  const go = (v: View) => { setView(v); window.scrollTo({ top: 0 }); };
  const toMenu = () => go("menu");

  if (view === "notice" && beforeLast) {
    return wrap(<FinalSeasonNotice career={beforeLast} onContinue={toMenu} />);
  }
  if (view === "whistle" && lastSeason) {
    return wrap(<FinalWhistle career={lastSeason} onRetire={() => go("overview")} />);
  }
  if (view === "overview" && finished) {
    // The same three buttons as the real game's end screen.
    return wrap(
      <CareerOverview
        key={`${JSON.stringify(source)}-${seed}`}
        career={finished}
        actions={[
          { icon: "🏛️", label: "Hall of Fame", onClick: () => go("hall") },
          { icon: "＋", label: "New career", onClick: toMenu, primary: true },
          { icon: "☰", label: "Menu", onClick: toMenu },
        ]}
      />,
    );
  }
  if (view === "hall") {
    return wrap(<HallOfFameList entries={hall} onOpen={(id) => { setHallOpen(id); go("hall-entry"); }} onBack={toMenu} />);
  }
  if (view === "hall-entry") {
    const e = hall.find(h => h.id === hallOpen);
    if (e) {
      return wrap(
        <CareerOverview
          key={e.id}
          career={e.career}
          actions={[
            { icon: "‹", label: "Hall of Fame", onClick: () => go("hall") },
            { icon: "🗑", label: "Remove", onClick: () => go("hall") },
          ]}
        />,
      );
    }
  }
  if (view === "seasons" && midway) {
    // The in-game Stats page's All seasons view, on a career 12 seasons in.
    return wrap(
      <ScreenShell glow="#38bdf8" title="" bare tone="calm" bottomBar={<BottomBar><BarButton icon="‹" label="Back" onClick={toMenu} /></BottomBar>}>
        <div className="mb-2 mt-2 text-center text-[13px] font-black uppercase tracking-wide text-white">📚 All seasons</div>
        <AllSeasonsNew career={midway} />
      </ScreenShell>,
    );
  }

  const chip = (on: boolean): React.CSSProperties => ({
    padding: "10px 12px", borderRadius: 4, fontWeight: 900, fontSize: 14, textAlign: "left",
    background: on ? "#facc15" : "rgba(255,255,255,.08)", color: on ? "#111" : "#fff",
    boxShadow: on ? "none" : "inset 0 0 0 1px rgba(255,255,255,.12)",
  });
  const isShape = source.kind === "shape";
  const button = (label: string, v: View, enabled: boolean, colour: string, dark = false) => (
    <button disabled={!enabled} onClick={() => go(v)} className={`kib-press block w-full px-3 py-3 text-left text-[15px] font-black uppercase disabled:opacity-40 ${dark ? "text-gray-950" : ""}`} style={{ borderRadius: 4, background: colour }}>
      {label}
    </button>
  );

  return (
    <div className="min-h-screen bg-[#0b1220] px-4 py-5 text-white">
      <div className="mx-auto max-w-sm space-y-4 pb-16">
        <div>
          <div className="text-[20px] font-black uppercase">Retirement preview</div>
          <div className="text-[14px] font-bold text-white/85">The end of a career, without playing one. Nothing is saved.</div>
        </div>

        <div className="space-y-1.5">
          <div className="text-[12px] font-black uppercase tracking-widest text-amber-300">A made-up career · {LAST} seasons</div>
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
          <div className="text-[12px] font-black uppercase tracking-widest text-amber-300">The screens, in order</div>
          {button(`▶ 1. After season ${LAST - 1}: final season`, "notice", !!beforeLast, "#f59e0b", true)}
          {button(`▶ 2. After season ${LAST}: the final whistle`, "whistle", !!lastSeason, "#fbbf24", true)}
          {button("▶ 3. The career overview", "overview", !!finished, "#059669")}
          {button("▶ 4. The Hall of Fame", "hall", true, "rgba(251,191,36,.25)")}
          {button("▶ In the game: All seasons page", "seasons", !!midway, "rgba(255,255,255,.1)")}
        </div>
      </div>
      <PageGuide page="/star-retirement-dev" corner="bottom-left" />
    </div>
  );
}
