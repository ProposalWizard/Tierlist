--!nocheck
--!nolint
-- Generated from lib/star/trainingLevels.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local TRAINING_LEVELS, SKILL_START, SKILL_MAX, MAX_STARS, levelDifficulty, levelSeed, starsForTry, skillFromStars, starsFromSkill, starsOf, totalStars, highestUnlocked, applyLevelResult
	levelDifficulty = function(level)
		local n = Math.max(1, Math.min(TRAINING_LEVELS, Math.round(level)))
		do return (SKILL_START + (((n - 1) * (SKILL_MAX - SKILL_START)) / (TRAINING_LEVELS - 1))) end
	end
	exports.levelDifficulty = levelDifficulty
	levelSeed = function(skill, level)
		local h = 2166136261
		for _ok1, _v2 in Js.iter((skill .. ":" .. Js.numstr(level))) do
			local ch = _v2
			h = Math.imul(Js.bxor(h, S.charCodeAt(ch, 0)), 16777619)
		end
		do return Js.ushr(h, 0) end
	end
	exports.levelSeed = levelSeed
	starsForTry = function(tryIndex)
		do return Math.max(0, (3 - tryIndex)) end
	end
	exports.starsForTry = starsForTry
	skillFromStars = function(stars)
		local s = Math.max(0, Math.min(MAX_STARS, stars))
		do return (SKILL_START + Math.round(((s * (SKILL_MAX - SKILL_START)) / MAX_STARS))) end
	end
	exports.skillFromStars = skillFromStars
	starsFromSkill = function(value)
		local stars = Math.max(0, Math.min(MAX_STARS, Math.round((((value - SKILL_START) * MAX_STARS) / (SKILL_MAX - SKILL_START)))))
		local out = Js.Array.from(Js.O({ length = TRAINING_LEVELS }, { "length" }), function()
			return 0
		end)
		for i = 0, TRAINING_LEVELS - 1 do
			A.set(out, i, Math.max(0, Math.min(3, (stars - (i * 3)))))
		end
		do return out end
	end
	exports.starsFromSkill = starsFromSkill
	starsOf = function(career, skill)
		local saved = (function() local _v = career.trainingStars; if _v == nil then return nil end; _v = _v[skill]; return _v end)()
		if (saved and (Js.alen(saved) == TRAINING_LEVELS)) then
			do return saved end
		end
		do return starsFromSkill(career.skills[skill]) end
	end
	exports.starsOf = starsOf
	totalStars = function(levels)
		do return A.reduce(levels, function(a, b)
			return (a + b)
		end, 0) end
	end
	exports.totalStars = totalStars
	highestUnlocked = function(levels)
		local firstEmpty = A.findIndex(levels, function(s)
			return (s == 0)
		end)
		do return (if (firstEmpty < 0) then TRAINING_LEVELS else (firstEmpty + 1)) end
	end
	exports.highestUnlocked = highestUnlocked
	applyLevelResult = function(career, skill, level, stars)
		local before = starsOf(career, skill)
		local i = Math.max(0, Math.min((TRAINING_LEVELS - 1), (level - 1)))
		local after = Js.aspread(before)
		A.set(after, i, Math.max(before[i + 1], Math.max(0, Math.min(3, stars))))
		local newStars = (after[i + 1] - before[i + 1])
		local oldCeiling = skillFromStars(totalStars(before))
		local newCeiling = skillFromStars(totalStars(after))
		local current = career.skills[skill]
		local winBack = Math.max(0, Math.min((oldCeiling - current), stars))
		local value = Math.min(SKILL_MAX, Math.min(newCeiling, ((current + winBack) + (newCeiling - oldCeiling))))
		local next_ = Math.max(current, value)
		do return Js.O({ career = Js.ospread(career, Js.O({ skills = Js.ospread(career.skills, (function() local _o = Js.O({}, nil); _o[Js.key(skill)] = next_; return _o end)()), trainingStars = Js.ospread((if career.trainingStars ~= nil then career.trainingStars else Js.O({}, nil)), (function() local _o = Js.O({}, nil); _o[Js.key(skill)] = after; return _o end)()) }, { "skills", "trainingStars" })), gained = (next_ - current), newStars = newStars }, { "career", "gained", "newStars" }) end
	end
	exports.applyLevelResult = applyLevelResult
	TRAINING_LEVELS = 30
	exports.TRAINING_LEVELS = TRAINING_LEVELS
	SKILL_START = 40
	exports.SKILL_START = SKILL_START
	SKILL_MAX = 100
	exports.SKILL_MAX = SKILL_MAX
	MAX_STARS = (TRAINING_LEVELS * 3)
end
