--!nocheck
--!nolint
-- Generated from lib/star/authoredChance.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_scenarioStore = import("lib/star/scenarioStore")
	local M_authoredScenarios = import("lib/star/authoredScenarios")
	local M_airDrawings = import("lib/star/airDrawings")
	local M_scenarioRules = import("lib/star/scenarioRules")
	local M_canvasEngine = import("lib/star/canvasEngine")
	local M_pitch = import("lib/star/pitch")
	local POST_L, POST_R, clamp, injectedPool, savedVisible, showSavedScenarios, setLiveScenarioPool, livePool, authoredPool, playPool, ruleCache, ruleSetFor, hasAuthored, mateBodiesOf, sampleFromScenario, JITTER_M, BALL_JITTER_M, ATTEMPT_SCALE, nudge, KEEPER_TUNING, KEEPER_TUNING_BY_KIND, keeperTuningFor, CENTRAL_BALL_M, keeperSharesOf, placeKeeper, closestPair, DEAD_BALL_EXACT, randomiseAuthored, nextAuthoredShape, stableBase, djb2, mix32, OFF_THE_PICTURE, EXTRA_RUNNER_SPEED, drawnHeadcount, isTurnedDeadBall, mirrorShape, standardFrame, applyAuthoredShape
	showSavedScenarios = function(on)
		savedVisible = on
	end
	exports.showSavedScenarios = showSavedScenarios
	setLiveScenarioPool = function(list)
		injectedPool = list
	end
	exports.setLiveScenarioPool = setLiveScenarioPool
	livePool = function()
		if injectedPool then
			do return injectedPool end
		end
		if (not savedVisible) then
			do return Js.alit() end
		end
		local _ok1, _err2, _rv3 = pcall(function()
			do return Js.RET, M_scenarioStore.listScenarios() end
		end)
		if not _ok1 then
			do return Js.alit() end
		elseif _err2 == Js.RET then
			return _rv3
		end
	end
	authoredPool = function(kind)
		local byId = Js.Map.new()
		do
			local _arr4 = Js.Object.values(M_authoredScenarios.AUTHORED_SCENARIOS)
			local _i5 = 0
			while _i5 < Js.alen(_arr4) do
				_i5 += 1
				local s = _arr4[_i5]
				if ((function() local _v = s.source; if _v == nil then return nil end; _v = _v.kind; return _v end)() == kind) then
					byId:set(s.id, s)
				end
			end
		end
		do
			local _arr6 = livePool()
			local _i7 = 0
			while _i7 < Js.alen(_arr6) do
				_i7 += 1
				local s = _arr6[_i7]
				if ((function() local _v = s.source; if _v == nil then return nil end; _v = _v.kind; return _v end)() == kind) then
					byId:set(s.id, s)
				end
			end
		end
		do return A.sort(Js.Array.from(byId:values()), function(a, b)
			return S.localeCompare(a.id, b.id)
		end) end
	end
	exports.authoredPool = authoredPool
	playPool = function(kind)
		local own = authoredPool(kind)
		if ((not M_airDrawings.isAirKind(kind)) or (Js.alen(A.filter(own, function(s)
			return (not (not M_scenarioRules.sampleFromAuthored(s)))
		end)) >= M_scenarioRules.MIN_SAMPLES_FOR_INVARIANT)) then
			do return own end
		end
		do return Js.aspread(own, M_airDrawings.derivedAirDrawings(kind, authoredPool)) end
	end
	exports.playPool = playPool
	ruleSetFor = function(kind)
		local pool = playPool(kind)
		if (not Js.T(Js.alen(pool))) then
			do return nil end
		end
		local key = A.join(A.map(pool, function(s)
			return (s.id .. "@" .. Js.numstr((if s.updatedAt ~= nil then s.updatedAt else 0)))
		end), "|")
		local hit = ruleCache:get(kind)
		if (hit and (hit.key == key)) then
			do return hit.set end
		end
		local usable = A.filter(pool, function(s)
			return (not (not M_scenarioRules.sampleFromAuthored(s)))
		end)
		local samples = A.map(usable, M_scenarioRules.sampleFromAuthored)
		if (not Js.T(Js.alen(samples))) then
			do return nil end
		end
		local set = M_scenarioRules.deriveRuleSet(kind, samples, A.map(usable, function(s)
			return s.id
		end))
		ruleCache:set(kind, Js.O({ key = key, set = set }, { "key", "set" }))
		do return set end
	end
	exports.ruleSetFor = ruleSetFor
	hasAuthored = function(kind)
		local set = ruleSetFor(kind)
		do return ((not (not set)) and (set.n >= M_scenarioRules.MIN_SAMPLES_FOR_INVARIANT)) end
	end
	exports.hasAuthored = hasAuthored
	mateBodiesOf = function(sc)
		local out = Js.alit()
		if sc.runner then
			A.push(out, sc.runner.pos)
		end
		do
			local _arr8 = sc.secondaryRunners
			local _i9 = 0
			while _i9 < Js.alen(_arr8) do
				_i9 += 1
				local r = _arr8[_i9]
				A.push(out, r.pos)
			end
		end
		if M_canvasEngine.goalInView(sc.kind) then
			A.push(out, sc.follower)
		end
		do
			local _arr10 = sc.teammates
			local _i11 = 0
			while _i11 < Js.alen(_arr10) do
				_i11 += 1
				local t = _arr10[_i11]
				A.push(out, t)
			end
		end
		do return out end
	end
	exports.mateBodiesOf = mateBodiesOf
	sampleFromScenario = function(sc)
		do return Js.O({ ball = Js.O({ x = sc.ball.x, y = sc.ball.y }, { "x", "y" }), you = Js.O({ x = sc.player.x, y = sc.player.y }, { "x", "y" }), keeper = Js.O({ x = sc.keeper.x, y = sc.keeper.y }, { "x", "y" }), defenders = A.map(sc.defenders, function(d)
			return Js.O({ x = d.x, y = d.y }, { "x", "y" })
		end), mates = A.map(mateBodiesOf(sc), function(m)
			return Js.O({ x = m.x, y = m.y }, { "x", "y" })
		end) }, { "ball", "you", "keeper", "defenders", "mates" }) end
	end
	exports.sampleFromScenario = sampleFromScenario
	keeperTuningFor = function(kind)
		local own = (if Js.T(kind) then KEEPER_TUNING_BY_KIND[kind] else nil)
		do return Js.O({ nearPost = ((function() local _v = own; if _v == nil then return nil end; _v = _v.nearPost; return _v end)() or KEEPER_TUNING.nearPost), advance = ((function() local _v = own; if _v == nil then return nil end; _v = _v.advance; return _v end)() or KEEPER_TUNING.advance) }, { "nearPost", "advance" }) end
	end
	exports.keeperTuningFor = keeperTuningFor
	keeperSharesOf = function(s)
		local lateral = (s.ball.x - M_pitch.CX)
		do return Js.O({ nearPost = (if (math.abs(lateral) < CENTRAL_BALL_M) then nil else (((s.keeper.x - M_pitch.CX) * Math.sign(lateral)) / math.abs(lateral))), advance = (if (s.ball.y <= 0.01) then nil else (s.keeper.y / s.ball.y)) }, { "nearPost", "advance" }) end
	end
	exports.keeperSharesOf = keeperSharesOf
	placeKeeper = function(ball, shares, drawn, kind)
		local tuning = keeperTuningFor(kind)
		local nearPost = (if tuning.nearPost ~= nil then tuning.nearPost else shares.nearPost)
		local advance = (if tuning.advance ~= nil then tuning.advance else shares.advance)
		local lateral = (ball.x - M_pitch.CX)
		local x = (if ((nearPost == nil) or (math.abs(lateral) < CENTRAL_BALL_M)) then (M_pitch.CX + (drawn.x - M_pitch.CX)) else (M_pitch.CX + ((Math.sign(lateral) * nearPost) * math.abs(lateral))))
		local y = (if (advance == nil) then drawn.y else (advance * ball.y))
		do return Js.O({ x = clamp(x, (POST_L - 2.5), (POST_R + 2.5)), y = y }, { "x", "y" }) end
	end
	exports.placeKeeper = placeKeeper
	closestPair = function(s)
		local pts = Js.aspread(Js.alit(s.you), s.defenders, s.mates)
		local best = math.huge
		for i = 0, (Js.alen(pts)) - 1 do
			for j = (i + 1), (Js.alen(pts)) - 1 do
				local d = Math.hypot((pts[i + 1].x - pts[j + 1].x), (pts[i + 1].y - pts[j + 1].y))
				if (d < best) then
					best = d
				end
			end
		end
		do return best end
	end
	randomiseAuthored = function(base, set, rng, opts)
		if opts == nil then opts = Js.O({}, nil) end
		local s0 = M_scenarioRules.sampleFromAuthored(base)
		if (not s0) then
			do return nil end
		end
		local shares = keeperSharesOf(s0)
		local rejected = 0
		local kindOf = ((function() local _v = base.source; if _v == nil then return nil end; _v = _v.kind; return _v end)() or base.kind)
		local exact = ((not (not opts.noNudge)) or DEAD_BALL_EXACT:has(kindOf))
		local k = (if opts.nudgeScale ~= nil then opts.nudgeScale else 1)
		local ballJitter = (BALL_JITTER_M * k)
		local manJitter = (JITTER_M * k)
		do
			local _arr12 = (if exact then Js.alit(0) else ATTEMPT_SCALE)
			local _i13 = 0
			while _i13 < Js.alen(_arr12) do
				_i13 += 1
				local scale = _arr12[_i13]
				local deadBall = ((kindOf == "corner") or (not (not opts.fixedBall)))
				local shift = (if ((scale == 0) or deadBall) then Js.O({ x = 0, y = 0 }, { "x", "y" }) else nudge(Js.O({ x = 0, y = 0 }, { "x", "y" }), (ballJitter * scale), rng))
				local cand = Js.O({ ball = Js.O({ x = (s0.ball.x + shift.x), y = (s0.ball.y + shift.y) }, { "x", "y" }), you = Js.O({ x = (s0.you.x + shift.x), y = (s0.you.y + shift.y) }, { "x", "y" }), keeper = Js.O({ x = 0, y = 0 }, { "x", "y" }), defenders = A.map(s0.defenders, function(d)
					return (if (scale == 0) then d else nudge(d, (manJitter * scale), rng))
				end), mates = A.map(s0.mates, function(m)
					return (if (scale == 0) then m else nudge(m, (manJitter * scale), rng))
				end) }, { "ball", "you", "keeper", "defenders", "mates" })
				cand.keeper = placeKeeper(cand.ball, shares, s0.keeper, (function() local _v = base.source; if _v == nil then return nil end; _v = _v.kind; return _v end)())
				local spacing = Math.min(1, closestPair(s0))
				if ((closestPair(cand) + 0.05) < spacing) then
					rejected += 1
					do continue end
				end
				if (Js.alen(M_scenarioRules.violations(cand, set)) == 0) then
					do return Js.ospread(Js.O({ sourceId = base.id }, { "sourceId" }), cand, Js.O({ camera = base.camera, jitter = scale, rejected = rejected }, { "camera", "jitter", "rejected" })) end
				end
				rejected += 1
			end
		end
		do return nil end
	end
	exports.randomiseAuthored = randomiseAuthored
	nextAuthoredShape = function(kind, rng, recent, stableKey)
		if recent == nil then recent = Js.alit() end
		local set = ruleSetFor(kind)
		local pool = playPool(kind)
		if ((not set) or (set.n < M_scenarioRules.MIN_SAMPLES_FOR_INVARIANT)) then
			do return nil end
		end
		local fresh = A.filter(pool, function(s)
			return (not A.includes(recent, s.id))
		end)
		local from = (if Js.T(Js.alen(fresh)) then fresh else pool)
		local base = (if (stableKey == nil) then from[math.fmod(math.floor((rng() * Js.alen(from))), Js.alen(from)) + 1] else stableBase(from, stableKey))
		local shape = randomiseAuthored(base, set, rng)
		if shape then
			do return shape end
		end
		local rest = A.filter(from, function(s)
			return (s.id ~= base.id)
		end)
		do
			local i = 0
			local _first14 = true
			while true do
				if not _first14 then
					i += 1
				end
				_first14 = false
				if not (i < Js.alen(rest)) then break end
				local alt = (if (stableKey == nil) then rest[i + 1] else stableBase(rest, ((stableKey + i) + 1)))
				local ok = randomiseAuthored(alt, set, rng)
				if ok then
					do return ok end
				end
			end
		end
		do return nil end
	end
	exports.nextAuthoredShape = nextAuthoredShape
	stableBase = function(pool, key)
		local best = pool[1]
		local bestScore = -1
		do
			local _arr15 = pool
			local _i16 = 0
			while _i16 < Js.alen(_arr15) do
				_i16 += 1
				local s = _arr15[_i16]
				local h = mix32(Js.bxor(djb2(s.id), Js.ushr(key, 0)))
				if (h > bestScore) then
					bestScore = h
					best = s
				end
			end
		end
		do return best end
	end
	drawnHeadcount = function(sc, shape, takenD, takenM, bodies)
		local placedD = takenD.size
		local tmpl = sc.defenders[1]
		do
			local k = placedD
			local _first17 = true
			while true do
				if not _first17 then
					k += 1
				end
				_first17 = false
				if not (k < Js.alen(shape.defenders)) then break end
				local s = shape.defenders[k + 1]
				A.push(sc.defenders, (if tmpl then Js.ospread(tmpl, Js.O({ x = s.x, y = s.y, homeX = nil, homeY = nil, role = nil, baseRole = nil, interceptTo = nil, who = nil, chasing = nil }, { "x", "y", "homeX", "homeY", "role", "baseRole", "interceptTo", "who", "chasing" })) else Js.O({ x = s.x, y = s.y }, { "x", "y" })))
				takenD:add((Js.alen(sc.defenders) - 1))
				placedD += 1
			end
		end
		local before = Js.alen(sc.defenders)
		sc.defenders = A.filter(sc.defenders, function(_, i)
			return takenD:has(i)
		end)
		local removed = (before - Js.alen(sc.defenders))
		local kinds = Js.alit()
		if sc.runner then
			A.push(kinds, "runner")
		end
		for i = 0, (Js.alen(sc.secondaryRunners)) - 1 do
			A.push(kinds, "second")
		end
		if M_canvasEngine.goalInView(sc.kind) then
			A.push(kinds, "follower")
		end
		for i = 0, (Js.alen(sc.teammates)) - 1 do
			A.push(kinds, "mate")
		end
		local runnerIdx = A.indexOf(kinds, "runner")
		if ((runnerIdx >= 0) and (not takenM:has(runnerIdx))) then
			local best = -1
			local bestD = math.huge
			A.forEach(bodies, function(b, i)
				if ((not takenM:has(i)) or ((kinds[i + 1] ~= "mate") and (kinds[i + 1] ~= "second"))) then
					do return end
				end
				local d = Math.hypot((b.x - bodies[runnerIdx + 1].x), (b.y - bodies[runnerIdx + 1].y))
				if (d < bestD) then
					bestD = d
					best = i
				end
			end)
			if (best >= 0) then
				bodies[runnerIdx + 1].x = bodies[best + 1].x
				bodies[runnerIdx + 1].y = bodies[best + 1].y
				takenM:delete(best)
				takenM:add(runnerIdx)
			end
		end
		local leaving = Js.Set.new()
		A.forEach(bodies, function(b, i)
			if (not takenM:has(i)) then
				leaving:add(b)
			end
		end)
		sc.teammates = A.filter(sc.teammates, function(m)
			return (not leaving:has(m))
		end)
		sc.secondaryRunners = A.filter(sc.secondaryRunners, function(r)
			return (not leaving:has(r.pos))
		end)
		if leaving:has(sc.follower) then
			sc.follower.x = OFF_THE_PICTURE.x
			sc.follower.y = OFF_THE_PICTURE.y
		end
		local placedM = takenM.size
		local standing = (((sc.kind == "corner") or (sc.kind == "penalty")) or (sc.kind == "free_kick"))
		do
			local k = placedM
			local _first18 = true
			while true do
				if not _first18 then
					k += 1
				end
				_first18 = false
				if not (k < Js.alen(shape.mates)) then break end
				local at = shape.mates[k + 1]
				if standing then
					A.push(sc.teammates, Js.O({ x = at.x, y = at.y }, { "x", "y" }))
				else
					A.push(sc.secondaryRunners, Js.O({ pos = Js.O({ x = at.x, y = at.y }, { "x", "y" }), to = Js.O({ x = at.x, y = at.y }, { "x", "y" }), speed = (((function() local _v = sc.runner; if _v == nil then return nil end; _v = _v.speed; return _v end)() or (function() local _v = sc.secondaryRunners[1]; if _v == nil then return nil end; _v = _v.speed; return _v end)()) or EXTRA_RUNNER_SPEED), moving = false, role = "support", sprint = false }, { "pos", "to", "speed", "moving", "role", "sprint" }))
				end
				placedM += 1
			end
		end
		do return Js.O({ defendersPlaced = placedD, matesPlaced = placedM, removed = removed }, { "defendersPlaced", "matesPlaced", "removed" }) end
	end
	isTurnedDeadBall = function(sc)
		local turnedKind = ((sc.kind == "corner") or (sc.kind == "byline_cross"))
		do return (turnedKind and ((sc.facing == "left") or (sc.facing == "right"))) end
	end
	mirrorShape = function(s)
		local m = function(v)
			return Js.O({ x = (M_pitch.PITCH_W - v.x), y = v.y }, { "x", "y" })
		end
		do return Js.ospread(s, Js.O({ ball = m(s.ball), you = m(s.you), keeper = m(s.keeper), defenders = A.map(s.defenders, m), mates = A.map(s.mates, m), camera = Js.ospread(s.camera, Js.O({ centerX = (M_pitch.PITCH_W - s.camera.centerX) }, { "centerX" })) }, { "ball", "you", "keeper", "defenders", "mates", "camera" })) end
	end
	exports.mirrorShape = mirrorShape
	standardFrame = function(sc, built, builtBall)
		local w = (built.x2 - built.x1)
		local h = (built.y2 - built.y1)
		local goal = M_canvasEngine.goalInView(sc.kind)
		local pts = A.filter(Js.aspread(Js.alit(sc.ball, sc.player, sc.keeper), sc.defenders, mateBodiesOf(sc)), function(p)
			return ((p.x > -100) and (p.x < (M_pitch.PITCH_W + 100)))
		end)
		if goal then
			A.push(pts, Js.O({ x = (M_pitch.CX - (M_pitch.GOAL_W / 2)), y = 0 }, { "x", "y" }), Js.O({ x = (M_pitch.CX + (M_pitch.GOAL_W / 2)), y = 0 }, { "x", "y" }))
		end
		local xs = A.map(pts, function(p)
			return p.x
		end)
		local cx = ((Math.min(Js.unpack(xs)) + Math.max(Js.unpack(xs))) / 2)
		local cy = (if goal then ((built.y1 + built.y2) / 2) else (sc.ball.y + (((built.y1 + built.y2) / 2) - builtBall.y)))
		do
			local _arr19 = Js.alit(sc.ball, sc.player)
			local _i20 = 0
			while _i20 < Js.alen(_arr19) do
				_i20 += 1
				local p = _arr19[_i20]
				cx = Math.min(Math.max(cx, ((p.x - (w / 2)) + 3)), ((p.x + (w / 2)) - 3))
				cy = Math.min(Math.max(cy, ((p.y - (h / 2)) + 3)), ((p.y + (h / 2)) - 3))
			end
		end
		if goal then
			cx = Math.min(Math.max(cx, (((M_pitch.CX + (M_pitch.GOAL_W / 2)) + 1) - (w / 2))), (((M_pitch.CX - (M_pitch.GOAL_W / 2)) - 1) + (w / 2)))
		end
		do return Js.O({ x1 = (cx - (w / 2)), x2 = (cx + (w / 2)), y1 = (cy - (h / 2)), y2 = (cy + (h / 2)) }, { "x1", "x2", "y1", "y2" }) end
	end
	applyAuthoredShape = function(sc, shape)
		if (isTurnedDeadBall(sc) and ((shape.ball.x >= M_pitch.CX) ~= (sc.ball.x >= M_pitch.CX))) then
			shape = mirrorShape(shape)
		end
		local built = Js.ospread(sc.viewport)
		local builtBall = Js.O({ x = sc.ball.x, y = sc.ball.y }, { "x", "y" })
		sc.ball.x = shape.ball.x
		sc.ball.y = shape.ball.y
		sc.player.x = shape.you.x
		sc.player.y = shape.you.y
		sc.keeper.x = shape.keeper.x
		sc.keeper.y = shape.keeper.y
		sc.keeper.targetX = shape.keeper.x
		sc.keeper.startX = sc.keeper.targetX
		local takenD = Js.Set.new()
		local defendersPlaced = 0
		do
			local _arr22 = shape.defenders
			local _i23 = 0
			while _i23 < Js.alen(_arr22) do
				_i23 += 1
				local spot = _arr22[_i23]
				local best = -1
				local bestD = math.huge
				A.forEach(sc.defenders, function(d, i)
					if takenD:has(i) then
						do return end
					end
					local dist = Math.hypot((d.x - spot.x), (d.y - spot.y))
					if (dist < bestD) then
						bestD = dist
						best = i
					end
				end)
				if (best < 0) then
					do break end
				end
				takenD:add(best)
				sc.defenders[best + 1].x = spot.x
				sc.defenders[best + 1].y = spot.y
				defendersPlaced += 1
			end
		end
		local bodies = mateBodiesOf(sc)
		local takenM = Js.Set.new()
		local matesPlaced = 0
		local firstSpot = 0
		if ((M_airDrawings.isAirKind(sc.kind) and Js.T(Js.alen(shape.mates))) and Js.T(Js.alen(sc.teammates))) then
			local c = sc.teammates[1]
			local spot = shape.mates[M_airDrawings.CROSSER_MATE_INDEX + 1]
			c.x = clamp(spot.x, M_airDrawings.CROSSER_IN_M, (M_pitch.PITCH_W - M_airDrawings.CROSSER_IN_M))
			c.y = Math.max(M_airDrawings.CROSSER_IN_M, spot.y)
			takenM:add(A.indexOf(bodies, c))
			matesPlaced += 1
			firstSpot = (M_airDrawings.CROSSER_MATE_INDEX + 1)
		end
		do
			local _arr24 = A.slice(shape.mates, firstSpot)
			local _i25 = 0
			while _i25 < Js.alen(_arr24) do
				_i25 += 1
				local spot = _arr24[_i25]
				local best = -1
				local bestD = math.huge
				A.forEach(bodies, function(m, i)
					if takenM:has(i) then
						do return end
					end
					local dist = Math.hypot((m.x - spot.x), (m.y - spot.y))
					if (dist < bestD) then
						bestD = dist
						best = i
					end
				end)
				if (best < 0) then
					do break end
				end
				takenM:add(best)
				bodies[best + 1].x = spot.x
				bodies[best + 1].y = spot.y
				matesPlaced += 1
			end
		end
		local r = drawnHeadcount(sc, shape, takenD, takenM, bodies)
		defendersPlaced = r.defendersPlaced
		matesPlaced = r.matesPlaced
		local removed = r.removed
		if sc.runner then
			sc.runner.to.x = sc.runner.pos.x
			sc.runner.to.y = sc.runner.pos.y
		end
		do
			local _arr26 = sc.secondaryRunners
			local _i27 = 0
			while _i27 < Js.alen(_arr26) do
				_i27 += 1
				local r = _arr26[_i27]
				r.to.x = r.pos.x
				r.to.y = r.pos.y
			end
		end
		if sc.runner then
			sc.passTarget = Js.O({ x = sc.runner.to.x, y = sc.runner.to.y }, { "x", "y" })
		end
		if (not isTurnedDeadBall(sc)) then
			sc.viewport = standardFrame(sc, built, builtBall)
		elseif (sc.kind == "byline_cross") then
			sc.viewport = M_canvasEngine.crossViewportOnBall(sc.ball, (if (sc.ball.x >= M_pitch.CX) then 1 else -1))
		end
		if (sc.kind == "header") then
			M_airDrawings.setAirZ(sc, M_airDrawings.headerZFromSpread(M_airDrawings.pictureKey(sc)))
		end
		do return Js.O({ defendersPlaced = defendersPlaced, matesPlaced = matesPlaced, removed = removed }, { "defendersPlaced", "matesPlaced", "removed" }) end
	end
	exports.applyAuthoredShape = applyAuthoredShape
	POST_L = (M_pitch.CX - (M_pitch.GOAL_W / 2))
	POST_R = (M_pitch.CX + (M_pitch.GOAL_W / 2))
	clamp = function(v, lo, hi)
		return (if (v < lo) then lo else (if (v > hi) then hi else v))
	end
	injectedPool = nil
	savedVisible = false
	ruleCache = Js.Map.new()
	JITTER_M = 2
	exports.JITTER_M = JITTER_M
	BALL_JITTER_M = 1.2
	ATTEMPT_SCALE = Js.alit(1, 0.6, 0.3, 0)
	nudge = function(p, r, rng)
		local a = ((rng() * Math.PI) * 2)
		local d = (Math.sqrt(rng()) * r)
		do return Js.O({ x = (p.x + (Math.cos(a) * d)), y = (p.y + (Math.sin(a) * d)) }, { "x", "y" }) end
	end
	KEEPER_TUNING = Js.O({ nearPost = nil, advance = nil }, { "nearPost", "advance" })
	exports.KEEPER_TUNING = KEEPER_TUNING
	KEEPER_TUNING_BY_KIND = Js.O({}, nil)
	exports.KEEPER_TUNING_BY_KIND = KEEPER_TUNING_BY_KIND
	CENTRAL_BALL_M = 1.5
	DEAD_BALL_EXACT = Js.Set.new(Js.alit("penalty", "free_kick"))
	exports.DEAD_BALL_EXACT = DEAD_BALL_EXACT
	djb2 = function(str)
		local h = 5381
		for i = 0, (S.len(str)) - 1 do
			h = Js.ushr(Js.bxor((h * 33), S.charCodeAt(str, i)), 0)
		end
		do return Js.ushr(h, 0) end
	end
	mix32 = function(n)
		local h = Js.ushr(n, 0)
		h = Js.ushr(Math.imul(Js.bxor(h, Js.ushr(h, 16)), 2246822507), 0)
		h = Js.ushr(Math.imul(Js.bxor(h, Js.ushr(h, 13)), 3266489909), 0)
		do return Js.ushr(Js.bxor(h, Js.ushr(h, 16)), 0) end
	end
	OFF_THE_PICTURE = Js.O({ x = -400, y = 400 }, { "x", "y" })
	EXTRA_RUNNER_SPEED = 6.65
end
