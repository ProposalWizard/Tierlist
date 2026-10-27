--!nocheck
--!nolint
-- Generated from lib/star/seasonAwards.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_rating = import("lib/star/rating")
	local M_formations = import("lib/star/formations")
	local M_calendar = import("lib/star/calendar")
	local M_season = import("lib/star/season")
	local VALID_ROLES, asRole, candidatePool, toWinner, cleanSheetsByClub, findGoalkeeper, TEAM_OF_SEASON_FORMATION, compositeScore, pickTeamOfSeason, YOUNG_AGE_CUTOFF, trophyWinners, weightedWinner, strengthEstimate, resolveCommunityShieldGuess, resolveSuperCupGuess, computeSeasonAwardStats
	asRole = function(position, fallback)
		if fallback == nil then fallback = "ST" end
		do return (if VALID_ROLES:has(position) then position else fallback) end
	end
	candidatePool = function(career)
		local out = Js.alit()
		A.push(out, Js.O({ name = (career.player.firstName .. " " .. career.player.lastName), club = career.player.club, overall = M_rating.displayOverall(career.starRating), leagueGoals = ((function() local _v = career.leagueSeasonStats; if _v == nil then return nil end; _v = _v.goals; return _v end)() or 0), leagueAssists = ((function() local _v = career.leagueSeasonStats; if _v == nil then return nil end; _v = _v.assists; return _v end)() or 0), age = career.player.age, isYou = true, position = asRole(career.player.position), image = career.player.portrait }, { "name", "club", "overall", "leagueGoals", "leagueAssists", "age", "isYou", "position", "image" }))
		do
			local _arr1 = (if career.squad ~= nil then career.squad else Js.alit())
			local _i2 = 0
			while _i2 < Js.alen(_arr1) do
				_i2 += 1
				local p = _arr1[_i2]
				A.push(out, Js.O({ name = p.name, club = career.player.club, overall = (if p.overall ~= nil then p.overall else 65), leagueGoals = (if p.leagueGoals ~= nil then p.leagueGoals else p.seasonGoals), leagueAssists = (if p.leagueAssists ~= nil then p.leagueAssists else p.seasonAssists), age = (if p.age ~= nil then p.age else nil), isYou = false, position = p.position, image = p.imageUrl }, { "name", "club", "overall", "leagueGoals", "leagueAssists", "age", "isYou", "position", "image" }))
			end
		end
		do
			local _arr3 = (if career.leagueSquads ~= nil then career.leagueSquads else Js.alit())
			local _i4 = 0
			while _i4 < Js.alen(_arr3) do
				_i4 += 1
				local sq = _arr3[_i4]
				do
					local _arr5 = sq.players
					local _i6 = 0
					while _i6 < Js.alen(_arr5) do
						_i6 += 1
						local p = _arr5[_i6]
						A.push(out, Js.O({ name = p.name, club = sq.club, overall = p.overall, leagueGoals = p.goals, leagueAssists = p.assists, age = (if p.age ~= nil then p.age else nil), isYou = false, position = p.position, image = p.image }, { "name", "club", "overall", "leagueGoals", "leagueAssists", "age", "isYou", "position", "image" }))
					end
				end
			end
		end
		do return out end
	end
	toWinner = function(c, value)
		do return Js.O({ name = c.name, club = c.club, isYou = c.isYou, value = value, image = c.image }, { "name", "club", "isYou", "value", "image" }) end
	end
	cleanSheetsByClub = function(career)
		local sheets = Js.Map.new()
		local bump = function(club)
			return sheets:set(club, ((sheets:get(club) or 0) + 1))
		end
		do
			local _arr7 = (if career.results ~= nil then career.results else Js.alit())
			local _i8 = 0
			while _i8 < Js.alen(_arr7) do
				_i8 += 1
				local r = _arr7[_i8]
				if (r.as == 0) then
					bump(r.home)
				end
				if (r.hs == 0) then
					bump(r.away)
				end
			end
		end
		do return sheets end
	end
	findGoalkeeper = function(career, club)
		if (club == career.player.club) then
			local gk = A.find((if career.squad ~= nil then career.squad else Js.alit()), function(p)
				return (p.position == "GK")
			end)
			do return (if gk then Js.O({ name = gk.name, club = club, overall = (if gk.overall ~= nil then gk.overall else 65), leagueGoals = 0, leagueAssists = 0, age = (if gk.age ~= nil then gk.age else nil), isYou = false, position = "GK", image = gk.imageUrl }, { "name", "club", "overall", "leagueGoals", "leagueAssists", "age", "isYou", "position", "image" }) else nil) end
		end
		local sq = A.find((if career.leagueSquads ~= nil then career.leagueSquads else Js.alit()), function(s)
			return (s.club == club)
		end)
		local gk = (function() local _r = (function() local _v = sq; if _v == nil then return nil end; _v = _v.players; return _v end)(); if _r == nil then return nil end; return A.find(_r, function(p)
			return (p.position == "GK")
		end) end)()
		do return (if gk then Js.O({ name = gk.name, club = club, overall = gk.overall, leagueGoals = 0, leagueAssists = 0, age = (if gk.age ~= nil then gk.age else nil), isYou = false, position = "GK", image = gk.image }, { "name", "club", "overall", "leagueGoals", "leagueAssists", "age", "isYou", "position", "image" }) else nil) end
	end
	compositeScore = function(c)
		do return ((c.overall + (c.leagueGoals * 1.5)) + c.leagueAssists) end
	end
	pickTeamOfSeason = function(pool)
		local formation = M_formations.formationOf(TEAM_OF_SEASON_FORMATION)
		local used = Js.Set.new()
		local team = Js.alit()
		do
			local _arr9 = formation.slots
			local _i10 = 0
			while _i10 < Js.alen(_arr9) do
				_i10 += 1
				local slot = _arr9[_i10]
				local best = nil
				local bestScore = -1
				do
					local _arr11 = pool
					local _i12 = 0
					while _i12 < Js.alen(_arr11) do
						_i12 += 1
						local c = _arr11[_i12]
						if used:has(c) then
							do continue end
						end
						local fit = M_formations.fitness(slot.role, c.position)
						if (fit <= 0) then
							do continue end
						end
						local score = (compositeScore(c) * (fit / 100))
						if (score > bestScore) then
							bestScore = score
							best = c
						end
					end
				end
				if best then
					used:add(best)
					A.push(team, Js.O({ role = slot.role, x = slot.x, y = slot.y, label = slot.label, name = best.name, club = best.club, overall = best.overall, isYou = best.isYou, image = best.image }, { "role", "x", "y", "label", "name", "club", "overall", "isYou", "image" }))
				end
			end
		end
		do return team end
	end
	trophyWinners = function(career, stats)
		local mine = A.filter((if career.trophies ~= nil then career.trophies else Js.alit()), function(t)
			return (t.season == stats.season)
		end)
		local winnerOf = function(competition, fallback)
			local won = A.find(mine, function(t)
				return (t.competition == competition)
			end)
			if won then
				do return Js.O({ competition = competition, club = won.club, isYou = (won.club == career.player.club), isGuess = false }, { "competition", "club", "isYou", "isGuess" }) end
			end
			do return Js.O({ competition = competition, club = (if fallback ~= nil then fallback else nil), isYou = false, isGuess = false }, { "competition", "club", "isYou", "isGuess" }) end
		end
		local guessedWinnerOf = function(competition, guess)
			local won = A.find(mine, function(t)
				return (t.competition == competition)
			end)
			if won then
				do return Js.O({ competition = competition, club = won.club, isYou = (won.club == career.player.club), isGuess = false }, { "competition", "club", "isYou", "isGuess" }) end
			end
			do return Js.O({ competition = competition, club = guess, isYou = false, isGuess = (guess ~= nil) }, { "competition", "club", "isYou", "isGuess" }) end
		end
		local w = career.lastSeasonWinners
		do return Js.aspread(Js.alit(winnerOf(stats.leagueName, (function() local _v = w; if _v == nil then return nil end; _v = _v.league; return _v end)()), winnerOf("FA Cup", (function() local _v = w; if _v == nil then return nil end; _v = _v.faCup; return _v end)()), winnerOf("League Cup", (function() local _v = w; if _v == nil then return nil end; _v = _v.leagueCup; return _v end)())), (if ((Js.T((function() local _v = w; if _v == nil then return nil end; _v = _v.lowerLeagueTrophy; return _v end)()) and M_calendar.inLowerLeagueTrophy(M_calendar.divisionOf(career))) or A.some(mine, function(t)
			return (t.competition == "Lower League Trophy")
		end)) then Js.alit(winnerOf("Lower League Trophy", (function() local _v = w; if _v == nil then return nil end; _v = _v.lowerLeagueTrophy; return _v end)())) else Js.alit()), Js.alit(winnerOf("Champions League", (function() local _v = w; if _v == nil then return nil end; _v = _v.championsLeague; return _v end)()), winnerOf("Europa League", (function() local _v = w; if _v == nil then return nil end; _v = _v.europaLeague; return _v end)()), (if Js.T((function() local _v = w; if _v == nil then return nil end; _v = _v.communityShield; return _v end)()) then winnerOf("Community Shield", w.communityShield) else guessedWinnerOf("Community Shield", stats.communityShieldGuess)), (if Js.T((function() local _v = w; if _v == nil then return nil end; _v = _v.superCup; return _v end)()) then winnerOf("Super Cup", w.superCup) else guessedWinnerOf("Super Cup", stats.superCupGuess)))) end
	end
	exports.trophyWinners = trophyWinners
	weightedWinner = function(a, aStrength, b, bStrength, seed)
		local rng = M_season.mulberry32(seed)
		local wa = Math.pow(Math.max(1, (aStrength - 60)), 2.2)
		local wb = Math.pow(Math.max(1, (bStrength - 60)), 2.2)
		do return (if ((rng() * (wa + wb)) < wa) then a else b) end
	end
	strengthEstimate = function(career, club)
		local inLeague = A.find(career.league, function(t)
			return (t.name == club)
		end)
		if inLeague then
			do return inLeague.strength end
		end
		do return 76 end
	end
	resolveCommunityShieldGuess = function(career, seed)
		local w = career.lastSeasonWinners
		if ((not Js.T((function() local _v = w; if _v == nil then return nil end; _v = _v.league; return _v end)())) or (not Js.T((function() local _v = w; if _v == nil then return nil end; _v = _v.faCup; return _v end)()))) then
			do return nil end
		end
		local champion = (if (w.league == w.faCup) then (if w.leagueRunnerUp ~= nil then w.leagueRunnerUp else nil) else w.league)
		local cupHolder = w.faCup
		if ((not Js.T(champion)) or (champion == cupHolder)) then
			do return nil end
		end
		do return weightedWinner(champion, strengthEstimate(career, champion), cupHolder, strengthEstimate(career, cupHolder), seed) end
	end
	resolveSuperCupGuess = function(career, seed)
		local w = career.lastSeasonWinners
		if (((not Js.T((function() local _v = w; if _v == nil then return nil end; _v = _v.championsLeague; return _v end)())) or (not Js.T((function() local _v = w; if _v == nil then return nil end; _v = _v.europaLeague; return _v end)()))) or (w.championsLeague == w.europaLeague)) then
			do return nil end
		end
		do return weightedWinner(w.championsLeague, strengthEstimate(career, w.championsLeague), w.europaLeague, strengthEstimate(career, w.europaLeague), seed) end
	end
	computeSeasonAwardStats = function(career)
		local pool = candidatePool(career)
		local byGoals = A.sort(Js.aspread(pool), function(a, b)
			return (b.leagueGoals - a.leagueGoals)
		end)
		local goldenBoot = (if (byGoals[1] and (byGoals[1].leagueGoals > 0)) then toWinner(byGoals[1], byGoals[1].leagueGoals) else nil)
		local byAssists = A.sort(Js.aspread(pool), function(a, b)
			return (b.leagueAssists - a.leagueAssists)
		end)
		local assistKing = (if (byAssists[1] and (byAssists[1].leagueAssists > 0)) then toWinner(byAssists[1], byAssists[1].leagueAssists) else nil)
		local sheets = cleanSheetsByClub(career)
		local goldenGlove = nil
		local bestSheets = 0
		do
			local _arr13 = Js.Array.from(sheets:entries())
			local _i14 = 0
			while _i14 < Js.alen(_arr13) do
				_i14 += 1
				local _e15 = _arr13[_i14]
				local club = _e15[1]
				local count = _e15[2]
				if (count <= bestSheets) then
					do continue end
				end
				local gk = findGoalkeeper(career, club)
				if (not gk) then
					do continue end
				end
				bestSheets = count
				goldenGlove = toWinner(gk, count)
			end
		end
		local byScore = A.sort(Js.aspread(pool), function(a, b)
			return (compositeScore(b) - compositeScore(a))
		end)
		local playerOfSeason = (if byScore[1] then toWinner(byScore[1], Math.round(compositeScore(byScore[1]))) else nil)
		local youngPool = A.filter(byScore, function(c)
			return ((c.age ~= nil) and (c.age <= YOUNG_AGE_CUTOFF))
		end)
		local youngPlayerOfSeason = (if youngPool[1] then toWinner(youngPool[1], Math.round(compositeScore(youngPool[1]))) else nil)
		local top3 = function(list, value)
			return A.map(A.slice(A.filter(list, function(c)
				return (value(c) > 0)
			end), 0, 3), function(c)
				return toWinner(c, Math.round(value(c)))
			end)
		end
		local gloves = Js.alit()
		do
			local _arr16 = A.sort(Js.Array.from(sheets:entries()), function(a, b)
				return (b[2] - a[2])
			end)
			local _i17 = 0
			while _i17 < Js.alen(_arr16) do
				_i17 += 1
				local _e18 = _arr16[_i17]
				local club = _e18[1]
				local count = _e18[2]
				if (Js.alen(gloves) >= 3) then
					do break end
				end
				local gk = findGoalkeeper(career, club)
				if (gk and (count > 0)) then
					A.push(gloves, toWinner(gk, count))
				end
			end
		end
		local nominees = Js.O({ goldenBoot = (if goldenBoot then top3(byGoals, function(c)
			return c.leagueGoals
		end) else Js.alit()), assistKing = (if assistKing then top3(byAssists, function(c)
			return c.leagueAssists
		end) else Js.alit()), goldenGlove = (if goldenGlove then gloves else Js.alit()), youngPlayerOfSeason = top3(youngPool, compositeScore), playerOfSeason = top3(byScore, compositeScore) }, { "goldenBoot", "assistKing", "goldenGlove", "youngPlayerOfSeason", "playerOfSeason" })
		do return Js.O({ season = career.season, leagueName = M_calendar.leagueNameFor(M_calendar.divisionOf(career)), nominees = nominees, goldenBoot = goldenBoot, assistKing = assistKing, goldenGlove = goldenGlove, playerOfSeason = playerOfSeason, youngPlayerOfSeason = youngPlayerOfSeason, teamOfSeason = pickTeamOfSeason(pool), communityShieldGuess = resolveCommunityShieldGuess(career, ((career.season * 4441) + 1)), superCupGuess = resolveSuperCupGuess(career, ((career.season * 4441) + 2)) }, { "season", "leagueName", "nominees", "goldenBoot", "assistKing", "goldenGlove", "playerOfSeason", "youngPlayerOfSeason", "teamOfSeason", "communityShieldGuess", "superCupGuess" }) end
	end
	exports.computeSeasonAwardStats = computeSeasonAwardStats
	VALID_ROLES = Js.Set.new(Js.alit("GK", "CB", "LB", "RB", "CDM", "CM", "CAM", "LW", "RW", "ST"))
	TEAM_OF_SEASON_FORMATION = "433"
	YOUNG_AGE_CUTOFF = 21
end
