import { NextResponse } from "next/server";

/**
 * POST /api/star/wallet/webhook — WHERE REAL-MONEY PAYMENTS WILL ARRIVE.
 *
 * Not switched on: it refuses everything, so nothing can make gems through
 * it. No payment provider is chosen yet (Apple, Google or Stripe).
 *
 * When one is chosen, this route is the ONLY place that turns a payment into
 * gems or an item. The order, for every provider:
 *
 *   1. Prove the message really came from the store, before reading it:
 *        Stripe  — check the `Stripe-Signature` header against
 *                  STRIPE_WEBHOOK_SECRET (stripe.webhooks.constructEvent on
 *                  the RAW body, not parsed JSON).
 *        Apple   — App Store Server Notifications v2: verify the
 *                  signedPayload JWS against Apple's certificate chain, and
 *                  check the bundle id and environment.
 *        Google  — Real-time developer notifications arrive through Pub/Sub:
 *                  verify the push's OIDC token, then look the purchase up
 *                  with the Play Developer API (purchases.products.get) using
 *                  a service account; never trust the notification alone.
 *   2. Work out WHO paid: the account id put on the checkout / the app's
 *      appAccountToken / obfuscatedAccountId when the purchase started.
 *      Never an id a player typed into the message.
 *   3. Work out WHAT was paid for from the store's own product id, mapped on
 *      the server (e.g. "gems_500" → 500 gems). Never an amount in the body.
 *   4. Call the database with the SERVICE key:
 *        grant_gems(user, amount, 'purchase', '<provider>:<transaction id>')
 *      or, for an item sold directly for money,
 *        grant_item(user, item_id, 'purchase').
 *      The transaction id as the key means a store re-sending the same
 *      message adds nothing the second time.
 *   5. Refunds: add a ledger row with reason 'refund' (a negative amount).
 *      That needs one more service-only function (revoke_gems), written with
 *      the provider; it does not exist yet.
 *   6. Answer 200 only once the grant has been written, so the store retries
 *      if anything failed.
 *
 * See PAID_ITEMS.md.
 */

export const dynamic = "force-dynamic";

function refuse() {
  return NextResponse.json(
    { ok: false, error: "Payments aren't switched on yet. This address accepts nothing until a payment provider is set up." },
    { status: 501 },
  );
}

export async function POST() { return refuse(); }
export async function GET() { return refuse(); }
export async function PUT() { return refuse(); }
