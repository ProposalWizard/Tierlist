--!nocheck
--!nolint
-- Generated from lib/star/careerFlow.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_shopData = import("lib/star/shopData")
	local M_tuningStore = import("lib/star/tuningStore")
	local M_reputation = import("lib/star/reputation")
	local M_unlocks = import("lib/star/unlocks")
	local M_kits = import("lib/star/kits")
	local M_week = import("lib/star/week")
	local M_rating = import("lib/star/rating")
	local M_starPoints = import("lib/star/starPoints")
	local M_economy = import("lib/star/economy")
	local M_season = import("lib/star/season")
	local M_squadData = import("lib/star/squadData")
	local M_clubs = import("lib/star/clubs")
	local M_recognition = import("lib/star/recognition")
	local M_manager = import("lib/star/manager")
	local M_managerPool = import("lib/star/managerPool")
	local M_competitions = import("lib/star/competitions")
	local M_calendar = import("lib/star/calendar")
	local M_energy = import("lib/star/energy")
	local M_fame = import("lib/star/fame")
	local M_facilities = import("lib/star/facilities")
	local M_relationships = import("lib/star/relationships")
	local M_ruleBook = import("lib/star/ruleBook")
	local M_grammar = import("lib/star/media/grammar")
	local M_liveScores = import("lib/star/liveScores")
	local M_incumbency = import("lib/star/incumbency")
	local M_injurySwitch = import("lib/star/injurySwitch")
	local M_rivalries = import("lib/star/rivalries")
	local M_sponsors = import("lib/star/sponsors")
	local M_tournament = import("lib/star/tournament")
	local M_shootout = import("lib/star/shootout")
	local M_index = import("lib/star/world/index")
	local M_records = import("lib/star/records")
	local M_potm = import("lib/star/potm")
	local M_careerRecords = import("lib/star/careerRecords")
	local M_feats = import("lib/star/feats")
	local M_international = import("lib/star/international")
	local M_contracts = import("lib/star/contracts")
	local M_lowerLeagueTrophy = import("lib/star/lowerLeagueTrophy")
	local M_horse = import("lib/star/horse")
	local M_selection = import("lib/star/selection")
	local M_managerMoments = import("lib/star/managerMoments")
	local M_playoffs = import("lib/star/playoffs")
	local M_sponsorDeals = import("lib/star/sponsorDeals")
	local M_career = import("lib/star/intl/career")
	local M_goalLog = import("lib/star/goalLog")
	local M_leagueTransfers = import("lib/star/leagueTransfers")
	local M_cups = import("lib/star/cups")
	local M_englishTopFlight = import("lib/star/englishTopFlight")
	local M_promotion = import("lib/star/promotion")
	local M_euro = import("lib/star/euro")
	local M_ballonDor = import("lib/star/ballonDor")
	local M_expectations = import("lib/star/expectations")
	local M_summary = import("lib/star/world/summary")
	local M_competitionBetting = import("lib/star/competitionBetting")
	local M_seasonStanding = import("lib/star/seasonStanding")
	local M_history = import("lib/star/world/history")
	local M_leagueSquads = import("lib/star/leagueSquads")
	local M_worldAgeing = import("lib/star/worldAgeing")
	local M_retirementNews = import("lib/star/retirementNews")
	local M_clubPowers = import("lib/star/clubPowers")
	local M_achievements = import("lib/star/achievements")
	local M_wages = import("lib/star/wages")
	local SPONSOR_CATEGORIES, EMPTY_SEASON_STATS, ENERGY_MATCH_COST, INJURY_RISK_BASE, INJURY_FATIGUE_FLOOR, INJURY_RISK_FATIGUE_EXTRA, injuryRiskFor, rollInjury, STARTER_BOOT_MATCHES, makeIdentity, STARTER_WAGE, STARTER_CONTRACT, FIRST_CONTRACT_SIGNING_FEE, attachClub, makeInitialCareer, STAR_OFFER_MILESTONES, FORM_OFFER_THRESHOLD, FORM_OFFER_MIN_MATCHES, checkForContractOffer, willingToRenegotiate, markContractOfferUsed, decaySkills, restRecoveryAfter, creditMatchResult, WINDOW_ORDER, windowOrdinal, runDueTransferWindow, awardLeagueTrophyIfWon, winnersList, finishedCupsOf, resolveSeasonWinners, ladderFor, seasonClubMove, seasonHistoryAfter, closeFinalSeason, advanceSeason, clamp01to100, applyAchievements, simulateMissedFixture
	injuryRiskFor = function(energyAtFullTime)
		do return (INJURY_RISK_BASE + (Math.max(0, ((INJURY_FATIGUE_FLOOR - energyAtFullTime) / INJURY_FATIGUE_FLOOR)) * INJURY_RISK_FATIGUE_EXTRA)) end
	end
	exports.injuryRiskFor = injuryRiskFor
	rollInjury = function(rng)
		local r = rng()
		if (r < 0.6) then
			local weeks = (1 + math.floor((rng() * 2)))
			do return Js.O({ weeksRemaining = weeks, note = ("Knock — expected back in " .. Js.numstr(weeks) .. " week" .. (if (weeks == 1) then "" else "s")) }, { "weeksRemaining", "note" }) end
		end
		if (r < 0.9) then
			local weeks = (3 + math.floor((rng() * 2)))
			do return Js.O({ weeksRemaining = weeks, note = ("Injury — expected back in " .. Js.numstr(weeks) .. " weeks") }, { "weeksRemaining", "note" }) end
		end
		local weeks = (5 + math.floor((rng() * 4)))
		do return Js.O({ weeksRemaining = weeks, note = ("Serious injury — expected back in " .. Js.numstr(weeks) .. " weeks") }, { "weeksRemaining", "note" }) end
	end
	exports.rollInjury = rollInjury
	makeIdentity = function(player, division)
		if division == nil then division = "premier" end
		local starterBoot = Js.ospread(M_shopData.BOOTS_CATALOGUE[1], Js.O({ matches = STARTER_BOOT_MATCHES }, { "matches" }))
		local state = Js.O({ version = 2, player = player, skills = Js.O({ pace = M_tuningStore.getTuning("startingSkills.pace"), power = M_tuningStore.getTuning("startingSkills.power"), technique = M_tuningStore.getTuning("startingSkills.technique"), vision = M_tuningStore.getTuning("startingSkills.vision"), freeKick = M_tuningStore.getTuning("startingSkills.freeKick"), aerial = M_tuningStore.getTuning("startingSkills.aerial") }, { "pace", "power", "technique", "vision", "freeKick", "aerial" }), lastTrainedWeek = Js.O({ pace = 1, power = 1, technique = 1, vision = 1, freeKick = 1, aerial = 1 }, { "pace", "power", "technique", "vision", "freeKick", "aerial" }), relationships = Js.O({ boss = 50, team = 50, fans = 50, girlfriend = nil, sponsors = 0 }, { "boss", "team", "fans", "girlfriend", "sponsors" }), reputation = M_reputation.NEW_CAREER_REPUTATION, unlocks = M_unlocks.freshUnlocks(), contract = Js.O({ club = player.club, wage = 0, goalBonus = 0, assistBonus = 0, seasonsRemaining = 0 }, { "club", "wage", "goalBonus", "assistBonus", "seasonsRemaining" }), season = 1, division = division, week = 1, matchFitness = 80, energy = 100, injury = nil, happiness = 45, money = 0, starRating = 2.5, fame = 1, seasonStats = Js.ospread(EMPTY_SEASON_STATS), careerStats = Js.ospread(EMPTY_SEASON_STATS), fixtures = Js.alit(), league = Js.alit(), achievements = Js.alit(), status = "1st Team", currentBoot = Js.ospread(starterBoot, Js.O({ matches = 0 }, { "matches" })), kibCans = Js.O({ basic = 0, premium = 0, elite = 0 }, { "basic", "premium", "elite" }), ownedItems = Js.alit(), girlfriend = nil, sponsors = A.map(SPONSOR_CATEGORIES, function(c)
			return Js.O({ category = c, active = false }, { "category", "active" })
		end), trophies = Js.alit(), form = Js.alit(), kitPrimary = M_kits.kitsOf(player.club).home.shirt, kitSecondary = M_kits.kitsOf(player.club).home.trim, homeCity = "London", seenDilemmas = Js.alit(), ballonDorWins = 0, horse = nil, squad = Js.alit(), contractStarMilestones = Js.alit(), contractFormOfferSeason = -1, europeanQualification = nil, weekActions = M_week.WEEK_ACTIONS, awards = Js.alit(), captain = false, clubAppearances = 0, cups = Js.alit(), caps = 0, internationalGoals = 0, knockoutMessage = nil, lastTransferWindowKey = "1-summer", deadlineDayShownFor = "1-summer" }, { "version", "player", "skills", "lastTrainedWeek", "relationships", "reputation", "unlocks", "contract", "season", "division", "week", "matchFitness", "energy", "injury", "happiness", "money", "starRating", "fame", "seasonStats", "careerStats", "fixtures", "league", "achievements", "status", "currentBoot", "kibCans", "ownedItems", "girlfriend", "sponsors", "trophies", "form", "kitPrimary", "kitSecondary", "homeCity", "seenDilemmas", "ballonDorWins", "horse", "squad", "contractStarMilestones", "contractFormOfferSeason", "europeanQualification", "weekActions", "awards", "captain", "clubAppearances", "cups", "caps", "internationalGoals", "knockoutMessage", "lastTransferWindowKey", "deadlineDayShownFor" })
		state.starRating = M_rating.computeStarRating(state)
		do return M_starPoints.withStars(state) end
	end
	exports.makeIdentity = makeIdentity
	attachClub = function(identity, club, clubs, division, agreedWage)
		if division == nil then division = "premier" end
		local firstSigning = (not A.includes(identity.achievements, "first-contract"))
		local gardenWeeks = ((if identity.gardenWeeks ~= nil then identity.gardenWeeks else 0) + Math.max(0, (identity.week - 1)))
		local state = Js.ospread(identity, Js.O({ skills = Js.ospread(identity.skills), lastTrainedWeek = Js.ospread(identity.lastTrainedWeek), relationships = Js.ospread(identity.relationships), reputation = identity.reputation, seasonStats = Js.ospread(identity.seasonStats), careerStats = Js.ospread(identity.careerStats), kibCans = Js.ospread(identity.kibCans), currentBoot = Js.ospread(identity.currentBoot), sponsors = A.map(identity.sponsors, function(sp)
			return Js.ospread(sp)
		end), trophies = Js.aspread(identity.trophies), form = Js.aspread(identity.form), seenDilemmas = Js.aspread(identity.seenDilemmas), ownedItems = Js.aspread(identity.ownedItems), player = Js.ospread(identity.player, Js.O({ club = club }, { "club" })), contract = (if (firstSigning and (not Js.T(identity.contract.wage))) then Js.ospread(identity.contract, Js.O({ club = club }, { "club" }), STARTER_CONTRACT) else Js.ospread(identity.contract, Js.O({ club = club }, { "club" }))), money = (if firstSigning then (identity.money + FIRST_CONTRACT_SIGNING_FEE) else (identity.money + M_economy.signingOnFee(club, (if agreedWage ~= nil then agreedWage else (if Js.T(identity.contract.wage) then identity.contract.wage else STARTER_CONTRACT.wage))))), achievements = (if firstSigning then Js.aspread(identity.achievements, Js.alit("first-contract")) else Js.aspread(identity.achievements)), week = 1 }, { "skills", "lastTrainedWeek", "relationships", "reputation", "seasonStats", "careerStats", "kibCans", "currentBoot", "sponsors", "trophies", "form", "seenDilemmas", "ownedItems", "player", "contract", "money", "achievements", "week" }), (if (gardenWeeks > 0) then Js.O({ gardenWeeks = gardenWeeks }, { "gardenWeeks" }) else nil), Js.O({ division = division, league = M_season.buildLeague(clubs, club), fixtures = M_season.buildFixtures(clubs, club), kitPrimary = M_kits.kitsOf(club).home.shirt, kitSecondary = M_kits.kitsOf(club).home.trim, squad = M_squadData.generateSquad(M_squadData.clubNameSeed(club)), europeanQualification = (if M_clubs.STARTING_EUROPEAN_QUALIFICATION[club] ~= nil then M_clubs.STARTING_EUROPEAN_QUALIFICATION[club] else nil) }, { "division", "league", "fixtures", "kitPrimary", "kitSecondary", "squad", "europeanQualification" }))
		state.squadNumber = M_recognition.numberOnSigning(state, club, firstSigning)
		state.manager = M_manager.makeManager(state, club, state.season)
		state.availableManagers = A.filter(M_managerPool.allPoolManagers(), function(n)
			return (n ~= state.manager.name)
		end)
		local seeded = M_competitions.seedSeasonKnockouts(state)
		state.cups = seeded.runs
		local drawn = M_competitions.seedCups(state)
		state.cupState = drawn.states
		state.fixtures = Js.aspread(state.fixtures, seeded.fixtures, drawn.fixtures)
		local euro = M_competitions.seedEurope(state)
		state.euroState = (if euro.state ~= nil then euro.state else nil)
		state.fixtures = Js.aspread(state.fixtures, euro.fixtures)
		state.starRating = M_rating.computeStarRating(state)
		do return M_starPoints.withStars(state) end
	end
	exports.attachClub = attachClub
	makeInitialCareer = function(player, clubs, division)
		if division == nil then division = "premier" end
		do return attachClub(makeIdentity(player, division), player.club, clubs, division) end
	end
	exports.makeInitialCareer = makeInitialCareer
	checkForContractOffer = function(career)
		if (career.contract.seasonsRemaining < 2) then
			do return nil end
		end
		local milestones = (if career.contractStarMilestones ~= nil then career.contractStarMilestones else Js.alit())
		do
			local _arr1 = STAR_OFFER_MILESTONES
			local _i2 = 0
			while _i2 < Js.alen(_arr1) do
				_i2 += 1
				local m = _arr1[_i2]
				if ((career.starRating >= m) and (not A.includes(milestones, m))) then
					do return "star" end
				end
			end
		end
		local lastFormSeason = (if career.contractFormOfferSeason ~= nil then career.contractFormOfferSeason else -1)
		if ((lastFormSeason ~= career.season) and (Js.alen(career.form) >= FORM_OFFER_MIN_MATCHES)) then
			local avg = (A.reduce(career.form, function(s, r)
				return (s + r)
			end, 0) / Js.alen(career.form))
			if (avg >= FORM_OFFER_THRESHOLD) then
				do return "form" end
			end
		end
		do return nil end
	end
	exports.checkForContractOffer = checkForContractOffer
	willingToRenegotiate = function(career)
		if (career.starRating >= STAR_OFFER_MILESTONES[1]) then
			do return true end
		end
		if (Js.alen(career.form) >= FORM_OFFER_MIN_MATCHES) then
			local avg = (A.reduce(career.form, function(s, r)
				return (s + r)
			end, 0) / Js.alen(career.form))
			if (avg >= FORM_OFFER_THRESHOLD) then
				do return true end
			end
		end
		do return false end
	end
	exports.willingToRenegotiate = willingToRenegotiate
	markContractOfferUsed = function(career, reason)
		if (reason == "star") then
			local milestones = (if career.contractStarMilestones ~= nil then career.contractStarMilestones else Js.alit())
			local triggered = A.find(STAR_OFFER_MILESTONES, function(m)
				return ((career.starRating >= m) and (not A.includes(milestones, m)))
			end)
			if (triggered ~= nil) then
				do return Js.ospread(career, Js.O({ contractStarMilestones = Js.aspread(milestones, Js.alit(triggered)) }, { "contractStarMilestones" })) end
			end
		end
		if (reason == "form") then
			do return Js.ospread(career, Js.O({ contractFormOfferSeason = career.season }, { "contractFormOfferSeason" })) end
		end
		do return career end
	end
	exports.markContractOfferUsed = markContractOfferUsed
	decaySkills = function(career, rng)
		local overdue = M_tuningStore.getTuning("attributes.decayCheckWeeks")
		local chance = M_tuningStore.getTuning("attributes.decayChance")
		local minLoss = M_tuningStore.getTuning("attributes.decayMin")
		local maxLoss = M_tuningStore.getTuning("attributes.decayMax")
		local floor = M_tuningStore.getTuning("attributes.decayFloor")
		local lastTrained = (if career.lastTrainedWeek ~= nil then career.lastTrainedWeek else Js.O({}, nil))
		local skills = career.skills
		local lastTrainedWeek = lastTrained
		local changed = false
		do
			local _arr3 = Js.Object.keys(career.skills)
			local _i4 = 0
			while _i4 < Js.alen(_arr3) do
				_i4 += 1
				local key = _arr3[_i4]
				local since = (career.week - (if lastTrained[key] ~= nil then lastTrained[key] else 1))
				if (since < overdue) then
					do continue end
				end
				if (rng() >= chance) then
					do continue end
				end
				local loss = (minLoss + math.floor((rng() * ((maxLoss - minLoss) + 1))))
				if (not changed) then
					skills = Js.ospread(career.skills)
					lastTrainedWeek = Js.ospread(lastTrained)
					changed = true
				end
				skills[key] = Math.max(floor, (skills[key] - loss))
				lastTrainedWeek[key] = career.week
			end
		end
		do return (if changed then Js.ospread(career, Js.O({ skills = skills, lastTrainedWeek = lastTrainedWeek }, { "skills", "lastTrainedWeek" })) else career) end
	end
	exports.decaySkills = decaySkills
	restRecoveryAfter = function(career, settled, fixtures)
		local division = M_calendar.divisionOf(career)
		local next_ = M_competitions.nextFixtureFor(Js.ospread(career, Js.O({ fixtures = fixtures }, { "fixtures" })))
		if (not next_) then
			do return 0 end
		end
		local from = M_calendar.fixtureTimestamp(career.player.startYear, career.season, settled.week, settled.kind, division)
		local to = M_calendar.fixtureTimestamp(career.player.startYear, career.season, next_.week, next_.kind, division)
		local days = M_energy.restDaysBetween(from, to)
		local ownsProperty = A.some((if career.ownedItems ~= nil then career.ownedItems else Js.alit()), function(i)
			return ((i.category == "property") and (not M_fame.isWornOut(i)))
		end)
		local tier = (if Js.T(career.player.club) then M_facilities.facilitiesFor(career, career.player.club).trainingGroundTier else 1)
		if (((function() local _v = career.unlocks; if _v == nil then return nil end; _v = _v.story; return _v end)() and (not A.includes(career.unlocks.seen, "beat-can"))) and (((function() local _v = career.careerStats; if _v == nil then return nil end; _v = _v.appearances; return _v end)() or 0) < 1)) then
			do return 100 end
		end
		do return ((days * M_energy.dailyRecovery(ownsProperty, tier)) * M_relationships.happinessEnergyFactor(M_relationships.happinessOf(career))) end
	end
	exports.restRecoveryAfter = restRecoveryAfter
	creditMatchResult = function(career, fixture, stats)
		local kind = (if fixture.kind ~= nil then fixture.kind else "league")
		local sameFixture = function(f)
			return (((f.week == fixture.week) and ((if f.kind ~= nil then f.kind else "league") == kind)) and (f.opponent == fixture.opponent))
		end
		local alreadyPlayed = A.some(career.fixtures, function(f)
			return (sameFixture(f) and f.played)
		end)
		local accrue = function(base)
			return (if alreadyPlayed then base else Js.O({ appearances = (base.appearances + 1), goals = (base.goals + stats.goals), hatTricks = (base.hatTricks + (if (stats.goals >= 3) then 1 else 0)), passes = (base.passes + stats.passes), assists = (base.assists + stats.assists), starMan = (base.starMan + (if stats.starMan then 1 else 0)), totalRating = (base.totalRating + stats.rating), ratingCount = (base.ratingCount + 1) }, { "appearances", "goals", "hatTricks", "passes", "assists", "starMan", "totalRating", "ratingCount" }))
		end
		local league = career.league
		local weekResults = (if career.results ~= nil then career.results else Js.alit())
		local leagueSquads = career.leagueSquads
		local incumbents = career.incumbents
		if ((kind == "league") and (not alreadyPlayed)) then
			local faRules = M_ruleBook.ruleBookFor(career, "FA")
			local rng = M_season.mulberry32(((career.season * 1000) + career.week))
			league = M_season.updateLeagueWithUserResult(career.league, career.player.club, fixture.opponent, stats.homeScore, stats.awayScore, faRules, rng)
			local scored = stats.homeScore
			local conceded = stats.awayScore
			local yours = A.map((if stats.goalEvents ~= nil then stats.goalEvents else Js.alit()), function(e)
				return Js.ospread(Js.O({ m = e.minute, s = M_grammar.surname(e.scorer) }, { "m", "s" }), (if Js.T(e.assist) then Js.O({ a = M_grammar.surname(e.assist) }, { "a" }) else Js.O({}, nil)))
			end)
			local theirs = A.map((if stats.oppGoalEvents ~= nil then stats.oppGoalEvents else Js.alit()), function(e)
				return Js.ospread(Js.O({ id = e.scorerId, m = e.minute, s = M_grammar.surname(e.scorer) }, { "id", "m", "s" }), (if Js.T(e.assistId) then Js.O({ assistId = e.assistId }, { "assistId" }) else Js.O({}, nil)), (if Js.T(e.assist) then Js.O({ a = M_grammar.surname(e.assist) }, { "a" }) else Js.O({}, nil)))
			end)
			local squads = A.map((if career.leagueSquads ~= nil then career.leagueSquads else Js.alit()), function(sq)
				return Js.ospread(sq, Js.O({ players = A.map(sq.players, function(p)
					return Js.ospread(p)
				end) }, { "players" }))
			end)
			local round = M_season.playLeagueWeek(league, fixture.week, Js.O({ club = career.player.club, opponent = fixture.opponent, home = fixture.home, scored = scored, conceded = conceded, goals = yours, oppGoals = theirs }, { "club", "opponent", "home", "scored", "conceded", "goals", "oppGoals" }), rng, squads, faRules, M_liveScores.otherGamesRng(career.season, fixture.week))
			league = round.league
			leagueSquads = squads
			weekResults = Js.aspread(A.filter(weekResults, function(r)
				return (r.week ~= fixture.week)
			end), round.results)
			local withIncumbency = M_incumbency.advanceIncumbencyWeek(Js.ospread(career, Js.O({ leagueSquads = leagueSquads, incumbents = incumbents }, { "leagueSquads", "incumbents" })), round.results)
			leagueSquads = withIncumbency.leagueSquads
			incumbents = withIncumbency.incumbents
		end
		local fixtures = A.map(career.fixtures, function(f)
			return (if ((f == fixture) or sameFixture(f)) then Js.ospread(f, Js.O({ played = true, homeScore = (if f.home then stats.homeScore else stats.awayScore), awayScore = (if f.home then stats.awayScore else stats.homeScore), userGoals = stats.goals, userAssists = stats.assists, userRating = stats.rating }, { "played", "homeScore", "awayScore", "userGoals", "userAssists", "userRating" })) else f)
		end)
		local minuteShare = Math.max(0.25, Math.min(1, ((if stats.minutes ~= nil then stats.minutes else 90) / 90)))
		local afterMatch = (if (stats.endEnergy ~= nil) then stats.endEnergy else (career.energy - ((M_energy.ENERGY_FULL_MATCH_MEDIUM * M_energy.energyFactorFor(career, fixture)) * minuteShare)))
		local nextEnergy = (if alreadyPlayed then career.energy else Math.round(M_energy.clampEnergy((M_energy.clampEnergy(afterMatch) + restRecoveryAfter(career, fixture, fixtures)))))
		local fatigueAtFullTime = (if stats.endEnergy ~= nil then stats.endEnergy else career.energy)
		local injuryRisk = injuryRiskFor(fatigueAtFullTime)
		local injuryRng = M_season.mulberry32((((career.season * 8191) + (fixture.week * 97)) + (S.len(fixture.opponent) * 3)))
		local nextInjury = (if (((M_injurySwitch.INJURIES_ON and (not alreadyPlayed)) and (not career.injury)) and (injuryRng() < injuryRisk)) then rollInjury(injuryRng) else career.injury)
		local nextHeadToHead = (function()
			if ((kind == "international") or alreadyPlayed) then
				do return (if career.headToHead ~= nil then career.headToHead else Js.O({}, nil)) end
			end
			local prior = ((function() local _v = career.headToHead; if _v == nil then return nil end; _v = _v[fixture.opponent]; return _v end)() or Js.O({ wins = 0, draws = 0, losses = 0 }, { "wins", "draws", "losses" }))
			local result = (if (stats.homeScore > stats.awayScore) then "wins" else (if (stats.homeScore < stats.awayScore) then "losses" else "draws"))
			do return Js.ospread((if career.headToHead ~= nil then career.headToHead else Js.O({}, nil)), (function() local _o = Js.O({}, nil); _o[Js.key(fixture.opponent)] = Js.ospread(prior, (function() local _o = Js.O({}, nil); _o[Js.key(result)] = (prior[result] + 1); return _o end)()); return _o end)()) end
		end)()
		local derbyScale = M_rivalries.rivalryMultiplier(career.player.club, fixture.opponent)
		local currentBoot = (if alreadyPlayed then career.currentBoot else Js.ospread(career.currentBoot, Js.O({ matches = Math.max(0, (career.currentBoot.matches - 1)) }, { "matches" })))
		local horse = (if (alreadyPlayed or (not career.horse)) then career.horse else Js.ospread(career.horse, Js.O({ energy = Math.min(100, (career.horse.energy + 20)) }, { "energy" })))
		local sponsorGain = (if alreadyPlayed then 0 else Math.max(0, math.floor((stats.fansChange / 3))))
		local newSponsorRel = Math.min(100, (career.relationships.sponsors + sponsorGain))
		local progressed = (if alreadyPlayed then Js.O({ sponsors = career.sponsors, earned = 0, completed = Js.alit() }, { "sponsors", "earned", "completed" }) else M_sponsors.progressObjectives(career.sponsors, stats, accrue(career.seasonStats), Js.O({ home = fixture.home }, { "home" })))
		local sponsors = progressed.sponsors
		local goalEvents = (if alreadyPlayed then Js.alit() else (if stats.goalEvents ~= nil then stats.goalEvents else Js.alit()))
		local updatedSquad = A.map((if career.squad ~= nil then career.squad else Js.alit()), function(p)
			if (kind == "international") then
				do return p end
			end
			local scored = Js.alen(A.filter(goalEvents, function(e)
				return ((not e.isUserGoal) and (e.scorer == p.name))
			end))
			local assisted = Js.alen(A.filter(goalEvents, function(e)
				return (e.assist == p.name)
			end))
			if ((scored == 0) and (assisted == 0)) then
				do return p end
			end
			do return Js.ospread(p, Js.O({ seasonGoals = (p.seasonGoals + scored), seasonAssists = (p.seasonAssists + assisted), careerGoals = (p.careerGoals + scored), careerAssists = (p.careerAssists + assisted), leagueGoals = ((if p.leagueGoals ~= nil then p.leagueGoals else p.seasonGoals) + (if (kind == "league") then scored else 0)), leagueAssists = ((if p.leagueAssists ~= nil then p.leagueAssists else p.seasonAssists) + (if (kind == "league") then assisted else 0)) }, { "seasonGoals", "seasonAssists", "careerGoals", "careerAssists", "leagueGoals", "leagueAssists" })) end
		end)
		local cups = (if career.cups ~= nil then career.cups else Js.alit())
		local extraFixtures = Js.alit()
		local cupTrophy = nil
		local knockoutMessage = nil
		local cupState = career.cupState
		local euroState = career.euroState
		local externalSquads = career.externalSquads
		local tournament = career.tournament
		local tourn = (if (not alreadyPlayed) then M_tournament.settleTournamentMatch(career, fixture, Js.O({ us = stats.homeScore, them = stats.awayScore, pens = stats.shootout, extraTime = stats.wentToExtraTime }, { "us", "them", "pens", "extraTime" })) else nil)
		if tourn then
			tournament = tourn.state
			extraFixtures = (if tourn.nextFixture then Js.alit(tourn.nextFixture) else Js.alit())
			cupTrophy = tourn.trophy
			knockoutMessage = tourn.message
		elseif (((kind ~= "league") and Js.T(fixture.competition)) and (not alreadyPlayed)) then
			local euroYours = A.map((if stats.goalEvents ~= nil then stats.goalEvents else Js.alit()), function(e)
				return Js.ospread(Js.O({ m = e.minute, s = M_grammar.surname(e.scorer) }, { "m", "s" }), (if Js.T(e.assist) then Js.O({ a = M_grammar.surname(e.assist) }, { "a" }) else Js.O({}, nil)))
			end)
			local euroTheirs = A.map((if stats.oppGoalEvents ~= nil then stats.oppGoalEvents else Js.alit()), function(e)
				return Js.ospread(Js.O({ id = e.scorerId, m = e.minute, s = M_grammar.surname(e.scorer) }, { "id", "m", "s" }), (if Js.T(e.assistId) then Js.O({ assistId = e.assistId }, { "assistId" }) else Js.O({}, nil)), (if Js.T(e.assist) then Js.O({ a = M_grammar.surname(e.assist) }, { "a" }) else Js.O({}, nil)))
			end)
			local euroSquads = A.map((if career.externalSquads ~= nil then career.externalSquads else Js.alit()), function(sq)
				return Js.ospread(sq, Js.O({ players = A.map(sq.players, function(p)
					return Js.ospread(p)
				end) }, { "players" }))
			end)
			local livePens = (if stats.shootout then Js.O({ us = stats.shootout.home, them = stats.shootout.away }, { "us", "them" }) else nil)
			local euro = M_competitions.settleEuro(career, fixture, stats.homeScore, stats.awayScore, euroSquads, euroYours, euroTheirs, livePens)
			if euro then
				externalSquads = euroSquads
			end
			local settled = (if euro then nil else M_competitions.settleCupTie(career, fixture, stats.homeScore, stats.awayScore, stats.wentToExtraTime, stats.shootout))
			if euro then
				euroState = euro.state
				extraFixtures = (if euro.nextFixture then Js.alit(euro.nextFixture) else Js.alit())
				cupTrophy = euro.trophy
				knockoutMessage = euro.message
			elseif settled then
				cupState = settled.states
				extraFixtures = (if settled.nextFixture then Js.alit(settled.nextFixture) else Js.alit())
				cupTrophy = settled.trophy
				knockoutMessage = settled.message
			elseif ((fixture.competition == "Community Shield") or (fixture.competition == "Super Cup")) then
				local club = career.player.club
				local scored = stats.homeScore
				local conceded = stats.awayScore
				local rng = M_season.mulberry32(((career.season * 4441) + (fixture.week * 17)))
				local won = nil
				if (scored ~= conceded) then
					won = (scored > conceded)
				elseif stats.shootout then
					local yourPens = (if fixture.home then stats.shootout.home else stats.shootout.away)
					local theirPens = (if fixture.home then stats.shootout.away else stats.shootout.home)
					won = (yourPens > theirPens)
				else
					local mine = ((function() local _v = A.find(career.league, function(t)
						return (t.name == club)
					end); if _v == nil then return nil end; _v = _v.strength; return _v end)() or 70)
					local theirs = (if fixture.opponentStrength ~= nil then fixture.opponentStrength else 70)
					local pens = M_shootout.simulateShootout(mine, theirs, rng)
					won = (pens.home > pens.away)
				end
				if won then
					cupTrophy = Js.O({ season = career.season, competition = fixture.competition, club = club }, { "season", "competition", "club" })
					knockoutMessage = (club .. " win the " .. fixture.competition .. ".")
				else
					knockoutMessage = ("Beaten in the " .. fixture.competition .. " by " .. fixture.opponent .. ".")
				end
			else
				local idx = A.findIndex(cups, function(r)
					return ((r.competition == fixture.competition) and (not r.eliminated))
				end)
				if (idx >= 0) then
					local out = M_competitions.resolveKnockout(career, cups[idx + 1], fixture, stats.homeScore, stats.awayScore)
					cups = A.map(cups, function(r, i)
						return (if (i == idx) then out.run else r)
					end)
					if out.nextFixture then
						extraFixtures = Js.alit(out.nextFixture)
					end
					cupTrophy = out.trophy
					knockoutMessage = out.message
				end
			end
		end
		local world = career.world
		if (not alreadyPlayed) then
			local clock = M_calendar.fixtureTimestamp(career.player.startYear, career.season, fixture.week, fixture.kind, M_calendar.divisionOf(career))
			local cupsRng = M_season.mulberry32((((career.season * 60013) + (fixture.week * 7)) + 41))
			cupState = M_competitions.advanceEliminatedCups(Js.ospread(career, Js.O({ cupState = cupState }, { "cupState" })), clock, cupsRng)
			extraFixtures = Js.aspread(extraFixtures, M_competitions.newCupFixtures(Js.ospread(career, Js.O({ cupState = cupState, fixtures = Js.aspread(career.fixtures, extraFixtures) }, { "cupState", "fixtures" })), (if cupState ~= nil then cupState else Js.alit())))
			extraFixtures = Js.aspread(extraFixtures, M_competitions.cupFixturesOwed(Js.ospread(career, Js.O({ fixtures = Js.aspread(career.fixtures, extraFixtures) }, { "fixtures" })), (if cupState ~= nil then cupState else Js.alit())))
			world = M_index.worldAfterMatch(career, clock)
		end
		local isInternational = (kind == "international")
		local priorLeague = (if career.leagueSeasonStats ~= nil then career.leagueSeasonStats else Js.O({ goals = career.seasonStats.goals, assists = career.seasonStats.assists }, { "goals", "assists" }))
		local leagueSeasonStats = (if ((kind == "league") and (not alreadyPlayed)) then Js.O({ goals = (priorLeague.goals + stats.goals), assists = (priorLeague.assists + stats.assists) }, { "goals", "assists" }) else priorLeague)
		local priorCareerLeague = (if career.careerLeagueStats ~= nil then career.careerLeagueStats else Js.O({ goals = 0, assists = 0, appearances = 0 }, { "goals", "assists", "appearances" }))
		local careerLeagueStats = (if ((kind == "league") and (not alreadyPlayed)) then Js.O({ goals = (priorCareerLeague.goals + stats.goals), assists = (priorCareerLeague.assists + stats.assists), appearances = (priorCareerLeague.appearances + 1) }, { "goals", "assists", "appearances" }) else priorCareerLeague)
		local priorPl = M_records.plCareer(career)
		local careerPlStats = (if (((kind == "league") and (not alreadyPlayed)) and (M_calendar.divisionOf(career) == "premier")) then Js.O({ goals = (priorPl.goals + stats.goals), assists = (priorPl.assists + stats.assists), appearances = (priorPl.appearances + 1) }, { "goals", "assists", "appearances" }) else priorPl)
		local potm = career.potm
		local potmJustAwarded = nil
		if (kind == "league") then
			local month = M_potm.monthOfCareer(career, fixture.week)
			local lastWeek = Math.max(Js.unpack(Js.aspread(A.map(career.fixtures, function(f)
				return f.week
			end), Js.alit(fixture.week))))
			if (M_potm.endsMonthOn(career, fixture.week, lastWeek) and (not M_potm.alreadyAwarded(career, month))) then
				local forVote = Js.ospread(career, Js.O({ results = weekResults, fixtures = fixtures }, { "results", "fixtures" }))
				local award = M_potm.voteMonth(forVote, month)
				if award then
					potm = Js.aspread((if career.potm ~= nil then career.potm else Js.alit()), Js.alit(award))
					potmJustAwarded = award
				end
			end
		end
		local MATCHES_GIVE_SKILL = false
		local matchSkillPool = (if (alreadyPlayed or (not MATCHES_GIVE_SKILL)) then 0 else (if (stats.rating >= 8) then M_tuningStore.getTuning("training.matchPoolRating8") else (if (stats.rating >= 7) then M_tuningStore.getTuning("training.matchPoolRating7") else (if (stats.rating >= 6) then M_tuningStore.getTuning("training.matchPoolRating6") else 0))))
		local perSkillGain = ((matchSkillPool * M_rating.growthMultiplier(career.player.age)) / M_tuningStore.getTuning("training.matchGainDivisor"))
		local nextSkills = (if (perSkillGain <= 0) then career.skills else Js.O({ pace = Math.min(100, Math.round((career.skills.pace + perSkillGain))), power = Math.min(100, Math.round((career.skills.power + perSkillGain))), technique = Math.min(100, Math.round((career.skills.technique + perSkillGain))), vision = Math.min(100, Math.round((career.skills.vision + perSkillGain))), freeKick = Math.min(100, Math.round((career.skills.freeKick + perSkillGain))), aerial = Math.min(100, Math.round((career.skills.aerial + perSkillGain))) }, { "pace", "power", "technique", "vision", "freeKick", "aerial" }))
		local next_ = Js.ospread(career, Js.O({ skills = nextSkills, potm = potm, starLedger = (if alreadyPlayed then career.starLedger else M_starPoints.ledgerAfterMatch(career, fixture, stats)), awards = (if (function() local _v = potmJustAwarded; if _v == nil then return nil end; _v = _v.isYou; return _v end)() then Js.aspread((if career.awards ~= nil then career.awards else Js.alit()), Js.alit(Js.O({ season = career.season, kind = "Player of the Month", week = fixture.week, division = M_calendar.divisionOf(career), detail = (potmJustAwarded.monthName .. " — " .. Js.numstr(potmJustAwarded.goals) .. " goals, " .. Js.numstr(potmJustAwarded.assists) .. " assists") }, { "season", "kind", "week", "division", "detail" }))) else career.awards), seasonStats = (if isInternational then career.seasonStats else accrue(career.seasonStats)), careerStats = (if isInternational then career.careerStats else accrue(career.careerStats)), careerBests = (if alreadyPlayed then career.careerBests else (function()
			local s = (if isInternational then career.seasonStats else accrue(career.seasonStats))
			do return M_careerRecords.bestsAfterMatch(career, fixture, stats, s.goals, s.assists) end
		end)()), feats = (if alreadyPlayed then career.feats else M_feats.featsAfterMatch(career, fixture, stats)), thisSeasonClub = (if isInternational then career.thisSeasonClub else career.player.club), leagueSeasonStats = leagueSeasonStats, careerLeagueStats = careerLeagueStats, careerPlStats = careerPlStats, caps = ((if career.caps ~= nil then career.caps else 0) + (if (isInternational and (not alreadyPlayed)) then 1 else 0)), internationalGoals = ((if career.internationalGoals ~= nil then career.internationalGoals else 0) + (if (isInternational and (not alreadyPlayed)) then stats.goals else 0)), international = (if (isInternational and (not alreadyPlayed)) then M_international.recordIntlMatch(career.international, career.season, fixture, stats) else career.international), cups = cups, tournament = tournament, trophies = (if cupTrophy then Js.aspread(career.trophies, Js.alit(cupTrophy)) else career.trophies), knockoutMessage = knockoutMessage, cupState = cupState, euroState = euroState, world = world, league = league, results = weekResults, leagueSquads = leagueSquads, externalSquads = externalSquads, incumbents = incumbents, fixtures = Js.aspread(fixtures, extraFixtures), money = (if alreadyPlayed then career.money else (((((career.money + stats.totalCash) + (if isInternational then 0 else M_contracts.appearanceMoney(career.contract))) + progressed.earned) + (if ((function() local _v = cupTrophy; if _v == nil then return nil end; _v = _v.competition; return _v end)() == M_lowerLeagueTrophy.LOWER_LEAGUE_TROPHY) then M_lowerLeagueTrophy.lowerLeagueTrophyPrize(career) else 0)) - (if career.horse then M_horse.horseUpkeep(career.horse) else 0))), matchFitness = (if alreadyPlayed then career.matchFitness else Math.min(100, (career.matchFitness + (3 * minuteShare)))), energy = nextEnergy }, { "skills", "potm", "starLedger", "awards", "seasonStats", "careerStats", "careerBests", "feats", "thisSeasonClub", "leagueSeasonStats", "careerLeagueStats", "careerPlStats", "caps", "internationalGoals", "international", "cups", "tournament", "trophies", "knockoutMessage", "cupState", "euroState", "world", "league", "results", "leagueSquads", "externalSquads", "incumbents", "fixtures", "money", "matchFitness", "energy" }), (if Js.T(stats.playstyle) then Js.O({ playstyle = stats.playstyle }, { "playstyle" }) else Js.O({}, nil)), Js.O({ kibAbility = (if alreadyPlayed then career.kibAbility else nil), kibCans = (if (alreadyPlayed or (not Js.T(stats.kibCansUsed))) then career.kibCans else Js.ospread(career.kibCans, Js.O({ basic = Math.max(0, (((function() local _v = career.kibCans; if _v == nil then return nil end; _v = _v.basic; return _v end)() or 0) - stats.kibCansUsed)) }, { "basic" }))), injury = nextInjury, headToHead = nextHeadToHead }, { "kibAbility", "kibCans", "injury", "headToHead" }), (if (alreadyPlayed or isInternational) then Js.O({ relationships = Js.ospread(career.relationships, Js.O({ sponsors = newSponsorRel }, { "sponsors" })) }, { "relationships" }) else (function()
			local raw = Js.O({ boss = M_relationships.capRel((stats.bossChange * derbyScale.boss)), team = M_relationships.capRel((stats.teamChange * derbyScale.team)), fans = M_relationships.capRel((stats.fansChange * derbyScale.fans)) }, { "boss", "team", "fans" })
			local rel = Js.ospread(career.relationships, Js.O({ sponsors = newSponsorRel }, { "sponsors" }))
			local relCarry = Js.ospread((if career.relCarry ~= nil then career.relCarry else Js.O({}, nil)))
			do
				local _arr5 = M_relationships.REL_KEYS
				local _i6 = 0
				while _i6 < Js.alen(_arr5) do
					_i6 += 1
					local k = _arr5[_i6]
					local s = M_relationships.stepBar(career.relationships[k], (if relCarry[k] ~= nil then relCarry[k] else 0), raw[k], career.week)
					rel[k] = s.value
					relCarry[k] = s.carry
				end
			end
			do return Js.O({ relationships = rel, relCarry = relCarry, happiness = M_relationships.happinessOf(Js.O({ relationships = rel }, { "relationships" })) }, { "relationships", "relCarry", "happiness" }) end
		end)()), Js.O({ sponsors = sponsors, starRating = career.starRating, fame = (if ((not alreadyPlayed) and (function() local _v = potmJustAwarded; if _v == nil then return nil end; _v = _v.isYou; return _v end)()) then M_fame.addFame(career.fame, M_fame.FAME_EVENTS.playerOfMonth) else career.fame), week = (if alreadyPlayed then career.week else (career.week + 1)), currentBoot = currentBoot, horse = horse, squad = updatedSquad, form = (if (alreadyPlayed or isInternational) then career.form else A.slice(Js.aspread(Js.alit(stats.rating), career.form), 0, 5)), rawForm = (if (alreadyPlayed or isInternational) then career.rawForm else A.slice(Js.aspread(Js.alit((if stats.rawRating ~= nil then stats.rawRating else stats.rating)), (if career.rawForm ~= nil then career.rawForm else career.form)), 0, 5)) }, { "sponsors", "starRating", "fame", "week", "currentBoot", "horse", "squad", "form", "rawForm" }))
		next_.clubAppearances = ((if career.clubAppearances ~= nil then career.clubAppearances else 0) + (if (isInternational or alreadyPlayed) then 0 else 1))
		if ((not alreadyPlayed) and Js.T((function() local _v = stats.cheekyMisses; if _v == nil then return nil end; _v = Js.len(_v); return _v end)())) then
			next_.reputation = M_reputation.changeReputation(next_.reputation, M_reputation.cheekyMissReputation(Js.alen(stats.cheekyMisses)))
		end
		if (not alreadyPlayed) then
			Js.Object.assign(next_, M_week.startNewWeek(), M_week.sessionsAfterMatch(career, M_calendar.dayFor(fixture.kind, fixture.week, M_calendar.divisionOf(career))))
		end
		if (((not next_.captain) and (not alreadyPlayed)) and M_recognition.captaincyEarned(next_)) then
			next_.captain = true
			next_.relationships = Js.ospread(next_.relationships, Js.O({ team = clamp01to100((next_.relationships.team + 3)) }, { "team" }))
			next_.captainMomentPending = true
		end
		if (next_.captain and (not alreadyPlayed)) then
			next_.relationships = Js.ospread(next_.relationships, Js.O({ team = clamp01to100((next_.relationships.team + M_recognition.CAPTAIN_TEAM_BONUS)) }, { "team" }))
		end
		if (Js.alen(progressed.completed) > 0) then
			next_.sponsorNews = A.slice(Js.aspread((if career.sponsorNews ~= nil then career.sponsorNews else Js.alit()), progressed.completed), -4)
		end
		if (((stats.hooked == "form") and (not alreadyPlayed)) and (not isInternational)) then
			next_.relationships = Js.ospread(next_.relationships, Js.O({ boss = clamp01to100((next_.relationships.boss - 3)) }, { "boss" }))
		end
		if ((stats.cameo and (not alreadyPlayed)) and (not isInternational)) then
			local boost = Math.min(10, (5 * (stats.goals + stats.assists)))
			if (boost > 0) then
				next_.relationships = Js.ospread(next_.relationships, Js.O({ boss = clamp01to100((next_.relationships.boss + boost)) }, { "boss" }))
			end
		end
		if (((not alreadyPlayed) and (not isInternational)) and ((if stats.minutes ~= nil then stats.minutes else 0) > 0)) then
			next_.shirt = M_selection.recordAppearance(next_)
		end
		next_.status = M_selection.selectionFor(next_).status
		if ((not alreadyPlayed) and (not isInternational)) then
			next_.lastPick = M_managerMoments.pickAfterMatch(stats)
		end
		if ((fixture.kind == "playoff") and (not alreadyPlayed)) then
			local settled = M_playoffs.settlePlayOffFixture(career, fixture, stats.homeScore, stats.awayScore)
			if settled then
				next_.playOffState = settled.state
				if Js.T(Js.alen(settled.fixtures)) then
					next_.fixtures = Js.aspread(next_.fixtures, settled.fixtures)
				end
				next_.knockoutMessage = settled.message
			end
		elseif ((kind == "league") and M_playoffs.leagueSeasonComplete(next_, fixture.week)) then
			local seeded = M_playoffs.seedPlayOffs(next_)
			if seeded then
				next_.playOffState = seeded.state
				next_.fixtures = Js.aspread(next_.fixtures, seeded.fixtures)
			end
		end
		Js.Object.assign(next_, runDueTransferWindow(next_))
		if (not alreadyPlayed) then
			Js.Object.assign(next_, decaySkills(next_, M_season.mulberry32((((next_.season * 5051) + (next_.week * 131)) + 3))))
		end
		if (not alreadyPlayed) then
			local b = M_sponsorDeals.brandsAfterMatch(career, next_, fixture, stats)
			next_.brands = b.brands
			next_.money += b.bonus
		end
		if (not alreadyPlayed) then
			Js.Object.assign(next_, (if Js.T(fixture.intlId) then M_career.creditIntl(next_, fixture, stats) else M_career.syncIntl(M_career.managerAfterClubMatch(next_, stats.rating))))
		end
		if (not alreadyPlayed) then
			next_.goalLog = M_goalLog.logMatchGoals(career, fixture, stats, M_calendar.leagueNameFor(M_calendar.divisionOf(career)))
		end
		local settled = applyAchievements(next_)
		do return Js.O({ career = M_starPoints.withStars(Js.ospread(settled.career, Js.O({ starRating = M_rating.computeStarRating(settled.career) }, { "starRating" }))), newlyUnlocked = settled.newlyUnlocked, potmAwarded = (if potmJustAwarded ~= nil then potmJustAwarded else nil) }, { "career", "newlyUnlocked", "potmAwarded" }) end
	end
	exports.creditMatchResult = creditMatchResult
	windowOrdinal = function(key)
		local _d7 = S.split((if key ~= nil then key else ""), "-")
		local seasonPart = _d7[1]
		local windowPart = _d7[2]
		local season = Js.Number(seasonPart)
		local order = WINDOW_ORDER[windowPart]
		if ((not Js.NumberNS.isFinite(season)) or (order == nil)) then
			do return (-math.huge) end
		end
		do return ((season * 2) + order) end
	end
	runDueTransferWindow = function(next_)
		if (not Js.T((function() local _v = next_.leagueSquads; if _v == nil then return nil end; _v = Js.len(_v); return _v end)())) then
			do return next_ end
		end
		local openedWindow = M_calendar.transferWindowFor(next_.player.startYear, next_.season, next_.week, M_calendar.divisionOf(next_))
		if (not Js.T(openedWindow)) then
			do return next_ end
		end
		local key = (Js.numstr(next_.season) .. "-" .. openedWindow)
		if (next_.lastTransferWindowKey == key) then
			do return next_ end
		end
		if (windowOrdinal(key) <= windowOrdinal(next_.lastTransferWindowKey)) then
			do return next_ end
		end
		local rng = M_season.mulberry32(((next_.season * 100003) + (next_.week * 37)))
		local _d8 = M_leagueTransfers.runTransferWindow(next_, openedWindow, rng)
		local afterWindow = _d8.career
		local moves = _d8.moves
		local loans = _d8.loans
		local worldRng = M_season.mulberry32((((next_.season * 100003) + (next_.week * 37)) + 7))
		local _d9 = M_leagueTransfers.runInternationalWindow(afterWindow, openedWindow, worldRng)
		local afterWorld = _d9.career
		local worldMoves = _d9.moves
		do return Js.ospread(afterWorld, Js.O({ leagueTransferNews = (if Js.T(Js.alen(worldMoves)) then Js.aspread(moves, worldMoves) else moves), leagueLoanNews = loans, lastTransferWindowKey = key }, { "leagueTransferNews", "leagueLoanNews", "lastTransferWindowKey" })) end
	end
	exports.runDueTransferWindow = runDueTransferWindow
	awardLeagueTrophyIfWon = function(career)
		local sorted = M_season.sortLeague(career.league)
		local wonLeague = ((function() local _v = sorted[1]; if _v == nil then return nil end; _v = _v.name; return _v end)() == career.player.club)
		if (not wonLeague) then
			do return Js.O({ career = career, wonLeague = false }, { "career", "wonLeague" }) end
		end
		local competition = M_calendar.leagueNameFor(M_calendar.divisionOf(career))
		local already = A.some(career.trophies, function(t)
			return ((t.season == career.season) and (t.competition == competition))
		end)
		if already then
			do return Js.O({ career = career, wonLeague = true }, { "career", "wonLeague" }) end
		end
		local trophy = Js.O({ season = career.season, competition = competition, club = career.player.club }, { "season", "competition", "club" })
		do return Js.O({ career = Js.ospread(career, Js.O({ trophies = Js.aspread(career.trophies, Js.alit(trophy)) }, { "trophies" })), wonLeague = true }, { "career", "wonLeague" }) end
	end
	exports.awardLeagueTrophyIfWon = awardLeagueTrophyIfWon
	winnersList = function(career, w, world, ladder)
		local out = Js.alit()
		local add = function(competition, club)
			if Js.T(club) then
				A.push(out, Js.O({ competition = competition, club = club }, { "competition", "club" }))
			end
		end
		add(M_calendar.leagueNameFor(M_calendar.divisionOf(career)), w.league)
		do
			local _arr10 = ((function() local _v = world; if _v == nil then return nil end; _v = _v.leagues; return _v end)() or Js.alit())
			local _i11 = 0
			while _i11 < Js.alen(_arr10) do
				_i11 += 1
				local lg = _arr10[_i11]
				add(M_calendar.leagueNameFor(lg.division), (function() local _v = M_season.sortLeague(lg.teams)[1]; if _v == nil then return nil end; _v = _v.name; return _v end)())
			end
		end
		add("FA Cup", w.faCup)
		add("League Cup", w.leagueCup)
		add("Champions League", w.championsLeague)
		add("Europa League", w.europaLeague)
		add("Community Shield", w.communityShield)
		add("Super Cup", w.superCup)
		do
			local _arr12 = ((function() local _v = ladder; if _v == nil then return nil end; _v = _v.worldPlayOffs; return _v end)() or Js.alit())
			local _i13 = 0
			while _i13 < Js.alen(_arr12) do
				_i13 += 1
				local p = _arr12[_i13]
				add((M_calendar.leagueNameFor(p.division) .. " play-off final"), p.result.promoted)
			end
		end
		if (function() local _v = ladder; if _v == nil then return nil end; _v = _v.playOffs; return _v end)() then
			add((M_calendar.leagueNameFor(M_calendar.divisionOf(career)) .. " play-off final"), ladder.playOffs.promoted)
		end
		do return out end
	end
	finishedCupsOf = function(career)
		local rngWinners = M_season.mulberry32(((career.season * 7247) + (Js.alen(career.league) * 11)))
		local rated = M_index.ratedTeams(career)
		do return A.map((if career.cupState ~= nil then career.cupState else Js.alit()), function(st)
			return (if Js.T(st.winner) then st else M_cups.finishCupToWinner(st, rated, career.player.club, rngWinners))
		end) end
	end
	exports.finishedCupsOf = finishedCupsOf
	resolveSeasonWinners = function(career)
		local finishedCups = finishedCupsOf(career)
		local world = (function()
			local _ok14, _err15, _rv16 = pcall(function()
				do return Js.RET, M_index.finishWorld(career) end
			end)
			if not _ok14 then
				do return nil end
			elseif _err15 == Js.RET then
				return _rv16
			end
		end)()
		local faCupWinner = ((function() local _v = A.find(finishedCups, function(st)
			return (st.competition == "FA Cup")
		end); if _v == nil then return nil end; _v = _v.winner; return _v end)() or nil)
		local leagueCupWinner = (((function() local _v = A.find(finishedCups, function(st)
			return (st.competition == "League Cup")
		end); if _v == nil then return nil end; _v = _v.winner; return _v end)() or (function() local _v = world; if _v == nil then return nil end; _v = _v.leagueCup; if _v == nil then return nil end; _v = _v.winner; return _v end)()) or nil)
		local lowerLeagueTrophyWinner = (function() local _v = A.find(finishedCups, function(st)
			return (st.competition == M_lowerLeagueTrophy.LOWER_LEAGUE_TROPHY)
		end); if _v == nil then return nil end; _v = _v.winner; return _v end)()
		local finalTable = M_season.sortLeague(career.league)
		local leagueWinner = (function() local _v = finalTable[1]; if _v == nil then return nil end; _v = _v.name; return _v end)()
		local leagueRunnerUp = (function() local _v = finalTable[2]; if _v == nil then return nil end; _v = _v.name; return _v end)()
		local uefaRules = M_ruleBook.ruleBookFor(career, "UEFA")
		local topFlight = M_englishTopFlight.englishTopFlightTable(career)
		local topSorted = M_season.sortLeague(topFlight)
		local strengthOf = function(name)
			return (((function() local _v = A.find(topFlight, function(t)
				return (t.name == name)
			end); if _v == nil then return nil end; _v = _v.strength; return _v end)() or (function() local _v = A.find(career.league, function(t)
				return (t.name == name)
			end); if _v == nil then return nil end; _v = _v.strength; return _v end)()) or M_promotion.estimateClubStrength(career, name))
		end
		local inYourCompetition = function(id)
			return (if ((function() local _v = career.euroState; if _v == nil then return nil end; _v = _v.competition; return _v end)() == id) then career.euroState else nil)
		end
		local fallbackCrown = function(id, salt)
			local q = M_competitions.seasonQualifiers(topFlight, faCupWinner, leagueCupWinner, nil, uefaRules.extraChampionsLeagueSlots, uefaRules.extraEuropaLeagueSlots)
			local entrants = A.map((if (id == "Champions League") then q.champions else q.europa), function(name)
				return Js.O({ name = name, strength = strengthOf(name) }, { "name", "strength" })
			end)
			do return M_euro.crownWithoutYou(id, entrants, ((career.season * 5209) + salt)) end
		end
		local worldWinner = function(id)
			return (function() local _v = world; if _v == nil then return nil end; _v = _v.europe; _v = A.find(_v, function(e)
				return (e.competition == id)
			end); if _v == nil then return nil end; _v = _v.winner; return _v end)()
		end
		local championsLeagueWinner = (((function() local _v = inYourCompetition("Champions League"); if _v == nil then return nil end; _v = _v.winner; return _v end)() or worldWinner("Champions League")) or fallbackCrown("Champions League", 3))
		local europaLeagueWinner = (((function() local _v = inYourCompetition("Europa League"); if _v == nil then return nil end; _v = _v.winner; return _v end)() or worldWinner("Europa League")) or fallbackCrown("Europa League", 7))
		local shieldWinner = function(id)
			if A.some(career.trophies, function(t)
				return ((t.season == career.season) and (t.competition == id))
			end) then
				do return career.player.club end
			end
			local played = A.find(career.fixtures, function(f)
				return ((f.competition == id) and f.played)
			end)
			if played then
				do return played.opponent end
			end
			do return (function() local _v = world; if _v == nil then return nil end; _v = _v.shields; _v = A.find(_v, function(x)
				return (x.competition == id)
			end); if _v == nil then return nil end; _v = _v.winner; return _v end)() end
		end
		do return Js.ospread(Js.O({ league = leagueWinner, leagueRunnerUp = leagueRunnerUp }, { "league", "leagueRunnerUp" }), (if topSorted[1] then Js.O({ premierLeague = topSorted[1].name }, { "premierLeague" }) else Js.O({}, nil)), (if topSorted[2] then Js.O({ premierLeagueRunnerUp = topSorted[2].name }, { "premierLeagueRunnerUp" }) else Js.O({}, nil)), Js.O({ faCup = (if faCupWinner ~= nil then faCupWinner else nil), leagueCup = (if leagueCupWinner ~= nil then leagueCupWinner else nil) }, { "faCup", "leagueCup" }), (if Js.T(lowerLeagueTrophyWinner) then Js.O({ lowerLeagueTrophy = lowerLeagueTrophyWinner }, { "lowerLeagueTrophy" }) else Js.O({}, nil)), Js.O({ championsLeague = championsLeagueWinner, europaLeague = europaLeagueWinner }, { "championsLeague", "europaLeague" }), (if Js.T(shieldWinner("Community Shield")) then Js.O({ communityShield = shieldWinner("Community Shield") }, { "communityShield" }) else Js.O({}, nil)), (if Js.T(shieldWinner("Super Cup")) then Js.O({ superCup = shieldWinner("Super Cup") }, { "superCup" }) else Js.O({}, nil)), (if (((function() local _v = career.tournament; if _v == nil then return nil end; _v = _v.season; return _v end)() == career.season) and Js.T(career.tournament.winner)) then Js.O({ tournament = Js.O({ competition = career.tournament.competition, winner = career.tournament.winner }, { "competition", "winner" }) }, { "tournament" }) else Js.O({}, nil))) end
	end
	exports.resolveSeasonWinners = resolveSeasonWinners
	ladderFor = function(career)
		do return M_promotion.seasonLadder(career) end
	end
	seasonClubMove = function(club, division, ladder)
		local d = ladder.divisions
		local next_ = Js.alit(Js.alit("premier", d.premier), Js.alit("championship", d.championship), Js.alit("league_one", d.leagueOne), Js.alit("league_two", d.leagueTwo), Js.alit("national_league", d.nationalLeague), Js.alit("national_league_north", d.nationalLeagueNorth), Js.alit("national_league_south", d.nationalLeagueSouth))
		local to = (function() local _v = A.find(next_, function(_p17)
			local clubs = _p17[2]
			return A.includes(clubs, club)
		end); if _v == nil then return nil end; _v = _v[1]; return _v end)()
		if Js.T(to) then
			local a = M_calendar.divisionRank(to)
			local b = M_calendar.divisionRank(division)
			do return (if (a == b) then nil else (if (a < b) then "promoted" else "relegated")) end
		end
		do return (if (A.includes(d.step3North, club) or A.includes(d.step3South, club)) then "relegated" else nil) end
	end
	seasonHistoryAfter = function(career, winners, shortlist, ladder, justTransferred)
		local _ok18, _err19, _rv20 = pcall(function()
			local top = shortlist.entries[1]
			local moved = (if justTransferred then A.at((if career.transfers ~= nil then career.transfers else Js.alit()), -1) else nil)
			local movedNow = (if (moved and (moved.season == career.season)) then moved else nil)
			local seasonClub = ((if career.thisSeasonClub ~= nil then career.thisSeasonClub else (function() local _v = movedNow; if _v == nil then return nil end; _v = _v.from; return _v end)()) or career.player.club)
			local division = M_calendar.divisionOf(career)
			local row = M_careerRecords.historyRowFor(career, Js.ospread(Js.O({ club = seasonClub, division = division, position = (A.findIndex(M_season.sortLeague(career.league), function(t)
				return (t.name == seasonClub)
			end) + 1), teams = Js.alen(career.league), move = (if ladder then seasonClubMove(seasonClub, division, ladder) else nil), winners = winners, ballonDor = (if top then Js.O({ winner = top.name, club = top.club, yourRank = shortlist.playerRank }, { "winner", "club", "yourRank" }) else nil) }, { "club", "division", "position", "teams", "move", "winners", "ballonDor" }), (if movedNow then Js.O({ money = (career.money - movedNow.fee) }, { "money" }) else Js.O({}, nil)), (if ((function() local _v = movedNow; if _v == nil then return nil end; _v = _v.fromWage; return _v end)() ~= nil) then Js.O({ wage = movedNow.fromWage }, { "wage" }) else Js.O({}, nil)), Js.O({ mates = (if movedNow then (if career.outgoingMates ~= nil then career.outgoingMates else Js.alit()) else M_careerRecords.bestMatesOf(career.squad)) }, { "mates" })))
			do return Js.RET, Js.aspread(A.filter((if career.seasonHistory ~= nil then career.seasonHistory else Js.alit()), function(r)
				return (r.season ~= career.season)
			end), Js.alit(row)) end
		end)
		if not _ok18 then
			do return career.seasonHistory end
		elseif _err19 == Js.RET then
			return _rv20
		end
	end
	closeFinalSeason = function(career, userWonBallonDor)
		if A.some((if career.seasonHistory ~= nil then career.seasonHistory else Js.alit()), function(r)
			return (r.season == career.season)
		end) then
			do return career end
		end
		local honours = M_recognition.seasonAwards(career)
		local shortlist = M_ballonDor.computeBallonDorShortlist(career)
		local winners = resolveSeasonWinners(career)
		local ladder = nil
		local _ok21, _err22, _rv23 = pcall(function()
			ladder = ladderFor(career)
		end)
		if not _ok21 then
			ladder = nil
		elseif _err22 == Js.RET then
			return _rv23
		end
		do return Js.ospread(career, Js.O({ ballonDorWins = (career.ballonDorWins + (if userWonBallonDor then 1 else 0)), awards = (if (Js.alen(honours) > 0) then Js.aspread((if career.awards ~= nil then career.awards else Js.alit()), A.map(honours, function(h)
			return Js.ospread(h, Js.O({ division = M_calendar.divisionOf(career) }, { "division" }))
		end)) else career.awards), seasonArchive = (if (career.seasonStats.appearances > 0) then Js.aspread(A.filter((if career.seasonArchive ~= nil then career.seasonArchive else Js.alit()), function(r)
			return (r.season ~= career.season)
		end), Js.alit(M_careerRecords.archiveRowFor(career))) else career.seasonArchive), seasonHistory = seasonHistoryAfter(career, winners, shortlist, ladder, false), lastSeasonWinners = winners }, { "ballonDorWins", "awards", "seasonArchive", "seasonHistory", "lastSeasonWinners" })) end
	end
	exports.closeFinalSeason = closeFinalSeason
	advanceSeason = function(career, userWonBallonDor, justTransferred, opts)
		if justTransferred == nil then justTransferred = false end
		if opts == nil then opts = Js.O({}, nil) end
		career = M_leagueTransfers.returnLoansHome(career)
		local ladder = ladderFor(career)
		local clubs = ladder.clubs
		local nextDivision = ladder.division
		local newAge = (career.player.age + 1)
		local ageEffect = function(v)
			if (newAge >= 34) then
				do return Math.max(20, (v - 3)) end
			end
			if (newAge >= 30) then
				do return Math.max(30, (v - 1)) end
			end
			do return v end
		end
		local agedSkills = Js.O({ pace = ageEffect(career.skills.pace), power = ageEffect(career.skills.power), technique = career.skills.technique, vision = career.skills.vision, freeKick = career.skills.freeKick, aerial = ageEffect(career.skills.aerial) }, { "pace", "power", "technique", "vision", "freeKick", "aerial" })
		local sponsorRoll = M_sponsors.rollSponsorSeason(career)
		local seasonFeeTotal = A.reduce(sponsorRoll.seasonFees, function(sum, f)
			return (sum + f.fee)
		end, 0)
		local loyalty = (if justTransferred then 0 else M_contracts.loyaltyMoney(career.contract, true))
		local sack = M_manager.sackCheck(career, M_expectations.judgeSeason(career).score, ((((not (not opts.noSackAfterPromotion)) and (not justTransferred)) and (not career.placement)) and (seasonClubMove(career.player.club, M_calendar.divisionOf(career), ladder) == "promoted")))
		local honours = M_recognition.seasonAwards(career)
		local shortlist = M_ballonDor.computeBallonDorShortlist(career)
		local ballonRank = (if userWonBallonDor then 1 else (if (shortlist.playerNominated and (M_calendar.divisionOf(career) == "premier")) then Math.max(2, shortlist.playerRank) else 0))
		local judgement = M_expectations.judgeSeason(career)
		local thisSeason = A.filter(career.trophies, function(t)
			return (t.season == career.season)
		end)
		local wonFaCup = A.some(thisSeason, function(t)
			return (t.competition == "FA Cup")
		end)
		local wonLeagueCup = A.some(thisSeason, function(t)
			return (t.competition == "League Cup")
		end)
		local wonEuroComp = A.some(thisSeason, function(t)
			return ((t.competition == "Champions League") or (t.competition == "Europa League"))
		end)
		local qualification = (if (M_calendar.divisionOf(career) ~= "premier") then nil else M_competitions.qualificationFor(M_competitions.leaguePosition(career), Js.alen(career.league), wonFaCup, wonLeagueCup, wonEuroComp, M_ruleBook.ruleBookFor(career, "UEFA").extraChampionsLeagueSlots, M_ruleBook.ruleBookFor(career, "UEFA").extraEuropaLeagueSlots))
		local lastSeasonWinners = resolveSeasonWinners(career)
		local finishedWorld = (function()
			local _ok24, _err25, _rv26 = pcall(function()
				do return Js.RET, M_index.finishWorld(career) end
			end)
			if not _ok24 then
				do return nil end
			elseif _err25 == Js.RET then
				return _rv26
			end
		end)()
		local lastTopFlight = A.map(M_season.sortLeague(M_englishTopFlight.englishTopFlightTable(career)), function(t)
			return t.name
		end)
		local lastWorld = (function()
			local _ok27, _err28, _rv29 = pcall(function()
				do return Js.RET, M_summary.summariseWorld(career, finishedWorld, ladder, winnersList(career, lastSeasonWinners, finishedWorld, ladder), finishedCupsOf(career)) end
			end)
			if not _ok27 then
				do return career.lastWorld end
			elseif _err28 == Js.RET then
				return _rv29
			end
		end)()
		local seasonHistory = seasonHistoryAfter(career, lastSeasonWinners, shortlist, ladder, justTransferred)
		local betResult = M_competitionBetting.settleBets((if career.competitionBets ~= nil then career.competitionBets else Js.alit()), lastSeasonWinners, career.season)
		local standing = M_seasonStanding.seasonStanding(career, ladder, nextDivision, userWonBallonDor, ((not (not Js.T(qualification))) and (not Js.T(career.europeanQualification))), lastSeasonWinners)
		local next_ = Js.ospread(career, Js.O({ player = Js.ospread(career.player, Js.O({ age = newAge }, { "age" })), skills = agedSkills, season = (career.season + 1), squadNumber = M_recognition.numberAtSeasonStart(career), division = nextDivision, divisions = ladder.divisions, limboClubs = ladder.limbo, ladderNews = Js.ospread(Js.O({ yourMove = ladder.yourMove, promotedToPremier = ladder.promotedToPremier, relegatedFromPremier = ladder.relegatedFromPremier, promotedToChampionship = ladder.promotedToChampionship, relegatedFromChampionship = ladder.relegatedFromChampionship, promotedToLeagueOne = ladder.promotedToLeagueOne, relegatedFromLeagueOne = ladder.relegatedFromLeagueOne, promotedToLeagueTwo = ladder.promotedToLeagueTwo, relegatedFromLeagueTwo = ladder.relegatedFromLeagueTwo, promotedToNationalLeague = ladder.promotedToNationalLeague, relegatedFromNationalLeague = ladder.relegatedFromNationalLeague, relegatedToNorth = ladder.relegatedToNorth, relegatedToSouth = ladder.relegatedToSouth }, { "yourMove", "promotedToPremier", "relegatedFromPremier", "promotedToChampionship", "relegatedFromChampionship", "promotedToLeagueOne", "relegatedFromLeagueOne", "promotedToLeagueTwo", "relegatedFromLeagueTwo", "promotedToNationalLeague", "relegatedFromNationalLeague", "relegatedToNorth", "relegatedToSouth" }), (if ladder.playOffs then Js.O({ playOffFinal = ladder.playOffs.final }, { "playOffFinal" }) else Js.O({}, nil))), week = 1, world = nil, lastWorld = lastWorld, compHistory = M_history.withSeasonHistory(career.compHistory, lastWorld), lastTopFlight = lastTopFlight, fixtures = M_season.buildFixtures(clubs, career.player.club), league = M_season.buildLeague(clubs, career.player.club), results = Js.alit(), potm = M_potm.compactPotmHistory(career.potm, career.season), leagueSeasonStats = Js.O({ goals = 0, assists = 0 }, { "goals", "assists" }), personalBests = M_records.updatePersonalBests(career), seasonArchive = (if (career.seasonStats.appearances > 0) then Js.aspread(A.filter((if career.seasonArchive ~= nil then career.seasonArchive else Js.alit()), function(r)
			return (r.season ~= career.season)
		end), Js.alit(M_careerRecords.archiveRowFor(career))) else career.seasonArchive), seasonHistory = seasonHistory, thisSeasonClub = nil, outgoingMates = nil, playOffState = nil }, { "player", "skills", "season", "squadNumber", "division", "divisions", "limboClubs", "ladderNews", "week", "world", "lastWorld", "compHistory", "lastTopFlight", "fixtures", "league", "results", "potm", "leagueSeasonStats", "personalBests", "seasonArchive", "seasonHistory", "thisSeasonClub", "outgoingMates", "playOffState" }), (function()
			local moved = M_leagueSquads.moveSquadsWithLadder((if career.leagueSquads ~= nil then career.leagueSquads else Js.alit()), (if career.externalSquads ~= nil then career.externalSquads else Js.alit()), clubs)
			local tier = function(club)
				return M_facilities.facilitiesFor(career, club).trainingGroundTier
			end
			local own = career.player.club
			local worldAwake = ((career.worldAgedSince ~= nil) or A.includes(M_worldAgeing.AWAKE_DIVISIONS, M_calendar.divisionOf(career)))
			local worldSeed = (if career.worldSeed ~= nil then career.worldSeed else (if (career.worldAgedSince == nil) then M_worldAgeing.worldSeedFor(career.player) else nil))
			local resetLeague = M_leagueSquads.resetLeagueSquads(moved.leagueSquads)
			local isOwn = function(s)
				return (s.club == own)
			end
			local grownLeague = (if worldAwake then M_leagueSquads.growWonderkids(resetLeague, M_season.mulberry32(((career.season * 71923) + 5)), tier) else resetLeague)
			local grownExternal = (if worldAwake then M_leagueSquads.growWonderkids(moved.externalSquads, M_season.mulberry32(((career.season * 71923) + 7)), tier) else moved.externalSquads)
			local ageSome = function(squads, levels)
				if worldAwake then
					do return M_worldAgeing.ageLeagueSquads(squads, career.season, tier, levels, worldSeed) end
				end
				local mine = A.filter(squads, isOwn)
				if (not Js.T(Js.alen(mine))) then
					do return Js.O({ squads = squads, retired = Js.alit(), clubLevels = levels }, { "squads", "retired", "clubLevels" }) end
				end
				local aged = M_worldAgeing.ageLeagueSquads(mine, career.season, tier, levels, worldSeed)
				do return Js.O({ squads = A.map(squads, function(s)
					return (if isOwn(s) then aged.squads[1] else s)
				end), retired = aged.retired, clubLevels = aged.clubLevels }, { "squads", "retired", "clubLevels" }) end
			end
			local agedLeague = ageSome(grownLeague, (if career.clubLevels ~= nil then career.clubLevels else Js.O({}, nil)))
			local agedExternal = ageSome(grownExternal, agedLeague.clubLevels)
			local levels = agedExternal.clubLevels
			local ownCopy = (A.find((if career.leagueSquads ~= nil then career.leagueSquads else Js.alit()), function(s)
				return (s.club == own)
			end) or A.find((if career.externalSquads ~= nil then career.externalSquads else Js.alit()), function(s)
				return (s.club == own)
			end))
			local ownLevel = (((if levels[own] ~= nil then levels[own] else (if ownCopy then M_worldAgeing.clubLevelOf(levels, ownCopy) else nil)) or (function() local _v = A.find(career.league, function(t)
				return (t.name == own)
			end); if _v == nil then return nil end; _v = _v.strength; return _v end)()) or 65)
			local agedOwn = M_worldAgeing.ageOwnSquad(A.map((if career.squad ~= nil then career.squad else Js.alit()), function(p)
				return Js.ospread(p, Js.O({ seasonGoals = 0, seasonAssists = 0, leagueGoals = 0, leagueAssists = 0 }, { "seasonGoals", "seasonAssists", "leagueGoals", "leagueAssists" }))
			end), own, career.season, ownLevel, tier(own), worldSeed)
			local squad = agedOwn.squad
			local lastRetirements = M_retirementNews.notableRetirements(Js.aspread(agedOwn.retired, agedLeague.retired, agedExternal.retired), Js.O({ leagueSquads = career.leagueSquads, externalSquads = career.externalSquads, squad = career.squad }, { "leagueSquads", "externalSquads", "squad" }), own)
			do return Js.ospread(Js.O({ leagueSquads = agedLeague.squads, externalSquads = agedExternal.squads, squad = squad, lastRetirements = lastRetirements, clubLevels = levels }, { "leagueSquads", "externalSquads", "squad", "lastRetirements", "clubLevels" }), (if worldAwake then Js.O({ worldAgedSince = (if career.worldAgedSince ~= nil then career.worldAgedSince else career.season) }, { "worldAgedSince" }) else Js.O({}, nil)), (if (worldSeed ~= nil) then Js.O({ worldSeed = worldSeed }, { "worldSeed" }) else Js.O({}, nil))) end
		end)(), Js.O({ incumbents = nil, seasonStats = Js.ospread(EMPTY_SEASON_STATS), matchFitness = 85, energy = 100, injury = nil, form = Js.alit(), rawForm = Js.alit(), contract = Js.ospread(M_contracts.contractForClubMove(career.contract, (if (justTransferred or career.placement) then nil else seasonClubMove(career.player.club, M_calendar.divisionOf(career), ladder))), Js.O({ seasonsRemaining = (career.contract.seasonsRemaining - 1) }, { "seasonsRemaining" })), ballonDorWins = (career.ballonDorWins + (if userWonBallonDor then 1 else 0)), europeanQualification = qualification, lastSeasonPosition = M_competitions.leaguePosition(career), lastSeasonWinners = lastSeasonWinners, knockoutMessage = nil, weekActions = M_week.WEEK_ACTIONS, relationships = Js.ospread(career.relationships, Js.O({ boss = clamp01to100((career.relationships.boss + judgement.bossChange)) }, { "boss" })), reputation = standing.reputation, fameNews = standing.news, ownedItems = M_fame.wearItems(career.ownedItems), lastSeasonJudgement = judgement, awards = (if (Js.alen(honours) > 0) then Js.aspread((if career.awards ~= nil then career.awards else Js.alit()), A.map(honours, function(h)
			return Js.ospread(h, Js.O({ division = M_calendar.divisionOf(career) }, { "division" }))
		end)) else career.awards), starLedger = Js.ospread(M_starPoints.ledgerOf(career), Js.O({ promotions = (M_starPoints.ledgerOf(career).promotions + (if (ladder.yourMove == "promoted") then 1 else 0)), promotedFrom = (if ((ladder.yourMove == "promoted") and (not A.some(career.trophies, function(t)
			return ((t.season == career.season) and (t.competition == M_calendar.leagueNameFor(M_calendar.divisionOf(career))))
		end))) then Js.aspread((M_starPoints.ledgerOf(career).promotedFrom or Js.alit()), Js.alit(M_calendar.divisionOf(career))) else M_starPoints.ledgerOf(career).promotedFrom), ballonRanks = (if (ballonRank > 0) then Js.aspread(M_starPoints.ledgerOf(career).ballonRanks, Js.alit(ballonRank)) else M_starPoints.ledgerOf(career).ballonRanks) }, { "promotions", "promotedFrom", "ballonRanks" })), sponsors = sponsorRoll.sponsors, sponsorNews = Js.aspread(sponsorRoll.lapsed, A.map(sponsorRoll.seasonFees, function(f)
			return (f.category .. ": Season fee — ★" .. Js.numstr(f.fee))
		end)), fame = standing.fame, money = (((career.money + loyalty) + seasonFeeTotal) + betResult.totalPayout), competitionBets = betResult.stillPending, betNews = M_competitionBetting.betNewsLines(betResult.settled) }, { "incumbents", "seasonStats", "matchFitness", "energy", "injury", "form", "rawForm", "contract", "ballonDorWins", "europeanQualification", "lastSeasonPosition", "lastSeasonWinners", "knockoutMessage", "weekActions", "relationships", "reputation", "fameNews", "ownedItems", "lastSeasonJudgement", "awards", "starLedger", "sponsors", "sponsorNews", "fame", "money", "competitionBets", "betNews" }))
		if (sponsorRoll.standingHit > 0) then
			next_.relationships = Js.ospread(next_.relationships, Js.O({ sponsors = clamp01to100((next_.relationships.sponsors - sponsorRoll.standingHit)) }, { "sponsors" }))
		end
		next_.league = M_leagueSquads.syncLeagueStrengthFromSquads(next_.league, (if next_.leagueSquads ~= nil then next_.leagueSquads else Js.alit()), M_calendar.divisionOf(next_))
		if sack.sacked then
			local pool = (if career.availableManagers ~= nil then career.availableManagers else M_managerPool.allPoolManagers())
			local hire = M_manager.hireReplacementManager(next_, next_.player.club, next_.season, pool)
			next_.manager = hire.manager
			next_.availableManagers = (if ((function() local _v = career.manager; if _v == nil then return nil end; _v = _v.poolTier; return _v end)() ~= nil) then Js.aspread(hire.availableManagers, Js.alit(career.manager.name)) else hire.availableManagers)
			next_.managerNews = (sack.reason .. " " .. hire.manager.name .. " takes over. \"" .. hire.manager.arrival .. "\"")
			next_.relationships = Js.ospread(next_.relationships, Js.O({ boss = M_manager.bossOnArrival(next_) }, { "boss" }))
			next_.captain = false
		else
			next_.managerNews = nil
		end
		local seeded = M_competitions.seedSeasonKnockouts(next_)
		next_.cups = seeded.runs
		local drawn = M_competitions.seedCups(next_, Js.O({ leagueOneOrder = M_lowerLeagueTrophy.leagueOneOrder(career) }, { "leagueOneOrder" }))
		next_.cupState = drawn.states
		local euro = M_competitions.seedEurope(next_)
		next_.euroState = (if euro.state ~= nil then euro.state else nil)
		next_.fixtures = Js.aspread(next_.fixtures, seeded.fixtures, drawn.fixtures, euro.fixtures)
		Js.Object.assign(next_, M_clubPowers.considerRecommendations(next_, M_season.mulberry32(((next_.season * 54617) + 13))))
		Js.Object.assign(next_, M_clubPowers.payPresidentWages(next_))
		Js.Object.assign(next_, M_facilities.creditStadiumRevenue(next_))
		Js.Object.assign(next_, M_facilities.progressStadiumBuilds(next_))
		do
			local b = M_sponsorDeals.brandsAfterSeason(career, next_, (ladder.yourMove == "promoted"))
			next_.brands = b.brands
			next_.money += b.bonus
		end
		if career.intl then
			next_.intl = M_career.markBallonDorNight(career)
		end
		Js.Object.assign(next_, M_career.syncIntl(next_))
		local settled = applyAchievements(next_)
		do return Js.O({ career = M_starPoints.withStars(Js.ospread(settled.career, Js.O({ starRating = M_rating.computeStarRating(settled.career) }, { "starRating" }))), newlyUnlocked = settled.newlyUnlocked }, { "career", "newlyUnlocked" }) end
	end
	exports.advanceSeason = advanceSeason
	clamp01to100 = function(v)
		do return Math.max(0, Math.min(100, v)) end
	end
	applyAchievements = function(next_)
		local newlyUnlocked = M_achievements.checkNewAchievements(next_)
		if (Js.alen(newlyUnlocked) == 0) then
			do return Js.O({ career = next_, newlyUnlocked = newlyUnlocked }, { "career", "newlyUnlocked" }) end
		end
		do return Js.O({ career = Js.ospread(next_, Js.O({ achievements = Js.aspread(next_.achievements, newlyUnlocked) }, { "achievements" })), newlyUnlocked = newlyUnlocked }, { "career", "newlyUnlocked" }) end
	end
	simulateMissedFixture = function(career, fixture)
		local kind = (if fixture.kind ~= nil then fixture.kind else "league")
		local sameFixture = function(f)
			return (((f.week == fixture.week) and ((if f.kind ~= nil then f.kind else "league") == kind)) and (f.opponent == fixture.opponent))
		end
		local alreadyPlayed = A.some(career.fixtures, function(f)
			return (sameFixture(f) and f.played)
		end)
		if alreadyPlayed then
			local existing = A.find(career.fixtures, sameFixture)
			do return Js.O({ career = career, newlyUnlocked = Js.alit(), homeScore = (if existing.homeScore ~= nil then existing.homeScore else 0), awayScore = (if existing.awayScore ~= nil then existing.awayScore else 0) }, { "career", "newlyUnlocked", "homeScore", "awayScore" }) end
		end
		local rng = M_season.mulberry32((((career.season * 1000) + career.week) + 7717))
		local strength = function(name)
			return ((function() local _v = A.find(career.league, function(t)
				return (t.name == name)
			end); if _v == nil then return nil end; _v = _v.strength; return _v end)() or 65)
		end
		local mine = (if M_tournament.isTournamentFixture(career, fixture) then (if career.tournament.strengths[career.tournament.nation] ~= nil then career.tournament.strengths[career.tournament.nation] else 70) else strength(career.player.club))
		local theirs = (if fixture.opponentStrength ~= nil then fixture.opponentStrength else strength(fixture.opponent))
		local watched = (if fixture.watch then M_career.watchedScore(career, fixture) else nil)
		local score = (if fixture.home then M_season.simulateFixtureScore(mine, theirs, rng) else M_season.simulateFixtureScore(theirs, mine, rng))
		local userScore = (if watched then watched.us else (if fixture.home then score.home else score.away))
		local oppScore = (if watched then watched.them else (if fixture.home then score.away else score.home))
		local league = career.league
		local weekResults = (if career.results ~= nil then career.results else Js.alit())
		local leagueSquads = career.leagueSquads
		if (kind == "league") then
			local faRules = M_ruleBook.ruleBookFor(career, "FA")
			league = M_season.updateLeagueWithUserResult(career.league, career.player.club, fixture.opponent, userScore, oppScore, faRules, rng)
			local squads = A.map((if career.leagueSquads ~= nil then career.leagueSquads else Js.alit()), function(sq)
				return Js.ospread(sq, Js.O({ players = A.map(sq.players, function(p)
					return Js.ospread(p)
				end) }, { "players" }))
			end)
			local round = M_season.playLeagueWeek(league, fixture.week, Js.O({ club = career.player.club, opponent = fixture.opponent, home = fixture.home, scored = userScore, conceded = oppScore }, { "club", "opponent", "home", "scored", "conceded" }), rng, squads, faRules, M_liveScores.otherGamesRng(career.season, fixture.week))
			league = round.league
			leagueSquads = squads
			weekResults = Js.aspread(A.filter(weekResults, function(r)
				return (r.week ~= fixture.week)
			end), round.results)
		end
		local cups = (if career.cups ~= nil then career.cups else Js.alit())
		local extraFixtures = Js.alit()
		local cupTrophy = nil
		local knockoutMessage = nil
		local cupState = career.cupState
		local tournament = career.tournament
		local tourn = M_tournament.settleTournamentMatch(career, fixture, Js.O({ us = userScore, them = oppScore }, { "us", "them" }))
		if tourn then
			tournament = tourn.state
			extraFixtures = (if tourn.nextFixture then Js.alit(tourn.nextFixture) else Js.alit())
			cupTrophy = tourn.trophy
			knockoutMessage = tourn.message
		elseif ((kind ~= "league") and Js.T(fixture.competition)) then
			local settled = M_competitions.settleCupTie(career, fixture, userScore, oppScore)
			if settled then
				cupState = settled.states
				extraFixtures = (if settled.nextFixture then Js.alit(settled.nextFixture) else Js.alit())
				cupTrophy = settled.trophy
				knockoutMessage = settled.message
			end
			local idx = (if settled then -1 else A.findIndex(cups, function(r)
				return ((r.competition == fixture.competition) and (not r.eliminated))
			end))
			if (idx >= 0) then
				local out = M_competitions.resolveKnockout(career, cups[idx + 1], fixture, userScore, oppScore)
				cups = A.map(cups, function(r, i)
					return (if (i == idx) then out.run else r)
				end)
				if out.nextFixture then
					extraFixtures = Js.alit(out.nextFixture)
				end
				cupTrophy = out.trophy
				knockoutMessage = out.message
			end
		end
		local euroState = career.euroState
		local externalSquads = career.externalSquads
		if euroState then
			local euroSquads = A.map((if career.externalSquads ~= nil then career.externalSquads else Js.alit()), function(sq)
				return Js.ospread(sq, Js.O({ players = A.map(sq.players, function(p)
					return Js.ospread(p)
				end) }, { "players" }))
			end)
			local settled = M_competitions.settleEuro(career, fixture, userScore, oppScore, euroSquads)
			if settled then
				euroState = settled.state
				externalSquads = euroSquads
				if settled.nextFixture then
					extraFixtures = Js.aspread(extraFixtures, Js.alit(settled.nextFixture))
				end
				if settled.trophy then
					cupTrophy = settled.trophy
				end
				if Js.T(settled.message) then
					knockoutMessage = settled.message
				end
			end
		end
		local world = career.world
		do
			local clock = M_calendar.fixtureTimestamp(career.player.startYear, career.season, fixture.week, fixture.kind, M_calendar.divisionOf(career))
			local cupsRng = M_season.mulberry32((((career.season * 60013) + (fixture.week * 7)) + 41))
			cupState = M_competitions.advanceEliminatedCups(Js.ospread(career, Js.O({ cupState = cupState }, { "cupState" })), clock, cupsRng)
			extraFixtures = Js.aspread(extraFixtures, M_competitions.newCupFixtures(Js.ospread(career, Js.O({ cupState = cupState, fixtures = Js.aspread(career.fixtures, extraFixtures) }, { "cupState", "fixtures" })), (if cupState ~= nil then cupState else Js.alit())))
			extraFixtures = Js.aspread(extraFixtures, M_competitions.cupFixturesOwed(Js.ospread(career, Js.O({ fixtures = Js.aspread(career.fixtures, extraFixtures) }, { "fixtures" })), (if cupState ~= nil then cupState else Js.alit())))
			world = M_index.worldAfterMatch(career, clock)
		end
		local fixtures = A.map(career.fixtures, function(f)
			return (if ((f == fixture) or sameFixture(f)) then Js.ospread(f, Js.O({ played = true, homeScore = (if f.home then userScore else oppScore), awayScore = (if f.home then oppScore else userScore) }, { "played", "homeScore", "awayScore" })) else f)
		end)
		local next_ = Js.ospread(career, Js.O({ league = league, results = weekResults, leagueSquads = leagueSquads, externalSquads = externalSquads, world = world, fixtures = Js.aspread(fixtures, extraFixtures), cups = cups, tournament = tournament, cupState = cupState, euroState = euroState, trophies = (if cupTrophy then Js.aspread(career.trophies, Js.alit(cupTrophy)) else career.trophies), knockoutMessage = knockoutMessage, money = ((((career.money + M_wages.wageForFixture(career, fixture)) + M_sponsorDeals.sponsorPayFor(career, fixture)) + (if ((function() local _v = cupTrophy; if _v == nil then return nil end; _v = _v.competition; return _v end)() == M_lowerLeagueTrophy.LOWER_LEAGUE_TROPHY) then M_lowerLeagueTrophy.lowerLeagueTrophyPrize(career) else 0)) - (if career.horse then M_horse.horseUpkeep(career.horse) else 0)), weekActions = M_week.WEEK_ACTIONS }, { "league", "results", "leagueSquads", "externalSquads", "world", "fixtures", "cups", "tournament", "cupState", "euroState", "trophies", "knockoutMessage", "money", "weekActions" }), M_week.sessionsAfterMatch(career, M_calendar.dayFor(fixture.kind, fixture.week, M_calendar.divisionOf(career))), Js.O({ matchFitness = Math.max(20, (career.matchFitness + (if fixture.watch then 0 else M_selection.MISSED_WEEK.matchFitness))), energy = Math.round(M_energy.clampEnergy((career.energy + restRecoveryAfter(career, fixture, fixtures)))), injury = (if career.injury then (if ((career.injury.weeksRemaining - 1) <= 0) then nil else Js.ospread(career.injury, Js.O({ weeksRemaining = (career.injury.weeksRemaining - 1) }, { "weeksRemaining" }))) else nil), relationships = Js.ospread(career.relationships, Js.O({ boss = M_relationships.drift(clamp01to100((career.relationships.boss + (if fixture.watch then 0 else M_selection.MISSED_WEEK.boss))), career.week), team = M_relationships.drift(career.relationships.team, career.week), fans = M_relationships.drift(career.relationships.fans, career.week) }, { "boss", "team", "fans" })), happiness = M_relationships.happinessOf(Js.O({ relationships = Js.O({ boss = M_relationships.drift(clamp01to100((career.relationships.boss + (if fixture.watch then 0 else M_selection.MISSED_WEEK.boss))), career.week), team = M_relationships.drift(career.relationships.team, career.week), fans = M_relationships.drift(career.relationships.fans, career.week) }, { "boss", "team", "fans" }) }, { "relationships" })), week = (career.week + 1), horse = (if career.horse then Js.ospread(career.horse, Js.O({ energy = Math.min(100, (career.horse.energy + 20)) }, { "energy" })) else career.horse) }, { "matchFitness", "energy", "injury", "relationships", "happiness", "week", "horse" }))
		next_.status = M_selection.selectionFor(next_).status
		if (kind ~= "international") then
			next_.lastPick = M_managerMoments.pickAfterMissed(career.lastPick, (not (not career.injury)))
		end
		if (fixture.kind == "playoff") then
			local settled = M_playoffs.settlePlayOffFixture(career, fixture, userScore, oppScore)
			if settled then
				next_.playOffState = settled.state
				if Js.T(Js.alen(settled.fixtures)) then
					next_.fixtures = Js.aspread(next_.fixtures, settled.fixtures)
				end
				next_.knockoutMessage = settled.message
			end
		elseif ((kind == "league") and M_playoffs.leagueSeasonComplete(next_, fixture.week)) then
			local seeded = M_playoffs.seedPlayOffs(next_)
			if seeded then
				next_.playOffState = seeded.state
				next_.fixtures = Js.aspread(next_.fixtures, seeded.fixtures)
			end
		end
		if (not alreadyPlayed) then
			Js.Object.assign(next_, (if fixture.watch then M_career.syncIntl(next_) else (if Js.T(fixture.intlId) then M_career.creditIntl(next_, fixture, Js.O({ homeScore = userScore, awayScore = oppScore, rating = 6.6 }, { "homeScore", "awayScore", "rating" }), Js.O({ keepManager = true }, { "keepManager" })) else M_career.syncIntl(M_career.managerAfterClubMatch(next_, nil, (not (not Js.T(M_career.awayOnDuty(career, fixture)))))))))
		end
		local _d30 = applyAchievements(next_)
		local withAchievements = _d30.career
		local newlyUnlocked = _d30.newlyUnlocked
		do return Js.O({ career = M_starPoints.withStars(Js.ospread(withAchievements, Js.O({ starRating = M_rating.computeStarRating(withAchievements) }, { "starRating" }))), newlyUnlocked = newlyUnlocked, homeScore = userScore, awayScore = oppScore }, { "career", "newlyUnlocked", "homeScore", "awayScore" }) end
	end
	exports.simulateMissedFixture = simulateMissedFixture
	SPONSOR_CATEGORIES = Js.alit("Boots", "Sports Drink", "Sports Clothing", "Casual Clothing", "Food", "Cosmetics", "Watch", "Electronics", "Jewelry", "Car")
	exports.SPONSOR_CATEGORIES = SPONSOR_CATEGORIES
	EMPTY_SEASON_STATS = Js.O({ appearances = 0, goals = 0, hatTricks = 0, passes = 0, assists = 0, starMan = 0, totalRating = 0, ratingCount = 0 }, { "appearances", "goals", "hatTricks", "passes", "assists", "starMan", "totalRating", "ratingCount" })
	ENERGY_MATCH_COST = M_tuningStore.getTuning("energy.matchCost")
	exports.ENERGY_MATCH_COST = ENERGY_MATCH_COST
	Js.reexport(exports, M_injurySwitch, { ["INJURIES_ON"] = "INJURIES_ON", ["isRolledInjury"] = "isRolledInjury" })
	INJURY_RISK_BASE = 0.015
	exports.INJURY_RISK_BASE = INJURY_RISK_BASE
	INJURY_FATIGUE_FLOOR = M_tuningStore.getTuning("energy.injuryFloor")
	exports.INJURY_FATIGUE_FLOOR = INJURY_FATIGUE_FLOOR
	INJURY_RISK_FATIGUE_EXTRA = 0.085
	exports.INJURY_RISK_FATIGUE_EXTRA = INJURY_RISK_FATIGUE_EXTRA
	STARTER_BOOT_MATCHES = 3
	exports.STARTER_BOOT_MATCHES = STARTER_BOOT_MATCHES
	STARTER_WAGE = Math.round(M_economy.typicalWeeklyWage("premier"))
	STARTER_CONTRACT = Js.O({ wage = STARTER_WAGE, goalBonus = M_economy.goalBonusFor(STARTER_WAGE), assistBonus = M_economy.assistBonusFor(STARTER_WAGE), seasonsRemaining = 3 }, { "wage", "goalBonus", "assistBonus", "seasonsRemaining" })
	exports.STARTER_CONTRACT = STARTER_CONTRACT
	FIRST_CONTRACT_SIGNING_FEE = 0
	exports.FIRST_CONTRACT_SIGNING_FEE = FIRST_CONTRACT_SIGNING_FEE
	STAR_OFFER_MILESTONES = Js.alit(3, 4, 5)
	FORM_OFFER_THRESHOLD = 7.5
	FORM_OFFER_MIN_MATCHES = 5
	WINDOW_ORDER = Js.O({ summer = 0, january = 1 }, { "summer", "january" })
	exports.hasClub = M_calendar.hasClub
end
