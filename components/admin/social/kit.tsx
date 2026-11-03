"use client";
/**
 * The Social Studio's small parts (/admin/social): inputs, a list editor,
 * the confirm box and the shared context every tab reads.
 */
import { createContext, useContext, type ReactNode } from "react";
import type { CareerState } from "@/lib/star/types";
import type { MediaAccount, MediaState } from "@/lib/star/media/types";
import type { AccountRow } from "@/lib/star/media/studioTools";

export interface StudioCtx {
  career: CareerState;
  media: MediaState;
  /** Change the media part of the save. Saved at once; Undo puts it back. */
  apply: (label: string, f: (m: MediaState) => MediaState) => void;
  /** Ask first (and offer a backup) before something that can't be got back without Undo. */
  confirm: (title: string, body: string, run: () => void) => void;
  flash: (msg: string) => void;
  /** Every account, as it looks now. */
  rows: AccountRow[];
  /** The cast that posts (studio changes applied), for pickers. */
  accounts: MediaAccount[];
  /** Show this tab in the phone (the preview follows what you are doing). */
  setPhoneTab?: (t: "feed" | "moment") => void;
}

export const Ctx = createContext<StudioCtx | null>(null);
export function useStudio(): StudioCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useStudio outside the Social Studio");
  return c;
}

export function Field({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return <label className="ss-field" style={wide ? { gridColumn: "1 / -1" } : undefined}><span>{label}</span>{children}</label>;
}

export function Text({ value, onChange, placeholder, mono }: { value: string; onChange: (v: string) => void; placeholder?: string; mono?: boolean }) {
  return <input className={`ss-input${mono ? " ss-mono" : ""}`} value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)} />;
}

export function Num({ value, onChange, min, max, step }: { value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number }) {
  return (
    <input className="ss-input" type="number" value={Number.isFinite(value) ? value : 0} min={min} max={max} step={step ?? 1}
      onChange={e => { const n = Number(e.target.value); onChange(Number.isFinite(n) ? n : 0); }} />
  );
}

export function Check({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  return <label className="ss-check"><input type="checkbox" checked={value} onChange={e => onChange(e.target.checked)} />{label}</label>;
}

export function Select<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <select className="ss-select" value={value} onChange={e => onChange(e.target.value as T)}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

export function Colour({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <span className="ss-row" style={{ flexWrap: "nowrap" }}>
      <input type="color" value={/^#[0-9a-f]{6}$/i.test(value) ? value : "#2563eb"} onChange={e => onChange(e.target.value)}
        style={{ width: 38, height: 34, border: 0, background: "transparent", padding: 0 }} />
      <input className="ss-input ss-mono" value={value} onChange={e => onChange(e.target.value)} />
    </span>
  );
}

/** A list of rows, each with the same fields, plus "+ Add" and ✕ on each. */
export function RowsEditor<T>({ rows, onChange, blank, render, addLabel = "+ Add" }: {
  rows: T[];
  onChange: (rows: T[]) => void;
  blank: () => T;
  render: (row: T, set: (row: T) => void, i: number) => ReactNode;
  addLabel?: string;
}) {
  return (
    <div className="ss-rows">
      {rows.map((r, i) => (
        <div key={i} className="ss-rowline">
          {render(r, next => onChange(rows.map((x, k) => (k === i ? next : x))), i)}
          <button type="button" className="ss-x" title="Remove" onClick={() => onChange(rows.filter((_, k) => k !== i))}>✕</button>
        </div>
      ))}
      <div><button type="button" className="bc-btn" onClick={() => onChange([...rows, blank()])}>{addLabel}</button></div>
    </div>
  );
}

/** A file download from text. */
export function download(name: string, text: string, type = "application/json") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Ask for a file and read it as text. */
export function pickFile(accept = ".json,application/json"): Promise<string | null> {
  return new Promise(res => {
    const input = document.createElement("input");
    input.type = "file"; input.accept = accept;
    input.onchange = () => {
      const f = input.files?.[0];
      if (!f) { res(null); return; }
      f.text().then(res, () => res(null));
    };
    input.click();
  });
}

/** "S2 W14 · 3h after" — the feed clock in words. */
export function clockLabel(at: number): string {
  const season = Math.floor(at / 1_000_000), week = Math.floor((at % 1_000_000) / 10_000), min = at % 10_000;
  const when = min >= 9_000 ? "late in the week" : min >= 1440 ? `${Math.round(min / 1440)}d after` : min >= 60 ? `${Math.round(min / 60)}h after` : `${min}m after`;
  return `S${season} W${week} · ${when}`;
}

export const fmt = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(1)}K` : String(n));
