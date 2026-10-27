--!nocheck
--!nolint
-- Generated from lib/star/ballPhysics.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_pitchWeather = import("lib/star/pitchWeather")
	local M_pitch = import("lib/star/pitch")
	local realOn, setBallPhysics, realBallOn, G_REAL, BALL_MASS, BALL_RADIUS, BALL_AREA, AIR_RHO, K_AIR, CD_SLOW, CD_FAST, CD_CRISIS_V, CD_CRISIS_W, dragCoeff, ROLL_DECEL, GRASS_DRAG, BOUNCE_E, GRASS_MU, ROLL_ON, MIN_BOUNCE_VZ, SPIN_TAU_AIR, SPIN_TAU_GROUND, CURL_K, BOUNCE_SPIN_KEEP, BOUNCE_TOPSPIN_VZ, BOUNCE_SIDESPIN_TURN, POST_RADIUS, FRAME_E, FRAME_TANGENT_KEEP, POST_HIT_R, POST_CX_L, POST_CX_R, BAR_CZ, airDragFactor, rollDrop, bounceReal, clamp, integrateBallReal, coastBallReal, sweepCircle, frameContact, bounceOffFrame, dragCompensate
	setBallPhysics = function(v)
		realOn = (v == "new")
	end
	exports.setBallPhysics = setBallPhysics
	realBallOn = function()
		do return realOn end
	end
	exports.realBallOn = realBallOn
	dragCoeff = function(v)
		do return (CD_FAST + ((CD_SLOW - CD_FAST) / (1 + Math.exp(((v - CD_CRISIS_V) / CD_CRISIS_W))))) end
	end
	exports.dragCoeff = dragCoeff
	airDragFactor = function(vx, vy, vz, dragMul, dt)
		local s = Math.hypot(vx, vy, vz)
		do return (1 / (1 + ((((K_AIR * dragCoeff(s)) * dragMul) * s) * dt))) end
	end
	exports.airDragFactor = airDragFactor
	rollDrop = function(s, fricMul, dragMul, dt)
		do return ((((ROLL_DECEL * fricMul) + (GRASS_DRAG * s)) + ((((K_AIR * dragCoeff(s)) * dragMul) * s) * s)) * dt) end
	end
	exports.rollDrop = rollDrop
	bounceReal = function(vzIn, vh, top, bounceMul)
		local e = (BOUNCE_E * bounceMul)
		local vz = (((-vzIn) * e) * (1 - (top * BOUNCE_TOPSPIN_VZ)))
		if (vh < 0.01) then
			do return Js.O({ vz = vz, keep = 1, top = top }, { "vz", "keep", "top" }) end
		end
		local slip = (vh * clamp((1 - top), 0, 2))
		local grip = Math.min(1, ((math.abs(vzIn) / 3) ^ 2))
		local loss = Math.min((((GRASS_MU * grip) * (1 + e)) * math.abs(vzIn)), (ROLL_ON * slip))
		local vOut = Math.max(0.001, (vh - loss))
		local topOut = clamp((((top * vh) + (1.5 * loss)) / vOut), -1, 1)
		do return Js.O({ vz = vz, keep = Math.max(0, (vOut / vh)), top = topOut }, { "vz", "keep", "top" }) end
	end
	exports.bounceReal = bounceReal
	clamp = function(v, a, b)
		do return Math.max(a, Math.min(b, v)) end
	end
	integrateBallReal = function(ball, cond, dt)
		local dragMul = ((function() local _v = cond; if _v == nil then return nil end; _v = _v.drag; return _v end)() or 1)
		local sp0 = Math.hypot(ball.vel.x, ball.vel.y)
		if ((sp0 > 0.01) and (math.abs(ball.spin) > 0.0001)) then
			local ax = ((ball.spin * CURL_K) * ball.vel.y)
			local ay = ((ball.spin * CURL_K) * (-ball.vel.x))
			ball.vel.x += (ax * dt)
			ball.vel.y += (ay * dt)
		end
		local airborne = (ball.z > 0.02)
		if airborne then
			local k = airDragFactor(ball.vel.x, ball.vel.y, ball.vz, dragMul, dt)
			ball.vel.x *= k
			ball.vel.y *= k
			ball.vz *= k
			if Js.T((function() local _v = cond; if _v == nil then return nil end; _v = _v.wind; return _v end)()) then
				ball.vel.x += (cond.wind * dt)
			end
			if (function() local _v = cond; if _v == nil then return nil end; _v = _v.windV; return _v end)() then
				M_pitchWeather.applyWind(ball, cond, dt)
			end
		end
		if (ball.spin ~= 0) then
			ball.spin *= Math.exp(((-dt) / (if airborne then SPIN_TAU_AIR else SPIN_TAU_GROUND)))
		end
		ball.vz -= (G_REAL * dt)
		ball.z += (ball.vz * dt)
		ball.pos.x += (ball.vel.x * dt)
		ball.pos.y += (ball.vel.y * dt)
		local bounced = false
		if (ball.z <= 0) then
			ball.z = 0
			if (ball.vz < (-MIN_BOUNCE_VZ)) then
				local top = clamp((if ball.topspin ~= nil then ball.topspin else 0), -1, 1)
				local vh = Math.hypot(ball.vel.x, ball.vel.y)
				local b = bounceReal(ball.vz, vh, top, ((function() local _v = cond; if _v == nil then return nil end; _v = _v.bounce; return _v end)() or 1))
				ball.vz = b.vz
				local keep = (if Js.T((function() local _v = cond; if _v == nil then return nil end; _v = _v.skid; return _v end)()) then M_pitchWeather.skidKeep(b.keep, cond) else b.keep)
				ball.vel.x *= keep
				ball.vel.y *= keep
				if (math.abs(ball.spin) > 0.0001) then
					local sp = Math.hypot(ball.vel.x, ball.vel.y)
					if (sp > 0.01) then
						local a = (ball.spin * BOUNCE_SIDESPIN_TURN)
						local cos = Math.cos(a)
						local sin = Math.sin(a)
						local vx = ball.vel.x
						local vy = ball.vel.y
						ball.vel.x = ((vx * cos) - (vy * sin))
						ball.vel.y = ((vx * sin) + (vy * cos))
					end
				end
				ball.spin *= BOUNCE_SPIN_KEEP
				ball.topspin = b.top
				bounced = true
			else
				ball.vz = 0
			end
		end
		if (((ball.z <= 0.03) and (not bounced)) and (ball.vz <= 0.01)) then
			local s = Math.hypot(ball.vel.x, ball.vel.y)
			local drop = rollDrop(s, ((function() local _v = cond; if _v == nil then return nil end; _v = _v.friction; return _v end)() or 1), dragMul, dt)
			if Js.T((function() local _v = cond; if _v == nil then return nil end; _v = _v.deadBelow; return _v end)()) then
				drop = M_pitchWeather.grabDrop(drop, s, cond, dt)
			end
			if (s <= drop) then
				ball.vel.x = 0
				ball.vel.y = 0
				ball.resting = true
			else
				local f = ((s - drop) / s)
				ball.vel.x *= f
				ball.vel.y *= f
			end
		end
		do return bounced end
	end
	exports.integrateBallReal = integrateBallReal
	coastBallReal = function(ball, cond, dt)
		local spin = ball.spin
		ball.spin = 0
		integrateBallReal(ball, cond, dt)
		ball.spin = spin
	end
	exports.coastBallReal = coastBallReal
	sweepCircle = function(ax, ay, bx, by, cx, cy, R)
		local dx = (bx - ax)
		local dy = (by - ay)
		local fx = (ax - cx)
		local fy = (ay - cy)
		local A_ = ((dx * dx) + (dy * dy))
		local C = (((fx * fx) + (fy * fy)) - (R * R))
		if (C <= 0) then
			do return (if (((fx * dx) + (fy * dy)) < 0) then 0 else nil) end
		end
		if (A_ < 1e-12) then
			do return nil end
		end
		local B = (2 * ((fx * dx) + (fy * dy)))
		local disc = ((B * B) - ((4 * A_) * C))
		if (disc < 0) then
			do return nil end
		end
		local t = (((-B) - Math.sqrt(disc)) / (2 * A_))
		do return (if ((t >= 0) and (t <= 1)) then t else nil) end
	end
	frameContact = function(prevX, prevY, prevZ, x, y, z, goal, crossbar)
		if goal == nil then goal = Js.O({ x1 = M_pitch.POST_L, x2 = M_pitch.POST_R }, { "x1", "x2" }) end
		if crossbar == nil then crossbar = M_pitch.GOAL_H end
		if ((Math.min(prevY, y) > (POST_HIT_R + 0.05)) or (Math.max(prevY, y) < ((-POST_HIT_R) - 0.05))) then
			do return nil end
		end
		local pl = (goal.x1 - POST_RADIUS)
		local pr = (goal.x2 + POST_RADIUS)
		local barZ = (crossbar + POST_RADIUS)
		local best = nil
		do
			local _arr1 = Js.alit(Js.alit("postL", pl), Js.alit("postR", pr))
			local _i2 = 0
			while _i2 < Js.alen(_arr1) do
				_i2 += 1
				local _e3 = _arr1[_i2]
				local part = _e3[1]
				local cx = _e3[2]
				local f = sweepCircle(prevX, prevY, x, y, cx, 0, POST_HIT_R)
				if (f == nil) then
					do continue end
				end
				local hz = (prevZ + ((z - prevZ) * f))
				if ((hz < 0) or (hz > barZ)) then
					do continue end
				end
				if ((not best) or (f < best.f)) then
					local hx = (prevX + ((x - prevX) * f))
					local hy = (prevY + ((y - prevY) * f))
					local L = (function() local _l = Math.hypot((hx - cx), hy); if Js.T(_l) then return _l end; return 1 end)()
					best = Js.O({ part = part, f = f, nx = ((hx - cx) / L), ny = (hy / L), nz = 0 }, { "part", "f", "nx", "ny", "nz" })
				end
			end
		end
		do
			local f = sweepCircle(prevY, prevZ, y, z, 0, barZ, POST_HIT_R)
			if (f ~= nil) then
				local hx = (prevX + ((x - prevX) * f))
				if (((hx >= pl) and (hx <= pr)) and ((not best) or (f < best.f))) then
					local hy = (prevY + ((y - prevY) * f))
					local hz = (prevZ + ((z - prevZ) * f))
					local L = (function() local _l = Math.hypot(hy, (hz - barZ)); if Js.T(_l) then return _l end; return 1 end)()
					best = Js.O({ part = "bar", f = f, nx = 0, ny = (hy / L), nz = ((hz - barZ) / L) }, { "part", "f", "nx", "ny", "nz" })
				end
			end
		end
		do return best end
	end
	exports.frameContact = frameContact
	bounceOffFrame = function(ball, prevX, prevY, prevZ, hit, goal)
		if goal == nil then goal = Js.O({ x1 = M_pitch.POST_L, x2 = M_pitch.POST_R }, { "x1", "x2" }) end
		local _d4 = hit
		local f = _d4.f
		local nx = _d4.nx
		local ny = _d4.ny
		local nz = _d4.nz
		local vx = ball.vel.x
		local vy = ball.vel.y
		local vz = ball.vz
		local vn = (((vx * nx) + (vy * ny)) + (vz * nz))
		if (vn < 0) then
			local tx = (vx - (vn * nx))
			local ty = (vy - (vn * ny))
			local tz = (vz - (vn * nz))
			ball.vel.x = ((tx * FRAME_TANGENT_KEEP) - ((FRAME_E * vn) * nx))
			ball.vel.y = ((ty * FRAME_TANGENT_KEEP) - ((FRAME_E * vn) * ny))
			ball.vz = ((tz * FRAME_TANGENT_KEEP) - ((FRAME_E * vn) * nz))
		end
		local hx = (prevX + ((ball.pos.x - prevX) * f))
		local hy = (prevY + ((ball.pos.y - prevY) * f))
		local hz = (prevZ + ((ball.z - prevZ) * f))
		ball.pos.x = (hx + (nx * 0.01))
		ball.pos.y = (hy + (ny * 0.01))
		ball.z = Math.max(0, (hz + (nz * 0.01)))
		ball.spin *= 0.25
		local t = (if (ball.vel.y < -0.2) then (ball.pos.y / (-ball.vel.y)) else math.huge)
		local xAt = (ball.pos.x + (ball.vel.x * Math.min(t, 1)))
		do return (((ball.vel.y < -0.2) and (xAt > goal.x1)) and (xAt < goal.x2)) end
	end
	exports.bounceOffFrame = bounceOffFrame
	dragCompensate = function(sh, vz, dist, z0)
		if z0 == nil then z0 = 0.08 end
		if (((not realOn) or (dist < 0.5)) or (sh < 0.5)) then
			do return Js.O({ sh = sh, vz = vz }, { "sh", "vz" }) end
		end
		local tWant = (dist / sh)
		local zWant = ((z0 + (vz * tWant)) - (((0.5 * G_REAL) * tWant) * tWant))
		local s1 = sh
		local v1 = vz
		local dt = (1 / 180)
		for it = 0, 5 do
			local x = 0
			local z = z0
			local vx = s1
			local vzz = v1
			local t = 0
			while ((x < dist) and (t < 6)) do
				local k = airDragFactor(vx, 0, vzz, 1, dt)
				vx *= k
				vzz *= k
				vzz -= (G_REAL * dt)
				x += (vx * dt)
				z += (vzz * dt)
				t += dt
			end
			if (t >= 6) then
				do break end
			end
			local over = ((x - dist) / Math.max(vx, 0.1))
			local tAt = (t - over)
			local zAt = (z - (vzz * over))
			s1 *= (tAt / tWant)
			v1 += ((zWant - zAt) / tWant)
			if ((math.abs((tAt - tWant)) < 0.001) and (math.abs((zAt - zWant)) < 0.01)) then
				do break end
			end
		end
		do return Js.O({ sh = s1, vz = v1 }, { "sh", "vz" }) end
	end
	exports.dragCompensate = dragCompensate
	realOn = (function()
		local _ok5, _err6, _rv7 = pcall(function()
			do return Js.RET, ((Js.process ~= nil) and ((function() local _v = Js.process.env; if _v == nil then return nil end; _v = _v.STAR_BALL_PHYSICS; return _v end)() == "new")) end
		end)
		if not _ok5 then
			do return false end
		elseif _err6 == Js.RET then
			return _rv7
		end
	end)()
	G_REAL = 9.8
	exports.G_REAL = G_REAL
	BALL_MASS = 0.43
	exports.BALL_MASS = BALL_MASS
	BALL_RADIUS = (0.69 / (2 * Math.PI))
	exports.BALL_RADIUS = BALL_RADIUS
	BALL_AREA = ((Math.PI * BALL_RADIUS) * BALL_RADIUS)
	exports.BALL_AREA = BALL_AREA
	AIR_RHO = 1.225
	exports.AIR_RHO = AIR_RHO
	K_AIR = (((0.5 * AIR_RHO) * BALL_AREA) / BALL_MASS)
	exports.K_AIR = K_AIR
	CD_SLOW = 0.47
	exports.CD_SLOW = CD_SLOW
	CD_FAST = 0.2
	exports.CD_FAST = CD_FAST
	CD_CRISIS_V = 11
	exports.CD_CRISIS_V = CD_CRISIS_V
	CD_CRISIS_W = 1.6
	exports.CD_CRISIS_W = CD_CRISIS_W
	ROLL_DECEL = 0.85
	exports.ROLL_DECEL = ROLL_DECEL
	GRASS_DRAG = 0.05
	exports.GRASS_DRAG = GRASS_DRAG
	BOUNCE_E = 0.6
	exports.BOUNCE_E = BOUNCE_E
	GRASS_MU = 0.5
	exports.GRASS_MU = GRASS_MU
	ROLL_ON = 0.4
	exports.ROLL_ON = ROLL_ON
	MIN_BOUNCE_VZ = 0.5
	SPIN_TAU_AIR = 10
	exports.SPIN_TAU_AIR = SPIN_TAU_AIR
	SPIN_TAU_GROUND = 0.7
	exports.SPIN_TAU_GROUND = SPIN_TAU_GROUND
	CURL_K = 0.48
	BOUNCE_SPIN_KEEP = 0.82
	BOUNCE_TOPSPIN_VZ = 0.18
	BOUNCE_SIDESPIN_TURN = 0.12
	POST_RADIUS = 0.06
	exports.POST_RADIUS = POST_RADIUS
	FRAME_E = 0.7
	exports.FRAME_E = FRAME_E
	FRAME_TANGENT_KEEP = 0.9
	exports.FRAME_TANGENT_KEEP = FRAME_TANGENT_KEEP
	POST_HIT_R = (M_pitch.BALL_R + POST_RADIUS)
	exports.POST_HIT_R = POST_HIT_R
	POST_CX_L = (M_pitch.POST_L - POST_RADIUS)
	exports.POST_CX_L = POST_CX_L
	POST_CX_R = (M_pitch.POST_R + POST_RADIUS)
	exports.POST_CX_R = POST_CX_R
	BAR_CZ = (M_pitch.GOAL_H + POST_RADIUS)
	exports.BAR_CZ = BAR_CZ
end
