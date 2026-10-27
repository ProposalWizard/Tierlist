--!nocheck
--!nolint
-- Generated from lib/star/chanceFormula.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_pitch = import("lib/star/pitch")
	local M_formationShape = import("lib/star/formationShape")
	local M_canvasEngine = import("lib/star/canvasEngine")
	local M_baseScenario = import("lib/star/baseScenario")
	local clamp, U, pick, DISTANCE_M, LATERAL_M, ENGAGE_M, KEEPER_M, FIXED_VIEW_H, FIXED_VIEW_W, FRAME_MIN_H, KEEPER_MUST_BE_SEEN, ZOOM_H, DEFENDERS_IN_BOX, PARAM_SPACE, COUPLING, TITLE, nameOf, FILTER_RULES, CACHE, paramsOf, generateSpace, building, warmChanceSpace, buildSpace, allPlans, generateChance, ZONE_BANDS, VIEW_ASPECT, INSET, KIND_BALL_LIMITS, KIND_MIN_LATERAL, SHOOTER_KINDS, YOU_SHOOT_KINDS, TEAMMATE_LANE_R, BOX_KINDS, isBoxChance, frameFor, applyChancePlan, closeTheLine, SHOT_LANE_R, tidyBlock, spaceOut, coverCentre, clearShotLane, placeAttackers, buildChance, planFaults, withShape
	nameOf = function(p)
		local kind = S.replace(p.kind, Js.re("_", "g"), " ")
		do return (((S.toUpperCase(S.idx(kind, 0)) .. S.slice(kind, 1) .. " — " .. TITLE[p.distance] .. ", ") .. ((if (p.side < 0) then "left " else "right ") .. TITLE[p.lateral] .. ", " .. TITLE[p.engagement] .. ", ")) .. (TITLE[p.pattern] .. ", back " .. Js.numstr(p.backLine) .. " (" .. p.zoom .. " frame)")) end
	end
	paramsOf = function(v)
		local _d1 = DISTANCE_M[v.distance]
		local dLo = _d1[1]
		local dHi = _d1[2]
		local _d2 = LATERAL_M[v.lateral]
		local xLo = _d2[1]
		local xHi = _d2[2]
		local by = ((dLo + dHi) / 2)
		local bx = clamp((M_pitch.CX + (v.side * ((xLo + xHi) / 2))), 1, (M_pitch.PITCH_W - 1))
		do return Js.O({ params = v, kind = v.kind, name = nameOf(v), signature = (v.kind .. "|" .. v.distance .. "|" .. v.lateral .. "|" .. v.pattern), id = A.join(Js.alit(v.kind, v.distance, v.lateral, (if (v.side > 0) then "R" else "L"), v.engagement, v.keeper, v.pattern, v.zoom, v.anchor, v.strength, ("b" .. Js.numstr(v.backLine))), "|"), ball = Js.O({ x = bx, y = by }, { "x", "y" }), lineY = (by * 0.66), span = (clamp((16 + (by * 0.22)), 16, 25) * (if (v.backLine == 5) then 1.28 else 1)), blockShift = clamp(((bx - M_pitch.CX) * 0.4), -8, 8), keeperY = ((KEEPER_M[v.keeper][1] + KEEPER_M[v.keeper][2]) / 2) }, { "params", "kind", "name", "signature", "id", "ball", "lineY", "span", "blockShift", "keeperY" }) end
	end
	generateSpace = function()
		if CACHE then
			do return CACHE end
		end
		local gen = (if building ~= nil then building else buildSpace())
		building = nil
		while (not gen:next().done) do
		end
		do return CACHE end
	end
	exports.generateSpace = generateSpace
	warmChanceSpace = function(sliceMs)
		if sliceMs == nil then sliceMs = 6 end
		local step
		if ((CACHE or building) or (Js.setTimeout == nil)) then
			do return end
		end
		local gen = buildSpace()
		building = gen
		step = function()
			if (building ~= gen) then
				do return end
			end
			local t0 = Js.Date.now()
			while ((Js.Date.now() - t0) < sliceMs) do
				if gen:next().done then
					building = nil
					do return end
				end
			end
			Js.setTimeout(step, 0)
		end
		Js.setTimeout(step, 0)
	end
	exports.warmChanceSpace = warmChanceSpace
	buildSpace = function()
		return Js.gen(function()
			local plans = Js.alit()
			local rejectedBy = Js.O({}, nil)
			local byKind = Js.O({}, nil)
			do
				local _arr3 = FILTER_RULES
				local _i4 = 0
				while _i4 < Js.alen(_arr3) do
					_i4 += 1
					local r = _arr3[_i4]
					rejectedBy[r.id] = 0
				end
			end
			local crossings = 0
			do
				local _arr5 = PARAM_SPACE.kind
				local _i6 = 0
				while _i6 < Js.alen(_arr5) do
					_i6 += 1
					local kind = _arr5[_i6]
					do
						local _arr7 = PARAM_SPACE.distance
						local _i8 = 0
						while _i8 < Js.alen(_arr7) do
							_i8 += 1
							local distance = _arr7[_i8]
							local _ = coroutine.yield(nil)
							do
								local _arr9 = PARAM_SPACE.lateral
								local _i10 = 0
								while _i10 < Js.alen(_arr9) do
									_i10 += 1
									local lateral = _arr9[_i10]
									do
										local _arr11 = PARAM_SPACE.side
										local _i12 = 0
										while _i12 < Js.alen(_arr11) do
											_i12 += 1
											local side = _arr11[_i12]
											do
												local _arr13 = PARAM_SPACE.engagement
												local _i14 = 0
												while _i14 < Js.alen(_arr13) do
													_i14 += 1
													local engagement = _arr13[_i14]
													do
														local _arr15 = PARAM_SPACE.keeper
														local _i16 = 0
														while _i16 < Js.alen(_arr15) do
															_i16 += 1
															local keeper = _arr15[_i16]
															do
																local _arr17 = PARAM_SPACE.pattern
																local _i18 = 0
																while _i18 < Js.alen(_arr17) do
																	_i18 += 1
																	local pattern = _arr17[_i18]
																	do
																		local _arr19 = PARAM_SPACE.zoom
																		local _i20 = 0
																		while _i20 < Js.alen(_arr19) do
																			_i20 += 1
																			local zoom = _arr19[_i20]
																			do
																				local _arr21 = PARAM_SPACE.anchor
																				local _i22 = 0
																				while _i22 < Js.alen(_arr21) do
																					_i22 += 1
																					local anchor = _arr21[_i22]
																					do
																						local _arr23 = PARAM_SPACE.strength
																						local _i24 = 0
																						while _i24 < Js.alen(_arr23) do
																							_i24 += 1
																							local strength = _arr23[_i24]
																							do
																								local _arr25 = PARAM_SPACE.backLine
																								local _i26 = 0
																								while _i26 < Js.alen(_arr25) do
																									_i26 += 1
																									local backLine = _arr25[_i26]
																									crossings += 1
																									local v = Js.O({ kind = kind, distance = distance, lateral = lateral, side = side, engagement = engagement, keeper = keeper, pattern = pattern, zoom = zoom, anchor = anchor, strength = strength, backLine = backLine }, { "kind", "distance", "lateral", "side", "engagement", "keeper", "pattern", "zoom", "anchor", "strength", "backLine" })
																									local rejected = ""
																									do
																										local _arr27 = FILTER_RULES
																										local _i28 = 0
																										while _i28 < Js.alen(_arr27) do
																											_i28 += 1
																											local rule = _arr27[_i28]
																											if (not rule.test(v)) then
																												rejected = rule.id
																												do break end
																											end
																										end
																									end
																									if Js.T(rejected) then
																										rejectedBy[rejected] += 1
																										do continue end
																									end
																									A.push(plans, paramsOf(v))
																									byKind[kind] = ((if byKind[kind] ~= nil then byKind[kind] else 0) + 1)
																								end
																							end
																						end
																					end
																				end
																			end
																		end
																	end
																end
															end
														end
													end
												end
											end
										end
									end
								end
							end
						end
					end
				end
			end
			CACHE = Js.O({ plans = plans, report = Js.O({ crossings = crossings, survivors = Js.alen(plans), rejectedBy = rejectedBy, byKind = byKind }, { "crossings", "survivors", "rejectedBy", "byKind" }) }, { "plans", "report" })
		end)
	end
	allPlans = function()
		do return generateSpace().plans end
	end
	exports.allPlans = allPlans
	generateChance = function(req, ctx, rng, recent)
		if recent == nil then recent = Js.alit() end
		local bands = (if ZONE_BANDS[req.zone] ~= nil then ZONE_BANDS[req.zone] else Js.alit())
		if (Js.alen(bands) == 0) then
			do return nil end
		end
		local wantPattern = (if (req.pattern == "transition") then "transition" else "settled")
		local laneSide = (if (req.lane == "left") then -1 else (if (req.lane == "right") then 1 else 0))
		local pool = A.filter(allPlans(), function(p)
			return (((A.includes(req.kinds, p.kind) and A.includes(bands, p.params.distance)) and (p.params.pattern == wantPattern)) and (if (laneSide == 0) then ((p.params.lateral == "centre") or (p.params.lateral == "half_space")) else (p.params.side == laneSide)))
		end)
		if (Js.alen(pool) == 0) then
			do return nil end
		end
		local banned = Js.Set.new(A.slice(recent, 0, 3))
		local fresh = A.filter(pool, function(p)
			return (not banned:has(p.signature))
		end)
		local from = fresh
		if (Js.alen(from) == 0) then
			local prev = recent[1]
			from = A.filter(pool, function(p)
				return (p.signature ~= prev)
			end)
			if (Js.alen(from) == 0) then
				do return nil end
			end
		end
		local best = pick(rng, from)
		for i = 0, 3 do
			if (not A.includes(A.slice(recent, 0, 1), best.signature)) then
				do break end
			end
			best = pick(rng, from)
		end
		do return best end
	end
	exports.generateChance = generateChance
	isBoxChance = function(kind, band)
		do return ((BOX_KINDS:has(kind) or (band == "six")) or (band == "golden")) end
	end
	frameFor = function(plan, ball, keeper)
		local h = ZOOM_H[plan.params.zoom]
		local w = (h * VIEW_ASPECT)
		local anchorY = (if (plan.params.anchor == "ball") then ball.y else (if (plan.params.anchor == "goal") then 0 else ((ball.y + 0) / 2)))
		local anchorX = (if (plan.params.anchor == "goal") then M_pitch.CX else (if (plan.params.anchor == "ball") then ball.x else ((ball.x + M_pitch.CX) / 2)))
		local y1 = (anchorY - (h * 0.55))
		local y2 = (y1 + h)
		local x1 = (anchorX - (w / 2))
		local x2 = (x1 + w)
		local padX = 6
		local backPad = (M_pitch.NET_DEPTH + 2.5)
		local fwdPad = 6
		if (x1 < (-padX)) then
			local s = ((-padX) - x1)
			x1 += s
			x2 += s
		end
		if (x2 > (M_pitch.PITCH_W + padX)) then
			local s = (x2 - (M_pitch.PITCH_W + padX))
			x1 -= s
			x2 -= s
		end
		if (y1 < (-backPad)) then
			local s = ((-backPad) - y1)
			y1 += s
			y2 += s
		end
		if (y2 > (M_pitch.HALF_LEN + fwdPad)) then
			local s = (y2 - (M_pitch.HALF_LEN + fwdPad))
			y1 -= s
			y2 -= s
		end
		local need = 2.2
		if (ball.x < (x1 + need)) then
			local s = ((x1 + need) - ball.x)
			x1 -= s
			x2 -= s
		end
		if (ball.x > (x2 - need)) then
			local s = (ball.x - (x2 - need))
			x1 += s
			x2 += s
		end
		if (ball.y < (y1 + need)) then
			local s = ((y1 + need) - ball.y)
			y1 -= s
			y2 -= s
		end
		local floor = (y2 - ((y2 - y1) * 0.22))
		if (ball.y > floor) then
			local s = (ball.y - floor)
			y1 += s
			y2 += s
		end
		if keeper then
			if (keeper.x < (x1 + 1.6)) then
				local s = ((x1 + 1.6) - keeper.x)
				x1 -= s
				x2 -= s
			elseif (keeper.x > (x2 - 1.6)) then
				local s = (keeper.x - (x2 - 1.6))
				x1 += s
				x2 += s
			end
			if (keeper.y < (y1 + 1.2)) then
				local s = ((y1 + 1.2) - keeper.y)
				y1 -= s
				y2 -= s
			end
		end
		if (ball.x < (x1 + need)) then
			local s = ((x1 + need) - ball.x)
			x1 -= s
			x2 -= s
		end
		if (ball.x > (x2 - need)) then
			local s = (ball.x - (x2 - need))
			x1 += s
			x2 += s
		end
		if (ball.y < (y1 + need)) then
			local s = ((y1 + need) - ball.y)
			y1 -= s
			y2 -= s
		end
		local floor2 = (y2 - ((y2 - y1) * 0.22))
		if (ball.y > floor2) then
			local s = (ball.y - floor2)
			y1 += s
			y2 += s
		end
		do return Js.O({ x1 = x1, x2 = x2, y1 = y1, y2 = y2 }, { "x1", "x2", "y1", "y2" }) end
	end
	exports.frameFor = frameFor
	applyChancePlan = function(sc, plan, rng)
		if rng == nil then rng = Math.random end
		local p = plan.params
		local turned = ((sc.facing == "left") or (sc.facing == "right"))
		local _d29 = DISTANCE_M[p.distance]
		local dLo = _d29[1]
		local dHi = _d29[2]
		local _d30 = LATERAL_M[p.lateral]
		local xLo = _d30[1]
		local xHi = _d30[2]
		local _d31 = (if KIND_BALL_LIMITS[sc.kind] ~= nil then KIND_BALL_LIMITS[sc.kind] else Js.alit(0, 60))
		local kLo = _d31[1]
		local kHi = _d31[2]
		local by = clamp(U(rng, (dLo + 0.5), (dHi - 0.5)), kLo, kHi)
		local latMin = (if KIND_MIN_LATERAL[sc.kind] ~= nil then KIND_MIN_LATERAL[sc.kind] else 0)
		local bx = clamp((M_pitch.CX + (p.side * Math.max(latMin, U(rng, xLo, xHi)))), 1.5, (M_pitch.PITCH_W - 1.5))
		if (not turned) then
			local dx = (sc.player.x - sc.ball.x)
			local dy = (sc.player.y - sc.ball.y)
			sc.ball = Js.O({ x = bx, y = by }, { "x", "y" })
			sc.player = Js.O({ x = clamp((bx + dx), 1, (M_pitch.PITCH_W - 1)), y = Math.max(0.4, (by + dy)) }, { "x", "y" })
		end
		local ballX = sc.ball.x
		local ballY = sc.ball.y
		local ballDist = clamp(ballY, 2, 45)
		local shaped = (if plan.ctxShape then M_formationShape.targetBlock(plan.ctxShape, ballX, ballY) else nil)
		local rawLineY = clamp((if shaped then shaped.lineY else (ballDist * 0.66)), 3.2, Math.max(4, (ballDist - 2)))
		local lineY = M_formationShape.onTheBoxEdge(rawLineY, ballDist, 3.2)
		local span = (if shaped then shaped.span else (M_formationShape.backSpan(ballDist) * (if (p.backLine == 5) then 1.28 else 1)))
		local shift = (if shaped then shaped.blockShift else clamp(((ballX - M_pitch.CX) * M_formationShape.BLOCK_SHIFT), -8, 8))
		local n = Js.alen(sc.defenders)
		if ((n > 0) and (not turned)) then
			local backN = Math.min(n, p.backLine)
			local gap = clamp((span / Math.max(1, (p.backLine - 1))), 3.2, 8.6)
			local useSpan = (gap * Math.max(1, (backN - 1)))
			if (p.pattern == "transition") then
				local keep = Math.max(1, Math.min(n, 2))
				for i = 0, n - 1 do
					local d = sc.defenders[i + 1]
					if (i < keep) then
						local frac = (if (keep <= 1) then 0.5 else (i / (keep - 1)))
						d.x = clamp(((M_pitch.CX + shift) + ((((frac - 0.5) * gap) * Math.max(1, (keep - 1))) * 1.3)), 2, (M_pitch.PITCH_W - 2))
						d.y = clamp((lineY + U(rng, -3, 3)), 3, Math.max(3.5, (ballDist - 1.4)))
					else
						local s = (if (rng() < 0.5) then -1 else 1)
						d.x = clamp((ballX + (s * U(rng, 3, 7))), 2, (M_pitch.PITCH_W - 2))
						d.y = (ballY + U(rng, 3, 8))
					end
				end
			elseif isBoxChance(sc.kind, p.distance) then
				local slots = Js.alit(Js.O({ x = (M_pitch.CX + (p.side * U(rng, 2.5, 3.6))), y = U(rng, 1, 3) }, { "x", "y" }), Js.O({ x = clamp((sc.player.x + (p.side * U(rng, 0.5, 1.5))), 3, (M_pitch.PITCH_W - 3)), y = Math.max(0.8, (sc.player.y - U(rng, 0.5, 1.5))) }, { "x", "y" }), Js.O({ x = (M_pitch.CX + (p.side * U(rng, 0, 2))), y = U(rng, 9, 11.5) }, { "x", "y" }), Js.O({ x = (M_pitch.CX - (p.side * U(rng, 3, 4.5))), y = U(rng, 2, 5) }, { "x", "y" }), Js.O({ x = (M_pitch.CX + (p.side * U(rng, 3, 6))), y = U(rng, 12, 15) }, { "x", "y" }), Js.O({ x = (M_pitch.CX - (p.side * U(rng, 0, 4))), y = U(rng, 6, 9) }, { "x", "y" }), Js.O({ x = (M_pitch.CX + U(rng, -5, 5)), y = U(rng, 16.5, 19) }, { "x", "y" }))
				local useSlots = (if ((sc.kind == "tight_angle") or (sc.kind == "cutback")) then A.slice(slots, 1) else slots)
				for i = 0, n - 1 do
					local s = useSlots[math.fmod(i, Js.alen(useSlots)) + 1]
					sc.defenders[i + 1].x = clamp(s.x, 2, (M_pitch.PITCH_W - 2))
					sc.defenders[i + 1].y = clamp(s.y, 1, 20)
				end
			else
				for i = 0, n - 1 do
					local d = sc.defenders[i + 1]
					if (i < backN) then
						local frac = (if (backN <= 1) then 0.5 else (i / (backN - 1)))
						local fromCentre = (math.abs((frac - 0.5)) * 2)
						d.x = clamp(((M_pitch.CX + shift) + ((frac - 0.5) * useSpan)), 2, (M_pitch.PITCH_W - 2))
						d.y = clamp(((lineY - 1.2) + (fromCentre * 2.4)), 3, Math.max(3.5, (ballDist - 1.4)))
					else
						local wideChance = ((p.lateral == "wide") or (p.lateral == "touchline"))
						d.x = clamp(((M_pitch.CX + (shift * 0.6)) + (if wideChance then (p.side * 4) else U(rng, -3, 3))), 2, (M_pitch.PITCH_W - 2))
						d.y = clamp((lineY + U(rng, 3, 7)), 3.5, Math.max(4, (ballDist - 1.2)))
					end
				end
			end
			if (p.engagement ~= "free") then
				local e = U(rng, ENGAGE_M[p.engagement][1], ENGAGE_M[p.engagement][2])
				local toGoalX = (M_pitch.CX - ballX)
				local toGoalY = (-ballY)
				local len = (function() local _l = Math.hypot(toGoalX, toGoalY); if Js.T(_l) then return _l end; return 1 end)()
				local showSide = (if ((p.lateral == "centre") or (p.lateral == "half_space")) then p.side else (-p.side))
				local near = sc.defenders[1]
				do
					local _arr32 = sc.defenders
					local _i33 = 0
					while _i33 < Js.alen(_arr32) do
						_i33 += 1
						local d = _arr32[_i33]
						if (Math.hypot((d.x - ballX), (d.y - ballY)) < Math.hypot((near.x - ballX), (near.y - ballY))) then
							near = d
						end
					end
				end
				near.x = clamp(((ballX + ((toGoalX / len) * e)) + (showSide * 1.2)), 2, (M_pitch.PITCH_W - 2))
				near.y = clamp((ballY + ((toGoalY / len) * e)), 1.2, Math.max(1.5, (ballY - 0.8)))
			end
		end
		local KEEPER_IS_THE_CHANCE = ((sc.kind == "one_on_one") or (sc.kind == "tight_angle"))
		if ((not turned) and (not KEEPER_IS_THE_CHANCE)) then
			local kY = U(rng, KEEPER_M[p.keeper][1], KEEPER_M[p.keeper][2])
			sc.keeper.y = clamp(kY, 0.5, Math.max(0.6, (ballY - 1.5)))
		end
		if (not turned) then
			tidyBlock(sc, p)
		end
		placeAttackers(sc, p, rng)
		if (not turned) then
			sc.viewport = frameFor(plan, sc.ball, (if SHOOTER_KINDS:has(sc.kind) then sc.keeper else nil))
			local vp = sc.viewport
			local fx = function(x)
				return clamp(x, (vp.x1 + INSET), (vp.x2 - INSET))
			end
			local fy = function(y)
				return clamp(y, Math.max((vp.y1 + INSET), 0.3), (vp.y2 - INSET))
			end
			sc.player = Js.O({ x = fx(sc.player.x), y = fy(sc.player.y) }, { "x", "y" })
			if M_canvasEngine.goalInView(sc.kind) then
				sc.keeper.x = fx(sc.keeper.x)
				sc.keeper.startX = sc.keeper.x
			end
			if sc.runner then
				sc.runner.pos = Js.O({ x = fx(sc.runner.pos.x), y = fy(sc.runner.pos.y) }, { "x", "y" })
				sc.runner.to = Js.O({ x = fx(sc.runner.to.x), y = fy(sc.runner.to.y) }, { "x", "y" })
				sc.passTarget = Js.O({ x = sc.runner.to.x, y = sc.runner.to.y }, { "x", "y" })
			end
		end
		M_baseScenario.fixBaseScenario(sc)
		if (not turned) then
			tidyBlock(sc, p)
			M_baseScenario.fixBaseScenario(sc)
		end
		spaceOut(sc)
	end
	exports.applyChancePlan = applyChancePlan
	closeTheLine = function(sc)
		if (Js.alen(sc.defenders) < 2) then
			do return end
		end
		local deepest = Math.min(Js.unpack(A.map(sc.defenders, function(d)
			return d.y
		end)))
		local line = A.sort(A.filter(sc.defenders, function(d)
			return ((d.y - deepest) <= 4)
		end), function(a, b)
			return (a.x - b.x)
		end)
		do
			local i = 1
			local _first34 = true
			while true do
				if not _first34 then
					i += 1
				end
				_first34 = false
				if not (i < Js.alen(line)) then break end
				if ((line[i + 1].x - line[i].x) <= 10) then
					do continue end
				end
				local mid = ((line[i + 1].x + line[i].x) / 2)
				line[i].x = clamp((mid - 4.6), 1.5, (M_pitch.PITCH_W - 1.5))
				line[i + 1].x = clamp((mid + 4.6), 1.5, (M_pitch.PITCH_W - 1.5))
			end
		end
	end
	tidyBlock = function(sc, p)
		local CLEAR_BALL = 2
		local CLEAR_YOU = 1.8
		closeTheLine(sc)
		for pass = 0, 2 do
			do
				local _arr35 = sc.defenders
				local _i36 = 0
				while _i36 < Js.alen(_arr35) do
					_i36 += 1
					local d = _arr35[_i36]
					d.y = Math.max(d.y, (sc.keeper.y + 2))
					local push = function(to, want)
						local dx = (d.x - to.x)
						local dy = (d.y - to.y)
						local dist = Math.hypot(dx, dy)
						if (dist >= want) then
							do return end
						end
						local ux = (if (dist > 0.01) then (dx / dist) else (if (d.x >= M_pitch.CX) then 1 else -1))
						local uy = (if (dist > 0.01) then (dy / dist) else 1)
						d.x = clamp((to.x + (ux * want)), 1.5, (M_pitch.PITCH_W - 1.5))
						d.y = Math.max((to.y + (uy * want)), (sc.keeper.y + 2))
					end
					push(sc.ball, CLEAR_BALL)
					push(sc.player, CLEAR_YOU)
				end
			end
		end
		local skipChannel = ((sc.kind == "one_on_one") or (sc.kind == "through_ball"))
		if (((not skipChannel) and (sc.ball.y <= 24)) and (Js.alen(sc.defenders) > 0)) then
			coverCentre(sc)
		end
		local origin = sc.ball
		local GOAL_MOUTH = Js.O({ x = M_pitch.CX, y = 0 }, { "x", "y" })
		local offLine = function(d)
			local vx = (GOAL_MOUTH.x - origin.x)
			local vy = (GOAL_MOUTH.y - origin.y)
			local len2 = (function() local _l = ((vx * vx) + (vy * vy)); if Js.T(_l) then return _l end; return 1 end)()
			local t = ((((d.x - origin.x) * vx) + ((d.y - origin.y) * vy)) / len2)
			t = (if (t < 0) then 0 else (if (t > 1) then 1 else t))
			do return Math.hypot((d.x - (origin.x + (vx * t))), (d.y - (origin.y + (vy * t)))) end
		end
		local inTheWay = function(d)
			return ((offLine(d) < SHOT_LANE_R) or M_baseScenario.inShotCone(sc, d))
		end
		local stepOut = function(d)
			local vx = (GOAL_MOUTH.x - origin.x)
			local vy = (GOAL_MOUTH.y - origin.y)
			local nlen = (function() local _l = Math.hypot((-vy), vx); if Js.T(_l) then return _l end; return 1 end)()
			local nx = ((-vy) / nlen)
			local ny = (vx / nlen)
			local guard = 0
			while (inTheWay(d) and ((function() local _o = guard; guard = _o + 1; return _o end)() < 12)) do
				local t = ((((d.x - origin.x) * vx) + ((d.y - origin.y) * vy)) / (function() local _l = ((vx * vx) + (vy * vy)); if Js.T(_l) then return _l end; return 1 end)())
				t = (if (t < 0) then 0 else (if (t > 1) then 1 else t))
				local sign = (if ((((d.x - (origin.x + (vx * t))) * nx) + ((d.y - (origin.y + (vy * t))) * ny)) >= 0) then 1 else -1)
				d.x = clamp((d.x + ((sign * nx) * 0.9)), 1.5, (M_pitch.PITCH_W - 1.5))
				d.y = Math.max((d.y + ((sign * ny) * 0.9)), (sc.keeper.y + 2))
			end
		end
		do
			local _arr37 = sc.defenders
			local _i38 = 0
			while _i38 < Js.alen(_arr37) do
				_i38 += 1
				local d = _arr37[_i38]
				if (Math.hypot((d.x - origin.x), (d.y - origin.y)) > 3.5) then
					do continue end
				end
				stepOut(d)
			end
		end
		if ((sc.kind == "through_ball") or (sc.kind == "one_on_one")) then
			do
				local _arr39 = sc.defenders
				local _i40 = 0
				while _i40 < Js.alen(_arr39) do
					_i40 += 1
					local d = _arr39[_i40]
					if (offLine(d) < SHOT_LANE_R) then
						stepOut(d)
					end
				end
			end
		end
		local laneCap = (if ((sc.ball.y <= 16.5) or (sc.kind == "through_ball")) then 2 else 3)
		local laneMen = A.filter(sc.defenders, inTheWay)
		if (Js.alen(laneMen) > laneCap) then
			A.forEach(A.slice(A.sort(laneMen, function(a, b)
				return (Math.hypot((a.x - origin.x), (a.y - origin.y)) - Math.hypot((b.x - origin.x), (b.y - origin.y)))
			end), 0, (Js.alen(laneMen) - laneCap)), stepOut)
		end
	end
	spaceOut = function(sc)
		for pass = 0, 2 do
			do
				local _arr41 = sc.defenders
				local _i42 = 0
				while _i42 < Js.alen(_arr41) do
					_i42 += 1
					local d = _arr41[_i42]
					d.y = Math.max(d.y, (sc.keeper.y + 2))
					local push = function(to, want)
						local dx = (d.x - to.x)
						local dy = (d.y - to.y)
						local dist = Math.hypot(dx, dy)
						if (dist >= want) then
							do return end
						end
						local ux = (if (dist > 0.01) then (dx / dist) else (if (d.x >= M_pitch.CX) then 1 else -1))
						local uy = (if (dist > 0.01) then (dy / dist) else 1)
						d.x = clamp((to.x + (ux * want)), 1.5, (M_pitch.PITCH_W - 1.5))
						d.y = Math.max((to.y + (uy * want)), (sc.keeper.y + 2))
					end
					push(sc.ball, 2)
					push(sc.player, 1.8)
				end
			end
		end
	end
	exports.spaceOut = spaceOut
	coverCentre = function(sc)
		if A.some(sc.defenders, function(d)
			return (math.abs((d.x - M_pitch.CX)) <= 6.4)
		end) then
			do return end
		end
		local best = sc.defenders[1]
		do
			local _arr43 = sc.defenders
			local _i44 = 0
			while _i44 < Js.alen(_arr43) do
				_i44 += 1
				local d = _arr43[_i44]
				if (math.abs((d.x - M_pitch.CX)) < math.abs((best.x - M_pitch.CX))) then
					best = d
				end
			end
		end
		best.x = (M_pitch.CX + ((if (best.x >= M_pitch.CX) then 1 else -1) * 3.5))
	end
	clearShotLane = function(sc, m, onsideY)
		local o = sc.player
		if (m.y >= o.y) then
			do return end
		end
		local vx = (M_pitch.CX - o.x)
		local vy = (0 - o.y)
		local len2 = (function() local _l = ((vx * vx) + (vy * vy)); if Js.T(_l) then return _l end; return 1 end)()
		local t = ((((m.x - o.x) * vx) + ((m.y - o.y) * vy)) / len2)
		t = (if (t < 0) then 0 else (if (t > 1) then 1 else t))
		local px = (o.x + (vx * t))
		local py = (o.y + (vy * t))
		local off = Math.hypot((m.x - px), (m.y - py))
		if (off >= TEAMMATE_LANE_R) then
			do return end
		end
		local nlen = (function() local _l = Math.hypot((-vy), vx); if Js.T(_l) then return _l end; return 1 end)()
		local nx = ((-vy) / nlen)
		local ny = (vx / nlen)
		local sign = (if ((((m.x - px) * nx) + ((m.y - py) * ny)) >= 0) then 1 else -1)
		local push = ((TEAMMATE_LANE_R - off) + 0.6)
		local moved = (m.y + ((sign * ny) * push))
		m.x = clamp((m.x + ((sign * nx) * push)), 2, (M_pitch.PITCH_W - 2))
		m.y = (if (moved >= sc.ball.y) then Math.max(0.8, moved) else Math.max(Math.max(0.8, onsideY), moved))
	end
	placeAttackers = function(sc, p, rng)
		local runners = Js.aspread((if sc.runner then Js.alit(sc.runner) else Js.alit()), sc.secondaryRunners)
		if (Js.alen(runners) == 0) then
			do return end
		end
		local side = p.side
		local bd = sc.ball.y
		local spots = Js.alit()
		if (p.kind == "cutback") then
			A.push(spots, Js.O({ x = (M_pitch.CX + U(rng, -3, 3)), y = U(rng, 8, 12) }, { "x", "y" }))
			A.push(spots, Js.O({ x = (M_pitch.CX + U(rng, -1.5, 1.5)), y = U(rng, 9, 11.5) }, { "x", "y" }))
			A.push(spots, Js.O({ x = (M_pitch.CX - (side * U(rng, 0, 4))), y = U(rng, 16.5, 19) }, { "x", "y" }))
		elseif (((p.kind == "byline_cross") or (p.kind == "header")) or (p.kind == "volley")) then
			A.push(spots, Js.O({ x = (M_pitch.CX + (side * U(rng, 2.5, 4))), y = U(rng, 1.5, 4) }, { "x", "y" }))
			A.push(spots, Js.O({ x = (M_pitch.CX - (side * U(rng, 3, 5))), y = U(rng, 2, 6) }, { "x", "y" }))
			A.push(spots, Js.O({ x = (M_pitch.CX + U(rng, -1.5, 1.5)), y = U(rng, 9, 12) }, { "x", "y" }))
		elseif (p.kind == "through_ball") then
			A.push(spots, Js.O({ x = (M_pitch.CX + (side * U(rng, 0, 6))), y = Math.max(8, (bd - U(rng, 6, 12))) }, { "x", "y" }))
			A.push(spots, Js.O({ x = (M_pitch.CX - (side * U(rng, 4, 9))), y = Math.max(6, (bd - U(rng, 4, 10))) }, { "x", "y" }))
			A.push(spots, Js.O({ x = (M_pitch.CX + (side * U(rng, 6, 12))), y = Math.max(10, (bd - U(rng, 2, 8))) }, { "x", "y" }))
		else
			A.push(spots, Js.O({ x = (M_pitch.CX + (side * U(rng, 5, 9))), y = Math.max(2, (bd - U(rng, 3, 8))) }, { "x", "y" }))
			A.push(spots, Js.O({ x = (M_pitch.CX - (side * U(rng, 5, 9))), y = U(rng, 2, 6) }, { "x", "y" }))
			A.push(spots, Js.O({ x = (M_pitch.CX + (side * U(rng, 8, 14))), y = Math.max(3, (bd - U(rng, 0, 6))) }, { "x", "y" }))
		end
		local line = M_baseScenario.offsideLineOf(sc)
		local onsideY = (if (line == nil) then 0 else (line + 0.3))
		local legalY = function(y)
			return (if (y >= sc.ball.y) then y else Math.max(y, onsideY))
		end
		do
			local i = 0
			local _first45 = true
			while true do
				if not _first45 then
					i += 1
				end
				_first45 = false
				if not (i < Js.alen(runners)) then break end
				local at = spots[math.fmod(i, Js.alen(spots)) + 1]
				local to = Js.O({ x = clamp(at.x, 2, (M_pitch.PITCH_W - 2)), y = Math.max(0.8, at.y) }, { "x", "y" })
				to.y = legalY(to.y)
				runners[i + 1].to = Js.O({ x = to.x, y = to.y }, { "x", "y" })
				runners[i + 1].pos = Js.O({ x = to.x, y = legalY((to.y + 1.4)) }, { "x", "y" })
				if YOU_SHOOT_KINDS:has(p.kind) then
					clearShotLane(sc, runners[i + 1].to, onsideY)
					clearShotLane(sc, runners[i + 1].pos, onsideY)
				end
			end
		end
		if sc.runner then
			sc.passTarget = Js.O({ x = sc.runner.to.x, y = sc.runner.to.y }, { "x", "y" })
		end
		sc.follower.x = clamp((M_pitch.CX + (side * U(rng, 1.5, 5))), (M_pitch.POST_L - 3), (M_pitch.POST_R + 3))
		sc.follower.y = legalY(U(rng, M_pitch.SIX_DEPTH, 12))
		if YOU_SHOOT_KINDS:has(p.kind) then
			clearShotLane(sc, sc.follower, onsideY)
		end
	end
	buildChance = function(plan, rng, keeperStrength, teamRelationship, vision)
		if keeperStrength == nil then keeperStrength = 62 end
		if teamRelationship == nil then teamRelationship = 60 end
		if vision == nil then vision = 55 end
		local sc = M_canvasEngine.buildScenario(plan.kind, rng, keeperStrength, teamRelationship, vision)
		M_baseScenario.fixBaseScenario(sc)
		applyChancePlan(sc, plan, rng)
		do return sc end
	end
	exports.buildChance = buildChance
	planFaults = function(sc, plan)
		local out = A.filter(M_baseScenario.scenarioFaults(sc), function(f)
			return (not ((sc.kind == "through_ball") and (f == "attacker offside")))
		end)
		local vp = sc.viewport
		local inFrame = function(q)
			return ((((q.x >= (vp.x1 - 0.1)) and (q.x <= (vp.x2 + 0.1))) and (q.y >= (vp.y1 - 0.1))) and (q.y <= (vp.y2 + 0.1)))
		end
		if (not inFrame(sc.ball)) then
			A.push(out, "ball off screen")
		end
		if (not inFrame(sc.player)) then
			A.push(out, "you are off screen")
		end
		if (SHOOTER_KINDS:has(sc.kind) and ((sc.keeper.x < (vp.x1 - 0.1)) or (sc.keeper.x > (vp.x2 + 0.1)))) then
			A.push(out, "keeper off screen")
		end
		if (sc.runner and (not inFrame(sc.runner.pos))) then
			A.push(out, "the pass target is off screen")
		end
		do
			local _arr46 = sc.defenders
			local _i47 = 0
			while _i47 < Js.alen(_arr46) do
				_i47 += 1
				local d = _arr46[_i47]
				if (Math.hypot((d.x - sc.ball.x), (d.y - sc.ball.y)) < 1.4) then
					A.push(out, "defender piled on the ball")
				end
				if (Math.hypot((d.x - sc.player.x), (d.y - sc.player.y)) < 1.2) then
					A.push(out, "defender standing on you")
				end
			end
		end
		do return out end
	end
	exports.planFaults = planFaults
	withShape = function(plan, shape)
		do return Js.ospread(plan, Js.O({ ctxShape = (if shape ~= nil then shape else nil) }, { "ctxShape" })) end
	end
	exports.withShape = withShape
	clamp = function(v, lo, hi)
		return (if (v < lo) then lo else (if (v > hi) then hi else v))
	end
	U = function(rng, lo, hi)
		return (lo + (rng() * (hi - lo)))
	end
	pick = function(rng, xs)
		return xs[Math.min((Js.alen(xs) - 1), math.floor((rng() * Js.alen(xs)))) + 1]
	end
	DISTANCE_M = Js.O({ six = Js.alit(1, 5.5), golden = Js.alit(5.5, 11), spot = Js.alit(11, 16.5), edge = Js.alit(16.5, 22), range = Js.alit(22, 30), deep = Js.alit(30, 38) }, { "six", "golden", "spot", "edge", "range", "deep" })
	exports.DISTANCE_M = DISTANCE_M
	LATERAL_M = Js.O({ centre = Js.alit(0, 4), half_space = Js.alit(4, 12), wide = Js.alit(12, 20), touchline = Js.alit(20, 31) }, { "centre", "half_space", "wide", "touchline" })
	exports.LATERAL_M = LATERAL_M
	ENGAGE_M = Js.O({ pressed = Js.alit(1.5, 2.6), closing = Js.alit(3.5, 5), free = Js.alit(5.5, 9) }, { "pressed", "closing", "free" })
	exports.ENGAGE_M = ENGAGE_M
	KEEPER_M = Js.O({ set = Js.alit(0.5, 1.4), stepped = Js.alit(1.7, 3.3), out = Js.alit(4, 7) }, { "set", "stepped", "out" })
	exports.KEEPER_M = KEEPER_M
	FIXED_VIEW_H = 42
	exports.FIXED_VIEW_H = FIXED_VIEW_H
	FIXED_VIEW_W = (FIXED_VIEW_H * (5 / 8))
	exports.FIXED_VIEW_W = FIXED_VIEW_W
	FRAME_MIN_H = 28
	exports.FRAME_MIN_H = FRAME_MIN_H
	KEEPER_MUST_BE_SEEN = Js.Set.new(Js.alit("one_on_one", "tight_angle", "long_range", "volley", "header"))
	ZOOM_H = Js.O({ tight = 42, normal = 42, wide = 42 }, { "tight", "normal", "wide" })
	exports.ZOOM_H = ZOOM_H
	DEFENDERS_IN_BOX = Js.O({ six = Js.alit(4, 8), golden = Js.alit(4, 8), spot = Js.alit(3, 7), edge = Js.alit(1, 6), range = Js.alit(0, 4), deep = Js.alit(0, 2) }, { "six", "golden", "spot", "edge", "range", "deep" })
	exports.DEFENDERS_IN_BOX = DEFENDERS_IN_BOX
	PARAM_SPACE = Js.O({ kind = Js.alit("one_on_one", "tight_angle", "long_range", "volley", "header", "cutback", "byline_cross", "through_ball"), distance = Js.alit("six", "golden", "spot", "edge", "range", "deep"), lateral = Js.alit("centre", "half_space", "wide", "touchline"), side = Js.alit(-1, 1), engagement = Js.alit("pressed", "closing", "free"), keeper = Js.alit("set", "stepped", "out"), pattern = Js.alit("settled", "transition"), zoom = Js.alit("normal"), anchor = Js.alit("ball", "goal", "between"), strength = Js.alit("weak", "even", "strong"), backLine = Js.alit(4, 5) }, { "kind", "distance", "lateral", "side", "engagement", "keeper", "pattern", "zoom", "anchor", "strength", "backLine" })
	exports.PARAM_SPACE = PARAM_SPACE
	COUPLING = Js.O({ one_on_one = Js.O({ distance = Js.alit("golden", "spot", "edge"), lateral = Js.alit("centre", "half_space"), keeper = Js.alit("set", "stepped", "out"), pattern = Js.alit("settled", "transition") }, { "distance", "lateral", "keeper", "pattern" }), tight_angle = Js.O({ distance = Js.alit("six", "golden", "spot"), lateral = Js.alit("wide"), keeper = Js.alit("set"), pattern = Js.alit("settled") }, { "distance", "lateral", "keeper", "pattern" }), long_range = Js.O({ distance = Js.alit("edge", "range"), lateral = Js.alit("centre", "half_space", "wide"), keeper = Js.alit("set", "stepped"), pattern = Js.alit("settled", "transition") }, { "distance", "lateral", "keeper", "pattern" }), volley = Js.O({ distance = Js.alit("golden", "spot"), lateral = Js.alit("centre", "half_space"), keeper = Js.alit("set"), pattern = Js.alit("settled") }, { "distance", "lateral", "keeper", "pattern" }), header = Js.O({ distance = Js.alit("six", "golden"), lateral = Js.alit("centre", "half_space"), keeper = Js.alit("set"), pattern = Js.alit("settled") }, { "distance", "lateral", "keeper", "pattern" }), cutback = Js.O({ distance = Js.alit("six"), lateral = Js.alit("half_space", "wide"), keeper = Js.alit("set"), pattern = Js.alit("settled", "transition") }, { "distance", "lateral", "keeper", "pattern" }), byline_cross = Js.O({ distance = Js.alit("six", "golden"), lateral = Js.alit("wide", "touchline"), keeper = Js.alit("set"), pattern = Js.alit("settled") }, { "distance", "lateral", "keeper", "pattern" }), through_ball = Js.O({ distance = Js.alit("range", "deep"), lateral = Js.alit("centre", "half_space", "wide"), keeper = Js.alit("stepped", "out"), pattern = Js.alit("settled", "transition") }, { "distance", "lateral", "keeper", "pattern" }) }, { "one_on_one", "tight_angle", "long_range", "volley", "header", "cutback", "byline_cross", "through_ball" })
	exports.COUPLING = COUPLING
	TITLE = Js.O({ six = "six-yard", golden = "golden zone", spot = "penalty spot", edge = "edge of the box", range = "range", deep = "deep", centre = "central", half_space = "half-space", wide = "wide", touchline = "touchline", pressed = "pressed", closing = "closed down", free = "in space", set = "keeper set", stepped = "keeper stepped", out = "keeper out", tight = "tight camera", normal = "normal camera", wide2 = "wide camera", settled = "settled", transition = "on the break" }, { "six", "golden", "spot", "edge", "range", "deep", "centre", "half_space", "wide", "touchline", "pressed", "closing", "free", "set", "stepped", "out", "tight", "normal", "wide2", "settled", "transition" })
	FILTER_RULES = Js.alit(Js.O({ id = "H12-fits-the-frame", reason = ((("The camera never zooms, so a chance that cannot show the ball AND the keeper inside one " .. "fixed 26.25 m-wide frame is not a picture the game can draw. Only shooting kinds need the ") .. "keeper on screen — a through ball resolves against the runner, and demanding both would ") .. "force a 40 m-plus camera on every one of them."), test = function(p)
		if (not KEEPER_MUST_BE_SEEN:has(p.kind)) then
			do return true end
		end
		do return (LATERAL_M[p.lateral][2] <= (FIXED_VIEW_W - 3.2)) end
	end }, { "id", "reason", "test" }), Js.O({ id = "H6-kind-geometry", reason = "No headers from 35 yards, no long-range strikes from six. Each kind only where it happens (spec §1 coupling table).", test = function(p)
		local c = COUPLING[p.kind]
		do return (((not (not c)) and A.includes(c.distance, p.distance)) and A.includes(c.lateral, p.lateral)) end
	end }, { "id", "reason", "test" }), Js.O({ id = "H7-keeper-kind", reason = "A keeper rushing out is a one-on-one or a through ball, not a corner-flag cross.", test = function(p)
		return A.includes(((function() local _v = COUPLING[p.kind]; if _v == nil then return nil end; _v = _v.keeper; return _v end)() or Js.alit()), p.keeper)
	end }, { "id", "reason", "test" }), Js.O({ id = "H11-recovery-plausibility", reason = "A broken block and a whipped cross do not coexist — transition is never rolled for a header, volley or tight angle.", test = function(p)
		return A.includes(((function() local _v = COUPLING[p.kind]; if _v == nil then return nil end; _v = _v.pattern; return _v end)() or Js.alit()), p.pattern)
	end }, { "id", "reason", "test" }), Js.O({ id = "H5-lane-sanity", reason = "A presser is never inside the shot cone at close range (the volley-into-shins bug): pressed is only real from the edge out, or wide.", test = function(p)
		return ((((((p.engagement ~= "pressed") or (p.distance == "edge")) or (p.distance == "range")) or (p.distance == "deep")) or (p.lateral == "wide")) or (p.lateral == "touchline"))
	end }, { "id", "reason", "test" }), Js.O({ id = "H2-through-is-open", reason = "A one-on-one means only the keeper to beat. Being pressed is a different chance.", test = function(p)
		return ((p.kind ~= "one_on_one") or (p.engagement ~= "pressed"))
	end }, { "id", "reason", "test" }), Js.O({ id = "back5-is-a-block", reason = "A back five defends deep and in numbers — not the shape a side caught in transition is standing in.", test = function(p)
		return ((p.backLine ~= 5) or (p.pattern ~= "transition"))
	end }, { "id", "reason", "test" }), Js.O({ id = "strength-picks-a-shape", reason = "The stronger side pushes up and presses; the weaker side drops off. A heavy underdog pressing high, or a favourite giving you the freedom of the edge of its box, is not what the research shows.", test = function(p)
		return ((not ((p.strength == "weak") and (p.engagement == "pressed"))) and (not (((p.strength == "strong") and (p.engagement == "free")) and ((p.distance == "six") or (p.distance == "golden")))))
	end }, { "id", "reason", "test" }), Js.O({ id = "camera-frames-the-action", reason = "A tight frame anchored on the goal loses a ball struck from range; a wide frame on a six-yard scramble is all empty grass.", test = function(p)
		return ((not (((p.zoom == "tight") and (p.anchor == "goal")) and ((p.distance == "range") or (p.distance == "deep")))) and (not (((p.zoom == "wide") and (p.anchor == "ball")) and (p.distance == "six"))))
	end }, { "id", "reason", "test" }))
	exports.FILTER_RULES = FILTER_RULES
	CACHE = nil
	building = nil
	ZONE_BANDS = Js.O({ box = Js.alit("six", "golden", "spot"), attacking = Js.alit("spot", "edge", "range"), middle = Js.alit("range", "deep"), defensive = Js.alit(), own_box = Js.alit() }, { "box", "attacking", "middle", "defensive", "own_box" })
	exports.ZONE_BANDS = ZONE_BANDS
	VIEW_ASPECT = (5 / 8)
	INSET = 1.4
	KIND_BALL_LIMITS = Js.O({ header = Js.alit(1, 8), volley = Js.alit(4, 18), tight_angle = Js.alit(1, 15), long_range = Js.alit(17.5, 38), cutback = Js.alit(1, 6), byline_cross = Js.alit(1, 6), through_ball = Js.alit(20.5, 38) }, { "header", "volley", "tight_angle", "long_range", "cutback", "byline_cross", "through_ball" })
	KIND_MIN_LATERAL = Js.O({ tight_angle = 9.5, cutback = 8.5, byline_cross = 8.5 }, { "tight_angle", "cutback", "byline_cross" })
	SHOOTER_KINDS = Js.Set.new(Js.alit("one_on_one", "tight_angle", "long_range", "volley", "header"))
	YOU_SHOOT_KINDS = Js.Set.new(Js.alit("one_on_one", "tight_angle", "long_range"))
	TEAMMATE_LANE_R = 2.2
	BOX_KINDS = Js.Set.new(Js.alit("cutback", "byline_cross", "header", "volley", "tight_angle"))
	SHOT_LANE_R = 1.8
end
