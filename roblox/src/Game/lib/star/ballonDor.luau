--!nocheck
--!nolint
-- Generated from lib/star/ballonDor.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_careerFlow = import("lib/star/careerFlow")
	local M_calendar = import("lib/star/calendar")
	local M_season = import("lib/star/season")
	local M_scorers = import("lib/star/intl/scorers")
	local M_nations = import("lib/star/intl/nations")
	local M_clubLeagues = import("lib/star/clubLeagues")
	local TROPHY_POINTS, trophyTierOf, worldClubTrophies, trophyPointsFor, ratingProxy, ATTACK_WEIGHT, ELITE_FROM, ELITE_GOALS, ELITE_ASSISTS, simulatedSeasonFor, clamp, clubNameHash, you, intlPart, domesticRivals, internationalRivals, scoreOf, SHORTLIST_SIZE, BALLON_DOR_MAJORS, wonMajorThisSeason, ballonDorReach, computeBallonDorShortlist
	trophyTierOf = function(competition)
		local pts = TROPHY_POINTS[competition]
		if (pts == nil) then
			do return nil end
		end
		if (pts >= 50) then
			do return "major" end
		end
		if (pts >= 30) then
			do return "medium" end
		end
		if (pts >= 15) then
			do return "minor" end
		end
		do return "small" end
	end
	exports.trophyTierOf = trophyTierOf
	worldClubTrophies = function(career)
		local winners = M_careerFlow.resolveSeasonWinners(career)
		local leagueName = M_calendar.leagueNameFor(M_calendar.divisionOf(career))
		local out = Js.alit()
		if Js.T(winners.league) then
			A.push(out, Js.O({ club = winners.league, competition = leagueName }, { "club", "competition" }))
		end
		if Js.T(winners.faCup) then
			A.push(out, Js.O({ club = winners.faCup, competition = "FA Cup" }, { "club", "competition" }))
		end
		if Js.T(winners.leagueCup) then
			A.push(out, Js.O({ club = winners.leagueCup, competition = "League Cup" }, { "club", "competition" }))
		end
		if Js.T(winners.championsLeague) then
			A.push(out, Js.O({ club = winners.championsLeague, competition = "Champions League" }, { "club", "competition" }))
		end
		if Js.T(winners.europaLeague) then
			A.push(out, Js.O({ club = winners.europaLeague, competition = "Europa League" }, { "club", "competition" }))
		end
		do
			local _arr1 = (if career.trophies ~= nil then career.trophies else Js.alit())
			local _i2 = 0
			while _i2 < Js.alen(_arr1) do
				_i2 += 1
				local t = _arr1[_i2]
				if (t.season ~= career.season) then
					do continue end
				end
				if ((t.competition == "Community Shield") or (t.competition == "Super Cup")) then
					A.push(out, t)
				end
			end
		end
		do return out end
	end
	trophyPointsFor = function(club, world)
		local won = A.filter(world, function(t)
			return (t.club == club)
		end)
		do return Js.O({ points = A.reduce(won, function(sum, t)
			return (sum + (if TROPHY_POINTS[t.competition] ~= nil then TROPHY_POINTS[t.competition] else 0))
		end, 0), names = A.map(won, function(t)
			return t.competition
		end) }, { "points", "names" }) end
	end
	ratingProxy = function(overall)
		do return (5 + ((Math.max(0, (overall - 50)) / 50) * 4)) end
	end
	simulatedSeasonFor = function(p, season)
		local rng = M_season.mulberry32((clubNameHash(p.id) + (season * 7919)))
		local quality = clamp(((p.overall - 58) / 37), 0, 1)
		local weight = (if ATTACK_WEIGHT[p.position] ~= nil then ATTACK_WEIGHT[p.position] else 0.3)
		local elite = Math.max(0, (p.overall - ELITE_FROM))
		local goals = Math.round((((quality * weight) * (16 + (rng() * 16))) + ((elite * weight) * (ELITE_GOALS + (rng() * ELITE_GOALS)))))
		local assists = Math.round((((quality * ((weight * 0.7) + 0.15)) * (8 + (rng() * 12))) + (((elite * ((weight * 0.7) + 0.15)) * ELITE_ASSISTS) * (1 + rng()))))
		do return Js.O({ goals = goals, assists = assists }, { "goals", "assists" }) end
	end
	clamp = function(v, lo, hi)
		do return Math.max(lo, Math.min(hi, v)) end
	end
	clubNameHash = function(s)
		local h = 2166136261
		for i = 0, (S.len(s)) - 1 do
			h = Js.bxor(h, S.charCodeAt(s, i))
			h = Math.imul(h, 16777619)
		end
		do return Js.ushr(h, 0) end
	end
	you = function(career, intl)
		local stats = career.seasonStats
		local avgRating = (if (stats.ratingCount > 0) then (stats.totalRating / stats.ratingCount) else 0)
		local ig = ((function() local _v = intl; if _v == nil then return nil end; _v = _v.you; _v = _v.goals; return _v end)() or 0)
		local ia = ((function() local _v = intl; if _v == nil then return nil end; _v = _v.you; _v = _v.assists; return _v end)() or 0)
		do return Js.O({ name = (career.player.firstName .. " " .. career.player.lastName), club = career.player.club, overall = 0, goals = (stats.goals + ig), assists = (stats.assists + ia), rating = avgRating, ratingIsReal = (stats.ratingCount > 0), intlGoals = ig, intlAssists = ia, isPlayer = true, image = career.player.portrait }, { "name", "club", "overall", "goals", "assists", "rating", "ratingIsReal", "intlGoals", "intlAssists", "isPlayer", "image" }) end
	end
	intlPart = function(intl, nation, name)
		if (not intl) then
			do return Js.O({ intlGoals = 0, intlAssists = 0 }, { "intlGoals", "intlAssists" }) end
		end
		local t = M_scorers.intlTallyOf(intl, nation, name)
		local n = (if Js.T(nation) then (function() local _v = M_nations.nationFor(nation); if _v == nil then return nil end; _v = _v.name; return _v end)() else nil)
		local comp = (if Js.T(n) then intl.champions:get(n) else nil)
		local won = (if ((Js.T(comp) and Js.T(n)) and intl.championSquads:has(M_scorers.tallyKey(n, name))) then comp else nil)
		do return Js.ospread(Js.O({ intlGoals = t.goals, intlAssists = t.assists }, { "intlGoals", "intlAssists" }), (if Js.T(won) then Js.O({ nationTrophy = won }, { "nationTrophy" }) else Js.O({}, nil))) end
	end
	domesticRivals = function(career, intl)
		local out = Js.alit()
		do
			local _arr3 = (if career.leagueSquads ~= nil then career.leagueSquads else Js.alit())
			local _i4 = 0
			while _i4 < Js.alen(_arr3) do
				_i4 += 1
				local sq = _arr3[_i4]
				if (sq.club == career.player.club) then
					do continue end
				end
				do
					local _arr5 = sq.players
					local _i6 = 0
					while _i6 < Js.alen(_arr5) do
						_i6 += 1
						local p = _arr5[_i6]
						local ip = intlPart(intl, p.nation, p.name)
						A.push(out, Js.ospread(Js.O({ name = p.name, club = sq.club, overall = p.overall, goals = (p.goals + ip.intlGoals), assists = (p.assists + ip.intlAssists), rating = ratingProxy(p.overall), ratingIsReal = false }, { "name", "club", "overall", "goals", "assists", "rating", "ratingIsReal" }), ip, Js.O({ isPlayer = false, image = p.image }, { "isPlayer", "image" })))
					end
				end
			end
		end
		do return out end
	end
	internationalRivals = function(career, season, intl)
		local out = Js.alit()
		do
			local _arr7 = (if career.externalSquads ~= nil then career.externalSquads else Js.alit())
			local _i8 = 0
			while _i8 < Js.alen(_arr7) do
				_i8 += 1
				local sq = _arr7[_i8]
				local best = A.sort(Js.aspread(sq.players), function(a, b)
					return (b.overall - a.overall)
				end)[1]
				if (not best) then
					do continue end
				end
				local sim = simulatedSeasonFor(Js.O({ id = (sq.club .. ":" .. best.id), overall = best.overall, position = best.position }, { "id", "overall", "position" }), season)
				local ip = intlPart(intl, best.nation, best.name)
				A.push(out, Js.ospread(Js.O({ name = best.name, club = sq.club, overall = best.overall, goals = (sim.goals + ip.intlGoals), assists = (sim.assists + ip.intlAssists), rating = ratingProxy(best.overall), ratingIsReal = false }, { "name", "club", "overall", "goals", "assists", "rating", "ratingIsReal" }), ip, Js.O({ isPlayer = false, image = best.image }, { "isPlayer", "image" })))
			end
		end
		do return out end
	end
	scoreOf = function(c, world, internationalPoints)
		local club = trophyPointsFor(c.club, world)
		local nation = (if c.isPlayer then internationalPoints else (if Js.T(c.nationTrophy) then (if TROPHY_POINTS[c.nationTrophy] ~= nil then TROPHY_POINTS[c.nationTrophy] else 0) else 0))
		local trophyPoints = (club.points + nation)
		local base = ((((c.goals * 4) + (c.assists * 2)) + (c.rating * 10)) + trophyPoints)
		do return Js.O({ score = (base * M_clubLeagues.leagueMultiplierFor(c.club)), trophyNames = (if Js.T(c.nationTrophy) then Js.aspread(club.names, Js.alit(c.nationTrophy)) else club.names) }, { "score", "trophyNames" }) end
	end
	wonMajorThisSeason = function(career)
		do return A.some((if career.trophies ~= nil then career.trophies else Js.alit()), function(t)
			return ((t.season == career.season) and A.includes(BALLON_DOR_MAJORS, t.competition))
		end) end
	end
	exports.wonMajorThisSeason = wonMajorThisSeason
	ballonDorReach = function(career, pool)
		local division = M_calendar.divisionOf(career)
		if (division == "championship") then
			local you = A.find(pool, function(c)
				return c.isPlayer
			end)
			local topScorer = ((not (not you)) and A.every(pool, function(c)
				return (c.isPlayer or (c.goals < you.goals))
			end))
			local wonWorldCup = A.some((if career.trophies ~= nil then career.trophies else Js.alit()), function(t)
				return ((t.season == career.season) and (t.competition == "World Cup"))
			end)
			do return (if (topScorer and wonWorldCup) then "win" else "shortlist") end
		end
		if (division == "premier") then
			do return (if wonMajorThisSeason(career) then "win" else "shortlist") end
		end
		do return "none" end
	end
	exports.ballonDorReach = ballonDorReach
	computeBallonDorShortlist = function(career)
		local world = worldClubTrophies(career)
		local yourInternationalTrophies = A.filter((if career.trophies ~= nil then career.trophies else Js.alit()), function(t)
			return ((t.season == career.season) and ((t.competition == "World Cup") or (t.competition == "European Championship")))
		end)
		local internationalTrophyPoints = A.reduce(yourInternationalTrophies, function(sum, t)
			return (sum + (if TROPHY_POINTS[t.competition] ~= nil then TROPHY_POINTS[t.competition] else 0))
		end, 0)
		local intl = nil
		local _ok9, _err10, _rv11 = pcall(function()
			intl = M_scorers.intlSeason(career)
		end)
		if not _ok9 then
			intl = nil
		elseif _err10 == Js.RET then
			return _rv11
		end
		local pool = Js.aspread(Js.alit(you(career, intl)), domesticRivals(career, intl), internationalRivals(career, career.season, intl))
		local reach = ballonDorReach(career, pool)
		local scored = A.map(A.filter(pool, function(c)
			return (not (c.isPlayer and (reach == "none")))
		end), function(c)
			local _d12 = scoreOf(c, world, internationalTrophyPoints)
			local score = _d12.score
			local trophyNames = _d12.trophyNames
			do return Js.O({ c = c, score = score, trophyNames = trophyNames }, { "c", "score", "trophyNames" }) end
		end)
		A.sort(scored, function(a, b)
			return (b.score - a.score)
		end)
		if (((reach == "shortlist") and (function() local _v = scored[1]; if _v == nil then return nil end; _v = _v.c; _v = _v.isPlayer; return _v end)()) and (Js.alen(scored) > 1)) then
			local _d13 = Js.alit(scored[2], scored[1])
			A.set(scored, 0, _d13[1])
			A.set(scored, 1, _d13[2])
		end
		local cannotWin = (((reach == "shortlist") and (Js.alen(scored) == 1)) and (function() local _v = scored[1]; if _v == nil then return nil end; _v = _v.c; _v = _v.isPlayer; return _v end)())
		local top = A.slice(scored, 0, SHORTLIST_SIZE)
		local entries = A.map(top, function(t, i)
			return Js.O({ rank = (i + 1), isPlayer = t.c.isPlayer, name = t.c.name, club = t.c.club, goals = t.c.goals, assists = t.c.assists, rating = t.c.rating, ratingIsReal = t.c.ratingIsReal, trophies = (if t.c.isPlayer then Js.aspread(t.trophyNames, A.map(yourInternationalTrophies, function(tr)
				return tr.competition
			end)) else t.trophyNames), score = Math.round(t.score), intlGoals = t.c.intlGoals, intlAssists = t.c.intlAssists, image = t.c.image }, { "rank", "isPlayer", "name", "club", "goals", "assists", "rating", "ratingIsReal", "trophies", "score", "intlGoals", "intlAssists", "image" })
		end)
		local playerIdx = A.findIndex(entries, function(e)
			return e.isPlayer
		end)
		if cannotWin then
			do return Js.O({ entries = entries, playerRank = 0, playerNominated = false }, { "entries", "playerRank", "playerNominated" }) end
		end
		do return Js.O({ entries = entries, playerRank = (playerIdx + 1), playerNominated = (playerIdx >= 0) }, { "entries", "playerRank", "playerNominated" }) end
	end
	exports.computeBallonDorShortlist = computeBallonDorShortlist
	TROPHY_POINTS = Js.O({ ["Champions League"] = 50, ["Premier League"] = 50, Championship = 50, ["World Cup"] = 50, ["European Championship"] = 50, ["Europa League"] = 30, ["FA Cup"] = 30, ["League Cup"] = 15, ["Super Cup"] = 5, ["Community Shield"] = 5 }, { "Champions League", "Premier League", "Championship", "World Cup", "European Championship", "Europa League", "FA Cup", "League Cup", "Super Cup", "Community Shield" })
	ATTACK_WEIGHT = Js.O({ ST = 1, LW = 0.85, RW = 0.85, CAM = 0.8, CM = 0.45, CDM = 0.3, LB = 0.2, RB = 0.2, CB = 0.12, GK = 0.02 }, { "ST", "LW", "RW", "CAM", "CM", "CDM", "LB", "RB", "CB", "GK" })
	ELITE_FROM = 85
	ELITE_GOALS = 2
	ELITE_ASSISTS = 1
	SHORTLIST_SIZE = 10
	BALLON_DOR_MAJORS = Js.alit("Premier League", "Champions League", "World Cup", "European Championship")
	exports.BALLON_DOR_MAJORS = BALLON_DOR_MAJORS
end
