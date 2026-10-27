--!nocheck
--!nolint
-- Generated from lib/star/legs.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_gait = import("lib/star/three3d/gait")
	local SPRINT_ENERGY_PER_S, BAR_CAP_PER_ENERGY, CARRY_SPEED_K, barCap, newLegs, setLegsEnergy, stepLegs, takeEnergySpent, scaleSpeeds, noKeys, moveKeyOf, keysScreenDir, KEY_PUSH
	newLegs = function(o)
		local cap = barCap((if o.energy ~= nil then o.energy else 100))
		local v = Math.min(cap, (if o.bar ~= nil then o.bar else 1))
		do return Js.O({ speeds = M_gait.speedsForPace((if o.pace ~= nil then o.pace else 50)), fit = M_gait.staminaFor((if o.physical ~= nil then o.physical else 50)), stamina = Js.O({ v = v, tired = (v <= 0) }, { "v", "tired" }), cap = cap, vel = Js.O({ x = 0, y = 0 }, { "x", "y" }), sprinting = false, spent = 0 }, { "speeds", "fit", "stamina", "cap", "vel", "sprinting", "spent" }) end
	end
	exports.newLegs = newLegs
	setLegsEnergy = function(l, energy)
		l.cap = barCap(energy)
		if (l.stamina.v > l.cap) then
			l.stamina = Js.ospread(l.stamina, Js.O({ v = l.cap }, { "v" }))
		end
	end
	exports.setLegsEnergy = setLegsEnergy
	stepLegs = function(l, p, push, sprintHeld, dt, o)
		if o == nil then o = Js.O({}, nil) end
		local mag = Math.min(1, Math.hypot(push.x, push.y))
		local s = (if o.carry then scaleSpeeds(l.speeds, CARRY_SPEED_K) else l.speeds)
		local able = (M_gait.canSprint(l.stamina) and (l.cap > 0.02))
		local want = M_gait.stickTarget(mag, (sprintHeld and (mag > 0.08)), s, able)
		local cur = Math.hypot(l.vel.x, l.vel.y)
		local speed = M_gait.approach(cur, want, dt, s)
		local ux = 0
		local uy = 0
		if (mag > 0.000001) then
			ux = (push.x / mag)
			uy = (push.y / mag)
		elseif (cur > 0.000001) then
			ux = (l.vel.x / cur)
			uy = (l.vel.y / cur)
		end
		if ((mag > 0.000001) and (cur > 0.000001)) then
			local k = Math.min(1, (dt / 0.12))
			local hx = ((l.vel.x / cur) + ((ux - (l.vel.x / cur)) * k))
			local hy = ((l.vel.y / cur) + ((uy - (l.vel.y / cur)) * k))
			local hl = (function() local _l = Math.hypot(hx, hy); if Js.T(_l) then return _l end; return 1 end)()
			ux = (hx / hl)
			uy = (hy / hl)
		end
		l.vel = Js.O({ x = (ux * speed), y = (uy * speed) }, { "x", "y" })
		if (o.bounds ~= false) then
			p.x = Math.max(-2, Math.min(70, (p.x + (l.vel.x * dt))))
			p.y = Math.max(-2, Math.min(106, (p.y + (l.vel.y * dt))))
		else
			p.x += (l.vel.x * dt)
			p.y += (l.vel.y * dt)
		end
		l.sprinting = ((want >= (s.sprint - 0.000001)) and (speed > (s.run * 0.9)))
		local effort = M_gait.effortOf(speed, l.sprinting, s)
		l.stamina = M_gait.stepStamina(l.stamina, effort, dt, 1, l.fit)
		if (l.stamina.v > l.cap) then
			l.stamina = Js.ospread(l.stamina, Js.O({ v = l.cap }, { "v" }))
		end
		if (effort == "sprint") then
			l.spent += (SPRINT_ENERGY_PER_S * dt)
		end
	end
	exports.stepLegs = stepLegs
	takeEnergySpent = function(l)
		local s = l.spent
		l.spent = 0
		do return s end
	end
	exports.takeEnergySpent = takeEnergySpent
	scaleSpeeds = function(s, k)
		do return Js.O({ walk = (s.walk * k), jog = (s.jog * k), run = (s.run * k), sprint = (s.sprint * k) }, { "walk", "jog", "run", "sprint" }) end
	end
	moveKeyOf = function(code)
		local _sw1 = code
		if _sw1 == "KeyW" or _sw1 == "ArrowUp" then
			do return "up" end
		elseif _sw1 == "KeyS" or _sw1 == "ArrowDown" then
			do return "down" end
		elseif _sw1 == "KeyA" or _sw1 == "ArrowLeft" then
			do return "left" end
		elseif _sw1 == "KeyD" or _sw1 == "ArrowRight" then
			do return "right" end
		elseif _sw1 == "ShiftLeft" or _sw1 == "ShiftRight" then
			do return "sprint" end
		else
			do return nil end
		end
	end
	exports.moveKeyOf = moveKeyOf
	keysScreenDir = function(k)
		local x = ((if k.right then 1 else 0) - (if k.left then 1 else 0))
		local y = ((if k.down then 1 else 0) - (if k.up then 1 else 0))
		local m = Math.hypot(x, y)
		do return (if (m > 0) then Js.O({ x = (x / m), y = (y / m) }, { "x", "y" }) else Js.O({ x = 0, y = 0 }, { "x", "y" })) end
	end
	exports.keysScreenDir = keysScreenDir
	SPRINT_ENERGY_PER_S = 0.12
	exports.SPRINT_ENERGY_PER_S = SPRINT_ENERGY_PER_S
	BAR_CAP_PER_ENERGY = (1 / 100)
	exports.BAR_CAP_PER_ENERGY = BAR_CAP_PER_ENERGY
	CARRY_SPEED_K = 0.85
	exports.CARRY_SPEED_K = CARRY_SPEED_K
	barCap = function(energy)
		return Math.max(0, Math.min(1, ((if Js.NumberNS.isFinite(energy) then energy else 100) * BAR_CAP_PER_ENERGY)))
	end
	exports.barCap = barCap
	noKeys = function()
		return Js.O({ up = false, down = false, left = false, right = false, sprint = false }, { "up", "down", "left", "right", "sprint" })
	end
	exports.noKeys = noKeys
	KEY_PUSH = 0.9
	exports.KEY_PUSH = KEY_PUSH
end
