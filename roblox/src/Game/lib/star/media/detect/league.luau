--!nocheck
--!nolint
-- Generated from lib/star/media/detect/league.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_kit = import("lib/star/media/detect/kit")
	local M_chants = import("lib/star/media/chants")
	local clubSubject, sideResultEvent, hatTrickEvents, decisiveGoalEvents, decisiveDrawEvent, chantEligibleGoalEvents, matchGoals, goalsFor, detectLeagueWeek
	clubSubject = function(name)
		do return Js.O({ kind = "club", name = name }, { "kind", "name" }) end
	end
	sideResultEvent = function(club, opponent, us, them, home, competition, season, week)
		local diff = (us - them)
		local id = nil
		local importance = nil
		local tags = nil
		if (diff == 0) then
			id = "draw"
			importance = 22
			tags = Js.alit("table")
		elseif (diff > 0) then
			if (diff >= 3) then
				id = "rout"
				importance = (54 + (diff * 4))
				tags = Js.alit("table", "drama")
			else
				id = "win"
				importance = 34
				tags = Js.alit("table")
			end
		else
			local margin = (-diff)
			if (margin >= 3) then
				id = "hammered"
				importance = (50 + (margin * 5))
				tags = Js.alit("shame", "drama")
			else
				id = "loss"
				importance = 26
				tags = Js.alit("table")
			end
		end
		do return M_kit.ev(id, clubSubject(club), importance, tags, Js.O({ club = club, opponent = opponent, competition = competition, season = season, week = week, us = us, them = them, score = (Js.numstr(us) .. "-" .. Js.numstr(them)), result = (if (diff == 0) then "draw" else (if (diff > 0) then "win" else "loss")), home = home, venue = (if home then "at home" else "away"), homeClub = (if home then club else opponent), awayClub = (if home then opponent else club), hs = (if home then us else them), as = (if home then them else us), margin = math.abs(diff) }, { "club", "opponent", "competition", "season", "week", "us", "them", "score", "result", "home", "venue", "homeClub", "awayClub", "hs", "as", "margin" }), "instant") end
	end
	hatTrickEvents = function(club, opponent, goals, home, competition, season, week)
		if (not Js.T((function() local _v = goals; if _v == nil then return nil end; _v = Js.len(_v); return _v end)())) then
			do return Js.alit() end
		end
		local counts = Js.Map.new()
		do
			local _arr1 = goals
			local _i2 = 0
			while _i2 < Js.alen(_arr1) do
				_i2 += 1
				local g = _arr1[_i2]
				if (not Js.T(g.full)) then
					do continue end
				end
				local cur = (counts:get(g.full) or Js.O({ n = 0, short = g.s, role = g.role }, { "n", "short", "role" }))
				cur.n += 1
				counts:set(g.full, cur)
			end
		end
		local out = Js.alit()
		do
			local _arr3 = Js.Array.from(counts)
			local _i4 = 0
			while _i4 < Js.alen(_arr3) do
				_i4 += 1
				local _e5 = _arr3[_i4]
				local full = _e5[1]
				local _d6 = _e5[2]
				local n = _d6.n
				local short = _d6.short
				local role = _d6.role
				if (n < 2) then
					do continue end
				end
				local id = (if (n >= 5) then "five-goals" else (if (n == 4) then "four-goals" else (if (n == 3) then "hat-trick" else "brace")))
				local importance = (if (n >= 5) then 96 else (if (n == 4) then 88 else (if (n == 3) then 76 else 52)))
				A.push(out, M_kit.ev(id, clubSubject(club), importance, Js.alit("goal", (if (n >= 3) then "record" else "goal")), Js.ospread(Js.O({ club = club, opponent = opponent, competition = competition, season = season, week = week, home = home, player = full, short = short, goals = n }, { "club", "opponent", "competition", "season", "week", "home", "player", "short", "goals" }), (if Js.T(role) then Js.O({ role = role }, { "role" }) else Js.O({}, nil))), "instant"))
			end
		end
		do return out end
	end
	decisiveGoalEvents = function(home, away, hg, ag, hs, as, competition, season, week)
		if (hs == as) then
			do return decisiveDrawEvent(home, away, hg, ag, competition, season, week) end
		end
		if ((not Js.T((function() local _v = hg; if _v == nil then return nil end; _v = Js.len(_v); return _v end)())) and (not Js.T((function() local _v = ag; if _v == nil then return nil end; _v = Js.len(_v); return _v end)()))) then
			do return Js.alit() end
		end
		local winnerIsHome = (hs > as)
		local winnerClub = (if winnerIsHome then home else away)
		local opponent = (if winnerIsHome then away else home)
		local winnerGoals = ((if winnerIsHome then hg else ag) or Js.alit())
		local loserFinal = (if winnerIsHome then as else hs)
		local sorted = A.sort(Js.aspread(winnerGoals), function(a, b)
			return (a.m - b.m)
		end)
		local running = 0
		local decider = nil
		do
			local _arr7 = sorted
			local _i8 = 0
			while _i8 < Js.alen(_arr7) do
				_i8 += 1
				local g = _arr7[_i8]
				running += 1
				if (running == (loserFinal + 1)) then
					decider = g
				end
			end
		end
		if (not Js.T((function() local _v = decider; if _v == nil then return nil end; _v = _v.full; return _v end)())) then
			do return Js.alit() end
		end
		local late = (decider.m >= 85)
		do return Js.alit(M_kit.ev((if late then "late-winner" else "winner"), clubSubject(winnerClub), (if late then 86 else 58), (if late then Js.alit("goal", "drama") else Js.alit("goal")), Js.ospread(Js.O({ club = winnerClub, opponent = opponent, competition = competition, season = season, week = week, player = decider.full, short = decider.s, minute = decider.m }, { "club", "opponent", "competition", "season", "week", "player", "short", "minute" }), (if Js.T(decider.role) then Js.O({ role = decider.role }, { "role" }) else Js.O({}, nil))), "instant")) end
	end
	decisiveDrawEvent = function(home, away, hg, ag, competition, season, week)
		local merged = A.sort(Js.aspread(A.map((if hg ~= nil then hg else Js.alit()), function(g)
			return Js.ospread(g, Js.O({ side = "home" }, { "side" }))
		end), A.map((if ag ~= nil then ag else Js.alit()), function(g)
			return Js.ospread(g, Js.O({ side = "away" }, { "side" }))
		end)), function(a, b)
			return (a.m - b.m)
		end)
		if (not Js.T(Js.alen(merged))) then
			do return Js.alit() end
		end
		local homeScore = 0
		local awayScore = 0
		local lastEqualiser = nil
		do
			local _arr9 = merged
			local _i10 = 0
			while _i10 < Js.alen(_arr9) do
				_i10 += 1
				local g = _arr9[_i10]
				if (g.side == "home") then
					homeScore += 1
				else
					awayScore += 1
				end
				if ((homeScore == awayScore) and (homeScore > 0)) then
					lastEqualiser = g
				end
			end
		end
		if (not Js.T((function() local _v = lastEqualiser; if _v == nil then return nil end; _v = _v.full; return _v end)())) then
			do return Js.alit() end
		end
		local club = (if (lastEqualiser.side == "home") then home else away)
		local opponent = (if (lastEqualiser.side == "home") then away else home)
		local late = (lastEqualiser.m >= 80)
		do return Js.alit(M_kit.ev("equaliser", clubSubject(club), (if late then 62 else 44), (if late then Js.alit("goal", "drama") else Js.alit("goal")), Js.ospread(Js.O({ club = club, opponent = opponent, competition = competition, season = season, week = week, player = lastEqualiser.full, short = lastEqualiser.s, minute = lastEqualiser.m }, { "club", "opponent", "competition", "season", "week", "player", "short", "minute" }), (if Js.T(lastEqualiser.role) then Js.O({ role = lastEqualiser.role }, { "role" }) else Js.O({}, nil))), "instant")) end
	end
	chantEligibleGoalEvents = function(club, opponent, goals, competition, season, week)
		if (not Js.T((function() local _v = goals; if _v == nil then return nil end; _v = Js.len(_v); return _v end)())) then
			do return Js.alit() end
		end
		local seen = Js.Set.new()
		local out = Js.alit()
		do
			local _arr11 = goals
			local _i12 = 0
			while _i12 < Js.alen(_arr11) do
				_i12 += 1
				local g = _arr11[_i12]
				if (((not Js.T(g.full)) or seen:has(g.full)) or (not M_chants.PLAYER_GOAL_CHANTS[g.full])) then
					do continue end
				end
				seen:add(g.full)
				A.push(out, M_kit.ev("teammate-goal", Js.O({ kind = "teammate", name = g.full }, { "kind", "name" }), 26, Js.alit("goal"), Js.O({ club = club, opponent = opponent, competition = competition, season = season, week = week, scorer = g.full }, { "club", "opponent", "competition", "season", "week", "scorer" }), "instant"))
			end
		end
		do return out end
	end
	matchGoals = function(r, competition, season, week)
		local merged = A.sort(Js.aspread(A.map((if r.hg ~= nil then r.hg else Js.alit()), function(g)
			return Js.O({ g = g, home = true }, { "g", "home" })
		end), A.map((if r.ag ~= nil then r.ag else Js.alit()), function(g)
			return Js.O({ g = g, home = false }, { "g", "home" })
		end)), function(a, b)
			return (a.g.m - b.g.m)
		end)
		local h = 0
		local a = 0
		do return A.map(merged, function(_p13)
			local g = _p13.g
			local home = _p13.home
			if home then
				h += 1
			else
				a += 1
			end
			do return Js.O({ home = r.home, away = r.away, scorer = (if g.full ~= nil then g.full else g.s), scorerShort = g.s, scorerHome = home, minute = g.m, scoreAfter = Js.alit(h, a), competition = competition, season = season, week = week, seed = (Js.numstr(season) .. "-" .. Js.numstr(week) .. "-" .. r.home .. "-" .. r.away .. "-" .. Js.numstr(g.m) .. "-" .. g.s) }, { "home", "away", "scorer", "scorerShort", "scorerHome", "minute", "scoreAfter", "competition", "season", "week", "seed" }) end
		end) end
	end
	goalsFor = function(e, goals)
		local f = e.facts
		local club = (if (type(f.club) == "string") then f.club else "")
		local forClub = function(g)
			return ((if g.scorerHome then g.home else g.away) == club)
		end
		if ((type(f.minute) == "number") and (type(f.player) == "string")) then
			do return A.slice(A.filter(goals, function(g)
				return ((g.minute == f.minute) and forClub(g))
			end), 0, 1) end
		end
		local who = (if (type(f.player) == "string") then f.player else (if (type(f.scorer) == "string") then f.scorer else nil))
		if Js.T(who) then
			do return A.slice(A.filter(goals, function(g)
				return ((g.scorer == who) and forClub(g))
			end), 0, 4) end
		end
		if A.includes(Js.alit("win", "rout", "draw"), e.id) then
			do return A.slice(A.filter(goals, forClub), 0, 4) end
		end
		do return Js.alit() end
	end
	detectLeagueWeek = function(results, excludeClub, week, competition, season)
		local out = Js.alit()
		do
			local _arr14 = results
			local _i15 = 0
			while _i15 < Js.alen(_arr14) do
				_i15 += 1
				local r = _arr14[_i15]
				if (r.week ~= week) then
					do continue end
				end
				if ((r.home == excludeClub) or (r.away == excludeClub)) then
					do continue end
				end
				local fromThis = Js.aspread(Js.alit(sideResultEvent(r.home, r.away, r.hs, r.as, true, competition, season, week), sideResultEvent(r.away, r.home, r.as, r.hs, false, competition, season, week)), hatTrickEvents(r.home, r.away, r.hg, true, competition, season, week), hatTrickEvents(r.away, r.home, r.ag, false, competition, season, week), decisiveGoalEvents(r.home, r.away, r.hg, r.ag, r.hs, r.as, competition, season, week), chantEligibleGoalEvents(r.home, r.away, r.hg, competition, season, week), chantEligibleGoalEvents(r.away, r.home, r.ag, competition, season, week))
				local goals = matchGoals(r, competition, season, week)
				do
					local _arr16 = fromThis
					local _i17 = 0
					while _i17 < Js.alen(_arr16) do
						_i17 += 1
						local e = _arr16[_i17]
						local pick = goalsFor(e, goals)
						if Js.T(Js.alen(pick)) then
							e.facts.goalVideos = Js.JSON.stringify(pick)
						end
					end
				end
				A.push(out, Js.unpack(fromThis))
			end
		end
		do return out end
	end
	exports.detectLeagueWeek = detectLeagueWeek
end
