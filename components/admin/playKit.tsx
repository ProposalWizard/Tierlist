"use client";
/**
 * components/admin/playKit.tsx — the Play Area's look, as one kit for every
 * Road to Ballon d'Or admin and test page (Harry, 19 Oct 2026: "the actual UI
 * of every [admin page] like how the play area looks good — the inside of
 * every area needs work").
 *
 * Lifted from /star-play-dev unchanged: near-black page, one 900 px column,
 * a sticky bold title, one grey line under it, rounded see-through cards,
 * cyan pills, cyan sliders. A page builds itself from these instead of its
 * own colours, so every admin page looks like the same product.
 */
import type { CSSProperties, ReactNode } from "react";

export const KIT = {
  bg: "#05070d",
  ink: "#f2f5f9",
  muted: "#8a97aa",
  card: "rgba(255,255,255,0.04)",
  line: "rgba(255,255,255,0.08)",
  accent: "#38bdf8",
  accentInk: "#e0f2fe",
  num: "#7dd3fc",
} as const;

export const tile: CSSProperties = {
  width: "100%", padding: "14px 15px", borderRadius: 16,
  background: KIT.card, border: `1px solid ${KIT.line}`,
};
export const tileTitle: CSSProperties = { fontSize: 15.5, fontWeight: 900, color: KIT.ink, letterSpacing: "-0.01em" };
export const tileSub: CSSProperties = { fontSize: 12.5, fontWeight: 600, color: KIT.muted, lineHeight: 1.55, marginTop: 4 };

/** The whole page: dark, one centred column, a title bar that stays at the top. */
export function PlayPage({ title, intro, back, width = 900, right, children, headRef }: {
  title: string;
  /** One short grey line under the title. */
  intro?: ReactNode;
  back?: () => void;
  width?: number;
  /** Small controls at the right end of the title bar. */
  right?: ReactNode;
  children: ReactNode;
  headRef?: (el: HTMLElement | null) => void;
}) {
  return (
    <div style={{ minHeight: "100dvh", background: KIT.bg, color: KIT.ink }}>
      <div style={{ maxWidth: width, margin: "0 auto" }}>
        <PlayHeader title={title} back={back} right={right} headRef={headRef} />
        <div style={{ padding: "0 14px 48px", display: "grid", gap: 12 }}>
          {intro && <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: KIT.muted, lineHeight: 1.55 }}>{intro}</p>}
          {children}
        </div>
      </div>
    </div>
  );
}

export function PlayHeader({ title, back, right, pin = true, headRef }: {
  title: string; back?: () => void; right?: ReactNode; pin?: boolean; headRef?: (el: HTMLElement | null) => void;
}) {
  return (
    <div ref={headRef} style={{
      display: "flex", alignItems: "center", gap: 10, padding: "14px 14px 10px",
      position: pin ? "sticky" : "relative", top: 0, background: KIT.bg, zIndex: 5,
    }}>
      {back && (
        <button onClick={back} aria-label="Back" title="Back" style={{
          width: 34, height: 34, borderRadius: 999, flex: "none", cursor: "pointer",
          border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.06)",
          color: KIT.ink, fontSize: 17, fontWeight: 800, lineHeight: 1,
        }}>&#8249;</button>
      )}
      <h1 style={{ margin: 0, fontSize: 19, fontWeight: 900, letterSpacing: "-0.01em", flex: 1, minWidth: 0 }}>{title}</h1>
      {right}
    </div>
  );
}

/** A card with an optional bold title and grey line. */
export function Card({ title, sub, children, style }: { title?: ReactNode; sub?: ReactNode; children?: ReactNode; style?: CSSProperties }) {
  return (
    <section style={{ ...tile, ...style }}>
      {title && <div style={tileTitle}>{title}</div>}
      {sub && <div style={{ ...tileSub, marginBottom: children ? 12 : 0 }}>{sub}</div>}
      {children}
    </section>
  );
}

/** A whole-card button: bold title and grey line, an arrow when it opens something. */
export function CardButton({ title, sub, onClick, disabled, arrow = true }: {
  title: ReactNode; sub?: ReactNode; onClick: () => void; disabled?: boolean; arrow?: boolean;
}) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      ...tile, cursor: disabled ? "not-allowed" : "pointer", textAlign: "left", color: KIT.ink, opacity: disabled ? 0.4 : 1,
    }}>
      <div style={tileTitle}>{title}{arrow && <> &#8594;</>}</div>
      {sub && <div style={tileSub}>{sub}</div>}
    </button>
  );
}

/** A label, a grey hint, then pills (or anything) in a wrapping row. */
export function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: KIT.ink }}>{label}</div>
      {hint && <div style={{ fontSize: 11.5, fontWeight: 600, color: KIT.muted, marginBottom: 6 }}>{hint}</div>}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: hint ? 0 : 6 }}>{children}</div>
    </div>
  );
}

/** The cyan pill: on = picked. */
export function Toggle({ on, onClick, children, disabled, title }: {
  on: boolean; onClick: () => void; children: ReactNode; disabled?: boolean; title?: string;
}) {
  return (
    <button onClick={onClick} disabled={disabled} title={title} style={{
      padding: "7px 12px", borderRadius: 999, cursor: disabled ? "not-allowed" : "pointer", whiteSpace: "nowrap",
      border: `1px solid ${on ? "rgba(56,189,248,0.75)" : "rgba(255,255,255,0.09)"}`,
      background: on ? "rgba(14,116,144,0.4)" : "rgba(255,255,255,0.045)",
      color: on ? KIT.accentInk : KIT.muted, fontSize: 12.5, fontWeight: 800, opacity: disabled ? 0.4 : 1,
    }}>
      {children}
    </button>
  );
}

/** A plain action button: "main" is the one cyan button on a card. */
export function Btn({ children, onClick, main, disabled, title }: {
  children: ReactNode; onClick: () => void; main?: boolean; disabled?: boolean; title?: string;
}) {
  return (
    <button onClick={onClick} disabled={disabled} title={title} style={{
      padding: "9px 14px", borderRadius: 12, cursor: disabled ? "not-allowed" : "pointer", whiteSpace: "nowrap",
      border: main ? "0" : "1px solid rgba(255,255,255,0.1)",
      background: main ? KIT.accent : "rgba(255,255,255,0.06)",
      color: main ? "#03131d" : KIT.ink, fontSize: 13, fontWeight: 800, opacity: disabled ? 0.4 : 1,
    }}>
      {children}
    </button>
  );
}

export function Slider({ label, hint, value, range, step = 1, onChange }: {
  label: string; hint?: string; value: number;
  range: readonly [number, number]; step?: number; onChange: (v: number) => void;
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: KIT.ink }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 800, color: KIT.num, fontFamily: "ui-monospace, monospace" }}>
          {value.toLocaleString()}
        </span>
      </div>
      {hint && <div style={{ fontSize: 11.5, fontWeight: 600, color: KIT.muted, marginBottom: 5 }}>{hint}</div>}
      <input
        type="range"
        min={range[0]} max={range[1]} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: "100%", accentColor: KIT.accent }}
      />
    </div>
  );
}

/** A small grey note under a card's controls. */
export function Note({ children }: { children: ReactNode }) {
  return <div style={{ fontSize: 11.5, fontWeight: 600, color: KIT.muted, lineHeight: 1.5 }}>{children}</div>;
}
