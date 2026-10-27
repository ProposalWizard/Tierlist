--!nocheck
--!nolint
-- Generated from lib/star/englishTopFlight.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_calendar = import("lib/star/calendar")
	local M_index = import("lib/star/world/index")
	local M_promotion = import("lib/star/promotion")
	local M_season = import("lib/star/season")
	local englishTopFlightTable, standInTopFlight
	englishTopFlightTable = function(career)
		if (M_calendar.divisionOf(career) == "premier") then
			do return career.league end
		end
		local _ok1, _err2, _rv3 = pcall(function()
			local played = A.find(M_index.finishWorld(career).leagues, function(l)
				return (l.division == "premier")
			end)
			if (played and (played.played >= played.rounds)) then
				do return Js.RET, played.teams end
			end
		end)
		if not _ok1 then
		elseif _err2 == Js.RET then
			return _rv3
		end
		do return standInTopFlight(career) end
	end
	exports.englishTopFlightTable = englishTopFlightTable
	standInTopFlight = function(career)
		if (M_calendar.divisionOf(career) == "premier") then
			do return career.league end
		end
		local clubs = M_promotion.membershipOf(career).premier
		local teams = A.map(clubs, function(name)
			return Js.O({ name = name, strength = M_promotion.estimateClubStrength(career, name), played = 0, won = 0, drawn = 0, lost = 0, goalsFor = 0, goalsAgainst = 0, points = 0 }, { "name", "strength", "played", "won", "drawn", "lost", "goalsFor", "goalsAgainst", "points" })
		end)
		local rng = M_season.mulberry32(((career.season * 6151) + 29))
		do
			local _arr4 = teams
			local _i5 = 0
			while _i5 < Js.alen(_arr4) do
				_i5 += 1
				local home = _arr4[_i5]
				do
					local _arr6 = teams
					local _i7 = 0
					while _i7 < Js.alen(_arr6) do
						_i7 += 1
						local away = _arr6[_i7]
						if (home == away) then
							do continue end
						end
						local s = M_season.simulateFixtureScore(home.strength, away.strength, rng)
						home.played += 1
						away.played += 1
						home.goalsFor += s.home
						home.goalsAgainst += s.away
						away.goalsFor += s.away
						away.goalsAgainst += s.home
						if (s.home > s.away) then
							home.won += 1
							away.lost += 1
							home.points += 3
						elseif (s.home < s.away) then
							away.won += 1
							home.lost += 1
							away.points += 3
						else
							home.drawn += 1
							away.drawn += 1
							home.points += 1
							away.points += 1
						end
					end
				end
			end
		end
		do return teams end
	end
	exports.standInTopFlight = standInTopFlight
end
