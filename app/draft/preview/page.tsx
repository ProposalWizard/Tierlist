"use client";

// DESIGN PREVIEW — sample data only. Not linked anywhere and not used by the
// real game. Visit /draft/preview to review the redesigns, then decide whether
// to make them official.

import { useState } from "react";
import PreviewLeagueTable from "@/components/draft/preview/PreviewLeagueTable";
import PreviewFormation from "@/components/draft/preview/PreviewFormation";

export default function DesignPreviewPage() {
  const [tab, setTab] = useState<"table" | "xi">("table");

  return (
    <div className="min-h-screen bg-[#060911] px-4 py-8">
      <div className="mx-auto max-w-2xl">
        {/* Preview banner */}
        <div className="mb-5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-center">
          <p className="text-xs font-black uppercase tracking-widest text-amber-400">Design Preview</p>
          <p className="mt-1 text-[11px] text-white/60">
            Sample data · not linked to the live game. Nothing here affects real play.
          </p>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex justify-center gap-2">
          <button
            onClick={() => setTab("table")}
            className={`rounded-lg px-4 py-2 text-sm font-bold transition ${
              tab === "table" ? "bg-emerald-600 text-white" : "bg-gray-800 text-gray-400 hover:text-white"
            }`}
          >
            League Table
          </button>
          <button
            onClick={() => setTab("xi")}
            className={`rounded-lg px-4 py-2 text-sm font-bold transition ${
              tab === "xi" ? "bg-emerald-600 text-white" : "bg-gray-800 text-gray-400 hover:text-white"
            }`}
          >
            Starting XI
          </button>
        </div>

        {tab === "table" ? <PreviewLeagueTable /> : <PreviewFormation />}
      </div>
    </div>
  );
}
