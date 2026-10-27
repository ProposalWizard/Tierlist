--!nocheck
--!nolint
-- Generated from lib/star/potm.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_calendar = import("lib/star/calendar")
	local M_season = import("lib/star/season")
	local M_realSquad = import("lib/star/realSquad")
	local MONTH_NAMES, WEEKS_PER_MONTH, seasonMonthIndex, monthOf, monthOfCareer, endsMonthOn, monthName, endsMonth, SHORTLIST, monthCandidates, voteMonth, monthRace, HARD_LETTERS, nameKey, lastWord, playerOf, faceOf, alreadyAwarded, catchUpAwards, compactPotmHistory
	seasonMonthIndex = function(calendarMonth)
		local i = (if (calendarMonth >= 7) then (calendarMonth - 7) else (calendarMonth + 5))
		do return Math.max(0, Math.min((Js.alen(MONTH_NAMES) - 1), i)) end
	end
	monthOf = function(week, startYear, season, division)
		if division == nil then division = "premier" end
		if ((startYear ~= nil) and (season ~= nil)) then
			do return seasonMonthIndex(M_calendar.calendarMonthOf(startYear, season, week, division)) end
		end
		do return Math.min((Js.alen(MONTH_NAMES) - 1), math.floor((Math.max(0, (week - 1)) / WEEKS_PER_MONTH))) end
	end
	exports.monthOf = monthOf
	monthOfCareer = function(career, week)
		do return monthOf(week, career.player.startYear, career.season, M_calendar.divisionOf(career)) end
	end
	exports.monthOfCareer = monthOfCareer
	endsMonthOn = function(career, week, lastWeek)
		if (week >= lastWeek) then
			do return true end
		end
		do return (monthOfCareer(career, week) ~= monthOfCareer(career, (week + 1))) end
	end
	exports.endsMonthOn = endsMonthOn
	monthName = function(week)
		do return MONTH_NAMES[monthOf(week) + 1] end
	end
	exports.monthName = monthName
	endsMonth = function(week, lastWeek)
		do return ((math.fmod(week, WEEKS_PER_MONTH) == 0) or (week >= lastWeek)) end
	end
	exports.endsMonth = endsMonth
	monthCandidates = function(career, month)
		local results = A.filter((if career.results ~= nil then career.results else Js.alit()), function(r)
			return (monthOfCareer(career, r.week) == month)
		end)
		if (Js.alen(results) == 0) then
			do return Js.alit() end
		end
		local by = Js.Map.new()
		local key = function(name, club)
			return (club .. "|" .. name)
		end
		local touch = function(name, club)
			local k = key(name, club)
			local c = by:get(k)
			if (not c) then
				c = Js.O({ name = name, club = club, goals = 0, assists = 0, points = 0, isYou = false, score = 0 }, { "name", "club", "goals", "assists", "points", "isYou", "score" })
				by:set(k, c)
			end
			do return c end
		end
		local clubPoints = Js.Map.new()
		local addPoints = function(club, n)
			return clubPoints:set(club, ((clubPoints:get(club) or 0) + n))
		end
		do
			local _arr1 = results
			local _i2 = 0
			while _i2 < Js.alen(_arr1) do
				_i2 += 1
				local r = _arr1[_i2]
				if (r.hs > r.as) then
					addPoints(r.home, 3)
				elseif (r.hs < r.as) then
					addPoints(r.away, 3)
				else
					addPoints(r.home, 1)
					addPoints(r.away, 1)
				end
			end
		end
		do
			local _arr3 = results
			local _i4 = 0
			while _i4 < Js.alen(_arr3) do
				_i4 += 1
				local r = _arr3[_i4]
				do
					local _arr5 = Js.alit(Js.alit(r.home, r.hg), Js.alit(r.away, r.ag))
					local _i6 = 0
					while _i6 < Js.alen(_arr5) do
						_i6 += 1
						local _e7 = _arr5[_i6]
						local club = _e7[1]
						local goals = _e7[2]
						do
							local _arr8 = (if goals ~= nil then goals else Js.alit())
							local _i9 = 0
							while _i9 < Js.alen(_arr8) do
								_i9 += 1
								local g = _arr8[_i9]
								touch(g.s, club).goals += 1
								if Js.T(g.a) then
									touch(g.a, club).assists += 1
								end
							end
						end
					end
				end
			end
		end
		local yourName = (career.player.firstName .. " " .. career.player.lastName)
		local yourSurname = career.player.lastName
		do
			local _arr10 = Js.Array.from(by:values())
			local _i11 = 0
			while _i11 < Js.alen(_arr10) do
				_i11 += 1
				local c = _arr10[_i11]
				c.points = (clubPoints:get(c.club) or 0)
				c.isYou = ((c.club == career.player.club) and ((c.name == yourSurname) or (c.name == yourName)))
			end
		end
		local mine = A.find(Js.Array.from(by:values()), function(c)
			return c.isYou
		end)
		if mine then
			local rated = A.filter((if career.fixtures ~= nil then career.fixtures else Js.alit()), function(f)
				return (((f.played and ((if f.kind ~= nil then f.kind else "league") == "league")) and (monthOfCareer(career, f.week) == month)) and (type(f.userRating) == "number"))
			end)
			if Js.T(Js.alen(rated)) then
				mine.rating = (A.reduce(rated, function(a, f)
					return (a + (if f.userRating ~= nil then f.userRating else 0))
				end, 0) / Js.alen(rated))
			end
		end
		do return Js.Array.from(by:values()) end
	end
	exports.monthCandidates = monthCandidates
	voteMonth = function(career, month)
		local candidates = monthCandidates(career, month)
		if (Js.alen(candidates) == 0) then
			do return nil end
		end
		local rng = M_season.mulberry32((((career.season * 100003) + (month * 7919)) + (Js.alen(candidates) * 31)))
		rng()
		rng()
		rng()
		do
			local _arr12 = candidates
			local _i13 = 0
			while _i13 < Js.alen(_arr12) do
				_i13 += 1
				local c = _arr12[_i13]
				local base = ((((c.goals * 3.4) + (c.assists * 2.1)) + (c.points * 0.55)) + (if (c.rating ~= nil) then ((c.rating - 6.5) * 2.4) else 0))
				c.score = (base * (0.58 + (rng() * 0.84)))
			end
		end
		local ranked = A.sort(Js.aspread(candidates), function(a, b)
			return (function() local _l = (function() local _l = (b.score - a.score); if Js.T(_l) then return _l end; return (b.goals - a.goals) end)(); if Js.T(_l) then return _l end; return S.localeCompare(a.name, b.name) end)()
		end)
		local shortlist = A.slice(ranked, 0, SHORTLIST)
		local winner = shortlist[1]
		local yourIndex = A.findIndex(shortlist, function(c)
			return c.isYou
		end)
		do return Js.O({ season = career.season, month = month, monthName = MONTH_NAMES[month + 1], winner = winner.name, club = winner.club, goals = winner.goals, assists = winner.assists, isYou = winner.isYou, nominees = A.map(shortlist, function(c)
			return Js.O({ name = c.name, club = c.club, goals = c.goals, assists = c.assists, isYou = c.isYou }, { "name", "club", "goals", "assists", "isYou" })
		end), yourPlace = (if (yourIndex >= 0) then (yourIndex + 1) else nil) }, { "season", "month", "monthName", "winner", "club", "goals", "assists", "isYou", "nominees", "yourPlace" }) end
	end
	exports.voteMonth = voteMonth
	monthRace = function(career, month)
		local candidates = monthCandidates(career, month)
		do
			local _arr14 = candidates
			local _i15 = 0
			while _i15 < Js.alen(_arr14) do
				_i15 += 1
				local c = _arr14[_i15]
				c.score = ((((c.goals * 3.4) + (c.assists * 2.1)) + (c.points * 0.55)) + (if (c.rating ~= nil) then ((c.rating - 6.5) * 2.4) else 0))
			end
		end
		do return A.sort(candidates, function(a, b)
			return (function() local _l = (b.score - a.score); if Js.T(_l) then return _l end; return (b.goals - a.goals) end)()
		end) end
	end
	exports.monthRace = monthRace
	nameKey = function(s)
		do return S.replace(S.replace(S.toLowerCase(S.replace(S.normalize(s, "NFD"), Js.re("[\\u0300-\\u036f]", "g"), "")), Js.re("[\\u00f8\\u0111\\u00f0\\u0142\\u00df\\u00e6\\u0153\\u00fe\\u0127\\u0131]", "g"), function(c)
			return (if HARD_LETTERS[c] ~= nil then HARD_LETTERS[c] else c)
		end), Js.re("[^a-z]", "g"), "") end
	end
	lastWord = function(s)
		local parts = S.split(S.trim(s), Js.re("\\s+", ""))
		do return (parts[Js.alen(parts)] or s) end
	end
	playerOf = function(career, name, club)
		local want = nameKey(name)
		if (not Js.T(want)) then
			do return nil end
		end
		if (club == career.player.club) then
			local mine = A.find((if career.squad ~= nil then career.squad else Js.alit()), function(p)
				return (((nameKey((if p.shortName ~= nil then p.shortName else "")) == want) or (nameKey(p.name) == want)) or (nameKey(lastWord(p.name)) == want))
			end)
			if mine then
				do return Js.O({ name = mine.name, image = mine.imageUrl, id = mine.id }, { "name", "image", "id" }) end
			end
		end
		local squad = A.find((if career.leagueSquads ~= nil then career.leagueSquads else Js.alit()), function(s)
			return (s.club == club)
		end)
		local him = (function() local _r = (function() local _v = squad; if _v == nil then return nil end; _v = _v.players; return _v end)(); if _r == nil then return nil end; return A.find(_r, function(p)
			return (((nameKey(p.name) == want) or (nameKey(M_realSquad.shortNameOf(p.name)) == want)) or (nameKey(lastWord(p.name)) == want))
		end) end)()
		do return (if him then Js.O({ name = him.name, image = him.image, id = him.id }, { "name", "image", "id" }) else nil) end
	end
	exports.playerOf = playerOf
	faceOf = function(career, name, club)
		do return (function() local _v = playerOf(career, name, club); if _v == nil then return nil end; _v = _v.image; return _v end)() end
	end
	exports.faceOf = faceOf
	alreadyAwarded = function(career, month)
		do return A.some((if career.potm ~= nil then career.potm else Js.alit()), function(a)
			return ((a.season == career.season) and (a.month == month))
		end) end
	end
	exports.alreadyAwarded = alreadyAwarded
	catchUpAwards = function(career)
		local played = A.filter((if career.fixtures ~= nil then career.fixtures else Js.alit()), function(f)
			return (f.played and ((if f.kind ~= nil then f.kind else "league") == "league"))
		end)
		if (not Js.T(Js.alen(played))) then
			do return Js.alit() end
		end
		local lastPlayed = Math.max(Js.unpack(A.map(played, function(f)
			return f.week
		end)))
		local lastWeek = Math.max(Js.unpack(Js.aspread(A.map((if career.fixtures ~= nil then career.fixtures else Js.alit()), function(f)
			return f.week
		end), Js.alit(lastPlayed))))
		local out = Js.alit()
		local have = Js.Set.new(A.map(A.filter((if career.potm ~= nil then career.potm else Js.alit()), function(a)
			return (a.season == career.season)
		end), function(a)
			return a.month
		end))
		do
			local _arr16 = played
			local _i17 = 0
			while _i17 < Js.alen(_arr16) do
				_i17 += 1
				local f = _arr16[_i17]
				local month = monthOfCareer(career, f.week)
				if have:has(month) then
					do continue end
				end
				if (not endsMonthOn(career, f.week, lastWeek)) then
					do continue end
				end
				if ((f.week >= lastPlayed) and (f.week < lastWeek)) then
					do continue end
				end
				local award = voteMonth(career, month)
				if (not award) then
					do continue end
				end
				have:add(month)
				A.push(out, award)
			end
		end
		do return A.sort(out, function(a, b)
			return (a.month - b.month)
		end) end
	end
	exports.catchUpAwards = catchUpAwards
	compactPotmHistory = function(potm, currentSeason)
		if (not Js.T((function() local _v = potm; if _v == nil then return nil end; _v = Js.len(_v); return _v end)())) then
			do return potm end
		end
		local changed = false
		local out = Js.alit()
		do
			local _arr18 = potm
			local _i19 = 0
			while _i19 < Js.alen(_arr18) do
				_i19 += 1
				local a = _arr18[_i19]
				if (a.season >= currentSeason) then
					A.push(out, a)
					do continue end
				end
				if (not a.isYou) then
					changed = true
					do continue end
				end
				if Js.T(Js.alen(a.nominees)) then
					A.push(out, Js.ospread(a, Js.O({ nominees = Js.alit() }, { "nominees" })))
					changed = true
				else
					A.push(out, a)
				end
			end
		end
		do return (if changed then out else potm) end
	end
	exports.compactPotmHistory = compactPotmHistory
	MONTH_NAMES = Js.alit("August", "September", "October", "November", "December", "January", "February", "March", "April", "May")
	exports.MONTH_NAMES = MONTH_NAMES
	WEEKS_PER_MONTH = 4
	exports.WEEKS_PER_MONTH = WEEKS_PER_MONTH
	SHORTLIST = 5
	HARD_LETTERS = Js.O({ ["ø"] = "o", ["đ"] = "d", ["ð"] = "d", ["ł"] = "l", ["ß"] = "ss", ["æ"] = "ae", ["œ"] = "oe", ["þ"] = "th", ["ħ"] = "h", ["ı"] = "i" }, { "ø", "đ", "ð", "ł", "ß", "æ", "œ", "þ", "ħ", "ı" })
end
