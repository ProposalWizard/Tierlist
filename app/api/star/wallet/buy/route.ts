import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { GEMS_OFF_MESSAGE, IDEM_KEY, PAID_ITEM_ID, walletDbMissing } from "@/lib/star/wallet";

/**
 * POST /api/star/wallet/buy  { item_id, idem_key, expected_price? }
 *
 * Buys one paid item with gems by calling the database function spend_gems
 * (supabase/migrations/star_wallet.sql) AS THE SIGNED-IN PLAYER. That
 * function does all of it in one go: reads the price from star_paid_items
 * (never from this request), checks the balance, writes the ledger row and
 * the entitlement. The same idem_key twice charges once.
 *
 * `expected_price` is only "the price I saw": if the catalogue has changed,
 * nothing is charged and the answer says `price-changed`.
 *
 * Match money (★) is not accepted here, and nothing in the career save is
 * read. Answers { ok: true, gems, alreadyOwned?, replay? } or
 * { ok: false, code, gems?, price? }.
 */

export const dynamic = "force-dynamic";

const KNOWN = new Set(["signed-out", "not-for-sale", "price-changed", "not-enough-gems", "bad-key"]);

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, code: "signed-out" }, { status: 401 });

  let body: { item_id?: unknown; idem_key?: unknown; expected_price?: unknown } | null = null;
  try { body = await req.json(); } catch { /* handled below */ }
  const itemId = typeof body?.item_id === "string" ? body.item_id : "";
  const key = typeof body?.idem_key === "string" ? body.idem_key : "";
  const ep = body?.expected_price;
  const expected = typeof ep === "number" && Number.isInteger(ep) && ep > 0 ? ep : null;
  if (!PAID_ITEM_ID.test(itemId)) return NextResponse.json({ ok: false, code: "bad-item" }, { status: 400 });
  if (!IDEM_KEY.test(key)) return NextResponse.json({ ok: false, code: "bad-key" }, { status: 400 });

  const { data, error } = await supabase.rpc("spend_gems", {
    p_item_id: itemId,
    p_idem_key: key,
    p_expected_price: expected,
  });
  if (error) {
    if (walletDbMissing(error)) return NextResponse.json({ ok: false, code: "off", message: GEMS_OFF_MESSAGE }, { status: 503 });
    return NextResponse.json({ ok: false, code: "error" }, { status: 500 });
  }

  const r = (data ?? {}) as { ok?: boolean; error?: string; gems?: number; price?: number; replay?: boolean; already_owned?: boolean };
  if (r.ok) {
    return NextResponse.json({ ok: true, gems: r.gems ?? 0, alreadyOwned: r.already_owned === true, replay: r.replay === true });
  }
  const code = r.error && KNOWN.has(r.error) ? r.error : "error";
  const status = code === "not-enough-gems" || code === "price-changed" ? 409 : code === "not-for-sale" ? 404 : 400;
  return NextResponse.json({ ok: false, code, gems: r.gems, price: r.price }, { status });
}
