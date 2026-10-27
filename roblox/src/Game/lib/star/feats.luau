--!nocheck
--!nolint
-- Generated from lib/star/feats.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_calendar = import("lib/star/calendar")
	local M_rivalries = import("lib/star/rivalries")
	local add, scoreFor, winningGoal, featsAfterMatch
	scoreFor = function(fixture, stats)
		do return (if fixture.home then Js.O({ us = stats.homeScore, them = stats.awayScore }, { "us", "them" }) else Js.O({ us = stats.awayScore, them = stats.homeScore }, { "us", "them" })) end
	end
	exports.scoreFor = scoreFor
	winningGoal = function(fixture, stats)
		local _d1 = scoreFor(fixture, stats)
		local us = _d1.us
		local them = _d1.them
		if (us <= them) then
			do return nil end
		end
		local ours = (if stats.goalEvents ~= nil then stats.goalEvents else Js.alit())
		local theirs = (if stats.oppGoalEvents ~= nil then stats.oppGoalEvents else Js.alit())
		if ((Js.alen(ours) ~= us) or (Js.alen(theirs) ~= them)) then
			do return nil end
		end
		local sorted = A.sort(Js.aspread(ours), function(a, b)
			return (a.minute - b.minute)
		end)
		local winner = sorted[them + 1]
		if (not winner) then
			do return nil end
		end
		if (((function() local _v = sorted[them]; if _v == nil then return nil end; _v = _v.minute; return _v end)() == winner.minute) or ((function() local _v = sorted[(them + 1) + 1]; if _v == nil then return nil end; _v = _v.minute; return _v end)() == winner.minute)) then
			do return nil end
		end
		do return winner end
	end
	exports.winningGoal = winningGoal
	featsAfterMatch = function(career, fixture, stats)
		local f = Js.ospread((if career.feats ~= nil then career.feats else Js.O({}, nil)), Js.O({ goalsBy = Js.ospread(((function() local _v = career.feats; if _v == nil then return nil end; _v = _v.goalsBy; return _v end)() or Js.O({}, nil))) }, { "goalsBy" }))
		local goalsBy = f.goalsBy
		local mine = A.filter((if stats.goalEvents ~= nil then stats.goalEvents else Js.alit()), function(e)
			return e.isUserGoal
		end)
		do
			local _arr2 = mine
			local _i3 = 0
			while _i3 < Js.alen(_arr2) do
				_i3 += 1
				local e = _arr2[_i3]
				if Js.T(e.how) then
					goalsBy[e.how] = add(goalsBy[e.how], 1)
				end
				if ((e.finish == "chip") or (e.finish == "curl")) then
					goalsBy[e.finish] = add(goalsBy[e.finish], 1)
				end
				if ((if e.distance ~= nil then e.distance else 0) >= 25) then
					goalsBy.far25 = add(goalsBy.far25, 1)
				end
				if ((if e.distance ~= nil then e.distance else 0) >= 30) then
					goalsBy.far30 = add(goalsBy.far30, 1)
				end
			end
		end
		local goals = Math.max(0, Js.bor(stats.goals, 0))
		local _d4 = scoreFor(fixture, stats)
		local us = _d4.us
		local them = _d4.them
		local won = (us > them)
		local kind = (if fixture.kind ~= nil then fixture.kind else "league")
		local pl = ((kind == "league") and (M_calendar.divisionOf(career) == "premier"))
		if (goals >= 2) then
			f.braces = add(f.braces, 1)
		end
		if (goals >= 3) then
			f.hatTricks = add(f.hatTricks, 1)
		end
		if (goals >= 4) then
			f.hauls4 = add(f.hauls4, 1)
		end
		f.bestPassesMatch = Math.max((if f.bestPassesMatch ~= nil then f.bestPassesMatch else 0), Js.bor(stats.passes, 0))
		f.bestAssistsMatch = Math.max((if f.bestAssistsMatch ~= nil then f.bestAssistsMatch else 0), Js.bor(stats.assists, 0))
		if Js.NumberNS.isFinite(stats.rating) then
			f.bestRating = Math.max((if f.bestRating ~= nil then f.bestRating else 0), stats.rating)
		end
		if ((kind ~= "international") and M_rivalries.isDerby(career.player.club, fixture.opponent)) then
			if won then
				f.derbyWins = add(f.derbyWins, 1)
			end
			f.derbyGoals = add(f.derbyGoals, goals)
			if (goals >= 3) then
				f.derbyHatTricks = add(f.derbyHatTricks, 1)
			end
		end
		local w = winningGoal(fixture, stats)
		if (function() local _v = w; if _v == nil then return nil end; _v = _v.isUserGoal; return _v end)() then
			f.winners = add(f.winners, 1)
			if (w.minute >= 85) then
				f.lateWinners = add(f.lateWinners, 1)
			end
		end
		if (stats.cameo and (goals > 0)) then
			f.subGoals = add(f.subGoals, 1)
		end
		if stats.shootout then
			local ours = (if fixture.home then stats.shootout.home else stats.shootout.away)
			local theirs = (if fixture.home then stats.shootout.away else stats.shootout.home)
			if (ours > theirs) then
				f.shootoutWins = add(f.shootoutWins, 1)
			end
		end
		if (kind == "europe") then
			f.europeApps = add(f.europeApps, 1)
			f.europeGoals = add(f.europeGoals, goals)
			if (fixture.competition == "Champions League") then
				f.clGoals = add(f.clGoals, goals)
			end
		end
		f.scoringRun = (if (goals > 0) then add(f.scoringRun, 1) else 0)
		if (f.scoringRun > (if f.bestScoringRun ~= nil then f.bestScoringRun else 0)) then
			f.bestScoringRun = f.scoringRun
			f.bestScoringRunSeason = career.season
		end
		f.winRun = (if won then add(f.winRun, 1) else 0)
		f.bestWinRun = Math.max((if f.bestWinRun ~= nil then f.bestWinRun else 0), f.winRun)
		if pl then
			f.plScoringRun = (if (goals > 0) then add(f.plScoringRun, 1) else 0)
			f.bestPlScoringRun = Math.max((if f.bestPlScoringRun ~= nil then f.bestPlScoringRun else 0), f.plScoringRun)
			if (goals >= 3) then
				f.plHatTricks = add(f.plHatTricks, 1)
			end
			if won then
				f.bestPlWinMargin = Math.max((if f.bestPlWinMargin ~= nil then f.bestPlWinMargin else 0), (us - them))
			end
		end
		do return f end
	end
	exports.featsAfterMatch = featsAfterMatch
	add = function(n, by)
		return ((if n ~= nil then n else 0) + by)
	end
end
