--!nocheck
--!nolint
-- Generated from lib/star/intl/worldCup.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_hosts = import("lib/star/intl/hosts")
	local M_uefa = import("lib/star/intl/uefa")
	local M_conmebol = import("lib/star/intl/conmebol")
	local M_concacaf = import("lib/star/intl/concacaf")
	local M_caf = import("lib/star/intl/caf")
	local M_afc = import("lib/star/intl/afc")
	local M_ofc = import("lib/star/intl/ofc")
	local M_build = import("lib/star/intl/build")
	local M_world = import("lib/star/intl/world")
	local M_engine = import("lib/star/intl/engine")
	local M_nations = import("lib/star/intl/nations")
	local letters, WC_SLOTS, worldCupStart, worldCupCycle
	worldCupStart = function(year)
		local first = Js.Date.new(Js.Date.UTC(year, 5, 1, 12))
		local toThu = math.fmod(((4 - first:getUTCDay()) + 7), 7)
		do return (first:getTime() + ((toThu + 7) * 86400000)) end
	end
	exports.worldCupStart = worldCupStart
	worldCupCycle = function(w, year)
		local ed = ("WC-" .. Js.numstr(year))
		local hosts = M_hosts.worldCupHosts(year)
		local direct = Js.aspread(hosts)
		local ic = Js.alit()
		local add = function(r)
			A.push(direct, Js.unpack(r.direct))
			A.push(ic, Js.unpack(r.ic))
		end
		M_uefa.uefaWorldCupQualifying(w, year, function(d)
			return A.push(direct, Js.unpack(d))
		end)
		M_conmebol.conmebolWorldCupQualifying(w, year, WC_SLOTS.CONMEBOL.direct, add)
		M_concacaf.concacafWorldCupQualifying(w, year, WC_SLOTS.CONCACAF, add)
		M_caf.cafWorldCupQualifying(w, year, WC_SLOTS.CAF, add)
		M_afc.afcWorldCupQualifying(w, year, WC_SLOTS.AFC, add)
		M_ofc.ofcWorldCupQualifying(w, year, WC_SLOTS.OFC, add)
		local md0 = M_build.matchday(year, "mar", 0)
		local md1 = M_build.matchday(year, "mar", 1)
		local icWinners = Js.alit()
		w:at(M_world.noon(Js.Date.UTC(year, 1, 1)), function()
			local six = A.sort(Js.aspread(ic), function(a, b)
				return (w.rankOf(a) - w.rankOf(b))
			end)
			w.facts:set((ed .. ":icTeams"), six)
			if (Js.alen(six) < 6) then
				A.push(icWinners, Js.unpack(A.slice(six, 0, 2)))
				do return end
			end
			local spec = Js.O({ edition = ("WCPO-" .. Js.numstr(year)), comp = "World Cup Play-Off", importance = 25, level = "et-pens", neutral = true }, { "edition", "comp", "importance", "level", "neutral" })
			local sf1 = M_build.single(w, Js.ospread(spec, Js.O({ stage = "Semi-Final" }, { "stage" })), six[3], six[6], md0, "SF1")
			local sf2 = M_build.single(w, Js.ospread(spec, Js.O({ stage = "Semi-Final" }, { "stage" })), six[4], six[5], md0, "SF2")
			w:at(M_world.dayAfter(md0), function()
				local f1 = M_build.single(w, Js.ospread(spec, Js.O({ stage = "Final" }, { "stage" })), six[1], M_engine.winnerOf(sf2), md1, "F1")
				local f2 = M_build.single(w, Js.ospread(spec, Js.O({ stage = "Final" }, { "stage" })), six[2], M_engine.winnerOf(sf1), md1, "F2")
				w:at(M_world.dayAfter(md1), function()
					return A.push(icWinners, M_engine.winnerOf(f1), M_engine.winnerOf(f2))
				end)
			end)
		end)
		local start = worldCupStart(year)
		w:at(M_world.noon(Js.Date.UTC(year, 3, 3)), function()
			local everyone = A.map(A.filter(M_nations.NATIONS, function(n)
				return (not n.suspended)
			end), function(n)
				return n.name
			end)
			local field = M_uefa.fillTo(w, Js.aspread(direct, icWinners), 48, everyone)
			w.facts:set((ed .. ":qualified"), field)
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
			A.forEach(qHosts, function(h, i)
				return (function() local _a = Js.alit(h); fixed[Js.key(i)] = _a; return _a end)()
			end)
			local confOf = function(n)
				return ((function() local _v = M_nations.nationFor(n); if _v == nil then return nil end; _v = _v.confederation; return _v end)() or "?")
			end
			local allowed = function(t, g)
				local c = confOf(t)
				do return (Js.alen(A.filter(g, function(x)
					return (confOf(x) == c)
				end)) < (if (c == "UEFA") then 2 else 1)) end
			end
			local gs = M_engine.drawGroups(M_engine.pots(seeded, 12), 12, M_engine.rngFor(("draw|" .. ed)), allowed, fixed)
			M_build.tournament(w, Js.O({ edition = ed, comp = "World Cup", groups = Js.Object.fromEntries(A.map(gs, function(g, i)
				return Js.alit(S.idx(letters, i), g)
			end)), groupDates = Js.alit(start, M_build.plusDays(start, 5), M_build.plusDays(start, 10)), names = Js.alit("Round of 32", "Round of 16", "Quarter-Final", "Semi-Final", "Final"), koDates = Js.alit(M_build.plusDays(start, 15), M_build.plusDays(start, 20), M_build.plusDays(start, 25), M_build.plusDays(start, 30), M_build.plusDays(start, 35)), groupImportance = 50, koImportance = function(r)
				return (if (r >= 2) then 60 else 50)
			end, tie = "overall", thirds = 8, hosts = qHosts, thirdPlace = true }, { "edition", "comp", "groups", "groupDates", "names", "koDates", "groupImportance", "koImportance", "tie", "thirds", "hosts", "thirdPlace" }))
		end)
		local _ = M_build.utcNoon
	end
	exports.worldCupCycle = worldCupCycle
	letters = "ABCDEFGHIJKL"
	WC_SLOTS = Js.O({ UEFA = Js.O({ direct = M_uefa.UEFA_WC_SLOTS, ic = 0 }, { "direct", "ic" }), CAF = Js.O({ direct = 9, ic = 1 }, { "direct", "ic" }), AFC = Js.O({ direct = 8, ic = 1 }, { "direct", "ic" }), CONMEBOL = Js.O({ direct = 6, ic = 1 }, { "direct", "ic" }), CONCACAF = Js.O({ direct = 6, ic = 2 }, { "direct", "ic" }), OFC = Js.O({ direct = 1, ic = 1 }, { "direct", "ic" }) }, { "UEFA", "CAF", "AFC", "CONMEBOL", "CONCACAF", "OFC" })
	exports.WC_SLOTS = WC_SLOTS
end
