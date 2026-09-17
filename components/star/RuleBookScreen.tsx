"use client";
import { useState, useEffect } from "react";
import type { CareerState } from "@/lib/star/types";
import { GOVERNING_BODIES, GOVERNING_BODY_COMPETITIONS, influenceIn, canProposeRuleChange, type GoverningBody } from "@/lib/star/governingBodies";
import { ruleBookFor, RULE_OVERRULE_INFLUENCE_THRESHOLD, type RuleBook } from "@/lib/star/ruleBook";
import { BOOTS_CATALOGUE } from "@/lib/star/shopData";
import { allInvestableClubs } from "@/lib/star/investments";
import { PREMIER_LEAGUE_CLUBS } from "@/lib/star/clubs";
import { replaceableClubsIn } from "@/lib/star/euro";
import { fetchCustomClubs, buildCustomClubEntry, type CustomClub } from "@/lib/star/customClubs";
import type { NewCompetitionState } from "@/lib/star/newCompetition";
import { isBodyPresident, canStandForBodyPresidency } from "@/lib/star/leadership";

/**
 * THE RULE BOOK — PHASE 4 OF STAR_POWER_POLITICS.MD, PLUS PHASE 5's BRIBERY.
 *
 * Invest real influence in a real governing body, then put its simplest,
 * most self-contained rules to a real vote (VoteCeremony, reused as-is from
 * Phase 2). Only the FA's rule book actually reaches anything this career
 * plays yet — see ruleBook.ts's own header for why UEFA/FIFA/CONMEBOL are
 * real, investable bodies without a visible effect for now. The optional
 * bribe below (Phase 5, corruption.ts) sways the resulting vote toward
 * "yes" at a real risk of getting caught — reduced, never removed, by also
 * hiring lawyers.
 */

interface ActionResult { ok: boolean; reason?: string; }

interface Props {
  career: CareerState;
  onBack: () => void;
  onInvest: (body: GoverningBody, amount: number) => ActionResult;
  onProposeChange: (body: GoverningBody, change: Partial<RuleBook>, bribe?: { amount: number; useLawyers: boolean }) => ActionResult;
  /** Phase 6 — §4.4 #10. */
  onForceClubIntoPremierLeague: (incomingClub: string) => ActionResult;
  /** Phase 6 — §4.4 #12. */
  onCreateCompetition: (name: string, entrants: string[]) => ActionResult;
  /** §5's end-game power fantasy — see lib/star/leadership.ts. */
  onStandForBodyPresidency: (body: GoverningBody) => ActionResult;
}

export default function RuleBookScreen({
  career, onBack, onInvest, onProposeChange, onForceClubIntoPremierLeague, onCreateCompetition,
  onStandForBodyPresidency,
}: Props) {
  const [body, setBody] = useState<GoverningBody>("FA");
  const [investAmount, setInvestAmount] = useState(10000);
  const [message, setMessage] = useState<string | null>(null);
  const [bribeAmount, setBribeAmount] = useState(0);
  const [useLawyers, setUseLawyers] = useState(false);
  const [banBoot, setBanBoot] = useState(BOOTS_CATALOGUE[0]?.id ?? "");
  const [incomingClub, setIncomingClub] = useState(allInvestableClubs().find(c => !PREMIER_LEAGUE_CLUBS.includes(c)) ?? "");
  const [newCompName, setNewCompName] = useState("Super League");
  const [customClubs, setCustomClubs] = useState<CustomClub[]>([]);
  const [customClubName, setCustomClubName] = useState("");
  const [customCompetition, setCustomCompetition] = useState<"champions" | "europa">("champions");
  const [customReplaces, setCustomReplaces] = useState("");
  const [proposingCustom, setProposingCustom] = useState(false);
  useEffect(() => { fetchCustomClubs().then(cs => { setCustomClubs(cs); if (cs[0]) setCustomClubName(cs[0].name); }); }, []);
  useEffect(() => {
    const options = replaceableClubsIn(customCompetition === "champions" ? "Champions League" : "Europa League", career);
    setCustomReplaces(options[0] ?? "");
  }, [customCompetition, career]);
  const rules = ruleBookFor(career, body);
  const influence = influenceIn(career, body);
  const canPropose = canProposeRuleChange(career, body);
  const canForceMovement = influenceIn(career, "FA") >= RULE_OVERRULE_INFLUENCE_THRESHOLD;
  const latestCompetition: NewCompetitionState | undefined = (career.newCompetitions ?? [])[(career.newCompetitions ?? []).length - 1];

  const run = (result: ActionResult) => setMessage(result.ok ? null : (result.reason ?? "That didn't go through."));
  const bribe = bribeAmount > 0 ? { amount: bribeAmount, useLawyers } : undefined;

  // Requested directly: vote a custom club (app/admin/custom-clubs) into
  // the Champions or Europa League. `replaces`/`strength` are decided HERE,
  // once, before the vote is even proposed — see ruleBook.ts's own note on
  // why that has to happen up front rather than at resolution time.
  const proposeCustomClub = async () => {
    if (!customClubName || !customReplaces) return;
    setProposingCustom(true);
    try {
      const entry = await buildCustomClubEntry(customClubName, customCompetition, customReplaces);
      run(onProposeChange(body, { customClubEntries: [...rules.customClubEntries, entry] }, bribe));
    } finally {
      setProposingCustom(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-800 to-gray-900 text-white flex flex-col py-3 px-3">
      <div className="w-full max-w-sm mx-auto flex-1">
        <div className="flex items-center justify-between mb-3">
          <button onClick={onBack} className="px-3 py-2 bg-gray-700 rounded-lg font-black text-sm">← Back</button>
          <div className="font-black text-white text-lg">Rule Book</div>
          <div />
        </div>

        <div className="grid grid-cols-4 gap-1 mb-3">
          {GOVERNING_BODIES.map(b => (
            <button
              key={b}
              onClick={() => { setBody(b); setMessage(null); }}
              className={`py-1.5 rounded-lg font-black text-[10px] uppercase transition ${
                body === b ? "bg-emerald-600" : "bg-gray-700 text-white"
              }`}
            >
              {b}
            </button>
          ))}
        </div>

        <div className="bg-gray-800 border border-gray-700 rounded-xl p-3 mb-3">
          <div className="text-[10px] font-black uppercase tracking-widest text-white mb-1">Controls</div>
          <div className="text-[11px] text-white font-semibold">{GOVERNING_BODY_COMPETITIONS[body].join(", ")}</div>
        </div>

        <div className="bg-emerald-900/30 border border-emerald-700 rounded-lg p-3 mb-3">
          <div className="flex items-center justify-between mb-2">
            <span className="font-black text-white text-sm">Your influence</span>
            <span className="font-black text-emerald-300 text-sm">{influence.toFixed(1)} / 100</span>
          </div>
          <div className="h-2 rounded-full bg-black/40 overflow-hidden mb-2">
            <div className="h-full bg-emerald-400" style={{ width: `${influence}%` }} />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number" min={0} value={investAmount} onChange={e => setInvestAmount(Math.max(0, Number(e.target.value)))}
              className="flex-1 rounded-lg bg-gray-900 border border-gray-700 px-2 py-1.5 text-sm text-white"
            />
            <button
              onClick={() => run(onInvest(body, investAmount))}
              disabled={investAmount <= 0 || investAmount > career.money}
              className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 font-black text-xs whitespace-nowrap"
            >
              Invest
            </button>
          </div>
          {!canPropose && <div className="mt-1.5 text-[9px] text-white font-semibold">Needs real influence before you can propose a rule change.</div>}
        </div>

        <div className="bg-amber-950/40 border border-amber-700 rounded-lg p-3 mb-3">
          <div className="text-[10px] font-black uppercase tracking-widest text-amber-300 mb-1.5">President / King (§5)</div>
          {isBodyPresident(career, body) ? (
            <div className="text-[11px] text-amber-200 font-bold">
              You are president of {body} — you can propose any rule change here regardless of influence, and overrule any vote in it outright.
            </div>
          ) : (
            <>
              <div className="text-[11px] text-white font-semibold mb-2">
                Needs 90+ world reputation and 90+ influence in this body — the "president or king" end-game the brief itself named, built as president of a governing body rather than an invented country.
              </div>
              <button
                disabled={!canStandForBodyPresidency(career, body)}
                onClick={() => run(onStandForBodyPresidency(body))}
                className="w-full py-1.5 rounded-md bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-[10px] font-black"
              >
                Stand for president of {body}
              </button>
            </>
          )}
        </div>

        {message && (
          <div className="mb-3 rounded-lg bg-red-900/60 border border-red-500/60 px-3 py-2 text-center text-[11px] font-bold text-red-200">
            {message}
          </div>
        )}

        <div className="bg-purple-950/40 border border-purple-700 rounded-lg p-3 mb-3">
          <div className="text-[10px] font-black uppercase tracking-widest text-purple-300 mb-1.5">
            Corruption (optional, Phase 5)
          </div>
          <div className="flex items-center gap-2 mb-1.5">
            <input
              type="number" min={0} value={bribeAmount} onChange={e => setBribeAmount(Math.max(0, Number(e.target.value)))}
              placeholder="Bribe amount"
              className="flex-1 rounded-lg bg-gray-900 border border-gray-700 px-2 py-1.5 text-sm text-white"
            />
          </div>
          <label className="flex items-center gap-2 text-[10px] text-white">
            <input type="checkbox" checked={useLawyers} onChange={e => setUseLawyers(e.target.checked)} />
            Hire lawyers first (★5000 — cuts the risk of getting caught, doesn&apos;t remove it)
          </label>
          <div className="mt-1.5 text-[9px] text-white font-semibold">
            {bribeAmount > 0 ? "Any proposal below will try to sway real votes toward yes, at a real risk." : "Leave at 0 to just propose honestly."}
          </div>
        </div>

        <div className="bg-gray-800 border border-gray-700 rounded-xl p-3 mb-2">
          <div className="text-[10px] font-black uppercase tracking-widest text-white mb-1.5">Points per result</div>
          <div className="text-[11px] text-white font-semibold mb-2">Win {rules.points.win} · Draw {rules.points.draw} · Loss {rules.points.loss}</div>
          <button
            disabled={!canPropose}
            onClick={() => run(onProposeChange(body, { points: { win: 2, draw: 1, loss: 0 } }, bribe))}
            className="w-full py-1.5 rounded-md bg-blue-600/80 hover:bg-blue-500 disabled:opacity-40 text-[10px] font-black"
          >
            Propose: 2 points for a win
          </button>
        </div>

        <div className="bg-gray-800 border border-gray-700 rounded-xl p-3 mb-2">
          <div className="text-[10px] font-black uppercase tracking-widest text-white mb-1.5">Draws</div>
          <div className="text-[11px] text-white font-semibold mb-2">{rules.noDraws ? "Every draw goes to penalties" : "Draws stand, as normal"}</div>
          <button
            disabled={!canPropose}
            onClick={() => run(onProposeChange(body, { noDraws: !rules.noDraws }, bribe))}
            className="w-full py-1.5 rounded-md bg-blue-600/80 hover:bg-blue-500 disabled:opacity-40 text-[10px] font-black"
          >
            Propose: {rules.noDraws ? "Bring back draws" : "Abolish draws — penalties every time"}
          </button>
        </div>

        <div className="bg-gray-800 border border-gray-700 rounded-xl p-3 mb-2">
          <div className="text-[10px] font-black uppercase tracking-widest text-white mb-1.5">Match length</div>
          <div className="text-[11px] text-white font-semibold mb-2">{rules.matchLengthMinutes} minutes</div>
          <div className="flex gap-1">
            <button
              disabled={!canPropose}
              onClick={() => run(onProposeChange(body, { matchLengthMinutes: 60 }, bribe))}
              className="flex-1 py-1.5 rounded-md bg-blue-600/80 hover:bg-blue-500 disabled:opacity-40 text-[10px] font-black"
            >
              Propose: 60 minutes
            </button>
            <button
              disabled={!canPropose}
              onClick={() => run(onProposeChange(body, { matchLengthMinutes: 120 }, bribe))}
              className="flex-1 py-1.5 rounded-md bg-blue-600/80 hover:bg-blue-500 disabled:opacity-40 text-[10px] font-black"
            >
              Propose: 120 minutes
            </button>
          </div>
        </div>

        <div className="bg-gray-800 border border-gray-700 rounded-xl p-3">
          <div className="text-[10px] font-black uppercase tracking-widest text-white mb-1.5">Banned equipment</div>
          <div className="text-[11px] text-white font-semibold mb-2">
            {rules.bannedItems.length > 0 ? `Banned: ${rules.bannedItems.join(", ")}` : "Nothing currently banned"}
          </div>
          <div className="flex items-center gap-2">
            <select value={banBoot} onChange={e => setBanBoot(e.target.value)} className="flex-1 rounded-lg bg-gray-900 border border-gray-700 px-2 py-1.5 text-sm text-white">
              {BOOTS_CATALOGUE.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <button
              disabled={!canPropose}
              onClick={() => {
                const already = rules.bannedItems.includes(banBoot);
                const next = already ? rules.bannedItems.filter(id => id !== banBoot) : [...rules.bannedItems, banBoot];
                run(onProposeChange(body, { bannedItems: next }, bribe));
              }}
              className="px-3 py-1.5 rounded-lg bg-blue-600/80 hover:bg-blue-500 disabled:opacity-40 font-black text-xs whitespace-nowrap"
            >
              {rules.bannedItems.includes(banBoot) ? "Unban" : "Ban"}
            </button>
          </div>
        </div>

        <div className="bg-gray-800 border border-gray-700 rounded-xl p-3 mt-2">
          <div className="text-[10px] font-black uppercase tracking-widest text-white mb-1.5">Offside</div>
          <div className="text-[11px] text-white font-semibold mb-2">{rules.offsideAbolished ? "Abolished — nobody is ever offside" : "The law applies, as normal"}</div>
          <button
            disabled={!canPropose}
            onClick={() => run(onProposeChange(body, { offsideAbolished: !rules.offsideAbolished }, bribe))}
            className="w-full py-1.5 rounded-md bg-blue-600/80 hover:bg-blue-500 disabled:opacity-40 text-[10px] font-black"
          >
            Propose: {rules.offsideAbolished ? "Bring back offside" : "Abolish offside entirely"}
          </button>
        </div>

        <div className="bg-gray-800 border border-gray-700 rounded-xl p-3 mt-2">
          <div className="text-[10px] font-black uppercase tracking-widest text-white mb-1.5">Squad size per side</div>
          <div className="text-[11px] text-white font-semibold mb-2">{rules.squadSize} a side</div>
          <div className="flex gap-1">
            <button disabled={!canPropose} onClick={() => run(onProposeChange(body, { squadSize: 9 }, bribe))} className="flex-1 py-1.5 rounded-md bg-blue-600/80 hover:bg-blue-500 disabled:opacity-40 text-[10px] font-black">Propose: 9 a side</button>
            <button disabled={!canPropose} onClick={() => run(onProposeChange(body, { squadSize: 20 }, bribe))} className="flex-1 py-1.5 rounded-md bg-blue-600/80 hover:bg-blue-500 disabled:opacity-40 text-[10px] font-black">Propose: 20 a side</button>
          </div>
          <div className="mt-1.5 text-[9px] text-white font-semibold">Real, votable data — the match/team-sheet engine still assumes 11 a side, so this doesn&apos;t change anything on the pitch yet.</div>
        </div>

        {body === "UEFA" && (
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-3 mt-2">
            <div className="text-[10px] font-black uppercase tracking-widest text-white mb-1.5">European slots for England</div>
            <div className="text-[11px] text-white font-semibold mb-2">
              +{rules.extraChampionsLeagueSlots} Champions League · +{rules.extraEuropaLeagueSlots} Europa League
            </div>
            <div className="flex gap-1 mb-1.5">
              <button disabled={!canPropose} onClick={() => run(onProposeChange(body, { extraChampionsLeagueSlots: rules.extraChampionsLeagueSlots + 1 }, bribe))} className="flex-1 py-1.5 rounded-md bg-blue-600/80 hover:bg-blue-500 disabled:opacity-40 text-[10px] font-black">+1 Champions League</button>
              <button disabled={!canPropose} onClick={() => run(onProposeChange(body, { extraEuropaLeagueSlots: rules.extraEuropaLeagueSlots + 1 }, bribe))} className="flex-1 py-1.5 rounded-md bg-blue-600/80 hover:bg-blue-500 disabled:opacity-40 text-[10px] font-black">+1 Europa League</button>
            </div>
            <div className="text-[10px] font-black uppercase tracking-widest text-white mb-1.5 mt-2">Champions League format</div>
            <div className="text-[11px] text-white font-semibold mb-2">{rules.championsLeagueFormat === "groups" ? "Groups of 4, then knockout" : "Single league-table phase"}</div>
            <button
              disabled={!canPropose}
              onClick={() => run(onProposeChange(body, { championsLeagueFormat: rules.championsLeagueFormat === "groups" ? "league" : "groups" }, bribe))}
              className="w-full py-1.5 rounded-md bg-blue-600/80 hover:bg-blue-500 disabled:opacity-40 text-[10px] font-black"
            >
              Propose: {rules.championsLeagueFormat === "groups" ? "Revert to the league phase" : "Groups of 4, then knockout"}
            </button>
            <div className="mt-1.5 text-[9px] text-white font-semibold">Real, votable data — the actual Champions League simulation still runs the current format regardless.</div>

            <div className="text-[10px] font-black uppercase tracking-widest text-white mb-1.5 mt-2">Saudi clubs in Europe</div>
            <div className="text-[11px] text-white font-semibold mb-2">
              {rules.saudiClubsInEurope
                ? "Active — two Saudi Pro League clubs join the Champions League and two join the Europa League each season."
                : "Not active — the Saudi Pro League has no entrants in either competition."}
            </div>
            <button
              disabled={!canPropose}
              onClick={() => run(onProposeChange(body, { saudiClubsInEurope: !rules.saudiClubsInEurope }, bribe))}
              className="w-full py-1.5 rounded-md bg-blue-600/80 hover:bg-blue-500 disabled:opacity-40 text-[10px] font-black"
            >
              Propose: {rules.saudiClubsInEurope ? "Remove Saudi clubs from Europe" : "Let Saudi clubs into Europe"}
            </button>
            <div className="mt-1.5 text-[9px] text-white font-semibold">
              Real: two of the four Saudi clubs join each competition, randomly replacing eligible clubs — England/Spain/Italy/Germany/France's clubs are always exempt, and the two Champions League clubs bumped out drop into the Europa League that season rather than disappearing.
            </div>

            <div className="text-[10px] font-black uppercase tracking-widest text-white mb-1.5 mt-3">Custom clubs in Europe</div>
            {customClubs.length === 0 ? (
              <div className="text-[11px] text-white">
                No custom clubs on file yet — create one at /admin/custom-clubs first.
              </div>
            ) : (
              <>
                {rules.customClubEntries.length > 0 && (
                  <div className="text-[11px] text-white font-semibold mb-2">
                    {rules.customClubEntries.map(e => `${e.customClub} in the ${e.competition === "champions" ? "Champions" : "Europa"} League (replacing ${e.replaces})`).join(" · ")}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-1.5 mb-1.5">
                  <select value={customClubName} onChange={e => setCustomClubName(e.target.value)} className="rounded-lg bg-gray-900 border border-gray-700 px-2 py-1.5 text-[11px] text-white">
                    {customClubs.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                  </select>
                  <select value={customCompetition} onChange={e => setCustomCompetition(e.target.value as "champions" | "europa")} className="rounded-lg bg-gray-900 border border-gray-700 px-2 py-1.5 text-[11px] text-white">
                    <option value="champions">Champions League</option>
                    <option value="europa">Europa League</option>
                  </select>
                </div>
                <div className="mb-1.5">
                  <div className="text-[9px] text-white mb-1">Replaces (weakest eligible clubs first)</div>
                  <select value={customReplaces} onChange={e => setCustomReplaces(e.target.value)} className="w-full rounded-lg bg-gray-900 border border-gray-700 px-2 py-1.5 text-[11px] text-white">
                    {replaceableClubsIn(customCompetition === "champions" ? "Champions League" : "Europa League", career).map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <button
                  disabled={!canPropose || proposingCustom || !customClubName || !customReplaces}
                  onClick={proposeCustomClub}
                  className="w-full py-1.5 rounded-md bg-blue-600/80 hover:bg-blue-500 disabled:opacity-40 text-[10px] font-black"
                >
                  {proposingCustom ? "Working out its real strength…" : `Propose: ${customClubName} into the ${customCompetition === "champions" ? "Champions" : "Europa"} League`}
                </button>
                <div className="mt-1.5 text-[9px] text-white font-semibold">
                  Real: the custom club's OWN squad decides its real strength, and the real club it replaces stays out for good — England/Spain/Italy/Germany/France's clubs are always exempt from being the one replaced.
                </div>
              </>
            )}
          </div>
        )}

        <div className="bg-red-950/40 border border-red-800 rounded-xl p-3 mt-2">
          <div className="text-[10px] font-black uppercase tracking-widest text-red-300 mb-1.5">Force a club into the Premier League</div>
          <div className="text-[11px] text-white font-semibold mb-2">
            Needs {RULE_OVERRULE_INFLUENCE_THRESHOLD}+ FA influence — the same bar as overruling a vote outright.
          </div>
          <div className="flex items-center gap-2">
            <select value={incomingClub} onChange={e => setIncomingClub(e.target.value)} className="flex-1 rounded-lg bg-gray-900 border border-gray-700 px-2 py-1.5 text-sm text-white">
              {/* Custom clubs (app/admin/custom-clubs) work here with no
                  special-casing at all — forceClubIntoPremierLeague just
                  inserts whatever name it's given into career.divisions,
                  real or invented, so they're offered right alongside every
                  real club. */}
              {customClubs.length > 0 && (
                <optgroup label="Custom clubs">
                  {customClubs.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                </optgroup>
              )}
              <optgroup label="Real clubs">
                {allInvestableClubs().filter(c => !PREMIER_LEAGUE_CLUBS.includes(c)).slice(0, 100).map(c => <option key={c} value={c}>{c}</option>)}
              </optgroup>
            </select>
            <button
              disabled={!canForceMovement || !incomingClub}
              onClick={() => run(onForceClubIntoPremierLeague(incomingClub))}
              className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-40 font-black text-xs whitespace-nowrap"
            >
              Force it in
            </button>
          </div>
        </div>

        <div className="bg-gray-800 border border-gray-700 rounded-xl p-3 mt-2">
          <div className="text-[10px] font-black uppercase tracking-widest text-white mb-1.5">Create a new competition</div>
          <div className="flex items-center gap-2 mb-2">
            <input value={newCompName} onChange={e => setNewCompName(e.target.value)} className="flex-1 rounded-lg bg-gray-900 border border-gray-700 px-2 py-1.5 text-sm text-white" />
            <button
              disabled={!canPropose || !newCompName}
              onClick={() => run(onCreateCompetition(newCompName, [...PREMIER_LEAGUE_CLUBS]))}
              className="px-3 py-1.5 rounded-lg bg-blue-600/80 hover:bg-blue-500 disabled:opacity-40 font-black text-xs whitespace-nowrap"
            >
              Create
            </button>
          </div>
          {latestCompetition?.winner && (
            <div className="text-[11px] text-emerald-300 font-bold">
              {latestCompetition.name}: {latestCompetition.winner} won it, seeing off the whole bracket.
            </div>
          )}
        </div>

        <div className="mt-3 text-[9px] text-center text-white font-semibold">
          Only the FA&apos;s rule book actually reaches your own league and matches right now — the other bodies are real, but nothing they govern is simulated deeply enough yet to feel it.
        </div>
      </div>
    </div>
  );
}
