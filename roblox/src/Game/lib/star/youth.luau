--!nocheck
--!nolint
-- Generated from lib/star/youth.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_economy = import("lib/star/economy")
	local M_calendar = import("lib/star/calendar")
	local M_season = import("lib/star/season")
	local M_tuningStore = import("lib/star/tuningStore")
	local M_rating = import("lib/star/rating")
	local M_scoutOffers = import("lib/star/scoutOffers")
	local M_selection = import("lib/star/selection")
	local M_clubReputation = import("lib/star/clubReputation")
	local M_transfers = import("lib/star/transfers")
	local YOUTH_AGE_LIMIT, placementLabel, YOUTH_STANDING, PROMOTION_STANDING, LOAN_STANDING, LOAN_RETURN_STANDING, youthWage, YOUTH_LEVEL_BOTTOM, YOUTH_LEVEL_STEP, youthLevelFor, youthAbility, poisson, clamp, PROMOTION_PAR, PROGRESS_PER_RATING, PROMOTION_AT, playYouthMatch, YOUTH_MATCH_FITNESS, YOUTH_MATCH_ENERGY, YOUTH_MATCHES_GIVE_SKILL, matchSkillGain, applyYouthWeek, readyForPromotion, startYouthSpell, YOUTH_INTEREST_BELOW, YOUTH_LEAGUE_TWO_ABOVE, youthTakerFor, PROMOTION_BOSS, PROMOTION_SEASONS, promoteFromYouth, COLLAPSE_RATING, COLLAPSE_GAMES, YOUTH_DROP_AT, formHasCollapsed, dropToYouth, LOAN_WILDCARD_CHANCE, LOAN_TARGET_MIN, LOAN_TARGET_SPREAD, LOAN_DROP_RUNGS, divisionDown, rollLoanWildcard, startLoanSpell, loanProgress, loanRecallOffer, endLoan
	placementLabel = function(career)
		local p = career.placement
		if (not p) then
			do return "" end
		end
		if (p.kind == "loan") then
			do return ("On loan at " .. p.club) end
		end
		do return (if (career.player.age <= YOUTH_AGE_LIMIT) then "Youth team" else "Reserves") end
	end
	exports.placementLabel = placementLabel
	youthWage = function(club, division)
		do return M_economy.weeklyWageFor(club, division, YOUTH_STANDING) end
	end
	exports.youthWage = youthWage
	youthLevelFor = function(division)
		local rungsAboveBottom = (4 - M_calendar.divisionRank(division))
		do return (YOUTH_LEVEL_BOTTOM + (rungsAboveBottom * YOUTH_LEVEL_STEP)) end
	end
	exports.youthLevelFor = youthLevelFor
	youthAbility = function(skills)
		local _d1 = skills
		local pace = _d1.pace
		local power = _d1.power
		local technique = _d1.technique
		local vision = _d1.vision
		local freeKick = _d1.freeKick
		do return (((((pace + power) + technique) + vision) + freeKick) / 5) end
	end
	exports.youthAbility = youthAbility
	poisson = function(lambda, rng)
		local L = Math.exp((-(Math.max(0, lambda))))
		local k = 0
		local p = 1
		local _first2 = true
		while _first2 or ((p > L) and (k < 12)) do
			_first2 = false
			k += 1
			p *= rng()
		end
		do return (k - 1) end
	end
	playYouthMatch = function(career, rng)
		local p = career.placement
		local level = youthLevelFor(((function() local _v = p; if _v == nil then return nil end; _v = _v.division; return _v end)() or M_calendar.divisionOf(career)))
		local ability = youthAbility(career.skills)
		local edge = (ability - level)
		local ours = clamp((level + (edge * 0.25)), 10, 95)
		local theirs = clamp(level, 10, 95)
		local home = (math.fmod(career.week, 2) == 1)
		local raw = (if home then M_season.simulateFixtureScore(ours, theirs, rng) else M_season.simulateFixtureScore(theirs, ours, rng))
		local score = (if home then raw else Js.O({ home = raw.away, away = raw.home }, { "home", "away" }))
		local involvement = clamp((0.9 + (edge * 0.03)), 0.15, 3)
		local goals = Math.min(score.home, poisson((involvement * 0.62), rng))
		local assists = Math.min(Math.max(0, (score.home - goals)), poisson((involvement * 0.38), rng))
		local result = (if (score.home > score.away) then 1 else (if (score.home < score.away) then -1 else 0))
		local rating = clamp((((((6.2 + (goals * 0.9)) + (assists * 0.5)) + (edge * 0.02)) + (result * 0.3)) + ((rng() - 0.5) * 0.8)), 3, 10)
		local verdict = (if (goals >= 2) then "Unplayable this afternoon. They could not get near you." else (if (goals == 1) then "Took your goal well. More of that." else (if (assists > 0) then "Quiet, but you made the one that mattered." else (if (rating >= 7) then "Worked hard, did the right things. Keep going." else (if (rating >= 6) then "Nothing wrong with it. Nothing to write home about either." else (if (rating >= 5) then "You drifted out of that. They will have noticed upstairs." else "That was not good enough. You know it was not."))))))
		local progressDelta = (Math.round((((rating - PROMOTION_PAR) * PROGRESS_PER_RATING) * 10)) / 10)
		do return Js.O({ week = career.week, scored = score.home, conceded = score.away, goals = goals, assists = assists, rating = (Math.round((rating * 10)) / 10), verdict = verdict, progressDelta = progressDelta }, { "week", "scored", "conceded", "goals", "assists", "rating", "verdict", "progressDelta" }) end
	end
	exports.playYouthMatch = playYouthMatch
	matchSkillGain = function(rating, age)
		if (not YOUTH_MATCHES_GIVE_SKILL) then
			do return 0 end
		end
		local pool = (if (rating >= 8) then M_tuningStore.getTuning("training.matchPoolRating8") else (if (rating >= 7) then M_tuningStore.getTuning("training.matchPoolRating7") else (if (rating >= 6) then M_tuningStore.getTuning("training.matchPoolRating6") else 0)))
		do return ((pool * M_rating.growthMultiplier(age)) / M_tuningStore.getTuning("training.matchGainDivisor")) end
	end
	applyYouthWeek = function(career, match)
		local p = career.placement
		if ((not p) or (p.kind ~= "youth")) then
			do return career end
		end
		local progress = clamp((p.progress + match.progressDelta), 0, PROMOTION_AT)
		local gain = matchSkillGain(match.rating, career.player.age)
		local skills = (if (gain <= 0) then career.skills else Js.O({ pace = Math.min(100, Math.round((career.skills.pace + gain))), power = Math.min(100, Math.round((career.skills.power + gain))), technique = Math.min(100, Math.round((career.skills.technique + gain))), vision = Math.min(100, Math.round((career.skills.vision + gain))), freeKick = Math.min(100, Math.round((career.skills.freeKick + gain))), aerial = Math.min(100, Math.round((career.skills.aerial + gain))) }, { "pace", "power", "technique", "vision", "freeKick", "aerial" }))
		do return Js.ospread(career, Js.O({ skills = skills, matchFitness = clamp((career.matchFitness + YOUTH_MATCH_FITNESS), 0, 100), energy = clamp((career.energy - YOUTH_MATCH_ENERGY), 0, 100), placement = Js.ospread(p, Js.O({ progress = progress, apps = (p.apps + 1), goals = (p.goals + match.goals), assists = (p.assists + match.assists), last = match }, { "progress", "apps", "goals", "assists", "last" })) }, { "skills", "matchFitness", "energy", "placement" })) end
	end
	exports.applyYouthWeek = applyYouthWeek
	readyForPromotion = function(career)
		local p = career.placement
		do return (((not (not p)) and (p.kind == "youth")) and (p.progress >= PROMOTION_AT)) end
	end
	exports.readyForPromotion = readyForPromotion
	startYouthSpell = function(club, division, reason)
		do return Js.O({ kind = "youth", reason = reason, club = club, division = division, progress = 0, apps = 0, goals = 0, assists = 0 }, { "kind", "reason", "club", "division", "progress", "apps", "goals", "assists" }) end
	end
	exports.startYouthSpell = startYouthSpell
	youthTakerFor = function(trialScoreOutOf100, rng)
		local score = Math.max(0, Math.min(100, (if Js.NumberNS.isFinite(trialScoreOutOf100) then trialScoreOutOf100 else 0)))
		if (score < YOUTH_INTEREST_BELOW) then
			do return nil end
		end
		local division = (if (score >= YOUTH_LEAGUE_TWO_ABOVE) then "league_two" else "national_league")
		local clubs = M_scoutOffers.clubsForDivision(division)
		if (not Js.T(Js.alen(clubs))) then
			do return nil end
		end
		local club = (clubs[math.floor((rng() * Js.alen(clubs))) + 1] or clubs[1])
		do return Js.O({ club = club, division = division, clubs = clubs, pitch = (if (score >= YOUTH_LEAGUE_TWO_ABOVE) then "Nobody is handing you a professional contract on that. We will take you into the youth team and see what you do with it." else "It was not good enough for terms. It was good enough for us to want another look at you.") }, { "club", "division", "clubs", "pitch" }) end
	end
	exports.youthTakerFor = youthTakerFor
	promoteFromYouth = function(career)
		local p = career.placement
		if ((not p) or (p.kind ~= "youth")) then
			do return career end
		end
		local wage = M_economy.weeklyWageFor(p.club, p.division, PROMOTION_STANDING)
		do return Js.ospread(career, Js.O({ placement = nil, contract = Js.O({ club = p.club, wage = wage, goalBonus = M_economy.goalBonusFor(wage), assistBonus = M_economy.assistBonusFor(wage), seasonsRemaining = Math.max(career.contract.seasonsRemaining, PROMOTION_SEASONS) }, { "club", "wage", "goalBonus", "assistBonus", "seasonsRemaining" }), relationships = Js.ospread(career.relationships, Js.O({ boss = Math.max(career.relationships.boss, PROMOTION_BOSS) }, { "boss" })), form = Js.alit(), rawForm = Js.alit() }, { "placement", "contract", "relationships", "form", "rawForm" })) end
	end
	exports.promoteFromYouth = promoteFromYouth
	formHasCollapsed = function(career)
		if career.placement then
			do return false end
		end
		if (not Js.T(career.player.club)) then
			do return false end
		end
		if career.injury then
			do return false end
		end
		local recent = A.slice(career.form, 0, COLLAPSE_GAMES)
		if (Js.alen(recent) < COLLAPSE_GAMES) then
			do return false end
		end
		if (not A.every(recent, function(r)
			return (r < COLLAPSE_RATING)
		end)) then
			do return false end
		end
		do return (M_selection.selectionStanding(career) < YOUTH_DROP_AT) end
	end
	exports.formHasCollapsed = formHasCollapsed
	dropToYouth = function(career)
		if career.placement then
			do return career end
		end
		do return Js.ospread(career, Js.O({ placement = startYouthSpell(career.player.club, M_calendar.divisionOf(career), "form") }, { "placement" })) end
	end
	exports.dropToYouth = dropToYouth
	divisionDown = function(division, rungs)
		local d = division
		for i = 0, math.ceil(rungs) - 1 do
			d = (if Js.T(d) then M_calendar.divisionBelow(d) else nil)
			if (not Js.T(d)) then
				do return nil end
			end
		end
		do return d end
	end
	rollLoanWildcard = function(offerClub, offerDivision, seasons, rng)
		if ((offerDivision ~= "premier") and (offerDivision ~= "championship")) then
			do return nil end
		end
		if (rng() >= LOAN_WILDCARD_CHANCE) then
			do return nil end
		end
		local hostDivision = divisionDown(offerDivision, LOAN_DROP_RUNGS)
		if (not Js.T(hostDivision)) then
			do return nil end
		end
		local hostClubs = M_scoutOffers.clubsForDivision(hostDivision)
		if (not Js.T(Js.alen(hostClubs))) then
			do return nil end
		end
		local modest = A.filter(hostClubs, function(c)
			return (M_clubReputation.clubStanding(c, hostDivision) < 0.7)
		end)
		local pool = (if Js.T(Js.alen(modest)) then modest else hostClubs)
		local hostClub = (pool[math.floor((rng() * Js.alen(pool))) + 1] or hostClubs[1])
		do return Js.O({ parentClub = offerClub, parentDivision = offerDivision, hostClub = hostClub, hostDivision = hostDivision, hostClubs = hostClubs, target = (LOAN_TARGET_MIN + math.floor((rng() * LOAN_TARGET_SPREAD))), wage = M_economy.weeklyWageFor(offerClub, offerDivision, LOAN_STANDING), seasons = seasons }, { "parentClub", "parentDivision", "hostClub", "hostDivision", "hostClubs", "target", "wage", "seasons" }) end
	end
	exports.rollLoanWildcard = rollLoanWildcard
	startLoanSpell = function(setup, goalsAtStart)
		if goalsAtStart == nil then goalsAtStart = 0 end
		do return Js.O({ kind = "loan", reason = "wildcard", club = setup.hostClub, division = setup.hostDivision, parentClub = setup.parentClub, parentDivision = setup.parentDivision, target = setup.target, goalsAtStart = goalsAtStart, progress = 0, apps = 0, goals = 0, assists = 0 }, { "kind", "reason", "club", "division", "parentClub", "parentDivision", "target", "goalsAtStart", "progress", "apps", "goals", "assists" }) end
	end
	exports.startLoanSpell = startLoanSpell
	loanProgress = function(career)
		local p = career.placement
		if (((not p) or (p.kind ~= "loan")) or (p.target == nil)) then
			do return nil end
		end
		local scored = Math.max(0, (career.seasonStats.goals - (if p.goalsAtStart ~= nil then p.goalsAtStart else 0)))
		do return Js.O({ scored = scored, target = p.target, met = (scored >= p.target), weeksLeft = Math.max(0, ((M_calendar.matchweeksFor(M_calendar.divisionOf(career)) - career.week) + 1)) }, { "scored", "target", "met", "weeksLeft" }) end
	end
	exports.loanProgress = loanProgress
	loanRecallOffer = function(career)
		local progress = loanProgress(career)
		local p = career.placement
		if ((((not progress) or (not progress.met)) or (not Js.T((function() local _v = p; if _v == nil then return nil end; _v = _v.parentClub; return _v end)()))) or (not Js.T(p.parentDivision))) then
			do return nil end
		end
		local strength = (youthLevelFor(p.parentDivision) + 20)
		local wage = M_economy.offerWageFor(p.parentClub, p.parentDivision, M_transfers.reputation(career), (strength - (youthLevelFor(p.division) + 20)), career.contract.wage)
		local floor = M_economy.weeklyWageFor(p.parentClub, p.parentDivision, LOAN_RETURN_STANDING)
		local finalWage = Math.max(wage, floor)
		do return Js.O({ club = p.parentClub, division = p.parentDivision, strength = strength, position = 0, wage = finalWage, goalBonus = M_economy.goalBonusFor(finalWage), assistBonus = M_economy.assistBonusFor(finalWage), seasons = 3, signingFee = 0, clauses = Js.O({}, nil), pitch = ("You got the " .. Js.str(p.target) .. " they asked for. " .. p.parentClub .. " want you back.") }, { "club", "division", "strength", "position", "wage", "goalBonus", "assistBonus", "seasons", "signingFee", "clauses", "pitch" }) end
	end
	exports.loanRecallOffer = loanRecallOffer
	endLoan = function(career)
		local p = career.placement
		if ((function() local _v = p; if _v == nil then return nil end; _v = _v.kind; return _v end)() ~= "loan") then
			do return career end
		end
		if (career.player.club ~= p.club) then
			do return Js.ospread(career, Js.O({ placement = nil }, { "placement" })) end
		end
		local wage = M_economy.weeklyWageFor(p.club, p.division, PROMOTION_STANDING)
		do return Js.ospread(career, Js.O({ placement = nil, contract = Js.ospread(career.contract, Js.O({ club = p.club, wage = wage, goalBonus = M_economy.goalBonusFor(wage), assistBonus = M_economy.assistBonusFor(wage), seasonsRemaining = Math.max(1, career.contract.seasonsRemaining) }, { "club", "wage", "goalBonus", "assistBonus", "seasonsRemaining" })) }, { "placement", "contract" })) end
	end
	exports.endLoan = endLoan
	YOUTH_AGE_LIMIT = 21
	exports.YOUTH_AGE_LIMIT = YOUTH_AGE_LIMIT
	YOUTH_STANDING = 0
	exports.YOUTH_STANDING = YOUTH_STANDING
	PROMOTION_STANDING = 0.35
	exports.PROMOTION_STANDING = PROMOTION_STANDING
	LOAN_STANDING = 0.2
	exports.LOAN_STANDING = LOAN_STANDING
	LOAN_RETURN_STANDING = 0.45
	exports.LOAN_RETURN_STANDING = LOAN_RETURN_STANDING
	YOUTH_LEVEL_BOTTOM = 32
	exports.YOUTH_LEVEL_BOTTOM = YOUTH_LEVEL_BOTTOM
	YOUTH_LEVEL_STEP = 6
	exports.YOUTH_LEVEL_STEP = YOUTH_LEVEL_STEP
	clamp = function(v, lo, hi)
		return Math.max(lo, Math.min(hi, v))
	end
	PROMOTION_PAR = 6.5
	exports.PROMOTION_PAR = PROMOTION_PAR
	PROGRESS_PER_RATING = 9
	exports.PROGRESS_PER_RATING = PROGRESS_PER_RATING
	PROMOTION_AT = 100
	exports.PROMOTION_AT = PROMOTION_AT
	YOUTH_MATCH_FITNESS = 10
	exports.YOUTH_MATCH_FITNESS = YOUTH_MATCH_FITNESS
	YOUTH_MATCH_ENERGY = 12
	exports.YOUTH_MATCH_ENERGY = YOUTH_MATCH_ENERGY
	YOUTH_MATCHES_GIVE_SKILL = false
	YOUTH_INTEREST_BELOW = 12
	exports.YOUTH_INTEREST_BELOW = YOUTH_INTEREST_BELOW
	YOUTH_LEAGUE_TWO_ABOVE = 20
	exports.YOUTH_LEAGUE_TWO_ABOVE = YOUTH_LEAGUE_TWO_ABOVE
	PROMOTION_BOSS = 66
	exports.PROMOTION_BOSS = PROMOTION_BOSS
	PROMOTION_SEASONS = 2
	exports.PROMOTION_SEASONS = PROMOTION_SEASONS
	COLLAPSE_RATING = 5.5
	exports.COLLAPSE_RATING = COLLAPSE_RATING
	COLLAPSE_GAMES = 3
	exports.COLLAPSE_GAMES = COLLAPSE_GAMES
	YOUTH_DROP_AT = 30
	exports.YOUTH_DROP_AT = YOUTH_DROP_AT
	LOAN_WILDCARD_CHANCE = 0.18
	exports.LOAN_WILDCARD_CHANCE = LOAN_WILDCARD_CHANCE
	LOAN_TARGET_MIN = 6
	exports.LOAN_TARGET_MIN = LOAN_TARGET_MIN
	LOAN_TARGET_SPREAD = 5
	exports.LOAN_TARGET_SPREAD = LOAN_TARGET_SPREAD
	LOAN_DROP_RUNGS = 2
	exports.LOAN_DROP_RUNGS = LOAN_DROP_RUNGS
end
