--!nocheck
--!nolint
-- Generated from lib/star/records.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_calendar = import("lib/star/calendar")
	local playedLeagueFixtures, seasonBest, plCareer, plAssistsSeason, plGoalsSeason, plGoalsMatch, RECORDS, recordBeaten, updatePersonalBests
	playedLeagueFixtures = function(c)
		do return A.filter(c.fixtures, function(f)
			return ((f.kind == "league") and f.played)
		end) end
	end
	seasonBest = function(c, id, live)
		local locked = ((function() local _v = c.personalBests; if _v == nil then return nil end; _v = _v[id]; return _v end)() or 0)
		local now = live(c)
		do return (if (now == nil) then locked else Math.max(locked, now)) end
	end
	plCareer = function(c)
		if c.careerPlStats then
			do return c.careerPlStats end
		end
		local everPl = ((M_calendar.divisionOf(c) == "premier") or A.some((if c.seasonHistory ~= nil then c.seasonHistory else Js.alit()), function(h)
			return (h.division == "premier")
		end))
		do return (if (everPl and c.careerLeagueStats) then c.careerLeagueStats else Js.O({ goals = 0, assists = 0, appearances = 0 }, { "goals", "assists", "appearances" })) end
	end
	exports.plCareer = plCareer
	recordBeaten = function(c, r)
		do return (r.progress(c) >= r.value) end
	end
	exports.recordBeaten = recordBeaten
	updatePersonalBests = function(c)
		local best = Js.ospread((if c.personalBests ~= nil then c.personalBests else Js.O({}, nil)))
		do
			local _arr1 = RECORDS
			local _i2 = 0
			while _i2 < Js.alen(_arr1) do
				_i2 += 1
				local r = _arr1[_i2]
				if (not r.seasonValue) then
					do continue end
				end
				local v = r.seasonValue(c)
				if (v ~= nil) then
					best[r.id] = Math.max((if best[r.id] ~= nil then best[r.id] else 0), v)
				end
			end
		end
		do return best end
	end
	exports.updatePersonalBests = updatePersonalBests
	plAssistsSeason = function(c)
		return (if (M_calendar.divisionOf(c) ~= "premier") then nil else ((function() local _v = c.leagueSeasonStats; if _v == nil then return nil end; _v = _v.assists; return _v end)() or 0))
	end
	plGoalsSeason = function(c)
		return (if (M_calendar.divisionOf(c) ~= "premier") then nil else ((function() local _v = c.leagueSeasonStats; if _v == nil then return nil end; _v = _v.goals; return _v end)() or 0))
	end
	plGoalsMatch = function(c)
		if (M_calendar.divisionOf(c) ~= "premier") then
			do return nil end
		end
		local games = playedLeagueFixtures(c)
		do return (if Js.T(Js.alen(games)) then Math.max(Js.unpack(A.map(games, function(f)
			return (if f.userGoals ~= nil then f.userGoals else 0)
		end))) else nil) end
	end
	RECORDS = Js.alit(Js.O({ id = "pl-assists-season", label = "Most Assists in a Premier League Season", holder = "Bruno Fernandes", achieved = "2025/26", value = 21, unit = "assists", scope = "season", description = "21 assists across a single 38-game Premier League campaign.", seasonValue = plAssistsSeason, progress = function(c)
		return seasonBest(c, "pl-assists-season", plAssistsSeason)
	end }, { "id", "label", "holder", "achieved", "value", "unit", "scope", "description", "seasonValue", "progress" }), Js.O({ id = "pl-goals-season", label = "Most Goals in a Premier League Season", holder = "Erling Haaland", achieved = "2022/23", value = 36, unit = "goals", scope = "season", description = "36 goals in a single 38-game Premier League campaign, in his debut season at Manchester City.", seasonValue = plGoalsSeason, progress = function(c)
		return seasonBest(c, "pl-goals-season", plGoalsSeason)
	end }, { "id", "label", "holder", "achieved", "value", "unit", "scope", "description", "seasonValue", "progress" }), Js.O({ id = "pl-goals-match", label = "Most Goals in a Single Premier League Match", holder = "Held jointly — Andy Cole, Alan Shearer, Jermain Defoe and others", achieved = "several occasions", value = 5, unit = "goals", scope = "match", description = "5 goals in one Premier League match, a mark reached by a handful of strikers across the competition's history.", seasonValue = plGoalsMatch, progress = function(c)
		return seasonBest(c, "pl-goals-match", plGoalsMatch)
	end }, { "id", "label", "holder", "achieved", "value", "unit", "scope", "description", "seasonValue", "progress" }), Js.O({ id = "pl-goals-career", label = "Most Premier League Goals (Career)", holder = "Alan Shearer", achieved = "1992–2006", value = 260, unit = "goals", scope = "career", description = "260 goals across a whole Premier League career — the competition's all-time top scorer.", progress = function(c)
		return plCareer(c).goals
	end }, { "id", "label", "holder", "achieved", "value", "unit", "scope", "description", "progress" }), Js.O({ id = "pl-appearances-career", label = "Most Premier League Appearances (Career)", holder = "Gareth Barry", achieved = "1998–2017", value = 653, unit = "appearances", scope = "career", description = "653 Premier League appearances across a nineteen-season career.", progress = function(c)
		return plCareer(c).appearances
	end }, { "id", "label", "holder", "achieved", "value", "unit", "scope", "description", "progress" }), Js.O({ id = "pl-assists-career", label = "Most Premier League Assists (Career)", holder = "Ryan Giggs", achieved = "1992–2014", value = 162, unit = "assists", scope = "career", description = "162 Premier League assists, all for Manchester United.", progress = function(c)
		return plCareer(c).assists
	end }, { "id", "label", "holder", "achieved", "value", "unit", "scope", "description", "progress" }), Js.O({ id = "pl-scoring-run", label = "Most Consecutive Premier League Matches Scored In", holder = "Jamie Vardy", achieved = "2015/16", value = 11, unit = "matches", scope = "career", description = "Scored in 11 Premier League matches in a row for Leicester City, on the way to the title.", progress = function(c)
		return ((function() local _v = c.feats; if _v == nil then return nil end; _v = _v.bestPlScoringRun; return _v end)() or 0)
	end }, { "id", "label", "holder", "achieved", "value", "unit", "scope", "description", "progress" }), Js.O({ id = "pl-hat-tricks-career", label = "Most Premier League Hat-tricks (Career)", holder = "Sergio Agüero", achieved = "2011–2021", value = 12, unit = "hat-tricks", scope = "career", description = "12 Premier League hat-tricks for Manchester City.", progress = function(c)
		return ((function() local _v = c.feats; if _v == nil then return nil end; _v = _v.plHatTricks; return _v end)() or 0)
	end }, { "id", "label", "holder", "achieved", "value", "unit", "scope", "description", "progress" }), Js.O({ id = "pl-biggest-win", label = "Biggest Premier League Win", holder = "Manchester United (v Ipswich, 1995), and since", achieved = "several occasions", value = 9, unit = "goal margin", scope = "match", description = "A nine-goal winning margin — 9-0 — the biggest the Premier League has seen.", progress = function(c)
		return ((function() local _v = c.feats; if _v == nil then return nil end; _v = _v.bestPlWinMargin; return _v end)() or 0)
	end }, { "id", "label", "holder", "achieved", "value", "unit", "scope", "description", "progress" }), Js.O({ id = "england-caps", label = "Most England Caps", holder = "Peter Shilton", achieved = "1970–1990", value = 125, unit = "caps", scope = "career", description = "125 caps for England, the national record. Your caps count whichever country you play for.", progress = function(c)
		return (if c.caps ~= nil then c.caps else 0)
	end }, { "id", "label", "holder", "achieved", "value", "unit", "scope", "description", "progress" }))
	exports.RECORDS = RECORDS
end
