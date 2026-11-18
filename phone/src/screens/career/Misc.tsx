/**
 * The career's other screens:
 *  - PreMatch: the match-day choice (LineupIntro's buttons): Play, Sim this
 *    match, or, left out / injured / your nation on TV, Watch from the stands.
 *  - CallUp: the national manager names his squad (CallUpScreen).
 *  - ContractRenewal: higher-or-lower against the club's negotiator, the
 *    website's own rules (SecondaryScreens.tsx ContractRenewal).
 *  - Watched: your nation's match, watched on TV.
 *  - Settings: only real preferences.
 *  - Placeholder: a screen still to come, saying so.
 */
import { PHOTO_FACES } from "@/lib/star/faceStyle";
import { ownedPenaltyRunups, ownedFreeKickRunups, careerPenaltyRunup, careerFreeKickRunup } from "@/lib/star/runupStyles";
import { SKIN_TONES, HAIR_COLOURS, resolveSkinTone } from "@/lib/star/playerIdentity";
import { TOON_BODIES, TOON_BODY_LABEL, TOON_PLAYER_HEADS, TOON_HEAD_LABEL, yourToonBody, yourToonHead } from "@/lib/star/style3d/toon/bodies";
import { useCareer, setCareer } from "../../game/store";
import { Press } from "../../ui/Press";
import { useEffect, useRef, useState } from "react";
import { View, Text, Switch, Platform, BackHandler } from "react-native";
import { listSlots, loadSlot, newInSlot, deleteSlot, activeSlot } from "../../world/slots";
import type { CareerState, Fixture } from "@/lib/star/types";
import { nextFixtureFor, fixtureLabel } from "@/lib/star/competitions";
import { projectedEnergy } from "@/lib/star/week";
import { shortClub } from "@/lib/star/media/grammar";
import { willingToRenegotiate } from "@/lib/star/careerFlow";
import { renewalWage, renewalMultiplier, RENEWAL_RAISE_PER_WIN } from "@/lib/star/economy";
import { offerClauses } from "@/lib/star/contracts";
import { mulberry32 } from "@/lib/star/season";
import type { IntlDecision } from "@/lib/star/intl/career";
import * as flow from "../../game/flow";
import { useSession } from "../../game/session";
import { usePrefs, setPref, type Prefs } from "../../game/prefs";
import { Frame, Card, Label, Row, Btn, ClubCrest, Fill, StandInNote, money, C } from "./kit";

// ── Match day ──
export function PreMatchScreen({ career, go, onBack }: { career: CareerState; go: (s: flow.Step, push?: boolean) => void; onBack: () => void }) {
  // page.tsx: a youth-team player's match day is his youth week; a loan's
  // target is shown once a week on the way to the match (LoanBrief).
  const redirect = career.placement?.kind === "youth" ? "career-youth" : flow.loanBriefDue(career) ? "career-loan-brief" : null;
  useEffect(() => { if (redirect) go({ screen: redirect }); }, [redirect]); // eslint-disable-line react-hooks/exhaustive-deps
  if (redirect) return null;
  const f = nextFixtureFor(career);
  if (!f) return <Frame title="No match" onBack={onBack}><Btn label="Home" onPress={onBack} /></Frame>;
  const sel = flow.preMatchSelection(career);
  const status = sel.status;
  const watching = !!f.watch || status === "Squad" || status === "Injured";
  const mine = flow.myTeam(career, f);
  const energy = projectedEnergy(career);
  return (
    <Frame kicker={f.kind && f.kind !== "league" ? fixtureLabel(f) : "Match day"} title={`${f.home ? "v" : "@"} ${shortClub(f.opponent)}`} onBack={onBack}
      footer={watching
        ? <Btn kind="plain" label={f.watch ? "📺 Watch on TV" : "🏟️ Watch from the stands"} onPress={() => { const r = flow.watchFromStands(); go(r.step, false); }} />
        : <View style={{ gap: 10 }}>
            <Btn label="▶ Play" onPress={() => { flow.readyWeek(); go({ screen: "match" }); }} />
            <Btn kind="plain" label="⏩ Sim this match" onPress={() => go(flow.simMatch())} />
          </View>}>
      <Card style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-around" }}>
        <View style={{ alignItems: "center" }}><ClubCrest club={f.home ? mine : f.opponent} size={56} /><Text style={{ color: C.text, fontWeight: "900", marginTop: 6 }}>{shortClub(f.home ? mine : f.opponent)}</Text></View>
        <Text style={{ color: C.text, fontSize: 22, fontWeight: "900" }}>v</Text>
        <View style={{ alignItems: "center" }}><ClubCrest club={f.home ? f.opponent : mine} size={56} /><Text style={{ color: C.text, fontWeight: "900", marginTop: 6 }}>{shortClub(f.home ? f.opponent : mine)}</Text></View>
      </Card>
      <Card>
        <Label>{status === "Injured" ? "You're injured" : sel.away ? "Away with your country" : status === "Squad" ? "Not in the squad" : status}</Label>
        <Text style={{ color: C.text }}>{sel.reason}</Text>
        {!watching && sel.onAt > 0 && sel.onAt < 90 && <Text style={{ color: C.dim, marginTop: 6 }}>On from the bench.</Text>}
        <View style={{ marginTop: 12 }}>
          <Text style={{ color: C.dim, fontSize: 11, fontWeight: "800", letterSpacing: 1, marginBottom: 4 }}>⚡ ENERGY AT KICK-OFF {Math.round(energy)}</Text>
          <Fill value={energy} color={energy >= 50 ? C.green : energy >= 25 ? C.gold : C.red} />
        </View>
      </Card>
    </Frame>
  );
}

export function WatchedScreen({ career, go }: { career: CareerState; go: (s: flow.Step) => void }) {
  const f: Fixture | undefined = [...career.fixtures].reverse().find((x) => x.kind === "international" && x.played && x.watch);
  return (
    <Frame kicker="On TV" title={f ? `${career.player.nationality} v ${f.opponent}` : "Full time"} footer={<Btn label="Continue" onPress={() => go(flow.HOME)} />}>
      {f && <Card><Text style={{ color: C.text, fontSize: 40, fontWeight: "900", textAlign: "center" }}>{f.homeScore}–{f.awayScore}</Text></Card>}
    </Frame>
  );
}

// ── The international call-up ──
export function CallUpScreen({ go }: { go: (s: flow.Step) => void }) {
  const [d] = useState<IntlDecision | null>(() => flow.callUpDecision());
  if (!d) return <Frame title="International break"><Btn label="Back to the club" onPress={() => go(flow.HOME)} /></Frame>;
  const tournament = d.period.kind === "tournament";
  return (
    <Frame kicker={tournament ? d.period.label : `International break · ${d.period.label}`} title={d.called ? "Called up" : "Not selected"}
      footer={<Btn label={d.called ? "Report for duty →" : "Back to the club →"} onPress={() => go(flow.answerCallUp(d))} />}>
      <Card tone={d.called ? C.green : C.red}>
        <Text style={{ color: C.text, fontSize: 17, fontWeight: "900" }}>
          {d.called ? `You're in the ${d.nation} squad${tournament ? ` for the ${d.period.comp}` : ""}${d.starter ? " — as a starter" : ""}.` : `Left out of the ${d.nation} squad.`}
        </Text>
        <Text style={{ color: C.dim, marginTop: 6 }}>{d.reason}</Text>
        {d.line ? <Text style={{ color: C.text, marginTop: 8, fontStyle: "italic" }}>{d.line}</Text> : null}
        <View style={{ marginTop: 10 }}>
          <Text style={{ color: C.dim, fontSize: 11, fontWeight: "800", marginBottom: 4 }}>THE MANAGER'S VIEW {Math.round(d.manager)} / 100</Text>
          <Fill value={d.manager} color={C.gold} />
        </View>
      </Card>
      <Card>
        <Label>{tournament ? "Group games" : `${d.nation}'s matches`}</Label>
        {d.period.matches.slice(0, tournament ? 3 : 6).map((m, i) => <Row key={i} k={`${m.home} v ${m.away}`} v={new Date(m.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} />)}
        <Text style={{ color: C.dim, marginTop: 6 }}>{!d.called ? "Played without you." : tournament ? `You stay with the squad until ${d.nation} are knocked out.` : "Any club games in between are played without you."}</Text>
      </Card>
    </Frame>
  );
}

// ── Contract renewal: higher or lower ──
export function ContractRenewalScreen({ career, go }: { career: CareerState; go: (s: flow.Step) => void }) {
  const { contractReason } = useSession();
  const offerReason = contractReason ?? undefined;
  const [phase, setPhase] = useState<"intro" | "playing">("intro");
  const [current, setCurrent] = useState(7);
  const [next, setNext] = useState<number | null>(null);
  const [rounds, setRounds] = useState(0);
  const [wins, setWins] = useState(0);
  const [locked, setLocked] = useState(false);
  const [message, setMessage] = useState("");
  const signed = useRef(false);
  const willing = !!offerReason || willingToRenegotiate(career);
  const c = career.contract;
  const drawDifferent = (from: number) => { let n = 1 + Math.floor(Math.random() * 13); while (n === from) n = 1 + Math.floor(Math.random() * 13); return n; };
  const guess = (higher: boolean) => {
    if (locked || next !== null) return;
    const n = drawDifferent(current);
    setNext(n);
    setRounds((r) => r + 1);
    const correct = higher ? n > current : n < current;
    setTimeout(() => {
      if (correct) { setWins((w) => w + 1); setMessage("✓ Correct! Your offer just improved — take it, or push again."); }
      else { setLocked(true); setMessage("✗ Wrong — talks sour and the offer drops. This is now their final position."); }
      setCurrent(n);
      setNext(null);
    }, 900);
  };
  const offeredWage = renewalWage(c.wage, wins, locked);
  const factor = c.wage > 0 ? offeredWage / c.wage : renewalMultiplier(wins, locked);
  const offer = (base: number) => Math.round(base * factor);
  const finalise = () => {
    if (signed.current) return;
    signed.current = true;
    go(flow.contractComplete({
      club: c.club, wage: offeredWage, goalBonus: offer(c.goalBonus), assistBonus: offer(c.assistBonus), seasonsRemaining: 3,
      ...offerClauses(career, offeredWage, mulberry32(career.season * 71 + wins * 13 + rounds)),
    }));
  };
  const back = () => go(flow.contractComplete(null));
  const face = (v: number | null) => (v === null ? "?" : v === 1 ? "A" : v === 11 ? "J" : v === 12 ? "Q" : v === 13 ? "K" : String(v));

  return (
    <Frame kicker="Contract renewal" title={c.club}>
      {phase === "intro" && !willing && (
        <Card>
          <Text style={{ color: C.text, fontWeight: "900", fontSize: 16 }}>📝 Not interested in renegotiating right now.</Text>
          <Text style={{ color: C.dim, marginTop: 6, marginBottom: 14 }}>You haven't done enough lately to earn a better deal — a real hot streak of form, or a genuine jump in your game, and they'll be a lot more willing to talk.</Text>
          <Btn label="Back" onPress={back} />
        </Card>
      )}
      {phase === "intro" && willing && (
        <Card>
          {offerReason === "form" && <Text style={{ color: C.green, marginBottom: 10 }}>📈 Outstanding form! Your performances have been exceptional — {c.club} want to lock you in with an improved deal early.</Text>}
          {offerReason === "star" && <Text style={{ color: C.gold, marginBottom: 10 }}>⭐ You've improved! The club recognise how much you have improved and are offering improved terms to reflect your standing.</Text>}
          <Text style={{ color: C.text, marginBottom: 10 }}>Your agent will play higher-or-lower against the club negotiator. Every correct guess raises your offer by {Math.round(RENEWAL_RAISE_PER_WIN * 100)}% — take it whenever you like, or keep pushing. Get one wrong and talks sour: the offer drops, and that final number is the only one left on the table.</Text>
          <Row k="Current wage" v={`${money(c.wage)}/week`} />
          <Row k="Goal bonus" v={money(c.goalBonus)} />
          <Row k="Assist bonus" v={money(c.assistBonus)} />
          <Row k="Seasons remaining" v={String(c.seasonsRemaining)} />
          <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
            <View style={{ flex: 1 }}><Btn kind="plain" small label={offerReason ? "Decline offer" : "Not now"} onPress={back} /></View>
            <View style={{ flex: 1 }}><Btn small label="Start negotiation" onPress={() => { setPhase("playing"); setCurrent(3 + Math.floor(Math.random() * 8)); }} /></View>
          </View>
        </Card>
      )}
      {phase === "playing" && (
        <>
          <Text style={{ color: C.dim, textAlign: "center" }}>Round {rounds + 1} · <Text style={{ color: C.green }}>{wins} correct</Text></Text>
          <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 16 }}>
            <PlayingCard v={face(current)} /><Text style={{ color: C.dim, fontSize: 24 }}>→</Text><PlayingCard v={face(next)} dark={next === null} />
          </View>
          {message ? <Text style={{ color: message.startsWith("✓") ? C.green : C.red, fontWeight: "900", textAlign: "center" }}>{message}</Text> : null}
          <Card tone={locked ? C.red : C.green}>
            <Label color={locked ? C.red : C.green}>{locked ? "Final offer" : "Current offer"}</Label>
            <Row k="Wage" v={`${money(offeredWage)}/week`} />
            <Row k="Goal bonus" v={money(offer(c.goalBonus))} />
            <Row k="Assist bonus" v={money(offer(c.assistBonus))} />
          </Card>
          {!locked ? (
            <>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flex: 1 }}><Btn kind="danger" label="▼ Lower" disabled={next !== null} onPress={() => guess(false)} /></View>
                <View style={{ flex: 1 }}><Btn label="▲ Higher" disabled={next !== null} onPress={() => guess(true)} /></View>
              </View>
              <Btn kind="plain" label="Accept this offer →" disabled={next !== null} onPress={finalise} />
            </>
          ) : <Btn label="Sign Contract →" onPress={finalise} />}
        </>
      )}
    </Frame>
  );
}
function PlayingCard({ v, dark }: { v: string; dark?: boolean }) {
  return (
    <View style={{ width: 80, height: 112, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: dark ? "#475569" : "#f1f5f9" }}>
      <Text style={{ fontSize: 38, fontWeight: "900", color: dark ? "rgba(255,255,255,0.75)" : "#000" }}>{v}</Text>
    </View>
  );
}

// ── Settings ──
const PREF_ROWS: [keyof Prefs, string, string][] = [
  ["sound", "Sound", "Sound effects in the match and on screens"],
  ["gameMusic", "Game music", "The game's own music (off by default)"],
  ["skipLineup", "Skip the line-up", "Straight to kick-off, no team sheets"],
  ["playerNames", "Player names", "Names over the players in the match"],
];
export function SettingsScreen({ onBack, onMainMenu, onNewCareer, onOpenSave, onHelp, onFaceEditor, onFakeFaceEditor }: {
  /** onNewCareer: open the new-career screen (the save it goes in is already chosen and empty).
   *  onOpenSave: open the career just switched to, where it was left. */
  onBack: () => void; onMainMenu: () => void; onNewCareer: () => void; onOpenSave?: () => void; onHelp?: () => void;
  /** The website's "Face editors" card: shown only while photo faces are on (PHOTO_FACES). */
  onFaceEditor?: () => void; onFakeFaceEditor?: () => void;
}) {
  const prefs = usePrefs();
  const [leaving, setLeaving] = useState(false);
  const career = useCareer();
  return (
    <Frame title="Settings" onBack={onBack}>
      {career && <YourLook career={career} />}
      {career && <Runups career={career} />}
      <Card>
        {PREF_ROWS.map(([k, label, line]) => (
          <View key={k} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 8 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.text, fontWeight: "800", fontSize: 16 }}>{label}</Text>
              <Text style={{ color: C.dim, fontSize: 12 }}>{line}</Text>
            </View>
            <Switch value={prefs[k]} onValueChange={(v) => setPref(k, v)} trackColor={{ true: C.green, false: "#374151" }} />
          </View>
        ))}
      </Card>
      {PHOTO_FACES && onFaceEditor && onFakeFaceEditor && (
        <Card>
          <Text style={{ color: C.text, fontWeight: "900", marginBottom: 8 }}>Face editors</Text>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}><Btn small label="Real Photos →" onPress={onFaceEditor} /></View>
            <View style={{ flex: 1 }}><Btn small kind="plain" label="Fake Faces →" onPress={onFakeFaceEditor} /></View>
          </View>
        </Card>
      )}
      {onHelp && <Btn kind="plain" label="? How it works" onPress={onHelp} />}
      <Btn kind="plain" label="⌂ Main menu" onPress={onMainMenu} />
      <SavesCard onStartNew={(slot) => { newInSlot(slot); onNewCareer(); }}
        onSwitch={(slot) => { if (loadSlot(slot)) (onOpenSave ?? onMainMenu)(); }}
        onDeleted={(wasActive) => { if (wasActive) onNewCareer(); }} />
      {/* The website's "Exit career — back to Knowitball" (asks first, in the app). On the phone,
          Knowitball is outside the app: Android closes the app; iPhone, which never lets an app
          close itself, goes back to the title. */}
      {!leaving ? (
        <View style={{ paddingTop: 4 }}>
          <Btn kind="danger" label="Exit career — back to Knowitball" onPress={() => setLeaving(true)} />
          <Text style={{ color: C.text, fontSize: 10, fontWeight: "600", textAlign: "center", marginTop: 6 }}>Your career stays saved. You come back to exactly this.</Text>
        </View>
      ) : (
        <Card tone={C.red}>
          <Text style={{ color: C.text, fontWeight: "800", marginBottom: 10 }}>Leave the career? It stays saved. You come back to exactly this.</Text>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}><Btn small kind="plain" label="Cancel" onPress={() => setLeaving(false)} /></View>
            <View style={{ flex: 1 }}><Btn small kind="danger" label="Leave" onPress={() => { setLeaving(false); if (Platform.OS === "android") BackHandler.exitApp(); else onMainMenu(); }} /></View>
          </View>
        </Card>
      )}
    </Frame>
  );
}

/**
 * SAVES (components/star/SaveSlotsPanel.tsx): every save, empty or not; the
 * one being played lit; Switch, Start career in an empty one, Delete (tap
 * twice; on the one being played it reads "Delete & start over").
 */
function SavesCard({ onStartNew, onSwitch, onDeleted }: { onStartNew: (slot: number) => void; onSwitch: (slot: number) => void; onDeleted: (wasActive: boolean) => void }) {
  const [armed, setArmed] = useState<number | null>(null);
  const [, bump] = useState(0);
  const saves = listSlots();
  const active = activeSlot();
  return (
    <Card>
      <Label>Saves</Label>
      <Text style={{ color: C.dim, fontSize: 12, marginBottom: 8 }}>Keep up to {saves.length} careers going and switch between them, or start a brand new one without losing the others.</Text>
      <View style={{ gap: 6 }}>
        {saves.map((sv) => {
          const isActive = sv.slot === active;
          return (
            <View key={sv.slot} style={{ flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 12, padding: 8, backgroundColor: isActive ? "rgba(16,185,129,0.18)" : "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: isActive ? "rgba(16,185,129,0.7)" : "rgba(255,255,255,0.06)" }}>
              <View style={{ width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: isActive ? C.green : "rgba(3,7,18,0.6)" }}>
                <Text style={{ color: isActive ? "#05261a" : "rgba(255,255,255,0.6)", fontWeight: "900", fontSize: 14 }}>{sv.slot}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.text, fontSize: 10, fontWeight: "900", letterSpacing: 1.5 }}>
                  SAVE {sv.slot}{isActive ? <Text style={{ color: "#a7f3d0" }}>  · PLAYING</Text> : null}{sv.retired ? <Text style={{ color: "#fde68a" }}>  · RETIRED</Text> : null}
                </Text>
                {sv.empty ? <Text style={{ color: C.text, fontSize: 11 }}>Empty</Text> : (
                  <>
                    <Text numberOfLines={1} style={{ color: C.text, fontSize: 12, fontWeight: "900" }}>{sv.playerName}</Text>
                    <Text style={{ color: C.text, fontSize: 10.5, fontWeight: "700" }}>
                      {sv.signed ? `${sv.club} · Season ${sv.season} · ` : "No club yet · "}<Text style={{ color: "#fef08a" }}>★{sv.stars}</Text>
                    </Text>
                  </>
                )}
              </View>
              <View style={{ gap: 4 }}>
                {sv.empty ? <Btn small label="Start career" onPress={() => onStartNew(sv.slot)} /> : (
                  <>
                    {!isActive && <Btn small kind="plain" label="Switch" onPress={() => onSwitch(sv.slot)} />}
                    <Btn small kind="danger" label={armed === sv.slot ? "Sure? Tap again" : isActive ? "Delete & start over" : "Delete"}
                      onPress={() => {
                        if (armed !== sv.slot) { setArmed(sv.slot); return; }
                        setArmed(null);
                        deleteSlot(sv.slot);
                        bump((n) => n + 1);
                        onDeleted(isActive);
                      }} />
                  </>
                )}
              </View>
            </View>
          );
        })}
      </View>
    </Card>
  );
}

/** A row of pick-one chips (the website's Settings pickers). */
function Pick<T extends string>({ items, value, onPick }: { items: { id: T; label: string; dot?: string }[]; value: T; onPick: (id: T) => void }) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4, marginBottom: 8 }}>
      {items.map((it) => (
        <Press key={it.id} onPress={() => onPick(it.id)} style={{ flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, backgroundColor: it.id === value ? C.green : C.panel2 }}>
          {it.dot ? <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: it.dot, borderWidth: 1, borderColor: "rgba(255,255,255,0.4)" }} /> : null}
          <Text style={{ color: it.id === value ? "#05261a" : C.text, fontWeight: "900", fontSize: 12 }}>{it.id === value ? "✓ " : ""}{it.label}</Text>
        </Press>
      ))}
    </View>
  );
}
const small = { color: C.dim, fontSize: 11, fontWeight: "900" as const, letterSpacing: 1.2 };

/** Settings → Your look (the website's YourLookPanel): head, build, skin, hair colour, saved on the career. */
function YourLook({ career }: { career: CareerState }) {
  const p = career.player;
  const set = (look: Partial<CareerState["player"]>) => setCareer((c) => ({ ...c, player: { ...c.player, ...look } }));
  return (
    <Card>
      <Text style={{ color: C.text, fontWeight: "900", fontSize: 16 }}>Your look</Text>
      <Text style={{ color: C.dim, fontSize: 12, marginBottom: 8 }}>How you look in every 3D scene (Player style: New).</Text>
      <Text style={small}>HEAD</Text>
      <Pick items={TOON_PLAYER_HEADS.map((h) => ({ id: h, label: TOON_HEAD_LABEL[h] }))} value={yourToonHead(p)} onPick={(h) => set({ head3d: h })} />
      <Text style={small}>BUILD</Text>
      <Pick items={TOON_BODIES.map((b) => ({ id: b, label: TOON_BODY_LABEL[b] }))} value={yourToonBody(p)} onPick={(b) => set({ body3d: b })} />
      <Text style={small}>SKIN</Text>
      <Pick items={SKIN_TONES.map((t) => ({ id: t.id, label: t.label, dot: t.hex }))} value={resolveSkinTone(p.skinTone)} onPick={(t) => set({ skinTone: t })} />
      <Text style={small}>HAIR COLOUR</Text>
      <Pick items={HAIR_COLOURS.map((h) => ({ id: h.id, label: h.label, dot: h.hex }))} value={p.hairColour ?? "brown"} onPick={(h) => set({ hairColour: h })} />
      <Text style={{ color: C.dim, fontSize: 11 }}>The haircut comes with the head: the colour changes, the cut stays.</Text>
    </Card>
  );
}

/** Settings → Penalties and free kicks: how you run up (looks only). */
function Runups({ career }: { career: CareerState }) {
  return (
    <Card>
      <Text style={{ color: C.text, fontWeight: "900", fontSize: 16 }}>Penalties and free kicks</Text>
      <Text style={{ color: C.dim, fontSize: 12, marginBottom: 8 }}>How you run up to the ball. Looks only — the kick is the same.</Text>
      <Text style={small}>PENALTY RUN-UP</Text>
      <Pick items={ownedPenaltyRunups(career.ownedAnimations).map((r) => ({ id: r.id, label: r.name }))} value={careerPenaltyRunup(career)} onPick={(id) => setCareer((c) => ({ ...c, penaltyRunup: id }))} />
      <Text style={small}>FREE-KICK RUN-UP</Text>
      <Pick items={ownedFreeKickRunups(career.ownedAnimations).map((r) => ({ id: r.id, label: r.name }))} value={careerFreeKickRunup(career)} onPick={(id) => setCareer((c) => ({ ...c, freeKickRunup: id }))} />
    </Card>
  );
}

// ── A screen still to come ──
const WHAT: Record<string, [string, string]> = {
};
export function PlaceholderScreen({ what, go }: { what: string; go: (s: flow.Step) => void }) {
  const [title, line] = WHAT[what] ?? ["Coming soon", "This screen is still to come on the phone."];
  return (
    <Frame title={title} footer={<Btn label="Home" onPress={() => go(flow.HOME)} />}>
      <StandInNote>{line}</StandInNote>
    </Frame>
  );
}
