--!nocheck
--!nolint
-- Generated from lib/star/playOn.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_canvasEngine = import("lib/star/canvasEngine")
	local M_pitch = import("lib/star/pitch")
	local M_leadIn = import("lib/star/leadIn")
	local M_firstPersonDribble = import("lib/star/firstPersonDribble")
	local M_legs = import("lib/star/legs")
	local PLAY_ON_RUN_SPEED, PLAY_ON_CATCH_R, SHOOT_ALWAYS_M, LAY_OFF_FULL_M, MAX_LAY_OFFS, playOnWanted, playOnReceiver, supportRunTarget, startPlayOn, layOffChance, moveToward, stepPlayOn, LAY_OFF_LANE_M, layOffAim, laneClear, playLayOff, CARRY_TOUCH_S, CARRY_MIN_S, CARRY_MAX_S, CARRY_PASS_SPEED, CARRY_LOFT_M, CARRY_RUN_AVG, carryFrom, carryOnLeadIn, STICK_OPEN_M, THROUGH_RUN_MS, THROUGH_SPACE_M, STICK_CATCH_R, STICK_PASS_MIN_M, STICK_PASS_MAX_M, STICK_WAIT_S, STICK_WAIT_BELOW, FIRST_TIME_MAX_M, FIRST_TIME_MIN_VALUE, FIRST_TIME_TIGHT_M, FIRST_TIME_SCREEN_M, STICK_TOUCH_T, STICK_SCRAMBLE_T, STICK_CARRY_FROM_M, STICK_CARRY_T, STICK_DEVELOP_BELOW, STICK_PASS_MAX_FEET, STICK_PASS_MAX_THROUGH, stickShotIsOn, stickReception, playOnStickWanted, startPlayOnStick, steerPlayOn, callForIt, moveOnStick, shotValue, passSpeedFor, throughPoint, nobodyNear, stickRead, bestPass, gauss, playPassTo, stepPlayOnStick, callForItShown
	local AUTO_AFTER_S, AUTO_RETARGET_S, AUTO_SPRINT_M, AUTO_SPRINT_BAR, runAfterWanted, startPlayOnRun, sprintPlayOn, moveRun, autoPush, pickRunSpot, runPassBias
	playOnWanted = function(o)
		do return ((((o.newChances and o.hadBuildUp) and (not o.auto)) and (not o.youShotAtGoal)) and M_canvasEngine.goalInView(o.kind)) end
	end
	exports.playOnWanted = playOnWanted
	playOnReceiver = function(rng)
		do return Js.O({ skill = (58 + (rng() * 26)), roleLabel = "the striker" }, { "skill", "roleLabel" }) end
	end
	exports.playOnReceiver = playOnReceiver
	supportRunTarget = function(sc, passTo)
		local ref = (if passTo ~= nil then passTo else sc.ball)
		local gcx = (function() local _l = ((sc.goal.x1 + sc.goal.x2) / 2); if Js.T(_l) then return _l end; return M_pitch.CX end)()
		local across = Math.max(-7, Math.min(7, (((gcx - ref.x) * 0.45) + (if (ref.x < gcx) then 3.5 else -3.5))))
		local y = Math.min((sc.player.y - 2), Math.max((M_pitch.PEN_SPOT_Y - 3), (M_pitch.PEN_SPOT_Y + 1)))
		do return Js.O({ x = (gcx + across), y = Math.max(6, y) }, { "x", "y" }) end
	end
	exports.supportRunTarget = supportRunTarget
	startPlayOn = function(sc, rng, passTo)
		Js.del(sc, "matePace")
		if (not sc.receiver) then
			sc.receiver = playOnReceiver(rng)
		end
		do return Js.O({ target = supportRunTarget(sc, passTo), layOff = nil, layOffLive = false }, { "target", "layOff", "layOffLive" }) end
	end
	exports.startPlayOn = startPlayOn
	layOffChance = function(sc, at)
		local gcx = (function() local _l = ((sc.goal.x1 + sc.goal.x2) / 2); if Js.T(_l) then return _l end; return M_pitch.CX end)()
		local dGoal = Math.hypot((at.x - gcx), at.y)
		local far = Math.max(0, Math.min(1, ((dGoal - SHOOT_ALWAYS_M) / (LAY_OFF_FULL_M - SHOOT_ALWAYS_M))))
		if (function() local _v = sc.receivedBy; if _v == nil then return nil end; _v = _v.shortOption; return _v end)() then
			do return 0 end
		end
		do return (M_canvasEngine.chainReturnChance(sc) * far) end
	end
	exports.layOffChance = layOffChance
	moveToward = function(p, to, step)
		local dx = (to.x - p.x)
		local dy = (to.y - p.y)
		local d = Math.hypot(dx, dy)
		if (d < 0.000001) then
			do return end
		end
		local k = Math.min(1, (step / d))
		p.x += (dx * k)
		p.y += (dy * k)
	end
	stepPlayOn = function(st, sc, ball, dt, rng, layOffsLeft)
		if st.stick then
			do return stepPlayOnStick(st, st.stick, sc, ball, dt, rng, layOffsLeft) end
		end
		local p = sc.player
		if st.layOffLive then
			local lead = Js.O({ x = (ball.pos.x + (ball.vel.x * 0.25)), y = (ball.pos.y + (ball.vel.y * 0.25)) }, { "x", "y" })
			moveToward(p, lead, ((PLAY_ON_RUN_SPEED * 1.1) * dt))
			if (((ball.contactCd <= 0) and (ball.z < 1)) and (Math.hypot((ball.pos.x - p.x), (ball.pos.y - p.y)) < PLAY_ON_CATCH_R)) then
				do return "caught" end
			end
			if (((ball.owner ~= "mate") or sc.receiverDone) or ball.shot) then
				st.layOffLive = false
			end
			do return nil end
		end
		moveToward(p, st.target, (PLAY_ON_RUN_SPEED * dt))
		if (((sc.receiverDone and (ball.receiverControlT > 0)) and (not sc.relayTo)) and (not sc.relayToFollower)) then
			if (st.layOff == nil) then
				local at = (if sc.receivedAt ~= nil then sc.receivedAt else ball.pos)
				st.layOff = (((layOffsLeft > 0) and laneClear(sc, at, layOffAim(st, sc))) and (rng() < layOffChance(sc, at)))
			end
			if (st.layOff and (ball.receiverControlT <= (dt + 1e-9))) then
				if laneClear(sc, ball.pos, layOffAim(st, sc)) then
					playLayOff(st, sc, ball)
				else
					st.layOff = false
				end
			end
		end
		do return nil end
	end
	exports.stepPlayOn = stepPlayOn
	layOffAim = function(st, sc)
		local p = sc.player
		local dir = Js.O({ x = (st.target.x - p.x), y = (st.target.y - p.y) }, { "x", "y" })
		local dl = Math.hypot(dir.x, dir.y)
		if (dl < 0.5) then
			do return Js.O({ x = p.x, y = p.y }, { "x", "y" }) end
		end
		local k = (Math.min(dl, (PLAY_ON_RUN_SPEED * 0.5)) / dl)
		do return Js.O({ x = (p.x + (dir.x * k)), y = (p.y + (dir.y * k)) }, { "x", "y" }) end
	end
	laneClear = function(sc, a, b)
		local dx = (b.x - a.x)
		local dy = (b.y - a.y)
		local L2 = ((dx * dx) + (dy * dy))
		if (L2 < 1) then
			do return true end
		end
		local L = Math.sqrt(L2)
		do return A.every(sc.defenders, function(d)
			local u = ((((d.x - a.x) * dx) + ((d.y - a.y) * dy)) / L2)
			if (((u * L) < 2) or (u > 1.05)) then
				do return true end
			end
			local cx = (a.x + (dx * u))
			local cy = (a.y + (dy * u))
			do return (Math.hypot((d.x - cx), (d.y - cy)) >= LAY_OFF_LANE_M) end
		end) end
	end
	exports.laneClear = laneClear
	playLayOff = function(st, sc, ball)
		local from = Js.O({ x = ball.pos.x, y = ball.pos.y }, { "x", "y" })
		local ahead = layOffAim(st, sc)
		local dx = (ahead.x - from.x)
		local dy = (ahead.y - from.y)
		local d = (function() local _l = Math.hypot(dx, dy); if Js.T(_l) then return _l end; return 1 end)()
		local speed = Math.max(13, Math.min(21, (11 + (d * 0.45))))
		ball.receiverControlT = 0
		ball.vel = Js.O({ x = ((dx / d) * speed), y = ((dy / d) * speed) }, { "x", "y" })
		ball.vz = 0
		ball.z = 0.08
		ball.spin = 0
		ball.loose = false
		ball.resting = false
		ball.restT = 0
		ball.shot = false
		ball.owner = "mate"
		ball.lastTouch = "attack"
		ball.contactCd = 0.2
		local list = M_canvasEngine.orderableRunners(sc)
		local i = (if sc.receivedBy then A.indexOf(list, sc.receivedBy) else -1)
		M_canvasEngine.logBallAction(ball, Js.O({ kind = "pass", actor = (if (i >= 0) then ("run" .. Js.numstr(i)) else "follower"), mode = "ground", at = Js.O({ x = from.x, y = from.y, z = ball.z }, { "x", "y", "z" }) }, { "kind", "actor", "mode", "at" }))
		sc.relayed = true
		sc.receiverDone = false
		st.layOffLive = true
	end
	carryFrom = function(sc, ball)
		local mates = Js.alit()
		if sc.runner then
			A.push(mates, Js.ospread(sc.runner.pos))
		end
		do
			local _arr1 = sc.secondaryRunners
			local _i2 = 0
			while _i2 < Js.alen(_arr1) do
				_i2 += 1
				local r = _arr1[_i2]
				A.push(mates, Js.ospread(r.pos))
			end
		end
		do
			local _arr3 = sc.teammates
			local _i4 = 0
			while _i4 < Js.alen(_arr3) do
				_i4 += 1
				local m = _arr3[_i4]
				A.push(mates, Js.O({ x = m.x, y = m.y }, { "x", "y" }))
			end
		end
		local bi = -1
		local bd = 3
		A.forEach(mates, function(p, i)
			local d = Math.hypot((p.x - ball.x), (p.y - ball.y))
			if (d < bd) then
				bd = d
				bi = i
			end
		end)
		if (bi >= 0) then
			A.splice(mates, bi, 1)
		end
		do return Js.O({ ball = Js.ospread(ball), you = Js.ospread(sc.player), mates = mates, opps = A.map(sc.defenders, function(d)
			return Js.O({ x = d.x, y = d.y }, { "x", "y" })
		end) }, { "ball", "you", "mates", "opps" }) end
	end
	exports.carryFrom = carryFrom
	carryOnLeadIn = function(sc, from)
		local passD = Math.hypot((sc.ball.x - from.ball.x), (sc.ball.y - from.ball.y))
		local durS = Math.max(CARRY_MIN_S, Math.min(CARRY_MAX_S, ((CARRY_TOUCH_S + (passD / CARRY_PASS_SPEED)) + 0.15)))
		local arrive = (durS - 0.1)
		local run = (CARRY_RUN_AVG * durS)
		local reach = function(p, to)
			local d = Math.hypot((p.x - to.x), (p.y - to.y))
			if (d <= run) then
				do return Js.ospread(p) end
			end
			local k = (run / d)
			do return Js.O({ x = (to.x + ((p.x - to.x) * k)), y = (to.y + ((p.y - to.y) * k)) }, { "x", "y" }) end
		end
		local ents = M_leadIn.leadInEntities(sc)
		local starts = Js.Map.new()
		local pair = function(side, pool)
			local left = A.map(pool, function(p)
				return Js.ospread(p)
			end)
			local want = A.filter(ents, function(e)
				return (e.side == side)
			end)
			do
				local _arr5 = want
				local _i6 = 0
				while _i6 < Js.alen(_arr5) do
					_i6 += 1
					local e = _arr5[_i6]
					if (not Js.T(Js.alen(left))) then
						do break end
					end
					local to = e.get()
					local bi = 0
					local bd = math.huge
					A.forEach(left, function(p, i)
						local dd = Math.hypot((p.x - to.x), (p.y - to.y))
						if (dd < bd) then
							bd = dd
							bi = i
						end
					end)
					starts:set(e.key, reach(left[bi + 1], to))
					A.splice(left, bi, 1)
				end
			end
		end
		pair("mate", from.mates)
		pair("opp", from.opps)
		local youEnd = sc.player
		starts:set("you", reach(from.you, youEnd))
		local ends = Js.Map.new(A.map(ents, function(e)
			return Js.alit(e.key, e.get())
		end))
		local ease = function(f)
			local c = Math.max(0, Math.min(1, f))
			do return ((0.5 * c) + (((0.5 * c) * c) * (3 - (2 * c)))) end
		end
		local passer0 = Js.ospread(from.ball)
		local fwd = Js.O({ x = (sc.ball.x - passer0.x), y = (sc.ball.y - passer0.y) }, { "x", "y" })
		local fl = (function() local _l = Math.hypot(fwd.x, fwd.y); if Js.T(_l) then return _l end; return 1 end)()
		local passer1 = Js.O({ x = (passer0.x + ((fwd.x / fl) * 3)), y = (passer0.y + ((fwd.y / fl) * 3)) }, { "x", "y" })
		local lofted = (passD > CARRY_LOFT_M)
		local keys = Js.alit(Js.O({ t = 0, p = Js.ospread(from.ball) }, { "t", "p" }), Js.O({ t = CARRY_TOUCH_S, p = Js.ospread(from.ball) }, { "t", "p" }), Js.O({ t = arrive, p = Js.O({ x = sc.ball.x, y = sc.ball.y }, { "x", "y" }), pass = Js.O({ h = (if lofted then (passD * 0.1) else 0) }, { "h" }) }, { "t", "p", "pass" }))
		do return Js.O({ durS = durS, ballAt = function(t)
			return M_leadIn.ballAlong(keys, Math.min(t, arrive))
		end, posAt = function(key, t)
			if (key == "extra0") then
				local g = ease(((t - CARRY_TOUCH_S) / Math.max(0.01, (durS - CARRY_TOUCH_S))))
				do return Js.O({ x = (passer0.x + ((passer1.x - passer0.x) * g)), y = (passer0.y + ((passer1.y - passer0.y) * g)) }, { "x", "y" }) end
			end
			local s = starts:get(key)
			local e = ends:get(key)
			if ((not s) or (not e)) then
				do return nil end
			end
			local g = ease((t / durS))
			do return Js.O({ x = (s.x + ((e.x - s.x) * g)), y = (s.y + ((e.y - s.y) * g)) }, { "x", "y" }) end
		end, extraMates = 1, passStart = Js.alit(CARRY_TOUCH_S), passEnd = Js.alit(arrive), skippable = true }, { "durS", "ballAt", "posAt", "extraMates", "passStart", "passEnd", "skippable" }) end
	end
	exports.carryOnLeadIn = carryOnLeadIn
	stickShotIsOn = function(sc, at)
		local gcx = (function() local _l = ((sc.goal.x1 + sc.goal.x2) / 2); if Js.T(_l) then return _l end; return M_pitch.CX end)()
		if (Math.hypot((at.x - gcx), at.y) > FIRST_TIME_MAX_M) then
			do return false end
		end
		if (shotValue(sc, at) < FIRST_TIME_MIN_VALUE) then
			do return false end
		end
		do
			local _arr7 = sc.defenders
			local _i8 = 0
			while _i8 < Js.alen(_arr7) do
				_i8 += 1
				local d = _arr7[_i8]
				local dx = (d.x - at.x)
				local dy = (d.y - at.y)
				if (Math.hypot(dx, dy) < FIRST_TIME_TIGHT_M) then
					do return false end
				end
				if (((dy < 0) and (dy > (-FIRST_TIME_SCREEN_M))) and (math.abs(dx) < 1.6)) then
					do return false end
				end
			end
		end
		do return true end
	end
	exports.stickShotIsOn = stickShotIsOn
	stickReception = function(sc, at, _mode, scrambled)
		if stickShotIsOn(sc, at) then
			do return Js.O({ firstTime = true, holdT = 0, carryT = 0 }, { "firstTime", "holdT", "carryT" }) end
		end
		local gcx = (function() local _l = ((sc.goal.x1 + sc.goal.x2) / 2); if Js.T(_l) then return _l end; return M_pitch.CX end)()
		local far = (Math.hypot((at.x - gcx), at.y) > STICK_CARRY_FROM_M)
		local space = nobodyNear(sc, at, 4)
		do return Js.O({ firstTime = false, holdT = (if scrambled then STICK_SCRAMBLE_T else STICK_TOUCH_T), carryT = (if ((far and space) and (not scrambled)) then STICK_CARRY_T else 0) }, { "firstTime", "holdT", "carryT" }) end
	end
	exports.stickReception = stickReception
	playOnStickWanted = function(o)
		do return (((((o.newChances and o.stick) and (not o.auto)) and (not o.youShotAtGoal)) and M_canvasEngine.goalInView(o.kind)) and M_canvasEngine.acceptsCaptainOrders(o.kind)) end
	end
	exports.playOnStickWanted = playOnStickWanted
	startPlayOnStick = function(sc, rng, passTo, run)
		if run == nil then run = PLAY_ON_RUN_SPEED end
		if (not sc.receiver) then
			sc.receiver = playOnReceiver(rng)
		end
		sc.matePace = "stick"
		M_canvasEngine.setMateReceptionRule(stickReception)
		do return Js.O({ target = supportRunTarget(sc, passTo), layOff = nil, layOffLive = false, stick = Js.O({ push = Js.O({ x = 0, y = 0 }, { "x", "y" }), vel = Js.O({ x = 0, y = 0 }, { "x", "y" }), run = run, called = false, choice = nil, passTo = nil, note = nil, read = nil }, { "push", "vel", "run", "called", "choice", "passTo", "note", "read" }) }, { "target", "layOff", "layOffLive", "stick" }) end
	end
	exports.startPlayOnStick = startPlayOnStick
	steerPlayOn = function(st, x, y)
		if (not st.stick) then
			do return end
		end
		local mx = (if Js.NumberNS.isFinite(x) then x else 0)
		local my = (if Js.NumberNS.isFinite(y) then y else 0)
		local m = Math.hypot(mx, my)
		if (m > 1) then
			mx /= m
			my /= m
		end
		st.stick.push = Js.O({ x = mx, y = my }, { "x", "y" })
	end
	exports.steerPlayOn = steerPlayOn
	callForIt = function(st, sc)
		local stk = st.stick
		if (not stk) then
			do return "late" end
		end
		if st.layOffLive then
			do return "coming" end
		end
		if (sc.receiverShot or ((stk.choice == "shoot") and (not sc.receiverDone))) then
			do return "late" end
		end
		stk.called = true
		do return "calling" end
	end
	exports.callForIt = callForIt
	moveOnStick = function(stk, p, dt)
		local mag = Math.hypot(stk.push.x, stk.push.y)
		local want = M_firstPersonDribble.stickSpeed(mag, stk.run)
		local ux = (if (mag > 0.000001) then (stk.push.x / mag) else 0)
		local uy = (if (mag > 0.000001) then (stk.push.y / mag) else 0)
		local tvx = (want * ux)
		local tvy = (want * uy)
		local cur = Math.hypot(stk.vel.x, stk.vel.y)
		local rate = ((if (want > cur) then (stk.run / M_firstPersonDribble.STICK_UP_T) else (stk.run / M_firstPersonDribble.STICK_DOWN_T)) * dt)
		local dvx = (tvx - stk.vel.x)
		local dvy = (tvy - stk.vel.y)
		local dv = Math.hypot(dvx, dvy)
		if (dv > rate) then
			dvx *= (rate / dv)
			dvy *= (rate / dv)
		end
		stk.vel.x += dvx
		stk.vel.y += dvy
		p.x = Math.max(-2, Math.min(70, (p.x + (stk.vel.x * dt))))
		p.y = Math.max(-2, Math.min(106, (p.y + (stk.vel.y * dt))))
	end
	exports.moveOnStick = moveOnStick
	shotValue = function(sc, p)
		if (p.y <= 0.3) then
			do return 0 end
		end
		local gx1 = sc.goal.x1
		local gx2 = sc.goal.x2
		local gcx = (function() local _l = ((gx1 + gx2) / 2); if Js.T(_l) then return _l end; return M_pitch.CX end)()
		local open = math.abs((Math.atan2((gx2 - p.x), p.y) - Math.atan2((gx1 - p.x), p.y)))
		local d = Math.hypot((p.x - gcx), p.y)
		local v = ((open / 0.64) * Math.exp(((-(Math.max(0, (d - 11)))) / 14)))
		local dx = (gcx - p.x)
		local dy = (-p.y)
		local L2 = ((dx * dx) + (dy * dy))
		do
			local _arr9 = sc.defenders
			local _i10 = 0
			while _i10 < Js.alen(_arr9) do
				_i10 += 1
				local df = _arr9[_i10]
				local u = ((((df.x - p.x) * dx) + ((df.y - p.y) * dy)) / L2)
				if ((u <= 0.03) or (u >= 1)) then
					do continue end
				end
				if (Math.hypot((df.x - (p.x + (dx * u))), (df.y - (p.y + (dy * u)))) < 1.4) then
					v *= 0.65
				end
			end
		end
		do return Math.max(0, Math.min(1, v)) end
	end
	exports.shotValue = shotValue
	passSpeedFor = function(d, through)
		do return (if through then Math.max(13, Math.min(STICK_PASS_MAX_THROUGH, (11 + (d * 0.45)))) else Math.max(12, Math.min(STICK_PASS_MAX_FEET, (10 + (d * 0.4))))) end
	end
	throughPoint = function(at, you, vel)
		local sp = (function() local _l = Math.hypot(vel.x, vel.y); if Js.T(_l) then return _l end; return 1 end)()
		local lead = Js.O({ x = you.x, y = you.y }, { "x", "y" })
		for i = 0, 3 do
			local d = Math.hypot((lead.x - at.x), (lead.y - at.y))
			local T = ((d / passSpeedFor(d, true)) + 0.15)
			lead = Js.O({ x = ((you.x + (vel.x * T)) + (vel.x / sp)), y = ((you.y + (vel.y * T)) + (vel.y / sp)) }, { "x", "y" })
		end
		do return lead end
	end
	exports.throughPoint = throughPoint
	nobodyNear = function(sc, p, r)
		do return A.every(sc.defenders, function(d)
			return (Math.hypot((d.x - p.x), (d.y - p.y)) >= r)
		end) end
	end
	stickRead = function(sc, at, you, vel)
		local gcx = (function() local _l = ((sc.goal.x1 + sc.goal.x2) / 2); if Js.T(_l) then return _l end; return M_pitch.CX end)()
		local his = shotValue(sc, at)
		local dist = function(q)
			return Math.hypot((q.x - at.x), (q.y - at.y))
		end
		local inRange = function(q)
			return ((dist(q) >= STICK_PASS_MIN_M) and (dist(q) <= STICK_PASS_MAX_M))
		end
		local onside = (not M_canvasEngine.offsideAt(sc, you, at))
		local feet = nil
		if (((onside and inRange(you)) and nobodyNear(sc, you, STICK_OPEN_M)) and laneClear(sc, at, you)) then
			feet = (shotValue(sc, you) * 0.85)
		end
		local through = nil
		local throughAt = nil
		local g = Js.O({ x = (gcx - you.x), y = (-you.y) }, { "x", "y" })
		local gl = (function() local _l = Math.hypot(g.x, g.y); if Js.T(_l) then return _l end; return 1 end)()
		local runIn = (((vel.x * g.x) + (vel.y * g.y)) / gl)
		if (onside and (runIn >= THROUGH_RUN_MS)) then
			local lead = throughPoint(at, you, vel)
			local kd = Math.hypot((sc.keeper.x - lead.x), (sc.keeper.y - lead.y))
			if (((((((lead.y > 1.5) and (lead.x > 0.5)) and (lead.x < 67.5)) and inRange(lead)) and (kd > 2.5)) and nobodyNear(sc, lead, THROUGH_SPACE_M)) and laneClear(sc, at, lead)) then
				through = shotValue(sc, lead)
				throughAt = lead
			end
		end
		local best = Math.max((if feet ~= nil then feet else -1), (if through ~= nil then through else -1))
		local q = M_canvasEngine.passQuality(sc)
		local pPass = (if (best < 0) then 0 else (Math.max(0, Math.min(0.92, ((((best - his) / Math.max(0.05, his)) * 0.9) + 0.25))) * (0.55 + (0.45 * q))))
		do return Js.O({ his = his, feet = feet, through = through, throughAt = throughAt, pPass = pPass }, { "his", "feet", "through", "throughAt", "pPass" }) end
	end
	exports.stickRead = stickRead
	bestPass = function(r)
		if ((r.feet == nil) and (r.through == nil)) then
			do return nil end
		end
		do return (if ((if r.through ~= nil then r.through else -1) >= (if r.feet ~= nil then r.feet else -1)) then "through" else "feet") end
	end
	gauss = function(rng)
		local u = Math.max(1e-9, rng())
		local v = rng()
		do return (Math.sqrt((-2 * Math.log(u))) * Math.cos(((2 * Math.PI) * v))) end
	end
	playPassTo = function(st, stk, sc, ball, to, through, rng)
		local from = Js.O({ x = ball.pos.x, y = ball.pos.y }, { "x", "y" })
		local dx = (to.x - from.x)
		local dy = (to.y - from.y)
		local d = (function() local _l = Math.hypot(dx, dy); if Js.T(_l) then return _l end; return 1 end)()
		local q = M_canvasEngine.passQuality(sc)
		local err = (((gauss(rng) * (1 - q)) * 5) * (Math.PI / 180))
		local c = Math.cos(err)
		local s = Math.sin(err)
		local ux = (((dx / d) * c) - ((dy / d) * s))
		local uy = (((dx / d) * s) + ((dy / d) * c))
		local speed = (passSpeedFor(d, through) * (1 + ((gauss(rng) * (1 - q)) * 0.06)))
		ball.receiverControlT = 0
		ball.vel = Js.O({ x = (ux * speed), y = (uy * speed) }, { "x", "y" })
		ball.vz = 0
		ball.z = 0.08
		ball.spin = 0
		ball.loose = false
		ball.resting = false
		ball.restT = 0
		ball.shot = false
		ball.owner = "mate"
		ball.lastTouch = "attack"
		ball.contactCd = 0.2
		local list = M_canvasEngine.orderableRunners(sc)
		local i = (if sc.receivedBy then A.indexOf(list, sc.receivedBy) else -1)
		M_canvasEngine.logBallAction(ball, Js.O({ kind = "pass", actor = (if (i >= 0) then ("run" .. Js.numstr(i)) else "follower"), mode = "ground", at = Js.O({ x = from.x, y = from.y, z = ball.z }, { "x", "y", "z" }) }, { "kind", "actor", "mode", "at" }))
		sc.relayed = true
		sc.receiverDone = false
		stk.passTo = Js.ospread(to)
		st.layOffLive = true
	end
	stepPlayOnStick = function(st, stk, sc, ball, dt, rng, layOffsLeft)
		local p = sc.player
		if stk.legs then
			moveRun(st, stk, stk.legs, sc, ball, dt)
		else
			moveOnStick(stk, p, dt)
		end
		if st.layOffLive then
			if (((ball.contactCd <= 0) and (ball.z < 1)) and (Math.hypot((ball.pos.x - p.x), (ball.pos.y - p.y)) < STICK_CATCH_R)) then
				do return "caught" end
			end
			if (((ball.owner ~= "mate") or sc.receiverDone) or ball.shot) then
				st.layOffLive = false
			end
			do return nil end
		end
		if (stk.called and sc.receiverShot) then
			stk.note = "late"
			stk.called = false
		end
		if (((stk.passTo or (not (sc.receiverDone and (ball.receiverControlT > 0)))) or sc.relayTo) or sc.relayToFollower) then
			do return nil end
		end
		local at = (if sc.receivedAt ~= nil then sc.receivedAt else ball.pos)
		if (stk.read == nil) then
			local r = stickRead(sc, at, p, stk.vel)
			stk.read = r
			local gcx = (function() local _l = ((sc.goal.x1 + sc.goal.x2) / 2); if Js.T(_l) then return _l end; return M_pitch.CX end)()
			local g = Js.O({ x = (gcx - p.x), y = (-p.y) }, { "x", "y" })
			local gl = (function() local _l = Math.hypot(g.x, g.y); if Js.T(_l) then return _l end; return 1 end)()
			local runIn = (((stk.vel.x * g.x) + (stk.vel.y * g.y)) / gl)
			if ((((layOffsLeft > 0) and ((runIn >= THROUGH_RUN_MS) or stk.called)) and (not M_canvasEngine.offsideAt(sc, p, at))) and (r.his < STICK_WAIT_BELOW)) then
				ball.receiverControlT += STICK_WAIT_S
			end
		end
		if (ball.receiverControlT <= (dt + 1e-9)) then
			local r = stickRead(sc, ball.pos, p, stk.vel)
			stk.read = r
			local pick = bestPass(r)
			local go = nil
			if ((layOffsLeft > 0) and stk.called) then
				if Js.T(pick) then
					go = pick
				else
					stk.note = "noLane"
				end
				stk.called = false
			elseif (((layOffsLeft > 0) and Js.T(pick)) and (rng() < (r.pPass * (if stk.legs then runPassBias(M_canvasEngine.passQuality(sc)) else 1)))) then
				go = pick
			end
			local gcx = (function() local _l = ((sc.goal.x1 + sc.goal.x2) / 2); if Js.T(_l) then return _l end; return M_pitch.CX end)()
			if Js.T(go) then
				stk.choice = go
				playPassTo(st, stk, sc, ball, (if (go == "through") then r.throughAt else Js.O({ x = p.x, y = p.y }, { "x", "y" })), (go == "through"), rng)
			elseif ((((not stk.developed) and (r.his < STICK_DEVELOP_BELOW)) and (Math.hypot((ball.pos.x - gcx), ball.pos.y) > 16)) and nobodyNear(sc, ball.pos, 3)) then
				stk.developed = true
				ball.carryT = STICK_CARRY_T
				ball.receiverControlT = 0.3
			else
				stk.choice = "shoot"
			end
		end
		do return nil end
	end
	callForItShown = function(o)
		do return ((o.captain and o.stickLive) and (not o.layOffLive)) end
	end
	exports.callForItShown = callForItShown
	runAfterWanted = function(o)
		do return ((((not o.auto) and (not o.youShotAtGoal)) and M_canvasEngine.goalInView(o.kind)) and M_canvasEngine.acceptsCaptainOrders(o.kind)) end
	end
	exports.runAfterWanted = runAfterWanted
	startPlayOnRun = function(sc, rng, passTo, o)
		if o == nil then o = Js.O({}, nil) end
		if (not sc.receiver) then
			sc.receiver = playOnReceiver(rng)
		end
		Js.del(sc, "matePace")
		if o.stick then
			sc.matePace = "stick"
			M_canvasEngine.setMateReceptionRule(stickReception)
		end
		local legs = M_legs.newLegs(Js.O({ pace = o.pace, physical = o.physical, energy = o.energy, bar = o.bar }, { "pace", "physical", "energy", "bar" }))
		do return Js.O({ target = supportRunTarget(sc, passTo), layOff = nil, layOffLive = false, stick = Js.O({ push = Js.O({ x = 0, y = 0 }, { "x", "y" }), vel = legs.vel, run = legs.speeds.run, called = false, choice = nil, passTo = nil, note = nil, read = nil, legs = legs, sprintHeld = false, auto = true, thumb = (not (not o.stick)), held = false, idleT = AUTO_AFTER_S, autoOn = false, autoTarget = nil, retargetT = 0, mateAt = (if passTo then Js.ospread(passTo) else nil) }, { "push", "vel", "run", "called", "choice", "passTo", "note", "read", "legs", "sprintHeld", "auto", "thumb", "held", "idleT", "autoOn", "autoTarget", "retargetT", "mateAt" }) }, { "target", "layOff", "layOffLive", "stick" }) end
	end
	exports.startPlayOnRun = startPlayOnRun
	sprintPlayOn = function(st, held)
		if st.stick then
			st.stick.sprintHeld = held
		end
	end
	exports.sprintPlayOn = sprintPlayOn
	moveRun = function(st, stk, legs, sc, ball, dt)
		if stk.kicking then
			legs.vel = Js.O({ x = 0, y = 0 }, { "x", "y" })
			legs.sprinting = false
			stk.vel = legs.vel
			stk.autoOn = false
			do return end
		end
		local push = stk.push
		local sprint = (not (not stk.sprintHeld))
		local steering = ((Math.hypot(push.x, push.y) > 0.08) or (not (not stk.held)))
		stk.idleT = (if steering then 0 else ((if stk.idleT ~= nil then stk.idleT else 0) + dt))
		stk.autoOn = false
		if ((stk.auto and (not steering)) and ((if stk.idleT ~= nil then stk.idleT else 0) >= AUTO_AFTER_S)) then
			local a = autoPush(st, stk, legs, sc, ball, dt)
			push = a.push
			sprint = (sprint or a.sprint)
			stk.autoOn = true
		end
		M_legs.stepLegs(legs, sc.player, push, sprint, dt)
		stk.vel = legs.vel
	end
	autoPush = function(st, stk, legs, sc, ball, dt)
		local p = sc.player
		if st.layOffLive then
			local lead = Js.O({ x = (ball.pos.x + (ball.vel.x * 0.25)), y = (ball.pos.y + (ball.vel.y * 0.25)) }, { "x", "y" })
			local dx = (lead.x - p.x)
			local dy = (lead.y - p.y)
			local d = (function() local _l = Math.hypot(dx, dy); if Js.T(_l) then return _l end; return 1 end)()
			do return Js.O({ push = Js.O({ x = (dx / d), y = (dy / d) }, { "x", "y" }), sprint = true }, { "push", "sprint" }) end
		end
		stk.retargetT = ((if stk.retargetT ~= nil then stk.retargetT else 0) - dt)
		if ((not stk.autoTarget) or (stk.retargetT <= 0)) then
			local mate = ((if sc.receivedAt ~= nil then sc.receivedAt else stk.mateAt) or ball.pos)
			stk.autoTarget = pickRunSpot(sc, p, mate, (if stk.autoTarget ~= nil then stk.autoTarget else nil))
			stk.retargetT = AUTO_RETARGET_S
		end
		local t = stk.autoTarget
		local dx = (t.x - p.x)
		local dy = (t.y - p.y)
		local d = Math.hypot(dx, dy)
		if (d < 0.8) then
			do return Js.O({ push = Js.O({ x = 0, y = 0 }, { "x", "y" }), sprint = false }, { "push", "sprint" }) end
		end
		local mag = (if (d > 2.5) then 1 else 0.6)
		do return Js.O({ push = Js.O({ x = ((dx / d) * mag), y = ((dy / d) * mag) }, { "x", "y" }), sprint = ((d > AUTO_SPRINT_M) and (legs.stamina.v > AUTO_SPRINT_BAR)) }, { "push", "sprint" }) end
	end
	pickRunSpot = function(sc, you, ballAt, prev)
		local gcx = (function() local _l = ((sc.goal.x1 + sc.goal.x2) / 2); if Js.T(_l) then return _l end; return M_pitch.CX end)()
		local mates = Js.aspread((if sc.runner then Js.alit(sc.runner.pos) else Js.alit()), A.map(sc.secondaryRunners, function(r)
			return r.pos
		end), Js.alit(Js.O({ x = sc.follower.x, y = sc.follower.y }, { "x", "y" })))
		local best = nil
		local bestS = (-math.huge)
		do
			local gy = 5
			local _first11 = true
			while true do
				if not _first11 then
					gy += 2.5
				end
				_first11 = false
				if not (gy <= 32) then break end
				if (gy > (you.y + 1)) then
					do break end
				end
				do
					local gx = -15
					local _first12 = true
					while true do
						if not _first12 then
							gx += 3
						end
						_first12 = false
						if not (gx <= 15) then break end
						local q = Js.O({ x = (gcx + gx), y = gy }, { "x", "y" })
						local dist = Math.hypot((q.x - you.x), (q.y - you.y))
						if (dist > 22) then
							do continue end
						end
						if (M_canvasEngine.offsideAt(sc, q, ballAt) or M_canvasEngine.offsideAt(sc, Js.O({ x = q.x, y = (q.y - 1) }, { "x", "y" }), ballAt)) then
							do continue end
						end
						local room = 6
						do
							local _arr13 = sc.defenders
							local _i14 = 0
							while _i14 < Js.alen(_arr13) do
								_i14 += 1
								local d = _arr13[_i14]
								room = Math.min(room, Math.hypot((d.x - q.x), (d.y - q.y)))
							end
						end
						local s = ((shotValue(sc, q) + ((room / 6) * 0.35)) - (dist / 30))
						if laneClear(sc, ballAt, q) then
							s += 0.15
						end
						if A.some(mates, function(m)
							return (Math.hypot((m.x - q.x), (m.y - q.y)) < 3.5)
						end) then
							s -= 0.25
						end
						if (Math.hypot((ballAt.x - q.x), (ballAt.y - q.y)) < 5) then
							s -= 0.3
						end
						if (prev and (Math.hypot((prev.x - q.x), (prev.y - q.y)) < 2)) then
							s += 0.05
						end
						if (s > bestS) then
							bestS = s
							best = q
						end
					end
				end
			end
		end
		if best then
			do return best end
		end
		if (Math.hypot((ballAt.x - gcx), ballAt.y) < 18) then
			do return Js.O({ x = you.x, y = you.y }, { "x", "y" }) end
		end
		local ys = A.map(sc.defenders, function(d)
			return d.y
		end)
		A.push(ys, sc.keeper.y)
		A.sort(ys, function(a, b)
			return (a - b)
		end)
		local line = Math.min(ballAt.y, (if (Js.alen(ys) > 1) then ys[2] else (if ys[1] ~= nil then ys[1] else 0)))
		do return Js.O({ x = you.x, y = Math.max(you.y, (line + 1)) }, { "x", "y" }) end
	end
	exports.pickRunSpot = pickRunSpot
	runPassBias = function(q)
		do return Math.max(0.45, Math.min(1.2, (0.5 + (1.25 * (q - 0.4))))) end
	end
	exports.runPassBias = runPassBias
	PLAY_ON_RUN_SPEED = 6.6
	exports.PLAY_ON_RUN_SPEED = PLAY_ON_RUN_SPEED
	PLAY_ON_CATCH_R = 1.3
	exports.PLAY_ON_CATCH_R = PLAY_ON_CATCH_R
	SHOOT_ALWAYS_M = 14
	exports.SHOOT_ALWAYS_M = SHOOT_ALWAYS_M
	LAY_OFF_FULL_M = 26
	exports.LAY_OFF_FULL_M = LAY_OFF_FULL_M
	MAX_LAY_OFFS = 1
	exports.MAX_LAY_OFFS = MAX_LAY_OFFS
	LAY_OFF_LANE_M = 2.6
	exports.LAY_OFF_LANE_M = LAY_OFF_LANE_M
	CARRY_TOUCH_S = 0.25
	exports.CARRY_TOUCH_S = CARRY_TOUCH_S
	CARRY_MIN_S = 1
	exports.CARRY_MIN_S = CARRY_MIN_S
	CARRY_MAX_S = 2.6
	exports.CARRY_MAX_S = CARRY_MAX_S
	CARRY_PASS_SPEED = 16
	exports.CARRY_PASS_SPEED = CARRY_PASS_SPEED
	CARRY_LOFT_M = 30
	exports.CARRY_LOFT_M = CARRY_LOFT_M
	CARRY_RUN_AVG = 7
	exports.CARRY_RUN_AVG = CARRY_RUN_AVG
	STICK_OPEN_M = 2.5
	exports.STICK_OPEN_M = STICK_OPEN_M
	THROUGH_RUN_MS = 3
	exports.THROUGH_RUN_MS = THROUGH_RUN_MS
	THROUGH_SPACE_M = 2.5
	exports.THROUGH_SPACE_M = THROUGH_SPACE_M
	STICK_CATCH_R = (PLAY_ON_CATCH_R + 0.3)
	exports.STICK_CATCH_R = STICK_CATCH_R
	STICK_PASS_MIN_M = 3
	exports.STICK_PASS_MIN_M = STICK_PASS_MIN_M
	STICK_PASS_MAX_M = 32
	exports.STICK_PASS_MAX_M = STICK_PASS_MAX_M
	STICK_WAIT_S = 0.35
	exports.STICK_WAIT_S = STICK_WAIT_S
	STICK_WAIT_BELOW = 0.6
	exports.STICK_WAIT_BELOW = STICK_WAIT_BELOW
	FIRST_TIME_MAX_M = 15
	exports.FIRST_TIME_MAX_M = FIRST_TIME_MAX_M
	FIRST_TIME_MIN_VALUE = 0.4
	exports.FIRST_TIME_MIN_VALUE = FIRST_TIME_MIN_VALUE
	FIRST_TIME_TIGHT_M = 1.8
	exports.FIRST_TIME_TIGHT_M = FIRST_TIME_TIGHT_M
	FIRST_TIME_SCREEN_M = 5
	exports.FIRST_TIME_SCREEN_M = FIRST_TIME_SCREEN_M
	STICK_TOUCH_T = 1
	exports.STICK_TOUCH_T = STICK_TOUCH_T
	STICK_SCRAMBLE_T = 0.6
	exports.STICK_SCRAMBLE_T = STICK_SCRAMBLE_T
	STICK_CARRY_FROM_M = 20
	exports.STICK_CARRY_FROM_M = STICK_CARRY_FROM_M
	STICK_CARRY_T = 1.4
	exports.STICK_CARRY_T = STICK_CARRY_T
	STICK_DEVELOP_BELOW = 0.22
	exports.STICK_DEVELOP_BELOW = STICK_DEVELOP_BELOW
	STICK_PASS_MAX_FEET = 18
	exports.STICK_PASS_MAX_FEET = STICK_PASS_MAX_FEET
	STICK_PASS_MAX_THROUGH = 20
	exports.STICK_PASS_MAX_THROUGH = STICK_PASS_MAX_THROUGH
	AUTO_AFTER_S = 0.6
	exports.AUTO_AFTER_S = AUTO_AFTER_S
	AUTO_RETARGET_S = 0.35
	exports.AUTO_RETARGET_S = AUTO_RETARGET_S
	AUTO_SPRINT_M = 6
	exports.AUTO_SPRINT_M = AUTO_SPRINT_M
	AUTO_SPRINT_BAR = 0.3
	exports.AUTO_SPRINT_BAR = AUTO_SPRINT_BAR
end
