# Non-story build jobs to run on the API credit (28 Nov 2026)

For the chat in the "The space" environment (it has `KIB_API_KEY`). Run each job
exactly the way docs/handoffs/story-world-api-2026-11-28.md says ("How the jobs
really use the API credit"): clean environment, own config folder, the key passed
as ANTHROPIC_API_KEY, and the fake-key proof check first. Record each job's
total_cost_usd. Stop starting jobs once the night's total passes the budget in
that file.

Each job: its own git worktree from branch Harry; `--model claude-opus-5-5`;
read CLAUDE.md first; never edit scripts/one-engine-guard.mjs; no Higgsfield or
paid image/voice services; invented names only; phone-size stills (390 wide) that
the job LOOKS at before it finishes; tsc + both guards + the tests named; commit,
merge latest origin/Harry, push to Harry. Plain-English report to Harry.

Another chat (not on the API credit) is building at the same time: the kit man
drill, visitors leaving / the chef at a hob (lib/star/home3d), and the compound's
reception and canteen (lib/star/world3d/compound*). Don't touch those files.

## Job 1: mood changes happiness (people plan)
Mood is saved (lib/star/life/houseActs.ts, the lunch card, the barber) but does
nothing yet. Read docs/plans/PEOPLE_AND_MEMORY_PLAN.md. Make mood feed the
existing happiness / morale value in small, capped steps (no new economy), shown
on the Home screen in one line. Old saves unchanged. Tests: houseActs, lifeClock,
lunch, barber, lifeSaveFixture + a new mood test; the career soak
(`npx tsx scripts/soak/careerSoak.mts 20`).

## Job 2: the Old UI casino's real horse names (needs Harry's answer first)
components/star/legacy/ is frozen. Only if Harry says yes: replace Bold Ruler,
Iron Duke and Lucky Strike there with the invented names now in
lib/star/horseNames.ts. Otherwise skip.

## Job 3: free voice lines for the lunch table and the barber
Write 30 short, plain British football-voice lines (12 lunch chats, 18 barber
chats from "Rico"), in the existing line files' shape, run the de-ai check if
present, no real names. Text only — no paid voice.
