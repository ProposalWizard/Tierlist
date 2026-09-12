import { startNegotiation, makeOffer, moodToFace } from "../../lib/star/negotiation";

/**
 * NEGOTIATION — A REAL BACK-AND-FORTH, NOT A FIXED FEE.
 *
 * Requested directly: buying/selling a player should be a real negotiation
 * where you can get a better deal — or a worse one, or walk away with
 * nothing — not a single number you always just pay/receive. Checks:
 * opening anchors are genuinely away from market value in the right
 * direction, a generous offer closes fast, a stubborn lowball can make them
 * walk away, and the whole thing terminates (never loops forever).
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

function seededRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const MV = 10_000_000;

// ── Opening anchors are real, and away from market value in the right direction ──
{
  const rng = seededRng(1);
  const buying = startNegotiation(MV, "buying", rng);
  check(buying.theirPosition > MV, `buying: the seller opens ABOVE market value (${buying.theirPosition} vs ${MV})`);
  check(buying.yourPosition < MV, `buying: your own opening offer anchors below market value too (${buying.yourPosition})`);

  const selling = startNegotiation(MV, "selling", rng);
  check(selling.theirPosition < MV, `selling: the buyer opens BELOW market value (${selling.theirPosition} vs ${MV})`);
  check(selling.yourPosition > MV, `selling: your own asking price anchors above market value (${selling.yourPosition})`);
}

// ── A generous offer (meeting or beating their position) closes immediately ──
{
  const rng = seededRng(2);
  let state = startNegotiation(MV, "buying", rng);
  state = makeOffer(state, state.theirPosition, rng); // meet their exact ask
  check(state.status === "accepted", "buying: meeting their exact ask closes the deal");
  check(state.finalPrice !== undefined && state.finalPrice <= state.theirPosition + 1, "buying: the final price is never more than what they asked");
}

// ── Selling mirrors buying ────────────────────────────────────────────────
{
  const rng = seededRng(3);
  let state = startNegotiation(MV, "selling", rng);
  state = makeOffer(state, state.theirPosition, rng); // accept their exact offer as your ask
  check(state.status === "accepted", "selling: matching their offer as your ask closes the deal");
}

// ── The negotiation always terminates, never loops forever ─────────────
{
  for (let trial = 0; trial < 20; trial++) {
    const rng = seededRng(100 + trial);
    let state = startNegotiation(MV, "buying", rng);
    let iterations = 0;
    // Keep offering something modestly better than your last position —
    // never the generous full-meet — to force the negotiation through its
    // full round budget.
    while (state.status === "negotiating" && iterations < 50) {
      const nextOffer = Math.round(state.yourPosition + (state.theirPosition - state.yourPosition) * 0.1);
      state = makeOffer(state, nextOffer, rng);
      iterations++;
    }
    check(state.status !== "negotiating", `trial ${trial}: negotiation reaches a real conclusion within a bounded number of rounds (status=${state.status}, iterations=${iterations})`);
    check(iterations < 50, `trial ${trial}: never needed anywhere close to 50 rounds to conclude (took ${iterations})`);
  }
}

// ── Patience genuinely pays: a negotiator who concedes slowly ends up
// paying less, on average, than one who caves to their exact opening ask ──
{
  let patientTotal = 0, patientDeals = 0;
  let impatientTotal = 0, impatientDeals = 0;
  for (let trial = 0; trial < 150; trial++) {
    const rngA = seededRng(trial * 11 + 1);
    let patient = startNegotiation(MV, "buying", rngA);
    const openingAsk = patient.theirPosition;
    while (patient.status === "negotiating") {
      const nextOffer = Math.round(patient.yourPosition + (patient.theirPosition - patient.yourPosition) * 0.2);
      patient = makeOffer(patient, nextOffer, rngA);
    }
    if (patient.status === "accepted" && patient.finalPrice !== undefined) { patientTotal += patient.finalPrice; patientDeals++; }

    const rngB = seededRng(trial * 11 + 1); // same seed — same opening anchors, fair comparison
    let impatient = startNegotiation(MV, "buying", rngB);
    impatient = makeOffer(impatient, openingAsk, rngB); // cave immediately to their opening ask
    if (impatient.status === "accepted" && impatient.finalPrice !== undefined) { impatientTotal += impatient.finalPrice; impatientDeals++; }
  }
  check(patientDeals > 0 && impatientDeals > 0, "both strategies produce real completed deals to compare");
  const patientAvg = patientTotal / patientDeals;
  const impatientAvg = impatientTotal / impatientDeals;
  check(patientAvg < impatientAvg, `haggling patiently ends up cheaper on average than caving to the opening ask (${Math.round(patientAvg)} vs ${Math.round(impatientAvg)})`);
}

// ── Repeatedly lowballing (never moving) sours mood and can end in a walkout ──
{
  let sawWalkout = false;
  for (let trial = 0; trial < 100 && !sawWalkout; trial++) {
    const rng = seededRng(trial * 13 + 3);
    let state = startNegotiation(MV, "buying", rng);
    // Repeat the exact same lowball offer every round — never moving toward them.
    const stubbornOffer = state.yourPosition;
    for (let i = 0; i < 8 && state.status === "negotiating"; i++) {
      state = makeOffer(state, stubbornOffer, rng);
    }
    if (state.status === "walked_away") sawWalkout = true;
  }
  check(sawWalkout, "repeatedly refusing to concede can genuinely make the counterpart walk away, across enough trials");
}

// ── moodToFace maps to a real, distinct set of faces ────────────────────
{
  const rng = seededRng(4);
  const happy = startNegotiation(MV, "buying", rng);
  const face = moodToFace({ ...happy, moodScore: 80 });
  const angryFace = moodToFace({ ...happy, moodScore: 10 });
  const neutralFace = moodToFace({ ...happy, moodScore: 50 });
  check(face === "happy", `a high mood score reads as happy (got ${face})`);
  check(angryFace === "angry", `a low mood score reads as angry (got ${angryFace})`);
  check(neutralFace === "neutral", `a middling mood score reads as neutral (got ${neutralFace})`);
}

if (problems.length) {
  console.log("FAIL");
  for (const p of problems) console.log(`  ✗ ${p}`);
  process.exit(1);
}
console.log("PASS — negotiations open away from fair value in the right direction, a generous offer closes fast, stubbornness can genuinely blow up the deal, and every negotiation reaches a real conclusion");
