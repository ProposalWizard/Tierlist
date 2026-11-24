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
import { partsSwitchedOff, turnPartBackOn, PART_NAMES } from "../../safety";
import { PHOTO_FACES } from "@/lib/star/faceStyle";
import { ownedPenaltyRunups, ownedFreeKickRunups, careerPenaltyRunup, careerFreeKickRunup } from "@/lib/star/runupStyles";
import { SKIN_TONES, HAIR_COLOURS, resolveSkinTone } from "@/lib/star/playerIdentity";
import { TOON_BODIES, TOON_BODY_LABEL, TOON_PLAYER_HEADS, TOON_HEAD_LABEL, yourToonBody, yourToonHead } from "@/lib/star/style3d/toon/bodies";
import { useCareer, setCareer } from "../../game/store";
import { Press } from "../../ui/Press";
import { useEffect, useRef, useState } from "react";
import { View, Text, Image, Platform, BackHandler, type ViewStyle } from "react-native";
import { FONT, LOOK, LookButton } from "../../ui/look";
import { clubGlow, PopIn, Burst, FloatUp, ShakeX } from "./lookBits";
import { listSlots, loadSlot, newInSlot, deleteSlot, activeSlot } from "../../world/slots";
import type { CareerState, Fixture } from "@/lib/star/types";
import { nextFixtureFor, fixtureLabel } from "@/lib/star/competitions";
import { projectedEnergy } from "@/lib/star/week";
import { shortClub } from "@/lib/star/media/grammar";
import { willingToRenegotiate } from "@/lib/star/careerFlow";
import { renewalWage, renewalMultiplier, RENEWAL_RAISE_PER_WIN, RENEWAL_SOURED_CUT } from "@/lib/star/economy";
import { offerClauses } from "@/lib/star/contracts";
import { mulberry32 } from "@/lib/star/season";
import type { IntlDecision } from "@/lib/star/intl/career";
import * as flow from "../../game/flow";
import { useSession } from "../../game/session";
import { usePrefs, setPref, type Prefs } from "../../game/prefs";
import { Frame, Card, Label, Row, Btn, ClubCrest, Fill, StandInNote, money, C } from "./kit";
import { DATA_CREDITS, CREDIT_GROUPS } from "@/lib/star/dataCredits";
import { tint } from "@/lib/star/heroFigure";
import { OfficeMoment } from "./Office3D";

// ── Contract renewal: higher or lower ──
export function ContractRenewalScreen({ career, go }: { career: CareerState; go: (s: flow.Step) => void }) {
  const { contractReason } = useSession();
  const offerReason = contractReason ?? undefined;
  const [heard, setHeard] = useState(false);
  const [officeFailed, setOfficeFailed] = useState(false);
  const [phase, setPhase] = useState<"intro" | "playing">("intro");
  const [current, setCurrent] = useState(7);
  const [next, setNext] = useState<number | null>(null);
  const [rounds, setRounds] = useState(0);
  const [wins, setWins] = useState(0);
  const [locked, setLocked] = useState(false);
  const [message, setMessage] = useState("");
  // The juice (SecondaryScreens.tsx): a right guess bursts and floats the raise, a wrong one shakes the offer.
  const [wonAt, setWonAt] = useState(0);
  const [lostAt, setLostAt] = useState(0);
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
      if (correct) setWonAt((n) => n + 1); else setLostAt((n) => n + 1);
      if (correct) { setWins((w) => w + 1); setMessage("✓ Correct! Your offer just improved — take it, or push again."); }
      else { setLocked(true); setMessage("✗ Wrong — talks sour and the offer drops. This is now their final position."); }
      setCurrent(n);
      setNext(null);
    }, 900);
  };
  const offeredWage = renewalWage(c.wage, wins, locked);
  const factor = c.wage > 0 ? offeredWage / c.wage : renewalMultiplier(wins, locked);
  const offer = (base: number) => Math.round(base * factor);
  const [stamp, setStamp] = useState(false);
  const finalise = () => {
    if (signed.current) return;
    signed.current = true;
    // The website's SIGNED stamp (SecondaryScreens.tsx), seen for a moment before the screen moves on.
    setStamp(true);
    setTimeout(() => go(flow.contractComplete({
      club: c.club, wage: offeredWage, goalBonus: offer(c.goalBonus), assistBonus: offer(c.assistBonus), seasonsRemaining: 3,
      ...offerClauses(career, offeredWage, mulberry32(career.season * 71 + wins * 13 + rounds)),
    })), 900);
  };
  const back = () => go(flow.contractComplete(null));
  // ManagerMoments.tsx ContractInOffice: a club's offer is said in his 3D office first, then the talks as before (a phone that cannot run the 3D goes straight to the talks)
  if (offerReason && !heard && !officeFailed) {
    const line = offerReason === "form"
      ? `Outstanding form! Your performances have been exceptional — ${c.club} want to lock you in with an improved deal early.`
      : "You've improved! The club recognise how much you have improved and are offering improved terms to reflect your standing.";
    return <OfficeMoment career={career} title="Contract talks" text={line} onContinue={() => setHeard(true)} onFail={() => setOfficeFailed(true)} />;
  }
  const face = (v: number | null) => (v === null ? "?" : v === 1 ? "A" : v === 11 ? "J" : v === 12 ? "Q" : v === 13 ? "K" : String(v));

  return (
    <Frame kicker="Contract renewal" title={c.club} scroll={false}>
     <View style={{ flex: 1, justifyContent: "center", padding: 12, gap: 10, width: "100%", maxWidth: 400, alignSelf: "center" }}>
      {stamp && (
        <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, zIndex: 20, alignItems: "center", justifyContent: "center" }}>
          <Burst count={30} spread={1.4} colors={["#34d399", "#fde047", "#ffffff"]} />
          <PopIn>
            <View style={{ borderRadius: 12, borderWidth: 4, borderColor: "#34d399", backgroundColor: "rgba(2,44,34,0.85)", paddingHorizontal: 20, paddingVertical: 8, transform: [{ rotate: "-6deg" }], boxShadow: "0px 0px 40px rgba(52,211,153,0.5)" } as never}>
              <Text style={{ color: "#6ee7b7", fontSize: 30, fontWeight: "900", letterSpacing: 3 }}>SIGNED</Text>
            </View>
          </PopIn>
        </View>
      )}
      {phase === "intro" && !willing && (
        <Card style={{ alignItems: "center" }}>
          <Text style={{ fontSize: 40 }}>📝</Text>
          <Text style={{ color: C.text, fontWeight: "900", fontSize: 16, textAlign: "center", marginTop: 6 }}>Not interested in renegotiating right now.</Text>
          <Text style={{ color: C.dim, marginTop: 6, marginBottom: 14, textAlign: "center" }}>You haven't done enough lately to earn a better deal — a real hot streak of form, or a genuine jump in your game, and they'll be a lot more willing to talk.</Text>
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
            <PlayingCard v={face(current)} /><Text style={{ color: C.dim, fontSize: 24 }}>→</Text>
            <PopIn key={`${rounds}-${next === null ? "q" : next}`}><PlayingCard v={face(next)} dark={next === null} /></PopIn>
          </View>
          {message ? <Text style={{ color: message.startsWith("✓") ? C.green : C.red, fontWeight: "900", textAlign: "center" }}>{message}</Text> : null}
          <ShakeX trigger={lostAt}>
            <Card tone={locked ? C.red : C.green}>
              <Label color={locked ? C.red : C.green}>{locked ? "Final offer" : "Current offer"}</Label>
              <Row k="Wage" v={`${money(offeredWage)}/week`} />
              <Row k="Goal bonus" v={money(offer(c.goalBonus))} />
              <Row k="Assist bonus" v={money(offer(c.assistBonus))} />
            </Card>
            {wonAt > 0 && <View key={`b${wonAt}`} pointerEvents="none" style={{ position: "absolute", left: "75%", top: "50%" }}><Burst colors={["#34d399", "#fde047", "#ffffff"]} count={16} spread={0.7} /></View>}
            <FloatUp trigger={wonAt} text={`+${Math.round(RENEWAL_RAISE_PER_WIN * 100)}%`} color="#34d399" style={{ left: "72%", top: 8 }} />
            <FloatUp trigger={lostAt} text={`−${Math.round(RENEWAL_SOURED_CUT * 100)}%`} color="#f87171" style={{ left: "72%", top: 8 }} />
          </ShakeX>
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
     </View>
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
// QUICK, as the website's (DeviceSettings.tsx): one line each. Full screen, 3D quality and the testers'
// switches (Texture pack, Harry changes, highlights rebuild) are left out: Mikey, "only the rows a player uses".
const PREF_ROWS: [keyof Prefs, string][] = [
  ["sound", "Sound effects"],
  ["gameMusic", "Game music"],
  ["skipLineup", "Skip the line-up"],
  ["show3dSpeed", "Show 3D speed"],
];
/** The website's little head pictures (public/star/people3d/toon-h1…h6.webp). */
const HEAD_PIC: Record<string, number> = {
  h1: require("../../../assets/look/heads/toon-h1.webp"), h2: require("../../../assets/look/heads/toon-h2.webp"), h3: require("../../../assets/look/heads/toon-h3.webp"),
  h4: require("../../../assets/look/heads/toon-h4.webp"), h5: require("../../../assets/look/heads/toon-h5.webp"), h6: require("../../../assets/look/heads/toon-h6.webp"),
};
const CREDIT_SOURCES = new Set(DATA_CREDITS.map((c) => c.source)).size;
export function SettingsScreen({ onBack, onMainMenu, onNewCareer, onOpenSave, onHelp, onFaceEditor, onFakeFaceEditor }: {
  /** onNewCareer: open the new-career screen (the save it goes in is already chosen and empty).
   *  onOpenSave: open the career just switched to, where it was left. */
  onBack: () => void; onMainMenu: () => void; onNewCareer: () => void; onOpenSave?: () => void; onHelp?: () => void;
  /** The website's "Face editors" card: shown only while photo faces are on (PHOTO_FACES). */
  onFaceEditor?: () => void; onFakeFaceEditor?: () => void;
}) {
  const prefs = usePrefs();
  const [leaving, setLeaving] = useState(false);
  // MORE: one group open at a time, as on the website (opening one shuts the other)
  const [group, setGroup] = useState<"match" | "career" | "credits" | null>(null);
  const open = group === "career", credits = group === "credits";
  const setOpen = (f: (o: boolean) => boolean) => setGroup((g) => (f(g === "career") ? "career" : null));
  const setCredits = (f: (o: boolean) => boolean) => setGroup((g) => (f(g === "credits") ? "credits" : null));
  const career = useCareer();
  const glow = career ? clubGlow(career.player.club, career) : "#34d399";
  // The website's Settings (SettingsScreen.tsx): the top bar, Back · the club over SETTINGS · Main menu,
  // QUICK (the switches), then MORE with "Career & saves" folded (your look, run-ups, saves, exit).
  return (
    <Frame title="Settings" top={!!career} bare backdrop="navy">
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Press onPress={onBack} style={{ height: 38, paddingHorizontal: 14, borderRadius: 19, flexDirection: "row", alignItems: "center", gap: 6, backgroundImage: `linear-gradient(180deg, ${LOOK.navy}, ${LOOK.navyDeep})`, boxShadow: "inset 0px 1px 0px rgba(255,255,255,0.14), inset 0px 0px 0px 1px rgba(255,255,255,0.22)" } as ViewStyle}>
          <Text style={{ color: "#fbbf24", fontSize: 11 }}>◀</Text>
          <Text style={{ color: "#fff", fontSize: 14, fontWeight: "900", letterSpacing: 0.6 }}>BACK</Text>
        </Press>
        <View style={{ flex: 1, alignItems: "center" }}>
          <View style={{ alignItems: "center", paddingHorizontal: 12, paddingVertical: 3, borderRadius: 6, backgroundColor: "rgba(3,7,18,0.6)", borderWidth: 1, borderColor: "rgba(255,255,255,0.2)" }}>
            {career ? <Text numberOfLines={1} style={{ color: tint(glow, 0.55), fontSize: 9.5, fontWeight: "900", letterSpacing: 1.8 }}>{career.player.club.toUpperCase()}</Text> : null}
            <Text style={{ color: "#e5e7eb", fontFamily: FONT.display, fontSize: 22, lineHeight: 26, letterSpacing: 0.4 }}>SETTINGS</Text>
          </View>
        </View>
        <LookButton kind="navy" small onPress={onMainMenu} style={{ paddingHorizontal: 10, paddingVertical: 8 }}>
          <Text style={{ color: "#fff", fontSize: 12, fontWeight: "900" }}>⌂ Main menu</Text>
        </LookButton>
      </View>

      <Section>Quick</Section>
      <Card style={{ paddingVertical: 4, paddingHorizontal: 12 }}>
        {PREF_ROWS.map(([k, label], i) => (
          <Press key={k} onPress={() => setPref(k, !prefs[k])} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 11, borderBottomWidth: i < PREF_ROWS.length - 1 ? 1 : 0, borderBottomColor: "rgba(255,255,255,0.1)" }}>
            <Text style={{ flex: 1, color: "#fff", fontWeight: "800", fontSize: 15 }}>{label}</Text>
            <Track on={prefs[k]} />
          </Press>
        ))}
      </Card>

      <Section>More</Section>
      <Card style={{ padding: 0 }}>
        <Press onPress={() => setGroup((g) => (g === "match" ? null : "match"))} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 12 }}>
          <View style={{ width: 4, height: 16, borderRadius: 2, backgroundColor: glow }} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: "#fff", fontWeight: "900", fontSize: 15 }}>Match</Text>
            <Text style={{ color: "rgba(255,255,255,0.65)", fontSize: 11, fontWeight: "600" }}>Player names, match view 3D, match radar</Text>
          </View>
          <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: "900" }}>3 {group === "match" ? "▾" : "▸"}</Text>
        </Press>
        {group === "match" && (
          <>
            {([["playerNames", "Player names"], ["matchView3d", "Match view 3D"], ["matchRadar", "Match radar (testing)"]] as [keyof Prefs, string][]).map(([k, label]) => (
              <Press key={k} onPress={() => setPref(k, !prefs[k])} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 11, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.1)" }}>
                <Text style={{ flex: 1, color: "#fff", fontWeight: "800", fontSize: 15 }}>{label}</Text>
                <Track on={prefs[k]} />
              </Press>
            ))}
          </>
        )}
      </Card>
      <Card style={{ padding: 0 }}>
        <Press onPress={() => setOpen((o) => !o)} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 12 }}>
          <View style={{ width: 4, height: 16, borderRadius: 2, backgroundColor: glow }} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: "#fff", fontWeight: "900", fontSize: 15 }}>Career &amp; saves</Text>
            <Text style={{ color: "rgba(255,255,255,0.65)", fontSize: 11, fontWeight: "600" }}>{PHOTO_FACES ? "Photo, run-ups, face editors, saves, exit" : "Your look, run-ups, saves, exit"}</Text>
          </View>
          <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: "900" }}>{open ? "▾" : "▸"}</Text>
        </Press>
      </Card>
      {open && (
        <View style={{ gap: 10 }}>
          {career && <YourLook career={career} />}
          {career && <Runups career={career} />}
          {PHOTO_FACES && onFaceEditor && onFakeFaceEditor && (
            <Card>
              <Text style={{ color: C.text, fontWeight: "900", marginBottom: 8 }}>Face editors</Text>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flex: 1 }}><Btn small label="Real Photos →" onPress={onFaceEditor} /></View>
                <View style={{ flex: 1 }}><Btn small kind="plain" label="Fake Faces →" onPress={onFakeFaceEditor} /></View>
              </View>
            </Card>
          )}
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
            <Card tone="#ef4444">
              <Text style={{ color: C.text, fontWeight: "800", marginBottom: 10 }}>Leave the career? It stays saved. You come back to exactly this.</Text>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flex: 1 }}><Btn small kind="plain" label="Cancel" onPress={() => setLeaving(false)} /></View>
                <View style={{ flex: 1 }}><Btn small kind="danger" label="Leave" onPress={() => { setLeaving(false); if (Platform.OS === "android") BackHandler.exitApp(); else onMainMenu(); }} /></View>
              </View>
            </Card>
          )}
        </View>
      )}
      <SwitchedOffCard />
      {/* The website's More → Data credits (lib/star/dataCredits.ts): who made the data,
          pictures and sounds the game uses, under the licence each asks for. */}
      <Card style={{ padding: 0 }}>
        <Press onPress={() => setCredits((o) => !o)} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 12 }}>
          <View style={{ width: 4, height: 16, borderRadius: 2, backgroundColor: glow }} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: "#fff", fontWeight: "900", fontSize: 15 }}>Data credits</Text>
            <Text style={{ color: "rgba(255,255,255,0.65)", fontSize: 11, fontWeight: "600" }}>Where the real football data comes from</Text>
          </View>
          <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: "900" }}>{CREDIT_SOURCES} {credits ? "▾" : "▸"}</Text>
        </Press>
        {credits && (
          <View style={{ paddingHorizontal: 12, paddingBottom: 12, gap: 10 }}>
            <Text style={{ color: "#fff", fontSize: 12, lineHeight: 17, fontWeight: "600" }}>The game's real football data, models, voices and fonts are free to use with credit. Thank you to:</Text>
            {CREDIT_GROUPS.map((g) => {
              const list = DATA_CREDITS.filter((c) => c.use === g.use);
              if (!list.length) return null;
              return (
                <View key={g.use} style={{ gap: 4 }}>
                  <Text style={{ color: "#fff", fontSize: 13, fontWeight: "900" }}>{g.title}</Text>
                  {g.note ? <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 10, lineHeight: 14, fontWeight: "600", marginBottom: 2 }}>{g.note}</Text> : null}
                  {list.map((c) => (
                    <View key={c.id} style={{ borderRadius: 8, backgroundColor: "rgba(255,255,255,0.05)", paddingHorizontal: 8, paddingVertical: 6, marginBottom: 2 }}>
                      <Text style={{ color: "#fff", fontSize: 11, lineHeight: 15, fontWeight: "600" }}>{c.line}</Text>
                      {c.note ? <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 10, lineHeight: 14, fontWeight: "500", marginTop: 2 }}>{c.note}</Text> : null}
                    </View>
                  ))}
                </View>
              );
            })}
            <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 10, fontWeight: "600" }}>Also on the web at knowitball.co.uk/credits.</Text>
          </View>
        )}
      </Card>
      {/* No "? How it works" button here: the website's Settings has none (the ? is on each screen). */}
    </Frame>
  );
}

/**
 * Parts the crash guard switched off (src/safety.ts): shown only when there is one.
 * "Turn back on" tries the part again at once.
 */
function SwitchedOffCard() {
  const [, bump] = useState(0);
  const off = partsSwitchedOff();
  if (!off.length) return null;
  return (
    <Card tone="#f59e0b">
      <Text style={{ color: C.text, fontWeight: "900", fontSize: 15 }}>Switched off on this phone</Text>
      <Text style={{ color: C.dim, fontSize: 12, marginBottom: 8 }}>The game closed twice while starting these, so it shows the simple version for now. It tries again by itself after a few launches.</Text>
      {off.map((p) => (
        <View key={p} style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 6 }}>
          <Text numberOfLines={2} style={{ flex: 1, color: C.text, fontSize: 13, fontWeight: "800", textTransform: "capitalize" }}>{PART_NAMES[p]}</Text>
          <View style={{ width: 120 }}><Btn small label="Turn back on" onPress={() => { turnPartBackOn(p); bump((n) => n + 1); }} /></View>
        </View>
      ))}
    </Card>
  );
}

/** A section header above a group of cards: white capitals and a rule fading out (settingsKit SetSection). */
function Section({ children }: { children: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6, marginBottom: -4, paddingHorizontal: 2 }}>
      <Text style={{ color: "#fff", fontSize: 12, fontWeight: "900", letterSpacing: 2.2 }}>{children.toUpperCase()}</Text>
      <View style={{ flex: 1, height: 1, backgroundImage: "linear-gradient(90deg, rgba(255,255,255,0.35), rgba(255,255,255,0))" } as ViewStyle} />
    </View>
  );
}

/** The switch's look: a glossy track that lights green, a white knob (settingsKit Track). Drawn once per change. */
function Track({ on }: { on: boolean }) {
  return (
    <View style={[{ width: 46, height: 26, borderRadius: 13 },
      (on ? { backgroundImage: "linear-gradient(180deg, #4ade80, #10b981 60%, #047857)", boxShadow: "inset 0px 1px 0px rgba(255,255,255,0.4), 0px 0px 14px -2px rgba(16,185,129,0.8)" }
        : { backgroundImage: "linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0.04))", boxShadow: "inset 0px 2px 4px rgba(0,0,0,0.55), inset 0px 0px 0px 1px rgba(255,255,255,0.12)" }) as ViewStyle]}>
      <View style={{ position: "absolute", top: 3, left: on ? 23 : 3, width: 20, height: 20, borderRadius: 10, backgroundImage: "linear-gradient(180deg, #ffffff, #e5e7eb)", boxShadow: "0px 2px 5px rgba(0,0,0,0.45)" } as ViewStyle} />
    </View>
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

/** Settings → Your look (the website's YourLookPanel): picture tiles for the six heads, the three
 *  builds as outlines, skin swatches and hair-colour chips. Saved on the career. */
const BUILD_W: Record<string, number> = { c1: 14, c2: 20, c3: 16 };
const BUILD_H: Record<string, number> = { c1: 40, c2: 40, c3: 46 };
function YourLook({ career }: { career: CareerState }) {
  const p = career.player;
  const set = (look: Partial<CareerState["player"]>) => setCareer((c) => ({ ...c, player: { ...c.player, ...look } }));
  const head = yourToonHead(p), body = yourToonBody(p), skin = resolveSkinTone(p.skinTone), hair = p.hairColour ?? "brown";
  const cap = { color: "rgba(255,255,255,0.7)", fontSize: 10, fontWeight: "900" as const, letterSpacing: 0.8, marginBottom: 4 };
  const tile = (on: boolean): ViewStyle => ({ width: "31.5%", alignItems: "center", borderRadius: 12, borderWidth: 2, padding: 4, borderColor: on ? "#fff" : "rgba(255,255,255,0.15)", backgroundColor: on ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.2)" });
  return (
    <Card>
      <Text style={{ color: C.text, fontWeight: "900", fontSize: 16 }}>Your look</Text>
      <Text style={{ color: C.dim, fontSize: 12, marginBottom: 8 }}>How you look in every 3D scene.</Text>
      <Text style={cap}>HEAD</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        {TOON_PLAYER_HEADS.map((h) => (
          <Press key={h} onPress={() => set({ head3d: h })} style={tile(h === head)}>
            {HEAD_PIC[h] ? <Image source={HEAD_PIC[h]} fadeDuration={0} style={{ width: 64, height: 64, borderRadius: 8 }} /> : <View style={{ width: 64, height: 64 }} />}
            <Text style={{ marginTop: 4, color: "#fff", fontSize: 11, fontWeight: "900" }}>{TOON_HEAD_LABEL[h]}</Text>
          </Press>
        ))}
      </View>
      <Text style={cap}>BUILD</Text>
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
        {TOON_BODIES.map((b) => (
          <Press key={b} onPress={() => set({ body3d: b })} style={[tile(b === body), { padding: 8 }]}>
            <View style={{ width: 40, height: 50, alignItems: "center", justifyContent: "flex-end" }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#fff", marginBottom: 2 }} />
              <View style={{ width: BUILD_W[b], height: BUILD_H[b] - 10, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.85)" }} />
            </View>
            <Text style={{ marginTop: 4, color: "#fff", fontSize: 11, fontWeight: "900" }}>{TOON_BODY_LABEL[b]}</Text>
          </Press>
        ))}
      </View>
      <Text style={cap}>SKIN</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        {SKIN_TONES.map((t) => (
          <Press key={t.id} onPress={() => set({ skinTone: t.id })} style={{ width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: t.id === skin ? "#fff" : "rgba(255,255,255,0.2)", backgroundColor: t.hex }}><View /></Press>
        ))}
      </View>
      <Text style={cap}>HAIR COLOUR</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {HAIR_COLOURS.map((h) => (
          <Press key={h.id} onPress={() => set({ hairColour: h.id })} style={{ flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 999, borderWidth: 2, paddingHorizontal: 8, paddingVertical: 4, borderColor: h.id === hair ? "#fff" : "rgba(255,255,255,0.2)", backgroundColor: h.id === hair ? "rgba(255,255,255,0.15)" : "transparent" }}>
            <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: h.hex }} />
            <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>{h.label}</Text>
          </Press>
        ))}
      </View>
      <Text style={{ marginTop: 4, color: "rgba(255,255,255,0.6)", fontSize: 10, fontWeight: "700" }}>The haircut comes with the head: the colour changes, the cut stays.</Text>
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
