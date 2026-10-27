--!nocheck
--!nolint
-- Generated from lib/star/intl/scorers.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_career = import("lib/star/intl/career")
	local M_season = import("lib/star/season")
	local M_leagueSquads = import("lib/star/leagueSquads")
	local M_nations = import("lib/star/intl/nations")
	local BALLON_DOR_NATION_TROPHIES, tallyKey, XI, asLeagueSquad, seedOf, cache, intlSeason, intlTallyOf, topIntlScorers, scorerLines
	asLeagueSquad = function(nation, squad)
		local left = Js.aspread(squad)
		local xi = Js.alit()
		do
			local _arr1 = XI
			local _i2 = 0
			while _i2 < Js.alen(_arr1) do
				_i2 += 1
				local pos = _arr1[_i2]
				local i = A.findIndex(left, function(p)
					return (p.position == pos)
				end)
				if (i >= 0) then
					A.push(xi, A.splice(left, i, 1)[1])
				end
			end
		end
		local players = A.map(Js.aspread(xi, left), function(p)
			return Js.O({ id = p.id, name = p.name, position = p.position, overall = (if p.overall ~= nil then p.overall else 65), goals = 0, assists = 0, image = p.imageUrl, nation = nation, age = p.age, positions = p.positions }, { "id", "name", "position", "overall", "goals", "assists", "image", "nation", "age", "positions" })
		end)
		do return Js.O({ club = nation, players = players }, { "club", "players" }) end
	end
	seedOf = function(s)
		local h = 2166136261
		for i = 0, (S.len(s)) - 1 do
			h = Js.bxor(h, S.charCodeAt(s, i))
			h = Math.imul(h, 16777619)
		end
		do return Js.ushr(h, 0) end
	end
	intlSeason = function(career, season)
		if season == nil then season = career.season end
		local s = M_career.intlOf(career)
		local w = M_career.worldOf(career)
		local key = Js.alit(career.leagueSquads, career.externalSquads, career.squad, s.played, s.xi, s.nights, season, w.now, s.nation)
		if ((cache and (Js.alen(cache.key) == Js.alen(key))) and A.every(cache.key, function(k, i)
			return (k == key[i + 1])
		end)) then
			do return cache.value end
		end
		local everyone = M_career.realPlayers(career)
		local realByNation = Js.Map.new()
		do
			local _arr3 = everyone
			local _i4 = 0
			while _i4 < Js.alen(_arr3) do
				_i4 += 1
				local p = _arr3[_i4]
				local set = (realByNation:get(p.nation) or Js.Set.new())
				set:add(p.name)
				realByNation:set(p.nation, set)
			end
		end
		local squads = Js.Map.new()
		local squad = function(nation, size)
			local k = (nation .. "|" .. Js.numstr(size))
			local sq = squads:get(k)
			if (not sq) then
				sq = asLeagueSquad(nation, M_career.squadFor(career, nation, size, everyone))
				squads:set(k, sq)
			end
			do return sq end
		end
		local players = Js.Map.new()
		local goals = Js.Map.new()
		local you = Js.O({ goals = 0, assists = 0 }, { "goals", "assists" })
		local credit = function(nation, sq, before)
			do
				local _arr5 = sq.players
				local _i6 = 0
				while _i6 < Js.alen(_arr5) do
					_i6 += 1
					local p = _arr5[_i6]
					local _d7 = (before:get(p.id) or Js.alit(0, 0))
					local g0 = _d7[1]
					local a0 = _d7[2]
					local dg = (p.goals - g0)
					local da = (p.assists - a0)
					if ((not Js.T(dg)) and (not Js.T(da))) then
						do continue end
					end
					local k = tallyKey(nation, p.name)
					local t = (players:get(k) or Js.O({ name = p.name, nation = nation, goals = 0, assists = 0, real = (not (not (function() local _r = realByNation:get(nation); if _r == nil then return nil end; return _r:has(p.name) end)())), position = p.position, image = p.image }, { "name", "nation", "goals", "assists", "real", "position", "image" }))
					t.goals += dg
					t.assists += da
					players:set(k, t)
				end
			end
		end
		local from = M_career.ballonDorYearStart(career, season)
		local to = (if (season == career.season) then w.now else ((function() local _v = s.nights; if _v == nil then return nil end; _v = _v[Js.key(season)]; return _v end)() or w.now))
		local ofSeason = function(m)
			return (((m.hs ~= nil) and (m.date >= from)) and (m.date <= to))
		end
		do
			local _arr8 = w.matches
			local _i9 = 0
			while _i9 < Js.alen(_arr8) do
				_i9 += 1
				local m = _arr8[_i9]
				if (not ofSeason(m)) then
					do continue end
				end
				local size = (if A.includes(M_career.TOURNAMENT_COMPS, m.comp) then 26 else 23)
				local rng = M_season.mulberry32(seedOf(m.id))
				local mine = (function() local _v = s.played[m.id]; if _v == nil then return nil end; _v = _v.mine; return _v end)()
				local side = function(nation, count)
					local sq = squad(nation, size)
					local n = count
					if (mine and (nation == s.nation)) then
						you.goals += mine.g
						you.assists += mine.a
						n = Math.max(0, (count - mine.g))
					end
					local before = Js.Map.new(A.map(sq.players, function(p)
						return Js.alit(p.id, Js.alit(p.goals, p.assists))
					end))
					local named = M_leagueSquads.nameGoals(sq, n, rng)
					credit(nation, sq, before)
					do return named end
				end
				goals:set(m.id, Js.O({ home = side(m.home, m.hs), away = side(m.away, m.as) }, { "home", "away" }))
			end
		end
		local champions = Js.Map.new()
		local championSquads = Js.Set.new()
		do
			local _arr10 = w.finals
			local _i11 = 0
			while _i11 < Js.alen(_arr10) do
				_i11 += 1
				local f = _arr10[_i11]
				if (not A.includes(BALLON_DOR_NATION_TROPHIES, f.comp)) then
					do continue end
				end
				local last = A.reduce(A.filter(w.matches, function(m)
					return ((m.edition == f.edition) and (m.hs ~= nil))
				end), function(t, m)
					return Math.max(t, m.date)
				end, (-math.huge))
				if (not ((last >= from) and (last <= to))) then
					do continue end
				end
				champions:set(f.winner, f.comp)
				do
					local _arr12 = squad(f.winner, 26).players
					local _i13 = 0
					while _i13 < Js.alen(_arr12) do
						_i13 += 1
						local p = _arr12[_i13]
						championSquads:add(tallyKey(f.winner, p.name))
					end
				end
			end
		end
		local value = Js.O({ season = season, players = players, goals = goals, you = you, champions = champions, championSquads = championSquads }, { "season", "players", "goals", "you", "champions", "championSquads" })
		cache = Js.O({ key = key, value = value }, { "key", "value" })
		do return value end
	end
	exports.intlSeason = intlSeason
	intlTallyOf = function(season, nation, name)
		local n = (if Js.T(nation) then (function() local _v = M_nations.nationFor(nation); if _v == nil then return nil end; _v = _v.name; return _v end)() else nil)
		if (not Js.T(n)) then
			do return Js.O({ goals = 0, assists = 0 }, { "goals", "assists" }) end
		end
		local t = season.players:get(tallyKey(n, name))
		do return (if t then Js.O({ goals = t.goals, assists = t.assists }, { "goals", "assists" }) else Js.O({ goals = 0, assists = 0 }, { "goals", "assists" })) end
	end
	exports.intlTallyOf = intlTallyOf
	topIntlScorers = function(season, n)
		if n == nil then n = 10 end
		do return A.slice(A.sort(Js.Array.from(season.players:values()), function(a, b)
			return (function() local _l = (function() local _l = (b.goals - a.goals); if Js.T(_l) then return _l end; return (b.assists - a.assists) end)(); if Js.T(_l) then return _l end; return (Js.Number(b.real) - Js.Number(a.real)) end)()
		end), 0, n) end
	end
	exports.topIntlScorers = topIntlScorers
	scorerLines = function(career, season, matchId, home)
		local g = season.goals:get(matchId)
		if (not g) then
			do return nil end
		end
		local s = M_career.intlOf(career)
		local mine = (function() local _v = s.played[matchId]; if _v == nil then return nil end; _v = _v.mine; return _v end)()
		local line = function(xs)
			return A.map(A.sort(Js.aspread(xs), function(a, b)
				return (a.m - b.m)
			end), function(x)
				return (x.s .. " " .. Js.numstr(x.m) .. "'")
			end)
		end
		local you = (if (mine and (mine.g > 0)) then Js.alit((if (mine.g > 1) then ("You ×" .. Js.numstr(mine.g)) else "You")) else Js.alit())
		local homeIsYou = (home == s.nation)
		do return Js.O({ home = Js.aspread((if homeIsYou then you else Js.alit()), line(g.home)), away = Js.aspread((if ((not homeIsYou) and mine) then you else Js.alit()), line(g.away)) }, { "home", "away" }) end
	end
	exports.scorerLines = scorerLines
	BALLON_DOR_NATION_TROPHIES = Js.alit("World Cup", "European Championship")
	exports.BALLON_DOR_NATION_TROPHIES = BALLON_DOR_NATION_TROPHIES
	tallyKey = function(nation, name)
		return (nation .. "|" .. name)
	end
	exports.tallyKey = tallyKey
	XI = Js.alit("GK", "LB", "CB", "CB", "RB", "CDM", "CM", "CM", "LW", "ST", "RW")
	cache = nil
end
