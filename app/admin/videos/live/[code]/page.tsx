/**
 * /admin/videos/live/<code> — watch a live share (Admin → Videos → Live share
 * (test)) in a browser: the newest picture and what was said, every 2 s.
 * A Claude chat doesn't use this page; it runs scripts/live-watch.mts <code>.
 * Admins only (layout.tsx).
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import AdminShell from "@/components/admin/shell/AdminShell";
import PageGuide from "@/components/admin/PageGuide";
import { parseLiveCode } from "@/lib/liveShare";
import { liveStore } from "@/lib/liveShareStore";
import LiveViewer from "./LiveViewer";
import "../../videos.css";

export const metadata: Metadata = { title: "Live share", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default function LivePage({ params }: { params: { code: string } }) {
  const code = parseLiveCode(params.code);
  if (!code) notFound();
  const base = liveStore()?.readBase("") ?? null;
  return (
    <AdminShell tab="videos" role="admin">
      <LiveViewer code={code} base={base} />
      <PageGuide page="/admin/videos/live" />
    </AdminShell>
  );
}
