"use client";
import { useState, useEffect, type ComponentType } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  accentFor, CrownIcon, Laurel, AngledTab, HallOfFameBanner, StatTile,
  BoardIcon, PeopleIcon, StarIcon, ShieldIcon,
  PointsIcon, WinsIcon, BootIcon, AssistIcon, GloveIcon, UnbeatenIcon,
  GoalLockIcon, ExplosionIcon, RatingStarIcon, SquadOvrIcon, FootballIcon, MedalIcon,
} from "@/components/draft/HallOfFameChrome";

interface RecordEntry {
  value: number;
  playerName: string | null;
  playerOvr: number | null;
  username: string;
  seasonNumber: number | null;
  clubName?: string | null;
  mode?: "normal" | "prime";
}

interface RecordType {
  key: string;
  label: string;
  Icon: ComponentType<{ className?: string }>;
  playerImage?: string; // path in /public, e.g. "/hof/bruna-fernandes.png"
  isTeam: boolean;
  ascending?: boolean;
  isDecimal?: boolean;
}

const SEASON_RECORD_TYPES: RecordType[] = [
  { key: "most_points",    label: "Most Points",                Icon: PointsIcon,     playerImage: "/ChatGPT Image Jul 26, 2026, 09_48_46 PM-Photoroom.png", isTeam: true },
  { key: "wins",           label: "Most Wins",                  Icon: WinsIcon,       playerImage: "/Klopp and Pep.png",           isTeam: true },
  { key: "goals",          label: "Golden Boot",                Icon: BootIcon,       playerImage: "/Erling Haaland.png",          isTeam: false },
  { key: "assists",        label: "Most Assists",               Icon: AssistIcon,     playerImage: "/Bruno Fernandes.png",         isTeam: false },
  { key: "clean_sheets",   label: "Golden Glove",               Icon: GloveIcon,      playerImage: "/Petr Cech.png",               isTeam: false },
  { key: "unbeaten",       label: "Longest Unbeaten",           Icon: UnbeatenIcon,   playerImage: "/Arsenal Invincibles.png",     isTeam: true },
  { key: "goals_conceded", label: "Least Goals Conceded",       Icon: GoalLockIcon,   playerImage: "/Jose Mourinho.png",           isTeam: true, ascending: true },
  { key: "biggest_win",    label: "Biggest Win",                Icon: ExplosionIcon,  playerImage: "/United 9-0.png",              isTeam: true },
  { key: "avg_rating",     label: "Player of the Season Rating",Icon: RatingStarIcon, isTeam: false, isDecimal: true },
  { key: "squad_ovr",      label: "Highest Squad OVR",          Icon: SquadOvrIcon,   isTeam: true },
];

const CAREER_RECORD_TYPES: RecordType[] = [
  { key: "career_goals",      label: "Most Career Goals",         Icon: FootballIcon,   isTeam: false },
  { key: "career_assists",    label: "Most Career Assists",       Icon: AssistIcon,     isTeam: false },
  { key: "career_trophies",   label: "Most Trophies Won",         Icon: MedalIcon,      isTeam: true },
  { key: "career_avg_rating", label: "Highest Career Avg Rating", Icon: RatingStarIcon, isTeam: false, isDecimal: true },
];

const OFFICIAL: Record<string, { value: number; playerName: string | null; playerOvr: number | null; clubName?: string }> = {
  "pl_most_points":    { value: 100, playerName: null, playerOvr: null, clubName: "Man City" },
  "pl_wins":           { value: 32, playerName: null, playerOvr: null, clubName: "Man City" },
  "pl_goals":          { value: 36, playerName: "E. Haaland", playerOvr: 91 },
  "pl_assists":        { value: 21, playerName: "Bruno Fernandes", playerOvr: 88 },
  "pl_clean_sheets":   { value: 24, playerName: "P. Čech", playerOvr: 88 },
  "pl_unbeaten":       { value: 49, playerName: null, playerOvr: null, clubName: "Arsenal" },
  "pl_goals_conceded": { value: 15, playerName: null, playerOvr: null, clubName: "Chelsea" },
  "all_wins":          { value: 32, playerName: null, playerOvr: null, clubName: "Man City" },
  "all_goals":         { value: 36, playerName: "E. Haaland", playerOvr: 91 },
  "all_assists":       { value: 21, playerName: "Bruno Fernandes", playerOvr: 88 },
  "all_clean_sheets":  { value: 24, playerName: "P. Čech", playerOvr: 88 },
  "all_unbeaten":      { value: 49, playerName: null, playerOvr: null, clubName: "Arsenal" },
  "all_goals_conceded":{ value: 15, playerName: null, playerOvr: null, clubName: "Chelsea" },
  "pl_biggest_win":    { value: 9, playerName: "9-0", playerOvr: null, clubName: "Man Utd" },
  "all_biggest_win":   { value: 9, playerName: "9-0", playerOvr: null, clubName: "Man Utd" },
};

function mergeWithOfficial(
  dbEntries: RecordEntry[],
  key: string,
  rt: RecordType,
): RecordEntry[] {
  const official = OFFICIAL[key];
  if (!official) return dbEntries;

  const hasOfficial = dbEntries.some(e => e.username === "Official");
  const officialEntry: RecordEntry = {
    ...official,
    username: "Official",
    seasonNumber: null,
  };

  const entries = hasOfficial ? dbEntries : [...dbEntries, officialEntry];

  if (rt.ascending) {
    entries.sort((a, b) => a.value - b.value);
  } else {
    entries.sort((a, b) => b.value - a.value);
  }
  return entries.slice(0, 5);
}

const MEDALS = ["🥇", "🥈", "🥉", "4th", "5th"];

function ModeBadge({ mode }: { mode: "normal" | "prime" }) {
  return mode === "prime" ? (
    <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/40 shrink-0 tracking-wide">
      PRIME
    </span>
  ) : (
    <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 shrink-0 tracking-wide">
      NORMAL
    </span>
  );
}

function OvrBadge({ ovr }: { ovr: number }) {
  const colour =
    ovr >= 88 ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/40" :
    ovr >= 80 ? "bg-yellow-500/10 text-yellow-300 border-yellow-500/30" :
    "bg-gray-800/80 text-gray-300 border-gray-700/50";
  return (
    <span className={`text-[10px] font-black px-1.5 py-0.5 rounded border tracking-wide ${colour}`}>
      {ovr} OVR
    </span>
  );
}

function formatValue(value: number, rt: RecordType, score?: string | null): string {
  if (rt.key === "biggest_win" && score) return score;
  if (rt.isDecimal) return (value / 10).toFixed(1);
  return String(value);
}

function LeaderboardRow({ entry, index: i, rt }: { entry: RecordEntry; index: number; rt: RecordType }) {
  const isOfficial = entry.username === "Official";
  return (
    <div
      className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg border ${
        i === 0
          ? "bg-white/[0.04] border-white/10"
          : "bg-black/30 border-white/5"
      }`}
    >
      <span className={`leading-none w-5 text-center shrink-0 ${i >= 3 ? "text-[10px] font-black text-gray-500" : "text-base"}`}>
        {MEDALS[i]}
      </span>

      <div className="flex-1 min-w-0">
        {!rt.isTeam && entry.playerName && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-black text-white truncate">{entry.playerName}</span>
            {!isOfficial && entry.playerOvr !== null && <OvrBadge ovr={entry.playerOvr} />}
          </div>
        )}
        <div className="text-xs">
          {rt.isTeam ? (
            <span className="flex items-center gap-1.5 flex-wrap">
              <span className="text-white font-black text-base tabular-nums">{formatValue(entry.value, rt, entry.playerName)}</span>
              {isOfficial ? (
                entry.clubName && <span className="text-gray-300 font-bold">{entry.clubName}</span>
              ) : (
                <>
                  <span className="text-emerald-400 font-black">{entry.username}</span>
                  {entry.mode && <ModeBadge mode={entry.mode} />}
                  {entry.playerOvr !== null && <OvrBadge ovr={entry.playerOvr} />}
                </>
              )}
            </span>
          ) : (
            <span className="flex items-center gap-1.5 flex-wrap">
              {isOfficial ? (
                entry.clubName && <span className="text-gray-300 font-bold">{entry.clubName}</span>
              ) : (
                <>
                  <span className="text-emerald-400 font-black">{entry.username}</span>
                  {entry.mode && <ModeBadge mode={entry.mode} />}
                </>
              )}
              {!isOfficial && entry.seasonNumber && (
                <span className="text-gray-500">· S{entry.seasonNumber}</span>
              )}
            </span>
          )}
        </div>
      </div>

      {isOfficial && (
        <span className="shrink-0 text-[9px] sm:text-[10px] font-black italic uppercase tracking-wider text-amber-300/90">
          Official record
        </span>
      )}

      {!rt.isTeam && (
        <div className="shrink-0 text-right">
          <div className={`text-xl font-black tabular-nums leading-none ${i === 0 ? "text-amber-300" : "text-white"}`}>
            {formatValue(entry.value, rt)}
          </div>
        </div>
      )}
    </div>
  );
}

function Leaderboard({ entries, rt, expanded }: { entries: RecordEntry[]; rt: RecordType; expanded: boolean }) {
  if (entries.length === 0) {
    return (
      <div className="text-center py-5 text-gray-500 text-xs font-bold uppercase tracking-widest">
        No records yet — be the first
      </div>
    );
  }
  const rest = entries.slice(1);
  return (
    <div className="space-y-1.5">
      <LeaderboardRow entry={entries[0]} index={0} rt={rt} />
      {rest.length > 0 && (
        <div
          className="overflow-hidden transition-all duration-300 ease-in-out"
          style={{ maxHeight: expanded ? `${rest.length * 72}px` : "0px", opacity: expanded ? 1 : 0 }}
        >
          <div className="space-y-1.5">
            {rest.map((entry, i) => (
              <LeaderboardRow key={i + 1} entry={entry} index={i + 1} rt={rt} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function YourBest({ entry, rt }: { entry: { value: number; playerName: string | null; seasonNumber: number | null } | undefined; rt: RecordType }) {
  if (!entry || entry.value <= 0) return null;
  return (
    <div className="mt-1.5 flex items-center gap-2 rounded-lg border border-emerald-600/40 bg-emerald-950/40 px-2.5 py-2">
      <span className="text-[9px] font-black uppercase tracking-[0.16em] text-emerald-400 shrink-0">Your best</span>
      <span className="text-base font-black text-white tabular-nums">{formatValue(entry.value, rt, entry.playerName)}</span>
      {!rt.isTeam && entry.playerName && <span className="text-xs text-gray-300 truncate">{entry.playerName}</span>}
      {entry.seasonNumber != null && <span className="text-[10px] text-gray-500 shrink-0">· S{entry.seasonNumber}</span>}
    </div>
  );
}

// One record board, presented as a numbered, colour-accented card.
function RecordCard({
  rt, rank, subtitle, entries, personalEntry, expanded, onToggle,
}: {
  rt: RecordType;
  rank: number;
  subtitle: string;
  entries: RecordEntry[];
  personalEntry: { value: number; playerName: string | null; seasonNumber: number | null } | undefined;
  expanded: boolean;
  onToggle: () => void;
}) {
  const a = accentFor(rank - 1);
  const hasMore = entries.length > 1;
  return (
    <article className={`relative overflow-hidden rounded-2xl border bg-[#0a0d13] ${a.ring} ${a.glow}`}>
      {/* Angled accent panel down the left edge. */}
      <div
        className="pointer-events-none absolute inset-y-0 -left-8 w-[106px] sm:w-[118px] overflow-hidden"
        style={{ transform: "skewX(-11deg)" }}
        aria-hidden="true"
      >
        <div className={`absolute inset-0 ${a.panel}`} />
        <div className={`absolute inset-y-0 right-0 w-px ${a.edge}`} />
      </div>

      <div className="relative flex">
        {/* Rank + icon column — or player illustration when playerImage is set */}
        <div className="shrink-0 w-[62px] sm:w-[74px] self-stretch flex items-stretch py-1.5 px-1">
          {rt.playerImage ? (
            <div className="flex-1 rounded-2xl overflow-hidden bg-white/[0.04]">
              <img src={rt.playerImage} alt="" className="w-full h-full object-contain" />
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2">
              <rt.Icon className="w-7 h-7 sm:w-8 sm:h-8 drop-shadow-[0_2px_8px_rgba(251,191,36,0.35)]" />
              <span className={`text-2xl sm:text-[28px] font-black italic leading-none tabular-nums ${a.num}`}>
                {String(rank).padStart(2, "0")}
              </span>
            </div>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 min-w-0 py-3 pr-3 pl-1">
          <div className="flex items-start gap-2 mb-2">
            <div className="flex-1 min-w-0">
              {/* Left to wrap rather than truncate — several of these labels are
                  long enough to lose their meaning when clipped on a phone. */}
              <h2 className="text-sm sm:text-base font-black uppercase tracking-tight text-white leading-tight">
                {rt.label}
              </h2>
              <p className={`text-[8.5px] sm:text-[10px] font-black uppercase tracking-[0.08em] sm:tracking-[0.12em] ${a.sub} leading-tight mt-0.5`}>
                {subtitle}
              </p>
            </div>
            {rt.ascending && !hasMore && (
              <span className="shrink-0 text-[9px] text-gray-500 font-black tracking-wider uppercase">Lower is better</span>
            )}
            {hasMore && (
              <button
                onClick={onToggle}
                style={{ touchAction: "manipulation" }}
                className={`shrink-0 flex items-center gap-1 rounded-full border px-2 py-1 text-[9px] font-black uppercase tracking-wider transition-colors ${a.pill}`}
              >
                {expanded ? "Show less" : "See more"}
                <svg
                  className={`w-2.5 h-2.5 transition-transform duration-300 ${expanded ? "rotate-180" : ""}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            )}
          </div>

          <Leaderboard entries={entries} rt={rt} expanded={expanded} />
          <YourBest entry={personalEntry} rt={rt} />
        </div>
      </div>
    </article>
  );
}

export default function DraftRecordsPage() {
  const [competition, setCompetition] = useState<"pl" | "all">("pl");
  const [mode, setMode] = useState<"normal" | "prime" | "best">("best");
  const [records, setRecords] = useState<Record<string, RecordEntry[]>>({});
  // The signed-in player's own personal best per board — shown as a "Your best"
  // line so a player always sees their record even when it's outside the global
  // top 5 or sitting below the hard-to-beat Official benchmark (e.g. assists,
  // where the Official 21 is rarely beaten and hides the user under "See more").
  const [personal, setPersonal] = useState<Record<string, { value: number; playerName: string | null; seasonNumber: number | null }>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSignedIn, setIsSignedIn] = useState<boolean | null>(null);
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  function toggleExpanded(key: string) {
    setExpandedKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  function handleModeChange(newMode: "normal" | "prime" | "best") {
    setMode(newMode);
    if (newMode === "best") setCompetition("all");
  }

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setIsSignedIn(!!user);
      if (!user) setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (isSignedIn !== true) return;
    setLoading(true);
    setError(null);

    type PersonalMap = Record<string, { value: number; playerName: string | null; seasonNumber: number | null }>;
    const isAscendingKey = (key: string) => key.split("_").slice(1).join("_") === "goals_conceded";
    // Merge the player's normal + prime personal bests, keeping the better value
    // per board (lower for goals_conceded, higher otherwise).
    const mergePersonal = (a: PersonalMap, b: PersonalMap): PersonalMap => {
      const out: PersonalMap = { ...a };
      for (const [key, entry] of Object.entries(b)) {
        const existing = out[key];
        if (!existing) { out[key] = entry; continue; }
        const better = isAscendingKey(key) ? entry.value < existing.value : entry.value > existing.value;
        if (better) out[key] = entry;
      }
      return out;
    };

    if (mode === "best") {
      Promise.all([
        fetch(`/api/draft/records?mode=normal`).then(r => r.json()),
        fetch(`/api/draft/records?mode=prime`).then(r => r.json()),
        fetch(`/api/draft/records?personal=true&mode=normal`).then(r => r.json()),
        fetch(`/api/draft/records?personal=true&mode=prime`).then(r => r.json()),
      ])
        .then(([normalData, primeData, normalPers, primePers]) => {
          if (normalData.error) throw new Error(normalData.error);
          if (primeData.error) throw new Error(primeData.error);

          const normalRec: Record<string, RecordEntry[]> = normalData.records ?? {};
          const primeRec: Record<string, RecordEntry[]> = primeData.records ?? {};

          const allKeys = Array.from(new Set([...Object.keys(normalRec), ...Object.keys(primeRec)]));
          const merged: Record<string, RecordEntry[]> = {};

          for (const key of allKeys) {
            const normal = (normalRec[key] ?? []).map(e => ({ ...e, mode: "normal" as const }));
            const prime = (primeRec[key] ?? []).map(e => ({ ...e, mode: "prime" as const }));
            const combined = [...normal, ...prime];
            const isAscending = isAscendingKey(key);
            combined.sort((a, b) => isAscending ? a.value - b.value : b.value - a.value);
            merged[key] = combined.slice(0, 5);
          }

          setRecords(merged);
          setPersonal(mergePersonal(normalPers?.personal ?? {}, primePers?.personal ?? {}));
        })
        .catch(e => setError(e.message))
        .finally(() => setLoading(false));
    } else {
      Promise.all([
        fetch(`/api/draft/records?mode=${mode}`).then(r => r.json()),
        fetch(`/api/draft/records?personal=true&mode=${mode}`).then(r => r.json()),
      ])
        .then(([d, p]) => {
          if (d.error) throw new Error(d.error);
          setRecords(d.records ?? {});
          setPersonal(p?.personal ?? {});
        })
        .catch(e => setError(e.message))
        .finally(() => setLoading(false));
    }
  }, [isSignedIn, mode]);

  if (isSignedIn === null) {
    return (
      <div className="min-h-screen bg-gray-950 text-white">
        <div className="max-w-2xl mx-auto px-4 py-8">
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-white text-sm">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  if (isSignedIn === false) {
    return (
      <div className="min-h-screen bg-gray-950 text-white">
        <div className="max-w-2xl mx-auto px-4 py-8">
          <Link
            href="/draft"
            className="inline-flex items-center gap-1.5 text-white hover:text-amber-300 text-sm font-medium mb-6 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Draft
          </Link>
          <h1 className="text-2xl font-black tracking-tight text-white mb-4">Hall of Fame</h1>
          <div className="bg-gray-900 rounded-xl p-6 border border-gray-800/50 text-center mt-4">
            <div className="text-3xl mb-3">&#128274;</div>
            <p className="text-lg font-bold text-white mb-2">Sign in to view the Hall of Fame</p>
            <p className="text-white text-sm mb-4">
              Sign in to see all-time records and leaderboards.
            </p>
            <Link
              href="/auth?next=/draft/records"
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 rounded-xl font-bold text-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              Sign In
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-2xl mx-auto px-3 sm:px-4 py-6">
        <Link
          href="/draft"
          className="inline-flex items-center gap-1.5 text-gray-300 hover:text-amber-300 text-sm font-bold mb-4 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Draft
        </Link>

        {/* ── Banner ── */}
        <HallOfFameBanner>
          <div className="flex flex-col items-center text-center">
            <CrownIcon className="w-9 h-6 sm:w-11 sm:h-8 mb-1 drop-shadow-[0_2px_8px_rgba(251,191,36,0.5)]" />
            <div className="flex items-center justify-center gap-2 sm:gap-3">
              <Laurel className="w-8 h-14 sm:w-11 sm:h-20 shrink-0" />
              <h1
                className="font-black uppercase italic tracking-tight leading-none"
                style={{
                  fontSize: "clamp(1.7rem, 8.5vw, 3rem)",
                  background: "linear-gradient(180deg,#ffffff 0%,#e5e7eb 42%,#9ca3af 72%,#6b7280 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  filter: "drop-shadow(0 2px 10px rgba(255,255,255,0.18))",
                }}
              >
                Hall of Fame
              </h1>
              <Laurel flip className="w-8 h-14 sm:w-11 sm:h-20 shrink-0" />
            </div>
            <p className="mt-1.5 text-[11px] sm:text-sm text-gray-300 font-medium">All-time season records</p>
            <p className="mt-0.5 text-[10px] sm:text-xs text-gray-400">
              <span className="text-amber-300 font-black">★ OFFICIAL</span> = real-world PL record to beat
            </p>
          </div>
        </HallOfFameBanner>

        {/* ── Mode tabs ── */}
        <div className="flex gap-1.5 mb-2.5 px-1">
          <AngledTab active={mode === "normal"} onClick={() => handleModeChange("normal")} tone="emerald">Normal</AngledTab>
          <AngledTab active={mode === "prime"} onClick={() => handleModeChange("prime")} tone="amber">Prime</AngledTab>
          <AngledTab active={mode === "best"} onClick={() => handleModeChange("best")} tone="violet">Best</AngledTab>
        </div>

        {/* ── Competition tabs ── */}
        <div className="flex gap-1.5 mb-5 px-1">
          <AngledTab active={competition === "pl"} onClick={() => setCompetition("pl")}>Premier League</AngledTab>
          <AngledTab active={competition === "all"} onClick={() => setCompetition("all")}>All Comps</AngledTab>
        </div>

        {loading && (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-white text-sm">Loading records...</p>
          </div>
        )}

        {error && (
          <div className="bg-red-900/20 border border-red-800/50 rounded-xl p-4 text-red-400 text-sm text-center">
            {error}
          </div>
        )}

        {!loading && !error && (() => {
          const visibleSeasonTypes = SEASON_RECORD_TYPES
            .filter(rt => !((rt.key === "most_points" && competition === "all") || (rt.key === "squad_ovr" && competition === "pl")));
          const visibleSeasonKeys = visibleSeasonTypes.map(rt => `${competition}_${rt.key}`);
          const visibleCareerKeys = competition === "all"
            ? CAREER_RECORD_TYPES.map(rt => `career_${rt.key}`)
            : [];
          const allVisibleKeys = [...visibleSeasonKeys, ...visibleCareerKeys];
          const allExpanded = allVisibleKeys.every(k => expandedKeys.has(k));
          const compLabel = competition === "pl" ? "Premier League" : "All Competitions";

          // Figures below are counted from what is actually on screen — nothing
          // here is estimated or padded.
          const boardsWithEntries = allVisibleKeys.filter(k => {
            const rt = [...SEASON_RECORD_TYPES, ...CAREER_RECORD_TYPES].find(t => k.endsWith(t.key));
            const raw = records[k] ?? [];
            return (rt ? mergeWithOfficial(raw, k, rt) : raw).length > 0;
          }).length;
          const holders = new Set<string>();
          for (const k of allVisibleKeys) {
            for (const e of records[k] ?? []) {
              if (e.username && e.username !== "Official") holders.add(e.username);
            }
          }
          const yourEntries = allVisibleKeys.filter(k => (personal[k]?.value ?? 0) > 0).length;
          const officialMarks = allVisibleKeys.filter(k => OFFICIAL[k]).length;

          return (
          <div className="space-y-3">
            <div className="flex justify-end px-1">
              <button
                onClick={() => setExpandedKeys(allExpanded ? new Set() : new Set(allVisibleKeys))}
                className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-gray-400 hover:text-amber-300 transition-colors"
              >
                {allExpanded ? "Collapse All" : "Expand All"}
                <svg
                  className={`w-3 h-3 transition-transform duration-300 ${allExpanded ? "rotate-180" : ""}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>

            {visibleSeasonTypes.map((rt, i) => {
              const key = `${competition}_${rt.key}`;
              const entries = mergeWithOfficial(records[key] ?? [], key, rt);
              return (
                <RecordCard
                  key={rt.key}
                  rt={rt}
                  rank={i + 1}
                  subtitle={`${compLabel} · Season Record`}
                  entries={entries}
                  personalEntry={personal[key]}
                  expanded={expandedKeys.has(key)}
                  onToggle={() => toggleExpanded(key)}
                />
              );
            })}

            {/* Career records — only in All Comps tab */}
            {competition === "all" && (
              <div className="pt-3 space-y-3">
                <div className="flex items-center gap-2.5 px-1">
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent to-amber-600/50" />
                  <span className="text-[10px] font-black tracking-[0.28em] text-amber-300 uppercase">Career Records</span>
                  <div className="h-px flex-1 bg-gradient-to-l from-transparent to-amber-600/50" />
                </div>
                {CAREER_RECORD_TYPES.map((rt, i) => {
                  const key = `career_${rt.key}`;
                  const entries = records[key] ?? [];
                  return (
                    <RecordCard
                      key={rt.key}
                      rt={rt}
                      rank={visibleSeasonTypes.length + i + 1}
                      subtitle="Career · All Competitions"
                      entries={entries}
                      personalEntry={personal[key]}
                      expanded={expandedKeys.has(key)}
                      onToggle={() => toggleExpanded(key)}
                    />
                  );
                })}
              </div>
            )}

            {/* ── Figures strip ── */}
            <div className="mt-2 rounded-2xl border border-white/10 bg-[linear-gradient(120deg,#11131b_0%,#0b0d13_60%,#0a0c11_100%)] px-3 py-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatTile label="Boards" value={String(boardsWithEntries)} caption="With a record" icon={<BoardIcon className="w-4 h-4" />} />
                <StatTile label="Holders" value={String(holders.size)} caption="On these boards" icon={<PeopleIcon className="w-4 h-4" />} />
                <StatTile label="Your marks" value={String(yourEntries)} caption="Boards you're on" icon={<StarIcon className="w-4 h-4" />} />
                <StatTile label="Official" value={String(officialMarks)} caption="Real-world marks" icon={<ShieldIcon className="w-4 h-4" />} />
              </div>
            </div>

            <p className="text-center text-gray-500 text-[11px] pb-4 pt-1">
              Only signed-in players appear on these boards. ★ Official = real-world PL benchmark.
            </p>
          </div>
          );
        })()}
      </div>
    </div>
  );
}
