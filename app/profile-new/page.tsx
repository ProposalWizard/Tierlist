import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ProfileNewClient from "./ProfileNewClient";

export const metadata = { title: "Profile — KnowItBall" };

export default async function ProfileNewPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth?next=/profile-new");

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("username, current_streak, longest_streak, is_anonymous")
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <ProfileNewClient
      userId={user.id}
      profile={
        profile ?? {
          username: null,
          current_streak: 0,
          longest_streak: 0,
          is_anonymous: false,
        }
      }
    />
  );
}
