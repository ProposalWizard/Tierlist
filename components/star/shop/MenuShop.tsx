"use client";

/**
 * THE MENU SHOP — layout B on G1 navy (RUL-UI-010, Harry 19 Nov 2026, from
 * phone-size drafts). It replaces the Showroom as the shop you reach from the
 * menus; the Showroom (shop2d/ShowroomShop.tsx) moves to the 3D phone later
 * (RUL-UI-008) and is not touched here.
 *
 *   - top: Back · SHOP · ? · settings, then the game's TopHud on screen="shop"
 *     (Fame + Money, RUL-UI-009) with the picked item's price and fame gain;
 *   - category chips (Cans, Boots, Drip, Gadgets, Cars, Homes, Holiday);
 *   - one big product card (picture, name, LEVEL x OF y, the gold price);
 *     swipe it left / right, or tap a thumbnail, to change item; dots under it;
 *   - one line of what it gives;
 *   - tap the card or the price → the item sheet: every level, what each
 *     gives, one Buy button, the money you will have left. Swipe down or
 *     Close to shut it;
 *   - the game's bottom bar (`mainBar`), as on every other screen.
 * No entrance animations (14 Oct 2026: "it should just go straight in").
 *
 * Buying is the game's own: the same handlers ShowroomShop gets from
 * app/star-dev/page.tsx (handleBuyKib / handleBuyBoot / handleBuyItem /
 * handleBuyFromBlackMarket), called with the same items, the same prices
 * (bootPrice: the boot sponsor's 25%; kibCanPrice: a slice of your wage) and
 * the same checks first (enough money, a level you don't own yet, banned boots
 * only on the black market, a pair bought this visit is sold out).
 *
 * Test page: /star-shop-dev. Not in the career yet (Harry approves it there first).
 */
import "./menuShop.css";
import { useMemo, useRef, useState } from "react";
import type React from "react";
import type { CareerState, Boot, OwnedItem } from "@/lib/star/types";
import { KIB_CANS, kibCanPrice, kibCanEffectLabel, BOOTS_ALL_LEVELS, LIFESTYLE_ALL_LEVELS, baseIdOf, type KibCan } from "@/lib/star/shopData";
import { bootPrice } from "@/lib/star/sponsorDeals";
import { ruleBookFor } from "@/lib/star/ruleBook";
import { blackMarketPrice, LAWYER_FEE } from "@/lib/star/corruption";
import { fameGainFromBuying, isWornOut, itemLifeSeasons } from "@/lib/star/fame";
import { styleGroupOf, levelName, familyName, fameText, type StyleGroup } from "@/lib/star/lifestyleLevels";
import { styleUnlockStar } from "@/lib/star/unlocks";
import { starsNow } from "@/lib/star/starPoints";
import { nextUpIndex } from "@/lib/star/shopNextItem";
import { formatMoney, MONEY_SIGN } from "@/lib/star/money";
import TopHud from "../ui/TopHud";
import BackButton from "../ui/BackButton";
import PressButton from "../ui/PressButton";
import BootPicture from "../BootPicture";
import StylePicture from "../StylePicture";

interface ActionResult { ok: boolean; reason?: string }

export type MenuCat = "cans" | "boots" | StyleGroup;
export const MENU_CATS: { id: MenuCat; label: string }[] = [
  { id: "cans", label: "Cans" },
  { id: "boots", label: "Boots" },
  { id: "drip", label: "Drip" },
  { id: "gadgets", label: "Gadgets" },
  { id: "cars", label: "Cars" },
  { id: "homes", label: "Homes" },
  { id: "holiday", label: "Holiday" },
];

/** Boots in the shop's order (the same order as the Showroom). */
const BOOT_ORDER = ["starter", "speed", "power", "control", "elite", "curl", "maestro"];

/** Each style family with its levels, in shop order. */
const STYLE_BASES: Map<string, OwnedItem[]> = (() => {
  const seen = new Map<string, OwnedItem[]>();
  for (const i of LIFESTYLE_ALL_LEVELS) {
    const b = baseIdOf(i);
    if (!seen.has(b)) seen.set(b, []);
    seen.get(b)!.push(i);
  }
  seen.forEach((v) => { v.sort((a, b) => (a.level ?? 0) - (b.level ?? 0)); });
  return seen;
})();

/** The keys (can id / boot base / style base) in each category. */
const KEYS: Record<MenuCat, string[]> = (() => {
  const out = {
    cans: KIB_CANS.map((c) => c.id),
    boots: BOOT_ORDER.filter((b) => BOOTS_ALL_LEVELS.some((x) => baseIdOf(x) === b)),
  } as Record<MenuCat, string[]>;
  for (const g of ["drip", "gadgets", "cars", "homes", "holiday"] as StyleGroup[]) {
    out[g] = Array.from(STYLE_BASES.keys()).filter((b) => styleGroupOf(STYLE_BASES.get(b)![0]) === g);
  }
  return out;
})();

const money = (n: number) => `${MONEY_SIGN}${formatMoney(n)}`;
const moneyFull = (n: number) => `${MONEY_SIGN}${Math.max(0, Math.round(n)).toLocaleString("en-GB")}`;

/** The item's picture: the shop render (public/shop/*.webp), a drawing if it is missing. */
function ItemPic({ kind, base, level }: { kind: "boot" | "style"; base: string; level: number }) {
  const lv = base === "phone" ? 1 : Math.max(1, Math.min(5, level));
  const src = kind === "boot" ? `/shop/boot-${base}-L${lv}.webp` : `/shop/${base}-L${lv}.webp`;
  const [bad, setBad] = useState<string | null>(null);
  if (bad === src) return kind === "boot" ? <BootPicture base={base} level={lv} className="h-full w-full" /> : <StylePicture base={base} level={lv} className="h-full w-full" />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" draggable={false} decoding="async" onError={() => setBad(src)} />;
}

function CanPic({ can }: { can: KibCan }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={can.image} alt="" draggable={false} className="ms-can" />;
}

/** One level of one item, as the sheet lists it. */
interface Rung { level: number; price: number; gives: string; pic: React.ReactNode }

/** One item, as the screen shows it. */
interface ItemView {
  key: string;
  name: string;
  /** "LEVEL 3 OF 5", or "KIB CAN · ×2 OWNED". */
  levelText: string;
  line: string;
  /** The family's one line under the name in the sheet. */
  sheetLine: string;
  pic: (level: number) => React.ReactNode;
  rungs: Rung[];
  /** Levels you own (all ≤ this). 0 = none. */
  ownedLv: number;
  /** The level the shop offers by default. */
  nextLv: number;
  /** Yours, for the thumbnail's OWNED. */
  owned: boolean;
  /** Not open yet: the star level it opens at. */
  lockAt: number | null;
  /** Banned by the FA: only on the black market. */
  banned: boolean;
  /** A pair bought this visit (boots only). */
  sold: (level: number) => boolean;
  /** Can this level be bought at all (not owned, not blocked)? */
  buyable: (level: number) => boolean;
  priceOf: (level: number) => number;
  fameGain: (level: number) => number;
  /** Buy that level: the game's own handler. Returns an error line or null. */
  buy: (level: number, lawyers: boolean) => string | null;
  thumbPrice: number;
}

export interface MenuShopProps {
  career: CareerState;
  onBack: () => void;
  /** The game's own buy handlers (app/star-dev/page.tsx), the same ones the Showroom gets. */
  onBuyKib: (can: KibCan) => void;
  onBuyBoot: (boot: Boot) => void;
  onBuyItem: (item: OwnedItem) => void;
  onBuyFromBlackMarket: (boot: Boot, useLawyers: boolean) => ActionResult;
  /** Drink a can (the cans' sheet shows "Use one" when given). */
  onUseCan?: (id: KibCan["id"]) => void;
  /** The ? button. Without it, ? shows a one-line tip. */
  onHelp?: () => void;
  /** The settings button. Hidden without it. */
  onSettings?: () => void;
  /** The game's bottom bar (MainBar.tsx), as every other screen gets it. */
  mainBar?: React.ReactNode;
  /** Start on this category (test pages, a shop link). */
  startCat?: MenuCat;
}

export default function MenuShop({ career, onBack, onBuyKib, onBuyBoot, onBuyItem, onBuyFromBlackMarket, onUseCan, onHelp, onSettings, mainBar, startCat = "boots" }: MenuShopProps) {
  const [soldOut, setSoldOut] = useState<Set<string>>(() => new Set());
  const [pick, setPick] = useState<Record<string, number>>({});
  const [sheet, setSheet] = useState<string | null>(null);
  const [lawyers, setLawyers] = useState(false);
  const [note, setNote] = useState<{ text: string; done: boolean } | null>(null);
  const [tip, setTip] = useState(false);

  // ── The items, read from the career (prices and rules as the Showroom) ──
  const banned = useMemo(() => new Set(ruleBookFor(career, "FA").bannedItems), [career]);
  const stars = starsNow(career);
  const lockAtOf = (base: string): number | null => {
    if (!career.unlocks) return null;
    const need = styleUnlockStar(base);
    return stars >= need ? null : need;
  };
  const owned = career.ownedItems;
  const cur = career.currentBoot;

  const viewOf = (cat: MenuCat, key: string): ItemView => {
    if (cat === "cans") {
      const c = KIB_CANS.find((x) => x.id === key)!;
      const price = kibCanPrice(c, career.contract.wage);
      const have = career.kibCans[c.id] ?? 0;
      return {
        key, name: c.name.replace(" KIB Can", " Can"), levelText: `KIB can · ×${have} owned`,
        line: kibCanEffectLabel(c), sheetLine: kibCanEffectLabel(c),
        pic: () => <CanPic can={c} />, rungs: [], ownedLv: 0, nextLv: 1, owned: false, lockAt: null, banned: false,
        sold: () => false, buyable: () => true, priceOf: () => price, fameGain: () => 0, thumbPrice: price,
        buy: () => {
          if (career.money < price) return "Not enough money";
          onBuyKib(c);
          return null;
        },
      };
    }
    if (cat === "boots") {
      const levels = BOOTS_ALL_LEVELS.filter((b) => baseIdOf(b) === key).sort((a, b) => (a.level ?? 0) - (b.level ?? 0))
        .map((b) => ({ ...b, price: bootPrice(career, b.price) }));
      const wearing = baseIdOf(cur) === key;
      const mineLv = wearing ? cur.level ?? 1 : 0;
      const live = wearing && cur.matches > 0;
      const nextLv = wearing ? (live ? Math.min(levels.length, mineLv + 1) : mineLv) : 1;
      const isBanned = banned.has(key);
      const at = (lv: number) => levels.find((x) => x.level === lv) ?? levels[0];
      const legal = (lv: number) => at(lv).price;
      const priceOf = (lv: number) => (isBanned ? blackMarketPrice(legal(lv)) : legal(lv));
      const gives = (b: Boot) => [`+${b.power} power`, `+${b.technique} technique`, `${b.matches} matches`, ...(b.curve ? ["curve"] : []), ...(b.extraTouch ? ["extra touch"] : [])].join(" · ");
      return {
        key, name: levels[0].name, levelText: "", line: gives(at(pick[key] ?? nextLv)),
        sheetLine: wearing ? (live ? `You wear level ${mineLv} · ${cur.matches} matches left` : `Your level ${mineLv} pair is worn out`) : "Boots last a set number of matches",
        pic: (lv) => <ItemPic kind="boot" base={key} level={lv} />,
        rungs: levels.map((b) => ({ level: b.level ?? 1, price: priceOf(b.level ?? 1), gives: gives(b), pic: <ItemPic kind="boot" base={key} level={b.level ?? 1} /> })),
        ownedLv: live ? mineLv : 0, nextLv, owned: live, lockAt: null, banned: isBanned,
        sold: (lv) => soldOut.has(at(lv).id),
        buyable: () => true, priceOf, fameGain: () => 0, thumbPrice: priceOf(nextLv),
        buy: (lv, law) => {
          const b = at(lv);
          if (soldOut.has(b.id)) return "Sold out — back next visit";
          if (isBanned) {
            const r = onBuyFromBlackMarket(b, law);
            if (!r.ok) return r.reason ?? "Failed";
          } else {
            if (career.money < b.price) return "Not enough money";
            onBuyBoot(b);
          }
          setSoldOut((s) => new Set(s).add(b.id));
          return null;
        },
      };
    }
    const levels = STYLE_BASES.get(key)!;
    const mine = owned.find((o) => baseIdOf(o) === key);
    const worn = !!mine && isWornOut(mine);
    const ownLv = mine ? mine.level ?? LIFESTYLE_ALL_LEVELS.find((l) => l.id === mine.id)?.level ?? 1 : 0;
    const yours = !!mine && !worn;
    const single = levels.length === 1;
    const nextLv = yours ? Math.min(levels.length, ownLv + (ownLv < levels.length ? 1 : 0)) : 1;
    const at = (lv: number) => levels.find((l) => (l.level ?? 1) === lv) ?? levels[0];
    const life = (it: OwnedItem) => { const s = itemLifeSeasons(it); return s === null ? "lasts forever" : `lasts ${s} season${s === 1 ? "" : "s"}`; };
    const gives = (it: OwnedItem) => `${fameText(fameGainFromBuying(owned, it))} fame · ${life(it)}`;
    return {
      key, name: levelName(at(pick[key] ?? nextLv)), levelText: "", line: gives(at(pick[key] ?? nextLv)),
      sheetLine: worn ? `Your ${levelName(mine!)} is worn out` : yours ? `You own ${single ? "it" : `level ${ownLv}`}` : familyName(levels[0]),
      pic: (lv) => <ItemPic kind="style" base={key} level={lv} />,
      rungs: levels.map((it) => ({ level: it.level ?? 1, price: it.price, gives: `${levelName(it)} · ${gives(it)}`, pic: <ItemPic kind="style" base={key} level={it.level ?? 1} /> })),
      ownedLv: yours ? ownLv : 0, nextLv, owned: yours, lockAt: lockAtOf(key), banned: false,
      sold: () => false,
      buyable: (lv) => !(yours && lv <= ownLv),
      priceOf: (lv) => at(lv).price,
      fameGain: (lv) => fameGainFromBuying(owned, at(lv)),
      thumbPrice: at(nextLv).price,
      buy: (lv) => {
        const it = at(lv);
        if (yours && lv <= ownLv) return ownLv === lv ? "You own this one" : `You own level ${ownLv}`;
        if (career.money < it.price) return "Not enough money";
        onBuyItem(it);
        return null;
      },
    };
  };

  // ── Where we are ──
  const landing = (cat: MenuCat): number => {
    const keys = KEYS[cat];
    if (cat === "cans") return 0;
    return nextUpIndex(keys.map((k) => { const v = viewOf(cat, k); return { owned: v.owned, locked: v.lockAt !== null, price: v.priceOf(1) }; }), 0);
  };
  const [cat, setCat] = useState<MenuCat>(startCat);
  const [idx, setIdx] = useState<Record<string, number>>(() => ({ [startCat]: landing(startCat) }));
  const i = Math.max(0, Math.min(KEYS[cat].length - 1, idx[cat] ?? 0));
  const key = KEYS[cat][i];
  const v = viewOf(cat, key);
  const lv = pick[key] ?? v.nextLv;
  const maxed = v.rungs.length > 0 && !v.buyable(lv);

  const goCat = (c: MenuCat) => {
    setCat(c);
    setIdx((m) => (c in m ? m : { ...m, [c]: landing(c) }));
    setNote(null);
  };
  const goItem = (n: number) => {
    const len = KEYS[cat].length;
    setIdx((m) => ({ ...m, [cat]: (n + len) % len }));
    setNote(null);
  };
  const railRef = useRef<HTMLDivElement>(null);
  const scrollThumb = (n: number) => {
    const el = railRef.current?.children[n] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest", inline: "nearest" });
  };

  // ── Swipe the big card: left / right = next / previous item; a tap opens the sheet ──
  const swipe = useRef<{ x: number; y: number; id: number } | null>(null);
  const onHeroDown = (e: React.PointerEvent<HTMLElement>) => {
    swipe.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
    // Keep the finger's lift on the card even if it slid off it.
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* not supported: still works on the card */ }
  };
  const onHeroUp = (e: React.PointerEvent) => {
    const s = swipe.current;
    swipe.current = null;
    if (!s || s.id !== e.pointerId) return;
    const dx = e.clientX - s.x, dy = e.clientY - s.y;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
      const n = (i + (dx < 0 ? 1 : -1) + KEYS[cat].length) % KEYS[cat].length;
      goItem(n);
      scrollThumb(n);
      return;
    }
    if (Math.abs(dx) < 10 && Math.abs(dy) < 10) openSheet();
  };
  const openSheet = () => { if (v.lockAt === null) { setSheet(key); setLawyers(false); setNote(null); } };

  // ── Buying (the sheet's one button) ──
  const price = v.priceOf(lv) + (v.banned && lawyers ? LAWYER_FEE : 0);
  const canAfford = career.money >= price;
  const sold = v.sold(lv);
  const doBuy = () => {
    const err = v.buy(lv, lawyers);
    if (err) { setNote({ text: err, done: false }); return; }
    setNote({ text: cat === "cans" ? "+1 can — it's in your bag" : cat === "boots" ? "Bought — you're wearing them" : "Bought — it's yours", done: true });
    setPick((p) => { const n = { ...p }; delete n[key]; return n; });
  };

  // The TopHud's two bars: Fame shows what this item adds, Money what it costs (RUL-UI-009).
  const hudPick = v.lockAt !== null || maxed ? { price: 0, fameGain: 0 } : { price: v.priceOf(lv), fameGain: v.fameGain(lv) };

  const heroButton = (() => {
    if (v.lockAt !== null) return <span className="ms-price ms-price-off">🔒 ★{v.lockAt}</span>;
    if (maxed) return <span className="ms-price ms-price-own">Owned</span>;
    if (sold) return <span className="ms-price ms-price-off">Sold out</span>;
    return (
      <PressButton variant={v.banned ? "danger" : "gold"} size="none" sfx={false} data-price-button
        className={`ms-price ${v.banned ? "ms-price-black" : ""} ${canAfford ? "" : "ms-price-off"}`}
        onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); openSheet(); }}>
        {money(v.priceOf(lv))}
      </PressButton>
    );
  })();

  return (
    <div className="ms-root" data-menu-shop data-cat={cat}>
      {/* ── The top: Back · SHOP · ? · settings, then Fame + Money ── */}
      <div className="ms-top">
        <div className="ms-title-row">
          <div><BackButton onClick={onBack} /></div>
          <div className="ms-title">SHOP</div>
          <div className="ms-title-right">
            <button type="button" className="ms-sq kib-press" aria-label="Help" data-shop-help onClick={() => (onHelp ? onHelp() : setTip((t) => !t))}>?</button>
            {onSettings && (
              <button type="button" className="ms-sq kib-press" aria-label="Settings" onClick={onSettings}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="12" cy="12" r="3.2" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>
              </button>
            )}
          </div>
        </div>
        <TopHud career={career} screen="shop" pick={hudPick} />
        {tip && <div className="ms-tip">Swipe the picture for the next item. Tap it to see every level and buy.</div>}
      </div>

      {/* ── Category chips ── */}
      <div className="ms-chips" role="tablist">
        {MENU_CATS.map((c) => (
          <button key={c.id} type="button" className="ms-chip kib-press" aria-pressed={c.id === cat} data-chip={c.id}
            // The story and help tours point here (lib/star/tours.ts STORY_SHOP_TOUR: "cat-cans", "shop-tab-boots").
            data-tour={c.id === "cans" ? "cat-cans" : c.id === "boots" ? "shop-tab-boots" : undefined}
            onClick={() => goCat(c.id)}>{c.label}</button>
        ))}
      </div>

      <div className="ms-body">
        {/* ── The big product card ── */}
        <div role="button" tabIndex={0} aria-label={`${v.name}: every level`} className="ms-hero" data-hero={key}
          onPointerDown={onHeroDown} onPointerUp={onHeroUp} onPointerCancel={() => { swipe.current = null; }}
          onKeyDown={(e) => { if (e.key === "Enter") openSheet(); if (e.key === "ArrowRight") goItem(i + 1); if (e.key === "ArrowLeft") goItem(i - 1); }}>
          <div className={`ms-hero-pic ${v.lockAt !== null ? "ms-locked" : ""}`}>{v.pic(lv)}</div>
          {v.lockAt !== null && <span className="ms-lock">🔒</span>}
          <div className="ms-cap">
            <div className="ms-name">{v.name}</div>
            <div className="ms-lv">{v.lockAt !== null ? `Opens at star level ${v.lockAt}` : v.rungs.length > 0 ? `Level ${lv} of ${v.rungs.length}` : v.levelText}</div>
          </div>
          {heroButton}
        </div>

        <div className="ms-dots" aria-hidden>
          {KEYS[cat].map((k, n) => <i key={k} data-on={n === i ? "" : undefined} />)}
        </div>

        {/* ── Thumbnails ── */}
        <div className="ms-rail" ref={railRef}>
          {KEYS[cat].map((k, n) => {
            const t = viewOf(cat, k);
            return (
              <button key={k} type="button" className="ms-th kib-press" aria-current={n === i} aria-label={t.name} data-thumb={k} onClick={() => goItem(n)}>
                {t.pic(t.nextLv)}
                <b>{t.lockAt !== null ? `🔒 ★${t.lockAt}` : t.owned ? "OWNED" : money(t.thumbPrice)}</b>
              </button>
            );
          })}
        </div>

        <div className="ms-gives" data-gives>{v.lockAt !== null ? `Opens at star level ${v.lockAt} · ${v.line}` : v.line}</div>
      </div>

      {mainBar && <div className="ms-bar">{mainBar}</div>}

      {sheet === key && <ItemSheet v={v} cat={cat} lv={lv} price={price} canAfford={canAfford} sold={sold} career={career}
        lawyers={lawyers} onLawyers={setLawyers} note={note}
        onPick={(n) => { setPick((p) => ({ ...p, [key]: n })); setNote(null); }}
        onBuy={doBuy} onUseCan={onUseCan} onClose={() => { setSheet(null); setNote(null); }} />}
    </div>
  );
}

/** The item sheet: every level, what it gives, one Buy button, the money left after. */
function ItemSheet({ v, cat, lv, price, canAfford, sold, career, lawyers, onLawyers, note, onPick, onBuy, onUseCan, onClose }: {
  v: ItemView; cat: MenuCat; lv: number; price: number; canAfford: boolean; sold: boolean; career: CareerState;
  lawyers: boolean; onLawyers: (b: boolean) => void; note: { text: string; done: boolean } | null;
  onPick: (lv: number) => void; onBuy: () => void; onUseCan?: (id: KibCan["id"]) => void; onClose: () => void;
}) {
  // Swipe down on the top of the sheet to shut it.
  const drag = useRef<{ y: number; id: number } | null>(null);
  const can = cat === "cans" ? KIB_CANS.find((c) => c.id === v.key) : undefined;
  const maxed = v.rungs.length > 0 && !v.buyable(lv);
  const label = (() => {
    if (maxed) return v.ownedLv === lv ? "You own this one" : `You own level ${v.ownedLv}`;
    if (sold) return "Sold out — back next visit";
    if (cat === "cans") return `Buy 1 · ${moneyFull(price)}`;
    const word = v.banned ? "Black market" : v.ownedLv > 0 && lv > v.ownedLv ? "Upgrade" : "Buy";
    return v.rungs.length > 1 ? `${word} level ${lv} · ${moneyFull(price)}` : `${word} · ${moneyFull(price)}`;
  })();
  const waiting = !!can?.effect && !!career.kibAbility?.[can.effect];
  const have = can ? career.kibCans[can.id] ?? 0 : 0;
  const useBlocked = !can || have === 0 || waiting || (!can.effect && (career.energy ?? 0) >= 100);
  return (
    <>
      <div className="ms-dim" onClick={onClose} />
      <div className="ms-sheet" role="dialog" aria-label={`${v.name}: every level`} data-item-sheet>
        <div className="ms-grab-zone"
          onPointerDown={(e) => {
            if ((e.target as HTMLElement).closest("button")) return; // Close is a plain tap
            drag.current = { y: e.clientY, id: e.pointerId };
            try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* not supported */ }
          }}
          onPointerUp={(e) => { const d = drag.current; drag.current = null; if (d && d.id === e.pointerId && e.clientY - d.y > 50) onClose(); }}
          onPointerCancel={() => { drag.current = null; }}>
          <div className="ms-grab-row"><span /><div className="ms-grab" /><button type="button" className="ms-close" onClick={onClose}>Close</button></div>
          <div className="ms-shead">
            <div className="ms-shead-pic">{v.pic(lv)}</div>
            <div className="min-w-0">
              <div className="ms-sname">{v.name}</div>
              <div className="ms-sline">{v.sheetLine}</div>
            </div>
          </div>
        </div>

        <div className="ms-sbody">
          {v.rungs.length > 1 && (
            <div className="ms-lad" data-ladder>
              {v.rungs.map((r) => {
                const isOwned = r.level <= v.ownedLv && r.level !== lv;
                const state = r.level === lv ? "pick" : isOwned ? "owned" : "locked";
                return (
                  <button key={r.level} type="button" className="ms-lr" data-state={state} data-level={r.level}
                    onClick={() => { if (!isOwned) onPick(r.level); }}>
                    {r.pic}
                    <span className="ms-lr-t"><b>Level {r.level}</b><span>{r.gives}</span></span>
                    <em>{isOwned ? "Owned" : r.level === lv ? (maxed ? "Owned" : r.level === v.nextLv ? "Next" : money(r.price)) : money(r.price)}</em>
                  </button>
                );
              })}
            </div>
          )}
          {v.rungs.length <= 1 && <div className="ms-note">{cat === "cans" ? `${v.line} · you have ×${have}` : v.line}</div>}
          {v.banned && (
            <>
              <div className="ms-note ms-note-red">Banned by the FA. Only on the black market, at its price, and you can get caught.</div>
              <label className="ms-check"><input type="checkbox" checked={lawyers} onChange={(e) => onLawyers(e.target.checked)} />Use lawyers (+{money(LAWYER_FEE)}) — less chance of getting caught</label>
            </>
          )}
        </div>

        <div className="ms-buy">
          <PressButton variant={v.banned ? "danger" : "gold"} size="none" data-buy-button
            className={`ms-bigbuy ${!canAfford || maxed || sold ? "ms-price-off" : ""}`}
            disabled={maxed || sold || !canAfford} onClick={onBuy}>
            {!maxed && !sold && !canAfford ? `Not enough money · ${moneyFull(price)}` : label}
          </PressButton>
          {can && onUseCan && (
            <button type="button" className="ms-use kib-press" disabled={useBlocked} onClick={() => onUseCan(can.id)}>{waiting ? "Ready for your next match" : `Use one (×${have})`}</button>
          )}
          <div className="ms-after" data-done={note?.done ? "" : undefined} data-after>
            {note ? note.text : maxed || sold ? `You have ${moneyFull(career.money)}` : canAfford ? `You'll have ${moneyFull(career.money - price)} left` : `You have ${moneyFull(career.money)}`}
          </div>
        </div>
      </div>
    </>
  );
}
