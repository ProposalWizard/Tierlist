"use client";

/**
 * A GAME PLAYED AT ITS TABLE IN THE 3D CASINO (Harry, 8 Oct 2026: "the next
 * part of the 3D casino is having the games actually run in 3D").
 *
 * The camera has glided in to the table (Casino3D → ctrl.focus); this is the
 * light strip of buttons at the bottom of the screen and the result over the
 * table. Roulette, Slots, Blackjack and Horse racing.
 *
 * THE RULES ARE THE FLAT CASINO'S, EXACTLY. Every round is rolled with the
 * same functions components/star/Casino.tsx uses (lib/star/casinoRounds.ts,
 * through casinoClient's playOrLocal, the same as the flat games), the bet
 * moves on the same ladder (useCasinoBet), the stake comes off the bank as
 * the round starts and the payout goes on as the result shows. Only then do
 * the wheel, reels, cards and horses move (lib/star/casino3d/games3d.ts),
 * to show what was rolled. Leaving hands the bank back exactly as leaving a
 * flat game does (onLeave → page.tsx handleCasinoBank).
 */
import { useEffect, useRef, useState } from "react";
import type { CareerState } from "@/lib/star/types";
import type { CasinoController } from "@/lib/star/casino3d/scene";
import type { InRoomGame } from "@/lib/star/casino3d/plan";
import { type Card, type RouletteChoice, isRed, handValue, SLOTS_SYMBOLS } from "@/lib/star/casinoRules";
import { rouletteRound, slotsRound, blackjackDeal, blackjackHit, blackjackStand, horseBetRound } from "@/lib/star/casinoRounds";
import { playOrLocal } from "@/lib/star/casinoClient";
import { getTuning } from "@/lib/star/tuningStore";
import { formatMoney } from "@/lib/star/money";
import { useCasinoBet, generateRaceHorses, type RaceHorse } from "./Casino";

const GOLD = "#facc15";
const INK = "#f7f1e8";
const PULL_AT = 0.75;
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
/** The jockeys' silks, horse 1 to 6 (the big screen and the list match). */
export const SILKS = ["#e11d48", "#2563eb", "#f59e0b", "#7c3aed", "#10b981", "#f97316"];

export interface Casino3DTableProps {
  game: InRoomGame;
  ctrl: CasinoController;
  career: CareerState;
  bankStart: number;
  /** The bank as it changes (the money pill at the top shows it). */
  onBank: (bank: number) => void;
  /** Leave the table: the bank goes back to the career, like leaving a flat game. */
  onLeave: (bank: number) => void;
  /** Horse racing's stable (your own horse, buying one) stays on the flat screen. */
  onStable?: (bank: number) => void;
}

type Result = { text: string; tone: "win" | "lose" | "even" } | null;

export default function Casino3DTable({ game, ctrl, bankStart, onBank, onLeave, onStable }: Casino3DTableProps) {
  const [bank, setBankRaw] = useState(bankStart);
  const bankRef = useRef(bankStart);
  const setBank = (n: number) => { bankRef.current = n; setBankRaw(n); onBank(n); };
  const [bet, changeBet] = useCasinoBet(bank, bankStart);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result>(null);
  const [note, setNote] = useState<string | null>(null);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  // ── Roulette ──
  const [choice, setChoice] = useState<RouletteChoice | null>("red");
  const [numbers, setNumbers] = useState(false);
  const spinRoulette = async () => {
    if (choice === null || busy || bank < bet) return;
    const stake = bet, bank0 = bank, picked = choice;
    setBusy(true); setResult(null); setNote(null);
    const played = await playOrLocal<{ winner: number; payout: number }>(
      { game: "roulette", choice: picked, stake, bank: bank0 },
      () => rouletteRound(picked, stake, Math.random),
    );
    if (played.kind === "error") { setBusy(false); setNote(played.message); return; }
    const { winner, payout: win } = played.result;
    setBank(bank0 - stake);
    ctrl.staff("croupier");
    await ctrl.games.roulette(winner);
    if (!alive.current) return;
    const col = winner === 0 ? "green" : isRed(winner) ? "red" : "black";
    if (win > 0) { setBank(bank0 - stake + win); setResult({ text: `${winner} ${col} — WIN +★${formatMoney(win - stake)}`, tone: "win" }); }
    else setResult({ text: `${winner} ${col} — lost`, tone: "lose" });
    setBusy(false);
  };

  // ── Slots ──
  const spinSlots = async () => {
    if (busy || bank < bet) return;
    const stake = bet, bank0 = bank;
    setBusy(true); setResult(null); setNote(null);
    const played = await playOrLocal<{ reels: string[]; payout: number }>(
      { game: "slots", stake, bank: bank0 },
      () => slotsRound(stake, Math.random),
    );
    if (played.kind === "error") { setBusy(false); setNote(played.message); return; }
    setBank(bank0 - stake);
    ctrl.pull();
    await sleep(PULL_AT * 1000);
    await ctrl.games.slots(played.result.reels.map((r) => SLOTS_SYMBOLS.indexOf(r)));
    if (!alive.current) return;
    const win = played.result.payout;
    if (win > 0) {
      setBank(bank0 - stake + win);
      if (win > stake) ctrl.games.slotsWin(win >= stake * 10);
      setResult(win > stake ? { text: `WIN +★${formatMoney(win - stake)}`, tone: "win" } : { text: "A pair — stake back", tone: "even" });
    } else setResult({ text: "No luck", tone: "lose" });
    setBusy(false);
  };

  // ── Blackjack ──
  const [player, setPlayer] = useState<Card[]>([]);
  const [dealer, setDealer] = useState<Card[]>([]);
  const [shown, setShown] = useState(0);
  const [phase, setPhase] = useState<"bet" | "play" | "dealer-turn" | "done">("bet");
  const stakeRef = useRef(0);
  const deal = async () => {
    if (bank < bet || busy) return;
    setBusy(true); setResult(null); setNote(null);
    const stake = bet;
    const played = await playOrLocal<{ player: Card[]; dealer: Card[] }>(
      { game: "blackjack", action: "deal", stake, bank },
      () => blackjackDeal(Math.random),
    );
    if (played.kind === "error") { setBusy(false); setNote(played.message); return; }
    const r = played.result;
    stakeRef.current = stake;
    setBank(bank - stake);
    await ctrl.games.bjClear();
    ctrl.staff("dealer");
    setPlayer([]); setDealer([]); setShown(0);
    await ctrl.games.bjDeal("player", r.player[0]); setPlayer([r.player[0]]);
    await ctrl.games.bjDeal("dealer", r.dealer[0]); setDealer([r.dealer[0]]); setShown(1);
    await ctrl.games.bjDeal("player", r.player[1]); setPlayer(r.player);
    await ctrl.games.bjDeal("dealer", null); setDealer(r.dealer);
    if (!alive.current) return;
    setPhase("play");
    setBusy(false);
  };
  const hit = async () => {
    if (phase !== "play" || busy) return;
    setBusy(true);
    const next = blackjackHit(player, Math.random);
    await ctrl.games.bjDeal("player", next[next.length - 1]);
    setPlayer(next);
    if (handValue(next) > 21) {
      await ctrl.games.bjReveal(dealer[1]);
      setShown(dealer.length);
      setResult({ text: "BUST!", tone: "lose" });
      setPhase("done");
    }
    setBusy(false);
  };
  const stand = async () => {
    if (phase !== "play" || busy) return;
    setBusy(true);
    setPhase("dealer-turn");
    const stake = stakeRef.current;
    const s = blackjackStand(player, dealer, stake, Math.random);
    await sleep(350);
    await ctrl.games.bjReveal(s.dealer[1]);
    setShown(2);
    for (let n = 3; n <= s.dealer.length; n++) {
      await sleep(450);
      await ctrl.games.bjDeal("dealer", s.dealer[n - 1]);
      setDealer(s.dealer.slice(0, n)); setShown(n);
    }
    setDealer(s.dealer); setShown(s.dealer.length);
    await sleep(300);
    if (!alive.current) return;
    const b = bankRef.current;
    if (s.verdict === "dealer-bust") { setBank(b + s.payout); setResult({ text: `Dealer busts — WIN +★${formatMoney(s.payout - stake)}`, tone: "win" }); }
    else if (s.verdict === "win") { setBank(b + s.payout); setResult({ text: `YOU WIN +★${formatMoney(s.payout - stake)}`, tone: "win" }); }
    else if (s.verdict === "push") { setBank(b + s.payout); setResult({ text: "Push — stake back", tone: "even" }); }
    else setResult({ text: "Dealer wins", tone: "lose" });
    setPhase("done");
    setBusy(false);
  };
  const newHand = async () => {
    setResult(null); setPlayer([]); setDealer([]); setShown(0); setPhase("bet");
    await ctrl.games.bjClear();
  };

  // ── Horse racing ──
  const [horses, setHorses] = useState<RaceHorse[]>(() => generateRaceHorses());
  const [pick, setPick] = useState<number | null>(null);
  const [raced, setRaced] = useState(false);
  const race = async () => {
    if (pick === null || bank < bet || busy) return;
    const stake = bet, field = horses, p = pick;
    setBusy(true); setResult(null); setNote(null);
    const played = await playOrLocal<{ scores: number[]; payout: number }>(
      { game: "horse", pick: p, stake, bank },
      () => horseBetRound(field.map((h) => h.rating), field.map((h) => h.odds), p, stake, Math.random, getTuning("horseRacing.raceNoise")),
    );
    if (played.kind === "error") { setBusy(false); setNote(played.message); return; }
    const { scores, payout } = played.result;
    setBank(bank - stake);
    await ctrl.games.race(scores, SILKS, p);
    if (!alive.current) return;
    const w = scores.indexOf(Math.max(...scores));
    if (payout > 0) { setBank(bankRef.current + payout); setResult({ text: `${field[w].name} wins — +★${formatMoney(payout - stake)}`, tone: "win" }); }
    else setResult({ text: `${field[w].name} (#${w + 1}) wins — your horse lost`, tone: "lose" });
    setRaced(true);
    setBusy(false);
  };
  const nextRace = () => {
    ctrl.games.raceEnd();
    setHorses(generateRaceHorses());
    setPick(null); setRaced(false); setResult(null);
  };

  // Leave: never mid-round (the flat games could lose a spin that way)
  const midRound = busy || phase === "play" || phase === "dealer-turn";
  const leave = async () => {
    if (midRound) return;
    if (game === "blackjack") void ctrl.games.bjClear();
    onLeave(bankRef.current);
  };

  const btn = (bg: string, fg = "#111"): React.CSSProperties => ({
    height: 46, borderRadius: 14, border: "none", background: bg, color: fg, fontWeight: 900, fontSize: 15, cursor: "pointer", padding: "0 12px",
  });
  const chip = (on: boolean, bg: string): React.CSSProperties => ({
    height: 38, borderRadius: 12, border: on ? "2px solid #fff" : "1px solid rgba(255,255,255,0.18)", background: bg, color: "#fff",
    fontWeight: 900, fontSize: 12, textTransform: "uppercase", cursor: "pointer", opacity: busy ? 0.6 : 1,
  });
  const canAfford = bank >= bet;
  const dealerShown = dealer.slice(0, shown);

  return (
    <>
      {/* the result, over the table */}
      {result && (
        <div data-casino3d-result style={{ position: "absolute", left: 0, right: 0, top: "max(64px, calc(env(safe-area-inset-top) + 56px))", display: "grid", placeItems: "center", pointerEvents: "none" }}>
          <div style={{
            padding: "8px 16px", borderRadius: 14, background: "rgba(10,6,8,0.78)", fontWeight: 900, fontSize: 19, textAlign: "center", maxWidth: "88vw",
            color: result.tone === "win" ? "#6ee7b7" : result.tone === "lose" ? "#fca5a5" : GOLD,
            boxShadow: result.tone === "win" ? "0 0 0 2px rgba(110,231,183,.5), 0 0 30px rgba(110,231,183,.45)" : "0 0 0 1px rgba(255,255,255,.15)",
          }}>{result.text}</div>
        </div>
      )}

      {/* the strip at the bottom */}
      <div data-casino3d-table={game} style={{
        position: "absolute", left: 0, right: 0, bottom: 0, padding: "10px 12px max(14px, env(safe-area-inset-bottom))",
        background: "linear-gradient(180deg, rgba(14,6,10,0) 0%, rgba(14,6,10,0.82) 22%, rgba(14,6,10,0.94) 100%)",
        color: INK, display: "flex", flexDirection: "column", gap: 8,
      }}>
        {game === "blackjack" && phase !== "bet" && (
          <div style={{ display: "flex", justifyContent: "center", gap: 10, fontWeight: 900, fontSize: 13 }}>
            <span style={{ padding: "3px 10px", borderRadius: 999, background: "rgba(255,255,255,0.1)" }}>You {handValue(player)}</span>
            <span style={{ padding: "3px 10px", borderRadius: 999, background: "rgba(255,255,255,0.1)" }}>Dealer {shown >= 2 ? handValue(dealerShown) : `${handValue(dealerShown)} + ?`}</span>
          </div>
        )}

        {game === "roulette" && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6 }}>
              {(["red", "black", "even", "odd"] as const).map((c) => (
                <button key={c} disabled={busy} onClick={() => { setChoice(c); setNumbers(false); }}
                  style={chip(choice === c, c === "red" ? "#b91c1c" : c === "black" ? "#111" : "#065f46")}>{c}</button>
              ))}
              <button disabled={busy} onClick={() => setNumbers((v) => !v)} style={chip(typeof choice === "number", "#3b2a14")}>
                {typeof choice === "number" ? `#${choice}` : "No."}
              </button>
            </div>
            {numbers && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(10, 1fr)", gap: 3 }}>
                {Array.from({ length: 37 }, (_, n) => (
                  <button key={n} disabled={busy} onClick={() => { setChoice(n); setNumbers(false); }}
                    style={{ height: 28, borderRadius: 6, border: choice === n ? "2px solid #fde047" : "none", background: n === 0 ? "#047857" : isRed(n) ? "#b91c1c" : "#111", color: "#fff", fontWeight: 900, fontSize: 11 }}>{n}</button>
                ))}
              </div>
            )}
            <div style={{ fontSize: 10, textAlign: "center", opacity: 0.85 }}>Red/Black/Even/Odd pay 2x · a number pays 35x</div>
          </>
        )}

        {game === "slots" && (
          <div style={{ fontSize: 10, textAlign: "center", fontWeight: 800, color: "#fde68a" }}>777 = 20x · ⭐⭐⭐ = 10x · any triple 5x · a pair = stake back</div>
        )}

        {game === "horses" && !raced && !busy && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5 }}>
            {horses.map((h, i) => (
              <button key={i} disabled={busy} onClick={() => setPick(i)} style={{
                display: "flex", alignItems: "center", gap: 6, height: 36, padding: "0 8px", borderRadius: 10, textAlign: "left",
                border: pick === i ? `2px solid ${GOLD}` : "1px solid rgba(255,255,255,0.14)", background: pick === i ? "rgba(250,204,21,0.14)" : "rgba(255,255,255,0.06)", color: INK, cursor: "pointer",
              }}>
                <span style={{ width: 18, height: 18, borderRadius: 5, background: SILKS[i], fontSize: 11, fontWeight: 900, display: "grid", placeItems: "center", color: "#fff", flex: "none" }}>{i + 1}</span>
                <span style={{ flex: 1, minWidth: 0, fontSize: 11, fontWeight: 800, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{h.name}</span>
                <span style={{ fontSize: 11, fontWeight: 900, color: GOLD }}>{h.odds.toFixed(2)}</span>
              </button>
            ))}
          </div>
        )}

        {/* the bet */}
        {!(game === "blackjack" && phase !== "bet") && !(game === "horses" && (raced || busy)) && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(253,230,138,0.85)" }}>Bet</span>
            <button aria-label="Lower bet" disabled={busy} onClick={() => changeBet(-1)} style={{ ...btn("rgba(255,255,255,0.12)", "#fca5a5"), width: 40, height: 36, padding: 0 }}>▼</button>
            <b style={{ minWidth: 76, textAlign: "center", color: "#fde047", fontSize: 17 }}>★{formatMoney(bet)}</b>
            <button aria-label="Raise bet" disabled={busy || bet >= bank} onClick={() => changeBet(1)} style={{ ...btn("rgba(255,255,255,0.12)", "#86efac"), width: 40, height: 36, padding: 0 }}>▲</button>
          </div>
        )}

        {note && <div role="status" style={{ fontSize: 12, fontWeight: 800, color: "#fecaca", textAlign: "center" }}>{note}</div>}

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => void leave()} disabled={midRound} data-casino3d-leave
            style={{ ...btn("rgba(255,255,255,0.12)", INK), flex: "0 0 auto", opacity: midRound ? 0.4 : 1 }}>‹ Leave</button>
          {game === "roulette" && (
            <button disabled={busy || choice === null || !canAfford} onClick={() => void spinRoulette()} style={{ ...btn(GOLD), flex: 1, opacity: busy || !canAfford ? 0.6 : 1 }}>
              {busy ? "Spinning…" : `Spin — ★${formatMoney(bet)}`}
            </button>
          )}
          {game === "slots" && (
            <button disabled={busy || !canAfford} onClick={() => void spinSlots()} style={{ ...btn(GOLD), flex: 1, opacity: busy || !canAfford ? 0.6 : 1 }}>
              {busy ? "Spinning…" : `Pull — ★${formatMoney(bet)}`}
            </button>
          )}
          {game === "blackjack" && phase === "bet" && (
            <button disabled={busy || !canAfford} onClick={() => void deal()} style={{ ...btn(GOLD), flex: 1, opacity: busy || !canAfford ? 0.6 : 1 }}>
              {busy ? "Dealing…" : `Deal — ★${formatMoney(bet)}`}
            </button>
          )}
          {game === "blackjack" && phase === "play" && (
            <>
              <button disabled={busy} onClick={() => void stand()} style={{ ...btn("#ef4444", "#fff"), flex: 1 }}>Stand</button>
              <button disabled={busy} onClick={() => void hit()} style={{ ...btn("#22c55e", "#04120a"), flex: 1 }}>Hit</button>
            </>
          )}
          {game === "blackjack" && phase === "dealer-turn" && <div style={{ flex: 1, display: "grid", placeItems: "center", fontWeight: 900, color: GOLD }}>Dealer drawing…</div>}
          {game === "blackjack" && phase === "done" && (
            <button onClick={() => void newHand()} style={{ ...btn(GOLD), flex: 1 }}>New hand</button>
          )}
          {game === "horses" && !raced && (
            <button disabled={busy || pick === null || !canAfford} onClick={() => void race()} style={{ ...btn(GOLD), flex: 1, opacity: busy || pick === null || !canAfford ? 0.6 : 1 }}>
              {busy ? "They're off…" : pick === null ? "Pick a horse" : `Bet ★${formatMoney(bet)} on #${pick + 1}`}
            </button>
          )}
          {game === "horses" && raced && <button onClick={nextRace} style={{ ...btn(GOLD), flex: 1 }}>Next race</button>}
        </div>
        {game === "horses" && onStable && !busy && (
          <button onClick={() => onStable(bankRef.current)} style={{ background: "none", border: "none", color: "rgba(253,230,138,0.9)", fontWeight: 800, fontSize: 12, cursor: "pointer" }}>
            Your stable — race or buy a horse ›
          </button>
        )}
      </div>
    </>
  );
}
