/**
 * THE PHONE — the phone port of components/star/PhoneHome.tsx: a home screen
 * of apps, a next-match widget and a dock. Social, Squad, Fixtures &
 * results, Messages, Scout report and the App Store open INSIDE the phone;
 * Shop, Sponsors and the rest open their own screens.
 * The packed phone app has no casino, so neither does this one (no Casino
 * icon, and the App Store leaves it out).
 *
 * Placeholders: Kickabout (the MATCH area's engine), Store (Coins), Owner
 * (Investments), Garden and Your house (3D) — each shows "coming".
 * Relationships and Settings open the CAREER area's "relations" / "settings"
 * screens when those exist.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { FlatList, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { CareerState, Fixture } from "@/lib/star/types";
import { phoneClockLabel } from "@/lib/star/phoneClock";
import { nextFixtureFor, byFixtureDate } from "@/lib/star/competitions";
import { divisionOf, fixtureDateLabel } from "@/lib/star/calendar";
import { CLUB_SHORT_NAMES } from "@/lib/star/clubs";
import { formatMoney, formatWallet } from "@/lib/star/money";
import { buildMessages, msgKey, socialUnread, type Msg } from "@/lib/star/phoneUnread";
import { brandsOf } from "@/lib/star/sponsorDeals";
import { APP_STORE, appInstalled, appIsNew, installApp, markAppOpened } from "@/lib/star/unlocks";
import { displayOverall } from "@/lib/star/rating";
import { starLevel } from "@/lib/star/starPoints";
import { playerMarketValue } from "@/lib/star/marketValue";
import { yourTransferValue } from "@/lib/star/transferInterest";
import { scoutReportFor } from "@/lib/star/scoutReport";
import { useCareer, setCareer, getCareer } from "../../game/store";
import { useNav } from "../../nav";
import { SCREENS } from "../../areas/registry";
import { Press } from "../../ui/Press";
import { C } from "../../ui/theme";
import { ClubBadge, Empty, Title, clubGlow, rgba, youRow } from "../../world/ui";
import { readSeenMsgs, writeSeenMsgs, readSocialSeen, writeSocialSeen } from "../../world/seen";
import { MediaFeed } from "./Feed";

type Inside = "social" | "squad" | "fixtures" | "messages" | "appstore" | "scout" | "kickabout";
interface App { id: string; label: string; icon: string; bg: string; title?: string; /** A screen of its own (nav name), or an app inside the phone. */ screen?: string; inside?: Inside; soon?: string }

const APPS: App[] = [
  { id: "social", label: "Social", icon: "💬", bg: "#059669", inside: "social" },
  { id: "kickabout", label: "Kickabout", icon: "⚽", bg: "#4d7c0f", inside: "kickabout" },
  { id: "relations", label: "Relationships", icon: "❤️", bg: "#be123c", screen: "relations", soon: "Relationships" },
  { id: "squad", label: "Squad", icon: "👥", bg: "#d97706", inside: "squad" },
  { id: "fixtures", label: "Fixtures", title: "Fixtures & results", icon: "🏟️", bg: "#0369a1", inside: "fixtures" },
  { id: "messages", label: "Messages", icon: "💌", bg: "#e11d48", inside: "messages" },
  { id: "shop-kib", label: "Shop", icon: "🛍️", bg: "#ea580c", screen: "shop" },
  { id: "store", label: "Store", icon: "🛒", bg: "#7c3aed", screen: "store", soon: "The Store (Coins)" },
  // No casino: the packed phone app has none (Mikey, 5 Nov 2026).
  { id: "sponsors", label: "Sponsors", icon: "🤝", bg: "#0f766e", screen: "sponsors" },
  { id: "ownership", label: "Owner", icon: "🏛️", bg: "#4338ca", screen: "investments", soon: "Owning clubs (Investments)" },
  { id: "garden", label: "Garden", icon: "🌳", bg: "#166534", soon: "The 3D garden" },
  { id: "settings", label: "Settings", icon: "⚙️", bg: "#4b5563", screen: "settings", soon: "Settings" },
];
const DOCK = new Set(["social", "messages", "fixtures", "kickabout"]);
const APP_STORE_ICON: App = { id: "appstore", label: "App Store", icon: "🅰️", bg: "#1d4ed8", inside: "appstore" };
const SCOUT_APP: App = { id: "scout", label: "Scout report", icon: "🔍", bg: "#047857", inside: "scout" };
const short = (club: string) => CLUB_SHORT_NAMES[club] ?? club.replace(/\s+(FC|AFC)$/i, "");

export function PhoneScreen() {
  const career = useCareer();
  const nav = useNav();
  const inset = useSafeAreaInsets();
  const [app, setApp] = useState<App | null>(null);
  const [soon, setSoon] = useState<string | null>(null);
  const msgs = useMemo(() => (career ? buildMessages(career, null) : []), [career]);
  const [seenMsgs, setSeenMsgs] = useState<Set<string>>(() => readSeenMsgs());
  const [socialSeen, setSocialSeen] = useState<number>(() => readSocialSeen());
  if (!career) return null;
  const glow = clubGlow(career.player.club, career);
  const lastPostAt = Math.max(0, ...(career.media?.posts ?? []).map((p) => p.at));
  const badges: Record<string, number> = {
    sponsors: brandsOf(career).offers.length,
    messages: msgs.filter((m) => !seenMsgs.has(msgKey(m))).length,
    social: socialUnread(career, socialSeen),
  };
  const installed = (id: string) => (career.unlocks ? appInstalled(career, id) : true);

  const open = (a: App) => {
    if (career.unlocks && appIsNew(career, a.id)) setCareer((c) => markAppOpened(c, a.id));
    if (a.inside) {
      if (a.inside === "messages") { const all = new Set([...seenMsgs, ...msgs.map(msgKey)]); setSeenMsgs(all); writeSeenMsgs(all); }
      if (a.inside === "social") { setSocialSeen(lastPostAt || 1); writeSocialSeen(lastPostAt || 1); }
      setApp(a);
      return;
    }
    if (a.screen && SCREENS[a.screen]) { nav.go(a.screen); return; }
    setSoon(a.soon ?? a.label);
  };

  const body = app ? (
    <AppShell app={app}>
      {app.inside === "social" && <MediaFeed career={career} mode="browse" />}
      {app.inside === "squad" && <SquadApp career={career} glow={glow} />}
      {app.inside === "fixtures" && <FixturesApp career={career} />}
      {app.inside === "messages" && <MessagesApp msgs={msgs} onOpen={(to) => (to === "scout" ? setApp(SCOUT_APP) : nav.go("sponsors"))} />}
      {app.inside === "scout" && <ScoutApp career={career} />}
      {app.inside === "appstore" && <AppStoreApp career={career} />}
      {app.inside === "kickabout" && <Soon text="Kickabout: random highlights played on the real match engine. It arrives with the phone match." />}
    </AppShell>
  ) : (
    <Grid career={career} glow={glow} badges={badges} installed={installed} onOpen={open} />
  );

  return (
    <View style={{ flex: 1, backgroundColor: "#05080f", paddingTop: inset.top }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 6 }}>
        <Text style={{ color: C.text, fontWeight: "900" }}>{phoneClockLabel(career)}</Text>
        <Text style={{ color: C.dim, fontWeight: "800" }}>📶 🔋</Text>
      </View>
      <View style={{ flex: 1 }}>{body}</View>
      {soon && (
        <Press onPress={() => setSoon(null)} style={{ position: "absolute", left: 20, right: 20, bottom: 120, backgroundColor: "#111", borderColor: C.gold, borderWidth: 1, borderRadius: 14, padding: 14 }}>
          <Text style={{ color: C.text, fontWeight: "800", textAlign: "center" }}>{soon} is coming to the phone app.</Text>
        </Press>
      )}
      <View style={{ flexDirection: "row", justifyContent: "space-around", paddingBottom: Math.max(inset.bottom, 10), paddingTop: 8, backgroundColor: "#0a0f18", borderTopWidth: 1, borderTopColor: C.line }}>
        <Press onPress={() => (app ? setApp(null) : nav.back())} style={{ paddingHorizontal: 22, paddingVertical: 6 }}><Text style={{ color: C.text, fontSize: 20, fontWeight: "900" }}>‹</Text></Press>
        <Press onPress={() => setApp(null)} style={{ paddingHorizontal: 22, paddingVertical: 6 }}><View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2.5, borderColor: C.text }} /></Press>
        <Press onPress={() => nav.back()} style={{ paddingHorizontal: 22, paddingVertical: 6 }}><Text style={{ color: C.text, fontSize: 16, fontWeight: "900" }}>✕</Text></Press>
      </View>
    </View>
  );
}

function Soon({ text }: { text: string }) {
  return <View style={{ padding: 16 }}><Empty text={text} /></View>;
}

function AppIcon({ app, badge, off, fresh, onOpen }: { app: App; badge: number; off: boolean; fresh: boolean; onOpen: () => void }) {
  return (
    <Press onPress={onOpen} style={{ width: "25%", alignItems: "center", paddingVertical: 6 }}>
      <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: off ? "#05070b" : app.bg, alignItems: "center", justifyContent: "center", borderWidth: off ? 1 : 0, borderColor: "rgba(255,255,255,0.07)" }}>
        <Text style={{ fontSize: 26, opacity: off ? 0.25 : 1 }}>{app.icon}</Text>
        {badge > 0 && !off && (
          <View style={{ position: "absolute", top: -5, right: -5, minWidth: 20, height: 20, borderRadius: 10, backgroundColor: "#ef4444", alignItems: "center", justifyContent: "center", paddingHorizontal: 4 }}>
            <Text style={{ color: "#fff", fontWeight: "900", fontSize: 11 }}>{badge}</Text>
          </View>
        )}
        {fresh && badge === 0 && !off && <Text style={{ position: "absolute", top: -6, right: -8, backgroundColor: C.gold, color: "#111", fontWeight: "900", fontSize: 9, paddingHorizontal: 5, borderRadius: 8, overflow: "hidden" }}>NEW</Text>}
      </View>
      <Text numberOfLines={1} style={{ color: off ? "rgba(255,255,255,0.25)" : C.text, fontWeight: "700", fontSize: 11, marginTop: 4 }}>{off ? "???" : app.label}</Text>
    </Press>
  );
}

function Grid({ career, glow, badges, installed, onOpen }: { career: CareerState; glow: string; badges: Record<string, number>; installed: (id: string) => boolean; onOpen: (a: App) => void }) {
  const next = nextFixtureFor(career);
  const grid = career.unlocks ? [...APPS.filter((a) => !DOCK.has(a.id)), APP_STORE_ICON] : APPS.filter((a) => !DOCK.has(a.id));
  const dock = APPS.filter((a) => DOCK.has(a.id));
  const icon = (a: App) => {
    const off = !!career.unlocks && a.id !== "appstore" && !installed(a.id);
    return <AppIcon key={a.id} app={a} badge={badges[a.id] ?? 0} off={off} fresh={!!career.unlocks && appIsNew(career, a.id)} onOpen={() => (off ? onOpen(APP_STORE_ICON) : onOpen(a))} />;
  };
  return (
    <ScrollView contentContainerStyle={{ padding: 12, flexGrow: 1 }}>
      {next ? <NextMatchWidget career={career} next={next} /> : (
        <View style={{ backgroundColor: C.panel, borderRadius: 20, padding: 12, borderWidth: 1, borderColor: rgba(glow.startsWith("#") ? glow : C.green, 0.5) }}>
          <Text style={{ color: "#fde68a", fontWeight: "900", fontSize: 10, letterSpacing: 2 }}>SEASON COMPLETE</Text>
          <Text style={{ color: C.dim, fontWeight: "700" }}>★ {formatWallet(career.money)} in the bank</Text>
        </View>
      )}
      <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 12 }}>{grid.map(icon)}</View>
      <View style={{ flex: 1 }} />
      <View style={{ flexDirection: "row", backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 22, paddingVertical: 4, marginTop: 12 }}>{dock.map(icon)}</View>
    </ScrollView>
  );
}

function NextMatchWidget({ career, next }: { career: CareerState; next: Fixture }) {
  const me = career.player.club;
  const home = next.home ? me : next.opponent;
  const away = next.home ? next.opponent : me;
  return (
    <View style={{ backgroundColor: C.panel, borderRadius: 20, padding: 12, borderWidth: 1, borderColor: C.line }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ color: C.green, fontWeight: "900", fontSize: 10, letterSpacing: 2 }}>NEXT MATCH</Text>
        <Text style={{ color: C.dim, fontWeight: "800", fontSize: 11 }}>{fixtureDateLabel(career.player.startYear, career.season, next.week, next.kind, divisionOf(career))}</Text>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 }}>
        <ClubBadge club={home} size={30} career={career} />
        <Text numberOfLines={1} style={{ flex: 1, textAlign: "center", color: C.text, fontWeight: "900", fontSize: 15 }}>{short(home)} <Text style={{ color: C.dim }}>v</Text> {short(away)}</Text>
        <ClubBadge club={away} size={30} career={career} />
      </View>
      <Text style={{ color: C.dim, fontWeight: "700", textAlign: "center", marginTop: 6 }}>★ <Text style={{ color: "#fde68a", fontWeight: "900" }}>{formatMoney(Math.round(career.money))}</Text> in the bank</Text>
    </View>
  );
}

function AppShell({ app, children }: { app: App; children: ReactNode }) {
  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.line }}>
        <View style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: app.bg, alignItems: "center", justifyContent: "center" }}><Text>{app.icon}</Text></View>
        <Text style={{ color: C.text, fontWeight: "900", fontSize: 16 }}>{app.title ?? app.label}</Text>
      </View>
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
}

// ── Squad (LeagueScreen's squad view, inside the phone) ─────────────────────

function SquadApp({ career, glow }: { career: CareerState; glow: string }) {
  const rows = useMemo(() => {
    const you = {
      id: "__you__", isYou: true, name: `${career.player.firstName} ${career.player.lastName}`, position: career.player.position as string,
      overall: displayOverall(career.starRating) as number | undefined, seasonGoals: career.seasonStats.goals, seasonAssists: career.seasonStats.assists,
      age: career.player.age as number | undefined, marketValue: yourTransferValue(career),
    };
    return [you, ...(career.squad ?? []).map(p => ({
      id: p.id, isYou: false, name: p.name, position: p.position as string, overall: p.overall, seasonGoals: p.seasonGoals, seasonAssists: p.seasonAssists, age: p.age,
      marketValue: playerMarketValue({ ...p, overall: p.overall ?? 65 }, career.player.club, career),
    }))].sort((a, b) => ((b.seasonGoals + b.seasonAssists) - (a.seasonGoals + a.seasonAssists)) || ((b.overall ?? 0) - (a.overall ?? 0)));
  }, [career]);
  return (
    <FlatList data={rows} keyExtractor={(p) => p.id} contentContainerStyle={{ padding: 8, gap: 3 }}
      ListHeaderComponent={<View style={{ flexDirection: "row", paddingHorizontal: 8, paddingBottom: 4 }}>
        <Text style={{ flex: 1, color: C.dim, fontWeight: "900", fontSize: 10 }}>NAME</Text>
        {["OVR", "POS", "G", "A"].map(h => <Text key={h} style={{ width: 36, textAlign: "center", color: C.dim, fontWeight: "900", fontSize: 10 }}>{h}</Text>)}
      </View>}
      renderItem={({ item: p, index }) => (
        <View style={[{ flexDirection: "row", alignItems: "center", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6, backgroundColor: index % 2 === 0 ? "rgba(255,255,255,0.045)" : "transparent" }, p.isYou && youRow(glow)]}>
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={{ color: C.text, fontWeight: "900" }}>{p.name}{p.isYou ? " ★" : ""}</Text>
            <Text style={{ color: C.dim, fontWeight: "700", fontSize: 10 }}>{p.age !== undefined ? `Age ${p.age} · ` : ""}★{formatMoney(p.marketValue)}</Text>
          </View>
          <Text style={{ width: 36, textAlign: "center", color: p.isYou ? "#111" : C.text, backgroundColor: p.isYou ? C.gold : "transparent", fontWeight: "900", borderRadius: 6, overflow: "hidden" }}>{p.isYou ? `★${starLevel(career)}` : p.overall ?? "—"}</Text>
          <Text style={{ width: 36, textAlign: "center", color: C.text, fontWeight: "700" }}>{p.position}</Text>
          <Text style={{ width: 36, textAlign: "center", color: p.seasonGoals > 0 ? "#fde047" : C.dim, fontWeight: "900" }}>{p.seasonGoals}</Text>
          <Text style={{ width: 36, textAlign: "center", color: p.seasonAssists > 0 ? "#93c5fd" : C.dim, fontWeight: "900" }}>{p.seasonAssists}</Text>
        </View>
      )} />
  );
}

// ── Fixtures & results (every game of the season, in date order) ────────────

function fixtureLabel(f: Fixture): { top: string; sub?: string } {
  if (!f.competition || f.kind === "league") return { top: `MW${f.week}` };
  const c = f.competition;
  const top = /Champions/.test(c) ? "UCL" : /Europa/.test(c) ? "UEL" : /Conference/.test(c) ? "UECL"
    : c === "FA Cup" ? "FA Cup" : c === "League Cup" ? "Lg Cup" : /Trophy/.test(c) ? "Trophy" : c.replace(/ (Cup|Shield)$/, "").slice(0, 8);
  const ORD: Record<string, string> = { First: "1", Second: "2", Third: "3", Fourth: "4", Fifth: "5", Sixth: "6" };
  const round = f.round
    ?.replace("League phase", "League").replace("Round of ", "R").replace("Matchday ", "MD")
    .replace(/^(First|Second|Third|Fourth|Fifth|Sixth) Qualifying( Round)?$/, (_m, o: string) => `Q${ORD[o]}`)
    .replace(/^(First|Second|Third|Fourth|Fifth|Sixth) Round$/, (_m, o: string) => `R${ORD[o]}`)
    .replace(/^Quarter-?[Ff]inals?$/, "QF").replace(/^Semi-?[Ff]inals?$/, "SF");
  const sub = [round, f.leg ? `L${f.leg}` : ""].filter(Boolean).join(" ");
  return { top, sub: sub || undefined };
}

function FixturesApp({ career }: { career: CareerState }) {
  const list = useMemo(() => [...career.fixtures].sort(byFixtureDate(career)), [career]);
  const nextIdx = list.findIndex((f) => !f.played);
  const ref = useRef<FlatList<Fixture>>(null);
  useEffect(() => { if (nextIdx > 2) setTimeout(() => ref.current?.scrollToIndex({ index: nextIdx, viewPosition: 0.4, animated: false }), 50); }, [nextIdx]);
  if (!list.length) return <Soon text="No fixtures yet." />;
  return (
    <FlatList ref={ref} data={list} keyExtractor={(f, i) => `${f.week}-${f.opponent}-${f.kind}-${i}`} contentContainerStyle={{ padding: 8, gap: 4 }}
      getItemLayout={(_, i) => ({ length: 52, offset: 52 * i, index: i })}
      onScrollToIndexFailed={() => {}}
      renderItem={({ item: f, index: i }) => {
        const us = f.home ? f.homeScore : f.awayScore, them = f.home ? f.awayScore : f.homeScore;
        const res = f.played && us !== undefined && them !== undefined ? (us > them ? "W" : us === them ? "D" : "L") : null;
        const tone = res === "W" ? "#059669" : res === "L" ? "#b91c1c" : "#d97706";
        const next = i === nextIdx;
        const lab = fixtureLabel(f);
        return (
          <View style={{ height: 48, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 10, borderRadius: 12, backgroundColor: next ? "rgba(14,165,233,0.15)" : f.played ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.025)", borderWidth: next ? 1.5 : 0, borderColor: "rgba(56,189,248,0.9)" }}>
            <View style={{ width: 52 }}>
              <Text numberOfLines={1} style={{ color: "#fde68a", fontWeight: "900", fontSize: 10 }}>{lab.top}</Text>
              {lab.sub ? <Text numberOfLines={1} style={{ color: "rgba(253,230,138,0.7)", fontWeight: "900", fontSize: 9 }}>{lab.sub}</Text> : null}
            </View>
            <ClubBadge club={f.opponent} size={20} career={career} />
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={{ color: C.text, fontWeight: "900" }}>{short(f.opponent)} <Text style={{ color: C.dim }}>({f.home ? "H" : "A"})</Text></Text>
              {!f.played && <Text numberOfLines={1} style={{ color: C.dim, fontSize: 10, fontWeight: "700" }}>{fixtureDateLabel(career.player.startYear, career.season, f.week, f.kind, divisionOf(career))}</Text>}
            </View>
            {res ? <Text style={{ backgroundColor: tone, color: "#fff", fontWeight: "900", paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, overflow: "hidden" }}>{us}-{them} {res}</Text> : null}
          </View>
        );
      }} />
  );
}

// ── Messages and the scout report ───────────────────────────────────────────

function MessagesApp({ msgs, onOpen }: { msgs: Msg[]; onOpen: (to: "scout" | "sponsors") => void }) {
  if (!msgs.length) return <Soon text="No messages." />;
  return (
    <ScrollView contentContainerStyle={{ padding: 10, gap: 10 }}>
      <Text style={{ textAlign: "center", color: "rgba(255,255,255,0.4)", fontWeight: "900", fontSize: 10, letterSpacing: 2 }}>TODAY</Text>
      {msgs.map((m, i) => (
        <View key={i} style={{ flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
          <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: m.tone[1], alignItems: "center", justifyContent: "center" }}><Text>{m.icon}</Text></View>
          <View style={{ maxWidth: "82%" }}>
            <Text style={{ color: C.dim, fontWeight: "900", fontSize: 10, marginLeft: 4, marginBottom: 2 }}>{m.from}</Text>
            {m.open ? (
              <Press onPress={() => onOpen(m.open!)} style={{ backgroundColor: "rgba(16,185,129,0.25)", borderRadius: 16, borderBottomLeftRadius: 4, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: "rgba(52,211,153,0.4)" }}>
                <Text style={{ color: C.text, fontWeight: "700" }}>{m.text} <Text style={{ color: "#a7f3d0", fontWeight: "900" }}>→</Text></Text>
              </Press>
            ) : (
              <View style={{ backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 16, borderBottomLeftRadius: 4, paddingHorizontal: 12, paddingVertical: 7 }}>
                <Text style={{ color: C.text, fontWeight: "700" }}>{m.text}</Text>
              </View>
            )}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const ordinal = (n: number) => (n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th");
function ScoutApp({ career }: { career: CareerState }) {
  const fixture = nextFixtureFor(career);
  const report = useMemo(() => { try { return fixture ? scoutReportFor(career, fixture.opponent, fixture.week, fixture) : null; } catch { return null; } }, [career, fixture]);
  if (!fixture || !report) return <Soon text="No match to scout." />;
  const five = report.recentResults.slice(-5);
  const key = report.topScorer && report.topScorer.goals > 0 ? report.topScorer : report.bestPlayer;
  const where = report.table ? `${report.table.position}${ordinal(report.table.position)} of ${report.table.of}` : null;
  const tone = { W: "#10b981", D: "#6b7280", L: "#dc2626" } as const;
  return (
    <ScrollView contentContainerStyle={{ padding: 12, gap: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.panel, borderRadius: 14, padding: 12, borderLeftWidth: 3, borderLeftColor: "#f87171" }}>
        <ClubBadge club={fixture.opponent} size={46} career={career} />
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={{ color: C.text, fontWeight: "900", fontSize: 20 }}>{short(fixture.opponent).toUpperCase()}</Text>
          <Text style={{ color: C.dim, fontWeight: "800", fontSize: 12 }}>{report.tactics.formationName} · {report.tactics.playstyleName}</Text>
        </View>
        {where ? <Text style={{ color: C.gold, fontWeight: "900" }}>{where}</Text> : null}
      </View>
      <Title>Their last 5{report.headToHead ? ` · you ${report.headToHead.wins}W ${report.headToHead.draws}D ${report.headToHead.losses}L` : ""}</Title>
      <View style={{ flexDirection: "row", gap: 4 }}>
        {five.map((f, i) => (
          <View key={i} style={{ flex: 1, alignItems: "center", gap: 3, backgroundColor: "rgba(0,0,0,0.3)", borderRadius: 8, paddingVertical: 6 }}>
            <Text style={{ backgroundColor: tone[f.result], color: "#fff", fontWeight: "900", paddingHorizontal: 5, borderRadius: 4, overflow: "hidden" }}>{f.result}</Text>
            <Text style={{ color: C.text, fontWeight: "900" }}>{f.scoreFor}-{f.scoreAgainst}</Text>
            <ClubBadge club={f.opponent} size={16} />
          </View>
        ))}
        {five.length === 0 && <Text style={{ color: C.dim }}>No games yet.</Text>}
      </View>
      {key && (
        <>
          <Title>Key man</Title>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: C.panel, borderRadius: 12, padding: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.text, fontWeight: "900", fontSize: 16 }}>{key.name}</Text>
              <Text style={{ color: C.dim, fontWeight: "800", fontSize: 12 }}>{key.position} · {key.goals}G {key.assists}A</Text>
            </View>
            <Text style={{ color: C.gold, fontWeight: "900", fontSize: 24 }}>{key.overall}</Text>
          </View>
        </>
      )}
    </ScrollView>
  );
}

// ── App Store (the unlock chain's apps) ─────────────────────────────────────

function AppStoreApp({ career }: { career: CareerState }) {
  // No casino on the phone app (PACKED_APP's rule), whatever lib/star/unlocks lists.
  const apps = APP_STORE.filter((a) => a.id !== "casino-menu");
  return (
    <ScrollView contentContainerStyle={{ padding: 12, gap: 6 }}>
      {apps.map((a) => {
        const have = appInstalled(career, a.id);
        return (
          <View key={a.id} style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 16, padding: 8 }}>
            <View style={{ width: 40, height: 40, borderRadius: 11, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center" }}><Text style={{ fontSize: 22 }}>{a.icon}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.text, fontWeight: "900" }}>{a.label}</Text>
              <Text numberOfLines={1} style={{ color: C.dim, fontWeight: "700", fontSize: 11 }}>{a.note}</Text>
            </View>
            {have ? <Text style={{ color: C.dim, fontWeight: "900", fontSize: 11 }}>Added</Text> : (
              <Press disabled={career.money < a.price} onPress={() => { const c = getCareer(); if (c) setCareer(installApp(c, a.id)); }} style={{ backgroundColor: career.money >= a.price ? C.green : C.panel2, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 }}>
                <Text style={{ color: career.money >= a.price ? "#05261a" : C.text, fontWeight: "900", fontSize: 12 }}>★{formatMoney(a.price)}</Text>
              </Press>
            )}
          </View>
        );
      })}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 16, padding: 8 }}>
        <View style={{ width: 40, height: 40, borderRadius: 11, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center" }}><Text style={{ fontSize: 22 }}>🖼️</Text></View>
        <View style={{ flex: 1 }}><Text style={{ color: C.text, fontWeight: "900" }}>Backgrounds</Text><Text style={{ color: C.dim, fontSize: 11 }}>Wallpapers for your phone</Text></View>
        <Text style={{ color: C.dim, fontWeight: "900", fontSize: 10 }}>Coming soon</Text>
      </View>
    </ScrollView>
  );
}
