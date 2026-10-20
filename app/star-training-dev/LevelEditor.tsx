"use client";

/**
 * EDIT LEVEL — the Training levels page's editor (Harry, 19 Oct 2026:
 * "training levels have no way of adapting them, like I would do in a
 * scenario gallery").
 *
 * Every number a drill is built from, as a slider: change it, ▶ Play it on
 * the real drill straight away, then Save (every career, through the
 * star_training_levels table) or Commit (into lib/star/data/trainingLevels.json
 * on main, like the gallery's Commit). Nothing here touches the engine: the
 * drill reads the numbers and builds its picture from them.
 */

import { Panel, Btn, Pill, Label, Note } from "@/components/admin/broadcast/BroadcastPage";
import {
  LEVEL_FIELDS, committedLevel, levelConfig, defaultLevel,
  type AnyLevel, type TrainingSkill, type FieldSpec,
} from "@/lib/star/trainingLevelData";

export interface EditorStatus { text: string; tone: "good" | "warn" | "bad" | "info" }

function fmt(f: FieldSpec, v: number): string {
  const dp = f.step >= 1 ? 0 : f.step >= 0.1 ? 1 : 2;
  return `${v.toFixed(dp)}${f.unit ?? ""}`;
}

export default function LevelEditor({
  skill, level, game, draft, onChange, onPlay, onSave, onCommit, onReset, onClose, status, busy, savedHere, you,
}: {
  skill: TrainingSkill;
  level: number;
  game: string;
  draft: AnyLevel;
  onChange: (next: AnyLevel) => void;
  onPlay: () => void;
  onSave: () => void;
  onCommit: () => void;
  onReset: () => void;
  onClose: () => void;
  status: EditorStatus | null;
  busy: boolean;
  /** This level has a saved edit on top of the committed file. */
  savedHere: boolean;
  you: number;
}) {
  const row = draft as unknown as Record<string, number | boolean | undefined>;
  const saved = levelConfig(skill, level) as unknown as Record<string, number | boolean | undefined>;
  const committed = committedLevel(skill, level) as unknown as Record<string, number | boolean | undefined>;
  const builtIn = defaultLevel(skill, level) as unknown as Record<string, number | boolean | undefined>;
  const dirty = JSON.stringify(draft) !== JSON.stringify(levelConfig(skill, level));
  const set = (key: string, v: number | boolean | undefined) => {
    const next: Record<string, unknown> = { ...row, [key]: v };
    if (v === undefined) delete next[key];
    onChange(next as unknown as AnyLevel);
  };

  return (
    <Panel title={`Edit level ${level}: ${game}`} note={dirty ? "Unsaved changes" : savedHere ? "Saved edit" : "As committed"}>
      <div className="tr-ed" data-testid="level-editor">
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
          <span className="tr-ed-name">Layout{row.seed !== saved.seed && <i> •</i>}</span>
          <span className="tr-ed-pills">
            <Pill on={row.seed === undefined} onClick={() => set("seed", undefined)}>Level&apos;s own</Pill>
            <Pill on={row.seed !== undefined} onClick={() => set("seed", Math.floor(Math.random() * 2 ** 31))}>
              {row.seed !== undefined ? `Shuffled #${String(row.seed).slice(-4)}` : "Shuffle"}
            </Pill>
          </span>
        </div>
        <Note>
          {skill === "power" && you < 100
            ? `Power is eased toward your Power when it is below the level. Set Your skills to 100 to play these numbers exactly. `
            : ""}
          The layout is where everyone stands; Shuffle picks a new one, Level&apos;s own goes back.
        </Note>
        {JSON.stringify(builtIn) !== JSON.stringify(committed) && <Note>This level&apos;s committed numbers differ from the built-in curve.</Note>}
        {status && <div className="tr-ed-status" data-tone={status.tone} role="status">{status.text}</div>}
        <div className="tr-ed-btns">
          <Btn main onClick={onPlay} disabled={busy}>▶ Play</Btn>
          <Btn onClick={onSave} disabled={busy}>Save</Btn>
          <Btn onClick={onCommit} disabled={busy}>Commit</Btn>
        </div>
        <div className="tr-ed-btns">
          <Btn onClick={() => onChange(levelConfig(skill, level))} disabled={busy || !dirty}>Undo changes</Btn>
          <Btn onClick={onReset} disabled={busy || !savedHere} title="Delete the saved edit: the level plays as committed">Back to committed</Btn>
          <Btn onClick={onClose}>Done</Btn>
        </div>
      </div>
      <Label>{dirty ? "▶ Play uses these numbers before you save" : "Playing uses the saved numbers"}</Label>
    </Panel>
  );
}
