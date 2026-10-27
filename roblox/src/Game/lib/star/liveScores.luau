--!nocheck
--!nolint
-- Generated from lib/star/liveScores.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_season = import("lib/star/season")
	local M_ruleBook = import("lib/star/ruleBook")
	local otherGamesSeed, otherGamesRng, previewOtherGames, liveScoresFor, goalsOf, liveWeekFor, goalsForFollowed, scoresAt
	otherGamesSeed = function(season, week)
		do return Js.ushr(((Math.imul(season, 104729) + Math.imul(week, 7919)) + 12061), 0) end
	end
	exports.otherGamesSeed = otherGamesSeed
	otherGamesRng = function(season, week)
		do return M_season.mulberry32(otherGamesSeed(season, week)) end
	end
	exports.otherGamesRng = otherGamesRng
	previewOtherGames = function(career, fixture)
		if ((if fixture.kind ~= nil then fixture.kind else "league") ~= "league") then
			do return Js.alit() end
		end
		local league = A.map(career.league, function(t)
			return Js.ospread(t)
		end)
		local squads = A.map((if career.leagueSquads ~= nil then career.leagueSquads else Js.alit()), function(sq)
			return Js.ospread(sq, Js.O({ players = A.map(sq.players, function(p)
				return Js.ospread(p)
			end) }, { "players" }))
		end)
		local round = M_season.playLeagueWeek(league, fixture.week, Js.O({ club = career.player.club, opponent = fixture.opponent, home = fixture.home, scored = 0, conceded = 0 }, { "club", "opponent", "home", "scored", "conceded" }), M_season.mulberry32(1), squads, M_ruleBook.ruleBookFor(career, "FA"), otherGamesRng(career.season, fixture.week))
		do return A.filter(round.results, function(r)
			return ((r.home ~= career.player.club) and (r.away ~= career.player.club))
		end) end
	end
	exports.previewOtherGames = previewOtherGames
	liveScoresFor = function(career, fixture)
		do return goalsOf(career, fixture, previewOtherGames(career, fixture)) end
	end
	exports.liveScoresFor = liveScoresFor
	goalsOf = function(career, fixture, results)
		local out = Js.alit()
		local fill = M_season.mulberry32(Js.bxor(otherGamesSeed(career.season, fixture.week), 1311))
		do
			local _arr1 = results
			local _i2 = 0
			while _i2 < Js.alen(_arr1) do
				_i2 += 1
				local r = _arr1[_i2]
				local side = function(list, count, scoredBy)
					local named = A.map((if list ~= nil then list else Js.alit()), function(g)
						return Js.O({ m = g.m, s = g.s, scoredBy = scoredBy }, { "m", "s", "scoredBy" })
					end)
					while (Js.alen(named) < count) do
						A.push(named, Js.O({ m = (2 + math.floor((fill() * 88))), s = nil, scoredBy = scoredBy }, { "m", "s", "scoredBy" }))
					end
					do return named end
				end
				local goals = A.sort(Js.aspread(side(r.hg, r.hs, "home"), side(r.ag, r.as, "away")), function(x, y)
					return (function() local _l = (x.m - y.m); if Js.T(_l) then return _l end; return (if (x.scoredBy == "home") then -1 else 1) end)()
				end)
				local hs = 0
				local as = 0
				do
					local _arr3 = goals
					local _i4 = 0
					while _i4 < Js.alen(_arr3) do
						_i4 += 1
						local g = _arr3[_i4]
						if (g.scoredBy == "home") then
							hs += 1
						else
							as += 1
						end
						A.push(out, Js.O({ minute = g.m, home = r.home, away = r.away, hs = hs, as = as, scoredBy = g.scoredBy, scorer = g.s }, { "minute", "home", "away", "hs", "as", "scoredBy", "scorer" }))
					end
				end
			end
		end
		do return A.sort(out, function(x, y)
			return (x.minute - y.minute)
		end) end
	end
	liveWeekFor = function(career, fixture)
		local results = previewOtherGames(career, fixture)
		do return Js.O({ fixtures = A.map(results, function(r)
			return Js.O({ home = r.home, away = r.away }, { "home", "away" })
		end), goals = goalsOf(career, fixture, results) }, { "fixtures", "goals" }) end
	end
	exports.liveWeekFor = liveWeekFor
	goalsForFollowed = function(goals, followed)
		if (not Js.T(Js.alen(followed))) then
			do return Js.alit() end
		end
		local f = Js.Set.new(followed)
		do return A.filter(goals, function(g)
			return (f:has(g.home) or f:has(g.away))
		end) end
	end
	exports.goalsForFollowed = goalsForFollowed
	scoresAt = function(fixtures, goals, minute)
		do return A.map(fixtures, function(fx)
			local hs = 0
			local as = 0
			local lastGoal = nil
			do
				local _arr5 = goals
				local _i6 = 0
				while _i6 < Js.alen(_arr5) do
					_i6 += 1
					local g = _arr5[_i6]
					if (((g.home ~= fx.home) or (g.away ~= fx.away)) or (g.minute > minute)) then
						do continue end
					end
					hs = g.hs
					as = g.as
					lastGoal = g.minute
				end
			end
			do return Js.ospread(Js.O({ home = fx.home, away = fx.away, hs = hs, as = as }, { "home", "away", "hs", "as" }), (if (lastGoal ~= nil) then Js.O({ lastGoal = lastGoal }, { "lastGoal" }) else Js.O({}, nil))) end
		end) end
	end
	exports.scoresAt = scoresAt
end
