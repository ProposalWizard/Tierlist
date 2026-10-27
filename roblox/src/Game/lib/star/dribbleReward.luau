--!nocheck
--!nolint
-- Generated from lib/star/dribbleReward.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_pitch = import("lib/star/pitch")
	local TIER_DEPTH, TIER_KINDS, dribbleRewardTier, dribbleReward
	dribbleRewardTier = function(o)
		if o.cleared then
			do return (if (o.menBeaten >= (if o.bonusMen ~= nil then o.bonusMen else 7)) then 4 else 3) end
		end
		local total = Math.max(1, o.totalWaves)
		local f = (o.wavesBeaten / total)
		if (f >= 1) then
			do return 3 end
		end
		if (f >= 0.5) then
			do return 2 end
		end
		if (o.wavesBeaten > 0) then
			do return 1 end
		end
		do return 0 end
	end
	exports.dribbleRewardTier = dribbleRewardTier
	dribbleReward = function(o, rng)
		local tier = dribbleRewardTier(o)
		local table_ = TIER_KINDS[Js.key(tier)]
		local r = rng()
		local kind = table_[Js.alen(table_)][1]
		do
			local _arr1 = table_
			local _i2 = 0
			while _i2 < Js.alen(_arr1) do
				_i2 += 1
				local _e3 = _arr1[_i2]
				local k = _e3[1]
				local w = _e3[2]
				if (r < w) then
					kind = k
					do break end
				end
				r -= w
			end
		end
		local side = (if (o.mateX ~= nil) then Math.max(-10, Math.min(10, (o.mateX - M_pitch.CX))) else ((rng() - 0.5) * 12))
		local x = (M_pitch.CX + (side * (1 - (tier * 0.15))))
		local y = (TIER_DEPTH[Js.key(tier)] + ((rng() - 0.5) * 3))
		do return Js.O({ tier = tier, kind = kind, pos = Js.O({ x = x, y = y }, { "x", "y" }), ambition = 1 }, { "tier", "kind", "pos", "ambition" }) end
	end
	exports.dribbleReward = dribbleReward
	TIER_DEPTH = Js.O({ ["0"] = 36, ["1"] = 31, ["2"] = 25, ["3"] = 19, ["4"] = M_pitch.PEN_SPOT_Y }, { "0", "1", "2", "3", "4" })
	exports.TIER_DEPTH = TIER_DEPTH
	TIER_KINDS = Js.O({ ["0"] = Js.alit(Js.alit("midfield_pass", 0.5), Js.alit("long_range", 0.5)), ["1"] = Js.alit(Js.alit("long_range", 0.4), Js.alit("through_ball", 0.3), Js.alit("byline_cross", 0.3)), ["2"] = Js.alit(Js.alit("through_ball", 0.4), Js.alit("cutback", 0.4), Js.alit("tight_angle", 0.2)), ["3"] = Js.alit(Js.alit("cutback", 0.45), Js.alit("one_on_one", 0.35), Js.alit("tight_angle", 0.2)), ["4"] = Js.alit(Js.alit("one_on_one", 0.7), Js.alit("cutback", 0.3)) }, { "0", "1", "2", "3", "4" })
end
