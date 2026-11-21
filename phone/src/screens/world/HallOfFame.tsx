/**
 * THE HALL OF FAME (the website's components/star/HallOfFame.tsx + LegendShare.tsx
 * CompareCareers): the dark page with gold light rays, "YOUR CAREERS", HALL OF
 * FAME (FAME in gold), "Kept on this device.", each retired career as a row lit
 * in its club's colour, the empty places blacked out, and a bottom bar:
 * ‹ BACK · ⚖️ COMPARE. A career's page has Hall of Fame · Compare · Share · Remove.
 *
 * The app has no sign-in (lib/app/packed.ts), so: no cloud copy, Compare is
 * between two of your own careers (a friend's code needs the website), and
 * Share sends the career as words through the phone's own share sheet.
 */
import { useMemo, useState, type ReactNode } from "react";
import { ScrollView, Share, Text, View, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { HallEntry } from "@/lib/star/hallOfFame";
import { careerOverview, type CareerOverviewData } from "@/lib/star/careerOverview";
import { compareRows, compareScore } from "@/lib/star/legendShare";
import { shortClub } from "@/lib/star/media/grammar";
import { usePhoneHall, removeFromPhoneHall } from "../../world/hall";
import { useNav } from "../../nav";
import { Press } from "../../ui/Press";
import { FONT } from "../../ui/look";
import { ClubBadge, clubGlow, rgba } from "../../world/ui";
import { CareerOverviewView } from "../career/EndScreens";

const GOLD = "#fbbf24";
const SKY = "#38bdf8";
const years = (first: number, seasons: number) => `${first}–${String(first + Math.max(1, seasons)).slice(-2)}`;

type BarItem = { icon: string; label: string; onPress: () => void; tone?: string };
function Bar({ items }: { items: BarItem[] }) {
  const inset = useSafeAreaInsets();
  return (
    <View style={{ flexDirection: "row", gap: 6, paddingHorizontal: 8, paddingTop: 6, paddingBottom: Math.max(8, inset.bottom), backgroundColor: "#0b0f1a", borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.15)" }}>
      {items.map((b) => (
        <Press key={b.label} onPress={b.onPress} style={{ flex: 1, height: 52, alignItems: "center", justifyContent: "center", gap: 2, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: "rgba(255,255,255,0.18)" }}>
          <Text style={{ color: b.tone ?? "#fcd34d", fontSize: 16, lineHeight: 19, fontWeight: "900" }}>{b.icon}</Text>
          <Text numberOfLines={1} style={{ color: "#fff", fontSize: 10.5, lineHeight: 13, fontWeight: "900", letterSpacing: 0.8, textTransform: "uppercase" }}>{b.label}</Text>
        </Press>
      ))}
    </View>
  );
}
function Page({ children, bar }: { children: ReactNode; bar: BarItem[] }) {
  const inset = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: "#05080f", paddingTop: inset.top }}>
      <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundImage: `radial-gradient(90% 38% at 50% 0%, ${rgba(GOLD, 0.22)} 0%, rgba(0,0,0,0) 70%), linear-gradient(180deg, #0b0f1a, #05080f 60%)` } as ViewStyle} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 24 }}>{children}</ScrollView>
      <Bar items={bar} />
    </View>
  );
}

/** Gold light rays behind the title (the website's <Rays>): thin wedges fanned round the centre. */
function Rays({ size = 250 }: { size?: number }) {
  const R = size / 2;
  return (
    <View pointerEvents="none" style={{ position: "absolute", width: size, height: size, alignSelf: "center", top: (96 - size) / 2 }}>
      {Array.from({ length: 14 }, (_, i) => (
        <View key={i} style={{ position: "absolute", left: R - 9, top: 0, width: 18, height: R, transform: [{ translateY: R / 2 }, { rotate: `${i * (360 / 14)}deg` }, { translateY: -R / 2 }] }}>
          <View style={{ flex: 1, backgroundImage: "linear-gradient(180deg, rgba(253,230,138,0), rgba(253,230,138,0.2))", borderTopLeftRadius: 9, borderTopRightRadius: 9 } as ViewStyle} />
        </View>
      ))}
    </View>
  );
}

function shareText(e: HallEntry): string {
  const c = e.card;
  return `${c.name} — ${c.title}\n${shortClub(c.mainClub)} · ${years(c.firstYear, c.seasons)} · ${c.seasons} seasons\n${c.apps} apps · ${c.goals} goals · ${c.assists} assists · ${c.trophies} trophies${c.ballonDors ? ` · ${c.ballonDors} Golden Ball${c.ballonDors === 1 ? "" : "s"}` : ""}\nMy career in Knowitball: Road to the Golden Ball. knowitball.co.uk`;
}

export function HallOfFameScreen() {
  const nav = useNav();
  const book = usePhoneHall();
  const [open, setOpen] = useState<string | null>(null);
  const [armed, setArmed] = useState(false);
  const [comparing, setComparing] = useState<{ a?: string; b?: string } | null>(null);
  const entries = book.entries;
  const opened = open ? entries.find((e) => e.id === open) : undefined;

  if (comparing) return <Compare mine={entries} start={comparing} onClose={() => setComparing(null)} />;
  if (opened) {
    // the career's own overview pages (the career area's CareerOverviewView), with the Hall's bar under them
    return (
      <CareerOverviewView career={opened.career} bar={<Bar items={[
        { icon: "‹", label: "Hall of Fame", onPress: () => { setOpen(null); setArmed(false); } },
        { icon: "⚖️", label: "Compare", onPress: () => setComparing({ a: opened.id }) },
        { icon: "↗", label: "Share", onPress: () => { Share.share({ message: shareText(opened) }).catch(() => {}); } },
        { icon: "🗑", label: armed ? "Sure?" : "Remove", tone: "#fca5a5", onPress: () => { if (!armed) { setArmed(true); return; } removeFromPhoneHall(opened.id); setArmed(false); setOpen(null); } },
      ]} />} />
    );
  }
  const goals = entries.reduce((n, e) => n + e.card.goals, 0);
  const trophies = entries.reduce((n, e) => n + e.card.trophies, 0);
  return (
    <Page bar={[{ icon: "‹", label: "Back", onPress: () => nav.back() }, { icon: "⚖️", label: "Compare", onPress: () => setComparing({}) }]}>
      <View style={{ marginTop: 16, height: 96, alignItems: "center", justifyContent: "center" }}>
        <Rays />
        <Text style={{ color: "#fde68a", fontSize: 10, fontWeight: "900", letterSpacing: 3 }}>YOUR CAREERS</Text>
        <Text style={{ marginTop: 4, color: "#fff", fontFamily: FONT.display, fontSize: 40, lineHeight: 46, textTransform: "uppercase", textShadowColor: "rgba(0,0,0,0.7)", textShadowRadius: 10, textShadowOffset: { width: 0, height: 3 } }}>Hall of <Text style={{ color: "#fcd34d" }}>Fame</Text></Text>
      </View>
      {entries.length > 0 ? (
        <View style={{ marginTop: 12, flexDirection: "row", gap: 6 }}>
          {([["Careers", entries.length], ["Goals", goals], ["Trophies", trophies]] as const).map(([l, v]) => (
            <View key={l} style={{ flex: 1, alignItems: "center", paddingVertical: 6, backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}>
              <Text style={{ color: "#fff", fontFamily: FONT.display, fontSize: 22, lineHeight: 26, fontVariant: ["tabular-nums"] }}>{v}</Text>
              <Text style={{ marginTop: 2, color: "rgba(255,255,255,0.7)", fontSize: 9.5, fontWeight: "900", letterSpacing: 0.8, textTransform: "uppercase" }}>{l}</Text>
            </View>
          ))}
        </View>
      ) : null}
      <Text style={{ marginTop: 8, color: "rgba(253,230,138,0.9)", fontSize: 11.5, fontWeight: "700", textAlign: "center" }}>Kept on this device.</Text>
      <View style={{ marginTop: 12, gap: 8 }}>
        {entries.map((e) => <HallRow key={e.id} entry={e} onOpen={() => setOpen(e.id)} />)}
        {/* Empty places are blacked out, not hidden (house rule). */}
        {entries.length < 3 ? Array.from({ length: 3 - entries.length }, (_, k) => (
          <View key={`empty-${k}`} style={{ height: 78, backgroundColor: "rgba(0,0,0,0.55)", borderWidth: 1, borderColor: "rgba(255,255,255,0.06)", alignItems: "center", justifyContent: "center" }}>
            {k === 0 ? <Text style={{ color: "rgba(255,255,255,0.45)", fontWeight: "900", fontSize: 12, letterSpacing: 0.8 }}>RETIRE A CAREER TO FILL THIS</Text> : null}
          </View>
        )) : null}
      </View>
    </Page>
  );
}

function HallRow({ entry, onOpen }: { entry: HallEntry; onOpen: () => void }) {
  const c = entry.card;
  const glow = clubGlow(c.mainClub);
  return (
    <Press onPress={onOpen} style={{ overflow: "hidden", borderWidth: 1, borderColor: rgba(glow, 0.5), borderLeftWidth: 3, borderLeftColor: GOLD, backgroundImage: `linear-gradient(120deg, ${rgba(glow, 0.45)}, ${rgba(glow, 0.1)} 50%, rgba(5,8,15,0.92))` } as ViewStyle}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 12, paddingVertical: 10 }}>
        <View style={{ width: 52, height: 52, alignItems: "center", justifyContent: "center" }}><ClubBadge club={c.mainClub} size={44} /></View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ color: "#fff", fontFamily: FONT.display, fontSize: 19, lineHeight: 23, textTransform: "uppercase" }}>{c.name}</Text>
          <Text numberOfLines={1} style={{ color: "#fde68a", fontSize: 11, lineHeight: 15, fontWeight: "900", letterSpacing: 0.3, textTransform: "uppercase" }}>{c.title}</Text>
          <Text numberOfLines={1} style={{ color: "rgba(255,255,255,0.75)", fontSize: 11, lineHeight: 15, fontWeight: "700" }}>{shortClub(c.mainClub)} · {years(c.firstYear, c.seasons)} · {c.seasons} seasons</Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={{ color: "#fff", fontFamily: FONT.display, fontSize: 24, lineHeight: 27, fontVariant: ["tabular-nums"] }}>{c.goals}</Text>
          <Text style={{ color: "rgba(255,255,255,0.65)", fontSize: 9, fontWeight: "900", letterSpacing: 0.8 }}>GOALS</Text>
          <Text style={{ marginTop: 4, color: "#fde68a", fontSize: 11, fontWeight: "900", fontVariant: ["tabular-nums"] }}>{c.ballonDors > 0 ? `🥇 ${c.ballonDors}  ` : ""}🏆 {c.trophies}</Text>
        </View>
      </View>
    </Press>
  );
}

function Side({ o, colour, tag }: { o: CareerOverviewData; colour: string; tag: string }) {
  const glow = clubGlow(o.finalClub);
  return (
    <View style={{ flex: 1, minWidth: 0, alignItems: "center", paddingHorizontal: 8, paddingVertical: 8, borderTopWidth: 3, borderTopColor: colour, backgroundImage: `linear-gradient(180deg, ${rgba(glow, 0.35)}, rgba(5,8,15,0.9))` } as ViewStyle}>
      <Text style={{ color: colour, fontSize: 9.5, fontWeight: "900", letterSpacing: 1.9, textTransform: "uppercase" }}>{tag}</Text>
      <View style={{ marginTop: 4 }}><ClubBadge club={o.finalClub} size={30} /></View>
      <Text numberOfLines={1} style={{ marginTop: 4, color: "#fff", fontFamily: FONT.display, fontSize: 15, lineHeight: 19, textTransform: "uppercase" }}>{o.name}</Text>
      <Text numberOfLines={1} style={{ color: "#fde68a", fontSize: 10.5, fontWeight: "900", textTransform: "uppercase" }}>{o.verdict.title}</Text>
      <Text numberOfLines={1} style={{ color: "rgba(255,255,255,0.7)", fontSize: 10.5, fontWeight: "700" }}>{shortClub(o.finalClub)} · {o.years}</Text>
    </View>
  );
}

/** Head to head: pick two of your careers, then one bar per number, the bigger one lit (CompareCareers). */
function Compare({ mine, start, onClose }: { mine: HallEntry[]; start: { a?: string; b?: string }; onClose: () => void }) {
  const [a, setA] = useState<string | null>(start.a ?? null);
  const [b, setB] = useState<string | null>(start.b ?? null);
  const ea = mine.find((e) => e.id === a), eb = mine.find((e) => e.id === b);
  const oa = useMemo(() => (ea ? careerOverview(ea.career) : null), [ea]);
  const ob = useMemo(() => (eb ? careerOverview(eb.career) : null), [eb]);
  if (oa && ob) {
    const rows = compareRows(oa, ob);
    const score = compareScore(rows);
    return (
      <Page bar={[{ icon: "‹", label: "Another career", onPress: () => setB(null) }, { icon: "✕", label: "Done", onPress: onClose }]}>
        <Text style={{ marginTop: 12, color: "#fde68a", fontSize: 10, fontWeight: "900", letterSpacing: 3, textAlign: "center" }}>HEAD TO HEAD</Text>
        <View style={{ marginTop: 8, flexDirection: "row", gap: 6 }}><Side o={oa} colour={GOLD} tag="Career 1" /><Side o={ob} colour={SKY} tag="Career 2" /></View>
        <View style={{ marginTop: 8, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12 }}>
          <Text style={{ color: GOLD, fontSize: 13, fontWeight: "900" }}>{score.a}</Text>
          <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, fontWeight: "900", letterSpacing: 0.3 }}>NUMBERS WON</Text>
          <Text style={{ color: SKY, fontSize: 13, fontWeight: "900" }}>{score.b}</Text>
        </View>
        <View style={{ marginTop: 12, gap: 8 }}>
          {rows.map((r) => {
            const max = Math.max(r.a, r.b, 1e-9);
            const show = r.show ?? ((n: number) => String(n));
            const aWins = r.label !== "Clubs" && r.a > r.b, bWins = r.label !== "Clubs" && r.b > r.a;
            return (
              <View key={r.label}>
                <Text style={{ color: "rgba(255,255,255,0.75)", fontSize: 10, fontWeight: "900", letterSpacing: 1.6, textAlign: "center", textTransform: "uppercase" }}>{r.label}</Text>
                <View style={{ marginTop: 2, flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Text style={{ width: 51, textAlign: "right", color: aWins ? "#fcd34d" : "rgba(255,255,255,0.8)", fontFamily: FONT.display, fontSize: 17, lineHeight: 20 }}>{show(r.a)}</Text>
                  <View style={{ flex: 1, height: 14, flexDirection: "row", justifyContent: "flex-end", backgroundColor: "rgba(255,255,255,0.05)" }}><View style={{ width: `${(r.a / max) * 100}%`, backgroundColor: aWins ? GOLD : rgba(GOLD, 0.45) }} /></View>
                  <View style={{ flex: 1, height: 14, flexDirection: "row", backgroundColor: "rgba(255,255,255,0.05)" }}><View style={{ width: `${(r.b / max) * 100}%`, backgroundColor: bWins ? SKY : rgba(SKY, 0.45) }} /></View>
                  <Text style={{ width: 51, color: bWins ? "#7dd3fc" : "rgba(255,255,255,0.8)", fontFamily: FONT.display, fontSize: 17, lineHeight: 20 }}>{show(r.b)}</Text>
                </View>
              </View>
            );
          })}
        </View>
      </Page>
    );
  }
  const picking = a ? "second" : "first";
  return (
    <Page bar={[{ icon: "‹", label: "Back", onPress: onClose }]}>
      <Text style={{ marginTop: 16, color: "#7dd3fc", fontSize: 10, fontWeight: "900", letterSpacing: 3, textAlign: "center" }}>COMPARE YOUR CAREERS</Text>
      <Text style={{ marginTop: 4, color: "#fff", fontFamily: FONT.display, fontSize: 32, lineHeight: 38, textAlign: "center" }}>HEAD TO HEAD</Text>
      {mine.length < 2 ? (
        <View style={{ marginTop: 16, padding: 12, backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: "rgba(56,189,248,0.35)" }}>
          <Text style={{ color: "#fff", fontSize: 13, lineHeight: 18, fontWeight: "800" }}>Retire two careers to compare them here.</Text>
          <Text style={{ marginTop: 4, color: "rgba(255,255,255,0.7)", fontSize: 11.5, lineHeight: 16, fontWeight: "600" }}>Comparing with a friend's code needs an account, on knowitball.co.uk.</Text>
        </View>
      ) : (<>
        <Text style={{ marginTop: 16, color: "#fde68a", fontSize: 11, fontWeight: "900", letterSpacing: 0.8 }}>PICK THE {picking.toUpperCase()} CAREER</Text>
        <View style={{ marginTop: 8, gap: 8 }}>
          {mine.filter((e) => e.id !== a).map((e) => <HallRow key={e.id} entry={e} onOpen={() => (a ? setB(e.id) : setA(e.id))} />)}
        </View>
      </>)}
    </Page>
  );
}
