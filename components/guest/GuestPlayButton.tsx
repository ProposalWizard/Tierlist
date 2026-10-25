"use client";

/**
 * components/guest/GuestPlayButton.tsx — "Play now, no sign-up" on the game's
 * "Sign in to play" screen (app/star-dev/page.tsx). Only rendered while
 * guestAccountsOn(). The guest account is made on the TAP, never on page load,
 * so a visitor who only looks (or a search-engine robot) makes no account.
 */

import { useState } from "react";
import { startGuest } from "@/lib/guest/start";

export default function GuestPlayButton({ onStarted }: { onStarted?: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const go = async () => {
    setBusy(true); setError(null);
    const params = new URLSearchParams(window.location.search);
    const utm: Record<string, string> = {};
    params.forEach((v, k) => { if (k.startsWith("utm_")) utm[k] = v.slice(0, 200); });
    const r = await startGuest({ landing: window.location.pathname, utm });
    if (!r.ok) { setBusy(false); setError(r.message); return; }
    if (onStarted) onStarted(); else window.location.reload();
  };
  return (
    <div>
      <button
        type="button"
        onClick={go}
        disabled={busy}
        className="inline-block w-full rounded-xl bg-emerald-500 px-5 py-3 text-sm font-black text-emerald-950 active:scale-95 disabled:opacity-60"
      >
        {busy ? "Starting…" : "Play now — no sign-up"}
      </button>
      {error && <p className="mt-2 text-xs font-bold text-amber-300">{error}</p>}
    </div>
  );
}
