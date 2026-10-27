--!nocheck
--!nolint
-- Generated from lib/star/international.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_calendar = import("lib/star/calendar")
	local M_nations = import("lib/star/intl/nations")
	local M_nationKits = import("lib/star/data/nationKits")
	local M_rating = import("lib/star/rating")
	local M_competitions = import("lib/star/competitions")
	local M_squadData = import("lib/star/squadData")
	local M_season = import("lib/star/season")
	local M_nationNames = import("lib/star/nationNames")
	local M_fakeFaces = import("lib/star/fakeFaces")
	local M_career = import("lib/star/intl/career")
	local TOURNAMENT_NAMES, INTL_WINDOWS_PREMIER, INTL_WINDOWS_OTHER, INTL_WINDOW_NAMES, windowWeekends, windowWeek, NATION_STRENGTH, OPPONENTS, EUROPEAN, nationStrength, callUpBar, nationKits, emptyRecord, recentForm, callUpChance, whatHoldsYouBack, competitionFor, decideCallUp, windowDue, applyCallUp, recordIntlMatch, SLOTS, fromLeague, nationalSquad, opponentNationSquad, internationalCareer
	windowWeekends = function(division)
		do return (if (division == "premier") then INTL_WINDOWS_PREMIER else INTL_WINDOWS_OTHER) end
	end
	exports.windowWeekends = windowWeekends
	windowWeek = function(division, i)
		do return M_calendar.weekOnWeekend(division, windowWeekends(division)[i + 1]) end
	end
	exports.windowWeek = windowWeek
	nationStrength = function(nation)
		local n = M_nations.nationFor(nation)
		do return (if n then Math.round(M_nations.rankingStrength(n.points)) else (if NATION_STRENGTH[nation] ~= nil then NATION_STRENGTH[nation] else 60)) end
	end
	exports.nationStrength = nationStrength
	callUpBar = function(nation)
		do return (nationStrength(nation) - 8) end
	end
	exports.callUpBar = callUpBar
	nationKits = function(nation)
		do return (M_nationKits.nationWornKits(nation) or Js.O({ home = Js.O({ shirt = "#e5e7eb", trim = "#374151" }, { "shirt", "trim" }), away = Js.O({ shirt = "#374151", trim = "#e5e7eb" }, { "shirt", "trim" }) }, { "home", "away" })) end
	end
	exports.nationKits = nationKits
	emptyRecord = function()
		do return Js.O({ decided = Js.alit(), callUps = 0, snubs = 0, matches = Js.alit() }, { "decided", "callUps", "snubs", "matches" }) end
	end
	exports.emptyRecord = emptyRecord
	recentForm = function(career)
		local f = (if career.form ~= nil then career.form else Js.alit())
		do return (if Js.T(Js.alen(f)) then (A.reduce(f, function(s, r)
			return (s + r)
		end, 0) / Js.alen(f)) else 6.5) end
	end
	callUpChance = function(career)
		if career.injury then
			do return 0 end
		end
		local nation = (if Js.T(career.player.nationality) then career.player.nationality else "England")
		local overall = M_rating.displayOverall((if career.starRating ~= nil then career.starRating else 2.5))
		local wasIn = (if (function() local _v = career.international; if _v == nil then return nil end; _v = _v.last; if _v == nil then return nil end; _v = _v.called; return _v end)() then 0.8 else 0)
		local logit = ((((overall - callUpBar(nation)) / 3.5) + ((recentForm(career) - 6.8) * 0.9)) + wasIn)
		do return Math.max(0.02, Math.min(0.97, (1 / (1 + Math.exp((-logit)))))) end
	end
	exports.callUpChance = callUpChance
	whatHoldsYouBack = function(career, nation)
		if career.injury then
			do return Js.O({ holdingBack = "injury", closeLine = "Get fit first. An injured player is never picked." }, { "holdingBack", "closeLine" }) end
		end
		local overall = M_rating.displayOverall((if career.starRating ~= nil then career.starRating else 2.5))
		local ratingPart = ((overall - callUpBar(nation)) / 3.5)
		local formPart = ((recentForm(career) - 6.8) * 0.9)
		if ((ratingPart >= 0) and (formPart >= 0)) then
			do return Js.O({ holdingBack = nil, closeLine = ("Your rating and your form both say " .. nation .. ". Keep it going.") }, { "holdingBack", "closeLine" }) end
		end
		if (ratingPart < formPart) then
			do return Js.O({ holdingBack = "rating", closeLine = (if (ratingPart < -2) then ("Your rating is the gap. " .. nation .. "'s regulars are a level above you — train to close it.") else "Your rating is nearly there. A little more training tips it.") }, { "holdingBack", "closeLine" }) end
		end
		do return Js.O({ holdingBack = "form", closeLine = (if (formPart < -1) then "Your form is the gap. A few good games for your club will change his mind." else "Your form is nearly there. Keep the match ratings up.") }, { "holdingBack", "closeLine" }) end
	end
	exports.whatHoldsYouBack = whatHoldsYouBack
	competitionFor = function(season, window, nation)
		if (window == 3) then
			do return "International Friendly" end
		end
		local next_ = (M_competitions.tournamentFor(season) or M_competitions.tournamentFor((season + 1)))
		if ((next_ == "European Championship") and EUROPEAN:has(nation)) then
			do return "Euro Qualifier" end
		end
		do return "World Cup Qualifier" end
	end
	decideCallUp = function(career, i)
		local nation = M_competitions.nationOf(career)
		local seed = M_squadData.clubNameSeed(("intl|" .. career.player.firstName .. " " .. career.player.lastName .. "|" .. Js.numstr(career.season) .. "|" .. Js.numstr(i)))
		local rng = M_season.mulberry32(seed)
		local chance = callUpChance(career)
		local called = (rng() < chance)
		local pool = A.filter(OPPONENTS, function(n)
			return (n ~= nation)
		end)
		local opponent = pool[math.floor((rng() * Js.alen(pool))) + 1]
		local competition = competitionFor(career.season, i, nation)
		local fixture = Js.O({ week = windowWeek(M_calendar.divisionOf(career), i), opponent = opponent, home = (rng() < 0.5), played = false, competition = competition, kind = "international", opponentStrength = nationStrength(opponent) }, { "week", "opponent", "home", "played", "competition", "kind", "opponentStrength" })
		local overall = M_rating.displayOverall((if career.starRating ~= nil then career.starRating else 2.5))
		local bar = callUpBar(nation)
		local reason = (if career.injury then "You're injured, so the manager leaves you out." else (if called then (if (overall >= bar) then "Your level earned it." else "Your form forced his hand.") else (if (overall < (bar - 6)) then (nation .. " have better players in your position for now.") else "Close, but not this time. Keep playing well.")))
		do return Js.ospread(Js.O({ season = career.season, window = i, monthName = INTL_WINDOW_NAMES[i + 1], called = called, chance = chance, nation = nation, fixture = fixture, reason = reason }, { "season", "window", "monthName", "called", "chance", "nation", "fixture", "reason" }), whatHoldsYouBack(career, nation)) end
	end
	exports.decideCallUp = decideCallUp
	windowDue = function(career)
		if ((not Js.T((function() local _v = career.player; if _v == nil then return nil end; _v = _v.club; return _v end)())) or (not Js.T((function() local _v = career.fixtures; if _v == nil then return nil end; _v = Js.len(_v); return _v end)()))) then
			do return nil end
		end
		if A.some(career.fixtures, function(f)
			return (((not f.played) and (f.kind == "international")) and (not Js.T(f.round)))
		end) then
			do return nil end
		end
		local next_ = M_competitions.nextFixtureFor(career)
		if (not next_) then
			do return nil end
		end
		if ((next_.kind == "international") and Js.T(next_.round)) then
			do return nil end
		end
		local division = M_calendar.divisionOf(career)
		local nextT = M_calendar.fixtureTimestamp(career.player.startYear, career.season, next_.week, next_.kind, division)
		local decided = Js.Set.new(((function() local _v = career.international; if _v == nil then return nil end; _v = _v.decided; return _v end)() or Js.alit()))
		local due = nil
		do
			local i = 0
			local _first1 = true
			while true do
				if not _first1 then
					i += 1
				end
				_first1 = false
				if not (i < Js.alen(windowWeekends(division))) then break end
				if decided:has((Js.numstr(career.season) .. ":" .. Js.numstr(i))) then
					do continue end
				end
				local t = M_calendar.fixtureTimestamp(career.player.startYear, career.season, windowWeek(division, i), "international", division)
				if (t < nextT) then
					due = i
				end
			end
		end
		do return due end
	end
	exports.windowDue = windowDue
	applyCallUp = function(career, d)
		local rec = (if career.international ~= nil then career.international else emptyRecord())
		local decided = Js.Set.new(rec.decided)
		do
			local i = 0
			local _first2 = true
			while true do
				if not _first2 then
					i += 1
				end
				_first2 = false
				if not (i <= d.window) then break end
				decided:add((Js.numstr(d.season) .. ":" .. Js.numstr(i)))
			end
		end
		local next_ = Js.ospread(rec, Js.O({ decided = A.filter(Js.Array.from(decided), function(k)
			return (Js.Number(S.split(k, ":")[1]) >= (d.season - 1))
		end), callUps = (rec.callUps + (if d.called then 1 else 0)), snubs = (rec.snubs + (if d.called then 0 else 1)), last = Js.O({ season = d.season, window = d.window, called = d.called, opponent = d.fixture.opponent, competition = (if d.fixture.competition ~= nil then d.fixture.competition else "") }, { "season", "window", "called", "opponent", "competition" }) }, { "decided", "callUps", "snubs", "last" }))
		do return Js.ospread(career, Js.O({ international = next_, fixtures = (if d.called then Js.aspread(career.fixtures, Js.alit(d.fixture)) else career.fixtures) }, { "international", "fixtures" })) end
	end
	exports.applyCallUp = applyCallUp
	recordIntlMatch = function(rec, season, fixture, stats)
		local base = (if rec ~= nil then rec else emptyRecord())
		local m = Js.O({ season = season, competition = (if Js.T(fixture.round) then (Js.str(fixture.competition) .. " · " .. fixture.round) else (if fixture.competition ~= nil then fixture.competition else "International")), opponent = fixture.opponent, us = stats.homeScore, them = stats.awayScore, goals = stats.goals, assists = stats.assists, rating = stats.rating }, { "season", "competition", "opponent", "us", "them", "goals", "assists", "rating" })
		do return Js.ospread(base, Js.O({ matches = A.slice(Js.aspread(Js.alit(m), base.matches), 0, 12) }, { "matches" })) end
	end
	exports.recordIntlMatch = recordIntlMatch
	fromLeague = function(p, nation)
		do return Js.O({ id = ("intl_" .. p.id), name = p.name, shortName = A.slice(S.split(p.name, " "), -1)[1], position = p.position, seasonGoals = 0, seasonAssists = 0, careerGoals = 0, careerAssists = 0, overall = p.overall, imageUrl = p.image, nationality = nation, age = p.age, positions = p.positions }, { "id", "name", "shortName", "position", "seasonGoals", "seasonAssists", "careerGoals", "careerAssists", "overall", "imageUrl", "nationality", "age", "positions" }) end
	end
	nationalSquad = function(career)
		local nation = M_competitions.nationOf(career)
		local youName = (career.player.firstName .. " " .. career.player.lastName)
		local pool = Js.Map.new()
		do
			local _arr3 = (if career.squad ~= nil then career.squad else Js.alit())
			local _i4 = 0
			while _i4 < Js.alen(_arr3) do
				_i4 += 1
				local p = _arr3[_i4]
				if ((p.nationality ~= nation) or (p.name == youName)) then
					do continue end
				end
				pool:set(p.name, Js.ospread(p, Js.O({ id = ("intl_" .. p.id), seasonGoals = 0, seasonAssists = 0, careerGoals = 0, careerAssists = 0 }, { "id", "seasonGoals", "seasonAssists", "careerGoals", "careerAssists" })))
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
						if (((p.nation ~= nation) or (p.name == youName)) or pool:has(p.name)) then
							do continue end
						end
						pool:set(p.name, fromLeague(p, nation))
					end
				end
			end
		end
		local sorted = A.sort(Js.Array.from(pool:values()), function(a, b)
			return ((if b.overall ~= nil then b.overall else 0) - (if a.overall ~= nil then a.overall else 0))
		end)
		local used = Js.Set.new()
		local filler = M_squadData.generateSquad(M_squadData.clubNameSeed(("nation|" .. nation)))
		local names = A.filter(M_nationNames.madeUpNames(nation, (Js.alen(SLOTS) + 1)), function(n)
			return ((n ~= youName) and (not pool:has(n)))
		end)
		local strength = nationStrength(nation)
		local out = Js.alit()
		local real = 0
		A.forEach(SLOTS, function(pos, i)
			local pick = A.find(sorted, function(p)
				return ((not used:has(p.name)) and ((p.position == pos) or (function() local _r = p.positions; if _r == nil then return nil end; return A.includes(_r, pos) end)()))
			end)
			if pick then
				used:add(pick.name)
				A.push(out, pick)
				real += 1
				do return end
			end
			local g = filler[math.fmod(i, Js.alen(filler)) + 1]
			local id = ("intl_gen_" .. Js.numstr(i))
			local name = (if names[i + 1] ~= nil then names[i + 1] else g.name)
			A.push(out, Js.ospread(g, Js.O({ id = id, name = name, shortName = A.slice(S.split(name, " "), -1)[1], position = pos, nationality = nation, overall = Math.max(40, Math.min(92, (((strength - 6) + math.fmod((i * 7), 9)) - 4))), imageUrl = M_fakeFaces.fakeFaceFor((nation .. ":" .. id)) }, { "id", "name", "shortName", "position", "nationality", "overall", "imageUrl" })))
		end)
		do return Js.O({ players = out, real = real }, { "players", "real" }) end
	end
	exports.nationalSquad = nationalSquad
	opponentNationSquad = function(career, nation)
		local youName = (career.player.firstName .. " " .. career.player.lastName)
		local pool = Js.Map.new()
		do
			local _arr9 = (if career.squad ~= nil then career.squad else Js.alit())
			local _i10 = 0
			while _i10 < Js.alen(_arr9) do
				_i10 += 1
				local p = _arr9[_i10]
				if ((p.nationality ~= nation) or (p.name == youName)) then
					do continue end
				end
				pool:set(p.name, Js.O({ id = ("opp_" .. p.id), name = p.name, position = p.position, overall = (if p.overall ~= nil then p.overall else 65), goals = 0, assists = 0, image = p.imageUrl, nation = nation, age = p.age, positions = p.positions, defending = p.defending }, { "id", "name", "position", "overall", "goals", "assists", "image", "nation", "age", "positions", "defending" }))
			end
		end
		do
			local _arr11 = Js.aspread((if career.leagueSquads ~= nil then career.leagueSquads else Js.alit()), (if career.externalSquads ~= nil then career.externalSquads else Js.alit()))
			local _i12 = 0
			while _i12 < Js.alen(_arr11) do
				_i12 += 1
				local sq = _arr11[_i12]
				do
					local _arr13 = sq.players
					local _i14 = 0
					while _i14 < Js.alen(_arr13) do
						_i14 += 1
						local p = _arr13[_i14]
						if (((p.nation ~= nation) or (p.name == youName)) or pool:has(p.name)) then
							do continue end
						end
						pool:set(p.name, Js.ospread(p, Js.O({ id = ("opp_" .. p.id), goals = 0, assists = 0 }, { "id", "goals", "assists" })))
					end
				end
			end
		end
		local sorted = A.sort(Js.Array.from(pool:values()), function(a, b)
			return (b.overall - a.overall)
		end)
		local used = Js.Set.new()
		local names = M_nationNames.madeUpNames(nation, Js.alen(SLOTS))
		local strength = nationStrength(nation)
		do return A.map(SLOTS, function(pos, i)
			local pick = A.find(sorted, function(p)
				return ((not used:has(p.name)) and ((p.position == pos) or (function() local _r = p.positions; if _r == nil then return nil end; return A.includes(_r, pos) end)()))
			end)
			if pick then
				used:add(pick.name)
				do return pick end
			end
			local id = ("opp_gen_" .. Js.numstr(i))
			do return Js.O({ id = id, name = names[i + 1], position = pos, goals = 0, assists = 0, nation = nation, overall = Math.max(40, Math.min(92, (((strength - (if (i < 11) then 4 else 9)) + math.fmod((i * 5), 7)) - 3))), image = M_fakeFaces.fakeFaceFor((nation .. ":" .. id)) }, { "id", "name", "position", "goals", "assists", "nation", "overall", "image" }) end
		end) end
	end
	exports.opponentNationSquad = opponentNationSquad
	internationalCareer = function(career, fixture)
		local nation = M_competitions.nationOf(career)
		if Js.T(fixture.intlId) then
			local n = M_career.myNation(career)
			local tournament = (Js.re("Group|Round|Final|Quarter|Semi", ""):test((if fixture.round ~= nil then fixture.round else "")) and TOURNAMENT_NAMES:has((if fixture.competition ~= nil then fixture.competition else "")))
			local table_ = function(name, strength)
				return Js.O({ name = name, strength = strength, played = 0, won = 0, drawn = 0, lost = 0, goalsFor = 0, goalsAgainst = 0, points = 0 }, { "name", "strength", "played", "won", "drawn", "lost", "goalsFor", "goalsAgainst", "points" })
			end
			do return Js.ospread(career, Js.O({ player = Js.ospread(career.player, Js.O({ club = n }, { "club" })), thisSeasonClub = n, squad = M_career.squadFor(career, n, (if tournament then 26 else 23)), league = Js.alit(table_(n, M_career.nationStrengthNow(career, n)), table_(fixture.opponent, (if fixture.opponentStrength ~= nil then fixture.opponentStrength else M_career.nationStrengthNow(career, fixture.opponent)))), leagueSquads = Js.alit(), externalSquads = Js.alit(Js.O({ club = fixture.opponent, players = M_career.squadAsLeague(career, fixture.opponent) }, { "club", "players" })), ownedClubs = Js.O({}, nil), clubKits = Js.ospread((if career.clubKits ~= nil then career.clubKits else Js.O({}, nil)), (function() local _o = Js.O({}, nil); _o[Js.key(n)] = nationKits(n); _o[Js.key(fixture.opponent)] = nationKits(fixture.opponent); return _o end)()), playAs = nil }, { "player", "thisSeasonClub", "squad", "league", "leagueSquads", "externalSquads", "ownedClubs", "clubKits", "playAs" })) end
		end
		local _d15 = nationalSquad(career)
		local players = _d15.players
		local table_ = function(name, strength)
			return Js.O({ name = name, strength = strength, played = 0, won = 0, drawn = 0, lost = 0, goalsFor = 0, goalsAgainst = 0, points = 0 }, { "name", "strength", "played", "won", "drawn", "lost", "goalsFor", "goalsAgainst", "points" })
		end
		do return Js.ospread(career, Js.O({ player = Js.ospread(career.player, Js.O({ club = nation }, { "club" })), thisSeasonClub = nation, squad = players, league = Js.alit(table_(nation, nationStrength(nation)), table_(fixture.opponent, (if fixture.opponentStrength ~= nil then fixture.opponentStrength else nationStrength(fixture.opponent)))), leagueSquads = Js.alit(), externalSquads = Js.alit(Js.O({ club = fixture.opponent, players = opponentNationSquad(career, fixture.opponent) }, { "club", "players" })), ownedClubs = Js.O({}, nil), clubKits = Js.ospread((if career.clubKits ~= nil then career.clubKits else Js.O({}, nil)), (function() local _o = Js.O({}, nil); _o[Js.key(nation)] = nationKits(nation); _o[Js.key(fixture.opponent)] = nationKits(fixture.opponent); return _o end)()), playAs = nil }, { "player", "thisSeasonClub", "squad", "league", "leagueSquads", "externalSquads", "ownedClubs", "clubKits", "playAs" })) end
	end
	exports.internationalCareer = internationalCareer
	TOURNAMENT_NAMES = Js.Set.new(Js.alit("World Cup", "European Championship", "Copa América", "Africa Cup of Nations", "Asian Cup", "Gold Cup", "OFC Nations Cup"))
	INTL_WINDOWS_PREMIER = Js.alit(4, 10, 14, 33)
	exports.INTL_WINDOWS_PREMIER = INTL_WINDOWS_PREMIER
	INTL_WINDOWS_OTHER = Js.alit(4, 9, 13, 32)
	exports.INTL_WINDOWS_OTHER = INTL_WINDOWS_OTHER
	INTL_WINDOW_NAMES = Js.alit("September", "October", "November", "March")
	exports.INTL_WINDOW_NAMES = INTL_WINDOW_NAMES
	NATION_STRENGTH = Js.O({ Brazil = 90, France = 90, Argentina = 89, Spain = 88, England = 86, Germany = 86, Portugal = 86, Netherlands = 84, Italy = 84, Belgium = 82, Croatia = 81, Uruguay = 80, Colombia = 79, Denmark = 78, Morocco = 78, Switzerland = 77, Senegal = 76, Japan = 76, Mexico = 75, USA = 74, ["United States"] = 74, Norway = 77, Austria = 76, ["Türkiye"] = 75, Turkey = 75, Sweden = 74, Poland = 74, Serbia = 74, Ukraine = 74, Ecuador = 75, ["Korea Republic"] = 73, Nigeria = 74, ["Cote d'Ivoire"] = 74, ["Ivory Coast"] = 74, Scotland = 72, Wales = 70, ["Republic of Ireland"] = 70, Ireland = 70, ["Northern Ireland"] = 66, Czechia = 73, ["Czech Republic"] = 73, Hungary = 72, Ghana = 72, Cameroon = 72, Egypt = 72, Algeria = 73, Australia = 70, Canada = 72, Chile = 72, Peru = 70, Paraguay = 71, Greece = 71, Slovakia = 70, Slovenia = 70, Romania = 70, Iceland = 66, Finland = 66, Jamaica = 65, ["New Zealand"] = 62, ["San Marino"] = 45, Gibraltar = 48 }, { "Brazil", "France", "Argentina", "Spain", "England", "Germany", "Portugal", "Netherlands", "Italy", "Belgium", "Croatia", "Uruguay", "Colombia", "Denmark", "Morocco", "Switzerland", "Senegal", "Japan", "Mexico", "USA", "United States", "Norway", "Austria", "Türkiye", "Turkey", "Sweden", "Poland", "Serbia", "Ukraine", "Ecuador", "Korea Republic", "Nigeria", "Cote d'Ivoire", "Ivory Coast", "Scotland", "Wales", "Republic of Ireland", "Ireland", "Northern Ireland", "Czechia", "Czech Republic", "Hungary", "Ghana", "Cameroon", "Egypt", "Algeria", "Australia", "Canada", "Chile", "Peru", "Paraguay", "Greece", "Slovakia", "Slovenia", "Romania", "Iceland", "Finland", "Jamaica", "New Zealand", "San Marino", "Gibraltar" })
	exports.NATION_STRENGTH = NATION_STRENGTH
	OPPONENTS = Js.alit("Brazil", "France", "Argentina", "Spain", "Germany", "Portugal", "Netherlands", "Italy", "Belgium", "Croatia", "Uruguay", "Denmark", "Switzerland", "Mexico", "Japan", "Senegal", "Morocco", "USA", "Norway", "Austria", "Poland", "Sweden", "Scotland", "Wales", "Serbia", "Hungary", "Greece", "Iceland", "Finland")
	EUROPEAN = Js.Set.new(Js.alit("England", "Scotland", "Wales", "Northern Ireland", "Republic of Ireland", "Ireland", "France", "Spain", "Germany", "Portugal", "Netherlands", "Italy", "Belgium", "Croatia", "Denmark", "Switzerland", "Norway", "Austria", "Türkiye", "Turkey", "Sweden", "Poland", "Serbia", "Ukraine", "Czechia", "Czech Republic", "Hungary", "Greece", "Slovakia", "Slovenia", "Romania", "Iceland", "Finland", "San Marino", "Gibraltar", "Albania", "Bosnia and Herzegovina", "Bulgaria", "Georgia", "Israel", "Kosovo", "Montenegro", "North Macedonia", "Russia", "Belarus", "Estonia", "Latvia", "Lithuania", "Luxembourg", "Malta", "Moldova", "Cyprus", "Faroe Islands", "Armenia", "Azerbaijan", "Kazakhstan", "Andorra", "Liechtenstein"))
	exports.EUROPEAN = EUROPEAN
	SLOTS = Js.alit("GK", "GK", "CB", "CB", "CB", "LB", "RB", "CDM", "CM", "CM", "CM", "CAM", "LW", "RW", "ST", "ST", "LB", "RB", "LW", "RW")
end
