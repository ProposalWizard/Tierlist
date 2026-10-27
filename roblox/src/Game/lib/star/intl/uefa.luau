--!nocheck
--!nolint
-- Generated from lib/star/intl/uefa.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_nations = import("lib/star/intl/nations")
	local M_build = import("lib/star/intl/build")
	local M_realData = import("lib/star/intl/realData")
	local M_engine = import("lib/star/intl/engine")
	local M_world = import("lib/star/intl/world")
	local M_hosts = import("lib/star/intl/hosts")
	local DAY, letters, uefaNations, nationsLeague, nl6Schedule, defaultLeagues, qualifyingGroups, playoffPaths, euroCycle, UEFA_WC_SLOTS, uefaWorldCupQualifying, secondFriday, fillTo
	uefaNations = function()
		do return A.map(M_nations.nationsIn("UEFA"), function(n)
			return n.name
		end) end
	end
	exports.uefaNations = uefaNations
	nationsLeague = function(w, year)
		local ed = ("NL-" .. Js.numstr(year))
		local autumn = M_build.matchdays(Js.alit(Js.alit(year, "sepoct"), Js.alit(year, "nov")))
		local mar = Js.alit(M_build.matchday((year + 1), "mar", 0), M_build.matchday((year + 1), "mar", 1))
		local jun = Js.alit(M_build.matchday((year + 1), "jun", 0), M_build.matchday((year + 1), "jun", 1))
		local groupsByLeague = Js.O({}, nil)
		local start = function()
			local leagues = nil
			if (year == 2026) then
				do
					local _arr1 = Js.Object.entries(M_realData.UNL_2026)
					local _i2 = 0
					while _i2 < Js.alen(_arr1) do
						_i2 += 1
						local _e3 = _arr1[_i2]
						local g = _e3[1]
						local teams = _e3[2]
						local L = S.idx(g, 0);
						(function() if groupsByLeague[L] == nil then groupsByLeague[L] = Js.O({}, nil) end; return groupsByLeague[L] end)()[g] = M_realData.realList(teams)
					end
				end
			else
				leagues = ((function() local _v = w.facts:get(("NL-" .. Js.numstr((year - 2)) .. ":outcome")); if _v == nil then return nil end; _v = _v.next; return _v end)() or defaultLeagues(w))
				local rng = M_engine.rngFor(("draw|" .. ed))
				local last = (w.facts:get(("NL-" .. Js.numstr((year - 2)) .. ":ranking")) or Js.alit())
				local seedOf = function(t)
					local i = A.indexOf(last, t)
					do return (if (i < 0) then (1000 + w.rankOf(t)) else i) end
				end
				do
					local _arr4 = Js.Object.entries(leagues)
					local _i5 = 0
					while _i5 < Js.alen(_arr4) do
						_i5 += 1
						local _e6 = _arr4[_i5]
						local L = _e6[1]
						local teams = _e6[2]
						local seeded = A.sort(Js.aspread(teams), function(a, b)
							return (seedOf(a) - seedOf(b))
						end)
						if (Js.alen(seeded) == 18) then
							local gs = Js.alit(Js.alit(), Js.alit(), Js.alit())
							do
								local _arr7 = M_engine.pots(seeded, 6)
								local _i8 = 0
								while _i8 < Js.alen(_arr7) do
									_i8 += 1
									local pot = _arr7[_i8]
									local s6 = M_engine.shuffled(pot, rng)
									A.forEach(gs, function(g, i)
										return A.push(g, s6[(2 * i) + 1], s6[((2 * i) + 1) + 1])
									end)
								end
							end
							groupsByLeague[L] = Js.Object.fromEntries(A.map(gs, function(g, i)
								return Js.alit((L .. Js.numstr((i + 1))), g)
							end))
						else
							local n = Math.max(1, Math.round((Js.alen(seeded) / 6)))
							local gs = M_engine.drawGroups(M_engine.pots(seeded, n), n, rng)
							groupsByLeague[L] = Js.Object.fromEntries(A.map(gs, function(g, i)
								return Js.alit((L .. Js.numstr((i + 1))), g)
							end))
						end
					end
				end
			end
			w.facts:set((ed .. ":groups"), groupsByLeague)
			do
				local _arr9 = Js.Object.entries(groupsByLeague)
				local _i10 = 0
				while _i10 < Js.alen(_arr9) do
					_i10 += 1
					local _e11 = _arr9[_i10]
					local L = _e11[1]
					local groups = _e11[2]
					M_build.groupStage(w, Js.ospread(Js.O({ edition = ed, comp = "Nations League", importance = 15, groups = groups, dates = autumn, rounds = (if (year == 2026) then "double" else "single"), label = ("League " .. L .. " · Group") }, { "edition", "comp", "importance", "groups", "dates", "rounds", "label" }), (if (year == 2026) then Js.O({}, nil) else Js.O({ schedule = function(t, g)
						return nl6Schedule(t, M_engine.rngFor(("nl6|" .. ed .. "|" .. g)))
					end }, { "schedule" }))))
				end
			end
		end
		w:at(M_world.noon(Js.Date.UTC(year, 7, 20)), start)
		w:at(M_world.dayAfter(autumn[Js.alen(autumn)]), function()
			local fit
			local T = Js.O({}, nil)
			do
				local _arr12 = Js.Object.entries(groupsByLeague)
				local _i13 = 0
				while _i13 < Js.alen(_arr12) do
					_i13 += 1
					local _e14 = _arr12[_i13]
					local L = _e14[1]
					local groups = _e14[2]
					T[L] = M_build.groupTables(w, ed, groups, "h2h")
				end
			end
			w.facts:set((ed .. ":tables"), T)
			local rng = M_engine.rngFor(("after|" .. ed))
			local leagues = A.sort(Js.Object.keys(T))
			local pos = function(L, p)
				return A.map(M_build.placedFair(w, ed, T[L], p), function(r)
					return r.name
				end)
			end
			local ranking = Js.alit()
			do
				local _arr15 = leagues
				local _i16 = 0
				while _i16 < Js.alen(_arr15) do
					_i16 += 1
					local L = _arr15[_i16]
					local size = Math.max(Js.unpack(A.map(Js.Object.values(T[L]), function(t)
						return Js.alen(t)
					end)))
					for p = 0, math.ceil(size) - 1 do
						A.push(ranking, Js.unpack(pos(L, p)))
					end
				end
			end
			local groupWinners = A.flatMap(leagues, function(L)
				return pos(L, 0)
			end)
			local next_ = Js.O({}, nil)
			local move = function(team, to)
				A.push((function() if next_[to] == nil then next_[to] = Js.alit() end; return next_[to] end)(), team)
			end
			local busy = Js.alit()
			local tie = function(stage)
				return Js.O({ edition = ed, comp = "Nations League", importance = 25, stage = stage }, { "edition", "comp", "importance", "stage" })
			end
			local pendingPlayoffs = Js.alit()
			local playoff = function(upperTeam, lowerTeam, upperL, lowerL, key)
				local legs = M_build.twoLegs(w, tie(("League " .. upperL .. "/" .. lowerL .. " Play-Off")), lowerTeam, upperTeam, mar, key)
				A.push(pendingPlayoffs, Js.O({ upper = upperL, lower = lowerL, legs = legs }, { "upper", "lower", "legs" }))
				A.push(busy, upperTeam, lowerTeam)
			end
			local qfTeams = nil
			if (year == 2026) then
				local winA = pos("A", 0)
				local ruA = pos("A", 1)
				local thA = pos("A", 2)
				local foA = pos("A", 3)
				qfTeams = Js.aspread(winA, ruA)
				do
					local _arr17 = qfTeams
					local _i18 = 0
					while _i18 < Js.alen(_arr17) do
						_i18 += 1
						local t = _arr17[_i18]
						move(t, "A")
					end
				end
				do
					local _arr19 = A.slice(thA, 0, 2)
					local _i20 = 0
					while _i20 < Js.alen(_arr19) do
						_i20 += 1
						local t = _arr19[_i20]
						move(t, "A")
					end
				end
				do
					local _arr21 = A.slice(foA, 2)
					local _i22 = 0
					while _i22 < Js.alen(_arr21) do
						_i22 += 1
						local t = _arr21[_i22]
						move(t, "B")
					end
				end
				local abUpper = Js.aspread(A.slice(thA, 2), A.slice(foA, 0, 2))
				local ruB = M_engine.shuffled(pos("B", 1), rng)
				A.forEach(abUpper, function(u, i)
					return playoff(u, ruB[i + 1], "A", "B", ("AB-" .. Js.numstr((i + 1))))
				end)
				do
					local _arr23 = pos("B", 0)
					local _i24 = 0
					while _i24 < Js.alen(_arr23) do
						_i24 += 1
						local t = _arr23[_i24]
						move(t, "A")
					end
				end
				do
					local _arr25 = pos("B", 2)
					local _i26 = 0
					while _i26 < Js.alen(_arr25) do
						_i26 += 1
						local t = _arr25[_i26]
						move(t, "B")
					end
				end
				local foB = pos("B", 3)
				local ruC = M_engine.shuffled(pos("C", 1), rng)
				A.forEach(foB, function(u, i)
					return playoff(u, ruC[i + 1], "B", "C", ("BC-" .. Js.numstr((i + 1))))
				end)
				do
					local _arr27 = pos("C", 0)
					local _i28 = 0
					while _i28 < Js.alen(_arr27) do
						_i28 += 1
						local t = _arr27[_i28]
						move(t, "B")
					end
				end
				do
					local _arr29 = Js.aspread(pos("C", 2), pos("C", 3), pos("D", 0), pos("D", 1), pos("D", 2))
					local _i30 = 0
					while _i30 < Js.alen(_arr29) do
						_i30 += 1
						local t = _arr29[_i30]
						move(t, "C")
					end
				end
			else
				local w1 = pos("A", 0)
				local r1 = pos("A", 1)
				local t1 = pos("A", 2)
				qfTeams = Js.aspread(w1, r1, A.slice(t1, 0, 2))
				do
					local _arr31 = Js.aspread(w1, r1, t1)
					local _i32 = 0
					while _i32 < Js.alen(_arr31) do
						_i32 += 1
						local t = _arr31[_i32]
						move(t, "A")
					end
				end
				do
					local _arr33 = pos("A", 5)
					local _i34 = 0
					while _i34 < Js.alen(_arr33) do
						_i34 += 1
						local t = _arr33[_i34]
						move(t, "B")
					end
				end
				do
					local _arr35 = pos("B", 0)
					local _i36 = 0
					while _i36 < Js.alen(_arr35) do
						_i36 += 1
						local t = _arr35[_i36]
						move(t, "A")
					end
				end
				do
					local _arr37 = pos("B", 5)
					local _i38 = 0
					while _i38 < Js.alen(_arr37) do
						_i38 += 1
						local t = _arr37[_i38]
						move(t, "C")
					end
				end
				do
					local _arr39 = pos("C", 0)
					local _i40 = 0
					while _i40 < Js.alen(_arr39) do
						_i40 += 1
						local t = _arr39[_i40]
						move(t, "B")
					end
				end
				do
					local _arr41 = Js.aspread(pos("C", 3), pos("C", 4), pos("C", 5))
					local _i42 = 0
					while _i42 < Js.alen(_arr41) do
						_i42 += 1
						local t = _arr41[_i42]
						move(t, "C")
					end
				end
				do
					local _arr43 = Js.alit(Js.alit("A", "B"), Js.alit("B", "C"))
					local _i44 = 0
					while _i44 < Js.alen(_arr43) do
						_i44 += 1
						local _e45 = _arr43[_i44]
						local U = _e45[1]
						local D = _e45[2]
						local upper = Js.aspread(pos(U, 3), pos(U, 4))
						local lower = A.reverse(Js.aspread(pos(D, 1), pos(D, 2)))
						A.forEach(upper, function(u, i)
							return playoff(u, lower[i + 1], U, D, (U .. D .. "-" .. Js.numstr((i + 1))))
						end)
					end
				end
			end
			local groupOf = Js.Map.new()
			do
				local _arr46 = Js.Object.entries(T.A)
				local _i47 = 0
				while _i47 < Js.alen(_arr46) do
					_i47 += 1
					local _e48 = _arr46[_i47]
					local g = _e48[1]
					local rows = _e48[2]
					do
						local _arr49 = rows
						local _i50 = 0
						while _i50 < Js.alen(_arr49) do
							_i50 += 1
							local r = _arr49[_i50]
							groupOf:set(r.name, g)
						end
					end
				end
			end
			local seeded = A.slice(qfTeams, 0, 4)
			local unseeded = M_engine.shuffled(A.slice(qfTeams, 4), rng)
			local order = Js.alit()
			local used = Js.Set.new()
			fit = function(k)
				if (k == Js.alen(seeded)) then
					do return true end
				end
				do
					local _arr51 = unseeded
					local _i52 = 0
					while _i52 < Js.alen(_arr51) do
						_i52 += 1
						local u = _arr51[_i52]
						if (used:has(u) or (groupOf:get(u) == groupOf:get(seeded[k + 1]))) then
							do continue end
						end
						used:add(u)
						A.set(order, k, u)
						if fit((k + 1)) then
							do return true end
						end
						used:delete(u)
					end
				end
				do return false end
			end
			if (not fit(0)) then
				A.forEach(unseeded, function(u, k)
					return (function() local _a = u; A.set(order, k, _a); return _a end)()
				end)
			end
			local draw = A.flat(M_engine.shuffled(A.map(seeded, function(s, k)
				return Js.alit(order[k + 1], s)
			end), rng))
			A.push(busy, Js.unpack(qfTeams))
			M_build.bracket(w, Js.O({ edition = ed, comp = "Nations League", names = Js.alit("Quarter-Final", "Semi-Final", "Final"), dates = Js.alit(mar, jun[1], jun[2]), importance = function()
				return 25
			end, level = "et-pens", neutral = true, thirdPlace = true }, { "edition", "comp", "names", "dates", "importance", "level", "neutral", "thirdPlace" }), draw)
			w:at(M_world.dayAfter(mar[2]), function()
				do
					local _arr53 = pendingPlayoffs
					local _i54 = 0
					while _i54 < Js.alen(_arr53) do
						_i54 += 1
						local p = _arr53[_i54]
						move(M_build.legsWinner(p.legs), p.upper)
						move(M_build.legsLoser(p.legs), p.lower)
					end
				end
				local outcome = Js.O({ next = next_, ranking = ranking, groupWinners = groupWinners, marchBusy = busy }, { "next", "ranking", "groupWinners", "marchBusy" })
				w.facts:set((ed .. ":outcome"), outcome)
			end)
			w.facts:set((ed .. ":ranking"), ranking)
			w.facts:set((ed .. ":groupWinners"), groupWinners)
			w.facts:set((ed .. ":marchBusy"), busy)
		end)
	end
	exports.nationsLeague = nationsLeague
	nl6Schedule = function(t, rng)
		local L = Js.alit(t[2], t[3], t[5], t[6], t[4], t[1])
		local rounds = Js.alit()
		for r = 0, 4 do
			A.push(rounds, Js.alit(Js.alit(L[6], L[r + 1]), Js.alit(L[math.fmod((r + 1), 5) + 1], L[math.fmod((r + 4), 5) + 1]), Js.alit(L[math.fmod((r + 2), 5) + 1], L[math.fmod((r + 3), 5) + 1])))
		end
		local first = A.map(rounds[1], function(_p55)
			local a = _p55[1]
			local b = _p55[2]
			return (if (rng() < 0.5) then Js.alit(a, b) else Js.alit(b, a))
		end)
		local games = A.flat(A.slice(rounds, 1))
		local startAt = math.floor((rng() * 4096))
		local pick = 0
		for k = 0, 4095 do
			local mask = math.fmod((startAt + k), 4096)
			local h = Js.Map.new()
			A.forEach(games, function(_p56, i)
				local a = _p56[1]
				local b = _p56[2]
				local home = (if Js.T(Js.band(mask, Js.shl(1, i))) then a else b)
				h:set(home, ((h:get(home) or 0) + 1))
			end)
			if A.every(t, function(x)
				return (h:get(x) == 2)
			end) then
				pick = mask
				do break end
			end
		end
		local i = 0
		local middle = A.map(A.slice(rounds, 1), function(day)
			return A.map(day, function(_p57)
				local a = _p57[1]
				local b = _p57[2]
				return (if Js.T(Js.band(pick, Js.shl(1, (function() local _o = i; i = _o + 1; return _o end)()))) then Js.alit(a, b) else Js.alit(b, a))
			end)
		end)
		do return Js.aspread(Js.alit(first), middle, Js.alit(A.map(first, function(_p58)
			local h = _p58[1]
			local a = _p58[2]
			return Js.alit(a, h)
		end))) end
	end
	exports.nl6Schedule = nl6Schedule
	defaultLeagues = function(w)
		local all = A.sort(uefaNations(), function(a, b)
			return (w.rankOf(a) - w.rankOf(b))
		end)
		do return Js.O({ A = A.slice(all, 0, 18), B = A.slice(all, 18, 36), C = A.slice(all, 36) }, { "A", "B", "C" }) end
	end
	qualifyingGroups = function(w, ed, comp, tYear, exclude, onDone)
		local y = (tYear - 1)
		local nlEd = ("NL-" .. Js.numstr((tYear - 2)))
		w:at(M_world.noon(Js.Date.UTC((tYear - 2), 11, 6)), function()
			local nlRank = (w.facts:get((nlEd .. ":ranking")) or Js.alit())
			local busySet = Js.Set.new((w.facts:get((nlEd .. ":marchBusy")) or Js.alit()))
			local field = A.filter(uefaNations(), function(n)
				return (not A.includes(exclude, n))
			end)
			local rankKey = function(n)
				local i = A.indexOf(nlRank, n)
				do return (if (i < 0) then (900 + w.rankOf(n)) else i) end
			end
			A.sort(field, function(a, b)
				return (rankKey(a) - rankKey(b))
			end)
			local G = 12
			local need4 = math.ceil((busySet.size / 4))
			while ((G < 14) and ((G - Math.max(0, Math.min(G, (Js.alen(field) - (4 * G))))) < need4)) do
				G += 1
			end
			local fives = Math.max(0, Math.min(G, (Js.alen(field) - (4 * G))))
			local fours = (G - fives)
			local in4 = A.filter(field, function(n)
				return busySet:has(n)
			end)
			local others = A.filter(field, function(n)
				return (not busySet:has(n))
			end)
			while ((Js.alen(in4) < (4 * fours)) and Js.T(Js.alen(others))) do
				A.push(in4, A.pop(others))
			end
			while (Js.alen(in4) > (4 * fours)) do
				A.push(others, A.pop(in4))
			end
			in4 = A.sort(in4, function(a, b)
				return (rankKey(a) - rankKey(b))
			end)
			A.sort(others, function(a, b)
				return (rankKey(a) - rankKey(b))
			end)
			local rng = M_engine.rngFor(("draw|" .. ed))
			local g4 = (if (fours > 0) then M_engine.drawGroups(M_engine.pots(in4, fours), fours, rng) else Js.alit())
			local g5 = (if (fives > 0) then M_engine.drawGroups(M_engine.pots(others, fives), fives, rng) else Js.alit())
			local groups = Js.O({}, nil)
			A.forEach(g4, function(g, i)
				return (function() local _a = g; groups[S.idx(letters, i)] = _a; return _a end)()
			end)
			A.forEach(g5, function(g, i)
				return (function() local _a = g; groups[S.idx(letters, (fours + i))] = _a; return _a end)()
			end)
			w.facts:set((ed .. ":groups"), groups)
			local dates5 = M_build.matchdays(Js.alit(Js.alit(y, "mar"), Js.alit(y, "jun"), Js.alit(y, "sepoct"), Js.alit(y, "nov")))
			local dates4 = M_build.matchdays(Js.alit(Js.alit(y, "sepoct"), Js.alit(y, "nov")))
			do
				local _arr59 = Js.Object.entries(groups)
				local _i60 = 0
				while _i60 < Js.alen(_arr59) do
					_i60 += 1
					local _e61 = _arr59[_i60]
					local g = _e61[1]
					local teams = _e61[2]
					M_build.groupStage(w, Js.O({ edition = ed, comp = comp, importance = 25, groups = Js.ospread((function() local _o = Js.O({}, nil); _o[Js.key(g)] = teams; return _o end)()), dates = (if (Js.alen(teams) == 5) then dates5 else (if (Js.alen(dates4) >= (2 * (Js.alen(teams) - 1))) then dates4 else dates5)), rounds = "double" }, { "edition", "comp", "importance", "groups", "dates", "rounds" }))
				end
			end
			local last = M_build.matchday(y, "nov", 1)
			w:at(M_world.dayAfter(last), function()
				local tables = M_build.groupTables(w, ed, groups, "h2h")
				w.facts:set((ed .. ":tables"), tables)
				onDone(tables, field)
			end)
		end)
	end
	playoffPaths = function(w, ed, comp, year, teams, paths, onDone)
		if (paths <= 0) then
			onDone(Js.alit())
			do return end
		end
		local rng = M_engine.rngFor(("paths|" .. ed))
		local sorted = A.slice(A.sort(Js.aspread(teams), function(a, b)
			return (w.rankOf(a) - w.rankOf(b))
		end), 0, (paths * 4))
		local top = A.slice(sorted, 0, (paths * 2))
		local bottom = M_engine.shuffled(A.slice(sorted, (paths * 2)), rng)
		local winners = Js.alit()
		for p = 0, math.ceil(paths) - 1 do
			local a = A.filter(Js.alit(top[(2 * p) + 1], bottom[(2 * p) + 1], top[((2 * p) + 1) + 1], bottom[((2 * p) + 1) + 1]), Js.Boolean)
			if (Js.alen(a) < 4) then
				if Js.T(a[1]) then
					A.push(winners, a[1])
				end
				do continue end
			end
			M_build.bracket(w, Js.O({ edition = ed, comp = comp, names = Js.alit(("Play-Off Path " .. Js.numstr((p + 1)) .. " Semi-Final"), ("Play-Off Path " .. Js.numstr((p + 1)) .. " Final")), dates = Js.alit(M_build.matchday(year, "mar", 0), M_build.matchday(year, "mar", 1)), importance = function()
				return 25
			end, level = "et-pens", archive = false }, { "edition", "comp", "names", "dates", "importance", "level", "archive" }), a, function(r)
				A.push(winners, r.winner)
				if (Js.alen(winners) == paths) then
					onDone(winners)
				end
			end)
		end
		if (Js.alen(winners) == paths) then
			onDone(winners)
		end
	end
	euroCycle = function(w, euroYear)
		local ed = ("EURO-" .. Js.numstr(euroYear))
		local qed = ("EUROQ-" .. Js.numstr(euroYear))
		local hosts = A.filter(M_hosts.euroHosts(euroYear), function(h)
			return A.includes(uefaNations(), h)
		end)
		local qualified = Js.alit()
		qualifyingGroups(w, qed, "Euro Qualifier", euroYear, Js.alit(), function(tables)
			local winners = A.map(Js.Object.values(tables), function(t)
				return t[1].name
			end)
			local ru = A.map(M_build.placedFair(w, qed, tables, 1), function(r)
				return r.name
			end)
			A.push(qualified, Js.unpack(Js.aspread(winners, A.slice(ru, 0, Math.max(0, (20 - Js.alen(winners)))))))
			local missedHosts = A.slice(A.sort(A.filter(hosts, function(h)
				return (not A.includes(qualified, h))
			end), function(a, b)
				return (w.rankOf(a) - w.rankOf(b))
			end), 0, 2)
			A.push(qualified, Js.unpack(missedHosts))
			local paths = Math.max(0, (24 - Js.alen(qualified)))
			local nlRank = (w.facts:get(("NL-" .. Js.numstr((euroYear - 2)) .. ":ranking")) or Js.alit())
			local cands = A.filter(Js.aspread(A.slice(ru, Math.max(0, (20 - Js.alen(winners)))), nlRank), function(n, i, a)
				return ((not A.includes(qualified, n)) and (A.indexOf(a, n) == i))
			end)
			playoffPaths(w, qed, "Euro Qualifier", euroYear, A.slice(cands, 0, (paths * 4)), paths, function(pw)
				A.push(qualified, Js.unpack(pw))
				w.facts:set((ed .. ":qualified"), Js.aspread(qualified))
			end)
		end)
		local start = (if (euroYear == 2028) then M_build.utcNoon(2028, 6, 9) else secondFriday(euroYear, 6))
		w:at(M_world.noon(Js.Date.UTC(euroYear, 3, 2)), function()
			local q = (w.facts:get((ed .. ":qualified")) or qualified)
			local field = fillTo(w, q, 24, uefaNations())
			local qHosts = A.filter(hosts, function(h)
				return A.includes(field, h)
			end)
			local rest = A.sort(A.filter(field, function(n)
				return (not A.includes(qHosts, n))
			end), function(a, b)
				return (w.rankOf(a) - w.rankOf(b))
			end)
			local seeded = Js.aspread(qHosts, rest)
			local fixed = Js.O({}, nil)
			A.forEach(A.slice(qHosts, 0, 6), function(h, i)
				return (function() local _a = Js.alit(h); fixed[Js.key(i)] = _a; return _a end)()
			end)
			local groups = M_engine.drawGroups(M_engine.pots(seeded, 6), 6, M_engine.rngFor(("draw|" .. ed)), function()
				return true
			end, fixed)
			M_build.tournament(w, Js.O({ edition = ed, comp = "European Championship", groups = Js.Object.fromEntries(A.map(groups, function(g, i)
				return Js.alit(S.idx(letters, i), g)
			end)), groupDates = Js.alit(start, M_build.plusDays(start, 4), M_build.plusDays(start, 8)), names = Js.alit("Round of 16", "Quarter-Final", "Semi-Final", "Final"), koDates = Js.alit(M_build.plusDays(start, 13), M_build.plusDays(start, 18), M_build.plusDays(start, 23), M_build.plusDays(start, 30)), groupImportance = 35, koImportance = function(r)
				return (if (r >= 1) then 40 else 35)
			end, tie = "h2h", thirds = 4, hosts = qHosts }, { "edition", "comp", "groups", "groupDates", "names", "koDates", "groupImportance", "koImportance", "tie", "thirds", "hosts" }))
		end)
	end
	exports.euroCycle = euroCycle
	uefaWorldCupQualifying = function(w, wcYear, onDone)
		local qed = ("WCQ-UEFA-" .. Js.numstr(wcYear))
		local hosts = A.filter(M_hosts.worldCupHosts(wcYear), function(h)
			return A.includes(uefaNations(), h)
		end)
		qualifyingGroups(w, qed, "World Cup Qualifier", wcYear, hosts, function(tables)
			local winners = A.map(Js.Object.values(tables), function(t)
				return t[1].name
			end)
			local slots = (UEFA_WC_SLOTS - Js.alen(hosts))
			local direct = A.slice(winners, 0, slots)
			local paths = Math.max(0, (slots - Js.alen(direct)))
			local ru = A.map(M_build.placedFair(w, qed, tables, 1), function(r)
				return r.name
			end)
			local nlWinners = A.filter((w.facts:get(("NL-" .. Js.numstr((wcYear - 2)) .. ":groupWinners")) or Js.alit()), function(n)
				return (((not A.includes(direct, n)) and (not A.includes(ru, n))) and (not A.includes(hosts, n)))
			end)
			local cands = Js.aspread(ru, A.slice(nlWinners, 0, 4))
			playoffPaths(w, qed, "World Cup Qualifier", wcYear, A.slice(cands, 0, (paths * 4)), paths, function(pw)
				return onDone(Js.aspread(direct, pw))
			end)
		end)
	end
	exports.uefaWorldCupQualifying = uefaWorldCupQualifying
	secondFriday = function(year, month)
		local first = Js.Date.new(Js.Date.UTC(year, (month - 1), 1, 12))
		local toFri = math.fmod(((5 - first:getUTCDay()) + 7), 7)
		do return (first:getTime() + ((toFri + 7) * DAY)) end
	end
	exports.secondFriday = secondFriday
	fillTo = function(w, q, n, pool)
		local out = A.slice(Js.Array.from(Js.Set.new(q)), 0, n)
		if (Js.alen(out) < n) then
			w.facts:set(("warn:" .. Js.numstr(n) .. ":" .. pool[1] .. ":" .. Js.numstr(w.now)), ("filled " .. Js.numstr((n - Js.alen(out)))))
			do
				local _arr62 = A.sort(Js.aspread(pool), function(a, b)
					return (w.rankOf(a) - w.rankOf(b))
				end)
				local _i63 = 0
				while _i63 < Js.alen(_arr62) do
					_i63 += 1
					local p = _arr62[_i63]
					if (Js.alen(out) >= n) then
						do break end
					end
					if (not A.includes(out, p)) then
						A.push(out, p)
					end
				end
			end
		end
		do return out end
	end
	exports.fillTo = fillTo
	DAY = 86400000
	letters = "ABCDEFGHIJKLMN"
	UEFA_WC_SLOTS = 16
	exports.UEFA_WC_SLOTS = UEFA_WC_SLOTS
end
