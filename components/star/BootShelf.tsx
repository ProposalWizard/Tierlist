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
import type { Reward } from "./StyleShop";

interface ActionResult { ok: boolean; reason?: string }

const SHELVES: { title: string; note: string; ids: string[] }[] = [
  { title: "Everyday boots", note: "Swipe the shelf →", ids: ["starter", "speed", "power", "control", "elite"] },
  { title: "Special boots", note: "A whole new ability in a match", ids: ["curl", "maestro"] },
];

export default function BootShelf({ career, boots, banned, homeLevel, bootTarget, reward, onBuyBoot, onBuyFromBlackMarket }: {
  career: CareerState;
  /** Every level of every boot, already priced (boot sponsor discount applied). */
  boots: Boot[];
  banned: Set<string>;
  homeLevel: number;
  /** Where a bought boot flies to — the "Current boot" card. */
  bootTarget: () => Element | null;
  reward: Reward;
  onBuyBoot: (boot: Boot) => void;
  onBuyFromBlackMarket: (boot: Boot, useLawyers: boolean) => ActionResult;
}) {
  const [sheet, setSheet] = useState<{ base: string; level: number } | null>(null);
  const levelsOf = (base: string) => boots.filter((b) => baseIdOf(b) === base).sort((a, b) => (a.level ?? 0) - (b.level ?? 0));
  const wearing = baseIdOf(career.currentBoot);

  return (
    <>
      {SHELVES.map((shelf) => (
        <div key={shelf.title} className="mb-3">
          <div className="mb-1 flex items-baseline justify-between px-1">
            <span className="text-[11px] font-black uppercase tracking-[0.2em] text-white/85">{shelf.title}</span>
            <span className="text-[10px] font-bold text-white/60">{shelf.note}</span>
          </div>
          <div className="relative">
            {/* The shelf itself: a lit plank the boots stand on. */}
            <div aria-hidden className="pointer-events-none absolute inset-x-0 top-[88px] h-3 rounded-sm" style={{ background: "linear-gradient(180deg, #8b6a4a, #4a3423)", boxShadow: "0 6px 12px -4px rgba(0,0,0,.8), inset 0 1px 0 rgba(255,255,255,.25)" }} />
            <div className="-mx-3 flex snap-x snap-mandatory scroll-px-3 gap-2.5 overflow-x-auto px-3 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" data-boot-shelf>
              {shelf.ids.map((id) => {
                const levels = levelsOf(id);
                if (!levels.length) return null;
                const shown = levels.find((b) => b.level === homeLevel) ?? levels[0];
                const look = BOOT_LOOK[id] ?? BOOT_LOOK.starter;
                const isBanned = banned.has(id);
                return (
                  <button
                    key={id}
                    data-boot-card={id}
                    onClick={() => setSheet({ base: id, level: shown.level ?? homeLevel })}
                    title={`${shown.name} — tap to see all 5 levels`}
                    className="kib-press group relative w-[150px] shrink-0 snap-start overflow-hidden rounded-2xl text-left"
                    style={{ background: `radial-gradient(80% 60% at 50% 0%, ${rgba(look.upper, 0.45)} 0%, transparent 70%), linear-gradient(180deg, #1a2234, #0a0f1a)`, boxShadow: `inset 0 0 0 1px ${wearing === id ? "rgba(52,211,153,.8)" : rgba(look.upper, 0.35)}` }}
                  >
                    {/* Spotlight from above. */}
                    <div aria-hidden className="pointer-events-none absolute left-1/2 top-0 h-24 w-28 -translate-x-1/2" style={{ background: "radial-gradient(50% 100% at 50% 0%, rgba(255,255,255,.22), transparent 70%)" }} />
                    <div aria-hidden className="pointer-events-none absolute inset-x-0 top-[88px] h-3" style={{ background: "linear-gradient(180deg, #8b6a4a, #4a3423)", boxShadow: "0 6px 10px -4px rgba(0,0,0,.8), inset 0 1px 0 rgba(255,255,255,.25)" }} />
                    <div className="relative flex h-[98px] items-end justify-center px-1">
                      <BootPicture base={id} level={shown.level ?? 1} className="w-full transition duration-200 group-hover:-translate-y-1 group-hover:scale-105" />
                    </div>
                    <div className="relative h-[66px] px-2 pt-2.5">
                      <div className="flex items-center gap-1">
                        <span className="truncate text-[13px] font-black text-white">{shown.name}</span>
                        {shown.curve && <span className="rounded bg-sky-500 px-1 py-0.5 text-[8px] font-black leading-none text-white">CURVE</span>}
                        {shown.extraTouch && <span className="rounded bg-fuchsia-500 px-1 py-0.5 text-[8px] font-black leading-none text-white">TOUCH</span>}
                        {isBanned && <span className="rounded bg-red-600 px-1 py-0.5 text-[8px] font-black leading-none text-white">BANNED</span>}
                      </div>
                      <div className="flex items-center justify-between text-[10px] font-bold text-white/80">
                        <span>Pow +{shown.power} · Tec +{shown.technique}</span>
                      </div>
                      <div className="text-[11px] font-black text-yellow-300">★{formatMoney(shown.price)} <span className="text-[9px] font-bold text-white/60">L{shown.level}</span></div>
                    </div>
                    {wearing === id && <span className="absolute left-1.5 top-1.5 rounded-full bg-emerald-400 px-1.5 py-0.5 text-[9px] font-black text-emerald-950">WEARING</span>}
                  </button>
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
          setLevel={(l) => setSheet({ base: sheet.base, level: l })}
          onClose={() => setSheet(null)}
          onBuy={(b, btn) => {
            reward(b.price, btn, bootTarget(), <BootPicture base={sheet.base} level={b.level ?? 1} className="h-12 w-[75px]" />, "#34d399", "boot");
            onBuyBoot(b);
          }}
          onBlackMarket={(b, lawyers, btn) => {
            const r = onBuyFromBlackMarket(b, lawyers);
            if (r.ok) reward(blackMarketPrice(b.price) + (lawyers ? LAWYER_FEE : 0), btn, bootTarget(), <BootPicture base={sheet.base} level={b.level ?? 1} className="h-12 w-[75px]" />, "#f87171", "boot");
            return r;
          }}
        />
      )}
    </>
  );
}

function BootSheet({ career, levels, level, banned, setLevel, onClose, onBuy, onBlackMarket }: {
  career: CareerState; levels: Boot[]; level: number; banned: boolean;
  setLevel: (l: number) => void; onClose: () => void;
  onBuy: (b: Boot, btn: Element) => void;
  onBlackMarket: (b: Boot, lawyers: boolean, btn: Element) => ActionResult;
}) {
  const [lawyers, setLawyers] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const b = levels.find((x) => x.level === level) ?? levels[0];
  const base = baseIdOf(b);
  const look = BOOT_LOOK[base] ?? BOOT_LOOK.starter;
  const canBuy = career.money >= b.price;
  const maxStat = Math.max(...levels.map((x) => Math.max(x.power, x.technique)), 1);
  return (
    <ShopSheet open onClose={onClose} title={b.name} accent={look.upper}>
      <div className="relative overflow-hidden rounded-2xl" style={{ background: `radial-gradient(70% 70% at 50% 10%, ${rgba(look.upper, 0.5)}, transparent 70%), linear-gradient(180deg, #1a2234, #0a0f1a)` }}>
        <BootPicture base={base} level={b.level ?? 1} className="mx-auto block aspect-[100/64] w-[88%]" />
        <span className="absolute left-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-black text-white">Level {b.level} of 5</span>
      </div>
      <div className="mt-2 grid grid-cols-5 gap-1.5">
        {levels.map((x) => {
          const n = x.level ?? 1;
          const on = n === b.level;
          return (
            <button key={x.id} onClick={() => setLevel(n)} onMouseEnter={() => setLevel(n)}
              className={`kib-press overflow-hidden rounded-xl bg-[#121a2a] ${on ? "ring-2 ring-white" : "ring-1 ring-white/10"}`}>
              <BootPicture base={base} level={n} className="block aspect-[100/64] w-full" />
              <div className="bg-black/55 py-0.5 text-center">
                <div className="text-[9px] font-black leading-tight text-white">{n === 5 ? "★ 5" : `L${n}`}</div>
                <div className="text-[9px] font-black leading-tight text-yellow-300">{formatMoney(x.price)}</div>
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
          <PressButton variant="danger" size="none" disabled={career.money < blackMarketPrice(b.price) + (lawyers ? LAWYER_FEE : 0)}
            onClick={(e) => { const r = onBlackMarket(b, lawyers, e.currentTarget); setMsg(r.ok ? "Bought — nobody official noticed. This time." : (r.reason ?? "Failed")); }}
            className="w-full rounded-xl py-3 font-black">
            Buy from shady guys — ★{formatMoney(blackMarketPrice(b.price))}
          </PressButton>
          {msg && <div className="mt-2 text-center text-[10px] font-bold text-white/85">{msg}</div>}
        </div>
      ) : (
        <PressButton variant="primary" size="none" pulse={canBuy} disabled={!canBuy}
          onClick={(e) => { if (canBuy) onBuy(b, e.currentTarget); }}
          className="relative mt-1.5 w-full overflow-hidden rounded-2xl py-3 text-[14px] font-black">
          {canBuy && <Shine loop every={4.5} />}
          {canBuy ? `Buy ${b.name} L${b.level} — ★${formatMoney(b.price)}` : "Not enough money"}
        </PressButton>
      )}
    </ShopSheet>
  );
}
