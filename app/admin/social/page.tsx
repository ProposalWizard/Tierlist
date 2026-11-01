"use client";
/**
 * /admin/social — SOCIAL STUDIO (Leo, 30 Oct 2026): the one place to run the
 * in-game social media on this device's career. The frame is
 * components/admin/broadcast/BroadcastPage (drawn inside SocialStudio); the
 * tools are components/admin/social/. Game hooks: lib/star/media/studio.ts
 * (nothing set = the feed exactly as before).
 */
import PageGuide from "@/components/admin/PageGuide";
import "@/components/admin/broadcast/broadcast.css";
import SocialStudio from "@/components/admin/social/SocialStudio";

export default function SocialStudioPage() {
  return (
    <>
      <SocialStudio />
      <PageGuide page="/admin/social" />
    </>
  );
}
