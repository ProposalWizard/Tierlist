--!nocheck
--!nolint
-- Generated from lib/star/scenePicture.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_scenarioEdit = import("lib/star/scenarioEdit")
	local stageScene
	stageScene = function(sc, s)
		if (not s) then
			do return end
		end
		if (s.keeper == false) then
			local k = sc.keeper
			k.targetX = M_scenarioEdit.OFF_PITCH.x
			k.startX = k.targetX
			k.x = k.startX
			k.y = M_scenarioEdit.OFF_PITCH.y
			k.done = true
		end
		if (s.teammates == false) then
			sc.follower.x = M_scenarioEdit.OFF_PITCH.x
			sc.follower.y = M_scenarioEdit.OFF_PITCH.y
			sc.teammates = Js.alit()
			sc.secondaryRunners = Js.alit()
			sc.runner = nil
			sc.passTarget = nil
			sc.receiver = nil
		end
	end
	exports.stageScene = stageScene
end
