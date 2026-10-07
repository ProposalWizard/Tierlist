import { readFileSync } from "node:fs";
import {
  walletFromServer, owns, canAfford, newIdemKey, IDEM_KEY, PAID_ITEM_ID,
  buyResultFromServer, applyBuy, buyProblem, walletDbMissing,
  loadWallet, walletNow, forgetWallet, ownsPaidItem, buyPaidItem, onWallet,
  LOADING_WALLET, GEMS_OFF_MESSAGE, GEMS_SIGN_IN_MESSAGE,
  type WalletSnapshot, type PaidItem,
} from "../../lib/star/wallet";
import { mulberry32 } from "../../lib/star/season";

/**
 * THE GEM WALLET, DEVICE SIDE (Harry, 7 Oct 2026: "we are DEFINITELY going to
 * have paid items … ideally everything is safe"). See lib/star/wallet.ts and
 * supabase/migrations/star_wallet.sql.
 *
 * The database side (spend_gems, grant_gems, the guards) can't run here: no
 * live database. Its checks are reasoned in the migration and confirmed with
 * the verify queries at its bottom once it has run.
 */
const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

const BOOTS: PaidItem = { id: "test-golden-boots", name: "Golden boots (test)", kind: "test", price: 50 };
const CATALOGUE = [{ id: BOOTS.id, name: BOOTS.name, kind: BOOTS.kind, price: 50 }];

// ── Reading the server's answer ─────────────────────────────────────────────
{
  const ok = walletFromServer({ gems: 120, owned: ["test-golden-boots"], catalogue: CATALOGUE });
  check(ok.status === "ok" && ok.gems === 120, "a normal answer reads as it is");
  check(owns(ok, "test-golden-boots") && !owns(ok, "something-else"), "owns only what the list says");
  check(ok.catalogue.length === 1 && ok.catalogue[0].price === 50, "the catalogue comes through");

  check(walletFromServer({ gems: "300", owned: [], catalogue: [] }).gems === 300, "a big balance sent as text still reads");
  check(walletFromServer({ gems: -5, owned: [] }).gems === 0, "a negative balance reads as 0, never more");
  check(walletFromServer({ gems: Infinity, owned: [] }).gems === 0, "a silly balance reads as 0");
  check(walletFromServer({ gems: 12.9, owned: [] }).gems === 12, "part gems round down");
  check(walletFromServer({ gems: 1, owned: ["A_BAD_ID", 7, null, "test-golden-boots", "test-golden-boots"] }).owned.length === 1,
    "odd ids are dropped and repeats collapse");
  check(walletFromServer({ gems: 1, owned: "test-golden-boots" }).owned.length === 0, "owned must be a list");
  check(walletFromServer({ gems: 1, owned: [], catalogue: [{ id: "x-1", price: 0 }, { id: "BAD", price: 10 }, null] }).catalogue.length === 0,
    "a free or badly named item is not in the catalogue");

  const out = walletFromServer({ signedOut: true, gems: 999, owned: ["test-golden-boots"], catalogue: CATALOGUE });
  check(out.status === "signed-out" && out.gems === 0 && out.owned.length === 0, "signed out: no gems and nothing owned, whatever is sent");
  check(out.message === GEMS_SIGN_IN_MESSAGE && out.catalogue.length === 1, "signed out: says sign in, still shows what's for sale");

  const off = walletFromServer({ migrationMissing: true, message: "x" });
  check(off.status === "off" && off.message === GEMS_OFF_MESSAGE && off.gems === 0, "before the migration: \"Gems aren't switched on yet\"");

  const err = walletFromServer({ error: "boom", gems: 50, owned: ["test-golden-boots"] });
  check(err.status === "error" && err.gems === 0 && !owns(err, "test-golden-boots"), "an error answer grants nothing");
  check(walletFromServer({ gems: 50, owned: ["test-golden-boots"] }, false).status === "error", "a failed request grants nothing");
  check(walletFromServer(null).status === "error" && walletFromServer("x").status === "error", "rubbish reads as an error");

  check(!owns(LOADING_WALLET, "test-golden-boots"), "nothing is owned before the server answers");
}

// ── Affording, keys ─────────────────────────────────────────────────────────
{
  const w = walletFromServer({ gems: 49, owned: [] });
  check(!canAfford(w, BOOTS) && canAfford({ ...w, gems: 50 }, BOOTS), "50 gems buys a 50-gem item, 49 doesn't");
  check(!canAfford({ ...w, status: "signed-out", gems: 999 }, BOOTS), "signed out can't afford anything");

  const rng = mulberry32(7);
  const keys = Array.from({ length: 500 }, () => newIdemKey(rng));
  check(keys.every(k => IDEM_KEY.test(k)), "made-up keys have the shape the database accepts");
  check(new Set(keys).size === 500, "keys don't repeat");
  check(IDEM_KEY.test(newIdemKey()), "the real key (crypto) has the shape the database accepts");
  check(PAID_ITEM_ID.test("test-golden-boots") && !PAID_ITEM_ID.test("Golden Boots") && !PAID_ITEM_ID.test("x"), "item ids: the database's shape");
}

// ── Buy answers ─────────────────────────────────────────────────────────────
{
  const good = buyResultFromServer({ ok: true, gems: 70 }, BOOTS.id);
  check(good.ok && good.gems === 70 && !good.alreadyOwned, "a buy that went through");
  const owned = buyResultFromServer({ ok: true, gems: 120, alreadyOwned: true }, BOOTS.id);
  check(owned.ok && owned.alreadyOwned, "already owned: reads as fine, nothing charged");
  const poor = buyResultFromServer({ ok: false, code: "not-enough-gems", gems: 10, price: 50 }, BOOTS.id);
  check(!poor.ok && poor.error === "not-enough-gems" && poor.gems === 10, "not enough gems");
  const odd = buyResultFromServer({ ok: false, code: "give-me-it-free" }, BOOTS.id);
  check(!odd.ok && odd.error === "error", "an unknown answer is a plain failure");
  check(!buyResultFromServer(null, BOOTS.id).ok, "no answer is a failure");
  check(buyProblem("price-changed", 60).includes("60"), "a changed price says the new one");
  check(buyProblem("network").includes("Nothing was charged"), "a dropped connection says nothing was charged");

  const w = walletFromServer({ gems: 120, owned: [] });
  const after = applyBuy(w, good);
  check(after.gems === 70 && owns(after, BOOTS.id), "after a buy: the server's balance, and the item owned");
  const afterFail = applyBuy(w, poor);
  check(afterFail.gems === 10 && !owns(afterFail, BOOTS.id), "a failed buy owns nothing, takes the server's balance");
  check(applyBuy({ ...w, status: "signed-out" }, good).owned.length === 0, "a signed-out wallet never gains an item");
}

// ── The database pieces aren't there yet ───────────────────────────────────
{
  check(walletDbMissing({ code: "42P01" }) && walletDbMissing({ code: "PGRST205" }), "missing table");
  check(walletDbMissing({ code: "PGRST202" }) && walletDbMissing({ code: "42883" }), "missing function");
  check(walletDbMissing({ message: 'relation "star_wallet" does not exist' }), "missing, by its message");
  check(!walletDbMissing({ code: "23505" }) && !walletDbMissing(null), "other errors are not \"missing\"");
}

// ── The live copy: only the server's word counts ────────────────────────────
type Call = { url: string; body?: Record<string, unknown> };
function fakeServer(answers: ((call: Call) => unknown)[]) {
  const calls: Call[] = [];
  let i = 0;
  const fetchImpl = async (url: string, init?: { body?: string }) => {
    const call: Call = { url, body: init?.body ? JSON.parse(init.body) : undefined };
    calls.push(call);
    const a = answers[Math.min(i++, answers.length - 1)](call);
    if (a instanceof Error) throw a;
    return { ok: true, status: 200, json: async () => a };
  };
  return { fetchImpl, calls };
}

{
  // A browser that someone has filled with fake gems and items.
  const fakeStore: Record<string, string> = {
    "star-wallet": JSON.stringify({ gems: 99999, owned: ["test-golden-boots"] }),
    "star-gems": "99999",
    "star-paid-owned": JSON.stringify(["test-golden-boots"]),
  };
  let storageReads = 0;
  (globalThis as Record<string, unknown>).localStorage = {
    getItem: (k: string) => { storageReads++; return fakeStore[k] ?? null; },
    setItem: (k: string, v: string) => { fakeStore[k] = v; },
    removeItem: (k: string) => { delete fakeStore[k]; },
  };
  (globalThis as Record<string, unknown>).sessionStorage = (globalThis as Record<string, unknown>).localStorage;

  forgetWallet();
  check(!ownsPaidItem("test-golden-boots"), "before the server answers: owns nothing, whatever the browser holds");

  const server = fakeServer([() => ({ gems: 20, owned: [], catalogue: CATALOGUE })]);
  const seen: WalletSnapshot[] = [];
  const stop = onWallet(w => seen.push(w));
  const w1 = await loadWallet({ fetchImpl: server.fetchImpl });
  check(w1.gems === 20 && !ownsPaidItem("test-golden-boots"), "the server's 20 gems, not the browser's 99,999");
  check(storageReads === 0, `the wallet never reads this browser's storage (${storageReads} reads)`);
  check(seen.length === 1 && seen[0].gems === 20, "screens are told when it changes");

  await loadWallet({ fetchImpl: server.fetchImpl });
  check(server.calls.length === 1, "a known wallet isn't asked for again unless forced");
  await loadWallet({ fetchImpl: server.fetchImpl, force: true });
  check(server.calls.length === 2, "Refresh asks again");

  // Buy: the connection drops once, then the server answers. The SAME key
  // goes both times, so the server charges once.
  forgetWallet();
  await loadWallet({ fetchImpl: fakeServer([() => ({ gems: 120, owned: [], catalogue: CATALOGUE })]).fetchImpl });
  const buyServer = fakeServer([() => new Error("offline"), () => ({ ok: true, gems: 70 })]);
  const r = await buyPaidItem(BOOTS, { fetchImpl: buyServer.fetchImpl });
  check(r.ok && r.gems === 70, "a buy that survives one dropped connection");
  check(buyServer.calls.length === 2 && buyServer.calls[0].body?.idem_key === buyServer.calls[1].body?.idem_key,
    "a retry sends the same key (charged once)");
  const sent = buyServer.calls[1].body ?? {};
  check(sent.item_id === BOOTS.id && sent.expected_price === 50 && IDEM_KEY.test(String(sent.idem_key)), "sends the item, the key and the price seen");
  check(Object.keys(sent).sort().join(",") === "expected_price,idem_key,item_id", "sends nothing else: no money, no gem count, no career");
  check(ownsPaidItem(BOOTS.id) && walletNow().gems === 70, "owned afterwards, on the server's word");
  check(storageReads === 0, "buying never reads this browser's storage either");

  // A refused buy owns nothing.
  forgetWallet();
  await loadWallet({ fetchImpl: fakeServer([() => ({ gems: 10, owned: [], catalogue: CATALOGUE })]).fetchImpl });
  const refused = await buyPaidItem(BOOTS, { fetchImpl: fakeServer([() => ({ ok: false, code: "not-enough-gems", gems: 10, price: 50 })]).fetchImpl });
  check(!refused.ok && !ownsPaidItem(BOOTS.id), "a refused buy owns nothing");

  const bad = await buyPaidItem({ ...BOOTS, id: "Not An Id" }, { fetchImpl: buyServer.fetchImpl });
  check(!bad.ok && bad.error === "bad-item", "a badly named item isn't even sent");

  // Signing out forgets.
  forgetWallet();
  check(walletNow().status === "loading" && !ownsPaidItem(BOOTS.id), "forgetting the wallet owns nothing");
  stop();
}

// ── Nothing paid sits in the save or the browser ────────────────────────────
{
  const strip = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  const code = strip(readFileSync(new URL("../../lib/star/wallet.ts", import.meta.url), "utf8"));
  check(!/localStorage|sessionStorage|indexedDB/.test(code), "the wallet code never touches browser storage");
  check(!/from\s+["'][^"']*(storage|types|careerFlow)["']/.test(code), "the wallet code doesn't touch the career save");
  const types = strip(readFileSync(new URL("../../lib/star/types.ts", import.meta.url), "utf8"));
  check(!/\bgems\??\s*:/.test(types) && !/\bentitlements\??\s*:/.test(types), "the career save has no gems or entitlements field");
}

if (problems.length) { console.error("wallet FAILED:\n  - " + problems.join("\n  - ")); process.exit(1); }
console.log("wallet: all checks passed");
