"use client";

import { useState } from "react";
import type { BDCareer, BDPlayer, BDPosition } from "@/lib/ballonDorTypes";
import { PL_CLUBS, initSeason } from "@/lib/ballonDorEngine";

interface Props { onComplete: (career: BDCareer) => void; }

const POSITIONS: { value: BDPosition; label: string; desc: string }[] = [
  { value: 'GK',  label: 'Goalkeeper',  desc: 'Clean sheets, saves, command' },
  { value: 'DEF', label: 'Defender',    desc: 'Clean sheets, tackles, leadership' },
  { value: 'MID', label: 'Midfielder',  desc: 'Assists, goals, creativity' },
  { value: 'ATT', label: 'Attacker',    desc: 'Goals, assists, golden boot' },
];

type Tab = 'custom' | 'real';

interface RealPlayerResult {
  sofifa_id: number;
  name: string;
  overall: number;
  potential: number;
  positions: string;
  age: number;
  nationality: string;
  image_url: string | null;
  club: string;
}

function inferPosition(positions: string): BDPosition {
  const p = (positions || '').toUpperCase();
  if (p.includes('GK')) return 'GK';
  if (['CB','RB','LB','RWB','LWB','SW'].some(x => p.includes(x))) return 'DEF';
  if (['CDM','CM','CAM','RM','LM','DM'].some(x => p.includes(x))) return 'MID';
  return 'ATT';
}

export default function BDSetup({ onComplete }: Props) {
  const [tab, setTab] = useState<Tab>('custom');

  // Custom player state
  const [name, setName] = useState('');
  const [age, setAge] = useState(18);
  const [position, setPosition] = useState<BDPosition>('ATT');
  const [potential, setPotential] = useState(90);
  const [nationality, setNationality] = useState('');
  const [clubId, setClubId] = useState(PL_CLUBS[0].id);

  // Real player state
  const [query, setQuery] = useState('');
  const [searchYear, setSearchYear] = useState('26');
  const [results, setResults] = useState<RealPlayerResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedReal, setSelectedReal] = useState<RealPlayerResult | null>(null);
  const [realClubId, setRealClubId] = useState(PL_CLUBS[0].id);

  async function doSearch() {
    if (query.length < 2) return;
    setSearching(true);
    try {
      const res = await fetch(`/api/ballon-dor/player-search?q=${encodeURIComponent(query)}&year=${searchYear}`);
      const json = await res.json();
      setResults(json.players ?? []);
    } finally {
      setSearching(false);
    }
  }

  function startCustom() {
    if (!name.trim()) return;
    const club = PL_CLUBS.find(c => c.id === clubId) ?? PL_CLUBS[0];
    const ovr = Math.max(55, Math.round(potential * 0.72 + age * 0.3 - 4));
    const player: BDPlayer = {
      name: name.trim(), age, position, overall: Math.min(potential - 5, ovr),
      potential, nationality: nationality.trim() || 'Unknown', isRealPlayer: false,
    };
    const season = initSeason(player, club, 1);
    onComplete({ player, seasons: [], current: season, bdoWins: 0, lastBdoRank: 0 });
  }

  function startReal() {
    if (!selectedReal) return;
    const club = PL_CLUBS.find(c => c.id === realClubId) ?? PL_CLUBS[0];
    const pos = inferPosition(selectedReal.positions);
    const player: BDPlayer = {
      name: selectedReal.name,
      age: selectedReal.age,
      position: pos,
      overall: selectedReal.overall,
      potential: selectedReal.potential,
      nationality: selectedReal.nationality || 'Unknown',
      imageUrl: selectedReal.image_url ?? undefined,
      isRealPlayer: true,
    };
    const season = initSeason(player, club, 1);
    onComplete({ player, seasons: [], current: season, bdoWins: 0, lastBdoRank: 0 });
  }

  return (
    <div className="min-h-screen bg-gray-950 px-4 py-12">
      <div className="mx-auto max-w-lg">
        {/* Header */}
        <div className="mb-10 text-center">
          <div className="mb-3 text-5xl">🏅</div>
          <h1 className="text-3xl font-black text-white">Ballon d'Or</h1>
          <p className="mt-2 text-sm text-gray-400">
            Build a career. Win trophies. Claim the greatest individual prize in football.
          </p>
        </div>

        {/* Tab switcher */}
        <div className="mb-6 flex rounded-xl border border-gray-800 bg-gray-900 p-1">
          {(['custom', 'real'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${
                tab === t ? 'bg-amber-500 text-black' : 'text-gray-400 hover:text-white'
              }`}
            >
              {t === 'custom' ? 'Create Player' : 'Real Player'}
            </button>
          ))}
        </div>

        {tab === 'custom' && (
          <div className="space-y-5">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-400">
                Player name
              </label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Your name"
                className="w-full rounded-xl border border-gray-700 bg-gray-900 px-4 py-3 text-white placeholder-gray-600 focus:border-amber-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Starting age
                </label>
                <input
                  type="number" min={16} max={28} value={age}
                  onChange={e => setAge(Number(e.target.value))}
                  className="w-full rounded-xl border border-gray-700 bg-gray-900 px-4 py-3 text-white focus:border-amber-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Peak potential
                </label>
                <input
                  type="number" min={70} max={99} value={potential}
                  onChange={e => setPotential(Number(e.target.value))}
                  className="w-full rounded-xl border border-gray-700 bg-gray-900 px-4 py-3 text-white focus:border-amber-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-400">
                Nationality (optional)
              </label>
              <input
                value={nationality}
                onChange={e => setNationality(e.target.value)}
                placeholder="e.g. English, Brazilian..."
                className="w-full rounded-xl border border-gray-700 bg-gray-900 px-4 py-3 text-white placeholder-gray-600 focus:border-amber-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-400">Position</label>
              <div className="grid grid-cols-2 gap-2">
                {POSITIONS.map(p => (
                  <button
                    key={p.value}
                    onClick={() => setPosition(p.value)}
                    className={`rounded-xl border p-3 text-left transition ${
                      position === p.value
                        ? 'border-amber-500 bg-amber-500/10'
                        : 'border-gray-700 bg-gray-900 hover:border-gray-600'
                    }`}
                  >
                    <p className={`text-sm font-bold ${position === p.value ? 'text-amber-400' : 'text-white'}`}>{p.label}</p>
                    <p className="mt-0.5 text-xs text-gray-500">{p.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-400">Starting club</label>
              <select
                value={clubId}
                onChange={e => setClubId(e.target.value)}
                className="w-full rounded-xl border border-gray-700 bg-gray-900 px-4 py-3 text-white focus:border-amber-500 focus:outline-none"
              >
                {PL_CLUBS.map(c => (
                  <option key={c.id} value={c.id}>{c.name} (Prestige {c.prestige})</option>
                ))}
              </select>
            </div>

            <button
              onClick={startCustom}
              disabled={!name.trim()}
              className="w-full rounded-xl bg-amber-500 py-3.5 text-sm font-black text-black transition hover:bg-amber-400 disabled:opacity-40"
            >
              Begin Career →
            </button>
          </div>
        )}

        {tab === 'real' && (
          <div className="space-y-5">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-400">
                Search player
              </label>
              <div className="flex gap-2">
                <input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && doSearch()}
                  placeholder="e.g. Mbappe, Haaland..."
                  className="flex-1 rounded-xl border border-gray-700 bg-gray-900 px-4 py-3 text-white placeholder-gray-600 focus:border-amber-500 focus:outline-none"
                />
                <select
                  value={searchYear}
                  onChange={e => setSearchYear(e.target.value)}
                  className="rounded-xl border border-gray-700 bg-gray-900 px-3 py-3 text-sm text-white focus:border-amber-500 focus:outline-none"
                >
                  {['26','25','24','23','22','21','20','19','18','17','16','15','14','13','12','11','10','09','08','07'].map(y => (
                    <option key={y} value={y}>FIFA {y}</option>
                  ))}
                </select>
                <button
                  onClick={doSearch}
                  disabled={searching || query.length < 2}
                  className="rounded-xl bg-amber-500 px-4 py-3 text-sm font-bold text-black transition hover:bg-amber-400 disabled:opacity-40"
                >
                  {searching ? '...' : 'Search'}
                </button>
              </div>
            </div>

            {results.length > 0 && (
              <div className="space-y-2 rounded-xl border border-gray-800 bg-gray-900 p-3">
                {results.map(r => (
                  <button
                    key={r.sofifa_id}
                    onClick={() => setSelectedReal(r)}
                    className={`w-full flex items-center gap-3 rounded-lg p-2.5 text-left transition ${
                      selectedReal?.sofifa_id === r.sofifa_id
                        ? 'bg-amber-500/10 ring-1 ring-amber-500/50'
                        : 'hover:bg-gray-800'
                    }`}
                  >
                    {r.image_url && (
                      <img src={r.image_url} alt={r.name} className="h-10 w-10 rounded-full object-cover" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white">{r.name}</p>
                      <p className="text-xs text-gray-400">{r.club} · {r.positions} · Age {r.age}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-amber-400">{r.overall}</p>
                      <p className="text-xs text-gray-500">→{r.potential}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {selectedReal && (
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-400">Starting club (Premier League)</label>
                <select
                  value={realClubId}
                  onChange={e => setRealClubId(e.target.value)}
                  className="w-full rounded-xl border border-gray-700 bg-gray-900 px-4 py-3 text-white focus:border-amber-500 focus:outline-none"
                >
                  {PL_CLUBS.map(c => (
                    <option key={c.id} value={c.id}>{c.name} (Prestige {c.prestige})</option>
                  ))}
                </select>
                <p className="mt-2 text-xs text-gray-500">
                  Playing as {selectedReal.name} ({selectedReal.overall} OVR → {selectedReal.potential} POT)
                </p>
              </div>
            )}

            <button
              onClick={startReal}
              disabled={!selectedReal}
              className="w-full rounded-xl bg-amber-500 py-3.5 text-sm font-black text-black transition hover:bg-amber-400 disabled:opacity-40"
            >
              {selectedReal ? `Begin as ${selectedReal.name} →` : 'Select a player first'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
