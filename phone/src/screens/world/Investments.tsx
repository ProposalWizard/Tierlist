/**
 * INVESTMENTS — the phone port of components/star/Investments.tsx: buy a stake
 * in any club and, past 50.1%, run its boardroom. Three tabs:
 *   Market     every club, search, A–Z or ★ Value, buy/sell by amount (with a confirm)
 *   Portfolio  what you own, buy more / sell some, recommend to the board, your recommendations
 *   Boardroom  clubs you control: budget and Fund club, then Squad (sell to a
 *              real interested club, negotiate, confirm or put it to a
 *              shareholder vote), Sign a player (filters), Manager, Powers
 *              (formation, lineup, your own club's captaincy/talisman/self-
 *              transfer, kit and kit vote, presidency, merger, son,
 *              facilities) and History.
 * Every action is the game's own (world/politics.ts → lib/star). Params:
 * { tab?, club?, section? } open it where page.tsx's investmentsEntry would.
 *
 * Kit colours: swatches or any colour ("＋ Any", ui/ColourPicker.tsx), as the
 * website's colour picker. The lineup editor is the website's LineupBuilder as
 * tap-a-slot lists: the XI by formation, then the bench of nine; tap a place,
 * then the man for it (a man already on the sheet swaps with the one there).
 */
import { useMemo, useState } from "react";
import { Text, View } from "react-native";
import type { CareerState, LeagueSquad } from "@/lib/star/types";
import {
  allInvestableClubs, clubValuation, stakeIn, isMajorityOwner, canInvestIn, MAJORITY_THRESHOLD, ownedClubState,
} from "@/lib/star/investments";
import { FREE_AGENTS_CLUB } from "@/lib/star/leagueSquads";
import { allPoolManagers, managerInterest } from "@/lib/star/managerPool";
import { loadLineup, managerFor, type SavedLineup } from "@/lib/star/lineupStore";
import { FORMATIONS, DEFAULT_FORMATION, formationOf, autoPick, type Pickable } from "@/lib/star/formations";
import { clubKitFor, clubStrengthWithFormation, type ClubKit, type RecommendationKind } from "@/lib/star/clubPowers";
import { kitsOf } from "@/lib/star/kits";
import { facilitiesFor } from "@/lib/star/facilities";
import { playerMarketValue } from "@/lib/star/marketValue";
import { interestedClubs, type TransferInterest } from "@/lib/star/transferMarket";
import { formatMoney, formatMoneyPrecise } from "@/lib/star/money";
import type { NegotiationState } from "@/lib/star/negotiation";
import { useCareer } from "../../game/store";
import { useNav } from "../../nav";
import { Press } from "../../ui/Press";
import { Frame, Card, Btn, ClubCrest, C } from "../../world/lookKit";
import { Seg } from "../../world/ui";
import { Negotiation } from "./Negotiation";
import { NumBox, TextBox, Choose, Problem, SmallBtn, Line, Small, Head, KitSwatch, ColourRow, pctText } from "./politicsKit";
import * as P from "../../world/politics";
import type { BoardSection, InvestmentsEntry } from "../../world/politics";

const money = (n: number) => formatMoney(n);
type Tab = "market" | "portfolio" | "boardroom";

export function InvestmentsScreen({ params }: { params?: Record<string, unknown> }) {
  const career = useCareer();
  const nav = useNav();
  const entry = (params ?? {}) as InvestmentsEntry;
  const [tab, setTab] = useState<Tab>(entry.tab ?? "market");
  const [boardClub, setBoardClub] = useState<string | null>(entry.club ?? null);
  // A negotiation or the lineup editor takes the whole screen (as the website's do).
  const [full, setFull] = useState<React.ReactNode>(null);
  if (!career) return null;
  if (full) return <>{full}</>;
  const owned = (career.investments ?? []).filter((i) => i.percent > 0);
  const majority = owned.filter((i) => isMajorityOwner(career, i.club));
  return (
    <Frame kicker={`Balance ★${money(career.money)}`} title="Investments" onBack={() => nav.back()}>
      <Seg value={tab} onChange={(t) => { setTab(t); setBoardClub(null); }}
        tabs={[["market", "Market"], ["portfolio", "Portfolio"], ["boardroom", `Boardroom${majority.length ? ` (${majority.length})` : ""}`]]} />
      {tab === "market" && <Market career={career} />}
      {tab === "portfolio" && <Portfolio career={career} owned={owned} />}
      {tab === "boardroom" && (boardClub
        ? <Boardroom key={boardClub} career={career} club={boardClub} onBack={() => setBoardClub(null)} setFull={setFull}
            initialSection={boardClub === entry.club ? entry.section : undefined}
            otherOwnedClubs={owned.map((i) => i.club).filter((c) => c !== boardClub && c !== career.player.club)} />
        : <BoardroomList clubs={majority.map((i) => i.club)} career={career} onOpen={setBoardClub} />)}
    </Frame>
  );
}

// ── MARKET ──────────────────────────────────────────────────────────────────

function Market({ career }: { career: CareerState }) {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "value">("name");
  const [open, setOpen] = useState<string | null>(null);
  const all = useMemo(() => allInvestableClubs(), []);
  const valuations = useMemo(() => new Map(all.map((c) => [c, clubValuation(c, career)])), [all, career]);
  const clubs = all.filter((c) => canInvestIn(career, c)).filter((c) => c.toLowerCase().includes(search.toLowerCase()));
  const sorted = sortBy === "value" ? [...clubs].sort((a, b) => (valuations.get(b) ?? 0) - (valuations.get(a) ?? 0)) : [...clubs].sort((a, b) => a.localeCompare(b));
  return (
    <>
      <Line>
        <TextBox value={search} onChange={setSearch} placeholder="Search clubs…" />
        <SmallBtn flex={false} tone={sortBy === "name" ? "green" : "plain"} label="A–Z" onPress={() => setSortBy("name")} />
        <SmallBtn flex={false} tone={sortBy === "value" ? "green" : "plain"} label="★ Value" onPress={() => setSortBy("value")} />
      </Line>
      <Card style={{ padding: 0 }}>
        {sorted.slice(0, 80).map((club, i) => {
          const valuation = valuations.get(club) ?? clubValuation(club, career);
          const stake = stakeIn(career, club);
          const isOpen = open === club;
          return (
            <View key={club} style={{ borderTopWidth: i ? 1 : 0, borderTopColor: C.line }}>
              <Press onPress={() => setOpen(isOpen ? null : club)} style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 12 }}>
                <ClubCrest club={club} size={28} />
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={{ color: C.text, fontWeight: "800" }}>{club}</Text>
                  {stake ? <Text style={{ color: "#6ee7b7", fontSize: 11, fontWeight: "800" }}>You own {pctText(stake.percent)}{stake.percent >= MAJORITY_THRESHOLD ? " · Majority" : ""}</Text> : null}
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={{ color: C.gold, fontWeight: "900" }}>★{money(valuation)}</Text>
                  <Text style={{ color: C.dim, fontSize: 10, fontWeight: "700" }}>full value</Text>
                </View>
              </Press>
              {isOpen && <StakeControls key={club} career={career} club={club} valuation={valuation} />}
            </View>
          );
        })}
        {clubs.length === 0 && <Text style={{ color: C.text, padding: 16, textAlign: "center" }}>No clubs match “{search}”.</Text>}
      </Card>
      {sorted.length > 80 && <Small>Showing 80 of {sorted.length}. Search to find the rest.</Small>}
    </>
  );
}

/** Buy by amount (capped by the bank and by the room left), sell by share of your holding; every deal asks first. */
function StakeControls({ career, club, valuation, mode = "both", onDone }: { career: CareerState; club: string; valuation: number; mode?: "both" | "buy" | "sell"; onDone?: () => void }) {
  const stake = stakeIn(career, club);
  const stakePct = stake?.percent ?? 0;
  const room = Math.max(0, 100 - stakePct);
  const maxSpend = Math.max(0, Math.min(career.money, Math.round(valuation * (room / 100))));
  const [buyAmount, setBuyAmount] = useState(() => Math.max(1, Math.min(maxSpend, Math.round(valuation * 0.001))));
  const clamped = Math.max(0, Math.min(maxSpend, Math.round(buyAmount) || 0));
  const buyPct = valuation > 0 ? (clamped / valuation) * 100 : 0;
  const [sellFraction, setSellFraction] = useState(mode === "sell" ? 0.5 : 1);
  const sellPct = stakePct * sellFraction;
  const sellAmount = Math.round(valuation * (sellPct / 100));
  const [pending, setPending] = useState<{ kind: "buy" | "sell"; pct: number; amount: number } | null>(null);
  const [last, setLast] = useState<string | null>(null);
  const profit = stake ? Math.round((valuation - stake.avgBuyValuation) * (stakePct / 100)) : 0;
  return (
    <View style={{ backgroundColor: "rgba(0,0,0,0.3)", padding: 12, gap: 10 }}>
      {last ? <Text style={{ color: last.startsWith("+") ? "#34d399" : "#f87171", fontWeight: "900", textAlign: "center" }}>{last}</Text> : null}
      {stake ? (
        <Text style={{ color: C.text, fontSize: 12, fontWeight: "700" }}>You own <Text style={{ fontWeight: "900" }}>{pctText(stakePct)}</Text>, bought in at <Text style={{ fontWeight: "900" }}>★{money(stake.avgBuyValuation)}</Text> full value — <Text style={{ color: profit >= 0 ? "#6ee7b7" : "#fca5a5", fontWeight: "900" }}>{profit >= 0 ? "+" : ""}★{money(Math.abs(profit))} unrealised</Text></Text>
      ) : null}
      {pending && (
        <View style={{ backgroundColor: "rgba(120,53,15,0.7)", borderRadius: 12, padding: 12, gap: 8, borderWidth: 2, borderColor: "rgba(251,191,36,0.8)" }}>
          <Text style={{ color: C.text, fontWeight: "900", textAlign: "center" }}>{pending.kind === "buy" ? "Buy" : "Sell"} {pctText(pending.pct)} of {club} for ★{money(pending.amount)}?</Text>
          {pending.kind === "buy" && stakePct < MAJORITY_THRESHOLD && stakePct + pending.pct >= MAJORITY_THRESHOLD ? <Text style={{ color: "#6ee7b7", fontWeight: "900", textAlign: "center", fontSize: 12 }}>This makes you the majority owner.</Text> : null}
          {pending.kind === "sell" && stakePct >= MAJORITY_THRESHOLD && stakePct - pending.pct < MAJORITY_THRESHOLD ? <Text style={{ color: "#fca5a5", fontWeight: "900", textAlign: "center", fontSize: 12 }}>You will lose majority control of this club.</Text> : null}
          <Line>
            <SmallBtn tone={pending.kind === "buy" ? "green" : "red"} label="Confirm" onPress={() => {
              if (pending.kind === "buy") P.buy(club, pending.pct); else P.sell(club, pending.pct);
              setLast(`${pending.kind === "buy" ? "+" : "−"}${pctText(pending.pct)}`); setPending(null); onDone?.();
            }} />
            <SmallBtn label="Cancel" onPress={() => setPending(null)} />
          </Line>
        </View>
      )}
      {mode !== "sell" && room > 0 && (
        <View style={{ gap: 6 }}>
          <Head color={C.text}>Buy</Head>
          <Line>
            <NumBox value={clamped} onChange={(n) => setBuyAmount(Math.max(0, Math.min(maxSpend, n ?? 0)))} />
            <Text style={{ color: C.text, fontWeight: "900", width: 70, textAlign: "right" }}>= {pctText(buyPct)}</Text>
          </Line>
          <Line>{[0.1, 0.25, 0.5, 1].map((f) => <SmallBtn key={f} disabled={maxSpend <= 0} label={f === 1 ? "MAX" : `${Math.round(f * 100)}%`} onPress={() => setBuyAmount(Math.round(maxSpend * f))} />)}</Line>
          {buyPct >= MAJORITY_THRESHOLD ? <Small color="#6ee7b7">→ MAJORITY at this amount</Small> : null}
          <SmallBtn tone="green" disabled={!(clamped > 0 && clamped <= career.money)} label={`Buy ★${money(clamped)} (${pctText(buyPct)})`} onPress={() => setPending({ kind: "buy", pct: buyPct, amount: clamped })} />
          {maxSpend < Math.round(valuation) ? <Text style={{ color: C.text, fontSize: 10, fontWeight: "700", textAlign: "center" }}>Most you can afford: ★{money(maxSpend)} ({((maxSpend / valuation) * 100).toFixed(2)}%)</Text> : null}
        </View>
      )}
      {mode !== "buy" && stakePct > 0 && (
        <View style={{ gap: 6 }}>
          <Head color={C.text}>Sell</Head>
          <Line>
            <SmallBtn label="−" flex={false} onPress={() => setSellFraction((f) => Math.max(0.01, Math.round((f - 0.05) * 100) / 100))} />
            <Text style={{ flex: 1, color: C.text, fontWeight: "900", textAlign: "center" }}>{Math.round(sellFraction * 100)}% of your stake</Text>
            <SmallBtn label="+" flex={false} onPress={() => setSellFraction((f) => Math.min(1, Math.round((f + 0.05) * 100) / 100))} />
          </Line>
          <Line>{[0.25, 0.5, 0.75, 1].map((f) => <SmallBtn key={f} tone={sellFraction === f ? "red" : "plain"} label={f === 1 ? "ALL" : `${Math.round(f * 100)}%`} onPress={() => setSellFraction(f)} />)}</Line>
          <SmallBtn tone="red" label={`Sell ${Math.round(sellFraction * 100)}% of your stake (${pctText(sellPct)} of the club) for ★${money(sellAmount)}`} onPress={() => setPending({ kind: "sell", pct: sellPct, amount: sellAmount })} />
        </View>
      )}
      <Text style={{ color: C.text, fontSize: 10, fontWeight: "700", textAlign: "center" }}>Club: {club}</Text>
    </View>
  );
}

// ── PORTFOLIO ───────────────────────────────────────────────────────────────

const REC_KINDS: [RecommendationKind, string][] = [["sign", "Sign a player"], ["formation", "Change formation"], ["manager", "Change manager"], ["wage", "Adjust wages"]];

function Portfolio({ career, owned }: { career: CareerState; owned: { club: string; percent: number; avgBuyValuation: number }[] }) {
  const [recClub, setRecClub] = useState<string | null>(null);
  const [recKind, setRecKind] = useState<RecommendationKind>("sign");
  const [recDetail, setRecDetail] = useState("");
  const [recMessage, setRecMessage] = useState<string | null>(null);
  const [trade, setTrade] = useState<{ club: string; mode: "buy" | "sell" } | null>(null);
  if (owned.length === 0) return <Card><Text style={{ color: C.text, textAlign: "center", fontWeight: "700" }}>No stakes yet — buy into a club from the Market tab.</Text></Card>;
  const totalValue = owned.reduce((s, i) => s + clubValuation(i.club, career) * (i.percent / 100), 0);
  const totalCost = owned.reduce((s, i) => s + i.avgBuyValuation * (i.percent / 100), 0);
  const totalProfit = totalValue - totalCost;
  return (
    <>
      <Card style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View>
          <Text style={{ color: C.dim, fontSize: 10, fontWeight: "900", letterSpacing: 1.5 }}>PORTFOLIO VALUE</Text>
          <Text style={{ color: C.gold, fontSize: 18, fontWeight: "900" }}>★{money(totalValue)}</Text>
        </View>
        <Text style={{ color: totalProfit >= 0 ? "#6ee7b7" : "#fca5a5", fontWeight: "900" }}>{totalProfit >= 0 ? "+" : ""}★{money(Math.abs(totalProfit))}</Text>
      </Card>
      {owned.map((i) => {
        const value = clubValuation(i.club, career);
        const profit = (value - i.avgBuyValuation) * (i.percent / 100);
        return (
          <Card key={i.club} style={{ gap: 8 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <ClubCrest club={i.club} size={28} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.text, fontWeight: "800" }}>{i.club}</Text>
                <Text style={{ color: C.text, fontSize: 11 }}>{pctText(i.percent)}{i.percent >= MAJORITY_THRESHOLD ? <Text style={{ color: "#6ee7b7", fontWeight: "900" }}>  MAJORITY</Text> : null}</Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={{ color: C.gold, fontWeight: "900", fontSize: 12 }}>★{money(value * (i.percent / 100))}</Text>
                <Text style={{ color: profit >= 0 ? "#6ee7b7" : "#fca5a5", fontWeight: "800", fontSize: 11 }}>{profit >= 0 ? "+" : ""}★{money(Math.abs(profit))}</Text>
              </View>
            </View>
            <Line>
              {i.percent < 100
                ? <SmallBtn tone="green" label="Buy more" onPress={() => setTrade(trade?.club === i.club && trade.mode === "buy" ? null : { club: i.club, mode: "buy" })} />
                : <View style={{ flex: 1, backgroundColor: C.panel2, borderRadius: 10, paddingVertical: 9, alignItems: "center" }}><Text style={{ color: C.text, fontWeight: "900", fontSize: 12 }}>100% owned</Text></View>}
              <SmallBtn tone="red" label="Sell some" onPress={() => setTrade(trade?.club === i.club && trade.mode === "sell" ? null : { club: i.club, mode: "sell" })} />
            </Line>
            {trade?.club === i.club && <StakeControls key={`${i.club}-${trade.mode}`} career={career} club={i.club} valuation={value} mode={trade.mode} onDone={() => setTrade(null)} />}
            {i.percent < MAJORITY_THRESHOLD && (recClub === i.club ? (
              <View style={{ gap: 6 }}>
                <Choose value={recKind} onChange={setRecKind} options={REC_KINDS} />
                <Line><TextBox value={recDetail} onChange={setRecDetail} placeholder="What would you suggest?" /></Line>
                <Line>
                  <SmallBtn tone="green" label="Submit" onPress={() => {
                    const r = P.recommend(i.club, recKind, recDetail || "No detail given");
                    setRecMessage(r.ok ? "Recommendation filed — the board will consider it." : (r.reason ?? "Failed"));
                    if (r.ok) { setRecClub(null); setRecDetail(""); }
                  }} />
                  <SmallBtn flex={false} label="Cancel" onPress={() => setRecClub(null)} />
                </Line>
              </View>
            ) : <SmallBtn tone="blue" label="Recommend to the board" onPress={() => { setRecClub(i.club); setRecMessage(null); }} />)}
          </Card>
        );
      })}
      {recMessage ? <Card><Text style={{ color: C.text, fontWeight: "800", textAlign: "center", fontSize: 12 }}>{recMessage}</Text></Card> : null}
      {(career.recommendations ?? []).length > 0 && (
        <Card style={{ padding: 0 }}>
          <Text style={{ color: C.dim, fontSize: 10, fontWeight: "900", letterSpacing: 1.5, padding: 10 }}>YOUR RECOMMENDATIONS</Text>
          {[...(career.recommendations ?? [])].reverse().slice(0, 8).map((r) => (
            <View key={r.id} style={{ flexDirection: "row", justifyContent: "space-between", gap: 8, paddingHorizontal: 10, paddingVertical: 7, borderTopWidth: 1, borderTopColor: C.line }}>
              <Text numberOfLines={1} style={{ flex: 1, color: C.text, fontSize: 11 }}>{r.club}: {r.detail}</Text>
              <Text style={{ color: r.status === "adopted" ? "#6ee7b7" : r.status === "dismissed" ? C.text : C.gold, fontSize: 10, fontWeight: "900" }}>{r.status.toUpperCase()}</Text>
            </View>
          ))}
        </Card>
      )}
    </>
  );
}

// ── BOARDROOM ───────────────────────────────────────────────────────────────

function BoardroomList({ clubs, career, onOpen }: { clubs: string[]; career: CareerState; onOpen: (c: string) => void }) {
  if (clubs.length === 0) return <Card><Text style={{ color: C.text, textAlign: "center", fontWeight: "700" }}>Own {MAJORITY_THRESHOLD}% or more of a club to take a seat on its board.</Text></Card>;
  return (
    <>
      {clubs.map((club) => (
        <Press key={club} onPress={() => onOpen(club)}>
          <Card style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <ClubCrest club={club} size={30} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.text, fontWeight: "900" }}>{club}</Text>
              <Text style={{ color: C.text, fontSize: 11 }}>Budget: ★{money(ownedClubState(career, club).budget)}</Text>
            </View>
            <Text style={{ color: C.text, fontSize: 18 }}>→</Text>
          </Card>
        </Press>
      ))}
    </>
  );
}

function squadFor(career: CareerState, club: string): LeagueSquad | undefined {
  return (career.leagueSquads ?? []).find((s) => s.club === club) ?? (career.externalSquads ?? []).find((s) => s.club === club);
}

type Talks =
  | { kind: "sign"; playerId: string; fromClub: string; playerName: string; marketValue: number }
  | { kind: "sell"; playerId: string; playerName: string; buyerClub: string; marketValue: number }
  | { kind: "manager"; club: string; managerName: string; marketValue: number };

function Boardroom({ career, club, onBack, initialSection, otherOwnedClubs, setFull }: {
  career: CareerState; club: string; onBack: () => void; initialSection?: BoardSection; otherOwnedClubs: string[];
  setFull: (n: React.ReactNode) => void;
}) {
  const nav = useNav();
  const isOwnClub = club === career.player.club;
  const [section, setSection] = useState<BoardSection>(initialSection ?? (isOwnClub ? "manager" : "squad"));
  const [topUp, setTopUp] = useState<number | null>(1000);
  const [message, setMessage] = useState<string | null>(null);
  const [pendingSale, setPendingSale] = useState<{ playerId: string; playerName: string; fee: number; buyerClub: string } | null>(null);
  const [interestList, setInterestList] = useState<{ playerId: string; playerName: string; interests: TransferInterest[] } | null>(null);
  const [saved, setSaved] = useState<Record<string, NegotiationState>>({});
  const state = ownedClubState(career, club);
  const squad = squadFor(career, club);
  const run = (r: P.ActionResult) => setMessage(r.ok ? null : (r.reason ?? "That didn't go through."));
  const vote = (r: { ok: true; vote: P.PendingVote } | { ok: false; reason?: string }) => {
    if (!r.ok) { run(r); return; }
    nav.replace("vote-ceremony", { vote: r.vote });
  };

  const talk = (deal: Talks) => setFull(
    <Negotiation
      mode={deal.kind === "sell" ? "selling" : "buying"}
      playerName={deal.kind === "manager" ? deal.managerName : deal.playerName}
      counterpartLabel={deal.kind === "sell" ? deal.buyerClub : deal.kind === "manager" ? "His Representatives" : undefined}
      marketValue={deal.marketValue}
      initialState={deal.kind === "sell" ? saved[deal.buyerClub] : undefined}
      onStepAway={deal.kind === "sell" ? (s) => { setSaved((m) => ({ ...m, [deal.buyerClub]: s })); setFull(null); } : undefined}
      onDone={(price) => {
        setFull(null);
        if (price === null) {
          setMessage("Talks broke down — no deal was made.");
          if (deal.kind === "sell") {
            setSaved((m) => { const { [deal.buyerClub]: _gone, ...rest } = m; return rest; });
            setInterestList((l) => l && { ...l, interests: l.interests.filter((i) => i.club !== deal.buyerClub) });
          }
          if (deal.kind === "manager") P.managerTalksFailed(deal.club, deal.managerName);
          return;
        }
        if (deal.kind === "sign") { run(P.signPlayer(club, deal.playerId, deal.fromClub, price)); return; }
        if (deal.kind === "manager") { run(P.replaceManager(deal.club, deal.managerName, price)); return; }
        setInterestList(null); setSaved({});
        setPendingSale({ playerId: deal.playerId, playerName: deal.playerName, fee: price, buyerClub: deal.buyerClub });
      }}
    />,
  );

  if (pendingSale) {
    return (
      <>
        <Card style={{ alignItems: "center" }}>
          <Text style={{ color: C.dim, fontSize: 10, fontWeight: "900", letterSpacing: 1.5 }}>CONFIRM SALE</Text>
          <Text style={{ color: C.text, fontSize: 18, fontWeight: "900" }}>{pendingSale.playerName}</Text>
          <Text style={{ color: C.dim, fontSize: 11, fontWeight: "700" }}>to {pendingSale.buyerClub}</Text>
          <Text style={{ color: C.gold, fontWeight: "900", marginTop: 4 }}>for ★{money(pendingSale.fee)}</Text>
        </Card>
        <Btn label="Confirm Sale" onPress={() => { const s = pendingSale; setPendingSale(null); run(P.sellPlayer(club, s.playerId, s.fee, s.buyerClub)); }} />
        <Btn kind="plain" small label="Put It To A Shareholder Vote First" onPress={() => { const s = pendingSale; setPendingSale(null); vote(P.proposeSellVote(club, s.playerId, s.fee, s.buyerClub)); }} />
        <SmallBtn label="Cancel" onPress={() => setPendingSale(null)} />
      </>
    );
  }

  if (interestList) {
    return (
      <>
        <SmallBtn flex={false} label="← Back" onPress={() => { setInterestList(null); setSaved({}); }} />
        <Card>
          <Text style={{ color: C.dim, fontSize: 10, fontWeight: "900", letterSpacing: 1.5 }}>SELLING</Text>
          <Text style={{ color: C.text, fontWeight: "900" }}>{interestList.playerName}</Text>
        </Card>
        {interestList.interests.length === 0 && <Text style={{ color: C.dim, textAlign: "center", fontWeight: "700" }}>No club is genuinely interested right now.</Text>}
        <Card style={{ padding: 0 }}>
          {interestList.interests.map((i, n) => {
            const inTalks = saved[i.club];
            return (
              <View key={i.club} style={{ flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderTopWidth: n ? 1 : 0, borderTopColor: C.line }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.text, fontWeight: "800" }}>{i.club}</Text>
                  <Text style={{ color: C.dim, fontSize: 10, fontWeight: "800" }}>WANTS HIM AS A {i.roleIntent.toUpperCase()} · {inTalks ? `★${money(inTalks.theirPosition)} CURRENT OFFER` : `★${money(i.expectedOffer)} EXPECTED OFFER`}</Text>
                </View>
                <SmallBtn flex={false} tone="green" label={inTalks ? "Resume" : "Negotiate"}
                  onPress={() => talk({ kind: "sell", playerId: interestList.playerId, playerName: interestList.playerName, buyerClub: i.club, marketValue: i.expectedOffer })} />
              </View>
            );
          })}
        </Card>
      </>
    );
  }

  const kit = clubKitFor(career, club);
  const sections: BoardSection[] = isOwnClub ? ["manager", "powers", "history"] : ["squad", "sign", "manager", "powers", "history"];
  return (
    <>
      <SmallBtn flex={false} label="← All boards" onPress={onBack} />
      <Card style={{ gap: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {kit ? <KitSwatch kit={kit.home} size={32} /> : <ClubCrest club={club} size={32} />}
          <View>
            <Text style={{ color: C.text, fontWeight: "900" }}>{club}</Text>
            <Text style={{ color: C.text, fontSize: 11 }}>Manager: {isOwnClub ? (career.manager?.name || "Vacant") : (managerFor(club) || state.managerName || "Vacant")}</Text>
          </View>
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between", backgroundColor: C.panel2, borderRadius: 10, padding: 9 }}>
          <Text style={{ color: C.text, fontSize: 11, fontWeight: "800" }}>Budget</Text>
          <Text style={{ color: C.gold, fontWeight: "900" }}>★{money(state.budget)}</Text>
        </View>
        <Line>
          <NumBox value={topUp} onChange={setTopUp} />
          <SmallBtn flex={false} tone="green" disabled={!topUp || topUp > career.money} label="Fund club" onPress={() => P.topUp(club, topUp ?? 0)} />
        </Line>
      </Card>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
        {sections.map((s) => (
          <Press key={s} onPress={() => { setSection(s); setMessage(null); }} style={{ flexGrow: 1, paddingVertical: 8, paddingHorizontal: 6, borderRadius: 10, alignItems: "center", backgroundColor: section === s ? "#10b981" : C.panel2 }}>
            <Text style={{ color: section === s ? "#05261a" : C.text, fontWeight: "900", fontSize: 11 }}>{s === "sign" ? "SIGN A PLAYER" : s.toUpperCase()}</Text>
          </Press>
        ))}
      </View>
      <Problem text={message} />

      {section === "squad" && (
        <Card style={{ padding: 0 }}>
          {(squad?.players ?? []).map((p, n) => (
            <View key={p.id} style={{ flexDirection: "row", alignItems: "center", padding: 10, borderTopWidth: n ? 1 : 0, borderTopColor: C.line }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.text, fontWeight: "800" }}>{p.name}</Text>
                <Text style={{ color: C.text, fontSize: 11 }}>{p.position} · OVR {p.overall}</Text>
              </View>
              <SmallBtn flex={false} tone="red" label="Sell" onPress={() => { setSaved({}); setInterestList({ playerId: p.id, playerName: p.name, interests: interestedClubs(p, club, career) }); }} />
            </View>
          ))}
          {(!squad || squad.players.length === 0) && <Text style={{ color: C.text, padding: 16, textAlign: "center" }}>No squad data on file yet.</Text>}
        </Card>
      )}
      {section === "sign" && (
        <SignPlayerPanel career={career} club={club}
          onSignFree={(id, from) => run(P.signPlayer(club, id, from))}
          onNegotiate={(playerId, fromClub, playerName, marketValue) => talk({ kind: "sign", playerId, fromClub, playerName, marketValue })} />
      )}
      {section === "manager" && <ManagerPanel career={career} club={club} onNegotiate={(name, fee) => talk({ kind: "manager", club, managerName: name, marketValue: fee })} />}
      {section === "powers" && <PowersPanel career={career} club={club} squad={squad} run={run} vote={vote} otherOwnedClubs={otherOwnedClubs} setFull={setFull} />}
      {section === "history" && (
        <Card style={{ padding: 0 }}>
          {(career.clubTransferHistory?.[club] ?? []).map((t, i) => (
            <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderTopWidth: i ? 1 : 0, borderTopColor: C.line }}>
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={{ color: C.text, fontWeight: "800" }}>{t.playerName}</Text>
                <Text style={{ color: C.text, fontSize: 11 }}>{t.direction === "in" ? `In from ${t.otherClub}` : `Out to ${t.otherClub}`} · Season {t.season}</Text>
              </View>
              <Text style={{ color: t.direction === "in" ? "#fca5a5" : "#6ee7b7", fontWeight: "900" }}>{t.direction === "in" ? "-" : "+"}★{formatMoneyPrecise(t.fee)}</Text>
            </View>
          ))}
          {!(career.clubTransferHistory?.[club]?.length) && <Text style={{ color: C.text, padding: 16, textAlign: "center" }}>No transfers done through this club yet.</Text>}
        </Card>
      )}
    </>
  );
}

// ── Lineup: a preview of the XI, and a save-scoped editor ───────────────────

function pickableOf(squad: LeagueSquad): Pickable[] {
  return squad.players.map((p) => ({ id: p.id, name: p.name, position: p.position, positions: p.positions, overall: p.overall }));
}
function currentLineup(career: CareerState, club: string, squad: LeagueSquad) {
  const pickable = pickableOf(squad);
  const known = new Set(pickable.map((p) => p.id));
  const override = career.ownedLineups?.[club];
  const saved = override && override.xi.some((id) => id && known.has(id)) ? override : loadLineup(club);
  const usable = !!saved && saved.xi.some((id) => id && known.has(id));
  const formation = formationOf(usable ? saved!.formation : DEFAULT_FORMATION);
  const xi = usable ? saved!.xi.map((id) => (id && known.has(id) ? id : null)) : autoPick(pickable, formation);
  return { pickable, formation, xi, usable, isOverride: !!override && override === saved, bench: usable ? saved!.bench : undefined };
}

function LineupPreview({ career, club, squad, run, setFull }: { career: CareerState; club: string; squad: LeagueSquad | undefined; run: (r: P.ActionResult) => void; setFull: (n: React.ReactNode) => void }) {
  if (!squad || squad.players.length === 0) {
    return <Card><Head color={C.dim}>Lineup</Head><Small color={C.text}>No squad data on file yet to build a lineup preview from.</Small></Card>;
  }
  const { pickable, formation, xi, usable, isOverride } = currentLineup(career, club, squad);
  const byId = new Map(pickable.map((p) => [p.id, p]));
  return (
    <Card>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <Text style={{ flex: 1, color: C.dim, fontSize: 10, fontWeight: "900", letterSpacing: 1.2 }}>
          LINEUP {isOverride ? `· ${formation.name ?? formation.id} (YOUR EDIT — THIS SAVE ONLY)` : usable ? `· ${formation.name ?? formation.id}` : "· AUTO-PICKED (NOTHING SAVED YET)"}
        </Text>
        <SmallBtn flex={false} tone="green" label="Edit Lineup" onPress={() => setFull(<LineupEditor club={club} squad={squad} onClose={() => setFull(null)} run={run} />)} />
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        {formation.slots.map((slot, i) => {
          const p = xi[i] ? byId.get(xi[i]!) : undefined;
          return (
            <View key={i} style={{ width: "50%", flexDirection: "row", gap: 4, paddingRight: 6, paddingVertical: 1 }}>
              <Text style={{ color: C.dim, fontSize: 11, width: 34 }}>{slot.role}</Text>
              <Text numberOfLines={1} style={{ flex: 1, color: C.text, fontSize: 11, textAlign: "right" }}>{p ? p.name : "—"}</Text>
              {p ? <Text style={{ color: C.dim, fontSize: 11, width: 22, textAlign: "right" }}>{p.overall ?? "—"}</Text> : null}
            </View>
          );
        })}
      </View>
    </Card>
  );
}

/** LineupBuilder's bench: nine places. */
const BENCH_SIZE = 9;
/** LineupBuilder's auto bench: the best nine not in the XI. */
function autoBench(pickable: Pickable[], xi: (string | null)[]): (string | null)[] {
  const inXi = new Set(xi.filter(Boolean) as string[]);
  const best = pickable.filter((p) => !inXi.has(p.id)).sort((a, b) => (b.overall ?? 0) - (a.overall ?? 0)).slice(0, BENCH_SIZE).map((p) => p.id);
  return Array.from({ length: BENCH_SIZE }, (_, i) => best[i] ?? null);
}

type Place = { kind: "xi" | "bench"; i: number };

/** Edit lineup — this save only (OwnedLineupEditor → LineupBuilder): formation, the XI, the bench. */
function LineupEditor({ club, squad, onClose, run }: { club: string; squad: LeagueSquad; onClose: () => void; run: (r: P.ActionResult) => void }) {
  const career = useCareer()!;
  const start = currentLineup(career, club, squad);
  const known = new Set(start.pickable.map((p) => p.id));
  const [formationId, setFormationId] = useState(start.formation.id);
  const [xi, setXi] = useState<(string | null)[]>(start.xi);
  const [bench, setBench] = useState<(string | null)[]>(() => {
    // A saved bench (men still in the squad and not in the XI, nine at most), else the auto bench.
    if (start.bench) {
      const inXi = new Set(start.xi.filter(Boolean) as string[]);
      const kept = start.bench.filter((id) => known.has(id) && !inXi.has(id)).slice(0, BENCH_SIZE);
      return Array.from({ length: BENCH_SIZE }, (_, i) => kept[i] ?? null);
    }
    return autoBench(start.pickable, start.xi);
  });
  const [sel, setSel] = useState<Place | null>(null);
  const formation = formationOf(formationId);
  const byId = new Map(start.pickable.map((p) => [p.id, p]));
  const place = (id: string | null) => {
    if (!sel) return;
    const x = [...xi], b = [...bench];
    const here = sel.kind === "xi" ? x[sel.i] : b[sel.i];
    if (id) {
      // Wherever he is now, the man in the chosen place goes there (a swap); a reserve just comes in.
      const inX = x.indexOf(id), inB = b.indexOf(id);
      if (inX >= 0) x[inX] = here ?? null;
      else if (inB >= 0) b[inB] = here ?? null;
    }
    if (sel.kind === "xi") x[sel.i] = id; else b[sel.i] = id;
    setXi(x); setBench(b); setSel(null);
  };
  const repick = (f: string) => { const nx = autoPick(start.pickable, formationOf(f)); setXi(nx); setBench(autoBench(start.pickable, nx)); setSel(null); };
  const save = () => {
    const lineup: SavedLineup = { formation: formationId, xi: formation.slots.map((_, i) => xi[i] ?? null), bench: bench.filter((id): id is string => !!id) };
    run(P.setLineup(club, lineup));
    onClose();
  };
  const where = (id: string) => (xi.includes(id) ? " (in the XI)" : bench.includes(id) ? " (on the bench)" : "");
  const row = (key: string, label: string, id: string | null, on: boolean, onPress: () => void, top: boolean) => {
    const p = id ? byId.get(id) : undefined;
    return (
      <Press key={key} onPress={onPress} style={{ flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderTopWidth: top ? 1 : 0, borderTopColor: C.line, backgroundColor: on ? "rgba(16,185,129,0.25)" : "transparent" }}>
        <Text style={{ color: C.gold, fontWeight: "900", width: 40 }}>{label}</Text>
        <Text numberOfLines={1} style={{ flex: 1, color: p ? C.text : C.dim, fontWeight: "800" }}>{p ? p.name : "— empty —"}</Text>
        {p ? <Text style={{ color: C.dim }}>{p.position} {p.overall}</Text> : null}
      </Press>
    );
  };
  const tap = (pl: Place) => setSel(sel && sel.kind === pl.kind && sel.i === pl.i ? null : pl);
  return (
    <Frame title="Edit lineup — this save only" onBack={onClose} footer={<Btn label="Save" onPress={save} />}>
      <Small color={C.text}>Changes here decide this club's real matchday XI from now on — but only in THIS career. Every other save (and the global lineup template) is completely untouched.</Small>
      <Line>
        <Choose value={formationId} onChange={(f) => { setFormationId(f); repick(f); }} options={FORMATIONS.map((f) => [f.id, f.name ?? f.id] as const)} />
        <SmallBtn flex={false} label="Auto-pick" onPress={() => repick(formationId)} />
      </Line>
      <Card style={{ padding: 0 }}>
        {formation.slots.map((s, i) => row(`x${i}`, s.label ?? s.role, xi[i] ?? null, sel?.kind === "xi" && sel.i === i, () => tap({ kind: "xi", i }), i > 0))}
      </Card>
      <Text style={{ color: C.dim, fontSize: 10, fontWeight: "900", letterSpacing: 1.5 }}>BENCH · {bench.filter(Boolean).length}/{BENCH_SIZE}</Text>
      <Card style={{ padding: 0 }}>
        {bench.map((id, i) => row(`b${i}`, `S${i + 1}`, id, sel?.kind === "bench" && sel.i === i, () => tap({ kind: "bench", i }), i > 0))}
      </Card>
      {sel !== null && (
        <Card style={{ padding: 0 }}>
          <Text style={{ color: C.dim, fontSize: 10, fontWeight: "900", letterSpacing: 1.5, padding: 10 }}>
            PICK FOR {sel.kind === "xi" ? formation.slots[sel.i].role : `THE BENCH (S${sel.i + 1})`}
          </Text>
          {sel.kind === "bench" && bench[sel.i] && (
            <Press onPress={() => place(null)} style={{ padding: 10, borderTopWidth: 1, borderTopColor: C.line }}>
              <Text style={{ color: C.red, fontWeight: "800" }}>Take him off the bench</Text>
            </Press>
          )}
          {[...start.pickable].sort((a, b) => (b.overall ?? 0) - (a.overall ?? 0)).map((p) => (
            <Press key={p.id} onPress={() => place(p.id)} style={{ flexDirection: "row", padding: 10, borderTopWidth: 1, borderTopColor: C.line }}>
              <Text style={{ flex: 1, color: where(p.id) ? C.dim : C.text, fontWeight: "700" }}>{p.name}{where(p.id)}</Text>
              <Text style={{ color: C.dim }}>{p.position} {p.overall}</Text>
            </Press>
          ))}
        </Card>
      )}
    </Frame>
  );
}

// ── POWERS ──────────────────────────────────────────────────────────────────

const KIT_ALT_1: ClubKit = { home: { shirt: "#1d4ed8", trim: "#facc15" }, away: { shirt: "#ffffff", trim: "#1d4ed8" } };
const KIT_ALT_2: ClubKit = { home: { shirt: "#111827", trim: "#dc2626" }, away: { shirt: "#dc2626", trim: "#111827" } };
const sameKit = (a: ClubKit, b: ClubKit) => a.home.shirt === b.home.shirt && a.home.trim === b.home.trim && a.away.shirt === b.away.shirt && a.away.trim === b.away.trim;

function PowersPanel({ career, club, squad, run, vote, otherOwnedClubs, setFull }: {
  career: CareerState; club: string; squad: LeagueSquad | undefined; run: (r: P.ActionResult) => void;
  vote: (r: { ok: true; vote: P.PendingVote } | { ok: false; reason?: string }) => void; otherOwnedClubs: string[]; setFull: (n: React.ReactNode) => void;
}) {
  const state = ownedClubState(career, club);
  const kit = clubKitFor(career, club);
  const facilities = facilitiesFor(career, club);
  const isOwnClub = club === career.player.club;
  const [formationId, setFormationId] = useState(state.formation ?? "433");
  const [kitA, setKitA] = useState<ClubKit>(kit ?? kitsOf(club));
  const [kitB, setKitB] = useState<ClubKit>(kit && sameKit(kit, KIT_ALT_1) ? KIT_ALT_2 : KIT_ALT_1);
  const [design, setDesign] = useState<"A" | "B">("A");
  const [wage, setWage] = useState<number | null>(state.presidentWage ?? 0);
  const [mergeTarget, setMergeTarget] = useState(otherOwnedClubs[0] ?? "");
  const [stadiumName, setStadiumName] = useState(facilities.stadiumName);
  const leagueClubs = career.league.map((t) => t.name).filter((n) => n !== club);
  const [transferTarget, setTransferTarget] = useState(leagueClubs[0] ?? "");
  const son = career.son;
  const editing = design === "A" ? kitA : kitB;
  const setEditing = design === "A" ? setKitA : setKitB;
  const paint = (side: "home" | "away", part: "shirt" | "trim") => (c: string) => setEditing({ ...editing, [side]: { ...editing[side], [part]: c } });

  return (
    <>
      {isOwnClub ? (
        <Card tone="rgba(245,158,11,0.5)" style={{ gap: 8 }}>
          <Head color="#fcd34d">Owning your own club — more power, not less</Head>
          <Small>Formation and lineup are already yours on the real team sheet — this section is the power that's ONLY real because it's also your own club: none of it exists for a club you don't play for.</Small>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.panel2, borderRadius: 10, padding: 9 }}>
            <Text style={{ flex: 1, color: C.text, fontWeight: "800", fontSize: 12 }}>Captain: {career.captain ? "You" : "Someone else"}</Text>
            {!career.captain && <SmallBtn flex={false} tone="gold" label="Appoint yourself" onPress={() => run(P.selfCaptain(club))} />}
          </View>
          <View style={{ backgroundColor: C.panel2, borderRadius: 10, padding: 9, gap: 4 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={{ flex: 1, color: C.text, fontWeight: "800", fontSize: 12 }}>Talisman tactic: {state.talisman ? "On" : "Off"}</Text>
              <SmallBtn flex={false} tone={state.talisman ? "red" : "green"} label={state.talisman ? "Turn off" : "Turn on"} onPress={() => run(P.talisman(club, !state.talisman))} />
            </View>
            <Small>Everyone plays for you — way more chances come your way, at the cost of your team-mates' own share of them. Only affects real matches you play for this club.</Small>
          </View>
          {leagueClubs.length > 0 && (
            <View style={{ backgroundColor: C.panel2, borderRadius: 10, padding: 9, gap: 6 }}>
              <Text style={{ color: C.text, fontWeight: "800", fontSize: 12 }}>Sell yourself to a club of your choice</Text>
              <Line>
                <Choose value={transferTarget} onChange={setTransferTarget} options={leagueClubs.map((c) => [c, c] as const)} />
                <SmallBtn flex={false} tone="red" label="Transfer" onPress={() => run(P.transferSelf(transferTarget))} />
              </Line>
            </View>
          )}
        </Card>
      ) : (
        <Card>
          <Head color={C.dim}>Formation (manager's tactics)</Head>
          <Line>
            <Choose value={formationId} onChange={setFormationId} options={FORMATIONS.map((f) => [f.id, f.name ?? f.id] as const)} />
            <SmallBtn flex={false} tone="green" label="Set" onPress={() => run(P.setFormation(club, formationId))} />
          </Line>
          <View style={{ marginTop: 6 }}><Small color={C.text}>Real strength with this shape: {clubStrengthWithFormation(career, club)}</Small></View>
        </Card>
      )}
      {!isOwnClub && <LineupPreview career={career} club={club} squad={squad} run={run} setFull={setFull} />}

      <Card style={{ gap: 8 }}>
        <Head color={C.dim}>Kit</Head>
        <Small>A real home AND away kit, exactly like a real match — clash rules still apply. Design A and B below are two full candidates you can put to a real fan vote (or set directly); whichever wins genuinely becomes this club's kit in real matches, not just here.</Small>
        {kit && (
          <View style={{ flexDirection: "row", gap: 14 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}><KitSwatch kit={kit.home} size={36} /><Text style={{ color: C.text, fontSize: 11, fontWeight: "700" }}>Home</Text></View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}><KitSwatch kit={kit.away} size={36} /><Text style={{ color: C.text, fontSize: 11, fontWeight: "700" }}>Away</Text></View>
          </View>
        )}
        <View style={{ flexDirection: "row", gap: 8 }}>
          {(["A", "B"] as const).map((d) => {
            const k = d === "A" ? kitA : kitB;
            return (
              <Press key={d} onPress={() => setDesign(d)} style={{ flex: 1, borderRadius: 10, padding: 8, borderWidth: 2, borderColor: design === d ? C.green : C.line, backgroundColor: C.panel2 }}>
                <Text style={{ color: C.text, fontWeight: "900", fontSize: 11, marginBottom: 4 }}>Design {d}</Text>
                <View style={{ flexDirection: "row", gap: 6 }}><KitSwatch kit={k.home} size={30} /><KitSwatch kit={k.away} size={30} /></View>
              </Press>
            );
          })}
        </View>
        <Small>Editing Design {design} (tap a colour):</Small>
        {(["home", "away"] as const).map((side) => (["shirt", "trim"] as const).map((part) => (
          <View key={side + part}>
            <Text style={{ color: C.dim, fontSize: 10, fontWeight: "900" }}>{side.toUpperCase()} {part.toUpperCase()}</Text>
            <ColourRow value={editing[side][part]} onChange={paint(side, part)} />
          </View>
        )))}
        <Line>
          <SmallBtn label="Set Design A directly" onPress={() => run(P.setKit(club, kitA))} />
          <SmallBtn label="Set Design B directly" onPress={() => run(P.setKit(club, kitB))} />
        </Line>
        <Line>
          <SmallBtn tone="blue" label="Vote — favour A" onPress={() => vote(P.proposeKit(club, kitA, kitB, "a"))} />
          <SmallBtn tone="blue" label="Vote — favour B" onPress={() => vote(P.proposeKit(club, kitA, kitB, "b"))} />
        </Line>
        <SmallBtn label="Vote — no favourite, let the fans decide" onPress={() => vote(P.proposeKit(club, kitA, kitB, undefined))} />
      </Card>

      <Card>
        <Head color={C.dim}>Presidency</Head>
        {state.isPresident ? (
          <Line><NumBox value={wage} onChange={setWage} /><SmallBtn flex={false} tone="green" label="Set wage" onPress={() => run(P.presidentWage(club, wage ?? 0))} /></Line>
        ) : <SmallBtn tone="blue" label="Stand for president (shareholder vote)" onPress={() => vote(P.standForPresident(club))} />}
      </Card>

      {!isOwnClub && otherOwnedClubs.length > 0 && (
        <Card tone="rgba(239,68,68,0.5)">
          <Head color="#fca5a5">Merge/takeover (100% ownership of both required)</Head>
          <Line>
            <Choose value={mergeTarget} onChange={setMergeTarget} options={otherOwnedClubs.map((c) => [c, c] as const)} />
            <SmallBtn flex={false} tone="red" label="Absorb" onPress={() => run(P.merge(club, mergeTarget))} />
          </Line>
        </Card>
      )}

      <Card style={{ gap: 6 }}>
        <Head color={C.dim}>Son</Head>
        {!son ? <SmallBtn tone="blue" label="Have a son" onPress={() => run(P.son())} /> : (
          <>
            <Small color={C.text}>{son.name} · Age {son.age} · OVR {son.overall} · {son.club ?? "Not on a team yet"}</Small>
            <Line>
              <SmallBtn tone="purple" label="Use the potion" onPress={() => run(P.sonPotion())} />
              {isOwnClub ? <View style={{ flex: 1 }}><Small>Getting him into YOUR squad isn't wired up here yet — see the transfer market instead.</Small></View>
                : !son.club ? <SmallBtn tone="green" label="Promote to first team" onPress={() => run(P.promoteSon(club))} />
                : <SmallBtn label="Transfer here" onPress={() => run(P.moveSon(club))} />}
            </Line>
          </>
        )}
      </Card>

      <Card style={{ gap: 6 }}>
        <Head color={C.dim}>Facilities</Head>
        <Line><TextBox value={stadiumName} onChange={setStadiumName} /><SmallBtn flex={false} label="Rename" onPress={() => run(P.rename(club, stadiumName))} /></Line>
        <Small color={C.text}>Capacity {facilities.stadiumCapacity.toLocaleString("en-GB")} · Training tier {facilities.trainingGroundTier}/3 · Youth tier {facilities.youthAcademyTier}/3</Small>
        {facilities.stadiumBuild && (
          <View style={{ backgroundColor: "rgba(120,53,15,0.3)", borderRadius: 8, padding: 8, borderWidth: 1, borderColor: "rgba(180,83,9,0.6)" }}>
            <Text style={{ color: "#fde68a", fontSize: 11, fontWeight: "800" }}>🏗️ Expanding to {facilities.stadiumBuild.targetCapacity.toLocaleString("en-GB")} — {facilities.stadiumBuild.seasonsRemaining} season{facilities.stadiumBuild.seasonsRemaining === 1 ? "" : "s"} left</Text>
          </View>
        )}
        <Line>
          <SmallBtn tone="green" disabled={!!facilities.stadiumBuild} label={facilities.stadiumBuild ? "Expansion under way" : "+5,000 seats (real build time)"} onPress={() => run(P.moreSeats(club))} />
          <SmallBtn tone="green" disabled={facilities.trainingGroundTier >= 3} label="Upgrade training" onPress={() => run(P.training(club))} />
          <SmallBtn tone="green" disabled={facilities.youthAcademyTier >= 3} label="Upgrade academy" onPress={() => run(P.academy(club))} />
        </Line>
        <Small color={C.text}>A bigger stadium earns this club real gate-receipt revenue every season.</Small>
      </Card>
    </>
  );
}

// ── SIGN A PLAYER ───────────────────────────────────────────────────────────

function SignPlayerPanel({ career, club, onSignFree, onNegotiate }: {
  career: CareerState; club: string;
  onSignFree: (playerId: string, fromClub: string) => void;
  onNegotiate: (playerId: string, fromClub: string, playerName: string, marketValue: number) => void;
}) {
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [positions, setPositions] = useState<Set<string>>(new Set());
  const [nation, setNation] = useState("");
  const [fromClub, setFromClub] = useState("");
  const [minR, setMinR] = useState<number | null>(null);
  const [maxR, setMaxR] = useState<number | null>(null);
  const [minA, setMinA] = useState<number | null>(null);
  const [maxA, setMaxA] = useState<number | null>(null);
  const [maxV, setMaxV] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<"rating" | "value">("rating");
  const [sortDesc, setSortDesc] = useState(true);

  // The website's own pool: free agents, then every other club's real players
  // (never your own club, never generated "gen:" players, never you), each once.
  const everyone = useMemo(() => {
    const yourName = `${career.player.firstName} ${career.player.lastName}`;
    const free = (career.freeAgents ?? []).map((p) => ({ ...p, fromClub: FREE_AGENTS_CLUB }));
    const seen = new Set<string>();
    const others = [...(career.leagueSquads ?? []), ...(career.externalSquads ?? [])]
      .filter((s) => s.club !== club && s.club !== career.player.club)
      .flatMap((s) => s.players.map((p) => ({ ...p, fromClub: s.club })))
      .filter((p) => !p.id.startsWith("gen:") && p.name !== yourName)
      .filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)));
    return [...free, ...others].map((p) => ({ ...p, marketValue: playerMarketValue(p, p.fromClub, career) }));
  }, [career, club]);
  const allPositions = useMemo(() => Array.from(new Set(everyone.flatMap((p) => (p.positions?.length ? p.positions : [p.position])))).sort(), [everyone]);
  const allNations = useMemo(() => Array.from(new Set(everyone.map((p) => p.nation).filter((n): n is string => !!n))).sort(), [everyone]);
  const allClubs = useMemo(() => Array.from(new Set(everyone.map((p) => p.fromClub))).sort(), [everyone]);

  let pool = everyone.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));
  if (positions.size > 0) pool = pool.filter((p) => (p.positions?.length ? p.positions : [p.position]).some((x) => positions.has(x)));
  if (nation) pool = pool.filter((p) => p.nation === nation);
  if (fromClub) pool = pool.filter((p) => p.fromClub === fromClub);
  if (minR !== null) pool = pool.filter((p) => p.overall >= minR);
  if (maxR !== null) pool = pool.filter((p) => p.overall <= maxR);
  if (minA !== null) pool = pool.filter((p) => (p.age ?? 24) >= minA);
  if (maxA !== null) pool = pool.filter((p) => (p.age ?? 24) <= maxA);
  if (maxV !== null) pool = pool.filter((p) => p.marketValue <= maxV);
  pool = [...pool].sort((a, b) => { const d = sortBy === "rating" ? a.overall - b.overall : a.marketValue - b.marketValue; return sortDesc ? -d : d; }).slice(0, 60);
  const active = positions.size + (nation ? 1 : 0) + (fromClub ? 1 : 0) + [minR, maxR, minA, maxA, maxV].filter((v) => v !== null).length;
  const togglePos = (pos: string) => setPositions((prev) => { const n = new Set(prev); if (n.has(pos)) n.delete(pos); else n.add(pos); return n; });

  return (
    <>
      <Line>
        <TextBox value={search} onChange={setSearch} placeholder="Search players…" />
        <SmallBtn flex={false} tone={showFilters || active > 0 ? "green" : "plain"} label={`Filters${active > 0 ? ` (${active})` : ""}`} onPress={() => setShowFilters(!showFilters)} />
      </Line>
      {showFilters && (
        <Card style={{ gap: 8 }}>
          <Head color={C.dim}>Position</Head>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
            {allPositions.map((pos) => (
              <Press key={pos} onPress={() => togglePos(pos)} style={{ paddingHorizontal: 9, paddingVertical: 5, borderRadius: 6, backgroundColor: positions.has(pos) ? "#10b981" : C.panel2 }}>
                <Text style={{ color: positions.has(pos) ? "#05261a" : C.text, fontWeight: "900", fontSize: 11 }}>{pos}</Text>
              </Press>
            ))}
          </View>
          <Head color={C.dim}>Nationality</Head>
          <Choose value={nation} onChange={setNation} options={[["", "Any"] as const, ...allNations.map((n) => [n, n] as const)]} />
          <Head color={C.dim}>Club</Head>
          <Choose value={fromClub} onChange={setFromClub} options={[["", "Any"] as const, ...allClubs.map((c) => [c, c === FREE_AGENTS_CLUB ? "Free agent" : c] as const)]} />
          <Head color={C.dim}>Rating range</Head>
          <Line><NumBox prefix="" placeholder="Min" value={minR} onChange={setMinR} /><Small>to</Small><NumBox prefix="" placeholder="Max" value={maxR} onChange={setMaxR} /></Line>
          <Head color={C.dim}>Age range</Head>
          <Line><NumBox prefix="" placeholder="Min" value={minA} onChange={setMinA} /><Small>to</Small><NumBox prefix="" placeholder="Max" value={maxA} onChange={setMaxA} /></Line>
          <Head color={C.dim}>Max market value</Head>
          <Line><NumBox placeholder="No cap" value={maxV} onChange={setMaxV} /></Line>
          <Head color={C.dim}>Sort by</Head>
          <Line>
            <SmallBtn tone={sortBy === "rating" ? "green" : "plain"} label="RATING" onPress={() => setSortBy("rating")} />
            <SmallBtn tone={sortBy === "value" ? "green" : "plain"} label="MARKET VALUE" onPress={() => setSortBy("value")} />
            <SmallBtn flex={false} label={sortDesc ? "High→Low" : "Low→High"} onPress={() => setSortDesc(!sortDesc)} />
          </Line>
          {active > 0 && <SmallBtn label="Clear filters" onPress={() => { setPositions(new Set()); setNation(""); setFromClub(""); setMinR(null); setMaxR(null); setMinA(null); setMaxA(null); setMaxV(null); }} />}
        </Card>
      )}
      <Card style={{ padding: 0 }}>
        {pool.map((p, n) => (
          <View key={`${p.fromClub}:${p.id}`} style={{ flexDirection: "row", alignItems: "center", padding: 10, borderTopWidth: n ? 1 : 0, borderTopColor: C.line }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.text, fontWeight: "800" }}>{p.name}</Text>
              <Text style={{ color: C.text, fontSize: 11 }}>{p.position} · OVR {p.overall} · ★{money(p.marketValue)} · {p.fromClub === FREE_AGENTS_CLUB ? "Free agent" : p.fromClub}</Text>
            </View>
            <SmallBtn flex={false} tone="green" label={p.fromClub === FREE_AGENTS_CLUB ? "Sign" : "Negotiate"}
              onPress={() => (p.fromClub === FREE_AGENTS_CLUB ? onSignFree(p.id, p.fromClub) : onNegotiate(p.id, p.fromClub, p.name, p.marketValue))} />
          </View>
        ))}
        {pool.length === 0 && <Text style={{ color: C.text, padding: 16, textAlign: "center" }}>No players match.</Text>}
      </Card>
    </>
  );
}

// ── MANAGER ─────────────────────────────────────────────────────────────────

function ManagerPanel({ career, club, onNegotiate }: { career: CareerState; club: string; onNegotiate: (name: string, anchorFee: number) => void }) {
  const current = club === career.player.club ? career.manager?.name : (managerFor(club) || ownedClubState(career, club).managerName);
  const market = career.availableManagers ?? allPoolManagers();
  return (
    <Card style={{ padding: 0 }}>
      {allPoolManagers().map((name) => {
        if (name === current) return <View key={name} style={{ padding: 10, borderTopWidth: 1, borderTopColor: C.line }}><Text style={{ color: "#6ee7b7", fontWeight: "800" }}>{name} (current)</Text></View>;
        if (!market.includes(name)) return null;
        const interest = managerInterest(career, name, club);
        return (
          <View key={name} style={{ flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderTopWidth: 1, borderTopColor: C.line }}>
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={{ color: C.text, fontWeight: "800" }}>{name}</Text>
              {!interest.willing ? <Small>{interest.reason}</Small> : null}
            </View>
            <SmallBtn flex={false} tone="green" disabled={!interest.willing} label={interest.willing ? "Negotiate" : "Not Interested"} onPress={() => onNegotiate(name, interest.anchorFee)} />
          </View>
        );
      })}
    </Card>
  );
}
