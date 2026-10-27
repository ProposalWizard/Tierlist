--!nocheck
--!nolint
-- Generated from lib/star/intl/caf.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_nations = import("lib/star/intl/nations")
	local M_build = import("lib/star/intl/build")
	local M_hosts = import("lib/star/intl/hosts")
	local M_realData = import("lib/star/intl/realData")
	local M_engine = import("lib/star/intl/engine")
	local M_world = import("lib/star/intl/world")
	local M_uefa = import("lib/star/intl/uefa")
	local letters, cafNations, afconStart, afconYears, afcon, cafWorldCupQualifying
	cafNations = function()
		do return A.map(M_nations.nationsIn("CAF"), function(n)
			return n.name
		end) end
	end
	exports.cafNations = cafNations
	afconStart = function(year)
		if (year == 2027) then
			do return M_build.utcNoon(2027, 6, 19) end
		end
		if (year == 2028) then
			do return M_build.plusDays(M_build.matchday(2028, "jun", 1), 8) end
		end
		do return M_build.utcNoon((year - 1), 12, 20) end
	end
	exports.afconStart = afconStart
	afconYears = function(until_)
		local out = Js.alit(2027, 2028)
		do
			local y = 2032
			local _first1 = true
			while true do
				if not _first1 then
					y += 4
				end
				_first1 = false
				if not (y <= until_) then break end
				A.push(out, y)
			end
		end
		do return out end
	end
	exports.afconYears = afconYears
	afcon = function(w, year)
		local qed = ("AFCONQ-" .. Js.numstr(year))
		local ed = ("AFCON-" .. Js.numstr(year))
		local hosts = A.filter(A.map(M_hosts.afconHosts(year), function(h)
			return M_realData.realList(Js.alit(h))[1]
		end), Js.Boolean)
		local start = afconStart(year)
		local groupDates = nil
		local prelimDates = nil
		if (year == 2027) then
			groupDates = A.concat(A.slice(M_build.matchdays(Js.alit(Js.alit(2026, "sepoct"))), 0, 2), M_build.matchdays(Js.alit(Js.alit(2026, "nov"), Js.alit(2027, "mar"))))
		elseif (year == 2028) then
			prelimDates = Js.alit(M_build.matchday(2027, "jun", 0), M_build.matchday(2027, "jun", 1))
			groupDates = M_build.matchdays(Js.alit(Js.alit(2027, "sepoct"), Js.alit(2027, "nov")))
		else
			prelimDates = Js.alit(M_build.matchday((year - 2), "nov", 0), M_build.matchday((year - 2), "nov", 1))
			groupDates = Js.aspread(M_build.matchdays(Js.alit(Js.alit((year - 1), "mar"), Js.alit((year - 1), "jun"))), A.slice(M_build.matchdays(Js.alit(Js.alit((year - 1), "sepoct"))), 0, 2))
		end
		local groups = Js.O({}, nil)
		local r1 = Js.alit()
		local seededField = Js.alit()
		local drawAndPlay = function()
			if (year == 2027) then
				groups = Js.Object.fromEntries(A.map(Js.Object.entries(M_realData.AFCONQ_2027), function(_p2)
					local g = _p2[1]
					local t = _p2[2]
					return Js.alit(g, M_realData.realList(t))
				end))
			else
				local field = A.sort(Js.aspread(seededField, A.map(r1, function(t)
					return M_build.legsWinner(t)
				end)), function(a, b)
					return (w.rankOf(a) - w.rankOf(b))
				end)
				local nG = Math.round((Js.alen(field) / 4))
				local gs = M_engine.drawGroups(M_engine.pots(field, nG), nG, M_engine.rngFor(("draw|" .. qed)), function(t, g)
					return (not (A.includes(hosts, t) and A.some(g, function(x)
						return A.includes(hosts, x)
					end)))
				end)
				groups = Js.Object.fromEntries(A.map(gs, function(g, i)
					return Js.alit(S.idx(letters, i), g)
				end))
			end
			w.facts:set((qed .. ":groups"), groups)
			M_build.groupStage(w, Js.O({ edition = qed, comp = "AFCON Qualifier", importance = 25, groups = groups, dates = groupDates, rounds = "double" }, { "edition", "comp", "importance", "groups", "dates", "rounds" }))
		end
		if prelimDates then
			w:at(M_world.noon((prelimDates[1] - (40 * 86400000))), function()
				local field = A.sort(cafNations(), function(a, b)
					return (w.rankOf(a) - w.rankOf(b))
				end)
				local k = Math.max(0, (Js.alen(field) - 42))
				seededField = A.slice(field, 0, (Js.alen(field) - k))
				local low = M_engine.shuffled(A.slice(field, (Js.alen(field) - k)), M_engine.rngFor(("pre|" .. qed)))
				r1 = Js.alit()
				do
					local i = 0
					local _first3 = true
					while true do
						if not _first3 then
							i += 2
						end
						_first3 = false
						if not ((i + 1) < Js.alen(low)) then break end
						A.push(r1, M_build.twoLegs(w, Js.O({ edition = qed, comp = "AFCON Qualifier", importance = 25, stage = "Preliminary Round" }, { "edition", "comp", "importance", "stage" }), low[i + 1], low[(i + 1) + 1], prelimDates, ("P-" .. Js.numstr(((i / 2) + 1)))))
					end
				end
			end)
			w:at(M_world.dayAfter(prelimDates[2]), drawAndPlay)
		else
			w:at(M_world.noon(Js.Date.UTC(2026, 7, 10)), drawAndPlay)
		end
		w:at(M_world.dayAfter(groupDates[Js.alen(groupDates)]), function()
			local T = M_build.groupTables(w, qed, groups, "h2h")
			w.facts:set((qed .. ":tables"), T)
			local q = Js.alit()
			do
				local _arr4 = Js.Object.values(T)
				local _i5 = 0
				while _i5 < Js.alen(_arr4) do
					_i5 += 1
					local t = _arr4[_i5]
					local names = A.map(t, function(r)
						return r.name
					end)
					local host = A.find(names, function(n)
						return A.includes(hosts, n)
					end)
					if Js.T(host) then
						A.push(q, host, A.filter(names, function(n)
							return (n ~= host)
						end)[1])
					else
						A.push(q, names[1], names[2])
					end
				end
			end
			do
				local _arr6 = hosts
				local _i7 = 0
				while _i7 < Js.alen(_arr6) do
					_i7 += 1
					local h = _arr6[_i7]
					if (not A.includes(q, h)) then
						A.push(q, h)
					end
				end
			end
			local field = A.slice(M_uefa.fillTo(w, q, 24, cafNations()), 0, 24)
			w.facts:set((ed .. ":qualified"), field)
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
			local gs = M_engine.drawGroups(M_engine.pots(seeded, 6), 6, M_engine.rngFor(("draw|" .. ed)), function()
				return true
			end, fixed)
			M_build.tournament(w, Js.O({ edition = ed, comp = "Africa Cup of Nations", groups = Js.Object.fromEntries(A.map(gs, function(g, i)
				return Js.alit(S.idx(letters, i), g)
			end)), groupDates = Js.alit(start, M_build.plusDays(start, 4), M_build.plusDays(start, 8)), names = Js.alit("Round of 16", "Quarter-Final", "Semi-Final", "Final"), koDates = Js.alit(M_build.plusDays(start, 12), M_build.plusDays(start, 16), M_build.plusDays(start, 20), M_build.plusDays(start, 28)), groupImportance = 35, koImportance = function(r)
				return (if (r >= 1) then 40 else 35)
			end, tie = "h2h", thirds = 4, hosts = qHosts, thirdPlace = true }, { "edition", "comp", "groups", "groupDates", "names", "koDates", "groupImportance", "koImportance", "tie", "thirds", "hosts", "thirdPlace" }))
		end)
	end
	exports.afcon = afcon
	cafWorldCupQualifying = function(w, wcYear, slots, onDone)
		local ed = ("WCQ-CAF-" .. Js.numstr(wcYear))
		local hosts = M_hosts.worldCupHosts(wcYear)
		local field = A.filter(cafNations(), function(n)
			return (not A.includes(hosts, n))
		end)
		local direct = (slots.direct - (Js.alen(cafNations()) - Js.alen(field)))
		local dates = M_build.matchdays(Js.alit(Js.alit((wcYear - 2), "sepoct"), Js.alit((wcYear - 2), "nov"), Js.alit((wcYear - 1), "mar"), Js.alit((wcYear - 1), "jun")))
		local po = Js.alit(M_build.matchday((wcYear - 1), "nov", 0), M_build.matchday((wcYear - 1), "nov", 1))
		local groups = Js.O({}, nil)
		w:at(M_world.noon(Js.Date.UTC((wcYear - 2), 7, 1)), function()
			local seeded = A.sort(Js.aspread(field), function(a, b)
				return (w.rankOf(a) - w.rankOf(b))
			end)
			local gs = M_engine.drawGroups(M_engine.pots(seeded, 9), 9, M_engine.rngFor(("draw|" .. ed)))
			groups = Js.Object.fromEntries(A.map(gs, function(g, i)
				return Js.alit(S.idx(letters, i), g)
			end))
			M_build.groupStage(w, Js.O({ edition = ed, comp = "World Cup Qualifier", importance = 25, groups = groups, dates = dates, rounds = "double" }, { "edition", "comp", "importance", "groups", "dates", "rounds" }))
		end)
		w:at(M_world.dayAfter(dates[Js.alen(dates)]), function()
			local T = M_build.groupTables(w, ed, groups, "h2h")
			w.facts:set((ed .. ":tables"), T)
			local winners = A.map(M_build.placedFair(w, ed, T, 0), function(r)
				return r.name
			end)
			local ru = A.slice(A.map(M_build.placedFair(w, ed, T, 1), function(r)
				return r.name
			end), 0, 4)
			local out = A.slice(winners, 0, direct)
			local over = A.slice(winners, direct)
			M_build.bracket(w, Js.O({ edition = ed, comp = "World Cup Qualifier", names = Js.alit("Play-Off Semi-Final", "Play-Off Final"), dates = po, importance = function()
				return 25
			end, level = "et-pens", neutral = true, archive = false }, { "edition", "comp", "names", "dates", "importance", "level", "neutral", "archive" }), Js.alit(ru[1], ru[4], ru[2], ru[3]), function(r)
				return onDone(Js.O({ direct = out, ic = A.slice(Js.aspread(over, Js.alit(r.winner)), 0, slots.ic) }, { "direct", "ic" }))
			end)
		end)
	end
	exports.cafWorldCupQualifying = cafWorldCupQualifying
	letters = "ABCDEFGHIJKL"
end
