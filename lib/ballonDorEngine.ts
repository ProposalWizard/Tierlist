import type {
  BDPosition, BDStats, BDTrophy, BDClub, BDEvent, EventChoice,
  CeremonyEntry, BDOCeremony, BDSeason, BDAttributes, BDPlayer,
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
  { id: 'mancity',    name: 'Manchester City',    prestige: 95, clChance: 0.85, primaryColor: '#6CABDD' },
  { id: 'liverpool',  name: 'Liverpool',           prestige: 92, clChance: 0.80, primaryColor: '#C8102E' },
  { id: 'arsenal',    name: 'Arsenal',             prestige: 89, clChance: 0.70, primaryColor: '#EF0107' },
  { id: 'manutd',     name: 'Manchester United',   prestige: 88, clChance: 0.55, primaryColor: '#DA291C' },
  { id: 'chelsea',    name: 'Chelsea',             prestige: 86, clChance: 0.60, primaryColor: '#034694' },
  { id: 'newcastle',  name: 'Newcastle United',    prestige: 84, clChance: 0.50, primaryColor: '#241F20' },
  { id: 'tottenham',  name: 'Tottenham Hotspur',   prestige: 82, clChance: 0.45, primaryColor: '#132257' },
  { id: 'astonvilla', name: 'Aston Villa',         prestige: 80, clChance: 0.35, primaryColor: '#95BFE5' },
  { id: 'brighton',   name: 'Brighton',            prestige: 74, clChance: 0.20, primaryColor: '#0057B8' },
  { id: 'westham',    name: 'West Ham United',     prestige: 72, clChance: 0.10, primaryColor: '#7A263A' },
  { id: 'fulham',     name: 'Fulham',              prestige: 68, clChance: 0.05, primaryColor: '#CC0000' },
  { id: 'wolves',     name: 'Wolverhampton',       prestige: 66, clChance: 0.03, primaryColor: '#FDB913' },
  { id: 'palace',     name: 'Crystal Palace',      prestige: 65, clChance: 0.02, primaryColor: '#1B458F' },
  { id: 'nottmforest',name: "Nott'm Forest",       prestige: 63, clChance: 0.02, primaryColor: '#DD0000' },
  { id: 'everton',    name: 'Everton',             prestige: 62, clChance: 0.01, primaryColor: '#003399' },
  { id: 'brentford',  name: 'Brentford',           prestige: 60, clChance: 0.01, primaryColor: '#E30613' },
  { id: 'bournemouth',name: 'Bournemouth',         prestige: 58, clChance: 0.01, primaryColor: '#B50E12' },
  { id: 'leicester',  name: 'Leicester City',      prestige: 60, clChance: 0.02, primaryColor: '#003090' },
  { id: 'southampton',name: 'Southampton',         prestige: 56, clChance: 0.00, primaryColor: '#D71920' },
  { id: 'ipswich',    name: 'Ipswich Town',        prestige: 54, clChance: 0.00, primaryColor: '#3A64A3' },
];

// --- Rivals ---
interface RivalTemplate {
  name: string; club: string; leagueFlag: string;
  position: BDPosition; overall: number; clubPrestige: number; hasCL: boolean;
}

const RIVAL_POOL: RivalTemplate[] = [
  { name: 'Erling Haaland',        club: 'Manchester City',   leagueFlag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', position: 'ATT', overall: 91, clubPrestige: 95, hasCL: true  },
  { name: 'Kylian Mbappé',         club: 'Real Madrid',       leagueFlag: '🇪🇸', position: 'ATT', overall: 91, clubPrestige: 98, hasCL: true  },
  { name: 'Vinicius Jr.',          club: 'Real Madrid',       leagueFlag: '🇪🇸', position: 'ATT', overall: 89, clubPrestige: 98, hasCL: true  },
  { name: 'Jude Bellingham',       club: 'Real Madrid',       leagueFlag: '🇪🇸', position: 'MID', overall: 89, clubPrestige: 98, hasCL: true  },
  { name: 'Rodri',                 club: 'Manchester City',   leagueFlag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', position: 'MID', overall: 91, clubPrestige: 95, hasCL: true  },
  { name: 'Mohamed Salah',         club: 'Liverpool',         leagueFlag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', position: 'ATT', overall: 88, clubPrestige: 92, hasCL: true  },
  { name: 'Kevin De Bruyne',       club: 'Manchester City',   leagueFlag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', position: 'MID', overall: 88, clubPrestige: 95, hasCL: true  },
  { name: 'Harry Kane',            club: 'Bayern Munich',     leagueFlag: '🇩🇪', position: 'ATT', overall: 89, clubPrestige: 92, hasCL: true  },
  { name: 'Bukayo Saka',           club: 'Arsenal',           leagueFlag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', position: 'ATT', overall: 87, clubPrestige: 89, hasCL: true  },
  { name: 'Phil Foden',            club: 'Manchester City',   leagueFlag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', position: 'MID', overall: 88, clubPrestige: 95, hasCL: true  },
  { name: 'Lamine Yamal',          club: 'Barcelona',         leagueFlag: '🇪🇸', position: 'ATT', overall: 83, clubPrestige: 90, hasCL: true  },
  { name: 'Florian Wirtz',         club: 'Bayern Munich',     leagueFlag: '🇩🇪', position: 'MID', overall: 87, clubPrestige: 92, hasCL: true  },
  { name: 'Pedri',                 club: 'Barcelona',         leagueFlag: '🇪🇸', position: 'MID', overall: 86, clubPrestige: 90, hasCL: true  },
  { name: 'Robert Lewandowski',    club: 'Barcelona',         leagueFlag: '🇪🇸', position: 'ATT', overall: 85, clubPrestige: 90, hasCL: true  },
  { name: 'Bernardo Silva',        club: 'Manchester City',   leagueFlag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', position: 'MID', overall: 88, clubPrestige: 95, hasCL: true  },
  { name: 'Thibaut Courtois',      club: 'Real Madrid',       leagueFlag: '🇪🇸', position: 'GK',  overall: 90, clubPrestige: 98, hasCL: true  },
  { name: 'Alisson Becker',        club: 'Liverpool',         leagueFlag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', position: 'GK',  overall: 87, clubPrestige: 92, hasCL: true  },
  { name: 'Trent Alexander-Arnold',club: 'Liverpool',         leagueFlag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', position: 'DEF', overall: 87, clubPrestige: 92, hasCL: true  },
  { name: 'Virgil van Dijk',       club: 'Liverpool',         leagueFlag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', position: 'DEF', overall: 88, clubPrestige: 92, hasCL: true  },
  { name: 'Rúben Dias',            club: 'Manchester City',   leagueFlag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', position: 'DEF', overall: 89, clubPrestige: 95, hasCL: true  },
  { name: 'Antoine Griezmann',     club: 'Atlético Madrid',   leagueFlag: '🇪🇸', position: 'ATT', overall: 85, clubPrestige: 88, hasCL: true  },
  { name: 'Son Heung-min',         club: 'Tottenham',         leagueFlag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', position: 'ATT', overall: 85, clubPrestige: 82, hasCL: false },
  { name: 'Rafael Leão',           club: 'AC Milan',          leagueFlag: '🇮🇹', position: 'ATT', overall: 86, clubPrestige: 88, hasCL: true  },
  { name: 'Gavi',                  club: 'Barcelona',         leagueFlag: '🇪🇸', position: 'MID', overall: 87, clubPrestige: 90, hasCL: true  },
  { name: 'Nicolò Barella',        club: 'Inter Milan',       leagueFlag: '🇮🇹', position: 'MID', overall: 87, clubPrestige: 89, hasCL: true  },
  { name: 'Victor Osimhen',        club: 'Galatasaray',       leagueFlag: '🇹🇷', position: 'ATT', overall: 87, clubPrestige: 72, hasCL: false },
  { name: 'Khvicha Kvaratskhelia', club: 'PSG',               leagueFlag: '🇫🇷', position: 'ATT', overall: 86, clubPrestige: 91, hasCL: true  },
  { name: 'Lionel Messi',          club: 'Inter Miami',       leagueFlag: '🇺🇸', position: 'ATT', overall: 84, clubPrestige: 72, hasCL: false },
  { name: 'Dušan Vlahović',        club: 'Juventus',          leagueFlag: '🇮🇹', position: 'ATT', overall: 85, clubPrestige: 86, hasCL: true  },
  { name: 'Ousmane Dembélé',       club: 'PSG',               leagueFlag: '🇫🇷', position: 'ATT', overall: 86, clubPrestige: 91, hasCL: true  },
];

function leagueNameFor(flag: string): string {
  const map: Record<string, string> = {
    '🏴󠁧󠁢󠁥󠁮󠁧󠁿': 'Premier League', '🇪🇸': 'La Liga',
    '🇩🇪': 'Bundesliga', '🇮🇹': 'Serie A', '🇫🇷': 'Ligue 1',
    '🇺🇸': 'MLS', '🇹🇷': 'Süper Lig',
  };
  return map[flag] ?? 'League Title';
}

// --- Events pool ---
const E = (
  id: string,
  phase: BDEvent['phase'],
  category: BDEvent['category'],
  title: string,
  context: string,
  choices: EventChoice[],
  positionFilter?: BDPosition[],
): BDEvent => ({ id, phase, category, title, context, choices, positionFilter });

const ch = (id: string, label: string, emoji: string, outcome: string, effects: EventChoice['effects']): EventChoice =>
  ({ id, label, emoji, outcome, effects });

export const EVENT_POOL: BDEvent[] = [
  // PRE-SEASON (6)
  E('pre_ambition', 'pre_season', 'career', 'Season Ambitions',
    'Your manager sits you down before pre-season. "What are your goals this year?" he asks.',
    [
      ch('trophies', 'Win trophies at any cost', '🏆', 'You declare your hunger for silverware. The manager smiles — that\'s exactly what he wanted to hear.', { morale: 10, fame: 5 }),
      ch('personal', 'Have my best-ever personal season', '⭐', 'You set sky-high personal targets. The pressure is on, but you thrive under it.', { avgRating: 0.1, morale: 5, fame: 8 }),
      ch('team', 'Help the team succeed above everything', '🤝', 'The dressing room loves your selfless answer. Team chemistry soars from day one.', { assists: 2, morale: 12, fitness: 5 }),
    ]),
  E('pre_training', 'pre_season', 'lifestyle', 'Pre-Season Training Focus',
    'The coaching staff ask where you want to focus this pre-season. The summer is yours to shape.',
    [
      ch('physical', 'Physical conditioning — fitness above all', '💪', 'Gruelling sessions. You arrive to the season in the best shape of your life.', { fitness: 18, appearances: 2, avgRating: 0.05 }),
      ch('technical', 'Technical refinement — sharpen the tools', '⚽', 'Hours on the training pitch. Your touch, movement and decision-making feel razor-sharp.', { avgRating: 0.15, goals: 1, assists: 1 }),
      ch('mental', 'Mental preparation — composure and leadership', '🧠', 'You work with the sports psychologist. Big-game composure markedly improved.', { morale: 10, avgRating: 0.1, manOfTheMatch: 1 }),
    ]),
  E('pre_transfer', 'pre_season', 'career', 'Transfer Interest',
    'A top European club has made enquiries. Your club has set a price. The choice is yours.',
    [
      ch('push', 'Push for the move', '✈️', 'You hand in a transfer request. The atmosphere is tense but a move is secured before the window closes.', { fame: 15, morale: -5 }),
      ch('loyal', 'Commit to the club', '❤️', 'You publicly reaffirm your loyalty. The fans and manager are delighted. The club gives you a pay rise.', { morale: 15, fame: 8, fitness: 5 }),
      ch('quiet', 'Stay quiet — keep options open', '🤫', 'You say nothing publicly. Both clubs are frustrated but you stay focused for now.', { morale: 3, fame: 5 }),
    ]),
  E('pre_media', 'pre_season', 'lifestyle', 'Pre-Season Media Tour',
    'Major broadcasters and sponsors want a sit-down interview. Millions will watch.',
    [
      ch('bold', 'Bold Ballon d\'Or prediction — "I can win it"', '🎤', 'The quote goes viral instantly. Expectations are sky-high. You wouldn\'t have it any other way.', { fame: 18, morale: -3 }),
      ch('focused', 'Focus on team goals', '🙏', 'A classy, measured interview. Respected worldwide for your professionalism.', { fame: 8, morale: 8 }),
      ch('skip', 'Skip it — focus on training', '🏃', 'No media distractions. You arrive to the season fresher and sharper than anyone.', { fitness: 8, avgRating: 0.05 }),
    ]),
  E('pre_manager', 'pre_season', 'career', "Manager's Meeting",
    'Your manager has a frank one-to-one about your role and what he expects from you this season.',
    [
      ch('starter', 'Demand first-choice status', '🔑', 'The manager respects your directness. You\'re named captain for the opener.', { appearances: 3, morale: 8, fame: 5 }),
      ch('earn', 'Earn my place through performances', '💯', 'A mature response. The manager builds his system around you.', { avgRating: 0.12, morale: 6, fitness: 3 }),
      ch('flexible', 'Offer to play multiple roles', '🔄', 'Your flexibility makes you invaluable. You start in 90% of matches throughout the season.', { appearances: 4, assists: 1, morale: 4 }),
    ]),
  E('pre_fitness', 'pre_season', 'lifestyle', 'Fitness Assessment',
    'The club physios run comprehensive tests. Your summer prep will define your season baseline.',
    [
      ch('peak', 'Returned in best-ever shape', '🔥', 'The numbers are exceptional. You are at the absolute peak of your physical powers.', { fitness: 20, appearances: 3, avgRating: 0.08 }),
      ch('solid', 'Standard pre-season preparation', '👍', 'You are in solid shape. Nothing extraordinary, but ready to hit the ground running.', { fitness: 8, appearances: 1 }),
      ch('late', 'Extended holiday — came back slightly late', '🏖️', 'You enjoyed the summer but it shows. The manager is displeased. A slow start awaits.', { fitness: -10, appearances: -2, morale: -5 }),
    ]),

  // FIRST HALF (13)
  E('h1_att', 'first_half', 'match', 'Early Season Opener',
    'Third game of the season. You\'re clean through, one-on-one with the keeper. The stadium holds its breath.',
    [
      ch('clinical', 'Finish clinically — low and hard', '🎯', 'Net-shaker. Early-season form found instantly.', { goals: 3, avgRating: 0.15, manOfTheMatch: 1 }),
      ch('chip', 'Chip it — high risk, high reward', '🎪', 'Genius. The chip is perfect. Highlight of the week on every channel in the world.', { goals: 2, fame: 10, manOfTheMatch: 1 }),
      ch('square', 'Square it to a teammate', '🤲', 'Selfless. Your teammate scores easily. You get the assist.', { assists: 2, morale: 5, avgRating: 0.08 }),
    ], ['ATT']),
  E('h1_mid', 'first_half', 'match', 'Engine Room Decision',
    'A tight game, you receive the ball 30 yards out with acres of space. The world watches.',
    [
      ch('shoot', 'Let fly from distance', '💥', 'Thunderbolt into the top corner. Goal of the month candidate.', { goals: 2, fame: 8, avgRating: 0.12 }),
      ch('through', 'Slide the perfect through ball', '🎯', 'Inch-perfect delivery. Your striker is through and scores. Magic vision.', { assists: 3, avgRating: 0.15, morale: 5 }),
      ch('press', 'Press and win the ball — lead by example', '💨', 'You lead the press and win possession in a dangerous area. Energy personified.', { avgRating: 0.1, fitness: -3, manOfTheMatch: 1 }),
    ], ['MID']),
  E('h1_def', 'first_half', 'match', 'Last-Ditch Defending',
    'Their striker is bearing down on goal with only you between them and your keeper. Biggest moment of the game.',
    [
      ch('tackle', 'Make the challenge — go in hard', '🦵', 'Perfect timing. You nick the ball cleanly. The crowd roars. Pundits call it a masterclass.', { cleanSheets: 2, avgRating: 0.15, manOfTheMatch: 1 }),
      ch('jockey', 'Jockey — delay until help arrives', '🧱', 'Disciplined defending. You hold your shape and the keeper makes the save.', { cleanSheets: 1, avgRating: 0.1, fitness: 2 }),
      ch('foul', 'Professional foul — take the yellow card', '🟡', 'You stop the counter at the cost of a booking. The team is grateful.', { cleanSheets: 1, avgRating: 0.05, appearances: -1 }),
    ], ['DEF']),
  E('h1_gk', 'first_half', 'match', 'Crucial Save',
    'Point-blank range. The striker has a tap-in from three yards. You have a split second.',
    [
      ch('instinct', 'React on pure instinct — full stretch', '🧤', 'Miraculous. Your reflexes are superhuman. Man of the match without question.', { cleanSheets: 3, avgRating: 0.2, manOfTheMatch: 2 }),
      ch('read', 'Get set — read the play early', '👁️', 'You anticipated the cross and were already in position. You catch it cleanly.', { cleanSheets: 2, avgRating: 0.12, manOfTheMatch: 1 }),
      ch('command', 'Command the box — punch it clear', '✊', 'Dominant in the air. You punch the danger away and reorganise your defence.', { cleanSheets: 1, avgRating: 0.08, morale: 5 }),
    ], ['GK']),
  E('h1_cl', 'first_half', 'match', 'Champions League Night',
    'The UEFA Champions League group stage. Under the floodlights at a fortress ground. All of Europe watching.',
    [
      ch('star', 'Step up and be the star', '⭐', 'An imperious European performance. Your name echoes across the continent.', { goals: 2, assists: 1, avgRating: 0.18, fame: 12, manOfTheMatch: 1 }),
      ch('solid', 'Efficient and controlled', '✅', 'Professional. You do your job without fuss. The team advances.', { avgRating: 0.08, morale: 6, fitness: 2 }),
      ch('too_much', 'Try too hard — overcomplicate everything', '😤', 'Not your night. The pressure gets to you. A humbling learning experience.', { avgRating: -0.05, morale: -5, fame: 2 }),
    ]),
  E('h1_intl', 'first_half', 'lifestyle', 'International Break',
    'Your national team calls you up for a crucial qualifier. But there\'s a knock on your ankle.',
    [
      ch('go', 'Go and represent your country', '🌍', 'You play through it and deliver for your nation. A moment of genuine pride.', { goals: 1, assists: 1, fame: 8, fitness: -8 }),
      ch('withdraw', 'Withdraw — protect yourself for the club', '🏥', 'You rest up and return refreshed. The club is quietly relieved.', { fitness: 10, morale: 3 }),
      ch('push', 'Go and play the full ninety', '💪', 'You play on despite the risk. The ankle worsens. You miss two league games on your return.', { goals: 2, fame: 6, fitness: -15, appearances: -2 }),
    ]),
  E('h1_bdo_q', 'first_half', 'lifestyle', "Ballon d'Or Question",
    'A journalist catches you after training. "Do you think about winning the Ballon d\'Or?"',
    [
      ch('target', '"It\'s my main target this year."', '🥇', 'The quote goes viral. The world starts paying closer attention. Pressure, but you embrace it.', { fame: 20, morale: -3 }),
      ch('humble', '"I just focus on helping my club."', '🙏', 'The media love the humility. Fans around the world warm to you.', { fame: 10, morale: 8 }),
      ch('laugh', '"Ask me at the end of the season."', '😄', 'Confident and charming. A viral clip. The internet loves it.', { fame: 14, morale: 5 }),
    ]),
  E('h1_injury', 'first_half', 'lifestyle', 'Injury Concern',
    'You roll your ankle in training. The physio says rest 10 days. The manager wants you to play.',
    [
      ch('rest', "Follow the physio's advice", '🏥', 'Smart. You miss two matches but return fully fit.', { fitness: 10, appearances: -2 }),
      ch('play', 'Play through the pain', '😤', 'You make it through, but the ankle isn\'t right for weeks. Impairs your movement significantly.', { avgRating: -0.08, fitness: -12, appearances: 1 }),
      ch('half', 'Play but come off at half-time', '🔄', 'A pragmatic compromise. You give 45 minutes and protect yourself.', { fitness: -3, appearances: -1, morale: 3 }),
    ]),
  E('h1_derby', 'first_half', 'match', 'Derby Day',
    'The biggest local derby of the season. The atmosphere is electric. Millions watching on TV.',
    [
      ch('inspired', 'Rise to the occasion', '🔥', 'A derby day masterclass. Goals, drive, leadership — everything. You are the difference.', { goals: 2, assists: 1, avgRating: 0.2, fame: 10, manOfTheMatch: 1 }),
      ch('tactical', 'Play the smart game', '🧠', 'Controlled and disciplined. A gritty clean win. Hard to argue with the result.', { avgRating: 0.1, cleanSheets: 1, morale: 8 }),
      ch('red_mist', 'Get caught up in the atmosphere', '😡', 'A needless yellow in the first half disrupts everything. A frustrating afternoon.', { avgRating: -0.05, morale: -8, appearances: -1 }),
    ]),
  E('h1_conflict', 'first_half', 'career', 'Dressing Room Tension',
    'A senior teammate has been undermining you in training. The manager has noticed the friction.',
    [
      ch('confront', 'Confront them directly — clear the air', '💬', 'A frank conversation. Mutual respect restored. The team is stronger for the honesty.', { morale: 10, avgRating: 0.05, fame: 3 }),
      ch('focus', 'Let your performances do the talking', '⚽', 'You stay professional and produce better results than ever. The manager takes note.', { avgRating: 0.12, goals: 1, morale: 5 }),
      ch('report', 'Report it to the manager', '👔', 'The manager handles it. The player is disciplined. A short-term fix but the atmosphere sours.', { morale: -5, fitness: 5, avgRating: 0.03 }),
    ]),
  E('h1_penalty', 'first_half', 'match', 'Penalty Shootout',
    'A cup game goes to penalties. You volunteer to step up in a must-not-miss moment.',
    [
      ch('cool', 'Ice cool — pick your spot and stroke it', '🎯', 'Unstoppable. You bury it into the corner. A hero in that moment.', { goals: 1, fame: 10, morale: 12, manOfTheMatch: 1 }),
      ch('power', 'Blast it straight down the middle', '💥', 'The keeper dives. Power over placement. Right down the middle. It works.', { goals: 1, morale: 8, fame: 6 }),
      ch('miss', 'The keeper guesses right — it\'s saved', '😰', 'You hit it well but they read it. Your team is knocked out. A dark moment you won\'t forget.', { morale: -15, fame: -3, avgRating: -0.05 }),
    ]),
  E('h1_hattrick', 'first_half', 'match', 'Hat-Trick Chance',
    'Two goals in, your side win a late penalty. You grab the ball — but the designated taker confronts you.',
    [
      ch('take', 'Take the ball — it\'s your hat-trick', '⚽', 'You score. A hat-trick. The crowd go absolutely wild. Worth any friction.', { goals: 3, fame: 15, morale: 5, manOfTheMatch: 1 }),
      ch('give', 'Hand it over — respect the hierarchy', '🤝', 'The designated taker scores. Dressing room harmony preserved. You\'re the bigger man.', { assists: 1, morale: 10, fame: 5 }),
    ], ['ATT']),

  // JANUARY (5)
  E('jan_interest', 'january', 'career', 'January Transfer Window',
    'A top club has submitted a bid. Your current club is reluctant but will let you go for the right fee.',
    [
      ch('force', 'Force the transfer through', '✈️', 'You get your move to a bigger stage. New challenge. The world is watching your every game now.', { fame: 20, morale: -8, fitness: -5 }),
      ch('stay', 'Commit until the summer', '🤝', 'You agree to see out the season before deciding. Focused and professional.', { morale: 12, avgRating: 0.1, fame: 5 }),
      ch('terms', 'Negotiate improved terms to stay', '💰', 'You use the interest to land a better deal. Financially secure and settled.', { morale: 8, fame: 6, fitness: 5 }),
    ]),
  E('jan_signing', 'january', 'career', 'New Signing Rivals Your Place',
    'The club has spent big in January on a player in your exact position. The pressure is suddenly real.',
    [
      ch('rise', 'Welcome the competition — rise to it', '💪', 'Your training intensity reaches new heights. You perform better than ever under the pressure.', { avgRating: 0.15, goals: 2, morale: 6 }),
      ch('clarity', 'Request clarity on your role', '😤', 'The manager reassures you. You\'re still number one. But the friction lingers for weeks.', { morale: -5, avgRating: 0.05, appearances: 2 }),
      ch('adapt', 'Adapt — offer to play a hybrid role', '🔄', 'Your flexibility impresses the coaching staff. You end up playing more games, not fewer.', { appearances: 4, assists: 1, morale: 5 }),
    ]),
  E('jan_rest', 'january', 'lifestyle', 'Mid-Season Break',
    'A rare week without a fixture. The coaching staff ask how you want to spend it.',
    [
      ch('train', 'Intensive training block', '⚽', 'You push hard in the training sessions. Technically sharper heading into the second half.', { avgRating: 0.1, goals: 1, fitness: 3 }),
      ch('recovery', 'Full rest and body recovery', '😴', 'Your body thanks you. The second half of the season you feel like a completely fresh player.', { fitness: 18, appearances: 2, avgRating: 0.05 }),
      ch('media', 'Media appearances — brand building', '📸', 'A commercial week. Interviews, photoshoots, global brand deals. Fame goes through the roof.', { fame: 18, morale: 5, fitness: -5 }),
    ]),
  E('jan_contract', 'january', 'career', 'Contract Extension Offer',
    'The club offer you a long-term deal. The terms are good but not elite-level.',
    [
      ch('sign', 'Sign immediately', '✍️', 'Settled and secure. You refocus entirely on football. Form immediately picks up.', { morale: 15, avgRating: 0.08, fitness: 5 }),
      ch('hold', 'Hold out for better terms', '🤝', 'Negotiations drag on. Distracting, but you believe you\'ll get a better deal if you hold firm.', { fame: 8, morale: -5, fitness: 2 }),
      ch('reject', 'Reject it — you want a big move in summer', '👋', 'You signal your intention to leave. A huge move is coming. Focus is split between now and then.', { fame: 15, morale: -8, avgRating: -0.05 }),
    ]),
  E('jan_cup', 'january', 'match', 'FA Cup Fourth Round',
    'A Premier League rival in the cup. First silverware of the season is on the line.',
    [
      ch('full', 'Give everything — cup fever', '🏆', 'You carry the team through with an inspired display. A quarter-final awaits.', { goals: 2, assists: 1, avgRating: 0.12, morale: 8 }),
      ch('rotate', 'Ask to be rotated — preserve fitness for the league', '🔄', 'Smart management. You rest and the team progresses without you.', { fitness: 8, avgRating: 0.05, appearances: -1 }),
      ch('manage', 'Manage your game — do just enough', '🎛️', 'Measured. You do enough to progress without spending yourself.', { goals: 1, morale: 5, fitness: 2 }),
    ]),

  // SECOND HALF (9)
  E('h2_title', 'second_half', 'match', 'Title Race Heats Up',
    'You\'re in a three-way title race with four games remaining. This one is pivotal.',
    [
      ch('deliver', 'Step up and deliver under pressure', '👑', 'You score the winner with 12 minutes left. The title race is now in your hands.', { goals: 3, fame: 18, avgRating: 0.2, manOfTheMatch: 1, morale: 10 }),
      ch('collective', 'Trust the system — lead without the ball', '🤝', 'A brilliant team effort. You contribute without hogging the spotlight and it wins the game.', { assists: 2, avgRating: 0.12, morale: 8 }),
      ch('crack', 'The weight of expectation gets to you', '😰', 'An anonymous performance in the most crucial game of the season. The press are brutal.', { avgRating: -0.05, morale: -8, fame: -2 }),
    ]),
  E('h2_cupsemi', 'second_half', 'match', 'Cup Semi-Final',
    'One game from Wembley. Your performance here could define your entire season.',
    [
      ch('heroics', 'Play through the pain — be the hero', '🦸', 'A warrior performance. You score, you assist. The final is booked. A legend today.', { goals: 2, assists: 1, avgRating: 0.2, fame: 12, fitness: -10, manOfTheMatch: 1 }),
      ch('smart', 'Smart performance — decisive at key moments', '🧠', 'You pick your moments and it works. Efficient and clinical.', { goals: 1, avgRating: 0.1, morale: 8, fitness: -3 }),
      ch('injured', 'Carrying an injury — rest for the final', '🏥', 'A difficult but mature decision. The team struggles without you but reaches the final.', { fitness: 12, appearances: -1, morale: 3 }),
    ]),
  E('h2_cl_ko', 'second_half', 'match', 'Champions League Quarter-Final',
    'Two legs against a world-class opponent. The entire continent watching every single touch.',
    [
      ch('world', 'Produce a world-class two-leg display', '🌟', 'A performance that will be replayed for decades. You single-handedly win the tie.', { goals: 3, assists: 1, avgRating: 0.25, fame: 20, manOfTheMatch: 2 }),
      ch('team', 'Be the team\'s heartbeat', '💚', 'You lead the team through with composure and class. The semi-final awaits.', { goals: 1, assists: 2, avgRating: 0.15, fame: 12, morale: 8 }),
      ch('exit', 'Exit in the quarters — it wasn\'t meant to be', '😔', 'Despite your best efforts, you\'re knocked out. The league is everything now.', { morale: -10, fame: 3, fitness: 5 }),
    ]),
  E('h2_rival', 'second_half', 'career', "Rival's Record Run",
    'Haaland or Mbappé is on a jaw-dropping run. Every pundit has already handed them the Ballon d\'Or.',
    [
      ch('fuel', 'Use it as fuel — outperform them', '⚔️', 'Their form drives you to new heights. You go on a remarkable run of your own.', { goals: 3, assists: 2, avgRating: 0.15, fame: 10 }),
      ch('maintain', 'Stay focused on your own game', '🎯', 'No distractions. You keep delivering consistently. The narrative can wait.', { avgRating: 0.1, morale: 8, goals: 1 }),
      ch('accept', 'Accept they\'re the favourite — aim for top 5', '🙏', 'Realistic and grounded. A great season regardless, just not the one you dreamed of.', { morale: -5, fitness: 5, fame: 2 }),
    ]),
  E('h2_captain', 'second_half', 'career', 'Captaincy Offered',
    'The regular captain is suspended for three matches. The manager turns to you.',
    [
      ch('lead', 'Accept with pride — lead the side', '🤝', 'A natural leader. The team rallies around you. You win all three games wearing the armband.', { fame: 15, morale: 12, avgRating: 0.12, goals: 1, manOfTheMatch: 1 }),
      ch('decline', 'Decline — not the right time', '🙅', 'You prefer to lead by example on the pitch. The manager quietly respects the honesty.', { morale: 3, avgRating: 0.08 }),
    ]),
  E('h2_comeback', 'second_half', 'match', 'Comeback from Injury',
    'You\'ve been out for three weeks. This is your return to the starting XI. Every eye is on you.',
    [
      ch('explosive', 'Prove a point from the first whistle', '💥', 'Unstoppable. Your comeback match is one of the best performances of your career.', { goals: 2, assists: 1, avgRating: 0.18, fame: 10, manOfTheMatch: 1 }),
      ch('steady', 'Steady return — ease back in sensibly', '🔄', 'Smart. You manage your minutes carefully and avoid a setback. Full fitness in two weeks.', { fitness: 12, avgRating: 0.05, appearances: 2 }),
    ]),
  E('h2_media_fav', 'second_half', 'lifestyle', "Ballon d'Or Favourite",
    'The press have named you as a leading Ballon d\'Or contender. Cameras follow you everywhere.',
    [
      ch('embrace', 'Embrace all the attention', '🎤', 'You thrive in the spotlight. Major global brands come knocking. Popularity soars.', { fame: 25, morale: 5 }),
      ch('deflect', 'Deflect — focus on trophies', '🏆', 'Classy as always. "I just want to win trophies." The world loves it.', { fame: 12, morale: 10, avgRating: 0.08 }),
      ch('ignore', 'Ignore it all — stay completely in the zone', '🧘', 'No distractions whatsoever. You enter a form period that silences everyone.', { goals: 2, avgRating: 0.12, fitness: 5 }),
    ]),
  E('h2_away', 'second_half', 'match', 'Hostile Away Ground',
    'A must-win away game at one of the toughest grounds in the country. The home fans are unrelenting.',
    [
      ch('relish', 'Feed off the hostility', '😈', 'You love it. Silencing the home crowd is your favourite feeling. You shine brilliantly.', { goals: 2, avgRating: 0.15, fame: 8, manOfTheMatch: 1 }),
      ch('professional', 'Stay professional — head down, do the job', '🤐', 'Head down, game managed. A gritty win without any fireworks.', { avgRating: 0.08, morale: 6 }),
      ch('rattled', 'Rattled by the atmosphere and noise', '😤', 'The crowd gets inside your head. You pick up a yellow and are subbed before the hour.', { avgRating: -0.05, morale: -6, appearances: -1 }),
    ]),
  E('h2_overplay', 'second_half', 'lifestyle', 'Overload Warning',
    'The physio flags you as a fatigue risk. The manager wants you to play through it.',
    [
      ch('push', 'Push through — every minute matters', '💪', 'You battle on. Stats are excellent but the body is paying a price.', { goals: 1, avgRating: 0.08, fitness: -15, morale: 5 }),
      ch('manage', 'Request rotation in a lesser game', '🎛️', 'Sensible. You come on as a sub in a cup game, fresh for the big league matches.', { fitness: 10, avgRating: 0.06, morale: 4 }),
      ch('rest', 'Rest completely — skip the next fixture', '😴', 'You miss one match. You return to the next like a completely different player.', { fitness: 18, appearances: -1, avgRating: 0.05 }),
    ]),

  // RUN-IN (5)
  E('ri_finale', 'run_in', 'match', 'Season Finale',
    'Last game of the season. Everything is decided except the score. How do you sign off?',
    [
      ch('glory', 'Go for broke — end the season in style', '🎆', 'A goal, an assist, a Man of the Match. The perfect curtain call. Every pundit names you their player of the season.', { goals: 2, assists: 1, avgRating: 0.15, fame: 12, manOfTheMatch: 1 }),
      ch('steady_ri', 'Solid performance — protect the body', '🛡️', 'Professional and measured. You finish the season without a scratch.', { avgRating: 0.06, fitness: 8, morale: 6 }),
      ch('sub', 'Ask to come on as a substitute', '💺', 'Smart body management. Fresh for the post-season. Your season numbers hold up fine.', { fitness: 12, morale: 3 }),
    ]),
  E('ri_interview', 'run_in', 'lifestyle', 'Season Review Interview',
    'The major broadcasters want your verdict on your own season.',
    [
      ch('best', '"This has been the season of my career."', '⭐', '"This is the best I\'ve ever played." The confidence is infectious. The world agrees.', { fame: 18, morale: 8 }),
      ch('trophies_ri', 'Highlight the trophies and teamwork', '🏆', 'You credit the team and the trophies. Perfectly pitched for Ballon d\'Or consideration.', { fame: 12, morale: 10, avgRating: 0.05 }),
      ch('hungry', '"I want even more next season."', '🔥', '"I\'m not satisfied." The drive impresses everyone. A player hungry at the peak of his powers.', { fame: 10, morale: 5, overall: 1 }),
    ]),
  E('ri_bdo_hype', 'run_in', 'lifestyle', "Ballon d'Or Campaign",
    'Paris. October. The ceremony is two months away. French Football are calling. You\'re a favourite.',
    [
      ch('events', 'Attend every pre-ceremony gala and event', '🎩', 'You work every room brilliantly. Your campaign for votes is relentless and devastatingly effective.', { fame: 22, morale: 3 }),
      ch('football', 'Let the football speak for itself', '⚽', 'No campaigning. Pure football. The voters respect it enormously — perhaps more than anything else.', { fame: 10, morale: 12, avgRating: 0.05 }),
      ch('social', 'Launch a massive social media push', '📱', 'A viral campaign. Hundreds of millions of views. Your profile reaches stratospheric new heights.', { fame: 20, morale: 2 }),
    ]),
  E('ri_lastday', 'run_in', 'match', 'Final Day Drama',
    'The title hangs by a thread. Your side needs a win to be champions. All or nothing.',
    [
      ch('hero_ri', 'Be the hero when it matters most', '👑', 'You score the winner. Champions. Your name will live in this club\'s history forever.', { goals: 2, avgRating: 0.2, fame: 20, morale: 15, manOfTheMatch: 1 }),
      ch('team_ri', 'Contribute fully to a team victory', '🤝', 'Assists, intensity, leadership. The team win the title and you played your part.', { assists: 2, avgRating: 0.12, morale: 12, fame: 10 }),
      ch('watch', 'Injured — watching from the bench', '💔', 'Heartbreaking. You watch your teammates lift the trophy without you.', { morale: -10, fame: 5, fitness: 8 }),
    ]),
  E('ri_gala', 'run_in', 'lifestyle', 'End of Season Gala',
    'The club holds a black-tie season celebration. The chairman praises you publicly in a heartfelt speech.',
    [
      ch('speech', 'Give a rousing speech back', '🎤', 'Your words bring the room to its feet. Clips go global overnight. A truly memorable night.', { fame: 15, morale: 12, overall: 1 }),
      ch('quiet_ri', 'Stay humble — let others shine tonight', '🙂', 'Classy and humble. The manager tells the press you\'re the best professional he has ever worked with.', { morale: 8, fame: 6, avgRating: 0.05 }),
    ]),
];

// --- Base stat generation ---
export function generateBaseStats(
  position: BDPosition, overall: number, inCL: boolean, seed: number,
): BDStats {
  const rng = mulberry32(seed);
  const cl = inCL ? 1.05 : 1;

  if (position === 'ATT') {
    return {
      goals: clamp(ri(rng, overall * 0.28 - 10, 4), 10, 22),
      assists: clamp(ri(rng, overall * 0.09, 2), 3, 10),
      appearances: clamp(ri(rng, 32, 3), 25, 38),
      avgRating: clamp(gauss(rng, overall / 10 - 0.6, 0.2) * cl, 6.8, 8.5),
      cleanSheets: 0,
      manOfTheMatch: clamp(ri(rng, overall * 0.05 - 2, 1.5), 1, 7),
    };
  }
  if (position === 'MID') {
    return {
      goals: clamp(ri(rng, overall * 0.12 - 4, 3), 4, 14),
      assists: clamp(ri(rng, overall * 0.14 - 4, 3), 5, 16),
      appearances: clamp(ri(rng, 32, 3), 25, 38),
      avgRating: clamp(gauss(rng, overall / 10 - 0.55, 0.2) * cl, 6.9, 8.5),
      cleanSheets: 0,
      manOfTheMatch: clamp(ri(rng, overall * 0.05 - 2, 1.5), 1, 6),
    };
  }
  if (position === 'DEF') {
    return {
      goals: clamp(ri(rng, 2.5, 1.5), 0, 5),
      assists: clamp(ri(rng, 3.5, 2), 1, 8),
      appearances: clamp(ri(rng, 31, 3), 24, 37),
      avgRating: clamp(gauss(rng, overall / 10 - 0.6, 0.2) * cl, 6.8, 8.4),
      cleanSheets: clamp(ri(rng, overall * 0.14 - 6, 3), 7, 18),
      manOfTheMatch: clamp(ri(rng, overall * 0.04 - 1.5, 1.2), 1, 5),
    };
  }
  // GK
  return {
    goals: 0, assists: 0,
    appearances: clamp(ri(rng, 33, 2), 26, 38),
    avgRating: clamp(gauss(rng, overall / 10 - 0.65, 0.2) * cl, 6.7, 8.4),
    cleanSheets: clamp(ri(rng, overall * 0.16 - 7, 3), 9, 22),
    manOfTheMatch: clamp(ri(rng, overall * 0.04 - 1.5, 1.2), 1, 5),
  };
}

function addStats(a: BDStats, b: BDStats): BDStats {
  return {
    goals: Math.max(0, a.goals + b.goals),
    assists: Math.max(0, a.assists + b.assists),
    appearances: Math.max(20, a.appearances + b.appearances),
    avgRating: clamp(Number((a.avgRating + b.avgRating).toFixed(2)), 6.0, 9.9),
    cleanSheets: Math.max(0, a.cleanSheets + b.cleanSheets),
    manOfTheMatch: Math.max(0, a.manOfTheMatch + b.manOfTheMatch),
  };
}

// --- BdO scoring ---
export function calcBdoScore(
  stats: BDStats, trophies: BDTrophy[], fame: number,
  position: BDPosition, overall: number,
): number {
  let s = 0;
  if (position === 'ATT') { s += stats.goals * 3.5 + stats.assists * 2; }
  else if (position === 'MID') { s += stats.goals * 3 + stats.assists * 2.5; }
  else if (position === 'DEF') { s += stats.cleanSheets * 5 + stats.goals * 2 + stats.assists * 1.5; }
  else { s += stats.cleanSheets * 7 + stats.manOfTheMatch * 4; }
  s += Math.max(0, (stats.avgRating - 7.0)) * 12;
  s += stats.manOfTheMatch * 2;
  s += trophies.reduce((sum, t) => sum + t.bdoBonus, 0);
  s += (fame / 100) * 25;
  s += Math.max(0, overall - 82) * 0.5;
  return Math.max(0, s);
}

// --- Rival simulation ---
function generateRivalStats(t: RivalTemplate, seed: number): BDStats {
  const rng = mulberry32(seed);
  const { position: pos, overall: ovr } = t;
  if (pos === 'ATT') {
    return {
      goals: clamp(ri(rng, ovr * 0.35 - 18, 6), 5, 50),
      assists: clamp(ri(rng, ovr * 0.12 - 5, 3), 1, 20),
      appearances: clamp(ri(rng, 33, 4), 22, 42),
      avgRating: clamp(gauss(rng, ovr / 10 - 0.25, 0.3), 6.0, 9.5),
      cleanSheets: 0, manOfTheMatch: clamp(ri(rng, ovr * 0.06 - 3, 1.5), 1, 10),
    };
  }
  if (pos === 'MID') {
    return {
      goals: clamp(ri(rng, ovr * 0.18 - 10, 4), 2, 30),
      assists: clamp(ri(rng, ovr * 0.2 - 8, 5), 3, 25),
      appearances: clamp(ri(rng, 33, 4), 22, 42),
      avgRating: clamp(gauss(rng, ovr / 10 - 0.2, 0.3), 6.0, 9.5),
      cleanSheets: 0, manOfTheMatch: clamp(ri(rng, ovr * 0.05 - 2, 1.5), 1, 8),
    };
  }
  if (pos === 'DEF') {
    return {
      goals: clamp(ri(rng, 2.5, 1.5), 0, 8),
      assists: clamp(ri(rng, 4, 2), 0, 10),
      appearances: clamp(ri(rng, 32, 4), 22, 42),
      avgRating: clamp(gauss(rng, ovr / 10 - 0.3, 0.3), 6.0, 9.5),
      cleanSheets: clamp(ri(rng, ovr * 0.22 - 10, 4), 5, 28),
      manOfTheMatch: clamp(ri(rng, ovr * 0.04 - 1.5, 1.2), 0, 6),
    };
  }
  return {
    goals: 0, assists: 0,
    appearances: clamp(ri(rng, 33, 3), 22, 38),
    avgRating: clamp(gauss(rng, ovr / 10 - 0.3, 0.3), 6.0, 9.5),
    cleanSheets: clamp(ri(rng, ovr * 0.24 - 11, 4), 5, 30),
    manOfTheMatch: clamp(ri(rng, ovr * 0.04 - 1.5, 1.2), 0, 6),
  };
}

function generateRivalTrophies(t: RivalTemplate, rng: () => number): BDTrophy[] {
  const p = t.clubPrestige;
  const trophies: BDTrophy[] = [];
  if (rng() < p / 175) trophies.push({ name: leagueNameFor(t.leagueFlag), bdoBonus: 30, emoji: '🏆' });
  if (t.hasCL && rng() < p / 490) trophies.push({ name: 'Champions League', bdoBonus: 55, emoji: '⭐' });
  if (rng() < p / 290 + 0.05) trophies.push({ name: 'Domestic Cup', bdoBonus: 8, emoji: '🏆' });
  return trophies;
}

// --- Trophy simulation for player ---
function simulateTrophies(
  club: BDClub, inCL: boolean, inEL: boolean,
  fitness: number, morale: number, rng: () => number,
): BDTrophy[] {
  const perf = clamp((fitness + morale) / 200, 0.7, 1.3);
  const p = club.prestige;
  const trophies: BDTrophy[] = [];
  if (rng() < (p / 195) * perf) trophies.push({ name: 'Premier League', bdoBonus: 30, emoji: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' });
  if (rng() < (p / 300 + 0.06) * perf) trophies.push({ name: 'FA Cup', bdoBonus: 12, emoji: '🏆' });
  if (rng() < (p / 400 + 0.09) * perf) trophies.push({ name: 'Carabao Cup', bdoBonus: 5, emoji: '🏆' });
  if (inCL && rng() < (p / 590) * club.clChance * perf) trophies.push({ name: 'Champions League', bdoBonus: 55, emoji: '⭐' });
  if (inEL && rng() < (p / 240) * perf) trophies.push({ name: 'Europa League', bdoBonus: 18, emoji: '🏆' });
  return trophies;
}

// --- Ceremony generation ---
export function generateCeremony(
  player: BDPlayer,
  season: BDSeason,
  combinedStats: BDStats,
): BDOCeremony {
  const { year, attributes, trophies, playerOverall } = season;
  const trophySeed = hashSeed(`trophies_${player.name}_${year}`);

  // Simulate all rivals
  const rivals = RIVAL_POOL.map((t, i) => {
    const ss = generateRivalStats(t, hashSeed(`rival_${t.name}_${year}_${i}`));
    const tr = generateRivalTrophies(t, mulberry32(hashSeed(`rtrophy_${t.name}_${year}`)));
    const fame = clamp(t.overall * 0.6 + 10 + (mulberry32(hashSeed(`fame_${t.name}_${year}`))() * 20 - 10), 40, 100);
    return { ...t, stats: ss, trophies: tr, bdoScore: calcBdoScore(ss, tr, fame, t.position, t.overall) };
  });

  // Player score
  const playerScore = calcBdoScore(combinedStats, trophies, attributes.fame, player.position, playerOverall);

  // Merge and sort by score (highest = rank 1)
  const all = [
    ...rivals.map(r => ({ isPlayer: false, name: r.name, club: r.club, leagueFlag: r.leagueFlag, position: r.position, stats: r.stats, trophies: r.trophies, bdoScore: r.bdoScore })),
    { isPlayer: true, name: player.name, club: season.club.name, leagueFlag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', position: player.position, stats: combinedStats, trophies, bdoScore: playerScore },
  ].sort((a, b) => b.bdoScore - a.bdoScore);

  const nominees = all.slice(0, 25);
  const playerNomIdx = nominees.findIndex(e => e.isPlayer);
  const playerNominated = playerNomIdx !== -1;
  const playerRank = playerNominated ? playerNomIdx + 1 : 0;

  // Ceremony reveals 25 → 1 (reverse the nominees array so index 0 = rank 25)
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
  }));

  return { year, entries, playerRank, playerNominated };
}

// --- Season initialization ---
export function initSeason(player: BDPlayer, club: BDClub, seasonNumber: number): BDSeason {
  const year = 2024 + seasonNumber - 1;
  const seed = hashSeed(`season_${player.name}_${seasonNumber}`);
  const rng = mulberry32(seed);

  const phaseCounts: Array<[BDEvent['phase'], number]> = [
    ['pre_season', 2], ['first_half', 2], ['january', 1], ['second_half', 2], ['run_in', 1],
  ];

  const events: BDEvent[] = [];
  const usedIds = new Set<string>();
  for (const [phase, count] of phaseCounts) {
    const pool = EVENT_POOL.filter(
      e => e.phase === phase &&
        !usedIds.has(e.id) &&
        (!e.positionFilter || e.positionFilter.includes(player.position)),
    );
    // Fisher-Yates shuffle
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    for (const ev of pool.slice(0, count)) {
      usedIds.add(ev.id);
      events.push({ ...ev, choices: ev.choices.map(c => ({ ...c })) });
    }
  }

  const inCL = rng() < club.clChance;
  const inEL = !inCL && rng() < 0.25;

  const prevFame = player.isRealPlayer
    ? clamp(player.overall * 0.7, 40, 95)
    : clamp(25 + (seasonNumber - 1) * 8 + rng() * 10, 10, 90);

  const attributes: BDAttributes = {
    fitness: Math.round(clamp(72 + rng() * 18, 65, 90)),
    morale: Math.round(clamp(68 + rng() * 22, 60, 90)),
    fame: Math.round(clamp(prevFame, 10, 100)),
  };

  return {
    number: seasonNumber,
    year,
    club,
    playerAge: player.age + (seasonNumber - 1),
    playerOverall: player.overall,
    baseStats: generateBaseStats(player.position, player.overall, inCL, seed + 999),
    eventStats: { goals: 0, assists: 0, appearances: 0, avgRating: 0, cleanSheets: 0, manOfTheMatch: 0 },
    trophies: [],
    attributes,
    events,
    phase: 'pre_season',
    inCL,
    inEL,
  };
}

// --- Apply event choice ---
export function applyChoice(season: BDSeason, eventId: string, choiceId: string): BDSeason {
  const evIdx = season.events.findIndex(e => e.id === eventId);
  if (evIdx === -1) return season;
  const ev = season.events[evIdx];
  const choice = ev.choices.find(c => c.id === choiceId);
  if (!choice) return season;

  const es = { ...season.eventStats };
  const attrs = { ...season.attributes };
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

  const updatedOverall = fx.overall ? season.playerOverall + fx.overall : season.playerOverall;

  const newEvents = season.events.map((e, i) =>
    i === evIdx ? { ...e, chosenId: choiceId, outcomeText: choice.outcome } : e,
  );

  // Advance phase when all events in current phase are done
  const phaseOrder: Array<BDSeason['phase']> = ['pre_season', 'first_half', 'january', 'second_half', 'run_in'];
  const curPhaseIdx = phaseOrder.indexOf(season.phase as typeof phaseOrder[number]);
  const phaseEvents = newEvents.filter(e => e.phase === season.phase);
  const phaseDone = phaseEvents.every(e => e.chosenId);
  let newPhase: BDSeason['phase'] = season.phase;
  if (phaseDone && curPhaseIdx >= 0 && curPhaseIdx < phaseOrder.length - 1) {
    newPhase = phaseOrder[curPhaseIdx + 1];
  }

  return { ...season, playerOverall: updatedOverall, events: newEvents, eventStats: es, attributes: attrs, phase: newPhase };
}

// --- Finalize season (after all events — simulate trophies + generate ceremony) ---
export function finalizeSeason(player: BDPlayer, season: BDSeason): BDSeason {
  const rng = mulberry32(hashSeed(`trophies_${player.name}_${season.year}`));
  const trophies = simulateTrophies(
    season.club, season.inCL, season.inEL,
    season.attributes.fitness, season.attributes.morale, rng,
  );
  const combined = addStats(season.baseStats, season.eventStats);
  const ceremony = generateCeremony(player, { ...season, trophies }, combined);
  return { ...season, trophies, phase: 'ceremony', ceremony };
}

// --- Player development between seasons ---
export function developPlayer(player: BDPlayer, season: BDSeason): BDPlayer {
  const seed = hashSeed(`dev_${player.name}_${season.year}`);
  const rng = mulberry32(seed);
  const age = player.age + 1;
  const gap = player.potential - player.overall;

  let delta = 0;
  if (age < 21) delta = Math.round(gap * 0.35 + rng() * 2);
  else if (age < 24) delta = Math.round(gap * 0.22 + rng());
  else if (age < 27) delta = Math.round(gap * 0.1);
  else if (age < 30) delta = 0;
  else if (age < 33) delta = -1;
  else delta = -2;

  const newOvr = clamp(player.overall + delta, 40, player.potential);
  return { ...player, age, overall: newOvr };
}
