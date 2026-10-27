--!nocheck
--!nolint
-- Generated from lib/star/world/index.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_promotion = import("lib/star/promotion")
	local M_euro = import("lib/star/euro")
	local M_holders = import("lib/star/world/holders")
	local M_season = import("lib/star/season")
	local M_shootout = import("lib/star/shootout")
	local M_calendar = import("lib/star/calendar")
	local M_europe = import("lib/star/world/europe")
	local M_cups = import("lib/star/cups")
	local M_leagues = import("lib/star/world/leagues")
	local M_competitions = import("lib/star/competitions")
	local WORLD_LIVE, anyClubRating, ratedCache, ratedTeams, squadLookup, shieldPairs, playShield, openWorld, advanceLeagueCup, advanceWorld, seasonClock, current, worldOf, worldAfterMatch, finished, finishWorld, worldTable
	anyClubRating = function(career, club, members)
		if members == nil then members = M_promotion.membershipOf(career) end
		local onLadder = A.some(Js.Object.values(members), function(list)
			return Js.call(list, "includes", club)
		end)
		if (onLadder or A.some(career.league, function(t)
			return (t.name == club)
		end)) then
			do return M_promotion.ratingFor(career, club, members) end
		end
		do return M_euro.europeanStrengthOf(club, career) end
	end
	exports.anyClubRating = anyClubRating
	ratedTeams = function(career)
		local hit = ratedCache:get(career)
		if hit then
			do return hit end
		end
		local members = M_promotion.membershipOf(career)
		local seen = Js.Set.new(A.map(career.league, function(t)
			return t.name
		end))
		local out = Js.aspread(career.league)
		do
			local _arr1 = Js.Object.values(members)
			local _i2 = 0
			while _i2 < Js.alen(_arr1) do
				_i2 += 1
				local list = _arr1[_i2]
				for _ok3, _v4 in Js.iter(list) do
					local club = _v4
					if seen:has(club) then
						do continue end
					end
					seen:add(club)
					A.push(out, Js.O({ name = club, strength = M_promotion.ratingFor(career, club, members), played = 0, won = 0, drawn = 0, lost = 0, goalsFor = 0, goalsAgainst = 0, points = 0 }, { "name", "strength", "played", "won", "drawn", "lost", "goalsFor", "goalsAgainst", "points" }))
				end
			end
		end
		ratedCache:set(career, out)
		do return out end
	end
	exports.ratedTeams = ratedTeams
	squadLookup = function(career)
		local m = Js.Map.new()
		do
			local _arr5 = (if career.externalSquads ~= nil then career.externalSquads else Js.alit())
			local _i6 = 0
			while _i6 < Js.alen(_arr5) do
				_i6 += 1
				local s = _arr5[_i6]
				m:set(s.club, s)
			end
		end
		do
			local _arr7 = (if career.leagueSquads ~= nil then career.leagueSquads else Js.alit())
			local _i8 = 0
			while _i8 < Js.alen(_arr7) do
				_i8 += 1
				local s = _arr7[_i8]
				m:set(s.club, s)
			end
		end
		do return function(club)
			return m:get(club)
		end end
	end
	shieldPairs = function(career)
		local w = (if (career.season <= 1) then M_holders.SEASON_ONE_HOLDERS else career.lastSeasonWinners)
		if (not w) then
			do return Js.alit() end
		end
		local out = Js.alit()
		local champion = ((if w.premierLeague ~= nil then w.premierLeague else (function() local _v = career.lastTopFlight; if _v == nil then return nil end; _v = _v[1]; return _v end)()) or nil)
		if (Js.T(champion) and Js.T(w.faCup)) then
			local runnerUp = ((if Js.has(w, "premierLeagueRunnerUp") then w.premierLeagueRunnerUp else nil) or (function() local _v = career.lastTopFlight; if _v == nil then return nil end; _v = _v[2]; return _v end)())
			local a = (if (champion == w.faCup) then (if runnerUp ~= nil then runnerUp else champion) else champion)
			if (a ~= w.faCup) then
				A.push(out, Js.O({ competition = "Community Shield", home = a, away = w.faCup }, { "competition", "home", "away" }))
			end
		end
		if ((Js.T(w.championsLeague) and Js.T(w.europaLeague)) and (w.championsLeague ~= w.europaLeague)) then
			A.push(out, Js.O({ competition = "Super Cup", home = w.championsLeague, away = w.europaLeague }, { "competition", "home", "away" }))
		end
		do return out end
	end
	exports.shieldPairs = shieldPairs
	playShield = function(career, s)
		local rng = M_season.mulberry32(Js.ushr(Js.bxor(Math.imul(career.season, 7349), (if (s.competition == "Super Cup") then 991 else 337)), 0))
		local a = anyClubRating(career, s.home)
		local b = anyClubRating(career, s.away)
		local sc = M_season.simulateFixtureScore(a, b, rng)
		local out = Js.ospread(s, Js.O({ hs = sc.home, as = sc.away }, { "hs", "as" }))
		if (sc.home == sc.away) then
			local p = M_shootout.simulateShootout(a, b, rng)
			out.pens = Js.O({ home = p.home, away = p.away }, { "home", "away" })
			out.winner = (if (p.home > p.away) then s.home else s.away)
		else
			out.winner = (if (sc.home > sc.away) then s.home else s.away)
		end
		do return out end
	end
	openWorld = function(career)
		local division = M_calendar.divisionOf(career)
		local yours = career.player.club
		local inEurope = (function() local _v = career.euroState; if _v == nil then return nil end; _v = _v.competition; return _v end)()
		local europe = A.map(A.filter(Js.alit("Champions League", "Europa League"), function(c)
			return (c ~= inEurope)
		end), function(c)
			return M_europe.openWorldEuro(career, c)
		end)
		local enteredLeagueCup = A.some((if career.cupState ~= nil then career.cupState else Js.alit()), function(c)
			return (c.competition == "League Cup")
		end)
		local leagueCup = nil
		if (not enteredLeagueCup) then
			local premier = M_promotion.membershipOf(career).premier
			local rated = ratedTeams(career)
			local table_ = A.filter(A.map(premier, function(n)
				return A.find(rated, function(t)
					return (t.name == n)
				end)
			end), Js.Boolean)
			leagueCup = M_cups.openCup("League Cup", table_, "premier", M_season.mulberry32(Js.ushr(Js.bxor(Math.imul(career.season, 6151), 20973), 0)))
		end
		local shields = A.filter(shieldPairs(career), function(s)
			return ((s.home ~= yours) and (s.away ~= yours))
		end)
		do return Js.ospread(Js.O({ v = 1, season = career.season, division = division, leagues = M_leagues.openWorldLeagues(career, division), europe = europe }, { "v", "season", "division", "leagues", "europe" }), (if leagueCup then Js.O({ leagueCup = leagueCup }, { "leagueCup" }) else Js.O({}, nil)), Js.O({ shields = shields }, { "shields" })) end
	end
	exports.openWorld = openWorld
	advanceLeagueCup = function(career, cup, clock)
		local s = cup
		local rated = ratedTeams(career)
		do
			local guard = 0
			local _first9 = true
			while true do
				if not _first9 then
					guard += 1
				end
				_first9 = false
				if not ((guard < (Js.alen(M_cups.roundNamesFor(s.competition)) + 1)) and (not Js.T(s.winner))) then break end
				local idx = (Js.alen(s.rounds) - 1)
				local week = M_competitions.cupRoundWeek("League Cup", idx, 20, "premier", false)
				if (M_calendar.fixtureTimestamp(career.player.startYear, career.season, week, "cup", "premier") > clock) then
					do break end
				end
				local next_ = M_cups.playCupRound(s, rated, "", nil, M_season.mulberry32(Js.ushr(Js.bxor(Math.imul(career.season, 4099), Math.imul((idx + 1), 977)), 0)))
				if (next_ == s) then
					do break end
				end
				s = next_
			end
		end
		do return s end
	end
	advanceWorld = function(career, world, clock)
		local squadOf = squadLookup(career)
		local leagues = M_leagues.advanceWorldLeagues(career, world.leagues, clock, squadOf)
		local europe = A.map(world.europe, function(e)
			return M_europe.advanceWorldEuro(career, e, clock, squadOf)
		end)
		local leagueCup = (if world.leagueCup then advanceLeagueCup(career, world.leagueCup, clock) else nil)
		local shieldTime = M_calendar.fixtureTimestamp(career.player.startYear, career.season, M_calendar.PRE_SEASON_WEEK, "cup", world.division)
		local shields = A.map(world.shields, function(s)
			return (if (Js.T(s.winner) or (shieldTime > clock)) then s else playShield(career, s))
		end)
		local same = ((((leagues == world.leagues) and A.every(europe, function(e, i)
			return (e == world.europe[i + 1])
		end)) and (leagueCup == world.leagueCup)) and A.every(shields, function(s, i)
			return (s == world.shields[i + 1])
		end))
		do return (if same then world else Js.ospread(world, Js.O({ leagues = leagues, europe = europe }, { "leagues", "europe" }), (if leagueCup then Js.O({ leagueCup = leagueCup }, { "leagueCup" }) else Js.O({}, nil)), Js.O({ shields = shields }, { "shields" }))) end
	end
	exports.advanceWorld = advanceWorld
	seasonClock = function(career)
		local d = M_calendar.divisionOf(career)
		local t = (-math.huge)
		do
			local _arr10 = career.fixtures
			local _i11 = 0
			while _i11 < Js.alen(_arr10) do
				_i11 += 1
				local f = _arr10[_i11]
				if (not f.played) then
					do continue end
				end
				local ts = M_calendar.fixtureTimestamp(career.player.startYear, career.season, f.week, f.kind, d)
				if (ts > t) then
					t = ts
				end
			end
		end
		do return t end
	end
	exports.seasonClock = seasonClock
	current = function(career)
		local w = career.world
		do return ((((not (not w)) and (w.v == 1)) and (w.season == career.season)) and (w.division == M_calendar.divisionOf(career))) end
	end
	worldOf = function(career)
		if current(career) then
			do return career.world end
		end
		local opened = openWorld(career)
		do return (if WORLD_LIVE then advanceWorld(career, opened, seasonClock(career)) else opened) end
	end
	exports.worldOf = worldOf
	worldAfterMatch = function(career, clock)
		local w = worldOf(career)
		do return (if WORLD_LIVE then advanceWorld(career, w, clock) else w) end
	end
	exports.worldAfterMatch = worldAfterMatch
	finishWorld = function(career)
		local hit = finished:get(career)
		if hit then
			do return hit end
		end
		local w = advanceWorld(career, worldOf(career), math.huge)
		finished:set(career, w)
		do return w end
	end
	exports.finishWorld = finishWorld
	worldTable = function(career, division)
		if (division == M_calendar.divisionOf(career)) then
			do return career.league end
		end
		do return ((function() local _v = A.find(finishWorld(career).leagues, function(l)
			return (l.division == division)
		end); if _v == nil then return nil end; _v = _v.teams; return _v end)() or nil) end
	end
	exports.worldTable = worldTable
	WORLD_LIVE = true
	exports.WORLD_LIVE = WORLD_LIVE
	ratedCache = Js.Map.new()
	finished = Js.Map.new()
	exports.SEASON_ONE_HOLDERS = M_holders.SEASON_ONE_HOLDERS
end
