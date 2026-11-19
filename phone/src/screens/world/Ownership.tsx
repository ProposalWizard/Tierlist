/**
 * OWNERSHIP — the phone port of components/star/OwnershipScreen.tsx (the
 * phone's "Owner" app): a reputation strip (opens Fame & Reputation), the
 * governing bodies (opens the Rule Book), a card per club you hold a stake in
 * (majority: its boardroom; otherwise the portfolio) and "Browse Clubs to
 * Invest In". Plus ReputationScreen (components/star/SecondaryScreens.tsx).
 */
import { Text, View } from "react-native";
import { reputationLabel, REPUTATION_RECOMMEND_MIN, REPUTATION_PROPOSE_RULES_MIN, REPUTATION_PRESIDENCY_MIN } from "@/lib/star/reputation";
import { fameOf, fameLevel, nextFameLevel, FAME_LEVELS } from "@/lib/star/fame";
import { MAJORITY_THRESHOLD, clubValuation } from "@/lib/star/investments";
import { GOVERNING_BODIES, influenceIn, canProposeRuleChange } from "@/lib/star/governingBodies";
import { isBodyPresident } from "@/lib/star/leadership";
import { formatMoney } from "@/lib/star/money";
import { useCareer } from "../../game/store";
import { useNav } from "../../nav";
import { Press } from "../../ui/Press";
import { Frame, Card, Label, Btn, ClubCrest, Fill, C } from "../../world/lookKit";
import { pctText } from "./politicsKit";

function RepBar({ label, value }: { label: string; value: number }) {
  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 3 }}>
        <Text numberOfLines={1} style={{ color: C.text, fontSize: 10, fontWeight: "900", flex: 1 }}>{label}</Text>
        <Text style={{ color: C.text, fontSize: 10, fontWeight: "900" }}>{value}</Text>
      </View>
      <Fill value={value} color={C.green} height={8} />
    </View>
  );
}

export function OwnershipScreen() {
  const career = useCareer();
  const nav = useNav();
  if (!career) return null;
  const rep = career.reputation;
  const owned = (career.investments ?? []).filter((i) => i.percent > 0).sort((a, b) => b.percent - a.percent);
  const anyPresidency = GOVERNING_BODIES.some((b) => isBodyPresident(career, b));
  const anyCanPropose = GOVERNING_BODIES.some((b) => canProposeRuleChange(career, b));
  return (
    <Frame kicker="Your empire" title="Ownership" onBack={() => nav.back()}>
      <Press onPress={() => nav.go("reputation")}>
        <Card tone="rgba(16,185,129,0.6)">
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
            <Text style={{ color: C.text, fontSize: 11, fontWeight: "900", letterSpacing: 1.5 }}>🌍 REPUTATION</Text>
            <Text style={{ color: "#6ee7b7", fontSize: 11, fontWeight: "900" }}>Details →</Text>
          </View>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <RepBar label={`Reputation · ${reputationLabel(rep)}`} value={rep} />
            <RepBar label={`Fame · ${fameLevel(fameOf(career)).name}`} value={fameOf(career)} />
          </View>
        </Card>
      </Press>

      <Press onPress={() => nav.go("rule-book")}>
        <Card tone="rgba(99,102,241,0.6)">
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
            <Text style={{ color: C.text, fontSize: 11, fontWeight: "900", letterSpacing: 1.5 }}>⚖️ RULE BOOK & GOVERNING BODIES</Text>
            <Text style={{ color: "#a5b4fc", fontSize: 11, fontWeight: "900" }}>Open →</Text>
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {GOVERNING_BODIES.map((b) => {
              const president = isBodyPresident(career, b);
              return (
                <View key={b} style={{ borderRadius: 99, paddingHorizontal: 9, paddingVertical: 4, backgroundColor: president ? C.gold : C.panel2 }}>
                  <Text style={{ color: president ? "#111" : C.text, fontSize: 11, fontWeight: "900" }}>{president ? "👑" : ""}{b} {influenceIn(career, b)}</Text>
                </View>
              );
            })}
          </View>
          <Text style={{ color: C.text, fontSize: 11, fontWeight: "700", marginTop: 8 }}>
            {anyPresidency ? "You hold a presidency — real powers unlocked."
              : anyCanPropose ? "You have enough influence to propose a rule change."
              : "Invest influence with a governing body to start proposing changes."}
          </Text>
        </Card>
      </Press>

      <Label>{`Your Clubs${owned.length > 0 ? ` (${owned.length})` : ""}`}</Label>
      {owned.length === 0 ? (
        <Card><Text style={{ color: C.text, fontWeight: "700", textAlign: "center" }}>You don't hold a stake in any club yet.</Text></Card>
      ) : owned.map((stake) => {
        const majority = stake.percent >= MAJORITY_THRESHOLD;
        const value = Math.round(clubValuation(stake.club, career) * (stake.percent / 100));
        return (
          <Press key={stake.club} onPress={() => (majority ? nav.go("investments", { tab: "boardroom", club: stake.club }) : nav.go("investments", { tab: "market" }))}>
            <Card tone={majority ? "rgba(251,191,36,0.6)" : undefined} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12 }}>
              <ClubCrest club={stake.club} size={34} />
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={{ color: C.text, fontWeight: "900" }}>{stake.club}</Text>
                <Text style={{ color: C.text, fontSize: 11, fontWeight: "700" }}>{pctText(stake.percent)} owned{majority ? <Text style={{ color: C.gold }}> · Majority</Text> : null}</Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={{ color: C.gold, fontWeight: "900" }}>★{formatMoney(value)}</Text>
                <Text style={{ color: C.dim, fontSize: 10, fontWeight: "800" }}>{majority ? "Boardroom →" : "Portfolio →"}</Text>
              </View>
            </Card>
          </Press>
        );
      })}

      <Btn label="Browse Clubs to Invest In" onPress={() => nav.go("investments", { tab: "market" })} />
    </Frame>
  );
}

function ReputationRow({ label, value, icon, blurb }: { label: string; value: number; icon: string; blurb: string }) {
  return (
    <View style={{ marginBottom: 6 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: C.panel2, alignItems: "center", justifyContent: "center" }}><Text style={{ fontSize: 20 }}>{icon}</Text></View>
        <View style={{ flex: 1, height: 36, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.08)", overflow: "hidden", justifyContent: "center" }}>
          <View style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${Math.max(0, Math.min(100, value))}%`, backgroundColor: "rgba(52,211,153,0.55)" }} />
          <Text style={{ color: C.text, fontWeight: "900", textAlign: "center", fontSize: 13 }}>{label}  <Text style={{ fontSize: 12 }}>{value}</Text></Text>
        </View>
      </View>
      <Text style={{ color: C.text, fontSize: 10, fontWeight: "600", marginTop: 4, marginLeft: 44 }}>{blurb}</Text>
    </View>
  );
}

export function ReputationScreen() {
  const career = useCareer();
  const nav = useNav();
  if (!career) return null;
  const rep = career.reputation;
  const fame = fameOf(career);
  const level = fameLevel(fame);
  const next = nextFameLevel(fame);
  const earned = Math.round(career.fame);
  const fromOwned = Math.max(0, fame - earned);
  const repUnlocks = [
    { min: 0, text: "Buy shares in clubs — votes lean your way more as this rises" },
    { min: REPUTATION_RECOMMEND_MIN, text: "Club boards take your recommendations seriously" },
    { min: REPUTATION_PROPOSE_RULES_MIN, text: "Propose Rule Book changes (influence also needed)" },
    { min: REPUTATION_PRESIDENCY_MIN, text: "Stand for president of the FA, UEFA, FIFA or CONMEBOL" },
  ];
  return (
    <Frame kicker="Ownership" title="Fame & Reputation" onBack={() => nav.back()}>
      <Card tone="rgba(251,191,36,0.4)">
        <ReputationRow label={`Fame · ${level.name}`} value={fame} icon="⭐"
          blurb="How many people know your name. Earned from big moments — promotions, trophies, awards, the Golden Ball — plus what you own. Playing well alone earns none." />
        <Text style={{ color: C.text, fontSize: 12, fontWeight: "800", marginTop: 4 }}>
          {earned} earned + {fromOwned} from what you own{next ? ` · ${next.min - fame} to ${next.name}` : " · maxed"}
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 8 }}>
          {FAME_LEVELS.map((l) => (
            <View key={l.name} style={{ width: "32%", borderRadius: 6, paddingVertical: 4, alignItems: "center", backgroundColor: fame >= l.min ? C.gold : C.panel2 }}>
              <Text style={{ color: fame >= l.min ? "#111" : C.text, fontSize: 10, fontWeight: "900" }}>{l.name} {l.min}+</Text>
            </View>
          ))}
        </View>
      </Card>
      <Card tone="rgba(52,211,153,0.4)">
        <ReputationRow label={`Reputation · ${reputationLabel(rep)}`} value={rep} icon="🤝"
          blurb="Whether the people who run football trust you. Up with trophies, clean seasons and good causes; down with scandals, overruling votes and merging clubs." />
        <View style={{ gap: 5, marginTop: 6 }}>
          {repUnlocks.map((u) => (
            <View key={u.min} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View style={{ width: 38, borderRadius: 6, paddingVertical: 2, alignItems: "center", backgroundColor: rep >= u.min ? C.green : C.panel2 }}>
                <Text style={{ color: rep >= u.min ? "#111" : C.text, fontSize: 11, fontWeight: "900" }}>{u.min}+</Text>
              </View>
              <Text style={{ flex: 1, color: C.text, fontSize: 12, fontWeight: "700" }}>{u.text}</Text>
            </View>
          ))}
        </View>
      </Card>
      {(career.fameNews?.length ?? 0) > 0 && (
        <Card>
          <Label color={C.dim}>Last season</Label>
          {career.fameNews!.map((line, i) => <Text key={i} style={{ color: C.text, fontSize: 12, fontWeight: "700" }}>{line}</Text>)}
        </Card>
      )}
    </Frame>
  );
}
