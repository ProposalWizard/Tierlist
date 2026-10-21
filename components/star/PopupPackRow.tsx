"use client";

/**
 * Settings → "Pop-up pack" (lib/star/popupPack.ts): the same dropdown as the
 * texture pack (Quality3dRow.tsx), with a small picture of each style drawn in
 * code. Choosing changes the next pop-up at once, mid-match too.
 */
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { POPUP_PACKS, POPUP_PACK_LINES, POPUP_PACK_NAMES, setPopupPack, usePopupPack, type PopupPack } from "@/lib/star/popupPack";
import { SetNote } from "./settingsKit";

/** A tiny picture of each style on a strip of pitch. */
function PopupThumb({ id, big }: { id: PopupPack; big?: boolean }) {
  const box = big ? "h-[70px] w-[100px] rounded-lg" : "h-[34px] w-[48px] rounded-md";
  return (
    <span aria-hidden className={`relative block shrink-0 overflow-hidden ${box}`}
      style={{ background: "repeating-linear-gradient(0deg,#2f8f3a 0 10px,#2a8434 10px 20px)" }}>
      {id === "classic" ? (
        <span className={`absolute inset-0 grid place-items-center font-black italic text-white ${big ? "text-[22px]" : "text-[11px]"}`}
          style={{ textShadow: "0 2px 0 rgba(0,0,0,.55)" }}>GOAL</span>
      ) : (
        <span className={`absolute left-1/2 -translate-x-1/2 flex items-center overflow-hidden rounded-[3px] font-black text-white ${big ? "top-2 h-[18px] text-[11px]" : "top-1 h-[9px] text-[6px]"}`}
          style={{ background: "#0b1220", boxShadow: "0 1px 3px rgba(0,0,0,.5)" }}>
          <span className="h-full px-1" style={{ background: "#dc2626" }} />
          <span className="px-1 tabular-nums">2-1</span>
          <span className="h-full px-1" style={{ background: "#2563eb" }} />
        </span>
      )}
      {id === "broadcast" && (
        <span className={`absolute left-1/2 -translate-x-1/2 rounded-[2px] ${big ? "top-[30px] h-[7px] w-[54px]" : "top-[13px] h-[4px] w-[26px]"}`}
          style={{ background: "#facc15" }} />
      )}
    </span>
  );
}

export default function PopupPackRow() {
  const p = usePopupPack();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open]);
  return (
    <div className="border-b border-white/10 py-2 last:border-b-0" data-popup-pack-row>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[14px] font-bold leading-tight text-white">Pop-up pack</span>
        <button
          type="button"
          data-popup-pack-open
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpen(true)}
          className="kib-press flex min-w-0 max-w-[240px] flex-1 items-center gap-2 rounded-lg border border-white/15 bg-white/5 p-1 pr-2 text-left"
        >
          <PopupThumb id={p} />
          <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-white">{POPUP_PACK_NAMES[p]}</span>
          <span aria-hidden className="text-[12px] text-white/80">▾</span>
        </button>
      </div>
      <SetNote dim className="mt-1 text-[10px]">The words that pop up in a match: GOAL, PASS, OFFSIDE and the rest.</SetNote>
      {open && mounted && createPortal(
        <div data-popup-pack-sheet className="fixed inset-0 z-[95] flex items-end justify-center bg-black/60 sm:items-center" onClick={() => setOpen(false)}>
          <div
            role="listbox"
            aria-label="Pop-up pack"
            onClick={(e) => e.stopPropagation()}
            className="max-h-[85vh] w-full overflow-y-auto overscroll-contain rounded-t-2xl border-t border-white/10 bg-gray-950 px-3 pb-6 pt-3 sm:max-w-[420px] sm:rounded-2xl sm:border sm:pb-3"
          >
            <div className="mb-2 flex items-center justify-between px-1">
              <div className="text-[16px] font-black text-white">Pop-up pack</div>
              <button type="button" onClick={() => setOpen(false)} className="kib-press rounded-lg bg-white/10 px-3 py-1 text-[13px] font-bold text-white">Done</button>
            </div>
            <div className="space-y-2">
              {POPUP_PACKS.map((id) => {
                const on = id === p;
                return (
                  <button
                    key={id}
                    type="button"
                    role="option"
                    aria-selected={on}
                    data-popup-pack-option={id}
                    onClick={() => { setPopupPack(id); setOpen(false); }}
                    className={`kib-press flex w-full items-center gap-3 rounded-xl border p-2 text-left ${on ? "border-emerald-400 bg-emerald-500/15" : "border-white/10 bg-white/5"}`}
                  >
                    <PopupThumb id={id} big />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] font-bold text-white">{POPUP_PACK_NAMES[id]}</span>
                      <span className="mt-0.5 block text-[12px] font-bold leading-snug text-white/80">{POPUP_PACK_LINES[id]}</span>
                    </span>
                    <span aria-hidden className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[14px] font-black ${on ? "bg-emerald-400 text-gray-950" : "border border-white/25 text-transparent"}`}>✓</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
