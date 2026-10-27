--!nocheck
--!nolint
-- Generated from lib/star/goalLog.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_chanceLog = import("lib/star/chanceLog")
	local GOAL_LOG_MAX, competitionOf, logMatchGoals, seasonGoals, goalScore, bestGoals, protectedClipIds, goalHowLabel
	competitionOf = function(fixture, leagueName)
		if leagueName == nil then leagueName = "League" end
		if Js.T(fixture.competition) then
			do return fixture.competition end
		end
		if (fixture.kind == "playoff") then
			do return "Play-Offs" end
		end
		do return leagueName end
	end
	exports.competitionOf = competitionOf
	logMatchGoals = function(career, fixture, stats, leagueName)
		if leagueName == nil then leagueName = "League" end
		local mine = A.filter((if stats.goalEvents ~= nil then stats.goalEvents else Js.alit()), function(e)
			return e.isUserGoal
		end)
		if (Js.alen(mine) == 0) then
			do return career.goalLog end
		end
		local comp = competitionOf(fixture, leagueName)
		local key = (Js.numstr(career.season) .. ":" .. Js.numstr(fixture.week) .. ":" .. (if fixture.kind ~= nil then fixture.kind else "league") .. ":" .. fixture.opponent)
		local rows = A.map(mine, function(e, i)
			return Js.ospread(Js.O({ id = (key .. ":" .. Js.numstr(e.minute) .. ":" .. Js.numstr(i)), season = career.season, week = fixture.week, minute = e.minute, opponent = fixture.opponent, club = career.player.club, home = fixture.home, competition = comp, score = (Js.numstr(stats.homeScore) .. "-" .. Js.numstr(stats.awayScore)) }, { "id", "season", "week", "minute", "opponent", "club", "home", "competition", "score" }), (if Js.T(e.how) then Js.O({ how = e.how }, { "how" }) else Js.O({}, nil)), (if (type(e.distance) == "number") then Js.O({ distance = (Math.round((e.distance * 10)) / 10) }, { "distance" }) else Js.O({}, nil)), (if Js.T(e.finish) then Js.O({ finish = e.finish }, { "finish" }) else Js.O({}, nil)), (if Js.T(e.assist) then Js.O({ assist = e.assist }, { "assist" }) else Js.O({}, nil)), (if Js.T(e.clipId) then Js.O({ clipId = e.clipId }, { "clipId" }) else Js.O({}, nil)))
		end)
		local kept = A.filter((if career.goalLog ~= nil then career.goalLog else Js.alit()), function(g)
			return (not S.startsWith(g.id, (key .. ":")))
		end)
		local all = Js.aspread(kept, rows)
		do return (if (Js.alen(all) > GOAL_LOG_MAX) then A.slice(all, (Js.alen(all) - GOAL_LOG_MAX)) else all) end
	end
	exports.logMatchGoals = logMatchGoals
	seasonGoals = function(career, season)
		if season == nil then season = career.season end
		do return A.filter((if career.goalLog ~= nil then career.goalLog else Js.alit()), function(g)
			return (g.season == season)
		end) end
	end
	exports.seasonGoals = seasonGoals
	goalScore = function(g)
		local s = 0
		local d = (if g.distance ~= nil then g.distance else 12)
		s += (Math.max(0, (d - 8)) * 1.6)
		if (g.finish == "chip") then
			s += 9
		end
		if (g.finish == "curl") then
			s += 7
		end
		local how = S.toLowerCase((if g.how ~= nil then g.how else ""))
		if S.includes(how, "free") then
			s += 10
		end
		if ((S.includes(how, "volley") or S.includes(how, "bicycle")) or S.includes(how, "overhead")) then
			s += 12
		end
		if (S.includes(how, "solo") or S.includes(how, "dribble")) then
			s += 8
		end
		if S.includes(how, "pen") then
			s -= 8
		end
		if (g.minute >= 85) then
			s += 6
		end
		local _d1 = A.map(S.split(g.score, "-"), Js.NumberNS)
		local us = _d1[1]
		local them = _d1[2]
		if ((Js.NumberNS.isFinite(us) and Js.NumberNS.isFinite(them)) and ((us - them) == 1)) then
			s += 4
		end
		if (S.includes(g.competition, "Final") or (g.competition == "Champions League")) then
			s += 4
		end
		if Js.T(g.clipId) then
			s += 0.5
		end
		do return s end
	end
	exports.goalScore = goalScore
	bestGoals = function(goals, n)
		if n == nil then n = 10 end
		do return A.slice(A.sort(Js.aspread(goals), function(a, b)
			return (function() local _l = (goalScore(b) - goalScore(a)); if Js.T(_l) then return _l end; return S.localeCompare(a.id, b.id) end)()
		end), 0, n) end
	end
	exports.bestGoals = bestGoals
	protectedClipIds = function(career)
		if (not career) then
			do return Js.alit() end
		end
		local log = (if career.goalLog ~= nil then career.goalLog else Js.alit())
		local reelPending = A.filter(log, function(g)
			return (if Js.T(g.clipId) then ((if career.reelDoneSeason ~= nil then career.reelDoneSeason else 0) < g.season) else g.clipId)
		end)
		local best = bestGoals(A.filter(log, function(g)
			return g.clipId
		end), 10)
		do return Js.Array.from(Js.Set.new(A.map(Js.aspread(reelPending, best), function(g)
			return g.clipId
		end))) end
	end
	exports.protectedClipIds = protectedClipIds
	goalHowLabel = function(how)
		local known = M_chanceLog.CHANCE_KIND_LABEL[how]
		if Js.T(known) then
			do return known end
		end
		local words = S.trim(S.replace(how, Js.re("_", "g"), " "))
		do return (if Js.T(words) then (S.toUpperCase(S.charAt(words, 0)) .. S.slice(words, 1)) else how) end
	end
	exports.goalHowLabel = goalHowLabel
	GOAL_LOG_MAX = 1200
	exports.GOAL_LOG_MAX = GOAL_LOG_MAX
end
