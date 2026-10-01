"use client";
import { useRef, useState } from "react";
import { hasBootDeal, bootPrice } from "@/lib/star/sponsorDeals";
import type { CareerState, Boot, OwnedItem } from "@/lib/star/types";
import { KIB_CANS, kibCanPrice, kibCanEffectLabel, BOOTS_ALL_LEVELS as BOOTS_FULL_PRICE, baseIdOf, type KibCan } from "@/lib/star/shopData";
import { divisionOf } from "@/lib/star/calendar";
import { SHOP_TIERS, weeksOfWallet } from "@/lib/star/economy";
import { ruleBookFor } from "@/lib/star/ruleBook";
import { formatMoney } from "@/lib/star/money";
import KibCanIcon from "./KibCanIcon";
import BootPicture from "./BootPicture";
import BootShelf from "./BootShelf";
import StyleShop from "./StyleShop";
import { styleUnlockStar } from "@/lib/star/unlocks";
import { starsNow } from "@/lib/star/starPoints";
import {
  ScreenShell, WalletPill, ClubCard, PressButton, Glow, Burst, Pop, RiseIn, useFly, useTrigger,
  useClubTheme, rgba, tint,
} from "./ui";

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
export default function Shop({ career, kind, onBack, onBuyKib, onBuyBoot, onBuyItem, onBuyFromBlackMarket }: Props) {
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
    fly(from, to ?? walletRef.current, node, () => {
      if (holdCount) setInFlight((m) => ({ ...m, [key]: Math.max(0, (m[key] ?? 0) - 1) }));
      setLandColor(color);
      setLandKey(key);
      fireLanded();
    });
  };

  const title = kind === "kib" ? "KIB Cans" : kind === "boots" ? "Boots" : "Style";
  const icon = kind === "kib" ? "🥤" : kind === "boots" ? "👟" : "💎";

  return (
    <ScreenShell
      glow={theme.glow}
      title={title}
      icon={icon}
      onBack={onBack}
      right={<WalletPill ref={walletRef} value={career.money} format={formatMoney} spent={spent.n} spentText={spent.text} />}
    >
      {flyLayer}

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
                    background: `radial-gradient(70% 90% at 12% 50%, ${rgba(accent, sel ? 0.42 : 0.28)} 0%, transparent 70%), linear-gradient(180deg, rgba(31,41,55,.92), rgba(12,17,28,.96))`,
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
            bootTarget={() => bootRef.current}
            reward={reward}
            onBuyBoot={onBuyBoot}
            onBuyFromBlackMarket={onBuyFromBlackMarket}
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
