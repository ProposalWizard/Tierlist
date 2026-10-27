--!nocheck
--!nolint
-- Generated from lib/star/kindRules/penalty.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_pitch = import("lib/star/pitch")
	local M_compareSwitches = import("lib/star/compareSwitches")
	local M_canvasEngine = import("lib/star/canvasEngine")
	local PENALTY, PENALTY_VIEW, dHalfWidth, lineBounds, lineSpots, spotHash, onTheLine, arrangeOthers, parked, enforcePenalty, penaltyFrame, penaltyDragSpot, PENALTY_SLIDE_M, slideAlongTheLine, penaltyRules
	dHalfWidth = function(y)
		local dy = (y - M_pitch.PEN_SPOT_Y)
		do return (if (math.abs(dy) >= M_pitch.ARC_R) then 0 else Math.sqrt(((M_pitch.ARC_R * M_pitch.ARC_R) - (dy * dy)))) end
	end
	exports.dHalfWidth = dHalfWidth
	lineBounds = function(view)
		if view == nil then view = PENALTY_VIEW end
		local min = (dHalfWidth(PENALTY.lineY) + PENALTY.dClear)
		local max = Math.min((M_pitch.CX - (view.x1 + PENALTY.inset)), ((view.x2 - PENALTY.inset) - M_pitch.CX))
		do return Js.O({ min = min, max = Math.max(min, max) }, { "min", "max" }) end
	end
	exports.lineBounds = lineBounds
	lineSpots = function(xs, view)
		if view == nil then view = PENALTY_VIEW end
		local _d1 = lineBounds(view)
		local min = _d1.min
		local max = _d1.max
		local cap = Math.max(1, (math.floor(((max - min) / PENALTY.spacing)) + 1))
		local sides = Js.alit(Js.alit(), Js.alit())
		A.forEach(xs, function(x, i)
			local off = (x - M_pitch.CX)
			local s = (if (off < 0) then 0 else (if (off > 0) then 1 else (if (Js.alen(sides[1]) <= Js.alen(sides[2])) then 0 else 1)))
			if ((Js.alen(sides[s + 1]) >= cap) and (Js.alen(sides[(1 - s) + 1]) < cap)) then
				s = (1 - s)
			end
			A.push(sides[s + 1], Js.O({ i = i, d = Math.min(max, Math.max(min, math.abs(off))) }, { "i", "d" }))
		end)
		local out = A.slice(xs)
		A.forEach(sides, function(group, s)
			A.sort(group, function(a, b)
				return (a.d - b.d)
			end)
			do
				local k = 1
				local _first2 = true
				while true do
					if not _first2 then
						k += 1
					end
					_first2 = false
					if not (k < Js.alen(group)) then break end
					group[k + 1].d = Math.max(group[k + 1].d, (group[k].d + PENALTY.spacing))
				end
			end
			if (Js.T(Js.alen(group)) and (group[Js.alen(group)].d > max)) then
				group[Js.alen(group)].d = max
				for k = (Js.alen(group) - 2), 0, -1 do
					group[k + 1].d = Math.min(group[k + 1].d, (group[(k + 1) + 1].d - PENALTY.spacing))
				end
				do
					local k = 0
					local _first3 = true
					while true do
						if not _first3 then
							k += 1
						end
						_first3 = false
						if not (k < Js.alen(group)) then break end
						group[k + 1].d = Math.max(group[k + 1].d, (min + (k * PENALTY.spacing)))
					end
				end
			end
			do
				local _arr4 = group
				local _i5 = 0
				while _i5 < Js.alen(_arr4) do
					_i5 += 1
					local g = _arr4[_i5]
					A.set(out, g.i, (M_pitch.CX + ((if (s == 0) then -1 else 1) * g.d)))
				end
			end
		end)
		do return out end
	end
	exports.lineSpots = lineSpots
	spotHash = function(p, k)
		local v = (Math.sin((((p.x * 12.9898) + (p.y * 78.233)) + (k * 37.719))) * 43758.5453)
		do return (v - math.floor(v)) end
	end
	arrangeOthers = function(ps, view)
		if view == nil then view = PENALTY_VIEW end
		local pref = A.map(ps, function(p)
			if onTheLine(p) then
				do return p.x end
			end
			if (spotHash(p, 1) < PENALTY.pullShare) then
				do return (M_pitch.CX + ((p.x - M_pitch.CX) * (0.3 + (0.5 * spotHash(p, 2))))) end
			end
			do return p.x end
		end)
		local xs = lineSpots(pref, view)
		do return A.map(ps, function(p, i)
			if onTheLine(p) then
				do return Js.O({ x = xs[i + 1], y = p.y }, { "x", "y" }) end
			end
			local h = spotHash(p, 3)
			local back = (if (h < PENALTY.backShare) then (0.6 + ((h / PENALTY.backShare) * (PENALTY.backMax - 0.6))) else 0)
			do return Js.O({ x = xs[i + 1], y = (PENALTY.lineY + back) }, { "x", "y" }) end
		end) end
	end
	exports.arrangeOthers = arrangeOthers
	enforcePenalty = function(sc)
		if ((sc.kind ~= "penalty") or (not M_compareSwitches.switchOn("penaltyRules"))) then
			do return end
		end
		sc.ball.x = PENALTY.spot.x
		sc.ball.y = PENALTY.spot.y
		sc.player.x = (PENALTY.spot.x + PENALTY.you.dx)
		sc.player.y = (PENALTY.spot.y + PENALTY.you.dy)
		local k = sc.keeper
		k.x = PENALTY.keeper.x
		k.startX = PENALTY.keeper.x
		k.targetX = PENALTY.keeper.x
		k.y = PENALTY.keeper.y
		k.adjusting = false
		k.scrambling = false
		k.dive = 0
		sc.viewport = Js.ospread(PENALTY_VIEW)
		sc.facing = "up"
		sc.crossSwitchY = nil
		sc.crossSwitchView = nil
		local bodies = Js.alit()
		do
			local _arr6 = sc.defenders
			local _i7 = 0
			while _i7 < Js.alen(_arr6) do
				_i7 += 1
				local d = _arr6[_i7]
				A.push(bodies, d)
			end
		end
		if sc.runner then
			A.push(bodies, sc.runner.pos)
		end
		do
			local _arr8 = sc.secondaryRunners
			local _i9 = 0
			while _i9 < Js.alen(_arr8) do
				_i9 += 1
				local r = _arr8[_i9]
				A.push(bodies, r.pos)
			end
		end
		if (not parked(sc.follower)) then
			A.push(bodies, sc.follower)
		end
		do
			local _arr10 = sc.teammates
			local _i11 = 0
			while _i11 < Js.alen(_arr10) do
				_i11 += 1
				local t = _arr10[_i11]
				A.push(bodies, t)
			end
		end
		local at = arrangeOthers(bodies, sc.viewport)
		A.forEach(bodies, function(b, i)
			b.x = at[i + 1].x
			b.y = at[i + 1].y
		end)
		do
			local _arr12 = sc.defenders
			local _i13 = 0
			while _i13 < Js.alen(_arr12) do
				_i13 += 1
				local d = _arr12[_i13]
				if (d.homeX ~= nil) then
					d.homeX = d.x
					d.homeY = d.y
				end
			end
		end
		if sc.runner then
			sc.runner.to = Js.ospread(sc.runner.pos)
			sc.passTarget = nil
		end
		do
			local _arr14 = sc.secondaryRunners
			local _i15 = 0
			while _i15 < Js.alen(_arr14) do
				_i15 += 1
				local r = _arr14[_i15]
				r.to = Js.ospread(r.pos)
			end
		end
	end
	exports.enforcePenalty = enforcePenalty
	penaltyFrame = function(frame)
		if ((frame.kind ~= "penalty") or (not M_compareSwitches.switchOn("penaltyRules"))) then
			do return frame end
		end
		local others = A.filter(A.map(frame.items, function(it, i)
			return Js.O({ it = it, i = i }, { "it", "i" })
		end), function(_p16)
			local it = _p16.it
			return (((not it.keeper) and (it.side ~= "you")) and (not parked(it.at)))
		end)
		local at = arrangeOthers(A.map(others, function(_p17)
			local it = _p17.it
			return it.at
		end), PENALTY_VIEW)
		local place = Js.Map.new()
		A.forEach(others, function(_p18, n)
			local i = _p18.i
			return place:set(i, at[n + 1])
		end)
		local items = A.map(frame.items, function(it, i)
			if it.keeper then
				do return Js.ospread(it, Js.O({ at = Js.ospread(PENALTY.keeper) }, { "at" })) end
			end
			if (it.side == "you") then
				do return Js.ospread(it, Js.O({ at = Js.O({ x = (PENALTY.spot.x + PENALTY.you.dx), y = (PENALTY.spot.y + PENALTY.you.dy) }, { "x", "y" }) }, { "at" })) end
			end
			local p = place:get(i)
			do return (if p then Js.ospread(it, Js.O({ at = p }, { "at" })) else it) end
		end)
		do return Js.ospread(frame, Js.O({ items = items, ball = Js.ospread(PENALTY.spot), camera = Js.ospread(PENALTY_VIEW), facing = "up" }, { "items", "ball", "camera", "facing" })) end
	end
	exports.penaltyFrame = penaltyFrame
	penaltyDragSpot = function(x, view)
		if view == nil then view = PENALTY_VIEW end
		local _d19 = lineBounds(view)
		local min = _d19.min
		local max = _d19.max
		local off = (x - M_pitch.CX)
		local side = (if (off < 0) then -1 else 1)
		do return Js.O({ x = (M_pitch.CX + (side * Math.min(max, Math.max(min, math.abs(off))))), y = PENALTY.lineY }, { "x", "y" }) end
	end
	exports.penaltyDragSpot = penaltyDragSpot
	slideAlongTheLine = function(sc, rngIn)
		local a = Js.ushr(math.floor((rngIn() * 4294967296)), 0)
		local rng = function()
			a = Js.ushr((a + 1831565813), 0)
			local t = a
			t = Math.imul(Js.bxor(t, Js.ushr(t, 15)), Js.bor(t, 1))
			t = Js.bxor(t, (t + Math.imul(Js.bxor(t, Js.ushr(t, 7)), Js.bor(t, 61))))
			do return (Js.ushr(Js.bxor(t, Js.ushr(t, 14)), 0) / 4294967296) end
		end
		local bodies = Js.aspread(sc.defenders)
		if sc.runner then
			A.push(bodies, sc.runner.pos)
		end
		do
			local _arr20 = sc.secondaryRunners
			local _i21 = 0
			while _i21 < Js.alen(_arr20) do
				_i21 += 1
				local r = _arr20[_i21]
				A.push(bodies, r.pos)
			end
		end
		if (not parked(sc.follower)) then
			A.push(bodies, sc.follower)
		end
		do
			local _arr22 = sc.teammates
			local _i23 = 0
			while _i23 < Js.alen(_arr22) do
				_i23 += 1
				local t = _arr22[_i23]
				A.push(bodies, t)
			end
		end
		A.sort(bodies, function(p, q)
			return (function() local _l = (p.x - q.x); if Js.T(_l) then return _l end; return (p.y - q.y) end)()
		end)
		do
			local _arr24 = bodies
			local _i25 = 0
			while _i25 < Js.alen(_arr24) do
				_i25 += 1
				local b = _arr24[_i25]
				if parked(b) then
					do continue end
				end
				local side = (function() local _l = Math.sign((b.x - M_pitch.CX)); if Js.T(_l) then return _l end; return 1 end)()
				local nx = (b.x + (((rng() * 2) - 1) * PENALTY_SLIDE_M))
				b.x = (if (((nx - M_pitch.CX) * side) > 0.5) then nx else (M_pitch.CX + (side * 0.5)))
				b.y += (((rng() * 2) - 1) * 0.5)
			end
		end
	end
	PENALTY = Js.O({ spot = Js.O({ x = M_pitch.CX, y = M_pitch.PEN_SPOT_Y }, { "x", "y" }), you = Js.O({ dx = 0, dy = 1.8 }, { "dx", "dy" }), keeper = Js.O({ x = M_pitch.CX, y = 0.4 }, { "x", "y" }), lineY = (M_pitch.BOX_DEPTH + 0.35), dClear = 0.6, spacing = 1.3, inset = 1.6, backShare = 0.18, backMax = 2, pullShare = 0.5, viewH = 42 }, { "spot", "you", "keeper", "lineY", "dClear", "spacing", "inset", "backShare", "backMax", "pullShare", "viewH" })
	exports.PENALTY = PENALTY
	PENALTY_VIEW = (function()
		local w = (PENALTY.viewH * M_canvasEngine.VIEW_ASPECT)
		local y1 = (-(M_pitch.NET_DEPTH + 2.5))
		do return Js.O({ x1 = (M_pitch.CX - (w / 2)), x2 = (M_pitch.CX + (w / 2)), y1 = y1, y2 = (y1 + PENALTY.viewH) }, { "x1", "x2", "y1", "y2" }) end
	end)()
	exports.PENALTY_VIEW = PENALTY_VIEW
	onTheLine = function(p)
		return ((p.y >= (PENALTY.lineY - 0.000001)) and (p.y <= ((PENALTY.lineY + PENALTY.backMax) + 0.000001)))
	end
	parked = function(p)
		return ((((p.x < -100) or (p.x > 200)) or (p.y > 200)) or (p.y < -100))
	end
	PENALTY_SLIDE_M = 2
	exports.PENALTY_SLIDE_M = PENALTY_SLIDE_M
	penaltyRules = Js.O({ setup = function(sc, rng)
		if ((sc.kind ~= "penalty") or (not M_compareSwitches.switchOn("penaltyRules"))) then
			do return end
		end
		slideAlongTheLine(sc, rng)
		enforcePenalty(sc)
	end, enforce = function(sc)
		enforcePenalty(sc)
	end }, { "setup", "enforce" })
	exports.penaltyRules = penaltyRules
end
