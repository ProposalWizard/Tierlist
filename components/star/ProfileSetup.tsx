"use client";
import { useEffect, useState } from "react";
import { STAR_FIFA_YEAR, STAR_SEASON_LABEL, STAR_EDITION_LABEL } from "@/lib/star/edition";
import type { StarPlayer } from "@/lib/star/types";
import PortraitPicker from "./PortraitPicker";

interface Props {
  onComplete: (player: StarPlayer, clubs: string[]) => void;
}

const POSITIONS = ["ST", "CAM", "LW", "RW", "CM", "CDM", "LM", "RM", "LB", "RB", "CB", "GK"];
const NATIONALITIES = ["England", "France", "Spain", "Germany", "Brazil", "Argentina", "Portugal", "Netherlands", "Italy", "Belgium"];

export default function ProfileSetup({ onComplete }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [skin, setSkin] = useState<"light" | "dark">("light");
  const [age, setAge] = useState(16);
  const [nationality, setNationality] = useState("England");
  const [position, setPosition] = useState("ST");
  const [clubs, setClubs] = useState<string[]>([]);
  const [selectedClub, setSelectedClub] = useState("");
  const [loading, setLoading] = useState(false);
  const [portrait, setPortrait] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (step !== 3 || clubs.length > 0) return;
    setLoading(true);
    fetch("/api/draft/clubs")
      .then((r) => r.json())
      .then((d: { clubs: { name: string; seasons: number[] }[] }) => {
        const inPl = (d.clubs ?? []).filter((c) => c.seasons.includes(STAR_FIFA_YEAR)).map((c) => c.name).sort();
        setClubs(inPl);
        if (inPl.length > 0) setSelectedClub(inPl[0]);
      })
      .finally(() => setLoading(false));
  }, [step, clubs.length]);

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
        position,
        nationality,
        startYear: STAR_FIFA_YEAR,
        ...(portrait ? { portrait } : {}),
      },
      clubs,
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
          <div className="mt-1 text-xs text-emerald-300 font-bold">Step {step} of 3</div>
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
            <div className="bg-gray-700 text-white text-center font-black py-2 rounded-lg mb-3">Choose League</div>
            <div className="bg-white text-emerald-600 text-center font-black text-2xl py-3 rounded-lg tracking-widest mb-4">
              ENGLAND
            </div>
            <div className="text-center text-emerald-300 text-xs mb-4">Premier League {STAR_SEASON_LABEL}</div>

            <div className="bg-gray-700 text-white text-center font-black py-2 rounded-lg mb-2">Position</div>
            <div className="grid grid-cols-4 gap-1.5">
              {POSITIONS.map((p) => (
                <button
                  key={p}
                  onClick={() => setPosition(p)}
                  className={`py-2 rounded-lg font-black text-sm transition ${position === p ? "bg-emerald-500 text-white ring-2 ring-emerald-300" : "bg-gray-800 text-white/85"}`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="bg-gradient-to-b from-emerald-800 to-emerald-900 border border-emerald-600 rounded-2xl p-5 shadow-xl">
            <div className="bg-gray-700 text-white text-center font-black py-2 rounded-lg mb-3">Choose Your Club</div>
            {loading && <div className="text-center py-6 text-emerald-300 text-sm">Loading clubs…</div>}
            {!loading && clubs.length === 0 && (
              <div className="text-center py-6 text-red-300 text-sm">
                No {STAR_SEASON_LABEL} PL clubs found. Check that {STAR_EDITION_LABEL} data is imported.
              </div>
            )}
            {!loading && clubs.length > 0 && (
              <div className="max-h-72 overflow-y-auto space-y-1">
                {clubs.map((c) => (
                  <button
                    key={c}
                    onClick={() => setSelectedClub(c)}
                    className={`w-full py-2 px-3 text-left font-bold text-sm rounded-lg transition ${selectedClub === c ? "bg-emerald-500 text-white" : "bg-gray-800 text-white/85 hover:bg-gray-700"}`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}

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
              onClick={() => setStep((s) => (s === 3 ? 2 : 1))}
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
              onClick={() => setStep(3)}
              className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-400 rounded-xl font-black transition"
            >
              Continue →
            </button>
          )}
          {step === 3 && (
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
