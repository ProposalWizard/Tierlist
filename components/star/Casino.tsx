"use client";
import { useState, useEffect, useCallback } from "react";
import type { CareerState, Horse } from "@/lib/star/types";
import { shuffle } from "@/lib/shuffle";
import {
  BET_COMPETITIONS, oddsFor, entrantsFor, type BetCompetition, type CompetitionBet, type BetEntrant,
} from "@/lib/star/competitionBetting";

interface Props {
  bankStart: number;
  career: CareerState;
  onExit: (finalBank: number) => void;
  onHorseRace: (finish: number, prize: number, energyCost: number) => void;
  onBuyHorse: (horse: Horse, price: number) => void;
  onPlaceBet: (bet: Omit<CompetitionBet, "id">) => void;
}

// Horses available for purchase (same as former HorseRacing.tsx STABLE)
const PURCHASABLE_HORSES: { horse: Omit<Horse, "energy" | "racesRun" | "racesWon" | "earnings">; price: number }[] = [
  { horse: { name: "Clover Lad", breed: "Cob", speed: 55, stamina: 58 }, price: 30 },
  { horse: { name: "Midnight Dash", breed: "Thoroughbred", speed: 68, stamina: 62 }, price: 60 },
  { horse: { name: "Golden Arrow", breed: "Arabian", speed: 78, stamina: 72 }, price: 120 },
  { horse: { name: "Thunderhoof", breed: "Champion", speed: 88, stamina: 84 }, price: 240 },
];

const HORSE_NAMES = [
  "Thunder Bolt", "Golden Arrow", "Midnight Star", "Silver Streak", "Red Comet",
  "Wild Spirit", "Iron Duke", "Bold Ruler", "Grey Storm", "Nimbus",
  "Blaze", "Royal Flash", "Diamond Dash", "Lucky Strike", "Storm Chaser",
];

const MY_HORSE_RACE_COST = 40;

/**
 * BET AMOUNTS — A REAL STEP TABLE, NOT ±1.
 *
 * Requested directly, with the exact sequence given: every press used to
 * move the bet by a single star, which is fine for deciding between 4 and 5
 * but useless for getting from 1 to anything worth calling a bet — a real
 * session's bankroll runs into the thousands, and pressing a button that
 * many times to get there is not a control, it's a chore. This is the given
 * sequence verbatim: 1-10 by small steps, 10-1000 in round hundreds, then
 * increasingly coarse steps up to a million, the same shape a real casino's
 * chip denominations use.
 */
const BET_STEPS: number[] = [
  1, 2, 5, 10, 25, 50, 100, 150, 200, 250, 300, 400, 500, 600, 700, 800, 900, 1000,
  1250, 1500, 1750, 2000, 2500, 3000, 3500, 4000, 5000, 6000, 7000, 8000, 9000, 10000,
  12500, 15000, 17500, 20000, 25000, 30000, 35000, 40000, 50000, 60000, 70000, 80000, 90000, 100000,
  250000, 500000, 1000000,
];

/** The nearest step at or below `n` — for clamping a saved/previous bet down
 *  to whatever the current bank can actually afford. */
function stepAtOrBelow(n: number): number {
  let best = BET_STEPS[0];
  for (const s of BET_STEPS) { if (s <= n) best = s; else break; }
  return best;
}

const BET_STORAGE_KEY = "star-casino-bet";

export default function CasinoMenu({ bankStart, career, onExit, onHorseRace, onBuyHorse, onPlaceBet }: Props) {
  const [game, setGame] = useState<"menu" | "blackjack" | "roulette" | "slots" | "horses" | "bets">("menu");
  const [bank, setBank] = useState(bankStart);
  const [bet, setBet] = useState(1);

  // Persisted the same way the match speed button is (star-match-speed):
  // read once on mount, written back on every change, so it holds across
  // casino visits — "if I left it on ten star money as the bet, the next
  // time I came to do a bet it would still be on ten."
  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem(BET_STORAGE_KEY));
      if (BET_STEPS.includes(saved)) setBet(stepAtOrBelow(Math.min(saved, bankStart)));
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const changeBet = useCallback((direction: 1 | -1) => {
    setBet((b) => {
      const i = BET_STEPS.indexOf(b);
      // A bet that predates this table (or was clamped to a non-step value
      // by the bank cap below) may not sit exactly on a step — fall back to
      // the nearest one below it first, so a press always moves from a real
      // rung rather than getting stuck between two of them.
      const cur = i >= 0 ? i : BET_STEPS.indexOf(stepAtOrBelow(b));
      const next = Math.max(0, Math.min(BET_STEPS.length - 1, cur + direction));
      const value = Math.min(BET_STEPS[next], Math.max(1, bank));
      try { localStorage.setItem(BET_STORAGE_KEY, String(value)); } catch { /* ignore */ }
      return value;
    });
  }, [bank]);

  if (game === "blackjack") {
    return <Blackjack bank={bank} bet={bet} onSetBank={setBank} onExit={() => setGame("menu")} onChangeBet={changeBet} />;
  }
  if (game === "roulette") {
    return <Roulette bank={bank} bet={bet} onSetBank={setBank} onExit={() => setGame("menu")} onChangeBet={changeBet} />;
  }
  if (game === "slots") {
    return <Slots bank={bank} bet={bet} onSetBank={setBank} onExit={() => setGame("menu")} onChangeBet={changeBet} />;
  }
  if (game === "horses") {
    return (
      <HorseRacingGame
        bank={bank}
        bet={bet}
        career={career}
        onSetBank={setBank}
        onExit={() => setGame("menu")}
        onChangeBet={changeBet}
        onHorseRace={onHorseRace}
        onBuyHorse={onBuyHorse}
      />
    );
  }
  if (game === "bets") {
    return (
      <CompetitionBetting
        bank={bank}
        bet={bet}
        career={career}
        onSetBank={setBank}
        onExit={() => setGame("menu")}
        onChangeBet={changeBet}
        onPlaceBet={onPlaceBet}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-900 to-green-950 text-white flex flex-col items-center py-3 px-3">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 mb-4">
          <button onClick={() => onExit(bank)} className="px-3 py-2 bg-gray-700 rounded-lg font-black text-sm">← Back</button>
          <div className="flex-1 bg-gray-700 rounded-lg px-3 py-2 flex items-center justify-between border border-gray-600">
            <span className="font-black text-white text-sm">Bank</span>
            <span className="flex items-center gap-1 font-black text-yellow-300"><StarIcon />{bank}</span>
          </div>
        </div>

        <div className="space-y-3">
          <button
            disabled={bank < 1}
            onClick={() => setGame("blackjack")}
            className="w-full py-6 bg-gray-700 hover:bg-gray-600 border-2 border-gray-600 rounded-2xl font-black text-2xl flex items-center gap-4 px-6 transition disabled:opacity-40"
          >
            <div className="text-3xl">🃏</div>
            <div className="text-emerald-400">BLACK JACK</div>
          </button>
          <button
            disabled={bank < 1}
            onClick={() => setGame("roulette")}
            className="w-full py-6 bg-gray-700 hover:bg-gray-600 border-2 border-gray-600 rounded-2xl font-black text-2xl flex items-center gap-4 px-6 transition disabled:opacity-40"
          >
            <div className="text-3xl">🎡</div>
            <div className="text-emerald-400">ROULETTE</div>
          </button>
          <button
            disabled={bank < 1}
            onClick={() => setGame("slots")}
            className="w-full py-6 bg-gray-700 hover:bg-gray-600 border-2 border-gray-600 rounded-2xl font-black text-2xl flex items-center gap-4 px-6 transition disabled:opacity-40"
          >
            <div className="text-3xl">🎰</div>
            <div className="text-emerald-400">SLOTS</div>
          </button>
          <button
            disabled={bank < 1}
            onClick={() => setGame("horses")}
            className="w-full py-6 bg-gray-700 hover:bg-gray-600 border-2 border-gray-600 rounded-2xl font-black text-2xl flex items-center gap-4 px-6 transition disabled:opacity-40"
          >
            <div className="text-3xl">🐎</div>
            <div className="text-emerald-400">HORSE RACING</div>
          </button>
          <button
            disabled={bank < 1}
            onClick={() => setGame("bets")}
            className="w-full py-6 bg-gray-700 hover:bg-gray-600 border-2 border-gray-600 rounded-2xl font-black text-2xl flex items-center gap-4 px-6 transition disabled:opacity-40"
          >
            <div className="text-3xl">🏆</div>
            <div className="text-emerald-400">COMPETITION BETS</div>
          </button>
        </div>
      </div>
    </div>
  );
}

interface CasinoGameProps {
  bank: number;
  bet: number;
  onSetBank: (n: number) => void;
  onExit: () => void;
  /** Moves the bet one rung up or down BET_STEPS — not a raw amount. */
  onChangeBet: (direction: 1 | -1) => void;
}

function TopBar({ bank, bet, onExit, onChangeBet }: CasinoGameProps) {
  return (
    <div className="flex items-center gap-1 mb-3">
      <button onClick={onExit} className="px-2 py-2 bg-gray-700 rounded font-black text-xs">← Menu</button>
      <div className="flex-1 grid grid-cols-2 gap-1">
        <div className="bg-gray-700 rounded px-2 py-1.5 flex items-center justify-between border border-gray-600">
          <span className="font-black text-[10px] text-white">Bank</span>
          <span className="flex items-center gap-0.5 font-black text-yellow-300 text-xs"><StarIcon />{bank}</span>
        </div>
        <div className="bg-gray-700 rounded px-2 py-1.5 flex items-center justify-between border border-gray-600">
          <span className="font-black text-[10px] text-white">Bet</span>
          <div className="flex items-center gap-1">
            <button onClick={() => onChangeBet(-1)} className="text-red-400 font-black text-sm">▼</button>
            <span className="flex items-center gap-0.5 font-black text-yellow-300 text-xs"><StarIcon />{bet}</span>
            <button onClick={() => onChangeBet(1)} className="text-emerald-400 font-black text-sm">▲</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- HORSE RACING ----------
interface RaceHorse {
  name: string;
  rating: number;
  odds: number;
}
interface RaceRunner {
  name: string;
  rating: number;
  score: number;
  duration: number;
  isUser: boolean;
}

function generateRaceHorses(): RaceHorse[] {
  const shuffled = shuffle(HORSE_NAMES);
  const horses: RaceHorse[] = [];
  for (let i = 0; i < 6; i++) {
    const rating = 40 + Math.floor(Math.random() * 56); // 40-95
    const odds = Math.max(1.5, 12 - rating / 10);
    horses.push({ name: shuffled[i], rating, odds: Math.round(odds * 10) / 10 });
  }
  return horses;
}

interface HorseRacingProps extends CasinoGameProps {
  career: CareerState;
  onHorseRace: (finish: number, prize: number, energyCost: number) => void;
  onBuyHorse: (horse: Horse, price: number) => void;
}

function HorseRacingGame(props: HorseRacingProps) {
  const [tab, setTab] = useState<"bet" | "my-horses">("bet");
  const [horses, setHorses] = useState<RaceHorse[]>(() => generateRaceHorses());
  const [selectedHorse, setSelectedHorse] = useState<number | null>(null);
  const [runners, setRunners] = useState<RaceRunner[] | null>(null);
  const [go, setGo] = useState(false);
  const [result, setResult] = useState<{ finish: number; payout: number; winnerName: string } | null>(null);
  const [isMyHorseRace, setIsMyHorseRace] = useState(false);

  const ownsStable = props.career.ownedItems.some((i) => i.id === "stable");
  const myHorse = props.career.horse;

  // Start CSS transition one tick after lanes mount
  useEffect(() => {
    if (runners && !go) {
      const t = setTimeout(() => setGo(true), 60);
      return () => clearTimeout(t);
    }
  }, [runners, go]);

  // Reveal result once the slowest runner crosses the line
  useEffect(() => {
    if (runners && go && !result) {
      const maxDur = Math.max(...runners.map((r) => r.duration));
      const t = setTimeout(() => {
        const ordered = [...runners].sort((a, b) => b.score - a.score);
        const winnerName = ordered[0].name;
        if (isMyHorseRace) {
          // My horse race — prize based on finishing position
          const finish = ordered.findIndex((r) => r.isUser) + 1;
          const prizeMult = finish === 1 ? 5 : finish === 2 ? 2 : finish === 3 ? 1 : 0;
          const prize = props.bet * prizeMult;
          setResult({ finish, payout: prize, winnerName });
        } else {
          // Betting race — did our pick win?
          const betHorse = horses[selectedHorse!];
          const finish = ordered.findIndex((r) => r.name === betHorse.name) + 1;
          const payout = finish === 1 ? Math.round(props.bet * betHorse.odds) : 0;
          setResult({ finish, payout, winnerName });
        }
      }, maxDur * 1000 + 250);
      return () => clearTimeout(t);
    }
  }, [runners, go, result, isMyHorseRace, horses, selectedHorse, props.bet]);

  const placeBet = () => {
    if (selectedHorse === null || props.bank < props.bet) return;
    props.onSetBank(props.bank - props.bet);

    // Build runners from the race horses
    const field: RaceRunner[] = horses.map((h) => {
      const score = h.rating + Math.random() * 30;
      return { name: h.name, rating: h.rating, score, duration: 0, isUser: false };
    });

    const scores = field.map((r) => r.score);
    const lo = Math.min(...scores), hi = Math.max(...scores);
    field.forEach((r) => {
      const norm = hi > lo ? (r.score - lo) / (hi - lo) : 0.5;
      r.duration = 3.6 - norm * 1.4;
    });

    setIsMyHorseRace(false);
    setResult(null);
    setGo(false);
    setRunners(field);
  };

  const startMyHorseRace = () => {
    if (!myHorse || myHorse.energy < MY_HORSE_RACE_COST) return;
    const energyFactor = 0.6 + (myHorse.energy / 100) * 0.4;
    const userScore = (myHorse.speed * 0.55 + myHorse.stamina * 0.45) * energyFactor + Math.random() * 22;

    const field: RaceRunner[] = [{ name: myHorse.name, rating: Math.round((myHorse.speed + myHorse.stamina) / 2), score: userScore, duration: 0, isUser: true }];
    const rivalNames = shuffle(HORSE_NAMES.filter((n) => n !== myHorse.name));
    for (let i = 0; i < 5; i++) {
      const rating = 46 + Math.random() * 42;
      field.push({ name: rivalNames[i], rating: Math.round(rating), score: rating + Math.random() * 22, duration: 0, isUser: false });
    }

    const scores = field.map((r) => r.score);
    const lo = Math.min(...scores), hi = Math.max(...scores);
    field.forEach((r) => {
      const norm = hi > lo ? (r.score - lo) / (hi - lo) : 0.5;
      r.duration = 3.6 - norm * 1.4;
    });

    setIsMyHorseRace(true);
    setResult(null);
    setGo(false);
    setRunners(field);
  };

  const collectResult = () => {
    if (!result) return;
    if (isMyHorseRace) {
      props.onHorseRace(result.finish, result.payout, MY_HORSE_RACE_COST);
      if (result.payout > 0) props.onSetBank(props.bank + result.payout);
    } else {
      if (result.payout > 0) props.onSetBank(props.bank + result.payout);
    }
    setRunners(null);
    setGo(false);
    setResult(null);
    setHorses(generateRaceHorses());
    setSelectedHorse(null);
  };

  // Race animation view (shared by both bet and my-horse races)
  if (runners) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-900 to-green-950 text-white flex flex-col items-center py-3 px-3">
        <div className="w-full max-w-sm">
          <TopBar {...props} />
          <div className="bg-gradient-to-b from-emerald-700 to-emerald-900 border-2 border-emerald-600 rounded-xl p-3 overflow-hidden">
            <div className="space-y-2 relative">
              {/* Finish line */}
              <div className="absolute right-1 top-0 bottom-0 w-1 bg-white/70" style={{ backgroundImage: "repeating-linear-gradient(0deg,#fff 0 6px,#111 6px 12px)" }} />
              {runners.map((r, i) => {
                const isPickedOrUser = isMyHorseRace ? r.isUser : r.name === horses[selectedHorse!]?.name;
                return (
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
                    <div className={`absolute left-1 top-1/2 -translate-y-1/2 text-[9px] font-black ${isPickedOrUser ? "text-yellow-300" : "text-white/70"}`}>
                      {isMyHorseRace && r.isUser ? "YOU" : r.name}
                    </div>
                  </div>
                );
              })}
            </div>

            {result && (
              <div className="mt-3 text-center">
                {isMyHorseRace ? (
                  <>
                    <div className={`text-3xl font-black ${result.finish === 1 ? "text-yellow-300" : result.finish <= 3 ? "text-emerald-300" : "text-white/85"}`}>
                      {ordinal(result.finish)} Place
                    </div>
                    <div className="text-sm font-bold mt-1">
                      {result.payout > 0 ? <span className="text-emerald-300">Won ★{result.payout}!</span> : <span className="text-white/75">Out of the money.</span>}
                    </div>
                  </>
                ) : (
                  <>
                    <div className={`text-2xl font-black ${result.payout > 0 ? "text-yellow-300" : "text-red-400"}`}>
                      {result.payout > 0 ? `YOU WIN! +★${result.payout}` : "No luck!"}
                    </div>
                    <div className="text-sm text-white/85 mt-1">Winner: {result.winnerName}</div>
                  </>
                )}
                <button onClick={collectResult} className="mt-3 w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 rounded-xl font-black">
                  {result.payout > 0 ? "Collect Winnings" : "Next Race"}
                </button>
              </div>
            )}
            {!result && (
              <div className="mt-3 text-center text-xs font-black text-white/80 animate-pulse">And they&apos;re off!</div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-900 to-green-950 text-white flex flex-col items-center py-3 px-3">
      <div className="w-full max-w-sm">
        <TopBar {...props} />

        {/* Tabs */}
        {ownsStable && (
          <div className="flex gap-1 mb-3">
            <button
              onClick={() => setTab("bet")}
              className={`flex-1 py-2 rounded-lg font-black text-sm transition ${tab === "bet" ? "bg-emerald-600" : "bg-gray-700 text-white/75"}`}
            >Bet on Races</button>
            <button
              onClick={() => setTab("my-horses")}
              className={`flex-1 py-2 rounded-lg font-black text-sm transition ${tab === "my-horses" ? "bg-emerald-600" : "bg-gray-700 text-white/75"}`}
            >My Horses</button>
          </div>
        )}

        {/* Betting tab */}
        {tab === "bet" && (
          <>
            <div className="text-[10px] text-center text-white/75 mb-2">Pick a horse, place your bet, and watch the race!</div>
            <div className="space-y-2 mb-3">
              {horses.map((h, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedHorse(i)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition ${
                    selectedHorse === i
                      ? "bg-emerald-900/60 border-emerald-400"
                      : "bg-gray-800 border-gray-700 hover:border-gray-500"
                  }`}
                >
                  <div className="text-2xl">🐎</div>
                  <div className="flex-1 text-left">
                    <div className="font-black text-white text-sm">{h.name}</div>
                    <div className="text-[10px] text-white/75">Rating: {h.rating}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-black text-yellow-300 text-sm">{h.odds.toFixed(2)}</div>
                    <div className="text-[9px] text-white/65">odds</div>
                  </div>
                </button>
              ))}
            </div>
            <button
              disabled={selectedHorse === null || props.bank < props.bet}
              onClick={placeBet}
              className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 rounded-xl font-black disabled:opacity-40"
            >
              Place Bet — ★{props.bet}
            </button>
          </>
        )}

        {/* My Horses tab */}
        {tab === "my-horses" && ownsStable && (
          <>
            {!myHorse ? (
              <>
                <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 mb-3 text-[11px] text-white/85 leading-snug text-center">
                  Buy a racehorse and enter it in races to win prize money. Racing tires your horse — its energy comes back as the season plays out.
                </div>
                <div className="space-y-2">
                  {PURCHASABLE_HORSES.map((s) => {
                    const canAfford = props.bank >= s.price;
                    return (
                      <div key={s.horse.name} className="bg-gray-800 border border-gray-700 rounded-xl p-3 flex items-center gap-3">
                        <div className="text-3xl">🐎</div>
                        <div className="flex-1">
                          <div className="font-black text-white text-sm">{s.horse.name}</div>
                          <div className="text-[10px] text-white/75">{s.horse.breed} - SPD {s.horse.speed} - STA {s.horse.stamina}</div>
                        </div>
                        <button
                          onClick={() => {
                            if (canAfford) {
                              props.onBuyHorse({ ...s.horse, energy: 100, racesRun: 0, racesWon: 0, earnings: 0 }, s.price);
                              props.onSetBank(props.bank - s.price);
                            }
                          }}
                          disabled={!canAfford}
                          className={`px-3 py-2 rounded-lg font-black text-xs flex items-center gap-1 ${canAfford ? "bg-emerald-500 hover:bg-emerald-400" : "bg-gray-700 text-white/65"}`}
                        >
                          <StarIcon />{s.price}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <>
                <div className="bg-gradient-to-b from-emerald-800/40 to-gray-800 border border-emerald-700/50 rounded-xl p-4 mb-3">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="text-5xl">🐎</div>
                    <div className="flex-1">
                      <div className="font-black text-white text-lg">{myHorse.name}</div>
                      <div className="text-[11px] text-white/75">{myHorse.breed}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-center mb-3">
                    <div className="bg-gray-900/50 rounded-lg py-1.5">
                      <div className="text-[9px] uppercase tracking-widest text-white/75 font-bold">Speed</div>
                      <div className="text-lg font-black text-emerald-300 tabular-nums">{myHorse.speed}</div>
                    </div>
                    <div className="bg-gray-900/50 rounded-lg py-1.5">
                      <div className="text-[9px] uppercase tracking-widest text-white/75 font-bold">Stamina</div>
                      <div className="text-lg font-black text-emerald-300 tabular-nums">{myHorse.stamina}</div>
                    </div>
                  </div>
                  <div className="mb-1 flex justify-between text-[10px] font-bold text-white/85">
                    <span>Energy</span><span>{myHorse.energy}%</span>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-black/40 overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${myHorse.energy}%`, background: myHorse.energy >= MY_HORSE_RACE_COST ? "linear-gradient(to right,#22c55e,#eab308)" : "#ef4444" }} />
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[10px]">
                    <div className="bg-gray-900/50 rounded-lg py-1.5">
                      <div className="text-white/75 font-bold">Runs</div>
                      <div className="text-white font-black">{myHorse.racesRun}</div>
                    </div>
                    <div className="bg-gray-900/50 rounded-lg py-1.5">
                      <div className="text-white/75 font-bold">Wins</div>
                      <div className="text-white font-black">{myHorse.racesWon}</div>
                    </div>
                    <div className="bg-gray-900/50 rounded-lg py-1.5">
                      <div className="text-white/75 font-bold">Winnings</div>
                      <div className="text-white font-black">★{myHorse.earnings}</div>
                    </div>
                  </div>
                </div>

                <div className="text-[10px] text-center text-white/75 mb-2">Prize: 1st = bet x5, 2nd = bet x2, 3rd = bet x1</div>

                <button
                  onClick={startMyHorseRace}
                  disabled={myHorse.energy < MY_HORSE_RACE_COST}
                  className={`w-full py-3 rounded-xl font-black text-lg ${myHorse.energy >= MY_HORSE_RACE_COST ? "bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400" : "bg-gray-700 text-white/65"}`}
                >
                  {myHorse.energy >= MY_HORSE_RACE_COST ? `Enter Race (-${MY_HORSE_RACE_COST} energy)` : "Too tired — rest needed"}
                </button>
                {myHorse.energy < MY_HORSE_RACE_COST && (
                  <div className="mt-2 text-[10px] text-center text-white/75">Your horse regains 20 energy after each match you play.</div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ordinal(n: number) {
  return n === 1 ? "1st" : n === 2 ? "2nd" : n === 3 ? "3rd" : `${n}th`;
}

// ---------- COMPETITION BETS ----------
//
// Requested directly: bet on the winner of any competition, priced off real
// team ratings — see lib/star/competitionBetting.ts for the actual odds
// model and settlement. This screen only lays a stake and shows what's
// already down; nothing here decides who wins anything.
interface CompetitionBettingProps extends CasinoGameProps {
  career: CareerState;
  onPlaceBet: (bet: Omit<CompetitionBet, "id">) => void;
}

function CompetitionBetting(props: CompetitionBettingProps) {
  const [tab, setTab] = useState<BetCompetition>("league");
  const [placed, setPlaced] = useState<{ club: string; odds: number } | null>(null);
  const book: BetEntrant[] = oddsFor(entrantsFor(tab, props.career));
  const pending = (props.career.competitionBets ?? []).filter(b => b.season === props.career.season);

  const place = (entry: BetEntrant) => {
    if (props.bank < props.bet) return;
    props.onSetBank(props.bank - props.bet);
    props.onPlaceBet({
      competition: tab, club: entry.name, odds: entry.odds, stake: props.bet, season: props.career.season,
    });
    setPlaced({ club: entry.name, odds: entry.odds });
    setTimeout(() => setPlaced(null), 1400);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-900 to-green-950 text-white flex flex-col items-center py-3 px-3">
      <div className="w-full max-w-sm">
        <TopBar {...props} />

        <div className="grid grid-cols-5 gap-1 mb-3">
          {BET_COMPETITIONS.map(c => (
            <button
              key={c.id}
              onClick={() => setTab(c.id)}
              className={`py-2 rounded-lg font-black text-[9px] uppercase leading-tight transition ${
                tab === c.id ? "bg-emerald-600" : "bg-gray-700 text-white/70"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {placed && (
          <div className="mb-2 rounded-lg bg-emerald-600/80 border border-emerald-300 px-3 py-2 text-center text-xs font-black">
            Bet placed: {placed.club} @ {placed.odds.toFixed(2)}
          </div>
        )}

        <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden max-h-80 overflow-y-auto">
          {book.map(entry => (
            <button
              key={entry.name}
              onClick={() => place(entry)}
              disabled={props.bank < props.bet}
              className="w-full flex items-center justify-between gap-2 px-3 py-2.5 border-b border-black/20 last:border-b-0 hover:bg-gray-700 disabled:opacity-40 text-left"
            >
              <span className="font-bold text-white text-sm truncate">{entry.name}</span>
              <span className="shrink-0 font-black text-yellow-300 text-sm tabular-nums">{entry.odds.toFixed(2)}</span>
            </button>
          ))}
        </div>
        <div className="mt-2 text-[10px] text-center text-white/65">
          Tap a club to bet ★{props.bet} on them to win the {BET_COMPETITIONS.find(c => c.id === tab)?.label}.
        </div>

        {pending.length > 0 && (
          <div className="mt-4">
            <div className="mb-1.5 text-[10px] font-black uppercase tracking-widest text-white/60">
              Your bets this season
            </div>
            <div className="space-y-1.5">
              {pending.map((b, i) => {
                const label = BET_COMPETITIONS.find(c => c.id === b.competition)?.label ?? b.competition;
                return (
                  <div key={i} className="bg-gray-800/70 border border-gray-700 rounded-lg px-3 py-2 flex items-center justify-between text-[11px]">
                    <div>
                      <span className="font-bold text-white">{b.club}</span>
                      <span className="text-white/55"> — {label}</span>
                    </div>
                    <div className="font-black text-yellow-300 tabular-nums">
                      ★{b.stake} @ {b.odds.toFixed(2)} → ★{Math.round(b.stake * b.odds)}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-1.5 text-[9px] text-center text-white/50">
              Settles at the end of the season, against the real result.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- BLACKJACK ----------
type Card = { rank: string; value: number; suit: "♥" | "♠" | "♦" | "♣" };
const DECK: string[] = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const SUITS: Array<"♥" | "♠" | "♦" | "♣"> = ["♥", "♠", "♦", "♣"];

function drawCard(): Card {
  const r = DECK[Math.floor(Math.random() * DECK.length)];
  const v = r === "A" ? 11 : ["J", "Q", "K"].includes(r) ? 10 : parseInt(r, 10);
  const suit = SUITS[Math.floor(Math.random() * SUITS.length)];
  return { rank: r, value: v, suit };
}

function handValue(cards: Card[]): number {
  let total = cards.reduce((s, c) => s + c.value, 0);
  let aces = cards.filter((c) => c.rank === "A").length;
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return total;
}

function Blackjack(props: CasinoGameProps) {
  // Requested directly: pressing Black Jack used to deal both hands
  // instantly, before the bet was even decided — "it's a bit misconstruing
  // the way that does it." A real "bet" phase now sits in front of every
  // hand (the first one included): the table is empty, the TopBar's own
  // bet +/- is right there to adjust, and nothing is drawn or staked until
  // you press Deal yourself.
  const [player, setPlayer] = useState<Card[]>([]);
  const [dealer, setDealer] = useState<Card[]>([]);
  const [revealedDealerCount, setRevealedDealerCount] = useState(0);
  const [phase, setPhase] = useState<"bet" | "play" | "dealer-turn" | "done">("bet");
  const [message, setMessage] = useState("");

  const deal = () => {
    if (props.bank < props.bet) return;
    setPlayer([drawCard(), drawCard()]);
    setDealer([drawCard(), drawCard()]);
    setRevealedDealerCount(1); // second card hidden until Hold
    setPhase("play");
    setMessage("");
    props.onSetBank(props.bank - props.bet);
  };

  const startRound = () => {
    // Back to the bet screen, not straight into a new hand — same reasoning
    // as the initial deal: the bet is worth a deliberate look between hands
    // too, not just the very first one.
    setPlayer([]);
    setDealer([]);
    setRevealedDealerCount(0);
    setMessage("");
    setPhase("bet");
  };

  const hit = () => {
    if (phase !== "play") return;
    const next = [...player, drawCard()];
    setPlayer(next);
    if (handValue(next) > 21) {
      // Bust — reveal dealer card and end
      setRevealedDealerCount(dealer.length);
      setMessage("BUST!");
      setPhase("done");
    }
  };

  const hold = async () => {
    if (phase !== "play") return;
    setPhase("dealer-turn");
    // Step 1: reveal dealer's second card after brief pause
    await new Promise((r) => setTimeout(r, 700));
    setRevealedDealerCount(2);
    await new Promise((r) => setTimeout(r, 900));

    // Step 2: dealer draws until 17+, one card at a time with delay
    let d = [...dealer];
    while (handValue(d) < 17) {
      d = [...d, drawCard()];
      setDealer(d);
      setRevealedDealerCount(d.length);
      await new Promise((r) => setTimeout(r, 900));
    }

    // Step 3: decide result after a short beat
    await new Promise((r) => setTimeout(r, 400));
    const p = handValue(player);
    const dv = handValue(d);
    if (dv > 21) {
      setMessage("DEALER BUSTS — YOU WIN!");
      props.onSetBank(props.bank + props.bet * 2);
    } else if (p > dv) {
      setMessage("YOU WIN!");
      props.onSetBank(props.bank + props.bet * 2);
    } else if (p === dv) {
      setMessage("PUSH");
      props.onSetBank(props.bank + props.bet);
    } else {
      setMessage("DEALER WINS");
    }
    setPhase("done");
  };

  const dealt = phase !== "bet";
  const done = phase === "done";
  const showingSecondCard = revealedDealerCount >= 2;

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-900 to-green-950 text-white flex flex-col items-center py-3 px-3">
      <div className="w-full max-w-sm">
        <TopBar {...props} />
        <div className="relative aspect-[3/4] bg-green-700 rounded-2xl border-4 border-yellow-700 p-4 flex flex-col justify-between overflow-hidden">
          <div>
            <div className="text-[10px] font-black uppercase text-yellow-200 mb-2">Dealer</div>
            <div className="flex gap-2">
              {dealer.map((c, i) => (
                <div key={i} className={`transition-all duration-500 ${i === 1 && !showingSecondCard ? "" : "animate-[dealCard_500ms_ease-out]"}`}>
                  <CardView card={c} hidden={i >= revealedDealerCount} />
                </div>
              ))}
            </div>
            {dealt && (
              <div className="text-white font-black mt-1">
                {showingSecondCard ? handValue(dealer.slice(0, revealedDealerCount)) : "?"}
              </div>
            )}
          </div>

          {phase === "bet" && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none px-6">
              <div className="text-center text-sm font-bold text-white/70">
                Set your bet above, then deal yourself in.
              </div>
            </div>
          )}

          {message && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className={`text-3xl font-black text-yellow-300 bg-black/70 px-4 py-2 rounded-lg text-center ${message.includes("WIN") ? "text-emerald-300" : message.includes("BUST") || message.includes("DEALER WINS") ? "text-red-400" : ""}`}>
                {message}
              </div>
            </div>
          )}

          <div>
            {dealt && <div className="text-white font-black mb-1">{handValue(player)}</div>}
            <div className="flex gap-2">
              {player.map((c, i) => (
                <CardView key={i} card={c} />
              ))}
            </div>
            <div className="text-[10px] font-black uppercase text-yellow-200 mt-2">Player</div>
          </div>
        </div>

        {phase === "bet" && (
          <button
            disabled={props.bank < props.bet}
            onClick={deal}
            className="mt-3 w-full py-3 bg-emerald-500 hover:bg-emerald-400 rounded-xl font-black disabled:opacity-40"
          >
            Deal — ★{props.bet}
          </button>
        )}
        {phase === "play" && (
          <div className="grid grid-cols-2 gap-2 mt-3">
            <button onClick={hold} className="py-3 bg-red-600 hover:bg-red-500 rounded-xl font-black">✕ Hold</button>
            <button onClick={hit} className="py-3 bg-emerald-500 hover:bg-emerald-400 rounded-xl font-black">✓ Hit</button>
          </div>
        )}
        {phase === "dealer-turn" && (
          <div className="mt-3 py-3 text-center text-yellow-200 font-black animate-pulse">Dealer drawing...</div>
        )}
        {done && (
          <button
            onClick={startRound}
            className="mt-3 w-full py-3 bg-emerald-500 hover:bg-emerald-400 rounded-xl font-black"
          >
            New Hand
          </button>
        )}
      </div>
    </div>
  );
}

function CardView({ card, hidden }: { card: Card; hidden?: boolean }) {
  if (hidden) {
    return (
      <div className="w-14 h-20 rounded-lg bg-gradient-to-br from-blue-700 to-blue-900 border-2 border-white flex items-center justify-center shadow-lg">
        <div className="w-8 h-14 border-2 border-white/30 rounded" />
      </div>
    );
  }
  const red = card.suit === "♥" || card.suit === "♦";
  return (
    <div className="w-14 h-20 rounded-lg bg-white border-2 border-gray-300 flex flex-col items-center justify-center shadow-lg relative">
      <div className={`text-2xl font-black ${red ? "text-red-600" : "text-black"}`}>{card.rank}</div>
      <div className={`text-lg ${red ? "text-red-600" : "text-black"}`}>{card.suit}</div>
    </div>
  );
}

// ---------- ROULETTE ----------
// European roulette (0-36). Numbers laid around a wheel in canonical order.
const ROULETTE_ORDER = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23,
  10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
];
const RED_NUMBERS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

function isRed(n: number) { return RED_NUMBERS.has(n); }
function pocketColor(n: number) {
  if (n === 0) return "#059669"; // green
  return isRed(n) ? "#dc2626" : "#111827";
}

function Roulette(props: CasinoGameProps) {
  const [choice, setChoice] = useState<"red" | "black" | "even" | "odd" | number | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [wheelRotation, setWheelRotation] = useState(0);
  const [result, setResult] = useState<number | null>(null);
  const [message, setMessage] = useState("");

  const spin = () => {
    if (choice === null) return;
    props.onSetBank(props.bank - props.bet);
    setSpinning(true);
    setResult(null);
    setMessage("");

    // Pick winner + compute rotation.
    // Each pocket = 360 / 37 degrees. Rotate the wheel so the winning pocket lands under the pointer (top).
    const winner = Math.floor(Math.random() * 37);
    const winnerIdx = ROULETTE_ORDER.indexOf(winner);
    const anglePer = 360 / 37;
    // Wheel spins clockwise multiple times, then stops with winner at the top pointer.
    // Base rotation to align winner: 360 - winnerIdx * anglePer
    const target = 360 - winnerIdx * anglePer;
    const revolutions = 6 + Math.floor(Math.random() * 3);
    const finalRotation = wheelRotation + revolutions * 360 + (target - (wheelRotation % 360));
    setWheelRotation(finalRotation);

    setTimeout(() => {
      setResult(winner);
      setSpinning(false);
      let win = 0;
      const redWin = isRed(winner);
      if (typeof choice === "number" && choice === winner) win = props.bet * 35;
      else if (choice === "red" && redWin) win = props.bet * 2;
      else if (choice === "black" && !redWin && winner !== 0) win = props.bet * 2;
      else if (choice === "even" && winner !== 0 && winner % 2 === 0) win = props.bet * 2;
      else if (choice === "odd" && winner % 2 === 1) win = props.bet * 2;
      if (win > 0) {
        setMessage(`WIN! +★${win - props.bet}`);
        props.onSetBank(props.bank - props.bet + win);
      } else {
        setMessage("Lost!");
      }
    }, 4500);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-900 to-green-950 text-white flex flex-col items-center py-3 px-3">
      <div className="w-full max-w-sm">
        <TopBar {...props} />

        {/* Wheel */}
        <div className="bg-gradient-to-b from-yellow-900 to-yellow-950 border-4 border-yellow-600 rounded-2xl p-4 shadow-2xl">
          <div className="relative aspect-square">
            {/* Pointer at top */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 z-20">
              <svg width="28" height="28" viewBox="0 0 28 28">
                <path d="M14 0 L28 14 L14 24 L0 14 Z" fill="#fbbf24" stroke="#000" strokeWidth="1.5" />
              </svg>
            </div>

            {/* Wheel */}
            <div
              className="absolute inset-2 rounded-full border-4 border-yellow-500 shadow-inner overflow-hidden"
              style={{
                transform: `rotate(${wheelRotation}deg)`,
                transition: spinning ? "transform 4500ms cubic-bezier(0.15, 0.6, 0.2, 1)" : "none",
                background: "conic-gradient(from 0deg, " +
                  ROULETTE_ORDER.map((n, i) => {
                    const startPct = (i / 37) * 100;
                    const endPct = ((i + 1) / 37) * 100;
                    return `${pocketColor(n)} ${startPct}% ${endPct}%`;
                  }).join(", ") + ")",
              }}
            >
              {/* Number labels — one full-size layer per number, rotated so the
                  label sits in its pocket near the rim. */}
              {ROULETTE_ORDER.map((n, i) => {
                const angle = (i / 37) * 360 + 360 / 74;
                return (
                  <div
                    key={i}
                    className="absolute inset-0 pointer-events-none"
                    style={{ transform: `rotate(${angle}deg)` }}
                  >
                    <span className="absolute left-1/2 top-0 -translate-x-1/2 pt-[3px] text-white font-black text-[10px] leading-none drop-shadow-[0_1px_1px_rgba(0,0,0,0.9)]">
                      {n}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Center hub */}
            <div className="absolute inset-[35%] rounded-full bg-gradient-to-br from-yellow-500 to-yellow-700 border-4 border-yellow-400 shadow-xl flex items-center justify-center">
              <div className={`text-3xl font-black text-white transition-opacity ${spinning ? "opacity-40" : "opacity-100"}`}>
                {spinning ? "?" : result ?? "?"}
              </div>
            </div>
          </div>

          {message && (
            <div className={`mt-3 text-center text-xl font-black ${message.includes("WIN") ? "text-emerald-300" : "text-red-400"}`}>{message}</div>
          )}
        </div>

        {/* Bet choices */}
        <div className="mt-3 grid grid-cols-4 gap-1.5">
          {(["red", "black", "even", "odd"] as const).map((c) => (
            <button
              key={c}
              disabled={spinning}
              onClick={() => setChoice(c)}
              className={`py-3 rounded font-black text-xs uppercase transition ${
                choice === c ? (c === "red" ? "bg-red-600" : c === "black" ? "bg-black text-white ring-2 ring-white" : "bg-emerald-500") : "bg-gray-700"
              }`}
            >{c}</button>
          ))}
        </div>
        <div className="mt-2 text-[10px] text-center text-white/75">Red/Black/Even/Odd: 2x • Single number: 35x</div>
        <div className="mt-2 grid grid-cols-6 gap-1 max-h-24 overflow-y-auto">
          {Array.from({ length: 37 }).map((_, i) => {
            const bg = i === 0 ? "bg-emerald-700" : isRed(i) ? "bg-red-700" : "bg-gray-900";
            return (
              <button
                key={i}
                disabled={spinning}
                onClick={() => setChoice(i)}
                className={`py-2 rounded text-xs font-black text-white ${choice === i ? "ring-2 ring-yellow-400" : ""} ${bg}`}
              >{i}</button>
            );
          })}
        </div>

        <button
          disabled={spinning || choice === null || props.bank < props.bet}
          onClick={spin}
          className="mt-3 w-full py-3 bg-emerald-500 hover:bg-emerald-400 rounded-xl font-black disabled:opacity-40"
        >
          {spinning ? "Spinning..." : `Spin — ★${props.bet}`}
        </button>
      </div>
    </div>
  );
}

// ---------- SLOTS ----------
const SLOTS_SYMBOLS = ["🍒", "🍋", "🍊", "🔔", "⭐", "7️⃣"];
function Slots(props: CasinoGameProps) {
  const [reels, setReels] = useState<string[]>(["🍒", "🍋", "🍊"]);
  const [spinning, setSpinning] = useState(false);
  const [message, setMessage] = useState("");

  const spin = () => {
    props.onSetBank(props.bank - props.bet);
    setSpinning(true);
    setMessage("");
    const roll = () => SLOTS_SYMBOLS[Math.floor(Math.random() * SLOTS_SYMBOLS.length)];
    let ticks = 0;
    const timer = setInterval(() => {
      setReels([roll(), roll(), roll()]);
      ticks++;
      if (ticks > 12) {
        clearInterval(timer);
        const final = [roll(), roll(), roll()];
        setReels(final);
        setSpinning(false);
        const [a, b, c] = final;
        let win = 0;
        if (a === b && b === c) {
          if (a === "7️⃣") win = props.bet * 20;
          else if (a === "⭐") win = props.bet * 10;
          else win = props.bet * 5;
        } else if (a === b || b === c) {
          win = props.bet;
        }
        if (win > 0) {
          setMessage(`WIN! +★${win - props.bet}`);
          props.onSetBank(props.bank - props.bet + win);
        } else {
          setMessage("No luck");
        }
      }
    }, 90);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-900 to-green-950 text-white flex flex-col items-center py-3 px-3">
      <div className="w-full max-w-sm">
        <TopBar {...props} />
        <div className="bg-yellow-800 border-4 border-yellow-500 rounded-2xl p-4">
          <div className="grid grid-cols-3 gap-2 bg-black rounded-xl p-3">
            {reels.map((r, i) => (
              <div key={i} className="aspect-square bg-white rounded-lg flex items-center justify-center text-6xl border-4 border-yellow-600">
                {r}
              </div>
            ))}
          </div>
          {message && (
            <div className={`mt-3 text-center text-xl font-black ${message.includes("WIN") ? "text-emerald-300" : "text-red-400"}`}>{message}</div>
          )}
          <div className="mt-3 text-[10px] text-center text-yellow-200">
            777 = 20x • ⭐⭐⭐ = 10x • Any triple = 5x • Any pair = 1x
          </div>
        </div>

        <button
          disabled={spinning || props.bank < props.bet}
          onClick={spin}
          className="mt-3 w-full py-3 bg-emerald-500 hover:bg-emerald-400 rounded-xl font-black disabled:opacity-40"
        >
          {spinning ? "Spinning..." : `Pull the Lever — ★${props.bet}`}
        </button>
      </div>
    </div>
  );
}

function StarIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="#fbbf24">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}
