--!nocheck
--!nolint
-- Generated from lib/star/airTap.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_airborneChance = import("lib/star/airborneChance")
	local M_pitch = import("lib/star/pitch")
	local KEY, airTapOn, AIR_TAP_OPEN_S, AIR_TAP_OPEN_NO_LEAD_S, AIR_TAP_POST_CX, AIR_TAP_INSET_M, AIR_TAP_POWER, AIR_TAP_CLEAN_PAD, AIR_TAP_CLEAN_K, airTapCleanR, airTapAimX, airTapAim, airTapContactCx, airTapStrike
	airTapOn = function()
		local _ok1, _err2, _rv3 = pcall(function()
			if (Js.window ~= nil) then
				local q = Js.URLSearchParams.new(Js.window.location.search).get("airtap")
				if (q == "old") then
					do return Js.RET, false end
				end
				if (q == "new") then
					do return Js.RET, true end
				end
			end
			do return Js.RET, ((Js.localStorage == nil) or (Js.localStorage.getItem(KEY) ~= "old")) end
		end)
		if not _ok1 then
			do return true end
		elseif _err2 == Js.RET then
			return _rv3
		end
	end
	exports.airTapOn = airTapOn
	airTapCleanR = function(kind, aerial)
		do return Math.min(0.95, (AIR_TAP_CLEAN_PAD[kind] + (AIR_TAP_CLEAN_K[kind] * M_airborneChance.airCentreR(aerial)))) end
	end
	exports.airTapCleanR = airTapCleanR
	airTapAimX = function(cx)
		local g = Math.max(-1, Math.min(1, (cx / AIR_TAP_POST_CX)))
		do return (M_pitch.CX - (g * ((M_pitch.GOAL_W / 2) - AIR_TAP_INSET_M))) end
	end
	exports.airTapAimX = airTapAimX
	airTapAim = function(kind, ball, cx)
		local dx = (airTapAimX(cx) - ball.x)
		local dy = (-ball.y)
		local L = (function() local _l = Math.hypot(dx, dy); if Js.T(_l) then return _l end; return 1 end)()
		do return Js.O({ dir = Js.O({ x = (dx / L), y = (dy / L) }, { "x", "y" }), power = AIR_TAP_POWER[kind] }, { "dir", "power" }) end
	end
	exports.airTapAim = airTapAim
	airTapContactCx = function(kind, cx, aerial)
		local a = Math.min(1, math.abs(cx))
		local s = (if (cx < 0) then -1 else 1)
		local W = airTapCleanR(kind, aerial)
		local R0 = M_airborneChance.airCentreR(aerial)
		if (a <= W) then
			do return (((s * a) * (R0 / W)) * 0.999) end
		end
		do return (s * (R0 + (((1 - R0) * (a - W)) / (1 - W)))) end
	end
	exports.airTapContactCx = airTapContactCx
	airTapStrike = function(kind, ball, tap, aerial)
		if tap.late then
			do return Js.O({ contact = tap, aim = airTapAim(kind, ball, 0) }, { "contact", "aim" }) end
		end
		do return Js.O({ contact = Js.ospread(tap, Js.O({ cx = airTapContactCx(kind, tap.cx, aerial) }, { "cx" })), aim = airTapAim(kind, ball, tap.cx) }, { "contact", "aim" }) end
	end
	exports.airTapStrike = airTapStrike
	KEY = "star-air-tap"
	AIR_TAP_OPEN_S = 0.3
	exports.AIR_TAP_OPEN_S = AIR_TAP_OPEN_S
	AIR_TAP_OPEN_NO_LEAD_S = 0.8
	exports.AIR_TAP_OPEN_NO_LEAD_S = AIR_TAP_OPEN_NO_LEAD_S
	AIR_TAP_POST_CX = 0.8
	exports.AIR_TAP_POST_CX = AIR_TAP_POST_CX
	AIR_TAP_INSET_M = 0.3
	exports.AIR_TAP_INSET_M = AIR_TAP_INSET_M
	AIR_TAP_POWER = Js.O({ header = 0.85, volley = 0.92 }, { "header", "volley" })
	exports.AIR_TAP_POWER = AIR_TAP_POWER
	AIR_TAP_CLEAN_PAD = Js.O({ header = 0.72, volley = 0.55 }, { "header", "volley" })
	exports.AIR_TAP_CLEAN_PAD = AIR_TAP_CLEAN_PAD
	AIR_TAP_CLEAN_K = Js.O({ header = 0.6, volley = 1.3 }, { "header", "volley" })
	exports.AIR_TAP_CLEAN_K = AIR_TAP_CLEAN_K
end
