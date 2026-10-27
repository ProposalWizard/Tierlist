--!nocheck
--!nolint
-- Generated from lib/star/matchday.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local matchTeamStrength
	matchTeamStrength = function(career, fallback, _fixture)
		if (not career) then
			do return fallback end
		end
		local own = (function() local _v = career.league; if _v == nil then return nil end; _v = A.find(_v, function(t)
			return (t.name == career.player.club)
		end); if _v == nil then return nil end; _v = _v.strength; return _v end)()
		do return (if ((type(own) == "number") and Js.NumberNS.isFinite(own)) then own else fallback) end
	end
	exports.matchTeamStrength = matchTeamStrength
end
