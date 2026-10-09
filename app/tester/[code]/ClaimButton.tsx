"use client";
/** The "Become a tester" button on a tester link (app/tester/[code]/page.tsx). */
import { useState } from "react";
import Link from "next/link";

const SAY: Record<string, string> = {
  joined: "Done — you're a tester. Open the career and look in Settings → Developer tab.",
  already: "You're already a tester.",
  off: "This link has just been switched off. Ask the Knowitball team for a new one.",
  unknown: "This link doesn't work. Ask the Knowitball team for a new one.",
  "not-ready": "Tester links aren't switched on yet. Try again later.",
  "signed-out": "You're signed out. Sign in, then open this link again.",
};

export default function ClaimButton({ code }: { code: string }) {
  const [state, setState] = useState<"idle" | "busy" | string>("idle");

  const claim = async () => {
    setState("busy");
    try {
      const res = await fetch("/api/tester/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const d = (await res.json().catch(() => ({}))) as { outcome?: string };
      setState(d.outcome ?? "not-ready");
    } catch {
      setState("not-ready");
    }
  };

  if (state === "idle" || state === "busy") {
    return (
      <button
        onClick={claim}
        disabled={state === "busy"}
        className="mt-4 rounded-xl bg-amber-400 px-5 py-2.5 text-sm font-black text-black disabled:opacity-60"
      >
        {state === "busy" ? "One moment…" : "Become a tester"}
      </button>
    );
  }

  const ok = state === "joined" || state === "already";
  return (
    <div className="mt-4">
      <p className={ok ? "text-emerald-300" : "text-red-300"}>{SAY[state] ?? SAY["not-ready"]}</p>
      {ok && (
        // A full page load, so the career page asks again who you are.
        <button onClick={() => window.location.assign("/star-dev")} className="mt-3 inline-block rounded-xl bg-white/10 px-5 py-2.5 text-sm font-black text-white">Open the career</button>
      )}
      {state === "signed-out" && (
        <Link href={`/auth?next=${encodeURIComponent(`/tester/${code}`)}`} className="mt-3 inline-block rounded-xl bg-white/10 px-5 py-2.5 text-sm font-black text-white">Sign in</Link>
      )}
    </div>
  );
}
