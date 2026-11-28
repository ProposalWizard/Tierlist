/**
 * app/api/account/delete/route.ts
 *
 * POST /api/account/delete  { confirm: "DELETE" }
 *
 * Deletes the signed-in user's account and everything linked to it (Apple App
 * Store rule 5.1.1(v): an app with sign-in must let people delete their
 * account inside the app). Only ever deletes the caller: the id comes from the
 * session cookie, never from the request body.
 *
 * Steps: their tierlists (and images), rows whose links to the user have no
 * ON DELETE rule, then the auth user itself. Every other table references
 * auth.users with ON DELETE CASCADE, so those rows go with the user.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  if (body?.confirm !== "DELETE") {
    return NextResponse.json({ error: "Type DELETE to confirm" }, { status: 400 });
  }

  const svc = createServiceClient();
  const id = user.id;

  // Rows that block deleting the user (foreign key with no ON DELETE rule).
  await svc.from("tictactoe_scores").delete().eq("user_id", id);
  await svc.from("tictactoe_difficulty_ratings").delete().eq("user_id", id);
  await svc.from("tictactoe_puzzles").update({ created_by: null }).eq("created_by", id);
  await svc.from("tenable_puzzles").update({ created_by: null }).eq("created_by", id);
  await svc.from("blind_rankings").update({ created_by: null }).eq("created_by", id);

  // Their own tierlists.
  await svc.from("tierlists").delete().eq("created_by", id);

  const { error } = await svc.auth.admin.deleteUser(id);
  if (error) {
    return NextResponse.json({ error: "Could not delete the account. Email knowitballcontact@gmail.com and we will do it." }, { status: 500 });
  }

  await supabase.auth.signOut().catch(() => {});
  const res = NextResponse.json({ ok: true });
  res.cookies.set("has-username", "", { path: "/", maxAge: 0 });
  return res;
}
