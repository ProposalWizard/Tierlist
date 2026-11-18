"use client";

import { useState } from "react";
import Link from "next/link";

/**
 * "Join the beta": one email box (Harry, 12 Nov 2026: "try the beta, sign
 * up"). Sends to /api/beta-signup, which keeps the address in the
 * `beta_signups` table (supabase/migrations/beta_signups.sql). Until that
 * table exists the form says "Sign-ups open soon" and keeps nothing.
 */
type State = "idle" | "sending" | "done" | "soon" | "bad" | "slow" | "error";

const MESSAGE: Record<Exclude<State, "idle" | "sending">, string> = {
  done: "You're on the list. We'll email you about the beta.",
  soon: "Sign-ups open soon. Please try again in a few days.",
  bad: "That email doesn't look right. Check it and try again.",
  slow: "Too many tries. Please wait a few minutes.",
  error: "That didn't send. Please try again.",
};

export default function BetaSignup() {
  const [email, setEmail] = useState("");
  const [trap, setTrap] = useState("");
  const [state, setState] = useState<State>("idle");

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (state === "sending") return;
    const value = email.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(value) || value.length > 254) { setState("bad"); return; }
    setState("sending");
    try {
      const res = await fetch("/api/beta-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: value, website: trap }),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; reason?: string } | null;
      if (data?.ok) setState("done");
      else if (data?.reason === "soon") setState("soon");
      else if (data?.reason === "bad") setState("bad");
      else if (data?.reason === "slow") setState("slow");
      else setState("error");
    } catch {
      setState("error");
    }
  }

  if (state === "done") {
    return <p className="kh-beta-msg kh-beta-ok" role="status" data-beta-state="done"><Tick />{MESSAGE.done}</p>;
  }

  return (
    <form className="kh-beta-form" onSubmit={send} noValidate>
      <label className="kh-sr" htmlFor="kh-beta-email">Your email</label>
      <div className="kh-beta-row">
        <input
          id="kh-beta-email"
          className="kh-beta-input"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          maxLength={254}
          onChange={(e) => { setEmail(e.target.value); if (state !== "idle" && state !== "sending") setState("idle"); }}
          aria-describedby="kh-beta-note"
          aria-invalid={state === "bad"}
        />
        {/* Left empty by people; filled by robots. */}
        <input className="kh-sr" tabIndex={-1} autoComplete="off" aria-hidden name="website" value={trap} onChange={(e) => setTrap(e.target.value)} />
        <button className="kh-beta-btn" type="submit" disabled={state === "sending"}>
          {state === "sending" ? "Sending" : "Join the beta"}
        </button>
      </div>
      {state !== "idle" && state !== "sending" ? (
        <p className={`kh-beta-msg ${state === "soon" ? "kh-beta-soon" : "kh-beta-warn"}`} role="status" data-beta-state={state}>{MESSAGE[state]}</p>
      ) : (
        <p id="kh-beta-note" className="kh-beta-note">
          Only used to tell you about the beta. <Link href="/legal">Privacy</Link>
        </p>
      )}
    </form>
  );
}

function Tick() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}
