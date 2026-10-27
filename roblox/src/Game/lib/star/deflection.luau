--!nocheck
--!nolint
-- Generated from lib/star/deflection.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_canvasEngine = import("lib/star/canvasEngine")
	local DEFLECTION_MIX, DEG, deflectBlock
	deflectBlock = function(ball, sc, pre, r)
		local s0 = Math.max(6, Math.hypot(pre.vx, pre.vy))
		local a0 = Math.atan2(pre.vy, pre.vx)
		local u = r()
		local side = (if (r() < 0.5) then -1 else 1)
		local kind = nil
		local a = nil
		local s = nil
		local vz = nil
		if (u < DEFLECTION_MIX.glance) then
			kind = "glance"
			a = (a0 + ((side * (8 + (r() * 22))) * DEG))
			s = (s0 * (0.5 + (r() * 0.25)))
			vz = ((Math.max(0, pre.vz) * 0.4) + (r() * 2.2))
		elseif (u < (DEFLECTION_MIX.glance + DEFLECTION_MIX.loop)) then
			kind = "loop"
			a = (a0 + (((side * r()) * 45) * DEG))
			s = (s0 * (0.15 + (r() * 0.17)))
			vz = (5 + (r() * 3))
		else
			kind = "loose"
			a = ((a0 + Math.PI) + (((side * r()) * 75) * DEG))
			s = (s0 * (0.22 + (r() * 0.3)))
			vz = (r() * 2.4)
		end
		ball.vel = Js.O({ x = (Math.cos(a) * s), y = (Math.sin(a) * s) }, { "x", "y" })
		ball.vz = vz
		ball.z = Math.max(ball.z, Math.min(pre.z, 1.2))
		ball.spin = ((pre.spin * 0.3) + ((r() - 0.5) * 0.4))
		ball.topspin = 0
		ball.resting = false
		ball.settling = false
		ball.loose = true
		ball.shot = false
		ball.owner = "none"
		ball.lastTouch = "defence"
		ball.cleared = false
		ball.clearHitAt = nil
		ball.contactCd = 0.22
		M_canvasEngine.markLanding(ball, sc)
		do return kind end
	end
	exports.deflectBlock = deflectBlock
	DEFLECTION_MIX = Js.O({ glance = 0.22, loop = 0.2 }, { "glance", "loop" })
	exports.DEFLECTION_MIX = DEFLECTION_MIX
	DEG = (Math.PI / 180)
end
