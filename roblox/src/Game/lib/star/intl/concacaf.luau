--!nocheck
--!nolint
-- Generated from lib/star/intl/concacaf.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_nations = import("lib/star/intl/nations")
	local M_realData = import("lib/star/intl/realData")
	local M_build = import("lib/star/intl/build")
	local M_world = import("lib/star/intl/world")
	local M_engine = import("lib/star/intl/engine")
	local M_uefa = import("lib/star/intl/uefa")
	local M_hosts = import("lib/star/intl/hosts")
	local letters, concacafNations, startingLeagues, concacafNationsLeague, goldCup, concacafWorldCupQualifying
	concacafNations = function()
		do return A.map(M_nations.nationsIn("CONCACAF"), function(n)
			return n.name
		end) end
	end
	exports.concacafNations = concacafNations
	startingLeagues = function(w)
		local A_ = M_realData.realList(M_realData.CNL_2026.A)
		local B = M_realData.realList(M_realData.CNL_2026.B)
		local C = M_realData.realList(M_realData.CNL_2026.C)
		local byRank = function(xs)
			return A.sort(Js.aspread(xs), function(a, b)
				return (w.rankOf(a) - w.rankOf(b))
			end)
		end
		while ((Js.alen(A_) < 16) and Js.T(Js.alen(B))) do
			local t = byRank(B)[1]
			A.push(A_, t)
			A.splice(B, A.indexOf(B, t), 1)
		end
		while ((Js.alen(B) < 12) and Js.T(Js.alen(C))) do
			local t = byRank(C)[1]
			A.push(B, t)
			A.splice(C, A.indexOf(C, t), 1)
		end
		do return Js.O({ A = A_, B = B, C = C }, { "A", "B", "C" }) end
	end
	concacafNationsLeague = function(w, year)
		local ed = ("CNL-" .. Js.numstr(year))
		local sepoct = M_build.matchdays(Js.alit(Js.alit(year, "sepoct")))
		local autumn = M_build.matchdays(Js.alit(Js.alit(year, "sepoct"), Js.alit(year, "nov")))
		local nov = Js.alit(M_build.matchday(year, "nov", 0), M_build.matchday(year, "nov", 1))
		local mar = Js.alit(M_build.matchday((year + 1), "mar", 0), M_build.matchday((year + 1), "mar", 1))
		local leagues = Js.O({}, nil)
		local byes = Js.alit()
		local groupsOf = Js.O({}, nil)
		w:at(M_world.noon(Js.Date.UTC(year, 7, 15)), function()
			leagues = (if (year == 2026) then startingLeagues(w) else ((function() local _v = w.facts:get(("CNL-" .. Js.numstr((year - 2)) .. ":outcome")); if _v == nil then return nil end; _v = _v.next; return _v end)() or startingLeagues(w)))
			local rng = M_engine.rngFor(("draw|" .. ed))
			local byRank = function(xs)
				return A.sort(Js.aspread(xs), function(a, b)
					return (w.rankOf(a) - w.rankOf(b))
				end)
			end
			local A_ = byRank(leagues.A)
			byes = A.slice(A_, 0, 4)
			local swiss = M_engine.drawGroups(M_engine.pots(A.slice(A_, 4), 2), 2, rng)
			groupsOf.A = Js.O({ A1 = swiss[1], A2 = swiss[2] }, { "A1", "A2" })
			local nB = Math.max(1, Math.round((Js.alen(leagues.B) / 4)))
			groupsOf.B = Js.Object.fromEntries(A.map(M_engine.drawGroups(M_engine.pots(byRank(leagues.B), nB), nB, rng), function(g, i)
				return Js.alit(("B" .. Js.numstr((i + 1))), g)
			end))
			local nC = Math.max(1, Math.round((Js.alen(leagues.C) / 4)))
			groupsOf.C = Js.Object.fromEntries(A.map(M_engine.drawGroups(M_engine.pots(byRank(leagues.C), nC), nC, rng), function(g, i)
				return Js.alit(("C" .. Js.numstr((i + 1))), g)
			end))
			w.facts:set((ed .. ":groups"), Js.ospread(groupsOf, Js.O({ byes = byes }, { "byes" })))
			M_build.groupStage(w, Js.O({ edition = ed, comp = "CONCACAF Nations League", importance = 15, groups = groupsOf.A, dates = sepoct, rounds = "single", maxRounds = 4, label = "League A · Group" }, { "edition", "comp", "importance", "groups", "dates", "rounds", "maxRounds", "label" }))
			M_build.groupStage(w, Js.O({ edition = ed, comp = "CONCACAF Nations League", importance = 15, groups = groupsOf.B, dates = autumn, rounds = "double", label = "League B · Group" }, { "edition", "comp", "importance", "groups", "dates", "rounds", "label" }))
			M_build.groupStage(w, Js.O({ edition = ed, comp = "CONCACAF Nations League", importance = 15, groups = groupsOf.C, dates = autumn, rounds = "double", label = "League C · Group" }, { "edition", "comp", "importance", "groups", "dates", "rounds", "label" }))
		end)
		w:at(M_world.dayAfter(sepoct[Js.alen(sepoct)]), function()
			local T = M_build.groupTables(w, ed, groupsOf.A, "overall")
			local top2 = A.map(Js.aspread(A.slice(T.A1, 0, 2), A.slice(T.A2, 0, 2)), function(r)
				return r.name
			end)
			local order = M_engine.shuffled(top2, M_engine.rngFor(("qf|" .. ed)))
			local entrants = A.flatMap(byes, function(b, i)
				return Js.alit(order[i + 1], b)
			end)
			w.facts:set((ed .. ":qf"), Js.aspread(byes, top2))
			M_build.bracket(w, Js.O({ edition = ed, comp = "CONCACAF Nations League", names = Js.alit("Quarter-Final", "Semi-Final", "Final"), dates = Js.alit(nov, mar[1], mar[2]), importance = function()
				return 25
			end, level = "et-pens", neutral = true, thirdPlace = true }, { "edition", "comp", "names", "dates", "importance", "level", "neutral", "thirdPlace" }), entrants, function(r)
				local sf = Js.aspread(Js.alit(r.winner, r.runnerUp), (if r.losers[2] ~= nil then r.losers[2] else Js.alit()))
				local qfLosers = A.sort((if r.losers[1] ~= nil then r.losers[1] else Js.alit()), function(a, b)
					return (w.rankOf(a) - w.rankOf(b))
				end)
				w.facts:set((ed .. ":qfWinners"), sf)
				w.facts:set((ed .. ":qfLosers"), qfLosers)
				local _ = sf
			end)
			w:at(M_world.dayAfter(nov[2]), function()
				local ws = A.filter(w:edition(ed), function(m)
					return S.startsWith(m.stage, "Quarter")
				end)
				local ties = Js.Map.new()
				do
					local _arr1 = ws
					local _i2 = 0
					while _i2 < Js.alen(_arr1) do
						_i2 += 1
						local m = _arr1[_i2]
						local k = A.join(A.sort(Js.alit(m.home, m.away)), "|")
						ties:set(k, Js.alit(m.home, m.away))
					end
				end
				local qfW = Js.alit()
				local qfL = Js.alit()
				do
					local _arr3 = Js.Array.from(ties)
					local _i4 = 0
					while _i4 < Js.alen(_arr3) do
						_i4 += 1
						local _e5 = _arr3[_i4]
						local k = _e5[1]
						local legs = A.sort(A.filter(ws, function(m)
							return (A.join(A.sort(Js.alit(m.home, m.away)), "|") == k)
						end), function(a, b)
							return (a.date - b.date)
						end)
						local win = (if (Js.alen(legs) == 2) then M_build.legsWinner(Js.O({ first = legs[1], second = legs[2] }, { "first", "second" })) else M_engine.winnerOf(legs[1]))
						if (not Js.T(win)) then
							do continue end
						end
						A.push(qfW, win)
						A.push(qfL, A.find(S.split(k, "|"), function(x)
							return (x ~= win)
						end))
					end
				end
				local L = A.sort(qfL, function(a, b)
					return (w.rankOf(a) - w.rankOf(b))
				end)
				local po = (if (Js.alen(L) >= 4) then Js.alit(M_build.single(w, Js.O({ edition = ed, comp = "CONCACAF Nations League", stage = "Copa América Play-Off", importance = 15 }, { "edition", "comp", "stage", "importance" }), L[1], L[4], mar[1], "CPO-1"), M_build.single(w, Js.O({ edition = ed, comp = "CONCACAF Nations League", stage = "Copa América Play-Off", importance = 15 }, { "edition", "comp", "stage", "importance" }), L[2], L[3], mar[1], "CPO-2")) else Js.alit())
				w:at(M_world.dayAfter(mar[1]), function()
					local poW = A.filter(A.map(po, function(m)
						return M_engine.winnerOf(m)
					end), function(x)
						return (not (not Js.T(x)))
					end)
					w.facts:set((ed .. ":copa"), A.slice(Js.aspread(qfW, poW, A.filter(L, function(x)
						return (not A.includes(poW, x))
					end)), 0, 6))
				end)
			end)
		end)
		w:at(M_world.dayAfter(autumn[Js.alen(autumn)]), function()
			local TA = M_build.groupTables(w, ed, groupsOf.A, "overall")
			local TB = M_build.groupTables(w, ed, groupsOf.B, "overall")
			local TC = M_build.groupTables(w, ed, groupsOf.C, "overall")
			local at = function(T, p)
				return A.map(M_build.placed(w, T, p), function(r)
					return r.name
				end)
			end
			local relA = Js.aspread(at(TA, 4), at(TA, 5))
			local promB = A.slice(Js.aspread(at(TB, 0), at(TB, 1)), 0, Js.alen(relA))
			local relB = A.filter(A.map(Js.Object.values(TB), function(t)
				return t[Js.alen(t)].name
			end), function(n)
				return (not A.includes(promB, n))
			end)
			local promC = A.slice(Js.aspread(at(TC, 0), at(TC, 1)), 0, Js.alen(relB))
			local next_ = Js.O({ A = Js.aspread(A.filter(leagues.A, function(n)
				return (not A.includes(relA, n))
			end), promB), B = Js.aspread(A.filter(leagues.B, function(n)
				return ((not A.includes(promB, n)) and (not A.includes(relB, n)))
			end), relA, promC), C = Js.aspread(A.filter(leagues.C, function(n)
				return (not A.includes(promC, n))
			end), relB) }, { "A", "B", "C" })
			w.facts:set((ed .. ":outcome"), Js.O({ next = next_ }, { "next" }))
			w.facts:set((ed .. ":tables"), Js.ospread(TA, TB, TC))
			local goldDirectB = at(TB, 0)
			local prelimB = A.slice(A.filter(Js.aspread(at(TB, 1)), function(n)
				return (not A.includes(promB, n))
			end), 0, 2)
			local a34 = Js.aspread(at(TA, 2), at(TA, 3))
			w.facts:set((ed .. ":gold"), Js.O({ directB = goldDirectB, prelim = Js.aspread(a34, prelimB) }, { "directB", "prelim" }))
			local rng = M_engine.rngFor(("playin|" .. ed))
			local c = M_engine.shuffled(promC, rng)
			local ties = A.map(A.slice(relA, 0, Js.alen(c)), function(a, i)
				return M_build.twoLegs(w, Js.O({ edition = ed, comp = "CONCACAF Nations League", importance = 15, stage = "Play-In" }, { "edition", "comp", "importance", "stage" }), c[i + 1], a, mar, ("PI-" .. Js.numstr((i + 1))))
			end)
			local leftover = A.slice(relA, Js.alen(c))
			w:at(M_world.dayAfter(mar[2]), function()
				local winners = Js.aspread(A.map(ties, function(t)
					return M_build.legsWinner(t)
				end), leftover)
				local g = w.facts:get((ed .. ":gold"))
				w.facts:set((ed .. ":gold"), Js.ospread(g, Js.O({ prelim = Js.aspread(g.prelim, winners) }, { "prelim" })))
				local _ = M_build.legsLoser
			end)
		end)
	end
	exports.concacafNationsLeague = concacafNationsLeague
	goldCup = function(w, year)
		local ed = ("GOLD-" .. Js.numstr(year))
		local cnl = ("CNL-" .. Js.numstr((year - 1)))
		local jun = Js.alit(M_build.matchday(year, "jun", 0), M_build.matchday(year, "jun", 1))
		local start = M_build.plusDays(jun[2], 6)
		local direct = Js.alit()
		local prelimWinners = Js.alit()
		w:at(M_world.noon(Js.Date.UTC(year, 3, 20)), function()
			local qfw = (w.facts:get((cnl .. ":qfWinners")) or Js.alit())
			local qfl = (w.facts:get((cnl .. ":qfLosers")) or Js.alit())
			local g = (w.facts:get((cnl .. ":gold")) or Js.O({ directB = Js.alit(), prelim = Js.alit() }, { "directB", "prelim" }))
			A.push(direct, Js.unpack(Js.aspread(qfw, g.directB)))
			local prelim = A.sort(A.filter(Js.Array.from(Js.Set.new(Js.aspread(qfl, g.prelim))), function(n)
				return (not A.includes(direct, n))
			end), function(a, b)
				return (w.rankOf(a) - w.rankOf(b))
			end)
			local need = (16 - Js.alen(direct))
			local ties = Js.alit()
			local n = math.floor((Js.alen(prelim) / 2))
			for i = 0, n - 1 do
				A.push(ties, M_build.single(w, Js.O({ edition = ed, comp = "Gold Cup Qualifier", importance = 25, stage = "Preliminary Round", level = "et-pens" }, { "edition", "comp", "importance", "stage", "level" }), prelim[i + 1], prelim[((Js.alen(prelim) - 1) - i) + 1], jun[2], ("P-" .. Js.numstr((i + 1)))))
			end
			local bye = (if Js.T(math.fmod(Js.alen(prelim), 2)) then Js.alit(prelim[n + 1]) else Js.alit())
			w:at(M_world.dayAfter(jun[2]), function()
				local wins = Js.aspread(A.map(ties, function(t)
					return M_engine.winnerOf(t)
				end), bye)
				local losers = A.sort(A.map(ties, function(t)
					return M_engine.loserOf(t)
				end), function(a, b)
					return (w.rankOf(a) - w.rankOf(b))
				end)
				A.push(prelimWinners, Js.unpack(A.slice(Js.aspread(wins, losers), 0, need)))
				local field = M_uefa.fillTo(w, Js.aspread(direct, prelimWinners), 16, concacafNations())
				local hosts = A.filter(M_hosts.GOLD_CUP_HOSTS, function(h)
					return A.includes(field, h)
				end)
				local seeded = Js.aspread(hosts, A.sort(A.filter(field, function(x)
					return (not A.includes(hosts, x))
				end), function(a, b)
					return (w.rankOf(a) - w.rankOf(b))
				end))
				local fixed = Js.O({}, nil)
				A.forEach(hosts, function(h, i)
					return (function() local _a = Js.alit(h); fixed[Js.key(i)] = _a; return _a end)()
				end)
				local groups = M_engine.drawGroups(M_engine.pots(seeded, 4), 4, M_engine.rngFor(("draw|" .. ed)), function()
					return true
				end, fixed)
				M_build.tournament(w, Js.O({ edition = ed, comp = "Gold Cup", groups = Js.Object.fromEntries(A.map(groups, function(x, i)
					return Js.alit(S.idx(letters, i), x)
				end)), groupDates = Js.alit(start, M_build.plusDays(start, 4), M_build.plusDays(start, 8)), names = Js.alit("Quarter-Final", "Semi-Final", "Final"), koDates = Js.alit(M_build.plusDays(start, 12), M_build.plusDays(start, 16), M_build.plusDays(start, 21)), groupImportance = 35, koImportance = function()
					return 40
				end, tie = "overall", thirds = 0, hosts = hosts }, { "edition", "comp", "groups", "groupDates", "names", "koDates", "groupImportance", "koImportance", "tie", "thirds", "hosts" }))
			end)
		end)
	end
	exports.goldCup = goldCup
	concacafWorldCupQualifying = function(w, wcYear, slots, onDone)
		local ed = ("WCQ-CONCACAF-" .. Js.numstr(wcYear))
		local hosts = M_hosts.worldCupHosts(wcYear)
		local field0 = A.filter(concacafNations(), function(n)
			return (not A.includes(hosts, n))
		end)
		local direct = (slots.direct - (Js.alen(concacafNations()) - Js.alen(field0)))
		local r1Dates = Js.alit(M_build.matchday((wcYear - 3), "nov", 0), M_build.matchday((wcYear - 3), "nov", 1))
		local r2Dates = Js.alit(M_build.matchday((wcYear - 2), "mar", 0), M_build.matchday((wcYear - 2), "mar", 1), M_build.matchday((wcYear - 2), "jun", 0), M_build.matchday((wcYear - 2), "jun", 1), M_build.matchday((wcYear - 1), "jun", 0))
		local r3Dates = M_build.matchdays(Js.alit(Js.alit((wcYear - 1), "sepoct"), Js.alit((wcYear - 1), "nov")))
		local r1 = Js.alit()
		local r2Field = Js.alit()
		local r2Groups = Js.O({}, nil)
		local r3Groups = Js.O({}, nil)
		w:at(M_world.noon(Js.Date.UTC((wcYear - 3), 9, 20)), function()
			local byRank = A.sort(Js.aspread(field0), function(a, b)
				return (w.rankOf(a) - w.rankOf(b))
			end)
			local k = Math.max(0, (2 * (Js.alen(byRank) - 30)))
			local low = A.slice(byRank, (Js.alen(byRank) - k))
			r2Field = A.slice(byRank, 0, (Js.alen(byRank) - k))
			local rng = M_engine.rngFor(("draw|" .. ed))
			local sh = M_engine.shuffled(low, rng)
			do
				local i = 0
				local _first6 = true
				while true do
					if not _first6 then
						i += 2
					end
					_first6 = false
					if not ((i + 1) < Js.alen(sh)) then break end
					A.push(r1, M_build.twoLegs(w, Js.O({ edition = ed, comp = "World Cup Qualifier", importance = 25, stage = "First Round" }, { "edition", "comp", "importance", "stage" }), sh[i + 1], sh[(i + 1) + 1], r1Dates, ("R1-" .. Js.numstr(((i / 2) + 1)))))
				end
			end
		end)
		w:at(M_world.dayAfter(r1Dates[2]), function()
			local field = A.sort(Js.aspread(r2Field, A.map(r1, function(t)
				return M_build.legsWinner(t)
			end)), function(a, b)
				return (w.rankOf(a) - w.rankOf(b))
			end)
			local nG = Math.max(1, Math.round((Js.alen(field) / 5)))
			local gs = M_engine.drawGroups(M_engine.pots(field, nG), nG, M_engine.rngFor(("draw2|" .. ed)))
			r2Groups = Js.Object.fromEntries(A.map(gs, function(g, i)
				return Js.alit(S.idx(letters, i), g)
			end))
			M_build.groupStage(w, Js.O({ edition = ed, comp = "World Cup Qualifier", importance = 25, groups = r2Groups, dates = r2Dates, rounds = "single", label = "Second Round · Group" }, { "edition", "comp", "importance", "groups", "dates", "rounds", "label" }))
		end)
		w:at(M_world.dayAfter(r2Dates[Js.alen(r2Dates)]), function()
			local T = M_build.groupTables(w, ed, r2Groups, "overall")
			local adv = A.sort(A.flatMap(Js.Object.values(T), function(t)
				return A.map(A.slice(t, 0, 2), function(r)
					return r.name
				end)
			end), function(a, b)
				return (w.rankOf(a) - w.rankOf(b))
			end)
			local nG = Math.max(1, Math.round((Js.alen(adv) / 4)))
			local gs = M_engine.drawGroups(M_engine.pots(adv, nG), nG, M_engine.rngFor(("draw3|" .. ed)))
			r3Groups = Js.Object.fromEntries(A.map(gs, function(g, i)
				return Js.alit(("R3-" .. S.idx(letters, i)), g)
			end))
			M_build.groupStage(w, Js.O({ edition = ed, comp = "World Cup Qualifier", importance = 25, groups = r3Groups, dates = r3Dates, rounds = "double", label = "Third Round · Group" }, { "edition", "comp", "importance", "groups", "dates", "rounds", "label" }))
		end)
		w:at(M_world.dayAfter(r3Dates[Js.alen(r3Dates)]), function()
			local T = M_build.groupTables(w, ed, r3Groups, "overall")
			local order = A.flatMap(Js.alit(0, 1, 2, 3), function(p)
				return A.map(M_engine.rankAcrossGroups(A.filter(A.map(Js.Object.values(T), function(t)
					return t[p + 1]
				end), Js.Boolean), w.rankOf), function(r)
					return r.name
				end)
			end)
			onDone(Js.O({ direct = A.slice(order, 0, direct), ic = A.slice(order, direct, (direct + slots.ic)) }, { "direct", "ic" }))
		end)
	end
	exports.concacafWorldCupQualifying = concacafWorldCupQualifying
	letters = "ABCDEFGHIJKL"
end
