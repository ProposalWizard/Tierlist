--!nocheck
--!nolint
-- Generated from lib/star/three3d/gait.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local GAITS, SPRINT_OVER_RUN, PACE_SPEEDS, speedsForPace, kmh, STROLL_SPEEDS, STICK, stickTarget, MOVE, approach, gaitEdges, pickGait, loopRate, sameFootTime, MAX_LOOP_RATE, LONGER, MIN_STRIDE_RATE, strideLoop, GAIT_BLEND, STAMINA, freshStamina, canSprint, staminaFor, FIT_50, stepStamina, effortOf
	speedsForPace = function(pace)
		local p = (Math.max(0, Math.min(100, (if Js.NumberNS.isFinite(pace) then pace else 50))) / 100)
		local P = PACE_SPEEDS
		local run = (P.run0 + ((P.run100 - P.run0) * p))
		local sprint = (P.sprint0 + ((P.sprint100 - P.sprint0) * p))
		do return Js.O({ walk = (run * P.walkOverRun), jog = (run * P.jogOverRun), run = run, sprint = sprint }, { "walk", "jog", "run", "sprint" }) end
	end
	exports.speedsForPace = speedsForPace
	stickTarget = function(mag, sprintHeld, s, canSprint)
		if canSprint == nil then canSprint = true end
		local m = Math.max(0, Math.min(1, mag))
		if (m < STICK.dead) then
			do return 0 end
		end
		if ((sprintHeld or (m >= STICK.sprint)) and canSprint) then
			do return s.sprint end
		end
		if (m < STICK.walk) then
			do return (s.walk * (0.45 + ((0.55 * (m - STICK.dead)) / (STICK.walk - STICK.dead)))) end
		end
		if (m < STICK.jog) then
			do return (s.walk + (((s.jog - s.walk) * (m - STICK.walk)) / (STICK.jog - STICK.walk))) end
		end
		if (m < STICK.sprint) then
			do return (s.jog + (((s.run - s.jog) * (m - STICK.jog)) / (STICK.sprint - STICK.jog))) end
		end
		do return s.run end
	end
	exports.stickTarget = stickTarget
	approach = function(v, target, dt, s)
		if (target > v) then
			local a = (if (v < s.run) then (s.run / MOVE.upToRun) else (Math.max(0.1, (s.sprint - s.run)) / MOVE.runToSprint))
			do return Math.min(target, (v + (a * dt))) end
		end
		local d = (s.run / MOVE.stopFromRun)
		do return Math.max(target, (v - (d * dt))) end
	end
	exports.approach = approach
	gaitEdges = function(s)
		do return Js.alit(0.3, ((s.walk + s.jog) / 2), ((s.jog + s.run) / 2), ((s.run + s.sprint) / 2)) end
	end
	exports.gaitEdges = gaitEdges
	pickGait = function(cur, speed, edges, band)
		if band == nil then band = 0.2 end
		local i = 0
		while ((i < 4) and (speed >= edges[i + 1])) do
			i += 1
		end
		local c = A.indexOf(GAITS, cur)
		if ((c >= 0) and (math.abs((i - c)) == 1)) then
			local edge = edges[Math.min(i, c) + 1]
			local b = (if (Math.min(i, c) == 0) then (band * 0.5) else band)
			if (math.abs((speed - edge)) < b) then
				i = c
			end
		end
		do return GAITS[i + 1] end
	end
	exports.pickGait = pickGait
	loopRate = function(speed, clipSpeed, size, min, max)
		if size == nil then size = 1 end
		if min == nil then min = 0.5 end
		if max == nil then max = 1.6 end
		if ((not Js.T(clipSpeed)) or (clipSpeed <= 0)) then
			do return 1 end
		end
		do return Math.max(min, Math.min(max, (speed / (clipSpeed * size)))) end
	end
	exports.loopRate = loopRate
	sameFootTime = function(prevTime, prevDur, prevPlant, nextDur, nextPlant)
		if ((not (prevDur > 0)) or (not (nextDur > 0))) then
			do return 0 end
		end
		local ph = math.fmod((math.fmod(((prevTime - prevPlant) / prevDur), 1) + 1), 1)
		do return math.fmod((nextPlant + (ph * nextDur)), nextDur) end
	end
	exports.sameFootTime = sameFootTime
	strideLoop = function(gait, speed, clipSpeed, size)
		if size == nil then size = 1 end
		if (gait == "idle") then
			do return Js.O({ loop = gait, rate = 1 }, { "loop", "rate" }) end
		end
		local own = clipSpeed(gait)
		local need = (if Js.T(own) then (speed / (own * size)) else 1)
		if (need > MAX_LOOP_RATE) then
			local up = LONGER[gait]
			local cs = (if Js.T(up) then clipSpeed(up) else nil)
			if ((Js.T(up) and Js.T(cs)) and ((speed / (cs * size)) >= MIN_STRIDE_RATE)) then
				do return Js.O({ loop = up, rate = loopRate(speed, cs, size, 0.5, MAX_LOOP_RATE) }, { "loop", "rate" }) end
			end
		end
		do return Js.O({ loop = gait, rate = loopRate(speed, own, size, 0.5, MAX_LOOP_RATE) }, { "loop", "rate" }) end
	end
	exports.strideLoop = strideLoop
	staminaFor = function(physical)
		local p = (Math.max(0, Math.min(100, (if Js.NumberNS.isFinite(physical) then physical else 50))) / 100)
		do return Js.O({ sprintSeconds = (4 + (4 * p)), backK = (0.7 + (0.6 * p)) }, { "sprintSeconds", "backK" }) end
	end
	exports.staminaFor = staminaFor
	stepStamina = function(s, effort, dt, drainK, fit)
		if drainK == nil then drainK = 1 end
		if fit == nil then fit = FIT_50 end
		local v = s.v
		if (effort == "sprint") then
			v -= ((dt / fit.sprintSeconds) * drainK)
		else
			v += ((dt * fit.backK) * (if (effort == "run") then STAMINA.backRunning else (if (effort == "easy") then STAMINA.backEasy else STAMINA.backStill)))
		end
		v = Math.max(0, Math.min(1, v))
		local tired = s.tired
		if (v <= 0) then
			tired = true
		elseif (tired and (v >= STAMINA.resume)) then
			tired = false
		end
		do return Js.O({ v = v, tired = tired }, { "v", "tired" }) end
	end
	exports.stepStamina = stepStamina
	effortOf = function(speed, sprinting, s)
		if (sprinting and (speed > (s.run * 0.9))) then
			do return "sprint" end
		end
		if (speed < 0.3) then
			do return "still" end
		end
		do return (if (speed > ((s.jog + s.run) / 2)) then "run" else "easy") end
	end
	exports.effortOf = effortOf
	GAITS = Js.alit("idle", "walk", "jog", "run", "sprint")
	exports.GAITS = GAITS
	SPRINT_OVER_RUN = 1.35
	exports.SPRINT_OVER_RUN = SPRINT_OVER_RUN
	PACE_SPEEDS = Js.O({ run0 = 4.2, run100 = 6, sprint0 = 5.6, sprint100 = 8.2, walkOverRun = 0.28, jogOverRun = 0.68 }, { "run0", "run100", "sprint0", "sprint100", "walkOverRun", "jogOverRun" })
	exports.PACE_SPEEDS = PACE_SPEEDS
	kmh = function(ms)
		return (ms * 3.6)
	end
	exports.kmh = kmh
	STROLL_SPEEDS = Js.O({ walk = 1.45, jog = 3.4, run = 4.8, sprint = (4.8 * SPRINT_OVER_RUN) }, { "walk", "jog", "run", "sprint" })
	exports.STROLL_SPEEDS = STROLL_SPEEDS
	STICK = Js.O({ dead = 0.08, walk = 0.45, jog = 0.78, sprint = 0.92 }, { "dead", "walk", "jog", "sprint" })
	exports.STICK = STICK
	MOVE = Js.O({ upToRun = 0.25, runToSprint = 0.45, stopFromRun = 0.3 }, { "upToRun", "runToSprint", "stopFromRun" })
	exports.MOVE = MOVE
	MAX_LOOP_RATE = 1.3
	exports.MAX_LOOP_RATE = MAX_LOOP_RATE
	LONGER = Js.O({ walk = "jog", jog = "run", run = "sprint" }, { "walk", "jog", "run" })
	MIN_STRIDE_RATE = 0.75
	exports.MIN_STRIDE_RATE = MIN_STRIDE_RATE
	GAIT_BLEND = 0.2
	exports.GAIT_BLEND = GAIT_BLEND
	STAMINA = Js.O({ sprintSeconds = 6, backRunning = 0.05, backEasy = 0.16, backStill = 0.25, resume = 0.25 }, { "sprintSeconds", "backRunning", "backEasy", "backStill", "resume" })
	exports.STAMINA = STAMINA
	freshStamina = function()
		return Js.O({ v = 1, tired = false }, { "v", "tired" })
	end
	exports.freshStamina = freshStamina
	canSprint = function(s)
		return ((not s.tired) and (s.v > 0))
	end
	exports.canSprint = canSprint
	FIT_50 = Js.O({ sprintSeconds = STAMINA.sprintSeconds, backK = 1 }, { "sprintSeconds", "backK" })
end
