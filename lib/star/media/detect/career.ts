import type { CareerDetector, CareerRecord, Facts, FootballEvent, Subject } from "../types";

/**
 * Everything that happens away from a Saturday.
 *
 * These enter the pipeline in exactly the same place a match does — same event
 * shape, same accounts, same templates — which is why the Ballon d'Or producing
 * a wave of congratulations costs one function call rather than a second engine.
 *
 * The transfer window is the reason threads outlive matches: a rumour opened in
 * January and reinforced in March is a saga by June, and a saga is the thing a
 * transfer insider account exists for.
 */

function base(r: CareerRecord): Facts {
  return {
    player: r.you.name,
    short: r.you.shortName,
    club: r.club,
    season: r.season,
    week: r.week,
    number: r.you.squadNumber,
    role: r.you.position,
  };
}

function make(
  id: string, subject: Subject, importance: number, tags: FootballEvent["tags"],
  facts: Facts, window: FootballEvent["window"], threadKey?: string,
): FootballEvent {
  return { id, subject, baseImportance: importance, tags, facts, window, threadKey };
}

const TRANSFER: CareerDetector = (r) => {
  if (r.moment.kind !== "transfer") return null;
  const m = r.moment;
  return [
    make("transfer-done", { kind: "you", name: r.you.name }, 96, ["transfer", "rumour"], {
      ...base(r), from: m.from, to: m.to, fee: m.fee, feeText: `£${m.fee}m`,
    }, "instant", `transfer:${m.to}`),
    make("farewell", { kind: "club", name: m.from }, 62, ["transfer"], {
      ...base(r), from: m.from, to: m.to,
    }, "hour"),
    make("unveiling", { kind: "club", name: m.to }, 74, ["transfer"], {
      ...base(r), from: m.from, to: m.to, feeText: `£${m.fee}m`,
    }, "hour"),
  ];
};

const CONTRACT: CareerDetector = (r) => {
  if (r.moment.kind !== "contract") return null;
  const m = r.moment;
  return make("contract-signed", { kind: "you", name: r.you.name }, 68, ["contract", "transfer"], {
    ...base(r), club: m.club, seasons: m.seasons, wage: m.wage,
  }, "instant", `contract:${m.club}`);
};

const AWARD: CareerDetector = (r) => {
  if (r.moment.kind !== "award") return null;
  const m = r.moment;
  // A month you were merely shortlisted for — 3rd on the vote, say — is not a
  // month you won. Reported directly: your own club's account posting "BREAKING
  // — Player of the Month, one of our own" the same month the stats account
  // correctly showed someone else lifting it. This moment used to skip straight
  // to "award-won" for every Player of the Month result regardless of outcome;
  // the real winner/shortlist split (lib/star/potm.ts) already exists, it just
  // never reached this event. The shortlist mention itself still reaches the
  // feed — it is the caption on the stats-account graphic in record.ts.
  if (!m.won) return null;
  const big = /Season|Golden Boot/i.test(m.award);
  return make("award-won", { kind: "you", name: r.you.name }, big ? 88 : 64, ["award", "trophy"], {
    ...base(r), award: m.award, detail: m.detail,
  }, "instant", "awards");
};

const BALLON_DOR: CareerDetector = (r) => {
  if (r.moment.kind !== "ballon-dor") return null;
  const m = r.moment;
  if (!m.won) {
    return make("ballon-dor-missed", { kind: "you", name: r.you.name }, 58, ["award", "opinion"], {
      ...base(r),
    }, "instant");
  }
  return make("ballon-dor", { kind: "you", name: r.you.name }, 100, ["award", "trophy", "record"], {
    ...base(r), total: m.total,
  }, "instant", "awards");
};

const MANAGER: CareerDetector = (r) => {
  if (r.moment.kind !== "manager-out") return null;
  const m = r.moment;
  return [
    make("manager-sacked", { kind: "manager", name: m.name }, 84, ["manager", "drama"], {
      ...base(r), manager: m.name, reason: m.reason,
    }, "instant", "manager"),
    make("manager-in", { kind: "manager", name: m.incoming }, 70, ["manager"], {
      ...base(r), manager: m.incoming, previous: m.name,
    }, "hour", "manager"),
  ];
};

const CALL_UP: CareerDetector = (r) => {
  if (r.moment.kind !== "call-up") return null;
  const m = r.moment;
  return make(m.caps <= 1 ? "first-call-up" : "call-up", { kind: "you", name: r.you.name },
    m.caps <= 1 ? 82 : 46, ["international", "award"], {
      ...base(r), nation: m.nation, caps: m.caps,
    }, "instant");
};

const CAPTAIN: CareerDetector = (r) => {
  if (r.moment.kind !== "captain") return null;
  return make("armband", { kind: "you", name: r.you.name }, 76, ["award", "milestone"], {
    ...base(r),
  }, "instant");
};

const TESTIMONIAL: CareerDetector = (r) => {
  if (r.moment.kind !== "testimonial") return null;
  return make("testimonial", { kind: "you", name: r.you.name }, 72, ["milestone", "trophy"], {
    ...base(r),
  }, "instant");
};

const RETIREMENT: CareerDetector = (r) => {
  if (r.moment.kind !== "retirement") return null;
  const m = r.moment;
  return make("retirement", { kind: "you", name: r.you.name }, 100, ["milestone", "record"], {
    ...base(r), goals: m.goals, apps: m.apps, trophies: m.trophies,
  }, "instant");
};

const SEASON_REVIEW: CareerDetector = (r) => {
  if (r.moment.kind !== "season-end") return null;
  const m = r.moment;
  return make("season-review", { kind: "club", name: r.club }, 62, ["table", "opinion"], {
    ...base(r), position: m.position, headline: m.headline, detail: m.detail,
  }, "weekly");
};

export const CAREER_DETECTORS: CareerDetector[] = [
  TRANSFER, CONTRACT, AWARD, BALLON_DOR, MANAGER, CALL_UP,
  CAPTAIN, TESTIMONIAL, RETIREMENT, SEASON_REVIEW,
];
