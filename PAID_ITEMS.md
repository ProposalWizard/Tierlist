# Paid items and gems — the rule

Harry, 7 Oct 2026: *"we are DEFINITELY going to have paid items … ideally
everything is safe."*

The star career save is worked out on the player's device and sent to the
server as it is. Anyone with browser dev tools can change it: money, skills,
trophies. That is fine for the free game. It is never fine for anything bought
with real money.

## The rule

1. **Gems and paid items live only in the database**, in four tables made by
   `supabase/migrations/star_wallet.sql`:

   | Table | Holds |
   |-------|-------|
   | `star_paid_items` | What can be bought with gems, and the price. The price is always read from here. |
   | `star_wallet` | Each account's gem balance. Moves only when a ledger row is added. |
   | `star_wallet_ledger` | Every gem change ever. Never edited; a mistake gets a new `correction` row. |
   | `star_entitlements` | What each account owns (one row per account + item). |

2. **Nobody writes these from a browser.** Players can read their own rows.
   Every change goes through a database function:
   - `spend_gems(item, key, price seen)` — a signed-in player buys an item.
   - `grant_gems(user, amount, reason, key)` — server only (payments, admin).
   - `grant_item(user, item, source)` — server only (an item bought directly).
3. **Never put gems or paid items in the career save** (`CareerState`,
   `lib/star/types.ts`) or in localStorage. `tests/star/wallet.mts` fails if
   the save grows a `gems` or `entitlements` field, or if the wallet code
   touches browser storage.
4. **Match money (★, `career.money`) can never buy a paid item.** It lives in
   the save, so it can be faked. The buy route takes an item and a key, nothing
   else.
5. **The game asks the server.** To check whether a player owns something, use
   `ownsPaidItem(id)` or `useWallet()` (`lib/star/wallet.ts`,
   `lib/star/useWallet.ts`). Never a save field. Signed out = owns nothing.

## Adding a paid item

1. Add a row to `star_paid_items` (Supabase SQL Editor, or a new migration):
   ```sql
   INSERT INTO star_paid_items (item_id, name, kind, gem_price)
   VALUES ('gold-kit-2027', 'Gold kit 2027', 'cosmetic', 300);
   ```
   `item_id`: lower case, digits and dashes. To stop selling it, set
   `active = false` — never delete it (people who own it keep it).
2. In the game, show it when `ownsPaidItem('gold-kit-2027')` is true. Buy it
   with `buyPaidItem(item)` (the item comes from the wallet's `catalogue`).
3. Test it on `/star-wallet-dev` (Admin menu → Star Career → Gems (test)).

Changing a price: update `gem_price`. Anyone who saw the old price and taps Buy
is told the price changed and charged nothing.

## Where real payments plug in

`app/api/star/wallet/webhook/route.ts`. Today it refuses everything, so the
only source of gems is the admin test button. When a provider is chosen
(Apple, Google or Stripe), that route must:

1. Prove the message came from the store (Stripe signature; Apple's signed
   JWS; Google's Pub/Sub token plus a Play Developer API lookup).
2. Take the account from what we attached when the purchase started, never
   from the message body.
3. Map the store's product id to gems on the server ("gems_500" → 500).
4. Call `grant_gems(user, amount, 'purchase', '<provider>:<transaction id>')`
   with the service key. The transaction id as the key means a repeated
   message adds nothing.
5. Answer 200 only after the grant is written.

Still to write with the provider: refunds (`revoke_gems`, a negative `refund`
ledger row), the "buy gems" screen, the product-id → gems table, and the
provider's secret in Vercel.

## Before real money: Coins

The test store's **Coins** (`career.coins`, `lib/star/store/`) are in the save,
so they can be faked today. Before Coins are ever sold for real money, either
replace them with gems or move them into these tables. Do not sell Coins as
they are.

## What Mikey runs

`supabase/migrations/star_wallet.sql` in the Supabase SQL Editor (safe to
re-run). Then the verify queries at the bottom of that file. Until it runs,
everything says "Gems aren't switched on yet" and nothing else breaks.
