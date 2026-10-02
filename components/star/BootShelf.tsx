"use client";

/**
 * THE BOOTS SHELF — like walking past a wall of boots in a shop.
 *
 * Harry, 30 Sep 2026 (p42): "It should just be like a gallery, like I'm in a
 * shop … hover over a shoe and buy it." And p6: "Can I see pictures of
 * these?" Every boot is a drawn boot (BootPicture) standing on a lit shelf
 * you swipe along; tap one for the sheet with all five levels, its numbers
 * and the buy button. A full walk-around 3D shop is not this — that is a
 * much bigger build.
 *
 * v0.24 (Harry, 2 Oct 2026, P2-22 to P2-25): no card outline round each boot;
 * the special boots stand in a small glass case; a boot you buy comes out of
 * its box (BootUnbox, played by Shop.tsx); and a basket (shopBasket.ts) — a
 * boot you add comes off the shelf, and one you bought says "Sold out" for
 * the rest of this visit.
 *
 * Prices, stats, the boot-sponsor discount and the black market (banned
 * boots) are exactly the old screen's: only the layout and pictures changed.
 */
import { useState } from "react";
import type { CareerState, Boot } from "@/lib/star/types";
import { baseIdOf } from "@/lib/star/shopData";
import { weeksOfWallet } from "@/lib/star/economy";
import { blackMarketPrice, LAWYER_FEE } from "@/lib/star/corruption";
import { formatMoney } from "@/lib/star/money";
import BootPicture, { BOOT_LOOK } from "./BootPicture";
import ShopSheet, { weeksText } from "./ShopSheet";
import { PressButton, Shine, rgba } from "./ui";
import { useBasket, MAX_PAIRS } from "./shopBasket";

interface ActionResult { ok: boolean; reason?: string }

const SHELVES: { title: string; note: string; ids: string[]; glass?: boolean }[] = [
  { title: "Everyday boots", note: "Swipe the shelf →", ids: ["starter", "speed", "power", "control", "elite"] },
  // Harry, 2 Oct 2026 (P2-23): "maybe only the special boots have like a glass box."
  { title: "Special boots", note: "A whole new ability in a match", ids: ["curl", "maestro"], glass: true },
];

/** The plank's top edge, in px from the top of a shelf row. Boots stand on it. */
const PLANK_Y = 88;

export default function BootShelf({ career, boots, banned, homeLevel, soldOut, onBuyNow, onAddToBasket, onBuyFromBlackMarket, focus }: {
  career: CareerState;
  /** Every level of every boot, already priced (boot sponsor discount applied). */
  boots: Boot[];
  banned: Set<string>;
  homeLevel: number;
  /** Boot levels bought on this visit: their spot on the shelf says "Sold out". */
  soldOut: Set<string>;
  /** Buy one pair now (Shop.tsx runs the real handler, then the unboxing). */
  onBuyNow: (boot: Boot) => void;
  /** Put one pair in the basket; `from` is where it flies from. */
  onAddToBasket: (boot: Boot, from: Element | null) => void;
  onBuyFromBlackMarket: (boot: Boot, useLawyers: boolean) => ActionResult;
  /** Open with this boot's sheet up (from the 3D shop's "See it in the shop"). */
  focus?: { id: string; level: number } | null;
}) {
  const [sheet, setSheet] = useState<{ base: string; level: number } | null>(() =>
    focus && boots.some((b) => baseIdOf(b) === focus.id) ? { base: focus.id, level: focus.level } : null);
  const list = useBasket();
  const levelsOf = (base: string) => boots.filter((b) => baseIdOf(b) === base).sort((a, b) => (a.level ?? 0) - (b.level ?? 0));
  const wearing = baseIdOf(career.currentBoot);
  /** The basket's boot, if it is one of this boot's levels. */
  const basketOf = (base: string) => {
    const e = list.find((x) => x.kind === "boot" && baseIdOf(x.boot) === base);
    return e && e.kind === "boot" ? e : null;
  };

  return (
    <>
      {SHELVES.map((shelf) => (
        <div key={shelf.title} className="mb-3">
          <div className="mb-1 flex items-baseline justify-between px-1">
            <span className="text-[11px] font-black uppercase tracking-[0.2em] text-white/85">{shelf.title}</span>
            <span className="text-[10px] font-bold text-white/60">{shelf.note}</span>
          </div>
          <div className="relative">
            {/* The shelf itself: one long lit plank the boots stand on. */}
            <div aria-hidden className="pointer-events-none absolute inset-x-0 h-3 rounded-sm" style={{ top: PLANK_Y, background: "linear-gradient(180deg, #8b6a4a, #4a3423)", boxShadow: "0 6px 12px -4px rgba(0,0,0,.8), inset 0 1px 0 rgba(255,255,255,.25)" }} />
            <div className="-mx-3 flex snap-x snap-mandatory scroll-px-3 gap-2.5 overflow-x-auto px-3 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" data-boot-shelf>
              {shelf.ids.map((id) => {
                const levels = levelsOf(id);
                if (!levels.length) return null;
                const shown = levels.find((b) => b.level === homeLevel) ?? levels[0];
                const look = BOOT_LOOK[id] ?? BOOT_LOOK.starter;
                const isBanned = banned.has(id);
                const inBasket = basketOf(id);
                const sold = soldOut.has(shown.id);
                // Off the shelf: in the basket, or bought out on this visit.
                const empty = !!inBasket || sold;
                return (
                  <div key={id} className="relative w-[150px] shrink-0 snap-start" data-boot-card={id}>
                    {/* No card (P2-22/23: "the boots on the shelf without this outline"):
                        the boot stands on the plank in its own light, its name under it. */}
                    <button
                      onClick={() => setSheet({ base: id, level: shown.level ?? homeLevel })}
                      title={`${shown.name} — tap to see all 5 levels`}
                      className="kib-press group relative block w-full text-left"
                    >
                      <div aria-hidden className="pointer-events-none absolute left-1/2 top-0 h-[96px] w-[140px] -translate-x-1/2" style={{ background: `radial-gradient(50% 80% at 50% 12%, ${rgba(look.upper, empty ? 0.1 : 0.3)}, transparent 72%)` }} />
                      <div className="relative flex h-[98px] items-end justify-center px-1" data-boot-art>
                        {empty ? (
                          // The space it left: a faint outline of the boot.
                          <BootPicture base={id} level={shown.level ?? 1} className="w-[72%] opacity-[0.14] grayscale" />
                        ) : (
                          // v0.23.1 (Harry, "massive... size 18"): three-quarters width sits on the plank at a believable size.
                          <BootPicture base={id} level={shown.level ?? 1} className="w-[72%] transition duration-200 group-hover:-translate-y-1 group-hover:scale-105" />
                        )}
                        {shelf.glass && <GlassCase dim={empty} />}
                        {sold && !inBasket && <Stamp text="Sold out" color="#f87171" />}
                        {inBasket && <Stamp text={`In basket${inBasket.qty > 1 ? ` ×${inBasket.qty}` : ""}`} color="#34d399" />}
                      </div>
                      <div className="relative h-[60px] px-1.5 pt-2.5">
                        <div className="flex items-center gap-1">
                          <span className="truncate text-[13px] font-black text-white">{shown.name}</span>
                          {shown.curve && <span className="rounded bg-sky-500 px-1 py-0.5 text-[8px] font-black leading-none text-white">CURVE</span>}
                          {shown.extraTouch && <span className="rounded bg-fuchsia-500 px-1 py-0.5 text-[8px] font-black leading-none text-white">TOUCH</span>}
                          {isBanned && <span className="rounded bg-red-600 px-1 py-0.5 text-[8px] font-black leading-none text-white">BANNED</span>}
                        </div>
                        <div className="text-[10px] font-bold text-white/80">Pow +{shown.power} · Tec +{shown.technique}</div>
                        <div className="text-[11px] font-black text-yellow-300">★{formatMoney(shown.price)} <span className="text-[9px] font-bold text-white/60">L{shown.level}</span></div>
                      </div>
                      {wearing === id && <span className="absolute left-1 top-1 rounded-full bg-emerald-400 px-1.5 py-0.5 text-[9px] font-black text-emerald-950">WEARING</span>}
                    </button>
                    {/* Straight into the basket, without opening the sheet. */}
                    {!isBanned && !sold && (!inBasket || (inBasket.boot.id === shown.id && inBasket.qty < MAX_PAIRS)) && (
                      <button
                        aria-label={`Add ${shown.name} to basket`}
                        data-add-basket={id}
                        onClick={(e) => onAddToBasket(shown, e.currentTarget.parentElement?.querySelector("[data-boot-art]") ?? e.currentTarget)}
                        className="kib-press absolute right-1 top-1 z-10 grid h-7 w-7 place-items-center rounded-full bg-emerald-500 text-white shadow-[0_2px_8px_rgba(0,0,0,.6)] ring-1 ring-white/40"
                      >
                        <BasketGlyph size={15} plus />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ))}

      {sheet && (
        <BootSheet
          career={career}
          levels={levelsOf(sheet.base)}
          level={sheet.level}
          banned={banned.has(sheet.base)}
          soldOut={soldOut}
          pairsInBasket={(id) => { const e = basketOf(sheet.base); return e && e.boot.id === id ? e.qty : 0; }}
          setLevel={(l) => setSheet({ base: sheet.base, level: l })}
          onClose={() => setSheet(null)}
          onBuy={(b) => { setSheet(null); onBuyNow(b); }}
          onAdd={(b, btn) => onAddToBasket(b, btn)}
          onBlackMarket={(b, lawyers) => {
            const r = onBuyFromBlackMarket(b, lawyers);
            if (r.ok) setSheet(null);
            return r;
          }}
        />
      )}
    </>
  );
}

/** A small glass display case over a special boot (P2-23): see-through, a
 *  light edge, a lid and two streaks of reflection. */
function GlassCase({ dim }: { dim: boolean }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-[10px] bottom-[-2px] top-[6px]">
      <div className="absolute inset-0 rounded-t-[7px]" style={{
        background: "linear-gradient(180deg, rgba(220,240,255,.10), rgba(220,240,255,.03) 55%, rgba(220,240,255,.10))",
        boxShadow: "inset 0 0 0 1px rgba(255,255,255,.4), inset 0 0 16px rgba(190,230,255,.2)",
      }} />
      <div className="absolute inset-x-[-3px] top-[-4px] h-[6px] rounded-[3px]" style={{ background: "linear-gradient(180deg, rgba(255,255,255,.6), rgba(255,255,255,.2))", boxShadow: "0 1px 4px rgba(0,0,0,.45)" }} />
      <div className="absolute inset-0 overflow-hidden rounded-t-[7px]">
        <div className="absolute inset-y-[-20%] left-[14%] w-[15%] -skew-x-[18deg]" style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,.24), transparent)" }} />
        <div className="absolute inset-y-[-20%] left-[36%] w-[5%] -skew-x-[18deg]" style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,.18), transparent)" }} />
      </div>
      {dim && <div className="absolute inset-0 rounded-t-[7px] bg-black/25" />}
    </div>
  );
}

/** "SOLD OUT" / "IN BASKET" across an empty spot. */
function Stamp({ text, color }: { text: string; color: string }) {
  return (
    <span className="pointer-events-none absolute left-1/2 top-[46%] -translate-x-1/2 -translate-y-1/2 -rotate-[8deg] whitespace-nowrap rounded-md px-2 py-0.5 text-[11px] font-black uppercase tracking-wider"
      style={{ color, background: "rgba(5,10,20,.8)", boxShadow: `inset 0 0 0 2px ${color}` }}>
      {text}
    </span>
  );
}

/** A small shopping basket (with a plus, on an "add" button). */
export function BasketGlyph({ size = 16, plus = false }: { size?: number; plus?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 10h18l-2 10H5L3 10Z" fill="currentColor" fillOpacity=".25" />
      <path d="M8 10 11 4M16 10l-3-6" />
      {plus ? <path d="M12 12.5v6M9 15.5h6" /> : <path d="M9 14v3M15 14v3M12 14v3" />}
    </svg>
  );
}

function BootSheet({ career, levels, level, banned, soldOut, pairsInBasket, setLevel, onClose, onBuy, onAdd, onBlackMarket }: {
  career: CareerState; levels: Boot[]; level: number; banned: boolean;
  soldOut: Set<string>; pairsInBasket: (id: string) => number;
  setLevel: (l: number) => void; onClose: () => void;
  onBuy: (b: Boot) => void;
  onAdd: (b: Boot, btn: Element) => void;
  onBlackMarket: (b: Boot, lawyers: boolean) => ActionResult;
}) {
  const [lawyers, setLawyers] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const b = levels.find((x) => x.level === level) ?? levels[0];
  const base = baseIdOf(b);
  const look = BOOT_LOOK[base] ?? BOOT_LOOK.starter;
  const sold = soldOut.has(b.id);
  const pairs = pairsInBasket(b.id);
  const canBuy = career.money >= b.price && !sold;
  const maxStat = Math.max(...levels.map((x) => Math.max(x.power, x.technique)), 1);
  return (
    <ShopSheet open onClose={onClose} title={b.name} accent={look.upper}>
      <div className="relative overflow-hidden rounded-2xl" style={{ background: `radial-gradient(70% 70% at 50% 10%, ${rgba(look.upper, 0.5)}, transparent 70%), var(--sk-card, linear-gradient(180deg, #1a2234, #0a0f1a))` }}>
        <BootPicture base={base} level={b.level ?? 1} className={`mx-auto block aspect-[100/64] w-[76%] ${sold ? "opacity-30 grayscale" : ""}`} />
        <span className="absolute left-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-black text-white">Level {b.level} of 5</span>
        {sold && <Stamp text="Sold out" color="#f87171" />}
      </div>
      <div className="mt-2 grid grid-cols-5 gap-1.5">
        {levels.map((x) => {
          const n = x.level ?? 1;
          const on = n === b.level;
          const gone = soldOut.has(x.id);
          return (
            <button key={x.id} onClick={() => setLevel(n)} onMouseEnter={() => setLevel(n)}
              className={`kib-press overflow-hidden rounded-xl bg-[#121a2a] ${on ? "ring-2 ring-white" : "ring-1 ring-white/10"}`}>
              <BootPicture base={base} level={n} className={`block aspect-[100/64] w-full ${gone ? "opacity-30 grayscale" : ""}`} />
              <div className="bg-black/55 py-0.5 text-center">
                <div className="text-[9px] font-black leading-tight text-white">{n === 5 ? "★ 5" : `L${n}`}</div>
                <div className={`text-[9px] font-black leading-tight ${gone ? "text-red-300" : "text-yellow-300"}`}>{gone ? "SOLD" : formatMoney(x.price)}</div>
              </div>
            </button>
          );
        })}
      </div>
      <div className="mt-2 space-y-1.5 rounded-xl bg-white/[0.05] p-2.5 ring-1 ring-white/10">
        {([["Power", b.power], ["Technique", b.technique]] as const).map(([label, v]) => (
          <div key={label} className="flex items-center gap-2">
            <span className="w-[68px] text-[11px] font-black text-white">{label}</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-300" style={{ width: `${(v / maxStat) * 100}%` }} /></div>
            <span className="w-8 text-right text-[12px] font-black text-emerald-300">+{v}</span>
          </div>
        ))}
        <div className="text-[10.5px] font-bold text-white/80">Lasts {b.matches} matches — {weeksText(weeksOfWallet(b.price / b.matches, career.contract.wage))} of income per match</div>
      </div>
      {b.curve && <div className="mt-2 rounded-xl bg-sky-500/15 p-2 text-[11px] font-bold text-sky-100 ring-1 ring-sky-400/40">Swipe while a shot is in the air to bend, lift or dip it.</div>}
      {b.extraTouch && <div className="mt-2 rounded-xl bg-fuchsia-500/15 p-2 text-[11px] font-bold text-fuchsia-100 ring-1 ring-fuchsia-400/40">Touch Mode: after you strike it, chase it down for a second touch.</div>}
      <div className="mt-2 flex items-center justify-between px-1">
        <div className="text-[18px] font-black text-yellow-300">★{formatMoney(b.price)}</div>
        <div className="text-[10px] font-bold text-white/70">{weeksText(weeksOfWallet(b.price, career.contract.wage))} of your income</div>
      </div>
      {banned ? (
        <div className="mt-1.5 rounded-2xl bg-red-950/60 p-3 ring-1 ring-red-600/70">
          <div className="mb-2 text-center text-[11px] font-bold text-red-200">Banned by the FA — a real chance of getting caught buying it anyway.</div>
          <label className="mb-2 flex items-center gap-2 text-[10px] font-bold text-white/85">
            <input type="checkbox" checked={lawyers} onChange={(e) => setLawyers(e.target.checked)} />
            Hire lawyers first (★{formatMoney(LAWYER_FEE)} — cuts the risk a lot, doesn&apos;t remove it)
          </label>
          <PressButton variant="danger" size="none" disabled={sold || career.money < blackMarketPrice(b.price) + (lawyers ? LAWYER_FEE : 0)}
            onClick={() => { const r = onBlackMarket(b, lawyers); setMsg(r.ok ? "Bought — nobody official noticed. This time." : (r.reason ?? "Failed")); }}
            className="w-full rounded-xl py-3 font-black">
            {sold ? "Sold out — back next visit" : `Buy from shady guys — ★${formatMoney(blackMarketPrice(b.price))}`}
          </PressButton>
          {msg && <div className="mt-2 text-center text-[10px] font-bold text-white/85">{msg}</div>}
        </div>
      ) : sold ? (
        <div className="mt-1.5 rounded-2xl bg-white/[0.06] py-3 text-center text-[13px] font-black uppercase tracking-wide text-red-300 ring-1 ring-red-400/40">Sold out — back next visit</div>
      ) : (
        <div className="mt-1.5 flex gap-2">
          <PressButton variant="secondary" size="none" disabled={pairs >= MAX_PAIRS}
            onClick={(e) => onAdd(b, e.currentTarget)}
            className="flex shrink-0 items-center justify-center gap-1.5 rounded-2xl px-3 py-3 text-[12px] font-black">
            <BasketGlyph size={15} plus />
            {pairs > 0 ? `In basket ×${pairs}` : "Add"}
          </PressButton>
          <PressButton variant="primary" size="none" pulse={canBuy} disabled={!canBuy}
            onClick={() => { if (canBuy) onBuy(b); }}
            className="relative min-w-0 flex-1 overflow-hidden rounded-2xl py-3 text-[14px] font-black">
            {canBuy && <Shine loop every={4.5} />}
            {canBuy ? `Buy now — ★${formatMoney(b.price)}` : "Not enough money"}
          </PressButton>
        </div>
      )}
    </ShopSheet>
  );
}
