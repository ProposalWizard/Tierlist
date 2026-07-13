"use client";

import { useState, useEffect } from "react";
import type { BDCareer, BDPlayer, BDPosition, BDArchetype, BDLegacyBest } from "@/lib/ballonDorTypes";
import { PL_CLUBS, initSeason, archetypeDefaults, inferArchetype, generateCareerRival, legacyTierMeta } from "@/lib/ballonDorEngine";

const LEGACY_BEST_KEY = "ballon-dor-legacy-best";

interface Props { onComplete: (career: BDCareer) => void; }

const POSITIONS: { value: BDPosition; label: string; desc: string; emoji: string }[] = [
  { value: 'GK',  label: 'Goalkeeper',  desc: 'Clean sheets, saves, sweeper', emoji: '🧤' },
  { value: 'DEF', label: 'Defender',    desc: 'Clean sheets, tackles, leadership', emoji: '🛡️' },
  { value: 'MID', label: 'Midfielder',  desc: 'Assists, goals, creativity', emoji: '🎯' },
  { value: 'ATT', label: 'Attacker',    desc: 'Goals, assists, Golden Boot', emoji: '⚡' },
];

const ARCHETYPES: { value: BDArchetype; label: string; emoji: string; desc: string; detail: string; color: string }[] = [
  {
    value: 'wonderkid',
    label: 'Wonderkid',
    emoji: '🌟',
    desc: 'Age 17 · 63 OVR · 92 POT',
    detail: 'Raw talent, sky-high ceiling. Starts weak but can become an all-time great over many seasons.',
    color: 'border-blue-500 bg-blue-500/10',
  },
  {
    value: 'rising_star',
    label: 'Rising Star',
    emoji: '⚡',
    desc: 'Age 21 · 74 OVR · 89 POT',
    detail: 'Already a top player with prime years ahead. Rapid growth, strong BdO potential within 3 seasons.',
    color: 'border-green-500 bg-green-500/10',
  },
  {
    value: 'world_class',
    label: 'World Class',
    emoji: '👑',
    desc: 'Age 26 · 84 OVR · 91 POT',
    detail: "At the absolute peak of your powers. Compete for the Ballon d'Or from season one.",
    color: 'border-amber-500 bg-amber-500/10',
  },
  {
    value: 'veteran',
    label: 'Elite Veteran',
    emoji: '🎖️',
    desc: 'Age 31 · 87 OVR · 89 POT',
    detail: "Experienced and decorated. One last great chapter to claim the ultimate prize before the decline.",
    color: 'border-purple-500 bg-purple-500/10',
  },
];

const NATIONALITIES = [
  'English','Spanish','French','German','Brazilian','Argentine','Portuguese','Italian','Dutch','Belgian',
  'Croatian','Uruguayan','Colombian','Moroccan','Senegalese','Nigerian','Ghanaian','Ivorian','Algerian',
  'Egyptian','Tunisian','Cameroonian','Japanese','South Korean','Australian','American','Canadian',
  'Serbian','Polish','Czech','Slovak','Swiss','Austrian','Danish','Swedish','Norwegian','Finnish',
  'Scottish','Welsh','Irish','Turkish','Ukrainian','Russian','Greek','Slovenian','Bosnian','Montenegrin',
  'Albanian','Georgian','Romanian','Hungarian','Bulgarian','Ecuadorian','Chilean','Mexican','Peruvian',
  'Paraguayan','Venezuelan','Honduran','Jamaican','South African','Malian','Guinean','Cape Verdean',
  'Congolese','Gabonese','Angolan','Zimbabwean','Kenyan','Saudi Arabian','Iranian','Qatari','Chinese',
  'New Zealander','Togolese','Burkinabe','North Macedonian','Kosovan',
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
  if (['CB','RB','LB','RWB','LWB'].some(x => p.includes(x))) return 'DEF';
  if (['CDM','CM','CAM','RM','LM'].some(x => p.includes(x))) return 'MID';
  return 'ATT';
}

export default function BDSetup({ onComplete }: Props) {
  const [tab, setTab] = useState<Tab>('custom');
  const [legacyBest, setLegacyBest] = useState<BDLegacyBest | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LEGACY_BEST_KEY);
      if (raw) setLegacyBest(JSON.parse(raw) as BDLegacyBest);
    } catch { /* ignore */ }
  }, []);

  const [name, setName] = useState('');
  const [archetype, setArchetype] = useState<BDArchetype>('world_class');
  const [position, setPosition] = useState<BDPosition>('ATT');
  const [nationality, setNationality] = useState('');
  const [clubId, setClubId] = useState(PL_CLUBS[0].id);

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
    const defaults = archetypeDefaults(archetype);
    const player: BDPlayer = {
      name: name.trim(),
      age: defaults.age,
      position,
      overall: defaults.overall,
      potential: defaults.potential,
      nationality: nationality.trim() || 'Unknown',
      isRealPlayer: false,
      archetype,
      reputation: 0,
    };
    const rival = generateCareerRival(player);
    const season = initSeason(player, club, 1, rival);
    onComplete({ player, seasons: [], current: season, bdoWins: 0, lastBdoRank: 0, rival, retired: false });
  }

  function startReal() {
    if (!selectedReal) return;
    const club = PL_CLUBS.find(c => c.id === realClubId) ?? PL_CLUBS[0];
    const pos = inferPosition(selectedReal.positions);
    const arch = inferArchetype(selectedReal.age, selectedReal.overall);
    const player: BDPlayer = {
      name: selectedReal.name,
      age: selectedReal.age,
      position: pos,
      overall: selectedReal.overall,
      potential: selectedReal.potential,
      nationality: selectedReal.nationality || 'Unknown',
      imageUrl: selectedReal.image_url ?? undefined,
      isRealPlayer: true,
      archetype: arch,
      reputation: Math.round(selectedReal.overall * 0.4),
    };
    const rival = generateCareerRival(player);
    const season = initSeason(player, club, 1, rival);
    onComplete({ player, seasons: [], current: season, bdoWins: 0, lastBdoRank: 0, rival, retired: false });
  }

  return (
    <div className="min-h-screen bg-black px-4 py-12">
      <div className="mx-auto max-w-lg">
        <div className="mb-10 text-center">
          <div className="mb-4 text-6xl">🏅</div>
          <h1 className="text-4xl font-black text-white" style={{ letterSpacing: '-0.02em' }}>
            {"Ballon d'Or"}
          </h1>
          <p className="mt-3 text-sm text-gray-400 leading-relaxed">
            Build a career. Win trophies. Claim the greatest individual prize in football.
          </p>
          {legacyBest && legacyBest.bestScore > 0 && (
            <div className="mt-4 inline-flex items-center gap-2 rounded-full border px-4 py-1.5"
              style={{ borderColor: legacyTierMeta(legacyBest.bestTier).color + '55', background: legacyTierMeta(legacyBest.bestTier).color + '14' }}>
              <span className="text-[11px] font-semibold text-gray-400">Best Legacy</span>
              <span className="text-sm font-black" style={{ color: legacyTierMeta(legacyBest.bestTier).color }}>
                {legacyBest.bestScore.toLocaleString()} · {legacyBest.bestTier}
              </span>
              <span className="text-[10px] text-gray-500">· {legacyBest.careers} career{legacyBest.careers !== 1 ? 's' : ''}</span>
            </div>
          )}
        </div>

        <div className="mb-6 flex rounded-xl border border-gray-800 bg-gray-900/60 p-1">
          {(['custom', 'real'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 rounded-lg py-2.5 text-sm font-bold transition ${
                tab === t ? 'bg-amber-500 text-black' : 'text-gray-400 hover:text-white'
              }`}
            >
              {t === 'custom' ? 'Create Player' : 'Real Player'}
            </button>
          ))}
        </div>

        {tab === 'custom' && (
          <div className="space-y-6">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-400">Player name</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Your name"
                className="w-full rounded-xl border border-gray-700 bg-gray-900/60 px-4 py-3 text-white placeholder-gray-600 focus:border-amber-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-400">Nationality</label>
              <input
                list="bd-nationality-list"
                value={nationality}
                onChange={e => setNationality(e.target.value)}
                placeholder="Start typing — e.g. English, Brazilian..."
                className="w-full rounded-xl border border-gray-700 bg-gray-900/60 px-4 py-3 text-white placeholder-gray-600 focus:border-amber-500 focus:outline-none"
              />
              <datalist id="bd-nationality-list">
                {NATIONALITIES.map(n => <option key={n} value={n} />)}
              </datalist>
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-400">Career archetype</label>
              <div className="grid grid-cols-2 gap-2.5">
                {ARCHETYPES.map(a => (
                  <button
                    key={a.value}
                    onClick={() => setArchetype(a.value)}
                    className={`rounded-xl border p-3.5 text-left transition ${
                      archetype === a.value ? a.color : 'border-gray-700 bg-gray-900/60 hover:border-gray-600'
                    }`}
                  >
                    <div className="mb-1 flex items-center gap-2">
                      <span className="text-lg">{a.emoji}</span>
                      <span className={`text-sm font-black ${archetype === a.value ? 'text-white' : 'text-gray-300'}`}>{a.label}</span>
                    </div>
                    <p className="text-[11px] font-semibold text-gray-400">{a.desc}</p>
                    {archetype === a.value && (
                      <p className="mt-1.5 text-[10px] leading-relaxed text-gray-300">{a.detail}</p>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-400">Position</label>
              <div className="grid grid-cols-2 gap-2">
                {POSITIONS.map(p => (
                  <button
                    key={p.value}
                    onClick={() => setPosition(p.value)}
                    className={`rounded-xl border p-3 text-left transition ${
                      position === p.value ? 'border-amber-500 bg-amber-500/10' : 'border-gray-700 bg-gray-900/60 hover:border-gray-600'
                    }`}
                  >
                    <div className="mb-0.5 flex items-center gap-1.5">
                      <span>{p.emoji}</span>
                      <span className={`text-sm font-bold ${position === p.value ? 'text-amber-400' : 'text-white'}`}>{p.label}</span>
                    </div>
                    <p className="text-[11px] text-gray-500">{p.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-400">Starting club</label>
              <select
                value={clubId}
                onChange={e => setClubId(e.target.value)}
                className="w-full rounded-xl border border-gray-700 bg-gray-900/60 px-4 py-3 text-white focus:border-amber-500 focus:outline-none"
              >
                {PL_CLUBS.map(c => (
                  <option key={c.id} value={c.id}>{c.name} — {c.tierLabel}</option>
                ))}
              </select>
            </div>

            <button
              onClick={startCustom}
              disabled={!name.trim()}
              className="w-full rounded-xl bg-amber-500 py-4 text-sm font-black text-black transition hover:bg-amber-400 disabled:opacity-40"
            >
              Begin Career →
            </button>
          </div>
        )}

        {tab === 'real' && (
          <div className="space-y-5">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-400">Search player</label>
              <div className="flex gap-2">
                <input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && doSearch()}
                  placeholder="e.g. Mbappe, Haaland..."
                  className="flex-1 rounded-xl border border-gray-700 bg-gray-900/60 px-4 py-3 text-white placeholder-gray-600 focus:border-amber-500 focus:outline-none"
                />
                <select
                  value={searchYear}
                  onChange={e => setSearchYear(e.target.value)}
                  className="rounded-xl border border-gray-700 bg-gray-900/60 px-3 py-3 text-sm text-white focus:border-amber-500 focus:outline-none"
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
              <div className="space-y-1.5 rounded-xl border border-gray-800 bg-gray-900/60 p-3">
                {results.map(r => (
                  <button
                    key={r.sofifa_id}
                    onClick={() => setSelectedReal(r)}
                    className={`w-full flex items-center gap-3 rounded-lg p-2.5 text-left transition ${
                      selectedReal?.sofifa_id === r.sofifa_id ? 'bg-amber-500/10 ring-1 ring-amber-500/50' : 'hover:bg-gray-800'
                    }`}
                  >
                    {r.image_url && <img src={r.image_url} alt={r.name} className="h-10 w-10 rounded-full object-cover" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white">{r.name}</p>
                      <p className="text-xs text-gray-400">{r.club} · {r.positions} · Age {r.age}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-amber-400">{r.overall}</p>
                      <p className="text-xs text-gray-500">{r.potential} POT</p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {selectedReal && (
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-400">Starting club</label>
                <select
                  value={realClubId}
                  onChange={e => setRealClubId(e.target.value)}
                  className="w-full rounded-xl border border-gray-700 bg-gray-900/60 px-4 py-3 text-white focus:border-amber-500 focus:outline-none"
                >
                  {PL_CLUBS.map(c => (
                    <option key={c.id} value={c.id}>{c.name} — {c.tierLabel}</option>
                  ))}
                </select>
                <p className="mt-2 text-xs text-gray-500">
                  {selectedReal.name} · {selectedReal.overall} OVR → {selectedReal.potential} POT · Age {selectedReal.age}
                </p>
              </div>
            )}

            <button
              onClick={startReal}
              disabled={!selectedReal}
              className="w-full rounded-xl bg-amber-500 py-4 text-sm font-black text-black transition hover:bg-amber-400 disabled:opacity-40"
            >
              {selectedReal ? `Begin as ${selectedReal.name} →` : 'Select a player first'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
