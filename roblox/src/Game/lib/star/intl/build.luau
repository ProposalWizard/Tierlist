--!nocheck
--!nolint
-- Generated from lib/star/intl/build.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_windows = import("lib/star/intl/windows")
	local M_world = import("lib/star/intl/world")
	local M_engine = import("lib/star/intl/engine")
	local M_knockout_tables_json = import("data/fifa/knockout-tables_json")
	local DAY, matchday, matchdays, utcNoon, plusDays, groupStage, groupTable, groupTables, placed, placedFair, single, twoLegs, legsWinner, legsLoser, bracket, LAYOUTS, realLayout, pairQualifiers, tournament, allPlayed
	matchday = function(year, kind, i)
		local w = M_windows.windowFor(year, kind)
		if ((not w) or (i >= Js.alen(w.matchdays))) then
			do return nil end
		end
		do return M_world.noon(w.matchdays[i + 1]) end
	end
	exports.matchday = matchday
	matchdays = function(windows)
		local out = Js.alit()
		do
			local _arr1 = windows
			local _i2 = 0
			while _i2 < Js.alen(_arr1) do
				_i2 += 1
				local _e3 = _arr1[_i2]
				local y = _e3[1]
				local k = _e3[2]
				local w = M_windows.windowFor(y, k)
				if w then
					A.push(out, Js.unpack(A.map(w.matchdays, function(d)
						return M_world.noon(d)
					end)))
				end
			end
		end
		do return out end
	end
	exports.matchdays = matchdays
	groupStage = function(w, s)
		do
			local _arr4 = Js.Object.entries(s.groups)
			local _i5 = 0
			while _i5 < Js.alen(_arr4) do
				_i5 += 1
				local _e6 = _arr4[_i5]
				local g = _e6[1]
				local teams = _e6[2]
				local days = (if s.schedule then s.schedule(teams, g) else (if (s.rounds == "double") then M_engine.doubleRoundRobin(teams) else M_engine.singleRoundRobin(teams)))
				if Js.T(s.maxRounds) then
					days = A.slice(days, 0, s.maxRounds)
				end
				if (Js.alen(days) > Js.alen(s.dates)) then
					error(Js.Error((s.edition .. " group " .. g .. ": " .. Js.numstr(Js.alen(days)) .. " rounds, " .. Js.numstr(Js.alen(s.dates)) .. " dates")), 0)
				end
				A.forEach(days, function(day, r)
					do
						local _arr7 = day
						local _i8 = 0
						while _i8 < Js.alen(_arr7) do
							_i8 += 1
							local _e9 = _arr7[_i8]
							local h = _e9[1]
							local a = _e9[2]
							local hostIn = ((function() local _r = s.hosts; if _r == nil then return nil end; return A.includes(_r, h) end)() or (function() local _r = s.hosts; if _r == nil then return nil end; return A.includes(_r, a) end)())
							if ((s.neutral and (function() local _r = s.hosts; if _r == nil then return nil end; return A.includes(_r, a) end)()) and (not A.includes(s.hosts, h))) then
								local _d10 = Js.alit(a, h)
								h = _d10[1]
								a = _d10[2]
							end
							w:add(Js.ospread(Js.O({ id = (s.edition .. "|" .. g .. "|" .. Js.numstr((r + 1)) .. "|" .. h .. "-" .. a), home = h, away = a, date = s.dates[r + 1], comp = s.comp, edition = s.edition, stage = ((if s.label ~= nil then s.label else "Group") .. " " .. g .. " · Matchday " .. Js.numstr((r + 1))), importance = s.importance, group = g }, { "id", "home", "away", "date", "comp", "edition", "stage", "importance", "group" }), (if s.neutral then Js.O({ neutral = true }, { "neutral" }) else Js.O({}, nil)), (if (s.neutral and hostIn) then Js.O({ hostHome = true }, { "hostHome" }) else Js.O({}, nil))))
						end
					end
				end)
			end
		end
	end
	exports.groupStage = groupStage
	groupTable = function(w, edition, group, teams, tie)
		local ms = A.filter(w:edition(edition), function(m)
			return (m.group == group)
		end)
		do return M_engine.table(teams, ms, tie, w.rankOf) end
	end
	exports.groupTable = groupTable
	groupTables = function(w, edition, groups, tie)
		local out = Js.O({}, nil)
		do
			local _arr11 = Js.Object.entries(groups)
			local _i12 = 0
			while _i12 < Js.alen(_arr11) do
				_i12 += 1
				local _e13 = _arr11[_i12]
				local g = _e13[1]
				local teams = _e13[2]
				out[g] = groupTable(w, edition, g, teams, tie)
			end
		end
		do return out end
	end
	exports.groupTables = groupTables
	placed = function(w, tables, pos)
		local rows = A.filter(A.map(Js.Object.values(tables), function(t)
			return t[pos + 1]
		end), function(r)
			return (not (not r))
		end)
		do return M_engine.rankAcrossGroups(rows, w.rankOf) end
	end
	exports.placed = placed
	placedFair = function(w, edition, tables, pos)
		local sizes = A.map(Js.Object.values(tables), function(t)
			return Js.alen(t)
		end)
		local min = Math.min(Js.unpack(sizes))
		local rows = Js.alit()
		do
			local _arr14 = Js.Object.entries(tables)
			local _i15 = 0
			while _i15 < Js.alen(_arr14) do
				_i15 += 1
				local _e16 = _arr14[_i15]
				local g = _e16[1]
				local t = _e16[2]
				local r = t[pos + 1]
				if (not r) then
					do continue end
				end
				if (Js.alen(t) == min) then
					A.push(rows, r)
					do continue end
				end
				local drop = Js.Set.new(A.map(A.slice(t, min), function(x)
					return x.name
				end))
				local ms = A.filter(w:edition(edition), function(m)
					return (((m.group == g) and (not drop:has(m.home))) and (not drop:has(m.away)))
				end)
				local kept = A.map(A.filter(t, function(x)
					return (not drop:has(x.name))
				end), function(x)
					return x.name
				end)
				local mine = A.find(M_engine.table(kept, ms, "overall", w.rankOf), function(x)
					return (x.name == r.name)
				end)
				A.push(rows, (if mine ~= nil then mine else r))
			end
		end
		do return M_engine.rankAcrossGroups(rows, w.rankOf) end
	end
	exports.placedFair = placedFair
	single = function(w, s, home, away, date, key)
		if ((s.neutral and (function() local _r = s.hosts; if _r == nil then return nil end; return A.includes(_r, away) end)()) and (not A.includes(s.hosts, home))) then
			local _d17 = Js.alit(away, home)
			home = _d17[1]
			away = _d17[2]
		end
		local hostIn = (not (not ((function() local _r = s.hosts; if _r == nil then return nil end; return A.includes(_r, home) end)() or (function() local _r = s.hosts; if _r == nil then return nil end; return A.includes(_r, away) end)())))
		do return w:add(Js.ospread(Js.O({ id = (s.edition .. "|" .. key .. "|" .. home .. "-" .. away), home = home, away = away, date = date, comp = s.comp, edition = s.edition, stage = s.stage, importance = s.importance, level = (if s.level ~= nil then s.level else "et-pens") }, { "id", "home", "away", "date", "comp", "edition", "stage", "importance", "level" }), (if s.neutral then Js.O({ neutral = true }, { "neutral" }) else Js.O({}, nil)), (if (s.neutral and hostIn) then Js.O({ hostHome = true }, { "hostHome" }) else Js.O({}, nil)), (if s.finalsKnockout then Js.O({ finalsKnockout = true }, { "finalsKnockout" }) else Js.O({}, nil)))) end
	end
	exports.single = single
	twoLegs = function(w, s, a, b, dates, key)
		local first = w:add(Js.O({ id = (s.edition .. "|" .. key .. "|L1|" .. a .. "-" .. b), home = a, away = b, date = dates[1], comp = s.comp, edition = s.edition, stage = (s.stage .. " · Leg 1"), importance = s.importance }, { "id", "home", "away", "date", "comp", "edition", "stage", "importance" }))
		local second = w:add(Js.O({ id = (s.edition .. "|" .. key .. "|L2|" .. b .. "-" .. a), home = b, away = a, date = dates[2], comp = s.comp, edition = s.edition, stage = (s.stage .. " · Leg 2"), importance = s.importance, firstLeg = first.id }, { "id", "home", "away", "date", "comp", "edition", "stage", "importance", "firstLeg" }))
		do return Js.O({ first = first, second = second }, { "first", "second" }) end
	end
	exports.twoLegs = twoLegs
	legsWinner = function(t)
		do return M_engine.twoLegWinner(t) end
	end
	exports.legsWinner = legsWinner
	legsLoser = function(t)
		local win = M_engine.twoLegWinner(t)
		do return (if Js.T(win) then (if (win == t.first.home) then t.first.away else t.first.home) else nil) end
	end
	exports.legsLoser = legsLoser
	bracket = function(w, s, entrants, onDone)
		local third, play
		local losers = Js.alit()
		play = function(round, teams)
			local last = (round == (Js.alen(s.names) - 1))
			local date = s.dates[round + 1]
			local tie = Js.O({ edition = s.edition, comp = s.comp, importance = s.importance(round), stage = s.names[round + 1], level = (if (last and Js.T(s.finalLevel)) then s.finalLevel else s.level), neutral = s.neutral, finalsKnockout = s.finalsKnockout, hosts = s.hosts }, { "edition", "comp", "importance", "stage", "level", "neutral", "finalsKnockout", "hosts" })
			local ties = Js.alit()
			do
				local i = 0
				local _first18 = true
				while true do
					if not _first18 then
						i += 2
					end
					_first18 = false
					if not ((i + 1) < Js.alen(teams)) then break end
					local key = (s.names[round + 1] .. "-" .. Js.numstr(((i / 2) + 1)))
					A.push(ties, (if Js.Array.isArray(date) then twoLegs(w, tie, teams[i + 1], teams[(i + 1) + 1], date, key) else single(w, tie, teams[i + 1], teams[(i + 1) + 1], date, key)))
				end
			end
			local endDate = (if Js.Array.isArray(date) then date[2] else date)
			w:at(M_world.dayAfter(endDate), function()
				local win = A.map(ties, function(t)
					return (if Js.has(t, "first") then legsWinner(t) else M_engine.winnerOf(t))
				end)
				local lose = A.map(ties, function(t)
					return (if Js.has(t, "first") then legsLoser(t) else M_engine.loserOf(t))
				end)
				if A.some(win, function(x)
					return (not Js.T(x))
				end) then
					do return end
				end
				A.push(losers, lose)
				if last then
					local fin = ties[1]
					local final = (if Js.has(fin, "first") then fin.second else fin)
					if (s.archive ~= false) then
						w:final(s.edition, s.comp, final)
					end
					local out = Js.O({ winner = win[1], runnerUp = lose[1], losers = losers, final = final }, { "winner", "runnerUp", "losers", "final" })
					if third then
						w:at((M_world.dayAfter(endDate) + 1), function()
							out.third = (M_engine.winnerOf(third) or nil);
							(function() local _f = onDone; if _f == nil then return nil end; return _f(out) end)()
						end)
					else
						(function() local _f = onDone; if _f == nil then return nil end; return _f(out) end)()
					end
					do return end
				end
				if (s.thirdPlace and (round == (Js.alen(s.names) - 2))) then
					local fd = s.dates[(round + 1) + 1]
					third = single(w, Js.ospread(tie, Js.O({ stage = "Third Place", importance = s.importance((round + 1)) }, { "stage", "importance" })), lose[1], lose[2], (if Js.Array.isArray(fd) then fd[2] else fd), "Third")
				end
				play((round + 1), win)
			end)
		end
		third = nil
		play(0, entrants)
	end
	exports.bracket = bracket
	realLayout = function(tables, layout, thirdsRanked, groupOf)
		local L = LAYOUTS[layout]
		local groups = A.sort(Js.Object.keys(tables))
		if (((not L) or (Js.alen(groups) ~= (if (layout == "wc48") then 12 else 6))) or A.some(groups, function(g, i)
			return (g ~= S.idx(("ABCDEFGHIJKL"), i))
		end)) then
			do return nil end
		end
		local key = A.join(A.sort(A.map(thirdsRanked, function(t)
			return groupOf:get(t)
		end)), "")
		local row = L.table[key]
		if (not row) then
			do return nil end
		end
		local third = Js.Map.new(A.map(L.winners, function(wl, i)
			return Js.alit(wl, tables[row[i + 1]][3].name)
		end))
		local at = function(code, winner)
			if (code == "3") then
				do return third:get(winner) end
			end
			do return tables[S.idx(code, 1)][(if (S.idx(code, 0) == "1") then 0 else 1) + 1].name end
		end
		do return A.flatMap(L.order, function(m)
			local _d19 = S.split(m, "-")
			local a = _d19[1]
			local b = _d19[2]
			do return Js.alit(at(a, S.idx(a, 1)), at(b, S.idx(a, 1))) end
		end) end
	end
	exports.realLayout = realLayout
	pairQualifiers = function(w, tables, thirds, layout)
		local groups = Js.Object.keys(tables)
		local W = A.map(groups, function(g)
			return tables[g][1].name
		end)
		local R = A.map(groups, function(g)
			return tables[g][2].name
		end)
		local groupOf = Js.Map.new()
		do
			local _arr20 = groups
			local _i21 = 0
			while _i21 < Js.alen(_arr20) do
				_i21 += 1
				local g = _arr20[_i21]
				do
					local _arr22 = tables[g]
					local _i23 = 0
					while _i23 < Js.alen(_arr22) do
						_i23 += 1
						local r = _arr22[_i23]
						groupOf:set(r.name, g)
					end
				end
			end
		end
		local T = A.map(A.slice(placed(w, tables, 2), 0, thirds), function(r)
			return r.name
		end)
		if (Js.T(layout) and (thirds > 0)) then
			local real = realLayout(tables, layout, T, groupOf)
			if real then
				do return real end
			end
		end
		local pairs_ = Js.alit()
		if (thirds == 0) then
			for i = 0, (Js.alen(W)) - 1 do
				A.push(pairs_, Js.alit(W[i + 1], (R[Js.bxor(i, 1) + 1] or R[i + 1])))
			end
		else
			local fit
			local wT = A.slice(W, 0, thirds)
			local assign = Js.alit()
			local used = Js.Set.new()
			fit = function(k)
				if (k == Js.alen(wT)) then
					do return true end
				end
				do
					local _arr24 = T
					local _i25 = 0
					while _i25 < Js.alen(_arr24) do
						_i25 += 1
						local t = _arr24[_i25]
						if (used:has(t) or (groupOf:get(t) == groupOf:get(wT[k + 1]))) then
							do continue end
						end
						used:add(t)
						A.set(assign, k, t)
						if fit((k + 1)) then
							do return true end
						end
						used:delete(t)
					end
				end
				do return false end
			end
			if (not fit(0)) then
				A.forEach(T, function(t, k)
					return (function() local _a = t; A.set(assign, k, _a); return _a end)()
				end)
			end
			A.forEach(wT, function(x, k)
				return A.push(pairs_, Js.alit(x, assign[k + 1]))
			end)
			local rLeft = Js.aspread(R)
			do
				local _arr26 = A.slice(W, thirds)
				local _i27 = 0
				while _i27 < Js.alen(_arr26) do
					_i27 += 1
					local x = _arr26[_i27]
					local k = A.findIndex(rLeft, function(r)
						return (groupOf:get(r) ~= groupOf:get(x))
					end)
					A.push(pairs_, Js.alit(x, A.splice(rLeft, (if (k >= 0) then k else 0), 1)[1]))
				end
			end
			while (Js.alen(rLeft) > 1) do
				local a = A.shift(rLeft)
				local k = A.findIndex(rLeft, function(r)
					return (groupOf:get(r) ~= groupOf:get(a))
				end)
				A.push(pairs_, Js.alit(a, A.splice(rLeft, (if (k >= 0) then k else 0), 1)[1]))
			end
		end
		local n = Js.alen(pairs_)
		local bits = Math.round(Math.log2(n))
		local slots = Js.Array.new(n)
		A.forEach(pairs_, function(p, i)
			local r = 0
			for b = 0, bits - 1 do
				if Js.T(Js.band(i, Js.shl(1, b))) then
					r = Js.bor(r, Js.shl(1, ((bits - 1) - b)))
				end
			end
			A.set(slots, r, p)
		end)
		do return A.flat(slots) end
	end
	exports.pairQualifiers = pairQualifiers
	tournament = function(w, s, onDone)
		groupStage(w, Js.O({ edition = s.edition, comp = s.comp, importance = s.groupImportance, groups = s.groups, dates = s.groupDates, rounds = "single", neutral = true, hosts = s.hosts }, { "edition", "comp", "importance", "groups", "dates", "rounds", "neutral", "hosts" }))
		w.facts:set((s.edition .. ":groups"), s.groups)
		w:at(M_world.dayAfter(s.groupDates[Js.alen(s.groupDates)]), function()
			local tables = groupTables(w, s.edition, s.groups, s.tie)
			w.facts:set((s.edition .. ":tables"), tables)
			bracket(w, Js.O({ edition = s.edition, comp = s.comp, names = s.names, dates = s.koDates, importance = s.koImportance, level = (if s.level ~= nil then s.level else "et-pens"), finalLevel = s.finalLevel, neutral = true, finalsKnockout = true, hosts = s.hosts, thirdPlace = s.thirdPlace }, { "edition", "comp", "names", "dates", "importance", "level", "finalLevel", "neutral", "finalsKnockout", "hosts", "thirdPlace" }), pairQualifiers(w, tables, s.thirds, (if (s.thirds == 8) then "wc48" else (if (s.thirds == 4) then (if (s.comp == "European Championship") then "euro24" else "afc24") else nil))), function(r)
				w.facts:set((s.edition .. ":result"), r);
				(function() local _f = onDone; if _f == nil then return nil end; return _f(r) end)()
			end)
		end)
	end
	exports.tournament = tournament
	allPlayed = function(ms)
		do return A.every(ms, M_engine.played) end
	end
	exports.allPlayed = allPlayed
	DAY = 86400000
	utcNoon = function(y, m, d)
		return Js.Date.UTC(y, (m - 1), d, 12)
	end
	exports.utcNoon = utcNoon
	plusDays = function(t, n)
		return (t + (n * DAY))
	end
	exports.plusDays = plusDays
	LAYOUTS = M_knockout_tables_json.default
end
