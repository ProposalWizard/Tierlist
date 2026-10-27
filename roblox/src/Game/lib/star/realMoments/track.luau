--!nocheck
--!nolint
-- Generated from lib/star/realMoments/track.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_leadIn = import("lib/star/leadIn")
	local M_airDrawings = import("lib/star/airDrawings")
	local buildUpOf, lerp, smooth, along, passesInTrack, lastName, trackLeadIn
	buildUpOf = function(tr)
		local n = (Js.alen(tr.ball) / 3)
		local ball = Js.Array.from(Js.O({ length = n }, { "length" }), function(_, i)
			return Js.O({ t = Js.Number(N.toFixed((i * tr.dt), 3)), x = tr.ball[(i * 3) + 1], y = tr.ball[((i * 3) + 1) + 1], z = tr.ball[((i * 3) + 2) + 1] }, { "t", "x", "y", "z" })
		end)
		local men = A.map(tr.men, function(row)
			local side = row[1]
			local name = Js.str((if row[2] ~= nil then row[2] else ""))
			local path = Js.alit()
			for i = 0, math.ceil(n) - 1 do
				A.push(path, Js.O({ t = ball[i + 1].t, x = Js.Number(row[(2 + (i * 2)) + 1]), y = Js.Number(row[(3 + (i * 2)) + 1]) }, { "t", "x", "y" }))
			end
			do return Js.O({ side = side, name = name, path = path }, { "side", "name", "path" }) end
		end)
		do return Js.O({ durS = ball[n].t, eventT = Js.Number(N.toFixed((-tr.t0), 3)), dt = tr.dt, ball = ball, men = men }, { "durS", "eventT", "dt", "ball", "men" }) end
	end
	exports.buildUpOf = buildUpOf
	along = function(pts, t, get)
		if (t <= pts[1].t) then
			do return get(pts[1]) end
		end
		local last = pts[Js.alen(pts)]
		if (t >= last.t) then
			do return get(last) end
		end
		local dt = (pts[2].t - pts[1].t)
		local i = Math.min((Js.alen(pts) - 2), math.floor((t / dt)))
		local f = ((t - pts[i + 1].t) / dt)
		local a = get(pts[i + 1])
		local b = get(pts[(i + 1) + 1])
		do return A.map(a, function(v, k)
			return lerp(v, b[k + 1], f)
		end) end
	end
	passesInTrack = function(b, upTo)
		if upTo == nil then upTo = b.durS end
		local out = Js.alit()
		local s0 = nil
		for i = 1, (Js.alen(b.ball)) - 1 do
			local p = b.ball[i]
			local q = b.ball[i + 1]
			if (q.t > (upTo + 0.000001)) then
				do break end
			end
			local v = (Math.hypot((q.x - p.x), (q.y - p.y)) / (q.t - p.t))
			if ((v >= 9) and (s0 == nil)) then
				s0 = p.t
			end
			if ((v < 9) and (s0 ~= nil)) then
				if ((p.t - s0) >= 0.4) then
					A.push(out, Js.O({ start = s0, ["end"] = p.t }, { "start", "end" }))
				end
				s0 = nil
			end
		end
		if ((s0 ~= nil) and ((upTo - s0) >= 0.4)) then
			A.push(out, Js.O({ start = s0, ["end"] = (upTo - 0.05) }, { "start", "end" }))
		end
		do return out end
	end
	exports.passesInTrack = passesInTrack
	trackLeadIn = function(tr, sc, opts)
		if opts == nil then opts = Js.O({ camera = "tv" }, { "camera" }) end
		local b = buildUpOf(tr)
		local durS = b.eventT
		local ents = M_leadIn.leadInEntities(sc)
		local endOf = function(m)
			local p = along(m.path, durS, function(q)
				return Js.alit(q.x, q.y)
			end)
			do return Js.O({ x = p[1], y = p[2] }, { "x", "y" }) end
		end
		local used = Js.Set.new()
		local keyMan = Js.Map.new()
		local take = function(side, at, within)
			local best = -1
			local bd = within
			A.forEach(b.men, function(m, i)
				if (used:has(i) or (not A.includes(side, m.side))) then
					do return end
				end
				local e = endOf(m)
				local d = Math.hypot((e.x - at.x), (e.y - at.y))
				if (d < bd) then
					bd = d
					best = i
				end
			end)
			if (best >= 0) then
				used:add(best)
			end
			do return best end
		end
		local order = A.sort(Js.aspread(ents), function(a, c)
			return ((if (a.key == "you") then -2 else (if (a.side == "keeper") then -1 else 0)) - (if (c.key == "you") then -2 else (if (c.side == "keeper") then -1 else 0)))
		end)
		do
			local _arr1 = order
			local _i2 = 0
			while _i2 < Js.alen(_arr1) do
				_i2 += 1
				local e = _arr1[_i2]
				local at = e.get()
				local i = (if (e.key == "you") then A.findIndex(b.men, function(m)
					return (m.side == "you")
				end) else take((if (e.side == "keeper") then Js.alit("keeper") else (if (e.side == "opp") then Js.alit("opp", "keeper") else Js.alit("mate"))), at, (if (e.side == "keeper") then 2.5 else 1.5)))
				if (i >= 0) then
					used:add(i)
					keyMan:set(e.key, i)
				end
			end
		end
		local endEnt = Js.Map.new(A.map(ents, function(e)
			return Js.alit(e.key, e.get())
		end))
		local extras = Js.alit()
		A.forEach(b.men, function(m, i)
			if ((not used:has(i)) and (m.side == "mate")) then
				A.push(extras, i)
			end
		end)
		A.forEach(extras, function(i, k)
			return keyMan:set(("extra" .. Js.numstr(k)), i)
		end)
		local end_ = Js.O({ x = sc.ball.x, y = sc.ball.y }, { "x", "y" })
		local bEnd = along(b.ball, durS, function(q)
			return Js.alit(q.x, q.y, q.z)
		end)
		local ballOff = Js.O({ x = (end_.x - bEnd[1]), y = (end_.y - bEnd[2]) }, { "x", "y" })
		local endZ = (if M_airDrawings.isAirKind(sc.kind) then M_airDrawings.airWaitZ(sc.kind, 0, sc) else 0)
		local ballAt = function(t)
			local p = along(b.ball, Math.min(durS, Math.max(0, t)), function(q)
				return Js.alit(q.x, q.y, q.z)
			end)
			local f = smooth((t / durS))
			local zf = (1 - smooth(((t - (durS - 0.4)) / 0.4)))
			do return Js.O({ x = (p[1] + (ballOff.x * f)), y = (p[2] + (ballOff.y * f)), z = ((Math.max(0, p[3]) * zf) + (endZ * (1 - zf))) }, { "x", "y", "z" }) end
		end
		local posAt = function(key, t)
			local i = keyMan:get(key)
			if (i == nil) then
				do return nil end
			end
			local m = b.men[i + 1]
			local p = along(m.path, Math.min(durS, Math.max(0, t)), function(q)
				return Js.alit(q.x, q.y)
			end)
			local want = endEnt:get(key)
			if (not want) then
				do return Js.O({ x = p[1], y = p[2] }, { "x", "y" }) end
			end
			local e = endOf(m)
			local f = smooth((t / durS))
			do return Js.O({ x = (p[1] + ((want.x - e.x) * f)), y = (p[2] + ((want.y - e.y) * f)) }, { "x", "y" }) end
		end
		local passes = passesInTrack(b, durS)
		local nearestName = function(t)
			local ball = ballAt(t)
			local best = ""
			local bd = 3
			do
				local _arr3 = b.men
				local _i4 = 0
				while _i4 < Js.alen(_arr3) do
					_i4 += 1
					local m = _arr3[_i4]
					local p = along(m.path, Math.min(durS, t), function(q)
						return Js.alit(q.x, q.y)
					end)
					local d = Math.hypot((p[1] - ball.x), (p[2] - ball.y))
					if (d < bd) then
						bd = d
						best = (if (m.side == "you") then "you" else lastName(m.name))
					end
				end
			end
			do return best end
		end
		local captionAt = function(t)
			local p = A.find(passes, function(q)
				return ((t >= q.start) and (t < q["end"]))
			end)
			if p then
				local a = nearestName(Math.max(0, (p.start - 0.05)))
				local c = nearestName(Math.min(durS, (p["end"] + 0.1)))
				do return (if ((Js.T(a) and Js.T(c)) and (a ~= c)) then ((if (a == "you") then "You" else a) .. " → " .. (if (c == "you") then "you" else c)) else "The ball is played on") end
			end
			local who = nearestName(t)
			if (t > (durS - 0.6)) then
				do return "Your shot" end
			end
			do return (if (who == "you") then "You have it" else (if Js.T(who) then (who .. " on the ball") else "The move…")) end
		end
		do return Js.ospread(Js.O({ durS = durS, ballAt = ballAt, posAt = posAt, captionAt = captionAt, extraMates = Js.alen(extras), passStart = A.map(passes, function(p)
			return p.start
		end), passEnd = A.map(passes, function(p)
			return p["end"]
		end) }, { "durS", "ballAt", "posAt", "captionAt", "extraMates", "passStart", "passEnd" }), (if Js.T(opts.camera) then Js.O({ camera = opts.camera }, { "camera" }) else Js.O({}, nil)), Js.O({ matched = Js.alen(A.filter(Js.Array.from(keyMan:keys()), function(k)
			return (not S.startsWith(k, "extra"))
		end)), build = b }, { "matched", "build" })) end
	end
	exports.trackLeadIn = trackLeadIn
	lerp = function(a, b, f)
		return (a + ((b - a) * f))
	end
	smooth = function(f)
		local c = Math.min(1, Math.max(0, f))
		do return ((c * c) * (3 - (2 * c))) end
	end
	lastName = function(n)
		return (A.slice(S.split(S.trim(n), Js.re("\\s+", "")), -1)[1] or "")
	end
end
