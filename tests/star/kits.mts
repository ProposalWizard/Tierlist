import { CLUB_KITS, kitsOf, kitsFor, clashes, hexToHsl, keeperKit, labelInk } from "../../lib/star/kits";
import { makeInitialCareer } from "../../lib/star/careerFlow";
import { acceptOffer } from "../../lib/star/transfers";

/**
 * Kits.
 *
 * Everybody used to play in the same two colours — you in green, your team-mates
 * in blue, the opposition in red — whoever was actually playing. Now the home
 * side wears its own shirt and the away side changes only when the two would be
 * hard to tell apart, which is the real rule.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

const CLUBS = Object.keys(CLUB_KITS);

// ── Twenty clubs, four colours each ─────────────────────────────────────────
{
  check(CLUBS.length === 20, `twenty clubs have kits (${CLUBS.length})`);
  for (const [club, k] of Object.entries(CLUB_KITS)) {
    for (const [which, kit] of [["home", k.home], ["away", k.away]] as const) {
      check(/^#[0-9A-Fa-f]{6}$/.test(kit.shirt), `${club} ${which}: the shirt is a colour (${kit.shirt})`);
      check(/^#[0-9A-Fa-f]{6}$/.test(kit.trim), `${club} ${which}: the trim is a colour (${kit.trim})`);
      check(!clashes(kit.shirt, kit.trim), `${club} ${which}: you can see the trim against the shirt`);
    }
    // A change strip that looks like the home shirt is not a change strip.
    check(!clashes(k.home.shirt, k.away.shirt),
      `${club}: the away shirt is telling apart from the home one`);
  }
}

// ── The clash rule does what it says ────────────────────────────────────────
{
  // The cases the player named.
  check(!clashes(CLUB_KITS["Arsenal"].home.shirt, CLUB_KITS["Brighton & Hove Albion"].home.shirt),
    "red against blue is not a clash");
  check(clashes(CLUB_KITS["Arsenal"].home.shirt, CLUB_KITS["Liverpool"].home.shirt),
    "red against red is");

  // The ones that catch a naive rule out.
  check(clashes("#FFFFFF", "#F2F4F7"), "white against off-white clashes");
  check(clashes("#241F20", "#132257"), "black against navy clashes");
  check(clashes("#6CABDD", "#034694"), "sky blue against royal blue clashes");
  check(clashes("#670E36", "#7A263A"), "claret against claret clashes");
  check(!clashes("#FDB913", "#241F20"), "gold against black does not");
  check(!clashes("#FFFFFF", "#034694"), "white against royal blue does not");
  check(!clashes("#EF0107", "#FDB913"), "red against gold does not");

  // Symmetric, and nothing clashes with itself being different.
  for (const a of CLUBS) for (const b of CLUBS) {
    const x = CLUB_KITS[a].home.shirt, y = CLUB_KITS[b].home.shirt;
    if (clashes(x, y) !== clashes(y, x)) problems.push(`${a}/${b}: the clash test is not symmetric`);
  }
  check(CLUBS.every(c => clashes(CLUB_KITS[c].home.shirt, CLUB_KITS[c].home.shirt)),
    "a shirt always clashes with itself");
}

// ── Every one of the 380 fixtures produces two shirts you can tell apart ────
{
  let changed = 0, unchanged = 0, emergencies = 0, bad = 0;
  for (const h of CLUBS) {
    for (const a of CLUBS) {
      if (h === a) continue;
      const m = kitsFor(h, a);
      // The home side is always in its own shirt. That is what home means.
      if (m.home.shirt !== CLUB_KITS[h].home.shirt) problems.push(`${h} v ${a}: the home side changed`);
      // And you can always tell them apart.
      if (clashes(m.home.shirt, m.away.shirt)) { bad += 1; problems.push(`${h} v ${a}: the shirts clash`); }
      // …and the keeper from both.
      if (clashes(m.keeper.shirt, m.home.shirt) || clashes(m.keeper.shirt, m.away.shirt)) {
        problems.push(`${h} v ${a}: the keeper clashes with somebody`);
      }
      if (m.away.shirt === CLUB_KITS[a].home.shirt) unchanged += 1;
      else if (m.away.shirt === CLUB_KITS[a].away.shirt) changed += 1;
      else emergencies += 1;
    }
  }
  const total = CLUBS.length * (CLUBS.length - 1);
  check(bad === 0, `every fixture is playable (${bad} clashes in ${total})`);
  check(unchanged > total * 0.6, `most sides keep their own shirt (${unchanged}/${total})`);
  check(changed > 20, `and the ones who would clash change (${changed}/${total})`);
  check(emergencies < total * 0.05, `the last-resort strip is rare (${emergencies}/${total})`);
  console.log(`  ${unchanged} in their own kit, ${changed} changed, ${emergencies} to a neutral`);
}

// ── The named examples ──────────────────────────────────────────────────────
{
  const ab = kitsFor("Arsenal", "Brighton & Hove Albion");
  check(ab.home.shirt === "#EF0107", "Arsenal at home are red");
  check(ab.away.shirt === "#0057B8", "Brighton keep their blue");

  const al = kitsFor("Arsenal", "Liverpool");
  check(al.home.shirt === "#EF0107", "Arsenal at home are still red");
  check(al.away.shirt === "#F2F4F7", `Liverpool change to white (${al.away.shirt})`);

  // …and the other way round, which must not be the same answer.
  const la = kitsFor("Liverpool", "Arsenal");
  check(la.home.shirt === "#C8102E", "at Anfield Liverpool are red");
  check(la.away.shirt !== "#EF0107", `and Arsenal change (${la.away.shirt})`);
}

// ── Names the database might not spell our way ──────────────────────────────
{
  for (const [loose, expect] of [
    ["Wolves", "Wolverhampton Wanderers"], ["Spurs", "Tottenham Hotspur"],
    ["Man City", "Manchester City"], ["Man Utd", "Manchester United"],
    ["Fulham", "Fulham FC"], ["Bournemouth", "AFC Bournemouth"],
    ["Brighton", "Brighton & Hove Albion"], ["Nott'm Forest", "Nottingham Forest"],
  ] as const) {
    check(kitsOf(loose).home.shirt === CLUB_KITS[expect].home.shirt,
      `"${loose}" finds ${expect}`);
  }
  // Somebody we have never heard of still gets a shirt.
  const unknown = kitsOf("Real Nowhere");
  check(/^#[0-9A-Fa-f]{6}$/.test(unknown.home.shirt), "an unknown club still has colours");
  check(!clashes(unknown.home.shirt, unknown.away.shirt), "…and a change strip");
}

// ── The keeper is in neither team's colours ─────────────────────────────────
{
  // The case that made this necessary: Wolves in gold, and a gold keeper.
  const w = kitsFor("Newcastle United", "Wolverhampton Wanderers");
  check(!clashes(w.keeper.shirt, "#FDB913"), `the keeper is not gold against Wolves (${w.keeper.shirt})`);
  const k = keeperKit("#FFFFFF", "#17181A");
  check(!clashes(k.shirt, "#FFFFFF") && !clashes(k.shirt, "#17181A"),
    "white against black still leaves the keeper somewhere to go");
  check(hexToHsl("#FFFFFF").l === 1 && hexToHsl("#000000").l === 0, "the colour maths is sane");
}

// ── The career carries its club's colours ───────────────────────────────────
//
// `kitPrimary` was "#ff0000" and `kitSecondary` "#ffffff" for every club in the
// game, and nothing read either. The media engine builds its whole palette off
// them, so every club's graphics were red.
{
  const CLUBS20 = Object.keys(CLUB_KITS);
  for (const club of ["Manchester City", "Everton", "Wolverhampton Wanderers"]) {
    const player = {
      firstName: "Test", lastName: "Player", age: 17, position: "ST",
      club, nationality: "England",
    } as never;
    const c = makeInitialCareer(player, CLUBS20);
    check(c.kitPrimary === CLUB_KITS[club].home.shirt, `${club} play in their own colours (${c.kitPrimary})`);
    check(c.kitSecondary === CLUB_KITS[club].home.trim, `${club} have their own trim (${c.kitSecondary})`);
  }

  // …and a transfer changes them.
  const player = {
    firstName: "Test", lastName: "Player", age: 17, position: "ST",
    club: "Liverpool", nationality: "England",
  } as never;
  const before = makeInitialCareer(player, CLUBS20);
  const after = acceptOffer(before, {
    club: "Everton", wage: 100, signingFee: 1000, goalBonus: 1, assistBonus: 1, seasons: 4,
  } as never);
  check(after.kitPrimary === CLUB_KITS["Everton"].home.shirt,
    `signing for Everton puts you in blue (${after.kitPrimary})`);
  check(after.kitPrimary !== before.kitPrimary, "and not the shirt you arrived in");
}

// ── The label stays readable whatever the shirt ─────────────────────────────
{
  for (const [club, k] of Object.entries(CLUB_KITS)) {
    for (const kit of [k.home, k.away]) {
      const ink = labelInk(kit.shirt);
      check(clashes(ink, kit.shirt) === false || Math.abs(hexToHsl(ink).l - hexToHsl(kit.shirt).l) > 0.35,
        `${club}: YOU can be read on ${kit.shirt} (ink ${ink})`);
    }
  }
  check(labelInk("#FFFFFF") === "#111827", "dark ink on a white shirt");
  check(labelInk("#17181A") === "#FFFFFF", "white ink on a black one");
}

if (problems.length) {
  console.error("FAIL");
  for (const p of problems.slice(0, 15)) console.error("  ✗ " + p);
  if (problems.length > 15) console.error(`  …and ${problems.length - 15} more`);
  process.exit(1);
}
console.log("PASS — the home side wears its own shirt, and you can always tell the two apart");
