--!nocheck
--!nolint
-- Generated from lib/star/trialStages.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_trial = import("lib/star/trial")
	local M_trainingDrills = import("lib/star/trainingDrills")
	local M_tuningStore = import("lib/star/tuningStore")
	local M_pitch = import("lib/star/pitch")
	local ladderLevel, attemptSeed, REPS, PENALTY_TELL_EASY, PENALTY_TELL_HARD, PENALTY_TELL_RAMP, penaltyTell, COLD_KEEPER_TELL, PENALTY_COMMIT_M, PENALTY_COMMIT_CHANCE_EASY, PENALTY_COMMIT_CHANCE_HARD, penaltyCommit, penaltyReadForTrial, PENALTY_RAMP_FIRST, PENALTY_RAMP_LAST, penaltyRampFor, techniqueSetup, COLD_KEEPER_READ_BONUS, shootoutOurKeeperFor, shootoutTheirRating, shootoutKeeperFor, shootoutQuality, trialInvisibleStats, penaltySetup, BIG_WALL_MEN, LONG_RANGE_M, freeKickSetup, QUICK_FEET_BONUS, EXTRA_MAN, dribbleSetup, dribbleQuality, SNAP_DECISION_WINDOW, SNAP_DECISION_FLOOR, CROWDED_PICTURE_MEN, CROWDED_PICTURE_MAX, TIGHT_MARGINS_SCALE, TIGHT_MARGINS_FLOOR, VISION_WINDOWS, visionWindowFor, visionSetup, VISION_REACTION_S, VISION_FREE_FRACTION, visionFreeSeconds, visionQuality, meanQuality, REP_WEIGHT_RAMP, weightedQuality, strikeQuality, TEACH_SEEN_KEY, TEACHABLE_DRILLS, teachKeyFor, teachSeen, markTeachSeen, clearTeachSeen
	ladderLevel = function(difficulty)
		do return Math.max(0, Math.min(100, ((if Js.NumberNS.isFinite(difficulty) then difficulty else 0) * 100))) end
	end
	exports.ladderLevel = ladderLevel
	attemptSeed = function(trial)
		local reloads = Math.max(0, math.floor((if Js.NumberNS.isFinite(trial.reloads) then trial.reloads else 0)))
		do return Js.ushr(Js.bxor(Js.ushr(trial.seed, 0), ((reloads + 1) * 2654435761)), 0) end
	end
	exports.attemptSeed = attemptSeed
	penaltyTell = function(trial, rep)
		local d = M_trial.difficultyFor(trial, "penalties")
		local i = Math.max(0, math.floor((if Js.NumberNS.isFinite(rep) then rep else 0)))
		local step = PENALTY_TELL_RAMP[Math.min(i, (Js.alen(PENALTY_TELL_RAMP) - 1)) + 1]
		local ceiling = (PENALTY_TELL_EASY + ((PENALTY_TELL_HARD - PENALTY_TELL_EASY) * d))
		local tell = (step * ceiling)
		do return (if ((function() local _v = M_trial.adversityOn(trial, "penalties"); if _v == nil then return nil end; _v = _v.id; return _v end)() == "cold-keeper") then (tell * COLD_KEEPER_TELL) else tell) end
	end
	exports.penaltyTell = penaltyTell
	penaltyCommit = function(trial, rep)
		local d = M_trial.difficultyFor(trial, "penalties")
		local chance = (PENALTY_COMMIT_CHANCE_EASY + ((PENALTY_COMMIT_CHANCE_HARD - PENALTY_COMMIT_CHANCE_EASY) * d))
		local wobble = (Math.sin(((math.fmod(attemptSeed(trial), 1013) * 3.77) + (rep * 57.31))) * 12911.7)
		do return (if ((wobble - math.floor(wobble)) < chance) then PENALTY_COMMIT_M else 0) end
	end
	exports.penaltyCommit = penaltyCommit
	penaltyReadForTrial = function(trial)
		local d = M_trial.difficultyFor(trial, "penalties")
		do return Js.O({ commitChance = (PENALTY_COMMIT_CHANCE_EASY + ((PENALTY_COMMIT_CHANCE_HARD - PENALTY_COMMIT_CHANCE_EASY) * d)), readChance = (0.55 + (0.17 * d)) }, { "commitChance", "readChance" }) end
	end
	exports.penaltyReadForTrial = penaltyReadForTrial
	penaltyRampFor = function(rep, reps)
		local i = Math.max(0, math.floor((if Js.NumberNS.isFinite(rep) then rep else 0)))
		local p = (if (reps > 1) then Math.min(1, (i / (reps - 1))) else 0)
		local lerp = function(a, b)
			return (a + ((b - a) * p))
		end
		local r2 = function(v)
			return (Math.round((v * 100)) / 100)
		end
		local F = PENALTY_RAMP_FIRST
		local L = PENALTY_RAMP_LAST
		do return Js.O({ keeperStrength = Math.round(lerp(F.keeperStrength, L.keeperStrength)), read = Js.O({ commitChance = r2(lerp(F.commitChance, L.commitChance)), readChance = r2(lerp(F.readChance, L.readChance)), metres = r2(lerp(F.metres, L.metres)) }, { "commitChance", "readChance", "metres" }) }, { "keeperStrength", "read" }) end
	end
	exports.penaltyRampFor = penaltyRampFor
	techniqueSetup = function(trial, rep)
		do return M_trainingDrills.techniqueDrill(ladderLevel(M_trial.difficultyFor(trial, "technique")), rep) end
	end
	exports.techniqueSetup = techniqueSetup
	shootoutOurKeeperFor = function(theirKick)
		do return penaltyRampFor(Math.min(theirKick, (REPS.shootout - 1)), REPS.shootout) end
	end
	exports.shootoutOurKeeperFor = shootoutOurKeeperFor
	shootoutTheirRating = function(trial)
		do return Math.round((52 + (M_trial.difficultyFor(trial, "shootout") * 36))) end
	end
	exports.shootoutTheirRating = shootoutTheirRating
	shootoutKeeperFor = function(trial, yourKick)
		local ramp = penaltyRampFor(Math.min(yourKick, (REPS.shootout - 1)), REPS.shootout)
		local cold = ((function() local _v = M_trial.adversityOn(trial, "shootout"); if _v == nil then return nil end; _v = _v.id; return _v end)() == "cold-keeper")
		do return Js.O({ keeperStrength = Math.min(99, (ramp.keeperStrength + M_trial.keeperBonusFor(trial, "shootout"))), read = (if cold then Js.ospread(ramp.read, Js.O({ readChance = Math.min(0.95, (ramp.read.readChance + COLD_KEEPER_READ_BONUS)) }, { "readChance" })) else ramp.read) }, { "keeperStrength", "read" }) end
	end
	exports.shootoutKeeperFor = shootoutKeeperFor
	shootoutQuality = function(yourKicks)
		if (Js.alen(yourKicks) == 0) then
			do return 0 end
		end
		do return (Js.alen(A.filter(yourKicks, Js.Boolean)) / Js.alen(yourKicks)) end
	end
	exports.shootoutQuality = shootoutQuality
	trialInvisibleStats = function()
		do return Js.O({ setPieceSkill = M_tuningStore.getTuning("startingSkills.freeKick"), canCurve = false }, { "setPieceSkill", "canCurve" }) end
	end
	exports.trialInvisibleStats = trialInvisibleStats
	penaltySetup = function(trial, rep)
		local d = M_trial.difficultyFor(trial, "penalties")
		local bonus = M_trial.keeperBonusFor(trial, "penalties")
		local wobble = (Math.sin((math.fmod(attemptSeed(trial), 1000) + (rep * 12.9898))) * 43758.5453)
		local side = (if ((wobble - math.floor(wobble)) < 0.5) then -1 else 1)
		do return Js.O({ ball = Js.O({ x = M_pitch.CX, y = M_pitch.PEN_SPOT_Y }, { "x", "y" }), keeperStrength = Math.min(99, ((45 + (d * 45)) + bonus)), keeperLean = (side * penaltyTell(trial, rep)), keeperCommit = penaltyCommit(trial, rep) }, { "ball", "keeperStrength", "keeperLean", "keeperCommit" }) end
	end
	exports.penaltySetup = penaltySetup
	freeKickSetup = function(trial, rep)
		local d = M_trial.difficultyFor(trial, "freeKicks")
		local cfg = M_trainingDrills.freeKickDrill(ladderLevel(d), rep)
		local ev = M_trial.adversityOn(trial, "freeKicks")
		local keeperStrength = Math.min(99, (cfg.keeperStrength + M_trial.keeperBonusFor(trial, "freeKicks")))
		local wall = (if ((function() local _v = ev; if _v == nil then return nil end; _v = _v.id; return _v end)() == "big-wall") then Math.min(6, (cfg.wall + BIG_WALL_MEN)) else cfg.wall)
		local distance = (if ((function() local _v = ev; if _v == nil then return nil end; _v = _v.id; return _v end)() == "long-range") then (cfg.distance + LONG_RANGE_M) else cfg.distance)
		local withAdversity = Js.ospread(cfg, Js.O({ keeperStrength = keeperStrength, wall = wall, distance = distance }, { "keeperStrength", "wall", "distance" }))
		do return Js.ospread(withAdversity, Js.O({ ball = M_trainingDrills.strikeSpot(distance, cfg.offset) }, { "ball" })) end
	end
	exports.freeKickSetup = freeKickSetup
	dribbleSetup = function(trial)
		local d = M_trial.difficultyFor(trial, "dribbling")
		local ev = M_trial.adversityOn(trial, "dribbling")
		local waves = (if (d >= 0.7) then 3 else 2)
		local sizes = Js.alit()
		local total = 0
		for i = 0, math.ceil(waves) - 1 do
			local want = Math.max(1, Math.round(((1 + (d * 1.2)) + (if (i == (waves - 1)) then 1 else 0))))
			local room = Math.max(0, (10 - total))
			local take = Math.min(want, room)
			if (take <= 0) then
				do break end
			end
			A.push(sizes, take)
			total += take
		end
		if ((((function() local _v = ev; if _v == nil then return nil end; _v = _v.id; return _v end)() == "extra-man") and (total < 10)) and (Js.alen(sizes) > 0)) then
			A.set(sizes, (Js.alen(sizes) - 1), sizes[Js.alen(sizes)] + EXTRA_MAN)
			total += EXTRA_MAN
		end
		do return Js.O({ oppStrength = Math.min(100, ((35 + (d * 60)) + (if ((function() local _v = ev; if _v == nil then return nil end; _v = _v.id; return _v end)() == "quick-feet") then QUICK_FEET_BONUS else 0))), waveSizes = sizes, defenders = total }, { "oppStrength", "waveSizes", "defenders" }) end
	end
	exports.dribbleSetup = dribbleSetup
	dribbleQuality = function(result, setup)
		local share = (if (setup.defenders > 0) then Math.min(1, (result.beaten / setup.defenders)) else 0)
		do return Math.max(0, Math.min(1, ((share * 0.75) + (if result.cleared then 0.25 else 0)))) end
	end
	exports.dribbleQuality = dribbleQuality
	visionWindowFor = function(rep)
		do return VISION_WINDOWS[Math.max(0, Math.min((Js.alen(VISION_WINDOWS) - 1), math.floor(rep))) + 1] end
	end
	exports.visionWindowFor = visionWindowFor
	visionSetup = function(trial, rep)
		local d = M_trial.difficultyFor(trial, "vision")
		local base = M_trainingDrills.visionDrill(ladderLevel(d), rep)
		local ev = M_trial.adversityOn(trial, "vision")
		local cfg = Js.O({ options = (if ((function() local _v = ev; if _v == nil then return nil end; _v = _v.id; return _v end)() == "crowded-picture") then Math.min(CROWDED_PICTURE_MAX, (base.options + CROWDED_PICTURE_MEN)) else base.options), window = (if ((function() local _v = ev; if _v == nil then return nil end; _v = _v.id; return _v end)() == "snap-decision") then Math.min(visionWindowFor(rep), Math.max(SNAP_DECISION_FLOOR, (visionWindowFor(rep) * SNAP_DECISION_WINDOW))) else visionWindowFor(rep)), margin = (if ((function() local _v = ev; if _v == nil then return nil end; _v = _v.id; return _v end)() == "tight-margins") then Math.max(TIGHT_MARGINS_FLOOR, (base.margin * TIGHT_MARGINS_SCALE)) else base.margin) }, { "options", "window", "margin" })
		local wobble = (Math.sin(((math.fmod(attemptSeed(trial), 997) * 7.13) + (rep * 91.7))) * 24634.6345)
		local pick = math.floor(((wobble - math.floor(wobble)) * cfg.options))
		do return Js.ospread(cfg, Js.O({ correct = Math.max(0, Math.min((cfg.options - 1), pick)) }, { "correct" })) end
	end
	exports.visionSetup = visionSetup
	visionFreeSeconds = function(window)
		local w = Math.max(0.2, (if Js.NumberNS.isFinite(window) then window else 0.2))
		do return Math.min((w * 0.6), Math.max(VISION_REACTION_S, (w * VISION_FREE_FRACTION))) end
	end
	exports.visionFreeSeconds = visionFreeSeconds
	visionQuality = function(picked, setup, tookSeconds)
		if (picked == nil) then
			do return 0 end
		end
		if (picked ~= setup.correct) then
			do return 0.08 end
		end
		local w = Math.max(0.2, setup.window)
		local free = visionFreeSeconds(w)
		local took = (if Js.NumberNS.isFinite(tookSeconds) then Math.max(0, tookSeconds) else w)
		local speed = Math.max(0, Math.min(1, (1 - (Math.max(0, (took - free)) / Math.max(0.1, (w - free))))))
		do return Math.max(0, Math.min(1, (0.65 + (speed * 0.35)))) end
	end
	exports.visionQuality = visionQuality
	meanQuality = function(reps)
		if (not Js.T(Js.alen(reps))) then
			do return 0 end
		end
		local clean = A.map(reps, function(q)
			return (if Js.NumberNS.isFinite(q) then Math.max(0, Math.min(1, q)) else 0)
		end)
		do return (A.reduce(clean, function(s, q)
			return (s + q)
		end, 0) / Js.alen(clean)) end
	end
	exports.meanQuality = meanQuality
	weightedQuality = function(reps)
		if (not Js.T(Js.alen(reps))) then
			do return 0 end
		end
		local top = 0
		local bottom = 0
		A.forEach(reps, function(raw, i)
			local q = (if Js.NumberNS.isFinite(raw) then Math.max(0, Math.min(1, raw)) else 0)
			local w = REP_WEIGHT_RAMP[Math.min(i, (Js.alen(REP_WEIGHT_RAMP) - 1)) + 1]
			top += (q * w)
			bottom += w
		end)
		do return (if (bottom > 0) then Math.max(0, Math.min(1, (top / bottom))) else 0) end
	end
	exports.weightedQuality = weightedQuality
	strikeQuality = function(outcome, crossX)
		do return M_trainingDrills.shotQuality(outcome, crossX) end
	end
	exports.strikeQuality = strikeQuality
	teachKeyFor = function(drill)
		do return (TEACH_SEEN_KEY .. "-" .. drill) end
	end
	teachSeen = function(drill)
		local _ok1, _err2, _rv3 = pcall(function()
			do return Js.RET, (Js.localStorage.getItem(teachKeyFor(drill)) == "1") end
		end)
		if not _ok1 then
			do return false end
		elseif _err2 == Js.RET then
			return _rv3
		end
	end
	exports.teachSeen = teachSeen
	markTeachSeen = function(drill)
		local _ok4, _err5, _rv6 = pcall(function()
			Js.localStorage.setItem(teachKeyFor(drill), "1")
		end)
		if not _ok4 then
		elseif _err5 == Js.RET then
			return _rv6
		end
	end
	exports.markTeachSeen = markTeachSeen
	clearTeachSeen = function()
		local _ok7, _err8, _rv9 = pcall(function()
			do
				local _arr10 = TEACHABLE_DRILLS
				local _i11 = 0
				while _i11 < Js.alen(_arr10) do
					_i11 += 1
					local d = _arr10[_i11]
					Js.localStorage.removeItem(teachKeyFor(d))
				end
			end
		end)
		if not _ok7 then
		elseif _err8 == Js.RET then
			return _rv9
		end
	end
	exports.clearTeachSeen = clearTeachSeen
	REPS = Js.O({ penalties = 3, freeKicks = 1, technique = 1, dribbling = 1, vision = 5, shootout = 3 }, { "penalties", "freeKicks", "technique", "dribbling", "vision", "shootout" })
	exports.REPS = REPS
	PENALTY_TELL_EASY = 1
	exports.PENALTY_TELL_EASY = PENALTY_TELL_EASY
	PENALTY_TELL_HARD = 0.6
	exports.PENALTY_TELL_HARD = PENALTY_TELL_HARD
	PENALTY_TELL_RAMP = Js.alit(1, 0.42, 0.12)
	exports.PENALTY_TELL_RAMP = PENALTY_TELL_RAMP
	COLD_KEEPER_TELL = 0.35
	exports.COLD_KEEPER_TELL = COLD_KEEPER_TELL
	PENALTY_COMMIT_M = 1.4
	exports.PENALTY_COMMIT_M = PENALTY_COMMIT_M
	PENALTY_COMMIT_CHANCE_EASY = 0.65
	exports.PENALTY_COMMIT_CHANCE_EASY = PENALTY_COMMIT_CHANCE_EASY
	PENALTY_COMMIT_CHANCE_HARD = 0.95
	exports.PENALTY_COMMIT_CHANCE_HARD = PENALTY_COMMIT_CHANCE_HARD
	PENALTY_RAMP_FIRST = Js.O({ keeperStrength = 45, commitChance = 0.6, readChance = 0.5, metres = 1.3 }, { "keeperStrength", "commitChance", "readChance", "metres" })
	exports.PENALTY_RAMP_FIRST = PENALTY_RAMP_FIRST
	PENALTY_RAMP_LAST = Js.O({ keeperStrength = 88, commitChance = 0.95, readChance = 0.75, metres = 1.65 }, { "keeperStrength", "commitChance", "readChance", "metres" })
	exports.PENALTY_RAMP_LAST = PENALTY_RAMP_LAST
	COLD_KEEPER_READ_BONUS = 0.12
	exports.COLD_KEEPER_READ_BONUS = COLD_KEEPER_READ_BONUS
	BIG_WALL_MEN = 1
	exports.BIG_WALL_MEN = BIG_WALL_MEN
	LONG_RANGE_M = 3.5
	exports.LONG_RANGE_M = LONG_RANGE_M
	QUICK_FEET_BONUS = 15
	exports.QUICK_FEET_BONUS = QUICK_FEET_BONUS
	EXTRA_MAN = 1
	exports.EXTRA_MAN = EXTRA_MAN
	SNAP_DECISION_WINDOW = 0.75
	exports.SNAP_DECISION_WINDOW = SNAP_DECISION_WINDOW
	SNAP_DECISION_FLOOR = 0.85
	exports.SNAP_DECISION_FLOOR = SNAP_DECISION_FLOOR
	CROWDED_PICTURE_MEN = 2
	exports.CROWDED_PICTURE_MEN = CROWDED_PICTURE_MEN
	CROWDED_PICTURE_MAX = 9
	exports.CROWDED_PICTURE_MAX = CROWDED_PICTURE_MAX
	TIGHT_MARGINS_SCALE = 0.65
	exports.TIGHT_MARGINS_SCALE = TIGHT_MARGINS_SCALE
	TIGHT_MARGINS_FLOOR = 0.6
	exports.TIGHT_MARGINS_FLOOR = TIGHT_MARGINS_FLOOR
	VISION_WINDOWS = Js.alit(2.5, 2, 1.5, 1, 0.5)
	exports.VISION_WINDOWS = VISION_WINDOWS
	VISION_REACTION_S = 0.45
	exports.VISION_REACTION_S = VISION_REACTION_S
	VISION_FREE_FRACTION = 0.35
	exports.VISION_FREE_FRACTION = VISION_FREE_FRACTION
	REP_WEIGHT_RAMP = Js.alit(1, 1.25, 1.5)
	exports.REP_WEIGHT_RAMP = REP_WEIGHT_RAMP
	TEACH_SEEN_KEY = "star-trial-taught"
	exports.TEACH_SEEN_KEY = TEACH_SEEN_KEY
	TEACHABLE_DRILLS = Js.alit("penalties", "freeKicks", "technique", "dribbling", "vision", "shootout", "freeKickRunup", "freeKickStrike")
	exports.TEACHABLE_DRILLS = TEACHABLE_DRILLS
end
