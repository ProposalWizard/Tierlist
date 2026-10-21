"use client";

/**
 * EDIT LEVEL — the Training levels page's editor (Harry, 19 Oct 2026:
 * "training levels have no way of adapting them, like I would do in a
 * scenario gallery").
 *
 * The level's picture, draggable like the gallery (Harry, 20 Oct 2026: "the
 * training editor should be drag and drop like the gallery"): drag the ball,
 * the cones or the men and the numbers beside it follow. Every number is
 * also a slider and a box. ▶ Play plays it on the real drill straight away,
 * then Save (every career, through the star_training_levels table) or Commit
 * (into lib/star/data/trainingLevels.json on main, like the gallery's
 * Commit). Undo steps back one drag or change at a time. Nothing here touches
 * the engine: the drill reads the numbers and builds its picture from them.
 *
 * No "your skills" slider (Harry, 20 Oct 2026: "surely it should just be
 * auto"): the level plays with the skills you would have after the levels
 * before it (lib/star/trainingAutoSkills.ts) — shown as one line.
 */

import { Panel, Btn, Pill, Label, Note } from "@/components/admin/broadcast/BroadcastPage";
import {
  LEVEL_FIELDS, committedLevel, levelConfig, defaultLevel, withoutPositions, hasPositions,
  type AnyLevel, type TrainingSkill, type FieldSpec,
} from "@/lib/star/trainingLevelData";
import { DRILL_LAYOUTS } from "@/lib/star/trainingLayout";
import LevelPicture from "./LevelPicture";

export interface EditorStatus { text: string; tone: "good" | "warn" | "bad" | "info" }

/** The one read-only line on what the level plays with, and its small print. */
export interface PlaysWith { line: string; note: string; ease?: string }

function fmt(f: FieldSpec, v: number): string {
  const dp = f.step >= 1 ? 0 : f.step >= 0.1 ? 1 : 2;
  return `${v.toFixed(dp)}${f.unit ?? ""}`;
}

export default function LevelEditor({
  skill, level, game, draft, onChange, onDragStart, onDragMove, onUndo, canUndo,
  onPlay, onSave, onCommit, onReset, onClose, status, busy, savedHere, playsWith,
}: {
  skill: TrainingSkill;
  level: number;
  game: string;
  draft: AnyLevel;
  /** A slider, box or pill changed one number (`key`): one Undo step per number. */
  onChange: (next: AnyLevel, key: string) => void;
  /** A drag on the picture is starting (one Undo step), then moving. */
  onDragStart: () => void;
  onDragMove: (next: AnyLevel) => void;
  onUndo: () => void;
  canUndo: boolean;
  onPlay: () => void;
  onSave: () => void;
  onCommit: () => void;
  onReset: () => void;
  onClose: () => void;
  status: EditorStatus | null;
  busy: boolean;
  /** This level has a saved edit on top of the committed file. */
  savedHere: boolean;
  playsWith: PlaysWith;
}) {
  const row = draft as unknown as Record<string, number | boolean | undefined>;
  const saved = levelConfig(skill, level) as unknown as Record<string, number | boolean | undefined>;
  const committed = committedLevel(skill, level) as unknown as Record<string, number | boolean | undefined>;
  const builtIn = defaultLevel(skill, level) as unknown as Record<string, number | boolean | undefined>;
  const dirty = JSON.stringify(draft) !== JSON.stringify(levelConfig(skill, level));
  const set = (key: string, v: number | boolean | undefined) => {
    const next: Record<string, unknown> = { ...row, [key]: v };
    if (v === undefined) delete next[key];
    onChange(next as unknown as AnyLevel, key);
  };
  const draggable = !!DRILL_LAYOUTS[skill];
  const placed = hasPositions(draft);
  const posKey = (r: Record<string, unknown>) => JSON.stringify([r.men, r.ball, r.lanes]);
  const placedChanged = posKey(row) !== posKey(saved);

  return (
    <Panel title={`Edit level ${level}: ${game}`} note={dirty ? "Unsaved changes" : savedHere ? "Saved edit" : "As committed"}>
      <div className="tr-ed" data-testid="level-editor">
        <div className="tr-plays" data-testid="plays-with">
          <b>Plays with:</b> {playsWith.line}
          <span>{playsWith.note}</span>
          {playsWith.ease && <span>{playsWith.ease}</span>}
        </div>
        <div className={draggable ? "tr-ed-wrap" : undefined}>
          {draggable && (
            <LevelPicture skill={skill} level={level} row={draft} onStart={onDragStart} onMove={onDragMove} />
          )}
          <div className="tr-ed-fields">
            {LEVEL_FIELDS[skill].map(f => {
              const v = row[f.key];
              const changed = v !== saved[f.key];
              if (f.toggle) {
                return (
                  <div key={f.key} className="tr-ed-row">
                    <span className="tr-ed-name">{f.label}{changed && <i> •</i>}</span>
                    <span className="tr-ed-pills">
                      <Pill on={Boolean(v)} onClick={() => set(f.key, true)}>On</Pill>
                      <Pill on={!v} onClick={() => set(f.key, false)}>Off</Pill>
                    </span>
                  </div>
                );
              }
              const n = Number(v);
              return (
                <label key={f.key} className="tr-ed-row">
                  <span className="tr-ed-name">{f.label}{changed && <i> •</i>}</span>
                  <input
                    type="range" min={f.min} max={f.max} step={f.step} value={n}
                    onChange={e => set(f.key, Number(e.target.value))}
                    aria-label={f.label}
                  />
                  <input
                    type="number" className="tr-ed-num" min={f.min} max={f.max} step={f.step} value={n}
                    onChange={e => { const x = Number(e.target.value); if (Number.isFinite(x)) set(f.key, Math.max(f.min, Math.min(f.max, x))); }}
                    aria-label={`${f.label} value`}
                  />
                  <span className="tr-ed-was" title="The committed number">{committed[f.key] !== n ? `was ${fmt(f, Number(committed[f.key]))}` : ""}</span>
                </label>
              );
            })}
            <div className="tr-ed-row">
              <span className="tr-ed-name">Layout{(row.seed !== saved.seed || placedChanged) && <i> •</i>}</span>
              <span className="tr-ed-pills">
                <Pill on={row.seed === undefined && !placed} onClick={() => onChange({ ...withoutPositions(draft), seed: undefined } as AnyLevel, "seed")}>Level&apos;s own</Pill>
                <Pill on={row.seed !== undefined && !placed} onClick={() => onChange({ ...withoutPositions(draft), seed: Math.floor(Math.random() * 2 ** 31) } as AnyLevel, "seed")}>
                  {row.seed !== undefined && !placed ? `Shuffled #${String(row.seed).slice(-4)}` : "Shuffle"}
                </Pill>
                {placed && <span className="tr-ed-placed">Placed by hand</span>}
              </span>
            </div>
          </div>
        </div>
        <Note>
          {draggable
            ? "Drag on the picture or use the numbers. Shuffle or Level's own puts everyone back where the level's layout stands them."
            : "The layout is where everyone stands; Shuffle picks a new one, Level's own goes back. This game's picture can't be dragged yet."}
        </Note>
        {JSON.stringify(builtIn) !== JSON.stringify(withoutPositions(committed as unknown as AnyLevel)) && <Note>This level&apos;s committed numbers differ from the built-in curve.</Note>}
        {status && <div className="tr-ed-status" data-tone={status.tone} role="status">{status.text}</div>}
        <div className="tr-ed-btns">
          <Btn main onClick={onPlay} disabled={busy}>▶ Play</Btn>
          <Btn onClick={onSave} disabled={busy}>Save</Btn>
          <Btn onClick={onCommit} disabled={busy}>Commit</Btn>
        </div>
        <div className="tr-ed-btns">
          <Btn onClick={onUndo} disabled={busy || !canUndo} title="Step back one drag or change">↶ Undo</Btn>
          <Btn onClick={() => onChange(levelConfig(skill, level), "all")} disabled={busy || !dirty} title="Throw away every unsaved change">Undo all</Btn>
          <Btn onClick={onReset} disabled={busy || !savedHere} title="Delete the saved edit: the level plays as committed">Back to committed</Btn>
          <Btn onClick={onClose}>Done</Btn>
        </div>
      </div>
      <Label>{dirty ? "▶ Play uses this picture and these numbers before you save" : "Playing uses the saved numbers"}</Label>
    </Panel>
  );
}
