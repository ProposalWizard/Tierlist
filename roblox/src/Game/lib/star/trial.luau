--!nocheck
--!nolint
-- Generated from lib/star/trial.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_season = import("lib/star/season")
	local TRIAL_STAGES, LEGACY_TRIAL_STAGES, trialStagesFor, STAGE_LABEL, SHARP_KEEPER_BONUS, KEEPER_STAGES, TRIAL_ADVERSITY, ADVERSITY_CHANCE, liveStagesOf, LIVE_ADVERSITY, adversityFor, adversityOn, adversityWeightFor, clamp01, RELOAD_GRACE, RELOAD_DIFFICULTY_STEP, RELOAD_DIFFICULTY_CAP, reloadDifficultyBump, SCORE_BASE, SCORE_DIFFICULTY_SPAN, startTrial, difficultyFor, scoringDifficultyFor, keeperBonusFor, stageScore, recordStage, beginStage, resumeInterrupted, noteReload, nextStage, trialComplete, trialScore
	trialStagesFor = function(trial)
		local legacyDone = A.every(LEGACY_TRIAL_STAGES, function(s)
			return (not (not trial.results[s]))
		end)
		do return (if legacyDone then LEGACY_TRIAL_STAGES else TRIAL_STAGES) end
	end
	exports.trialStagesFor = trialStagesFor
	liveStagesOf = function(e)
		do return A.filter(e.stages, function(st)
			return A.includes(TRIAL_STAGES, st)
		end) end
	end
	adversityFor = function(trial)
		if (not Js.T(trial.adversity)) then
			do return nil end
		end
		do return (A.find(TRIAL_ADVERSITY, function(e)
			return (e.id == trial.adversity)
		end) or nil) end
	end
	exports.adversityFor = adversityFor
	adversityOn = function(trial, stage)
		if (trial.adversityStage ~= stage) then
			do return nil end
		end
		do return adversityFor(trial) end
	end
	exports.adversityOn = adversityOn
	adversityWeightFor = function(trial, stage)
		do return ((function() local _v = adversityOn(trial, stage); if _v == nil then return nil end; _v = _v.weight; return _v end)() or 0) end
	end
	exports.adversityWeightFor = adversityWeightFor
	reloadDifficultyBump = function(reloads)
		local charged = (if Js.NumberNS.isFinite(reloads) then Math.max(0, math.floor(reloads)) else 0)
		local past = Math.max(0, (charged - RELOAD_GRACE))
		do return Math.min(RELOAD_DIFFICULTY_CAP, (past * RELOAD_DIFFICULTY_STEP)) end
	end
	exports.reloadDifficultyBump = reloadDifficultyBump
	startTrial = function(seed)
		if seed == nil then seed = math.floor((Math.random() * 4294967295)) end
		local rng = M_season.mulberry32(seed)
		local baseDifficulty = clamp01(Math.pow(rng(), 1.6))
		local stageRolls = Js.O({}, nil)
		do
			local _arr1 = TRIAL_STAGES
			local _i2 = 0
			while _i2 < Js.alen(_arr1) do
				_i2 += 1
				local stage = _arr1[_i2]
				stageRolls[stage] = ((rng() - 0.5) * 0.4)
			end
		end
		local pick = function(xs, r)
			return xs[Math.min((Js.alen(xs) - 1), math.floor((r * Js.alen(xs)))) + 1]
		end
		local event = (if (rng() < ADVERSITY_CHANCE) then pick(LIVE_ADVERSITY, rng()) else nil)
		local adversity = (if event then event.id else nil)
		local adversityStage = (if event then pick(liveStagesOf(event), rng()) else nil)
		do return Js.O({ seed = seed, baseDifficulty = baseDifficulty, stageRolls = stageRolls, results = Js.O({}, nil), adversity = adversity, adversityStage = adversityStage, reloads = 0, resumes = 0, startedAt = Js.Date.now() }, { "seed", "baseDifficulty", "stageRolls", "results", "adversity", "adversityStage", "reloads", "resumes", "startedAt" }) end
	end
	exports.startTrial = startTrial
	difficultyFor = function(trial, stage)
		do return clamp01(((trial.baseDifficulty + (if trial.stageRolls[stage] ~= nil then trial.stageRolls[stage] else 0)) + reloadDifficultyBump(trial.reloads))) end
	end
	exports.difficultyFor = difficultyFor
	scoringDifficultyFor = function(trial, stage)
		do return clamp01(((trial.baseDifficulty + (if trial.stageRolls[stage] ~= nil then trial.stageRolls[stage] else 0)) + adversityWeightFor(trial, stage))) end
	end
	exports.scoringDifficultyFor = scoringDifficultyFor
	keeperBonusFor = function(trial, stage)
		do return (if ((trial.adversity == "sharp-keeper") and (trial.adversityStage == stage)) then SHARP_KEEPER_BONUS else 0) end
	end
	exports.keeperBonusFor = keeperBonusFor
	stageScore = function(quality, difficulty)
		local worth = (SCORE_BASE + (SCORE_DIFFICULTY_SPAN * clamp01(difficulty)))
		do return Math.round((100 * clamp01((clamp01(quality) * worth)))) end
	end
	exports.stageScore = stageScore
	recordStage = function(trial, stage, quality)
		if trial.results[stage] then
			do return trial end
		end
		local played = clamp01(quality)
		do return Js.ospread(trial, (if (trial.inProgress ~= nil) then Js.O({ inProgress = nil }, { "inProgress" }) else nil), Js.O({ results = Js.ospread(trial.results, (function() local _o = Js.O({}, nil); _o[Js.key(stage)] = Js.O({ quality = played, difficulty = clamp01((difficultyFor(trial, stage) + adversityWeightFor(trial, stage))), score = (if (((stage == "penalties") or (stage == "freeKicks")) or (stage == "shootout")) then Math.round((100 * played)) else stageScore(played, scoringDifficultyFor(trial, stage))), decidedAt = Js.Date.now() }, { "quality", "difficulty", "score", "decidedAt" }); return _o end)()) }, { "results" })) end
	end
	exports.recordStage = recordStage
	beginStage = function(trial, stage)
		if (trial.inProgress == stage) then
			do return trial end
		end
		do return Js.ospread(trial, Js.O({ inProgress = stage }, { "inProgress" })) end
	end
	exports.beginStage = beginStage
	resumeInterrupted = function(trial)
		if trialComplete(trial) then
			do return false end
		end
		if (trial.inProgress ~= nil) then
			do return ((trial.inProgress ~= nil) and (not trial.results[trial.inProgress])) end
		end
		if (trial.fiveASide ~= nil) then
			do return true end
		end
		if (Js.alen(Js.Object.keys(trial.results)) > 0) then
			do return true end
		end
		do return ((if trial.resumes ~= nil then trial.resumes else 0) > 0) end
	end
	exports.resumeInterrupted = resumeInterrupted
	noteReload = function(trial)
		local charge = resumeInterrupted(trial)
		do return Js.ospread(trial, Js.O({ resumes = ((if trial.resumes ~= nil then trial.resumes else 0) + 1), reloads = (trial.reloads + (if charge then 1 else 0)) }, { "resumes", "reloads" })) end
	end
	exports.noteReload = noteReload
	nextStage = function(trial)
		do return (A.find(trialStagesFor(trial), function(s)
			return (not trial.results[s])
		end) or nil) end
	end
	exports.nextStage = nextStage
	trialComplete = function(trial)
		do return (nextStage(trial) == nil) end
	end
	exports.trialComplete = trialComplete
	trialScore = function(trial)
		local stages = trialStagesFor(trial)
		local total = A.reduce(stages, function(sum, s)
			return (sum + ((function() local _v = trial.results[s]; if _v == nil then return nil end; _v = _v.score; return _v end)() or 0))
		end, 0)
		do return Math.round((total / Js.alen(stages))) end
	end
	exports.trialScore = trialScore
	TRIAL_STAGES = Js.alit("freeKicks", "technique", "dribbling", "vision", "shootout")
	exports.TRIAL_STAGES = TRIAL_STAGES
	LEGACY_TRIAL_STAGES = Js.alit("penalties", "freeKicks", "dribbling", "vision", "fiveASide")
	exports.LEGACY_TRIAL_STAGES = LEGACY_TRIAL_STAGES
	STAGE_LABEL = Js.O({ freeKicks = "Free kicks", technique = "Through the gate", dribbling = "Take him on", shootout = "Penalty shootout", penalties = "Penalties", vision = "Find the pass", fiveASide = "Five-a-side" }, { "freeKicks", "technique", "dribbling", "shootout", "penalties", "vision", "fiveASide" })
	exports.STAGE_LABEL = STAGE_LABEL
	SHARP_KEEPER_BONUS = 15
	exports.SHARP_KEEPER_BONUS = SHARP_KEEPER_BONUS
	KEEPER_STAGES = Js.alit("freeKicks", "shootout")
	TRIAL_ADVERSITY = Js.alit(Js.O({ id = "sharp-keeper", label = "Keeper's on fire", blurb = "Their keeper has turned up in the mood of his life. He is saving things he has no business saving.", stages = KEEPER_STAGES, weight = 0.3, flavour = false }, { "id", "label", "blurb", "stages", "weight", "flavour" }), Js.O({ id = "cold-keeper", label = "Gives nothing away", blurb = "This one does not flinch. He waits, he watches, and he tells you absolutely nothing before you strike it.", stages = Js.alit("shootout"), weight = 0.28, flavour = false }, { "id", "label", "blurb", "stages", "weight", "flavour" }), Js.O({ id = "big-wall", label = "One more in the wall", blurb = "They have put an extra body in front of you. Round it or over it — there is no through it.", stages = Js.alit("freeKicks"), weight = 0.22, flavour = false }, { "id", "label", "blurb", "stages", "weight", "flavour" }), Js.O({ id = "long-range", label = "Pushed further out", blurb = "The coach keeps waving the ball back. Every one of these is from further than you would pick.", stages = Js.alit("freeKicks"), weight = 0.25, flavour = false }, { "id", "label", "blurb", "stages", "weight", "flavour" }), Js.O({ id = "quick-feet", label = "They're rapid", blurb = "Whoever these lads are, they are quick. You are not going to stroll past anybody today.", stages = Js.alit("dribbling"), weight = 0.25, flavour = false }, { "id", "label", "blurb", "stages", "weight", "flavour" }), Js.O({ id = "extra-man", label = "An extra body", blurb = "Somebody has been thrown into the last wave. One more to beat than the man before you had.", stages = Js.alit("dribbling"), weight = 0.2, flavour = false }, { "id", "label", "blurb", "stages", "weight", "flavour" }), Js.O({ id = "snap-decision", label = "No time on it", blurb = "They are closing you down the instant you look up. Whatever you see, you see it fast.", stages = Js.alit("vision"), weight = 0.28, flavour = false }, { "id", "label", "blurb", "stages", "weight", "flavour" }), Js.O({ id = "crowded-picture", label = "Busy in there", blurb = "More bodies than the picture wants. Finding the right one means discounting the wrong ones first.", stages = Js.alit("vision"), weight = 0.2, flavour = false }, { "id", "label", "blurb", "stages", "weight", "flavour" }), Js.O({ id = "tight-margins", label = "Nothing in it", blurb = "Nobody is properly free. The best ball today is barely better than the second best.", stages = Js.alit("vision"), weight = 0.25, flavour = false }, { "id", "label", "blurb", "stages", "weight", "flavour" }), Js.O({ id = "legend-watching", label = "Somebody's watching", blurb = "A face you have seen lift trophies is standing by the dugout with his arms folded. Nobody says why.", stages = TRIAL_STAGES, weight = 0, flavour = true }, { "id", "label", "blurb", "stages", "weight", "flavour" }), Js.O({ id = "packed-touchline", label = "Three deep on the touchline", blurb = "Word got round. There are more people watching a trial than watched your last four games put together.", stages = TRIAL_STAGES, weight = 0, flavour = true }, { "id", "label", "blurb", "stages", "weight", "flavour" }))
	exports.TRIAL_ADVERSITY = TRIAL_ADVERSITY
	ADVERSITY_CHANCE = 0.42
	exports.ADVERSITY_CHANCE = ADVERSITY_CHANCE
	LIVE_ADVERSITY = A.filter(TRIAL_ADVERSITY, function(e)
		return (Js.alen(liveStagesOf(e)) > 0)
	end)
	exports.LIVE_ADVERSITY = LIVE_ADVERSITY
	clamp01 = function(v)
		return (if Js.NumberNS.isFinite(v) then Math.max(0, Math.min(1, v)) else 0)
	end
	RELOAD_GRACE = 2
	exports.RELOAD_GRACE = RELOAD_GRACE
	RELOAD_DIFFICULTY_STEP = 0.18
	exports.RELOAD_DIFFICULTY_STEP = RELOAD_DIFFICULTY_STEP
	RELOAD_DIFFICULTY_CAP = 0.9
	exports.RELOAD_DIFFICULTY_CAP = RELOAD_DIFFICULTY_CAP
	SCORE_BASE = 0.95
	exports.SCORE_BASE = SCORE_BASE
	SCORE_DIFFICULTY_SPAN = 0.05
	exports.SCORE_DIFFICULTY_SPAN = SCORE_DIFFICULTY_SPAN
end
