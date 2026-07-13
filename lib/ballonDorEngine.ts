import type {
  BDPosition, BDStats, BDTrophy, BDClub, BDEvent, EventChoice,
  CeremonyEntry, BDOCeremony, BDSeason, BDAttributes, BDPlayer,
  BDArchetype, TransferOffer, LeagueTableRow, BDTeammate,
  BDRival, BDLegacy, BDCareer, LegacyTier,
} from './ballonDorTypes';

// --- RNG ---
function mulberry32(seed: number) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gauss(rng: () => number, mean: number, std: number): number {
  const u1 = Math.max(1e-10, rng());
  const u2 = rng();
  return mean + std * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function hashSeed(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = ((h << 5) - h + s.charCodeAt(i)) | 0; }
  return Math.abs(h);
}

function clamp(v: number, min: number, max: number) { return Math.max(min, Math.min(max, v)); }
function ri(rng: () => number, mean: number, std: number, min = 0) {
  return Math.max(min, Math.round(gauss(rng, mean, std)));
}

// --- Clubs ---
export const PL_CLUBS: BDClub[] = [
  { id: 'mancity',    name: 'Manchester City',   prestige: 95, tier: 'elite',         tierLabel: 'Champions League favourites',  clChance: 0.85, elChance: 0,    primaryColor: '#6CABDD' },
  { id: 'liverpool',  name: 'Liverpool',          prestige: 92, tier: 'elite',         tierLabel: 'Champions League contenders',  clChance: 0.78, elChance: 0,    primaryColor: '#C8102E' },
  { id: 'arsenal',    name: 'Arsenal',            prestige: 89, tier: 'title',         tierLabel: 'Title challengers, CL regulars', clChance: 0.68, elChance: 0, primaryColor: '#EF0107' },
  { id: 'manutd',     name: 'Manchester United',  prestige: 86, tier: 'title',         tierLabel: 'Big club, CL ambitions',       clChance: 0.55, elChance: 0.10, primaryColor: '#DA291C' },
  { id: 'chelsea',    name: 'Chelsea',            prestige: 85, tier: 'title',         tierLabel: 'Wealthy club, top 4 target',   clChance: 0.58, elChance: 0.12, primaryColor: '#034694' },
  { id: 'newcastle',  name: 'Newcastle United',   prestige: 83, tier: 'european',      tierLabel: 'Top 4 challengers, CL hopeful', clChance: 0.48, elChance: 0.20, primaryColor: '#241F20' },
  { id: 'tottenham',  name: 'Tottenham Hotspur',  prestige: 81, tier: 'european',      tierLabel: 'Europa League regulars',       clChance: 0.42, elChance: 0.25, primaryColor: '#132257' },
  { id: 'astonvilla', name: 'Aston Villa',        prestige: 79, tier: 'european',      tierLabel: 'CL dark horse, ambitious club', clChance: 0.38, elChance: 0.28, primaryColor: '#95BFE5' },
  { id: 'brighton',   name: 'Brighton',           prestige: 74, tier: 'mid',           tierLabel: 'Smart club, top half target',  clChance: 0.18, elChance: 0.30, primaryColor: '#0057B8' },
  { id: 'westham',    name: 'West Ham United',    prestige: 72, tier: 'mid',           tierLabel: 'Established mid-table, EL path', clChance: 0.10, elChance: 0.22, primaryColor: '#7A263A' },
  { id: 'fulham',     name: 'Fulham',             prestige: 68, tier: 'mid',           tierLabel: 'Solid Premier League outfit',  clChance: 0.04, elChance: 0.12, primaryColor: '#CC0000' },
  { id: 'wolves',     name: 'Wolverhampton',      prestige: 66, tier: 'mid',           tierLabel: 'Mid-table Premier League',     clChance: 0.03, elChance: 0.10, primaryColor: '#FDB913' },
  { id: 'palace',     name: 'Crystal Palace',     prestige: 64, tier: 'lower',         tierLabel: 'Lower half, survival focus',   clChance: 0.02, elChance: 0.05, primaryColor: '#1B458F' },
  { id: 'nottmforest',name: "Nott'm Forest",      prestige: 63, tier: 'lower',         tierLabel: 'Survival and progress',        clChance: 0.02, elChance: 0.06, primaryColor: '#DD0000' },
  { id: 'everton',    name: 'Everton',            prestige: 62, tier: 'lower',         tierLabel: 'Historic club, relegation risk', clChance: 0.01, elChance: 0.04, primaryColor: '#003399' },
  { id: 'brentford',  name: 'Brentford',          prestige: 60, tier: 'lower',         tierLabel: 'Punching above their weight',  clChance: 0.01, elChance: 0.04, primaryColor: '#E30613' },
  { id: 'bournemouth',name: 'Bournemouth',        prestige: 58, tier: 'lower',         tierLabel: 'Lower half Premier League',    clChance: 0.01, elChance: 0.02, primaryColor: '#B50E12' },
  { id: 'leicester',  name: 'Leicester City',     prestige: 62, tier: 'mid',           tierLabel: 'Mid-table, Europa ambitions',  clChance: 0.02, elChance: 0.08, primaryColor: '#003090' },
  { id: 'southampton',name: 'Southampton',        prestige: 56, tier: 'lower',         tierLabel: 'Survival is success',          clChance: 0.00, elChance: 0.02, primaryColor: '#D71920' },
  { id: 'ipswich',    name: 'Ipswich Town',       prestige: 54, tier: 'lower',         tierLabel: 'Newly promoted, bottom half',  clChance: 0.00, elChance: 0.01, primaryColor: '#3A64A3' },
];

// --- Club squads for teammate generation ---
type SquadPlayer = { name: string; pos: BDPosition; ovr: number };

export const CLUB_SQUADS: Record<string, SquadPlayer[]> = {
  // ── Premier League ──────────────────────────────────────────────
  mancity: [
    { name: 'Ederson', pos: 'GK', ovr: 87 },
    { name: 'Stefan Ortega', pos: 'GK', ovr: 79 },
    { name: 'Rúben Dias', pos: 'DEF', ovr: 89 },
    { name: 'Manuel Akanji', pos: 'DEF', ovr: 84 },
    { name: 'John Stones', pos: 'DEF', ovr: 84 },
    { name: 'Josko Gvardiol', pos: 'DEF', ovr: 85 },
    { name: 'Kyle Walker', pos: 'DEF', ovr: 83 },
    { name: 'Rico Lewis', pos: 'DEF', ovr: 79 },
    { name: 'Rodri', pos: 'MID', ovr: 91 },
    { name: 'Kevin De Bruyne', pos: 'MID', ovr: 89 },
    { name: 'Phil Foden', pos: 'MID', ovr: 88 },
    { name: 'Bernardo Silva', pos: 'MID', ovr: 88 },
    { name: 'Mateo Kovacic', pos: 'MID', ovr: 82 },
    { name: 'Ilkay Gündogan', pos: 'MID', ovr: 84 },
    { name: 'Erling Haaland', pos: 'ATT', ovr: 91 },
    { name: 'Jeremy Doku', pos: 'ATT', ovr: 83 },
    { name: 'Jack Grealish', pos: 'ATT', ovr: 82 },
    { name: 'Oscar Bobb', pos: 'ATT', ovr: 78 },
  ],
  liverpool: [
    { name: 'Alisson', pos: 'GK', ovr: 87 },
    { name: 'Caoimhín Kelleher', pos: 'GK', ovr: 79 },
    { name: 'Virgil van Dijk', pos: 'DEF', ovr: 88 },
    { name: 'Ibrahima Konaté', pos: 'DEF', ovr: 85 },
    { name: 'Joe Gomez', pos: 'DEF', ovr: 81 },
    { name: 'Andrew Robertson', pos: 'DEF', ovr: 84 },
    { name: 'Conor Bradley', pos: 'DEF', ovr: 80 },
    { name: 'Alexis Mac Allister', pos: 'MID', ovr: 84 },
    { name: 'Dominik Szoboszlai', pos: 'MID', ovr: 85 },
    { name: 'Ryan Gravenberch', pos: 'MID', ovr: 83 },
    { name: 'Harvey Elliott', pos: 'MID', ovr: 79 },
    { name: 'Curtis Jones', pos: 'MID', ovr: 78 },
    { name: 'Mohamed Salah', pos: 'ATT', ovr: 88 },
    { name: 'Darwin Núñez', pos: 'ATT', ovr: 83 },
    { name: 'Luis Díaz', pos: 'ATT', ovr: 84 },
    { name: 'Cody Gakpo', pos: 'ATT', ovr: 82 },
    { name: 'Diogo Jota', pos: 'ATT', ovr: 83 },
  ],
  arsenal: [
    { name: 'David Raya', pos: 'GK', ovr: 84 },
    { name: 'Karl Hein', pos: 'GK', ovr: 75 },
    { name: 'William Saliba', pos: 'DEF', ovr: 87 },
    { name: 'Gabriel Magalhães', pos: 'DEF', ovr: 85 },
    { name: 'Ben White', pos: 'DEF', ovr: 83 },
    { name: 'Oleksandr Zinchenko', pos: 'DEF', ovr: 81 },
    { name: 'Jakub Kiwior', pos: 'DEF', ovr: 79 },
    { name: 'Declan Rice', pos: 'MID', ovr: 87 },
    { name: 'Martin Ødegaard', pos: 'MID', ovr: 88 },
    { name: 'Thomas Partey', pos: 'MID', ovr: 82 },
    { name: 'Jorginho', pos: 'MID', ovr: 79 },
    { name: 'Fabio Vieira', pos: 'MID', ovr: 79 },
    { name: 'Bukayo Saka', pos: 'ATT', ovr: 87 },
    { name: 'Gabriel Martinelli', pos: 'ATT', ovr: 84 },
    { name: 'Kai Havertz', pos: 'ATT', ovr: 83 },
    { name: 'Leandro Trossard', pos: 'ATT', ovr: 82 },
  ],
  manutd: [
    { name: 'André Onana', pos: 'GK', ovr: 84 },
    { name: 'Altay Bayındır', pos: 'GK', ovr: 78 },
    { name: 'Lisandro Martínez', pos: 'DEF', ovr: 84 },
    { name: 'Matthijs de Ligt', pos: 'DEF', ovr: 82 },
    { name: 'Victor Lindelöf', pos: 'DEF', ovr: 80 },
    { name: 'Luke Shaw', pos: 'DEF', ovr: 81 },
    { name: 'Diogo Dalot', pos: 'DEF', ovr: 81 },
    { name: 'Bruno Fernandes', pos: 'MID', ovr: 87 },
    { name: 'Casemiro', pos: 'MID', ovr: 82 },
    { name: 'Kobbie Mainoo', pos: 'MID', ovr: 80 },
    { name: 'Mason Mount', pos: 'MID', ovr: 80 },
    { name: 'Rasmus Højlund', pos: 'ATT', ovr: 82 },
    { name: 'Alejandro Garnacho', pos: 'ATT', ovr: 81 },
    { name: 'Amad Diallo', pos: 'ATT', ovr: 80 },
    { name: 'Marcus Rashford', pos: 'ATT', ovr: 82 },
  ],
  chelsea: [
    { name: 'Robert Sánchez', pos: 'GK', ovr: 82 },
    { name: 'Filip Jörgensen', pos: 'GK', ovr: 79 },
    { name: 'Reece James', pos: 'DEF', ovr: 83 },
    { name: 'Levi Colwill', pos: 'DEF', ovr: 80 },
    { name: 'Benoît Badiashile', pos: 'DEF', ovr: 79 },
    { name: 'Malo Gusto', pos: 'DEF', ovr: 79 },
    { name: 'Marc Cucurella', pos: 'DEF', ovr: 80 },
    { name: 'Enzo Fernández', pos: 'MID', ovr: 84 },
    { name: 'Cole Palmer', pos: 'MID', ovr: 87 },
    { name: 'Moisés Caicedo', pos: 'MID', ovr: 84 },
    { name: 'Romeo Lavia', pos: 'MID', ovr: 80 },
    { name: 'Christopher Nkunku', pos: 'ATT', ovr: 84 },
    { name: 'Nicolas Jackson', pos: 'ATT', ovr: 82 },
    { name: 'Pedro Neto', pos: 'ATT', ovr: 82 },
    { name: 'Mykhaylo Mudryk', pos: 'ATT', ovr: 80 },
  ],
  newcastle: [
    { name: 'Nick Pope', pos: 'GK', ovr: 84 },
    { name: 'Martin Dúbravka', pos: 'GK', ovr: 78 },
    { name: 'Kieran Trippier', pos: 'DEF', ovr: 83 },
    { name: 'Sven Botman', pos: 'DEF', ovr: 83 },
    { name: 'Jamaal Lascelles', pos: 'DEF', ovr: 79 },
    { name: 'Dan Burn', pos: 'DEF', ovr: 79 },
    { name: 'Tino Livramento', pos: 'DEF', ovr: 78 },
    { name: 'Bruno Guimarães', pos: 'MID', ovr: 87 },
    { name: 'Joe Willock', pos: 'MID', ovr: 79 },
    { name: 'Sandro Tonali', pos: 'MID', ovr: 83 },
    { name: 'Joelinton', pos: 'MID', ovr: 81 },
    { name: 'Anthony Gordon', pos: 'ATT', ovr: 83 },
    { name: 'Alexander Isak', pos: 'ATT', ovr: 85 },
    { name: 'Harvey Barnes', pos: 'ATT', ovr: 80 },
    { name: 'Jacob Murphy', pos: 'ATT', ovr: 78 },
  ],
  tottenham: [
    { name: 'Guglielmo Vicario', pos: 'GK', ovr: 83 },
    { name: 'Fraser Forster', pos: 'GK', ovr: 76 },
    { name: 'Cristian Romero', pos: 'DEF', ovr: 85 },
    { name: 'Micky van de Ven', pos: 'DEF', ovr: 83 },
    { name: 'Ben Davies', pos: 'DEF', ovr: 79 },
    { name: 'Pedro Porro', pos: 'DEF', ovr: 81 },
    { name: 'Destiny Udogie', pos: 'DEF', ovr: 80 },
    { name: 'James Maddison', pos: 'MID', ovr: 83 },
    { name: 'Yves Bissouma', pos: 'MID', ovr: 80 },
    { name: 'Dejan Kulusevski', pos: 'MID', ovr: 82 },
    { name: 'Rodrigo Bentancur', pos: 'MID', ovr: 80 },
    { name: 'Heung-min Son', pos: 'ATT', ovr: 84 },
    { name: 'Brennan Johnson', pos: 'ATT', ovr: 80 },
    { name: 'Dominic Solanke', pos: 'ATT', ovr: 79 },
    { name: 'Richarlison', pos: 'ATT', ovr: 80 },
  ],
  astonvilla: [
    { name: 'Emiliano Martínez', pos: 'GK', ovr: 87 },
    { name: 'Robin Olsen', pos: 'GK', ovr: 76 },
    { name: 'Ezri Konsa', pos: 'DEF', ovr: 82 },
    { name: 'Pau Torres', pos: 'DEF', ovr: 83 },
    { name: 'Diego Carlos', pos: 'DEF', ovr: 81 },
    { name: 'Lucas Digne', pos: 'DEF', ovr: 80 },
    { name: 'Matty Cash', pos: 'DEF', ovr: 80 },
    { name: 'John McGinn', pos: 'MID', ovr: 82 },
    { name: 'Morgan Rogers', pos: 'MID', ovr: 80 },
    { name: 'Douglas Luiz', pos: 'MID', ovr: 83 },
    { name: 'Emiliano Buendía', pos: 'MID', ovr: 80 },
    { name: 'Ollie Watkins', pos: 'ATT', ovr: 85 },
    { name: 'Leon Bailey', pos: 'ATT', ovr: 81 },
    { name: 'Moussa Diaby', pos: 'ATT', ovr: 82 },
  ],
  brighton: [
    { name: 'Bart Verbruggen', pos: 'GK', ovr: 80 },
    { name: 'Jason Steele', pos: 'GK', ovr: 75 },
    { name: 'Lewis Dunk', pos: 'DEF', ovr: 80 },
    { name: 'Joel Veltman', pos: 'DEF', ovr: 77 },
    { name: 'Jan Paul van Hecke', pos: 'DEF', ovr: 78 },
    { name: 'Pervis Estupiñán', pos: 'DEF', ovr: 78 },
    { name: 'Tariq Lamptey', pos: 'DEF', ovr: 78 },
    { name: 'Billy Gilmour', pos: 'MID', ovr: 79 },
    { name: 'James Milner', pos: 'MID', ovr: 76 },
    { name: 'Jack Hinshelwood', pos: 'MID', ovr: 77 },
    { name: 'Evan Ferguson', pos: 'ATT', ovr: 81 },
    { name: 'João Pedro', pos: 'ATT', ovr: 82 },
    { name: 'Danny Welbeck', pos: 'ATT', ovr: 76 },
    { name: 'Simon Adingra', pos: 'ATT', ovr: 78 },
  ],
  westham: [
    { name: 'Łukasz Fabiański', pos: 'GK', ovr: 78 },
    { name: 'Alphonse Areola', pos: 'GK', ovr: 77 },
    { name: 'Kurt Zouma', pos: 'DEF', ovr: 79 },
    { name: 'Nayef Aguerd', pos: 'DEF', ovr: 79 },
    { name: 'Aaron Wan-Bissaka', pos: 'DEF', ovr: 79 },
    { name: 'Vladimír Coufal', pos: 'DEF', ovr: 78 },
    { name: 'Emerson', pos: 'DEF', ovr: 78 },
    { name: 'Tomáš Souček', pos: 'MID', ovr: 82 },
    { name: 'Lucas Paquetá', pos: 'MID', ovr: 83 },
    { name: 'Edson Álvarez', pos: 'MID', ovr: 81 },
    { name: 'James Ward-Prowse', pos: 'MID', ovr: 81 },
    { name: 'Jarrod Bowen', pos: 'ATT', ovr: 82 },
    { name: 'Mohammed Kudus', pos: 'ATT', ovr: 82 },
    { name: 'Michail Antonio', pos: 'ATT', ovr: 79 },
  ],
  fulham: [
    { name: 'Bernd Leno', pos: 'GK', ovr: 82 },
    { name: 'Marek Rodák', pos: 'GK', ovr: 76 },
    { name: 'Tim Ream', pos: 'DEF', ovr: 78 },
    { name: 'Calvin Bassey', pos: 'DEF', ovr: 79 },
    { name: 'Antonee Robinson', pos: 'DEF', ovr: 81 },
    { name: 'Kenny Tete', pos: 'DEF', ovr: 78 },
    { name: 'Tom Cairney', pos: 'MID', ovr: 79 },
    { name: 'Alex Iwobi', pos: 'MID', ovr: 80 },
    { name: 'Harrison Reed', pos: 'MID', ovr: 78 },
    { name: 'Andreas Pereira', pos: 'MID', ovr: 80 },
    { name: 'Raúl Jiménez', pos: 'ATT', ovr: 80 },
    { name: 'Rodrigo Muniz', pos: 'ATT', ovr: 78 },
    { name: 'Bobby De Cordova-Reid', pos: 'ATT', ovr: 78 },
  ],
  wolves: [
    { name: 'José Sá', pos: 'GK', ovr: 82 },
    { name: 'Dan Bentley', pos: 'GK', ovr: 74 },
    { name: 'Max Kilman', pos: 'DEF', ovr: 81 },
    { name: 'Rayan Aït-Nouri', pos: 'DEF', ovr: 81 },
    { name: 'Toti Gomes', pos: 'DEF', ovr: 77 },
    { name: 'Nelson Semedo', pos: 'DEF', ovr: 80 },
    { name: 'João Gomes', pos: 'MID', ovr: 80 },
    { name: 'Mario Lemina', pos: 'MID', ovr: 79 },
    { name: 'Tommy Doyle', pos: 'MID', ovr: 77 },
    { name: 'Matheus Cunha', pos: 'ATT', ovr: 82 },
    { name: 'Hwang Hee-chan', pos: 'ATT', ovr: 79 },
    { name: 'Jørgen Strand Larsen', pos: 'ATT', ovr: 78 },
  ],
  palace: [
    { name: 'Dean Henderson', pos: 'GK', ovr: 80 },
    { name: 'Sam Johnstone', pos: 'GK', ovr: 78 },
    { name: 'Marc Guéhi', pos: 'DEF', ovr: 82 },
    { name: 'Daniel Muñoz', pos: 'DEF', ovr: 78 },
    { name: 'Joachim Andersen', pos: 'DEF', ovr: 80 },
    { name: 'Tyrick Mitchell', pos: 'DEF', ovr: 78 },
    { name: 'Nathaniel Clyne', pos: 'DEF', ovr: 76 },
    { name: 'Eberechi Eze', pos: 'MID', ovr: 82 },
    { name: 'Adam Wharton', pos: 'MID', ovr: 78 },
    { name: 'Will Hughes', pos: 'MID', ovr: 77 },
    { name: 'Cheick Doucouré', pos: 'MID', ovr: 79 },
    { name: 'Jean-Philippe Mateta', pos: 'ATT', ovr: 80 },
    { name: 'Ismaïla Sarr', pos: 'ATT', ovr: 78 },
    { name: 'Michael Olise', pos: 'ATT', ovr: 82 },
  ],
  nottmforest: [
    { name: 'Matz Sels', pos: 'GK', ovr: 81 },
    { name: 'Matt Turner', pos: 'GK', ovr: 76 },
    { name: 'Murillo', pos: 'DEF', ovr: 81 },
    { name: 'Nikola Milenković', pos: 'DEF', ovr: 80 },
    { name: 'Joe Worrall', pos: 'DEF', ovr: 77 },
    { name: 'Andrew Omobamidele', pos: 'DEF', ovr: 77 },
    { name: 'Nuno Tavares', pos: 'DEF', ovr: 78 },
    { name: 'Ryan Yates', pos: 'MID', ovr: 78 },
    { name: 'Morgan Gibbs-White', pos: 'MID', ovr: 81 },
    { name: 'Elliot Anderson', pos: 'MID', ovr: 78 },
    { name: 'Nicolas Domínguez', pos: 'MID', ovr: 78 },
    { name: 'Callum Hudson-Odoi', pos: 'ATT', ovr: 79 },
    { name: 'Chris Wood', pos: 'ATT', ovr: 80 },
    { name: 'Anthony Elanga', pos: 'ATT', ovr: 78 },
    { name: 'Taiwo Awoniyi', pos: 'ATT', ovr: 78 },
  ],
  everton: [
    { name: 'Jordan Pickford', pos: 'GK', ovr: 84 },
    { name: 'Joao Virginia', pos: 'GK', ovr: 74 },
    { name: 'James Tarkowski', pos: 'DEF', ovr: 80 },
    { name: 'Michael Keane', pos: 'DEF', ovr: 77 },
    { name: 'Ben Godfrey', pos: 'DEF', ovr: 77 },
    { name: 'Ashley Young', pos: 'DEF', ovr: 75 },
    { name: 'Séamus Coleman', pos: 'DEF', ovr: 76 },
    { name: 'Idrissa Gueye', pos: 'MID', ovr: 79 },
    { name: 'Abdoulaye Doucouré', pos: 'MID', ovr: 79 },
    { name: 'James Garner', pos: 'MID', ovr: 78 },
    { name: 'Dwight McNeil', pos: 'ATT', ovr: 78 },
    { name: 'Dominic Calvert-Lewin', pos: 'ATT', ovr: 79 },
    { name: 'Beto', pos: 'ATT', ovr: 76 },
  ],
  brentford: [
    { name: 'Mark Flekken', pos: 'GK', ovr: 80 },
    { name: 'Thomas Strakosha', pos: 'GK', ovr: 74 },
    { name: 'Nathan Collins', pos: 'DEF', ovr: 80 },
    { name: 'Kristoffer Ajer', pos: 'DEF', ovr: 78 },
    { name: 'Ethan Pinnock', pos: 'DEF', ovr: 78 },
    { name: 'Ben Mee', pos: 'DEF', ovr: 77 },
    { name: 'Rico Henry', pos: 'DEF', ovr: 77 },
    { name: 'Christian Nørgaard', pos: 'MID', ovr: 80 },
    { name: 'Mathias Jensen', pos: 'MID', ovr: 77 },
    { name: 'Vitaly Janelt', pos: 'MID', ovr: 77 },
    { name: 'Keane Lewis-Potter', pos: 'MID', ovr: 76 },
    { name: 'Bryan Mbeumo', pos: 'ATT', ovr: 82 },
    { name: 'Yoane Wissa', pos: 'ATT', ovr: 80 },
    { name: 'Ivan Toney', pos: 'ATT', ovr: 81 },
  ],
  bournemouth: [
    { name: 'Neto', pos: 'GK', ovr: 81 },
    { name: 'Mark Travers', pos: 'GK', ovr: 75 },
    { name: 'Illia Zabarnyi', pos: 'DEF', ovr: 78 },
    { name: 'Lloyd Kelly', pos: 'DEF', ovr: 77 },
    { name: 'Chris Mepham', pos: 'DEF', ovr: 76 },
    { name: 'Milos Kerkez', pos: 'DEF', ovr: 78 },
    { name: 'Adam Smith', pos: 'DEF', ovr: 75 },
    { name: 'Ryan Christie', pos: 'MID', ovr: 78 },
    { name: 'Tyler Adams', pos: 'MID', ovr: 78 },
    { name: 'Philip Billing', pos: 'MID', ovr: 78 },
    { name: 'Marcus Tavernier', pos: 'MID', ovr: 77 },
    { name: 'Antoine Semenyo', pos: 'ATT', ovr: 77 },
    { name: 'Evanilson', pos: 'ATT', ovr: 79 },
    { name: 'Justin Kluivert', pos: 'ATT', ovr: 78 },
  ],
  leicester: [
    { name: 'Mads Hermansen', pos: 'GK', ovr: 81 },
    { name: 'Danny Ward', pos: 'GK', ovr: 76 },
    { name: 'Wout Faes', pos: 'DEF', ovr: 80 },
    { name: 'Conor Coady', pos: 'DEF', ovr: 78 },
    { name: 'Victor Kristiansen', pos: 'DEF', ovr: 78 },
    { name: 'Ricardo Pereira', pos: 'DEF', ovr: 78 },
    { name: 'Wilfred Ndidi', pos: 'MID', ovr: 80 },
    { name: 'Boubakary Soumaré', pos: 'MID', ovr: 77 },
    { name: 'Harry Winks', pos: 'MID', ovr: 77 },
    { name: 'Kiernan Dewsbury-Hall', pos: 'MID', ovr: 79 },
    { name: 'Stephy Mavididi', pos: 'ATT', ovr: 79 },
    { name: 'Jamie Vardy', pos: 'ATT', ovr: 77 },
    { name: 'Patson Daka', pos: 'ATT', ovr: 78 },
  ],
  southampton: [
    { name: 'Gavin Bazunu', pos: 'GK', ovr: 78 },
    { name: 'Alex McCarthy', pos: 'GK', ovr: 74 },
    { name: 'Jan Bednarek', pos: 'DEF', ovr: 77 },
    { name: 'Jack Stephens', pos: 'DEF', ovr: 75 },
    { name: 'Kyle Walker-Peters', pos: 'DEF', ovr: 78 },
    { name: 'Romain Perraud', pos: 'DEF', ovr: 76 },
    { name: 'Will Smallbone', pos: 'MID', ovr: 76 },
    { name: 'Joe Aribo', pos: 'MID', ovr: 76 },
    { name: 'Flynn Downes', pos: 'MID', ovr: 75 },
    { name: 'Stuart Armstrong', pos: 'MID', ovr: 75 },
    { name: 'Cameron Archer', pos: 'ATT', ovr: 75 },
    { name: 'Adam Armstrong', pos: 'ATT', ovr: 76 },
    { name: 'Sékou Mara', pos: 'ATT', ovr: 74 },
  ],
  ipswich: [
    { name: 'Christian Walton', pos: 'GK', ovr: 75 },
    { name: 'Vaclav Hladky', pos: 'GK', ovr: 73 },
    { name: 'Luke Woolfenden', pos: 'DEF', ovr: 76 },
    { name: 'Harry Clarke', pos: 'DEF', ovr: 75 },
    { name: 'Leif Davis', pos: 'DEF', ovr: 77 },
    { name: 'Axel Tuanzebe', pos: 'DEF', ovr: 74 },
    { name: 'Sam Morsy', pos: 'MID', ovr: 76 },
    { name: 'Kalvin Phillips', pos: 'MID', ovr: 75 },
    { name: 'Massimo Luongo', pos: 'MID', ovr: 74 },
    { name: 'Wes Burns', pos: 'MID', ovr: 75 },
    { name: 'Omari Hutchinson', pos: 'ATT', ovr: 77 },
    { name: 'Liam Delap', pos: 'ATT', ovr: 77 },
    { name: 'Conor Chaplin', pos: 'ATT', ovr: 74 },
  ],

  // ── European Clubs (CL opponents) ──────────────────────────────
  realmadrid: [
    { name: 'Thibaut Courtois', pos: 'GK', ovr: 90 },
    { name: 'Andriy Lunin', pos: 'GK', ovr: 82 },
    { name: 'Dani Carvajal', pos: 'DEF', ovr: 84 },
    { name: 'Éder Militão', pos: 'DEF', ovr: 87 },
    { name: 'Antonio Rüdiger', pos: 'DEF', ovr: 86 },
    { name: 'David Alaba', pos: 'DEF', ovr: 83 },
    { name: 'Ferland Mendy', pos: 'DEF', ovr: 83 },
    { name: 'Trent Alexander-Arnold', pos: 'DEF', ovr: 87 },
    { name: 'Federico Valverde', pos: 'MID', ovr: 87 },
    { name: 'Eduardo Camavinga', pos: 'MID', ovr: 84 },
    { name: 'Aurélien Tchouaméni', pos: 'MID', ovr: 85 },
    { name: 'Jude Bellingham', pos: 'MID', ovr: 89 },
    { name: 'Kylian Mbappé', pos: 'ATT', ovr: 92 },
    { name: 'Vinicius Jr.', pos: 'ATT', ovr: 90 },
    { name: 'Rodrygo', pos: 'ATT', ovr: 85 },
    { name: 'Arda Güler', pos: 'ATT', ovr: 82 },
    { name: 'Endrick', pos: 'ATT', ovr: 80 },
  ],
  barcelona: [
    { name: 'Iñaki Peña', pos: 'GK', ovr: 79 },
    { name: 'Wojciech Szczęsny', pos: 'GK', ovr: 83 },
    { name: 'Ronald Araújo', pos: 'DEF', ovr: 87 },
    { name: 'Andreas Christensen', pos: 'DEF', ovr: 83 },
    { name: 'Pau Cubarsí', pos: 'DEF', ovr: 81 },
    { name: 'Jules Koundé', pos: 'DEF', ovr: 85 },
    { name: 'Alejandro Balde', pos: 'DEF', ovr: 84 },
    { name: 'Pedri', pos: 'MID', ovr: 88 },
    { name: 'Gavi', pos: 'MID', ovr: 87 },
    { name: 'Frenkie de Jong', pos: 'MID', ovr: 85 },
    { name: 'Dani Olmo', pos: 'MID', ovr: 85 },
    { name: 'Marc Casadó', pos: 'MID', ovr: 79 },
    { name: 'Lamine Yamal', pos: 'ATT', ovr: 87 },
    { name: 'Robert Lewandowski', pos: 'ATT', ovr: 85 },
    { name: 'Raphinha', pos: 'ATT', ovr: 86 },
    { name: 'Ferran Torres', pos: 'ATT', ovr: 81 },
    { name: 'Fermín López', pos: 'ATT', ovr: 81 },
  ],
  bayernmunich: [
    { name: 'Manuel Neuer', pos: 'GK', ovr: 83 },
    { name: 'Daniel Peretz', pos: 'GK', ovr: 76 },
    { name: 'Dayot Upamecano', pos: 'DEF', ovr: 84 },
    { name: 'Kim Min-jae', pos: 'DEF', ovr: 85 },
    { name: 'Alphonso Davies', pos: 'DEF', ovr: 84 },
    { name: 'Raphaël Guerreiro', pos: 'DEF', ovr: 82 },
    { name: 'Josip Stanišić', pos: 'DEF', ovr: 78 },
    { name: 'Joshua Kimmich', pos: 'MID', ovr: 88 },
    { name: 'Thomas Müller', pos: 'MID', ovr: 83 },
    { name: 'Leroy Sané', pos: 'MID', ovr: 87 },
    { name: 'Konrad Laimer', pos: 'MID', ovr: 82 },
    { name: 'Jamal Musiala', pos: 'MID', ovr: 87 },
    { name: 'Harry Kane', pos: 'ATT', ovr: 90 },
    { name: 'Florian Wirtz', pos: 'ATT', ovr: 87 },
    { name: 'Serge Gnabry', pos: 'ATT', ovr: 82 },
    { name: 'Kingsley Coman', pos: 'ATT', ovr: 82 },
  ],
  psg: [
    { name: 'Gianluigi Donnarumma', pos: 'GK', ovr: 88 },
    { name: 'Matvey Safonov', pos: 'GK', ovr: 78 },
    { name: 'Achraf Hakimi', pos: 'DEF', ovr: 87 },
    { name: 'Marquinhos', pos: 'DEF', ovr: 86 },
    { name: 'Milan Škriniar', pos: 'DEF', ovr: 83 },
    { name: 'Lucas Hernández', pos: 'DEF', ovr: 82 },
    { name: 'Nuno Mendes', pos: 'DEF', ovr: 83 },
    { name: 'Vitinha', pos: 'MID', ovr: 85 },
    { name: 'Warren Zaïre-Emery', pos: 'MID', ovr: 83 },
    { name: 'Fabian Ruiz', pos: 'MID', ovr: 82 },
    { name: 'Lee Kang-in', pos: 'MID', ovr: 82 },
    { name: 'João Neves', pos: 'MID', ovr: 83 },
    { name: 'Ousmane Dembélé', pos: 'ATT', ovr: 86 },
    { name: 'Khvicha Kvaratskhelia', pos: 'ATT', ovr: 87 },
    { name: 'Bradley Barcola', pos: 'ATT', ovr: 83 },
    { name: 'Désiré Doué', pos: 'ATT', ovr: 82 },
    { name: 'Gonçalo Ramos', pos: 'ATT', ovr: 81 },
  ],
  intermilan: [
    { name: 'Yann Sommer', pos: 'GK', ovr: 84 },
    { name: 'Josep Martínez', pos: 'GK', ovr: 78 },
    { name: 'Alessandro Bastoni', pos: 'DEF', ovr: 86 },
    { name: 'Francesco Acerbi', pos: 'DEF', ovr: 82 },
    { name: 'Stefan de Vrij', pos: 'DEF', ovr: 81 },
    { name: 'Matteo Darmian', pos: 'DEF', ovr: 79 },
    { name: 'Denzel Dumfries', pos: 'DEF', ovr: 82 },
    { name: 'Carlos Augusto', pos: 'DEF', ovr: 81 },
    { name: 'Federico Dimarco', pos: 'DEF', ovr: 83 },
    { name: 'Nicolò Barella', pos: 'MID', ovr: 87 },
    { name: 'Hakan Çalhanoğlu', pos: 'MID', ovr: 86 },
    { name: 'Henrikh Mkhitaryan', pos: 'MID', ovr: 83 },
    { name: 'Davide Frattesi', pos: 'MID', ovr: 82 },
    { name: 'Piotr Zieliński', pos: 'MID', ovr: 81 },
    { name: 'Lautaro Martínez', pos: 'ATT', ovr: 89 },
    { name: 'Marcus Thuram', pos: 'ATT', ovr: 85 },
    { name: 'Mehdi Taremi', pos: 'ATT', ovr: 80 },
  ],
  dortmund: [
    { name: 'Gregor Kobel', pos: 'GK', ovr: 83 },
    { name: 'Alexander Meyer', pos: 'GK', ovr: 75 },
    { name: 'Nico Schlotterbeck', pos: 'DEF', ovr: 82 },
    { name: 'Niklas Süle', pos: 'DEF', ovr: 83 },
    { name: 'Waldemar Anton', pos: 'DEF', ovr: 80 },
    { name: 'Ian Maatsen', pos: 'DEF', ovr: 82 },
    { name: 'Julian Ryerson', pos: 'DEF', ovr: 79 },
    { name: 'Emre Can', pos: 'MID', ovr: 82 },
    { name: 'Julian Brandt', pos: 'MID', ovr: 82 },
    { name: 'Pascal Groß', pos: 'MID', ovr: 81 },
    { name: 'Marcel Sabitzer', pos: 'MID', ovr: 81 },
    { name: 'Serhou Guirassy', pos: 'ATT', ovr: 83 },
    { name: 'Karim Adeyemi', pos: 'ATT', ovr: 83 },
    { name: 'Maximilian Beier', pos: 'ATT', ovr: 82 },
    { name: 'Jamie Bynoe-Gittens', pos: 'ATT', ovr: 80 },
  ],
  atleticomadrid: [
    { name: 'Jan Oblak', pos: 'GK', ovr: 88 },
    { name: 'Antonio Sivera', pos: 'GK', ovr: 76 },
    { name: 'José María Giménez', pos: 'DEF', ovr: 85 },
    { name: 'Robin Le Normand', pos: 'DEF', ovr: 82 },
    { name: 'Marcos Llorente', pos: 'DEF', ovr: 82 },
    { name: 'Nahuel Molina', pos: 'DEF', ovr: 82 },
    { name: 'Reinildo', pos: 'DEF', ovr: 79 },
    { name: 'Rodrigo De Paul', pos: 'MID', ovr: 84 },
    { name: 'Pablo Barrios', pos: 'MID', ovr: 81 },
    { name: 'Conor Gallagher', pos: 'MID', ovr: 82 },
    { name: 'Koke', pos: 'MID', ovr: 79 },
    { name: 'Antoine Griezmann', pos: 'ATT', ovr: 85 },
    { name: 'Alexander Sørloth', pos: 'ATT', ovr: 82 },
    { name: 'Samuel Lino', pos: 'ATT', ovr: 79 },
    { name: 'Giuliano Simeone', pos: 'ATT', ovr: 78 },
  ],
  acmilan: [
    { name: 'Mike Maignan', pos: 'GK', ovr: 87 },
    { name: 'Marco Sportiello', pos: 'GK', ovr: 77 },
    { name: 'Fikayo Tomori', pos: 'DEF', ovr: 84 },
    { name: 'Malick Thiaw', pos: 'DEF', ovr: 82 },
    { name: 'Theo Hernández', pos: 'DEF', ovr: 86 },
    { name: 'Davide Calabria', pos: 'DEF', ovr: 79 },
    { name: 'Emerson Royal', pos: 'DEF', ovr: 78 },
    { name: 'Ismaël Bennacer', pos: 'MID', ovr: 82 },
    { name: 'Tijjani Reijnders', pos: 'MID', ovr: 84 },
    { name: 'Youssouf Fofana', pos: 'MID', ovr: 83 },
    { name: 'Ruben Loftus-Cheek', pos: 'MID', ovr: 82 },
    { name: 'Yunus Musah', pos: 'MID', ovr: 80 },
    { name: 'Rafael Leão', pos: 'ATT', ovr: 87 },
    { name: 'Álvaro Morata', pos: 'ATT', ovr: 82 },
    { name: 'Christian Pulisic', pos: 'ATT', ovr: 84 },
    { name: 'Noah Okafor', pos: 'ATT', ovr: 79 },
  ],
};

// Maps opponent display names (as used in fixtures) to CLUB_SQUADS keys.
// PL entries are derived from PL_CLUBS so fixture names can never drift from the map.
export const SQUAD_KEY_BY_OPPONENT: Record<string, string> = {
  ...Object.fromEntries(PL_CLUBS.map(c => [c.name, c.id])),
  'Real Madrid':        'realmadrid',
  'Barcelona':          'barcelona',
  'Bayern Munich':      'bayernmunich',
  'PSG':                'psg',
  'Inter Milan':        'intermilan',
  'Borussia Dortmund':  'dortmund',
  'Atlético Madrid':    'atleticomadrid',
  'AC Milan':           'acmilan',
};

// Returns a weighted-random goal scorer from the opponent's squad (ATT 3× > MID 2× > DEF 1×)
export function pickOpponentScorer(opponentName: string): string | null {
  const key = SQUAD_KEY_BY_OPPONENT[opponentName];
  if (!key) return null;
  const squad = CLUB_SQUADS[key];
  if (!squad?.length) return null;
  const weighted = squad.flatMap(p =>
    p.pos === 'ATT' ? [p, p, p] : p.pos === 'MID' ? [p, p] : p.pos === 'DEF' ? [p] : []
  );
  if (!weighted.length) return null;
  return weighted[Math.floor(Math.random() * weighted.length)].name;
}

// --- Age-based performance multiplier for rivals ---
function rivalAgeMult(age: number): number {
  if (age <= 17) return 0.72;
  if (age <= 19) return 0.82;
  if (age <= 21) return 0.90;
  if (age <= 23) return 0.96;
  if (age <= 28) return 1.00; // prime
  if (age <= 30) return 0.97;
  if (age <= 32) return 0.91;
  if (age <= 34) return 0.83;
  if (age <= 36) return 0.72;
  return 0.60;
}

// --- Rivals (with ages for 2024/25 season) ---
interface RivalTemplate {
  name: string; club: string; leagueFlag: string;
  position: BDPosition; overall: number; clubPrestige: number;
  hasCL: boolean; clWinOdds: number; age: number;
}

const RIVAL_POOL: RivalTemplate[] = [
  { name: 'Erling Haaland',         club: 'Manchester City',   leagueFlag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', position: 'ATT', overall: 91, clubPrestige: 95, hasCL: true,  clWinOdds: 0.30, age: 24 },
  { name: 'Kylian Mbappé',          club: 'Real Madrid',       leagueFlag: '🇪🇸', position: 'ATT', overall: 91, clubPrestige: 98, hasCL: true,  clWinOdds: 0.35, age: 25 },
  { name: 'Vinicius Jr.',           club: 'Real Madrid',       leagueFlag: '🇪🇸', position: 'ATT', overall: 89, clubPrestige: 98, hasCL: true,  clWinOdds: 0.35, age: 24 },
  { name: 'Jude Bellingham',        club: 'Real Madrid',       leagueFlag: '🇪🇸', position: 'MID', overall: 89, clubPrestige: 98, hasCL: true,  clWinOdds: 0.35, age: 21 },
  { name: 'Rodri',                  club: 'Manchester City',   leagueFlag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', position: 'MID', overall: 91, clubPrestige: 95, hasCL: true,  clWinOdds: 0.30, age: 28 },
  { name: 'Mohamed Salah',          club: 'Liverpool',         leagueFlag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', position: 'ATT', overall: 88, clubPrestige: 92, hasCL: true,  clWinOdds: 0.15, age: 32 },
  { name: 'Kevin De Bruyne',        club: 'Manchester City',   leagueFlag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', position: 'MID', overall: 89, clubPrestige: 95, hasCL: true,  clWinOdds: 0.30, age: 33 },
  { name: 'Harry Kane',             club: 'Bayern Munich',     leagueFlag: '🇩🇪', position: 'ATT', overall: 90, clubPrestige: 93, hasCL: true,  clWinOdds: 0.20, age: 31 },
  { name: 'Bukayo Saka',            club: 'Arsenal',           leagueFlag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', position: 'ATT', overall: 87, clubPrestige: 89, hasCL: true,  clWinOdds: 0.08, age: 23 },
  { name: 'Phil Foden',             club: 'Manchester City',   leagueFlag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', position: 'MID', overall: 88, clubPrestige: 95, hasCL: true,  clWinOdds: 0.30, age: 24 },
  { name: 'Lamine Yamal',           club: 'Barcelona',         leagueFlag: '🇪🇸', position: 'ATT', overall: 84, clubPrestige: 91, hasCL: true,  clWinOdds: 0.12, age: 17 },
  { name: 'Florian Wirtz',          club: 'Bayern Munich',     leagueFlag: '🇩🇪', position: 'MID', overall: 87, clubPrestige: 93, hasCL: true,  clWinOdds: 0.20, age: 21 },
  { name: 'Pedri',                  club: 'Barcelona',         leagueFlag: '🇪🇸', position: 'MID', overall: 87, clubPrestige: 91, hasCL: true,  clWinOdds: 0.12, age: 22 },
  { name: 'Robert Lewandowski',     club: 'Barcelona',         leagueFlag: '🇪🇸', position: 'ATT', overall: 84, clubPrestige: 91, hasCL: true,  clWinOdds: 0.12, age: 36 },
  { name: 'Bernardo Silva',         club: 'Manchester City',   leagueFlag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', position: 'MID', overall: 88, clubPrestige: 95, hasCL: true,  clWinOdds: 0.30, age: 30 },
  { name: 'Thibaut Courtois',       club: 'Real Madrid',       leagueFlag: '🇪🇸', position: 'GK',  overall: 90, clubPrestige: 98, hasCL: true,  clWinOdds: 0.35, age: 32 },
  { name: 'Alisson Becker',         club: 'Liverpool',         leagueFlag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', position: 'GK',  overall: 87, clubPrestige: 92, hasCL: true,  clWinOdds: 0.15, age: 32 },
  { name: 'Trent Alexander-Arnold', club: 'Real Madrid',       leagueFlag: '🇪🇸', position: 'DEF', overall: 87, clubPrestige: 98, hasCL: true,  clWinOdds: 0.35, age: 26 },
  { name: 'Virgil van Dijk',        club: 'Liverpool',         leagueFlag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', position: 'DEF', overall: 88, clubPrestige: 92, hasCL: true,  clWinOdds: 0.15, age: 33 },
  { name: 'Rúben Dias',             club: 'Manchester City',   leagueFlag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', position: 'DEF', overall: 89, clubPrestige: 95, hasCL: true,  clWinOdds: 0.30, age: 27 },
  { name: 'Antoine Griezmann',      club: 'Atlético Madrid',   leagueFlag: '🇪🇸', position: 'ATT', overall: 85, clubPrestige: 88, hasCL: true,  clWinOdds: 0.06, age: 33 },
  { name: 'Son Heung-min',          club: 'Tottenham',         leagueFlag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', position: 'ATT', overall: 84, clubPrestige: 81, hasCL: false, clWinOdds: 0.00, age: 32 },
  { name: 'Rafael Leão',            club: 'AC Milan',          leagueFlag: '🇮🇹', position: 'ATT', overall: 86, clubPrestige: 87, hasCL: true,  clWinOdds: 0.06, age: 25 },
  { name: 'Gavi',                   club: 'Barcelona',         leagueFlag: '🇪🇸', position: 'MID', overall: 87, clubPrestige: 91, hasCL: true,  clWinOdds: 0.12, age: 20 },
  { name: 'Nicolò Barella',         club: 'Inter Milan',       leagueFlag: '🇮🇹', position: 'MID', overall: 87, clubPrestige: 88, hasCL: true,  clWinOdds: 0.08, age: 27 },
  { name: 'Victor Osimhen',         club: 'Galatasaray',       leagueFlag: '🇹🇷', position: 'ATT', overall: 87, clubPrestige: 70, hasCL: false, clWinOdds: 0.00, age: 26 },
  { name: 'Khvicha Kvaratskhelia',  club: 'PSG',               leagueFlag: '🇫🇷', position: 'ATT', overall: 87, clubPrestige: 92, hasCL: true,  clWinOdds: 0.10, age: 23 },
  { name: 'Dušan Vlahović',         club: 'Juventus',          leagueFlag: '🇮🇹', position: 'ATT', overall: 85, clubPrestige: 86, hasCL: true,  clWinOdds: 0.05, age: 24 },
  { name: 'Ousmane Dembélé',        club: 'PSG',               leagueFlag: '🇫🇷', position: 'ATT', overall: 86, clubPrestige: 92, hasCL: true,  clWinOdds: 0.10, age: 27 },
  { name: 'Lionel Messi',           club: 'Inter Miami',       leagueFlag: '🇺🇸', position: 'ATT', overall: 82, clubPrestige: 65, hasCL: false, clWinOdds: 0.00, age: 37 },
];

function leagueNameFor(flag: string): string {
  const map: Record<string, string> = {
    '🏴󠁧󠁢󠁥󠁮󠁧󠁿': 'Premier League', '🇪🇸': 'La Liga',
    '🇩🇪': 'Bundesliga', '🇮🇹': 'Serie A', '🇫🇷': 'Ligue 1',
    '🇺🇸': 'MLS', '🇹🇷': 'Süper Lig',
  };
  return map[flag] ?? 'League Title';
}

// --- Event helpers ---
const ch = (
  id: string, label: string, emoji: string,
  description: string, hint: EventChoice['hint'],
  outcome: string, effects: EventChoice['effects'],
): EventChoice => ({ id, label, emoji, description, hint, outcome, effects });

const E = (
  id: string, phase: BDEvent['phase'], category: BDEvent['category'],
  title: string, context: string, choices: EventChoice[],
  positionFilter?: BDPosition[],
): BDEvent => ({ id, phase, category, title, context, choices, positionFilter });

// --- Events pool ---
export const EVENT_POOL: BDEvent[] = [
  // PRE-SEASON (6)
  E('pre_ambition', 'pre_season', 'career', 'Season Ambitions',
    'Your manager sits you down before pre-season. "What are your goals this year?" he asks.',
    [
      ch('trophies', 'Win trophies at any cost', '🏆',
        'Silverware first, personal stats second. The dressing room gets behind you.',
        'team',
        'You declare your hunger for silverware. The manager smiles — that\'s exactly what he wanted to hear.',
        { morale: 12, fame: 5, assists: 2 }),
      ch('personal', 'Have my best-ever personal season', '⭐',
        'Set sky-high personal targets. Huge motivation boost but the pressure is real.',
        'risky',
        'You set towering personal targets. The pressure is on, but you thrive under it.',
        { avgRating: 0.12, morale: 6, fame: 10 }),
      ch('bdo', '"I am here to win the Ballon d\'Or"', '🏅',
        'Bold public declaration. You become the story — high fame, but expect scrutiny.',
        'media',
        'The quote goes everywhere immediately. You\'re the most talked-about player in Europe.',
        { fame: 22, morale: -4 }),
    ]),

  E('pre_training', 'pre_season', 'lifestyle', 'Pre-Season Training Focus',
    'The coaching staff ask where you want to focus this pre-season. The summer is yours to shape.',
    [
      ch('physical', 'Physical conditioning — fitness above all', '💪',
        'Brutal sessions pay off. You arrive to the season in peak physical shape.',
        'safe',
        'Gruelling work in the gym. You arrive to the season in the best shape of your life.',
        { fitness: 20, appearances: 3 }),
      ch('technical', 'Technical refinement — sharpen the tools', '⚽',
        'Hours perfecting your movement and finishing. Tactically smarter but slightly less sharp physically.',
        'safe',
        'Hours on the training pitch. Your touch, movement and decision-making feel razor-sharp.',
        { avgRating: 0.15, goals: 1, assists: 1, fitness: -5 }),
      ch('mental', 'Mental preparation — composure and leadership', '🧠',
        'Work with the psychologist. Helps enormously in big moments, slight lack of match sharpness.',
        'safe',
        'You work with the sports psychologist. Big-game composure markedly improved.',
        { morale: 14, avgRating: 0.10, manOfTheMatch: 1 }),
    ]),

  E('pre_transfer', 'pre_season', 'career', 'Transfer Interest',
    'A top European club has made enquiries. Your club has set a price. The choice is yours.',
    [
      ch('push', 'Force the transfer through', '✈️',
        'Burns bridges here, but a bigger stage awaits. Fame rockets, morale takes a hit.',
        'risky',
        'You hand in a transfer request. The atmosphere turns cold but the move is secured.',
        { fame: 20, morale: -10, fitness: -5 }),
      ch('loyal', 'Commit to the club', '❤️',
        'The fans love you for it. The club rewards you. Positive environment all season.',
        'team',
        'You reaffirm your loyalty publicly. The fans are delighted. A pay rise follows.',
        { morale: 18, fame: 10, fitness: 5 }),
      ch('quiet', 'Stay quiet — keep your options open', '🤫',
        'No one is happy with your silence, but you stay focused. Low risk, low reward.',
        'safe',
        'You say nothing publicly. Frustrating for both clubs, but you stay focused.',
        { morale: 2, fame: 4 }),
    ]),

  E('pre_media', 'pre_season', 'lifestyle', 'Pre-Season Media Tour',
    'Major broadcasters and sponsors want a sit-down interview. Millions will watch.',
    [
      ch('bold', '"I can win the Ballon d\'Or this year"', '🎤',
        'The quote goes viral instantly. Enormous fame but you\'re now under the microscope.',
        'media',
        'The clip dominates the news cycle. Pressure is sky-high. You wouldn\'t have it any other way.',
        { fame: 22, morale: -5 }),
      ch('focused', 'Credit the team — keep it professional', '🙏',
        'Measured and classy. Respected globally. Modest fame, but great for morale.',
        'safe',
        'A classy, measured interview. Respected worldwide for your professionalism.',
        { fame: 10, morale: 10 }),
      ch('skip', 'Skip it — stay focused on training', '🏃',
        'No distractions. You arrive to the season fresher than anyone — but miss the exposure.',
        'safe',
        'No media distractions. You arrive to the season sharper than anyone.',
        { fitness: 10, avgRating: 0.06 }),
    ]),

  E('pre_manager', 'pre_season', 'career', "Manager's Meeting",
    'Your manager has a frank one-to-one about your role. He wants to know what you expect.',
    [
      ch('starter', 'Demand guaranteed first-team status', '🔑',
        'You\'re starting every game. But underperform and there\'s nowhere to hide.',
        'risky',
        'The manager respects your directness. You\'re named in the starting XI for every game.',
        { appearances: 4, morale: 8, fame: 6 }),
      ch('earn', 'Earn my place — let performances decide', '💯',
        'The mature answer. The coaching staff build the system around you gradually.',
        'safe',
        'A mature response. The manager builds his system around you within weeks.',
        { avgRating: 0.12, morale: 8, fitness: 3 }),
      ch('rotate', 'Accept a rotation role to stay fresh', '🔄',
        'Fewer appearances but you arrive for big games at 100%. Stats may suffer.',
        'team',
        'Smart. You stay sharp for the moments that matter most.',
        { fitness: 15, avgRating: 0.08, appearances: -3, morale: 4 }),
    ]),

  E('pre_fitness', 'pre_season', 'lifestyle', 'Fitness Assessment',
    'The club physios run comprehensive pre-season tests. The results shape your starting status.',
    [
      ch('peak', 'Returned in best-ever physical shape', '🔥',
        'The data is exceptional. The manager names you captain for the opener.',
        'safe',
        'The numbers are exceptional. You are at the absolute peak of your physical powers.',
        { fitness: 22, appearances: 3, avgRating: 0.08 }),
      ch('solid', 'Standard pre-season preparation', '👍',
        'Solid and ready. Nothing flashy, but you\'ll be first choice from game one.',
        'safe',
        'You are in solid shape. Nothing extraordinary, but ready to hit the ground running.',
        { fitness: 10, appearances: 1 }),
      ch('late', 'Extended holiday — came back slightly late', '🏖️',
        'The pap shots went viral (huge fame) but you\'re behind physically. Slow start guaranteed.',
        'media',
        'You missed the first training block. The manager is displeased. A slow start awaits.',
        { fame: 8, fitness: -12, appearances: -2, morale: -8 }),
    ]),

  // FIRST HALF (13)
  E('h1_att', 'first_half', 'match', 'One-on-One with the Keeper',
    'Third game of the season. You\'re clean through. The stadium holds its breath.',
    [
      ch('clinical', 'Finish clinically — low and hard to the corner', '🎯',
        'The reliable option. Almost always works. Great for stats, not for the highlights reel.',
        'safe',
        'Net-shaker. Clinical early-season form. Three points secured.',
        { goals: 3, avgRating: 0.14, manOfTheMatch: 1 }),
      ch('chip', 'Audacious chip — high risk, spectacular reward', '🎪',
        'Viral highlight if it works. Massive fame boost either way — but you might miss.',
        'risky',
        'Genius. The chip is perfect. Clips of it dominate social media all week.',
        { goals: 2, fame: 14, manOfTheMatch: 1, avgRating: 0.08 }),
      ch('square', 'Square it — easy tap-in for your striker', '🤲',
        'The selfless choice. Your teammate scores. You get the assist and the dressing room love.',
        'team',
        'Selfless. Your teammate scores easily. Dressing room harmony at an all-time high.',
        { assists: 3, morale: 10, avgRating: 0.10 }),
    ], ['ATT']),

  E('h1_mid', 'first_half', 'match', 'Space Opens Up in Midfield',
    'A tight game, but you receive the ball with acres of space 30 yards out. Millions watching.',
    [
      ch('shoot', 'Let fly from range — thunderbolt attempt', '💥',
        'Goal of the month if it goes in. You might also skew it wide and look foolish.',
        'risky',
        'Thunderbolt into the top corner. Goal of the month. The stadium erupts.',
        { goals: 2, fame: 10, avgRating: 0.14 }),
      ch('through', 'Slide the inch-perfect through ball', '🎯',
        'The vision play. Your striker is through and scores. Pure midfield craft.',
        'team',
        'Inch-perfect delivery. Your striker is through and scores. The assist is world class.',
        { assists: 4, avgRating: 0.16, morale: 6 }),
      ch('press', 'Drive forward — lead the press by example', '💨',
        'No stats but you set the tone for the whole team. Leadership earns you enormous respect.',
        'team',
        'You lead the press and your example ignites the whole team. An inspiring performance.',
        { avgRating: 0.12, fitness: -4, manOfTheMatch: 1, morale: 8 }),
    ], ['MID']),

  E('h1_def', 'first_half', 'match', 'Last-Ditch Defending',
    'Their striker is bearing down on goal with only you between them and the net.',
    [
      ch('tackle', 'Commit to the challenge — perfect timing', '🦵',
        'The hero tackle. High risk — mistiming means a red card. But perfectly done, it\'s a classic.',
        'risky',
        'Perfect timing. You nick the ball cleanly. The crowd roars. A masterclass.',
        { cleanSheets: 3, avgRating: 0.18, manOfTheMatch: 1 }),
      ch('jockey', 'Jockey — delay until help arrives', '🧱',
        'Disciplined defending. Less glory, but almost no risk. The team wins through structure.',
        'safe',
        'Disciplined defending. You hold your shape and the keeper makes the save.',
        { cleanSheets: 2, avgRating: 0.12, fitness: 2 }),
      ch('cover', 'Trust your centre-back — drop into cover', '🛡️',
        'Smart positioning. You sacrifice the direct duel but protect the team structure.',
        'team',
        'Intelligent reading of the game. Your cover allows the defence to hold firm.',
        { cleanSheets: 1, avgRating: 0.08, morale: 6, fitness: 3 }),
    ], ['DEF']),

  E('h1_gk', 'first_half', 'match', 'Point-Blank Save',
    'Their striker is three yards out with a tap-in. You have a split-second.',
    [
      ch('instinct', 'Pure reflex — full-stretch dive', '🧤',
        'The miraculous save. If you get it right, it\'s the highlight of the season.',
        'risky',
        'Miraculous. Your reflexes are superhuman. You\'re named man of the match without question.',
        { cleanSheets: 3, avgRating: 0.22, manOfTheMatch: 2 }),
      ch('read', 'Read the play early — get set', '👁️',
        'The goalkeeper\'s art. Anticipation beats athleticism. Safe and effective.',
        'safe',
        'You anticipated the cross and were already in position. A commanding catch.',
        { cleanSheets: 2, avgRating: 0.14, manOfTheMatch: 1 }),
      ch('command', 'Command the box — punch it clear', '✊',
        'Vocal and dominant. Puts fear into attackers for the rest of the game.',
        'safe',
        'Dominant in the air. You punch the danger away and organise your defence.',
        { cleanSheets: 1, avgRating: 0.09, morale: 8 }),
    ], ['GK']),

  E('h1_cl', 'first_half', 'match', 'Champions League Night',
    'The UEFA Champions League. Under the floodlights. All of Europe watching every touch.',
    [
      ch('star', 'Rise to the occasion — be the star', '⭐',
        'Go for it all. Massive stats and fame if you deliver. The BdO race starts here.',
        'risky',
        'An imperious European performance. Your name echoes across the entire continent.',
        { goals: 2, assists: 1, avgRating: 0.20, fame: 15, manOfTheMatch: 1 }),
      ch('solid', 'Efficient and controlled — do your job', '✅',
        'Less glamour, more reliability. Great for rating, great for team morale.',
        'safe',
        'Professional. You do your job without fuss. The team advances.',
        { avgRating: 0.10, morale: 8, fitness: 3 }),
      ch('gamble', 'Go for broke — try everything', '😤',
        'Spectacular attempts that may not come off. High fame either way — viral clips guaranteed.',
        'media',
        'Some brilliant moments, some costly mistakes. A night of two halves. The highlights go viral.',
        { goals: 1, avgRating: -0.03, fame: 10, morale: -3 }),
    ]),

  E('h1_intl', 'first_half', 'lifestyle', 'International Break',
    'Your national team calls. But you\'ve got a slight knock on your ankle.',
    [
      ch('go', 'Go and represent your country', '🌍',
        'Pride of representing your nation. Fitness takes a hit but the fame and morale are worth it.',
        'team',
        'You play through it and deliver for your nation. Genuine pride. Worth every minute.',
        { goals: 1, assists: 1, fame: 10, fitness: -10 }),
      ch('withdraw', 'Withdraw — protect yourself for the club', '🏥',
        'The smart call. Return refreshed and the club is quietly relieved.',
        'safe',
        'You rest up and return fully fit. The club is quietly relieved.',
        { fitness: 14, morale: 4 }),
      ch('push', 'Play the full ninety — ignore the physio', '💪',
        'High-risk. You look brilliant — but the ankle worsens and you miss league games.',
        'risky',
        'You play on. A heroic performance for your country but the ankle worsens significantly.',
        { goals: 2, fame: 8, fitness: -18, appearances: -3 }),
    ]),

  E('h1_bdo_q', 'first_half', 'lifestyle', "Ballon d'Or Question",
    'A journalist catches you after training. "Do you think about winning the Ballon d\'Or?"',
    [
      ch('target', '"It\'s my number one target this season"', '🥇',
        'Enormous fame boost. But pressure and media scrutiny will follow you everywhere.',
        'media',
        'The quote dominates the sports headlines. You are now THE story in world football.',
        { fame: 22, morale: -4 }),
      ch('humble', '"I just focus on helping my club win"', '🙏',
        'The humble answer. Fans worldwide warm to you. Good fame and great for morale.',
        'safe',
        'The media love the humility. Fans across the world warm to you enormously.',
        { fame: 12, morale: 10 }),
      ch('laugh', '"Ask me again in May with the trophy"', '😄',
        'Confident and charming without being arrogant. A viral clip that everyone loves.',
        'media',
        'Confident and charming. The clip goes global overnight. The internet is delighted.',
        { fame: 16, morale: 6 }),
    ]),

  E('h1_injury', 'first_half', 'lifestyle', 'Injury Concern',
    'You roll your ankle in training. The physio says rest 10 days. The manager wants you to play.',
    [
      ch('rest', "Follow the physio's advice", '🏥',
        'Miss two games, return fully fit. The sensible long-game decision.',
        'safe',
        'Smart. You miss two matches but return fully fit for the run of games ahead.',
        { fitness: 14, appearances: -2 }),
      ch('play', 'Play through — every game counts', '😤',
        'You stay available but the ankle affects everything. Rating and fitness both suffer.',
        'risky',
        'You make it through but the ankle isn\'t right for weeks. Everything suffers slightly.',
        { avgRating: -0.08, fitness: -14, appearances: 2 }),
      ch('half', 'Play 45 minutes — protect the second half', '🔄',
        'A clever compromise. You contribute but protect yourself. Slight rating dip.',
        'safe',
        'A pragmatic compromise. You give 45 good minutes and protect yourself for what\'s ahead.',
        { fitness: -4, appearances: -1, morale: 4, avgRating: 0.02 }),
    ]),

  E('h1_derby', 'first_half', 'match', 'Derby Day',
    'The biggest local rivalry of the season. The atmosphere is electric. Millions watching.',
    [
      ch('inspired', 'Rise to the occasion — this is your moment', '🔥',
        'Put on a show. Derby performances define legends. High risk, enormous reward.',
        'risky',
        'A derby day masterclass. Goals, drive, leadership — everything. You ARE the difference.',
        { goals: 2, assists: 1, avgRating: 0.22, fame: 12, manOfTheMatch: 1 }),
      ch('tactical', 'Stay disciplined — win the tactical battle', '🧠',
        'Head over heart. Control the game rather than trying to win it alone.',
        'safe',
        'Controlled and disciplined. A gritty victory. Hard to argue with the result.',
        { avgRating: 0.12, cleanSheets: 1, morale: 10 }),
      ch('captain', 'Step up as the on-pitch leader', '🤝',
        'No flashy goals — just pure leadership. The team follows your example all game.',
        'team',
        'You organise, shout, encourage. The team plays for you. A win built on leadership.',
        { assists: 1, morale: 14, fame: 8, avgRating: 0.10 }),
    ]),

  E('h1_conflict', 'first_half', 'career', 'Dressing Room Tension',
    'A senior teammate has been undermining you in training. The manager has noticed the friction.',
    [
      ch('confront', 'Confront them directly — clear the air', '💬',
        'Honest and direct. Short-term awkward, long-term the dressing room is stronger.',
        'risky',
        'A frank conversation. Mutual respect restored. The team is stronger for the honesty.',
        { morale: 12, avgRating: 0.06, fame: 4 }),
      ch('focus', 'Let your performances do the talking', '⚽',
        'Stay professional and produce results. Takes longer but the manager respects it.',
        'safe',
        'You stay professional and produce better results than ever. The manager takes note.',
        { avgRating: 0.14, goals: 1, morale: 6 }),
      ch('manage', 'Speak to the manager privately', '👔',
        'The situation gets handled — but being seen as a complainer has a mild morale cost.',
        'safe',
        'The manager handles it swiftly. The player is spoken to. Atmosphere improves.',
        { morale: 6, fitness: 5, avgRating: 0.04 }),
    ]),

  E('h1_penalty', 'first_half', 'match', 'Penalty Shootout',
    'A cup game goes to penalties. You step up in a must-not-miss moment for the team.',
    [
      ch('cool', 'Ice cool — pick your spot, trust your technique', '🎯',
        'The composed approach. Almost always works. Goals and morale for the team.',
        'safe',
        'Unstoppable. You bury it into the corner. Calmness under the brightest lights.',
        { goals: 1, fame: 10, morale: 14, manOfTheMatch: 1 }),
      ch('power', 'Blast it — pure power straight down the middle', '💥',
        'The keeper dives. If they stay central you\'re embarrassed. High risk, decent fame.',
        'risky',
        'The keeper commits to a dive. Right down the middle. Power wins this battle.',
        { goals: 1, morale: 10, fame: 8 }),
      ch('delay', 'Long run-up — try to psych the keeper out', '🎭',
        'A showboating attempt. The keeper reads it. Miss, but an enormous viral clip.',
        'media',
        'The keeper reads the delay and stays central. You miss. The clip goes viral for weeks.',
        { morale: -12, fame: 8, avgRating: -0.04 }),
    ]),

  E('h1_hattrick', 'first_half', 'match', 'Hat-Trick Ball',
    'Two goals in, your side win a late penalty. You grab the ball — the designated taker confronts you.',
    [
      ch('take', 'This is my hat-trick — take the ball', '⚽',
        'You score. Crowd in raptures. But the taker is furious — dressing room tension follows.',
        'selfish',
        'You score. A hat-trick. The crowd goes absolutely wild — but your teammate is livid.',
        { goals: 3, fame: 16, morale: -8, manOfTheMatch: 1 }),
      ch('give', 'Hand it over — respect the hierarchy', '🤝',
        'The selfless call. The dressing room adores you. Your moment will come.',
        'team',
        'The designated taker scores. You\'re the bigger man. Dressing room harmony soars.',
        { assists: 1, morale: 14, fame: 8 }),
    ], ['ATT']),

  // JANUARY (5)
  E('jan_interest', 'january', 'career', 'January Transfer Window',
    'A top club has submitted a formal bid. Your club is reluctant. The choice is yours.',
    [
      ch('force', 'Force the transfer through', '✈️',
        'Bigger stage, better CL access. Morale hit from how you leave, but a fresh start.',
        'risky',
        'You force the move. A bigger stage. The new club is ready to make you their star.',
        { fame: 22, morale: -12, fitness: -5 }),
      ch('stay', 'Commit until the summer', '🤝',
        'Professional and focused. Fully settled for the second half. Safe, reliable choice.',
        'safe',
        'You agree to see out the season. Focused and professional for the months ahead.',
        { morale: 14, avgRating: 0.12, fame: 6 }),
      ch('terms', 'Use the interest to get improved terms to stay', '💰',
        'Win-win if the club agrees. Financially sorted and fully motivated to deliver.',
        'safe',
        'You use the interest as leverage. A new deal arrives. Settled and secure.',
        { morale: 10, fame: 8, fitness: 6, avgRating: 0.06 }),
    ]),

  E('jan_signing', 'january', 'career', 'New Signing Rivals Your Place',
    'The club has spent big in January on a player in your exact position. Real competition now.',
    [
      ch('rise', 'Welcome the competition — use it as fuel', '💪',
        'Your training intensity hits new heights. You perform better under the pressure.',
        'safe',
        'Your training intensity reaches new heights. You perform better than ever under pressure.',
        { avgRating: 0.16, goals: 2, morale: 8 }),
      ch('accept', 'Adapt — offer to play a hybrid role', '🔄',
        'Your flexibility impresses the staff. You play more games, not fewer.',
        'team',
        'Your versatility impresses the coaching staff. You end up playing more, not fewer.',
        { appearances: 5, assists: 2, morale: 6 }),
      ch('clarity', 'Request a meeting — demand clarity on your future', '😤',
        'The manager reassures you, but the tension lingers. Mild morale cost.',
        'risky',
        'The manager reassures you. You\'re still number one. The distraction costs you slightly.',
        { morale: -6, avgRating: 0.06, appearances: 2 }),
    ]),

  E('jan_rest', 'january', 'lifestyle', 'Mid-Season Break',
    'A rare week without fixtures. The coaching staff ask how you want to spend it.',
    [
      ch('train', 'Intensive training block', '⚽',
        'You work harder than the rest. Technically sharper for the second half — but more fatigued.',
        'safe',
        'You push hard in training. Technically sharper heading into the second half of the season.',
        { avgRating: 0.12, goals: 1, fitness: -4 }),
      ch('recovery', 'Full rest and body recovery', '😴',
        'The smart choice. You return like a completely new player for the run-in.',
        'safe',
        'Your body thanks you. The second half of the season you feel like a completely fresh player.',
        { fitness: 20, appearances: 3, avgRating: 0.06 }),
      ch('media', 'Media appearances — global brand building', '📸',
        'Commercial week. Massive fame boost but you\'re slightly less sharp on return.',
        'media',
        'A commercial week. Interviews, photoshoots, global brand deals. Fame goes through the roof.',
        { fame: 20, morale: 6, fitness: -8 }),
    ]),

  E('jan_contract', 'january', 'career', 'Contract Extension Offer',
    'The club offer you a long-term deal. Good terms — but not quite what a world-class player deserves.',
    [
      ch('sign', 'Sign immediately', '✍️',
        'Settled and secure. You refocus entirely on football. Form immediately picks up.',
        'safe',
        'Settled and secure. You refocus on football. Form immediately picks up.',
        { morale: 16, avgRating: 0.09, fitness: 5 }),
      ch('hold', 'Negotiate — hold out for better terms', '🤝',
        'Confident play. You might get a better deal. Slight distraction cost.',
        'risky',
        'Negotiations drag on. Distracting, but you believe you\'ll get what you deserve.',
        { fame: 10, morale: -6, fitness: 2 }),
      ch('reject', 'Reject it — you want a big move in summer', '👋',
        'A huge summer move is coming. But split focus hurts your second-half form slightly.',
        'media',
        'You signal your intention to leave. A big move is coming. Focus is split.',
        { fame: 18, morale: -10, avgRating: -0.04 }),
    ]),

  E('jan_cup', 'january', 'match', 'FA Cup Fourth Round',
    'A Premier League rival in the cup. First silverware of the season is within reach.',
    [
      ch('full', 'Give everything — cup fever grips you', '🏆',
        'You carry the team with an inspired display. A quarter-final awaits.',
        'risky',
        'You carry the team through with an inspired display. The quarter-final is booked.',
        { goals: 2, assists: 1, avgRating: 0.14, morale: 10, fitness: -6 }),
      ch('rotate', 'Ask to be rested — preserve fitness for the league', '🔄',
        'Smart squad management. Fresher for the big league games ahead.',
        'safe',
        'Smart management. You rest and the team progresses. Fresher for what matters.',
        { fitness: 10, avgRating: 0.04, appearances: -1 }),
      ch('manage', 'Play and manage your minutes', '🎛️',
        'A professional performance without going all out. Decent all round.',
        'safe',
        'Measured. You do enough to progress without overextending yourself.',
        { goals: 1, morale: 6, fitness: 2, avgRating: 0.06 }),
    ]),

  // SECOND HALF (9)
  E('h2_title', 'second_half', 'match', 'Title Race Crunch Game',
    'You\'re in a three-way title race. The next four games are everything. This one is pivotal.',
    [
      ch('deliver', 'Step up and win it yourself', '👑',
        'The match-winner. Enormous fame and morale. But what if you don\'t deliver?',
        'risky',
        'You score the winner with 12 minutes left. The title race is now firmly in your hands.',
        { goals: 3, fame: 20, avgRating: 0.22, manOfTheMatch: 1, morale: 12 }),
      ch('collective', 'Trust the system — lead without the ball', '🤝',
        'Selfless. You contribute everywhere and the team wins through collective effort.',
        'team',
        'A brilliant team effort. You lead without hogging the spotlight. A crucial win.',
        { assists: 2, avgRating: 0.14, morale: 10 }),
      ch('compose', 'Control the game — see it out professionally', '🎯',
        'The composed approach. Win the game with intelligence rather than fireworks.',
        'safe',
        'Intelligent football. You control the tempo and the team takes all three points.',
        { avgRating: 0.10, morale: 8, fitness: 3 }),
    ]),

  E('h2_cupsemi', 'second_half', 'match', 'Cup Semi-Final',
    'One game from Wembley. Your performance here could define your entire season.',
    [
      ch('heroics', 'Play through the pain — be the hero', '🦸',
        'A warrior performance. If you deliver, you\'re a legend. High fitness cost.',
        'risky',
        'A warrior performance. You score, you assist. The final is booked. A legend today.',
        { goals: 2, assists: 1, avgRating: 0.22, fame: 14, fitness: -12, manOfTheMatch: 1 }),
      ch('smart', 'Pick your moments — decisive when it counts', '🧠',
        'Don\'t spend yourself. Win the game at key moments and stay fresh for the final.',
        'safe',
        'You pick your moments and they all land. Efficient, clinical, decisive.',
        { goals: 1, avgRating: 0.12, morale: 10, fitness: -4 }),
      ch('rest_final', 'Protect your body — manage the 90 minutes', '🏥',
        'Sacrifice the semi stats to arrive at the final fully fit.',
        'team',
        'A managed performance. The team struggles but reaches the final. You arrive fully fit.',
        { fitness: 10, appearances: -1, morale: 4 }),
    ]),

  E('h2_cl_ko', 'second_half', 'match', 'Champions League Quarter-Final',
    'Two legs against a world-class opponent. The entire continent is watching.',
    [
      ch('world', 'Produce the performance of your career', '🌟',
        'The biggest stage. If you deliver, it transforms your Ballon d\'Or campaign entirely.',
        'risky',
        'A performance that will be replayed for decades. You single-handedly win the tie.',
        { goals: 3, assists: 1, avgRating: 0.28, fame: 22, manOfTheMatch: 2 }),
      ch('team', 'Be the team\'s heartbeat over two legs', '💚',
        'Lead the team through with composure and class. Not flashy — but highly effective.',
        'team',
        'You lead through with composure and class. The semi-final awaits.',
        { goals: 1, assists: 2, avgRating: 0.16, fame: 14, morale: 10 }),
      ch('exit', 'Exit in the quarters — not your night', '😔',
        'Despite your best efforts, you go out. But you go out fighting — and stay fit.',
        'safe',
        'Despite your best efforts, you\'re eliminated. But you gave everything.',
        { morale: -8, fame: 4, fitness: 8 }),
    ]),

  E('h2_rival', 'second_half', 'career', "Rival's Record Run",
    'Haaland or Mbappé is on a jaw-dropping run. Every pundit has handed them the Ballon d\'Or already.',
    [
      ch('fuel', 'Use it as fuel — outperform them', '⚔️',
        'Their brilliance drives you to new heights. You go on a remarkable run of your own.',
        'risky',
        'Their form drives you to heights you\'ve never reached before. A remarkable personal run.',
        { goals: 3, assists: 2, avgRating: 0.16, fame: 12 }),
      ch('maintain', 'Stay focused on your own game', '🎯',
        'No distractions. You keep delivering. The narrative will take care of itself.',
        'safe',
        'No distractions. You keep delivering consistently. The voters take note.',
        { avgRating: 0.12, morale: 10, goals: 1 }),
      ch('accept', 'Acknowledge their form — aim for a top-5 finish', '🙏',
        'Realistic. You stop chasing, play relaxed football, and actually perform better.',
        'safe',
        'Grounded and realistic. You play without pressure and deliver surprisingly well.',
        { avgRating: 0.08, fitness: 6, morale: 5, goals: 1 }),
    ]),

  E('h2_captain', 'second_half', 'career', 'Captaincy Offered',
    'The regular captain is suspended for three games. The manager turns to you.',
    [
      ch('lead', 'Accept with pride — lead from the front', '🤝',
        'A natural leader. Significant fame and morale boost. You win all three games.',
        'team',
        'A natural leader. The team rallies. You win all three games with the armband.',
        { fame: 16, morale: 14, avgRating: 0.14, goals: 1, manOfTheMatch: 1 }),
      ch('decline', 'Decline — not the right time for you', '🙅',
        'The manager respects the honesty. You lead by example on the pitch instead.',
        'safe',
        'Honest and self-aware. You lead by example on the pitch instead of by title.',
        { morale: 4, avgRating: 0.10 }),
    ]),

  E('h2_comeback', 'second_half', 'match', 'Return from Injury',
    'Three weeks out. This is your return to the starting XI. Every camera is on you.',
    [
      ch('explosive', 'Prove a point from the first whistle', '💥',
        'Spectacular comeback if you deliver. But you might be rusty and damage your rating.',
        'risky',
        'Unstoppable. Your comeback match is one of the performances of your career.',
        { goals: 2, assists: 1, avgRating: 0.20, fame: 12, manOfTheMatch: 1 }),
      ch('steady', 'Ease back in — sensible return to match pace', '🔄',
        'The smart choice. Full fitness in two weeks, consistent form maintained.',
        'safe',
        'Smart. You manage your minutes carefully and build back to full sharpness.',
        { fitness: 14, avgRating: 0.08, appearances: 2 }),
    ]),

  E('h2_media_fav', 'second_half', 'lifestyle', "Ballon d'Or Favourite",
    'The press have named you as a leading Ballon d\'Or contender. Cameras are following you.',
    [
      ch('embrace', 'Embrace all the attention', '🎤',
        'You thrive in the spotlight. Global brands come knocking. Popularity hits a new peak.',
        'media',
        'You thrive in the spotlight. Major global brands come knocking. Fame reaches new heights.',
        { fame: 28, morale: 6 }),
      ch('deflect', 'Deflect to trophies — "I just want to win"', '🏆',
        'Classy. The world loves the answer. Fewer headlines but great morale.',
        'safe',
        'Classy as always. "I just want to win trophies." The world loves the grace.',
        { fame: 14, morale: 14, avgRating: 0.09 }),
      ch('ignore', 'Ignore all of it — lock in completely', '🧘',
        'No distractions whatsoever. You enter a form period nobody can explain.',
        'safe',
        'No distractions. You enter a form period that silences every doubter.',
        { goals: 2, avgRating: 0.14, fitness: 6 }),
    ]),

  E('h2_away', 'second_half', 'match', 'Hostile Away Ground',
    'A must-win away game. The home crowd is unrelenting from the first whistle.',
    [
      ch('relish', 'Feed off the hostility', '😈',
        'Silence the crowd. Produces some of your best performances. High ceiling.',
        'risky',
        'You love every second of it. Silencing the home crowd is your favourite feeling.',
        { goals: 2, avgRating: 0.17, fame: 10, manOfTheMatch: 1 }),
      ch('professional', 'Head down — do the job', '🤐',
        'Professional and effective. Not pretty but three points is three points.',
        'safe',
        'Head down, game managed. A gritty win without any fireworks. Job done.',
        { avgRating: 0.10, morale: 8 }),
      ch('organise', 'Be the vocal organiser — lead the defensive block', '📢',
        'Leadership over individual brilliance. The team looks to you constantly.',
        'team',
        'Your voice organises the team. A disciplined, structured away win.',
        { assists: 1, morale: 10, avgRating: 0.08, fitness: -4 }),
    ]),

  E('h2_partner', 'second_half', 'lifestyle', 'Personal Life',
    'Your partner has been patient all season. They want a night completely away from football. You have a light week ahead.',
    [
      ch('date_night', 'Take them somewhere special — football can wait', '❤️',
        'The right call for the relationship. You come back to training with a clearer head than you\'ve had all season.',
        'team',
        'A perfect evening. They appreciate it enormously. You return to training refreshed and mentally sharp.',
        { morale: 16, fitness: 5 }),
      ch('compromise', 'Half the evening together, then an early night', '⏱️',
        'A compromise. Not perfect, but the relationship holds and you\'re rested enough.',
        'safe',
        'A balanced evening. Not perfect for either of you, but the relationship holds.',
        { morale: 6 }),
      ch('postpone', '"Can we plan something in the summer? I\'m in the middle of my season."', '😬',
        'They understand. Barely. The tension lingers and something feels slightly off at home.',
        'selfish',
        'They accept it. The awkward silence lasts a few days. You feel the weight of it.',
        { morale: -8, fitness: 4 }),
    ]),

  E('h2_tabloid', 'second_half', 'lifestyle', 'Tabloid Story',
    'A tabloid is running a piece about a private night out three weeks ago. Minor stuff — but the timing, with the Ballon d\'Or race building, is damaging.',
    [
      ch('silence', 'Say nothing — let it die quietly', '🤐',
        'The dignified approach. Most fans move on in 48 hours. Some damage, nothing lasting.',
        'safe',
        'You stay silent. The story runs for two days and disappears. Controlled.',
        { fame: -5, morale: -4 }),
      ch('statement', 'Release a brief, measured statement', '📝',
        'Takes control of the narrative. Works well — the response earns almost as much coverage as the story.',
        'media',
        'Your statement is praised for its tone. The whole thing blows over within two days.',
        { fame: 5, morale: 6 }),
      ch('attack', 'Call it out publicly — go on social media and fight back', '🐦',
        'High risk. Either the public sides with you overwhelmingly or the story gets bigger.',
        'risky',
        'It becomes the dominant story for a week. Exhausting, but your name is everywhere.',
        { fame: 14, morale: -8, fitness: -3 }),
    ]),

  E('h2_overplay', 'second_half', 'lifestyle', 'Overload Warning',
    'The physio flags you as a fatigue risk. The manager wants you to play through it.',
    [
      ch('push', 'Push through — every minute in the run-in counts', '💪',
        'Your stats stay high but the body pays a price. Fitness drops significantly.',
        'selfish',
        'You battle on. Stats are excellent but the body is paying a serious price.',
        { goals: 1, avgRating: 0.09, fitness: -18, morale: 6 }),
      ch('manage', 'Ask to rotate in the lesser fixtures', '🎛️',
        'Sensible rotation. You\'re fresh for the big matches that define seasons.',
        'safe',
        'Sensible. You come on as a sub in lesser games, fresh for the big ones.',
        { fitness: 12, avgRating: 0.08, morale: 5 }),
      ch('rest_week', 'Take a week\'s rest — miss one fixture', '😴',
        'Miss one game. Return like a completely different player for the crucial run.',
        'safe',
        'You miss one match. But you return to the run-in like a completely different player.',
        { fitness: 20, appearances: -1, avgRating: 0.07 }),
    ]),

  // RUN-IN (5)
  E('ri_finale', 'run_in', 'match', 'Season Finale',
    'Last game of the season. The result doesn\'t matter — but your performance might define your BdO campaign.',
    [
      ch('glory', 'Go for broke — end the season in style', '🎆',
        'A goal and assist in the final game. Every pundit names you player of the season.',
        'media',
        'A goal, an assist, Man of the Match. The perfect curtain call. Everyone remembers this.',
        { goals: 2, assists: 1, avgRating: 0.16, fame: 14, manOfTheMatch: 1 }),
      ch('steady_ri', 'Solid display — protect the body', '🛡️',
        'Professional and measured. You finish the season without any risks.',
        'safe',
        'Professional and measured. You finish the season without a scratch.',
        { avgRating: 0.07, fitness: 10, morale: 6 }),
      ch('sub_ri', 'Ask to come on as a substitute', '💺',
        'Rest the body completely for the off-season. Arrive next season fully recharged.',
        'safe',
        'Smart body management. Fully rested for the off-season. Your numbers hold up fine.',
        { fitness: 15, morale: 4 }),
    ]),

  E('ri_interview', 'run_in', 'lifestyle', 'Season Review Interview',
    'The major broadcasters want your verdict on your own season. The BdO race is intensifying.',
    [
      ch('best', '"This has been the season of my career"', '⭐',
        'Confident and authentic. The world believes it because of what you\'ve done.',
        'media',
        '"This is the best I\'ve ever played." The confidence is infectious. The world agrees.',
        { fame: 20, morale: 8 }),
      ch('trophies_ri', 'Highlight the trophies and the team effort', '🏆',
        'Perfectly pitched for BdO consideration. Gracious, team-focused, impressive.',
        'safe',
        'You credit the team and the trophies. Perfectly pitched for Ballon d\'Or consideration.',
        { fame: 14, morale: 12, avgRating: 0.06 }),
      ch('hungry', '"I want even more next season"', '🔥',
        'Shows hunger and drive. A player at the peak of his powers who wants more.',
        'safe',
        '"I\'m not satisfied." The drive impresses everyone. Hungry at the very top.',
        { fame: 12, morale: 6, overall: 1 }),
    ]),

  E('ri_bdo_hype', 'run_in', 'lifestyle', "Ballon d'Or Campaign",
    'Paris. October. The ceremony is two months away. French Football are calling. You\'re in contention.',
    [
      ch('events', 'Attend every pre-ceremony gala and event', '🎩',
        'Relentless campaigning. You work every room. Your vote tally goes through the roof.',
        'media',
        'You work every room brilliantly. Your campaign for votes is devastatingly effective.',
        { fame: 26, morale: 3 }),
      ch('football', 'Let the football speak for itself', '⚽',
        'The purist approach. Voters respect it. Less fame, but enormous credibility.',
        'safe',
        'No campaigning. The voters respect it enormously — perhaps more than anything else.',
        { fame: 12, morale: 14, avgRating: 0.06 }),
      ch('social', 'Massive social media campaign', '📱',
        'Viral content and hundreds of millions of views. Fame hits a stratospheric new level.',
        'media',
        'A viral campaign. Hundreds of millions of views. Your profile reaches new heights.',
        { fame: 24, morale: 2 }),
    ]),

  E('ri_lastday', 'run_in', 'match', 'Final Day Drama',
    'The title hangs by a thread. Your side needs a win to be champions. All or nothing.',
    [
      ch('hero_ri', 'Be the hero when it matters most', '👑',
        'The winner-goal moment. Club legend status if you deliver. Enormous fame.',
        'risky',
        'You score the winner. Champions. Your name lives in this club\'s history forever.',
        { goals: 2, avgRating: 0.22, fame: 22, morale: 16, manOfTheMatch: 1 }),
      ch('team_ri', 'Contribute fully to a collective title win', '🤝',
        'Assists, leadership, intensity. The team wins the title and you played your part.',
        'team',
        'Assists, intensity, leadership. The team wins the title and you were everywhere.',
        { assists: 2, avgRating: 0.14, morale: 14, fame: 12 }),
      ch('watch_ri', 'Carrying an injury — watch from the stands', '💔',
        'Heartbreaking. But you protect your body for next season.',
        'safe',
        'Heartbreaking. You watch your teammates lift the trophy without you. But you\'ll be back.',
        { morale: -8, fame: 6, fitness: 12 }),
    ]),

  E('ri_gala', 'run_in', 'lifestyle', 'End of Season Gala',
    'The club holds a black-tie celebration. The chairman praises you in a heartfelt public speech.',
    [
      ch('speech', 'Give a rousing speech in return', '🎤',
        'Your words bring the room to its feet. Clips go global. A truly iconic moment.',
        'media',
        'Your words bring the room to its feet. Clips go global overnight. A legendary night.',
        { fame: 16, morale: 14, overall: 1 }),
      ch('humble_gala', 'Stay humble — let others shine tonight', '🙂',
        'Classy. The manager praises your professionalism publicly in the press.',
        'safe',
        'Classy and humble. The manager tells the press you\'re the best professional he has ever managed.',
        { morale: 10, fame: 8, avgRating: 0.06 }),
    ]),
];

// --- Base stat generation ---
// Club prestige tradeoff: at a stacked, star-heavy club you SHARE the goals and
// assists; at a smaller club you're THE man and every chance runs through you.
// This deliberately does NOT touch calcBdoScore's prestige multiplier — it only
// reshapes raw output, so a big move is a genuine risk/reward decision.
function statShareMult(prestige: number): number {
  if (prestige >= 90) return 0.85; // elite squad — spread the load
  if (prestige >= 80) return 0.95;
  if (prestige >= 70) return 1.05;
  return 1.15;                      // talisman effect
}

export function generateBaseStats(
  position: BDPosition, overall: number, inCL: boolean, seed: number,
  clubPrestige?: number,
): BDStats {
  const rng = mulberry32(seed);
  const clMult = inCL ? 1.04 : 1;
  const share = clubPrestige != null ? statShareMult(clubPrestige) : 1.0;
  const ovr = overall;

  // Scaled to OVR: a 63-rated player gets minimal stats, 90+ gets elite stats
  const ovrScaled = Math.max(0, ovr - 60);

  if (position === 'ATT') {
    return {
      goals: clamp(Math.round(ri(rng, ovrScaled * 0.68, 4) * share), 0, 42),
      assists: clamp(Math.round(ri(rng, ovrScaled * 0.20, 2) * share), 0, 16),
      appearances: clamp(ri(rng, 18 + ovrScaled * 0.42, 3), 12, 38),
      avgRating: clamp(gauss(rng, 6.25 + ovrScaled * 0.033, 0.20) * clMult, 6.0, 9.2),
      cleanSheets: 0,
      manOfTheMatch: clamp(ri(rng, ovrScaled * 0.08, 1.5), 0, 10),
    };
  }
  if (position === 'MID') {
    return {
      goals: clamp(Math.round(ri(rng, ovrScaled * 0.28, 3) * share), 0, 20),
      assists: clamp(Math.round(ri(rng, ovrScaled * 0.38, 3) * share), 0, 22),
      appearances: clamp(ri(rng, 18 + ovrScaled * 0.42, 3), 12, 38),
      avgRating: clamp(gauss(rng, 6.28 + ovrScaled * 0.033, 0.20) * clMult, 6.0, 9.2),
      cleanSheets: 0,
      manOfTheMatch: clamp(ri(rng, ovrScaled * 0.07, 1.4), 0, 8),
    };
  }
  if (position === 'DEF') {
    return {
      goals: clamp(Math.round(ri(rng, 0.5 + ovrScaled * 0.04, 1.2) * share), 0, 7),
      assists: clamp(Math.round(ri(rng, 0.5 + ovrScaled * 0.08, 1.5) * share), 0, 9),
      appearances: clamp(ri(rng, 16 + ovrScaled * 0.44, 3), 10, 38),
      avgRating: clamp(gauss(rng, 6.20 + ovrScaled * 0.032, 0.20) * clMult, 6.0, 9.0),
      cleanSheets: clamp(ri(rng, ovrScaled * 0.50, 3), 0, 22),
      manOfTheMatch: clamp(ri(rng, ovrScaled * 0.06, 1.2), 0, 6),
    };
  }
  // GK
  return {
    goals: 0, assists: 0,
    appearances: clamp(ri(rng, 18 + ovrScaled * 0.40, 3), 12, 38),
    avgRating: clamp(gauss(rng, 6.22 + ovrScaled * 0.032, 0.20) * clMult, 6.0, 9.0),
    cleanSheets: clamp(ri(rng, ovrScaled * 0.56, 3), 0, 26),
    manOfTheMatch: clamp(ri(rng, ovrScaled * 0.07, 1.2), 0, 7),
  };
}

function addStats(a: BDStats, b: BDStats): BDStats {
  return {
    goals: Math.max(0, a.goals + b.goals),
    assists: Math.max(0, a.assists + b.assists),
    appearances: Math.max(10, a.appearances + b.appearances),
    avgRating: clamp(Number((a.avgRating + b.avgRating).toFixed(2)), 5.5, 9.9),
    cleanSheets: Math.max(0, a.cleanSheets + b.cleanSheets),
    manOfTheMatch: Math.max(0, a.manOfTheMatch + b.manOfTheMatch),
  };
}

// --- BdO scoring ---
// clubPrestige: when provided (player only), applies a prestige multiplier to raw stat points.
// A player at a lower-prestige club is harder to reward — voters factor in team quality.
export function calcBdoScore(
  stats: BDStats, trophies: BDTrophy[], fame: number,
  position: BDPosition, overall: number,
  clubPrestige?: number,
): number {
  // Prestige mult: Man City (95) → 1.0, Leicester (62) → ~0.68, Southampton (56) → ~0.59
  const prestigeMult = clubPrestige != null
    ? clamp(0.55 + (clubPrestige - 54) / (95 - 54) * 0.45, 0.55, 1.0)
    : 1.0;

  let statScore = 0;
  if (position === 'ATT') statScore += stats.goals * 3.5 + stats.assists * 2;
  else if (position === 'MID') statScore += stats.goals * 3 + stats.assists * 2.8;
  else if (position === 'DEF') statScore += stats.cleanSheets * 5.5 + stats.goals * 2.5 + stats.assists * 1.8;
  else statScore += stats.cleanSheets * 7.5 + stats.manOfTheMatch * 4.5;

  let s = statScore * prestigeMult;
  s += Math.max(0, (stats.avgRating - 7.0)) * 14;
  s += stats.manOfTheMatch * 2.5;
  s += trophies.reduce((sum, t) => sum + t.bdoBonus, 0);
  s += (fame / 100) * 28;
  s += Math.max(0, overall - 82) * 0.6;
  return Math.max(0, s);
}

// --- Rival stat simulation ---
function generateRivalStats(t: RivalTemplate, seed: number): BDStats {
  const rng = mulberry32(seed);
  const ageMult = rivalAgeMult(t.age);
  const variance = t.age > 30 ? 0.4 : 0.28;
  const ovr = t.overall;
  const pos = t.position;
  const eff = ovr * ageMult;
  const ovrS = Math.max(0, eff - 60);

  if (pos === 'ATT') {
    return {
      goals: clamp(ri(rng, ovrS * 0.78, 6), 0, 55),
      assists: clamp(ri(rng, ovrS * 0.22, 3.5), 0, 28),
      appearances: clamp(ri(rng, 18 + ovrS * 0.44, 4), 8, 46),
      avgRating: clamp(gauss(rng, 6.25 + ovrS * 0.034, variance), 5.5, 9.8),
      cleanSheets: 0,
      manOfTheMatch: clamp(ri(rng, ovrS * 0.08, 1.8), 0, 14),
    };
  }
  if (pos === 'MID') {
    return {
      goals: clamp(ri(rng, ovrS * 0.30, 4), 0, 32),
      assists: clamp(ri(rng, ovrS * 0.42, 5), 0, 36),
      appearances: clamp(ri(rng, 18 + ovrS * 0.44, 4), 8, 46),
      avgRating: clamp(gauss(rng, 6.28 + ovrS * 0.034, variance), 5.5, 9.8),
      cleanSheets: 0,
      manOfTheMatch: clamp(ri(rng, ovrS * 0.07, 1.6), 0, 12),
    };
  }
  if (pos === 'DEF') {
    return {
      goals: clamp(ri(rng, 0.5 + ovrS * 0.04, 1.5), 0, 10),
      assists: clamp(ri(rng, 0.5 + ovrS * 0.09, 2), 0, 14),
      appearances: clamp(ri(rng, 16 + ovrS * 0.46, 4), 8, 46),
      avgRating: clamp(gauss(rng, 6.20 + ovrS * 0.034, variance), 5.5, 9.8),
      cleanSheets: clamp(ri(rng, ovrS * 0.55, 4), 0, 32),
      manOfTheMatch: clamp(ri(rng, ovrS * 0.06, 1.3), 0, 10),
    };
  }
  // GK
  return {
    goals: 0, assists: 0,
    appearances: clamp(ri(rng, 18 + ovrS * 0.42, 4), 8, 46),
    avgRating: clamp(gauss(rng, 6.22 + ovrS * 0.034, variance), 5.5, 9.8),
    cleanSheets: clamp(ri(rng, ovrS * 0.60, 4), 0, 36),
    manOfTheMatch: clamp(ri(rng, ovrS * 0.07, 1.4), 0, 12),
  };
}

function generateRivalTrophies(t: RivalTemplate, rng: () => number): BDTrophy[] {
  const p = t.clubPrestige;
  const trophies: BDTrophy[] = [];
  if (rng() < p / 185) trophies.push({ name: leagueNameFor(t.leagueFlag), bdoBonus: 30, emoji: '🏆' });
  if (t.hasCL && rng() < t.clWinOdds) trophies.push({ name: 'Champions League', bdoBonus: 55, emoji: '⭐' });
  if (rng() < p / 310 + 0.04) trophies.push({ name: 'Domestic Cup', bdoBonus: 8, emoji: '🏆' });
  return trophies;
}

// --- Player trophy simulation ---
function simulateTrophies(
  club: BDClub, inCL: boolean, inEL: boolean,
  fitness: number, morale: number, rng: () => number,
  leaguePosition?: number | null,
): BDTrophy[] {
  const perf = clamp((fitness + morale) / 200, 0.7, 1.3);
  const p = club.prestige;
  const trophies: BDTrophy[] = [];
  // If we have a final league table, the title must match it; otherwise fall back to a prestige roll
  const wonLeague = leaguePosition != null ? leaguePosition === 1 : rng() < (p / 200) * perf;
  if (wonLeague) trophies.push({ name: 'Premier League', bdoBonus: 30, emoji: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' });
  if (rng() < (p / 320 + 0.05) * perf) trophies.push({ name: 'FA Cup', bdoBonus: 12, emoji: '🏆' });
  if (rng() < (p / 410 + 0.08) * perf) trophies.push({ name: 'Carabao Cup', bdoBonus: 5, emoji: '🏆' });
  if (inCL && rng() < club.clChance * (p / 360) * perf) trophies.push({ name: 'Champions League', bdoBonus: 55, emoji: '⭐' });
  if (inEL && rng() < (p / 260) * perf) trophies.push({ name: 'Europa League', bdoBonus: 18, emoji: '🏆' });
  return trophies;
}

// A rival contender in the Ballon d'Or field (pool rival or the career rival).
interface RivalContender {
  name: string; club: string; leagueFlag: string; position: BDPosition;
  stats: BDStats; trophies: BDTrophy[]; bdoScore: number; age: number; isRival: boolean;
}

// Builds the full deterministic rival field for a season. Seeds are keyed on the
// season year, so the field is stable across re-renders and matches the eventual
// ceremony — this lets the mid-season race widget project accurately.
function buildRivalContenders(season: BDSeason, careerRival?: BDRival, playerName?: string): RivalContender[] {
  const year = season.year;
  const yearsElapsed = Math.max(0, (season.number ?? 1) - 1);
  const rivals: RivalContender[] = RIVAL_POOL
    .filter(t => !careerRival || t.name !== careerRival.name)
    // A real-player career (e.g. playing AS Mbappé) must not also face the
    // pool's Mbappé — the player would appear twice in the field.
    .filter(t => !playerName || t.name !== playerName)
    .map(t => ({ ...t, age: t.age + yearsElapsed }))
    .filter(t => t.age <= 40)
    .map((t, i) => {
      const ss = generateRivalStats(t, hashSeed(`rival_${t.name}_${year}_${i}`));
      const tr = generateRivalTrophies(t, mulberry32(hashSeed(`rtrophy_${t.name}_${year}`)));
      const baseFame = clamp(t.overall * 0.65 + 10 + (mulberry32(hashSeed(`fame_${t.name}_${year}`))() * 20 - 10), 30, 100);
      const ageFameMult = t.age >= 35 ? 0.8 : t.age >= 32 ? 0.9 : t.age <= 21 ? 0.85 : 1.0;
      const fame = baseFame * ageFameMult;
      return {
        name: t.name, club: t.club, leagueFlag: t.leagueFlag, position: t.position,
        stats: ss, trophies: tr, age: t.age, isRival: false,
        bdoScore: calcBdoScore(ss, tr, fame, t.position, Math.round(t.overall * rivalAgeMult(t.age))),
      };
    });

  // Inject the career rival as a genuine contender: +8% on his simulated output
  // and his own trophies, so he targets a top-5 finish and can win in strong years.
  if (careerRival) {
    const t: RivalTemplate = {
      name: careerRival.name, club: careerRival.club, leagueFlag: careerRival.leagueFlag,
      position: careerRival.position, overall: careerRival.overall, clubPrestige: careerRival.clubPrestige,
      hasCL: careerRival.hasCL, clWinOdds: careerRival.clWinOdds, age: careerRival.age,
    };
    const raw = generateRivalStats(t, hashSeed(`crival_${t.name}_${year}`));
    const boost = 1.08;
    const ss: BDStats = {
      goals: Math.round(raw.goals * boost),
      assists: Math.round(raw.assists * boost),
      appearances: raw.appearances,
      avgRating: clamp(Number((raw.avgRating + 0.15).toFixed(2)), 5.5, 9.9),
      cleanSheets: Math.round(raw.cleanSheets * boost),
      manOfTheMatch: Math.round(raw.manOfTheMatch * boost),
    };
    const tr = generateRivalTrophies(t, mulberry32(hashSeed(`crtrophy_${t.name}_${year}`)));
    const fame = clamp(t.overall * 0.72 + 12, 35, 100);
    rivals.push({
      name: t.name, club: t.club, leagueFlag: t.leagueFlag, position: t.position,
      stats: ss, trophies: tr, age: t.age, isRival: true,
      bdoScore: calcBdoScore(ss, tr, fame, t.position, Math.round(t.overall * rivalAgeMult(t.age))) * 1.05,
    });
  }

  return rivals;
}

// --- Ceremony generation ---
export function generateCeremony(
  player: BDPlayer,
  season: BDSeason,
  combinedStats: BDStats,
  careerRival?: BDRival,
): BDOCeremony {
  const { attributes, trophies, playerOverall } = season;

  // Effective fame boosted by reputation
  const effectiveFame = clamp(attributes.fame + player.reputation * 0.2, 0, 100);

  const rivals = buildRivalContenders(season, careerRival, player.name);

  const playerScore = calcBdoScore(combinedStats, trophies, effectiveFame, player.position, playerOverall, season.club.prestige);

  const all = [
    ...rivals.map(r => ({
      isPlayer: false, name: r.name, club: r.club, leagueFlag: r.leagueFlag,
      position: r.position, stats: r.stats, trophies: r.trophies, bdoScore: r.bdoScore, age: r.age,
    })),
    {
      isPlayer: true, name: player.name, club: season.club.name, leagueFlag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
      position: player.position, stats: combinedStats, trophies, bdoScore: playerScore, age: season.playerAge,
    },
  ].sort((a, b) => b.bdoScore - a.bdoScore);

  const nominees = all.slice(0, 25);
  const playerNomIdx = nominees.findIndex(e => e.isPlayer);
  const playerNominated = playerNomIdx !== -1;
  const playerRank = playerNominated ? playerNomIdx + 1 : 0;

  // Ceremony reveals rank 25 → 1 (index 0 = rank 25, index 24 = rank 1)
  const entries: CeremonyEntry[] = [...nominees].reverse().map((e, revIdx) => ({
    rank: 25 - revIdx,
    isPlayer: e.isPlayer,
    name: e.name,
    club: e.club,
    leagueFlag: e.leagueFlag,
    position: e.position,
    stats: e.stats,
    trophies: e.trophies,
    bdoScore: e.bdoScore,
    age: e.age,
  }));

  return { year: season.year, entries, playerRank, playerNominated };
}

// --- Transfer offer generation ---
export function generateTransferOffers(
  player: BDPlayer, currentClub: BDClub, bdoRank: number, seasonNumber: number,
): TransferOffer[] {
  const seed = hashSeed(`transfers_${player.name}_${seasonNumber}`);
  const rng = mulberry32(seed);

  // Filter clubs better than current
  const betterClubs = PL_CLUBS.filter(c => c.id !== currentClub.id && c.prestige > currentClub.prestige - 5);
  // Shuffle
  for (let i = betterClubs.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [betterClubs[i], betterClubs[j]] = [betterClubs[j], betterClubs[i]];
  }

  // How many offers depend on BdO rank and overall (rank 0 = not nominated, not a top finish)
  const rank = bdoRank >= 1 ? bdoRank : Infinity;
  const offerCount = rank <= 5 ? 3 : rank <= 10 ? 2 : rank <= 20 ? 1 : (player.overall >= 80 ? 1 : 0);
  if (offerCount === 0) return [];

  const reasons: Record<string, string[]> = {
    elite: ['They see you as the final piece in a Champions League-winning squad.', 'Their manager personally requested you. "He\'s the best in the world at what he does."'],
    title: ['They\'re building a title-winning side and you\'re central to that vision.', 'The manager described you as "exactly the profile we need to challenge for trophies."'],
    european: ['A European adventure awaits. They\'re on the rise and want you leading the charge.', 'Ambitious project, exciting manager. They want you to be the face of their rebuild.'],
    mid: ['A team on the rise. They see you as the player to take them to the next level.', '"We\'ll build the team around you." A project where you\'d be the undisputed number one.'],
    lower: ['Guaranteed first-team football. A different challenge — but your decision.', 'They\'ve made it clear: you\'d be their highest-paid player and unquestioned starter.'],
  };

  return betterClubs.slice(0, offerCount).map(club => {
    const tierReasons = reasons[club.tier] ?? reasons.mid;
    const reason = tierReasons[Math.floor(rng() * tierReasons.length)];
    return { clubId: club.id, clubName: club.name, tierLabel: club.tierLabel, prestige: club.prestige, hasCL: club.clChance > 0.3, reason: reason ?? '' };
  });
}

// --- European CL rivals for fixture generation ---
const EUROPEAN_CL_RIVALS = [
  { name: 'Real Madrid', prestige: 98 },
  { name: 'Barcelona', prestige: 91 },
  { name: 'Bayern Munich', prestige: 93 },
  { name: 'PSG', prestige: 92 },
  { name: 'Inter Milan', prestige: 88 },
  { name: 'Borussia Dortmund', prestige: 86 },
  { name: 'Atlético Madrid', prestige: 88 },
  { name: 'AC Milan', prestige: 87 },
];

// --- European EL rivals for Europa League fixture nights ---
const EUROPEAN_EL_RIVALS = [
  { name: 'Roma', prestige: 80 },
  { name: 'Sevilla', prestige: 78 },
  { name: 'Lazio', prestige: 77 },
  { name: 'Eintracht Frankfurt', prestige: 76 },
  { name: 'Porto', prestige: 79 },
  { name: 'Benfica', prestige: 80 },
  { name: 'Ajax', prestige: 78 },
  { name: 'Villarreal', prestige: 77 },
];

// Matchweeks and phases for the 9 season fixtures
const FIXTURE_MWS = [0, 4, 9, 14, 20, 24, 28, 33, 37] as const;
const FIXTURE_PHASES: Array<BDEvent['phase']> = [
  'pre_season', 'first_half', 'first_half', 'first_half',
  'january', 'second_half', 'second_half', 'second_half', 'run_in',
];

interface Fixture {
  opponent: string;
  opponentId: string;
  opponentPrestige: number;
  isHome: boolean;
  matchweek: number;
  competition: NonNullable<BDEvent['matchContext']>['competition'];
  phase: BDEvent['phase'];
}

function generateFixtures(club: BDClub, inCL: boolean, inEL: boolean, seed: number): Fixture[] {
  const rng = mulberry32(seed);
  const others = PL_CLUBS.filter(c => c.id !== club.id);
  for (let i = others.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [others[i], others[j]] = [others[j], others[i]];
  }

  return FIXTURE_MWS.map((mw, idx) => {
    let competition: Fixture['competition'] = 'Premier League';
    if (mw === 0) competition = 'Pre-Season';
    else if (mw === 20) competition = 'FA Cup';
    else if (inCL && (mw === 14 || mw === 28)) competition = 'Champions League';
    else if (inEL && mw === 14) competition = 'Europa League';

    let opponent = others[idx % others.length].name;
    let opponentId = others[idx % others.length].id;
    let opponentPrestige = others[idx % others.length].prestige;

    if (competition === 'Champions League') {
      const eu = EUROPEAN_CL_RIVALS[idx % EUROPEAN_CL_RIVALS.length];
      opponent = eu.name;
      opponentId = `eu_cl_${idx}`;
      opponentPrestige = eu.prestige;
    } else if (competition === 'Europa League') {
      const eu = EUROPEAN_EL_RIVALS[idx % EUROPEAN_EL_RIVALS.length];
      opponent = eu.name;
      opponentId = `eu_el_${idx}`;
      opponentPrestige = eu.prestige;
    }

    return {
      opponent,
      opponentId,
      opponentPrestige,
      isHome: rng() > 0.5,
      matchweek: mw,
      competition,
      phase: FIXTURE_PHASES[idx],
    };
  });
}

function initLeagueTable(clubId: string): LeagueTableRow[] {
  return [...PL_CLUBS]
    .sort((a, b) => b.prestige - a.prestige)
    .map(c => ({
      clubId: c.id,
      name: c.name,
      p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0,
      form: [],
      isPlayer: c.id === clubId,
    }));
}

function selectTeammates(
  clubId: string,
  playerPosition: BDPosition,
  playerName: string,
  seed: number,
): BDTeammate[] {
  const squad = (CLUB_SQUADS[clubId] ?? []).filter(p => p.name !== playerName);
  const rng = mulberry32(seed);

  const roleMap: Record<BDPosition, Array<{ pos: BDPosition; role: string }>> = {
    ATT: [
      { pos: 'MID', role: 'Creative Playmaker' },
      { pos: 'ATT', role: 'Strike Partner' },
      { pos: 'DEF', role: 'Defensive Rock' },
    ],
    MID: [
      { pos: 'ATT', role: 'Forward Partner' },
      { pos: 'MID', role: 'Midfield Partner' },
      { pos: 'DEF', role: 'Defensive Shield' },
    ],
    DEF: [
      { pos: 'MID', role: 'Midfield Screen' },
      { pos: 'DEF', role: 'Defensive Partner' },
      { pos: 'ATT', role: 'Strike Threat' },
    ],
    GK: [
      { pos: 'DEF', role: 'Defensive Leader' },
      { pos: 'MID', role: 'Midfield Engine' },
      { pos: 'ATT', role: 'Strike Threat' },
    ],
  };

  const result: BDTeammate[] = [];
  for (const { pos, role } of roleMap[playerPosition]) {
    const candidates = squad.filter(p => p.pos === pos);
    if (candidates.length === 0) continue;
    const pick = candidates[Math.floor(rng() * candidates.length)];
    result.push({ name: pick.name, position: pick.pos, role, goals: 0, assists: 0, cleanSheets: 0, avgRating: 0, appearances: 0 });
  }
  return result;
}

function buildMatchEvent(fix: Fixture, club: BDClub, rivalClub?: string): BDEvent {
  const mwLabel = fix.matchweek === 0 ? 'Pre-Season Friendly' : `Matchweek ${fix.matchweek}`;
  const title = `${fix.competition} · ${mwLabel}`;
  // Big match: elite opposition, a Champions League run-in night, or facing the
  // career rival's club. Pre-season friendlies never count.
  const isBigMatch = fix.competition !== 'Pre-Season' && (
    fix.opponentPrestige >= 88 ||
    (fix.competition === 'Champions League' && fix.phase === 'run_in') ||
    (!!rivalClub && fix.opponent === rivalClub)
  );
  const homeAwayStr = fix.isHome ? `${fix.opponent} come to the stadium` : `You travel to ${fix.opponent}`;
  const diffStr = fix.opponentPrestige >= 90
    ? 'Elite opposition. A genuine test of where you stand.'
    : fix.opponentPrestige >= 80
    ? 'A tough fixture. Three points here would be massive.'
    : fix.opponentPrestige >= 66
    ? 'The kind of game you need to win if your season is going to mean anything.'
    : 'Three points expected. Don\'t let them make a game of it.';
  const context = `${homeAwayStr}. ${diffStr}`;

  return {
    id: `match_mw${fix.matchweek}`,
    phase: fix.phase,
    category: 'match',
    title,
    context,
    matchContext: {
      opponent: fix.opponent,
      opponentId: fix.opponentId,
      competition: fix.competition,
      isHome: fix.isHome,
      matchweek: fix.matchweek,
      opponentPrestige: fix.opponentPrestige,
      isBigMatch,
    },
    choices: [
      {
        id: 'press',
        label: 'Dominate — press high from the first whistle',
        emoji: '🔥',
        description: 'High intensity. Higher ceiling — a big win is possible — but physically demanding.',
        hint: 'risky',
        outcome: '',
        effects: {},
      },
      {
        id: 'control',
        label: 'Control the game — patient and disciplined',
        emoji: '🎯',
        description: 'Possession-based, composed. Consistent output, lower variance.',
        hint: 'safe',
        outcome: '',
        effects: {},
      },
      {
        id: 'inspire',
        label: 'Lead by example — energy and leadership',
        emoji: '🤝',
        description: 'Work rate and communication. Elevates the whole team. Great for morale.',
        hint: 'team',
        outcome: '',
        effects: {},
      },
    ],
  };
}

function generateMatchResult(
  clubPrestige: number,
  opponentPrestige: number,
  choiceId: string,
  attributes: BDAttributes,
  playerOverall: number,
  position: BDPosition,
  rng: () => number,
): NonNullable<BDEvent['matchResult']> {
  const mods: Record<string, { str: number; variance: number; rat: number }> = {
    press:   { str: 8,  variance: 1.5,  rat: 0.20 },
    control: { str: 2,  variance: 0.75, rat: 0.08 },
    inspire: { str: 5,  variance: 1.0,  rat: 0.05 },
  };
  const mod = mods[choiceId] ?? mods.control;

  const fitBonus    = (attributes.fitness - 70) * 0.06;
  const moraleBonus = (attributes.morale - 70) * 0.04;
  const effectiveStr = clubPrestige + playerOverall * 0.22 + fitBonus + moraleBonus + mod.str;
  const oppStr = opponentPrestige + gauss(rng, 0, 10 * mod.variance);
  const delta = effectiveStr - oppStr;
  const rawWinP = 1 / (1 + Math.exp(-delta / 16));

  const roll = rng();
  const isWin = roll < rawWinP - 0.11;
  const isDraw = !isWin && roll < rawWinP + 0.11;

  let teamGoals: number, opponentGoals: number;
  if (isWin) {
    teamGoals = Math.max(1, ri(rng, 2.2, 0.9 * mod.variance));
    opponentGoals = Math.max(0, ri(rng, 0.7, 0.5));
    if (opponentGoals >= teamGoals) opponentGoals = teamGoals - 1;
  } else if (isDraw) {
    teamGoals = Math.max(0, ri(rng, 1.2, 0.7 * mod.variance));
    opponentGoals = teamGoals;
  } else {
    opponentGoals = Math.max(1, ri(rng, 1.9, 0.8));
    teamGoals = Math.max(0, ri(rng, 0.7, 0.5));
    if (teamGoals >= opponentGoals) teamGoals = opponentGoals - 1;
  }
  teamGoals = clamp(teamGoals, 0, 9);
  opponentGoals = clamp(opponentGoals, 0, 9);

  // Goals/assists computed FIRST so they feed into the rating
  let playerGoals = 0, playerAssists = 0;
  if (teamGoals > 0) {
    if (position === 'ATT') {
      for (let g = 0; g < teamGoals; g++) if (rng() < 0.38) playerGoals++;
      for (let g = 0; g < Math.max(0, teamGoals - playerGoals); g++) if (rng() < 0.20) playerAssists++;
    } else if (position === 'MID') {
      for (let g = 0; g < teamGoals; g++) if (rng() < 0.16) playerGoals++;
      for (let g = 0; g < Math.max(0, teamGoals - playerGoals); g++) if (rng() < 0.30) playerAssists++;
    } else if (position === 'DEF') {
      if (teamGoals >= 2 && rng() < 0.08) playerGoals = 1;
      if (Math.max(0, teamGoals - playerGoals) > 0 && rng() < 0.12) playerAssists = 1;
    }
  }

  const rBase = isWin ? gauss(rng, 7.5, 0.5) : isDraw ? gauss(rng, 7.0, 0.4) : gauss(rng, 6.4, 0.5);
  const gaBonus = playerGoals * 0.30 + playerAssists * 0.18;
  const playerRating = clamp(Number((rBase + mod.rat + (playerOverall - 80) * 0.015 + gaBonus).toFixed(1)), 5.0, 9.9);

  return {
    teamGoals,
    opponentGoals,
    isWin,
    isDraw,
    playerGoals,
    playerAssists,
    playerRating,
    cleanSheet: opponentGoals === 0,
  };
}

function generateMatchOutcome(
  result: NonNullable<BDEvent['matchResult']>,
  club: BDClub,
  ctx: NonNullable<BDEvent['matchContext']>,
  position: BDPosition,
): string {
  const { teamGoals, opponentGoals, isWin, isDraw, playerGoals, playerAssists, playerRating, cleanSheet } = result;
  const home = ctx.isHome ? club.name : ctx.opponent;
  const away = ctx.isHome ? ctx.opponent : club.name;
  const hg = ctx.isHome ? teamGoals : opponentGoals;
  const ag = ctx.isHome ? opponentGoals : teamGoals;
  const score = `${home} ${hg}–${ag} ${away}`;

  const headline = isWin
    ? (teamGoals >= 4 ? 'A demolition.' : teamGoals >= 3 ? 'A commanding win.' : teamGoals - opponentGoals >= 2 ? 'A convincing result.' : 'Three hard-fought points.')
    : isDraw
    ? (teamGoals >= 2 ? 'An entertaining draw.' : 'Honours even.')
    : (opponentGoals - teamGoals >= 3 ? 'A tough evening.' : 'A frustrating defeat.');

  let personal = '';
  if (position === 'GK' || position === 'DEF') {
    personal = cleanSheet
      ? ` Clean sheet — ${playerRating.toFixed(1)} rating.`
      : ` ${playerRating.toFixed(1)} rating.`;
  } else {
    const parts: string[] = [];
    if (playerGoals === 1) parts.push('a goal');
    else if (playerGoals >= 2) parts.push(`${playerGoals} goals`);
    if (playerAssists === 1) parts.push('an assist');
    else if (playerAssists >= 2) parts.push(`${playerAssists} assists`);
    personal = parts.length > 0
      ? ` ${parts.join(' and ')} — ${playerRating.toFixed(1)} rating.`
      : playerRating >= 8.0 ? ` A brilliant personal display — ${playerRating.toFixed(1)} rating.`
      : playerRating <= 6.2 ? ` A tough night personally — ${playerRating.toFixed(1)} rating.`
      : ` ${playerRating.toFixed(1)} rating.`;
  }

  return `${score}. ${headline}${personal}`;
}

const addForm = (f: ('W' | 'D' | 'L')[], r: 'W' | 'D' | 'L') => [...f, r].slice(-5) as ('W' | 'D' | 'L')[];

// Simulate `count` PL games for a club using a prestige-based win probability
function simCatchUpGames(row: LeagueTableRow, count: number, rng: () => number): LeagueTableRow {
  const club = PL_CLUBS.find(c => c.id === row.clubId);
  if (!club || count <= 0) return row;
  let r = { ...row };
  for (let i = 0; i < count; i++) {
    const winP = clamp(0.24 + (club.prestige - 65) / 165, 0.14, 0.52);
    const roll = rng();
    const w = roll < winP ? 1 : 0;
    const d = !w && roll < winP + 0.24 ? 1 : 0;
    const l = !w && !d ? 1 : 0;
    const gf = Math.max(0, ri(rng, w ? 2.0 : d ? 1.1 : 0.6, 0.8));
    const ga = Math.max(0, l ? ri(rng, 2.0, 0.8) : d ? gf : ri(rng, 0.8, 0.6));
    const res: 'W' | 'D' | 'L' = w ? 'W' : d ? 'D' : 'L';
    r = { ...r, p: r.p + 1, w: r.w + w, d: r.d + d, l: r.l + l, gf: r.gf + gf, ga: r.ga + ga, pts: r.pts + (w ? 3 : d ? 1 : 0), form: addForm(r.form, res) };
  }
  return r;
}

// Play out every club's remaining games so the final table reflects a full 38-game season
function completeLeagueTable(table: LeagueTableRow[], rng: () => number): LeagueTableRow[] {
  return table
    .map(row => simCatchUpGames(row, Math.max(0, 38 - row.p), rng))
    .sort((a, b) => (b.pts - a.pts) || ((b.gf - b.ga) - (a.gf - a.ga)) || (b.gf - a.gf));
}

function simulateMatchweekTable(
  table: LeagueTableRow[],
  playerClubId: string,
  result: NonNullable<BDEvent['matchResult']>,
  ctx: NonNullable<BDEvent['matchContext']>,
  rng: () => number,
): LeagueTableRow[] {
  const isPL = ctx.competition === 'Premier League';
  // Approximate how many PL games all clubs should have played by this point in the season.
  // Matchweek 0 = pre-season, so target = matchweek (non-zero for PL/CL/Cup milestones).
  const targetPLGames = Math.max(1, ctx.matchweek);

  const simGames = (row: LeagueTableRow, count: number) => simCatchUpGames(row, count, rng);

  return table.map(row => {
    if (isPL && row.clubId === playerClubId) {
      // Apply the player's actual PL result
      const r: 'W' | 'D' | 'L' = result.isWin ? 'W' : result.isDraw ? 'D' : 'L';
      const pts = result.isWin ? 3 : result.isDraw ? 1 : 0;
      return { ...row, p: row.p + 1, w: row.w + (result.isWin ? 1 : 0), d: row.d + (result.isDraw ? 1 : 0), l: row.l + (!result.isWin && !result.isDraw ? 1 : 0), gf: row.gf + result.teamGoals, ga: row.ga + result.opponentGoals, pts: row.pts + pts, form: addForm(row.form, r) };
    }
    if (isPL && row.clubId === ctx.opponentId) {
      // Apply the opponent's inverse PL result, then catch up
      const oppWin = !result.isWin && !result.isDraw;
      const r: 'W' | 'D' | 'L' = oppWin ? 'W' : result.isDraw ? 'D' : 'L';
      const pts = oppWin ? 3 : result.isDraw ? 1 : 0;
      const updated = { ...row, p: row.p + 1, w: row.w + (oppWin ? 1 : 0), d: row.d + (result.isDraw ? 1 : 0), l: row.l + (result.isWin ? 1 : 0), gf: row.gf + result.opponentGoals, ga: row.ga + result.teamGoals, pts: row.pts + pts, form: addForm(row.form, r) };
      return simGames(updated, Math.max(0, targetPLGames - updated.p));
    }
    // All other clubs (and player's club for non-PL matches):
    // simulate PL games until they've played as many as targetPLGames
    return simGames(row, Math.max(0, targetPLGames - row.p));
  });
}

function updateTeammateStats(
  teammates: BDTeammate[],
  result: NonNullable<BDEvent['matchResult']>,
  rng: () => number,
): BDTeammate[] {
  const { isWin, isDraw, teamGoals, opponentGoals } = result;
  return teammates.map(tm => {
    const baseRat = isWin ? gauss(rng, 7.3, 0.5) : isDraw ? gauss(rng, 6.9, 0.4) : gauss(rng, 6.4, 0.5);
    const tmRat = clamp(baseRat, 5.0, 9.5);
    let tmGoals = 0, tmAssists = 0, tmCS = 0;
    if (teamGoals > 0) {
      if (tm.position === 'ATT') { for (let g = 0; g < teamGoals; g++) if (rng() < 0.28) tmGoals++; }
      else if (tm.position === 'MID') {
        for (let g = 0; g < teamGoals; g++) if (rng() < 0.12) tmGoals++;
        for (let g = 0; g < Math.max(0, teamGoals - tmGoals); g++) if (rng() < 0.25) tmAssists++;
      }
    }
    if ((tm.position === 'DEF' || tm.position === 'GK') && opponentGoals === 0) tmCS = 1;
    const newApps = tm.appearances + 1;
    const newRat = newApps === 1 ? tmRat : clamp(Number(((tm.avgRating * tm.appearances + tmRat) / newApps).toFixed(2)), 5.0, 9.5);
    return { ...tm, goals: tm.goals + tmGoals, assists: tm.assists + tmAssists, cleanSheets: tm.cleanSheets + tmCS, avgRating: newRat, appearances: newApps };
  });
}

// --- Season initialization ---
export function inferArchetype(age: number, overall: number): BDArchetype {
  if (age <= 20) return 'wonderkid';
  if (age <= 24) return 'rising_star';
  if (age <= 30) return 'world_class';
  return 'veteran';
}

export function archetypeDefaults(archetype: BDArchetype): { age: number; overall: number; potential: number } {
  switch (archetype) {
    case 'wonderkid':   return { age: 17, overall: 63, potential: 92 };
    case 'rising_star': return { age: 21, overall: 74, potential: 89 };
    case 'world_class': return { age: 26, overall: 84, potential: 91 };
    case 'veteran':     return { age: 31, overall: 87, potential: 89 };
  }
}

export function initSeason(player: BDPlayer, club: BDClub, seasonNumber: number, rival?: BDRival): BDSeason {
  const year = 2024 + seasonNumber - 1;
  const seed = hashSeed(`season_${player.name}_${seasonNumber}`);
  const rng = mulberry32(seed);

  const inCL = rng() < club.clChance;
  const inEL = !inCL && rng() < club.elChance;

  // Generate fixtures and match events
  const fixtures = generateFixtures(club, inCL, inEL, hashSeed(`fix_${player.name}_${seasonNumber}`));
  const matchEventsByPhase: Partial<Record<BDEvent['phase'], BDEvent[]>> = {};
  for (const fix of fixtures) {
    if (!matchEventsByPhase[fix.phase]) matchEventsByPhase[fix.phase] = [];
    matchEventsByPhase[fix.phase]!.push(buildMatchEvent(fix, club, rival?.club));
  }

  // Sample non-match events from pool per phase
  const usedIds = new Set<string>();
  function samplePhase(phase: BDEvent['phase'], count: number): BDEvent[] {
    const pool = EVENT_POOL.filter(
      e => e.phase === phase && !usedIds.has(e.id) && e.category !== 'match' &&
        (!e.positionFilter || e.positionFilter.includes(player.position)),
    );
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const picked = pool.slice(0, count);
    picked.forEach(e => usedIds.add(e.id));
    return picked.map(e => ({ ...e, choices: e.choices.map(c => ({ ...c })) }));
  }

  // Interleave match and non-match events per phase
  function interleave(phase: BDEvent['phase'], nmCount: number, pattern: ('M' | 'NM')[]): BDEvent[] {
    const nm = samplePhase(phase, nmCount);
    const m = matchEventsByPhase[phase] ?? [];
    const result: BDEvent[] = [];
    let nmi = 0, mi = 0;
    for (const slot of pattern) {
      if (slot === 'NM' && nmi < nm.length) result.push(nm[nmi++]);
      else if (slot === 'M' && mi < m.length) result.push(m[mi++]);
    }
    while (nmi < nm.length) result.push(nm[nmi++]);
    while (mi < m.length) result.push(m[mi++]);
    return result;
  }

  const events: BDEvent[] = [
    ...interleave('pre_season', 2, ['NM', 'NM', 'M']),
    ...interleave('first_half', 4, ['NM', 'M', 'NM', 'M', 'NM', 'M', 'NM']),
    ...interleave('january',    2, ['NM', 'NM', 'M']),
    ...interleave('second_half',4, ['M', 'NM', 'M', 'NM', 'NM', 'M', 'NM']),
    ...interleave('run_in',     2, ['NM', 'M', 'NM']),
  ];

  const leagueTable = initLeagueTable(club.id);
  const teammates = selectTeammates(club.id, player.position, player.name, hashSeed(`team_${player.name}_${seasonNumber}`));

  const baseFame = player.isRealPlayer
    ? clamp(player.overall * 0.72, 35, 98)
    : clamp(15 + (seasonNumber - 1) * 10 + rng() * 8 + player.reputation * 0.3, 8, 95);

  const ageFit = player.archetype === 'veteran' ? -6 : player.archetype === 'wonderkid' ? 5 : 0;
  const attributes: BDAttributes = {
    fitness: Math.round(clamp(70 + rng() * 18 + ageFit, 55, 92)),
    morale: Math.round(clamp(65 + rng() * 22, 55, 92)),
    fame: Math.round(clamp(baseFame, 5, 100)),
  };

  return {
    number: seasonNumber,
    year,
    club,
    playerAge: player.age + (seasonNumber - 1),
    playerOverall: player.overall,
    baseStats: generateBaseStats(player.position, player.overall, inCL, seed + 999, club.prestige),
    eventStats: { goals: 0, assists: 0, appearances: 0, avgRating: 0, cleanSheets: 0, manOfTheMatch: 0 },
    trophies: [],
    attributes,
    events,
    phase: 'pre_season',
    inCL,
    inEL,
    leagueTable,
    teammates,
    matchweek: 0,
    money: 50,
    energy: 85,
  };
}

// --- Apply event choice ---
export function applyChoice(season: BDSeason, eventId: string, choiceId: string, playerPosition: BDPosition): BDSeason {
  const evIdx = season.events.findIndex(e => e.id === eventId);
  if (evIdx === -1) return season;
  const ev = season.events[evIdx];
  const choice = ev.choices.find(c => c.id === choiceId);
  if (!choice) return season;

  let es = { ...season.eventStats };
  let attrs = { ...season.attributes };
  let leagueTable = season.leagueTable;
  let teammates = season.teammates;
  let matchResult: BDEvent['matchResult'];
  let outcomeText = choice.outcome;
  let updatedOverall = season.playerOverall;
  let matchweek = season.matchweek;
  let money = season.money ?? 50;
  let energy = season.energy ?? 85;

  if (ev.category === 'match' && ev.matchContext) {
    const matchSeed = hashSeed(`mr_${eventId}_${choiceId}_${season.year}`);
    const matchRng = mulberry32(matchSeed);

    const result = generateMatchResult(
      season.club.prestige,
      ev.matchContext.opponentPrestige,
      choiceId,
      attrs,
      season.playerOverall,
      playerPosition,
      matchRng,
    );

    matchResult = result;
    outcomeText = generateMatchOutcome(result, season.club, ev.matchContext, playerPosition);

    // Apply match stats
    es.goals += result.playerGoals;
    es.assists += result.playerAssists;
    es.appearances += 1;
    if (result.cleanSheet && (playerPosition === 'GK' || playerPosition === 'DEF')) es.cleanSheets += 1;
    if (result.playerRating >= 8.5) es.manOfTheMatch += 1;
    const ratingShift = (result.playerRating - 7.2) * 0.055;
    es.avgRating = Number((es.avgRating + ratingShift).toFixed(2));

    // Fitness/energy cost, morale from result
    const fitCost = choiceId === 'press' ? 5 : choiceId === 'inspire' ? 3 : 2;
    attrs.fitness = clamp(attrs.fitness - fitCost, 0, 100);
    energy = clamp(energy - 10, 0, 100);
    const moraleDelta = result.isWin ? Math.min(8, 3 + result.teamGoals) : result.isDraw ? 1 : -5;
    attrs.morale = clamp(attrs.morale + moraleDelta, 0, 100);
    // Match salary: appearance fee + win bonus
    money += 15 + (result.isWin ? 30 : result.isDraw ? 8 : 0);

    matchweek = ev.matchContext.matchweek;

    if (leagueTable) {
      leagueTable = simulateMatchweekTable(
        leagueTable, season.club.id, result, ev.matchContext,
        mulberry32(hashSeed(`tbl_${eventId}_${season.year}`)),
      );
    }
    if (teammates) {
      teammates = updateTeammateStats(
        teammates, result,
        mulberry32(hashSeed(`tm_${eventId}_${season.year}`)),
      );
    }
  } else {
    // Non-match event effects
    const fx = choice.effects;
    if (fx.goals != null) es.goals += fx.goals;
    if (fx.assists != null) es.assists += fx.assists;
    if (fx.cleanSheets != null) es.cleanSheets += fx.cleanSheets;
    if (fx.manOfTheMatch != null) es.manOfTheMatch += fx.manOfTheMatch;
    if (fx.avgRating != null) es.avgRating = Number((es.avgRating + fx.avgRating).toFixed(2));
    if (fx.appearances != null) es.appearances += fx.appearances;
    if (fx.fitness != null) attrs.fitness = clamp(attrs.fitness + fx.fitness, 0, 100);
    if (fx.morale != null) attrs.morale = clamp(attrs.morale + fx.morale, 0, 100);
    if (fx.fame != null) attrs.fame = clamp(attrs.fame + fx.fame, 0, 100);
    if (fx.overall != null) updatedOverall = season.playerOverall + fx.overall;
    if (fx.money != null) money += fx.money;
    if (fx.energy != null) energy = clamp(energy + fx.energy, 0, 100);
    energy = clamp(energy - 5, 0, 100);
    money += 15; // event salary
  }

  const newEvents = season.events.map((e, i) =>
    i === evIdx ? { ...e, chosenId: choiceId, outcomeText, matchResult } : e,
  );

  const phaseOrder: Array<BDSeason['phase']> = ['pre_season', 'first_half', 'january', 'second_half', 'run_in'];
  const curPhaseIdx = phaseOrder.indexOf(season.phase as typeof phaseOrder[number]);
  const phaseEvents = newEvents.filter(e => e.phase === season.phase);
  const phaseDone = phaseEvents.every(e => e.chosenId);
  let newPhase: BDSeason['phase'] = season.phase;
  if (phaseDone && curPhaseIdx >= 0 && curPhaseIdx < phaseOrder.length - 1) {
    newPhase = phaseOrder[curPhaseIdx + 1];
  }

  return { ...season, playerOverall: updatedOverall, events: newEvents, eventStats: es, attributes: attrs, phase: newPhase, leagueTable, teammates, matchweek, money, energy };
}

// --- Apply interactive match result (from MatchGame mini-game) ---
export function applyManualMatchResult(
  season: BDSeason,
  eventId: string,
  result: NonNullable<BDEvent['matchResult']> & { fameBonus?: number },
  playerPosition: BDPosition,
): BDSeason {
  const evIdx = season.events.findIndex(e => e.id === eventId);
  if (evIdx === -1) return season;
  const ev = season.events[evIdx];
  if (!ev.matchContext) return season;

  let es = { ...season.eventStats };
  let attrs = { ...season.attributes };
  let leagueTable = season.leagueTable;
  let teammates = season.teammates;
  let money = season.money ?? 50;
  let energy = season.energy ?? 85;
  let matchweek = season.matchweek;

  const outcomeText = generateMatchOutcome(result, season.club, ev.matchContext, playerPosition);

  es.goals += result.playerGoals;
  es.assists += result.playerAssists;
  es.appearances += 1;
  if (result.cleanSheet && (playerPosition === 'GK' || playerPosition === 'DEF')) es.cleanSheets += 1;
  if (result.playerRating >= 8.5) es.manOfTheMatch += 1;
  const ratingShift = (result.playerRating - 7.2) * 0.055;
  es.avgRating = Number((es.avgRating + ratingShift).toFixed(2));

  attrs.fitness = clamp(attrs.fitness - 4, 0, 100);
  energy = clamp(energy - 15, 0, 100);
  const moraleDelta = result.isWin ? Math.min(8, 3 + result.teamGoals) : result.isDraw ? 1 : -5;
  attrs.morale = clamp(attrs.morale + moraleDelta, 0, 100);
  // Big-match fame bonus, awarded by the interactive match on a win/goal
  if (result.fameBonus) attrs.fame = clamp(attrs.fame + result.fameBonus, 0, 100);
  money += 15 + (result.isWin ? 30 : result.isDraw ? 8 : 0);

  matchweek = ev.matchContext.matchweek;

  if (leagueTable) {
    leagueTable = simulateMatchweekTable(
      leagueTable, season.club.id, result, ev.matchContext,
      mulberry32(hashSeed(`tbl_${eventId}_${season.year}`)),
    );
  }
  if (teammates) {
    teammates = updateTeammateStats(
      teammates, result,
      mulberry32(hashSeed(`tm_${eventId}_${season.year}`)),
    );
  }

  const newEvents = season.events.map((e, i) =>
    i === evIdx ? { ...e, chosenId: 'play', outcomeText, matchResult: result } : e,
  );

  const phaseOrder: Array<BDSeason['phase']> = ['pre_season', 'first_half', 'january', 'second_half', 'run_in'];
  const curPhaseIdx = phaseOrder.indexOf(season.phase as typeof phaseOrder[number]);
  const phaseEvents = newEvents.filter(e => e.phase === season.phase);
  const phaseDone = phaseEvents.every(e => e.chosenId);
  let newPhase: BDSeason['phase'] = season.phase;
  if (phaseDone && curPhaseIdx >= 0 && curPhaseIdx < phaseOrder.length - 1) {
    newPhase = phaseOrder[curPhaseIdx + 1];
  }

  return { ...season, events: newEvents, eventStats: es, attributes: attrs, phase: newPhase, leagueTable, teammates, matchweek, money, energy };
}

// --- Finalize season ---
export function finalizeSeason(player: BDPlayer, season: BDSeason, rival?: BDRival): BDSeason {
  const rng = mulberry32(hashSeed(`trophies_${player.name}_${season.year}`));

  // Attribute multiplier: fitness affects appearances, morale affects rating
  const fitMult = clamp(season.attributes.fitness / 80, 0.7, 1.2);
  const moraleMult = clamp(season.attributes.morale / 80, 0.8, 1.1);

  // Complete the league table to 38 games so the final standings (and title) are consistent
  // with what the player watched all season
  const finalTable = season.leagueTable ? completeLeagueTable(season.leagueTable, rng) : undefined;
  const leaguePosition = finalTable
    ? finalTable.findIndex(r => r.clubId === season.club.id) + 1
    : null;

  const rawTrophies = simulateTrophies(
    season.club, season.inCL, season.inEL,
    season.attributes.fitness, season.attributes.morale, rng,
    leaguePosition || null,
  );

  // Apply attribute effects to base stats
  const adjustedBase: typeof season.baseStats = {
    ...season.baseStats,
    appearances: Math.round(clamp(season.baseStats.appearances * fitMult, 8, 38)),
    avgRating: clamp(Number((season.baseStats.avgRating * moraleMult).toFixed(2)), 5.5, 9.9),
    goals: Math.round(season.baseStats.goals * Math.min(fitMult, moraleMult)),
    assists: Math.round(season.baseStats.assists * Math.min(fitMult, moraleMult)),
    cleanSheets: Math.round(season.baseStats.cleanSheets * fitMult),
  };

  const combined = addStats(adjustedBase, season.eventStats);
  const ceremony = generateCeremony(player, { ...season, trophies: rawTrophies }, combined, rival);

  // Generate transfer offers for between-season screen
  const transferOffers = generateTransferOffers(player, season.club, ceremony.playerRank, season.number);

  return { ...season, trophies: rawTrophies, phase: 'ceremony', ceremony, transferOffers, leagueTable: finalTable ?? season.leagueTable };
}

// --- Player development ---
export function developPlayer(player: BDPlayer, season: BDSeason): BDPlayer {
  const seed = hashSeed(`dev_${player.name}_${season.year}`);
  const rng = mulberry32(seed);
  const age = player.age + 1;
  const gap = player.potential - player.overall;

  let delta = 0;
  switch (player.archetype) {
    case 'wonderkid':
      if (age < 20) delta = Math.round(gap * 0.40 + rng() * 3);
      else if (age < 23) delta = Math.round(gap * 0.28 + rng() * 1.5);
      else if (age < 26) delta = Math.round(gap * 0.12 + rng());
      else if (age < 30) delta = 0;
      else if (age < 33) delta = -1;
      else delta = -2;
      break;
    case 'rising_star':
      if (age < 24) delta = Math.round(gap * 0.25 + rng() * 1.5);
      else if (age < 27) delta = Math.round(gap * 0.10);
      else if (age < 30) delta = 0;
      else if (age < 33) delta = -1;
      else delta = -2;
      break;
    case 'world_class':
      if (age < 28) delta = Math.round(gap * 0.05);
      else if (age < 31) delta = 0;
      else if (age < 34) delta = -1;
      else delta = -2;
      break;
    case 'veteran':
      if (age < 32) delta = 0;
      else if (age < 34) delta = -1;
      else if (age < 36) delta = -2;
      else delta = -3;
      break;
  }

  const newOvr = clamp(player.overall + delta, 40, 99);
  // Reputation grows with good performances and BdO finishes
  // playerRank 0 means the player missed the shortlist entirely — no rep gain
  const rawRank = season.ceremony?.playerRank ?? 0;
  const bdoRank = rawRank >= 1 ? rawRank : Infinity;
  const repGain = bdoRank === 1 ? 15 : bdoRank <= 3 ? 10 : bdoRank <= 10 ? 6 : bdoRank <= 25 ? 3 : 0;
  const newRep = clamp(player.reputation + repGain, 0, 100);

  return { ...player, age, overall: newOvr, reputation: newRep };
}

// ── Career rival ─────────────────────────────────────────────────────
// Generate a career-long rival at career creation: same position, a comparable
// age, and a real name pulled from the rival pool (never the player's own name).
export function generateCareerRival(player: BDPlayer): BDRival {
  const rng = mulberry32(hashSeed(`careerrival_${player.name}_${player.position}`));
  // Prefer same-position, high-overall templates; fall back to any if none.
  const samePos = RIVAL_POOL.filter(t => t.position === player.position && t.name !== player.name);
  const pool = (samePos.length > 0 ? samePos : RIVAL_POOL.filter(t => t.name !== player.name))
    .slice()
    .sort((a, b) => b.overall - a.overall);
  // Pick from the strongest handful so he's a genuine contender.
  const topN = pool.slice(0, Math.min(6, pool.length));
  const t = topN[Math.floor(rng() * topN.length)] ?? pool[0] ?? RIVAL_POOL[0];

  const age = clamp(player.age + (rng() < 0.5 ? -1 : 1), 18, 30);
  return {
    name: t.name,
    position: t.position,
    age,
    overall: t.overall,
    club: t.club,
    leagueFlag: t.leagueFlag,
    clubPrestige: t.clubPrestige,
    hasCL: t.hasCL,
    clWinOdds: t.clWinOdds,
    lastBdoRank: 0,
  };
}

// Age the rival one year per season, with a mild overall decline from 31.
export function ageRival(rival: BDRival): BDRival {
  const age = rival.age + 1;
  let overall = rival.overall;
  if (age >= 34) overall -= 2;
  else if (age >= 31) overall -= 1;
  return { ...rival, age, overall: clamp(overall, 60, 99) };
}

// ── Mid-season BdO race projection ───────────────────────────────────
export interface BdoRaceEntry {
  name: string;
  club: string;
  leagueFlag: string;
  isPlayer: boolean;
  isRival: boolean;
  score: number;
}

export interface BdoRaceProjection {
  top5: BdoRaceEntry[];
  playerRank: number;
  playerScore: number;
  playerEntry: BdoRaceEntry;
  gapToLeader: number;
  leaderName: string;
}

// Projects the current Ballon d'Or standings mid-season. The player's part-season
// event output is pro-rated to a full season; the rival field is the same
// deterministic field the ceremony will use, so the projection is stable.
export function projectBdoRace(
  season: BDSeason, player: BDPlayer, careerRival?: BDRival,
): BdoRaceProjection {
  const totalEvents = season.events.length || 1;
  const done = season.events.filter(e => e.chosenId).length;
  const frac = clamp(done / totalEvents, 0.2, 1);

  // Scale accumulated event stats up to a full-season projection.
  const es = season.eventStats;
  const scaledEvent: BDStats = {
    goals: Math.round(es.goals / frac),
    assists: Math.round(es.assists / frac),
    appearances: Math.round(es.appearances / frac),
    avgRating: es.avgRating,
    cleanSheets: Math.round(es.cleanSheets / frac),
    manOfTheMatch: Math.round(es.manOfTheMatch / frac),
  };
  const projStats = addStats(season.baseStats, scaledEvent);
  const effectiveFame = clamp(season.attributes.fame + player.reputation * 0.2, 0, 100);
  const playerScore = calcBdoScore(
    projStats, season.trophies, effectiveFame, player.position, season.playerOverall, season.club.prestige,
  );

  const rivals = buildRivalContenders(season, careerRival, player.name);
  const all: BdoRaceEntry[] = [
    ...rivals.map(r => ({
      name: r.name, club: r.club, leagueFlag: r.leagueFlag,
      isPlayer: false, isRival: r.isRival, score: r.bdoScore,
    })),
    {
      name: player.name, club: season.club.name, leagueFlag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
      isPlayer: true, isRival: false, score: playerScore,
    },
  ].sort((a, b) => b.score - a.score);

  const playerRank = all.findIndex(e => e.isPlayer) + 1;
  const playerEntry = all[playerRank - 1];
  const leader = all[0];

  return {
    top5: all.slice(0, 5),
    playerRank,
    playerScore,
    playerEntry,
    gapToLeader: Math.max(0, Math.round(leader.score - playerScore)),
    leaderName: leader.name,
  };
}

// ── Legacy / retirement ──────────────────────────────────────────────
const LEGACY_TIERS: { tier: LegacyTier; min: number; color: string; blurb: string }[] = [
  { tier: 'GOAT',        min: 4000, color: '#fbbf24', blurb: 'The Greatest Of All Time. An untouchable career.' },
  { tier: 'Legend',      min: 2500, color: '#f59e0b', blurb: 'A bona fide legend of the game.' },
  { tier: 'Icon',        min: 1350, color: '#a78bfa', blurb: 'An icon — remembered for generations.' },
  { tier: 'World Class', min: 750,  color: '#60a5fa', blurb: 'A genuinely world-class career.' },
  { tier: 'Cult Hero',   min: 350,  color: '#34d399', blurb: 'A cult hero the fans adored.' },
  { tier: 'Journeyman',  min: 0,    color: '#9ca3af', blurb: 'A solid professional journeyman.' },
];

export function legacyTierMeta(tier: LegacyTier): { color: string; blurb: string } {
  const m = LEGACY_TIERS.find(t => t.tier === tier) ?? LEGACY_TIERS[LEGACY_TIERS.length - 1];
  return { color: m.color, blurb: m.blurb };
}

function legacyTierFromScore(score: number): LegacyTier {
  return (LEGACY_TIERS.find(t => score >= t.min) ?? LEGACY_TIERS[LEGACY_TIERS.length - 1]).tier;
}

// Aggregate a completed career into a Legacy score + tier + recap totals.
export function computeLegacy(career: BDCareer): BDLegacy {
  const seasons = career.seasons;
  const pos = career.player.position;

  let totalGoals = 0, totalAssists = 0, totalCleanSheets = 0;
  let peakOverall = career.player.overall;
  let bdoWins = 0, podiums = 0, topTens = 0;
  const bdoWinYears: number[] = [];
  const clubs: string[] = [];
  const trophyCounts = new Map<string, { count: number; emoji: string; bdoBonus: number }>();

  let best: BDLegacy['bestSeason'];
  let bestScore = -1;

  for (const s of seasons) {
    const g = s.baseStats.goals + s.eventStats.goals;
    const a = s.baseStats.assists + s.eventStats.assists;
    const cs = s.baseStats.cleanSheets + s.eventStats.cleanSheets;
    const rating = Number((s.baseStats.avgRating + s.eventStats.avgRating).toFixed(1));
    totalGoals += g;
    totalAssists += a;
    totalCleanSheets += cs;
    peakOverall = Math.max(peakOverall, s.playerOverall);
    if (!clubs.includes(s.club.name)) clubs.push(s.club.name);

    for (const t of s.trophies) {
      const prev = trophyCounts.get(t.name);
      if (prev) prev.count += 1;
      else trophyCounts.set(t.name, { count: 1, emoji: t.emoji, bdoBonus: t.bdoBonus });
    }

    const rank = s.ceremony?.playerRank ?? 0;
    if (rank === 1) { bdoWins += 1; bdoWinYears.push(s.year); }
    else if (rank === 2 || rank === 3) podiums += 1;
    else if (rank >= 4 && rank <= 10) topTens += 1;

    // Best season = highest single-season BdO score (fall back to raw output).
    const seasonScore = (rank >= 1 ? (26 - rank) * 40 : 0) + g * 4 + a * 3 + cs * 3 + s.trophies.length * 20;
    if (seasonScore > bestScore) {
      bestScore = seasonScore;
      best = { number: s.number, year: s.year, club: s.club.name, goals: g, assists: a, cleanSheets: cs, rating, bdoRank: rank };
    }
  }

  // Trophy points by type.
  let trophyScore = 0;
  const trophies: BDTrophy[] = [];
  for (const [name, info] of Array.from(trophyCounts.entries())) {
    const per = name.includes('Champions League') ? 120
      : (name.includes('Premier League') || name === 'La Liga' || name === 'Bundesliga' || name === 'Serie A' || name === 'Ligue 1' || name.includes('League Title')) ? 80
      : 25;
    trophyScore += per * info.count;
    trophies.push({ name: info.count > 1 ? `${name} ×${info.count}` : name, emoji: info.emoji, bdoBonus: info.bdoBonus });
  }

  const goalPts = pos === 'GK' || pos === 'DEF'
    ? totalCleanSheets * 2 + totalGoals * 1.5 + totalAssists * 1.2
    : totalGoals * 1.5 + totalAssists * 1.2;

  const score = Math.round(
    bdoWins * 500 +
    podiums * 150 +
    topTens * 40 +
    trophyScore +
    goalPts +
    seasons.length * 10 +
    Math.max(0, peakOverall - 80) * 5,
  );

  return {
    score,
    tier: legacyTierFromScore(score),
    seasonsPlayed: seasons.length,
    bdoWins,
    bdoWinYears,
    podiums,
    topTens,
    trophies,
    totalGoals,
    totalAssists,
    totalCleanSheets,
    peakOverall,
    clubs,
    bestSeason: best,
  };
}
