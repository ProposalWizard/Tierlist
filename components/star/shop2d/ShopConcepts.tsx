"use client";

/**
 * SHOP LAYOUT CONCEPTS — throwaway look prototypes (Harry, 9 Oct 2026, on the
 * new 2D shop: "70% of this isn't even the shop, we need to think outside the
 * box"). /star-dev/media-lab?shopmock=A|B|C|D. Not the real shop: same items,
 * prices and pictures, a sample ★1,000,000 balance, and a fake buy sheet.
 *
 *   A  Showroom swipe   one item fills the screen, swipe sideways, dock at the bottom
 *   B  Dense grid       one 48 px strip on top, three-across grid under it
 *   C  The shop wall    the store's back wall, items in lit niches on shelves
 *   D  Feed             one item per screen, swipe up for the next (like a video feed)
 *
 * Every item tile carries data-mock-item so the measuring script can count
 * how much of the screen is items.
 */
import { useMemo, useRef, useState } from "react";
import { KIB_CANS, kibCanPrice, kibCanEffectLabel, BOOTS_ALL_LEVELS, LIFESTYLE_ALL_LEVELS, baseIdOf } from "@/lib/star/shopData";
import { styleGroupOf, levelName } from "@/lib/star/lifestyleLevels";
import { formatMoney } from "@/lib/star/money";
import { art, tierColour } from "./parts";

export type MockId = "A" | "B" | "C" | "D";

type Cat = "cans" | "boots" | "drip" | "gadgets" | "cars" | "homes" | "holiday";
const CATS: { id: Cat; label: string; icon: string }[] = [
  { id: "cans", label: "Cans", icon: "icon-cans" },
  { id: "boots", label: "Boots", icon: "icon-boots" },
  { id: "drip", label: "Drip", icon: "icon-drip" },
  { id: "gadgets", label: "Gadgets", icon: "icon-gadgets" },
  { id: "cars", label: "Cars", icon: "icon-cars" },
  { id: "homes", label: "Homes", icon: "icon-homes" },
  { id: "holiday", label: "Holiday", icon: "icon-holiday" },
];

interface MockItem { key: string; cat: Cat; name: string; sub: string; level: number; price: number; pic: string; levels: { level: number; price: number; pic: string; name: string }[] }

const MONEY = 1_000_000;
const WAGE = 25;

function buildItems(): MockItem[] {
  const out: MockItem[] = [];
  for (const c of KIB_CANS) {
    out.push({ key: `can-${c.id}`, cat: "cans", name: c.name, sub: kibCanEffectLabel(c), level: c.id === "basic" ? 1 : c.id === "premium" ? 2 : 4,
      price: kibCanPrice(c, WAGE), pic: c.image ?? "", levels: [] });
  }
  const fam = new Map<string, { cat: Cat; levels: MockItem["levels"] }>();
  for (const b of BOOTS_ALL_LEVELS) {
    const base = baseIdOf(b);
    if (!fam.has(`boot-${base}`)) fam.set(`boot-${base}`, { cat: "boots", levels: [] });
    const lv = b.level ?? 1;
    fam.get(`boot-${base}`)!.levels.push({ level: lv, price: b.price, pic: `/shop/boot-${base}-L${lv}.webp`, name: b.name });
  }
  for (const i of LIFESTYLE_ALL_LEVELS) {
    const base = baseIdOf(i);
    if (!fam.has(base)) fam.set(base, { cat: styleGroupOf(i) as Cat, levels: [] });
    const lv = i.level ?? 1;
    fam.get(base)!.levels.push({ level: lv, price: i.price, pic: `/shop/${base}-L${base === "phone" ? 1 : lv}.webp`, name: levelName(i) });
  }
  fam.forEach((f, key) => {
    f.levels.sort((a, b) => a.level - b.level);
    const can = f.levels.filter((l) => l.price <= MONEY);
    const show = can[can.length - 1] ?? f.levels[0];
    out.push({ key, cat: f.cat, name: show.name, sub: f.cat === "boots" ? `Boots · level ${show.level}` : `Level ${show.level} of ${f.levels.length}`, level: show.level, price: show.price, pic: show.pic, levels: f.levels });
  });
  return out;
}

const money = (n: number) => `★${formatMoney(n)}`;

/** The fake buy sheet every concept shares (the real one would be ConfirmSheet). */
function BuySheet({ item, onClose }: { item: MockItem | null; onClose: () => void }) {
  if (!item) return null;
  const ok = item.price <= MONEY;
  return (
    <div className="fixed inset-0 z-[80] flex items-end bg-black/55" onClick={onClose} data-mock-sheet>
      <div className="w-full rounded-t-[18px] bg-[#0d1424] px-4 pb-6 pt-3 ring-1 ring-white/10" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/25" />
        <div className="flex items-center gap-3">
          <div className="h-[72px] w-[96px] shrink-0 overflow-hidden rounded-[8px] bg-white"><img src={item.pic} alt="" className="h-full w-full object-contain" /></div>
          <div className="min-w-0">
            <div className="text-[17px] font-black leading-tight text-white">{item.name}</div>
            <div className="text-[12px] font-bold text-white/80">{item.sub}</div>
            <div className="mt-1 text-[18px] font-black text-amber-300">{money(item.price)}</div>
          </div>
        </div>
        <div className="mt-3 text-[12px] font-bold text-white/80">After: {money(MONEY - item.price)}</div>
        <button disabled={!ok} className="mt-3 h-[52px] w-full rounded-[10px] bg-gradient-to-b from-amber-300 to-amber-500 text-[17px] font-black text-black disabled:opacity-40">{ok ? `Buy for ${money(item.price)}` : "Not enough money"}</button>
      </div>
    </div>
  );
}

function Pips({ level, of = 5 }: { level: number; of?: number }) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: of }, (_, i) => (
        <span key={i} className="h-[6px] w-[14px] rounded-full" style={{ background: i < level ? tierColour(level) : "rgba(255,255,255,.18)" }} />
      ))}
    </div>
  );
}

/** Hides the site menu, the way /star-dev already does (globals.css `[data-star-game]`). */
const NoSiteMenu = () => <div data-star-game hidden />;

export default function ShopConcepts({ id, initial }: { id: MockId; initial?: string }) {
  const items = useMemo(buildItems, []);
  const [sheet, setSheet] = useState<MockItem | null>(null);
  const props = { items, ask: setSheet, initial };
  return (
    <div className="fixed inset-0 z-[60] overflow-hidden bg-[#070b16] text-white" data-shop-mock={id}>
      <NoSiteMenu />
      {id === "A" && <Showroom {...props} />}
      {id === "B" && <DenseGrid {...props} />}
      {id === "C" && <ShopWall {...props} />}
      {id === "D" && <Feed {...props} />}
      <BuySheet item={sheet} onClose={() => setSheet(null)} />
    </div>
  );
}

interface CProps { items: MockItem[]; ask: (i: MockItem) => void; initial?: string }

const BackChip = ({ className = "" }: { className?: string }) => (
  <button className={`flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-[18px] font-black ring-1 ring-white/20 backdrop-blur ${className}`}>‹</button>
);
const BalanceChip = ({ className = "" }: { className?: string }) => (
  <div className={`rounded-full bg-black/60 px-3 py-1.5 text-[14px] font-black tabular-nums text-amber-300 ring-1 ring-amber-300/40 backdrop-blur ${className}`}>{money(MONEY)}</div>
);

// ── A · Showroom swipe ─────────────────────────────────────────────────────
function Showroom({ items, ask }: CProps) {
  const [cat, setCat] = useState<Cat>("cars");
  const list = items.filter((i) => i.cat === cat);
  const [idx, setIdx] = useState(0);
  const scroller = useRef<HTMLDivElement>(null);
  return (
    <div className="absolute inset-0 flex flex-col">
      <div className="relative min-h-0 flex-1">
        <div ref={scroller} key={cat} className="flex h-full snap-x snap-mandatory overflow-x-auto" style={{ scrollbarWidth: "none" }}
          onScroll={(e) => setIdx(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}>
          {list.map((it) => (
            <div key={it.key} data-mock-item className="relative flex h-full w-full shrink-0 snap-center flex-col"
              style={{ background: "radial-gradient(120% 70% at 50% 42%, #ffffff 0%, #eef0f4 45%, #c9ced8 75%, #1a2236 100%)" }}>
              <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden pt-10">
                <img src={it.pic} alt="" className="w-[125%] max-w-none object-contain" />
              </div>
              <div className="bg-gradient-to-t from-[#070b16] via-[#070b16]/95 to-transparent px-5 pb-4 pt-10">
                <div className="text-[11px] font-black uppercase tracking-[0.18em] text-white/70">{CATS.find((c) => c.id === cat)!.label}</div>
                <div className="text-[28px] font-black leading-[1.05]">{it.name}</div>
                <div className="mt-1.5 flex items-center gap-3"><Pips level={it.level} /><span className="text-[12px] font-bold text-white/85">{it.sub}</span></div>
                <button onClick={() => ask(it)} data-mock-buy className="mt-3 flex h-[54px] w-full items-center justify-between rounded-[12px] bg-gradient-to-b from-amber-300 to-amber-500 px-4 text-black">
                  <span className="text-[17px] font-black uppercase">Buy</span><span className="text-[19px] font-black">{money(it.price)}</span>
                </button>
              </div>
            </div>
          ))}
        </div>
        <BackChip className="absolute left-3 top-3" />
        <BalanceChip className="absolute right-3 top-3" />
        <div className="pointer-events-none absolute left-0 right-0 top-[54px] flex justify-center gap-1.5">
          {list.map((it, i) => <span key={it.key} className={`h-[5px] rounded-full ${i === idx ? "w-4 bg-black/70" : "w-[5px] bg-black/30"}`} />)}
        </div>
      </div>
      <div className="flex h-[60px] shrink-0 items-stretch justify-between border-t border-white/10 bg-[#070b16] px-1" data-mock-dock>
        {CATS.map((c) => (
          <button key={c.id} onClick={() => { setCat(c.id); setIdx(0); }} className="flex flex-1 flex-col items-center justify-center gap-0.5">
            <img src={art(c.icon)} alt="" className={`h-[28px] w-[28px] ${c.id === cat ? "" : "opacity-50 saturate-0"}`} />
            <span className={`text-[9.5px] font-black uppercase ${c.id === cat ? "text-amber-300" : "text-white/60"}`}>{c.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── B · Dense grid ────────────────────────────────────────────────────────
function DenseGrid({ items, ask, initial }: CProps) {
  const [cat, setCat] = useState<Cat | "all">("all");
  const [pull, setPull] = useState(initial === "pull");
  const list = cat === "all" ? items : items.filter((i) => i.cat === cat);
  return (
    <div className="absolute inset-0 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
      <div className="sticky top-0 z-10 bg-[#070b16]/95 backdrop-blur">
        <div className="flex h-[48px] items-center gap-2 pl-2 pr-0">
          <button className="flex h-9 w-8 shrink-0 items-center justify-center text-[20px] font-black">‹</button>
          <button onClick={() => setPull((p) => !p)} className="shrink-0 rounded-full bg-amber-400/15 px-2.5 py-1 text-[14px] font-black tabular-nums text-amber-300 ring-1 ring-amber-300/40">{money(MONEY)} ▾</button>
          <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto pr-3" style={{ scrollbarWidth: "none" }}>
            {(["all", ...CATS.map((c) => c.id)] as (Cat | "all")[]).map((c) => (
              <button key={c} onClick={() => setCat(c)} className={`shrink-0 rounded-full px-3 py-1.5 text-[12px] font-black uppercase ${c === cat ? "bg-white text-black" : "bg-white/10 text-white/85"}`}>
                {c === "all" ? "All" : CATS.find((x) => x.id === c)!.label}
              </button>
            ))}
          </div>
        </div>
        {pull && (
          <div className="border-t border-white/10 px-4 pb-3 pt-2" data-mock-pull>
            <div className="flex items-baseline justify-between"><span className="text-[11px] font-black uppercase tracking-[0.16em] text-amber-200">Fame from your stuff</span><span className="text-[20px] font-black text-amber-300">+4.2</span></div>
            <div className="mt-1 h-[8px] overflow-hidden rounded-full bg-black/60"><div className="h-full w-[22%] bg-gradient-to-r from-amber-500 to-yellow-300" /></div>
            <div className="mt-2 flex gap-1.5 overflow-x-auto whitespace-nowrap text-[11px] font-black uppercase" style={{ scrollbarWidth: "none" }}>
              {["Cheapest first", "Can afford", "Not owned", "3D shop ›"].map((f) => <span key={f} className="rounded-full bg-white/10 px-2.5 py-1">{f}</span>)}
            </div>
          </div>
        )}
      </div>
      <div className="grid grid-cols-3 gap-[6px] px-[6px] pb-6 pt-[6px]">
        {list.map((it) => (
          <button key={it.key} data-mock-item onClick={() => ask(it)} className="overflow-hidden rounded-[8px] bg-[#111a2e] text-left ring-1 ring-white/10">
            <div className="relative aspect-[4/3] bg-white">
              <img src={it.pic} alt="" className="h-full w-full object-contain" />
              <span className="absolute left-1 top-1 rounded-[3px] px-1 text-[9px] font-black text-black" style={{ background: tierColour(it.level) }}>L{it.level}</span>
            </div>
            <div className="px-1.5 pb-1.5 pt-1">
              <div className="truncate text-[11.5px] font-black leading-tight">{it.name}</div>
              <div className="text-[12.5px] font-black text-amber-300">{money(it.price)}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── C · The shop wall ─────────────────────────────────────────────────────
function ShopWall({ items, ask, initial }: CProps) {
  const [front, setFront] = useState<MockItem | null>(() => (initial ? items.find((i) => i.key === initial) ?? null : null));
  const rows = CATS.map((c) => ({ ...c, list: items.filter((i) => i.cat === c.id) }));
  return (
    <div className="absolute inset-0 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
      {/* The store's back wall (Higgsfield, wall.webp), held still behind the shelves. */}
      <div className="pointer-events-none fixed inset-0" style={{ background: `linear-gradient(180deg, rgba(7,11,22,.35), rgba(7,11,22,.7)), url(/star/shop2d/wall.webp) center 40% / cover` }} />
      <div className="sticky top-0 z-10 flex h-[52px] items-center justify-between px-3">
        <BackChip /><BalanceChip />
      </div>
      <div className="relative pb-6">
        {rows.map((r) => (
          <div key={r.id} className="mb-3">
            <div className="flex items-center gap-1.5 px-4 pb-1"><img src={art(r.icon)} alt="" className="h-5 w-5" /><span className="text-[12px] font-black uppercase tracking-[0.16em] text-amber-200" style={{ textShadow: "0 1px 4px #000" }}>{r.label}</span></div>
            <div className="flex snap-x scroll-pl-4 gap-2.5 overflow-x-auto px-4 pb-[14px]" style={{ scrollbarWidth: "none" }}>
              {r.list.map((it) => (
                <button key={it.key} data-mock-item onClick={() => setFront(it)} className="relative w-[132px] shrink-0 snap-start text-left">
                  <div className="relative h-[92px] overflow-hidden rounded-t-[6px]" style={{ background: "linear-gradient(180deg,#fffaf0,#efe6d2)", boxShadow: "inset 0 10px 18px -8px rgba(255,214,140,.9), inset 0 -6px 10px -6px rgba(0,0,0,.25)" }}>
                    <img src={it.pic} alt="" className="h-full w-full object-contain" />
                  </div>
                  {/* the shelf lip */}
                  <div className="h-[6px] rounded-b-[2px] bg-gradient-to-b from-[#d6b26a] to-[#7a5a22]" style={{ boxShadow: "0 6px 10px -2px rgba(0,0,0,.7)" }} />
                  <div className="mt-1 flex items-baseline justify-between gap-1 px-0.5">
                    <span className="truncate text-[11px] font-black" style={{ textShadow: "0 1px 3px #000" }}>{it.name}</span>
                    <span className="shrink-0 text-[12px] font-black text-amber-300" style={{ textShadow: "0 1px 3px #000" }}>{money(it.price)}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      {front && (
        <div className="fixed inset-0 z-20 flex flex-col items-center justify-center bg-black/70 px-4 backdrop-blur-[3px]" onClick={() => setFront(null)} data-mock-front>
          <div className="w-full" onClick={(e) => e.stopPropagation()}>
            <div data-mock-item className="overflow-hidden rounded-[14px] ring-2 ring-amber-300/70" style={{ background: "radial-gradient(90% 80% at 50% 40%, #fff, #e8e2d2)", boxShadow: "0 0 60px rgba(251,191,36,.35)" }}>
              <img src={front.pic} alt="" className="aspect-[4/3] w-full object-contain" />
            </div>
            <div className="mt-3 text-[26px] font-black leading-tight">{front.name}</div>
            <div className="mt-1 flex items-center gap-3"><Pips level={front.level} /><span className="text-[12px] font-bold text-white/85">{front.sub}</span></div>
            {front.levels.length > 1 && (
              <div className="mt-3 flex gap-1.5">
                {front.levels.map((l) => (
                  <div key={l.level} className={`flex-1 overflow-hidden rounded-[6px] bg-white ${l.level === front.level ? "ring-2 ring-amber-300" : "opacity-60"}`}><img src={l.pic} alt="" className="aspect-[4/3] w-full object-contain" /></div>
                ))}
              </div>
            )}
            <button onClick={() => ask(front)} className="mt-4 flex h-[54px] w-full items-center justify-between rounded-[12px] bg-gradient-to-b from-amber-300 to-amber-500 px-4 text-black">
              <span className="text-[17px] font-black uppercase">Buy</span><span className="text-[19px] font-black">{money(front.price)}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── D · Feed ──────────────────────────────────────────────────────────────
function Feed({ items, ask }: CProps) {
  const [cat, setCat] = useState<Cat | "all">("all");
  const list = cat === "all" ? items.filter((i) => i.cat !== "cans") : items.filter((i) => i.cat === cat);
  return (
    <div className="absolute inset-0">
      <div className="h-full snap-y snap-mandatory overflow-y-auto" key={cat} style={{ scrollbarWidth: "none" }}>
        {list.map((it) => (
          <div key={it.key} data-mock-item className="relative h-full w-full snap-start"
            style={{ background: "radial-gradient(110% 60% at 50% 40%, #ffffff 0%, #eceff4 50%, #b9c0cc 80%, #0f1626 100%)" }}>
            <img src={it.pic} alt="" className="absolute left-0 right-0 top-[18%] mx-auto w-[110%] max-w-none -translate-x-[4.5%] object-contain" />
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/80 to-transparent px-4 pb-6 pt-24">
              <div className="pr-16">
                <div className="text-[12px] font-black uppercase tracking-[0.18em] text-amber-200">{CATS.find((c) => c.id === it.cat)!.label}</div>
                <div className="text-[30px] font-black leading-[1.02]">{it.name}</div>
                <div className="mt-1.5 flex items-center gap-3"><Pips level={it.level} /><span className="text-[12px] font-bold text-white/85">{it.sub}</span></div>
              </div>
              <button onClick={() => ask(it)} data-mock-buy className="mt-3 flex h-[54px] w-full items-center justify-between rounded-[12px] bg-gradient-to-b from-amber-300 to-amber-500 px-4 text-black">
                <span className="text-[17px] font-black uppercase">Buy</span><span className="text-[19px] font-black">{money(it.price)}</span>
              </button>
            </div>
            <div className="absolute bottom-[110px] right-3 flex flex-col items-center gap-4 text-center text-[10px] font-black uppercase">
              <div><div className="flex h-11 w-11 items-center justify-center rounded-full bg-black/55 text-[18px] ring-1 ring-white/25">🕶️</div>3D</div>
              <div><div className="flex h-11 w-11 items-center justify-center rounded-full bg-black/55 text-[18px] ring-1 ring-white/25">⇅</div>Level</div>
            </div>
          </div>
        ))}
      </div>
      <div className="pointer-events-none absolute left-0 right-0 top-0 bg-gradient-to-b from-black/60 to-transparent pb-6">
        <div className="pointer-events-auto flex h-[48px] items-center gap-2 px-3">
          <BackChip />
          <div className="flex min-w-0 flex-1 gap-3 overflow-x-auto text-[14px] font-black" style={{ scrollbarWidth: "none" }}>
            {(["all", ...CATS.map((c) => c.id)] as (Cat | "all")[]).map((c) => (
              <button key={c} onClick={() => setCat(c)} className={`shrink-0 pb-0.5 ${c === cat ? "border-b-2 border-white text-white" : "text-white/65"}`} style={{ textShadow: "0 1px 4px rgba(0,0,0,.8)" }}>
                {c === "all" ? "For you" : CATS.find((x) => x.id === c)!.label}
              </button>
            ))}
          </div>
          <BalanceChip className="shrink-0" />
        </div>
      </div>
    </div>
  );
}

