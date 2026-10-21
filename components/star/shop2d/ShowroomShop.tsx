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
 *   - the categories as a phone-app tab bar at the BOTTOM (12 Oct 2026: Mikey
 *     found the thin top rail hard to read; Harry: "put the menu at the bottom,
 *     phone style"), above the iPhone home bar;
 *   - a 1 | 3 | 5 switch in the header (lib/star/shopItemsView.ts, kept per
 *     device, 3 by default): 1 = one item fills the screen; 3 = the centre item
 *     big, the one before and after small and faded (tap one to bring it in);
 *     5 = a compact list of the category (a row of cards on PC);
 *   - each category opens, and the shop moves on after a purchase, to the
 *     cheapest item you don't own yet (lib/star/shopNextItem.ts);
 *   - a back chip, More (⋯: Sponsors, Casino, Store, 3D shop), and a balance
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
import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
import { useShopPicsLook, shopPic3d } from "@/lib/star/shopPicsLook";
import { styleGroupOf, levelName, familyName, fameFromOwned, fameText, type StyleGroup } from "@/lib/star/lifestyleLevels";
import { styleUnlockStar } from "@/lib/star/unlocks";
import { starsNow } from "@/lib/star/starPoints";
import { shopDisplays } from "@/lib/star/shop3d/catalogue";
import KibCanIcon from "../KibCanIcon";
import BootPicture from "../BootPicture";
import StylePicture from "../StylePicture";
import { weeksText } from "../ShopSheet";
import { PhoneOpens, SaveUp } from "../StyleShop";
import { nextUpIndex } from "@/lib/star/shopNextItem";
import { listClips } from "@/lib/star/goalClip/store";
import ForYouFeed, { type FeedEntry, type HighlightAd } from "./ForYouFeed";
import { loadShopItemsView, saveShopItemsView, type ShopItemsView } from "@/lib/star/shopItemsView";
import TrophyBadge from "./TrophyBadge";
import { bestHome, homeNameOf } from "@/lib/star/home3d/homes";
import { art, tierColour, rungName, LevelLadder, GiveChips, StoreSheet, GoldButton, ConfirmSheet, PurchaseMoment, type ConfirmInfo, type StoreTab } from "./parts";
import BackButton from "../ui/BackButton";

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
const BOOTS_I = SHOWROOM_CATS.findIndex((c) => c.id === "boots");
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
  // Settings → Look → "Shop pictures": New = renders of the 3D shop's own models (shopPicsLook.ts)
  const pics = useShopPicsLook();
  const from3d = pics === "new" ? shopPic3d(kind, base, level) : null;
  const name = from3d ?? bigName(kind, base, level);
  const [bad, setBad] = useState<string | null>(null);
  const [shown, setShown] = useState<string | null>(null);
  if (bad === name) {
    return kind === "boot"
      ? <BootPicture base={base} level={level} className={`${className} ${grey ? "opacity-30 grayscale" : ""}`} />
      : <StylePicture base={base} level={level} className={`${className} ${grey ? "opacity-30 grayscale" : ""}`} />;
  }
  // Until the big still has arrived, the small render of the same item (most often already in the
  // browser's cache from the shop's other screens) sits in its place, so a slow phone sees the item,
  // never an empty glow (speed job B, 9 Oct 2026: Boots showed a dark-green blob for 8 s+).
  const small = kind === "boot" ? `/shop/boot-${base}-L${Math.max(1, Math.min(5, level))}.webp` : `/shop/${base}-L${base === "phone" ? 1 : Math.max(1, Math.min(5, level))}.webp`;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={from3d ?? `/star/shop2d/items/${name}.webp`} alt="" draggable={false} decoding="async" onError={() => setBad(name)}
      onLoad={() => setShown(name)}
      style={shown === name ? undefined : { backgroundImage: `url(${small})`, backgroundSize: "contain", backgroundPosition: "center", backgroundRepeat: "no-repeat" }}
      data-big-pic={name} data-big-loaded={shown === name ? "1" : "0"} className={`select-none object-contain ${grey ? "opacity-30 grayscale" : ""} ${className}`} />
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
  /** The rest of the shop (Sponsors, Casino, Store, the 3D shop): small doors at the
   *  end of the category rail. The shop's front page is gone (Harry, 9 Oct 2026: the
   *  framed-card grid was "horrendous"); the Showroom IS the shop. */
  links?: ShopLink[];
  /** Dev benches only: keep the bottom-right corner clear for the page-guide eye. */
  guideCorner?: boolean;
  /** Where the categories sit (12 Oct 2026, three options for Harry): A = a text strip under
   *  the header (default); B = a "Homes ▾" pill that opens a grid; C = a text strip above
   *  the bottom bar. The media-lab bench passes ?bar=A|B|C. */
  barOption?: "A" | "B" | "C";
  /** How an item's level shows (12 Oct 2026): the trophy badge (default) or nothing. Bench: &mark=none. */
  levelMark?: "trophy" | "none";
  /** The Buy pill (12 Oct 2026): A = solid red; B = white with a gold price. Default "auto": Homes B, everything else A, so both can be compared in the real shop. Bench: &buy=A or &buy=B. */
  buyStyle?: "A" | "B" | "auto";
  /** Your house in 3D (Harry, 13 Oct 2026: "There needs to be a place to go to my home"). On the Homes
   *  category: "My home" once you own one; before that it says "Buy a home to move in". */
  onOpenHome?: () => void;
}

const ItemLook = createContext<{ mark: "trophy" | "none"; buy: "A" | "B" | "auto" }>({ mark: "trophy", buy: "auto" });

export interface ShopLink { id: string; icon: string; label: string; onClick: () => void; locked?: boolean }

type Moment = { art: React.ReactNode; level: number; title: string; word: string; fx?: string };
type Sheet = { cat: CatId; key: string; level: number };

/** One item as the screen shows it. */
export interface View {
  key: string; cat: CatId; title: string; sub: string; level: number; levels: number;
  pic: React.ReactNode; badges: React.ReactNode[]; stats: { text: string; color: string }[];
  locked: number | null; tour?: string; flash?: boolean;
  button: { label: string; price?: number; disabled: boolean; danger?: boolean; blue?: boolean; run: () => void };
  extra?: { label: string; disabled: boolean; run: () => void };
}

export default function ShowroomShop({ career, kind, onBack, onBuyKib, onBuyBoot, onBuyItem, onBuyFromBlackMarket, focus, onKind, onUseCan, onOpen3D, startCat, links, guideCorner = false, barOption = "A", levelMark = "trophy", buyStyle = "auto", onOpenHome }: Props) {
  const bar = barOption;
  /** The bottom bar's two pages: For You (the TikTok feed) and Shop (the showroom). */
  const [tab, setTab] = useState<"foryou" | "shop">("shop");
  const [pickOpen, setPickOpen] = useState(false);
  const [adShown, setAdShown] = useState(false);
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
  // The item to land on in a category: the cheapest one you don't own yet (lib/star/shopNextItem.ts).
  // boots are priced off your wage (bootPrice, Harry 12 Oct 2026), sponsor 25% after
  const bootsList = useMemo(() => BOOTS_FULL_PRICE.map((b) => ({ ...b, price: bootPrice(career, b.price) })), [career]);
  /** Yours already: the boots you have on (not worn out), a style item you own (not worn out). Cans are used up, never "owned". */
  const isOwned = (cat: CatId, k: string): boolean => {
    if (cat === "cans") return false;
    if (cat === "boots") return baseIdOf(career.currentBoot) === k && career.currentBoot.matches > 0;
    const mine = career.ownedItems.find((o) => baseIdOf(o) === k);
    return !!mine && !isWornOut(mine);
  };
  /** The owned tag on a 5-items card. */
  const ownLabel = (cat: CatId, k: string): string | null => {
    if (cat === "cans") { const n = career.kibCans[k as KibCan["id"]] ?? 0; return n > 0 ? `×${n} owned` : null; }
    if (cat === "boots") return baseIdOf(career.currentBoot) === k ? (career.currentBoot.matches > 0 ? `On · L${career.currentBoot.level ?? 1}` : "Worn out") : null;
    const mine = career.ownedItems.find((o) => baseIdOf(o) === k);
    if (!mine) return null;
    if (isWornOut(mine)) return "Worn out";
    return (STYLE_BASES.get(k)?.length ?? 1) > 1 ? `Owned · L${ownedLevelOf(mine)}` : "Owned";
  };
  const nextUp = (cat: CatId, from = 0): number => {
    const keys = SHOWROOM_KEYS[cat];
    if (cat === "cans") return Math.max(0, Math.min(keys.length - 1, from));
    return nextUpIndex(keys.map((k) => {
      if (cat === "boots") {
        const l1 = bootsList.filter((b) => baseIdOf(b) === k).sort((a, b) => (a.level ?? 0) - (b.level ?? 0))[0];
        return { owned: isOwned(cat, k), locked: false, price: l1?.price ?? 0 };
      }
      return { owned: isOwned(cat, k), locked: (lockOf?.(k) ?? null) !== null, price: STYLE_BASES.get(k)?.[0]?.price ?? 0 };
    }), from);
  };
  const start = useMemo(() => {
    const at = (cat: CatId, key: string) => ({ ci: SHOWROOM_CATS.findIndex((c) => c.id === cat), ii: Math.max(0, SHOWROOM_KEYS[cat].indexOf(key)) });
    const landing = (cat: CatId) => ({ ci: SHOWROOM_CATS.findIndex((c) => c.id === cat), ii: nextUp(cat) });
    if (focus) {
      if (SHOWROOM_KEYS.cans.includes(focus.id)) return { ...at("cans", focus.id), sheet: null };
      if (SHOWROOM_KEYS.boots.includes(focus.id)) return { ...at("boots", focus.id), sheet: { cat: "boots" as CatId, key: focus.id, level: focus.level } };
      const it = LIFESTYLE_ALL_LEVELS.find((i) => baseIdOf(i) === focus.id);
      if (it) {
        const g = styleGroupOf(it);
        return { ...at(g, focus.id), sheet: lockOf?.(focus.id) == null ? { cat: g as CatId, key: focus.id, level: focus.level } : null };
      }
    }
    if (startCat) return { ...landing(startCat), sheet: null };
    if (kind === "kib") return { ...at("cans", "basic"), sheet: null };
    if (kind === "boots") return { ...landing("boots"), sheet: null };
    if (lockOf && !career.ownedItems.some((o) => baseIdOf(o) === "phone")) return { ...at("gadgets", "phone"), sheet: null };
    return { ...landing("drip"), sheet: null };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [ci, setCi] = useState(start.ci);
  // every category opens on its next item, not only the one you start in
  const [idx, setIdx] = useState<number[]>(() => SHOWROOM_CATS.map((c, i) => (i === start.ci ? start.ii : nextUp(c.id))));
  // 1 | 3 | 5 items on screen (remembered on this device; 3 by default)
  const [view, setViewState] = useState<ShopItemsView>(loadShopItemsView);
  const setView = (v: ShopItemsView) => { setViewState(v); saveShopItemsView(v); };
  const [moreOpen, setMoreOpen] = useState(false);
  /** After a purchase: the category to move on to its next item once the burst closes. */
  const jumpAfterBuy = useRef<number | null>(null);
  /** The last category that was not Boots: where the Shop tab goes back to from the Boots tab. */
  const lastNotBoots = useRef(start.ci === BOOTS_I ? SHOWROOM_CATS.findIndex((c) => c.id === "drip") : start.ci);

  // ── For You: every item in the store, mixed, with your last match's goals as the odd "ad" ──
  const [ad, setAd] = useState<HighlightAd | null>(null);
  useEffect(() => {
    if (tab !== "foryou") return;
    let live = true;
    void lastMatchHighlights().then((a) => { if (live) setAd(a); });
    return () => { live = false; };
  }, [tab]);
  const feedEntries = useMemo<FeedEntry[]>(() => {
    // the same mix all week; a new one next week
    let seed = ((career.season ?? 1) * 997 + (career.week ?? 0) * 31 + 7) >>> 0;
    const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const shuffle = <T,>(a: T[]) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
    const piles = shuffle(SHOWROOM_CATS).map((c) => ({ c, keys: shuffle(SHOWROOM_KEYS[c.id]) }));
    const out: FeedEntry[] = [];
    let n = 0;
    while (piles.some((p) => p.keys.length)) {
      for (const p of piles) {
        const k = p.keys.shift();
        if (!k) continue;
        if (ad && (n === 3 || (n > 3 && (n - 3) % 10 === 0))) out.push({ ad: true, id: `ad-${n}` });
        out.push({ ad: false, item: { cat: p.c.id, key: k, accent: p.c.accent, label: p.c.label } });
        n++;
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ad]);
  const [sheet, setSheet] = useState<Sheet | null>(start.sheet);

  // ── The buy flows (unchanged from the store) ───────────────────────────
  const bootDeal = hasBootDeal(career);
  const boots = bootsList;
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
      jumpAfterBuy.current = SHOWROOM_CATS.findIndex((c) => c.id === "boots");
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
        jumpAfterBuy.current = SHOWROOM_CATS.findIndex((c) => c.id === styleGroupOf(it));
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
        // 40% smaller than it was (h-full, up to 440px): a can now reads about the size of a boot or a watch on its page (Harry, 13 Oct 2026: "way too big")
        pic: <KibCanIcon can={c} className="h-[60%] max-h-[264px] w-auto" />,
        badges: [<Badge key="n" kind="blue">×{have} owned</Badge>, ...(waiting ? [<Badge key="w" kind="gold">Ready next match</Badge>] : [])],
        stats, locked: null,
        button: { label: can ? "Buy" : "Not enough", price, disabled: !can, run: () => askCan(c) },
        extra: onUseCan ? { label: waiting ? "Ready" : "Use one", disabled: useBlocked, run: () => onUseCan(c.id) } : undefined,
      };
    }
    if (cat === "boots") {
      const levels = bootLevels(key);
      const mineLv = wearing === key ? cur.level ?? 1 : 0;
      // one level at a time: the next one you don't own (Harry, 12 Oct 2026); the others are in the item's sheet
      const def = wearing === key ? (cur.matches > 0 ? Math.min(levels.length, mineLv + 1) : mineLv) : 1;
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
        pic: <BigPic kind="boot" base={key} level={lv} className={`h-full w-full ${sold ? "opacity-50 grayscale" : ""}`} />,
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
    const def = yours ? Math.min(levels.length, ownLv + (ownLv < levels.length ? 1 : 0)) : 1;
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
  // 1 and 3 items: the Feed (categories up/down) of Showroom rows (items sideways).
  // 5 items: no Feed; one category's list, and the tab bar picks the category.
  const outer = useRef<HTMLDivElement>(null);
  const rows = useRef<(HTMLDivElement | null)[]>([]);
  const list = useRef<HTMLDivElement>(null);
  /** One step sideways: the whole width (1 item) or one slide (3 items). */
  const stepW = (c: number) => {
    const r = rows.current[c];
    if (!r) return 390;
    return Math.max(1, r.querySelector<HTMLElement>("[data-show-item]")?.offsetWidth ?? r.clientWidth);
  };
  const pageH = () => outer.current?.clientHeight ?? 844;
  // put the Feed and every row on its item: when the shop opens, and when 1 | 3 | 5 changes
  useLayoutEffect(() => {
    if (view === 5) return;
    const o = outer.current;
    if (o) o.scrollTop = ci * o.clientHeight;
    rows.current.forEach((r, c) => { if (r) r.scrollLeft = idx[c] * stepW(c); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, tab]);
  const goCat = (c: number, smooth = true) => {
    const n = Math.max(0, Math.min(SHOWROOM_CATS.length - 1, c));
    const o = outer.current;
    if (!o) { setCi(n); setFameOpen(false); return; }
    o.scrollTo({ top: n * o.clientHeight, behavior: smooth ? "smooth" : "auto" });
  };
  const goItem = (c: number, i: number, smooth = true) => {
    const n = Math.max(0, Math.min(SHOWROOM_KEYS[SHOWROOM_CATS[c].id].length - 1, i));
    const r = rows.current[c];
    if (!r) { setIdx((a) => a.map((v, k) => (k === c ? n : v))); return; }
    r.scrollTo({ left: n * stepW(c), behavior: smooth ? "smooth" : "auto" });
  };
  /** A tab in the bottom bar: open that category on its next item. */
  const openCat = (i: number) => {
    setMoreOpen(false); setPickOpen(false);
    const land = nextUp(SHOWROOM_CATS[i].id, idx[i]);
    setIdx((a) => a.map((v, k) => (k === i ? land : v)));
    const r = rows.current[i];
    if (r) r.scrollLeft = land * stepW(i);
    goCat(i, Math.abs(i - ci) <= 1);
  };
  const onOuterScroll = () => {
    const o = outer.current;
    if (!o) return;
    const c = Math.round(o.scrollTop / Math.max(1, o.clientHeight));
    if (c !== ci) { setCi(c); setFameOpen(false); setMoreOpen(false); setPickOpen(false); }
  };
  const onRowScroll = (c: number) => {
    const r = rows.current[c];
    if (!r) return;
    const i = Math.round(r.scrollLeft / stepW(c));
    setIdx((a) => (a[c] === i ? a : a.map((v, k) => (k === c ? i : v))));
  };
  // after a purchase: once the burst has gone, move on to the next item you don't own
  useEffect(() => {
    if (moment || confirm || sheet || jumpAfterBuy.current === null) return;
    const c = jumpAfterBuy.current;
    jumpAfterBuy.current = null;
    const n = nextUp(SHOWROOM_CATS[c].id, idx[c]);
    if (n !== idx[c]) goItem(c, n);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moment, confirm, sheet, career]);
  // 5 items: keep the item you are on (the next one, on open) in view
  const curKey = SHOWROOM_KEYS[SHOWROOM_CATS[ci].id][idx[ci]];
  useEffect(() => {
    if (view !== 5) return;
    const l = list.current;
    const el = l?.querySelector<HTMLElement>(`[data-list-item="${curKey}"]`);
    if (!l || !el) return;
    const top = el.offsetTop - (l.clientHeight - el.offsetHeight) / 2;
    l.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  }, [view, curKey]);
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
      if (e.key === "ArrowDown" || e.key === "PageDown") { e.preventDefault(); if (view === 5) openCat(ci + 1); else goCat(ci + 1); }
      else if (e.key === "ArrowUp" || e.key === "PageUp") { e.preventDefault(); if (view === 5) openCat(ci - 1); else goCat(ci - 1); }
      else if (e.key === "ArrowRight") { e.preventDefault(); goItem(ci, idx[ci] + 1); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); goItem(ci, idx[ci] - 1); }
      else if (e.key === "Escape") onBack();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  // mouse drag: decide the axis after 6 px, follow the pointer, then snap one step
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
      const w = stepW(d.c);
      const from = Math.round(d.sx / w);
      goItem(d.c, from + (Math.abs(dx) > w * 0.12 ? (dx < 0 ? 1 : -1) : 0));
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
  const openSheet = (c: CatId, k: string) => setSheet({ cat: c, key: k, level: viewOf(c, k).level });
  // what sits over the item: the header (+ the category strip in A, + the dots) and the bottom bar (+ the strip in C)
  const topPx = 46 + (tab === "shop" && bar !== "C" ? STRIP_H : 0) + (tab === "shop" && view !== 5 ? 18 : 0);
  const botPx = TAB_H + (tab === "shop" && bar === "C" ? STRIP_H : 0);
  // the bottom bar has Sponsors, Casino and the 3D shop; the rest stay under More
  const moreLinks = (links ?? []).filter((l) => !ON_BAR.has(l.id));
  // Boots is its own tab on the bar (Harry, 12 Oct 2026: "it's quite a big aspect"), so the word strip leaves it out
  const onBoots = cat.id === "boots";
  if (!onBoots) lastNotBoots.current = ci;
  const needStars = (key: string) => (lockOf?.(key) != null ? { need: styleUnlockStar(key), have: Math.floor(starsNow(career)) } : null);

  return (
    <ItemLook.Provider value={{ mark: levelMark, buy: buyStyle }}>
    <div data-showroom-shop data-items-view={view} data-shop-tab={tab} data-bar={bar} data-sk-tone="calm" className="fixed inset-0 z-[60] overflow-hidden bg-[#05080f] text-white"
      style={{ touchAction: "pan-x pan-y", ["--sr-top" as string]: `calc(${topPx}px + env(safe-area-inset-top))`, ["--sr-bot" as string]: `calc(${botPx}px + env(safe-area-inset-bottom))` }}>
      <div data-star-game hidden />
      <style>{`
        [data-showroom-shop] .sr-noscroll{scrollbar-width:none}
        [data-showroom-shop] .sr-noscroll::-webkit-scrollbar{display:none}
        @keyframes srSpent{0%{transform:translateY(0);opacity:0}15%{opacity:1}100%{transform:translateY(26px);opacity:0}}
        @keyframes srFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
        @media (prefers-reduced-motion: reduce){[data-showroom-shop] *{animation:none!important;scroll-behavior:auto!important;transition:none!important}}
      `}</style>
      {/* the store at night (Higgsfield shop art), darkened: the item is the light */}
      <div aria-hidden className="pointer-events-none absolute inset-[-24px]" style={{ background: `url(${art("wall")}) center 40% / cover`, filter: "blur(10px) brightness(.42) saturate(.8)" }} />
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(90% 60% at 50% 42%, rgba(5,8,15,.25), rgba(5,8,15,.8) 75%), linear-gradient(180deg, rgba(5,8,15,.55), rgba(5,8,15,.35) 40%, rgba(5,8,15,.95) 85%)" }} />

      {tab === "foryou" ? (
        // a phone-width column, centred, on a PC (Harry, 13 Oct 2026: "Is there no for you page on PC?" — full width it
        // read as a stretched picture, not a feed); on a phone it is the whole screen as before
        <div className="absolute inset-y-0 left-1/2 w-full max-w-[460px] -translate-x-1/2 min-[520px]:border-x min-[520px]:border-white/10 min-[520px]:shadow-[0_0_60px_rgba(0,0,0,.6)]" data-foryou-column>
        <ForYouFeed onAdShown={setAdShown} entries={feedEntries} viewOf={viewOf} ownLabel={ownLabel} ad={ad} needStars={needStars}
          onDetails={(c, k) => { if (viewOf(c, k).locked === null) openSheet(c, k); }}
          onSeeAll={(c, k) => {
            const n = SHOWROOM_CATS.findIndex((x) => x.id === c);
            setIdx((a) => a.map((v, j) => (j === n ? Math.max(0, SHOWROOM_KEYS[c].indexOf(k)) : v)));
            setCi(n); setTab("shop");
          }} />
        </div>
      ) : view === 5 ? (
        <div ref={list} data-shop-list={cat.id} className="sr-noscroll absolute inset-0 overflow-y-auto overflow-x-hidden"
          style={{ paddingTop: "calc(var(--sr-top) - 4px)", paddingBottom: BOTTOM_PAD, overscrollBehavior: "contain" }}>
          <div className="mx-auto grid max-w-[1180px] grid-cols-1 gap-2 px-3 md:grid-cols-5 md:gap-3 md:px-6 md:pt-4">
            {(() => {
              const keys = SHOWROOM_KEYS[cat.id];
              const nu = cat.id === "cans" ? -1 : nextUp(cat.id, -1);
              return keys.map((k, i) => {
                const v = viewOf(cat.id, k);
                const isNext = i === nu && !isOwned(cat.id, k);
                return (
                  <ListCard key={k} v={v} accent={cat.accent} on={i === idx[ci]} next={isNext} own={ownLabel(cat.id, k)}
                    onTap={() => { setIdx((a) => a.map((x, c) => (c === ci ? i : x))); if (v.locked === null) openSheet(cat.id, k); }} />
                );
              });
            })()}
          </div>
        </div>
      ) : (
        <div ref={outer} onScroll={onOuterScroll} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={endDrag} onPointerCancel={endDrag}
          className="sr-noscroll relative h-full w-full overflow-y-auto overflow-x-hidden" style={{ scrollSnapType: "y mandatory", overscrollBehavior: "contain" }} data-feed>
          {SHOWROOM_CATS.map((c, cIdx) => {
            const keys = SHOWROOM_KEYS[c.id];
            const near = Math.abs(cIdx - ci) <= 1;
            const cur = Math.max(0, Math.min(keys.length - 1, idx[cIdx]));
            const curView = near && view === 3 ? viewOf(c.id, keys[cur]) : null;
            return (
              <section key={c.id} data-feed-cat={c.id} className="relative h-full w-full" style={{ scrollSnapAlign: "start", scrollSnapStop: "always" }}>
                {view === 3 && (
                  <div aria-hidden className="pointer-events-none absolute inset-0" style={{
                    background: `radial-gradient(40% 30% at 50% 42%, rgba(255,255,255,.14), transparent 70%), radial-gradient(70% 42% at 50% 44%, ${c.accent}2a, transparent 72%)`,
                  }} />
                )}
                <div ref={(el) => { rows.current[cIdx] = el; }} onScroll={() => onRowScroll(cIdx)} data-showroom-row={c.id}
                  className="sr-noscroll relative flex h-full w-full overflow-x-auto overflow-y-hidden" style={{ scrollSnapType: "x mandatory", overscrollBehaviorX: "contain" }}>
                  {view === 3 && <div aria-hidden className="h-full shrink-0" style={{ width: SIDE_W }} />}
                  {keys.map((k, i) => {
                    const show = near && Math.abs(i - cur) <= (view === 3 ? 2 : 1);
                    return (
                      <div key={k} data-show-item={k} className="relative h-full shrink-0" style={{ width: view === 3 ? SLIDE_W : "100%", scrollSnapAlign: "center", scrollSnapStop: "always" }}>
                        {show ? (view === 1
                          ? <ItemPage v={viewOf(c.id, k)} accent={c.accent} catLabel={c.label} pos={`${i + 1}/${keys.length}`}
                              next={SHOWROOM_CATS[cIdx + 1]?.label} onOpen={() => openSheet(c.id, k)}
                              onPickLevel={(lv) => setPick((p) => ({ ...p, [k]: lv }))} />
                          : <SideSlide v={viewOf(c.id, k)} accent={c.accent} d={i - cur}
                              onTap={() => (i === cur ? openSheet(c.id, k) : goItem(cIdx, i))} />) : null}
                      </div>
                    );
                  })}
                  {view === 3 && <div aria-hidden className="h-full shrink-0" style={{ width: SIDE_W }} />}
                </div>
                {curView && (
                  <>
                    {curView.badges.length > 0 && <div className="pointer-events-none absolute left-3 z-10 flex max-w-[70%] flex-wrap gap-1" style={{ top: "calc(var(--sr-top) + 2px)" }}>{curView.badges}</div>}
                    <ItemInfo v={curView} accent={c.accent} catLabel={c.label} pos={`${cur + 1}/${keys.length}`} next={SHOWROOM_CATS[cIdx + 1]?.label}
                      guideCorner={false} onOpen={() => openSheet(c.id, keys[cur])} onPickLevel={(lv) => setPick((p) => ({ ...p, [keys[cur]]: lv }))} />
                  </>
                )}
              </section>
            );
          })}
        </div>
      )}

      {/* PC arrows (pointer devices only) */}
      {tab === "shop" && view !== 5 && (
        <div className="pointer-events-none absolute inset-0 hidden [@media(hover:hover)_and_(pointer:fine)]:block">
          {idx[ci] > 0 && <button onClick={() => goItem(ci, idx[ci] - 1)} aria-label="Previous item" className="pointer-events-auto absolute left-3 top-[42%] grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-black/50 text-[24px] font-black ring-1 ring-white/20 hover:bg-black/70">‹</button>}
          {idx[ci] < nItems - 1 && <button onClick={() => goItem(ci, idx[ci] + 1)} aria-label="Next item" className="pointer-events-auto absolute right-3 top-[42%] grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-black/50 text-[24px] font-black ring-1 ring-white/20 hover:bg-black/70">›</button>}
        </div>
      )}

      {!(tab === "foryou" && adShown) && <>
      {/* Top: back · the category name · 1|3|5 · More · balance + fame. Floats over the item. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 bg-gradient-to-b from-black/75 via-black/35 to-transparent pb-2" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className="pointer-events-auto mx-auto flex h-[46px] max-w-[820px] items-center gap-1.5 px-2.5">
          <BackButton onClick={onBack} dark data-shop-back />
          <div className="min-w-0 flex-1 truncate pl-1 text-[16px] font-black" data-shop-cat-title>{tab === "foryou" ? "For You" : onBoots ? <span style={{ color: cat.accent }}>Boots</span> : ""}</div>
          {tab === "shop" && <ViewSwitch view={view} onPick={setView} />}
          {tab === "shop" && moreLinks.length > 0 && (
            <button onClick={() => { setMoreOpen((v) => !v); setFameOpen(false); }} aria-label="More: sponsors, casino, store, 3D shop" data-shop-more
              className={`kib-press grid h-9 w-9 shrink-0 place-items-center rounded-full text-[18px] font-black ring-1 backdrop-blur ${moreOpen ? "bg-white/20 ring-white/50" : "bg-black/55 ring-white/20"}`}>⋯</button>
          )}
          <button onClick={() => { setFameOpen((v) => !v); setMoreOpen(false); }} data-balance-chip aria-label="Balance and fame"
            className="kib-press relative flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-black/60 pl-2.5 pr-2 ring-1 ring-amber-300/45 backdrop-blur">
            <span className="text-[13.5px] font-black tabular-nums text-amber-300">★{formatMoney(career.money)}</span>
            <span className="flex items-center gap-0.5 rounded-full bg-amber-300/15 px-1.5 py-0.5 text-[11px] font-black tabular-nums text-amber-100" data-fame-chip>👑{fame}</span>
            {spent.n > 0 && <span key={spent.n} className="pointer-events-none absolute right-2 top-full text-[12px] font-black text-red-300" style={{ animation: "srSpent 1.4s ease-out both" }}>{spent.text}</span>}
          </button>
        </div>
        {tab === "shop" && bar === "A" && (onBoots ? <div style={{ height: STRIP_H }} /> : <CatStrip ci={ci} onPick={openCat} />)}
        {tab === "shop" && bar === "B" && (
          <div className="pointer-events-auto flex items-center justify-center" style={{ height: STRIP_H }}>
            <button onClick={() => { setPickOpen((v) => !v); setMoreOpen(false); setFameOpen(false); }} data-cat-pill aria-label="Categories"
              className="kib-press flex h-[34px] items-center gap-1.5 rounded-full bg-black/55 px-3.5 backdrop-blur" style={{ boxShadow: `inset 0 0 0 1.5px ${cat.accent}` }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={art(cat.icon)} alt="" className="h-[22px] w-[22px]" draggable={false} />
              <span className="text-[16px] font-black" style={{ color: cat.accent }}>{cat.label}</span>
              <span className="text-[11px] text-white/70">{pickOpen ? "▲" : "▼"}</span>
            </button>
          </div>
        )}
        {/* the dots: where you are in this category; tap one to jump to it */}
        {tab === "shop" && view !== 5 && (
          <div className="pointer-events-auto mx-auto flex h-[18px] w-max items-center justify-center" data-item-dots>
            {SHOWROOM_KEYS[cat.id].map((k, i) => (
              <button key={k} onClick={() => goItem(ci, i)} aria-label={`Item ${i + 1}`} data-dot={i} className="flex h-[18px] items-center px-[4px]">
                <span className="block h-[5px] rounded-full transition-all" style={{ width: i === idx[ci] ? 16 : 6, background: i === idx[ci] ? cat.accent : "rgba(255,255,255,.4)" }} />
              </button>
            ))}
          </div>
        )}
        {pickOpen && tab === "shop" && <CatGrid ci={ci} onPick={openCat} />}
        {moreOpen && moreLinks.length > 0 && (
          <div className="pointer-events-auto mx-auto mt-1.5 grid max-w-[420px] grid-cols-4 gap-1.5 rounded-[14px] bg-[#0b1222]/95 p-2 ring-1 ring-white/15 backdrop-blur" style={{ marginInline: 10 }} data-shop-more-menu>
            {moreLinks.map((l) => (
              <button key={l.id} onClick={() => { setMoreOpen(false); l.onClick(); }} data-shop-link={l.id} aria-label={l.label}
                className={`kib-press flex flex-col items-center gap-1 rounded-[10px] bg-white/[0.06] py-2 ${l.locked ? "opacity-50" : ""}`}>
                <span className="text-[22px] leading-none">{l.locked ? "🔒" : l.icon}</span>
                <span className="whitespace-nowrap text-[10.5px] font-black uppercase tracking-wide text-white">{l.label}</span>
              </button>
            ))}
          </div>
        )}
        {fameOpen && (
          <div className="pointer-events-auto mx-2.5 mt-1.5 rounded-[12px] bg-[#0b1222]/95 p-3 ring-1 ring-amber-300/40 backdrop-blur" data-fame-banner onClick={() => setFameOpen(false)}>
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
      </>}

      {/* Homes: the way into your house (Harry, 13 Oct 2026) */}
      {tab === "shop" && cat.id === "homes" && (
        <div className="pointer-events-none absolute right-3 z-20 flex justify-end" style={{ top: "calc(var(--sr-top) + 2px)" }} data-shop-my-home>
          {bestHome(career.ownedItems) && onOpenHome ? (
            <button onClick={onOpenHome} data-open-home aria-label={`My home: ${homeNameOf(career.ownedItems)}`}
              className="kib-press pointer-events-auto flex h-9 items-center gap-1.5 rounded-full bg-lime-300 px-3.5 text-[13px] font-black uppercase tracking-wide text-[#05080f] shadow-[0_6px_18px_-6px_rgba(163,230,53,.7)]">
              <span className="text-[16px] leading-none">🏠</span>My home ›
            </button>
          ) : (
            <span className="flex h-8 items-center gap-1.5 rounded-full bg-black/60 px-3 text-[11.5px] font-black uppercase tracking-wide text-lime-200 ring-1 ring-lime-300/40 backdrop-blur" data-no-home>
              <span className="text-[14px] leading-none">🏠</span>Buy a home to move in
            </span>
          )}
        </div>
      )}

      {tab === "shop" && bar === "C" && (
        <div className="absolute inset-x-0 z-30 bg-gradient-to-t from-[#070b14] to-[#070b14]/70" style={{ bottom: `calc(${TAB_H}px + env(safe-area-inset-bottom))` }}>
          <CatStrip ci={ci} onPick={openCat} />
        </div>
      )}
      <BottomBar active={tab === "foryou" ? "foryou" : onBoots ? "boots" : "shop"} links={links} onOpen3D={onOpen3D} guideCorner={guideCorner}
        onPick={(t) => {
          setMoreOpen(false); setPickOpen(false); setFameOpen(false);
          if (t === "foryou") { setTab("foryou"); return; }
          setTab("shop");
          if (t === "boots") { if (!onBoots) openCat(BOOTS_I); }
          else if (onBoots) openCat(lastNotBoots.current);
        }} />

      {sheet && <DetailSheet sheet={sheet} onClose={() => setSheet(null)} onPick={(lv) => setSheet({ ...sheet, level: lv })} career={career} homeLevel={homeLevel}
        bootLevels={bootLevels} banned={banned} soldOut={soldOut} onOpen3D={onOpen3D}
        onBuy={(run) => { setSheet(null); run(); }} askBoot={askBoot} askItem={askItem} askCan={askCan} onUseCan={onUseCan} />}
      {confirm && <ConfirmSheet info={confirm.info} money={career.money} onCancel={() => setConfirm(null)} onConfirm={confirm.run} />}
      {moment && <PurchaseMoment art={moment.art} level={moment.level} title={moment.title} word={moment.word} fx={moment.fx} onDone={() => setMoment(null)} />}
    </div>
    </ItemLook.Provider>
  );
}

/** Your last match's goals, from the recordings on this device (newest match only). */
async function lastMatchHighlights(): Promise<HighlightAd | null> {
  try {
    const all = await listClips();
    const top = all[0];
    if (!top) return null;
    const t0 = Date.parse(top.createdAt) || 0;
    const same = all.filter((c) => c.home === top.home && c.away === top.away && Math.abs((Date.parse(c.createdAt) || 0) - t0) < 4 * 3600_000);
    const ids = same.map((c) => c.id).reverse();
    return { clipIds: ids, title: "Your highlights", sub: `${top.home} v ${top.away} · ${ids.length} goal${ids.length === 1 ? "" : "s"}` };
  } catch {
    return null;
  }
}

/** The bottom bar's height (above the iPhone home bar). */
const TAB_H = 64;
/** The category text strip (A: under the header; C: above the bottom bar). */
const STRIP_H = 38;
const ON_BAR = new Set(["sponsors", "shop3d"]);
const BOTTOM_PAD = "calc(12px + var(--sr-bot))";
/** 3 items: the centre slide's width, and the space either side of the first and last. */
const SLIDE_W = "min(46%, 400px)";
const SIDE_W = "calc((100% - min(46%, 400px)) / 2)";

/** Line icons for the bottom bar (TikTok-style: thin, white, filled for the page you are on). */
function BarIcon({ name, on }: { name: "foryou" | "shop" | "sponsors" | "boots"; on: boolean }) {
  const p = { fill: on ? "currentColor" : "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };
  return (
    <svg viewBox="0 0 24 24" className="h-[26px] w-[26px]" aria-hidden>
      {name === "foryou" && <><rect x="4" y="3" width="16" height="18" rx="4" {...p} /><path d="M10 9l5 3-5 3z" fill={on ? "#05080f" : "currentColor"} stroke="none" /></>}
      {name === "shop" && <><path d="M5 8h14l-1.2 12H6.2z" {...p} /><path d="M9 8V6.5a3 3 0 016 0V8" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" /></>}
      {name === "sponsors" && <><circle cx="12" cy="9" r="5" {...p} /><path d="M8.5 13l-1.5 7 5-2.5 5 2.5-1.5-7" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinejoin="round" /></>}
      {name === "boots" && <><path d="M5 6h6l1 5 6.5 2.2a2.5 2.5 0 011.5 2.3V17H4.5z" {...p} /><path d="M6 20v-2.5M10 20v-2.5M14 20v-2.5M18 20v-2.5" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" /></>}
    </svg>
  );
}

/** The bottom bar, TikTok-style: Shop · For You · 3D (the big centre button: the walk-around shop) · Boots · Sponsors.
 *  Harry, 12 Oct 2026. Casino moved off it, back under More (⋯) in the shop header. */
function BottomBar({ active, onPick, links, onOpen3D, guideCorner }: {
  active: "shop" | "foryou" | "boots"; onPick: (t: "shop" | "foryou" | "boots") => void; links?: ShopLink[]; onOpen3D?: () => void; guideCorner: boolean;
}) {
  const link = (id: string) => links?.find((l) => l.id === id);
  const sponsors = link("sponsors"), three = link("shop3d");
  const Tab = ({ on, label, icon, onClick, locked, data }: { on: boolean; label: string; icon: React.ReactNode; onClick?: () => void; locked?: boolean; data: string }) => (
    <button onClick={onClick} disabled={!onClick} data-bar-tab={data} aria-current={on ? "page" : undefined} aria-label={label}
      className={`kib-press relative flex min-w-0 flex-1 flex-col items-center justify-center gap-[3px] disabled:opacity-30 ${on ? "text-white" : "text-white/60"} ${locked ? "opacity-50" : ""}`}>
      {icon}
      <span className="text-[10px] font-bold leading-none">{locked ? `🔒 ${label}` : label}</span>
    </button>
  );
  return (
    <nav data-shop-tabs aria-label="Shop" className="absolute inset-x-0 bottom-0 z-30 border-t border-white/10 bg-[#05080f]"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      <div className={`mx-auto flex max-w-[620px] items-stretch ${guideCorner ? "pr-11" : ""}`} style={{ height: TAB_H }}>
        <Tab data="shop" on={active === "shop"} label="Shop" icon={<BarIcon name="shop" on={active === "shop"} />} onClick={() => onPick("shop")} />
        <Tab data="foryou" on={active === "foryou"} label="For You" icon={<BarIcon name="foryou" on={active === "foryou"} />} onClick={() => onPick("foryou")} />
        <div className="flex flex-1 items-center justify-center">
          <button onClick={three?.onClick ?? onOpen3D} disabled={!(three || onOpen3D)} data-bar-tab="shop3d" aria-label="3D shop"
            className="kib-press relative grid h-[36px] w-[54px] place-items-center rounded-[11px] text-[15px] font-black text-[#05080f] disabled:opacity-30"
            style={{ background: "#fff", boxShadow: "-4px 0 0 #22d3ee, 4px 0 0 #f43f5e" }}>3D</button>
        </div>
        <Tab data="boots" on={active === "boots"} label="Boots" icon={<BarIcon name="boots" on={active === "boots"} />} onClick={() => onPick("boots")} />
        <Tab data="sponsors" on={false} label="Sponsors" locked={sponsors?.locked} icon={<BarIcon name="sponsors" on={false} />} onClick={sponsors?.onClick} />
      </div>
    </nav>
  );
}

/** The categories as words, like TikTok's "Following | For You": swipe it, tap one; yours is white and underlined. */
function CatStrip({ ci, onPick }: { ci: number; onPick: (i: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const box = ref.current;
    const el = box?.querySelector<HTMLElement>(`[data-strip-cat="${SHOWROOM_CATS[ci].id}"]`);
    if (box && el) box.scrollTo({ left: el.offsetLeft - (box.clientWidth - el.offsetWidth) / 2, behavior: "smooth" });
  }, [ci]);
  return (
    <div ref={ref} className="sr-noscroll pointer-events-auto relative flex items-center gap-5 overflow-x-auto px-[38%]" style={{ height: STRIP_H }} data-cat-strip>
      {SHOWROOM_CATS.map((c, i) => {
        if (c.id === "boots") return null; // Boots has its own tab on the bar
        const on = i === ci;
        return (
          <button key={c.id} onClick={() => onPick(i)} data-strip-cat={c.id} aria-current={on ? "true" : undefined}
            className="relative shrink-0 pb-1 text-[16px] font-extrabold transition-colors" style={{ color: on ? "#fff" : "rgba(255,255,255,.55)", textShadow: "0 1px 6px rgba(0,0,0,.8)" }}>
            {c.label}
            <span aria-hidden className="absolute inset-x-1/4 -bottom-[1px] h-[3px] rounded-full transition-opacity" style={{ background: on ? "#fff" : "transparent" }} />
          </button>
        );
      })}
    </div>
  );
}

/** Option B: the category pill opens this grid. */
function CatGrid({ ci, onPick }: { ci: number; onPick: (i: number) => void }) {
  return (
    <div className="pointer-events-auto mx-2.5 mt-1.5 grid grid-cols-4 gap-1.5 rounded-[14px] bg-[#0b1222]/95 p-2 ring-1 ring-white/15 backdrop-blur" data-cat-grid>
      {SHOWROOM_CATS.map((c, i) => (
        <button key={c.id} onClick={() => onPick(i)} data-grid-cat={c.id}
          className="kib-press flex flex-col items-center gap-1 rounded-[10px] py-2" style={i === ci ? { background: `${c.accent}33`, boxShadow: `inset 0 0 0 1.5px ${c.accent}` } : { background: "rgba(255,255,255,.06)" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={art(c.icon)} alt="" className="h-[30px] w-[30px]" draggable={false} />
          <span className="text-[11px] font-black" style={{ color: i === ci ? c.accent : "#fff" }}>{c.label}</span>
        </button>
      ))}
    </div>
  );
}

/** 1 | 3 | 5 items on screen. */
function ViewSwitch({ view, onPick }: { view: ShopItemsView; onPick: (v: ShopItemsView) => void }) {
  return (
    <div className="flex h-9 shrink-0 items-center rounded-full bg-black/55 p-[3px] ring-1 ring-white/20 backdrop-blur" role="group" aria-label="Items on screen" data-view-switch>
      {([1, 3, 5] as ShopItemsView[]).map((n) => (
        <button key={n} onClick={() => onPick(n)} data-view={n} aria-label={`${n} item${n === 1 ? "" : "s"} on screen`} aria-pressed={view === n}
          className={`kib-press grid h-[30px] w-[28px] place-items-center rounded-full text-[13px] font-black tabular-nums ${view === n ? "bg-white text-[#05080f]" : "text-white/75"}`}>{n}</button>
      ))}
    </div>
  );
}

/** 3 items: one slide. The centre is big; the ones beside it small and faded. Tap a side one to bring it in. */
function SideSlide({ v, accent, d, onTap }: { v: View; accent: string; d: number; onTap: () => void }) {
  const far = Math.abs(d);
  // the centre item spills past its slide; the side ones lean in so they peek from the edges
  const scale = far === 0 ? 1.32 : far === 1 ? 0.64 : 0.5;
  const opacity = far === 0 ? 1 : far === 1 ? 0.4 : 0.14;
  const lean = far === 0 ? 0 : -Math.sign(d) * (far === 1 ? 20 : 34);
  return (
    <button onClick={onTap} aria-label={far === 0 ? `${v.title}: details` : `Show ${v.title}`} data-item-page={v.key} data-side={d}
      className={`absolute inset-x-0 flex flex-col items-center justify-center ${far === 0 && v.flash ? "kit-tile-flash" : ""}`}
      style={{ top: "var(--sr-top)", bottom: "calc(166px + var(--sr-bot))" }} data-tour={far === 0 ? v.tour : undefined}>
      <span className="relative flex h-full w-full items-center justify-center transition-[transform,opacity] duration-300 ease-out" style={{ transform: `translateX(${lean}%) scale(${scale})`, opacity }}>
        <span aria-hidden className="absolute bottom-[16%] left-1/2 h-[30px] w-[80%] -translate-x-1/2 rounded-[50%]" style={{ background: "radial-gradient(closest-side, rgba(0,0,0,.75), transparent)" }} />
        <span aria-hidden className="absolute bottom-[10%] left-1/2 h-[70px] w-[100%] -translate-x-1/2 rounded-[50%]" style={{ background: `radial-gradient(closest-side, ${accent}22, transparent)` }} />
        <span className="relative flex h-full w-full items-center justify-center" style={far === 0 ? { animation: "srFloat 5s ease-in-out infinite" } : undefined}>{v.pic}</span>
        {v.locked !== null && <span className="absolute inset-0 grid place-items-center text-[44px]">🔒</span>}
      </span>
      {far === 1 && (
        <span className="pointer-events-none absolute top-[66%] inset-x-1 truncate text-center text-[11px] font-black uppercase tracking-wide text-white/55" style={{ transform: `translateX(${lean * 0.9}%)` }}>{v.title}</span>
      )}
    </button>
  );
}

/** 5 items: one row (phone) or card (PC) — picture, name, price, owned / locked. Tap to open. */
function ListCard({ v, accent, on, next, own, onTap }: { v: View; accent: string; on: boolean; next: boolean; own: string | null; onTap: () => void }) {
  const locked = v.locked !== null;
  const tier = v.levels > 1 ? tierColour(v.level) : accent;
  return (
    <button onClick={onTap} data-list-item={v.key} data-tour={v.tour} aria-label={`${v.title}: details`}
      className={`kib-press relative flex h-[126px] items-stretch gap-3 overflow-hidden rounded-[16px] p-2 text-left md:h-auto md:flex-col md:gap-1.5 md:p-2.5 ${locked ? "opacity-60" : ""} ${v.flash ? "kit-tile-flash" : ""}`}
      style={{ background: "linear-gradient(180deg, rgba(255,255,255,.07), rgba(255,255,255,.03))", boxShadow: on ? `inset 0 0 0 2px ${accent}, 0 8px 24px -12px ${accent}` : "inset 0 0 0 1px rgba(255,255,255,.1)" }}>
      <span className="relative flex w-[132px] shrink-0 items-center justify-center overflow-hidden rounded-[12px] md:aspect-[4/3] md:w-full"
        style={{ background: `radial-gradient(70% 65% at 50% 45%, rgba(255,255,255,.14), transparent 70%), radial-gradient(90% 70% at 50% 55%, ${tier}2e, transparent 75%), #0a1120` }}>
        <span className={`flex h-full w-full items-center justify-center p-1 ${locked ? "grayscale" : ""}`}>{v.pic}</span>
        {locked && <span className="absolute inset-0 grid place-items-center text-[30px]">🔒</span>}
      </span>
      <span className="flex min-w-0 flex-1 flex-col justify-center gap-1">
        <span className="flex items-center gap-1.5">
          {next && <span className="shrink-0 rounded-full px-2 py-[3px] text-[9.5px] font-black uppercase tracking-wide text-[#05080f]" style={{ background: accent }} data-next-up>Next up</span>}
          {own && <span className="shrink-0 rounded-full bg-emerald-800/90 px-2 py-[3px] text-[9.5px] font-black uppercase tracking-wide text-emerald-200 ring-1 ring-emerald-300/40" data-owned>{own}</span>}
        </span>
        <span className="truncate text-[17px] font-black leading-tight text-white md:text-[15px]">{v.title}</span>
        <span className="truncate text-[11.5px] font-bold text-white/70">{v.sub}</span>
        {locked ? (
          <span className="text-[12px] font-black uppercase tracking-wide text-amber-300">Higher star rating</span>
        ) : (
          <span className="flex items-baseline gap-1.5">
            <span className={`text-[11.5px] font-black uppercase ${v.button.disabled ? "text-white/55" : "text-white/85"}`}>{v.button.label}</span>
            {v.button.price !== undefined && <span className={`text-[16px] font-black tabular-nums ${v.button.disabled ? "text-white/45" : "text-amber-300"}`}>★{formatMoney(v.button.price)}</span>}
          </span>
        )}
      </span>
    </button>
  );
}

/** 1 item: one item, full screen. */
function ItemPage({ v, accent, catLabel, pos, next, onOpen, onPickLevel, guideCorner = false }: {
  v: View; accent: string; catLabel: string; pos: string; next?: string; onOpen: () => void; onPickLevel: (lv: number) => void; guideCorner?: boolean;
}) {
  return (
    <div className="absolute inset-0" data-tour={v.tour} data-item-page={v.key}>
      {/* product-shot light: a soft cone from above, the category colour as the rim */}
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{
        background: `radial-gradient(52% 34% at 50% 44%, rgba(255,255,255,.16), transparent 70%), radial-gradient(80% 46% at 50% 46%, ${accent}2e, transparent 72%), linear-gradient(180deg, transparent 62%, ${accent}14 82%, transparent)`,
      }} />
      <button onClick={v.locked === null ? onOpen : undefined} aria-label={`${v.title}: details`} data-item-pic
        className={`absolute inset-x-0 flex items-center justify-center overflow-visible ${v.flash ? "kit-tile-flash" : ""}`}
        style={{ top: "var(--sr-top)", bottom: "calc(166px + var(--sr-bot))" }}>
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
      {v.badges.length > 0 && <div className="pointer-events-none absolute left-3 flex max-w-[70%] flex-wrap gap-1" style={{ top: "calc(var(--sr-top) + 2px)" }}>{v.badges}</div>}
      <ItemInfo v={v} accent={accent} catLabel={catLabel} pos={pos} next={next} onOpen={onOpen} onPickLevel={onPickLevel} guideCorner={guideCorner} />
    </div>
  );
}

const BUY_RED = "#f87171";

/** Buy, sized like a native app button (Harry, 12 Oct 2026: the wide slab "still doesn't look quite right").
 *  A: a solid red pill, the price in a darker capsule inside. B: a white pill, the price in a gold capsule.
 *  Harry preferred A but wants both in use to compare (12 Oct 2026): Homes shows B, every other category A. */
function BuyPill({ b, variant }: { b: View["button"]; variant: "A" | "B" }) {
  const accent = BUY_RED;
  const off = b.disabled;
  const bg = off ? "rgba(255,255,255,.12)" : b.danger ? "#dc2626" : variant === "A" ? accent : "#ffffff";
  const ink = off ? "rgba(255,255,255,.7)" : b.danger ? "#fff" : "#0b1222";
  return (
    <button onClick={b.run} disabled={off} data-showroom-buy data-buy-style={variant}
      className="kib-press flex h-[44px] max-w-[200px] items-center gap-2 rounded-full pl-[18px] pr-[6px] disabled:cursor-not-allowed"
      style={{ background: bg, color: ink, boxShadow: off ? "inset 0 0 0 1px rgba(255,255,255,.2)" : `0 6px 16px -6px ${b.danger ? "#dc2626" : variant === "A" ? accent : "rgba(0,0,0,.8)"}, inset 0 1px 0 rgba(255,255,255,.35)` }}>
      <span className="truncate text-[14px] font-extrabold">{b.label}</span>
      {b.price !== undefined && (variant === "A" || off || b.danger ? (
        <span className="flex h-[32px] shrink-0 items-center rounded-full px-2.5 text-[15px] font-black tabular-nums" style={{ background: off ? "transparent" : "rgba(0,0,0,.16)" }}>★{formatMoney(b.price)}</span>
      ) : (
        <span className="flex h-[32px] shrink-0 items-center rounded-full px-2.5 text-[15px] font-black tabular-nums text-[#1c1203]" style={{ background: "#f5b82e" }}>★{formatMoney(b.price)}</span>
      ))}
      {b.price === undefined && <span className="w-3" />}
    </button>
  );
}

/** Under the item: the name, the level pips, what it gives, and Buy (sits above the tab bar). */
function ItemInfo({ v, accent, catLabel, pos, next, onOpen, guideCorner = false }: {
  v: View; accent: string; catLabel: string; pos: string; next?: string; onOpen: () => void; onPickLevel: (lv: number) => void; guideCorner?: boolean;
}) {
  const look = useContext(ItemLook);
  return (
    <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-[#05080f] via-[#05080f]/90 to-transparent px-4 pt-8" style={{ paddingBottom: "calc(12px + var(--sr-bot))" }} data-item-info={v.key}>
      <div className="mx-auto max-w-md">
        <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-[0.16em]">
          <span style={{ color: accent }}>{catLabel} · {pos}</span>
          {next && <span className="text-white/55">⌃ {next}</span>}
        </div>
        <button onClick={onOpen} className="block w-full text-left">
          <div className="truncate text-[26px] font-black leading-[1.08]" data-item-title>{v.title}</div>
        </button>
        <div className="mt-0.5 flex items-center gap-2">
          {look.mark === "trophy" && v.levels > 1 && <TrophyBadge level={v.level} size={38} className="-my-2 shrink-0" />}
          <span className="min-w-0 truncate text-[12px] font-bold text-white/80">{v.sub}</span>
        </div>
        <div className="mt-1.5 flex items-end gap-2">
          <div className="flex min-w-0 flex-1 flex-wrap gap-x-3 gap-y-0.5 text-[13px] font-black">
            {v.stats.map((s) => <span key={s.text} style={{ color: s.color }}>{s.text}</span>)}
          </div>
          {v.locked === null ? (
            <div className={`flex shrink-0 items-center gap-1.5 ${guideCorner ? "mr-11" : ""}`}>
              {v.extra && (
                <button onClick={v.extra.run} disabled={v.extra.disabled} data-can-use={v.key}
                  className="kib-press h-[40px] rounded-full bg-black/40 px-3 text-[12px] font-black uppercase text-white ring-1 ring-white/30 disabled:opacity-35">{v.extra.label}</button>
              )}
              <BuyPill b={v.button} variant={look.buy === "auto" ? (v.cat === "homes" ? "B" : "A") : look.buy} />
            </div>
          ) : (
            <span className={`shrink-0 rounded-full bg-white/[0.08] px-3 py-2 text-[11px] font-black uppercase tracking-wide text-white/75 ring-1 ring-white/15 ${guideCorner ? "mr-11" : ""}`}>🔒 Higher star rating</span>
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
