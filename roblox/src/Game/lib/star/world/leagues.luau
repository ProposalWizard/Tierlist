--!nocheck
--!nolint
-- Generated from lib/star/world/leagues.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_promotion = import("lib/star/promotion")
	local M_calendar = import("lib/star/calendar")
	local M_ruleBook = import("lib/star/ruleBook")
	local M_season = import("lib/star/season")
	local M_leagueSquads = import("lib/star/leagueSquads")
	local M_realSquad = import("lib/star/realSquad")
	local MEMBER_KEY, DIV_INDEX, emptyTeam, openWorldLeagues, roundSeed, addScorer, playWorldRound, worldRoundTime, advanceWorldLeagues, worldRoundResults
	emptyTeam = function(name, strength)
		do return Js.O({ name = name, strength = strength, played = 0, won = 0, drawn = 0, lost = 0, goalsFor = 0, goalsAgainst = 0, points = 0 }, { "name", "strength", "played", "won", "drawn", "lost", "goalsFor", "goalsAgainst", "points" }) end
	end
	openWorldLeagues = function(career, yours)
		local members = M_promotion.membershipOf(career)
		local out = Js.alit()
		do
			local _arr1 = M_calendar.ALL_DIVISIONS
			local _i2 = 0
			while _i2 < Js.alen(_arr1) do
				_i2 += 1
				local division = _arr1[_i2]
				if (division == yours) then
					do continue end
				end
				local clubs = Js.aspread(members[MEMBER_KEY[division]])
				if (Js.alen(clubs) < 2) then
					do continue end
				end
				local teams = A.map(clubs, function(c)
					return emptyTeam(c, M_promotion.ratingFor(career, c, members))
				end)
				local rounds = ((Js.alen(clubs) - (if (math.fmod(Js.alen(clubs), 2) == 0) then 1 else 0)) * 2)
				A.push(out, Js.O({ division = division, clubs = clubs, teams = teams, played = 0, rounds = rounds, scorers = Js.O({}, nil) }, { "division", "clubs", "teams", "played", "rounds", "scorers" }))
			end
		end
		do return out end
	end
	exports.openWorldLeagues = openWorldLeagues
	roundSeed = function(season, division, round, salt)
		if salt == nil then salt = 0 end
		do return Js.ushr(Js.bxor(Js.bxor(Math.imul(season, 2654435761), Math.imul(((DIV_INDEX[division] * 97) + salt), 40503)), Math.imul(round, 2246822519)), 0) end
	end
	exports.roundSeed = roundSeed
	addScorer = function(counts, id, goal)
		local c = (if counts[id] ~= nil then counts[id] else Js.alit(0, 0))
		counts[id] = (if goal then Js.alit((c[1] + 1), c[2]) else Js.alit(c[1], (c[2] + 1)))
	end
	playWorldRound = function(career, lg, round, squadOf)
		local rules = M_ruleBook.ruleBookFor(career, "FA")
		local scoreRng = M_season.mulberry32(roundSeed(career.season, lg.division, round))
		local nameRng = M_season.mulberry32(roundSeed(career.season, lg.division, round, 13))
		local byName = Js.Map.new(A.map(lg.teams, function(t)
			return Js.alit(t.name, Js.ospread(t))
		end))
		local scorers = Js.ospread(lg.scorers)
		local results = Js.alit()
		do
			local _arr3 = M_season.buildSeasonFixtures(lg.clubs)
			local _i4 = 0
			while _i4 < Js.alen(_arr3) do
				_i4 += 1
				local f = _arr3[_i4]
				if (f.week ~= round) then
					do continue end
				end
				local H = byName:get(f.home)
				local A_ = byName:get(f.away)
				if ((not H) or (not A_)) then
					do continue end
				end
				local sc = M_season.simulateFixtureScore(H.strength, A_.strength, scoreRng)
				H.goalsFor += sc.home
				H.goalsAgainst += sc.away
				A_.goalsFor += sc.away
				A_.goalsAgainst += sc.home
				local o = M_ruleBook.applyResult(rules, H, A_, sc.home, sc.away, H.strength, A_.strength, scoreRng)
				Js.Object.assign(H, o.home)
				Js.Object.assign(A_, o.away)
				local hg = M_leagueSquads.pickGoalIds(squadOf(f.home), sc.home, nameRng)
				local ag = M_leagueSquads.pickGoalIds(squadOf(f.away), sc.away, nameRng)
				do
					local _arr5 = Js.aspread(hg, ag)
					local _i6 = 0
					while _i6 < Js.alen(_arr5) do
						_i6 += 1
						local g = _arr5[_i6]
						addScorer(scorers, g.id, true)
						if Js.T(g.assistId) then
							addScorer(scorers, g.assistId, false)
						end
					end
				end
				local named = function(gs)
					return A.map(gs, function(g)
						return Js.ospread(Js.O({ m = g.m, s = M_realSquad.shortNameOf(g.name) }, { "m", "s" }), (if Js.T(g.assist) then Js.O({ a = M_realSquad.shortNameOf(g.assist) }, { "a" }) else Js.O({}, nil)))
					end)
				end
				A.push(results, Js.ospread(Js.O({ week = round, home = f.home, away = f.away, hs = sc.home, as = sc.away }, { "week", "home", "away", "hs", "as" }), (if Js.T(Js.alen(hg)) then Js.O({ hg = named(hg) }, { "hg" }) else Js.O({}, nil)), (if Js.T(Js.alen(ag)) then Js.O({ ag = named(ag) }, { "ag" }) else Js.O({}, nil))))
			end
		end
		do return Js.ospread(lg, Js.O({ teams = A.map(lg.teams, function(t)
			return (byName:get(t.name) or t)
		end), played = round, last = results, scorers = scorers }, { "teams", "played", "last", "scorers" })) end
	end
	exports.playWorldRound = playWorldRound
	worldRoundTime = function(career, division, round)
		do return M_calendar.fixtureTimestamp(career.player.startYear, career.season, round, "league", division) end
	end
	exports.worldRoundTime = worldRoundTime
	advanceWorldLeagues = function(career, leagues, clock, squadOf)
		local changed = false
		local next_ = A.map(leagues, function(lg)
			local cur = lg
			while ((cur.played < cur.rounds) and (worldRoundTime(career, cur.division, (cur.played + 1)) <= clock)) do
				cur = playWorldRound(career, cur, (cur.played + 1), squadOf)
				changed = true
			end
			do return cur end
		end)
		do return (if changed then next_ else leagues) end
	end
	exports.advanceWorldLeagues = advanceWorldLeagues
	worldRoundResults = function(career, lg, round)
		if ((round == lg.played) and lg.last) then
			do return lg.last end
		end
		do return (playWorldRound(career, lg, round, function()
			return nil
		end).last or Js.alit()) end
	end
	exports.worldRoundResults = worldRoundResults
	MEMBER_KEY = Js.O({ premier = "premier", championship = "championship", league_one = "leagueOne", league_two = "leagueTwo", national_league = "nationalLeague", national_league_north = "nationalLeagueNorth", national_league_south = "nationalLeagueSouth" }, { "premier", "championship", "league_one", "league_two", "national_league", "national_league_north", "national_league_south" })
	exports.MEMBER_KEY = MEMBER_KEY
	DIV_INDEX = Js.O({ premier = 1, championship = 2, league_one = 3, league_two = 4, national_league = 5, national_league_north = 6, national_league_south = 7 }, { "premier", "championship", "league_one", "league_two", "national_league", "national_league_north", "national_league_south" })
end
