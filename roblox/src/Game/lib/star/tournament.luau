--!nocheck
--!nolint
-- Generated from lib/star/tournament.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_international = import("lib/star/international")
	local M_season = import("lib/star/season")
	local M_squadData = import("lib/star/squadData")
	local M_cups = import("lib/star/cups")
	local M_shootout = import("lib/star/shootout")
	local M_competitions = import("lib/star/competitions")
	local M_calendar = import("lib/star/calendar")
	local KO_ROUNDS, ALIASES, canon, EURO_POOL, REST_POOL, EXTRA_STRENGTH, tournamentStrength, qualify, tournamentField, drawGroups, groupTable, yourGroup, score, playTie, playMatchday, qualifiers, drawRoundOf16, nextKoRound, playKoRound, finishTournament, capsThisSeason, tournamentSquadChance, openTournament, hasOldRun, tournamentDue, tournamentWeek, groupFixture, koFixture, rngFor, applyTournament, exitOf, isTournamentFixture, settleTournamentMatch, ordinal
	tournamentStrength = function(nation)
		do return (((if M_international.NATION_STRENGTH[nation] ~= nil then M_international.NATION_STRENGTH[nation] else M_international.NATION_STRENGTH[canon(nation)]) or EXTRA_STRENGTH[canon(nation)]) or 60) end
	end
	exports.tournamentStrength = tournamentStrength
	qualify = function(pool, n, rng)
		do return A.map(A.slice(A.sort(A.map(pool, function(name)
			return Js.O({ name = name, score = (tournamentStrength(name) + ((((rng() + rng()) + rng()) - 1.5) * 5)) }, { "name", "score" })
		end), function(a, b)
			return (b.score - a.score)
		end), 0, n), function(x)
			return x.name
		end) end
	end
	tournamentField = function(competition, season, yourNation)
		local rng = M_season.mulberry32(M_squadData.clubNameSeed(("field|" .. competition .. "|" .. Js.numstr(season))))
		local you = canon(yourNation)
		local euro = (if (A.includes(EURO_POOL, you) or (not M_international.EUROPEAN:has(yourNation))) then EURO_POOL else Js.aspread(EURO_POOL, Js.alit(you)))
		local rest = (if ((A.includes(REST_POOL, you) or M_international.EUROPEAN:has(yourNation)) or A.includes(EURO_POOL, you)) then REST_POOL else Js.aspread(REST_POOL, Js.alit(you)))
		local field = (if (competition == "World Cup") then Js.aspread(qualify(euro, 16, rng), qualify(rest, 16, rng)) else qualify(euro, 24, rng))
		do return A.map(field, function(n)
			return (if (n == you) then yourNation else n)
		end) end
	end
	exports.tournamentField = tournamentField
	drawGroups = function(field, rng)
		local groupCount = (Js.alen(field) / 4)
		local ranked = A.sort(Js.aspread(field), function(a, b)
			return (tournamentStrength(b) - tournamentStrength(a))
		end)
		local pots = A.map(Js.alit(0, 1, 2, 3), function(i)
			return M_cups.shuffle(A.slice(ranked, (i * groupCount), ((i + 1) * groupCount)), rng)
		end)
		do return Js.Array.from(Js.O({ length = groupCount }, { "length" }), function(_, g)
			local teams = A.map(pots, function(p)
				return p[g + 1]
			end)
			local _d1 = teams
			local a = _d1[1]
			local b = _d1[2]
			local c = _d1[3]
			local d = _d1[4]
			do return Js.O({ name = Js.fromCharCode((65 + g)), teams = teams, matches = Js.alit(Js.O({ md = 1, home = a, away = b }, { "md", "home", "away" }), Js.O({ md = 1, home = c, away = d }, { "md", "home", "away" }), Js.O({ md = 2, home = a, away = c }, { "md", "home", "away" }), Js.O({ md = 2, home = d, away = b }, { "md", "home", "away" }), Js.O({ md = 3, home = d, away = a }, { "md", "home", "away" }), Js.O({ md = 3, home = b, away = c }, { "md", "home", "away" })) }, { "name", "teams", "matches" }) end
		end) end
	end
	exports.drawGroups = drawGroups
	groupTable = function(group)
		local rows = Js.Map.new(A.map(group.teams, function(t)
			return Js.alit(t, Js.O({ name = t, p = 0, w = 0, d = 0, l = 0, gf = 0, ga = 0, pts = 0 }, { "name", "p", "w", "d", "l", "gf", "ga", "pts" }))
		end))
		do
			local _arr2 = group.matches
			local _i3 = 0
			while _i3 < Js.alen(_arr2) do
				_i3 += 1
				local m = _arr2[_i3]
				if ((m.hs == nil) or (m.as == nil)) then
					do continue end
				end
				local h = rows:get(m.home)
				local a = rows:get(m.away)
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
		end
		do return A.sort(Js.Array.from(rows:values()), function(x, y)
			return (function() local _l = (function() local _l = (function() local _l = (function() local _l = (y.pts - x.pts); if Js.T(_l) then return _l end; return ((y.gf - y.ga) - (x.gf - x.ga)) end)(); if Js.T(_l) then return _l end; return (y.gf - x.gf) end)(); if Js.T(_l) then return _l end; return (tournamentStrength(y.name) - tournamentStrength(x.name)) end)(); if Js.T(_l) then return _l end; return S.localeCompare(x.name, y.name) end)()
		end) end
	end
	exports.groupTable = groupTable
	yourGroup = function(state)
		do return (A.find(state.groups, function(g)
			return A.includes(g.teams, state.nation)
		end) or nil) end
	end
	exports.yourGroup = yourGroup
	score = function(state, home, away, rng)
		do return M_shootout.ninetyMinuteScore(((if state.strengths[home] ~= nil then state.strengths[home] else 60) - 3), (if state.strengths[away] ~= nil then state.strengths[away] else 60), rng) end
	end
	playTie = function(state, tie, rng)
		local hStr = (if state.strengths[tie.home] ~= nil then state.strengths[tie.home] else 60)
		local aStr = (if state.strengths[tie.away] ~= nil then state.strengths[tie.away] else 60)
		local s = score(state, tie.home, tie.away, rng)
		local out = Js.ospread(tie, Js.O({ hs = s.hs, as = s.as }, { "hs", "as" }))
		if (s.hs == s.as) then
			local et = M_shootout.extraTimeScore((hStr - 3), aStr, rng)
			out.wentToExtraTime = true
			out.hs += et.hs
			out.as += et.as
			if (out.hs == out.as) then
				local p = M_shootout.simulateShootout(hStr, aStr, rng)
				out.pens = Js.O({ home = p.home, away = p.away }, { "home", "away" })
			end
		end
		do return out end
	end
	playMatchday = function(state, md, rng)
		local groups = A.map(state.groups, function(g)
			return Js.ospread(g, Js.O({ matches = A.map(g.matches, function(m)
				if ((m.md ~= md) or (m.hs ~= nil)) then
					do return m end
				end
				local s = score(state, m.home, m.away, rng)
				do return Js.ospread(m, Js.O({ hs = s.hs, as = s.as }, { "hs", "as" })) end
			end) }, { "matches" }))
		end)
		do return Js.ospread(state, Js.O({ groups = groups, matchday = Math.max(state.matchday, md) }, { "groups", "matchday" })) end
	end
	exports.playMatchday = playMatchday
	qualifiers = function(state)
		local tables = A.map(state.groups, function(g)
			return Js.O({ g = g.name, t = groupTable(g) }, { "g", "t" })
		end)
		local firsts = A.map(tables, function(x)
			return Js.O({ name = x.t[1].name, group = x.g, place = 1 }, { "name", "group", "place" })
		end)
		local seconds = A.map(tables, function(x)
			return Js.O({ name = x.t[2].name, group = x.g, place = 2 }, { "name", "group", "place" })
		end)
		local out = Js.aspread(firsts, seconds)
		if (Js.alen(out) < 16) then
			local thirds = A.map(A.slice(A.sort(A.map(tables, function(x)
				return Js.O({ row = x.t[3], group = x.g }, { "row", "group" })
			end), function(a, b)
				return (function() local _l = (function() local _l = (function() local _l = (b.row.pts - a.row.pts); if Js.T(_l) then return _l end; return ((b.row.gf - b.row.ga) - (a.row.gf - a.row.ga)) end)(); if Js.T(_l) then return _l end; return (b.row.gf - a.row.gf) end)(); if Js.T(_l) then return _l end; return (tournamentStrength(b.row.name) - tournamentStrength(a.row.name)) end)()
			end), 0, (16 - Js.alen(out))), function(x)
				return Js.O({ name = x.row.name, group = x.group, place = 3 }, { "name", "group", "place" })
			end)
			A.push(out, Js.unpack(thirds))
		end
		do return out end
	end
	exports.qualifiers = qualifiers
	drawRoundOf16 = function(state, rng)
		local q = qualifiers(state)
		local winners = A.filter(q, function(x)
			return (x.place == 1)
		end)
		local others = A.sort(M_cups.shuffle(A.filter(q, function(x)
			return (x.place ~= 1)
		end), rng), function(a, b)
			return (a.place - b.place)
		end)
		local ties = Js.alit()
		do
			local _arr4 = winners
			local _i5 = 0
			while _i5 < Js.alen(_arr4) do
				_i5 += 1
				local w = _arr4[_i5]
				local i = A.findIndex(others, function(o)
					return (o.group ~= w.group)
				end)
				local o = A.splice(others, (if (i >= 0) then i else 0), 1)[1]
				A.push(ties, Js.O({ home = w.name, away = o.name }, { "home", "away" }))
			end
		end
		while (Js.alen(others) >= 2) do
			local a = A.shift(others)
			local i = A.findIndex(others, function(o)
				return (o.group ~= a.group)
			end)
			local b = A.splice(others, (if (i >= 0) then i else 0), 1)[1]
			A.push(ties, Js.O({ home = a.name, away = b.name }, { "home", "away" }))
		end
		do return Js.O({ name = KO_ROUNDS[1], ties = ties }, { "name", "ties" }) end
	end
	nextKoRound = function(state)
		local last = state.ko[Js.alen(state.ko)]
		local winners = A.filter(A.map(last.ties, M_cups.tieWinner), function(w)
			return (not (not Js.T(w)))
		end)
		if (Js.alen(winners) == 1) then
			do return Js.ospread(state, Js.O({ winner = winners[1] }, { "winner" })) end
		end
		local ties = Js.alit()
		do
			local i = 0
			local _first6 = true
			while true do
				if not _first6 then
					i += 2
				end
				_first6 = false
				if not ((i + 1) < Js.alen(winners)) then break end
				A.push(ties, Js.O({ home = winners[i + 1], away = winners[(i + 1) + 1] }, { "home", "away" }))
			end
		end
		do return Js.ospread(state, Js.O({ ko = Js.aspread(state.ko, Js.alit(Js.O({ name = KO_ROUNDS[Js.alen(state.ko) + 1], ties = ties }, { "name", "ties" }))) }, { "ko" })) end
	end
	playKoRound = function(state, rng)
		local ko = Js.aspread(state.ko)
		local round = ko[Js.alen(ko)]
		A.set(ko, (Js.alen(ko) - 1), Js.ospread(round, Js.O({ ties = A.map(round.ties, function(t)
			return (if (t.hs ~= nil) then t else playTie(state, t, rng))
		end) }, { "ties" })))
		do return nextKoRound(Js.ospread(state, Js.O({ ko = ko }, { "ko" }))) end
	end
	finishTournament = function(state, rng)
		local s = state
		do
			local md = (s.matchday + 1)
			local _first7 = true
			while true do
				if not _first7 then
					md += 1
				end
				_first7 = false
				if not (md <= 3) then break end
				s = playMatchday(s, md, rng)
			end
		end
		if ((Js.alen(s.ko) == 0) and (not Js.T(s.winner))) then
			s = Js.ospread(s, Js.O({ ko = Js.alit(drawRoundOf16(s, rng)) }, { "ko" }))
		end
		do
			local guard = 0
			local _first8 = true
			while true do
				if not _first8 then
					guard += 1
				end
				_first8 = false
				if not ((guard < 6) and (not Js.T(s.winner))) then break end
				s = playKoRound(s, rng)
			end
		end
		do return s end
	end
	exports.finishTournament = finishTournament
	capsThisSeason = function(career)
		do return Js.alen(A.filter(((function() local _v = career.international; if _v == nil then return nil end; _v = _v.matches; return _v end)() or Js.alit()), function(m)
			return (m.season == career.season)
		end)) end
	end
	tournamentSquadChance = function(career)
		local base = M_international.callUpChance(career)
		if (base <= 0) then
			do return 0 end
		end
		local p = Math.max(0.0001, Math.min(0.9999, base))
		local logit = (Math.log((p / (1 - p))) + (0.45 * Math.min(4, capsThisSeason(career))))
		do return Math.max(0.02, Math.min(0.98, (1 / (1 + Math.exp((-logit)))))) end
	end
	exports.tournamentSquadChance = tournamentSquadChance
	openTournament = function(career)
		local competition = M_competitions.tournamentFor(career.season)
		if (not Js.T(competition)) then
			do return nil end
		end
		local nation = M_competitions.nationOf(career)
		local field = tournamentField(competition, career.season, nation)
		local rng = M_season.mulberry32(M_squadData.clubNameSeed(("groups|" .. competition .. "|" .. Js.numstr(career.season))))
		local groups = drawGroups(field, rng)
		local entered = A.includes(field, nation)
		local chance = (if entered then tournamentSquadChance(career) else 0)
		local pick = M_season.mulberry32(M_squadData.clubNameSeed(("squad|" .. career.player.firstName .. " " .. career.player.lastName .. "|" .. Js.numstr(career.season))))
		local selected = (entered and (pick() < chance))
		local strengths = Js.O({}, nil)
		do
			local _arr9 = field
			local _i10 = 0
			while _i10 < Js.alen(_arr9) do
				_i10 += 1
				local n = _arr9[_i10]
				strengths[n] = tournamentStrength(n)
			end
		end
		do return Js.O({ season = career.season, competition = competition, nation = nation, entered = entered, selected = selected, chance = chance, strengths = strengths, groups = groups, matchday = 0, ko = Js.alit() }, { "season", "competition", "nation", "entered", "selected", "chance", "strengths", "groups", "matchday", "ko" }) end
	end
	exports.openTournament = openTournament
	hasOldRun = function(career)
		do return A.some((if career.cups ~= nil then career.cups else Js.alit()), function(r)
			return (r.kind == "international")
		end) end
	end
	tournamentDue = function(career)
		if ((not Js.T((function() local _v = career.player; if _v == nil then return nil end; _v = _v.club; return _v end)())) or (not Js.T((function() local _v = career.fixtures; if _v == nil then return nil end; _v = Js.len(_v); return _v end)()))) then
			do return false end
		end
		if ((not Js.T(M_competitions.tournamentFor(career.season))) or hasOldRun(career)) then
			do return false end
		end
		if ((function() local _v = career.tournament; if _v == nil then return nil end; _v = _v.season; return _v end)() == career.season) then
			do return false end
		end
		do return A.every(career.fixtures, function(f)
			return f.played
		end) end
	end
	exports.tournamentDue = tournamentDue
	tournamentWeek = function(division, i)
		do return M_calendar.postSeasonFor(division, ((if (division == "premier") then 3 else 6) + i)) end
	end
	exports.tournamentWeek = tournamentWeek
	groupFixture = function(career, state, md)
		local g = yourGroup(state)
		local m = (function() local _r = (function() local _v = g; if _v == nil then return nil end; _v = _v.matches; return _v end)(); if _r == nil then return nil end; return A.find(_r, function(x)
			return ((x.md == md) and ((x.home == state.nation) or (x.away == state.nation)))
		end) end)()
		if ((not g) or (not m)) then
			do return nil end
		end
		local opponent = (if (m.home == state.nation) then m.away else m.home)
		do return Js.O({ week = tournamentWeek(M_calendar.divisionOf(career), (md - 1)), opponent = opponent, home = (m.home == state.nation), played = false, competition = state.competition, kind = "international", round = ("Group " .. g.name .. " · Match " .. Js.numstr(md)), opponentStrength = state.strengths[opponent] }, { "week", "opponent", "home", "played", "competition", "kind", "round", "opponentStrength" }) end
	end
	koFixture = function(career, state)
		local round = state.ko[Js.alen(state.ko)]
		local tie = (function() local _r = (function() local _v = round; if _v == nil then return nil end; _v = _v.ties; return _v end)(); if _r == nil then return nil end; return A.find(_r, function(t)
			return ((t.home == state.nation) or (t.away == state.nation))
		end) end)()
		if (((not round) or (not tie)) or (tie.hs ~= nil)) then
			do return nil end
		end
		local opponent = (if (tie.home == state.nation) then tie.away else tie.home)
		do return Js.O({ week = tournamentWeek(M_calendar.divisionOf(career), ((3 + Js.alen(state.ko)) - 1)), opponent = opponent, home = (tie.home == state.nation), played = false, competition = state.competition, kind = "international", round = round.name, opponentStrength = state.strengths[opponent] }, { "week", "opponent", "home", "played", "competition", "kind", "round", "opponentStrength" }) end
	end
	rngFor = function(state, salt)
		do return M_season.mulberry32(M_squadData.clubNameSeed(("play|" .. state.competition .. "|" .. Js.numstr(state.season) .. "|" .. Js.numstr(salt)))) end
	end
	applyTournament = function(career, state)
		if (state.entered and state.selected) then
			local f = groupFixture(career, state, 1)
			if f then
				do return Js.ospread(career, Js.O({ tournament = state, fixtures = Js.aspread(career.fixtures, Js.alit(f)) }, { "tournament", "fixtures" })) end
			end
		end
		local done = finishTournament(state, rngFor(state, 99))
		do return Js.ospread(career, Js.O({ tournament = Js.ospread(done, Js.O({ yourExit = (if state.entered then exitOf(done) else nil) }, { "yourExit" })) }, { "tournament" })) end
	end
	exports.applyTournament = applyTournament
	exitOf = function(state)
		if (state.winner == state.nation) then
			do return "Winners" end
		end
		for i = (Js.alen(state.ko) - 1), 0, -1 do
			local tie = A.find(state.ko[i + 1].ties, function(t)
				return ((t.home == state.nation) or (t.away == state.nation))
			end)
			if tie then
				do return state.ko[i + 1].name end
			end
		end
		do return "Group Stage" end
	end
	isTournamentFixture = function(career, fixture)
		local t = career.tournament
		do return ((((((fixture.kind == "international") and (not (not Js.T(fixture.round)))) and (not (not t))) and (t.season == career.season)) and (fixture.competition == t.competition)) and (not Js.T(t.winner))) end
	end
	exports.isTournamentFixture = isTournamentFixture
	settleTournamentMatch = function(career, fixture, result)
		if (not isTournamentFixture(career, fixture)) then
			do return nil end
		end
		local s = career.tournament
		local nation = s.nation
		local rng = rngFor(s, fixture.week)
		if S.startsWith(fixture.round, "Group") then
			local md = (s.matchday + 1)
			local g = yourGroup(s)
			local groups = A.map(s.groups, function(gr)
				return (if (gr ~= g) then gr else Js.ospread(gr, Js.O({ matches = A.map(gr.matches, function(m)
					if ((m.md ~= md) or ((m.home ~= nation) and (m.away ~= nation))) then
						do return m end
					end
					if (not result) then
						local sc = score(s, m.home, m.away, rng)
						do return Js.ospread(m, Js.O({ hs = sc.hs, as = sc.as }, { "hs", "as" })) end
					end
					do return Js.ospread(m, Js.O({ hs = (if (m.home == nation) then result.us else result.them), as = (if (m.home == nation) then result.them else result.us) }, { "hs", "as" })) end
				end) }, { "matches" })))
			end)
			s = playMatchday(Js.ospread(s, Js.O({ groups = groups }, { "groups" })), md, rng)
			local row = groupTable(yourGroup(s))
			local place = (A.findIndex(row, function(r)
				return (r.name == nation)
			end) + 1)
			if (md < 3) then
				do return Js.O({ state = s, nextFixture = groupFixture(career, s, (md + 1)), trophy = nil, message = (nation .. " sit " .. ordinal(place) .. " in Group " .. g.name .. " after " .. Js.numstr(md) .. " game" .. (if (md > 1) then "s" else "") .. ".") }, { "state", "nextFixture", "trophy", "message" }) end
			end
			s = Js.ospread(s, Js.O({ ko = Js.alit(drawRoundOf16(s, rng)) }, { "ko" }))
			if A.some(qualifiers(s), function(q)
				return (q.name == nation)
			end) then
				do return Js.O({ state = s, nextFixture = koFixture(career, s), trophy = nil, message = (nation .. " finish " .. ordinal(place) .. " in Group " .. g.name .. " — into the Round of 16.") }, { "state", "nextFixture", "trophy", "message" }) end
			end
			local done = finishTournament(s, rng)
			do return Js.O({ state = Js.ospread(done, Js.O({ yourExit = "Group Stage" }, { "yourExit" })), nextFixture = nil, trophy = nil, message = (nation .. " finish " .. ordinal(place) .. " in Group " .. g.name .. " and go home. " .. Js.str(done.winner) .. " win the " .. s.competition .. ".") }, { "state", "nextFixture", "trophy", "message" }) end
		end
		local ko = Js.aspread(s.ko)
		local round = ko[Js.alen(ko)]
		local tie = A.find(round.ties, function(t)
			return ((t.home == nation) or (t.away == nation))
		end)
		local played = nil
		if (not result) then
			played = playTie(s, tie, rng)
		else
			local youHome = (tie.home == nation)
			played = Js.ospread(tie, Js.O({ hs = (if youHome then result.us else result.them), as = (if youHome then result.them else result.us) }, { "hs", "as" }))
			if result.extraTime then
				played.wentToExtraTime = true
			end
			if (played.hs == played.as) then
				played.pens = (if result.pens ~= nil then result.pens else (function()
					local p = M_shootout.simulateShootout((if s.strengths[tie.home] ~= nil then s.strengths[tie.home] else 60), (if s.strengths[tie.away] ~= nil then s.strengths[tie.away] else 60), rng)
					do return Js.O({ home = p.home, away = p.away }, { "home", "away" }) end
				end)())
			end
		end
		local others = A.map(round.ties, function(t)
			return (if (t == tie) then played else (if (t.hs ~= nil) then t else playTie(s, t, rng)))
		end)
		A.set(ko, (Js.alen(ko) - 1), Js.ospread(round, Js.O({ ties = others }, { "ties" })))
		s = nextKoRound(Js.ospread(s, Js.O({ ko = ko }, { "ko" })))
		local won = (M_cups.tieWinner(played) == nation)
		local pens = (if played.pens then " on penalties" else "")
		if (not won) then
			local done = finishTournament(s, rng)
			do return Js.O({ state = Js.ospread(done, Js.O({ yourExit = round.name }, { "yourExit" })), nextFixture = nil, trophy = nil, message = (nation .. " are out of the " .. s.competition .. " in the " .. round.name .. pens .. ". " .. Js.str(done.winner) .. " go on to win it.") }, { "state", "nextFixture", "trophy", "message" }) end
		end
		if (s.winner == nation) then
			do return Js.O({ state = Js.ospread(s, Js.O({ yourExit = "Winners" }, { "yourExit" })), nextFixture = nil, trophy = Js.O({ season = career.season, competition = s.competition, club = nation }, { "season", "competition", "club" }), message = ("🏆 " .. nation .. " win the " .. s.competition .. pens .. "!") }, { "state", "nextFixture", "trophy", "message" }) end
		end
		do return Js.O({ state = s, nextFixture = koFixture(career, s), trophy = nil, message = (nation .. " are through to the " .. s.ko[Js.alen(s.ko)].name .. pens .. ".") }, { "state", "nextFixture", "trophy", "message" }) end
	end
	exports.settleTournamentMatch = settleTournamentMatch
	ordinal = function(n)
		do return (if (n == 1) then "1st" else (if (n == 2) then "2nd" else (if (n == 3) then "3rd" else (Js.numstr(n) .. "th")))) end
	end
	KO_ROUNDS = Js.alit("Round of 16", "Quarter-Final", "Semi-Final", "Final")
	exports.KO_ROUNDS = KO_ROUNDS
	ALIASES = Js.O({ Turkey = "Türkiye", Ireland = "Republic of Ireland", ["Czech Republic"] = "Czechia", ["United States"] = "USA", ["Ivory Coast"] = "Cote d'Ivoire" }, { "Turkey", "Ireland", "Czech Republic", "United States", "Ivory Coast" })
	canon = function(n)
		return (if ALIASES[n] ~= nil then ALIASES[n] else n)
	end
	EURO_POOL = Js.alit("England", "France", "Spain", "Germany", "Portugal", "Netherlands", "Italy", "Belgium", "Croatia", "Denmark", "Switzerland", "Norway", "Austria", "Türkiye", "Sweden", "Poland", "Serbia", "Ukraine", "Scotland", "Wales", "Republic of Ireland", "Northern Ireland", "Czechia", "Hungary", "Greece", "Slovakia", "Slovenia", "Romania", "Iceland", "Finland", "Albania", "Georgia", "Bosnia and Herzegovina", "Israel")
	REST_POOL = Js.alit("Brazil", "Argentina", "Uruguay", "Colombia", "Ecuador", "Mexico", "USA", "Canada", "Japan", "Korea Republic", "Australia", "Morocco", "Senegal", "Nigeria", "Cote d'Ivoire", "Ghana", "Cameroon", "Egypt", "Algeria", "Chile", "Peru", "Paraguay", "Saudi Arabia", "Iran", "Qatar", "Costa Rica", "Tunisia", "Jamaica", "New Zealand")
	EXTRA_STRENGTH = Js.O({ Albania = 66, Georgia = 68, ["Bosnia and Herzegovina"] = 66, Israel = 64, ["Saudi Arabia"] = 66, Iran = 70, Qatar = 62, ["Costa Rica"] = 66, Tunisia = 68 }, { "Albania", "Georgia", "Bosnia and Herzegovina", "Israel", "Saudi Arabia", "Iran", "Qatar", "Costa Rica", "Tunisia" })
end
