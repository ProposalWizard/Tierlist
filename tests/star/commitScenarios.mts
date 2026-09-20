/**
 * lib/star/commitScenarios.ts + lib/star/authoredScenarios.ts — saving a
 * scenario STRAIGHT INTO THE CODE, through the GitHub Contents API.
 *
 * There is no GitHub here and no token, so `fetch` is faked the same way
 * tests/star/scenarioStore.mts fakes it. What is worth proving hardest:
 *
 *   1. REQUEST SHAPING. The read is a GET at the right path on the right
 *      ref; the write is a PUT carrying the branch, the sha it just read,
 *      and base64 of a file that MERGED rather than replaced. A commit that
 *      replaced the file would delete every scenario committed before it.
 *   2. NO TOKEN degrades honestly. No throw, no 500, no silent success — a
 *      sentence naming GITHUB_TOKEN, and `ok: false`.
 *   3. A MOVED SHA is retried exactly once, off a FRESH read, so the other
 *      person's scenario survives ours; and a second loss reports plainly
 *      instead of looping or claiming success.
 *   4. The token never appears in anything handed back to a caller.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

const {
  commitScenarios, resolveCommitConfig, AUTHORED_PATH,
} = await import("../../lib/star/commitScenarios");
const { mergeAuthoredFile, isMatchScenario, AUTHORED_SCENARIOS } =
  await import("../../lib/star/authoredScenarios");
const { blankScenario } = await import("../../lib/star/scenarios");

function scenarioAt(id: string, name: string, x: number) {
  const s = blankScenario("corner");
  return { ...s, id, name, updatedAt: 1, ball: { ...s.ball, x } };
}

interface Call { url: string; method: string; headers: Record<string, string>; body?: string }
let calls: Call[] = [];
type Reply = { status: number; body: unknown } | "throw";
let replies: Reply[] = [];

const fakeFetch = async (url: string, init?: { method?: string; headers?: Record<string, string>; body?: string }) => {
  calls.push({ url, method: init?.method ?? "GET", headers: init?.headers ?? {}, body: init?.body });
  const r = replies.shift() ?? { status: 500, body: { message: "no reply queued" } };
  if (r === "throw") throw new Error("network down");
  return { ok: r.status >= 200 && r.status < 300, status: r.status, json: async () => r.body };
};

const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64");
const unb64 = (s: string) => Buffer.from(s.replace(/\s+/g, ""), "base64").toString("utf8");

const CFG = { token: "ghp_SECRET_TOKEN_VALUE", repo: "ProposalWizard/Tierlist", branch: "Harry" };
const reset = (queue: Reply[]) => { calls = []; replies = queue; };

// ── The committed file itself ─────────────────────────────────────────────
{
  check(
    AUTHORED_SCENARIOS && typeof AUTHORED_SCENARIOS === "object",
    "the committed pool imports and is an object",
  );
  check(
    Object.keys(AUTHORED_SCENARIOS).every((id) => isMatchScenario(AUTHORED_SCENARIOS[id])),
    "…and everything in it is a real MatchScenario",
  );
}

// ── Merging, which is the whole safety property ───────────────────────────
{
  const start = JSON.stringify({ _readme: "keep me", scenarios: { old: scenarioAt("old", "Theirs", 5) } }, null, 2);
  const m = mergeAuthoredFile(start, [scenarioAt("new", "Mine", 9)]);
  const parsed = JSON.parse(m.text);
  check(!!parsed.scenarios.old, "a merge keeps a scenario it wasn't asked about");
  check(parsed.scenarios.new?.name === "Mine", "…and adds the one it was");
  check(parsed._readme === "keep me", "…and doesn't flatten the rest of the file");
  check(m.added.length === 1 && m.replaced.length === 0, "a brand-new id counts as added, not replaced");

  const again = mergeAuthoredFile(m.text, [scenarioAt("new", "Mine v2", 11)]);
  check(
    JSON.parse(again.text).scenarios.new.name === "Mine v2" && again.replaced[0] === "new",
    "committing the same id again replaces just that one, and says so",
  );

  const empty = mergeAuthoredFile("", [scenarioAt("a", "A", 1)]);
  check(!!JSON.parse(empty.text).scenarios.a, "a file that doesn't exist yet still merges into a valid pool");
  const junk = mergeAuthoredFile("{ not json", [scenarioAt("a", "A", 1)]);
  check(!!JSON.parse(junk.text).scenarios.a, "…and so does an unparseable one, rather than refusing the write");
  check(empty.text.endsWith("}\n"), "the file ends with a newline, so a git diff stays one scenario wide");
}

// ── No token: named, honest, never a crash ────────────────────────────────
{
  const r = resolveCommitConfig({});
  check(r.config === null, "no GITHUB_TOKEN: there is no config to commit with");
  check(r.missing.includes("GITHUB_TOKEN"), "…and it names the missing variable in a field");
  check(
    !!r.message && r.message.includes("GITHUB_TOKEN"),
    "…and in the sentence a person actually reads",
  );
  check(
    !!r.message && /nothing was committed/i.test(r.message),
    "…which says plainly that nothing was committed",
  );

  const blank = resolveCommitConfig({ GITHUB_TOKEN: "   " });
  check(blank.config === null, "a whitespace-only token is no token");

  const dflt = resolveCommitConfig({ GITHUB_TOKEN: "t" });
  check(
    dflt.config?.repo === "ProposalWizard/Tierlist" && dflt.config?.branch === "Harry",
    `repo and branch have real defaults (${dflt.config?.repo} / ${dflt.config?.branch})`,
  );
  const custom = resolveCommitConfig({ GITHUB_TOKEN: "t", GITHUB_REPO: "o/r", GITHUB_BRANCH: "main" });
  check(custom.config?.repo === "o/r" && custom.config?.branch === "main", "…which the env overrides");
}

// ── The happy path, and exactly what goes on the wire ─────────────────────
{
  const existing = JSON.stringify({ scenarios: { old: scenarioAt("old", "Theirs", 5) } }, null, 2);
  reset([
    { status: 200, body: { content: b64(existing), sha: "SHA_ONE" } },
    { status: 200, body: { commit: { sha: "COMMIT_ABC" } } },
  ]);
  const res = await commitScenarios({
    config: CFG,
    scenarios: [scenarioAt("gallery-main-cutback", "cutback", 12)],
    fetchImpl: fakeFetch,
  });

  check(res.ok && res.status === 200, `a confirmed commit reports ok (${res.status}: ${res.message})`);
  check(res.commitSha === "COMMIT_ABC", "…carrying the commit sha GitHub gave back");
  check(res.committed?.[0] === "gallery-main-cutback", "…and naming what was committed");

  check(calls.length === 2, `exactly one read and one write (${calls.length} calls)`);
  check(calls[0].method === "GET", "the read is a GET");
  check(calls[0].url.includes(`/repos/${CFG.repo}/contents/${AUTHORED_PATH}`), `…at the file's own path (${calls[0].url})`);
  check(calls[0].url.includes("ref=Harry"), "…on the branch being committed to");
  check(calls[1].method === "PUT", "the write is a PUT");
  check(calls[1].headers.Authorization === `Bearer ${CFG.token}`, "…authenticated with the token");

  const put = JSON.parse(calls[1].body!);
  check(put.sha === "SHA_ONE", "…sending back the sha it just read, so a stale write is rejected by GitHub");
  check(put.branch === "Harry", "…naming the branch");
  check(typeof put.message === "string" && put.message.includes("cutback"), `…with a real commit message (${put.message})`);
  const written = JSON.parse(unb64(put.content));
  check(!!written.scenarios["gallery-main-cutback"], "…and content holding the new scenario");
  check(!!written.scenarios.old, "…MERGED over what was already there, never replacing it");
  check(
    written.scenarios["gallery-main-cutback"].ball.x === 12,
    "…with the real pitch metres intact through base64 and back",
  );

  const json = JSON.stringify(res);
  check(!json.includes(CFG.token), "the token appears nowhere in what the caller gets back");
}

// ── A file that isn't on the branch yet ───────────────────────────────────
{
  reset([
    { status: 404, body: { message: "Not Found" } },
    { status: 200, body: { commit: { sha: "COMMIT_NEW" } } },
  ]);
  const res = await commitScenarios({ config: CFG, scenarios: [scenarioAt("a", "A", 1)], fetchImpl: fakeFetch });
  check(res.ok, `a missing file is created rather than failing (${res.message})`);
  check(JSON.parse(calls[1].body!).sha === undefined, "…with no sha, which is how GitHub is told to create it");
}

// ── Somebody else committed first ─────────────────────────────────────────
{
  const theirs = JSON.stringify({ scenarios: { theirs: scenarioAt("theirs", "Theirs", 3) } }, null, 2);
  reset([
    { status: 200, body: { content: b64("{\"scenarios\":{}}"), sha: "STALE" } },
    { status: 409, body: { message: "is at 9f8e but expected STALE" } },
    { status: 200, body: { content: b64(theirs), sha: "FRESH" } },
    { status: 200, body: { commit: { sha: "COMMIT_RETRY" } } },
  ]);
  const res = await commitScenarios({ config: CFG, scenarios: [scenarioAt("mine", "Mine", 7)], fetchImpl: fakeFetch });
  check(res.ok, `a moved sha is retried and succeeds (${res.message})`);
  check(calls.length === 4, `…by re-reading first, not by re-sending the same PUT (${calls.length} calls)`);
  check(JSON.parse(calls[3].body!).sha === "FRESH", "…using the sha from the fresh read");
  const written = JSON.parse(unb64(JSON.parse(calls[3].body!).content));
  check(
    !!written.scenarios.theirs && !!written.scenarios.mine,
    "…and the retry keeps THEIR scenario as well as ours — which is why retrying is safe",
  );

  // Losing twice in a row: report, don't loop, don't claim success.
  reset([
    { status: 200, body: { content: b64("{}"), sha: "S1" } },
    { status: 409, body: { message: "conflict" } },
    { status: 200, body: { content: b64("{}"), sha: "S2" } },
    { status: 409, body: { message: "conflict" } },
  ]);
  const lost = await commitScenarios({ config: CFG, scenarios: [scenarioAt("m", "M", 7)], fetchImpl: fakeFetch });
  check(!lost.ok && lost.raced === true, "two lost races in a row is a real, named failure");
  check(lost.status === 409, `…reported as a conflict, not a 500 (${lost.status})`);
  check(calls.length === 4, `…after exactly one retry, never a loop (${calls.length} calls)`);
  check(/nothing was committed/i.test(lost.message), "…saying plainly that nothing was committed");

  // A 422 (wrong sha for this path) is the same situation.
  reset([
    { status: 200, body: { content: b64("{}"), sha: "S1" } },
    { status: 422, body: { message: "sha does not match" } },
    { status: 200, body: { content: b64("{}"), sha: "S2" } },
    { status: 200, body: { commit: { sha: "OK" } } },
  ]);
  const four22 = await commitScenarios({ config: CFG, scenarios: [scenarioAt("m", "M", 7)], fetchImpl: fakeFetch });
  check(four22.ok, "a 422 sha mismatch retries the same way a 409 does");
}

// ── Everything else that can go wrong, reported rather than thrown ────────
{
  reset([{ status: 401, body: { message: "Bad credentials" } }]);
  const bad = await commitScenarios({ config: CFG, scenarios: [scenarioAt("a", "A", 1)], fetchImpl: fakeFetch });
  check(!bad.ok && bad.status === 403, `a refused token is a 403, not a 500 (${bad.status})`);
  check(bad.message.includes("Contents: Read and write"), "…and says what the token actually needs");
  check(!JSON.stringify(bad).includes(CFG.token), "…without quoting the token back");

  reset(["throw"]);
  const off = await commitScenarios({ config: CFG, scenarios: [scenarioAt("a", "A", 1)], fetchImpl: fakeFetch });
  check(!off.ok && /nothing was committed/i.test(off.message), "an unreachable GitHub never throws, it reports");

  reset([{ status: 200, body: { nonsense: true } }]);
  const shape = await commitScenarios({ config: CFG, scenarios: [scenarioAt("a", "A", 1)], fetchImpl: fakeFetch });
  check(!shape.ok, "an unreadable response from GitHub is a failure, not a half-commit");

  reset([]);
  const none = await commitScenarios({ config: CFG, scenarios: [], fetchImpl: fakeFetch });
  check(!none.ok && none.status === 400, "nothing to commit is a 400, and never touches the network");
  check(calls.length === 0, "…literally no request at all");
}

if (problems.length) {
  console.error(`commitScenarios: ${problems.length} problem(s)`);
  for (const p of problems) console.error("  ✗", p);
  process.exit(1);
}
console.log("commitScenarios: all checks passed");
