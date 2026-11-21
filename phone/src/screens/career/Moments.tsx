/**
 * MOMENTS (page.tsx: press, dilemma, season-reel, the pop-ups, the "?" help).
 *  - Press: PressConference.tsx (question, three answers, what each moves).
 *  - Dilemma: DilemmaModal.tsx (never a gambling one on the phone).
 *    Both are switched OFF in the website's flow ("on request"); the phone
 *    keeps them off too (flow.PRESS_ON / DILEMMAS_ON) with the screens ready.
 *  - SeasonReel: "Your season", every goal as a still card in turn (the
 *    website's video reel needs the goal recordings, which the phone has not).
 *  - Pops: the achievement pop-ups with the star bar, the star-rating banner
 *    and the full screen every ten (AchievementToasts, ratingChange, newStar).
 *  - Help: each screen's "?" (lib/star/tours.ts HELP_TOURS), as a page.
 */
import { TopSpace } from "../../ui/safe";
import { useEffect, useState, type ReactNode } from "react";
import { View, Text, Modal } from "react-native";
import type { CareerState } from "@/lib/star/types";
import type { PressQuestion, PressOption } from "@/lib/star/media";
import type { Dilemma, DilemmaEffect } from "@/lib/star/dilemmas";
import { seasonGoals } from "@/lib/star/goalLog";
import { starTitle } from "@/lib/star/starPoints";
import { HELP_TOURS, type HelpScreen } from "@/lib/star/tours";
import { shortClub } from "@/lib/star/media/grammar";
import * as flow from "../../game/flow";
import { Press } from "../../ui/Press";
import { Frame, Card, Label, Btn, Fill, ClubCrest, C } from "./kit";

// ── The press conference ──
function Delta({ label, n }: { label: string; n: number }) {
  const bg = n === 0 ? "rgba(255,255,255,0.1)" : n > 0 ? "rgba(16,185,129,0.25)" : "rgba(239,68,68,0.25)";
  const fg = n === 0 ? C.dim : n > 0 ? "#a7f3d0" : "#fecaca";
  return <View style={{ backgroundColor: bg, borderRadius: 99, paddingHorizontal: 8, paddingVertical: 2 }}><Text style={{ color: fg, fontSize: 10, fontWeight: "800" }}>{label} {n === 0 ? "—" : `${n > 0 ? "+" : ""}${n}`}</Text></View>;
}
export function PressScreen({ question, go }: { question: PressQuestion; go: (s: flow.Step) => void }) {
  const [chosen, setChosen] = useState<PressOption | null>(null);
  return (
    <Frame kicker={question.headline} title="Press conference">
      <Text style={{ color: C.text, fontSize: 20, fontWeight: "900", textAlign: "center" }}>{question.question}</Text>
      <Text style={{ textAlign: "center", fontSize: 18 }}>🎙️ 🎙️ 🎙️</Text>
      {!chosen && question.options.map((o) => (
        <Press key={o.label} onPress={() => setChosen(o)}>
          <Card>
            <Text style={{ color: C.text, fontWeight: "900", fontSize: 15 }}>{o.label}</Text>
            <View style={{ flexDirection: "row", gap: 6, marginTop: 6 }}><Delta label="Boss" n={o.boss} /><Delta label="Team" n={o.team} /><Delta label="Fans" n={o.fans} /></View>
          </Card>
        </Press>
      ))}
      {chosen && (
        <>
          <Card tone={C.green}>
            <Text style={{ color: C.text, fontWeight: "900" }}>“{chosen.label.replace(/[“”]/g, "")}”</Text>
            <Text style={{ color: C.dim, marginTop: 6 }}>{chosen.outcome}</Text>
            <View style={{ flexDirection: "row", gap: 6, marginTop: 8 }}><Delta label="Boss" n={chosen.boss} /><Delta label="Team" n={chosen.team} /><Delta label="Fans" n={chosen.fans} /></View>
          </Card>
          <Btn label="Continue" onPress={() => go(flow.answerPress(chosen))} />
        </>
      )}
    </Frame>
  );
}

// ── A dilemma ──
const EFFECT_LABEL: Record<string, string> = {
  money: "★", happiness: "Happy", matchFitness: "Sharpness", boss: "Boss", team: "Team", fans: "Fans", sponsors: "Sponsors", fame: "Fame", reputation: "Rep",
  pace: "Pace", power: "Power", technique: "Tech", vision: "Vision", freeKick: "FK", aerial: "Aerial",
};
function Effects({ e }: { e: DilemmaEffect }) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 3 }}>
      {Object.entries(e).filter(([, v]) => typeof v === "number" && v !== 0).map(([k, v]) => (
        <Text key={k} style={{ color: (v as number) > 0 ? "#34d399" : "#f87171", fontSize: 11, fontWeight: "800" }}>{EFFECT_LABEL[k] ?? k} {(v as number) > 0 ? "+" : ""}{v as number}</Text>
      ))}
    </View>
  );
}
export function DilemmaScreen({ dilemma, go }: { dilemma: Dilemma; go: (s: flow.Step) => void }) {
  const [chosen, setChosen] = useState<number | null>(null);
  const pick = (i: number) => { setChosen(i); setTimeout(() => go(flow.chooseDilemma(dilemma, dilemma.choices[i].effects)), 1200); };
  const c = chosen !== null ? dilemma.choices[chosen] : null;
  return (
    <Frame kicker={dilemma.category} title={dilemma.title}>
      <Card><Text style={{ color: C.text, fontSize: 15, textAlign: "center" }}>{dilemma.text}</Text></Card>
      {!c && dilemma.choices.map((ch, i) => (
        <Press key={i} onPress={() => pick(i)}>
          <Card><Text style={{ color: C.text, fontWeight: "900" }}>{ch.label}</Text><Effects e={ch.effects} /></Card>
        </Press>
      ))}
      {c && (
        <Card tone={C.green} style={{ alignItems: "center" }}>
          <Label color={C.green}>Choice made</Label>
          <Text style={{ color: C.text, fontWeight: "900" }}>{c.label}</Text>
          {c.narrative ? <Text style={{ color: "#d1fae5", fontStyle: "italic", marginTop: 6 }}>{c.narrative}</Text> : null}
        </Card>
      )}
    </Frame>
  );
}

// ── "Your season": a still slideshow of every goal ──
export function SeasonReelScreen({ career, go }: { career: CareerState; go: (s: flow.Step) => void }) {
  const goals = seasonGoals(career);
  const [i, setI] = useState(0);
  const done = () => go(flow.reelDone());
  if (goals.length === 0) {
    return <Frame kicker={`Season ${career.season}`} title="Your season" footer={<Btn kind="gold" label="On to the Golden Ball →" onPress={done} />}>
      <Card><Text style={{ color: C.dim, textAlign: "center" }}>No goals to show this season.</Text></Card>
    </Frame>;
  }
  const g = goals[Math.min(i, goals.length - 1)];
  const last = i >= goals.length - 1;
  return (
    <Frame kicker={`Season ${career.season} · goal ${i + 1} of ${goals.length}`} title="Your season"
      footer={<View style={{ flexDirection: "row", gap: 10 }}>
        <View style={{ flex: 1 }}><Btn kind="plain" label="Skip" onPress={done} /></View>
        <View style={{ flex: 1.5 }}><Btn kind="gold" label={last ? "On to the Golden Ball →" : "Next goal →"} onPress={() => (last ? done() : setI(i + 1))} /></View>
      </View>}>
      <Press onPress={() => setI((n) => Math.max(0, n - 1))}>
        <Card tone={C.gold} style={{ alignItems: "center", paddingVertical: 28 }}>
          <Text style={{ color: C.gold, fontSize: 64, fontWeight: "900" }}>{g.minute}'</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 6 }}>
            <ClubCrest club={g.club} size={34} />
            <Text style={{ color: C.text, fontSize: 18, fontWeight: "900" }}>{g.home ? "v" : "@"} {shortClub(g.opponent)}</Text>
            <ClubCrest club={g.opponent} size={34} />
          </View>
          <Text style={{ color: C.text, marginTop: 10, fontWeight: "800" }}>{g.competition} · {g.score}</Text>
          {g.how ? <Text style={{ color: C.dim, marginTop: 4 }}>{g.how}{g.distance ? ` · ${Math.round(g.distance)}m` : ""}{g.finish ? ` · ${g.finish}` : ""}</Text> : null}
          {g.assist ? <Text style={{ color: C.dim, marginTop: 2 }}>Assist: {g.assist}</Text> : null}
        </Card>
      </Press>
      <Fill value={((i + 1) / goals.length) * 100} color={C.gold} height={6} />
    </Frame>
  );
}

// ── Pop-ups over any screen ──
export function Pops() {
  const pops = flow.usePops();
  const p = pops[0];
  useEffect(() => {
    if (!p || p.kind === "milestone") return;
    const t = setTimeout(flow.dismissPop, p.kind === "rating" ? 3000 : 3200 + (p.kind === "achievements" ? p.items.length * 900 : 0));
    return () => clearTimeout(t);
  }, [p]);
  if (!p) return null;
  if (p.kind === "milestone") {
    return (
      <Modal transparent animationType="fade" onRequestClose={flow.dismissPop}>
        <Press onPress={flow.dismissPop} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.9)", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <Text style={{ color: C.gold, fontSize: 11, fontWeight: "900", letterSpacing: 3 }}>STAR RATING</Text>
          <Text style={{ color: C.text, fontSize: 72, fontWeight: "900", fontStyle: "italic", textShadowColor: "rgba(251,191,36,.7)", textShadowRadius: 24 }}>★ {p.level}</Text>
          <Text style={{ color: C.gold, fontSize: 15, fontWeight: "900", marginTop: 6 }}>{starTitle(p.level)}</Text>
          <View style={{ marginTop: 24, backgroundColor: C.gold, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 9 }}><Text style={{ color: "#111", fontWeight: "900" }}>Continue</Text></View>
        </Press>
      </Modal>
    );
  }
  return (
    <View pointerEvents="box-none" style={{ position: "absolute", left: 12, right: 12, top: 0 }}>
      <TopSpace min={54} pad={16} />
      <Press onPress={flow.dismissPop}>
        {p.kind === "rating" ? (
          <View style={{ backgroundColor: "#10b981", borderRadius: 12, padding: 10, borderWidth: 1, borderColor: "#6ee7b7" }}>
            <Text style={{ color: "#000", fontWeight: "900", textAlign: "center" }}>▲ Star rating up: ★{p.from} → ★{p.to}</Text>
          </View>
        ) : (
          <View style={{ backgroundColor: "#1c1917", borderRadius: 14, padding: 12, borderWidth: 1.5, borderColor: C.gold, gap: 6 }}>
            {p.items.map((a) => (
              <View key={a.label}>
                <Text style={{ color: C.gold, fontWeight: "900" }}>🏅 {a.label}</Text>
                <Text style={{ color: C.text, fontSize: 12 }}>{a.description}</Text>
              </View>
            ))}
            {p.star && (
              <View style={{ marginTop: 4 }}>
                <Text style={{ color: C.dim, fontSize: 10, fontWeight: "900" }}>★ STAR RATING {Math.floor(p.star.from)} → {Math.floor(p.star.to)}</Text>
                <Fill value={p.star.toNext * 100} color={C.gold} height={6} />
              </View>
            )}
          </View>
        )}
      </Press>
    </View>
  );
}
/** Any screen with the pop-ups over it. */
export function WithPops({ children }: { children: ReactNode }) {
  return <View style={{ flex: 1 }}>{children}<Pops /></View>;
}

// ── The "?" help ──
const HELP_TITLE: Record<HelpScreen, string> = {
  home: "Home", stats: "Stats", shop: "Shop", training: "Training", relations: "Relationships", league: "League", style: "Style",
  settings: "Settings", achievements: "Achievements", phone: "Phone", sponsors: "Sponsors", cans: "Cans", boots: "Boots",
};
export function HelpScreen({ screen, onBack }: { screen?: HelpScreen; onBack: () => void }) {
  const [open, setOpen] = useState<HelpScreen | null>(screen ?? null);
  if (open) {
    return (
      <Frame kicker="How it works" title={HELP_TITLE[open]} onBack={screen ? onBack : () => setOpen(null)}>
        {HELP_TOURS[open].map((s, i) => (
          <Card key={i}><View style={{ flexDirection: "row", gap: 10 }}><Text style={{ color: C.gold, fontWeight: "900", fontSize: 16 }}>{i + 1}</Text><Text style={{ color: C.text, fontSize: 15, flex: 1 }}>{s.text}</Text></View></Card>
        ))}
      </Frame>
    );
  }
  return (
    <Frame kicker="How it works" title="Help" onBack={onBack}>
      {(Object.keys(HELP_TOURS) as HelpScreen[]).map((k) => (
        <Press key={k} onPress={() => setOpen(k)}><Card><Text style={{ color: C.text, fontWeight: "900", fontSize: 16 }}>? {HELP_TITLE[k]}</Text></Card></Press>
      ))}
    </Frame>
  );
}
