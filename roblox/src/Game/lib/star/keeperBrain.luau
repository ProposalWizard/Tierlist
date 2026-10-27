--!nocheck
--!nolint
-- Generated from lib/star/keeperBrain.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_compareSwitches = import("lib/star/compareSwitches")
	local M_gameplayVersion = import("lib/star/gameplayVersion")
	local M_pitch = import("lib/star/pitch")
	local M_penaltyKeeper = import("lib/star/penaltyKeeper")
	local M_canvasEngine = import("lib/star/canvasEngine")
	local M_tuningStore = import("lib/star/tuningStore")
	local clamp, brainRng, gauss, grow, KEEPER_BRAIN, KEEPER_HUMAN, OPEN_PLAY_DIAL, BRAIN_DIAL_FLAG, openPlayDialHere, brainOptionsHere, abilities, abilitiesBefore, unit, bisectorX, idealDepth, walkCapFor, states, brainStateOf, keeperSaltFor, hasBrain, brainSetup, planSet, stepToward, moveToward, brainAim, hopChance, brainRunUp, crossXAt, timeToLine, farness, sightlineBlockage, topCornerReach, onShot, brainStrike, read, leaveFeet, windowReach, brainStep, applyTopCorner, brainStepInner, KEEPER_FEEL_BRAIN, KEEPER_FINISH, finishParts, finishReach, finishDiveSpeed, applyFinish, brainSnapshot, brainRestore, KEEPER_PRO_BRAIN, proG, lerp2, clearThrough, smooth01, proDepth, readDelivery, proOffBall, applyProReach
	brainRng = function(seed)
		local a = Js.ushr(seed, 0)
		do return function()
			a = Js.bor((a + 1831565813), 0)
			local t = Math.imul(Js.bxor(a, Js.ushr(a, 15)), Js.bor(1, a))
			t = Js.bxor((t + Math.imul(Js.bxor(t, Js.ushr(t, 7)), Js.bor(61, t))), t)
			do return (Js.ushr(Js.bxor(t, Js.ushr(t, 14)), 0) / 4294967296) end
		end end
	end
	exports.brainRng = brainRng
	gauss = function(r)
		local s = 0
		for i = 0, 5 do
			s += r()
		end
		do return ((s - 3) / Math.sqrt(0.5)) end
	end
	grow = function(r, T, E, p)
		if p == nil then p = 1.6 end
		do return Math.pow(clamp(((r - T) / (E - T)), 0, 1), p) end
	end
	exports.grow = grow
	openPlayDialHere = function()
		local d = M_compareSwitches.testAreaSetting(BRAIN_DIAL_FLAG)
		do return (if ((d == "hard") or (d == "easier")) then d else "middle") end
	end
	exports.openPlayDialHere = openPlayDialHere
	brainOptionsHere = function()
		do return Js.O({ openPlay = OPEN_PLAY_DIAL[openPlayDialHere()] }, { "openPlay" }) end
	end
	exports.brainOptionsHere = brainOptionsHere
	abilities = function(rating)
		local r = clamp((if Js.NumberNS.isFinite(rating) then rating else 62), 20, 99)
		if M_gameplayVersion.oldKeepers() then
			do return abilitiesBefore(r) end
		end
		do return Js.O({ rating = r, correction = (0.27 + (0.68 * grow(r, 40, 95, 1.2))), posErr = (1.3 - (1.1 * grow(r, 40, 95, 1.3))), badSet = (0.32 - (0.28 * grow(r, 40, 95, 1))), setSpeed = (1.3 + (1.3 * grow(r, 40, 95, 1))), rt = (0.33 - (0.13 * grow(r, 40, 95, 1.2))), rtSd = 0.035, lateChance = (0.25 - (0.22 * grow(r, 40, 95, 1))), lateExtra = 0.15, readErr = (1.65 - (1.25 * grow(r, 40, 95, 1.4))), timingErr = (0.14 - (0.09 * grow(r, 40, 95, 1.2))), stepSpeed = (1.65 + (0.95 * grow(r, 40, 95, 1))), diveSpeed = (4.5 + (1.7 * grow(r, 40, 95, 1.2))), maxTravel = (2.2 + (1 * grow(r, 40, 95, 1.5))), diveWindow = (0.33 + (0.1 * grow(r, 40, 95, 1))), anticipStep = (0.9 * grow(r, 65, 95, 1.6)) }, { "rating", "correction", "posErr", "badSet", "setSpeed", "rt", "rtSd", "lateChance", "lateExtra", "readErr", "timingErr", "stepSpeed", "diveSpeed", "maxTravel", "diveWindow", "anticipStep" }) end
	end
	exports.abilities = abilities
	abilitiesBefore = function(r)
		do return Js.O({ rating = r, correction = (0.35 + (0.6 * grow(r, 40, 95, 1.2))), posErr = (1 - (0.8 * grow(r, 40, 95, 1.3))), badSet = (0.25 - (0.21 * grow(r, 40, 95, 1))), setSpeed = (1.6 + (1 * grow(r, 40, 95, 1))), rt = (0.3 - (0.1 * grow(r, 40, 95, 1.2))), rtSd = 0.035, lateChance = (0.18 - (0.15 * grow(r, 40, 95, 1))), lateExtra = 0.15, readErr = (1.3 - (0.9 * grow(r, 40, 95, 1.4))), timingErr = (0.12 - (0.07 * grow(r, 40, 95, 1.2))), stepSpeed = (1.9 + (0.7 * grow(r, 40, 95, 1))), diveSpeed = (4.8 + (1.4 * grow(r, 40, 95, 1.2))), maxTravel = (2.4 + (0.8 * grow(r, 40, 95, 1.5))), diveWindow = (0.33 + (0.1 * grow(r, 40, 95, 1))), anticipStep = (0.9 * grow(r, 65, 95, 1.6)) }, { "rating", "correction", "posErr", "badSet", "setSpeed", "rt", "rtSd", "lateChance", "lateExtra", "readErr", "timingErr", "stepSpeed", "diveSpeed", "maxTravel", "diveWindow", "anticipStep" }) end
	end
	unit = function(x, y)
		local l = (function() local _l = Math.hypot(x, y); if Js.T(_l) then return _l end; return 1 end)()
		do return Js.O({ x = (x / l), y = (y / l) }, { "x", "y" }) end
	end
	bisectorX = function(ball, d, l, r)
		if l == nil then l = M_pitch.POST_L end
		if r == nil then r = M_pitch.POST_R end
		local a = unit((l - ball.x), (0 - ball.y))
		local b = unit((r - ball.x), (0 - ball.y))
		local bis = unit((a.x + b.x), (a.y + b.y))
		if (bis.y >= -0.000001) then
			do return ((l + r) / 2) end
		end
		local t = ((d - ball.y) / bis.y)
		do return (ball.x + (bis.x * t)) end
	end
	exports.bisectorX = bisectorX
	idealDepth = function(ball)
		local D = Math.hypot((ball.x - M_pitch.CX), ball.y)
		local ang = Math.atan2(math.abs((ball.x - M_pitch.CX)), Math.max(0.5, ball.y))
		local central = clamp((3.6 - (0.1 * D)), 0.9, 3)
		local wideCut = (1 - (0.5 * Math.sin(ang)))
		do return clamp((central * wideCut), 0.8, Math.max(0.8, (ball.y - 4))) end
	end
	exports.idealDepth = idealDepth
	walkCapFor = function(kind)
		do return (if (kind == "tight_angle") then KEEPER_BRAIN.walkCapTight else KEEPER_BRAIN.walkCap) end
	end
	exports.walkCapFor = walkCapFor
	brainStateOf = function(sc)
		local st = (if sc then states:get(sc) else nil)
		if (not st) then
			do return nil end
		end
		do return Js.O({ phase = st.phase, t = st.t, rt = st.rt, dir = st.dir, target = st.target, reads = st.reads, locked = st.locked, moving = st.moving, reason = st.reason, setTarget = Js.ospread(st.setTarget), start = Js.ospread(st.start), moveAtT = st.moveAtT, stepAtT = st.stepAtT, diveAtT = st.diveAtT, wrongFooted = st.wrongFooted, diveFloor = st.diveFloor, rating = st.ab.rating, stepTravelled = st.stepTravelled, diveTravelled = st.diveTravelled, hopSide = st.hopSide, leanSide = (if st.leaned then st.leanSide else 0) }, { "phase", "t", "rt", "dir", "target", "reads", "locked", "moving", "reason", "setTarget", "start", "moveAtT", "stepAtT", "diveAtT", "wrongFooted", "diveFloor", "rating", "stepTravelled", "diveTravelled", "hopSide", "leanSide" }) end
	end
	exports.brainStateOf = brainStateOf
	keeperSaltFor = function(feature, random)
		if random == nil then random = Math.random end
		do return (if feature then Js.ushr((random() * 4294967296), 0) else 0) end
	end
	exports.keeperSaltFor = keeperSaltFor
	hasBrain = function(sc)
		do return states:has(sc) end
	end
	exports.hasBrain = hasBrain
	brainSetup = function(sc, seed, rating, opts)
		if opts == nil then opts = Js.O({}, nil) end
		local k = sc.keeper
		if (k.done or (sc.kind == "free_kick")) then
			states:delete(sc)
			do return end
		end
		local ab = abilities(rating)
		k.startX = k.x
		k.targetX = k.x
		k.adjusting = false
		k.scrambling = false
		k.committedDir = nil
		local rng = brainRng(Js.ushr(Js.bxor(Js.ushr(seed, 0), 47009), 0))
		local st = Js.O({ ab = ab, opts = opts, kind = sc.kind, start = Js.O({ x = k.x, y = k.y }, { "x", "y" }), setTarget = Js.O({ x = k.x, y = k.y }, { "x", "y" }), moving = false, baseReach = sc.keeperReach, rng = rng, strikeSeed = 0, phase = "set", t = 0, rt = 0, dir = 0, target = k.x, stepTravelled = 0, diveTravelled = 0, nextReadT = 0, reads = 0, timingErr = 0, locked = false, diveFloor = ab.diveWindow, penFloor = 1, hopSide = 0, hopAt = nil, hopFromX = nil, leanAt = nil, leanSide = 0, leaned = false, farRead = 0, blocked = 0, wrongRead = false, cutOn = false, shotX = k.x, lastShot = false, ownShot = false, lastRecv = nil, planted = false, reason = "", moveAtT = nil, stepAtT = nil, diveAtT = nil, wrongFooted = false, pro = ((sc.kind ~= "penalty") and (if opts.pro ~= nil then opts.pro else ((not M_gameplayVersion.oldKeeperPro()) or (not M_gameplayVersion.oldKeeperFeel())))), claimRead = false, claimGo = nil, fullR = 2.4, feel = false, finish = false, shotFrom = Js.O({ x = k.x, y = k.y }, { "x", "y" }), shotPace = 0, finishPre = nil, finishSet = nil }, { "ab", "opts", "kind", "start", "setTarget", "moving", "baseReach", "rng", "strikeSeed", "phase", "t", "rt", "dir", "target", "stepTravelled", "diveTravelled", "nextReadT", "reads", "timingErr", "locked", "diveFloor", "penFloor", "hopSide", "hopAt", "hopFromX", "leanAt", "leanSide", "leaned", "farRead", "blocked", "wrongRead", "cutOn", "shotX", "lastShot", "ownShot", "lastRecv", "planted", "reason", "moveAtT", "stepAtT", "diveAtT", "wrongFooted", "pro", "claimRead", "claimGo", "fullR", "feel", "finish", "shotFrom", "shotPace", "finishPre", "finishSet" })
		st.finish = ((sc.kind ~= "penalty") and (if opts.finish ~= nil then opts.finish else (not M_gameplayVersion.oldKeeperFinish())))
		st.feel = (st.pro and (if opts.feel ~= nil then opts.feel else (not M_gameplayVersion.oldKeeperFeel())))
		if st.feel then
			sc.keeperFeel = true
		else
			Js.del(sc, "keeperFeel")
		end
		if st.pro then
			sc.keeperPro = true
		else
			Js.del(sc, "keeperPro")
		end
		k.claim = nil
		st.setTarget = (if sc.keeperHoldsStart then Js.O({ x = k.x, y = k.y }, { "x", "y" }) else planSet(sc, st, sc.ball))
		states:set(sc, st)
	end
	exports.brainSetup = brainSetup
	planSet = function(sc, st, ball)
		local _d1 = st
		local ab = _d1.ab
		local rng = _d1.rng
		local k = sc.keeper
		if (sc.kind == "penalty") then
			do return Js.O({ x = k.x, y = k.y }, { "x", "y" }) end
		end
		local ideal = nil
		if ((math.abs((ball.x - M_pitch.CX)) > 16) and (ball.y < 8)) then
			ideal = Js.O({ x = (M_pitch.CX + (Math.sign((ball.x - M_pitch.CX)) * 1)), y = 1.5 }, { "x", "y" })
		else
			local d = (if st.pro then proDepth(sc, ball) else idealDepth(ball))
			ideal = Js.O({ x = bisectorX(ball, d), y = d }, { "x", "y" })
		end
		local D = Math.hypot((ball.x - M_pitch.CX), ball.y)
		local cap = walkCapFor(sc.kind)
		local tx = (k.x + ((ideal.x - k.x) * ab.correction))
		local ty = (k.y + ((ideal.y - k.y) * ab.correction))
		local bad = (if (rng() < ab.badSet) then 2.5 else 1)
		tx += ((gauss(rng) * ab.posErr) * bad)
		ty += (((gauss(rng) * ab.posErr) * 0.5) * bad)
		tx = clamp(tx, (M_pitch.POST_L - 1.2), (M_pitch.POST_R + 1.2))
		ty = clamp(ty, 0.4, Math.max(0.4, (D - 3)))
		local wx = (tx - k.x)
		local wy = (ty - k.y)
		local walk = Math.hypot(wx, wy)
		if (walk > cap) then
			tx = (k.x + ((wx / walk) * cap))
			ty = (k.y + ((wy / walk) * cap))
		end
		do return Js.O({ x = tx, y = ty }, { "x", "y" }) end
	end
	stepToward = function(from, to, max)
		local dx = (to.x - from.x)
		local dy = (to.y - from.y)
		local d = Math.hypot(dx, dy)
		if (d <= max) then
			do return Js.O({ x = to.x, y = to.y }, { "x", "y" }) end
		end
		do return Js.O({ x = (from.x + ((dx / d) * max)), y = (from.y + ((dy / d) * max)) }, { "x", "y" }) end
	end
	moveToward = function(sc, st, target, speed, dt)
		local k = sc.keeper
		local dx = (target.x - k.x)
		local dy = (target.y - k.y)
		local d = Math.hypot(dx, dy)
		if (d < 0.03) then
			st.moving = false
			do return true end
		end
		local step = Math.min(d, (speed * dt))
		k.x += ((dx / d) * step)
		k.y += ((dy / d) * step)
		st.moving = true
		if (math.abs(dx) > 0.0001) then
			k.dive = (Math.sign(dx) * 0.35)
		end
		do return false end
	end
	brainAim = function(sc, dt)
		local st = states:get(sc)
		local k = sc.keeper
		if ((not st) or k.done) then
			do return end
		end
		local fwd = (st.pro and ((st.setTarget.y - k.y) > 0.5))
		moveToward(sc, st, st.setTarget, (if fwd then (st.ab.setSpeed * KEEPER_PRO_BRAIN.rushSpeed) else st.ab.setSpeed), dt)
		k.startX = k.x
		k.targetX = k.x
		k.adjusting = false
	end
	exports.brainAim = brainAim
	hopChance = function(rating)
		local _d2 = KEEPER_BRAIN.hopShare
		local lo = _d2[1]
		local hi = _d2[2]
		do return (lo + ((hi - lo) * grow(clamp((if Js.NumberNS.isFinite(rating) then rating else 62), 20, 99), 40, 95, 1))) end
	end
	exports.hopChance = hopChance
	brainRunUp = function(sc, dt, runT, aimX)
		local st = states:get(sc)
		if (((not st) or (sc.kind ~= "penalty")) or sc.keeper.done) then
			do return end
		end
		local k = sc.keeper
		if (st.hopAt == nil) then
			local _d3 = KEEPER_BRAIN.hopAt
			local a = _d3[1]
			local b = _d3[2]
			local go = (st.rng() < hopChance(st.ab.rating))
			local at = (a + (st.rng() * (b - a)))
			st.hopAt = (if go then at else -1)
		end
		if (((st.hopSide == 0) and (st.hopAt >= 0)) and (runT >= st.hopAt)) then
			local pen = (if st.opts.penalty ~= nil then st.opts.penalty else M_penaltyKeeper.penaltyReadFor(st.ab.rating))
			local aimedSide = (if (math.abs((aimX - k.x)) < 0.5) then (if (st.rng() < 0.5) then -1 else 1) else Math.sign((aimX - k.x)))
			st.hopSide = M_penaltyKeeper.sideWithHabit(aimedSide, pen.readChance, st.rng(), pen.habit)
			st.hopFromX = k.x
			st.setTarget = Js.O({ x = (k.x + (st.hopSide * KEEPER_BRAIN.hopM)), y = k.y }, { "x", "y" })
			st.reason = "hopped"
		end
		if (st.leanAt == nil) then
			local go = (st.rng() < KEEPER_BRAIN.leanChance)
			st.leanSide = (if (st.rng() < 0.5) then -1 else 1)
			local _d4 = KEEPER_BRAIN.leanAt
			local a = _d4[1]
			local b = _d4[2]
			local at = (a + (st.rng() * (b - a)))
			st.leanAt = (if go then at else -1)
		end
		if (((not st.leaned) and (st.leanAt >= 0)) and (runT >= st.leanAt)) then
			st.leaned = true
			st.setTarget = Js.O({ x = (st.setTarget.x + (st.leanSide * KEEPER_BRAIN.leanDistM)), y = st.setTarget.y }, { "x", "y" })
		end
		moveToward(sc, st, st.setTarget, st.ab.setSpeed, dt)
		k.startX = k.x
		k.targetX = k.x
	end
	exports.brainRunUp = brainRunUp
	crossXAt = function(ball, y)
		if (not (ball.vel.y < -0.5)) then
			do return nil end
		end
		do return (ball.pos.x + (ball.vel.x * ((ball.pos.y - y) / (-ball.vel.y)))) end
	end
	timeToLine = function(ball, y)
		if (not (ball.vel.y < -0.5)) then
			do return 99 end
		end
		do return Math.max(0, ((ball.pos.y - y) / (-ball.vel.y))) end
	end
	farness = function(ball)
		do return clamp(((Math.hypot((ball.pos.x - M_pitch.CX), ball.pos.y) - 16) / 10), 0, 1) end
	end
	sightlineBlockage = function(sc, from)
		local H = KEEPER_HUMAN
		local k = sc.keeper
		local bodies = Js.alit()
		do
			local _arr5 = sc.defenders
			local _i6 = 0
			while _i6 < Js.alen(_arr5) do
				_i6 += 1
				local d = _arr5[_i6]
				A.push(bodies, d)
			end
		end
		do
			local _arr7 = (if sc.teammates ~= nil then sc.teammates else Js.alit())
			local _i8 = 0
			while _i8 < Js.alen(_arr7) do
				_i8 += 1
				local t = _arr7[_i8]
				A.push(bodies, t)
			end
		end
		if sc.runner then
			A.push(bodies, sc.runner.pos)
		end
		do
			local _arr9 = (if sc.secondaryRunners ~= nil then sc.secondaryRunners else Js.alit())
			local _i10 = 0
			while _i10 < Js.alen(_arr9) do
				_i10 += 1
				local r = _arr9[_i10]
				A.push(bodies, r.pos)
			end
		end
		local f = sc.follower
		if ((f and (f.x > -100)) and (f.y < 200)) then
			A.push(bodies, f)
		end
		local vx = (k.x - from.x)
		local vy = (k.y - from.y)
		local L2 = ((vx * vx) + (vy * vy))
		if (L2 < 1) then
			do return 0 end
		end
		local L = Math.sqrt(L2)
		local sum = 0
		do
			local _arr11 = bodies
			local _i12 = 0
			while _i12 < Js.alen(_arr11) do
				_i12 += 1
				local p = _arr11[_i12]
				if ((not Js.NumberNS.isFinite(p.x)) or (not Js.NumberNS.isFinite(p.y))) then
					do continue end
				end
				local t = ((((p.x - from.x) * vx) + ((p.y - from.y) * vy)) / L2)
				if ((t < 0.08) or (t > 0.95)) then
					do continue end
				end
				local lat = (math.abs((((p.x - from.x) * vy) - ((p.y - from.y) * vx))) / L)
				if (lat >= H.bodyR) then
					do continue end
				end
				sum += ((1 - (lat / H.bodyR)) * (0.6 + (0.4 * t)))
			end
		end
		do return clamp((sum / H.fullAt), 0, 1) end
	end
	exports.sightlineBlockage = sightlineBlockage
	topCornerReach = function(sc, ball, fromX)
		if fromX == nil then fromX = sc.keeper.x end
		local H = KEEPER_HUMAN
		local k = sc.keeper
		if ((not (ball.vel.y < -0.5)) or (ball.pos.y <= k.y)) then
			do return 1 end
		end
		local t = ((ball.pos.y - k.y) / (-ball.vel.y))
		local x = (ball.pos.x + (ball.vel.x * t))
		local z = ((ball.z + (ball.vz * t)) - ((4.9 * t) * t))
		local high = clamp(((z - H.topZ[1]) / (H.topZ[2] - H.topZ[1])), 0, 1)
		if (high <= 0) then
			do return 1 end
		end
		local wide = clamp(((math.abs((x - fromX)) - H.topWide[1]) / (H.topWide[2] - H.topWide[1])), 0, 1)
		if (wide <= 0) then
			do return 1 end
		end
		local g = grow(clamp((if Js.NumberNS.isFinite(sc.keeperStrength) then sc.keeperStrength else 62), 20, 99), 40, 95, 1)
		local cut = (H.topCut[1] + ((H.topCut[2] - H.topCut[1]) * g))
		do return (1 - ((cut * high) * wide)) end
	end
	exports.topCornerReach = topCornerReach
	onShot = function(sc, st, ball)
		local _d13 = st
		local ab = _d13.ab
		local rng = _d13.rng
		local k = sc.keeper
		st.t = 0
		st.dir = 0
		st.stepTravelled = 0
		st.diveTravelled = 0
		st.reads = 0
		st.locked = false
		st.moveAtT = nil
		st.stepAtT = nil
		st.diveAtT = nil
		st.wrongFooted = false
		k.startX = k.x
		k.targetX = k.x
		k.adjusting = false
		k.committedDir = nil
		sc.keeperReach = st.baseReach
		st.shotX = k.x
		st.cutOn = false
		if st.finish then
			st.shotFrom = Js.O({ x = ball.pos.x, y = ball.pos.y }, { "x", "y" })
			st.shotPace = Math.hypot(ball.vel.x, ball.vel.y, ball.vz)
			st.finishSet = nil
		end
		if st.pro then
			k.claim = nil
			st.claimGo = nil
			local kr = sc.keeperReach
			sc.keeperReach = st.baseReach
			st.fullR = M_canvasEngine.keeperSaveRadius(sc)
			sc.keeperReach = kr
		end
		local rt = (ab.rt + (gauss(rng) * ab.rtSd))
		if (rng() < ab.lateChance) then
			rt += ab.lateExtra
		end
		if st.moving then
			rt += KEEPER_BRAIN.caughtMoving
		end
		local raw = (if st.opts.openPlay ~= nil then st.opts.openPlay else KEEPER_BRAIN.openPlay)
		local dial = (if st.pro then (1 - ((1 - raw) * KEEPER_PRO_BRAIN.farReadShare)) else raw)
		st.farRead = (if (sc.kind ~= "penalty") then ((1 - dial) * farness(ball)) else 0)
		rt += (KEEPER_BRAIN.farReadLate * st.farRead)
		st.timingErr = ((gauss(rng) * ab.timingErr) * KEEPER_BRAIN.timingScale)
		st.blocked = 0
		st.wrongRead = false
		if (((sc.kind ~= "penalty") and (st.opts.vision ~= false)) and (not M_gameplayVersion.oldKeepers())) then
			local b = sightlineBlockage(sc, ball.pos)
			if (b > 0) then
				local H = KEEPER_HUMAN
				st.blocked = b
				rt += (H.visionLate * b)
				st.timingErr -= (H.visionDiveLate * b)
				st.wrongRead = (rng() < (H.visionWrongWay * b))
			end
		end
		st.rt = Math.max(0.1, rt)
		st.phase = "wait"
		st.reason = (if st.moving then "caught moving" else (if (st.blocked > 0.5) then "unsighted" else ""))
		if (sc.kind == "penalty") then
			local s = (if st.opts.penalty ~= nil then st.opts.penalty else M_penaltyKeeper.penaltyReadFor(ab.rating))
			local d = M_penaltyKeeper.decidePenaltyRead(sc, ball, s, Js.alit(rng(), rng()))
			if (not d.went) then
				st.reason = "stayed"
				do return end
			end
			local side = (if (st.hopSide ~= 0) then st.hopSide else d.side)
			st.dir = side
			st.target = ((if st.hopFromX ~= nil then st.hopFromX else k.x) + (side * d.metres))
			st.penFloor = (if d.reach ~= nil then d.reach else 1)
			local P = KEEPER_BRAIN.penGo
			st.rt = (P[1] + (rng() * (P[2] - P[1])))
			local cx = (crossXAt(ball, k.y) or k.x)
			local off = (cx - k.x)
			st.reason = (if ((math.abs(off) < 0.5) or (side == Math.sign(off))) then "guessed" else "wrong way")
		end
	end
	brainStrike = function(sc, ball, seed)
		local st = states:get(sc)
		if ((not st) or sc.keeper.done) then
			do return end
		end
		st.strikeSeed = Js.ushr(seed, 0)
		st.rng = brainRng(Js.ushr(Js.bxor(st.strikeSeed, 27422), 0))
		local shootingPicture = ((not sc.runner) and (not sc.passTarget))
		local shot = ((not (not ball.shot)) or shootingPicture)
		st.ownShot = shot
		if shot then
			onShot(sc, st, ball)
			st.lastShot = true
		else
			st.lastShot = false
			st.phase = "set"
			st.planted = false
			st.claimRead = false
		end
	end
	exports.brainStrike = brainStrike
	read = function(sc, st, ball, errScale)
		local k = sc.keeper
		local xTrue = crossXAt(ball, k.y)
		if (xTrue == nil) then
			do return false end
		end
		local far = st.farRead
		local unsighted = (if (st.reads < 2) then (1 + (KEEPER_HUMAN.visionReadErr * st.blocked)) else 1)
		local scale = ((Math.max(errScale, (KEEPER_BRAIN.farReadFloor * far)) * (1 + (KEEPER_BRAIN.farReadErr * far))) * unsighted)
		local Tf = (if st.feel then timeToLine(ball, k.y) else 99)
		if st.feel then
			scale *= (KEEPER_FEEL_BRAIN.readScale * clamp((KEEPER_FEEL_BRAIN.readNear + (KEEPER_FEEL_BRAIN.readPerS * Tf)), KEEPER_FEEL_BRAIN.readNear, 1))
		end
		local xEst = (xTrue + ((gauss(st.rng) * st.ab.readErr) * scale))
		local off = (xEst - k.x)
		if ((st.reads == 0) and st.wrongRead) then
			off = (-off)
		end
		local newDir = (if (math.abs(off) < 0.3) then 0 else Math.sign(off))
		local short = (if (newDir == 0) then 0 else (newDir * Math.min(0.25, (math.abs(off) * 0.3))))
		if ((((st.feel and st.locked) and (newDir ~= 0)) and (newDir ~= st.dir)) and (Tf > KEEPER_FEEL_BRAIN.adjustT)) then
			st.locked = false
		end
		if ((st.locked and (newDir ~= 0)) and (newDir ~= st.dir)) then
			st.target = k.x
			st.wrongFooted = true
			st.reads += 1
			do return true end
		end
		if ((st.dir ~= 0) and (newDir == st.dir)) then
			st.locked = true
		end
		st.dir = newDir
		st.target = (k.x + clamp((off - short), (-st.ab.maxTravel), st.ab.maxTravel))
		st.reads += 1
		do return true end
	end
	leaveFeet = function(sc, st, ball)
		local k = sc.keeper
		st.phase = "dive"
		st.diveAtT = st.t
		if (st.moveAtT == nil) then
			st.moveAtT = st.t
		end
		local T = (if ball then (timeToLine(ball, k.y) + (0.05 - KEEPER_BRAIN.diveLead)) else 0)
		local timed = (if (st.reads > 0) then clamp(((T - 0.25) / 0.35), 0, 1) else 0)
		local window = (if (sc.kind == "penalty") then st.penFloor else st.ab.diveWindow)
		st.diveFloor = (window + ((1 - window) * timed))
		k.saveDir = st.dir
		if (k.saveLunge <= 0) then
			k.saveLunge = 0.001
		end
		k.committedDir = (if (st.dir ~= 0) then st.dir else nil)
		k.targetX = st.target
		k.startX = k.x
	end
	windowReach = function(sc, st)
		local kr = sc.keeperReach
		sc.keeperReach = st.baseReach
		local reach = M_canvasEngine.keeperSaveRadius(sc)
		sc.keeperReach = kr
		local w = Math.max(st.diveFloor, (1 - (st.diveTravelled / Math.max(0.5, reach))))
		local base = (if st.baseReach ~= nil then st.baseReach else 1)
		sc.keeperReach = (if (w < 0.999) then (base * w) else st.baseReach)
	end
	brainStep = function(sc, ball, dt)
		brainStepInner(sc, ball, dt)
		local st = states:get(sc)
		if st then
			if st.pro then
				applyProReach(sc, st, ball)
			else
				applyTopCorner(sc, st, ball)
			end
			if st.finish then
				applyFinish(sc, st, ball)
			end
		end
	end
	exports.brainStep = brainStep
	applyTopCorner = function(sc, st, ball)
		local k = sc.keeper
		local live = ((((((((((((not (not ball)) and (sc.kind ~= "penalty")) and (st.opts.topCorner ~= false)) and (not M_gameplayVersion.oldKeepers())) and (not k.done)) and (((st.phase == "wait") or (st.phase == "step")) or (st.phase == "dive"))) and st.lastShot) and (k.saves == 0)) and (not k.scrambling)) and (ball.lastTouch == "attack")) and (not ball.loose)) and (ball.pos.y > k.y))
		if (not live) then
			if st.cutOn then
				if (st.phase == "dive") then
					windowReach(sc, st)
				else
					sc.keeperReach = st.baseReach
				end
			end
			st.cutOn = false
			do return end
		end
		local f = topCornerReach(sc, ball, st.shotX)
		if (st.phase == "dive") then
			windowReach(sc, st)
		end
		local base = (if (st.phase == "dive") then sc.keeperReach else st.baseReach)
		if (f < 1) then
			sc.keeperReach = ((if base ~= nil then base else 1) * f)
			st.cutOn = true
		else
			if (st.cutOn and (st.phase ~= "dive")) then
				sc.keeperReach = st.baseReach
			end
			st.cutOn = false
		end
	end
	brainStepInner = function(sc, ball, dt)
		local st = states:get(sc)
		local k = sc.keeper
		if ((not st) or k.done) then
			do return end
		end
		local ab = st.ab
		if ((st.phase ~= "engine") and ((k.saves > 0) or k.scrambling)) then
			st.phase = "engine"
			sc.keeperReach = st.baseReach
			k.committedDir = nil
		end
		if (st.phase == "engine") then
			if (((k.saves == 0) and (st.dir ~= 0)) and (st.diveAtT ~= nil)) then
				if (((k.targetX - st.target) * st.dir) > 0) then
					k.targetX = (if (((k.x - st.target) * st.dir) >= 0) then k.x else st.target)
				end
			end
			do return end
		end
		if (st.phase == "dive") then
			st.t += dt
			local dx = (st.target - k.x)
			local T = (if (ball and (ball.pos.y > k.y)) then timeToLine(ball, k.y) else 0)
			local top = (if (sc.kind == "penalty") then (ab.diveSpeed * KEEPER_BRAIN.penSpeed) else ab.diveSpeed)
			if (((((st.finish and ball) and st.lastShot) and (k.saves == 0)) and (ball.lastTouch == "attack")) and (not ball.loose)) then
				top *= finishDiveSpeed(sc, ball, st.shotX, st.shotFrom, st.shotPace, st.t)
			end
			local speed = (if ((T > 0.02) and (T < 50)) then clamp((math.abs(dx) / T), (top * KEEPER_BRAIN.diveSpeedFloor), top) else top)
			local step = Math.min(math.abs(dx), (speed * dt))
			k.x += (Math.sign(dx) * step)
			st.diveTravelled += step
			k.dive = clamp((k.x - k.startX), -3.2, 3.2)
			windowReach(sc, st)
			if (math.abs((st.target - k.x)) > 0.001) then
				do return end
			end
		end
		if (not ball) then
			do return end
		end
		local shotNow = ((((not (not ball.shot)) or (st.ownShot and (ball.owner == "you"))) and (not ball.loose)) and (ball.lastTouch == "attack"))
		if (shotNow and (not st.lastShot)) then
			onShot(sc, st, ball)
		end
		st.lastShot = shotNow
		if (st.phase == "dive") then
			do return end
		end
		if (not shotNow) then
			if (sc.kind == "cutback") then
				do return end
			end
			k.adjusting = false
			k.targetX = k.x
			if (st.pro and proOffBall(sc, st, ball, dt)) then
				do return end
			end
			if (st.phase ~= "set") then
				do return end
			end
			local recv = sc.receivedAt
			if (recv and (recv ~= st.lastRecv)) then
				st.lastRecv = recv
				local ideal = planSet(sc, st, Js.O({ x = recv.x, y = recv.y }, { "x", "y" }))
				st.setTarget = stepToward(Js.O({ x = k.x, y = k.y }, { "x", "y" }), ideal, (if (st.pro and clearThrough(sc, recv)) then KEEPER_PRO_BRAIN.rushStep else KEEPER_BRAIN.receptionStep))
				st.claimRead = false
				st.phase = "set"
				st.planted = false
			elseif ((((not recv) and (ball.owner == "you")) and (st.phase == "set")) and (not st.planted)) then
				st.planted = true
				st.setTarget = Js.O({ x = k.x, y = k.y }, { "x", "y" })
				st.moving = false
			end
			if ((st.phase == "set") or (st.phase == "wait")) then
				local fwd = (st.pro and ((st.setTarget.y - k.y) > 0.5))
				moveToward(sc, st, st.setTarget, (if fwd then (ab.setSpeed * KEEPER_PRO_BRAIN.rushSpeed) else ab.setSpeed), dt)
				k.startX = k.x
				k.targetX = k.x
			end
			do return end
		end
		st.t += dt
		if (ball.pos.y <= k.y) then
			do return end
		end
		if (st.phase == "wait") then
			if (sc.kind == "penalty") then
				if ((st.dir ~= 0) and (st.t >= st.rt)) then
					leaveFeet(sc, st)
				end
				do return end
			end
			if (st.t < st.rt) then
				do return end
			end
			if (not read(sc, st, ball, 1)) then
				do return end
			end
			st.phase = "step"
			st.stepAtT = st.t
			st.nextReadT = (st.t + KEEPER_BRAIN.readEvery)
		end
		if (st.phase == "step") then
			if (st.t >= st.nextReadT) then
				read(sc, st, ball, Math.max(0.5, (1 - (st.reads * 0.25))))
				st.nextReadT = (st.t + KEEPER_BRAIN.readEvery)
			end
			local T = timeToLine(ball, k.y)
			local need = (math.abs((st.target - k.x)) / ab.diveSpeed)
			local behindIt = (st.feel and (math.abs((st.target - k.x)) <= KEEPER_FEEL_BRAIN.standWithin))
			if ((not behindIt) and (T <= ((need + KEEPER_BRAIN.diveLead) + st.timingErr))) then
				leaveFeet(sc, st, ball)
				do return end
			end
			local dx = (st.target - k.x)
			local stepV = (if st.finish then (ab.stepSpeed * finishDiveSpeed(sc, ball, st.shotX, st.shotFrom, st.shotPace, st.t)) else ab.stepSpeed)
			local step = Math.min(math.abs(dx), (stepV * dt))
			if ((step > 0.000001) and (st.moveAtT == nil)) then
				st.moveAtT = st.t
			end
			k.x += (Math.sign(dx) * step)
			st.stepTravelled += step
			if (step > 0.000001) then
				k.dive = (Math.sign(dx) * 0.35)
			end
		end
	end
	finishParts = function(sc, ball, shotX, shotFrom, shotPace, tSince)
		local F = KEEPER_FINISH
		local Hm = KEEPER_HUMAN
		local k = sc.keeper
		if ((not (ball.vel.y < -0.5)) or (ball.pos.y <= k.y)) then
			do return nil end
		end
		local t = ((ball.pos.y - k.y) / (-ball.vel.y))
		local x = (ball.pos.x + (ball.vel.x * t))
		local z = Math.max(0, ((ball.z + (ball.vz * t)) - ((4.9 * t) * t)))
		local side = (x - shotX)
		local lat = math.abs(side)
		local ease = (1 - (F.ratingEase * grow(clamp((if Js.NumberNS.isFinite(sc.keeperStrength) then sc.keeperStrength else 62), 20, 99), 40, 95, 1)))
		local low = 0
		local lowTime = 1
		local lowness = clamp(((F.lowZ[2] - z) / (F.lowZ[2] - F.lowZ[1])), 0, 1)
		local wideL = clamp(((lat - F.lowWide[1]) / (F.lowWide[2] - F.lowWide[1])), 0, 1)
		if ((lowness > 0) and (wideL > 0)) then
			local off = (shotFrom.x - M_pitch.CX)
			local across = (if (Math.sign(side) == (-(Math.sign(off)))) then clamp(((math.abs(off) - F.acrossFrom[1]) / (F.acrossFrom[2] - F.acrossFrom[1])), 0, 1) else 0)
			local share = (F.nearShare + ((1 - F.nearShare) * across))
			low = ((lowness * wideL) * share)
			lowTime = (1 - ((1 - F.lowTimeFloor) * clamp((((tSince + t) - F.lowTime[1]) / (F.lowTime[2] - F.lowTime[1])), 0, 1)))
		end
		local top = 0
		local high = clamp(((z - Hm.topZ[1]) / (Hm.topZ[2] - Hm.topZ[1])), 0, 1)
		local wideT = clamp(((lat - Hm.topWide[1]) / (Hm.topWide[2] - Hm.topWide[1])), 0, 1)
		if ((high > 0) and (wideT > 0)) then
			top = ((high * wideT) * clamp(((shotPace - F.topPace[1]) / (F.topPace[2] - F.topPace[1])), 0, 1))
		end
		do return Js.O({ low = low, lowTime = lowTime, top = top, ease = ease }, { "low", "lowTime", "top", "ease" }) end
	end
	exports.finishParts = finishParts
	finishReach = function(sc, ball, shotX, shotFrom, shotPace, tSince)
		local F = KEEPER_FINISH
		local p = finishParts(sc, ball, shotX, shotFrom, shotPace, tSince)
		if (not p) then
			do return 1 end
		end
		local pro = (if sc.keeperPro then F.proScale else 1)
		local low = Math.min(0.9, ((((F.lowCut * pro) * p.low) * p.lowTime) * p.ease))
		local top = Math.min(0.9, (((F.topPaceCut * pro) * p.top) * p.ease))
		do return Math.max(F.floor, ((1 - low) * (1 - top))) end
	end
	exports.finishReach = finishReach
	finishDiveSpeed = function(sc, ball, shotX, shotFrom, shotPace, tSince)
		local p = finishParts(sc, ball, shotX, shotFrom, shotPace, tSince)
		if (not p) then
			do return 1 end
		end
		local F = KEEPER_FINISH
		local pro = (if sc.keeperPro then F.proScale else 1)
		do return Math.max(0.2, ((1 - ((((F.lowSlow * pro) * p.low) * p.lowTime) * p.ease)) - (((F.topSlow * pro) * p.top) * p.ease))) end
	end
	exports.finishDiveSpeed = finishDiveSpeed
	applyFinish = function(sc, st, ball)
		local k = sc.keeper
		if ((st.finishSet ~= nil) and (sc.keeperReach == st.finishSet)) then
			sc.keeperReach = st.finishPre
		end
		st.finishSet = nil
		local live = (((((((((not (not ball)) and (not k.done)) and (((st.phase == "wait") or (st.phase == "step")) or (st.phase == "dive"))) and st.lastShot) and (k.saves == 0)) and (not k.scrambling)) and (ball.lastTouch == "attack")) and (not ball.loose)) and (ball.pos.y > k.y))
		if (not live) then
			do return end
		end
		local f = finishReach(sc, ball, st.shotX, st.shotFrom, st.shotPace, st.t)
		if (f >= 0.999) then
			do return end
		end
		st.finishPre = sc.keeperReach
		sc.keeperReach = ((if sc.keeperReach ~= nil then sc.keeperReach else 1) * f)
		st.finishSet = sc.keeperReach
	end
	brainSnapshot = function(sc, strikeSeed)
		local st = states:get(sc)
		if (not st) then
			do return nil end
		end
		do return Js.O({ rating = st.ab.rating, kind = st.kind, start = Js.ospread(st.start), setTarget = Js.ospread(st.setTarget), moving = st.moving, baseReach = (if st.baseReach ~= nil then st.baseReach else nil), opts = Js.ospread(Js.JSON.parse(Js.JSON.stringify(st.opts)), (if st.finish then Js.O({ finish = true }, { "finish" }) else Js.O({}, nil))), hopSide = st.hopSide, hopFromX = st.hopFromX, strikeSeed = Js.ushr(strikeSeed, 0) }, { "rating", "kind", "start", "setTarget", "moving", "baseReach", "opts", "hopSide", "hopFromX", "strikeSeed" }) end
	end
	exports.brainSnapshot = brainSnapshot
	brainRestore = function(sc, s)
		brainSetup(sc, 0, s.rating, s.opts)
		local st = states:get(sc)
		if (not st) then
			do return end
		end
		st.kind = s.kind
		st.start = Js.ospread(s.start)
		st.setTarget = Js.ospread(s.setTarget)
		st.moving = s.moving
		st.baseReach = (if s.baseReach ~= nil then s.baseReach else nil)
		st.hopSide = (if s.hopSide ~= nil then s.hopSide else 0)
		st.hopFromX = (if s.hopFromX ~= nil then s.hopFromX else nil)
	end
	exports.brainRestore = brainRestore
	clearThrough = function(sc, at)
		local P = KEEPER_PRO_BRAIN
		if (math.abs((at.x - M_pitch.CX)) > P.rushWide) then
			do return false end
		end
		local D = Math.hypot((at.x - M_pitch.CX), at.y)
		if ((D > P.rushWithin) or (D < 7)) then
			do return false end
		end
		do
			local _arr14 = sc.defenders
			local _i15 = 0
			while _i15 < Js.alen(_arr14) do
				_i15 += 1
				local d = _arr14[_i15]
				if ((not (d.y < (at.y - 0.5))) or (d.y < 0)) then
					do continue end
				end
				local f = ((at.y - d.y) / Math.max(0.5, at.y))
				local lineX = (at.x + ((M_pitch.CX - at.x) * f))
				if (math.abs((d.x - lineX)) < P.coverLane) then
					do return false end
				end
			end
		end
		do return true end
	end
	exports.clearThrough = clearThrough
	proDepth = function(sc, ball)
		local D = Math.hypot((ball.x - M_pitch.CX), ball.y)
		local ang = Math.atan2(math.abs((ball.x - M_pitch.CX)), Math.max(0.5, ball.y))
		local d = ((2.6 + (0.7 * smooth01(5, 15, D))) - (0.2 * smooth01(20, 28, D)))
		if clearThrough(sc, ball) then
			d = Math.max(d, KEEPER_PRO_BRAIN.throughDepth)
		end
		local wideCut = (1 - (0.45 * Math.sin(ang)))
		do return clamp((d * wideCut), 0.8, Math.max(0.8, (ball.y - 4))) end
	end
	exports.proDepth = proDepth
	readDelivery = function(sc, st, ball)
		local P = KEEPER_PRO_BRAIN
		local k = sc.keeper
		local g = proG(st.ab.rating)
		local react = lerp2(P.react, g)
		local run = lerp2(P.run, g)
		local margin = lerp2(P.margin, g)
		local top = lerp2(P.top, g)
		local aerialDepth = lerp2(P.aerialDepth, g)
		local ours = Js.alit()
		if sc.runner then
			A.push(ours, sc.runner.pos)
		end
		do
			local _arr16 = (if sc.secondaryRunners ~= nil then sc.secondaryRunners else Js.alit())
			local _i17 = 0
			while _i17 < Js.alen(_arr16) do
				_i17 += 1
				local r = _arr16[_i17]
				A.push(ours, r.pos)
			end
		end
		local f = sc.follower
		if (((f and (f.x > -100)) and (f.y < 200)) and (not f.shot)) then
			A.push(ours, f)
		end
		local x = ball.pos.x
		local y = ball.pos.y
		local z = ball.z
		local vx = ball.vel.x
		local vy = ball.vel.y
		local vz = ball.vz
		local dt = 0.02
		do
			local t = dt
			local _first18 = true
			while true do
				if not _first18 then
					t += dt
				end
				_first18 = false
				if not (t <= 2.6) then break end
				x += (vx * dt)
				y += (vy * dt)
				if ((z > 0) or (vz > 0)) then
					vz -= (9.81 * dt)
					z += (vz * dt)
					if (z < 0) then
						z = 0
						if (vz < -2) then
							vz = ((-vz) * 0.5)
							vx *= 0.8
							vy *= 0.8
						else
							vz = 0
						end
					end
				else
					local sp = Math.hypot(vx, vy)
					local drop = (1.9 * dt)
					if (sp <= drop) then
						vx = 0
						vy = 0
					else
						vx *= ((sp - drop) / sp)
						vy *= ((sp - drop) / sp)
					end
				end
				if (y < 0.2) then
					do break end
				end
				local tA = math.huge
				do
					local _arr19 = ours
					local _i20 = 0
					while _i20 < Js.alen(_arr19) do
						_i20 += 1
						local a = _arr19[_i20]
						tA = Math.min(tA, (P.attackerStart + (Math.max(0, (Math.hypot((a.x - x), (a.y - y)) - P.attackerReach)) / P.attackerRun)))
					end
				end
				local aerial = (z > 0.9)
				local inArea = (if aerial then ((y <= aerialDepth) and (math.abs((x - M_pitch.CX)) <= 9.16)) else ((y <= P.groundDepth) and (math.abs((x - M_pitch.CX)) <= P.groundWide)))
				if (inArea and (z <= top)) then
					local six = ((y <= 5.5) and (math.abs((x - M_pitch.CX)) <= 9.16))
					local tK = (react + (Math.max(0, (Math.hypot((x - k.x), (y - k.y)) - 0.6)) / run))
					if ((tK <= t) and ((tK + (if six then (-P.sixEdge) else margin)) <= tA)) then
						do return Js.O({ claim = Js.O({ x = x, y = y, z = z, t = t, tK = tK, tA = tA, aerial = aerial }, { "x", "y", "z", "t", "tK", "tA", "aerial" }), meet = nil }, { "claim", "meet" }) end
					end
				end
				if ((z <= P.attackerTop) and (tA <= t)) then
					do return Js.O({ claim = nil, meet = Js.O({ x = x, y = y }, { "x", "y" }) }, { "claim", "meet" }) end
				end
				if ((Math.hypot(vx, vy) < 0.3) and (z == 0)) then
					do break end
				end
			end
		end
		do return Js.O({ claim = nil, meet = nil }, { "claim", "meet" }) end
	end
	proOffBall = function(sc, st, ball, dt)
		local P = KEEPER_PRO_BRAIN
		local k = sc.keeper
		local g = proG(st.ab.rating)
		if st.claimGo then
			local live = (((not (not k.claim)) and (not ball.loose)) and (ball.lastTouch == "attack"))
			if (not live) then
				st.claimGo = nil
				k.claim = nil
				st.setTarget = Js.O({ x = k.x, y = k.y }, { "x", "y" })
				st.planted = true
				st.moving = false
				do return false end
			end
			st.claimGo.t += dt
			if (st.claimGo.t >= st.claimGo.at) then
				moveToward(sc, st, Js.O({ x = st.claimGo.x, y = st.claimGo.y }, { "x", "y" }), lerp2(P.run, g), dt)
				k.startX = k.x
				k.targetX = k.x
			end
			do return true end
		end
		if ((st.phase ~= "set") or st.claimRead) then
			do return false end
		end
		if ((ball.loose or ball.resting) or (ball.lastTouch ~= "attack")) then
			do return false end
		end
		if (Math.hypot(ball.vel.x, ball.vel.y) < 5) then
			do return false end
		end
		st.claimRead = true
		local _d21 = readDelivery(sc, st, ball)
		local claim = _d21.claim
		local meet = _d21.meet
		if claim then
			local r = st.rng
			local flap = (r() < (lerp2(P.flap, g) * (if claim.aerial then 1 else 0.3)))
			local contested = ((claim.tA - claim.tK) < 0.6)
			local punch = (claim.aerial and (r() < (((P.punch + (if contested then P.punchContested else 0)) + (if (claim.z > 2.2) then P.punchHigh else 0)) + (P.punchGood * g))))
			local dir = ((function() local _l = Math.sign((claim.x - M_pitch.CX)); if Js.T(_l) then return _l end; return (if (r() < 0.5) then -1 else 1) end)() * (0.3 + (r() * 0.9)))
			local c = Js.O({ x = claim.x, y = claim.y, act = (if flap then "miss" else (if punch then "punch" else "catch")), dir = dir, pace = r(), reach = (if claim.aerial then 1 else 1.1), top = lerp2(P.top, g) }, { "x", "y", "act", "dir", "pace", "reach", "top" })
			k.claim = c
			st.claimGo = Js.O({ x = claim.x, y = claim.y, at = lerp2(P.react, g), t = 0 }, { "x", "y", "at", "t" })
			st.reason = (if claim.aerial then "came for it" else "swept up")
			do return true end
		end
		if (meet and clearThrough(sc, meet)) then
			local ideal = planSet(sc, st, meet)
			st.setTarget = stepToward(Js.O({ x = k.x, y = k.y }, { "x", "y" }), ideal, P.rushCap)
			st.reason = "comes out"
		end
		do return false end
	end
	applyProReach = function(sc, st, ball)
		local k = sc.keeper
		local live = (((((((((not (not ball)) and (not k.done)) and (((st.phase == "wait") or (st.phase == "step")) or (st.phase == "dive"))) and st.lastShot) and (k.saves == 0)) and (not k.scrambling)) and (ball.lastTouch == "attack")) and (not ball.loose)) and (ball.pos.y > k.y))
		if (not live) then
			if st.cutOn then
				if (st.phase == "dive") then
					windowReach(sc, st)
				else
					sc.keeperReach = st.baseReach
				end
			end
			st.cutOn = false
			do return end
		end
		if (st.phase == "dive") then
			windowReach(sc, st)
		end
		local r0 = (if (st.phase == "dive") then (if sc.keeperReach ~= nil then sc.keeperReach else 1) else (if st.baseReach ~= nil then st.baseReach else 1))
		local top = (if ((st.opts.topCorner ~= false) and (not M_gameplayVersion.oldKeepers())) then topCornerReach(sc, ball, st.shotX) else 1)
		local P = KEEPER_PRO_BRAIN
		local full = Math.max(0.5, st.fullR)
		local hand = (P.handNow + ((full - P.handNow) * clamp(((st.t - st.rt) / P.handFull), 0, 1)))
		local time_ = clamp((hand / full), 0, 1)
		local f = (top * time_)
		if (f < 0.999) then
			sc.keeperReach = (r0 * f)
			st.cutOn = true
		else
			sc.keeperReach = (if (st.phase == "dive") then r0 else st.baseReach)
			st.cutOn = false
		end
	end
	clamp = function(v, lo, hi)
		return (if (v < lo) then lo else (if (v > hi) then hi else v))
	end
	KEEPER_BRAIN = Js.O({ walkCap = 2.2, walkCapTight = 1, receptionStep = 0.7, readEvery = 0.12, caughtMoving = 0.12, diveLead = 0, timingScale = 0.7, diveSpeedFloor = 0.55, penGo = Js.alit(0.09, 0.15), penSpeed = 1.6, hopM = 0.18, hopShare = Js.alit(0, 0), hopAt = Js.alit(1, 1.8), leanChance = 0.35, leanDistM = 0.5, leanAt = Js.alit(0.5, 1.1), openPlay = 0.55, farReadLate = 0.35, farReadErr = 3, farReadFloor = 1 }, { "walkCap", "walkCapTight", "receptionStep", "readEvery", "caughtMoving", "diveLead", "timingScale", "diveSpeedFloor", "penGo", "penSpeed", "hopM", "hopShare", "hopAt", "leanChance", "leanDistM", "leanAt", "openPlay", "farReadLate", "farReadErr", "farReadFloor" })
	exports.KEEPER_BRAIN = KEEPER_BRAIN
	KEEPER_HUMAN = Js.O({ topZ = Js.alit(1.3, 1.9), topWide = Js.alit(0.7, 1.9), topCut = Js.alit(M_tuningStore.getTuning("keepers.topCutWeak"), M_tuningStore.getTuning("keepers.topCutStrong")), bodyR = 0.8, fullAt = 2, visionLate = M_tuningStore.getTuning("keepers.visionLate"), visionDiveLate = M_tuningStore.getTuning("keepers.visionDiveLate"), visionReadErr = M_tuningStore.getTuning("keepers.visionReadErr"), visionWrongWay = M_tuningStore.getTuning("keepers.visionWrongWay") }, { "topZ", "topWide", "topCut", "bodyR", "fullAt", "visionLate", "visionDiveLate", "visionReadErr", "visionWrongWay" })
	exports.KEEPER_HUMAN = KEEPER_HUMAN
	OPEN_PLAY_DIAL = Js.O({ hard = 1, middle = 0.55, easier = 0 }, { "hard", "middle", "easier" })
	exports.OPEN_PLAY_DIAL = OPEN_PLAY_DIAL
	BRAIN_DIAL_FLAG = "star-keeper-brain-dial"
	exports.BRAIN_DIAL_FLAG = BRAIN_DIAL_FLAG
	states = Js.Map.new()
	KEEPER_FEEL_BRAIN = Js.O({ readScale = 0.9, readNear = 0.4, readPerS = 0.9, adjustT = 0.45, standWithin = 0.9 }, { "readScale", "readNear", "readPerS", "adjustT", "standWithin" })
	exports.KEEPER_FEEL_BRAIN = KEEPER_FEEL_BRAIN
	KEEPER_FINISH = Js.O({ lowZ = Js.alit(0.6, 1.2), lowWide = Js.alit(0.9, 2.4), lowCut = 0.2, nearShare = 0.6, acrossFrom = Js.alit(1.5, 6), lowTime = Js.alit(0.5, 1.15), lowTimeFloor = 0.7, topPace = Js.alit(14, 26), topPaceCut = 0.35, ratingEase = 0.25, floor = 0.35, lowSlow = 0.12, proScale = 3, topSlow = 0.15 }, { "lowZ", "lowWide", "lowCut", "nearShare", "acrossFrom", "lowTime", "lowTimeFloor", "topPace", "topPaceCut", "ratingEase", "floor", "lowSlow", "proScale", "topSlow" })
	exports.KEEPER_FINISH = KEEPER_FINISH
	KEEPER_PRO_BRAIN = Js.O({ rushWithin = 24, rushWide = 12, handNow = 1.3, handFull = 0.35, throughDepth = 2.3, rushCap = 2.2, rushSpeed = 1.9, rushStep = 1.8, coverLane = 2, farReadShare = 0.45, aerialDepth = Js.alit(6, 9), groundDepth = 16.5, groundWide = 16, react = Js.alit(0.32, 0.2), run = Js.alit(4.6, 6.2), margin = Js.alit(0.4, 0.15), top = Js.alit(2.55, 2.85), flap = Js.alit(0.08, 0.02), punch = 0.15, punchContested = 0.22, punchHigh = 0.12, punchGood = -0.1, attackerReach = 1, attackerTop = 2.3, attackerStart = 0.15, attackerRun = 7, sixEdge = 0.2 }, { "rushWithin", "rushWide", "handNow", "handFull", "throughDepth", "rushCap", "rushSpeed", "rushStep", "coverLane", "farReadShare", "aerialDepth", "groundDepth", "groundWide", "react", "run", "margin", "top", "flap", "punch", "punchContested", "punchHigh", "punchGood", "attackerReach", "attackerTop", "attackerStart", "attackerRun", "sixEdge" })
	exports.KEEPER_PRO_BRAIN = KEEPER_PRO_BRAIN
	proG = function(r)
		return grow(clamp(r, 20, 99), 40, 95, 1)
	end
	lerp2 = function(ab, g)
		return (ab[1] + ((ab[2] - ab[1]) * g))
	end
	smooth01 = function(a, b, v)
		local t = clamp(((v - a) / (b - a)), 0, 1)
		do return ((t * t) * (3 - (2 * t))) end
	end
end
