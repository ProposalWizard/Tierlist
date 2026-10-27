--!nocheck
--!nolint
-- Generated from lib/star/careerRecords.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local fullName, bestsAfterMatch, archiveRowFor, DEFENCE, MIDFIELD, bestMatesOf, historyRowFor, allSeasons, perClubTotals, trophiesByCompetition
	bestsAfterMatch = function(career, fixture, stats, seasonGoals, seasonAssists)
		local b = Js.ospread((if career.careerBests ~= nil then career.careerBests else Js.O({}, nil)))
		local season = career.season
		local opponent = fixture.opponent
		local me = fullName(career)
		do
			local _arr1 = (if stats.goalEvents ~= nil then stats.goalEvents else Js.alit())
			local _i2 = 0
			while _i2 < Js.alen(_arr1) do
				_i2 += 1
				local e = _arr1[_i2]
				if ((e.isUserGoal and (e.distance ~= nil)) and (e.distance > ((function() local _v = b.furthestGoal; if _v == nil then return nil end; _v = _v.metres; return _v end)() or -1))) then
					b.furthestGoal = Js.O({ metres = e.distance, season = season, opponent = opponent }, { "metres", "season", "opponent" })
				end
				if ((not e.isUserGoal) and (e.assist == me)) then
					local m = (if e.passLength ~= nil then e.passLength else e.distance)
					if ((m ~= nil) and (m > ((function() local _v = b.furthestAssist; if _v == nil then return nil end; _v = _v.metres; return _v end)() or -1))) then
						b.furthestAssist = Js.O({ metres = m, season = season, opponent = opponent }, { "metres", "season", "opponent" })
					end
				end
			end
		end
		do
			local _arr3 = (if stats.goalEvents ~= nil then stats.goalEvents else Js.alit())
			local _i4 = 0
			while _i4 < Js.alen(_arr3) do
				_i4 += 1
				local e = _arr3[_i4]
				if (((e.isUserGoal and Js.NumberNS.isFinite(e.minute)) and (e.minute >= 1)) and (e.minute < ((function() local _v = b.fastestGoal; if _v == nil then return nil end; _v = _v.minute; return _v end)() or math.huge))) then
					b.fastestGoal = Js.O({ minute = e.minute, season = season, opponent = opponent }, { "minute", "season", "opponent" })
				end
			end
		end
		do
			local us = (if fixture.home then stats.homeScore else stats.awayScore)
			local them = (if fixture.home then stats.awayScore else stats.homeScore)
			local best = (if b.biggestWin then (b.biggestWin.us - b.biggestWin.them) else 0)
			if ((us - them) > best) then
				b.biggestWin = Js.O({ us = us, them = them, season = season, opponent = opponent }, { "us", "them", "season", "opponent" })
			end
		end
		if ((stats.assists > 0) and (stats.assists > ((function() local _v = b.mostAssistsMatch; if _v == nil then return nil end; _v = _v.assists; return _v end)() or 0))) then
			b.mostAssistsMatch = Js.O({ assists = stats.assists, season = season, opponent = opponent }, { "assists", "season", "opponent" })
		end
		if ((stats.goals > 0) and (stats.goals > ((function() local _v = b.mostGoalsMatch; if _v == nil then return nil end; _v = _v.goals; return _v end)() or 0))) then
			b.mostGoalsMatch = Js.O({ goals = stats.goals, season = season, opponent = opponent }, { "goals", "season", "opponent" })
		end
		if ((seasonGoals > 0) and (seasonGoals > ((function() local _v = b.mostGoalsSeason; if _v == nil then return nil end; _v = _v.goals; return _v end)() or 0))) then
			b.mostGoalsSeason = Js.O({ goals = seasonGoals, season = season }, { "goals", "season" })
		end
		if ((seasonAssists > 0) and (seasonAssists > ((function() local _v = b.mostAssistsSeason; if _v == nil then return nil end; _v = _v.assists; return _v end)() or 0))) then
			b.mostAssistsSeason = Js.O({ assists = seasonAssists, season = season }, { "assists", "season" })
		end
		do return b end
	end
	exports.bestsAfterMatch = bestsAfterMatch
	archiveRowFor = function(career)
		local s = career.seasonStats
		do return Js.O({ season = career.season, club = (if career.thisSeasonClub ~= nil then career.thisSeasonClub else career.player.club), apps = s.appearances, goals = s.goals, assists = s.assists, avgRating = (if (s.ratingCount > 0) then (Math.round(((s.totalRating / s.ratingCount) * 100)) / 100) else 0), motm = s.starMan }, { "season", "club", "apps", "goals", "assists", "avgRating", "motm" }) end
	end
	exports.archiveRowFor = archiveRowFor
	bestMatesOf = function(squad, max)
		if max == nil then max = 5 end
		local pool = A.filter((if squad ~= nil then squad else Js.alit()), function(p)
			return ((p and (type(p.name) == "string")) and (S.len(p.name) > 0))
		end)
		if (Js.alen(pool) == 0) then
			do return Js.alit() end
		end
		local ov = function(p)
			return (if p.overall ~= nil then p.overall else 60)
		end
		local worth = function(p)
			return (ov(p) + (((if p.seasonGoals ~= nil then p.seasonGoals else 0) + (if p.seasonAssists ~= nil then p.seasonAssists else 0)) * 0.6))
		end
		local by = function(f)
			return A.sort(Js.aspread(pool), function(a, b)
				return (function() local _l = (f(b) - f(a)); if Js.T(_l) then return _l end; return (ov(b) - ov(a)) end)()
			end)
		end
		local picked = Js.alit()
		local take = function(p)
			if ((p and (not A.includes(picked, p))) and (Js.alen(picked) < max)) then
				A.push(picked, p)
			end
		end
		local scorer = by(function(p)
			return (if p.seasonGoals ~= nil then p.seasonGoals else 0)
		end)[1]
		if (scorer and ((if scorer.seasonGoals ~= nil then scorer.seasonGoals else 0) > 0)) then
			take(scorer)
		end
		local creator = A.find(by(function(p)
			return (if p.seasonAssists ~= nil then p.seasonAssists else 0)
		end), function(p)
			return (not A.includes(picked, p))
		end)
		if (creator and ((if creator.seasonAssists ~= nil then creator.seasonAssists else 0) > 0)) then
			take(creator)
		end
		take(A.find(by(ov), function(p)
			return ((p.position == "GK") and (not A.includes(picked, p)))
		end))
		take(A.find(by(ov), function(p)
			return (DEFENCE:has(p.position) and (not A.includes(picked, p)))
		end))
		take(A.find(by(worth), function(p)
			return (MIDFIELD:has(p.position) and (not A.includes(picked, p)))
		end))
		do
			local _arr5 = by(worth)
			local _i6 = 0
			while _i6 < Js.alen(_arr5) do
				_i6 += 1
				local p = _arr5[_i6]
				take(p)
			end
		end
		do return A.map(picked, function(p)
			return Js.ospread(Js.O({ id = p.id, name = p.name, position = p.position }, { "id", "name", "position" }), (if (type(p.overall) == "number") then Js.O({ overall = p.overall }, { "overall" }) else Js.O({}, nil)), (if Js.T(p.imageUrl) then Js.O({ face = p.imageUrl }, { "face" }) else Js.O({}, nil)), Js.O({ goals = (if p.seasonGoals ~= nil then p.seasonGoals else 0), assists = (if p.seasonAssists ~= nil then p.seasonAssists else 0) }, { "goals", "assists" }))
		end) end
	end
	exports.bestMatesOf = bestMatesOf
	historyRowFor = function(career, facts)
		local w = facts.winners
		local inEurope = (function() local _v = career.euroState; if _v == nil then return nil end; _v = _v.competition; return _v end)()
		local realCL = ((facts.division == "premier") or (inEurope == "Champions League"))
		local realEL = ((facts.division == "premier") or (inEurope == "Europa League"))
		do return Js.ospread(Js.O({ season = career.season, age = career.player.age, club = ((if facts.club ~= nil then facts.club else career.thisSeasonClub) or career.player.club), division = facts.division, position = facts.position, teams = facts.teams, move = (if facts.move ~= nil then facts.move else nil), winners = Js.ospread((if Js.T(w.league) then Js.O({ league = w.league }, { "league" }) else Js.O({}, nil)), (if Js.T(w.faCup) then Js.O({ faCup = w.faCup }, { "faCup" }) else Js.O({}, nil)), (if Js.T(w.leagueCup) then Js.O({ leagueCup = w.leagueCup }, { "leagueCup" }) else Js.O({}, nil)), (if (realCL and Js.T(w.championsLeague)) then Js.O({ championsLeague = w.championsLeague }, { "championsLeague" }) else Js.O({}, nil)), (if (realEL and Js.T(w.europaLeague)) then Js.O({ europaLeague = w.europaLeague }, { "europaLeague" }) else Js.O({}, nil))) }, { "season", "age", "club", "division", "position", "teams", "move", "winners" }), (if facts.ballonDor then Js.O({ ballonDor = facts.ballonDor }, { "ballonDor" }) else Js.O({}, nil)), (if (type(career.stars) == "number") then Js.O({ stars = career.stars }, { "stars" }) else Js.O({}, nil)), Js.O({ overall = career.starRating, fame = career.fame, money = (if facts.money ~= nil then facts.money else career.money), wage = (if facts.wage ~= nil then facts.wage else career.contract.wage), caps = (if career.caps ~= nil then career.caps else 0), intlGoals = (if career.internationalGoals ~= nil then career.internationalGoals else 0) }, { "overall", "fame", "money", "wage", "caps", "intlGoals" }), (if (facts.mates and (Js.alen(facts.mates) > 0)) then Js.O({ mates = facts.mates }, { "mates" }) else Js.O({}, nil))) end
	end
	exports.historyRowFor = historyRowFor
	allSeasons = function(career)
		local rows = Js.aspread((if career.seasonArchive ~= nil then career.seasonArchive else Js.alit()))
		if ((career.seasonStats.appearances > 0) and (not A.some(rows, function(r)
			return (r.season == career.season)
		end))) then
			A.push(rows, Js.ospread(archiveRowFor(career), Js.O({ live = true }, { "live" })))
		end
		do return rows end
	end
	exports.allSeasons = allSeasons
	perClubTotals = function(career)
		local by = Js.Map.new()
		do
			local _arr7 = allSeasons(career)
			local _i8 = 0
			while _i8 < Js.alen(_arr7) do
				_i8 += 1
				local r = _arr7[_i8]
				local t = (by:get(r.club) or Js.O({ club = r.club, seasons = 0, apps = 0, goals = 0, assists = 0 }, { "club", "seasons", "apps", "goals", "assists" }))
				t.seasons += 1
				t.apps += r.apps
				t.goals += r.goals
				t.assists += r.assists
				by:set(r.club, t)
			end
		end
		do return A.sort(Js.Array.from(by:values()), function(a, b)
			return (b.apps - a.apps)
		end) end
	end
	exports.perClubTotals = perClubTotals
	trophiesByCompetition = function(career)
		local by = Js.Map.new()
		do
			local _arr9 = career.trophies
			local _i10 = 0
			while _i10 < Js.alen(_arr9) do
				_i10 += 1
				local t = _arr9[_i10]
				by:set(t.competition, Js.aspread((by:get(t.competition) or Js.alit()), Js.alit(t.season)))
			end
		end
		do return A.sort(A.map(Js.Array.from(by:entries()), function(_p11)
			local competition = _p11[1]
			local seasons = _p11[2]
			return Js.O({ competition = competition, seasons = seasons }, { "competition", "seasons" })
		end), function(a, b)
			return (Js.alen(b.seasons) - Js.alen(a.seasons))
		end) end
	end
	exports.trophiesByCompetition = trophiesByCompetition
	fullName = function(c)
		return (c.player.firstName .. " " .. c.player.lastName)
	end
	DEFENCE = Js.Set.new(Js.alit("CB", "LB", "RB"))
	MIDFIELD = Js.Set.new(Js.alit("CDM", "CM", "CAM"))
end
