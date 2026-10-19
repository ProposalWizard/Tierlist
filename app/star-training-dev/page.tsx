"use client";

/**
 * TRAINING LEVELS, ALL OF THEM — a dev screen for playing any level of any
 * training game straight away (Mikey, 25 Sep 2026: "very simply go into
 * vision for example and click on level thirteen… and I can go in and out
 * very easily").
 *
 * Every level plays through the same TrainingMinigame a career uses, so what
 * you see here is the level a player gets. Nothing is saved: no career is
 * touched, no stars are banked.
 *
 * Broadcast look, option 1 (Harry, 19 Oct 2026: "training levels opt 1
 * functional"): the games as tabs, the 30 levels as a grid, the picked level
 * on the right with LET'S GO. Pictures: public/admin/training-levels/<skill>.webp
 * (real stills of each game at level 15). Only this menu changed; the games
 * themselves are untouched.
 */

import { useEffect, useState } from "react";
import TrainingMinigame from "@/components/star/TrainingMinigame";
import PageGuide from "@/components/admin/PageGuide";
import { BroadcastPage, Panel, Btn, Pill, Label, Note } from "@/components/admin/broadcast/BroadcastPage";
import "./training-levels.css";
import type { Skills } from "@/lib/star/types";
import { TRAINING_LEVELS, levelDifficulty } from "@/lib/star/trainingLevels";
import { powerDrill, techniqueDrill, freeKickDrill, paceDrill, visionDrill } from "@/lib/star/trainingDrills";

const SKILLS: { key: keyof Skills; label: string; game: string }[] = [
  { key: "power", label: "Power", game: "Long Range" },
  { key: "technique", label: "Technique", game: "Through the Gate" },
  { key: "freeKick", label: "Free Kick", game: "Over the Wall" },
  { key: "pace", label: "Pace", game: "The Gauntlet" },
  { key: "vision", label: "Vision", game: "Read the Run" },
];

/** One short line saying what a level asks for — the numbers that change. */
function levelLine(skill: keyof Skills, level: number): string {
  const d = levelDifficulty(level);
  if (skill === "power") { const c = powerDrill(d, 0); return `${c.distance.toFixed(0)}m · ${c.blockers} in way`; }
  if (skill === "technique") { const c = techniqueDrill(d, 0); return `${c.gateDistance.toFixed(0)}m · ${c.gateWidth.toFixed(1)}m gap`; }
  if (skill === "freeKick") { const c = freeKickDrill(d, 0); return `${c.distance.toFixed(0)}m · wall ${c.wall}`; }
  if (skill === "pace") { const c = paceDrill(d, 0); return `${c.chasers} men · ${c.oppStrength.toFixed(0)} spd`; }
  const c = visionDrill(d, 0);
  return `${c.options} options · ${c.window.toFixed(1)}s`;
}

const SKILL_VALUES = [40, 70, 100];

function Stars({ n }: { n: number }) {
  return (
    <span className="tr-stars" aria-label={`${n} of 3 stars`}>
      {[0, 1, 2].map(k => <span key={k} data-on={k < n ? "true" : undefined}>★</span>)}
    </span>
  );
}

export default function TrainingDev() {
  const [skill, setSkill] = useState<keyof Skills>("power");
  const [level, setLevel] = useState<number | null>(null);
  // The level picked in the grid (LET'S GO plays it).
  const [picked, setPicked] = useState(1);
  const [run, setRun] = useState(0);
  const [lastStars, setLastStars] = useState<Record<string, number>>({});
  // The player's own skills: they decide how hard you can hit it and how
  // much it bends, so a level plays differently at 40 and at 100.
  const [you, setYou] = useState(40);

  // Pinned panels stay pinned (app/globals.css: sticky needs overflow clip).
  useEffect(() => {
    document.body.classList.add("knowitball-immersive");
    return () => document.body.classList.remove("knowitball-immersive");
  }, []);

  const info = SKILLS.find(s => s.key === skill)!;
  // A level opens at the top of the page, with its bar in view.
  const play = (n: number) => { setPicked(n); setLevel(n); setRun(r => r + 1); window.scrollTo(0, 0); };

  if (level !== null) {
    const go = (n: number) => { const m = Math.max(1, Math.min(TRAINING_LEVELS, n)); setLevel(m); setPicked(m); setRun(r => r + 1); };
    return (
      <div className="tr-play">
        <div className="tr-bar">
          <button onClick={() => setLevel(null)} className="tr-bar-back">‹ All levels</button>
          <span className="tr-bar-mid">{info.label} · skills {you}</span>
          <div className="tr-bar-step">
            <button onClick={() => go(level - 1)} disabled={level <= 1} aria-label="Previous level">◀</button>
            <b>L{level}</b>
            <button onClick={() => go(level + 1)} disabled={level >= TRAINING_LEVELS} aria-label="Next level">▶</button>
          </div>
        </div>
        <TrainingMinigame
          key={`${skill}-${level}-${run}`}
          skill={skill}
          trainingLevel={level}
          glow="#dc2626"
          skills={{ pace: you, power: you, technique: you, vision: you, freeKick: you }}
          onComplete={(stars) => {
            setLastStars(s => ({ ...s, [`${skill}-${level}`]: stars }));
            setLevel(null);
          }}
        />
        <PageGuide page="/star-training-dev" />
      </div>
    );
  }

  const pickedStars = lastStars[`${skill}-${picked}`];

  return (
    <BroadcastPage title="Training levels" sub="Play any level of any training game. Nothing is saved.">
      <div className="tr-top">
        <div className="tr-tabs" role="tablist">
          {SKILLS.map(s => (
            <button key={s.key} role="tab" aria-selected={skill === s.key} onClick={() => setSkill(s.key)} className="tr-tab">
              {s.label}
            </button>
          ))}
        </div>
        <div className="tr-you">
          <Label>Your skills</Label>
          {SKILL_VALUES.map(v => <Pill key={v} on={you === v} onClick={() => setYou(v)}>{v}</Pill>)}
        </div>
      </div>

      <div className="tr-layout">
        <div className="tr-grid">
          {Array.from({ length: TRAINING_LEVELS }, (_, i) => i + 1).map(n => {
            const played = lastStars[`${skill}-${n}`];
            return (
              <button
                key={n}
                data-level={n}
                aria-pressed={picked === n}
                onClick={() => (picked === n ? play(n) : setPicked(n))}
                className="tr-tile"
                title={picked === n ? "Tap again to play" : `Pick level ${n}`}
              >
                <span className="tr-num">{String(n).padStart(2, "0")}</span>
                <span className="tr-line">{levelLine(skill, n)}</span>
                {played !== undefined && <Stars n={played} />}
              </button>
            );
          })}
        </div>

        <aside className="tr-side">
          <Panel title={`Level ${picked}: ${info.game}`} note={info.label}>
            <div className="tr-detail">
              <div className="tr-pic" style={{ backgroundImage: `url(/admin/training-levels/${skill}.webp)` }} role="img" aria-label={`${info.label} training, picture from level 15`} />
              <div className="tr-facts">
                <Label>It asks for</Label>
                <div className="tr-ask">{levelLine(skill, picked)}</div>
                <Label>Your stars here</Label>
                <div className="tr-ask">{pickedStars !== undefined ? <Stars n={pickedStars} /> : "Not played yet"}</div>
                <Note>Picture: {info.label} at level 15. Plays at skills {you}.</Note>
              </div>
            </div>
            <div className="tr-go">
              <Btn main onClick={() => play(picked)}>Let&apos;s go ›</Btn>
            </div>
          </Panel>
        </aside>
      </div>
      <PageGuide page="/star-training-dev" />
    </BroadcastPage>
  );
}
