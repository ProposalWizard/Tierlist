--!nocheck
--!nolint
-- Generated from lib/star/recognition.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_season = import("lib/star/season")
	local M_squadData = import("lib/star/squadData")
	local RIVAL_FIRST, RIVAL_LAST, goldenBootRace, assistRace, legacyRace, leadingScorer, MONTH_WEEKS, monthlyAward, seasonAwards, captaincyEarned, CAPTAIN_TEAM_BONUS, BY_POSITION, assignSquadNumber, EARN_NUMBER_RELATIONSHIP, NEW_CLUB_GIVES_NUMBER, numberAtSeasonStart, numberOnSigning
	goldenBootRace = function(career)
		local squads = (if career.leagueSquads ~= nil then career.leagueSquads else Js.alit())
		if (Js.alen(squads) == 0) then
			do return legacyRace(career) end
		end
		local out = Js.alit()
		do
			local _arr1 = squads
			local _i2 = 0
			while _i2 < Js.alen(_arr1) do
				_i2 += 1
				local sq = _arr1[_i2]
				if (sq.club == career.player.club) then
					do continue end
				end
				do
					local _arr3 = sq.players
					local _i4 = 0
					while _i4 < Js.alen(_arr3) do
						_i4 += 1
						local p = _arr3[_i4]
						if (p.goals > 0) then
							A.push(out, Js.O({ name = p.name, club = sq.club, goals = p.goals, isYou = false }, { "name", "club", "goals", "isYou" }))
						end
					end
				end
			end
		end
		do
			local _arr5 = (if career.squad ~= nil then career.squad else Js.alit())
			local _i6 = 0
			while _i6 < Js.alen(_arr5) do
				_i6 += 1
				local p = _arr5[_i6]
				local g = (if p.leagueGoals ~= nil then p.leagueGoals else p.seasonGoals)
				if (g > 0) then
					A.push(out, Js.O({ name = p.name, club = career.player.club, goals = g, isYou = false }, { "name", "club", "goals", "isYou" }))
				end
			end
		end
		A.push(out, Js.O({ name = (career.player.firstName .. " " .. career.player.lastName), club = career.player.club, goals = ((function() local _v = career.leagueSeasonStats; if _v == nil then return nil end; _v = _v.goals; return _v end)() or career.seasonStats.goals), isYou = true }, { "name", "club", "goals", "isYou" }))
		do return A.sort(out, function(a, b)
			return (function() local _l = (b.goals - a.goals); if Js.T(_l) then return _l end; return (if a.isYou then -1 else (if b.isYou then 1 else 0)) end)()
		end) end
	end
	exports.goldenBootRace = goldenBootRace
	assistRace = function(career)
		local squads = (if career.leagueSquads ~= nil then career.leagueSquads else Js.alit())
		local out = Js.alit()
		do
			local _arr7 = squads
			local _i8 = 0
			while _i8 < Js.alen(_arr7) do
				_i8 += 1
				local sq = _arr7[_i8]
				if (sq.club == career.player.club) then
					do continue end
				end
				do
					local _arr9 = sq.players
					local _i10 = 0
					while _i10 < Js.alen(_arr9) do
						_i10 += 1
						local p = _arr9[_i10]
						if (p.assists > 0) then
							A.push(out, Js.O({ name = p.name, club = sq.club, goals = p.assists, isYou = false }, { "name", "club", "goals", "isYou" }))
						end
					end
				end
			end
		end
		do
			local _arr11 = (if career.squad ~= nil then career.squad else Js.alit())
			local _i12 = 0
			while _i12 < Js.alen(_arr11) do
				_i12 += 1
				local p = _arr11[_i12]
				local a = (if p.leagueAssists ~= nil then p.leagueAssists else p.seasonAssists)
				if (a > 0) then
					A.push(out, Js.O({ name = p.name, club = career.player.club, goals = a, isYou = false }, { "name", "club", "goals", "isYou" }))
				end
			end
		end
		A.push(out, Js.O({ name = (career.player.firstName .. " " .. career.player.lastName), club = career.player.club, goals = ((function() local _v = career.leagueSeasonStats; if _v == nil then return nil end; _v = _v.assists; return _v end)() or career.seasonStats.assists), isYou = true }, { "name", "club", "goals", "isYou" }))
		do return A.sort(out, function(a, b)
			return (function() local _l = (b.goals - a.goals); if Js.T(_l) then return _l end; return (if a.isYou then -1 else (if b.isYou then 1 else 0)) end)()
		end) end
	end
	exports.assistRace = assistRace
	legacyRace = function(career)
		local weeks = Math.max(1, A.reduce(career.league, function(n, t)
			return Math.max(n, t.played)
		end, 0))
		local totalWeeks = Math.max(weeks, ((Js.alen(career.league) - 1) * 2))
		local through = Math.min(1, (weeks / totalWeeks))
		local rivals = A.map(A.filter(career.league, function(t)
			return (t.name ~= career.player.club)
		end), function(t)
			local rng = M_season.mulberry32((M_squadData.clubNameSeed(t.name) + (career.season * 9173)))
			local first = RIVAL_FIRST[math.floor((rng() * Js.alen(RIVAL_FIRST))) + 1]
			local last = RIVAL_LAST[math.floor((rng() * Js.alen(RIVAL_LAST))) + 1]
			local season = Math.round(((4 + ((t.strength / 100) * 20)) * (0.7 + (rng() * 0.7))))
			do return Js.O({ name = (first .. " " .. last), club = t.name, goals = Math.round((season * through)), isYou = false }, { "name", "club", "goals", "isYou" }) end
		end)
		A.push(rivals, Js.O({ name = (career.player.firstName .. " " .. career.player.lastName), club = career.player.club, goals = career.seasonStats.goals, isYou = true }, { "name", "club", "goals", "isYou" }))
		do return A.sort(rivals, function(a, b)
			return (function() local _l = (b.goals - a.goals); if Js.T(_l) then return _l end; return (if a.isYou then -1 else 1) end)()
		end) end
	end
	leadingScorer = function(career)
		local race = goldenBootRace(career)
		do return ((Js.alen(race) > 0) and race[1].isYou) end
	end
	exports.leadingScorer = leadingScorer
	monthlyAward = function(career)
		if ((career.week < MONTH_WEEKS) or (math.fmod(career.week, MONTH_WEEKS) ~= 0)) then
			do return nil end
		end
		if (Js.alen(career.form) < 3) then
			do return nil end
		end
		local recent = A.slice(career.form, 0, MONTH_WEEKS)
		local avg = (A.reduce(recent, function(s, r)
			return (s + r)
		end, 0) / Js.alen(recent))
		local strongest = Math.max(Js.unpack(A.map(career.league, function(t)
			return t.strength
		end)))
		local bar = (7.4 + ((strongest / 100) * 0.7))
		if (avg < bar) then
			do return nil end
		end
		do return Js.O({ season = career.season, kind = "Player of the Month", week = career.week, detail = (N.toFixed(avg, 2) .. " average over four matches") }, { "season", "kind", "week", "detail" }) end
	end
	exports.monthlyAward = monthlyAward
	seasonAwards = function(career)
		local out = Js.alit()
		local s = career.seasonStats
		if ((s.appearances > 0) and leadingScorer(career)) then
			A.push(out, Js.O({ season = career.season, kind = "Golden Boot", detail = (Js.numstr(s.goals) .. " goals") }, { "season", "kind", "detail" }))
		end
		local avg = (if (s.ratingCount > 0) then (s.totalRating / s.ratingCount) else 0)
		local pos = (A.findIndex(M_season.sortLeague(career.league), function(t)
			return (t.name == career.player.club)
		end) + 1)
		local topHalf = ((pos > 0) and (pos <= math.ceil((Js.alen(career.league) / 2))))
		if ((((s.appearances >= Math.max(6, Js.alen(career.league))) and (avg >= 7.6)) and (s.goals >= 12)) and topHalf) then
			A.push(out, Js.O({ season = career.season, kind = "Player of the Season", detail = (Js.numstr(s.goals) .. " goals, " .. N.toFixed(avg, 2) .. " average rating") }, { "season", "kind", "detail" }))
		end
		do return out end
	end
	exports.seasonAwards = seasonAwards
	captaincyEarned = function(career)
		local appearancesHere = (if career.clubAppearances ~= nil then career.clubAppearances else career.careerStats.appearances)
		do return ((((career.relationships.team >= 78) and (career.relationships.boss >= 70)) and (career.starRating >= 3.2)) and (appearancesHere >= 15)) end
	end
	exports.captaincyEarned = captaincyEarned
	assignSquadNumber = function(career, club)
		local rng = M_season.mulberry32(((M_squadData.clubNameSeed(club) + (career.season * 31)) + Math.round((career.starRating * 10))))
		local pool = (if BY_POSITION[career.player.position] ~= nil then BY_POSITION[career.player.position] else Js.alit(7, 8, 11, 17, 20))
		local idx = (if (career.starRating >= 4) then 0 else (if (career.starRating >= 3) then math.floor((rng() * Math.min(2, Js.alen(pool)))) else math.floor((rng() * Js.alen(pool)))))
		local first = pool[Math.min(idx, (Js.alen(pool) - 1)) + 1]
		if ((career.starRating < 2.5) and (rng() < 0.45)) then
			do return (20 + math.floor((rng() * 20))) end
		end
		do return first end
	end
	exports.assignSquadNumber = assignSquadNumber
	numberAtSeasonStart = function(career)
		local want = career.player.preferredNumber
		if ((not Js.T(want)) or (career.squadNumber == want)) then
			do return career.squadNumber end
		end
		local r = career.relationships
		if ((r and (r.boss >= EARN_NUMBER_RELATIONSHIP)) and (r.team >= EARN_NUMBER_RELATIONSHIP)) then
			do return want end
		end
		do return career.squadNumber end
	end
	exports.numberAtSeasonStart = numberAtSeasonStart
	numberOnSigning = function(career, club, firstClub)
		local want = career.player.preferredNumber
		if ((not firstClub) and Js.T(want)) then
			local rng = M_season.mulberry32(((M_squadData.clubNameSeed(club) + (career.season * 97)) + want))
			if (rng() < NEW_CLUB_GIVES_NUMBER) then
				do return want end
			end
		end
		do return assignSquadNumber(career, club) end
	end
	exports.numberOnSigning = numberOnSigning
	RIVAL_FIRST = Js.alit("Marco", "Diego", "Luka", "Kai", "Tobias", "Andre", "Rafa", "Nico", "Emre", "Bruno", "Yuki", "Sami")
	RIVAL_LAST = Js.alit("Sorensen", "Vidal", "Okafor", "Brandt", "Ferreira", "Novak", "Halvorsen", "Costa", "Demir", "Lindqvist", "Sato", "Bakker")
	MONTH_WEEKS = 4
	exports.MONTH_WEEKS = MONTH_WEEKS
	CAPTAIN_TEAM_BONUS = 1
	exports.CAPTAIN_TEAM_BONUS = CAPTAIN_TEAM_BONUS
	BY_POSITION = Js.O({ GK = Js.alit(1, 13, 25), CB = Js.alit(4, 5, 6, 15, 3), LB = Js.alit(3, 33, 12), RB = Js.alit(2, 22, 12), CDM = Js.alit(6, 16, 4), CM = Js.alit(8, 14, 16, 18), CAM = Js.alit(10, 20, 21), LW = Js.alit(11, 7, 17), RW = Js.alit(7, 11, 17), ST = Js.alit(9, 19, 29, 20) }, { "GK", "CB", "LB", "RB", "CDM", "CM", "CAM", "LW", "RW", "ST" })
	EARN_NUMBER_RELATIONSHIP = 90
	exports.EARN_NUMBER_RELATIONSHIP = EARN_NUMBER_RELATIONSHIP
	NEW_CLUB_GIVES_NUMBER = 0.8
	exports.NEW_CLUB_GIVES_NUMBER = NEW_CLUB_GIVES_NUMBER
end
