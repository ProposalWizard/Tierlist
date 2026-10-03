"use client";
import { useEffect, useState } from "react";
import { setConfirmListener, type ConfirmAsk } from "@/lib/star/askConfirm";

/** The game's own "Are you sure?" (lib/star/askConfirm.ts). Mounted once in
 *  app/star-dev/layout.tsx. A dark sheet, the question, No and the action. */
export default function ConfirmHost() {
  const [ask, setAsk] = useState<ConfirmAsk | null>(null);
  useEffect(() => {
    setConfirmListener(setAsk);
    return () => setConfirmListener(null);
  }, []);
  if (!ask) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[200] flex items-end justify-center bg-black/70 p-3 sm:items-center"
      onClick={() => ask.resolve(false)}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-white/15 bg-[#0d1424] p-4 text-white shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <p className="text-[15px] font-bold leading-snug">{ask.text}</p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            onClick={() => ask.resolve(false)}
            className="kib-press rounded-xl bg-white/10 py-3 text-[13px] font-black uppercase tracking-widest text-white"
          >
            No
          </button>
          <button
            onClick={() => ask.resolve(true)}
            className="kib-press rounded-xl bg-red-600 py-3 text-[13px] font-black uppercase tracking-widest text-white"
          >
            {ask.yes}
          </button>
        </div>
      </div>
    </div>
  );
}
