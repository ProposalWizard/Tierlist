/**
 * YOUR COUNTRY (the website's components/star/CallUpScreen.tsx and IntlKit.tsx):
 *   CallUpScreen   the squad announcement: the night stadium lit in the nation's colours,
 *                  the big drawn flag, CALLED UP / NOT SELECTED in the heavy font, the
 *                  matches card (date · competition · round, a flag each side), the national
 *                  manager's card (flag, line, the number and its verdict, the bar with the
 *                  SQUAD 34 and STARTER 55 marks), then the gold REPORT FOR DUTY → under them.
 *   WatchedScreen  not picked: the match you watched on TV (flags, score, WIN / DRAW / DEFEAT),
 *                  the manager's card, CONTINUE →.
 */
import { useMemo } from "react";
import { useCareer } from "../../game/store";
import { PitchBackdrop } from "./lookBits";
import { ScrollView, Text, View, type ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { CareerState, Fixture } from "@/lib/star/types";
import { SQUAD_AT, START_AT, intlOf, managerLine, type IntlDecision } from "@/lib/star/intl/career";
import { nationKits } from "@/lib/star/international";
import { fixtureTimestamp, divisionOf } from "@/lib/star/calendar";
import * as flow from "../../game/flow";
import { FONT, LookButton, rgba } from "../../ui/look";
import { NationFlag } from "../../draw/NationFlag";
import { glowOf } from "./lookBits";

const day = (t: number) => new Date(t).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const hex = (c: string, fallback: string) => (/^#[0-9a-f]{6}$/i.test(c) ? c : fallback);
export function nationGlow(nation: string): string {
  try { const k = nationKits(nation).home; return hex(glowOf(k.shirt, k.trim), "#38bdf8"); } catch { return "#38bdf8"; }
}

/** The night stadium behind the announcement (ui/Stadium.tsx, `big`, no pitch): sky, roof line, two floodlight banks with their beams. */
function Stadium({ glow }: { glow: string }) {
  const bank = (side: "left" | "right") => (
    <View style={{ position: "absolute", top: 86, [side]: "14%", width: 0, height: 0 } as ViewStyle}>
      <View style={{ position: "absolute", left: -112, top: -96, width: 224, height: 224, borderRadius: 112, backgroundImage: "radial-gradient(closest-side, rgba(220,235,255,0.40), rgba(220,235,255,0))" } as ViewStyle} />
      {/* the beam: narrow at the lamp, wide below */}
      <View style={{ position: "absolute", left: -18, top: 4, width: 36, height: 520, transformOrigin: "top", transform: [{ rotate: side === "left" ? "-30deg" : "30deg" }, { scaleX: 3.4 }],
        backgroundImage: "linear-gradient(180deg, rgba(220,235,255,0.13), rgba(220,235,255,0) 80%)" } as ViewStyle} />
      <View style={{ position: "absolute", left: -22, top: 0, width: 44, height: 18, borderRadius: 3, backgroundColor: "#1e293b", padding: 2, boxShadow: "0px 0px 10px 3px rgba(235,245,255,0.55)" } as ViewStyle}>
        <View style={{ flex: 1, borderRadius: 2, flexDirection: "row", flexWrap: "wrap", gap: 2, padding: 1, overflow: "hidden" }}>
          {Array.from({ length: 18 }, (_, i) => <View key={i} style={{ width: 4, height: 3, borderRadius: 2, backgroundColor: "#fff" }} />)}
        </View>
      </View>
    </View>
  );
  return (
    <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, height: 420, overflow: "hidden" }}>
      <View style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundImage: `radial-gradient(80% 60% at 50% 78%, ${rgba(glow, 0.55)} 0%, rgba(0,0,0,0) 70%), linear-gradient(180deg, #060a14 0%, #0b1322 55%, rgba(11,19,34,0.9) 100%)` } as ViewStyle} />
      <View style={{ position: "absolute", left: 0, right: 0, top: "8%", height: 2, backgroundImage: "linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,0.2), rgba(255,255,255,0))" } as ViewStyle} />
      {bank("left")}
      {bank("right")}
    </View>
  );
}

/** The League's glass card (ui ClubCard) lit in a colour. */
function GlowCard({ glow, children, style }: { glow: string; children: React.ReactNode; style?: ViewStyle }) {
  return (
    <View style={[{ borderRadius: 16, overflow: "hidden", backgroundImage: `radial-gradient(120% 90% at 50% 0%, ${rgba(glow, 0.22)} 0%, rgba(0,0,0,0) 60%), linear-gradient(180deg, rgba(31,41,55,0.92), rgba(12,17,28,0.96))`,
      boxShadow: `inset 0px 1px 0px rgba(255,255,255,0.10), inset 0px 0px 0px 1px ${rgba(glow, 0.32)}, 0px 10px 24px -12px rgba(0,0,0,0.8)` } as ViewStyle, style]}>
      {children}
    </View>
  );
}

/** One match: home name and flag, "v" or the score, away flag and name (IntlKit MatchRow). */
function MatchRow({ home, away, score, glow, mine }: { home: string; away: string; score?: string; glow: string; mine: boolean }) {
  return (
    <View style={[{ flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 6 },
      (mine ? { backgroundImage: `linear-gradient(90deg, ${rgba(glow, 0.38)}, ${rgba(glow, 0.14)})`, boxShadow: `inset 0px 0px 0px 1px ${rgba(glow, 0.6)}` } : { backgroundColor: "rgba(255,255,255,0.04)" }) as ViewStyle]}>
      <View style={{ flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 6 }}>
        <Text numberOfLines={1} style={{ flexShrink: 1, color: "#fff", fontSize: 11, fontWeight: "700", textAlign: "right" }}>{home}</Text>
        <NationFlag nation={home} width={18} />
      </View>
      <View style={{ borderRadius: 6, backgroundColor: "rgba(0,0,0,0.45)", paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" }}>
        <Text style={{ color: "#fff", fontSize: 11, fontWeight: "900" }}>{score ?? "v"}</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 6 }}>
        <NationFlag nation={away} width={18} />
        <Text numberOfLines={1} style={{ flexShrink: 1, color: "#fff", fontSize: 11, fontWeight: "700" }}>{away}</Text>
      </View>
    </View>
  );
}

/** The national manager, as a Training stat card (IntlKit ManagerCard). */
export function ManagerCard({ value, nation, line }: { value: number; nation: string; line: string }) {
  const v = Math.round(value);
  const [c1, c2] = v >= START_AT ? ["#f59e0b", "#fde68a"] : v >= SQUAD_AT ? ["#38bdf8", "#a5f3fc"] : ["#94a3b8", "#e2e8f0"];
  const verdict = v >= START_AT ? "Starter" : v >= SQUAD_AT ? "In the squad" : "Not picked";
  return (
    <View style={{ borderRadius: 16, padding: 12, overflow: "hidden",
      backgroundImage: `radial-gradient(120% 140% at 0% 0%, ${rgba(c1, 0.3)} 0%, rgba(0,0,0,0) 55%), linear-gradient(180deg, rgba(31,41,55,0.92), rgba(12,17,28,0.96))`,
      boxShadow: `inset 0px 1px 0px rgba(255,255,255,0.10), inset 0px 0px 0px 1px ${rgba(c1, 0.32)}, 0px 10px 24px -12px rgba(0,0,0,0.8)` } as ViewStyle}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={{ width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center",
          backgroundImage: `linear-gradient(180deg, ${rgba(c1, 0.35)}, ${rgba(c1, 0.14)})`, boxShadow: `inset 0px 1px 0px rgba(255,255,255,0.25), inset 0px 0px 0px 1px ${rgba(c1, 0.5)}, 0px 0px 12px ${rgba(c1, 0.45)}` } as ViewStyle}>
          <NationFlag nation={nation} width={30} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: "#fff", fontSize: 15, lineHeight: 18, fontWeight: "900" }}>{nation} manager</Text>
          <Text style={{ color: "rgba(255,255,255,0.75)", fontSize: 10.5, lineHeight: 14, fontWeight: "700" }}>{line}</Text>
        </View>
        <View style={{ alignItems: "center" }}>
          <Text style={{ color: c2, fontSize: 24, lineHeight: 26, fontWeight: "900", textShadowColor: rgba(c1, 0.7), textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 12 }}>{v}</Text>
          <Text style={{ color: c2, fontSize: 10, fontWeight: "900", letterSpacing: 0.4, marginTop: 2 }}>{verdict.toUpperCase()}</Text>
        </View>
      </View>
      <View style={{ marginTop: 10 }}>
        <View style={{ height: 12, borderRadius: 2, overflow: "hidden", backgroundColor: "rgba(0,0,0,0.45)", borderWidth: 1, borderColor: "rgba(255,255,255,0.14)" }}>
          <View style={{ width: `${Math.max(0, Math.min(100, v))}%`, height: "100%", backgroundImage: `linear-gradient(90deg, ${c1}, ${c2})` } as ViewStyle} />
        </View>
        <View style={{ position: "absolute", top: -2, height: 16, width: 2, backgroundColor: "#fff", left: `${SQUAD_AT}%` }} />
        <View style={{ position: "absolute", top: -2, height: 16, width: 2, backgroundColor: "#fcd34d", left: `${START_AT}%` }} />
      </View>
      <View style={{ marginTop: 4, height: 14 }}>
        <Text style={{ position: "absolute", left: `${SQUAD_AT}%`, width: 80, marginLeft: -40, textAlign: "center", color: "rgba(255,255,255,0.85)", fontSize: 9.5, fontWeight: "900", letterSpacing: 0.4 }}>SQUAD {SQUAD_AT}</Text>
        <Text style={{ position: "absolute", left: `${START_AT}%`, width: 90, marginLeft: -45, textAlign: "center", color: "#fcd34d", fontSize: 9.5, fontWeight: "900", letterSpacing: 0.4 }}>STARTER {START_AT}</Text>
      </View>
    </View>
  );
}

export function CallUpScreen({ go }: { go: (s: flow.Step) => void }) {
  // Worked out again whenever the real squads land (page.tsx decides on every draw). Decided once,
  // on a Home that had only just opened, it was made before the real players were in the save:
  // "their squad is picked at about 81" where the website, a moment later, says 87.
  const career = useCareer();
  const d: IntlDecision | null = useMemo(() => flow.callUpDecision(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [career?.leagueSquads, career?.externalSquads, career?.squad, career?.season, career?.intl]);
  if (!d) {
    return (
      <View style={{ flex: 1, backgroundColor: "#05080f", justifyContent: "center", padding: 16 }}>
        <LookButton kind="gold" label="BACK TO THE CLUB →" onPress={() => go(flow.HOME)} />
      </View>
    );
  }
  const { called, nation, period, reason, manager, line, starter } = d;
  const tournament = period.kind === "tournament";
  const matches = period.matches.slice(0, tournament ? 3 : 6);
  const glow = called ? nationGlow(nation) : "#64748b";
  return (
    <View style={{ flex: 1, backgroundColor: "#05080f" }}>
      {/* under the night stadium the page is the pitch look (the website's Training and League pages) */}
      <PitchBackdrop />
      <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, height: "62%", backgroundImage: "linear-gradient(180deg, #05080f 0%, rgba(5,8,15,0.96) 70%, rgba(5,8,15,0) 100%)" } as ViewStyle} />
      <Stadium glow={glow} />
      <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 32, paddingTop: 24, width: "100%", maxWidth: 448, alignSelf: "center" }}>
          <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 11, fontWeight: "700", letterSpacing: 2.4, textAlign: "center" }}>
            {(tournament ? period.label : `International break · ${period.label}`).toUpperCase()}
          </Text>
          <View style={{ marginTop: 32, alignItems: "center" }}>
            <View style={{ opacity: called ? 1 : 0.6, boxShadow: `0px 8px 30px rgba(0,0,0,0.6), 0px 0px 44px 6px ${rgba(glow, 0.55)}`, borderRadius: 4 } as ViewStyle}>
              <NationFlag nation={nation} width={132} />
            </View>
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={{ marginTop: 24, color: called ? "#fff" : "#cbd5e1", fontFamily: FONT.display, fontSize: 56, lineHeight: 62, textTransform: "uppercase",
              ...(called ? { textShadowColor: rgba(glow, 0.9), textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 28 } : {}) }}>
              {called ? "Called up" : "Not selected"}
            </Text>
            <Text style={{ marginTop: 12, color: "#fff", fontSize: 15, fontWeight: "700", textAlign: "center" }}>
              {called ? `You're in the ${nation} squad${tournament ? ` for the ${period.comp}` : ""}${starter ? " — as a starter" : ""}.` : `Left out of the ${nation} squad.`}
            </Text>
            <Text style={{ marginTop: 4, color: "rgba(255,255,255,0.85)", fontSize: 13, fontWeight: "600", textAlign: "center" }}>{reason}</Text>
          </View>

          <GlowCard glow={glow} style={{ marginTop: 28 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.1)", backgroundColor: "rgba(0,0,0,0.3)", paddingHorizontal: 10, paddingVertical: 6 }}>
              <Text style={{ color: "#fcd34d", fontSize: 10, fontWeight: "900", letterSpacing: 1.8 }}>{(tournament ? "Group games" : `${nation}'s matches`).toUpperCase()}</Text>
              <Text style={{ color: "rgba(255,255,255,0.75)", fontSize: 10, fontWeight: "900", letterSpacing: 0.4 }}>{matches.length} {matches.length === 1 ? "MATCH" : "MATCHES"}</Text>
            </View>
            <View style={{ padding: 6, gap: 4 }}>
              {matches.map((m) => (
                <View key={m.id}>
                  <Text style={{ paddingHorizontal: 4, paddingVertical: 2, color: "rgba(255,255,255,0.75)", fontSize: 9.5, fontWeight: "700" }}>{day(m.date)} · {m.comp} · {m.stage}</Text>
                  <MatchRow home={m.home} away={m.away} glow={glow} mine={m.home === nation || m.away === nation} />
                </View>
              ))}
            </View>
            <View style={{ borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.1)", backgroundColor: "rgba(0,0,0,0.25)", paddingHorizontal: 10, paddingVertical: 6 }}>
              <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 11, fontWeight: "700" }}>
                {!called ? "Played without you." : tournament ? `You stay with the squad until ${nation} are knocked out.` : "Any club games in between are played without you."}
              </Text>
            </View>
          </GlowCard>

          <View style={{ marginTop: 10 }}><ManagerCard value={manager} nation={nation} line={line} /></View>

          <LookButton kind="gold" onPress={() => go(flow.answerCallUp(d))} style={{ marginTop: 24, borderRadius: 16, paddingVertical: 14 }}>
            <Text style={{ color: "#111827", fontSize: 15, fontWeight: "900" }}>{called ? "REPORT FOR DUTY →" : "BACK TO THE CLUB →"}</Text>
          </LookButton>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

export function WatchedScreen({ career, go }: { career: CareerState; go: (s: flow.Step) => void }) {
  const f: Fixture | undefined = [...career.fixtures].reverse().find((x) => x.kind === "international" && x.played && x.watch);
  const s = intlOf(career);
  const nation = s.nation;
  const glow = nationGlow(nation);
  const us = f ? (f.home ? f.homeScore : f.awayScore) : undefined;
  const them = f ? (f.home ? f.awayScore : f.homeScore) : undefined;
  const verdict = us === undefined || them === undefined ? "" : us > them ? "WIN" : us < them ? "DEFEAT" : "DRAW";
  const t = f ? fixtureTimestamp(career.player.startYear, career.season, f.week, f.kind, divisionOf(career)) : 0;
  const left = f ? (f.home ? nation : f.opponent) : nation, right = f ? (f.home ? f.opponent : nation) : "";
  return (
    <View style={{ flex: 1, backgroundColor: "#05080f" }}>
      <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, height: 288, backgroundImage: `radial-gradient(70% 80% at 50% 0%, ${rgba(glow, 0.4)} 0%, rgba(0,0,0,0) 70%)` } as ViewStyle} />
      <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 32, paddingTop: 20, gap: 10, width: "100%", maxWidth: 448, alignSelf: "center" }}>
          <View>
            <Text style={{ color: "#fcd34d", fontSize: 10.5, fontWeight: "900", letterSpacing: 2.3, textAlign: "center" }}>📺 WATCHED ON TV{f ? ` · ${day(t).toUpperCase()}` : ""}</Text>
            {f && <Text style={{ marginTop: 4, color: "rgba(255,255,255,0.85)", fontSize: 12, fontWeight: "700", textAlign: "center" }}>{[f.competition, f.round].filter(Boolean).join(" · ")}</Text>}
          </View>
          {f && (
            <GlowCard glow={glow} style={{ padding: 16 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View style={{ flex: 1, alignItems: "center", gap: 6 }}>
                  <NationFlag nation={left} width={56} />
                  <Text style={{ color: "#fff", fontSize: 13, fontWeight: "900", textAlign: "center" }}>{left}</Text>
                </View>
                <View style={{ alignItems: "center" }}>
                  <Text style={{ color: "#fff", fontSize: 40, lineHeight: 44, fontWeight: "900" }}>{f.homeScore ?? "-"}–{f.awayScore ?? "-"}</Text>
                  {!!verdict && <Text style={{ marginTop: 4, color: verdict === "WIN" ? "#6ee7b7" : verdict === "DEFEAT" ? "#fca5a5" : "rgba(255,255,255,0.8)", fontSize: 11, fontWeight: "900", letterSpacing: 2 }}>{nation.toUpperCase()} {verdict}</Text>}
                </View>
                <View style={{ flex: 1, alignItems: "center", gap: 6 }}>
                  <NationFlag nation={right} width={56} />
                  <Text style={{ color: "#fff", fontSize: 13, fontWeight: "900", textAlign: "center" }}>{right}</Text>
                </View>
              </View>
            </GlowCard>
          )}
          <ManagerCard value={s.manager} nation={nation} line={managerLine(career)} />
          <LookButton kind="gold" onPress={() => go(flow.HOME)} style={{ borderRadius: 16, paddingVertical: 14 }}>
            <Text style={{ color: "#111827", fontSize: 15, fontWeight: "900" }}>CONTINUE →</Text>
          </LookButton>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
