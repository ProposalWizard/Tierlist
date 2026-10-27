--!nocheck
--!nolint
-- Generated from lib/star/signingTalk.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_calendar = import("lib/star/calendar")
	local M_economy = import("lib/star/economy")
	local M_trial = import("lib/star/trial")
	local M_negotiation = import("lib/star/negotiation")
	local seasonWeeks, weeklyToSeason, seasonToWeekly, TRIALIST_STRENGTH_FLOOR, TRIALIST_STRENGTH_CEILING, trialistStrength, fairWageFor, standingFor, bestAndWorst, SCOUT_STAGE_NOUN, managerTalkFor, wageFloorFor, agreedWeeklyWage
	seasonWeeks = function(division)
		do return M_calendar.matchweeksFor(division) end
	end
	exports.seasonWeeks = seasonWeeks
	weeklyToSeason = function(weekly, division)
		do return Math.max(1, Math.round((weekly * seasonWeeks(division)))) end
	end
	exports.weeklyToSeason = weeklyToSeason
	seasonToWeekly = function(season, division)
		do return Math.max(1, Math.round((season / seasonWeeks(division)))) end
	end
	exports.seasonToWeekly = seasonToWeekly
	trialistStrength = function(trialScore)
		local s = (Math.max(0, Math.min(100, (if Js.NumberNS.isFinite(trialScore) then trialScore else 0))) / 100)
		do return (TRIALIST_STRENGTH_FLOOR + (s * (TRIALIST_STRENGTH_CEILING - TRIALIST_STRENGTH_FLOOR))) end
	end
	exports.trialistStrength = trialistStrength
	fairWageFor = function(club, division, clubStrength, trialScoreOutOf100)
		do return M_economy.offerWageFor(club, division, trialScoreOutOf100, (clubStrength - trialistStrength(trialScoreOutOf100)), 0) end
	end
	exports.fairWageFor = fairWageFor
	standingFor = function(clubStrength, trialScoreOutOf100)
		do return M_economy.offerStanding(trialScoreOutOf100, (clubStrength - trialistStrength(trialScoreOutOf100))) end
	end
	exports.standingFor = standingFor
	bestAndWorst = function(trial)
		local best = nil
		local worst = nil
		local bestScore = -1
		local worstScore = 101
		do
			local _arr1 = M_trial.trialStagesFor(trial)
			local _i2 = 0
			while _i2 < Js.alen(_arr1) do
				_i2 += 1
				local stage = _arr1[_i2]
				local r = trial.results[stage]
				if (not r) then
					do continue end
				end
				if (r.score > bestScore) then
					bestScore = r.score
					best = stage
				end
				if (r.score < worstScore) then
					worstScore = r.score
					worst = stage
				end
			end
		end
		if (best == worst) then
			worst = nil
		end
		do return Js.O({ best = best, worst = worst }, { "best", "worst" }) end
	end
	managerTalkFor = function(args)
		local _d3 = args
		local trial = _d3.trial
		local club = _d3.club
		local division = _d3.division
		local clubStrength = _d3.clubStrength
		local playerFirstName = _d3.playerFirstName
		local rng = _d3.rng
		local stageWord = function(st)
			return (if args.scoutNouns then ("Your " .. SCOUT_STAGE_NOUN[st]) else ("The " .. S.toLowerCase(M_trial.STAGE_LABEL[st])))
		end
		local score = M_trial.trialScore(trial)
		local _d4 = bestAndWorst(trial)
		local best = _d4.best
		local worst = _d4.worst
		local fairWeekly = fairWageFor(club, division, clubStrength, score)
		local negotiation = M_negotiation.startNegotiation(weeklyToSeason(fairWeekly, division), "selling", rng)
		local openingWeekly = seasonToWeekly(negotiation.theirPosition, division)
		local opener = (if (score >= 85) then (playerFirstName .. ". I have been doing this a long time and I do not say this often — that was the best afternoon anybody has had on that pitch this year.") else (if (score >= 70) then (playerFirstName .. ". Sit down. I liked what I saw, and I do not say that to be kind.") else (if (score >= 50) then (playerFirstName .. ". There is something there. It is rough, and it is there.") else (playerFirstName .. ". I will be straight with you, because nobody else will be."))))
		local onBest = (if Js.T(best) then (if (score >= 50) then (stageWord(best) .. " — that is the bit I keep thinking about.") else (stageWord(best) .. " was the one thing that stood up.")) else "")
		local onWorst = (if Js.T(worst) then (stageWord(worst) .. " is nowhere near it yet. We would work on that every day.") else "")
		local onClub = ("We are " .. club .. ". You would be training with us from Monday.")
		do return Js.O({ club = club, division = division, lines = A.filter(Js.alit(opener, onBest, onWorst, onClub), Js.Boolean), best = best, worst = worst, fairWeekly = fairWeekly, openingWeekly = openingWeekly, negotiation = negotiation }, { "club", "division", "lines", "best", "worst", "fairWeekly", "openingWeekly", "negotiation" }) end
	end
	exports.managerTalkFor = managerTalkFor
	wageFloorFor = function(club, division)
		do return M_economy.weeklyWageFor(club, division, 0) end
	end
	exports.wageFloorFor = wageFloorFor
	agreedWeeklyWage = function(finalSeasonPrice, club, division)
		if (finalSeasonPrice == nil) then
			do return nil end
		end
		do return Math.max(wageFloorFor(club, division), seasonToWeekly(finalSeasonPrice, division)) end
	end
	exports.agreedWeeklyWage = agreedWeeklyWage
	TRIALIST_STRENGTH_FLOOR = 42
	exports.TRIALIST_STRENGTH_FLOOR = TRIALIST_STRENGTH_FLOOR
	TRIALIST_STRENGTH_CEILING = 80
	exports.TRIALIST_STRENGTH_CEILING = TRIALIST_STRENGTH_CEILING
	SCOUT_STAGE_NOUN = Js.O({ freeKicks = "free-kick taking", technique = "first touch", dribbling = "dribbling", shootout = "penalty taking", penalties = "penalty taking", vision = "passing", fiveASide = "five-a-side game" }, { "freeKicks", "technique", "dribbling", "shootout", "penalties", "vision", "fiveASide" })
	exports.SCOUT_STAGE_NOUN = SCOUT_STAGE_NOUN
end
