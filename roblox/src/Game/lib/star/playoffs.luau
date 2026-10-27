--!nocheck
--!nolint
-- Generated from lib/star/playoffs.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_calendar = import("lib/star/calendar")
	local M_season = import("lib/star/season")
	local M_promotion = import("lib/star/promotion")
	local SF1, SF2, FINAL, strengthOf, autoPromotionPlaces, legFixtures, seedPlayOffs, QUALIFIER_ROUND, SEMI_ROUND, FINAL_ROUND, strengthMap, tieState, seedSixClubPlayOffs, finishWithoutYou, settleSixClubFixture, settlePlayOffFixture, leagueSeasonComplete
	strengthOf = function(league, club)
		do return ((function() local _v = A.find(league, function(t)
			return (t.name == club)
		end); if _v == nil then return nil end; _v = _v.strength; return _v end)() or 70) end
	end
	autoPromotionPlaces = function(division)
		do return (if (division == "league_two") then 3 else (if (((division == "national_league") or (division == "national_league_north")) or (division == "national_league_south")) then 1 else 2)) end
	end
	exports.autoPromotionPlaces = autoPromotionPlaces
	legFixtures = function(you, opponent, youAreHigherSeed)
		do return Js.alit(Js.O({ week = SF1.week, opponent = opponent, home = (not youAreHigherSeed), played = false, kind = "playoff", competition = "Play-Offs", round = "Semi-Final, First Leg" }, { "week", "opponent", "home", "played", "kind", "competition", "round" }), Js.O({ week = SF2.week, opponent = opponent, home = youAreHigherSeed, played = false, kind = "playoff", competition = "Play-Offs", round = "Semi-Final, Second Leg" }, { "week", "opponent", "home", "played", "kind", "competition", "round" })) end
	end
	seedPlayOffs = function(career)
		if (M_calendar.divisionOf(career) == "premier") then
			do return nil end
		end
		if career.playOffState then
			do return nil end
		end
		if M_calendar.isRegionalDivision(M_calendar.divisionOf(career)) then
			do return seedSixClubPlayOffs(career) end
		end
		local table_ = M_season.sortLeague(career.league)
		local first = autoPromotionPlaces(M_calendar.divisionOf(career))
		if (Js.alen(table_) < (first + 4)) then
			do return nil end
		end
		local contenders = A.map(A.slice(table_, first, (first + 4)), function(t)
			return t.name
		end)
		local you = career.player.club
		local at = A.indexOf(contenders, you)
		if (at < 0) then
			do return nil end
		end
		local pairs_ = Js.alit(Js.alit(contenders[1], contenders[4]), Js.alit(contenders[2], contenders[3]))
		local yourPairIndex = A.findIndex(pairs_, function(p)
			return A.includes(p, you)
		end)
		local _d1 = pairs_[yourPairIndex + 1]
		local highSeed = _d1[1]
		local lowSeed = _d1[2]
		local opponent = (if (highSeed == you) then lowSeed else highSeed)
		local youAreHigherSeed = (highSeed == you)
		local rng = M_season.mulberry32(((career.season * 4409) + (Js.alen(career.league) * 17)))
		local _d2 = pairs_[(1 - yourPairIndex) + 1]
		local otherHigh = _d2[1]
		local otherLow = _d2[2]
		local otherFirst = M_season.simulateFixtureScore(strengthOf(career.league, otherLow), strengthOf(career.league, otherHigh), rng)
		local otherSecond = M_season.simulateFixtureScore(strengthOf(career.league, otherHigh), strengthOf(career.league, otherLow), rng)
		local aggHigh = (otherFirst.away + otherSecond.home)
		local aggLow = (otherFirst.home + otherSecond.away)
		local otherWinner = (if (aggHigh ~= aggLow) then (if (aggHigh > aggLow) then otherHigh else otherLow) else (if (rng() < 0.58) then otherHigh else otherLow))
		local state = Js.O({ contenders = contenders, semis = Js.alit(Js.O({ home = lowSeed, away = highSeed, legs = Js.alit() }, { "home", "away", "legs" }), Js.O({ home = otherLow, away = otherHigh, legs = Js.alit(Js.O({ hs = otherFirst.home, as = otherFirst.away }, { "hs", "as" }), Js.O({ hs = otherSecond.away, as = otherSecond.home }, { "hs", "as" })), winner = otherWinner }, { "home", "away", "legs", "winner" })) }, { "contenders", "semis" })
		do return Js.O({ state = state, fixtures = legFixtures(you, opponent, youAreHigherSeed) }, { "state", "fixtures" }) end
	end
	exports.seedPlayOffs = seedPlayOffs
	strengthMap = function(league)
		do return Js.Map.new(A.map(league, function(t)
			return Js.alit(t.name, t.strength)
		end)) end
	end
	tieState = function(t)
		do return Js.O({ home = t.home, away = t.away, legs = t.legs, winner = t.winner }, { "home", "away", "legs", "winner" }) end
	end
	seedSixClubPlayOffs = function(career)
		local table_ = A.map(M_season.sortLeague(career.league), function(t)
			return t.name
		end)
		if (Js.alen(table_) < 7) then
			do return nil end
		end
		local contenders = A.slice(table_, 1, 7)
		local you = career.player.club
		local at = A.indexOf(contenders, you)
		if (at < 0) then
			do return nil end
		end
		local _d3 = contenders
		local second = _d3[1]
		local third = _d3[2]
		local fourth = _d3[3]
		local fifth = _d3[4]
		local sixth = _d3[5]
		local seventh = _d3[6]
		local strength = strengthMap(career.league)
		local rng = M_season.mulberry32((((career.season * 4409) + (Js.alen(career.league) * 17)) + 6))
		local q1 = Js.O({ home = fourth, away = seventh, legs = Js.alit() }, { "home", "away", "legs" })
		local q2 = Js.O({ home = fifth, away = sixth, legs = Js.alit() }, { "home", "away", "legs" })
		local inQ1 = ((q1.home == you) or (q1.away == you))
		local inQ2 = ((q2.home == you) or (q2.away == you))
		local played = function(t)
			return tieState(M_promotion.singleMatchTie(t.home, t.away, strength, rng))
		end
		local quals = Js.alit((if inQ1 then q1 else played(q1)), (if inQ2 then q2 else played(q2)))
		local semiFor2nd = Js.O({ home = second, away = (if quals[2].winner ~= nil then quals[2].winner else "") }, { "home", "away" })
		local semiFor3rd = Js.O({ home = third, away = (if quals[1].winner ~= nil then quals[1].winner else "") }, { "home", "away" })
		local yours = nil
		local other = nil
		local fixture = nil
		if ((((you == second) or (you == third)) or inQ2) or inQ1) then
			local throughSecond = ((you == second) or inQ2)
			local mine = (if throughSecond then semiFor2nd else semiFor3rd)
			local theirs = (if throughSecond then semiFor3rd else semiFor2nd)
			other = tieState(M_promotion.singleMatchTie(theirs.home, theirs.away, strength, rng))
			if ((you == second) or (you == third)) then
				yours = Js.O({ home = mine.home, away = mine.away, legs = Js.alit() }, { "home", "away", "legs" })
				fixture = Js.O({ week = SF2.week, opponent = mine.away, home = true, played = false, kind = "playoff", competition = "Play-Offs", round = SEMI_ROUND }, { "week", "opponent", "home", "played", "kind", "competition", "round" })
			else
				yours = Js.O({ home = mine.home, away = "", legs = Js.alit() }, { "home", "away", "legs" })
				local q = (if inQ1 then q1 else q2)
				local opp = (if (q.home == you) then q.away else q.home)
				fixture = Js.O({ week = SF1.week, opponent = opp, home = (q.home == you), played = false, kind = "playoff", competition = "Play-Offs", round = QUALIFIER_ROUND }, { "week", "opponent", "home", "played", "kind", "competition", "round" })
			end
		else
			do return nil end
		end
		do return Js.O({ state = Js.O({ contenders = contenders, format = "six", qualifiers = quals, semis = Js.alit(yours, other) }, { "contenders", "format", "qualifiers", "semis" }), fixtures = Js.alit(fixture) }, { "state", "fixtures" }) end
	end
	finishWithoutYou = function(career, state, beatYou)
		local strength = strengthMap(career.league)
		local rng = M_season.mulberry32(((career.season * 9173) + 61))
		local order = state.contenders
		local higher = function(a, b)
			return (if (A.indexOf(order, a) <= A.indexOf(order, b)) then Js.alit(a, b) else Js.alit(b, a))
		end
		local yourSemiWinner = beatYou
		local semis = Js.aspread(state.semis)
		if (not Js.T(semis[1].winner)) then
			local t = M_promotion.singleMatchTie(semis[1].home, beatYou, strength, rng)
			A.set(semis, 0, tieState(t))
			yourSemiWinner = t.winner
		end
		local _d4 = higher(yourSemiWinner, semis[2].winner)
		local h = _d4[1]
		local a = _d4[2]
		local fin = M_promotion.singleMatchTie(h, a, strength, rng)
		do return Js.ospread(state, Js.O({ semis = semis, final = Js.O({ home = h, away = a, hs = (function() local _v = fin.legs[1]; if _v == nil then return nil end; _v = _v.hs; return _v end)(), as = (function() local _v = fin.legs[1]; if _v == nil then return nil end; _v = _v.as; return _v end)(), winner = fin.winner }, { "home", "away", "hs", "as", "winner" }), promoted = fin.winner }, { "semis", "final", "promoted" })) end
	end
	settleSixClubFixture = function(career, state, fixture, userScore, oppScore)
		local you = career.player.club
		local hs = (if fixture.home then userScore else oppScore)
		local as = (if fixture.home then oppScore else userScore)
		local rng = M_season.mulberry32((((career.season * 6607) + (fixture.week * 41)) + 6))
		local won = (if (userScore ~= oppScore) then (userScore > oppScore) else (rng() < (if fixture.home then 0.55 else 0.45)))
		local winner = (if won then you else fixture.opponent)
		local after = (if (userScore == oppScore) then " after extra time and penalties" else "")
		local order = state.contenders
		local youHigher = function(opp)
			return (A.indexOf(order, you) < A.indexOf(order, opp))
		end
		if (fixture.round == FINAL_ROUND) then
			do return Js.O({ state = Js.ospread(state, Js.O({ final = Js.ospread((if state.final ~= nil then state.final else Js.O({ home = you, away = fixture.opponent }, { "home", "away" })), Js.O({ hs = hs, as = as, winner = winner }, { "hs", "as", "winner" })), promoted = winner, yourRunOver = true }, { "final", "promoted", "yourRunOver" })), fixtures = Js.alit(), result = (if won then "promoted" else "lost-final"), message = (if won then ("Promoted" .. after .. ". " .. you .. " win the play-off final and go up.") else ("Beaten in the final" .. after .. ". " .. fixture.opponent .. " go up instead.")) }, { "state", "fixtures", "result", "message" }) end
		end
		if (fixture.round == QUALIFIER_ROUND) then
			local quals = A.map(state.qualifiers, function(q)
				return (if ((q.home == you) or (q.away == you)) then Js.ospread(q, Js.O({ legs = Js.alit(Js.O({ hs = hs, as = as }, { "hs", "as" })), winner = winner }, { "legs", "winner" })) else q)
			end)
			if (not won) then
				do return Js.O({ state = finishWithoutYou(career, Js.ospread(state, Js.O({ qualifiers = quals, yourRunOver = true }, { "qualifiers", "yourRunOver" })), winner), fixtures = Js.alit(), result = "eliminated", message = ("Out in the qualifying round" .. after .. ". " .. winner .. " go through.") }, { "state", "fixtures", "result", "message" }) end
			end
			local semi = Js.ospread(state.semis[1], Js.O({ away = you }, { "away" }))
			do return Js.O({ state = Js.ospread(state, Js.O({ qualifiers = quals, semis = Js.alit(semi, state.semis[2]) }, { "qualifiers", "semis" })), fixtures = Js.alit(Js.O({ week = SF2.week, opponent = semi.home, home = false, played = false, kind = "playoff", competition = "Play-Offs", round = SEMI_ROUND }, { "week", "opponent", "home", "played", "kind", "competition", "round" })), result = "through", message = ("Through" .. after .. ". " .. semi.home .. " at home in the semi-final.") }, { "state", "fixtures", "result", "message" }) end
		end
		local semi = Js.ospread(state.semis[1], Js.O({ legs = Js.alit(Js.O({ hs = hs, as = as }, { "hs", "as" })), winner = winner }, { "legs", "winner" }))
		if (not won) then
			do return Js.O({ state = finishWithoutYou(career, Js.ospread(state, Js.O({ semis = Js.alit(semi, state.semis[2]), yourRunOver = true }, { "semis", "yourRunOver" })), winner), fixtures = Js.alit(), result = "eliminated", message = ("Out in the semi-final" .. after .. ". " .. winner .. " go to the final.") }, { "state", "fixtures", "result", "message" }) end
		end
		local opp = state.semis[2].winner
		local home = youHigher(opp)
		do return Js.O({ state = Js.ospread(state, Js.O({ semis = Js.alit(semi, state.semis[2]), final = (if home then Js.O({ home = you, away = opp }, { "home", "away" }) else Js.O({ home = opp, away = you }, { "home", "away" })) }, { "semis", "final" })), fixtures = Js.alit(Js.O({ week = FINAL.week, opponent = opp, home = home, played = false, kind = "playoff", competition = "Play-Offs", round = FINAL_ROUND }, { "week", "opponent", "home", "played", "kind", "competition", "round" })), result = "through", message = ("Through to the final" .. after .. ". " .. opp .. " are waiting" .. (if home then ", at yours" else "") .. ".") }, { "state", "fixtures", "result", "message" }) end
	end
	settlePlayOffFixture = function(career, fixture, userScore, oppScore)
		local state = career.playOffState
		if ((not state) or (fixture.kind ~= "playoff")) then
			do return nil end
		end
		if (state.format == "six") then
			do return settleSixClubFixture(career, state, fixture, userScore, oppScore) end
		end
		local you = career.player.club
		local hs = (if fixture.home then userScore else oppScore)
		local as = (if fixture.home then oppScore else userScore)
		local rng = M_season.mulberry32(((career.season * 6607) + (fixture.week * 41)))
		if (state.final and (not Js.T(state.final.winner))) then
			local won = (if (userScore ~= oppScore) then (userScore > oppScore) else (rng() < 0.5))
			local winner = (if won then you else fixture.opponent)
			local next_ = Js.ospread(state, Js.O({ final = Js.ospread(state.final, Js.O({ hs = hs, as = as, winner = winner }, { "hs", "as", "winner" })), promoted = winner, yourRunOver = true }, { "final", "promoted", "yourRunOver" }))
			do return Js.O({ state = next_, fixtures = Js.alit(), result = (if won then "promoted" else "lost-final"), message = (if won then ("Promoted. " .. you .. " win the play-off final and go up.") else ("Beaten in the final. " .. fixture.opponent .. " go up instead.")) }, { "state", "fixtures", "result", "message" }) end
		end
		local yours = state.semis[1]
		local legs = Js.aspread(yours.legs, Js.alit(Js.O({ hs = hs, as = as }, { "hs", "as" })))
		if (Js.alen(legs) < 2) then
			do return Js.O({ state = Js.ospread(state, Js.O({ semis = Js.alit(Js.ospread(yours, Js.O({ legs = legs }, { "legs" })), state.semis[2]) }, { "semis" })), fixtures = Js.alit(), result = "through", message = ("First leg done: " .. Js.numstr(hs) .. "-" .. Js.numstr(as) .. ". It is settled at the second.") }, { "state", "fixtures", "result", "message" }) end
		end
		local higherSeed = yours.away
		local aggHigh = (legs[1].as + legs[2].hs)
		local aggLow = (legs[1].hs + legs[2].as)
		local winner = (if (aggHigh ~= aggLow) then (if (aggHigh > aggLow) then higherSeed else yours.home) else (if (rng() < 0.58) then higherSeed else yours.home))
		local won = (winner == you)
		local semis = Js.alit(Js.ospread(yours, Js.O({ legs = legs, winner = winner }, { "legs", "winner" })), state.semis[2])
		if (not won) then
			do return Js.O({ state = Js.ospread(state, Js.O({ semis = semis, yourRunOver = true, promoted = nil }, { "semis", "yourRunOver", "promoted" })), fixtures = Js.alit(), result = "eliminated", message = ("Out on aggregate. " .. winner .. " go to the final instead.") }, { "state", "fixtures", "result", "message" }) end
		end
		local otherWinner = state.semis[2].winner
		local final = Js.O({ home = you, away = otherWinner }, { "home", "away" })
		do return Js.O({ state = Js.ospread(state, Js.O({ semis = semis, final = final }, { "semis", "final" })), fixtures = Js.alit(Js.O({ week = FINAL.week, opponent = otherWinner, home = true, played = false, kind = "playoff", competition = "Play-Offs", round = "Play-Off Final" }, { "week", "opponent", "home", "played", "kind", "competition", "round" })), result = "through", message = ("Through to the final. " .. otherWinner .. " are waiting.") }, { "state", "fixtures", "result", "message" }) end
	end
	exports.settlePlayOffFixture = settlePlayOffFixture
	leagueSeasonComplete = function(career, week)
		do return (week >= M_calendar.matchweeksFor(M_calendar.divisionOf(career))) end
	end
	exports.leagueSeasonComplete = leagueSeasonComplete
	local _d5 = M_calendar.PLAY_OFF_SLOTS
	SF1 = _d5[1]
	SF2 = _d5[2]
	FINAL = _d5[3]
	QUALIFIER_ROUND = "Play-Off Qualifier"
	SEMI_ROUND = "Play-Off Semi-Final"
	FINAL_ROUND = "Play-Off Final"
end
