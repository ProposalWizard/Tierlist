--!nocheck
--!nolint
-- Generated from lib/star/world/summary.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_calendar = import("lib/star/calendar")
	local M_season = import("lib/star/season")
	local M_euroBracket = import("lib/star/euroBracket")
	local M_euro = import("lib/star/euro")
	local indexCache, playerIndex, topOf, ownLeagueTop, euroRows, summariseWorld
	playerIndex = function(career)
		local hit = indexCache:get(career)
		if hit then
			do return hit end
		end
		local m = Js.Map.new()
		do
			local _arr1 = Js.aspread((if career.externalSquads ~= nil then career.externalSquads else Js.alit()), (if career.leagueSquads ~= nil then career.leagueSquads else Js.alit()))
			local _i2 = 0
			while _i2 < Js.alen(_arr1) do
				_i2 += 1
				local sq = _arr1[_i2]
				do
					local _arr3 = sq.players
					local _i4 = 0
					while _i4 < Js.alen(_arr3) do
						_i4 += 1
						local p = _arr3[_i4]
						m:set(p.id, Js.O({ name = p.name, club = sq.club }, { "name", "club" }))
					end
				end
			end
		end
		indexCache:set(career, m)
		do return m end
	end
	exports.playerIndex = playerIndex
	topOf = function(career, counts, which, n)
		if n == nil then n = 10 end
		local idx = playerIndex(career)
		do return A.slice(A.sort(A.map(A.filter(Js.Object.entries(counts), function(_p5)
			local c = _p5[2]
			return (c[which + 1] > 0)
		end), function(_p6)
			local id = _p6[1]
			local c = _p6[2]
			return Js.O({ id = id, player = ((function() local _v = idx:get(id); if _v == nil then return nil end; _v = _v.name; return _v end)() or "Unknown"), club = ((function() local _v = idx:get(id); if _v == nil then return nil end; _v = _v.club; return _v end)() or ""), n = c[which + 1] }, { "id", "player", "club", "n" })
		end), function(a, b)
			return (function() local _l = (b.n - a.n); if Js.T(_l) then return _l end; return S.localeCompare(a.player, b.player) end)()
		end), 0, n) end
	end
	exports.topOf = topOf
	ownLeagueTop = function(career, which, n)
		if n == nil then n = 10 end
		local rows = Js.alit()
		do
			local _arr7 = (if career.leagueSquads ~= nil then career.leagueSquads else Js.alit())
			local _i8 = 0
			while _i8 < Js.alen(_arr7) do
				_i8 += 1
				local sq = _arr7[_i8]
				do
					local _arr9 = sq.players
					local _i10 = 0
					while _i10 < Js.alen(_arr9) do
						_i10 += 1
						local p = _arr9[_i10]
						local v = (if (which == 0) then p.goals else p.assists)
						if (v > 0) then
							A.push(rows, Js.O({ id = p.id, player = p.name, club = sq.club, n = v }, { "id", "player", "club", "n" }))
						end
					end
				end
			end
		end
		do return A.slice(A.sort(rows, function(a, b)
			return (function() local _l = (b.n - a.n); if Js.T(_l) then return _l end; return S.localeCompare(a.player, b.player) end)()
		end), 0, n) end
	end
	exports.ownLeagueTop = ownLeagueTop
	summariseWorld = function(career, world, ladder, winners, cups)
		if cups == nil then cups = Js.alit() end
		local yours = M_calendar.divisionOf(career)
		local tables = Js.alit()
		local scorers = Js.alit()
		local strip = function(r)
			return Js.O({ player = r.player, club = r.club, n = r.n }, { "player", "club", "n" })
		end
		do
			local _arr11 = M_calendar.ALL_DIVISIONS
			local _i12 = 0
			while _i12 < Js.alen(_arr11) do
				_i12 += 1
				local d = _arr11[_i12]
				local name = M_calendar.leagueNameFor(d)
				if (d == yours) then
					A.push(tables, Js.O({ name = name, division = d, rows = M_season.sortLeague(career.league) }, { "name", "division", "rows" }))
					A.push(scorers, Js.O({ name = name, goals = A.map(ownLeagueTop(career, 0), strip), assists = A.map(ownLeagueTop(career, 1), strip) }, { "name", "goals", "assists" }))
					do continue end
				end
				local lg = (function() local _r = (function() local _v = world; if _v == nil then return nil end; _v = _v.leagues; return _v end)(); if _r == nil then return nil end; return A.find(_r, function(l)
					return (l.division == d)
				end) end)()
				if (not lg) then
					do continue end
				end
				A.push(tables, Js.O({ name = name, division = d, rows = M_season.sortLeague(lg.teams) }, { "name", "division", "rows" }))
				A.push(scorers, Js.O({ name = name, goals = A.map(topOf(career, lg.scorers, 0), strip), assists = A.map(topOf(career, lg.scorers, 1), strip) }, { "name", "goals", "assists" }))
			end
		end
		if career.euroState then
			A.push(tables, Js.O({ name = career.euroState.competition, rows = euroRows((if career.euroState.table ~= nil then career.euroState.table else career.euroState.liveTable)) }, { "name", "rows" }))
		end
		do
			local _arr13 = ((function() local _v = world; if _v == nil then return nil end; _v = _v.europe; return _v end)() or Js.alit())
			local _i14 = 0
			while _i14 < Js.alen(_arr13) do
				_i14 += 1
				local e = _arr13[_i14]
				A.push(tables, Js.O({ name = e.competition, rows = euroRows(e.table) }, { "name", "rows" }))
				A.push(scorers, Js.O({ name = e.competition, goals = A.map(topOf(career, e.scorers, 0), strip), assists = A.map(topOf(career, e.scorers, 1), strip) }, { "name", "goals", "assists" }))
			end
		end
		local playOffs = Js.aspread(((function() local _v = ladder; if _v == nil then return nil end; _v = _v.worldPlayOffs; return _v end)() or Js.alit()))
		if (function() local _v = ladder; if _v == nil then return nil end; _v = _v.playOffs; return _v end)() then
			A.push(playOffs, Js.O({ division = yours, result = ladder.playOffs }, { "division", "result" }))
		end
		local finals = Js.alit()
		do
			local _arr15 = Js.aspread(cups, (if (function() local _v = world; if _v == nil then return nil end; _v = _v.leagueCup; return _v end)() then Js.alit(world.leagueCup) else Js.alit()))
			local _i16 = 0
			while _i16 < Js.alen(_arr15) do
				_i16 += 1
				local cup = _arr15[_i16]
				local last = cup.rounds[Js.alen(cup.rounds)]
				local t = (if ((function() local _v = last; if _v == nil then return nil end; _v = _v.ties; _v = Js.len(_v); return _v end)() == 1) then last.ties[1] else nil)
				if t then
					A.push(finals, Js.ospread(Js.O({ competition = cup.competition, home = t.home, away = t.away, hs = t.hs, as = t.as }, { "competition", "home", "away", "hs", "as" }), (if t.pens then Js.O({ pens = t.pens }, { "pens" }) else Js.O({}, nil)), Js.O({ winner = cup.winner }, { "winner" })))
				end
			end
		end
		local euroFinal = function(competition, br, winner)
			local f = (function() local _v = br; if _v == nil then return nil end; _v = _v.rounds; _v = _v[Js.alen(br.rounds)]; if _v == nil then return nil end; _v = _v.ties; _v = _v[1]; return _v end)()
			local agg = (if f then M_euroBracket.koAggregate(f) else nil)
			if (Js.T((function() local _v = f; if _v == nil then return nil end; _v = _v.a; return _v end)()) and Js.T(f.b)) then
				A.push(finals, Js.ospread(Js.O({ competition = competition, home = f.a, away = f.b, hs = (function() local _v = agg; if _v == nil then return nil end; _v = _v.a; return _v end)(), as = (function() local _v = agg; if _v == nil then return nil end; _v = _v.b; return _v end)() }, { "competition", "home", "away", "hs", "as" }), (if f.pens then Js.O({ pens = Js.O({ home = f.pens.a, away = f.pens.b }, { "home", "away" }) }, { "pens" }) else Js.O({}, nil)), Js.O({ winner = (if f.winner ~= nil then f.winner else winner) }, { "winner" })))
			end
		end
		if career.euroState then
			euroFinal(career.euroState.competition, career.euroState.bracket, career.euroState.winner)
		end
		do
			local _arr17 = ((function() local _v = world; if _v == nil then return nil end; _v = _v.europe; return _v end)() or Js.alit())
			local _i18 = 0
			while _i18 < Js.alen(_arr17) do
				_i18 += 1
				local e = _arr17[_i18]
				euroFinal(e.competition, e.bracket, e.winner)
			end
		end
		do
			local _arr19 = ((function() local _v = world; if _v == nil then return nil end; _v = _v.shields; return _v end)() or Js.alit())
			local _i20 = 0
			while _i20 < Js.alen(_arr19) do
				_i20 += 1
				local sh = _arr19[_i20]
				A.push(finals, Js.ospread(Js.O({ competition = sh.competition, home = sh.home, away = sh.away, hs = sh.hs, as = sh.as }, { "competition", "home", "away", "hs", "as" }), (if sh.pens then Js.O({ pens = sh.pens }, { "pens" }) else Js.O({}, nil)), Js.O({ winner = sh.winner }, { "winner" })))
			end
		end
		do
			local _arr21 = career.fixtures
			local _i22 = 0
			while _i22 < Js.alen(_arr21) do
				_i22 += 1
				local f = _arr21[_i22]
				if (((f.competition == "Community Shield") or (f.competition == "Super Cup")) and f.played) then
					local home = (if f.home then career.player.club else f.opponent)
					local away = (if f.home then f.opponent else career.player.club)
					local won = A.some(career.trophies, function(t)
						return ((t.season == career.season) and (t.competition == f.competition))
					end)
					A.push(finals, Js.O({ competition = f.competition, home = home, away = away, hs = f.homeScore, as = f.awayScore, winner = (if won then career.player.club else f.opponent) }, { "competition", "home", "away", "hs", "as", "winner" }))
				end
			end
		end
		do return Js.O({ season = career.season, tables = tables, scorers = scorers, winners = winners, playOffs = playOffs, finals = finals }, { "season", "tables", "scorers", "winners", "playOffs", "finals" }) end
	end
	exports.summariseWorld = summariseWorld
	indexCache = Js.Map.new()
	euroRows = function(rows)
		return A.map(M_euro.sortEuro(rows), function(r)
			return Js.O({ name = r.name, strength = 0, played = r.played, won = r.won, drawn = r.drawn, lost = r.lost, goalsFor = r.goalsFor, goalsAgainst = r.goalsAgainst, points = r.points }, { "name", "strength", "played", "won", "drawn", "lost", "goalsFor", "goalsAgainst", "points" })
		end)
	end
end
