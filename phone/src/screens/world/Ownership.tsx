/**
 * OWNERSHIP — the phone port of components/star/OwnershipScreen.tsx (the
 * phone's "Owner" app): a reputation strip (opens Fame & Reputation), the
 * governing bodies (opens the Rule Book), a card per club you hold a stake in
 * (majority: its boardroom; otherwise the portfolio) and "Browse Clubs to
 * Invest In". Plus ReputationScreen (components/star/SecondaryScreens.tsx).
 */
import type { ReactNode } from "react";
import { Text, View, type ViewStyle } from "react-native";
import { reputationLabel, REPUTATION_RECOMMEND_MIN, REPUTATION_PROPOSE_RULES_MIN, REPUTATION_PRESIDENCY_MIN } from "@/lib/star/reputation";
import { fameOf, fameLevel, nextFameLevel, FAME_LEVELS } from "@/lib/star/fame";
import { MAJORITY_THRESHOLD, clubValuation } from "@/lib/star/investments";
import { GOVERNING_BODIES, influenceIn, canProposeRuleChange } from "@/lib/star/governingBodies";
import { isBodyPresident } from "@/lib/star/leadership";
import { formatMoney } from "@/lib/star/money";
import { useCareer } from "../../game/store";
import { useNav } from "../../nav";
import { Press } from "../../ui/Press";
import { Frame, Card, Label, Btn, ClubCrest, C, KIT_ROW } from "../../world/lookKit";
import { pctText } from "./politicsKit";

/** The website's StatBar colours: green from 60, amber from 35, red under. */
const levelColors = (v: number): [string, string] => (v >= 60 ? ["#34d399", "#a3e635"] : v >= 35 ? ["#f59e0b", "#fde047"] : ["#dc2626", "#fb7185"]);
/** The liquid bar (ui/LiquidBar.tsx): a dark rounded track with a hairline, the fill deep → light with a gloss on top. */
function StatBar({ value, height, children }: { value: number; height: number; children?: ReactNode }) {
  const v = Math.max(0, Math.min(100, value));
  const [a, b] = levelColors(v);
  return (
    <View style={{ height, borderRadius: height / 2, overflow: "hidden", justifyContent: "center", backgroundImage: "linear-gradient(180deg, rgba(0,0,0,0.78), rgba(0,0,0,0.55))", boxShadow: "inset 0px 1px 3px rgba(0,0,0,0.8), inset 0px 0px 0px 1px rgba(255,255,255,0.22)" } as ViewStyle}>
      {v > 0 ? (
        <View style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${v}%`, minWidth: Math.min(height, 8), borderRadius: height / 2, overflow: "hidden", backgroundImage: `linear-gradient(90deg, ${a}, ${b})`, boxShadow: "inset 0px -2px 4px rgba(0,0,0,0.28)" } as ViewStyle}>
          <View pointerEvents="none" style={{ position: "absolute", left: 3, right: 3, top: "8%", height: "38%", borderRadius: height, backgroundImage: "linear-gradient(180deg, rgba(255,255,255,0.62), rgba(255,255,255,0.06))" } as ViewStyle} />
        </View>
      ) : null}
      {children}
    </View>
  );
}

function RepBar({ label, value }: { label: string; value: number }) {
  return (
    <View style={{ flex: 1, minWidth: 0 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
        <Text numberOfLines={1} style={{ color: C.text, fontSize: 9, lineHeight: 13.5, fontWeight: "900", flexShrink: 1 }}>{label}</Text>
        <Text style={{ color: C.text, fontSize: 9, lineHeight: 13.5, fontWeight: "900", fontVariant: ["tabular-nums"] }}>{value}</Text>
      </View>
      <StatBar value={value} height={8} />
    </View>
  );
}
const HEAD = { color: "rgba(255,255,255,0.9)", fontSize: 10, lineHeight: 15, fontWeight: "900", letterSpacing: 1 } as const;

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
        <Card>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <Text style={HEAD}>🌍 REPUTATION</Text>
            <Text style={{ color: "#6ee7b7", fontSize: 10, lineHeight: 15, fontWeight: "900" }}>Details →</Text>
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <RepBar label={`Reputation · ${reputationLabel(rep)}`} value={rep} />
            <RepBar label={`Fame · ${fameLevel(fameOf(career)).name}`} value={fameOf(career)} />
          </View>
        </Card>
      </Press>

      <Press onPress={() => nav.go("rule-book")}>
        <Card>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <Text style={HEAD}>⚖️ RULE BOOK & GOVERNING BODIES</Text>
            <Text style={{ color: "#a5b4fc", fontSize: 10, lineHeight: 15, fontWeight: "900" }}>Open →</Text>
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {GOVERNING_BODIES.map((b) => {
              const president = isBodyPresident(career, b);
              return (
                <View key={b} style={[{ borderRadius: 99, paddingHorizontal: 8, paddingVertical: 4 }, president ? ({ backgroundImage: "linear-gradient(180deg, #fde047, #f59e0b)" } as ViewStyle) : KIT_ROW]}>
                  <Text style={{ color: president ? "#000" : C.text, fontSize: 9, lineHeight: 13.5, fontWeight: "900" }}>{president ? "👑" : ""}{b} {influenceIn(career, b)}</Text>
                </View>
              );
            })}
          </View>
          <Text style={{ color: "rgba(255,255,255,0.9)", fontSize: 9, lineHeight: 13.5, fontWeight: "600", marginTop: 6 }}>
            {anyPresidency ? "You hold a presidency — real powers unlocked."
              : anyCanPropose ? "You have enough influence to propose a rule change."
              : "Invest influence with a governing body to start proposing changes."}
          </Text>
        </Card>
      </Press>

      {/* SectionLabel mb-1.5 mt-1: 4 px more above it, 6 px to the first card (the page's gap is 10) */}
      <Label style={{ marginTop: 4, marginBottom: -4 }}>{`Your Clubs${owned.length > 0 ? ` (${owned.length})` : ""}`}</Label>
      {owned.length === 0 ? (
        // the website's empty card has no space under it: the button touches it
        <Card style={{ paddingHorizontal: 16, paddingVertical: 24, marginBottom: -10 }}><Text style={{ color: "rgba(255,255,255,0.9)", fontSize: 14, lineHeight: 20, fontWeight: "600", textAlign: "center" }}>You don't hold a stake in any club yet.</Text></Card>
      ) : owned.map((stake, i) => {
        const majority = stake.percent >= MAJORITY_THRESHOLD;
        const value = Math.round(clubValuation(stake.club, career) * (stake.percent / 100));
        return (
          <Press key={stake.club} onPress={() => (majority ? nav.go("investments", { tab: "boardroom", club: stake.club }) : nav.go("investments", { tab: "market" }))}>
            <Card style={[{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, paddingHorizontal: 12, paddingVertical: 10, marginBottom: i < owned.length - 1 ? -2 : 0 },
              majority && ({ boxShadow: "inset 0px 0px 0px 1px rgba(251,191,36,0.5), 0px 10px 24px -12px rgba(0,0,0,0.8)" } as ViewStyle)]}>
              <ClubCrest club={stake.club} size={34} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text numberOfLines={1} style={{ color: C.text, fontSize: 14, lineHeight: 20, fontWeight: "900" }}>{stake.club}</Text>
                <Text style={{ color: "rgba(255,255,255,0.9)", fontSize: 10, lineHeight: 15, fontWeight: "700" }}>{pctText(stake.percent)} owned{majority ? <Text style={{ color: "#fcd34d" }}>  · Majority</Text> : null}</Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={{ color: "#fde047", fontSize: 12, lineHeight: 18, fontWeight: "900", fontVariant: ["tabular-nums"] }}>★{formatMoney(value)}</Text>
                <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 9, lineHeight: 13.5, fontWeight: "700" }}>{majority ? "Boardroom →" : "Portfolio →"}</Text>
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
    <View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View style={[{ width: 36, height: 36, borderRadius: 8, alignItems: "center", justifyContent: "center" }, KIT_ROW]}><Text style={{ fontSize: 20, lineHeight: 28 }}>{icon}</Text></View>
        <View style={{ flex: 1 }}>
          <StatBar value={value} height={36}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: "#fff", fontSize: 14, lineHeight: 20, fontWeight: "900", textShadowColor: "rgba(0,0,0,0.8)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 }}>{label}</Text>
              <View style={{ marginLeft: 8, borderRadius: 99, paddingHorizontal: 8, backgroundColor: "rgba(0,0,0,0.5)" }}><Text style={{ color: "#fff", fontSize: 12, lineHeight: 16, fontWeight: "900", fontVariant: ["tabular-nums"] }}>{value}</Text></View>
            </View>
          </StatBar>
        </View>
      </View>
      <Text style={{ color: "rgba(255,255,255,0.9)", fontSize: 9, lineHeight: 13.5, fontWeight: "600", marginTop: 4, marginLeft: 44 }}>{blurb}</Text>
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
      {/* the website's page is space-y-3: 12 px between cards (the Frame's gap is 10) */}
      <Card style={{ marginBottom: 2, boxShadow: "inset 0px 0px 0px 1px rgba(251,191,36,0.35), 0px 10px 24px -12px rgba(0,0,0,0.8)" } as ViewStyle}>
        <ReputationRow label={`Fame · ${level.name}`} value={fame} icon="⭐"
          blurb="How many people know your name. Earned from big moments — promotions, trophies, awards, the Golden Ball — plus what you own. Playing well alone earns none." />
        <Text style={{ color: C.text, fontSize: 11, lineHeight: 16.5, fontWeight: "700", marginTop: 8 }}>
          {earned} earned + {fromOwned} from what you own{next ? ` · ${next.min - fame} to ${next.name}` : " · maxed"}
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 8 }}>
          {FAME_LEVELS.map((l) => (
            <View key={l.name} style={[{ width: "32.4%", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 4, alignItems: "center" }, fame >= l.min ? ({ backgroundImage: "linear-gradient(180deg, #fde047, #f59e0b)" } as ViewStyle) : KIT_ROW]}>
              <Text numberOfLines={1} style={{ color: fame >= l.min ? "#030712" : C.text, fontSize: 9, lineHeight: 13.5, fontWeight: "900" }}>{l.name} {l.min}+</Text>
            </View>
          ))}
        </View>
      </Card>
      <Card style={{ marginBottom: 2, boxShadow: "inset 0px 0px 0px 1px rgba(52,211,153,0.35), 0px 10px 24px -12px rgba(0,0,0,0.8)" } as ViewStyle}>
        <ReputationRow label={`Reputation · ${reputationLabel(rep)}`} value={rep} icon="🤝"
          blurb="Whether the people who run football trust you. Up with trophies, clean seasons and good causes; down with scandals, overruling votes and merging clubs." />
        <View style={{ gap: 4, marginTop: 8 }}>
          {repUnlocks.map((u) => (
            <View key={u.min} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View style={[{ width: 36, borderRadius: 6, alignItems: "center" }, rep >= u.min ? ({ backgroundImage: "linear-gradient(180deg, #6ee7b7, #10b981)" } as ViewStyle) : KIT_ROW]}>
                <Text style={{ color: rep >= u.min ? "#030712" : C.text, fontSize: 10, lineHeight: 15, fontWeight: "900" }}>{u.min}+</Text>
              </View>
              <Text style={{ flex: 1, color: C.text, fontSize: 11, lineHeight: 16.5, fontWeight: "700" }}>{u.text}</Text>
            </View>
          ))}
        </View>
      </Card>
      {(career.fameNews?.length ?? 0) > 0 && (
        <Card>
          <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 10, lineHeight: 15, fontWeight: "900", letterSpacing: 1, marginBottom: 6 }}>LAST SEASON</Text>
          {career.fameNews!.map((line, i) => <Text key={i} style={{ color: C.text, fontSize: 11, lineHeight: 16.5, fontWeight: "700" }}>{line}</Text>)}
        </Card>
      )}
    </Frame>
  );
}
