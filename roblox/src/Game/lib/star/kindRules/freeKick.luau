--!nocheck
--!nolint
-- Generated from lib/star/kindRules/freeKick.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_pitch = import("lib/star/pitch")
	local M_gameplayVersion = import("lib/star/gameplayVersion")
	local M_leafFlight = import("lib/star/leafFlight")
	local M_keeperBrain = import("lib/star/keeperBrain")
	local LEAF_RUNUP, clamp, FREE_KICK, FREE_KICK_DRILL, ruled, isMatchFreeKick, wallSizeFor, setupFreeKick, norm, flights, leafs, freeKickReaction, freeKickRules
	isMatchFreeKick = function(sc)
		do return ruled:has(sc) end
	end
	exports.isMatchFreeKick = isMatchFreeKick
	wallSizeFor = function(angleDeg, draw)
		if (angleDeg < 10) then
			do return (if (draw < 0.55) then 5 else 4) end
		end
		if (angleDeg < 18) then
			do return (if (draw < 0.5) then 4 else 3) end
		end
		do return (if (draw < 0.5) then 3 else 2) end
	end
	exports.wallSizeFor = wallSizeFor
	setupFreeKick = function(sc, rng, appliedAuthored)
		if appliedAuthored == nil then appliedAuthored = false end
		local F = FREE_KICK
		local holders = A.filter(sc.defenders, function(d)
			return (Math.hypot((d.x - sc.ball.x), (d.y - sc.ball.y)) < 12.5)
		end)
		local moved = false
		do
			local b = sc.ball
			local lat = clamp((b.x - M_pitch.CX), (-F.maxLateral), F.maxLateral)
			local dist = Math.hypot(lat, b.y)
			if (not appliedAuthored) then
				dist = (F.minDist + (((rng() + rng()) / 2) * (F.maxDist - F.minDist)))
			end
			dist = clamp(dist, F.minDist, F.maxDist)
			lat = clamp(lat, (-(Math.min(F.maxLateral, (dist - 1)))), Math.min(F.maxLateral, (dist - 1)))
			local depth = Math.sqrt(Math.max(1, ((dist * dist) - (lat * lat))))
			local vp = sc.viewport
			local yMax = (if vp then (vp.y2 - 3.5) else depth)
			local ny = Math.min(depth, yMax)
			local nx = (M_pitch.CX + lat)
			if ((math.abs((nx - b.x)) > 0.000001) or (math.abs((ny - b.y)) > 0.000001)) then
				local dx = (nx - b.x)
				local dy = (ny - b.y)
				sc.player = Js.O({ x = (sc.player.x + dx), y = (sc.player.y + dy) }, { "x", "y" })
				sc.ball = Js.O({ x = nx, y = ny }, { "x", "y" })
				moved = true
			end
		end
		local b = sc.ball
		local lat = (b.x - M_pitch.CX)
		local side = (if (math.abs(lat) < 1) then (if (rng() < 0.5) then -1 else 1) else Math.sign(lat))
		local angle = ((Math.atan2(math.abs(lat), b.y) * 180) / Math.PI)
		local n = wallSizeFor(angle, rng())
		local nearPost = Js.O({ x = (M_pitch.CX + (side * (M_pitch.GOAL_W / 2))), y = 0 }, { "x", "y" })
		local u = norm(Js.O({ x = (nearPost.x - b.x), y = (nearPost.y - b.y) }, { "x", "y" }))
		local across = Js.O({ x = (-u.y), y = u.x }, { "x", "y" })
		if ((across.x * (-side)) < 0) then
			across = Js.O({ x = (-across.x), y = (-across.y) }, { "x", "y" })
		end
		local anchor = Js.O({ x = ((b.x + (u.x * F.wallGap)) - (across.x * F.postManOutside)), y = ((b.y + (u.y * F.wallGap)) - (across.y * F.postManOutside)) }, { "x", "y" })
		local wall = Js.alit()
		for i = 0, math.ceil(n) - 1 do
			local p = Js.O({ x = (anchor.x + ((across.x * F.wallSpacing) * i)), y = (anchor.y + ((across.y * F.wallSpacing) * i)) }, { "x", "y" })
			local d = Math.hypot((p.x - b.x), (p.y - b.y))
			if (d < F.wallGap) then
				p = Js.O({ x = (b.x + (((p.x - b.x) / d) * F.wallGap)), y = (b.y + (((p.y - b.y) / d) * F.wallGap)) }, { "x", "y" })
			end
			A.push(wall, p)
		end
		local others = A.filter(sc.defenders, function(d)
			return (not A.includes(holders, d))
		end)
		local men = A.slice(holders, 0, n)
		while (Js.alen(men) < n) do
			A.push(men, Js.O({ x = 0, y = 0 }, { "x", "y" }))
		end
		A.forEach(men, function(m, i)
			m.x = wall[i + 1].x
			m.y = wall[i + 1].y
			m.z = 0
			m.vz = 0
		end)
		sc.defenders = Js.aspread(men, others)
		local k = sc.keeper
		local cheat = (F.keeperCheat[1] + (rng() * (F.keeperCheat[2] - F.keeperCheat[1])))
		k.x = clamp((M_pitch.CX - (side * cheat)), (M_pitch.POST_L + 0.6), (M_pitch.POST_R - 0.6))
		k.y = FREE_KICK.keeperLineY
		k.startX = k.x
		k.targetX = k.x
		k.adjusting = false
		k.scrambling = false
		ruled:add(sc)
		do return Js.O({ side = side, wall = n, moved = moved }, { "side", "wall", "moved" }) end
	end
	exports.setupFreeKick = setupFreeKick
	norm = function(v)
		local l = (function() local _l = Math.hypot(v.x, v.y); if Js.T(_l) then return _l end; return 1 end)()
		do return Js.O({ x = (v.x / l), y = (v.y / l) }, { "x", "y" }) end
	end
	freeKickReaction = function(draw, keeperStrength, drill)
		if drill == nil then drill = false end
		local F = (if drill then FREE_KICK_DRILL else FREE_KICK)
		local base = (F.reactS[1] + (draw * (F.reactS[2] - F.reactS[1])))
		do return clamp((base - ((keeperStrength - 62) * F.reactPerPoint)), 0.08, 0.4) end
	end
	exports.freeKickReaction = freeKickReaction
	LEAF_RUNUP = "fk_leaf"
	clamp = function(v, lo, hi)
		return (if (v < lo) then lo else (if (v > hi) then hi else v))
	end
	FREE_KICK = Js.O({ minDist = 18, maxDist = 30, maxLateral = 8, wallGap = M_pitch.ARC_R, wallSpacing = 1, postManOutside = 0.45, keeperCheat = Js.alit(0.35, 0.95), keeperLineY = 0.4, wallStaysDown = 0.15, reactS = Js.alit(0.14, 0.26), reactPerPoint = 0.0025, readLagS = 0.08, sightedPast = 0.4, dive = true, topCorner = false }, { "minDist", "maxDist", "maxLateral", "wallGap", "wallSpacing", "postManOutside", "keeperCheat", "keeperLineY", "wallStaysDown", "reactS", "reactPerPoint", "readLagS", "sightedPast", "dive", "topCorner" })
	exports.FREE_KICK = FREE_KICK
	FREE_KICK_DRILL = Js.O({ reactS = Js.alit(0.26, 0.4), reactPerPoint = 0.0012, readLagS = 0.15, sightedPast = 1.5, topCorner = true }, { "reactS", "reactPerPoint", "readLagS", "sightedPast", "topCorner" })
	exports.FREE_KICK_DRILL = FREE_KICK_DRILL
	ruled = Js.Set.new()
	flights = Js.Map.new()
	leafs = Js.Map.new()
	freeKickRules = Js.O({ setup = function(sc, rng, ctx)
		if (sc.kind ~= "free_kick") then
			do return end
		end
		setupFreeKick(sc, rng, ctx.appliedAuthored)
	end, draws = 2, decide = function(sc, ball, draws, ctx)
		if (sc.kind ~= "free_kick") then
			do return nil end
		end
		local drill = ((not isMatchFreeKick(sc)) and (not M_gameplayVersion.oldKeepers()))
		do return Js.O({ kind = "free_kick", data = Js.ospread(Js.O({ jump = (draws[1] >= FREE_KICK.wallStaysDown), react = freeKickReaction(draws[2], ctx.keeperStrength, drill), drill = drill }, { "jump", "react", "drill" }), (if (ctx.runup == LEAF_RUNUP) then Js.O({ leaf = true }, { "leaf" }) else Js.O({}, nil))) }, { "kind", "data" }) end
	end, apply = function(sc, ball, d)
		if (d.data.leaf == true) then
			leafs:set(ball, M_leafFlight.startLeaf(ball))
		end
		local wall = A.filter(sc.defenders, function(d)
			return (d.baseRole == "hold")
		end)
		local wallDist = (if Js.T(Js.alen(wall)) then Math.min(Js.unpack(A.map(wall, function(d)
			return Math.hypot((d.x - ball.pos.x), (d.y - ball.pos.y))
		end))) else 0)
		flights:set(ball, Js.O({ t = 0, seenAt = nil, trail = Js.alit(), wallDist = wallDist, baseReach = sc.keeperReach, fromX = sc.keeper.x }, { "t", "seenAt", "trail", "wallDist", "baseReach", "fromX" }))
	end, step = function(sc, ball, dt, d)
		if (d.data.leaf == true) then
			local lf = leafs:get(ball)
			if lf then
				M_leafFlight.stepLeaf(lf, ball, dt)
			end
		end
		local st = flights:get(ball)
		if (not st) then
			do return end
		end
		st.t += dt
		if (d.data.jump == false) then
			do
				local _arr1 = sc.defenders
				local _i2 = 0
				while _i2 < Js.alen(_arr1) do
					_i2 += 1
					local m = _arr1[_i2]
					if (m.baseRole == "hold") then
						m.containT = 0
					end
				end
			end
		end
		local k = sc.keeper
		if ((((k.done or (k.saves > 0)) or (ball.lastTouch ~= "attack")) or ball.loose) or (ball.pos.y <= k.y)) then
			if (k.adjusting and (not k.scrambling)) then
				k.adjusting = false
			end
			sc.keeperReach = st.baseReach
			flights:delete(ball)
			do return end
		end
		local drill = (d.data.drill == true)
		local P = (if drill then FREE_KICK_DRILL else FREE_KICK)
		do
			local f = (if P.topCorner then M_keeperBrain.topCornerReach(sc, ball, st.fromX) else 1)
			sc.keeperReach = (if (f < 1) then ((if st.baseReach ~= nil then st.baseReach else 1) * f) else st.baseReach)
		end
		A.push(st.trail, Js.O({ t = st.t, x = ball.pos.x, y = ball.pos.y, vx = ball.vel.x, vy = ball.vel.y }, { "t", "x", "y", "vx", "vy" }))
		if (st.seenAt == nil) then
			local from = sc.ball
			if (Math.hypot((ball.pos.x - from.x), (ball.pos.y - from.y)) < (st.wallDist + P.sightedPast)) then
				do return end
			end
			st.seenAt = st.t
		end
		local react = Js.Number((if d.data.react ~= nil then d.data.react else 0.2))
		if (st.t < (st.seenAt + react)) then
			do return end
		end
		local seen = (st.t - P.readLagS)
		local s = st.trail[1]
		do
			local _arr3 = st.trail
			local _i4 = 0
			while _i4 < Js.alen(_arr3) do
				_i4 += 1
				local p = _arr3[_i4]
				if (p.t <= seen) then
					s = p
				else
					do break end
				end
			end
		end
		while ((Js.alen(st.trail) > 2) and (st.trail[2].t <= seen)) do
			A.shift(st.trail)
		end
		if (s.vy >= -0.5) then
			do return end
		end
		local xAt = (s.x + (s.vx * ((s.y - k.y) / (-s.vy))))
		k.targetX = clamp(xAt, (M_pitch.POST_L - 0.8), (M_pitch.POST_R + 0.8))
		if FREE_KICK.dive then
			k.scrambling = true
		else
			k.adjusting = true
		end
	end }, { "setup", "draws", "decide", "apply", "step" })
	exports.freeKickRules = freeKickRules
end
