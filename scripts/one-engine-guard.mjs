#!/usr/bin/env node
/**
 * ONE ENGINE — THE GUARD.
 *
 * Runs INSIDE `npm run build` ("build": "node scripts/one-engine-guard.mjs &&
 * next build"), so every Vercel deploy runs it — not as a "prebuild" hook,
 * which silently stops running if the build command is ever changed in the
 * Vercel dashboard or the project moves to a package manager that skips pre-
 * scripts. Also run by `npm run guard:engine` and tests/star/oneEngine.mts.
 *
 * Why it exists: on 24 Sep 2026 an audit found the trial, the training, the
 * five-a-side and two prototypes each running their OWN copy of the match
 * loop, and every copy had drifted from the real match (a keeper who guessed,
 * a ball drawn at half height, one physics step a frame instead of three…).
 * "There has to be a way that ANY new feature used the base engine."
 *
 * The rules:
 *  1. Only the real match (CanvasMatch.tsx) uses the engine's physics.
 *  2. Only the real match (app/star-dev/page.tsx) and EnginePlay mount
 *     <CanvasMatch>. Every other screen mounts EnginePlay: the real game's
 *     size, squads and weather, with the Play Area's dials on top.
 *  3. Nobody pastes in their own stepBall/stepKeeper/…: a function with an
 *     engine function's name AND its shape (same number of parameters) outside
 *     the engine is a copy of it. (Shape, not just name: `launch(url)` on a
 *     button is not a copy of the engine's six-argument `launch`.)
 *  4. Every canvas animation loop (requestAnimationFrame + a 2D canvas) is
 *     named in KNOWN_CANVASES — the way to catch a screen that writes its OWN
 *     ball physics without ever touching an engine function, which no name
 *     check can see. Goalie Mode is exactly that today.
 *  5. EnginePlay passes the engine everything the real match passes, except
 *     the settings named in CAREER_ONLY; and nothing the real match does not,
 *     except the dials named in TEST_ONLY. A new setting added to the real
 *     match fails the build until the test screens get it too.
 *  6. The lists only shrink. CEILINGs fail the build if one grows; a listed
 *     file that is no longer a copy fails it too, so its line gets deleted
 *     rather than left as a hole a new copy could hide in.
 *
 * How it sees: the TypeScript compiler, not text matching. Every reference is
 * resolved to what it points at, so a renamed import, `import * as E`, a
 * re-export, a dynamic import or a function held in a variable are all seen.
 * A canary folder (tests/star/fixtures/oneEngineCanary/) hides a copy behind
 * each of those tricks on purpose — and two harmless look-alikes that must NOT
 * be flagged. If the guard ever stops seeing a planted copy, or starts
 * flagging a harmless one, it fails: a guard that has gone blind or jumpy
 * fails loudly instead of quietly passing or blocking everyone.
 *
 * It never reads type errors, so an unrelated type problem can never fail it.
 *
 * Usage: node scripts/one-engine-guard.mjs [--json]
 */
import ts from "typescript";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const rel = (f) => relative(ROOT, f).split(sep).join("/");

/** The engine, and Mikey's deliberate fork of it for /star-match-dev. */
const ENGINE_FILES = new Set(["lib/star/canvasEngine.ts", "lib/star/canvasEngineTest.ts"]);
const ENGINE = "lib/star/canvasEngine.ts";

/** Using any of these IS running a match loop. */
export const PHYSICS = new Set([
  "stepBall", "stepBallRaw", "stepKeeper", "stepReactions", "stepDefenders", "stepTouchChase",
  "launch", "stepBallInNet", "settleBall", "stepBallPastBar",
]);

/** The one file allowed to run the loop, and the two allowed to mount it. */
export const ENGINE_RUNNER = "components/star/CanvasMatch.tsx";
export const REAL_MOUNT = "app/star-dev/page.tsx";
export const TEST_MOUNT = "components/star/EnginePlay.tsx";
export const CANVASMATCH_MOUNTS = new Set([REAL_MOUNT, TEST_MOUNT]);

/**
 * Copies of the match loop that exist today, each with its plan. REMOVE a line
 * the moment its file stops being a copy. Never add one: a new feature mounts
 * EnginePlay.
 */
export const KNOWN_COPIES = {
  // Ported 24 Sep 2026 and removed from this list: TrialPenalties.tsx (trial
  // penalties + free kicks) and TrainingMinigame.tsx (strike drills + gauntlet).
  "components/star/FiveASide.tsx":
    "Trial five-a-side: a different game (5 v 5, small goal) on the engine's own functions.",
  "components/star/BicycleKickTrial.tsx":
    "Dev-only prototype (/star-bicycle-dev), not in the game. Port or delete before it ships.",
  "components/star/LiveAttack.tsx":
    "Dev-only prototype (/star-attack-dev), not in the game. Port or delete before it ships.",
  "components/star/CanvasMatchTest.tsx":
    "Mikey's physics fork for /star-match-dev (runs canvasEngineTest.ts). Reaches the game only by being ported by hand.",
};
export const CEILING = 4;

/**
 * Every file with its own canvas animation loop, other than the real match.
 * A screen can write its own ball physics without touching one engine
 * function; this is where it shows up. Same rule: only ever shrinks.
 */
export const KNOWN_CANVASES = {
  "components/star/FiveASide.tsx": "Known copy (above).",
  "components/star/BicycleKickTrial.tsx": "Known copy (above).",
  "components/star/LiveAttack.tsx": "Known copy (above).",
  "components/star/CanvasMatchTest.tsx": "Known copy (above).",
  "components/star/GoalieMode.tsx":
    "Casino Goalie Mode: first-person keeper, its OWN scripted ball flight (lib/star/goalieMode.ts), no engine at all. A different game by design — or a copy? Decision for Harry, see the patch notes.",
  "components/star/stages/TrialVision.tsx":
    "Trial vision drill: a still picture you read and tap. Draws, never simulates.",
};
export const CANVAS_CEILING = 6;

/** Settings the real match passes that a test screen deliberately does not. */
export const CAREER_ONLY = {
  startMinute: "Coming on as a sub — a career fact.",
  duties: "Which set pieces are yours — from the career's team sheet.",
  onGoalScored: "Saves a goal replay into the career.",
  replayOf: "Watching a saved goal again — a career screen.",
};
/** Dials a test screen passes that the real match never does. */
export const TEST_ONLY = {
  forceKeeperStrength: "Play Area: Keeper → Set.",
  fatigueResetEvery: "Fresh legs every 90 in a thousands-of-minutes match.",
  neverHooked: "A test match never substitutes you off.",
  openOn: "Play this exact picture (gallery / highlights).",
  bare: "No scoreboard on a card that counts nothing.",
  onChanceServed: "Observer: tells a test screen what chance is on.",
  onChanceResolved: "Observer: tells a feature how the chance ended.",
  setPieceSkill: "Trial/training: the free-kick rating when there is no career (the trial's invisible stat; training's own skill).",
  penaltyRead: "Trial: a harder keeper read on the harder reps (Harry: 'that should bypass the checks').",
  markers: "Training: the technique drill's cones, drawn on the grass. Decoration only.",
  onBallStep: "Training: watches the ball cross the cone gate. Read-only.",
  dragReferenceHeightPx: "Gallery/highlights: a bigger picture reads the drag against the real match's canvas height, so a kick hits exactly as hard.",
  scene: "Trial/training: what is on the pitch — a drill can leave out the keeper, the goal, team-mates or the GOAL/PASS text. Only takes things off; the ball and the kick are always the match's (Harry: 'different modes... will be COMPLETELY looking different... it has to be allowed').",
};

/** Where the canary lives, and what each planted file must (or must not) trip. */
const CANARY_DIR = "tests/star/fixtures/oneEngineCanary";
export const CANARY_EXPECT = {
  [`${CANARY_DIR}/renamed.ts`]: "physics",      // import { stepBall as roll }
  [`${CANARY_DIR}/namespace.ts`]: "physics",    // import * as E; E.stepKeeper(...)
  [`${CANARY_DIR}/reexport.ts`]: "physics",     // export { launch } from engine
  [`${CANARY_DIR}/viaReexport.ts`]: "physics",  // uses launch via reexport.ts
  [`${CANARY_DIR}/held.ts`]: "physics",         // const f = stepReactions; f(...)
  [`${CANARY_DIR}/dynamic.ts`]: "physics",      // await import(engine) then .stepBall
  [`${CANARY_DIR}/required.ts`]: "physics",     // require("…/canvasEngine")
  [`${CANARY_DIR}/pasted.ts`]: "declares",      // its own stepBall(ball, sc, rng, dt)
  [`${CANARY_DIR}/mount.tsx`]: "mount",         // <Game/> where Game = CanvasMatch
  [`${CANARY_DIR}/loop.tsx`]: "canvas",         // its own rAF + 2D canvas loop
};
/** Look-alikes that are NOT copies — flagging these would block every deploy. */
export const CANARY_CLEAN = [
  `${CANARY_DIR}/harmlessLaunch.ts`,   // export function launch(url: string)
  `${CANARY_DIR}/typeOnly.ts`,         // ComponentProps<typeof CanvasMatch>
];

const SKIP_DIRS = new Set(["node_modules", ".next", ".git", "public", "supabase", "patch-notes", "scripts", "tests"]);
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name.startsWith(".") || SKIP_DIRS.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}
const canaryFiles = () => readdirSync(join(ROOT, CANARY_DIR)).filter((n) => /\.(tsx?|jsx?)$/.test(n)).map((n) => join(ROOT, CANARY_DIR, n));

/** Everything that ships (every source file outside tests/scripts), plus the canary. */
function sourceFiles() {
  return [...walk(ROOT), ...canaryFiles()].filter((f) => /\.(tsx?|jsx?|mjs|cjs)$/.test(f) && !f.endsWith(".d.ts"));
}

function loadProgram(files) {
  const cfgPath = ts.findConfigFile(ROOT, ts.sys.fileExists, "tsconfig.json");
  const parsed = ts.getParsedCommandLineOfConfigFile(cfgPath, {}, {
    ...ts.sys, onUnRecoverableConfigFileDiagnostic: (d) => { throw new Error(ts.flattenDiagnosticMessageText(d.messageText, "\n")); },
  });
  const options = { ...parsed.options, allowJs: true, checkJs: false, noEmit: true, incremental: false, tsBuildInfoFile: undefined };
  return ts.createProgram(files, options);
}

/** Inside a type (`typeof X`, `Props<…>`) — a name there is never a mount or a call. */
function inTypePosition(node) {
  for (let a = node.parent; a; a = a.parent) {
    if (ts.isTypeNode(a)) return true;
    if (ts.isStatement(a) || ts.isSourceFile(a)) return false;
  }
  return false;
}

/** The attribute names on every <CanvasMatch …> in one file. */
function mountAttributes(sf, isCanvasMatch) {
  const sets = [];
  const visit = (n) => {
    if ((ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) && isCanvasMatch(n.tagName)) {
      const names = new Set();
      // `key` is React's, not a setting the engine reads.
      for (const a of n.attributes.properties) if (ts.isJsxAttribute(a) && a.name.getText(sf) !== "key") names.add(a.name.getText(sf));
      sets.push(names);
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return sets;
}

export function scan() {
  const files = sourceFiles();
  const program = loadProgram(files);
  const checker = program.getTypeChecker();
  const findings = new Map(); // file -> Set of "physics" | "mount" | "declares" | "canvas"
  const add = (file, what) => {
    if (!findings.has(file)) findings.set(file, new Set());
    findings.get(file).add(what);
  };
  const resolve = (sym) => {
    let s = sym;
    for (let i = 0; s && s.flags & ts.SymbolFlags.Alias && i < 10; i++) s = checker.getAliasedSymbol(s);
    return s;
  };
  const declaredIn = (s) => (s?.declarations ?? []).map((d) => rel(d.getSourceFile().fileName));

  // The engine's own shapes: how many parameters each physics function takes.
  const arity = new Map();
  const engineSf = program.getSourceFile(join(ROOT, ENGINE));
  engineSf?.forEachChild((n) => {
    if (ts.isFunctionDeclaration(n) && n.name && PHYSICS.has(n.name.text)) arity.set(n.name.text, n.parameters.length);
  });

  const isCanvasMatch = (tag) => {
    const t = resolve(checker.getSymbolAtLocation(tag));
    return !!t && declaredIn(t).includes(ENGINE_RUNNER) && (t.name === "default" || t.name === "CanvasMatch");
  };
  const mountAttrs = {};

  for (const sf of program.getSourceFiles()) {
    const file = rel(sf.fileName);
    if (sf.isDeclarationFile || file.startsWith("node_modules/") || file.startsWith("..")) continue;
    if (ENGINE_FILES.has(file)) continue;
    if (file.startsWith("tests/") && !file.startsWith(CANARY_DIR + "/")) continue;
    const text = sf.text;

    // An animation loop on a 2D canvas: rule 4.
    if (/requestAnimationFrame/.test(text) && /getContext\(\s*["']2d["']/.test(text)) add(file, "canvas");
    // require() of the engine — CommonJS never goes through the import resolver.
    if (/require\(\s*["'][^"']*canvasEngine(\.ts)?["']\s*\)/.test(text)) add(file, "physics");

    const visit = (node) => {
      // A pasted copy: an engine function's name AND its shape.
      if ((ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node)) && node.name && PHYSICS.has(node.name.text)
          && arity.has(node.name.text) && node.parameters.length === arity.get(node.name.text)) {
        add(file, "declares");
      }
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && PHYSICS.has(node.name.text)
          && node.initializer && (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))
          && node.initializer.parameters.length === arity.get(node.name.text)) {
        add(file, "declares");
      }
      if (ts.isIdentifier(node)) {
        const parent = node.parent;
        const isImportName = parent && (ts.isImportSpecifier(parent) || ts.isImportClause(parent) || ts.isNamespaceImport(parent));
        const isOwnName = parent && parent.name === node
          && (ts.isFunctionDeclaration(parent) || ts.isVariableDeclaration(parent) || ts.isClassDeclaration(parent) || ts.isParameter(parent));
        if (!isImportName && !isOwnName) {
          const target = resolve(checker.getSymbolAtLocation(node));
          if (target) {
            const where = declaredIn(target);
            if (PHYSICS.has(target.name) && where.some((w) => ENGINE_FILES.has(w))) add(file, "physics");
            if (where.includes(ENGINE_RUNNER) && (target.name === "default" || target.name === "CanvasMatch")
                && !inTypePosition(node)) {
              add(file, "mount");
            }
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);

    if (file === REAL_MOUNT || file === TEST_MOUNT) mountAttrs[file] = mountAttributes(sf, isCanvasMatch);
  }
  findings.mountAttrs = mountAttrs;
  return findings;
}

export function judge(findings) {
  const problems = [];
  const notes = [];
  const has = (f, w) => findings.get(f)?.has(w) ?? false;

  // The canary first. If the guard cannot see a planted copy — or flags a
  // harmless look-alike — nothing it says about the real code can be trusted.
  for (const [f, what] of Object.entries(CANARY_EXPECT)) {
    if (!has(f, what)) problems.push(`GUARD IS BLIND: it no longer sees the planted copy in ${f} (${what}). Fix the guard before trusting it.`);
  }
  for (const f of CANARY_CLEAN) {
    if (findings.has(f)) problems.push(`GUARD IS JUMPY: it flags the harmless look-alike in ${f} (${[...findings.get(f)].join(", ")}). A false alarm like this would block every deploy — fix the guard.`);
  }

  const copies = [];
  const canvases = [];
  for (const [f, kinds] of findings) {
    if (f.startsWith(CANARY_DIR + "/") || f === ENGINE_RUNNER) continue;
    if (kinds.has("physics") || kinds.has("declares")) copies.push(f);
    if (kinds.has("canvas")) canvases.push(f);
    if (kinds.has("mount") && !CANVASMATCH_MOUNTS.has(f)) {
      problems.push(`${f} mounts <CanvasMatch> directly. Mount EnginePlay (components/star/EnginePlay.tsx) instead, so it plays the real game's size, squads and weather.`);
    }
  }
  if (!has(ENGINE_RUNNER, "physics")) problems.push(`${ENGINE_RUNNER} no longer runs the engine — the guard is pointing at the wrong file.`);
  for (const f of CANVASMATCH_MOUNTS) if (!has(f, "mount")) problems.push(`${f} is listed as mounting <CanvasMatch> but no longer does — update CANVASMATCH_MOUNTS.`);

  for (const f of copies) {
    if (f in KNOWN_COPIES) notes.push(`copy still to port: ${f} — ${KNOWN_COPIES[f]}`);
    else problems.push(`${f} runs its own copy of the match (${[...findings.get(f)].join(", ")}). Build it on EnginePlay instead — see .claude/skills/one-engine.`);
  }
  for (const f of Object.keys(KNOWN_COPIES)) {
    if (!copies.includes(f)) problems.push(`${f} is no longer a copy — well done. Delete its line from KNOWN_COPIES (and KNOWN_CANVASES if it is there) and lower the ceilings in scripts/one-engine-guard.mjs.`);
  }
  for (const f of canvases) {
    if (!(f in KNOWN_CANVASES)) problems.push(`${f} runs its own canvas animation loop. If it plays football, build it on EnginePlay. If it genuinely does not (a picture, a chart), that is a decision for Harry — see .claude/skills/one-engine.`);
    else if (!(f in KNOWN_COPIES)) notes.push(`own canvas loop: ${f} — ${KNOWN_CANVASES[f]}`);
  }
  for (const f of Object.keys(KNOWN_CANVASES)) {
    if (!canvases.includes(f)) problems.push(`${f} no longer has its own canvas loop. Delete its line from KNOWN_CANVASES and lower CANVAS_CEILING.`);
  }
  if (Object.keys(KNOWN_COPIES).length > CEILING) problems.push(`KNOWN_COPIES has ${Object.keys(KNOWN_COPIES).length} entries but CEILING is ${CEILING}. The list may only shrink.`);
  if (Object.keys(KNOWN_CANVASES).length > CANVAS_CEILING) problems.push(`KNOWN_CANVASES has ${Object.keys(KNOWN_CANVASES).length} entries but CANVAS_CEILING is ${CANVAS_CEILING}. The list may only shrink.`);

  // Rule 5: the test screens get everything the real match gets.
  const attrs = findings.mountAttrs ?? {};
  const real = new Set((attrs[REAL_MOUNT] ?? []).flatMap((s) => [...s]));
  const test = new Set((attrs[TEST_MOUNT] ?? []).flatMap((s) => [...s]));
  if (real.size === 0 || test.size === 0) {
    problems.push(`Could not read the <CanvasMatch> settings on ${real.size ? TEST_MOUNT : REAL_MOUNT} — the settings check is blind. Fix the guard.`);
  } else {
    for (const a of real) {
      if (!test.has(a) && !(a in CAREER_ONLY)) problems.push(`The real match passes "${a}" to the engine and EnginePlay does not, so every test screen plays without it. Pass it in EnginePlay (lib/star/engineProfile.ts), or — only if it is genuinely a career-only fact — add it to CAREER_ONLY with the reason.`);
    }
    for (const a of test) {
      if (!real.has(a) && !(a in TEST_ONLY)) problems.push(`EnginePlay passes "${a}" to the engine and the real match never does. A test-only dial must be listed in TEST_ONLY with the reason, so it stays visibly a test-area thing.`);
    }
  }
  return { problems, notes, copies, canvases };
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const t0 = Date.now();
  let result;
  try {
    result = judge(scan());
  } catch (e) {
    // Fail closed: a guard that crashed has not checked anything.
    console.error(`\nONE ENGINE GUARD crashed — failing the build rather than passing it unchecked.\n${e?.stack ?? e}`);
    process.exit(1);
  }
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(result));
  } else {
    console.log(`\nONE ENGINE GUARD (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
    console.log(`  ${result.copies.length} copies of the match still to port (6 on 24 Sep 2026):`);
    for (const n of result.notes) console.log(`    - ${n}`);
    if (result.problems.length) {
      console.error(`\n  ${result.problems.length} PROBLEM(S) — the build stops here:`);
      for (const p of result.problems) console.error(`    ✗ ${p}`);
    } else {
      console.log("  ✓ no new copies; every test screen goes through EnginePlay with the real match's settings; the canary is seen.");
    }
  }
  process.exit(result.problems.length ? 1 : 0);
}
