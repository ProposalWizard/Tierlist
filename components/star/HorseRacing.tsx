"use client";
import { useEffect, useState } from "react";
import type { CareerState, Horse } from "@/lib/star/types";

interface Props {
  career: CareerState;
  onBuyHorse: (horse: Horse, price: number) => void;
  onRace: (finish: number, prize: number, energyCost: number) => void;
  onBack: () => void;
}

const RACE_COST = 40; // energy spent per race
const FIELD = 6;      // runners per race (you + 5)
// Prize money (★) by finishing position, 1st … 6th.
const PRIZES = [25, 12, 5, 0, 0, 0];

// Horses you can buy — pricier ones are faster and have more staying power.
const STABLE: { horse: Omit<Horse, "energy" | "racesRun" | "racesWon" | "earnings">; price: number }[] = [
  { horse: { name: "Clover Lad", breed: "Cob", speed: 55, stamina: 58 }, price: 30 },
  { horse: { name: "Midnight Dash", breed: "Thoroughbred", speed: 68, stamina: 62 }, price: 60 },
  { horse: { name: "Golden Arrow", breed: "Arabian", speed: 78, stamina: 72 }, price: 120 },
  { horse: { name: "Thunderhoof", breed: "Champion", speed: 88, stamina: 84 }, price: 240 },
];

const RIVAL_NAMES = ["Bold Ruler", "Grey Storm", "Iron Duke", "Red Comet", "Silver Fox", "Wild Spirit", "Blaze", "Nimbus"];

interface Runner { name: string; isUser: boolean; score: number; duration: number; }

export default function HorseRacing({ career, onBuyHorse, onRace, onBack }: Props) {
  const horse = career.horse ?? null;
  const [runners, setRunners] = useState<Runner[] | null>(null);
  const [go, setGo] = useState(false);
  const [result, setResult] = useState<{ finish: number; prize: number } | null>(null);

  // Kick off the CSS transition one tick after the lanes mount.
  useEffect(() => {
    if (runners && !go) {
      const t = setTimeout(() => setGo(true), 60);
      return () => clearTimeout(t);
    }
  }, [runners, go]);

  // Reveal the result once the slowest runner has crossed the line.
  useEffect(() => {
    if (runners && go && !result) {
      const maxDur = Math.max(...runners.map((r) => r.duration));
      const t = setTimeout(() => {
        const ordered = [...runners].sort((a, b) => b.score - a.score);
        const finish = ordered.findIndex((r) => r.isUser) + 1;
        setResult({ finish, prize: PRIZES[finish - 1] ?? 0 });
      }, maxDur * 1000 + 250);
      return () => clearTimeout(t);
    }
  }, [runners, go, result]);

  const startRace = () => {
    if (!horse || horse.energy < RACE_COST) return;
    const energyFactor = 0.6 + (horse.energy / 100) * 0.4; // tired horses underperform
    const userScore = (horse.speed * 0.55 + horse.stamina * 0.45) * energyFactor + Math.random() * 22;
    const field: Runner[] = [{ name: horse.name, isUser: true, score: userScore, duration: 0 }];
    const names = [...RIVAL_NAMES].sort(() => Math.random() - 0.5);
    for (let i = 0; i < FIELD - 1; i++) {
      const rating = 46 + Math.random() * 42;
      field.push({ name: names[i], isUser: false, score: rating + Math.random() * 22, duration: 0 });
    }
    const scores = field.map((r) => r.score);
    const lo = Math.min(...scores), hi = Math.max(...scores);
    // Best score → quickest run (2.2s), worst → 3.6s, so the visual matches the order.
    field.forEach((r) => {
      const norm = hi > lo ? (r.score - lo) / (hi - lo) : 0.5;
      r.duration = 3.6 - norm * 1.4;
    });
    setResult(null);
    setGo(false);
    setRunners(field);
  };

  const collect = () => {
    if (!result) return;
    onRace(result.finish, result.prize, RACE_COST);
    setRunners(null);
    setGo(false);
    setResult(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-950 to-gray-950 text-white flex flex-col py-3 px-3">
      <div className="w-full max-w-sm mx-auto flex-1">
        <div className="flex items-center justify-between mb-3">
          <button onClick={onBack} className="px-3 py-2 bg-gray-700 rounded-lg font-black text-sm">← Back</button>
          <div className="font-black text-white text-lg">🐎 Racing Stable</div>
          <div className="flex items-center gap-1 bg-gray-800 rounded-lg px-2 py-1 text-sm font-black text-yellow-300">
            <StarIcon />{career.money}
          </div>
        </div>

        {/* No horse yet → the stable to buy one */}
        {!horse && (
          <>
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 mb-3 text-[11px] text-gray-300 leading-snug text-center">
              Buy a racehorse and enter it in races to win prize money. Racing tires your horse — its energy comes back as the season plays out.
            </div>
            <div className="space-y-2">
              {STABLE.map((s) => {
                const canAfford = career.money >= s.price;
                return (
                  <div key={s.horse.name} className="bg-gray-800 border border-gray-700 rounded-xl p-3 flex items-center gap-3">
                    <div className="text-3xl">🐎</div>
                    <div className="flex-1">
                      <div className="font-black text-white text-sm">{s.horse.name}</div>
                      <div className="text-[10px] text-gray-400">{s.horse.breed} · SPD {s.horse.speed} · STA {s.horse.stamina}</div>
                    </div>
                    <button
                      onClick={() => canAfford && onBuyHorse({ ...s.horse, energy: 100, racesRun: 0, racesWon: 0, earnings: 0 }, s.price)}
                      disabled={!canAfford}
                      className={`px-3 py-2 rounded-lg font-black text-xs flex items-center gap-1 ${canAfford ? "bg-emerald-500 hover:bg-emerald-400" : "bg-gray-700 text-gray-500"}`}
                    >
                      <StarIcon />{s.price}
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Owns a horse, not racing → paddock */}
        {horse && !runners && (
          <>
            <div className="bg-gradient-to-b from-emerald-800/40 to-gray-800 border border-emerald-700/50 rounded-xl p-4 mb-3">
              <div className="flex items-center gap-3 mb-3">
                <div className="text-5xl">🐎</div>
                <div className="flex-1">
                  <div className="font-black text-white text-lg">{horse.name}</div>
                  <div className="text-[11px] text-gray-400">{horse.breed}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-center mb-3">
                <Stat label="Speed" value={horse.speed} />
                <Stat label="Stamina" value={horse.stamina} />
              </div>
              <div className="mb-1 flex justify-between text-[10px] font-bold text-gray-300">
                <span>Energy</span><span>{horse.energy}%</span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-black/40 overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${horse.energy}%`, background: horse.energy >= RACE_COST ? "linear-gradient(to right,#22c55e,#eab308)" : "#ef4444" }} />
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[10px]">
                <RecordChip label="Runs" value={horse.racesRun} />
                <RecordChip label="Wins" value={horse.racesWon} />
                <RecordChip label="Winnings" value={`★${horse.earnings}`} />
              </div>
            </div>

            <button
              onClick={startRace}
              disabled={horse.energy < RACE_COST}
              className={`w-full py-3 rounded-xl font-black text-lg ${horse.energy >= RACE_COST ? "bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400" : "bg-gray-700 text-gray-500"}`}
            >
              {horse.energy >= RACE_COST ? `Enter Race (−${RACE_COST} energy)` : "Too tired — rest needed"}
            </button>
            {horse.energy < RACE_COST && (
              <div className="mt-2 text-[10px] text-center text-gray-400">Your horse regains {20} energy after each match you play.</div>
            )}
          </>
        )}

        {/* Racing → animated track */}
        {runners && (
          <div className="bg-gradient-to-b from-emerald-700 to-emerald-900 border-2 border-emerald-600 rounded-xl p-3 overflow-hidden">
            <div className="space-y-2 relative">
              {/* Finish line */}
              <div className="absolute right-1 top-0 bottom-0 w-1 bg-white/70" style={{ backgroundImage: "repeating-linear-gradient(0deg,#fff 0 6px,#111 6px 12px)" }} />
              {runners.map((r, i) => (
                <div key={i} className="relative h-8 bg-emerald-800/40 rounded">
                  <div
                    className="absolute top-1/2 -translate-y-1/2 text-2xl whitespace-nowrap"
                    style={{
                      left: go ? "88%" : "2%",
                      transition: `left ${r.duration}s cubic-bezier(0.4,0.1,0.7,1)`,
                    }}
                  >
                    <span className="drop-shadow">🐎</span>
                  </div>
                  <div className={`absolute left-1 top-1/2 -translate-y-1/2 text-[9px] font-black ${r.isUser ? "text-yellow-300" : "text-white/70"}`}>
                    {r.isUser ? "YOU" : r.name}
                  </div>
                </div>
              ))}
            </div>

            {result && (
              <div className="mt-3 text-center">
                <div className={`text-3xl font-black ${result.finish === 1 ? "text-yellow-300" : result.finish <= 3 ? "text-emerald-300" : "text-gray-300"}`}>
                  {ordinal(result.finish)} place
                </div>
                <div className="text-sm font-bold mt-1">
                  {result.prize > 0 ? <span className="text-emerald-300">Won ★{result.prize}!</span> : <span className="text-gray-400">Out of the money.</span>}
                </div>
                <button onClick={collect} className="mt-3 w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 rounded-xl font-black">
                  {result.prize > 0 ? "Collect Winnings" : "Back to Stable"}
                </button>
              </div>
            )}
            {!result && (
              <div className="mt-3 text-center text-xs font-black text-white/80 animate-pulse">And they&apos;re off!</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ordinal(n: number) {
  return n === 1 ? "1st" : n === 2 ? "2nd" : n === 3 ? "3rd" : `${n}th`;
}
function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-gray-900/50 rounded-lg py-1.5">
      <div className="text-[9px] uppercase tracking-widest text-gray-400 font-bold">{label}</div>
      <div className="text-lg font-black text-emerald-300 tabular-nums">{value}</div>
    </div>
  );
}
function RecordChip({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="bg-gray-900/50 rounded-lg py-1.5">
      <div className="text-gray-400 font-bold">{label}</div>
      <div className="text-white font-black">{value}</div>
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
