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
    last: ["Walker", "Taylor", "Hughes", "Clarke", "Wright", "Robinson", "Thompson", "Bennett", "Marshall", "Fletcher", "Barnes", "Holmes",
      "Parker", "Cooper", "Lewis", "Turner", "Harris", "King", "Ward", "Hall", "Cole", "Mitchell", "Price", "Webb"],
  },
  spanish: {
    first: ["Pablo", "Sergio", "Diego", "Álvaro", "Javier", "Carlos", "Mateo", "Rodrigo", "Iker", "Santiago", "Nicolás", "Martín"],
    last: ["García", "Fernández", "López", "Martínez", "Sánchez", "Pérez", "Gómez", "Ruiz", "Morales", "Navarro", "Herrera", "Castro",
      "Torres", "Romero", "Díaz", "Vargas", "Ortiz", "Molina", "Delgado", "Suárez", "Ramos", "Rojas", "Mendoza", "Silva"],
  },
  portuguese: {
    first: ["João", "Pedro", "Rafael", "Gonçalo", "Diogo", "Lucas", "Gabriel", "Thiago", "Bruno", "Vinícius", "Matheus", "Rúben"],
    last: ["Silva", "Santos", "Costa", "Pereira", "Oliveira", "Souza", "Ferreira", "Almeida", "Carvalho", "Ribeiro", "Lima", "Gomes",
      "Rodrigues", "Martins", "Sousa", "Fernandes", "Barbosa", "Rocha", "Dias", "Moreira", "Teixeira", "Nunes", "Cardoso", "Mendes"],
  },
  french: {
    first: ["Antoine", "Lucas", "Théo", "Hugo", "Kylian", "Maxime", "Jules", "Mathis", "Adrien", "Yanis", "Bastien", "Louis"],
    last: ["Martin", "Bernard", "Dubois", "Moreau", "Laurent", "Girard", "Lefèvre", "Fontaine", "Rousseau", "Mercier", "Blanc", "Garnier",
      "Petit", "Durand", "Leroy", "Simon", "Michel", "Lefebvre", "Roux", "David", "Bertrand", "Morel", "Fournier", "Lambert"],
  },
  german: {
    first: ["Lukas", "Leon", "Jonas", "Florian", "Niklas", "Felix", "Kai", "Timo", "Joshua", "Maximilian", "Julian", "Leroy"],
    last: ["Müller", "Schmidt", "Schneider", "Fischer", "Weber", "Wagner", "Becker", "Hoffmann", "Koch", "Richter", "Klein", "Neuer",
      "Schulz", "Zimmermann", "Krüger", "Hartmann", "Werner", "Lange", "Schmitt", "Braun", "Hofmann", "Vogel", "Kaiser", "Brandt"],
  },
  italian: {
    first: ["Marco", "Lorenzo", "Federico", "Alessandro", "Nicolò", "Matteo", "Davide", "Giacomo", "Andrea", "Riccardo", "Gianluca", "Sandro"],
    last: ["Rossi", "Russo", "Ferrari", "Esposito", "Bianchi", "Romano", "Colombo", "Ricci", "Marino", "Greco", "Bruno", "Conti",
      "Gallo", "Costa", "Fontana", "Rizzo", "Moretti", "Barbieri", "Lombardi", "Giordano", "Mancini", "Rinaldi", "Caruso", "Ferri"],
  },
  dutch: {
    first: ["Daan", "Jesse", "Bram", "Sem", "Luuk", "Thijs", "Ruben", "Stefan", "Joey", "Teun", "Jurriën", "Cody"],
    last: ["de Jong", "Jansen", "de Vries", "van Dijk", "Bakker", "Visser", "Smit", "Meijer", "de Boer", "Mulder", "van der Berg", "Bos",
      "de Groot", "Dekker", "Peters", "Hendriks", "van Leeuwen", "Kok", "Verbeek", "Brouwer", "de Wit", "Dijkstra", "Kuipers", "Timmer"],
  },
  nordic: {
    first: ["Mikkel", "Rasmus", "Kasper", "Erik", "Lars", "Oscar", "Viktor", "Emil", "Andreas", "Jonas", "Sander", "Gustav"],
    last: ["Hansen", "Nielsen", "Larsen", "Andersen", "Johansson", "Eriksson", "Olsen", "Lindqvist", "Berg", "Pedersen", "Sørensen", "Nyström",
      "Christensen", "Jensen", "Karlsson", "Nilsson", "Halvorsen", "Lund", "Holm", "Dahl", "Virtanen", "Sigurdsson", "Strand", "Ekberg"],
  },
  slavic: {
    first: ["Luka", "Marko", "Ivan", "Dušan", "Jakub", "Mateusz", "Tomáš", "Andriy", "Filip", "Mykola", "Petar", "Nikola"],
    last: ["Petrović", "Kovač", "Nowak", "Horvat", "Novák", "Jovanović", "Kowalski", "Shevchenko", "Marić", "Dvořák", "Zieliński", "Babić",
      "Popović", "Lewandowski", "Krejčí", "Kovalenko", "Nikolić", "Wiśniewski", "Tomić", "Svoboda", "Bondarenko", "Perišić", "Mazur", "Stanković"],
  },
  arabic: {
    first: ["Youssef", "Achraf", "Hakim", "Mohamed", "Ahmed", "Karim", "Riyad", "Omar", "Salem", "Ismael", "Hamza", "Bilal"],
    last: ["El Amrani", "Benali", "Hassan", "Mansour", "Bensaïd", "Mahrez", "Ziani", "Al Dawsari", "Saleh", "Haddad", "Bouzid", "Nasser",
      "Amrabat", "Ziyech", "Fathi", "Khalil", "Bennani", "Rahimi", "Yassine", "Farouk", "Idrissi", "Aziz", "Sabri", "Tahiri"],
  },
  westAfrican: {
    first: ["Samuel", "Victor", "Wilfried", "Sadio", "Ismaïla", "Kalidou", "Emmanuel", "Moses", "Thomas", "Idrissa", "Franck", "Joel"],
    last: ["Osimhen", "Mensah", "Diallo", "Koné", "Traoré", "Sarr", "Mendy", "Okafor", "Adeyemi", "Bamba", "Gueye", "Owusu",
      "Ndiaye", "Iheanacho", "Asante", "Coulibaly", "Cissé", "Ekong", "Boateng", "Fofana", "Kouyaté", "Onyeka", "Sangaré", "Diop"],
  },
  japanese: {
    first: ["Takumi", "Kaoru", "Wataru", "Daichi", "Ritsu", "Junya", "Takefusa", "Ko", "Hiroki", "Shuichi", "Ayase", "Yuto"],
    last: ["Tanaka", "Suzuki", "Endo", "Kamada", "Doan", "Ito", "Minamino", "Mitoma", "Itakura", "Nakamura", "Ueda", "Sato",
      "Yamamoto", "Kobayashi", "Watanabe", "Takahashi", "Kubo", "Morita", "Asano", "Tomiyasu", "Furuhashi", "Maeda", "Hatate", "Ogawa"],
  },
  korean: {
    first: ["Min-jae", "Heung-min", "Kang-in", "Hee-chan", "Woo-young", "Jae-sung", "Gue-sung", "Seung-ho", "Hyun-woo", "Ji-sung", "Young-gwon", "Tae-hwan"],
    last: ["Kim", "Lee", "Park", "Son", "Hwang", "Cho", "Jung", "Kang", "Paik", "Seol", "Hong", "Oh",
      "Yoon", "Jang", "Lim", "Han", "Shin", "Kwon", "Yang", "Bae", "Moon", "Na", "Ahn", "Song"],
  },
  turkish: {
    first: ["Arda", "Kerem", "Hakan", "Mert", "Ferdi", "Kaan", "Barış", "Cenk", "Orkun", "Salih", "Yusuf", "Emre"],
    last: ["Yılmaz", "Kaya", "Demir", "Çelik", "Şahin", "Aydın", "Öztürk", "Arslan", "Doğan", "Kılıç", "Kökçü", "Ayhan",
      "Özdemir", "Koç", "Polat", "Güler", "Akgün", "Kahveci", "Bardakcı", "Söyüncü", "Ünal", "Kabak", "Tosun", "Erkin"],
  },
  greek: {
    first: ["Giorgos", "Kostas", "Dimitris", "Nikos", "Vangelis", "Anastasios", "Christos", "Petros", "Fotis", "Manolis", "Tasos", "Lazaros"],
    last: ["Papadopoulos", "Pavlidis", "Mavropanos", "Bakasetas", "Tsimikas", "Giakoumakis", "Masouras", "Mantalos", "Vlachodimos", "Siopis", "Kourbelis", "Zeca",
      "Nikolaou", "Georgiou", "Konstantinou", "Dimitriou", "Ioannidis", "Alexiou", "Karetsas", "Chatzigiovanis", "Retsos", "Tzolis", "Limnios", "Fountas"],
  },
  hungarian: {
    first: ["Dominik", "Roland", "Ádám", "Péter", "Barnabás", "Milos", "Attila", "Zsolt", "Bendegúz", "Martin", "Dániel", "Loïc"],
    last: ["Szoboszlai", "Sallai", "Nagy", "Gulácsi", "Szalai", "Kerkez", "Varga", "Kovács", "Tóth", "Fiola", "Orbán", "Nego",
      "Szabó", "Horváth", "Molnár", "Farkas", "Balogh", "Papp", "Lakatos", "Takács", "Juhász", "Mészáros", "Simon", "Kiss"],
  },
  romanian: {
    first: ["Ianis", "Andrei", "Răzvan", "Nicolae", "Florin", "Radu", "Valentin", "Denis", "Ionuț", "Alexandru", "Dennis", "Darius"],
    last: ["Popescu", "Ionescu", "Stanciu", "Drăgușin", "Man", "Marin", "Mihăilă", "Rațiu", "Hagi", "Niță", "Coman", "Olaru",
      "Dumitrescu", "Stan", "Constantin", "Ilie", "Matei", "Tănase", "Pușcaș", "Burcă", "Cicâldău", "Mitriță", "Alibec"],
  },
  celtic: {
    first: ["Callum", "Scott", "Andy", "Kieran", "John", "Ryan", "Seamus", "Conor", "Shane", "Gavin", "Liam", "Ewan"],
    last: ["McGregor", "Robertson", "McTominay", "Tierney", "Gilmour", "O'Brien", "Doherty", "Duffy", "Kelly", "Ferguson", "Ramsey", "Davies",
      "Murphy", "Walsh", "O'Neill", "Campbell", "Stewart", "Morgan", "Evans", "Hughes", "McGinn", "Christie", "Byrne", "Lynch"],
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
  // A team sheet shows surnames only, so no two men share one while the pool
  // has surnames left (a France XI had two Laurents, two Rousseaus and two
  // Garniers): surnames are dealt from a shuffled deck, first names at random.
  const deck = [...pool.last];
  for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    let name = "";
    for (let tries = 0; tries < 50 && (!name || used.has(name)); tries++) {
      const last = i < deck.length && tries === 0 ? deck[i] : pool.last[Math.floor(rng() * pool.last.length)];
      name = `${pool.first[Math.floor(rng() * pool.first.length)]} ${last}`;
    }
    if (used.has(name)) name = `${name} ${i + 1}`;
    used.add(name);
    out.push(name);
  }
  return out;
}
