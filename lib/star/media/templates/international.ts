import type { Template } from "./index";

/**
 * THE INTERNATIONAL CAREER IN THE FEED (lib/star/international.ts).
 *
 * An England game used to go through the club pipeline, so Arsenal's account
 * posted "HIGHLIGHTS | France 2-2 Arsenal", a pundit said "Arsenal got
 * exactly what they deserved", and the club's L L L L run set off manager
 * talk. Internationals now make their own events (feed.ts
 * `generateForInternational`) and every line here is matched by EXACT event
 * id, so no club line can land on them and none of these can land on a
 * club match.
 *
 * Facts each event carries (feed.ts):
 *   result:  nation, opponent, scoreline ("England 2-1 France"), competition,
 *            usGoals, themGoals, club (= the nation)
 *   cap:     player, short, nation, caps, competition, opponent, club
 *   goal:    player, short, nation, opponent, scoreline, intlGoals, club
 *   call-up: player, short, nation, club (your club), month
 *
 * No template reads a fact the event might not carry (the slots check drops
 * the post rather than print a hole).
 */
export const INTERNATIONAL_TEMPLATES: Template[] = [
  // ── The result ──────────────────────────────────────────────────────────
  { id: "int-res-club-win", archetype: "club", events: ["intl-win"], body: "FULL TIME | {scoreline} 🙌 {competition}." },
  { id: "int-res-club-win2", archetype: "club", events: ["intl-win"], body: "Job done. {scoreline}. Thank you for the noise tonight. ⚽" },
  { id: "int-res-club-draw", archetype: "club", events: ["intl-draw"], body: "FULL TIME | {scoreline}. A point in the {competition}." },
  { id: "int-res-club-loss", archetype: "club", events: ["intl-loss"], body: "FULL TIME | {scoreline}. We go again." },
  { id: "int-res-stats-win", archetype: "stats", events: ["intl-win", "intl-draw", "intl-loss"], body: "📊 {competition}: {scoreline}." },
  { id: "int-res-press-win", archetype: "broadsheet", events: ["intl-win"], body: "{nation} beat {opponent} in the {competition}: {scoreline}. A tidy night's work." },
  { id: "int-res-press-draw", archetype: "broadsheet", events: ["intl-draw"], body: "{nation} and {opponent} share the points in the {competition}. {scoreline}." },
  { id: "int-res-press-loss", archetype: "broadsheet", events: ["intl-loss"], body: "{nation} fall to {opponent} in the {competition}, {scoreline}. Questions for the manager before the next window." },
  { id: "int-res-tab-win", archetype: "tabloid", events: ["intl-win"], body: "{nation|caps} DO IT! {scoreline}" },
  { id: "int-res-tab-loss", archetype: "tabloid", events: ["intl-loss"], body: "NIGHTMARE FOR {nation|caps}! {scoreline}" },
  { id: "int-res-agg", archetype: "aggregator", events: ["intl-win", "intl-draw", "intl-loss"], body: "🌍 {scoreline} ({competition})" },
  { id: "int-res-pundit-win", archetype: "pundit", events: ["intl-win"], body: "Good night for {nation}. Against a side like {opponent} you take {scoreline} and you go home happy." },
  { id: "int-res-pundit-draw", archetype: "pundit", events: ["intl-draw"], body: "{scoreline}. Fine. But {nation} have the players to be winning games like that." },
  { id: "int-res-pundit-loss", archetype: "pundit", events: ["intl-loss"], body: "That's not good enough from {nation}. {scoreline} — the manager has picked the wrong side tonight." },
  { id: "int-res-fan-win", archetype: "fan", events: ["intl-win"], body: "{scoreline} come onnnn 🏆" },
  { id: "int-res-fan-draw", archetype: "fan", events: ["intl-draw"], body: "{scoreline}. could be worse" },
  { id: "int-res-fan-loss", archetype: "fan", events: ["intl-loss"], body: "{scoreline}. international football is a struggle 😩" },

  // ── A summer tournament won ─────────────────────────────────────────────
  { id: "int-trophy-club", archetype: "club", events: ["intl-trophy"], body: "🏆 CHAMPIONS! {nation} win the {tournament}! {scoreline}" },
  { id: "int-trophy-press", archetype: "broadsheet", events: ["intl-trophy"], body: "{nation} are {tournament} winners. {scoreline} in the final, and a summer this generation will be remembered for." },
  { id: "int-trophy-tab", archetype: "tabloid", events: ["intl-trophy"], body: "{nation|caps} ARE CHAMPIONS! 🏆" },
  { id: "int-trophy-agg", archetype: "aggregator", events: ["intl-trophy"], body: "🏆 {nation} WIN THE {tournament|caps}" },
  { id: "int-trophy-fan", archetype: "fan", events: ["intl-trophy"], body: "WE'VE WON THE {tournament|caps}!!!! i'm actually crying" },
  { id: "int-trophy-self", archetype: "teammate", events: ["intl-trophy"], body: "{tournament} winners. For everyone back home 🏆🙏" },
  { id: "int-trophy-pundit", archetype: "pundit", events: ["intl-trophy"], body: "I've waited a long time to say it. {nation}, {tournament} winners. Magnificent." },

  // ── Caps ────────────────────────────────────────────────────────────────
  { id: "int-debut-club", archetype: "club", events: ["intl-debut"], body: "🎉 A first cap for {player}! Congratulations on your {nation} debut." },
  { id: "int-debut-stats", archetype: "stats", events: ["intl-debut"], body: "1 — {player} has won his first {nation} cap, against {opponent}." },
  { id: "int-debut-self", archetype: "teammate", events: ["intl-debut"], body: "Dreamt of this since I was a kid. Proud to make my {nation} debut 🙏" },
  { id: "int-debut-press", archetype: "broadsheet", events: ["intl-debut"], body: "{player} made his {nation} debut against {opponent}, the reward for a fine start to the season." },
  { id: "int-debut-fan", archetype: "fan", events: ["intl-debut"], body: "{short} making his {nation} debut. what a moment for the lad" },
  { id: "int-cap-club", archetype: "club", events: ["intl-cap"], body: "{player} wins cap number {caps} for {nation}. 👏" },
  { id: "int-cap-stats", archetype: "stats", events: ["intl-cap"], body: "{caps} — {player} has now won {caps} caps for {nation}." },
  { id: "int-cap-mile-club", archetype: "club", events: ["intl-cap-milestone"], body: "🎖️ {caps} CAPS! Congratulations, {player}, on {caps} appearances for {nation}." },
  { id: "int-cap-mile-stats", archetype: "stats", events: ["intl-cap-milestone"], body: "{caps} — {player} reaches {caps} {nation} caps." },
  { id: "int-cap-mile-press", archetype: "broadsheet", events: ["intl-cap-milestone"], body: "{player} won his {caps|ordinal} cap for {nation} against {opponent}, a landmark few reach." },
  { id: "int-cap-mile-self", archetype: "teammate", events: ["intl-cap-milestone"], body: "{caps} caps for {nation}. Never take it for granted 🙏" },

  // ── Goals ───────────────────────────────────────────────────────────────
  { id: "int-firstgoal-club", archetype: "club", events: ["intl-first-goal"], body: "⚽ {player} scores his first {nation} goal! {scoreline}" },
  { id: "int-firstgoal-stats", archetype: "stats", events: ["intl-first-goal"], body: "1 — {player} has scored his first goal for {nation}, against {opponent}." },
  { id: "int-firstgoal-self", archetype: "teammate", events: ["intl-first-goal"], body: "First goal for my country. Words can't describe it 🙏⚽" },
  { id: "int-firstgoal-tab", archetype: "tabloid", events: ["intl-first-goal"], body: "{short|caps} OFF THE MARK FOR {nation|caps}!" },
  { id: "int-goal-club", archetype: "club", events: ["intl-goal"], body: "⚽ {player} scores for {nation}! {scoreline}" },
  { id: "int-goal-stats", archetype: "stats", events: ["intl-goal"], body: "{intlGoals} — international goals for {player} after tonight's strike against {opponent}." },
  { id: "int-goal-agg", archetype: "aggregator", events: ["intl-goal", "intl-first-goal"], body: "{short} scores for {nation} against {opponent} 🌍" },
  { id: "int-goal-fan", archetype: "fan", events: ["intl-goal", "intl-first-goal"], body: "{short} scoring for {nation} 😍 told you he was class" },

  // ── The call-up (a career moment, posted when the squad is named) ───────
  { id: "int-callup-club", archetype: "club", events: ["first-call-up"], body: "🌍 Congratulations to {player}, called up by {nation} for the first time!" },
  { id: "int-callup-club2", archetype: "club", events: ["call-up"], body: "🌍 {player} has been named in the {nation} squad for the {month} internationals." },
  { id: "int-callup-stats", archetype: "stats", events: ["first-call-up"], body: "{player} is in the {nation} squad for the first time." },
  { id: "int-callup-fan", archetype: "fan", events: ["first-call-up"], body: "{short} in the {nation} squad!!! deserved" },
  { id: "int-callup-fan2", archetype: "fan", events: ["call-up"], body: "{short} back in the {nation} squad 👏" },
  { id: "int-callup-tab", archetype: "tabloid", events: ["first-call-up"], body: "{short|caps} GETS THE CALL! {club} star in the {nation} squad" },
  { id: "int-callup-self", archetype: "teammate", events: ["first-call-up"], body: "Can't believe it. Called up for {nation} 🙏 Thank you to everyone at {club}." },
  { id: "int-callup-agg", archetype: "aggregator", events: ["first-call-up"], body: "🚨 {club}'s {player} earns a first {nation} call-up." },
  { id: "int-callup-insider", archetype: "insider", events: ["first-call-up"], body: "🚨 {player} called up by {nation}. First time in the squad. Deserved." },
  { id: "int-recall-insider", archetype: "insider", events: ["call-up"], body: "🚨 {player} keeps his place in the {nation} squad for {month}." },
  { id: "int-recall-stats", archetype: "stats", events: ["call-up"], body: "{player} is in the {nation} squad again for the {month} window." },
  { id: "int-recall-self", archetype: "teammate", events: ["call-up"], body: "Back with {nation} 🙏 Always an honour." },
  { id: "int-recall-tab", archetype: "tabloid", events: ["call-up"], body: "{short|caps} KEEPS HIS {nation|caps} PLACE" },
  { id: "int-recall-agg", archetype: "aggregator", events: ["call-up"], body: "{club}'s {short} named in the {nation} squad 🌍" },
];
