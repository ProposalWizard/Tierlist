import { NATIONS } from "../../lib/star/intl/nations";
import { nationKitProfile } from "../../lib/star/data/nationKits";
import { nationKits } from "../../lib/star/international";
import { clashes, kitsFor } from "../../lib/star/kits";

/**
 * NATION KITS (Leo, 13 Oct 2026): every nation in the game has its real home
 * and away kit (data/sources/nation_kits_2026-10.json), worn in international
 * matches. Before: 15 nations had colours, 196 wore the same grey.
 */
const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };
const GREY = "#e5e7eb";

const hex = /^#[0-9A-F]{6}$/i;
let patterned = 0;
for (const n of NATIONS) {
  const p = nationKitProfile(n.name);
  check(!!p, `${n.name} has kits`);
  if (!p) continue;
  for (const [side, k] of [["home", p.homeKit], ["away", p.awayKit]] as const) {
    check(hex.test(k.shirtHex ?? ""), `${n.name} ${side}: shirt colour`);
    check(hex.test(k.shortsHex ?? "") && hex.test(k.socksHex ?? ""), `${n.name} ${side}: shorts and socks`);
    check(!!k.pattern && !!k.shirt, `${n.name} ${side}: pattern in words`);
    if (/stripe|hoop|halves|band|sash|sleeve|graphic|pattern|check|cross|chevron|zigzag|motif|fading|lines|star/i.test(k.pattern ?? "")) patterned++;
  }
  check(p.source.startsWith("https://en.wikipedia.org/wiki/"), `${n.name}: source page`);
  const worn = nationKits(n.name);
  check(worn.home.shirt !== GREY, `${n.name} no longer wears the grey placeholder`);
  for (const side of ["home", "away"] as const) {
    check(!clashes(worn[side].shirt, worn[side].trim), `${n.name} ${side}: trim readable on the shirt`);
  }
}
// Spellings the game uses elsewhere find the same kits.
check(nationKitProfile("Turkey") === nationKitProfile("Türkiye"), "Turkey / Türkiye");
check(nationKitProfile("Ivory Coast") === nationKitProfile("Côte d'Ivoire"), "Ivory Coast / Côte d'Ivoire");
check(nationKitProfile("USA") === nationKitProfile("United States"), "USA / United States");
// A few known shirts, by colour family.
const near = (a: string, b: string) => clashes(a, b);
check(near(nationKits("Brazil").home.shirt, "#FBE300"), "Brazil play in yellow");
check(near(nationKits("Netherlands").home.shirt, "#F78F1E"), "Netherlands play in orange");
check(near(nationKits("Italy").home.shirt, "#0057B8") || near(nationKits("Italy").home.shirt, "#1F4FB5"), "Italy play in blue");
// Two nations in the same colours: one changes.
const m = kitsFor("England", "Germany", nationKits("England"), nationKits("Germany"));
check(!clashes(m.home.shirt, m.away.shirt), "England v Germany: the away side changes");

console.log(`${NATIONS.length} nations with kits; ${patterned} of ${NATIONS.length * 2} kits have a design beyond a plain shirt with trim`);
if (problems.length) { console.error("FAIL\n  - " + problems.slice(0, 30).join("\n  - ")); process.exit(1); }
console.log("PASS — every nation wears its own real home and away kit");
