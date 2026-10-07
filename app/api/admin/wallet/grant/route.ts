import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isAdmin } from "@/lib/admin";
import { GEMS_OFF_MESSAGE, IDEM_KEY, walletDbMissing } from "@/lib/star/wallet";

/**
 * POST /api/admin/wallet/grant  { amount, idem_key, user_id? }
 *
 * Admins only. Gives gems for testing, until a payment provider exists.
 * Without `user_id` the gems go to the admin who asked. Calls the database's
 * service-only grant_gems (supabase/migrations/star_wallet.sql) with reason
 * 'grant' and the key 'admin:<idem_key>', so the same request twice gives
 * once. Every grant is a row in star_wallet_ledger: who, how many, when.
 *
 * Answers { ok: true, gems } (the new balance) or { error }.
 */

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_GRANT = 100_000;

export async function POST(req: Request) {
  let adminId: string | null = null;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user && (await isAdmin(user.id))) adminId = user.id;
  } catch { adminId = null; }
  if (!adminId) return NextResponse.json({ error: "Admins only" }, { status: 403 });

  let body: { amount?: unknown; idem_key?: unknown; user_id?: unknown } | null = null;
  try { body = await req.json(); } catch { /* handled below */ }
  const amount = typeof body?.amount === "number" && Number.isInteger(body.amount) ? body.amount : 0;
  const key = typeof body?.idem_key === "string" ? body.idem_key : "";
  const target = typeof body?.user_id === "string" && body.user_id ? body.user_id : adminId;
  if (amount < 1 || amount > MAX_GRANT) {
    return NextResponse.json({ error: `Give between 1 and ${MAX_GRANT.toLocaleString("en-GB")} gems.` }, { status: 400 });
  }
  if (!IDEM_KEY.test(key)) return NextResponse.json({ error: "Missing or bad idem_key." }, { status: 400 });
  if (!UUID.test(target)) return NextResponse.json({ error: "That isn't an account id." }, { status: 400 });

  const service = createServiceClient();
  const { data, error } = await service.rpc("grant_gems", {
    p_user: target,
    p_amount: amount,
    p_reason: "grant",
    p_idem_key: `admin:${key}`,
  });
  if (error) {
    if (walletDbMissing(error)) {
      return NextResponse.json({ error: `${GEMS_OFF_MESSAGE} Run supabase/migrations/star_wallet.sql.`, migrationMissing: true }, { status: 503 });
    }
    return NextResponse.json({ error: "Could not give the gems." }, { status: 500 });
  }
  const r = (data ?? {}) as { ok?: boolean; error?: string; gems?: number; replay?: boolean };
  if (!r.ok) {
    return NextResponse.json({ error: r.error === "no-such-user" ? "No account with that id." : "Could not give the gems." }, { status: 400 });
  }
  return NextResponse.json({ ok: true, gems: r.gems ?? 0, replay: r.replay === true });
}
