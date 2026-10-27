--!nocheck
--!nolint
-- Generated from lib/star/calendar.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_windows = import("lib/star/intl/windows")
	local MATCHWEEKS, PRE_SEASON_WEEK, LEAGUE_CUP_SLOTS, FA_CUP_SLOTS_V1, FA_CUP_SLOTS, EURO_LEAGUE_PHASE_WEEKS, EURO_KO_SLOTS_WITH_R32, LEAGUE_CUP_SLOTS_IN_EUROPE, FA_CUP_SLOTS_IN_EUROPE_V1, FA_CUP_SLOTS_IN_EUROPE, EURO_KO_SLOTS_SEEDED, TOURNAMENT_WEEKS, POST_SEASON, DIVISION_ORDER, ALL_DIVISIONS, REGIONAL_DIVISIONS, isRegionalDivision, divisionRank, relegationPlaces, divisionAbove, divisionBelow, divisionOf, hasClub, leagueNameFor, CHAMPIONSHIP_MATCHWEEKS, matchweeksFor, isPostSeason, OPENING_DAY, DAY_MS, openingSaturday, seasonStartYear, CHAMPIONSHIP_MIDWEEK_WEEKS, buildRounds, CHAMPIONSHIP_ROUNDS, PREMIER_MIDWEEK_WEEKS, CHAMPIONSHIP_BREAK_MIDWEEK_WEEKS, PREMIER_ROUNDS, CHAMPIONSHIP_BREAK_ROUNDS, stopsForBreaks, roundsFor, lastLeagueWeekend, playingWeekendOf, weekOnWeekend, CHAMPIONSHIP_POST_SEASON, postSeasonFor, tournamentWeeksFor, fixtureDate, outOfBreak, INTL_DAY_BASE, intlWeek, isDatedWeek, playingSaturday, dayFor, WEEKDAYS, MONTHS, formatDate, formatDateFull, formatDateNumeric, fixtureDateLabel, fixtureTimestamp
	local CHAMPIONSHIP_LEAGUE_CUP_SLOTS, CHAMPIONSHIP_FA_CUP_SLOTS_V1, CHAMPIONSHIP_FA_CUP_SLOTS, PLAY_OFF_SLOTS, PLAY_OFF_DAYS, leagueCupSlotsFor, FA_CUP_WEEKENDS_CHAMPIONSHIP_IN_EUROPE_V1, asRounds, faCupSlotsFor, LOWER_LEAGUE_TROPHY_DIVISIONS, inLowerLeagueTrophy, LOWER_LEAGUE_TROPHY_WEEKENDS, lowerLeagueTrophySlotsFor, faCupSlotsV1For, calendarMonthOf, transferWindowFor, transferWindowOpen
	POST_SEASON = function(n)
		do return (MATCHWEEKS + n) end
	end
	exports.POST_SEASON = POST_SEASON
	isRegionalDivision = function(division)
		do return ((division == "national_league_north") or (division == "national_league_south")) end
	end
	exports.isRegionalDivision = isRegionalDivision
	divisionRank = function(division)
		do return (if isRegionalDivision(division) then Js.alen(DIVISION_ORDER) else A.indexOf(DIVISION_ORDER, division)) end
	end
	exports.divisionRank = divisionRank
	relegationPlaces = function(division)
		local _sw1 = division
		if _sw1 == "league_one" or _sw1 == "national_league" or _sw1 == "national_league_north" or _sw1 == "national_league_south" then
			do return 4 end
		elseif _sw1 == "league_two" then
			do return 2 end
		else
			do return 3 end
		end
	end
	exports.relegationPlaces = relegationPlaces
	divisionAbove = function(division)
		local i = divisionRank(division)
		do return (if (i > 0) then DIVISION_ORDER[i] else nil) end
	end
	exports.divisionAbove = divisionAbove
	divisionBelow = function(division)
		if isRegionalDivision(division) then
			do return nil end
		end
		if (division == "national_league") then
			do return "national_league_north" end
		end
		local i = divisionRank(division)
		do return (if ((i >= 0) and (i < (Js.alen(DIVISION_ORDER) - 1))) then DIVISION_ORDER[(i + 1) + 1] else nil) end
	end
	exports.divisionBelow = divisionBelow
	divisionOf = function(career)
		do return (if career.division ~= nil then career.division else "premier") end
	end
	exports.divisionOf = divisionOf
	hasClub = function(career)
		do return ((not (not Js.T((function() local _v = career.player; if _v == nil then return nil end; _v = _v.club; return _v end)()))) and (((function() local _v = career.league; if _v == nil then return nil end; _v = Js.len(_v); return _v end)() or 0) > 0)) end
	end
	exports.hasClub = hasClub
	leagueNameFor = function(division)
		local _sw2 = division
		if _sw2 == "premier" then
			do return "Premier League" end
		elseif _sw2 == "championship" then
			do return "Championship" end
		elseif _sw2 == "league_one" then
			do return "League One" end
		elseif _sw2 == "league_two" then
			do return "League Two" end
		elseif _sw2 == "national_league" then
			do return "National League" end
		elseif _sw2 == "national_league_north" then
			do return "National League North" end
		elseif _sw2 == "national_league_south" then
			do return "National League South" end
		end
	end
	exports.leagueNameFor = leagueNameFor
	matchweeksFor = function(division)
		do return (if (division == "premier") then MATCHWEEKS else CHAMPIONSHIP_MATCHWEEKS) end
	end
	exports.matchweeksFor = matchweeksFor
	isPostSeason = function(week, division)
		if division == nil then division = "premier" end
		do return (week > matchweeksFor(division)) end
	end
	exports.isPostSeason = isPostSeason
	openingSaturday = function(year)
		local d = Js.Date.new(Js.Date.UTC(year, OPENING_DAY.month, OPENING_DAY.day))
		do return Js.Date.new((d:getTime() + (math.fmod(((6 - d:getUTCDay()) + 7), 7) * DAY_MS))) end
	end
	exports.openingSaturday = openingSaturday
	seasonStartYear = function(startYear, season)
		do return ((startYear - 1) + Math.max(0, (season - 1))) end
	end
	exports.seasonStartYear = seasonStartYear
	buildRounds = function(saturdays, midweeks)
		local midweek = Js.Set.new(midweeks)
		local out = Js.alit()
		for w = 1, math.floor(saturdays) do
			A.push(out, Js.O({ calendarWeek = w, day = "saturday" }, { "calendarWeek", "day" }))
			if midweek:has(w) then
				A.push(out, Js.O({ calendarWeek = w, day = "tuesday" }, { "calendarWeek", "day" }))
			end
		end
		do return out end
	end
	stopsForBreaks = function(division)
		do return ((division == "premier") or (division == "championship")) end
	end
	exports.stopsForBreaks = stopsForBreaks
	roundsFor = function(division)
		if (division == "premier") then
			do return PREMIER_ROUNDS end
		end
		if (division == "championship") then
			do return CHAMPIONSHIP_BREAK_ROUNDS end
		end
		do return CHAMPIONSHIP_ROUNDS end
	end
	lastLeagueWeekend = function(division)
		local r = roundsFor(division)
		do return r[Js.alen(r)].calendarWeek end
	end
	playingWeekendOf = function(week, division, kind)
		local league = ((not Js.T(kind)) or (kind == "league"))
		local rounds = roundsFor(division)
		local playOff = (if (kind == "playoff") then PLAY_OFF_DAYS:get(week) else nil)
		if playOff then
			do return (lastLeagueWeekend(division) + playOff.weekendsAfter) end
		end
		if ((kind ~= "europe") and (week > Js.alen(rounds))) then
			do return (lastLeagueWeekend(division) + (week - Js.alen(rounds))) end
		end
		if (kind == "europe") then
			do return week end
		end
		if (league or (division ~= "premier")) then
			local slot = rounds[week]
			do return (if slot then slot.calendarWeek else week) end
		end
		do return week end
	end
	weekOnWeekend = function(division, calendarWeek)
		local i = A.findIndex(roundsFor(division), function(r)
			return ((r.calendarWeek == calendarWeek) and (r.day == "saturday"))
		end)
		do return (if (i >= 0) then (i + 1) else calendarWeek) end
	end
	exports.weekOnWeekend = weekOnWeekend
	CHAMPIONSHIP_POST_SEASON = function(n)
		do return (CHAMPIONSHIP_MATCHWEEKS + n) end
	end
	exports.CHAMPIONSHIP_POST_SEASON = CHAMPIONSHIP_POST_SEASON
	postSeasonFor = function(division, n)
		do return (if (division == "premier") then POST_SEASON(n) else CHAMPIONSHIP_POST_SEASON(n)) end
	end
	exports.postSeasonFor = postSeasonFor
	tournamentWeeksFor = function(division)
		do return A.map(Js.alit(3, 4, 5, 6, 7), function(n)
			return postSeasonFor(division, n)
		end) end
	end
	exports.tournamentWeeksFor = tournamentWeeksFor
	fixtureDate = function(startYear, season, week, day, division, kind)
		if division == nil then division = "premier" end
		local year = seasonStartYear(startYear, season)
		local opening = openingSaturday(year)
		if (week >= INTL_DAY_BASE) then
			do return Js.Date.new((opening:getTime() + ((week - INTL_DAY_BASE) * DAY_MS))) end
		end
		local saturday = (if (week < 1) then (opening:getTime() + (((week - 1) * 7) * DAY_MS)) else playingSaturday(year, playingWeekendOf(week, division, kind), division))
		local offset = (if (day == "saturday") then 0 else (if (day == "tuesday") then 3 else 4))
		local date = (saturday + (offset * DAY_MS))
		if (((offset > 0) and (week >= 1)) and stopsForBreaks(division)) then
			do return Js.Date.new(outOfBreak(year, date)) end
		end
		do return Js.Date.new(date) end
	end
	exports.fixtureDate = fixtureDate
	outOfBreak = function(year, date)
		if ((not Js.NumberNS.isFinite(date)) or (not Js.NumberNS.isFinite(year))) then
			do return date end
		end
		do
			local _arr3 = M_windows.seasonWindows(year)
			local _i4 = 0
			while _i4 < Js.alen(_arr3) do
				_i4 += 1
				local w = _arr3[_i4]
				if (w.kind == "jun") then
					do continue end
				end
				local start = w.start:getTime()
				local end_ = w["end"]:getTime()
				if (not ((date >= start) and (date <= end_))) then
					do continue end
				end
				local t = (end_ + DAY_MS)
				do
					local i = 0
					local _first5 = true
					while true do
						if not _first5 then
							i += 1
						end
						_first5 = false
						if not ((i < 7) and (Js.Date.new(t):getUTCDay() ~= 3)) then break end
						t += DAY_MS
					end
				end
				do return t end
			end
		end
		do return date end
	end
	intlWeek = function(startYear, season, date)
		local opening = openingSaturday(seasonStartYear(startYear, season))
		do return (INTL_DAY_BASE + math.floor(((date:getTime() - opening:getTime()) / DAY_MS))) end
	end
	exports.intlWeek = intlWeek
	isDatedWeek = function(week)
		do return (week >= INTL_DAY_BASE) end
	end
	exports.isDatedWeek = isDatedWeek
	playingSaturday = function(year, weekend, division)
		local opening = openingSaturday(year):getTime()
		if (not stopsForBreaks(division)) then
			do return (opening + (((weekend - 1) * 7) * DAY_MS)) end
		end
		local breaks = Js.Set.new(M_windows.breakSaturdays(year))
		local t = opening
		local k = 0
		do
			local guard = 0
			local _first6 = true
			while true do
				if not _first6 then
					guard += 1
					t += (7 * DAY_MS)
				end
				_first6 = false
				if not (guard < 200) then break end
				if breaks:has(t) then
					do continue end
				end
				if ((function() local _n = k + 1; k = _n; return _n end)() == weekend) then
					do return t end
				end
			end
		end
		do return t end
	end
	dayFor = function(kind, week, division)
		if division == nil then division = "premier" end
		local league = ((not Js.T(kind)) or (kind == "league"))
		local rounds = roundsFor(division)
		if ((league and (week >= 1)) and (week <= Js.alen(rounds))) then
			do return rounds[week].day end
		end
		if league then
			do return "saturday" end
		end
		local playOff = (if (kind == "playoff") then PLAY_OFF_DAYS:get(week) else nil)
		if playOff then
			do return playOff.day end
		end
		if ((week < 1) and (kind ~= "europe")) then
			do return "saturday" end
		end
		if isPostSeason(week, division) then
			do return "saturday" end
		end
		if (kind == "europe") then
			do return "tuesday" end
		end
		do return "wednesday" end
	end
	exports.dayFor = dayFor
	formatDate = function(d)
		do return (WEEKDAYS[d:getUTCDay() + 1] .. " " .. Js.numstr(d:getUTCDate()) .. " " .. MONTHS[d:getUTCMonth() + 1]) end
	end
	exports.formatDate = formatDate
	formatDateFull = function(d)
		do return (formatDate(d) .. " " .. Js.numstr(d:getUTCFullYear())) end
	end
	exports.formatDateFull = formatDateFull
	formatDateNumeric = function(d)
		local dd = S.padStart(Js.numstr(d:getUTCDate()), 2, "0")
		local mm = S.padStart(Js.numstr((d:getUTCMonth() + 1)), 2, "0")
		local yy = S.padStart(Js.numstr(math.fmod(d:getUTCFullYear(), 100)), 2, "0")
		do return (dd .. "/" .. mm .. "/" .. yy) end
	end
	exports.formatDateNumeric = formatDateNumeric
	fixtureDateLabel = function(startYear, season, week, kind, division)
		if division == nil then division = "premier" end
		do return formatDate(fixtureDate(startYear, season, week, dayFor(kind, week, division), division, kind)) end
	end
	exports.fixtureDateLabel = fixtureDateLabel
	fixtureTimestamp = function(startYear, season, week, kind, division)
		if division == nil then division = "premier" end
		do return fixtureDate(startYear, season, week, dayFor(kind, week, division), division, kind):getTime() end
	end
	exports.fixtureTimestamp = fixtureTimestamp
	leagueCupSlotsFor = function(division, inEurope)
		if inEurope == nil then inEurope = false end
		if (division == "premier") then
			do return (if inEurope then LEAGUE_CUP_SLOTS_IN_EUROPE else LEAGUE_CUP_SLOTS) end
		end
		if (division == "championship") then
			do return asRounds(LEAGUE_CUP_SLOTS, CHAMPIONSHIP_LEAGUE_CUP_SLOTS, division) end
		end
		do return Js.alit() end
	end
	exports.leagueCupSlotsFor = leagueCupSlotsFor
	asRounds = function(premier, fallback, division)
		if ((not stopsForBreaks(division)) or (division == "premier")) then
			do return fallback end
		end
		do return A.map(premier, function(s, i)
			return (if (s.week > MATCHWEEKS) then fallback[i + 1] else Js.ospread(s, Js.O({ week = weekOnWeekend(division, s.week) }, { "week" })))
		end) end
	end
	faCupSlotsFor = function(division, inEurope)
		if inEurope == nil then inEurope = false end
		if (division == "premier") then
			do return (if inEurope then FA_CUP_SLOTS_IN_EUROPE else FA_CUP_SLOTS) end
		end
		do return asRounds(FA_CUP_SLOTS, CHAMPIONSHIP_FA_CUP_SLOTS, division) end
	end
	exports.faCupSlotsFor = faCupSlotsFor
	inLowerLeagueTrophy = function(division)
		do return A.includes(LOWER_LEAGUE_TROPHY_DIVISIONS, division) end
	end
	exports.inLowerLeagueTrophy = inLowerLeagueTrophy
	lowerLeagueTrophySlotsFor = function(division)
		do return A.map(LOWER_LEAGUE_TROPHY_WEEKENDS, function(_p7)
			local round = _p7.round
			local weekend = _p7.weekend
			return Js.O({ round = round, week = (if (division == "premier") then weekend else weekOnWeekend(division, weekend)) }, { "round", "week" })
		end) end
	end
	exports.lowerLeagueTrophySlotsFor = lowerLeagueTrophySlotsFor
	faCupSlotsV1For = function(division, inEurope)
		if inEurope == nil then inEurope = false end
		if (division == "premier") then
			do return (if inEurope then FA_CUP_SLOTS_IN_EUROPE_V1 else FA_CUP_SLOTS_V1) end
		end
		if ((division == "championship") and inEurope) then
			do return asRounds(FA_CUP_WEEKENDS_CHAMPIONSHIP_IN_EUROPE_V1, CHAMPIONSHIP_FA_CUP_SLOTS_V1, division) end
		end
		do return asRounds(FA_CUP_SLOTS_V1, CHAMPIONSHIP_FA_CUP_SLOTS_V1, division) end
	end
	exports.faCupSlotsV1For = faCupSlotsV1For
	calendarMonthOf = function(startYear, season, week, division)
		if division == nil then division = "premier" end
		do return fixtureDate(startYear, season, week, "saturday", division):getUTCMonth() end
	end
	exports.calendarMonthOf = calendarMonthOf
	transferWindowFor = function(startYear, season, week, division)
		if division == nil then division = "premier" end
		local month = fixtureDate(startYear, season, week, dayFor("league", week, division), division, "league"):getUTCMonth()
		if (month == 0) then
			do return "january" end
		end
		if ((month == 7) or (month == 8)) then
			do return "summer" end
		end
		do return nil end
	end
	exports.transferWindowFor = transferWindowFor
	transferWindowOpen = function(startYear, season, week, division)
		if division == nil then division = "premier" end
		do return (transferWindowFor(startYear, season, week, division) ~= nil) end
	end
	exports.transferWindowOpen = transferWindowOpen
	MATCHWEEKS = 38
	exports.MATCHWEEKS = MATCHWEEKS
	PRE_SEASON_WEEK = 0
	exports.PRE_SEASON_WEEK = PRE_SEASON_WEEK
	LEAGUE_CUP_SLOTS = Js.alit(Js.O({ round = "Round of 32", week = 3 }, { "round", "week" }), Js.O({ round = "Round of 16", week = 8 }, { "round", "week" }), Js.O({ round = "Quarter-Final", week = 16 }, { "round", "week" }), Js.O({ round = "Semi-Final", week = 25, leg = 1 }, { "round", "week", "leg" }), Js.O({ round = "Semi-Final", week = 28, leg = 2 }, { "round", "week", "leg" }), Js.O({ round = "Final", week = POST_SEASON(1) }, { "round", "week" }))
	exports.LEAGUE_CUP_SLOTS = LEAGUE_CUP_SLOTS
	FA_CUP_SLOTS_V1 = Js.alit(Js.O({ round = "Round of 64", week = 2 }, { "round", "week" }), Js.O({ round = "Round of 32", week = 5 }, { "round", "week" }), Js.O({ round = "Round of 16", week = 12 }, { "round", "week" }), Js.O({ round = "Quarter-Final", week = 22 }, { "round", "week" }), Js.O({ round = "Semi-Final", week = 30 }, { "round", "week" }), Js.O({ round = "Final", week = POST_SEASON(2) }, { "round", "week" }))
	exports.FA_CUP_SLOTS_V1 = FA_CUP_SLOTS_V1
	FA_CUP_SLOTS = Js.alit(Js.O({ round = "Third Qualifying Round", week = 4 }, { "round", "week" }), Js.O({ round = "Fourth Qualifying Round", week = 7 }, { "round", "week" }), Js.O({ round = "First Round", week = 9 }, { "round", "week" }), Js.O({ round = "Second Round", week = 12 }, { "round", "week" }), Js.O({ round = "Third Round", week = 18 }, { "round", "week" }), Js.O({ round = "Fourth Round", week = 22 }, { "round", "week" }), Js.O({ round = "Fifth Round", week = 26 }, { "round", "week" }), Js.O({ round = "Quarter-Final", week = 30 }, { "round", "week" }), Js.O({ round = "Semi-Final", week = 32 }, { "round", "week" }), Js.O({ round = "Final", week = POST_SEASON(2) }, { "round", "week" }))
	exports.FA_CUP_SLOTS = FA_CUP_SLOTS
	EURO_LEAGUE_PHASE_WEEKS = Js.alit(5, 7, 9, 11, 13, 15, 22, 23)
	exports.EURO_LEAGUE_PHASE_WEEKS = EURO_LEAGUE_PHASE_WEEKS
	EURO_KO_SLOTS_WITH_R32 = Js.alit(Js.O({ round = "Round of 32", week = 25, leg = 1 }, { "round", "week", "leg" }), Js.O({ round = "Round of 32", week = 26, leg = 2 }, { "round", "week", "leg" }), Js.O({ round = "Round of 16", week = 28, leg = 1 }, { "round", "week", "leg" }), Js.O({ round = "Round of 16", week = 29, leg = 2 }, { "round", "week", "leg" }), Js.O({ round = "Quarter-Final", week = 31, leg = 1 }, { "round", "week", "leg" }), Js.O({ round = "Quarter-Final", week = 32, leg = 2 }, { "round", "week", "leg" }), Js.O({ round = "Semi-Final", week = 34, leg = 1 }, { "round", "week", "leg" }), Js.O({ round = "Semi-Final", week = 35, leg = 2 }, { "round", "week", "leg" }), Js.O({ round = "Final", week = 36 }, { "round", "week" }))
	exports.EURO_KO_SLOTS_WITH_R32 = EURO_KO_SLOTS_WITH_R32
	LEAGUE_CUP_SLOTS_IN_EUROPE = Js.alit(Js.O({ round = "Round of 32", week = 3 }, { "round", "week" }), Js.O({ round = "Round of 16", week = 8 }, { "round", "week" }), Js.O({ round = "Quarter-Final", week = 16 }, { "round", "week" }), Js.O({ round = "Semi-Final", week = 27, leg = 1 }, { "round", "week", "leg" }), Js.O({ round = "Semi-Final", week = 33, leg = 2 }, { "round", "week", "leg" }), Js.O({ round = "Final", week = POST_SEASON(1) }, { "round", "week" }))
	exports.LEAGUE_CUP_SLOTS_IN_EUROPE = LEAGUE_CUP_SLOTS_IN_EUROPE
	FA_CUP_SLOTS_IN_EUROPE_V1 = Js.alit(Js.O({ round = "Round of 64", week = 2 }, { "round", "week" }), Js.O({ round = "Round of 32", week = 6 }, { "round", "week" }), Js.O({ round = "Round of 16", week = 12 }, { "round", "week" }), Js.O({ round = "Quarter-Final", week = 20 }, { "round", "week" }), Js.O({ round = "Semi-Final", week = 30 }, { "round", "week" }), Js.O({ round = "Final", week = POST_SEASON(2) }, { "round", "week" }))
	exports.FA_CUP_SLOTS_IN_EUROPE_V1 = FA_CUP_SLOTS_IN_EUROPE_V1
	FA_CUP_SLOTS_IN_EUROPE = A.map(FA_CUP_SLOTS, function(s)
		if (s.round == "Fourth Round") then
			do return Js.ospread(s, Js.O({ week = 20 }, { "week" })) end
		end
		if (s.round == "Fifth Round") then
			do return Js.ospread(s, Js.O({ week = 25 }, { "week" })) end
		end
		if (s.round == "Quarter-Final") then
			do return Js.ospread(s, Js.O({ week = 26 }, { "week" })) end
		end
		if (s.round == "Semi-Final") then
			do return Js.ospread(s, Js.O({ week = 30 }, { "week" })) end
		end
		do return s end
	end)
	exports.FA_CUP_SLOTS_IN_EUROPE = FA_CUP_SLOTS_IN_EUROPE
	EURO_KO_SLOTS_SEEDED = A.filter(EURO_KO_SLOTS_WITH_R32, function(s)
		return (s.round ~= "Round of 32")
	end)
	exports.EURO_KO_SLOTS_SEEDED = EURO_KO_SLOTS_SEEDED
	TOURNAMENT_WEEKS = Js.alit(POST_SEASON(3), POST_SEASON(4), POST_SEASON(5), POST_SEASON(6), POST_SEASON(7))
	exports.TOURNAMENT_WEEKS = TOURNAMENT_WEEKS
	DIVISION_ORDER = Js.alit("premier", "championship", "league_one", "league_two", "national_league")
	exports.DIVISION_ORDER = DIVISION_ORDER
	ALL_DIVISIONS = Js.aspread(DIVISION_ORDER, Js.alit("national_league_north", "national_league_south"))
	exports.ALL_DIVISIONS = ALL_DIVISIONS
	REGIONAL_DIVISIONS = Js.alit("national_league_north", "national_league_south")
	exports.REGIONAL_DIVISIONS = REGIONAL_DIVISIONS
	CHAMPIONSHIP_MATCHWEEKS = 46
	exports.CHAMPIONSHIP_MATCHWEEKS = CHAMPIONSHIP_MATCHWEEKS
	OPENING_DAY = Js.O({ month = 7, day = 15 }, { "month", "day" })
	exports.OPENING_DAY = OPENING_DAY
	DAY_MS = 86400000
	CHAMPIONSHIP_MIDWEEK_WEEKS = Js.alit(1, 6, 10, 14, 19, 24, 27, 33)
	CHAMPIONSHIP_ROUNDS = buildRounds(MATCHWEEKS, CHAMPIONSHIP_MIDWEEK_WEEKS)
	PREMIER_MIDWEEK_WEEKS = Js.alit(17, 19, 21, 24)
	CHAMPIONSHIP_BREAK_MIDWEEK_WEEKS = Js.alit(1, 4, 6, 10, 14, 17, 19, 20, 21, 24, 27, 33)
	PREMIER_ROUNDS = buildRounds((MATCHWEEKS - Js.alen(PREMIER_MIDWEEK_WEEKS)), PREMIER_MIDWEEK_WEEKS)
	CHAMPIONSHIP_BREAK_ROUNDS = buildRounds((CHAMPIONSHIP_MATCHWEEKS - Js.alen(CHAMPIONSHIP_BREAK_MIDWEEK_WEEKS)), CHAMPIONSHIP_BREAK_MIDWEEK_WEEKS)
	INTL_DAY_BASE = 1000
	exports.INTL_DAY_BASE = INTL_DAY_BASE
	WEEKDAYS = Js.alit("Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat")
	MONTHS = Js.alit("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec")
	CHAMPIONSHIP_LEAGUE_CUP_SLOTS = Js.alit(Js.O({ round = "Round of 32", week = 4 }, { "round", "week" }), Js.O({ round = "Round of 16", week = 10 }, { "round", "week" }), Js.O({ round = "Quarter-Final", week = 20 }, { "round", "week" }), Js.O({ round = "Semi-Final", week = 31, leg = 1 }, { "round", "week", "leg" }), Js.O({ round = "Semi-Final", week = 35, leg = 2 }, { "round", "week", "leg" }), Js.O({ round = "Final", week = CHAMPIONSHIP_POST_SEASON(1) }, { "round", "week" }))
	exports.CHAMPIONSHIP_LEAGUE_CUP_SLOTS = CHAMPIONSHIP_LEAGUE_CUP_SLOTS
	CHAMPIONSHIP_FA_CUP_SLOTS_V1 = Js.alit(Js.O({ round = "Round of 64", week = 3 }, { "round", "week" }), Js.O({ round = "Round of 32", week = 6 }, { "round", "week" }), Js.O({ round = "Round of 16", week = 15 }, { "round", "week" }), Js.O({ round = "Quarter-Final", week = 27 }, { "round", "week" }), Js.O({ round = "Semi-Final", week = 37 }, { "round", "week" }), Js.O({ round = "Final", week = CHAMPIONSHIP_POST_SEASON(2) }, { "round", "week" }))
	exports.CHAMPIONSHIP_FA_CUP_SLOTS_V1 = CHAMPIONSHIP_FA_CUP_SLOTS_V1
	CHAMPIONSHIP_FA_CUP_SLOTS = A.map(FA_CUP_SLOTS, function(s)
		return (if (s.week > MATCHWEEKS) then Js.ospread(s, Js.O({ week = CHAMPIONSHIP_POST_SEASON(2) }, { "week" })) else Js.ospread(s, Js.O({ week = weekOnWeekend("league_one", s.week) }, { "week" })))
	end)
	exports.CHAMPIONSHIP_FA_CUP_SLOTS = CHAMPIONSHIP_FA_CUP_SLOTS
	PLAY_OFF_SLOTS = Js.alit(Js.O({ round = "Play-Off Semi-Final", week = CHAMPIONSHIP_POST_SEASON(3), leg = 1 }, { "round", "week", "leg" }), Js.O({ round = "Play-Off Semi-Final", week = CHAMPIONSHIP_POST_SEASON(4), leg = 2 }, { "round", "week", "leg" }), Js.O({ round = "Play-Off Final", week = CHAMPIONSHIP_POST_SEASON(5) }, { "round", "week" }))
	exports.PLAY_OFF_SLOTS = PLAY_OFF_SLOTS
	PLAY_OFF_DAYS = Js.Map.new(Js.alit(Js.alit(CHAMPIONSHIP_POST_SEASON(3), Js.O({ weekendsAfter = 0, day = "wednesday" }, { "weekendsAfter", "day" })), Js.alit(CHAMPIONSHIP_POST_SEASON(4), Js.O({ weekendsAfter = 1, day = "wednesday" }, { "weekendsAfter", "day" })), Js.alit(CHAMPIONSHIP_POST_SEASON(5), Js.O({ weekendsAfter = 3, day = "saturday" }, { "weekendsAfter", "day" }))))
	FA_CUP_WEEKENDS_CHAMPIONSHIP_IN_EUROPE_V1 = A.map(FA_CUP_SLOTS_V1, function(s)
		return (if (s.round == "Round of 32") then Js.ospread(s, Js.O({ week = 4 }, { "week" })) else s)
	end)
	LOWER_LEAGUE_TROPHY_DIVISIONS = Js.alit("league_one", "league_two", "national_league", "national_league_north", "national_league_south")
	exports.LOWER_LEAGUE_TROPHY_DIVISIONS = LOWER_LEAGUE_TROPHY_DIVISIONS
	LOWER_LEAGUE_TROPHY_WEEKENDS = Js.alit(Js.O({ round = "Round 1", weekend = 5 }, { "round", "weekend" }), Js.O({ round = "Round of 64", weekend = 8 }, { "round", "weekend" }), Js.O({ round = "Round of 32", weekend = 16 }, { "round", "weekend" }), Js.O({ round = "Round of 16", weekend = 21 }, { "round", "weekend" }), Js.O({ round = "Quarter-Final", weekend = 25 }, { "round", "weekend" }), Js.O({ round = "Semi-Final", weekend = 29 }, { "round", "weekend" }), Js.O({ round = "Final", weekend = 34 }, { "round", "weekend" }))
	exports.LOWER_LEAGUE_TROPHY_WEEKENDS = LOWER_LEAGUE_TROPHY_WEEKENDS
end
