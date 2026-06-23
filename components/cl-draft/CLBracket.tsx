"use client";
import type { CLFullBracket, CLBracketEntry } from "@/lib/clSimulator";

interface Props {
  bracket: CLFullBracket;
  playerTeamName?: string;
}

function MatchCard({ entry, playerTeamName }: { entry: CLBracketEntry; playerTeamName: string }) {
  return (
    <div className={`rounded overflow-hidden text-[10px] sm:text-xs w-28 sm:w-32 shrink-0 ${
      entry.isPlayerMatch ? "ring-1 ring-blue-500" : ""
    }`}>
      <div className={`px-1.5 py-1 truncate ${
        entry.winner === entry.teamA
          ? "bg-gray-700 font-semibold text-white"
          : "bg-gray-800 text-gray-500"
      } ${entry.teamA === playerTeamName ? "!text-blue-400" : ""}`}>
        {entry.teamA}
      </div>
      <div className={`px-1.5 py-1 truncate border-t border-gray-600 ${
        entry.winner === entry.teamB
          ? "bg-gray-700 font-semibold text-white"
          : "bg-gray-800 text-gray-500"
      } ${entry.teamB === playerTeamName ? "!text-blue-400" : ""}`}>
        {entry.teamB}
      </div>
      <div className="bg-gray-900/80 px-1.5 py-0.5 text-center text-gray-400 text-[9px]">
        {entry.scoreDisplay}
      </div>
    </div>
  );
}

function EmptyCard() {
  return (
    <div className="w-28 sm:w-32 h-12 border border-dashed border-gray-700 rounded flex items-center justify-center text-[10px] text-gray-600 shrink-0">
      TBD
    </div>
  );
}

export default function CLBracket({ bracket, playerTeamName = "KNOWITBALL FC" }: Props) {
  const leftR16 = bracket.roundOf16.slice(0, 4);
  const rightR16 = bracket.roundOf16.slice(4, 8);
  const leftQF = bracket.quarterFinals.slice(0, 2);
  const rightQF = bracket.quarterFinals.slice(2, 4);
  const leftSF = bracket.semiFinals.slice(0, 1);
  const rightSF = bracket.semiFinals.slice(1, 2);

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      {bracket.playoffRound.length > 0 && (
        <div className="mb-4 pb-3 border-b border-gray-700">
          <div className="text-xs text-gray-400 font-semibold mb-2 text-center">Playoff Round</div>
          <div className="flex flex-wrap justify-center gap-2">
            {bracket.playoffRound.map((entry, i) => (
              <MatchCard key={i} entry={entry} playerTeamName={playerTeamName} />
            ))}
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <div className="min-w-[700px] flex items-stretch gap-1 py-2" style={{ minHeight: "300px" }}>
          <div className="flex flex-col justify-around flex-1 gap-1">
            {leftR16.length > 0 ? leftR16.map((e, i) => (
              <MatchCard key={i} entry={e} playerTeamName={playerTeamName} />
            )) : Array.from({ length: 4 }, (_, i) => <EmptyCard key={i} />)}
          </div>

          <div className="flex flex-col justify-around flex-1">
            {leftQF.length > 0 ? leftQF.map((e, i) => (
              <MatchCard key={i} entry={e} playerTeamName={playerTeamName} />
            )) : Array.from({ length: 2 }, (_, i) => <EmptyCard key={i} />)}
          </div>

          <div className="flex flex-col justify-center flex-1">
            {leftSF.length > 0 ? (
              <MatchCard entry={leftSF[0]} playerTeamName={playerTeamName} />
            ) : <EmptyCard />}
          </div>

          <div className="flex flex-col justify-center items-center flex-1">
            <div className="text-[10px] text-yellow-400 font-bold mb-1">FINAL</div>
            {bracket.final ? (
              <MatchCard entry={bracket.final} playerTeamName={playerTeamName} />
            ) : <EmptyCard />}
            {bracket.final && (
              <div className="mt-1 text-[10px] text-yellow-400 font-semibold text-center truncate max-w-[128px]">
                {bracket.final.winner === playerTeamName ? "YOU WIN!" : bracket.final.winner}
              </div>
            )}
          </div>

          <div className="flex flex-col justify-center flex-1">
            {rightSF.length > 0 ? (
              <MatchCard entry={rightSF[0]} playerTeamName={playerTeamName} />
            ) : <EmptyCard />}
          </div>

          <div className="flex flex-col justify-around flex-1">
            {rightQF.length > 0 ? rightQF.map((e, i) => (
              <MatchCard key={i} entry={e} playerTeamName={playerTeamName} />
            )) : Array.from({ length: 2 }, (_, i) => <EmptyCard key={i} />)}
          </div>

          <div className="flex flex-col justify-around flex-1 gap-1">
            {rightR16.length > 0 ? rightR16.map((e, i) => (
              <MatchCard key={i} entry={e} playerTeamName={playerTeamName} />
            )) : Array.from({ length: 4 }, (_, i) => <EmptyCard key={i} />)}
          </div>
        </div>

        <div className="min-w-[700px] flex text-center text-[9px] text-gray-500 uppercase tracking-wider mt-1">
          <div className="flex-1">R16</div>
          <div className="flex-1">QF</div>
          <div className="flex-1">SF</div>
          <div className="flex-1"></div>
          <div className="flex-1">SF</div>
          <div className="flex-1">QF</div>
          <div className="flex-1">R16</div>
        </div>
      </div>
    </div>
  );
}
