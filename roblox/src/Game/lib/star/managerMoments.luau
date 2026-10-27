--!nocheck
--!nolint
-- Generated from lib/star/managerMoments.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_bossTalk = import("lib/star/bossTalk")
	local M_selection = import("lib/star/selection")
	local pickAfterMatch, pickAfterMissed, captainMomentDue, CAPTAIN_LINES, captainLine, fixtureMomentKey, benchReason, BENCH_LINES, BENCH_TAIL, benchMomentFor
	pickAfterMatch = function(stats)
		local fromBench = ((not (not stats.cameo)) or ((if stats.minutes ~= nil then stats.minutes else 90) <= 0))
		do return Js.O({ status = (if fromBench then "Substitute" else "1st Team") }, { "status" }) end
	end
	exports.pickAfterMatch = pickAfterMatch
	pickAfterMissed = function(prev, injured)
		if injured then
			do return (if prev then Js.ospread(prev, Js.O({ injuredSince = true }, { "injuredSince" })) else prev) end
		end
		do return Js.O({ status = "Squad" }, { "status" }) end
	end
	exports.pickAfterMissed = pickAfterMissed
	captainMomentDue = function(career)
		do return ((not (not career.captain)) and (not (not career.captainMomentPending))) end
	end
	exports.captainMomentDue = captainMomentDue
	captainLine = function(career)
		local style = M_bossTalk.managerTalkStyle(((function() local _v = career.manager; if _v == nil then return nil end; _v = _v.name; return _v end)() or "The manager"))
		local lines = CAPTAIN_LINES[style]
		do return lines[math.fmod(((career.season * 7) + career.week), Js.alen(lines)) + 1] end
	end
	exports.captainLine = captainLine
	fixtureMomentKey = function(career, f)
		do return (Js.numstr(career.season) .. ":" .. Js.numstr(f.week) .. ":" .. (if f.kind ~= nil then f.kind else "league") .. ":" .. f.opponent) end
	end
	exports.fixtureMomentKey = fixtureMomentKey
	benchReason = function(career, energy)
		if (function() local _v = career.lastPick; if _v == nil then return nil end; _v = _v.injuredSince; return _v end)() then
			do return "injury" end
		end
		if (energy < M_selection.MIN_ENERGY_TO_START) then
			do return "energy" end
		end
		if ((not M_selection.shirtWon(career)) and M_selection.shirtRival(career)) then
			do return "rival" end
		end
		if (career.relationships.boss < 40) then
			do return "boss" end
		end
		do return "form" end
	end
	exports.benchReason = benchReason
	benchMomentFor = function(career, verdict, fixture, energy)
		if energy == nil then energy = career.energy end
		if ((not verdict) or (verdict.status ~= "Substitute")) then
			do return nil end
		end
		if (fixture.kind == "international") then
			do return nil end
		end
		if ((function() local _v = career.lastPick; if _v == nil then return nil end; _v = _v.status; return _v end)() ~= "1st Team") then
			do return nil end
		end
		local key = fixtureMomentKey(career, fixture)
		if (career.benchMomentSeen == key) then
			do return nil end
		end
		local reason = benchReason(career, energy)
		local lines = BENCH_LINES[reason]
		local line = lines[math.fmod(((career.season * 5) + fixture.week), Js.alen(lines)) + 1](career)
		local style = M_bossTalk.managerTalkStyle(((function() local _v = career.manager; if _v == nil then return nil end; _v = _v.name; return _v end)() or "The manager"))
		do return Js.O({ key = key, reason = reason, text = (line .. " " .. BENCH_TAIL[style]) }, { "key", "reason", "text" }) end
	end
	exports.benchMomentFor = benchMomentFor
	CAPTAIN_LINES = Js.O({ press = Js.alit("You're my captain. You run more than anyone in that dressing room, and they follow the man who runs. Lead the press from the front.", "The armband's yours. I want the first tackle, the loudest voice and the last man still sprinting at ninety. That's a captain to me."), possession = Js.alit("You're my captain. You see the game the way I want it played. Keep the ball, keep the lads calm, and talk to them on the pitch.", "The armband's yours. When it gets messy out there, they look at you and the ball goes through you. That's the job now."), low = Js.alit("You're my captain. You do the dirty work and you never complain. Keep the shape, keep them honest, and we'll grind it out together.", "The armband's yours. I trust you to keep the lads switched on for ninety minutes. One lapse costs us. Not on your watch."), mid = Js.alit("You're my captain. On time, fit, no fuss, every week. That's what I want the others to copy. Wear it properly.", "The armband's yours. You've earned it the right way: you turn up and you do the job. Now make sure everyone else does.") }, { "press", "possession", "low", "mid" })
	BENCH_LINES = Js.O({ injury = Js.alit(function()
		return "Good to have you back. But you've been out, and I won't throw you in for ninety. You start on the bench."
	end, function()
		return "You're fit again, and I'm glad. Bench today. Get some minutes in your legs and we'll go from there."
	end), energy = Js.alit(function()
		return "You're running on fumes. I need fresh legs from the start, so you're on the bench. Be ready when I call you."
	end, function()
		return "I've seen the numbers: you're tired. You start on the bench today. Rest properly this week."
	end), rival = Js.alit(function(c)
		return (((function() local _v = M_selection.shirtRival(c); if _v == nil then return nil end; _v = _v.name; return _v end)() or "He") .. " starts today. He's in form and the shirt is his to lose. Make me pick you when you come on.")
	end, function(c)
		return ("I'm going with " .. ((function() local _v = M_selection.shirtRival(c); if _v == nil then return nil end; _v = _v.name; return _v end)() or "him") .. " from the start. It's not over for you: come off that bench and change my mind.")
	end), boss = Js.alit(function()
		return "I'm not happy with you, and you know why. Bench. Show me something in training and we'll talk."
	end, function()
		return "You start on the bench. Your attitude hasn't been right, and I pick people I can trust."
	end), form = Js.alit(function(c)
		return ("Your last few haven't been good enough (" .. N.toFixed(M_selection.recentForm(c.form), 1) .. " average). You start on the bench. Earn it back.")
	end, function()
		return "You've dipped. It happens to everyone, but I pick on form. Bench today, and take your chance when it comes."
	end) }, { "injury", "energy", "rival", "boss", "form" })
	BENCH_TAIL = Js.O({ press = "When you come on, I want you running.", possession = "When you come on, keep it simple and keep the ball.", low = "When you come on, do your job and don't switch off.", mid = "When you come on, be professional about it." }, { "press", "possession", "low", "mid" })
end
