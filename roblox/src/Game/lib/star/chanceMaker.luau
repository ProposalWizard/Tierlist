--!nocheck
--!nolint
-- Generated from lib/star/chanceMaker.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_authoredChance = import("lib/star/authoredChance")
	local M_pitch = import("lib/star/pitch")
	local M_baseScenario = import("lib/star/baseScenario")
	local M_canvasEngine = import("lib/star/canvasEngine")
	local M_scenarioRules = import("lib/star/scenarioRules")
	local M_season = import("lib/star/season")
	local M_index = import("lib/star/kindRules/index")
	local M_switchedOffKinds = import("lib/star/switchedOffKinds")
	local M_bylineShort = import("lib/star/bylineShort")
	local M_goalFrame = import("lib/star/goalFrame")
	local M_newChances = import("lib/star/newChances")
	local M_kindMix = import("lib/star/kindMix")
	local M_scenarioSelect = import("lib/star/scenarioSelect")
	local M_realMomentHighlights = import("lib/star/fhr/realMomentHighlights")
	local M_spacing = import("lib/star/spacing")
	local M_chanceFormula = import("lib/star/chanceFormula")
	local M_formationShape = import("lib/star/formationShape")
	local M_hiddenMatch = import("lib/star/hiddenMatch")
	local PICTURE_MEMORY, parked, hyp, mean, r1, pt, pictureOf, setDist, pictureDistance, mirrorPicture, SAME_PICTURE_M, pictureGap, samePicture, MEMORY_KEEP, PictureMemory, visitSalt, setVisitSalt, saltFor, saltedRng, memories, pictureMemory, OVERLAP_M, servedFaults, DEFENDER_ON_BALL, defenderOnTheBall, FIXED_BALL, IDENTICAL_ONLY, memoryRule, MAX_TRIES, drawingsOf, servesDrawings, mirrorV, mirrorSample, onSide, sideOf, gauss, clamp, inPitch, anchor, carry, closestPair, ballInRange, DEFAULT_CAMERA, drawingShape, ownFaultCache, drawingOwnFaults, stableIndex, offeredKinds, SETTLED_ONE_ON_ONE, makeChance, ZONES, positionSide, requestSide, bannedBy, drawnOpenKinds, kindCentroid, drawnKindCache, drawnKindFor, NEW_CROSS_MAX_IN_8, NEW_CROSS_WEIGHT
	local CROSS_KINDS, weighCrosses, crossesCapped, newRequestKind, rollKind, buildDrawnSim, nextDrawnSeed, simIsMadeHere, nearestDrawing
	pictureOf = function(sc)
		local s = M_authoredChance.sampleFromScenario(sc)
		local v = sc.viewport
		do return Js.O({ kind = sc.kind, ball = pt(s.ball), you = pt(s.you), keeper = pt(s.keeper), defenders = A.map(A.filter(s.defenders, function(d)
			return (not parked(d))
		end), pt), mates = A.map(A.filter(s.mates, function(m)
			return (not parked(m))
		end), pt), cam = pt(Js.O({ x = ((v.x1 + v.x2) / 2), y = ((v.y1 + v.y2) / 2) }, { "x", "y" })) }, { "kind", "ball", "you", "keeper", "defenders", "mates", "cam" }) end
	end
	exports.pictureOf = pictureOf
	setDist = function(A_, B)
		local countPen = (math.abs((Js.alen(A_) - Js.alen(B))) * 3)
		if ((not Js.T(Js.alen(A_))) or (not Js.T(Js.alen(B)))) then
			do return countPen end
		end
		local nn = function(P, Q)
			return A.map(P, function(p)
				return Math.min(Js.unpack(A.map(Q, function(q)
					return hyp(p, q)
				end)))
			end)
		end
		do return (((mean(nn(A_, B)) + mean(nn(B, A_))) / 2) + countPen) end
	end
	pictureDistance = function(p, q)
		do return (((((((2 * hyp(p.ball, q.ball)) + hyp(p.you, q.you)) + hyp(p.keeper, q.keeper)) + (2 * setDist(p.defenders, q.defenders))) + setDist(p.mates, q.mates)) + (0.5 * hyp(p.cam, q.cam))) / 7.5) end
	end
	exports.pictureDistance = pictureDistance
	mirrorPicture = function(p)
		local m = function(v)
			return Js.O({ x = (M_pitch.PITCH_W - v.x), y = v.y }, { "x", "y" })
		end
		do return Js.ospread(p, Js.O({ ball = m(p.ball), you = m(p.you), keeper = m(p.keeper), defenders = A.map(p.defenders, m), mates = A.map(p.mates, m), cam = m(p.cam) }, { "ball", "you", "keeper", "defenders", "mates", "cam" })) end
	end
	exports.mirrorPicture = mirrorPicture
	pictureGap = function(p, q)
		do return Math.min(pictureDistance(p, q), pictureDistance(mirrorPicture(p), q)) end
	end
	exports.pictureGap = pictureGap
	setVisitSalt = function(v)
		visitSalt = v
	end
	exports.setVisitSalt = setVisitSalt
	saltFor = function(o)
		if (not o.memory) then
			do return 0 end
		end
		if (visitSalt == nil) then
			if (Js.window == nil) then
				do return 0 end
			end
			local _ok1, _err2, _rv3 = pcall(function()
				local a = Js.typedArray(1)
				Js.crypto.getRandomValues(a)
				visitSalt = a["0"]
			end)
			if not _ok1 then
				visitSalt = math.floor((Math.random() * 2147483647))
			elseif _err2 == Js.RET then
				return _rv3
			end
		end
		do return Js.ushr(visitSalt, 0) end
	end
	saltedRng = function(rng, salt)
		if (not Js.T(salt)) then
			do return rng end
		end
		local shift = (math.fmod(Js.ushr(salt, 0), 1000003) / 1000003)
		do return function()
			local v = (rng() + shift)
			do return (v - math.floor(v)) end
		end end
	end
	exports.saltedRng = saltedRng
	pictureMemory = function(scope)
		local m = memories:get(scope)
		if (not m) then
			m = PictureMemory.new(scope, true)
			memories:set(scope, m)
		end
		do return m end
	end
	exports.pictureMemory = pictureMemory
	servedFaults = function(sc)
		local out = Js.Set.new(M_baseScenario.scenarioFaults(sc))
		local s = M_authoredChance.sampleFromScenario(sc)
		local defs = A.filter(s.defenders, function(d)
			return (not parked(d))
		end)
		local mates = A.filter(s.mates, function(m)
			return (not parked(m))
		end)
		local bodies = Js.aspread(Js.alit(s.you), defs, mates, Js.alit(s.keeper))
		local closest = math.huge
		do
			local i = 0
			local _first4 = true
			while true do
				if not _first4 then
					i += 1
				end
				_first4 = false
				if not (i < Js.alen(bodies)) then break end
				do
					local j = (i + 1)
					local _first5 = true
					while true do
						if not _first5 then
							j += 1
						end
						_first5 = false
						if not (j < Js.alen(bodies)) then break end
						closest = Math.min(closest, hyp(bodies[i + 1], bodies[j + 1]))
					end
				end
			end
		end
		if (closest < OVERLAP_M) then
			out:add("two bodies on top of each other")
		end
		local vp = sc.viewport
		local off = function(p)
			return ((((p.x < (vp.x1 - 0.5)) or (p.x > (vp.x2 + 0.5))) or (p.y < (vp.y1 - 0.5))) or (p.y > (vp.y2 + 0.5)))
		end
		if (A.some(defs, off) or A.some(mates, off)) then
			out:add("a player outside the picture")
		end
		if off(s.ball) then
			out:add("ball outside the picture")
		end
		if off(s.you) then
			out:add("you outside the picture")
		end
		if ((M_canvasEngine.goalInView(sc.kind) and (sc.kind ~= "corner")) and (s.keeper.y > s.ball.y)) then
			out:add("keeper beyond the ball")
		end
		local set = M_authoredChance.ruleSetFor(sc.kind)
		if set then
			do
				local _arr6 = M_scenarioRules.violations(s, set)
				local _i7 = 0
				while _i7 < Js.alen(_arr6) do
					_i7 += 1
					local v = _arr6[_i7]
					out:add(("breaks its rule: " .. v))
				end
			end
		end
		local onBall = defenderOnTheBall(s, set)
		if Js.T(onBall) then
			out:add(onBall)
		end
		do return Js.Array.from(out) end
	end
	exports.servedFaults = servedFaults
	defenderOnTheBall = function(s, set)
		if ((not set) or (set.n < M_scenarioRules.MIN_SAMPLES_FOR_INVARIANT)) then
			do return nil end
		end
		local rule = A.find(set.rules, function(r)
			return (r.id == "defNearest")
		end)
		local m = A.find(M_scenarioRules.MEASURES, function(x)
			return (x.id == "defNearest")
		end)
		if ((not rule) or (not m)) then
			do return nil end
		end
		local defs = A.filter(s.defenders, function(d)
			return (not parked(d))
		end)
		if (not Js.T(Js.alen(defs))) then
			do return nil end
		end
		local v = m.of(Js.ospread(s, Js.O({ defenders = defs }, { "defenders" })))
		do return (if (v < (rule.min - 0.01)) then DEFENDER_ON_BALL else nil) end
	end
	exports.defenderOnTheBall = defenderOnTheBall
	memoryRule = function(kind)
		if IDENTICAL_ONLY:has(kind) then
			do return Js.O({ n = 1, within = 0.5 }, { "n", "within" }) end
		end
		do return Js.O({ n = PICTURE_MEMORY, within = SAME_PICTURE_M }, { "n", "within" }) end
	end
	exports.memoryRule = memoryRule
	drawingsOf = function(kind, set)
		local bad = Js.Set.new(A.map(M_scenarioRules.outliersOf(set), function(o)
			return o.id
		end))
		local all = A.filter(A.map(M_authoredChance.playPool(kind), function(ms)
			local s = M_scenarioRules.sampleFromAuthored(ms)
			do return (if s then Js.ospread(Js.O({ id = ms.id }, { "id" }), s) else nil) end
		end), function(s)
			return (not (not s))
		end)
		local clean = A.filter(all, function(s)
			return (not bad:has(s.id))
		end)
		do return (if Js.T(Js.alen(clean)) then clean else all) end
	end
	servesDrawings = function(kind)
		local set = M_authoredChance.ruleSetFor(kind)
		do return ((not (not set)) and (set.n >= M_scenarioRules.MIN_SAMPLES_FOR_INVARIANT)) end
	end
	exports.servesDrawings = servesDrawings
	mirrorSample = function(s)
		do return Js.ospread(s, Js.O({ ball = mirrorV(s.ball), you = mirrorV(s.you), keeper = mirrorV(s.keeper), defenders = A.map(s.defenders, mirrorV), mates = A.map(s.mates, mirrorV) }, { "ball", "you", "keeper", "defenders", "mates" })) end
	end
	onSide = function(s, side)
		do return (if (sideOf(s.ball) == side) then s else mirrorSample(s)) end
	end
	gauss = function(rng)
		local u = 0
		local v = 0
		while (u == 0) do
			u = rng()
		end
		while (v == 0) do
			v = rng()
		end
		do return (Math.sqrt((-2 * Math.log(u))) * Math.cos(((2 * Math.PI) * v))) end
	end
	anchor = function(p, ball)
		local dGoal = Math.hypot((p.x - M_pitch.CX), p.y)
		local dBall = hyp(p, ball)
		do return (dGoal / ((dGoal + dBall) + 0.000001)) end
	end
	carry = function(p, from, to)
		local l = anchor(p, from)
		do return Js.O({ x = (p.x + (l * (to.x - from.x))), y = (p.y + (l * (to.y - from.y))) }, { "x", "y" }) end
	end
	closestPair = function(s)
		local ps = Js.aspread(Js.alit(s.you), s.defenders, s.mates)
		local best = math.huge
		do
			local i = 0
			local _first8 = true
			while true do
				if not _first8 then
					i += 1
				end
				_first8 = false
				if not (i < Js.alen(ps)) then break end
				do
					local j = (i + 1)
					local _first9 = true
					while true do
						if not _first9 then
							j += 1
						end
						_first9 = false
						if not (j < Js.alen(ps)) then break end
						best = Math.min(best, hyp(ps[i + 1], ps[j + 1]))
					end
				end
			end
		end
		do return best end
	end
	ballInRange = function(s, set, slack)
		do
			local _arr10 = Js.alit("ballDepth", "ballLateral")
			local _i11 = 0
			while _i11 < Js.alen(_arr10) do
				_i11 += 1
				local id = _arr10[_i11]
				local r = A.find(set.rules, function(x)
					return (x.id == id)
				end)
				local m = A.find(M_scenarioRules.MEASURES, function(x)
					return (x.id == id)
				end)
				if ((not r) or (not m)) then
					do continue end
				end
				local v = m.of(s)
				if ((v < (r.min - slack)) or (v > (r.max + slack))) then
					do return false end
				end
			end
		end
		do return true end
	end
	drawingShape = function(kind, rng, stableKey, salt, side)
		if salt == nil then salt = 0 end
		local set = M_authoredChance.ruleSetFor(kind)
		if ((not set) or (set.n < M_scenarioRules.MIN_SAMPLES_FOR_INVARIANT)) then
			do return nil end
		end
		local pool = M_authoredChance.playPool(kind)
		local bad = Js.Set.new(A.map(M_scenarioRules.outliersOf(set), function(o)
			return o.id
		end))
		local clean = A.filter(pool, function(s)
			return (not bad:has(s.id))
		end)
		local from = (if Js.T(Js.alen(clean)) then clean else pool)
		local start = (if (stableKey == nil) then math.fmod((math.floor((rng() * Js.alen(from))) + salt), Js.alen(from)) else stableIndex(A.map(from, function(s)
			return s.id
		end), stableKey))
		for i = 0, (Js.alen(from)) - 1 do
			local base = from[math.fmod((start + i), Js.alen(from)) + 1]
			local shape = M_authoredChance.randomiseAuthored(base, set, rng, Js.O({ fixedBall = FIXED_BALL:has(kind) }, { "fixedBall" }))
			if (not shape) then
				do continue end
			end
			local coin = ((rng() < 0.5) ~= (Js.band(Js.ushr(salt, 16), 1) == 1))
			local mirrored = (if (side == nil) then coin else (sideOf(shape.ball) ~= side))
			do return Js.ospread((if mirrored then M_authoredChance.mirrorShape(shape) else shape), Js.O({ mirrored = mirrored }, { "mirrored" })) end
		end
		do return nil end
	end
	exports.drawingShape = drawingShape
	drawingOwnFaults = function(kind, id, mirrored)
		local set = M_authoredChance.ruleSetFor(kind)
		local ms = A.find(M_authoredChance.playPool(kind), function(x)
			return (x.id == id)
		end)
		if ((not set) or (not ms)) then
			do return Js.alit() end
		end
		local key = (kind .. "|" .. id .. "|" .. Js.numstr((if ms.updatedAt ~= nil then ms.updatedAt else 0)) .. "|" .. Js.str(mirrored) .. "|" .. Js.numstr(set.n))
		local hit = ownFaultCache:get(key)
		if hit then
			do return hit end
		end
		local counts = Js.Map.new()
		for b = 0, 2 do
			local rng = M_season.mulberry32((61453 + (b * 7919)))
			local sc = M_canvasEngine.buildScenario(kind, rng)
			local exact = M_authoredChance.randomiseAuthored(ms, set, rng, Js.O({ noNudge = true }, { "noNudge" }))
			if (not exact) then
				do continue end
			end
			M_authoredChance.applyAuthoredShape(sc, (if mirrored then M_authoredChance.mirrorShape(exact) else exact))
			M_index.setupKind(sc, rng, Js.O({ appliedAuthored = true, appliedPlan = false, keeperStrength = 62 }, { "appliedAuthored", "appliedPlan", "keeperStrength" }))
			do
				local _arr12 = servedFaults(sc)
				local _i13 = 0
				while _i13 < Js.alen(_arr12) do
					_i13 += 1
					local f = _arr12[_i13]
					counts:set(f, ((counts:get(f) or 0) + 1))
				end
			end
		end
		local own = A.map(A.filter(Js.Array.from(counts:entries()), function(_p14)
			local n = _p14[2]
			return (n >= 2)
		end), function(_p15)
			local f = _p15[1]
			return f
		end)
		ownFaultCache:set(key, own)
		do return own end
	end
	exports.drawingOwnFaults = drawingOwnFaults
	stableIndex = function(ids, key)
		local best = 0
		local bestScore = -1
		A.forEach(ids, function(id, i)
			local h = 5381
			for k = 0, (S.len(id)) - 1 do
				h = Js.ushr(Js.bxor((h * 33), S.charCodeAt(id, k)), 0)
			end
			h = Js.ushr(Js.bxor(h, Js.ushr(key, 0)), 0)
			h = Js.ushr(Math.imul(Js.bxor(h, Js.ushr(h, 16)), 2246822507), 0)
			h = Js.ushr(Math.imul(Js.bxor(h, Js.ushr(h, 13)), 3266489909), 0)
			h = Js.ushr(Js.bxor(h, Js.ushr(h, 16)), 0)
			if (h > bestScore) then
				bestScore = h
				best = i
			end
		end)
		do return best end
	end
	offeredKinds = function(kinds, req, rng)
		local out = M_switchedOffKinds.withoutSwitchedOff(kinds)
		if (((req and (req.pattern ~= "transition")) and (not req.dribble)) and A.includes(out, "one_on_one")) then
			if (rng() >= SETTLED_ONE_ON_ONE) then
				local kept = A.filter(out, function(k)
					return (k ~= "one_on_one")
				end)
				if Js.T(Js.alen(kept)) then
					out = kept
				end
			end
		end
		do return out end
	end
	makeChance = function(o)
		local rng = o.rng
		local finishServed = function(sc)
			M_bylineShort.addShortOption(sc)
			do return M_goalFrame.finishServedFrame(sc) end
		end
		local ks = ((function() local _v = o.strength; if _v == nil then return nil end; _v = _v.keeper; return _v end)() or 62)
		local tr = ((function() local _v = o.strength; if _v == nil then return nil end; _v = _v.team; return _v end)() or 60)
		local vis = ((function() local _v = o.strength; if _v == nil then return nil end; _v = _v.vision; return _v end)() or 55)
		local build = function(k)
			return M_canvasEngine.buildScenario(k, rng, ks, tr, vis)
		end
		local kind = nil
		local plan = nil
		local first = nil
		local src = o.source
		local nc = M_newChances.newChancesOn()
		local side = nil
		local rules = (if (src.from == "request") then src.request.deal else o.deal)
		local evenDeal = function()
			if (not o.selection) then
				local pool = (if rules then M_kindMix.styledRound(rules) else M_kindMix.EVEN_KINDS)
				do return pool[math.fmod(math.floor((rng() * Js.alen(pool))), Js.alen(pool)) + 1] end
			end
			if o.selection.kindBag == nil then o.selection.kindBag = M_kindMix.newKindBag() end
			do return M_kindMix.nextEvenKind(o.selection.kindBag, rng, (not (not o.realMix)), rules) end
		end
		if (nc and (src.from == "request")) then
			local r = newRequestKind(src.request, src.position, rng, o.selection)
			kind = r.kind
			side = r.side
		elseif (src.from == "request") then
			local offered = offeredKinds(src.request.kinds, src.request, rng)
			local openPlay = (((M_kindMix.EVEN_KIND_MIX and (not src.request.dribble)) and (src.request.pattern ~= "set_piece")) and (Js.alen(src.request.kinds) > 1))
			local req = (if openPlay then Js.ospread(src.request, Js.O({ kinds = Js.alit(evenDeal()) }, { "kinds" })) else Js.ospread(src.request, Js.O({ kinds = offered }, { "kinds" })))
			kind = (if openPlay then req.kinds[1] else rollKind(req, src.position, rng))
			if (not servesDrawings(kind)) then
				plan = M_scenarioSelect.selectChance(Js.O({ request = Js.ospread(req, Js.O({ kinds = Js.alit(kind) }, { "kinds" })), position = src.position, rng = saltedRng(rng, saltFor(o)), memory = (if o.selection ~= nil then o.selection else M_scenarioSelect.newSelectionMemory()), shape = (if o.formation ~= nil then o.formation else nil) }, { "request", "position", "rng", "memory", "shape" }))
			end
		elseif (src.from == "chain") then
			kind = (if M_kindMix.EVEN_KIND_MIX then evenDeal() else M_switchedOffKinds.playableKind(M_canvasEngine.chainKindFor(src.pos, rng, src.ambition), rng))
			if nc then
				side = sideOf(src.pos)
			end
		elseif (src.from == "attacking") then
			first = M_canvasEngine.buildAttackingScenario(rng, ks, tr, vis)
			kind = first.kind
		elseif (src.from == "weighted") then
			first = M_canvasEngine.buildWeightedScenario(rng, src.position, ks, tr, vis)
			kind = first.kind
		else
			kind = src.kind
			plan = (if src.plan ~= nil then src.plan else nil)
		end
		if M_switchedOffKinds.isSwitchedOff(kind) then
			kind = M_switchedOffKinds.playableKind(kind, rng)
			plan = nil
			first = nil
		end
		if (nc and (src.from ~= "kind")) then
			local k2 = drawnKindFor(kind, (if ((src.from == "request") or (src.from == "chain")) then bannedBy(rules) else nil))
			if (k2 ~= kind) then
				kind = k2
				plan = nil
				first = nil
			end
			if o.selection then
				M_kindMix.noteDealt((function() if o.selection.dealt == nil then o.selection.dealt = Js.alit() end; return o.selection.dealt end)(), kind)
			end
		end
		if (((src.from == "request") and (not src.request.dribble)) and (src.request.pattern ~= "set_piece")) then
			local real = M_realMomentHighlights.serveRealMoment(kind, rng)
			if real then
				local separated = M_spacing.separateBodies(real.sc)
				finishServed(real.sc);
				(function() local _r = o.memory; if _r == nil then return nil end; return _r:remember(pictureOf(real.sc)) end)()
				do return Js.O({ sc = real.sc, shape = nil, how = "real", appliedPlan = false, appliedAuthored = false, sourceId = real.id, faultRebuilds = 0, memoryRebuilds = 0, faults = Js.alit(), nearestRecent = math.huge, separated = separated }, { "sc", "shape", "how", "appliedPlan", "appliedAuthored", "sourceId", "faultRebuilds", "memoryRebuilds", "faults", "nearestRecent", "separated" }) end
			end
		end
		if (not servesDrawings(kind)) then
			local salt = saltFor(o)
			local prng = saltedRng(rng, salt)
			local sbuild = function(k)
				return M_canvasEngine.buildScenario(k, prng, ks, tr, vis)
			end
			local sc = nil
			local appliedPlan = false
			if (plan and (plan.kind == kind)) then
				sc = sbuild(kind)
				M_baseScenario.fixBaseScenario(sc)
				M_chanceFormula.applyChancePlan(sc, plan, prng)
				appliedPlan = true
			else
				sc = (if (Js.T(salt) and first) then sbuild(kind) else (if first ~= nil then first else sbuild(kind)))
			end
			if (not appliedPlan) then
				M_formationShape.applyFormationShape(sc, (if o.formation ~= nil then o.formation else nil))
			end
			M_index.setupKind(sc, prng, Js.O({ appliedAuthored = false, appliedPlan = appliedPlan, keeperStrength = ks }, { "appliedAuthored", "appliedPlan", "keeperStrength" }))
			local separated = M_spacing.separateBodies(sc)
			finishServed(sc)
			do return Js.O({ sc = sc, shape = nil, how = (if appliedPlan then "plan" else "builder"), appliedPlan = appliedPlan, appliedAuthored = false, sourceId = nil, faultRebuilds = 0, memoryRebuilds = 0, faults = Js.alit(), nearestRecent = math.huge, separated = separated }, { "sc", "shape", "how", "appliedPlan", "appliedAuthored", "sourceId", "faultRebuilds", "memoryRebuilds", "faults", "nearestRecent", "separated" }) end
		end
		local rule = memoryRule(kind)
		local best = nil
		local faultRebuilds = 0
		local memoryRebuilds = 0
		for attempt = 0, MAX_TRIES - 1 do
			local sc = (if ((attempt == 0) and first) then first else build(kind))
			if ((side ~= nil) and ((kind == "corner") or (kind == "byline_cross"))) then
				do
					local t = 0
					local _first16 = true
					while true do
						if not _first16 then
							t += 1
						end
						_first16 = false
						if not ((t < 8) and (sideOf(sc.ball) ~= side)) then break end
						sc = build(kind)
					end
				end
			end
			local how = "drawing"
			local own = Js.alit()
			local shape = drawingShape(kind, rng, (if (attempt == 0) then o.stableKey else nil), saltFor(o), side)
			if shape then
				own = drawingOwnFaults(kind, shape.sourceId, shape.mirrored)
			end
			if (not shape) then
				do break end
			end
			M_authoredChance.applyAuthoredShape(sc, shape)
			M_index.setupKind(sc, rng, Js.O({ appliedAuthored = true, appliedPlan = false, keeperStrength = ks }, { "appliedAuthored", "appliedPlan", "keeperStrength" }))
			local separated = M_spacing.separateBodies(sc)
			local faults = A.filter(servedFaults(sc), function(f)
				return (not A.includes(own, f))
			end)
			local gap = (if o.memory then o.memory:nearest(pictureOf(sc), rule.n) else math.huge)
			local fresh = (gap >= rule.within)
			local rank = function(f, g)
				return Js.alit((-f), (if (g >= rule.within) then 1 else 0), Math.min(g, 1000000))
			end
			local a = rank(Js.alen(faults), gap)
			local b = (if best then rank(Js.alen(best.faults), best.gap) else nil)
			local better = (((not b) or (a[1] > b[1])) or ((a[1] == b[1]) and ((a[2] > b[2]) or ((a[2] == b[2]) and (a[3] > b[3])))))
			if better then
				best = Js.O({ sc = sc, shape = shape, faults = faults, gap = gap, how = how, separated = separated }, { "sc", "shape", "faults", "gap", "how", "separated" })
			end
			if ((Js.alen(faults) == 0) and fresh) then
				do break end
			end
			if Js.T(Js.alen(faults)) then
				faultRebuilds += 1
			else
				memoryRebuilds += 1
			end
		end
		if (not best) then
			local sc = (if first ~= nil then first else build(kind))
			M_formationShape.applyFormationShape(sc, (if o.formation ~= nil then o.formation else nil))
			M_index.setupKind(sc, rng, Js.O({ appliedAuthored = false, appliedPlan = false, keeperStrength = ks }, { "appliedAuthored", "appliedPlan", "keeperStrength" }))
			local separated = M_spacing.separateBodies(sc)
			finishServed(sc)
			do return Js.O({ sc = sc, shape = nil, how = "builder", appliedPlan = false, appliedAuthored = false, sourceId = nil, faultRebuilds = faultRebuilds, memoryRebuilds = memoryRebuilds, faults = Js.alit(), nearestRecent = math.huge, separated = separated }, { "sc", "shape", "how", "appliedPlan", "appliedAuthored", "sourceId", "faultRebuilds", "memoryRebuilds", "faults", "nearestRecent", "separated" }) end
		end
		finishServed(best.sc);
		(function() local _r = o.memory; if _r == nil then return nil end; return _r:remember(pictureOf(best.sc)) end)()
		do return Js.O({ sc = best.sc, shape = best.shape, how = best.how, appliedPlan = false, appliedAuthored = true, sourceId = best.shape.sourceId, faultRebuilds = faultRebuilds, memoryRebuilds = memoryRebuilds, faults = best.faults, nearestRecent = best.gap, separated = best.separated }, { "sc", "shape", "how", "appliedPlan", "appliedAuthored", "sourceId", "faultRebuilds", "memoryRebuilds", "faults", "nearestRecent", "separated" }) end
	end
	exports.makeChance = makeChance
	positionSide = function(position)
		local p = S.toUpperCase((if position ~= nil then position else ""))
		if Js.re("^L(W|M|B|WB|F|CM|CB|AM)$", ""):test(p) then
			do return -1 end
		end
		if Js.re("^R(W|M|B|WB|F|CM|CB|AM)$", ""):test(p) then
			do return 1 end
		end
		do return 0 end
	end
	exports.positionSide = positionSide
	requestSide = function(req, position)
		if (req.lane == "left") then
			do return -1 end
		end
		if (req.lane == "right") then
			do return 1 end
		end
		local own = positionSide(position)
		do return (if (own == 0) then nil else own) end
	end
	exports.requestSide = requestSide
	bannedBy = function(rules)
		local out = Js.Set.new(((function() local _v = rules; if _v == nil then return nil end; _v = _v.exclude; return _v end)() or Js.alit()))
		local w = (if Js.T((function() local _v = rules; if _v == nil then return nil end; _v = _v.style; return _v end)()) then M_kindMix.DECK_STYLE[rules.style] else nil)
		if w then
			do
				local _arr17 = Js.Object.entries(w)
				local _i18 = 0
				while _i18 < Js.alen(_arr17) do
					_i18 += 1
					local _e19 = _arr17[_i18]
					local k = _e19[1]
					local n = _e19[2]
					if (n == 0) then
						out:add(k)
					end
				end
			end
		end
		do return out end
	end
	exports.bannedBy = bannedBy
	drawnOpenKinds = function()
		do return A.filter(M_kindMix.EVEN_KINDS, function(k)
			return servesDrawings(k)
		end) end
	end
	kindCentroid = function(kind)
		local balls = A.map(A.filter(A.map(M_authoredChance.playPool(kind), function(ms)
			return M_scenarioRules.sampleFromAuthored(ms)
		end), function(x)
			return (not (not x))
		end), function(x)
			return x.ball
		end)
		if (not Js.T(Js.alen(balls))) then
			A.push(balls, M_canvasEngine.buildScenario(kind, M_season.mulberry32(24301)).ball)
		end
		do return Js.O({ lat = mean(A.map(balls, function(b)
			return math.abs((b.x - M_pitch.CX))
		end)), depth = mean(A.map(balls, function(b)
			return b.y
		end)) }, { "lat", "depth" }) end
	end
	drawnKindFor = function(kind, banned)
		if (servesDrawings(kind) and (not (function() local _r = banned; if _r == nil then return nil end; return _r:has(kind) end)())) then
			do return kind end
		end
		local pool = (if Js.T((function() local _v = banned; if _v == nil then return nil end; _v = _v.size; return _v end)()) then A.filter(drawnOpenKinds(), function(k)
			return (not banned:has(k))
		end) else drawnOpenKinds())
		if (not Js.T(Js.alen(pool))) then
			do return kind end
		end
		local key = (kind .. "|" .. A.join(A.map(pool, function(k)
			return (k .. ":" .. Js.numstr(((function() local _v = M_authoredChance.ruleSetFor(k); if _v == nil then return nil end; _v = _v.n; return _v end)() or 0)))
		end), ",") .. "|" .. Js.numstr(((function() local _v = M_authoredChance.ruleSetFor(kind); if _v == nil then return nil end; _v = _v.n; return _v end)() or 0)) .. "|" .. (if banned then A.join(Js.Array.from(banned), ",") else ""))
		local hit = drawnKindCache:get(key)
		if Js.T(hit) then
			do return hit end
		end
		local c = kindCentroid(kind)
		local best = pool[1]
		local bestD = math.huge
		do
			local _arr20 = pool
			local _i21 = 0
			while _i21 < Js.alen(_arr20) do
				_i21 += 1
				local k = _arr20[_i21]
				local d = kindCentroid(k)
				local dist = Math.hypot((d.lat - c.lat), (d.depth - c.depth))
				if (dist < bestD) then
					bestD = dist
					best = k
				end
			end
		end
		drawnKindCache:set(key, best)
		do return best end
	end
	exports.drawnKindFor = drawnKindFor
	weighCrosses = function(ks)
		local n = Math.round((10 * NEW_CROSS_WEIGHT))
		do return A.flatMap(ks, function(k)
			return A.fill(Js.Array.new((if CROSS_KINDS:has(k) then n else 10)), k)
		end) end
	end
	crossesCapped = function(dealt)
		do return (Js.alen(A.filter(A.slice(dealt, -7), function(k)
			return CROSS_KINDS:has(k)
		end)) >= NEW_CROSS_MAX_IN_8) end
	end
	newRequestKind = function(req, position, rng, mem)
		local side = requestSide(req, position)
		local offered = offeredKinds(req.kinds, req, rng)
		local openPlay = (((not req.dribble) and (req.pattern ~= "set_piece")) and (Js.alen(req.kinds) > 1))
		local banned = bannedBy(req.deal)
		if (not openPlay) then
			do return Js.O({ kind = drawnKindFor(rollKind(Js.ospread(req, Js.O({ kinds = offered }, { "kinds" })), position, rng), banned), side = side }, { "kind", "side" }) end
		end
		local swap = function(ks)
			return A.map(A.filter(M_switchedOffKinds.withoutSwitchedOff(ks), function(k)
				return (not banned:has(k))
			end), function(k)
				return drawnKindFor(k, banned)
			end)
		end
		local zoneKinds = function(z)
			return A.filter(Js.Array.from(Js.Set.new(swap(Js.aspread(M_hiddenMatch.kindsForZone(z, "centre"), M_hiddenMatch.kindsForZone(z, "left"))))), function(k)
				return (k ~= "one_on_one")
			end)
		end
		local zi = A.indexOf(ZONES, req.zone)
		local near = A.filter(Js.alit(ZONES[(zi + 1) + 1], ZONES[zi]), function(z)
			return (not (not Js.T(z)))
		end)
		local wider = Js.alit(zoneKinds(req.zone), Js.Array.from(Js.Set.new(A.flatMap(near, zoneKinds))))
		local dealt = ((function() local _v = mem; if _v == nil then return nil end; _v = _v.dealt; return _v end)() or Js.alit())
		local off = weighCrosses(swap(offered))
		local wid = A.map(wider, weighCrosses)
		if crossesCapped(dealt) then
			local noCross = function(ks)
				return A.filter(ks, function(k)
					return (not CROSS_KINDS:has(k))
				end)
			end
			local offC = noCross(off)
			local widC = A.map(wid, noCross)
			if A.some(Js.aspread(Js.alit(offC), widC), function(ks)
				return A.some(ks, function(k)
					return M_kindMix.guardAllows(k, dealt)
				end)
			end) then
				do return Js.O({ kind = M_kindMix.guardedDeal(offC, widC, dealt, rng), side = side }, { "kind", "side" }) end
			end
		end
		do return Js.O({ kind = M_kindMix.guardedDeal(off, wid, dealt, rng), side = side }, { "kind", "side" }) end
	end
	rollKind = function(req, position, rng)
		local prior = (M_scenarioSelect.FREQ[(req.zone .. "|" .. (if ((if req.lane ~= nil then req.lane else "centre") == "centre") then "centre" else "wide"))] or Js.O({}, nil))
		local pool = Js.alit()
		do
			local _arr22 = req.kinds
			local _i23 = 0
			while _i23 < Js.alen(_arr22) do
				_i23 += 1
				local k = _arr22[_i23]
				local entries = Math.max(1, Math.round(((if prior[k] ~= nil then prior[k] else 0.5) * 4)))
				for i = 0, math.ceil(entries) - 1 do
					A.push(pool, k)
				end
			end
		end
		do return M_canvasEngine.pickScenarioKindFrom(position, rng, pool) end
	end
	exports.rollKind = rollKind
	buildDrawnSim = function(kind, seed)
		do return makeChance(Js.O({ source = Js.O({ from = "kind", kind = kind }, { "from", "kind" }), rng = M_season.mulberry32(seed), memory = nil, stableKey = seed }, { "source", "rng", "memory", "stableKey" })) end
	end
	exports.buildDrawnSim = buildDrawnSim
	nextDrawnSeed = function(kind, rng, memory)
		local rule = memoryRule(kind)
		local best = nil
		local tries = 0
		do
			local _first24 = true
			while true do
				if not _first24 then
					tries += 1
				end
				_first24 = false
				if not (tries < MAX_TRIES) then break end
				local seed = (math.floor((rng() * 2000000000)) + 1)
				local made = buildDrawnSim(kind, seed)
				local gap = memory:nearest(pictureOf(made.sc), rule.n)
				if ((not best) or (gap > best.gap)) then
					best = Js.O({ seed = seed, made = made, gap = gap }, { "seed", "made", "gap" })
				end
				if (gap >= rule.within) then
					do break end
				end
			end
		end
		memory:remember(pictureOf(best.made.sc))
		do return Js.O({ seed = best.seed, made = best.made, tries = tries }, { "seed", "made", "tries" }) end
	end
	exports.nextDrawnSeed = nextDrawnSeed
	simIsMadeHere = function(kind)
		do return servesDrawings(kind) end
	end
	exports.simIsMadeHere = simIsMadeHere
	nearestDrawing = function(pic)
		local set = M_authoredChance.ruleSetFor(pic.kind)
		if (not set) then
			do return nil end
		end
		local best = nil
		do
			local _arr25 = drawingsOf(pic.kind, set)
			local _i26 = 0
			while _i26 < Js.alen(_arr25) do
				_i26 += 1
				local d = _arr25[_i26]
				local dp = Js.O({ kind = pic.kind, ball = d.ball, you = d.you, keeper = d.keeper, defenders = d.defenders, mates = d.mates, cam = pic.cam }, { "kind", "ball", "you", "keeper", "defenders", "mates", "cam" })
				local g = pictureGap(Js.ospread(pic), dp)
				if ((not best) or (g < best.gap)) then
					best = Js.O({ id = d.id, gap = g }, { "id", "gap" })
				end
			end
		end
		do return best end
	end
	exports.nearestDrawing = nearestDrawing
	PICTURE_MEMORY = 5
	exports.PICTURE_MEMORY = PICTURE_MEMORY
	parked = function(p)
		return ((((p.x < -50) or (p.x > (M_pitch.PITCH_W + 50))) or (p.y > 150)) or (p.y < -50))
	end
	hyp = function(a, b)
		return Math.hypot((a.x - b.x), (a.y - b.y))
	end
	mean = function(a)
		return (if Js.T(Js.alen(a)) then (A.reduce(a, function(s, x)
			return (s + x)
		end, 0) / Js.alen(a)) else 0)
	end
	r1 = function(v)
		return (Math.round((v * 10)) / 10)
	end
	pt = function(p)
		return Js.O({ x = r1(p.x), y = r1(p.y) }, { "x", "y" })
	end
	SAME_PICTURE_M = 3
	exports.SAME_PICTURE_M = SAME_PICTURE_M
	samePicture = function(p, q)
		return (pictureGap(p, q) < SAME_PICTURE_M)
	end
	exports.samePicture = samePicture
	MEMORY_KEEP = 20
	PictureMemory = {}
	PictureMemory.__jsclass = true
	PictureMemory.__index = PictureMemory
	PictureMemory.new = function(scope, persist)
		local self = setmetatable({}, PictureMemory)
		self.scope = scope
		self.persist = persist
		self["byKind"] = Js.O({}, nil)
		self["loaded"] = false
		return self
	end
	PictureMemory["key"] = function(self)
		do return ("star-chance-memory-v1:" .. self.scope) end
	end
	PictureMemory["load"] = function(self)
		if self.loaded then
			do return end
		end
		self.loaded = true
		if (not self.persist) then
			do return end
		end
		local _ok27, _err28, _rv29 = pcall(function()
			local raw = (if (Js.window ~= nil) then Js.window.localStorage.getItem(self:key()) else nil)
			if Js.T(raw) then
				local o = Js.JSON.parse(raw)
				if (Js.T(o) and (type(o) == "table")) then
					self.byKind = o
				end
			end
		end)
		if not _ok27 then
		elseif _err28 == Js.RET then
			return _rv29
		end
	end
	PictureMemory["save"] = function(self)
		if (not self.persist) then
			do return end
		end
		local _ok30, _err31, _rv32 = pcall(function()
			if (Js.window ~= nil) then
				Js.window.localStorage.setItem(self:key(), Js.JSON.stringify(self.byKind))
			end
		end)
		if not _ok30 then
			local _ok33, _err34, _rv35 = pcall(function()
				local small = Js.O({}, nil)
				do
					local _arr36 = Js.Object.entries(self.byKind)
					local _i37 = 0
					while _i37 < Js.alen(_arr36) do
						_i37 += 1
						local _e38 = _arr36[_i37]
						local k = _e38[1]
						local v = _e38[2]
						small[k] = (if Js.Array.isArray(v) then A.slice(v, (-PICTURE_MEMORY)) else Js.alit())
					end
				end
				if (Js.window ~= nil) then
					Js.window.localStorage.setItem(self:key(), Js.JSON.stringify(small))
				end
			end)
			if not _ok33 then
			elseif _err34 == Js.RET then
				return _rv35
			end
		elseif _err31 == Js.RET then
			return _rv32
		end
	end
	PictureMemory["recent"] = function(self, kind)
		self:load()
		do return (if self.byKind[kind] ~= nil then self.byKind[kind] else Js.alit()) end
	end
	PictureMemory["nearest"] = function(self, pic, n)
		if (n <= 0) then
			do return math.huge end
		end
		local list = A.slice(self:recent(pic.kind), (-n))
		do return (if Js.T(Js.alen(list)) then Math.min(Js.unpack(A.map(list, function(q)
			return pictureGap(pic, q)
		end))) else math.huge) end
	end
	PictureMemory["hits"] = function(self, pic, n)
		do return (self:nearest(pic, n) < SAME_PICTURE_M) end
	end
	PictureMemory["remember"] = function(self, pic)
		self:load()
		local list = Js.aspread((if self.byKind[pic.kind] ~= nil then self.byKind[pic.kind] else Js.alit()), Js.alit(pic))
		self.byKind[pic.kind] = A.slice(list, (-MEMORY_KEEP))
		self:save()
	end
	PictureMemory["clear"] = function(self)
		self.byKind = Js.O({}, nil)
		self.loaded = true
		self:save()
	end
	exports.PictureMemory = PictureMemory
	visitSalt = nil
	memories = Js.Map.new()
	OVERLAP_M = 0.95
	DEFENDER_ON_BALL = "a defender nearer the ball than any drawing puts one"
	exports.DEFENDER_ON_BALL = DEFENDER_ON_BALL
	FIXED_BALL = Js.Set.new(Js.alit("corner"))
	IDENTICAL_ONLY = Js.Set.new(Js.alit("penalty"))
	MAX_TRIES = 10
	exports.MAX_TRIES = MAX_TRIES
	mirrorV = function(v)
		return Js.O({ x = (M_pitch.PITCH_W - v.x), y = v.y }, { "x", "y" })
	end
	sideOf = function(p)
		return (if (p.x >= M_pitch.CX) then 1 else -1)
	end
	exports.sideOf = sideOf
	clamp = function(v, lo, hi)
		return (if (v < lo) then lo else (if (v > hi) then hi else v))
	end
	inPitch = function(p)
		return Js.O({ x = clamp(p.x, 1, (M_pitch.PITCH_W - 1)), y = clamp(p.y, 0.5, 100) }, { "x", "y" })
	end
	DEFAULT_CAMERA = Js.O({ centerX = M_pitch.CX, centerY = 17, viewHeight = 42, facing = "up" }, { "centerX", "centerY", "viewHeight", "facing" })
	ownFaultCache = Js.Map.new()
	SETTLED_ONE_ON_ONE = 0.1
	exports.SETTLED_ONE_ON_ONE = SETTLED_ONE_ON_ONE
	ZONES = Js.alit("own_box", "defensive", "middle", "attacking", "box")
	drawnKindCache = Js.Map.new()
	NEW_CROSS_MAX_IN_8 = 2
	exports.NEW_CROSS_MAX_IN_8 = NEW_CROSS_MAX_IN_8
	NEW_CROSS_WEIGHT = 0.6
	exports.NEW_CROSS_WEIGHT = NEW_CROSS_WEIGHT
	CROSS_KINDS = Js.Set.new(Js.alit("byline_cross", "cutback"))
end
