import type { Archetype } from "../types";
import type { Template } from "./index";

/**
 * FOOTBALL TWITTER: EVERY INVENTED ACCOUNT'S OWN LINES (Leo, 31 Oct 2026,
 * switch part "footballTwitter"; accounts in ../twitter/personas.ts).
 *
 * Kept apart from the game's own library (templates/index.ts ALL): with the
 * switch off nothing here is ever read, so the feed is exactly as before.
 *
 * Slots are the event's facts (detect/kit.ts base()) plus a few the persona
 * pass adds (twitter/derive.ts): {catch} the account's catchphrase, {clubS}
 * {oppS} {homeS} {awayS} short club names, {xgUs} {xgThem} made-up xG,
 * {oddsWas} {oddsNow}, {pctA}…{pctD} poll shares, {tablePos}.
 * A template whose slots the event cannot fill is never chosen, so no line
 * here can print a hole. "\n" breaks a line, as the real app does.
 *
 * Banter about football only: nothing about anyone's looks, family, race,
 * religion or anything else that is not football.
 */

type Spec = Omit<Template, "id" | "archetype" | "persona">;

function bank(persona: string, archetype: Archetype, specs: Spec[], part = ""): Template[] {
  return specs.map((s, i) => ({ ...s, id: `ft-${persona}-${part}${i + 1}`, archetype, persona }));
}

const RESULT = ["win", "draw", "loss", "rout", "hammered"];
const YOUR_SHAME = ["anonymous", "poor-showing", "hooked", "out-of-form", "drought", "cheeky-miss"];
const CLUB_BAD = ["loss", "hammered", "collapse", "embarrassed", "losing-run", "derby-loss", "lost-top", "into-the-drop"];

export const TWITTER_TEMPLATES: Template[] = [
  // ── The transfer insider ──────────────────────────────────────────────
  ...bank("insider", "insider", [
    { events: ["transfer-done"], requires: ["player", "to", "feeText"], weight: 4,
      body: "🔴 {player} to {to}, {catch}\n\nFee {feeText} including add-ons. Medical completed, contract signed. Club statement soon." },
    { events: ["transfer-done"], requires: ["player", "to"], weight: 3,
      body: "{player} has said yes to {to}. Verbal agreement in place, documents being prepared. Next step: medical. 🤝" },
    { events: ["unveiling"], requires: ["player", "to"], weight: 2,
      body: "Official announcement of {player} at {to} expected in the next hours. {catch}" },
    { events: ["contract-signed"], requires: ["player", "club", "seasons"], weight: 3,
      body: "Exclusive: {player} signs a new contract at {club} for {seasons} more seasons. Pay rise included. {catch}" },
    { events: ["manager-sacked"], requires: ["club", "manager"], weight: 3,
      body: "Understand {club} have decided to part ways with {manager}. Decision made this morning. Board already in talks with replacements." },
    { events: ["manager-in"], requires: ["club", "manager"], weight: 3,
      body: "{manager} is the new {club} manager. Agreement done on all terms, contract ready. {catch}" },
    { tags: ["goal", "form"], subject: "you", requires: ["player", "seasonTotal"], weight: 2,
      body: "Understand several clubs are monitoring {player}'s situation after {seasonTotal} goals this season. Nothing advanced yet, {clubS} completely relaxed. 👀" },
    { events: ["award-won", "ballon-dor"], requires: ["player"], weight: 2,
      body: "{player}'s camp already receiving calls from top clubs after this. No talks yet. More to follow." },
    { events: ["wonderkid-hype", "regen-watch"], requires: ["player", "club"], weight: 2,
      body: "{club} have rejected first approach for {player}. They consider him untouchable. Talks expected to continue. 🔒" },
  ]),

  // ── The TV channel's breaking-news desk ───────────────────────────────
  ...bank("breaking", "aggregator", [
    { events: ["transfer-done"], requires: ["player", "from", "to", "feeText"], weight: 4,
      body: "BREAKING: {player} has completed a {feeText} move from {from} to {to} 🚨\n\nMore on SportsDesk News 📺" },
    { events: ["manager-sacked"], requires: ["club", "manager"], weight: 4,
      body: "BREAKING: {club} have sacked manager {manager}. 🚨" },
    { events: ["manager-in"], requires: ["club", "manager"], weight: 3,
      body: "{club} confirm {manager} as their new head coach." },
    { events: ["champions"], requires: ["club", "competition"], weight: 4,
      body: "{club|caps} ARE {competition|caps} CHAMPIONS! 🏆" },
    { events: ["relegated"], requires: ["club", "competition"], weight: 3,
      body: "{club} have been relegated from the {competition}." },
    { events: ["trophy"], requires: ["club", "competition"], weight: 4,
      body: "{club} win the {competition}! 🏆" },
    { events: ["hat-trick", "four-goals", "five-goals"], subject: "you", result: "win", requires: ["player", "clubS", "oppS", "score"], weight: 3,
      body: "{player} scores a hat-trick as {clubS} beat {oppS} {score} ⚽️⚽️⚽️" },
    { events: ["late-winner"], subject: "you", requires: ["short", "minute", "clubS"], weight: 3,
      body: "🚨 {minute}' — {short} wins it for {clubS}! 🚨" },
    { events: ["went-top"], requires: ["clubS", "competition"], weight: 3,
      body: "{clubS} go top of the {competition} 🔝" },
    { events: ["ballon-dor"], requires: ["player"], weight: 4,
      body: "BREAKING: {player} has won the Ballon d'Or 🏆✨" },
    { events: ["award-won"], requires: ["player", "award"], weight: 3,
      body: "{player} has won the {award} 🏅" },
    { events: ["first-call-up"], requires: ["player", "nation"], weight: 3,
      body: "{player} has received his first {nation} call-up 📋" },
    { events: ["rout", "hammered"], requires: ["homeS", "awayS"], weight: 1,
      body: "FULL-TIME: {homeS} {hs}-{as} {awayS}. What a result. 😮" },
  ]),

  // ── The live-scores app ───────────────────────────────────────────────
  ...bank("scores", "aggregator", [
    { events: RESULT, requires: ["homeS", "awayS", "competition"], weight: 4,
      body: "FT | {homeS} {hs}-{as} {awayS}\n\n{competition} ⏱️" },
    { events: RESULT, requires: ["homeClub", "awayClub"], weight: 3,
      body: "FT: {homeClub} {hs}-{as} {awayClub}" },
    { events: ["rout"], requires: ["homeS", "awayS"], weight: 3,
      body: "FT | {homeS} {hs}-{as} {awayS} 🤯\n\nA statement." },
    { events: ["winner", "late-winner"], subject: "you", requires: ["homeS", "awayS", "short", "minute"], weight: 4,
      body: "FT | {homeS} {hs}-{as} {awayS}\n\n⚽️ {short} {minute}' (the winner)" },
    { events: ["hat-trick"], subject: "you", requires: ["homeS", "awayS", "short", "minutes"], weight: 4,
      body: "FT | {homeS} {hs}-{as} {awayS}\n\n⚽️⚽️⚽️ {short} ({minutes})" },
    { events: ["brace"], subject: "you", requires: ["homeS", "awayS", "short", "minutes"], weight: 3,
      body: "FT | {homeS} {hs}-{as} {awayS}\n\n⚽️⚽️ {short} ({minutes})" },
    { events: ["hat-trick", "four-goals", "five-goals"], subject: "club", requires: ["player", "clubS"], weight: 3,
      body: "🎩 {player} hat-trick for {clubS}. Match ball secured." },
    { events: ["comeback"], requires: ["homeS", "awayS"], weight: 3,
      body: "FT | {homeS} {hs}-{as} {awayS}\n\nComeback complete 🔄" },
    { events: ["thriller"], requires: ["homeS", "awayS", "total"], weight: 3,
      body: "FT | {homeS} {hs}-{as} {awayS}\n\n{total} goals. Breathe. 😮‍💨" },
    { events: ["went-top"], requires: ["clubS", "competition"], weight: 2,
      body: "📊 {clubS} are top of the {competition}." },
    { events: ["clean-sheet"], requires: ["homeS", "awayS"], weight: 1,
      body: "FT | {homeS} {hs}-{as} {awayS}\n\n🧤 Clean sheet." },
  ]),

  // ── The copy-paste news page ──────────────────────────────────────────
  ...bank("aggregator", "aggregator", [
    { events: ["transfer-done"], requires: ["player", "to", "feeText"], weight: 4,
      body: "🚨🚨| {player} to {to} is DONE. {feeText}. (via @DiegoFerranteHQ)" },
    { tags: ["goal"], subject: "you", requires: ["player", "seasonTotal"], weight: 3,
      body: "🚨| {player} now has {seasonTotal} goals this season.\n\nGenerational. 🔥" },
    { events: ["manager-sacked"], requires: ["club", "manager"], weight: 3,
      body: "🚨| {manager} SACKED by {club}.\n\nThoughts? 👇" },
    { events: ["award-won"], requires: ["player", "award"], weight: 3,
      body: "🚨| {player} wins {award}.\n\nDeserved? 👇" },
    { events: ["wonderkid-hype"], requires: ["player", "club"], weight: 2,
      body: "👀| Big clubs are watching {club}'s {player}. Huge." },
    { events: ["hammered", "collapse"], requires: ["clubS", "score"], weight: 2,
      body: "😳| {clubS} lose {score}. Crisis? 👇" },
  ]),

  // ── The journalist who quote-posts ────────────────────────────────────
  ...bank("journalist", "broadsheet", [
    { events: ["manager-sacked"], requires: ["club", "manager"], weight: 3,
      body: "{club} sack {manager}. Not a surprise to anyone inside the building. The question now is whether the next appointment is a coach or a fire extinguisher." },
    { events: ["title-race", "went-top"], requires: ["clubS"], weight: 2,
      body: "{clubS} are serious. Said it in August, saying it again now." },
    { events: ["relegation-fight", "into-the-drop"], requires: ["clubS"], weight: 2,
      body: "There is a calm at {clubS} that does not match the table. That can be leadership. It can also be denial." },
    { events: ["masterclass", "star-man", "hat-trick"], subject: "you", requires: ["player"], weight: 3,
      body: "{player} is the most interesting young footballer in the country, and it isn't especially close." },
    { events: ["transfer-done"], requires: ["player", "to", "feeText"], weight: 3,
      body: "{to} have paid {feeText} for {player}. On this season's evidence, that may look cheap by Christmas." },
    { events: ["hammered", "losing-run"], requires: ["clubS"], weight: 2,
      body: "{clubS}. The worrying part wasn't the score, it was how little anyone seemed surprised by it." },
    { events: ["champions"], requires: ["club"], weight: 3,
      body: "{club} are champions. A team built carefully, coached patiently, and finished by a few players who simply refused to lose." },
  ]),

  // ── The tier-5 ITK ────────────────────────────────────────────────────
  ...bank("itk", "insider", [
    { tags: ["goal", "form"], subject: "you", requires: ["clubS", "short"], weight: 3,
      body: "🚨 EXCLUSIVE: Sources tell me four big clubs had scouts at the {clubS} game for {short}. One of them is a 'huge' club. {catch}" },
    { events: CLUB_BAD, requires: ["clubS"], weight: 3,
      body: "Hearing whispers about the mood in the {clubS} dressing room after today. Not good. More to come 🤐" },
    { events: ["manager-sacked"], requires: ["manager"], weight: 3,
      body: "Told you all three weeks ago. {manager} out. Who's laughing now? {catch}" },
    { events: ["transfer-done"], requires: ["player", "to"], weight: 3,
      body: "As I said in my exclusive two months ago 🤫\n\n{player} to {to}. Tier 1 for a reason." },
    { events: ["win", "rout"], requires: ["clubS", "score"], weight: 2,
      body: "BREAKING 🚨: {clubS} players 'buzzing' in the dressing room after the {score}. Source: trust me" },
    { tags: ["table", "title"], requires: ["clubS"], weight: 1,
      body: "Big news coming for {clubS} fans tomorrow. That's all I can say for now 🔜" },
    { events: ["contract-signed"], requires: ["short", "club"], weight: 2,
      body: "Hearing {short}'s new {club} deal has a release clause. Big one. Very big. 👀" },
  ]),

  // ── The agent ─────────────────────────────────────────────────────────
  ...bank("agent", "insider", [
    { events: ["transfer-done"], subject: "you", requires: ["short"], weight: 3, body: "New chapter. Proud of you, {short}. 🤝" },
    { events: ["contract-signed"], subject: "you", requires: ["seasons"], weight: 3, body: "Signed. {seasons} more years. We trust the project. 📝" },
    { events: ["award-won", "ballon-dor"], subject: "you", weight: 3, body: "{catch} 🙏" },
    { events: ["ballon-dor-missed"], subject: "you", weight: 3, body: "Some people should look at their vote again. We move. 🙏" },
    { events: YOUR_SHAME, subject: "you", weight: 2, body: "Noise is noise. My client knows his value. {catch}" },
    { events: ["hat-trick", "four-goals", "five-goals"], subject: "you", weight: 2, body: "Is anyone still asking about the price? 📝" },
  ]),

  // ── The gossip page ───────────────────────────────────────────────────
  ...bank("gossip", "tabloid", [
    { events: ["casino-spotted", "casino-won"], subject: "you", requires: ["short"], weight: 4, body: "spotted 👀 {short} looking VERY pleased with himself at a certain casino last night 🍿" },
    { events: ["casino-lost", "casino-expose", "casino-ban"], subject: "you", requires: ["short"], weight: 4, body: "the tea is HOT 🍿 {short}'s night at the tables did NOT go to plan" },
    { events: ["transfer-done"], requires: ["short", "to"], weight: 2, body: "we're not saying anything… but {short}'s new house near {to}'s training ground is apparently ENORMOUS 👀" },
    { events: ["award-won", "ballon-dor"], subject: "you", requires: ["short"], weight: 2, body: "{short} at the awards tonight. the suit?? 💅 rate it 1-10 👇" },
    { events: ["manager-sacked"], requires: ["manager"], weight: 2, body: "{manager} seen leaving the training ground with a box of his stuff 📦 the end of an era 🍿" },
  ]),

  // ── The shouting fan channel ──────────────────────────────────────────
  ...bank("ranter", "pundit", [
    { events: ["loss", "hammered", "collapse", "embarrassed"], requires: ["clubS", "us", "them"], weight: 4,
      body: "{clubS} {us}-{them}. I'M NOT HAVING IT. That is NOT good enough. STREAM IS LIVE NOW 📺" },
    { events: ["collapse", "lost-top"], requires: ["clubS"], weight: 3,
      body: "BOTTLE JOB. {clubS|caps} HAVE BOTTLED IT AGAIN. I said it. I SAID IT." },
    { events: ["manager-sacked"], requires: ["manager"], weight: 3,
      body: "{manager|caps} GONE. FINALLY. I've been saying it for WEEKS. Where's my apology??" },
    { events: ["win", "rout"], requires: ["clubS", "us", "them"], weight: 3,
      body: "{clubS} {us}-{them}!! WHAT A PERFORMANCE. I TOLD YOU. I TOLD ALL OF YOU." },
    { tags: ["goal"], subject: "you", requires: ["short"], weight: 3,
      body: "{short|caps}. {short|caps}. {short|caps}. THAT is a FOOTBALLER. 📺" },
    { events: ["derby-win"], requires: ["clubS"], weight: 3,
      body: "WHAT a derby. {clubS|caps} own this fixture now. OWN IT." },
    { events: ["hooked"], subject: "you", requires: ["short", "manager"], weight: 3,
      body: "Why would you take {short} OFF?? WHY?? {manager|caps}, WAKE UP!!" },
    { events: ["anonymous", "poor-showing"], subject: "you", requires: ["short"], weight: 3,
      body: "{short} was a PASSENGER today. A PASSENGER. Wake UP, lad." },
    { events: ["title-race"], requires: ["clubS"], weight: 2,
      body: "Can {clubS} win the league?? FULL BREAKDOWN on the channel NOW. Don't @ me." },
  ]),

  // ── The ratio / hater page ────────────────────────────────────────────
  ...bank("ratio", "meme", [
    { events: ["loss", "derby-loss", "embarrassed"], requires: ["clubS", "oppS"], weight: 3, body: "{clubS} fans after {oppS} did that to them: 🤡" },
    { events: ["loss", "hammered", "embarrassed"], requires: ["clubS", "score"], weight: 3, body: "ratio + L + {score} + {clubS} fraud watch 🚨" },
    { events: ["hammered"], requires: ["clubS", "them"], weight: 3, body: "{clubS} conceding {them} 😭😭 the disrespect" },
    { events: ["collapse"], requires: ["clubS"], weight: 4, body: "{clubS} were WINNING btw 😭💀" },
    { events: ["relegated"], requires: ["clubS"], weight: 4, body: "{clubS} relegated 💀 hold this L" },
    { events: ["anonymous", "poor-showing"], subject: "you", requires: ["short", "rating"], weight: 4,
      body: "{short} today:\n\n0 goals\n0 assists\n{rating} rating\n\n'generational' btw 😭" },
    { events: ["cheeky-miss"], subject: "you", requires: ["short"], weight: 4, body: "{short} tried to be cute and got COOKED 💀" },
    { events: ["drought"], subject: "you", requires: ["short", "matches"], weight: 4, body: "{short} hasn't scored in {matches} games 😭 fraud watch is LIVE 🚨" },
    { events: ["lost-top"], requires: ["clubS"], weight: 3, body: "{clubS} top of the league for a week 😭 we told you" },
    { events: ["losing-run"], requires: ["clubS", "matches"], weight: 3, body: "{clubS} have lost {matches} in a row. who's telling them? 🫵" },
    { events: ["into-the-drop"], requires: ["clubS"], weight: 3, body: "{clubS} in the relegation zone. cooked. absolutely cooked 🍳" },
    { events: ["hat-trick", "four-goals", "five-goals"], subject: "you", requires: ["short"], weight: 1,
      body: "ok {short} is actually him. we'll allow it this once 😤" },
  ]),

  // ── The meme page ─────────────────────────────────────────────────────
  ...bank("meme", "meme", [
    { tags: ["goal"], subject: "you", requires: ["short"], weight: 3,
      body: "me after {short} scores one goal:\n\n\"best player in the world, no debate\" 🗣️" },
    { tags: ["goal"], subject: "you", requires: ["oppS", "short"], weight: 3,
      body: "{oppS} defenders watching {short} run at them:\n\n🧍🧍🧍🧍" },
    { events: ["loss", "hammered"], requires: ["clubS"], weight: 2, body: "{clubS} fans walking out at full time 🚶‍♂️🚶‍♂️🚶‍♂️🚶‍♂️" },
    { events: ["hammered"], requires: ["clubS"], weight: 3, body: "{clubS} defence today:\n\n🚪 open\n🚪 open\n🚪 open\n🚪 open" },
    { events: ["late-winner"], subject: "you", requires: ["short", "minute"], weight: 3, body: "the {minute}' {short} winner had me on the FLOOR 😭 absolute cinema" },
    { events: ["manager-sacked"], requires: ["manager"], weight: 2, body: "{manager} reading the club statement like: 🧍" },
    { events: ["draw"], requires: ["clubS", "score"], weight: 3,
      body: "tag yourself, {clubS} fans after that {score}:\n\n😐 'a point is a point'\n😤 'we should've won that'\n🧘 'trust the process'\n🗑️ 'sell the whole team'" },
    { events: ["derby-win", "derby-loss"], requires: ["clubS"], weight: 2, body: "the {clubS} group chat right now 📈📉" },
    { events: ["comeback"], requires: ["clubS"], weight: 3, body: "{clubS} fans at half time vs {clubS} fans at full time 😭" },
    { events: ["relegated"], requires: ["clubS"], weight: 2, body: "pour one out for {clubS} 🥲" },
    { events: ["screamer"], subject: "you", requires: ["short"], weight: 3, body: "{short} hitting that: 😤\nthe ball: 🚀\nthe keeper: 🧍\nme: 😭" },
    { events: ["thriller"], requires: ["homeS", "awayS"], weight: 2, body: "{homeS} v {awayS} was absolute cinema 🎬 this sport man" },
  ]),

  // ── The ball-knowledge quiz page ──────────────────────────────────────
  ...bank("quiz", "meme", [
    { tags: ["goal"], subject: "you", requires: ["short"], weight: 3, body: "Name a better young player than {short} right now.\n\nI'll wait. 🧠" },
    { events: ["goal-milestone"], requires: ["short", "total"], weight: 3, body: "{short} has {total} career goals. How many did you guess? 👇" },
    { tags: ["goal", "award"], subject: "you", requires: ["short", "oppS"], weight: 3, graphic: "poll",
      poll: { q: "Rate {short} vs {oppS} 👇", options: ["10/10 HIM 🐐", "8/10 solid", "6/10 meh", "Fraud 🗑️"] },
      body: "Rate {short}'s game vs {oppS} 👇 {catch}" },
    { tags: ["goal"], subject: "you", requires: ["player"], weight: 2, body: "Ball knowledge check 🧠 How many goals has {player} scored this season?\n\nWrong answers only 👇" },
    { events: ["title-race", "went-top"], requires: ["clubS", "competition"], weight: 3, graphic: "poll",
      poll: { q: "Who wins the {competition}?", options: ["{clubS}", "Someone else", "Too early to say"] },
      body: "Who wins the {competition}? 👇" },
    { tags: ["goal"], subject: "you", requires: ["clubS", "short"], weight: 2, body: "Build your best {clubS} XI. Only rule: {short} starts.\n\nQuote with yours 👇" },
    { events: ["derby-win", "derby-draw", "derby-loss"], requires: ["clubS", "oppS"], weight: 2, graphic: "poll",
      poll: { q: "Bigger club: {clubS} or {oppS}?", options: ["{clubS}", "{oppS}", "Neither 😭"] },
      body: "Settle this once and for all 👇" },
    { tags: ["award", "record"], subject: "you", requires: ["short"], weight: 2, body: "{catch}\n\nOne word to describe {short}'s season 👇" },
  ]),

  // ── The 'he's HIM' hype page ──────────────────────────────────────────
  ...bank("hype", "meme", [
    { events: ["hat-trick", "four-goals", "five-goals"], subject: "you", requires: ["short"], weight: 4, body: "{short|caps} HAT-TRICK. HE'S HIM 🐐" },
    { tags: ["goal"], subject: "you", requires: ["short"], weight: 3, body: "{short} is HIM. that's the tweet." },
    { events: ["screamer"], subject: "you", requires: ["short", "distance"], weight: 4, body: "{short} from {distance} yards?? LEVELS 🥶" },
    { events: ["red-hot", "scoring-run", "purple-patch"], subject: "you", requires: ["short"], weight: 3, body: "{short} lately: 🔥🔥🔥🔥🔥\n\ndifferent breed." },
    { events: ["award-won"], subject: "you", requires: ["short", "award"], weight: 3, body: "{short}, {award}. we've been saying it for months 👑" },
    { events: ["hat-trick", "four-goals"], subject: "club", requires: ["player", "clubS"], weight: 2, body: "{player} with a hat-trick for {clubS}. different breed 🥶" },
    { events: ["masterclass"], subject: "you", requires: ["short", "rating"], weight: 3, body: "{rating} rating. {short} is not human 👽" },
    { events: ["goal-milestone"], subject: "you", requires: ["short", "total"], weight: 3, body: "{total} career goals. {short} is HIM. say it back." },
    { events: ["ballon-dor"], subject: "you", requires: ["short"], weight: 4, body: "BALLON D'OR WINNER {short|caps}. HE'S HIM. HE'S ALWAYS BEEN HIM 🐐👑" },
  ]),

  // ── The TikTok edits page (video posts) ───────────────────────────────
  ...bank("edits", "meme", [
    { tags: ["goal"], subject: "you", requires: ["short", "oppS"], weight: 4, graphic: "goalVideo", body: "{short} vs {oppS} 🎧 sound on" },
    { tags: ["goal"], subject: "you", requires: ["short"], weight: 3, graphic: "goalVideo", body: "edit took 6 hours. worth it. {short} 🥶 #fyp" },
    { tags: ["goal"], subject: "you", requires: ["short"], weight: 3, graphic: "goalVideo", body: "the slow-mo on this {short} finish 😮‍💨 #football" },
    { tags: ["goal"], subject: "you", requires: ["short"], weight: 2, body: "{short} aura edit dropping tonight 📈 who wants it" },
  ]),

  // ── The goal-clips account (video posts) ──────────────────────────────
  ...bank("clips", "aggregator", [
    { tags: ["goal"], subject: "you", requires: ["short"], weight: 3, graphic: "goalVideo", body: "WHAT A GOAL FROM {short|caps} 🤯" },
    { events: ["screamer"], subject: "you", requires: ["short", "distance"], weight: 4, graphic: "goalVideo", body: "{short} from {distance} yards. Watch this. 🚀" },
    { events: ["late-winner"], subject: "you", requires: ["short", "minute"], weight: 4, graphic: "goalVideo", body: "{minute}' — {short} WINS IT. 🎥" },
    { events: ["special-goal"], subject: "you", requires: ["short"], weight: 3, graphic: "goalVideo", body: "the finish from {short} 🤯🎥" },
  ]),

  // ── Your club's fan channel ───────────────────────────────────────────
  ...bank("fanTV", "fan", [
    { events: ["win", "rout"], requires: ["clubS", "oppS", "us", "them"], weight: 4, body: "{clubS} {us}-{them} {oppS}!!! FULL REACTION LIVE NOW 📺🔥" },
    { events: ["loss", "hammered"], requires: ["clubS", "oppS", "us", "them"], weight: 4, body: "{clubS} {us}-{them} {oppS}. FANS ARE FUMING. LIVE REACTION NOW 😤" },
    { events: ["draw"], requires: ["score"], weight: 3, body: "{score} draw. Is that good enough?? Have YOUR say LIVE 📺" },
    { tags: ["goal"], subject: "you", requires: ["short"], weight: 3, body: "{short|caps}!!!! WHAT A PLAYER. Fans react LIVE 📺" },
    { events: ["manager-sacked"], requires: ["manager"], weight: 3, body: "{manager} GONE!! Was it the right call?? Fans have their say LIVE 📺" },
    { events: ["derby-win"], requires: ["clubS", "oppS", "us", "them"], weight: 4, body: "DERBY DAY DELIGHT!! {clubS} {us}-{them} {oppS}. The fans are going MENTAL 📺" },
    { events: ["derby-loss"], requires: ["clubS", "oppS"], weight: 4, body: "Losing to {oppS}. The fans are DEVASTATED. Watch the reaction 📺" },
  ]),

  // ── The away-days fan ─────────────────────────────────────────────────
  ...bank("womenFan", "fan", [
    { events: ["win", "rout"], requires: ["score", "short"], weight: 3, body: "{score} and {short} was unreal. sore throat tomorrow and i do not care 🧣" },
    { events: ["loss"], requires: ["score"], weight: 3, body: "long way home after that {score}. still proud of the away end tho 💙" },
    { tags: ["goal"], subject: "you", requires: ["short"], weight: 3, body: "{short} you are a WONDERFUL footballer" },
    { events: ["derby-win"], requires: ["oppS"], weight: 3, body: "{oppS} fans very quiet on here suddenly 🙂" },
    { tags: ["trophy"], weight: 3, body: "i was there. i will be telling my grandkids i was there 🏆" },
    { events: ["debut", "club-debut"], subject: "you", requires: ["short"], weight: 3, body: "{short}'s debut and i was there. remember this tweet" },
    { events: ["hammered"], requires: ["them"], weight: 3, body: "{them} conceded. 20 years doing this and i've never wanted a pie less" },
  ]),

  // ── The woman analyst fan ─────────────────────────────────────────────
  ...bank("readsGame", "pundit", [
    { tags: ["goal"], subject: "you", requires: ["short"], weight: 3, body: "{short}'s movement before the goal is the bit nobody's clipping. Watch it back. He's on the defender's blind side for two full seconds." },
    { events: ["masterclass", "star-man"], subject: "you", requires: ["short", "rating"], weight: 3, body: "{short} today: always open, always scanning, always one touch ahead. That's a {rating} and honestly it was underrated." },
    { events: ["loss", "hammered"], requires: ["clubS"], weight: 3, body: "Everyone will talk about the scoreline. The real {clubS} problem was the gap between midfield and defence. Watch it back." },
    { events: ["manager-sacked"], requires: ["manager"], weight: 2, body: "{manager} didn't fail on tactics. He failed on recruitment he didn't control. I said what I said." },
    { events: ["in-form", "red-hot"], subject: "you", requires: ["short"], weight: 3, body: "Nobody's talking about this: {short}'s runs off the ball are way up. The goals are a consequence, not a fluke." },
  ]),

  // ── The kid's account ─────────────────────────────────────────────────
  ...bank("kidFan", "fan", [
    { tags: ["goal"], subject: "you", requires: ["short"], weight: 3, body: "{short|caps} IS THE BEST PLAYER EVER!!!! ⚽️⚽️" },
    { events: ["hat-trick", "four-goals", "five-goals"], subject: "you", weight: 4, body: "HAT TRICK!!!! my dad says hes going to play for england one day 🤩" },
    { events: ["win", "rout"], requires: ["score"], weight: 3, body: "WE WON {score}!!! best day ever 😁" },
    { tags: ["trophy"], weight: 4, body: "WE WON THE CUP!!!!! im never going to sleep tonight 🏆🏆" },
    { events: ["loss"], weight: 2, body: "we lost :( my dad says we will win next week" },
    { events: ["debut", "club-debut"], subject: "you", requires: ["short"], weight: 3, body: "{short} played his first game!!! im getting his shirt for christmas" },
  ]),

  // ── The rival banter account ──────────────────────────────────────────
  ...bank("rivalBanter", "rivalFan", [
    { events: ["loss", "embarrassed"], requires: ["clubS", "us", "them"], weight: 3, body: "{clubS} losing {us}-{them} 😂 same old {clubS}" },
    { events: ["derby-loss"], requires: ["clubS"], weight: 4, body: "{clubS} in the derby 🤡 never change lads never change" },
    { events: ["hammered"], requires: ["them"], weight: 4, body: "{them} conceded 😂😂 stay humble lads" },
    { events: ["collapse"], requires: ["clubS"], weight: 4, body: "{clubS} bottling a lead. who could've seen that coming 🤡" },
    { events: ["anonymous", "poor-showing"], subject: "you", requires: ["short"], weight: 3, body: "where was {short} today 😂 rent free in our heads, invisible on the pitch" },
    { events: ["lost-top"], requires: ["clubS"], weight: 3, body: "top for a week 😭 enjoy mid-table lads" },
    { tags: ["goal"], subject: "you", requires: ["short"], weight: 1, body: "{short} scores once and that lot think he's the second coming 🙄" },
    { events: ["losing-run"], requires: ["matches"], weight: 3, body: "{matches} defeats on the bounce 😂 sing when you're winning? you're not" },
    { events: ["into-the-drop", "relegated"], requires: ["clubS"], weight: 4, body: "{clubS} going down and we're all just watching 🍿🍿" },
  ]),

  // ── The neutral ───────────────────────────────────────────────────────
  ...bank("neutral", "fan", [
    { events: ["thriller"], requires: ["homeS", "awayS"], weight: 3, body: "{homeS} {hs}-{as} {awayS}. no dog in this fight. absolute scenes 🍿" },
    { events: ["rout"], requires: ["homeS", "awayS", "oppS"], weight: 3, body: "{homeS} {hs}-{as} {awayS} 😂 someone check on {oppS} fans" },
    { events: ["collapse"], requires: ["clubS"], weight: 3, body: "{clubS} somehow didn't win that. football is back" },
    { events: ["comeback"], requires: ["clubS", "deficit"], weight: 3, body: "{clubS} coming back from {deficit} down. just here for the chaos 🍿" },
    { events: ["went-top"], requires: ["clubS"], weight: 2, body: "{clubS} top of the league. did not have that on my bingo card 🙃" },
    { events: ["relegated"], requires: ["clubS"], weight: 2, body: "genuinely sad for {clubS} fans. genuinely." },
  ]),

  // ── The groundhopper ──────────────────────────────────────────────────
  ...bank("groundhopper", "fan", [
    { events: RESULT, requires: ["homeS", "awayS"], weight: 1, body: "{homeS} {hs}-{as} {awayS}. ground number {groundNo}. pie 7/10, atmosphere 8/10 🥧" },
    { tags: ["cup"], requires: ["homeS", "awayS"], weight: 3, body: "proper cup football this. {homeS} {hs}-{as} {awayS} 🏟️ magic of the cup" },
    { events: ["thriller"], requires: ["total"], weight: 3, body: "{total} goals, a pie and a hot drink. this is why i do it ☕" },
  ]),

  // ── The xG nerd ───────────────────────────────────────────────────────
  ...bank("xg", "stats", [
    { events: ["win", "loss", "draw"], requires: ["clubS", "oppS", "us", "them", "xgUs", "xgThem"], weight: 3,
      body: "{clubS} {us}-{them} {oppS}\n\nxG: {xgUs} – {xgThem}\n\nThe scoreline flatters someone. You know who 📈" },
    { tags: ["goal"], subject: "you", requires: ["short", "seasonTotal", "xgSeason"], weight: 3,
      body: "{short} this season: {seasonTotal} goals from {xgSeason} xG. Finishing is a skill, actually." },
    { events: ["drought"], subject: "you", requires: ["short", "matches"], weight: 3,
      body: "{short} hasn't scored in {matches} but the chances are still coming. Regression is coming. Relax." },
    { events: ["red-hot", "purple-patch"], subject: "you", requires: ["short"], weight: 3,
      body: "{short} is running miles above his xG. Either he's elite or regression is coming. (It might be both.)" },
    { events: ["clean-sheet"], requires: ["clubS", "xgThem"], weight: 2,
      body: "{clubS} clean sheet, but they gave up {xgThem} xG. The keeper bailed them out." },
  ]),

  // ── The facts account ─────────────────────────────────────────────────
  ...bank("facts", "stats", [
    { events: ["goal-milestone"], requires: ["player", "total", "apps"], weight: 4, body: "Just a reminder that {player} has {total} career goals in {apps} appearances. 🤯" },
    { events: ["scoring-run"], subject: "you", requires: ["short", "matches"], weight: 4, body: "{short} has now scored in {matches} games in a row. 📈" },
    { events: ["unbeaten-run"], requires: ["clubS", "matches"], weight: 3, body: "{clubS} are now unbeaten in {matches} games." },
    { events: ["winning-run"], requires: ["clubS", "matches"], weight: 3, body: "{clubS} have won {matches} in a row. 📈" },
    { events: ["first-career-goal"], requires: ["player", "apps"], weight: 3, body: "Fact: {player} needed {apps} appearances to score his first senior goal." },
    { events: ["hat-trick", "four-goals", "five-goals"], subject: "you", requires: ["player", "seasonTotal"], weight: 3, body: "{player} is on {seasonTotal} goals for the season after today's hat-trick. 📅" },
  ]),

  // ── The fantasy football account ──────────────────────────────────────
  ...bank("fantasy", "stats", [
    { tags: ["goal"], subject: "you", requires: ["short"], weight: 3, body: "{short} returns AGAIN. if you don't own him, what are you doing ©️" },
    { events: ["hat-trick", "four-goals", "five-goals"], subject: "you", requires: ["short"], weight: 4, body: "anyone who captained {short} this week: enjoy your green arrow 📈🟢" },
    { events: ["anonymous", "poor-showing"], subject: "you", requires: ["short", "rating"], weight: 3, body: "captained {short}. blanked. {rating}. i want to be alone" },
    { events: ["clean-sheet"], requires: ["clubS"], weight: 2, body: "{clubS} defenders = cheapest points in the game. differential alert 🟢" },
    { events: ["in-form", "red-hot"], subject: "you", requires: ["short"], weight: 3, body: "price rise incoming 📈 {short} owners, we eat" },
    { events: ["goal-and-assist", "creating"], subject: "you", requires: ["short"], weight: 3, body: "{short} with the attacking returns again. essential. not optional." },
  ]),

  // ── The hot-take account ──────────────────────────────────────────────
  ...bank("takes", "pundit", [
    { tags: ["goal"], subject: "you", requires: ["short"], weight: 3, body: "{catch} {short} is already better than half the strikers in this league." },
    { events: ["hat-trick", "four-goals", "five-goals"], subject: "you", requires: ["short", "competition"], weight: 3, body: "Hot take: {short} is the best player in the {competition} and it isn't close." },
    { events: ["loss", "hammered"], requires: ["clubS"], weight: 3, body: "Unpopular opinion: {clubS} fans' expectations were never realistic. This is who they are." },
    { events: ["manager-sacked"], requires: ["manager"], weight: 3, body: "Hot take: sacking {manager} won't fix anything. The problem is upstairs." },
    { events: ["anonymous", "poor-showing", "hooked"], subject: "you", requires: ["short"], weight: 3, body: "Unpopular opinion: {short} is overrated and today proved it. Say it with your chest." },
    { events: ["award-won"], subject: "you", requires: ["short", "award"], weight: 2, body: "Unpopular opinion: {short} didn't deserve the {award}." },
  ]),

  // ── The tactics thread account ────────────────────────────────────────
  ...bank("tactics", "pundit", [
    { tags: ["goal"], subject: "you", requires: ["short", "oppS"], weight: 3, body: "🧵 Thread: how {short} kept finding space against {oppS}. Watch the movement here. 1/7" },
    { events: ["loss", "hammered"], requires: ["clubS", "score"], weight: 3, body: "🧵 What went wrong for {clubS} in the {score}. Short version: the press was broken from minute one. 1/5" },
    { events: ["win", "rout"], requires: ["clubS", "score"], weight: 3, body: "{clubS} built through the half-spaces all game. The {score} was coming. Half-spaces, people. 📐" },
  ]),

  // ── The grumpy ex-pro ─────────────────────────────────────────────────
  ...bank("expro", "pundit", [
    { tags: ["goal"], subject: "you", weight: 3, body: "Lad can finish. Good for him. Now do it on a wet Tuesday." },
    { events: ["anonymous", "poor-showing"], subject: "you", requires: ["short"], weight: 3, body: "{short} wants to have a long look at himself. Not good enough. Simple as that." },
    { events: ["loss", "hammered", "collapse"], requires: ["clubS"], weight: 3, body: "{clubS} didn't want it today. No leaders out there. In my day the teacups would've been flying." },
    { events: ["hooked"], subject: "you", weight: 2, body: "Taking him off was right. Basics." },
    { events: ["cheeky-miss"], subject: "you", requires: ["short"], weight: 4, body: "A chip, in a game like that? I'd have dragged {short} off on the spot. Basics." },
    { events: ["win", "rout"], requires: ["clubS"], weight: 2, body: "Good win for {clubS}. Did the basics right. Simple as that." },
  ]),

  // ── The VAR moaners ───────────────────────────────────────────────────
  ...bank("ref", "aggregator", [
    { events: ["derby-win", "derby-draw", "derby-loss"], requires: ["homeS", "awayS"], weight: 3, body: "Check complete ✅ {homeS} {hs}-{as} {awayS}. Not one fan on either side agrees with a single decision. 🟨" },
    { events: ["penalty-scored"], weight: 3, body: "Penalty given. Clear and obvious? You decide 🧐" },
    { events: ["late-winner"], requires: ["minute"], weight: 3, body: "{minute}' winner, and the VAR check took four minutes. Four. 📺" },
    { events: ["collapse", "comeback"], requires: ["homeS", "awayS"], weight: 2, body: "Some VAR calls in {homeS} v {awayS} today. Lines drawn by a toddler. 🧐" },
    { events: ["hammered"], requires: ["homeS", "awayS"], weight: 2, body: "{homeS} {hs}-{as} {awayS}. Nothing VAR could do about that one 📺" },
  ]),

  // ── The podcast ───────────────────────────────────────────────────────
  ...bank("pod", "pundit", [
    { tags: ["goal"], subject: "you", requires: ["short"], weight: 3, body: "NEW EP OUT NOW 🎙️\n\nIs {short} the best young player in the country? We argued for 40 minutes. Link in bio 🎧" },
    { events: ["manager-sacked"], requires: ["manager", "clubS"], weight: 3, body: "Emergency pod 🎙️ {manager} is gone. Who's next at {clubS}? Out now 🎧" },
    { events: ["title-race", "went-top"], requires: ["clubS", "competition"], weight: 3, body: "NEW EP: can {clubS} actually win the {competition}? 🎙️ link in bio" },
  ]),

  // ── The nostalgia page ────────────────────────────────────────────────
  ...bank("nostalgia", "meme", [
    { events: ["debut", "club-debut"], subject: "you", requires: ["player"], weight: 3, body: "Where were you when {player} made his debut? 📼 This will be a 'where were you' moment one day." },
    { events: ["first-career-goal"], requires: ["player"], weight: 4, body: "Save this. {player}'s first ever goal. This will age well 📼" },
    { events: ["goal-milestone"], requires: ["total"], weight: 3, body: "{total} goals. Feels like yesterday he was scoring his first. Simpler times 🥲" },
    { events: ["hat-trick"], subject: "you", requires: ["short"], weight: 2, body: "First of many? Screenshot this {short} hat-trick for the documentary 📼" },
  ]),

  // ── The wonderkid scout ───────────────────────────────────────────────
  ...bank("wonderkid", "stats", [
    { events: ["debut", "club-debut"], subject: "you", requires: ["player", "role", "clubS"], weight: 3, body: "💎 {player} ({role}) makes his debut for {clubS}. Remember the name." },
    { events: ["first-career-goal"], requires: ["player"], weight: 3, body: "💎 alert: {player} opens his senior account. Generational? Early. Promising? Absolutely." },
    { events: ["wonderkid-hype"], requires: ["player", "club", "overall"], weight: 4, body: "📡 Keep an eye on {club}'s {player}. Rated {overall} already. {catch}" },
    { events: ["regen-watch"], requires: ["player", "club"], weight: 3, body: "📡 New name on the radar: {player} at {club}. {catch}" },
  ]),

  // ── The odds account ──────────────────────────────────────────────────
  ...bank("odds", "aggregator", [
    { events: ["title-race", "went-top"], requires: ["clubS", "competition", "oddsWas", "oddsNow"], weight: 3, body: "📉 {clubS} to win the {competition}: was {oddsWas}, now {oddsNow}. 18+ | Play it safe" },
    { events: ["manager-sacked"], requires: ["clubS"], weight: 3, body: "📊 Next {clubS} manager: the market is OPEN. 18+ | Play it safe" },
    { events: ["hat-trick", "red-hot", "scoring-run"], subject: "you", requires: ["short", "oddsNow"], weight: 3, body: "📉 {short} to score anytime next game: {oddsNow}. Price slashed. 18+ | Play it safe" },
    { events: ["relegation-fight", "into-the-drop"], requires: ["clubS", "oddsWas", "oddsNow"], weight: 3, body: "📈 {clubS} to go down: was {oddsWas}, now {oddsNow}. 18+ | Play it safe" },
  ]),

  // ── Every club account: the cheeky admin ──────────────────────────────
  ...bank("clubAdmin", "club", [
    { events: ["win"], requires: ["us", "them"], weight: 3, body: "{us}-{them}. that's it. that's the tweet." },
    { events: ["rout"], requires: ["oppS"], weight: 3, body: "{oppS}, thanks for coming 🤫" },
    { events: ["loss"], weight: 2, body: "we don't talk about today. see you next week 🫡" },
    { tags: ["goal"], subject: "you", requires: ["short"], weight: 3, body: "{short}. that's the tweet." },
    { events: ["derby-win"], weight: 4, body: "ours. 🤫" },
    { events: ["late-winner"], requires: ["minute"], weight: 4, body: "{minute}'. the admin needs a lie down." },
    { events: ["went-top"], weight: 3, graphic: "tableSnippet", body: "just going to leave this here 👀" },
    { events: ["hat-trick", "four-goals", "five-goals"], subject: "you", weight: 3, body: "🎩🎩🎩" },
    { events: ["draw"], weight: 2, body: "a point. the admin is choosing to be positive." },
    { events: ["hammered"], weight: 2, body: "the admin has been sent home early." },
  ]),

  // ══ Second pass: more lines where the first ran thin (read in the dump) ══
  ...bank("hype", "meme", [
    { tags: ["goal"], subject: "you", requires: ["short", "oppS"], weight: 3, body: "{short} vs {oppS} today. HIM behaviour 🥶" },
    { tags: ["goal"], subject: "you", requires: ["short", "seasonTotal"], weight: 3, body: "{short}: {seasonTotal} goals this season. and people still doubt him 😮‍💨" },
    { tags: ["goal"], subject: "you", requires: ["short"], weight: 2, body: "remember when they called {short} a 'project'? 😭" },
    { tags: ["goal"], subject: "you", requires: ["short"], weight: 2, body: "{short} doesn't have bad days. he has days where he's only very good 👑" },
    { events: ["win", "rout"], subject: "club", requires: ["clubS", "short"], weight: 1, body: "{clubS} with {short} in the side just hits different 🔥" },
  ], "b"),
  ...bank("fanTV", "fan", [
    { tags: ["goal"], subject: "you", requires: ["short", "oppS"], weight: 3, body: "{short} AGAIN v {oppS}!! The fans are LOSING IT 📺🔥" },
    { tags: ["goal"], subject: "you", requires: ["short"], weight: 3, body: "Is {short} the best player at the club right now?? HAVE YOUR SAY LIVE 📺" },
    { tags: ["goal"], subject: "you", requires: ["short", "seasonTotal"], weight: 2, body: "{seasonTotal} goals for {short} this season!! Fans react LIVE 🙌" },
    { events: ["late-winner"], subject: "you", requires: ["short", "minute"], weight: 4, body: "{minute}' WINNER!!! {short|caps}!!! The fans are in BITS 📺😭" },
  ], "b"),
  ...bank("kidFan", "fan", [
    { tags: ["goal"], subject: "you", requires: ["short"], weight: 3, body: "{short} scored!!!! i did his celebration in the garden 😁" },
    { tags: ["goal"], subject: "you", requires: ["short"], weight: 2, body: "my teacher says i cant write about {short} in every story. but he scored AGAIN ⚽️" },
    { tags: ["goal"], subject: "you", requires: ["number"], weight: 2, body: "im going to be number {number} when i grow up 🤩" },
  ], "b"),
  ...bank("quiz", "meme", [
    { tags: ["goal"], subject: "you", requires: ["short", "clubS"], weight: 2, body: "Only real ones remember {short}'s first goal for {clubS}. Where were you? 👇" },
    { tags: ["goal", "form"], subject: "you", requires: ["short"], weight: 2, graphic: "poll",
      poll: { q: "Is {short} the best young player in the country?", options: ["Yes, easily", "Top 3", "Not yet", "Overrated"] },
      body: "Be honest 👇 {catch}" },
    { tags: ["table", "title"], requires: ["clubS", "tablePos"], weight: 2, body: "{clubS} are {tablePos} in the table. Where do they finish? 👇" },
  ], "b"),
  ...bank("edits", "meme", [
    { tags: ["goal"], subject: "you", requires: ["short"], weight: 2, graphic: "goalVideo", body: "{short} but the music is way too dramatic 🎻 #football #fyp" },
    { tags: ["goal"], subject: "you", requires: ["short", "number"], weight: 2, graphic: "goalVideo", body: "number {number} 🥶 {short} #aura" },
  ], "b"),
  ...bank("meme", "meme", [
    { tags: ["goal"], subject: "you", requires: ["short", "clubS"], weight: 2, body: "{clubS} fans every time {short} touches the ball:\n\n🧍‍♂️ → 🕺" },
    { tags: ["goal"], subject: "you", requires: ["short"], weight: 2, body: "{short} celebrating like he's done it 100 times before 😭 he has" },
    { events: ["win"], requires: ["clubS", "oppS"], weight: 2, body: "{oppS} fans: 'we'll beat them easy'\n\n{clubS}: 😐" },
    { events: ["loss"], requires: ["clubS"], weight: 2, body: "{clubS} fans opening the app today: 🫠" },
    { events: ["rout"], requires: ["oppS"], weight: 2, body: "{oppS} keeper picking the ball out of the net again: 🧍🧍🧍" },
  ], "b"),
  ...bank("ratio", "meme", [
    { events: ["loss", "hammered"], requires: ["clubS"], weight: 2, body: "not the {clubS} fans going quiet in the replies 😭" },
    { events: ["loss"], requires: ["clubS", "oppS"], weight: 2, body: "{oppS} just violated {clubS} 💀 and they said they were 'back'" },
    { events: ["hammered"], requires: ["clubS", "score"], weight: 2, body: "{score}?? {clubS} are cooked 🍳 who's telling them" },
    { events: ["draw"], requires: ["clubS"], weight: 1, body: "{clubS} drawing again 😭 the most mid team in the league" },
  ], "b"),
  ...bank("scores", "aggregator", [
    { tags: ["goal"], subject: "you", requires: ["short", "minute", "clubS"], weight: 2, body: "GOAL | {clubS}\n\n⚽️ {short} {minute}'" },
    { events: ["upset", "cup-shock"], requires: ["homeS", "awayS"], weight: 3, body: "FT | {homeS} {hs}-{as} {awayS}\n\n😱 Upset." },
  ], "b"),
  ...bank("ranter", "pundit", [
    { events: ["draw"], requires: ["clubS", "score"], weight: 2, body: "{clubS} {score}. A DRAW. Is that the AMBITION?? Stream is LIVE 📺" },
    { tags: ["goal"], subject: "you", requires: ["short", "clubS"], weight: 2, body: "If {clubS} sell {short} I'm cancelling EVERYTHING. EVERYTHING. 😤" },
    { events: ["upset"], requires: ["clubS"], weight: 2, body: "{clubS|caps}. HOW?? HOW HAVE THEY DONE THAT?? I'm live in five. 😤" },
  ], "b"),
  ...bank("xg", "stats", [
    { events: ["rout", "hammered"], requires: ["homeS", "awayS", "xgUs", "xgThem"], weight: 2, body: "{homeS} {hs}-{as} {awayS}\n\nxG says it should have been closer ({xgUs} – {xgThem}). Football doesn't care." },
  ], "b"),
  ...bank("fantasy", "stats", [
    { tags: ["goal"], subject: "you", requires: ["short", "seasonTotal"], weight: 2, body: "{short}: {seasonTotal} goals and still owned by hardly anyone. differential of the season? 💸" },
  ], "b"),
  ...bank("womenFan", "fan", [
    { tags: ["goal"], subject: "you", requires: ["short"], weight: 2, body: "the noise when {short} scored. honestly my ears are still ringing 🙌" },
    { events: ["draw"], requires: ["score"], weight: 2, body: "{score}. not what we wanted but the away end sang all game 🧣" },
  ], "b"),
  ...bank("clubAdmin", "club", [
    { tags: ["goal"], subject: "you", requires: ["number"], weight: 2, body: "number {number}. you know the rest." },
    { events: ["win"], requires: ["oppS"], weight: 2, body: "thanks for the points, {oppS} 🫡" },
    { events: ["clean-sheet"], weight: 2, body: "nothing getting past us today 🧱" },
  ], "b"),
  ...bank("neutral", "fan", [
    { events: ["hammered"], requires: ["clubS"], weight: 2, body: "as a neutral that was painful to watch. {clubS} fans you have my sympathy (not really) 🍿" },
    { events: ["late-winner", "equaliser"], requires: ["clubS"], weight: 2, body: "this league is unwell and i love it. {clubS} at the death 🍿" },
  ], "b"),
  ...bank("expro", "pundit", [
    { events: ["draw"], requires: ["clubS"], weight: 2, body: "{clubS} had no edge to them today. You won't win anything playing like that." },
    { events: ["rout"], requires: ["clubS"], weight: 2, body: "{clubS} were ruthless. That's what good teams do. Simple." },
  ], "b"),
  ...bank("takes", "pundit", [
    { events: ["win", "rout"], requires: ["clubS"], weight: 2, body: "Unpopular opinion: {clubS} are still frauds. One win changes nothing." },
    { events: ["went-top", "title-race"], requires: ["clubS"], weight: 3, body: "Hot take: {clubS} won't be top at Christmas. Screenshot it." },
  ], "b"),
  ...bank("journalist", "broadsheet", [
    { events: ["win", "rout"], subject: "club", requires: ["clubS", "short"], weight: 1, body: "{clubS} look a different side when {short} is involved early. That is not a coincidence." },
  ], "b"),
];

/** Lines by persona id. */
export const TWITTER_BY_PERSONA = new Map<string, Template[]>();
for (const t of TWITTER_TEMPLATES) {
  const list = TWITTER_BY_PERSONA.get(t.persona!) ?? [];
  list.push(t);
  TWITTER_BY_PERSONA.set(t.persona!, list);
}
