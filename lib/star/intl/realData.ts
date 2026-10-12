/**
 * THE REAL STARTING POINT — competitions already drawn before the game's
 * first season, copied as they really are (sources read 12 Oct 2026).
 *
 * Mikey, 12 Oct 2026: "for the Nations League there are already groups right
 * now so you could just start the game with those groups".
 *
 * Names are written the common way; `realNation` turns each into the game's
 * spelling and drops any team that is not a FIFA member (CONCACAF's French
 * overseas departments and Sint Maarten/Bonaire play in CONCACAF but are not
 * FIFA nations, and the nationality picker no longer offers them).
 */
import { nationFor } from "./nations";

export function realNation(name: string): string | null {
  return nationFor(name)?.name ?? null;
}

export function realList(names: string[]): string[] {
  return names.map(realNation).filter((n): n is string => !!n);
}

/** UEFA Nations League 2026–27 (drawn 12 Feb 2026). */
export const UNL_2026: Record<string, string[]> = {
  A1: ["France", "Italy", "Belgium", "Turkey"],
  A2: ["Netherlands", "Greece", "Germany", "Serbia"],
  A3: ["Spain", "England", "Croatia", "Czech Republic"],
  A4: ["Portugal", "Denmark", "Wales", "Norway"],
  B1: ["Switzerland", "Slovenia", "Scotland", "North Macedonia"],
  B2: ["Northern Ireland", "Hungary", "Ukraine", "Georgia"],
  B3: ["Austria", "Kosovo", "Republic of Ireland", "Israel"],
  B4: ["Sweden", "Bosnia and Herzegovina", "Poland", "Romania"],
  C1: ["Albania", "Belarus", "Finland", "San Marino"],
  C2: ["Montenegro", "Cyprus", "Armenia", "Latvia"],
  C3: ["Slovakia", "Faroe Islands", "Moldova", "Kazakhstan"],
  C4: ["Iceland", "Estonia", "Bulgaria", "Luxembourg"],
  D1: ["Malta", "Gibraltar", "Andorra"],
  D2: ["Azerbaijan", "Lithuania", "Liechtenstein"],
};

/** Africa Cup of Nations 2027 qualifying (drawn 19 May 2026). */
export const AFCONQ_2027: Record<string, string[]> = {
  A: ["Morocco", "Gabon", "Niger", "Lesotho"],
  B: ["Egypt", "Angola", "Malawi", "South Sudan"],
  C: ["Ivory Coast", "Gambia", "Somalia", "Ghana"],
  D: ["South Africa", "Guinea", "Kenya", "Eritrea"],
  E: ["DR Congo", "Zimbabwe", "Equatorial Guinea", "Sierra Leone"],
  F: ["Benin", "Burkina Faso", "Mauritania", "Central African Republic"],
  G: ["Cameroon", "Comoros", "Namibia", "Congo"],
  H: ["Uganda", "Botswana", "Tunisia", "Libya"],
  I: ["Algeria", "Zambia", "Togo", "Burundi"],
  J: ["Mozambique", "Senegal", "Sudan", "Ethiopia"],
  K: ["Rwanda", "Mali", "Cape Verde", "Liberia"],
  L: ["Guinea-Bissau", "Nigeria", "Madagascar", "Tanzania"],
};
export const AFCON_2027_HOSTS = ["Kenya", "Uganda", "Tanzania"];

/** AFC Asian Cup 2027 final tournament groups. */
export const ASIAN_CUP_2027: Record<string, string[]> = {
  A: ["Saudi Arabia", "Kuwait", "Oman", "Palestine"],
  B: ["Uzbekistan", "Bahrain", "North Korea", "Jordan"],
  C: ["Iran", "Syria", "Kyrgyzstan", "China"],
  D: ["Australia", "Tajikistan", "Iraq", "Singapore"],
  E: ["South Korea", "United Arab Emirates", "Vietnam", "Yemen"],
  F: ["Japan", "Qatar", "Thailand", "Indonesia"],
};

/** CONCACAF Nations League 2026–27 leagues (41 members; FIFA nations kept). */
export const CNL_2026 = {
  A: ["Canada", "Costa Rica", "Curaçao", "Dominican Republic", "El Salvador", "Guatemala", "Haiti",
    "Honduras", "Jamaica", "Martinique", "Mexico", "Nicaragua", "Panama", "Suriname",
    "Trinidad and Tobago", "United States"],
  B: ["Barbados", "Belize", "Bermuda", "Bonaire", "Cayman Islands", "Cuba", "Dominica", "French Guiana",
    "Grenada", "Guadeloupe", "Guyana", "Puerto Rico", "Saint Kitts and Nevis", "Saint Lucia",
    "Saint Vincent and the Grenadines", "Sint Maarten"],
  C: ["Anguilla", "Antigua and Barbuda", "Aruba", "Bahamas", "British Virgin Islands", "Montserrat",
    "Saint Martin", "Turks and Caicos Islands", "US Virgin Islands"],
};

/** Euro 2028 hosts (England, Scotland, Wales, Republic of Ireland). */
export const EURO_HOSTS: Record<number, string[]> = {
  2028: ["England", "Scotland", "Wales", "Republic of Ireland"],
  2032: ["Italy", "Turkey"],
};

/** World Cup hosts known today. Later ones are chosen in hosts.ts. */
export const WORLD_CUP_HOSTS: Record<number, string[]> = {
  2030: ["Morocco", "Portugal", "Spain", "Argentina", "Paraguay", "Uruguay"],
  2034: ["Saudi Arabia"],
};
