import type { CareerState } from "../types";
import { sortLeague } from "../season";
import { goldenBootRace, assistRace } from "../recognition";
import { MONTH_NAMES, faceOf, monthOfCareer, monthRace, playerOf } from "../potm";
import type {
  FootballEvent, GraphicKind, GraphicSpec, MatchRecord, StoryMemory,
} from "./types";
import { pick, surname } from "./grammar";

/**
 * GRAPHIC DATA, NOT PICTURES.
 *
 * A template asks for a kind of graphic; this builds the typed payload for it
 * out of the record. Nothing here renders anything — the twelve React
 * components in components/star/media/Graphics.tsx do that, in the visual
 * language the rest of /star-dev already uses. No assets, no network, no canvas.
 *
 * Returns undefined rather than a half-filled card when the facts are not there.
 * A post with no graphic reads as a post; a graphic with blanks in it reads as a
 * bug.
 */

export function buildGraphic(
  kind: GraphicKind,
  e: FootballEvent,
  r: MatchRecord | null,
  career: CareerState,
  memory: StoryMemory,
  rng: () => number,
): GraphicSpec | undefined {
  const f = e.facts;
  const you = `${career.player.firstName} ${career.player.lastName}`;

  switch (kind) {
    case "scoreline": {
      if (!r) return undefined;
      const home = r.home ? r.club : r.opponent;
      const away = r.home ? r.opponent : r.club;
      // Every goal on the record is one of ours — the opponent's are simulated
      // and never named — so they all belong to whichever side we are.
      const ours = r.goals.map(g => `${surname(g.scorer)} ${g.minute}'`);
      return {
        type: "scoreline",
        home, away,
        hs: r.home ? r.score.us : r.score.them,
        as: r.home ? r.score.them : r.score.us,
        competition: r.competition,
        homeScorers: r.home ? ours : [],
        awayScorers: r.home ? [] : ours,
      };
    }

    case "breaking":
      return {
        type: "breaking",
        strapline: pick(["BREAKING", "JUST IN", "CONFIRMED", "DEVELOPING"], rng),
        headline: String(f.headline ?? headlineFor(e, you)),
      };

    case "playerCard": {
      const rows = [
        { label: "Goals", value: String(f.goals ?? r?.you.goals ?? 0), highlight: Number(f.goals ?? 0) > 0 },
        { label: "Assists", value: String(f.assists ?? r?.you.assists ?? 0) },
        { label: "Season", value: `${r?.you.seasonGoals ?? career.seasonStats.goals} G / ${r?.you.seasonAssists ?? career.seasonStats.assists} A` },
      ];
      return {
        type: "playerCard",
        name: you,
        number: career.squadNumber ?? 0,
        position: career.player.position,
        rating: r?.you.rating ?? 7,
        rows,
        context: matchContext(r, e),
      };
    }

    case "statLine": {
      const rows = statRows(e, r, memory);
      if (!rows.length) return undefined;
      // Whose card is this? The event knows — a club unbeaten run headed with
      // the player's name reads as though he personally did not concede.
      const aboutYou = e.subject.kind === "you" || e.subject.kind === "teammate";
      return {
        type: "statLine",
        title: aboutYou ? String(f.player ?? you) : String(f.club ?? you),
        rows,
        context: matchContext(r, e),
      };
    }

    case "tableSnippet": {
      const sorted = sortLeague(career.league);
      const i = Math.max(0, sorted.findIndex(t => t.name === career.player.club));
      const from = Math.max(0, Math.min(i - 2, sorted.length - 5));
      return {
        type: "tableSnippet",
        highlight: career.player.club,
        rows: sorted.slice(from, from + 5).map((t, k) => ({
          pos: from + k + 1,
          name: t.name,
          played: t.played,
          gd: t.goalsFor - t.goalsAgainst,
          points: t.points,
        })),
      };
    }

    case "topScorers": {
      // One card, two charts. Assist King reads the same way as Golden Boot —
      // a ranked list with you picked out of it — so it is the same graphic
      // with a different race and a different number pulled off each row,
      // decided by which detector actually fired.
      // `Scorer.goals` is a generic count, not literally goals — assistRace
      // fills it with each player's assist total, the same field golden boot
      // fills with goals. One shape, whichever race actually fired.
      const isAssists = e.id === "assist-king-race";
      const race = (isAssists ? assistRace(career) : goldenBootRace(career)).slice(0, 5);
      if (!race.length) return undefined;
      return {
        type: "topScorers",
        title: isAssists ? "Assist King" : "Golden Boot",
        highlight: you,
        rows: race.map(s => ({ label: s.isYou ? you : s.name, value: String(s.goals), highlight: s.isYou })),
      };
    }

    case "potmNominees": {
      if (!r) return undefined;
      // `monthRace`, not `voteMonth`. The shortlist is published before the
      // panel sits, so it is ordered by what the month's football actually was
      // — and using the vote here would leak its result a round early.
      // Straight off the record. Recomputing it here is what broke this card:
      // `r.week` is the CAREER week, which is not the fixture's week once a cup
      // tie has been played, so the month came out wrong and the race came back
      // empty. The record already decided which month this is — see potmRace.
      const month = r.potmRace?.month;
      if (month === undefined) return undefined;
      const race = monthRace(career, month).slice(0, 8);
      // Four names is not a shortlist, it is a table with gaps in it. Early in a
      // month, or after a weekend of goalless draws, there genuinely are not
      // eight people who scored or made one, and a grid half full of blanks
      // reads as a bug.
      if (race.length < 6) return undefined;
      return {
        type: "potmNominees",
        month: MONTH_NAMES[month],
        nominees: race.map(c => ({
          name: c.name, club: c.club, goals: c.goals, assists: c.assists, isYou: c.isYou,
          // A photograph for the real footballers. For you: the one you took if
          // you took one, and the back of your shirt if you did not.
          ...(c.isYou ? yourFace(career) : { face: faceOf(career, c.name, c.club) }),
        })),
      };
    }

    case "potmWinner": {
      const month = String(f.month ?? "");
      const isYou = e.id === "potm-won";
      // The name a goal was filed under, which is a surname and sometimes an
      // initial and a surname.
      const filed = isYou ? career.player.lastName : String(f.winner ?? "");
      const club = isYou ? career.player.club : String(f.winnerClub ?? career.player.club);
      if (!month || !filed) return undefined;

      // …and the name his club knows him by, which is the one worth setting at
      // this size. "ERLING HAALAND", not "HAALAND", and certainly not "E."
      const known = isYou ? undefined : playerOf(career, filed, club);
      const full = isYou ? `${career.player.firstName} ${career.player.lastName}` : (known?.name ?? filed);
      const parts = full.trim().split(/\s+/);
      const lastName = parts[parts.length - 1];
      // A lone initial is not a first name — it is the absence of one, and it
      // reads worse above a surname than nothing does.
      const head = parts.slice(0, -1).join(" ");
      const firstName = /^[A-Z]\.?$/.test(head) ? "" : head;

      return {
        type: "potmWinner",
        month, firstName, lastName, club,
        goals: Number(f.goals ?? 0),
        assists: Number(f.assists ?? 0),
        isYou,
        ...(isYou ? yourFace(career) : { face: known?.image }),
        ...(!isYou && f.place !== undefined ? { yourPlace: Number(f.place) } : {}),
      };
    }

    case "hatTrick": {
      const minutes = (r?.goals ?? []).filter(g => g.isUser).map(g => g.minute);
      if (minutes.length < 3) return undefined;
      return { type: "hatTrick", name: you, minutes };
    }

    case "transfer":
      if (!f.to && !f.club) return undefined;
      return {
        type: "transfer",
        player: you,
        from: String(f.from ?? career.player.club),
        to: String(f.to ?? f.club ?? career.player.club),
        fee: f.feeText ? String(f.feeText) : undefined,
      };

    case "trophy":
      return {
        type: "trophy",
        competition: String(f.competition ?? "Premier League"),
        club: String(f.club ?? career.player.club),
        season: Number(f.season ?? career.season),
      };

    case "poll": {
      const options = pollOptions(e, career, rng);
      if (options.length < 2) return undefined;
      const votes = options.map(() => 5 + Math.floor(rng() * 60));
      return { type: "poll", question: pollQuestion(e), options, votes };
    }

    case "thumbnail":
      return {
        type: "thumbnail",
        title: headlineFor(e, you).toUpperCase(),
        badge: e.tags.includes("goal") ? "GOAL" : e.tags.includes("shame") ? "REACTION" : "HIGHLIGHTS",
      };

    case "teamOfTheWeek": {
      const squad = career.squad ?? [];
      if (squad.length < 6) return undefined;
      const picks = squad.slice(0, 5).map(p => ({
        name: p.name, position: p.position, note: `${p.seasonGoals}G ${p.seasonAssists}A`, isYou: false,
      }));
      return {
        type: "teamOfTheWeek",
        formation: "4-3-3",
        players: [
          { name: you, position: career.player.position, note: `${r?.you.goals ?? 0}G ${r?.you.assists ?? 0}A`, isYou: true },
          ...picks,
        ],
      };
    }
  }
  return undefined;
}

/**
 * What these numbers are FROM. "v Crystal Palace (H)", or "Last 3 matches".
 *
 * ── It has to answer the question the card actually raises ──
 *
 * The first version of this labelled EVERY card with the match, because the bug
 * it was fixing was a card of today's numbers sitting under a sentence about a
 * run. That fix was right for the cards it was looking at and a lie for the
 * others: a card reading "Goals 7 / Over 3 matches" is a RUN, and stamping
 * "v Liverpool (A)" on it says those seven went in at Anfield on Saturday.
 * Reported as exactly that.
 *
 * So it reads the same fact the rows are built from. `matches` present means the
 * numbers span a run and the label says so; absent means they are this
 * afternoon's and the label names the match.
 */
/**
 * What goes in your tile.
 *
 * One place, because the shortlist and the winner card both ask and answering it
 * twice is how the two of them end up disagreeing about whether you have a
 * photograph. `own` is what tells the renderer this is a picture with a room
 * behind it rather than a cut-out on transparent.
 */
function yourFace(career: CareerState): { face: string; own: true } | { number: number } {
  const portrait = career.player.portrait;
  return portrait ? { face: portrait, own: true } : { number: career.squadNumber ?? 0 };
}

function matchContext(r: MatchRecord | null, e?: FootballEvent): string | undefined {
  const over = e?.facts.matches;
  if (over !== undefined) {
    const n = Number(over);
    return Number.isFinite(n) && n > 1 ? `Last ${n} matches` : undefined;
  }
  if (!r) return undefined;
  return `v ${r.opponent} (${r.home ? "H" : "A"})`;
}

function statRows(e: FootballEvent, r: MatchRecord | null, _memory: StoryMemory) {
  const f = e.facts;
  const rows: { label: string; value: string; highlight?: boolean }[] = [];
  if (f.goals !== undefined) rows.push({ label: "Goals", value: String(f.goals), highlight: true });
  if (f.assists !== undefined) rows.push({ label: "Assists", value: String(f.assists) });
  if (f.matches !== undefined) rows.push({ label: "Over", value: `${f.matches} match${Number(f.matches) === 1 ? "" : "es"}` });
  if (f.milestone !== undefined) rows.push({ label: "Milestone", value: String(f.milestone), highlight: true });
  if (f.average !== undefined) rows.push({ label: "Avg rating", value: String(f.average) });
  if (rows.length === 1 && rows[0].label === "Over") {
    // "Over: 5 matches" on its own is a caption, not a card — and pairing it
    // with "Unbeaten: 5" is the same number twice. It becomes the one row it
    // was always trying to be.
    // A drought belongs to a player and a winless run to a club, and calling
    // either of them "Unbeaten" — which is what everything fell through to —
    // says the opposite of what happened.
    const label = e.id.includes("clean-sheet") ? "Clean sheets"
      : e.id.includes("drought") ? "Without a goal"
      : e.id.includes("losing") ? "Without a win"
      : e.id.includes("winning") ? "Wins in a row"
        : "Unbeaten";
    rows[0] = { label, value: String(f.matches), highlight: true };
  }
  if (rows.length === 0 && r) {
    rows.push({ label: "Rating", value: r.you.rating.toFixed(1), highlight: r.you.rating >= 8 });
    rows.push({ label: "Season", value: `${r.you.seasonGoals} G / ${r.you.seasonAssists} A` });
  }
  return rows.slice(0, 4);
}

function headlineFor(e: FootballEvent, you: string): string {
  const f = e.facts;
  const short = String(f.short ?? surname(you));
  switch (e.id) {
    case "hat-trick": return `${short} hat-trick`;
    case "four-goals": return `${short} scores four`;
    case "five-goals": return `${short} scores five`;
    case "late-winner": return `${short} wins it at ${f.minute}`;
    case "screamer": return `${f.distance}-yard strike`;
    case "trophy": case "champions": return `${f.club} are champions`;
    case "relegated": return `${f.club} relegated`;
    case "transfer-done": return `${short} joins ${f.to}`;
    case "manager-sacked": return `${f.manager} sacked`;
    case "derby-win": return `Derby won`;
    case "comeback": return `${f.deficit} down and won`;
    default: return `${f.club} ${f.us}-${f.them} ${f.opponent}`;
  }
}

function pollQuestion(e: FootballEvent): string {
  if (e.tags.includes("shame")) return "Who's to blame?";
  if (e.tags.includes("manager")) return "Right call?";
  if (e.tags.includes("goal")) return "Goal of the season so far?";
  return "Your verdict?";
}

function pollOptions(e: FootballEvent, career: CareerState, rng: () => number): string[] {
  const you = career.player.lastName;
  if (e.tags.includes("shame")) return ["The manager", "The players", "The board", "All of it"];
  if (e.tags.includes("manager")) return ["Long overdue", "Harsh", "Too late"];
  if (e.tags.includes("goal")) return [you, "Someone else", "Not even close"];
  return ["Deserved it", "Got away with it", "Nothing in it"];
}
