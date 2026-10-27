--!nocheck
--!nolint
-- Generated from roblox/game/camera3d.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local GOAL_CX, ELEVATION_DEG, FIT_X, FIT_TOP, FIT_BOTTOM, MIN_DIST, MAX_DIST, DIST_CAP, sub, dot, norm, cross, project, placed, fits, mustSee, nearestFit, centreOf, chanceCam, chaseCam, broadcastCam, cameraFor
	project = function(cam, p, aspect, vfovDeg)
		local fw = norm(sub(cam.target, cam.pos))
		local right = norm(cross(fw, Js.O({ x = 0, y = 0, h = 1 }, { "x", "y", "h" })))
		local up = cross(right, fw)
		local d = sub(p, cam.pos)
		local depth = dot(d, fw)
		if (depth < 0.3) then
			do return nil end
		end
		local t = Math.tan(((vfovDeg * Math.PI) / 360))
		do return Js.O({ x = ((dot(d, right) / depth) / (t * aspect)), y = ((dot(d, up) / depth) / t) }, { "x", "y" }) end
	end
	exports.project = project
	placed = function(target, dir, dist)
		local e = ((ELEVATION_DEG * Math.PI) / 180)
		do return Js.O({ pos = Js.O({ x = (target.x - ((dir.x * dist) * Math.cos(e))), y = (target.y - ((dir.y * dist) * Math.cos(e))), h = (target.h + (dist * Math.sin(e))) }, { "x", "y", "h" }), target = target }, { "pos", "target" }) end
	end
	fits = function(cam, pts, aspect, vfov)
		do
			local _arr1 = pts
			local _i2 = 0
			while _i2 < Js.alen(_arr1) do
				_i2 += 1
				local p = _arr1[_i2]
				local s = project(cam, p, aspect, vfov)
				if ((((not s) or (math.abs(s.x) > FIT_X)) or (s.y > FIT_TOP)) or (s.y < (-FIT_BOTTOM))) then
					do return false end
				end
			end
		end
		do return true end
	end
	mustSee = function(f)
		local core = Js.alit()
		local ball = f.ball
		if ball then
			A.push(core, Js.O({ x = ball.x, y = ball.y, h = 0 }, { "x", "y", "h" }), Js.O({ x = ball.x, y = ball.y, h = ((if ball.z ~= nil then ball.z else 0) + 0.3) }, { "x", "y", "h" }))
		end
		local g = f.goal
		A.push(core, Js.O({ x = g.x1, y = 0, h = 0 }, { "x", "y", "h" }), Js.O({ x = g.x2, y = 0, h = 0 }, { "x", "y", "h" }), Js.O({ x = g.x1, y = 0, h = g.crossbar }, { "x", "y", "h" }), Js.O({ x = g.x2, y = 0, h = g.crossbar }, { "x", "y", "h" }))
		local bx = (if ball then ball.x else GOAL_CX)
		local by = (if ball then ball.y else 16)
		local extra = Js.alit()
		do
			local _arr3 = f.bodies
			local _i4 = 0
			while _i4 < Js.alen(_arr3) do
				_i4 += 1
				local b = _arr3[_i4]
				local near = Math.hypot((b.x - bx), (b.y - by))
				local pts = Js.alit(Js.O({ x = b.x, y = b.y, h = 0 }, { "x", "y", "h" }), Js.O({ x = b.x, y = b.y, h = 1.9 }, { "x", "y", "h" }))
				if (b.side == "you") then
					A.push(core, Js.unpack(pts))
				elseif (((b.side == "keeper") or ((b.side == "mate") and (b.option or (near < 20)))) or ((b.side == "opp") and (near < 14))) then
					A.push(extra, Js.O({ d = near, pts = pts }, { "d", "pts" }))
				end
			end
		end
		A.sort(extra, function(a, b)
			return (a.d - b.d)
		end)
		do return Js.O({ core = core, extra = A.map(extra, function(e)
			return e.pts
		end) }, { "core", "extra" }) end
	end
	exports.mustSee = mustSee
	nearestFit = function(target, dir, pts, aspect, vfov)
		local lo = MIN_DIST
		local hi = MAX_DIST
		if fits(placed(target, dir, lo), pts, aspect, vfov) then
			do return lo end
		end
		if (not fits(placed(target, dir, hi), pts, aspect, vfov)) then
			do return math.huge end
		end
		for i = 0, 17 do
			local mid = ((lo + hi) / 2)
			if fits(placed(target, dir, mid), pts, aspect, vfov) then
				hi = mid
			else
				lo = mid
			end
		end
		do return hi end
	end
	centreOf = function(pts)
		local minX = math.huge
		local maxX = (-math.huge)
		local minY = math.huge
		local maxY = (-math.huge)
		do
			local _arr5 = pts
			local _i6 = 0
			while _i6 < Js.alen(_arr5) do
				_i6 += 1
				local p = _arr5[_i6]
				minX = Math.min(minX, p.x)
				maxX = Math.max(maxX, p.x)
				minY = Math.min(minY, p.y)
				maxY = Math.max(maxY, p.y)
			end
		end
		do return Js.O({ x = ((minX + maxX) / 2), y = ((minY + maxY) / 2), h = 0 }, { "x", "y", "h" }) end
	end
	chanceCam = function(f, aspect, vfovDeg)
		local _d7 = mustSee(f)
		local core = _d7.core
		local extra = _d7.extra
		local ball = (if f.ball ~= nil then f.ball else Js.O({ x = GOAL_CX, y = 18, z = 0 }, { "x", "y", "z" }))
		local gx = (GOAL_CX - ball.x)
		local gy = (0 - ball.y)
		local gl = (function() local _l = Math.hypot(gx, gy); if Js.T(_l) then return _l end; return 1 end)()
		local dx = (0.55 * (gx / gl))
		local dy = ((0.55 * (gy / gl)) - 0.45)
		local dl = (function() local _l = Math.hypot(dx, dy); if Js.T(_l) then return _l end; return 1 end)()
		dx /= dl
		dy /= dl
		local dir = Js.O({ x = dx, y = dy }, { "x", "y" })
		local keep = Js.alen(extra)
		local pts = A.concat(core, Js.unpack(extra))
		while ((keep > 0) and (nearestFit(centreOf(pts), dir, pts, aspect, vfovDeg) > DIST_CAP)) do
			keep -= 1
			pts = A.concat(core, Js.unpack(A.slice(extra, 0, keep)))
		end
		local target = centreOf(pts)
		local dist = nearestFit(target, dir, pts, aspect, vfovDeg)
		if (not Js.NumberNS.isFinite(dist)) then
			dist = DIST_CAP
		end
		for pass = 0, 1 do
			local cam = placed(target, dir, dist)
			local sx0 = math.huge
			local sx1 = (-math.huge)
			local sy0 = math.huge
			local sy1 = (-math.huge)
			do
				local _arr8 = pts
				local _i9 = 0
				while _i9 < Js.alen(_arr8) do
					_i9 += 1
					local p = _arr8[_i9]
					local s = project(cam, p, aspect, vfovDeg)
					if s then
						sx0 = Math.min(sx0, s.x)
						sx1 = Math.max(sx1, s.x)
						sy0 = Math.min(sy0, s.y)
						sy1 = Math.max(sy1, s.y)
					end
				end
			end
			if (not Js.NumberNS.isFinite(sx0)) then
				do break end
			end
			local offX = ((sx0 + sx1) / 2)
			local offY = (((sy0 + sy1) / 2) - ((FIT_TOP - FIT_BOTTOM) / 2))
			local t = Math.tan(((vfovDeg * Math.PI) / 360))
			local rx = (-dy)
			local ry = dx
			local along = (((offY * dist) * t) * 1.4)
			local side = (((offX * dist) * t) * aspect)
			target = Js.O({ x = ((target.x + (rx * side)) + (dx * along)), y = ((target.y + (ry * side)) + (dy * along)), h = 0 }, { "x", "y", "h" })
			local d2 = nearestFit(target, dir, pts, aspect, vfovDeg)
			if Js.NumberNS.isFinite(d2) then
				dist = d2
			end
		end
		do return placed(target, dir, Math.max(MIN_DIST, Math.min(MAX_DIST, dist))) end
	end
	exports.chanceCam = chanceCam
	chaseCam = function(you)
		do return Js.O({ pos = Js.O({ x = you.x, y = (you.y + 9), h = 6.5 }, { "x", "y", "h" }), target = Js.O({ x = you.x, y = (you.y - 10), h = 0 }, { "x", "y", "h" }) }, { "pos", "target" }) end
	end
	exports.chaseCam = chaseCam
	broadcastCam = function(t)
		do return Js.O({ pos = Js.O({ x = (68 + 30), y = (45 + (Math.sin((t * 0.05)) * 6)), h = 24 }, { "x", "y", "h" }), target = Js.O({ x = (34 + (Math.sin((t * 0.07)) * 10)), y = 35, h = 0 }, { "x", "y", "h" }) }, { "pos", "target" }) end
	end
	exports.broadcastCam = broadcastCam
	cameraFor = function(f, aspect, vfovDeg, t)
		if (f.cameraMode == "broadcast") then
			do return broadcastCam(t) end
		end
		if ((f.cameraMode == "chase") and Js.T(Js.alen(f.bodies))) then
			do return chaseCam(f.bodies[1]) end
		end
		do return chanceCam(f, aspect, vfovDeg) end
	end
	exports.cameraFor = cameraFor
	GOAL_CX = 34
	ELEVATION_DEG = 34
	FIT_X = 0.86
	FIT_TOP = 0.62
	FIT_BOTTOM = 0.86
	MIN_DIST = 11
	MAX_DIST = 140
	DIST_CAP = 40
	sub = function(a, b)
		return Js.O({ x = (a.x - b.x), y = (a.y - b.y), h = (a.h - b.h) }, { "x", "y", "h" })
	end
	dot = function(a, b)
		return (((a.x * b.x) + (a.y * b.y)) + (a.h * b.h))
	end
	norm = function(a)
		local l = (function() local _l = Math.hypot(a.x, a.y, a.h); if Js.T(_l) then return _l end; return 1 end)()
		do return Js.O({ x = (a.x / l), y = (a.y / l), h = (a.h / l) }, { "x", "y", "h" }) end
	end
	cross = function(a, b)
		local ax = a.x
		local ay = a.h
		local az = a.y
		local bx = b.x
		local by = b.h
		local bz = b.y
		do return Js.O({ x = ((ay * bz) - (az * by)), h = ((az * bx) - (ax * bz)), y = ((ax * by) - (ay * bx)) }, { "x", "h", "y" }) end
	end
end
