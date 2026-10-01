"use client";

/**
 * THE STYLE SHOP — a grid of pictures, not a wall of L1-L5 buttons.
 *
 * Harry, 30 Sep 2026 (review of Mikey v0.7, p37-p40): "this page is just
 * really bad … way too long"; "you should always be able to see how much fame
 * stuff is giving you"; "what is a level one sports car?"; "actual images of
 * each one … hover over it and it actually shows something"; "a little place
 * where you can see all your stuff". And p7: a Holiday section.
 *
 *   - Five groups: Drip, Gadgets, Cars, Homes, Holiday (display only — the
 *     data still has item / vehicle / property, lib/star/lifestyleLevels.ts).
 *   - Each item is one picture card: its own level name and drawing, and the
 *     fame it gives, always on the card.
 *   - Tap a card for the detail sheet: all five levels as pictures, fame,
 *     how long it lasts, price, buy.
 *   - (v0.23) No title, Back or My stuff strip: a fame row on top, a bottom
 *     bar for Back / the group switch / Home.
 *
 * Every price, fame number and buying rule is the one the old screen used
 * (fame.ts, shopData.ts, page.tsx's handleBuyItem). Only the layout, names
 * and pictures changed.
 */
import { useMemo, useRef, useState } from "react";
import type React from "react";
import type { CareerState, OwnedItem } from "@/lib/star/types";
import { LIFESTYLE_ALL_LEVELS, baseIdOf } from "@/lib/star/shopData";
import { fameGainFromBuying, isWornOut, itemLifeSeasons, ownedFame, OWNED_FAME_MAX } from "@/lib/star/fame";
import { SHOP_TIERS, weeksOfWallet } from "@/lib/star/economy";
import { divisionOf } from "@/lib/star/calendar";
import { formatMoney } from "@/lib/star/money";
import { STYLE_GROUPS, styleGroupOf, levelName, familyName, fameFromOwned, fameText, type StyleGroup } from "@/lib/star/lifestyleLevels";
import StylePicture, { LEVEL_TILE } from "./StylePicture";
import ShopSheet, { weeksText } from "./ShopSheet";
import { PressButton, Burst, Shine, SquareBar, BottomBar, BarButton, Chev } from "./ui";

export type Reward = (price: number, from: Element | null, to: Element | null, node: React.ReactNode, color: string, key: string) => void;

const tileBg = (lv: number) => `linear-gradient(180deg, ${LEVEL_TILE[lv][0]}, ${LEVEL_TILE[lv][1]})`;

function ownedLevelOf(mine: OwnedItem | undefined): number {
  if (!mine) return 0;
  return mine.level ?? LIFESTYLE_ALL_LEVELS.find((l) => l.id === mine.id)?.level ?? 1;
}

export default function StyleShop({ career, onBuyItem, reward, landed, landKey, lockOf, onBack, onHome }: {
  career: CareerState;
  /** The bottom bar (Harry, 1 Oct 2026, P40/P41): Back, the group switch, Home. */
  onBack?: () => void;
  onHome?: () => void;
  onBuyItem: (item: OwnedItem) => void;
  reward: Reward;
  landed: number;
  landKey: string;
  /** Unlock chain: how far towards an item's star rating you are (0-1), or
   *  null when it is open. Absent = everything open. */
  lockOf?: (base: string) => number | null;
}) {
  const [group, setGroup] = useState<StyleGroup>("drip");
  const [sheet, setSheet] = useState<{ base: string; level: number } | null>(null);
  const mineRef = useRef<HTMLDivElement>(null);
  const homeLevel = Math.max(1, SHOP_TIERS.findIndex((t) => t.anchor === divisionOf(career)) + 1);

  const bases = useMemo(() => {
    const seen = new Map<string, OwnedItem[]>();
    for (const i of LIFESTYLE_ALL_LEVELS) {
      const b = baseIdOf(i);
      if (!seen.has(b)) seen.set(b, []);
      seen.get(b)!.push(i);
    }
    seen.forEach((v) => { v.sort((a, b) => (a.level ?? 0) - (b.level ?? 0)); });
    return seen;
  }, []);

  const owned = career.ownedItems;
  const mineOf = (base: string) => owned.find((o) => baseIdOf(o) === base);
  const stuffFame = ownedFame(owned);

  const groupBases = Array.from(bases.keys()).filter((b) => styleGroupOf(bases.get(b)![0]) === group);
  const groupInfo = STYLE_GROUPS.find((g) => g.id === group)!;
  const groupIndex = STYLE_GROUPS.findIndex((g) => g.id === group);

  return (
    <>
      {/* Fame from your stuff — always on screen (Harry p38), now one thin
          row: 24px where the fame strip, My stuff button, five tabs and a
          note used to take about 200 (Harry, 1 Oct 2026, P39-P41/P97: "the
          first 40% of the screen is just that"). No title, no Back and no My
          stuff strip: Back and the group switch are the bottom bar. */}
      <div ref={mineRef} className="relative mb-1.5 flex items-center gap-2 px-0.5">
        {landKey === "style" && <Burst trigger={landed} colors={["#f0abfc", "#fde047", "#ffffff"]} count={16} spread={0.7} round className="left-1/2 top-1/2" />}
        <span className="shrink-0 text-[11px] font-black uppercase tracking-[0.14em] text-white">Fame</span>
        <SquareBar value={Math.max(2, Math.min(100, (stuffFame / OWNED_FAME_MAX) * 100))} colors={["#f59e0b", "#fde047"]} className="h-[14px] min-w-0 flex-1" animate />
        <span className="shrink-0 text-[15px] font-black tabular-nums text-amber-300">{fameText(stuffFame)}</span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {groupBases.map((base) => {
          const levels = bases.get(base)!;
          const mine = mineOf(base);
          const worn = !!mine && isWornOut(mine);
          const ownLv = ownedLevelOf(mine);
          // Not owned: the best level you can afford right now, no higher
          // than the level priced for your league (level 1 if none).
          const affordable = levels.filter((l) => (l.level ?? 1) <= homeLevel && l.price <= career.money);
          const showLv = mine && !worn ? ownLv : (affordable[affordable.length - 1]?.level ?? 1);
          const item = levels.find((l) => l.level === showLv) ?? levels[0];
          return (
            <ItemCard
              lock={lockOf?.(base) ?? null}
              key={base}
              base={base}
              item={item}
              mine={mine}
              ownLv={ownLv}
              worn={worn}
              fame={mine && !worn ? fameFromOwned(owned, mine) : fameGainFromBuying(owned, item)}
              price={mine && !worn ? levels.find((l) => (l.level ?? 0) === ownLv + 1)?.price ?? null : item.price}
              onOpen={() => setSheet({ base, level: mine && !worn ? Math.min(5, ownLv + (ownLv < 5 ? 1 : 0)) : showLv })}
            />
          );
        })}
      </div>
      {group === "holiday" && (
        <div className="mt-2 text-center text-[11px] font-bold text-white/75">Only these three so far.</div>
      )}

      {/* The bottom bar: Back · the group switch (‹ DRIP ›) · Home. */}
      {(onBack || onHome) && (
        <BottomBar cols="1fr 1.7fr 1fr">
          <BarButton icon={<Chev dir="left" size={16} className="text-amber-300" />} label="Back" onClick={onBack ?? (() => {})} />
          <div className="grid grid-cols-[34px_1fr_34px] items-stretch gap-px" style={{ background: "rgba(255,255,255,.04)" }}>
            <button onClick={() => setGroup(STYLE_GROUPS[(groupIndex + STYLE_GROUPS.length - 1) % STYLE_GROUPS.length].id)} aria-label="Previous group" className="kib-press grid place-items-center text-amber-300"><Chev dir="left" size={16} /></button>
            <div className="flex min-w-0 flex-col items-center justify-center gap-0.5" data-style-group={group}>
              <span className="flex gap-[3px]" aria-hidden>{STYLE_GROUPS.map((g) => <span key={g.id} className={`h-[4px] w-[10px] ${g.id === group ? "bg-fuchsia-400" : "bg-white/25"}`} />)}</span>
              <span className="max-w-full truncate text-[14px] font-black uppercase leading-none tracking-wide text-white">{groupInfo.label}</span>
            </div>
            <button onClick={() => setGroup(STYLE_GROUPS[(groupIndex + 1) % STYLE_GROUPS.length].id)} aria-label="Next group" className="kib-press grid place-items-center text-amber-300"><Chev dir="right" size={16} /></button>
          </div>
          <BarButton icon="🏠" label="Home" onClick={onHome ?? onBack ?? (() => {})} />
        </BottomBar>
      )}

      {sheet && (
        <ItemSheet
          career={career}
          levels={bases.get(sheet.base)!}
          level={sheet.level}
          setLevel={(l) => setSheet({ base: sheet.base, level: l })}
          onClose={() => setSheet(null)}
          onBuy={(it, btn) => {
            reward(it.price, btn, mineRef.current, <StylePicture base={sheet.base} level={it.level ?? 1} className="h-12 w-[75px]" />, "#f0abfc", "style");
            onBuyItem(it);
          }}
        />
      )}
    </>
  );
}

/** One picture card in the grid. */
function ItemCard({ base, item, mine, ownLv, worn, fame, price, onOpen, lock = null }: {
  base: string; item: OwnedItem; mine?: OwnedItem; ownLv: number; worn: boolean; fame: number; price: number | null; onOpen: () => void;
  /** Locked behind a star rating: how far there you are, 0-1. A bar, never
   *  the number (house style, 30 Sep 2026). */
  lock?: number | null;
}) {
  const lv = item.level ?? 1;
  const yours = !!mine && !worn;
  if (lock !== null) return (
    <div
      data-item-card={base}
      data-locked
      className="relative flex flex-col overflow-hidden rounded-2xl text-left"
      style={{ background: "var(--sk-card, linear-gradient(180deg, rgba(31,41,55,.95), rgba(12,17,28,.98)))", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.06)" }}
    >
      <div className="relative" style={{ background: tileBg(lv) }}>
        <StylePicture base={base} level={lv} className="block aspect-[100/64] w-full opacity-30 grayscale" />
        <span className="absolute inset-0 grid place-items-center text-[22px]">🔒</span>
      </div>
      <div className="flex flex-1 flex-col px-1.5 pb-1.5 pt-1">
        <div className="line-clamp-2 min-h-[26px] text-[11px] font-black leading-[13px] text-white/70">{familyName(item)}</div>
        <div className="text-[9.5px] font-black text-amber-300">Higher star rating</div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-yellow-300" style={{ width: `${Math.max(4, Math.round(lock * 100))}%` }} />
        </div>
      </div>
    </div>
  );
  return (
    <button
      data-item-card={base}
      onClick={onOpen}
      title={`${levelName(item)} — level ${lv}`}
      className="kib-press group relative flex flex-col overflow-hidden rounded-2xl text-left transition hover:-translate-y-0.5"
      style={{ background: "var(--sk-card, linear-gradient(180deg, rgba(31,41,55,.95), rgba(12,17,28,.98)))", boxShadow: `inset 0 0 0 1px ${yours ? "rgba(52,211,153,.7)" : "rgba(255,255,255,.08)"}, 0 8px 18px -10px rgba(0,0,0,.8)` }}
    >
      <div className="relative" style={{ background: tileBg(lv) }}>
        <StylePicture base={base} level={lv} className="block aspect-[100/64] w-full transition group-hover:scale-105" />
        {yours && <span className="absolute left-1 top-1 rounded-full bg-emerald-400 px-1.5 py-0.5 text-[9px] font-black leading-none text-emerald-950">✓ YOURS</span>}
        {worn && <span className="absolute left-1 top-1 rounded-full bg-red-500 px-1.5 py-0.5 text-[9px] font-black leading-none text-white">WORN OUT</span>}
        <Pips className="absolute bottom-1 right-1" lit={yours ? ownLv : 0} shown={lv} />
      </div>
      <div className="flex flex-1 flex-col px-1.5 pb-1.5 pt-1">
        <div className="line-clamp-2 min-h-[26px] text-[11px] font-black leading-[13px] text-white">{levelName(item)}</div>
        <div className="mt-0.5 flex items-center justify-between gap-1">
          <span className="text-[10.5px] font-black text-amber-300">{fameText(fame)} fame</span>
        </div>
        <div className="text-[10px] font-black text-yellow-200/90">
          {yours ? (price === null ? "Top level" : `Next ★${formatMoney(price)}`) : `★${formatMoney(price ?? item.price)}`}
        </div>
      </div>
    </button>
  );
}

/** Five dots — which level is shown, and how far you've got. The fifth is a star. */
function Pips({ lit, shown, className = "" }: { lit: number; shown: number; className?: string }) {
  return (
    <span className={`flex items-center gap-[3px] rounded-full bg-black/55 px-1.5 py-[3px] ${className}`}>
      {[1, 2, 3, 4, 5].map((i) => (
        i === 5
          ? <span key={i} className={`text-[8px] leading-none ${i <= lit ? "text-yellow-300" : i === shown ? "text-white" : "text-white/35"}`}>★</span>
          : <span key={i} className={`h-[5px] w-[5px] rounded-full ${i <= lit ? "bg-emerald-300" : i === shown ? "bg-white" : "bg-white/30"}`} />
      ))}
    </span>
  );
}

/** The detail sheet: every level as a picture, and the buy button. */
function ItemSheet({ career, levels, level, setLevel, onClose, onBuy }: {
  career: CareerState; levels: OwnedItem[]; level: number; setLevel: (l: number) => void; onClose: () => void;
  onBuy: (it: OwnedItem, btn: Element) => void;
}) {
  const base = baseIdOf(levels[0]);
  const it = levels.find((l) => l.level === level) ?? levels[0];
  const mine = career.ownedItems.find((o) => baseIdOf(o) === base);
  const worn = !!mine && isWornOut(mine);
  const ownLv = ownedLevelOf(mine);
  const blocked = !!mine && !worn && (it.level ?? 0) <= ownLv;
  const canBuy = !blocked && career.money >= it.price;
  const gain = fameGainFromBuying(career.ownedItems, it);
  const nowFame = mine && !worn ? fameFromOwned(career.ownedItems, mine) : 0;
  const life = itemLifeSeasons(it);
  const happy = Math.floor(it.lifestyleValue / 3);
  const lv = it.level ?? 1;
  return (
    <ShopSheet open onClose={onClose} title={familyName(it)}>
      <div className="relative overflow-hidden rounded-2xl" style={{ background: tileBg(lv) }}>
        <StylePicture base={base} level={lv} className="block aspect-[100/64] w-full" />
        <span className="absolute left-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-black text-white">Level {lv} of 5</span>
        {mine && !worn && ownLv === lv && <span className="absolute right-2 top-2 rounded-full bg-emerald-400 px-2 py-0.5 text-[10px] font-black text-emerald-950">✓ YOURS</span>}
      </div>
      <div className="mt-2 text-[20px] font-black leading-tight text-white">{levelName(it)}</div>

      {/* All five levels — tap (or hover, on a computer) to look at one. */}
      <div className="mt-2 grid grid-cols-5 gap-1.5">
        {levels.map((l) => {
          const n = l.level ?? 1;
          const on = n === lv;
          const have = !!mine && !worn && n === ownLv;
          return (
            <button
              key={l.id}
              onClick={() => setLevel(n)}
              onMouseEnter={() => setLevel(n)}
              title={levelName(l)}
              className={`kib-press relative overflow-hidden rounded-xl ${on ? "ring-2 ring-white" : have ? "ring-2 ring-emerald-400" : "ring-1 ring-white/10"}`}
              style={{ background: tileBg(n) }}
            >
              <StylePicture base={base} level={n} className="block aspect-[100/64] w-full" />
              <div className="bg-black/55 py-0.5 text-center">
                <div className="text-[9px] font-black leading-tight text-white">{n === 5 ? "★ 5" : `L${n}`}{have ? " ✓" : ""}</div>
                <div className="text-[9px] font-black leading-tight text-yellow-300">{formatMoney(l.price)}</div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-2 grid grid-cols-3 gap-1.5 text-center">
        <Stat big={`${fameText(gain)}`} small={mine && !worn ? `fame (now ${fameText(nowFame)})` : "fame"} color="#fcd34d" />
        <Stat big={life === null ? "Forever" : `${life} season${life === 1 ? "" : "s"}`} small="lasts" color="#ffffff" />
        <Stat big={`+${happy}`} small="happiness" color="#86efac" />
      </div>

      {/* Level 5 unlock — the slot is real, what it unlocks isn't decided. */}
      <div className={`mt-2 flex items-center gap-2 rounded-xl p-2 ring-1 ${lv === 5 ? "bg-yellow-400/15 ring-yellow-300/50" : "bg-white/[0.04] ring-white/10"}`}>
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-black/40 text-[16px]">🔒</span>
        <div className="min-w-0">
          <div className="text-[11px] font-black text-yellow-200">Level 5 unlock</div>
          <div className="text-[10.5px] font-bold text-white/75">To be decided — nothing extra yet.</div>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between px-1">
        <div className="text-[18px] font-black text-yellow-300">★{formatMoney(it.price)}</div>
        <div className="text-[10px] font-bold text-white/70">{weeksText(weeksOfWallet(it.price, career.contract.wage))} of your income</div>
      </div>
      <PressButton
        variant="primary"
        size="none"
        pulse={canBuy}
        disabled={!canBuy}
        onClick={(e) => { if (canBuy) onBuy(it, e.currentTarget); }}
        className="relative mt-1.5 w-full overflow-hidden rounded-2xl py-3 text-[14px] font-black"
      >
        {canBuy && <Shine loop every={4.5} />}
        {blocked ? (ownLv === lv ? "You own this one" : `You own level ${ownLv}`) : career.money < it.price ? "Not enough money" : `${mine && !worn ? "Upgrade" : "Buy"} — ★${formatMoney(it.price)}`}
      </PressButton>
      {mine && !worn && !blocked && <div className="mt-1 text-center text-[10px] font-bold text-white/70">Replaces your {levelName(mine)}.</div>}
    </ShopSheet>
  );
}

function Stat({ big, small, color }: { big: string; small: string; color: string }) {
  return (
    <div className="rounded-xl bg-white/[0.06] px-1 py-1.5 ring-1 ring-white/10">
      <div className="text-[14px] font-black leading-tight" style={{ color }}>{big}</div>
      <div className="text-[9.5px] font-bold leading-tight text-white/70">{small}</div>
    </div>
  );
}
