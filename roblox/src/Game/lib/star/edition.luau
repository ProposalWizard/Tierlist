--!nocheck
--!nolint
-- Generated from lib/star/edition.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local STAR_FIFA_YEAR = 2027
	exports.STAR_FIFA_YEAR = STAR_FIFA_YEAR
	local STAR_SEASON_LABEL = (Js.numstr((STAR_FIFA_YEAR - 1)) .. "/" .. S.padStart(Js.numstr(math.fmod(STAR_FIFA_YEAR, 100)), 2, "0"))
	exports.STAR_SEASON_LABEL = STAR_SEASON_LABEL
	local STAR_EDITION_LABEL = ("FC " .. S.padStart(Js.numstr(math.fmod(STAR_FIFA_YEAR, 100)), 2, "0"))
	exports.STAR_EDITION_LABEL = STAR_EDITION_LABEL
	local SQUAD_FETCH_INIT = Js.O({ cache = "no-store" }, { "cache" })
	exports.SQUAD_FETCH_INIT = SQUAD_FETCH_INIT
end
