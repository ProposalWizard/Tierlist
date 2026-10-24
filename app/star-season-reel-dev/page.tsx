"use client";

/**
 * YOUR SEASON IN ONE VIDEO — the test page (Leo, 22 Oct 2026).
 *
 * The end-of-season reel (components/star/SeasonReel.tsx) on a made-up
 * season, so it can be watched without playing one. The goals' recordings
 * are made on the spot by the goal-video maker for matches you did not play
 * (lib/star/goalClip/synth.ts), not by the match engine, and kept in memory
 * on this device only. Switches for a season with no recordings on this
 * phone and a season with no goals.
 */
import { useMemo, useState } from "react";
import PageGuide from "@/components/admin/PageGuide";
import { BroadcastPage, Panel, Btn, Pill, Label, Note } from "@/components/admin/broadcast/BroadcastPage";
import SeasonReel from "@/components/star/SeasonReel";
import { makeInitialCareer } from "@/lib/star/careerFlow";
import { PREMIER_LEAGUE_CLUBS } from "@/lib/star/clubs";
import { synthTrack, type SynthKind } from "@/lib/star/goalClip/synth";
import { putClip } from "@/lib/star/goalClip/store";
import { planReelFor } from "@/lib/star/goalClip/reel";
import type { CareerGoal } from "@/lib/star/goalLog";
import type { CareerState, StarPlayer } from "@/lib/star/types";

type Clips = "all" | "some" | "none";
const CLUBS = ["Arsenal", "Liverpool", "Newcastle United", "Aston Villa", "Brighton & Hove Albion"];
const COMPS = ["Premier League", "Premier League", "Premier League", "FA Cup", "Champions League", "League Cup"];
const HOWS: { how?: string; kind: SynthKind; distance: number; finish?: "chip" | "curl" }[] = [
  { kind: "run_in", how: "one_on_one", distance: 11 },
  { kind: "tap_in", how: "cutback", distance: 7 },
  { kind: "long_range", how: "long_range", distance: 27, finish: "curl" },
  { kind: "header", how: "header", distance: 9 },
  { kind: "penalty", how: "penalty", distance: 11 },
  { kind: "run_in", how: "one_on_one", distance: 13, finish: "chip" },
];
const MATES = ["Saka", "Ødegaard", "Rice", "Martinelli", undefined];

/** A made-up season: `n` goals, recordings for all, some or none of them. */
function fakeSeason(club: string, n: number, clips: Clips, trophies: number): { career: CareerState; tracks: number } {
  const player = {
    firstName: "Leo", lastName: "Vale", age: 22, skinTone: "light", club, clubBadge: null,
    position: "ST", nationality: "England", startYear: 2027,
  } as unknown as StarPlayer;
  const base = makeInitialCareer(player, [...PREMIER_LEAGUE_CLUBS], "premier");
  const opps = PREMIER_LEAGUE_CLUBS.filter((c) => c !== club);
  const goals: CareerGoal[] = [];
  let made = 0;
  for (let i = 0; i < n; i++) {
    const h = HOWS[(i * 7 + 3) % HOWS.length];
    const opponent = opps[(i * 5) % opps.length];
    const home = i % 2 === 0;
    const minute = 6 + ((i * 37) % 86);
    const us = 1 + (i % 3), them = i % 2;
    const competition = COMPS[i % COMPS.length];
    const g: CareerGoal = {
      id: `1:${i + 1}:league:${opponent}:${minute}:0`,
      season: 1, week: i + 1, minute, opponent, club, home, competition,
      score: `${us}-${them}`, how: h.how, distance: h.distance + (i % 4),
      ...(h.finish ? { finish: h.finish } : {}),
      ...(MATES[i % MATES.length] ? { assist: MATES[i % MATES.length] } : {}),
    };
    const want = clips === "all" || (clips === "some" && i % 3 !== 1);
    if (want) {
      const tr = synthTrack({
        home: home ? club : opponent, away: home ? opponent : club,
        scorer: "Leo Vale", scorerShort: "Vale", scorerHome: home, minute,
        scoreAfter: home ? [us, them] : [them, us], competition, season: 1, week: i + 1,
        seed: `reel-dev:${club}:${i}`, kind: h.kind,
      });
      if (tr) {
        tr.meta.isYou = true;
        void putClip(tr);
        g.clipId = tr.meta.id;
        made++;
      }
    }
    goals.push(g);
  }
  const wonList = ["Premier League", "FA Cup", "Champions League"].slice(0, trophies);
  const career: CareerState = {
    ...base,
    season: 1,
    goalLog: goals,
    seasonStats: { appearances: 38 + Math.min(12, n), goals: n, hatTricks: 1, passes: 900, assists: Math.round(n * 0.45), starMan: 6, totalRating: (38 + Math.min(12, n)) * 7.4, ratingCount: 38 + Math.min(12, n) },
    trophies: wonList.map((competition) => ({ season: 1, competition, club })),
  };
  return { career, tracks: made };
}

export default function SeasonReelDevPage() {
  const [club, setClub] = useState(CLUBS[0]);
  const [goals, setGoals] = useState(20);
  const [clips, setClips] = useState<Clips>("all");
  const [trophies, setTrophies] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [round, setRound] = useState(0);

  const season = useMemo(() => fakeSeason(club, goals, clips, trophies), [club, goals, clips, trophies]);
  // The plan as the screen will make it (with every recording made here).
  const plan = useMemo(() => planReelFor(season.career, {}, "Leo Vale"), [season]);

  if (playing) {
    return <SeasonReel key={round} career={season.career} onDone={() => setPlaying(false)} />;
  }

  return (
    <BroadcastPage title="Your season video" sub="The reel a player sees at the end of every season, on a made-up season." width={520}>
      <Panel title="1 · The season">
        <Label>Club</Label>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {CLUBS.map((c) => <Pill key={c} on={club === c} onClick={() => setClub(c)}>{c}</Pill>)}
        </div>
        <Label>Goals</Label>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {[40, 20, 8, 1, 0].map((n) => <Pill key={n} on={goals === n} onClick={() => setGoals(n)}>{n === 0 ? "No goals" : `${n}`}</Pill>)}
        </div>
        <Label>Recordings on this phone</Label>
        <div className="mb-3 flex flex-wrap gap-1.5">
          <Pill on={clips === "all"} onClick={() => setClips("all")}>Every goal</Pill>
          <Pill on={clips === "some"} onClick={() => setClips("some")}>Some</Pill>
          <Pill on={clips === "none"} onClick={() => setClips("none")}>No recordings</Pill>
        </div>
        <Label>Trophies won</Label>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {[0, 1, 3].map((n) => <Pill key={n} on={trophies === n} onClick={() => setTrophies(n)}>{n === 0 ? "None" : `${n}`}</Pill>)}
        </div>
        <Note>{goals} goals · {season.tracks} with a recording · about {Math.round(plan.duration)} s long (a little shorter or longer once the recordings are read).</Note>
      </Panel>
      <Panel title="2 · Watch it">
        <Btn main onClick={() => { setRound((r) => r + 1); setPlaying(true); }}>▶ Play the reel</Btn>
      </Panel>
      <PageGuide page="/star-season-reel-dev" />
    </BroadcastPage>
  );
}
