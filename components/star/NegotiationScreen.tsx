"use client";
import { useRef, useState } from "react";
import { niceMoneyStep, formatMoneyPrecise } from "@/lib/star/money";
import {
  startNegotiation, makeOffer, moodToFace,
  type NegotiationMode, type NegotiationState, type CounterpartMood,
} from "@/lib/star/negotiation";

/**
 * THE NEGOTIATION — FACE TO FACE ACROSS TWO DESKS.
 *
 * Requested directly: buying/selling a player used to just hand over a
 * fixed fee. Now it's a real back-and-forth (lib/star/negotiation.ts) —
 * this is just its presentation, the same split every other engine module
 * here keeps (VoteCeremony.tsx is the closest sibling in spirit): the
 * counterpart's mood is shown as an actual changing face, not a number or a
 * word, per the direct request ("show that on their face") — happy, neutral,
 * or visibly angry, right up to the moment they might get up and leave.
 *
 * ── Redesigned against a real concept mockup ──
 *
 * Given directly, alongside a screenshot of the screen as it stood: a
 * darker, layered stadium-glow background; the offer/asking-price rows
 * rebuilt as icon-badge cards with a big bold number instead of a plain
 * text row; the buttons rebuilt with an icon + modern gradient fill instead
 * of flat colour; Walk Away as its own bordered dark card, not a link-style
 * row. The one emoji-circle counterpart face is replaced by a real drawn
 * portrait (AgentPortrait below) with three actual moods — happy, content
 * (business-as-usual), and visibly annoyed — matching the concept's own
 * "animated style" illustrated agent rather than a generic emoji.
 */

// Requested directly: this whole screen is about real, non-round numbers
// being haggled over — a rounded "★2m" reads as a different deal from the
// "★2,500,000" the negotiation was actually conducted in. formatMoneyPrecise
// (money.ts) keeps one real decimal digit instead of flooring it away, only
// here — every other screen's own money() still uses the coarser
// formatMoney, which was a deliberate revert for balances/valuations.
function money(n: number): string {
  return formatMoneyPrecise(n);
}

/** Whose move a log line is describing — drives the colour-coding requested
 *  directly: "I should instantly know that they've come in with their
 *  offer" without having to read the sentence. Pattern-matched off the exact
 *  strings negotiation.ts's own log lines use, rather than adding a second
 *  copy of that logic there — this is presentation only. */
type LogSide = "you" | "them" | "deal" | "away";
function logSide(line: string): LogSide {
  if (/deal|close enough|split the difference/i.test(line)) return "deal";
  if (/walk|out of time/i.test(line)) return "away";
  if (/^you /i.test(line)) return "you";
  return "them";
}
const LOG_STYLE: Record<LogSide, string> = {
  you: "text-sky-300",
  them: "text-amber-300",
  deal: "text-emerald-300 font-black",
  away: "text-red-300 font-black",
};

/** Comma-grouped as you type, without fighting the caret on every keystroke —
 *  requested directly: raw digits like "1300000" don't read as obviously
 *  different from "130000" without separators. */
function formatAmountInput(n: number): string {
  return n.toLocaleString();
}

/**
 * A real drawn agent portrait, three moods — happy (deal going well,
 * genuinely smiling), content (business-as-usual, a flat "getting down to
 * business" look), and annoyed (not sad — visibly irritated, on the edge of
 * walking). Same simple flat "animated style" illustration language as the
 * rest of this game's drawn art (GardenScreen's own figures/horse), not a
 * photo or an emoji — a circular head-and-shoulders bust, business suit and
 * tie, with only the eyebrows/mouth/eye shape changing per mood so the same
 * "person" reads as reacting, not as three different people.
 */
function AgentPortrait({ mood }: { mood: CounterpartMood }) {
  const skin = "#e8b98c";
  const hair = "#8a5a2b";
  const suit = mood === "angry" ? "#3a2430" : "#2b3a52";
  const tie = mood === "happy" ? "#2e9e5b" : mood === "angry" ? "#c23b3b" : "#5b6b8a";
  const cheekTint = mood === "angry" ? "#d97a6a" : "#f2a98f";

  return (
    <svg viewBox="0 0 100 100" className="h-full w-full">
      <defs>
        <radialGradient id={`agentBg-${mood}`} cx="50%" cy="40%" r="65%">
          <stop offset="0%" stopColor={mood === "happy" ? "#1f5a3d" : mood === "angry" ? "#5a2323" : "#233047"} />
          <stop offset="100%" stopColor="#0c1220" />
        </radialGradient>
      </defs>
      <circle cx="50" cy="50" r="50" fill={`url(#agentBg-${mood})`} />

      {/* shoulders / suit */}
      <path d="M 14,100 C 16,78 30,68 50,68 C 70,68 84,78 86,100 Z" fill={suit} />
      <path d="M 40,72 L 50,84 L 60,72 L 54,68 L 46,68 Z" fill="#f4f1ea" />
      <path d="M 50,84 L 46,74 L 50,78 L 54,74 Z" fill={tie} />

      {/* neck */}
      <rect x="43" y="56" width="14" height="16" rx="4" fill={skin} />

      {/* head */}
      <ellipse cx="50" cy="42" rx="21" ry="23" fill={skin} />

      {/* ears */}
      <circle cx="29" cy="43" r="3.4" fill={skin} />
      <circle cx="71" cy="43" r="3.4" fill={skin} />

      {/* hair */}
      <path d="M 29,38 C 27,20 40,12 50,12 C 60,12 73,20 71,38 C 68,28 60,24 50,24 C 40,24 32,28 29,38 Z" fill={hair} />
      <path d="M 29,38 C 27,30 30,26 33,24 C 30,29 30,34 31,39 Z" fill={hair} />
      <path d="M 71,38 C 73,30 70,26 67,24 C 70,29 70,34 69,39 Z" fill={hair} />

      {/* cheeks — a little warmer/redder when annoyed */}
      <ellipse cx="37" cy="49" rx="4.2" ry="2.6" fill={cheekTint} opacity="0.55" />
      <ellipse cx="63" cy="49" rx="4.2" ry="2.6" fill={cheekTint} opacity="0.55" />

      {/* eyebrows — the main mood signal along with the mouth */}
      {mood === "angry" ? (
        <>
          <path d="M 33,36 L 43,39" stroke="#3a2a18" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M 67,36 L 57,39" stroke="#3a2a18" strokeWidth="2.4" strokeLinecap="round" />
        </>
      ) : mood === "happy" ? (
        <>
          <path d="M 33,38 C 37,35 41,35 44,37" stroke="#3a2a18" strokeWidth="2.2" strokeLinecap="round" fill="none" />
          <path d="M 67,38 C 63,35 59,35 56,37" stroke="#3a2a18" strokeWidth="2.2" strokeLinecap="round" fill="none" />
        </>
      ) : (
        <>
          <path d="M 33,37 L 44,37.5" stroke="#3a2a18" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M 67,37 L 56,37.5" stroke="#3a2a18" strokeWidth="2.2" strokeLinecap="round" />
        </>
      )}

      {/* eyes */}
      {mood === "happy" ? (
        <>
          <path d="M 34,44 C 36,41.5 40,41.5 42,44" stroke="#2a1c10" strokeWidth="2.2" strokeLinecap="round" fill="none" />
          <path d="M 58,44 C 60,41.5 64,41.5 66,44" stroke="#2a1c10" strokeWidth="2.2" strokeLinecap="round" fill="none" />
        </>
      ) : (
        <>
          <ellipse cx="38" cy="44" rx="2.6" ry={mood === "angry" ? 2.1 : 2.6} fill="#2a1c10" />
          <ellipse cx="62" cy="44" rx="2.6" ry={mood === "angry" ? 2.1 : 2.6} fill="#2a1c10" />
        </>
      )}

      {/* mouth */}
      {mood === "happy" ? (
        <path d="M 38,54 C 43,60 57,60 62,54" stroke="#5a2a1c" strokeWidth="2.4" strokeLinecap="round" fill="none" />
      ) : mood === "angry" ? (
        <path d="M 39,57 C 44,54.5 56,54.5 61,57" stroke="#5a2a1c" strokeWidth="2.4" strokeLinecap="round" fill="none" />
      ) : (
        <path d="M 40,56 L 60,56" stroke="#5a2a1c" strokeWidth="2.4" strokeLinecap="round" />
      )}
    </svg>
  );
}

const FACE_RING: Record<CounterpartMood, string> = {
  happy: "border-emerald-400/70 shadow-[0_0_18px_-4px_rgba(16,185,129,0.7)]",
  neutral: "border-slate-500/60",
  angry: "border-red-500/70 shadow-[0_0_18px_-4px_rgba(239,68,68,0.7)]",
};
const MOOD_LABEL: Record<CounterpartMood, string> = {
  happy: "Feeling good about this",
  neutral: "Getting down to business",
  angry: "Losing patience",
};

export default function NegotiationScreen({
  mode, playerName, marketValue, counterpartLabel, initialState, onStepAway, onDone,
}: {
  mode: NegotiationMode;
  playerName: string;
  marketValue: number;
  /** A real destination club's name, when one's known (a boardroom sale
   *  through transferMarket.ts's interested-clubs list always has one) —
   *  shown in place of the generic "Interested Buyer"/"Their Agent" label.
   *  Requested directly, 14 Sep 2026: negotiating no longer means haggling
   *  with a nameless buyer. */
  counterpartLabel?: string;
  /** Resume a negotiation stepped away from earlier (see `onStepAway`)
   *  instead of opening a fresh one — the exact state as it was left,
   *  including the log and their current position. */
  initialState?: NegotiationState;
  /** Requested directly, 14 Sep 2026: "you should be able to go back" to
   *  check other interested clubs mid-negotiation without losing this one —
   *  only offered while a real deal is still live (`state.status ===
   *  "negotiating"`); an actual rejection or walkout is a real, final
   *  failure, not a pause, and has no step-away option. Absent means this
   *  screen has nowhere to save state to (e.g. signing, which has no
   *  "other candidates" list to step back to) — the button simply isn't
   *  shown. */
  onStepAway?: (state: NegotiationState) => void;
  /** `null` on the caller's side means "no deal" (rejected or walked away). */
  onDone: (finalPrice: number | null) => void;
}) {
  const [state, setState] = useState<NegotiationState>(() => initialState ?? startNegotiation(marketValue, mode, Math.random));
  const [amount, setAmount] = useState(() => state.yourPosition);
  const holdRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Requested directly: the old +/- arrows moved by ★1 per click — with
  // amounts running into the millions, that's meaningless even held down
  // for a while. Steps now widen with the amount itself (niceMoneyStep,
  // same "clean numbers" idea as the Casino's own bet-amount stepper), and
  // holding the button repeats it — typing an exact number directly is
  // still completely free-form, this only governs the +/- buttons.
  const nudge = (dir: 1 | -1) => setAmount(a => Math.max(1, a + dir * niceMoneyStep(a)));
  const startHold = (dir: 1 | -1) => {
    nudge(dir);
    stopHold();
    holdRef.current = setInterval(() => nudge(dir), 120);
  };
  const stopHold = () => {
    if (holdRef.current) { clearInterval(holdRef.current); holdRef.current = null; }
  };
  const mood = moodToFace(state);
  const verb = mode === "buying" ? "You're offering" : "You're asking";
  const theirVerb = mode === "buying" ? "Their asking price" : "Their offer";
  const counterpartName = counterpartLabel ?? (mode === "buying" ? "Their Agent" : "Interested Buyer");

  const finished = state.status !== "negotiating";

  function propose(value: number) {
    if (finished) return;
    const next = makeOffer(state, Math.max(1, Math.round(value)), Math.random);
    setState(next);
    setAmount(next.status === "negotiating" ? next.yourPosition : next.yourPosition);
  }

  return (
    <div className="relative min-h-screen overflow-hidden text-white flex flex-col items-center justify-center px-4 py-6">
      {/* A dark, layered stadium glow behind everything — floodlight-style
          radial washes in the corners over a near-black base, rather than a
          flat gradient, matching the given concept's own richer backdrop. */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 40% at 15% 0%, rgba(56,189,248,0.16), transparent 60%)," +
            "radial-gradient(60% 40% at 85% 0%, rgba(16,185,129,0.14), transparent 60%)," +
            "radial-gradient(80% 60% at 50% 110%, rgba(30,41,59,0.9), transparent 60%)," +
            "linear-gradient(to bottom, #0b1120, #05070d)",
        }}
      />

      <div className="relative w-full max-w-sm">
        <div className="text-center mb-4">
          <div className="text-[10px] font-black uppercase tracking-[0.25em] text-sky-300/90">
            {mode === "buying" ? "Negotiating a Signing" : "Negotiating a Sale"}
          </div>
          <div className="mt-1 font-black text-white text-2xl drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]">{playerName}</div>
          <div className="text-[11px] font-bold text-white/70">Estimated value: <span className="text-amber-300">★{money(marketValue)}</span></div>
        </div>

        {/* ── Counterpart card — a real drawn agent portrait whose mood
            actually changes, with a short line naming the mood outright,
            plus their opening ask carried straight into the card the way
            the concept's own "here are their demands" framing does. ── */}
        <div className={`rounded-2xl border-2 bg-gradient-to-br from-slate-900/90 to-slate-950/90 p-3 mb-3 transition-all ${FACE_RING[mood]}`}>
          <div className="flex items-center gap-3">
            <div className={`h-16 w-16 shrink-0 overflow-hidden rounded-full border-2 ${FACE_RING[mood]}`}>
              <AgentPortrait mood={mood} />
            </div>
            <div className="min-w-0">
              <div className="text-[9px] font-black uppercase tracking-widest text-white/50">
                {mode === "buying" ? "Their Agent" : "Interested Buyer"}
              </div>
              <div className="truncate font-black text-white text-base">{counterpartName}</div>
              <div className={`text-[10px] font-bold ${mood === "happy" ? "text-emerald-300" : mood === "angry" ? "text-red-300" : "text-white/60"}`}>
                {MOOD_LABEL[mood]}
              </div>
            </div>
          </div>
        </div>

        {/* ── Positions on the table — icon-badge cards with a big bold
            number, per the concept: a rounded icon circle on the left, a
            small uppercase label above the value, the value itself large
            and bold. Your side in blue, theirs in amber, matching this
            screen's own established colour convention from before. ── */}
        <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-slate-900/80 to-slate-950/80 p-3 mb-2.5 space-y-2 shadow-[0_8px_24px_-8px_rgba(0,0,0,0.6)]">
          <div className="flex items-center gap-3 rounded-xl bg-gradient-to-r from-sky-950/70 to-sky-900/30 border border-sky-500/30 px-3 py-2.5">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-sky-500/20 text-lg">🤝</div>
            <div className="min-w-0 flex-1">
              <div className="text-[9px] font-black uppercase tracking-widest text-sky-300/80">{verb}</div>
              <div className="tabular-nums text-white font-black text-lg leading-tight">★{money(state.yourPosition)}</div>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl bg-gradient-to-r from-amber-950/70 to-amber-900/30 border border-amber-500/30 px-3 py-2.5">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-amber-500/20 text-lg">💬</div>
            <div className="min-w-0 flex-1">
              <div className="text-[9px] font-black uppercase tracking-widest text-amber-300/80">{theirVerb}</div>
              <div className="tabular-nums text-white font-black text-lg leading-tight">★{money(state.theirPosition)}</div>
            </div>
            <div className="shrink-0 rounded-full bg-black/30 px-2 py-0.5 text-[9px] font-bold text-white/60">
              Round {state.round + (finished ? 0 : 1)}
            </div>
          </div>
        </div>

        {/* ── Log — colour-coded per side (see logSide) so the back-and-forth
            reads at a glance instead of needing the sentence read out. ── */}
        <div className="bg-black/30 border border-white/10 rounded-xl p-2.5 mb-3 max-h-32 overflow-y-auto space-y-1">
          {state.log.map((line, i) => (
            <div key={i} className={`text-[10px] font-bold ${LOG_STYLE[logSide(line)]}`}>{line}</div>
          ))}
        </div>

        {!finished && (
          <>
            <div className="mb-1.5 text-[9px] font-black uppercase tracking-widest text-white/50">Your Offer</div>
            <div className="flex items-center gap-1.5 mb-2">
              <div className="flex flex-1 min-w-0 items-center gap-1.5 rounded-xl bg-gradient-to-b from-slate-800 to-slate-900 border border-white/10 px-2.5 py-2 shadow-inner">
                <span className="text-amber-300 font-black text-sm">★</span>
                <input
                  type="text" inputMode="numeric"
                  value={formatAmountInput(amount)}
                  onChange={e => setAmount(Math.max(1, Math.round(Number(e.target.value.replace(/[^0-9]/g, "")) || 0)))}
                  className="flex-1 min-w-0 bg-transparent text-base font-bold text-white tabular-nums outline-none"
                />
              </div>
              <button
                onMouseDown={() => startHold(-1)} onMouseUp={stopHold} onMouseLeave={stopHold}
                onTouchStart={() => startHold(-1)} onTouchEnd={stopHold}
                className="shrink-0 w-9 h-9 rounded-xl bg-slate-700 hover:bg-slate-600 active:bg-slate-500 font-black text-white text-lg select-none shadow"
              >
                −
              </button>
              <button
                onMouseDown={() => startHold(1)} onMouseUp={stopHold} onMouseLeave={stopHold}
                onTouchStart={() => startHold(1)} onTouchEnd={stopHold}
                className="shrink-0 w-9 h-9 rounded-xl bg-slate-700 hover:bg-slate-600 active:bg-slate-500 font-black text-white text-lg select-none shadow"
              >
                +
              </button>
            </div>
            <div className="text-[9px] font-bold text-white/50 text-right -mt-1 mb-2.5">± ★{niceMoneyStep(amount).toLocaleString()} per press</div>

            {/* Requested directly: down from four buttons (small move, meet
                halfway, meet their price, make offer) to exactly two — your
                typed amount on the left, taking their last position outright
                on the right (the same real "meets their price" close makeOffer
                already resolves instantly). Rebuilt with an icon + a real
                gradient fill and a subtle top highlight, per the concept's
                own more modern button treatment. */}
            <div className="grid grid-cols-2 gap-2 mb-2">
              <button
                onClick={() => propose(amount)}
                className="flex items-center justify-center gap-1.5 py-3 rounded-xl font-black text-sm text-white bg-gradient-to-b from-emerald-400 to-emerald-600 hover:from-emerald-300 hover:to-emerald-500 active:scale-[0.98] transition shadow-[0_6px_16px_-4px_rgba(16,185,129,0.6)]"
              >
                <span>🤝</span>{mode === "buying" ? "Make Offer" : "Set Asking Price"}
              </button>
              <button
                onClick={() => propose(state.theirPosition)}
                className="flex items-center justify-center gap-1.5 py-3 rounded-xl font-black text-sm text-white bg-gradient-to-b from-amber-400 to-amber-600 hover:from-amber-300 hover:to-amber-500 active:scale-[0.98] transition shadow-[0_6px_16px_-4px_rgba(245,158,11,0.6)]"
              >
                <span>📄</span>Accept Offer
              </button>
            </div>
            {onStepAway && (
              <button
                onClick={() => onStepAway(state)}
                className="w-full mt-1 py-2 rounded-xl font-bold text-xs text-white/80 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10"
              >
                Step Away (check other interested clubs)
              </button>
            )}
            {/* Requested directly: there was no way to actually leave a
                negotiation without waiting it out to a rejection — a real
                Walk Away, ending it right now with no deal, exactly the
                same real outcome (and, where wired up, the same real
                cooldown before trying THIS pairing again) as talks
                genuinely falling through on their own. Rebuilt as its own
                bordered dark card rather than a plain link-style row, per
                the concept. */}
            <button
              onClick={() => onDone(null)}
              className="flex w-full items-center justify-center gap-1.5 mt-2 py-2.5 rounded-xl font-bold text-xs text-red-300 hover:text-red-200 bg-red-950/40 hover:bg-red-900/40 border border-red-500/20"
            >
              <span>🚪</span>Walk Away
            </button>
          </>
        )}

        {finished && (
          <>
            {/* Same card language as everything above it — a gradient fill,
                a coloured border/glow, and a real icon, rather than a plain
                flat box — so the deal-agreed/no-deal screen reads as the
                same designed place the negotiation itself just happened in,
                not a different, plainer screen tacked on the end. */}
            <div className={`flex items-center justify-center gap-2 rounded-xl p-4 text-center mb-3 font-black border shadow-lg ${
              state.status === "accepted"
                ? "bg-gradient-to-b from-emerald-600/40 to-emerald-900/50 text-emerald-300 border-emerald-500/40 shadow-emerald-900/40"
                : "bg-gradient-to-b from-red-800/40 to-red-950/50 text-red-300 border-red-500/40 shadow-red-950/40"
            }`}>
              <span className="text-lg">{state.status === "accepted" ? "🤝" : "🚪"}</span>
              <span>
                {state.status === "accepted" && `Deal agreed — ★${money(state.finalPrice ?? 0)}`}
                {state.status === "rejected" && "No deal — talks broke down"}
                {state.status === "walked_away" && (mode === "buying" ? "They walked away, angry" : "The buyer walked away, angry")}
              </span>
            </div>
            <button
              onClick={() => onDone(state.status === "accepted" ? (state.finalPrice ?? null) : null)}
              className={`w-full py-3 rounded-xl font-black text-sm text-white active:scale-[0.98] transition shadow ${
                state.status === "accepted"
                  ? "bg-gradient-to-b from-emerald-400 to-emerald-600 hover:from-emerald-300 hover:to-emerald-500 shadow-[0_6px_16px_-4px_rgba(16,185,129,0.6)]"
                  : "bg-gradient-to-b from-slate-600 to-slate-800 hover:from-slate-500 hover:to-slate-700"
              }`}
            >
              Continue
            </button>
          </>
        )}
      </div>
    </div>
  );
}
