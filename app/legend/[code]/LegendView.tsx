"use client";

/**
 * The shared career itself (see page.tsx). Fetched by its code; the overview
 * is the game's own (CareerOverview), so a shared career looks exactly as it
 * does in the Hall of Fame. "Compare with yours" lists the careers in the
 * Hall of Fame on THIS device (every account on it), or takes another code.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import "@/components/star/ui/flat.css";
import { pitchFont } from "@/components/star/ui/pitchFont";
import CareerOverview from "@/components/star/CareerOverview";
import { CompareFlow } from "@/components/star/LegendShare";
import { fetchLegend, legendProblem, spacedCode, type FetchedLegend } from "@/lib/star/legendShare";
import { HALL_KEY, sanitizeHallBook, type HallEntry } from "@/lib/star/hallOfFame";

/** Every Hall of Fame on this device, merged (a device can hold more than one account's). */
function hallsOnThisDevice(): HallEntry[] {
  const out = new Map<string, HallEntry>();
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(`${HALL_KEY}::`)) continue;
      const book = sanitizeHallBook(JSON.parse(localStorage.getItem(k) ?? "null"));
      for (const e of book.entries) if (!out.has(e.id)) out.set(e.id, e);
    }
  } catch { /* nothing on this device */ }
  return Array.from(out.values()).sort((a, b) => b.addedAt - a.addedAt);
}

export default function LegendView({ code }: { code: string }) {
  const [got, setGot] = useState<FetchedLegend | null>(null);
  const [comparing, setComparing] = useState(false);
  const [mine, setMine] = useState<HallEntry[]>([]);
  useEffect(() => {
    let alive = true;
    // Development only: ?preview=legend (a made-up career) shows the page
    // without the database. A production build never takes this branch.
    const preview = process.env.NODE_ENV !== "production" ? new URLSearchParams(window.location.search).get("preview") : null;
    if (preview) {
      void Promise.all([import("@/lib/star/retirementPreview"), import("@/lib/star/hallOfFame")]).then(([p, h]) => {
        const shape = (p.PREVIEW_SHAPES.find(x => x.id === preview)?.id ?? "legend");
        if (alive) setGot({ ok: true, code: "K7Q2XM", entry: h.hallEntryFor(p.previewCareer(shape, 1), 1) });
      });
    } else {
      void fetchLegend(code).then(r => { if (alive) setGot(r); });
    }
    setMine(hallsOnThisDevice());
    return () => { alive = false; };
  }, [code]);

  // The game's look, and its full screen (the site's menu and footer hide).
  const wrap = (el: React.ReactNode) => <div className={`star-root ${pitchFont.variable}`}><div data-star-game hidden />{el}</div>;

  if (!got) {
    return wrap(<div className="grid min-h-[100dvh] place-items-center bg-[#05080f] text-[12px] font-black uppercase tracking-wider text-white/70">Finding the career…</div>);
  }
  if (!got.ok) {
    return wrap(
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-[#05080f] px-6 text-center text-white" data-legend-missing>
        <div className="text-[40px]">🏟️</div>
        <div className="text-[15px] font-bold">{legendProblem(got.why)}</div>
        <Link href="/star-dev" className="kib-press px-5 py-3 text-[13px] font-black uppercase tracking-wide text-gray-950" style={{ background: "#fbbf24", borderRadius: 2 }}>Play the game</Link>
      </div>,
    );
  }
  if (comparing) {
    return wrap(<CompareFlow mine={mine} preset={got.entry} theirTag="Shared" onClose={() => setComparing(false)} />);
  }
  return wrap(
    <div data-legend={got.code}>
      <div className="fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-2 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-amber-200" style={{ background: "rgba(5,8,15,.92)", boxShadow: "inset 0 -1px 0 rgba(251,191,36,.35)" }}>
        A Knowitball legend · {spacedCode(got.code)}
      </div>
      <div className="h-6 bg-[#05080f]" />
      <CareerOverview
        career={got.entry.career}
        share={{}}
        actions={[
          { icon: "⚖️", label: "Compare", onClick: () => { setComparing(true); window.scrollTo({ top: 0 }); }, primary: true },
          { icon: "▶", label: "Play", onClick: () => { window.location.href = "/star-dev"; } },
        ]}
      />
    </div>,
  );
}
