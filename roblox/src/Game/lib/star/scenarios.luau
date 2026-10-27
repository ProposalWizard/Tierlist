--!nocheck
--!nolint
-- Generated from lib/star/scenarios.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_pitch = import("lib/star/pitch")
	local M_scenarioRender = import("lib/star/scenarioRender")
	local SCENARIO_KINDS, newScenarioId, SCENARIO_VIEW_H, normaliseScenarioCamera, blankScenario, clamp, addPlayer
	newScenarioId = function()
		do return ("sc_" .. N.toString(Js.Date.now(), 36) .. "_" .. S.slice(N.toString(Math.random(), 36), 2, 8)) end
	end
	exports.newScenarioId = newScenarioId
	normaliseScenarioCamera = function(sc)
		if (sc.camera.viewHeight == SCENARIO_VIEW_H) then
			do return sc end
		end
		do return Js.ospread(sc, Js.O({ camera = Js.ospread(sc.camera, Js.O({ viewHeight = SCENARIO_VIEW_H }, { "viewHeight" })) }, { "camera" })) end
	end
	exports.normaliseScenarioCamera = normaliseScenarioCamera
	blankScenario = function(kind)
		if kind == nil then kind = "corner" end
		local nearGoal = (((kind == "corner") or (kind == "free_kick")) or (kind == "throw_in"))
		local ballY = (if (kind == "kickoff") then M_pitch.HALF_LEN else (if nearGoal then 8 else (M_pitch.HALF_LEN - 15)))
		do return Js.O({ id = newScenarioId(), name = "Untitled scenario", kind = kind, camera = Js.O({ centerX = (M_pitch.PITCH_W / 2), centerY = (if nearGoal then 16 else ballY), viewHeight = SCENARIO_VIEW_H, facing = "up" }, { "centerX", "centerY", "viewHeight", "facing" }), ball = Js.O({ x = (if (kind == "corner") then 2 else (M_pitch.PITCH_W / 2)), y = ballY }, { "x", "y" }), players = Js.alit(Js.O({ id = "you", side = "you", x = (M_pitch.PITCH_W / 2), y = (if nearGoal then 12 else ballY) }, { "id", "side", "x", "y" })), updatedAt = Js.Date.now() }, { "id", "name", "kind", "camera", "ball", "players", "updatedAt" }) end
	end
	exports.blankScenario = blankScenario
	clamp = function(v, lo, hi)
		do return Math.max(lo, Math.min(hi, v)) end
	end
	addPlayer = function(scenario, side)
		local cam = scenario.camera
		local vp = M_scenarioRender.viewportFor(cam.centerX, cam.centerY, cam.viewHeight, (if cam.facing ~= nil then cam.facing else "up"))
		local n = Js.alen(A.filter(scenario.players, function(p)
			return (p.side == side)
		end))
		local spread = (math.fmod(n, 5) - 2)
		local midX = ((vp.x1 + vp.x2) / 2)
		local midY = ((vp.y1 + vp.y2) / 2)
		local stepX = ((vp.x2 - vp.x1) * 0.1)
		local sideOffset = ((vp.x2 - vp.x1) * (if (side == "opponent") then 0.15 else -0.15))
		do return Js.ospread(scenario, Js.O({ players = Js.aspread(scenario.players, Js.alit(Js.O({ id = newScenarioId(), side = side, x = clamp(((midX + sideOffset) + (spread * stepX)), 1, (M_pitch.PITCH_W - 1)), y = clamp(((midY + ((vp.y2 - vp.y1) * 0.08)) + (math.floor((n / 5)) * 3)), 1, ((M_pitch.HALF_LEN * 2) - 1)) }, { "id", "side", "x", "y" }))) }, { "players" })) end
	end
	exports.addPlayer = addPlayer
	SCENARIO_KINDS = Js.alit("corner", "free_kick", "throw_in", "kickoff", "open_play")
	exports.SCENARIO_KINDS = SCENARIO_KINDS
	SCENARIO_VIEW_H = 42
	exports.SCENARIO_VIEW_H = SCENARIO_VIEW_H
end
