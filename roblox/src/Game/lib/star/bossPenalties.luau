--!nocheck
--!nolint
-- Generated from lib/star/bossPenalties.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_pitch = import("lib/star/pitch")
	local SPOTS, BOSS_KICKS, BOSS_GAIN_PER_HIT, BOSS_NO_HITS, SPOT_LABEL, spotOf, spotCentre, pickSpots, bossGain, askLine, cap
	spotOf = function(x, z)
		local f = ((x - M_pitch.POST_L) / M_pitch.GOAL_W)
		if ((((f < 0) or (f > 1)) or (z < 0)) or (z > M_pitch.GOAL_H)) then
			do return nil end
		end
		local col = (if (f < (1 / 3)) then "left" else (if (f < (2 / 3)) then "middle" else "right"))
		local row = (if (z >= (M_pitch.GOAL_H / 2)) then "top" else "bottom")
		do return (row .. "-" .. col) end
	end
	exports.spotOf = spotOf
	spotCentre = function(s)
		local _d1 = S.split(s, "-")
		local row = _d1[1]
		local col = _d1[2]
		local ci = (if (col == "left") then 0 else (if (col == "middle") then 1 else 2))
		do return Js.O({ x = (M_pitch.POST_L + ((M_pitch.GOAL_W * (ci + 0.5)) / 3)), z = (if (row == "top") then (M_pitch.GOAL_H * 0.75) else (M_pitch.GOAL_H * 0.25)) }, { "x", "z" }) end
	end
	exports.spotCentre = spotCentre
	pickSpots = function(rng)
		local out = Js.alit()
		while (Js.alen(out) < BOSS_KICKS) do
			local s = SPOTS[math.floor((rng() * Js.alen(SPOTS))) + 1]
			if (s ~= out[Js.alen(out)]) then
				A.push(out, s)
			end
		end
		do return out end
	end
	exports.pickSpots = pickSpots
	bossGain = function(hits)
		do return (if (hits > 0) then (hits * BOSS_GAIN_PER_HIT) else BOSS_NO_HITS) end
	end
	exports.bossGain = bossGain
	askLine = function(s, kick, rng)
		local where = SPOT_LABEL[s]
		local lines = (if (kick == 0) then Js.alit(("Show me. " .. cap(where) .. " corner."), ("Let's see it. Put it " .. where .. "."), ("First one: " .. where .. ".")) else Js.alit(("Now " .. where .. "."), ("Next: " .. where .. ". Don't think about it."), (cap(where) .. ". Go on.")))
		do return S.replace(lines[math.floor((rng() * Js.alen(lines))) + 1], "middle corner", "middle") end
	end
	exports.askLine = askLine
	SPOTS = Js.alit("top-left", "top-middle", "top-right", "bottom-left", "bottom-middle", "bottom-right")
	exports.SPOTS = SPOTS
	BOSS_KICKS = 3
	exports.BOSS_KICKS = BOSS_KICKS
	BOSS_GAIN_PER_HIT = 2
	exports.BOSS_GAIN_PER_HIT = BOSS_GAIN_PER_HIT
	BOSS_NO_HITS = -2
	exports.BOSS_NO_HITS = BOSS_NO_HITS
	SPOT_LABEL = Js.O({ ["top-left"] = "top left", ["top-middle"] = "top middle", ["top-right"] = "top right", ["bottom-left"] = "bottom left", ["bottom-middle"] = "bottom middle", ["bottom-right"] = "bottom right" }, { "top-left", "top-middle", "top-right", "bottom-left", "bottom-middle", "bottom-right" })
	exports.SPOT_LABEL = SPOT_LABEL
	cap = function(s)
		return (S.toUpperCase(S.idx(s, 0)) .. S.slice(s, 1))
	end
end
