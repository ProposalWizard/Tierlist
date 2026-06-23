// Champions League team participation data.
// `name` = SoFIFA database club name (used for roster API lookups).
// `displayName` = shown in the UI spin.
// `fifaYears` = FIFA edition years where this club was in the CL group/league stage.
//   e.g. fifaYear 2011 → CL season 2010/11 → fetches FIFA 11 roster.
//
// DATA STATUS: populated from memory — some entries may be inaccurate or missing.
// The user can verify and expand this list. Missing club-year combos just mean
// fewer spin options, not a broken game.

export interface CLClub {
  name: string;
  displayName: string;
  country: string;
  strength: number;
  fifaYears: number[];
}

export const CL_CLUBS: CLClub[] = [
  // ── Spain ──
  {
    name: "Real Madrid CF", displayName: "Real Madrid", country: "Spain", strength: 90,
    fifaYears: [2007,2008,2009,2010,2011,2012,2013,2014,2015,2016,2017,2018,2019,2020,2021,2022,2023,2024,2025,2026],
  },
  {
    name: "FC Barcelona", displayName: "Barcelona", country: "Spain", strength: 88,
    fifaYears: [2007,2008,2009,2010,2011,2012,2013,2014,2015,2016,2017,2018,2019,2020,2021,2022,2023,2025,2026],
  },
  {
    name: "Atlético Madrid", displayName: "Atlético Madrid", country: "Spain", strength: 83,
    fifaYears: [2009,2010,2014,2015,2016,2017,2018,2019,2020,2021,2022,2023,2024,2025,2026],
  },
  {
    name: "Sevilla FC", displayName: "Sevilla", country: "Spain", strength: 78,
    fifaYears: [2008,2010,2016,2017,2018,2022,2023,2024],
  },
  {
    name: "Valencia CF", displayName: "Valencia", country: "Spain", strength: 77,
    fifaYears: [2007,2008,2010,2011,2012,2013,2019,2020],
  },
  {
    name: "Villarreal CF", displayName: "Villarreal", country: "Spain", strength: 77,
    fifaYears: [2009,2012,2022,2023],
  },
  {
    name: "Real Sociedad", displayName: "Real Sociedad", country: "Spain", strength: 76,
    fifaYears: [2024],
  },

  // ── England ──
  {
    name: "Manchester United", displayName: "Man United", country: "England", strength: 84,
    fifaYears: [2007,2008,2009,2010,2011,2012,2013,2014,2015,2016,2018,2022,2024],
  },
  {
    name: "Chelsea", displayName: "Chelsea", country: "England", strength: 83,
    fifaYears: [2007,2008,2009,2010,2011,2012,2013,2014,2015,2016,2017,2018,2020,2021,2022,2023],
  },
  {
    name: "Liverpool", displayName: "Liverpool", country: "England", strength: 85,
    fifaYears: [2007,2008,2009,2010,2015,2018,2019,2020,2021,2022,2023,2024,2025,2026],
  },
  {
    name: "Arsenal", displayName: "Arsenal", country: "England", strength: 83,
    fifaYears: [2007,2008,2009,2010,2011,2012,2013,2014,2015,2016,2017,2024,2025,2026],
  },
  {
    name: "Manchester City", displayName: "Man City", country: "England", strength: 88,
    fifaYears: [2012,2013,2014,2015,2016,2017,2018,2019,2020,2021,2022,2023,2024,2025,2026],
  },
  {
    name: "Tottenham Hotspur", displayName: "Tottenham", country: "England", strength: 79,
    fifaYears: [2011,2012,2018,2019,2020],
  },
  {
    name: "Newcastle United", displayName: "Newcastle", country: "England", strength: 77,
    fifaYears: [2024],
  },
  {
    name: "Aston Villa", displayName: "Aston Villa", country: "England", strength: 76,
    fifaYears: [2025],
  },

  // ── Germany ──
  {
    name: "FC Bayern München", displayName: "Bayern Munich", country: "Germany", strength: 88,
    fifaYears: [2007,2008,2009,2010,2011,2012,2013,2014,2015,2016,2017,2018,2019,2020,2021,2022,2023,2024,2025,2026],
  },
  {
    name: "Borussia Dortmund", displayName: "Dortmund", country: "Germany", strength: 82,
    fifaYears: [2012,2013,2014,2015,2017,2018,2019,2020,2021,2022,2023,2024,2025,2026],
  },
  {
    name: "Bayer 04 Leverkusen", displayName: "Leverkusen", country: "Germany", strength: 80,
    fifaYears: [2007,2012,2015,2016,2017,2020,2025,2026],
  },
  {
    name: "FC Schalke 04", displayName: "Schalke 04", country: "Germany", strength: 76,
    fifaYears: [2008,2009,2011,2012,2013,2014,2015,2019],
  },
  {
    name: "VfL Wolfsburg", displayName: "Wolfsburg", country: "Germany", strength: 74,
    fifaYears: [2010,2016],
  },
  {
    name: "RB Leipzig", displayName: "RB Leipzig", country: "Germany", strength: 79,
    fifaYears: [2020,2021,2022,2023,2024,2025],
  },
  {
    name: "VfB Stuttgart", displayName: "Stuttgart", country: "Germany", strength: 76,
    fifaYears: [2008,2009,2025],
  },

  // ── Italy ──
  {
    name: "Juventus", displayName: "Juventus", country: "Italy", strength: 83,
    fifaYears: [2009,2010,2013,2014,2015,2016,2017,2018,2019,2020,2021,2022,2023],
  },
  {
    name: "AC Milan", displayName: "AC Milan", country: "Italy", strength: 82,
    fifaYears: [2007,2008,2009,2010,2011,2012,2013,2014,2022,2023,2024,2025],
  },
  {
    name: "Inter", displayName: "Inter Milan", country: "Italy", strength: 83,
    fifaYears: [2007,2008,2009,2010,2011,2012,2013,2019,2020,2021,2022,2023,2024,2025,2026],
  },
  {
    name: "SSC Napoli", displayName: "Napoli", country: "Italy", strength: 81,
    fifaYears: [2012,2013,2014,2017,2018,2019,2020,2023,2024,2025],
  },
  {
    name: "AS Roma", displayName: "Roma", country: "Italy", strength: 79,
    fifaYears: [2007,2008,2009,2011,2015,2018,2019],
  },
  {
    name: "Atalanta", displayName: "Atalanta", country: "Italy", strength: 78,
    fifaYears: [2020,2021,2025,2026],
  },
  {
    name: "SS Lazio", displayName: "Lazio", country: "Italy", strength: 76,
    fifaYears: [2008,2021],
  },

  // ── France ──
  {
    name: "Paris Saint-Germain", displayName: "PSG", country: "France", strength: 86,
    fifaYears: [2013,2014,2015,2016,2017,2018,2019,2020,2021,2022,2023,2024,2025,2026],
  },
  {
    name: "Olympique Lyonnais", displayName: "Lyon", country: "France", strength: 77,
    fifaYears: [2007,2008,2009,2010,2011,2012,2020],
  },
  {
    name: "Olympique de Marseille", displayName: "Marseille", country: "France", strength: 76,
    fifaYears: [2008,2010,2011,2012,2013,2021,2023],
  },
  {
    name: "LOSC Lille", displayName: "Lille", country: "France", strength: 76,
    fifaYears: [2007,2012,2020,2022,2025,2026],
  },
  {
    name: "AS Monaco", displayName: "Monaco", country: "France", strength: 77,
    fifaYears: [2015,2017,2018],
  },
  {
    name: "Stade Brestois 29", displayName: "Brest", country: "France", strength: 72,
    fifaYears: [2025],
  },

  // ── Portugal ──
  {
    name: "FC Porto", displayName: "Porto", country: "Portugal", strength: 79,
    fifaYears: [2007,2008,2009,2010,2011,2012,2013,2014,2015,2016,2018,2019,2020,2021,2022,2023,2024],
  },
  {
    name: "SL Benfica", displayName: "Benfica", country: "Portugal", strength: 79,
    fifaYears: [2007,2008,2012,2013,2014,2015,2016,2017,2018,2019,2020,2022,2023,2024,2025,2026],
  },
  {
    name: "Sporting CP", displayName: "Sporting CP", country: "Portugal", strength: 77,
    fifaYears: [2007,2008,2009,2022,2023,2025,2026],
  },

  // ── Netherlands ──
  {
    name: "AFC Ajax", displayName: "Ajax", country: "Netherlands", strength: 77,
    fifaYears: [2011,2012,2013,2014,2015,2019,2020,2021,2022,2023],
  },
  {
    name: "PSV", displayName: "PSV", country: "Netherlands", strength: 75,
    fifaYears: [2007,2008,2009,2016,2017,2024,2025,2026],
  },
  {
    name: "Feyenoord", displayName: "Feyenoord", country: "Netherlands", strength: 74,
    fifaYears: [2018,2024,2026],
  },

  // ── Turkey ──
  {
    name: "Galatasaray SK", displayName: "Galatasaray", country: "Turkey", strength: 74,
    fifaYears: [2007,2009,2013,2014,2019,2024],
  },
  {
    name: "Beşiktaş JK", displayName: "Besiktas", country: "Turkey", strength: 73,
    fifaYears: [2010,2017,2018],
  },
  {
    name: "Fenerbahçe SK", displayName: "Fenerbahçe", country: "Turkey", strength: 74,
    fifaYears: [2008,2009],
  },

  // ── Russia / Ukraine ──
  {
    name: "FC Shakhtar Donetsk", displayName: "Shakhtar Donetsk", country: "Ukraine", strength: 75,
    fifaYears: [2007,2008,2009,2010,2011,2012,2013,2014,2018,2019,2020,2021,2022,2023,2025],
  },
  {
    name: "Dynamo Kyiv", displayName: "Dynamo Kyiv", country: "Ukraine", strength: 72,
    fifaYears: [2007,2008,2010,2016,2017,2021],
  },
  {
    name: "CSKA Moscow", displayName: "CSKA Moscow", country: "Russia", strength: 72,
    fifaYears: [2007,2008,2010,2012,2013,2014,2015,2016,2017,2018,2019],
  },
  {
    name: "FC Zenit Saint Petersburg", displayName: "Zenit", country: "Russia", strength: 74,
    fifaYears: [2009,2012,2014,2015,2016,2020,2021,2022],
  },

  // ── Scotland ──
  {
    name: "Celtic", displayName: "Celtic", country: "Scotland", strength: 72,
    fifaYears: [2007,2008,2009,2013,2014,2017,2018,2023,2025],
  },
  {
    name: "Rangers", displayName: "Rangers", country: "Scotland", strength: 70,
    fifaYears: [2008,2011],
  },

  // ── Belgium ──
  {
    name: "Club Brugge KV", displayName: "Club Brugge", country: "Belgium", strength: 73,
    fifaYears: [2016,2019,2020,2022,2023,2024,2025,2026],
  },
  {
    name: "RSC Anderlecht", displayName: "Anderlecht", country: "Belgium", strength: 72,
    fifaYears: [2007,2014,2015,2018],
  },

  // ── Switzerland ──
  {
    name: "FC Basel 1893", displayName: "Basel", country: "Switzerland", strength: 71,
    fifaYears: [2009,2012,2013,2014,2015,2018],
  },
  {
    name: "BSC Young Boys", displayName: "Young Boys", country: "Switzerland", strength: 69,
    fifaYears: [2019,2022,2024],
  },

  // ── Denmark ──
  {
    name: "FC Copenhagen", displayName: "Copenhagen", country: "Denmark", strength: 70,
    fifaYears: [2007,2011,2014,2017,2024],
  },
  {
    name: "FC Midtjylland", displayName: "Midtjylland", country: "Denmark", strength: 67,
    fifaYears: [2021],
  },

  // ── Austria ──
  {
    name: "FC Red Bull Salzburg", displayName: "Red Bull Salzburg", country: "Austria", strength: 73,
    fifaYears: [2020,2021,2022,2023,2024,2025],
  },
  {
    name: "SK Sturm Graz", displayName: "Sturm Graz", country: "Austria", strength: 67,
    fifaYears: [2025],
  },

  // ── Czech Republic ──
  {
    name: "SK Slavia Praha", displayName: "Slavia Prague", country: "Czech Republic", strength: 69,
    fifaYears: [2008,2020],
  },
  {
    name: "FC Viktoria Plzeň", displayName: "Viktoria Plzeň", country: "Czech Republic", strength: 67,
    fifaYears: [2012,2013,2019,2023],
  },

  // ── Greece ──
  {
    name: "Olympiacos CFP", displayName: "Olympiacos", country: "Greece", strength: 72,
    fifaYears: [2007,2008,2009,2010,2011,2012,2013,2014,2015,2016,2017,2018],
  },
  {
    name: "PAOK FC", displayName: "PAOK", country: "Greece", strength: 69,
    fifaYears: [2020],
  },

  // ── Romania ──
  {
    name: "CFR Cluj", displayName: "CFR Cluj", country: "Romania", strength: 66,
    fifaYears: [2009,2013],
  },

  // ── Serbia ──
  {
    name: "FK Crvena Zvezda", displayName: "Red Star Belgrade", country: "Serbia", strength: 68,
    fifaYears: [2019,2020,2022,2025],
  },

  // ── Croatia ──
  {
    name: "GNK Dinamo Zagreb", displayName: "Dinamo Zagreb", country: "Croatia", strength: 68,
    fifaYears: [2012,2013,2016,2017,2020,2023],
  },

  // ── Norway ──
  {
    name: "FK Bodø/Glimt", displayName: "Bodø/Glimt", country: "Norway", strength: 67,
    fifaYears: [2025],
  },

  // ── Italy (additional) ──
  {
    name: "Bologna FC 1909", displayName: "Bologna", country: "Italy", strength: 74,
    fifaYears: [2025],
  },
];

export function getCLClubYearPairs(
  eraStart: number,
  eraEnd: number,
): { club: CLClub; fifaYear: number }[] {
  const pairs: { club: CLClub; fifaYear: number }[] = [];
  for (const club of CL_CLUBS) {
    for (const year of club.fifaYears) {
      if (year >= eraStart && year <= eraEnd) {
        pairs.push({ club, fifaYear: year });
      }
    }
  }
  return pairs;
}
