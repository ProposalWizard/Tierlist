--!nocheck
--!nolint
-- Generated from lib/star/competitionBetting.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_calendar = import("lib/star/calendar")
	local M_tuningStore = import("lib/star/tuningStore")
	local M_ruleBook = import("lib/star/ruleBook")
	local M_competitions = import("lib/star/competitions")
	local M_euro = import("lib/star/euro")
	local canPlaceCompetitionBet, BET_COMPETITIONS, MIN_ODDS, winWeight, oddsFor, entrantsFor, settleBets, betNewsLines
	canPlaceCompetitionBet = function(career)
		local month = M_calendar.calendarMonthOf(career.player.startYear, career.season, career.week, M_calendar.divisionOf(career))
		do return (month < 7) end
	end
	exports.canPlaceCompetitionBet = canPlaceCompetitionBet
	winWeight = function(strength, exponent)
		do return Math.pow(Math.max(1, (strength - M_tuningStore.getTuning("betting.strengthBaseline"))), exponent) end
	end
	oddsFor = function(entrants, competition)
		local isCup = ((competition == "faCup") or (competition == "leagueCup"))
		local exponent = M_tuningStore.getTuning((if isCup then "betting.cupStrengthExponent" else "betting.strengthExponent"))
		local maxOdds = M_tuningStore.getTuning((if isCup then "betting.cupMaxOdds" else "betting.maxOdds"))
		local overround = M_tuningStore.getTuning("betting.overround")
		local byName = Js.Map.new()
		do
			local _arr1 = entrants
			local _i2 = 0
			while _i2 < Js.alen(_arr1) do
				_i2 += 1
				local e = _arr1[_i2]
				local prev = byName:get(e.name)
				if ((prev == nil) or (e.strength > prev)) then
					byName:set(e.name, e.strength)
				end
			end
		end
		local weights = A.map(Js.Array.from(byName:entries()), function(_p3)
			local name = _p3[1]
			local strength = _p3[2]
			return Js.O({ name = name, weight = winWeight(strength, exponent) }, { "name", "weight" })
		end)
		local total = (function() local _l = A.reduce(weights, function(s, w)
			return (s + w.weight)
		end, 0); if Js.T(_l) then return _l end; return 1 end)()
		do return A.sort(A.map(weights, function(w)
			local prob = (w.weight / total)
			local fair = (if (prob > 0) then (1 / prob) else maxOdds)
			local priced = (fair / overround)
			do return Js.O({ name = w.name, odds = Math.max(MIN_ODDS, Math.min(maxOdds, (Math.round((priced * 10)) / 10))) }, { "name", "odds" }) end
		end), function(a, b)
			return (a.odds - b.odds)
		end) end
	end
	exports.oddsFor = oddsFor
	entrantsFor = function(competition, career)
		if (((competition == "league") or (competition == "faCup")) or (competition == "leagueCup")) then
			do return A.map(career.league, function(t)
				return Js.O({ name = t.name, strength = t.strength }, { "name", "strength" })
			end) end
		end
		local euroId = (if (competition == "championsLeague") then "Champions League" else "Europa League")
		if ((function() local _v = career.euroState; if _v == nil then return nil end; _v = _v.competition; return _v end)() == euroId) then
			do return A.map(career.euroState.clubs, function(c)
				return Js.O({ name = c.name, strength = c.strength }, { "name", "strength" })
			end) end
		end
		local strengthOf = function(name)
			return ((function() local _v = A.find(career.league, function(t)
				return (t.name == name)
			end); if _v == nil then return nil end; _v = _v.strength; return _v end)() or 75)
		end
		local uefaRules = M_ruleBook.ruleBookFor(career, "UEFA")
		local qualifiers = M_competitions.seasonQualifiers(career.league, nil, nil, nil, uefaRules.extraChampionsLeagueSlots, uefaRules.extraEuropaLeagueSlots)
		local domestic = A.map((if (competition == "championsLeague") then qualifiers.champions else qualifiers.europa), function(name)
			return Js.O({ name = name, strength = strengthOf(name) }, { "name", "strength" })
		end)
		local foreign = A.map(M_euro.poolFor(euroId, career), function(c)
			return Js.O({ name = c.name, strength = c.strength }, { "name", "strength" })
		end)
		do return Js.aspread(domestic, foreign) end
	end
	exports.entrantsFor = entrantsFor
	settleBets = function(bets, winners, season)
		local settled = Js.alit()
		local stillPending = Js.alit()
		local totalPayout = 0
		do
			local _arr4 = bets
			local _i5 = 0
			while _i5 < Js.alen(_arr4) do
				_i5 += 1
				local bet = _arr4[_i5]
				if (bet.season ~= season) then
					A.push(stillPending, bet)
					do continue end
				end
				local winner = winners[bet.competition]
				local won = (winner == bet.club)
				local payout = (if won then Math.round((bet.stake * bet.odds)) else 0)
				A.push(settled, Js.O({ bet = bet, won = won, payout = payout }, { "bet", "won", "payout" }))
				totalPayout += payout
			end
		end
		do return Js.O({ settled = settled, stillPending = stillPending, totalPayout = totalPayout }, { "settled", "stillPending", "totalPayout" }) end
	end
	exports.settleBets = settleBets
	betNewsLines = function(settlements)
		do return A.map(settlements, function(s)
			local comp = ((function() local _v = A.find(BET_COMPETITIONS, function(c)
				return (c.id == s.bet.competition)
			end); if _v == nil then return nil end; _v = _v.label; return _v end)() or s.bet.competition)
			do return (if s.won then (comp .. ": " .. s.bet.club .. " won! ★" .. Js.numstr(s.bet.stake) .. " @ " .. N.toFixed(s.bet.odds, 2) .. " → ★" .. Js.numstr(s.payout)) else (comp .. ": " .. s.bet.club .. " didn't win it — ★" .. Js.numstr(s.bet.stake) .. " stake lost.")) end
		end) end
	end
	exports.betNewsLines = betNewsLines
	BET_COMPETITIONS = Js.alit(Js.O({ id = "league", label = "League Title" }, { "id", "label" }), Js.O({ id = "faCup", label = "FA Cup" }, { "id", "label" }), Js.O({ id = "leagueCup", label = "League Cup" }, { "id", "label" }), Js.O({ id = "championsLeague", label = "Champions League" }, { "id", "label" }), Js.O({ id = "europaLeague", label = "Europa League" }, { "id", "label" }))
	exports.BET_COMPETITIONS = BET_COMPETITIONS
	MIN_ODDS = 1.15
end
