/**
 * app/admin/marketing/suite/page.tsx — the editing suite (Harry, 22 Oct 2026;
 * docs/plans/2026-10-21-marketing-production.md, piece 4). Admins only (the
 * Marketing layout's DevGate). ?key=<video key> opens one cut.
 */
import type { Metadata } from "next";
import AdminShell from "@/components/admin/shell/AdminShell";
import { BroadcastPage } from "@/components/admin/broadcast/BroadcastPage";
import PageGuide from "@/components/admin/PageGuide";
import MarketingTabs from "@/components/admin/marketing/MarketingTabs";
import SuiteBrowser from "@/components/admin/marketing/SuiteBrowser";
import { parseBoard } from "@/lib/marketing/board";
import bundledBoard from "@/marketing/board.json";

export const metadata: Metadata = { title: "Marketing · Suite", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default function MarketingSuitePage({ searchParams }: { searchParams: { key?: string } }) {
  const cards = parseBoard(bundledBoard).map((c) => ({ id: c.id, title: c.title }));
  const key = typeof searchParams.key === "string" && searchParams.key ? searchParams.key : null;
  return (
    <>
      <AdminShell tab="home" role="admin" game="marketing" group="marketing">
        <BroadcastPage title="Editing suite" sub="Watch a cut, leave notes, tell Claude what to change" back={null} width={1600}>
          <MarketingTabs view="suite" />
          <SuiteBrowser initialKey={key} cards={cards} />
        </BroadcastPage>
      </AdminShell>
      <PageGuide page="/admin/marketing/suite" />
    </>
  );
}
