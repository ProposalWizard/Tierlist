"use client";

/**
 * TRAINING LEVELS, ALL OF THEM — a dev screen for playing any level of any
 * training game straight away (Mikey, 25 Sep 2026: "very simply go into
 * vision for example and click on level thirteen… and I can go in and out
 * very easily").
 *
 * Every level plays through the same TrainingMinigame a career uses, so what
 * you see here is the level a player gets. Playing saves nothing: no career
 * is touched, no stars are banked.
 *
 * Broadcast look, option 1 (Harry, 19 Oct 2026: "training levels opt 1
 * functional"): the games as tabs, the 30 levels as a grid, the picked level
 * on the right with LET'S GO. Pictures: public/admin/training-levels/<skill>.webp
 * (real stills of each game at level 15).
 *
 * Edit level (Harry, 19 Oct 2026: "training levels have no way of adapting
 * them, like I would do in a scenario gallery"): every number of the picked
 * level as a slider, ▶ Play it at once, Save (star_training_levels, every
 * career) or Commit (lib/star/data/trainingLevels.json on main).
 */

import { useCallback, useEffect, useState } from "react";
import TrainingMinigame from "@/components/star/TrainingMinigame";
import PageGuide from "@/components/admin/PageGuide";
import { BroadcastPage, Panel, Btn, Pill, Label, Note } from "@/components/admin/broadcast/BroadcastPage";
import "./training-levels.css";
import { TRAINING_LEVELS } from "@/lib/star/trainingLevels";
import { levelConfig, levelId, type AnyLevel, type TrainingSkill, type LevelBySkill } from "@/lib/star/trainingLevelData";
import {
  ensureTrainingLevels, savedLevels, saveTrainingLevel, resetTrainingLevel, commitTrainingLevels, isPendingLevel,
} from "@/lib/star/trainingLevelStore";
import LevelEditor, { type EditorStatus } from "./LevelEditor";

const SKILLS: { key: TrainingSkill; label: string; game: string }[] = [
  { key: "power", label: "Power", game: "Long Range" },
  { key: "technique", label: "Technique", game: "Through the Gate" },
  { key: "freeKick", label: "Free Kick", game: "Over the Wall" },
  { key: "pace", label: "Pace", game: "The Gauntlet" },
  { key: "vision", label: "Vision", game: "Read the Run" },
];

/** One short line saying what a level asks for — the numbers that change. */
function levelLine(skill: TrainingSkill, c: AnyLevel): string {
  if (skill === "power") { const p = c as LevelBySkill["power"]; return `${p.distance.toFixed(0)}m · ${p.keeper ? `${p.blockers} in way` : "open goal"}`; }
  if (skill === "technique") { const t = c as LevelBySkill["technique"]; return `${t.gateDistance.toFixed(0)}m · ${t.gateWidth.toFixed(1)}m gap`; }
  if (skill === "freeKick") { const f = c as LevelBySkill["freeKick"]; return `${f.distance.toFixed(0)}m · wall ${f.wall}`; }
  if (skill === "pace") { const p = c as LevelBySkill["pace"]; return `${p.chasers} men · ${p.oppStrength.toFixed(0)} spd`; }
  const v = c as LevelBySkill["vision"];
  return `${v.options} options · ${v.window.toFixed(1)}s`;
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
  const [skill, setSkill] = useState<TrainingSkill>("power");
  const [level, setLevel] = useState<number | null>(null);
  // The level picked in the grid (LET'S GO plays it).
  const [picked, setPicked] = useState(1);
  const [run, setRun] = useState(0);
  const [lastStars, setLastStars] = useState<Record<string, number>>({});
  // The player's own skills: they decide how hard you can hit it and how
  // much it bends, so a level plays differently at 40 and at 100.
  const [you, setYou] = useState(40);
  // Edit level: the panel is open, and the unsaved numbers per level.
  const [editing, setEditing] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, AnyLevel>>({});
  const [status, setStatus] = useState<EditorStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [sharedNote, setSharedNote] = useState<string | null>(null);
  // Bumped when the saved levels change, so the grid re-reads them.
  const [, setTick] = useState(0);

  // Pinned panels stay pinned (app/globals.css: sticky needs overflow clip).
  useEffect(() => {
    document.body.classList.add("knowitball-immersive");
    return () => document.body.classList.remove("knowitball-immersive");
  }, []);
  useEffect(() => {
    void ensureTrainingLevels().then(r => {
      if (r.migrationMissing) setSharedNote("Saved levels stay on this device only until supabase/migrations/star_training_levels.sql is run.");
      else if (!r.shared && r.message) setSharedNote(r.message);
      setTick(t => t + 1);
    });
  }, []);

  const info = SKILLS.find(s => s.key === skill)!;
  const idOf = (n: number) => levelId(skill, n);
  const configOf = useCallback((n: number): AnyLevel => drafts[levelId(skill, n)] ?? levelConfig(skill, n), [drafts, skill]);
  const isDraft = (n: number) => {
    const d = drafts[levelId(skill, n)];
    return !!d && JSON.stringify(d) !== JSON.stringify(levelConfig(skill, n));
  };
  const savedHere = (n: number) => !!savedLevels()[levelId(skill, n)];

  // A level opens at the top of the page, with its bar in view.
  const play = (n: number) => { setPicked(n); setLevel(n); setRun(r => r + 1); window.scrollTo(0, 0); };

  if (level !== null) {
    const go = (n: number) => { const m = Math.max(1, Math.min(TRAINING_LEVELS, n)); setLevel(m); setPicked(m); setRun(r => r + 1); };
    const override = isDraft(level) ? drafts[idOf(level)] : undefined;
    return (
      <div className="tr-play">
        <div className="tr-bar">
          <button onClick={() => setLevel(null)} className="tr-bar-back">‹ {editing ? "Edit level" : "All levels"}</button>
          <span className="tr-bar-mid">{info.label} · skills {you}{override ? " · unsaved edit" : ""}</span>
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
          levelOverride={override}
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
  const draft = configOf(picked);

  const saveNow = async () => {
    setBusy(true);
    const r = await saveTrainingLevel(skill, picked, draft);
    setDrafts(d => { const n = { ...d }; delete n[idOf(picked)]; return n; });
    setStatus({ text: r.message, tone: r.shared ? "good" : "warn" });
    setBusy(false); setTick(t => t + 1);
  };
  const commitNow = async () => {
    setBusy(true);
    const r = await commitTrainingLevels([{ skill, level: picked, config: draft }]);
    setStatus({ text: r.ok ? `${r.message} Vercel redeploys main in a minute or two.` : r.message, tone: r.ok ? "good" : "bad" });
    setBusy(false);
  };
  const resetNow = async () => {
    setBusy(true);
    const r = await resetTrainingLevel(skill, picked);
    setDrafts(d => { const n = { ...d }; delete n[idOf(picked)]; return n; });
    setStatus({ text: r.message, tone: r.shared ? "good" : "warn" });
    setBusy(false); setTick(t => t + 1);
  };

  return (
    <BroadcastPage title="Training levels" sub="Play any level of any training game. Edit level changes its numbers.">
      <div className="tr-top">
        <div className="tr-tabs" role="tablist">
          {SKILLS.map(s => (
            <button key={s.key} role="tab" aria-selected={skill === s.key} onClick={() => { setSkill(s.key); setStatus(null); }} className="tr-tab">
              {s.label}
            </button>
          ))}
        </div>
        <div className="tr-you">
          <Label>Your skills</Label>
          {SKILL_VALUES.map(v => <Pill key={v} on={you === v} onClick={() => setYou(v)}>{v}</Pill>)}
        </div>
      </div>
      {sharedNote && <Note>{sharedNote}</Note>}

      <div className="tr-layout" data-editing={editing ? "true" : undefined}>
        <div className="tr-grid">
          {Array.from({ length: TRAINING_LEVELS }, (_, i) => i + 1).map(n => {
            const played = lastStars[`${skill}-${n}`];
            const mark = isDraft(n) ? "edit" : savedHere(n) ? (isPendingLevel(skill, n) ? "device" : "saved") : undefined;
            return (
              <button
                key={n}
                data-level={n}
                data-mark={mark}
                aria-pressed={picked === n}
                onClick={() => { if (picked === n && !editing) play(n); else { setPicked(n); setStatus(null); } }}
                className="tr-tile"
                title={mark === "edit" ? "Unsaved edit" : mark === "saved" ? "Saved edit (every career)" : mark === "device" ? "Saved on this device only" : picked === n ? "Tap again to play" : `Pick level ${n}`}
              >
                <span className="tr-num">{String(n).padStart(2, "0")}</span>
                <span className="tr-line">{levelLine(skill, configOf(n))}</span>
                {played !== undefined && <Stars n={played} />}
              </button>
            );
          })}
        </div>

        <aside className="tr-side">
          {editing ? (
            <LevelEditor
              skill={skill}
              level={picked}
              game={info.game}
              draft={draft}
              onChange={next => { setDrafts(d => ({ ...d, [idOf(picked)]: next })); setStatus(null); }}
              onPlay={() => play(picked)}
              onSave={saveNow}
              onCommit={commitNow}
              onReset={resetNow}
              onClose={() => setEditing(false)}
              status={status}
              busy={busy}
              savedHere={savedHere(picked)}
              you={you}
            />
          ) : (
            <Panel title={`Level ${picked}: ${info.game}`} note={info.label}>
              <div className="tr-detail">
                <div className="tr-pic" style={{ backgroundImage: `url(/admin/training-levels/${skill}.webp)` }} role="img" aria-label={`${info.label} training, picture from level 15`} />
                <div className="tr-facts">
                  <Label>It asks for</Label>
                  <div className="tr-ask">{levelLine(skill, draft)}</div>
                  <Label>Your stars here</Label>
                  <div className="tr-ask">{pickedStars !== undefined ? <Stars n={pickedStars} /> : "Not played yet"}</div>
                  <Note>Picture: {info.label} at level 15. Plays at skills {you}.</Note>
                </div>
              </div>
              <div className="tr-go">
                <Btn onClick={() => { setEditing(true); setStatus(null); }}>Edit level</Btn>
                <Btn main onClick={() => play(picked)}>Let&apos;s go ›</Btn>
              </div>
            </Panel>
          )}
        </aside>
      </div>
      <PageGuide page="/star-training-dev" />
    </BroadcastPage>
  );
}
