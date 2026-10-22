/**
 * The Marketing tab's own switch (Harry, 21 Oct 2026; docs/plans/
 * 2026-10-21-marketing-production.md piece 1): Board | Client | Studio | Uploads
 * (slice 2, 22 Oct); Calendar and Scripts arrive in later slices and are shown as "Soon".
 */
import Link from "next/link";
import "./marketing.css";

export type MarketingView = "board" | "client" | "studio" | "uploads";
const VIEWS: { key: MarketingView | null; label: string; href?: string }[] = [
  { key: "board", label: "Board", href: "/admin/marketing" },
  { key: "client", label: "Client", href: "/admin/marketing/client" },
  { key: "studio", label: "Studio", href: "/admin/marketing/studio" },
  { key: "uploads", label: "Uploads", href: "/admin/marketing/uploads" },
  { key: null, label: "Calendar" },
  { key: null, label: "Scripts" },
];

export default function MarketingTabs({ view }: { view: MarketingView }) {
  return (
    <nav className="mk-tabs" aria-label="Marketing">
      {VIEWS.filter((v) => v.href).map((v) => (
        <Link key={v.label} href={v.href!} className="mk-tab" aria-current={v.key === view ? "page" : undefined}>{v.label}</Link>
      ))}
      <span className="mk-soon" title="Coming in later slices of the plan">Soon: {VIEWS.filter((v) => !v.href).map((v) => v.label).join(" · ")}</span>
    </nav>
  );
}
