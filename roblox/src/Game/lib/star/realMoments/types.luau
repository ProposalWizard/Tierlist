--!nocheck
--!nolint
-- Generated from lib/star/realMoments/types.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_dataCredits = import("lib/star/dataCredits")
	local REAL_CREDIT = Js.O({ wyscout = M_dataCredits.creditLine("wyscout-moments"), dfl = M_dataCredits.creditLine("dfl-moments"), skillcorner = M_dataCredits.creditLine("skillcorner-moments"), soccertrack = M_dataCredits.creditLine("soccertrack-moments"), drafted = "Famous goals drafted by Knowitball from public match reports (scorer, minute, score, where it was struck and went in); names as labels only." }, { "wyscout", "dfl", "skillcorner", "soccertrack", "drafted" })
	exports.REAL_CREDIT = REAL_CREDIT
	local isFullyReal = function(m)
		return ((m.src ~= "wyscout") and (m.src ~= "drafted"))
	end
	exports.isFullyReal = isFullyReal
	local PICTURE_WORDS = Js.O({ full = "Fully real: every player where he really stood", placed = "Real shot, placed defenders: the shot is real, the others are placed by the game's rules" }, { "full", "placed" })
	exports.PICTURE_WORDS = PICTURE_WORDS
end
