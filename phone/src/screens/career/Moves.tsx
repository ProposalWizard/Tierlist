/**
 * MOVES (page.tsx: wage-talk, relegation-move).
 *  - WageTalk: haggling over the manager's first number, on the same
 *    negotiation every transfer uses (world/Negotiation.tsx = the website's
 *    NegotiationScreen), opened on talk.negotiation, in a SEASON's wages.
 *  - RelegationMove: your club finished in the bottom four of a regional
 *    league; pick a new club (RelegationMove.tsx). Signing goes straight on
 *    through the flow (handleChooseTransfer → handleSigningDone).
 */
import { View, Text } from "react-native";
import type { CareerState } from "@/lib/star/types";
import type { TransferOffer } from "@/lib/star/transfers";
import { reputation, MOVE_RESET } from "@/lib/star/transfers";
import { clauseSummary } from "@/lib/star/contracts";
import { divisionOf, divisionRank, leagueNameFor } from "@/lib/star/calendar";
import { weeklyToSeason } from "@/lib/star/signingTalk";
import * as flow from "../../game/flow";
import { Negotiation } from "../world/Negotiation";
import { Frame, Card, Label, Btn, ClubCrest, C } from "./kit";

export function WageTalkScreen({ career, go }: { career: CareerState; go: (s: flow.Step) => void }) {
  const m = flow.managerTalk(career);
  if (!m) return <Frame title="Talks"><Btn label="See the offers" onPress={() => go({ screen: "career-offers" })} /></Frame>;
  return (
    <Negotiation
      mode="selling"
      playerName={`${career.player.firstName} ${career.player.lastName} — terms with ${m.offer.club}`}
      marketValue={weeklyToSeason(m.talk.fairWeekly, m.talk.division)}
      counterpartLabel={m.offer.club}
      initialState={m.talk.negotiation}
      onDone={(finalSeasonPrice) => go(flow.wageTalkDone(finalSeasonPrice))}
    />
  );
}

function Cell({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={{ flex: 1, backgroundColor: C.panel2, borderRadius: 8, paddingVertical: 6, alignItems: "center" }}>
      <Text style={{ color: C.dim, fontSize: 9, fontWeight: "800", letterSpacing: 1 }}>{label.toUpperCase()}</Text>
      <Text style={{ color: highlight ? C.green : C.text, fontSize: 14, fontWeight: "900" }}>{value}</Text>
    </View>
  );
}

export function RelegationMoveScreen({ career, offers, go }: { career: CareerState; offers: TransferOffer[]; go: (s: flow.Step) => void }) {
  const rep = Math.round(reputation(career));
  return (
    <Frame kicker="Relegated" title="You need a new club">
      <Card tone={C.red}>
        <Text style={{ color: C.text, fontSize: 18, fontWeight: "900", textAlign: "center" }}>{career.player.club} are down. You need a new club.</Text>
        <Text style={{ color: C.text, fontSize: 12, marginTop: 6, textAlign: "center" }}>Your reputation is <Text style={{ fontWeight: "900" }}>{rep}</Text> — a season the club had, not one you personally have to answer for.</Text>
      </Card>
      {offers.map((o) => {
        const offerDivision = o.division ?? divisionOf(career);
        const stepUp = divisionRank(offerDivision) < divisionRank(divisionOf(career));
        const clauses = clauseSummary({ ...career.contract, ...o.clauses });
        return (
          <Card key={o.club}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <ClubCrest club={o.club} size={34} />
              <Text numberOfLines={1} style={{ flex: 1, color: C.text, fontSize: 17, fontWeight: "900" }}>{o.club}</Text>
              <Text style={{ color: stepUp ? C.green : C.text, fontSize: 10, fontWeight: "900" }}>{leagueNameFor(offerDivision).toUpperCase()}</Text>
            </View>
            <Text style={{ color: C.text, fontSize: 12, marginTop: 6 }}>{o.pitch}</Text>
            <View style={{ flexDirection: "row", gap: 6, marginTop: 10 }}>
              <Cell label="Wage" value={`★${o.wage}`} highlight={o.wage > career.contract.wage} />
              <Cell label="Goal" value={`★${o.goalBonus}`} highlight={o.goalBonus > career.contract.goalBonus} />
              <Cell label="Signing" value={`★${o.signingFee}`} highlight />
              <Cell label="Years" value={`${o.seasons}`} />
            </View>
            {clauses.map((c) => <Text key={c.label} style={{ color: C.text, fontSize: 11, marginTop: 4 }}><Text style={{ fontWeight: "900" }}>{c.label}</Text> — {c.detail}</Text>)}
            <View style={{ marginTop: 10 }}><Btn label={`Sign for ${o.club}`} onPress={() => go(flow.chooseRelegationOffer(o))} /></View>
          </Card>
        );
      })}
      <Card>
        <Label color={C.dim}>What a move costs</Label>
        <Text style={{ color: C.text, fontSize: 12 }}>A new dressing room does not know you and a new manager has not picked you before. Team-mates start at {MOVE_RESET.team}, the manager at {MOVE_RESET.boss}, and you lose a little sharpness settling in. Your place in the side is earned again.</Text>
      </Card>
    </Frame>
  );
}
