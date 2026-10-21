/**
 * The Marketing tab's own switch (Harry, 21 Oct 2026; docs/plans/
 * 2026-10-21-marketing-production.md piece 1): Board | Client now; Calendar,
 * Suite, Uploads and Scripts arrive in later slices and are shown as "Soon".
 */
import Link from "next/link";
import "./marketing.css";

export type MarketingView = "board" | "client";
const VIEWS: { key: MarketingView | null; label: string; href?: string }[] = [
  { key: "board", label: "Board", href: "/admin/marketing" },
  { key: "client", label: "Client", href: "/admin/marketing/client" },
  { key: null, label: "Calendar" },
  { key: null, label: "Suite" },
  { key: null, label: "Uploads" },
  { key: null, label: "Scripts" },
];

export default function MarketingTabs({ view }: { view: MarketingView }) {
  return (
    <nav className="mk-tabs" aria-label="Marketing">
      {VIEWS.map((v) => v.href ? (
        <Link key={v.label} href={v.href} className="mk-tab" aria-current={v.key === view ? "page" : undefined}>{v.label}</Link>
      ) : (
        <span key={v.label} className="mk-tab" data-soon="true" title={`${v.label}: coming in a later slice`}>{v.label} <small>Soon</small></span>
      ))}
    </nav>
  );
}
