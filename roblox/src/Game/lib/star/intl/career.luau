--!nocheck
--!nolint
-- Generated from lib/star/intl/career.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_nations = import("lib/star/intl/nations")
	local M_calendar = import("lib/star/calendar")
	local M_replay = import("lib/star/intl/replay")
	local M_rating = import("lib/star/rating")
	local M_windows = import("lib/star/intl/windows")
	local M_engine = import("lib/star/intl/engine")
	local M_energy = import("lib/star/energy")
	local M_squadData = import("lib/star/squadData")
	local M_nationNames = import("lib/star/nationNames")
	local M_fakeFaces = import("lib/star/fakeFaces")
	local DAY, SQUAD_AT, START_AT, SURE_START, TOURNAMENT_COMPS, myNation, intlOf, inputsOf, ts, frontier, worldOf, periodKeyOf, expectedXi, realPlayers, xiAdjustments, PENALTY, divisionPenalty, posGroup, squadBar, effectiveLevel, managerTarget, clamp100, managerAfterClubMatch, managerLine, WINDOW_NAMES, windowKeyOf, alive, periodsFrom, seasonEnd, inSeason, markBallonDorNight, ballonDorYearStart, lastPlayedTime, nextClubTime, periodDue, callUpChanceFor, decide, COMP_NAMES, fixtureFor, applyDecision, syncIntl, watchedScore, awayOnDuty, friendlyPlan, intlSelection, creditIntl, SLOTS_23, SLOTS_26, squadFor, squadAsLeague, whoWon, nationStrengthNow, myGroups, myMatches, myRanking, topRanking, dutyNow, groupOf, viewOf, roundsOf
	myNation = function(career)
		do return ((function() local _v = M_nations.nationFor(career.player.nationality); if _v == nil then return nil end; _v = _v.name; return _v end)() or "England") end
	end
	exports.myNation = myNation
	intlOf = function(career)
		do return (if career.intl ~= nil then career.intl else Js.O({ v = 1, nation = myNation(career), firstYear = M_calendar.seasonStartYear(career.player.startYear, 1), xi = Js.O({}, nil), played = Js.O({}, nil), manager = 0, periods = Js.O({}, nil), awarded = Js.alit() }, { "v", "nation", "firstYear", "xi", "played", "manager", "periods", "awarded" })) end
	end
	exports.intlOf = intlOf
	inputsOf = function(s)
		do return Js.O({ xi = s.xi, played = s.played, firstYear = s.firstYear }, { "xi", "played", "firstYear" }) end
	end
	exports.inputsOf = inputsOf
	ts = function(career, f)
		do return M_calendar.fixtureTimestamp(career.player.startYear, career.season, f.week, f.kind, M_calendar.divisionOf(career)) end
	end
	frontier = function(career)
		local next_ = math.huge
		local last = (-math.huge)
		do
			local _arr1 = (if career.fixtures ~= nil then career.fixtures else Js.alit())
			local _i2 = 0
			while _i2 < Js.alen(_arr1) do
				_i2 += 1
				local f = _arr1[_i2]
				local t = (ts(career, f) + (if (f.kind == "international") then (11.5 * 3600000) else 0))
				if f.played then
					last = Math.max(last, t)
				else
					next_ = Math.min(next_, t)
				end
			end
		end
		if (next_ < math.huge) then
			do return (next_ - 60000) end
		end
		if (last > (-math.huge)) then
			do return ((last + DAY) + 3600000) end
		end
		do return (M_calendar.openingSaturday(M_calendar.seasonStartYear(career.player.startYear, career.season)):getTime() - DAY) end
	end
	exports.frontier = frontier
	worldOf = function(career, until_)
		if until_ == nil then until_ = frontier(career) end
		local s = intlOf(career)
		local nation = s.nation
		local start = M_calendar.openingSaturday(M_calendar.seasonStartYear(career.player.startYear, 1)):getTime()
		local watching = M_calendar.stopsForBreaks(M_calendar.divisionOf(career))
		local watched = Js.Set.new(A.map(A.filter((if career.fixtures ~= nil then career.fixtures else Js.alit()), function(f)
			return (f.watch and f.played)
		end), function(f)
			return f.intlId
		end))
		local since = lastPlayedTime(career)
		local hold = function(m)
			if ((((m.home ~= nation) and (m.away ~= nation)) or (m.date < start)) or s.played[m.id]) then
				do return false end
			end
			local decided = s.periods[periodKeyOf(m)]
			if ((function() local _v = decided; if _v == nil then return nil end; _v = _v.called; return _v end)() ~= false) then
				do return true end
			end
			do return ((((watching and (not A.includes(TOURNAMENT_COMPS, m.comp))) and (not watched:has(m.id))) and (m.date > since)) and inSeason(career, m.date)) end
		end
		do return M_replay.worldAt(inputsOf(s), until_, hold) end
	end
	exports.worldOf = worldOf
	periodKeyOf = function(m)
		if A.includes(TOURNAMENT_COMPS, m.comp) then
			do return ("T:" .. m.edition) end
		end
		do return ((function() local _v = windowKeyOf(m.date); if _v == nil then return nil end; _v = _v.key; return _v end)() or ("D:" .. Js.numstr(m.date))) end
	end
	exports.periodKeyOf = periodKeyOf
	expectedXi = function(strength)
		do return (38.93 + (0.533 * strength)) end
	end
	exports.expectedXi = expectedXi
	realPlayers = function(career)
		local out = Js.Map.new()
		local add = function(p)
			if (Js.T(p.nation) and (not out:has((p.nation .. "|" .. p.name)))) then
				out:set((p.nation .. "|" .. p.name), p)
			end
		end
		do
			local _arr3 = (if career.squad ~= nil then career.squad else Js.alit())
			local _i4 = 0
			while _i4 < Js.alen(_arr3) do
				_i4 += 1
				local p = _arr3[_i4]
				local n = (function() local _v = M_nations.nationFor(p.nationality); if _v == nil then return nil end; _v = _v.name; return _v end)()
				if (Js.T(n) and Js.T(p.overall)) then
					add(Js.O({ name = p.name, nation = n, overall = p.overall, position = p.position, positions = p.positions, club = career.player.club, image = p.imageUrl, age = p.age }, { "name", "nation", "overall", "position", "positions", "club", "image", "age" }))
				end
			end
		end
		do
			local _arr5 = Js.aspread((if career.leagueSquads ~= nil then career.leagueSquads else Js.alit()), (if career.externalSquads ~= nil then career.externalSquads else Js.alit()))
			local _i6 = 0
			while _i6 < Js.alen(_arr5) do
				_i6 += 1
				local sq = _arr5[_i6]
				do
					local _arr7 = sq.players
					local _i8 = 0
					while _i8 < Js.alen(_arr7) do
						_i8 += 1
						local p = _arr7[_i8]
						local n = (function() local _v = M_nations.nationFor(p.nation); if _v == nil then return nil end; _v = _v.name; return _v end)()
						if (Js.T(n) and Js.T(p.overall)) then
							add(Js.O({ name = p.name, nation = n, overall = p.overall, position = p.position, positions = p.positions, club = sq.club, image = p.image, age = p.age }, { "name", "nation", "overall", "position", "positions", "club", "image", "age" }))
						end
					end
				end
			end
		end
		do return Js.Array.from(out:values()) end
	end
	exports.realPlayers = realPlayers
	xiAdjustments = function(career)
		local by = Js.Map.new()
		do
			local _arr9 = realPlayers(career)
			local _i10 = 0
			while _i10 < Js.alen(_arr9) do
				_i10 += 1
				local p = _arr9[_i10]
				local xs = (by:get(p.nation) or Js.alit())
				A.push(xs, p.overall)
				by:set(p.nation, xs)
			end
		end
		local mine = myNation(career)
		local me = M_rating.displayOverall((if career.starRating ~= nil then career.starRating else 2.5))
		by:set(mine, Js.aspread((by:get(mine) or Js.alit()), Js.alit(me)))
		local out = Js.O({}, nil)
		do
			local _arr11 = Js.Array.from(by:entries())
			local _i12 = 0
			while _i12 < Js.alen(_arr11) do
				_i12 += 1
				local _e13 = _arr11[_i12]
				local n = _e13[1]
				local xs = _e13[2]
				local nat = M_nations.nationFor(n)
				if (not nat) then
					do continue end
				end
				local exp = expectedXi(M_nations.rankingStrength(nat.points))
				local best = A.slice(A.sort(xs, function(a, b)
					return (b - a)
				end), 0, 11)
				local filled = Js.aspread(best, A.fill(Js.Array.new((11 - Js.alen(best))), exp))
				local avg = (A.reduce(filled, function(s, x)
					return Js.add(s, x)
				end, 0) / 11)
				local adj = Math.max(-8, Math.min(8, ((avg - exp) / 0.533)))
				if (math.abs(adj) >= 0.5) then
					out[n] = (Math.round((adj * 10)) / 10)
				end
			end
		end
		do return out end
	end
	exports.xiAdjustments = xiAdjustments
	divisionPenalty = function(div)
		if (not Js.T(div)) then
			do return 0 end
		end
		do return (if PENALTY[div] ~= nil then PENALTY[div] else -16) end
	end
	exports.divisionPenalty = divisionPenalty
	posGroup = function(p)
		if (p == "GK") then
			do return "GK" end
		end
		if A.includes(Js.alit("CB", "LB", "RB", "LWB", "RWB"), p) then
			do return "DEF" end
		end
		if A.includes(Js.alit("CDM", "CM", "CAM", "LM", "RM"), p) then
			do return "MID" end
		end
		do return "FWD" end
	end
	squadBar = function(career, nation)
		if nation == nil then nation = myNation(career) end
		local nat = M_nations.nationFor(nation)
		local xi = ((function() local _v = (intlOf(career).xi)[Js.key(career.season)]; if _v == nil then return nil end; _v = _v[nation]; return _v end)() or 0)
		local base = (expectedXi((M_nations.rankingStrength(((function() local _v = nat; if _v == nil then return nil end; _v = _v.points; return _v end)() or 1192)) + xi)) - 3)
		local g = posGroup((if career.player.position ~= nil then career.player.position else "ST"))
		local rivals = A.sort(A.map(A.filter(realPlayers(career), function(p)
			return ((p.nation == nation) and (posGroup(p.position) == g))
		end), function(p)
			return p.overall
		end), function(a, b)
			return (b - a)
		end)
		do return Math.max(base, ((if rivals[2] ~= nil then rivals[2] else 0) - 1)) end
	end
	exports.squadBar = squadBar
	effectiveLevel = function(career)
		local overall = M_rating.displayOverall((if career.starRating ~= nil then career.starRating else 2.5))
		local starter = (if (career.status == "1st Team") then 2 else 0)
		do return ((overall + divisionPenalty(M_calendar.divisionOf(career))) + starter) end
	end
	exports.effectiveLevel = effectiveLevel
	managerTarget = function(career)
		do return Math.max(0, Math.min(100, (SQUAD_AT + (5 * (effectiveLevel(career) - squadBar(career)))))) end
	end
	exports.managerTarget = managerTarget
	clamp100 = function(x)
		do return Math.max(0, Math.min(100, x)) end
	end
	managerAfterClubMatch = function(career, rating, away)
		if away == nil then away = false end
		local s = intlOf(career)
		local target = managerTarget(career)
		local weight = (1 + (divisionPenalty(M_calendar.divisionOf(career)) / 20))
		local bar = (if (rating == nil) then ((s.manager + (0.04 * (target - s.manager))) - (if away then 0 else 0.4)) else ((s.manager + (0.12 * (target - s.manager))) + (((rating - 6.6) * 1.2) * weight)))
		do return Js.ospread(career, Js.O({ intl = Js.ospread(s, Js.O({ manager = (Math.round((clamp100(bar) * 10)) / 10) }, { "manager" })) }, { "intl" })) end
	end
	exports.managerAfterClubMatch = managerAfterClubMatch
	managerLine = function(career)
		local s = intlOf(career)
		local n = s.nation
		if (s.manager >= SURE_START) then
			do return (n .. "'s manager builds the team around you.") end
		end
		if (s.manager >= START_AT) then
			do return (n .. "'s manager sees you as a starter.") end
		end
		if (s.manager >= SQUAD_AT) then
			do return (n .. "'s manager has you in his squad plans.") end
		end
		if (s.manager >= 20) then
			do return (n .. "'s manager is watching you.") end
		end
		local gap = (squadBar(career) - effectiveLevel(career))
		if (gap > 6) then
			do return (n .. "'s manager doesn't know your name yet. Their squad is picked at about " .. Js.numstr(Math.round(squadBar(career))) .. ".") end
		end
		do return (n .. "'s manager has heard of you. Keep playing well.") end
	end
	exports.managerLine = managerLine
	windowKeyOf = function(t)
		local y = Js.Date.new(t):getUTCFullYear()
		do
			local _arr14 = Js.alit("sepoct", "nov", "mar", "jun")
			local _i15 = 0
			while _i15 < Js.alen(_arr14) do
				_i15 += 1
				local k = _arr14[_i15]
				local w = M_windows.windowFor(y, k)
				if ((w and (t >= w.start:getTime())) and (t <= (w["end"]:getTime() + DAY))) then
					do return Js.O({ key = ("W:" .. Js.numstr(y) .. "-" .. k), label = (WINDOW_NAMES[k] .. " " .. Js.numstr(y)), start = w.start:getTime(), ["end"] = (w["end"]:getTime() + DAY) }, { "key", "label", "start", "end" }) end
				end
			end
		end
		do return nil end
	end
	alive = function(w, edition, nation)
		local ms = A.filter(w:edition(edition), function(m)
			return ((m.home == nation) or (m.away == nation))
		end)
		if A.some(ms, function(m)
			return (not M_engine.played(m))
		end) then
			do return true end
		end
		local result = w.facts:get((edition .. ":result"))
		if Js.T(result) then
			do return false end
		end
		local last = A.sort(ms, function(a, b)
			return (b.date - a.date)
		end)[1]
		if (not last) then
			do return false end
		end
		if (not Js.T(last.group)) then
			do return (M_engine.winnerOf(last) == nation) end
		end
		local tables = w.facts:get((edition .. ":tables"))
		if (not tables) then
			do return true end
		end
		do return A.some(w:edition(edition), function(m)
			return ((not Js.T(m.group)) and ((m.home == nation) or (m.away == nation)))
		end) end
	end
	periodsFrom = function(w, nation, from)
		local out = Js.Map.new()
		do
			local _arr16 = w.matches
			local _i17 = 0
			while _i17 < Js.alen(_arr16) do
				_i17 += 1
				local m = _arr16[_i17]
				if ((m.date < from) or ((m.home ~= nation) and (m.away ~= nation))) then
					do continue end
				end
				if A.includes(TOURNAMENT_COMPS, m.comp) then
					local key = ("T:" .. m.edition)
					local p = out:get(key)
					if p then
						A.push(p.matches, m)
						do continue end
					end
					local all = w:edition(m.edition)
					local start = Math.min(Js.unpack(A.map(all, function(x)
						return x.date
					end)))
					local lastAll = Math.max(Js.unpack(A.map(all, function(x)
						return x.date
					end)))
					out:set(key, Js.O({ key = key, kind = "tournament", label = (m.comp .. " " .. Js.numstr(Js.Date.new(lastAll):getUTCFullYear())), matches = Js.alit(m), start = (start - (5 * DAY)), ["end"] = (lastAll + DAY), edition = m.edition, comp = m.comp }, { "key", "kind", "label", "matches", "start", "end", "edition", "comp" }))
				else
					local wk = windowKeyOf(m.date)
					if (not wk) then
						do continue end
					end
					local p = out:get(wk.key)
					if p then
						A.push(p.matches, m)
					else
						out:set(wk.key, Js.O({ key = wk.key, kind = "window", label = wk.label, matches = Js.alit(m), start = wk.start, ["end"] = wk["end"] }, { "key", "kind", "label", "matches", "start", "end" }))
					end
				end
			end
		end
		local list = Js.Array.from(out:values())
		do
			local _arr18 = list
			local _i19 = 0
			while _i19 < Js.alen(_arr18) do
				_i19 += 1
				local p = _arr18[_i19]
				A.sort(p.matches, function(a, b)
					return (a.date - b.date)
				end)
				if (((p.kind == "tournament") and Js.T(p.edition)) and (not alive(w, p.edition, nation))) then
					p["end"] = (p.matches[Js.alen(p.matches)].date + DAY)
				end
			end
		end
		do return A.sort(list, function(a, b)
			return (a.start - b.start)
		end) end
	end
	exports.periodsFrom = periodsFrom
	seasonEnd = function(career)
		do return Js.Date.UTC((M_calendar.seasonStartYear(career.player.startYear, career.season) + 1), 6, 31) end
	end
	inSeason = function(career, t)
		do return ((t >= M_calendar.openingSaturday(M_calendar.seasonStartYear(career.player.startYear, career.season)):getTime()) and (t <= seasonEnd(career))) end
	end
	markBallonDorNight = function(career)
		local s = intlOf(career)
		do return Js.ospread(s, Js.O({ nights = Js.ospread((if s.nights ~= nil then s.nights else Js.O({}, nil)), (function() local _o = Js.O({}, nil); _o[Js.key(career.season)] = worldOf(career).now; return _o end)()) }, { "nights" })) end
	end
	exports.markBallonDorNight = markBallonDorNight
	ballonDorYearStart = function(career, season)
		local s = intlOf(career)
		local prev = (function() local _v = s.nights; if _v == nil then return nil end; _v = _v[Js.key((season - 1))]; return _v end)()
		if (prev ~= nil) then
			do return (prev + 1) end
		end
		local careerStart = M_calendar.openingSaturday(M_calendar.seasonStartYear(career.player.startYear, 1)):getTime()
		if (season <= 1) then
			do return careerStart end
		end
		do return Math.max(careerStart, Js.Date.UTC(M_calendar.seasonStartYear(career.player.startYear, season), 5, 1)) end
	end
	exports.ballonDorYearStart = ballonDorYearStart
	lastPlayedTime = function(career)
		local t = (-math.huge)
		do
			local _arr20 = (if career.fixtures ~= nil then career.fixtures else Js.alit())
			local _i21 = 0
			while _i21 < Js.alen(_arr20) do
				_i21 += 1
				local f = _arr20[_i21]
				if f.played then
					t = Math.max(t, ts(career, f))
				end
			end
		end
		do return t end
	end
	nextClubTime = function(career)
		local t = math.huge
		do
			local _arr22 = (if career.fixtures ~= nil then career.fixtures else Js.alit())
			local _i23 = 0
			while _i23 < Js.alen(_arr22) do
				_i23 += 1
				local f = _arr22[_i23]
				if ((not f.played) and (f.kind ~= "international")) then
					t = Math.min(t, ts(career, f))
				end
			end
		end
		do return t end
	end
	periodDue = function(career)
		if (((not Js.T((function() local _v = career.player; if _v == nil then return nil end; _v = _v.club; return _v end)())) or (not Js.T((function() local _v = career.fixtures; if _v == nil then return nil end; _v = Js.len(_v); return _v end)()))) or (not Js.NumberNS.isFinite(frontier(career)))) then
			do return nil end
		end
		local s = intlOf(career)
		local w = worldOf(career)
		local from = Math.max((frontier(career) - (40 * DAY)), M_calendar.openingSaturday(M_calendar.seasonStartYear(career.player.startYear, career.season)):getTime())
		local limit = Math.min(nextClubTime(career), seasonEnd(career))
		do
			local _arr24 = periodsFrom(w, s.nation, from)
			local _i25 = 0
			while _i25 < Js.alen(_arr24) do
				_i25 += 1
				local p = _arr24[_i25]
				if s.periods[p.key] then
					do continue end
				end
				local first = A.find(p.matches, function(m)
					return ((not M_engine.played(m)) and (not s.played[m.id]))
				end)
				if ((not first) or (first.date < lastPlayedTime(career))) then
					do continue end
				end
				if ((first.date <= (limit + (3 * DAY))) and (first.date <= seasonEnd(career))) then
					do return p end
				end
			end
		end
		do return nil end
	end
	exports.periodDue = periodDue
	callUpChanceFor = function(career, period)
		if career.injury then
			do return 0 end
		end
		local s = intlOf(career)
		local lastCalled = Js.alen(A.filter(A.slice(Js.Object.values(s.periods), -3), function(p)
			return p.called
		end))
		local bonus = (if ((function() local _v = period; if _v == nil then return nil end; _v = _v.kind; return _v end)() == "tournament") then (2 * lastCalled) else 0)
		local x = (((s.manager + bonus) - SQUAD_AT) / 4)
		do return Math.max(0.02, Math.min(0.98, (1 / (1 + Math.exp((-x)))))) end
	end
	exports.callUpChanceFor = callUpChanceFor
	decide = function(career, period)
		local s = intlOf(career)
		local chance = callUpChanceFor(career, period)
		local roll = M_engine.rngFor(("callup|" .. career.player.firstName .. " " .. career.player.lastName .. "|" .. period.key))()
		local called = (roll < chance)
		local starter = (s.manager >= START_AT)
		local reason = (if career.injury then "You're injured, so the manager leaves you out." else (if called then (if starter then "You're one of his first names on the team sheet." else "You're in the squad. Earn a start.") else (if (s.manager < 15) then (s.nation .. "'s manager isn't looking at you yet.") else "Close, but not this time. Keep playing well.")))
		do return Js.O({ period = period, nation = s.nation, called = called, chance = chance, starter = starter, reason = reason, manager = s.manager, line = managerLine(career) }, { "period", "nation", "called", "chance", "starter", "reason", "manager", "line" }) end
	end
	exports.decide = decide
	fixtureFor = function(career, w, m, nation)
		local home = (m.home == nation)
		local opp = (if home then m.away else m.home)
		local intlKo = nil
		if Js.T(m.firstLeg) then
			local f = w.byId:get(m.firstLeg)
			local r = (f and ((function() local _v = career.intl; if _v == nil then return nil end; _v = _v.played; _v = _v[f.id]; return _v end)() or (if M_engine.played(f) then Js.O({ hs = f.hs, as = f.as }, { "hs", "as" }) else nil)))
			if (f and r) then
				intlKo = Js.O({ level = "et-pens", firstLeg = (if (f.home == nation) then Js.O({ us = r.hs, them = r.as }, { "us", "them" }) else Js.O({ us = r.as, them = r.hs }, { "us", "them" })) }, { "level", "firstLeg" })
			end
		elseif Js.T(m.level) then
			intlKo = Js.O({ level = m.level }, { "level" })
		end
		do return Js.ospread(Js.O({ week = M_calendar.intlWeek(career.player.startYear, career.season, Js.Date.new(m.date)), opponent = opp, home = home, played = false }, { "week", "opponent", "home", "played" }), (if intlKo then Js.O({ intlKo = intlKo }, { "intlKo" }) else Js.O({}, nil)), Js.O({ competition = COMP_NAMES[m.comp], kind = "international", round = m.stage, opponentStrength = Math.round(w:strength(opp, m.date)), intlId = m.id }, { "competition", "kind", "round", "opponentStrength", "intlId" })) end
	end
	applyDecision = function(career, d)
		local s = intlOf(career)
		local periods = Js.ospread(s.periods, (function() local _o = Js.O({}, nil); _o[Js.key(d.period.key)] = Js.O({ called = d.called, chance = (Math.round((d.chance * 100)) / 100), starter = d.starter }, { "called", "chance", "starter" }); return _o end)())
		do return syncIntl(Js.ospread(career, Js.O({ intl = Js.ospread(s, Js.O({ periods = periods }, { "periods" })) }, { "intl" }))) end
	end
	exports.applyDecision = applyDecision
	syncIntl = function(career)
		if ((not Js.T((function() local _v = career.player; if _v == nil then return nil end; _v = _v.club; return _v end)())) or (not Js.NumberNS.isFinite(frontier(career)))) then
			do return career end
		end
		local s = intlOf(career)
		if (not s.xi[Js.key(career.season)]) then
			s = Js.ospread(s, Js.O({ xi = Js.ospread(s.xi, (function() local _o = Js.O({}, nil); _o[Js.key(career.season)] = xiAdjustments(career); return _o end)()) }, { "xi" }))
		end
		career = Js.ospread(career, Js.O({ intl = s }, { "intl" }))
		local w = worldOf(career)
		local nation = s.nation
		local from = M_calendar.openingSaturday(M_calendar.seasonStartYear(career.player.startYear, career.season)):getTime()
		local lastT = lastPlayedTime(career)
		local passed = nil
		do
			local _arr26 = periodsFrom(w, nation, from)
			local _i27 = 0
			while _i27 < Js.alen(_arr26) do
				_i27 += 1
				local p = _arr26[_i27]
				if s.periods[p.key] then
					do continue end
				end
				local first = A.find(p.matches, function(m)
					return ((not M_engine.played(m)) and (not s.played[m.id]))
				end)
				if (first and (first.date < lastT)) then
					(function() if passed == nil then passed = Js.ospread(s.periods) end; return passed end)()[p.key] = Js.O({ called = false, chance = 0, starter = false }, { "called", "chance", "starter" })
				end
			end
		end
		if passed then
			s = Js.ospread(s, Js.O({ periods = passed }, { "periods" }))
			career = Js.ospread(career, Js.O({ intl = s }, { "intl" }))
			do return syncIntl(career) end
		end
		local wanted = Js.Map.new()
		do
			local _arr28 = periodsFrom(w, nation, from)
			local _i29 = 0
			while _i29 < Js.alen(_arr28) do
				_i29 += 1
				local p = _arr28[_i29]
				if ((not (function() local _v = s.periods[p.key]; if _v == nil then return nil end; _v = _v.called; return _v end)()) or (p.start > seasonEnd(career))) then
					do continue end
				end
				do
					local _arr30 = p.matches
					local _i31 = 0
					while _i31 < Js.alen(_arr30) do
						_i31 += 1
						local m = _arr30[_i31]
						if (((not s.played[m.id]) and (not M_engine.played(m))) and (m.date <= seasonEnd(career))) then
							wanted:set(m.id, m)
						end
					end
				end
			end
		end
		local watchList = Js.Map.new()
		if M_calendar.stopsForBreaks(M_calendar.divisionOf(career)) then
			do
				local _arr32 = periodsFrom(w, nation, from)
				local _i33 = 0
				while _i33 < Js.alen(_arr32) do
					_i33 += 1
					local p = _arr32[_i33]
					if ((p.kind ~= "window") or ((function() local _v = s.periods[p.key]; if _v == nil then return nil end; _v = _v.called; return _v end)() ~= false)) then
						do continue end
					end
					do
						local _arr34 = p.matches
						local _i35 = 0
						while _i35 < Js.alen(_arr34) do
							_i35 += 1
							local m = _arr34[_i35]
							if ((((not s.played[m.id]) and (not M_engine.played(m))) and inSeason(career, m.date)) and (m.date > lastT)) then
								watchList:set(m.id, m)
							end
						end
					end
				end
			end
		end
		local keep = A.filter((if career.fixtures ~= nil then career.fixtures else Js.alit()), function(f)
			return ((not Js.T(f.intlId)) or f.played)
		end)
		local done = Js.Set.new(A.filter(A.map(keep, function(f)
			return f.intlId
		end), Js.Boolean))
		local add = Js.aspread(A.map(A.filter(Js.Array.from(wanted:values()), function(m)
			return (not done:has(m.id))
		end), function(m)
			return fixtureFor(career, w, m, nation)
		end), A.map(A.filter(Js.Array.from(watchList:values()), function(m)
			return ((not done:has(m.id)) and (not wanted:has(m.id)))
		end), function(m)
			return Js.ospread(fixtureFor(career, w, m, nation), Js.O({ watch = true }, { "watch" }))
		end))
		local trophies = Js.alit()
		local awarded = Js.aspread(s.awarded)
		do
			local _arr36 = w.finals
			local _i37 = 0
			while _i37 < Js.alen(_arr36) do
				_i37 += 1
				local f = _arr36[_i37]
				if ((f.winner ~= nation) or A.includes(awarded, f.edition)) then
					do continue end
				end
				local fm = A.find(w:edition(f.edition), function(m)
					return ((m.stage == "Final") or (m.stage == "Final · Leg 2"))
				end)
				if (not fm) then
					do continue end
				end
				local p = A.find(periodsFrom(w, nation, (fm.date - DAY)), function(x)
					return A.some(x.matches, function(m)
						return (m.id == fm.id)
					end)
				end)
				if ((not p) or (not (function() local _v = s.periods[p.key]; if _v == nil then return nil end; _v = _v.called; return _v end)())) then
					do continue end
				end
				A.push(awarded, f.edition)
				A.push(trophies, Js.O({ season = career.season, competition = f.comp, club = nation }, { "season", "competition", "club" }))
			end
		end
		do return Js.ospread(career, Js.O({ fixtures = Js.aspread(keep, add), trophies = (if Js.T(Js.alen(trophies)) then Js.aspread((if career.trophies ~= nil then career.trophies else Js.alit()), trophies) else career.trophies), intl = Js.ospread(s, Js.O({ awarded = awarded }, { "awarded" })) }, { "fixtures", "trophies", "intl" })) end
	end
	exports.syncIntl = syncIntl
	watchedScore = function(career, f)
		if (not Js.T(f.intlId)) then
			do return nil end
		end
		local marked = Js.ospread(career, Js.O({ fixtures = A.map(career.fixtures, function(x)
			return (if (x.intlId == f.intlId) then Js.ospread(x, Js.O({ played = true }, { "played" })) else x)
		end) }, { "fixtures" }))
		local w = worldOf(marked, Math.max(frontier(marked), (ts(career, f) + DAY)))
		local m = w.byId:get(f.intlId)
		if ((not m) or (not M_engine.played(m))) then
			do return nil end
		end
		local nation = intlOf(career).nation
		local home = (m.home == nation)
		do return Js.ospread(Js.O({ us = (if home then m.hs else m.as), them = (if home then m.as else m.hs) }, { "us", "them" }), (if m.pens then Js.O({ pens = (if home then Js.O({ us = m.pens.hs, them = m.pens.as }, { "us", "them" }) else Js.O({ us = m.pens.as, them = m.pens.hs }, { "us", "them" })) }, { "pens" }) else Js.O({}, nil))) end
	end
	exports.watchedScore = watchedScore
	awayOnDuty = function(career, f)
		if (((f.kind == "international") or (not career.intl)) or (not Js.NumberNS.isFinite(frontier(career)))) then
			do return nil end
		end
		local s = career.intl
		local t = ts(career, f)
		local w = worldOf(career)
		do
			local _arr38 = periodsFrom(w, s.nation, (t - (60 * DAY)))
			local _i39 = 0
			while _i39 < Js.alen(_arr38) do
				_i39 += 1
				local p = _arr38[_i39]
				if (not (function() local _v = s.periods[p.key]; if _v == nil then return nil end; _v = _v.called; return _v end)()) then
					do continue end
				end
				local first = ((function() local _v = p.matches[1]; if _v == nil then return nil end; _v = _v.date; return _v end)() or p.start)
				local last = (if (p.kind == "tournament") then p["end"] else (((function() local _v = p.matches[Js.alen(p.matches)]; if _v == nil then return nil end; _v = _v.date; return _v end)() or p["end"]) + (2 * DAY)))
				if ((t >= (first - (3 * DAY))) and (t <= last)) then
					do return (if (p.kind == "tournament") then ("You're away with " .. s.nation .. " at the " .. Js.str(p.comp) .. ".") else ("You're away with " .. s.nation .. " for the international break.")) end
				end
			end
		end
		do return nil end
	end
	exports.awayOnDuty = awayOnDuty
	friendlyPlan = function(career, f)
		local s = intlOf(career)
		local w = worldOf(career)
		local m = w.byId:get((if f.intlId ~= nil then f.intlId else ""))
		if ((not m) or (m.importance ~= 10)) then
			do return nil end
		end
		local nation = s.nation
		local wk = windowKeyOf(m.date)
		local kind = (function() local _v = wk; if _v == nil then return nil end; _v = _v.key; _v = S.split(_v, "-"); _v = _v[2]; return _v end)()
		local win = (if Js.T(kind) then M_windows.windowFor(Js.Date.new(m.date):getUTCFullYear(), kind) else nil)
		local sameDay = function(a, b)
			return (math.floor((a / DAY)) == math.floor((b / DAY)))
		end
		local days = A.filter(A.map(((function() local _v = win; if _v == nil then return nil end; _v = _v.matchdays; return _v end)() or Js.alit(Js.Date.new(m.date))), function(d)
			return d:getTime()
		end), function(d)
			return (sameDay(d, m.date) or (not A.some(w.matches, function(x)
				return (((x.importance ~= 10) and ((x.home == nation) or (x.away == nation))) and sameDay(x.date, d))
			end)))
		end)
		local n = Math.max(1, Js.alen(days))
		local nth = Math.max(0, A.findIndex(days, function(d)
			return sameDay(d, m.date)
		end))
		local bar = s.manager
		local tier = (if (bar >= SURE_START) then 2 else (if (bar >= START_AT) then 1 else 0))
		local STARTS = Js.alit(Js.alit(0, 0, 1, 1), Js.alit(1, 1, 2, 2), Js.alit(1, 2, 2, 3))
		local starts = STARTS[tier + 1][Math.min(n, 4)]
		local rng = M_engine.rngFor(("friendlies|" .. ((function() local _v = wk; if _v == nil then return nil end; _v = _v.key; return _v end)() or m.id) .. "|" .. nation))
		local order = A.map(A.sort(A.map(days, function(_, i)
			return Js.O({ i = i, r = rng() }, { "i", "r" })
		end), function(a, b)
			return (a.r - b.r)
		end), function(x)
			return x.i
		end)
		local start = A.includes(A.slice(order, 0, starts), nth)
		local r = M_engine.rngFor(("friendly-mins|" .. m.id .. "|" .. nation))
		if start then
			local lo = (if (tier == 2) then 65 else 55)
			do return Js.O({ start = start, onAt = 0, offAt = (lo + math.floor((r() * 16))), nth = nth, of = n }, { "start", "onAt", "offAt", "nth", "of" }) end
		end
		do return Js.O({ start = start, onAt = (46 + math.floor((r() * 20))), nth = nth, of = n }, { "start", "onAt", "nth", "of" }) end
	end
	exports.friendlyPlan = friendlyPlan
	intlSelection = function(career, f)
		local s = intlOf(career)
		local bar = s.manager
		local m = (worldOf(career).byId):get((if f.intlId ~= nil then f.intlId else ""))
		local tournament = (if m then A.includes(TOURNAMENT_COMPS, m.comp) else false)
		local nation = s.nation
		local plan = friendlyPlan(career, f)
		if plan then
			local of = (if (plan.of > 1) then (" (friendly " .. Js.numstr((plan.nth + 1)) .. " of " .. Js.numstr(plan.of) .. ")") else "")
			do return (if plan.start then Js.O({ status = "1st Team", onAt = 0, offAt = plan.offAt, reason = ("A friendly" .. of .. ": you start, and the manager plans to change you around " .. Js.str(plan.offAt) .. "'.") }, { "status", "onAt", "offAt", "reason" }) else Js.O({ status = "Substitute", onAt = plan.onAt, reason = ("A friendly" .. of .. ": the manager is looking at other players. You come on around " .. Js.numstr(plan.onAt) .. "'.") }, { "status", "onAt", "reason" })) end
		end
		local start = (bar >= START_AT)
		local why = (if start then ("In the " .. nation .. " side — you start.") else ("On the " .. nation .. " bench."))
		if ((((start and (bar < SURE_START)) and (not tournament)) and (function() local _v = s.last; if _v == nil then return nil end; _v = _v.lost; return _v end)()) and (s.last.rating < 6)) then
			start = false
			why = "Dropped to the bench after the last defeat."
		end
		if start then
			do return Js.O({ status = "1st Team", onAt = 0, reason = why }, { "status", "onAt", "reason" }) end
		end
		local onAt = (if (bar >= 47) then 60 else (if (bar >= 40) then 70 else 80))
		do return Js.O({ status = "Substitute", onAt = onAt, reason = why }, { "status", "onAt", "reason" }) end
	end
	exports.intlSelection = intlSelection
	creditIntl = function(career, f, stats, opts)
		if opts == nil then opts = Js.O({}, nil) end
		local id = f.intlId
		if (not Js.T(id)) then
			do return career end
		end
		local s = intlOf(career)
		if (not stats) then
			do return syncIntl(career) end
		end
		local w = worldOf(career)
		local m = w.byId:get(id)
		local nationHome = (if m then (m.home == s.nation) else f.home)
		local us = stats.homeScore
		local them = stats.awayScore
		local pens = (if stats.shootout then (if (f.home == nationHome) then Js.O({ hs = stats.shootout.home, as = stats.shootout.away }, { "hs", "as" }) else Js.O({ hs = stats.shootout.away, as = stats.shootout.home }, { "hs", "as" })) else nil)
		local res = Js.ospread(Js.O({ hs = (if nationHome then us else them), as = (if nationHome then them else us) }, { "hs", "as" }), (if stats.wentToExtraTime then Js.O({ et = true }, { "et" }) else Js.O({}, nil)), (if pens then Js.O({ pens = pens }, { "pens" }) else Js.O({}, nil)), (if (stats.goals ~= nil) then Js.O({ mine = Js.O({ g = stats.goals, a = (if stats.assists ~= nil then stats.assists else 0) }, { "g", "a" }) }, { "mine" }) else Js.O({}, nil)))
		local won = ((us > them) or (((us == them) and (not (not pens))) and (if nationHome then (pens.hs > pens.as) else (pens.as > pens.hs))))
		local lost = ((us < them) or (((us == them) and (not (not pens))) and (not won)))
		local manager = (if opts.keepManager then s.manager else clamp100(((s.manager + ((stats.rating - 6.6) * 2.5)) + (if won then 1 else (if lost then -1 else 0)))))
		local nextState = Js.ospread(s, Js.O({ played = Js.ospread(s.played, (function() local _o = Js.O({}, nil); _o[Js.key(id)] = res; return _o end)()), manager = (Math.round((manager * 10)) / 10) }, { "played", "manager" }), (if opts.keepManager then Js.O({}, nil) else Js.O({ last = Js.O({ lost = lost, rating = stats.rating }, { "lost", "rating" }) }, { "last" })))
		local after = syncIntl(Js.ospread(career, Js.O({ intl = nextState }, { "intl" })))
		local knockoutMessage = (if after.knockoutMessage ~= nil then after.knockoutMessage else nil)
		if ((m and (A.includes(TOURNAMENT_COMPS, m.comp) or (not Js.T(m.group)))) and (m.comp ~= "International Friendly")) then
			local w2 = worldOf(after)
			local nextMine = A.sort(A.filter((if after.fixtures ~= nil then after.fixtures else Js.alit()), function(x)
				return (function() local _l = ((not x.played) and x.intlId); if Js.T(_l) then return ((function() local _v = w2.byId:get(x.intlId); if _v == nil then return nil end; _v = _v.edition; return _v end)() == m.edition) end; return _l end)()
			end), function(a, b)
				return (a.week - b.week)
			end)[1]
			local fin = A.find(w2.finals, function(x)
				return (x.edition == m.edition)
			end)
			if (fin and (fin.winner == s.nation)) then
				knockoutMessage = ("🏆 " .. s.nation .. " win the " .. m.comp .. "!")
			elseif nextMine then
				knockoutMessage = (s.nation .. " play " .. nextMine.opponent .. " next · " .. Js.str(nextMine.round) .. ".")
			elseif ((not Js.T(m.group)) or (fin and (fin.runnerUp == s.nation))) then
				knockoutMessage = (s.nation .. " are out of the " .. m.comp .. ".")
			end
		end
		do return Js.ospread(after, Js.O({ knockoutMessage = knockoutMessage }, { "knockoutMessage" })) end
	end
	exports.creditIntl = creditIntl
	squadFor = function(career, nation, size, everyone)
		if size == nil then size = 23 end
		local youName = (career.player.firstName .. " " .. career.player.lastName)
		local score = function(p)
			return (p.overall + divisionPenalty((if Js.T(p.club) then M_energy.clubDivision(career, p.club) else nil)))
		end
		local pool = A.sort(A.filter((if everyone ~= nil then everyone else realPlayers(career)), function(p)
			return ((p.nation == nation) and (p.name ~= youName))
		end), function(a, b)
			return (score(b) - score(a))
		end)
		local used = Js.Set.new()
		local slots = (if (size == 26) then SLOTS_26 else SLOTS_23)
		local nat = M_nations.nationFor(nation)
		local xi = ((function() local _v = (intlOf(career).xi)[Js.key(career.season)]; if _v == nil then return nil end; _v = _v[nation]; return _v end)() or 0)
		local level = expectedXi((M_nations.rankingStrength(((function() local _v = nat; if _v == nil then return nil end; _v = _v.points; return _v end)() or 1192)) + xi))
		local filler = M_squadData.generateSquad(M_squadData.clubNameSeed(("nation|" .. nation)))
		local names = A.filter(M_nationNames.madeUpNames(nation, (Js.alen(slots) + 2)), function(n)
			return (n ~= youName)
		end)
		do return A.map(slots, function(pos, i)
			local pick = A.find(pool, function(p)
				return ((not used:has(p.name)) and ((p.position == pos) or (function() local _r = p.positions; if _r == nil then return nil end; return A.includes(_r, pos) end)()))
			end)
			if pick then
				used:add(pick.name)
				do return Js.O({ id = ("intl_" .. nation .. "_" .. pick.name), name = pick.name, shortName = A.slice(S.split(pick.name, " "), -1)[1], position = pos, seasonGoals = 0, seasonAssists = 0, careerGoals = 0, careerAssists = 0, overall = pick.overall, imageUrl = pick.image, nationality = nation, age = pick.age, positions = pick.positions }, { "id", "name", "shortName", "position", "seasonGoals", "seasonAssists", "careerGoals", "careerAssists", "overall", "imageUrl", "nationality", "age", "positions" }) end
			end
			local g = filler[math.fmod(i, Js.alen(filler)) + 1]
			local id = ("intl_gen_" .. nation .. "_" .. Js.numstr(i))
			local name = (if names[i + 1] ~= nil then names[i + 1] else g.name)
			do return Js.ospread(g, Js.O({ id = id, name = name, shortName = A.slice(S.split(name, " "), -1)[1], position = pos, nationality = nation, overall = Math.round(Math.max(40, Math.min(92, (((level - (if (i < 11) then 1 else 5)) + math.fmod((i * 7), 5)) - 2)))), imageUrl = M_fakeFaces.fakeFaceFor((nation .. ":" .. id)) }, { "id", "name", "shortName", "position", "nationality", "overall", "imageUrl" })) end
		end) end
	end
	exports.squadFor = squadFor
	squadAsLeague = function(career, nation)
		do return A.map(squadFor(career, nation), function(p)
			return Js.O({ id = ("opp_" .. p.id), name = p.name, position = p.position, overall = (if p.overall ~= nil then p.overall else 65), goals = 0, assists = 0, image = p.imageUrl, nation = nation, age = p.age, positions = p.positions }, { "id", "name", "position", "overall", "goals", "assists", "image", "nation", "age", "positions" })
		end) end
	end
	exports.squadAsLeague = squadAsLeague
	whoWon = function(career)
		local w = worldOf(career)
		do return A.reverse(A.map(w.finals, function(f)
			return Js.O({ year = f.year, comp = f.comp, winner = f.winner, runnerUp = f.runnerUp, score = (Js.numstr((if (f.home == f.winner) then f.hs else f.as)) .. "-" .. Js.numstr((if (f.home == f.winner) then f.as else f.hs)) .. (if f.et then " aet" else "") .. (if f.pens then (" (" .. Js.numstr(Math.max(f.pens.hs, f.pens.as)) .. "-" .. Js.numstr(Math.min(f.pens.hs, f.pens.as)) .. " pens)") else "")) }, { "year", "comp", "winner", "runnerUp", "score" })
		end)) end
	end
	exports.whoWon = whoWon
	nationStrengthNow = function(career, nation)
		local w = worldOf(career)
		do return Math.round(w:strength(nation, w.now)) end
	end
	exports.nationStrengthNow = nationStrengthNow
	myGroups = function(career, max)
		if max == nil then max = 2 end
		local w = worldOf(career)
		local nation = intlOf(career).nation
		local seen = Js.Set.new()
		local out = Js.alit()
		local mine = A.sort(A.filter(w.matches, function(m)
			return (function() local _l = (if Js.T(m.group) then ((m.home == nation) or (m.away == nation)) else m.group); if Js.T(_l) then return M_engine.played(m) end; return _l end)()
		end), function(a, b)
			return (b.date - a.date)
		end)
		do
			local _arr40 = mine
			local _i41 = 0
			while _i41 < Js.alen(_arr40) do
				_i41 += 1
				local m = _arr40[_i41]
				local k = (m.edition .. "|" .. Js.str(m.group))
				if seen:has(k) then
					do continue end
				end
				seen:add(k)
				local ms = A.filter(w:edition(m.edition), function(x)
					return (x.group == m.group)
				end)
				local teams = Js.Array.from(Js.Set.new(A.flatMap(ms, function(x)
					return Js.alit(x.home, x.away)
				end)))
				local tie = (if ((((m.comp == "World Cup") or (m.comp == "Copa América")) or S.startsWith(m.comp, "Gold")) or (m.comp == "CONCACAF Nations League")) then "overall" else "h2h")
				local rows = A.map(M_engine.table(teams, ms, tie, w.rankOf), function(r)
					return Js.O({ name = r.name, p = r.p, w = r.w, d = r.d, l = r.l, gd = (r.gf - r.ga), pts = r.pts }, { "name", "p", "w", "d", "l", "gd", "pts" })
				end)
				local stage = S.split(m.stage, " · ")[1]
				A.push(out, Js.O({ title = (m.comp .. " " .. Js.numstr(Js.Date.new(Math.max(Js.unpack(A.map(ms, function(x)
					return x.date
				end)))):getUTCFullYear()) .. " · " .. stage), rows = rows }, { "title", "rows" }))
				if (Js.alen(out) >= max) then
					do break end
				end
			end
		end
		do return out end
	end
	exports.myGroups = myGroups
	myMatches = function(career)
		local w = worldOf(career)
		local nation = intlOf(career).nation
		local all = A.sort(A.filter(w.matches, function(m)
			return ((m.home == nation) or (m.away == nation))
		end), function(a, b)
			return (a.date - b.date)
		end)
		local view = function(m)
			return Js.ospread(Js.O({ id = m.id, date = m.date, comp = m.comp, stage = m.stage, home = m.home, away = m.away, hs = m.hs, as = m.as }, { "id", "date", "comp", "stage", "home", "away", "hs", "as" }), (if m.pens then Js.O({ pens = (Js.numstr(m.pens.hs) .. "-" .. Js.numstr(m.pens.as) .. " pens") }, { "pens" }) else Js.O({}, nil)))
		end
		do return Js.O({ last = A.map(A.reverse(A.slice(A.filter(all, M_engine.played), -5)), view), next = A.map(A.slice(A.filter(all, function(m)
			return (not M_engine.played(m))
		end), 0, 4), view) }, { "last", "next" }) end
	end
	exports.myMatches = myMatches
	myRanking = function(career)
		local w = worldOf(career)
		local nation = intlOf(career).nation
		do return Js.O({ nation = nation, rank = w.rankOf(nation), points = Math.round((w.points:get(nation) or 0)) }, { "nation", "rank", "points" }) end
	end
	exports.myRanking = myRanking
	topRanking = function(career, n)
		if n == nil then n = 10 end
		local w = worldOf(career)
		do return A.map(A.slice(w:ranking(), 0, n), function(name)
			return Js.O({ name = name, points = Math.round((w.points:get(name) or 0)) }, { "name", "points" })
		end) end
	end
	exports.topRanking = topRanking
	dutyNow = function(career)
		if ((not career.intl) or (not Js.T((function() local _v = career.fixtures; if _v == nil then return nil end; _v = Js.len(_v); return _v end)()))) then
			do return nil end
		end
		local s = career.intl
		local next_ = nil
		local nt = math.huge
		do
			local _arr42 = career.fixtures
			local _i43 = 0
			while _i43 < Js.alen(_arr42) do
				_i43 += 1
				local f = _arr42[_i43]
				if f.played then
					do continue end
				end
				local t = ts(career, f)
				if (t < nt) then
					nt = t
					next_ = f
				end
			end
		end
		if ((not next_) or next_.watch) then
			do return nil end
		end
		if ((next_.kind ~= "international") and (not Js.T(awayOnDuty(career, next_)))) then
			do return nil end
		end
		local w = worldOf(career)
		local p = A.find(periodsFrom(w, s.nation, (nt - (60 * DAY))), function(x)
			return (if Js.T(next_.intlId) then A.some(x.matches, function(m)
				return (m.id == next_.intlId)
			end) else ((nt >= x.start) and (nt <= x["end"])))
		end)
		if ((not p) or (not (function() local _v = s.periods[p.key]; if _v == nil then return nil end; _v = _v.called; return _v end)())) then
			do return nil end
		end
		local done = function(m)
			return (M_engine.played(m) or (not (not s.played[m.id])))
		end
		do return Js.O({ nation = s.nation, period = p, played = Js.alen(A.filter(p.matches, done)), total = Js.alen(p.matches) }, { "nation", "period", "played", "total" }) end
	end
	exports.dutyNow = dutyNow
	groupOf = function(career, m)
		if (not Js.T(m.group)) then
			do return nil end
		end
		local w = worldOf(career)
		local ms = A.filter(w:edition(m.edition), function(x)
			return (x.group == m.group)
		end)
		local teams = Js.Array.from(Js.Set.new(A.flatMap(ms, function(x)
			return Js.alit(x.home, x.away)
		end)))
		local tie = (if ((((m.comp == "World Cup") or (m.comp == "Copa América")) or S.startsWith(m.comp, "Gold")) or (m.comp == "CONCACAF Nations League")) then "overall" else "h2h")
		local rows = A.map(M_engine.table(teams, ms, tie, w.rankOf), function(r)
			return Js.O({ name = r.name, p = r.p, w = r.w, d = r.d, l = r.l, gd = (r.gf - r.ga), pts = r.pts }, { "name", "p", "w", "d", "l", "gd", "pts" })
		end)
		do return Js.O({ title = (m.comp .. " · " .. S.replace(m.stage, Js.re(" · Matchday \\d+", ""), "")), rows = rows }, { "title", "rows" }) end
	end
	exports.groupOf = groupOf
	roundsOf = function(career, p)
		local w = worldOf(career)
		local nation = intlOf(career).nation
		local sameDay = function(a, b)
			return (math.abs((a - b)) < (12 * 3600000))
		end
		do return A.map(A.map(p.matches, function(m)
			local others = (if (m.comp == "International Friendly") then Js.alit() else A.filter(w:edition(m.edition), function(x)
				return (((x.id ~= m.id) and sameDay(x.date, m.date)) and (if Js.T(m.group) then (S.split(S.split(x.stage, " · ")[1], " Group")[1] == S.split(S.split(m.stage, " · ")[1], " Group")[1]) else (not Js.T(x.group))))
			end))
			local sorted = A.slice(A.sort(others, function(a, b)
				return (Js.Number(((not (not Js.T(b.group))) and (b.group == m.group))) - Js.Number(((not (not Js.T(a.group))) and (a.group == m.group))))
			end), 0, 15)
			local mine = Js.ospread(viewOf(m), (if (function() local _v = career.intl; if _v == nil then return nil end; _v = _v.played; _v = _v[m.id]; return _v end)() then Js.O({ hs = career.intl.played[m.id].hs, as = career.intl.played[m.id].as }, { "hs", "as" }) else Js.O({}, nil)))
			local md = (function() local _v = S.match(m.stage, Js.re("Matchday \\d+", "")); if _v == nil then return nil end; _v = _v[1]; return _v end)()
			do return Js.O({ date = m.date, title = (m.comp .. " · " .. (if md ~= nil then md else m.stage)), matches = Js.aspread(Js.alit(mine), A.map(sorted, viewOf)) }, { "date", "title", "matches" }) end
		end), function(r)
			return Js.ospread(r, Js.O({ matches = A.map(r.matches, function(x)
				return Js.ospread(x, Js.O({ mine = ((x.home == nation) or (x.away == nation)) }, { "mine" }))
			end) }, { "matches" }))
		end) end
	end
	exports.roundsOf = roundsOf
	DAY = 86400000
	SQUAD_AT = 34
	exports.SQUAD_AT = SQUAD_AT
	START_AT = 55
	exports.START_AT = START_AT
	SURE_START = 75
	TOURNAMENT_COMPS = Js.alit("World Cup", "European Championship", "Copa América", "Africa Cup of Nations", "Asian Cup", "Gold Cup", "OFC Nations Cup")
	exports.TOURNAMENT_COMPS = TOURNAMENT_COMPS
	PENALTY = Js.O({ premier = 0, championship = -4, league_one = -8, league_two = -11, national_league = -14, national_league_north = -14, national_league_south = -14 }, { "premier", "championship", "league_one", "league_two", "national_league", "national_league_north", "national_league_south" })
	WINDOW_NAMES = Js.O({ sepoct = "September–October", nov = "November", mar = "March", jun = "June" }, { "sepoct", "nov", "mar", "jun" })
	COMP_NAMES = Js.O({ ["World Cup"] = "World Cup", ["World Cup Qualifier"] = "World Cup Qualifier", ["World Cup Play-Off"] = "World Cup Play-Off", ["European Championship"] = "European Championship", ["Euro Qualifier"] = "Euro Qualifier", ["Nations League"] = "Nations League", ["Copa América"] = "Copa América", ["Africa Cup of Nations"] = "Africa Cup of Nations", ["AFCON Qualifier"] = "AFCON Qualifier", ["Asian Cup"] = "Asian Cup", ["Asian Cup Qualifier"] = "Asian Cup Qualifier", ["Gold Cup"] = "Gold Cup", ["Gold Cup Qualifier"] = "Gold Cup Qualifier", ["CONCACAF Nations League"] = "CONCACAF Nations League", ["OFC Nations Cup"] = "OFC Nations Cup", ["International Friendly"] = "International Friendly" }, { "World Cup", "World Cup Qualifier", "World Cup Play-Off", "European Championship", "Euro Qualifier", "Nations League", "Copa América", "Africa Cup of Nations", "AFCON Qualifier", "Asian Cup", "Asian Cup Qualifier", "Gold Cup", "Gold Cup Qualifier", "CONCACAF Nations League", "OFC Nations Cup", "International Friendly" })
	SLOTS_23 = Js.alit("GK", "GK", "GK", "CB", "CB", "CB", "CB", "LB", "RB", "LB", "RB", "CDM", "CM", "CM", "CM", "CAM", "LW", "RW", "LW", "RW", "ST", "ST", "ST")
	SLOTS_26 = Js.aspread(SLOTS_23, Js.alit("CB", "CM", "ST"))
	viewOf = function(m)
		return Js.ospread(Js.O({ id = m.id, date = m.date, comp = m.comp, stage = m.stage, home = m.home, away = m.away, hs = m.hs, as = m.as }, { "id", "date", "comp", "stage", "home", "away", "hs", "as" }), (if m.pens then Js.O({ pens = (Js.numstr(m.pens.hs) .. "-" .. Js.numstr(m.pens.as) .. " pens") }, { "pens" }) else Js.O({}, nil)))
	end
	exports.loserOf = M_engine.loserOf
end
