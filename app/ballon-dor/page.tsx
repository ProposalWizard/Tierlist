import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import BallonDorGame from "@/components/ballon-dor/BallonDorGame";

export const dynamic = "force-dynamic";

export default async function BallonDorPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth?next=/ballon-dor");
  if (!(await isAdmin(user.id))) redirect("/");

  return <BallonDorGame />;
}
