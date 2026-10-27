--!nocheck
--!nolint
-- Generated from lib/star/media/detect/kit.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local ev, you, club, base, userGoals, isWinner, isEqualiser
	ev = function(id, subject, baseImportance, tags, facts, window, threadKey)
		if window == nil then window = "instant" end
		do return Js.O({ id = id, subject = subject, baseImportance = baseImportance, tags = tags, facts = facts, window = window, threadKey = threadKey }, { "id", "subject", "baseImportance", "tags", "facts", "window", "threadKey" }) end
	end
	exports.ev = ev
	you = function(r)
		do return Js.O({ kind = "you", name = r.you.name }, { "kind", "name" }) end
	end
	exports.you = you
	club = function(r)
		do return Js.O({ kind = "club", name = r.club }, { "kind", "name" }) end
	end
	exports.club = club
	base = function(r)
		do return Js.ospread(Js.O({ player = r.you.name, short = r.you.shortName, club = r.club, opponent = r.opponent, competition = r.competition }, { "player", "short", "club", "opponent", "competition" }), (if Js.T(r.derbyName) then Js.O({ derbyName = r.derbyName }, { "derbyName" }) else Js.O({}, nil)), (if Js.T(r.rivalryTier) then Js.O({ rivalryTier = r.rivalryTier }, { "rivalryTier" }) else Js.O({}, nil)), Js.O({ us = r.score.us, them = r.score.them, score = (Js.numstr(r.score.us) .. "-" .. Js.numstr(r.score.them)), result = r.result, home = r.home, venue = (if r.home then "at home" else "away"), homeClub = (if r.home then r.club else r.opponent), awayClub = (if r.home then r.opponent else r.club), hs = (if r.home then r.score.us else r.score.them), as = (if r.home then r.score.them else r.score.us), rating = N.toFixed(r.you.rating, 1), number = r.you.squadNumber, role = r.you.position, season = r.season, week = r.week, manager = r.context.managerName, seasonTotal = r.you.seasonGoals, seasonAssistTotal = r.you.seasonAssists, careerTotal = r.you.careerGoals, apps = r.you.careerAppearances, points = r.table.after.points, left = r.table.matchesLeft }, { "us", "them", "score", "result", "home", "venue", "homeClub", "awayClub", "hs", "as", "rating", "number", "role", "season", "week", "manager", "seasonTotal", "seasonAssistTotal", "careerTotal", "apps", "points", "left" })) end
	end
	exports.base = base
	isWinner = function(r, g)
		if ((r.result ~= "win") or (not g.scoreAfter)) then
			do return false end
		end
		do return (g.scoreAfter.us == (r.score.them + 1)) end
	end
	exports.isWinner = isWinner
	isEqualiser = function(g)
		do return (((not (not g.scoreAfter)) and (g.scoreAfter.us == g.scoreAfter.them)) and (g.scoreAfter.us > 0)) end
	end
	exports.isEqualiser = isEqualiser
	userGoals = function(r)
		return A.filter(r.goals, function(g)
			return g.isUser
		end)
	end
	exports.userGoals = userGoals
end
