/**
 * THE PHONE — the phone port of components/star/PhoneHome.tsx: a home screen
 * of apps, a next-match widget and a dock. Social, Squad, Fixtures &
 * results, Messages, Scout report and the App Store open INSIDE the phone;
 * Shop, Sponsors and the rest open their own screens.
 * The packed phone app has no casino, so neither does this one (no Casino
 * icon, and the App Store leaves it out).
 *
 * Kickabout plays on the phone's match (screens/MatchKickabout.tsx).
 * The Garden opens its 3D place (screens/world/Garden.tsx); Your house is not on the phone yet.
 * Relationships and Settings open the CAREER area's "relations" / "settings"
 * screens when those exist.
 */
import { PointerTour, TourTarget, useTourTarget } from "../../ui/tour";
import { HELP_TOURS, type TourStep } from "@/lib/star/tours";
import { hasSeen } from "@/lib/star/unlocks";
import { RelationsApp } from "./RelationsApp";
import { useScreenHelp, markSeenKeys } from "../../world/help";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { FlatList, ScrollView, Text, View, type ViewStyle } from "react-native";
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
import { partOff } from "../../safety";
import { Press } from "../../ui/Press";
import { C } from "../../world/lookKit";
import { Kickabout } from "../MatchKickabout";
import { ClubBadge, Empty, Title, clubGlow, rgba, youRow } from "../../world/ui";
import { readSeenMsgs, writeSeenMsgs, readSocialSeen, writeSocialSeen } from "../../world/seen";
import { MediaFeed } from "./Feed";
import { kitsOf } from "@/lib/star/kits";
import { Backdrop, BottomBar, LOOK, glassStyle } from "../../ui/look";
import { GameTop } from "../../world/chrome";
import { PlayerHead } from "../../draw/PlayerHead";
import { skinToneHex } from "@/lib/star/playerIdentity";

type Inside = "social" | "squad" | "fixtures" | "messages" | "appstore" | "scout" | "kickabout" | "relations";
interface App { id: string; label: string; icon: string; bg: string; /** The icon's lighter top colour (PhoneHome bg[0]). */ hi?: string; title?: string; /** A screen of its own (nav name), or an app inside the phone. */ screen?: string; inside?: Inside; soon?: string }

const APPS: App[] = [
  { id: "social", label: "Social", icon: "💬", hi: "#34d399", bg: "#047857", inside: "social" },
  { id: "kickabout", label: "Kickabout", icon: "⚽", hi: "#a3e635", bg: "#15803d", inside: "kickabout" },
  { id: "relations", label: "Relationships", icon: "❤️", hi: "#fb7185", bg: "#be123c", inside: "relations" },
  { id: "squad", label: "Squad", icon: "👥", hi: "#fcd34d", bg: "#d97706", inside: "squad" },
  { id: "fixtures", label: "Fixtures", title: "Fixtures & results", icon: "🏟️", hi: "#38bdf8", bg: "#0369a1", inside: "fixtures" },
  { id: "messages", label: "Messages", icon: "💌", hi: "#f472b6", bg: "#e11d48", inside: "messages" },
  { id: "shop-kib", label: "Shop", icon: "🛍️", hi: "#fb923c", bg: "#ea580c", screen: "shop" },
  { id: "store", label: "Store", icon: "🛒", hi: "#fcd34d", bg: "#7c3aed", screen: "store", soon: "The Store (Coins)" },
  // No casino: the packed phone app has none (Mikey, 5 Nov 2026).
  { id: "sponsors", label: "Sponsors", icon: "🤝", hi: "#2dd4bf", bg: "#0f766e", screen: "sponsors" },
  { id: "ownership", label: "Owner", icon: "🏛️", hi: "#818cf8", bg: "#4338ca", screen: "ownership" },
  // The Garden is a 3D place (the website's Garden app: bought in the App Store, ★5,000). Your house is
  // still left off until its 3D version is in (no "coming soon" dead end).
  { id: "garden", label: "Garden", icon: "🌳", hi: "#4ade80", bg: "#166534", screen: "garden" },
  { id: "settings", label: "Settings", icon: "⚙️", hi: "#9ca3af", bg: "#4b5563", screen: "settings", soon: "Settings" },
];
const DOCK = new Set(["social", "messages", "fixtures", "kickabout"]);
const APP_STORE_ICON: App = { id: "appstore", label: "App Store", icon: "🅰️", hi: "#60a5fa", bg: "#1d4ed8", inside: "appstore" };
const SCOUT_APP: App = { id: "scout", label: "Scout report", icon: "🔍", hi: "#34d399", bg: "#047857", inside: "scout" };
const short = (club: string) => CLUB_SHORT_NAMES[club] ?? club.replace(/\s+(FC|AFC)$/i, "");

/** The agent's sponsor offer (the story beat "sponsor"): the finger on Messages, then on the offer (page.tsx goBeat). */
const SPONSOR_TOUR: TourStep[] = [
  { target: "app-messages", text: "Your agent sent the offer. Tap Messages", press: true },
  { target: "msg-sponsors", text: "Tap the offer to see it", press: true },
];

export function PhoneScreen({ params }: { params?: Record<string, unknown> }) {
  const career = useCareer();
  const nav = useNav();
  const [tour, setTour] = useState<TourStep[] | null>(params?.tour === "sponsor" ? SPONSOR_TOUR : null);
  const [app, setApp] = useState<App | null>(null);
  const [soon, setSoon] = useState<string | null>(null);
  const msgs = useMemo(() => (career ? buildMessages(career, null) : []), [career]);
  const [seenMsgs, setSeenMsgs] = useState<Set<string>>(() => readSeenMsgs());
  const [socialSeen, setSocialSeen] = useState<number>(() => readSocialSeen());
  // The "?" replays the phone's pointer tour over the real screen; it also plays on the first visit.
  const help = useScreenHelp("phone", career, { noFirst: !!tour || !!app });
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

  const body = app?.inside === "social" ? <MediaFeed career={career} mode="browse" /> : app ? (
    <AppShell app={app}>
      {app.inside === "squad" && <SquadApp career={career} glow={glow} />}
      {app.inside === "fixtures" && <FixturesApp career={career} />}
      {app.inside === "messages" && <MessagesApp msgs={msgs} onOpen={(to) => (to === "scout" ? setApp(SCOUT_APP) : nav.go("sponsors"))} />}
      {app.inside === "scout" && <ScoutApp career={career} />}
      {app.inside === "appstore" && <AppStoreApp career={career} />}
      {app.inside === "relations" && <RelationsApp career={career} onPlay={(k) => nav.go("career-relationship-game", { kind: k })} onOpen={(to) => nav.go(to)} />}
      {app.inside === "kickabout" && <Kickabout onReplays={SCREENS["goal-replays"] ? () => nav.go("goal-replays") : undefined} />}
    </AppShell>
  ) : (
    <Grid career={career} glow={glow} badges={badges} installed={installed} onOpen={open} />
  );

  const kit = kitsOf(career.player.club, career.clubKits?.[career.player.club]).home;
  return (
    <View style={{ flex: 1, backgroundColor: "#0b1a2e" }}>
      <Backdrop kind="stadium" />
      <GameTop career={career} help={help.open} />
      <PhoneBody glow={glow} trim={kit.trim} clock={phoneClockLabel(career)} onHome={app ? () => setApp(null) : undefined} onBack={() => (app ? setApp(null) : nav.back())}>
        <View style={[{ flex: 1 }, app ? ({ borderTopLeftRadius: 22, borderTopRightRadius: 22, overflow: "hidden", backgroundImage: `radial-gradient(110% 38% at 50% 0%, ${rgba(glow, 0.24)} 0%, rgba(0,0,0,0) 70%), linear-gradient(180deg, #0b1220, #05080f)` } as ViewStyle) : null]}>{body}</View>
        {tour && (
          <PointerTour chain steps={tour} onDone={() => setTour(null)}
            press={{ "app-messages": () => { const m = APPS.find((a) => a.id === "messages"); if (m) open(m); }, "msg-sponsors": () => nav.go("sponsors") }} />
        )}
        {!tour && help.node}
        {!tour && !help.showing && app?.inside === "relations" && career.unlocks && !hasSeen(career, "help-relations") ? (
          <PointerTour key="phone-relations" steps={[{ target: "phone-relations", text: HELP_TOURS.relations[0].text }]} onDone={() => markSeenKeys("help-relations")} />
        ) : null}
        {soon && (
          <Press onPress={() => setSoon(null)} style={{ position: "absolute", left: 14, right: 14, bottom: 110, backgroundColor: "rgba(3,7,18,0.95)", borderColor: "rgba(252,211,77,0.5)", borderWidth: 1, borderRadius: 14, padding: 14 }}>
            <Text style={{ color: C.text, fontWeight: "800", textAlign: "center" }}>{soon} is coming to the phone app.</Text>
          </Press>
        )}
      </PhoneBody>
      <BottomBar active="phone" />
    </View>
  );
}

/**
 * THE DRAWN PHONE (components/star/PhoneFrame.tsx): a graphite bezel edge-lit
 * in your club's colour, the screen with its wallpaper (your club's colours
 * glowing out of the dark), the status bar (date, signal, wifi, battery), the
 * dynamic island, and the nav bar: ⌂ HOME on the left, BACK ‹ on the right.
 * Sized as the website: as tall as the room, at most 0.6 as wide as tall.
 */
function PhoneBody({ glow, trim, clock, onHome, onBack, children }: { glow: string; trim: string; clock: string; onHome?: () => void; onBack: () => void; children: ReactNode }) {
  const [room, setRoom] = useState<{ w: number; h: number } | null>(null);
  const g = glow.startsWith("#") ? glow : "#10b981";
  const second = trim.startsWith("#") && lum(trim) < 0.85 && lum(trim) > 0.04 ? trim : g;
  const h = room ? room.h - 12 : 0;
  const w = room ? Math.min(room.w - 16, Math.round(h * 0.6)) : 0;
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }} onLayout={(e) => { const { width, height } = e.nativeEvent.layout; if (!room || room.w !== width || room.h !== height) setRoom({ w: width, h: height }); }}>
      {room && (
        <View style={{
          width: w, height: h, borderRadius: 42, borderWidth: 3, borderColor: "#3a3a3f", padding: 3,
          backgroundImage: "linear-gradient(155deg, #232327 0%, #131316 40%, #0a0a0c 100%)",
          boxShadow: `0px 30px 70px -20px rgba(0,0,0,0.75), 0px 0px 34px -6px ${rgba(g, 0.4)}, inset 0px 0px 0px 1.5px rgba(255,255,255,0.08)`,
        } as ViewStyle}>
          <View style={{
            flex: 1, borderRadius: 37, overflow: "hidden", backgroundColor: "#000",
            backgroundImage: `radial-gradient(120% 55% at 15% 0%, ${rgba(g, 0.62)} 0%, rgba(0,0,0,0) 62%), radial-gradient(100% 50% at 100% 100%, ${rgba(second, 0.38)} 0%, rgba(0,0,0,0) 60%), linear-gradient(165deg, #0c1629 0%, #05080f 70%)`,
          } as ViewStyle}>
            {/* status bar */}
            <View style={{ height: 30, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 22, paddingTop: 4 }}>
              <Text numberOfLines={1} style={{ color: "#fff", fontSize: 11, fontWeight: "800", maxWidth: "36%" }}>{clock}</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}><Signal /><Wifi /><Battery /></View>
            </View>
            {/* the dynamic island */}
            <View pointerEvents="none" style={{ position: "absolute", top: 6, alignSelf: "center", width: 86, height: 20, borderRadius: 10, backgroundColor: "#000", zIndex: 5 }} />
            <View style={{ flex: 1 }}>{children}</View>
            {/* the nav bar */}
            <View style={{ height: 50, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 26, paddingBottom: 4, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.1)", backgroundImage: "linear-gradient(180deg, rgba(17,24,39,0.85), rgba(3,7,18,0.95))" } as ViewStyle}>
              <Press disabled={!onHome} onPress={onHome} style={{ flexDirection: "row", alignItems: "center", gap: 7, opacity: onHome ? 1 : 0.35 }}>
                <HouseGlyph />
                <Text style={{ color: "#fff", fontSize: 13, fontWeight: "900", letterSpacing: 0.6 }}>HOME</Text>
              </Press>
              <Press onPress={onBack} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text style={{ color: "#fff", fontSize: 13, fontWeight: "900", letterSpacing: 0.6 }}>BACK</Text>
                <Text style={{ color: "#fff", fontSize: 24, fontWeight: "900", marginTop: -3 }}>‹</Text>
              </Press>
            </View>
          </View>
          {/* side buttons */}
          <View style={{ position: "absolute", left: -6, top: 96, width: 3, height: 24, borderTopLeftRadius: 2, borderBottomLeftRadius: 2, backgroundColor: "#3a3a3f" }} />
          <View style={{ position: "absolute", left: -6, top: 128, width: 3, height: 40, borderTopLeftRadius: 2, borderBottomLeftRadius: 2, backgroundColor: "#3a3a3f" }} />
          <View style={{ position: "absolute", left: -6, top: 176, width: 3, height: 40, borderTopLeftRadius: 2, borderBottomLeftRadius: 2, backgroundColor: "#3a3a3f" }} />
          <View style={{ position: "absolute", right: -6, top: 128, width: 3, height: 56, borderTopRightRadius: 2, borderBottomRightRadius: 2, backgroundColor: "#3a3a3f" }} />
        </View>
      )}
    </View>
  );
}

function lum(hex: string): number {
  const n = parseInt(hex.replace("#", "").slice(0, 6).padEnd(6, "0"), 16);
  return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
}

/** The status bar's signal bars, wifi and battery (PhoneFrame's SVGs, drawn with boxes). */
function Signal() {
  return <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 1.5, height: 11 }}>{[4, 6, 8, 11].map((hh) => <View key={hh} style={{ width: 3, height: hh, borderRadius: 0.5, backgroundColor: "#fff" }} />)}</View>;
}
function Wifi() {
  const arc = (d: number) => <View style={{ position: "absolute", left: (14 - d) / 2, top: 1 + (14 - d) / 4, width: d, height: d, borderRadius: d / 2, borderWidth: 1.6, borderColor: "transparent", borderTopColor: "#fff" }} />;
  return <View style={{ width: 14, height: 11 }}>{arc(15)}{arc(9.5)}<View style={{ position: "absolute", left: 5.5, top: 8, width: 3, height: 3, borderRadius: 1.5, backgroundColor: "#fff" }} /></View>;
}
function Battery() {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 1 }}>
      <View style={{ width: 20, height: 11, borderRadius: 3, borderWidth: 1.2, borderColor: "rgba(255,255,255,0.55)", padding: 1 }}><View style={{ flex: 1, borderRadius: 1.5, backgroundColor: "#fff" }} /></View>
      <View style={{ width: 2, height: 4, borderRadius: 1, backgroundColor: "rgba(255,255,255,0.55)" }} />
    </View>
  );
}
/** The nav bar's house outline. */
function HouseGlyph() {
  return (
    <View style={{ width: 18, height: 17, alignItems: "center" }}>
      <View style={{ position: "absolute", top: 2, width: 11, height: 11, borderLeftWidth: 2.4, borderTopWidth: 2.4, borderColor: "#fff", transform: [{ rotate: "45deg" }] }} />
      <View style={{ position: "absolute", bottom: 0, width: 12, height: 9, borderLeftWidth: 2.4, borderRightWidth: 2.4, borderBottomWidth: 2.4, borderColor: "#fff" }} />
    </View>
  );
}

function Soon({ text }: { text: string }) {
  return <View style={{ padding: 16 }}><Empty text={text} /></View>;
}

function AppIcon({ app, badge, off, fresh, onOpen, size = 50 }: { app: App; badge: number; off: boolean; fresh: boolean; onOpen: () => void; size?: number }) {
  // named for the coach's finger, as the website's data-tour="app-<id>"
  const target = useTourTarget(`app-${app.id}`);
  return (
    <Press onPress={onOpen} style={{ width: "25%", alignItems: "center", paddingVertical: size < 46 ? 3 : 5 }}>
      <View {...target} style={[{ width: size, height: size, borderRadius: size * 0.28, alignItems: "center", justifyContent: "center" }, off
        ? ({ backgroundImage: "linear-gradient(160deg, #0b0f17, #020304)", boxShadow: "inset 0px 0px 0px 1px rgba(255,255,255,0.07), 0px 7px 14px -6px rgba(0,0,0,0.8)" } as ViewStyle)
        : ({ backgroundImage: `linear-gradient(160deg, ${app.hi ?? app.bg}, ${app.bg})`, boxShadow: "inset 0px 1px 0px rgba(255,255,255,0.5), inset 0px -3px 6px rgba(0,0,0,0.25), 0px 7px 14px -6px rgba(0,0,0,0.8)" } as ViewStyle)]}>
        {!off && <View pointerEvents="none" style={{ position: "absolute", left: "6%", right: "6%", top: "4%", height: "46%", borderTopLeftRadius: size * 0.22, borderTopRightRadius: size * 0.22, backgroundImage: "linear-gradient(180deg, rgba(255,255,255,0.35), rgba(255,255,255,0))" } as ViewStyle} />}
        <Text style={{ fontSize: size * 0.46, opacity: off ? 0.18 : 1, textShadowColor: "rgba(0,0,0,0.35)", textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 2 }}>{app.icon}</Text>
        {badge > 0 && !off && (
          <View style={{ position: "absolute", top: -6, right: -6, minWidth: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center", paddingHorizontal: 4, backgroundImage: "linear-gradient(180deg, #f87171, #dc2626)", boxShadow: "0px 0px 0px 2px rgba(0,0,0,0.55), 0px 3px 8px -2px rgba(239,68,68,0.8)" } as ViewStyle}>
            <Text style={{ color: "#fff", fontWeight: "900", fontSize: 10.5 }}>{badge > 99 ? "99+" : badge}</Text>
          </View>
        )}
        {fresh && badge === 0 && !off && <Text style={{ position: "absolute", top: -6, right: -8, backgroundColor: "#fbbf24", color: "#030712", fontWeight: "900", fontSize: 8.5, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 8, overflow: "hidden" }}>NEW</Text>}
      </View>
      <Text numberOfLines={1} style={{ color: off ? "rgba(255,255,255,0.25)" : C.text, fontWeight: "700", fontSize: 9.5, marginTop: 4, textShadowColor: "rgba(0,0,0,0.9)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 }}>{off ? "???" : app.label}</Text>
    </Press>
  );
}

function Grid({ career, glow, badges, installed, onOpen }: { career: CareerState; glow: string; badges: Record<string, number>; installed: (id: string) => boolean; onOpen: (a: App) => void }) {
  const next = nextFixtureFor(career);
  // the Garden is a 3D place: when the crash guard has switched the 3D off it is left off the grid (no dead button)
  const shown = APPS.filter((a) => !(a.id === "garden" && partOff("3d")));
  const grid = career.unlocks ? [...shown.filter((a) => !DOCK.has(a.id)), APP_STORE_ICON] : shown.filter((a) => !DOCK.has(a.id));
  const dock = APPS.filter((a) => DOCK.has(a.id));
  // The phone shrinks to fit (PhoneFrame): every app and the dock stay above HOME/BACK
  // on a small phone (360 x 640) instead of the dock falling under the nav bar.
  const [roomH, setRoomH] = useState(0);
  const rows = Math.ceil(grid.length / 4) + 1;
  const size = roomH ? Math.max(30, Math.min(50, Math.floor((roomH - 96) / rows - 32))) : 50;
  const icon = (a: App) => {
    const off = !!career.unlocks && a.id !== "appstore" && !installed(a.id);
    return <AppIcon key={a.id} app={a} size={size} badge={badges[a.id] ?? 0} off={off} fresh={!!career.unlocks && appIsNew(career, a.id)} onOpen={() => (off ? onOpen(APP_STORE_ICON) : onOpen(a))} />;
  };
  return (
    <ScrollView onLayout={(e) => { const h = Math.round(e.nativeEvent.layout.height); if (h !== roomH) setRoomH(h); }} contentContainerStyle={{ paddingHorizontal: 10, paddingTop: 6, paddingBottom: 4, flexGrow: 1 }}>
      {next ? <NextMatchWidget career={career} next={next} /> : (
        <View style={[glassStyle("glass", glow.startsWith("#") ? glow : undefined), { borderRadius: 20, padding: 12 }]}>
          <Text style={{ color: "#fde68a", fontWeight: "900", fontSize: 10, letterSpacing: 2 }}>SEASON COMPLETE</Text>
          <Text style={{ color: C.dim, fontWeight: "700" }}>★ {formatWallet(career.money)} in the bank</Text>
        </View>
      )}
      <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 8 }}>{grid.map(icon)}</View>
      <View style={{ flex: 1 }} />
      <View style={{ flexDirection: "row", backgroundColor: "rgba(255,255,255,0.11)", borderRadius: 22, paddingVertical: 4, marginTop: 10, boxShadow: "inset 0px 1px 0px rgba(255,255,255,0.18), 0px 8px 20px -10px rgba(0,0,0,0.8)" } as ViewStyle}>{dock.map(icon)}</View>
    </ScrollView>
  );
}

function NextMatchWidget({ career, next }: { career: CareerState; next: Fixture }) {
  const me = career.player.club;
  const home = next.home ? me : next.opponent;
  const away = next.home ? next.opponent : me;
  return (
    <View style={[{ borderRadius: 20, paddingHorizontal: 12, paddingTop: 7, paddingBottom: 8 }, glassStyle("dark"), { boxShadow: "inset 0px 1px 0px rgba(255,255,255,0.14), inset 0px 0px 0px 1px rgba(255,255,255,0.22)" } as ViewStyle]}>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ color: LOOK.emerald300, fontWeight: "900", fontSize: 8.5, letterSpacing: 1.8 }}>NEXT MATCH</Text>
        <Text style={{ color: "rgba(255,255,255,0.7)", fontWeight: "900", fontSize: 9.5 }}>{fixtureDateLabel(career.player.startYear, career.season, next.week, next.kind, divisionOf(career))}</Text>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}>
        <ClubBadge club={home} size={28} career={career} />
        <Text numberOfLines={1} style={{ flex: 1, textAlign: "center", color: C.text, fontWeight: "900", fontSize: 13 }}>{short(home)} <Text style={{ color: C.dim }}>v</Text> {short(away)}</Text>
        <ClubBadge club={away} size={28} career={career} />
      </View>
      <Text style={{ color: "rgba(255,255,255,0.65)", fontWeight: "700", fontSize: 10, textAlign: "center", marginTop: 4 }}>★ <Text style={{ color: "#fef08a", fontWeight: "900" }}>{formatMoney(Math.round(career.money))}</Text> in the bank</Text>
    </View>
  );
}

function AppShell({ app, children }: { app: App; children: ReactNode }) {
  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingTop: 6, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.1)" }}>
        <View style={{ width: 28, height: 28, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundImage: `linear-gradient(160deg, ${app.hi ?? app.bg}, ${app.bg})`, boxShadow: "inset 0px 1px 0px rgba(255,255,255,0.45), 0px 4px 8px -3px rgba(0,0,0,0.7)" } as ViewStyle}><Text style={{ fontSize: 15 }}>{app.icon}</Text></View>
        <Text style={{ color: C.text, fontWeight: "900", fontSize: 14, letterSpacing: -0.2 }}>{app.title ?? app.label}</Text>
      </View>
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
}

// ── Squad (LeagueScreen's squad view, inside the phone) ─────────────────────

function ovrChip(o?: number): { bg: string; ink: string } {
  if (o === undefined) return { bg: "linear-gradient(180deg, rgba(255,255,255,0.1), rgba(255,255,255,0.1))", ink: "rgba(255,255,255,0.7)" };
  return o >= 85 ? { bg: "linear-gradient(180deg, #fde047, #f59e0b)", ink: "#030712" }
    : o >= 75 ? { bg: "linear-gradient(180deg, #34d399, #059669)", ink: "#fff" }
    : o >= 65 ? { bg: "linear-gradient(180deg, #38bdf8, #0284c7)", ink: "#fff" }
    : { bg: "linear-gradient(180deg, #6b7280, #374151)", ink: "#fff" };
}

/** LeagueScreen's squad view inside the phone: one glass table, a row per player, OVR chips by level. */
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
  const W = [34, 38, 26, 26];
  const squadKit = kitsOf(career.player.club, career.clubKits?.[career.player.club]).home;
  return (
    <View style={{ flex: 1, margin: 8, borderRadius: 12, overflow: "hidden", backgroundColor: "rgba(10,22,40,0.55)", borderWidth: 1, borderColor: "rgba(255,255,255,0.14)" }}>
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 6, backgroundColor: "rgba(0,0,0,0.3)", borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.1)" }}>
        <Text style={{ flex: 1, color: "rgba(255,255,255,0.55)", fontWeight: "900", fontSize: 9, letterSpacing: 1 }}>NAME</Text>
        {["OVR", "POS", "G", "A"].map((h, k) => <Text key={h} style={{ width: W[k], textAlign: "center", color: h === "G" ? "#fde047" : h === "A" ? "#93c5fd" : "rgba(255,255,255,0.55)", fontWeight: "900", fontSize: 9, letterSpacing: 1 }}>{h}</Text>)}
      </View>
      <FlatList data={rows} keyExtractor={(p) => p.id} contentContainerStyle={{ padding: 4, gap: 3 }}
        renderItem={({ item: p }) => {
          const chip = ovrChip(p.overall);
          return (
            <View style={[{ flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 5, backgroundColor: "rgba(255,255,255,0.05)" }, p.isYou && youRow(glow)]}>
              {/* Each man's face, as the packed app's squad list (the drawn head in the club's kit). */}
              <PlayerHead id={p.isYou ? "you" : p.id} shirt={squadKit.shirt} shorts={squadKit.trim} trim={squadKit.trim} size={26} skin={p.isYou ? skinToneHex(career.player.skinTone) : undefined} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text numberOfLines={1} style={{ color: C.text, fontWeight: "900", fontSize: 11.5 }}>{p.name}{p.isYou ? " ★" : ""}</Text>
                <Text numberOfLines={1} style={{ color: "rgba(255,255,255,0.7)", fontWeight: "700", fontSize: 8.5 }}>{p.age !== undefined ? `Age ${p.age} · ` : ""}★{formatMoney(p.marketValue)}</Text>
              </View>
              <View style={{ width: W[0], alignItems: "center" }}>
                {p.isYou
                  ? <Text style={{ minWidth: 24, textAlign: "center", color: "#030712", backgroundColor: "#fbbf24", fontWeight: "900", fontSize: 10, borderRadius: 6, overflow: "hidden", paddingHorizontal: 3, paddingVertical: 1 }}>★{starLevel(career)}</Text>
                  : <View style={{ minWidth: 24, borderRadius: 6, paddingHorizontal: 3, paddingVertical: 1, backgroundImage: chip.bg } as ViewStyle}><Text style={{ textAlign: "center", color: chip.ink, fontWeight: "900", fontSize: 10 }}>{p.overall ?? "—"}</Text></View>}
              </View>
              <Text style={{ width: W[1], textAlign: "center", color: "rgba(255,255,255,0.9)", fontWeight: "700", fontSize: 10.5 }}>{p.position}</Text>
              <Text style={{ width: W[2], textAlign: "center", color: p.seasonGoals > 0 ? "#fde047" : "rgba(255,255,255,0.6)", fontWeight: "900", fontSize: 10.5 }}>{p.seasonGoals}</Text>
              <Text style={{ width: W[3], textAlign: "center", color: p.seasonAssists > 0 ? "#93c5fd" : "rgba(255,255,255,0.6)", fontWeight: "900", fontSize: 10.5 }}>{p.seasonAssists}</Text>
            </View>
          );
        }} />
    </View>
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
      getItemLayout={(_, i) => ({ length: 48, offset: 48 * i, index: i })}
      onScrollToIndexFailed={() => {}}
      renderItem={({ item: f, index: i }) => {
        const us = f.home ? f.homeScore : f.awayScore, them = f.home ? f.awayScore : f.homeScore;
        const res = f.played && us !== undefined && them !== undefined ? (us > them ? "W" : us === them ? "D" : "L") : null;
        const tone = res === "W" ? "#059669" : res === "L" ? "#b91c1c" : "#d97706";
        const next = i === nextIdx;
        const lab = fixtureLabel(f);
        return (
          <View style={[{ height: 44, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 10, borderRadius: 12, backgroundColor: next ? "rgba(14,165,233,0.15)" : f.played ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.03)", borderWidth: next ? 1.5 : 1, borderColor: next ? "rgba(56,189,248,0.9)" : "rgba(255,255,255,0.06)" }, next && ({ boxShadow: "0px 0px 14px rgba(56,189,248,0.55)" } as ViewStyle)]}>
            <View style={{ width: 52 }}>
              <Text numberOfLines={1} style={{ color: "#fde68a", fontWeight: "900", fontSize: 9 }}>{lab.top}</Text>
              {lab.sub ? <Text numberOfLines={1} style={{ color: "rgba(253,230,138,0.7)", fontWeight: "900", fontSize: 8 }}>{lab.sub}</Text> : null}
            </View>
            <ClubBadge club={f.opponent} size={20} career={career} />
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={{ color: C.text, fontWeight: "900", fontSize: 12 }}>{short(f.opponent)} <Text style={{ color: "rgba(255,255,255,0.6)" }}>({f.home ? "H" : "A"})</Text></Text>
              {!f.played && <Text numberOfLines={1} style={{ color: "rgba(255,255,255,0.6)", fontSize: 9, fontWeight: "700" }}>{fixtureDateLabel(career.player.startYear, career.season, f.week, f.kind, divisionOf(career))}</Text>}
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
          <View style={{ width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundImage: `linear-gradient(160deg, ${m.tone[0]}, ${m.tone[1]})`, boxShadow: "inset 0px 1px 0px rgba(255,255,255,0.4), 0px 4px 8px -3px rgba(0,0,0,0.7)" } as ViewStyle}><Text style={{ fontSize: 15 }}>{m.icon}</Text></View>
          <View style={{ maxWidth: "82%" }}>
            <Text style={{ color: "rgba(255,255,255,0.6)", fontWeight: "900", fontSize: 9.5, marginLeft: 4, marginBottom: 2 }}>{m.from}</Text>
            {m.open ? (
              <TourTarget name={`msg-${m.open}`}>
              <Press onPress={() => onOpen(m.open!)} style={{ backgroundImage: "linear-gradient(180deg, rgba(52,211,153,0.32), rgba(16,185,129,0.16))", borderRadius: 16, borderBottomLeftRadius: 6, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: "rgba(52,211,153,0.4)" } as ViewStyle}>
                <Text style={{ color: C.text, fontWeight: "700", fontSize: 11.5, lineHeight: 15 }}>{m.text} <Text style={{ color: "#a7f3d0", fontWeight: "900" }}>→</Text></Text>
              </Press>
              </TourTarget>
            ) : (
              <View style={{ backgroundImage: "linear-gradient(180deg, rgba(255,255,255,0.14), rgba(255,255,255,0.07))", borderRadius: 16, borderBottomLeftRadius: 6, paddingHorizontal: 12, paddingVertical: 6 } as ViewStyle}>
                <Text style={{ color: C.text, fontWeight: "700", fontSize: 11.5, lineHeight: 15 }}>{m.text}</Text>
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
  const oppKit = kitsOf(fixture.opponent).home;
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
            <PlayerHead id={key.name} shirt={oppKit.shirt} shorts={oppKit.trim} trim={oppKit.trim} size={44} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.text, fontWeight: "900", fontSize: 16 }}>{key.name}</Text>
              <Text style={{ color: C.dim, fontWeight: "800", fontSize: 12 }}>{key.position} · {key.goals}G {key.assists}A</Text>
            </View>
            <Text style={{ color: C.gold, fontWeight: "900", fontSize: 24 }}>{key.overall}</Text>
          </View>
        </>
      )}
      {/* ScoutReportPanel: the three cards (top scorer, assist king, the gold "top rated") and the cup run. */}
      <Title>Scout report</Title>
      <View style={{ flexDirection: "row", gap: 6 }}>
        {([["Top scorer", report.topScorer, "goals"], ["Assist king", report.topAssister, "assists"], ["Top rated", report.bestPlayer, "rating"]] as const).map(([label, p, stat]) => (
          <View key={label} style={{ flex: 1, alignItems: "center", borderRadius: 12, paddingVertical: 8, paddingHorizontal: 4, gap: 3,
            ...(stat === "rating" ? { backgroundImage: "linear-gradient(180deg, #fde68a, #f59e0b)" } : { backgroundColor: C.panel }) } as ViewStyle}>
            <Text style={{ color: stat === "rating" ? "#451a03" : "#fcd34d", fontSize: 8.5, fontWeight: "900", letterSpacing: 1 }}>{label.toUpperCase()}</Text>
            {p ? (
              <>
                <PlayerHead id={p.name} shirt={oppKit.shirt} shorts={oppKit.trim} trim={oppKit.trim} size={38} />
                <Text numberOfLines={1} style={{ color: stat === "rating" ? "#1c1917" : C.text, fontSize: 11, fontWeight: "900" }}>{p.name.split(" ").slice(-1)[0]}</Text>
                <Text style={{ color: stat === "rating" ? "#451a03" : C.dim, fontSize: 10, fontWeight: "800" }}>{stat === "goals" ? `${p.goals} goals` : stat === "assists" ? `${p.assists} assists` : `${p.overall} OVR`}</Text>
              </>
            ) : <Text style={{ color: C.dim, fontSize: 10 }}>—</Text>}
          </View>
        ))}
      </View>
      {report.cupRun && report.cupRun.length > 0 && (
        <>
          <Title>Cup run</Title>
          {[...report.cupRun].reverse().map((r, i) => (
            <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(0,0,0,0.3)", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5 }}>
              <Text style={{ width: 70, color: C.dim, fontSize: 11, fontWeight: "800" }}>{r.round}</Text>
              <ClubBadge club={r.opponent} size={16} />
              <Text numberOfLines={1} style={{ flex: 1, color: C.text, fontSize: 12, fontWeight: "800" }}>{short(r.opponent)}</Text>
              <Text style={{ color: tone[r.result], fontWeight: "900" }}>{r.result} {r.scoreFor}-{r.scoreAgainst}{r.onPenalties ? " (p)" : ""}</Text>
            </View>
          ))}
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
