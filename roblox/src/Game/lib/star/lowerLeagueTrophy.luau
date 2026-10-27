--!nocheck
--!nolint
-- Generated from lib/star/lowerLeagueTrophy.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_promotion = import("lib/star/promotion")
	local M_calendar = import("lib/star/calendar")
	local M_season = import("lib/star/season")
	local M_cups = import("lib/star/cups")
	local LOWER_LEAGUE_TROPHY, LOWER_LEAGUE_TROPHY_DRAW, LOWER_LEAGUE_TROPHY_PRIZE_WEEKS, TROPHY_INTEREST_SEMI, TROPHY_INTEREST_WIN, LOWER_KEYS, lowerLeagueTrophyField, leagueOneOrder, lowerLeagueTrophyByes, openLowerLeagueTrophy, lowerLeagueTrophyRun, lowerLeagueTrophyInterest, lowerLeagueTrophyPrize
	lowerLeagueTrophyField = function(career)
		local m = M_promotion.membershipOf(career)
		local own = M_calendar.divisionOf(career)
		local out = Js.alit()
		local seen = Js.Set.new()
		local add = function(c)
			if (not seen:has(c)) then
				seen:add(c)
				A.push(out, c)
			end
		end
		do
			local _arr1 = LOWER_KEYS
			local _i2 = 0
			while _i2 < Js.alen(_arr1) do
				_i2 += 1
				local key = _arr1[_i2]
				do
					local _arr3 = m[key]
					local _i4 = 0
					while _i4 < Js.alen(_arr3) do
						_i4 += 1
						local c = _arr3[_i4]
						add(c)
					end
				end
			end
		end
		if M_calendar.inLowerLeagueTrophy(own) then
			do
				local _arr5 = career.league
				local _i6 = 0
				while _i6 < Js.alen(_arr5) do
					_i6 += 1
					local t = _arr5[_i6]
					add(t.name)
				end
			end
		end
		local higher = Js.Set.new(Js.aspread(m.premier, m.championship))
		if (not M_calendar.inLowerLeagueTrophy(own)) then
			do
				local _arr7 = career.league
				local _i8 = 0
				while _i8 < Js.alen(_arr7) do
					_i8 += 1
					local t = _arr7[_i8]
					higher:add(t.name)
				end
			end
		end
		do return A.filter(out, function(c)
			return (not higher:has(c))
		end) end
	end
	exports.lowerLeagueTrophyField = lowerLeagueTrophyField
	leagueOneOrder = function(career)
		if (M_calendar.divisionOf(career) == "league_one") then
			do return A.map(M_season.sortLeague(career.league), function(t)
				return t.name
			end) end
		end
		do return A.sort(Js.aspread(M_promotion.membershipOf(career).leagueOne), function(a, b)
			return (M_promotion.estimateClubStrength(career, b) - M_promotion.estimateClubStrength(career, a))
		end) end
	end
	exports.leagueOneOrder = leagueOneOrder
	lowerLeagueTrophyByes = function(career, field, order)
		local count = Math.max(0, Math.min(Js.alen(field), (LOWER_LEAGUE_TROPHY_DRAW - Js.alen(field))))
		local inField = Js.Set.new(field)
		local byes = Js.alit()
		do
			local _arr9 = (if order ~= nil then order else leagueOneOrder(career))
			local _i10 = 0
			while _i10 < Js.alen(_arr9) do
				_i10 += 1
				local c = _arr9[_i10]
				if (Js.alen(byes) >= count) then
					do break end
				end
				if (inField:has(c) and (not A.includes(byes, c))) then
					A.push(byes, c)
				end
			end
		end
		if (Js.alen(byes) < count) then
			local rest = A.sort(A.filter(field, function(c)
				return (not A.includes(byes, c))
			end), function(a, b)
				return (M_promotion.estimateClubStrength(career, b) - M_promotion.estimateClubStrength(career, a))
			end)
			A.push(byes, Js.unpack(A.slice(rest, 0, (count - Js.alen(byes)))))
		end
		do return byes end
	end
	exports.lowerLeagueTrophyByes = lowerLeagueTrophyByes
	openLowerLeagueTrophy = function(career, rng, lastLeagueOneOrder)
		local field = lowerLeagueTrophyField(career)
		local byes = lowerLeagueTrophyByes(career, field, lastLeagueOneOrder)
		do return M_cups.openCupWithByes(LOWER_LEAGUE_TROPHY, field, byes, rng) end
	end
	exports.openLowerLeagueTrophy = openLowerLeagueTrophy
	lowerLeagueTrophyRun = function(career)
		local st = (function() local _r = career.cupState; if _r == nil then return nil end; return A.find(_r, function(s)
			return (s.competition == LOWER_LEAGUE_TROPHY)
		end) end)()
		if (not st) then
			do return nil end
		end
		local club = career.player.club
		local tied = (((not (not career.cupTied)) and (career.cupTied.season == career.season)) and A.includes(career.cupTied.competitions, LOWER_LEAGUE_TROPHY))
		if tied then
			do return nil end
		end
		if (st.winner == club) then
			do return "won" end
		end
		local names = M_cups.roundNamesFor(st.competition)
		local semi = A.indexOf(names, "Semi-Final")
		local reached = A.some(A.slice(st.rounds, semi), function(r)
			return A.some(r.ties, function(t)
				return ((t.home == club) or (t.away == club))
			end)
		end)
		do return (if reached then "semi" else nil) end
	end
	exports.lowerLeagueTrophyRun = lowerLeagueTrophyRun
	lowerLeagueTrophyInterest = function(career, division)
		if (not M_calendar.inLowerLeagueTrophy(division)) then
			do return 0 end
		end
		local run = lowerLeagueTrophyRun(career)
		do return (if (run == "won") then TROPHY_INTEREST_WIN else (if (run == "semi") then TROPHY_INTEREST_SEMI else 0)) end
	end
	exports.lowerLeagueTrophyInterest = lowerLeagueTrophyInterest
	lowerLeagueTrophyPrize = function(career)
		do return Math.max(1, Math.round((career.contract.wage * LOWER_LEAGUE_TROPHY_PRIZE_WEEKS))) end
	end
	exports.lowerLeagueTrophyPrize = lowerLeagueTrophyPrize
	LOWER_LEAGUE_TROPHY = "Lower League Trophy"
	exports.LOWER_LEAGUE_TROPHY = LOWER_LEAGUE_TROPHY
	LOWER_LEAGUE_TROPHY_DRAW = 128
	exports.LOWER_LEAGUE_TROPHY_DRAW = LOWER_LEAGUE_TROPHY_DRAW
	LOWER_LEAGUE_TROPHY_PRIZE_WEEKS = 2
	exports.LOWER_LEAGUE_TROPHY_PRIZE_WEEKS = LOWER_LEAGUE_TROPHY_PRIZE_WEEKS
	TROPHY_INTEREST_SEMI = 0.05
	exports.TROPHY_INTEREST_SEMI = TROPHY_INTEREST_SEMI
	TROPHY_INTEREST_WIN = 0.1
	exports.TROPHY_INTEREST_WIN = TROPHY_INTEREST_WIN
	LOWER_KEYS = Js.alit("leagueOne", "leagueTwo", "nationalLeague", "nationalLeagueNorth", "nationalLeagueSouth")
end
