--!nocheck
--!nolint
-- Generated from lib/star/transferInterest.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_calendar = import("lib/star/calendar")
	local M_promotion = import("lib/star/promotion")
	local M_transferRequest = import("lib/star/transferRequest")
	local M_season = import("lib/star/season")
	local M_clubReputation = import("lib/star/clubReputation")
	local M_transfers = import("lib/star/transfers")
	local M_lowerLeagueTrophy = import("lib/star/lowerLeagueTrophy")
	local M_economy = import("lib/star/economy")
	local M_contracts = import("lib/star/contracts")
	local MAX_REACH, JANUARY_MAX_REACH, MIN_APPS_SUMMER, MIN_APPS_JANUARY, AIM_REPUTATION, AIM_FINISH, NEED_BONUS, CROWDED_PENALTY, WOBBLE, EDGE, levelOf, MEMBERSHIP_KEY, membersOf, curve, CONTRIBUTION_CURVE, RATING_CURVE, gradeOf, seasonReport, FEE_BANDS, FEE_PER_LEVEL_UP, roundFee, yourTransferValue, feeFrom, seeded, finishOf, clubAim, INTEREST_STEPS, windowKey, walkedAway, markWalkedAway, interestFor, GROUP_WORD, whyLine, europeOf, sortClubs, keenest, windowInterest, safeLadder, previousDivisions, withRecall, withAgreedWage, allInterested
	levelOf = function(division)
		do return (Js.alen(M_calendar.DIVISION_ORDER) - M_calendar.divisionRank(division)) end
	end
	exports.levelOf = levelOf
	membersOf = function(career, division)
		do return (if (division == M_calendar.divisionOf(career)) then A.map(career.league, function(t)
			return t.name
		end) else Js.aspread(M_promotion.membershipOf(career)[MEMBERSHIP_KEY[division]])) end
	end
	exports.membersOf = membersOf
	curve = function(x, pts)
		if (x <= pts[1][1]) then
			do return pts[1][2] end
		end
		for i = 1, (Js.alen(pts)) - 1 do
			local _d1 = pts[i + 1]
			local x1 = _d1[1]
			local y1 = _d1[2]
			if (x <= x1) then
				local _d2 = pts[i]
				local x0 = _d2[1]
				local y0 = _d2[2]
				do return (y0 + (((x - x0) / (x1 - x0)) * (y1 - y0))) end
			end
		end
		do return pts[Js.alen(pts)][2] end
	end
	gradeOf = function(reach)
		do return (if (reach < 0) then "D" else (if (reach < 1) then "C" else (if (reach < 2) then "B" else (if (reach < 3) then "A" else "S")))) end
	end
	exports.gradeOf = gradeOf
	seasonReport = function(career, window)
		if window == nil then window = "summer" end
		local s = career.seasonStats
		local apps = s.appearances
		local rating = (if (s.ratingCount > 0) then (s.totalRating / s.ratingCount) else nil)
		local perGame = (if (apps > 0) then ((s.goals + (0.5 * s.assists)) / apps) else 0)
		local ratingReach = (if (rating == nil) then 0 else curve(rating, RATING_CURVE))
		local group = M_transferRequest.positionGroup(career.player.position)
		local reach = nil
		if (group == "ATT") then
			reach = ((0.7 * curve(perGame, CONTRIBUTION_CURVE)) + (0.3 * ratingReach))
		elseif ((group == "MID") or (group == "WIDE")) then
			reach = ((0.4 * curve((perGame * 1.5), CONTRIBUTION_CURVE)) + (0.6 * ratingReach))
		else
			reach = ratingReach
		end
		if (apps > 0) then
			reach += (0.5 * Math.min(1, (s.starMan / apps)))
		end
		local minApps = (if (window == "january") then MIN_APPS_JANUARY else MIN_APPS_SUMMER)
		if (apps < minApps) then
			reach = Math.min(reach, 0)
		end
		reach = Math.max(-1, Math.min(MAX_REACH, reach))
		local cap = (if (window == "january") then JANUARY_MAX_REACH else MAX_REACH)
		local ceiling = Math.max(0, Math.min(cap, math.floor(reach)))
		do return Js.O({ apps = apps, goals = s.goals, assists = s.assists, rating = rating, starMan = s.starMan, reach = reach, grade = gradeOf(reach), ceiling = ceiling }, { "apps", "goals", "assists", "rating", "starMan", "reach", "grade", "ceiling" }) end
	end
	exports.seasonReport = seasonReport
	roundFee = function(v)
		if (v <= 0) then
			do return 0 end
		end
		local mag = Math.pow(10, Math.max(0, (math.floor(Math.log10(v)) - 1)))
		do return (Math.round((v / mag)) * mag) end
	end
	yourTransferValue = function(career)
		local _d3 = (FEE_BANDS[Js.key(levelOf(M_calendar.divisionOf(career)))] or FEE_BANDS["0"])
		local lo = _d3[1]
		local hi = _d3[2]
		local t = Math.max(0, Math.min(1, ((M_transferRequest.playerOverall(career) - 45) / 50)))
		local age = career.player.age
		local ageMult = (if (age < 22) then (1 + ((22 - age) * 0.08)) else (if (age <= 29) then 1 else Math.max(0.2, (1 - ((age - 29) * 0.12)))))
		do return roundFee(((lo * Math.pow((hi / lo), t)) * ageMult)) end
	end
	exports.yourTransferValue = yourTransferValue
	feeFrom = function(career, division, club, window)
		local up = Math.max(0, (levelOf(division) - levelOf(M_calendar.divisionOf(career))))
		local wobble = (0.9 + (seeded(career, window, club, 23) * 0.2))
		do return Math.max(1, roundFee(((yourTransferValue(career) * (1 + (up * FEE_PER_LEVEL_UP))) * wobble))) end
	end
	exports.feeFrom = feeFrom
	seeded = function(career, window, club, salt)
		local h = Js.bxor(Js.bxor(Js.bxor(2166136261, (career.season * 2654435761)), (if (window == "january") then 977 else 31)), salt)
		for i = 0, (S.len(club)) - 1 do
			h = Js.bxor(h, S.charCodeAt(club, i))
			h = Math.imul(h, 16777619)
		end
		h = Js.bxor(h, Js.ushr(h, 13))
		h = Math.imul(h, 1540483477)
		h = Js.bxor(h, Js.ushr(h, 15))
		do return (Js.ushr(h, 0) / 4294967296) end
	end
	finishOf = function(career, division, club, window)
		if window == nil then window = "summer" end
		if (division == M_calendar.divisionOf(career)) then
			local table_ = M_season.sortLeague(career.league)
			local at = A.findIndex(table_, function(t)
				return (t.name == club)
			end)
			if (at >= 0) then
				do return Js.O({ position = (at + 1), of = Js.alen(table_) }, { "position", "of" }) end
			end
		end
		local names = membersOf(career, division)
		local order = A.sort(A.map(names, function(n)
			return Js.O({ n = n, s = (M_promotion.estimateClubStrength(career, n) + ((seeded(career, window, n, 7) - 0.5) * 12)) }, { "n", "s" })
		end), function(a, b)
			return (b.s - a.s)
		end)
		local at = A.findIndex(order, function(o)
			return (o.n == club)
		end)
		do return Js.O({ position = (if (at >= 0) then (at + 1) else Js.alen(order)), of = Js.alen(order) }, { "position", "of" }) end
	end
	exports.finishOf = finishOf
	clubAim = function(career, division, club, window)
		if window == nil then window = "summer" end
		local standing = M_clubReputation.clubStanding(club, division)
		local _d4 = finishOf(career, division, club, window)
		local position = _d4.position
		local of = _d4.of
		local finish = (if (of > 1) then ((position - 1) / (of - 1)) else 0.5)
		do return ((levelOf(division) + (((standing - 0.5) * 2) * AIM_REPUTATION)) + (((0.5 - finish) * 2) * AIM_FINISH)) end
	end
	exports.clubAim = clubAim
	windowKey = function(career, window)
		do return (Js.numstr(career.season) .. "-" .. window) end
	end
	exports.windowKey = windowKey
	walkedAway = function(career, window)
		local w = career.transferWindow
		do return (if (w and (w.key == windowKey(career, window))) then w.walkedAway else Js.alit()) end
	end
	exports.walkedAway = walkedAway
	markWalkedAway = function(career, window, club)
		local key = windowKey(career, window)
		local prev = (if ((function() local _v = career.transferWindow; if _v == nil then return nil end; _v = _v.key; return _v end)() == key) then career.transferWindow.walkedAway else Js.alit())
		do return Js.ospread(career, Js.O({ transferWindow = Js.O({ key = key, walkedAway = Js.aspread(A.filter(prev, function(c)
			return (c ~= club)
		end), Js.alit(club)) }, { "key", "walkedAway" }) }, { "transferWindow" })) end
	end
	exports.markWalkedAway = markWalkedAway
	interestFor = function(margin)
		do return (if (margin >= 0.9) then "Desperate" else (if (margin >= 0.45) then "Very keen" else (if (margin >= 0.15) then "Keen" else "Interested"))) end
	end
	whyLine = function(level, gap, group, step)
		if gap then
			do return ("We need a " .. GROUP_WORD[group] .. ", and we want you.") end
		end
		if (step >= 2) then
			do return "Nobody's had a season like yours. We want you up here." end
		end
		if (level == "Desperate") then
			do return "We've wanted you all season." end
		end
		if (level == "Very keen") then
			do return "You're top of our list." end
		end
		if (level == "Keen") then
			do return "We like what we've seen." end
		end
		do return "We'd like to talk." end
	end
	europeOf = function(career, club)
		local e = career.euroState
		if (e and A.some(e.clubs, function(c)
			return (c.name == club)
		end)) then
			do return e.competition end
		end
		do return nil end
	end
	sortClubs = function(a, b)
		do return S.localeCompare(a.club, b.club) end
	end
	keenest = function(clubs)
		do return A.sort(Js.aspread(clubs), function(a, b)
			return (function() local _l = (INTEREST_STEPS[b.interest] - INTEREST_STEPS[a.interest]); if Js.T(_l) then return _l end; return (M_clubReputation.clubReputation(b.club) - M_clubReputation.clubReputation(a.club)) end)()
		end)[1] end
	end
	exports.keenest = keenest
	windowInterest = function(career, window, opts)
		if opts == nil then opts = Js.O({}, nil) end
		local report = seasonReport(career, window)
		local own = M_calendar.divisionOf(career)
		local yourLevel = levelOf(own)
		local age = career.player.age
		local ageAdj = (if (age <= 21) then 0.15 else (if (age <= 29) then 0 else (if (age <= 31) then -0.1 else (-0.15 * (age - 31)))))
		local you = (((yourLevel + report.reach) - EDGE) + ageAdj)
		local gone = Js.Set.new(walkedAway(career, window))
		local overall = M_transferRequest.playerOverall(career)
		local group = M_transferRequest.positionGroup(career.player.position)
		local rep = M_transfers.reputation(career)
		local ownStrength = M_promotion.estimateClubStrength(career, career.player.club)
		local leagues = Js.alit()
		local next_ = (if (window == "summer") then safeLadder(career) else nil)
		local ownNext = ((function() local _v = next_; if _v == nil then return nil end; _v = _v.division; return _v end)() or own)
		local nextMembers = function(d)
			if (not next_) then
				do return membersOf(career, d) end
			end
			do return (if (d == ownNext) then next_.clubs else Js.aspread(next_.divisions[MEMBERSHIP_KEY[d]])) end
		end
		local before = previousDivisions(career)
		local lowest = (levelOf(ownNext) - 1)
		local highest = Math.max((yourLevel + report.ceiling), levelOf(ownNext))
		local divisions = A.sort(A.filter(M_calendar.ALL_DIVISIONS, function(d)
			local lv = levelOf(d)
			do return ((lv >= lowest) and (lv <= highest)) end
		end), function(a, b)
			return (levelOf(b) - levelOf(a))
		end)
		do
			local _arr5 = divisions
			local _i6 = 0
			while _i6 < Js.alen(_arr5) do
				_i6 += 1
				local division = _arr5[_i6]
				local clubs = Js.alit()
				do
					local _arr7 = nextMembers(division)
					local _i8 = 0
					while _i8 < Js.alen(_arr7) do
						_i8 += 1
						local club = _arr7[_i8]
						if ((club == career.player.club) or gone:has(club)) then
							do continue end
						end
						local was = before:get(club)
						local moved = (if Js.T(was) then (if (was ~= division) then (if (levelOf(division) > levelOf(was)) then "promoted" else "relegated") else nil) else (if (opts.step3Promoted and next_) then "promoted" else nil))
						if (seeded(career, window, club, 3) > M_transfers.rivalInterestOdds(career.player.club, club)) then
							do continue end
						end
						local need = M_transferRequest.squadNeed(career, club, overall)
						local gap = (need.known and (need.better == 0))
						local crowded = (need.known and (need.better >= M_transferRequest.CROWDED_AT))
						local wobble = (((seeded(career, window, club, 11) - 0.5) * 2) * WOBBLE)
						local aim = (if Js.T(moved) then (levelOf(division) + (((M_clubReputation.clubStanding(club, division) - 0.5) * 2) * AIM_REPUTATION)) else ((clubAim(career, (if was ~= nil then was else division), club, window) - levelOf((if was ~= nil then was else division))) + levelOf(division)))
						local margin = (((((you + wobble) + (if gap then NEED_BONUS else 0)) - (if crowded then CROWDED_PENALTY else 0)) + M_lowerLeagueTrophy.lowerLeagueTrophyInterest(career, division)) - aim)
						if (margin < 0) then
							do continue end
						end
						local strength = M_promotion.estimateClubStrength(career, club)
						local step = (strength - ownStrength)
						local wage = Math.max(1, Math.round(M_economy.weeklyWageFor(club, division, M_economy.offerStanding(rep, step), career)))
						local s = (function() local _l = math.floor((seeded(career, window, club, 19) * (2 ^ 31))); if Js.T(_l) then return _l end; return 1 end)()
						local dealRng = function()
							s = math.fmod((s * 16807), 2147483647)
							do return ((s - 1) / 2147483646) end
						end
						local level = interestFor(margin)
						local _d9 = finishOf(career, (if was ~= nil then was else division), club, window)
						local position = _d9.position
						local of = _d9.of
						local why = whyLine(level, gap, group, (levelOf(division) - yourLevel))
						local fee = feeFrom(career, division, club, window)
						local offer = Js.O({ club = club, strength = strength, position = position, wage = wage, goalBonus = M_economy.goalBonusFor(wage), assistBonus = M_economy.assistBonusFor(wage), seasons = (2 + math.floor((dealRng() * 3))), signingFee = Math.max(1, Math.round((M_economy.signingOnFee(club, wage) * (0.8 + (dealRng() * 0.4))))), clauses = M_contracts.offerClauses(career, wage, dealRng), division = division, pitch = why, transferFee = fee }, { "club", "strength", "position", "wage", "goalBonus", "assistBonus", "seasons", "signingFee", "clauses", "division", "pitch", "transferFee" })
						A.push(clubs, Js.ospread(Js.O({ club = club, division = division, position = position, of = of, interest = level, why = why, fee = fee, offer = offer, europe = europeOf(career, club) }, { "club", "division", "position", "of", "interest", "why", "fee", "offer", "europe" }), (if Js.T(moved) then Js.O({ moved = moved }, { "moved" }) else Js.O({}, nil))))
					end
				end
				if Js.T(Js.alen(clubs)) then
					A.push(leagues, Js.O({ division = division, clubs = A.sort(clubs, sortClubs) }, { "division", "clubs" }))
				end
			end
		end
		do return Js.O({ window = window, key = windowKey(career, window), report = report, leagues = leagues, ownDivision = ownNext }, { "window", "key", "report", "leagues", "ownDivision" }) end
	end
	exports.windowInterest = windowInterest
	safeLadder = function(career)
		local _ok10, _err11, _rv12 = pcall(function()
			do return Js.RET, M_promotion.seasonLadder(career) end
		end)
		if not _ok10 then
			do return nil end
		elseif _err11 == Js.RET then
			return _rv12
		end
	end
	previousDivisions = function(career)
		local out = Js.Map.new()
		local m = M_promotion.membershipOf(career)
		do
			local _arr13 = M_calendar.ALL_DIVISIONS
			local _i14 = 0
			while _i14 < Js.alen(_arr13) do
				_i14 += 1
				local d = _arr13[_i14]
				do
					local _arr15 = m[MEMBERSHIP_KEY[d]]
					local _i16 = 0
					while _i16 < Js.alen(_arr15) do
						_i16 += 1
						local c = _arr15[_i16]
						out:set(c, d)
					end
				end
			end
		end
		do
			local _arr17 = career.league
			local _i18 = 0
			while _i18 < Js.alen(_arr17) do
				_i18 += 1
				local t = _arr17[_i18]
				out:set(t.name, M_calendar.divisionOf(career))
			end
		end
		do return out end
	end
	withRecall = function(interest, recall, career)
		if ((not Js.T((function() local _v = recall; if _v == nil then return nil end; _v = _v.division; return _v end)())) or (recall.club == career.player.club)) then
			do return interest end
		end
		local division = recall.division
		local _d19 = finishOf(career, division, recall.club, interest.window)
		local position = _d19.position
		local of = _d19.of
		local entry = Js.O({ club = recall.club, division = division, position = position, of = of, interest = "Desperate", why = recall.pitch, fee = 0, offer = Js.ospread(recall, Js.O({ position = position }, { "position" })) }, { "club", "division", "position", "of", "interest", "why", "fee", "offer" })
		local leagues = A.map(interest.leagues, function(l)
			return Js.ospread(l, Js.O({ clubs = A.filter(l.clubs, function(c)
				return (c.club ~= recall.club)
			end) }, { "clubs" }))
		end)
		local at = A.find(leagues, function(l)
			return (l.division == division)
		end)
		if at then
			at.clubs = A.sort(Js.aspread(Js.alit(entry), at.clubs), sortClubs)
		else
			A.push(leagues, Js.O({ division = division, clubs = Js.alit(entry) }, { "division", "clubs" }))
		end
		do return Js.ospread(interest, Js.O({ leagues = A.sort(A.filter(leagues, function(l)
			return Js.alen(l.clubs)
		end), function(a, b)
			return (levelOf(b.division) - levelOf(a.division))
		end) }, { "leagues" })) end
	end
	exports.withRecall = withRecall
	withAgreedWage = function(offer, wage)
		if (wage == offer.wage) then
			do return offer end
		end
		do return Js.ospread(offer, Js.O({ wage = wage, goalBonus = M_economy.goalBonusFor(wage), assistBonus = M_economy.assistBonusFor(wage), clauses = M_contracts.rescaleClauses(offer.clauses, offer.wage, wage) }, { "wage", "goalBonus", "assistBonus", "clauses" })) end
	end
	exports.withAgreedWage = withAgreedWage
	allInterested = function(interest)
		do return A.flatMap(interest.leagues, function(l)
			return l.clubs
		end) end
	end
	exports.allInterested = allInterested
	MAX_REACH = 3
	exports.MAX_REACH = MAX_REACH
	JANUARY_MAX_REACH = 1
	exports.JANUARY_MAX_REACH = JANUARY_MAX_REACH
	MIN_APPS_SUMMER = 10
	exports.MIN_APPS_SUMMER = MIN_APPS_SUMMER
	MIN_APPS_JANUARY = 6
	exports.MIN_APPS_JANUARY = MIN_APPS_JANUARY
	AIM_REPUTATION = 0.3
	exports.AIM_REPUTATION = AIM_REPUTATION
	AIM_FINISH = 0.3
	exports.AIM_FINISH = AIM_FINISH
	NEED_BONUS = 0.25
	exports.NEED_BONUS = NEED_BONUS
	CROWDED_PENALTY = 0.6
	exports.CROWDED_PENALTY = CROWDED_PENALTY
	WOBBLE = 0.25
	exports.WOBBLE = WOBBLE
	EDGE = 0.5
	exports.EDGE = EDGE
	MEMBERSHIP_KEY = Js.O({ premier = "premier", championship = "championship", league_one = "leagueOne", league_two = "leagueTwo", national_league = "nationalLeague", national_league_north = "nationalLeagueNorth", national_league_south = "nationalLeagueSouth" }, { "premier", "championship", "league_one", "league_two", "national_league", "national_league_north", "national_league_south" })
	CONTRIBUTION_CURVE = Js.alit(Js.alit(0, -0.5), Js.alit(0.25, 0), Js.alit(0.5, 1), Js.alit(1, 2), Js.alit(2, 3))
	exports.CONTRIBUTION_CURVE = CONTRIBUTION_CURVE
	RATING_CURVE = Js.alit(Js.alit(6, -0.5), Js.alit(6.6, 0), Js.alit(7.2, 1), Js.alit(7.8, 2), Js.alit(8.5, 3))
	exports.RATING_CURVE = RATING_CURVE
	FEE_BANDS = Js.O({ ["0"] = Js.alit(5000, 75000), ["1"] = Js.alit(10000, 200000), ["2"] = Js.alit(25000, 600000), ["3"] = Js.alit(75000, 2500000), ["4"] = Js.alit(300000, 15000000), ["5"] = Js.alit(3000000, 120000000) }, { "0", "1", "2", "3", "4", "5" })
	exports.FEE_BANDS = FEE_BANDS
	FEE_PER_LEVEL_UP = 0.3
	exports.FEE_PER_LEVEL_UP = FEE_PER_LEVEL_UP
	INTEREST_STEPS = Js.O({ Desperate = 4, ["Very keen"] = 3, Keen = 2, Interested = 1 }, { "Desperate", "Very keen", "Keen", "Interested" })
	exports.INTEREST_STEPS = INTEREST_STEPS
	GROUP_WORD = Js.O({ GK = "keeper", DEF = "defender", MID = "midfielder", WIDE = "winger", ATT = "striker" }, { "GK", "DEF", "MID", "WIDE", "ATT" })
end
