--!nocheck
--!nolint
-- Generated from lib/star/cups.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_clubs = import("lib/star/clubs")
	local M_season = import("lib/star/season")
	local M_shootout = import("lib/star/shootout")
	local CUP_ROUND_NAMES, FA_CUP_ROUND_NAMES, LOWER_LEAGUE_TROPHY_ROUND_NAMES, FA_CUP_ROUND_NAMES_V1, roundNamesFor, cupRoundNames, lastSixteenIndex, isTwoLeggedRound, CUP_FIELD, FA_CUP_FIELD, belowStrength, weightedDrawN, leagueCupOtherTier, belowField, faCupField, shuffle, drawRound, openCupWithByes, openCup, FA_QUALIFIERS, openFaCup, cupField, cupStrength, tieScore, shootout, tieWinner, playCupRound, drawEven, finishCupToWinner, currentRound, yourTie, hasBye, stillIn, awaitsYourTie, yourEntryRound, exitRound
	roundNamesFor = function(competition)
		if (competition == "Lower League Trophy") then
			do return LOWER_LEAGUE_TROPHY_ROUND_NAMES end
		end
		do return (if (competition == "FA Cup") then FA_CUP_ROUND_NAMES else CUP_ROUND_NAMES) end
	end
	exports.roundNamesFor = roundNamesFor
	cupRoundNames = function(state)
		if state.names then
			do return state.names end
		end
		if (state.competition == "Lower League Trophy") then
			do return LOWER_LEAGUE_TROPHY_ROUND_NAMES end
		end
		do return (if (state.competition == "FA Cup") then FA_CUP_ROUND_NAMES_V1 else CUP_ROUND_NAMES) end
	end
	exports.cupRoundNames = cupRoundNames
	lastSixteenIndex = function(state)
		do return (Js.alen(cupRoundNames(state)) - 4) end
	end
	exports.lastSixteenIndex = lastSixteenIndex
	isTwoLeggedRound = function(competition, round)
		do return ((competition == "League Cup") and (round == "Semi-Final")) end
	end
	exports.isTwoLeggedRound = isTwoLeggedRound
	belowStrength = function(club, tier)
		local baseline = (if (tier == "premier") then 74 else (if (tier == "championship") then 58 else (if (tier == "pool") then 50 else (if (tier == "league_one") then 50 else (if (tier == "league_two") then 45 else 40)))))
		local h = 2166136261
		for i = 0, (S.len(club)) - 1 do
			h = Js.bxor(h, S.charCodeAt(club, i))
			h = Math.imul(h, 16777619)
		end
		do return (baseline + (math.fmod(Js.ushr(h, 0), 700) / 100)) end
	end
	weightedDrawN = function(candidates, count, rng)
		local remaining = Js.aspread(candidates)
		local picked = Js.alit()
		while ((Js.alen(picked) < count) and (Js.alen(remaining) > 0)) do
			local total = A.reduce(remaining, function(sum, c)
				return (sum + c.weight)
			end, 0)
			local roll = (rng() * total)
			local at = (Js.alen(remaining) - 1)
			for i = 0, (Js.alen(remaining)) - 1 do
				roll -= remaining[i + 1].weight
				if (roll <= 0) then
					at = i
					do break end
				end
			end
			A.push(picked, remaining[at + 1].name)
			A.splice(remaining, at, 1)
		end
		do return picked end
	end
	leagueCupOtherTier = function(division)
		local _sw1 = division
		if _sw1 == "premier" then
			do return Js.O({ clubs = M_clubs.CHAMPIONSHIP_CLUBS, name = "championship" }, { "clubs", "name" }) end
		elseif _sw1 == "championship" then
			do return Js.O({ clubs = M_clubs.PREMIER_LEAGUE_CLUBS, name = "premier" }, { "clubs", "name" }) end
		elseif _sw1 == "league_one" then
			do return Js.O({ clubs = M_clubs.CHAMPIONSHIP_CLUBS, name = "championship" }, { "clubs", "name" }) end
		elseif _sw1 == "league_two" then
			do return Js.O({ clubs = M_clubs.LEAGUE_ONE_CLUBS, name = "league_one" }, { "clubs", "name" }) end
		else
			do return Js.O({ clubs = M_clubs.CHAMPIONSHIP_CLUBS, name = "championship" }, { "clubs", "name" }) end
		end
	end
	belowField = function(names, division, needed, rng)
		local _d2 = leagueCupOtherTier(division)
		local otherTierClubs = _d2.clubs
		local otherTierName = _d2.name
		local otherTierCandidates = A.map(A.filter(otherTierClubs, function(c)
			return (not A.includes(names, c))
		end), function(name)
			return Js.O({ name = name, weight = belowStrength(name, otherTierName) }, { "name", "weight" })
		end)
		local poolCandidates = A.map(A.filter(M_clubs.PROMOTION_POOL_CLUBS, function(c)
			return (not A.includes(names, c))
		end), function(name)
			return Js.O({ name = name, weight = (belowStrength(name, "pool") * 0.25) }, { "name", "weight" })
		end)
		local drawn = weightedDrawN(Js.aspread(otherTierCandidates, poolCandidates), needed, rng)
		local i = 0
		while (Js.alen(drawn) < needed) do
			A.push(drawn, (M_clubs.PROMOTION_POOL_CLUBS[math.fmod(i, Js.alen(M_clubs.PROMOTION_POOL_CLUBS)) + 1] .. " B"))
			i += 1
		end
		do return drawn end
	end
	faCupField = function(names, division, rng)
		local guaranteedOther = (if (division == "premier") then M_clubs.CHAMPIONSHIP_CLUBS else (if (division == "championship") then M_clubs.PREMIER_LEAGUE_CLUBS else Js.aspread(M_clubs.PREMIER_LEAGUE_CLUBS, M_clubs.CHAMPIONSHIP_CLUBS)))
		local guaranteed = Js.Array.from(Js.Set.new(Js.aspread(names, guaranteedOther)))
		local guaranteedSet = Js.Set.new(guaranteed)
		local remaining = Math.max(0, (FA_CUP_FIELD - Js.alen(guaranteed)))
		local includeNational = (division ~= "national_league")
		local nationalSlots = (if includeNational then Math.min(remaining, (if (rng() < 0.5) then 1 else 2)) else 0)
		local l1l2Needed = (remaining - nationalSlots)
		local nationalCandidates = (if includeNational then A.map(A.filter(M_clubs.NATIONAL_LEAGUE_CLUBS, function(c)
			return (not guaranteedSet:has(c))
		end), function(name)
			return Js.O({ name = name, weight = belowStrength(name, "national_league") }, { "name", "weight" })
		end) else Js.alit())
		local nationalDrawn = weightedDrawN(nationalCandidates, nationalSlots, rng)
		local nationalDrawnSet = Js.Set.new(nationalDrawn)
		local l1Pool = (if (division == "league_one") then Js.alit() else M_clubs.LEAGUE_ONE_CLUBS)
		local l2Pool = (if (division == "league_two") then Js.alit() else M_clubs.LEAGUE_TWO_CLUBS)
		local l1l2Candidates = A.map(A.filter(Js.aspread(l1Pool, l2Pool), function(c)
			return ((not guaranteedSet:has(c)) and (not nationalDrawnSet:has(c)))
		end), function(name)
			return Js.O({ name = name, weight = belowStrength(name, (if A.includes(M_clubs.LEAGUE_ONE_CLUBS, name) then "league_one" else "league_two")) }, { "name", "weight" })
		end)
		local l1l2Drawn = weightedDrawN(l1l2Candidates, l1l2Needed, rng)
		local drawn = Js.aspread(nationalDrawn, l1l2Drawn)
		local i = 0
		while ((Js.alen(guaranteed) + Js.alen(drawn)) < FA_CUP_FIELD) do
			A.push(drawn, (M_clubs.NATIONAL_LEAGUE_CLUBS[math.fmod(i, Js.alen(M_clubs.NATIONAL_LEAGUE_CLUBS)) + 1] .. " B"))
			i += 1
		end
		do return A.slice(Js.aspread(guaranteed, drawn), 0, FA_CUP_FIELD) end
	end
	shuffle = function(items, rng)
		local out = Js.aspread(items)
		for i = (Js.alen(out) - 1), 1, -1 do
			local j = math.floor((rng() * (i + 1)))
			local _d3 = Js.alit(out[j + 1], out[i + 1])
			A.set(out, i, _d3[1])
			A.set(out, j, _d3[2])
		end
		do return out end
	end
	exports.shuffle = shuffle
	drawRound = function(name, survivors, rng)
		local hat = shuffle(survivors, rng)
		local ties = Js.alit()
		do
			local i = 0
			local _first4 = true
			while true do
				if not _first4 then
					i += 2
				end
				_first4 = false
				if not ((i + 1) < Js.alen(hat)) then break end
				A.push(ties, Js.O({ home = hat[i + 1], away = hat[(i + 1) + 1] }, { "home", "away" }))
			end
		end
		do return Js.O({ name = name, ties = ties }, { "name", "ties" }) end
	end
	exports.drawRound = drawRound
	openCupWithByes = function(competition, field, byes, rng)
		local byeSet = Js.Set.new(byes)
		local first = drawRound(roundNamesFor(competition)[1], A.filter(field, function(c)
			return (not byeSet:has(c))
		end), rng)
		do return Js.O({ competition = competition, rounds = Js.alit(Js.ospread(first, Js.O({ byes = Js.aspread(byes) }, { "byes" }))) }, { "competition", "rounds" }) end
	end
	exports.openCupWithByes = openCupWithByes
	openCup = function(competition, league, division, rng)
		local field = cupField(league, division, rng, competition)
		if (competition == "FA Cup") then
			do return Js.O({ competition = competition, names = FA_CUP_ROUND_NAMES_V1, rounds = Js.alit(drawRound(FA_CUP_ROUND_NAMES_V1[1], field, rng)) }, { "competition", "names", "rounds" }) end
		end
		do return Js.O({ competition = competition, rounds = Js.alit(drawRound(roundNamesFor(competition)[1], field, rng)) }, { "competition", "rounds" }) end
	end
	exports.openCup = openCup
	openFaCup = function(e, yourClub, rng)
		local total = (Js.alen(e.north) + Js.alen(e.south))
		local byes = Math.max(0, Math.min(total, ((2 * FA_QUALIFIERS) - total)))
		local byesNorth = (if (total > 0) then Math.round(((byes * Js.alen(e.north)) / total)) else 0)
		local byesSouth = (byes - byesNorth)
		if (math.fmod((Js.alen(e.north) - byesNorth), 2) ~= 0) then
			if (byesSouth > 0) then
				byesSouth -= 1
				byesNorth += 1
			else
				byesNorth -= 1
				byesSouth += 1
			end
		end
		local split = function(list, n)
			local bye = A.slice(A.filter(list, function(c)
				return (c ~= yourClub)
			end), 0, n)
			do return Js.O({ bye = bye, play = A.filter(list, function(c)
				return (not A.includes(bye, c))
			end) }, { "bye", "play" }) end
		end
		local N_ = split(e.north, byesNorth)
		local S_ = split(e.south, byesSouth)
		local names = FA_CUP_ROUND_NAMES
		local first = Js.O({ name = names[1], ties = Js.aspread(drawRound(names[1], N_.play, rng).ties, drawRound(names[1], S_.play, rng).ties), byes = Js.aspread(N_.bye, S_.bye) }, { "name", "ties", "byes" })
		do return Js.O({ competition = "FA Cup", names = names, rounds = Js.alit(first), entries = Js.ospread((function() local _o = Js.O({}, nil); _o[Js.key(names[2])] = Js.aspread(e.nationalLeague); _o[Js.key(names[3])] = Js.aspread(e.footballLeague); _o[Js.key(names[5])] = Js.aspread(e.topTwo); return _o end)()) }, { "competition", "names", "rounds", "entries" }) end
	end
	exports.openFaCup = openFaCup
	cupField = function(league, division, rng, competition)
		if competition == nil then competition = "FA Cup" end
		local names = A.map(league, function(t)
			return t.name
		end)
		if (competition == "FA Cup") then
			do return faCupField(names, division, rng) end
		end
		local needed = Math.max(0, (CUP_FIELD - Js.alen(names)))
		local below = belowField(names, division, needed, rng)
		do return A.slice(Js.aspread(names, below), 0, CUP_FIELD) end
	end
	exports.cupField = cupField
	cupStrength = function(club, league)
		local inLeague = A.find(league, function(t)
			return (t.name == club)
		end)
		if inLeague then
			do return inLeague.strength end
		end
		if A.includes(M_clubs.PREMIER_LEAGUE_CLUBS, club) then
			do return belowStrength(club, "premier") end
		end
		if A.includes(M_clubs.CHAMPIONSHIP_CLUBS, club) then
			do return belowStrength(club, "championship") end
		end
		if A.includes(M_clubs.LEAGUE_ONE_CLUBS, club) then
			do return belowStrength(club, "league_one") end
		end
		if A.includes(M_clubs.LEAGUE_TWO_CLUBS, club) then
			do return belowStrength(club, "league_two") end
		end
		if A.includes(M_clubs.NATIONAL_LEAGUE_CLUBS, club) then
			do return belowStrength(club, "national_league") end
		end
		if (A.includes(M_clubs.NATIONAL_LEAGUE_NORTH_CLUBS, club) or A.includes(M_clubs.NATIONAL_LEAGUE_SOUTH_CLUBS, club)) then
			do return (belowStrength(club, "national_league") - 4) end
		end
		if A.includes(M_clubs.PROMOTION_POOL_CLUBS, club) then
			do return belowStrength(club, "pool") end
		end
		local base = S.replace(club, Js.re(" B$", ""), "")
		if A.includes(M_clubs.PROMOTION_POOL_CLUBS, base) then
			do return (belowStrength(base, "pool") - 3) end
		end
		if A.includes(M_clubs.NATIONAL_LEAGUE_CLUBS, base) then
			do return (belowStrength(base, "national_league") - 3) end
		end
		do return 55 end
	end
	exports.cupStrength = cupStrength
	tieScore = function(homeStr, awayStr, rng)
		local s = M_season.simulateFixtureScore(homeStr, awayStr, rng)
		do return Js.O({ hs = s.home, as = s.away }, { "hs", "as" }) end
	end
	shootout = function(homeStr, awayStr, rng)
		do return M_shootout.simulateShootout(homeStr, awayStr, rng) end
	end
	tieWinner = function(tie)
		if ((tie.hs == nil) or (tie.as == nil)) then
			do return nil end
		end
		if (tie.hs ~= tie.as) then
			do return (if (tie.hs > tie.as) then tie.home else tie.away) end
		end
		if (not tie.pens) then
			do return nil end
		end
		do return (if (tie.pens.home > tie.pens.away) then tie.home else tie.away) end
	end
	exports.tieWinner = tieWinner
	playCupRound = function(state, league, yourClub, yourResult, rng)
		local round = state.rounds[Js.alen(state.rounds)]
		if ((not round) or A.every(round.ties, function(t)
			return (t.hs ~= nil)
		end)) then
			do return state end
		end
		local played = A.map(round.ties, function(tie)
			if (tie.hs ~= nil) then
				do return tie end
			end
			local yours = ((tie.home == yourClub) or (tie.away == yourClub))
			local hStr = cupStrength(tie.home, league)
			local aStr = cupStrength(tie.away, league)
			local hs = nil
			local as = nil
			local out = Js.ospread(tie)
			if (yours and yourResult) then
				hs = yourResult.hs
				as = yourResult.as
				if yourResult.pens then
					out.pens = yourResult.pens
				end
				if yourResult.wentToExtraTime then
					out.wentToExtraTime = true
				end
				if yourResult.legs then
					out.legs = yourResult.legs
				end
			elseif isTwoLeggedRound(state.competition, round.name) then
				local l1 = tieScore(hStr, aStr, rng)
				local l2 = tieScore(aStr, hStr, rng)
				out.legs = Js.alit(Js.O({ hs = l1.hs, as = l1.as }, { "hs", "as" }), Js.O({ hs = l2.as, as = l2.hs }, { "hs", "as" }))
				hs = (l1.hs + l2.as)
				as = (l1.as + l2.hs)
			else
				local played90 = tieScore(hStr, aStr, rng)
				hs = played90.hs
				as = played90.as
				if ((hs == as) and M_shootout.hasExtraTime(state.competition, round.name)) then
					out.wentToExtraTime = true
					local et = M_shootout.extraTimeScore(hStr, aStr, rng)
					hs += et.hs
					as += et.as
				end
			end
			out.hs = hs
			out.as = as
			if ((hs == as) and (not out.pens)) then
				out.pens = shootout(hStr, aStr, rng)
			end
			do return out end
		end)
		local rounds = Js.aspread(A.slice(state.rounds, 0, -1), Js.alit(Js.ospread(round, Js.O({ ties = played }, { "ties" }))))
		local winners = A.filter(A.map(played, tieWinner), function(w)
			return (not (not Js.T(w)))
		end)
		local names = cupRoundNames(state)
		local nextName = names[Math.min(Js.alen(rounds), (Js.alen(names) - 1)) + 1]
		local joining = ((function() local _v = state.entries; if _v == nil then return nil end; _v = _v[nextName]; return _v end)() or Js.alit())
		local field = Js.aspread(winners, (if round.byes ~= nil then round.byes else Js.alit()), joining)
		if ((round.name == names[Js.alen(names)]) or (Js.alen(field) < 2)) then
			do return Js.ospread(state, Js.O({ rounds = rounds, winner = (if winners[1] ~= nil then winners[1] else field[1]) }, { "rounds", "winner" })) end
		end
		local entries = state.entries
		if (entries and Js.has(entries, nextName)) then
			entries = Js.ospread(entries)
			Js.del(entries, nextName)
		end
		do return Js.ospread(state, Js.O({ rounds = Js.aspread(rounds, Js.alit(drawEven(nextName, field, yourClub, rng))) }, { "rounds" }), (if entries then Js.O({ entries = entries }, { "entries" }) else Js.O({}, nil))) end
	end
	exports.playCupRound = playCupRound
	drawEven = function(name, field, yourClub, rng)
		if (math.fmod(Js.alen(field), 2) == 0) then
			do return drawRound(name, field, rng) end
		end
		local others = A.filter(field, function(c)
			return (c ~= yourClub)
		end)
		local bye = others[math.floor((rng() * Js.alen(others))) + 1]
		do return Js.ospread(drawRound(name, A.filter(field, function(c)
			return (c ~= bye)
		end), rng), Js.O({ byes = Js.alit(bye) }, { "byes" })) end
	end
	finishCupToWinner = function(state, league, yourClub, rng)
		local s = state
		local guardLimit = (Js.alen(cupRoundNames(state)) + 1)
		do
			local guard = 0
			local _first5 = true
			while true do
				if not _first5 then
					guard += 1
				end
				_first5 = false
				if not ((guard < guardLimit) and (not Js.T(s.winner))) then break end
				local next_ = playCupRound(s, league, yourClub, nil, rng)
				if (next_ == s) then
					do break end
				end
				s = next_
			end
		end
		do return s end
	end
	exports.finishCupToWinner = finishCupToWinner
	currentRound = function(state)
		do return (state.rounds[Js.alen(state.rounds)] or nil) end
	end
	exports.currentRound = currentRound
	yourTie = function(state, club)
		local round = currentRound(state)
		if (not round) then
			do return nil end
		end
		do return (A.find(round.ties, function(t)
			return ((t.home == club) or (t.away == club))
		end) or nil) end
	end
	exports.yourTie = yourTie
	hasBye = function(state, club)
		if Js.T(state.winner) then
			do return false end
		end
		do return (not (not (function() local _r = (function() local _v = currentRound(state); if _v == nil then return nil end; _v = _v.byes; return _v end)(); if _r == nil then return nil end; return A.includes(_r, club) end)())) end
	end
	exports.hasBye = hasBye
	stillIn = function(state, club)
		if Js.T(state.winner) then
			do return (state.winner == club) end
		end
		if (yourTie(state, club) ~= nil) then
			do return true end
		end
		if hasBye(state, club) then
			do return true end
		end
		do return A.some(Js.Object.values((if state.entries ~= nil then state.entries else Js.O({}, nil))), function(list)
			return A.includes(list, club)
		end) end
	end
	exports.stillIn = stillIn
	awaitsYourTie = function(state, club)
		if Js.T(state.winner) then
			do return false end
		end
		local tie = yourTie(state, club)
		do return ((not (not tie)) and (tie.hs == nil)) end
	end
	exports.awaitsYourTie = awaitsYourTie
	yourEntryRound = function(state, club)
		do
			local _arr6 = Js.Object.entries((if state.entries ~= nil then state.entries else Js.O({}, nil)))
			local _i7 = 0
			while _i7 < Js.alen(_arr6) do
				_i7 += 1
				local _e8 = _arr6[_i7]
				local round = _e8[1]
				local list = _e8[2]
				if A.includes(list, club) then
					do return round end
				end
			end
		end
		do return nil end
	end
	exports.yourEntryRound = yourEntryRound
	exitRound = function(state, club)
		do
			local _arr9 = state.rounds
			local _i10 = 0
			while _i10 < Js.alen(_arr9) do
				_i10 += 1
				local round = _arr9[_i10]
				local tie = A.find(round.ties, function(t)
					return ((t.home == club) or (t.away == club))
				end)
				if (not tie) then
					do continue end
				end
				local w = tieWinner(tie)
				if (Js.T(w) and (w ~= club)) then
					do return round.name end
				end
			end
		end
		do return nil end
	end
	exports.exitRound = exitRound
	CUP_ROUND_NAMES = Js.alit("Round of 32", "Round of 16", "Quarter-Final", "Semi-Final", "Final")
	exports.CUP_ROUND_NAMES = CUP_ROUND_NAMES
	FA_CUP_ROUND_NAMES = Js.alit("Third Qualifying Round", "Fourth Qualifying Round", "First Round", "Second Round", "Third Round", "Fourth Round", "Fifth Round", "Quarter-Final", "Semi-Final", "Final")
	exports.FA_CUP_ROUND_NAMES = FA_CUP_ROUND_NAMES
	LOWER_LEAGUE_TROPHY_ROUND_NAMES = Js.alit("Round 1", "Round of 64", "Round of 32", "Round of 16", "Quarter-Final", "Semi-Final", "Final")
	exports.LOWER_LEAGUE_TROPHY_ROUND_NAMES = LOWER_LEAGUE_TROPHY_ROUND_NAMES
	FA_CUP_ROUND_NAMES_V1 = Js.alit("Round of 64", "Round of 32", "Round of 16", "Quarter-Final", "Semi-Final", "Final")
	exports.FA_CUP_ROUND_NAMES_V1 = FA_CUP_ROUND_NAMES_V1
	CUP_FIELD = 32
	exports.CUP_FIELD = CUP_FIELD
	FA_CUP_FIELD = 64
	exports.FA_CUP_FIELD = FA_CUP_FIELD
	FA_QUALIFIERS = 40
	exports.FA_QUALIFIERS = FA_QUALIFIERS
end
