"use client";
/**
 * components/admin/broadcast — THE frame for every Road to Ballon d'Or admin
 * and test page (look C, Harry 19 Oct 2026). A page wraps itself in
 * <BroadcastPage title="…" sub="…"> and builds from <Panel>, <Btn>, <Pill>;
 * it then has the look on a computer and a phone without styling anything.
 * scripts/admin-look-guard.mjs lists pages that are not on it yet, and fails a
 * NEW page that skips it (Harry: "on making a new admin page how do we keep up
 * the look").
 */
import "./broadcast.css";
import Link from "next/link";
import type { ReactNode } from "react";

export function BroadcastPage({ title, sub, back = "/admin/star", actions, width = 1400, children }: {
  title: string;
  /** One short line under the title. */
  sub?: ReactNode;
  /** Where ← goes: a link, a function, or null for none. Default: the admin home. */
  back?: string | (() => void) | null;
  /** Buttons at the right of the title. */
  actions?: ReactNode;
  width?: number;
  children: ReactNode;
}) {
  return (
    <div className="bc" data-broadcast-page>
      <div className="bc-inner" style={{ maxWidth: width }}>
        <div className="bc-head">
          {typeof back === "string" && <Link href={back} className="bc-back" aria-label="Back" title="Back">←</Link>}
          {typeof back === "function" && <button onClick={back} className="bc-back" aria-label="Back" title="Back">←</button>}
          <div className="bc-banner"><h1>{title}</h1>{sub && <p>{sub}</p>}</div>
          {actions && <div className="bc-actions">{actions}</div>}
        </div>
        {children}
      </div>
    </div>
  );
}

/** A panel with a slanted TV-bar title. */
export function Panel({ title, note, children, style }: { title?: ReactNode; note?: ReactNode; children: ReactNode; style?: React.CSSProperties }) {
  return (
    <section className="bc-panel" style={style}>
      {title && <div className="bc-ph"><h2>{title}</h2>{note && <span>{note}</span>}</div>}
      <div className="bc-pb">{children}</div>
    </section>
  );
}

/** Panels side by side on a computer, stacked on a phone. */
export function PanelGrid({ min = 320, children }: { min?: number; children: ReactNode }) {
  return <div className="bc-grid" style={{ gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, ${min}px), 1fr))` }}>{children}</div>;
}

export function Btn({ children, onClick, href, main, disabled, title }: {
  children: ReactNode; onClick?: () => void; href?: string; main?: boolean; disabled?: boolean; title?: string;
}) {
  if (href) return <Link href={href} className="bc-btn" data-main={main ? "true" : undefined} title={title}>{children}</Link>;
  return <button className="bc-btn" data-main={main ? "true" : undefined} onClick={onClick} disabled={disabled} title={title}>{children}</button>;
}

export function Pill({ on, onClick, children, title }: { on: boolean; onClick: () => void; children: ReactNode; title?: string }) {
  return <button className="bc-pill" aria-pressed={on} onClick={onClick} title={title}>{children}</button>;
}

export function Label({ children }: { children: ReactNode }) { return <div className="bc-label">{children}</div>; }
export function Note({ children }: { children: ReactNode }) { return <div className="bc-note">{children}</div>; }
