--!nocheck
--!nolint
-- Generated from lib/star/spacing.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_canvasEngine = import("lib/star/canvasEngine")
	local M_baseScenario = import("lib/star/baseScenario")
	local M_authoredChance = import("lib/star/authoredChance")
	local M_scenarioRules = import("lib/star/scenarioRules")
	local M_pitch = import("lib/star/pitch")
	local MIN_GAP, MARKING_GAP, MAX_MOVE, RING_STEP, DIRS, parked, figuresOf, exempt, marking, pairGap, dist, legalityOf, separateBodies, closestFigures, closestMarking
	figuresOf = function(sc)
		local out = Js.alit(Js.O({ p = sc.player, rank = 0, side = "you" }, { "p", "rank", "side" }), Js.O({ p = sc.keeper, rank = 1, side = "keeper" }, { "p", "rank", "side" }))
		if sc.runner then
			local r = sc.runner
			A.push(out, Js.O({ p = r.pos, rank = 2, side = "att", onMove = function(dx, dy)
				r.to = Js.O({ x = (r.to.x + dx), y = (r.to.y + dy) }, { "x", "y" })
				if sc.passTarget then
					sc.passTarget = Js.O({ x = (sc.passTarget.x + dx), y = (sc.passTarget.y + dy) }, { "x", "y" })
				end
			end }, { "p", "rank", "side", "onMove" }))
		end
		if (M_canvasEngine.goalInView(sc.kind) or (not parked(sc.follower))) then
			A.push(out, Js.O({ p = sc.follower, rank = 3, side = "att" }, { "p", "rank", "side" }))
		end
		do
			local _arr1 = sc.secondaryRunners
			local _i2 = 0
			while _i2 < Js.alen(_arr1) do
				_i2 += 1
				local r = _arr1[_i2]
				A.push(out, Js.O({ p = r.pos, rank = 4, side = "att", onMove = function(dx, dy)
					r.to = Js.O({ x = (r.to.x + dx), y = (r.to.y + dy) }, { "x", "y" })
				end }, { "p", "rank", "side", "onMove" }))
			end
		end
		local wallMan = function(d)
			return ((sc.kind == "free_kick") and (Math.hypot((d.x - sc.ball.x), (d.y - sc.ball.y)) < 12.5))
		end
		do
			local _arr3 = sc.defenders
			local _i4 = 0
			while _i4 < Js.alen(_arr3) do
				_i4 += 1
				local d = _arr3[_i4]
				A.push(out, Js.O({ p = d, rank = (if wallMan(d) then 1 else 5), side = "def", onMove = function(dx, dy)
					if (d.homeX ~= nil) then
						d.homeX += dx
					end
					if (d.homeY ~= nil) then
						d.homeY += dy
					end
				end }, { "p", "rank", "side", "onMove" }))
			end
		end
		do
			local _arr5 = sc.teammates
			local _i6 = 0
			while _i6 < Js.alen(_arr5) do
				_i6 += 1
				local m = _arr5[_i6]
				A.push(out, Js.O({ p = m, rank = 6, side = "att" }, { "p", "rank", "side" }))
			end
		end
		do return A.filter(out, function(f)
			return (not parked(f.p))
		end) end
	end
	exempt = function(sc, a, b)
		do return (((sc.kind == "free_kick") and (a.side == "def")) and (b.side == "def")) end
	end
	pairGap = function(a, b, gap)
		do return (if marking(a, b) then Math.min(MARKING_GAP, gap) else gap) end
	end
	legalityOf = function(sc)
		local out = Js.Set.new(M_baseScenario.scenarioFaults(sc))
		local set = M_authoredChance.ruleSetFor(sc.kind)
		if set then
			do
				local _arr7 = M_scenarioRules.violations(M_authoredChance.sampleFromScenario(sc), set)
				local _i8 = 0
				while _i8 < Js.alen(_arr7) do
					_i8 += 1
					local v = _arr7[_i8]
					out:add(("law:" .. v))
				end
			end
		end
		do return out end
	end
	separateBodies = function(sc, gap)
		if gap == nil then gap = MIN_GAP end
		local moved = 0
		local vp = sc.viewport
		local givenUp = Js.Set.new()
		local tryMove = function(figs, mover, other)
			local before = legalityOf(sc)
			local others = A.filter(figs, function(f)
				return (f ~= mover)
			end)
			local home = Js.O({ x = mover.p.x, y = mover.p.y }, { "x", "y" })
			local base = Math.atan2((home.y - other.p.y), (home.x - other.p.x))
			if (dist(home, other.p) < 0.001) then
				base = (if (home.x >= sc.ball.x) then 0 else Math.PI)
			end
			do
				local r = RING_STEP
				local _first9 = true
				while true do
					if not _first9 then
						r += RING_STEP
					end
					_first9 = false
					if not (r <= (MAX_MOVE + 1e-9)) then break end
					for k = 0, DIRS - 1 do
						local step = (if (k == 0) then 0 else ((if (math.fmod(k, 2) == 1) then 1 else -1) * math.ceil((k / 2))))
						local ang = (base + (((step * 2) * Math.PI) / DIRS))
						local c = Js.O({ x = (home.x + (Math.cos(ang) * r)), y = (home.y + (Math.sin(ang) * r)) }, { "x", "y" })
						if (((c.x < 0.5) or (c.x > (M_pitch.PITCH_W - 0.5))) or (c.y < 0.2)) then
							do continue end
						end
						if (vp and ((((c.x < (vp.x1 + 0.5)) or (c.x > (vp.x2 - 0.5))) or (c.y < (vp.y1 + 0.2))) or (c.y > (vp.y2 - 0.5)))) then
							do continue end
						end
						if A.some(others, function(f)
							return ((not exempt(sc, f, mover)) and (dist(f.p, c) < pairGap(f, mover, gap)))
						end) then
							do continue end
						end
						if (dist(c, sc.ball) < 0.8) then
							do continue end
						end
						mover.p.x = c.x
						mover.p.y = c.y
						local after = legalityOf(sc)
						if A.every(Js.Array.from(after), function(f)
							return before:has(f)
						end) then
							(function() local _f = mover.onMove; if _f == nil then return nil end; return _f((c.x - home.x), (c.y - home.y)) end)()
							do return true end
						end
						mover.p.x = home.x
						mover.p.y = home.y
					end
				end
			end
			do return false end
		end
		for pass = 0, 59 do
			local figs = figuresOf(sc)
			local worst = nil
			local worstD = math.huge
			do
				local i = 0
				local _first10 = true
				while true do
					if not _first10 then
						i += 1
					end
					_first10 = false
					if not (i < Js.alen(figs)) then break end
					do
						local j = (i + 1)
						local _first11 = true
						while true do
							if not _first11 then
								j += 1
							end
							_first11 = false
							if not (j < Js.alen(figs)) then break end
							if (exempt(sc, figs[i + 1], figs[j + 1]) or givenUp:has((Js.numstr(i) .. "|" .. Js.numstr(j)))) then
								do continue end
							end
							local d = dist(figs[i + 1].p, figs[j + 1].p)
							local need = pairGap(figs[i + 1], figs[j + 1], gap)
							if ((d < need) and ((d - need) < worstD)) then
								worstD = (d - need)
								worst = Js.alit(i, j)
							end
						end
					end
				end
			end
			if (not worst) then
				do break end
			end
			local _d12 = Js.alit(figs[worst[1] + 1], figs[worst[2] + 1])
			local a = _d12[1]
			local b = _d12[2]
			local order = (if (a.rank >= b.rank) then Js.alit(a, b) else Js.alit(b, a))
			local ok = false
			do
				local _arr13 = order
				local _i14 = 0
				while _i14 < Js.alen(_arr13) do
					_i14 += 1
					local mover = _arr13[_i14]
					if (mover.rank <= 1) then
						do continue end
					end
					if tryMove(figs, mover, (if (mover == a) then b else a)) then
						ok = true
						do break end
					end
				end
			end
			if ok then
				moved += 1
			else
				givenUp:add((Js.numstr(worst[1]) .. "|" .. Js.numstr(worst[2])))
			end
		end
		do return moved end
	end
	exports.separateBodies = separateBodies
	closestFigures = function(sc)
		local figs = figuresOf(sc)
		local best = math.huge
		do
			local i = 0
			local _first15 = true
			while true do
				if not _first15 then
					i += 1
				end
				_first15 = false
				if not (i < Js.alen(figs)) then break end
				do
					local j = (i + 1)
					local _first16 = true
					while true do
						if not _first16 then
							j += 1
						end
						_first16 = false
						if not (j < Js.alen(figs)) then break end
						if (exempt(sc, figs[i + 1], figs[j + 1]) or marking(figs[i + 1], figs[j + 1])) then
							do continue end
						end
						best = Math.min(best, dist(figs[i + 1].p, figs[j + 1].p))
					end
				end
			end
		end
		do return best end
	end
	exports.closestFigures = closestFigures
	closestMarking = function(sc)
		local figs = figuresOf(sc)
		local best = math.huge
		do
			local i = 0
			local _first17 = true
			while true do
				if not _first17 then
					i += 1
				end
				_first17 = false
				if not (i < Js.alen(figs)) then break end
				do
					local j = (i + 1)
					local _first18 = true
					while true do
						if not _first18 then
							j += 1
						end
						_first18 = false
						if not (j < Js.alen(figs)) then break end
						if marking(figs[i + 1], figs[j + 1]) then
							best = Math.min(best, dist(figs[i + 1].p, figs[j + 1].p))
						end
					end
				end
			end
		end
		do return best end
	end
	exports.closestMarking = closestMarking
	MIN_GAP = 1.2
	exports.MIN_GAP = MIN_GAP
	MARKING_GAP = 0.6
	exports.MARKING_GAP = MARKING_GAP
	MAX_MOVE = 5
	RING_STEP = 0.2
	DIRS = 24
	parked = function(p)
		return ((((p.x < -50) or (p.x > (M_pitch.PITCH_W + 50))) or (p.y > 150)) or (p.y < -50))
	end
	marking = function(a, b)
		return (((a.side == "att") and (b.side == "def")) or ((a.side == "def") and (b.side == "att")))
	end
	dist = function(a, b)
		return Math.hypot((a.x - b.x), (a.y - b.y))
	end
end
