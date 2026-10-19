/**
 * app/admin/sound-board/page.tsx
 *
 * The Sound Board — every game sound, with a play button, where it plays, and
 * an upload to replace it. Gated like the other admin pages: a server
 * component that checks the session and isAdmin() and redirects everyone else.
 */

import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import SoundBoard from "./SoundBoard";
import PageGuide from "@/components/admin/PageGuide";
import { BroadcastPage } from "@/components/admin/broadcast/BroadcastPage";

export const metadata: Metadata = {
  title: "Sound Board",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function SoundBoardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth?next=/admin/sound-board");
  if (!(await isAdmin(user.id))) redirect("/");

  return (
    <BroadcastPage title="Sound Board" sub="Every game sound. Tap ▶ to listen. Replace uploads a new one; the game uses it from the next load.">
      <SoundBoard />
      <PageGuide page="/admin/sound-board" />
    </BroadcastPage>
  );
}
