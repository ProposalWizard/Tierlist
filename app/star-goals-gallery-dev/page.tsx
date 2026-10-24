"use client";

/**
 * CAREER GOALS — the test page for Stats → Goals (Leo, 22 Oct 2026).
 *
 * A made-up career with goals over four seasons. About one goal in three
 * gets a made recording (lib/star/goalClip/synth.ts, never the engine) kept in
 * this browser, so it plays; a few say they were recorded but have no
 * recording here (as on another phone); the rest were never recorded.
 * "600 goals" checks the list stays quick; "Old save" shows the empty page;
 * "Hall of Fame" shows the career's best 10 as the Hall keeps them.
 */
import { useEffect, useMemo, useState } from "react";
import PageGuide from "@/components/admin/PageGuide";
import { BroadcastPage, Panel, Pill } from "@/components/admin/broadcast/BroadcastPage";
import CareerGoalsGallery, { BestGoalsSheet } from "@/components/star/CareerGoalsGallery";
import { previewCareer } from "@/lib/star/retirementPreview";
import { slimCareer } from "@/lib/star/hallOfFame";
import { putClip } from "@/lib/star/goalClip/store";
import { synthTrack, type SynthKind } from "@/lib/star/goalClip/synth";
import { mulberry32 } from "@/lib/star/season";
import type { CareerGoal } from "@/lib/star/goalLog";
import type { CareerState } from "@/lib/star/types";

const OPPONENTS = ["Arsenal", "Chelsea", "Liverpool", "Manchester City", "Tottenham Hotspur", "Newcastle United", "Aston Villa", "Brighton & Hove Albion", "West Ham United", "Everton", "Fulham", "Brentford", "Crystal Palace", "Wolverhampton Wanderers", "Nottingham Forest", "Bournemouth"];
const CUPS = ["FA Cup", "League Cup", "Champions League"];
const HOWS = [undefined, undefined, "header", "penalty", "free kick", "volley", "solo run", undefined];

/** A made-up goal log: `n` goals over `seasons` seasons, every 3rd recorded. */
function fakeGoals(club: string, n: number, seasons: number, seed: number): CareerGoal[] {
  const rng = mulberry32(seed);
  const out: CareerGoal[] = [];
  for (let i = 0; i < n; i++) {
    const season = 1 + Math.floor((i / n) * seasons);
    const week = 1 + (i % 38);
    const cup = rng() < 0.22;
    const how = HOWS[Math.floor(rng() * HOWS.length)];
    const pen = how === "penalty";
    const distance = rng() < 0.12 ? undefined : pen ? 11 : how === "free kick" ? 20 + rng() * 10 : 5 + rng() * rng() * 28;
    const us = 1 + Math.floor(rng() * 4), them = Math.floor(rng() * 3);
    const recorded = i % 3 === 0 ? "here" : i % 11 === 1 ? "elsewhere" : "none";
    out.push({
      id: `${season}:${week}:${cup ? "cup" : "league"}:${i}:${Math.floor(rng() * 90)}:0`,
      season, week,
      minute: 1 + Math.floor(rng() * 93),
      opponent: OPPONENTS.filter(o => o !== club)[Math.floor(rng() * (OPPONENTS.length - 1))],
      club,
      home: rng() < 0.5,
      competition: cup ? CUPS[Math.floor(rng() * CUPS.length)] : "Premier League",
      score: `${us}-${them}`,
      ...(how ? { how } : {}),
      ...(distance !== undefined ? { distance: Math.round(distance * 10) / 10 } : {}),
      ...(!pen && rng() < 0.12 ? { finish: rng() < 0.5 ? "chip" as const : "curl" as const } : {}),
      ...(rng() < 0.5 ? { assist: "Bukayo Saka" } : {}),
      ...(recorded !== "none" ? { clipId: `dev-gallery-${seed}-${i}${recorded === "elsewhere" ? "-away" : ""}` } : {}),
    });
  }
  // In the order they were scored, as the real log keeps them.
  return out.sort((a, b) => a.season - b.season || a.week - b.week || a.minute - b.minute);
}

/** Which made move fits the goal. */
function kindOf(g: CareerGoal): SynthKind {
  const how = (g.how ?? "").toLowerCase();
  if (how.includes("pen")) return "penalty";
  if (how.includes("header")) return "header";
  if ((g.distance ?? 0) > 18) return "long_range";
  return (g.distance ?? 10) < 9 ? "tap_in" : "run_in";
}

/** Make and keep (this browser) the recordings this page says are "here". */
async function keepRecordings(goals: CareerGoal[], name: string, limit: number): Promise<number> {
  let made = 0;
  for (const g of goals) {
    if (made >= limit) break;
    if (!g.clipId || g.clipId.endsWith("-away")) continue;
    const [us, them] = g.score.split("-").map(Number);
    const track = synthTrack({
      home: g.home ? g.club : g.opponent,
      away: g.home ? g.opponent : g.club,
      scorer: name, scorerShort: name.split(" ").pop() ?? name, scorerHome: g.home,
      minute: g.minute,
      scoreAfter: g.home ? [us, them] : [them, us],
      competition: g.competition, season: g.season, week: g.week,
      seed: g.id, kind: kindOf(g),
    });
    if (!track) continue;
    track.meta.id = g.clipId;
    await putClip(track);
    made++;
  }
  return made;
}

type Mode = "80" | "600" | "old";

export default function GoalsGalleryDevPage() {
  const base = useMemo(() => previewCareer("legend", 1), []);
  const [mode, setMode] = useState<Mode>("80");
  const [hall, setHall] = useState(false);
  const [ready, setReady] = useState<number | null>(null);
  const name = `${base.player.firstName} ${base.player.lastName}`;

  const career: CareerState = useMemo(() => {
    if (mode === "old") return { ...base, goalLog: undefined };
    const n = mode === "600" ? 600 : 80;
    const seasons = mode === "600" ? 20 : 4;
    return { ...base, goalLog: fakeGoals(base.player.club, n, seasons, mode === "600" ? 6 : 1) };
  }, [base, mode]);

  // The recordings go in before the gallery reads which are on this phone.
  useEffect(() => {
    let live = true;
    setReady(null);
    void keepRecordings(career.goalLog ?? [], name, mode === "600" ? 60 : 40).then(k => { if (live) setReady(k); });
    return () => { live = false; };
  }, [career, name, mode]);

  return (
    <BroadcastPage title="Career goals" sub="Stats → Goals with a made-up career. Nothing here touches a save." width={480}>
      <Panel title="Career" note={ready === null ? "making recordings…" : `${ready} recordings in this browser`}>
        <div className="flex flex-wrap gap-1.5">
          <Pill on={mode === "80"} onClick={() => setMode("80")}>80 goals · 4 seasons</Pill>
          <Pill on={mode === "600"} onClick={() => setMode("600")}>600 goals</Pill>
          <Pill on={mode === "old"} onClick={() => setMode("old")}>Old save</Pill>
          <Pill on={hall} onClick={() => setHall(true)}>Hall of Fame</Pill>
        </div>
      </Panel>
      <div className="mx-auto mt-3 w-full min-w-0 max-w-[420px] overflow-hidden rounded-xl p-2" style={{ background: "#05080f" }} data-gallery-phone>
        {ready !== null && <CareerGoalsGallery key={mode} career={career} />}
      </div>
      {hall && <BestGoalsSheet career={slimCareer(career)} onClose={() => setHall(false)} />}
      <PageGuide page="/star-goals-gallery-dev" />
    </BroadcastPage>
  );
}
