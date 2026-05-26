const BASE_URL = "https://transfermarkt-api.fly.dev";

export async function tmFetch<T = unknown>(endpoint: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    headers: { "User-Agent": "Knowitball/1.0" },
  });

  if (!res.ok) {
    throw new Error(`Transfermarkt API ${res.status}: ${res.statusText}`);
  }

  return res.json() as Promise<T>;
}

/* ── Response types ── */

export interface TmPlayerSearchResult {
  id: string;
  url: string;
  name: string;
  position: string;
  club: { id: string; name: string } | null;
  nationality: string[];
  age: number | null;
  marketValue: string | null;
}

export interface TmPlayerProfile {
  id: string;
  url: string;
  name: string;
  fullName: string;
  imageURL: string;
  dateOfBirth: string;
  placeOfBirth: { city: string; country: string } | null;
  age: number;
  height: string | null;
  citizenship: string[];
  position: { main: string; other: string[] };
  foot: string | null;
  club: { id: string; name: string; joined: string; contractExpires: string } | null;
  marketValue: string | null;
  outfitter: string | null;
  socialMedia: string[];
}

export interface TmTransfer {
  id: string;
  from: { clubID: string; clubName: string };
  to: { clubID: string; clubName: string };
  date: string;
  fee: string | null;
  season: string;
}

export interface TmPlayerStat {
  competitionID: string;
  clubID: string;
  seasonID: string;
  competitionName: string;
  appearances: string | null;
  goals: string | null;
  assists: string | null;
  yellowCards: string | null;
  redCards: string | null;
  minutesPlayed: string | null;
}

export interface TmClubPlayer {
  id: string;
  name: string;
  position: string;
  dateOfBirth: string;
  nationality: string[];
  height: string | null;
  foot: string | null;
  joinedOn: string;
  joined: string;
  signedFrom: string | null;
  contract: string | null;
  marketValue: string | null;
  imageURL?: string;
}

export interface TmClubProfile {
  id: string;
  url: string;
  name: string;
  officialName: string;
  image: string;
  league: { id: string; name: string; countryID: string; countryName: string } | null;
  stadiumName: string | null;
  stadiumSeats: number | null;
  squad: { size: number; averageAge: number; foreigners: number; nationalTeamPlayers: number } | null;
  marketValue: string | null;
}

export interface TmCompetitionClub {
  id: string;
  name: string;
}
