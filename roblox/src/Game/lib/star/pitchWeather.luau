--!nocheck
--!nolint
-- Generated from lib/star/pitchWeather.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_ballPhysics = import("lib/star/ballPhysics")
	local DEAD_GRAB, Z0, ZREF, LOG_REF, windAtHeight, windGrip, windAccel, applyWind, skidKeep, grabDrop
	windAtHeight = function(z)
		do return Math.max(0, Math.min(1.15, (Math.log((Math.max(z, 0.1) / Z0)) / LOG_REF))) end
	end
	exports.windAtHeight = windAtHeight
	windGrip = function(z)
		do return Math.max(0, Math.min(1, ((z - 0.25) / 0.75))) end
	end
	exports.windGrip = windGrip
	windAccel = function(vx, vy, vz, z, w, exact)
		if exact == nil then exact = true end
		local f = (windAtHeight(z) * windGrip(z))
		if (f == 0) then
			do return Js.O({ ax = 0, ay = 0, az = 0 }, { "ax", "ay", "az" }) end
		end
		local wx = (w.x * f)
		local wy = (w.y * f)
		local rx = (vx - wx)
		local ry = (vy - wy)
		local sRel = Math.hypot(rx, ry, vz)
		local s = Math.hypot(vx, vy, vz)
		local kRel = ((M_ballPhysics.K_AIR * M_ballPhysics.dragCoeff(sRel)) * sRel)
		local k = ((M_ballPhysics.K_AIR * M_ballPhysics.dragCoeff(s)) * s)
		if (not exact) then
			do return Js.O({ ax = (kRel * wx), ay = (kRel * wy), az = 0 }, { "ax", "ay", "az" }) end
		end
		do return Js.O({ ax = (((-kRel) * rx) + (k * vx)), ay = (((-kRel) * ry) + (k * vy)), az = (((-kRel) * vz) + (k * vz)) }, { "ax", "ay", "az" }) end
	end
	exports.windAccel = windAccel
	applyWind = function(ball, cond, dt, exact)
		if exact == nil then exact = true end
		local w = (function() local _v = cond; if _v == nil then return nil end; _v = _v.windV; return _v end)()
		if ((not w) or ((w.x == 0) and (w.y == 0))) then
			do return end
		end
		local a = windAccel(ball.vel.x, ball.vel.y, ball.vz, ball.z, w, exact)
		ball.vel.x += (a.ax * dt)
		ball.vel.y += (a.ay * dt)
		ball.vz += (a.az * dt)
	end
	exports.applyWind = applyWind
	skidKeep = function(keep, cond)
		local s = (function() local _v = cond; if _v == nil then return nil end; _v = _v.skid; return _v end)()
		if (not Js.T(s)) then
			do return keep end
		end
		if (s > 0) then
			do return (keep + ((1 - keep) * Math.min(1, s))) end
		end
		do return Math.max(0, (keep - ((1 - keep) * Math.min(1, (-s))))) end
	end
	exports.skidKeep = skidKeep
	grabDrop = function(drop, speed, cond, dt)
		local d = (function() local _v = cond; if _v == nil then return nil end; _v = _v.deadBelow; return _v end)()
		if ((not Js.T(d)) or (speed >= d)) then
			do return drop end
		end
		do return (drop + ((DEAD_GRAB * (1 - (speed / d))) * dt)) end
	end
	exports.grabDrop = grabDrop
	DEAD_GRAB = 7
	exports.DEAD_GRAB = DEAD_GRAB
	Z0 = 0.03
	ZREF = 10
	LOG_REF = Math.log((ZREF / Z0))
end
