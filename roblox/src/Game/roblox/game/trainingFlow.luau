--!nocheck
--!nolint
-- Generated from roblox/game/trainingFlow.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_tuningStore = import("lib/star/tuningStore")
	local M_week = import("lib/star/week")
	local M_mechanics = import("lib/star/mechanics")
	local M_story = import("lib/star/story")
	local M_unlocks = import("lib/star/unlocks")
	local M_trainingLevels = import("lib/star/trainingLevels")
	local M_trainingLevelData = import("lib/star/trainingLevelData")
	local M_rating = import("lib/star/rating")
	local M_starPoints = import("lib/star/starPoints")
	local M_trainingLevelStore = import("lib/star/trainingLevelStore")
	local SKILL_LABELS, trainingEnergyCost, skillCard, levelList, mayPlayLevel, levelOverlay, trainingComplete
	trainingEnergyCost = function()
		do return M_tuningStore.getTuning("energy.trainingCost") end
	end
	exports.trainingEnergyCost = trainingEnergyCost
	skillCard = function(c, skill)
		local left = M_week.trainingLeft(c)
		local shut = ((skill == "aerial") and (not M_mechanics.mechanicOpen(c, "aerial")))
		local cost = trainingEnergyCost()
		local value = c.skills[skill]
		local day = (M_story.trainingDayOn(c) and A.includes(M_story.trainingDayLeft(c), skill))
		local locked = (not M_unlocks.isOpen(c, "training"))
		local canTrain = (((((not locked) and (not shut)) and (c.energy >= cost)) and (value < 100)) and ((left > 0) or day))
		local why = (if locked then M_unlocks.lockHint(c, "training") else (if shut then nil else (if (value >= 100) then "Maxed out." else (if ((left <= 0) and (not day)) then "No more sessions this week." else (if (c.energy < cost) then ("Needs " .. Js.numstr(cost) .. " energy.") else nil)))))
		local levels = M_trainingLevels.starsOf(c, skill)
		do return Js.O({ value = value, stars = M_trainingLevels.totalStars(levels), shut = shut, shutWhy = (if shut then ("Opens " .. S.toLowerCase(M_mechanics.mechanicDef("aerial").when)) else nil), canTrain = canTrain, why = why, highest = M_trainingLevels.highestUnlocked(levels) }, { "value", "stars", "shut", "shutWhy", "canTrain", "why", "highest" }) end
	end
	exports.skillCard = skillCard
	levelList = function(c, skill)
		local levels = M_trainingLevels.starsOf(c, skill)
		local top = M_trainingLevels.highestUnlocked(levels)
		do return A.map(levels, function(s, i)
			return Js.O({ level = (i + 1), stars = s, open = ((i + 1) <= top) }, { "level", "stars", "open" })
		end) end
	end
	exports.levelList = levelList
	mayPlayLevel = function(c, skill, level)
		local card = skillCard(c, skill)
		do return ((((card.canTrain and Js.NumberNS.isInteger(level)) and (level >= 1)) and (level <= card.highest)) and (level <= M_trainingLevels.TRAINING_LEVELS)) end
	end
	exports.mayPlayLevel = mayPlayLevel
	levelOverlay = function()
		do return M_trainingLevelData.trainingOverlay() end
	end
	exports.levelOverlay = levelOverlay
	trainingComplete = function(career, skill, level, stars)
		local s = Math.max(0, Math.min(3, Math.round(stars)))
		local res = M_trainingLevels.applyLevelResult(career, skill, level, s)
		local dayDrill = (M_story.trainingDayOn(career) and A.includes(M_story.trainingDayLeft(career), skill))
		local updated = Js.ospread(res.career, Js.O({ lastTrainedWeek = Js.ospread(career.lastTrainedWeek, (function() local _o = Js.O({}, nil); _o[Js.key(skill)] = career.week; return _o end)()), energy = Math.max(0, (career.energy - trainingEnergyCost())), starRating = career.starRating }, { "lastTrainedWeek", "energy", "starRating" }))
		updated.starRating = M_rating.computeStarRating(updated)
		local drilled = M_unlocks.recordDrill(M_week.spendTrainingSession(updated), M_starPoints.starStatus(career).total, M_starPoints.starsNow(career))
		do return Js.O({ career = (if dayDrill then M_story.recordTrainingDayDrill(drilled, skill) else drilled), gained = res.gained, newStars = res.newStars }, { "career", "gained", "newStars" }) end
	end
	exports.trainingComplete = trainingComplete
	SKILL_LABELS = Js.alit(Js.alit("pace", "Pace", "⚡", "Faster dribbles, more runs into space, quicker Touch Mode chase"), Js.alit("power", "Power", "💪", "Long shots and stronger crosses"), Js.alit("technique", "Technique", "🎯", "Ball control, curl, precise strikes"), Js.alit("vision", "Vision", "👁️", "More team-mates to pass to in every chance"), Js.alit("freeKick", "Free Kick", "🎪", "Free kicks, corners and penalties, and how many are yours"), Js.alit("aerial", "Aerial & Acrobatics", "🤸", "Headers and volleys"))
	exports.SKILL_LABELS = SKILL_LABELS
	Js.reexport(exports, M_trainingLevelStore, { ["fetchSharedTrainingLevels"] = "fetchSharedTrainingLevels" })
	exports.TRAINING_SESSIONS_PER_WEEK = M_week.TRAINING_SESSIONS_PER_WEEK
	exports.TRAINING_LEVELS = M_trainingLevels.TRAINING_LEVELS
end
