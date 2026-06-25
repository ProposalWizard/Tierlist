import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import DraftDevClient from "./DraftDevClient";

export default async function DraftDevPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !(await isAdmin(user.id))) redirect("/");
  return <DraftDevClient />;
}
