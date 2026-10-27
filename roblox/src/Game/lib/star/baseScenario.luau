--!nocheck
--!nolint
-- Generated from lib/star/baseScenario.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_canvasEngine = import("lib/star/canvasEngine")
	local M_pitch = import("lib/star/pitch")
	local clamp, DEAD_BALL, LINE_KINDS, MATE_LANE_R, offsideLineOf, inShotCone, attackersOf, isOffside, BYLINE_CROSS_MAX_OUT, identityFault, scenarioFaults, isPostMan, YOU_STRIKE, clearShotLaneIn, fixBaseScenario
	offsideLineOf = function(sc)
		if ((not M_canvasEngine.goalInView(sc.kind)) or (sc.kind == "corner")) then
			do return nil end
		end
		local ys = A.map(sc.defenders, function(d)
			return d.y
		end)
		A.push(ys, sc.keeper.y)
		if (Js.alen(ys) < 2) then
			do return nil end
		end
		A.sort(ys, function(a, b)
			return (a - b)
		end)
		do return ys[2] end
	end
	exports.offsideLineOf = offsideLineOf
	inShotCone = function(sc, p)
		if (p.y >= sc.ball.y) then
			do return false end
		end
		local span = (if Js.T(sc.ball.y) then sc.ball.y else 1)
		local t = ((sc.ball.y - p.y) / span)
		local lx = (sc.ball.x + ((M_pitch.POST_L - sc.ball.x) * t))
		local rx = (sc.ball.x + ((M_pitch.POST_R - sc.ball.x) * t))
		do return ((p.x >= (Math.min(lx, rx) - 0.6)) and (p.x <= (Math.max(lx, rx) + 0.6))) end
	end
	exports.inShotCone = inShotCone
	attackersOf = function(sc)
		local out = Js.alit()
		if sc.runner then
			A.push(out, sc.runner.pos)
		end
		do
			local _arr1 = sc.secondaryRunners
			local _i2 = 0
			while _i2 < Js.alen(_arr1) do
				_i2 += 1
				local r = _arr1[_i2]
				A.push(out, r.pos)
			end
		end
		if M_canvasEngine.goalInView(sc.kind) then
			A.push(out, Js.O({ x = sc.follower.x, y = sc.follower.y }, { "x", "y" }))
		end
		do return out end
	end
	isOffside = function(p, line, ballY)
		do return ((p.y < (line - 0.01)) and (p.y < (ballY - 0.01))) end
	end
	identityFault = function(sc)
		local dist = sc.ball.y
		local lat = math.abs((sc.ball.x - M_pitch.CX))
		local _sw3 = sc.kind
		local _ci4 = (if _sw3 == "one_on_one" then 1 elseif _sw3 == "tight_angle" then 2 elseif _sw3 == "long_range" then 3 elseif _sw3 == "header" then 4 elseif _sw3 == "volley" then 5 elseif _sw3 == "cutback" then 6 elseif _sw3 == "byline_cross" then 7 elseif _sw3 == "through_ball" then 8 else 9)
		local _cont5 = false
		repeat
			if _ci4 ~= 0 and _ci4 <= 1 then
				do
					local blocking = A.filter(sc.defenders, function(d)
						return ((d.y < (dist - 0.5)) and (math.abs((d.x - M_pitch.CX)) <= 14))
					end)
					if Js.T(Js.alen(blocking)) then
						do return ("not a one-on-one — " .. Js.numstr(Js.alen(blocking)) .. " defender" .. (if (Js.alen(blocking) > 1) then "s" else "") .. " between you and goal") end
					end
					do return nil end
				end
			end
			if _ci4 ~= 0 and _ci4 <= 2 then
				if (lat < 9) then
					do return "not a tight angle — ball is too central" end
				end
				if (dist > 15) then
					do return "not a tight angle — ball is too far out" end
				end
				do return nil end
			end
			if _ci4 ~= 0 and _ci4 <= 3 then
				if (dist < 17) then
					do return "not long range — ball is inside 17m" end
				end
				do return nil end
			end
			if _ci4 ~= 0 and _ci4 <= 4 then
				if (dist > 8) then
					do return "header from too far out" end
				end
				do return nil end
			end
			if _ci4 ~= 0 and _ci4 <= 5 then
				if (dist > 18) then
					do return "volley from too far out" end
				end
				do return nil end
			end
			if _ci4 ~= 0 and _ci4 <= 6 then
				if (dist > 6) then
					do return "not a cutback — ball is not near the byline" end
				end
				if (lat < 8) then
					do return "not a cutback — ball is too central to be cut back" end
				end
				do return nil end
			end
			if _ci4 ~= 0 and _ci4 <= 7 then
				if (dist > BYLINE_CROSS_MAX_OUT) then
					do return "not a byline cross — ball is not near the byline" end
				end
				if (lat < 8) then
					do return "not a byline cross — ball is too central" end
				end
				do return nil end
			end
			if _ci4 ~= 0 and _ci4 <= 8 then
				if (dist < 20) then
					do return "not a through ball — ball is already too close to goal" end
				end
				do return nil end
			end
			if _ci4 ~= 0 and _ci4 <= 9 then
				do return nil end
			end
		until true
	end
	scenarioFaults = function(sc)
		local out = Js.alit()
		local id = identityFault(sc)
		if Js.T(id) then
			A.push(out, id)
		end
		local line = offsideLineOf(sc)
		if ((line ~= nil) and A.some(attackersOf(sc), function(a)
			return isOffside(a, line, sc.ball.y)
		end)) then
			A.push(out, "attacker offside")
		end
		local dist = sc.ball.y
		local CHANNEL_EXEMPT = ((sc.kind == "one_on_one") or (sc.kind == "through_ball"))
		if ((((M_canvasEngine.goalInView(sc.kind) and (not DEAD_BALL:has(sc.kind))) and (not CHANNEL_EXEMPT)) and (dist <= 24)) and (Js.alen(sc.defenders) > 0)) then
			if (not A.some(sc.defenders, function(d)
				return (math.abs((d.x - M_pitch.CX)) <= 6.5)
			end)) then
				A.push(out, "empty central channel")
			end
		end
		if ((LINE_KINDS:has(sc.kind) and (dist <= 25)) and (Js.alen(sc.defenders) >= 2)) then
			local deepest = Math.min(Js.unpack(A.map(sc.defenders, function(d)
				return d.y
			end)))
			local lineMen = A.sort(A.map(A.filter(sc.defenders, function(d)
				return ((d.y - deepest) <= 4)
			end), function(d)
				return d.x
			end), function(a, b)
				return (a - b)
			end)
			for i = 1, (Js.alen(lineMen)) - 1 do
				if ((lineMen[i + 1] - lineMen[i]) > 11) then
					A.push(out, "11m+ hole in the line")
					do break end
				end
			end
		end
		if A.some(sc.defenders, function(d)
			return ((d.y < sc.keeper.y) and (not isPostMan(sc, d)))
		end) then
			A.push(out, "defender behind his own keeper")
		end
		do return out end
	end
	exports.scenarioFaults = scenarioFaults
	isPostMan = function(sc, d)
		do return (((sc.kind == "corner") and (d.y <= 2.5)) and (math.abs((d.x - M_pitch.CX)) <= 9.16)) end
	end
	exports.isPostMan = isPostMan
	clearShotLaneIn = function(sc, done)
		if (not YOU_STRIKE:has(sc.kind)) then
			do return end
		end
		local ballY = sc.ball.y
		local line = offsideLineOf(sc)
		local keepLegal = function(m)
			if ((line ~= nil) and isOffside(m, line, ballY)) then
				m.y = (line + 0.3)
			end
		end
		local move = function(m)
			if (m.y >= ballY) then
				do return end
			end
			local vx = (M_pitch.CX - sc.ball.x)
			local vy = (0 - ballY)
			local len2 = (function() local _l = ((vx * vx) + (vy * vy)); if Js.T(_l) then return _l end; return 1 end)()
			local t = ((((m.x - sc.ball.x) * vx) + ((m.y - ballY) * vy)) / len2)
			t = (if (t < 0) then 0 else (if (t > 1) then 1 else t))
			local px = (sc.ball.x + (vx * t))
			local py = (ballY + (vy * t))
			local off = Math.hypot((m.x - px), (m.y - py))
			if (off >= MATE_LANE_R) then
				do return end
			end
			local nlen = (function() local _l = Math.hypot((-vy), vx); if Js.T(_l) then return _l end; return 1 end)()
			local nx = ((-vy) / nlen)
			local ny = (vx / nlen)
			local sign = (if ((((m.x - px) * nx) + ((m.y - py) * ny)) >= 0) then 1 else -1)
			local push = ((MATE_LANE_R - off) + 0.6)
			m.x = clamp((m.x + ((sign * nx) * push)), 2, 66)
			m.y = Math.max(0.8, (m.y + ((sign * ny) * push)))
			keepLegal(m)
			A.push(done, "moved a team-mate out of your shooting lane")
		end
		if sc.runner then
			move(sc.runner.pos)
		end
		do
			local _arr6 = sc.secondaryRunners
			local _i7 = 0
			while _i7 < Js.alen(_arr6) do
				_i7 += 1
				local r = _arr6[_i7]
				move(r.pos)
			end
		end
		if M_canvasEngine.goalInView(sc.kind) then
			move(sc.follower)
		end
	end
	fixBaseScenario = function(sc)
		local done = Js.alit()
		do
			local _arr8 = sc.defenders
			local _i9 = 0
			while _i9 < Js.alen(_arr8) do
				_i9 += 1
				local d = _arr8[_i9]
				if ((d.y < sc.keeper.y) and (not isPostMan(sc, d))) then
					d.y = (sc.keeper.y + 2.2)
					A.push(done, "moved a defender out from behind his own keeper")
				end
			end
		end
		if (sc.kind == "one_on_one") then
			local ballY = sc.ball.y
			A.forEach(sc.defenders, function(d, i)
				if (d.y < ballY) then
					local spread = (math.fmod(((math.abs(d.x) * 7) + (i * 13)), 100) / 100)
					d.y = ((ballY + 1) + (spread * 2.5))
					local side = (if (d.x >= sc.ball.x) then 1 else -1)
					d.x = clamp((sc.ball.x + (side * (2.5 + (spread * 3)))), 2, 66)
					A.push(done, "moved a blocking defender behind the ball (recovering)")
				end
			end)
			sc.keeper.y = clamp(Math.max(sc.keeper.y, 2.2), 2.2, Math.max(2.2, (ballY - 3)))
			sc.keeper.startX = sc.keeper.x
			local line = offsideLineOf(sc)
			if (line ~= nil) then
				local onside = function(p)
					if isOffside(p, line, sc.ball.y) then
						p.y = (line + 0.3)
					end
				end
				if sc.runner then
					onside(sc.runner.pos)
				end
				do
					local _arr10 = sc.secondaryRunners
					local _i11 = 0
					while _i11 < Js.alen(_arr10) do
						_i11 += 1
						local r = _arr10[_i11]
						onside(r.pos)
					end
				end
				onside(sc.follower)
				A.push(done, "brought team-mates back onside behind the play")
			end
		end
		if (sc.kind ~= "through_ball") then
			local line = offsideLineOf(sc)
			if (line ~= nil) then
				local moved = false
				local onside = function(p)
					if isOffside(p, line, sc.ball.y) then
						p.y = (line + 0.3)
						moved = true
					end
				end
				if sc.runner then
					onside(sc.runner.pos)
				end
				do
					local _arr12 = sc.secondaryRunners
					local _i13 = 0
					while _i13 < Js.alen(_arr12) do
						_i13 += 1
						local r = _arr12[_i13]
						onside(r.pos)
					end
				end
				if M_canvasEngine.goalInView(sc.kind) then
					onside(sc.follower)
				end
				if moved then
					A.push(done, "brought an offside attacker back onside")
				end
			end
		end
		clearShotLaneIn(sc, done)
		do return done end
	end
	exports.fixBaseScenario = fixBaseScenario
	clamp = function(v, lo, hi)
		return (if (v < lo) then lo else (if (v > hi) then hi else v))
	end
	DEAD_BALL = Js.Set.new(Js.alit("penalty", "free_kick", "corner"))
	LINE_KINDS = Js.Set.new(Js.alit("long_range", "through_ball"))
	MATE_LANE_R = 2.2
	BYLINE_CROSS_MAX_OUT = 18
	exports.BYLINE_CROSS_MAX_OUT = BYLINE_CROSS_MAX_OUT
	YOU_STRIKE = Js.Set.new(Js.alit("one_on_one", "tight_angle", "long_range"))
end
