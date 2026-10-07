import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { GEMS_OFF_MESSAGE, walletDbMissing } from "@/lib/star/wallet";

/**
 * GET /api/star/wallet — the signed-in account's gems, what it owns, and the
 * paid catalogue. Read straight from the database (supabase/migrations/
 * star_wallet.sql), with the player's own sign-in: the tables only let a
 * player read their own rows, and nobody write them from here.
 *
 * Answers { gems, owned: [item ids], catalogue: [{ id, name, kind, price }] }.
 * Signed out: { signedOut: true, gems: 0, owned: [], catalogue }.
 * Before the migration: { migrationMissing: true, message } — the game says
 * "Gems aren't switched on yet" and nothing else breaks.
 *
 * Nothing here comes from the career save. See PAID_ITEMS.md.
 */

export const dynamic = "force-dynamic";

interface ItemRow { item_id: string; name: string; kind: string; gem_price: number }

export async function GET() {
  const supabase = await createClient();

  const items = await supabase
    .from("star_paid_items")
    .select("item_id, name, kind, gem_price")
    .eq("active", true)
    .order("gem_price", { ascending: true });
  if (items.error) {
    if (walletDbMissing(items.error)) return NextResponse.json({ migrationMissing: true, message: GEMS_OFF_MESSAGE });
    return NextResponse.json({ error: "Could not read the paid items." }, { status: 500 });
  }
  const catalogue = ((items.data ?? []) as ItemRow[]).map(r => ({ id: r.item_id, name: r.name, kind: r.kind, price: r.gem_price }));

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ signedOut: true, gems: 0, owned: [], catalogue });

  const [wallet, ents] = await Promise.all([
    supabase.from("star_wallet").select("gems").eq("user_id", user.id).maybeSingle(),
    supabase.from("star_entitlements").select("item_id").eq("user_id", user.id),
  ]);
  if (wallet.error || ents.error) {
    if (walletDbMissing(wallet.error) || walletDbMissing(ents.error)) {
      return NextResponse.json({ migrationMissing: true, message: GEMS_OFF_MESSAGE });
    }
    return NextResponse.json({ error: "Could not read your gems." }, { status: 500 });
  }
  return NextResponse.json({
    gems: Number((wallet.data as { gems?: number | string } | null)?.gems ?? 0),
    owned: ((ents.data ?? []) as { item_id: string }[]).map(r => r.item_id),
    catalogue,
  });
}
