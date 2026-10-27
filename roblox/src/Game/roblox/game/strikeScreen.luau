--!nocheck
--!nolint
-- Generated from roblox/game/strikeScreen.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_match = import("roblox/game/match")
	local M_airborneChance = import("lib/star/airborneChance")
	local M_shotModel = import("lib/star/shotModel")
	local M_airTap = import("lib/star/airTap")
	local M_aerial = import("lib/star/aerial")
	local ballMotionAt, TOO_SLOW_MS, AIR_VERDICT_MS, STRIKE_ZONE_R, POWER_GIVE_UP_S, openStrike, strikeStep, strikeTap, finishPower, strikeView
	ballMotionAt = function(motion, t, period)
		if (motion == "still") then
			do return Js.O({ x = 0, y = 0 }, { "x", "y" }) end
		end
		local phase = math.fmod((t / period), 2)
		local sweep = (if (phase < 1) then phase else (2 - phase))
		local x = (-0.12 + (0.24 * (0.5 - (0.5 * Math.cos((Math.PI * sweep))))))
		if (motion == "float") then
			do return Js.O({ x = x, y = (-0.42 - (0.08 * Math.sin((Math.PI * sweep)))) }, { "x", "y" }) end
		end
		if (motion == "bounce") then
			local b = math.abs(Math.sin(((Math.PI * 2.5) * sweep)))
			do return Js.O({ x = x, y = (-0.26 * b) }, { "x", "y" }) end
		end
		local b = math.abs(Math.sin(((Math.PI * 6) * sweep)))
		do return Js.O({ x = (x * 0.6), y = (-0.05 * b) }, { "x", "y" }) end
	end
	exports.ballMotionAt = ballMotionAt
	openStrike = function(m)
		local inputs = M_match.strikeInputs(m)
		if (not inputs) then
			do return nil end
		end
		local airKind = (if (inputs.motion == "float") then "header" else (if (inputs.motion == "bounce") then "volley" else nil))
		local limitS = (if (Js.T(inputs.timeLimitS) and (inputs.timeLimitS > 0)) then inputs.timeLimitS else (if Js.T(airKind) then M_airborneChance.airStrikeTimerS(airKind, inputs.aerial) else nil))
		local a = ((Math.random() * Math.PI) * 2)
		local r = (Math.sqrt(Math.random()) * 0.55)
		do return Js.O({ inputs = inputs, t = 0, period = (2.2 + ((Math.max(0, (Math.min(100, inputs.technique) - 40)) / 60) * 1.2)), airKind = airKind, limitS = limitS, framesSeen = 0, startedAt = nil, locked = false, timedOut = false, spark = nil, verdict = nil, send = nil, lift = 0, sweepX = 0, powerSpot = Js.O({ x = (Math.cos(a) * r), y = (Math.sin(a) * r) }, { "x", "y" }), powerShowAt = (0.25 + (Math.random() * 0.5)), powerShownAt = nil }, { "inputs", "t", "period", "airKind", "limitS", "framesSeen", "startedAt", "locked", "timedOut", "spark", "verdict", "send", "lift", "sweepX", "powerSpot", "powerShowAt", "powerShownAt" }) end
	end
	exports.openStrike = openStrike
	strikeStep = function(s, m, dt)
		s.framesSeen += 1
		if (not s.locked) then
			s.t += dt
			local p = ballMotionAt(s.inputs.motion, s.t, s.period)
			s.sweepX = p.x
			local top = (if (s.inputs.motion == "float") then 0.5 else (if (s.inputs.motion == "bounce") then 0.26 else 0.05))
			s.lift = Math.max(0, Math.min(1, ((-p.y) / top)))
		else
			s.t += dt
		end
		if s.inputs.powerShot then
			if ((s.powerShownAt == nil) and (s.t >= s.powerShowAt)) then
				s.powerShownAt = s.t
			end
			if ((not s.locked) and (s.t >= (0.75 + POWER_GIVE_UP_S))) then
				finishPower(s, 0, (0/0))
			end
		else
			if (((s.startedAt == nil) and (s.framesSeen >= 2)) and Js.T(s.limitS)) then
				s.startedAt = s.t
			end
			if ((((not s.locked) and (s.startedAt ~= nil)) and Js.T(s.limitS)) and ((s.t - s.startedAt) >= s.limitS)) then
				s.locked = true
				s.timedOut = true
				local lift = s.lift
				local sweep = s.sweepX
				local airKind = s.airKind
				local ownTimer = (not (not (Js.T(s.inputs.timeLimitS) and (s.inputs.timeLimitS > 0))))
				s.send = Js.O({ at = (s.t + (TOO_SLOW_MS / 1000)), fire = function(mm)
					if (Js.T(airKind) and (not ownTimer)) then
						M_match.contact(mm, Js.ospread(M_airborneChance.airLateContact(airKind, lift, sweep), Js.O({ late = true }, { "late" })))
					else
						M_match.contactTimeout(mm)
					end
				end }, { "at", "fire" })
			end
		end
		if (s.send and (s.t >= s.send.at)) then
			local f = s.send.fire
			s.send = nil
			f(m)
		end
	end
	exports.strikeStep = strikeStep
	strikeTap = function(s, cx, cy)
		if s.locked then
			do return end
		end
		if s.inputs.powerShot then
			if (((cx * cx) + (cy * cy)) > 1.15) then
				do return end
			end
			if (s.powerShownAt == nil) then
				finishPower(s, 0, (0/0))
				do return end
			end
			local rt = (s.t - s.powerShownAt)
			local hit = (Math.hypot((cx - s.powerSpot.x), (cy - s.powerSpot.y)) < 0.3)
			finishPower(s, M_shotModel.powerShotQuality(rt, hit), (if hit then rt else (0/0)))
			do return end
		end
		local d = Math.hypot(cx, cy)
		if (d > STRIKE_ZONE_R) then
			do return end
		end
		if (d > 1) then
			cx /= d
			cy /= d
		end
		s.locked = true
		s.spark = Js.O({ cx = cx, cy = cy }, { "cx", "cy" })
		local inp = s.inputs
		local air = ((inp.motion == "float") or (inp.motion == "bounce"))
		local lift = s.lift
		if air then
			local kind = (if (inp.motion == "float") then "header" else "volley")
			local readCx = (if inp.aimFromTap then M_airTap.airTapContactCx(kind, cx, inp.aerial) else cx)
			local rd = M_airborneChance.airContactRead(Js.O({ kind = kind, lift = lift, cx = readCx, cy = cy, tech = inp.technique, aerial = inp.aerial }, { "kind", "lift", "cx", "cy", "tech", "aerial" }), (if ((inp.motion == "float") and (inp.ballZ ~= nil)) then (inp.ballZ * (0.85 + (0.15 * lift))) else nil))
			s.verdict = Js.O({ label = rd.label, good = rd.good }, { "label", "good" })
		elseif inp.grades then
			local g = M_shotModel.gradeContact(Js.O({ cx = cx, cy = cy }, { "cx", "cy" }), inp.power, inp.knuckles, inp.field)
			if Js.T(g.label) then
				s.verdict = Js.O({ label = g.label, good = (((g.grade == "clean") or (g.grade == "knuckle")) or (g.label == "CURLER")) }, { "label", "good" })
			end
		end
		local c = (if air then Js.O({ cx = cx, cy = cy, lift = lift }, { "cx", "cy", "lift" }) else Js.O({ cx = cx, cy = cy }, { "cx", "cy" }))
		s.send = Js.O({ at = (s.t + ((if air then AIR_VERDICT_MS else (if inp.grades then 420 else 200)) / 1000)), fire = function(mm)
			return M_match.contact(mm, c)
		end }, { "at", "fire" })
	end
	exports.strikeTap = strikeTap
	finishPower = function(s, q, _rt)
		if s.locked then
			do return end
		end
		s.locked = true
		s.verdict = Js.O({ label = (if (q >= 0.95) then "PERFECT!" else (if (q >= 0.6) then "GOOD" else (if (q > 0) then "LATE" else "MISSED"))), good = (q >= 0.6) }, { "label", "good" })
		s.send = Js.O({ at = (s.t + 0.35), fire = function(mm)
			return M_match.powerContact(mm, q)
		end }, { "at", "fire" })
	end
	strikeView = function(s)
		local inp = s.inputs
		local p = (if s.locked then Js.O({ x = s.sweepX, y = ((-s.lift) * (if (inp.motion == "float") then 0.5 else (if (inp.motion == "bounce") then 0.26 else 0.05))) }, { "x", "y" }) else ballMotionAt(inp.motion, s.t, s.period))
		local powerPct = Math.round((inp.power * 100))
		local ring = (if (s.inputs.powerShot or (not Js.T(s.limitS))) then nil else (if (s.startedAt == nil) then 1 else Math.max(0, (1 - ((s.t - s.startedAt) / s.limitS)))))
		do return Js.O({ ballX = p.x, ballY = p.y, lift = s.lift, ring = ring, powerPct = powerPct, powerColor = (if (powerPct < 40) then "#22c55e" else (if (powerPct < 75) then "#eab308" else "#ef4444")), verdict = s.verdict, spark = s.spark, timedOut = s.timedOut, heading = (if inp.powerShot then "Power shot" else (if (s.airKind == "header") then "Head it!" else (if (s.airKind == "volley") then "Volley it!" else "Strike it!"))), jump = (if ((inp.motion == "float") and (inp.ballZ ~= nil)) then M_aerial.headerJump(inp.ballZ, inp.aerial) else nil), powerSpot = (if ((inp.powerShot and (s.powerShownAt ~= nil)) and (not s.locked)) then s.powerSpot else nil) }, { "ballX", "ballY", "lift", "ring", "powerPct", "powerColor", "verdict", "spark", "timedOut", "heading", "jump", "powerSpot" }) end
	end
	exports.strikeView = strikeView
	TOO_SLOW_MS = 350
	AIR_VERDICT_MS = 300
	STRIKE_ZONE_R = 1.18
	exports.STRIKE_ZONE_R = STRIKE_ZONE_R
	POWER_GIVE_UP_S = 1.2
end
