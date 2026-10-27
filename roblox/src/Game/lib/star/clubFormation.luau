--!nocheck
--!nolint
-- Generated from lib/star/clubFormation.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_season = import("lib/star/season")
	local M_formations = import("lib/star/formations")
	local COMMON_SHAPES, formationForClub
	formationForClub = function(club)
		local h = 2166136261
		for i = 0, (S.len(club)) - 1 do
			h = Js.bxor(h, S.charCodeAt(club, i))
			h = Math.imul(h, 16777619)
		end
		local rng = M_season.mulberry32(Js.ushr(h, 0))
		rng()
		rng()
		local id = COMMON_SHAPES[math.floor((rng() * Js.alen(COMMON_SHAPES))) + 1]
		do return M_formations.formationOf((if A.some(M_formations.FORMATIONS, function(f)
			return (f.id == id)
		end) then id else "433")) end
	end
	exports.formationForClub = formationForClub
	COMMON_SHAPES = Js.alit("433", "4231", "442", "352", "4321", "4141", "3421")
end
