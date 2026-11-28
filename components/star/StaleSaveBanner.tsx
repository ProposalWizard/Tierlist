"use client";

import { useEffect, useState } from "react";
import { getStaleSave, onStaleSaveChange, type StaleSave } from "@/lib/star/storage";

/**
 * "This career moved on somewhere else" — Mikey, 27 Nov 2026.
 *
 * The server refuses an upload that was not built on the cloud copy it would
 * replace (app/api/star/career/route.ts, lib/star/saveClash.ts
 * mayReplaceCloud). saveCareerToCloud then holds this save's uploads and
 * publishes it here. Nothing is lost: this device keeps playing its own copy
 * and the other device's copy stays in the cloud. Reloading runs the normal
 * load, which either takes the newer copy or asks which progress to keep.
 *
 * Mounted from app/star-dev/layout.tsx, like OtherDeviceBanner.
 */
export default function StaleSaveBanner() {
  const [stale, setStale] = useState<StaleSave | null>(null);

  useEffect(() => {
    setStale(getStaleSave());
    return onStaleSaveChange(setStale);
  }, []);

  if (!stale) return null;
  return (
    <div
      role="alert"
      data-testid="stale-save-banner"
      className="fixed inset-x-0 top-0 z-[100] flex justify-center px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pointer-events-none"
    >
      <div
        className="pointer-events-auto w-full max-w-md rounded-2xl p-3 text-white"
        style={{
          background: "linear-gradient(180deg, rgba(127,29,29,.97), rgba(69,10,10,.97))",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,.14), inset 0 0 0 1px rgba(248,113,113,.55), 0 12px 28px -10px rgba(0,0,0,.85)",
        }}
      >
        <div className="text-[13px] font-black leading-snug">
          This career was saved on another device since you opened it.
        </div>
        <div className="mt-0.5 text-[12px] font-bold leading-snug text-red-50/90">
          Your progress here is kept on this device but not uploaded, so the other copy stays safe.
          Reload to choose which progress to keep.
        </div>
        <button
          data-testid="stale-save-reload"
          onClick={() => { try { window.location.reload(); } catch {} }}
          className="mt-2.5 w-full rounded-xl py-2 text-[12.5px] font-black uppercase tracking-wide text-red-950 active:scale-95"
          style={{ background: "linear-gradient(180deg, #fecaca, #f87171 55%, #dc2626)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.6)" }}
        >
          Reload and choose
        </button>
      </div>
    </div>
  );
}
