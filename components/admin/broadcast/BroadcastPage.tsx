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
import "./skins.css";
import Link from "next/link";
import { useRef, type ReactNode } from "react";
import { useInkGuard } from "./inkGuard";
import BackArrow from "@/components/admin/BackArrow";
import { useAdminLook } from "@/lib/adminLook";

/**
 * The frame follows the admin Look (Harry, 20 Oct 2026: "everything to look
 * the same, but with a different kind of skin"): same layout in every look,
 * only colours, fonts, corners and surfaces change (skins.css). The title bar
 * runs the full width so the back arrow is always in the top-left corner.
 */
export function BroadcastPage({ title, sub, back, actions, width = 1400, children }: {
  title: string;
  /** One short line under the title. */
  sub?: ReactNode;
  /** Where the back arrow goes: a link, or a function for a screen inside the
   *  page. Default: the page's group (lib/adminRegistry.ts backFor). null =
   *  none (only for a game screen that draws its own back in that corner). */
  back?: string | (() => void) | null;
  /** Buttons at the right of the title. */
  actions?: ReactNode;
  width?: number;
  children: ReactNode;
}) {
  const look = useAdminLook();
  const root = useRef<HTMLDivElement>(null);
  // Light looks: keep every page's own dark tiles and white words readable (inkGuard.ts).
  useInkGuard(root, look === "light" || look === "bento");
  return (
    <div className="bc" data-broadcast-page data-look={look} ref={root}>
      <div className="bc-top">
        <div className="bc-head">
          {back !== null && (typeof back === "function" ? <BackArrow onClick={back} /> : <BackArrow to={back} />)}
          <div className="bc-banner"><h1>{title}</h1>{sub && <p>{sub}</p>}</div>
          {actions && <div className="bc-actions">{actions}</div>}
        </div>
      </div>
      <div className="bc-inner" style={{ maxWidth: width }}>
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
