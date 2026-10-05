import { roleFromRow, canTest, readRole, type RoleRow } from "../../lib/roles";
import {
  newTesterCode, normaliseTesterCode, testerLinkPath, claimTesterLink, outcomeForLink,
  TESTER_CODE_ALPHABET, TESTER_CODE_LENGTH, type TesterClient,
} from "../../lib/testerLinks";
import { markGodMode, withGodMode } from "../../lib/star/godMode";

/**
 * Tester access (Harry, 5 Oct 2026): link codes, role resolution, opening a
 * link, and the "Tester save" mark. The database is faked: a tiny in-memory
 * stand-in for the few Supabase calls these helpers make, which can also
 * pretend tester_access.sql hasn't been run (is_tester / tester_links
 * missing) — the state the live site is in until Mikey runs it.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

// ── Codes ───────────────────────────────────────────────────────────────────
{
  const seen = new Set<string>();
  for (let i = 0; i < 2000; i++) {
    const c = newTesterCode();
    check(c.length === TESTER_CODE_LENGTH, `code length ${c}`);
    check([...c].every((ch) => TESTER_CODE_ALPHABET.includes(ch)), `code alphabet ${c}`);
    check(normaliseTesterCode(c) === c, `a new code normalises to itself ${c}`);
    seen.add(c);
  }
  check(seen.size > 1990, `2000 codes should be (almost) all different, got ${seen.size}`);
  for (const bad of ["I", "L", "O", "0", "1"]) check(!TESTER_CODE_ALPHABET.includes(bad), `no look-alike ${bad}`);

  // A fixed "random" source gives a fixed code.
  check(newTesterCode(() => 0) === "AAAAAA", "randomInt 0 → AAAAAA");
  check(newTesterCode((n) => n - 1) === "999999", "randomInt max → 999999");

  check(normaliseTesterCode(" k7q2xm ") === "K7Q2XM", "lower case and spaces are forgiven");
  check(normaliseTesterCode("K7Q2X") === null, "too short");
  check(normaliseTesterCode("K7Q2XMM") === null, "too long");
  check(normaliseTesterCode("K7Q2X0") === null, "zero is not in the alphabet");
  check(normaliseTesterCode("K7Q2X/") === null, "no punctuation");
  check(normaliseTesterCode(undefined) === null && normaliseTesterCode(123456) === null, "non-strings");
  check(testerLinkPath("K7Q2XM") === "/tester/K7Q2XM", "link path");
}

// ── Roles from a row ────────────────────────────────────────────────────────
{
  check(roleFromRow(null) === "player", "no row → player");
  check(roleFromRow({}) === "player", "empty row → player");
  check(roleFromRow({ is_admin: false, is_tester: false }) === "player", "both false → player");
  check(roleFromRow({ is_tester: true }) === "tester", "tester");
  check(roleFromRow({ is_admin: true }) === "admin", "admin");
  check(roleFromRow({ is_admin: true, is_tester: true }) === "admin", "admin wins over tester");
  check(roleFromRow({ is_admin: null, is_tester: null }) === "player", "nulls → player");
  check(canTest("admin") && canTest("tester") && !canTest("player"), "admins count as testers, players don't");
}

// ── A fake Supabase ─────────────────────────────────────────────────────────
interface FakeDb {
  migrated: boolean;
  roles: Map<string, RoleRow>;
  links: Map<string, { code: string; active: boolean; uses: number }>;
  throws?: boolean;
  failUpsert?: boolean;
  log: string[];
}

function fakeClient(db: FakeDb): TesterClient {
  const err = { code: "42703", message: "column does not exist" };
  return {
    from(table: string) {
      if (db.throws) throw new Error("network down");
      return {
        select(columns: string) {
          return {
            eq(column: string, value: string) {
              return {
                maybeSingle: async () => {
                  db.log.push(`select ${table} ${columns}`);
                  if (table === "user_roles") {
                    if (!db.migrated && columns.includes("is_tester")) return { data: null, error: err };
                    const row = db.roles.get(value) ?? null;
                    if (!row) return { data: null, error: null };
                    return { data: db.migrated ? row : { is_admin: row.is_admin }, error: null };
                  }
                  if (table === "tester_links") {
                    if (!db.migrated) return { data: null, error: { code: "42P01", message: "relation does not exist" } };
                    const l = db.links.get(value);
                    return { data: l ? (l as unknown as RoleRow) : null, error: null };
                  }
                  void column;
                  return { data: null, error: null };
                },
              };
            },
          };
        },
        upsert: async (values: Record<string, unknown>) => {
          db.log.push(`upsert ${table}`);
          if (!db.migrated || db.failUpsert) return { data: null, error: err };
          const id = values.user_id as string;
          db.roles.set(id, { ...(db.roles.get(id) ?? { is_admin: false }), is_tester: values.is_tester as boolean });
          return { data: null, error: null };
        },
        update(values: Record<string, unknown>) {
          return {
            eq: async (_c: string, value: string) => {
              db.log.push(`update ${table}`);
              const l = db.links.get(value);
              if (l) Object.assign(l, values);
              return { data: null, error: null };
            },
          };
        },
      };
    },
  } as unknown as TesterClient;
}

const freshDb = (migrated = true): FakeDb => ({
  migrated,
  roles: new Map([
    ["admin-1", { is_admin: true, is_tester: false }],
    ["tester-1", { is_admin: false, is_tester: true }],
    ["player-1", { is_admin: false, is_tester: false }],
  ]),
  links: new Map([
    ["K7Q2XM", { code: "K7Q2XM", active: true, uses: 2 }],
    ["QFFQFF", { code: "QFFQFF", active: false, uses: 0 }],
  ]),
  log: [],
});

// ── Reading a role ──────────────────────────────────────────────────────────
{
  const db = freshDb();
  const c = fakeClient(db);
  check((await readRole(c, "admin-1")) === "admin", "admin read");
  check((await readRole(c, "tester-1")) === "tester", "tester read");
  check((await readRole(c, "player-1")) === "player", "player read");
  check((await readRole(c, "nobody")) === "player", "no row → player");

  // Before tester_access.sql: admins still admins, nobody is a tester, no throw.
  const old = freshDb(false);
  const oc = fakeClient(old);
  check((await readRole(oc, "admin-1")) === "admin", "unmigrated: admin stays admin");
  check((await readRole(oc, "tester-1")) === "player", "unmigrated: nobody is a tester");
  check(old.log.filter((l) => l.startsWith("select user_roles")).length === 4, "unmigrated: asks again with is_admin alone");

  // A client that throws: player, never an error.
  check((await readRole(fakeClient({ ...freshDb(), throws: true }), "admin-1")) === "player", "a throwing client reads as player");
}

// ── Opening a link ──────────────────────────────────────────────────────────
{
  check(outcomeForLink(undefined) === "not-ready" && outcomeForLink(null) === "unknown", "link outcomes");
  check(outcomeForLink({ code: "K7Q2XM", active: false, uses: 0 }) === "off", "off link");
  check(outcomeForLink({ code: "K7Q2XM", active: true, uses: 0 }) === null, "live link");

  const db = freshDb();
  const c = fakeClient(db);
  check((await claimTesterLink(c, "k7q2xm", "player-1")) === "joined", "a player joins with a live link (any case)");
  check(db.roles.get("player-1")?.is_tester === true, "…and is now a tester");
  check(db.roles.get("player-1")?.is_admin === false, "…and is not an admin");
  check(db.links.get("K7Q2XM")?.uses === 3, "…and the link counts the use");
  check((await readRole(c, "player-1")) === "tester", "…and reads back as tester");

  check((await claimTesterLink(c, "K7Q2XM", "player-1")) === "already", "opening it twice: already");
  check((await claimTesterLink(c, "K7Q2XM", "admin-1")) === "already", "an admin: already, nothing written");
  check(db.roles.get("admin-1")?.is_tester === false && db.roles.get("admin-1")?.is_admin === true, "admin row untouched");

  check((await claimTesterLink(c, "QFFQFF", "new-1")) === "off", "a switched-off link does nothing");
  check(!db.roles.has("new-1"), "…nothing written");
  check((await claimTesterLink(c, "ZZZZZZ", "new-1")) === "unknown", "an unknown code");
  check((await claimTesterLink(c, "bad!", "new-1")) === "unknown", "a malformed code");
  check((await claimTesterLink(c, "K7Q2XM", "new-1")) === "joined", "someone with no user_roles row joins");
  check(db.roles.get("new-1")?.is_tester === true, "…row made");

  const failing = freshDb();
  failing.failUpsert = true;
  check((await claimTesterLink(fakeClient(failing), "K7Q2XM", "player-1")) === "not-ready", "a refused write reads as not-ready");
  check(failing.links.get("K7Q2XM")?.uses === 2, "…and the use isn't counted");

  // Before tester_access.sql: every link is not-ready and nothing is written.
  const old = freshDb(false);
  check((await claimTesterLink(fakeClient(old), "K7Q2XM", "player-1")) === "not-ready", "unmigrated: not-ready");
  check(!old.log.some((l) => l.startsWith("upsert")), "unmigrated: no write attempted");

  check((await claimTesterLink(fakeClient({ ...freshDb(), throws: true }), "K7Q2XM", "player-1")) === "not-ready", "a throwing client: not-ready");
}

// ── The "Tester save" mark ──────────────────────────────────────────────────
{
  check(markGodMode(null) === null, "null stays null");
  const c = { money: 5 } as { money: number; usedGodMode?: boolean };
  const m = markGodMode(c)!;
  check(m.usedGodMode === true && m.money === 5 && c.usedGodMode === undefined, "marks a copy, keeps the rest");
  check(markGodMode(m) === m, "already marked: same object");

  // The wrapper runs the cheat, then marks — so the mark lands on the cheat's result.
  let state: { money: number; usedGodMode?: boolean } | null = { money: 0 };
  const addMoney = (n: number) => { state = { ...state!, money: state!.money + n }; };
  const mark = () => { state = markGodMode(state); };
  withGodMode(addMoney, mark)(100);
  check(state!.money === 100 && state!.usedGodMode === true, "cheat applied and save marked");
}

if (problems.length) {
  console.error(`testerAccess: ${problems.length} problem(s)`);
  for (const p of problems) console.error(" -", p);
  process.exit(1);
}
console.log("testerAccess: all checks passed");
