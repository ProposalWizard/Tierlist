/**
 * RELATIONSHIPS, INSIDE THE PHONE (the website's components/star/RelationsPage.tsx,
 * which PhoneHome opens in its own frame since 24 Oct 2026): flat rows, one each
 * for your boss, the team and the fans (a square bar with the number on it,
 * ticks where something changes, a square ▶ for this week's game, a "?"), then
 * the national manager, Sponsors, a partner slot, Reputation and Fame.
 * The games themselves are the career area's (career-relationship-game).
 */
import { useEffect, useState, type ReactNode } from "react";
import { Canvas, Image as SkImageView, type SkImage } from "@shopify/react-native-skia";
import { fakeFaceFor, DEFAULT_FAKE_FACE } from "@/lib/star/fakeFaces";
import { loadPicture } from "../../draw/PlayerFigure";
import { clubGlow } from "../../world/ui";
import { ScrollView, Text, View, type ViewStyle } from "react-native";
import type { CareerState } from "@/lib/star/types";
import { actionsLeft } from "@/lib/star/week";
import { getTuning } from "@/lib/star/tuningStore";
import { gamePlayedThisWeek } from "@/lib/star/relationships";
import { fameOf } from "@/lib/star/fame";
import { brandsOf } from "@/lib/star/sponsorDeals";
import { intlOf, managerLine, SQUAD_AT, START_AT } from "@/lib/star/intl/career";
import { Press } from "../../ui/Press";
import { TourTarget } from "../../ui/tour";
import { rgba } from "../../world/ui";

type Kind = "boss" | "team" | "fans";
const toneColors = (v: number): [string, string] => (v >= 70 ? ["#10b981", "#6ee7b7"] : v >= 40 ? ["#eab308", "#fde047"] : ["#ef4444", "#fda4af"]);
const CARD_TONE: Record<Kind, string> = { boss: "#60a5fa", team: "#34d399", fans: "#f472b6" };
const ICON: Record<Kind, string> = { boss: "🗣️", team: "👥", fans: "🧣" };
const NAME: Record<Kind, string> = { boss: "Boss", team: "Team", fans: "Fans" };
const HELP: Record<Kind | "sponsors" | "reputation" | "fame", string> = {
  boss: "A good relationship with your boss means you get picked more often. His game: three penalties, each where he tells you.",
  team: "A good relationship with the team means you'll get more chances during a match.",
  fans: "Happy fans lift you in home matches, open up some sponsor deals and set the tone online.",
  sponsors: "Each brand has its own happiness, on the Sponsors screen. It decides whether they renew.",
  reputation: "How the people who run football see you.",
  fame: "Goals, trophies and what you own make you famous.",
};

/**
 * The bar (ui/LiquidBar.tsx, flat.css .sk-liq): a dark rounded track with a hairline rim, the fill a
 * rounded pill running deep to light with a gloss along its top, the number over the middle.
 */
function SquareBar({ value, colors, shown }: { value: number; colors: [string, string]; shown?: number }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <View style={{ height: 20, borderRadius: 10, justifyContent: "center", overflow: "hidden", backgroundImage: "linear-gradient(180deg, rgba(0,0,0,0.78), rgba(0,0,0,0.55))", boxShadow: "inset 0px 1px 3px rgba(0,0,0,0.8), inset 0px 0px 0px 1px rgba(255,255,255,0.22)" } as ViewStyle}>
      {v > 0 ? (
        <View style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${v}%`, minWidth: 8, borderRadius: 10, overflow: "hidden", backgroundImage: `linear-gradient(90deg, ${colors[0]}, ${colors[1]})`, boxShadow: "inset 0px -2px 4px rgba(0,0,0,0.28)" } as ViewStyle}>
          <View pointerEvents="none" style={{ position: "absolute", left: 3, right: 3, top: "8%", height: "38%", borderRadius: 10, backgroundImage: "linear-gradient(180deg, rgba(255,255,255,0.62), rgba(255,255,255,0.06))" } as ViewStyle} />
        </View>
      ) : null}
      <Text style={{ textAlign: "center", color: "#fff", fontSize: 11, lineHeight: 14, fontWeight: "900", textShadowColor: "rgba(0,0,0,0.9)", textShadowRadius: 2, fontVariant: ["tabular-nums"] }}>{Math.round(shown ?? value)}</Text>
    </View>
  );
}

/** A face in a ring (RelationsPage.tsx Face): the photo covers the circle from its top; a glow in the row's colour. */
function Face({ src, fallback, small, tone }: { src?: string; fallback?: string; small?: boolean; tone: string }) {
  const s = small ? 28 : 40;
  const inner = s - 4;
  const [img, setImg] = useState<SkImage | null>(null);
  useEffect(() => {
    let alive = true;
    setImg(null);
    (async () => {
      let got = src ? await loadPicture(src) : null;
      if (!got) got = await loadPicture(fallback ?? DEFAULT_FAKE_FACE);
      if (alive) setImg(got);
    })();
    return () => { alive = false; };
  }, [src, fallback]);
  const k = img ? Math.max(inner / img.width(), inner / img.height()) : 1;
  return (
    <View style={{ width: s, height: s, borderRadius: s / 2, borderWidth: 2, borderColor: "#111827", backgroundColor: "#4b5563", overflow: "hidden", boxShadow: `0px 0px ${small ? 6 : 12}px ${rgba(tone, 0.6)}` } as ViewStyle}>
      {img ? (
        <Canvas style={{ width: inner, height: inner }} pointerEvents="none">
          <SkImageView image={img} x={(inner - img.width() * k) / 2} y={0} width={img.width() * k} height={img.height() * k} fit="fill" />
        </Canvas>
      ) : null}
    </View>
  );
}
/** The manager's stand-in face: never the same fake face as yours (RelationsPage managerFace). */
function managerFace(name: string, yours: string) {
  const f = fakeFaceFor(`manager:${name}`);
  return f === yours ? fakeFaceFor(`gaffer:${name}:2`) : f;
}

function HelpDot({ on, onPress }: { on: boolean; onPress: () => void }) {
  return (
    <Press onPress={onPress} hitSlop={6} style={{ width: 22, height: 22, borderRadius: 3, alignItems: "center", justifyContent: "center", backgroundColor: on ? "#fcd34d" : "#4b5563" }}>
      <Text style={{ color: on ? "#111" : "#fff", fontSize: 13, lineHeight: 16, fontWeight: "900" }}>?</Text>
    </Press>
  );
}

function RowShell({ tone, children, help, dim }: { tone: string; children: ReactNode; help?: string | null; dim?: boolean }) {
  return (
    <View style={{ backgroundColor: "rgba(255,255,255,0.05)", borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.1)" }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 4, paddingVertical: 8, opacity: dim ? 0.3 : 1 }}>
        <View pointerEvents="none" style={{ position: "absolute", left: 0, top: 4, bottom: 4, width: 3, backgroundColor: tone }} />
        {children}
      </View>
      {help ? <Text style={{ paddingHorizontal: 10, paddingBottom: 8, color: "#fff", fontSize: 11.5, lineHeight: 16, fontWeight: "700" }}>{help}</Text> : null}
    </View>
  );
}
const Label = ({ children }: { children: ReactNode }) => <Text numberOfLines={1} style={{ marginBottom: 4, color: "#fff", fontSize: 11, lineHeight: 12, fontWeight: "900", letterSpacing: 1.8, textTransform: "uppercase" }}>{children}</Text>;

export function RelationsApp({ career, onPlay, onOpen }: { career: CareerState; onPlay: (k: Kind) => void; onOpen: (to: "sponsors" | "reputation") => void }) {
  const [help, setHelp] = useState<string | null>(null);
  const left = actionsLeft(career);
  const cost = getTuning("energy.trainingCost");
  const canPlay = left > 0 && career.energy >= cost;
  const r = career.relationships;
  const brands = brandsOf(career);
  const intl = intlOf(career);
  const fame = fameOf(career);
  const gf = career.girlfriend;
  const toggle = (k: string) => setHelp(help === k ? null : k);
  const glow = clubGlow(career.player.club, career);
  // the dressing room: the first two squad players with a photo (RelationsPage `mates`)
  const mates = (career.squad ?? []).filter((p) => p.imageUrl).slice(0, 2);

  const game = (k: Kind, marks: number[]) => {
    const done = gamePlayedThisWeek(career.relGamesPlayed, career.season, career.week, k);
    const v = Math.round(r[k]);
    const off = !canPlay || done;
    return (
      <RowShell key={k} tone={CARD_TONE[k]} help={help === k ? HELP[k] : null}>
        {k === "boss" ? <Face src={career.manager ? managerFace(career.manager.name, career.player.portrait ?? DEFAULT_FAKE_FACE) : undefined} tone={CARD_TONE.boss} />
          : k === "team" ? (mates.length
            ? <View style={{ flexDirection: "row" }}>{mates.map((p, i) => <View key={p.id} style={{ marginLeft: i ? -8 : 0 }}><Face src={p.imageUrl} fallback={fakeFaceFor(p.id)} small tone={CARD_TONE.team} /></View>)}</View>
            : <View style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}><Text style={{ fontSize: 22 }}>{ICON.team}</Text></View>)
          : <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundImage: `radial-gradient(circle at 35% 30%, ${rgba(glow, 0.8)}, ${rgba(glow, 0.3)})` } as ViewStyle}><Text style={{ fontSize: 22 }}>{ICON.fans}</Text></View>}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Label>{NAME[k]}</Label>
          <View>
            <SquareBar value={v} colors={toneColors(v)} />
            {marks.map((m) => <View key={m} pointerEvents="none" style={{ position: "absolute", top: -3, bottom: -3, left: `${m}%`, width: 2, backgroundColor: "#fff", borderWidth: 0.5, borderColor: "rgba(0,0,0,0.6)" }} />)}
          </View>
        </View>
        <Press disabled={off} onPress={() => onPlay(k)} style={{ width: 36, height: 36, borderRadius: 2, alignItems: "center", justifyContent: "center", backgroundImage: `linear-gradient(180deg, ${rgba(CARD_TONE[k], 0.95)}, ${rgba(CARD_TONE[k], 0.7)})`, opacity: off ? 0.35 : 1 } as ViewStyle}>
          <Text style={{ color: "#030712", fontSize: 15, lineHeight: 18, fontWeight: "900" }}>{done ? "✓" : "▶"}</Text>
        </Press>
        <HelpDot on={help === k} onPress={() => toggle(k)} />
      </RowShell>
    );
  };
  const plain = (key: string, icon: string, name: string, tone: string, helpText: string, value?: number, shown?: number, onPress?: () => void, dot?: boolean, dim?: boolean) => {
    const inner = (<>
      <View style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}><Text style={{ fontSize: 24 }}>{icon}</Text></View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Label>{name}</Label>
        {value !== undefined ? <SquareBar value={value} shown={shown} colors={[tone, rgba(tone, 0.6)]} /> : null}
      </View>
    </>);
    return (
      <RowShell key={key} tone={tone} help={help === key ? helpText : null} dim={dim}>
        {onPress ? <Press onPress={onPress} style={{ flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 10 }}>{inner}</Press> : inner}
        {onPress ? (
          <View style={{ paddingRight: 4 }}>
            <Text style={{ color: "#fcd34d", fontSize: 16, fontWeight: "900" }}>→</Text>
            {dot ? <View style={{ position: "absolute", right: 0, top: -4, width: 10, height: 10, borderRadius: 1, backgroundColor: "#ef4444" }} /> : null}
          </View>
        ) : null}
        <HelpDot on={help === key} onPress={() => toggle(key)} />
      </RowShell>
    );
  };
  return (
    <TourTarget name="phone-relations" style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 8, paddingBottom: 8 }} showsVerticalScrollIndicator={false}>
        {game("boss", [40, 70])}
        {game("team", [78])}
        {game("fans", [])}
        {plain("intl", "🌍", `${intl.nation} manager`, "#38bdf8", `${managerLine(career)} He picks his squad from ${SQUAD_AT} and starts you from ${START_AT}. Good club games move him — more in a higher division, and a big nation is harder to impress.`, intl.manager)}
        {plain("sponsors", "🤝", brands.deals.length ? `Sponsors · ${brands.deals.length} deal${brands.deals.length === 1 ? "" : "s"}` : "Sponsors", "#f59e0b", HELP.sponsors, undefined, undefined, () => onOpen("sponsors"), brands.offers.length > 0)}
        {plain("partner", "❤️", "Partner", "#ec4899", "Gifts keep a partner happy. You have none yet.", gf ? gf.happiness : 0, undefined, undefined, false, !gf)}
        {plain("reputation", "🌐", "Reputation", "#38bdf8", HELP.reputation, career.reputation, undefined, () => onOpen("reputation"))}
        {plain("fame", "✨", "Fame", "#d946ef", HELP.fame, Math.min(100, fame), fame)}
      </ScrollView>
    </TourTarget>
  );
}
