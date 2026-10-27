--!nocheck
--!nolint
-- Generated from lib/star/shotModel.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_canvasEngine = import("lib/star/canvasEngine")
	local M_shotFeel = import("lib/star/shotFeel")
	local M_season = import("lib/star/season")
	local M_gameplayVersion = import("lib/star/gameplayVersion")
	local shotsPro, knucklePowerOn, UNTOUCHED, AIMED_PAD, aimedAtGoal, KNUCKLE_R, CURL_DEAD, KNUCKLE_MIN_POWER, gradeContact, KIND_SPREAD, SPREAD_BASE, SPREAD_SKILL, VERT_RATIO, PRESSURE_R, PRESSURE_SPREAD, spreadDeg, spreadHeight, underPressure, CHIP_FROM_CY, DRIVE_BELOW_CY, HEIGHT_AT_LINE, intendedHeight, G, DRAG, vzForHeight, gauss, rot, launchShot, launchShotRaw, KNUCKLE_AMP, KNUCKLE_FREQ, KNUCKLE_ONSET, KNUCKLE_SPIN_KEEP, knuckles, knuckleOf, makeKnuckle, knuckleOffset, stepKnuckle, POWER_SHOT_WINDUP_S, POWER_SHOT_PERFECT_S, POWER_SHOT_SLOW_S, POWER_SHOT_MAX_MULT, POWER_SHOT_MAX_DRIFT_DEG, POWER_SHOT_CONTACT, powerShotQuality, powerShotStrike, WIND_PRESS_SPEED, WIND_CONTAIN_R, WIND_COVER_SPEED, stepWindUp, shotSeedFor
	aimedAtGoal = function(sc, dir)
		if A.includes(UNTOUCHED, sc.kind) then
			do return false end
		end
		if (not (dir.y < -0.05)) then
			do return false end
		end
		local n = (function() local _l = Math.hypot(dir.x, dir.y); if Js.T(_l) then return _l end; return 1 end)()
		local ux = (dir.x / n)
		local uy = (dir.y / n)
		if (uy > -0.15) then
			do return false end
		end
		local x = (sc.ball.x + (ux * (sc.ball.y / (-uy))))
		do return ((x > (sc.goal.x1 - AIMED_PAD)) and (x < (sc.goal.x2 + AIMED_PAD))) end
	end
	exports.aimedAtGoal = aimedAtGoal
	gradeContact = function(c, power, knuckles, field)
		if knuckles == nil then knuckles = true end
		if field == nil then field = false end
		local r = Math.hypot(c.cx, c.cy)
		if (r >= 0.999) then
			do return Js.O({ grade = "scuffed", power = 0.62, spread = 2.2, label = "SCUFFED" }, { "grade", "power", "spread", "label" }) end
		end
		if ((knuckles and (r < KNUCKLE_R)) and (power >= KNUCKLE_MIN_POWER)) then
			do return Js.O({ grade = "knuckle", power = 1.04, spread = 1, label = "KNUCKLEBALL" }, { "grade", "power", "spread", "label" }) end
		end
		if ((c.cy > 0.62) and (math.abs(c.cx) < 0.55)) then
			do return Js.O({ grade = "chip", power = 1, spread = 1, label = "" }, { "grade", "power", "spread", "label" }) end
		end
		if (r > 0.78) then
			if (c.cy < -0.6) then
				do return Js.O({ grade = "topped", power = 0.78, spread = 1.4, label = "TOPPED" }, { "grade", "power", "spread", "label" }) end
			end
			if (field and (math.abs(c.cx) > 0.55)) then
				do return Js.O({ grade = "plain", power = 1, spread = 1.1, label = "CURLER" }, { "grade", "power", "spread", "label" }) end
			end
			if (math.abs(c.cx) > 0.55) then
				do return Js.O({ grade = "sliced", power = 0.88, spread = 1.8, label = "SLICED" }, { "grade", "power", "spread", "label" }) end
			end
			do return Js.O({ grade = "plain", power = 1, spread = 1.15, label = "" }, { "grade", "power", "spread", "label" }) end
		end
		do return Js.O({ grade = "clean", power = 1.04, spread = 0.85, label = "CLEAN" }, { "grade", "power", "spread", "label" }) end
	end
	exports.gradeContact = gradeContact
	spreadDeg = function(sc, power, technique)
		local t = (M_canvasEngine.clamp(technique, 0, 100) / 100)
		local base = (SPREAD_BASE + ((1 - t) * SPREAD_SKILL))
		local effort = (0.5 + (0.5 * (M_canvasEngine.clamp(power, 0, 1.5) ^ 2)))
		do return (((base * effort) * (if KIND_SPREAD[sc.kind] ~= nil then KIND_SPREAD[sc.kind] else 1)) * (if underPressure(sc) then PRESSURE_SPREAD else 1)) end
	end
	exports.spreadDeg = spreadDeg
	spreadHeight = function(sc, power, technique, dist)
		do return (Math.tan((((spreadDeg(sc, power, technique) * VERT_RATIO) * Math.PI) / 180)) * dist) end
	end
	exports.spreadHeight = spreadHeight
	underPressure = function(sc)
		do return A.some(sc.defenders, function(d)
			return (Math.hypot((d.x - sc.ball.x), (d.y - sc.ball.y)) < PRESSURE_R)
		end) end
	end
	exports.underPressure = underPressure
	intendedHeight = function(cy)
		local p = HEIGHT_AT_LINE
		if (cy <= p[1][1]) then
			do return p[1][2] end
		end
		for i = 1, (Js.alen(p)) - 1 do
			if (cy <= p[i + 1][1]) then
				local _d1 = p[i]
				local a = _d1[1]
				local ha = _d1[2]
				local _d2 = p[i + 1]
				local b = _d2[1]
				local hb = _d2[2]
				do return (ha + (((cy - a) / (b - a)) * (hb - ha))) end
			end
		end
		do return p[Js.alen(p)][2] end
	end
	exports.intendedHeight = intendedHeight
	vzForHeight = function(dist, speed, height, z0)
		if z0 == nil then z0 = 0.08 end
		if ((not (speed > 0.5)) or (not (dist > 0))) then
			do return nil end
		end
		local f = (1 - ((dist * DRAG) / speed))
		if (f <= 0.05) then
			do return nil end
		end
		local T = ((-(Math.log(f))) / DRAG)
		do return (((height - z0) + (((0.5 * G) * T) * T)) / T) end
	end
	exports.vzForHeight = vzForHeight
	gauss = function(r)
		local u = 0
		local v = 0
		while (u == 0) do
			u = r()
		end
		while (v == 0) do
			v = r()
		end
		do return (Math.sqrt((-2 * Math.log(u))) * Math.cos(((2 * Math.PI) * v))) end
	end
	rot = function(v, deg)
		local a = ((deg * Math.PI) / 180)
		local c = Math.cos(a)
		local s = Math.sin(a)
		do return Js.O({ x = ((v.x * c) - (v.y * s)), y = ((v.x * s) + (v.y * c)) }, { "x", "y" }) end
	end
	launchShot = function(sc, dir, power, contact, skills, rng, rec, opts, launch)
		local st = launchShotRaw(sc, dir, power, contact, skills, rng, rec, opts, launch)
		local lift = (if opts.lift ~= nil then opts.lift else 1)
		local b = st.ball
		if ((((((lift ~= 1) and (not opts.pro)) and M_shotFeel.struckAtGoal(sc, dir, contact.cx)) and (b.lastTouch == "attack")) and (not b.loose)) and (b.vel.y < -1)) then
			b.vz *= lift
			b.shot = M_canvasEngine.isDriveAtGoal(b, sc)
			b.youStruckAtGoal = b.shot
			M_canvasEngine.markLanding(b, sc)
		end
		do return st end
	end
	exports.launchShot = launchShot
	launchShotRaw = function(sc, dir, power, contact, skills, rng, rec, opts, launch)
		local extras = (if rec.extras ~= nil then rec.extras else Js.O({}, nil))
		local atGoal = aimedAtGoal(sc, dir)
		local powered = (if Js.T(extras.powerMult) then (extras.powerMult > 1) else extras.powerMult)
		local field = ((not (not opts.field)) and M_shotFeel.fieldApplies(sc.kind))
		local vc = (if field then M_shotFeel.fieldContact(contact) else contact)
		if ((not opts.pro) and (not (opts.knuckle and atGoal))) then
			local d = (if (Js.T(powered) or Js.T(extras.driftDeg)) then rot(dir, (if extras.driftDeg ~= nil then extras.driftDeg else 0)) else dir)
			do return Js.O({ ball = launch(sc, d, (power * (if extras.powerMult ~= nil then extras.powerMult else 1)), vc, skills, rng) }, { "ball" }) end
		end
		if (not atGoal) then
			do return Js.O({ ball = launch(sc, dir, power, vc, skills, rng) }, { "ball" }) end
		end
		local r = M_season.mulberry32(Js.ushr(rec.seed, 0))
		local read = gradeContact(contact, power, (opts.knuckle and (not extras.noKnuckle)), field)
		if (not opts.pro) then
			local d = rot(dir, (if extras.driftDeg ~= nil then extras.driftDeg else 0))
			local ball = launch(sc, d, (power * (if extras.powerMult ~= nil then extras.powerMult else 1)), vc, skills, rng)
			if (read.grade == "knuckle") then
				makeKnuckle(ball, r)
			end
			do return Js.O({ ball = ball, read = (if (read.grade == "knuckle") then read else nil) }, { "ball", "read" }) end
		end
		local spread = (spreadDeg(sc, power, skills.technique) * read.spread)
		local d = rot(dir, ((gauss(r) * spread) + (if extras.driftDeg ~= nil then extras.driftDeg else 0)))
		local p = ((power * read.power) * (if extras.powerMult ~= nil then extras.powerMult else 1))
		local ball = launch(sc, d, p, vc, skills, rng)
		if (((ball.lastTouch ~= "attack") or ball.loose) or (not (ball.vel.y < -1))) then
			do return Js.O({ ball = ball, read = read, spread = spread }, { "ball", "read", "spread" }) end
		end
		if (contact.cx ~= 0) then
			local a = math.abs(contact.cx)
			local shaped = (Math.max(0, (a - CURL_DEAD)) / (1 - CURL_DEAD))
			ball.spin *= (shaped / a)
		end
		if (read.grade ~= "chip") then
			local speed = Math.hypot(ball.vel.x, ball.vel.y)
			local dist = ((ball.pos.y / (-ball.vel.y)) * speed)
			local want = (if (read.grade == "topped") then 0.12 else intendedHeight(vc.cy))
			local vz = vzForHeight(dist, speed, want, ball.z)
			if (vz ~= nil) then
				ball.vz = (if ((vc.cy < DRIVE_BELOW_CY) or (read.grade == "topped")) then Math.min(ball.vz, vz) else vz)
			end
			local slope = Math.tan(((((spreadDeg(sc, power, skills.technique) * VERT_RATIO) * read.spread) * Math.PI) / 180))
			ball.vz = M_canvasEngine.clamp((ball.vz + ((gauss(r) * slope) * speed)), 0.2, 14)
		end
		if (read.grade == "knuckle") then
			makeKnuckle(ball, r)
		end
		ball.shot = M_canvasEngine.isDriveAtGoal(ball, sc)
		ball.youStruckAtGoal = ball.shot
		M_canvasEngine.markLanding(ball, sc)
		do return Js.O({ ball = ball, read = read, spread = spread }, { "ball", "read", "spread" }) end
	end
	knuckleOf = function(ball)
		do return knuckles:get(ball) end
	end
	exports.knuckleOf = knuckleOf
	makeKnuckle = function(ball, r)
		local lerp = function(a)
			return (a[1] + ((a[2] - a[1]) * r()))
		end
		ball.spin *= KNUCKLE_SPIN_KEEP
		ball.topspin = 0
		knuckles:set(ball, Js.O({ t = 0, onset = lerp(KNUCKLE_ONSET), amp = lerp(KNUCKLE_AMP), freq = lerp(KNUCKLE_FREQ), phase = ((r() * Math.PI) * 2), phase2 = ((r() * Math.PI) * 2) }, { "t", "onset", "amp", "freq", "phase", "phase2" }))
	end
	exports.makeKnuckle = makeKnuckle
	knuckleOffset = function(kn, t)
		if (t < kn.onset) then
			do return Js.O({ lat = 0, vert = 0 }, { "lat", "vert" }) end
		end
		local env = Math.min(1, ((t - kn.onset) / 0.25))
		local lat = (((kn.amp * env) * (Math.sin(((kn.freq * t) + kn.phase)) + (0.55 * Math.sin((((2.37 * kn.freq) * t) + kn.phase2))))) / 1.55)
		local vert = (((kn.amp * 0.4) * env) * Math.sin(((((1.6 * kn.freq) * t) + kn.phase2) + 1)))
		do return Js.O({ lat = lat, vert = vert }, { "lat", "vert" }) end
	end
	exports.knuckleOffset = knuckleOffset
	stepKnuckle = function(ball, dt)
		local kn = knuckles:get(ball)
		if (not kn) then
			do return end
		end
		if (((ball.lastTouch ~= "attack") or ball.loose) or ball.inNet) then
			knuckles:delete(ball)
			do return end
		end
		local t0 = kn.t
		kn.t += dt
		local sp = Math.hypot(ball.vel.x, ball.vel.y)
		if ((ball.z <= 0.02) or (sp <= 8)) then
			do return end
		end
		local a = knuckleOffset(kn, t0)
		local b = knuckleOffset(kn, kn.t)
		local px = ((-ball.vel.y) / sp)
		local py = (ball.vel.x / sp)
		ball.pos.x += (px * (b.lat - a.lat))
		ball.pos.y += (py * (b.lat - a.lat))
		ball.z = Math.max(0.02, (ball.z + (b.vert - a.vert)))
	end
	exports.stepKnuckle = stepKnuckle
	powerShotQuality = function(reactionS, hitCircle)
		if ((not hitCircle) or (not (reactionS >= 0))) then
			do return 0 end
		end
		if (reactionS <= POWER_SHOT_PERFECT_S) then
			do return 1 end
		end
		do return M_canvasEngine.clamp((1 - ((reactionS - POWER_SHOT_PERFECT_S) / (POWER_SHOT_SLOW_S - POWER_SHOT_PERFECT_S))), 0, 1) end
	end
	exports.powerShotQuality = powerShotQuality
	powerShotStrike = function(quality, r)
		local q = M_canvasEngine.clamp(quality, 0, 1)
		local side = (if (r() < 0.5) then -1 else 1)
		do return Js.O({ powerMult = (1 + ((POWER_SHOT_MAX_MULT - 1) * q)), driftDeg = (side * (0.5 + ((POWER_SHOT_MAX_DRIFT_DEG - 0.5) * (1 - q)))) }, { "powerMult", "driftDeg" }) end
	end
	exports.powerShotStrike = powerShotStrike
	stepWindUp = function(sc, dt)
		local b = sc.ball
		local gcx = ((sc.goal.x1 + sc.goal.x2) / 2)
		do
			local _arr3 = sc.defenders
			local _i4 = 0
			while _i4 < Js.alen(_arr3) do
				_i4 += 1
				local d = _arr3[_i4]
				if (d.baseRole == "hold") then
					do continue end
				end
				local tx = nil
				local ty = nil
				local sp = nil
				if (d.role == "press") then
					local dx = (d.x - b.x)
					local dy = (d.y - b.y)
					local dist = (function() local _l = Math.hypot(dx, dy); if Js.T(_l) then return _l end; return 1 end)()
					if (dist <= WIND_CONTAIN_R) then
						do continue end
					end
					tx = (b.x + ((dx / dist) * WIND_CONTAIN_R))
					ty = (b.y + ((dy / dist) * WIND_CONTAIN_R))
					sp = WIND_PRESS_SPEED
				else
					local ax = (gcx - b.x)
					local ay = (0 - b.y)
					local len2 = (function() local _l = ((ax * ax) + (ay * ay)); if Js.T(_l) then return _l end; return 1 end)()
					local f = M_canvasEngine.clamp(((((d.x - b.x) * ax) + ((d.y - b.y) * ay)) / len2), 0.15, 0.95)
					tx = (b.x + (ax * f))
					ty = (b.y + (ay * f))
					sp = WIND_COVER_SPEED
				end
				local mx = (tx - d.x)
				local my = (ty - d.y)
				local m = Math.hypot(mx, my)
				if (m < 0.01) then
					do continue end
				end
				local step = Math.min(m, ((sp * (if d.speed ~= nil then d.speed else 1)) * dt))
				d.x += ((mx / m) * step)
				d.y += ((my / m) * step)
			end
		end
	end
	exports.stepWindUp = stepWindUp
	shotSeedFor = function(seed, calls)
		do return Js.ushr(Js.bxor(Js.bxor(seed, Math.imul((calls + 1), 2146121005)), 21511), 0) end
	end
	exports.shotSeedFor = shotSeedFor
	shotsPro = function()
		return (M_gameplayVersion.gameplayVersion("shotsPro") == "new")
	end
	exports.shotsPro = shotsPro
	knucklePowerOn = function()
		return (M_gameplayVersion.gameplayVersion("knucklePower") == "new")
	end
	exports.knucklePowerOn = knucklePowerOn
	UNTOUCHED = Js.alit("corner", "byline_cross", "free_kick")
	AIMED_PAD = 2.5
	KNUCKLE_R = 0.13
	exports.KNUCKLE_R = KNUCKLE_R
	CURL_DEAD = 0.12
	exports.CURL_DEAD = CURL_DEAD
	KNUCKLE_MIN_POWER = 0.8
	exports.KNUCKLE_MIN_POWER = KNUCKLE_MIN_POWER
	KIND_SPREAD = Js.O({ volley = 1.9, header = 1.7, long_range = 1.6, tight_angle = 1.3, penalty = 0.5 }, { "volley", "header", "long_range", "tight_angle", "penalty" })
	SPREAD_BASE = 1.73
	SPREAD_SKILL = 4
	VERT_RATIO = 0.75
	PRESSURE_R = 2.2
	PRESSURE_SPREAD = 1.3
	CHIP_FROM_CY = 0.62
	exports.CHIP_FROM_CY = CHIP_FROM_CY
	DRIVE_BELOW_CY = -0.25
	exports.DRIVE_BELOW_CY = DRIVE_BELOW_CY
	HEIGHT_AT_LINE = Js.alit(Js.alit(-1, 0.12), Js.alit(-0.5, 0.3), Js.alit(0, 0.85), Js.alit(0.3, 1.6), Js.alit(CHIP_FROM_CY, 2.45))
	G = 9.8
	DRAG = 0.12
	KNUCKLE_AMP = Js.alit(0.35, 0.6)
	KNUCKLE_FREQ = Js.alit(9, 13)
	KNUCKLE_ONSET = Js.alit(0.16, 0.3)
	KNUCKLE_SPIN_KEEP = 0.06
	knuckles = Js.Map.new()
	POWER_SHOT_WINDUP_S = 0.45
	exports.POWER_SHOT_WINDUP_S = POWER_SHOT_WINDUP_S
	POWER_SHOT_PERFECT_S = 0.22
	exports.POWER_SHOT_PERFECT_S = POWER_SHOT_PERFECT_S
	POWER_SHOT_SLOW_S = 0.85
	exports.POWER_SHOT_SLOW_S = POWER_SHOT_SLOW_S
	POWER_SHOT_MAX_MULT = 1.5
	exports.POWER_SHOT_MAX_MULT = POWER_SHOT_MAX_MULT
	POWER_SHOT_MAX_DRIFT_DEG = 8.5
	exports.POWER_SHOT_MAX_DRIFT_DEG = POWER_SHOT_MAX_DRIFT_DEG
	POWER_SHOT_CONTACT = Js.O({ cx = 0, cy = -0.25 }, { "cx", "cy" })
	exports.POWER_SHOT_CONTACT = POWER_SHOT_CONTACT
	WIND_PRESS_SPEED = 4.3
	WIND_CONTAIN_R = 1.75
	WIND_COVER_SPEED = (3.4 * 0.6)
end
