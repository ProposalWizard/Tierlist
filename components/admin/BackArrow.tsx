"use client";
/**
 * THE back arrow on every admin and test page (Harry, 20 Oct 2026: "Always top
 * left … always the same"). One look per admin skin (Broadcast, Bento, Ops
 * room, Clean light), one place: the top-left corner of the page.
 *
 *  - BroadcastPage puts it first in its title bar; the admin shell puts it in
 *    the side menu's top (computer) and the top bar (phone).
 *  - A full-screen page with no frame (the 3D places) uses `floating`: fixed
 *    in the top-left corner over the scene.
 *
 * Where it goes: `to` / `onClick` if the page says; else lib/adminRegistry.ts
 * `backFor` (a page → its group's page; a group → its game's home; a game's
 * home → the Team area, the admin's home; the Team area → the site). The
 * admin shell passes `role`, so a tester's game home goes to the site instead.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { backFor, type AdminRole } from "@/lib/adminRegistry";
import { useAdminLook } from "@/lib/adminLook";
import "./backArrow.css";

export default function BackArrow({ to, onClick, label, floating, role }: {
  /** Where it goes. Default: the page's group (backFor). */
  to?: string;
  /** For a page with screens inside it: go back one screen instead of leaving. */
  onClick?: () => void;
  /** What "Back to …" names on hover. */
  label?: string;
  /** Fixed in the top-left corner, for full-screen pages with no frame. */
  floating?: boolean;
  /** Who is looking (a tester has no Team area). Default: an admin. */
  role?: AdminRole;
}) {
  const look = useAdminLook();
  const path = usePathname() ?? "/admin/star";
  const auto = backFor(path, role);
  const title = `Back to ${label ?? (onClick ? "the last screen" : auto.label)}`;
  const icon = (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M19 12H5M11 5l-7 7 7 7" />
    </svg>
  );
  const common = { className: "kb-back", "data-look": look, "data-floating": floating ? "true" : undefined, "aria-label": title, title, "data-back-arrow": true };
  if (onClick) return <button type="button" onClick={onClick} {...common}>{icon}</button>;
  return <Link href={to ?? auto.href} {...common}>{icon}</Link>;
}
