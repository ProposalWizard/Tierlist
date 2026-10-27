--!nocheck
--!nolint
-- Generated from lib/star/promotion.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_clubs = import("lib/star/clubs")
	local M_clubRating = import("lib/star/world/clubRating")
	local M_season = import("lib/star/season")
	local M_nonLeagueRegions = import("lib/star/nonLeagueRegions")
	local M_calendar = import("lib/star/calendar")
	local M_index = import("lib/star/world/index")
	local RETIRED_REGIONAL, JOINERS, catchUpRegional, membershipOf, TIER_RATING, TIER_ORDER, squadMaps, squadsByClub, tierOfClub, ratingFor, strengthTable, estimateClubStrength, weightedDraw, twoLeggedWinner, resolvePlayOffs, singleMatchTie, resolveRegionalPlayOffs, PREMIER_SIZE, CHAMPIONSHIP_SIZE, LEAGUE_ONE_SIZE, LEAGUE_TWO_SIZE, NATIONAL_LEAGUE_SIZE, NORTH_SIZE, SOUTH_SIZE, STEP3_SIZE, CHAMP_LEAGUE_ONE_COUNT, LEAGUE_ONE_TWO_COUNT, LEAGUE_TWO_NATIONAL_COUNT, REGIONAL_UP_COUNT, NATIONAL_DOWN_COUNT, REGIONAL_DOWN_COUNT, reconcileLadder, TIER_KEYS, TIER_TO_DIVISION, BOUNDARIES, seasonLadder, resolveLadder
	catchUpRegional = function(m, you)
		local everywhere = Js.Set.new(A.flat(Js.Object.values(m)))
		local swap = function(list, joiners)
			local spare = A.filter(joiners, function(j)
				return (not everywhere:has(j))
			end)
			do return A.map(list, function(c)
				if (((not RETIRED_REGIONAL:has(c)) or (c == you)) or (Js.alen(spare) == 0)) then
					do return c end
				end
				local j = A.shift(spare)
				everywhere:add(j)
				do return j end
			end) end
		end
		local next_ = Js.ospread(m, Js.O({ nationalLeagueNorth = swap(m.nationalLeagueNorth, JOINERS.north), nationalLeagueSouth = swap(m.nationalLeagueSouth, JOINERS.south) }, { "nationalLeagueNorth", "nationalLeagueSouth" }))
		local placed = Js.Set.new(Js.aspread(next_.premier, next_.championship, next_.leagueOne, next_.leagueTwo, next_.nationalLeague, next_.nationalLeagueNorth, next_.nationalLeagueSouth))
		do return Js.ospread(next_, Js.O({ step3North = A.filter(M_clubs.STEP3_NORTH_CLUBS, function(c)
			return (not placed:has(c))
		end), step3South = A.filter(M_clubs.STEP3_SOUTH_CLUBS, function(c)
			return (not placed:has(c))
		end) }, { "step3North", "step3South" })) end
	end
	membershipOf = function(career)
		local d = career.divisions
		local m = Js.O({ premier = ((function() local _v = d; if _v == nil then return nil end; _v = _v.premier; return _v end)() or Js.aspread(M_clubs.PREMIER_LEAGUE_CLUBS)), championship = ((function() local _v = d; if _v == nil then return nil end; _v = _v.championship; return _v end)() or Js.aspread(M_clubs.CHAMPIONSHIP_CLUBS)), leagueOne = ((function() local _v = d; if _v == nil then return nil end; _v = _v.leagueOne; return _v end)() or Js.aspread(M_clubs.LEAGUE_ONE_CLUBS)), leagueTwo = ((function() local _v = d; if _v == nil then return nil end; _v = _v.leagueTwo; return _v end)() or Js.aspread(M_clubs.LEAGUE_TWO_CLUBS)), nationalLeague = ((function() local _v = d; if _v == nil then return nil end; _v = _v.nationalLeague; return _v end)() or Js.aspread(M_clubs.NATIONAL_LEAGUE_CLUBS)), nationalLeagueNorth = ((function() local _v = d; if _v == nil then return nil end; _v = _v.nationalLeagueNorth; return _v end)() or Js.aspread(M_clubs.NATIONAL_LEAGUE_NORTH_CLUBS)), nationalLeagueSouth = ((function() local _v = d; if _v == nil then return nil end; _v = _v.nationalLeagueSouth; return _v end)() or Js.aspread(M_clubs.NATIONAL_LEAGUE_SOUTH_CLUBS)), step3North = ((function() local _v = d; if _v == nil then return nil end; _v = _v.step3North; return _v end)() or Js.alit()), step3South = ((function() local _v = d; if _v == nil then return nil end; _v = _v.step3South; return _v end)() or Js.alit()) }, { "premier", "championship", "leagueOne", "leagueTwo", "nationalLeague", "nationalLeagueNorth", "nationalLeagueSouth", "step3North", "step3South" })
		do return (if ((function() local _v = d; if _v == nil then return nil end; _v = _v.step3North; return _v end)() == nil) then catchUpRegional(m, career.player.club) else m) end
	end
	exports.membershipOf = membershipOf
	squadsByClub = function(career)
		local key = career
		local hit = squadMaps:get(key)
		if hit then
			do return hit end
		end
		local m = Js.Map.new()
		do
			local _arr1 = (if career.externalSquads ~= nil then career.externalSquads else Js.alit())
			local _i2 = 0
			while _i2 < Js.alen(_arr1) do
				_i2 += 1
				local s = _arr1[_i2]
				m:set(s.club, s)
			end
		end
		do
			local _arr3 = (if career.leagueSquads ~= nil then career.leagueSquads else Js.alit())
			local _i4 = 0
			while _i4 < Js.alen(_arr3) do
				_i4 += 1
				local s = _arr3[_i4]
				m:set(s.club, s)
			end
		end
		squadMaps:set(key, m)
		do return m end
	end
	tierOfClub = function(members, club)
		do
			local _arr5 = TIER_ORDER
			local _i6 = 0
			while _i6 < Js.alen(_arr5) do
				_i6 += 1
				local t = _arr5[_i6]
				if A.includes(members[t], club) then
					do return t end
				end
			end
		end
		do return nil end
	end
	ratingFor = function(career, club, members)
		if members == nil then members = membershipOf(career) end
		local live = (function() local _v = A.find(career.league, function(t)
			return (t.name == club)
		end); if _v == nil then return nil end; _v = _v.strength; return _v end)()
		if (live ~= nil) then
			do return live end
		end
		local tier = tierOfClub(members, club)
		local squad = squadsByClub(career):get(club)
		if (not Js.T(tier)) then
			do return (M_clubRating.squadRating(squad) or 72) end
		end
		do return M_clubRating.rateClub(club, squad, TIER_RATING[tier], members[tier]) end
	end
	exports.ratingFor = ratingFor
	strengthTable = function(career, members)
		local out = Js.Map.new()
		do
			local _arr7 = TIER_ORDER
			local _i8 = 0
			while _i8 < Js.alen(_arr7) do
				_i8 += 1
				local tier = _arr7[_i8]
				do
					local _arr9 = members[tier]
					local _i10 = 0
					while _i10 < Js.alen(_arr9) do
						_i10 += 1
						local club = _arr9[_i10]
						out:set(club, ratingFor(career, club, members))
					end
				end
			end
		end
		do return out end
	end
	estimateClubStrength = function(career, club)
		do return ratingFor(career, club) end
	end
	exports.estimateClubStrength = estimateClubStrength
	weightedDraw = function(clubs, strength, count, rng, invert)
		if invert == nil then invert = false end
		local remaining = Js.aspread(clubs)
		local picked = Js.alit()
		local weightOf = function(c)
			local s = (strength:get(c) or 70)
			do return Math.max(1, (if invert then (100 - s) else s)) end
		end
		while ((Js.alen(picked) < count) and (Js.alen(remaining) > 0)) do
			local total = A.reduce(remaining, function(sum, c)
				return (sum + weightOf(c))
			end, 0)
			local roll = (rng() * total)
			local at = (Js.alen(remaining) - 1)
			do
				local i = 0
				local _first11 = true
				while true do
					if not _first11 then
						i += 1
					end
					_first11 = false
					if not (i < Js.alen(remaining)) then break end
					roll -= weightOf(remaining[i + 1])
					if (roll <= 0) then
						at = i
						do break end
					end
				end
			end
			A.push(picked, remaining[at + 1])
			A.splice(remaining, at, 1)
		end
		do return picked end
	end
	twoLeggedWinner = function(a, b, strength, rng)
		local first = M_season.simulateFixtureScore((strength:get(b) or 70), (strength:get(a) or 70), rng)
		local second = M_season.simulateFixtureScore((strength:get(a) or 70), (strength:get(b) or 70), rng)
		local aggA = (first.away + second.home)
		local aggB = (first.home + second.away)
		local winner = nil
		if (aggA ~= aggB) then
			winner = (if (aggA > aggB) then a else b)
		else
			winner = (if (rng() < 0.58) then a else b)
		end
		do return Js.O({ home = b, away = a, legs = Js.alit(Js.O({ hs = first.home, as = first.away }, { "hs", "as" }), Js.O({ hs = second.away, as = second.home }, { "hs", "as" })), winner = winner }, { "home", "away", "legs", "winner" }) end
	end
	resolvePlayOffs = function(table_, strength, rng, auto)
		if auto == nil then auto = 2 end
		local sorted = M_season.sortLeague(table_)
		if (Js.alen(sorted) < (auto + 4)) then
			do return nil end
		end
		local _d12 = Js.alit(sorted[auto + 1].name, sorted[(auto + 1) + 1].name, sorted[(auto + 2) + 1].name, sorted[(auto + 3) + 1].name)
		local third = _d12[1]
		local fourth = _d12[2]
		local fifth = _d12[3]
		local sixth = _d12[4]
		local semiFinals = Js.alit(twoLeggedWinner(third, sixth, strength, rng), twoLeggedWinner(fourth, fifth, strength, rng))
		local _d13 = A.map(semiFinals, function(t)
			return t.winner
		end)
		local w1 = _d13[1]
		local w2 = _d13[2]
		local score = M_season.simulateFixtureScore((strength:get(w1) or 70), (strength:get(w2) or 70), rng)
		local winner = nil
		if (score.home ~= score.away) then
			winner = (if (score.home > score.away) then w1 else w2)
		else
			winner = (if (rng() < 0.5) then w1 else w2)
		end
		do return Js.O({ semiFinals = semiFinals, final = Js.O({ home = w1, away = w2, hs = score.home, as = score.away, winner = winner }, { "home", "away", "hs", "as", "winner" }), promoted = winner }, { "semiFinals", "final", "promoted" }) end
	end
	exports.resolvePlayOffs = resolvePlayOffs
	singleMatchTie = function(high, low, strength, rng)
		local sh = (strength:get(high) or 50)
		local sl = (strength:get(low) or 50)
		local score = M_season.simulateFixtureScore(sh, sl, rng)
		local hs = score.home
		local as = score.away
		local winner = nil
		if (hs ~= as) then
			winner = (if (hs > as) then high else low)
		elseif (rng() < 0.35) then
			winner = (if (rng() < (sh / (sh + sl))) then high else low)
			if (winner == high) then
				hs += 1
			else
				as += 1
			end
		else
			winner = (if (rng() < 0.5) then high else low)
		end
		do return Js.O({ home = high, away = low, legs = Js.alit(Js.O({ hs = hs, as = as }, { "hs", "as" })), winner = winner }, { "home", "away", "legs", "winner" }) end
	end
	exports.singleMatchTie = singleMatchTie
	resolveRegionalPlayOffs = function(table_, strength, rng)
		local sorted = A.map(M_season.sortLeague(table_), function(t)
			return t.name
		end)
		if (Js.alen(sorted) < 7) then
			do return nil end
		end
		local _d14 = sorted
		local second = _d14[2]
		local third = _d14[3]
		local fourth = _d14[4]
		local fifth = _d14[5]
		local sixth = _d14[6]
		local seventh = _d14[7]
		local q1 = singleMatchTie(fourth, seventh, strength, rng)
		local q2 = singleMatchTie(fifth, sixth, strength, rng)
		local s1 = singleMatchTie(second, q2.winner, strength, rng)
		local s2 = singleMatchTie(third, q1.winner, strength, rng)
		local higher = (if (A.indexOf(sorted, s1.winner) < A.indexOf(sorted, s2.winner)) then s1.winner else s2.winner)
		local lower = (if (higher == s1.winner) then s2.winner else s1.winner)
		local f = singleMatchTie(higher, lower, strength, rng)
		do return Js.O({ qualifiers = Js.alit(q1, q2), semiFinals = Js.alit(s1, s2), final = Js.O({ home = f.home, away = f.away, hs = f.legs[1].hs, as = f.legs[1].as, winner = f.winner }, { "home", "away", "hs", "as", "winner" }), promoted = f.winner }, { "qualifiers", "semiFinals", "final", "promoted" }) end
	end
	exports.resolveRegionalPlayOffs = resolveRegionalPlayOffs
	reconcileLadder = function(premier, championship, leagueOne, leagueTwo, nationalLeague, north, south, limbo, strength, rng, step3North, step3South)
		if step3North == nil then step3North = Js.alit() end
		if step3South == nil then step3South = Js.alit() end
		local seen = Js.Set.new()
		local dedupe = function(list)
			return A.filter(list, function(c)
				return (if seen:has(c) then false else (function() local _ = seen:add(c); return true end)())
			end)
		end
		local p = dedupe(premier)
		local c = dedupe(championship)
		local l1 = dedupe(Js.aspread(leagueOne, limbo))
		local l2 = dedupe(leagueTwo)
		local nl = dedupe(nationalLeague)
		local nn = dedupe(north)
		local ns = dedupe(south)
		local s3n = dedupe(step3North)
		local s3s = dedupe(step3South)
		local byStrengthAsc = function(list)
			return A.sort(Js.aspread(list), function(a, b)
				return ((strength:get(a) or 70) - (strength:get(b) or 70))
			end)
		end
		local shrink = function(list, target, demoteTo)
			if (Js.alen(list) <= target) then
				do return Js.alit(list, demoteTo) end
			end
			local weakestFirst = byStrengthAsc(list)
			local demoted = A.slice(weakestFirst, 0, (Js.alen(list) - target))
			local kept = A.filter(list, function(x)
				return (not A.includes(demoted, x))
			end)
			do return Js.alit(kept, Js.aspread(demoteTo, demoted)) end
		end
		local grow = function(list, target, sourcePool)
			if ((Js.alen(list) >= target) or (Js.alen(sourcePool) == 0)) then
				do return Js.alit(list, sourcePool) end
			end
			local promoted = weightedDraw(sourcePool, strength, Math.min((target - Js.alen(list)), Js.alen(sourcePool)), rng)
			local remaining = A.filter(sourcePool, function(x)
				return (not A.includes(promoted, x))
			end)
			do return Js.alit(Js.aspread(list, promoted), remaining) end
		end
		local _d15 = shrink(p, PREMIER_SIZE, c)
		p = _d15[1]
		c = _d15[2]
		local _d16 = shrink(c, CHAMPIONSHIP_SIZE, l1)
		c = _d16[1]
		l1 = _d16[2]
		local _d17 = shrink(l1, LEAGUE_ONE_SIZE, l2)
		l1 = _d17[1]
		l2 = _d17[2]
		local _d18 = shrink(l2, LEAGUE_TWO_SIZE, nl)
		l2 = _d18[1]
		nl = _d18[2]
		local regional = Js.aspread(nn, ns)
		local _d19 = shrink(nl, NATIONAL_LEAGUE_SIZE, regional)
		nl = _d19[1]
		regional = _d19[2]
		local spilled = A.filter(regional, function(x)
			return ((not A.includes(nn, x)) and (not A.includes(ns, x)))
		end)
		local spill = M_nonLeagueRegions.splitByRegion(spilled, Math.max(0, (NORTH_SIZE - Js.alen(nn))))
		nn = Js.aspread(nn, spill.north)
		ns = Js.aspread(ns, spill.south)
		local _d20 = grow(nl, NATIONAL_LEAGUE_SIZE, Js.aspread(nn, ns))
		nl = _d20[1]
		regional = _d20[2]
		nn = A.filter(nn, function(x)
			return A.includes(regional, x)
		end)
		ns = A.filter(ns, function(x)
			return A.includes(regional, x)
		end)
		local _d21 = grow(l2, LEAGUE_TWO_SIZE, nl)
		l2 = _d21[1]
		nl = _d21[2]
		local _d22 = grow(l1, LEAGUE_ONE_SIZE, l2)
		l1 = _d22[1]
		l2 = _d22[2]
		local _d23 = grow(c, CHAMPIONSHIP_SIZE, l1)
		c = _d23[1]
		l1 = _d23[2]
		local _d24 = grow(p, PREMIER_SIZE, c)
		p = _d24[1]
		c = _d24[2]
		while ((Js.alen(nn) > NORTH_SIZE) and (Js.alen(ns) < SOUTH_SIZE)) do
			local mover = A.sort(Js.aspread(nn), function(a, b)
				return (M_nonLeagueRegions.latitudeOf(a) - M_nonLeagueRegions.latitudeOf(b))
			end)[1]
			nn = A.filter(nn, function(x)
				return (x ~= mover)
			end)
			ns = Js.aspread(ns, Js.alit(mover))
		end
		while ((Js.alen(ns) > SOUTH_SIZE) and (Js.alen(nn) < NORTH_SIZE)) do
			local mover = A.sort(Js.aspread(ns), function(a, b)
				return (M_nonLeagueRegions.latitudeOf(b) - M_nonLeagueRegions.latitudeOf(a))
			end)[1]
			ns = A.filter(ns, function(x)
				return (x ~= mover)
			end)
			nn = Js.aspread(nn, Js.alit(mover))
		end
		local _d25 = shrink(nn, NORTH_SIZE, s3n)
		nn = _d25[1]
		s3n = _d25[2]
		local _d26 = shrink(ns, SOUTH_SIZE, s3s)
		ns = _d26[1]
		s3s = _d26[2]
		local _d27 = grow(nn, NORTH_SIZE, s3n)
		nn = _d27[1]
		s3n = _d27[2]
		local _d28 = grow(ns, SOUTH_SIZE, s3s)
		ns = _d28[1]
		s3s = _d28[2]
		local _d29 = shrink(s3n, STEP3_SIZE, Js.alit())
		local step3NorthFinal = _d29[1]
		local northOut = _d29[2]
		local _d30 = shrink(s3s, STEP3_SIZE, Js.alit())
		local step3SouthFinal = _d30[1]
		local southOut = _d30[2]
		do return Js.O({ premier = p, championship = c, leagueOne = l1, leagueTwo = l2, nationalLeague = nl, nationalLeagueNorth = nn, nationalLeagueSouth = ns, step3North = step3NorthFinal, step3South = step3SouthFinal, limbo = Js.aspread(northOut, southOut) }, { "premier", "championship", "leagueOne", "leagueTwo", "nationalLeague", "nationalLeagueNorth", "nationalLeagueSouth", "step3North", "step3South", "limbo" }) end
	end
	seasonLadder = function(career)
		do return resolveLadder(career, M_season.mulberry32(((career.season * 90247) + (Js.alen(career.league) * 13)))) end
	end
	exports.seasonLadder = seasonLadder
	resolveLadder = function(career, rng)
		local members = membershipOf(career)
		local strength = strengthTable(career, members)
		local you = career.player.club
		local division = M_calendar.divisionOf(career)
		local table_ = M_season.sortLeague(career.league)
		local names = A.map(table_, function(t)
			return t.name
		end)
		local working = Js.O({ premier = Js.aspread(members.premier), championship = Js.aspread(members.championship), leagueOne = Js.aspread(members.leagueOne), leagueTwo = Js.aspread(members.leagueTwo), nationalLeague = Js.aspread(members.nationalLeague) }, { "premier", "championship", "leagueOne", "leagueTwo", "nationalLeague" })
		local promotedInto = Js.O({ premier = Js.alit(), championship = Js.alit(), leagueOne = Js.alit(), leagueTwo = Js.alit(), nationalLeague = Js.alit() }, { "premier", "championship", "leagueOne", "leagueTwo", "nationalLeague" })
		local relegatedFrom = Js.O({ premier = Js.alit(), championship = Js.alit(), leagueOne = Js.alit(), leagueTwo = Js.alit(), nationalLeague = Js.alit() }, { "premier", "championship", "leagueOne", "leagueTwo", "nationalLeague" })
		local playOffs = nil
		local worldPlayOffs = Js.alit()
		local world = (function()
			local _ok31, _err32, _rv33 = pcall(function()
				do return Js.RET, M_index.finishWorld(career) end
			end)
			if not _ok31 then
				do return nil end
			elseif _err32 == Js.RET then
				return _rv33
			end
		end)()
		local worldSorted = function(div)
			local lg = (function() local _r = (function() local _v = world; if _v == nil then return nil end; _v = _v.leagues; return _v end)(); if _r == nil then return nil end; return A.find(_r, function(l)
				return (l.division == div)
			end) end)()
			do return (if (lg and (lg.played >= lg.rounds)) then M_season.sortLeague(lg.teams) else nil) end
		end
		local worldPromoted = function(div, count)
			local t = worldSorted(div)
			if (not t) then
				do return nil end
			end
			local po = resolvePlayOffs(t, strength, rng, (count - 1))
			if po then
				A.push(worldPlayOffs, Js.O({ division = div, result = po }, { "division", "result" }))
			end
			local auto = A.map(A.slice(t, 0, (count - 1)), function(x)
				return x.name
			end)
			do return (if po then Js.aspread(auto, Js.alit(po.promoted)) else A.map(A.slice(t, 0, count), function(x)
				return x.name
			end)) end
		end
		do
			local _arr34 = BOUNDARIES
			local _i35 = 0
			while _i35 < Js.alen(_arr34) do
				_i35 += 1
				local _e36 = _arr34[_i35]
				local above = _e36.above
				local below = _e36.below
				local count = _e36.count
				local playingAbove = (TIER_TO_DIVISION[above] == division)
				local playingBelow = (TIER_TO_DIVISION[below] == division)
				local relegated = (if playingAbove then A.slice(names, (-count)) else ((function() local _r = (function() local _v = worldSorted(TIER_TO_DIVISION[above]); if _v == nil then return nil end; _v = A.slice(_v, (-count)); return _v end)(); if _r == nil then return nil end; return A.map(_r, function(t)
					return t.name
				end) end)() or weightedDraw(working[above], strength, count, rng, true)))
				relegatedFrom[above] = relegated
				local promoted = nil
				if playingBelow then
					local played = (function() local _v = career.playOffState; if _v == nil then return nil end; _v = _v.promoted; return _v end)()
					playOffs = (if Js.T(played) then nil else resolvePlayOffs(career.league, strength, rng, (count - 1)))
					local auto = A.slice(names, 0, (count - 1))
					local last = (if played ~= nil then played else (function() local _v = playOffs; if _v == nil then return nil end; _v = _v.promoted; return _v end)())
					promoted = (if Js.T(last) then Js.aspread(auto, Js.alit(last)) else auto)
				else
					promoted = (worldPromoted(TIER_TO_DIVISION[below], count) or weightedDraw(working[below], strength, count, rng))
				end
				promotedInto[above] = promoted
				working[above] = A.filter(working[above], function(c)
					return (not A.includes(relegated, c))
				end)
				working[below] = A.filter(working[below], function(c)
					return (not A.includes(promoted, c))
				end)
			end
		end
		local playingNationalLeague = (division == "national_league")
		local relegatedFromNationalLeague = (if playingNationalLeague then A.slice(names, (-NATIONAL_DOWN_COUNT)) else ((function() local _r = (function() local _v = worldSorted("national_league"); if _v == nil then return nil end; _v = A.slice(_v, (-NATIONAL_DOWN_COUNT)); return _v end)(); if _r == nil then return nil end; return A.map(_r, function(t)
			return t.name
		end) end)() or weightedDraw(working.nationalLeague, strength, NATIONAL_DOWN_COUNT, rng, true)))
		local regionUp = function(key, div)
			if (division ~= div) then
				local t = worldSorted(div)
				if (not t) then
					do return weightedDraw(members[key], strength, REGIONAL_UP_COUNT, rng) end
				end
				local po = resolveRegionalPlayOffs(t, strength, rng)
				if po then
					A.push(worldPlayOffs, Js.O({ division = div, result = po }, { "division", "result" }))
				end
				do return (if po then Js.alit(t[1].name, po.promoted) else A.map(A.slice(t, 0, REGIONAL_UP_COUNT), function(x)
					return x.name
				end)) end
			end
			local played = (function() local _v = career.playOffState; if _v == nil then return nil end; _v = _v.promoted; return _v end)()
			playOffs = (if Js.T(played) then nil else resolveRegionalPlayOffs(career.league, strength, rng))
			local last = (if played ~= nil then played else (function() local _v = playOffs; if _v == nil then return nil end; _v = _v.promoted; return _v end)())
			local auto = A.slice(names, 0, (REGIONAL_UP_COUNT - 1))
			do return (if Js.T(last) then Js.aspread(auto, Js.alit(last)) else auto) end
		end
		local promotedFromNorth = regionUp("nationalLeagueNorth", "national_league_north")
		local promotedFromSouth = regionUp("nationalLeagueSouth", "national_league_south")
		local regionDown = function(key, div, up)
			return (if (division == div) then A.slice(A.filter(names, function(c)
				return (c ~= career.player.club)
			end), (-REGIONAL_DOWN_COUNT)) else ((function() local _r = (function() local _v = worldSorted(div); if _v == nil then return nil end; _v = A.filter(_v, function(t)
				return (not A.includes(up, t.name))
			end); _v = A.slice(_v, (-REGIONAL_DOWN_COUNT)); return _v end)(); if _r == nil then return nil end; return A.map(_r, function(t)
				return t.name
			end) end)() or weightedDraw(A.filter(members[key], function(c)
				return (not A.includes(up, c))
			end), strength, REGIONAL_DOWN_COUNT, rng, true)))
		end
		local relegatedFromNorth = regionDown("nationalLeagueNorth", "national_league_north", promotedFromNorth)
		local relegatedFromSouth = regionDown("nationalLeagueSouth", "national_league_south", promotedFromSouth)
		local promotedFromStep3North = Js.aspread(members.step3North)
		local promotedFromStep3South = Js.aspread(members.step3South)
		local promotedToNationalLeague = Js.aspread(promotedFromNorth, promotedFromSouth)
		local _d37 = M_nonLeagueRegions.splitByRegion(relegatedFromNationalLeague, Js.alen(promotedFromNorth))
		local relegatedToNorth = _d37.north
		local relegatedToSouth = _d37.south
		working.nationalLeague = A.filter(working.nationalLeague, function(c)
			return (not A.includes(relegatedFromNationalLeague, c))
		end)
		local premierRaw = Js.aspread(working.premier, promotedInto.premier)
		local championshipRaw = Js.aspread(working.championship, relegatedFrom.premier, promotedInto.championship)
		local leagueOneRaw = Js.aspread(working.leagueOne, relegatedFrom.championship, promotedInto.leagueOne)
		local leagueTwoRaw = Js.aspread(working.leagueTwo, relegatedFrom.leagueOne, promotedInto.leagueTwo)
		local nationalLeagueRaw = Js.aspread(working.nationalLeague, relegatedFrom.leagueTwo, promotedToNationalLeague)
		local northRaw = Js.aspread(A.filter(members.nationalLeagueNorth, function(c)
			return ((not A.includes(promotedFromNorth, c)) and (not A.includes(relegatedFromNorth, c)))
		end), relegatedToNorth, promotedFromStep3North)
		local southRaw = Js.aspread(A.filter(members.nationalLeagueSouth, function(c)
			return ((not A.includes(promotedFromSouth, c)) and (not A.includes(relegatedFromSouth, c)))
		end), relegatedToSouth, promotedFromStep3South)
		local _d38 = reconcileLadder(premierRaw, championshipRaw, leagueOneRaw, leagueTwoRaw, nationalLeagueRaw, northRaw, southRaw, (if career.limboClubs ~= nil then career.limboClubs else Js.alit()), strength, rng, relegatedFromNorth, relegatedFromSouth)
		local premier = _d38.premier
		local championship = _d38.championship
		local leagueOne = _d38.leagueOne
		local leagueTwo = _d38.leagueTwo
		local nationalLeague = _d38.nationalLeague
		local nationalLeagueNorth = _d38.nationalLeagueNorth
		local nationalLeagueSouth = _d38.nationalLeagueSouth
		local step3North = _d38.step3North
		local step3South = _d38.step3South
		local limbo = _d38.limbo
		local NEXT_TIERS = Js.alit(Js.O({ division = "premier", clubs = premier }, { "division", "clubs" }), Js.O({ division = "championship", clubs = championship }, { "division", "clubs" }), Js.O({ division = "league_one", clubs = leagueOne }, { "division", "clubs" }), Js.O({ division = "league_two", clubs = leagueTwo }, { "division", "clubs" }), Js.O({ division = "national_league", clubs = nationalLeague }, { "division", "clubs" }), Js.O({ division = "national_league_north", clubs = nationalLeagueNorth }, { "division", "clubs" }), Js.O({ division = "national_league_south", clubs = nationalLeagueSouth }, { "division", "clubs" }))
		local next_ = A.find(NEXT_TIERS, function(t)
			return A.includes(t.clubs, you)
		end)
		local nextDivision = ((function() local _v = next_; if _v == nil then return nil end; _v = _v.division; return _v end)() or division)
		local nextClubs = ((function() local _v = next_; if _v == nil then return nil end; _v = _v.clubs; return _v end)() or (if (division == "premier") then premier else championship))
		local yourMove = (if (nextDivision == division) then nil else (if (M_calendar.divisionRank(nextDivision) < M_calendar.divisionRank(division)) then "promoted" else "relegated"))
		do return Js.O({ division = nextDivision, clubs = nextClubs, divisions = Js.O({ premier = premier, championship = championship, leagueOne = leagueOne, leagueTwo = leagueTwo, nationalLeague = nationalLeague, nationalLeagueNorth = nationalLeagueNorth, nationalLeagueSouth = nationalLeagueSouth, step3North = step3North, step3South = step3South }, { "premier", "championship", "leagueOne", "leagueTwo", "nationalLeague", "nationalLeagueNorth", "nationalLeagueSouth", "step3North", "step3South" }), yourMove = yourMove, promotedToPremier = promotedInto.premier, relegatedFromPremier = relegatedFrom.premier, promotedToChampionship = promotedInto.championship, relegatedFromChampionship = relegatedFrom.championship, promotedToLeagueOne = promotedInto.leagueOne, relegatedFromLeagueOne = relegatedFrom.leagueOne, promotedToLeagueTwo = promotedInto.leagueTwo, relegatedFromLeagueTwo = relegatedFrom.leagueTwo, promotedToNationalLeague = promotedToNationalLeague, relegatedFromNationalLeague = relegatedFromNationalLeague, relegatedToNorth = relegatedToNorth, relegatedToSouth = relegatedToSouth, promotedFromNorth = promotedFromNorth, promotedFromSouth = promotedFromSouth, relegatedFromNorth = relegatedFromNorth, relegatedFromSouth = relegatedFromSouth, promotedFromStep3North = promotedFromStep3North, promotedFromStep3South = promotedFromStep3South, playOffs = playOffs, limbo = limbo, worldPlayOffs = worldPlayOffs }, { "division", "clubs", "divisions", "yourMove", "promotedToPremier", "relegatedFromPremier", "promotedToChampionship", "relegatedFromChampionship", "promotedToLeagueOne", "relegatedFromLeagueOne", "promotedToLeagueTwo", "relegatedFromLeagueTwo", "promotedToNationalLeague", "relegatedFromNationalLeague", "relegatedToNorth", "relegatedToSouth", "promotedFromNorth", "promotedFromSouth", "relegatedFromNorth", "relegatedFromSouth", "promotedFromStep3North", "promotedFromStep3South", "playOffs", "limbo", "worldPlayOffs" }) end
	end
	exports.resolveLadder = resolveLadder
	RETIRED_REGIONAL = Js.Set.new(Js.alit("Alfreton Town", "Curzon Ashton", "Leamington", "Peterborough Sports", "Bath City", "Chippenham Town", "Eastbourne Borough", "Enfield Town", "St Albans City"))
	JOINERS = Js.O({ north = Js.alit("Harborough Town", "Hebburn Town", "Oxford City", "Spalding United"), south = Js.alit("Billericay Town", "Dover Athletic", "Farnham Town", "Folkestone Invicta", "Walton & Hersham") }, { "north", "south" })
	TIER_RATING = Js.O({ premier = "premier", championship = "championship", leagueOne = "league_one", leagueTwo = "league_two", nationalLeague = "national_league", nationalLeagueNorth = "national_league_north", nationalLeagueSouth = "national_league_south", step3North = "step3", step3South = "step3" }, { "premier", "championship", "leagueOne", "leagueTwo", "nationalLeague", "nationalLeagueNorth", "nationalLeagueSouth", "step3North", "step3South" })
	TIER_ORDER = Js.alit("premier", "championship", "leagueOne", "leagueTwo", "nationalLeague", "nationalLeagueNorth", "nationalLeagueSouth", "step3North", "step3South")
	squadMaps = Js.Map.new()
	PREMIER_SIZE = Js.alen(M_clubs.PREMIER_LEAGUE_CLUBS)
	CHAMPIONSHIP_SIZE = Js.alen(M_clubs.CHAMPIONSHIP_CLUBS)
	LEAGUE_ONE_SIZE = Js.alen(M_clubs.LEAGUE_ONE_CLUBS)
	LEAGUE_TWO_SIZE = Js.alen(M_clubs.LEAGUE_TWO_CLUBS)
	NATIONAL_LEAGUE_SIZE = Js.alen(M_clubs.NATIONAL_LEAGUE_CLUBS)
	NORTH_SIZE = Js.alen(M_clubs.NATIONAL_LEAGUE_NORTH_CLUBS)
	SOUTH_SIZE = Js.alen(M_clubs.NATIONAL_LEAGUE_SOUTH_CLUBS)
	STEP3_SIZE = Js.alen(M_clubs.STEP3_NORTH_CLUBS)
	CHAMP_LEAGUE_ONE_COUNT = 3
	LEAGUE_ONE_TWO_COUNT = 4
	LEAGUE_TWO_NATIONAL_COUNT = 2
	REGIONAL_UP_COUNT = 2
	NATIONAL_DOWN_COUNT = (REGIONAL_UP_COUNT * 2)
	REGIONAL_DOWN_COUNT = 4
	TIER_KEYS = Js.alit("premier", "championship", "leagueOne", "leagueTwo", "nationalLeague")
	TIER_TO_DIVISION = Js.O({ premier = "premier", championship = "championship", leagueOne = "league_one", leagueTwo = "league_two", nationalLeague = "national_league" }, { "premier", "championship", "leagueOne", "leagueTwo", "nationalLeague" })
	BOUNDARIES = Js.alit(Js.O({ above = "premier", below = "championship", count = 3 }, { "above", "below", "count" }), Js.O({ above = "championship", below = "leagueOne", count = CHAMP_LEAGUE_ONE_COUNT }, { "above", "below", "count" }), Js.O({ above = "leagueOne", below = "leagueTwo", count = LEAGUE_ONE_TWO_COUNT }, { "above", "below", "count" }), Js.O({ above = "leagueTwo", below = "nationalLeague", count = LEAGUE_TWO_NATIONAL_COUNT }, { "above", "below", "count" }))
end
