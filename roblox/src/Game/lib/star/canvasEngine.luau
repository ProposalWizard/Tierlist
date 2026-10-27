--!nocheck
--!nolint
-- Generated from lib/star/canvasEngine.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_pitch = import("lib/star/pitch")
	local M_ballPhysics = import("lib/star/ballPhysics")
	local M_hitbox = import("lib/star/hitbox")
	local M_pitchWeather = import("lib/star/pitchWeather")
	local M_gameplayVersion = import("lib/star/gameplayVersion")
	local _T = {}
	_T.logBallAction = function(ball, a)
		local seq = ((if ball.actionSeq ~= nil then ball.actionSeq else 0) + 1)
		ball.actionSeq = seq
		local rec = Js.ospread(a, Js.O({ seq = seq, t = (if ball.clock ~= nil then ball.clock else 0) }, { "seq", "t" }))
		ball.lastAction = rec
		local log = (if ball.actionLog ~= nil then ball.actionLog else (function() local _a = Js.alit(); ball.actionLog = _a; return _a end)())
		A.push(log, rec)
		if (Js.alen(log) > _T.BALL_ACTION_LOG) then
			A.shift(log)
		end
	end
	exports.logBallAction = _T.logBallAction
	_T.runnerActor = function(scenario, r)
		if (not r) then
			do return "follower" end
		end
		local list = (if scenario.runner then Js.aspread(Js.alit(scenario.runner), scenario.secondaryRunners) else scenario.secondaryRunners)
		local i = A.indexOf(list, r)
		do return (if (i >= 0) then ("run" .. Js.numstr(i)) else "follower") end
	end
	_T.nearestDefenderActor = function(scenario, p)
		local best = -1
		local bd = math.huge
		A.forEach(scenario.defenders, function(d, i)
			local dd = Math.hypot((d.x - p.x), (d.y - p.y))
			if (dd < bd) then
				bd = dd
				best = i
			end
		end)
		do return (if (best >= 0) then ("def" .. Js.numstr(best)) else nil) end
	end
	_T.strikeShape = function(ball, header, volley, chip)
		if header then
			do return "header" end
		end
		if volley then
			do return "volley" end
		end
		if chip then
			do return "chip" end
		end
		do return (if (math.abs(ball.spin) > 0.6) then "curl" else "ground") end
	end
	_T.keeperTierFor = function(strength)
		local s = _T.clamp(strength, 0, 100)
		if (s < 45) then
			do return "easy" end
		end
		if (s < 70) then
			do return "normal" end
		end
		if (s < 88) then
			do return "hard" end
		end
		do return "expert" end
	end
	exports.keeperTierFor = _T.keeperTierFor
	_T.defenderReachMultiplier = function(quality)
		if (quality == nil) then
			do return 1 end
		end
		do return _T.clamp((0.82 + ((_T.clamp(quality, 0, 100) / 100) * 0.36)), 0.75, 1.25) end
	end
	exports.defenderReachMultiplier = _T.defenderReachMultiplier
	_T.clamp = function(v, lo, hi)
		do return Math.max(lo, Math.min(hi, v)) end
	end
	exports.clamp = _T.clamp
	_T.normalize = function(v)
		local l = (function() local _l = Math.hypot(v.x, v.y); if Js.T(_l) then return _l end; return 1 end)()
		do return Js.O({ x = (v.x / l), y = (v.y / l) }, { "x", "y" }) end
	end
	_T.rotateDeg = function(v, deg)
		local r = ((deg * Math.PI) / 180)
		local c = Math.cos(r)
		local s = Math.sin(r)
		do return Js.O({ x = ((v.x * c) - (v.y * s)), y = ((v.x * s) + (v.y * c)) }, { "x", "y" }) end
	end
	_T.gaussian = function(rng)
		do return (((((rng() + rng()) + rng()) + rng()) - 2) / 1) end
	end
	_T.makeKeeper = function(x, y, rng, allowAdvance)
		if y == nil then y = 0.8 end
		if allowAdvance == nil then allowAdvance = true end
		local kx = _T.clamp(x, (M_pitch.POST_L - 2.5), (M_pitch.POST_R + 2.5))
		local r = (if rng then rng() else 0.5)
		local advanced = (if (allowAdvance and rng) then (rng() < _T.KEEPER_OFF_LINE_ODDS) else false)
		local ky = (if advanced then (1.6 + ((if rng then rng() else 0.5) * (_T.KEEPER_OFF_LINE_MAX - 1.6))) else _T.clamp(y, 0.3, _T.KEEPER_LINE_MAX))
		do return Js.O({ x = kx, y = ky, startX = kx, targetX = kx, dive = 0, saves = 0, done = false, flash = 0, patrolT = (r * 4), patrolSeed = ((r * Math.PI) * 2), scrambling = false, adjusting = false, saveLunge = 0, saveDir = 0, saveKind = nil, idleT = (r * 3), pendingDone = false }, { "x", "y", "startX", "targetX", "dive", "saves", "done", "flash", "patrolT", "patrolSeed", "scrambling", "adjusting", "saveLunge", "saveDir", "saveKind", "idleT", "pendingDone" }) end
	end
	_T.makeRunner = function(to, from, speed, role)
		if speed == nil then speed = _T.RUNNER_SPEED end
		if role == nil then role = "target" end
		do return Js.O({ pos = Js.O({ x = from.x, y = from.y }, { "x", "y" }), to = Js.O({ x = to.x, y = to.y }, { "x", "y" }), speed = speed, moving = false, role = role, sprint = false }, { "pos", "to", "speed", "moving", "role", "sprint" }) end
	end
	_T.makeFollower = function(rng, by)
		do return Js.O({ x = _T.clamp((M_pitch.CX + ((if (rng() < 0.5) then -1 else 1) * (2 + (rng() * 5)))), (M_pitch.POST_L - 3), (M_pitch.POST_R + 3)), y = _T.clamp((by * 0.5), M_pitch.SIX_DEPTH, (M_pitch.PEN_SPOT_Y + 3)), active = false, shot = false }, { "x", "y", "active", "shot" }) end
	end
	_T.crossViewport = function(side, across)
		if across == nil then across = _T.CROSS_VIEW_X end
		local far = (if (side > 0) then ((M_pitch.PITCH_W + 3) - _T.CROSS_VIEW_X) else (-3 + _T.CROSS_VIEW_X))
		local h = across
		local w = (h * _T.VIEW_ASPECT)
		local x1 = (if (side > 0) then far else (far - h))
		do return Js.O({ x1 = x1, x2 = (x1 + h), y1 = -4.5, y2 = (-4.5 + w) }, { "x1", "x2", "y1", "y2" }) end
	end
	_T.crossViewportOnBall = function(ball, side, across)
		if across == nil then across = _T.CROSS_VIEW_X end
		local h = across
		local w = (h * _T.VIEW_ASPECT)
		local x1 = (if (side > 0) then (ball.x - (_T.BYLINE_BALL_DOWN * h)) else (ball.x - ((1 - _T.BYLINE_BALL_DOWN) * h)))
		if (side > 0) then
			x1 = Math.min(x1, (M_pitch.POST_L - 1.5))
		else
			x1 = Math.max(x1, ((M_pitch.POST_R + 1.5) - h))
		end
		do return Js.O({ x1 = x1, x2 = (x1 + h), y1 = -4.5, y2 = (-4.5 + w) }, { "x1", "x2", "y1", "y2" }) end
	end
	exports.crossViewportOnBall = _T.crossViewportOnBall
	_T.autoViewport = function(points, includeGoal, pad)
		if pad == nil then pad = 4 end
		local all = Js.aspread(points)
		if includeGoal then
			A.push(all, Js.O({ x = M_pitch.POST_L, y = 0 }, { "x", "y" }), Js.O({ x = M_pitch.POST_R, y = 0 }, { "x", "y" }), Js.O({ x = M_pitch.CX, y = (-M_pitch.NET_DEPTH) }, { "x", "y" }))
		end
		local x1 = Math.min(Js.unpack(A.map(all, function(p)
			return p.x
		end)))
		local x2 = Math.max(Js.unpack(A.map(all, function(p)
			return p.x
		end)))
		local y1 = Math.min(Js.unpack(A.map(all, function(p)
			return p.y
		end)))
		local y2 = Math.max(Js.unpack(A.map(all, function(p)
			return p.y
		end)))
		x1 -= pad
		x2 += pad
		y1 -= (pad * 0.875)
		y2 += (pad * 0.875)
		local h = Math.max((y2 - y1), ((x2 - x1) / _T.VIEW_ASPECT))
		if includeGoal then
			h = Math.max(h, Math.min(_T.VIEW_MAX_H, (y2 - Math.min(y1, (-M_pitch.NET_DEPTH)))))
		end
		h = _T.clamp(h, _T.VIEW_MIN_H, _T.VIEW_MAX_H)
		local w = (h * _T.VIEW_ASPECT)
		local cx = ((x1 + x2) / 2)
		local cy = ((y1 + y2) / 2)
		local vx1 = (cx - (w / 2))
		local vx2 = (cx + (w / 2))
		local vy1 = (cy - (h / 2))
		local vy2 = (cy + (h / 2))
		if includeGoal then
			local pin1 = ((-_T.GOAL_SCREEN_DROP) * h)
			local pin2 = (pin1 + h)
			if ((y1 >= (pin1 - 0.01)) and (y2 <= (pin2 + 0.01))) then
				vy1 = pin1
				vy2 = pin2
			end
		end
		local padX = 5
		local backPad = (M_pitch.NET_DEPTH + 2.5)
		local fwdPad = 6
		if (vx1 < (-padX)) then
			local s = ((-padX) - vx1)
			vx1 += s
			vx2 += s
		end
		if (vx2 > (M_pitch.PITCH_W + padX)) then
			local s = (vx2 - (M_pitch.PITCH_W + padX))
			vx1 -= s
			vx2 -= s
		end
		if (vy1 < (-backPad)) then
			local s = ((-backPad) - vy1)
			vy1 += s
			vy2 += s
		end
		if (vy2 > (M_pitch.HALF_LEN + fwdPad)) then
			local s = (vy2 - (M_pitch.HALF_LEN + fwdPad))
			vy1 -= s
			vy2 -= s
		end
		if includeGoal then
			if (vy1 > (-M_pitch.NET_DEPTH)) then
				local s = (vy1 + M_pitch.NET_DEPTH)
				vy1 -= s
				vy2 -= s
			end
			if (vx1 > M_pitch.POST_L) then
				local s = (vx1 - M_pitch.POST_L)
				vx1 -= s
				vx2 -= s
			end
			if (vx2 < M_pitch.POST_R) then
				local s = (M_pitch.POST_R - vx2)
				vx1 += s
				vx2 += s
			end
		end
		do return Js.O({ x1 = vx1, x2 = vx2, y1 = vy1, y2 = vy2 }, { "x1", "x2", "y1", "y2" }) end
	end
	_T.opponentLine = function(sc)
		local ys = A.map(sc.defenders, function(d)
			return d.y
		end)
		if _T.goalInView(sc.kind) then
			A.push(ys, sc.keeper.y)
		end
		do return A.sort(ys, function(a, b)
			return (a - b)
		end) end
	end
	_T.attackers = function(sc)
		local out = Js.alit()
		do
			local _arr1 = Js.aspread((if sc.runner then Js.alit(sc.runner) else Js.alit()), sc.secondaryRunners)
			local _i2 = 0
			while _i2 < Js.alen(_arr1) do
				_i2 += 1
				local r = _arr1[_i2]
				A.push(out, Js.O({ pos = r.pos, flag = function(v)
					r.offside = v
				end }, { "pos", "flag" }))
			end
		end
		A.push(out, Js.O({ pos = Js.O({ x = sc.follower.x, y = sc.follower.y }, { "x", "y" }), flag = function(v)
			sc.follower.offside = v
		end }, { "pos", "flag" }))
		do return out end
	end
	_T.setOffsideRuleEnabled = function(enabled)
		_T.offsideRuleEnabled = enabled
	end
	exports.setOffsideRuleEnabled = _T.setOffsideRuleEnabled
	_T.offsideSnapshot = function(sc, ballAt)
		if (not _T.offsideRuleEnabled) then
			_T.clearOffside(sc)
			do return end
		end
		if (sc.kind == "corner") then
			_T.clearOffside(sc)
			do return end
		end
		if (not _T.goalInView(sc.kind)) then
			_T.clearOffside(sc)
			do return end
		end
		local line = _T.opponentLine(sc)
		if (Js.alen(line) < 2) then
			_T.clearOffside(sc)
			do return end
		end
		local secondLast = line[2]
		do
			local _arr3 = _T.attackers(sc)
			local _i4 = 0
			while _i4 < Js.alen(_arr3) do
				_i4 += 1
				local a = _arr3[_i4]
				local inTheirHalf = (a.pos.y < (M_pitch.HALF_LEN - _T.OFFSIDE_EPS))
				local aheadOfBall = (a.pos.y < (ballAt.y - _T.OFFSIDE_EPS))
				local aheadOfLine = (a.pos.y < (secondLast - _T.OFFSIDE_EPS))
				a.flag(((inTheirHalf and aheadOfBall) and aheadOfLine))
			end
		end
	end
	exports.offsideSnapshot = _T.offsideSnapshot
	_T.offsideOffence = function(sc, flagged)
		if (not flagged) then
			do return false end
		end
		sc.offsideAgainst = true
		do return true end
	end
	_T.clearOffside = function(sc)
		do
			local _arr5 = _T.attackers(sc)
			local _i6 = 0
			while _i6 < Js.alen(_arr5) do
				_i6 += 1
				local a = _arr5[_i6]
				a.flag(false)
			end
		end
	end
	exports.clearOffside = _T.clearOffside
	_T.settleOnside = function(sc, rng)
		local judged = _T.goalInView(sc.kind)
		local line = _T.opponentLine(sc)
		local secondLast = (if (judged and (Js.alen(line) >= 2)) then line[2] else nil)
		local vp = sc.viewport
		local floor = (if vp then (vp.y2 - 1.4) else M_pitch.HALF_LEN)
		local settle = function(p)
			if ((secondLast == nil) or (p.y >= secondLast)) then
				do return end
			end
			p.y = Math.min(((secondLast + 0.3) + (rng() * 1.4)), floor)
			for i = 0, 11 do
				local near = ((Math.hypot((p.x - sc.player.x), (p.y - sc.player.y)) < 5) or (Math.hypot((p.x - sc.ball.x), (p.y - sc.ball.y)) < 5))
				if (not near) then
					do break end
				end
				local away = (if (p.x >= sc.ball.x) then 1 else -1)
				p.x = _T.clamp((p.x + (away * 1.6)), (if vp then (vp.x1 + 1.4) else 2), (if vp then (vp.x2 - 1.4) else (M_pitch.PITCH_W - 2)))
				p.y = Math.min((p.y + 0.6), floor)
			end
		end
		do
			local _arr7 = sc.secondaryRunners
			local _i8 = 0
			while _i8 < Js.alen(_arr7) do
				_i8 += 1
				local r = _arr7[_i8]
				settle(r.pos)
				r.to = Js.ospread(r.pos)
			end
		end
		if (sc.runner and (sc.kind ~= "through_ball")) then
			settle(sc.runner.pos)
			sc.runner.to = Js.ospread(sc.runner.pos)
		end
		local f = Js.O({ x = sc.follower.x, y = sc.follower.y }, { "x", "y" })
		settle(f)
		sc.follower.x = f.x
		sc.follower.y = f.y
		local lox = (if vp then (vp.x1 + 1.4) else 2)
		local hix = (if vp then (vp.x2 - 1.4) else (M_pitch.PITCH_W - 2))
		local loy = (if (secondLast ~= nil) then (secondLast + 0.3) else (if vp then Math.max((vp.y1 + 1.4), 0.3) else 1))
		local CLEAR = 4.5
		do
			local _arr9 = Js.aspread((if sc.runner then Js.alit(sc.runner) else Js.alit()), sc.secondaryRunners)
			local _i10 = 0
			while _i10 < Js.alen(_arr9) do
				_i10 += 1
				local r = _arr9[_i10]
				if (Math.hypot((r.pos.x - sc.player.x), (r.pos.y - sc.player.y)) >= CLEAR) then
					r.to = Js.ospread(r.pos)
					do continue end
				end
				local best = nil
				local _brk_outer, _cont_outer = false, false
				do
					local ring = CLEAR
					local _first11 = true
					while true do
						if not _first11 then
							ring += 1.2
						end
						_first11 = false
						if not ((ring <= (CLEAR + 7)) and (not best)) then break end
						for k = 0, 15 do
							local a2 = (((k / 16) * Math.PI) * 2)
							local p = Js.O({ x = (sc.player.x + (Math.cos(a2) * ring)), y = (sc.player.y + (Math.sin(a2) * ring)) }, { "x", "y" })
							if ((((p.x < lox) or (p.x > hix)) or (p.y < loy)) or (p.y > floor)) then
								do continue end
							end
							best = p
							_brk_outer = true
							do break end
						end
						if _brk_outer then break end
						if _cont_outer then _cont_outer = false; continue end
					end
				end
				if best then
					r.pos = best
				end
				r.to = Js.ospread(r.pos)
			end
		end
	end
	_T.fitToView = function(sc)
		local vp = sc.viewport
		local inset = 1.4
		local turned = ((sc.facing == "left") or (sc.facing == "right"))
		local wideDelivery = ((sc.kind == "corner") or (sc.kind == "byline_cross"))
		local floor = (if turned then (vp.y2 - 1.4) else (vp.y2 - ((vp.y2 - vp.y1) * 0.2)))
		local fx = function(x)
			return _T.clamp(x, (vp.x1 + inset), (vp.x2 - inset))
		end
		local fy = function(y)
			return _T.clamp(y, Math.max((vp.y1 + inset), 0.3), (vp.y2 - inset))
		end
		if (_T.CAMERA_MOVES_PLAYERS or wideDelivery) then
			do
				local _arr12 = sc.defenders
				local _i13 = 0
				while _i13 < Js.alen(_arr12) do
					_i13 += 1
					local d = _arr12[_i13]
					d.x = fx(d.x)
					d.y = fy(d.y)
				end
			end
		end
		do
			local _arr14 = Js.aspread((if sc.runner then Js.alit(sc.runner) else Js.alit()), sc.secondaryRunners)
			local _i15 = 0
			while _i15 < Js.alen(_arr14) do
				_i15 += 1
				local r = _arr14[_i15]
				r.pos.x = fx(r.pos.x)
				r.pos.y = fy(r.pos.y)
				r.to.x = fx(r.to.x)
				r.to.y = fy(r.to.y)
				if r.commandedTo then
					r.commandedTo.x = fx(r.commandedTo.x)
					r.commandedTo.y = fy(r.commandedTo.y)
				end
			end
		end
		if _T.goalInView(sc.kind) then
			sc.follower.x = fx(sc.follower.x)
			sc.follower.y = fy(sc.follower.y)
		end
		sc.ball = Js.O({ x = fx(sc.ball.x), y = Math.min(fy(sc.ball.y), floor) }, { "x", "y" })
		_T.standOff(sc, (vp.x1 + inset), (vp.x2 - inset))
		sc.player = Js.O({ x = sc.player.x, y = fy(sc.player.y) }, { "x", "y" })
		_T.syncPassTarget(sc, fx, fy)
		_T.clearOfTheBall(sc)
	end
	_T.clearThePassingLane = function(sc)
		if _T.goalInView(sc.kind) then
			do return end
		end
		local t = (if sc.runner then sc.runner.pos else sc.passTarget)
		if (not t) then
			do return end
		end
		local vp = sc.viewport
		local inset = 1.4
		local lox = (if vp then (vp.x1 + inset) else 2)
		local hix = (if vp then (vp.x2 - inset) else (M_pitch.PITCH_W - 2))
		local vx = (t.x - sc.ball.x)
		local vy = (t.y - sc.ball.y)
		local len = Math.hypot(vx, vy)
		if (len < 1) then
			do return end
		end
		local ux = (vx / len)
		local uy = (vy / len)
		do
			local _arr16 = sc.defenders
			local _i17 = 0
			while _i17 < Js.alen(_arr16) do
				_i17 += 1
				local d = _arr16[_i17]
				local px = (d.x - sc.ball.x)
				local py = (d.y - sc.ball.y)
				local along = ((px * ux) + (py * uy))
				if ((along < 0.5) or (along > (len - 0.5))) then
					do continue end
				end
				local off = ((px * (-uy)) + (py * ux))
				if (math.abs(off) >= _T.LANE_CLEAR) then
					do continue end
				end
				local side = (if (off >= 0) then 1 else -1)
				local place = function(s)
					return Js.O({ x = ((sc.ball.x + (ux * along)) + (((-uy) * s) * _T.LANE_CLEAR)), y = ((sc.ball.y + (uy * along)) + ((ux * s) * _T.LANE_CLEAR)) }, { "x", "y" })
				end
				local to = place(side)
				if ((to.x < lox) or (to.x > hix)) then
					to = place((-side))
				end
				d.x = _T.clamp(to.x, lox, hix)
				d.y = to.y
			end
		end
	end
	_T.clearOfTheBall = function(sc)
		local vp = sc.viewport
		local inset = 1.4
		local fx = function(x)
			return (if vp then _T.clamp(x, (vp.x1 + inset), (vp.x2 - inset)) else x)
		end
		local fy = function(y)
			return (if vp then _T.clamp(y, Math.max((vp.y1 + inset), 0.3), (vp.y2 - inset)) else Math.max(y, 0.3))
		end
		local push = function(p, want)
			local dx = (p.x - sc.ball.x)
			local dy = (p.y - sc.ball.y)
			local d = Math.hypot(dx, dy)
			if (d >= want) then
				do return end
			end
			local ux = (if (d > 0.01) then (dx / d) else 0)
			local uy = (if (d > 0.01) then (dy / d) else 1)
			local to = Js.O({ x = fx((sc.ball.x + (ux * want))), y = fy((sc.ball.y + (uy * want))) }, { "x", "y" })
			if (Math.hypot((to.x - sc.ball.x), (to.y - sc.ball.y)) < (want - 0.05)) then
				to.x = fx((sc.ball.x - (ux * want)))
				to.y = fy((sc.ball.y - (uy * want)))
			end
			p.x = to.x
			p.y = to.y
		end
		do
			local _arr18 = sc.defenders
			local _i19 = 0
			while _i19 < Js.alen(_arr18) do
				_i19 += 1
				local d = _arr18[_i19]
				push(d, _T.CLEAR_OF_BALL)
			end
		end
		local k = sc.keeper
		local want = (_T.KEEPER_BODY_R + 1.6)
		local off = function()
			return Math.hypot((k.x - sc.ball.x), (k.y - sc.ball.y))
		end
		if (off() < want) then
			k.y = _T.clamp(Math.min(k.y, (sc.ball.y - want)), 0.35, k.y)
			if (off() < want) then
				local dy = math.abs((k.y - sc.ball.y))
				local need = (Math.sqrt(Math.max(0, ((want * want) - (dy * dy)))) + 0.05)
				local side = (function() local _l = Math.sign((k.x - sc.ball.x)); if Js.T(_l) then return _l end; return 1 end)()
				local across = function(s)
					return fx(_T.clamp((sc.ball.x + (s * need)), (M_pitch.POST_L - 2.5), (M_pitch.POST_R + 2.5)))
				end
				k.x = across(side)
				if (off() < want) then
					k.x = across((-side))
				end
			end
			k.startX = k.x
		end
	end
	_T.syncPassTarget = function(sc, fx, fy)
		if (not sc.passTarget) then
			do return end
		end
		local to = (if sc.runner then sc.runner.to else sc.passTarget)
		sc.passTarget = Js.O({ x = fx(to.x), y = fy(to.y) }, { "x", "y" })
	end
	_T.keepInsideTheCut = function(sc)
		local cut = sc.crossSwitchView
		if (not cut) then
			do return end
		end
		local inset = 1.4
		local fx = function(x)
			return _T.clamp(x, (cut.x1 + inset), (cut.x2 - inset))
		end
		local fy = function(y)
			return _T.clamp(y, Math.max((cut.y1 + inset), 0.3), (cut.y2 - inset))
		end
		do
			local _arr20 = sc.defenders
			local _i21 = 0
			while _i21 < Js.alen(_arr20) do
				_i21 += 1
				local d = _arr20[_i21]
				d.x = fx(d.x)
				d.y = fy(d.y)
			end
		end
		do
			local _arr22 = Js.aspread((if sc.runner then Js.alit(sc.runner) else Js.alit()), sc.secondaryRunners)
			local _i23 = 0
			while _i23 < Js.alen(_arr22) do
				_i23 += 1
				local r = _arr22[_i23]
				r.pos.x = fx(r.pos.x)
				r.pos.y = fy(r.pos.y)
				r.to = Js.ospread(r.pos)
			end
		end
		sc.follower.x = fx(sc.follower.x)
		sc.follower.y = fy(sc.follower.y)
		sc.keeper.x = fx(sc.keeper.x)
		do
			local _arr24 = Js.aspread((if sc.runner then Js.alit(sc.runner) else Js.alit()), sc.secondaryRunners)
			local _i25 = 0
			while _i25 < Js.alen(_arr24) do
				_i25 += 1
				local r = _arr24[_i25]
				if (Math.hypot((r.pos.x - sc.player.x), (r.pos.y - sc.player.y)) >= 4.5) then
					do continue end
				end
				do
					local ring = 4.5
					local _first26 = true
					while true do
						if not _first26 then
							ring += 1.2
						end
						_first26 = false
						if not (ring <= 11) then break end
						local placed = false
						do
							local k = 0
							local _first27 = true
							while true do
								if not _first27 then
									k += 1
								end
								_first27 = false
								if not ((k < 16) and (not placed)) then break end
								local a = (((k / 16) * Math.PI) * 2)
								local p = Js.O({ x = (sc.player.x + (Math.cos(a) * ring)), y = (sc.player.y + (Math.sin(a) * ring)) }, { "x", "y" })
								if ((p.x < (cut.x1 + inset)) or (p.x > (cut.x2 - inset))) then
									do continue end
								end
								if ((p.y < Math.max((cut.y1 + inset), 0.3)) or (p.y > (cut.y2 - inset))) then
									do continue end
								end
								r.pos = p
								r.to = Js.ospread(p)
								placed = true
							end
						end
						if placed then
							do break end
						end
					end
				end
			end
		end
		_T.syncPassTarget(sc, fx, fy)
	end
	_T.standOff = function(sc, lo, hi)
		if ((sc.facing == "left") or (sc.facing == "right")) then
			local prefer = (if (sc.player.y >= sc.ball.y) then 1 else -1)
			sc.player = Js.O({ x = _T.clamp((sc.ball.x + (_T.STANDOFF_BACK * (if (sc.ball.x > M_pitch.CX) then 1 else -1))), 1, (M_pitch.PITCH_W - 1)), y = _T.clamp((sc.ball.y + (prefer * _T.STANDOFF_SIDE)), 0.5, (M_pitch.HALF_LEN + 6)) }, { "x", "y" })
			do return end
		end
		local minX = (if lo ~= nil then lo else 1)
		local maxX = (if hi ~= nil then hi else (M_pitch.PITCH_W - 1))
		local prefer = (if (sc.player.x >= sc.ball.x) then 1 else -1)
		local fits = function(side)
			local x = (sc.ball.x + (side * _T.STANDOFF_SIDE))
			do return ((x >= minX) and (x <= maxX)) end
		end
		local side = (if fits(prefer) then prefer else (if fits((-prefer)) then (-prefer) else prefer))
		sc.player = Js.O({ x = _T.clamp((sc.ball.x + (side * _T.STANDOFF_SIDE)), minX, maxX), y = _T.clamp((sc.ball.y + _T.STANDOFF_BACK), 0.5, (M_pitch.HALF_LEN + 6)) }, { "x", "y" })
	end
	exports.standOff = _T.standOff
	_T.goalInView = function(kind)
		do return ((kind ~= "buildup") and (kind ~= "midfield_pass")) end
	end
	exports.goalInView = _T.goalInView
	_T.scenarioViewport = function(sc)
		local pts = Js.alit(sc.ball, sc.player)
		local showGoal = _T.goalInView(sc.kind)
		if showGoal then
			A.push(pts, Js.O({ x = sc.keeper.x, y = sc.keeper.y }, { "x", "y" }))
		end
		local SHOT_FRAMED_TIGHT = (((sc.kind == "one_on_one") or (sc.kind == "header")) or (sc.kind == "volley"))
		if (not SHOT_FRAMED_TIGHT) then
			do
				local _arr28 = sc.defenders
				local _i29 = 0
				while _i29 < Js.alen(_arr28) do
					_i29 += 1
					local d = _arr28[_i29]
					A.push(pts, d)
				end
			end
		end
		if sc.runner then
			A.push(pts, sc.runner.pos)
			A.push(pts, sc.runner.to)
		end
		do
			local _arr30 = (if sc.secondaryRunners ~= nil then sc.secondaryRunners else Js.alit())
			local _i31 = 0
			while _i31 < Js.alen(_arr30) do
				_i31 += 1
				local r = _arr30[_i31]
				A.push(pts, r.pos)
				A.push(pts, r.to)
			end
		end
		if ((sc.kind == "corner") or (sc.kind == "byline_cross")) then
			do return _T.WIDE_DELIVERY_VIEW end
		end
		do return _T.autoViewport(pts, showGoal) end
	end
	_T.rollReceiver = function(kind, rng)
		local options = _T.RECEIVER_ROLES[kind]
		if (not options) then
			do return nil end
		end
		local pick = options[Math.min((Js.alen(options) - 1), math.floor((rng() * Js.alen(options)))) + 1]
		do return Js.O({ skill = (pick.skillMin + (rng() * (pick.skillMax - pick.skillMin))), roleLabel = pick.label }, { "skill", "roleLabel" }) end
	end
	_T.buildOneOnOne = function(rng, keeperStrength, teamRelationship)
		local shape = rng()
		local side = (if (rng() < 0.5) then -1 else 1)
		local bx = nil
		local by = nil
		if (shape < 0.22) then
			bx = (M_pitch.CX + ((rng() - 0.5) * 5))
			by = (17 + (rng() * 6))
		elseif (shape < 0.44) then
			bx = (M_pitch.CX + (side * (7 + (rng() * 6))))
			by = (11 + (rng() * 6))
		elseif (shape < 0.62) then
			bx = (M_pitch.CX + ((rng() - 0.5) * 8))
			by = (7 + (rng() * 4))
		else
			bx = (M_pitch.CX + ((rng() - 0.5) * 12))
			by = (13 + (rng() * 7))
		end
		local rush = rng()
		local keeperY = (if (rush < 0.24) then (4 + (rng() * 3.2)) else (if (rush < 0.4) then (2 + (rng() * 1.6)) else (0.5 + (rng() * 0.9))))
		local shade = (if (keeperY > 3.5) then 0.28 else (0.45 + (rng() * 0.2)))
		local keeperX = _T.clamp((M_pitch.CX + ((bx - M_pitch.CX) * shade)), (M_pitch.POST_L - 1), (M_pitch.POST_R + 1))
		local company = rng()
		local defenders = Js.alit()
		if (company < 0.18) then
		elseif (company < 0.42) then
			A.push(defenders, Js.O({ x = _T.clamp((bx + (side * (1.4 + (rng() * 1.4)))), 6, (M_pitch.PITCH_W - 6)), y = _T.clamp(((by - 0.6) + (rng() * 2.2)), 3.5, (by + 2)) }, { "x", "y" }))
		else
			A.push(defenders, Js.O({ x = _T.clamp((bx + ((rng() - 0.5) * 6)), 8, (M_pitch.PITCH_W - 8)), y = ((by + 2.5) + (rng() * 4.5)) }, { "x", "y" }))
		end
		do return Js.O({ ball = Js.O({ x = bx, y = by }, { "x", "y" }), player = Js.O({ x = bx, y = (by + 1.2) }, { "x", "y" }), defenders = defenders, keeper = _T.makeKeeper(keeperX, keeperY, rng), keeperStrength = keeperStrength, follower = _T.makeFollower(rng, by), goal = _T.GOAL, crossbar = _T.CROSSBAR, kind = "one_on_one", teammates = Js.alit(), runner = nil, passTarget = nil, receiver = nil, receiverDone = false, teamRelationship = teamRelationship }, { "ball", "player", "defenders", "keeper", "keeperStrength", "follower", "goal", "crossbar", "kind", "teammates", "runner", "passTarget", "receiver", "receiverDone", "teamRelationship" }) end
	end
	_T.buildTightAngle = function(rng, keeperStrength, teamRelationship)
		local side = (if (rng() < 0.5) then -1 else 1)
		local shape = rng()
		local bx = nil
		local by = nil
		local keeperX = nil
		local keeperY = nil
		local defenders = Js.alit()
		if (shape < 0.26) then
			bx = (M_pitch.CX + (side * (13 + (rng() * 4))))
			by = (1.2 + (rng() * 2.4))
			keeperX = _T.clamp((M_pitch.CX + (side * 3.4)), (M_pitch.POST_L + 0.3), (M_pitch.POST_R - 0.3))
			keeperY = (0.5 + (rng() * 0.6))
			A.push(defenders, Js.O({ x = _T.clamp((bx - (side * (1.6 + (rng() * 1.4)))), 6, (M_pitch.PITCH_W - 6)), y = _T.clamp((by + 1), 1.5, 8) }, { "x", "y" }))
		elseif (shape < 0.5) then
			bx = (M_pitch.CX + (side * (10 + (rng() * 5))))
			by = (4 + (rng() * 4))
			keeperX = _T.clamp((M_pitch.CX + (side * 3)), (M_pitch.POST_L + 0.4), (M_pitch.POST_R - 0.4))
			keeperY = (1.8 + (rng() * 1.6))
			A.push(defenders, Js.O({ x = _T.clamp((M_pitch.CX - (side * 3)), M_pitch.POST_L, M_pitch.POST_R), y = (0.9 + (rng() * 0.8)) }, { "x", "y" }))
			A.push(defenders, Js.O({ x = _T.clamp((bx - (side * 2.6)), 6, (M_pitch.PITCH_W - 6)), y = _T.clamp((by + 1.4), 2, 10) }, { "x", "y" }))
		elseif (shape < 0.72) then
			bx = (M_pitch.CX + (side * (9 + (rng() * 5))))
			by = (8 + (rng() * 5))
			keeperX = _T.clamp((M_pitch.CX + (side * 2)), (M_pitch.POST_L + 0.4), (M_pitch.POST_R - 0.4))
			keeperY = (0.8 + (rng() * 1.2))
			A.push(defenders, Js.O({ x = _T.clamp((bx - (side * (2 + (rng() * 2)))), 6, (M_pitch.PITCH_W - 6)), y = _T.clamp(((by - 1) + (rng() * 3)), 2, 12) }, { "x", "y" }))
		else
			bx = (M_pitch.CX + (side * (11 + (rng() * 6))))
			by = (3 + (rng() * 6))
			keeperX = _T.clamp((M_pitch.CX + (side * 2.6)), (M_pitch.POST_L + 0.4), (M_pitch.POST_R - 0.4))
			keeperY = (0.9 + (rng() * 0.8))
			A.push(defenders, Js.O({ x = _T.clamp((bx - (side * 2.5)), 6, (M_pitch.PITCH_W - 6)), y = _T.clamp((by + 1.5), 2, 10) }, { "x", "y" }))
		end
		do return Js.O({ ball = Js.O({ x = bx, y = by }, { "x", "y" }), player = Js.O({ x = (bx + (side * 0.9)), y = (by + 0.9) }, { "x", "y" }), defenders = defenders, keeper = _T.makeKeeper(keeperX, keeperY, rng), keeperStrength = keeperStrength, follower = _T.makeFollower(rng, by), goal = _T.GOAL, crossbar = _T.CROSSBAR, kind = "tight_angle", teammates = Js.alit(), runner = nil, passTarget = nil, receiver = nil, receiverDone = false, teamRelationship = teamRelationship }, { "ball", "player", "defenders", "keeper", "keeperStrength", "follower", "goal", "crossbar", "kind", "teammates", "runner", "passTarget", "receiver", "receiverDone", "teamRelationship" }) end
	end
	_T.buildLongRange = function(rng, keeperStrength, teamRelationship)
		local shape = rng()
		local side = (if (rng() < 0.5) then -1 else 1)
		if (shape < 0.34) then
			local bx = (M_pitch.CX + ((rng() - 0.5) * 20))
			local by = (24 + (rng() * 10))
			local line = _T.clamp((by * 0.42), 8, 17)
			do return Js.O({ ball = Js.O({ x = bx, y = by }, { "x", "y" }), player = Js.O({ x = bx, y = (by + 1.3) }, { "x", "y" }), defenders = Js.alit(Js.O({ x = _T.clamp(((M_pitch.CX - 3.5) - (rng() * 7)), 9, (M_pitch.PITCH_W - 9)), y = (line + (rng() * 1.8)) }, { "x", "y" }), Js.O({ x = _T.clamp(((M_pitch.CX + 3.5) + (rng() * 7)), 9, (M_pitch.PITCH_W - 9)), y = ((line + 1.2) + (rng() * 2.4)) }, { "x", "y" })), keeper = _T.makeKeeper((M_pitch.CX + ((rng() - 0.5) * 2)), (1.6 + (rng() * 1.4)), rng), keeperStrength = keeperStrength, follower = _T.makeFollower(rng, by), goal = _T.GOAL, crossbar = _T.CROSSBAR, kind = "long_range", teammates = Js.alit(), runner = nil, passTarget = nil, receiver = nil, receiverDone = false, teamRelationship = teamRelationship }, { "ball", "player", "defenders", "keeper", "keeperStrength", "follower", "goal", "crossbar", "kind", "teammates", "runner", "passTarget", "receiver", "receiverDone", "teamRelationship" }) end
		end
		if (shape < 0.56) then
			local bx = (M_pitch.CX + ((rng() - 0.5) * 16))
			local by = (23 + (rng() * 7))
			local mate = Js.O({ x = (M_pitch.CX + (side * (3 + (rng() * 6)))), y = (7 + (rng() * 6)) }, { "x", "y" })
			do return Js.O({ ball = Js.O({ x = bx, y = by }, { "x", "y" }), player = Js.O({ x = bx, y = (by + 1.3) }, { "x", "y" }), defenders = Js.alit(Js.O({ x = _T.clamp((M_pitch.CX - (side * (4 + (rng() * 5)))), 9, (M_pitch.PITCH_W - 9)), y = (14 + (rng() * 3)) }, { "x", "y" }), Js.O({ x = _T.clamp((mate.x - (side * (2.4 + (rng() * 1.6)))), 8, (M_pitch.PITCH_W - 8)), y = _T.clamp((mate.y + 1.2), 4, 12) }, { "x", "y" }), Js.O({ x = _T.clamp((M_pitch.CX + ((rng() - 0.5) * 9)), 8, (M_pitch.PITCH_W - 8)), y = (6 + (rng() * 4)) }, { "x", "y" })), keeper = _T.makeKeeper((M_pitch.CX + ((rng() - 0.5) * 2.5)), (1.2 + (rng() * 1.2)), rng), keeperStrength = keeperStrength, follower = _T.makeFollower(rng, by), goal = _T.GOAL, crossbar = _T.CROSSBAR, kind = "long_range", teammates = Js.alit(), runner = _T.makeRunner(mate, Js.O({ x = (mate.x + (side * 1.5)), y = (mate.y + 2.5) }, { "x", "y" })), passTarget = mate, receiver = nil, receiverDone = false, teamRelationship = teamRelationship }, { "ball", "player", "defenders", "keeper", "keeperStrength", "follower", "goal", "crossbar", "kind", "teammates", "runner", "passTarget", "receiver", "receiverDone", "teamRelationship" }) end
		end
		if (shape < 0.74) then
			local bx = (M_pitch.CX + (side * (10 + (rng() * 6))))
			local by = (21 + (rng() * 8))
			local line = _T.clamp((by * 0.44), 9, 17)
			do return Js.O({ ball = Js.O({ x = bx, y = by }, { "x", "y" }), player = Js.O({ x = (bx - (side * 0.8)), y = (by + 1.2) }, { "x", "y" }), defenders = Js.alit(Js.O({ x = _T.clamp((bx - (side * (3 + (rng() * 2.5)))), 8, (M_pitch.PITCH_W - 8)), y = _T.clamp(((by - 3) - (rng() * 3)), 6, 24) }, { "x", "y" }), Js.O({ x = _T.clamp((M_pitch.CX + ((rng() - 0.5) * 6)), 9, (M_pitch.PITCH_W - 9)), y = (line + (rng() * 2)) }, { "x", "y" })), keeper = _T.makeKeeper((M_pitch.CX + (side * (1.5 + (rng() * 1.6)))), (1.4 + (rng() * 1.2)), rng), keeperStrength = keeperStrength, follower = _T.makeFollower(rng, by), goal = _T.GOAL, crossbar = _T.CROSSBAR, kind = "long_range", teammates = Js.alit(), runner = nil, passTarget = nil, receiver = nil, receiverDone = false, teamRelationship = teamRelationship }, { "ball", "player", "defenders", "keeper", "keeperStrength", "follower", "goal", "crossbar", "kind", "teammates", "runner", "passTarget", "receiver", "receiverDone", "teamRelationship" }) end
		end
		if (shape < 0.88) then
			local bx = (M_pitch.CX + ((rng() - 0.5) * 18))
			local by = (25 + (rng() * 8))
			do return Js.O({ ball = Js.O({ x = bx, y = by }, { "x", "y" }), player = Js.O({ x = bx, y = (by + 1.3) }, { "x", "y" }), defenders = Js.alit(Js.O({ x = _T.clamp((bx + (side * (2.2 + (rng() * 2.4)))), 8, (M_pitch.PITCH_W - 8)), y = ((by - 4.2) - (rng() * 1.6)) }, { "x", "y" }), Js.O({ x = _T.clamp(((M_pitch.CX - 5) - (rng() * 5)), 9, (M_pitch.PITCH_W - 9)), y = (13 + (rng() * 3)) }, { "x", "y" }), Js.O({ x = _T.clamp(((M_pitch.CX + 5) + (rng() * 5)), 9, (M_pitch.PITCH_W - 9)), y = (13 + (rng() * 3)) }, { "x", "y" })), keeper = _T.makeKeeper((M_pitch.CX + ((rng() - 0.5) * 2)), (1.5 + (rng() * 1.3)), rng), keeperStrength = keeperStrength, follower = _T.makeFollower(rng, by), goal = _T.GOAL, crossbar = _T.CROSSBAR, kind = "long_range", teammates = Js.alit(), runner = nil, passTarget = nil, receiver = nil, receiverDone = false, teamRelationship = teamRelationship }, { "ball", "player", "defenders", "keeper", "keeperStrength", "follower", "goal", "crossbar", "kind", "teammates", "runner", "passTarget", "receiver", "receiverDone", "teamRelationship" }) end
		end
		local bx = (M_pitch.CX + ((rng() - 0.5) * 12))
		local by = (30 + (rng() * 5))
		do return Js.O({ ball = Js.O({ x = bx, y = by }, { "x", "y" }), player = Js.O({ x = bx, y = (by + 1.3) }, { "x", "y" }), defenders = Js.alit(Js.O({ x = _T.clamp(((M_pitch.CX - 6) - (rng() * 6)), 9, (M_pitch.PITCH_W - 9)), y = (10 + (rng() * 3)) }, { "x", "y" }), Js.O({ x = _T.clamp(((M_pitch.CX + 6) + (rng() * 6)), 9, (M_pitch.PITCH_W - 9)), y = (10 + (rng() * 3)) }, { "x", "y" })), keeper = _T.makeKeeper((M_pitch.CX + ((rng() - 0.5) * 2)), (2.2 + (rng() * 1.8)), rng), keeperStrength = keeperStrength, follower = _T.makeFollower(rng, by), goal = _T.GOAL, crossbar = _T.CROSSBAR, kind = "long_range", teammates = Js.alit(), runner = nil, passTarget = nil, receiver = nil, receiverDone = false, teamRelationship = teamRelationship }, { "ball", "player", "defenders", "keeper", "keeperStrength", "follower", "goal", "crossbar", "kind", "teammates", "runner", "passTarget", "receiver", "receiverDone", "teamRelationship" }) end
	end
	_T.buildVolley = function(rng, keeperStrength, teamRelationship)
		local bx = (M_pitch.CX + ((rng() - 0.5) * 13))
		local by = (11 + (rng() * 6))
		local side = (if (rng() < 0.5) then -1 else 1)
		local crosser = Js.O({ x = (if (side < 0) then (4 + (rng() * 5)) else ((M_pitch.PITCH_W - 9) + (rng() * 5))), y = (5 + (rng() * 5)) }, { "x", "y" })
		local line = _T.clamp((by * 0.45), 5.5, 9.5)
		local shade = (if (rng() < 0.5) then -1 else 1)
		do return Js.O({ ball = Js.O({ x = bx, y = by }, { "x", "y" }), player = Js.O({ x = bx, y = (by + 1) }, { "x", "y" }), defenders = Js.alit(Js.O({ x = _T.clamp((M_pitch.CX + (shade * (2 + (rng() * 3.5)))), 10, (M_pitch.PITCH_W - 10)), y = (line + (rng() * 1.8)) }, { "x", "y" })), keeper = _T.makeKeeper((M_pitch.CX + ((rng() - 0.5) * 2)), (1.4 + (rng() * 1.2)), rng), keeperStrength = keeperStrength, follower = _T.makeFollower(rng, by), goal = _T.GOAL, crossbar = _T.CROSSBAR, kind = "volley", teammates = Js.alit(crosser), runner = nil, passTarget = nil, receiver = nil, receiverDone = false, teamRelationship = teamRelationship }, { "ball", "player", "defenders", "keeper", "keeperStrength", "follower", "goal", "crossbar", "kind", "teammates", "runner", "passTarget", "receiver", "receiverDone", "teamRelationship" }) end
	end
	_T.buildHeader = function(rng, keeperStrength, teamRelationship)
		local bx = (M_pitch.CX + ((rng() - 0.5) * 9))
		local by = (3.5 + (rng() * 3.5))
		local side = (if (rng() < 0.5) then -1 else 1)
		local crosser = Js.O({ x = (if (side < 0) then (3 + (rng() * 4)) else ((M_pitch.PITCH_W - 7) + (rng() * 4))), y = (4 + (rng() * 4)) }, { "x", "y" })
		do return Js.O({ ball = Js.O({ x = bx, y = by }, { "x", "y" }), player = Js.O({ x = bx, y = (by + 1) }, { "x", "y" }), defenders = Js.alit(Js.O({ x = _T.clamp((bx - (side * (1.5 + (rng() * 1.1)))), 8, (M_pitch.PITCH_W - 8)), y = _T.clamp((by - 0.8), 1.5, 8) }, { "x", "y" })), keeper = _T.makeKeeper((M_pitch.CX + ((rng() - 0.5) * 2.5)), (0.7 + (rng() * 0.8)), rng), keeperStrength = keeperStrength, follower = _T.makeFollower(rng, by), goal = _T.GOAL, crossbar = _T.CROSSBAR, kind = "header", teammates = Js.alit(crosser), runner = nil, passTarget = nil, receiver = nil, receiverDone = false, teamRelationship = teamRelationship }, { "ball", "player", "defenders", "keeper", "keeperStrength", "follower", "goal", "crossbar", "kind", "teammates", "runner", "passTarget", "receiver", "receiverDone", "teamRelationship" }) end
	end
	_T.buildCutback = function(rng, keeperStrength, teamRelationship)
		local side = (if (rng() < 0.5) then -1 else 1)
		local bx = (M_pitch.CX + (side * (9 + (rng() * 5))))
		local by = (1 + (rng() * 3))
		local to = Js.O({ x = (M_pitch.CX + ((rng() - 0.5) * 7)), y = ((M_pitch.PEN_SPOT_Y - 1) + (rng() * 3)) }, { "x", "y" })
		local from = Js.O({ x = (to.x + ((rng() - 0.5) * 3)), y = ((to.y + 2.5) + (rng() * 1.5)) }, { "x", "y" })
		do return Js.O({ ball = Js.O({ x = bx, y = by }, { "x", "y" }), player = Js.O({ x = (bx + (side * 0.8)), y = (by + 0.9) }, { "x", "y" }), defenders = Js.alit(Js.O({ x = _T.clamp((to.x - (side * 3.5)), 8, (M_pitch.PITCH_W - 8)), y = _T.clamp((to.y - 1.5), 4, 12) }, { "x", "y" })), keeper = _T.makeKeeper((M_pitch.CX + (side * 1.5)), (0.7 + (rng() * 0.7)), rng), keeperStrength = keeperStrength, follower = _T.makeFollower(rng, by), goal = _T.GOAL, crossbar = _T.CROSSBAR, kind = "cutback", teammates = Js.alit(), runner = _T.makeRunner(to, from), passTarget = to, receiver = _T.rollReceiver("cutback", rng), receiverDone = false, teamRelationship = teamRelationship }, { "ball", "player", "defenders", "keeper", "keeperStrength", "follower", "goal", "crossbar", "kind", "teammates", "runner", "passTarget", "receiver", "receiverDone", "teamRelationship" }) end
	end
	_T.buildBylineCross = function(rng, keeperStrength, teamRelationship)
		local side = (if (rng() < 0.5) then -1 else 1)
		local bx = _T.WIDE_DELIVERY_X(side)
		local by = (1 + (rng() * 3.5))
		local to = Js.O({ x = (M_pitch.CX + ((rng() - 0.5) * 11)), y = (4.5 + (rng() * 5)) }, { "x", "y" })
		local from = Js.O({ x = (to.x - (side * 2.5)), y = ((to.y + 2.5) + (rng() * 1.5)) }, { "x", "y" })
		do return Js.O({ ball = Js.O({ x = bx, y = by }, { "x", "y" }), player = Js.O({ x = (bx + (side * 0.8)), y = (by + 0.9) }, { "x", "y" }), defenders = Js.alit(Js.O({ x = _T.clamp((to.x - (side * 2.2)), 8, (M_pitch.PITCH_W - 8)), y = _T.clamp((to.y - 0.8), 3, 11) }, { "x", "y" }), Js.O({ x = _T.clamp((M_pitch.CX + (side * 3)), 8, (M_pitch.PITCH_W - 8)), y = _T.clamp((to.y + 2.5), 5, 13) }, { "x", "y" })), keeper = _T.makeKeeper((M_pitch.CX - (side * 1.2)), (1 + (rng() * 0.9)), rng), keeperStrength = keeperStrength, follower = _T.makeFollower(rng, by), goal = _T.GOAL, crossbar = _T.CROSSBAR, kind = "byline_cross", teammates = Js.alit(), runner = _T.makeRunner(to, from), passTarget = to, receiver = _T.rollReceiver("byline_cross", rng), receiverDone = false, teamRelationship = teamRelationship }, { "ball", "player", "defenders", "keeper", "keeperStrength", "follower", "goal", "crossbar", "kind", "teammates", "runner", "passTarget", "receiver", "receiverDone", "teamRelationship" }) end
	end
	_T.buildThroughBall = function(rng, keeperStrength, teamRelationship)
		local bx = (M_pitch.CX + ((rng() - 0.5) * 16))
		local by = (28 + (rng() * 10))
		local lineY = _T.clamp(((by - 9) - (rng() * 4)), 15, 24)
		local defenders = Js.alit(Js.O({ x = _T.clamp(((M_pitch.CX - 5) - (rng() * 4)), 10, (M_pitch.PITCH_W - 10)), y = lineY }, { "x", "y" }), Js.O({ x = _T.clamp(((M_pitch.CX + 5) + (rng() * 4)), 10, (M_pitch.PITCH_W - 10)), y = ((lineY + 0.6) + (rng() * 1.2)) }, { "x", "y" }))
		local line = A.sort(Js.aspread(A.map(defenders, function(d)
			return d.y
		end), Js.alit(2)), function(a, b)
			return (a - b)
		end)[2]
		local early = (rng() < 0.18)
		local startY = (if early then (line - (0.4 + (rng() * 1.6))) else ((line + 0.15) + (rng() * 2.2)))
		local from = Js.O({ x = _T.clamp((M_pitch.CX + ((rng() - 0.5) * 14)), 12, (M_pitch.PITCH_W - 12)), y = startY }, { "x", "y" })
		local to = Js.O({ x = _T.clamp((from.x + ((rng() - 0.5) * 4)), 12, (M_pitch.PITCH_W - 12)), y = _T.clamp(((from.y - 2) - (rng() * 2)), 6, M_pitch.HALF_LEN) }, { "x", "y" })
		do return Js.O({ ball = Js.O({ x = bx, y = by }, { "x", "y" }), player = Js.O({ x = bx, y = (by + 1.3) }, { "x", "y" }), defenders = defenders, keeper = _T.makeKeeper((M_pitch.CX + ((rng() - 0.5) * 2)), (2 + (rng() * 2)), rng), keeperStrength = keeperStrength, follower = _T.makeFollower(rng, by), goal = _T.GOAL, crossbar = _T.CROSSBAR, kind = "through_ball", teammates = Js.alit(), runner = _T.makeRunner(to, from), passTarget = to, receiver = _T.rollReceiver("through_ball", rng), receiverDone = false, teamRelationship = teamRelationship }, { "ball", "player", "defenders", "keeper", "keeperStrength", "follower", "goal", "crossbar", "kind", "teammates", "runner", "passTarget", "receiver", "receiverDone", "teamRelationship" }) end
	end
	_T.buildMidfieldPass = function(rng, keeperStrength, teamRelationship)
		local bx = (14 + (rng() * (M_pitch.PITCH_W - 28)))
		local by = (34 + (rng() * 12))
		local to = Js.O({ x = _T.clamp((bx + ((rng() - 0.5) * 20)), 8, (M_pitch.PITCH_W - 8)), y = _T.clamp(((by - 6) - (rng() * 7)), 24, 44) }, { "x", "y" })
		local from = Js.O({ x = (to.x + ((rng() - 0.5) * 3)), y = ((to.y + 2) + (rng() * 2)) }, { "x", "y" })
		do return Js.O({ ball = Js.O({ x = bx, y = by }, { "x", "y" }), player = Js.O({ x = bx, y = (by + 1.3) }, { "x", "y" }), defenders = Js.alit(Js.O({ x = _T.clamp((((bx + to.x) / 2) + ((rng() - 0.5) * 7)), 8, (M_pitch.PITCH_W - 8)), y = _T.clamp(((by + to.y) / 2), 28, 44) }, { "x", "y" })), keeper = _T.makeKeeper(M_pitch.CX, 1.5, rng), keeperStrength = keeperStrength, follower = _T.makeFollower(rng, by), goal = _T.GOAL, crossbar = _T.CROSSBAR, kind = "midfield_pass", teammates = Js.alit(), runner = _T.makeRunner(to, from, (_T.RUNNER_SPEED * 0.55)), passTarget = to, receiver = nil, receiverDone = false, teamRelationship = teamRelationship }, { "ball", "player", "defenders", "keeper", "keeperStrength", "follower", "goal", "crossbar", "kind", "teammates", "runner", "passTarget", "receiver", "receiverDone", "teamRelationship" }) end
	end
	_T.buildPenalty = function(rng, keeperStrength, teamRelationship)
		local followerSide = (if (rng() < 0.5) then -1 else 1)
		local dx = (7.2 + (rng() * 1.3))
		local rowY = ((M_pitch.BOX_DEPTH + 0.7) + (rng() * 1.1))
		local mateY = ((rowY + 1.5) + (rng() * 1.1))
		local leftDefender = Js.O({ x = (M_pitch.CX - dx), y = rowY }, { "x", "y" })
		local rightDefender = Js.O({ x = (M_pitch.CX + dx), y = rowY }, { "x", "y" })
		local leftMate = Js.O({ x = ((M_pitch.CX - dx) - 0.9), y = mateY }, { "x", "y" })
		local rightMate = Js.O({ x = ((M_pitch.CX + dx) + 0.9), y = mateY }, { "x", "y" })
		local follower = (if (followerSide > 0) then rightMate else leftMate)
		local otherMate = (if (followerSide > 0) then leftMate else rightMate)
		do return Js.O({ ball = Js.O({ x = M_pitch.CX, y = M_pitch.PEN_SPOT_Y }, { "x", "y" }), player = Js.O({ x = M_pitch.CX, y = (M_pitch.PEN_SPOT_Y + 1.6) }, { "x", "y" }), defenders = Js.alit(leftDefender, rightDefender), keeper = _T.makeKeeper((M_pitch.CX + ((rng() - 0.5) * 1.2)), 0.4, rng, false), keeperStrength = keeperStrength, follower = Js.O({ x = follower.x, y = follower.y, active = false, shot = false }, { "x", "y", "active", "shot" }), goal = _T.GOAL, crossbar = _T.CROSSBAR, kind = "penalty", teammates = Js.alit(otherMate), runner = nil, passTarget = nil, receiver = nil, receiverDone = false, teamRelationship = teamRelationship }, { "ball", "player", "defenders", "keeper", "keeperStrength", "follower", "goal", "crossbar", "kind", "teammates", "runner", "passTarget", "receiver", "receiverDone", "teamRelationship" }) end
	end
	_T.buildFreeKick = function(rng, keeperStrength, teamRelationship)
		local bx = (M_pitch.CX + ((rng() - 0.5) * 16))
		local by = (18 + (rng() * 8))
		local toGoal = _T.normalize(Js.O({ x = (M_pitch.CX - bx), y = (-by) }, { "x", "y" }))
		local wallCx = (bx + (toGoal.x * 9.15))
		local wallCy = (by + (toGoal.y * 9.15))
		local wallSize = (3 + (if (rng() < 0.4) then 1 else 0))
		local defenders = Js.alit()
		local across = Js.O({ x = (-toGoal.y), y = toGoal.x }, { "x", "y" })
		for i = 0, math.ceil(wallSize) - 1 do
			local off = ((i - ((wallSize - 1) / 2)) * 1.15)
			A.push(defenders, Js.O({ x = _T.clamp((wallCx + (across.x * off)), 4, (M_pitch.PITCH_W - 4)), y = _T.clamp((wallCy + (across.y * off)), 2, M_pitch.HALF_LEN) }, { "x", "y" }))
		end
		do return Js.O({ ball = Js.O({ x = bx, y = by }, { "x", "y" }), player = Js.O({ x = bx, y = (by + 2) }, { "x", "y" }), defenders = defenders, keeper = _T.makeKeeper((M_pitch.CX + ((rng() - 0.5) * 2.5)), (1 + (rng() * 0.8)), rng, false), keeperStrength = keeperStrength, follower = _T.makeFollower(rng, by), goal = _T.GOAL, crossbar = _T.CROSSBAR, kind = "free_kick", teammates = Js.alit(), runner = nil, passTarget = nil, receiver = nil, receiverDone = false, teamRelationship = teamRelationship }, { "ball", "player", "defenders", "keeper", "keeperStrength", "follower", "goal", "crossbar", "kind", "teammates", "runner", "passTarget", "receiver", "receiverDone", "teamRelationship" }) end
	end
	_T.buildCorner = function(rng, keeperStrength, teamRelationship)
		local side = (if (rng() < 0.5) then -1 else 1)
		local bx = (if (side > 0) then (M_pitch.PITCH_W - (0.45 + (rng() * 0.3))) else (0.45 + (rng() * 0.3)))
		local by = (0.45 + (rng() * 0.3))
		local to = Js.O({ x = (M_pitch.CX + ((rng() - 0.5) * 10)), y = (4 + (rng() * 5)) }, { "x", "y" })
		local from = Js.O({ x = (to.x - (side * 2.2)), y = ((to.y + 2.5) + (rng() * 1.5)) }, { "x", "y" })
		local teamCount = (3 + math.floor((rng() * 4)))
		local defCount = (teamCount + (if (rng() < 0.5) then 0 else 1))
		local ZONES = Js.alit(Js.O({ x = (M_pitch.CX - (side * 9)), y = 4.5 }, { "x", "y" }), Js.O({ x = M_pitch.CX, y = 6.5 }, { "x", "y" }), Js.O({ x = (M_pitch.CX + (side * 9)), y = 5 }, { "x", "y" }), Js.O({ x = (M_pitch.CX + (side * 3)), y = 12 }, { "x", "y" }))
		local teammates = Js.alit()
		for i = 1, teamCount - 1 do
			local z = ZONES[math.fmod(i, Js.alen(ZONES)) + 1]
			A.push(teammates, Js.O({ x = _T.clamp((z.x + ((rng() - 0.5) * 3.5)), 9, (M_pitch.PITCH_W - 9)), y = _T.clamp((z.y + ((rng() - 0.5) * 2.5)), 2, 15) }, { "x", "y" }))
		end
		local defenders = Js.alit(Js.O({ x = _T.clamp((to.x + ((rng() - 0.5) * 4)), 8, (M_pitch.PITCH_W - 8)), y = _T.clamp((to.y + 0.8), 3, 11) }, { "x", "y" }))
		for i = 1, math.ceil(defCount) - 1 do
			local mark = (teammates[math.fmod((i - 1), Math.max(1, Js.alen(teammates))) + 1] or to)
			A.push(defenders, Js.O({ x = _T.clamp((mark.x + ((rng() - 0.5) * 2)), 8, (M_pitch.PITCH_W - 8)), y = _T.clamp(((mark.y - 1.2) - (rng() * 1.5)), 2, 15) }, { "x", "y" }))
		end
		do return Js.O({ ball = Js.O({ x = bx, y = by }, { "x", "y" }), player = Js.O({ x = (bx + (side * 1.2)), y = (by + 1.2) }, { "x", "y" }), defenders = defenders, keeper = _T.makeKeeper((M_pitch.CX + (side * 1.5)), (1.2 + (rng() * 1)), rng), keeperStrength = keeperStrength, follower = _T.makeFollower(rng, 9), goal = _T.GOAL, crossbar = _T.CROSSBAR, kind = "corner", teammates = teammates, runner = _T.makeRunner(to, from), passTarget = to, receiver = _T.rollReceiver("corner", rng), receiverDone = false, teamRelationship = teamRelationship }, { "ball", "player", "defenders", "keeper", "keeperStrength", "follower", "goal", "crossbar", "kind", "teammates", "runner", "passTarget", "receiver", "receiverDone", "teamRelationship" }) end
	end
	_T.buildBuildup = function(rng, keeperStrength, teamRelationship)
		local bx = (14 + (rng() * (M_pitch.PITCH_W - 28)))
		local by = (40 + (rng() * 11))
		local easyTo = Js.O({ x = _T.clamp((bx + ((rng() - 0.5) * 15)), 6, (M_pitch.PITCH_W - 6)), y = _T.clamp(((by + 2) + (rng() * 5)), 34, (M_pitch.HALF_LEN + 4)) }, { "x", "y" })
		local hardTo = Js.O({ x = _T.clamp((M_pitch.CX + ((rng() - 0.5) * 22)), 10, (M_pitch.PITCH_W - 10)), y = _T.clamp(((by - 14) - (rng() * 6)), 18, 34) }, { "x", "y" })
		local defenders = Js.alit(Js.O({ x = _T.clamp((((bx + hardTo.x) / 2) + ((rng() - 0.5) * 7)), 8, (M_pitch.PITCH_W - 8)), y = _T.clamp(((by + hardTo.y) / 2), 24, 44) }, { "x", "y" }))
		if (rng() < 0.55) then
			A.push(defenders, Js.O({ x = _T.clamp((hardTo.x + ((rng() - 0.5) * 9)), 8, (M_pitch.PITCH_W - 8)), y = _T.clamp((hardTo.y - 2.5), 12, 40) }, { "x", "y" }))
		end
		local hardRunner = _T.makeRunner(hardTo, Js.O({ x = (hardTo.x + ((rng() - 0.5) * 3)), y = (hardTo.y + 3) }, { "x", "y" }), (_T.RUNNER_SPEED * 0.8))
		local easyRunner = _T.makeRunner(easyTo, Js.O({ x = easyTo.x, y = (easyTo.y + 1.5) }, { "x", "y" }), (_T.RUNNER_SPEED * 0.5))
		do return Js.O({ ball = Js.O({ x = bx, y = by }, { "x", "y" }), player = Js.O({ x = bx, y = (by + 1.3) }, { "x", "y" }), defenders = defenders, keeper = _T.makeKeeper(M_pitch.CX, 1.5, rng), keeperStrength = keeperStrength, follower = Js.O({ x = M_pitch.CX, y = 40, active = false, shot = false }, { "x", "y", "active", "shot" }), goal = _T.GOAL, crossbar = _T.CROSSBAR, kind = "buildup", teammates = Js.alit(), runner = hardRunner, passTarget = hardTo, secondaryRunners = Js.alit(easyRunner), receiver = nil, receiverDone = false, teamRelationship = teamRelationship }, { "ball", "player", "defenders", "keeper", "keeperStrength", "follower", "goal", "crossbar", "kind", "teammates", "runner", "passTarget", "secondaryRunners", "receiver", "receiverDone", "teamRelationship" }) end
	end
	_T.buildScenario = function(kind, rng, keeperStrength, teamRelationship, vision)
		if keeperStrength == nil then keeperStrength = 62 end
		if teamRelationship == nil then teamRelationship = 60 end
		if vision == nil then vision = 55 end
		local ks = _T.clamp(keeperStrength, 0, 100)
		local tr = _T.clamp(teamRelationship, 0, 100)
		local sc = nil
		local _sw32 = kind
		if _sw32 == "one_on_one" then
			sc = _T.buildOneOnOne(rng, ks, tr)
		elseif _sw32 == "tight_angle" then
			sc = _T.buildTightAngle(rng, ks, tr)
		elseif _sw32 == "long_range" then
			sc = _T.buildLongRange(rng, ks, tr)
		elseif _sw32 == "volley" then
			sc = _T.buildVolley(rng, ks, tr)
		elseif _sw32 == "header" then
			sc = _T.buildHeader(rng, ks, tr)
		elseif _sw32 == "cutback" then
			sc = _T.buildCutback(rng, ks, tr)
		elseif _sw32 == "byline_cross" then
			sc = _T.buildBylineCross(rng, ks, tr)
		elseif _sw32 == "through_ball" then
			sc = _T.buildThroughBall(rng, ks, tr)
		elseif _sw32 == "midfield_pass" then
			sc = _T.buildMidfieldPass(rng, ks, tr)
		elseif _sw32 == "penalty" then
			sc = _T.buildPenalty(rng, ks, tr)
		elseif _sw32 == "free_kick" then
			sc = _T.buildFreeKick(rng, ks, tr)
		elseif _sw32 == "corner" then
			sc = _T.buildCorner(rng, ks, tr)
		elseif _sw32 == "buildup" then
			sc = _T.buildBuildup(rng, ks, tr)
		end
		if (not sc.secondaryRunners) then
			sc.secondaryRunners = Js.alit()
		end
		_T.addCover(sc, rng)
		_T.standOff(sc)
		if ((not sc.receiver) and _T.goalInView(kind)) then
			sc.receiver = _T.rollReceiver(kind, rng)
		end
		if ((kind == "corner") or (kind == "byline_cross")) then
			local side = (if (sc.ball.x >= M_pitch.CX) then 1 else -1)
			sc.facing = (if (side > 0) then "right" else "left")
			sc.viewport = (if (kind == "byline_cross") then _T.crossViewportOnBall(sc.ball, side) else _T.crossViewport(side, (if (kind == "corner") then _T.CORNER_VIEW_X else _T.CROSS_VIEW_X)))
			sc.crossSwitchY = _T.CROSS_SWITCH_Y
			sc.crossSwitchView = _T.WIDE_DELIVERY_VIEW
		end
		if (sc.passDifficulty == nil) then
			sc.passDifficulty = 0
		end
		if (sc.chainDepth == nil) then
			sc.chainDepth = 0
		end
		_T.addSupport(sc, rng, vision)
		if (not sc.viewport) then
			sc.viewport = _T.scenarioViewport(sc)
		end
		_T.fitToView(sc)
		_T.settleOnside(sc, rng)
		if sc.viewport then
			local vp = sc.viewport
			local inset = 1.4
			_T.syncPassTarget(sc, function(x)
				return _T.clamp(x, (vp.x1 + inset), (vp.x2 - inset))
			end, function(y)
				return _T.clamp(y, Math.max((vp.y1 + inset), 0.3), (vp.y2 - inset))
			end)
		end
		_T.keepInsideTheCut(sc)
		_T.clearThePassingLane(sc)
		do
			local opts = Js.aspread((if sc.runner then Js.alit(sc.runner) else Js.alit()), sc.secondaryRunners)
			sc.forwardMostY = (if Js.T(Js.alen(opts)) then Math.min(Js.unpack(A.map(opts, function(r)
				return r.pos.y
			end))) else nil)
		end
		do return sc end
	end
	exports.buildScenario = _T.buildScenario
	_T.supportSeen = function(vision, roll)
		if roll == nil then roll = 0.5 end
		local v = _T.clamp(vision, 0, 100)
		if (v < 40) then
			do return 0 end
		end
		local expected = (1 + ((v - 40) / 40))
		local whole = math.floor(expected)
		do return (whole + (if (roll < (expected - whole)) then 1 else 0)) end
	end
	exports.supportSeen = _T.supportSeen
	_T.bodyCount = function(lo, hi, rng)
		if (hi <= lo) then
			do return lo end
		end
		do return (lo + Math.round((((rng() + rng()) / 2) * (hi - lo)))) end
	end
	_T.addCover = function(sc, rng)
		local _d33 = (if _T.COVER_RANGE[sc.kind] ~= nil then _T.COVER_RANGE[sc.kind] else Js.alit(0, 0))
		local lo = _d33[1]
		local hi = _d33[2]
		local want = _T.bodyCount(lo, hi, rng)
		local behind = (sc.kind == "through_ball")
		local existing = A.sort(A.map(sc.defenders, function(d)
			return d.y
		end), function(a, b)
			return (a - b)
		end)
		for i = 0, math.ceil(want) - 1 do
			local deepest = Math.min(Js.unpack(Js.aspread(A.map(sc.defenders, function(d)
				return d.y
			end), Js.alit(sc.ball.y))))
			local band = (if behind then (((existing[Js.alen(existing)] or (sc.ball.y * 0.6)) + 1.5) + (rng() * 4)) else (if _T.goalInView(sc.kind) then _T.clamp((deepest * (0.35 + (0.3 * (i / Math.max(1, want))))), 3.5, 15) else _T.clamp(((sc.ball.y - 6) - (rng() * 8)), 6, Math.max(7, (sc.ball.y - 3)))))
			local lane = (if (want <= 1) then 0 else ((i / (want - 1)) - 0.5))
			local floorY = (if behind then 2.5 else Math.max(3.5, (sc.keeper.y + 2)))
			local at = Js.O({ x = _T.clamp(((M_pitch.CX + (lane * 26)) + ((rng() - 0.5) * 5)), 8, (M_pitch.PITCH_W - 8)), y = _T.clamp((band + ((rng() - 0.5) * 2.5)), floorY, Math.max(floorY, (sc.ball.y - 1))) }, { "x", "y" })
			if (Math.hypot((at.x - sc.keeper.x), (at.y - sc.keeper.y)) < 2.5) then
				at.y += 2.5
			end
			for k = 0, 7 do
				local clash = ((A.some(sc.defenders, function(d)
					return (Math.hypot((d.x - at.x), (d.y - at.y)) < 3)
				end) or (Math.hypot((at.x - sc.player.x), (at.y - sc.player.y)) < 4.5)) or (Math.hypot((at.x - sc.ball.x), (at.y - sc.ball.y)) < 4))
				if (not clash) then
					do break end
				end
				at.x = _T.clamp((at.x + (if (lane >= 0) then 2.6 else -2.6)), 8, (M_pitch.PITCH_W - 8))
				at.y = _T.clamp((at.y + 1.1), floorY, M_pitch.HALF_LEN)
			end
			A.push(sc.defenders, at)
		end
	end
	_T.addSupport = function(sc, rng, vision)
		if vision == nil then vision = 55 end
		local _d34 = (if _T.SUPPORT_RANGE[sc.kind] ~= nil then _T.SUPPORT_RANGE[sc.kind] else Js.alit(0, 0))
		local slo = _d34[1]
		local shi = _d34[2]
		local base = _T.bodyCount(slo, shi, rng)
		local dead = ((sc.kind == "penalty") or (sc.kind == "free_kick"))
		local visionRoll = math.fmod(math.abs((Math.sin(((sc.ball.x * 12.9898) + (sc.ball.y * 78.233))) * 43758.5453)), 1)
		local want = (if dead then base else (base + _T.supportSeen(vision, visionRoll)))
		local vp = sc.viewport
		local line = _T.opponentLine(sc)
		local onsideY = (if (Js.alen(line) >= 2) then (line[2] + 0.3) else 0)
		local lo = Js.O({ x = (if vp then (vp.x1 + 2.5) else 5), y = Math.max(onsideY, (if vp then Math.max((vp.y1 + 2.5), 2.5) else 2.5)) }, { "x", "y" })
		local hi = Js.O({ x = (if vp then (vp.x2 - 2.5) else (M_pitch.PITCH_W - 5)), y = (if vp then (vp.y2 - 2.5) else (M_pitch.HALF_LEN + 4)) }, { "x", "y" })
		if (hi.y < lo.y) then
			lo.y = hi.y
		end
		for i = 0, math.ceil(want) - 1 do
			local side = (if (i == 0) then (if (rng() < 0.5) then -1 else 1) else (if (rng() < 0.5) then -1 else 1))
			local onShoulder = ((onsideY > 0) and ((sc.player.y - onsideY) > 6))
			local start = Js.O({ x = _T.clamp((sc.player.x + (side * (7 + (rng() * 7)))), lo.x, hi.x), y = (if onShoulder then _T.clamp(((onsideY + 0.5) + (rng() * 4.5)), lo.y, hi.y) else _T.clamp((sc.player.y + ((rng() - 0.35) * 10)), lo.y, hi.y)) }, { "x", "y" })
			if (Math.hypot((start.x - sc.player.x), (start.y - sc.player.y)) < 5) then
				start.x = _T.clamp((sc.player.x - (side * (8 + (rng() * 6)))), lo.x, hi.x)
				if (Math.hypot((start.x - sc.player.x), (start.y - sc.player.y)) < 5) then
					start.x = _T.clamp((M_pitch.CX + ((M_pitch.CX - sc.player.x) * 0.5)), lo.x, hi.x)
					start.y = _T.clamp(((sc.player.y + 7) + (rng() * 5)), lo.y, hi.y)
				end
				if (Math.hypot((start.x - sc.player.x), (start.y - sc.player.y)) < 5) then
					start.x = _T.clamp((M_pitch.CX + ((rng() - 0.5) * 9)), lo.x, hi.x)
					start.y = _T.clamp((M_pitch.SIX_DEPTH + (rng() * 5)), lo.y, hi.y)
				end
			end
			local spot = _T.bestSupportPoint(sc, sc.ball, start)
			spot.x = _T.clamp(spot.x, lo.x, hi.x)
			spot.y = _T.clamp(spot.y, lo.y, hi.y)
			if onShoulder then
				spot.y = Math.min(spot.y, (lo.y + 5))
			end
			for tries = 0, 13 do
				if (Math.hypot((spot.x - sc.player.x), (spot.y - sc.player.y)) >= 5) then
					do break end
				end
				spot.x = _T.clamp((M_pitch.CX + ((rng() - 0.5) * 11)), lo.x, hi.x)
				spot.y = _T.clamp(((Math.max((M_pitch.SIX_DEPTH + 1), lo.y) + (rng() * 6)) + (tries * 1.6)), lo.y, hi.y)
			end
			local r = _T.makeRunner(spot, spot, (_T.RUNNER_SPEED * 0.95), "support")
			r.moving = false
			r.sprint = false
			A.push(sc.secondaryRunners, r)
		end
	end
	_T.pickScenarioKind = function(position, rng)
		local weights = (if _T.POSITION_WEIGHTS[position] ~= nil then _T.POSITION_WEIGHTS[position] else _T.DEFAULT_WEIGHTS)
		local total = A.reduce(_T.SCENARIO_KINDS, function(sum, k)
			return (sum + weights[k])
		end, 0)
		local roll = (rng() * total)
		do
			local _arr35 = _T.SCENARIO_KINDS
			local _i36 = 0
			while _i36 < Js.alen(_arr35) do
				_i36 += 1
				local k = _arr35[_i36]
				roll -= weights[k]
				if (roll <= 0) then
					do return k end
				end
			end
		end
		do return _T.SCENARIO_KINDS[Js.alen(_T.SCENARIO_KINDS)] end
	end
	exports.pickScenarioKind = _T.pickScenarioKind
	_T.pickScenarioKindFrom = function(position, rng, allowed)
		if (Js.alen(allowed) == 0) then
			do return _T.pickScenarioKind(position, rng) end
		end
		local weights = (if _T.POSITION_WEIGHTS[position] ~= nil then _T.POSITION_WEIGHTS[position] else _T.DEFAULT_WEIGHTS)
		local total = A.reduce(allowed, function(sum, k)
			return (sum + Math.max(1, weights[k]))
		end, 0)
		local roll = (rng() * total)
		do
			local _arr37 = allowed
			local _i38 = 0
			while _i38 < Js.alen(_arr37) do
				_i38 += 1
				local k = _arr37[_i38]
				roll -= Math.max(1, weights[k])
				if (roll <= 0) then
					do return k end
				end
			end
		end
		do return allowed[Js.alen(allowed)] end
	end
	exports.pickScenarioKindFrom = _T.pickScenarioKindFrom
	_T.buildWeightedScenario = function(rng, position, keeperStrength, teamRelationship, vision)
		if keeperStrength == nil then keeperStrength = 62 end
		if teamRelationship == nil then teamRelationship = 60 end
		if vision == nil then vision = 55 end
		local kind = _T.pickScenarioKind(position, rng)
		do return _T.buildScenario(kind, rng, keeperStrength, teamRelationship, vision) end
	end
	exports.buildWeightedScenario = _T.buildWeightedScenario
	_T.buildAttackingScenario = function(rng, keeperStrength, teamRelationship, vision)
		if keeperStrength == nil then keeperStrength = 62 end
		if teamRelationship == nil then teamRelationship = 60 end
		if vision == nil then vision = 55 end
		local kind = _T.ATTACKING_KINDS[math.floor((rng() * Js.alen(_T.ATTACKING_KINDS))) + 1]
		do return _T.buildScenario(kind, rng, keeperStrength, teamRelationship) end
	end
	exports.buildAttackingScenario = _T.buildAttackingScenario
	_T.resetForTouchOn = function(scenario, at)
		scenario.ball = Js.O({ x = at.x, y = at.y }, { "x", "y" })
		scenario.player = Js.O({ x = at.x, y = at.y }, { "x", "y" })
		scenario.touchChaseArmed = false
		scenario.receiverDone = false
		scenario.receiverReached = false
		scenario.receiverShot = false
		scenario.receiverShots = nil
		scenario.receivedAt = nil
		scenario.receivedBy = nil
		scenario.relayTo = nil
		scenario.relayToFollower = false
		scenario.relayed = false
		scenario.offsideAgainst = false
	end
	exports.resetForTouchOn = _T.resetForTouchOn
	_T.chainKindFor = function(at, rng, ambition)
		if ambition == nil then ambition = 0 end
		local wide = (math.abs((at.x - M_pitch.CX)) > 13)
		if (at.y < (M_pitch.BOX_DEPTH + 2)) then
			if wide then
				do return (if (rng() < 0.55) then "cutback" else "tight_angle") end
			end
			do return (if (rng() < 0.45) then "one_on_one" else (if (rng() < 0.6) then "volley" else "tight_angle")) end
		end
		local byPosition = _T.clamp(((44 - at.y) / 11), 0, 1)
		if (rng() < Math.max(byPosition, (ambition * 0.95))) then
			if wide then
				do return (if (rng() < 0.6) then "byline_cross" else "cutback") end
			end
			do return (if (rng() < 0.5) then "through_ball" else "long_range") end
		end
		do return (if (rng() < 0.55) then "midfield_pass" else "buildup") end
	end
	exports.chainKindFor = _T.chainKindFor
	_T.chainReturnChance = function(sc)
		local ambition = Math.max(sc.passDifficulty, (if sc.passAmbition ~= nil then sc.passAmbition else 0))
		do return _T.clamp(((0.3 + (ambition * 0.72)) + ((sc.teamRelationship - 50) / 260)), 0.2, 1) end
	end
	exports.chainReturnChance = _T.chainReturnChance
	_T.relayTargetFor = function(scenario)
		local target = scenario.relayTo
		if ((not target) or scenario.relayed) then
			do return nil end
		end
		local from = scenario.receivedBy
		if (from and (from == target)) then
			do return nil end
		end
		local at = scenario.receivedAt
		if (not at) then
			do return nil end
		end
		local d = Math.hypot((target.pos.x - at.x), (target.pos.y - at.y))
		if ((d < _T.RELAY_MIN) or (d > _T.RELAY_MAX)) then
			do return nil end
		end
		do return target end
	end
	_T.passerQuality = function(scenario)
		local who = ((function() local _v = scenario.receivedBy; if _v == nil then return nil end; _v = _v.who; return _v end)() or (function() local _v = scenario.receiver; if _v == nil then return nil end; _v = _v.who; return _v end)())
		local raw = ((((function() local _v = who; if _v == nil then return nil end; _v = _v.passing; return _v end)() or (function() local _v = who; if _v == nil then return nil end; _v = _v.overall; return _v end)()) or (function() local _v = scenario.receiver; if _v == nil then return nil end; _v = _v.skill; return _v end)()) or 62)
		local team = _T.clamp((scenario.teamRelationship / 100), 0, 1)
		do return _T.clamp((((_T.clamp(raw, 0, 100) / 100) * 0.62) + (team * 0.38)), 0, 1) end
	end
	_T.relayControlT = function(q)
		do return (_T.RECEIVER_CONTROL_T * _T.clamp((1.3 - q), 0.3, 1)) end
	end
	_T.relayShouldGoNow = function(scenario, target, ballAt, q)
		if (((q < _T.SMART_PASS_Q) or (not target.commandedTo)) or (not target.moving)) then
			do return false end
		end
		if (((not _T.offsideRuleEnabled) or (not _T.goalInView(scenario.kind))) or (scenario.kind == "corner")) then
			do return false end
		end
		local line = _T.opponentLine(scenario)
		if (Js.alen(line) < 2) then
			do return false end
		end
		local secondLast = line[2]
		local dx = (target.commandedTo.x - target.pos.x)
		local dy = (target.commandedTo.y - target.pos.y)
		local d = (function() local _l = Math.hypot(dx, dy); if Js.T(_l) then return _l end; return 1 end)()
		local vy = ((dy / d) * target.speed)
		local lookT = (0.08 + (0.22 * q))
		local yAhead = (target.pos.y + (vy * lookT))
		do return (((yAhead < (secondLast + 0.3)) and (target.pos.y >= (secondLast - _T.OFFSIDE_EPS))) and (yAhead < ballAt.y)) end
	end
	_T.stepMateCarry = function(ball, scenario, dt)
		local stop = function()
			ball.carryT = 0
			ball.receiverControlT = Math.min(ball.receiverControlT, _T.MATE_CARRY.touchT)
			do return false end
		end
		local C = _T.MATE_CARRY
		local at = ball.pos
		if (((Math.hypot((at.x - M_pitch.CX), at.y) <= C["until"]) or _T.relayTargetFor(scenario)) or _T.relayFollowerTargetFor(scenario)) then
			do return stop() end
		end
		local dir = _T.normalize(Js.O({ x = ((M_pitch.CX - at.x) * 0.65), y = (-at.y) }, { "x", "y" }))
		do
			local _arr39 = scenario.defenders
			local _i40 = 0
			while _i40 < Js.alen(_arr39) do
				_i40 += 1
				local d = _arr39[_i40]
				local fx = (d.x - at.x)
				local fy = (d.y - at.y)
				if ((((fx * dir.x) + (fy * dir.y)) > -0.5) and (Math.hypot(fx, fy) < C.threatR)) then
					do return stop() end
				end
			end
		end
		local k = scenario.keeper
		if (Math.hypot((k.x - at.x), (k.y - at.y)) < C.keeperR) then
			do return stop() end
		end
		local step = (C.speed * dt)
		ball.pos = Js.O({ x = (at.x + (dir.x * step)), y = (at.y + (dir.y * step)) }, { "x", "y" })
		ball.z = 0.11
		local r = scenario.receivedBy
		if r then
			r.pos = Js.O({ x = (r.pos.x + (dir.x * step)), y = (r.pos.y + (dir.y * step)) }, { "x", "y" })
		end
		scenario.receivedAt = Js.O({ x = ball.pos.x, y = ball.pos.y }, { "x", "y" })
		ball.carryT = Math.max(0, ((if ball.carryT ~= nil then ball.carryT else 0) - dt))
		if (ball.carryT <= 0) then
			do return stop() end
		end
		do return true end
	end
	_T.wouldBeOffside = function(scenario, p, ballAt)
		if (((not _T.offsideRuleEnabled) or (not _T.goalInView(scenario.kind))) or (scenario.kind == "corner")) then
			do return false end
		end
		local line = _T.opponentLine(scenario)
		if (Js.alen(line) < 2) then
			do return false end
		end
		do return (((p.y < (M_pitch.HALF_LEN - _T.OFFSIDE_EPS)) and (p.y < (ballAt.y - _T.OFFSIDE_EPS))) and (p.y < (line[2] - _T.OFFSIDE_EPS))) end
	end
	_T.offsideAt = function(scenario, p, ballAt)
		do return _T.wouldBeOffside(scenario, p, ballAt) end
	end
	exports.offsideAt = _T.offsideAt
	_T.passQuality = function(scenario)
		do return _T.passerQuality(scenario) end
	end
	exports.passQuality = _T.passQuality
	_T.playRelay = function(ball, scenario, relay, followerRelay, rng, composed)
		if composed == nil then composed = true end
		local q = _T.passerQuality(scenario)
		local at = Js.O({ x = ball.pos.x, y = ball.pos.y }, { "x", "y" })
		local to = (if relay then relay.pos else (if followerRelay then Js.O({ x = scenario.follower.x, y = scenario.follower.y }, { "x", "y" }) else nil))
		if (not to) then
			do return false end
		end
		if ((q >= _T.SMART_PASS_Q) and _T.wouldBeOffside(scenario, to, at)) then
			_T.launchReceiverShot(ball, scenario, rng, composed)
			do return true end
		end
		if relay then
			_T.launchReceiverPass(ball, scenario, relay, rng)
		else
			_T.launchReceiverFollowerPass(ball, scenario, rng)
		end
		do return true end
	end
	_T.runIntercept = function(from, r)
		local best = Js.O({ x = r.pos.x, y = r.pos.y }, { "x", "y" })
		do
			local t = 0.1
			local _first41 = true
			while true do
				if not _first41 then
					t += 0.05
				end
				_first41 = false
				if not (t <= 2.4) then break end
				local p = _T.aheadOf(r, t)
				local d = Math.hypot((p.x - from.x), (p.y - from.y))
				local sp = _T.clamp((11 + (d * 0.42)), 11, 24)
				local ballT = ((d / sp) * 1.05)
				best = p
				if (ballT <= t) then
					do break end
				end
			end
		end
		do return best end
	end
	_T.passLoft = function(scenario, from, to)
		local dx = (to.x - from.x)
		local dy = (to.y - from.y)
		local d = Math.hypot(dx, dy)
		if (d < 6) then
			do return nil end
		end
		local blockAt = -1
		do
			local _arr42 = scenario.defenders
			local _i43 = 0
			while _i43 < Js.alen(_arr42) do
				_i43 += 1
				local def = _arr42[_i43]
				local u = ((((def.x - from.x) * dx) + ((def.y - from.y) * dy)) / (d * d))
				if ((u < 0.08) or (u > 0.9)) then
					do continue end
				end
				local px = (from.x + (dx * u))
				local py = (from.y + (dy * u))
				if (Math.hypot((def.x - px), (def.y - py)) > (_T.DEF_BLOCK_R + 0.6)) then
					do continue end
				end
				blockAt = Math.max(blockAt, (u * d))
			end
		end
		if (blockAt < 0) then
			do return nil end
		end
		local clearZ = (_T.DEF_BLOCK_H + 0.35)
		local arriveZ = 0.5
		do
			local sp = _T.clamp((9 + (d * 0.32)), 10, 20)
			local _first44 = true
			while true do
				if not _first44 then
					sp *= 0.92
				end
				_first44 = false
				if not (sp >= 8) then break end
				local T = (d / sp)
				local tb = (blockAt / sp)
				local vz = (((arriveZ - 0.08) + (((0.5 * _T.G) * T) * T)) / T)
				local zb = ((0.08 + (vz * tb)) - (((0.5 * _T.G) * tb) * tb))
				if (zb >= clearZ) then
					local c = M_ballPhysics.dragCompensate(sp, vz, d)
					do return Js.O({ speed = c.sh, vz = c.vz }, { "speed", "vz" }) end
				end
			end
		end
		do return nil end
	end
	_T.launchReceiverPass = function(ball, scenario, target, rng)
		local from = Js.O({ x = ball.pos.x, y = ball.pos.y }, { "x", "y" })
		local quality = _T.passerQuality(scenario)
		local dist = Math.hypot((target.pos.x - from.x), (target.pos.y - from.y))
		local speed = _T.clamp((11 + (dist * 0.42)), 11, 24)
		local aim = Js.O({ x = target.pos.x, y = target.pos.y }, { "x", "y" })
		if (target.commandedTo and target.moving) then
			aim = (if (quality >= _T.SMART_PASS_Q) then _T.runIntercept(from, target) else _T.aheadOf(target, Math.min((dist / speed), 0.9)))
			dist = Math.hypot((aim.x - from.x), (aim.y - from.y))
			speed = _T.clamp((11 + (dist * 0.42)), 11, 24)
		end
		local sigmaDeg = ((1 - (quality * 0.8)) * 6.5)
		local loft = (if (quality >= _T.LOFT_PASS_Q) then _T.passLoft(scenario, from, aim) else nil)
		if loft then
			speed = loft.speed
		end
		local dir = _T.rotateDeg(_T.normalize(Js.O({ x = (aim.x - from.x), y = (aim.y - from.y) }, { "x", "y" })), (_T.gaussian(rng) * sigmaDeg))
		ball.vel = Js.O({ x = (dir.x * speed), y = (dir.y * speed) }, { "x", "y" })
		ball.vz = (if loft then loft.vz else 0)
		ball.z = 0.08
		ball.spin = ((rng() - 0.5) * 0.35)
		ball.loose = false
		ball.contactCd = _T.clamp(((_T.PASS_CONTROL_R + 0.6) / speed), 0.15, 0.4)
		ball.lastTouch = "attack"
		ball.event = "relay"
		_T.logBallAction(ball, Js.O({ kind = "pass", actor = _T.runnerActor(scenario, scenario.receivedBy), mode = (if loft then "chip" else "ground"), at = Js.O({ x = from.x, y = from.y, z = ball.z }, { "x", "y", "z" }) }, { "kind", "actor", "mode", "at" }))
		ball.shot = false
		_T.markLanding(ball, scenario)
		scenario.relayed = true
		scenario.receiverDone = false
		_T.offsideSnapshot(scenario, from)
	end
	_T.relayFollowerTargetFor = function(scenario)
		if ((not scenario.relayToFollower) or scenario.relayed) then
			do return false end
		end
		local at = scenario.receivedAt
		if (not at) then
			do return false end
		end
		local d = Math.hypot((scenario.follower.x - at.x), (scenario.follower.y - at.y))
		do return ((d >= _T.RELAY_MIN) and (d <= _T.RELAY_MAX)) end
	end
	_T.launchReceiverFollowerPass = function(ball, scenario, rng)
		local from = Js.O({ x = ball.pos.x, y = ball.pos.y }, { "x", "y" })
		local f = scenario.follower
		local dist = Math.hypot((f.x - from.x), (f.y - from.y))
		local speed = _T.clamp((11 + (dist * 0.42)), 11, 24)
		local quality = _T.passerQuality(scenario)
		local sigmaDeg = ((1 - (quality * 0.8)) * 6.5)
		local loft = (if (quality >= _T.LOFT_PASS_Q) then _T.passLoft(scenario, from, Js.O({ x = f.x, y = f.y }, { "x", "y" })) else nil)
		if loft then
			speed = loft.speed
		end
		local dir = _T.rotateDeg(_T.normalize(Js.O({ x = (f.x - from.x), y = (f.y - from.y) }, { "x", "y" })), (_T.gaussian(rng) * sigmaDeg))
		ball.vel = Js.O({ x = (dir.x * speed), y = (dir.y * speed) }, { "x", "y" })
		ball.vz = (if loft then loft.vz else 0)
		ball.z = 0.08
		ball.spin = ((rng() - 0.5) * 0.35)
		ball.loose = false
		ball.contactCd = _T.clamp(((_T.PASS_CONTROL_R + 0.6) / speed), 0.15, 0.4)
		ball.lastTouch = "attack"
		ball.event = "relay"
		_T.logBallAction(ball, Js.O({ kind = "pass", actor = _T.runnerActor(scenario, scenario.receivedBy), mode = "ground", at = Js.O({ x = from.x, y = from.y, z = ball.z }, { "x", "y", "z" }) }, { "kind", "actor", "mode", "at" }))
		ball.shot = false
		_T.markLanding(ball, scenario)
		scenario.relayed = true
		scenario.receiverDone = false
		_T.offsideSnapshot(scenario, from)
	end
	_T.aheadOf = function(r, t)
		local to = r.commandedTo
		if (not to) then
			do return Js.O({ x = r.pos.x, y = r.pos.y }, { "x", "y" }) end
		end
		local dx = (to.x - r.pos.x)
		local dy = (to.y - r.pos.y)
		local d = Math.hypot(dx, dy)
		if (d < 0.01) then
			do return Js.O({ x = r.pos.x, y = r.pos.y }, { "x", "y" }) end
		end
		local step = Math.min(d, (r.speed * t))
		do return Js.O({ x = (r.pos.x + ((dx / d) * step)), y = (r.pos.y + ((dy / d) * step)) }, { "x", "y" }) end
	end
	_T.receiverQuality = function(receiver, teamRelationship)
		local teamQuality = _T.clamp((teamRelationship / 100), 0, 1)
		do return _T.clamp((((_T.clamp(receiver.skill, 0, 100) / 100) * 0.72) + (teamQuality * 0.28)), 0, 1) end
	end
	_T.setMateReceptionRule = function(rule)
		Js.globalThis[_T.MATE_RULE_KEY] = rule
	end
	exports.setMateReceptionRule = _T.setMateReceptionRule
	_T.strikeModeForHeight = function(kind, z)
		if (not A.includes(_T.CROSS_DELIVERY_KINDS, kind)) then
			do return "ground" end
		end
		if (z > (if M_hitbox.hitboxesOn() then (M_hitbox.headTop(M_hitbox.hitboxDials().jumpHeight) + M_hitbox.hitboxDials().headerBonus) else _T.HEADER_MAX_REACH_Z)) then
			do return "ground" end
		end
		if (z >= _T.HEADER_MIN_Z) then
			do return "header" end
		end
		if (z >= _T.VOLLEY_MIN_Z) then
			do return "volley" end
		end
		do return "ground" end
	end
	exports.strikeModeForHeight = _T.strikeModeForHeight
	_T.firstTimeChance = function(mode, quality)
		local q = _T.clamp(quality, 0, 1)
		if (mode == "header") then
			do return _T.clamp((0.55 + (q * 0.35)), 0.5, 0.92) end
		end
		if (mode == "volley") then
			do return _T.clamp((0.4 + (q * 0.38)), 0.35, 0.85) end
		end
		do return _T.clamp(((q - 0.35) * 0.85), 0, 0.55) end
	end
	exports.firstTimeChance = _T.firstTimeChance
	_T.launchReceiverShot = function(ball, scenario, rng, composed, rushed)
		if composed == nil then composed = true end
		if rushed == nil then rushed = false end
		local receiver = scenario.receiver
		if (not receiver) then
			do return end
		end
		local arrivalZ = ball.z
		local strikeMode = _T.strikeModeForHeight(scenario.kind, arrivalZ)
		local isHeader = (strikeMode == "header")
		local isVolley = (strikeMode == "volley")
		local dist = Math.hypot((ball.pos.x - M_pitch.CX), ball.pos.y)
		local posQuality = _T.clamp((1 - (dist / 26)), 0, 1)
		local teamQuality = _T.clamp((scenario.teamRelationship / 100), 0, 1)
		local composite = _T.clamp((((receiver.skill * 0.5) + (posQuality * 50)) + (teamQuality * 25)), 10, 96)
		local control = (if _T.RECEIVER_CONTROL[scenario.kind] ~= nil then _T.RECEIVER_CONTROL[scenario.kind] else 0.85)
		local quality = _T.receiverQuality(receiver, scenario.teamRelationship)
		local realShooting = ((function() local _v = receiver.who; if _v == nil then return nil end; _v = _v.shooting; return _v end)() or (function() local _v = receiver.who; if _v == nil then return nil end; _v = _v.overall; return _v end)())
		local eliteBoost = (if (realShooting ~= nil) then (1 + (_T.clamp((realShooting - 55), 0, 40) / 100)) else 1)
		local goalCx = ((scenario.goal.x1 + scenario.goal.x2) / 2)
		local halfMouth = ((M_pitch.POST_R - M_pitch.POST_L) / 2)
		local keeperSide = (function() local _l = Math.sign((scenario.keeper.x - goalCx)); if Js.T(_l) then return _l end; return (if (rng() < 0.5) then -1 else 1) end)()
		local readsKeeper = (0.5 + (control * 0.22))
		local side = (if (rng() < readsKeeper) then (-keeperSide) else keeperSide)
		local ambition = _T.clamp((1 + (_T.gaussian(rng) * 0.22)), 0.5, 1.3)
		local placement = (((ambition * (0.22 + (quality * 0.62))) * (0.2 + (control * 0.8))) * eliteBoost)
		local aimX = _T.clamp((goalCx + ((side * placement) * (halfMouth - (M_pitch.BALL_R * 2)))), (M_pitch.POST_L + (M_pitch.BALL_R * 2)), (M_pitch.POST_R - (M_pitch.BALL_R * 2)))
		local baseDir = _T.normalize(Js.O({ x = (aimX - ball.pos.x), y = (-(Math.max(ball.pos.y, 0.5))) }, { "x", "y" }))
		local sigmaDeg = ((((1 - (quality * 0.82)) * 7.5) / Math.max(0.45, control)) + (if isVolley then ((1 - quality) * _T.VOLLEY_MISS_PENALTY_DEG) else 0))
		local noiseDeg = (_T.gaussian(rng) * sigmaDeg)
		local loft = _T.clamp(((0.1 + (rng() * 0.26)) + ((composite / 100) * 0.14)), 0.03, 0.62)
		local Sh = ((16 + (composite * 0.16)) * (1 - (loft * 0.25)))
		local vz = (loft * (7 + (composite * 0.04)))
		if isVolley then
			Sh *= (_T.VOLLEY_POWER_MIN + (rng() * (_T.VOLLEY_POWER_MAX - _T.VOLLEY_POWER_MIN)))
		end
		if isHeader then
			local headerPhys = ((function() local _v = receiver.who; if _v == nil then return nil end; _v = _v.physical; return _v end)() or (function() local _v = receiver.who; if _v == nil then return nil end; _v = _v.overall; return _v end)())
			local headerPowerBoost = (if (headerPhys ~= nil) then (1 + (_T.clamp((headerPhys - 50), -20, 40) / 130)) else 1)
			Sh = ((10 + (composite * 0.11)) * headerPowerBoost)
			local t = (Math.max(dist, 2) / Sh)
			local headerTargetZ = (_T.HEADER_TARGET_Z_MIN + (_T.clamp(placement, 0, 1.6) * (_T.HEADER_TARGET_Z_MAX - _T.HEADER_TARGET_Z_MIN)))
			vz = _T.clamp((((headerTargetZ - arrivalZ) + (((0.5 * _T.G) * t) * t)) / t), 0.3, 9)
			if M_ballPhysics.realBallOn() then
				local hc = M_ballPhysics.dragCompensate(Sh, vz, Math.max(dist, 2), arrivalZ)
				Sh = hc.sh
				vz = _T.clamp(hc.vz, 0.3, 9)
			end
		end
		local curlDistScale = _T.clamp((1 - ((dist - 10) / 30)), 0.35, 1)
		local curlControlScale = (0.4 + (control * 0.6))
		local blockerSide = 0
		local blocker = nil
		local blockerProjX = 0
		if (control >= 0.5) then
			local laneDX = (aimX - ball.pos.x)
			local laneDY = (-ball.pos.y)
			local laneLen2 = ((laneDX * laneDX) + (laneDY * laneDY))
			if (laneLen2 > 1) then
				do
					local _arr45 = scenario.defenders
					local _i46 = 0
					while _i46 < Js.alen(_arr45) do
						_i46 += 1
						local d = _arr45[_i46]
						local tRaw = ((((d.x - ball.pos.x) * laneDX) + ((d.y - ball.pos.y) * laneDY)) / laneLen2)
						local t = _T.clamp(tRaw, 0, 1)
						if ((tRaw <= 0.02) or (t > 0.92)) then
							do continue end
						end
						local projX = (ball.pos.x + (laneDX * t))
						local projY = (ball.pos.y + (laneDY * t))
						if (Math.hypot((d.x - projX), (d.y - projY)) < 1.4) then
							blocker = d
							blockerProjX = projX
							blockerSide = (if (d.x < projX) then -1 else 1)
							do break end
						end
					end
				end
			end
		end
		local curlSide = (if (blockerSide ~= 0) then blockerSide else side)
		local blockerBoost = (if (blockerSide ~= 0) then 1.15 else 1)
		local curlTech = ((function() local _v = receiver.who; if _v == nil then return nil end; _v = _v.shooting; return _v end)() or (function() local _v = receiver.who; if _v == nil then return nil end; _v = _v.overall; return _v end)())
		local spin = (if isHeader then ((rng() - 0.5) * 0.12) else (if (curlTech ~= nil) then (((((curlSide * _T.curlRange(curlTech)) * 1.9) * curlDistScale) * curlControlScale) * blockerBoost) else ((rng() - 0.5) * 0.9)))
		local nearThreat = false
		do
			local _arr47 = scenario.defenders
			local _i48 = 0
			while _i48 < Js.alen(_arr47) do
				_i48 += 1
				local d = _arr47[_i48]
				local fy = (d.y - ball.pos.y)
				if (((fy < 0) and (fy > -7)) and (math.abs((d.x - ball.pos.x)) < 2.5)) then
					nearThreat = true
					do break end
				end
			end
		end
		local isChip = false
		local chipSh = Sh
		local chipVz = vz
		if ((((((composed and (not isHeader)) and (not rushed)) and (curlTech ~= nil)) and (not nearThreat)) and (quality > 0.55)) and (scenario.keeper.y > _T.CHIP_KEEPER_Y)) then
			local distToKeeper = (ball.pos.y - scenario.keeper.y)
			local distToGoal = ball.pos.y
			if ((distToKeeper > _T.CHIP_MIN_KEEPER_DIST) and (distToGoal > distToKeeper)) then
				local chipChance = (0.4 + (_T.clamp(((quality - 0.55) / 0.45), 0, 1) * 0.4))
				if (rng() < chipChance) then
					local r = (distToGoal / distToKeeper)
					local t1sq = (((_T.CHIP_CLEAR_Z * r) - _T.CHIP_LAND_Z) / (((0.5 * _T.G) * r) * (r - 1)))
					if (t1sq > 0.01) then
						local t1 = Math.sqrt(t1sq)
						isChip = true
						local yFrac = Math.max(0.2, math.abs(baseDir.y))
						local vy = (distToKeeper / t1)
						chipSh = (vy / yFrac)
						chipVz = ((_T.CHIP_CLEAR_Z / t1) + ((0.5 * _T.G) * t1))
						local cc = M_ballPhysics.dragCompensate(chipSh, chipVz, (distToGoal / yFrac), ball.z)
						chipSh = cc.sh
						chipVz = cc.vz
					end
				end
			end
		end
		local launchDir = baseDir
		if ((((((not isHeader) and (curlTech ~= nil)) and (not isChip)) and (blockerSide == 0)) and (not nearThreat)) and (math.abs(spin) > 0.0001)) then
			local chordDist = Math.max(1, Math.hypot((aimX - ball.pos.x), ball.pos.y))
			local flightT = (chordDist / Sh)
			local preAngleDeg = _T.clamp(((((spin * _T.CURL_K) * flightT) * (90 / Math.PI)) * curlDistScale), -40, 40)
			launchDir = _T.rotateDeg(baseDir, preAngleDeg)
		end
		local roundSpin = nil
		if (((blocker and (curlTech ~= nil)) and (not isHeader)) and (not isChip)) then
			local blockR = _T.BODY_BLOCK_R
			local ROUND_CLEAR = (blockR + 0.3)
			local MIN_CLEAR = (blockR + 0.12)
			local away = (if (blocker.x < blockerProjX) then 1 else -1)
			local aim2 = _T.clamp((goalCx + ((away * Math.min((placement * 0.85), 0.7)) * (halfMouth - (M_pitch.BALL_R * 2)))), (M_pitch.POST_L + (M_pitch.BALL_R * 2)), (M_pitch.POST_R - (M_pitch.BALL_R * 2)))
			local chord = _T.normalize(Js.O({ x = (aim2 - ball.pos.x), y = (-(Math.max(ball.pos.y, 0.5))) }, { "x", "y" }))
			local rx = (blocker.x - ball.pos.x)
			local ry = (blocker.y - ball.pos.y)
			local rho = Math.hypot(rx, ry)
			local along = ((rx * chord.x) + (ry * chord.y))
			local cross = ((chord.x * ry) - (chord.y * rx))
			local dirR = chord
			local spinR = (spin * 0.15)
			if ((along > 0) and (rho > (MIN_CLEAR + 0.1))) then
				local phi = Math.atan2(cross, along)
				local psi = Math.asin(Math.min(1, (ROUND_CLEAR / rho)))
				if (math.abs(phi) < psi) then
					local T = (Math.hypot((aim2 - ball.pos.x), ball.pos.y) / Math.max((Sh * 0.88), 1))
					local spinMax = (_T.curlRange(curlTech) * 1.9)
					local delta = (phi - (Math.sign((if Js.T(phi) then phi else 1)) * psi))
					local deltaMax = (((spinMax * _T.CURL_K) * T) / 2)
					if (math.abs(delta) > deltaMax) then
						delta = (Math.sign(delta) * deltaMax)
					end
					local clearance = (rho * math.abs(Math.sin((phi - delta))))
					if (clearance >= MIN_CLEAR) then
						dirR = _T.rotateDeg(chord, ((delta * 180) / Math.PI))
						spinR = _T.clamp(((2 * delta) / (_T.CURL_K * T)), (-spinMax), spinMax)
					end
				end
			end
			launchDir = dirR
			roundSpin = spinR
		end
		local dir = _T.rotateDeg(launchDir, noiseDeg)
		ball.vel = Js.O({ x = (dir.x * chipSh), y = (dir.y * chipSh) }, { "x", "y" })
		ball.vz = chipVz
		ball.spin = (if isChip then (spin * 0.15) else (if roundSpin ~= nil then roundSpin else spin))
		ball.z = (if (isHeader or isVolley) then arrivalZ else 0.1)
		ball.loose = false
		ball.contactCd = 0.15
		ball.lastTouch = "attack"
		_T.markLanding(ball, scenario)
		ball.event = "receiverShot"
		_T.logBallAction(ball, Js.O({ kind = "shot", actor = _T.runnerActor(scenario, scenario.receivedBy), mode = _T.strikeShape(ball, isHeader, isVolley, isChip), at = Js.O({ x = ball.pos.x, y = ball.pos.y, z = ball.z }, { "x", "y", "z" }), firstTime = ((((rushed or (not composed)) or isHeader) or isVolley) or nil) }, { "kind", "actor", "mode", "at", "firstTime" }))
		scenario.keeper.adjusting = false
		ball.shot = true
		scenario.receiverShot = true
		scenario.receiverShots = ((if scenario.receiverShots ~= nil then scenario.receiverShots else 0) + 1)
		scenario.receiverDone = false
		_T.offsideSnapshot(scenario, Js.O({ x = ball.pos.x, y = ball.pos.y }, { "x", "y" }))
	end
	_T.applyAerialContest = function(ball, scenario, skills, rng)
		if (scenario.kind ~= "header") then
			do return end
		end
		local nearest = math.huge
		do
			local _arr49 = scenario.defenders
			local _i50 = 0
			while _i50 < Js.alen(_arr49) do
				_i50 += 1
				local d = _arr49[_i50]
				nearest = Math.min(nearest, Math.hypot((d.x - scenario.ball.x), (d.y - scenario.ball.y)))
			end
		end
		if (nearest > _T.AERIAL_R) then
			do return end
		end
		local pressure = _T.clamp((1 - (nearest / _T.AERIAL_R)), 0, 1)
		local strength = _T.clamp((skills.power / 100), 0, 1)
		local winProb = _T.clamp(((_T.AERIAL_WIN_BASE + (pressure * 0.42)) - (strength * 0.24)), 0.05, 0.75)
		if (rng() < winProb) then
			local away = _T.normalize(Js.O({ x = (scenario.ball.x - M_pitch.CX), y = Math.max(scenario.ball.y, 1) }, { "x", "y" }))
			local sp = (9 + (rng() * 7))
			ball.vel = Js.O({ x = ((away.x * sp) + ((rng() - 0.5) * 4)), y = (away.y * sp) }, { "x", "y" })
			ball.vz = (3 + (rng() * 2.5))
			ball.spin = 0
			ball.loose = true
			ball.owner = "none"
			ball.lastTouch = "defence"
			_T.clearOffside(scenario)
			do return end
		end
		local off = _T.rotateDeg(Js.O({ x = ball.vel.x, y = ball.vel.y }, { "x", "y" }), ((_T.gaussian(rng) * pressure) * 7))
		local damp = (1 - (pressure * 0.22))
		ball.vel = Js.O({ x = (off.x * damp), y = (off.y * damp) }, { "x", "y" })
		ball.vz *= damp
	end
	_T.optionsSeen = function(vision)
		local v = _T.clamp(vision, 0, 100)
		do return (if (v < 35) then 1 else (if (v < 65) then 2 else 3)) end
	end
	exports.optionsSeen = _T.optionsSeen
	_T.scanRange = function(vision)
		do return (11 + ((_T.clamp(vision, 0, 100) / 100) * 21)) end
	end
	exports.scanRange = _T.scanRange
	_T.orderableRunners = function(sc)
		do return Js.aspread((if sc.runner then Js.alit(sc.runner) else Js.alit()), sc.secondaryRunners) end
	end
	exports.orderableRunners = _T.orderableRunners
	_T.acceptsCaptainOrders = function(kind)
		do return (((kind ~= "penalty") and (kind ~= "free_kick")) and (kind ~= "corner")) end
	end
	exports.acceptsCaptainOrders = _T.acceptsCaptainOrders
	_T.visibleOptions = function(scenario, carrier, vision)
		local range = _T.scanRange(vision)
		do return A.slice(A.sort(A.map(A.filter(Js.aspread((if scenario.runner then Js.alit(scenario.runner) else Js.alit()), scenario.secondaryRunners), function(r)
			return (Math.hypot((r.pos.x - carrier.x), (r.pos.y - carrier.y)) <= range)
		end), function(r)
			return Js.O({ runner = r, score = _T.spaceScore(r.pos, scenario, carrier) }, { "runner", "score" })
		end), function(a, b)
			return (b.score - a.score)
		end), 0, _T.optionsSeen(vision)) end
	end
	exports.visibleOptions = _T.visibleOptions
	_T.applyFirstTouch = function(scenario, technique, rng)
		local heavy = _T.clamp((1 - (_T.clamp(technique, 0, 100) / 100)), 0, 1)
		local away = (heavy * (0.6 + (rng() * 2.4)))
		local ang = ((rng() * Math.PI) * 2)
		local vp = scenario.viewport
		local inset = 1.4
		scenario.ball = Js.O({ x = _T.clamp((scenario.ball.x + (Math.cos(ang) * away)), (if vp then (vp.x1 + inset) else 2), (if vp then (vp.x2 - inset) else (M_pitch.PITCH_W - 2))), y = _T.clamp((scenario.ball.y + (Math.sin(ang) * away)), 1, (if vp then (vp.y2 - inset) else M_pitch.HALF_LEN)) }, { "x", "y" })
		_T.standOff(scenario, (if vp then (vp.x1 + inset) else nil), (if vp then (vp.x2 - inset) else nil))
		_T.clearOfTheBall(scenario)
		do return away end
	end
	exports.applyFirstTouch = _T.applyFirstTouch
	_T.curlRange = function(technique)
		do return (0.42 + ((_T.clamp(technique, 0, 100) / 100) * 0.58)) end
	end
	exports.curlRange = _T.curlRange
	_T.loftRange = function(technique)
		do return (0.55 + ((_T.clamp(technique, 0, 100) / 100) * 0.45)) end
	end
	exports.loftRange = _T.loftRange
	_T.curveDirFromSwipe = function(dx, dy)
		if ((dx == 0) and (dy == 0)) then
			do return nil end
		end
		if (math.abs(dx) >= math.abs(dy)) then
			do return (if (dx > 0) then "right" else "left") end
		end
		do return (if (dy > 0) then "down" else "up") end
	end
	exports.curveDirFromSwipe = _T.curveDirFromSwipe
	_T.applyCurveSwipe = function(ball, dir)
		if ((dir == "left") or (dir == "right")) then
			local cur = (if ball.curveSpinAdj ~= nil then ball.curveSpinAdj else 0)
			if (math.abs(cur) >= _T.CURVE_SPIN_MAX) then
				do return false end
			end
			local next_ = _T.clamp((cur + (if (dir == "right") then (-_T.CURVE_SPIN_STEP) else _T.CURVE_SPIN_STEP)), (-_T.CURVE_SPIN_MAX), _T.CURVE_SPIN_MAX)
			ball.spin += (next_ - cur)
			ball.curveSpinAdj = next_
			do return true end
		end
		local cur = (if ball.curveVzAdj ~= nil then ball.curveVzAdj else 0)
		if (math.abs(cur) >= _T.CURVE_VZ_MAX) then
			do return false end
		end
		local next_ = _T.clamp((cur + (if (dir == "up") then _T.CURVE_VZ_STEP else (-_T.CURVE_VZ_STEP))), (-_T.CURVE_VZ_MAX), _T.CURVE_VZ_MAX)
		ball.vz += (next_ - cur)
		ball.curveVzAdj = next_
		do return true end
	end
	exports.applyCurveSwipe = _T.applyCurveSwipe
	_T.dragForFullPower = function(power)
		do return ((0.14 - ((_T.clamp(power, 0, 100) / 100) * 0.025)) * _T.DRAG_LENGTH_SCALE) end
	end
	exports.dragForFullPower = _T.dragForFullPower
	_T.launch = function(scenario, dir, power, contact, skills, rng)
		local tech = skills.technique
		local usableCy = (contact.cy * _T.loftRange(tech))
		local loft = _T.clamp(((usableCy + 1) / 2), 0, 1)
		local tMax = _T.clamp(((_T.loftRange(tech) + 1) / 2), 0, 1)
		local lift = Math.sqrt((loft * tMax))
		local sigmaDeg = (((1 - (tech / 100)) * 2.2) + ((power * (1 - (tech / 100))) * 1.6))
		local noise = (_T.gaussian(rng) * sigmaDeg)
		local d = _T.rotateDeg(_T.normalize(dir), noise)
		local Sh = ((power * (18 + (skills.power * 0.18))) * (1 - (loft * 0.25)))
		local vzRaw = ((lift * (7.5 + (skills.power * 0.035))) * (_T.VZ_POWER_FLOOR + (power * _T.VZ_POWER_WEIGHT)))
		local vz = (if A.includes(_T.CROSS_DELIVERY_KINDS, scenario.kind) then Math.min(vzRaw, _T.CROSS_VZ_CAP) else vzRaw)
		local spin = (((contact.cx * _T.curlRange(tech)) * 1.85) * power)
		local topspin = (_T.clamp((-usableCy), -1, 1) * (0.5 + (tech / 200)))
		local ball = Js.O({ pos = Js.O({ x = scenario.ball.x, y = scenario.ball.y }, { "x", "y" }), vel = Js.O({ x = (d.x * Sh), y = (d.y * Sh) }, { "x", "y" }), z = 0.08, vz = vz, spin = spin, topspin = topspin, resting = false, loose = false, contactCd = 0, lastTouch = "attack", receiverControlT = 0, event = nil, inNet = false }, { "pos", "vel", "z", "vz", "spin", "topspin", "resting", "loose", "contactCd", "lastTouch", "receiverControlT", "event", "inNet" })
		_T.offsideSnapshot(scenario, Js.O({ x = scenario.ball.x, y = scenario.ball.y }, { "x", "y" }))
		_T.applyAerialContest(ball, scenario, skills, rng)
		ball.shot = _T.isDriveAtGoal(ball, scenario)
		ball.youStruckAtGoal = ball.shot
		ball.owner = (if ball.loose then "none" else "you")
		_T.markLanding(ball, scenario)
		local at = Js.O({ x = scenario.ball.x, y = scenario.ball.y, z = 0.08 }, { "x", "y", "z" })
		_T.logBallAction(ball, Js.O({ kind = (if ball.youStruckAtGoal then "shot" else "pass"), actor = "you", at = at, mode = (if (scenario.kind == "header") then "header" else (if (scenario.kind == "volley") then "volley" else (if (math.abs(spin) > 0.6) then "curl" else "ground"))) }, { "kind", "actor", "at", "mode" }))
		if (ball.lastTouch == "defence") then
			local by = _T.nearestDefenderActor(scenario, scenario.ball)
			if Js.T(by) then
				_T.logBallAction(ball, Js.O({ kind = "clearance", actor = by, mode = "header", at = at }, { "kind", "actor", "mode", "at" }))
			end
		end
		do return ball end
	end
	exports.launch = _T.launch
	_T.stepKeeper = function(scenario, dt)
		local k = scenario.keeper
		if (k.flash > 0) then
			k.flash = Math.max(0, (k.flash - dt))
		end
		if ((k.saveLunge > 0) and (k.saveLunge < 1)) then
			k.saveLunge = Math.min(1, (k.saveLunge + (dt * 6)))
		end
		k.idleT += (if k.done then dt else 0)
		if k.done then
			do return end
		end
		if (k.adjusting and (not k.scrambling)) then
			local target = _T.clamp(k.targetX, (k.startX - _T.KEEPER_SHUFFLE_MAX), (k.startX + _T.KEEPER_SHUFFLE_MAX))
			local dx = (target - k.x)
			k.x += (Math.sign(dx) * Math.min(math.abs(dx), (_T.KEEPER_SHUFFLE_SPEED * dt)))
			k.idleT += dt
			k.patrolT += dt
			k.dive += ((0 - k.dive) * Math.min(1, (dt * 8)))
			do return end
		end
		if k.scrambling then
			local target = _T.clamp(k.targetX, (k.startX - _T.KEEPER_LATERAL_MAX), (k.startX + _T.KEEPER_LATERAL_MAX))
			local dx = (target - k.x)
			local speed = (_T.KEEPER_DIVE_SPEED * (if (k.saves > 0) then 0.78 else 1))
			k.x += (Math.sign(dx) * Math.min(math.abs(dx), (speed * dt)))
			local wanted = _T.clamp((k.x - k.startX), (-_T.KEEPER_LATERAL_MAX), _T.KEEPER_LATERAL_MAX)
			k.dive += ((wanted - k.dive) * Math.min(1, (dt * 12)))
			if (k.pendingDone and (math.abs((target - k.x)) < 0.05)) then
				k.done = true
				k.pendingDone = false
			end
			do return end
		end
		k.idleT += dt
		k.patrolT += dt
		k.dive += ((0 - k.dive) * Math.min(1, (dt * 8)))
	end
	exports.stepKeeper = _T.stepKeeper
	_T.initDefenders = function(scenario, rng)
		local deadBall = (((scenario.kind == "penalty") or (scenario.kind == "free_kick")) or (scenario.kind == "corner"))
		local order = A.sort(A.map(scenario.defenders, function(d, i)
			return Js.O({ i = i, dist = Math.hypot((d.x - scenario.player.x), (d.y - scenario.player.y)) }, { "i", "dist" })
		end), function(a, b)
			return (a.dist - b.dist)
		end)
		A.forEach(scenario.defenders, function(d, i)
			d.homeX = d.x
			d.homeY = d.y
			d.containT = 0
			d.speed = (1 + ((rng() - 0.5) * 0.18))
			d.role = (if deadBall then "hold" else (if ((function() local _v = order[1]; if _v == nil then return nil end; _v = _v.i; return _v end)() == i) then "press" else "cover"))
			d.baseRole = d.role
			d.interceptTo = nil
		end)
	end
	exports.initDefenders = _T.initDefenders
	_T.stepDefenders = function(scenario, dt, _carrier, _carrierHasBall, ball)
		if ball == nil then ball = nil end
		if (scenario.kind ~= "free_kick") then
			do return nil end
		end
		do
			local _arr51 = scenario.defenders
			local _i52 = 0
			while _i52 < Js.alen(_arr51) do
				_i52 += 1
				local d = _arr51[_i52]
				if (d.baseRole ~= "hold") then
					do continue end
				end
				if (d.z == nil) then
					d.z = 0
					d.vz = 0
				end
				if (((ball and (d.z == 0)) and ((if d.vz ~= nil then d.vz else 0) == 0)) and ((if d.containT ~= nil then d.containT else 0) >= _T.WALL_JUMP_DELAY)) then
					d.vz = _T.WALL_JUMP_VZ
				end
				if ball then
					d.containT = ((if d.containT ~= nil then d.containT else 0) + dt)
				end
				if (((if d.z ~= nil then d.z else 0) > 0) or ((if d.vz ~= nil then d.vz else 0) > 0)) then
					d.vz = ((if d.vz ~= nil then d.vz else 0) - (9.8 * dt))
					d.z = Math.max(0, ((if d.z ~= nil then d.z else 0) + ((if d.vz ~= nil then d.vz else 0) * dt)))
					if (d.z == 0) then
						d.vz = 0
					end
				end
			end
		end
		do return nil end
	end
	exports.stepDefenders = _T.stepDefenders
	_T.distToSegment = function(p, a, b)
		local sx = (b.x - a.x)
		local sy = (b.y - a.y)
		local len2 = ((sx * sx) + (sy * sy))
		if (len2 < 0.000001) then
			do return Math.hypot((p.x - a.x), (p.y - a.y)) end
		end
		local t = _T.clamp(((((p.x - a.x) * sx) + ((p.y - a.y) * sy)) / len2), 0, 1)
		do return Math.hypot((p.x - (a.x + (sx * t))), (p.y - (a.y + (sy * t)))) end
	end
	_T.laneClearance = function(a, b, defenders)
		local sx = (b.x - a.x)
		local sy = (b.y - a.y)
		local len2 = ((sx * sx) + (sy * sy))
		if (len2 < 0.000001) then
			do return 99 end
		end
		local worst = 99
		do
			local _arr53 = defenders
			local _i54 = 0
			while _i54 < Js.alen(_arr53) do
				_i54 += 1
				local d = _arr53[_i54]
				local t = ((((d.x - a.x) * sx) + ((d.y - a.y) * sy)) / len2)
				if ((t < 0.2) or (t > 1.05)) then
					do continue end
				end
				local cl = _T.clamp(t, 0, 1)
				worst = Math.min(worst, Math.hypot((d.x - (a.x + (sx * cl))), (d.y - (a.y + (sy * cl)))))
			end
		end
		do return worst end
	end
	_T.spaceScore = function(p, scenario, carrier)
		if ((((p.x < 3) or (p.x > (M_pitch.PITCH_W - 3))) or (p.y < 1.5)) or (p.y > (M_pitch.HALF_LEN + 6))) then
			do return 0 end
		end
		local passLen = Math.hypot((p.x - carrier.x), (p.y - carrier.y))
		if (passLen < (_T.SUPPORT_MIN_PASS * 0.5)) then
			do return 0 end
		end
		local nearestDef = 99
		do
			local _arr55 = scenario.defenders
			local _i56 = 0
			while _i56 < Js.alen(_arr55) do
				_i56 += 1
				local d = _arr55[_i56]
				nearestDef = Math.min(nearestDef, Math.hypot((d.x - p.x), (d.y - p.y)))
			end
		end
		local lane = _T.laneClearance(carrier, p, scenario.defenders)
		local laneOpen = _T.clamp((lane / 3.5), 0, 1)
		local unmarked = _T.clamp((nearestDef / 7), 0, 1)
		local advance = ((_T.clamp(((carrier.y - p.y) / 18), -0.4, 1) * 0.5) + 0.5)
		local range = (if (passLen < _T.SUPPORT_MIN_PASS) then (passLen / _T.SUPPORT_MIN_PASS) else _T.clamp((1 - ((passLen - _T.SUPPORT_MIN_PASS) / (_T.SUPPORT_MAX_PASS - _T.SUPPORT_MIN_PASS))), 0, 1))
		local goalC = Js.O({ x = ((scenario.goal.x1 + scenario.goal.x2) / 2), y = 0 }, { "x", "y" })
		local blocksShot = (if ((_T.distToSegment(p, carrier, goalC) < 2.6) and (p.y < carrier.y)) then 1 else 0)
		do return _T.clamp((((((laneOpen * 0.34) + (unmarked * 0.26)) + (advance * 0.2)) + (range * 0.2)) - (blocksShot * 0.3)), 0, 1) end
	end
	exports.spaceScore = _T.spaceScore
	_T.bestSupportPoint = function(scenario, carrier, from)
		local best = Js.O({ x = from.x, y = from.y }, { "x", "y" })
		local bestScore = (_T.spaceScore(from, scenario, carrier) + 0.04)
		do
			local _arr57 = Js.alit(3.5, 7, 11)
			local _i58 = 0
			while _i58 < Js.alen(_arr57) do
				_i58 += 1
				local radius = _arr57[_i58]
				for a = 0, 11 do
					local ang = (((a / 12) * Math.PI) * 2)
					local p = Js.O({ x = (from.x + (Math.cos(ang) * radius)), y = (from.y + (Math.sin(ang) * radius)) }, { "x", "y" })
					local s = _T.spaceScore(p, scenario, carrier)
					if (s > bestScore) then
						bestScore = s
						best = p
					end
				end
			end
		end
		do return best end
	end
	exports.bestSupportPoint = _T.bestSupportPoint
	_T.predictBall = function(ball, t)
		local x = ball.pos.x
		local y = ball.pos.y
		local z = ball.z
		local vx = ball.vel.x
		local vy = ball.vel.y
		local vz = ball.vz
		local dt = _T.PREDICT_STEP
		local real = M_ballPhysics.realBallOn()
		do
			local s = 0
			local _first59 = true
			while true do
				if not _first59 then
					s += dt
				end
				_first59 = false
				if not (s < (t - 0.000001)) then break end
				if (z > 0.02) then
					local k = (if real then M_ballPhysics.airDragFactor(vx, vy, vz, 1, dt) else Math.max(0, (1 - (_T.AIR_DRAG * dt))))
					vx *= k
					vy *= k
					if real then
						vz *= k
					end
				end
				vz -= (_T.G * dt)
				z += (vz * dt)
				x += (vx * dt)
				y += (vy * dt)
				if (z <= 0) then
					z = 0
					if (vz < (-_T.MIN_BOUNCE_VZ)) then
						if real then
							local b = M_ballPhysics.bounceReal(vz, Math.hypot(vx, vy), 0, 1)
							vz = b.vz
							vx *= b.keep
							vy *= b.keep
						else
							vz = ((-vz) * _T.BOUNCE_VZ)
							vx *= _T.BOUNCE_H
							vy *= _T.BOUNCE_H
						end
					else
						vz = 0
						local sp = Math.hypot(vx, vy)
						local drop = (if real then M_ballPhysics.rollDrop(sp, 1, 1, dt) else (_T.GROUND_FRICTION * dt))
						if (sp <= drop) then
							vx = 0
							vy = 0
						else
							local f = ((sp - drop) / sp)
							vx *= f
							vy *= f
						end
					end
				end
			end
		end
		do return Js.O({ pos = Js.O({ x = x, y = y }, { "x", "y" }), z = z }, { "pos", "z" }) end
	end
	_T.runMeetPoint = function(p, speed, ball)
		local vs = Math.hypot(ball.vel.x, ball.vel.y)
		if (vs < _T.DEAD_BALL_SPEED) then
			do return nil end
		end
		local dx = (p.x - ball.pos.x)
		local dy = (p.y - ball.pos.y)
		local d = Math.hypot(dx, dy)
		if (d > _T.RUN_MEET_R) then
			do return nil end
		end
		if ((d > _T.RUN_MEET_CLOSE) and ((((ball.vel.x * dx) + (ball.vel.y * dy)) / (vs * d)) < 0.25)) then
			do return nil end
		end
		local x = ball.pos.x
		local y = ball.pos.y
		local z = ball.z
		local vx = ball.vel.x
		local vy = ball.vel.y
		local vz = ball.vz
		local dt = _T.PREDICT_STEP
		local real = M_ballPhysics.realBallOn()
		do
			local s = dt
			local _first60 = true
			while true do
				if not _first60 then
					s += dt
				end
				_first60 = false
				if not (s <= (_T.RUN_MEET_T + 0.000001)) then break end
				if (z > 0.02) then
					local k = (if real then M_ballPhysics.airDragFactor(vx, vy, vz, 1, dt) else Math.max(0, (1 - (_T.AIR_DRAG * dt))))
					vx *= k
					vy *= k
					if real then
						vz *= k
					end
				end
				vz -= (_T.G * dt)
				z += (vz * dt)
				x += (vx * dt)
				y += (vy * dt)
				if (z <= 0) then
					z = 0
					if (vz < (-_T.MIN_BOUNCE_VZ)) then
						if real then
							local b = M_ballPhysics.bounceReal(vz, Math.hypot(vx, vy), 0, 1)
							vz = b.vz
							vx *= b.keep
							vy *= b.keep
						else
							vz = ((-vz) * _T.BOUNCE_VZ)
							vx *= _T.BOUNCE_H
							vy *= _T.BOUNCE_H
						end
					else
						vz = 0
						local sp = Math.hypot(vx, vy)
						local drop = (if real then M_ballPhysics.rollDrop(sp, 1, 1, dt) else (_T.GROUND_FRICTION * dt))
						if (sp <= drop) then
							vx = 0
							vy = 0
						else
							local f = ((sp - drop) / sp)
							vx *= f
							vy *= f
						end
					end
				end
				if (Math.hypot((x - p.x), (y - p.y)) <= ((speed * s) + (_T.PASS_CONTROL_R * 0.5))) then
					do return Js.O({ x = x, y = y }, { "x", "y" }) end
				end
			end
		end
		do return (if (d <= _T.RUN_MEET_CLOSE) then Js.O({ x = ball.pos.x, y = ball.pos.y }, { "x", "y" }) else nil) end
	end
	_T.stepOrderedRun = function(p, o, speed, ball, dt)
		local meet = _T.runMeetPoint(p, speed, ball)
		local to = ((if meet ~= nil then meet else o.commandedTo) or nil)
		if (not to) then
			do return false end
		end
		local dx = (to.x - p.x)
		local dy = (to.y - p.y)
		local togo = Math.hypot(dx, dy)
		if ((not meet) and (togo < 0.6)) then
			o.heldAt = Js.O({ x = to.x, y = to.y }, { "x", "y" })
			o.commandedTo = nil
			do return false end
		end
		local step = Math.min(togo, (speed * dt))
		if (togo > 0.000001) then
			p.x += ((dx / togo) * step)
			p.y += ((dy / togo) * step)
		end
		do return true end
	end
	_T.firstBounceAt = function(ball, conditions, horizon, goal, crossbar)
		if horizon == nil then horizon = 5 end
		if crossbar == nil then crossbar = M_pitch.GOAL_H end
		if ((ball.z <= 0.25) and (ball.vz <= 0)) then
			do return nil end
		end
		local x = ball.pos.x
		local y = ball.pos.y
		local z = ball.z
		local vx = ball.vel.x
		local vy = ball.vel.y
		local vz = ball.vz
		local dt = (1 / 180)
		local real = M_ballPhysics.realBallOn()
		local spin = ball.spin
		do
			local t = 0
			local _first61 = true
			while true do
				if not _first61 then
					t += dt
				end
				_first61 = false
				if not (t < horizon) then break end
				local sp = Math.hypot(vx, vy)
				if ((sp > 0.01) and (math.abs(spin) > 0.0001)) then
					local ax = ((spin * _T.CURL_K) * vy)
					local ay = ((spin * _T.CURL_K) * (-vx))
					vx += (ax * dt)
					vy += (ay * dt)
				end
				if real then
					spin *= Math.exp(((-dt) / 10))
				end
				if (z > 0.02) then
					local k = (if real then M_ballPhysics.airDragFactor(vx, vy, vz, ((function() local _v = conditions; if _v == nil then return nil end; _v = _v.drag; return _v end)() or 1), dt) else Math.max(0, (1 - ((_T.AIR_DRAG * ((function() local _v = conditions; if _v == nil then return nil end; _v = _v.drag; return _v end)() or 1)) * dt))))
					vx *= k
					vy *= k
					if real then
						vz *= k
					end
					if Js.T((function() local _v = conditions; if _v == nil then return nil end; _v = _v.wind; return _v end)()) then
						vx += (conditions.wind * dt)
					end
					if (function() local _v = conditions; if _v == nil then return nil end; _v = _v.windV; return _v end)() then
						local a = M_pitchWeather.windAccel(vx, vy, vz, z, conditions.windV, real)
						vx += (a.ax * dt)
						vy += (a.ay * dt)
						vz += (a.az * dt)
					end
				end
				vz -= (_T.G * dt)
				local nz = (z + (vz * dt))
				local py = y
				x += (vx * dt)
				y += (vy * dt)
				if (nz <= 0) then
					local f = (z / (function() local _l = (z - nz); if Js.T(_l) then return _l end; return 1 end)())
					do return Js.O({ x = (x - ((vx * dt) * (1 - f))), y = (y - ((vy * dt) * (1 - f))) }, { "x", "y" }) end
				end
				if ((py > 0) and (y <= 0)) then
					local f = (py / (function() local _l = (py - y); if Js.T(_l) then return _l end; return 1 end)())
					local crossX = (x - ((vx * dt) * (1 - f)))
					local crossZ = (z + ((nz - z) * f))
					if (M_pitch.insideGoalMouth(crossX, (function() local _v = goal; if _v == nil then return nil end; _v = _v.x1; return _v end)(), (function() local _v = goal; if _v == nil then return nil end; _v = _v.x2; return _v end)()) and (crossZ <= crossbar)) then
						do return Js.O({ x = crossX, y = 0 }, { "x", "y" }) end
					end
				end
				z = nz
			end
		end
		do return nil end
	end
	exports.firstBounceAt = _T.firstBounceAt
	_T.markLanding = function(ball, scenario)
		ball.landAt = (_T.firstBounceAt(ball, scenario.conditions) or nil)
	end
	exports.markLanding = _T.markLanding
	_T.headingInsidePosts = function(ball, scenario)
		if (ball.vel.y >= -1) then
			do return false end
		end
		local t = (ball.pos.y / (-ball.vel.y))
		local b = _T.predictBall(ball, Math.min(t, 3))
		do return (((b.pos.x > (scenario.goal.x1 - _T.ON_TARGET_PAD)) and (b.pos.x < (scenario.goal.x2 + _T.ON_TARGET_PAD))) and (b.z < (scenario.crossbar + 0.3))) end
	end
	exports.headingInsidePosts = _T.headingInsidePosts
	_T.isDriveAtGoal = function(ball, scenario)
		if ball.loose then
			do return true end
		end
		local speed = Math.hypot(ball.vel.x, ball.vel.y)
		if (speed < _T.LAYOFF_MAX_SPEED) then
			do return false end
		end
		if (ball.vel.y >= -1) then
			do return false end
		end
		local onTarget = _T.headingInsidePosts(ball, scenario)
		local toGoal = ((ball.pos.y / (-ball.vel.y)) * speed)
		local mates = Js.aspread((if scenario.runner then Js.alit(scenario.runner.pos) else Js.alit()), A.map(scenario.secondaryRunners, function(r)
			return r.pos
		end))
		if (not scenario.follower.shot) then
			A.push(mates, Js.O({ x = scenario.follower.x, y = scenario.follower.y }, { "x", "y" }))
		end
		do
			local _arr62 = mates
			local _i63 = 0
			while _i63 < Js.alen(_arr62) do
				_i63 += 1
				local pos = _arr62[_i63]
				local dx = (pos.x - ball.pos.x)
				local dy = (pos.y - ball.pos.y)
				local t = (((dx * ball.vel.x) + (dy * ball.vel.y)) / (speed * speed))
				if ((t <= 0) or ((t * speed) > toGoal)) then
					do continue end
				end
				if M_hitbox.hitboxesOn() then
					local zAt = ((ball.z + (ball.vz * t)) - (((0.5 * _T.G) * t) * t))
					local hb = M_hitbox.hitboxDials()
					if ((zAt > M_hitbox.headTop(0)) and (((speed > _T.SHOT_OVER_SPEED) and ((ball.vz - (_T.G * t)) > 0)) or (zAt > (M_hitbox.headTop(hb.jumpHeight) + hb.headerBonus)))) then
						do continue end
					end
				end
				local offX = (dx - (ball.vel.x * t))
				local offY = (dy - (ball.vel.y * t))
				local lane = (if onTarget then _T.ON_LINE_R else ((_T.PASS_CONTROL_R * 1.2) * _T.clamp((1.35 - (speed / 34)), 0.35, 1.2)))
				if (Math.hypot(offX, offY) < lane) then
					do return false end
				end
			end
		end
		local t = (ball.pos.y / (-ball.vel.y))
		local b = _T.predictBall(ball, Math.min(t, 3))
		do return (((b.pos.x > (scenario.goal.x1 - _T.SHOT_MOUTH_PAD)) and (b.pos.x < (scenario.goal.x2 + _T.SHOT_MOUTH_PAD))) and (b.z < (scenario.crossbar + 3))) end
	end
	exports.isDriveAtGoal = _T.isDriveAtGoal
	_T.sidestepShot = function(p, ball, dt)
		local sp = (function() local _l = Math.hypot(ball.vel.x, ball.vel.y); if Js.T(_l) then return _l end; return 1 end)()
		local ux = (ball.vel.x / sp)
		local uy = (ball.vel.y / sp)
		local rx = (p.x - ball.pos.x)
		local ry = (p.y - ball.pos.y)
		local along = ((rx * ux) + (ry * uy))
		if (along <= 0) then
			do return false end
		end
		local px = (rx - (along * ux))
		local py = (ry - (along * uy))
		local off = Math.hypot(px, py)
		if (off >= _T.SIDESTEP_CLEAR) then
			do return true end
		end
		if (off < 0.05) then
			px = (-uy)
			py = ux
			if ((px * (p.x - M_pitch.CX)) < 0) then
				px = (-px)
				py = (-py)
			end
		end
		local n = (function() local _l = Math.hypot(px, py); if Js.T(_l) then return _l end; return 1 end)()
		local step = Math.min((_T.SIDESTEP_CLEAR - off), (_T.SIDESTEP_SPEED * dt))
		p.x += ((px / n) * step)
		p.y += ((py / n) * step)
		do return true end
	end
	_T.shapeMatePos = function(sc, m)
		do return (if (m == "follower") then sc.follower else m.pos) end
	end
	_T.inFreeKickWall = function(sc, d)
		do return (((sc.kind == "free_kick") and (d.baseRole == "hold")) and (Math.hypot((d.x - sc.ball.x), (d.y - sc.ball.y)) < _T.FREE_KICK_WALL_R)) end
	end
	_T.stepShape = function(sc, ball, dt, dead, fetch)
		local speed, anchor, runners, mates, defs, st, nearest, chaserDef, chaserMate, go, chasePace, line, attackers
		nearest = function(xs, pos, cur)
			local best = nil
			local bd = math.huge
			do
				local _arr64 = xs
				local _i65 = 0
				while _i65 < Js.alen(_arr64) do
					_i65 += 1
					local t = _arr64[_i65]
					local p = pos(t)
					local d = Math.hypot((p.x - anchor.x), (p.y - anchor.y))
					if (d < bd) then
						bd = d
						best = t
					end
				end
			end
			if (((cur ~= nil) and A.includes(xs, cur)) and (best ~= cur)) then
				local p = pos(cur)
				if ((Math.hypot((p.x - anchor.x), (p.y - anchor.y)) - bd) < _T.SHAPE_SWITCH_BY) then
					do return cur end
				end
			end
			do return best end
		end
		speed = Math.hypot(ball.vel.x, ball.vel.y)
		anchor = (if (dead or (speed < 0.5)) then Js.O({ x = ball.pos.x, y = ball.pos.y }, { "x", "y" }) else _T.predictBall(ball, _T.SHAPE_READ_AHEAD).pos)
		runners = Js.aspread((if sc.runner then Js.alit(sc.runner) else Js.alit()), sc.secondaryRunners)
		mates = A.filter(runners, function(r)
			return (not (r.commandedTo and (not dead)))
		end)
		if ((not sc.follower.shot) or dead) then
			A.push(mates, "follower")
		end
		defs = A.filter(sc.defenders, function(d)
			return (not ((d.baseRole == "hold") and (not dead)))
		end)
		st = _T.SHAPE_STATE:get(sc)
		if (not st) then
			st = Js.O({ mate = nil, def = nil, start = Js.Map.new(), ball0 = Js.O({ x = ball.pos.x, y = ball.pos.y }, { "x", "y" }) }, { "mate", "def", "start", "ball0" })
			_T.SHAPE_STATE:set(sc, st)
		end
		if (st.start.size == 0) then
			st.ball0 = Js.O({ x = ball.pos.x, y = ball.pos.y }, { "x", "y" })
			do
				local _arr66 = runners
				local _i67 = 0
				while _i67 < Js.alen(_arr66) do
					_i67 += 1
					local r = _arr66[_i67]
					st.start:set(r, Js.O({ x = r.pos.x, y = r.pos.y }, { "x", "y" }))
				end
			end
			st.start:set(sc.follower, Js.O({ x = sc.follower.x, y = sc.follower.y }, { "x", "y" }))
			do
				local _arr68 = sc.defenders
				local _i69 = 0
				while _i69 < Js.alen(_arr68) do
					_i69 += 1
					local d = _arr68[_i69]
					st.start:set(d, Js.O({ x = d.x, y = d.y }, { "x", "y" }))
				end
			end
		end
		st.mate = nearest(mates, function(m)
			return _T.shapeMatePos(sc, m)
		end, st.mate)
		st.def = nearest(defs, function(d)
			return d
		end, st.def)
		chaserDef = st.def
		chaserMate = st.mate
		go = function(p, to, pace)
			local dx = (to.x - p.x)
			local dy = (to.y - p.y)
			local d = Math.hypot(dx, dy)
			if (d < 0.01) then
				do return 0 end
			end
			local step = Math.min(d, (pace * dt))
			p.x += ((dx / d) * step)
			p.y += ((dy / d) * step)
			do return step end
		end
		chasePace = function(p)
			return (if dead then fetch(Math.hypot((ball.pos.x - p.x), (ball.pos.y - p.y))) else _T.SHAPE_CHASE_SPEED)
		end
		line = A.filter(defs, function(d)
			return ((d ~= chaserDef) and (not _T.inFreeKickWall(sc, d)))
		end)
		do
			local _arr70 = sc.defenders
			local _i71 = 0
			while _i71 < Js.alen(_arr70) do
				_i71 += 1
				local d = _arr70[_i71]
				d.chasing = (d == chaserDef)
			end
		end
		if Js.T(Js.alen(line)) then
			local sx = 0
			local sy = 0
			do
				local _arr72 = line
				local _i73 = 0
				while _i73 < Js.alen(_arr72) do
					_i73 += 1
					local d = _arr72[_i73]
					local s0 = (st.start:get(d) or d)
					sx += s0.x
					sy += s0.y
				end
			end
			sx /= Js.alen(line)
			sy /= Js.alen(line)
			local shiftX = _T.clamp(((anchor.x - sx) * _T.SHAPE_LINE_SHIFT), -5, 5)
			local shiftY = (Math.max(1.5, Math.min(sy, (anchor.y - _T.SHAPE_LINE_GOALSIDE))) - sy)
			do
				local _arr74 = line
				local _i75 = 0
				while _i75 < Js.alen(_arr74) do
					_i75 += 1
					local d = _arr74[_i75]
					local s0 = (st.start:get(d) or Js.O({ x = d.x, y = d.y }, { "x", "y" }))
					go(d, Js.O({ x = (s0.x + shiftX), y = (s0.y + shiftY) }, { "x", "y" }), _T.SHAPE_LINE_SPEED)
				end
			end
		end
		if chaserDef then
			go(chaserDef, anchor, chasePace(chaserDef))
		end
		attackers = Js.alit()
		do
			local _arr76 = Js.aspread(runners, Js.alit("follower"))
			local _i77 = 0
			while _i77 < Js.alen(_arr76) do
				_i77 += 1
				local m = _arr76[_i77]
				if (m == chaserMate) then
					do continue end
				end
				if (((m ~= "follower") and m.commandedTo) and (not dead)) then
					do continue end
				end
				local p = _T.shapeMatePos(sc, m)
				if (p.y > (anchor.y + _T.SHAPE_MIDFIELD_BEHIND)) then
					do continue end
				end
				A.push(attackers, m)
			end
		end
		do
			local _arr78 = runners
			local _i79 = 0
			while _i79 < Js.alen(_arr78) do
				_i79 += 1
				local r = _arr78[_i79]
				r.chasing = (r == chaserMate)
			end
		end
		sc.follower.chasing = (chaserMate == "follower")
		if Js.T(Js.alen(attackers)) then
			local shift = Js.O({ x = _T.clamp(((anchor.x - st.ball0.x) * _T.SHAPE_PUSH_SHARE), -6, 6), y = _T.clamp(((anchor.y - st.ball0.y) * _T.SHAPE_PUSH_SHARE), -6, 6) }, { "x", "y" })
			do
				local _arr80 = attackers
				local _i81 = 0
				while _i81 < Js.alen(_arr80) do
					_i81 += 1
					local m = _arr80[_i81]
					local key = (if (m == "follower") then sc.follower else m)
					local s0 = (st.start:get(key) or _T.shapeMatePos(sc, m))
					local p = _T.shapeMatePos(sc, m)
					local to = Js.O({ x = (s0.x + shift.x), y = (s0.y + shift.y) }, { "x", "y" })
					local toBall = Math.hypot((to.x - anchor.x), (to.y - anchor.y))
					if (toBall < _T.SHAPE_PUSH_STOP) then
						local k2 = (_T.SHAPE_PUSH_STOP / Math.max(toBall, 0.01))
						to.x = (anchor.x + ((to.x - anchor.x) * k2))
						to.y = (anchor.y + ((to.y - anchor.y) * k2))
					end
					local moved = go(p, to, _T.SHAPE_PUSH_SPEED)
					if (m == "follower") then
						sc.follower.active = (sc.follower.active or (moved > 0))
					else
						m.moving = (moved > 0)
						m.sprint = false
					end
				end
			end
		end
		if Js.T(chaserMate) then
			local p = _T.shapeMatePos(sc, chaserMate)
			go(p, anchor, chasePace(p))
			if (chaserMate == "follower") then
				sc.follower.active = true
			else
				chaserMate.moving = true
				chaserMate.sprint = (not dead)
			end
		end
	end
	_T.endShape = function(sc)
		local st = _T.SHAPE_STATE:get(sc)
		if (st and Js.T(st.start.size)) then
			st.start:clear()
			st.mate = nil
			st.def = nil
		end
		if sc.runner then
			sc.runner.chasing = false
		end
		do
			local _arr82 = sc.secondaryRunners
			local _i83 = 0
			while _i83 < Js.alen(_arr82) do
				_i83 += 1
				local r = _arr82[_i83]
				r.chasing = false
			end
		end
		sc.follower.chasing = false
		do
			local _arr84 = sc.defenders
			local _i85 = 0
			while _i85 < Js.alen(_arr84) do
				_i85 += 1
				local d = _arr84[_i85]
				d.chasing = false
			end
		end
	end
	_T.stepReactions = function(scenario, ball, dt, rng)
		if rng == nil then rng = Math.random end
		local speed = Math.hypot(ball.vel.x, ball.vel.y)
		local dead = (ball.resting or ((speed < _T.DEAD_BALL_SPEED) and (ball.z < 0.4)))
		local vp = scenario.viewport
		if (vp and ((((ball.pos.x < (vp.x1 - 1)) or (ball.pos.x > (vp.x2 + 1))) or (ball.pos.y < (vp.y1 - 1))) or (ball.pos.y > (vp.y2 + 1)))) then
			do return end
		end
		local move = function(p, pace)
			local dx = (ball.pos.x - p.x)
			local dy = (ball.pos.y - p.y)
			local dist = (function() local _l = Math.hypot(dx, dy); if Js.T(_l) then return _l end; return 1 end)()
			local step = Math.min(dist, (pace * dt))
			p.x += ((dx / dist) * step)
			p.y += ((dy / dist) * step)
		end
		local fetch = function(dist)
			return (if (dist > _T.FETCH_FAR) then _T.FETCH_SPEED else _T.WALK_SPEED)
		end
		local shape = (ball.loose or dead)
		if shape then
			_T.stepShape(scenario, ball, dt, dead, fetch)
		else
			_T.endShape(scenario)
		end
		local shotLive = ((((ball.shot == true) and (not ball.loose)) and (not dead)) and (speed >= _T.DEAD_BALL_SPEED))
		do
			local _arr86 = (if shape then Js.alit() else Js.aspread((if scenario.runner then Js.alit(scenario.runner) else Js.alit()), scenario.secondaryRunners))
			local _i87 = 0
			while _i87 < Js.alen(_arr86) do
				_i87 += 1
				local r = _arr86[_i87]
				local dist = Math.hypot((ball.pos.x - r.pos.x), (ball.pos.y - r.pos.y))
				if ((r.commandedTo or r.heldAt) and (not dead)) then
					r.moving = _T.stepOrderedRun(r.pos, r, r.speed, ball, dt)
					r.sprint = r.moving
					do continue end
				end
				if dead then
					move(r.pos, fetch(dist))
					r.moving = true
					do continue end
				end
				if (shotLive and _T.sidestepShot(r.pos, ball, dt)) then
					r.moving = true
					r.sprint = false
					do continue end
				end
				if (dist > _T.REACT_R) then
					r.moving = false
					do continue end
				end
				move(r.pos, _T.REACT_SPEED)
				r.moving = true
				r.sprint = false
			end
		end
		do
			local f = scenario.follower
			if shape then
			elseif ((shotLive and (not f.commandedTo)) and _T.sidestepShot(f, ball, dt)) then
			elseif ((f.commandedTo or (f.heldAt and (not f.shot))) and (not dead)) then
				f.active = _T.stepOrderedRun(f, f, _T.RUNNER_SPEED, ball, dt)
			else
				local dist = Math.hypot((ball.pos.x - f.x), (ball.pos.y - f.y))
				if dead then
					move(f, fetch(dist))
					f.active = true
				elseif ((not f.shot) and (dist <= _T.REACT_R)) then
					move(f, _T.REACT_SPEED)
					f.active = true
				end
			end
			if (((((((((not f.shot) and f.active) and ball.loose) and (not ball.inNet)) and (ball.z < 2.3)) and (ball.pos.y < M_pitch.BOX_DEPTH)) and (ball.contactCd <= 0)) and (Math.hypot((ball.pos.x - f.x), (ball.pos.y - f.y)) < _T.CONTROL_R)) and (not _T.offsideOffence(scenario, f.offside))) then
				local tx = (M_pitch.POST_L + (rng() * (M_pitch.POST_R - M_pitch.POST_L)))
				local dir = _T.normalize(Js.O({ x = (tx - ball.pos.x), y = (-(Math.max(ball.pos.y, 0.5))) }, { "x", "y" }))
				local sp = (17 + (rng() * 8))
				ball.vel = Js.O({ x = (dir.x * sp), y = (dir.y * sp) }, { "x", "y" })
				ball.vz = (0.3 + (rng() * 0.7))
				ball.spin *= 0.3
				ball.loose = false
				ball.contactCd = 0.18
				ball.lastTouch = "attack"
				_T.markLanding(ball, scenario)
				f.shot = true
				ball.youStruckAtGoal = false
				scenario.receiverShot = true
				scenario.receiverShots = ((if scenario.receiverShots ~= nil then scenario.receiverShots else 0) + 1)
			end
		end
		do
			local _arr88 = (if shape then Js.alit() else scenario.defenders)
			local _i89 = 0
			while _i89 < Js.alen(_arr88) do
				_i89 += 1
				local d = _arr88[_i89]
				if ((d.baseRole == "hold") and (not dead)) then
					do continue end
				end
				local dist = Math.hypot((ball.pos.x - d.x), (ball.pos.y - d.y))
				if dead then
					move(d, fetch(dist))
					do continue end
				end
				if (dist > _T.REACT_R) then
					do continue end
				end
				move(d, _T.REACT_SPEED)
			end
		end
	end
	exports.stepReactions = _T.stepReactions
	_T.touchChaseSpeed = function(pace)
		do return _T.clamp((6.8 + (((_T.clamp(pace, 0, 100) - 40) / 60) * 1.6)), 6, 8.4) end
	end
	exports.touchChaseSpeed = _T.touchChaseSpeed
	_T.stepTouchChase = function(scenario, ball, dt, speed)
		if speed == nil then speed = _T.TOUCH_CHASE_SPEED end
		local p = scenario.player
		local dist = Math.hypot((p.x - ball.pos.x), (p.y - ball.pos.y))
		if (not scenario.touchChaseArmed) then
			if (dist > _T.TOUCH_CHASE_START_R) then
				scenario.touchChaseArmed = true
			else
				do return false end
			end
		end
		if (dist > 0.02) then
			local step = Math.min(dist, (speed * dt))
			p.x += (((ball.pos.x - p.x) / dist) * step)
			p.y += (((ball.pos.y - p.y) / dist) * step)
		end
		local after = Math.hypot((p.x - ball.pos.x), (p.y - ball.pos.y))
		do return (after <= _T.TOUCH_CHASE_CATCH_R) end
	end
	exports.stepTouchChase = _T.stepTouchChase
	_T.setClearanceRules = function(r)
		_T.clearanceRules = Js.ospread(_T.CLEARANCE_DEFAULTS, (if r ~= nil then r else Js.O({}, nil)))
	end
	exports.setClearanceRules = _T.setClearanceRules
	_T.getClearanceRules = function()
		do return _T.clearanceRules end
	end
	exports.getClearanceRules = _T.getClearanceRules
	_T.miscueChance = function(quality, r)
		if r == nil then r = _T.clearanceRules end
		local q = (if quality ~= nil then quality else 70)
		local t = _T.clamp(((q - 50) / 40), 0, 1)
		do return (r.miscueWeak + ((r.miscueStrong - r.miscueWeak) * t)) end
	end
	exports.miscueChance = _T.miscueChance
	_T.clearBall = function(ball, rng, scenario, act)
		local at = Js.O({ x = ball.pos.x, y = ball.pos.y, z = ball.z }, { "x", "y", "z" })
		if scenario then
			_T.clearOffside(scenario)
		end
		local R = _T.clearanceRules
		local ang = (((((rng() * 2) - 1) * Math.min(R.maxAngleDeg, 85)) * Math.PI) / 180)
		local sp = (R.speedMin + (rng() * Math.max(0, (R.speedMax - R.speedMin))))
		ball.vel = Js.O({ x = (Math.sin(ang) * sp), y = (Math.cos(ang) * sp) }, { "x", "y" })
		ball.vz = (4 + (rng() * 3))
		ball.spin = 0
		ball.topspin = 0
		ball.resting = false
		ball.settling = false
		ball.loose = false
		ball.owner = "opponent"
		ball.lastTouch = "defence"
		ball.cleared = true
		ball.clearHitAt = nil
		if scenario then
			scenario.keeper.adjusting = false
		end
		if act then
			_T.logBallAction(ball, Js.ospread(act, Js.O({ at = at }, { "at" })))
		end
	end
	exports.clearBall = _T.clearBall
	_T.miscueBall = function(ball, rng, scenario, act)
		local at = Js.O({ x = ball.pos.x, y = ball.pos.y, z = ball.z }, { "x", "y", "z" })
		_T.clearOffside(scenario)
		local DEG = (Math.PI / 180)
		local u = rng()
		local side = (if (rng() < 0.5) then -1 else 1)
		local a = nil
		local s = nil
		local vz = nil
		if (u < 0.4) then
			a = (((side * rng()) * 60) * DEG)
			s = (4.5 + (rng() * 2.3))
			vz = (rng() * 1.5)
		elseif (u < 0.7) then
			a = (((side * rng()) * 45) * DEG)
			s = (2 + (rng() * 3))
			vz = (10 + (rng() * 4))
		else
			a = ((side * (60 + (rng() * 30))) * DEG)
			s = (9 + (rng() * 6))
			vz = (1 + (rng() * 3))
		end
		ball.vel = Js.O({ x = (Math.sin(a) * s), y = (Math.cos(a) * s) }, { "x", "y" })
		ball.vz = vz
		ball.spin = ((rng() - 0.5) * 0.4)
		ball.topspin = 0
		ball.resting = false
		ball.settling = false
		ball.loose = true
		ball.shot = false
		ball.owner = "none"
		ball.lastTouch = "defence"
		ball.cleared = false
		ball.event = "miscue"
		scenario.keeper.adjusting = false
		_T.logBallAction(ball, Js.ospread(act, Js.O({ at = at }, { "at" })))
		_T.markLanding(ball, scenario)
	end
	_T.clearanceBodyHit = function(ball, scenario, kicker)
		local R = _T.clearanceRules
		local sp = Math.hypot(ball.vel.x, ball.vel.y)
		if (sp < 0.01) then
			do return nil end
		end
		local ux = (ball.vel.x / sp)
		local uy = (ball.vel.y / sp)
		local bodies = Js.alit()
		do
			local _arr90 = scenario.defenders
			local _i91 = 0
			while _i91 < Js.alen(_arr90) do
				_i91 += 1
				local d = _arr90[_i91]
				if (d ~= kicker) then
					A.push(bodies, Js.O({ x = d.x, y = d.y }, { "x", "y" }))
				end
			end
		end
		A.push(bodies, Js.O({ x = scenario.player.x, y = scenario.player.y }, { "x", "y" }))
		if scenario.follower.active then
			A.push(bodies, Js.O({ x = scenario.follower.x, y = scenario.follower.y }, { "x", "y" }))
		end
		if scenario.runner then
			A.push(bodies, scenario.runner.pos)
		end
		do
			local _arr92 = scenario.secondaryRunners
			local _i93 = 0
			while _i93 < Js.alen(_arr92) do
				_i93 += 1
				local r = _arr92[_i93]
				A.push(bodies, r.pos)
			end
		end
		local best = nil
		local bestAlong = math.huge
		do
			local _arr94 = bodies
			local _i95 = 0
			while _i95 < Js.alen(_arr94) do
				_i95 += 1
				local b = _arr94[_i95]
				local dx = (b.x - ball.pos.x)
				local dy = (b.y - ball.pos.y)
				local along = ((dx * ux) + (dy * uy))
				if ((along < 0.8) or (along > R.bodyLen)) then
					do continue end
				end
				local off = math.abs(((dx * uy) - (dy * ux)))
				if ((off <= R.bodyWidth) and (along < bestAlong)) then
					best = Js.O({ x = b.x, y = b.y }, { "x", "y" })
					bestAlong = along
				end
			end
		end
		do return best end
	end
	_T.deflectClearance = function(ball, rng, scenario)
		local DEG = (Math.PI / 180)
		local s0 = Math.hypot(ball.vel.x, ball.vel.y)
		local a0 = Math.atan2(ball.vel.y, ball.vel.x)
		local side = (if (rng() < 0.5) then -1 else 1)
		local a = ((a0 + Math.PI) + (((side * rng()) * 75) * DEG))
		local s = (s0 * (0.2 + (rng() * 0.2)))
		ball.vel = Js.O({ x = (Math.cos(a) * s), y = (Math.sin(a) * s) }, { "x", "y" })
		if (ball.vel.y < 0) then
			ball.vel.y = (-ball.vel.y)
		end
		ball.vz = (rng() * 2.4)
		ball.z = Math.min(ball.z, 1.2)
		ball.spin = 0
		ball.loose = true
		ball.shot = false
		ball.owner = "none"
		ball.lastTouch = "defence"
		ball.cleared = false
		ball.clearHitAt = nil
		ball.event = "clearHit"
		ball.contactCd = 0.22
		_T.markLanding(ball, scenario)
	end
	_T.headedForGoal = function(ball, scenario)
		if (not _T.goalInView(scenario.kind)) then
			do return false end
		end
		if (ball.vel.y >= -1) then
			do return false end
		end
		if (Math.hypot(ball.vel.x, ball.vel.y) < 8) then
			do return false end
		end
		local t = (ball.pos.y / (-ball.vel.y))
		local xAt = (ball.pos.x + (ball.vel.x * t))
		local zAt = ((ball.z + (ball.vz * t)) - (((0.5 * _T.G) * t) * t))
		do return (((xAt > (M_pitch.POST_L - 1.2)) and (xAt < (M_pitch.POST_R + 1.2))) and (zAt < (scenario.crossbar + 1))) end
	end
	_T.keeperSaveRadius = function(scenario)
		local smooth = (_T.KEEPER_SAVE_R_MIN + ((_T.clamp(scenario.keeperStrength, 0, 100) / 100) * (_T.KEEPER_SAVE_R_MAX - _T.KEEPER_SAVE_R_MIN)))
		local tier = _T.KEEPER_TIERS[_T.keeperTierFor(scenario.keeperStrength)].radius
		local base = ((smooth * 0.5) + (tier * 0.5))
		local wear = Math.max(0.45, (1 - (0.35 * scenario.keeper.saves)))
		local r = scenario.keeperReach
		local scale = (if (((type(r) == "number") and Js.NumberNS.isFinite(r)) and (r > 0)) then r else 1)
		do return ((base * wear) * scale) end
	end
	exports.keeperSaveRadius = _T.keeperSaveRadius
	_T.classifySave = function(xCross, zCross, keeperX, margin, outcome)
		local dx = math.abs((xCross - keeperX))
		local dz = (zCross - _T.KEEPER_CENTRE_Z)
		if (margin < 0.24) then
			do return (if (zCross > 1.6) then "high" else "fingertip") end
		end
		if (((outcome == "caught") and (dx < 1)) and (math.abs(dz) < 0.8)) then
			do return "catch" end
		end
		if (dx < 0.7) then
			do return (if (math.abs(dz) < 0.7) then "central" else (if (dz > 0) then "high" else "low")) end
		end
		if (zCross > 1.55) then
			do return "high" end
		end
		if (zCross < 0.6) then
			do return "low" end
		end
		do return (if (margin < 0.4) then "fingertip" else "low") end
	end
	_T.keeperAttempt = function(scenario, xCross, zCross, rng)
		local k = scenario.keeper
		local reach = _T.keeperSaveRadius(scenario)
		local dx = (xCross - k.x)
		local dz = ((zCross - _T.KEEPER_CENTRE_Z) * _T.KEEPER_SAVE_Z_SCALE)
		if (M_hitbox.hitboxesOn() and (zCross > _T.KEEPER_STAND_REACH)) then
			dz += (((zCross - _T.KEEPER_STAND_REACH) * _T.KEEPER_SAVE_Z_SCALE) * M_hitbox.hitboxDials().keeperJump)
		end
		local dist = Math.hypot(dx, dz)
		local margin = _T.clamp(((reach - dist) / reach), 0, 1)
		local band = (reach * _T.KEEPER_QUALITY_BAND)
		local p = (if (band > 0) then _T.clamp(((0.5 + _T.KEEPER_QUALITY_BIAS) + ((reach - dist) / band)), 0, 1) else (if (dist < reach) then 1 else 0))
		local reaches = (rng() < p)
		do return Js.O({ reaches = reaches, margin = margin, dist = dist, reach = reach }, { "reaches", "margin", "dist", "reach" }) end
	end
	exports.keeperAttempt = _T.keeperAttempt
	_T.resolveKeeper = function(ball, scenario, dist, reach, speed, rng)
		if scenario.keeperPro then
			do return _T.resolveKeeperPro(ball, scenario, dist, reach, speed, rng) end
		end
		local k = scenario.keeper
		k.saves += 1
		k.flash = 0.35
		local at = Js.O({ x = ball.pos.x, y = ball.pos.y, z = ball.z }, { "x", "y", "z" })
		local logSave = function(save)
			return _T.logBallAction(ball, Js.O({ kind = "save", actor = "keeper", save = save, at = at }, { "kind", "actor", "save", "at" }))
		end
		ball.lastTouch = "keeper"
		ball.deflected = "keeper"
		local marginNorm = _T.clamp(((reach - dist) / reach), 0, 1)
		local mistakeChance = (_T.KEEPER_MISTAKE_BASE + ((1 - marginNorm) * _T.KEEPER_MISTAKE_STRETCH_BONUS))
		if (rng() < mistakeChance) then
			logSave("fumble")
			do return nil end
		end
		local lowAndSlow = ((speed < 23) and (ball.z < 1.5))
		if (((marginNorm > 0.35) and lowAndSlow) and (rng() < 0.72)) then
			ball.pos = Js.O({ x = k.x, y = Math.max(k.y, 0.4) }, { "x", "y" })
			ball.z = 0.55
			ball.vel = Js.O({ x = 0, y = 0 }, { "x", "y" })
			ball.vz = 0
			ball.resting = true
			k.pendingDone = true
			logSave("catch")
			do return "caught" end
		end
		if (k.saves >= 3) then
			ball.pos = Js.O({ x = k.x, y = Math.max(k.y, 0.4) }, { "x", "y" })
			ball.z = 0.55
			ball.vel = Js.O({ x = 0, y = 0 }, { "x", "y" })
			ball.vz = 0
			ball.resting = true
			k.pendingDone = true
			logSave("catch")
			do return "caught" end
		end
		if (((marginNorm < 0.24) or (ball.z > 1.85)) or (speed > 26)) then
			if (rng() < 0.22) then
				k.pendingDone = true
				logSave("push")
				do return "saved" end
			end
			local side = (if (ball.pos.x < M_pitch.CX) then -1 else 1)
			local away = _T.normalize(Js.O({ x = (side * (0.7 + (rng() * 0.5))), y = 1 }, { "x", "y" }))
			local sp = (6 + (rng() * 6))
			ball.vel = Js.O({ x = (away.x * sp), y = (away.y * sp) }, { "x", "y" })
			ball.vz = (1.4 + (rng() * 2.2))
			ball.spin *= 0.2
			ball.resting = false
			_T.markLanding(ball, scenario)
			ball.loose = true
			ball.shot = false
			ball.contactCd = 0.28
			k.targetX = ball.pos.x
			k.scrambling = true
			logSave("push")
			do return nil end
		end
		if (rng() < 0.18) then
			ball.pos = Js.O({ x = k.x, y = Math.max(k.y, 0.4) }, { "x", "y" })
			ball.z = 0.55
			ball.vel = Js.O({ x = 0, y = 0 }, { "x", "y" })
			ball.vz = 0
			ball.resting = true
			k.pendingDone = true
			logSave("catch")
			do return "caught" end
		end
		local away = _T.normalize(Js.O({ x = (ball.pos.x - k.x), y = (ball.pos.y - k.y) }, { "x", "y" }))
		local dangerous = (rng() < 0.34)
		local fwd = (if dangerous then Js.O({ x = 0, y = 0.5 }, { "x", "y" }) else Js.O({ x = 0, y = 1 }, { "x", "y" }))
		local lat = ((rng() - 0.5) * (if dangerous then 0.6 else 1.4))
		local dir = _T.normalize(Js.O({ x = (((away.x * 0.6) + fwd.x) + lat), y = ((away.y * 0.6) + fwd.y) }, { "x", "y" }))
		local minY = (if dangerous then 0.05 else 0.25)
		if (dir.y < minY) then
			dir = _T.normalize(Js.O({ x = dir.x, y = minY }, { "x", "y" }))
		end
		local newSpeed = (speed * (if dangerous then (0.22 + (rng() * 0.12)) else (0.4 + (rng() * 0.2))))
		ball.vel = Js.O({ x = (dir.x * newSpeed), y = (dir.y * newSpeed) }, { "x", "y" })
		ball.vz = (0.6 + (rng() * 1.6))
		_T.markLanding(ball, scenario)
		ball.spin *= 0.4
		ball.loose = true
		ball.shot = false
		ball.contactCd = 0.28
		k.targetX = ball.pos.x
		k.scrambling = true
		logSave("parry")
		do return nil end
	end
	_T.proSaveBodyX = function(kx, targetX, xAt, hand)
		if hand == nil then hand = _T.KEEPER_PRO_HAND end
		if (math.abs((targetX - xAt)) <= hand) then
			do return targetX end
		end
		local side = (function() local _l = (function() local _l = Math.sign((xAt - kx)); if Js.T(_l) then return _l end; return Math.sign((xAt - targetX)) end)(); if Js.T(_l) then return _l end; return 1 end)()
		do return (xAt - (side * Math.min(hand, math.abs((xAt - kx))))) end
	end
	exports.proSaveBodyX = _T.proSaveBodyX
	_T.proShare = function(ks)
		do return _T.clamp((((if Js.NumberNS.isFinite(ks) then ks else 62) - 40) / 55), 0, 1) end
	end
	_T.resolveKeeperPro = function(ball, scenario, dist, reach, speed, rng)
		local P = _T.KEEPER_PRO
		local k = scenario.keeper
		local g = _T.proShare(scenario.keeperStrength)
		local marginNorm = _T.clamp(((reach - dist) / reach), 0, 1)
		local at = Js.O({ x = ball.pos.x, y = ball.pos.y, z = ball.z }, { "x", "y", "z" })
		if (((((ball.z < P.nutmegZ) and (math.abs((ball.pos.x - k.x)) < P.nutmegR)) and (math.abs(k.dive) > 0.5)) and (k.saves == 0)) and (rng() < (P.nutmeg[1] + ((P.nutmeg[2] - P.nutmeg[1]) * g)))) then
			_T.logBallAction(ball, Js.O({ kind = "save", actor = "keeper", save = "beaten", at = at }, { "kind", "actor", "save", "at" }))
			do return nil end
		end
		k.saves += 1
		k.flash = 0.35
		local logSave = function(save)
			return _T.logBallAction(ball, Js.O({ kind = "save", actor = "keeper", save = save, at = at }, { "kind", "actor", "save", "at" }))
		end
		ball.lastTouch = "keeper"
		ball.deflected = "keeper"
		local hold = function()
			ball.pos = Js.O({ x = k.x, y = Math.max(k.y, 0.4) }, { "x", "y" })
			ball.z = 0.55
			ball.vel = Js.O({ x = 0, y = 0 }, { "x", "y" })
			ball.vz = 0
			ball.resting = true
			k.pendingDone = true
			logSave("catch")
			do return "caught" end
		end
		if (rng() < ((P.errBase + ((1 - marginNorm) * P.errStretch)) * (1.6 - g))) then
			logSave("fumble")
			do return nil end
		end
		if (k.saves >= 3) then
			do return hold() end
		end
		local z = ball.z
		local pace = _T.clamp(((P.holdPace[2] - speed) / (P.holdPace[2] - P.holdPace[1])), P.holdPaceFloor, 1)
		local height = (if (z < P.holdBand[1]) then P.holdGround else (if (z <= P.holdBand[2]) then 1 else (if (z <= 2) then P.holdHigh else P.holdOverhead)))
		local body = _T.clamp(((P.holdBody[2] - math.abs((ball.pos.x - k.x))) / (P.holdBody[2] - P.holdBody[1])), 0, 1)
		local hr = (if scenario.keeperFeel then _T.KEEPER_FEEL.holdRating else P.holdRating)
		local rate = (hr[1] + ((hr[2] - hr[1]) * g))
		local pHold = Math.min(P.holdMax, (((pace * height) * (0.1 + (0.9 * body))) * rate))
		if (rng() < pHold) then
			do return hold() end
		end
		local pOut = Math.min(P.outMax, ((P.outBase + (if (z > 1.6) then P.outHigh else 0)) + (if (marginNorm < 0.25) then P.outStretch else 0)))
		if (rng() < pOut) then
			k.pendingDone = true
			logSave("push")
			do return "saved" end
		end
		local dg = (if scenario.keeperFeel then _T.KEEPER_FEEL.danger else P.danger)
		local dangerous = (rng() < (dg[1] + ((dg[2] - dg[1]) * g)))
		local side = (function() local _l = (function() local _l = Math.sign(ball.vel.x); if Js.T(_l) then return _l end; return Math.sign((ball.pos.x - k.x)) end)(); if Js.T(_l) then return _l end; return (if (rng() < 0.5) then -1 else 1) end)()
		local dir = nil
		local sp = nil
		if dangerous then
			dir = _T.normalize(Js.O({ x = ((rng() - 0.5) * 0.7), y = 1 }, { "x", "y" }))
			sp = (speed * (0.14 + (rng() * 0.14)))
		else
			dir = _T.normalize(Js.O({ x = (side * (1 + (rng() * 0.8))), y = (0.3 + (rng() * 0.5)) }, { "x", "y" }))
			sp = (speed * (0.35 + (rng() * 0.25)))
		end
		ball.vel = Js.O({ x = (dir.x * sp), y = (dir.y * sp) }, { "x", "y" })
		ball.vz = (0.6 + (rng() * 1.6))
		_T.markLanding(ball, scenario)
		ball.spin *= 0.3
		ball.resting = false
		ball.loose = true
		ball.shot = false
		ball.contactCd = 0.28
		k.targetX = ball.pos.x
		k.scrambling = true
		logSave("parry")
		do return nil end
	end
	_T.keeperClaimTouch = function(ball, scenario)
		local k = scenario.keeper
		local c = k.claim
		if ((((not c) or k.done) or ball.shot) or (ball.contactCd > 0)) then
			do return nil end
		end
		if ((ball.lastTouch ~= "attack") and (ball.lastTouch ~= nil)) then
			do return nil end
		end
		if (ball.z > c.top) then
			do return nil end
		end
		if (Math.hypot((ball.pos.x - k.x), (ball.pos.y - k.y)) > c.reach) then
			do return nil end
		end
		local at = Js.O({ x = ball.pos.x, y = ball.pos.y, z = ball.z }, { "x", "y", "z" })
		if (c.act == "miss") then
			k.claim = nil
			_T.logBallAction(ball, Js.O({ kind = "save", actor = "keeper", save = "beaten", at = at }, { "kind", "actor", "save", "at" }))
			do return nil end
		end
		k.claim = nil
		k.saves += 1
		k.flash = 0.35
		ball.lastTouch = "keeper"
		ball.deflected = "keeper"
		if (c.act == "catch") then
			ball.pos = Js.O({ x = k.x, y = Math.max(k.y, 0.4) }, { "x", "y" })
			ball.z = 1.2
			ball.vel = Js.O({ x = 0, y = 0 }, { "x", "y" })
			ball.vz = 0
			ball.resting = true
			k.done = true
			k.saveKind = "catch"
			_T.logBallAction(ball, Js.O({ kind = "save", actor = "keeper", save = "catch", at = at }, { "kind", "actor", "save", "at" }))
			do return "caught" end
		end
		local dir = _T.normalize(Js.O({ x = c.dir, y = 1 }, { "x", "y" }))
		local sp = (12 + (6 * c.pace))
		ball.vel = Js.O({ x = (dir.x * sp), y = (dir.y * sp) }, { "x", "y" })
		ball.vz = (3.5 + (2.5 * c.pace))
		ball.spin = 0
		ball.resting = false
		ball.loose = true
		ball.owner = "none"
		ball.contactCd = 0.3
		_T.markLanding(ball, scenario)
		k.saveKind = "high"
		_T.logBallAction(ball, Js.O({ kind = "save", actor = "keeper", save = "push", at = at }, { "kind", "actor", "save", "at" }))
		do return nil end
	end
	_T.reboundOffFrame = function(ball, xCross, rng, scenario)
		if ((if ball.postHits ~= nil then ball.postHits else 0) >= 1) then
			do return false end
		end
		ball.postHits = ((if ball.postHits ~= nil then ball.postHits else 0) + 1)
		local post = (if (math.abs((xCross - M_pitch.POST_L)) < math.abs((xCross - M_pitch.POST_R))) then M_pitch.POST_L else M_pitch.POST_R)
		local side = (function() local _l = Math.sign((xCross - post)); if Js.T(_l) then return _l end; return (if (rng() < 0.5) then -1 else 1) end)()
		ball.pos.y = 0.35
		ball.pos.x = (post + (side * 0.35))
		ball.vel.y = (math.abs(ball.vel.y) * _T.POST_KEEP)
		ball.vel.x = ((ball.vel.x * _T.POST_KEEP) + (side * (1.5 + (rng() * 3.5))))
		ball.vz = Math.max((ball.vz * 0.4), 0.4)
		ball.spin *= 0.25
		ball.loose = true
		ball.owner = "none"
		ball.shot = false
		ball.contactCd = 0.25
		ball.lastTouch = "frame"
		ball.deflected = "frame"
		ball.event = "post"
		if scenario then
			_T.markLanding(ball, scenario)
		end
		do return true end
	end
	_T.settleBall = function(ball, dt, scenario)
		if ((not ball.settling) or ball.resting) then
			do return end
		end
		local cond = (function() local _v = scenario; if _v == nil then return nil end; _v = _v.conditions; return _v end)()
		if M_ballPhysics.realBallOn() then
			local n = Math.max(1, math.ceil(((dt * 180) - 1e-9)))
			do
				local i = 0
				local _first96 = true
				while true do
					if not _first96 then
						i += 1
					end
					_first96 = false
					if not ((i < n) and (not ball.resting)) then break end
					M_ballPhysics.coastBallReal(ball, cond, (dt / n))
				end
			end
		else
			ball.vz -= (_T.G * dt)
			ball.z += (ball.vz * dt)
			ball.pos.x += (ball.vel.x * dt)
			ball.pos.y += (ball.vel.y * dt)
			if (ball.z <= 0) then
				ball.z = 0
				if (ball.vz < (-_T.MIN_BOUNCE_VZ)) then
					ball.vz = (((-ball.vz) * _T.BOUNCE_VZ) * ((function() local _v = cond; if _v == nil then return nil end; _v = _v.bounce; return _v end)() or 1))
					local keep = (if Js.T((function() local _v = cond; if _v == nil then return nil end; _v = _v.skid; return _v end)()) then M_pitchWeather.skidKeep(_T.BOUNCE_H, cond) else _T.BOUNCE_H)
					ball.vel.x *= keep
					ball.vel.y *= keep
				else
					ball.vz = 0
				end
			end
			if ((ball.z <= 0.03) and (ball.vz <= 0.01)) then
				local s = Math.hypot(ball.vel.x, ball.vel.y)
				local drop = ((_T.GROUND_FRICTION * ((function() local _v = cond; if _v == nil then return nil end; _v = _v.friction; return _v end)() or 1)) * dt)
				if Js.T((function() local _v = cond; if _v == nil then return nil end; _v = _v.deadBelow; return _v end)()) then
					drop = M_pitchWeather.grabDrop(drop, s, cond, dt)
				end
				if (s <= drop) then
					ball.vel.x = 0
					ball.vel.y = 0
					ball.resting = true
				else
					local f = ((s - drop) / s)
					ball.vel.x *= f
					ball.vel.y *= f
				end
			end
		end
		local vp = (function() local _v = scenario; if _v == nil then return nil end; _v = _v.viewport; return _v end)()
		if vp then
			local m = 0.6
			if (ball.pos.x < (vp.x1 + m)) then
				ball.pos.x = (vp.x1 + m)
				ball.vel.x = 0
				ball.vel.y *= 0.4
			elseif (ball.pos.x > (vp.x2 - m)) then
				ball.pos.x = (vp.x2 - m)
				ball.vel.x = 0
				ball.vel.y *= 0.4
			end
			if (ball.pos.y > (vp.y2 - m)) then
				ball.pos.y = (vp.y2 - m)
				ball.vel.y = 0
				ball.vel.x *= 0.4
			elseif (ball.pos.y < (vp.y1 + m)) then
				ball.pos.y = (vp.y1 + m)
				ball.vel.y = 0
				ball.vel.x *= 0.4
			end
		end
	end
	exports.settleBall = _T.settleBall
	_T.stepBall = function(ball, scenario, rng, dt)
		local touchedLast = ball.lastTouch
		local res = _T.stepBallRaw(ball, scenario, rng, dt)
		if (res == nil) then
			do return nil end
		end
		if ((res == "goal") and Js.T(ball.deflected)) then
			do return "rebound" end
		end
		if ((((res == "short") or (res == "out")) or (res == "tackled")) or (res == "wide")) then
			if (touchedLast == "keeper") then
				do return "saved" end
			end
			if (touchedLast == "frame") then
				do return "post" end
			end
		end
		do return res end
	end
	exports.stepBall = _T.stepBall
	_T.integrateBallOld = function(ball, cond, dt)
		local speed0 = Math.hypot(ball.vel.x, ball.vel.y)
		if ((speed0 > 0.01) and (math.abs(ball.spin) > 0.0001)) then
			local ax = ((ball.spin * _T.CURL_K) * ball.vel.y)
			local ay = ((ball.spin * _T.CURL_K) * (-ball.vel.x))
			ball.vel.x += (ax * dt)
			ball.vel.y += (ay * dt)
		end
		if (ball.z > 0.02) then
			local k = Math.max(0, (1 - ((_T.AIR_DRAG * ((function() local _v = cond; if _v == nil then return nil end; _v = _v.drag; return _v end)() or 1)) * dt)))
			ball.vel.x *= k
			ball.vel.y *= k
			if Js.T((function() local _v = cond; if _v == nil then return nil end; _v = _v.wind; return _v end)()) then
				ball.vel.x += (cond.wind * dt)
			end
			if (function() local _v = cond; if _v == nil then return nil end; _v = _v.windV; return _v end)() then
				M_pitchWeather.applyWind(ball, cond, dt, false)
			end
		end
		ball.vz -= (_T.G * dt)
		ball.z += (ball.vz * dt)
		ball.pos.x += (ball.vel.x * dt)
		ball.pos.y += (ball.vel.y * dt)
		local bouncedThisStep = false
		if (ball.z <= 0) then
			ball.z = 0
			if (ball.vz < (-_T.MIN_BOUNCE_VZ)) then
				local top = _T.clamp((if ball.topspin ~= nil then ball.topspin else 0), -1, 1)
				ball.vz = ((((-ball.vz) * _T.BOUNCE_VZ) * ((function() local _v = cond; if _v == nil then return nil end; _v = _v.bounce; return _v end)() or 1)) * (1 - (top * _T.BOUNCE_TOPSPIN_VZ)))
				local keep = (_T.BOUNCE_H * (1 + (top * _T.BOUNCE_TOPSPIN_H)))
				if Js.T((function() local _v = cond; if _v == nil then return nil end; _v = _v.skid; return _v end)()) then
					keep = M_pitchWeather.skidKeep(keep, cond)
				end
				ball.vel.x *= keep
				ball.vel.y *= keep
				if (math.abs(ball.spin) > 0.0001) then
					local sp = Math.hypot(ball.vel.x, ball.vel.y)
					if (sp > 0.01) then
						local a = (ball.spin * _T.BOUNCE_SIDESPIN_TURN)
						local cos = Math.cos(a)
						local sin = Math.sin(a)
						local vx = ball.vel.x
						local vy = ball.vel.y
						ball.vel.x = ((vx * cos) - (vy * sin))
						ball.vel.y = ((vx * sin) + (vy * cos))
					end
				end
				ball.spin *= _T.BOUNCE_SPIN_KEEP
				bouncedThisStep = true
			else
				ball.vz = 0
			end
		end
		if (((ball.z <= 0.03) and (not bouncedThisStep)) and (ball.vz <= 0.01)) then
			local s = Math.hypot(ball.vel.x, ball.vel.y)
			local drop = ((_T.GROUND_FRICTION * ((function() local _v = cond; if _v == nil then return nil end; _v = _v.friction; return _v end)() or 1)) * dt)
			if Js.T((function() local _v = cond; if _v == nil then return nil end; _v = _v.deadBelow; return _v end)()) then
				drop = M_pitchWeather.grabDrop(drop, s, cond, dt)
			end
			if (s <= drop) then
				ball.vel.x = 0
				ball.vel.y = 0
				ball.resting = true
			else
				local f = ((s - drop) / s)
				ball.vel.x *= f
				ball.vel.y *= f
			end
		end
		do return bouncedThisStep end
	end
	exports.integrateBallOld = _T.integrateBallOld
	_T.meantForOtherMate = function(ball, p, mates)
		if (ball.z < _T.MEANT_MIN_Z) then
			do return false end
		end
		local drop = _T.dropPoint(ball)
		if (not drop) then
			do return false end
		end
		local mine = Math.hypot((p.x - drop.x), (p.y - drop.y))
		do return A.some(mates, function(m)
			return ((m.pos ~= p) and ((Math.hypot((m.pos.x - drop.x), (m.pos.y - drop.y)) + 1.5) < mine))
		end) end
	end
	_T.dropPoint = function(ball)
		local a = (0.5 * _T.G)
		local b = (-ball.vz)
		local c = (_T.DROP_Z - ball.z)
		local disc = ((b * b) - ((4 * a) * c))
		if (disc < 0) then
			do return nil end
		end
		local t = Math.max(0, (((-b) + Math.sqrt(disc)) / (2 * a)))
		do return Js.O({ x = (ball.pos.x + (ball.vel.x * t)), y = (ball.pos.y + (ball.vel.y * t)) }, { "x", "y" }) end
	end
	_T.stepHitboxJumps = function(scenario, ball, dt, bodyOnly)
		local hb = M_hitbox.hitboxDials()
		local live = (((not ball.resting) and (not ball.inNet)) and (ball.z > 0.5))
		do
			local _arr97 = scenario.defenders
			local _i98 = 0
			while _i98 < Js.alen(_arr97) do
				_i98 += 1
				local d = _arr97[_i98]
				if ((d.baseRole == "hold") and (scenario.kind == "free_kick")) then
					do continue end
				end
				M_hitbox.stepJump(d, dt)
				if ((((not live) or bodyOnly) or ((if d.z ~= nil then d.z else 0) > 0)) or ((if d.vz ~= nil then d.vz else 0) > 0)) then
					do continue end
				end
				local lowR = (_T.DEF_BLOCK_R * _T.defenderReachMultiplier(((function() local _v = d.who; if _v == nil then return nil end; _v = _v.defending; return _v end)() or (function() local _v = d.who; if _v == nil then return nil end; _v = _v.overall; return _v end)())))
				local quick = _T.clamp(((Math.hypot(ball.vel.x, ball.vel.y) - _T.SLOW_BALL_FULL) / (_T.SLOW_BALL_SHAPED - _T.SLOW_BALL_FULL)), 0, 1)
				local reach = ((((lowR * hb.reachLow) * (1 - quick)) + (M_hitbox.bodyReach(lowR, hb.standHeight, 0) * quick)) + (hb.headerBonus * _T.DEF_HEADER_SHARE))
				local t = Math.max(0, (Math.hypot((d.x - ball.pos.x), (d.y - ball.pos.y)) / Math.max(1, Math.hypot(ball.vel.x, ball.vel.y))))
				if ((ball.vz - (_T.G * t)) >= 0) then
					do continue end
				end
				if M_hitbox.wantsJump(ball, d, reach, (hb.headerBonus * _T.DEF_HEADER_SHARE)) then
					M_hitbox.startJump(d)
				end
			end
		end
		local mates = Js.alit()
		do
			local _arr99 = Js.aspread((if scenario.runner then Js.alit(scenario.runner) else Js.alit()), scenario.secondaryRunners)
			local _i100 = 0
			while _i100 < Js.alen(_arr99) do
				_i100 += 1
				local r = _arr99[_i100]
				if r.jump == nil then r.jump = Js.O({}, nil) end
				A.push(mates, Js.O({ pos = r.pos, j = r.jump }, { "pos", "j" }))
			end
		end
		if (_T.goalInView(scenario.kind) and (not scenario.follower.shot)) then
			if scenario.follower.jump == nil then scenario.follower.jump = Js.O({}, nil) end
			A.push(mates, Js.O({ pos = Js.O({ x = scenario.follower.x, y = scenario.follower.y }, { "x", "y" }), j = scenario.follower.jump }, { "pos", "j" }))
		end
		do
			local _arr101 = mates
			local _i102 = 0
			while _i102 < Js.alen(_arr101) do
				_i102 += 1
				local m = _arr101[_i102]
				M_hitbox.stepJump(m.j, dt)
				if (((((not live) or bodyOnly) or scenario.receiverDone) or ((if m.j.z ~= nil then m.j.z else 0) > 0)) or ((if m.j.vz ~= nil then m.j.vz else 0) > 0)) then
					do continue end
				end
				if _T.meantForOtherMate(ball, m.pos, mates) then
					do continue end
				end
				if M_hitbox.wantsJump(ball, m.pos, _T.PASS_CONTROL_R, hb.headerBonus) then
					M_hitbox.startJump(m.j)
				end
			end
		end
	end
	_T.hitboxShapes = function(scenario)
		local out = Js.alit()
		local on = M_hitbox.hitboxesOn()
		local hb = M_hitbox.hitboxDials()
		local prof = function(lowR, foot)
			local zs = Js.alit(0, 0.5, 0.9, 1.3, 1.6, hb.standHeight, ((hb.standHeight + M_pitch.BALL_R) - 0.005))
			do return A.map(zs, function(z)
				return Js.O({ z = (foot + z), r = M_hitbox.bodyReach(lowR, (foot + z), foot) }, { "z", "r" })
			end) end
		end
		do
			local _arr103 = scenario.defenders
			local _i104 = 0
			while _i104 < Js.alen(_arr103) do
				_i104 += 1
				local d = _arr103[_i104]
				local foot = (if d.z ~= nil then d.z else 0)
				local lowR = (_T.DEF_BLOCK_R * _T.defenderReachMultiplier(((function() local _v = d.who; if _v == nil then return nil end; _v = _v.defending; return _v end)() or (function() local _v = d.who; if _v == nil then return nil end; _v = _v.overall; return _v end)())))
				local wall = ((d.baseRole == "hold") and (scenario.kind == "free_kick"))
				local top = (if wall then Math.min((foot + _T.DEF_BLOCK_H), _T.WALL_TOP) else (foot + _T.DEF_BLOCK_H))
				A.push(out, Js.O({ x = d.x, y = d.y, side = "def", foot = foot, rings = (if (on and (not wall)) then prof(lowR, foot) else Js.alit(Js.O({ z = foot, r = lowR }, { "z", "r" }), Js.O({ z = top, r = lowR }, { "z", "r" }))) }, { "x", "y", "side", "foot", "rings" }))
			end
		end
		local mates = A.map(Js.aspread((if scenario.runner then Js.alit(scenario.runner) else Js.alit()), scenario.secondaryRunners), function(r)
			return Js.O({ x = r.pos.x, y = r.pos.y, foot = ((function() local _v = r.jump; if _v == nil then return nil end; _v = _v.z; return _v end)() or 0) }, { "x", "y", "foot" })
		end)
		if (_T.goalInView(scenario.kind) and (not scenario.follower.shot)) then
			A.push(mates, Js.O({ x = scenario.follower.x, y = scenario.follower.y, foot = ((function() local _v = scenario.follower.jump; if _v == nil then return nil end; _v = _v.z; return _v end)() or 0) }, { "x", "y", "foot" }))
		end
		do
			local _arr105 = mates
			local _i106 = 0
			while _i106 < Js.alen(_arr105) do
				_i106 += 1
				local m = _arr105[_i106]
				A.push(out, Js.O({ x = m.x, y = m.y, side = "mate", foot = m.foot, rings = (if on then prof(_T.BODY_R, m.foot) else Js.alit(Js.O({ z = 0, r = _T.BODY_R }, { "z", "r" }), Js.O({ z = 2.6, r = _T.BODY_R }, { "z", "r" }))), control = Js.O({ r = _T.PASS_CONTROL_R, top = (if on then (M_hitbox.headTop(m.foot) + hb.headerBonus) else 2.6) }, { "r", "top" }) }, { "x", "y", "side", "foot", "rings", "control" }))
			end
		end
		local k = scenario.keeper
		if _T.goalInView(scenario.kind) then
			A.push(out, Js.O({ x = k.x, y = k.y, side = "keeper", foot = 0, rings = Js.alit(Js.O({ z = 0, r = _T.KEEPER_BODY_R }, { "z", "r" }), Js.O({ z = _T.KEEPER_VREACH, r = _T.KEEPER_BODY_R }, { "z", "r" })) }, { "x", "y", "side", "foot", "rings" }))
		end
		do return out end
	end
	exports.hitboxShapes = _T.hitboxShapes
	_T.settleJumps = function(scenario, dt)
		do
			local _arr107 = scenario.defenders
			local _i108 = 0
			while _i108 < Js.alen(_arr107) do
				_i108 += 1
				local d = _arr107[_i108]
				if (not ((d.baseRole == "hold") and (scenario.kind == "free_kick"))) then
					M_hitbox.stepJump(d, dt)
				end
			end
		end
		do
			local _arr109 = Js.aspread((if scenario.runner then Js.alit(scenario.runner) else Js.alit()), scenario.secondaryRunners)
			local _i110 = 0
			while _i110 < Js.alen(_arr109) do
				_i110 += 1
				local r = _arr109[_i110]
				if r.jump then
					M_hitbox.stepJump(r.jump, dt)
				end
			end
		end
		if scenario.follower.jump then
			M_hitbox.stepJump(scenario.follower.jump, dt)
		end
	end
	exports.settleJumps = _T.settleJumps
	_T.realLaneCross = function(ball, scenario)
		local b = Js.ospread(ball, Js.O({ pos = Js.ospread(ball.pos), vel = Js.ospread(ball.vel) }, { "pos", "vel" }))
		local real = M_ballPhysics.realBallOn()
		local h = (1 / 180)
		for i = 0, (180 * 5) - 1 do
			local px = b.pos.x
			local py = b.pos.y
			local pz = b.z
			if real then
				M_ballPhysics.integrateBallReal(b, scenario.conditions, h)
			else
				_T.integrateBallOld(b, scenario.conditions, h)
			end
			if ((py > 0) and (b.pos.y <= 0)) then
				local f = (py / (function() local _l = (py - b.pos.y); if Js.T(_l) then return _l end; return 1 end)())
				do return Js.O({ x = (px + ((b.pos.x - px) * f)), z = (pz + ((b.z - pz) * f)) }, { "x", "z" }) end
			end
			if (b.resting or (b.vel.y > 0.5)) then
				do return nil end
			end
		end
		do return nil end
	end
	exports.realLaneCross = _T.realLaneCross
	_T.inRealLane = function(ball, scenario)
		local lane = scenario.realLane
		if ((((not lane) or (ball.lastTouch ~= "attack")) or ball.loose) or (ball.receiverControlT > 0)) then
			do return false end
		end
		local c = _T.realLaneCross(ball, scenario)
		if (not c) then
			do return false end
		end
		local room = (M_pitch.BALL_R + 0.06)
		if (((c.x < (scenario.goal.x1 + room)) or (c.x > (scenario.goal.x2 - room))) or (c.z > (scenario.crossbar - room))) then
			do return false end
		end
		if (lane.r ~= nil) then
			do return (Math.hypot((c.x - lane.x), ((c.z - lane.z) * (if lane.hw ~= nil then lane.hw else 1))) <= lane.r) end
		end
		do return ((math.abs((c.x - lane.x)) <= lane.tolX) and (math.abs((c.z - lane.z)) <= lane.tolZ)) end
	end
	exports.inRealLane = _T.inRealLane
	_T.stepBallRaw = function(ball, scenario, rng, dt)
		ball.clock = ((if ball.clock ~= nil then ball.clock else 0) + dt)
		if (scenario.realLane and (ball.realLane == nil)) then
			ball.realLane = _T.inRealLane(ball, scenario)
			if ball.realLane then
				ball.shot = true
				ball.youStruckAtGoal = true
			end
		end
		if scenario.offsideAgainst then
			do return "offside" end
		end
		if (ball.receiverControlT > 0) then
			if (Js.T(ball.carryT) and _T.stepMateCarry(ball, scenario, dt)) then
				do return nil end
			end
			ball.receiverControlT = Math.max(0, (ball.receiverControlT - dt))
			if (ball.receiverControlT <= 0) then
				local relay = _T.relayTargetFor(scenario)
				if (not _T.playRelay(ball, scenario, relay, ((not relay) and _T.relayFollowerTargetFor(scenario)), rng)) then
					_T.launchReceiverShot(ball, scenario, rng)
				end
			else
				local relay = _T.relayTargetFor(scenario)
				if (relay and _T.relayShouldGoNow(scenario, relay, ball.pos, _T.passerQuality(scenario))) then
					ball.receiverControlT = 0
					_T.playRelay(ball, scenario, relay, false, rng)
				end
			end
			do return nil end
		end
		if ball.resting then
			ball.restT = ((if ball.restT ~= nil then ball.restT else 0) + dt)
		end
		local prevY = ball.pos.y
		local prevX = ball.pos.x
		local prevZ = ball.z
		if (ball.contactCd > 0) then
			ball.contactCd = Math.max(0, (ball.contactCd - dt))
		end
		local bouncedThisStep = (if M_ballPhysics.realBallOn() then M_ballPhysics.integrateBallReal(ball, scenario.conditions, dt) else _T.integrateBallOld(ball, scenario.conditions, dt))
		local speed = Math.hypot(ball.vel.x, ball.vel.y)
		if ball.clearHitAt then
			local h = ball.clearHitAt
			local dx = (h.x - ball.pos.x)
			local dy = (h.y - ball.pos.y)
			if ((Math.hypot(dx, dy) < 0.6) or (((dx * ball.vel.x) + (dy * ball.vel.y)) <= 0)) then
				ball.pos = Js.O({ x = h.x, y = h.y }, { "x", "y" })
				_T.deflectClearance(ball, rng, scenario)
			end
			do return nil end
		end
		if M_hitbox.hitboxesOn() then
			_T.stepHitboxJumps(scenario, ball, dt, ((ball.shot == true) or _T.headedForGoal(ball, scenario)))
		end
		if ((ball.contactCd <= 0) and (not _T.laneOpen(ball))) then
			local bodyOnly = ((ball.shot == true) or _T.headedForGoal(ball, scenario))
			local shaped = M_hitbox.hitboxesOn()
			do
				local _arr111 = scenario.defenders
				local _i112 = 0
				while _i112 < Js.alen(_arr111) do
					_i112 += 1
					local d = _arr111[_i112]
					local foot = (if d.z ~= nil then d.z else 0)
					local reach = nil
					if (shaped and (not ((d.baseRole == "hold") and (scenario.kind == "free_kick")))) then
						local hb = M_hitbox.hitboxDials()
						local lowR = ((if bodyOnly then (if (speed > 12) then _T.BODY_BLOCK_R else _T.BODY_BLOCK_SLOW_R) else (if (speed > 12) then _T.DEF_BLOCK_R else _T.CONTROL_R)) * _T.defenderReachMultiplier(((function() local _v = d.who; if _v == nil then return nil end; _v = _v.defending; return _v end)() or (function() local _v = d.who; if _v == nil then return nil end; _v = _v.overall; return _v end)())))
						local aerial = (((not bodyOnly) and (ball.z > (hb.standHeight * 0.7))) and (ball.vz < 0))
						local extraUp = (if aerial then (hb.headerBonus * _T.DEF_HEADER_SHARE) else 0)
						if ((ball.z < (foot - M_pitch.BALL_R)) or (ball.z > (M_hitbox.headTop(foot) + extraUp))) then
							do continue end
						end
						local shapedR = M_hitbox.bodyReach(lowR, Math.min(ball.z, (M_hitbox.headTop(foot) - 0.01)), foot)
						local quick = _T.clamp(((speed - _T.SLOW_BALL_FULL) / (_T.SLOW_BALL_SHAPED - _T.SLOW_BALL_FULL)), 0, 1)
						reach = ((if bodyOnly then shapedR else (((lowR * hb.reachLow) * (1 - quick)) + (shapedR * quick))) + (if bodyOnly then (hb.blockBonus * _T.clamp(((hb.standHeight - (ball.z - foot)) / (hb.standHeight * 0.3)), 0, 1)) else extraUp))
					else
						local top = (if (d.baseRole == "hold") then Math.min((foot + _T.DEF_BLOCK_H), _T.WALL_TOP) else (foot + _T.DEF_BLOCK_H))
						if ((ball.z < foot) or (ball.z > top)) then
							do continue end
						end
						reach = ((if bodyOnly then (if (speed > 12) then _T.BODY_BLOCK_R else _T.BODY_BLOCK_SLOW_R) else (if (speed > 12) then _T.DEF_BLOCK_R else _T.CONTROL_R)) * _T.defenderReachMultiplier(((function() local _v = d.who; if _v == nil then return nil end; _v = _v.defending; return _v end)() or (function() local _v = d.who; if _v == nil then return nil end; _v = _v.overall; return _v end)())))
					end
					if (Math.hypot((d.x - ball.pos.x), (d.y - ball.pos.y)) < reach) then
						local wasGoingIn = _T.headedForGoal(ball, scenario)
						local act = Js.O({ kind = (if wasGoingIn then "block" else "clearance"), actor = ("def" .. Js.numstr(A.indexOf(scenario.defenders, d))), mode = (if (ball.z > 1.4) then "header" else "ground") }, { "kind", "actor", "mode" })
						local R = _T.clearanceRules
						local live = (R.miscues and ((if scenario.secondBalls ~= nil then scenario.secondBalls else 0) < R.secondBalls))
						if (live and (rng() < _T.miscueChance(((function() local _v = d.who; if _v == nil then return nil end; _v = _v.defending; return _v end)() or (function() local _v = d.who; if _v == nil then return nil end; _v = _v.overall; return _v end)())))) then
							_T.miscueBall(ball, rng, scenario, act)
							scenario.secondBalls = ((if scenario.secondBalls ~= nil then scenario.secondBalls else 0) + 1)
							ball.contactCd = 0.35
							do return nil end
						end
						_T.clearBall(ball, rng, scenario, act)
						ball.contactCd = 0.4
						if live then
							local hit = _T.clearanceBodyHit(ball, scenario, d)
							if hit then
								ball.clearHitAt = hit
								scenario.secondBalls = ((if scenario.secondBalls ~= nil then scenario.secondBalls else 0) + 1)
								do return nil end
							end
						end
						do return (if wasGoingIn then "blocked" else "tackled") end
					end
				end
			end
		end
		if (((((ball.loose and (not ball.inNet)) and (ball.contactCd <= 0)) and (ball.z < 2.3)) and (speed < _T.LOOSE_CONTEST_SPEED)) and (ball.pos.y > 0.2)) then
			local dDef = math.huge
			do
				local _arr113 = scenario.defenders
				local _i114 = 0
				while _i114 < Js.alen(_arr113) do
					_i114 += 1
					local d = _arr113[_i114]
					dDef = Math.min(dDef, Math.hypot((d.x - ball.pos.x), (d.y - ball.pos.y)))
				end
			end
			if (dDef < _T.LOOSE_WIN_R) then
				local dAtk = Math.hypot((scenario.player.x - ball.pos.x), (scenario.player.y - ball.pos.y))
				if (scenario.follower.active and (not scenario.follower.shot)) then
					dAtk = Math.min(dAtk, Math.hypot((scenario.follower.x - ball.pos.x), (scenario.follower.y - ball.pos.y)))
				end
				do
					local _arr115 = Js.aspread((if scenario.runner then Js.alit(scenario.runner) else Js.alit()), scenario.secondaryRunners)
					local _i116 = 0
					while _i116 < Js.alen(_arr115) do
						_i116 += 1
						local r = _arr115[_i116]
						dAtk = Math.min(dAtk, Math.hypot((r.pos.x - ball.pos.x), (r.pos.y - ball.pos.y)))
					end
				end
				if (dDef < dAtk) then
					ball.owner = "opponent"
					ball.lastTouch = "defence"
					local by = _T.nearestDefenderActor(scenario, ball.pos)
					if _T.clearanceRules.miscues then
						_T.clearBall(ball, rng, scenario, (if Js.T(by) then Js.O({ kind = "clearance", actor = by, mode = (if (ball.z > 1.4) then "header" else "ground") }, { "kind", "actor", "mode" }) else nil))
						ball.contactCd = 0.4
						do return "short" end
					end
					if Js.T(by) then
						_T.logBallAction(ball, Js.O({ kind = "clearance", actor = by, mode = (if (ball.z > 1.4) then "header" else "ground"), at = Js.O({ x = ball.pos.x, y = ball.pos.y, z = ball.z }, { "x", "y", "z" }) }, { "kind", "actor", "mode", "at" }))
					end
					ball.settling = true
					do return "short" end
				end
			end
		end
		local k = scenario.keeper
		if (((((not k.done) and (ball.contactCd <= 0)) and (ball.z < _T.KEEPER_VREACH)) and (ball.pos.y > 0.1)) and (not _T.laneOpen(ball))) then
			local dist = Math.hypot((k.x - ball.pos.x), (k.y - ball.pos.y))
			if (dist < _T.KEEPER_BODY_R) then
				local oneDive = (not (not Js.T(k.committedDir)))
				local diveTo = k.targetX
				local res = _T.resolveKeeper(ball, scenario, dist, _T.KEEPER_BODY_R, speed, rng)
				if oneDive then
					k.targetX = (if (res == "caught") then k.x else diveTo)
				elseif (res == "caught") then
					k.targetX = k.x
				end
				if Js.T(res) then
					do return res end
				end
			end
		end
		if ((scenario.keeperPro and k.claim) and (not _T.laneOpen(ball))) then
			local c = _T.keeperClaimTouch(ball, scenario)
			if (c ~= nil) then
				do return c end
			end
		end
		if ((((not scenario.receiverDone) and (ball.z < (if M_hitbox.hitboxesOn() then _T.HITBOX_MAX_Z else 2.6))) and (ball.contactCd <= 0)) and (not _T.laneOpen(ball))) then
			local scrambled = ((ball.loose or ball.resting) or (speed < _T.DEAD_BALL_SPEED))
			local poacher = Js.O({ pos = Js.O({ x = scenario.follower.x, y = scenario.follower.y }, { "x", "y" }), to = Js.O({ x = scenario.follower.x, y = scenario.follower.y }, { "x", "y" }), speed = _T.RUNNER_SPEED, moving = false, role = "support", offside = scenario.follower.offside, who = scenario.follower.who, jump = scenario.follower.jump }, { "pos", "to", "speed", "moving", "role", "offside", "who", "jump" })
			local candidates = (if scenario.runner then Js.aspread(Js.alit(scenario.runner), scenario.secondaryRunners) else Js.aspread(scenario.secondaryRunners))
			if (_T.goalInView(scenario.kind) and (not scenario.follower.shot)) then
				A.push(candidates, poacher)
			end
			local ballIsDead = (ball.resting or ((speed < _T.DEAD_BALL_SPEED) and (ball.z < 0.4)))
			local shotAtGoal = (((ball.shot == true) and (not ball.resting)) and (speed >= _T.DEAD_BALL_SPEED))
			do
				local _arr117 = candidates
				local _i118 = 0
				while _i118 < Js.alen(_arr117) do
					_i118 += 1
					local r = _arr117[_i118]
					if (scenario.relayed and (r == scenario.receivedBy)) then
						do continue end
					end
					local tgt = r.pos
					local swept = Math.hypot((tgt.x - ball.pos.x), (tgt.y - ball.pos.y))
					local segX = (ball.pos.x - prevX)
					local segY = (ball.pos.y - prevY)
					local segLen2 = ((segX * segX) + (segY * segY))
					if (segLen2 > 0.01) then
						local t = _T.clamp(((((tgt.x - prevX) * segX) + ((tgt.y - prevY) * segY)) / segLen2), 0, 1)
						local closestX = (prevX + (segX * t))
						local closestY = (prevY + (segY * t))
						swept = Math.min(swept, Math.hypot((tgt.x - closestX), (tgt.y - closestY)))
					end
					if M_hitbox.hitboxesOn() then
						local foot = ((function() local _v = r.jump; if _v == nil then return nil end; _v = _v.z; return _v end)() or 0)
						if (shotAtGoal or _T.meantForOtherMate(ball, r.pos, candidates)) then
							if (swept > M_hitbox.bodyReach(_T.BODY_R, ball.z, foot)) then
								do continue end
							end
						elseif (ball.z > (M_hitbox.headTop(foot) + M_hitbox.hitboxDials().headerBonus)) then
							do continue end
						end
					elseif (shotAtGoal and (swept > _T.BODY_R)) then
						do continue end
					end
					if (swept < _T.PASS_CONTROL_R) then
						if _T.offsideOffence(scenario, r.offside) then
							do return "offside" end
						end
						scenario.receiverDone = true
						scenario.receiverReached = true
						if (scenario.receiver and r.who) then
							scenario.receiver.who = r.who
							local finishing = (if r.who.shooting ~= nil then r.who.shooting else r.who.overall)
							if (finishing ~= nil) then
								scenario.receiver.skill = _T.clamp((finishing + (_T.gaussian(rng) * 6)), 0, 100)
							end
						end
						scenario.receivedAt = Js.O({ x = tgt.x, y = tgt.y }, { "x", "y" })
						scenario.receivedBy = r
						_T.logBallAction(ball, Js.O({ kind = "touch", actor = _T.runnerActor(scenario, r), mode = (if (ball.z > 1.3) then "header" else (if (ball.z > 0.4) then "volley" else "ground")), at = Js.O({ x = tgt.x, y = tgt.y, z = ball.z }, { "x", "y", "z" }) }, { "kind", "actor", "mode", "at" }))
						r.commandedTo = nil
						r.heldAt = nil
						if (_T.goalInView(scenario.kind) and (not scenario.keeper.done)) then
							local gcx = ((scenario.goal.x1 + scenario.goal.x2) / 2)
							scenario.keeper.targetX = _T.clamp((gcx + ((tgt.x - gcx) * _T.KEEPER_SHADE)), (M_pitch.POST_L - 0.6), (M_pitch.POST_R + 0.6))
							scenario.keeper.adjusting = true
						end
						r.moving = false
						ball.lastTouch = "attack"
						local passLen = Math.hypot((tgt.x - scenario.ball.x), (tgt.y - scenario.ball.y))
						local forward = (scenario.ball.y - tgt.y)
						scenario.passDifficulty = _T.clamp(((forward / 25) + (passLen / 45)), 0, 1)
						scenario.passAmbition = (if ((forward > 2) and (scenario.forwardMostY ~= nil)) then _T.clamp((1 - ((tgt.y - scenario.forwardMostY) / 8)), 0, 1) else 0)
						local relay = _T.relayTargetFor(scenario)
						local followerRelay = ((not relay) and _T.relayFollowerTargetFor(scenario))
						if (((scenario.receiver or relay) or followerRelay) and ((if scenario.receiverShots ~= nil then scenario.receiverShots else 0) < _T.SCRAMBLE_MAX)) then
							local arrivalZ = ball.z
							ball.pos = Js.O({ x = tgt.x, y = tgt.y }, { "x", "y" })
							ball.vel = Js.O({ x = 0, y = 0 }, { "x", "y" })
							ball.spin = 0
							local rule = (if (scenario.matePace == "stick") then _T.mateRule() else nil)
							local paced = (if (((rule and scenario.receiver) and (not relay)) and (not followerRelay)) then rule(scenario, Js.O({ x = tgt.x, y = tgt.y }, { "x", "y" }), _T.strikeModeForHeight(scenario.kind, arrivalZ), scrambled) else nil)
							if paced then
								if paced.firstTime then
									if scrambled then
										ball.vz = 0
										ball.z = 0.08
									else
										ball.z = arrivalZ
										ball.vz = 0
									end
									_T.launchReceiverShot(ball, scenario, rng, (not scrambled), (_T.strikeModeForHeight(scenario.kind, arrivalZ) == "ground"))
								else
									ball.vz = 0
									ball.z = 0.08
									ball.receiverControlT = paced.holdT
									ball.event = "received"
									ball.carryT = paced.carryT
								end
							elseif scrambled then
								ball.vz = 0
								ball.z = 0.08
								if (not _T.playRelay(ball, scenario, relay, (not (not followerRelay)), rng, false)) then
									_T.launchReceiverShot(ball, scenario, rng, false)
								end
							else
								local firstTime = false
								local mode = _T.strikeModeForHeight(scenario.kind, arrivalZ)
								local rcv = scenario.receiver
								if ((rcv and (not relay)) and (not followerRelay)) then
									local hasIdentity = (((function() local _v = rcv.who; if _v == nil then return nil end; _v = _v.shooting; return _v end)() ~= nil) or ((function() local _v = rcv.who; if _v == nil then return nil end; _v = _v.overall; return _v end)() ~= nil))
									local threatened = A.some(scenario.defenders, function(d)
										local fy = (d.y - tgt.y)
										do return (((fy < 0) and (fy > -7)) and (math.abs((d.x - tgt.x)) < 2.5)) end
									end)
									if ((mode ~= "ground") or (hasIdentity and (not threatened))) then
										local q = _T.receiverQuality(rcv, scenario.teamRelationship)
										firstTime = (rng() < _T.firstTimeChance(mode, q))
									end
								end
								if firstTime then
									ball.z = arrivalZ
									ball.vz = 0
									_T.launchReceiverShot(ball, scenario, rng, true, (mode == "ground"))
								else
									ball.vz = 0
									ball.z = 0.08
									ball.receiverControlT = (if (relay or followerRelay) then _T.relayControlT(_T.passerQuality(scenario)) else _T.RECEIVER_CONTROL_T)
									ball.event = "received"
									ball.carryT = (if ((((((not relay) and (not followerRelay)) and scenario.receiver) and _T.goalInView(scenario.kind)) and (Math.hypot((tgt.x - M_pitch.CX), tgt.y) > _T.MATE_CARRY.from)) and (M_gameplayVersion.gameplayVersion("mateShots") == "new")) then _T.MATE_CARRY.maxT else 0)
								end
							end
							do return nil end
						end
						if scenario.receiver then
							do return "short" end
						end
						do return "delivered" end
					end
				end
			end
		end
		if ((((not k.done) and (prevY > k.y)) and (ball.pos.y <= k.y)) and (ball.pos.y > -0.6)) then
			local f = ((prevY - k.y) / (function() local _l = (prevY - ball.pos.y); if Js.T(_l) then return _l end; return 1 end)())
			local xAt = (prevX + ((ball.pos.x - prevX) * f))
			local zAt = (prevZ + ((ball.z - prevZ) * f))
			local attempt = _T.keeperAttempt(scenario, xAt, zAt, rng)
			if _T.laneOpen(ball) then
				attempt.reaches = false
			end
			local oneDive = (not (not Js.T(k.committedDir)))
			local behindHim = (oneDive and (((xAt - k.x) * k.committedDir) < (-_T.KEEPER_BODY_R)))
			if (not oneDive) then
				k.saveDir = (function() local _l = Math.sign((xAt - k.x)); if Js.T(_l) then return _l end; return 0 end)()
				k.saveLunge = 0.001
			end
			k.scrambling = true
			if (attempt.reaches and (not behindHim)) then
				local diveTo = k.targetX
				if (not oneDive) then
					k.targetX = xAt
				end
				ball.pos.x = xAt
				ball.pos.y = Math.max(k.y, 0.02)
				ball.z = Math.max(0, zAt)
				local outcome = _T.resolveKeeper(ball, scenario, attempt.dist, attempt.reach, speed, rng)
				k.saveKind = _T.classifySave(xAt, zAt, k.x, attempt.margin, outcome)
				if oneDive then
					k.targetX = (if (outcome == "caught") then k.x else diveTo)
				elseif (outcome == "caught") then
					ball.pos.x = k.targetX
				end
				if scenario.keeperPro then
					if (outcome == "caught") then
						k.targetX = _T.proSaveBodyX(k.x, k.x, xAt, _T.KEEPER_PRO_HOLD)
						ball.pos.x = k.targetX
					else
						k.targetX = _T.proSaveBodyX(k.x, k.targetX, xAt)
					end
				end
				if Js.T(outcome) then
					do return outcome end
				end
			elseif oneDive then
				_T.logBallAction(ball, Js.O({ kind = "save", actor = "keeper", save = "beaten", at = Js.O({ x = xAt, y = k.y, z = Math.max(0, zAt) }, { "x", "y", "z" }) }, { "kind", "actor", "save", "at" }))
			else
				local dir = (function() local _l = Math.sign((xAt - k.x)); if Js.T(_l) then return _l end; return 1 end)()
				k.targetX = (k.x + (dir * Math.min(math.abs((xAt - k.x)), attempt.reach)))
				k.saveKind = _T.classifySave(xAt, zAt, k.x, attempt.margin, nil)
				_T.logBallAction(ball, Js.O({ kind = "save", actor = "keeper", save = "beaten", at = Js.O({ x = xAt, y = k.y, z = Math.max(0, zAt) }, { "x", "y", "z" }) }, { "kind", "actor", "save", "at" }))
			end
		end
		if M_ballPhysics.realBallOn() then
			local hit = M_ballPhysics.frameContact(prevX, prevY, prevZ, ball.pos.x, ball.pos.y, ball.z, scenario.goal, scenario.crossbar)
			if hit then
				ball.postHits = ((if ball.postHits ~= nil then ball.postHits else 0) + 1)
				if (ball.postHits > 2) then
					do return "post" end
				end
				local goingIn = M_ballPhysics.bounceOffFrame(ball, prevX, prevY, prevZ, hit, scenario.goal)
				ball.event = "post"
				if (not goingIn) then
					ball.loose = true
					ball.owner = "none"
					ball.shot = false
					ball.contactCd = 0.25
					ball.lastTouch = "frame"
					ball.deflected = "frame"
				end
				_T.markLanding(ball, scenario)
				do return nil end
			end
		end
		if ((prevY > 0) and (ball.pos.y <= 0)) then
			local frac = (prevY / (prevY - ball.pos.y))
			local xCross = (prevX + ((ball.pos.x - prevX) * frac))
			local zCross = (prevZ + ((ball.z - prevZ) * frac))
			local crossbar = scenario.crossbar
			if M_pitch.insideGoalMouth(xCross, scenario.goal.x1, scenario.goal.x2) then
				if (zCross > (crossbar + M_pitch.BALL_R)) then
					ball.overBar = true
					do return "over" end
				end
				if (M_ballPhysics.realBallOn() and (zCross > crossbar)) then
					ball.overBar = true
					do return "over" end
				end
				if ((not M_ballPhysics.realBallOn()) and (zCross > (crossbar - M_pitch.BALL_R))) then
					local again = _T.reboundOffFrame(ball, xCross, rng, scenario)
					if again then
						ball.z = Math.max(0.2, (crossbar - 0.35))
						ball.vz = (((-(math.abs(ball.vz))) * 0.5) - 1.5)
						do return nil end
					end
					do return "post" end
				end
				ball.inNet = true
				if (not M_ballPhysics.realBallOn()) then
					ball.vel.x *= 0.55
					ball.vel.y *= 0.55
					ball.vz = Math.min(ball.vz, 0)
				end
				do return (if ball.loose then "rebound" else "goal") end
			end
			if ((not M_ballPhysics.realBallOn()) and M_pitch.hitsPost(xCross, scenario.goal.x1, scenario.goal.x2)) then
				local again = _T.reboundOffFrame(ball, xCross, rng, scenario)
				if again then
					do return nil end
				end
				do return "post" end
			end
			do return "wide" end
		end
		local vp = scenario.viewport
		if (vp and ((((ball.pos.x < (vp.x1 - 1)) or (ball.pos.x > (vp.x2 + 1))) or (ball.pos.y > (vp.y2 + 1))) or (ball.pos.y < (vp.y1 - 1)))) then
			do return "out" end
		end
		if (((ball.pos.x < -2) or (ball.pos.x > (M_pitch.PITCH_W + 2))) or (ball.pos.y > (M_pitch.HALF_LEN + 8))) then
			do return "out" end
		end
		local creeping = (((not ball.inNet) and (ball.z < 0.05)) and (Math.hypot(ball.vel.x, ball.vel.y) < _T.THEIRS_CREEP_SPEED))
		ball.creepT = (if creeping then ((if ball.creepT ~= nil then ball.creepT else 0) + dt) else 0)
		if ((if ball.creepT ~= nil then ball.creepT else 0) > _T.THEIRS_AFTER) then
			local dDef = math.huge
			do
				local _arr119 = scenario.defenders
				local _i120 = 0
				while _i120 < Js.alen(_arr119) do
					_i120 += 1
					local d = _arr119[_i120]
					dDef = Math.min(dDef, Math.hypot((d.x - ball.pos.x), (d.y - ball.pos.y)))
				end
			end
			local dOurs = Math.hypot((scenario.player.x - ball.pos.x), (scenario.player.y - ball.pos.y))
			do
				local _arr121 = _T.orderableRunners(scenario)
				local _i122 = 0
				while _i122 < Js.alen(_arr121) do
					_i122 += 1
					local r = _arr121[_i122]
					dOurs = Math.min(dOurs, Math.hypot((r.pos.x - ball.pos.x), (r.pos.y - ball.pos.y)))
				end
			end
			if (not scenario.follower.shot) then
				dOurs = Math.min(dOurs, Math.hypot((scenario.follower.x - ball.pos.x), (scenario.follower.y - ball.pos.y)))
			end
			if ((dOurs >= _T.PASS_CONTROL_R) and ((dDef + _T.THEIRS_MARGIN) < dOurs)) then
				if (ball.lastTouch == "keeper") then
					do return "saved" end
				end
				ball.owner = "opponent"
				do return "short" end
			end
		end
		if ball.resting then
			local capped = ((if scenario.receiverShots ~= nil then scenario.receiverShots else 0) >= _T.SCRAMBLE_MAX)
			local nearestOurs = Math.hypot((scenario.player.x - ball.pos.x), (scenario.player.y - ball.pos.y))
			do
				local _arr123 = _T.orderableRunners(scenario)
				local _i124 = 0
				while _i124 < Js.alen(_arr123) do
					_i124 += 1
					local r = _arr123[_i124]
					nearestOurs = Math.min(nearestOurs, Math.hypot((r.pos.x - ball.pos.x), (r.pos.y - ball.pos.y)))
				end
			end
			if (_T.goalInView(scenario.kind) and (not scenario.follower.shot)) then
				nearestOurs = Math.min(nearestOurs, Math.hypot((scenario.follower.x - ball.pos.x), (scenario.follower.y - ball.pos.y)))
			end
			local reachable = ((not capped) and (nearestOurs < _T.PASS_CONTROL_R))
			local settled = ((not reachable) and ((scenario.receiverDone or ((if scenario.receiverShots ~= nil then scenario.receiverShots else 0) >= 2)) or (Js.alen(_T.orderableRunners(scenario)) == 0)))
			local limit = (if settled then _T.DEAD_BALL_SETTLED else _T.DEAD_BALL_TIMEOUT)
			if ((if ball.restT ~= nil then ball.restT else 0) > limit) then
				do return (if (ball.lastTouch == "keeper") then "saved" else "short") end
			end
		end
		do return nil end
	end
	_T.stepBallInNet = function(ball, dt)
		if (not ball.inNet) then
			do return end
		end
		if M_ballPhysics.realBallOn() then
			local n = Math.max(1, math.ceil(((dt * 180) - 1e-9)))
			for i = 0, math.ceil(n) - 1 do
				_T.netStepReal(ball, (dt / n))
			end
			do return end
		end
		ball.pos.x += (ball.vel.x * dt)
		ball.pos.y += (ball.vel.y * dt)
		ball.vz -= (_T.G * dt)
		ball.z = Math.max(0, (ball.z + (ball.vz * dt)))
		local drag = Math.max(0, (1 - (5.5 * dt)))
		ball.vel.x *= drag
		ball.vel.y *= drag
		if (ball.pos.y < ((-M_pitch.NET_DEPTH) + 0.35)) then
			ball.pos.y = ((-M_pitch.NET_DEPTH) + 0.35)
			ball.vel.x *= 0.4
			ball.vel.y = 0
		end
		local SIDE_NET_CLEARANCE = 0.5
		local inL = ((M_pitch.POST_L + M_pitch.BALL_R) + SIDE_NET_CLEARANCE)
		local inR = ((M_pitch.POST_R - M_pitch.BALL_R) - SIDE_NET_CLEARANCE)
		if (ball.pos.x < inL) then
			ball.pos.x = inL
			ball.vel.x = (math.abs(ball.vel.x) * 0.25)
		elseif (ball.pos.x > inR) then
			ball.pos.x = inR
			ball.vel.x = ((-(math.abs(ball.vel.x))) * 0.25)
		end
	end
	exports.stepBallInNet = _T.stepBallInNet
	_T.netStepReal = function(ball, dt)
		local back = ((-M_pitch.NET_DEPTH) + 0.35)
		local inL = ((M_pitch.POST_L + M_pitch.BALL_R) + 0.5)
		local inR = ((M_pitch.POST_R - M_pitch.BALL_R) - 0.5)
		local touching = false
		local ax = 0
		local ay = 0
		if (ball.pos.y < back) then
			ay += (((-_T.NET_K) * (ball.pos.y - back)) - (_T.NET_C * ball.vel.y))
			touching = true
		end
		if (ball.pos.x < inL) then
			ax += (((-_T.NET_K) * (ball.pos.x - inL)) - (_T.NET_C * ball.vel.x))
			touching = true
		elseif (ball.pos.x > inR) then
			ax += (((-_T.NET_K) * (ball.pos.x - inR)) - (_T.NET_C * ball.vel.x))
			touching = true
		end
		ball.vel.x += (ax * dt)
		ball.vel.y += (ay * dt)
		if (ball.pos.y > back) then
			local k = M_ballPhysics.airDragFactor(ball.vel.x, ball.vel.y, ball.vz, 1, dt)
			ball.vel.x *= k
			ball.vel.y *= k
			ball.vz *= k
		end
		if touching then
			local r = Math.max(0, (1 - (_T.NET_RUB * dt)))
			ball.vz *= r
			if (ball.pos.y < back) then
				ball.vel.x *= r
			else
				ball.vel.y *= r
			end
		end
		ball.vz -= (_T.G * dt)
		ball.pos.x += (ball.vel.x * dt)
		ball.pos.y += (ball.vel.y * dt)
		ball.z += (ball.vz * dt)
		if (ball.z <= 0) then
			ball.z = 0
			if (ball.vz < -0.8) then
				local b = M_ballPhysics.bounceReal(ball.vz, Math.hypot(ball.vel.x, ball.vel.y), 0, 1)
				ball.vz = (b.vz * 0.6)
				ball.vel.x *= b.keep
				ball.vel.y *= b.keep
			else
				ball.vz = 0
				local s = Math.hypot(ball.vel.x, ball.vel.y)
				local drop = (M_ballPhysics.rollDrop(s, 1, 1, dt) + (2 * dt))
				if (s <= drop) then
					ball.vel.x = 0
					ball.vel.y = 0
				else
					local f = ((s - drop) / s)
					ball.vel.x *= f
					ball.vel.y *= f
				end
			end
		end
		ball.pos.y = Math.max(ball.pos.y, ((-M_pitch.NET_DEPTH) + 0.05))
		ball.pos.x = _T.clamp(ball.pos.x, (M_pitch.POST_L + M_pitch.BALL_R), (M_pitch.POST_R - M_pitch.BALL_R))
		ball.z = Math.min(ball.z, (M_pitch.GOAL_H - M_pitch.BALL_R))
		if ((ball.z >= (M_pitch.GOAL_H - M_pitch.BALL_R)) and (ball.vz > 0)) then
			ball.vz = 0
		end
	end
	_T.stepBallPastBar = function(ball, dt)
		if (not ball.overBar) then
			do return end
		end
		if M_ballPhysics.realBallOn() then
			local n = Math.max(1, math.ceil(((dt * 180) - 1e-9)))
			for i = 0, math.ceil(n) - 1 do
				M_ballPhysics.coastBallReal(ball, nil, (dt / n))
			end
			do return end
		end
		ball.pos.x += (ball.vel.x * dt)
		ball.pos.y += (ball.vel.y * dt)
		ball.vz -= (_T.G * dt)
		ball.z += (ball.vz * dt)
	end
	exports.stepBallPastBar = _T.stepBallPastBar
	_T.stepBallCleared = function(ball, dt, scenario)
		if ((not ball.cleared) or ball.resting) then
			do return end
		end
		local cond = (function() local _v = scenario; if _v == nil then return nil end; _v = _v.conditions; return _v end)()
		if M_ballPhysics.realBallOn() then
			local n = Math.max(1, math.ceil(((dt * 180) - 1e-9)))
			do
				local i = 0
				local _first125 = true
				while true do
					if not _first125 then
						i += 1
					end
					_first125 = false
					if not ((i < n) and (not ball.resting)) then break end
					M_ballPhysics.coastBallReal(ball, cond, (dt / n))
				end
			end
			do return end
		end
		if (ball.z > 0.02) then
			local k = Math.max(0, (1 - ((_T.AIR_DRAG * ((function() local _v = cond; if _v == nil then return nil end; _v = _v.drag; return _v end)() or 1)) * dt)))
			ball.vel.x *= k
			ball.vel.y *= k
		end
		ball.vz -= (_T.G * dt)
		ball.z += (ball.vz * dt)
		ball.pos.x += (ball.vel.x * dt)
		ball.pos.y += (ball.vel.y * dt)
		if (ball.z <= 0) then
			ball.z = 0
			if (ball.vz < (-_T.MIN_BOUNCE_VZ)) then
				ball.vz = (((-ball.vz) * _T.BOUNCE_VZ) * ((function() local _v = cond; if _v == nil then return nil end; _v = _v.bounce; return _v end)() or 1))
				ball.vel.x *= _T.BOUNCE_H
				ball.vel.y *= _T.BOUNCE_H
			else
				ball.vz = 0
			end
		end
		if ((ball.z <= 0.03) and (ball.vz <= 0.01)) then
			local s = Math.hypot(ball.vel.x, ball.vel.y)
			local drop = ((_T.GROUND_FRICTION * ((function() local _v = cond; if _v == nil then return nil end; _v = _v.friction; return _v end)() or 1)) * dt)
			if (s <= drop) then
				ball.vel.x = 0
				ball.vel.y = 0
				ball.resting = true
			else
				local f = ((s - drop) / s)
				ball.vel.x *= f
				ball.vel.y *= f
			end
		end
	end
	exports.stepBallCleared = _T.stepBallCleared
	_T.airCarry = function(sc, dir, power, cy, skills)
		local from = Js.ospread(sc.ball)
		local still = function()
			return 0.9999999
		end
		local ball = _T.launch(sc, dir, power, Js.O({ cx = 0, cy = cy }, { "cx", "cy" }), skills, still)
		local airborne = false
		local best = 0
		do
			local t = 0
			local _first126 = true
			while true do
				if not _first126 then
					t += (1 / 120)
				end
				_first126 = false
				if not (t < 6) then break end
				_T.stepBall(ball, sc, still, (1 / 120))
				local along = (((ball.pos.x - from.x) * dir.x) + ((ball.pos.y - from.y) * dir.y))
				if (ball.z > 0.3) then
					airborne = true
				end
				if (airborne and (ball.z <= 0.15)) then
					do return along end
				end
				best = Math.max(best, along)
			end
		end
		do return (if airborne then best else 0) end
	end
	exports.airCarry = _T.airCarry
	Js.reexport(exports, M_ballPhysics, { ["setBallPhysics"] = "setBallPhysics", ["realBallOn"] = "realBallOn" })
	Js.reexport(exports, M_hitbox, { ["setHitboxes"] = "setHitboxes", ["hitboxesOn"] = "hitboxesOn", ["applyHitboxDials"] = "applyHitboxDials", ["hitboxDials"] = "hitboxDials", ["HITBOX_DEFAULTS"] = "HITBOX_DEFAULTS", ["bodyReach"] = "bodyReach", ["headTop"] = "headTop" })
	_T.BALL_ACTION_LOG = 8
	exports.BALL_ACTION_LOG = _T.BALL_ACTION_LOG
	_T.SCENARIO_KINDS = Js.alit("one_on_one", "tight_angle", "long_range", "volley", "header", "cutback", "byline_cross", "through_ball", "midfield_pass", "penalty", "free_kick", "corner", "buildup")
	exports.SCENARIO_KINDS = _T.SCENARIO_KINDS
	_T.G = 9.8
	_T.GROUND_FRICTION = 1.9
	_T.AIR_DRAG = 0.12
	_T.BOUNCE_VZ = 0.7
	_T.BOUNCE_H = 0.88
	_T.DEAD_BALL_SETTLED = 1.2
	_T.DEAD_BALL_TIMEOUT = 3
	_T.MIN_BOUNCE_VZ = 0.5
	_T.BOUNCE_SPIN_KEEP = 0.82
	_T.BOUNCE_TOPSPIN_VZ = 0.18
	_T.BOUNCE_TOPSPIN_H = 0.1
	_T.BOUNCE_SIDESPIN_TURN = 0.12
	_T.CURL_K = 0.48
	_T.CHIP_KEEPER_Y = 3.5
	_T.HEADER_MIN_Z = 1.3
	_T.HEADER_MAX_REACH_Z = 2.6
	_T.VOLLEY_MIN_Z = 0.35
	_T.HEADER_TARGET_Z_MIN = 1.5
	_T.HEADER_TARGET_Z_MAX = 2.15
	_T.VOLLEY_POWER_MIN = 1
	_T.VOLLEY_POWER_MAX = 1.55
	_T.VOLLEY_MISS_PENALTY_DEG = 9
	_T.CHIP_CLEAR_Z = 3.3
	_T.CHIP_LAND_Z = 0.5
	_T.CHIP_MIN_KEEPER_DIST = 2
	_T.SHOT_REF_SPEED = 32
	_T.KEEPER_LATERAL_MAX = 3.2
	_T.KEEPER_DIVE_SPEED = 5.4
	_T.KEEPER_SHUFFLE_SPEED = 3.4
	_T.KEEPER_SHUFFLE_MAX = 2.6
	_T.KEEPER_SHADE = 0.38
	_T.KEEPER_VREACH = 2.5
	_T.KEEPER_STAND_REACH = 2.45
	_T.KEEPER_PATROL_AMP = 2.6
	_T.KEEPER_PATROL_PERIOD = 4.2
	_T.KEEPER_SAVE_R_MIN = 1.95
	_T.KEEPER_SAVE_R_MAX = 2.65
	_T.KEEPER_QUALITY_BAND = 0.22
	_T.KEEPER_QUALITY_BIAS = -0.05
	_T.KEEPER_MISTAKE_BASE = 0.008
	_T.KEEPER_MISTAKE_STRETCH_BONUS = 0.032
	_T.KEEPER_TIERS = Js.O({ easy = Js.O({ radius = 1.85 }, { "radius" }), normal = Js.O({ radius = 2.25 }, { "radius" }), hard = Js.O({ radius = 2.55 }, { "radius" }), expert = Js.O({ radius = 2.75 }, { "radius" }) }, { "easy", "normal", "hard", "expert" })
	exports.KEEPER_TIERS = _T.KEEPER_TIERS
	_T.KEEPER_SAVE_Z_SCALE = 1.15
	_T.KEEPER_BODY_R = 0.75
	_T.KEEPER_CENTRE_Z = 0.95
	_T.DEF_BLOCK_R = 0.95
	_T.BODY_BLOCK_R = 0.7
	_T.BODY_BLOCK_SLOW_R = 0.7
	_T.DEF_BLOCK_H = 1.9
	_T.WALL_TOP = 2.05
	_T.WALL_JUMP_VZ = 3.6
	_T.WALL_JUMP_DELAY = 0.1
	_T.RUNNER_SPEED = 7
	_T.PASS_CONTROL_R = 2
	_T.BODY_R = 0.55
	_T.SCRAMBLE_MAX = 4
	_T.GOAL = Js.O({ x1 = M_pitch.POST_L, x2 = M_pitch.POST_R }, { "x1", "x2" })
	_T.CROSSBAR = M_pitch.GOAL_H
	_T.KEEPER_LINE_MAX = 0.55
	_T.KEEPER_OFF_LINE_MAX = 5.5
	_T.KEEPER_OFF_LINE_ODDS = 0.2
	_T.CAMERA_MOVES_PLAYERS = true
	_T.VIEW_ASPECT = (5 / 8)
	exports.VIEW_ASPECT = _T.VIEW_ASPECT
	_T.VIEW_H = 42
	_T.VIEW_MIN_H = 42
	_T.GOAL_SCREEN_DROP = (74 / 844)
	_T.VIEW_MAX_H = _T.VIEW_H
	_T.WIDE_DELIVERY_VIEW = (function()
		local h = _T.VIEW_H
		local w = (h * _T.VIEW_ASPECT)
		do return Js.O({ x1 = (M_pitch.CX - (w / 2)), x2 = (M_pitch.CX + (w / 2)), y1 = -4.5, y2 = (-4.5 + h) }, { "x1", "x2", "y1", "y2" }) end
	end)()
	_T.WIDE_DELIVERY_X = function(side)
		return (M_pitch.CX + (side * ((_T.WIDE_DELIVERY_VIEW.x2 - M_pitch.CX) - 3.4)))
	end
	_T.CROSS_VIEW_X = _T.VIEW_H
	_T.CROSS_SWITCH_Y = 15
	_T.CORNER_VIEW_X = 48.3
	_T.BYLINE_BALL_DOWN = 0.8
	exports.BYLINE_BALL_DOWN = _T.BYLINE_BALL_DOWN
	_T.OFFSIDE_EPS = 0.05
	_T.offsideRuleEnabled = true
	_T.LANE_CLEAR = 1.7
	_T.CLEAR_OF_BALL = 1.8
	_T.STANDOFF_SIDE = 1.3
	_T.STANDOFF_BACK = 0.15
	_T.RECEIVER_ROLES = Js.O({ cutback = Js.alit(Js.O({ label = "the striker", skillMin = 62, skillMax = 90 }, { "label", "skillMin", "skillMax" }), Js.O({ label = "the attacking midfielder", skillMin = 55, skillMax = 82 }, { "label", "skillMin", "skillMax" })), byline_cross = Js.alit(Js.O({ label = "the striker", skillMin = 55, skillMax = 85 }, { "label", "skillMin", "skillMax" }), Js.O({ label = "the center-back", skillMin = 40, skillMax = 68 }, { "label", "skillMin", "skillMax" })), through_ball = Js.alit(Js.O({ label = "the striker", skillMin = 58, skillMax = 88 }, { "label", "skillMin", "skillMax" }), Js.O({ label = "the winger", skillMin = 52, skillMax = 80 }, { "label", "skillMin", "skillMax" })), corner = Js.alit(Js.O({ label = "the center-back", skillMin = 45, skillMax = 72 }, { "label", "skillMin", "skillMax" }), Js.O({ label = "the striker", skillMin = 55, skillMax = 82 }, { "label", "skillMin", "skillMax" })), one_on_one = Js.alit(Js.O({ label = "the striker", skillMin = 58, skillMax = 88 }, { "label", "skillMin", "skillMax" }), Js.O({ label = "the attacking midfielder", skillMin = 52, skillMax = 82 }, { "label", "skillMin", "skillMax" })), tight_angle = Js.alit(Js.O({ label = "the striker", skillMin = 58, skillMax = 88 }, { "label", "skillMin", "skillMax" }), Js.O({ label = "the far-post runner", skillMin = 50, skillMax = 80 }, { "label", "skillMin", "skillMax" })), long_range = Js.alit(Js.O({ label = "the attacking midfielder", skillMin = 55, skillMax = 85 }, { "label", "skillMin", "skillMax" }), Js.O({ label = "the striker", skillMin = 58, skillMax = 88 }, { "label", "skillMin", "skillMax" })), volley = Js.alit(Js.O({ label = "the striker", skillMin = 55, skillMax = 85 }, { "label", "skillMin", "skillMax" }), Js.O({ label = "the midfielder arriving", skillMin = 48, skillMax = 78 }, { "label", "skillMin", "skillMax" })), header = Js.alit(Js.O({ label = "the striker", skillMin = 55, skillMax = 85 }, { "label", "skillMin", "skillMax" }), Js.O({ label = "the center-back", skillMin = 42, skillMax = 70 }, { "label", "skillMin", "skillMax" })), free_kick = Js.alit(Js.O({ label = "the striker", skillMin = 52, skillMax = 84 }, { "label", "skillMin", "skillMax" }), Js.O({ label = "the center-back", skillMin = 42, skillMax = 70 }, { "label", "skillMin", "skillMax" })), penalty = Js.alit(Js.O({ label = "the striker", skillMin = 58, skillMax = 88 }, { "label", "skillMin", "skillMax" })) }, { "cutback", "byline_cross", "through_ball", "corner", "one_on_one", "tight_angle", "long_range", "volley", "header", "free_kick", "penalty" })
	_T.RECEIVER_CONTROL = Js.O({ cutback = 1, one_on_one = 0.95, through_ball = 0.8, tight_angle = 0.7, byline_cross = 0.5, volley = 0.5, header = 0.45, corner = 0.3 }, { "cutback", "one_on_one", "through_ball", "tight_angle", "byline_cross", "volley", "header", "corner" })
	_T.SUPPORT_RANGE = Js.O({ one_on_one = Js.alit(0, 1), tight_angle = Js.alit(0, 1), volley = Js.alit(0, 1), header = Js.alit(0, 1), long_range = Js.alit(0, 2), cutback = Js.alit(0, 1), byline_cross = Js.alit(0, 1), through_ball = Js.alit(0, 1), corner = Js.alit(0, 0), midfield_pass = Js.alit(1, 2), buildup = Js.alit(0, 2), penalty = Js.alit(0, 0), free_kick = Js.alit(0, 0) }, { "one_on_one", "tight_angle", "volley", "header", "long_range", "cutback", "byline_cross", "through_ball", "corner", "midfield_pass", "buildup", "penalty", "free_kick" })
	_T.COVER_RANGE = Js.O({ one_on_one = Js.alit(1, 3), tight_angle = Js.alit(2, 4), volley = Js.alit(1, 3), header = Js.alit(2, 4), long_range = Js.alit(2, 4), cutback = Js.alit(2, 4), byline_cross = Js.alit(2, 4), through_ball = Js.alit(1, 3), midfield_pass = Js.alit(0, 2), buildup = Js.alit(0, 2), penalty = Js.alit(0, 0), free_kick = Js.alit(0, 0), corner = Js.alit(0, 0) }, { "one_on_one", "tight_angle", "volley", "header", "long_range", "cutback", "byline_cross", "through_ball", "midfield_pass", "buildup", "penalty", "free_kick", "corner" })
	_T.DEFAULT_WEIGHTS = Js.O({ one_on_one = 9, tight_angle = 9, long_range = 9, volley = 9, header = 9, cutback = 9, byline_cross = 9, through_ball = 9, midfield_pass = 7, penalty = 3, free_kick = 5, corner = 6, buildup = 7 }, { "one_on_one", "tight_angle", "long_range", "volley", "header", "cutback", "byline_cross", "through_ball", "midfield_pass", "penalty", "free_kick", "corner", "buildup" })
	_T.POSITION_WEIGHTS = Js.O({ ST = Js.O({ one_on_one = 20, tight_angle = 14, long_range = 3, volley = 14, header = 16, cutback = 5, byline_cross = 2, through_ball = 6, midfield_pass = 2, penalty = 5, free_kick = 3, corner = 2, buildup = 5 }, { "one_on_one", "tight_angle", "long_range", "volley", "header", "cutback", "byline_cross", "through_ball", "midfield_pass", "penalty", "free_kick", "corner", "buildup" }), CAM = Js.O({ one_on_one = 14, tight_angle = 10, long_range = 12, volley = 10, header = 8, cutback = 6, byline_cross = 3, through_ball = 14, midfield_pass = 5, penalty = 3, free_kick = 5, corner = 2, buildup = 8 }, { "one_on_one", "tight_angle", "long_range", "volley", "header", "cutback", "byline_cross", "through_ball", "midfield_pass", "penalty", "free_kick", "corner", "buildup" }), LW = Js.O({ one_on_one = 12, tight_angle = 14, long_range = 6, volley = 8, header = 5, cutback = 10, byline_cross = 16, through_ball = 6, midfield_pass = 5, penalty = 2, free_kick = 3, corner = 6, buildup = 7 }, { "one_on_one", "tight_angle", "long_range", "volley", "header", "cutback", "byline_cross", "through_ball", "midfield_pass", "penalty", "free_kick", "corner", "buildup" }), RW = Js.O({ one_on_one = 12, tight_angle = 14, long_range = 6, volley = 8, header = 5, cutback = 10, byline_cross = 16, through_ball = 6, midfield_pass = 5, penalty = 2, free_kick = 3, corner = 6, buildup = 7 }, { "one_on_one", "tight_angle", "long_range", "volley", "header", "cutback", "byline_cross", "through_ball", "midfield_pass", "penalty", "free_kick", "corner", "buildup" }), CM = Js.O({ one_on_one = 5, tight_angle = 3, long_range = 12, volley = 5, header = 3, cutback = 6, byline_cross = 4, through_ball = 16, midfield_pass = 10, penalty = 2, free_kick = 6, corner = 4, buildup = 24 }, { "one_on_one", "tight_angle", "long_range", "volley", "header", "cutback", "byline_cross", "through_ball", "midfield_pass", "penalty", "free_kick", "corner", "buildup" }), LM = Js.O({ one_on_one = 7, tight_angle = 8, long_range = 6, volley = 5, header = 3, cutback = 10, byline_cross = 16, through_ball = 10, midfield_pass = 8, penalty = 2, free_kick = 4, corner = 6, buildup = 15 }, { "one_on_one", "tight_angle", "long_range", "volley", "header", "cutback", "byline_cross", "through_ball", "midfield_pass", "penalty", "free_kick", "corner", "buildup" }), RM = Js.O({ one_on_one = 7, tight_angle = 8, long_range = 6, volley = 5, header = 3, cutback = 10, byline_cross = 16, through_ball = 10, midfield_pass = 8, penalty = 2, free_kick = 4, corner = 6, buildup = 15 }, { "one_on_one", "tight_angle", "long_range", "volley", "header", "cutback", "byline_cross", "through_ball", "midfield_pass", "penalty", "free_kick", "corner", "buildup" }), CDM = Js.O({ one_on_one = 2, tight_angle = 2, long_range = 12, volley = 2, header = 3, cutback = 3, byline_cross = 3, through_ball = 12, midfield_pass = 12, penalty = 2, free_kick = 6, corner = 3, buildup = 38 }, { "one_on_one", "tight_angle", "long_range", "volley", "header", "cutback", "byline_cross", "through_ball", "midfield_pass", "penalty", "free_kick", "corner", "buildup" }), CB = Js.O({ one_on_one = 1, tight_angle = 1, long_range = 4, volley = 1, header = 8, cutback = 1, byline_cross = 1, through_ball = 5, midfield_pass = 10, penalty = 1, free_kick = 3, corner = 8, buildup = 56 }, { "one_on_one", "tight_angle", "long_range", "volley", "header", "cutback", "byline_cross", "through_ball", "midfield_pass", "penalty", "free_kick", "corner", "buildup" }), LB = Js.O({ one_on_one = 2, tight_angle = 2, long_range = 3, volley = 1, header = 3, cutback = 6, byline_cross = 18, through_ball = 8, midfield_pass = 10, penalty = 1, free_kick = 3, corner = 8, buildup = 35 }, { "one_on_one", "tight_angle", "long_range", "volley", "header", "cutback", "byline_cross", "through_ball", "midfield_pass", "penalty", "free_kick", "corner", "buildup" }), RB = Js.O({ one_on_one = 2, tight_angle = 2, long_range = 3, volley = 1, header = 3, cutback = 6, byline_cross = 18, through_ball = 8, midfield_pass = 10, penalty = 1, free_kick = 3, corner = 8, buildup = 35 }, { "one_on_one", "tight_angle", "long_range", "volley", "header", "cutback", "byline_cross", "through_ball", "midfield_pass", "penalty", "free_kick", "corner", "buildup" }), GK = Js.O({ one_on_one = 0, tight_angle = 0, long_range = 1, volley = 0, header = 0, cutback = 0, byline_cross = 0, through_ball = 5, midfield_pass = 20, penalty = 0, free_kick = 0, corner = 1, buildup = 73 }, { "one_on_one", "tight_angle", "long_range", "volley", "header", "cutback", "byline_cross", "through_ball", "midfield_pass", "penalty", "free_kick", "corner", "buildup" }) }, { "ST", "CAM", "LW", "RW", "CM", "LM", "RM", "CDM", "CB", "LB", "RB", "GK" })
	_T.ATTACKING_KINDS = Js.alit("one_on_one", "tight_angle", "long_range", "volley", "header", "cutback", "byline_cross", "through_ball")
	_T.CHAIN_MAX = 2
	exports.CHAIN_MAX = _T.CHAIN_MAX
	_T.TOUCH_CHAIN_MAX = 1
	exports.TOUCH_CHAIN_MAX = _T.TOUCH_CHAIN_MAX
	_T.RECEIVER_CONTROL_T = 0.45
	_T.RELAY_MIN = 1.2
	_T.RELAY_MAX = 40
	_T.SMART_PASS_Q = 0.62
	_T.LOFT_PASS_Q = 0.6
	_T.MATE_CARRY = Js.O({ from = 18, ["until"] = 13.5, speed = 6.2, maxT = 1.8, threatR = 2.6, keeperR = 5, touchT = 0.15 }, { "from", "until", "speed", "maxT", "threatR", "keeperR", "touchT" })
	exports.MATE_CARRY = _T.MATE_CARRY
	_T.MATE_RULE_KEY = "__starMateReceptionRule"
	_T.mateRule = function()
		return (if Js.globalThis[_T.MATE_RULE_KEY] ~= nil then Js.globalThis[_T.MATE_RULE_KEY] else nil)
	end
	_T.AERIAL_R = 2.8
	_T.AERIAL_WIN_BASE = 0.3
	_T.CURVE_SPIN_STEP = 0.45
	exports.CURVE_SPIN_STEP = _T.CURVE_SPIN_STEP
	_T.CURVE_SPIN_MAX = 2.2
	exports.CURVE_SPIN_MAX = _T.CURVE_SPIN_MAX
	_T.CURVE_VZ_STEP = 1.4
	exports.CURVE_VZ_STEP = _T.CURVE_VZ_STEP
	_T.CURVE_VZ_MAX = 4.5
	exports.CURVE_VZ_MAX = _T.CURVE_VZ_MAX
	_T.DRAG_LENGTH_SCALE = 0.75
	exports.DRAG_LENGTH_SCALE = _T.DRAG_LENGTH_SCALE
	_T.VZ_POWER_FLOOR = 0.88
	_T.VZ_POWER_WEIGHT = 0.12
	_T.CROSS_DELIVERY_KINDS = Js.alit("corner", "byline_cross")
	_T.CROSS_VZ_CAP = 8.3
	_T.DEF_PRESS_SPEED = 4.3
	_T.DEF_CONTAIN_R = 1.75
	_T.DEF_TACKLE_S = 1.15
	_T.DEF_COVER_SPEED = 3.4
	_T.LOOSE_CONTEST_SPEED = 7
	_T.LOOSE_WIN_R = 1.1
	_T.DEF_INTERCEPT_SPEED = 6.4
	_T.DEF_RECOVER_SPEED = 6.2
	_T.DEF_RECOVER_GAP = 5
	_T.DEF_SUPPORT_BIAS = 0.85
	_T.DEF_LANE_BIAS = 0.62
	_T.SUPPORT_MIN_PASS = 6
	_T.SUPPORT_MAX_PASS = 26
	_T.PREDICT_STEP = 0.08
	_T.RUN_MEET_R = 7
	_T.RUN_MEET_CLOSE = 2.6
	_T.RUN_MEET_T = 1.4
	_T.LAYOFF_MAX_SPEED = 10
	_T.SHOT_MOUTH_PAD = 3
	_T.ON_LINE_R = 0.6
	exports.ON_LINE_R = _T.ON_LINE_R
	_T.ON_TARGET_PAD = 0.25
	_T.REACT_R = 9
	_T.REACT_SPEED = 2.6
	_T.WALK_SPEED = 4.6
	_T.FETCH_SPEED = 7
	_T.FETCH_FAR = 12
	_T.DEAD_BALL_SPEED = 4
	_T.THEIRS_CREEP_SPEED = 1
	_T.THEIRS_AFTER = 0.3
	_T.THEIRS_MARGIN = 1
	_T.CONTROL_R = 1.15
	_T.SIDESTEP_CLEAR = 1.4
	_T.SIDESTEP_SPEED = 3.4
	_T.SHAPE_CHASE_SPEED = _T.REACT_SPEED
	_T.SHAPE_LINE_SPEED = _T.REACT_SPEED
	_T.SHAPE_PUSH_SPEED = _T.REACT_SPEED
	_T.SHAPE_LINE_GOALSIDE = 1.5
	_T.SHAPE_LINE_SHIFT = 0.5
	_T.SHAPE_PUSH_SHARE = 0.5
	_T.SHAPE_PUSH_STOP = 3
	_T.SHAPE_MIDFIELD_BEHIND = 8
	_T.SHAPE_SWITCH_BY = 1.2
	_T.SHAPE_READ_AHEAD = 0.35
	_T.SHAPE_STATE = Js.Map.new()
	_T.FREE_KICK_WALL_R = 12.5
	_T.TOUCH_CHASE_SPEED = 7.6
	_T.TOUCH_CHASE_START_R = 1.3
	_T.TOUCH_CHASE_CATCH_R = _T.CONTROL_R
	_T.CLEARANCE_DEFAULTS = Js.O({ speedMin = 24, speedMax = 34, maxAngleDeg = 60, miscues = false, miscueWeak = 0.3, miscueStrong = 0.1, bodyLen = 6, bodyWidth = 0.5, secondBalls = 1 }, { "speedMin", "speedMax", "maxAngleDeg", "miscues", "miscueWeak", "miscueStrong", "bodyLen", "bodyWidth", "secondBalls" })
	exports.CLEARANCE_DEFAULTS = _T.CLEARANCE_DEFAULTS
	_T.clearanceRules = _T.CLEARANCE_DEFAULTS
	_T.KEEPER_PRO = Js.O({ holdPace = Js.alit(20, 33), holdPaceFloor = 0.15, holdBand = Js.alit(0.25, 1.6), holdGround = 0.75, holdHigh = 0.45, holdOverhead = 0.2, holdBody = Js.alit(0.5, 1.5), holdRating = Js.alit(0.72, 1.12), holdMax = 0.95, outBase = 0.15, outHigh = 0.25, outStretch = 0.2, outMax = 0.7, danger = Js.alit(0.7, 0.45), errBase = 0.002, errStretch = 0.01, nutmegZ = 0.3, nutmegR = 0.4, nutmeg = Js.alit(0.16, 0.05) }, { "holdPace", "holdPaceFloor", "holdBand", "holdGround", "holdHigh", "holdOverhead", "holdBody", "holdRating", "holdMax", "outBase", "outHigh", "outStretch", "outMax", "danger", "errBase", "errStretch", "nutmegZ", "nutmegR", "nutmeg" })
	exports.KEEPER_PRO = _T.KEEPER_PRO
	_T.KEEPER_FEEL = Js.O({ holdRating = Js.alit(0.78, 1), danger = Js.alit(0.5, 0.3) }, { "holdRating", "danger" })
	exports.KEEPER_FEEL = _T.KEEPER_FEEL
	_T.KEEPER_PRO_HAND = 1
	exports.KEEPER_PRO_HAND = _T.KEEPER_PRO_HAND
	_T.KEEPER_PRO_HOLD = 0.45
	exports.KEEPER_PRO_HOLD = _T.KEEPER_PRO_HOLD
	_T.POST_KEEP = 0.78
	_T.DEF_HEADER_SHARE = 0
	_T.SLOW_BALL_FULL = 10
	_T.SHOT_OVER_SPEED = 18
	_T.SLOW_BALL_SHAPED = 16
	_T.HITBOX_MAX_Z = 3.4
	_T.MEANT_MIN_Z = 1.2
	_T.DROP_Z = 2
	_T.laneOpen = function(ball)
		return (((ball.realLane == true) and (ball.lastTouch == "attack")) and (not ball.loose))
	end
	_T.NET_K = 420
	_T.NET_C = 38
	_T.NET_RUB = 4
	_T.OUTCOME_TEXT = Js.O({ goal = Js.O({ text = "GOAL!", kind = "goal" }, { "text", "kind" }), rebound = Js.O({ text = "GOAL — rebound!", kind = "goal" }, { "text", "kind" }), delivered = Js.O({ text = "Picked out the run!", kind = "pass" }, { "text", "kind" }), saved = Js.O({ text = "Saved by the keeper!", kind = "miss" }, { "text", "kind" }), caught = Js.O({ text = "Caught by the keeper!", kind = "miss" }, { "text", "kind" }), tipped = Js.O({ text = "Tipped to safety!", kind = "miss" }, { "text", "kind" }), over = Js.O({ text = "Over the bar!", kind = "miss" }, { "text", "kind" }), post = Js.O({ text = "Off the woodwork!", kind = "miss" }, { "text", "kind" }), wide = Js.O({ text = "Wide of the mark!", kind = "miss" }, { "text", "kind" }), blocked = Js.O({ text = "Blocked!", kind = "miss" }, { "text", "kind" }), out = Js.O({ text = "Out of play.", kind = "neutral" }, { "text", "kind" }), short = Js.O({ text = "Scrambled clear.", kind = "neutral" }, { "text", "kind" }), offside = Js.O({ text = "OFFSIDE!", kind = "neutral" }, { "text", "kind" }), tackled = Js.O({ text = "Intercepted!", kind = "miss" }, { "text", "kind" }), touchOn = Js.O({ text = "Touch on!", kind = "neutral" }, { "text", "kind" }) }, { "goal", "rebound", "delivered", "saved", "caught", "tipped", "over", "post", "wide", "blocked", "out", "short", "offside", "tackled", "touchOn" })
	exports.OUTCOME_TEXT = _T.OUTCOME_TEXT
end
