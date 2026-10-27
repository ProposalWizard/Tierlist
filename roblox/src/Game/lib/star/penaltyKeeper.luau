--!nocheck
--!nolint
-- Generated from lib/star/penaltyKeeper.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_gameplayVersion = import("lib/star/gameplayVersion")
	local M_tuningStore = import("lib/star/tuningStore")
	local KICK_HABITS, pastKickFrom, SIDE_DIR, SIDE_WORD, readKickHabits, sideWithHabit, PENALTY_READ_DEFAULT, PENALTY_READ_TRIAL, PENALTY_TRIAL_REACH, PENALTY_TRIAL_REACH_TOP, penaltyTrialReach, penaltyReadFor, aimedCrossX, decidePenaltyRead, applyPenaltyRead, clamp01
	pastKickFrom = function(crossX, goalMiddleX, heightM)
		local off = (crossX - goalMiddleX)
		local side = (if (math.abs(off) < KICK_HABITS.centreWithin) then "centre" else (if (off < 0) then "left" else "right"))
		do return Js.O({ side = side, height = (if (heightM >= KICK_HABITS.highFrom) then "high" else "low") }, { "side", "height" }) end
	end
	exports.pastKickFrom = pastKickFrom
	readKickHabits = function(kicks)
		local H = KICK_HABITS
		local list = (if kicks ~= nil then kicks else Js.alit())
		local counts = Js.O({ left = 0, centre = 0, right = 0 }, { "left", "centre", "right" })
		do
			local _arr1 = list
			local _i2 = 0
			while _i2 < Js.alen(_arr1) do
				_i2 += 1
				local k = _arr1[_i2]
				counts[k.side] += 1
			end
		end
		local total = Js.alen(list)
		local none = function(words)
			return Js.O({ side = nil, dir = 0, strength = 0, share = 0, counts = counts, total = total, height = nil, words = words }, { "side", "dir", "strength", "share", "counts", "total", "height", "words" })
		end
		if (total < H.minKicks) then
			do return none((if (total == 0) then "No kicks yet → he has nothing to read" else "1 kick → he needs 2 before he leans")) end
		end
		local w = Js.O({ left = 0, centre = 0, right = 0 }, { "left", "centre", "right" })
		local wSum = 0
		local wHigh = 0
		A.forEach(list, function(k, i)
			local wt = Math.pow(H.fade, ((total - 1) - i))
			w[k.side] += wt
			wSum += wt
			if (k.height == "high") then
				wHigh += wt
			end
		end)
		local top = A.reduce(Js.Object.keys(w), function(a, b)
			return (if (w[b] > w[a]) then b else a)
		end)
		local p = (w[top] / wSum)
		local hp = (wHigh / wSum)
		local height = (if (hp >= 0.7) then "high" else (if (hp <= 0.3) then "low" else nil))
		local conf = Math.min(1, ((total - 1) / (H.fullAfter - 1)))
		local lean = (if (p >= H.leanFrom) then Math.min(1, ((p - 0.5) / 0.5)) else 0)
		local strength = (Math.round((((H.cap * lean) * conf) * 1000)) / 1000)
		if (strength <= 0) then
			do return Js.ospread(none(("Your " .. Js.numstr(total) .. " kicks are mixed → he can't read you")), Js.O({ height = height }, { "height" })) end
		end
		local n = counts[top]
		local lead = (Js.numstr(n) .. " of your " .. Js.numstr(total) .. " kicks went " .. SIDE_WORD[top])
		local verb = (if (top == "centre") then "stays in the middle more" else ("leans " .. top))
		local words = (if (strength >= (H.cap * 0.4)) then (lead .. " → he now " .. verb) else (lead .. " → he starts to " .. (if (top == "centre") then "stay in the middle" else ("lean " .. top))))
		do return Js.O({ side = top, dir = SIDE_DIR[top], strength = strength, share = (strength / H.cap), counts = counts, total = total, height = height, words = words }, { "side", "dir", "strength", "share", "counts", "total", "height", "words" }) end
	end
	exports.readKickHabits = readKickHabits
	sideWithHabit = function(aimedSide, readChance, u, habit)
		local hs = (if (habit and (habit.dir ~= 0)) then Math.max(0, Math.min(KICK_HABITS.cap, habit.strength)) else 0)
		if (hs > 0) then
			if (u < hs) then
				do return habit.dir end
			end
			u = ((u - hs) / (1 - hs))
		end
		do return (if (u < readChance) then aimedSide else (-aimedSide)) end
	end
	exports.sideWithHabit = sideWithHabit
	penaltyTrialReach = function(keeperStrength)
		if M_gameplayVersion.oldKeepers() then
			do return 1 end
		end
		local p = Math.max(0, Math.min(1, (((if Js.NumberNS.isFinite(keeperStrength) then keeperStrength else 62) - 45) / (88 - 45))))
		do return (PENALTY_TRIAL_REACH + ((PENALTY_TRIAL_REACH_TOP - PENALTY_TRIAL_REACH) * p)) end
	end
	exports.penaltyTrialReach = penaltyTrialReach
	penaltyReadFor = function(keeperStrength, override)
		local k = Math.max(20, Math.min(99, (if Js.NumberNS.isFinite(keeperStrength) then keeperStrength else 62)))
		local habit = (function() local _v = override; if _v == nil then return nil end; _v = _v.habit; return _v end)()
		if (override and Js.has(override, "habit")) then
			local _d3 = override
			local _h = _d3.habit
			local rest = Js.ospread(_d3)
			Js.del(rest, "habit")
			local _ = _h
			override = (if (Js.alen(Js.Object.keys(rest)) > 0) then rest else nil)
		end
		local withHabit = function(r)
			return (if (habit and (habit.strength > 0)) then Js.ospread(r, Js.O({ habit = habit }, { "habit" })) else r)
		end
		if (not override) then
			local d = PENALTY_READ_DEFAULT
			do return withHabit(Js.O({ commitChance = d.commitChance, readChance = Math.max(0.5, Math.min(0.65, (d.readChance + ((k - 62) / 250)))), shortest = d.shortest, metres = Math.max(3, Math.min(3.7, (d.metres + ((k - 62) * 0.015)))), reach = d.reach, middleRead = Math.max(0.03, Math.min(0.15, (d.middleRead + ((k - 62) * 0.003)))) }, { "commitChance", "readChance", "shortest", "metres", "reach", "middleRead" })) end
		end
		local base = Js.ospread(PENALTY_READ_TRIAL, Js.O({ readChance = Math.max(0.5, Math.min(0.85, (PENALTY_READ_TRIAL.readChance + ((k - 62) / 370)))) }, { "readChance" }))
		local s = Js.O({ commitChance = clamp01((if override.commitChance ~= nil then override.commitChance else base.commitChance)), readChance = clamp01((if override.readChance ~= nil then override.readChance else base.readChance)), metres = Math.max(0, Math.min(3.2, (if override.metres ~= nil then override.metres else base.metres))) }, { "commitChance", "readChance", "metres" })
		if (override.shortest ~= nil) then
			s.shortest = Math.max(0, Math.min(s.metres, override.shortest))
		end
		s.reach = Math.max(0.1, Math.min(1, (if override.reach ~= nil then override.reach else penaltyTrialReach(k))))
		s.middleRead = clamp01((if override.middleRead ~= nil then override.middleRead else s.readChance))
		do return withHabit(s) end
	end
	exports.penaltyReadFor = penaltyReadFor
	aimedCrossX = function(ball)
		if (not (ball.vel.y < -0.01)) then
			do return ball.pos.x end
		end
		do return (ball.pos.x + ((ball.vel.x / ball.vel.y) * (0 - ball.pos.y))) end
	end
	exports.aimedCrossX = aimedCrossX
	decidePenaltyRead = function(sc, ball, s, roll)
		local k = sc.keeper
		if ((k.done or (not (s.metres > 0))) or (roll[1] >= s.commitChance)) then
			do return Js.O({ went = false, side = 0, correct = false, metres = 0 }, { "went", "side", "correct", "metres" }) end
		end
		local off = (aimedCrossX(ball) - k.startX)
		local aimedSide = (if (math.abs(off) < 0.5) then 0 else Math.sign(off))
		local side = nil
		local correct = nil
		local h = s.habit
		local hs = (if h then Math.max(0, Math.min(KICK_HABITS.cap, h.strength)) else 0)
		local u = roll[2]
		if (hs > 0) then
			if (u < hs) then
				if (h.dir == 0) then
					do return Js.O({ went = false, side = 0, correct = (aimedSide == 0), metres = 0 }, { "went", "side", "correct", "metres" }) end
				end
				side = h.dir
				correct = (side == aimedSide)
				local lo0 = (if s.shortest ~= nil then s.shortest else s.metres)
				local d0 = Js.O({ went = true, side = side, correct = correct, metres = (lo0 + ((roll[1] / s.commitChance) * (s.metres - lo0))) }, { "went", "side", "correct", "metres" })
				if ((s.reach ~= nil) and (s.reach ~= 1)) then
					d0.reach = s.reach
				end
				do return d0 end
			end
			u = ((u - hs) / (1 - hs))
		end
		if (aimedSide == 0) then
			local mr = clamp01((if s.middleRead ~= nil then s.middleRead else 0))
			if (u < mr) then
				do return Js.O({ went = false, side = 0, correct = true, metres = 0 }, { "went", "side", "correct", "metres" }) end
			end
			side = (if (((u - mr) / Math.max(1e-9, (1 - mr))) < 0.5) then -1 else 1)
			correct = false
		else
			correct = (u < s.readChance)
			side = (if correct then aimedSide else (-aimedSide))
		end
		local lo = (if s.shortest ~= nil then s.shortest else s.metres)
		local metres = (lo + ((roll[1] / s.commitChance) * (s.metres - lo)))
		local d = Js.O({ went = true, side = side, correct = correct, metres = metres }, { "went", "side", "correct", "metres" })
		if ((s.reach ~= nil) and (s.reach ~= 1)) then
			d.reach = s.reach
		end
		do return d end
	end
	exports.decidePenaltyRead = decidePenaltyRead
	applyPenaltyRead = function(sc, d)
		local k = sc.keeper
		if ((not d.went) or k.done) then
			do return end
		end
		k.targetX = (k.startX + (d.side * d.metres))
		k.scrambling = true
		k.saveDir = d.side
		if (k.saveLunge <= 0) then
			k.saveLunge = 0.001
		end
		k.committedDir = d.side
		if (((d.reach ~= nil) and Js.NumberNS.isFinite(d.reach)) and (d.reach > 0)) then
			sc.keeperReach = d.reach
		end
	end
	exports.applyPenaltyRead = applyPenaltyRead
	clamp01 = function(v)
		do return Math.max(0, Math.min(1, (if Js.NumberNS.isFinite(v) then v else 0))) end
	end
	KICK_HABITS = Js.O({ minKicks = 2, fade = 0.7, leanFrom = 0.6, cap = 0.6, fullAfter = 4, highFrom = 1.2, centreWithin = 0.6 }, { "minKicks", "fade", "leanFrom", "cap", "fullAfter", "highFrom", "centreWithin" })
	exports.KICK_HABITS = KICK_HABITS
	SIDE_DIR = Js.O({ left = -1, centre = 0, right = 1 }, { "left", "centre", "right" })
	SIDE_WORD = Js.O({ left = "left", centre = "down the middle", right = "right" }, { "left", "centre", "right" })
	PENALTY_READ_DEFAULT = Js.O({ commitChance = 0.96, readChance = 0.5, shortest = 1, metres = 3.4, reach = 0.3, middleRead = 0.06 }, { "commitChance", "readChance", "shortest", "metres", "reach", "middleRead" })
	exports.PENALTY_READ_DEFAULT = PENALTY_READ_DEFAULT
	PENALTY_READ_TRIAL = Js.O({ commitChance = 0.8, readChance = 0.6, metres = 1.4 }, { "commitChance", "readChance", "metres" })
	exports.PENALTY_READ_TRIAL = PENALTY_READ_TRIAL
	PENALTY_TRIAL_REACH = M_tuningStore.getTuning("keepers.trialPenReachLow")
	exports.PENALTY_TRIAL_REACH = PENALTY_TRIAL_REACH
	PENALTY_TRIAL_REACH_TOP = M_tuningStore.getTuning("keepers.trialPenReachHigh")
	exports.PENALTY_TRIAL_REACH_TOP = PENALTY_TRIAL_REACH_TOP
end
