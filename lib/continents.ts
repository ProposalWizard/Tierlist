// Maps SoFIFA/FIFA nationality strings to a continent, for continent-based objective conditions.
// Best-effort geographic classification — a few transcontinental nations (Russia, Turkey, Georgia,
// Armenia, Azerbaijan, Cyprus, Israel) are grouped with Europe/Asia per common football convention
// rather than strict geography. If a nation is missing or misclassified, it can be added below.

export type Continent = "Europe" | "Africa" | "South America" | "North America" | "Asia" | "Oceania";

export const CONTINENTS: Continent[] = ["Europe", "Africa", "South America", "North America", "Asia", "Oceania"];

const CONTINENT_NATIONS: Record<Continent, string[]> = {
  Europe: [
    "England", "Scotland", "Wales", "Northern Ireland", "Republic of Ireland", "Ireland",
    "France", "Germany", "Spain", "Italy", "Portugal", "Netherlands", "Belgium",
    "Switzerland", "Austria", "Poland", "Sweden", "Norway", "Denmark", "Finland",
    "Iceland", "Russia", "Ukraine", "Czech Republic", "Slovakia", "Hungary", "Romania",
    "Croatia", "Serbia", "Slovenia", "Bosnia and Herzegovina", "Bosnia Herzegovina",
    "Montenegro", "North Macedonia", "FYR Macedonia", "Macedonia", "Albania", "Greece",
    "Bulgaria", "Cyprus", "Luxembourg", "Malta", "Andorra", "San Marino", "Monaco",
    "Liechtenstein", "Kosovo", "Moldova", "Belarus", "Georgia", "Armenia", "Azerbaijan",
    "Turkey", "Israel", "Estonia", "Latvia", "Lithuania", "Faroe Islands", "Gibraltar",
  ],
  Africa: [
    "Nigeria", "Ghana", "Senegal", "Ivory Coast", "Cote d'Ivoire", "Cameroon", "Mali",
    "Algeria", "Morocco", "Tunisia", "Egypt", "South Africa", "DR Congo", "Congo DR",
    "Congo", "Zambia", "Zimbabwe", "Kenya", "Uganda", "Tanzania", "Ethiopia", "Angola",
    "Mozambique", "Guinea", "Guinea-Bissau", "Burkina Faso", "Benin", "Togo", "Niger",
    "Chad", "Gabon", "Gambia", "Sierra Leone", "Liberia", "Mauritania", "Namibia",
    "Botswana", "Malawi", "Rwanda", "Burundi", "Sudan", "South Sudan", "Libya",
    "Equatorial Guinea", "Central African Republic", "Cape Verde", "Comoros",
    "Madagascar", "Mauritius", "Eswatini", "Swaziland", "Lesotho", "Somalia",
    "Eritrea", "Djibouti", "Congo Republic",
  ],
  "South America": [
    "Argentina", "Brazil", "Chile", "Uruguay", "Paraguay", "Bolivia", "Peru",
    "Ecuador", "Colombia", "Venezuela", "Guyana", "Suriname",
  ],
  "North America": [
    "United States", "USA", "Canada", "Mexico", "Costa Rica", "Honduras", "Panama",
    "Jamaica", "Guatemala", "El Salvador", "Nicaragua", "Trinidad and Tobago",
    "Trinidad & Tobago", "Haiti", "Cuba", "Dominican Republic", "Belize",
    "Bahamas", "Barbados", "Curacao", "Curaçao", "Antigua and Barbuda", "Grenada",
    "Saint Kitts and Nevis", "Saint Lucia", "Saint Vincent and the Grenadines",
    "Bermuda", "Guadeloupe", "Martinique", "Puerto Rico",
  ],
  Asia: [
    "Japan", "Korea Republic", "South Korea", "Korea DPR", "North Korea", "China PR",
    "China", "Saudi Arabia", "Iran", "Iraq", "Qatar", "United Arab Emirates", "UAE",
    "Jordan", "Lebanon", "Syria", "Kuwait", "Bahrain", "Oman", "Yemen", "Uzbekistan",
    "Kazakhstan", "Kyrgyzstan", "Tajikistan", "Turkmenistan", "Afghanistan",
    "Pakistan", "India", "Bangladesh", "Sri Lanka", "Nepal", "Maldives", "Bhutan",
    "Thailand", "Vietnam", "Indonesia", "Malaysia", "Philippines", "Singapore",
    "Myanmar", "Cambodia", "Laos", "Brunei", "Timor-Leste", "Mongolia", "Hong Kong",
    "Chinese Taipei", "Taiwan", "Palestine", "Macau",
  ],
  Oceania: [
    "Australia", "New Zealand", "Fiji", "Papua New Guinea", "Solomon Islands",
    "Vanuatu", "New Caledonia", "Tahiti", "Samoa", "American Samoa", "Tonga",
    "Cook Islands",
  ],
};

const NATION_TO_CONTINENT = new Map<string, Continent>();
for (const continent of CONTINENTS) {
  for (const nation of CONTINENT_NATIONS[continent]) {
    NATION_TO_CONTINENT.set(nation.toLowerCase(), continent);
  }
}

export function continentForNationality(nationality: string | undefined): Continent | null {
  if (!nationality) return null;
  return NATION_TO_CONTINENT.get(nationality.trim().toLowerCase()) ?? null;
}
