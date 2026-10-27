--!nocheck
--!nolint
-- Generated from lib/star/penaltyRunup.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_pitch = import("lib/star/pitch")
	local RUNUP, hasRunup, canNudge, backDir, sideOf, standBack, standBackAt, plantBeside, runupPath, playerAt, goalLineX, nudgedDir, nudgeFromDrag, scuffStrike, MIDDLE_HALF_WIDTH, isChip, cheekyStrike, isCheekyMiss, clamp, strikeTimerFor
	hasRunup = function(kind)
		do return ((kind == "penalty") or (kind == "free_kick")) end
	end
	exports.hasRunup = hasRunup
	canNudge = function(kind)
		do return (kind == "penalty") end
	end
	exports.canNudge = canNudge
	backDir = function(ball)
		local dx = (ball.x - M_pitch.CX)
		local dy = ball.y
		local L = Math.hypot(dx, dy)
		do return (if (L > 0.000001) then Js.O({ x = (dx / L), y = (dy / L) }, { "x", "y" }) else Js.O({ x = 0, y = 1 }, { "x", "y" })) end
	end
	exports.backDir = backDir
	sideOf = function(ball, player)
		local b = backDir(ball)
		local drawn = (((player.x - ball.x) * b.y) - ((player.y - ball.y) * b.x))
		do return (if (math.abs(drawn) > 0.2) then Math.sign(drawn) else -1) end
	end
	exports.sideOf = sideOf
	standBack = function(ball, player)
		do return standBackAt(ball, player, RUNUP.startBack, RUNUP.startAngleDeg) end
	end
	exports.standBack = standBack
	standBackAt = function(ball, player, back, angleDeg)
		local side = sideOf(ball, player)
		local b = backDir(ball)
		local a = ((angleDeg * Math.PI) / 180)
		local s = (side * Math.sin(a))
		local c = Math.cos(a)
		local d = Js.O({ x = ((b.x * c) + (b.y * s)), y = ((b.y * c) - (b.x * s)) }, { "x", "y" })
		do return Js.O({ x = (ball.x + (d.x * back)), y = (ball.y + (d.y * back)) }, { "x", "y" }) end
	end
	exports.standBackAt = standBackAt
	plantBeside = function(ball, player)
		local side = sideOf(ball, player)
		local b = backDir(ball)
		do return Js.O({ x = ((ball.x + ((b.y * side) * RUNUP.plantSide)) + (b.x * RUNUP.plantBack)), y = ((ball.y - ((b.x * side) * RUNUP.plantSide)) + (b.y * RUNUP.plantBack)) }, { "x", "y" }) end
	end
	exports.plantBeside = plantBeside
	runupPath = function(ball, player)
		do return Js.O({ from = standBack(ball, player), to = plantBeside(ball, player) }, { "from", "to" }) end
	end
	exports.runupPath = runupPath
	playerAt = function(p, u)
		local t = Math.max(0, Math.min(1, u))
		local e = ((0.18 * t) + (0.82 * ((t * t) * (3 - (2 * t)))))
		do return Js.O({ x = (p.from.x + ((p.to.x - p.from.x) * e)), y = (p.from.y + ((p.to.y - p.from.y) * e)) }, { "x", "y" }) end
	end
	exports.playerAt = playerAt
	goalLineX = function(ball, dir)
		if (not (dir.y < -0.000001)) then
			do return (ball.x + (Math.sign((if Js.T(dir.x) then dir.x else 1)) * 99)) end
		end
		do return (ball.x + ((dir.x / dir.y) * (0 - ball.y))) end
	end
	exports.goalLineX = goalLineX
	nudgedDir = function(ball, dir, nudgeM)
		local x = (goalLineX(ball, dir) + clamp(nudgeM, (-RUNUP.nudgeMaxM), RUNUP.nudgeMaxM))
		local dx = (x - ball.x)
		local dy = (0 - ball.y)
		local L = (function() local _l = Math.hypot(dx, dy); if Js.T(_l) then return _l end; return 1 end)()
		do return Js.O({ x = (dx / L), y = (dy / L) }, { "x", "y" }) end
	end
	exports.nudgedDir = nudgedDir
	nudgeFromDrag = function(dxPx, widthPx, viewWidthM)
		if ((not (widthPx > 0)) or (not (viewWidthM > 0))) then
			do return 0 end
		end
		do return (((dxPx / widthPx) * viewWidthM) / RUNUP.nudgeFingerRatio) end
	end
	exports.nudgeFromDrag = nudgeFromDrag
	scuffStrike = function(dir, power, rng)
		local angleDeg = (((rng() * 2) - 1) * RUNUP.scuffAngleDeg)
		local a = ((angleDeg * Math.PI) / 180)
		local c = Math.cos(a)
		local s = Math.sin(a)
		do return Js.O({ dir = Js.O({ x = ((dir.x * c) - (dir.y * s)), y = ((dir.x * s) + (dir.y * c)) }, { "x", "y" }), power = (power * RUNUP.scuffPower), contact = Js.O({ cx = (((rng() * 2) - 1) * 0.6), cy = (-0.5 - (rng() * 0.4)) }, { "cx", "cy" }), angleDeg = angleDeg }, { "dir", "power", "contact", "angleDeg" }) end
	end
	exports.scuffStrike = scuffStrike
	isChip = function(ball)
		local h = Math.hypot(ball.vel.x, ball.vel.y)
		do return (((h > 1) and (h <= 18)) and (ball.vz >= (0.35 * h))) end
	end
	exports.isChip = isChip
	cheekyStrike = function(kind, ball, centreX, atGoal)
		if (kind == "penalty") then
			if isChip(ball) then
				do return "chip" end
			end
			local x = goalLineX(ball.pos, ball.vel)
			do return (if (math.abs((x - centreX)) <= MIDDLE_HALF_WIDTH) then "penalty-middle" else nil) end
		end
		if ((kind == "free_kick") or (kind == "corner")) then
			do return nil end
		end
		do return (if (atGoal and isChip(ball)) then "chip" else nil) end
	end
	exports.cheekyStrike = cheekyStrike
	isCheekyMiss = function(outcome)
		do return ((outcome ~= "goal") and (outcome ~= "rebound")) end
	end
	exports.isCheekyMiss = isCheekyMiss
	clamp = function(v, lo, hi)
		do return Math.max(lo, Math.min(hi, (if Js.NumberNS.isFinite(v) then v else 0))) end
	end
	strikeTimerFor = function(kind)
		do return (if (kind == "free_kick") then RUNUP.freeKickTimerS else RUNUP.timerS) end
	end
	exports.strikeTimerFor = strikeTimerFor
	RUNUP = Js.O({ runupS = 2.4, startBack = 3.4, startAngleDeg = 32, plantSide = 0.5, plantBack = 0.35, nudgeMaxM = 3, nudgeFingerRatio = 1.5, timerS = 1.8, freeKickTimerS = 3, scuffPower = 0.3, scuffAngleDeg = 18 }, { "runupS", "startBack", "startAngleDeg", "plantSide", "plantBack", "nudgeMaxM", "nudgeFingerRatio", "timerS", "freeKickTimerS", "scuffPower", "scuffAngleDeg" })
	exports.RUNUP = RUNUP
	MIDDLE_HALF_WIDTH = 1.2
	exports.MIDDLE_HALF_WIDTH = MIDDLE_HALF_WIDTH
end
