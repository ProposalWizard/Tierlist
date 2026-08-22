"use client";
import { useEffect, useState } from "react";
import { STAR_FIFA_YEAR, STAR_EDITION_LABEL } from "@/lib/star/edition";
import type { StarPlayer } from "@/lib/star/types";
import { PREMIER_LEAGUE_CLUBS, CHAMPIONSHIP_CLUBS } from "@/lib/star/clubs";
import { leagueNameFor, type CareerDivision } from "@/lib/star/calendar";
import PortraitPicker from "./PortraitPicker";

interface Props {
  onComplete: (player: StarPlayer, clubs: string[], division: CareerDivision) => void;
}

/**
 * Both divisions a career can actually start in.
 *
 * Not the promotion pool — those five clubs play no season of their own, so
 * there is nothing to start a career IN. They only ever arrive in the
 * Championship by being promoted into it mid-career.
 *
 * Read from lib/star/clubs.ts rather than /api/draft/clubs, which is Draft
 * mode's own endpoint and answers a different question: every club that has
 * ever been in ITS archive's idea of the Premier League, across all editions.
 * This needs exactly this season's two divisions.
 */
const DIVISIONS: { key: CareerDivision; clubs: readonly string[] }[] = [
  { key: "premier", clubs: PREMIER_LEAGUE_CLUBS },
  { key: "championship", clubs: CHAMPIONSHIP_CLUBS },
];

const NATIONALITIES = ["England", "France", "Spain", "Germany", "Brazil", "Argentina", "Portugal", "Netherlands", "Italy", "Belgium"];

/**
 * There is nothing to choose here.
 *
 * The league step offered exactly one league — England, the Premier League,
 * this edition — as a full screen with a single un-clickable answer on it, and
 * the position step asked a sixteen-year-old to name the position he plays
 * before he has kicked a ball. Both are gone; setup is now name/age/nation,
 * then club.
 *
 * A position is still a thing a career HAS — `career.player.position` is read
 * everywhere from the team sheet to the scenario weighting — so it keeps a
 * default rather than becoming optional. Striker, which is what the picker
 * defaulted to anyway.
 */
const DEFAULT_POSITION = "ST";

export default function ProfileSetup({ onComplete }: Props) {
  const [step, setStep] = useState<1 | 2>(1);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [skin, setSkin] = useState<"light" | "dark">("light");
  const [age, setAge] = useState(16);
  const [nationality, setNationality] = useState("England");
  const [division, setDivision] = useState<CareerDivision>("premier");
  const [selectedClub, setSelectedClub] = useState("");
  const [portrait, setPortrait] = useState<string | undefined>(undefined);
  /**
   * Which clubs the database actually has a squad for this edition.
   *
   * Only ever an annotation — a club is still selectable without one, and
   * degrades to a generated squad exactly as it always has. It is here
   * because the Championship's own squads arrive by running a migration,
   * so "this club has no players yet" is a real and temporary state worth
   * saying out loud rather than letting somebody discover mid-career.
   */
  const [withData, setWithData] = useState<Set<string> | null>(null);

  const clubs = DIVISIONS.find(d => d.key === division)!.clubs;

  useEffect(() => {
    if (step !== 2 || withData) return;
    let alive = true;
    fetch("/api/draft/clubs")
      .then((r) => r.json())
      .then((d: { clubs?: { name: string; seasons: number[] }[] }) => {
        if (!alive) return;
        setWithData(new Set(
          (d.clubs ?? []).filter(c => c.seasons.includes(STAR_FIFA_YEAR)).map(c => c.name),
        ));
      })
      .catch(() => { if (alive) setWithData(new Set()); });
    return () => { alive = false; };
  }, [step, withData]);

  // Whichever division is showing, start on its first club rather than on
  // whatever was picked in the other one.
  useEffect(() => {
    setSelectedClub(prev => (clubs.includes(prev) ? prev : clubs[0] ?? ""));
  }, [clubs]);

  const canProceed1 = firstName.trim().length > 0 && lastName.trim().length > 0;
  const canFinish = selectedClub.length > 0;

  const submit = () => {
    onComplete(
      {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        age,
        skinTone: skin,
        club: selectedClub,
        clubBadge: null,
        position: DEFAULT_POSITION,
        nationality,
        startYear: STAR_FIFA_YEAR,
        ...(portrait ? { portrait } : {}),
      },
      [...clubs],
      division,
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-900 to-emerald-950 text-white flex flex-col items-center py-4 px-3">
      <div className="w-full max-w-sm">
        <div className="text-center mb-4">
          <div className="inline-block px-4 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-[10px] font-bold tracking-widest uppercase">
            Star Career
          </div>
          <h1 className="mt-2 text-2xl font-black text-white">Set up your player profile</h1>
          <div className="mt-1 text-xs text-emerald-300 font-bold">Step {step} of 2</div>
        </div>

        {step === 1 && (
          <div className="bg-gradient-to-b from-emerald-800 to-emerald-900 border border-emerald-600 rounded-2xl p-5 shadow-xl">
            <label className="block">
              <div className="bg-gray-700 text-white text-center font-black py-2 rounded-lg mb-1">First Name</div>
              <input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full bg-white text-black text-center font-bold py-2 rounded-lg outline-none"
                maxLength={20}
              />
            </label>
            <label className="block mt-4">
              <div className="bg-gray-700 text-white text-center font-black py-2 rounded-lg mb-1">Last Name</div>
              <input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full bg-white text-black text-center font-bold py-2 rounded-lg outline-none"
                maxLength={20}
              />
            </label>

            <div className="mt-4 grid grid-cols-3 gap-2 items-center">
              <div className="bg-gray-700 text-white text-center font-black py-2 rounded-lg">Skin</div>
              <button
                onClick={() => setSkin("light")}
                className={`h-10 rounded-lg border-2 transition ${skin === "light" ? "border-emerald-400 ring-2 ring-emerald-400" : "border-transparent"}`}
                style={{ background: "#d4a373" }}
              >
                {skin === "light" && <span className="text-emerald-300 font-black">✓</span>}
              </button>
              <button
                onClick={() => setSkin("dark")}
                className={`h-10 rounded-lg border-2 transition ${skin === "dark" ? "border-emerald-400 ring-2 ring-emerald-400" : "border-transparent"}`}
                style={{ background: "#4a2b18" }}
              >
                {skin === "dark" && <span className="text-emerald-300 font-black">✓</span>}
              </button>
            </div>

            <div className="mt-4">
              <div className="bg-gray-700 text-white text-center font-black py-2 rounded-lg mb-2">Age</div>
              <div className="grid grid-cols-3 gap-2">
                {[15, 16, 17].map((a) => (
                  <button
                    key={a}
                    onClick={() => setAge(a)}
                    className={`py-3 rounded-lg font-black text-lg transition ${age === a ? "bg-emerald-500 text-white ring-2 ring-emerald-300" : "bg-gray-800 text-white/85"}`}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4">
              <div className="bg-gray-700 text-white text-center font-black py-2 rounded-lg mb-2">Nationality</div>
              <select
                value={nationality}
                onChange={(e) => setNationality(e.target.value)}
                className="w-full bg-white text-black font-bold py-2 rounded-lg text-center outline-none"
              >
                {NATIONALITIES.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="bg-gradient-to-b from-emerald-800 to-emerald-900 border border-emerald-600 rounded-2xl p-5 shadow-xl">
            <div className="bg-gray-700 text-white text-center font-black py-2 rounded-lg mb-3">Choose Your Club</div>

            {/* Start in either division. A Championship career is the same
                career with a longer season and no European football — see
                lib/star/calendar. */}
            <div className="mb-3 flex gap-1.5">
              {DIVISIONS.map(d => (
                <button
                  key={d.key}
                  onClick={() => setDivision(d.key)}
                  className={`flex-1 rounded-lg py-2 text-[11px] font-black uppercase tracking-wide transition ${
                    division === d.key ? "bg-emerald-500 text-white" : "bg-gray-800 text-white/70 hover:bg-gray-700"}`}
                >
                  {leagueNameFor(d.key)}
                </button>
              ))}
            </div>

            <div className="max-h-72 overflow-y-auto space-y-1">
              {clubs.map((c) => {
                const missing = withData !== null && !withData.has(c);
                return (
                  <button
                    key={c}
                    onClick={() => setSelectedClub(c)}
                    className={`flex w-full items-center justify-between gap-2 rounded-lg py-2 px-3 text-left text-sm font-bold transition ${selectedClub === c ? "bg-emerald-500 text-white" : "bg-gray-800 text-white/85 hover:bg-gray-700"}`}
                  >
                    <span className="min-w-0 truncate">{c}</span>
                    {missing && (
                      <span
                        className="shrink-0 text-[9px] font-black uppercase tracking-wide text-amber-300"
                        title={`No ${STAR_EDITION_LABEL} squad in the database for this club yet — you can still start here, but its players will be made up until the data is imported.`}
                      >
                        No squad yet
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Last, and after the club, because the preview is drawn in that
                club's colours — offering it before you have picked one would
                mean showing you a shirt you might not end up wearing. */}
            {selectedClub && (
              <div className="mt-4">
                <PortraitPicker value={portrait} onChange={setPortrait} club={selectedClub} />
              </div>
            )}
          </div>
        )}

        <div className="flex gap-3 mt-5">
          {step > 1 && (
            <button
              onClick={() => setStep(1)}
              className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 rounded-xl font-black transition"
            >
              ← Back
            </button>
          )}
          {step === 1 && (
            <button
              onClick={() => setStep(2)}
              disabled={!canProceed1}
              className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-400 rounded-xl font-black transition disabled:opacity-40"
            >
              Continue →
            </button>
          )}
          {step === 2 && (
            <button
              onClick={submit}
              disabled={!canFinish}
              className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-400 rounded-xl font-black transition disabled:opacity-40"
            >
              ✓ Start Career
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
