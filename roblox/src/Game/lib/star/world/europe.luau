--!nocheck
--!nolint
-- Generated from lib/star/world/europe.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_euro = import("lib/star/euro")
	local M_season = import("lib/star/season")
	local M_calendar = import("lib/star/calendar")
	local M_leagueSquads = import("lib/star/leagueSquads")
	local M_realSquad = import("lib/star/realSquad")
	local M_euroBracket = import("lib/star/euroBracket")
	local COMP_SALT, seed, openWorldEuro, schedule, euroTime, koRoundTime, add, playMatchday, advanceWorldEuro
	seed = function(season, comp, step, salt)
		if salt == nil then salt = 0 end
		do return Js.ushr(Js.bxor(Js.bxor(Math.imul(season, 2246822519), Math.imul((COMP_SALT[comp] + salt), 3266489917)), Math.imul((step + 1), 668265263)), 0) end
	end
	openWorldEuro = function(career, competition)
		local clubs = M_euro.poolFor(competition, career)
		local table_ = A.map(clubs, function(c)
			return Js.O({ name = c.name, played = 0, won = 0, drawn = 0, lost = 0, goalsFor = 0, goalsAgainst = 0, points = 0, isYou = false }, { "name", "played", "won", "drawn", "lost", "goalsFor", "goalsAgainst", "points", "isYou" })
		end)
		do return Js.O({ competition = competition, clubs = clubs, table = table_, matchdays = 0, koRounds = 0, scorers = Js.O({}, nil) }, { "competition", "clubs", "table", "matchdays", "koRounds", "scorers" }) end
	end
	exports.openWorldEuro = openWorldEuro
	schedule = function(season, w)
		local rng = M_season.mulberry32(seed(season, w.competition, 99))
		local order = A.map(w.clubs, function(c)
			return c.name
		end)
		for i = (Js.alen(order) - 1), 1, -1 do
			local j = math.floor((rng() * (i + 1)))
			local _d1 = Js.alit(order[j + 1], order[i + 1])
			A.set(order, i, _d1[1])
			A.set(order, j, _d1[2])
		end
		do return A.filter(M_season.buildSeasonFixtures(order), function(f)
			return (f.week <= Js.alen(M_calendar.EURO_LEAGUE_PHASE_WEEKS))
		end) end
	end
	euroTime = function(career, week)
		do return M_calendar.fixtureTimestamp(career.player.startYear, career.season, week, "europe", "premier") end
	end
	koRoundTime = function(career, round)
		local weeks = A.map(A.filter(M_calendar.EURO_KO_SLOTS_WITH_R32, function(s)
			return (s.round == round)
		end), function(s)
			return s.week
		end)
		do return euroTime(career, Math.max(Js.unpack(weeks))) end
	end
	add = function(counts, id, goal)
		local c = (if counts[id] ~= nil then counts[id] else Js.alit(0, 0))
		counts[id] = (if goal then Js.alit((c[1] + 1), c[2]) else Js.alit(c[1], (c[2] + 1)))
	end
	playMatchday = function(career, w, md, squadOf)
		local strength = Js.Map.new(A.map(w.clubs, function(c)
			return Js.alit(c.name, c.strength)
		end))
		local rows = Js.Map.new(A.map(w.table, function(r)
			return Js.alit(r.name, Js.ospread(r))
		end))
		local scoreRng = M_season.mulberry32(seed(career.season, w.competition, md))
		local nameRng = M_season.mulberry32(seed(career.season, w.competition, md, 7))
		local scorers = Js.ospread(w.scorers)
		local results = Js.alit()
		local credit = function(name, gf, ga)
			local r = rows:get(name)
			if (not r) then
				do return end
			end
			r.played += 1
			r.goalsFor += gf
			r.goalsAgainst += ga
			if (gf > ga) then
				r.won += 1
				r.points += 3
			elseif (gf == ga) then
				r.drawn += 1
				r.points += 1
			else
				r.lost += 1
			end
		end
		do
			local _arr2 = schedule(career.season, w)
			local _i3 = 0
			while _i3 < Js.alen(_arr2) do
				_i3 += 1
				local f = _arr2[_i3]
				if (f.week ~= md) then
					do continue end
				end
				local _d4 = M_euro.simulate((strength:get(f.home) or 75), (strength:get(f.away) or 75), scoreRng)
				local hs = _d4[1]
				local as = _d4[2]
				credit(f.home, hs, as)
				credit(f.away, as, hs)
				local hg = M_leagueSquads.pickGoalIds(squadOf(f.home), hs, nameRng)
				local ag = M_leagueSquads.pickGoalIds(squadOf(f.away), as, nameRng)
				do
					local _arr5 = Js.aspread(hg, ag)
					local _i6 = 0
					while _i6 < Js.alen(_arr5) do
						_i6 += 1
						local g = _arr5[_i6]
						add(scorers, g.id, true)
						if Js.T(g.assistId) then
							add(scorers, g.assistId, false)
						end
					end
				end
				local named = function(gs)
					return A.map(gs, function(g)
						return Js.ospread(Js.O({ m = g.m, s = M_realSquad.shortNameOf(g.name) }, { "m", "s" }), (if Js.T(g.assist) then Js.O({ a = M_realSquad.shortNameOf(g.assist) }, { "a" }) else Js.O({}, nil)))
					end)
				end
				A.push(results, Js.ospread(Js.O({ week = md, home = f.home, away = f.away, hs = hs, as = as }, { "week", "home", "away", "hs", "as" }), (if Js.T(Js.alen(hg)) then Js.O({ hg = named(hg) }, { "hg" }) else Js.O({}, nil)), (if Js.T(Js.alen(ag)) then Js.O({ ag = named(ag) }, { "ag" }) else Js.O({}, nil))))
			end
		end
		do return Js.ospread(w, Js.O({ table = A.map(w.table, function(r)
			return (rows:get(r.name) or r)
		end), matchdays = md, last = results, scorers = scorers }, { "table", "matchdays", "last", "scorers" })) end
	end
	advanceWorldEuro = function(career, w, clock, squadOf)
		local cur = w
		while ((cur.matchdays < Js.alen(M_calendar.EURO_LEAGUE_PHASE_WEEKS)) and (euroTime(career, M_calendar.EURO_LEAGUE_PHASE_WEEKS[cur.matchdays + 1]) <= clock)) do
			cur = playMatchday(career, cur, (cur.matchdays + 1), squadOf)
		end
		if ((cur.matchdays < Js.alen(M_calendar.EURO_LEAGUE_PHASE_WEEKS)) or Js.T(cur.winner)) then
			do return cur end
		end
		local str = function(c)
			return ((function() local _v = A.find(cur.clubs, function(x)
				return (x.name == c)
			end); if _v == nil then return nil end; _v = _v.strength; return _v end)() or 75)
		end
		local bracket = (if cur.bracket ~= nil then cur.bracket else M_euroBracket.openEuroBracket(A.map(M_euro.sortEuro(cur.table), function(r)
			return r.name
		end), M_season.mulberry32(seed(career.season, cur.competition, 50))))
		local koRounds = cur.koRounds
		while ((koRounds < Js.alen(M_euroBracket.EURO_KO_ROUNDS)) and (koRoundTime(career, M_euroBracket.EURO_KO_ROUNDS[koRounds + 1]) <= clock)) do
			bracket = M_euroBracket.advanceEuroBracket(bracket, "", str, M_euro.simulate, M_season.mulberry32(seed(career.season, cur.competition, (60 + koRounds))), koRounds)
			koRounds += 1
		end
		if ((bracket == cur.bracket) and (koRounds == cur.koRounds)) then
			do return cur end
		end
		do return Js.ospread(cur, Js.O({ bracket = bracket, koRounds = koRounds }, { "bracket", "koRounds" }), (if Js.T(bracket.winner) then Js.O({ winner = bracket.winner }, { "winner" }) else Js.O({}, nil))) end
	end
	exports.advanceWorldEuro = advanceWorldEuro
	COMP_SALT = Js.O({ ["Champions League"] = 211, ["Europa League"] = 223 }, { "Champions League", "Europa League" })
end
