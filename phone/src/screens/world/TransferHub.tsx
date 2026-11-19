/**
 * THE SUMMER TRANSFER WINDOW — the phone port of components/star/TransferHub.tsx
 * and page.tsx's season-transfer → transfer-request-talk flow.
 * Hub (your season as a letter S–D, League and Club choosers, the club you
 * picked with its offer) → League list → Club list (A to Z, how keen each
 * is) → Negotiate (the usual talks, a weekly wage) → signed, or the club
 * walks away and is off the list until next summer. Stay keeps you.
 * Who wants you: lib/star/transferInterest.ts (via world/transfers.ts).
 */
import { useMemo, useState, type ReactNode } from "react";
import { ScrollView, Text, View, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { INTEREST_STEPS, levelOf, type InterestLevel, type InterestedClub, type SeasonGrade } from "@/lib/star/transferInterest";
import { leagueNameFor, divisionOf, type CareerDivision } from "@/lib/star/calendar";
import { formatMoney, formatMoneyPrecise } from "@/lib/star/money";
import { shortClub } from "@/lib/star/media/grammar";
import { useCareer, setCareer, getCareer } from "../../game/store";
import { useNav } from "../../nav";
import { Press } from "../../ui/Press";
import { C } from "../../world/lookKit";
import { ClubBadge, rgba, clubGlow } from "../../world/ui";
import { FONT } from "../../ui/look";
import { summerInterest, afterTalks } from "../../world/transfers";
import { transferHandlers } from "../../world/transferHandlers";
import { Negotiation } from "./Negotiation";

export const GRADE_COLOUR: Record<SeasonGrade, string> = { S: "#16d466", A: "#8fe33a", B: "#facc15", C: "#f97316", D: "#ef4444" };
export const INTEREST_COLOUR: Record<InterestLevel, string> = { Desperate: "#16d466", "Very keen": "#8fe33a", Keen: "#facc15", Interested: "#f97316" };
const EURO_TAG: Record<string, string> = { "Champions League": "UCL", "Europa League": "UEL", "Conference League": "UECL" };
const MOVED_WORD = { promoted: "Promoted", relegated: "Relegated" } as const;
const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th"}`;

function InterestBar({ level }: { level: InterestLevel }) {
  const on = INTEREST_STEPS[level];
  const color = INTEREST_COLOUR[level];
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
      <View style={{ flexDirection: "row", gap: 3 }}>
        {[1, 2, 3, 4].map(i => <View key={i} style={{ width: 12, height: 9, borderRadius: 2, backgroundColor: i <= on ? color : "rgba(255,255,255,0.18)" }} />)}
      </View>
      <Text style={{ color, fontWeight: "900", fontSize: 12 }}>{level}</Text>
    </View>
  );
}
function EuroTag({ comp }: { comp: string }) {
  return <Text style={{ backgroundColor: "#0ea5e9", color: "#fff", fontWeight: "900", fontSize: 9, paddingHorizontal: 4, paddingVertical: 1, borderRadius: 3, overflow: "hidden" }}>{EURO_TAG[comp] ?? comp}</Text>;
}
function Fact({ k, v, gold }: { k: string; v: string; gold?: boolean }) {
  return (
    <View style={{ flexBasis: "48%", flexGrow: 1, backgroundColor: "rgba(0,0,0,0.4)", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 }}>
      <Text style={{ color: C.dim, fontSize: 9, fontWeight: "900", letterSpacing: 1.2 }}>{k.toUpperCase()}</Text>
      <Text numberOfLines={1} style={{ color: gold ? C.gold : C.text, fontWeight: "900", fontSize: 14 }}>{v}</Text>
    </View>
  );
}
function Chooser({ label, glow, onPress, children }: { label: string; glow: string; onPress: () => void; children: ReactNode }) {
  return (
    <Press onPress={onPress} style={[tile(glow, 0.32), { flexDirection: "row", alignItems: "center", gap: 10, height: 60, borderRadius: 12, paddingHorizontal: 12 }]}>
      <Text style={{ width: 50, color: "rgba(255,255,255,0.85)", fontWeight: "900", fontSize: 10, letterSpacing: 1.4 }}>{label.toUpperCase()}</Text>
      <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8 }}>{children}</View>
      <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 20, fontWeight: "900" }}>›</Text>
    </Press>
  );
}

// ── The window's stage (TransferHub.tsx WindowFrame) ────────────────────────

/** The Home screen's tile: dark glass lit from the top in one colour (TransferHub.tsx tile). */
function tile(color: string, strength = 0.38): ViewStyle {
  const c = color.startsWith("#") ? color : "#fbbf24";
  return {
    backgroundImage: `radial-gradient(90% 80% at 50% 0%, ${rgba(c, strength)} 0%, ${rgba(c, 0)} 75%), linear-gradient(180deg, rgba(9,13,26,0.95), rgba(9,13,26,0.95))`,
    boxShadow: `inset 0px 1px 0px rgba(255,255,255,0.14), inset 0px 0px 0px 1.5px ${rgba(c, 0.6)}, 0px 8px 18px -8px rgba(0,0,0,0.9)`,
  } as ViewStyle;
}

/** Words with a hard black outline (the website's 4-way text-shadow), so gold and white read over the slab. */
function Outlined({ children, size, color, font, italic, lineHeight, width = 2 }: { children: string; size: number; color: string; font?: string; italic?: boolean; lineHeight?: number; width?: number }) {
  const st = { fontSize: size, lineHeight: lineHeight ?? Math.round(size * 1.15), fontFamily: font, fontWeight: font ? undefined : ("900" as const) };
  return (
    <View style={italic ? { transform: [{ skewX: "-9deg" }] } : undefined}>
      {[[-width, -width], [width, -width], [-width, width], [width, width]].map(([x, y]) => (
        <Text key={`${x},${y}`} numberOfLines={1} style={[st, { position: "absolute", left: x, top: y, color: "#000" }]}>{children}</Text>
      ))}
      <Text numberOfLines={1} style={[st, { color }]}>{children}</Text>
    </View>
  );
}

/**
 * Deadline Day's stage with the Home screen's lights: the night lit in your
 * club's colour, the diagonal gold slab on the right with its slashes, the
 * "TRANSFERS" tab down the left edge, a gold heavy-italic title, and a ticker
 * over the full-width buttons. Still: the website's shine and scrolling ticker
 * are left out (nothing moves at rest).
 */
function WindowFrame({ glow, kicker, title, sub, right, ticker, bottom, children }: {
  glow: string; kicker: string; title: string; sub?: string; right?: ReactNode; ticker: string; bottom?: ReactNode; children: ReactNode;
}) {
  const inset = useSafeAreaInsets();
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  const g = glow.startsWith("#") ? glow : "#fbbf24";
  const slabW = box ? box.w * 0.46 : 0;
  const lean = Math.atan2(slabW * 0.3, box?.h ?? 1);
  return (
    <View style={{ flex: 1, backgroundColor: "#070b16" }} onLayout={(e) => { const { width, height } = e.nativeEvent.layout; if (!box || box.w !== width || box.h !== height) setBox({ w: width, h: height }); }}>
      <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, overflow: "hidden" }}>
        <View style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundImage: `radial-gradient(95% 42% at 35% -6%, ${rgba(g, 0.55)} 0%, ${rgba(g, 0)} 72%), radial-gradient(70% 40% at 80% 105%, rgba(245,197,24,0.18), rgba(245,197,24,0) 70%), linear-gradient(180deg, #0a1120, #070b16 55%, #05070d)` } as ViewStyle} />
        {[0.12, 0.88].map((x) => box && (
          <View key={x} style={{ position: "absolute", left: box.w * x - 48, top: box.h * 0.02, width: 96, height: 96, borderRadius: 48, backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.12) 25%, rgba(255,255,255,0) 65%)" } as ViewStyle} />
        ))}
        {box && (
          <>
            {/* the gold slab: its left edge leans in, 30% across at the top */}
            <View style={{ position: "absolute", top: -2, bottom: -2, left: box.w - slabW + slabW * 0.15, width: slabW * 1.4, transform: [{ skewX: `${-lean}rad` }],
              backgroundImage: "linear-gradient(115deg, #d99a00 0%, #f5c518 38%, #ffe066 62%, #f0b400 100%)" } as ViewStyle} />
            <View style={{ position: "absolute", top: -2, bottom: -2, left: box.w - slabW + slabW * 0.15, width: slabW * 1.4, transform: [{ skewX: `${-lean}rad` }],
              backgroundImage: "linear-gradient(115deg, rgba(0,0,0,0) 55%, rgba(0,0,0,0.4) 100%)" } as ViewStyle} />
            {[0, 1, 2].map((i) => {
              const s = box.h * 0.7;
              return <View key={i} style={{ position: "absolute", width: s, height: s, top: box.h / 2 - s / 2, right: box.w * (-0.34 + i * 0.16), borderRightWidth: 3, borderColor: "rgba(251,191,36,0.25)", transform: [{ rotate: "18deg" }] }} />;
            })}
          </>
        )}
      </View>

      {/* the TRANSFERS tab down the left edge */}
      <View pointerEvents="none" style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 28, backgroundColor: "rgba(0,0,0,0.75)", zIndex: 2 }}>
        <View style={{ position: "absolute", top: inset.top + 16, left: 14 - 60, width: 120, height: 14, alignItems: "center", justifyContent: "center", transform: [{ translateY: 46 }, { rotate: "-90deg" }] }}>
          <Text style={{ color: "#fcd34d", fontSize: 9, fontWeight: "900", letterSpacing: 2.7 }}>TRANSFERS</Text>
        </View>
      </View>

      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8, paddingTop: inset.top + 20, paddingLeft: 40, paddingRight: 12, paddingBottom: 8, zIndex: 3 }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ alignSelf: "flex-start", borderRadius: 999, borderWidth: 1, borderColor: "rgba(251,191,36,0.6)", backgroundColor: "rgba(0,0,0,0.6)", paddingHorizontal: 10, paddingVertical: 4 }}>
            <Text style={{ color: "#fcd34d", fontSize: 9, fontWeight: "900", letterSpacing: 1.8, textTransform: "uppercase" }}>{kicker}</Text>
          </View>
          <View style={{ marginTop: 8 }}><Outlined size={33} lineHeight={38} color="#ffd23f" font={FONT.display} italic>{title.toUpperCase()}</Outlined></View>
          {sub ? <View style={{ marginTop: 4 }}><Outlined size={12} color="#fff" width={1}>{sub}</Outlined></View> : null}
        </View>
        {right}
      </View>

      <ScrollView style={{ flex: 1, zIndex: 3 }} contentContainerStyle={{ paddingLeft: 40, paddingRight: 12, paddingTop: 4, paddingBottom: 16, gap: 8 }}>{children}</ScrollView>

      <View style={{ zIndex: 4, backgroundColor: "rgba(0,0,0,0.9)", borderTopWidth: 1, borderTopColor: "rgba(251,191,36,0.3)" }}>
        <Text numberOfLines={1} style={{ paddingLeft: 40, paddingVertical: 6, color: "rgba(252,211,77,0.9)", fontSize: 9, fontWeight: "900", letterSpacing: 1.6, textTransform: "uppercase" }}>{ticker}{ticker}</Text>
        {bottom ? <View style={{ paddingBottom: inset.bottom }}>{bottom}</View> : null}
      </View>
    </View>
  );
}

/** The bar's full-width buttons (ui/Nav.tsx BarButton): plain dark, or gold. */
function BarButton({ icon, label, onPress, primary, disabled, flex }: { icon: ReactNode; label: string; onPress: () => void; primary?: boolean; disabled?: boolean; flex: number }) {
  return (
    <Press disabled={disabled} onPress={onPress} style={[{ flex, height: 54, alignItems: "center", justifyContent: "center", gap: 2, opacity: disabled ? 0.4 : 1 },
      primary ? ({ backgroundImage: "linear-gradient(180deg, #fde047, #f59e0b)", boxShadow: "inset 0px 1px 0px rgba(255,255,255,0.5)" } as ViewStyle) : { backgroundColor: "rgba(255,255,255,0.04)" }]}>
      {typeof icon === "string" ? <Text style={{ fontSize: 17, color: primary ? "#030712" : "#fff" }}>{icon}</Text> : icon}
      <Text numberOfLines={1} style={{ color: primary ? "#030712" : "#fff", fontSize: 12, fontWeight: "900", letterSpacing: 0.6, textTransform: "uppercase" }}>{label}</Text>
    </Press>
  );
}

function CloseBtn({ onPress }: { onPress: () => void }) {
  return <Press onPress={onPress} style={[tile("#ffffff", 0.12), { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" }]}><Text style={{ color: "#fff", fontSize: 20, fontWeight: "900" }}>✕</Text></Press>;
}

type Page = "hub" | "league" | "club";

export function TransferHubScreen() {
  const career = useCareer();
  const nav = useNav();
  const interest = useMemo(() => (career ? summerInterest(career) : null), [career]);
  const [division, setDivision] = useState<CareerDivision | null>(null);
  const [clubName, setClubName] = useState<string | null>(null);
  const [page, setPage] = useState<Page>("hub");
  const [browsing, setBrowsing] = useState<CareerDivision | null>(null);
  const [talking, setTalking] = useState<InterestedClub | null>(null);
  if (!career || !interest) return null;

  const own = interest.ownDivision ?? divisionOf(career);
  const leagues = interest.leagues;
  const league = leagues.find(l => l.division === division) ?? leagues[0];
  const club = league?.clubs.find(c => c.club === clubName);
  const browseLeague = leagues.find(l => l.division === browsing) ?? league;
  const total = leagues.reduce((n, l) => n + l.clubs.length, 0);
  const r = interest.report;
  const kicker = `Season ${career.season} · Summer window`;
  const wantText = total === 0 ? "No club has come in for you" : `${total} ${total === 1 ? "club wants" : "clubs want"} you`;
  const glow = clubGlow(career.player.club, career);
  const close = () => { setBrowsing(null); setPage("hub"); };
  const ticker = `Transfer Centre · ${wantText} · Season grade ${r.grade} · ${leagues.length} ${leagues.length === 1 ? "league" : "leagues"} · `;

  // Talks with the club you picked: a WEEKLY wage, as on the website.
  if (talking) {
    const offer = talking.offer;
    return (
      <Negotiation mode="selling" playerName={`${career.player.firstName} ${career.player.lastName} — terms with ${offer.club}`}
        marketValue={offer.wage} counterpartLabel={offer.club} kicker="Contract talks" valueLabel="Their wage offer, per week"
        note="Every number here is a weekly wage."
        onDone={(weekly) => {
          const now = getCareer() ?? career;
          const res = afterTalks(now, offer, weekly);
          setTalking(null);
          if (!res.agreed) { setCareer(res.career); setClubName(null); return; }
          transferHandlers().onSigned(res.career, res.agreed, nav);
        }} />
    );
  }

  if (page === "league") {
    return (
      <WindowFrame glow={glow} kicker={kicker} title="Pick a league" sub={wantText} ticker={ticker} right={<CloseBtn onPress={close} />}>
        {leagues.map((l) => {
            const up = levelOf(l.division) - levelOf(own);
            const accent = up > 0 ? "#34d399" : up < 0 ? "#f97316" : C.gold;
            return (
              <Press key={l.division} onPress={() => { setBrowsing(l.division); setPage("club"); }} style={[tile(accent, l.division === league?.division ? 0.55 : 0.38), { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 12, padding: 12 }]}>
                <View style={{ width: 44, height: 44, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundImage: "linear-gradient(180deg, #ffe066, #f0b400)", boxShadow: "inset 0px 1px 0px rgba(255,255,255,0.6)" } as ViewStyle}>
                  <Text style={{ color: "#111", fontWeight: "900", fontSize: 20 }}>{l.clubs.length}</Text>
                  <Text style={{ color: "#111", fontWeight: "900", fontSize: 7 }}>{l.clubs.length === 1 ? "CLUB" : "CLUBS"}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.text, fontWeight: "900", fontSize: 16 }}>{leagueNameFor(l.division).toUpperCase()}</Text>
                  {l.division === own && <Text style={{ color: C.text, fontWeight: "900", fontSize: 11, letterSpacing: 1 }}>YOUR LEAGUE</Text>}
                </View>
                {l.division === league?.division && <Text style={{ color: C.green, fontSize: 18, fontWeight: "900" }}>✓</Text>}
                <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 20, fontWeight: "900" }}>›</Text>
              </Press>
            );
          })}
      </WindowFrame>
    );
  }

  if (page === "club" && browseLeague) {
    return (
      <WindowFrame glow={glow} kicker={kicker} title={leagueNameFor(browseLeague.division)} sub={`${browseLeague.clubs.length} ${browseLeague.clubs.length === 1 ? "club is" : "clubs are"} interested · A to Z`} ticker={ticker} right={<CloseBtn onPress={close} />}>
        {browseLeague.clubs.map((c) => {
            const picked = c.club === club?.club && browseLeague.division === league?.division;
            const g = clubGlow(c.club, career);
            return (
              <Press key={c.club} onPress={() => { setDivision(browseLeague.division); setClubName(c.club); close(); }} style={[tile(g, picked ? 0.6 : 0.45), { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 }]}>
                <ClubBadge club={c.club} size={36} career={career} />
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Text numberOfLines={1} style={{ color: C.text, fontWeight: "900", fontSize: 15, flexShrink: 1 }}>{c.club}</Text>
                    {c.europe ? <EuroTag comp={c.europe} /> : null}
                  </View>
                  <InterestBar level={c.interest} />
                  <Text style={{ color: C.dim, fontWeight: "700", fontSize: 11 }}>{c.moved ? MOVED_WORD[c.moved] : `Finished ${ordinal(c.position)}`}</Text>
                </View>
                {picked && <Text style={{ color: C.green, fontSize: 18, fontWeight: "900" }}>✓</Text>}
              </Press>
            );
          })}
      </WindowFrame>
    );
  }

  const grade = GRADE_COLOUR[r.grade];
  const clubGlowNow = club ? clubGlow(club.club, career) : glow;
  return (
    <WindowFrame glow={glow} kicker={kicker} title="Transfer window" sub={wantText} ticker={ticker}
      bottom={
        <View style={{ flexDirection: "row", gap: 1 }}>
          <BarButton flex={1} icon={<Text style={{ color: "#f87171", fontSize: 17 }}>✕</Text>} label="Stay" onPress={() => transferHandlers().onStay(getCareer() ?? career, nav)} />
          <BarButton flex={1.6} primary icon="✓" disabled={!club} label={club ? `Negotiate · ${shortClub(club.club)}` : "Negotiate"} onPress={() => club && setTalking(club)} />
        </View>
      }>
      <View style={[tile(grade, 0.5), { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 12, padding: 12 }]}>
        <View style={{ width: 64, height: 64, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundImage: `linear-gradient(180deg, ${grade}, ${rgba(grade, 0.7)})`, boxShadow: `0px 0px 22px ${rgba(grade, 0.7)}, inset 0px 1px 0px rgba(255,255,255,0.45)` } as ViewStyle}>
          <Outlined size={44} lineHeight={50} color="#fff" italic>{r.grade}</Outlined>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: grade, fontWeight: "900", fontSize: 10, letterSpacing: 1.5 }}>YOUR SEASON</Text>
          <View style={{ flexDirection: "row", gap: 4, marginTop: 4 }}>
            {([[r.goals, "Goals"], [r.assists, "Assists"], [r.rating !== null ? r.rating.toFixed(1) : "–", "Avg"], [r.apps, "Games"]] as const).map(([v, k]) => (
              <View key={k} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", borderRadius: 8, paddingVertical: 4, alignItems: "center" }}>
                <Text style={{ color: C.text, fontWeight: "900", fontSize: 16 }}>{v}</Text>
                <Text style={{ color: C.dim, fontWeight: "900", fontSize: 8 }}>{k.toUpperCase()}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      {league ? (
        <>
          <Chooser label="League" glow="#fbbf24" onPress={() => setPage("league")}>
            <Text numberOfLines={1} style={{ color: C.text, fontFamily: FONT.display, fontSize: 18, lineHeight: 24, letterSpacing: 0.4, flex: 1 }}>{leagueNameFor(league.division).toUpperCase()}</Text>
            <Text style={{ backgroundColor: "#fbbf24", color: "#000", fontWeight: "900", fontSize: 11, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, overflow: "hidden" }}>{league.clubs.length}</Text>
          </Chooser>
          <Chooser label="Club" glow={clubGlowNow} onPress={() => { setBrowsing(league.division); setPage("club"); }}>
            {club ? (
              <>
                <ClubBadge club={club.club} size={30} career={career} />
                <Text numberOfLines={1} style={{ color: C.text, fontFamily: FONT.display, fontSize: 18, lineHeight: 24, letterSpacing: 0.4, flex: 1 }}>{club.club.toUpperCase()}</Text>
                {club.europe ? <EuroTag comp={club.europe} /> : null}
              </>
            ) : <Text style={{ color: "rgba(255,255,255,0.7)", fontFamily: FONT.display, fontSize: 18, lineHeight: 24, letterSpacing: 0.4 }}>CHOOSE</Text>}
          </Chooser>
          {!club && <View style={{ marginTop: 8 }}><Outlined size={14} color="#fff" width={1}>Pick a club to see what they offer.</Outlined></View>}
          {club && (
            <View style={[tile(clubGlowNow, 0.6), { borderRadius: 12, padding: 12, gap: 10 }]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <ClubBadge club={club.club} size={52} career={career} />
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={{ color: C.text, fontWeight: "900", fontSize: 19 }}>{club.club.toUpperCase()}</Text>
                  <InterestBar level={club.interest} />
                </View>
              </View>
              <Text style={{ color: C.text, fontWeight: "700", fontStyle: "italic", fontSize: 14, backgroundColor: "rgba(0,0,0,0.4)", borderRadius: 10, padding: 10, overflow: "hidden" }}>“{club.why}”</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                <Fact k="Contract" v={`${club.offer.seasons} seasons`} />
                <Fact k="Your club gets" v={`★${formatMoney(club.fee)}`} gold />
                <Fact k="Your wage now" v={`★${formatMoneyPrecise(career.contract.wage)}/wk`} />
                {club.moved ? <Fact k="Last season" v={MOVED_WORD[club.moved]} />
                  : club.division === own ? <Fact k="Finished" v={`${ordinal(club.position)} of ${club.of}`} />
                  : <Fact k="League" v={leagueNameFor(club.division)} />}
              </View>
            </View>
          )}
        </>
      ) : <View style={{ marginTop: 16 }}><Outlined size={14} color="#fff" width={1}>Have a better season and the clubs will come.</Outlined></View>}
    </WindowFrame>
  );
}
