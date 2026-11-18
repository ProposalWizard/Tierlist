/**
 * HOME, as the website's Home (components/star/HomeHub.tsx + TopHud):
 * the energy and star bars, the next match (both clubs, competition, date,
 * days to go, last five), the four numbers (Rep, Fame, Goals, Assists), your
 * league position, your boots, the drinks (Basic / Premium / Elite cans) and
 * the ways to Stats, Training, Shop and Settings. When the season is over,
 * "End of Season" waits here: you end it yourself.
 */
import { useEffect } from "react";
import { ScrollView, View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { CareerState, Fixture } from "@/lib/star/types";
import { nextFixtureFor, byFixtureDate, fixtureLabel } from "@/lib/star/competitions";
import { fixtureDateLabel, fixtureTimestamp, divisionOf, leagueNameFor } from "@/lib/star/calendar";
import { sortLeague } from "@/lib/star/season";
import { shortClub } from "@/lib/star/media/grammar";
import { starStatus } from "@/lib/star/starPoints";
import { fameOf } from "@/lib/star/fame";
import { KIB_CANS, kibCanPrice } from "@/lib/star/shopData";
import { periodDue } from "@/lib/star/intl/career";
import { trainingLeft } from "@/lib/star/week";
import * as flow from "../game/flow";
import { useSession, setSession } from "../game/session";
import { useNav } from "../nav";
import { SCREENS } from "../areas/registry";
import { Press } from "../ui/Press";
import { C, R } from "../ui/theme";
import { ClubCrest, Fill, money, ordinal } from "./career/kit";

export function Home({ career, onQuit, onLeague }: { career: CareerState; onQuit: () => void; onLeague?: () => void }) {
  const nav = useNav();
  const session = useSession();
  const p = career.player;
  const next = nextFixtureFor(career);
  const over = flow.seasonOver(career);
  const st = starStatus(career);
  const ps = career.seasonStats;
  const intlDue = periodDue(career) !== null;
  // page.tsx's central check: anything earned away from a match unlocks on Home.
  useEffect(() => { flow.settle(); }, [career]);

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: C.bg }}>
      {/* The top HUD: energy always, the star rating, your money. */}
      <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 6, gap: 6 }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Text numberOfLines={1} style={{ flex: 1, color: C.text, fontSize: 20, fontWeight: "900" }}>{`${p.firstName} ${p.lastName}`.toUpperCase()}</Text>
          <Text style={{ color: C.gold, fontWeight: "900", fontSize: 15, marginRight: 12 }}>{money(career.money)}</Text>
          <Press onPress={() => nav.go("career-settings")} style={{ padding: 6 }}><Text style={{ fontSize: 20 }}>⚙️</Text></Press>
        </View>
        <View style={{ flexDirection: "row", gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={hudLabel}>⚡ ENERGY {Math.round(career.energy)}</Text>
            <Fill value={career.energy} color={career.energy >= 50 ? C.green : career.energy >= 25 ? C.gold : C.red} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={hudLabel}>★ STAR RATING {st.stars}</Text>
            <Fill value={st.toNext * 100} color={C.gold} />
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 14, paddingTop: 6, gap: 10, paddingBottom: 30 }}>
        {session.news[0] && (
          <Press onPress={flow.dismissNews} style={{ backgroundColor: "#7f1d1d", borderRadius: R.card, padding: 14 }}>
            <Text style={{ color: C.gold, fontSize: 11, fontWeight: "900", letterSpacing: 2 }}>BREAKING NEWS</Text>
            <Text style={{ color: C.text, fontSize: 17, fontWeight: "900", marginTop: 4 }}>{session.news[0].headline}</Text>
            <Text style={{ color: C.text, marginTop: 4 }}>{session.news[0].line}</Text>
            <Text style={{ color: C.dim, fontSize: 11, marginTop: 6 }}>Tap to close</Text>
          </Press>
        )}
        {session.potmWin && (
          <Press onPress={() => setSession({ potmWin: null })} style={{ backgroundColor: C.panel, borderRadius: R.card, padding: 14, borderWidth: 1, borderColor: C.gold }}>
            <Text style={{ color: C.gold, fontWeight: "900", fontSize: 16 }}>🏅 {session.potmWin.monthName} Player of the Month</Text>
            <Text style={{ color: C.text, marginTop: 4 }}>{session.potmWin.goals} goals and {session.potmWin.assists} assists. Tap to close.</Text>
          </Press>
        )}

        <NextMatch career={career} next={next} />
        {over && <Big label="End of Season 🏆" onPress={() => nav.go(flow.endSeason().screen)} gold />}
        {!over && intlDue && <Big label="📞 Your country's manager has named his squad" onPress={() => nav.go("career-callup")} gold />}
        {career.placement?.kind === "youth" && (
          <Big label="🎓 Youth team: this week" onPress={() => nav.go("career-youth")} gold />
        )}

        {/* The four numbers in a row (StatTiles). */}
        <View style={{ flexDirection: "row", gap: 8 }}>
          <StatTile label="Rep" value={Math.round(career.reputation)} color="#0ea5e9" bar={career.reputation} />
          <StatTile label="Fame" value={fameOf(career)} color="#d946ef" bar={Math.min(100, fameOf(career))} />
          <StatTile label="Goals" value={ps.goals} color="#22c55e" />
          <StatTile label="Assists" value={ps.assists} color="#f59e0b" />
        </View>

        <MiniLeague career={career} onOpen={onLeague} />
        <BootsLine career={career} />

        {/* The drinks: Basic / Premium / Elite (CanTile). */}
        <View style={{ flexDirection: "row", gap: 8 }}>
          {KIB_CANS.map((c) => {
            const count = career.kibCans[c.id];
            const ready = !!(c.effect && career.kibAbility?.[c.effect]);
            const canUse = count > 0 && !ready && !(!c.effect && career.energy >= 100);
            const price = kibCanPrice(c, career.contract.wage);
            const effect = c.effect === "curve" ? `Curve shots${c.restore ? ` +${c.restore}` : ""}` : c.effect === "extraTouch" ? `Extra touch${c.restore ? ` +${c.restore}` : ""}` : `+${c.restore} energy`;
            const accent = c.id === "basic" ? "#fb923c" : c.id === "premium" ? "#60a5fa" : "#c084fc";
            return (
              <View key={c.id} style={{ flex: 1, backgroundColor: C.panel, borderRadius: 14, padding: 8, borderWidth: 1, borderColor: accent }}>
                <Text style={{ color: C.text, fontWeight: "900" }}>{c.name} <Text style={{ color: accent }}>×{count}</Text></Text>
                <Text style={{ color: C.dim, fontSize: 11, marginTop: 2 }} numberOfLines={1}>{ready ? "Ready next match" : effect}</Text>
                <View style={{ flexDirection: "row", gap: 6, marginTop: 6 }}>
                  <Press disabled={!canUse} onPress={() => flow.useCan(c.id)} style={{ flex: 1, backgroundColor: accent, borderRadius: 8, paddingVertical: 6, alignItems: "center" }}>
                    <Text style={{ color: "#111", fontWeight: "900", fontSize: 12 }}>Use</Text>
                  </Press>
                  <Press disabled={career.money < price} onPress={() => flow.buyCan(c)} style={{ flex: 1, backgroundColor: C.panel2, borderRadius: 8, paddingVertical: 6, alignItems: "center" }}>
                    <Text style={{ color: C.text, fontWeight: "900", fontSize: 11 }}>★{price}</Text>
                  </Press>
                </View>
              </View>
            );
          })}
        </View>

        {/* Stats | Shop (the website's swipe pages) and Training. */}
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Link icon="📊" label="Stats" onPress={() => nav.go("career-stats")} />
          <Link icon="🏋️" label={`Training · ${trainingLeft(career)}`} onPress={() => nav.go("career-training")} />
          <Link icon="🛍️" label="Shop" disabled={!SCREENS.shop} onPress={() => nav.go("shop")} />
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Link icon="📱" label="Phone" onPress={() => nav.go("phone")} />
          <Link icon="⭐" label="Star Pass" onPress={() => nav.go("star-pass")} />
          <Link icon="🤝" label="Sponsors" onPress={() => nav.go("sponsors")} />
          <Link icon="❤️" label="Relations" onPress={() => nav.go("career-relations")} />
        </View>
        <Press onPress={onQuit} style={{ backgroundColor: C.panel2, borderRadius: R.card, paddingVertical: 12, alignItems: "center" }}>
          <Text style={{ color: C.dim, fontWeight: "800" }}>Main menu</Text>
        </Press>
      </ScrollView>
    </SafeAreaView>
  );
}

const hudLabel = { color: C.dim, fontSize: 11, fontWeight: "800" as const, letterSpacing: 1, marginBottom: 3 };

function Big({ label, onPress, gold }: { label: string; onPress: () => void; gold?: boolean }) {
  return (
    <Press onPress={onPress} style={{ backgroundColor: gold ? C.gold : C.green, borderRadius: R.card, paddingVertical: 16, alignItems: "center" }}>
      <Text style={{ color: "#1a1405", fontSize: 17, fontWeight: "900" }}>{label}</Text>
    </Press>
  );
}

function Link({ icon, label, onPress, disabled }: { icon: string; label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Press disabled={disabled} onPress={onPress} style={{ flex: 1, backgroundColor: C.panel, borderRadius: 14, paddingVertical: 14, alignItems: "center", borderWidth: 1, borderColor: C.line }}>
      <Text style={{ fontSize: 22 }}>{icon}</Text>
      <Text style={{ color: C.text, fontWeight: "800", marginTop: 4, fontSize: 13 }}>{label}</Text>
    </Press>
  );
}

function StatTile({ label, value, color, bar }: { label: string; value: number; color: string; bar?: number }) {
  return (
    <View style={{ flex: 1, backgroundColor: C.panel, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 6, alignItems: "center", borderWidth: 1.5, borderColor: color }}>
      <Text style={{ color: C.text, fontSize: 22, fontWeight: "900" }}>{value}</Text>
      <Text style={{ color: C.text, fontSize: 10, fontWeight: "900", letterSpacing: 1.5 }}>{label.toUpperCase()}</Text>
      {bar !== undefined && <View style={{ alignSelf: "stretch", marginTop: 5 }}><Fill value={bar} color={color} height={4} /></View>}
    </View>
  );
}

/** HomeHub's lastFive: your last five results (club or country). */
function lastFive(career: CareerState, international: boolean) {
  return career.fixtures
    .filter((f) => f.played && f.homeScore !== undefined && f.awayScore !== undefined && (f.kind === "international") === international)
    .sort(byFixtureDate(career)).slice(-5)
    .map((f) => { const us = f.home ? f.homeScore! : f.awayScore!, them = f.home ? f.awayScore! : f.homeScore!; return us > them ? "W" : us === them ? "D" : "L"; });
}
/** HomeHub's daysToNext. */
function daysToNext(career: CareerState, next: Fixture): number {
  const div = divisionOf(career);
  const ts = (f: Fixture) => fixtureTimestamp(career.player.startYear, career.season, f.week, f.kind, div);
  const played = career.fixtures.filter((f) => f.played);
  const nextTs = ts(next);
  const lastTs = played.length ? Math.max(...played.map(ts).filter((t) => t <= nextTs)) : nextTs - 5 * 86400000;
  const today = Number.isFinite(lastTs) ? lastTs + 86400000 : nextTs - 5 * 86400000;
  return Math.max(0, Math.round((nextTs - today) / 86400000));
}

function NextMatch({ career, next }: { career: CareerState; next: Fixture | null }) {
  const five = lastFive(career, next?.kind === "international");
  const form = (
    <View style={{ flexDirection: "row", gap: 3 }}>
      {five.map((r, i) => (
        <View key={i} style={{ width: 17, height: 17, alignItems: "center", justifyContent: "center", backgroundColor: r === "W" ? "#10b981" : r === "D" ? "#6b7280" : "#dc2626" }}>
          <Text style={{ color: C.text, fontSize: 10, fontWeight: "900" }}>{r}</Text>
        </View>
      ))}
    </View>
  );
  if (!next) {
    return (
      <View style={{ backgroundColor: C.panel, borderRadius: R.card, padding: 14, flexDirection: "row", alignItems: "center" }}>
        <Text style={{ color: C.text, fontWeight: "900", flex: 1 }}>Season complete — the awards are next</Text>
        {form}
      </View>
    );
  }
  const mine = flow.myTeam(career, next);
  const home = next.home ? mine : next.opponent;
  const away = next.home ? next.opponent : mine;
  const comp = next.competition ?? leagueNameFor(divisionOf(career));
  const days = daysToNext(career, next);
  const when = days === 0 ? "Today" : days === 1 ? "Tomorrow" : `${days} days`;
  const date = fixtureDateLabel(career.player.startYear, career.season, next.week, next.kind, divisionOf(career));
  return (
    <View style={{ backgroundColor: C.panel, borderRadius: R.card, padding: 14, borderWidth: 1, borderColor: C.line }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ color: C.green, fontSize: 11, fontWeight: "900", letterSpacing: 2 }}>NEXT MATCH</Text>
        <Text numberOfLines={1} style={{ color: C.dim, fontSize: 11, fontWeight: "900", letterSpacing: 1, maxWidth: "60%" }}>{(next.kind && next.kind !== "league" ? fixtureLabel(next) : comp).toUpperCase()}</Text>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", marginVertical: 10, gap: 6 }}>
        <Side club={home} you={home === mine} />
        <Text style={{ color: C.text, fontSize: 18, fontWeight: "900", width: 24, textAlign: "center" }}>v</Text>
        <Side club={away} you={away === mine} />
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Text style={{ color: C.text, fontWeight: "900", fontSize: 12 }}>{date ?? `Week ${next.week}`}</Text>
        <View style={{ backgroundColor: days <= 1 ? C.gold : "rgba(255,255,255,0.12)", paddingHorizontal: 6, paddingVertical: 2 }}>
          <Text style={{ color: days <= 1 ? "#111" : "#fde68a", fontWeight: "900", fontSize: 11 }}>⏱ {when}</Text>
        </View>
        <View style={{ flex: 1 }} />
        {form}
      </View>
    </View>
  );
}

function Side({ club, you }: { club: string; you: boolean }) {
  return (
    <View style={{ width: 120, alignItems: "center" }}>
      <ClubCrest club={club} size={40} />
      <Text numberOfLines={1} style={{ color: you ? C.green : C.text, fontWeight: "900", marginTop: 4 }}>{shortClub(club)}</Text>
    </View>
  );
}

/** The mini league (LeagueDropdown): your place and the clubs either side. */
function MiniLeague({ career, onOpen }: { career: CareerState; onOpen?: () => void }) {
  if (!career.league?.length) return null;
  const rows = sortLeague(career.league);
  const i = Math.max(0, rows.findIndex((t) => t.name === career.player.club));
  const from = Math.max(0, Math.min(rows.length - 3, i - 1));
  return (
    <Press onPress={onOpen} style={{ backgroundColor: C.panel, borderRadius: R.card, padding: 12 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
        <Text style={{ color: C.gold, fontSize: 11, fontWeight: "900", letterSpacing: 2 }}>{leagueNameFor(divisionOf(career)).toUpperCase()}</Text>
        <Text style={{ color: C.text, fontSize: 12, fontWeight: "900" }}>{ordinal(i + 1)}</Text>
      </View>
      {rows.slice(from, from + 3).map((t, k) => (
        <View key={t.name} style={{ flexDirection: "row", paddingVertical: 4, paddingHorizontal: 6, borderRadius: 6, backgroundColor: t.name === career.player.club ? "rgba(52,211,153,0.16)" : "transparent" }}>
          <Text style={{ color: C.dim, width: 28, fontWeight: "800" }}>{from + k + 1}</Text>
          <Text numberOfLines={1} style={{ flex: 1, color: t.name === career.player.club ? C.green : C.text, fontWeight: "800" }}>{shortClub(t.name)}</Text>
          <Text style={{ color: C.dim, width: 34, textAlign: "right" }}>{t.played}</Text>
          <Text style={{ color: C.text, width: 40, textAlign: "right", fontWeight: "900" }}>{t.points}</Text>
        </View>
      ))}
    </Press>
  );
}

/** The boots line over the cans (BootsLine). */
function BootsLine({ career }: { career: CareerState }) {
  const b = career.currentBoot;
  const left = b?.matches ?? 0;
  const gives = [b?.power ? `Pow +${b.power}` : "", b?.technique ? `Tec +${b.technique}` : "", b?.curve ? "Curve" : "", b?.extraTouch ? "Extra touch" : ""].filter(Boolean).join(" · ");
  return (
    <View style={{ backgroundColor: C.panel, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderColor: "rgba(251,146,60,0.55)", flexDirection: "row", gap: 6 }}>
      <Text>👟</Text>
      {left > 0
        ? <Text style={{ color: C.text, fontWeight: "800", flex: 1 }} numberOfLines={1}>{b.name} <Text style={{ color: "#fde68a" }}>{gives}</Text> <Text style={{ color: C.dim }}>· {left} {left === 1 ? "match" : "matches"} left</Text></Text>
        : <Text style={{ color: "#fde68a", fontWeight: "800" }}>No boots: buy a pair in the Shop</Text>}
    </View>
  );
}
