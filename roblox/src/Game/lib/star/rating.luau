--!nocheck
--!nolint
-- Generated from lib/star/rating.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_tuningStore = import("lib/star/tuningStore")
	local M_records = import("lib/star/records")
	local SKILL_WEIGHTS, attributeOverall, TROPHY_FAME, HONOUR_CAP, honourPoints, computeStarRating, displayOverall, growthMultiplier
	attributeOverall = function(skills)
		do return (((((skills.pace * SKILL_WEIGHTS.pace) + (skills.power * SKILL_WEIGHTS.power)) + (skills.technique * SKILL_WEIGHTS.technique)) + (skills.vision * SKILL_WEIGHTS.vision)) + (skills.freeKick * SKILL_WEIGHTS.freeKick)) end
	end
	exports.attributeOverall = attributeOverall
	honourPoints = function(career)
		local trophies = (A.reduce(career.trophies, function(sum, t)
			return (sum + (if TROPHY_FAME[t.competition] ~= nil then TROPHY_FAME[t.competition] else M_tuningStore.getTuning("rating.unlistedTrophyFame")))
		end, 0) * M_tuningStore.getTuning("rating.trophyFameScale"))
		local ballonDor = (career.ballonDorWins * M_tuningStore.getTuning("rating.ballonDorPoints"))
		local achievements = (Js.alen(career.achievements) * M_tuningStore.getTuning("rating.achievementPoints"))
		local records = (Js.alen(A.filter(M_records.RECORDS, function(r)
			return M_records.recordBeaten(career, r)
		end)) * M_tuningStore.getTuning("rating.recordPoints"))
		local body = (((Math.sqrt(career.careerStats.goals) * M_tuningStore.getTuning("rating.goalsWeight")) + (Math.sqrt(career.careerStats.assists) * M_tuningStore.getTuning("rating.assistsWeight"))) + (Math.sqrt(career.careerStats.appearances) * M_tuningStore.getTuning("rating.appearancesWeight")))
		do return Math.min(HONOUR_CAP, ((((trophies + ballonDor) + achievements) + records) + body)) end
	end
	computeStarRating = function(career)
		local total = ((attributeOverall(career.skills) + honourPoints(career)) - M_tuningStore.getTuning("rating.offset"))
		do return Math.max(M_tuningStore.getTuning("rating.floor"), Math.min(5, (total / M_tuningStore.getTuning("rating.divisor")))) end
	end
	exports.computeStarRating = computeStarRating
	displayOverall = function(starRating)
		do return Math.max(1, Math.min(100, Math.round((M_tuningStore.getTuning("rating.displayBase") + (starRating * M_tuningStore.getTuning("rating.displayScale")))))) end
	end
	exports.displayOverall = displayOverall
	growthMultiplier = function(age)
		if (age <= 19) then
			do return M_tuningStore.getTuning("rating.growthUnder20") end
		end
		if (age <= 23) then
			do return M_tuningStore.getTuning("rating.growthUnder24") end
		end
		if (age <= 28) then
			do return M_tuningStore.getTuning("rating.growthUnder29") end
		end
		if (age <= 31) then
			do return M_tuningStore.getTuning("rating.growthUnder32") end
		end
		do return M_tuningStore.getTuning("rating.growthOver31") end
	end
	exports.growthMultiplier = growthMultiplier
	SKILL_WEIGHTS = Js.O({ pace = M_tuningStore.getTuning("rating.weightPace"), power = M_tuningStore.getTuning("rating.weightPower"), technique = M_tuningStore.getTuning("rating.weightTechnique"), vision = M_tuningStore.getTuning("rating.weightVision"), freeKick = M_tuningStore.getTuning("rating.weightFreeKick"), aerial = 0 }, { "pace", "power", "technique", "vision", "freeKick", "aerial" })
	TROPHY_FAME = Js.O({ ["Premier League"] = 25, Championship = 20, ["Champions League"] = 22, ["Europa League"] = 12, ["Conference League"] = 8, ["FA Cup"] = 14, ["League Cup"] = 9, ["Lower League Trophy"] = 3, ["Community Shield"] = 2.5, ["Super Cup"] = 2.5 }, { "Premier League", "Championship", "Champions League", "Europa League", "Conference League", "FA Cup", "League Cup", "Lower League Trophy", "Community Shield", "Super Cup" })
	exports.TROPHY_FAME = TROPHY_FAME
	HONOUR_CAP = M_tuningStore.getTuning("rating.honourCap")
end
