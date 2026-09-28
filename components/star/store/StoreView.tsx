"use client";

/**
 * THE STORE — one screen, two homes.
 *
 * Harry, 27 Sep 2026: the store as a test area (/star-store-dev). 28 Sep:
 * "add store aswell" — the same store in the real career, reached from the
 * Shop page and the phone.
 *
 * This component only DRAWS the store. What it shows comes in as a
 * `StoreState` (lib/star/store/purchase.ts), and every button calls back out:
 *
 *   /star-store-dev  feeds it the test wallet kept in this browser
 *   the career       feeds it a view of the career (lib/star/store/career.ts)
 *                    and writes each result back into the save
 *
 * Every rule lives in lib/star/store/*.ts.
 */
import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import RunupPreview from "@/components/star/store/RunupPreview";
import AccessoryFigure from "@/components/star/store/AccessoryFigure";
import KibCanIcon from "@/components/star/KibCanIcon";
import {
  ANIMATIONS, ACCESSORIES, BOOSTS, bootsAtLevel, findItem, itemName, isPayToWin, isConsumable,
  RARITY_LABEL, SLOT_LABEL, ANIMATION_SET_LABEL,
  type StoreItem, type Rarity, type AccessoryItem, type AccessorySlot, type PriceContext, type AnimationSet,
} from "@/lib/star/store/catalogue";
import { dailySpecials, msUntilReset, formatCountdown } from "@/lib/star/store/daily";
import { owns, priceNow, type StoreState, type Currency } from "@/lib/star/store/purchase";
import {
  COIN_PACKS, coinsToStars, coinValueLine, packBonusPercent, packCoinsNow, formatPounds, COINS_PER_WAGE_WEEK,
} from "@/lib/star/store/coins";

export type StoreTab = "daily" | "animations" | "accessories" | "boosts" | "coins";
const TABS: { id: StoreTab; label: string }[] = [
  { id: "daily", label: "Daily" },
  { id: "animations", label: "Animations" },
  { id: "accessories", label: "Accessories" },
  { id: "boosts", label: "Boosts" },
  { id: "coins", label: "Coins" },
];

export interface StoreActionResult { ok: boolean; reason?: string }

export interface StoreViewProps {
  state: StoreState;
  ctx: PriceContext;
  dateKey: string;
  /** Date.now(), ticking — drives the specials countdown. */
  now: number;
  /** Test area only: how many days ahead the specials are. */
  dayOffset?: number;
  /** "Test" badge, "Use one (test)" and the test-mode wording. */
  testArea?: boolean;
  /** Where ‹ goes. */
  back: { href: string } | { onClick: () => void };
  /** Rendered under the header — the test area's controls. */
  controls?: ReactNode;
  /** Items this store doesn't sell (the career hides ideas not in the game yet). */
  hide?: (item: StoreItem) => boolean;
  /** "test": a pack just adds Coins (no payment). "soon": packs read Coming soon. */
  packs: "test" | "soon";
  /** One small line under the accessories ("Shows in matches soon"). */
  accessoriesNote?: string;
  /** A line on a boot's card/sheet — the career's "Wearing · 3 matches left". */
  bootStatus?: (bootId: string) => string | null;
  onBuy: (id: string, currency: Currency) => StoreActionResult;
  onEquip: (id: string) => StoreActionResult;
  onUnequip: (slot: AccessorySlot) => void;
  /** Test area only: take one boost out of the locker. */
  onUse?: (id: string) => StoreActionResult;
  onPack: (id: string) => StoreActionResult;
  onSwap: (coins: number) => StoreActionResult;
  /** Opens on this tab. */
  initialTab?: StoreTab;
  children?: ReactNode;
}
const RARITY_STYLE: Record<Rarity, { ring: string; chip: string; glow: string }> = {
  common: { ring: "border-slate-500/40", chip: "bg-slate-500/25 text-slate-200", glow: "from-slate-500/15" },
  rare: { ring: "border-sky-400/60", chip: "bg-sky-500/25 text-sky-200", glow: "from-sky-500/20" },
  epic: { ring: "border-violet-400/70", chip: "bg-violet-500/25 text-violet-200", glow: "from-violet-500/25" },
  legendary: { ring: "border-amber-300/80", chip: "bg-amber-400/25 text-amber-100", glow: "from-amber-400/30" },
};

const n = (x: number) => Math.round(x).toLocaleString("en-GB");

function CoinIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={`${className} shrink-0`} aria-hidden>
      <circle cx="10" cy="10" r="9" fill="#f59e0b" />
      <circle cx="10" cy="10" r="6.6" fill="#fcd34d" stroke="#b45309" strokeWidth="1" />
      <path d="M8 6.5 V13.5 M8 10 L12 6.5 M8 10 L12 13.5" stroke="#92400e" strokeWidth="1.7" strokeLinecap="round" fill="none" />
    </svg>
  );
}

function Stars({ v, className = "" }: { v: number; className?: string }) {
  return <span className={`tabular-nums ${className}`}><span className="text-yellow-300">★</span>{n(v)}</span>;
}
function Coins({ v, className = "" }: { v: number; className?: string }) {
  return <span className={`inline-flex items-center gap-1 tabular-nums ${className}`}><CoinIcon className="h-3.5 w-3.5" />{n(v)}</span>;
}

function RarityChip({ r }: { r: Rarity }) {
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${RARITY_STYLE[r].chip}`}>{RARITY_LABEL[r]}</span>;
}

/** Is this run-up or accessory the one currently in use? */
function inUse(item: StoreItem, state: StoreState): boolean {
  if (item.kind === "animation") return item.set === "penalty" ? state.penaltyRunup === item.id : state.freeKickRunup === item.id;
  if (item.kind === "accessory") return state.equipped[item.slot] === item.id;
  return false;
}

function rarityOf(item: StoreItem): Rarity | null {
  return item.kind === "animation" || item.kind === "accessory" ? item.rarity : null;
}

/** The picture for any item, at a given size. */
function ItemArt({ item, size, equippedWear }: { item: StoreItem; size: number; equippedWear?: AccessoryItem[] }) {
  if (item.kind === "animation") {
    return <RunupPreview style={item.id} className="block rounded-xl" />;
  }
  if (item.kind === "accessory") {
    const wear = [...(equippedWear ?? []).filter((w) => w.slot !== item.slot), item];
    return (
      <div className="flex justify-center rounded-xl bg-gradient-to-b from-[#12263f] to-[#0c1a12]">
        <AccessoryFigure wear={wear} width={size} height={Math.round(size * 1.05)} />
      </div>
    );
  }
  if (item.kind === "boost") {
    if (item.image) {
      return (
        <div className="flex items-center justify-center rounded-xl bg-white/[0.04]" style={{ height: size * 0.8 }}>
          <KibCanIcon can={{ color: item.color, image: item.image }} className="h-[80%] w-auto" />
        </div>
      );
    }
    return (
      <div className="flex items-center justify-center rounded-xl bg-white/[0.04]" style={{ height: size * 0.8 }}>
        <svg viewBox="0 0 40 40" style={{ height: size * 0.5 }} aria-hidden>
          {item.id === "training-boost" ? (
            <>
              <circle cx="20" cy="20" r="17" fill="#059669" />
              <path d="M22 7 L12 23 H19 L17 33 L28 16 H21 Z" fill="#ecfdf5" />
            </>
          ) : (
            <>
              <rect x="11" y="4" width="18" height="32" rx="5" fill="#e11d48" />
              <rect x="11" y="12" width="18" height="12" fill="#fecdd3" />
              <text x="20" y="21.5" textAnchor="middle" fontSize="8" fontWeight="900" fill="#9f1239">+3</text>
            </>
          )}
        </svg>
      </div>
    );
  }
  // A boot, as a simple side-on boot in the shop's colours.
  const hue = (item.boot.name.charCodeAt(3) * 37) % 360;
  return (
    <div className="flex items-center justify-center rounded-xl bg-white/[0.04]" style={{ height: size * 0.8 }}>
      <svg viewBox="0 0 60 30" style={{ width: size * 0.7 }} aria-hidden>
        <path d="M4 20 Q4 8 14 8 L26 9 Q32 15 44 16 Q56 18 56 23 L56 25 L4 25 Z" fill={`hsl(${hue} 70% 50%)`} />
        <path d="M4 25 L56 25 L56 27 L4 27 Z" fill="#0f172a" />
        <path d="M14 9 L20 16 M18 9 L23 15 M22 9 L26 14" stroke="#fff" strokeWidth="1.2" opacity="0.7" />
      </svg>
    </div>
  );
}

export default function StoreView(p: StoreViewProps) {
  const { state, ctx, dateKey, now, dayOffset = 0, testArea = false, hide } = p;
  const [tab, setTab] = useState<StoreTab>(p.initialTab ?? "daily");
  const [openId, setOpenId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(t);
  }, [toast]);

  const shown = (it: StoreItem) => !hide?.(it);
  const specials = useMemo(
    () => dailySpecials(dateKey).filter((s) => { const it = findItem(s.itemId); return !!it && !hide?.(it); }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dateKey],
  );
  const equippedWear = useMemo(
    () => Object.values(state.equipped).map((id) => ACCESSORIES.find((a) => a.id === id)).filter((a): a is AccessoryItem => !!a),
    [state.equipped],
  );
  const boots = useMemo(() => bootsAtLevel(ctx.level).filter((b) => !hide?.(b)), [ctx.level, hide]);
  const value = coinValueLine(ctx.weeklyWage);

  const doBuy = (id: string, cur: Currency) => {
    const r = p.onBuy(id, cur);
    const it = findItem(id);
    setToast(r.ok ? { text: `${it ? itemName(it) : id} bought`, ok: true } : { text: r.reason ?? "Couldn't buy", ok: false });
  };
  const doEquip = (id: string) => {
    const r = p.onEquip(id);
    if (!r.ok) setToast({ text: r.reason ?? "Couldn't equip", ok: false });
  };

  const open = openId ? findItem(openId) : undefined;

  return (
    <div className="min-h-[100dvh] bg-[#05070d] text-slate-100">
      <div className="mx-auto max-w-[900px] pb-24">
        {/* ── Header: title + wallet ── */}
        <div className="sticky top-0 z-20 bg-[#05070d]/95 backdrop-blur">
          <div className="flex items-center gap-2 px-4 pt-3 pb-2">
            {"href" in p.back
              ? <Link href={p.back.href} aria-label="Back" className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-lg font-black">‹</Link>
              : <button onClick={p.back.onClick} aria-label="Back" className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-lg font-black">‹</button>}
            <h1 className="text-[19px] font-black tracking-tight">Store</h1>
            {testArea && <span className="rounded-md bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-rose-200">Test</span>}
            <div className="ml-auto flex items-center gap-1.5">
              <div className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[13px] font-black"><Stars v={state.stars} /></div>
              <button onClick={() => setTab("coins")} className="flex items-center gap-1 rounded-full border border-amber-300/30 bg-amber-400/10 px-2.5 py-1 text-[13px] font-black text-amber-100">
                <Coins v={state.coins} /><span className="text-amber-300">+</span>
              </button>
            </div>
          </div>

          {p.controls}

          {/* ── Tabs ── */}
          <div className="flex gap-1 overflow-x-auto px-4 pb-2 [scrollbar-width:none]">
            {TABS.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-black transition ${tab === t.id ? "bg-white text-slate-900" : "bg-white/[0.06] text-slate-300"}`}
              >{t.label}</button>
            ))}
          </div>
        </div>

        <div className="px-4">
          {tab === "daily" && (
            <DailyTab specials={specials} state={state} ctx={ctx} dateKey={dateKey} now={now}
              dayOffset={dayOffset} equippedWear={equippedWear} onOpen={setOpenId} />
          )}

          {tab === "animations" && (
            <>
              {(["penalty", "free_kick"] as AnimationSet[]).map((set) => (
                <div key={set} className="mb-5">
                  <SectionNote left={ANIMATION_SET_LABEL[set]} right="Looks only" />
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    {ANIMATIONS.filter((a) => a.set === set && shown(a)).map((a) => (
                      <ItemCard key={a.id} item={a} state={state} ctx={ctx} dateKey={dateKey} onOpen={setOpenId}
                        equipped={inUse(a, state)} equippedWear={equippedWear} />
                    ))}
                  </div>
                </div>
              ))}
            </>
          )}

          {tab === "accessories" && (
            <>
              <div className="mb-4 flex items-center gap-3 rounded-2xl border border-white/10 bg-gradient-to-br from-[#11233a] to-[#0a1510] p-3">
                <AccessoryFigure wear={equippedWear} width={140} height={150} />
                <div className="min-w-0 flex-1">
                  <div className="text-[15px] font-black">Your player</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {equippedWear.length === 0 && <span className="text-[12px] font-semibold text-slate-400">Nothing on yet — buy something below and tap Wear.</span>}
                    {equippedWear.map((w) => (
                      <button key={w.id} onClick={() => p.onUnequip(w.slot)}
                        className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-bold text-slate-200">{w.name} ✕</button>
                    ))}
                  </div>
                  {p.accessoriesNote && <div className="mt-1.5 text-[11px] font-bold text-sky-300">{p.accessoriesNote}</div>}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {ACCESSORIES.filter(shown).map((a) => (
                  <ItemCard key={a.id} item={a} state={state} ctx={ctx} dateKey={dateKey} onOpen={setOpenId}
                    equipped={inUse(a, state)} equippedWear={equippedWear} />
                ))}
              </div>
            </>
          )}

          {tab === "boosts" && (
            <>
              <SectionNote left="Boosts" right="These help you win" warn />
              <div className="grid gap-2.5">
                {BOOSTS.filter(shown).map((b) => <BoostRow key={b.id} item={b} state={state} ctx={ctx} dateKey={dateKey} onOpen={setOpenId} />)}
              </div>
              <div className="mt-5 mb-2 flex items-baseline justify-between">
                <div className="text-[12px] font-black uppercase tracking-wider text-slate-400">Boots · level {ctx.level}</div>
                <div className="text-[11px] font-semibold text-slate-500">the real shop&apos;s boots and prices</div>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {boots.map((b) => <ItemCard key={b.id} item={b} state={state} ctx={ctx} dateKey={dateKey} onOpen={setOpenId} bootStatus={p.bootStatus} />)}
              </div>
            </>
          )}

          {tab === "coins" && (
            <CoinsTab state={state} wage={ctx.weeklyWage} value={value} packs={p.packs}
              onPack={(id) => { const r = p.onPack(id); setToast({ text: r.ok ? "Coins added — test, nothing charged" : r.reason ?? "", ok: r.ok }); }}
              onSwap={(c) => { const r = p.onSwap(c); setToast({ text: r.ok ? `+★${n(coinsToStars(c, ctx.weeklyWage))}` : r.reason ?? "", ok: r.ok }); }}
            />
          )}
        </div>
      </div>

      {open && (
        <DetailSheet item={open} state={state} ctx={ctx} dateKey={dateKey} equippedWear={equippedWear}
          accessoriesNote={p.accessoriesNote} bootStatus={p.bootStatus}
          onClose={() => setOpenId(null)} onBuy={doBuy} onEquip={doEquip}
          onUnequip={p.onUnequip}
          onUse={p.onUse ? (id) => { const r = p.onUse!(id); setToast({ text: r.ok ? "Used one (test)" : r.reason ?? "", ok: r.ok }); } : undefined} />
      )}

      {toast && (
        <div className={`pointer-events-none fixed left-1/2 top-[calc(0.75rem+env(safe-area-inset-top))] z-50 -translate-x-1/2 whitespace-nowrap rounded-full px-4 py-2 text-[13px] font-black shadow-xl ${toast.ok ? "bg-emerald-500 text-emerald-950" : "bg-rose-500 text-white"}`}>
          {toast.text}
        </div>
      )}

      {p.children}
    </div>
  );
}

function SectionNote({ left, right, warn = false }: { left: string; right: string; warn?: boolean }) {
  return (
    <div className="mb-3 mt-1 flex items-baseline justify-between gap-2">
      <div className="text-[15px] font-black">{left}</div>
      <div className={`text-[11px] font-bold ${warn ? "text-amber-300" : "text-slate-400"}`}>{right}</div>
    </div>
  );
}

function PriceLine({ item, state, ctx, dateKey }: { item: StoreItem; state: StoreState; ctx: PriceContext; dateKey: string }) {
  const { price, full, percentOff } = priceNow(item, ctx, state, dateKey);
  if (price.stars === 0) return <span className="text-[12px] font-black text-emerald-300">Free</span>;
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] font-black">
      <Stars v={price.stars} />
      <span className="text-slate-600">·</span>
      <Coins v={price.coins} className="text-amber-100" />
      {percentOff > 0 && (
        <span className="w-full text-[10px] font-bold text-slate-500 line-through"><Stars v={full.stars} /> · {n(full.coins)}</span>
      )}
    </div>
  );
}

function StateBadge({ item, state, equipped }: { item: StoreItem; state: StoreState; equipped?: boolean }) {
  if (isConsumable(item)) {
    const have = state.inventory[item.id] ?? 0;
    return have > 0 ? <span className="text-[11px] font-black text-emerald-300">×{have} held</span> : null;
  }
  if (equipped) return <span className="text-[11px] font-black text-emerald-300">✓ Wearing</span>;
  if (owns(state, item.id)) return <span className="text-[11px] font-black text-sky-300">Owned</span>;
  return null;
}

function ItemCard({ item, state, ctx, dateKey, onOpen, equipped, equippedWear, bootStatus }: {
  item: StoreItem; state: StoreState; ctx: PriceContext; dateKey: string; onOpen: (id: string) => void;
  equipped?: boolean; equippedWear?: AccessoryItem[]; bootStatus?: (bootId: string) => string | null;
}) {
  const bootLine = item.kind === "boot" ? bootStatus?.(item.id) ?? null : null;
  const rar = rarityOf(item);
  const { percentOff } = priceNow(item, ctx, state, dateKey);
  const blurb = item.kind === "animation" ? item.blurb : item.kind === "boot"
    ? `+${item.boot.power} power · +${item.boot.technique} technique${item.boot.curve ? " · curve" : ""}${item.boot.extraTouch ? " · extra touch" : ""}`
    : item.kind === "boost" ? item.effect : SLOT_LABEL[item.slot];
  return (
    <button onClick={() => onOpen(item.id)}
      className={`relative flex flex-col overflow-hidden rounded-2xl border bg-gradient-to-b to-transparent p-2 text-left ${rar ? `${RARITY_STYLE[rar].ring} ${RARITY_STYLE[rar].glow}` : "border-white/10 from-white/[0.04]"}`}
    >
      {percentOff > 0 && <span className="absolute right-3 top-3 z-10 rounded-md bg-rose-500 px-1.5 py-0.5 text-[10px] font-black text-white">−{percentOff}%</span>}
      {rar && <span className="absolute left-3 top-3 z-10"><RarityChip r={rar} /></span>}
      <ItemArt item={item} size={150} equippedWear={item.kind === "accessory" ? [] : equippedWear} />
      <div className="mt-2 truncate text-[13.5px] font-black">{itemName(item)}</div>
      <div className="mt-0.5 line-clamp-2 min-h-[28px] text-[11px] font-semibold leading-snug text-slate-400">{blurb}</div>
      <div className="mt-1.5 flex items-end justify-between gap-1">
        {!isConsumable(item) && owns(state, item.id) ? <span /> : <PriceLine item={item} state={state} ctx={ctx} dateKey={dateKey} />}
        {bootLine ? <span className="text-[11px] font-black text-emerald-300">{bootLine}</span> : <StateBadge item={item} state={state} equipped={equipped} />}
      </div>
    </button>
  );
}

function BoostRow({ item, state, ctx, dateKey, onOpen }: { item: StoreItem; state: StoreState; ctx: PriceContext; dateKey: string; onOpen: (id: string) => void }) {
  if (item.kind !== "boost") return null;
  const { percentOff } = priceNow(item, ctx, state, dateKey);
  return (
    <button onClick={() => onOpen(item.id)} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-2.5 text-left">
      <div className="w-16 shrink-0"><ItemArt item={item} size={80} /></div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-[14px] font-black">{item.name}</span>
          {item.newToGame && <span className="rounded bg-emerald-500/20 px-1 text-[9px] font-black uppercase text-emerald-200">New</span>}
          {percentOff > 0 && <span className="rounded bg-rose-500 px-1 text-[9px] font-black text-white">−{percentOff}%</span>}
        </div>
        <div className="text-[11.5px] font-semibold text-slate-400">{item.effect}</div>
        <div className="mt-1 flex items-center justify-between"><PriceLine item={item} state={state} ctx={ctx} dateKey={dateKey} /><StateBadge item={item} state={state} /></div>
      </div>
    </button>
  );
}

function DailyTab({ specials, state, ctx, dateKey, now, dayOffset, equippedWear, onOpen }: {
  specials: ReturnType<typeof dailySpecials>; state: StoreState; ctx: PriceContext; dateKey: string; now: number;
  dayOffset: number; equippedWear: AccessoryItem[]; onOpen: (id: string) => void;
}) {
  const [head, ...rest] = specials;
  const headItem = findItem(head.itemId);
  const bought = state.specialsBought[dateKey] ?? [];
  return (
    <>
      <div className="mb-3 mt-1 flex items-end justify-between">
        <div>
          <div className="text-[15px] font-black">Daily specials</div>
          <div className="text-[11px] font-bold text-slate-400">
            {dayOffset > 0 ? `Showing ${dateKey} (+${dayOffset} day${dayOffset > 1 ? "s" : ""})` : "Same for everyone today"}
          </div>
        </div>
        <div className="shrink-0 whitespace-nowrap rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[12px] font-black tabular-nums">
          ⏱ New in {formatCountdown(msUntilReset(now))}
        </div>
      </div>

      {headItem && (
        <button onClick={() => onOpen(headItem.id)}
          className={`relative mb-3 flex w-full items-center gap-3 overflow-hidden rounded-3xl border-2 bg-gradient-to-br to-[#0a1020] p-3 text-left ${RARITY_STYLE[rarityOf(headItem) ?? "rare"].ring} ${RARITY_STYLE[rarityOf(headItem) ?? "rare"].glow}`}>
          <span className="absolute left-3 top-3 z-10 rounded-md bg-amber-400 px-1.5 py-0.5 text-[10px] font-black uppercase text-amber-950">Today&apos;s pick</span>
          <span className="absolute right-3 top-3 z-10 rounded-md bg-rose-500 px-2 py-0.5 text-[13px] font-black text-white">−{head.percentOff}%</span>
          <div className="w-[46%] max-w-[260px] shrink-0 pt-6"><ItemArt item={headItem} size={150} equippedWear={headItem.kind === "accessory" ? [] : equippedWear} /></div>
          <div className="min-w-0 flex-1 pt-6">
            <div className="text-[18px] font-black leading-tight">{itemName(headItem)}</div>
            <div className="mt-1 flex items-center gap-1.5">
              {rarityOf(headItem) && <RarityChip r={rarityOf(headItem)!} />}
              <span className="text-[11px] font-bold text-slate-400">{headItem.kind === "animation" ? (headItem.set === "penalty" ? "Penalty run-up" : "Free-kick run-up") : headItem.kind === "accessory" ? SLOT_LABEL[headItem.slot] : ""}</span>
            </div>
            <div className="mt-3">{owns(state, headItem.id) ? <span className="text-[12px] font-black text-sky-300">Owned</span> : <PriceLine item={headItem} state={state} ctx={ctx} dateKey={dateKey} />}</div>
            {bought.includes(headItem.id) && <div className="mt-1 text-[11px] font-bold text-slate-500">Bought today</div>}
          </div>
        </button>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {rest.map((s) => {
          const it = findItem(s.itemId);
          return it ? (
            <ItemCard key={s.itemId} item={it} state={state} ctx={ctx} dateKey={dateKey} onOpen={onOpen}
              equipped={inUse(it, state)}
              equippedWear={equippedWear} />
          ) : null;
        })}
      </div>
    </>
  );
}

function CoinsTab({ state, wage, value, packs, onPack, onSwap }: {
  state: StoreState; wage: number; value: ReturnType<typeof coinValueLine>; packs: "test" | "soon";
  onPack: (id: string) => void; onSwap: (coins: number) => void;
}) {
  return (
    <>
      {packs === "test" ? (
        <div className="mb-3 mt-1 rounded-2xl border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-[12px] font-bold text-rose-100">
          Test mode — no payment is taken. Buy just adds the Coins.
        </div>
      ) : (
        <div className="mb-3 mt-1 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[12px] font-bold text-slate-300">
          Buying Coins is coming soon.
        </div>
      )}
      <div className="mb-3 rounded-2xl border border-amber-300/30 bg-amber-400/10 px-3 py-2.5 text-[13px] font-black text-amber-50">
        100 Coins = about {value.weeks} weeks&apos; wages at your level: <Stars v={value.stars} />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {COIN_PACKS.map((p) => {
          const now = packCoinsNow(p, state.firstPackBought);
          const doubled = now > p.coins;
          const bonus = packBonusPercent(p);
          return (
            <button key={p.id} onClick={() => { if (packs === "test") onPack(p.id); }} disabled={packs !== "test"}
              className={`relative flex flex-col items-center overflow-hidden rounded-2xl border p-3 pt-5 text-center ${p.bestValue ? "border-amber-300 bg-gradient-to-b from-amber-400/25 to-transparent" : doubled ? "border-emerald-400 bg-gradient-to-b from-emerald-400/20 to-transparent" : "border-white/10 bg-white/[0.035]"}`}>
              {p.bestValue && <span className="absolute inset-x-0 top-0 bg-amber-400 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-950">Best value</span>}
              {doubled && <span className="absolute inset-x-0 top-0 bg-emerald-400 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-950">First purchase ×2</span>}
              <div className="mt-1 flex items-center">
                {Array.from({ length: Math.min(5, 1 + COIN_PACKS.indexOf(p)) }).map((_, i) => (
                  <CoinIcon key={i} className={`h-7 w-7 ${i ? "-ml-3" : ""}`} />
                ))}
              </div>
              <div className="mt-1.5 text-[11px] font-black uppercase tracking-wide text-slate-400">{p.name}</div>
              <div className="text-[20px] font-black tabular-nums text-amber-50">{n(now)}</div>
              <div className="h-4 text-[11px] font-black text-emerald-300">
                {doubled ? <span className="text-slate-400 line-through">{n(p.coins)}</span> : bonus > 0 ? `+${bonus}% bonus` : ""}
              </div>
              <div className="mt-1 text-[10.5px] font-semibold text-slate-400">≈ {n(now / COINS_PER_WAGE_WEEK)} weeks&apos; wages</div>
              {packs === "test"
                ? <div className="mt-2 w-full rounded-xl bg-white py-1.5 text-[14px] font-black text-slate-900">{formatPounds(p.pounds)}</div>
                : <div className="mt-2 w-full rounded-xl bg-white/15 py-1.5 text-[13px] font-black text-slate-200">Coming soon</div>}
            </button>
          );
        })}
      </div>

      <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.035] p-3">
        <div className="text-[14px] font-black">Swap Coins for ★</div>
        <div className="mb-2 text-[11.5px] font-semibold text-slate-400">At your wage of <Stars v={wage} /> a week.</div>
        <div className="grid grid-cols-3 gap-2">
          {[100, 500, 1000].map((c) => (
            <button key={c} onClick={() => onSwap(c)} disabled={state.coins < c}
              className="rounded-xl border border-white/10 bg-white/[0.05] py-2 text-[12px] font-black disabled:opacity-35">
              <Coins v={c} className="justify-center" />
              <div className="mt-0.5 text-slate-300">→ <Stars v={coinsToStars(c, wage)} /></div>
            </button>
          ))}
        </div>
      </div>

      {state.log.length > 0 && (
        <div className="mt-5">
          <div className="mb-1.5 text-[12px] font-black uppercase tracking-wider text-slate-400">Receipts</div>
          <div className="grid gap-1">
            {state.log.slice(0, 8).map((l, i) => (
              <div key={i} className="rounded-lg bg-white/[0.03] px-2.5 py-1.5 text-[11.5px] font-semibold text-slate-300">{l.what}</div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function DetailSheet({ item, state, ctx, dateKey, equippedWear, accessoriesNote, bootStatus, onClose, onBuy, onEquip, onUnequip, onUse }: {
  item: StoreItem; state: StoreState; ctx: PriceContext; dateKey: string; equippedWear: AccessoryItem[];
  accessoriesNote?: string; bootStatus?: (bootId: string) => string | null;
  onClose: () => void; onBuy: (id: string, c: Currency) => void; onEquip: (id: string) => void;
  onUnequip: (slot: AccessorySlot) => void; onUse?: (id: string) => void;
}) {
  const bootLine = item.kind === "boot" ? bootStatus?.(item.id) ?? null : null;
  const rar = rarityOf(item);
  const { price, full, percentOff } = priceNow(item, ctx, state, dateKey);
  const owned = owns(state, item.id);
  const consumable = isConsumable(item);
  const p2w = isPayToWin(item);
  const wearing = inUse(item, state);
  const setWord = item.kind === "animation" ? (item.set === "penalty" ? "penalty" : "free-kick") : "";
  const desc = item.kind === "animation" ? `${item.set === "penalty" ? "Penalty" : "Free-kick"} run-up · ${item.blurb}`
    : item.kind === "accessory" ? `${SLOT_LABEL[item.slot]} · worn over your kit`
      : item.kind === "boost" ? item.effect
        : `+${item.boot.power} power · +${item.boot.technique} technique · ${item.boot.matches} matches${item.boot.curve ? " · curves the ball" : ""}${item.boot.extraTouch ? " · extra touch" : ""}`;

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 sm:items-center" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        className="max-h-[92dvh] w-full max-w-[420px] overflow-y-auto rounded-t-3xl border border-white/10 bg-[#0b1220] p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:rounded-3xl">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {rar && <RarityChip r={rar} />}
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${p2w ? "bg-amber-400/20 text-amber-200" : "bg-white/10 text-slate-300"}`}>{p2w ? "Helps you win" : "Cosmetic"}</span>
          </div>
          <button onClick={onClose} aria-label="Close" className="h-8 w-8 rounded-full bg-white/10 text-[15px] font-black">✕</button>
        </div>
        <div className="mx-auto max-w-[300px]">
          <ItemArt item={item} size={260} equippedWear={item.kind === "accessory" ? equippedWear : undefined} />
        </div>
        <div className="mt-3 flex items-center gap-2">
          <div className="text-[20px] font-black">{itemName(item)}</div>
          {percentOff > 0 && <span className="rounded-md bg-rose-500 px-1.5 py-0.5 text-[11px] font-black text-white">−{percentOff}% today</span>}
        </div>
        <div className="mt-0.5 text-[13px] font-semibold text-slate-400">{desc}</div>
        {item.kind === "accessory" && accessoriesNote && (
          <div className="mt-1 text-[11px] font-bold text-sky-300">{accessoriesNote}</div>
        )}
        {bootLine && <div className="mt-1 text-[12px] font-black text-emerald-300">{bootLine}</div>}
        {item.kind === "boost" && item.newToGame && (
          <div className="mt-1 text-[11px] font-bold text-emerald-300">New idea — not in the game yet.</div>
        )}

        <div className="mt-4 grid gap-2">
          {(!owned || consumable) && price.stars > 0 && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => onBuy(item.id, "stars")} disabled={state.stars < price.stars}
                  className="rounded-2xl bg-yellow-300 py-3 text-[15px] font-black text-slate-900 disabled:opacity-35">
                  <Stars v={price.stars} className="[&>span]:text-slate-900" />
                  {percentOff > 0 && <div className="text-[10px] font-bold line-through opacity-60">★{n(full.stars)}</div>}
                </button>
                <button onClick={() => onBuy(item.id, "coins")} disabled={state.coins < price.coins}
                  className="rounded-2xl bg-amber-500 py-3 text-[15px] font-black text-amber-950 disabled:opacity-35">
                  <span className="inline-flex items-center justify-center gap-1"><CoinIcon className="h-4 w-4" />{n(price.coins)}</span>
                  {percentOff > 0 && <div className="text-[10px] font-bold line-through opacity-60">{n(full.coins)}</div>}
                </button>
              </div>
              <div className="text-center text-[11px] font-semibold text-slate-500">
                About {price.weeks < 1 ? price.weeks.toFixed(1) : Math.round(price.weeks * 10) / 10} week{price.weeks === 1 ? "" : "s"} of your wages either way
              </div>
            </>
          )}
          {owned && !consumable && (item.kind === "animation" || item.kind === "accessory") && (
            wearing
              ? item.kind === "accessory"
                ? <button onClick={() => onUnequip(item.slot)} className="rounded-2xl bg-white/10 py-3 text-[15px] font-black">Take off</button>
                : <div className="rounded-2xl bg-emerald-500/20 py-3 text-center text-[15px] font-black text-emerald-200">✓ Your {setWord} run-up</div>
              : <button onClick={() => onEquip(item.id)} className="rounded-2xl bg-emerald-400 py-3 text-[15px] font-black text-emerald-950">{item.kind === "animation" ? `Use for ${setWord === "penalty" ? "penalties" : "free kicks"}` : "Wear"}</button>
          )}
          {owned && item.kind === "boot" && <div className="rounded-2xl bg-sky-500/15 py-3 text-center text-[14px] font-black text-sky-200">Owned</div>}
          {onUse && consumable && (state.inventory[item.id] ?? 0) > 0 && (
            <button onClick={() => onUse(item.id)} className="rounded-2xl bg-white/10 py-2.5 text-[13px] font-black">Use one (test) · ×{state.inventory[item.id]} held</button>
          )}
        </div>
      </div>
    </div>
  );
}
