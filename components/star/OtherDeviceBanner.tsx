"use client";

import { useEffect, useState } from "react";
import { getOtherDeviceWarning, onOtherDeviceWarningChange } from "@/lib/star/storage";
import type { OtherDeviceWarning } from "@/lib/star/saveClash";

/**
 * "This career is open on your phone right now" — Harry, 30 Sep 2026.
 *
 * When a save is opened and the cloud copy was written by a DIFFERENT device
 * in the last ten minutes (RECENT_OTHER_DEVICE_MS, lib/star/saveClash.ts),
 * playing here too is how two different saves get made. This says so, once,
 * and gets out of the way: nothing is blocked, Continue just closes it.
 *
 * Mounted from app/star-dev/layout.tsx, like SaveFailedBanner, so page.tsx
 * only has to load the career. The warning itself is set by
 * reconcileCareerLoad (lib/star/storage.ts) on every load.
 */
export default function OtherDeviceBanner() {
  const [warn, setWarn] = useState<OtherDeviceWarning | null>(null);
  const [closed, setClosed] = useState<OtherDeviceWarning | null>(null);

  useEffect(() => {
    setWarn(getOtherDeviceWarning());
    return onOtherDeviceWarningChange(setWarn);
  }, []);

  if (!warn || warn === closed) return null;
  const where = warn.device === "computer" ? "your computer" : `your ${warn.device}`;
  const ago = warn.minutesAgo <= 0 ? "just now" : warn.minutesAgo === 1 ? "1 minute ago" : `${warn.minutesAgo} minutes ago`;

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="other-device-banner"
      className="fixed inset-x-0 top-0 z-[100] flex justify-center px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pointer-events-none"
    >
      <div
        className="pointer-events-auto w-full max-w-md rounded-2xl p-3 text-white"
        style={{
          background: "linear-gradient(180deg, rgba(120,53,15,.97), rgba(69,26,3,.97))",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,.14), inset 0 0 0 1px rgba(251,191,36,.55), 0 12px 28px -10px rgba(0,0,0,.85)",
        }}
      >
        <div className="flex items-start gap-2.5">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[16px]" style={{ background: "rgba(251,191,36,.22)", boxShadow: "inset 0 0 0 1px rgba(251,191,36,.55)" }} aria-hidden>
            {warn.device === "computer" ? "💻" : "📱"}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-black leading-snug">
              This career is open on {where} right now
              <span className="font-bold text-amber-200"> (saved {ago})</span>.
            </div>
            <div className="mt-0.5 text-[12px] font-bold leading-snug text-amber-50/90">
              Playing here too can create two different saves.
            </div>
          </div>
        </div>
        <button
          data-testid="other-device-continue"
          onClick={() => setClosed(warn)}
          className="mt-2.5 w-full rounded-xl py-2 text-[12.5px] font-black uppercase tracking-wide text-amber-950 active:scale-95"
          style={{ background: "linear-gradient(180deg, #fde68a, #fbbf24 55%, #d97706)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.6)" }}
        >
          Continue
        </button>
      </div>
    </div>
  );
}
