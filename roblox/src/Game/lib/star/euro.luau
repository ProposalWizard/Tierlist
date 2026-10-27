--!nocheck
--!nolint
-- Generated from lib/star/euro.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_clubRating = import("lib/star/world/clubRating")
	local M_calendar = import("lib/star/calendar")
	local M_promotion = import("lib/star/promotion")
	local M_clubs = import("lib/star/clubs")
	local M_season = import("lib/star/season")
	local M_ruleBook = import("lib/star/ruleBook")
	local M_englishTopFlight = import("lib/star/englishTopFlight")
	local M_qualification = import("lib/star/qualification")
	local M_leagueSquads = import("lib/star/leagueSquads")
	local M_shootout = import("lib/star/shootout")
	local seededPool, NON_ENGLISH_CLUB_STRENGTH, SAUDI_CLUBS, EURO_CLUB_NATION, ENGLISH_LADDER, nationOf, europeanStrengthOf, strengthOf, MAIN_NATIONS, EL_NAMED_EXEMPT, computeMainNationAllocation, MAIN_NATION_ALLOCATION, nationPool, seasonField, CONFERENCE_SEEDS, CONFERENCE_POOL, saudiExempt, swapIn, applySaudiSwap, applyCustomClubEntries, replaceableClubsIn, poolFor, potForFinish, openEuro, shuffle, simulate, poisson, simulateEuroMatchday, sortEuro, leaguePhaseComplete, knockoutSlots, drawTie, currentTie, currentLeg, settleTie, nextRound, firstRound, crownEurope, crownWithoutYou, phaseVerdict, EURO_LEAGUE_PHASE_SLOTS
	seededPool = function(seeds)
		local sorted = A.sort(Js.aspread(seeds), function(a, b)
			return (b.strength - a.strength)
		end)
		local potSize = math.ceil((Js.alen(sorted) / 4))
		do return A.map(sorted, function(c, i)
			return Js.ospread(c, Js.O({ pot = Math.min(4, (math.floor((i / potSize)) + 1)) }, { "pot" }))
		end) end
	end
	nationOf = function(club)
		do return (if ENGLISH_LADDER:has(club) then "England" else (if EURO_CLUB_NATION[club] ~= nil then EURO_CLUB_NATION[club] else "Unknown")) end
	end
	europeanStrengthOf = function(club, career)
		do return strengthOf(club, career) end
	end
	exports.europeanStrengthOf = europeanStrengthOf
	strengthOf = function(club, career)
		local inLeague = A.find(career.league, function(t)
			return (t.name == club)
		end)
		if inLeague then
			do return inLeague.strength end
		end
		local real = M_clubRating.squadRating(A.find((if career.externalSquads ~= nil then career.externalSquads else Js.alit()), function(s)
			return (s.club == club)
		end))
		if (real ~= nil) then
			do return Math.round(real) end
		end
		local saudi = A.find(SAUDI_CLUBS, function(s)
			return (s.name == club)
		end)
		if saudi then
			do return saudi.strength end
		end
		if (NON_ENGLISH_CLUB_STRENGTH[club] ~= nil) then
			do return NON_ENGLISH_CLUB_STRENGTH[club] end
		end
		if ((M_calendar.divisionOf(career) ~= "premier") and A.includes(M_promotion.membershipOf(career).premier, club)) then
			do return M_promotion.estimateClubStrength(career, club) end
		end
		do return 72 end
	end
	computeMainNationAllocation = function()
		local alloc = Js.O({}, nil)
		do
			local _arr1 = MAIN_NATIONS
			local _i2 = 0
			while _i2 < Js.alen(_arr1) do
				_i2 += 1
				local nation = _arr1[_i2]
				alloc[nation] = Js.O({ champions = Js.alen(A.filter(M_clubs.CHAMPIONS_LEAGUE_CLUBS, function(name)
					return (nationOf(name) == nation)
				end)), europa = Js.alen(A.filter(M_clubs.EUROPA_LEAGUE_CLUBS, function(name)
					return (nationOf(name) == nation)
				end)) }, { "champions", "europa" })
			end
		end
		do return alloc end
	end
	nationPool = function(nation)
		do return A.filter(Js.aspread(M_clubs.CHAMPIONS_LEAGUE_CLUBS, M_clubs.EUROPA_LEAGUE_CLUBS, M_clubs.OTHER_CLUBS), function(name)
			return (nationOf(name) == nation)
		end) end
	end
	seasonField = function(competition, career)
		local withStrength = function(names)
			return A.map(names, function(name)
				return Js.O({ name = name, strength = strengthOf(name, career) }, { "name", "strength" })
			end)
		end
		if (career.season < 2) then
			local names = (if (competition == "Champions League") then M_clubs.CHAMPIONS_LEAGUE_CLUBS else M_clubs.EUROPA_LEAGUE_CLUBS)
			do return seededPool(withStrength(Js.aspread(names))) end
		end
		local rng = M_season.mulberry32(((career.season * 30011) + 3))
		local championsParts = Js.alit()
		local europaParts = Js.alit()
		local uefaRules = M_ruleBook.ruleBookFor(career, "UEFA")
		local topFlight = (if Js.T((function() local _v = career.lastTopFlight; if _v == nil then return nil end; _v = Js.len(_v); return _v end)()) then A.map(career.lastTopFlight, function(name, i, all)
			return Js.O({ name = name, strength = strengthOf(name, career), played = 38, won = 0, drawn = 0, lost = 0, goalsFor = 0, goalsAgainst = 0, points = ((Js.alen(all) - i) * 3) }, { "name", "strength", "played", "won", "drawn", "lost", "goalsFor", "goalsAgainst", "points" })
		end) else M_englishTopFlight.standInTopFlight(career))
		local englishNames = Js.Set.new(A.map(topFlight, function(t)
			return t.name
		end))
		local europeanTrophyWinner = (A.find(Js.alit((function() local _v = career.lastSeasonWinners; if _v == nil then return nil end; _v = _v.championsLeague; return _v end)(), (function() local _v = career.lastSeasonWinners; if _v == nil then return nil end; _v = _v.europaLeague; return _v end)()), function(name)
			return (if Js.T(name) then englishNames:has(name) else name)
		end) or nil)
		local englishQualifiers = M_qualification.seasonQualifiers(topFlight, ((function() local _v = career.lastSeasonWinners; if _v == nil then return nil end; _v = _v.faCup; return _v end)() or nil), ((function() local _v = career.lastSeasonWinners; if _v == nil then return nil end; _v = _v.leagueCup; return _v end)() or nil), europeanTrophyWinner, uefaRules.extraChampionsLeagueSlots, uefaRules.extraEuropaLeagueSlots)
		local englishChampions = Js.aspread(englishQualifiers.champions)
		local englishEuropa = Js.aspread(englishQualifiers.europa)
		if (Js.alen(englishEuropa) < MAIN_NATION_ALLOCATION.England.europa) then
			local claimed = Js.Set.new(Js.aspread(englishChampions, englishEuropa))
			do
				local _arr3 = M_season.sortLeague(topFlight)
				local _i4 = 0
				while _i4 < Js.alen(_arr3) do
					_i4 += 1
					local team = _arr3[_i4]
					if (Js.alen(englishEuropa) >= MAIN_NATION_ALLOCATION.England.europa) then
						do break end
					end
					if (not claimed:has(team.name)) then
						A.push(englishEuropa, team.name)
						claimed:add(team.name)
					end
				end
			end
		end
		A.push(championsParts, Js.unpack(englishChampions))
		A.push(europaParts, Js.unpack(englishEuropa))
		do
			local _arr5 = Js.alit("Spain", "Italy", "Germany", "France")
			local _i6 = 0
			while _i6 < Js.alen(_arr5) do
				_i6 += 1
				local nation = _arr5[_i6]
				local pool = shuffle(nationPool(nation), rng)
				local alloc = MAIN_NATION_ALLOCATION[nation]
				A.push(championsParts, Js.unpack(A.slice(pool, 0, alloc.champions)))
				A.push(europaParts, Js.unpack(A.slice(pool, alloc.champions, (alloc.champions + alloc.europa))))
			end
		end
		local isMainOrSaudi = function(name)
			return (A.includes(MAIN_NATIONS, nationOf(name)) or A.some(SAUDI_CLUBS, function(s)
				return (s.name == name)
			end))
		end
		local everyoneElse = A.filter(Js.aspread(M_clubs.CHAMPIONS_LEAGUE_CLUBS, M_clubs.EUROPA_LEAGUE_CLUBS, M_clubs.OTHER_CLUBS), function(name)
			return ((not isMainOrSaudi(name)) and (nationOf(name) ~= "Unknown"))
		end)
		local byNation = Js.Map.new()
		do
			local _arr7 = everyoneElse
			local _i8 = 0
			while _i8 < Js.alen(_arr7) do
				_i8 += 1
				local name = _arr7[_i8]
				local nation = nationOf(name)
				A.push((byNation:get(nation) or byNation:set(nation, Js.alit()):get(nation)), name)
			end
		end
		local mandatoryChampions = Js.alit()
		local mandatoryEuropa = Js.alit()
		local flexible = Js.alit()
		do
			local _arr9 = Js.Array.from(byNation:values())
			local _i10 = 0
			while _i10 < Js.alen(_arr9) do
				_i10 += 1
				local clubs = _arr9[_i10]
				if (Js.alen(clubs) >= 2) then
					local _d11 = shuffle(clubs, rng)
					local first = _d11[1]
					local second = _d11[2]
					local rest = A.slice(_d11, 2)
					A.push(mandatoryChampions, first)
					A.push(mandatoryEuropa, second)
					A.push(flexible, Js.unpack(rest))
				else
					A.push(flexible, Js.unpack(clubs))
				end
			end
		end
		local shuffledFlex = shuffle(flexible, rng)
		local mainTotalChampions = (Js.alen(englishChampions) + A.reduce(Js.alit("Spain", "Italy", "Germany", "France"), function(s, n)
			return (s + MAIN_NATION_ALLOCATION[n].champions)
		end, 0))
		local mainTotalEuropa = (Js.alen(englishEuropa) + A.reduce(Js.alit("Spain", "Italy", "Germany", "France"), function(s, n)
			return (s + MAIN_NATION_ALLOCATION[n].europa)
		end, 0))
		local clCapacity = (Js.alen(M_clubs.CHAMPIONS_LEAGUE_CLUBS) - mainTotalChampions)
		local elCapacity = (Js.alen(M_clubs.EUROPA_LEAGUE_CLUBS) - mainTotalEuropa)
		local clNeeded = Math.max(0, Math.min(Js.alen(shuffledFlex), (clCapacity - Js.alen(mandatoryChampions))))
		local afterChampions = A.slice(shuffledFlex, clNeeded)
		local elNeeded = Math.max(0, Math.min(Js.alen(afterChampions), (elCapacity - Js.alen(mandatoryEuropa))))
		A.push(championsParts, Js.unpack(Js.aspread(mandatoryChampions, A.slice(shuffledFlex, 0, clNeeded))))
		A.push(europaParts, Js.unpack(Js.aspread(mandatoryEuropa, A.slice(afterChampions, 0, elNeeded))))
		do return seededPool(withStrength((if (competition == "Champions League") then championsParts else europaParts))) end
	end
	saudiExempt = function(club, competition)
		if A.includes(MAIN_NATIONS, nationOf(club.name)) then
			do return true end
		end
		do return ((competition == "Europa League") and EL_NAMED_EXEMPT:has(club.name)) end
	end
	swapIn = function(pool, incoming, competition, rng)
		local eligible = shuffle(A.filter(pool, function(c)
			return (not saudiExempt(c, competition))
		end), rng)
		local removed = Js.Set.new(A.map(A.slice(eligible, 0, Js.alen(incoming)), function(c)
			return c.name
		end))
		local survivors = A.filter(pool, function(c)
			return (not removed:has(c.name))
		end)
		do return seededPool(Js.aspread(A.map(survivors, function(c)
			return Js.O({ name = c.name, strength = c.strength }, { "name", "strength" })
		end), incoming)) end
	end
	applySaudiSwap = function(championsBase, europaBase, competition, seasonSeed)
		local rng = M_season.mulberry32(seasonSeed)
		local shuffledSaudis = shuffle(SAUDI_CLUBS, rng)
		local _d12 = shuffledSaudis
		local clA = _d12[1]
		local clB = _d12[2]
		local elA = _d12[3]
		local elB = _d12[4]
		local newChampions = swapIn(championsBase, Js.alit(clA, clB), "Champions League", rng)
		local demoted = A.map(A.filter(championsBase, function(c)
			return (not A.some(newChampions, function(n)
				return (n.name == c.name)
			end))
		end), function(c)
			return Js.O({ name = c.name, strength = c.strength }, { "name", "strength" })
		end)
		local newEuropa = swapIn(europaBase, Js.aspread(Js.alit(elA, elB), demoted), "Europa League", rng)
		do return (if (competition == "Champions League") then newChampions else newEuropa) end
	end
	applyCustomClubEntries = function(pool, competition, career)
		local key = (if (competition == "Champions League") then "champions" else "europa")
		local entries = A.filter(M_ruleBook.ruleBookFor(career, "UEFA").customClubEntries, function(e)
			return (e.competition == key)
		end)
		if (Js.alen(entries) == 0) then
			do return pool end
		end
		local seeds = A.map(pool, function(c)
			return Js.O({ name = c.name, strength = c.strength }, { "name", "strength" })
		end)
		do
			local _arr13 = entries
			local _i14 = 0
			while _i14 < Js.alen(_arr13) do
				_i14 += 1
				local e = _arr13[_i14]
				if A.some(seeds, function(c)
					return (c.name == e.customClub)
				end) then
					do continue end
				end
				seeds = A.filter(seeds, function(c)
					return (c.name ~= e.replaces)
				end)
				seeds = Js.aspread(seeds, Js.alit(Js.O({ name = e.customClub, strength = e.strength }, { "name", "strength" })))
			end
		end
		do return seededPool(seeds) end
	end
	replaceableClubsIn = function(competition, career)
		local pool = poolFor(competition, career)
		do return A.map(A.sort(A.filter(pool, function(c)
			return (not saudiExempt(c, competition))
		end), function(a, b)
			return (a.strength - b.strength)
		end), function(c)
			return c.name
		end) end
	end
	exports.replaceableClubsIn = replaceableClubsIn
	poolFor = function(competition, career)
		if (competition == "Conference League") then
			do return CONFERENCE_POOL end
		end
		if (not career) then
			local names = (if (competition == "Champions League") then M_clubs.CHAMPIONS_LEAGUE_CLUBS else M_clubs.EUROPA_LEAGUE_CLUBS)
			do return seededPool(A.map(names, function(name)
				return Js.O({ name = name, strength = (if NON_ENGLISH_CLUB_STRENGTH[name] ~= nil then NON_ENGLISH_CLUB_STRENGTH[name] else 75) }, { "name", "strength" })
			end)) end
		end
		local rawChampions = seasonField("Champions League", career)
		local rawEuropa = seasonField("Europa League", career)
		local championsBase = rawChampions
		local europaBase = rawEuropa
		if M_ruleBook.ruleBookFor(career, "UEFA").saudiClubsInEurope then
			championsBase = applySaudiSwap(rawChampions, rawEuropa, "Champions League", ((career.season * 60013) + 17))
			europaBase = applySaudiSwap(rawChampions, rawEuropa, "Europa League", ((career.season * 60013) + 17))
		end
		championsBase = applyCustomClubEntries(championsBase, "Champions League", career)
		europaBase = applyCustomClubEntries(europaBase, "Europa League", career)
		do return (if (competition == "Champions League") then championsBase else europaBase) end
	end
	exports.poolFor = poolFor
	potForFinish = function(position)
		if (position <= 2) then
			do return 1 end
		end
		if (position == 3) then
			do return 2 end
		end
		if (position == 4) then
			do return 3 end
		end
		do return 4 end
	end
	openEuro = function(competition, clubName, clubStrength, leagueFinish, rng, career)
		local yourPot = potForFinish(leagueFinish)
		local pool = poolFor(competition, career)
		local you = Js.O({ name = clubName, strength = clubStrength, pot = yourPot }, { "name", "strength", "pot" })
		local withoutYou = A.filter(pool, function(c)
			return (c.name ~= clubName)
		end)
		local trimmed = (if (Js.alen(withoutYou) == Js.alen(pool)) then A.slice(withoutYou, 0, -1) else withoutYou)
		local clubs = Js.alit(you)
		for pot = 1, 4 do
			A.push(clubs, Js.unpack(A.filter(trimmed, function(c)
				return (c.pot == pot)
			end)))
		end
		local leaguePhase = Js.alit()
		for pot = 1, 4 do
			local available = shuffle(A.filter(clubs, function(c)
				return ((c.pot == pot) and (c.name ~= clubName))
			end), rng)
			local homeFirst = (rng() < 0.5)
			if available[1] then
				A.push(leaguePhase, Js.O({ opponent = available[1].name, home = homeFirst }, { "opponent", "home" }))
			end
			if available[2] then
				A.push(leaguePhase, Js.O({ opponent = available[2].name, home = (not homeFirst) }, { "opponent", "home" }))
			end
		end
		local liveTable = A.map(clubs, function(c)
			return Js.O({ name = c.name, played = 0, won = 0, drawn = 0, lost = 0, goalsFor = 0, goalsAgainst = 0, points = 0, isYou = (c.name == clubName) }, { "name", "played", "won", "drawn", "lost", "goalsFor", "goalsAgainst", "points", "isYou" })
		end)
		do return Js.O({ competition = competition, clubs = clubs, leaguePhase = shuffle(leaguePhase, rng), ties = Js.alit(), liveTable = liveTable, results = Js.alit(), matchdaysPlayed = 0 }, { "competition", "clubs", "leaguePhase", "ties", "liveTable", "results", "matchdaysPlayed" }) end
	end
	exports.openEuro = openEuro
	shuffle = function(items, rng)
		local out = Js.aspread(items)
		for i = (Js.alen(out) - 1), 1, -1 do
			local j = math.floor((rng() * (i + 1)))
			local _d15 = Js.alit(out[j + 1], out[i + 1])
			A.set(out, i, _d15[1])
			A.set(out, j, _d15[2])
		end
		do return out end
	end
	simulate = function(a, b, rng)
		local edge = ((a - b) / 22)
		local forA = Math.max(0.25, ((1.35 + (edge * 0.55)) + 0.18))
		local forB = Math.max(0.25, ((1.35 - (edge * 0.55)) - 0.18))
		do return Js.alit(poisson(forA, rng), poisson(forB, rng)) end
	end
	exports.simulate = simulate
	poisson = function(mean, rng)
		local limit = Math.exp((-mean))
		local k = 0
		local p = 1
		local _first16 = true
		while _first16 or ((p > limit) and (k < 12)) do
			_first16 = false
			k += 1
			p *= rng()
		end
		do return (k - 1) end
	end
	simulateEuroMatchday = function(state, mdIndex, yourClub, yourOpponent, yourHome, yourScore, yourOppScore, rng, squads, yourGoals, yourOppGoals)
		if (mdIndex < state.matchdaysPlayed) then
			do return state end
		end
		local strength = Js.Map.new(A.map(state.clubs, function(c)
			return Js.alit(c.name, c.strength)
		end))
		local liveTable = A.map(state.liveTable, function(r)
			return Js.ospread(r)
		end)
		local byName = Js.Map.new(A.map(liveTable, function(r)
			return Js.alit(r.name, r)
		end))
		local squadOf = Js.Map.new(A.map((if squads ~= nil then squads else Js.alit()), function(s)
			return Js.alit(s.club, s)
		end))
		local matchday = (mdIndex + 1)
		local results = Js.alit()
		local credit = function(name, gf, ga)
			local r = byName:get(name)
			if (not r) then
				do return end
			end
			r.played += 1
			r.goalsFor += gf
			r.goalsAgainst += ga
			if (gf > ga) then
				r.won += 1
				r.points += 3
			elseif (gf == ga) then
				r.drawn += 1
				r.points += 1
			else
				r.lost += 1
			end
		end
		credit(yourClub, yourScore, yourOppScore)
		credit(yourOpponent, yourOppScore, yourScore)
		local yourNamed = (if yourGoals ~= nil then yourGoals else M_leagueSquads.nameGoals(squadOf:get(yourClub), yourScore, rng))
		local oppNamed = (if yourOppGoals then M_leagueSquads.creditNamedGoals(squadOf:get(yourOpponent), yourOppGoals) else M_leagueSquads.nameGoals(squadOf:get(yourOpponent), yourOppScore, rng))
		A.push(results, Js.ospread(Js.O({ week = matchday, home = (if yourHome then yourClub else yourOpponent), away = (if yourHome then yourOpponent else yourClub), hs = (if yourHome then yourScore else yourOppScore), as = (if yourHome then yourOppScore else yourScore) }, { "week", "home", "away", "hs", "as" }), (if Js.T(Js.alen(yourNamed)) then (if yourHome then Js.O({ hg = yourNamed }, { "hg" }) else Js.O({ ag = yourNamed }, { "ag" })) else Js.O({}, nil)), (if Js.T(Js.alen(oppNamed)) then (if yourHome then Js.O({ ag = oppNamed }, { "ag" }) else Js.O({ hg = oppNamed }, { "hg" })) else Js.O({}, nil))))
		local others = shuffle(A.filter(A.map(state.clubs, function(c)
			return c.name
		end), function(n)
			return ((n ~= yourClub) and (n ~= yourOpponent))
		end), rng)
		do
			local i = 0
			local _first17 = true
			while true do
				if not _first17 then
					i += 2
				end
				_first17 = false
				if not ((i + 1) < Js.alen(others)) then break end
				local home = others[i + 1]
				local away = others[(i + 1) + 1]
				local _d18 = simulate((strength:get(home) or 75), (strength:get(away) or 75), rng)
				local hs = _d18[1]
				local as = _d18[2]
				credit(home, hs, as)
				credit(away, as, hs)
				local hg = M_leagueSquads.nameGoals(squadOf:get(home), hs, rng)
				local ag = M_leagueSquads.nameGoals(squadOf:get(away), as, rng)
				A.push(results, Js.ospread(Js.O({ week = matchday, home = home, away = away, hs = hs, as = as }, { "week", "home", "away", "hs", "as" }), (if Js.T(Js.alen(hg)) then Js.O({ hg = hg }, { "hg" }) else Js.O({}, nil)), (if Js.T(Js.alen(ag)) then Js.O({ ag = ag }, { "ag" }) else Js.O({}, nil))))
			end
		end
		do return Js.ospread(state, Js.O({ liveTable = liveTable, matchdaysPlayed = matchday, results = Js.aspread((if state.results ~= nil then state.results else Js.alit()), results) }, { "liveTable", "matchdaysPlayed", "results" })) end
	end
	exports.simulateEuroMatchday = simulateEuroMatchday
	sortEuro = function(rows)
		do return A.sort(Js.aspread(rows), function(a, b)
			return (function() local _l = (function() local _l = (function() local _l = (b.points - a.points); if Js.T(_l) then return _l end; return ((b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst)) end)(); if Js.T(_l) then return _l end; return (b.goalsFor - a.goalsFor) end)(); if Js.T(_l) then return _l end; return S.localeCompare(a.name, b.name) end)()
		end) end
	end
	exports.sortEuro = sortEuro
	leaguePhaseComplete = function(state)
		do return ((Js.alen(state.leaguePhase) > 0) and A.every(state.leaguePhase, function(m)
			return (m.us ~= nil)
		end)) end
	end
	exports.leaguePhaseComplete = leaguePhaseComplete
	knockoutSlots = function(position)
		do return (if (position <= 8) then M_calendar.EURO_KO_SLOTS_SEEDED else M_calendar.EURO_KO_SLOTS_WITH_R32) end
	end
	exports.knockoutSlots = knockoutSlots
	drawTie = function(state, round, yourClub, rng)
		local table_ = (if state.table ~= nil then state.table else Js.alit())
		local alreadyPlayed = Js.Set.new(A.map(state.ties, function(t)
			return t.opponent
		end))
		local band = (if (round == "Round of 32") then A.slice(table_, 8, 24) else (if (round == "Round of 16") then A.slice(table_, 0, 24) else A.slice(table_, 0, 16)))
		local candidates = A.filter(band, function(r)
			return (((not r.isYou) and (r.name ~= yourClub)) and (not alreadyPlayed:has(r.name)))
		end)
		local pick = (if Js.T(Js.alen(candidates)) then candidates[math.floor((rng() * Js.alen(candidates))) + 1] else Js.O({ name = "Ajax" }, { "name" }))
		local strength = ((function() local _v = A.find(state.clubs, function(c)
			return (c.name == pick.name)
		end); if _v == nil then return nil end; _v = _v.strength; return _v end)() or 78)
		local single = (round == "Final")
		local homeFirst = (rng() < 0.5)
		do return Js.O({ round = round, opponent = pick.name, opponentStrength = strength, legs = (if single then Js.alit(Js.O({ home = false }, { "home" })) else Js.alit(Js.O({ home = homeFirst }, { "home" }), Js.O({ home = (not homeFirst) }, { "home" }))) }, { "round", "opponent", "opponentStrength", "legs" }) end
	end
	exports.drawTie = drawTie
	currentTie = function(state)
		local last = state.ties[Js.alen(state.ties)]
		do return (if (last and (last.result == nil)) then last else nil) end
	end
	exports.currentTie = currentTie
	currentLeg = function(state)
		local tie = currentTie(state)
		if (not tie) then
			do return nil end
		end
		local i = A.findIndex(tie.legs, function(l)
			return (l.us == nil)
		end)
		do return (if (i == -1) then nil else i) end
	end
	exports.currentLeg = currentLeg
	settleTie = function(tie, yourStrength, rng, livePens)
		local done = A.every(tie.legs, function(l)
			return (l.us ~= nil)
		end)
		if (not done) then
			do return tie end
		end
		local us = A.reduce(tie.legs, function(s, l)
			return (s + (if l.us ~= nil then l.us else 0))
		end, 0)
		local them = A.reduce(tie.legs, function(s, l)
			return (s + (if l.them ~= nil then l.them else 0))
		end, 0)
		if (us ~= them) then
			do return Js.ospread(tie, Js.O({ result = (if (us > them) then "W" else "L") }, { "result" })) end
		end
		local lastLegIdx = (Js.alen(tie.legs) - 1)
		local et = M_shootout.extraTimeScore(yourStrength, tie.opponentStrength, rng)
		local legs = A.map(tie.legs, function(l, i)
			return (if (i == lastLegIdx) then Js.ospread(l, Js.O({ us = ((if l.us ~= nil then l.us else 0) + et.hs), them = ((if l.them ~= nil then l.them else 0) + et.as) }, { "us", "them" })) else l)
		end)
		local usAfterET = A.reduce(legs, function(s, l)
			return (s + (if l.us ~= nil then l.us else 0))
		end, 0)
		local themAfterET = A.reduce(legs, function(s, l)
			return (s + (if l.them ~= nil then l.them else 0))
		end, 0)
		if (usAfterET ~= themAfterET) then
			do return Js.ospread(tie, Js.O({ legs = legs, wentToExtraTime = true, extraTime = Js.O({ us = et.hs, them = et.as }, { "us", "them" }), result = (if (usAfterET > themAfterET) then "W" else "L") }, { "legs", "wentToExtraTime", "extraTime", "result" })) end
		end
		local pens = (if livePens ~= nil then livePens else (function()
			local s = M_shootout.simulateShootout(yourStrength, tie.opponentStrength, rng)
			do return Js.O({ us = s.home, them = s.away }, { "us", "them" }) end
		end)())
		do return Js.ospread(tie, Js.O({ legs = legs, wentToExtraTime = true, extraTime = Js.O({ us = et.hs, them = et.as }, { "us", "them" }), result = (if (pens.us > pens.them) then "W" else "L"), onPenalties = true, pens = pens }, { "legs", "wentToExtraTime", "extraTime", "result", "onPenalties", "pens" })) end
	end
	exports.settleTie = settleTie
	nextRound = function(position, round)
		local slots = knockoutSlots(position)
		local names = A.filter(A.map(slots, function(s)
			return s.round
		end), function(r, i, a)
			return (A.indexOf(a, r) == i)
		end)
		local i = A.indexOf(names, round)
		do return (if ((i == -1) or (i == (Js.alen(names) - 1))) then nil else names[(i + 1) + 1]) end
	end
	exports.nextRound = nextRound
	firstRound = function(position)
		if (position > 24) then
			do return nil end
		end
		do return knockoutSlots(position)[1].round end
	end
	exports.firstRound = firstRound
	crownEurope = function(state, seed)
		local rng = M_season.mulberry32(seed)
		local contenders = A.slice((if state.table ~= nil then state.table else Js.alit()), 0, 16)
		if (not Js.T(Js.alen(contenders))) then
			do return ((function() local _v = state.clubs[1]; if _v == nil then return nil end; _v = _v.name; return _v end)() or "Real Madrid") end
		end
		local strength = Js.Map.new(A.map(state.clubs, function(c)
			return Js.alit(c.name, c.strength)
		end))
		local total = 0
		local weights = A.map(contenders, function(r)
			local w = Math.pow(Math.max(1, ((strength:get(r.name) or 75) - 60)), 2.2)
			total += w
			do return w end
		end)
		local x = (rng() * total)
		for i = 0, (Js.alen(contenders)) - 1 do
			x -= weights[i + 1]
			if (x <= 0) then
				do return contenders[i + 1].name end
			end
		end
		do return contenders[1].name end
	end
	exports.crownEurope = crownEurope
	crownWithoutYou = function(competition, entrants, seed)
		local rng = M_season.mulberry32(seed)
		local pool = A.slice(A.sort(Js.aspread(poolFor(competition)), function(a, b)
			return (b.strength - a.strength)
		end), 0, 16)
		local contenders = Js.aspread(A.map(pool, function(c)
			return Js.O({ name = c.name, strength = c.strength }, { "name", "strength" })
		end), entrants)
		if (not Js.T(Js.alen(contenders))) then
			do return ((function() local _v = pool[1]; if _v == nil then return nil end; _v = _v.name; return _v end)() or "Real Madrid") end
		end
		local total = 0
		local weights = A.map(contenders, function(c)
			local w = Math.pow(Math.max(1, (c.strength - 60)), 2.2)
			total += w
			do return w end
		end)
		local x = (rng() * total)
		for i = 0, (Js.alen(contenders)) - 1 do
			x -= weights[i + 1]
			if (x <= 0) then
				do return contenders[i + 1].name end
			end
		end
		do return contenders[1].name end
	end
	exports.crownWithoutYou = crownWithoutYou
	phaseVerdict = function(position)
		if (position <= 8) then
			do return "Seeded straight through to the Round of 16." end
		end
		if (position <= 24) then
			do return "Into the Round of 32 play-off." end
		end
		do return "Eliminated in the league phase." end
	end
	exports.phaseVerdict = phaseVerdict
	NON_ENGLISH_CLUB_STRENGTH = Js.O({ ["Real Madrid"] = 92, ["FC Bayern München"] = 91, ["FC Barcelona"] = 89, ["Paris Saint-Germain"] = 88, Inter = 86, ["Atlético Madrid"] = 85, ["Borussia Dortmund"] = 84, Napoli = 82, ["FC Porto"] = 79, ["RB Leipzig"] = 80, Roma = 80, PSV = 77, ["Real Betis Balompié"] = 77, ["Sporting CP"] = 77, ["Villarreal CF"] = 76, ["Eintracht Frankfurt"] = 76, ["Fenerbahçe SK"] = 76, Feyenoord = 75, ["Olympique Lyonnais"] = 75, ["RC Lens"] = 75, ["VfB Stuttgart"] = 75, ["Lille OSC"] = 75, ["Galatasaray SK"] = 74, Celtic = 72, ["Club Brugge KV"] = 72, ["Shakhtar Donetsk"] = 72, ["Dinamo Zagreb"] = 70, ["SK Slavia Praha"] = 70, ["FC København"] = 70, ["FK Bodø/Glimt"] = 69, Como = 64, ["AEK Athens"] = 62, Juventus = 84, ["AC Milan"] = 83, ["Bayer 04 Leverkusen"] = 83, ["SL Benfica"] = 80, Lazio = 78, Ajax = 76, ["Olympique de Marseille"] = 76, ["Real Sociedad"] = 76, ["Olympiacos FC"] = 73, ["Sporting Clube de Braga"] = 73, ["TSG 1899 Hoffenheim"] = 73, ["AZ Alkmaar"] = 72, ["RSC Anderlecht"] = 71, ["KRC Genk"] = 71, ["Union Saint-Gilloise"] = 70, PAOK = 70, ["Beşiktaş JK"] = 70, ["Stade Rennais FC"] = 70, ["Ferencvárosi Torna Club"] = 69, ["FC Midtjylland"] = 69, Trabzonspor = 69, ["BSC Young Boys"] = 68, ["SK Sturm Graz"] = 68, ["Malmö FF"] = 68, ["Sparta Praha"] = 68, ["Viktoria Plzeň"] = 68, ["FC Basel 1893"] = 64, ["RC Celta"] = 65, ["Legia Warszawa"] = 62, ["Lech Poznań"] = 61, ["Shamrock Rovers"] = 60, ["FC Red Bull Salzburg"] = 76, ["FC Schalke 04"] = 68, ["AS Monaco"] = 78, ["RC Strasbourg Alsace"] = 71, Atalanta = 80, ["Sevilla FC"] = 79, ["Rangers FC"] = 74, Hearts = 63, ["Vitória SC"] = 61 }, { "Real Madrid", "FC Bayern München", "FC Barcelona", "Paris Saint-Germain", "Inter", "Atlético Madrid", "Borussia Dortmund", "Napoli", "FC Porto", "RB Leipzig", "Roma", "PSV", "Real Betis Balompié", "Sporting CP", "Villarreal CF", "Eintracht Frankfurt", "Fenerbahçe SK", "Feyenoord", "Olympique Lyonnais", "RC Lens", "VfB Stuttgart", "Lille OSC", "Galatasaray SK", "Celtic", "Club Brugge KV", "Shakhtar Donetsk", "Dinamo Zagreb", "SK Slavia Praha", "FC København", "FK Bodø/Glimt", "Como", "AEK Athens", "Juventus", "AC Milan", "Bayer 04 Leverkusen", "SL Benfica", "Lazio", "Ajax", "Olympique de Marseille", "Real Sociedad", "Olympiacos FC", "Sporting Clube de Braga", "TSG 1899 Hoffenheim", "AZ Alkmaar", "RSC Anderlecht", "KRC Genk", "Union Saint-Gilloise", "PAOK", "Beşiktaş JK", "Stade Rennais FC", "Ferencvárosi Torna Club", "FC Midtjylland", "Trabzonspor", "BSC Young Boys", "SK Sturm Graz", "Malmö FF", "Sparta Praha", "Viktoria Plzeň", "FC Basel 1893", "RC Celta", "Legia Warszawa", "Lech Poznań", "Shamrock Rovers", "FC Red Bull Salzburg", "FC Schalke 04", "AS Monaco", "RC Strasbourg Alsace", "Atalanta", "Sevilla FC", "Rangers FC", "Hearts", "Vitória SC" })
	SAUDI_CLUBS = Js.alit(Js.O({ name = "Al Hilal", strength = 79 }, { "name", "strength" }), Js.O({ name = "Al Nassr", strength = 79 }, { "name", "strength" }), Js.O({ name = "Al Ahli SFC", strength = 77 }, { "name", "strength" }), Js.O({ name = "Al Ittihad", strength = 77 }, { "name", "strength" }))
	EURO_CLUB_NATION = Js.O({ ["Real Madrid"] = "Spain", ["FC Barcelona"] = "Spain", ["Atlético Madrid"] = "Spain", ["Real Betis Balompié"] = "Spain", ["Villarreal CF"] = "Spain", ["Real Sociedad"] = "Spain", ["RC Celta"] = "Spain", ["Sevilla FC"] = "Spain", Inter = "Italy", Napoli = "Italy", Roma = "Italy", Como = "Italy", Juventus = "Italy", ["AC Milan"] = "Italy", Lazio = "Italy", Atalanta = "Italy", ["FC Bayern München"] = "Germany", ["Borussia Dortmund"] = "Germany", ["RB Leipzig"] = "Germany", ["Eintracht Frankfurt"] = "Germany", ["VfB Stuttgart"] = "Germany", ["Bayer 04 Leverkusen"] = "Germany", ["TSG 1899 Hoffenheim"] = "Germany", ["FC Schalke 04"] = "Germany", ["Paris Saint-Germain"] = "France", ["Olympique Lyonnais"] = "France", ["RC Lens"] = "France", ["Lille OSC"] = "France", ["Olympique de Marseille"] = "France", ["Stade Rennais FC"] = "France", ["AS Monaco"] = "France", ["RC Strasbourg Alsace"] = "France", ["FC Porto"] = "Portugal", ["Sporting CP"] = "Portugal", ["SL Benfica"] = "Portugal", ["Sporting Clube de Braga"] = "Portugal", ["Vitória SC"] = "Portugal", PSV = "Netherlands", Feyenoord = "Netherlands", Ajax = "Netherlands", ["AZ Alkmaar"] = "Netherlands", ["Fenerbahçe SK"] = "Turkey", ["Galatasaray SK"] = "Turkey", ["Beşiktaş JK"] = "Turkey", Trabzonspor = "Turkey", Celtic = "Scotland", ["Rangers FC"] = "Scotland", Hearts = "Scotland", ["Club Brugge KV"] = "Belgium", ["RSC Anderlecht"] = "Belgium", ["KRC Genk"] = "Belgium", ["Union Saint-Gilloise"] = "Belgium", ["Shakhtar Donetsk"] = "Ukraine", ["Dinamo Zagreb"] = "Croatia", ["SK Slavia Praha"] = "Czech Republic", ["Sparta Praha"] = "Czech Republic", ["Viktoria Plzeň"] = "Czech Republic", ["FC København"] = "Denmark", ["FC Midtjylland"] = "Denmark", ["FK Bodø/Glimt"] = "Norway", ["AEK Athens"] = "Greece", ["Olympiacos FC"] = "Greece", PAOK = "Greece", ["Ferencvárosi Torna Club"] = "Hungary", ["BSC Young Boys"] = "Switzerland", ["FC Basel 1893"] = "Switzerland", ["SK Sturm Graz"] = "Austria", ["FC Red Bull Salzburg"] = "Austria", ["Malmö FF"] = "Sweden", ["Legia Warszawa"] = "Poland", ["Lech Poznań"] = "Poland", ["Shamrock Rovers"] = "Ireland" }, { "Real Madrid", "FC Barcelona", "Atlético Madrid", "Real Betis Balompié", "Villarreal CF", "Real Sociedad", "RC Celta", "Sevilla FC", "Inter", "Napoli", "Roma", "Como", "Juventus", "AC Milan", "Lazio", "Atalanta", "FC Bayern München", "Borussia Dortmund", "RB Leipzig", "Eintracht Frankfurt", "VfB Stuttgart", "Bayer 04 Leverkusen", "TSG 1899 Hoffenheim", "FC Schalke 04", "Paris Saint-Germain", "Olympique Lyonnais", "RC Lens", "Lille OSC", "Olympique de Marseille", "Stade Rennais FC", "AS Monaco", "RC Strasbourg Alsace", "FC Porto", "Sporting CP", "SL Benfica", "Sporting Clube de Braga", "Vitória SC", "PSV", "Feyenoord", "Ajax", "AZ Alkmaar", "Fenerbahçe SK", "Galatasaray SK", "Beşiktaş JK", "Trabzonspor", "Celtic", "Rangers FC", "Hearts", "Club Brugge KV", "RSC Anderlecht", "KRC Genk", "Union Saint-Gilloise", "Shakhtar Donetsk", "Dinamo Zagreb", "SK Slavia Praha", "Sparta Praha", "Viktoria Plzeň", "FC København", "FC Midtjylland", "FK Bodø/Glimt", "AEK Athens", "Olympiacos FC", "PAOK", "Ferencvárosi Torna Club", "BSC Young Boys", "FC Basel 1893", "SK Sturm Graz", "FC Red Bull Salzburg", "Malmö FF", "Legia Warszawa", "Lech Poznań", "Shamrock Rovers" })
	ENGLISH_LADDER = Js.Set.new(Js.aspread(M_clubs.PREMIER_LEAGUE_CLUBS, M_clubs.CHAMPIONSHIP_CLUBS, M_clubs.PROMOTION_POOL_CLUBS))
	MAIN_NATIONS = Js.alit("England", "Spain", "Italy", "Germany", "France")
	EL_NAMED_EXEMPT = Js.Set.new(Js.alit("Olympiacos FC", "RSC Anderlecht", "SL Benfica", "Ajax"))
	MAIN_NATION_ALLOCATION = computeMainNationAllocation()
	CONFERENCE_SEEDS = Js.alit(Js.O({ name = "Fiorentina", strength = 74 }, { "name", "strength" }), Js.O({ name = "Club Brugge", strength = 72 }, { "name", "strength" }), Js.O({ name = "Hearts", strength = 66 }, { "name", "strength" }), Js.O({ name = "Gent", strength = 68 }, { "name", "strength" }), Js.O({ name = "Partizan", strength = 67 }, { "name", "strength" }), Js.O({ name = "PAOK", strength = 69 }, { "name", "strength" }), Js.O({ name = "Galatasaray B", strength = 67 }, { "name", "strength" }), Js.O({ name = "Djurgården", strength = 64 }, { "name", "strength" }), Js.O({ name = "Legia Warsaw", strength = 66 }, { "name", "strength" }), Js.O({ name = "Molde", strength = 65 }, { "name", "strength" }), Js.O({ name = "Heidenheim", strength = 66 }, { "name", "strength" }), Js.O({ name = "HJK Helsinki", strength = 62 }, { "name", "strength" }), Js.O({ name = "Sivasspor", strength = 63 }, { "name", "strength" }), Js.O({ name = "Genk", strength = 67 }, { "name", "strength" }), Js.O({ name = "Brøndby", strength = 64 }, { "name", "strength" }), Js.O({ name = "Vitória Guimarães", strength = 65 }, { "name", "strength" }), Js.O({ name = "Lech Poznań", strength = 63 }, { "name", "strength" }), Js.O({ name = "Slavia Sofia", strength = 61 }, { "name", "strength" }), Js.O({ name = "Hajduk Split", strength = 63 }, { "name", "strength" }), Js.O({ name = "Rosenborg", strength = 62 }, { "name", "strength" }), Js.O({ name = "IFK Göteborg", strength = 60 }, { "name", "strength" }), Js.O({ name = "Botev Plovdiv", strength = 59 }, { "name", "strength" }), Js.O({ name = "Universitatea Craiova", strength = 60 }, { "name", "strength" }), Js.O({ name = "Zaglebie Lubin", strength = 60 }, { "name", "strength" }), Js.O({ name = "Vikingur", strength = 58 }, { "name", "strength" }), Js.O({ name = "Noah FC", strength = 58 }, { "name", "strength" }), Js.O({ name = "FC Pyunik", strength = 57 }, { "name", "strength" }), Js.O({ name = "NSÍ Runavík", strength = 55 }, { "name", "strength" }), Js.O({ name = "Levadia Tallinn", strength = 56 }, { "name", "strength" }), Js.O({ name = "FK Riteriai", strength = 55 }, { "name", "strength" }), Js.O({ name = "Differdange 03", strength = 53 }, { "name", "strength" }), Js.O({ name = "FC Santa Coloma", strength = 52 }, { "name", "strength" }), Js.O({ name = "Shkupi", strength = 57 }, { "name", "strength" }), Js.O({ name = "Inter Club d'Escaldes", strength = 51 }, { "name", "strength" }), Js.O({ name = "Lincoln Red Imps", strength = 56 }, { "name", "strength" }))
	CONFERENCE_POOL = seededPool(CONFERENCE_SEEDS)
	EURO_LEAGUE_PHASE_SLOTS = M_calendar.EURO_LEAGUE_PHASE_WEEKS
	exports.EURO_LEAGUE_PHASE_SLOTS = EURO_LEAGUE_PHASE_SLOTS
end
