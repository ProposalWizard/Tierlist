--!nocheck
--!nolint
-- Generated from lib/star/intl/afc.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_nations = import("lib/star/intl/nations")
	local M_build = import("lib/star/intl/build")
	local M_world = import("lib/star/intl/world")
	local M_realData = import("lib/star/intl/realData")
	local M_hosts = import("lib/star/intl/hosts")
	local M_engine = import("lib/star/intl/engine")
	local M_uefa = import("lib/star/intl/uefa")
	local letters, afcNations, asianCupStart, asianCupFinals, asianCup2027, afcWorldCupQualifying
	afcNations = function()
		do return A.map(M_nations.nationsIn("AFC"), function(n)
			return n.name
		end) end
	end
	exports.afcNations = afcNations
	asianCupStart = function(year)
		do return (if (year == 2027) then M_build.utcNoon(2027, 1, 7) else M_build.utcNoon(year, 1, 9)) end
	end
	exports.asianCupStart = asianCupStart
	asianCupFinals = function(w, year, groups, hosts)
		local ed = ("AC-" .. Js.numstr(year))
		local start = asianCupStart(year)
		M_build.tournament(w, Js.O({ edition = ed, comp = "Asian Cup", groups = groups, groupDates = Js.alit(start, M_build.plusDays(start, 4), M_build.plusDays(start, 8)), names = Js.alit("Round of 16", "Quarter-Final", "Semi-Final", "Final"), koDates = Js.alit(M_build.plusDays(start, 13), M_build.plusDays(start, 18), M_build.plusDays(start, 23), M_build.plusDays(start, 29)), groupImportance = 35, koImportance = function(r)
			return (if (r >= 1) then 40 else 35)
		end, tie = "h2h", thirds = 4, hosts = hosts }, { "edition", "comp", "groups", "groupDates", "names", "koDates", "groupImportance", "koImportance", "tie", "thirds", "hosts" }))
	end
	asianCup2027 = function(w)
		w:at(M_world.noon(Js.Date.UTC(2026, 7, 5)), function()
			local groups = Js.Object.fromEntries(A.map(Js.Object.entries(M_realData.ASIAN_CUP_2027), function(_p1)
				local g = _p1[1]
				local t = _p1[2]
				return Js.alit(g, M_realData.realList(t))
			end))
			asianCupFinals(w, 2027, groups, Js.alit())
		end)
	end
	exports.asianCup2027 = asianCup2027
	afcWorldCupQualifying = function(w, wcYear, slots, onDone)
		local ed = ("WCQ-AFC-" .. Js.numstr(wcYear))
		local acYear = (wcYear + 1)
		local hosts = M_hosts.worldCupHosts(wcYear)
		local field0 = A.filter(afcNations(), function(n)
			return (not A.includes(hosts, n))
		end)
		local afcHosts = A.filter(afcNations(), function(n)
			return A.includes(hosts, n)
		end)
		local direct = (slots.direct - Js.alen(afcHosts))
		local so = function(y)
			return M_build.matchdays(Js.alit(Js.alit(y, "sepoct")))
		end
		local r1Dates = Js.alit(so((wcYear - 3))[1], so((wcYear - 3))[2])
		local r2Dates = Js.aspread(Js.alit(so((wcYear - 3))[3], so((wcYear - 3))[4]), M_build.matchdays(Js.alit(Js.alit((wcYear - 3), "nov"), Js.alit((wcYear - 2), "mar"))))
		local r3Dates = M_build.matchdays(Js.alit(Js.alit((wcYear - 2), "jun"), Js.alit((wcYear - 2), "sepoct"), Js.alit((wcYear - 2), "nov"), Js.alit((wcYear - 1), "mar")))
		local acDates = M_build.matchdays(Js.alit(Js.alit((wcYear - 2), "jun"), Js.alit((wcYear - 2), "sepoct")))
		local r4Dates = A.slice(so((wcYear - 1)), 0, 3)
		local r5Dates = Js.alit(M_build.matchday((wcYear - 1), "nov", 0), M_build.matchday((wcYear - 1), "nov", 1))
		local r1 = Js.alit()
		local r2Seeded = Js.alit()
		local r2Groups = Js.O({}, nil)
		local r3Groups = Js.O({}, nil)
		local r4Groups = Js.O({}, nil)
		local acGroups = Js.O({}, nil)
		local acQualified = Js.aspread(afcHosts)
		w:at(M_world.noon(Js.Date.UTC((wcYear - 3), 7, 1)), function()
			local byRank = A.sort(Js.aspread(field0), function(a, b)
				return (w.rankOf(a) - w.rankOf(b))
			end)
			local k = Math.max(0, (2 * (Js.alen(byRank) - 36)))
			r2Seeded = A.slice(byRank, 0, (Js.alen(byRank) - k))
			local low = A.slice(byRank, (Js.alen(byRank) - k))
			r1 = Js.alit()
			for i = 0, math.ceil((Js.alen(low) / 2)) - 1 do
				A.push(r1, M_build.twoLegs(w, Js.O({ edition = ed, comp = "World Cup Qualifier", importance = 25, stage = "First Round" }, { "edition", "comp", "importance", "stage" }), low[((Js.alen(low) - 1) - i) + 1], low[i + 1], r1Dates, ("R1-" .. Js.numstr((i + 1)))))
			end
		end)
		w:at(M_world.dayAfter(r1Dates[2]), function()
			local field = A.sort(Js.aspread(r2Seeded, A.map(r1, function(t)
				return M_build.legsWinner(t)
			end)), function(a, b)
				return (w.rankOf(a) - w.rankOf(b))
			end)
			local nG = Math.round((Js.alen(field) / 4))
			r2Groups = Js.Object.fromEntries(A.map(M_engine.drawGroups(M_engine.pots(field, nG), nG, M_engine.rngFor(("draw2|" .. ed))), function(g, i)
				return Js.alit(S.idx(letters, i), g)
			end))
			M_build.groupStage(w, Js.O({ edition = ed, comp = "World Cup Qualifier", importance = 25, groups = r2Groups, dates = r2Dates, rounds = "double", label = "Second Round · Group" }, { "edition", "comp", "importance", "groups", "dates", "rounds", "label" }))
		end)
		w:at(M_world.dayAfter(r2Dates[Js.alen(r2Dates)]), function()
			local T = M_build.groupTables(w, ed, r2Groups, "h2h")
			local adv = A.sort(A.flatMap(Js.Object.values(T), function(t)
				return A.map(A.slice(t, 0, 2), function(r)
					return r.name
				end)
			end), function(a, b)
				return (w.rankOf(a) - w.rankOf(b))
			end)
			r3Groups = Js.Object.fromEntries(A.map(M_engine.drawGroups(M_engine.pots(adv, 3), 3, M_engine.rngFor(("draw3|" .. ed))), function(g, i)
				return Js.alit(("R3-" .. S.idx(letters, i)), g)
			end))
			M_build.groupStage(w, Js.O({ edition = ed, comp = "World Cup Qualifier", importance = 25, groups = r3Groups, dates = r3Dates, rounds = "double", label = "Third Round · Group" }, { "edition", "comp", "importance", "groups", "dates", "rounds", "label" }))
			A.push(acQualified, Js.unpack(adv))
			local rest = A.sort(A.flatMap(Js.Object.values(T), function(t)
				return A.map(A.slice(t, 2, 4), function(r)
					return r.name
				end)
			end), function(a, b)
				return (w.rankOf(a) - w.rankOf(b))
			end)
			local nG = Math.max(1, Math.round((Js.alen(rest) / 3)))
			acGroups = Js.Object.fromEntries(A.map(M_engine.drawGroups(M_engine.pots(rest, nG), nG, M_engine.rngFor(("drawAC|" .. ed))), function(g, i)
				return Js.alit(("AC-" .. S.idx(letters, i)), g)
			end))
			M_build.groupStage(w, Js.O({ edition = ("ACQ-" .. Js.numstr(acYear)), comp = "Asian Cup Qualifier", importance = 25, groups = acGroups, dates = acDates, rounds = "double", label = "Third Round · Group" }, { "edition", "comp", "importance", "groups", "dates", "rounds", "label" }))
		end)
		w:at(M_world.dayAfter(acDates[Js.alen(acDates)]), function()
			local T = M_build.groupTables(w, ("ACQ-" .. Js.numstr(acYear)), acGroups, "h2h")
			local winners = A.map(M_build.placed(w, T, 0), function(r)
				return r.name
			end)
			local ru = A.map(M_build.placed(w, T, 1), function(r)
				return r.name
			end)
			local need = (24 - Js.alen(acQualified))
			A.push(acQualified, Js.unpack(A.slice(Js.aspread(winners, ru), 0, Math.max(0, need))))
			w.facts:set(("AC-" .. Js.numstr(acYear) .. ":qualified"), A.slice(acQualified, 0, 24))
		end)
		local r3Order = Js.alit()
		w:at(M_world.dayAfter(r3Dates[Js.alen(r3Dates)]), function()
			local T = M_build.groupTables(w, ed, r3Groups, "h2h")
			r3Order = A.flatMap(Js.alit(0, 1), function(p)
				return A.map(M_engine.rankAcrossGroups(A.map(Js.Object.values(T), function(t)
					return t[p + 1]
				end), w.rankOf), function(r)
					return r.name
				end)
			end)
			local r4 = A.flatMap(Js.alit(2, 3), function(p)
				return A.map(M_engine.rankAcrossGroups(A.map(Js.Object.values(T), function(t)
					return t[p + 1]
				end), w.rankOf), function(r)
					return r.name
				end)
			end)
			local nG = Math.max(1, Math.round((Js.alen(r4) / 3)))
			r4Groups = Js.Object.fromEntries(A.map(M_engine.drawGroups(M_engine.pots(r4, nG), nG, M_engine.rngFor(("draw4|" .. ed))), function(g, i)
				return Js.alit(("R4-" .. S.idx(letters, i)), g)
			end))
			M_build.groupStage(w, Js.O({ edition = ed, comp = "World Cup Qualifier", importance = 25, groups = r4Groups, dates = r4Dates, rounds = "single", label = "Fourth Round · Group", neutral = true }, { "edition", "comp", "importance", "groups", "dates", "rounds", "label", "neutral" }))
		end)
		w:at(M_world.dayAfter(r4Dates[Js.alen(r4Dates)]), function()
			local T = M_build.groupTables(w, ed, r4Groups, "h2h")
			local r4w = A.map(M_engine.rankAcrossGroups(A.map(Js.Object.values(T), function(t)
				return t[1]
			end), w.rankOf), function(r)
				return r.name
			end)
			local r4r = A.map(M_engine.rankAcrossGroups(A.map(Js.Object.values(T), function(t)
				return t[2]
			end), w.rankOf), function(r)
				return r.name
			end)
			local order = Js.aspread(r3Order, r4w)
			local out = A.slice(order, 0, direct)
			local over = A.slice(order, direct)
			local _d2 = M_engine.shuffled(r4r, M_engine.rngFor(("r5|" .. ed)))
			local a = _d2[1]
			local b = _d2[2]
			local legs = M_build.twoLegs(w, Js.O({ edition = ed, comp = "World Cup Qualifier", importance = 25, stage = "Fifth Round" }, { "edition", "comp", "importance", "stage" }), a, b, r5Dates, "R5")
			w:at(M_world.dayAfter(r5Dates[2]), function()
				return onDone(Js.O({ direct = out, ic = A.slice(Js.aspread(over, Js.alit(M_build.legsWinner(legs))), 0, slots.ic) }, { "direct", "ic" }))
			end)
		end)
		w:at(M_world.noon(Js.Date.UTC((acYear - 1), 9, 15)), function()
			local q = M_uefa.fillTo(w, (w.facts:get(("AC-" .. Js.numstr(acYear) .. ":qualified")) or Js.alit()), 24, afcNations())
			local top = A.slice(A.sort(Js.aspread(q), function(a, b)
				return (w.rankOf(a) - w.rankOf(b))
			end), 0, 12)
			local host = top[math.floor((M_engine.rngFor(("host|AC-" .. Js.numstr(acYear)))() * Js.alen(top))) + 1]
			local seeded = Js.aspread(Js.alit(host), A.sort(A.filter(q, function(n)
				return (n ~= host)
			end), function(a, b)
				return (w.rankOf(a) - w.rankOf(b))
			end))
			local gs = M_engine.drawGroups(M_engine.pots(seeded, 6), 6, M_engine.rngFor(("draw|AC-" .. Js.numstr(acYear))), function()
				return true
			end, Js.O({ ["0"] = Js.alit(host) }, { "0" }))
			asianCupFinals(w, acYear, Js.Object.fromEntries(A.map(gs, function(g, i)
				return Js.alit(S.idx(letters, i), g)
			end)), Js.alit(host))
		end)
	end
	exports.afcWorldCupQualifying = afcWorldCupQualifying
	letters = "ABCDEFGHIJKL"
end
