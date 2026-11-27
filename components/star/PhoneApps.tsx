"use client";

/**
 * THE PHONE'S OWN APPS, DRAWN INSIDE THE PHONE (Harry, 27 Nov 2026, after
 * the 3D phone on his iPhone: "really good, but each app has to work natively
 * inside the phone, not just taking you to a screen").
 *
 * PhoneHome opens these inside the glass when it is given `apps` (the game's
 * 3D phone, HousePhone.tsx). Without `apps` (the flat phone), these apps leave
 * the phone for their screens, as before.
 *
 * Per app (the decision; one line each):
 *   Sponsors  — all inside: what they pay, every offer with Sign / Decline,
 *               every deal. Haggling ("More money", longer, easier) and the
 *               advert shoot are their own screens: "Open full screen".
 *   Shop      — the cans inside (buy one, drink one); your boots and the rest
 *               of the shop are a summary with "Open full screen".
 *   Store     — today's specials inside, bought with £ by the Store's own
 *               rules (lib/star/store/career.ts); the rest: "Open full screen".
 *   Casino    — a summary (bank, your horse, a ban); the games are full screen.
 *   Owner     — a summary (reputation, fame, every stake and its value);
 *               the boardroom is full screen.
 *   Garden    — a place: what is there, and "Go to the garden".
 *   Your house— you are in it: what you own, and "Put the phone down".
 *   Settings  — the quick switches inside (the same rows as Settings);
 *               "All settings" for the rest.
 * Nothing here has its own rules: every number and every button runs the
 * same functions and page handlers as the full screens.
 *
 * Text is bigger than the full screens' (the glass is drawn at about 0.6 of
 * its size on the hand picture): body 14 px, numbers 20+ px, buttons 44 px tall.
 */
import { useEffect, useState } from "react";
import type { CareerState } from "@/lib/star/types";
import {
  brandsOf, slotsFor, weeklySponsorTotal, targetLabel, moodOf, BRAND_CATEGORIES, OFFER_WEEKS,
  type BrandOffer,
} from "@/lib/star/sponsorDeals";
import { KIB_CANS, kibCanPrice, kibCanEffectLabel, type KibCan } from "@/lib/star/shopData";
import { formatMoneyPrecise as formatMoney, formatWallet, MONEY_SIGN } from "@/lib/star/money";
import { fameOf, fameLevel } from "@/lib/star/fame";
import { reputationLabel } from "@/lib/star/reputation";
import { MAJORITY_THRESHOLD, clubValuation } from "@/lib/star/investments";
import { casinoBanned, casinoBanWeeksLeft } from "@/lib/star/casinoScandal";
import { dailySpecials, dateKeyFor, msUntilReset, formatCountdown } from "@/lib/star/store/daily";
import { findItem } from "@/lib/star/store/catalogue";
import { priceNow } from "@/lib/star/store/purchase";
import { careerStoreState, careerPriceContext, careerStoreBuy, shownInCareer } from "@/lib/star/store/career";
import { homeNameOf } from "@/lib/star/home3d/homes";
import { carsOnDrive } from "@/lib/star/home3d/outfits";
import { CLUB_SHORT_NAMES } from "@/lib/star/clubs";
import type { SponsorActions } from "./SponsorsScreen";
import type { HubPhase } from "./HomeHub";
import { QuickSwitches } from "./DeviceSettings";
import ClubBadge from "./ClubBadge";
import { kitsOf } from "@/lib/star/kits";

/** The apps that leave the phone without `apps`, and open inside it with them. */
export type NativeApp = "sponsors" | "shop-kib" | "store" | "casino-menu" | "ownership" | "garden" | "home-3d" | "settings";
export const NATIVE_APPS: ReadonlySet<string> = new Set<NativeApp>(["sponsors", "shop-kib", "store", "casino-menu", "ownership", "garden", "home-3d", "settings"]);

/** The page's own handlers, the same ones the full screens get. */
export interface PhoneAppActions {
  sponsors: SponsorActions;
  onBuyKib: (can: KibCan) => void;
  onUseCan: (id: KibCan["id"]) => void;
  /** The career after a Store purchase (the Store's own rules, lib/star/store/career.ts). */
  onCareer: (next: CareerState) => void;
}

const short = (club: string) => CLUB_SHORT_NAMES[club] ?? club.replace(/\s+(FC|AFC)$/i, "");
const money = (n: number) => `${MONEY_SIGN}${formatMoney(Math.round(n))}`;

// ── the shared pieces ───────────────────────────────────────────────────────

function Scroll({ children, ...rest }: { children: React.ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className="kib-noscroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-3 pt-2.5" style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-y" }} {...rest}>
      <div className="space-y-2.5">{children}</div>
    </div>
  );
}

function Card({ children, tone = "rgba(255,255,255,.08)", className = "" }: { children: React.ReactNode; tone?: string; className?: string }) {
  return <div className={`rounded-2xl p-3 ${className}`} style={{ background: tone, boxShadow: "inset 0 1px 0 rgba(255,255,255,.12), inset 0 0 0 1px rgba(255,255,255,.06)" }}>{children}</div>;
}

function Kicker({ children, tone = "text-emerald-300" }: { children: React.ReactNode; tone?: string }) {
  return <div className={`text-[11px] font-black uppercase tracking-[0.16em] ${tone}`}>{children}</div>;
}

function Big({ children, tone = "text-yellow-300" }: { children: React.ReactNode; tone?: string }) {
  return <div className={`text-[26px] font-black leading-none tabular-nums ${tone}`}>{children}</div>;
}

function Line({ label, value, gold = false }: { label: string; value: React.ReactNode; gold?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-white/10 py-1.5 last:border-0">
      <span className="shrink-0 text-[13px] font-bold text-white/80">{label}</span>
      <span className={`min-w-0 text-right text-[14px] font-black ${gold ? "text-yellow-300" : "text-white"}`}>{value}</span>
    </div>
  );
}

function Btn({ children, onClick, tone = "green", disabled = false, ...rest }: {
  children: React.ReactNode; onClick: () => void; tone?: "green" | "grey" | "gold"; disabled?: boolean;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onClick">) {
  const bg = tone === "green" ? "linear-gradient(180deg,#34d399,#059669)" : tone === "gold" ? "linear-gradient(180deg,#fcd34d,#d97706)" : "rgba(255,255,255,.14)";
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={`kib-press min-h-[44px] w-full rounded-xl px-3 text-[14px] font-black ${tone === "gold" ? "text-gray-950" : "text-white"} disabled:opacity-40`}
      style={{ background: bg, boxShadow: "inset 0 1px 0 rgba(255,255,255,.3), 0 4px 10px -4px rgba(0,0,0,.7)" }} {...rest}>
      {children}
    </button>
  );
}

/** The way out to a screen too big for the phone: always a button you press, never a jump. */
export function OpenFull({ label = "Open full screen", onClick }: { label?: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} data-phone-open-full
      className="kib-press flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl text-[14px] font-black text-white"
      style={{ background: "rgba(56,189,248,.18)", boxShadow: "inset 0 0 0 1.5px rgba(56,189,248,.7)" }}>
      {label} <span aria-hidden>↗</span>
    </button>
  );
}

function Empty({ icon, title, text }: { icon: string; title: string; text: string }) {
  return (
    <Card className="text-center">
      <div className="text-[30px]">{icon}</div>
      <div className="mt-1 text-[16px] font-black text-white">{title}</div>
      <div className="mt-1 text-[13px] font-bold leading-snug text-white/80">{text}</div>
    </Card>
  );
}

// ── the apps ────────────────────────────────────────────────────────────────

export default function PhoneAppView({ id, career, act, onFull, onPutDown, glow }: {
  id: NativeApp;
  career: CareerState;
  act: PhoneAppActions;
  /** "Open full screen": the app's real screen. */
  onFull: (to: HubPhase | "settings") => void;
  /** Your house: put the phone down (you are already in the house). */
  onPutDown?: () => void;
  glow: string;
}) {
  switch (id) {
    case "sponsors": return <SponsorsApp career={career} act={act.sponsors} onFull={() => onFull("sponsors")} />;
    case "shop-kib": return <ShopApp career={career} act={act} onFull={onFull} />;
    case "store": return <StoreApp career={career} onCareer={act.onCareer} onFull={() => onFull("store")} />;
    case "casino-menu": return <CasinoApp career={career} onFull={() => onFull("casino-menu")} />;
    case "ownership": return <OwnerApp career={career} onFull={() => onFull("ownership")} />;
    case "garden": return <GardenApp career={career} onFull={() => onFull("garden")} />;
    case "home-3d": return <HouseApp career={career} onPutDown={onPutDown} onFull={() => onFull("home-3d")} />;
    case "settings": return <SettingsApp glow={glow} onFull={() => onFull("settings")} />;
  }
}

/** SPONSORS: all inside (SponsorsScreen.tsx's numbers and buttons). */
function SponsorsApp({ career, act, onFull }: { career: CareerState; act: SponsorActions; onFull: () => void }) {
  const b = brandsOf(career);
  const slots = slotsFor(career);
  const icon = (cat: string) => BRAND_CATEGORIES.find((c) => c.category === cat)?.icon ?? "🤝";
  return (
    <Scroll data-phone-app="sponsors">
      <Card tone="rgba(16,185,129,.16)">
        <Kicker>Sponsor money</Kicker>
        <div className="mt-1 flex items-end justify-between">
          <Big>{money(weeklySponsorTotal(career))}</Big>
          <span className="text-[13px] font-black text-white">{slots === 0 ? "No slot yet" : `${b.deals.length} of ${slots} slots`}</span>
        </div>
        <div className="mt-1 text-[12px] font-bold text-white/75">a week, paid with your wage</div>
      </Card>

      <Kicker tone="text-amber-300">Offers{b.offers.length ? ` (${b.offers.length})` : ""}</Kicker>
      {b.offers.length === 0 && <Empty icon="📱" title="No offers right now" text="Play well and brands send offers here. Each one lasts two weeks." />}
      {b.offers.map((o) => <Offer key={o.id} o={o} career={career} act={act} icon={icon(o.category)} />)}

      <Kicker tone="text-yellow-300">Your deals{b.deals.length ? ` (${b.deals.length})` : ""}</Kicker>
      {b.deals.length === 0 && <Empty icon="🤝" title="No deals yet" text={slots === 0 ? "Brands notice you once you are a Local Name." : "Sign an offer to start a deal."} />}
      {b.deals.map((d) => (
        <Card key={d.id} tone={`linear-gradient(160deg, ${d.color}33, rgba(255,255,255,.05))`}>
          <div className="flex items-center gap-2.5">
            <span className="text-[24px]">{icon(d.category)}</span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[16px] font-black text-white">{d.brand}</div>
              <div className="text-[12px] font-bold text-white/75">{d.category} · {d.seasonsLeft} season{d.seasonsLeft === 1 ? "" : "s"} left</div>
            </div>
            <div className="text-right">
              <div className="text-[15px] font-black text-yellow-300">{money(d.weekly)}</div>
              <div className="text-[11px] font-bold text-white/70">a week {({ happy: "😊", neutral: "😐", angry: "😠" } as const)[moodOf(d.happiness)]}</div>
            </div>
          </div>
          {d.targets.filter((t) => !t.done).slice(0, 2).map((t, i) => (
            <div key={i} className="mt-1.5 text-[12px] font-bold text-white/85">🎯 {targetLabel(t)} · {t.progress}/{t.target}</div>
          ))}
        </Card>
      ))}
      {b.news.length > 0 && (
        <Card>
          <Kicker tone="text-sky-300">Latest</Kicker>
          {b.news.slice(0, 3).map((n, i) => <div key={i} className="mt-1 text-[13px] font-bold leading-snug text-white">• {n}</div>)}
        </Card>
      )}
      <OpenFull label="Haggle, adverts, every brand" onClick={onFull} />
    </Scroll>
  );
}

function Offer({ o, career, act, icon }: { o: BrandOffer; career: CareerState; act: SponsorActions; icon: string }) {
  const b = brandsOf(career);
  const left = o.expires.season > career.season ? OFFER_WEEKS : Math.max(0, o.expires.week - career.week);
  const noSlot = o.kind !== "milestone" && !o.replaces && b.deals.length >= slotsFor(career);
  return (
    <Card tone={`linear-gradient(160deg, ${o.color}44, rgba(255,255,255,.06))`}>
      <div className="flex items-center gap-2.5">
        <span className="text-[24px]">{icon}</span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[16px] font-black text-white">{o.brand}</div>
          <div className="text-[12px] font-bold text-white/75">{o.category} · ⏳ {left === 0 ? "last week" : `${left} wk left`}</div>
        </div>
      </div>
      <div className="mt-2">
        {o.kind === "milestone"
          ? <Line label="They pay you" value={money(o.signingOn)} gold />
          : (<>
            <Line label="A week" value={money(o.weekly)} gold />
            <Line label="Length" value={`${o.seasons} season${o.seasons === 1 ? "" : "s"}`} />
            <Line label="On signing" value={money(o.signingOn)} />
          </>)}
      </div>
      {noSlot && <div className="mt-1.5 text-[12px] font-black text-amber-300">No free deal slot yet.</div>}
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Btn onClick={() => act.onSign(o.id)} disabled={noSlot} data-phone-sign={o.id}>{o.kind === "milestone" ? "Do the advert" : "Sign"}</Btn>
        <Btn tone="grey" onClick={() => act.onDecline(o.id)}>Decline</Btn>
      </div>
    </Card>
  );
}

/** SHOP: the cans inside; the rest of the shop as a summary. */
function ShopApp({ career, act, onFull }: { career: CareerState; act: PhoneAppActions; onFull: (to: HubPhase) => void }) {
  const wage = career.contract.wage;
  const boot = career.currentBoot;
  const style = career.ownedItems.length;
  return (
    <Scroll data-phone-app="shop">
      <Card tone="rgba(251,146,60,.16)">
        <Kicker tone="text-orange-200">In the bank</Kicker>
        <div className="mt-1 flex items-end justify-between">
          <Big>{MONEY_SIGN}{formatWallet(career.money)}</Big>
          <span className="text-[13px] font-black text-white">⚡ {Math.round(career.energy)} energy</span>
        </div>
      </Card>
      <Kicker tone="text-amber-300">KIB cans</Kicker>
      {KIB_CANS.map((can) => {
        const price = kibCanPrice(can, wage);
        const have = career.kibCans[can.id] ?? 0;
        const useless = (can.effect && career.kibAbility?.[can.effect]) || (!can.effect && career.energy >= 100);
        return (
          <Card key={can.id}>
            <div className="flex items-center gap-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {can.image ? <img src={can.image} alt="" className="h-12 w-9 shrink-0 object-contain" draggable={false} />
                : <span className={`grid h-12 w-9 shrink-0 place-items-center rounded-md text-[16px] ${can.color}`}>🥫</span>}
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-black text-white">{can.name} <span className="text-white/60">× {have}</span></div>
                <div className="text-[12px] font-bold leading-snug text-white/80">{kibCanEffectLabel(can)}</div>
              </div>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Btn tone="gold" onClick={() => act.onBuyKib(can)} disabled={career.money < price} data-phone-buy-can={can.id}>Buy {money(price)}</Btn>
              <Btn onClick={() => act.onUseCan(can.id)} disabled={have === 0 || !!useless}>Drink</Btn>
            </div>
          </Card>
        );
      })}
      <Kicker tone="text-sky-300">The rest of the shop</Kicker>
      <Card>
        <Line label="Your boots" value={`${boot.name}${boot.matches ? ` · ${boot.matches} games` : ""}`} />
        <Line label="Style you own" value={`${style} item${style === 1 ? "" : "s"}`} />
      </Card>
      <OpenFull label="Boots" onClick={() => onFull("shop-boots")} />
      <OpenFull label="Drip, gadgets, cars, homes" onClick={() => onFull("shop-lifestyle")} />
    </Scroll>
  );
}

/** STORE: today's specials, bought with £ by the Store's own rules. */
function StoreApp({ career, onCareer, onFull }: { career: CareerState; onCareer: (c: CareerState) => void; onFull: () => void }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = window.setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(t); }, []);
  const [note, setNote] = useState<string | null>(null);
  const dateKey = dateKeyFor(now);
  const state = careerStoreState(career);
  const ctx = careerPriceContext(career);
  const specials = dailySpecials(dateKey).map((s) => ({ s, item: findItem(s.itemId) })).filter((x) => x.item && shownInCareer(x.item, career));
  return (
    <Scroll data-phone-app="store">
      <Card tone="rgba(124,58,237,.2)">
        <div className="flex items-end justify-between">
          <div><Kicker tone="text-violet-200">Money</Kicker><Big>{MONEY_SIGN}{formatWallet(career.money)}</Big></div>
          <div className="text-right"><Kicker tone="text-violet-200">Coins</Kicker><Big tone="text-white">🪙 {state.coins}</Big></div>
        </div>
      </Card>
      <div className="flex items-baseline justify-between">
        <Kicker tone="text-amber-300">Today&apos;s specials</Kicker>
        <span className="text-[12px] font-black text-white/70">new in {formatCountdown(msUntilReset(now))}</span>
      </div>
      {note && <div className="rounded-xl bg-black/50 px-3 py-2 text-center text-[13px] font-black text-white">{note}</div>}
      {specials.map(({ s, item }) => {
        const it = item!;
        const name = it.kind === "boot" ? it.boot.name : it.name;
        const p = priceNow(it, ctx, state, dateKey);
        const owned = it.kind !== "boost" && state.owned.includes(it.id);
        return (
          <Card key={s.itemId} tone={s.featured ? "rgba(251,191,36,.16)" : undefined}>
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate text-[15px] font-black text-white">{name}</div>
                <div className="text-[12px] font-bold text-white/75">{p.percentOff > 0 ? `${p.percentOff}% off · was ${money(p.full.stars)}` : "Bought today"}</div>
              </div>
              <span className="shrink-0 text-[16px] font-black text-yellow-300">{money(p.price.stars)}</span>
            </div>
            <div className="mt-2">
              <Btn tone="gold" disabled={owned || career.money < p.price.stars} onClick={() => {
                const r = careerStoreBuy(career, it.id, "stars", dateKey, Date.now());
                if (r.ok) { onCareer(r.career); setNote(`Bought: ${name}`); } else setNote(r.reason ?? "Not bought.");
              }}>{owned ? "Yours" : "Buy"}</Btn>
            </div>
          </Card>
        );
      })}
      <OpenFull label="Run-ups, kit, coins" onClick={onFull} />
    </Scroll>
  );
}

/** CASINO: a summary; the games are their own screens. */
function CasinoApp({ career, onFull }: { career: CareerState; onFull: () => void }) {
  const banned = casinoBanned(career);
  const h = career.horse;
  return (
    <Scroll data-phone-app="casino">
      <Card tone="rgba(220,38,38,.18)">
        <Kicker tone="text-yellow-200">Your bank</Kicker>
        <Big>{MONEY_SIGN}{formatWallet(career.money)}</Big>
      </Card>
      {banned
        ? <Empty icon="🚫" title="You are banned" text={`After the stories in the papers, the doors are locked for ${casinoBanWeeksLeft(career)} more weeks.`} />
        : <Card><div className="text-[14px] font-bold leading-snug text-white">Blackjack, roulette, slots and the horses. Every game is played full screen.</div></Card>}
      <Card>
        <Kicker tone="text-amber-300">Your horse</Kicker>
        {h ? (<>
          <div className="mt-1 text-[16px] font-black text-white">🐎 {h.name}</div>
          <Line label="Races" value={`${h.racesWon} won of ${h.racesRun}`} />
          <Line label="Prize money" value={money(h.earnings)} gold />
          <Line label="Energy" value={`${Math.round(h.energy)}`} />
        </>) : <div className="mt-1 text-[13px] font-bold text-white/80">No horse yet. Buy one at the races.</div>}
      </Card>
      {!banned && <OpenFull label="Open the casino" onClick={onFull} />}
    </Scroll>
  );
}

/** OWNER: a summary of your stakes; the boardroom is its own screen. */
function OwnerApp({ career, onFull }: { career: CareerState; onFull: () => void }) {
  const owned = (career.investments ?? []).filter((i) => i.percent > 0).sort((a, b) => b.percent - a.percent);
  const rows = owned.map((s) => ({ s, value: Math.round(clubValuation(s.club, career) * (s.percent / 100)) }));
  const total = rows.reduce((n, r) => n + r.value, 0);
  const fame = fameOf(career);
  return (
    <Scroll data-phone-app="owner">
      <Card tone="rgba(99,102,241,.2)">
        <Kicker tone="text-indigo-200">Your stakes are worth</Kicker>
        <Big>{money(total)}</Big>
      </Card>
      <Card>
        <Line label="Reputation" value={`${career.reputation} · ${reputationLabel(career.reputation)}`} />
        <Line label="Fame" value={`${fame} · ${fameLevel(fame).name}`} />
      </Card>
      <Kicker tone="text-amber-300">Your clubs{rows.length ? ` (${rows.length})` : ""}</Kicker>
      {rows.length === 0 && <Empty icon="🏛️" title="No stakes yet" text="Buy a share of a club in the market." />}
      {rows.map(({ s, value }) => (
        <Card key={s.club}>
          <div className="flex items-center gap-2.5">
            <ClubBadge club={s.club} kit={kitsOf(s.club, career.clubKits?.[s.club]).home} size={30} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[15px] font-black text-white">{short(s.club)}</div>
              <div className="text-[12px] font-bold text-white/75">{s.percent.toFixed(1)}%{s.percent >= MAJORITY_THRESHOLD ? " · you run it 👑" : ""}</div>
            </div>
            <span className="text-[14px] font-black text-yellow-300">{money(value)}</span>
          </div>
        </Card>
      ))}
      <OpenFull label="Market, boardroom, rule book" onClick={onFull} />
    </Scroll>
  );
}

/** GARDEN: a place, not a screen. */
function GardenApp({ career, onFull }: { career: CareerState; onFull: () => void }) {
  return (
    <Scroll data-phone-app="garden">
      <Card tone="rgba(34,197,94,.18)">
        <div className="text-[30px]">🌳</div>
        <div className="mt-1 text-[17px] font-black text-white">Your garden</div>
        <div className="mt-1 text-[13px] font-bold leading-snug text-white/85">Walk round in 3D. The doors lead to:</div>
      </Card>
      <Card>
        <Line label="🛍️ The shop" value="Look round" />
        <Line label="⚽ Training pitch" value="Crossbar challenge" />
        <Line label="🏠 Your house" value={homeNameOf(career.ownedItems)} />
        {career.horse && <Line label="🐎 Paddock" value={career.horse.name} />}
      </Card>
      <OpenFull label="Go to the garden" onClick={onFull} />
    </Scroll>
  );
}

/** YOUR HOUSE: you are already in it, behind the phone. */
function HouseApp({ career, onPutDown, onFull }: { career: CareerState; onPutDown?: () => void; onFull: () => void }) {
  const cars = carsOnDrive(career, 99).length;
  return (
    <Scroll data-phone-app="house">
      <Card tone="rgba(245,158,11,.18)">
        <div className="text-[30px]">🏠</div>
        <div className="mt-1 text-[17px] font-black text-white">{homeNameOf(career.ownedItems)}</div>
        <div className="mt-1 text-[13px] font-bold leading-snug text-white/85">{onPutDown ? "You are at home. Put the phone down to walk round." : "Walk round your home in 3D."}</div>
      </Card>
      <Card>
        <Line label="Trophies in the cabinet" value={`${career.trophies.length}`} />
        <Line label="Cars on the drive" value={`${cars}`} />
        <Line label="Wardrobe" value="Change your clothes" />
      </Card>
      {onPutDown ? <Btn onClick={onPutDown}>Put the phone down</Btn> : <OpenFull label="Go home" onClick={onFull} />}
    </Scroll>
  );
}

/** SETTINGS: the first card of Settings, inside the phone. */
function SettingsApp({ glow, onFull }: { glow: string; onFull: () => void }) {
  return (
    <Scroll data-phone-app="settings">
      <QuickSwitches glow={glow} />
      <OpenFull label="All settings" onClick={onFull} />
    </Scroll>
  );
}
