"use client";
import TrainingMinigame from "@/components/star/TrainingMinigame";
import ShopLabPreview from "@/components/star/shop2d/ShopLabPreview";
import ShopConcepts, { type MockId } from "@/components/star/shop2d/ShopConcepts";
import { SHOWROOM_CATS, type CatId } from "@/components/star/shop2d/ShowroomShop";
import ContactBall, { type BallMotion } from "@/components/star/ContactBall";
import type { Skills } from "@/lib/star/types";
import { useCallback, useEffect, useState } from "react";
import TransferHereWeGo01 from "@/components/star/media/templates/TransferHereWeGo01";
import Graphic from "@/components/star/media/Graphics";
import FeedPreview from "@/components/star/media/FeedPreview";
import { TrophiesScreen } from "@/components/star/SecondaryScreens";
import PortraitPicker from "@/components/star/PortraitPicker";
import PotmWinModal from "@/components/star/PotmWinModal";
import VersusScreen from "@/components/star/VersusScreen";
import PositionPicker from "@/components/star/PositionPicker";
import MatchCommentary from "@/components/star/MatchCommentary";
import { line as logLine } from "@/lib/star/matchLog";
import { kitsFor } from "@/lib/star/kits";
import { SAMPLE_MATCHDAY, SAMPLE_CAREER, SAMPLE_FIXTURE } from "@/components/star/media/sampleMatchday";
import { matchdayFor } from "@/lib/star/teamsheet";
import type { Role } from "@/lib/star/formations";
import type { GraphicSpec } from "@/lib/star/media/types";
import PageGuide from "@/components/admin/PageGuide";
import { BroadcastPage, Panel, Btn, Pill, Label, Note } from "@/components/admin/broadcast/BroadcastPage";
import "./media-lab.css";

/**
 * THE MEDIA LAB
 *
 * A dev bench for the graphics library. Drop a pose PNG and a face onto it and
 * every template re-renders live, in every club's colours, so a design can be
 * judged against the real assets rather than against a mock-up.
 *
 * Nothing here is uploaded anywhere — the files are read into a local blob URL
 * and never leave the browser. It also carries the face-anchor tool: click the
 * pose where the head is and drag to size it, and it prints the three numbers
 * the template needs.
 */

const CLUBS = [
  { name: "Arsenal", primary: "#e11d2e", secondary: "#ffffff" },
  { name: "Manchester City", primary: "#6cabdd", secondary: "#1c2c5b" },
  { name: "Newcastle United", primary: "#111111", secondary: "#ffffff" },
  { name: "Aston Villa", primary: "#670e36", secondary: "#95bfe5" },
  { name: "Norwich City", primary: "#fff200", secondary: "#00a650" },
  { name: "Tottenham Hotspur", primary: "#ffffff", secondary: "#132257" },
];

/** The filter pills along the top of the wall (option 2, "Post wall"). */
type Wall = "all" | "transfer" | "potm" | "screens" | "shop" | "training";
const WALLS: { id: Wall; label: string }[] = [
  { id: "all", label: "All" }, { id: "transfer", label: "Transfer graphic" }, { id: "potm", label: "Player of the Month" },
  { id: "screens", label: "Screens" }, { id: "shop", label: "Shop" }, { id: "training", label: "Training" },
];
const WALL_KEY = "media-lab-wall";
const TRAIN_SKILLS: { id: keyof Skills; label: string }[] = [
  { id: "pace", label: "Pace" }, { id: "power", label: "Power" }, { id: "technique", label: "Technique" },
  { id: "vision", label: "Vision" }, { id: "freeKick", label: "Free kick" },
];

export default function MediaLab() {
  // Which part of the wall shows (remembered on this device).
  const [wall, setWall] = useState<Wall>("all");
  const [ctlOpen, setCtlOpen] = useState(false);
  const [trainLevel, setTrainLevel] = useState(1);
  useEffect(() => {
    try { const w = localStorage.getItem(WALL_KEY); if (w && WALLS.some(x => x.id === w)) setWall(w as Wall); } catch { /* no storage */ }
  }, []);
  const pickWall = (w: Wall) => { setWall(w); try { localStorage.setItem(WALL_KEY, w); } catch { /* no storage */ } };
  // `?feed` shows just the feed preview, at phone width, for judging posts.
  const [feedOnly, setFeedOnly] = useState(false);
  // `?trophies` shows the Trophy Cabinet with every pictured trophy, for judging the art.
  const [trophiesOnly, setTrophiesOnly] = useState(false);
  // `?training=vision&level=1` plays one training level with every skill at
  // 40, for judging the level-1 how-it-works card and the vision countdown.
  // `?shop=kib|boots|lifestyle|landing` (+ `&look=old`) shows the shop with a
  // sample National League career and ★1,000,000; buying works on the sample.
  // `?contact=float` (or bounce / bobble / still) shows the strike screen with
  // the ball moving that way, for judging the movement. A tap resets it.
  // `&aerial=30` (header/volley): your Aerial, which sizes the perfect circle (22 Oct 2026).
  const [contactPreview, setContactPreview] = useState<BallMotion | null>(null);
  const [contactAerial, setContactAerial] = useState<number | undefined>(undefined);
  const [contactRun, setContactRun] = useState(0);
  const [shopPreview, setShopPreview] = useState<"kib" | "boots" | "lifestyle" | "landing" | null>(null);
  const [shopLookLab, setShopLookLab] = useState<"new" | "old" | "grid">("new");
  const [shopCat, setShopCat] = useState<CatId | undefined>(undefined);
  const [shopBar, setShopBar] = useState<"A" | "B" | "C">("A");
  const [shopDemoClips, setShopDemoClips] = useState(false);
  const [shopLocks, setShopLocks] = useState(false);
  const [shopMark, setShopMark] = useState<"trophy" | "none">("trophy");
  const [shopBuy, setShopBuy] = useState<"A" | "B" | "auto">("auto");
  // `?shopmock=A|B|C|D` (+ `&at=` a start state): the shop layout concepts (throwaway, 9 Oct 2026).
  const [shopMock, setShopMock] = useState<{ id: MockId; at?: string } | null>(null);
  const [trainingPreview, setTrainingPreview] = useState<{ skill: keyof Skills; level: number; run?: number } | null>(null);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    setFeedOnly(q.has("feed"));
    setTrophiesOnly(q.has("trophies"));
    const cm = q.get("contact");
    if (cm === "still" || cm === "float" || cm === "bounce" || cm === "bobble") setContactPreview(cm);
    const ae = Number(q.get("aerial"));
    if (q.has("aerial") && Number.isFinite(ae)) setContactAerial(ae);
    const sk = q.get("shop");
    if (sk === "kib" || sk === "boots" || sk === "lifestyle" || sk === "landing") setShopPreview(sk);
    if (q.get("look") === "old" || q.get("look") === "grid") setShopLookLab(q.get("look") as "old" | "grid");
    const sb = q.get("bar");
    if (sb === "B" || sb === "C") setShopBar(sb);
    setShopDemoClips(q.has("democlips"));
    setShopLocks(q.has("locks"));
    if (q.get("mark") === "none") setShopMark("none");
    if (q.get("buy") === "A" || q.get("buy") === "B") setShopBuy(q.get("buy") as "A" | "B");
    const scat = q.get("cat");
    if (scat && SHOWROOM_CATS.some((x) => x.id === scat)) setShopCat(scat as CatId);
    const sm = q.get("shopmock");
    if (sm === "A" || sm === "B" || sm === "C" || sm === "D") setShopMock({ id: sm, at: q.get("at") ?? undefined });
    const t = q.get("training") as keyof Skills | null;
    if (t && ["pace", "power", "technique", "vision", "freeKick"].includes(t)) {
      setTrainingPreview({ skill: t, level: Math.max(1, Math.min(30, Number(q.get("level") ?? 1) || 1)) });
    }
  }, []);
  const [pose, setPose] = useState<string | null>(null);
  const [face, setFace] = useState<string | null>(null);
  const [anchor, setAnchor] = useState({ x: 0.5, y: 0.17, size: 0.135 });
  const [neckY, setNeckY] = useState(0.235);
  const [faceLift, setFaceLift] = useState(1);
  const [figureScale, setFigureScale] = useState(1);
  const [figureY, setFigureY] = useState(0);
  const [treatment, setTreatment] = useState(0.85);
  const [club, setClub] = useState(0);
  const [showWin, setShowWin] = useState(false);
  const [showTeams, setShowTeams] = useState(false);
  const [labPlayAs, setLabPlayAs] = useState<Role | null>(null);
  const [showFeed, setShowFeed] = useState(false);
  const [feedSpeed, setFeedSpeed] = useState(1);
  const [labMode, setLabMode] = useState<"low" | "medium" | "high">("medium");
  const [labStyle, setLabStyle] = useState<"defensive" | "balanced" | "attacking">("balanced");

  const read = (file: File, set: (s: string) => void) => {
    const r = new FileReader();
    r.onload = () => set(String(r.result));
    r.readAsDataURL(file);
  };

  const onDrop = useCallback((e: React.DragEvent, set: (s: string) => void) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) read(f, set);
  }, []);

  const c = CLUBS[club];

  if (feedOnly) return <><FeedPreview /><PageGuide page="/star-dev/media-lab" /></>;
  if (contactPreview) {
    return <>
      <div className="relative mx-auto w-full max-w-sm overflow-hidden" style={{ aspectRatio: "5 / 8" }}>
        <ContactBall key={contactRun} power={0.6} motion={contactPreview} technique={40} aerial={contactAerial}
          onContact={() => window.setTimeout(() => setContactRun(r => r + 1), 900)} />
      </div>
      <PageGuide page="/star-dev/media-lab" />
    </>;
  }
  if (shopMock) return <><ShopConcepts id={shopMock.id} initial={shopMock.at} /><PageGuide page="/star-dev/media-lab" /></>;
  if (shopPreview) {
    return <>
      <ShopLabPreview kind={shopPreview} look={shopLookLab} cat={shopCat} bar={shopBar} demoClips={shopDemoClips} locks={shopLocks} mark={shopMark} buy={shopBuy} onBack={() => setShopPreview(null)} />
      <PageGuide page="/star-dev/media-lab" />
    </>;
  }
  if (trainingPreview) {
    return <>
      <TrainingMinigame
        key={`${trainingPreview.skill}-${trainingPreview.level}-${trainingPreview.run ?? 0}`}
        skill={trainingPreview.skill}
        trainingLevel={trainingPreview.level}
        skills={{ pace: 40, power: 40, technique: 40, vision: 40, freeKick: 40, aerial: 40 }}
        onComplete={() => setTrainingPreview({ ...trainingPreview, run: (trainingPreview.run ?? 0) + 1 })}
      />
      <PageGuide page="/star-dev/media-lab" />
    </>;
  }
  if (trophiesOnly) {
    const comps = ["Premier League", "Champions League", "FA Cup", "League Cup", "Europa League", "World Cup",
      "Championship", "League One", "League Two", "National League", "Community Shield"];
    return <>
      <TrophiesScreen
        trophies={comps.map((c, i) => ({ season: i + 1, competition: c, club: "Barnet" }))}
        ballonDors={2}
        awards={[{ kind: "Player of the Season" }, { kind: "Golden Boot" }, { kind: "Golden Boot" }, { kind: "Player of the Month" }]}
        onBack={() => setTrophiesOnly(false)}
      />
      <PageGuide page="/star-dev/media-lab" />
    </>;
  }

  const showGroup = (g: Wall) => wall === "all" || wall === g;
  const railOn = showGroup("transfer");
  const pic = (name: string) => ({ backgroundImage: `url(/admin/media-lab/${name}.webp)` });
  /** A screen tile: a still of the real screen and the button that opens it.
   *  Address modes (?feed, ?shop=…) load the page again, as typing them did. */
  const screen = (key: string, title: string, note: string, img: string | null, btns: React.ReactNode) => (
    <div className="ml-tile" key={key} data-screen={key}>
      <div className="ml-tt"><b>{title}</b>{note && <span>{note}</span>}</div>
      <div className="ml-pic" style={img ? pic(img) : undefined}>
        {!img && <span className="ml-letter">{title.slice(0, 1)}</span>}
        <div className="ml-pic-btns">{btns}</div>
      </div>
    </div>
  );
  const go = (href: string, label: string, main = false) => <a key={href} className="ml-go" data-main={main ? "true" : undefined} href={href}>{label}</a>;

  return (
    <div className="ml">
    <BroadcastPage
      title="Media lab"
      sub="Post wall: every feed graphic and screen on one wall. Nothing is uploaded."
      actions={<span className="ml-head-btn"><Btn main onClick={() => setShowTeams(true)}>👁 Preview team sheets</Btn></span>}
    >
      <div className="ml-filters" role="tablist">
        {WALLS.map(w => (
          <Pill key={w.id} on={wall === w.id} onClick={() => pickWall(w.id)}>{w.label}</Pill>
        ))}
      </div>

      <div className="ml-layout" data-rail={railOn ? "true" : "false"}>
        {railOn && (
          <aside className="ml-rail" data-open={ctlOpen ? "true" : "false"}>
            <button className="ml-ctl-toggle" onClick={() => setCtlOpen(o => !o)} aria-expanded={ctlOpen}>
              <span>Pose, face and sliders</span><span>{ctlOpen ? "▲" : "▼"}</span>
            </button>
            <div className="ml-ctl-body">
              <Panel title="Pictures" note="stays in this tab">
                <Drop label="Pose image" src={pose} onDrop={e => onDrop(e, setPose)}
                  onPick={f => read(f, setPose)} onClear={() => setPose(null)} />
                <Drop label="Face image (optional)" src={face} onDrop={e => onDrop(e, setFace)}
                  onPick={f => read(f, setFace)} onClear={() => setFace(null)} />
              </Panel>
              <Panel title="Club colours">
                <div className="ml-clubs">
                  {CLUBS.map((k, i) => (
                    <button
                      key={k.name}
                      onClick={() => setClub(i)}
                      aria-pressed={i === club}
                      className="ml-club"
                      style={{ background: k.primary, color: k.primary === "#ffffff" || k.primary === "#fff200" ? "#111" : "#fff" }}
                    >
                      {k.name.split(" ")[0]}
                    </button>
                  ))}
                </div>
              </Panel>
              <Panel title="Line up the face">
                <Slider label="Treatment" value={treatment} onChange={setTreatment}
                  hint="0 = raw photo · 1 = full duotone" />
                <Slider label="Face X" value={anchor.x} onChange={x => setAnchor(a => ({ ...a, x }))} />
                <Slider label="Face Y" value={anchor.y} onChange={y => setAnchor(a => ({ ...a, y }))} />
                <Slider label="Face size" value={anchor.size} max={0.4} onChange={size => setAnchor(a => ({ ...a, size }))} />
                <Slider label="Neck line" value={neckY} max={0.6} onChange={setNeckY}
                  hint="everything above this is cut off the pose" />
                <Slider label="Face brightness" value={faceLift} max={2} onChange={setFaceLift}
                  hint="match the face's exposure to the arms" />
                <Slider label="Figure size" value={figureScale} max={2.2} onChange={setFigureScale}
                  hint="fill the frame — crop him around the thigh" />
                <Slider label="Figure up / down" value={figureY} min={-0.4} max={0.4} onChange={setFigureY} />
              </Panel>
              <Panel title="Anchor" note="copy into the template">
                <code className="ml-anchor">
                  {`{ x: ${anchor.x.toFixed(3)}, y: ${anchor.y.toFixed(3)}, size: ${anchor.size.toFixed(3)}, `
                    + `neckY: ${neckY.toFixed(3)}, faceLift: ${faceLift.toFixed(2)}, `
                    + `figureScale: ${figureScale.toFixed(2)}, figureY: ${figureY.toFixed(3)} }`}
                </code>
              </Panel>
            </div>
          </aside>
        )}

        <div className="flex min-w-0 flex-col gap-4">
          {showGroup("transfer") && (
            <section>
              <div className="ml-group"><h2>Transfer graphic</h2><span>“Here we go”, with your pose and face</span></div>
              <div className="ml-wall">
                <div className="ml-tile" data-tile="transfer-main">
                  <div className="ml-tt"><b>Here we go</b><span>{c.name}</span></div>
                  <div className="ml-tb ml-tb-center">
                    <div className="w-full max-w-[340px]">
                      <TransferHereWeGo01
                        playerName="Michael Sancho"
                        fromClub={CLUBS[(club + 3) % CLUBS.length].name}
                        toClub={c.name}
                        fee="£65m"
                        poseSrc={pose ?? undefined}
                        faceSrc={face ?? undefined}
                        faceAnchor={anchor}
                        neckY={neckY}
                        faceLift={faceLift}
                        figureScale={figureScale}
                        figureY={figureY}
                        kitPrimary={c.primary}
                        kitSecondary={c.secondary}
                        treatment={treatment}
                      />
                    </div>
                  </div>
                </div>
                <div className="ml-tile" data-span="2" data-tile="transfer-every-club">
                  <div className="ml-tt"><b>Same template, every club</b></div>
                  <div className="ml-tb">
                    <div className="ml-six">
                      {CLUBS.map(k => (
                        <div key={k.name}>
                          <div className="ml-six-name">{k.name}</div>
                          <TransferHereWeGo01
                            playerName="Michael Sancho"
                            toClub={k.name}
                            fee="£65m"
                            poseSrc={pose ?? undefined}
                            faceSrc={face ?? undefined}
                            faceAnchor={anchor}
                            neckY={neckY}
                            faceLift={faceLift}
                            figureScale={figureScale}
                            figureY={figureY}
                            kitPrimary={k.primary}
                            kitSecondary={k.secondary}
                            treatment={treatment}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}

          {showGroup("potm") && (
            <section>
              <div className="ml-group"><h2>Player of the Month</h2><span>post cards at the width a post draws at</span></div>
              <div className="ml-wall">
                <div className="ml-tile"><div className="ml-tt"><b>The shortlist</b><span>a busy August</span></div><div className="ml-tb"><Graphic spec={SAMPLE_NOMINEES} /></div></div>
                <div className="ml-tile"><div className="ml-tt"><b>Someone else wins</b><span>nine months in ten</span></div><div className="ml-tb"><Graphic spec={SAMPLE_WINNER} /></div></div>
                <div className="ml-tile"><div className="ml-tt"><b>You win</b><span>no photo</span></div><div className="ml-tb"><Graphic spec={SAMPLE_WINNER_YOU} /></div></div>
                <div className="ml-tile"><div className="ml-tt"><b>You win</b><span>with your photo</span></div><div className="ml-tb"><Graphic spec={SAMPLE_WINNER_PHOTO} /></div></div>
                <div className="ml-tile"><div className="ml-tt"><b>Your photo picker</b><span>try only, not saved</span></div><div className="ml-tb"><PortraitPicker value={undefined} onChange={() => {}} club="Liverpool" number={19} /></div></div>
              </div>
            </section>
          )}

          {showGroup("screens") && (
            <section>
              <div className="ml-group"><h2>Screens</h2><span>each opens with sample data</span></div>
              <div className="ml-wall" data-screens="true">
                {screen("won", "“You won it” pop-up", "Player of the Month", "won",
                  <button className="ml-go" data-main="true" onClick={() => setShowWin(true)}>Preview</button>)}
                {screen("sheets", "Team sheets", "with play-as", "sheets",
                  <button className="ml-go" data-main="true" onClick={() => setShowTeams(true)}>Preview</button>)}
                {screen("commentary", "Match commentary", "68th minute", "commentary",
                  <button className="ml-go" data-main="true" onClick={() => setShowFeed(true)}>Preview</button>)}
                {screen("feed", "Feed preview", "seven sample posts", "feed", go("?feed", "Open", true))}
                {screen("trophies", "Trophy cabinet", "every trophy picture", "trophies", go("?trophies", "Open", true))}
                {screen("strike", "Strike screen", "how the ball moves", "strike",
                  <>{(["still", "float", "bounce", "bobble"] as const).map(m => go(`?contact=${m}`, m))}</>)}
              </div>
            </section>
          )}

          {showGroup("shop") && (
            <section>
              <div className="ml-group"><h2>Shop</h2><span>sample National League career, ★1,000,000 · nothing is bought</span></div>
              <div className="ml-wall" data-screens="true">
                {screen("shop-landing", "Shop · first page", "", "shop-landing", <>{go("?shop=landing", "New", true)}{go("?shop=landing&look=old", "Old")}</>)}
                {screen("shop-kib", "Shop · KIB cans", "", "shop-kib", <>{go("?shop=kib", "New", true)}{go("?shop=kib&look=old", "Old")}</>)}
                {screen("shop-boots", "Shop · boots", "", "shop-boots", <>{go("?shop=boots", "New", true)}{go("?shop=boots&look=old", "Old")}</>)}
                {screen("shop-lifestyle", "Shop · lifestyle", "", "shop-lifestyle", <>{go("?shop=lifestyle", "New", true)}{go("?shop=lifestyle&look=old", "Old")}</>)}
                {screen("shopmock-A", "Idea A", "swipe one big item", "shopmock-A", go("?shopmock=A", "Open", true))}
                {screen("shopmock-B", "Idea B", "dense grid", "shopmock-B", go("?shopmock=B", "Open", true))}
                {screen("shopmock-C", "Idea C", "shelves on a wall", "shopmock-C", go("?shopmock=C", "Open", true))}
                {screen("shopmock-D", "Idea D", "one item per screen", "shopmock-D", go("?shopmock=D", "Open", true))}
              </div>
              <Note>More shop options by address: &amp;bar=B or C, &amp;democlips, &amp;locks, &amp;mark=none, &amp;buy=A or B, &amp;cat= (see ⓘ).</Note>
            </section>
          )}

          {showGroup("training") && (
            <section>
              <div className="ml-group">
                <h2>Training</h2><span>every skill at 40 · nothing saved</span>
                <span className="ml-step">
                  <Label>Level</Label>
                  <Pill on={false} onClick={() => setTrainLevel(l => Math.max(1, l - 1))} title="Lower level">◀</Pill>
                  <b>{trainLevel}</b>
                  <Pill on={false} onClick={() => setTrainLevel(l => Math.min(30, l + 1))} title="Higher level">▶</Pill>
                </span>
              </div>
              <div className="ml-wall" data-screens="true">
                {TRAIN_SKILLS.map(s => screen(`train-${s.id}`, s.label, trainLevel === 1 ? "level 1 card" : `level ${trainLevel}`,
                  trainLevel === 1 ? `train-${s.id}` : null, go(`?training=${s.id}&level=${trainLevel}`, "Play", true)))}
              </div>
            </section>
          )}
        </div>
      </div>

      {showFeed && (
        <div className="fixed inset-0 z-[70] bg-gray-950" onClick={() => setShowFeed(false)}>
          <div className="relative mx-auto h-full w-full max-w-md" onClick={e => e.stopPropagation()}>
            <MatchCommentary
              lines={SAMPLE_COMMENTARY}
              minute={68}
              homeTeam="Liverpool"
              awayTeam="Man Utd"
              homeScore={1}
              awayScore={1}
              userKit={kitsFor("Liverpool", "Man Utd").home}
              oppKit={kitsFor("Liverpool", "Man Utd").away}
              stats={{ shots: 3, goals: 1, assists: 0, passesCompleted: 14 }}
              speed={feedSpeed}
              onSpeed={() => setFeedSpeed(sp => (sp === 1 ? 2 : sp === 2 ? 4 : 1))}
              pause={null}
              energy={72}
              energyMode={labMode}
              onEnergyMode={setLabMode}
              playstyle={labStyle}
              onPlaystyle={setLabStyle}
            />
          </div>
        </div>
      )}

      {showTeams && (
        <div className="fixed inset-0 z-[70] overflow-y-auto bg-gray-950">
          {/* The picker itself lives on the dashboard now, not on this screen —
              exercised here as a standalone control so the "play as" path can
              still be judged without leaving the bench. */}
          <div className="mx-auto max-w-md px-3 pt-3">
            <PositionPicker
              club={SAMPLE_CAREER.player.club}
              realPosition={SAMPLE_CAREER.player.position}
              playAs={labPlayAs}
              onChange={setLabPlayAs}
            />
          </div>
          <VersusScreen
            matchday={labPlayAs
              ? matchdayFor(SAMPLE_CAREER, SAMPLE_FIXTURE, true, labPlayAs)
              : SAMPLE_MATCHDAY}
            date="Sat 29 Aug"
            competition="Premier League · Matchday 3"
            onKickOff={() => setShowTeams(false)}
            onBack={() => setShowTeams(false)}
          />
        </div>
      )}

      {showWin && (
        <PotmWinModal
          award={{
            season: 1, month: 5, monthName: "January", winner: "Vass", club: "Liverpool",
            goals: 7, assists: 3, isYou: true, nominees: [],
          }}
          career={{
            player: { firstName: "Mikey", lastName: "Vass", club: "Liverpool" },
            squadNumber: 19,
          } as never}
          onClose={() => setShowWin(false)}
        />
      )}
      <PageGuide page="/star-dev/media-lab" corner="bottom-left" />
    </BroadcastPage>
    </div>
  );
}

/**
 * A stand-in for a photograph somebody took of themselves — a face-shaped thing
 * against a room-coloured background, which is exactly the case the duotone
 * exists to handle. Inline, because the bench must not need the network.
 */
const PLACEHOLDER_PHOTO =
  "data:image/svg+xml;utf8," + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
       <rect width="200" height="200" fill="#8a9a7b"/>
       <rect y="130" width="200" height="70" fill="#6b7a5e"/>
       <ellipse cx="100" cy="88" rx="46" ry="54" fill="#e0b48f"/>
       <path d="M40 200 C40 150 70 138 100 138 C130 138 160 150 160 200 Z" fill="#3f4a5a"/>
       <path d="M56 74 C60 34 140 34 144 74 C144 52 128 38 100 38 C72 38 56 52 56 74 Z" fill="#4a3527"/>
     </svg>`);

/**
 * A passage of a match, for judging the commentary screen.
 *
 * Written to contain every tone the screen can render — ordinary play, a goal
 * either way, something you did, a chance that came to nothing, and the
 * interval — because the risk in a list of styled rows is that two of the
 * styles turn out to be indistinguishable and nobody notices until a goal reads
 * like a throw-in.
 */
const SAMPLE_COMMENTARY = [
  logLine("Kick Off", "period", 0),
  logLine("Liverpool get us under way", "play", 1, false),
  logLine("They are passing it around well", "play", undefined, false),
  logLine("The move works its way to Vass", "you", 12),
  logLine("They push forward", "play", undefined, true),
  logLine("Man Utd have a chance to score...", "chance", 18),
  logLine("But the shot goes wide", "play", undefined, true),
  logLine("\u26bd Man Utd score!", "oppGoal", 23),
  logLine("Liverpool are taking it easy", "play", 31, false),
  logLine("Half Time  0 - 1", "period", 45),
  logLine("The move works its way to Vass", "you", 49),
  logLine("\u26bd Vass scores!", "goal", 54),
  logLine("A: Salah", "assist"),
  logLine("Liverpool are moving the ball nicely...", "chance", 61),
  logLine("But it's scrambled to safety", "play"),
  logLine("That's nice football from Man Utd...", "chance", 68),
  logLine("But the keeper saves it", "play"),
];

/** A busy August, for judging the shortlist card. */
const SAMPLE_NOMINEES: GraphicSpec = {
  type: "potmNominees",
  month: "August",
  nominees: [
    { name: "Mikey Vass", club: "Liverpool", goals: 6, assists: 2, isYou: true, number: 19 },
    { name: "R. Calafiori", club: "Arsenal", goals: 5, assists: 1, isYou: false, face: FACE(243812) },
    { name: "J. Grealish", club: "Everton", goals: 4, assists: 3, isYou: false, face: FACE(209331) },
    { name: "M. Guehi", club: "Crystal Palace", goals: 4, assists: 0, isYou: false, face: FACE(235243) },
    { name: "E. Haaland", club: "Manchester City", goals: 4, assists: 0, isYou: false, face: FACE(239085) },
    { name: "J. Pedro", club: "Chelsea", goals: 3, assists: 2, isYou: false, face: FACE(247635) },
    { name: "A. Semenyo", club: "AFC Bournemouth", goals: 3, assists: 1, isYou: false },
    { name: "D. Szoboszlai", club: "Tottenham Hotspur", goals: 2, assists: 4, isYou: false, face: FACE(233419) },
  ],
};

/** Somebody else winning it, which is nine months in ten. */
const SAMPLE_WINNER: GraphicSpec = {
  type: "potmWinner",
  month: "September",
  firstName: "Erling",
  lastName: "Haaland",
  club: "Manchester City",
  goals: 6,
  assists: 1,
  isYou: false,
  face: FACE(239085),
  yourPlace: 4,
};

/** …and the month you win it, where there is no photograph to use. */
const SAMPLE_WINNER_YOU: GraphicSpec = {
  type: "potmWinner",
  month: "October",
  firstName: "Mikey",
  lastName: "Vass",
  club: "Liverpool",
  goals: 7,
  assists: 3,
  isYou: true,
  number: 19,
};

/** The same, once you have taken a picture — the treated case. */
const SAMPLE_WINNER_PHOTO: GraphicSpec = {
  ...SAMPLE_WINNER_YOU,
  month: "November",
  number: undefined,
  face: PLACEHOLDER_PHOTO,
  own: true,
};

/** The portrait URL the importer writes, for judging the card against real ones.
 *  Semenyo above is deliberately left without one — the monogram fallback has to
 *  be looked at too, because a partly-imported division will produce it. */
function FACE(id: number): string {
  const s = String(id).padStart(6, "0");
  return `https://cdn.sofifa.net/players/${s.slice(0, 3)}/${s.slice(3)}/26_120.png`;
}

function Drop({ label, src, onDrop, onPick, onClear }: {
  label: string; src: string | null;
  onDrop: (e: React.DragEvent) => void;
  onPick: (f: File) => void;
  onClear: () => void;
}) {
  return (
    <div onDrop={onDrop} onDragOver={e => e.preventDefault()} className="ml-drop">
      <Label>{label}</Label>
      {src ? (
        <>
          <img src={src} alt="" />
          <button onClick={onClear} className="ml-remove">remove</button>
        </>
      ) : (
        <p>Drag a PNG here</p>
      )}
      <label className="ml-file">
        Choose file
        <input type="file" accept="image/*"
          onChange={e => { const f = e.target.files?.[0]; if (f) onPick(f); }} />
      </label>
    </div>
  );
}

function Slider({ label, value, onChange, min = 0, max = 1, hint }: {
  label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; hint?: string;
}) {
  return (
    <div className="ml-slider">
      <div className="ml-slider-top"><span>{label}</span><b>{value.toFixed(2)}</b></div>
      <input
        type="range" min={min} max={max} step={0.005} value={value}
        onChange={e => onChange(Number(e.target.value))}
        aria-label={label}
      />
      {hint && <small>{hint}</small>}
    </div>
  );
}
