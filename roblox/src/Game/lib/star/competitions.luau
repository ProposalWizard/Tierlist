--!nocheck
--!nolint
-- Generated from lib/star/competitions.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_calendar = import("lib/star/calendar")
	local M_holders = import("lib/star/world/holders")
	local M_season = import("lib/star/season")
	local M_euro = import("lib/star/euro")
	local M_cups = import("lib/star/cups")
	local M_index = import("lib/star/world/index")
	local M_fame = import("lib/star/fame")
	local M_lowerLeagueTrophy = import("lib/star/lowerLeagueTrophy")
	local M_promotion = import("lib/star/promotion")
	local M_euroBracket = import("lib/star/euroBracket")
	local M_qualification = import("lib/star/qualification")
	local EUROPEAN_CLUBS, NATIONS, CUP_ROUNDS, EURO_ROUNDS, TOURNAMENT_ROUNDS, GROUP_STAGE, roundsFor, leagueWeeks, roundWeeks, seedPreSeason, seedEurope, euroTieFixture, leaguePosition, internationalCallUp, tournamentFor, pickOpponent, makeRoundFixture, seedSeasonKnockouts, resolveKnockout, nationOf, nextFixtureFor, byFixtureDate, fixtureLabel, COMPETITION_ABBREV, DIVISION_ABBREV, competitionAbbrev, seedCups, faCupEntrantsFor, newCupFixtures, cupSlotsFor, roundsOf, cupRoundWeek, cupSecondLegWeek, cupFixtureFor, secondLegFixture, settleCupTie, advanceEliminatedCups, cupFixturesOwed, settleEuro, euroStrength, result, ordinalOf
	roundsFor = function(competition)
		if (competition == "FA Cup") then
			do return CUP_ROUNDS end
		end
		if ((competition == "World Cup") or (competition == "European Championship")) then
			do return TOURNAMENT_ROUNDS end
		end
		do return EURO_ROUNDS end
	end
	exports.roundsFor = roundsFor
	leagueWeeks = function(clubCount)
		do return Math.max(2, ((clubCount - 1) * 2)) end
	end
	exports.leagueWeeks = leagueWeeks
	roundWeeks = function(kind, rounds, clubCount, division)
		if division == nil then division = "premier" end
		local lw = leagueWeeks(clubCount)
		if (kind == "international") then
			local weeks = M_calendar.tournamentWeeksFor(division)
			do return Js.Array.from(Js.O({ length = rounds }, { "length" }), function(_, i)
				return (if weeks[i + 1] ~= nil then weeks[i + 1] else ((lw + 1) + i))
			end) end
		end
		local offset = (if (kind == "europe") then 1 else 0)
		do return Js.Array.from(Js.O({ length = rounds }, { "length" }), function(_, i)
			return Math.max(2, Math.min(lw, (Math.round((lw * (0.3 + (0.2 * i)))) + offset)))
		end) end
	end
	seedPreSeason = function(career)
		local w = (if (career.season <= 1) then Js.ospread(M_holders.SEASON_ONE_HOLDERS) else career.lastSeasonWinners)
		if (not w) then
			do return Js.alit() end
		end
		local rng = M_season.mulberry32(((career.season * 3301) + Js.alen(career.league)))
		local fixtures = Js.alit()
		local club = career.player.club
		local strengthOf = function(name)
			local inLeague = A.find(career.league, function(t)
				return (t.name == name)
			end)
			if inLeague then
				do return inLeague.strength end
			end
			local inEurope = A.find(Js.aspread(M_euro.poolFor("Champions League"), M_euro.poolFor("Europa League")), function(c)
				return (c.name == name)
			end)
			do return Math.round(((function() local _v = inEurope; if _v == nil then return nil end; _v = _v.strength; return _v end)() or M_cups.cupStrength(name, M_index.ratedTeams(career)))) end
		end
		local plChampion = (if w.premierLeague ~= nil then w.premierLeague else w.league)
		local plRunnerUp = (if Js.T(w.premierLeague) then w.premierLeagueRunnerUp else w.leagueRunnerUp)
		if (Js.T(plChampion) and Js.T(w.faCup)) then
			local champion = (if (plChampion == w.faCup) then (if plRunnerUp ~= nil then plRunnerUp else plChampion) else plChampion)
			local cupHolder = w.faCup
			if ((champion == club) or (cupHolder == club)) then
				local opponent = (if (champion == club) then cupHolder else champion)
				A.push(fixtures, Js.O({ week = M_calendar.PRE_SEASON_WEEK, opponent = opponent, home = (rng() < 0.5), played = false, competition = "Community Shield", kind = "cup", round = "Final", opponentStrength = strengthOf(opponent) }, { "week", "opponent", "home", "played", "competition", "kind", "round", "opponentStrength" }))
			end
		end
		if (Js.T(w.championsLeague) and Js.T(w.europaLeague)) then
			local clWinner = w.championsLeague
			local elWinner = w.europaLeague
			if ((clWinner == club) or (elWinner == club)) then
				local opponent = (if (clWinner == club) then elWinner else clWinner)
				A.push(fixtures, Js.O({ week = M_calendar.PRE_SEASON_WEEK, opponent = opponent, home = false, played = false, competition = "Super Cup", kind = "europe", round = "Final", opponentStrength = strengthOf(opponent) }, { "week", "opponent", "home", "played", "competition", "kind", "round", "opponentStrength" }))
			end
		end
		do return fixtures end
	end
	exports.seedPreSeason = seedPreSeason
	seedEurope = function(career)
		local competition = career.europeanQualification
		if ((competition ~= "Champions League") and (competition ~= "Europa League")) then
			do return Js.O({ state = nil, fixtures = Js.alit() }, { "state", "fixtures" }) end
		end
		local rng = M_season.mulberry32(((career.season * 5441) + (Js.alen(career.league) * 7)))
		local mine = A.find(career.league, function(t)
			return (t.name == career.player.club)
		end)
		local finish = (if career.lastSeasonPosition ~= nil then career.lastSeasonPosition else 4)
		local state = M_euro.openEuro(competition, career.player.club, ((function() local _v = mine; if _v == nil then return nil end; _v = _v.strength; return _v end)() or 75), finish, rng, career)
		local fixtures = A.map(state.leaguePhase, function(m, i)
			return Js.O({ week = (if M_calendar.EURO_LEAGUE_PHASE_WEEKS[i + 1] ~= nil then M_calendar.EURO_LEAGUE_PHASE_WEEKS[i + 1] else (5 + (i * 2))), opponent = m.opponent, home = m.home, played = false, competition = competition, kind = "europe", round = ("League Phase · MD" .. Js.numstr((i + 1))), opponentStrength = ((function() local _v = A.find(state.clubs, function(c)
				return (c.name == m.opponent)
			end); if _v == nil then return nil end; _v = _v.strength; return _v end)() or 78) }, { "week", "opponent", "home", "played", "competition", "kind", "round", "opponentStrength" })
		end)
		do return Js.O({ state = state, fixtures = fixtures }, { "state", "fixtures" }) end
	end
	exports.seedEurope = seedEurope
	euroTieFixture = function(state, career, tie, legIndex)
		local position = (if state.position ~= nil then state.position else 24)
		local slots = M_euro.knockoutSlots(position)
		local slot = A.find(slots, function(s)
			return ((s.round == tie.round) and ((if s.leg ~= nil then s.leg else 1) == (legIndex + 1)))
		end)
		if (not slot) then
			do return nil end
		end
		local leg = tie.legs[legIndex + 1]
		do return Js.O({ week = slot.week, opponent = tie.opponent, home = (function() local _l = (function() local _v = leg; if _v == nil then return nil end; _v = _v.home; return _v end)(); if _l ~= nil then return _l end; return false end)(), played = false, competition = state.competition, kind = "europe", round = (if (Js.alen(tie.legs) > 1) then (tie.round .. " · Leg " .. Js.numstr((legIndex + 1))) else tie.round), opponentStrength = tie.opponentStrength }, { "week", "opponent", "home", "played", "competition", "kind", "round", "opponentStrength" }) end
	end
	exports.euroTieFixture = euroTieFixture
	leaguePosition = function(career)
		do return (A.findIndex(M_season.sortLeague(career.league), function(t)
			return (t.name == career.player.club)
		end) + 1) end
	end
	exports.leaguePosition = leaguePosition
	internationalCallUp = function(career)
		local form = (if Js.T(Js.alen(career.form)) then (A.reduce(career.form, function(s, r)
			return (s + r)
		end, 0) / Js.alen(career.form)) else 6.5)
		do return (((career.starRating >= 3) or (M_fame.fameOf(career) >= 40)) or ((career.starRating >= 2.6) and (form >= 7.6))) end
	end
	exports.internationalCallUp = internationalCallUp
	tournamentFor = function(season)
		if (math.fmod(season, 2) ~= 0) then
			do return nil end
		end
		do return (if (math.fmod(season, 4) == 0) then "World Cup" else "European Championship") end
	end
	exports.tournamentFor = tournamentFor
	pickOpponent = function(kind, career, rng)
		if (kind == "cup") then
			local others = A.filter(career.league, function(t)
				return (t.name ~= career.player.club)
			end)
			local t = others[math.floor((rng() * Js.alen(others))) + 1]
			do return Js.O({ opponent = ((function() local _v = t; if _v == nil then return nil end; _v = _v.name; return _v end)() or "Non-League XI"), strength = ((function() local _v = t; if _v == nil then return nil end; _v = _v.strength; return _v end)() or 55) }, { "opponent", "strength" }) end
		end
		local pool = (if (kind == "europe") then EUROPEAN_CLUBS else NATIONS)
		local _d1 = pool[math.floor((rng() * Js.alen(pool))) + 1]
		local name = _d1[1]
		local strength = _d1[2]
		do return Js.O({ opponent = name, strength = strength }, { "opponent", "strength" }) end
	end
	makeRoundFixture = function(run, career, week, rng)
		local _d2 = pickOpponent(run.kind, career, rng)
		local opponent = _d2.opponent
		local strength = _d2.strength
		do return Js.O({ week = week, opponent = opponent, home = (rng() < 0.5), played = false, competition = run.competition, kind = run.kind, round = roundsFor(run.competition)[run.roundIndex + 1], opponentStrength = strength }, { "week", "opponent", "home", "played", "competition", "kind", "round", "opponentStrength" }) end
	end
	seedSeasonKnockouts = function(career)
		local runs = Js.alit()
		local fixtures = Js.alit()
		A.push(fixtures, Js.unpack(seedPreSeason(career)))
		do return Js.O({ runs = runs, fixtures = fixtures }, { "runs", "fixtures" }) end
	end
	exports.seedSeasonKnockouts = seedSeasonKnockouts
	resolveKnockout = function(career, run, fixture, userScore, oppScore)
		local rounds = roundsFor(run.competition)
		local roundName = (if rounds[run.roundIndex + 1] ~= nil then rounds[run.roundIndex + 1] else "Final")
		local isFinal = (run.roundIndex >= (Js.alen(rounds) - 1))
		local rng = M_season.mulberry32((((career.season * 131) + (fixture.week * 17)) + run.roundIndex))
		local advanced = (userScore > oppScore)
		local onPenalties = false
		if ((userScore == oppScore) and (roundName == GROUP_STAGE)) then
			advanced = true
		elseif (userScore == oppScore) then
			onPenalties = true
			local mine = ((function() local _v = A.find(career.league, function(t)
				return (t.name == career.player.club)
			end); if _v == nil then return nil end; _v = _v.strength; return _v end)() or 65)
			local theirs = (if fixture.opponentStrength ~= nil then fixture.opponentStrength else 70)
			advanced = (rng() < Math.max(0.3, Math.min(0.7, (0.5 + ((mine - theirs) / 200)))))
		end
		local side = (if (run.kind == "international") then nationOf(career) else career.player.club)
		if (not advanced) then
			do return Js.O({ run = Js.ospread(run, Js.O({ eliminated = true }, { "eliminated" })), nextFixture = nil, trophy = nil, onPenalties = onPenalties, advanced = false, message = (if onPenalties then ("Out of the " .. run.competition .. " on penalties in the " .. roundName .. ".") else ("Knocked out of the " .. run.competition .. " in the " .. roundName .. ".")) }, { "run", "nextFixture", "trophy", "onPenalties", "advanced", "message" }) end
		end
		if isFinal then
			do return Js.O({ run = Js.ospread(run, Js.O({ won = true, eliminated = true }, { "won", "eliminated" })), nextFixture = nil, trophy = Js.O({ season = career.season, competition = run.competition, club = side }, { "season", "competition", "club" }), onPenalties = onPenalties, advanced = true, message = (if onPenalties then ("🏆 " .. run.competition .. " winners — on penalties!") else ("🏆 " .. run.competition .. " winners!")) }, { "run", "nextFixture", "trophy", "onPenalties", "advanced", "message" }) end
		end
		local nextRun = Js.ospread(run, Js.O({ roundIndex = (run.roundIndex + 1) }, { "roundIndex" }))
		local weeks = roundWeeks(run.kind, Js.alen(rounds), Js.alen(career.league), M_calendar.divisionOf(career))
		local nextRng = M_season.mulberry32((((career.season * 977) + (run.roundIndex * 31)) + fixture.week))
		do return Js.O({ run = nextRun, nextFixture = makeRoundFixture(nextRun, career, weeks[nextRun.roundIndex + 1], nextRng), trophy = nil, onPenalties = onPenalties, advanced = true, message = (if onPenalties then ("Through to the " .. rounds[nextRun.roundIndex + 1] .. " on penalties.") else (if ((roundName == GROUP_STAGE) and (userScore == oppScore)) then ("A point is enough — into the " .. rounds[nextRun.roundIndex + 1] .. ".") else ("Into the " .. rounds[nextRun.roundIndex + 1] .. "."))) }, { "run", "nextFixture", "trophy", "onPenalties", "advanced", "message" }) end
	end
	exports.resolveKnockout = resolveKnockout
	nationOf = function(career)
		do return (if Js.T(career.player.nationality) then career.player.nationality else "England") end
	end
	exports.nationOf = nationOf
	nextFixtureFor = function(career)
		local division = M_calendar.divisionOf(career)
		local best = nil
		local bestTime = math.huge
		do
			local _arr3 = career.fixtures
			local _i4 = 0
			while _i4 < Js.alen(_arr3) do
				_i4 += 1
				local f = _arr3[_i4]
				if f.played then
					do continue end
				end
				local t = M_calendar.fixtureTimestamp(career.player.startYear, career.season, f.week, f.kind, division)
				if (t < bestTime) then
					bestTime = t
					best = f
				end
			end
		end
		do return best end
	end
	exports.nextFixtureFor = nextFixtureFor
	byFixtureDate = function(career)
		local division = M_calendar.divisionOf(career)
		local t = function(f)
			return M_calendar.fixtureTimestamp(career.player.startYear, career.season, f.week, f.kind, division)
		end
		do return function(a, b)
			return (t(a) - t(b))
		end end
	end
	exports.byFixtureDate = byFixtureDate
	fixtureLabel = function(f)
		if ((not Js.T(f.kind)) or (f.kind == "league")) then
			do return "League" end
		end
		do return (if Js.T(f.round) then (Js.str(f.competition) .. " · " .. f.round) else (if f.competition ~= nil then f.competition else "Cup")) end
	end
	exports.fixtureLabel = fixtureLabel
	competitionAbbrev = function(f, division)
		if ((not Js.T(f.kind)) or (f.kind == "league")) then
			do return DIVISION_ABBREV[division] end
		end
		do return (function() local _l = (if Js.T(f.competition) then COMPETITION_ABBREV[f.competition] else f.competition); if Js.T(_l) then return _l end; return "Cup" end)() end
	end
	exports.competitionAbbrev = competitionAbbrev
	seedCups = function(career, opts)
		if opts == nil then opts = Js.O({}, nil) end
		local rng = M_season.mulberry32(((career.season * 6151) + (Js.alen(career.league) * 13)))
		local division = M_calendar.divisionOf(career)
		local states = Js.aspread((if (Js.alen(M_calendar.leagueCupSlotsFor(division)) > 0) then Js.alit(M_cups.openCup("League Cup", career.league, division, rng)) else Js.alit()), Js.alit(M_cups.openFaCup(faCupEntrantsFor(career), career.player.club, rng), M_lowerLeagueTrophy.openLowerLeagueTrophy(career, M_season.mulberry32(((career.season * 7919) + 101)), opts.leagueOneOrder)))
		local fixtures = Js.alit()
		do
			local _arr5 = states
			local _i6 = 0
			while _i6 < Js.alen(_arr5) do
				_i6 += 1
				local st = _arr5[_i6]
				local f = cupFixtureFor(st, career, 0)
				if f then
					A.push(fixtures, f)
				end
			end
		end
		do return Js.O({ states = states, fixtures = fixtures }, { "states", "fixtures" }) end
	end
	exports.seedCups = seedCups
	faCupEntrantsFor = function(career)
		local m = M_promotion.membershipOf(career)
		local last = (if (career.lastWorld and (career.lastWorld.season == (career.season - 1))) then career.lastWorld else nil)
		local posIn = function(division, club)
			local t = (function() local _r = (function() local _v = last; if _v == nil then return nil end; _v = _v.tables; return _v end)(); if _r == nil then return nil end; return A.find(_r, function(x)
				return (x.division == division)
			end) end)()
			do return (if t then A.findIndex(t.rows, function(r)
				return (r.name == club)
			end) else -1) end
		end
		local rating = Js.Map.new(A.map(M_index.ratedTeams(career), function(t)
			return Js.alit(t.name, t.strength)
		end))
		local rank = function(division, step3)
			return function(club)
				if A.includes(step3, club) then
					do return (3000 - (rating:get(club) or 0)) end
				end
				if last then
					local fromAbove = posIn("national_league", club)
					if (fromAbove >= 0) then
						do return fromAbove end
					end
					local here = posIn(division, club)
					if (here >= 0) then
						do return (100 + here) end
					end
					do return (2000 - (rating:get(club) or 0)) end
				end
				do return (1000 - (rating:get(club) or 0)) end
			end
		end
		local ordered = function(division, clubs, step3)
			local key = rank(division, step3)
			do return A.map(A.sort(A.map(Js.aspread(clubs, step3), function(c)
				return Js.O({ c = c, k = key(c) }, { "c", "k" })
			end), function(a, b)
				return (a.k - b.k)
			end), function(x)
				return x.c
			end) end
		end
		do return Js.O({ north = ordered("national_league_north", m.nationalLeagueNorth, m.step3North), south = ordered("national_league_south", m.nationalLeagueSouth, m.step3South), nationalLeague = Js.aspread(m.nationalLeague), footballLeague = Js.aspread(m.leagueOne, m.leagueTwo), topTwo = Js.aspread(m.premier, m.championship) }, { "north", "south", "nationalLeague", "footballLeague", "topTwo" }) end
	end
	exports.faCupEntrantsFor = faCupEntrantsFor
	newCupFixtures = function(career, states)
		local out = Js.alit()
		do
			local _arr7 = states
			local _i8 = 0
			while _i8 < Js.alen(_arr7) do
				_i8 += 1
				local st = _arr7[_i8]
				if (not M_cups.awaitsYourTie(st, career.player.club)) then
					do continue end
				end
				local round = (function() local _v = M_cups.currentRound(st); if _v == nil then return nil end; _v = _v.name; return _v end)()
				local has = A.some(career.fixtures, function(f)
					return ((((not f.played) and (f.kind == "cup")) and (f.competition == st.competition)) and (f.round == round))
				end)
				if has then
					do continue end
				end
				local f = cupFixtureFor(st, career, (Js.alen(st.rounds) - 1))
				if f then
					A.push(out, f)
				end
			end
		end
		do return out end
	end
	exports.newCupFixtures = newCupFixtures
	cupSlotsFor = function(competition, division, inEurope)
		if inEurope == nil then inEurope = false end
		if (competition == "Lower League Trophy") then
			do return M_calendar.lowerLeagueTrophySlotsFor(division) end
		end
		do return (if (competition == "League Cup") then M_calendar.leagueCupSlotsFor(division, inEurope) else M_calendar.faCupSlotsFor(division, inEurope)) end
	end
	roundsOf = function(slots)
		local byRound = Js.alit()
		do
			local _arr9 = slots
			local _i10 = 0
			while _i10 < Js.alen(_arr9) do
				_i10 += 1
				local s = _arr9[_i10]
				if (not A.includes(byRound, s.round)) then
					A.push(byRound, s.round)
				end
			end
		end
		do return byRound end
	end
	cupRoundWeek = function(competition, roundIndex, _clubCount, division, inEurope, roundName)
		if division == nil then division = "premier" end
		if inEurope == nil then inEurope = false end
		if ((competition == "FA Cup") and Js.T(roundName)) then
			local slot = (A.find(M_calendar.faCupSlotsFor(division, inEurope), function(s)
				return (s.round == roundName)
			end) or A.find(M_calendar.faCupSlotsV1For(division, inEurope), function(s)
				return (s.round == roundName)
			end))
			if slot then
				do return slot.week end
			end
		end
		local slots = cupSlotsFor(competition, division, inEurope)
		local byRound = roundsOf(slots)
		local round = byRound[Math.min(roundIndex, (Js.alen(byRound) - 1)) + 1]
		local slot = A.find(slots, function(s)
			return (s.round == round)
		end)
		do return ((function() local _v = slot; if _v == nil then return nil end; _v = _v.week; return _v end)() or (3 + (roundIndex * 6))) end
	end
	exports.cupRoundWeek = cupRoundWeek
	cupSecondLegWeek = function(competition, roundIndex, division, inEurope)
		if division == nil then division = "premier" end
		if inEurope == nil then inEurope = false end
		local slots = cupSlotsFor(competition, division, inEurope)
		local byRound = roundsOf(slots)
		local round = byRound[Math.min(roundIndex, (Js.alen(byRound) - 1)) + 1]
		do return ((function() local _v = A.find(slots, function(s)
			return ((s.round == round) and (s.leg == 2))
		end); if _v == nil then return nil end; _v = _v.week; return _v end)() or nil) end
	end
	exports.cupSecondLegWeek = cupSecondLegWeek
	cupFixtureFor = function(state, career, roundIndex)
		local tie = M_cups.yourTie(state, career.player.club)
		if ((not tie) or (tie.hs ~= nil)) then
			do return nil end
		end
		local home = (tie.home == career.player.club)
		local opponent = (if home then tie.away else tie.home)
		local inEurope = ((career.europeanQualification == "Champions League") or (career.europeanQualification == "Europa League"))
		local round = (function() local _v = M_cups.currentRound(state); if _v == nil then return nil end; _v = _v.name; return _v end)()
		do return Js.ospread(Js.O({ week = cupRoundWeek(state.competition, roundIndex, Js.alen(career.league), M_calendar.divisionOf(career), inEurope, round), opponent = opponent, home = home, played = false, competition = state.competition, kind = "cup", round = round }, { "week", "opponent", "home", "played", "competition", "kind", "round" }), (if (Js.T(round) and M_cups.isTwoLeggedRound(state.competition, round)) then Js.O({ leg = 1 }, { "leg" }) else Js.O({}, nil)), Js.O({ opponentStrength = Math.round(M_cups.cupStrength(opponent, M_index.ratedTeams(career))) }, { "opponentStrength" })) end
	end
	exports.cupFixtureFor = cupFixtureFor
	secondLegFixture = function(state, career, firstLeg)
		local roundIndex = (Js.alen(state.rounds) - 1)
		local division = M_calendar.divisionOf(career)
		local inEurope = ((career.europeanQualification == "Champions League") or (career.europeanQualification == "Europa League"))
		local slot = (cupSecondLegWeek(state.competition, roundIndex, division, inEurope) or (firstLeg.week + 3))
		do return Js.ospread(firstLeg, Js.O({ week = Math.max(slot, (firstLeg.week + 1)), home = (not firstLeg.home), played = false, leg = 2, homeScore = nil, awayScore = nil, userGoals = nil, userAssists = nil, userRating = nil }, { "week", "home", "played", "leg", "homeScore", "awayScore", "userGoals", "userAssists", "userRating" })) end
	end
	settleCupTie = function(career, fixture, userScore, oppScore, wentToExtraTime, livePens)
		local states = (if career.cupState ~= nil then career.cupState else Js.alit())
		local idx = A.findIndex(states, function(st)
			return ((st.competition == fixture.competition) and (not Js.T(st.winner)))
		end)
		if (idx < 0) then
			do return nil end
		end
		local club = career.player.club
		local before = states[idx + 1]
		local roundName = ((function() local _v = M_cups.currentRound(before); if _v == nil then return nil end; _v = _v.name; return _v end)() or M_cups.cupRoundNames(before)[1])
		local rng = M_season.mulberry32((((career.season * 977) + (fixture.week * 31)) + (idx * 7)))
		local hs = (if fixture.home then userScore else oppScore)
		local as = (if fixture.home then oppScore else userScore)
		local legs = nil
		local pens = livePens
		local yourCupTie = (function() local _r = (function() local _v = before.rounds[Js.alen(before.rounds)]; if _v == nil then return nil end; _v = _v.ties; return _v end)(); if _r == nil then return nil end; return A.find(_r, function(t)
			return ((t.home == club) or (t.away == club))
		end) end)()
		if (Js.T(fixture.leg) and yourCupTie) then
			local youTieHome = (yourCupTie.home == club)
			local leg = Js.O({ hs = (if youTieHome then userScore else oppScore), as = (if youTieHome then oppScore else userScore) }, { "hs", "as" })
			if (fixture.leg == 1) then
				local withLeg = Js.ospread(before, Js.O({ rounds = A.map(before.rounds, function(r, i)
					return (if (i == (Js.alen(before.rounds) - 1)) then Js.ospread(r, Js.O({ ties = A.map(r.ties, function(t)
						return (if (t == yourCupTie) then Js.ospread(t, Js.O({ legs = Js.alit(leg) }, { "legs" })) else t)
					end) }, { "ties" })) else r)
				end) }, { "rounds" }))
				do return Js.O({ states = A.map(states, function(st, i)
					return (if (i == idx) then withLeg else st)
				end), nextFixture = secondLegFixture(withLeg, career, fixture), trophy = nil, message = (Js.numstr(userScore) .. "-" .. Js.numstr(oppScore) .. " in the first leg of the " .. Js.str(fixture.competition) .. " semi-final. It is settled in the second.") }, { "states", "nextFixture", "trophy", "message" }) end
			end
			legs = Js.aspread(A.slice((if yourCupTie.legs ~= nil then yourCupTie.legs else Js.alit()), 0, 1), Js.alit(leg))
			hs = A.reduce(legs, function(s, l)
				return (s + l.hs)
			end, 0)
			as = A.reduce(legs, function(s, l)
				return (s + l.as)
			end, 0)
			pens = (livePens and (if (fixture.home == youTieHome) then livePens else Js.O({ home = livePens.away, away = livePens.home }, { "home", "away" })))
		end
		local after = M_cups.playCupRound(before, M_index.ratedTeams(career), club, Js.O({ hs = hs, as = as, pens = pens, wentToExtraTime = wentToExtraTime, legs = legs }, { "hs", "as", "pens", "wentToExtraTime", "legs" }), rng)
		local next_ = A.map(states, function(st, i)
			return (if (i == idx) then after else st)
		end)
		local tie = (function() local _r = (function() local _v = before.rounds[Js.alen(before.rounds)]; if _v == nil then return nil end; _v = _v.ties; return _v end)(); if _r == nil then return nil end; return A.find(_r, function(t)
			return ((t.home == club) or (t.away == club))
		end) end)()
		local played = (function() local _r = (function() local _v = after.rounds[Js.alen(before.rounds)]; if _v == nil then return nil end; _v = _v.ties; return _v end)(); if _r == nil then return nil end; return A.find(_r, function(t)
			return ((t.home == club) or (t.away == club))
		end) end)()
		local won = (if played then (M_cups.tieWinner(played) == club) else false)
		local onPens = ((function() local _v = played; if _v == nil then return nil end; _v = _v.pens; return _v end)() ~= nil)
		local agg = (if legs then (" (" .. (if (played and (played.home == club)) then (Js.str(played.hs) .. "-" .. Js.str(played.as)) else (Js.str((function() local _v = played; if _v == nil then return nil end; _v = _v.as; return _v end)()) .. "-" .. Js.str((function() local _v = played; if _v == nil then return nil end; _v = _v.hs; return _v end)()))) .. " on aggregate)") else "")
		local opponent = (if tie then (if (tie.home == club) then tie.away else tie.home) else fixture.opponent)
		if (not won) then
			do return Js.O({ states = A.map(states, function(st, i)
				return (if (i == idx) then after else st)
			end), nextFixture = nil, trophy = nil, message = (if onPens then ("Out of the " .. Js.str(fixture.competition) .. " on penalties, beaten by " .. opponent .. " in the " .. roundName .. ".") else ("Out of the " .. Js.str(fixture.competition) .. " — " .. opponent .. " win the " .. roundName .. " tie" .. agg .. ".")) }, { "states", "nextFixture", "trophy", "message" }) end
		end
		if (after.winner == club) then
			do return Js.O({ states = next_, nextFixture = nil, trophy = Js.O({ season = career.season, competition = Js.str(fixture.competition), club = club }, { "season", "competition", "club" }), message = (club .. " win the " .. Js.str(fixture.competition) .. "!" .. (if onPens then " On penalties." else "")) }, { "states", "nextFixture", "trophy", "message" }) end
		end
		local roundIndex = (Js.alen(after.rounds) - 1)
		do return Js.O({ states = next_, nextFixture = cupFixtureFor(after, career, roundIndex), trophy = nil, message = ("Through to the " .. Js.str((function() local _v = M_cups.currentRound(after); if _v == nil then return nil end; _v = _v.name; return _v end)()) .. (if onPens then ", on penalties" else agg) .. ".") }, { "states", "nextFixture", "trophy", "message" }) end
	end
	exports.settleCupTie = settleCupTie
	advanceEliminatedCups = function(career, uptoTimestamp, rng)
		local states = (if career.cupState ~= nil then career.cupState else Js.alit())
		if (Js.alen(states) == 0) then
			do return states end
		end
		local division = M_calendar.divisionOf(career)
		local club = career.player.club
		local changed = false
		local next_ = A.map(states, function(state)
			if Js.T(state.winner) then
				do return state end
			end
			local tied = (((not (not career.cupTied)) and (career.cupTied.season == career.season)) and A.includes(career.cupTied.competitions, state.competition))
			if (M_cups.awaitsYourTie(state, club) and (not tied)) then
				do return state end
			end
			local s = state
			local guardLimit = (Js.alen(M_cups.cupRoundNames(s)) + 1)
			do
				local guard = 0
				local _first11 = true
				while true do
					if not _first11 then
						guard += 1
					end
					_first11 = false
					if not ((guard < guardLimit) and (not Js.T(s.winner))) then break end
					local roundIndex = (Js.alen(s.rounds) - 1)
					local roundWeek = cupRoundWeek(s.competition, roundIndex, Js.alen(career.league), division, false, (function() local _v = M_cups.currentRound(s); if _v == nil then return nil end; _v = _v.name; return _v end)())
					local roundTs = M_calendar.fixtureTimestamp(career.player.startYear, career.season, roundWeek, "cup", division)
					if (roundTs > uptoTimestamp) then
						do break end
					end
					local played = M_cups.playCupRound(s, M_index.ratedTeams(career), club, nil, rng)
					if (played == s) then
						do break end
					end
					s = played
					changed = true
					if ((not tied) and M_cups.awaitsYourTie(s, club)) then
						do break end
					end
				end
			end
			do return s end
		end)
		do return (if changed then next_ else states) end
	end
	exports.advanceEliminatedCups = advanceEliminatedCups
	cupFixturesOwed = function(career, states)
		local club = career.player.club
		local out = Js.alit()
		do
			local _arr12 = states
			local _i13 = 0
			while _i13 < Js.alen(_arr12) do
				_i13 += 1
				local st = _arr12[_i13]
				if Js.T(st.winner) then
					do continue end
				end
				local tied = (((not (not career.cupTied)) and (career.cupTied.season == career.season)) and A.includes(career.cupTied.competitions, st.competition))
				if tied then
					do continue end
				end
				local before = st.rounds[(Js.alen(st.rounds) - 2) + 1]
				if (not (function() local _r = (function() local _v = before; if _v == nil then return nil end; _v = _v.byes; return _v end)(); if _r == nil then return nil end; return A.includes(_r, club) end)()) then
					do continue end
				end
				local tie = M_cups.yourTie(st, club)
				if ((not tie) or (tie.hs ~= nil)) then
					do continue end
				end
				local pending = A.some(career.fixtures, function(f)
					return (((not f.played) and (f.kind == "cup")) and (f.competition == st.competition))
				end)
				if pending then
					do continue end
				end
				local f = cupFixtureFor(st, career, (Js.alen(st.rounds) - 1))
				if f then
					A.push(out, f)
				end
			end
		end
		do return out end
	end
	exports.cupFixturesOwed = cupFixturesOwed
	settleEuro = function(career, fixture, userScore, oppScore, squads, userGoals, userOppGoals, livePens)
		local state = career.euroState
		if ((not state) or (fixture.kind ~= "europe")) then
			do return nil end
		end
		if (fixture.competition == "Super Cup") then
			do return nil end
		end
		if (fixture.competition ~= state.competition) then
			do return nil end
		end
		local yourStrength = ((function() local _v = A.find(career.league, function(t)
			return (t.name == career.player.club)
		end); if _v == nil then return nil end; _v = _v.strength; return _v end)() or 75)
		local rng = M_season.mulberry32(((((career.season * 8161) + (fixture.week * 29)) + (userScore * 7)) + oppScore))
		local mdIndex = A.findIndex(state.leaguePhase, function(m)
			return ((m.us == nil) and (m.opponent == fixture.opponent))
		end)
		if (mdIndex >= 0) then
			local leaguePhase = A.map(state.leaguePhase, function(m, i)
				return (if (i == mdIndex) then Js.ospread(m, Js.O({ us = userScore, them = oppScore }, { "us", "them" })) else m)
			end)
			local next_ = M_euro.simulateEuroMatchday(Js.ospread(state, Js.O({ leaguePhase = leaguePhase }, { "leaguePhase" })), mdIndex, career.player.club, fixture.opponent, fixture.home, userScore, oppScore, rng, squads, userGoals, userOppGoals)
			if (not M_euro.leaguePhaseComplete(next_)) then
				local left = Js.alen(A.filter(leaguePhase, function(m)
					return (m.us == nil)
				end))
				do return Js.O({ state = next_, nextFixture = nil, trophy = nil, message = (result(userScore, oppScore) .. " in the " .. state.competition .. " league phase — " .. Js.numstr(left) .. " to play.") }, { "state", "nextFixture", "trophy", "message" }) end
			end
			local table_ = M_euro.sortEuro(next_.liveTable)
			local position = (A.findIndex(table_, function(r)
				return r.isYou
			end) + 1)
			local settled = Js.ospread(next_, Js.O({ table = table_, position = position }, { "table", "position" }))
			local opening = M_euro.firstRound(position)
			local str = euroStrength(settled, career.player.club, yourStrength)
			local bracket = M_euroBracket.advanceEuroBracket(M_euroBracket.openEuroBracket(A.map(table_, function(r)
				return r.name
			end), rng), career.player.club, str, M_euro.simulate, rng)
			if (not Js.T(opening)) then
				do return Js.O({ state = Js.ospread(settled, Js.O({ bracket = bracket, eliminated = true, winner = (if bracket.winner ~= nil then bracket.winner else M_euro.crownEurope(settled, ((career.season * 31) + 5))) }, { "bracket", "eliminated", "winner" })), nextFixture = nil, trophy = nil, message = (ordinalOf(position) .. " in the " .. state.competition .. " league phase. " .. M_euro.phaseVerdict(position)) }, { "state", "nextFixture", "trophy", "message" }) end
			end
			local tie = (M_euroBracket.euroTieFromBracket(bracket, career.player.club, str) or M_euro.drawTie(settled, opening, career.player.club, rng))
			local withTie = Js.ospread(settled, Js.O({ bracket = bracket, ties = Js.alit(tie) }, { "bracket", "ties" }))
			do return Js.O({ state = withTie, nextFixture = euroTieFixture(withTie, career, tie, 0), trophy = nil, message = (ordinalOf(position) .. " in the " .. state.competition .. " league phase. " .. M_euro.phaseVerdict(position)) }, { "state", "nextFixture", "trophy", "message" }) end
		end
		local tie = M_euro.currentTie(state)
		if (not tie) then
			do return nil end
		end
		local legIndex = (M_euro.currentLeg(state) or 0)
		local legs = A.map(tie.legs, function(l, i)
			return (if (i == legIndex) then Js.ospread(l, Js.O({ us = userScore, them = oppScore }, { "us", "them" })) else l)
		end)
		local played = Js.ospread(tie, Js.O({ legs = legs }, { "legs" }))
		if A.some(legs, function(l)
			return (l.us == nil)
		end) then
			local withLeg = Js.ospread(state, Js.O({ ties = A.map(state.ties, function(t, i)
				return (if (i == (Js.alen(state.ties) - 1)) then played else t)
			end) }, { "ties" }))
			local agg = (Js.str(legs[1].us) .. "-" .. Js.str(legs[1].them))
			do return Js.O({ state = withLeg, nextFixture = euroTieFixture(withLeg, career, played, (legIndex + 1)), trophy = nil, message = (agg .. " in the first leg. It is settled at " .. tie.opponent .. ".") }, { "state", "nextFixture", "trophy", "message" }) end
		end
		local decided = M_euro.settleTie(played, yourStrength, rng, livePens)
		local ties = A.map(state.ties, function(t, i)
			return (if (i == (Js.alen(state.ties) - 1)) then decided else t)
		end)
		local str = euroStrength(state, career.player.club, yourStrength)
		local bracket = (if state.bracket then M_euroBracket.settleYourKoTie(state.bracket, career.player.club, decided, str, M_euro.simulate, rng) else nil)
		local us = A.reduce(decided.legs, function(s, l)
			return (s + (if l.us ~= nil then l.us else 0))
		end, 0)
		local them = A.reduce(decided.legs, function(s, l)
			return (s + (if l.them ~= nil then l.them else 0))
		end, 0)
		local etNote = (if decided.wentToExtraTime then " after extra time" else "")
		local aggregate = (if (Js.alen(legs) > 1) then (" (" .. Js.numstr(us) .. "-" .. Js.numstr(them) .. " on aggregate" .. etNote .. ")") else etNote)
		if (decided.result == "L") then
			local out = Js.ospread(state, Js.O({ ties = ties, bracket = bracket, eliminated = true, winner = ((function() local _v = bracket; if _v == nil then return nil end; _v = _v.winner; return _v end)() or M_euro.crownEurope(Js.ospread(state, Js.O({ ties = ties }, { "ties" })), ((career.season * 31) + 5))) }, { "ties", "bracket", "eliminated", "winner" }))
			do return Js.O({ state = out, nextFixture = nil, trophy = nil, message = (if decided.onPenalties then ("Out of the " .. state.competition .. " on penalties in the " .. tie.round .. ".") else ("Out of the " .. state.competition .. " in the " .. tie.round .. aggregate .. ".")) }, { "state", "nextFixture", "trophy", "message" }) end
		end
		if (tie.round == "Final") then
			local won = Js.ospread(state, Js.O({ ties = ties, bracket = bracket, won = true, winner = career.player.club }, { "ties", "bracket", "won", "winner" }))
			do return Js.O({ state = won, nextFixture = nil, trophy = Js.O({ season = career.season, competition = state.competition, club = career.player.club }, { "season", "competition", "club" }), message = (if decided.onPenalties then ("🏆 " .. state.competition .. " winners — on penalties!") else ("🏆 " .. state.competition .. " winners!")) }, { "state", "nextFixture", "trophy", "message" }) end
		end
		local fromBracket = (if bracket then M_euroBracket.euroTieFromBracket(bracket, career.player.club, str) else nil)
		local after = ((function() local _v = fromBracket; if _v == nil then return nil end; _v = _v.round; return _v end)() or M_euro.nextRound((if state.position ~= nil then state.position else 24), tie.round))
		if (not Js.T(after)) then
			do return Js.O({ state = Js.ospread(state, Js.O({ ties = ties, bracket = bracket }, { "ties", "bracket" })), nextFixture = nil, trophy = nil, message = "Through." }, { "state", "nextFixture", "trophy", "message" }) end
		end
		local drawn = (if fromBracket ~= nil then fromBracket else M_euro.drawTie(Js.ospread(state, Js.O({ ties = ties }, { "ties" })), after, career.player.club, rng))
		local advanced = Js.ospread(state, Js.O({ ties = Js.aspread(ties, Js.alit(drawn)), bracket = bracket }, { "ties", "bracket" }))
		do return Js.O({ state = advanced, nextFixture = euroTieFixture(advanced, career, drawn, 0), trophy = nil, message = (if decided.onPenalties then ("Through to the " .. after .. " on penalties. " .. drawn.opponent .. " next.") else ("Into the " .. after .. aggregate .. ". " .. drawn.opponent .. " next.")) }, { "state", "nextFixture", "trophy", "message" }) end
	end
	exports.settleEuro = settleEuro
	euroStrength = function(state, you, yourStrength)
		local m = Js.Map.new(A.map(state.clubs, function(c)
			return Js.alit(c.name, c.strength)
		end))
		do return function(c)
			return (if (c == you) then yourStrength else (m:get(c) or 75))
		end end
	end
	result = function(us, them)
		do return (if (us > them) then "Won" else (if (us == them) then "Drew" else "Lost")) end
	end
	ordinalOf = function(n)
		local s = Js.alit("th", "st", "nd", "rd")
		local v = math.fmod(n, 100)
		do return (Js.numstr(n) .. (function() local _l = (function() local _l = s[math.fmod((v - 20), 10) + 1]; if Js.T(_l) then return _l end; return s[v + 1] end)(); if Js.T(_l) then return _l end; return s[1] end)()) end
	end
	EUROPEAN_CLUBS = Js.alit(Js.alit("Real Madrid", 92), Js.alit("Barcelona", 89), Js.alit("Bayern Munich", 91), Js.alit("Paris SG", 88), Js.alit("Inter Milan", 85), Js.alit("AC Milan", 83), Js.alit("Juventus", 84), Js.alit("Atlético Madrid", 85), Js.alit("Borussia Dortmund", 82), Js.alit("Napoli", 81), Js.alit("Ajax", 76), Js.alit("Porto", 77), Js.alit("Benfica", 78), Js.alit("Sevilla", 79), Js.alit("Roma", 80), Js.alit("Marseille", 75))
	NATIONS = Js.alit(Js.alit("Brazil", 91), Js.alit("France", 91), Js.alit("Argentina", 90), Js.alit("Spain", 88), Js.alit("Germany", 87), Js.alit("Portugal", 87), Js.alit("Netherlands", 85), Js.alit("Italy", 85), Js.alit("Belgium", 83), Js.alit("Croatia", 82), Js.alit("Uruguay", 80), Js.alit("Denmark", 79), Js.alit("Switzerland", 77), Js.alit("Mexico", 75), Js.alit("Japan", 76), Js.alit("Senegal", 76), Js.alit("Morocco", 78), Js.alit("USA", 74))
	CUP_ROUNDS = Js.alit("Fourth Round", "Quarter-Final", "Semi-Final", "Final")
	exports.CUP_ROUNDS = CUP_ROUNDS
	EURO_ROUNDS = Js.alit("Round of 16", "Quarter-Final", "Semi-Final", "Final")
	exports.EURO_ROUNDS = EURO_ROUNDS
	TOURNAMENT_ROUNDS = Js.alit("Group Stage", "Round of 16", "Quarter-Final", "Semi-Final", "Final")
	exports.TOURNAMENT_ROUNDS = TOURNAMENT_ROUNDS
	GROUP_STAGE = "Group Stage"
	Js.reexport(exports, M_qualification, { ["qualificationFor"] = "qualificationFor", ["seasonQualifiers"] = "seasonQualifiers" })
	COMPETITION_ABBREV = Js.O({ ["FA Cup"] = "FA Cup", ["League Cup"] = "L Cup", ["Lower League Trophy"] = "LL Trophy", ["Champions League"] = "UCL", ["Europa League"] = "UEL", ["Conference League"] = "UECL", ["Community Shield"] = "Shield", ["Super Cup"] = "S Cup", ["World Cup"] = "WC", ["European Championship"] = "Euros", ["Play-Offs"] = "Play-Off", ["International Friendly"] = "Friendly", ["World Cup Qualifier"] = "WCQ", ["Euro Qualifier"] = "Euro Q", ["World Cup Play-Off"] = "WC PO", ["Nations League"] = "UNL", ["Copa América"] = "Copa", ["Africa Cup of Nations"] = "AFCON", ["AFCON Qualifier"] = "AFCON Q", ["Asian Cup"] = "Asian Cup", ["Asian Cup Qualifier"] = "AC Q", ["Gold Cup"] = "Gold Cup", ["Gold Cup Qualifier"] = "GC Q", ["CONCACAF Nations League"] = "CNL", ["OFC Nations Cup"] = "OFC NC" }, { "FA Cup", "League Cup", "Lower League Trophy", "Champions League", "Europa League", "Conference League", "Community Shield", "Super Cup", "World Cup", "European Championship", "Play-Offs", "International Friendly", "World Cup Qualifier", "Euro Qualifier", "World Cup Play-Off", "Nations League", "Copa América", "Africa Cup of Nations", "AFCON Qualifier", "Asian Cup", "Asian Cup Qualifier", "Gold Cup", "Gold Cup Qualifier", "CONCACAF Nations League", "OFC Nations Cup" })
	DIVISION_ABBREV = Js.O({ premier = "Prem", championship = "Champ", league_one = "L1", league_two = "L2", national_league = "NL", national_league_north = "NLN", national_league_south = "NLS" }, { "premier", "championship", "league_one", "league_two", "national_league", "national_league_north", "national_league_south" })
end
