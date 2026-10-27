--!nocheck
--!nolint
-- Generated from lib/star/intl/conmebol.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_nations = import("lib/star/intl/nations")
	local M_hosts = import("lib/star/intl/hosts")
	local M_build = import("lib/star/intl/build")
	local M_engine = import("lib/star/intl/engine")
	local M_world = import("lib/star/intl/world")
	local M_uefa = import("lib/star/intl/uefa")
	local letters, conmebolNations, conmebolWorldCupQualifying, copaAmerica
	conmebolNations = function()
		do return A.map(M_nations.nationsIn("CONMEBOL"), function(n)
			return n.name
		end) end
	end
	exports.conmebolNations = conmebolNations
	conmebolWorldCupQualifying = function(w, wcYear, slots, onDone)
		local ed = ("WCQ-CONMEBOL-" .. Js.numstr(wcYear))
		local hosts = M_hosts.worldCupHosts(wcYear)
		local field = A.filter(conmebolNations(), function(n)
			return (not A.includes(hosts, n))
		end)
		local direct = (slots - (Js.alen(conmebolNations()) - Js.alen(field)))
		local y = (wcYear - 3)
		local all = M_build.matchdays(Js.alit(Js.alit(y, "sepoct"), Js.alit(y, "nov"), Js.alit((y + 1), "mar"), Js.alit((y + 1), "jun"), Js.alit((y + 1), "sepoct"), Js.alit((y + 1), "nov"), Js.alit((y + 2), "mar"), Js.alit((y + 2), "jun"), Js.alit((y + 2), "sepoct"), Js.alit((y + 2), "nov")))
		local rounds = Js.alen(M_engine.doubleRoundRobin(field))
		local dates = A.slice(all, 0, rounds)
		w:at(M_world.noon(Js.Date.UTC(y, 7, 1)), function()
			local order = M_engine.shuffled(field, M_engine.rngFor(("draw|" .. ed)))
			M_build.groupStage(w, Js.O({ edition = ed, comp = "World Cup Qualifier", importance = 25, groups = Js.O({ CONMEBOL = order }, { "CONMEBOL" }), dates = dates, rounds = "double", label = "" }, { "edition", "comp", "importance", "groups", "dates", "rounds", "label" }))
			w.facts:set((ed .. ":groups"), Js.O({ CONMEBOL = order }, { "CONMEBOL" }))
		end)
		w:at(M_world.dayAfter(dates[Js.alen(dates)]), function()
			local t = A.map(M_build.groupTables(w, ed, Js.O({ CONMEBOL = field }, { "CONMEBOL" }), "overall").CONMEBOL, function(r)
				return r.name
			end)
			w.facts:set((ed .. ":tables"), M_build.groupTables(w, ed, Js.O({ CONMEBOL = field }, { "CONMEBOL" }), "overall"))
			onDone(Js.O({ direct = A.slice(t, 0, direct), ic = A.slice(t, direct, (direct + 1)) }, { "direct", "ic" }))
		end)
	end
	exports.conmebolWorldCupQualifying = conmebolWorldCupQualifying
	copaAmerica = function(w, year)
		local ed = ("COPA-" .. Js.numstr(year))
		local hosts = M_hosts.copaHosts(year)
		local start = M_build.plusDays(M_uefa.secondFriday(year, 6), 7)
		w:at(M_world.noon(Js.Date.UTC(year, 3, 15)), function()
			local cnl = (w.facts:get(("CNL-" .. Js.numstr((year - 2)) .. ":copa")) or Js.alit())
			local guests = M_uefa.fillTo(w, cnl, 6, A.map(M_nations.nationsIn("CONCACAF"), function(n)
				return n.name
			end))
			local field = Js.aspread(conmebolNations(), guests)
			local qHosts = A.filter(hosts, function(h)
				return A.includes(field, h)
			end)
			local seeded = Js.aspread(qHosts, A.sort(A.filter(field, function(n)
				return (not A.includes(qHosts, n))
			end), function(a, b)
				return (w.rankOf(a) - w.rankOf(b))
			end))
			local fixed = Js.O({}, nil)
			A.forEach(qHosts, function(h, i)
				return (function() local _a = Js.alit(h); fixed[Js.key(i)] = _a; return _a end)()
			end)
			local groups = M_engine.drawGroups(M_engine.pots(seeded, 4), 4, M_engine.rngFor(("draw|" .. ed)), function()
				return true
			end, fixed)
			M_build.tournament(w, Js.O({ edition = ed, comp = "Copa América", groups = Js.Object.fromEntries(A.map(groups, function(g, i)
				return Js.alit(S.idx(letters, i), g)
			end)), groupDates = Js.alit(start, M_build.plusDays(start, 4), M_build.plusDays(start, 8)), names = Js.alit("Quarter-Final", "Semi-Final", "Final"), koDates = Js.alit(M_build.plusDays(start, 13), M_build.plusDays(start, 17), M_build.plusDays(start, 21)), groupImportance = 35, koImportance = function(r)
				return (if (r >= 0) then 40 else 35)
			end, tie = "overall", thirds = 0, hosts = qHosts, level = "pens", finalLevel = "et-pens", thirdPlace = true }, { "edition", "comp", "groups", "groupDates", "names", "koDates", "groupImportance", "koImportance", "tie", "thirds", "hosts", "level", "finalLevel", "thirdPlace" }))
		end)
	end
	exports.copaAmerica = copaAmerica
	letters = "ABCD"
end
