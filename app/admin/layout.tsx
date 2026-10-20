/**
 * app/admin/layout.tsx
 *
 * Wraps every /admin page in `admin-touch`, which (on a phone only) makes
 * buttons finger-sized and stops iPhone zooming into text boxes — see
 * admin-touch.css. `contents` means the wrapper has no box of its own, so
 * every page lays out exactly as it did before. Adds no gate: each page keeps
 * its own admin check.
 *
 * Add to Home Screen opens the admin room as its own app, "KIB Admin"
 * (Harry, 19 Oct 2026, icon option C), the same way the game does it
 * (app/star-dev/layout.tsx). Opens at /admin/home, which sends an admin to the
 * Team board and a tester to their game home (Harry, 20 Oct 2026); scope "/"
 * so test pages opened from it stay inside the app. Icons: scripts/admin-app/make-icons.cjs.
 */
import type { Metadata } from "next";
import "./admin-touch.css";

export const metadata: Metadata = {
  manifest: "/admin-app.webmanifest",
  appleWebApp: { capable: true, title: "KIB Admin", statusBarStyle: "black" },
  icons: { apple: "/admin/app-icon-180.png" },
  other: { "mobile-web-app-capable": "yes" },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className="admin-touch contents">{children}</div>;
}
