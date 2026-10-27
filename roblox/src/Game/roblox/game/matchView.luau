--!nocheck
--!nolint
-- Generated from roblox/game/matchView.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_pitch = import("lib/star/pitch")
	local M_match = import("roblox/game/match")
	local M_grammar = import("lib/star/media/grammar")
	local BANNER_S, frameOf
	frameOf = function(m)
		local sc = m.sc
		local bodies = Js.alit()
		local ball = nil
		if ((m.phase == "tdDribble") and m.td) then
			local run = m.td
			A.push(bodies, Js.O({ id = "you", side = "you", x = run.x, y = run.y, name = m.career.player.lastName }, { "id", "side", "x", "y", "name" }))
			A.forEach(run.defenders, function(d, i)
				return A.push(bodies, Js.O({ id = ("fd" .. Js.numstr(i)), side = "opp", x = d.x, y = d.y }, { "id", "side", "x", "y" }))
			end)
			A.forEach(run.mates, function(t, i)
				return A.push(bodies, Js.O({ id = ("fm" .. Js.numstr(i)), side = "mate", x = t.x, y = t.y, option = true }, { "id", "side", "x", "y", "option" }))
			end)
			A.push(bodies, Js.O({ id = "keeper", side = "keeper", x = M_pitch.CX, y = 0.6 }, { "id", "side", "x", "y" }))
			ball = Js.O({ x = run.x, y = (run.y - 0.6), z = 0 }, { "x", "y", "z" })
		elseif sc then
			A.push(bodies, Js.O({ id = "you", side = "you", x = sc.player.x, y = sc.player.y, name = m.career.player.lastName }, { "id", "side", "x", "y", "name" }))
			A.push(bodies, Js.O({ id = "keeper", side = "keeper", x = sc.keeper.x, y = sc.keeper.y, name = (function() local _v = sc.keeper.who; if _v == nil then return nil end; _v = _v.shortName; return _v end)(), dive = sc.keeper.dive }, { "id", "side", "x", "y", "name", "dive" }))
			A.forEach(sc.defenders, function(d, i)
				return A.push(bodies, Js.O({ id = ("d" .. Js.numstr(i)), side = "opp", x = d.x, y = d.y, name = (function() local _v = d.who; if _v == nil then return nil end; _v = _v.shortName; return _v end)() }, { "id", "side", "x", "y", "name" }))
			end)
			A.forEach(sc.teammates, function(t, i)
				return A.push(bodies, Js.O({ id = ("t" .. Js.numstr(i)), side = "mate", x = t.x, y = t.y, name = (function() local _v = t.who; if _v == nil then return nil end; _v = _v.shortName; return _v end)() }, { "id", "side", "x", "y", "name" }))
			end)
			if sc.runner then
				A.push(bodies, Js.O({ id = "runner", side = "mate", x = sc.runner.pos.x, y = sc.runner.pos.y, name = (function() local _v = sc.runner.who; if _v == nil then return nil end; _v = _v.shortName; return _v end)(), option = true }, { "id", "side", "x", "y", "name", "option" }))
			end
			A.forEach(sc.secondaryRunners, function(r, i)
				return A.push(bodies, Js.O({ id = ("r" .. Js.numstr(i)), side = "mate", x = r.pos.x, y = r.pos.y, name = (function() local _v = r.who; if _v == nil then return nil end; _v = _v.shortName; return _v end)(), option = true }, { "id", "side", "x", "y", "name", "option" }))
			end)
			if sc.follower then
				A.push(bodies, Js.O({ id = "follower", side = "mate", x = sc.follower.x, y = sc.follower.y, name = (function() local _v = sc.follower.who; if _v == nil then return nil end; _v = _v.shortName; return _v end)() }, { "id", "side", "x", "y", "name" }))
			end
			ball = (if m.ball then Js.O({ x = m.ball.pos.x, y = m.ball.pos.y, z = m.ball.z }, { "x", "y", "z" }) else Js.O({ x = sc.ball.x, y = sc.ball.y, z = 0 }, { "x", "y", "z" }))
		end
		local shown = M_match.displayScore(m)
		local us = m.career.player.club
		local them = m.fixture.opponent
		local ls = m.liveShootout
		local usHome = (if ls then (ls.yourSide == "home") else true)
		do return Js.O({ phase = m.phase, minute = m.minute, score = Js.O({ us = shown.user, them = shown.opp, usName = M_grammar.shortClub(us), themName = M_grammar.shortClub(them), home = m.fixture.home }, { "us", "them", "usName", "themName", "home" }), kits = M_match.matchKits(m), bodies = bodies, ball = ball, camera = Js.ospread(m.camera, Js.O({ facing = m.facing, tilt = m.tiltDeg }, { "facing", "tilt" })), goal = Js.O({ x1 = (if sc then sc.goal.x1 else M_match.POST_L), x2 = (if sc then sc.goal.x2 else M_match.POST_R), crossbar = (if sc then sc.crossbar else 2.44) }, { "x1", "x2", "crossbar" }), aim = M_match.aimPreview(m), passTarget = (if (function() local _v = sc; if _v == nil then return nil end; _v = _v.passTarget; return _v end)() then Js.O({ x = sc.passTarget.x, y = sc.passTarget.y }, { "x", "y" }) else nil), feed = A.slice(m.feed), log = A.map(A.slice(m.log, -8), function(l)
			return Js.O({ minute = (if l.minute ~= nil then l.minute else nil), text = l.text, tone = l.tone }, { "minute", "text", "tone" })
		end), banner = (if (m.banner and ((m.now - m.banner.at) < BANNER_S)) then m.banner.text else nil), pause = (if m.pause then Js.O({ label = (if m.pause.label ~= nil then m.pause.label else nil), cta = m.pause.cta, halfTime = (not (not m.pause.halfTime)), kib = Math.max(0, (((function() local _v = m.career.kibCans; if _v == nil then return nil end; _v = _v.basic; return _v end)() or 0) - m.kibUsed)) }, { "label", "cta", "halfTime", "kib" }) else nil), energy = M_match.energyNow(m), stamina = M_match.staminaNow(m), speed = m.speed, energyMode = m.energyMode, playstyle = m.playstyle, controls = M_match.controlsOf(m), shootout = (if ls then Js.O({ us = (if usHome then ls.state.homeScore else ls.state.awayScore), them = (if usHome then ls.state.awayScore else ls.state.homeScore), kicks = Js.alen(ls.state.kicks) }, { "us", "them", "kicks" }) else nil) }, { "phase", "minute", "score", "kits", "bodies", "ball", "camera", "goal", "aim", "passTarget", "feed", "log", "banner", "pause", "energy", "stamina", "speed", "energyMode", "playstyle", "controls", "shootout" }) end
	end
	exports.frameOf = frameOf
	BANNER_S = 1.4
end
