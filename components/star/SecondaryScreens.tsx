"use client";
import { useState } from "react";
import type { CareerState, Trophy } from "@/lib/star/types";
import { ACHIEVEMENTS } from "@/lib/star/achievements";

// ---------- SPONSORS ----------
export function SponsorsScreen({ career, onBack }: { career: CareerState; onBack: () => void }) {
  const total = career.sponsors.reduce((s, sp) => s + (sp.active ? sp.perMatch : 0), 0);
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-800 to-gray-900 text-white flex flex-col py-3 px-3">
      <div className="w-full max-w-sm mx-auto flex-1">
        <div className="flex items-center justify-between mb-3">
          <button onClick={onBack} className="px-3 py-2 bg-gray-700 rounded-lg font-black text-sm">← Back</button>
          <div className="font-black text-white text-lg">Sponsors</div>
          <div />
        </div>

        <div className="bg-gray-700 rounded-xl border border-gray-600 overflow-hidden">
          {career.sponsors.map((sp, i) => (
            <div key={sp.category} className={`flex items-center py-2.5 px-3 border-b border-black/20 ${i % 2 === 0 ? "bg-gray-700" : "bg-gray-800"}`}>
              <div className="font-black text-white text-sm flex-1">{sp.category}</div>
              {sp.active ? (
                <div className="flex items-center gap-1 font-black text-yellow-300 text-sm">
                  <StarIcon />{sp.perMatch}
                </div>
              ) : (
                <div className="text-[10px] text-gray-500 uppercase font-black">Not Signed</div>
              )}
            </div>
          ))}
          <div className="bg-emerald-700 py-2.5 px-3 flex items-center border-t border-black/30">
            <div className="font-black text-white text-sm flex-1">Total Per Match</div>
            <div className="flex items-center gap-1 font-black text-white text-sm">
              <StarIcon />{total}
            </div>
          </div>
        </div>

        <div className="mt-3 bg-gray-800 rounded-lg p-3 border border-gray-700 text-[10px] text-gray-400 text-center leading-tight">
          Grow your fame and performances to unlock sponsors. Each ★20 of Sponsor relationship = ★1/match.
        </div>
      </div>
    </div>
  );
}

// ---------- ACHIEVEMENTS ----------
export function AchievementsScreen({ career, onBack }: { career: CareerState; onBack: () => void }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-800 to-gray-900 text-white flex flex-col py-3 px-3">
      <div className="w-full max-w-sm mx-auto flex-1 flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <button onClick={onBack} className="px-3 py-2 bg-gray-700 rounded-lg font-black text-sm">← Back</button>
          <div className="font-black text-white text-lg">Achievements</div>
          <div />
        </div>

        <div className="bg-gray-700 rounded-xl border border-gray-600 overflow-hidden flex-1 overflow-y-auto max-h-[560px]">
          {ACHIEVEMENTS.map((a, i) => {
            const unlocked = career.achievements.includes(a.id);
            return (
              <div key={a.id} className={`flex items-center gap-3 p-3 border-b border-black/20 ${i % 2 === 0 ? "bg-gray-700" : "bg-gray-800"}`}>
                <div className={`text-3xl ${unlocked ? "" : "opacity-20 grayscale"}`}>⭐</div>
                <div className="flex-1">
                  <div className={`font-black text-sm ${unlocked ? "text-yellow-300" : "text-gray-500"}`}>{a.label}</div>
                  <div className={`text-[10px] ${unlocked ? "text-gray-300" : "text-gray-500"}`}>{a.description}</div>
                </div>
                {unlocked && <div className="text-emerald-400 font-black text-lg">✓</div>}
              </div>
            );
          })}
        </div>

        <div className="mt-2 text-xs text-center text-gray-400 font-bold">
          {career.achievements.length} / {ACHIEVEMENTS.length} unlocked
        </div>
      </div>
    </div>
  );
}

// ---------- TROPHIES ----------
export function TrophiesScreen({ trophies, onBack, ballonDors }: { trophies: Trophy[]; ballonDors: number; onBack: () => void }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-800 to-gray-900 text-white flex flex-col py-3 px-3">
      <div className="w-full max-w-sm mx-auto flex-1">
        <div className="flex items-center justify-between mb-3">
          <button onClick={onBack} className="px-3 py-2 bg-gray-700 rounded-lg font-black text-sm">← Back</button>
          <div className="font-black text-white text-lg">Trophy Cabinet</div>
          <div />
        </div>

        <div className="bg-gradient-to-b from-yellow-800 to-yellow-950 rounded-xl border-2 border-yellow-500 p-4 mb-3 text-center">
          <div className="text-4xl mb-1">🏆</div>
          <div className="font-black text-yellow-300 text-xl">{ballonDors}</div>
          <div className="text-[10px] font-black text-yellow-200 uppercase tracking-widest">Ballon d&apos;Or</div>
        </div>

        {trophies.length === 0 ? (
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 text-center text-gray-400 text-sm">
            No trophies yet — win the league or a cup!
          </div>
        ) : (
          <div className="bg-gray-700 rounded-xl border border-gray-600 overflow-hidden">
            {trophies.map((t, i) => (
              <div key={i} className={`flex items-center gap-3 p-3 border-b border-black/20 ${i % 2 === 0 ? "bg-gray-700" : "bg-gray-800"}`}>
                <div className="text-2xl">🥇</div>
                <div className="flex-1">
                  <div className="font-black text-white text-sm">{t.competition}</div>
                  <div className="text-[10px] text-gray-400">{t.club} · Season {t.season}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- CONTRACT RENEWAL (higher-or-lower) ----------
export function ContractRenewal({ career, onComplete }: { career: CareerState; onComplete: (newContract: CareerState["contract"] | null) => void }) {
  const [phase, setPhase] = useState<"intro" | "playing" | "done">("intro");
  const [current, setCurrent] = useState(7);
  const [next, setNext] = useState<number | null>(null);
  const [rounds, setRounds] = useState(0);
  const [wins, setWins] = useState(0);
  const [message, setMessage] = useState("");

  // Renewal is only available in the final year of the deal — otherwise you could
  // reopen this screen from the Life menu every week and print unlimited wage rises.
  // Signing resets the deal to 3 seasons, so this closes the loop after one renewal.
  const canRenew = career.contract.seasonsRemaining <= 1;

  // Draw a card that is never equal to the current one — a true higher-or-lower has
  // no ties, so a 6 can't be followed by another 6.
  const drawDifferent = (from: number) => {
    let n = 1 + Math.floor(Math.random() * 13);
    while (n === from) n = 1 + Math.floor(Math.random() * 13);
    return n;
  };

  const startCard = () => {
    setPhase("playing");
    setCurrent(3 + Math.floor(Math.random() * 8));
    setNext(null);
    setRounds(0);
    setWins(0);
  };

  const guess = (higher: boolean) => {
    const n = drawDifferent(current);
    setNext(n);
    setRounds((r) => r + 1);
    const correct = higher ? n > current : n < current;
    setTimeout(() => {
      if (correct) {
        setWins((w) => w + 1);
        setMessage("✓ Correct!");
      } else {
        setMessage("✗ Wrong! Negotiation ends.");
        setPhase("done");
        return;
      }
      setCurrent(n);
      setNext(null);
      setMessage("");
      if (rounds + 1 >= 5) setPhase("done");
    }, 900);
  };

  const finalise = () => {
    const bonus = wins;
    const newContract: CareerState["contract"] = {
      club: career.contract.club,
      wage: career.contract.wage + bonus,
      goalBonus: career.contract.goalBonus + Math.floor(bonus / 2),
      assistBonus: career.contract.assistBonus + Math.floor(bonus / 2),
      seasonsRemaining: 3,
    };
    onComplete(newContract);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-800 to-gray-900 text-white flex items-center justify-center py-3 px-3">
      <div className="w-full max-w-sm">
        <div className="text-center mb-3">
          <div className="text-[10px] font-black uppercase tracking-widest text-yellow-300">Contract Renewal</div>
          <div className="text-lg font-black text-white">{career.contract.club}</div>
        </div>

        {phase === "intro" && !canRenew && (
          <div className="bg-gray-700 rounded-2xl p-4 border border-gray-600 text-center">
            <div className="text-4xl mb-2">📝</div>
            <div className="text-sm text-gray-200 mb-1 leading-snug font-bold">
              You&apos;re under contract for {career.contract.seasonsRemaining} more seasons.
            </div>
            <div className="text-xs text-gray-400 mb-4 leading-snug">
              The club will only renegotiate in the final year of your deal. Come back then to improve your terms.
            </div>
            <button onClick={() => onComplete(null)} className="w-full py-3 bg-emerald-500 rounded-xl font-black">Back</button>
          </div>
        )}

        {phase === "intro" && canRenew && (
          <div className="bg-gray-700 rounded-2xl p-4 border border-gray-600">
            <div className="text-sm text-gray-200 mb-3 leading-snug">
              Your contract is up. Your agent will play higher-or-lower against the club negotiator. Each correct guess (up to 5) improves your terms by ★1 wage.
            </div>
            <div className="bg-gray-800 rounded-lg p-3 text-xs mb-3 space-y-1">
              <div className="flex justify-between"><span>Current wage</span><span className="text-yellow-300 font-black">★{career.contract.wage}/match</span></div>
              <div className="flex justify-between"><span>Goal bonus</span><span className="text-yellow-300 font-black">★{career.contract.goalBonus}</span></div>
              <div className="flex justify-between"><span>Assist bonus</span><span className="text-yellow-300 font-black">★{career.contract.assistBonus}</span></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => onComplete(null)} className="py-3 bg-gray-600 rounded-xl font-black">Wait a season</button>
              <button onClick={startCard} className="py-3 bg-emerald-500 rounded-xl font-black">Start negotiation</button>
            </div>
          </div>
        )}

        {phase === "playing" && (
          <div className="bg-gray-700 rounded-2xl p-4 border border-gray-600 text-center">
            <div className="text-xs text-gray-400 mb-2">Round {rounds + 1} of 5 · {wins} correct</div>
            <div className="flex justify-center gap-3 items-center mb-4">
              <CardBig value={current} />
              <div className="text-xl">→</div>
              <CardBig value={next ?? "?"} />
            </div>
            {message && <div className={`mb-3 font-black text-lg ${message.startsWith("✓") ? "text-emerald-300" : "text-red-400"}`}>{message}</div>}
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => guess(false)} disabled={next !== null} className="py-3 bg-red-600 rounded-xl font-black disabled:opacity-50">▼ Lower</button>
              <button onClick={() => guess(true)} disabled={next !== null} className="py-3 bg-emerald-500 rounded-xl font-black disabled:opacity-50">▲ Higher</button>
            </div>
          </div>
        )}

        {phase === "done" && (
          <div className="bg-gray-700 rounded-2xl p-5 border border-gray-600 text-center">
            <div className="text-xs text-gray-400 mb-1">Final terms</div>
            <div className="text-3xl font-black text-yellow-300 mb-2">{wins} correct</div>
            <div className="bg-gray-800 rounded-lg p-3 text-xs mb-3 space-y-1">
              <div className="flex justify-between"><span>New wage</span><span className="text-emerald-300 font-black">★{career.contract.wage + wins}/match</span></div>
              <div className="flex justify-between"><span>Goal bonus</span><span className="text-emerald-300 font-black">★{career.contract.goalBonus + Math.floor(wins / 2)}</span></div>
              <div className="flex justify-between"><span>Assist bonus</span><span className="text-emerald-300 font-black">★{career.contract.assistBonus + Math.floor(wins / 2)}</span></div>
            </div>
            <button onClick={finalise} className="w-full py-3 bg-emerald-500 rounded-xl font-black">Sign Contract →</button>
          </div>
        )}
      </div>
    </div>
  );
}

function CardBig({ value }: { value: number | string }) {
  const isNum = typeof value === "number";
  const display = isNum ? (value === 1 ? "A" : value === 11 ? "J" : value === 12 ? "Q" : value === 13 ? "K" : value) : value;
  return (
    <div className="w-20 h-28 rounded-lg bg-white border-2 border-gray-300 flex items-center justify-center shadow-lg">
      <div className={`text-4xl font-black ${isNum ? "text-black" : "text-gray-400"}`}>{display}</div>
    </div>
  );
}

function StarIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="#fbbf24">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}
