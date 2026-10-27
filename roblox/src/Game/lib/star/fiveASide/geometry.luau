--!nocheck
--!nolint
-- Generated from lib/star/fiveASide/geometry.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_pitch = import("lib/star/pitch")
	local M_canvasEngine = import("lib/star/canvasEngine")
	local VIEW_H, FIVE_VIEW, FIVE_PITCH, FIVE_PITCH_W, FIVE_PITCH_L, FIVE_HALFWAY_Y, KICK_FLOOR_Y, FIVE_GOAL_W, FIVE_CROSSBAR, FIVE_KEEPER_STRENGTH, FIVE_KEEPER_REACH, FIVE_GOAL, insideFivePitch, leftPitch, mirror, clampToPitch
	insideFivePitch = function(p)
		do return ((((p.x >= FIVE_PITCH.x1) and (p.x <= FIVE_PITCH.x2)) and (p.y >= FIVE_PITCH.y1)) and (p.y <= FIVE_PITCH.y2)) end
	end
	exports.insideFivePitch = insideFivePitch
	leftPitch = function(p)
		if (p.y < FIVE_PITCH.y1) then
			do return "goal-line-theirs" end
		end
		if (p.y > FIVE_PITCH.y2) then
			do return "goal-line-ours" end
		end
		if ((p.x < FIVE_PITCH.x1) or (p.x > FIVE_PITCH.x2)) then
			do return "touchline" end
		end
		do return nil end
	end
	exports.leftPitch = leftPitch
	mirror = function(p)
		do return Js.O({ x = ((2 * M_pitch.CX) - p.x), y = (FIVE_PITCH.y2 - p.y) }, { "x", "y" }) end
	end
	exports.mirror = mirror
	clampToPitch = function(p, inset)
		if inset == nil then inset = 0 end
		local cl = function(v, lo, hi)
			return Math.max((lo + inset), Math.min((hi - inset), v))
		end
		do return Js.O({ x = cl(p.x, FIVE_PITCH.x1, FIVE_PITCH.x2), y = cl(p.y, FIVE_PITCH.y1, FIVE_PITCH.y2) }, { "x", "y" }) end
	end
	exports.clampToPitch = clampToPitch
	VIEW_H = 42
	FIVE_VIEW = (function()
		local w = (VIEW_H * M_canvasEngine.VIEW_ASPECT)
		do return Js.O({ x1 = (M_pitch.CX - (w / 2)), x2 = (M_pitch.CX + (w / 2)), y1 = -4.5, y2 = (-4.5 + VIEW_H) }, { "x1", "x2", "y1", "y2" }) end
	end)()
	exports.FIVE_VIEW = FIVE_VIEW
	FIVE_PITCH = Js.O({ x1 = 22, x2 = 46, y1 = 0, y2 = 36 }, { "x1", "x2", "y1", "y2" })
	exports.FIVE_PITCH = FIVE_PITCH
	FIVE_PITCH_W = (FIVE_PITCH.x2 - FIVE_PITCH.x1)
	exports.FIVE_PITCH_W = FIVE_PITCH_W
	FIVE_PITCH_L = (FIVE_PITCH.y2 - FIVE_PITCH.y1)
	exports.FIVE_PITCH_L = FIVE_PITCH_L
	FIVE_HALFWAY_Y = ((FIVE_PITCH.y1 + FIVE_PITCH.y2) / 2)
	exports.FIVE_HALFWAY_Y = FIVE_HALFWAY_Y
	KICK_FLOOR_Y = (FIVE_VIEW.y2 - ((FIVE_VIEW.y2 - FIVE_VIEW.y1) * 0.2))
	exports.KICK_FLOOR_Y = KICK_FLOOR_Y
	FIVE_GOAL_W = 5.2
	exports.FIVE_GOAL_W = FIVE_GOAL_W
	FIVE_CROSSBAR = 2
	exports.FIVE_CROSSBAR = FIVE_CROSSBAR
	FIVE_KEEPER_STRENGTH = 40
	exports.FIVE_KEEPER_STRENGTH = FIVE_KEEPER_STRENGTH
	FIVE_KEEPER_REACH = (5.2 / 7.32)
	exports.FIVE_KEEPER_REACH = FIVE_KEEPER_REACH
	FIVE_GOAL = Js.O({ x1 = (M_pitch.CX - (FIVE_GOAL_W / 2)), x2 = (M_pitch.CX + (FIVE_GOAL_W / 2)) }, { "x1", "x2" })
	exports.FIVE_GOAL = FIVE_GOAL
end
