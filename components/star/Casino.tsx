"use client";
import { useState, useEffect } from "react";

interface Props {
  bankStart: number;
  onExit: (finalBank: number) => void;
}

export default function CasinoMenu({ bankStart, onExit }: Props) {
  const [game, setGame] = useState<"menu" | "blackjack" | "roulette" | "slots">("menu");
  const [bank, setBank] = useState(bankStart);
  const [bet, setBet] = useState(1);

  const changeBet = (delta: number) => setBet((b) => Math.max(1, Math.min(bank, b + delta)));

  if (game === "blackjack") {
    return <Blackjack bank={bank} bet={bet} onSetBank={setBank} onExit={() => setGame("menu")} onChangeBet={changeBet} />;
  }
  if (game === "roulette") {
    return <Roulette bank={bank} bet={bet} onSetBank={setBank} onExit={() => setGame("menu")} onChangeBet={changeBet} />;
  }
  if (game === "slots") {
    return <Slots bank={bank} bet={bet} onSetBank={setBank} onExit={() => setGame("menu")} onChangeBet={changeBet} />;
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
  onChangeBet: (delta: number) => void;
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

// ---------- BLACKJACK ----------
type Card = { rank: string; value: number };
const DECK: string[] = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

function drawCard(): Card {
  const r = DECK[Math.floor(Math.random() * DECK.length)];
  const v = r === "A" ? 11 : ["J", "Q", "K"].includes(r) ? 10 : parseInt(r, 10);
  return { rank: r, value: v };
}

function handValue(cards: Card[]): number {
  let total = cards.reduce((s, c) => s + c.value, 0);
  let aces = cards.filter((c) => c.rank === "A").length;
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return total;
}

function Blackjack(props: CasinoGameProps) {
  const [player, setPlayer] = useState<Card[]>([drawCard(), drawCard()]);
  const [dealer, setDealer] = useState<Card[]>([drawCard(), drawCard()]);
  const [phase, setPhase] = useState<"play" | "reveal">("play");
  const [message, setMessage] = useState("");
  const [inRound, setInRound] = useState(true);

  const startRound = () => {
    setPlayer([drawCard(), drawCard()]);
    setDealer([drawCard(), drawCard()]);
    setPhase("play");
    setMessage("");
    setInRound(true);
    props.onSetBank(props.bank - props.bet);
  };

  useEffect(() => {
    // On initial mount, subtract bet
    props.onSetBank(props.bank - props.bet);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hit = () => {
    const next = [...player, drawCard()];
    setPlayer(next);
    if (handValue(next) > 21) {
      setPhase("reveal");
      setMessage("BUST!");
      setInRound(false);
    }
  };

  const hold = () => {
    let d = [...dealer];
    while (handValue(d) < 17) d.push(drawCard());
    setDealer(d);
    setPhase("reveal");
    const p = handValue(player);
    const dv = handValue(d);
    if (dv > 21 || p > dv) {
      setMessage("YOU WIN!");
      props.onSetBank(props.bank + props.bet * 2);
    } else if (p === dv) {
      setMessage("PUSH");
      props.onSetBank(props.bank + props.bet);
    } else {
      setMessage("DEALER WINS");
    }
    setInRound(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-900 to-green-950 text-white flex flex-col items-center py-3 px-3">
      <div className="w-full max-w-sm">
        <TopBar {...props} />
        <div className="relative aspect-[3/4] bg-green-700 rounded-2xl border-4 border-yellow-700 p-4 flex flex-col justify-between">
          <div>
            <div className="text-[10px] font-black uppercase text-yellow-200 mb-2">Dealer</div>
            <div className="flex gap-2">
              {dealer.map((c, i) => (
                <CardView key={i} card={c} hidden={phase === "play" && i > 0} />
              ))}
            </div>
            <div className="text-white font-black mt-1">
              {phase === "reveal" ? handValue(dealer) : "?"}
            </div>
          </div>

          {message && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-3xl font-black text-yellow-300 bg-black/60 px-4 py-2 rounded-lg">{message}</div>
            </div>
          )}

          <div>
            <div className="text-white font-black mb-1">{handValue(player)}</div>
            <div className="flex gap-2">
              {player.map((c, i) => (
                <CardView key={i} card={c} />
              ))}
            </div>
            <div className="text-[10px] font-black uppercase text-yellow-200 mt-2">Player</div>
          </div>
        </div>

        {inRound ? (
          <div className="grid grid-cols-2 gap-2 mt-3">
            <button onClick={hold} className="py-3 bg-red-600 hover:bg-red-500 rounded-xl font-black">✕ Hold</button>
            <button onClick={hit} className="py-3 bg-emerald-500 hover:bg-emerald-400 rounded-xl font-black">✓ Hit</button>
          </div>
        ) : (
          <button
            disabled={props.bank < props.bet}
            onClick={startRound}
            className="mt-3 w-full py-3 bg-emerald-500 hover:bg-emerald-400 rounded-xl font-black disabled:opacity-40"
          >
            Deal Again — ★{props.bet}
          </button>
        )}
      </div>
    </div>
  );
}

function CardView({ card, hidden }: { card: Card; hidden?: boolean }) {
  if (hidden) {
    return <div className="w-14 h-20 rounded-lg bg-blue-800 border-2 border-white flex items-center justify-center">
      <div className="w-8 h-14 border border-white/30 rounded" />
    </div>;
  }
  const red = card.rank === "A" || parseInt(card.rank) % 2 === 0;
  return (
    <div className="w-14 h-20 rounded-lg bg-white border-2 border-gray-300 flex flex-col items-center justify-center shadow-lg">
      <div className={`text-2xl font-black ${red ? "text-red-600" : "text-black"}`}>{card.rank}</div>
      <div className={`text-lg ${red ? "text-red-600" : "text-black"}`}>{red ? "♥" : "♠"}</div>
    </div>
  );
}

// ---------- ROULETTE ----------
function Roulette(props: CasinoGameProps) {
  const [choice, setChoice] = useState<"red" | "black" | "even" | "odd" | number | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<number | null>(null);
  const [message, setMessage] = useState("");

  const spin = () => {
    if (choice === null) return;
    props.onSetBank(props.bank - props.bet);
    setSpinning(true);
    setResult(null);
    setMessage("");
    setTimeout(() => {
      const n = Math.floor(Math.random() * 37); // 0-36
      setResult(n);
      setSpinning(false);
      let win = 0;
      const isRed = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36].includes(n);
      if (typeof choice === "number" && choice === n) win = props.bet * 35;
      else if (choice === "red" && isRed) win = props.bet * 2;
      else if (choice === "black" && !isRed && n !== 0) win = props.bet * 2;
      else if (choice === "even" && n !== 0 && n % 2 === 0) win = props.bet * 2;
      else if (choice === "odd" && n % 2 === 1) win = props.bet * 2;
      if (win > 0) {
        setMessage(`WIN! +★${win - props.bet}`);
        props.onSetBank(props.bank - props.bet + win);
      } else {
        setMessage("Lost!");
      }
    }, 1800);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-900 to-green-950 text-white flex flex-col items-center py-3 px-3">
      <div className="w-full max-w-sm">
        <TopBar {...props} />
        <div className="bg-green-700 border-4 border-yellow-700 rounded-2xl p-4">
          <div className="aspect-square rounded-full bg-gradient-to-br from-red-800 via-black to-red-800 border-8 border-yellow-600 flex items-center justify-center relative overflow-hidden">
            <div className={`text-6xl font-black text-white ${spinning ? "animate-spin" : ""}`} style={{ animationDuration: "0.4s" }}>
              {spinning ? "?" : result ?? "?"}
            </div>
          </div>
          {message && (
            <div className={`mt-3 text-center text-xl font-black ${message.includes("WIN") ? "text-emerald-300" : "text-red-400"}`}>{message}</div>
          )}
        </div>

        <div className="mt-3 grid grid-cols-4 gap-1.5">
          {(["red", "black", "even", "odd"] as const).map((c) => (
            <button
              key={c}
              disabled={spinning}
              onClick={() => setChoice(c)}
              className={`py-3 rounded font-black text-xs uppercase transition ${
                choice === c ? (c === "red" ? "bg-red-600" : c === "black" ? "bg-black text-white" : "bg-emerald-500") : "bg-gray-700"
              }`}
            >{c}</button>
          ))}
        </div>
        <div className="mt-2 text-[10px] text-center text-gray-400">Red/Black/Even/Odd: 2x • Single number: 35x</div>
        <div className="mt-2 grid grid-cols-6 gap-1">
          {Array.from({ length: 12 }).map((_, i) => (
            <button
              key={i}
              disabled={spinning}
              onClick={() => setChoice(i + 1)}
              className={`py-2 rounded text-xs font-black ${choice === i + 1 ? "bg-yellow-500 text-black" : "bg-gray-700"}`}
            >{i + 1}</button>
          ))}
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
