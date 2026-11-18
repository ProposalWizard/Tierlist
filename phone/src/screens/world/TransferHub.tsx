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
import { FlatList, Text, View } from "react-native";
import { INTEREST_STEPS, levelOf, type InterestLevel, type InterestedClub, type SeasonGrade } from "@/lib/star/transferInterest";
import { leagueNameFor, divisionOf, type CareerDivision } from "@/lib/star/calendar";
import { formatMoney, formatMoneyPrecise } from "@/lib/star/money";
import { shortClub } from "@/lib/star/media/grammar";
import { useCareer, setCareer, getCareer } from "../../game/store";
import { useNav } from "../../nav";
import { Press } from "../../ui/Press";
import { C } from "../../ui/theme";
import { ScreenFrame, ClubBadge, Btn, rgba, clubGlow } from "../../world/ui";
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
    <View style={{ flexBasis: "48%", flexGrow: 1, backgroundColor: "rgba(0,0,0,0.4)", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 }}>
      <Text style={{ color: C.dim, fontSize: 9, fontWeight: "900", letterSpacing: 1.2 }}>{k.toUpperCase()}</Text>
      <Text numberOfLines={1} style={{ color: gold ? C.gold : C.text, fontWeight: "900", fontSize: 14 }}>{v}</Text>
    </View>
  );
}
function Chooser({ label, glow, onPress, children }: { label: string; glow: string; onPress: () => void; children: ReactNode }) {
  return (
    <Press onPress={onPress} style={{ flexDirection: "row", alignItems: "center", gap: 10, height: 60, borderRadius: 14, paddingHorizontal: 12, backgroundColor: C.panel, borderWidth: 1.5, borderColor: rgba(glow.startsWith("#") ? glow : C.gold, 0.6) }}>
      <Text style={{ width: 54, color: C.dim, fontWeight: "900", fontSize: 10, letterSpacing: 1.2 }}>{label.toUpperCase()}</Text>
      <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8 }}>{children}</View>
      <Text style={{ color: C.text, fontSize: 22, fontWeight: "900" }}>›</Text>
    </Press>
  );
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
      <ScreenFrame title="Pick a league" kicker={kicker} onBack={close} scroll={false}>
        <Text style={{ color: C.text, fontWeight: "800", paddingHorizontal: 14 }}>{wantText}</Text>
        <FlatList data={leagues} keyExtractor={(l) => l.division} contentContainerStyle={{ padding: 12, gap: 8 }}
          renderItem={({ item: l }) => {
            const up = levelOf(l.division) - levelOf(own);
            const accent = up > 0 ? "#34d399" : up < 0 ? "#f97316" : C.gold;
            return (
              <Press onPress={() => { setBrowsing(l.division); setPage("club"); }} style={{ flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 14, padding: 12, backgroundColor: C.panel, borderWidth: 1.5, borderColor: rgba(accent, l.division === league?.division ? 0.9 : 0.5) }}>
                <View style={{ width: 46, height: 46, borderRadius: 10, backgroundColor: C.gold, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ color: "#111", fontWeight: "900", fontSize: 20 }}>{l.clubs.length}</Text>
                  <Text style={{ color: "#111", fontWeight: "900", fontSize: 7 }}>{l.clubs.length === 1 ? "CLUB" : "CLUBS"}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.text, fontWeight: "900", fontSize: 16 }}>{leagueNameFor(l.division).toUpperCase()}</Text>
                  {l.division === own && <Text style={{ color: C.text, fontWeight: "900", fontSize: 11, letterSpacing: 1 }}>YOUR LEAGUE</Text>}
                </View>
                {l.division === league?.division && <Text style={{ color: C.green, fontSize: 18, fontWeight: "900" }}>✓</Text>}
                <Text style={{ color: C.text, fontSize: 22, fontWeight: "900" }}>›</Text>
              </Press>
            );
          }} />
      </ScreenFrame>
    );
  }

  if (page === "club" && browseLeague) {
    return (
      <ScreenFrame title={leagueNameFor(browseLeague.division)} kicker={kicker} onBack={close} scroll={false}>
        <Text style={{ color: C.text, fontWeight: "800", paddingHorizontal: 14 }}>{browseLeague.clubs.length} {browseLeague.clubs.length === 1 ? "club is" : "clubs are"} interested · A to Z</Text>
        <FlatList data={browseLeague.clubs} keyExtractor={(c) => c.club} contentContainerStyle={{ padding: 12, gap: 8 }}
          renderItem={({ item: c }) => {
            const picked = c.club === club?.club && browseLeague.division === league?.division;
            const g = clubGlow(c.club, career);
            return (
              <Press onPress={() => { setDivision(browseLeague.division); setClubName(c.club); close(); }} style={{ flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 14, padding: 10, backgroundColor: C.panel, borderWidth: 1.5, borderColor: rgba(g.startsWith("#") ? g : C.gold, picked ? 0.95 : 0.5) }}>
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
          }} />
      </ScreenFrame>
    );
  }

  const grade = GRADE_COLOUR[r.grade];
  const clubGlowNow = club ? clubGlow(club.club, career) : glow;
  return (
    <ScreenFrame title="Transfer window" kicker={kicker} onBack={() => nav.back()}
      footer={
        <View style={{ flexDirection: "row", gap: 8, padding: 10 }}>
          <Btn style={{ flex: 1 }} tone="plain" label="✕ Stay" onPress={() => transferHandlers().onStay(getCareer() ?? career, nav)} />
          <Btn style={{ flex: 1.6 }} tone="green" disabled={!club} label={club ? `✓ Negotiate · ${shortClub(club.club)}` : "✓ Negotiate"} onPress={() => club && setTalking(club)} />
        </View>
      }>
      <Text style={{ color: C.text, fontWeight: "800" }}>{wantText}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 16, padding: 12, backgroundColor: C.panel, borderWidth: 1.5, borderColor: rgba(grade, 0.7) }}>
        <View style={{ width: 64, height: 64, borderRadius: 14, backgroundColor: grade, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: "#fff", fontWeight: "900", fontSize: 42, fontStyle: "italic", textShadowColor: "#000", textShadowRadius: 3 }}>{r.grade}</Text>
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
          <Chooser label="League" glow={C.gold} onPress={() => setPage("league")}>
            <Text numberOfLines={1} style={{ color: C.text, fontWeight: "900", fontSize: 16, flex: 1 }}>{leagueNameFor(league.division).toUpperCase()}</Text>
            <Text style={{ backgroundColor: C.gold, color: "#111", fontWeight: "900", fontSize: 11, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, overflow: "hidden" }}>{league.clubs.length}</Text>
          </Chooser>
          <Chooser label="Club" glow={clubGlowNow} onPress={() => { setBrowsing(league.division); setPage("club"); }}>
            {club ? (
              <>
                <ClubBadge club={club.club} size={30} career={career} />
                <Text numberOfLines={1} style={{ color: C.text, fontWeight: "900", fontSize: 16, flex: 1 }}>{club.club.toUpperCase()}</Text>
                {club.europe ? <EuroTag comp={club.europe} /> : null}
              </>
            ) : <Text style={{ color: C.dim, fontWeight: "900", fontSize: 16 }}>CHOOSE</Text>}
          </Chooser>
          {!club && <Text style={{ color: C.text, fontWeight: "700", fontSize: 14 }}>Pick a club to see what they offer.</Text>}
          {club && (
            <View style={{ borderRadius: 16, padding: 12, backgroundColor: C.panel, borderWidth: 1.5, borderColor: rgba(clubGlowNow.startsWith("#") ? clubGlowNow : C.gold, 0.8), gap: 10 }}>
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
      ) : <Text style={{ color: C.text, fontWeight: "700", fontSize: 14, marginTop: 10 }}>Have a better season and the clubs will come.</Text>}
    </ScreenFrame>
  );
}
