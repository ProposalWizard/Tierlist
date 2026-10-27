--!nocheck
--!nolint
-- Generated from lib/star/trainingDrills.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_pitch = import("lib/star/pitch")
	local ladder, ramp, powerDrill, POWER_LEVELS, OPEN_GOAL_LEVELS, FIRST_BLOCKER_LEVEL, POWER_EASE, powerProgress, powerDrillForLevel, techniqueDrill, freeKickDrill, paceDrill, visionDrill, strikeSpot, powerManSpots, wallSpots, placedMen, techniqueBallSpot, conePositions, gateCrossing, gateQuality, shotQuality
	ladder = function(level)
		do return (Math.max(0, Math.min(100, level)) / 100) end
	end
	exports.ladder = ladder
	ramp = function(level, atZero, atHundred)
		do return (atZero + ((atHundred - atZero) * ladder(level))) end
	end
	powerDrill = function(level, rep)
		local l = ladder(level)
		do return Js.O({ distance = (ramp(level, 10, 34) + (rep * 1.2)), offset = (((if (math.fmod(rep, 2) == 0) then -1 else 1) * ramp(level, 0, 7)) * (0.6 + (math.fmod(rep, 3) * 0.2))), blockers = (if (l < 0.25) then 0 else (if (l < 0.5) then 1 else (if (l < 0.7) then 2 else (if (l < 0.85) then 3 else 4)))), keeperStrength = ramp(level, 38, 93) }, { "distance", "offset", "blockers", "keeperStrength" }) end
	end
	exports.powerDrill = powerDrill
	powerProgress = function(trainingLevel, power)
		local n = Math.max(1, Math.min(POWER_LEVELS, Math.round(trainingLevel)))
		local q = ((n - 1) / (POWER_LEVELS - 1))
		if ((power == nil) or (not Js.NumberNS.isFinite(power))) then
			do return q end
		end
		local qp = Math.max(0, Math.min(1, ((power - 40) / 60)))
		do return (q - (POWER_EASE * Math.max(0, (q - qp)))) end
	end
	exports.powerProgress = powerProgress
	powerDrillForLevel = function(trainingLevel, rep, power)
		local n = Math.max(1, Math.min(POWER_LEVELS, Math.round(trainingLevel)))
		local q = powerProgress(n, power)
		local keeper = (n > OPEN_GOAL_LEVELS)
		do return Js.O({ distance = ((12 + (22 * q)) + (rep * 1.2)), offset = ((((if (math.fmod(rep, 2) == 0) then -1 else 1) * 7) * q) * (0.6 + (math.fmod(rep, 3) * 0.2))), blockers = (if (n < FIRST_BLOCKER_LEVEL) then 0 else Math.max(1, Math.min(4, Math.round((q * 4.4))))), keeperStrength = (if keeper then (25 + (70 * q)) else 0), keeper = keeper }, { "distance", "offset", "blockers", "keeperStrength", "keeper" }) end
	end
	exports.powerDrillForLevel = powerDrillForLevel
	techniqueDrill = function(level, rep)
		do return Js.O({ gateDistance = (ramp(level, 12, 32) + (rep * 0.8)), gateWidth = Math.max(1.6, (ramp(level, 5, 1.9) - (rep * 0.12))), gateOffset = (((if (math.fmod(rep, 2) == 0) then 1 else -1) * ramp(level, 0, 9)) * (0.75 + (math.fmod(rep, 3) * 0.2))), maxHeight = 1.6 }, { "gateDistance", "gateWidth", "gateOffset", "maxHeight" }) end
	end
	exports.techniqueDrill = techniqueDrill
	freeKickDrill = function(level, rep)
		do return Js.O({ distance = (ramp(level, 16, 30) + (rep * 0.9)), offset = (((if (math.fmod(rep, 2) == 0) then -1 else 1) * ramp(level, 1.5, 14)) * (0.5 + (math.fmod(rep, 3) * 0.25))), wall = Math.round(ramp(level, 2, 5)), keeperStrength = ramp(level, 45, 95) }, { "distance", "offset", "wall", "keeperStrength" }) end
	end
	exports.freeKickDrill = freeKickDrill
	paceDrill = function(level, rep)
		do return Js.O({ chasers = (Math.round(ramp(level, 2, 6)) + (if (rep >= 2) then 1 else 0)), oppStrength = ramp(level, 35, 95) }, { "chasers", "oppStrength" }) end
	end
	exports.paceDrill = paceDrill
	visionDrill = function(level, rep)
		do return Js.O({ options = (Math.round(ramp(level, 3, 8)) + (if (rep >= 3) then 1 else 0)), window = Math.max(0.85, (ramp(level, 2.6, 0.95) - (rep * 0.06))), margin = Math.max(0.6, ramp(level, 7, 1.1)) }, { "options", "window", "margin" }) end
	end
	exports.visionDrill = visionDrill
	strikeSpot = function(distance, offset)
		do return Js.O({ x = Math.max(3, Math.min(65, (M_pitch.CX + offset))), y = Math.max(6, distance) }, { "x", "y" }) end
	end
	exports.strikeSpot = strikeSpot
	powerManSpots = function(ball, count)
		do return Js.Array.from(Js.O({ length = count }, { "length" }), function(_, i)
			local f = (0.3 + ((i / Math.max(1, count)) * 0.42))
			local laneX = (ball.x + ((M_pitch.CX - ball.x) * f))
			local spread = ((if (math.fmod(i, 2) == 0) then -1 else 1) * (1.1 + (i * 0.7)))
			do return Js.O({ x = Math.max(1, Math.min((M_pitch.PITCH_W - 1), (laneX + spread))), y = Math.max(1.5, (ball.y * (1 - f))) }, { "x", "y" }) end
		end) end
	end
	exports.powerManSpots = powerManSpots
	wallSpots = function(ball, count)
		local gx = (M_pitch.CX - ball.x)
		local gy = (0 - ball.y)
		local gl = (function() local _l = Math.hypot(gx, gy); if Js.T(_l) then return _l end; return 1 end)()
		local ux = (gx / gl)
		local uy = (gy / gl)
		local wallCx = (ball.x + (ux * 9.15))
		local wallCy = (ball.y + (uy * 9.15))
		local px = (-uy)
		local py = ux
		do return Js.Array.from(Js.O({ length = count }, { "length" }), function(_, i)
			local off = ((i - ((count - 1) / 2)) * 1.15)
			do return Js.O({ x = Math.max(1, Math.min((M_pitch.PITCH_W - 1), (wallCx + (px * off)))), y = Math.max(0.6, (wallCy + (py * off))) }, { "x", "y" }) end
		end) end
	end
	exports.wallSpots = wallSpots
	placedMen = function(own, placed, count)
		do return Js.Array.from(Js.O({ length = count }, { "length" }), function(_, i)
			return ((function() local _v = placed; if _v == nil then return nil end; _v = _v[i + 1]; return _v end)() or own[i + 1])
		end) end
	end
	exports.placedMen = placedMen
	techniqueBallSpot = function(cfg)
		do return (if cfg.ball then Js.ospread(cfg.ball) else strikeSpot((cfg.gateDistance + 6), 0)) end
	end
	exports.techniqueBallSpot = techniqueBallSpot
	conePositions = function(ball, cfg)
		local centre = Js.O({ x = Math.max(4, Math.min(64, (ball.x + cfg.gateOffset))), y = Math.max(2, (ball.y - cfg.gateDistance)) }, { "x", "y" })
		do return Js.O({ left = Js.O({ x = (centre.x - (cfg.gateWidth / 2)), y = centre.y }, { "x", "y" }), right = Js.O({ x = (centre.x + (cfg.gateWidth / 2)), y = centre.y }, { "x", "y" }), centre = centre }, { "left", "right", "centre" }) end
	end
	exports.conePositions = conePositions
	gateCrossing = function(prev, now, gateY)
		if (prev.y == now.y) then
			do return nil end
		end
		if (((prev.y - gateY) * (now.y - gateY)) > 0) then
			do return nil end
		end
		local f = ((prev.y - gateY) / (prev.y - now.y))
		if ((f < 0) or (f > 1)) then
			do return nil end
		end
		do return Js.O({ x = (prev.x + ((now.x - prev.x) * f)), z = (prev.z + ((now.z - prev.z) * f)) }, { "x", "z" }) end
	end
	exports.gateCrossing = gateCrossing
	gateQuality = function(crossing, cfg, centreX)
		if (not crossing) then
			do return 0 end
		end
		if (crossing.z > cfg.maxHeight) then
			do return 0 end
		end
		local off = math.abs((crossing.x - centreX))
		local half = (cfg.gateWidth / 2)
		if (off > half) then
			do return Math.max(0, (0.18 * (1 - ((off - half) / Math.max(1, cfg.gateWidth))))) end
		end
		do return Math.max(0.25, (1 - ((off / half) * 0.75))) end
	end
	exports.gateQuality = gateQuality
	shotQuality = function(outcome, crossX)
		if ((outcome == "goal") or (outcome == "rebound")) then
			if (crossX == nil) then
				do return 0.7 end
			end
			local fromCentre = (math.abs((crossX - M_pitch.CX)) / (M_pitch.GOAL_W / 2))
			do return Math.max(0.55, Math.min(1, (0.55 + (fromCentre * 0.45)))) end
		end
		if ((outcome == "saved") or (outcome == "tipped")) then
			do return 0.34 end
		end
		if (outcome == "caught") then
			do return 0.24 end
		end
		if (outcome == "post") then
			do return 0.42 end
		end
		if (outcome == "blocked") then
			do return 0.16 end
		end
		if ((outcome == "wide") or (outcome == "over")) then
			if (crossX == nil) then
				do return 0.08 end
			end
			local miss = (if (crossX < M_pitch.POST_L) then (M_pitch.POST_L - crossX) else (if (crossX > M_pitch.POST_R) then (crossX - M_pitch.POST_R) else 0))
			do return Math.max(0.04, (0.2 * Math.max(0, (1 - (miss / 4))))) end
		end
		do return 0.05 end
	end
	exports.shotQuality = shotQuality
	POWER_LEVELS = 30
	exports.POWER_LEVELS = POWER_LEVELS
	OPEN_GOAL_LEVELS = 2
	exports.OPEN_GOAL_LEVELS = OPEN_GOAL_LEVELS
	FIRST_BLOCKER_LEVEL = 5
	exports.FIRST_BLOCKER_LEVEL = FIRST_BLOCKER_LEVEL
	POWER_EASE = 0.75
	exports.POWER_EASE = POWER_EASE
end
