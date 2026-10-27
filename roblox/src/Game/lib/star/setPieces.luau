--!nocheck
--!nolint
-- Generated from lib/star/setPieces.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local PENALTY_STAR_WEIGHT, FREE_KICK_STAR_WEIGHT, effectiveTaker, clubStrength, STORY_PENALTY_GOALS, STORY_FREE_KICK_SKILL, STORY_CORNER_SKILL, setPieceDuties, setPieceSkills
	effectiveTaker = function(career, starWeight)
		if starWeight == nil then starWeight = 4 end
		do return (career.skills.freeKick + (career.starRating * starWeight)) end
	end
	clubStrength = function(career)
		do return ((function() local _v = A.find(career.league, function(t)
			return (t.name == career.player.club)
		end); if _v == nil then return nil end; _v = _v.strength; return _v end)() or 70) end
	end
	setPieceDuties = function(career, status, opts)
		if status == nil then status = career.status end
		if opts == nil then opts = Js.O({}, nil) end
		local s = clubStrength(career)
		local freeKickNeeded = Math.max(30, Math.min(88, (s - 12)))
		local penaltyNeeded = Math.max(25, Math.min(80, (s - 20)))
		local story = (not (not (function() local _v = career.unlocks; if _v == nil then return nil end; _v = _v.story; return _v end)()))
		local pensEarned = ((not story) or (((function() local _v = career.careerStats; if _v == nil then return nil end; _v = _v.goals; return _v end)() or 0) >= STORY_PENALTY_GOALS))
		local fksEarned = ((not story) or ((((function() local _v = career.skills; if _v == nil then return nil end; _v = _v.technique; return _v end)() or 0) >= STORY_FREE_KICK_SKILL) and (((function() local _v = career.skills; if _v == nil then return nil end; _v = _v.vision; return _v end)() or 0) >= STORY_FREE_KICK_SKILL)))
		local onThePitch = (status ~= "Squad")
		local eff = effectiveTaker(career)
		local penaltyStarWeight = (if opts.penaltyStarWeight ~= nil then opts.penaltyStarWeight else PENALTY_STAR_WEIGHT)
		local penaltyStanding = effectiveTaker(career, penaltyStarWeight)
		do return Js.O({ freeKicks = ((onThePitch and fksEarned) and (eff >= freeKickNeeded)), penalties = ((onThePitch and pensEarned) and (penaltyStanding >= penaltyNeeded)), corners = ((not story) or ((((function() local _v = career.skills; if _v == nil then return nil end; _v = _v.technique; return _v end)() or 0) >= STORY_CORNER_SKILL) and (((function() local _v = career.skills; if _v == nil then return nil end; _v = _v.vision; return _v end)() or 0) >= STORY_CORNER_SKILL))), freeKickNeeded = freeKickNeeded, penaltyNeeded = penaltyNeeded, penaltyStanding = penaltyStanding, penaltyStarWeight = penaltyStarWeight }, { "freeKicks", "penalties", "corners", "freeKickNeeded", "penaltyNeeded", "penaltyStanding", "penaltyStarWeight" }) end
	end
	exports.setPieceDuties = setPieceDuties
	setPieceSkills = function(skills, freeKick, kind)
		if (((kind ~= "free_kick") and (kind ~= "penalty")) and (kind ~= "corner")) then
			do return skills end
		end
		do return Js.O({ power = skills.power, technique = Math.round(((skills.technique * 0.4) + (freeKick * 0.6))) }, { "power", "technique" }) end
	end
	exports.setPieceSkills = setPieceSkills
	PENALTY_STAR_WEIGHT = 8
	exports.PENALTY_STAR_WEIGHT = PENALTY_STAR_WEIGHT
	FREE_KICK_STAR_WEIGHT = 4
	exports.FREE_KICK_STAR_WEIGHT = FREE_KICK_STAR_WEIGHT
	STORY_PENALTY_GOALS = 10
	exports.STORY_PENALTY_GOALS = STORY_PENALTY_GOALS
	STORY_FREE_KICK_SKILL = 60
	exports.STORY_FREE_KICK_SKILL = STORY_FREE_KICK_SKILL
	STORY_CORNER_SKILL = 70
	exports.STORY_CORNER_SKILL = STORY_CORNER_SKILL
end
