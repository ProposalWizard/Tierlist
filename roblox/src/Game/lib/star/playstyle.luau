--!nocheck
--!nolint
-- Generated from lib/star/playstyle.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_season = import("lib/star/season")
	local PLAYSTYLES, MANAGER_PLAYSTYLES, playstyleForManager, STYLE_POOL, playstyleForClub
	playstyleForManager = function(manager)
		if (not Js.T(manager)) then
			do return nil end
		end
		local key = S.toLowerCase(manager)
		do
			local _arr1 = Js.Object.keys(MANAGER_PLAYSTYLES)
			local _i2 = 0
			while _i2 < Js.alen(_arr1) do
				_i2 += 1
				local surname = _arr1[_i2]
				if S.includes(key, surname) then
					do return PLAYSTYLES[MANAGER_PLAYSTYLES[surname]] end
				end
			end
		end
		do return nil end
	end
	exports.playstyleForManager = playstyleForManager
	playstyleForClub = function(club)
		local h = 2166136261
		for i = 0, (S.len(club)) - 1 do
			h = Js.bxor(h, S.charCodeAt(club, i))
			h = Math.imul(h, 16777619)
		end
		local rng = M_season.mulberry32(Js.bxor(Js.ushr(h, 0), 2654435769))
		rng()
		rng()
		do return PLAYSTYLES[STYLE_POOL[math.floor((rng() * Js.alen(STYLE_POOL))) + 1]] end
	end
	exports.playstyleForClub = playstyleForClub
	PLAYSTYLES = Js.O({ ["high-press"] = Js.O({ id = "high-press", name = "High press", lineBias = 4, compactness = 26, keeperSweep = 1, pressing = 0.95, counters = false, blurb = "press high and squeeze the pitch — beat the press and there's space in behind" }, { "id", "name", "lineBias", "compactness", "keeperSweep", "pressing", "counters", "blurb" }), possession = Js.O({ id = "possession", name = "Possession", lineBias = 3, compactness = 32, keeperSweep = 0.85, pressing = 0.8, counters = false, blurb = "keep the ball and hold a high line — you'll need to be patient and hit the space they leave" }, { "id", "name", "lineBias", "compactness", "keeperSweep", "pressing", "counters", "blurb" }), ["mid-block"] = Js.O({ id = "mid-block", name = "Mid-block", lineBias = 0, compactness = 28, keeperSweep = 0.5, pressing = 0.45, counters = false, blurb = "sit in two banks around halfway and stay compact — chances come from stretching them wide" }, { "id", "name", "lineBias", "compactness", "keeperSweep", "pressing", "counters", "blurb" }), ["low-block"] = Js.O({ id = "low-block", name = "Low block", lineBias = -5, compactness = 22, keeperSweep = 0.2, pressing = 0.15, counters = true, blurb = "sit deep and defend the box — little space centrally, so work the channels and shoot from range" }, { "id", "name", "lineBias", "compactness", "keeperSweep", "pressing", "counters", "blurb" }), counter = Js.O({ id = "counter", name = "Counter-attack", lineBias = -3, compactness = 25, keeperSweep = 0.35, pressing = 0.3, counters = true, blurb = "sit off and break fast — hold men back or they'll punish the turnover" }, { "id", "name", "lineBias", "compactness", "keeperSweep", "pressing", "counters", "blurb" }) }, { "high-press", "possession", "mid-block", "low-block", "counter" })
	exports.PLAYSTYLES = PLAYSTYLES
	MANAGER_PLAYSTYLES = Js.O({ klopp = "high-press", guardiola = "possession", pep = "possession", mourinho = "low-block", ferguson = "mid-block" }, { "klopp", "guardiola", "pep", "mourinho", "ferguson" })
	exports.MANAGER_PLAYSTYLES = MANAGER_PLAYSTYLES
	STYLE_POOL = Js.alit("high-press", "possession", "mid-block", "mid-block", "low-block", "counter")
end
