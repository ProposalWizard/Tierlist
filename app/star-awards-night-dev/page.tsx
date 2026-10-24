"use client";

/**
 * THE SEASON AWARDS NIGHT, ON ITS OWN (Leo's tonight plan, part 13a).
 *
 * A made-up career with made-up results: you win 2 of the 5 awards (Golden
 * Boot, Player of the Season) and lose 3. Play the night in 3D or drawn (what
 * a phone that can't run 3D sees), or open the awards page after it.
 * Nothing is saved.
 */
import { useMemo, useState } from "react";
import PageGuide from "@/components/admin/PageGuide";
import { BroadcastPage, Panel, Btn, Pill, Note } from "@/components/admin/broadcast/BroadcastPage";
import { pitchFont } from "@/components/star/ui/pitchFont";
import "@/components/star/ui/flat.css";
import SeasonAwardsNight, { AwardsCeremony, seedOf } from "@/components/star/SeasonAwardsNight";
import SeasonAwardsScreen from "@/components/star/SeasonAwardsScreen";
import { previewCareer } from "@/lib/star/retirementPreview";
import { computeSeasonAwardStats, type AwardWinner, type SeasonAwardStats } from "@/lib/star/seasonAwards";
import { awardsPlan, AWARD_INFO, AWARD_ORDER } from "@/lib/star/awardsNight";
import type { CareerState } from "@/lib/star/types";

type View = "menu" | "night" | "result" | "flow";

/** Made-up names (nobody real). */
const NAMES = ["Marco Velasco", "Tomás Ferreira", "Jonas Albrecht", "Luca Moretti", "Kenji Arai", "Adrien Lacroix", "Rui Saldanha", "Emre Kaya", "Diego Ríos", "Sam Okafor", "Theo Lindqvist", "Ollie Brennan"];

/** The career with made-up awards: you win the Golden Boot and Player of the Season, lose the other three. */
function madeUp(seed: number): CareerState {
  const base = previewCareer("legend", seed, { upTo: 6 });
  const real = computeSeasonAwardStats(base);
  const me = `${base.player.firstName} ${base.player.lastName}`;
  const clubs = (base.league ?? []).map((t) => t.name).filter((n) => n !== base.player.club);
  const club = (i: number) => clubs[(i + seed) % Math.max(1, clubs.length)] ?? "Arsenal";
  const you = (value: number): AwardWinner => ({ name: me, club: base.player.club, isYou: true, value, image: base.player.portrait });
  const them = (i: number, value: number): AwardWinner => ({ name: NAMES[(i + seed) % NAMES.length], club: club(i), isYou: false, value });
  const nominees: SeasonAwardStats["nominees"] = {
    goldenBoot: [you(27), them(0, 23), them(1, 19)],
    assistKing: [them(2, 15), you(12), them(3, 11)],
    goldenGlove: [them(4, 17), them(5, 15), them(6, 13)],
    youngPlayerOfSeason: [them(7, 88), you(85), them(8, 80)],
    playerOfSeason: [you(112), them(0, 104), them(9, 99)],
  };
  const stats: SeasonAwardStats = {
    ...real,
    goldenBoot: nominees.goldenBoot![0],
    assistKing: nominees.assistKing![0],
    goldenGlove: nominees.goldenGlove![0],
    youngPlayerOfSeason: nominees.youngPlayerOfSeason![0],
    playerOfSeason: nominees.playerOfSeason![0],
    nominees,
  };
  return { ...base, lastSeasonAwardStats: stats };
}

export default function AwardsNightDevPage() {
  const [seed, setSeed] = useState(1);
  const [drawn, setDrawn] = useState(false);
  const [view, setView] = useState<View>("menu");
  const career = useMemo(() => madeUp(seed), [seed]);
  const plan = useMemo(() => awardsPlan(career.lastSeasonAwardStats!, seedOf(career)), [career]);
  // The game's own look and full screen (the site's menu and footer hide, as on /star-dev).
  const wrap = (el: React.ReactNode) => <div className={`star-root ${pitchFont.variable}`}><div data-star-game hidden />{el}</div>;
  const toMenu = () => setView("menu");

  if (view === "night") return wrap(<AwardsCeremony key={`${seed}-${drawn}`} career={career} plan={plan} drawn={drawn} onDone={() => setView("result")} />);
  if (view === "result") return wrap(<SeasonAwardsScreen career={career} onContinue={toMenu} />);
  if (view === "flow") return wrap(<SeasonAwardsNight career={career} onContinue={toMenu} />);

  return (
    <BroadcastPage title="Season awards night" sub="The awards read out in a small hall, then the awards page. Made-up results; nothing is saved.">
      <Panel title="Made-up results" note={`about ${Math.round(plan.end)} s, ${plan.awards.length} awards`}>
        <div style={{ display: "grid", gap: 6 }}>
          {AWARD_ORDER.map((k) => {
            const a = plan.awards.find((x) => x.key === k);
            return (
              <div key={k} data-dev-award={k}>
                <b>{AWARD_INFO[k].label}</b>: {a ? a.nominees.map((n) => `${n.isYou ? "You" : n.name} ${n.value}`).join(" · ") : "nobody"}
                {a?.winner.isYou ? " (you win)" : ""}
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
          <Btn onClick={() => setSeed((s) => s + 1)}>Other names ▶</Btn>
          <Note>made-up career, seed {seed}</Note>
        </div>
      </Panel>
      <Panel title="Play it">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <Pill on={!drawn} onClick={() => setDrawn(false)}>3D</Pill>
          <Pill on={drawn} onClick={() => setDrawn(true)}>Drawn</Pill>
          <Btn main onClick={() => setView("night")}>▶ Play the night</Btn>
          <Btn onClick={() => setView("flow")}>As the game shows it</Btn>
          <Btn onClick={() => setView("result")}>The awards page after it</Btn>
        </div>
      </Panel>
      <PageGuide page="/star-awards-night-dev" corner="bottom-left" />
    </BroadcastPage>
  );
}
