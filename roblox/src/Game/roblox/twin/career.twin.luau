--!nocheck
--!nolint
-- Generated from roblox/twin/career.twin.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M__out = import("roblox/twin/_out")
	local M_clubs = import("lib/star/clubs")
	local M_careerFlow = import("lib/star/careerFlow")
	local M_competitions = import("lib/star/competitions")
	local SEASONS, ONLY, DIVS0, DIVS, stats, label, r2, fingerprint
	stats = function(us, them, home, goals)
		do return Js.O({ chances = 5, goals = goals, assists = 1, passes = 28, rating = 7.2, starMan = (goals >= 2), bossChange = 0, teamChange = 0, fansChange = 0, wage = 1, goalBonus = goals, sponsorPay = 0, totalCash = 2, homeScore = (if home then us else them), awayScore = (if home then them else us), minutes = 90 }, { "chances", "goals", "assists", "passes", "rating", "starMan", "bossChange", "teamChange", "fansChange", "wage", "goalBonus", "sponsorPay", "totalCash", "homeScore", "awayScore", "minutes" }) end
	end
	fingerprint = function(c)
		local table_ = A.join(A.map(c.league, function(t)
			return (t.name .. ":" .. Js.numstr(t.played) .. "/" .. Js.numstr(t.points) .. "/" .. Js.numstr(t.goalsFor) .. "-" .. Js.numstr(t.goalsAgainst))
		end), ",")
		do return M__out.show(Js.O({ season = c.season, club = c.player.club, money = r2(c.money), fame = r2(c.fame), star = r2(c.starRating), table = table_, fixtures = Js.alen(c.fixtures), unplayed = Js.alen(A.filter(c.fixtures, function(f)
			return (not f.played)
		end)), trophies = A.map((if c.trophies ~= nil then c.trophies else Js.alit()), function(t)
			return (t.competition .. "@" .. Js.numstr(t.season))
		end), winners = c.lastSeasonWinners, squad = Js.alen(c.squad) }, { "season", "club", "money", "fame", "star", "table", "fixtures", "unplayed", "trophies", "winners", "squad" })) end
	end
	SEASONS = Js.Number((if Js.process.env.CAREER_SEASONS ~= nil then Js.process.env.CAREER_SEASONS else 2))
	ONLY = (function() local _r = Js.process.env.CAREER_DIVS; if _r == nil then return nil end; return S.split(_r, ",") end)()
	DIVS0 = Js.alit(Js.alit("premier", M_clubs.PREMIER_LEAGUE_CLUBS), Js.alit("championship", M_clubs.CHAMPIONSHIP_CLUBS), Js.alit("league_one", M_clubs.LEAGUE_ONE_CLUBS), Js.alit("league_two", M_clubs.LEAGUE_TWO_CLUBS), Js.alit("national_league", M_clubs.NATIONAL_LEAGUE_CLUBS), Js.alit("national_league_north", M_clubs.NATIONAL_LEAGUE_NORTH_CLUBS), Js.alit("national_league_south", M_clubs.NATIONAL_LEAGUE_SOUTH_CLUBS))
	DIVS = (if ONLY then A.filter(DIVS0, function(_p1)
		local d = _p1[1]
		return A.includes(ONLY, d)
	end) else DIVS0)
	label = function(f)
		return ((if f.competition ~= nil then f.competition else "League") .. "/" .. ((if f.round ~= nil then f.round else f.kind) or "") .. (if Js.T(f.leg) then (" L" .. Js.numstr(f.leg)) else "") .. "@" .. Js.numstr(f.week) .. " v " .. f.opponent)
	end
	r2 = function(n)
		return (Math.round((n * 100)) / 100)
	end
	do
		local _arr2 = DIVS
		local _i3 = 0
		while _i3 < Js.alen(_arr2) do
			_i3 += 1
			local _e4 = _arr2[_i3]
			local div = _e4[1]
			local clubs = _e4[2]
			do
				local _arr5 = Js.alit("win", "lose", "mixed")
				local _i6 = 0
				while _i6 < Js.alen(_arr5) do
					_i6 += 1
					local style = _arr5[_i6]
					local club = clubs[math.fmod((if (style == "win") then 0 else (if (style == "lose") then 5 else 11)), Js.alen(clubs)) + 1]
					local p = Js.O({ firstName = "Soak", lastName = "Test", age = 17, skinTone = "light", club = club, clubBadge = nil, position = "ST", nationality = "England", startYear = 2027 }, { "firstName", "lastName", "age", "skinTone", "club", "clubBadge", "position", "nationality", "startYear" })
					local c = M_careerFlow.makeInitialCareer(p, Js.aspread(clubs), div)
					Js.console.log(("== " .. div .. "/" .. style .. " start " .. fingerprint(c)))
					for s = 1, math.floor(SEASONS) do
						local g = 0
						while ((function() local _o = g; g = _o + 1; return _o end)() < 250) do
							local next_ = M_competitions.nextFixtureFor(c)
							if (not next_) then
								do break end
							end
							local us = (if (style == "win") then 3 else (if (style == "lose") then 0 else math.fmod((g * 7), 4)))
							local them = (if (style == "win") then 0 else (if (style == "lose") then 2 else math.fmod((g * 5), 3)))
							c = (if (math.fmod(g, 9) == 0) then M_careerFlow.simulateMissedFixture(c, next_) else M_careerFlow.creditMatchResult(c, next_, stats(us, them, next_.home, Math.min(us, 2)))).career
							local me = A.find(c.league, function(t)
								return (t.name == c.player.club)
							end)
							Js.console.log((label(next_) .. " | " .. (if me then (Js.numstr(me.played) .. "/" .. Js.numstr(me.points)) else "-") .. " | " .. Js.numstr(r2(c.money)) .. " | " .. Js.numstr(r2(c.fame))))
						end
						c = M_careerFlow.advanceSeason(c, false).career
						Js.console.log(("== " .. div .. "/" .. style .. " after season " .. Js.numstr(s) .. " " .. fingerprint(c)))
					end
				end
			end
		end
	end
end
