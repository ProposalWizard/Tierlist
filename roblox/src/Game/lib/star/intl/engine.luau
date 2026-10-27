--!nocheck
--!nolint
-- Generated from lib/star/intl/engine.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_season = import("lib/star/season")
	local M_squadData = import("lib/star/squadData")
	local rngFor, poisson, expectedGoals, ninety, extraTime, shootout, played, singleRoundRobin, doubleRoundRobin, emptyRow, addResult, table_, rankAcrossGroups, winnerOf, loserOf, playKnockout, twoLegWinner, playTwoLegs, shuffled, pots, drawGroups
	rngFor = function(id)
		do return M_season.mulberry32(M_squadData.clubNameSeed(id)) end
	end
	exports.rngFor = rngFor
	poisson = function(lambda, rng)
		local L = Math.exp((-lambda))
		local k = 0
		local p = 1
		local _first1 = true
		while _first1 or ((p > L) and (k < 20)) do
			_first1 = false
			k += 1
			p *= rng()
		end
		do return (k - 1) end
	end
	expectedGoals = function(us, them, venue)
		local adv = (if (venue == "home") then 0.2 else (if (venue == "away") then -0.15 else 0))
		do return Math.max(0.15, Math.min(4.6, ((1.25 + ((us - them) * 0.05)) + adv))) end
	end
	exports.expectedGoals = expectedGoals
	ninety = function(homeStr, awayStr, neutral, rng)
		do return Js.O({ hs = poisson(expectedGoals(homeStr, awayStr, (if neutral then "neutral" else "home")), rng), as = poisson(expectedGoals(awayStr, homeStr, (if neutral then "neutral" else "away")), rng) }, { "hs", "as" }) end
	end
	exports.ninety = ninety
	extraTime = function(homeStr, awayStr, neutral, rng)
		do return Js.O({ hs = poisson((expectedGoals(homeStr, awayStr, (if neutral then "neutral" else "home")) / 3), rng), as = poisson((expectedGoals(awayStr, homeStr, (if neutral then "neutral" else "away")) / 3), rng) }, { "hs", "as" }) end
	end
	exports.extraTime = extraTime
	shootout = function(homeStr, awayStr, rng)
		local ph = Math.max(0.6, Math.min(0.85, (0.75 + ((homeStr - awayStr) * 0.002))))
		local pa = Math.max(0.6, Math.min(0.85, (0.75 + ((awayStr - homeStr) * 0.002))))
		local h = 0
		local a = 0
		for i = 0, 4 do
			if (rng() < ph) then
				h += 1
			end
			if (rng() < pa) then
				a += 1
			end
			if ((h > (a + ((5 - i) - 1))) or (a > (h + ((5 - i) - 1)))) then
				do break end
			end
		end
		do
			local sd = 0
			local _first2 = true
			while true do
				if not _first2 then
					sd += 1
				end
				_first2 = false
				if not ((h == a) and (sd < 30)) then break end
				if (rng() < ph) then
					h += 1
				end
				if (rng() < pa) then
					a += 1
				end
			end
		end
		if (h == a) then
			h += 1
		end
		do return Js.O({ hs = h, as = a }, { "hs", "as" }) end
	end
	exports.shootout = shootout
	played = function(m)
		do return ((m.hs ~= nil) and (m.as ~= nil)) end
	end
	exports.played = played
	singleRoundRobin = function(teams)
		local t = (if Js.T(math.fmod(Js.alen(teams), 2)) then Js.aspread(teams, Js.alit("")) else Js.aspread(teams))
		local n = Js.alen(t)
		local days = Js.alit()
		for r = 0, (n - 1) - 1 do
			local day = Js.alit()
			for i = 0, math.ceil((n / 2)) - 1 do
				local a = t[i + 1]
				local b = t[((n - 1) - i) + 1]
				if ((not Js.T(a)) or (not Js.T(b))) then
					do continue end
				end
				A.push(day, (if (math.fmod((r + i), 2) == 0) then Js.alit(a, b) else Js.alit(b, a)))
			end
			A.push(days, day)
			A.splice(t, 1, 0, A.pop(t))
		end
		do return days end
	end
	exports.singleRoundRobin = singleRoundRobin
	doubleRoundRobin = function(teams)
		local first = singleRoundRobin(teams)
		do return Js.aspread(first, A.map(first, function(d)
			return A.map(d, function(_p3)
				local h = _p3[1]
				local a = _p3[2]
				return Js.alit(a, h)
			end)
		end)) end
	end
	exports.doubleRoundRobin = doubleRoundRobin
	emptyRow = function(name)
		do return Js.O({ name = name, p = 0, w = 0, d = 0, l = 0, gf = 0, ga = 0, pts = 0 }, { "name", "p", "w", "d", "l", "gf", "ga", "pts" }) end
	end
	addResult = function(rows, m)
		if (not played(m)) then
			do return end
		end
		local h = rows:get(m.home)
		local a = rows:get(m.away)
		if ((not h) or (not a)) then
			do return end
		end
		h.p += 1
		a.p += 1
		h.gf += m.hs
		h.ga += m.as
		a.gf += m.as
		a.ga += m.hs
		if (m.hs > m.as) then
			h.w += 1
			a.l += 1
			h.pts += 3
		elseif (m.hs < m.as) then
			a.w += 1
			h.l += 1
			a.pts += 3
		else
			h.d += 1
			a.d += 1
			h.pts += 1
			a.pts += 1
		end
	end
	table_ = function(teams, matches, tie, rank)
		local rows = Js.Map.new(A.map(teams, function(t)
			return Js.alit(t, emptyRow(t))
		end))
		do
			local _arr4 = matches
			local _i5 = 0
			while _i5 < Js.alen(_arr4) do
				_i5 += 1
				local m = _arr4[_i5]
				addResult(rows, m)
			end
		end
		local all = Js.Array.from(rows:values())
		local overall = function(x, y)
			return (function() local _l = ((y.gf - y.ga) - (x.gf - x.ga)); if Js.T(_l) then return _l end; return (y.gf - x.gf) end)()
		end
		local h2hOrder = function(group)
			local names = Js.Set.new(A.map(group, function(r)
				return r.name
			end))
			local mini = Js.Map.new(A.map(group, function(r)
				return Js.alit(r.name, emptyRow(r.name))
			end))
			do
				local _arr6 = matches
				local _i7 = 0
				while _i7 < Js.alen(_arr6) do
					_i7 += 1
					local m = _arr6[_i7]
					if (names:has(m.home) and names:has(m.away)) then
						addResult(mini, m)
					end
				end
			end
			do return A.sort(Js.aspread(group), function(x, y)
				local a = mini:get(x.name)
				local b = mini:get(y.name)
				do return (function() local _l = (function() local _l = (function() local _l = (function() local _l = (function() local _l = (b.pts - a.pts); if Js.T(_l) then return _l end; return ((b.gf - b.ga) - (a.gf - a.ga)) end)(); if Js.T(_l) then return _l end; return (b.gf - a.gf) end)(); if Js.T(_l) then return _l end; return overall(x, y) end)(); if Js.T(_l) then return _l end; return (rank(x.name) - rank(y.name)) end)(); if Js.T(_l) then return _l end; return S.localeCompare(x.name, y.name) end)() end
			end) end
		end
		local byPts = A.sort(Js.aspread(all), function(x, y)
			return (y.pts - x.pts)
		end)
		local out = Js.alit()
		do
			local i = 0
			local _first8 = true
			while true do
				_first8 = false
				if not (i < Js.alen(byPts)) then break end
				local j = i
				while ((j < Js.alen(byPts)) and (byPts[j + 1].pts == byPts[i + 1].pts)) do
					j += 1
				end
				local group = A.slice(byPts, i, j)
				if (Js.alen(group) == 1) then
					A.push(out, group[1])
				elseif (tie == "h2h") then
					A.push(out, Js.unpack(h2hOrder(group)))
				else
					local sorted = A.sort(Js.aspread(group), overall)
					do
						local a = 0
						local _first9 = true
						while true do
							_first9 = false
							if not (a < Js.alen(sorted)) then break end
							local b = a
							while ((b < Js.alen(sorted)) and (overall(sorted[a + 1], sorted[b + 1]) == 0)) do
								b += 1
							end
							A.push(out, Js.unpack((if ((b - a) > 1) then h2hOrder(A.slice(sorted, a, b)) else A.slice(sorted, a, b))))
							a = b
						end
					end
				end
				i = j
			end
		end
		do return out end
	end
	exports.table = table_
	rankAcrossGroups = function(rows, rank)
		do return A.sort(Js.aspread(rows), function(x, y)
			return (function() local _l = (function() local _l = (function() local _l = (y.pts - x.pts); if Js.T(_l) then return _l end; return ((y.gf - y.ga) - (x.gf - x.ga)) end)(); if Js.T(_l) then return _l end; return (y.gf - x.gf) end)(); if Js.T(_l) then return _l end; return (rank(x.name) - rank(y.name)) end)()
		end) end
	end
	exports.rankAcrossGroups = rankAcrossGroups
	winnerOf = function(m)
		if (not played(m)) then
			do return nil end
		end
		if (m.hs > m.as) then
			do return m.home end
		end
		if (m.as > m.hs) then
			do return m.away end
		end
		if m.pens then
			do return (if (m.pens.hs > m.pens.as) then m.home else m.away) end
		end
		do return nil end
	end
	exports.winnerOf = winnerOf
	loserOf = function(m)
		local w = winnerOf(m)
		do return (if Js.T(w) then (if (w == m.home) then m.away else m.home) else nil) end
	end
	exports.loserOf = loserOf
	playKnockout = function(m, str, rule, rng)
		if (played(m) and Js.T(winnerOf(m))) then
			do return m end
		end
		local hS = str(m.home)
		local aS = str(m.away)
		local base = (if played(m) then Js.O({ hs = m.hs, as = m.as }, { "hs", "as" }) else ninety(hS, aS, (not (not m.neutral)), rng))
		local out = Js.ospread(m, base)
		if (out.hs == out.as) then
			if (rule == "et-pens") then
				local e = extraTime(hS, aS, (not (not m.neutral)), rng)
				out.et = true
				out.hs += e.hs
				out.as += e.as
			end
			if (out.hs == out.as) then
				out.pens = shootout(hS, aS, rng)
			end
		end
		do return out end
	end
	exports.playKnockout = playKnockout
	twoLegWinner = function(t)
		if ((not played(t.first)) or (not played(t.second))) then
			do return nil end
		end
		local a = t.first.home
		local b = t.first.away
		local ga = (t.first.hs + t.second.as)
		local gb = (t.first.as + t.second.hs)
		if (ga > gb) then
			do return a end
		end
		if (gb > ga) then
			do return b end
		end
		if t.second.pens then
			do return (if (t.second.pens.hs > t.second.pens.as) then t.second.home else t.second.away) end
		end
		do return nil end
	end
	exports.twoLegWinner = twoLegWinner
	playTwoLegs = function(t, str, rng)
		local first = (if played(t.first) then t.first else Js.ospread(t.first, ninety(str(t.first.home), str(t.first.away), false, rng)))
		local second = (if played(t.second) then t.second else Js.ospread(t.second, ninety(str(t.second.home), str(t.second.away), false, rng)))
		local a = first.home
		local agg = function()
			return Js.alit((first.hs + second.as), (first.as + second.hs))
		end
		local _d10 = agg()
		local ga = _d10[1]
		local gb = _d10[2]
		if ((ga == gb) and (not second.pens)) then
			if (not second.et) then
				local e = extraTime(str(second.home), str(second.away), false, rng)
				second = Js.ospread(second, Js.O({ et = true, hs = (second.hs + e.hs), as = (second.as + e.as) }, { "et", "hs", "as" }))
				local _d11 = agg()
				ga = _d11[1]
				gb = _d11[2]
			end
			if (ga == gb) then
				second = Js.ospread(second, Js.O({ pens = shootout(str(second.home), str(second.away), rng) }, { "pens" }))
			end
		end
		local _ = a
		do return Js.O({ first = first, second = second }, { "first", "second" }) end
	end
	exports.playTwoLegs = playTwoLegs
	shuffled = function(xs, rng)
		local a = Js.aspread(xs)
		for i = (Js.alen(a) - 1), 1, -1 do
			local j = math.floor((rng() * (i + 1)))
			local _d12 = Js.alit(a[j + 1], a[i + 1])
			A.set(a, i, _d12[1])
			A.set(a, j, _d12[2])
		end
		do return a end
	end
	exports.shuffled = shuffled
	pots = function(seeded, size)
		local out = Js.alit()
		do
			local i = 0
			local _first13 = true
			while true do
				if not _first13 then
					i += size
				end
				_first13 = false
				if not (i < Js.alen(seeded)) then break end
				A.push(out, A.slice(seeded, i, (i + size)))
			end
		end
		do return out end
	end
	exports.pots = pots
	drawGroups = function(potList, groupCount, rng, allowed, fixed, sizes)
		if allowed == nil then allowed = function()
		return true
	end end
		if fixed == nil then fixed = Js.O({}, nil) end
		local place
		local groups = Js.Array.from(Js.O({ length = groupCount }, { "length" }), function(_, i)
			return Js.aspread((if fixed[Js.key(i)] ~= nil then fixed[Js.key(i)] else Js.alit()))
		end)
		local cap = function(g)
			return ((function() local _v = sizes; if _v == nil then return nil end; _v = _v[g + 1]; return _v end)() or Js.alen(potList))
		end
		local pre = Js.Set.new(A.flat(Js.Object.values(fixed)))
		local order = A.flatMap(potList, function(p)
			return shuffled(A.filter(p, function(t)
				return (not pre:has(t))
			end), rng)
		end)
		place = function(k)
			if (k >= Js.alen(order)) then
				do return true end
			end
			local team = order[k + 1]
			local potIndex = A.findIndex(potList, function(p)
				return A.includes(p, team)
			end)
			for g = 0, math.ceil(groupCount) - 1 do
				local grp = groups[g + 1]
				if (Js.alen(grp) >= cap(g)) then
					do continue end
				end
				local fromSamePot = Js.alen(A.filter(grp, function(t)
					return (function() local _r = potList[potIndex + 1]; if _r == nil then return nil end; return A.includes(_r, t) end)()
				end))
				if (fromSamePot >= 1) then
					do continue end
				end
				if (not allowed(team, grp)) then
					do continue end
				end
				A.push(grp, team)
				if place((k + 1)) then
					do return true end
				end
				A.pop(grp)
			end
			do return false end
		end
		if (not place(0)) then
			local gs = Js.Array.from(Js.O({ length = groupCount }, { "length" }), function(_, i)
				return Js.aspread((if fixed[Js.key(i)] ~= nil then fixed[Js.key(i)] else Js.alit()))
			end)
			A.forEach(order, function(t, i)
				return A.push(gs[math.fmod(i, groupCount) + 1], t)
			end)
			do return gs end
		end
		do return groups end
	end
	exports.drawGroups = drawGroups
end
