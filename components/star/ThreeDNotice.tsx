"use client";

import { useEffect, useState } from "react";
import { webglAvailable } from "@/lib/star/three3d/webglProbe";

const SEEN_KEY = "star-3d-notice-seen";

/**
 * "3D isn't running in this browser" — Mikey, 27 Nov 2026.
 *
 * When the browser will not give the page any WebGL, the 3D garden, shop and
 * house quietly become their flat drawn versions and the player cannot tell
 * why. This says so once per visit, in plain words, with the two fixes that
 * worked (reopen the browser; turn graphics acceleration on). Nothing is
 * blocked: the flat screens still play.
 *
 * Checked a moment after the game opens, so it never competes with loading.
 * Mounted from app/star-dev/layout.tsx.
 */
export default function ThreeDNotice() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let seen = false;
    try { seen = sessionStorage.getItem(SEEN_KEY) === "1"; } catch { /* private window */ }
    if (seen) return;
    const t = window.setTimeout(() => { if (!webglAvailable()) setShow(true); }, 2500);
    return () => window.clearTimeout(t);
  }, []);

  if (!show) return null;
  const close = () => {
    setShow(false);
    try { sessionStorage.setItem(SEEN_KEY, "1"); } catch { /* fine */ }
  };

  return (
    <div
      role="status"
      data-testid="three-d-notice"
      className="fixed inset-x-0 bottom-0 z-[99] flex justify-center px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pointer-events-none"
    >
      <div
        className="pointer-events-auto w-full max-w-md rounded-2xl p-3 text-white"
        style={{
          background: "linear-gradient(180deg, rgba(30,41,59,.98), rgba(15,23,42,.98))",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,.14), inset 0 0 0 1px rgba(148,163,184,.55), 0 12px 28px -10px rgba(0,0,0,.85)",
        }}
      >
        <div className="text-[13px] font-black leading-snug">3D isn&apos;t running in this browser</div>
        <div className="mt-0.5 text-[12px] font-bold leading-snug text-slate-200">
          The garden, shop and house show their flat versions because your browser has turned its 3D graphics off.
          The game still works.
        </div>
        <ol className="mt-1.5 list-decimal pl-5 text-[12px] font-bold leading-snug text-slate-200">
          <li>Close the browser completely (every window, not just this tab) and open it again.</li>
          <li>Still flat? Turn on graphics acceleration. In Chrome: Settings, System, &ldquo;Use graphics acceleration when available&rdquo;, then Relaunch.</li>
          <li>Still flat? Update your browser (and your graphics driver on a computer).</li>
        </ol>
        <button
          data-testid="three-d-notice-close"
          onClick={close}
          className="mt-2.5 w-full rounded-xl py-2 text-[12.5px] font-black uppercase tracking-wide text-slate-900 active:scale-95"
          style={{ background: "linear-gradient(180deg, #e2e8f0, #cbd5e1 55%, #94a3b8)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.6)" }}
        >
          Got it
        </button>
      </div>
    </div>
  );
}
