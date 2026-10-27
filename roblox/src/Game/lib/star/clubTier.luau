--!nocheck
--!nolint
-- Generated from lib/star/clubTier.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_clubs = import("lib/star/clubs")
	local tierOf, TIER_MULTIPLIER
	tierOf = function(club, career)
		if (((function() local _v = career.euroState; if _v == nil then return nil end; _v = _v.competition; return _v end)() == "Champions League") and A.some(career.euroState.clubs, function(c)
			return (c.name == club)
		end)) then
			do return "champions" end
		end
		if (((function() local _v = career.euroState; if _v == nil then return nil end; _v = _v.competition; return _v end)() == "Europa League") and A.some(career.euroState.clubs, function(c)
			return (c.name == club)
		end)) then
			do return "europa" end
		end
		local div = M_clubs.divisionOf(club)
		if (div == "champions") then
			do return "champions" end
		end
		if (div == "europa") then
			do return "europa" end
		end
		if (div == "championship") then
			do return "championship" end
		end
		if (div == "premier") then
			do return "premier" end
		end
		do return "other" end
	end
	exports.tierOf = tierOf
	TIER_MULTIPLIER = Js.O({ champions = 1.25, europa = 0.85, premier = 1, championship = 0.3, other = 0.55 }, { "champions", "europa", "premier", "championship", "other" })
	exports.TIER_MULTIPLIER = TIER_MULTIPLIER
end
