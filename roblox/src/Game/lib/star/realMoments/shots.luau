--!nocheck
--!nolint
-- Generated from lib/star/realMoments/shots.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_pitch = import("lib/star/pitch")
	local M_airDrawings = import("lib/star/airDrawings")
	local M_types = import("lib/star/realMoments/types")
	local M_canvasEngine = import("lib/star/canvasEngine")
	local M_season = import("lib/star/season")
	local M_scenarioFrame = import("lib/star/scenarioFrame")
	local M_authoredChance = import("lib/star/authoredChance")
	local M_scenarioEdit = import("lib/star/scenarioEdit")
	local M_index = import("lib/star/kindRules/index")
	local M_keeperBrain = import("lib/star/keeperBrain")
	local P, peopleOf, blockersOf, airKindOf, kindForShot, playKindForShot, KIND_LABEL, shotKindLabel, measureOf, measureReal, measureScenario, ourMeasures, meansOf, r2, rv, FRAME_PEOPLE_M, FRAME_PAD_M, cameraFor, onScreen, frameHoldsShot, seedForShot, closeCameraFor, youAt, realOverride, placedOverride, overrideForShot, PLACED_TRIES, seedForPlaced, scenarioForShot, scenarioForCorner, scenarioForMoment, playedKeeperOff
	peopleOf = function(s)
		local keeper = nil
		local opps = Js.alit()
		local mates = Js.alit()
		do
			local _arr1 = (if s.ff ~= nil then s.ff else Js.alit())
			local _i2 = 0
			while _i2 < Js.alen(_arr1) do
				_i2 += 1
				local _e3 = _arr1[_i2]
				local x = _e3[1]
				local y = _e3[2]
				local mate = _e3[3]
				local gk = _e3[4]
				local at = Js.O({ x = x, y = y }, { "x", "y" })
				if (((not Js.T(mate)) and Js.T(gk)) and (not keeper)) then
					keeper = at
				elseif Js.T(mate) then
					A.push(mates, at)
				else
					A.push(opps, at)
				end
			end
		end
		local end_ = (if (Js.has(s, "end") and s["end"]) then P(s["end"]) else nil)
		do return Js.O({ ball = P(s.ball), ["end"] = end_, keeper = keeper, opps = opps, mates = mates }, { "ball", "end", "keeper", "opps", "mates" }) end
	end
	exports.peopleOf = peopleOf
	blockersOf = function(ball, opps)
		local a = ball
		local b = Js.O({ x = M_pitch.POST_L, y = 0 }, { "x", "y" })
		local c = Js.O({ x = M_pitch.POST_R, y = 0 }, { "x", "y" })
		local sgn = function(p, q, r)
			return (((p.x - r.x) * (q.y - r.y)) - ((q.x - r.x) * (p.y - r.y)))
		end
		do return Js.alen(A.filter(opps, function(p)
			local d1 = sgn(p, a, b)
			local d2 = sgn(p, b, c)
			local d3 = sgn(p, c, a)
			local neg = (((d1 < 0) or (d2 < 0)) or (d3 < 0))
			local pos = (((d1 > 0) or (d2 > 0)) or (d3 > 0))
			do return (not (neg and pos)) end
		end)) end
	end
	exports.blockersOf = blockersOf
	airKindOf = function(s)
		if ((s["type"] == "Penalty") or (s["type"] == "Free Kick")) then
			do return nil end
		end
		if (s.body == "Head") then
			do return "header" end
		end
		local z = s.z
		if ((type(z) ~= "number") or (not Js.NumberNS.isFinite(z))) then
			do return nil end
		end
		local bodyKnown = (s.src ~= "skillcorner")
		if (z >= M_airDrawings.AIR_HEADER_MIN_Z) then
			do return (if ((not bodyKnown) and (z <= M_airDrawings.AIR_HEADER_MAX_Z)) then "header" else "high") end
		end
		if (z >= M_airDrawings.AIR_VOLLEY_MIN_Z) then
			do return "volley" end
		end
		do return nil end
	end
	exports.airKindOf = airKindOf
	kindForShot = function(s)
		if (s["type"] == "Penalty") then
			do return "penalty" end
		end
		if (s["type"] == "Free Kick") then
			do return "free_kick" end
		end
		local air = airKindOf(s)
		if ((air == "header") or (air == "volley")) then
			do return air end
		end
		local _d4 = peopleOf(s)
		local ball = _d4.ball
		local opps = _d4.opps
		if (ball.y >= 17) then
			do return "long_range" end
		end
		if ((math.abs((ball.x - M_pitch.CX)) >= 9) and (ball.y <= 15)) then
			do return "tight_angle" end
		end
		if (not M_types.isFullyReal(s)) then
			do return (if (Js.T(s.counter) or (s.xg >= 0.3)) then "one_on_one" else "volley") end
		end
		do return (if (blockersOf(ball, opps) == 0) then "one_on_one" else "volley") end
	end
	exports.kindForShot = kindForShot
	playKindForShot = function(s)
		local k = kindForShot(s)
		if (((k == "volley") and (airKindOf(s) ~= "volley")) and M_types.isFullyReal(s)) then
			do return "one_on_one" end
		end
		do return k end
	end
	exports.playKindForShot = playKindForShot
	shotKindLabel = function(s)
		local air = airKindOf(s)
		if (air == "header") then
			do return "Header" end
		end
		if (air == "volley") then
			do return "Volley" end
		end
		if (air == "high") then
			do return "Overhead (not served)" end
		end
		local k = kindForShot(s)
		do return (if KIND_LABEL[k] ~= nil then KIND_LABEL[k] else k) end
	end
	exports.shotKindLabel = shotKindLabel
	measureOf = function(ball, opps, keeper)
		local near = A.map(opps, function(o)
			return Math.hypot((o.x - ball.x), (o.y - ball.y))
		end)
		do return Js.O({ distance = Math.hypot((ball.x - M_pitch.CX), ball.y), blockers = blockersOf(ball, opps), nearest = (if Js.T(Js.alen(near)) then Math.min(Js.unpack(near)) else nil), keeperOff = (if keeper then Math.max(0, keeper.y) else nil) }, { "distance", "blockers", "nearest", "keeperOff" }) end
	end
	exports.measureOf = measureOf
	measureReal = function(s)
		local p = peopleOf(s)
		do return measureOf(p.ball, p.opps, p.keeper) end
	end
	exports.measureReal = measureReal
	measureScenario = function(sc)
		do return measureOf(sc.ball, A.map(sc.defenders, function(d)
			return Js.O({ x = d.x, y = d.y }, { "x", "y" })
		end), Js.O({ x = sc.keeper.x, y = sc.keeper.y }, { "x", "y" })) end
	end
	exports.measureScenario = measureScenario
	ourMeasures = function(kind, n)
		if n == nil then n = 200 end
		local out = Js.alit()
		for i = 1, math.floor(n) do
			A.push(out, measureScenario(M_canvasEngine.buildScenario(kind, M_season.mulberry32(((i * 7919) + 11)))))
		end
		do return out end
	end
	exports.ourMeasures = ourMeasures
	meansOf = function(ms)
		local avg = function(xs)
			local v = A.filter(xs, function(x)
				return (x ~= nil)
			end)
			do return (if Js.T(Js.alen(v)) then (A.reduce(v, function(a, b)
				return (a + b)
			end, 0) / Js.alen(v)) else (0/0)) end
		end
		do return Js.O({ n = Js.alen(ms), distance = avg(A.map(ms, function(m)
			return m.distance
		end)), blockers = avg(A.map(ms, function(m)
			return m.blockers
		end)), nearest = avg(A.map(ms, function(m)
			return m.nearest
		end)), keeperOff = avg(A.map(ms, function(m)
			return m.keeperOff
		end)) }, { "n", "distance", "blockers", "nearest", "keeperOff" }) end
	end
	exports.meansOf = meansOf
	cameraFor = function(ball, keeper, people)
		if people == nil then people = Js.alit() end
		local near = A.filter(people, function(q)
			return (Math.hypot((q.x - ball.x), (q.y - ball.y)) <= FRAME_PEOPLE_M)
		end)
		local pts = Js.aspread(Js.alit(ball), (if keeper then Js.alit(keeper) else Js.alit()), near, Js.alit(Js.O({ x = M_pitch.POST_L, y = 0 }, { "x", "y" }), Js.O({ x = M_pitch.POST_R, y = 0 }, { "x", "y" }), Js.O({ x = M_pitch.CX, y = (-M_pitch.NET_DEPTH) }, { "x", "y" })))
		local pad = FRAME_PAD_M
		local x1 = (Math.min(Js.unpack(A.map(pts, function(p)
			return p.x
		end))) - pad)
		local x2 = (Math.max(Js.unpack(A.map(pts, function(p)
			return p.x
		end))) + pad)
		local y1 = Math.min(((-M_pitch.NET_DEPTH) - 2), (Math.min(Js.unpack(A.map(pts, function(p)
			return p.y
		end))) - pad))
		local yBot = ((Math.max(Js.unpack(A.map(pts, function(p)
			return p.y
		end))) + pad) + 3)
		local h = Math.max(28, (yBot - y1), ((x2 - x1) / M_canvasEngine.VIEW_ASPECT))
		local w = (h * M_canvasEngine.VIEW_ASPECT)
		local cx = ((x1 + x2) / 2)
		local lo = (-3 + (w / 2))
		local hi = ((M_pitch.PITCH_W + 3) - (w / 2))
		local a = Math.max(lo, (x2 - (w / 2)))
		local b = Math.min(hi, (x1 + (w / 2)))
		if (a <= b) then
			cx = Math.min(Math.max(cx, a), b)
		end
		do return Js.O({ x1 = r2((cx - (w / 2))), x2 = r2((cx + (w / 2))), y1 = r2(y1), y2 = r2((y1 + h)) }, { "x1", "x2", "y1", "y2" }) end
	end
	exports.cameraFor = cameraFor
	onScreen = function(v, q, m)
		if m == nil then m = 0.8 end
		do return ((((q.x > (v.x1 + m)) and (q.x < (v.x2 - m))) and (q.y > (v.y1 + m))) and (q.y < (v.y2 - m))) end
	end
	exports.onScreen = onScreen
	frameHoldsShot = function(s, v)
		local p = peopleOf(s)
		local need = Js.aspread((if p.keeper then Js.alit(p.keeper) else Js.alit()), A.filter(Js.aspread(p.opps, p.mates), function(q)
			return (Math.hypot((q.x - p.ball.x), (q.y - p.ball.y)) <= FRAME_PEOPLE_M)
		end), Js.alit(p.ball))
		local goal = Js.alit(Js.O({ x = M_pitch.POST_L, y = 0 }, { "x", "y" }), Js.O({ x = M_pitch.POST_R, y = 0 }, { "x", "y" }), Js.O({ x = M_pitch.POST_L, y = (-M_pitch.NET_DEPTH) }, { "x", "y" }), Js.O({ x = M_pitch.POST_R, y = (-M_pitch.NET_DEPTH) }, { "x", "y" }))
		do return (A.every(need, function(q)
			return onScreen(v, q)
		end) and A.every(goal, function(q)
			return onScreen(v, q, 0)
		end)) end
	end
	exports.frameHoldsShot = frameHoldsShot
	seedForShot = function(s)
		do return math.fmod(math.abs(A.reduce(S.split(s.id, ""), function(h, c)
			return Js.bor(((h * 31) + S.charCodeAt(c, 0)), 0)
		end, 7)), 1000000) end
	end
	exports.seedForShot = seedForShot
	closeCameraFor = function(ball, keeper)
		local pts = Js.aspread(Js.alit(ball), (if keeper then Js.alit(keeper) else Js.alit()), Js.alit(Js.O({ x = M_pitch.POST_L, y = 0 }, { "x", "y" }), Js.O({ x = M_pitch.POST_R, y = 0 }, { "x", "y" }), Js.O({ x = M_pitch.CX, y = (-M_pitch.NET_DEPTH) }, { "x", "y" })))
		local pad = 4
		local x1 = (Math.min(Js.unpack(A.map(pts, function(p)
			return p.x
		end))) - pad)
		local x2 = (Math.max(Js.unpack(A.map(pts, function(p)
			return p.x
		end))) + pad)
		local yTop = (Math.min(Js.unpack(A.map(pts, function(p)
			return p.y
		end))) - (pad * 0.875))
		local yBot = ((Math.max(Js.unpack(A.map(pts, function(p)
			return p.y
		end))) + (pad * 0.875)) + 6)
		local h = Math.min(42, Math.max(28, (yBot - yTop), ((x2 - x1) / M_canvasEngine.VIEW_ASPECT)))
		local w = (h * M_canvasEngine.VIEW_ASPECT)
		local cx = Math.min(((M_pitch.PITCH_W + 3) - (w / 2)), Math.max((-3 + (w / 2)), ((x1 + x2) / 2)))
		local y1 = ((-M_pitch.NET_DEPTH) - 2)
		if ((ball.y + pad) > (y1 + h)) then
			y1 = ((ball.y + pad) - h)
		end
		do return Js.O({ x1 = r2((cx - (w / 2))), x2 = r2((cx + (w / 2))), y1 = r2(y1), y2 = r2((y1 + h)) }, { "x1", "x2", "y1", "y2" }) end
	end
	youAt = function(ball)
		local away = Js.O({ x = (ball.x - M_pitch.CX), y = ball.y }, { "x", "y" })
		local len = (function() local _l = Math.hypot(away.x, away.y); if Js.T(_l) then return _l end; return 1 end)()
		do return Js.O({ x = (ball.x + ((away.x / len) * 0.9)), y = (ball.y + ((away.y / len) * 0.9)) }, { "x", "y" }) end
	end
	realOverride = function(s, kind, seed, wide)
		local p = peopleOf(s)
		local sc = M_canvasEngine.buildScenario(kind, M_season.mulberry32(seed))
		local frame = M_scenarioFrame.frameFromScenario(sc)
		local camera = (if (M_canvasEngine.goalInView(kind) and (kind ~= "penalty")) then (if wide then cameraFor(p.ball, p.keeper, Js.aspread(p.opps, p.mates)) else closeCameraFor(p.ball, p.keeper)) else sc.viewport)
		local inside = function(q)
			return ((((q.x > (camera.x1 + 0.8)) and (q.x < (camera.x2 - 0.8))) and (q.y > (camera.y1 + 0.8))) and (q.y < (camera.y2 - 0.8)))
		end
		local ov = Js.O({ items = Js.O({}, nil), removed = Js.alit(), added = Js.alit(), ball = rv(p.ball), camera = camera }, { "items", "removed", "added", "ball", "camera" })
		do
			local _arr5 = frame.items
			local _i6 = 0
			while _i6 < Js.alen(_arr5) do
				_i6 += 1
				local it = _arr5[_i6]
				if it.removable then
					A.push(ov.removed, it.id)
				end
			end
		end
		local keeperItem = A.find(frame.items, function(it)
			return it.keeper
		end)
		local youItem = A.find(frame.items, function(it)
			return (it.side == "you")
		end)
		if (keeperItem and p.keeper) then
			ov.items[keeperItem.id] = rv(p.keeper)
		end
		if youItem then
			ov.items[youItem.id] = rv(youAt(p.ball))
		end
		local n = 0
		do
			local _arr7 = Js.aspread(A.map(p.opps, function(o)
				return Js.alit(o, false)
			end), A.map(p.mates, function(m)
				return Js.alit(m, true)
			end))
			local _i8 = 0
			while _i8 < Js.alen(_arr7) do
				_i8 += 1
				local _e9 = _arr7[_i8]
				local q = _e9[1]
				local mate = _e9[2]
				if ((not inside(q)) or (Math.hypot((q.x - p.ball.x), (q.y - p.ball.y)) < 0.6)) then
					do continue end
				end
				local aid = ("add" .. Js.numstr((function() local _n = n + 1; n = _n; return _n end)()))
				A.push(ov.added, Js.O({ id = aid, side = (if mate then "teammate" else "opponent") }, { "id", "side" }))
				ov.items[aid] = rv(q)
			end
		end
		do return ov end
	end
	placedOverride = function(s, kind, seed)
		local sc = M_canvasEngine.buildScenario(kind, M_season.mulberry32(seed))
		local real = P(s.ball)
		if (kind == "penalty") then
			do return Js.O({ items = Js.O({}, nil) }, { "items" }) end
		end
		local frame = M_scenarioFrame.frameFromScenario(sc)
		local mirror = ((math.abs((real.x - M_pitch.CX)) > 2) and ((Math.sign((sc.ball.x - M_pitch.CX)) * Math.sign((real.x - M_pitch.CX))) < 0))
		local mx = function(x)
			return (if mirror then ((2 * M_pitch.CX) - x) else x)
		end
		local dx = (real.x - mx(sc.ball.x))
		local dy = (real.y - sc.ball.y)
		local k = (if (sc.ball.y > 0.5) then (real.y / sc.ball.y) else 1)
		local move = function(q)
			return Js.O({ x = Math.min((M_pitch.PITCH_W - 0.5), Math.max(0.5, (mx(q.x) + dx))), y = Math.max(0.6, (if (q.y < sc.ball.y) then (q.y * k) else (q.y + dy))) }, { "x", "y" })
		end
		local ov = Js.O({ items = Js.O({}, nil), ball = rv(real) }, { "items", "ball" })
		local people = Js.alit()
		local keeper = nil
		do
			local _arr10 = frame.items
			local _i11 = 0
			while _i11 < Js.alen(_arr10) do
				_i11 += 1
				local it = _arr10[_i11]
				if (it.side == "you") then
					ov.items[it.id] = rv(youAt(real))
					do continue end
				end
				if it.keeper then
					local shares = M_authoredChance.keeperSharesOf(M_authoredChance.sampleFromScenario(sc))
					local k = M_authoredChance.placeKeeper(real, shares, Js.O({ x = mx(sc.keeper.x), y = sc.keeper.y }, { "x", "y" }), kind)
					keeper = Js.O({ x = k.x, y = Math.max(0, Math.min(k.y, (real.y - 1))) }, { "x", "y" })
					ov.items[it.id] = rv(keeper)
					do continue end
				end
				local at = move(it.at)
				ov.items[it.id] = rv(at)
				A.push(people, at)
			end
		end
		local last = (function() local _v = s.lead; if _v == nil then return nil end; _v = _v.passes; _v = _v[Js.alen(s.lead.passes)]; return _v end)()
		local realNear = (if last then Js.alit(P(last[2]), P(last[3])) else Js.alit())
		ov.camera = (if M_canvasEngine.goalInView(kind) then cameraFor(real, keeper, Js.aspread(people, realNear)) else sc.viewport)
		do return ov end
	end
	overrideForShot = function(s, kind, seed, wide)
		if wide == nil then wide = false end
		do return (if M_types.isFullyReal(s) then realOverride(s, kind, seed, wide) else placedOverride(s, kind, seed)) end
	end
	exports.overrideForShot = overrideForShot
	seedForPlaced = function(s, kind)
		local base = seedForShot(s)
		if (M_types.isFullyReal(s) or (kind == "penalty")) then
			do return base end
		end
		local real = P(s.ball)
		local best = base
		local bd = math.huge
		for k = 0, PLACED_TRIES - 1 do
			local seed = math.fmod((base + (k * 7919)), 1000000)
			local b = M_canvasEngine.buildScenario(kind, M_season.mulberry32(seed)).ball
			local d = Math.hypot((math.abs((b.x - M_pitch.CX)) - math.abs((real.x - M_pitch.CX))), (b.y - real.y))
			if (d < bd) then
				bd = d
				best = seed
			end
		end
		do return best end
	end
	exports.seedForPlaced = seedForPlaced
	scenarioForShot = function(s, opts)
		if opts == nil then opts = Js.O({}, nil) end
		local kind = playKindForShot(s)
		local seed = seedForPlaced(s, kind)
		local sc = M_canvasEngine.buildScenario(kind, M_season.mulberry32(seed))
		M_scenarioEdit.applyOverrideToScenario(sc, overrideForShot(s, kind, seed, (not (not opts.wideFrame))))
		if (M_types.isFullyReal(s) and peopleOf(s).keeper) then
			sc.keeperHoldsStart = true
		end
		if (((kind == "header") or (kind == "volley")) and (type(s.z) == "number")) then
			M_airDrawings.setAirZ(sc, s.z)
		end
		do return sc end
	end
	exports.scenarioForShot = scenarioForShot
	scenarioForCorner = function(c)
		local seed = seedForShot(c)
		local sc = M_canvasEngine.buildScenario("corner", M_season.mulberry32(seed))
		local p = peopleOf(c)
		local flagRight = (p.ball.x > M_pitch.CX)
		local flip = (flagRight ~= (sc.ball.x > M_pitch.CX))
		local ball = Js.O({ x = (if flagRight then (M_pitch.PITCH_W - 0.6) else 0.6), y = 0.6 }, { "x", "y" })
		local frame = M_scenarioFrame.frameFromScenario(sc)
		local ov = Js.O({ items = Js.O({}, nil), removed = Js.alit(), added = Js.alit(), ball = rv(ball) }, { "items", "removed", "added", "ball" })
		if flip then
			ov.facing = (if flagRight then "right" else "left")
		end
		local v = sc.viewport
		local x1 = (if flip then (M_pitch.PITCH_W - v.x2) else v.x1)
		local x2 = (if flip then (M_pitch.PITCH_W - v.x1) else v.x2)
		local box = A.filter(Js.aspread(p.opps, p.mates, (if p.keeper then Js.alit(p.keeper) else Js.alit())), function(q)
			return (q.y < 22)
		end)
		if flagRight then
			x1 = Math.min(Js.unpack(Js.aspread(Js.alit(x1), A.map(box, function(q)
				return (q.x - 4)
			end))))
		else
			x2 = Math.max(Js.unpack(Js.aspread(Js.alit(x2), A.map(box, function(q)
				return (q.x + 4)
			end))))
		end
		local h = ((x2 - x1) * ((v.y2 - v.y1) / (v.x2 - v.x1)))
		local cam = Js.O({ x1 = r2(x1), x2 = r2(x2), y1 = v.y1, y2 = r2((v.y1 + h)) }, { "x1", "x2", "y1", "y2" })
		ov.camera = cam
		do
			local _arr12 = frame.items
			local _i13 = 0
			while _i13 < Js.alen(_arr12) do
				_i13 += 1
				local it = _arr12[_i13]
				if it.removable then
					A.push(ov.removed, it.id)
				end
			end
		end
		local keeperItem = A.find(frame.items, function(it)
			return it.keeper
		end)
		local youItem = A.find(frame.items, function(it)
			return (it.side == "you")
		end)
		if (keeperItem and p.keeper) then
			ov.items[keeperItem.id] = rv(p.keeper)
		end
		if youItem then
			ov.items[youItem.id] = rv(Js.O({ x = (ball.x + ((sc.player.x - sc.ball.x) * (if flip then -1 else 1))), y = (ball.y + (sc.player.y - sc.ball.y)) }, { "x", "y" }))
		end
		local n = 0
		do
			local _arr14 = Js.aspread(A.map(p.opps, function(o)
				return Js.alit(o, false)
			end), A.map(p.mates, function(m)
				return Js.alit(m, true)
			end))
			local _i15 = 0
			while _i15 < Js.alen(_arr14) do
				_i15 += 1
				local _e16 = _arr14[_i15]
				local q = _e16[1]
				local mate = _e16[2]
				if ((not onScreen(cam, q)) or (Math.hypot((q.x - ball.x), (q.y - ball.y)) < 1.5)) then
					do continue end
				end
				local aid = ("add" .. Js.numstr((function() local _n = n + 1; n = _n; return _n end)()))
				A.push(ov.added, Js.O({ id = aid, side = (if mate then "teammate" else "opponent") }, { "id", "side" }))
				ov.items[aid] = rv(q)
			end
		end
		M_scenarioEdit.applyOverrideToScenario(sc, ov)
		if p.keeper then
			sc.keeperHoldsStart = true
		end
		do return sc end
	end
	exports.scenarioForCorner = scenarioForCorner
	scenarioForMoment = function(m, opts)
		if opts == nil then opts = Js.O({}, nil) end
		do return (if (m.what == "corner") then scenarioForCorner(m) else scenarioForShot(m, opts)) end
	end
	exports.scenarioForMoment = scenarioForMoment
	playedKeeperOff = function(s, aimS, hold)
		if aimS == nil then aimS = 2 end
		if hold == nil then hold = true end
		if (not peopleOf(s).keeper) then
			do return nil end
		end
		local sc = scenarioForShot(s)
		if (not hold) then
			Js.del(sc, "keeperHoldsStart")
		end
		M_index.enforceHardRules(sc)
		M_keeperBrain.brainSetup(sc, Js.ushr(Js.bxor(seedForShot(s), 19326), 0), sc.keeperStrength, M_keeperBrain.brainOptionsHere())
		do
			local t = 0
			local _first17 = true
			while true do
				if not _first17 then
					t += (1 / 60)
				end
				_first17 = false
				if not (t < aimS) then break end
				M_keeperBrain.brainAim(sc, (1 / 60))
			end
		end
		do return Math.max(0, sc.keeper.y) end
	end
	exports.playedKeeperOff = playedKeeperOff
	P = function(p)
		return Js.O({ x = p[1], y = p[2] }, { "x", "y" })
	end
	exports.P = P
	KIND_LABEL = Js.O({ one_on_one = "One-on-one", volley = "In the box", header = "Header", tight_angle = "Tight angle", long_range = "Long range", penalty = "Penalty", free_kick = "Free kick", corner = "Corner" }, { "one_on_one", "volley", "header", "tight_angle", "long_range", "penalty", "free_kick", "corner" })
	exports.KIND_LABEL = KIND_LABEL
	r2 = function(v)
		return (Math.round((v * 100)) / 100)
	end
	rv = function(v)
		return Js.O({ x = r2(v.x), y = r2(v.y) }, { "x", "y" })
	end
	FRAME_PEOPLE_M = 20
	exports.FRAME_PEOPLE_M = FRAME_PEOPLE_M
	FRAME_PAD_M = 3
	PLACED_TRIES = 40
	exports.PLACED_TRIES = PLACED_TRIES
end
