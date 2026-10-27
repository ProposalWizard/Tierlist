--!nocheck
--!nolint
-- Generated from lib/star/qualification.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_season = import("lib/star/season")
	local qualificationFor, seasonQualifiers
	qualificationFor = function(position, clubCount, wonFaCup, wonLeagueCup, wonEuroComp, extraChampionsLeagueSlots, extraEuropaLeagueSlots)
		if wonFaCup == nil then wonFaCup = false end
		if wonLeagueCup == nil then wonLeagueCup = false end
		if wonEuroComp == nil then wonEuroComp = false end
		if extraChampionsLeagueSlots == nil then extraChampionsLeagueSlots = 0 end
		if extraEuropaLeagueSlots == nil then extraEuropaLeagueSlots = 0 end
		local cl = (Math.round((clubCount * 0.25)) + extraChampionsLeagueSlots)
		if (position <= cl) then
			do return "Champions League" end
		end
		local sixthBand = ((cl + 1) + extraEuropaLeagueSlots)
		local earnsEuropaByLeague = (position <= sixthBand)
		local earnsEuropaByCup = (wonFaCup or wonLeagueCup)
		if (earnsEuropaByLeague or earnsEuropaByCup) then
			do return (if wonEuroComp then "Champions League" else "Europa League") end
		end
		if wonEuroComp then
			do return "Champions League" end
		end
		do return nil end
	end
	exports.qualificationFor = qualificationFor
	seasonQualifiers = function(league, faCupWinner, leagueCupWinner, europeanTrophyWinner, extraChampionsLeagueSlots, extraEuropaLeagueSlots)
		if europeanTrophyWinner == nil then europeanTrophyWinner = nil end
		if extraChampionsLeagueSlots == nil then extraChampionsLeagueSlots = 0 end
		if extraEuropaLeagueSlots == nil then extraEuropaLeagueSlots = 0 end
		local table_ = A.map(M_season.sortLeague(league), function(t)
			return t.name
		end)
		local cl = (Math.round((Js.alen(league) * 0.25)) + extraChampionsLeagueSlots)
		local champions = Js.Set.new(A.slice(table_, 0, cl))
		local sixthBand = ((cl + 1) + extraEuropaLeagueSlots)
		local europa = Js.Set.new(A.slice(table_, cl, sixthBand))
		local nextFree = function(fromIndex)
			local i = fromIndex
			while ((i < Js.alen(table_)) and (champions:has(table_[i + 1]) or europa:has(table_[i + 1]))) do
				i += 1
			end
			do return i end
		end
		local cascadeFrom = sixthBand
		do
			local _arr1 = Js.alit(faCupWinner, leagueCupWinner)
			local _i2 = 0
			while _i2 < Js.alen(_arr1) do
				_i2 += 1
				local winner = _arr1[_i2]
				if (not Js.T(winner)) then
					do continue end
				end
				if (champions:has(winner) or europa:has(winner)) then
					local i = nextFree(cascadeFrom)
					if (i < Js.alen(table_)) then
						europa:add(table_[i + 1])
						cascadeFrom = (i + 1)
					end
				else
					europa:add(winner)
				end
			end
		end
		if (Js.T(europeanTrophyWinner) and (not champions:has(europeanTrophyWinner))) then
			if europa:has(europeanTrophyWinner) then
				europa:delete(europeanTrophyWinner)
				champions:add(europeanTrophyWinner)
			else
				champions:add(europeanTrophyWinner)
			end
		end
		do return Js.O({ champions = Js.Array.from(champions), europa = Js.Array.from(europa) }, { "champions", "europa" }) end
	end
	exports.seasonQualifiers = seasonQualifiers
end
