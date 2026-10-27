--!nocheck
--!nolint
-- Generated from lib/star/airborneChance.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_react = import("__pkg/react")
	local M_airDrawings = import("lib/star/airDrawings")
	local M_aerial = import("lib/star/aerial")
	local M_canvasEngine = import("lib/star/canvasEngine")
	local KEY, override, listeners, setAirborneOverride, airborneOn, setAirborne, useAirborne, HEADER_KINDS, VOLLEY_KINDS, HEADER_SHARE, VOLLEY_SHARE, airborneMotion, HEADER_PACE, VOLLEY_PACE, AIR_CENTRE_R, AIR_CENTRE_PER_POINT, AIR_CENTRE_MIN_R, AIR_CENTRE_MAX_R, airCentreR, HEADER_GLANCE_DEG, HEADER_GLANCE_PACE, HEADER_LOOP_FROM, HEADER_LOOP_VZ, VOLLEY_SLICE_DEG, VOLLEY_SWEET, VOLLEY_BALLOON_VZ, VOLLEY_SCUFF_PACE, VOLLEY_SCUFF_DEG, VOLLEY_SKY_VZ, airContactRead, AERIAL_FORGIVE_SLOPE, airForgiveness, applyAirborne, HEADER_Z_TAKEBACK_UP, HEADER_Z_TAKEBACK_DOWN, HEADER_OVER_MAX_M, HEADER_STRETCH_PACE, HEADER_STRETCH_VZ, headerStretch, offLine, AIR_TIMER_HEADER_S, AIR_TIMER_VOLLEY_S, AIR_TIMER_PER_PT, AIR_TIMER_PER_PT_UNDER, AIR_TIMER_AERIAL_MIN, AIR_TIMER_AERIAL_MAX, airStrikeTimerS, airLateContact
	setAirborneOverride = function(v)
		override = v
		listeners:forEach(function(f)
			return f()
		end)
	end
	exports.setAirborneOverride = setAirborneOverride
	airborneOn = function()
		if (override ~= nil) then
			do return override end
		end
		local _ok1, _err2, _rv3 = pcall(function()
			do return Js.RET, ((Js.localStorage ~= nil) and (Js.localStorage.getItem(KEY) == "1")) end
		end)
		if not _ok1 then
			do return false end
		elseif _err2 == Js.RET then
			return _rv3
		end
	end
	exports.airborneOn = airborneOn
	setAirborne = function(v)
		local _ok4, _err5, _rv6 = pcall(function()
			Js.localStorage.setItem(KEY, (if v then "1" else "0"))
		end)
		if not _ok4 then
		elseif _err5 == Js.RET then
			return _rv6
		end
		listeners:forEach(function(f)
			return f()
		end)
	end
	exports.setAirborne = setAirborne
	useAirborne = function()
		do return M_react.useSyncExternalStore(function(f)
			listeners:add(f)
			do return function()
				listeners:delete(f)
			end end
		end, airborneOn, function()
			return false
		end) end
	end
	exports.useAirborne = useAirborne
	airborneMotion = function(kind, seed)
		if (kind == "header") then
			do return "float" end
		end
		if (kind == "volley") then
			do return "bounce" end
		end
		local h = math.fmod(Js.ushr(Math.imul(Js.bxor(seed, 20973), 2654435761), 0), 100)
		if (HEADER_KINDS:has(kind) and (h < HEADER_SHARE)) then
			do return "float" end
		end
		if ((VOLLEY_KINDS:has(kind) and (h >= HEADER_SHARE)) and (h < (HEADER_SHARE + VOLLEY_SHARE))) then
			do return "bounce" end
		end
		do return "still" end
	end
	exports.airborneMotion = airborneMotion
	airCentreR = function(aerial)
		if ((aerial == nil) or (not Js.NumberNS.isFinite(aerial))) then
			do return AIR_CENTRE_R end
		end
		do return Math.max(AIR_CENTRE_MIN_R, Math.min(AIR_CENTRE_MAX_R, (AIR_CENTRE_R + ((aerial - 60) * AIR_CENTRE_PER_POINT)))) end
	end
	exports.airCentreR = airCentreR
	airContactRead = function(air, ballZ)
		local cx = Math.max(-1, Math.min(1, (if air.cx ~= nil then air.cx else 0)))
		local cy = Math.max(-1, Math.min(1, (if air.cy ~= nil then air.cy else 0)))
		local lift = Math.max(0, Math.min(1, air.lift))
		local k = airForgiveness(air)
		local R0 = airCentreR(air.aerial)
		local side = (Math.max(0, (math.abs(cx) - R0)) / (1 - R0))
		local away = (if (cx > 0) then -1 else (if (cx < 0) then 1 else 0))
		if (air.kind == "header") then
			local loop = Math.max(0, (cy - HEADER_LOOP_FROM))
			local read = Js.O({ label = "FIRM HEADER", good = true, turnDeg = (((away * side) * HEADER_GLANCE_DEG) * k), pace = (1 - ((HEADER_GLANCE_PACE * side) * k)), vzAdd = ((loop * HEADER_LOOP_VZ) * k) }, { "label", "good", "turnDeg", "pace", "vzAdd" })
			if (side > 0.45) then
				read.label = "GLANCED"
				read.good = false
			elseif (cy > 0.6) then
				read.label = "LOOPED UP"
				read.good = false
			elseif (cy < -0.25) then
				read.label = "NODDED DOWN"
			end
			local st = headerStretch(ballZ, air.aerial)
			if (st > 0) then
				read.pace *= (1 - (HEADER_STRETCH_PACE * st))
				read.vzAdd += (HEADER_STRETCH_VZ * st)
				if (st >= 0.999) then
					read.label = "JUST A TOUCH"
					read.good = false
				elseif read.good then
					read.label = "STRETCHED"
					read.good = false
				end
			end
			do return read end
		end
		local _d7 = VOLLEY_SWEET
		local lo = _d7[1]
		local hi = _d7[2]
		local early = (if (lift > hi) then ((lift - hi) / (1 - hi)) else 0)
		local late = (if (lift < lo) then ((lo - lift) / lo) else 0)
		local sky = Math.max(0, (cy - 0.4))
		local ground = Math.max(0, (-0.55 - cy))
		local read = Js.O({ label = "SWEET VOLLEY", good = true, turnDeg = ((((away * side) * VOLLEY_SLICE_DEG) + (((if Js.T(away) then away else 1) * late) * VOLLEY_SCUFF_DEG)) * k), pace = ((1 - ((VOLLEY_SCUFF_PACE * late) * k)) * (1 - ((0.2 * side) * k))), vzAdd = ((((early * VOLLEY_BALLOON_VZ) + (sky * VOLLEY_SKY_VZ)) - (ground * 4)) * k) }, { "label", "good", "turnDeg", "pace", "vzAdd" })
		if ((early > 0.35) or (late > 0.35)) then
			read.label = "MISTIMED"
			read.good = false
		elseif (side > 0.4) then
			read.label = "SLICED"
			read.good = false
		elseif (cy > 0.55) then
			read.label = "SKIED"
			read.good = false
		end
		do return read end
	end
	exports.airContactRead = airContactRead
	airForgiveness = function(air)
		if ((air.aerial ~= nil) and Js.NumberNS.isFinite(air.aerial)) then
			do return Math.max(0.4, Math.min(1.5, (0.94 - (((air.aerial - 60) / 100) * AERIAL_FORGIVE_SLOPE)))) end
		end
		do return Math.max(0.6, Math.min(1.25, (1.3 - (((if air.tech ~= nil then air.tech else 50) / 100) * 0.6)))) end
	end
	exports.airForgiveness = airForgiveness
	applyAirborne = function(ball, scenario, air)
		if (not air) then
			do return ball end
		end
		local lift = Math.max(0, Math.min(1, air.lift))
		local top = (if (scenario.kind == air.kind) then M_airDrawings.airZOf(scenario) else (if (air.kind == "header") then M_airDrawings.HEADER_Z else M_airDrawings.VOLLEY_MAX_Z))
		local aboveM = (if (air.kind == "header") then ((top - M_airDrawings.HEADER_Z) * (0.85 + (0.15 * lift))) else 0)
		local metZ = (if (air.kind == "header") then (top * (0.85 + (0.15 * lift))) else (top * lift))
		local read = airContactRead(air, metZ)
		if (air.kind == "header") then
			ball.z = metZ
			local hp = (HEADER_PACE * M_aerial.aerialHeaderPace(air.aerial))
			ball.vel = Js.O({ x = (ball.vel.x * hp), y = (ball.vel.y * hp) }, { "x", "y" })
			ball.vz = Math.max(-4, Math.min(2.5, ((ball.vz * 0.35) - 1.2)))
			if (aboveM ~= 0) then
				local speed = Math.max(4, math.abs(ball.vel.y))
				local t = Math.max(0.25, (math.abs(ball.pos.y) / speed))
				ball.vz -= ((aboveM * (if (aboveM > 0) then HEADER_Z_TAKEBACK_UP else HEADER_Z_TAKEBACK_DOWN)) / t)
			end
			ball.spin *= 0.3
			ball.topspin = 0
			offLine(ball, read)
		else
			ball.z = Math.max(0.15, (top * lift))
			local vp = (VOLLEY_PACE * M_aerial.aerialVolleyPace(air.aerial))
			ball.vel = Js.O({ x = (ball.vel.x * vp), y = (ball.vel.y * vp) }, { "x", "y" })
			local speed = Math.max(4, math.abs(ball.vel.y))
			local t = Math.max(0.25, (math.abs(ball.pos.y) / speed))
			ball.vz = (ball.vz - (ball.z / t))
			offLine(ball, read)
		end
		ball.resting = false
		M_canvasEngine.markLanding(ball, scenario)
		do return ball end
	end
	exports.applyAirborne = applyAirborne
	headerStretch = function(ballZ, aerial)
		if ((((ballZ == nil) or (aerial == nil)) or (not Js.NumberNS.isFinite(ballZ))) or (not Js.NumberNS.isFinite(aerial))) then
			do return 0 end
		end
		do return Math.min(1, (M_aerial.headerJump(ballZ, aerial).overM / HEADER_OVER_MAX_M)) end
	end
	exports.headerStretch = headerStretch
	offLine = function(ball, read)
		if Js.T(read.turnDeg) then
			local a = ((read.turnDeg * Math.PI) / 180)
			local c = Math.cos(a)
			local s = Math.sin(a)
			ball.vel = Js.O({ x = ((ball.vel.x * c) - (ball.vel.y * s)), y = ((ball.vel.x * s) + (ball.vel.y * c)) }, { "x", "y" })
		end
		if (read.pace ~= 1) then
			ball.vel = Js.O({ x = (ball.vel.x * read.pace), y = (ball.vel.y * read.pace) }, { "x", "y" })
		end
		ball.vz += read.vzAdd
	end
	airStrikeTimerS = function(kind, aerial)
		local a = (if ((aerial == nil) or (not Js.NumberNS.isFinite(aerial))) then 60 else Math.max(AIR_TIMER_AERIAL_MIN, Math.min(AIR_TIMER_AERIAL_MAX, aerial)))
		local base = (if (kind == "header") then AIR_TIMER_HEADER_S else AIR_TIMER_VOLLEY_S)
		local add = (if (a >= 60) then ((a - 60) * AIR_TIMER_PER_PT) else ((a - 60) * AIR_TIMER_PER_PT_UNDER))
		do return (Math.round(((base + add) * 100)) / 100) end
	end
	exports.airStrikeTimerS = airStrikeTimerS
	airLateContact = function(kind, lift, side)
		local s = (if (side < 0) then -1 else 1)
		if (kind == "header") then
			do return Js.O({ cx = (0.8 * s), cy = 0.55, lift = Math.max(0, Math.min(1, lift)) }, { "cx", "cy", "lift" }) end
		end
		do return Js.O({ cx = (0.6 * s), cy = 0.35, lift = 0.04 }, { "cx", "cy", "lift" }) end
	end
	exports.airLateContact = airLateContact
	KEY = "star-airborne-v2"
	override = nil
	listeners = Js.Set.new()
	HEADER_KINDS = Js.Set.new(Js.alit("cutback", "tight_angle", "byline_cross"))
	VOLLEY_KINDS = Js.Set.new(Js.alit("one_on_one", "tight_angle", "long_range", "cutback", "through_ball"))
	HEADER_SHARE = 10
	exports.HEADER_SHARE = HEADER_SHARE
	VOLLEY_SHARE = 12
	exports.VOLLEY_SHARE = VOLLEY_SHARE
	HEADER_PACE = 0.72
	VOLLEY_PACE = 1.06
	AIR_CENTRE_R = 0.2
	exports.AIR_CENTRE_R = AIR_CENTRE_R
	AIR_CENTRE_PER_POINT = 0.003
	exports.AIR_CENTRE_PER_POINT = AIR_CENTRE_PER_POINT
	AIR_CENTRE_MIN_R = 0.1
	exports.AIR_CENTRE_MIN_R = AIR_CENTRE_MIN_R
	AIR_CENTRE_MAX_R = 0.32
	exports.AIR_CENTRE_MAX_R = AIR_CENTRE_MAX_R
	HEADER_GLANCE_DEG = 22
	exports.HEADER_GLANCE_DEG = HEADER_GLANCE_DEG
	HEADER_GLANCE_PACE = 0.35
	exports.HEADER_GLANCE_PACE = HEADER_GLANCE_PACE
	HEADER_LOOP_FROM = 0.45
	exports.HEADER_LOOP_FROM = HEADER_LOOP_FROM
	HEADER_LOOP_VZ = 3
	exports.HEADER_LOOP_VZ = HEADER_LOOP_VZ
	VOLLEY_SLICE_DEG = 26
	exports.VOLLEY_SLICE_DEG = VOLLEY_SLICE_DEG
	VOLLEY_SWEET = Js.alit(0.25, 0.9)
	exports.VOLLEY_SWEET = VOLLEY_SWEET
	VOLLEY_BALLOON_VZ = 2
	exports.VOLLEY_BALLOON_VZ = VOLLEY_BALLOON_VZ
	VOLLEY_SCUFF_PACE = 0.35
	exports.VOLLEY_SCUFF_PACE = VOLLEY_SCUFF_PACE
	VOLLEY_SCUFF_DEG = 12
	exports.VOLLEY_SCUFF_DEG = VOLLEY_SCUFF_DEG
	VOLLEY_SKY_VZ = 5
	exports.VOLLEY_SKY_VZ = VOLLEY_SKY_VZ
	AERIAL_FORGIVE_SLOPE = 1.6
	exports.AERIAL_FORGIVE_SLOPE = AERIAL_FORGIVE_SLOPE
	HEADER_Z_TAKEBACK_UP = 3
	exports.HEADER_Z_TAKEBACK_UP = HEADER_Z_TAKEBACK_UP
	HEADER_Z_TAKEBACK_DOWN = 1
	exports.HEADER_Z_TAKEBACK_DOWN = HEADER_Z_TAKEBACK_DOWN
	HEADER_OVER_MAX_M = 0.3
	exports.HEADER_OVER_MAX_M = HEADER_OVER_MAX_M
	HEADER_STRETCH_PACE = 0.45
	exports.HEADER_STRETCH_PACE = HEADER_STRETCH_PACE
	HEADER_STRETCH_VZ = 1.5
	exports.HEADER_STRETCH_VZ = HEADER_STRETCH_VZ
	AIR_TIMER_HEADER_S = 1.5
	exports.AIR_TIMER_HEADER_S = AIR_TIMER_HEADER_S
	AIR_TIMER_VOLLEY_S = 1.3
	exports.AIR_TIMER_VOLLEY_S = AIR_TIMER_VOLLEY_S
	AIR_TIMER_PER_PT = 0.01
	exports.AIR_TIMER_PER_PT = AIR_TIMER_PER_PT
	AIR_TIMER_PER_PT_UNDER = 0.005
	exports.AIR_TIMER_PER_PT_UNDER = AIR_TIMER_PER_PT_UNDER
	AIR_TIMER_AERIAL_MIN = 30
	exports.AIR_TIMER_AERIAL_MIN = AIR_TIMER_AERIAL_MIN
	AIR_TIMER_AERIAL_MAX = 100
	exports.AIR_TIMER_AERIAL_MAX = AIR_TIMER_AERIAL_MAX
	exports.HEADER_Z = M_airDrawings.HEADER_Z
	exports.VOLLEY_MAX_Z = M_airDrawings.VOLLEY_MAX_Z
end
