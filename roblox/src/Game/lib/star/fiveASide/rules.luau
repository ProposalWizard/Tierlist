--!nocheck
--!nolint
-- Generated from lib/star/fiveASide/rules.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_geometry = import("lib/star/fiveASide/geometry")
	local M_pitch = import("lib/star/pitch")
	local M_canvasEngine = import("lib/star/canvasEngine")
	local FIVE_A_SIDE, ELEVEN_A_SIDE, ELEVEN_A_SIDE_ATTACK, centreSpot, fullTimeMinutes, halfwayY, goalCentreX, rulesAreSane
	centreSpot = function(rules)
		do return Js.O({ x = ((rules.pitch.x1 + rules.pitch.x2) / 2), y = ((rules.pitch.y1 + rules.pitch.y2) / 2) }, { "x", "y" }) end
	end
	exports.centreSpot = centreSpot
	fullTimeMinutes = function(rules)
		do return (rules.halves * rules.minutesPerHalf) end
	end
	exports.fullTimeMinutes = fullTimeMinutes
	halfwayY = function(rules)
		do return ((rules.pitch.y1 + rules.pitch.y2) / 2) end
	end
	exports.halfwayY = halfwayY
	goalCentreX = function(rules)
		do return ((rules.goal.x1 + rules.goal.x2) / 2) end
	end
	exports.goalCentreX = goalCentreX
	rulesAreSane = function(rules)
		local bad = Js.alit()
		local _d1 = rules
		local pitch = _d1.pitch
		local view = _d1.view
		local goal = _d1.goal
		if ((pitch.x1 >= pitch.x2) or (pitch.y1 >= pitch.y2)) then
			A.push(bad, "the pitch has no area")
		end
		if (goal.x1 >= goal.x2) then
			A.push(bad, "the goal has no width")
		end
		if ((goal.x1 < pitch.x1) or (goal.x2 > pitch.x2)) then
			A.push(bad, "the goal is not on the pitch")
		end
		if (not rules.needsMovingCamera) then
			if ((pitch.x1 < view.x1) or (pitch.x2 > view.x2)) then
				A.push(bad, "the pitch is wider than the camera")
			end
			if (pitch.y2 > view.y2) then
				A.push(bad, "your own goal is off the bottom of the camera")
			end
		end
		if (rules.outfieldPerSide < 1) then
			A.push(bad, "a side needs at least one outfielder")
		end
		if (rules.crossbar <= 0) then
			A.push(bad, "the bar has no height")
		end
		if ((rules.halves < 1) or (rules.minutesPerHalf <= 0)) then
			A.push(bad, "the match has no length")
		end
		if (rules.kickFloorY <= pitch.y1) then
			A.push(bad, "there is nowhere legal to take a kick from")
		end
		do return bad end
	end
	exports.rulesAreSane = rulesAreSane
	FIVE_A_SIDE = Js.O({ name = "Five-a-side", outfieldPerSide = 4, pitch = M_geometry.FIVE_PITCH, view = M_geometry.FIVE_VIEW, goal = M_geometry.FIVE_GOAL, crossbar = M_geometry.FIVE_CROSSBAR, halves = 2, minutesPerHalf = 22.5, kickFloorY = (M_geometry.FIVE_VIEW.y2 - ((M_geometry.FIVE_VIEW.y2 - M_geometry.FIVE_VIEW.y1) * 0.2)), offside = false }, { "name", "outfieldPerSide", "pitch", "view", "goal", "crossbar", "halves", "minutesPerHalf", "kickFloorY", "offside" })
	exports.FIVE_A_SIDE = FIVE_A_SIDE
	ELEVEN_A_SIDE = Js.O({ name = "Eleven-a-side", outfieldPerSide = 10, pitch = Js.O({ x1 = 0, x2 = 68, y1 = 0, y2 = 52.5 }, { "x1", "x2", "y1", "y2" }), view = M_geometry.FIVE_VIEW, goal = Js.O({ x1 = M_pitch.POST_L, x2 = M_pitch.POST_R }, { "x1", "x2" }), crossbar = M_pitch.GOAL_H, halves = 2, minutesPerHalf = 45, kickFloorY = (M_geometry.FIVE_VIEW.y2 - ((M_geometry.FIVE_VIEW.y2 - M_geometry.FIVE_VIEW.y1) * 0.2)), offside = true, needsMovingCamera = true }, { "name", "outfieldPerSide", "pitch", "view", "goal", "crossbar", "halves", "minutesPerHalf", "kickFloorY", "offside", "needsMovingCamera" })
	exports.ELEVEN_A_SIDE = ELEVEN_A_SIDE
	ELEVEN_A_SIDE_ATTACK = Js.O({ name = "Eleven-a-side (attacking third)", outfieldPerSide = 10, pitch = Js.O({ x1 = 0, x2 = M_pitch.PITCH_W, y1 = 0, y2 = M_pitch.HALF_LEN }, { "x1", "x2", "y1", "y2" }), view = (function()
		local h = 48
		local w = (h * M_canvasEngine.VIEW_ASPECT)
		do return Js.O({ x1 = (M_pitch.CX - (w / 2)), x2 = (M_pitch.CX + (w / 2)), y1 = ((-M_pitch.NET_DEPTH) - 3), y2 = (((-M_pitch.NET_DEPTH) - 3) + h) }, { "x1", "x2", "y1", "y2" }) end
	end)(), goal = Js.O({ x1 = M_pitch.POST_L, x2 = M_pitch.POST_R }, { "x1", "x2" }), crossbar = M_pitch.GOAL_H, halves = 2, minutesPerHalf = 45, kickFloorY = 6, offside = true, markings = "penalty-area", netDepth = M_pitch.NET_DEPTH, needsMovingCamera = true }, { "name", "outfieldPerSide", "pitch", "view", "goal", "crossbar", "halves", "minutesPerHalf", "kickFloorY", "offside", "markings", "netDepth", "needsMovingCamera" })
	exports.ELEVEN_A_SIDE_ATTACK = ELEVEN_A_SIDE_ATTACK
end
