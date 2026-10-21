"use client";
/**
 * A slim top bar for the admin pages that have no frame of their own (the
 * Website games and Studio pages: site content, SoFIFA players, Draft test …).
 * It carries THE back arrow in the same top-left corner as every framed page
 * (Harry, 20 Oct 2026: "Always top left … always the same"), and the page name.
 * DevGate puts it on every listed page outside Road to Ballon d'Or; a page
 * that has the Broadcast frame or the admin shell hides it (backArrow.css),
 * because those carry the arrow themselves. The site's own menu hides on
 * these pages, as on every other admin page.
 */
import BackArrow from "./BackArrow";
import InboxBell from "@/components/teamRoom/InboxBell";
import { useAdminLook } from "@/lib/adminLook";

export default function AdminTopBar({ title }: { title: string }) {
  const look = useAdminLook();
  return (
    <div className="kb-topbar" data-look={look} data-admin-topbar>
      <BackArrow />
      <b className="kb-topbar-t">{title}</b>
      <span className="kb-topbar-k">Admin</span>
      {/* The Inbox: patch notes you haven't read (only shows for Harry, Mikey and Leo). */}
      <InboxBell />
    </div>
  );
}
