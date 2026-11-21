/**
 * SPONSORS — the phone port of components/star/SponsorsScreen.tsx and its
 * actions in app/star-dev/page.tsx (sponsorActions). Deals · Offers · Brands,
 * the slot meter and fame bar; signing, declining, asking for more
 * (only while lib/star/sponsorDeals SPONSOR_NEGOTIATION is on, as on the
 * website), counter a buy-out, walk away early. Every change is the game's
 * own sponsorDeals function.
 * "Shoot an advert" opens the advert game (screens/career/Relations.tsx, "advert-shoot").
 */
import { useState } from "react";
import { Text, View } from "react-native";
import type { CareerState } from "@/lib/star/types";
import {
  brandsOf, slotsFor, weeklySponsorTotal, targetLabel, moodOf, categoryStatus, BRAND_CATEGORIES, fameNeeded,
  BOOT_DEAL_DISCOUNT, OFFER_WEEKS, SPONSOR_NEGOTIATION, signOffer, declineOffer, askLonger, askEasier, counterPoach, walkAway, settleNegotiation,
  type BrandDeal, type BrandOffer, type BrandTarget,
} from "@/lib/star/sponsorDeals";
import { fameOf, fameLevel, FAME_LEVELS } from "@/lib/star/fame";
import { formatMoneyPrecise as formatMoney } from "@/lib/star/money";
import { useCareer, setCareer, getCareer } from "../../game/store";
import { useNav } from "../../nav";
import { C } from "../../world/lookKit";
import { FONT, glassStyle } from "../../ui/look";
import { gamePlayedThisWeek } from "@/lib/star/relationships";
import { canAct } from "@/lib/star/week";
import { ScreenFrame, Seg, Btn, Meter, Note, Title, rgba } from "../../world/ui";
import { Negotiation } from "./Negotiation";
import { useScreenHelp } from "../../world/help";

type Tab = "deals" | "offers" | "brands";
const FACE = { happy: "😊", neutral: "😐", angry: "😠" } as const;
const MOOD_TEXT = { happy: "Happy — will offer a renewal with a raise", neutral: "On the fence — could go either way", angry: "Unhappy — will not renew" } as const;
const iconOf = (category: string) => BRAND_CATEGORIES.find(c => c.category === category)?.icon ?? "🤝";
const seasonsText = (n: number) => `${n} season${n === 1 ? "" : "s"}`;
const clauseText = (clause: string, cat: string) => (clause === "exclusive" ? `Exclusive: no other ${cat.toLowerCase()} brand` : "Behaviour clause: a scandal ends the deal");
const KIND_LABEL: Record<BrandOffer["kind"], string> = { new: "New offer", bid: "Bidding war", poach: "Buy-out offer", renewal: "Renewal", milestone: "One-off advert" };

function Mark({ category, color }: { category: string; color: string }) {
  return (
    <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: rgba(color, 0.45), alignItems: "center", justifyContent: "center" }}>
      <Text style={{ fontSize: 22 }}>{iconOf(category)}</Text>
    </View>
  );
}
function TargetRow({ t, color }: { t: BrandTarget; color: string }) {
  const later = t.kind === "rating" || t.kind === "promotion";
  const pct = t.done ? 100 : later ? 0 : Math.min(100, (t.progress / Math.max(1, t.target)) * 100);
  return (
    <View style={{ marginTop: 8 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
        <Text style={{ color: C.text, fontWeight: "800", fontSize: 12, flex: 1 }}>{t.done ? "✓ " : ""}{targetLabel(t)}</Text>
        <Text style={{ color: C.text, fontWeight: "800", fontSize: 12 }}>{t.done ? "Done" : later ? "End of season" : `${t.progress} / ${t.target}`}</Text>
      </View>
      <View style={{ marginTop: 4 }}><Meter value={pct} color={t.done ? "#34d399" : color} /></View>
      <Text style={{ color: C.text, fontWeight: "700", fontSize: 11, marginTop: 2 }}>Bonus ★{formatMoney(t.bonus)}{t.done ? " — paid" : ""}</Text>
    </View>
  );
}
function Line({ label, value, gold }: { label: string; value: string; gold?: boolean }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 10, paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.08)" }}>
      <Text style={{ color: C.text, fontWeight: "700", fontSize: 12 }}>{label}</Text>
      <Text style={{ color: gold ? C.gold : C.text, fontWeight: "900", fontSize: 12, flexShrink: 1, textAlign: "right" }}>{value}</Text>
    </View>
  );
}

function DealCard({ d, money, onWalkAway, onAdvert, advertDone }: { d: BrandDeal; money: number; onWalkAway: (id: string) => void; onAdvert?: (id: string) => void; advertDone?: boolean }) {
  const [confirm, setConfirm] = useState(false);
  const mood = moodOf(d.happiness);
  return (
    <View style={{ backgroundColor: C.panel, borderRadius: 18, padding: 12, borderWidth: 1, borderColor: rgba(d.color, 0.5) }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Mark category={d.category} color={d.color} />
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={{ color: C.text, fontWeight: "900", fontSize: 17 }}>{d.brand}</Text>
          <Text style={{ color: C.text, fontWeight: "700", fontSize: 11 }}>{d.category} · {seasonsText(d.seasonsLeft)} left</Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={{ color: C.gold, fontWeight: "900", fontSize: 18 }}>★{formatMoney(d.weekly)}</Text>
          <Text style={{ color: C.text, fontWeight: "900", fontSize: 9, letterSpacing: 1 }}>A WEEK</Text>
        </View>
      </View>
      {d.targets.map((t, i) => <TargetRow key={i} t={t} color={d.color} />)}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10, backgroundColor: "rgba(0,0,0,0.3)", borderRadius: 12, padding: 8 }}>
        <Text style={{ fontSize: 22 }}>{FACE[mood]}</Text>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ color: C.text, fontWeight: "800", fontSize: 11 }}>{MOOD_TEXT[mood]}</Text>
          <Meter value={d.happiness} color={mood === "happy" ? "#34d399" : mood === "neutral" ? "#fbbf24" : "#f87171"} height={6} />
        </View>
      </View>
      {onAdvert ? (
        <Text onPress={advertDone ? undefined : () => onAdvert(d.id)} style={{ marginTop: 8, textAlign: "center", borderRadius: 12, overflow: "hidden", backgroundColor: "rgba(0,0,0,0.35)", paddingVertical: 8, color: C.text, fontWeight: "900", fontSize: 12, opacity: advertDone ? 0.45 : 1 }}>
          {advertDone ? "🎬 ADVERT SHOT THIS WEEK" : "🎬 SHOOT AN ADVERT · 1 DAY"}
        </Text>
      ) : null}
      {onAdvert && !advertDone ? <Text style={{ color: C.text, fontWeight: "700", fontSize: 10.5, marginTop: 4 }}>A quick timing game: tap when the marker hits your mark. Land 3 of 5 takes and {d.brand} get happier (+10). Once a week.</Text> : null}
      {d.clause ? <Text style={{ color: C.text, fontWeight: "700", fontSize: 11, marginTop: 8 }}>📎 {clauseText(d.clause, d.category)}</Text> : null}
      {d.category === "Boots" ? <Text style={{ color: C.green, fontWeight: "900", fontSize: 11, marginTop: 4 }}>👟 {Math.round(BOOT_DEAL_DISCOUNT * 100)}% off every pair of boots in the shop</Text> : null}
      {!confirm ? (
        <Text onPress={() => setConfirm(true)} style={{ color: C.text, fontWeight: "900", fontSize: 11, marginTop: 8, textDecorationLine: "underline" }}>WALK AWAY EARLY</Text>
      ) : (
        <View style={{ marginTop: 8, borderRadius: 12, borderWidth: 1, borderColor: "rgba(248,113,113,0.7)", backgroundColor: "rgba(239,68,68,0.15)", padding: 8, gap: 8 }}>
          <Text style={{ color: C.text, fontWeight: "700", fontSize: 12 }}>Leaving early means paying the deal’s whole guaranteed value: ★{formatMoney(d.guaranteed)}.{money < d.guaranteed ? " You can't afford it." : ""}</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Btn style={{ flex: 1 }} tone="red" disabled={money < d.guaranteed} label="Pay and leave" onPress={() => onWalkAway(d.id)} />
            <Btn style={{ flex: 1 }} tone="plain" label="Keep the deal" onPress={() => setConfirm(false)} />
          </View>
        </View>
      )}
    </View>
  );
}

interface Acts { sign: (id: string) => void; decline: (id: string) => void; negotiate: (id: string) => void; longer: (id: string) => void; easier: (id: string) => void; counter: (id: string) => void }

function OfferCard({ o, career, act }: { o: BrandOffer; career: CareerState; act: Acts }) {
  const left = o.expires.season > career.season ? OFFER_WEEKS : Math.max(0, o.expires.week - career.week);
  const b = brandsOf(career);
  const noSlot = o.kind !== "milestone" && !o.replaces && b.deals.length >= slotsFor(career);
  const current = o.replaces ? b.deals.find(d => d.id === o.replaces) : undefined;
  return (
    <View style={{ backgroundColor: C.panel, borderRadius: 18, padding: 12, borderWidth: 1, borderColor: rgba(o.color, 0.6) }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={{ backgroundColor: o.color, color: "#111", fontWeight: "900", fontSize: 10, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, overflow: "hidden" }}>{KIND_LABEL[o.kind].toUpperCase()}</Text>
        <Text style={{ color: C.text, fontWeight: "800", fontSize: 11 }}>⏳ {left === 0 ? "Last week" : `${left} week${left === 1 ? "" : "s"} left`}</Text>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 8 }}>
        <Mark category={o.category} color={o.color} />
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={{ color: C.text, fontWeight: "900", fontSize: 17 }}>{o.brand}</Text>
          <Text style={{ color: C.text, fontWeight: "700", fontSize: 11 }}>{o.category}</Text>
        </View>
      </View>
      {o.note ? <Text style={{ color: C.text, fontWeight: "700", fontSize: 12, marginTop: 8 }}>{o.note}</Text> : null}
      {o.kind === "milestone" ? (
        <View style={{ marginTop: 8, backgroundColor: "rgba(0,0,0,0.3)", borderRadius: 12, padding: 8, alignItems: "center" }}>
          <Text style={{ color: C.text, fontWeight: "900", fontSize: 10, letterSpacing: 1 }}>THEY PAY YOU</Text>
          <Text style={{ color: C.gold, fontWeight: "900", fontSize: 22 }}>★{formatMoney(o.signingOn)}</Text>
        </View>
      ) : (
        <View style={{ marginTop: 8, backgroundColor: "rgba(0,0,0,0.3)", borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4 }}>
          <Line label="Weekly fee" value={`★${formatMoney(o.weekly)}${current ? ` (now ★${formatMoney(current.weekly)})` : ""}`} gold />
          <Line label="Length" value={seasonsText(o.seasons)} />
          <Line label="Signing-on payment" value={`★${formatMoney(o.signingOn)}`} />
          {o.targets.map((t, i) => <Line key={i} label={i === 0 ? (o.targets.length > 1 ? "Targets" : "Target") : ""} value={`${targetLabel(t)} · bonus ★${formatMoney(t.bonus)}`} />)}
          {o.clause ? <Line label="Clause" value={clauseText(o.clause, o.category)} /> : null}
        </View>
      )}
      {noSlot ? <Text style={{ color: C.gold, fontWeight: "900", fontSize: 11, marginTop: 8 }}>No free deal slot. More open as your fame grows.</Text> : null}
      <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
        <Btn style={{ flex: 1 }} tone="green" disabled={noSlot} label={o.kind === "milestone" ? "Do the advert" : "Sign"} onPress={() => act.sign(o.id)} />
        <Btn style={{ flex: 1 }} tone="plain" label={SPONSOR_NEGOTIATION ? "Decline" : "Leave it"} onPress={() => act.decline(o.id)} />
      </View>
      {SPONSOR_NEGOTIATION && o.kind !== "milestone" && (
        <View style={{ flexDirection: "row", gap: 6, marginTop: 6 }}>
          <Btn style={{ flex: 1 }} tone="plain" disabled={!!o.negotiated} label={o.negotiated ? "Fee agreed" : "More money"} onPress={() => act.negotiate(o.id)} />
          <Btn style={{ flex: 1 }} tone="plain" disabled={!!o.askedLonger || o.seasons >= 3} label={o.askedLonger ? "Asked" : "Longer deal"} onPress={() => act.longer(o.id)} />
          <Btn style={{ flex: 1 }} tone="plain" disabled={!!o.askedEasier} label={o.askedEasier ? "Asked" : "Easier target"} onPress={() => act.easier(o.id)} />
        </View>
      )}
      {o.kind === "poach" && current && <Btn style={{ marginTop: 6 }} tone="plain" label={`Tell ${current.brand} — ask them to match it`} onPress={() => act.counter(o.id)} />}
    </View>
  );
}

export function SponsorsScreen() {
  const career = useCareer();
  const nav = useNav();
  const [tab, setTab] = useState<Tab | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [negId, setNegId] = useState<string | null>(null);
  const help = useScreenHelp("sponsors", career); // the first-visit pointer tour (page.tsx firstHelp("sponsors"))
  if (!career) return null;
  const flash = (t: string) => { setNote(t); setTimeout(() => setNote((n) => (n === t ? null : n)), 4000); };
  const cur = () => getCareer() ?? career;
  const advertDone = gamePlayedThisWeek(career.relGamesPlayed, career.season, career.week, "advert");
  const act: Acts = {
    sign: (id) => { const r = signOffer(cur(), id); if (r.ok) { setCareer(r.career); flash(r.message); } else flash(r.reason); },
    decline: (id) => setCareer(declineOffer(cur(), id)),
    negotiate: (id) => setNegId(id),
    longer: (id) => { const r = askLonger(cur(), id, Math.random()); setCareer(r.career); flash(r.yes ? "They agreed: one more season." : "They said no to a longer deal."); },
    easier: (id) => { const r = askEasier(cur(), id, Math.random()); setCareer(r.career); flash(r.yes ? "They agreed: easier targets." : "They said no to easier targets."); },
    counter: (id) => { const r = counterPoach(cur(), id, Math.random()); setCareer(r.career); flash(r.matched ? "Your sponsor matched the offer." : "Your sponsor would not match it."); },
  };
  const onWalkAway = (id: string) => { const r = walkAway(cur(), id); if (r.ok) { setCareer(r.career); flash(r.message); } else flash(r.reason); };

  // "More money" on an offer: the haggle, in a weekly fee (page.tsx sponsor-negotiation).
  const neg = negId ? brandsOf(career).offers.find(x => x.id === negId) : undefined;
  if (neg) {
    const mv = Math.round(neg.weekly * 1.2);
    return (
      <Negotiation mode="selling" playerName={`${neg.brand} — weekly fee`} marketValue={mv} counterpartLabel={neg.brand}
        initialState={{ marketValue: mv, mode: "selling", round: 0, yourPosition: Math.max(neg.weekly + 1, Math.round(neg.weekly * 1.25)), theirPosition: neg.weekly, moodScore: 60, status: "negotiating", log: [`${neg.brand} open at ★${neg.weekly.toLocaleString()} a week.`] }}
        onDone={(weekly) => {
          setCareer(settleNegotiation(cur(), neg.id, weekly));
          flash(weekly === null ? `${neg.brand} walked away.` : `Agreed: ★${Math.round(weekly).toLocaleString()} a week. Sign it to make it yours.`);
          setNegId(null);
        }} />
    );
  }

  const b = brandsOf(career);
  const shown: Tab = tab ?? (b.offers.length ? "offers" : "deals");
  const slots = slotsFor(career);
  const fame = fameOf(career);
  const total = weeklySponsorTotal(career);
  const SLOT_FAME = [0, 25, 40, 60, 80];
  const next = FAME_LEVELS.find(l => l.min > fame && SLOT_FAME.includes(l.min)) ?? null;
  const curMin = Math.max(...SLOT_FAME.filter(m => m <= fame));
  const nextPct = next ? Math.max(0, Math.min(100, ((fame - curMin) / Math.max(1, next.min - curMin)) * 100)) : 100;

  return (
    <ScreenFrame title="Sponsors" kicker="Your deals" onBack={() => nav.back()} bar={null}
      right={<Text style={{ color: "#fde68a", fontWeight: "900", fontSize: 12, backgroundColor: "rgba(251,191,36,0.18)", borderWidth: 1, borderColor: "rgba(253,224,71,0.3)", paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, overflow: "hidden" }}>★ {Math.round(fame)} fame</Text>}>
      <Note text={note} />
      {help.node}
      <View style={[glassStyle("glass"), { borderRadius: 16, padding: 12, flexDirection: "row", justifyContent: "space-between", gap: 10 }]}>
        <View style={{ flex: 1 }}>
          <Title color={C.green}>Sponsor money</Title>
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={{ color: "#fcd34d", fontFamily: FONT.display, fontSize: 30, lineHeight: 36 }}>★{formatMoney(total)}</Text>
          <Text style={{ color: C.text, fontWeight: "700", fontSize: 11 }}>a week, paid with your wage</Text>
        </View>
        <View style={{ width: "46%", alignItems: "flex-end" }}>
          <Text style={{ color: C.text, fontWeight: "900", fontSize: 10, letterSpacing: 1 }}>DEAL SLOTS</Text>
          <View style={{ flexDirection: "row", gap: 4, marginTop: 4 }}>
            {Array.from({ length: 5 }, (_, i) => (
              <View key={i} style={{ width: 22, height: 11, borderRadius: 6, backgroundColor: i < b.deals.length ? C.gold : i < slots ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.5)" }} />
            ))}
          </View>
          <Text style={{ color: C.text, fontWeight: "700", fontSize: 11, marginTop: 4, textAlign: "right" }}>{slots === 0 ? "Your first slot opens at Local Name" : `${b.deals.length} of ${slots} used`}</Text>
          {next && slots < 5 && (
            <View style={{ width: "100%", marginTop: 4 }}>
              <Meter value={nextPct} color={C.gold} height={5} />
              <Text style={{ color: C.gold, fontWeight: "900", fontSize: 9, letterSpacing: 1, textAlign: "right", marginTop: 2 }}>{slots === 0 ? "FAME" : `NEXT SLOT · ${next.name.toUpperCase()}`}</Text>
            </View>
          )}
        </View>
      </View>

      <Seg value={shown} onChange={setTab} tabs={[["deals", `Deals${b.deals.length ? ` (${b.deals.length})` : ""}`], ["offers", `Offers${b.offers.length ? ` (${b.offers.length})` : ""}`], ["brands", "Brands"]] as const} />

      {shown === "deals" && (
        <>
          {b.deals.map(d => <DealCard key={d.id} d={d} money={career.money} onWalkAway={onWalkAway} advertDone={advertDone} onAdvert={(id) => { if (!canAct(career)) { flash("No days left this week."); return; } nav.go("advert-shoot", { dealId: id }); }} />)}
          {b.deals.length === 0 && (
            <View style={{ backgroundColor: C.panel, borderRadius: 18, padding: 16, alignItems: "center" }}>
              <Text style={{ fontSize: 28 }}>🤝</Text>
              <Text style={{ color: C.text, fontWeight: "900", fontSize: 15, marginTop: 4 }}>No deals yet</Text>
              <Text style={{ color: C.text, fontWeight: "700", fontSize: 12, textAlign: "center", marginTop: 4 }}>{slots === 0 ? "Brands start to notice you once you are a Local Name. Big moments build your fame." : "Play well and brands will send offers to your phone."}</Text>
            </View>
          )}
          {b.news.length > 0 && (
            <View style={{ backgroundColor: C.panel, borderRadius: 18, padding: 12 }}>
              <Title>Latest</Title>
              {b.news.slice(0, 6).map((n, i) => <Text key={i} style={{ color: C.text, fontWeight: "700", fontSize: 12, marginTop: 4 }}>• {n}</Text>)}
            </View>
          )}
        </>
      )}
      {shown === "offers" && (
        <>
          {b.offers.map(o => <OfferCard key={o.id} o={o} career={career} act={act} />)}
          {b.offers.length === 0 && (
            <View style={{ backgroundColor: C.panel, borderRadius: 18, padding: 16, alignItems: "center" }}>
              <Text style={{ fontSize: 28 }}>📱</Text>
              <Text style={{ color: C.text, fontWeight: "900", fontSize: 15, marginTop: 4 }}>No offers right now</Text>
              <Text style={{ color: C.text, fontWeight: "700", fontSize: 12, textAlign: "center", marginTop: 4 }}>Offers come when you are in the team and playing well. More fame and better form bring more of them. Each one lasts two weeks.</Text>
            </View>
          )}
        </>
      )}
      {shown === "brands" && (
        <>
          {BRAND_CATEGORIES.map((c) => {
            const deal = b.deals.find(d => d.category === c.category);
            const status = deal ? `Signed with ${deal.brand}` : categoryStatus(career, c);
            const open = !deal && status === "Could send an offer";
            const color = c.brands[0][1];
            const needsFame = !deal && fame < fameNeeded(c);
            return (
              <View key={c.category} style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: C.panel, borderRadius: 14, padding: 10, borderWidth: 1, borderColor: rgba(color, deal ? 0.7 : open ? 0.4 : 0.15) }}>
                <Mark category={c.category} color={color} />
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={{ color: C.text, fontWeight: "900" }}>{c.category}</Text>
                  {needsFame ? (
                    <>
                      <Text style={{ color: C.text, fontWeight: "700", fontSize: 11 }}>Needs {fameLevel(c.fame).name}</Text>
                      <Meter value={Math.max(0, Math.min(100, (fame / Math.max(1, c.fame)) * 100))} color={C.gold} height={5} />
                    </>
                  ) : <Text style={{ color: deal ? C.gold : open ? C.green : C.text, fontWeight: "700", fontSize: 11 }}>{status}</Text>}
                </View>
                <Text style={{ fontSize: 16 }}>{deal ? "✅" : open ? "📨" : "🔒"}</Text>
              </View>
            );
          })}
          <Text style={{ color: C.text, fontWeight: "700", fontSize: 11 }}>One deal per kind of brand. Every deal pays every week, and a target you miss never costs you money.</Text>
        </>
      )}
    </ScreenFrame>
  );
}
