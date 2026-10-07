"use client";

/**
 * OFFICE TALK — one of the manager's three games (Harry, 6 Oct 2026;
 * MANAGER_PLAN.md). Rules: lib/star/bossTalk.ts.
 *
 * Three rounds. He says something; you pick one of three replies; he answers.
 * Which reply he likes depends on how HE likes to play (his style), so his
 * lines are the only clue. The old version (lib/star/bossChat.ts) was dropped
 * for being too easy to read; it is kept only for its test.
 *
 * The manager's office in 3D sits above the chat (Settings → Look → "Talk to
 * your manager: 3D office", the default). "Old" is the chat alone.
 */
import { useMemo, useState } from "react";
import type { CareerState } from "@/lib/star/types";
import { talkFor, talkGain, talkHits, TALK_ROUNDS, type TalkReply, type Grade } from "@/lib/star/bossTalk";
import { GameShell, ResultPanel, type GameResult } from "./Shell";
import dynamic from "next/dynamic";
import { useBossRoomLook } from "@/lib/star/look3d";

const Office3DCareer = dynamic(() => import("../Office3D").then((m) => m.Office3DCareer), { ssr: false });

export default function BossChat({ career, onFinish, onCancel }: { career: CareerState; onFinish: (r: GameResult) => void; onCancel: () => void }) {
  // Salted per visit so the same week doesn't always give the same three topics.
  const talk = useMemo(() => talkFor(career, Date.now() % 100000), [career]);
  const current = career.relationships.boss;
  const boss = career.manager?.name ?? "The manager";
  const room = useBossRoomLook();
  const [room3dFailed, setRoom3dFailed] = useState(false);

  const [round, setRound] = useState(0);
  const [picked, setPicked] = useState<TalkReply | null>(null);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [log, setLog] = useState<{ who: string; text: string; mine?: boolean }[]>([]);
  const [result, setResult] = useState<GameResult | null>(null);
  const r = talk.rounds[Math.min(round, TALK_ROUNDS - 1)];

  const pick = (rep: TalkReply) => {
    if (picked || result) return;
    setPicked(rep);
    const g = [...grades, rep.grade];
    setGrades(g);
    window.setTimeout(() => {
      const next = round + 1;
      if (next >= TALK_ROUNDS) {
        const hits = talkHits(g);
        setResult({
          won: hits > 0,
          gain: talkGain(g),
          line: hits === TALK_ROUNDS ? "He liked every answer." : hits > 0 ? "That went well enough." : "You didn't get through to him.",
        });
      } else {
        setLog((l) => [...l, { who: boss, text: r.line }, { who: "You", text: rep.text, mine: true }, { who: boss, text: rep.answer }]);
        setRound(next);
        setPicked(null);
      }
    }, 1300);
  };

  return (
    <GameShell title="Office talk" who="Boss" current={current} tone="#60a5fa" onBack={round === 0 && !picked ? onCancel : undefined}>
      {room === "3d" && !room3dFailed && (
        <Office3DCareer career={career} speaker={picked && !result ? "you" : "boss"} onFail={() => setRoom3dFailed(true)}
          className="mb-3 w-full" style={{ height: "36vh", borderRadius: 4 }} />
      )}
      <div className="mb-2 flex items-center justify-between text-[13px] font-black uppercase">
        <span>Question {Math.min(round + 1, TALK_ROUNDS)} / {TALK_ROUNDS}</span>
        <span>{grades.map((g, i) => <span key={i} className={g === "best" ? "text-emerald-300" : g === "clash" ? "text-red-400" : "text-white/50"}>●</span>)}</span>
      </div>
      <div className="space-y-2" data-boss-talk={talk.style}>
        {log.slice(-3).map((m, i) => <Bubble key={`${round}-${i}`} who={m.who} text={m.text} mine={m.mine} faded />)}
        <Bubble who={boss} text={r.line} />
        {!picked && !result && r.replies.map((rep) => (
          <button key={rep.text} onClick={() => pick(rep)} data-reply className="kib-press block w-full bg-blue-500/20 px-3 py-3 text-left text-[15px] font-black text-white ring-1 ring-blue-300/60" style={{ borderRadius: 4 }}>
            {rep.text}
          </button>
        ))}
        {picked && <Bubble who="You" text={picked.text} mine />}
        {picked && <Bubble who={boss} text={picked.answer} />}
      </div>
      {result && <ResultPanel result={result} who="Boss" current={current} onContinue={() => onFinish(result)} />}
    </GameShell>
  );
}

function Bubble({ who, text, mine, faded }: { who: string; text: string; mine?: boolean; faded?: boolean }) {
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"} ${faded ? "opacity-60" : ""}`}>
      <div className={`max-w-[85%] px-3 py-2 ${mine ? "bg-emerald-600" : "bg-slate-700"}`} style={{ borderRadius: 4 }}>
        <div className="text-[11px] font-black uppercase tracking-wider text-white">{who}</div>
        <div className="text-[15px] font-bold text-white">{text}</div>
      </div>
    </div>
  );
}
