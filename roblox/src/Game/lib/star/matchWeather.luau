--!nocheck
--!nolint
-- Generated from lib/star/matchWeather.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_weatherLab = import("lib/star/weatherLab")
	local homeClubOf, matchDials, matchConditions, WORD, weatherLine
	homeClubOf = function(career, fixture)
		if (fixture.kind == "international") then
			do return "" end
		end
		do return (if fixture.home then career.player.club else fixture.opponent) end
	end
	exports.homeClubOf = homeClubOf
	matchDials = function(career, fixture)
		local home = homeClubOf(career, fixture)
		local d = M_weatherLab.plannedDials(career.season, fixture.week, home, career.homeCity)
		do return (if Js.T(home) then d else Js.ospread(d, Js.O({ pitch = 1 }, { "pitch" }))) end
	end
	exports.matchDials = matchDials
	matchConditions = function(career, fixture)
		do return Js.ospread(M_weatherLab.buildConditions(matchDials(career, fixture)), Js.O({ drawn = true }, { "drawn" })) end
	end
	exports.matchConditions = matchConditions
	weatherLine = function(d)
		local w = (if ((d.weather == "wind") or ((d.windSpeed > 0) and (d.weather == "clear"))) then ("Windy " .. Js.numstr(Math.round(d.windSpeed)) .. " m/s") else WORD[d.weather])
		local p = S.replace(M_weatherLab.dialsPitchLabel(d), Js.re("^Pitch: ", ""), "")
		do return (w .. " · " .. p .. " pitch") end
	end
	exports.weatherLine = weatherLine
	WORD = Js.O({ clear = "Clear", wind = "Windy", rain = "Rain", heavy = "Heavy rain" }, { "clear", "wind", "rain", "heavy" })
end
