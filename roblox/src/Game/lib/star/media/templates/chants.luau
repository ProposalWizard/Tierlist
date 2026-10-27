--!nocheck
--!nolint
-- Generated from lib/star/media/templates/chants.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_chants = import("lib/star/media/chants")
	local n = 0
	local winTemplates = A.flatMap(Js.Object.entries(M_chants.CLUB_WIN_CHANTS), function(_p1)
		local clubName = _p1[1]
		local lines = _p1[2]
		return A.map(lines, function(body)
			return Js.O({ id = ("chant-win-" .. Js.numstr((function() local _o = n; n = _o + 1; return _o end)())), archetype = "fan", events = Js.alit("win", "rout"), club = clubName, body = body }, { "id", "archetype", "events", "club", "body" })
		end)
	end)
	local scorelineTemplates = A.flatMap(Js.Object.entries(M_chants.CLUB_SCORELINE_CHANTS), function(_p2)
		local clubName = _p2[1]
		local byScore = _p2[2]
		return A.flatMap(Js.Object.entries(byScore), function(_p3)
			local score = _p3[1]
			local lines = _p3[2]
			return A.map(lines, function(body)
				return Js.O({ id = ("chant-score-" .. Js.numstr((function() local _o = n; n = _o + 1; return _o end)())), archetype = "fan", events = Js.alit("win"), club = clubName, score = score, body = body, weight = 2 }, { "id", "archetype", "events", "club", "score", "body", "weight" })
			end)
		end)
	end)
	local drawLossTemplates = A.flatMap(Js.Object.entries(M_chants.CLUB_DRAW_LOSS_CHANTS), function(_p4)
		local clubName = _p4[1]
		local lines = _p4[2]
		return A.map(lines, function(body)
			return Js.O({ id = ("chant-drawloss-" .. Js.numstr((function() local _o = n; n = _o + 1; return _o end)())), archetype = "fan", events = Js.alit("draw", "loss"), club = clubName, body = body }, { "id", "archetype", "events", "club", "body" })
		end)
	end)
	local playerGoalTemplates = A.flatMap(Js.Object.entries(M_chants.PLAYER_GOAL_CHANTS), function(_p5)
		local playerName = _p5[1]
		local lines = _p5[2]
		return A.map(lines, function(body)
			return Js.O({ id = ("chant-player-" .. Js.numstr((function() local _o = n; n = _o + 1; return _o end)())), archetype = "fan", tags = Js.alit("goal"), requires = Js.alit("scorer"), player = playerName, body = body }, { "id", "archetype", "tags", "requires", "player", "body" })
		end)
	end)
	local CHANT_TEMPLATES = Js.aspread(winTemplates, scorelineTemplates, drawLossTemplates, playerGoalTemplates)
	exports.CHANT_TEMPLATES = CHANT_TEMPLATES
end
