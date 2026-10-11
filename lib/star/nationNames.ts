/**
 * Made-up footballers' names that sound roughly like the nation they play
 * for — for the gaps in a national squad the save has no real players to fill
 * (an opposing nation at a World Cup, say). Typical-ish, not exhaustive: a
 * handful of first names and surnames per language group, picked seeded so a
 * nation always gets the same men.
 */
import { mulberry32 } from "./season";
import { clubNameSeed, FIRST_NAMES, LAST_NAMES } from "./squadData";

interface NamePool { first: string[]; last: string[] }

const POOLS: Record<string, NamePool> = {
  english: {
    first: ["Jack", "Harry", "Tom", "James", "Oliver", "Callum", "Ben", "Luke", "Jordan", "Mason", "Declan", "Reece"],
    last: ["Walker", "Taylor", "Hughes", "Clarke", "Wright", "Robinson", "Thompson", "Bennett", "Marshall", "Fletcher", "Barnes", "Holmes"],
  },
  spanish: {
    first: ["Pablo", "Sergio", "Diego", "Álvaro", "Javier", "Carlos", "Mateo", "Rodrigo", "Iker", "Santiago", "Nicolás", "Martín"],
    last: ["García", "Fernández", "López", "Martínez", "Sánchez", "Pérez", "Gómez", "Ruiz", "Morales", "Navarro", "Herrera", "Castro"],
  },
  portuguese: {
    first: ["João", "Pedro", "Rafael", "Gonçalo", "Diogo", "Lucas", "Gabriel", "Thiago", "Bruno", "Vinícius", "Matheus", "Rúben"],
    last: ["Silva", "Santos", "Costa", "Pereira", "Oliveira", "Souza", "Ferreira", "Almeida", "Carvalho", "Ribeiro", "Lima", "Gomes"],
  },
  french: {
    first: ["Antoine", "Lucas", "Théo", "Hugo", "Kylian", "Maxime", "Jules", "Mathis", "Adrien", "Yanis", "Bastien", "Louis"],
    last: ["Martin", "Bernard", "Dubois", "Moreau", "Laurent", "Girard", "Lefèvre", "Fontaine", "Rousseau", "Mercier", "Blanc", "Garnier"],
  },
  german: {
    first: ["Lukas", "Leon", "Jonas", "Florian", "Niklas", "Felix", "Kai", "Timo", "Joshua", "Maximilian", "Julian", "Leroy"],
    last: ["Müller", "Schmidt", "Schneider", "Fischer", "Weber", "Wagner", "Becker", "Hoffmann", "Koch", "Richter", "Klein", "Neuer"],
  },
  italian: {
    first: ["Marco", "Lorenzo", "Federico", "Alessandro", "Nicolò", "Matteo", "Davide", "Giacomo", "Andrea", "Riccardo", "Gianluca", "Sandro"],
    last: ["Rossi", "Russo", "Ferrari", "Esposito", "Bianchi", "Romano", "Colombo", "Ricci", "Marino", "Greco", "Bruno", "Conti"],
  },
  dutch: {
    first: ["Daan", "Jesse", "Bram", "Sem", "Luuk", "Thijs", "Ruben", "Stefan", "Joey", "Teun", "Jurriën", "Cody"],
    last: ["de Jong", "Jansen", "de Vries", "van Dijk", "Bakker", "Visser", "Smit", "Meijer", "de Boer", "Mulder", "van der Berg", "Bos"],
  },
  nordic: {
    first: ["Mikkel", "Rasmus", "Kasper", "Erik", "Lars", "Oscar", "Viktor", "Emil", "Andreas", "Jonas", "Sander", "Gustav"],
    last: ["Hansen", "Nielsen", "Larsen", "Andersen", "Johansson", "Eriksson", "Olsen", "Lindqvist", "Berg", "Pedersen", "Sørensen", "Nyström"],
  },
  slavic: {
    first: ["Luka", "Marko", "Ivan", "Dušan", "Jakub", "Mateusz", "Tomáš", "Andriy", "Filip", "Mykola", "Petar", "Nikola"],
    last: ["Petrović", "Kovač", "Nowak", "Horvat", "Novák", "Jovanović", "Kowalski", "Shevchenko", "Marić", "Dvořák", "Zieliński", "Babić"],
  },
  arabic: {
    first: ["Youssef", "Achraf", "Hakim", "Mohamed", "Ahmed", "Karim", "Riyad", "Omar", "Salem", "Ismael", "Hamza", "Bilal"],
    last: ["El Amrani", "Benali", "Hassan", "Mansour", "Bensaïd", "Mahrez", "Ziani", "Al Dawsari", "Saleh", "Haddad", "Bouzid", "Nasser"],
  },
  westAfrican: {
    first: ["Samuel", "Victor", "Wilfried", "Sadio", "Ismaïla", "Kalidou", "Emmanuel", "Moses", "Thomas", "Idrissa", "Franck", "Joel"],
    last: ["Osimhen", "Mensah", "Diallo", "Koné", "Traoré", "Sarr", "Mendy", "Okafor", "Adeyemi", "Bamba", "Gueye", "Owusu"],
  },
  japanese: {
    first: ["Takumi", "Kaoru", "Wataru", "Daichi", "Ritsu", "Junya", "Takefusa", "Ko", "Hiroki", "Shuichi", "Ayase", "Yuto"],
    last: ["Tanaka", "Suzuki", "Endo", "Kamada", "Doan", "Ito", "Minamino", "Mitoma", "Itakura", "Nakamura", "Ueda", "Sato"],
  },
  korean: {
    first: ["Min-jae", "Heung-min", "Kang-in", "Hee-chan", "Woo-young", "Jae-sung", "Gue-sung", "Seung-ho", "Hyun-woo", "Ji-sung", "Young-gwon", "Tae-hwan"],
    last: ["Kim", "Lee", "Park", "Son", "Hwang", "Cho", "Jung", "Kang", "Paik", "Seol", "Hong", "Oh"],
  },
  turkish: {
    first: ["Arda", "Kerem", "Hakan", "Mert", "Ferdi", "Kaan", "Barış", "Cenk", "Orkun", "Salih", "Yusuf", "Emre"],
    last: ["Yılmaz", "Kaya", "Demir", "Çelik", "Şahin", "Aydın", "Öztürk", "Arslan", "Doğan", "Kılıç", "Kökçü", "Ayhan"],
  },
  greek: {
    first: ["Giorgos", "Kostas", "Dimitris", "Nikos", "Vangelis", "Anastasios", "Christos", "Petros", "Fotis", "Manolis", "Tasos", "Lazaros"],
    last: ["Papadopoulos", "Pavlidis", "Mavropanos", "Bakasetas", "Tsimikas", "Giakoumakis", "Masouras", "Mantalos", "Vlachodimos", "Siopis", "Kourbelis", "Zeca"],
  },
  hungarian: {
    first: ["Dominik", "Roland", "Ádám", "Péter", "Barnabás", "Milos", "Attila", "Zsolt", "Bendegúz", "Martin", "Dániel", "Loïc"],
    last: ["Szoboszlai", "Sallai", "Nagy", "Gulácsi", "Szalai", "Kerkez", "Varga", "Kovács", "Tóth", "Fiola", "Orbán", "Nego"],
  },
  romanian: {
    first: ["Ianis", "Andrei", "Răzvan", "Nicolae", "Florin", "Radu", "Valentin", "Denis", "Ionuț", "Alexandru", "Dennis", "Darius"],
    last: ["Popescu", "Ionescu", "Stanciu", "Drăgușin", "Man", "Marin", "Mihăilă", "Rațiu", "Hagi", "Niță", "Coman", "Olaru"],
  },
  celtic: {
    first: ["Callum", "Scott", "Andy", "Kieran", "John", "Ryan", "Seamus", "Conor", "Shane", "Gavin", "Liam", "Ewan"],
    last: ["McGregor", "Robertson", "McTominay", "Tierney", "Gilmour", "O'Brien", "Doherty", "Duffy", "Kelly", "Ferguson", "Ramsey", "Davies"],
  },
};

const GROUP_OF: Record<string, keyof typeof POOLS> = {
  England: "english", USA: "english", "United States": "english", Canada: "english", Australia: "english",
  "New Zealand": "english", Jamaica: "english",
  Scotland: "celtic", Wales: "celtic", "Republic of Ireland": "celtic", Ireland: "celtic", "Northern Ireland": "celtic",
  Spain: "spanish", Argentina: "spanish", Uruguay: "spanish", Colombia: "spanish", Mexico: "spanish", Chile: "spanish",
  Peru: "spanish", Paraguay: "spanish", Ecuador: "spanish", "Costa Rica": "spanish",
  Portugal: "portuguese", Brazil: "portuguese",
  France: "french", Belgium: "french", Switzerland: "german", Cameroon: "french",
  Germany: "german", Austria: "german",
  Italy: "italian",
  Netherlands: "dutch",
  Denmark: "nordic", Norway: "nordic", Sweden: "nordic", Iceland: "nordic", Finland: "nordic",
  Croatia: "slavic", Serbia: "slavic", Poland: "slavic", Czechia: "slavic", "Czech Republic": "slavic",
  Slovakia: "slavic", Slovenia: "slavic", Ukraine: "slavic", "Bosnia and Herzegovina": "slavic", Albania: "slavic",
  Georgia: "slavic",
  Morocco: "arabic", Egypt: "arabic", Algeria: "arabic", Tunisia: "arabic", "Saudi Arabia": "arabic", Qatar: "arabic",
  Iran: "arabic",
  Senegal: "westAfrican", Nigeria: "westAfrican", Ghana: "westAfrican", "Cote d'Ivoire": "westAfrican", "Ivory Coast": "westAfrican",
  Japan: "japanese", "Korea Republic": "korean",
  "Türkiye": "turkish", Turkey: "turkish",
  Greece: "greek", Hungary: "hungarian", Romania: "romanian",
};

/** The name pool a nation draws its made-up players from. */
export function namePoolFor(nation: string): NamePool {
  const g = GROUP_OF[nation];
  return g ? POOLS[g] : { first: FIRST_NAMES, last: LAST_NAMES };
}

/**
 * `count` distinct made-up names for `nation`, the same every time for the
 * same nation (seeded off its name).
 */
export function madeUpNames(nation: string, count: number): string[] {
  const pool = namePoolFor(nation);
  const rng = mulberry32(clubNameSeed(`names|${nation}`));
  const used = new Set<string>();
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    let name = "";
    for (let tries = 0; tries < 50 && (!name || used.has(name)); tries++) {
      name = `${pool.first[Math.floor(rng() * pool.first.length)]} ${pool.last[Math.floor(rng() * pool.last.length)]}`;
    }
    if (used.has(name)) name = `${name} ${i + 1}`;
    used.add(name);
    out.push(name);
  }
  return out;
}
