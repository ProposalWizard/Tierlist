--!nocheck
--!nolint
-- Generated from lib/star/shotFeel.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_gameplayVersion = import("lib/star/gameplayVersion")
	local shotPowerOn, contactFieldOn, SHOT_POWER_CURVE, feelPower, POWER_UNTOUCHED, struckAtGoal, SHOT_LIFT_CURVE, lerpCurve, feelLift, FIELD_START, FIELD_SIDE_CY, FIELD_FADE, FIELD_UNTOUCHED, fieldApplies, fieldWeight, fieldContact
	feelPower = function(stat)
		do return lerpCurve(SHOT_POWER_CURVE, stat) end
	end
	exports.feelPower = feelPower
	struckAtGoal = function(sc, dir, cx)
		if cx == nil then cx = 0 end
		if A.includes(POWER_UNTOUCHED, sc.kind) then
			do return false end
		end
		local n = (function() local _l = Math.hypot(dir.x, dir.y); if Js.T(_l) then return _l end; return 1 end)()
		local ux = (dir.x / n)
		local uy = (dir.y / n)
		if (uy > -0.15) then
			do return false end
		end
		local x = (sc.ball.x + (ux * (sc.ball.y / (-uy))))
		local pad = (2.5 + (14 * Math.min(1, math.abs(cx))))
		do return ((x > (sc.goal.x1 - pad)) and (x < (sc.goal.x2 + pad))) end
	end
	exports.struckAtGoal = struckAtGoal
	lerpCurve = function(p, stat)
		local s = Math.max(0, Math.min(100, (if Js.NumberNS.isFinite(stat) then stat else 0)))
		for i = 1, (Js.alen(p)) - 1 do
			if (s <= p[i + 1][1]) then
				local _d1 = p[i]
				local a = _d1[1]
				local ea = _d1[2]
				local _d2 = p[i + 1]
				local b = _d2[1]
				local eb = _d2[2]
				do return (ea + (((s - a) / (b - a)) * (eb - ea))) end
			end
		end
		do return p[Js.alen(p)][2] end
	end
	feelLift = function(stat)
		do return lerpCurve(SHOT_LIFT_CURVE, stat) end
	end
	exports.feelLift = feelLift
	fieldApplies = function(kind)
		do return (not A.includes(FIELD_UNTOUCHED, kind)) end
	end
	exports.fieldApplies = fieldApplies
	fieldWeight = function(cx)
		local t = Math.max(0, Math.min(1, ((math.abs(cx) - FIELD_START) / (1 - FIELD_START))))
		do return ((t * t) * (3 - (2 * t))) end
	end
	exports.fieldWeight = fieldWeight
	fieldContact = function(c)
		local w = fieldWeight(c.cx)
		if (w == 0) then
			do return Js.O({ cx = c.cx, cy = c.cy }, { "cx", "cy" }) end
		end
		local keep = (1 - (FIELD_FADE * w))
		do return Js.O({ cx = c.cx, cy = (FIELD_SIDE_CY + ((c.cy - FIELD_SIDE_CY) * keep)) }, { "cx", "cy" }) end
	end
	exports.fieldContact = fieldContact
	shotPowerOn = function()
		return (M_gameplayVersion.gameplayVersion("shotPower") == "new")
	end
	exports.shotPowerOn = shotPowerOn
	contactFieldOn = function()
		return (M_gameplayVersion.gameplayVersion("contactField") == "new")
	end
	exports.contactFieldOn = contactFieldOn
	SHOT_POWER_CURVE = Js.alit(Js.alit(0, 0), Js.alit(20, 5), Js.alit(40, 22), Js.alit(60, 40), Js.alit(80, 56), Js.alit(100, 70))
	exports.SHOT_POWER_CURVE = SHOT_POWER_CURVE
	POWER_UNTOUCHED = Js.alit("corner", "byline_cross", "free_kick")
	SHOT_LIFT_CURVE = Js.alit(Js.alit(0, 1), Js.alit(40, 1), Js.alit(70, 0.94), Js.alit(100, 0.86))
	exports.SHOT_LIFT_CURVE = SHOT_LIFT_CURVE
	FIELD_START = 0.3
	exports.FIELD_START = FIELD_START
	FIELD_SIDE_CY = -0.7
	exports.FIELD_SIDE_CY = FIELD_SIDE_CY
	FIELD_FADE = 0.85
	exports.FIELD_FADE = FIELD_FADE
	FIELD_UNTOUCHED = Js.alit("corner", "byline_cross", "free_kick")
end
