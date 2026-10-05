"use client";

/**
 * TALK TO YOUR MANAGER — the boss game (lib/star/bossChat.ts has the rules).
 * He raises something from your real situation; you pick one of three
 * replies; his answer and the result follow.
 */
import { useMemo, useState } from "react";
import type { CareerState } from "@/lib/star/types";
import { chatFor, type Reply } from "@/lib/star/bossChat";
import { gameReward } from "@/lib/star/relationships";
import { GameShell, ResultPanel, type GameResult } from "./Shell";
import dynamic from "next/dynamic";
import { useBossRoomLook } from "@/lib/star/look3d";

// The manager's office in 3D above the chat (Settings → Look → "Talk to your
// manager: 3D office", the default). Only a stage: the words and rules below
// are untouched. "Old" is this screen exactly as before.
const Office3DCareer = dynamic(() => import("../Office3D").then((m) => m.Office3DCareer), { ssr: false });

export default function BossChat({ career, onFinish, onCancel }: { career: CareerState; onFinish: (r: GameResult) => void; onCancel: () => void }) {
  const chat = useMemo(() => chatFor(career), [career]);
  const current = career.relationships.boss;
  const [picked, setPicked] = useState<Reply | null>(null);
  const [result, setResult] = useState<GameResult | null>(null);
  const boss = career.manager?.name ?? "The manager";
  const room = useBossRoomLook();
  const [room3dFailed, setRoom3dFailed] = useState(false);

  const pick = (r: Reply) => {
    if (picked) return;
    setPicked(r);
    window.setTimeout(() => setResult({ won: r.lands, gain: gameReward(r.lands, current, Math.random(), "boss"), line: r.lands ? "He liked that." : "That didn't go down well." }), 900);
  };

  return (
    <GameShell title="Talk to your manager" who="Boss" current={current} tone="#60a5fa" onBack={picked ? undefined : onCancel}>
      {room === "3d" && !room3dFailed && (
        <Office3DCareer career={career} speaker={!picked || result ? "boss" : "you"} onFail={() => setRoom3dFailed(true)}
          className="mb-3 w-full" style={{ height: "40vh", borderRadius: 4 }} />
      )}
      <div className="space-y-2">
        <Bubble who={boss} text={chat.opener} />
        {!picked && chat.replies.map((r) => (
          <button key={r.text} onClick={() => pick(r)} data-reply className="kib-press block w-full bg-blue-500/20 px-3 py-3 text-left text-[15px] font-black text-white ring-1 ring-blue-300/60" style={{ borderRadius: 4 }}>
            {r.text}
          </button>
        ))}
        {picked && <Bubble who="You" text={picked.text} mine />}
        {picked && <Bubble who={boss} text={picked.answer} />}
      </div>
      {result && <ResultPanel result={result} who="Boss" current={current} onContinue={() => onFinish(result)} />}
    </GameShell>
  );
}

function Bubble({ who, text, mine }: { who: string; text: string; mine?: boolean }) {
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[85%] px-3 py-2 ${mine ? "bg-emerald-600" : "bg-slate-700"}`} style={{ borderRadius: 4 }}>
        <div className="text-[11px] font-black uppercase tracking-wider text-white">{who}</div>
        <div className="text-[15px] font-bold text-white">{text}</div>
      </div>
    </div>
  );
}
