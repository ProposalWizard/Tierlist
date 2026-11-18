/**
 * INVESTMENTS — buying and selling a stake in a club (the market and your
 * portfolio of components/star/Investments.tsx). Shown in the packed app on
 * the website, so it is here too. The numbers are the game's own
 * (lib/star/investments.ts: clubValuation, stakeIn, buyStake, sellStake).
 *
 * The boardroom of a club you own (signings, the manager, the kit, the
 * stadium, votes…) is still to come on the phone.
 */
import { useMemo, useState } from "react";
import { View, Text, TextInput } from "react-native";
import { allInvestableClubs, clubValuation, stakeIn, buyStake, sellStake, MAJORITY_THRESHOLD } from "@/lib/star/investments";
import { formatMoney } from "@/lib/star/money";
import { useCareer, setCareer } from "../../game/store";
import { settle } from "../../game/flow";
import { useNav } from "../../nav";
import { Press } from "../../ui/Press";
import { Frame, Card, Label, Btn, ClubCrest, StandInNote, C } from "../career/kit";

const pctText = (p: number) => `${p.toFixed(p < 1 ? 3 : 1)}%`;

export function InvestmentsScreen() {
  const career = useCareer();
  const nav = useNav();
  const [tab, setTab] = useState<"market" | "portfolio">("market");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [pending, setPending] = useState<{ club: string; kind: "buy" | "sell"; pct: number; amount: number } | null>(null);
  const clubs = useMemo(() => allInvestableClubs(), []);
  if (!career) return null;
  const owned = (career.investments ?? []).filter((i) => i.percent > 0);
  const shown = (tab === "portfolio" ? owned.map((o) => o.club) : clubs.filter((c) => c.toLowerCase().includes(search.toLowerCase()))).slice(0, 60);
  const totalValue = owned.reduce((s, i) => s + clubValuation(i.club, career) * (i.percent / 100), 0);
  const totalCost = owned.reduce((s, i) => s + i.avgBuyValuation * (i.percent / 100), 0);
  const confirm = () => {
    if (!pending) return;
    setCareer(pending.kind === "buy" ? buyStake(career, pending.club, pending.pct) : sellStake(career, pending.club, pending.pct));
    settle();
    setPending(null);
  };
  return (
    <Frame kicker={`In the bank ★${formatMoney(career.money)}`} title="Investments" onBack={() => nav.back()}>
      <View style={{ flexDirection: "row", gap: 6 }}>
        {(["market", "portfolio"] as const).map((t) => (
          <Press key={t} onPress={() => setTab(t)} style={{ flex: 1, paddingVertical: 8, borderRadius: 99, alignItems: "center", backgroundColor: tab === t ? C.gold : C.panel2 }}>
            <Text style={{ color: tab === t ? "#1a1405" : C.text, fontWeight: "900" }}>{t === "market" ? "Market" : `Your clubs · ${owned.length}`}</Text>
          </Press>
        ))}
      </View>
      {tab === "market" && (
        <TextInput value={search} onChangeText={setSearch} placeholder="Find a club" placeholderTextColor={C.dim}
          style={{ backgroundColor: C.panel2, color: C.text, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontWeight: "700" }} />
      )}
      {tab === "portfolio" && owned.length > 0 && (
        <Card>
          <Label>Portfolio</Label>
          <Text style={{ color: C.text, fontWeight: "900" }}>Worth ★{formatMoney(Math.round(totalValue))}</Text>
          <Text style={{ color: totalValue - totalCost >= 0 ? C.green : C.red, fontWeight: "800" }}>{totalValue - totalCost >= 0 ? "+" : "−"}★{formatMoney(Math.abs(Math.round(totalValue - totalCost)))} unrealised</Text>
        </Card>
      )}
      {tab === "portfolio" && owned.length === 0 && <Card><Text style={{ color: C.dim }}>You don't own a share of any club yet.</Text></Card>}
      {pending && (
        <Card tone={C.gold}>
          <Text style={{ color: C.text, fontWeight: "900", textAlign: "center" }}>{pending.kind === "buy" ? "Buy" : "Sell"} {pctText(pending.pct)} of {pending.club} for ★{formatMoney(pending.amount)}?</Text>
          {(() => {
            const had = stakeIn(career, pending.club)?.percent ?? 0;
            if (pending.kind === "buy" && had < MAJORITY_THRESHOLD && had + pending.pct >= MAJORITY_THRESHOLD) return <Text style={{ color: C.green, fontWeight: "900", textAlign: "center", marginTop: 4 }}>This makes you the majority owner.</Text>;
            if (pending.kind === "sell" && had >= MAJORITY_THRESHOLD && had - pending.pct < MAJORITY_THRESHOLD) return <Text style={{ color: C.red, fontWeight: "900", textAlign: "center", marginTop: 4 }}>You will lose majority control of this club.</Text>;
            return null;
          })()}
          <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
            <View style={{ flex: 1 }}><Btn small kind={pending.kind === "buy" ? "primary" : "danger"} label="Confirm" onPress={confirm} /></View>
            <View style={{ flex: 1 }}><Btn small kind="plain" label="Cancel" onPress={() => setPending(null)} /></View>
          </View>
        </Card>
      )}
      {shown.map((club) => {
        const valuation = clubValuation(club, career);
        const stake = stakeIn(career, club);
        const stakePct = stake?.percent ?? 0;
        const room = Math.max(0, 100 - stakePct);
        const maxSpend = Math.max(0, Math.min(career.money, Math.round(valuation * (room / 100))));
        const isOpen = open === club;
        const profit = stake ? Math.round((valuation - stake.avgBuyValuation) * (stakePct / 100)) : 0;
        return (
          <Card key={club} tone={stakePct >= MAJORITY_THRESHOLD ? C.gold : undefined}>
            <Press onPress={() => setOpen(isOpen ? null : club)} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <ClubCrest club={club} size={32} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.text, fontWeight: "900" }}>{club}</Text>
                <Text style={{ color: C.dim, fontSize: 12 }}>Worth ★{formatMoney(valuation)}{stake ? ` · you own ${pctText(stakePct)}${stakePct >= MAJORITY_THRESHOLD ? " · Majority" : ""}` : ""}</Text>
              </View>
              <Text style={{ color: C.dim, fontSize: 18 }}>{isOpen ? "˅" : "›"}</Text>
            </Press>
            {isOpen && (
              <View style={{ marginTop: 10, gap: 8 }}>
                {stake && <Text style={{ color: C.text, fontSize: 12 }}>Bought in at ★{formatMoney(stake.avgBuyValuation)} full value — <Text style={{ color: profit >= 0 ? C.green : C.red, fontWeight: "900" }}>{profit >= 0 ? "+" : "−"}★{formatMoney(Math.abs(profit))} unrealised</Text></Text>}
                {room > 0 && (
                  <>
                    <Text style={{ color: C.dim, fontSize: 10, fontWeight: "900", letterSpacing: 1 }}>BUY</Text>
                    <View style={{ flexDirection: "row", gap: 6 }}>
                      {[0.01, 0.1, 0.5, 1].map((f) => {
                        const amount = Math.max(1, Math.round(maxSpend * f));
                        const pct = valuation > 0 ? (amount / valuation) * 100 : 0;
                        return <View key={f} style={{ flex: 1 }}><Btn small kind="plain" disabled={maxSpend <= 0} label={f === 1 ? "Max" : `${Math.round(f * 100)}%`} onPress={() => setPending({ club, kind: "buy", pct, amount })} /></View>;
                      })}
                    </View>
                    <Text style={{ color: C.dim, fontSize: 11 }}>Of what you can spend here: up to ★{formatMoney(maxSpend)}.</Text>
                  </>
                )}
                {stake && (
                  <>
                    <Text style={{ color: C.dim, fontSize: 10, fontWeight: "900", letterSpacing: 1 }}>SELL</Text>
                    <View style={{ flexDirection: "row", gap: 6 }}>
                      {[0.25, 0.5, 1].map((f) => (
                        <View key={f} style={{ flex: 1 }}><Btn small kind="danger" label={f === 1 ? "All" : `${Math.round(f * 100)}%`} onPress={() => setPending({ club, kind: "sell", pct: stakePct * f, amount: Math.round(valuation * (stakePct * f / 100)) })} /></View>
                      ))}
                    </View>
                  </>
                )}
                {stakePct >= MAJORITY_THRESHOLD && <StandInNote>The boardroom (signings, the manager, the kit, the stadium) is still to come on the phone.</StandInNote>}
              </View>
            )}
          </Card>
        );
      })}
    </Frame>
  );
}
