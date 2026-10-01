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
 *   - "My stuff": everything you own in one place.
 *
 * Every price, fame number and buying rule is the one the old screen used
 * (fame.ts, shopData.ts, page.tsx's handleBuyItem). Only the layout, names
 * and pictures changed.
 */
import { useMemo, useRef, useState } from "react";
import type React from "react";
import type { CareerState, OwnedItem } from "@/lib/star/types";
import { LIFESTYLE_ALL_LEVELS, KIB_CANS, baseIdOf } from "@/lib/star/shopData";
import { fameGainFromBuying, isWornOut, itemLifeSeasons, ownedFame, OWNED_FAME_MAX } from "@/lib/star/fame";
import { SHOP_TIERS, weeksOfWallet } from "@/lib/star/economy";
import { divisionOf } from "@/lib/star/calendar";
import { formatMoney } from "@/lib/star/money";
import { STYLE_GROUPS, styleGroupOf, levelName, familyName, fameFromOwned, fameText, type StyleGroup } from "@/lib/star/lifestyleLevels";
import { takeStyleView } from "@/lib/star/shopNav";
import StylePicture, { LEVEL_TILE } from "./StylePicture";
import BootPicture from "./BootPicture";
import KibCanIcon from "./KibCanIcon";
import ShopSheet, { weeksText } from "./ShopSheet";
import { PressButton, Burst, Pop, Shine } from "./ui";

export type Reward = (price: number, from: Element | null, to: Element | null, node: React.ReactNode, color: string, key: string) => void;

const tileBg = (lv: number) => `linear-gradient(180deg, ${LEVEL_TILE[lv][0]}, ${LEVEL_TILE[lv][1]})`;

function ownedLevelOf(mine: OwnedItem | undefined): number {
  if (!mine) return 0;
  return mine.level ?? LIFESTYLE_ALL_LEVELS.find((l) => l.id === mine.id)?.level ?? 1;
}

export default function StyleShop({ career, onBuyItem, reward, landed, landKey, lockOf }: {
  career: CareerState;
  onBuyItem: (item: OwnedItem) => void;
  reward: Reward;
  landed: number;
  landKey: string;
  /** Unlock chain: how far towards an item's star rating you are (0-1), or
   *  null when it is open. Absent = everything open. */
  lockOf?: (base: string) => number | null;
}) {
  const [view, setView] = useState(() => takeStyleView());
  // The phone is the first thing to buy (Harry, 1 Oct 2026, P102): until you
  // have one, a new career opens on Gadgets, where it sits and flashes.
  const [group, setGroup] = useState<StyleGroup>(() => (lockOf && !career.ownedItems.some((o) => baseIdOf(o) === "phone") ? "gadgets" : "drip"));
  const [sheet, setSheet] = useState<{ base: string; level: number } | null>(null);
  const mineRef = useRef<HTMLButtonElement>(null);
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
  const working = owned.filter((o) => !isWornOut(o));

  const groupBases = Array.from(bases.keys()).filter((b) => styleGroupOf(bases.get(b)![0]) === group);
  const groupInfo = STYLE_GROUPS.find((g) => g.id === group)!;

  return (
    <>
      {/* Fame from your stuff — always on screen (Harry p38). */}
      <div className="mb-2 flex items-center gap-2 rounded-2xl bg-black/40 p-2.5 ring-1 ring-amber-300/25">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[10px] font-black uppercase tracking-[0.18em] text-white/75">Fame from your stuff</span>
            <span className="text-[16px] font-black tabular-nums text-amber-300">{fameText(stuffFame)}</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-yellow-300" style={{ width: `${Math.min(100, (stuffFame / OWNED_FAME_MAX) * 100)}%` }} />
          </div>
        </div>
        <button
          ref={mineRef}
          onClick={() => setView(view === "mine" ? "shop" : "mine")}
          className={`kib-press relative shrink-0 rounded-xl px-3 py-2 text-[11px] font-black uppercase tracking-wide ${view === "mine" ? "bg-gradient-to-b from-fuchsia-300 to-fuchsia-600 text-fuchsia-950" : "bg-white/10 text-white ring-1 ring-white/15"}`}
        >
          {landKey === "style" && <Burst trigger={landed} colors={["#f0abfc", "#fde047", "#ffffff"]} count={16} spread={0.7} round className="left-1/2 top-1/2" />}
          {view === "mine" ? "‹ Shop" : <>My stuff <Pop value={working.length}>({working.length})</Pop></>}
        </button>
      </div>

      {view === "shop" ? (
        <>
          <div className="mb-1.5 grid grid-cols-5 gap-1 rounded-2xl bg-black/35 p-1 ring-1 ring-white/[0.06]">
            {STYLE_GROUPS.map((g) => (
              <button
                key={g.id}
                onClick={() => setGroup(g.id)}
                className={`kib-press rounded-xl py-2 text-[10.5px] font-black uppercase tracking-wide transition ${group === g.id ? "bg-gradient-to-b from-fuchsia-300 to-fuchsia-600 text-fuchsia-950" : "text-white/80"}`}
              >
                {g.label}
              </button>
            ))}
          </div>
          <div className="mb-2 px-1 text-[10.5px] font-bold text-white/75">{groupInfo.note}</div>
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
                  single={levels.length === 1}
                  flash={base === "phone" && !!lockOf && (!mine || worn)}
                  onOpen={() => setSheet({ base, level: mine && !worn ? Math.min(5, ownLv + (ownLv < 5 ? 1 : 0)) : showLv })}
                />
              );
            })}
          </div>
          {group === "holiday" && (
            <div className="mt-2 rounded-xl bg-white/[0.05] p-2.5 text-[10.5px] font-bold text-white/75 ring-1 ring-white/10">
              Yachts, a holiday home and a cottage aren&apos;t in the shop yet — only these three.
            </div>
          )}
        </>
      ) : (
        <MyStuff career={career} onOpen={(base, level) => setSheet({ base, level })} />
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
function ItemCard({ base, item, mine, ownLv, worn, fame, price, onOpen, lock = null, single = false, flash = false }: {
  /** One level only (the phone): no level dots. */ single?: boolean;
  /** Flashing, until it is bought (the phone, on a new career). */ flash?: boolean;
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
      data-tour={base === "phone" ? "phone-tile" : undefined}
      onClick={onOpen}
      title={`${levelName(item)} — level ${lv}`}
      className={`kib-press group relative flex flex-col overflow-hidden rounded-2xl text-left transition hover:-translate-y-0.5 ${flash ? "kit-tile-flash" : ""}`}
      style={{ background: "var(--sk-card, linear-gradient(180deg, rgba(31,41,55,.95), rgba(12,17,28,.98)))", boxShadow: `inset 0 0 0 1px ${yours ? "rgba(52,211,153,.7)" : "rgba(255,255,255,.08)"}, 0 8px 18px -10px rgba(0,0,0,.8)` }}
    >
      <div className="relative" style={{ background: tileBg(lv) }}>
        <StylePicture base={base} level={lv} className="block aspect-[100/64] w-full transition group-hover:scale-105" />
        {yours && <span className="absolute left-1 top-1 rounded-full bg-emerald-400 px-1.5 py-0.5 text-[9px] font-black leading-none text-emerald-950">✓ YOURS</span>}
        {worn && <span className="absolute left-1 top-1 rounded-full bg-red-500 px-1.5 py-0.5 text-[9px] font-black leading-none text-white">WORN OUT</span>}
        {!single && <Pips className="absolute bottom-1 right-1" lit={yours ? ownLv : 0} shown={lv} />}
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
        {levels.length > 1 && <span className="absolute left-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-black text-white">Level {lv} of 5</span>}
        {mine && !worn && ownLv === lv && <span className="absolute right-2 top-2 rounded-full bg-emerald-400 px-2 py-0.5 text-[10px] font-black text-emerald-950">✓ YOURS</span>}
      </div>
      <div className="mt-2 text-[20px] font-black leading-tight text-white">{levelName(it)}</div>

      {/* All five levels — tap (or hover, on a computer) to look at one. */}
      {levels.length > 1 && <div className="mt-2 grid grid-cols-5 gap-1.5">
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
      </div>}

      <div className="mt-2 grid grid-cols-3 gap-1.5 text-center">
        <Stat big={`${fameText(gain)}`} small={mine && !worn ? `fame (now ${fameText(nowFame)})` : "fame"} color="#fcd34d" />
        <Stat big={life === null ? "Forever" : `${life} season${life === 1 ? "" : "s"}`} small="lasts" color="#ffffff" />
        <Stat big={`+${happy}`} small="happiness" color="#86efac" />
      </div>

      {/* Level 5 unlock — the slot is real, what it unlocks isn't decided. */}
      {levels.length > 1 && <div className={`mt-2 flex items-center gap-2 rounded-xl p-2 ring-1 ${lv === 5 ? "bg-yellow-400/15 ring-yellow-300/50" : "bg-white/[0.04] ring-white/10"}`}>
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-black/40 text-[16px]">🔒</span>
        <div className="min-w-0">
          <div className="text-[11px] font-black text-yellow-200">Level 5 unlock</div>
          <div className="text-[10.5px] font-bold text-white/75">To be decided — nothing extra yet.</div>
        </div>
      </div>}

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

/** Everything you own, in one place (Harry p40). */
function MyStuff({ career, onOpen }: { career: CareerState; onOpen: (base: string, level: number) => void }) {
  const items = [...career.ownedItems].sort((a, b) => fameFromOwned(career.ownedItems, b) - fameFromOwned(career.ownedItems, a));
  const boot = career.currentBoot;
  const bootBase = boot.baseId ?? boot.id;
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <div className="overflow-hidden rounded-2xl bg-black/35 ring-1 ring-white/10">
          <div className="bg-gradient-to-b from-sky-900/60 to-transparent"><BootPicture base={bootBase} level={boot.level ?? 1} className="block aspect-[100/64] w-full" /></div>
          <div className="px-2 pb-2">
            <div className="truncate text-[11.5px] font-black text-white">{boot.name}{boot.level ? ` · L${boot.level}` : ""}</div>
            <div className="text-[10px] font-bold text-white/75">{boot.matches > 0 ? `${boot.matches} matches left` : "Worn out"}</div>
          </div>
        </div>
        <div className="rounded-2xl bg-black/35 p-2 ring-1 ring-white/10">
          <div className="mb-1 text-[10px] font-black uppercase tracking-widest text-white/70">KIB Cans</div>
          {KIB_CANS.map((c) => (
            <div key={c.id} className="flex items-center gap-1.5 py-0.5">
              <KibCanIcon can={c} className="h-7 w-[18px] shrink-0" />
              <span className="flex-1 truncate text-[11px] font-black text-white">{c.name.replace(" KIB Can", "")}</span>
              <span className="text-[12px] font-black tabular-nums text-white">×{career.kibCans[c.id]}</span>
            </div>
          ))}
        </div>
      </div>
      {items.length === 0 ? (
        <div className="rounded-2xl bg-black/35 p-4 text-center text-[12px] font-bold text-white ring-1 ring-white/10">Nothing yet — your cars, homes and drip will live here.</div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {items.map((it) => {
            const base = baseIdOf(it);
            const lv = ownedLevelOf(it);
            const worn = isWornOut(it);
            return (
              <button
                key={it.id}
                data-item-card={base}
                onClick={() => onOpen(base, lv)}
                className="kib-press relative overflow-hidden rounded-2xl text-left ring-1 ring-white/10"
                style={{ background: "var(--sk-card, linear-gradient(180deg, rgba(31,41,55,.95), rgba(12,17,28,.98)))" }}
              >
                <div className="relative" style={{ background: tileBg(lv) }}>
                  <StylePicture base={base} level={lv} className={`block aspect-[100/64] w-full ${worn ? "opacity-40 grayscale" : ""}`} />
                  <Pips className="absolute bottom-1 right-1" lit={lv} shown={lv} />
                </div>
                <div className="px-1.5 pb-1.5 pt-1">
                  <div className="line-clamp-2 min-h-[26px] text-[11px] font-black leading-[13px] text-white">{levelName({ ...it, level: lv })}</div>
                  <div className="text-[10.5px] font-black text-amber-300">{worn ? "Worn out — 0 fame" : `${fameText(fameFromOwned(career.ownedItems, it))} fame`}</div>
                  <div className="text-[9.5px] font-bold text-white/70">{typeof it.seasonsLeft === "number" ? `${it.seasonsLeft} season${it.seasonsLeft === 1 ? "" : "s"} left` : "Keeps forever"}</div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
