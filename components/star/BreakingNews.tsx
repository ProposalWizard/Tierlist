"use client";

/**
 * THE BREAKING-NEWS POP-UP — a red strip, a headline, one line, OK.
 * Brief on purpose (Harry, P28: "not spoon-fed too much").
 */
import { createPortal } from "react-dom";
import { PressButton } from "./ui";
import type { BreakingNews as News } from "@/lib/star/breakingNews";

export default function BreakingNews({ news, onClose }: { news: News; onClose: () => void }) {
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[92] grid place-items-center bg-black/70 p-5" onClick={onClose}>
      <div
        className="kit-slam w-full max-w-[330px] overflow-hidden text-center"
        style={{ background: "#f5f1e6", color: "#111827", boxShadow: "0 18px 50px -8px rgba(0,0,0,.9), 0 0 0 2px #111827" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-center gap-2 bg-red-600 py-1.5 text-[12px] font-black uppercase tracking-[0.28em] text-white">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-white" /> Breaking news
        </div>
        <div className="px-4 pb-3 pt-3">
          <div className="text-[28px] font-black uppercase leading-[1.02] tracking-tight">{news.headline}</div>
          <div className="mx-auto mt-2 h-[2px] w-12 bg-gray-900" />
          <div className="mt-2 text-[14px] font-bold leading-snug text-gray-800">{news.line}</div>
          <PressButton variant="primary" size="none" onClick={onClose} className="mt-3 w-full rounded-[3px] py-2.5 text-[14px] font-black">OK</PressButton>
        </div>
      </div>
    </div>,
    document.body,
  );
}
