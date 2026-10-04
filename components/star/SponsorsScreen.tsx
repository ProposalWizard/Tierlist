"use client";

/**
 * SPONSORS — your deals, the offers on your phone, and every kind of brand
 * (Mikey, 30 Sep 2026; rules in lib/star/sponsorDeals.ts). Built in the
 * Home-screen look: club-lit cards, each brand glowing in its own colour,
 * glowing bars, bold white text.
 */
import { useState } from "react";
import type { CareerState } from "@/lib/star/types";
import {
  brandsOf, slotsFor, weeklySponsorTotal, targetLabel, moodOf, categoryStatus, BRAND_CATEGORIES, fameNeeded,
  BOOT_DEAL_DISCOUNT, OFFER_WEEKS, type BrandDeal, type BrandOffer, type BrandTarget,
} from "@/lib/star/sponsorDeals";
import { fameOf, fameLevel, FAME_LEVELS } from "@/lib/star/fame";
import { formatMoneyPrecise as formatMoney } from "@/lib/star/money";
import { ClubCard, PressButton, Shine, StatBar, clubTheme, rgba } from "./ui";
import { Screen, ScreenHeader } from "./ui/Screen";
import { SegTabs, CardTitle } from "./screenKit";

type Tab = "deals" | "offers" | "brands";

export interface SponsorActions {
  onSign: (offerId: string) => void;
  onDecline: (offerId: string) => void;
  onNegotiate: (offerId: string) => void;
  onAskLonger: (offerId: string) => void;
  onAskEasier: (offerId: string) => void;
  onCounter: (offerId: string) => void;
  onWalkAway: (dealId: string) => void;
  /** Shoot an advert for this brand (once a week; raises its happiness). */
  onAdvert?: (dealId: string) => void;
  /** Already shot this week. */
  advertDone?: boolean;
}

const FACE = { happy: "😊", neutral: "😐", angry: "😠" } as const;
const MOOD_TEXT = { happy: "Happy — will offer a renewal with a raise", neutral: "On the fence — could go either way", angry: "Unhappy — will not renew" } as const;
const iconOf = (category: string) => BRAND_CATEGORIES.find(c => c.category === category)?.icon ?? "🤝";
const seasonsText = (n: number) => `${n} season${n === 1 ? "" : "s"}`;
const CLAUSE = {
  exclusive: (cat: string) => `Exclusive: no other ${cat.toLowerCase()} brand`,
  behaviour: () => "Behaviour clause: a scandal ends the deal",
};

/** How far you are towards a fame level, 0-100 — a bar, never the number
 *  (Harry, 30 Sep 2026: "I don't like the idea that we tell them exact
 *  amounts that are needed… I'd rather a progress bar"). */
function towards(fame: number, target: number): number {
  return Math.max(0, Math.min(100, (fame / Math.max(1, target)) * 100));
}
const FAME_BAR: [string, string] = ["#fbbf24", "#fde68a"];

function brandStyle(color: string, strength = 0.3): React.CSSProperties {
  return {
    background: `radial-gradient(120% 130% at 0% 0%, ${rgba(color, strength)}, transparent 60%), var(--sk-card, linear-gradient(180deg, rgba(31,41,55,.94), rgba(10,14,24,.97)))`,
    boxShadow: `inset 0 1px 0 rgba(255,255,255,.12), inset 0 0 0 1px ${rgba(color, 0.45)}, 0 0 22px -8px ${rgba(color, 0.6)}`,
  };
}

function BrandMark({ category, color }: { category: string; color: string }) {
  return (
    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-[22px]"
      style={{ background: `linear-gradient(160deg, ${rgba(color, 0.6)}, ${rgba(color, 0.15)})`, boxShadow: `inset 0 1px 0 rgba(255,255,255,.35), 0 0 12px ${rgba(color, 0.5)}` }}>
      {iconOf(category)}
    </div>
  );
}

function TargetRow({ t, color }: { t: BrandTarget; color: string }) {
  const judgedLater = t.kind === "rating" || t.kind === "promotion";
  const pct = t.done ? 100 : judgedLater ? 0 : Math.min(100, (t.progress / Math.max(1, t.target)) * 100);
  return (
    <div className="mt-2">
      <div className="flex items-center justify-between gap-2 text-[11.5px] font-black text-white">
        <span className="min-w-0">{t.done ? "✓ " : ""}{targetLabel(t)}</span>
        <span className="shrink-0 tabular-nums">{t.done ? "Done" : judgedLater ? "End of season" : `${t.progress} / ${t.target}`}</span>
      </div>
      <StatBar value={pct} colors={t.done ? ["#34d399", "#a7f3d0"] : [color, "#ffffff"]} className="mt-1 h-2.5" sheen={false} />
      <div className="mt-0.5 text-[10.5px] font-bold text-white">Bonus ★{formatMoney(t.bonus)}{t.done ? " — paid" : ""}</div>
    </div>
  );
}

function DealCard({ d, money, onWalkAway, onAdvert, advertDone }: { d: BrandDeal; money: number; onWalkAway: (id: string) => void; onAdvert?: (id: string) => void; advertDone?: boolean }) {
  const [confirm, setConfirm] = useState(false);
  const mood = moodOf(d.happiness);
  return (
    <div className="kit-rise relative overflow-hidden rounded-2xl p-3" style={brandStyle(d.color)}>
      <Shine loop every={7} />
      <div className="relative flex items-center gap-3">
        <BrandMark category={d.category} color={d.color} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[17px] font-black leading-tight text-white">{d.brand}</div>
          <div className="text-[11px] font-bold text-white">{d.category} · {seasonsText(d.seasonsLeft)} left</div>
        </div>
        <div className="text-right">
          <div className="text-[18px] font-black leading-none text-yellow-300" style={{ textShadow: "0 0 10px rgba(251,191,36,.5)" }}>★{formatMoney(d.weekly)}</div>
          <div className="text-[9.5px] font-black uppercase tracking-wider text-white">a week</div>
        </div>
      </div>
      {d.targets.map((t, i) => <TargetRow key={i} t={t} color={d.color} />)}
      <div className="relative mt-2.5 flex items-center gap-2 rounded-xl bg-black/30 p-2">
        <span className="text-[22px] leading-none">{FACE[mood]}</span>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-black text-white">{MOOD_TEXT[mood]}</div>
          <StatBar value={d.happiness} colors={mood === "happy" ? ["#34d399", "#a7f3d0"] : mood === "neutral" ? ["#fbbf24", "#fde68a"] : ["#f87171", "#fecaca"]} className="mt-1 h-2" sheen={false} />
        </div>
      </div>
      {onAdvert && (
        <button onClick={() => onAdvert(d.id)} disabled={advertDone} data-advert={d.id} className="kib-press relative mt-2 w-full rounded-xl bg-black/35 py-2 text-[12px] font-black uppercase tracking-wide text-white ring-1 ring-white/30 disabled:opacity-45">
          {advertDone ? "🎬 Advert shot this week" : "🎬 Shoot an advert · 1 day"}
        </button>
      )}
      {d.clause && <div className="relative mt-2 text-[10.5px] font-bold text-white">📎 {d.clause === "exclusive" ? CLAUSE.exclusive(d.category) : CLAUSE.behaviour()}</div>}
      {d.category === "Boots" && <div className="relative mt-1 text-[10.5px] font-black text-emerald-300">👟 {Math.round(BOOT_DEAL_DISCOUNT * 100)}% off every pair of boots in the shop</div>}
      {!confirm ? (
        <button onClick={() => setConfirm(true)} className="kib-press relative mt-2 text-[10.5px] font-black uppercase tracking-wider text-white underline">Walk away early</button>
      ) : (
        <div className="relative mt-2 rounded-xl border border-red-400/70 bg-red-500/15 p-2">
          <div className="text-[11.5px] font-bold text-white">Leaving early means paying the deal&rsquo;s whole guaranteed value: <b>★{formatMoney(d.guaranteed)}</b>.{money < d.guaranteed ? " You can't afford it." : ""}</div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <PressButton variant="danger" size="none" disabled={money < d.guaranteed} onClick={() => onWalkAway(d.id)} className="rounded-lg py-2 text-[11px] font-black">Pay and leave</PressButton>
            <PressButton variant="secondary" size="none" onClick={() => setConfirm(false)} className="rounded-lg py-2 text-[11px] font-black">Keep the deal</PressButton>
          </div>
        </div>
      )}
    </div>
  );
}

const KIND_LABEL: Record<BrandOffer["kind"], string> = { new: "New offer", bid: "Bidding war", poach: "Buy-out offer", renewal: "Renewal", milestone: "One-off advert" };

function OfferCard({ o, career, act }: { o: BrandOffer; career: CareerState; act: SponsorActions }) {
  const left = o.expires.season > career.season ? OFFER_WEEKS : Math.max(0, o.expires.week - career.week);
  const b = brandsOf(career);
  const noSlot = o.kind !== "milestone" && !o.replaces && b.deals.length >= slotsFor(career);
  const current = o.replaces ? b.deals.find(d => d.id === o.replaces) : undefined;
  return (
    <div className="kit-rise relative overflow-hidden rounded-2xl p-3" style={brandStyle(o.color, 0.36)}>
      <Shine loop every={5} />
      <div className="relative flex items-center justify-between">
        <span className="rounded-full px-2 py-0.5 text-[9.5px] font-black uppercase tracking-wider text-gray-950" style={{ background: o.color }}>{KIND_LABEL[o.kind]}</span>
        <span className="text-[10.5px] font-black text-white">⏳ {left === 0 ? "Last week" : `${left} week${left === 1 ? "" : "s"} left`}</span>
      </div>
      <div className="relative mt-2 flex items-center gap-3">
        <BrandMark category={o.category} color={o.color} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[17px] font-black leading-tight text-white">{o.brand}</div>
          <div className="text-[11px] font-bold text-white">{o.category}</div>
        </div>
      </div>
      {o.note && <div className="relative mt-2 text-[11.5px] font-bold text-white">{o.note}</div>}

      {o.kind === "milestone" ? (
        <div className="relative mt-2 rounded-xl bg-black/30 p-2 text-center">
          <div className="text-[10px] font-black uppercase tracking-wider text-white">They pay you</div>
          <div className="text-[22px] font-black text-yellow-300">★{formatMoney(o.signingOn)}</div>
        </div>
      ) : (
        <div className="relative mt-2 rounded-xl bg-black/30 p-2">
          <Row label="Weekly fee" value={`★${formatMoney(o.weekly)}${current ? ` (now ★${formatMoney(current.weekly)})` : ""}`} gold />
          <Row label="Length" value={seasonsText(o.seasons)} />
          <Row label="Signing-on payment" value={`★${formatMoney(o.signingOn)}`} />
          {o.targets.map((t, i) => <Row key={i} label={i === 0 ? (o.targets.length > 1 ? "Targets" : "Target") : ""} value={`${targetLabel(t)} · bonus ★${formatMoney(t.bonus)}`} />)}
          {o.clause && <Row label="Clause" value={o.clause === "exclusive" ? CLAUSE.exclusive(o.category) : CLAUSE.behaviour()} />}
        </div>
      )}
      {noSlot && <div className="relative mt-2 text-[11px] font-black text-amber-300">No free deal slot. More open as your fame grows.</div>}

      <div className="relative mt-2.5 grid grid-cols-2 gap-2">
        <PressButton variant="primary" size="none" disabled={noSlot} onClick={() => act.onSign(o.id)} className="rounded-xl py-2.5 text-[12px] font-black">{o.kind === "milestone" ? "Do the advert" : "Sign"}</PressButton>
        <PressButton variant="secondary" size="none" onClick={() => act.onDecline(o.id)} className="rounded-xl py-2.5 text-[12px] font-black">Decline</PressButton>
      </div>
      {o.kind !== "milestone" && (
        <div className="relative mt-2 grid grid-cols-3 gap-1.5">
          <PressButton variant="accent" accent="#fbbf24" size="none" disabled={!!o.negotiated} onClick={() => act.onNegotiate(o.id)} className="rounded-lg py-2 text-[10.5px] font-black">{o.negotiated ? "Fee agreed" : "More money"}</PressButton>
          <PressButton variant="accent" accent="#60a5fa" size="none" disabled={!!o.askedLonger || o.seasons >= 3} onClick={() => act.onAskLonger(o.id)} className="rounded-lg py-2 text-[10.5px] font-black">{o.askedLonger ? "Asked" : "Longer deal"}</PressButton>
          <PressButton variant="accent" accent="#a78bfa" size="none" disabled={!!o.askedEasier} onClick={() => act.onAskEasier(o.id)} className="rounded-lg py-2 text-[10.5px] font-black">{o.askedEasier ? "Asked" : "Easier target"}</PressButton>
        </div>
      )}
      {o.kind === "poach" && current && (
        <PressButton variant="secondary" size="none" onClick={() => act.onCounter(o.id)} className="relative mt-2 w-full rounded-lg py-2 text-[11px] font-black">Tell {current.brand} — ask them to match it</PressButton>
      )}
    </div>
  );
}

function Row({ label, value, gold = false }: { label: string; value: string; gold?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-dashed border-white/15 py-1 last:border-0">
      <span className="shrink-0 text-[11px] font-bold text-white">{label}</span>
      <span className={`text-right text-[11.5px] font-black ${gold ? "text-yellow-300" : "text-white"}`}>{value}</span>
    </div>
  );
}

export default function SponsorsScreen({ career, onBack, act, startTab }: {
  career: CareerState; onBack: () => void; act: SponsorActions; startTab?: Tab;
}) {
  const b = brandsOf(career);
  const [tab, setTab] = useState<Tab>(startTab ?? (b.offers.length ? "offers" : "deals"));
  const theme = clubTheme(career.player.club, career);
  const slots = slotsFor(career);
  const fame = fameOf(career);
  const total = weeklySponsorTotal(career);
  // Progress to the fame level that opens the next deal slot (v0.25: Unknown
  // and Local Name both have one, so the next slot is Rising Star).
  const SLOT_FAME = [0, 25, 40, 60, 80];
  const next = FAME_LEVELS.find(l => l.min > fame && SLOT_FAME.includes(l.min)) ?? null;
  const curMin = Math.max(...SLOT_FAME.filter(m => m <= fame));
  const nextPct = next ? Math.max(0, Math.min(100, ((fame - curMin) / Math.max(1, next.min - curMin)) * 100)) : 100;
  return (
    <Screen glow={theme.glow}>
      <div className="w-full flex-1">
        <ScreenHeader title="Sponsors" kicker="Your deals" onBack={onBack}
          right={<div className="rounded-full bg-amber-400/15 px-2 py-1 text-[10px] font-black text-amber-300 ring-1 ring-amber-300/30">★ {Math.round(fame)} fame</div>} />

        {/* The summary: weekly money and your deal slots. */}
        <ClubCard glow={theme.glow} className="relative overflow-hidden p-3">
          <div className="flex items-end justify-between">
            <div>
              <CardTitle tone="text-emerald-300">Sponsor money</CardTitle>
              <div className="text-[26px] font-black leading-none text-yellow-300" style={{ textShadow: "0 0 12px rgba(251,191,36,.5)" }}>★{formatMoney(total)}</div>
              <div className="text-[10.5px] font-bold text-white">a week, paid with your wage</div>
            </div>
            <div className="w-[46%] text-right">
              <div className="text-[10px] font-black uppercase tracking-wider text-white">Deal slots</div>
              <div className="mt-1 flex justify-end gap-1">
                {Array.from({ length: 5 }, (_, i) => (
                  <span key={i} className="h-3 w-6 rounded-full"
                    style={i < b.deals.length ? { background: "linear-gradient(180deg,#fcd34d,#f59e0b)", boxShadow: "0 0 8px rgba(251,191,36,.7)" }
                      : i < slots ? { background: "rgba(255,255,255,.22)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.4)" }
                        : { background: "rgba(0,0,0,.5)", boxShadow: "inset 0 1px 3px rgba(0,0,0,.6)" }} />
                ))}
              </div>
              {/* A fresh career is Unknown, which has no slot yet: say what
                  opens the first one, not "Unknown, 0 of 0 used". */}
              <div className="mt-1 text-[10.5px] font-bold text-white">{slots === 0 ? "Your first slot opens at Local Name" : `${b.deals.length} of ${slots} used`}</div>
              {next && slots < 5 && (
                <div className="mt-1">
                  <StatBar value={nextPct} colors={FAME_BAR} className="h-1.5" sheen={false} />
                  <div className="mt-0.5 text-[9.5px] font-black uppercase tracking-wider text-amber-300">{slots === 0 ? "Fame" : `Next slot · ${next.name}`}</div>
                </div>
              )}
            </div>
          </div>
        </ClubCard>

        <SegTabs className="mt-2" value={tab} onChange={setTab}
          tabs={[["deals", `Deals${b.deals.length ? ` (${b.deals.length})` : ""}`], ["offers", `Offers${b.offers.length ? ` (${b.offers.length})` : ""}`], ["brands", "Brands"]] as const} />

        {tab === "deals" && (
          <div className="mt-2 space-y-2">
            {b.deals.map(d => <DealCard key={d.id} d={d} money={career.money} onWalkAway={act.onWalkAway} onAdvert={act.onAdvert} advertDone={act.advertDone} />)}
            {b.deals.length === 0 && (
              <ClubCard glow={theme.glow} strength={0.15} className="p-4 text-center">
                <div className="text-[28px]">🤝</div>
                <div className="mt-1 text-[14px] font-black text-white">No deals yet</div>
                <div className="mt-1 text-[11.5px] font-bold text-white">
                  {slots === 0 ? "Brands start to notice you once you are a Local Name. Big moments build your fame." : "Play well and brands will send offers to your phone."}
                </div>
              </ClubCard>
            )}
            {b.news.length > 0 && (
              <ClubCard glow={theme.glow} strength={0.12} className="p-3">
                <CardTitle tone="text-amber-300">Latest</CardTitle>
                {b.news.slice(0, 6).map((n, i) => <div key={i} className="mt-1.5 text-[11.5px] font-bold text-white">• {n}</div>)}
              </ClubCard>
            )}
          </div>
        )}

        {tab === "offers" && (
          <div className="mt-2 space-y-2">
            {b.offers.map(o => <OfferCard key={o.id} o={o} career={career} act={act} />)}
            {b.offers.length === 0 && (
              <ClubCard glow={theme.glow} strength={0.15} className="p-4 text-center">
                <div className="text-[28px]">📱</div>
                <div className="mt-1 text-[14px] font-black text-white">No offers right now</div>
                <div className="mt-1 text-[11.5px] font-bold text-white">Offers come when you are in the team and playing well. More fame and better form bring more of them. Each one lasts two weeks.</div>
              </ClubCard>
            )}
          </div>
        )}

        {tab === "brands" && (
          <div className="mt-2 space-y-1.5">
            {BRAND_CATEGORIES.map((c) => {
              const deal = b.deals.find(d => d.category === c.category);
              const status = deal ? `Signed with ${deal.brand}` : categoryStatus(career, c);
              const open = !deal && status === "Could send an offer";
              const color = c.brands[0][1];
              const needsFame = !deal && fame < fameNeeded(c);
              return (
                <div key={c.category} className="flex items-center gap-3 rounded-xl p-2.5" style={brandStyle(color, deal ? 0.34 : open ? 0.2 : 0.06)}>
                  <BrandMark category={c.category} color={color} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13.5px] font-black text-white">{c.category}</div>
                    {needsFame ? (
                      <>
                        <div className="text-[11px] font-bold text-white">Needs {fameLevel(c.fame).name}</div>
                        <StatBar value={towards(fame, c.fame)} colors={FAME_BAR} className="mt-1 h-1.5" sheen={false} />
                      </>
                    ) : (
                      <div className={`text-[11px] font-bold ${deal ? "text-yellow-300" : open ? "text-emerald-300" : "text-white"}`}>{status}</div>
                    )}
                  </div>
                  <span className="text-[16px]">{deal ? "✅" : open ? "📨" : "🔒"}</span>
                </div>
              );
            })}
            <div className="px-1 pt-1 text-[11px] font-bold text-white">One deal per kind of brand. Every deal pays every week, and a target you miss never costs you money.</div>
          </div>
        )}
      </div>
    </Screen>
  );
}
