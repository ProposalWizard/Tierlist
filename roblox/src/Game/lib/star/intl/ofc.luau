--!nocheck
--!nolint
-- Generated from lib/star/intl/ofc.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_nations = import("lib/star/intl/nations")
	local M_build = import("lib/star/intl/build")
	local M_hosts = import("lib/star/intl/hosts")
	local M_world = import("lib/star/intl/world")
	local M_engine = import("lib/star/intl/engine")
	local M_uefa = import("lib/star/intl/uefa")
	local ofcNations, preliminary, ofcWorldCupQualifying, ofcNationsCup
	ofcNations = function()
		do return A.map(M_nations.nationsIn("OFC"), function(n)
			return n.name
		end) end
	end
	exports.ofcNations = ofcNations
	preliminary = function(w, ed, comp, field, dates, then_)
		local byRank = A.sort(Js.aspread(field), function(a, b)
			return (w.rankOf(a) - w.rankOf(b))
		end)
		if (Js.alen(byRank) < 11) then
			then_(byRank, nil)
			do return end
		end
		local low = A.slice(byRank, -4)
		local top = A.slice(byRank, 0, -4)
		M_build.bracket(w, Js.O({ edition = ed, comp = comp, names = Js.alit("Preliminary Semi-Final", "Preliminary Final"), dates = dates, importance = function()
			return (if (comp == "World Cup Qualifier") then 25 else 35)
		end, level = "et-pens", neutral = true, archive = false }, { "edition", "comp", "names", "dates", "importance", "level", "neutral", "archive" }), Js.alit(low[1], low[4], low[2], low[3]), function(r)
			return then_(top, r.winner)
		end)
	end
	ofcWorldCupQualifying = function(w, wcYear, slots, onDone)
		local ed = ("WCQ-OFC-" .. Js.numstr(wcYear))
		local hosts = M_hosts.worldCupHosts(wcYear)
		local field = A.filter(ofcNations(), function(n)
			return (not A.includes(hosts, n))
		end)
		local so = M_build.matchdays(Js.alit(Js.alit((wcYear - 2), "sepoct")))
		local r2Dates = Js.alit(so[3], so[4], M_build.matchday((wcYear - 2), "nov", 0))
		local r3Dates = Js.alit(M_build.matchday((wcYear - 1), "mar", 0), M_build.matchday((wcYear - 1), "mar", 1))
		local groups = Js.O({}, nil)
		w:at(M_world.noon(Js.Date.UTC((wcYear - 2), 7, 1)), function()
			preliminary(w, ed, "World Cup Qualifier", field, Js.alit(so[1], so[2]), function(top, win)
				local f = Js.aspread(top, (if Js.T(win) then Js.alit(win) else Js.alit()))
				local gs = M_engine.drawGroups(M_engine.pots(f, 2), 2, M_engine.rngFor(("draw|" .. ed)))
				groups = Js.O({ A = gs[1], B = gs[2] }, { "A", "B" })
				M_build.groupStage(w, Js.O({ edition = ed, comp = "World Cup Qualifier", importance = 25, groups = groups, dates = r2Dates, rounds = "single", neutral = true, label = "Second Round · Group" }, { "edition", "comp", "importance", "groups", "dates", "rounds", "neutral", "label" }))
			end)
		end)
		w:at(M_world.dayAfter(r2Dates[3]), function()
			local T = M_build.groupTables(w, ed, groups, "h2h")
			M_build.bracket(w, Js.O({ edition = ed, comp = "World Cup Qualifier", names = Js.alit("Third Round Semi-Final", "Third Round Final"), dates = r3Dates, importance = function()
				return 25
			end, level = "et-pens", neutral = true, archive = false }, { "edition", "comp", "names", "dates", "importance", "level", "neutral", "archive" }), Js.alit(T.A[1].name, T.B[2].name, T.B[1].name, T.A[2].name), function(r)
				return onDone(Js.O({ direct = A.slice(Js.alit(r.winner), 0, slots.direct), ic = A.slice(Js.alit(r.runnerUp), 0, slots.ic) }, { "direct", "ic" }))
			end)
		end)
	end
	exports.ofcWorldCupQualifying = ofcWorldCupQualifying
	ofcNationsCup = function(w, year)
		local ed = ("OFCNC-" .. Js.numstr(year))
		local hosts = M_hosts.ofcHosts(year)
		local mar = Js.alit(M_build.matchday(year, "mar", 0), M_build.matchday(year, "mar", 1))
		local start = M_build.plusDays(M_build.matchday(year, "jun", 1), 6)
		local entrants = Js.alit()
		w:at(M_world.noon(Js.Date.UTC(year, 1, 1)), function()
			preliminary(w, ed, "OFC Nations Cup", ofcNations(), mar, function(top, win)
				entrants = Js.aspread(top, (if Js.T(win) then Js.alit(win) else Js.alit()))
			end)
		end)
		w:at(M_world.noon(Js.Date.UTC(year, 3, 10)), function()
			local field = M_uefa.fillTo(w, entrants, 8, ofcNations())
			local qHosts = A.filter(hosts, function(h)
				return A.includes(field, h)
			end)
			local seeded = Js.aspread(qHosts, A.sort(A.filter(field, function(n)
				return (not A.includes(qHosts, n))
			end), function(a, b)
				return (w.rankOf(a) - w.rankOf(b))
			end))
			local gs = M_engine.drawGroups(M_engine.pots(seeded, 2), 2, M_engine.rngFor(("draw|" .. ed)), function()
				return true
			end, (if Js.T(Js.alen(qHosts)) then Js.O({ ["0"] = Js.alit(qHosts[1]) }, { "0" }) else Js.O({}, nil)))
			M_build.tournament(w, Js.O({ edition = ed, comp = "OFC Nations Cup", groups = Js.O({ A = gs[1], B = gs[2] }, { "A", "B" }), groupDates = Js.alit(start, M_build.plusDays(start, 3), M_build.plusDays(start, 6)), names = Js.alit("Semi-Final", "Final"), koDates = Js.alit(M_build.plusDays(start, 10), M_build.plusDays(start, 14)), groupImportance = 35, koImportance = function()
				return 40
			end, tie = "h2h", thirds = 0, hosts = qHosts, thirdPlace = true }, { "edition", "comp", "groups", "groupDates", "names", "koDates", "groupImportance", "koImportance", "tie", "thirds", "hosts", "thirdPlace" }))
		end)
	end
	exports.ofcNationsCup = ofcNationsCup
end
