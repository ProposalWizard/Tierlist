"use client";
import { forwardRef, useEffect, useRef, useState } from "react";
import BootUnbox from "./BootUnbox";
import StylePicture from "./StylePicture";
import ShopSheet from "./ShopSheet";
import { BasketGlyph } from "./BootShelf";
import { basket, useBasket, basketTotal, basketCount, MAX_PAIRS, type BasketEntry } from "./shopBasket";
import { BOOT_LOOK } from "./BootPicture";
import { hasBootDeal, bootPrice } from "@/lib/star/sponsorDeals";
import type { CareerState, Boot, OwnedItem } from "@/lib/star/types";
import { KIB_CANS, kibCanPrice, kibCanEffectLabel, BOOTS_ALL_LEVELS as BOOTS_FULL_PRICE, baseIdOf, type KibCan } from "@/lib/star/shopData";
import { divisionOf } from "@/lib/star/calendar";
import { SHOP_TIERS, weeksOfWallet } from "@/lib/star/economy";
import { ruleBookFor } from "@/lib/star/ruleBook";
import { formatMoney } from "@/lib/star/money";
import { blackMarketPrice, LAWYER_FEE } from "@/lib/star/corruption";
import KibCanIcon from "./KibCanIcon";
import BootPicture from "./BootPicture";
import BootShelf from "./BootShelf";
import StyleShop from "./StyleShop";
import { styleUnlockStar } from "@/lib/star/unlocks";
import { starsNow } from "@/lib/star/starPoints";
import {
  ScreenShell, WalletPill, ClubCard, PressButton, Glow, Burst, Pop, RiseIn, useFly, useTrigger,
  useClubTheme, rgba, tint, FloatText,
} from "./ui";

/** "−★12k" floating up off the HUD's money when you spend. */
function SpentFloat({ n, text }: { n: number; text: string }) {
  return <div className="relative h-0 w-0"><FloatText trigger={n} text={text} color="#fca5a5" className="right-3 top-1" size={15} /></div>;
}

interface ActionResult { ok: boolean; reason?: string; }

/** Each can's own colour — the same accents as the Home cans card. */
const CAN_ACCENT: Record<KibCan["id"], string> = { basic: "#fb923c", premium: "#60a5fa", elite: "#c084fc" };

/**
 * HOW MANY WEEKS OF YOUR OWN MONEY THIS IS.
 *
 * Every price in this game is a number of weeks multiplied out into stars
 * (economy.ts), and until now the shop was the one place that number could
 * not be read back. "★14,500" tells a player nothing on its own; "4 weeks"
 * or "414 weeks" tells them everything, and it is the same sentence the
 * design is actually written in. Against the wage on their real contract,
 * grossed up the same way every band is — not against a tier's notional
 * first-teamer, who is not them.
 */
function formatWeeks(weeks: number): string {
  if (!Number.isFinite(weeks)) return "";
  if (weeks >= 100) return `${Math.round(weeks)} wks`;
  if (weeks >= 10) return `${weeks.toFixed(0)} wks`;
  if (weeks >= 1) return `${weeks.toFixed(1)} wks`;
  return `${weeks.toFixed(2)} wks`;
}

function Weeks({ price, wage }: { price: number; wage: number }) {
  return (
    <div className="text-[9px] font-bold leading-none text-white/60">
      {formatWeeks(weeksOfWallet(price, wage))} of your income
    </div>
  );
}

interface Props {
  career: CareerState;
  kind: "kib" | "boots" | "lifestyle";
  onBack: () => void;
  onBuyKib: (can: KibCan) => void;
  onBuyBoot: (boot: Boot) => void;
  onBuyItem: (item: OwnedItem) => void;
  /** Phase 5 of STAR_POWER_POLITICS.md — buying a boot the FA's Rule Book
   *  has banned, from "shady guys," at a real risk of getting caught. */
  onBuyFromBlackMarket: (boot: Boot, useLawyers: boolean) => ActionResult;
  /** The top HUD (ui/TopHud.tsx): energy never leaves (Harry, P86). */
  hud?: React.ReactNode;
  /** Home from the Style page's bottom bar. */
  onHome?: () => void;
}

/**
 * THE SHOP — cans, boots and lifestyle, in the home screen's look.
 *
 * Reskinned 28 Sep 2026 (Harry: "that can animation is elite, we need stuff
 * like that all over"). Buying anything plays the can's kind of reward: the
 * item flies into your inventory (its Owned count, your current boots, the
 * item's own row), "−★X" floats up off your money, and the money counts
 * down to its new value. Every price, level, rule and handler is unchanged.
 */
export default function Shop({ career, kind, onBack, onBuyKib, onBuyBoot, onBuyItem, onBuyFromBlackMarket, hud, onHome }: Props) {
  const theme = useClubTheme(career);
  // Five levels of everything (27 Sep 2026). The shop opens on the level
  // priced for the league you're in: National League level 1 … Premier League 5.
  const homeLevel = Math.max(1, SHOP_TIERS.findIndex((t) => t.anchor === divisionOf(career)) + 1);
  // A boots sponsor takes 25% off every pair (sponsorDeals.ts).
  const bootDeal = hasBootDeal(career);
  const BOOTS_ALL_LEVELS = bootDeal ? BOOTS_FULL_PRICE.map((b) => ({ ...b, price: bootPrice(career, b.price) })) : BOOTS_FULL_PRICE;
  const bannedBoots = new Set(ruleBookFor(career, "FA").bannedItems);
  const [selectedCan, setSelectedCan] = useState<KibCan | null>(KIB_CANS[0]);

  // ── The reward ─────────────────────────────────────────────────────────
  const [flyLayer, fly] = useFly();
  const [spent, setSpent] = useState({ n: 0, text: "" });
  const [landed, fireLanded] = useTrigger();
  const [landColor, setLandColor] = useState("#fde047");
  /** Which thing the last flight landed on: a can id, "boot", or an item's base id. */
  const [landKey, setLandKey] = useState("");
  /** Cans still in the air: the Owned count ticks up as each one lands. */
  const [inFlight, setInFlight] = useState<Record<string, number>>({});
  const walletRef = useRef<HTMLDivElement>(null);
  const ownedRefs = useRef<Record<string, HTMLElement | null>>({});
  const bootRef = useRef<HTMLDivElement>(null);
  const canArtRefs = useRef<Record<string, HTMLElement | null>>({});
  /** Spend: "−★X" floats off the money (which counts down), and a copy of
   *  what you bought flies into where it now lives. `holdCount` keeps a
   *  can's Owned count from ticking until its can lands. */
  const reward = (price: number, from: Element | null, to: Element | null, node: React.ReactNode, color: string, key: string, holdCount = false) => {
    setSpent((s) => ({ n: s.n + 1, text: `−★${formatMoney(price)}` }));
    if (holdCount) setInFlight((m) => ({ ...m, [key]: (m[key] ?? 0) + 1 }));
    // With the top HUD up there is no wallet pill: the HUD's money cell is the target.
    fly(from, to ?? walletRef.current ?? (typeof document !== "undefined" ? document.querySelector("[data-hud] [data-money-chip]") : null), node, () => {
      if (holdCount) setInFlight((m) => ({ ...m, [key]: Math.max(0, (m[key] ?? 0) - 1) }));
      setLandColor(color);
      setLandKey(key);
      fireLanded();
    });
  };

  // ── v0.24: unboxing, the basket and "Sold out" (Harry, 2 Oct 2026, P2-24/25) ──
  /** Boot levels bought on this visit: their shelf spot says "Sold out" until you leave. */
  const [soldOut, setSoldOut] = useState<Set<string>>(() => new Set());
  const markSold = (id: string) => setSoldOut((s) => new Set(s).add(id));
  const [unbox, setUnbox] = useState<null | { boot: Boot; pairs: number; done: (el: Element | null) => void }>(null);
  /** Play the box opening; when it ends, fly the boot into "Wearing now". */
  const playUnbox = (boot: Boot, pairs: number, price: number, color = "#34d399") =>
    new Promise<void>((resolve) => {
      setUnbox({
        boot, pairs,
        done: (el) => {
          reward(price, el, bootRef.current, <BootPicture base={baseIdOf(boot)} level={boot.level ?? 1} className="h-12 w-[75px]" />, color, "boot");
          setUnbox(null);
          resolve();
        },
      });
    });
  const list = useBasket();
  const basketBtnRef = useRef<HTMLButtonElement>(null);
  const [basketOpen, setBasketOpen] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showNote = (t: string) => {
    setNote(t);
    if (noteTimer.current) clearTimeout(noteTimer.current);
    noteTimer.current = setTimeout(() => setNote(null), 2600);
  };
  /** Into the basket: it flies off the shelf into the basket button. */
  const addBootToBasket = (b: Boot, from: Element | null) => {
    const msg = basket.addBoot(b);
    if (msg) showNote(msg);
    fly(from, basketBtnRef.current, <BootPicture base={baseIdOf(b)} level={b.level ?? 1} className="h-10 w-[62px]" />);
  };

  // Paying for the basket runs the real buy handlers ONE AT A TIME: each one
  // reads `career` from its own render, so two in the same tick would undo
  // each other. After each buy we wait for the new career to arrive.
  const latest = useRef({ career, onBuyBoot, onBuyItem });
  latest.current = { career, onBuyBoot, onBuyItem };
  const waiters = useRef<(() => void)[]>([]);
  useEffect(() => { const w = waiters.current; waiters.current = []; w.forEach((f) => f()); }, [career]);
  const afterUpdate = () => new Promise<void>((r) => { waiters.current.push(r); setTimeout(r, 600); });
  const alive = useRef(true);
  // Set true on mount too: in development React mounts, unmounts and mounts again.
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const [paying, setPaying] = useState(false);
  const pay = async (entries: BasketEntry[]) => {
    setBasketOpen(false);
    setPaying(true);
    basket.clear();
    for (const e of entries) {
      if (!alive.current) return;
      if (e.kind === "boot") {
        let bought = 0;
        for (let i = 0; i < e.qty; i++) {
          if (latest.current.career.money < e.boot.price) break;
          latest.current.onBuyBoot(e.boot);
          bought++;
          await afterUpdate();
        }
        if (!bought || !alive.current) continue;
        markSold(e.boot.id);
        await playUnbox(e.boot, bought, e.boot.price * bought);
      } else {
        if (latest.current.career.money < e.item.price) continue;
        latest.current.onBuyItem(e.item);
        await afterUpdate();
        reward(e.item.price, basketBtnRef.current, null, <StylePicture base={baseIdOf(e.item)} level={e.item.level ?? 1} className="h-12 w-[75px]" />, "#f0abfc", "style");
        await new Promise((r) => setTimeout(r, 650));
      }
    }
    if (alive.current) setPaying(false);
  };

  const title = kind === "kib" ? "KIB Cans" : kind === "boots" ? "Boots" : "Style";
  const icon = kind === "kib" ? "🥤" : kind === "boots" ? "👟" : "💎";

  return (
    <ScreenShell
      glow={theme.glow}
      title={title}
      icon={icon}
      onBack={onBack}
      hud={hud}
      // The Style page has no title or Back button: its bottom bar does that.
      bare={kind === "lifestyle" && !!hud}
      right={hud ? <SpentFloat n={spent.n} text={spent.text} /> : <WalletPill ref={walletRef} value={career.money} format={formatMoney} spent={spent.n} spentText={spent.text} />}
    >
      {flyLayer}
      {unbox && <BootUnbox base={baseIdOf(unbox.boot)} level={unbox.boot.level ?? 1} name={`${unbox.boot.name} L${unbox.boot.level ?? 1}`} pairs={unbox.pairs} onDone={unbox.done} />}
      {/* Always there on Boots (the flight target), seen once something is in it. */}
      {(kind === "boots" || (kind === "lifestyle" && list.length > 0)) && (
        <BasketButton ref={basketBtnRef} show={(list.length > 0 || paying) && !basketOpen && !unbox} count={basketCount(list)} total={basketTotal(list)} paying={paying} onClick={() => setBasketOpen(true)} />
      )}
      {note && (
        <div className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+92px)] z-[70] flex justify-center px-6">
          <div className="rounded-full bg-black/85 px-3 py-1.5 text-center text-[12px] font-black text-white ring-1 ring-white/15">{note}</div>
        </div>
      )}
      {basketOpen && (
        <BasketSheet career={career} entries={list} onClose={() => setBasketOpen(false)} onPay={() => void pay(list)}
          onAddPair={(b) => { const m = basket.addBoot(b); if (m) showNote(m); }} />
      )}

      {kind === "kib" && (
        <div className="space-y-2.5">
          {KIB_CANS.map((c, i) => {
            // Priced off YOUR wage, so a can always costs something real.
            const price = kibCanPrice(c, career.contract.wage);
            const canBuy = career.money >= price;
            const accent = CAN_ACCENT[c.id];
            const owned = Math.max(0, career.kibCans[c.id] - (inFlight[c.id] ?? 0));
            const sel = selectedCan?.id === c.id;
            // The row is a div, not a button, ON PURPOSE. It used to be a
            // <button> with the Buy <button> nested inside it, which is
            // invalid HTML — React warns it "will cause a hydration error",
            // and nested tap targets behave unpredictably on iOS Safari,
            // which is the actual target platform. stopPropagation papered
            // over the click conflict without making the markup legal.
            // Found by playtest, in the console. Keyboard access is kept
            // explicitly rather than lost along with the <button>.
            return (
              <RiseIn key={c.id} index={i}>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedCan(c)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelectedCan(c); } }}
                  className="kib-press relative flex w-full cursor-pointer items-center gap-3 overflow-hidden rounded-2xl p-3"
                  style={{
                    background: `radial-gradient(70% 90% at 12% 50%, ${rgba(accent, sel ? 0.42 : 0.28)} 0%, transparent 70%), var(--sk-card, linear-gradient(180deg, rgba(31,41,55,.92), rgba(12,17,28,.96)))`,
                    boxShadow: `inset 0 1px 0 rgba(255,255,255,.12), inset 0 0 0 ${sel ? 2 : 1}px ${rgba(accent, sel ? 0.85 : 0.3)}, 0 10px 22px -12px ${rgba(accent, 0.7)}`,
                  }}
                >
                  <div className="relative h-20 w-14 shrink-0" ref={(el) => { canArtRefs.current[c.id] = el; }}>
                    <div className="absolute bottom-0 left-1/2 h-2 w-10 -translate-x-1/2 rounded-[50%] bg-black/60 blur-[3px]" />
                    <Glow color={accent} alpha={0.55} className="bottom-1 left-1/2 h-12 w-12 -translate-x-1/2 blur-lg" />
                    <div className="relative flex h-full justify-center" style={{ filter: `drop-shadow(0 4px 8px ${rgba(accent, 0.65)})` }}>
                      <KibCanIcon can={c} className="h-20 w-14" />
                    </div>
                  </div>
                  <div className="min-w-0 flex-1 text-left">
                    <div className="text-[14px] font-black leading-tight text-white">{c.name}</div>
                    <div className="text-[10.5px] font-bold" style={{ color: tint(accent, 0.35) }}>{kibCanEffectLabel(c)}</div>
                    <div className="relative mt-1 inline-flex">
                      {landKey === c.id && <Burst trigger={landed} colors={[accent, "#fde047", "#ffffff"]} count={14} spread={0.55} round className="left-1/2 top-1/2" />}
                      <span
                        ref={(el) => { ownedRefs.current[c.id] = el; }}
                        className="rounded-full bg-black/35 px-2 py-0.5 text-[10.5px] font-black text-white ring-1 ring-white/10"
                      >
                        Owned <Pop value={owned}>×{owned}</Pop>
                      </span>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="flex items-center justify-end gap-1 text-[14px] font-black text-yellow-300">★ {formatMoney(price)}</div>
                    <Weeks price={price} wage={career.contract.wage} />
                    <PressButton
                      variant="accent"
                      accent={accent}
                      disabled={!canBuy}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!canBuy) return;
                        reward(price, canArtRefs.current[c.id] ?? e.currentTarget, ownedRefs.current[c.id] ?? null, <KibCanIcon can={c} className="h-16 w-11" />, accent, c.id, true);
                        onBuyKib(c);
                      }}
                      className="mt-1.5 rounded-lg px-4 py-1.5 text-[11px] font-black uppercase tracking-wide"
                    >
                      Buy
                    </PressButton>
                  </div>
                </div>
              </RiseIn>
            );
          })}
        </div>
      )}

      {kind === "boots" && (
        <>
          {bootDeal && <div className="mb-2 rounded-xl border border-emerald-300/70 bg-emerald-500/15 px-3 py-2 text-[12px] font-black text-white">👟 Boot sponsor: 25% off every pair.</div>}
          <BootShelf
            career={career}
            boots={BOOTS_ALL_LEVELS}
            banned={bannedBoots}
            homeLevel={homeLevel}
            soldOut={soldOut}
            onBuyNow={(b) => {
              if (career.money < b.price) return;
              onBuyBoot(b);
              markSold(b.id);
              void playUnbox(b, 1, b.price);
            }}
            onAddToBasket={addBootToBasket}
            onBuyFromBlackMarket={(b, lawyers) => {
              const r = onBuyFromBlackMarket(b, lawyers);
              if (r.ok) { markSold(b.id); void playUnbox(b, 1, blackMarketPrice(b.price) + (lawyers ? LAWYER_FEE : 0), "#f87171"); }
              return r;
            }}
          />
          <div ref={bootRef} className="relative">
            <ClubCard glow="#38bdf8" className="relative flex items-center gap-3 overflow-hidden rounded-2xl p-3">
              {landKey === "boot" && <Burst trigger={landed} colors={[landColor, "#fde047", "#ffffff"]} count={16} spread={0.7} round className="left-8 top-1/2" />}
              <span className="grid h-12 w-[72px] shrink-0 place-items-center rounded-xl bg-gradient-to-b from-sky-400/35 to-sky-700/20 ring-1 ring-sky-300/30">
                <Pop value={landKey === "boot" ? landed : 0}><BootPicture base={baseIdOf(career.currentBoot)} level={career.currentBoot.level ?? 1} className="h-11 w-[68px]" /></Pop>
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[9px] font-black uppercase tracking-[0.2em] text-white/60">Wearing now</div>
                <div className="text-[13px] font-black text-white">
                  {career.currentBoot.name}{career.currentBoot.level ? ` L${career.currentBoot.level}` : ""} — <Pop value={career.currentBoot.matches}>{career.currentBoot.matches}</Pop> matches left
                  {career.currentBoot.curve && career.currentBoot.matches > 0 && (
                    <span className="ml-1.5 rounded bg-sky-500 px-1 py-0.5 align-middle text-[9px] font-black tracking-wide text-white">CURVE</span>
                  )}
                  {career.currentBoot.extraTouch && career.currentBoot.matches > 0 && (
                    <span className="ml-1.5 rounded bg-fuchsia-500 px-1 py-0.5 align-middle text-[9px] font-black tracking-wide text-white">TOUCH</span>
                  )}
                </div>
              </div>
            </ClubCard>
          </div>
        </>
      )}

      {kind === "lifestyle" && (
        <StyleShop
          career={career}
          onBack={onBack}
          onHome={onHome}
          onBuyItem={onBuyItem}
          reward={(price, from, to, node, color, key) => reward(price, from, to, node, color, key)}
          landed={landed}
          landKey={landKey}
          // Unlock chain (lib/star/unlocks.ts): on a new career only the phone
          // is open; the rest open at a star rating, shown as a bar.
          lockOf={career.unlocks ? (base) => {
            const need = styleUnlockStar(base);
            const stars = starsNow(career);
            return stars >= need ? null : Math.min(1, stars / need);
          } : undefined}
        />
      )}
    </ScreenShell>
  );
}

/** The basket, bottom right: how many things and what they cost. */
const BasketButton = forwardRef<HTMLButtonElement, { show: boolean; count: number; total: number; paying: boolean; onClick: () => void }>(
  function BasketButton({ show, count, total, paying, onClick }, ref) {
    return (
      <button
        ref={ref}
        onClick={onClick}
        disabled={paying || !show}
        aria-label={`Basket, ${count} item${count === 1 ? "" : "s"}`}
        data-basket
        className={`kib-press fixed right-3 z-[60] flex items-center gap-2 rounded-full py-2 pl-3 pr-3.5 text-white transition duration-300 ${show ? "scale-100 opacity-100" : "pointer-events-none scale-75 opacity-0"}`}
        style={{ bottom: "max(18px, calc(env(safe-area-inset-bottom) + 12px))", background: "linear-gradient(180deg, #34d399, #059669)", boxShadow: "0 10px 24px -8px rgba(5,150,105,.9), inset 0 1px 0 rgba(255,255,255,.4)" }}
      >
        <span className="relative">
          <BasketGlyph size={22} />
          {count > 0 && <span className="absolute -right-2 -top-2 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-white px-1 text-[11px] font-black leading-none text-emerald-700"><Pop value={count}>{count}</Pop></span>}
        </span>
        <span className="text-left leading-none">
          <span className="block text-[12px] font-black uppercase tracking-wide">{paying ? "Paying…" : "Basket"}</span>
          {!paying && <span className="block text-[11px] font-black text-yellow-100">★{formatMoney(total)}</span>}
        </span>
      </button>
    );
  },
);

/** What is in the basket, one row each, and one button to pay for all of it. */
function BasketSheet({ career, entries, onClose, onPay, onAddPair }: {
  career: CareerState; entries: BasketEntry[]; onClose: () => void; onPay: () => void; onAddPair: (b: Boot) => void;
}) {
  const total = basketTotal(entries);
  const short = total - career.money;
  return (
    <ShopSheet open onClose={onClose} title={<span className="flex items-center gap-1.5"><BasketGlyph size={14} /> Your basket</span>} accent="#34d399">
      {entries.length === 0 ? (
        <div className="py-6 text-center text-[13px] font-bold text-white/70">Your basket is empty. Tap + on a boot to add it.</div>
      ) : (
        <div className="space-y-2">
          {entries.map((e) => (
            <div key={e.key} className="flex items-center gap-2.5 rounded-xl bg-white/[0.05] p-2 ring-1 ring-white/10">
              <span className="grid h-11 w-[68px] shrink-0 place-items-center rounded-lg" style={{ background: rgba(e.kind === "boot" ? (BOOT_LOOK[baseIdOf(e.boot)] ?? BOOT_LOOK.starter).upper : "#e879f9", 0.25) }}>
                {e.kind === "boot"
                  ? <BootPicture base={baseIdOf(e.boot)} level={e.boot.level ?? 1} className="h-10 w-[62px]" />
                  : <StylePicture base={baseIdOf(e.item)} level={e.item.level ?? 1} className="h-10 w-[62px]" />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-black text-white">{e.kind === "boot" ? e.boot.name : e.item.name} L{(e.kind === "boot" ? e.boot.level : e.item.level) ?? 1}</div>
                <div className="text-[11px] font-black text-yellow-300">
                  ★{formatMoney(e.kind === "boot" ? e.boot.price * e.qty : e.item.price)}
                  {e.kind === "boot" && <span className="ml-1 text-[10px] font-bold text-white/65">{e.qty} pair{e.qty === 1 ? "" : "s"} · {e.boot.matches * e.qty} matches</span>}
                </div>
              </div>
              {e.kind === "boot" && (
                <div className="flex shrink-0 items-center gap-1">
                  <button onClick={() => basket.removeOne(e.key)} aria-label="One pair less" className="kib-press grid h-7 w-7 place-items-center rounded-full bg-white/10 text-[16px] font-black text-white">−</button>
                  <span className="w-4 text-center text-[13px] font-black text-white">{e.qty}</span>
                  <button onClick={() => onAddPair(e.boot)} disabled={e.qty >= MAX_PAIRS} aria-label="One more pair" className="kib-press grid h-7 w-7 place-items-center rounded-full bg-white/10 text-[16px] font-black text-white disabled:opacity-30">+</button>
                </div>
              )}
              <button onClick={() => basket.remove(e.key)} aria-label="Put it back" className="kib-press grid h-7 w-7 shrink-0 place-items-center rounded-full bg-red-500/20 text-[15px] font-black text-red-200">×</button>
            </div>
          ))}
          <div className="text-[10.5px] font-bold text-white/65">You wear one pair of boots. More pairs of the same boot add their matches together.</div>
          <div className="flex items-center justify-between px-1 pt-1">
            <span className="text-[12px] font-black uppercase tracking-wide text-white/80">Total</span>
            <span className="text-[18px] font-black text-yellow-300">★{formatMoney(total)}</span>
          </div>
          <PressButton variant="primary" size="none" disabled={short > 0} pulse={short <= 0} onClick={onPay}
            className="w-full rounded-2xl py-3 text-[14px] font-black">
            {short > 0 ? `Not enough money — ★${formatMoney(short)} short` : `Pay for all — ★${formatMoney(total)}`}
          </PressButton>
        </div>
      )}
    </ShopSheet>
  );
}
