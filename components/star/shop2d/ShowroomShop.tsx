"use client";

/**
 * THE SHOWROOM + FEED SHOP (Settings → Look → "Shop: New"; Old is
 * components/star/Shop.tsx, untouched).
 *
 * Harry, 9 Oct 2026, on four layout concepts: "showroom swipe + feed is
 * definitely something". So the items ARE the screen:
 *   - swipe UP / DOWN   = the next / previous category (the Feed):
 *                         Cans → Boots → Drip → Gadgets → Cars → Homes → Holiday;
 *   - swipe LEFT / RIGHT = the items in that category (the Showroom), with dots;
 *   - a thin category rail at the top (tap to jump), a back chip, and a balance
 *     chip with your fame (tap it: the fame banner drops down);
 *   - the Buy / Upgrade button pinned at the bottom with the price; tap the
 *     item for its sheet (level ladder, what you gain, View in 3D).
 * PC: mouse drag, the trackpad, the wheel and the arrow keys all move it.
 *
 * Nothing about buying changed: the same handlers as the old shop (page.tsx's
 * handleBuyKib/Boot/Item/FromBlackMarket), the same prices, the boot sponsor's
 * 25%, the FA's banned boots on the black market (lawyers in the confirm
 * sheet), the Style unlock chain, worn-out repairs, "Sold out" for boots bought
 * this visit, open-on-item from the 3D shop, and Use for cans.
 *
 * Pictures: public/star/shop2d/items/*.webp, 1440×1080 renders of the same
 * Blender models as public/shop (tools/shop2d/render_big.py); the small
 * pictures/drawings are the fallback if one is missing.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import type { CareerState, Boot, OwnedItem } from "@/lib/star/types";
import { KIB_CANS, kibCanPrice, kibCanEffectLabel, BOOTS_ALL_LEVELS as BOOTS_FULL_PRICE, LIFESTYLE_ALL_LEVELS, baseIdOf, type KibCan } from "@/lib/star/shopData";
import { hasBootDeal, bootPrice } from "@/lib/star/sponsorDeals";
import { divisionOf } from "@/lib/star/calendar";
import { SHOP_TIERS, weeksOfWallet } from "@/lib/star/economy";
import { ruleBookFor } from "@/lib/star/ruleBook";
import { formatMoney } from "@/lib/star/money";
import { blackMarketPrice, LAWYER_FEE } from "@/lib/star/corruption";
import { fameGainFromBuying, fameLevel, fameOf, isWornOut, itemLifeSeasons, nextFameLevel, ownedFame, OWNED_FAME_MAX } from "@/lib/star/fame";
import { styleGroupOf, levelName, familyName, fameFromOwned, fameText, type StyleGroup } from "@/lib/star/lifestyleLevels";
import { styleUnlockStar } from "@/lib/star/unlocks";
import { starsNow } from "@/lib/star/starPoints";
import { shopDisplays } from "@/lib/star/shop3d/catalogue";
import KibCanIcon from "../KibCanIcon";
import BootPicture from "../BootPicture";
import StylePicture from "../StylePicture";
import { weeksText } from "../ShopSheet";
import { PhoneOpens, SaveUp } from "../StyleShop";
import { art, tierColour, rungName, LevelLadder, GiveChips, StoreSheet, GoldButton, ConfirmSheet, PurchaseMoment, type ConfirmInfo, type StoreTab } from "./parts";

interface ActionResult { ok: boolean; reason?: string }

export type CatId = "cans" | "boots" | StyleGroup;
export const SHOWROOM_CATS: { id: CatId; label: string; icon: string; accent: string }[] = [
  { id: "cans", label: "Cans", icon: "icon-cans", accent: "#fb923c" },
  { id: "boots", label: "Boots", icon: "icon-boots", accent: "#34d399" },
  { id: "drip", label: "Drip", icon: "icon-drip", accent: "#fbbf24" },
  { id: "gadgets", label: "Gadgets", icon: "icon-gadgets", accent: "#38bdf8" },
  { id: "cars", label: "Cars", icon: "icon-cars", accent: "#f87171" },
  { id: "homes", label: "Homes", icon: "icon-homes", accent: "#a3e635" },
  { id: "holiday", label: "Holiday", icon: "icon-holiday", accent: "#22d3ee" },
];
const kindOf = (c: CatId): StoreTab => (c === "cans" ? "kib" : c === "boots" ? "boots" : "lifestyle");

const BOOT_ORDER = ["starter", "speed", "power", "control", "elite", "curl", "maestro"];
const CAN_TIER: Record<KibCan["id"], number> = { basic: 1, premium: 3, elite: 5 };
const CAN_FX: Record<KibCan["id"], string> = { basic: "fx-energy", premium: "fx-curve", elite: "fx-touch" };

/** Which bases the 3D shop has. */
const IN_3D: Set<string> = (() => {
  const s = new Set<string>();
  const d = shopDisplays({}, { h: true });
  for (const k of Object.keys(d) as (keyof typeof d)[]) for (const it of d[k].items) s.add(it.id);
  return s;
})();

/** The style families in shop order, each with its five levels. */
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

/** The keys (can id / boot base / style base) in each category, in order. */
export const SHOWROOM_KEYS: Record<CatId, string[]> = (() => {
  const out = { cans: KIB_CANS.map((c) => c.id), boots: BOOT_ORDER.filter((b) => BOOTS_FULL_PRICE.some((x) => baseIdOf(x) === b)) } as Record<CatId, string[]>;
  for (const g of ["drip", "gadgets", "cars", "homes", "holiday"] as StyleGroup[]) {
    out[g] = Array.from(STYLE_BASES.keys()).filter((b) => styleGroupOf(STYLE_BASES.get(b)![0]) === g);
  }
  return out;
})();

function ownedLevelOf(mine: OwnedItem | undefined): number {
  if (!mine) return 0;
  return mine.level ?? LIFESTYLE_ALL_LEVELS.find((l) => l.id === mine.id)?.level ?? 1;
}

const bigName = (kind: "boot" | "style", base: string, lv: number) =>
  kind === "boot" ? `boot-${base}-L${lv}` : base === "phone" ? "phone-L1" : `${base}-L${lv}`;

/** The big still; the small picture/drawing if it is missing. */
function BigPic({ kind, base, level, className = "", grey = false }: { kind: "boot" | "style"; base: string; level: number; className?: string; grey?: boolean }) {
  const name = bigName(kind, base, level);
  const [bad, setBad] = useState<string | null>(null);
  if (bad === name) {
    return kind === "boot"
      ? <BootPicture base={base} level={level} className={`${className} ${grey ? "opacity-30 grayscale" : ""}`} />
      : <StylePicture base={base} level={level} className={`${className} ${grey ? "opacity-30 grayscale" : ""}`} />;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={`/star/shop2d/items/${name}.webp`} alt="" draggable={false} decoding="async" onError={() => setBad(name)}
      data-big-pic={name} className={`select-none object-contain ${grey ? "opacity-30 grayscale" : ""} ${className}`} />
  );
}

function Pips({ level, of, onPick, accent }: { level: number; of: number; onPick?: (lv: number) => void; accent?: string }) {
  if (of <= 1) return null;
  return (
    <div className="flex items-center" data-pips>
      {Array.from({ length: of }, (_, i) => {
        const on = i < level;
        return (
          <button key={i} type="button" aria-label={`Level ${i + 1}`} onClick={onPick ? (e) => { e.stopPropagation(); onPick(i + 1); } : undefined}
            className="flex h-[26px] items-center px-[3px]">
            <span className="block h-[7px] w-[18px] rounded-full transition-all"
              style={{ background: on ? tierColour(i + 1) : "rgba(255,255,255,.2)", boxShadow: i + 1 === level ? `0 0 8px ${accent ?? tierColour(level)}` : undefined, transform: i + 1 === level ? "scaleY(1.35)" : undefined }} />
          </button>
        );
      })}
    </div>
  );
}

function Badge({ kind, children }: { kind: "green" | "red" | "blue" | "gold"; children: React.ReactNode }) {
  const c = { green: ["#065f46", "#6ee7b7"], red: ["#7f1d1d", "#fca5a5"], blue: ["#1e3a8a", "#93c5fd"], gold: ["#78350f", "#fcd34d"] }[kind];
  return <span className="rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-wide" style={{ background: `${c[0]}dd`, color: c[1], boxShadow: `inset 0 0 0 1px ${c[1]}66` }}>{children}</span>;
}

interface Props {
  career: CareerState;
  kind: StoreTab;
  onBack: () => void;
  onBuyKib: (can: KibCan) => void;
  onBuyBoot: (boot: Boot) => void;
  onBuyItem: (item: OwnedItem) => void;
  onBuyFromBlackMarket: (boot: Boot, useLawyers: boolean) => ActionResult;
  focus?: { id: string; level: number } | null;
  /** Category moved to another kind (page.tsx moves the phase, so the help pointers follow). */
  onKind?: (k: StoreTab) => void;
  onUseCan?: (id: KibCan["id"]) => void;
  onOpen3D?: () => void;
  /** Test pages: start on this category. */
  startCat?: CatId;
}

type Moment = { art: React.ReactNode; level: number; title: string; word: string; fx?: string };
type Sheet = { cat: CatId; key: string; level: number };

/** One item as the screen shows it. */
interface View {
  key: string; cat: CatId; title: string; sub: string; level: number; levels: number;
  pic: React.ReactNode; badges: React.ReactNode[]; stats: { text: string; color: string }[];
  locked: number | null; tour?: string; flash?: boolean;
  button: { label: string; price?: number; disabled: boolean; danger?: boolean; blue?: boolean; run: () => void };
  extra?: { label: string; disabled: boolean; run: () => void };
}

export default function ShowroomShop({ career, kind, onBack, onBuyKib, onBuyBoot, onBuyItem, onBuyFromBlackMarket, focus, onKind, onUseCan, onOpen3D, startCat }: Props) {
  const homeLevel = Math.max(1, SHOP_TIERS.findIndex((t) => t.anchor === divisionOf(career)) + 1);
  const [spent, setSpent] = useState({ n: 0, text: "" });
  const spend = (price: number) => setSpent((s) => ({ n: s.n + 1, text: `−★${formatMoney(price)}` }));
  const [confirm, setConfirm] = useState<null | { info: ConfirmInfo; run: (lawyers: boolean) => string | void }>(null);
  const [moment, setMoment] = useState<Moment | null>(null);
  const [soldOut, setSoldOut] = useState<Set<string>>(() => new Set());
  const [pick, setPick] = useState<Record<string, number>>({});
  const [fameOpen, setFameOpen] = useState(false);

  // ── Where we start ──────────────────────────────────────────────────────
  const lockOf = useMemo(() => (career.unlocks ? (base: string) => {
    const need = styleUnlockStar(base);
    const stars = starsNow(career);
    return stars >= need ? null : Math.min(1, stars / need);
  } : undefined), [career]);
  const start = useMemo(() => {
    const at = (cat: CatId, key: string) => ({ ci: SHOWROOM_CATS.findIndex((c) => c.id === cat), ii: Math.max(0, SHOWROOM_KEYS[cat].indexOf(key)) });
    if (focus) {
      if (SHOWROOM_KEYS.cans.includes(focus.id)) return { ...at("cans", focus.id), sheet: null };
      if (SHOWROOM_KEYS.boots.includes(focus.id)) return { ...at("boots", focus.id), sheet: { cat: "boots" as CatId, key: focus.id, level: focus.level } };
      const it = LIFESTYLE_ALL_LEVELS.find((i) => baseIdOf(i) === focus.id);
      if (it) {
        const g = styleGroupOf(it);
        return { ...at(g, focus.id), sheet: lockOf?.(focus.id) == null ? { cat: g as CatId, key: focus.id, level: focus.level } : null };
      }
    }
    if (startCat) return { ...at(startCat, SHOWROOM_KEYS[startCat][0]), sheet: null };
    if (kind === "kib") return { ...at("cans", "basic"), sheet: null };
    if (kind === "boots") return { ...at("boots", baseIdOf(career.currentBoot)), sheet: null };
    if (lockOf && !career.ownedItems.some((o) => baseIdOf(o) === "phone")) return { ...at("gadgets", "phone"), sheet: null };
    return { ...at("drip", SHOWROOM_KEYS.drip[0]), sheet: null };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [ci, setCi] = useState(start.ci);
  const [idx, setIdx] = useState<number[]>(() => SHOWROOM_CATS.map((_, i) => (i === start.ci ? start.ii : 0)));
  const [sheet, setSheet] = useState<Sheet | null>(start.sheet);

  // ── The buy flows (unchanged from the store) ───────────────────────────
  const bootDeal = hasBootDeal(career);
  const boots = useMemo(() => (bootDeal ? BOOTS_FULL_PRICE.map((b) => ({ ...b, price: bootPrice(career, b.price) })) : BOOTS_FULL_PRICE), [bootDeal, career]);
  const banned = new Set(ruleBookFor(career, "FA").bannedItems);
  const bootLevels = (base: string) => boots.filter((b) => baseIdOf(b) === base).sort((a, b) => (a.level ?? 0) - (b.level ?? 0));
  const cur = career.currentBoot;
  const wearing = baseIdOf(cur);
  const owned = career.ownedItems;
  const mineOf = (base: string) => owned.find((o) => baseIdOf(o) === base);

  const askCan = (c: KibCan) => {
    const price = kibCanPrice(c, career.contract.wage);
    setConfirm({
      info: { title: c.name, sub: kibCanEffectLabel(c), level: CAN_TIER[c.id], price, verb: "Buy", art: <KibCanIcon can={c} className="h-[84px] w-[56px]" /> },
      run: () => {
        onBuyKib(c); spend(price); setConfirm(null);
        setMoment({ art: <div className="flex justify-center"><KibCanIcon can={c} className="h-[150px] w-[100px]" /></div>, level: CAN_TIER[c.id], title: `${c.name} — ${kibCanEffectLabel(c)}`, word: "+1 Can!", fx: CAN_FX[c.id] });
      },
    });
  };
  const askBoot = (b: Boot, black: boolean) => {
    const lv = b.level ?? 1;
    const base = baseIdOf(b);
    const done = (price: number) => {
      spend(price); setConfirm(null);
      setSoldOut((s) => new Set(s).add(b.id));
      setMoment({ art: <BigPic kind="boot" base={base} level={lv} className="w-full" />, level: lv, title: `${b.name} L${lv} — ${b.matches} matches`, word: "Equipped!", fx: b.extraTouch ? "fx-touch" : b.curve ? "fx-curve" : "fx-power" });
    };
    setConfirm({
      info: {
        title: `${b.name} L${lv}`, sub: `+${b.power} power · +${b.technique} technique · ${b.matches} matches`, level: lv, price: b.price, verb: "Buy",
        art: <BigPic kind="boot" base={base} level={lv} className="w-full" />, note: "You put them on straight away.",
        blackMarket: black ? { lawyerFee: LAWYER_FEE, lawyerPrice: (l) => blackMarketPrice(b.price) + (l ? LAWYER_FEE : 0) } : undefined,
      },
      run: (lawyers) => {
        if (black) {
          const r = onBuyFromBlackMarket(b, lawyers);
          if (!r.ok) return r.reason ?? "Failed";
          done(blackMarketPrice(b.price) + (lawyers ? LAWYER_FEE : 0));
          return;
        }
        if (career.money < b.price) return "Not enough money";
        onBuyBoot(b);
        done(b.price);
      },
    });
  };
  const askItem = (it: OwnedItem, mine: OwnedItem | undefined) => {
    const base = baseIdOf(it);
    const lv = it.level ?? 1;
    const worn = !!mine && isWornOut(mine);
    const verb = mine && !worn ? "Upgrade" : mine && worn && (STYLE_BASES.get(base)?.length === 1) ? "Repair" : "Buy";
    setConfirm({
      info: {
        title: levelName(it), sub: `${familyName(it)} · ${fameText(fameGainFromBuying(owned, it))} fame`, level: lv, price: it.price, verb,
        art: <BigPic kind="style" base={base} level={lv} className="w-full" />,
        note: mine && !worn ? `Replaces your ${levelName(mine)}.` : undefined,
      },
      run: () => {
        if (career.money < it.price) return "Not enough money";
        onBuyItem(it); spend(it.price); setConfirm(null);
        setMoment({ art: <BigPic kind="style" base={base} level={lv} className="w-full" />, level: lv, title: levelName(it), word: verb === "Upgrade" ? "Upgraded!" : verb === "Repair" ? "Repaired!" : "Yours!" });
      },
    });
  };

  // ── Each item as the screen shows it ───────────────────────────────────
  const viewOf = (cat: CatId, key: string): View => {
    if (cat === "cans") {
      const c = KIB_CANS.find((x) => x.id === key)!;
      const price = kibCanPrice(c, career.contract.wage);
      const can = career.money >= price;
      const have = career.kibCans[c.id] ?? 0;
      const waiting = !!c.effect && !!career.kibAbility?.[c.effect];
      const useBlocked = have === 0 || waiting || (!c.effect && (career.energy ?? 0) >= 100);
      const stats: View["stats"] = [];
      if (c.restore > 0) stats.push({ text: `+${c.restore}⚡ energy`, color: "#fdba74" });
      if (c.effect === "curve") stats.push({ text: "Curve next match", color: "#7dd3fc" });
      if (c.effect === "extraTouch") stats.push({ text: "Touch Mode next match", color: "#f0abfc" });
      stats.push({ text: `Energy ${Math.round(career.energy ?? 0)}/100`, color: "rgba(255,255,255,.8)" });
      return {
        key, cat, title: c.name.replace(" KIB Can", ""), sub: "KIB Can", level: CAN_TIER[c.id], levels: 0,
        pic: <KibCanIcon can={c} className="h-full max-h-[440px] w-auto" />,
        badges: [<Badge key="n" kind="blue">×{have} owned</Badge>, ...(waiting ? [<Badge key="w" kind="gold">Ready next match</Badge>] : [])],
        stats, locked: null,
        button: { label: can ? "Buy" : "Not enough", price, disabled: !can, run: () => askCan(c) },
        extra: onUseCan ? { label: waiting ? "Ready" : "Use one", disabled: useBlocked, run: () => onUseCan(c.id) } : undefined,
      };
    }
    if (cat === "boots") {
      const levels = bootLevels(key);
      const mineLv = wearing === key ? cur.level ?? 1 : 0;
      const def = wearing === key ? (cur.matches > 0 ? Math.min(levels.length, mineLv + 1) : mineLv) : Math.min(levels.length, homeLevel);
      const lv = pick[key] ?? def;
      const b = levels.find((x) => x.level === lv) ?? levels[0];
      const isBanned = banned.has(key);
      const sold = soldOut.has(b.id);
      const can = career.money >= b.price;
      const badges: React.ReactNode[] = [];
      if (wearing === key) badges.push(<Badge key="e" kind="green">{cur.matches > 0 ? `Equipped L${mineLv} · ${cur.matches} left` : `Worn out L${mineLv}`}</Badge>);
      if (isBanned) badges.push(<Badge key="b" kind="red">Banned</Badge>);
      if (sold) badges.push(<Badge key="s" kind="red">Sold out</Badge>);
      if (bootDeal) badges.push(<Badge key="d" kind="gold">Sponsor −25%</Badge>);
      const stats: View["stats"] = [
        { text: `+${b.power} Power`, color: "#6ee7b7" }, { text: `+${b.technique} Tech`, color: "#6ee7b7" }, { text: `${b.matches} matches`, color: "#fde68a" },
      ];
      if (b.curve) stats.push({ text: "CURVE", color: "#7dd3fc" });
      if (b.extraTouch) stats.push({ text: "TOUCH", color: "#f0abfc" });
      const upgrade = wearing === key && lv > mineLv;
      return {
        key, cat, title: b.name, sub: `Level ${lv} · ${rungName(lv)}`, level: lv, levels: levels.length,
        pic: <BigPic kind="boot" base={key} level={lv} className={`h-full w-full scale-[1.12] ${sold ? "opacity-50 grayscale" : ""}`} />,
        badges, stats, locked: null,
        button: sold ? { label: "Sold out — back next visit", disabled: true, run: () => {} }
          : isBanned ? { label: "Black market", price: blackMarketPrice(b.price), disabled: false, danger: true, run: () => askBoot(b, true) }
          : { label: can ? (upgrade ? "Upgrade" : "Buy") : "Not enough", price: b.price, disabled: !can, run: () => askBoot(b, false) },
      };
    }
    const levels = STYLE_BASES.get(key)!;
    const mine = mineOf(key);
    const worn = !!mine && isWornOut(mine);
    const ownLv = ownedLevelOf(mine);
    const yours = !!mine && !worn;
    const affordable = levels.filter((l) => (l.level ?? 1) <= homeLevel && l.price <= career.money);
    const def = yours ? Math.min(levels.length, ownLv + (ownLv < levels.length ? 1 : 0)) : (affordable[affordable.length - 1]?.level ?? 1);
    const lv = levels.length === 1 ? 1 : (pick[key] ?? def);
    const it = levels.find((l) => l.level === lv) ?? levels[0];
    const lock = lockOf?.(key) ?? null;
    const blocked = yours && lv <= ownLv;
    const can = !blocked && career.money >= it.price;
    const single = levels.length === 1;
    const verb = yours ? "Upgrade" : worn && single ? "Repair" : worn ? "Replace" : "Buy";
    const gain = fameGainFromBuying(owned, it);
    const life = itemLifeSeasons(it);
    const badges: React.ReactNode[] = [];
    if (yours) badges.push(<Badge key="o" kind="green">Owned{single ? "" : ` L${ownLv}`}</Badge>);
    if (worn) badges.push(<Badge key="w" kind="red">Worn out</Badge>);
    if (yours) badges.push(<Badge key="f" kind="gold">{fameText(fameFromOwned(owned, mine!))} fame now</Badge>);
    return {
      key, cat, title: levelName(it), sub: single ? familyName(it) : `${familyName(it)} · L${lv} ${rungName(lv)}`, level: lv, levels: levels.length,
      pic: <BigPic kind="style" base={key} level={lv} grey={lock !== null} className="h-full w-full scale-[1.12]" />,
      badges, locked: lock, tour: key === "phone" ? "phone-tile" : undefined, flash: key === "phone" && !!lockOf && !yours,
      stats: [
        { text: `${fameText(gain)} fame`, color: "#fcd34d" },
        { text: life === null ? "Lasts forever" : `Lasts ${life} season${life === 1 ? "" : "s"}`, color: "rgba(255,255,255,.85)" },
      ],
      button: blocked ? { label: ownLv === lv ? "You own this one" : `You own level ${ownLv}`, disabled: true, run: () => {} }
        : { label: can ? verb : "Not enough", price: it.price, disabled: !can, blue: yours && can, run: () => askItem(it, mine) },
    };
  };

  // ── Scrolling: native snap for touch + trackpad, drag for the mouse ────
  const outer = useRef<HTMLDivElement>(null);
  const rows = useRef<(HTMLDivElement | null)[]>([]);
  const pageW = () => outer.current?.clientWidth ?? 390;
  const pageH = () => outer.current?.clientHeight ?? 844;
  useLayoutEffect(() => {
    const o = outer.current;
    if (!o) return;
    o.scrollTop = start.ci * o.clientHeight;
    const r = rows.current[start.ci];
    if (r) r.scrollLeft = start.ii * r.clientWidth;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const goCat = useCallback((c: number, smooth = true) => {
    const o = outer.current;
    if (!o) return;
    const n = Math.max(0, Math.min(SHOWROOM_CATS.length - 1, c));
    o.scrollTo({ top: n * o.clientHeight, behavior: smooth ? "smooth" : "auto" });
  }, []);
  const goItem = useCallback((c: number, i: number) => {
    const r = rows.current[c];
    if (!r) return;
    const n = Math.max(0, Math.min(SHOWROOM_KEYS[SHOWROOM_CATS[c].id].length - 1, i));
    r.scrollTo({ left: n * r.clientWidth, behavior: "smooth" });
  }, []);
  const onOuterScroll = () => {
    const o = outer.current;
    if (!o) return;
    const c = Math.round(o.scrollTop / Math.max(1, o.clientHeight));
    if (c !== ci) { setCi(c); setFameOpen(false); }
  };
  const onRowScroll = (c: number) => {
    const r = rows.current[c];
    if (!r) return;
    const i = Math.round(r.scrollLeft / Math.max(1, r.clientWidth));
    setIdx((a) => (a[c] === i ? a : a.map((v, k) => (k === c ? i : v))));
  };
  // keep the help pointers in step with the kind of thing on screen
  useEffect(() => {
    if (!onKind) return;
    const k = kindOf(SHOWROOM_CATS[ci].id);
    if (k === kind) return;
    const t = setTimeout(() => onKind(k), 300);
    return () => clearTimeout(t);
  }, [ci, kind, onKind]);
  // arrow keys (PC)
  const busy = !!(sheet || confirm || moment);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (busy) return;
      if (e.key === "ArrowDown" || e.key === "PageDown") { e.preventDefault(); goCat(ci + 1); }
      else if (e.key === "ArrowUp" || e.key === "PageUp") { e.preventDefault(); goCat(ci - 1); }
      else if (e.key === "ArrowRight") { e.preventDefault(); goItem(ci, idx[ci] + 1); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); goItem(ci, idx[ci] - 1); }
      else if (e.key === "Escape") onBack();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, ci, idx, goCat, goItem, onBack]);
  // mouse drag: decide the axis after 6 px, follow the pointer, then snap one page
  const drag = useRef<null | { x: number; y: number; axis: "x" | "y" | null; c: number; sx: number; sy: number; moved: boolean }>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    const r = rows.current[ci];
    drag.current = { x: e.clientX, y: e.clientY, axis: null, c: ci, sx: r?.scrollLeft ?? 0, sy: outer.current?.scrollTop ?? 0, moved: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    if (!d.axis) {
      if (Math.hypot(dx, dy) < 6) return;
      d.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      d.moved = true;
      const el = d.axis === "x" ? rows.current[d.c] : outer.current;
      if (el) { el.style.scrollSnapType = "none"; el.style.scrollBehavior = "auto"; }
    }
    if (d.axis === "x") { const r = rows.current[d.c]; if (r) r.scrollLeft = d.sx - dx; }
    else if (outer.current) outer.current.scrollTop = d.sy - dy;
  };
  const endDrag = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (!d || !d.axis) return;
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    const el = d.axis === "x" ? rows.current[d.c] : outer.current;
    if (el) { el.style.scrollSnapType = ""; el.style.scrollBehavior = ""; }
    if (d.axis === "x") {
      const from = Math.round(d.sx / pageW());
      goItem(d.c, from + (Math.abs(dx) > pageW() * 0.12 ? (dx < 0 ? 1 : -1) : 0));
    } else {
      const from = Math.round(d.sy / pageH());
      goCat(from + (Math.abs(dy) > pageH() * 0.1 ? (dy < 0 ? 1 : -1) : 0));
    }
    if (d.moved) {
      const stop = (ev: MouseEvent) => { ev.stopPropagation(); ev.preventDefault(); };
      window.addEventListener("click", stop, { capture: true, once: true });
      setTimeout(() => window.removeEventListener("click", stop, { capture: true }), 50);
    }
  };

  const cat = SHOWROOM_CATS[ci];
  const fame = fameOf(career);
  const fl = fameLevel(fame);
  const nfl = nextFameLevel(fame);
  const stuffFame = ownedFame(owned);
  const nItems = SHOWROOM_KEYS[cat.id].length;

  return (
    <div data-showroom-shop data-sk-tone="calm" className="fixed inset-0 z-[60] overflow-hidden bg-[#05080f] text-white" style={{ touchAction: "pan-x pan-y" }}>
      <div data-star-game hidden />
      <style>{`
        [data-showroom-shop] .sr-noscroll{scrollbar-width:none}
        [data-showroom-shop] .sr-noscroll::-webkit-scrollbar{display:none}
        @keyframes srSpent{0%{transform:translateY(0);opacity:0}15%{opacity:1}100%{transform:translateY(26px);opacity:0}}
        @keyframes srFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
        @keyframes srDrop{from{transform:translateY(-12px);opacity:0}to{transform:none;opacity:1}}
        @media (prefers-reduced-motion: reduce){[data-showroom-shop] *{animation:none!important;scroll-behavior:auto!important}}
      `}</style>
      {/* the store at night (Higgsfield shop art), darkened: the item is the light */}
      <div aria-hidden className="pointer-events-none absolute inset-[-24px]" style={{ background: `url(${art("wall")}) center 40% / cover`, filter: "blur(10px) brightness(.42) saturate(.8)" }} />
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(90% 60% at 50% 42%, rgba(5,8,15,.25), rgba(5,8,15,.8) 75%), linear-gradient(180deg, rgba(5,8,15,.55), rgba(5,8,15,.35) 40%, rgba(5,8,15,.95) 85%)" }} />

      <div ref={outer} onScroll={onOuterScroll} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={endDrag} onPointerCancel={endDrag}
        className="sr-noscroll relative h-full w-full overflow-y-auto overflow-x-hidden" style={{ scrollSnapType: "y mandatory", overscrollBehavior: "contain" }} data-feed>
        {SHOWROOM_CATS.map((c, cIdx) => {
          const keys = SHOWROOM_KEYS[c.id];
          const near = Math.abs(cIdx - ci) <= 1;
          return (
            <section key={c.id} data-feed-cat={c.id} className="relative h-full w-full" style={{ scrollSnapAlign: "start", scrollSnapStop: "always" }}>
              <div ref={(el) => { rows.current[cIdx] = el; }} onScroll={() => onRowScroll(cIdx)} data-showroom-row={c.id}
                className="sr-noscroll flex h-full w-full overflow-x-auto overflow-y-hidden" style={{ scrollSnapType: "x mandatory", overscrollBehaviorX: "contain" }}>
                {keys.map((k, i) => {
                  const show = near && Math.abs(i - idx[cIdx]) <= 1;
                  return (
                    <div key={k} data-show-item={k} className="relative h-full w-full shrink-0" style={{ scrollSnapAlign: "center", scrollSnapStop: "always" }}>
                      {show ? <ItemPage v={viewOf(c.id, k)} accent={c.accent} catLabel={c.label} pos={`${i + 1}/${keys.length}`}
                        next={SHOWROOM_CATS[cIdx + 1]?.label} onOpen={() => setSheet({ cat: c.id, key: k, level: viewOf(c.id, k).level })}
                        onPickLevel={(lv) => setPick((p) => ({ ...p, [k]: lv }))} /> : null}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      {/* PC arrows (pointer devices only) */}
      <div className="pointer-events-none absolute inset-0 hidden [@media(hover:hover)_and_(pointer:fine)]:block">
        {idx[ci] > 0 && <button onClick={() => goItem(ci, idx[ci] - 1)} aria-label="Previous item" className="pointer-events-auto absolute left-3 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-black/50 text-[24px] font-black ring-1 ring-white/20 hover:bg-black/70">‹</button>}
        {idx[ci] < nItems - 1 && <button onClick={() => goItem(ci, idx[ci] + 1)} aria-label="Next item" className="pointer-events-auto absolute right-3 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-black/50 text-[24px] font-black ring-1 ring-white/20 hover:bg-black/70">›</button>}
      </div>

      {/* Top: back · the category rail · balance + fame. Floats over the item. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 bg-gradient-to-b from-black/70 via-black/30 to-transparent pb-3" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className="pointer-events-auto flex h-[46px] items-center gap-1.5 px-2.5">
          <button onClick={onBack} aria-label="Back" data-shop-back className="kib-press grid h-9 w-9 shrink-0 place-items-center rounded-full bg-black/55 text-[20px] font-black ring-1 ring-white/20 backdrop-blur">‹</button>
          <Rail ci={ci} onJump={(i) => goCat(i)} />
          <button onClick={() => setFameOpen((v) => !v)} data-balance-chip aria-label="Balance and fame"
            className="kib-press relative flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-black/60 pl-2.5 pr-2 ring-1 ring-amber-300/45 backdrop-blur">
            <span className="text-[13.5px] font-black tabular-nums text-amber-300">★{formatMoney(career.money)}</span>
            <span className="flex items-center gap-0.5 rounded-full bg-amber-300/15 px-1.5 py-0.5 text-[11px] font-black tabular-nums text-amber-100" data-fame-chip>👑{fame}</span>
            {spent.n > 0 && <span key={spent.n} className="pointer-events-none absolute right-2 top-full text-[12px] font-black text-red-300" style={{ animation: "srSpent 1.4s ease-out both" }}>{spent.text}</span>}
          </button>
        </div>
        {/* the dots: where you are in this category; tap one to jump to it */}
        <div className="pointer-events-auto mx-auto flex h-[18px] w-max items-center justify-center" data-item-dots>
          {SHOWROOM_KEYS[cat.id].map((k, i) => (
            <button key={k} onClick={() => goItem(ci, i)} aria-label={`Item ${i + 1}`} data-dot={i} className="flex h-[18px] items-center px-[4px]">
              <span className="block h-[5px] rounded-full transition-all" style={{ width: i === idx[ci] ? 16 : 6, background: i === idx[ci] ? cat.accent : "rgba(255,255,255,.4)" }} />
            </button>
          ))}
        </div>
        {fameOpen && (
          <div className="pointer-events-auto mx-2.5 mt-1.5 rounded-[12px] bg-[#0b1222]/95 p-3 ring-1 ring-amber-300/40 backdrop-blur" style={{ animation: "srDrop .18s ease-out" }} data-fame-banner onClick={() => setFameOpen(false)}>
            <div className="flex items-center gap-3">
              <div className="text-[34px] font-black leading-none tabular-nums text-amber-300" style={{ textShadow: "0 0 16px rgba(251,191,36,.5)" }}>{fame}</div>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-black uppercase tracking-[0.14em] text-amber-100">Fame · {fl.name}</div>
                <div className="mt-1 h-[9px] overflow-hidden rounded-full bg-black/60 ring-1 ring-amber-300/30">
                  <div className="h-full bg-gradient-to-r from-amber-500 to-yellow-300" style={{ width: `${nfl ? Math.max(3, Math.min(100, ((fame - fl.min) / (nfl.min - fl.min)) * 100)) : 100}%` }} />
                </div>
                <div className="mt-1 text-[11px] font-bold text-white/85">{nfl ? `${nfl.min - fame} to ${nfl.name}` : "Top level"}</div>
              </div>
            </div>
            <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-white/10 pt-2">
              <span className="text-[11.5px] font-black text-white">From your stuff <span className="text-amber-300">{fameText(stuffFame)}</span> <span className="text-white/60">/ {OWNED_FAME_MAX}</span></span>
              {onOpen3D && <button onClick={(e) => { e.stopPropagation(); onOpen3D(); }} data-store-open3d className="kib-press rounded-full bg-black/50 px-2.5 py-1 text-[10.5px] font-black uppercase text-amber-200 ring-1 ring-amber-300/50">🕶️ 3D shop ›</button>}
            </div>
          </div>
        )}
      </div>

      {sheet && <DetailSheet sheet={sheet} onClose={() => setSheet(null)} onPick={(lv) => setSheet({ ...sheet, level: lv })} career={career} homeLevel={homeLevel}
        bootLevels={bootLevels} banned={banned} soldOut={soldOut} onOpen3D={onOpen3D}
        onBuy={(run) => { setSheet(null); run(); }} askBoot={askBoot} askItem={askItem} askCan={askCan} onUseCan={onUseCan} />}
      {confirm && <ConfirmSheet info={confirm.info} money={career.money} onCancel={() => setConfirm(null)} onConfirm={confirm.run} />}
      {moment && <PurchaseMoment art={moment.art} level={moment.level} title={moment.title} word={moment.word} fx={moment.fx} onDone={() => setMoment(null)} />}
    </div>
  );
}

/** The thin category rail: icons, the one you are on with its name. */
function Rail({ ci, onJump }: { ci: number; onJump: (i: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current?.querySelector<HTMLElement>(`[data-rail-cat="${SHOWROOM_CATS[ci].id}"]`);
    el?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [ci]);
  return (
    <div ref={ref} className="sr-noscroll flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto rounded-full bg-black/45 px-1 py-0.5 ring-1 ring-white/10 backdrop-blur" data-category-rail>
      {SHOWROOM_CATS.map((c, i) => {
        const on = i === ci;
        return (
          <button key={c.id} onClick={() => onJump(i)} data-rail-cat={c.id} aria-label={c.label}
            className="kib-press flex h-8 shrink-0 items-center gap-1 rounded-full px-1.5 transition-all"
            style={on ? { background: `${c.accent}2e`, boxShadow: `inset 0 0 0 1.5px ${c.accent}` } : undefined}>
            <img src={art(c.icon)} alt="" className={`h-[22px] w-[22px] ${on ? "" : "opacity-60 saturate-50"}`} draggable={false} />
            {on && <span className="pr-0.5 text-[11.5px] font-black uppercase tracking-wide text-white">{c.label}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** One item, full screen. */
function ItemPage({ v, accent, catLabel, pos, next, onOpen, onPickLevel }: {
  v: View; accent: string; catLabel: string; pos: string; next?: string; onOpen: () => void; onPickLevel: (lv: number) => void;
}) {
  const tier = v.levels > 1 ? tierColour(v.level) : accent;
  return (
    <div className="absolute inset-0" data-tour={v.tour} data-item-page={v.key}>
      {/* product-shot light: a soft cone from above, the category colour as the rim */}
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{
        background: `radial-gradient(52% 34% at 50% 44%, rgba(255,255,255,.16), transparent 70%), radial-gradient(80% 46% at 50% 46%, ${accent}2e, transparent 72%), linear-gradient(180deg, transparent 62%, ${accent}14 82%, transparent)`,
      }} />
      <button onClick={v.locked === null ? onOpen : undefined} aria-label={`${v.title}: details`} data-item-pic
        className={`absolute inset-x-0 top-[60px] bottom-[212px] flex items-center justify-center overflow-visible ${v.flash ? "kit-tile-flash" : ""}`}>
        {/* the contact shadow (drawn here, not baked into the picture) */}
        <span aria-hidden className="absolute bottom-[20%] left-1/2 h-[40px] w-[74%] max-w-[620px] -translate-x-1/2 rounded-[50%]" style={{ background: "radial-gradient(closest-side, rgba(0,0,0,.75), transparent)" }} />
        <span aria-hidden className="absolute bottom-[14%] left-1/2 h-[90px] w-[96%] max-w-[900px] -translate-x-1/2 rounded-[50%]" style={{ background: `radial-gradient(closest-side, ${accent}22, transparent)` }} />
        <span className="relative flex h-full w-full items-center justify-center" style={{ animation: "srFloat 5s ease-in-out infinite" }}>{v.pic}</span>
        {v.locked !== null && (
          <span className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <span className="text-[54px]">🔒</span>
            <span className="text-[13px] font-black uppercase tracking-wide text-amber-300">Higher star rating</span>
            <span className="h-2 w-40 overflow-hidden rounded-full bg-white/10"><span className="block h-full rounded-full bg-gradient-to-r from-amber-500 to-yellow-300" style={{ width: `${Math.max(4, Math.round(v.locked * 100))}%` }} /></span>
          </span>
        )}
      </button>
      {v.badges.length > 0 && <div className="pointer-events-none absolute left-3 top-[62px] flex max-w-[70%] flex-wrap gap-1">{v.badges}</div>}

      {/* Bottom: the name, the level pips, what it gives, and Buy. */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#05080f] via-[#05080f]/90 to-transparent px-4 pt-10" style={{ paddingBottom: "calc(14px + env(safe-area-inset-bottom))" }}>
        <div className="mx-auto max-w-md">
          <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-[0.16em]">
            <span style={{ color: accent }}>{catLabel} · {pos}</span>
            {next && <span className="text-white/55">⌃ {next}</span>}
          </div>
          <button onClick={onOpen} className="block w-full text-left">
            <div className="truncate text-[28px] font-black leading-[1.08]" data-item-title>{v.title}</div>
          </button>
          <div className="mt-0.5 flex items-center gap-2">
            <Pips level={v.level} of={v.levels} onPick={v.locked === null ? onPickLevel : undefined} accent={tier} />
            <span className="min-w-0 truncate text-[12px] font-bold text-white/80">{v.sub}</span>
          </div>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[13px] font-black">
            {v.stats.map((s) => <span key={s.text} style={{ color: s.color }}>{s.text}</span>)}
          </div>
          {v.locked === null ? (
            <div className="mt-2.5 flex gap-2">
              <button onClick={v.button.run} disabled={v.button.disabled} data-showroom-buy
                className="kib-press flex h-[54px] min-w-0 flex-1 items-center justify-between rounded-[12px] px-4 disabled:cursor-not-allowed"
                style={v.button.disabled ? { background: "rgba(255,255,255,.09)", color: "rgba(255,255,255,.6)" }
                  : v.button.danger ? { background: "linear-gradient(180deg,#f87171,#b91c1c)", color: "#fff", boxShadow: "0 8px 22px -8px rgba(220,38,38,.9)" }
                  : v.button.blue ? { background: "linear-gradient(180deg,#7dd3fc,#0284c7)", color: "#04121f", boxShadow: "0 8px 22px -8px rgba(14,165,233,.9)" }
                  : { background: "linear-gradient(180deg,#fde68a,#f59e0b 55%,#d97706)", color: "#1c1203", boxShadow: "inset 0 1px 0 rgba(255,255,255,.6), 0 8px 22px -8px rgba(245,158,11,.95)" }}>
                <span className="truncate text-[16px] font-black uppercase">{v.button.label}</span>
                {v.button.price !== undefined && <span className="shrink-0 text-[19px] font-black tabular-nums">★{formatMoney(v.button.price)}</span>}
              </button>
              {v.extra && (
                <button onClick={v.extra.run} disabled={v.extra.disabled} data-can-use={v.key}
                  className="kib-press h-[54px] shrink-0 rounded-[12px] px-3.5 text-[13px] font-black uppercase text-white ring-1 ring-white/25 disabled:opacity-35">{v.extra.label}</button>
              )}
            </div>
          ) : (
            <div className="mt-2.5 grid h-[54px] place-items-center rounded-[12px] bg-white/[0.06] text-[13px] font-black uppercase tracking-wide text-white/75 ring-1 ring-white/10">Opens at a higher star rating</div>
          )}
        </div>
      </div>
    </div>
  );
}

/** "View in 3D shop" — only on things the 3D shop has. */
function ThreeDLink({ onOpen3D }: { onOpen3D?: () => void }) {
  if (!onOpen3D) return null;
  return <button onClick={onOpen3D} data-view-3d className="kib-press shrink-0 rounded-[3px] bg-black/40 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-amber-200 ring-1 ring-amber-300/50">🕶️ View in 3D shop ›</button>;
}

/** The item's sheet: big picture, level ladder, what you gain, View in 3D, Buy. */
function DetailSheet({ sheet, onClose, onPick, career, homeLevel, bootLevels, banned, soldOut, onOpen3D, onBuy, askBoot, askItem, askCan, onUseCan }: {
  sheet: Sheet; onClose: () => void; onPick: (lv: number) => void; career: CareerState; homeLevel: number;
  bootLevels: (base: string) => Boot[]; banned: Set<string>; soldOut: Set<string>; onOpen3D?: () => void;
  onBuy: (run: () => void) => void; askBoot: (b: Boot, black: boolean) => void; askItem: (it: OwnedItem, mine: OwnedItem | undefined) => void;
  askCan: (c: KibCan) => void; onUseCan?: (id: KibCan["id"]) => void;
}) {
  void homeLevel;
  const PicBox = ({ children, lv }: { children: React.ReactNode; lv: number }) => (
    <div className="relative mx-auto flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-[10px]" data-sheet-pic
      style={{ background: `radial-gradient(70% 60% at 50% 45%, rgba(255,255,255,.14), transparent 70%), radial-gradient(90% 70% at 50% 50%, ${tierColour(lv)}33, transparent 75%), #0a1120` }}>
      {children}
    </div>
  );
  if (sheet.cat === "cans") {
    const c = KIB_CANS.find((x) => x.id === sheet.key)!;
    const price = kibCanPrice(c, career.contract.wage);
    const have = career.kibCans[c.id] ?? 0;
    const waiting = !!c.effect && !!career.kibAbility?.[c.effect];
    const useBlocked = have === 0 || waiting || (!c.effect && (career.energy ?? 0) >= 100);
    return (
      <StoreSheet open onClose={onClose} title={c.name} accent="#fb923c">
        <PicBox lv={CAN_TIER[c.id]}><KibCanIcon can={c} className="h-[88%] w-auto" /></PicBox>
        <div className="mt-2 text-center text-[20px] font-black">{kibCanEffectLabel(c)}</div>
        <div className="mt-2"><GiveChips items={[
          { label: "You have", value: `×${have}`, color: "#93c5fd" },
          { label: c.effect ? "For" : "Energy", value: c.effect ? "Next match" : `+${c.restore}`, color: "#fdba74" },
          { label: "Energy now", value: `${Math.round(career.energy ?? 0)}`, color: "#ffffff" },
        ]} /></div>
        <div className="mt-2 text-[11px] font-bold text-white/80">Cans cost a slice of your weekly wage, so they stay worth something as you go up.</div>
        <div className="mt-3 grid grid-cols-[1fr_1.6fr] gap-2">
          {onUseCan ? <button disabled={useBlocked} onClick={() => { onUseCan(c.id); }} className="kib-press rounded-[4px] bg-white/[0.08] py-3 text-[14px] font-black uppercase text-white ring-1 ring-white/15 disabled:opacity-35">{waiting ? "Ready" : "Use one"}</button> : <span />}
          <GoldButton disabled={career.money < price} onClick={() => onBuy(() => askCan(c))}>{career.money < price ? "Not enough" : `Buy ★${formatMoney(price)}`}</GoldButton>
        </div>
      </StoreSheet>
    );
  }
  if (sheet.cat === "boots") {
    const levels = bootLevels(sheet.key);
    const b = levels.find((x) => x.level === sheet.level) ?? levels[0];
    const lv = b.level ?? 1;
    const cur = career.currentBoot;
    const wearing = baseIdOf(cur);
    const isBanned = banned.has(sheet.key);
    const sold = soldOut.has(b.id);
    const mineLv = wearing === sheet.key ? cur.level ?? 0 : 0;
    const mineB = levels.find((x) => x.level === mineLv);
    const can = career.money >= b.price;
    return (
      <StoreSheet open onClose={onClose} title={b.name} accent={tierColour(lv)}>
        <PicBox lv={lv}><BigPic kind="boot" base={sheet.key} level={lv} className="h-full w-full" /></PicBox>
        <div className="mt-1 text-center">
          <div className="text-[22px] font-black leading-tight text-white">{b.name} <span style={{ color: tierColour(lv) }}>L{lv}</span></div>
          <div className="text-[11px] font-black uppercase tracking-[0.18em] text-white/65">{rungName(lv)} level{isBanned ? " · banned by the FA" : ""}</div>
        </div>
        <LevelLadder selected={lv} onPick={onPick}
          rungs={levels.map((x) => ({ level: x.level ?? 1, price: x.price, owned: wearing === sheet.key && (x.level ?? 0) === mineLv, sold: soldOut.has(x.id) }))} />
        <div className="mt-2">
          <GiveChips items={[
            { label: "Power", value: `+${b.power}`, delta: mineB && b.power > mineB.power ? `▲ ${b.power - mineB.power} on yours` : undefined, color: "#6ee7b7" },
            { label: "Technique", value: `+${b.technique}`, delta: mineB && b.technique > mineB.technique ? `▲ ${b.technique - mineB.technique} on yours` : undefined, color: "#6ee7b7" },
            { label: "Matches", value: `${b.matches}`, color: "#fde68a" },
          ]} />
        </div>
        {b.curve && <div className="mt-2 rounded-[4px] bg-sky-500/15 p-2 text-[11.5px] font-bold text-sky-100 ring-1 ring-sky-400/40">Swipe while a shot is in the air to bend, lift or dip it.</div>}
        {b.extraTouch && <div className="mt-2 rounded-[4px] bg-fuchsia-500/15 p-2 text-[11.5px] font-bold text-fuchsia-100 ring-1 ring-fuchsia-400/40">Touch Mode: after you strike it, chase it down for a second touch.</div>}
        <div className="mt-2 flex items-center justify-between px-0.5 text-[10.5px] font-bold text-white/75">
          <span>{weeksText(weeksOfWallet(b.price / b.matches, career.contract.wage))} of income per match</span>
          {IN_3D.has(sheet.key) && <ThreeDLink onOpen3D={onOpen3D} />}
        </div>
        <div className="mt-2">
          {sold ? (
            <div className="rounded-[4px] bg-white/[0.06] py-3 text-center text-[13px] font-black uppercase tracking-wide text-red-300 ring-1 ring-red-400/40">Sold out — back next visit</div>
          ) : isBanned ? (
            <GoldButton danger onClick={() => onBuy(() => askBoot(b, true))}>Buy from shady guys ★{formatMoney(blackMarketPrice(b.price))}</GoldButton>
          ) : (
            <GoldButton disabled={!can} onClick={() => onBuy(() => askBoot(b, false))}>{can ? `Buy now ★${formatMoney(b.price)}` : "Not enough money"}</GoldButton>
          )}
        </div>
      </StoreSheet>
    );
  }
  const levels = STYLE_BASES.get(sheet.key)!;
  const it = levels.find((l) => l.level === sheet.level) ?? levels[0];
  const base = sheet.key;
  const owned = career.ownedItems;
  const mine = owned.find((o) => baseIdOf(o) === base);
  const worn = !!mine && isWornOut(mine);
  const ownLv = ownedLevelOf(mine);
  const blocked = !!mine && !worn && (it.level ?? 0) <= ownLv;
  const canBuy = !blocked && career.money >= it.price;
  const gain = fameGainFromBuying(owned, it);
  const nowFame = mine && !worn ? fameFromOwned(owned, mine) : 0;
  const life = itemLifeSeasons(it);
  const lv = it.level ?? 1;
  const verb = mine && !worn ? "Upgrade" : mine && worn && levels.length === 1 ? "Repair" : "Buy";
  return (
    <StoreSheet open onClose={onClose} title={familyName(it)} accent={tierColour(lv)}>
      <PicBox lv={lv}><BigPic kind="style" base={base} level={lv} className="h-full w-full" /></PicBox>
      <div className="mt-1 text-center">
        <div className="text-[21px] font-black leading-tight text-white">{levelName(it)}</div>
        {levels.length > 1 && <div className="text-[11px] font-black uppercase tracking-[0.18em]" style={{ color: tierColour(lv) }}>Level {lv} · {rungName(lv)}</div>}
      </div>
      {base === "phone" && <PhoneOpens />}
      {levels.length > 1 && (
        <LevelLadder selected={lv} onPick={onPick}
          rungs={levels.map((l) => ({ level: l.level ?? 1, price: l.price, owned: !!mine && !worn && (l.level ?? 0) === ownLv }))} />
      )}
      <div className="mt-2">
        <GiveChips items={[
          { label: mine && !worn ? `fame (now ${fameText(nowFame)})` : "Fame", value: fameText(gain), color: "#fcd34d" },
          { label: "Lasts", value: life === null ? "Forever" : `${life} season${life === 1 ? "" : "s"}`, color: "#ffffff" },
          { label: "Of income", value: weeksText(weeksOfWallet(it.price, career.contract.wage)), color: "#93c5fd" },
        ]} />
      </div>
      {!blocked && career.money < it.price && <SaveUp have={career.money} need={it.price} wage={career.contract.wage} />}
      {IN_3D.has(base) && onOpen3D && <div className="mt-2 flex justify-end"><ThreeDLink onOpen3D={onOpen3D} /></div>}
      <div className="mt-2">
        <GoldButton disabled={!canBuy} onClick={() => onBuy(() => askItem(it, mine))}>
          {blocked ? (ownLv === lv ? "You own this one" : `You own level ${ownLv}`) : career.money < it.price ? "Not enough money" : `${verb} ★${formatMoney(it.price)}`}
        </GoldButton>
      </div>
    </StoreSheet>
  );
}
