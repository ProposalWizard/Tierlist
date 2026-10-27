--!nocheck
--!nolint
-- Generated from lib/star/season.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_rivalries = import("lib/star/rivalries")
	local M_ruleBook = import("lib/star/ruleBook")
	local M_leagueSquads = import("lib/star/leagueSquads")
	local M_tuningStore = import("lib/star/tuningStore")
	local mulberry32, buildLeague, buildSeasonFixtures, BYE, buildFixtures, playLeagueWeek, simulateFixtureScore, poisson, updateLeagueWithUserResult, sortLeague
	mulberry32 = function(seed)
		local a = Js.ushr(seed, 0)
		do return function()
			a = Js.ushr((a + 1831565813), 0)
			local t = a
			t = Math.imul(Js.bxor(t, Js.ushr(t, 15)), Js.bor(t, 1))
			t = Js.bxor(t, (t + Math.imul(Js.bxor(t, Js.ushr(t, 7)), Js.bor(t, 61))))
			do return (Js.ushr(Js.bxor(t, Js.ushr(t, 14)), 0) / 4294967296) end
		end end
	end
	exports.mulberry32 = mulberry32
	buildLeague = function(clubNames, userClub)
		local rng = mulberry32((S.len(A.join(clubNames, "")) + S.len(userClub)))
		do return A.map(clubNames, function(name)
			return Js.O({ name = name, strength = (55 + math.floor((rng() * 35))), played = 0, won = 0, drawn = 0, lost = 0, goalsFor = 0, goalsAgainst = 0, points = 0 }, { "name", "strength", "played", "won", "drawn", "lost", "goalsFor", "goalsAgainst", "points" })
		end) end
	end
	exports.buildLeague = buildLeague
	buildSeasonFixtures = function(clubs)
		local teams = Js.aspread(clubs)
		if (math.fmod(Js.alen(teams), 2) == 1) then
			A.push(teams, BYE)
		end
		local rounds = (Js.alen(teams) - 1)
		local half = (Js.alen(teams) / 2)
		local homeCount = Js.Map.new(A.map(teams, function(t)
			return Js.alit(t, 0)
		end))
		local first = Js.alit()
		for round = 0, rounds - 1 do
			for i = 0, math.ceil(half) - 1 do
				local a = teams[i + 1]
				local b = teams[((Js.alen(teams) - 1) - i) + 1]
				if ((a == BYE) or (b == BYE)) then
					do continue end
				end
				local ha = homeCount:get(a)
				local hb = homeCount:get(b)
				local aHome = ((ha < hb) or ((ha == hb) and (math.fmod((round + i), 2) == 0)))
				local home = (if aHome then a else b)
				local away = (if aHome then b else a)
				homeCount:set(home, (homeCount:get(home) + 1))
				A.push(first, Js.O({ week = (round + 1), home = home, away = away }, { "week", "home", "away" }))
			end
			local last = A.pop(teams)
			A.splice(teams, 1, 0, last)
		end
		local second = A.map(first, function(f)
			return Js.O({ week = (f.week + rounds), home = f.away, away = f.home }, { "week", "home", "away" })
		end)
		do return Js.aspread(first, second) end
	end
	exports.buildSeasonFixtures = buildSeasonFixtures
	buildFixtures = function(clubs, userClub)
		local rival = M_rivalries.primaryRivalOf(userClub)
		do return A.sort(A.map(A.filter(buildSeasonFixtures(clubs), function(f)
			return ((f.home == userClub) or (f.away == userClub))
		end), function(f)
			local home = (f.home == userClub)
			local opponent = (if home then f.away else f.home)
			do return Js.ospread(Js.O({ week = f.week, opponent = opponent, home = home, played = false }, { "week", "opponent", "home", "played" }), (if (Js.T(rival) and (opponent == rival)) then Js.O({ derby = true }, { "derby" }) else Js.O({}, nil))) end
		end), function(a, b)
			return (a.week - b.week)
		end) end
	end
	exports.buildFixtures = buildFixtures
	playLeagueWeek = function(league, week, user, rng, squads, rules, othersRng)
		if rules == nil then rules = M_ruleBook.DEFAULT_RULE_BOOK end
		local orng = (if othersRng ~= nil then othersRng else rng)
		local clubs = A.map(league, function(t)
			return t.name
		end)
		local strength = Js.Map.new(A.map(league, function(t)
			return Js.alit(t.name, t.strength)
		end))
		local squadOf = Js.Map.new(A.map((if squads ~= nil then squads else Js.alit()), function(s)
			return Js.alit(s.club, s)
		end))
		local updated = A.map(league, function(t)
			return Js.ospread(t)
		end)
		local theirGoals = (if (user.oppGoals and (Js.alen(user.oppGoals) == user.conceded)) then M_leagueSquads.creditNamedGoals(squadOf:get(user.opponent), user.oppGoals) else M_leagueSquads.nameGoals(squadOf:get(user.opponent), user.conceded, rng))
		local results = Js.alit(Js.ospread(Js.O({ week = week, home = (if user.home then user.club else user.opponent), away = (if user.home then user.opponent else user.club), hs = (if user.home then user.scored else user.conceded), as = (if user.home then user.conceded else user.scored) }, { "week", "home", "away", "hs", "as" }), (if Js.T((function() local _v = user.goals; if _v == nil then return nil end; _v = Js.len(_v); return _v end)()) then (if user.home then Js.O({ hg = user.goals }, { "hg" }) else Js.O({ ag = user.goals }, { "ag" })) else Js.O({}, nil)), (if Js.T(Js.alen(theirGoals)) then (if user.home then Js.O({ ag = theirGoals }, { "ag" }) else Js.O({ hg = theirGoals }, { "hg" })) else Js.O({}, nil))))
		local used = Js.Set.new(Js.alit(user.club, user.opponent))
		local play = function(home, away)
			local hs = (strength:get(home) or 65)
			local as = (strength:get(away) or 65)
			local sc = simulateFixtureScore(hs, as, orng)
			local hg = M_leagueSquads.nameGoals(squadOf:get(home), sc.home, orng)
			local ag = M_leagueSquads.nameGoals(squadOf:get(away), sc.away, orng)
			A.push(results, Js.ospread(Js.O({ week = week, home = home, away = away, hs = sc.home, as = sc.away }, { "week", "home", "away", "hs", "as" }), (if Js.T(Js.alen(hg)) then Js.O({ hg = hg }, { "hg" }) else Js.O({}, nil)), (if Js.T(Js.alen(ag)) then Js.O({ ag = ag }, { "ag" }) else Js.O({}, nil))))
			local H = A.find(updated, function(t)
				return (t.name == home)
			end)
			local A_ = A.find(updated, function(t)
				return (t.name == away)
			end)
			if ((not H) or (not A_)) then
				do return end
			end
			H.goalsFor += sc.home
			H.goalsAgainst += sc.away
			A_.goalsFor += sc.away
			A_.goalsAgainst += sc.home
			local outcome = M_ruleBook.applyResult(rules, H, A_, sc.home, sc.away, hs, as, orng)
			H.played = outcome.home.played
			H.won = outcome.home.won
			H.drawn = outcome.home.drawn
			H.lost = outcome.home.lost
			H.points = outcome.home.points
			A_.played = outcome.away.played
			A_.won = outcome.away.won
			A_.drawn = outcome.away.drawn
			A_.lost = outcome.away.lost
			A_.points = outcome.away.points
			used:add(home)
			used:add(away)
		end
		do
			local _arr1 = buildSeasonFixtures(clubs)
			local _i2 = 0
			while _i2 < Js.alen(_arr1) do
				_i2 += 1
				local f = _arr1[_i2]
				if (f.week ~= week) then
					do continue end
				end
				if (used:has(f.home) or used:has(f.away)) then
					do continue end
				end
				play(f.home, f.away)
			end
		end
		local spare = A.filter(clubs, function(c)
			return (not used:has(c))
		end)
		do
			local i = 0
			local _first3 = true
			while true do
				if not _first3 then
					i += 2
				end
				_first3 = false
				if not ((i + 1) < Js.alen(spare)) then break end
				play(spare[i + 1], spare[(i + 1) + 1])
			end
		end
		do return Js.O({ league = updated, results = results }, { "league", "results" }) end
	end
	exports.playLeagueWeek = playLeagueWeek
	simulateFixtureScore = function(homeStrength, awayStrength, rng)
		local homeAdv = M_tuningStore.getTuning("leagueSim.homeAdvantage")
		local slope = M_tuningStore.getTuning("leagueSim.strengthSlope")
		local base = M_tuningStore.getTuning("leagueSim.baseXg")
		local min = M_tuningStore.getTuning("leagueSim.minXg")
		local max = M_tuningStore.getTuning("leagueSim.maxXg")
		local diffHome = ((homeStrength + homeAdv) - awayStrength)
		local diffAway = (awayStrength - (homeStrength + homeAdv))
		do return Js.O({ home = poisson(Math.max(min, Math.min(max, (base + (diffHome * slope)))), rng), away = poisson(Math.max(min, Math.min(max, (base + (diffAway * slope)))), rng) }, { "home", "away" }) end
	end
	exports.simulateFixtureScore = simulateFixtureScore
	poisson = function(lambda, rng)
		local L = Math.exp((-lambda))
		local k = 0
		local p = 1
		local _first4 = true
		while _first4 or (p > L) do
			_first4 = false
			k += 1
			p *= rng()
		end
		do return (k - 1) end
	end
	updateLeagueWithUserResult = function(league, userClub, opponent, userScore, oppScore, rules, rng)
		if rules == nil then rules = M_ruleBook.DEFAULT_RULE_BOOK end
		if rng == nil then rng = mulberry32(1) end
		local user = A.find(league, function(t)
			return (t.name == userClub)
		end)
		local opp = A.find(league, function(t)
			return (t.name == opponent)
		end)
		if ((not user) or (not opp)) then
			do return league end
		end
		local outcome = M_ruleBook.applyResult(rules, user, opp, userScore, oppScore, user.strength, opp.strength, rng)
		do return A.map(league, function(t)
			if (t.name == userClub) then
				do return Js.ospread(t, outcome.home, Js.O({ goalsFor = (t.goalsFor + userScore), goalsAgainst = (t.goalsAgainst + oppScore) }, { "goalsFor", "goalsAgainst" })) end
			end
			if (t.name == opponent) then
				do return Js.ospread(t, outcome.away, Js.O({ goalsFor = (t.goalsFor + oppScore), goalsAgainst = (t.goalsAgainst + userScore) }, { "goalsFor", "goalsAgainst" })) end
			end
			do return t end
		end) end
	end
	exports.updateLeagueWithUserResult = updateLeagueWithUserResult
	sortLeague = function(league)
		do return A.sort(Js.aspread(league), function(a, b)
			if (b.points ~= a.points) then
				do return (b.points - a.points) end
			end
			local gdA = (a.goalsFor - a.goalsAgainst)
			local gdB = (b.goalsFor - b.goalsAgainst)
			if (gdB ~= gdA) then
				do return (gdB - gdA) end
			end
			do return (b.goalsFor - a.goalsFor) end
		end) end
	end
	exports.sortLeague = sortLeague
	BYE = "__BYE__"
end
