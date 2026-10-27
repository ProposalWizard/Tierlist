--!nocheck
--!nolint
-- Generated from lib/star/media/record.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_season = import("lib/star/season")
	local M_calendar = import("lib/star/calendar")
	local M_rivalries = import("lib/star/rivalries")
	local M_potm = import("lib/star/potm")
	local M_fame = import("lib/star/fame")
	local snapshot, withRunningScore, buildMatchRecord
	snapshot = function(career)
		local sorted = M_season.sortLeague(career.league)
		local i = A.findIndex(sorted, function(t)
			return (t.name == career.player.club)
		end)
		local me = sorted[i + 1]
		do return Js.O({ position = (i + 1), points = ((function() local _v = me; if _v == nil then return nil end; _v = _v.points; return _v end)() or 0), gd = (if me then (me.goalsFor - me.goalsAgainst) else 0) }, { "position", "points", "gd" }) end
	end
	withRunningScore = function(goals, us, them)
		local ours = A.sort(Js.aspread(goals), function(a, b)
			return (a.minute - b.minute)
		end)
		local theirs = Js.alit()
		for i = 0, math.ceil(them) - 1 do
			A.push(theirs, (Math.round((((i + 1) / (them + 1)) * 88)) + 2))
		end
		local u = 0
		local t = 0
		local ti = 0
		local out = Js.alit()
		do
			local _arr1 = ours
			local _i2 = 0
			while _i2 < Js.alen(_arr1) do
				_i2 += 1
				local g = _arr1[_i2]
				while ((ti < Js.alen(theirs)) and (theirs[ti + 1] <= g.minute)) do
					t += 1
					ti += 1
				end
				u += 1
				A.push(out, Js.ospread(g, Js.O({ scoreAfter = Js.O({ us = u, them = t }, { "us", "them" }) }, { "scoreAfter" })))
			end
		end
		if (u ~= us) then
			do return A.map(ours, function(g)
				return Js.ospread(g, Js.O({ scoreAfter = nil }, { "scoreAfter" }))
			end) end
		end
		do return out end
	end
	buildMatchRecord = function(before, after, fixture, stats)
		local kind = (if (fixture.kind == "playoff") then "cup" else (if fixture.kind ~= nil then fixture.kind else "league"))
		local competition = (if fixture.competition ~= nil then fixture.competition else M_calendar.leagueNameFor(M_calendar.divisionOf(before)))
		local derby = (if fixture.derby ~= nil then fixture.derby else M_rivalries.isDerby(before.player.club, fixture.opponent))
		local rivalryTier = (M_rivalries.strongestTier(before.player.club, fixture.opponent) or nil)
		local derbyNameValue = (M_rivalries.derbyName(before.player.club, fixture.opponent) or nil)
		local strength = function(name)
			return (((function() local _v = A.find(before.league, function(t)
				return (t.name == name)
			end); if _v == nil then return nil end; _v = _v.strength; return _v end)() or fixture.opponentStrength) or 65)
		end
		local us = stats.homeScore
		local them = stats.awayScore
		local beforeTable = snapshot(before)
		local afterTable = snapshot(after)
		local sortedAfter = M_season.sortLeague(after.league)
		local leader = sortedAfter[1]
		local down = M_calendar.relegationPlaces(M_calendar.divisionOf(after))
		local dropZone = sortedAfter[(Js.alen(sortedAfter) - down) + 1]
		local me = A.find(sortedAfter, function(t)
			return (t.name == after.player.club)
		end)
		local goals = withRunningScore(A.map((if stats.goalEvents ~= nil then stats.goalEvents else Js.alit()), function(e)
			return Js.ospread(Js.O({ minute = e.minute, scorer = e.scorer, assist = e.assist, isUser = e.isUserGoal, how = e.how, distance = e.distance }, { "minute", "scorer", "assist", "isUser", "how", "distance" }), (if Js.T(e.clipId) then Js.O({ clipId = e.clipId }, { "clipId" }) else Js.O({}, nil)))
		end), us, them)
		local potmRace = (function()
			if (kind ~= "league") then
				do return nil end
			end
			local month = M_potm.monthOfCareer(after, fixture.week)
			local race = M_potm.monthRace(after, month)
			if (Js.alen(race) == 0) then
				do return nil end
			end
			local i = A.findIndex(race, function(c)
				return c.isYou
			end)
			local lastWeek = Math.max(Js.unpack(Js.aspread(A.map(after.fixtures, function(f)
				return f.week
			end), Js.alit(fixture.week))))
			do return Js.O({ month = month, monthName = M_potm.MONTH_NAMES[month + 1], place = (if (i >= 0) then (i + 1) else nil), contenders = Js.alen(race), goals = (if (i >= 0) then race[i + 1].goals else 0), assists = (if (i >= 0) then race[i + 1].assists else 0), decidesToday = M_potm.endsMonthOn(after, fixture.week, lastWeek), decidesNextWeek = ((not M_potm.endsMonthOn(after, fixture.week, lastWeek)) and M_potm.endsMonthOn(after, (fixture.week + 1), lastWeek)), leader = race[1].name }, { "month", "monthName", "place", "contenders", "goals", "assists", "decidesToday", "decidesNextWeek", "leader" }) end
		end)()
		local potmAward = (function()
			local had = Js.Set.new(A.map((if before.potm ~= nil then before.potm else Js.alit()), function(a)
				return (Js.numstr(a.season) .. "|" .. Js.numstr(a.month))
			end))
			local fresh = A.find((if after.potm ~= nil then after.potm else Js.alit()), function(a)
				return (not had:has((Js.numstr(a.season) .. "|" .. Js.numstr(a.month))))
			end)
			if (not fresh) then
				do return nil end
			end
			do return Js.O({ monthName = fresh.monthName, winner = fresh.winner, club = fresh.club, goals = fresh.goals, assists = fresh.assists, isYou = fresh.isYou, nominees = fresh.nominees, yourPlace = fresh.yourPlace }, { "monthName", "winner", "club", "goals", "assists", "isYou", "nominees", "yourPlace" }) end
		end)()
		local knockout = (if after.knockoutMessage ~= nil then after.knockoutMessage else "")
		local cup = (if (kind ~= "league") then Js.O({ advanced = Js.re("through|into", "i"):test(knockout), eliminated = (Js.re("out", "i"):test(knockout) and (not Js.re("through", "i"):test(knockout))), trophy = S.startsWith(knockout, "🏆") }, { "advanced", "eliminated", "trophy" }) else nil)
		do return Js.O({ id = ("s" .. Js.numstr(before.season) .. "-w" .. Js.numstr(before.week) .. "-" .. kind .. "-" .. S.replace(fixture.opponent, Js.re("\\s+", "g"), "")), season = before.season, week = before.week, competition = competition, kind = kind, round = fixture.round, derby = derby, rivalryTier = rivalryTier, derbyName = derbyNameValue, potmRace = potmRace, potmAward = potmAward, home = fixture.home, neutral = (fixture.round == "Final"), club = before.player.club, opponent = fixture.opponent, clubStrength = strength(before.player.club), opponentStrength = strength(fixture.opponent), score = Js.O({ us = us, them = them }, { "us", "them" }), result = (if (us > them) then "win" else (if (us < them) then "loss" else "draw")), you = Js.ospread(Js.O({ name = (before.player.firstName .. " " .. before.player.lastName), shortName = before.player.lastName, goals = stats.goals, assists = stats.assists, rating = stats.rating, starMan = stats.starMan, minutes = (if stats.minutes ~= nil then stats.minutes else 90), chances = stats.chances, passes = stats.passes, hooked = (if stats.hooked ~= nil then stats.hooked else nil), captain = (not (not after.captain)), squadNumber = (if after.squadNumber ~= nil then after.squadNumber else 0), position = before.player.position, seasonGoals = after.seasonStats.goals, seasonAssists = after.seasonStats.assists, careerGoals = after.careerStats.goals, careerAssists = after.careerStats.assists, careerAppearances = after.careerStats.appearances, clubAppearances = (if after.clubAppearances ~= nil then after.clubAppearances else after.careerStats.appearances) }, { "name", "shortName", "goals", "assists", "rating", "starMan", "minutes", "chances", "passes", "hooked", "captain", "squadNumber", "position", "seasonGoals", "seasonAssists", "careerGoals", "careerAssists", "careerAppearances", "clubAppearances" }), (if Js.T((function() local _v = stats.cheekyMisses; if _v == nil then return nil end; _v = Js.len(_v); return _v end)()) then Js.O({ cheekyMisses = Js.alen(stats.cheekyMisses), cheekyKind = stats.cheekyMisses[1].kind, cheekyMinute = stats.cheekyMisses[1].minute }, { "cheekyMisses", "cheekyKind", "cheekyMinute" }) else Js.O({}, nil))), goals = goals, oppGoals = A.slice((if Js.T((function() local _v = stats.oppGoalEvents; if _v == nil then return nil end; _v = Js.len(_v); return _v end)()) then A.map(stats.oppGoalEvents, function(e)
			return Js.O({ minute = e.minute, scorer = e.scorer }, { "minute", "scorer" })
		end) else Js.Array.from(Js.O({ length = them }, { "length" }), function(_, k)
			return Js.O({ minute = (Math.round((((k + 1) / (them + 1)) * 88)) + 2), scorer = "" }, { "minute", "scorer" })
		end)), 0, them), table = Js.O({ before = beforeTable, after = afterTable, leaderGap = (((function() local _v = leader; if _v == nil then return nil end; _v = _v.points; return _v end)() or 0) - ((function() local _v = me; if _v == nil then return nil end; _v = _v.points; return _v end)() or 0)), relegationGap = (((function() local _v = me; if _v == nil then return nil end; _v = _v.points; return _v end)() or 0) - ((function() local _v = dropZone; if _v == nil then return nil end; _v = _v.points; return _v end)() or 0)), matchesLeft = Js.alen(A.filter(after.fixtures, function(f)
			return ((not f.played) and ((if f.kind ~= nil then f.kind else "league") == "league"))
		end)), clubs = Js.alen(after.league), relegationPlaces = down }, { "before", "after", "leaderGap", "relegationGap", "matchesLeft", "clubs", "relegationPlaces" }), cup = cup, context = Js.O({ managerName = ((function() local _v = after.manager; if _v == nil then return nil end; _v = _v.name; return _v end)() or "the manager"), conditions = "", fansStanding = after.relationships.fans, fame = M_fame.fameOf(after), starRating = after.starRating }, { "managerName", "conditions", "fansStanding", "fame", "starRating" }) }, { "id", "season", "week", "competition", "kind", "round", "derby", "rivalryTier", "derbyName", "potmRace", "potmAward", "home", "neutral", "club", "opponent", "clubStrength", "opponentStrength", "score", "result", "you", "goals", "oppGoals", "table", "cup", "context" }) end
	end
	exports.buildMatchRecord = buildMatchRecord
end
