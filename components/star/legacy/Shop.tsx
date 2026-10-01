"use client";
import { fameGainFromBuying, isWornOut, itemLifeSeasons } from "@/lib/star/fame";
import { useRef, useState } from "react";
import { hasBootDeal, bootPrice } from "@/lib/star/sponsorDeals";
import type { CareerState, Boot, OwnedItem } from "@/lib/star/types";
import { KIB_CANS, kibCanPrice, kibCanEffectLabel, BOOTS_ALL_LEVELS as BOOTS_FULL_PRICE, LIFESTYLE_ALL_LEVELS, SHOP_LEVEL_COUNT, baseIdOf, type KibCan } from "@/lib/star/shopData";
import { divisionOf } from "@/lib/star/calendar";
import { SHOP_TIERS, weeksOfWallet } from "@/lib/star/economy";
import { ruleBookFor } from "@/lib/star/ruleBook";
import { blackMarketPrice, LAWYER_FEE } from "@/lib/star/corruption";
import { formatMoney } from "@/lib/star/money";
import KibCanIcon from "@/components/star/KibCanIcon";
import LifestyleIcon from "@/components/star/LifestyleIcon";
import {
  ScreenShell, WalletPill, ClubCard, PressButton, Glow, Burst, Pop, RiseIn, Shine, useFly, useTrigger,
  useClubTheme, rgba, tint,
} from "@/components/star/legacy/ui";

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
  const [tab, setTab] = useState<"item" | "vehicle" | "property">("item");
  // Five levels of everything (27 Sep 2026). The shop opens on the level
  // priced for the league you're in: National League level 1 … Premier League 5.
  const homeLevel = Math.max(1, SHOP_TIERS.findIndex((t) => t.anchor === divisionOf(career)) + 1);
  // A boots sponsor takes 25% off every pair (sponsorDeals.ts).
  const bootDeal = hasBootDeal(career);
  const BOOTS_ALL_LEVELS = bootDeal ? BOOTS_FULL_PRICE.map((b) => ({ ...b, price: bootPrice(career, b.price) })) : BOOTS_FULL_PRICE;
  const bootBases = Array.from(new Set(BOOTS_ALL_LEVELS.map((b) => baseIdOf(b))));
  const [selectedBoot, setSelectedBoot] = useState<Boot | null>(
    BOOTS_ALL_LEVELS.find((b) => baseIdOf(b) === bootBases[0] && b.level === homeLevel) ?? BOOTS_ALL_LEVELS[0],
  );
  const [useLawyers, setUseLawyers] = useState(false);
  const [blackMarketMessage, setBlackMarketMessage] = useState<string | null>(null);
  const bannedBoots = new Set(ruleBookFor(career, "FA").bannedItems);
  const [selectedCan, setSelectedCan] = useState<KibCan | null>(KIB_CANS[0]);
  const [selectedItem, setSelectedItem] = useState<OwnedItem | null>(null);

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
  const itemRefs = useRef<Record<string, HTMLElement | null>>({});
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

  const title = kind === "kib" ? "KIB Cans" : kind === "boots" ? "Boots" : "Lifestyle";
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
          <div className="mb-2 text-[11px] font-bold text-white">
            Every boot comes in 5 levels. Level 1 is priced for National League money, level 5 for the Premier League. A higher level has better stats.
          </div>
          <ClubCard glow={theme.glow} className="mb-3 rounded-2xl">
            {bootBases.map((base) => {
              const levels = BOOTS_ALL_LEVELS.filter((b) => baseIdOf(b) === base).sort((a, b) => (a.level ?? 0) - (b.level ?? 0));
              const first = levels[0];
              const isSel = !!selectedBoot && baseIdOf(selectedBoot) === base;
              return (
                <div key={base} className={`border-b border-white/[0.06] px-3 py-2 ${isSel ? "bg-white/[0.06]" : ""}`}>
                  <div className="flex items-center gap-1 text-[12px] font-black text-white">
                    <span className="mr-0.5 text-[14px]">👟</span>
                    {first.name}
                    {first.curve && <span className="rounded bg-sky-500 px-1 py-0.5 text-[8px] font-black leading-none tracking-wide text-white">CURVE</span>}
                    {first.extraTouch && <span className="rounded bg-fuchsia-500 px-1 py-0.5 text-[8px] font-black leading-none tracking-wide text-white">TOUCH</span>}
                    {bannedBoots.has(base) && <span className="rounded bg-red-600 px-1 py-0.5 text-[8px] font-black leading-none tracking-wide text-white">BANNED</span>}
                  </div>
                  <div className="mt-1.5 grid grid-cols-5 gap-1">
                    {levels.map((b) => {
                      const on = selectedBoot?.id === b.id;
                      return (
                        <button
                          key={b.id}
                          onClick={() => setSelectedBoot(b)}
                          className={`kib-press rounded-lg py-1.5 text-center ${on ? "bg-gradient-to-b from-emerald-300 to-emerald-600 text-emerald-950" : "bg-white/[0.07] text-white ring-1 ring-white/[0.07]"}`}
                          style={on ? { boxShadow: "inset 0 1px 0 rgba(255,255,255,.5), 0 4px 10px -3px rgba(16,185,129,.7)" } : undefined}
                        >
                          <div className="text-[10px] font-black">L{b.level}</div>
                          <div className={`text-[9px] font-bold ${on ? "text-emerald-950" : "text-yellow-300"}`}>{formatMoney(b.price)}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </ClubCard>
          {selectedBoot?.curve && (
            <div className="mb-3 rounded-xl bg-sky-500/15 p-2.5 text-center text-[11px] font-bold text-sky-100 ring-1 ring-sky-400/40">
              Swipe the screen while a shot is in the air to bend, lift or dip it — each swipe stacks.
            </div>
          )}
          {selectedBoot?.extraTouch && (
            <div className="mb-3 rounded-xl bg-fuchsia-500/15 p-2.5 text-center text-[11px] font-bold text-fuchsia-100 ring-1 ring-fuchsia-400/40">
              Adds a Touch Mode button in-match. Turn it on and, after you strike the ball, your player chases it — reach it before anything else happens and play pauses again for a fresh aim and kick from wherever it ended up. Nudge it into space, then take the real shot or pass.
            </div>
          )}
          {selectedBoot && (
            /* The two numbers that decide whether a boot is worth it, and
               neither was on screen before: what it costs in weeks of the
               player's own income, and what that works out at per match.
               The second is the one the old catalogue got badly wrong —
               the cheapest boots in the game used to cost about three
               weeks' wages for every match they lasted. */
            <ClubCard glow="#10b981" className="mb-3 flex items-center justify-between rounded-2xl p-3">
              <div className="text-left">
                <div className="text-[12px] font-black text-white">{selectedBoot.name} · Level {selectedBoot.level ?? 1}</div>
                <div className="text-[10.5px] font-bold text-white">
                  Power <span className="text-emerald-300">+{selectedBoot.power}</span> · Technique <span className="text-emerald-300">+{selectedBoot.technique}</span>
                </div>
                <div className="text-[9.5px] font-bold text-white/75">
                  {selectedBoot.matches} matches — {formatWeeks(weeksOfWallet(selectedBoot.price / selectedBoot.matches, career.contract.wage))} per match
                </div>
              </div>
              <div className="text-right">
                <div className="text-[15px] font-black text-yellow-300">★{formatMoney(selectedBoot.price)}</div>
                <Weeks price={selectedBoot.price} wage={career.contract.wage} />
              </div>
            </ClubCard>
          )}
          <div ref={bootRef} className="relative">
            <ClubCard glow="#38bdf8" className="relative flex items-center gap-3 overflow-hidden rounded-2xl p-3">
              {landKey === "boot" && <Burst trigger={landed} colors={[landColor, "#fde047", "#ffffff"]} count={16} spread={0.7} round className="left-8 top-1/2" />}
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-b from-sky-400/35 to-sky-700/20 text-[22px] ring-1 ring-sky-300/30">
                <Pop value={landKey === "boot" ? landed : 0}>👟</Pop>
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[9px] font-black uppercase tracking-[0.2em] text-white/60">Current boot</div>
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
          {selectedBoot && bannedBoots.has(baseIdOf(selectedBoot)) ? (
            <div className="mt-3 rounded-2xl bg-red-950/60 p-3 ring-1 ring-red-600/70">
              <div className="mb-2 text-center text-[11px] font-bold text-red-200">
                Banned by the FA — a real chance of getting caught buying it anyway.
              </div>
              <label className="mb-2 flex items-center gap-2 text-[10px] font-bold text-white/85">
                <input type="checkbox" checked={useLawyers} onChange={e => setUseLawyers(e.target.checked)} />
                Hire lawyers first (★{formatMoney(LAWYER_FEE)} — cuts the risk a lot, doesn&apos;t remove it)
              </label>
              <PressButton
                variant="danger"
                size="none"
                disabled={career.money < blackMarketPrice(selectedBoot.price) + (useLawyers ? LAWYER_FEE : 0)}
                onClick={(e) => {
                  const btn = e.currentTarget;
                  const result = onBuyFromBlackMarket(selectedBoot, useLawyers);
                  setBlackMarketMessage(result.ok ? "Bought — nobody official noticed. This time." : (result.reason ?? "Failed"));
                  if (result.ok) reward(blackMarketPrice(selectedBoot.price) + (useLawyers ? LAWYER_FEE : 0), btn, bootRef.current, <span className="text-[34px]">👟</span>, "#f87171", "boot");
                }}
                className="w-full rounded-xl py-3 font-black"
              >
                Buy from shady guys — ★{formatMoney(blackMarketPrice(selectedBoot.price))}
              </PressButton>
              {blackMarketMessage && (
                <div className="mt-2 text-center text-[10px] font-bold text-white/85">{blackMarketMessage}</div>
              )}
            </div>
          ) : (
            <PressButton
              variant="primary"
              size="none"
              pulse={!!selectedBoot && career.money >= selectedBoot.price}
              disabled={!selectedBoot || career.money < selectedBoot.price}
              onClick={(e) => {
                if (!selectedBoot || career.money < selectedBoot.price) return;
                reward(selectedBoot.price, e.currentTarget, bootRef.current, <span className="text-[34px]">👟</span>, "#34d399", "boot");
                onBuyBoot(selectedBoot);
              }}
              className="relative mt-3 flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl py-3 text-[14px] font-black"
            >
              <Shine loop every={4.5} />
              Buy {selectedBoot?.name} L{selectedBoot?.level ?? 1} — ★{formatMoney(selectedBoot?.price ?? 0)}
            </PressButton>
          )}
        </>
      )}

      {kind === "lifestyle" && (
        <>
          <div className="mb-2 grid grid-cols-3 gap-1 rounded-2xl bg-black/35 p-1 ring-1 ring-white/[0.06]">
            {(["item", "vehicle", "property"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`kib-press rounded-xl py-2 text-xs font-black uppercase tracking-wide transition ${tab === t ? "bg-gradient-to-b from-emerald-300 to-emerald-600 text-emerald-950" : "text-white/75"}`}
                style={tab === t ? { boxShadow: "inset 0 1px 0 rgba(255,255,255,.5), 0 4px 10px -3px rgba(16,185,129,.7)" } : undefined}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="mb-2 text-[11px] font-bold text-white/85">
            Every item comes in 5 levels. Level 1 is priced for National League money, level 5 for the Premier League. A higher level adds more fame, and replaces the one you own.
          </div>
          <ClubCard glow="#d946ef" className="rounded-2xl">
            {Array.from(new Set(LIFESTYLE_ALL_LEVELS.filter((i) => i.category === tab).map((i) => baseIdOf(i)))).map((base) => {
              const levels = LIFESTYLE_ALL_LEVELS.filter((i) => baseIdOf(i) === base).sort((a, b) => (a.level ?? 0) - (b.level ?? 0));
              const first = levels[0];
              const mine = career.ownedItems.find((o) => baseIdOf(o) === base);
              const mineLevel = mine ? (mine.level ?? levels.find((l) => l.id === mine.id)?.level ?? 0) : 0;
              const worn = !!mine && isWornOut(mine);
              return (
                <div key={base} className="relative border-b border-white/[0.06] px-2.5 py-2" ref={(el) => { itemRefs.current[base] = el; }}>
                  {landKey === base && <Burst trigger={landed} colors={[landColor, "#fde047", "#ffffff"]} count={16} spread={0.7} round className="left-7 top-6" />}
                  <div className="flex items-center gap-2">
                    <div className="overflow-hidden rounded-lg shadow-lg ring-1 ring-white/10"><LifestyleIcon id={base} category={first.category} /></div>
                    <div className="flex-1 text-sm font-black text-white">{first.name}</div>
                    {mine && !worn && <Pop value={mineLevel}><span className="rounded-full bg-emerald-400/20 px-2 py-0.5 text-[10px] font-black text-emerald-300 ring-1 ring-emerald-300/30">OWNED L{mineLevel || "?"}</span></Pop>}
                    {worn && <div className="rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] font-black text-red-300">WORN OUT</div>}
                  </div>
                  <div className="mt-1.5 grid grid-cols-5 gap-1">
                    {levels.map((i) => {
                      const on = selectedItem?.id === i.id;
                      const have = !!mine && !worn && mineLevel === i.level;
                      return (
                        <button
                          key={i.id}
                          onClick={() => setSelectedItem(i)}
                          className={`kib-press rounded-lg py-1.5 text-center ${on ? "bg-gradient-to-b from-emerald-300 to-emerald-600 text-emerald-950" : have ? "bg-emerald-900/80 text-white ring-1 ring-emerald-400" : "bg-white/[0.07] text-white ring-1 ring-white/[0.07]"}`}
                          style={on ? { boxShadow: "inset 0 1px 0 rgba(255,255,255,.5), 0 4px 10px -3px rgba(16,185,129,.7)" } : undefined}
                        >
                          <div className="text-[10px] font-black">L{i.level}{have ? " ✓" : ""}</div>
                          <div className={`text-[9px] font-bold ${on ? "text-emerald-950" : "text-yellow-300"}`}>{formatMoney(i.price)}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </ClubCard>
          {selectedItem && (() => {
            const base = baseIdOf(selectedItem);
            const mine = career.ownedItems.find((o) => baseIdOf(o) === base);
            const mineLevel = mine ? (mine.level ?? LIFESTYLE_ALL_LEVELS.find((l) => l.id === mine.id)?.level ?? 0) : 0;
            const worn = !!mine && isWornOut(mine);
            const blocked = !!mine && !worn && (selectedItem.level ?? 0) <= mineLevel;
            const gain = fameGainFromBuying(career.ownedItems, selectedItem);
            const life = itemLifeSeasons(selectedItem);
            const canBuy = !blocked && career.money >= selectedItem.price;
            return (
              <>
                <ClubCard glow="#f59e0b" className="mt-2 flex items-center justify-between rounded-2xl p-3">
                  <div className="text-left">
                    <div className="text-[12px] font-black text-white">{selectedItem.name} · Level {selectedItem.level ?? 1}</div>
                    <div className="text-[10.5px] font-bold text-amber-300">
                      +{gain < 1 ? gain.toFixed(1) : Math.round(gain)} fame
                      <span className="text-white"> · {life === null ? "lasts forever" : `lasts ${life} season${life === 1 ? "" : "s"}`}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[15px] font-black text-yellow-300">★{formatMoney(selectedItem.price)}</div>
                    <Weeks price={selectedItem.price} wage={career.contract.wage} />
                  </div>
                </ClubCard>
                <PressButton
                  variant="primary"
                  size="none"
                  pulse={canBuy}
                  disabled={blocked || career.money < selectedItem.price}
                  onClick={(e) => {
                    if (!canBuy) return;
                    reward(selectedItem.price, e.currentTarget, itemRefs.current[base] ?? null, <LifestyleIcon id={base} category={selectedItem.category} />, "#f0abfc", base);
                    onBuyItem(selectedItem);
                  }}
                  className="relative mt-2 w-full overflow-hidden rounded-2xl py-3 text-[14px] font-black"
                >
                  {canBuy && <Shine loop every={4.5} />}
                  {blocked ? `You own level ${mineLevel}` : `${mine && !worn ? "Upgrade to" : "Buy"} ${selectedItem.name} L${selectedItem.level ?? 1} — ★${formatMoney(selectedItem.price)}`}
                </PressButton>
              </>
            );
          })()}
        </>
      )}
    </ScreenShell>
  );
}
