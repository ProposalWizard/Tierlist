"use client";
import { useState, useEffect, useMemo } from "react";
import { shuffle } from "@/lib/shuffle";

export type RelationshipKind = "boss" | "team" | "fans" | "sponsors" | "happiness";

interface Props {
  kind: RelationshipKind;
  currentValue: number;
  onComplete: (relationshipGain: number) => void;
  onCancel: () => void;
}

// Emoji pools per relationship — themed to fit
const EMOJI_POOLS: Record<RelationshipKind, string[]> = {
  boss:      ["💼", "📋", "🗂️", "📊", "☕", "🎩", "📞", "💡", "🖊️", "📅"],
  team:      ["👕", "⚽", "🏆", "🎯", "🥇", "🥋", "🎽", "🧤", "🥅", "🚿"],
  fans:      ["🧣", "📣", "🎉", "🎺", "🥁", "🎨", "🖼️", "🪧", "🔔", "🎇"],
  sponsors:  ["🤝", "💰", "📈", "🏦", "💎", "💳", "🧾", "🎁", "📦", "⭐"],
  happiness: ["😊", "🌈", "🎂", "🍕", "🎂", "🍦", "🎈", "🌻", "🦋", "🍭"],
};

const LABELS: Record<RelationshipKind, string> = {
  boss:      "Boss Meeting",
  team:      "Team Bonding",
  fans:      "Meet the Fans",
  sponsors:  "Sponsor Event",
  happiness: "Take a Break",
};

interface CardState {
  id: number;
  emoji: string;
  flipped: boolean;
  matched: boolean;
}

export default function RelationshipMinigame({ kind, currentValue, onComplete, onCancel }: Props) {
  const pool = EMOJI_POOLS[kind];
  // Deal 8 pairs = 16 cards in a 4x4 grid
  const [cards, setCards] = useState<CardState[]>(() => generateCards(pool));
  const [flippedIdxs, setFlippedIdxs] = useState<number[]>([]);
  const [lives, setLives] = useState(3);
  const [phase, setPhase] = useState<"playing" | "won" | "lost">("playing");
  const [locked, setLocked] = useState(false);

  const matchedCount = useMemo(() => cards.filter((c) => c.matched).length, [cards]);

  useEffect(() => {
    if (matchedCount === cards.length && phase === "playing") {
      setPhase("won");
    }
    if (lives <= 0 && phase === "playing") {
      setPhase("lost");
    }
  }, [matchedCount, cards.length, lives, phase]);

  const handleClick = (idx: number) => {
    if (locked || phase !== "playing") return;
    const card = cards[idx];
    if (card.matched || card.flipped) return;

    const nextCards = cards.map((c, i) => i === idx ? { ...c, flipped: true } : c);
    setCards(nextCards);
    const nextFlipped = [...flippedIdxs, idx];
    setFlippedIdxs(nextFlipped);

    if (nextFlipped.length === 2) {
      setLocked(true);
      const [a, b] = nextFlipped;
      if (nextCards[a].emoji === nextCards[b].emoji) {
        // Match — mark both as matched
        setTimeout(() => {
          setCards((prev) => prev.map((c, i) => i === a || i === b ? { ...c, matched: true } : c));
          setFlippedIdxs([]);
          setLocked(false);
        }, 500);
      } else {
        // No match — flip back
        setTimeout(() => {
          setCards((prev) => prev.map((c, i) => i === a || i === b ? { ...c, flipped: false } : c));
          setFlippedIdxs([]);
          setLives((l) => l - 1);
          setLocked(false);
        }, 900);
      }
    }
  };

  const finalise = () => {
    // Reward: 15 on win, 5 on loss (participation), scale by remaining lives
    const gain = phase === "won" ? 12 + lives * 2 : 4;
    onComplete(gain);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-800 to-gray-900 text-white flex flex-col items-center py-3 px-3">
      <div className="w-full max-w-sm flex-1 flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <button onClick={onCancel} className="px-3 py-2 bg-gray-700 rounded-lg font-black text-sm">← Back</button>
          <div className="text-center">
            <div className="text-[10px] font-black uppercase tracking-widest text-emerald-300">{LABELS[kind]}</div>
            <div className="text-xs text-white/75 font-bold">Currently {currentValue}/100</div>
          </div>
          <div className="flex items-center gap-1 bg-gray-700 rounded-lg px-2 py-2 border border-gray-600">
            {Array.from({ length: 3 }).map((_, i) => (
              <span key={i} className={`text-sm ${i < lives ? "opacity-100" : "opacity-20 grayscale"}`}>❤️</span>
            ))}
          </div>
        </div>

        <div className="bg-gray-700 rounded-xl border border-gray-600 p-3 mb-3 text-center">
          <div className="text-xs text-white/85">
            Match all pairs. Every miss costs a life. 3 misses and you go home tired.
          </div>
        </div>

        <div className="grid grid-cols-4 gap-1 max-w-[280px] mx-auto w-full">
          {cards.map((c, i) => (
            <button
              key={c.id}
              onClick={() => handleClick(i)}
              disabled={locked || phase !== "playing" || c.matched}
              className={`aspect-square rounded-lg border-2 flex items-center justify-center text-2xl transition-all duration-300 ${
                c.matched
                  ? "bg-emerald-800/40 border-emerald-500 opacity-50"
                  : c.flipped
                  ? "bg-white border-yellow-300 shadow-lg"
                  : "bg-gradient-to-br from-blue-700 to-blue-900 border-blue-500 hover:from-blue-600 hover:to-blue-800"
              }`}
              style={{
                transform: c.flipped || c.matched ? "rotateY(0deg)" : "rotateY(0deg)",
              }}
            >
              {(c.flipped || c.matched) ? (
                <span>{c.emoji}</span>
              ) : (
                <div className="w-8 h-10 border border-white/30 rounded" />
              )}
            </button>
          ))}
        </div>

        {phase === "won" && (
          <div className="mt-3 bg-emerald-800 border-2 border-emerald-400 rounded-xl p-4 text-center animate-pulse">
            <div className="text-lg font-black text-white">All matches found!</div>
            <div className="text-xs text-emerald-200 mt-1">+{12 + lives * 2} {kind}</div>
            <button onClick={finalise} className="mt-3 w-full py-2 bg-emerald-500 rounded-lg font-black">
              Continue →
            </button>
          </div>
        )}
        {phase === "lost" && (
          <div className="mt-3 bg-red-900 border-2 border-red-500 rounded-xl p-4 text-center">
            <div className="text-lg font-black text-white">Ran out of tries</div>
            <div className="text-xs text-red-200 mt-1">Still got a small +4 boost for trying.</div>
            <button onClick={finalise} className="mt-3 w-full py-2 bg-red-600 rounded-lg font-black">
              Continue →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function generateCards(pool: string[]): CardState[] {
  const chosen = shuffle(pool).slice(0, 8);
  const doubled = [...chosen, ...chosen];
  const shuffled = shuffle(doubled);
  return shuffled.map((emoji, id) => ({ id, emoji, flipped: false, matched: false }));
}
