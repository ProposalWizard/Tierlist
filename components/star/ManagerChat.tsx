"use client";

/**
 * A SHORT WORD FROM THE MANAGER — a few lines, one tap each, then he is gone
 * (Harry, 1 Oct 2026, P78). Used for being made the penalty / free-kick taker.
 * Not a screen: a bubble over whatever you were looking at.
 */
import { useState } from "react";
import { createPortal } from "react-dom";
import { PressButton } from "./ui";

export default function ManagerChat({ name, lines, onDone }: { name: string; lines: string[]; onDone: () => void }) {
  const [i, setI] = useState(0);
  const last = i >= lines.length - 1;
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/65 p-4 pb-24" onClick={() => (last ? onDone() : setI(i + 1))}>
      <div className="kit-rise w-full max-w-[340px]">
        <div className="flex items-end gap-2">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-[6px] bg-gradient-to-b from-gray-600 to-gray-800 text-[30px] ring-2 ring-white/30">🧑‍💼</div>
          <div className="min-w-0 flex-1 rounded-[8px] px-3 py-2.5 text-white" style={{ background: "linear-gradient(180deg,#1f2937,#0b1220)", boxShadow: "inset 0 0 0 2px rgba(255,255,255,.22), 0 12px 30px -8px rgba(0,0,0,.9)" }}>
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-300">{name}</div>
            <div key={i} className="kit-rise mt-0.5 text-[16px] font-black leading-snug">{lines[i]}</div>
          </div>
        </div>
        <div className="mt-2 flex justify-end">
          {last
            ? <PressButton variant="primary" size="none" onClick={onDone} className="rounded-[4px] px-5 py-2 text-[13px] font-black">OK</PressButton>
            : <span className="text-[12px] font-black uppercase tracking-widest text-amber-300">▸</span>}
        </div>
      </div>
    </div>,
    document.body,
  );
}
