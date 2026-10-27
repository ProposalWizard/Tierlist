--!nocheck
--!nolint
-- Generated from lib/star/weather.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_season = import("lib/star/season")
	local CLEAR, conditionsFor, conditionsLine
	conditionsFor = function(season, week, homeCity)
		if homeCity == nil then homeCity = "" end
		local rng = M_season.mulberry32((((season * 7307) + (week * 131)) + S.len(homeCity)))
		local roll = rng()
		if (roll < 0.58) then
			do return CLEAR end
		end
		if (roll < 0.76) then
			local strength = (0.4 + (rng() * 0.6))
			do return Js.O({ weather = "wind", pitch = (rng() * 0.2), label = "Windy", note = "It is swirling. The ball will not hold its line.", drag = 1, friction = 1, bounce = 1, wind = (((if (rng() < 0.5) then -1 else 1) * strength) * 2.6) }, { "weather", "pitch", "label", "note", "drag", "friction", "bounce", "wind" }) end
		end
		if (roll < 0.92) then
			do return Js.O({ weather = "rain", pitch = (0.35 + (rng() * 0.3)), label = "Rain", note = "Greasy on top. It will skid on and it will run away from you.", drag = 1, friction = 0.62, bounce = 0.9, wind = 0 }, { "weather", "pitch", "label", "note", "drag", "friction", "bounce", "wind" }) end
		end
		do return Js.O({ weather = "heavy", pitch = (0.72 + (rng() * 0.28)), label = "Heavy pitch", note = "Cutting up badly. Nothing is running, and it is dying under you.", drag = 1.25, friction = 1.75, bounce = 0.6, wind = 0 }, { "weather", "pitch", "label", "note", "drag", "friction", "bounce", "wind" }) end
	end
	exports.conditionsFor = conditionsFor
	conditionsLine = function(c)
		do return (if (c.weather == "clear") then c.label else (c.label .. " — " .. c.note)) end
	end
	exports.conditionsLine = conditionsLine
	CLEAR = Js.O({ weather = "clear", pitch = 0, label = "Clear", note = "Perfect conditions.", drag = 1, friction = 1, bounce = 1, wind = 0 }, { "weather", "pitch", "label", "note", "drag", "friction", "bounce", "wind" })
end
