--!nocheck
--!nolint
-- Generated from lib/star/relationships.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_pitch = import("lib/star/pitch")
	local REL_KEYS, MATCH_REL_CAP, capRel, REL_GAIN_SCALE, DRIFT_HIGH, DRIFT_LOW, clamp, scaledChange, stepBar, drift, happinessOf, happinessEnergyFactor, gameReward, gamePlayedThisWeek, FRAME_HIT, touchingFrame
	scaledChange = function(value, raw)
		if (raw > 0) then
			do return ((raw * REL_GAIN_SCALE) * Math.max(0, (1 - (value / 105)))) end
		end
		if (raw < 0) then
			do return (raw * (0.4 + (value / 160))) end
		end
		do return 0 end
	end
	exports.scaledChange = scaledChange
	stepBar = function(value, carry, raw, matchNo)
		local exact = ((value + carry) + scaledChange(value, raw))
		local next_ = clamp(Math.round(exact))
		local rest = (if ((next_ == 0) or (next_ == 100)) then 0 else (exact - next_))
		rest = Math.max(-0.5, Math.min(0.5, rest))
		next_ = drift(next_, matchNo)
		do return Js.O({ value = next_, carry = rest }, { "value", "carry" }) end
	end
	exports.stepBar = stepBar
	drift = function(value, matchNo)
		if ((value > DRIFT_HIGH) and (math.fmod(matchNo, 3) == 0)) then
			do return (value - 1) end
		end
		if ((value < DRIFT_LOW) and (math.fmod(matchNo, 2) == 0)) then
			do return (value + 1) end
		end
		do return value end
	end
	exports.drift = drift
	happinessOf = function(c)
		local r = c.relationships
		if (not r) then
			do return 50 end
		end
		do return clamp(Math.round((((r.boss + r.team) + r.fans) / 3))) end
	end
	exports.happinessOf = happinessOf
	happinessEnergyFactor = function(happiness)
		local h = clamp((if happiness ~= nil then happiness else 50))
		do return (0.7 + (h * 0.006)) end
	end
	exports.happinessEnergyFactor = happinessEnergyFactor
	gameReward = function(won, current, roll, kind)
		if (not won) then
			do return (if (kind == "boss") then -2 else -1) end
		end
		if (current < 40) then
			do return 6 end
		end
		if (current < 70) then
			do return 4 end
		end
		if (current <= 85) then
			do return 2 end
		end
		do return (if (roll < 0.5) then 1 else 0) end
	end
	exports.gameReward = gameReward
	gamePlayedThisWeek = function(played, season, week, kind)
		do return ((((not (not played)) and (played.season == season)) and (played.week == week)) and A.includes(played.kinds, kind)) end
	end
	exports.gamePlayedThisWeek = gamePlayedThisWeek
	touchingFrame = function(b)
		if ((b.y > 0.6) or (b.y < -0.3)) then
			do return false end
		end
		local nearPost = (((math.abs((b.x - M_pitch.POST_L)) < FRAME_HIT) or (math.abs((b.x - M_pitch.POST_R)) < FRAME_HIT)) and (b.z < (M_pitch.GOAL_H + FRAME_HIT)))
		local nearBar = (((math.abs((b.z - M_pitch.GOAL_H)) < FRAME_HIT) and (b.x > (M_pitch.POST_L - FRAME_HIT))) and (b.x < (M_pitch.POST_R + FRAME_HIT)))
		do return (nearPost or nearBar) end
	end
	exports.touchingFrame = touchingFrame
	REL_KEYS = Js.alit("boss", "team", "fans")
	exports.REL_KEYS = REL_KEYS
	MATCH_REL_CAP = 6
	exports.MATCH_REL_CAP = MATCH_REL_CAP
	capRel = function(n)
		return Math.max((-MATCH_REL_CAP), Math.min(MATCH_REL_CAP, n))
	end
	exports.capRel = capRel
	REL_GAIN_SCALE = 0.65
	exports.REL_GAIN_SCALE = REL_GAIN_SCALE
	DRIFT_HIGH = 60
	exports.DRIFT_HIGH = DRIFT_HIGH
	DRIFT_LOW = 40
	exports.DRIFT_LOW = DRIFT_LOW
	clamp = function(n)
		return Math.max(0, Math.min(100, n))
	end
	FRAME_HIT = 0.22
end
