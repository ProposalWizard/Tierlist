// Converts a nationality string (as used by SoFIFA) to a flag emoji.
// Falls back to "" when the nationality is unknown — callers should fall back to the text name.

function isoToFlagEmoji(iso2: string): string {
  // Regional Indicator Symbols: A=0x1F1E6, B=0x1F1E7, ...
  const upper = iso2.toUpperCase();
  return (
    String.fromCodePoint(0x1F1E6 + (upper.charCodeAt(0) - 65)) +
    String.fromCodePoint(0x1F1E6 + (upper.charCodeAt(1) - 65))
  );
}

// Subdivision flags that can't be represented with standard Regional Indicators
const SUBDIVISION_FLAGS: Record<string, string> = {
  "England":          "\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}",
  "Scotland":         "\u{1F3F4}\u{E0067}\u{E0062}\u{E0073}\u{E0063}\u{E0074}\u{E007F}",
  "Wales":            "\u{1F3F4}\u{E0067}\u{E0062}\u{E0077}\u{E006C}\u{E0073}\u{E007F}",
  "Northern Ireland": "\u{1F3F4}\u{E0067}\u{E0062}\u{E006E}\u{E0069}\u{E0072}\u{E007F}",
};

// Maps SoFIFA nationality name to ISO 3166-1 alpha-2 code
const NATIONALITY_ISO: Record<string, string> = {
  // British Isles — handled by SUBDIVISION_FLAGS above (omitted here, they get the special emoji)
  "Republic of Ireland": "IE", "Ireland": "IE",
  "Great Britain": "GB",

  // Europe
  "France": "FR", "Germany": "DE", "Spain": "ES", "Italy": "IT",
  "Portugal": "PT", "Netherlands": "NL", "Belgium": "BE",
  "Switzerland": "CH", "Austria": "AT", "Poland": "PL",
  "Sweden": "SE", "Norway": "NO", "Denmark": "DK", "Finland": "FI",
  "Iceland": "IS", "Russia": "RU", "Ukraine": "UA",
  "Czech Republic": "CZ", "Czechia": "CZ",
  "Slovakia": "SK", "Hungary": "HU", "Romania": "RO",
  "Croatia": "HR", "Serbia": "RS", "Slovenia": "SI",
  "Bosnia and Herzegovina": "BA", "Bosnia Herzegovina": "BA",
  "Montenegro": "ME",
  "North Macedonia": "MK", "FYR Macedonia": "MK", "Macedonia": "MK",
  "Albania": "AL", "Greece": "GR", "Bulgaria": "BG",
  "Cyprus": "CY", "Luxembourg": "LU", "Malta": "MT",
  "Andorra": "AD", "San Marino": "SM", "Monaco": "MC",
  "Liechtenstein": "LI", "Kosovo": "XK",
  "Moldova": "MD", "Belarus": "BY",
  "Georgia": "GE", "Armenia": "AM", "Azerbaijan": "AZ",
  "Turkey": "TR", "Israel": "IL",
  "Estonia": "EE", "Latvia": "LV", "Lithuania": "LT",
  "Faroe Islands": "FO", "Gibraltar": "GI",

  // Africa
  "Nigeria": "NG", "Ghana": "GH", "Senegal": "SN",
  "Ivory Coast": "CI", "Cote d'Ivoire": "CI",
  "Cameroon": "CM", "Mali": "ML", "Algeria": "DZ",
  "Morocco": "MA", "Tunisia": "TN", "Egypt": "EG",
  "South Africa": "ZA",
  "DR Congo": "CD", "Congo DR": "CD", "Democratic Republic of the Congo": "CD",
  "Congo": "CG", "Congo Republic": "CG",
  "Zambia": "ZM", "Zimbabwe": "ZW", "Kenya": "KE",
  "Uganda": "UG", "Tanzania": "TZ", "Ethiopia": "ET",
  "Angola": "AO", "Mozambique": "MZ", "Guinea": "GN",
  "Guinea-Bissau": "GW", "Burkina Faso": "BF",
  "Benin": "BJ", "Togo": "TG", "Niger": "NE", "Chad": "TD",
  "Gabon": "GA", "Gambia": "GM", "Sierra Leone": "SL",
  "Liberia": "LR", "Mauritania": "MR", "Namibia": "NA",
  "Botswana": "BW", "Malawi": "MW", "Rwanda": "RW",
  "Burundi": "BI", "Sudan": "SD", "South Sudan": "SS",
  "Libya": "LY", "Equatorial Guinea": "GQ",
  "Central African Republic": "CF", "Cape Verde": "CV",
  "Comoros": "KM", "Madagascar": "MG", "Mauritius": "MU",
  "Eswatini": "SZ", "Swaziland": "SZ", "Lesotho": "LS",
  "Somalia": "SO", "Eritrea": "ER", "Djibouti": "DJ",

  // South America
  "Argentina": "AR", "Brazil": "BR", "Chile": "CL",
  "Uruguay": "UY", "Paraguay": "PY", "Bolivia": "BO",
  "Peru": "PE", "Ecuador": "EC", "Colombia": "CO",
  "Venezuela": "VE", "Guyana": "GY", "Suriname": "SR",

  // North & Central America / Caribbean
  "United States": "US", "USA": "US",
  "Canada": "CA", "Mexico": "MX",
  "Costa Rica": "CR", "Honduras": "HN", "Panama": "PA",
  "Jamaica": "JM", "Guatemala": "GT", "El Salvador": "SV",
  "Nicaragua": "NI",
  "Trinidad and Tobago": "TT", "Trinidad & Tobago": "TT",
  "Haiti": "HT", "Cuba": "CU", "Dominican Republic": "DO",
  "Belize": "BZ", "Bahamas": "BS", "Barbados": "BB",
  "Curacao": "CW", "Curaçao": "CW",
  "Antigua and Barbuda": "AG", "Grenada": "GD",
  "Saint Kitts and Nevis": "KN",
  "Saint Lucia": "LC",
  "Saint Vincent and the Grenadines": "VC",
  "Bermuda": "BM", "Puerto Rico": "PR",
  "Guadeloupe": "GP", "Martinique": "MQ",

  // Asia
  "Japan": "JP",
  "Korea Republic": "KR", "South Korea": "KR",
  "Korea DPR": "KP", "North Korea": "KP",
  "China PR": "CN", "China": "CN",
  "Saudi Arabia": "SA", "Iran": "IR", "Iraq": "IQ",
  "Qatar": "QA", "United Arab Emirates": "AE", "UAE": "AE",
  "Jordan": "JO", "Lebanon": "LB", "Syria": "SY",
  "Kuwait": "KW", "Bahrain": "BH", "Oman": "OM", "Yemen": "YE",
  "Uzbekistan": "UZ", "Kazakhstan": "KZ", "Kyrgyzstan": "KG",
  "Tajikistan": "TJ", "Turkmenistan": "TM",
  "Afghanistan": "AF", "Pakistan": "PK",
  "India": "IN", "Bangladesh": "BD", "Sri Lanka": "LK",
  "Nepal": "NP", "Maldives": "MV", "Bhutan": "BT",
  "Thailand": "TH", "Vietnam": "VN",
  "Indonesia": "ID", "Malaysia": "MY",
  "Philippines": "PH", "Singapore": "SG",
  "Myanmar": "MM", "Cambodia": "KH", "Laos": "LA",
  "Brunei": "BN", "Timor-Leste": "TL",
  "Mongolia": "MN", "Hong Kong": "HK",
  "Chinese Taipei": "TW", "Taiwan": "TW",
  "Palestine": "PS", "Macau": "MO",

  // Oceania
  "Australia": "AU", "New Zealand": "NZ",
  "Fiji": "FJ", "Papua New Guinea": "PG",
  "Solomon Islands": "SB", "Vanuatu": "VU",
  "Samoa": "WS", "American Samoa": "AS",
  "Tonga": "TO", "Cook Islands": "CK",
  "New Caledonia": "NC", "Tahiti": "PF",
};

export function nationalityFlag(nationality: string | null | undefined): string {
  if (!nationality) return "";
  // Check subdivision flags first (England, Scotland, Wales, Northern Ireland)
  if (SUBDIVISION_FLAGS[nationality]) return SUBDIVISION_FLAGS[nationality];
  // Full country name → ISO → emoji
  const iso = NATIONALITY_ISO[nationality];
  if (iso) return isoToFlagEmoji(iso);
  // Direct ISO code fallback: some DB rows store "SN", "GW" etc. instead of the full name
  if (nationality.length === 2) return isoToFlagEmoji(nationality.toUpperCase());
  return "";
}
