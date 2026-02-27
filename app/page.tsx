/**
 * app/page.tsx
 * Root route – redirects authenticated users to the default
 * tierlist topic, otherwise to the auth page.
 */

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    // Send logged-in users straight to the demo topic
    redirect("/tierlist/premier-league-2024");
  } else {
    redirect("/auth");
  }
}
