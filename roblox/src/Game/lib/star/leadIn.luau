--!nocheck
--!nolint
-- Generated from lib/star/leadIn.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_pitch = import("lib/star/pitch")
	local stakesOf, leadInEntities, LEAD_SETTLE_S, LEAD_FRAME_NEAR, LEAD_FOLLOW_OMEGA, LEAD_FOLLOW_TOP, LEAD_FRAME_MIN_W, LEAD_FOLLOW_SIZE_OMEGA, LEAD_FOLLOW_TOP_W, LEAD_ROOM, LEAD_LONG_PASS, LEAD_WIDE_MAX, LEAD_WIDE_IN_S, LEAD_WIDE_OUT_S, LEAD_TV_MAX_RATIO, LEAD_TV_MARGIN, LEAD_TV_AIM_S, LEAD_TV_LOOK_S, LEAD_TV_GOAL_Y, LEAD_TV_OMEGA, LEAD_TV_OMEGA_OUT, LEAD_TV_OMEGA_SIZE, LEAD_TV_TOP, LEAD_TV_SETTLE_S, LEAD_TV_SAFE, LEAD_LOCK_AREA, LOCK_AREAS, inLockArea, smooth, actionBox, ballMargin, keepBall, keepSafe, leadLockTime, leadInCamera, GLIDE_FOLLOW, GLIDE_SIGMA_S, GLIDE_HOLD_S, GLIDE_ZOOM_SIGMA_S, GLIDE_WIDE_MAX, GLIDE_BALL_ROOM, GLIDE_NUDGE_HOLD_S, GLIDE_NUDGE_SIGMA_S, smoother, gaussSmooth, glideCamera, alongKeys, LEAD_MAX_RUN, ballAlong
	stakesOf = function(f)
		if (not f) then
			do return nil end
		end
		local round = (if f.round ~= nil then f.round else "")
		if (Js.re("\\bfinal\\b", "i"):test(round) and (not Js.re("semi|quarter|eighth", "i"):test(round))) then
			do return "final" end
		end
		if ((Js.T(f.kind) and (f.kind ~= "league")) and Js.T(round)) then
			do return "knockout" end
		end
		if ((not Js.T(f.kind)) or (f.kind == "league")) then
			do return "league" end
		end
		do return (if (f.kind == "international") then "friendly" else "knockout") end
	end
	exports.stakesOf = stakesOf
	leadInEntities = function(sc)
		local out = Js.alit()
		local pt = function(o)
			return Js.O({ get = function()
				return Js.O({ x = o.x, y = o.y }, { "x", "y" })
			end, set = function(p)
				o.x = p.x
				o.y = p.y
			end }, { "get", "set" })
		end
		A.push(out, Js.ospread(Js.O({ key = "you", side = "you" }, { "key", "side" }), pt(sc.player)))
		A.push(out, Js.ospread(Js.O({ key = "keeper", side = "keeper" }, { "key", "side" }), pt(sc.keeper)))
		A.forEach(sc.defenders, function(d, i)
			return A.push(out, Js.ospread(Js.O({ key = ("def" .. Js.numstr(i)), side = "opp" }, { "key", "side" }), pt(d)))
		end)
		A.forEach(sc.teammates, function(m, i)
			return A.push(out, Js.ospread(Js.O({ key = ("mate" .. Js.numstr(i)), side = "mate" }, { "key", "side" }), pt(m)))
		end)
		if sc.runner then
			A.push(out, Js.ospread(Js.O({ key = "run", side = "mate" }, { "key", "side" }), pt(sc.runner.pos)))
		end
		A.forEach(sc.secondaryRunners, function(r, i)
			return A.push(out, Js.ospread(Js.O({ key = ("sec" .. Js.numstr(i)), side = "mate" }, { "key", "side" }), pt(r.pos)))
		end)
		A.push(out, Js.ospread(Js.O({ key = "follower", side = "mate" }, { "key", "side" }), pt(sc.follower)))
		do return out end
	end
	exports.leadInEntities = leadInEntities
	inLockArea = function(p, area)
		if area == nil then area = LEAD_LOCK_AREA end
		local a = LOCK_AREAS[area]
		do return ((((p.y >= 0) and (p.y <= a.depth)) and (p.x >= a.l)) and (p.x <= a.r)) end
	end
	exports.inLockArea = inLockArea
	actionBox = function(lead, t, keys)
		local tt = Math.min(lead.durS, Math.max(0, t))
		local b = lead.ballAt(tt)
		local x1 = b.x
		local x2 = b.x
		local y1 = b.y
		local y2 = b.y
		do
			local _arr1 = keys
			local _i2 = 0
			while _i2 < Js.alen(_arr1) do
				_i2 += 1
				local k = _arr1[_i2]
				local p = lead.posAt(k, tt)
				if ((not p) or (Math.hypot((p.x - b.x), (p.y - b.y)) > LEAD_FRAME_NEAR)) then
					do continue end
				end
				x1 = Math.min(x1, p.x)
				x2 = Math.max(x2, p.x)
				y1 = Math.min(y1, p.y)
				y2 = Math.max(y2, p.y)
			end
		end
		do return Js.O({ x1 = x1, x2 = x2, y1 = y1, y2 = y2, bx = b.x, by = b.y }, { "x1", "x2", "y1", "y2", "bx", "by" }) end
	end
	keepBall = function(v, b)
		local m = ballMargin(v)
		local dx = (if (b.x < (v.x1 + m)) then (b.x - (v.x1 + m)) else (if (b.x > (v.x2 - m)) then (b.x - (v.x2 - m)) else 0))
		local dy = (if (b.y < (v.y1 + m)) then (b.y - (v.y1 + m)) else (if (b.y > (v.y2 - m)) then (b.y - (v.y2 - m)) else 0))
		do return Js.O({ x1 = (v.x1 + dx), x2 = (v.x2 + dx), y1 = (v.y1 + dy), y2 = (v.y2 + dy) }, { "x1", "x2", "y1", "y2" }) end
	end
	keepSafe = function(v, b, k)
		if k == nil then k = 1 end
		local w = (v.x2 - v.x1)
		local h = (v.y2 - v.y1)
		local m = ballMargin(v)
		local l = Math.max(m, ((LEAD_TV_SAFE.l * w) * k))
		local r = Math.max(m, ((LEAD_TV_SAFE.r * w) * k))
		local t = Math.max(m, ((LEAD_TV_SAFE.t * h) * k))
		local bo = Math.max(m, ((LEAD_TV_SAFE.b * h) * k))
		local soft = function(e, mm)
			local K = (0.8 * mm)
			do return (if (e <= 0) then 0 else ((e * e) / (e + K))) end
		end
		local dx = (if (b.x < (v.x1 + l)) then (-(soft(((v.x1 + l) - b.x), l))) else (if (b.x > (v.x2 - r)) then soft((b.x - (v.x2 - r)), r) else 0))
		local dy = (if (b.y < (v.y1 + t)) then (-(soft(((v.y1 + t) - b.y), t))) else (if (b.y > (v.y2 - bo)) then soft((b.y - (v.y2 - bo)), bo) else 0))
		do return Js.O({ x1 = (v.x1 + dx), x2 = (v.x2 + dx), y1 = (v.y1 + dy), y2 = (v.y2 + dy) }, { "x1", "x2", "y1", "y2" }) end
	end
	leadLockTime = function(lead, chance, area)
		if area == nil then area = LEAD_LOCK_AREA end
		local m = ballMargin(chance)
		local STEP = (1 / 60)
		local n = math.floor((lead.durS / STEP))
		local lockT = lead.durS
		for i = n, 0, -1 do
			local t = (i * STEP)
			local b = lead.ballAt(t)
			if ((((b.x < (chance.x1 + m)) or (b.x > (chance.x2 - m))) or (b.y < (chance.y1 + m))) or (b.y > (chance.y2 - m))) then
				do break end
			end
			if inLockArea(b, area) then
				lockT = t
			end
		end
		do return lockT end
	end
	exports.leadLockTime = leadLockTime
	leadInCamera = function(lead, keys)
		if keys == nil then keys = Js.alit() end
		if (lead.camera == "glide") then
			do return glideCamera(lead) end
		end
		local tv = (lead.camera == "tv")
		local STEP = (1 / 60)
		local W_POS = (if tv then LEAD_TV_OMEGA else LEAD_FOLLOW_OMEGA)
		local W_SIZE = (if tv then LEAD_TV_OMEGA_SIZE else LEAD_FOLLOW_SIZE_OMEGA)
		local TOP = (if tv then LEAD_TV_TOP else LEAD_FOLLOW_TOP)
		local SETTLE = (if tv then LEAD_TV_SETTLE_S else LEAD_SETTLE_S)
		local MARGIN = (if tv then LEAD_TV_MARGIN else 14)
		local ps = lead.passStart
		local pe = lead.passEnd
		local hasPasses = ((((not (not ps)) and (not (not pe))) and (Js.alen(ps) > 0)) and (Js.alen(ps) == Js.alen(pe)))
		local box = function(pts)
			local x1 = math.huge
			local x2 = (-math.huge)
			local y1 = math.huge
			local y2 = (-math.huge)
			do
				local _arr3 = pts
				local _i4 = 0
				while _i4 < Js.alen(_arr3) do
					_i4 += 1
					local p = _arr3[_i4]
					x1 = Math.min(x1, p.x)
					x2 = Math.max(x2, p.x)
					y1 = Math.min(y1, p.y)
					y2 = Math.max(y2, p.y)
				end
			end
			do return Js.O({ cx = ((x1 + x2) / 2), cy = ((y1 + y2) / 2), sx = ((x2 - x1) + MARGIN), sy = ((y2 - y1) + MARGIN) }, { "cx", "cy", "sx", "sy" }) end
		end
		local target0 = function(t)
			if hasPasses then
				local tt = Math.min(lead.durS, Math.max(0, t))
				local i = A.findIndex(pe, function(e)
					return (tt < e)
				end)
				local b = lead.ballAt(tt)
				local g = box((if (i >= 0) then Js.alit(b, lead.ballAt(ps[i + 1]), lead.ballAt(pe[i + 1])) else Js.alit(b, lead.ballAt(lead.durS))))
				local to = (if (i >= 0) then lead.ballAt(pe[i + 1]) else lead.ballAt(lead.durS))
				do return Js.ospread(g, Js.O({ cx = (g.cx + ((to.x - g.cx) * LEAD_ROOM)), cy = (g.cy + ((to.y - g.cy) * LEAD_ROOM)) }, { "cx", "cy" })) end
			end
			local a = actionBox(lead, t, keys)
			local ahead = lead.ballAt(Math.min(lead.durS, (t + 0.35)))
			local x1 = Math.min(a.x1, ahead.x)
			local x2 = Math.max(a.x2, ahead.x)
			local y1 = Math.min(a.y1, ahead.y)
			local y2 = Math.max(a.y2, ahead.y)
			do return Js.O({ cx = ((((x1 + x2) / 2) + a.bx) / 2), cy = ((((y1 + y2) / 2) + a.by) / 2), sx = ((x2 - x1) + MARGIN), sy = ((y2 - y1) + MARGIN) }, { "cx", "cy", "sx", "sy" }) end
		end
		local cw0 = 30
		local ch0 = 58
		local longPasses = Js.alit()
		local longFor = -1
		local wideAt = function(t, cw)
			if (tv or (not hasPasses)) then
				do return 0 end
			end
			if (longFor ~= cw) then
				longFor = cw
				A.setlen(longPasses, 0)
				for i = 0, (Js.alen(ps)) - 1 do
					local a = lead.ballAt(ps[i + 1])
					local b = lead.ballAt(pe[i + 1])
					if (Math.hypot((b.x - a.x), (b.y - a.y)) > (LEAD_LONG_PASS * cw)) then
						A.push(longPasses, Js.alit(ps[i + 1], pe[i + 1]))
					end
				end
			end
			local w = 0
			do
				local _arr5 = longPasses
				local _i6 = 0
				while _i6 < Js.alen(_arr5) do
					_i6 += 1
					local _e7 = _arr5[_i6]
					local a = _e7[1]
					local b = _e7[2]
					w = Math.max(w, (smooth(((t - (a - LEAD_WIDE_IN_S)) / LEAD_WIDE_IN_S)) * (1 - smooth(((t - b) / LEAD_WIDE_OUT_S)))))
				end
			end
			do return w end
		end
		local tvGoal = Js.O({ x = M_pitch.CX, y = 0 }, { "x", "y" })
		local tvTarget0 = function(t)
			local tt = Math.min(lead.durS, Math.max(0, t))
			local b = lead.ballAt(tt)
			local pts = Js.alit(b)
			if hasPasses then
				local i = A.findIndex(pe, function(e)
					return (tt < e)
				end)
				if (i >= 0) then
					if (tt < ps[i + 1]) then
						A.push(pts, lead.ballAt(ps[i + 1]))
					end
					A.push(pts, lead.ballAt(pe[i + 1]))
				else
					A.push(pts, lead.ballAt(lead.durS))
				end
			else
				A.push(pts, lead.ballAt(Math.min(lead.durS, (tt + 0.8))))
			end
			if (b.y < LEAD_TV_GOAL_Y) then
				A.push(pts, tvGoal)
			end
			do return box(pts) end
		end
		local tvTarget = function(t)
			local cx = 0
			local cy = 0
			local sx = 0
			local sy = 0
			local N_ = 6
			for k = 0, N_ - 1 do
				local g = tvTarget0((t + ((LEAD_TV_AIM_S * k) / (N_ - 1))))
				cx += (g.cx / N_)
				cy += (g.cy / N_)
			end
			for k = 0, N_ - 1 do
				local g = tvTarget0((t + ((LEAD_TV_LOOK_S * k) / (N_ - 1))))
				sx = Math.max(sx, g.sx)
				sy = Math.max(sy, g.sy)
			end
			local fw = ((1 - LEAD_TV_SAFE.l) - LEAD_TV_SAFE.r)
			local fh = ((1 - LEAD_TV_SAFE.t) - LEAD_TV_SAFE.b)
			local need = Math.max((sx / fw), (((sy / fh) * cw0) / ch0))
			local w = Math.min((cw0 * LEAD_TV_MAX_RATIO), Math.max(cw0, need))
			local h = ((w * ch0) / cw0)
			local b = lead.ballAt(Math.min(lead.durS, Math.max(0, t)))
			if (sx > (w * fw)) then
				cx = (b.x + ((((cx - b.x) * w) * fw) / sx))
			end
			if (sy > (h * fh)) then
				cy = (b.y + ((((cy - b.y) * h) * fh) / sy))
			end
			cx += (((LEAD_TV_SAFE.r - LEAD_TV_SAFE.l) / 2) * w)
			cy += (((LEAD_TV_SAFE.b - LEAD_TV_SAFE.t) / 2) * h)
			do return Js.O({ cx = cx, cy = cy, sx = w, sy = h }, { "cx", "cy", "sx", "sy" }) end
		end
		local target = function(t)
			return (if tv then tvTarget(t) else target0(t))
		end
		local rest = function(t)
			return Js.ospread(Js.O({ t = 0 }, { "t" }), target(t), Js.O({ vx = 0, vy = 0, vsx = 0, vsy = 0 }, { "vx", "vy", "vsx", "vsy" }))
		end
		local st = nil
		local advance = function(to)
			if ((not st) or (to < st.t)) then
				st = rest(0)
			end
			while ((st.t + STEP) <= (to + 1e-9)) do
				local g = target((st.t + STEP))
				local vx = (st.vx + ((((W_POS * W_POS) * (g.cx - st.cx)) - ((2 * W_POS) * st.vx)) * STEP))
				local vy = (st.vy + ((((W_POS * W_POS) * (g.cy - st.cy)) - ((2 * W_POS) * st.vy)) * STEP))
				local sp = Math.hypot(vx, vy)
				local top = (if tv then TOP else Math.min(TOP, (LEAD_FOLLOW_TOP_W * Math.max(cw0, st.sx))))
				if (sp > top) then
					vx *= (top / sp)
					vy *= (top / sp)
				end
				local wx = (if (tv and (g.sx > st.sx)) then LEAD_TV_OMEGA_OUT else W_SIZE)
				local wy = (if (tv and (g.sy > st.sy)) then LEAD_TV_OMEGA_OUT else W_SIZE)
				local vsx = (st.vsx + ((((wx * wx) * (g.sx - st.sx)) - ((2 * wx) * st.vsx)) * STEP))
				local vsy = (st.vsy + ((((wy * wy) * (g.sy - st.sy)) - ((2 * wy) * st.vsy)) * STEP))
				st = Js.O({ t = (st.t + STEP), cx = (st.cx + (vx * STEP)), cy = (st.cy + (vy * STEP)), sx = (st.sx + (vsx * STEP)), sy = (st.sy + (vsy * STEP)), vx = vx, vy = vy, vsx = vsx, vsy = vsy }, { "t", "cx", "cy", "sx", "sy", "vx", "vy", "vsx", "vsy" })
				if tv then
					local w = Math.min((cw0 * LEAD_TV_MAX_RATIO), Math.max(cw0, st.sx))
					local h = ((w * ch0) / cw0)
					local v = Js.O({ x1 = (st.cx - (w / 2)), x2 = (st.cx + (w / 2)), y1 = (st.cy - (h / 2)), y2 = (st.cy + (h / 2)) }, { "x1", "x2", "y1", "y2" })
					local k = keepSafe(v, lead.ballAt(Math.min(lead.durS, st.t)))
					if ((k.x1 ~= Js.idx(v, "x1")) or (k.y1 ~= Js.idx(v, "y1"))) then
						local prev = (st.sx - (vsx * STEP))
						local prevY = (st.sy - (vsy * STEP))
						st = Js.ospread(st, Js.O({ cx = (st.cx + (k.x1 - Js.idx(v, "x1"))), cy = (st.cy + (k.y1 - Js.idx(v, "y1"))), sx = prev, sy = prevY, vsx = 0, vsy = 0 }, { "cx", "cy", "sx", "sy", "vsx", "vsy" }))
					end
				end
			end
		end
		local clampC = function(c, half, lo, hi)
			return (if ((hi - lo) <= (2 * half)) then ((lo + hi) / 2) else Math.min((hi - half), Math.max((lo + half), c)))
		end
		local lockMemo = nil
		local lockTime = function(chance)
			local key = (Js.numstr(chance.x1) .. "," .. Js.numstr(chance.x2) .. "," .. Js.numstr(chance.y1) .. "," .. Js.numstr(chance.y2))
			if ((not lockMemo) or (lockMemo.key ~= key)) then
				lockMemo = Js.O({ key = key, t = leadLockTime(lead, chance) }, { "key", "t" })
			end
			do return lockMemo.t end
		end
		local lockAt = function(t, chance)
			if lead.offside then
				do return 0 end
			end
			local lt = lockTime(chance)
			if (lt <= 0) then
				do return 1 end
			end
			do return smooth(((t - (lt - SETTLE)) / SETTLE)) end
		end
		do return Js.O({ lockTime = lockTime, lockAt = lockAt, at = function(t, chance)
			local f = lockAt(t, chance)
			if (f >= 1) then
				do return Js.ospread(chance) end
			end
			local cw = (chance.x2 - chance.x1)
			local ch = (chance.y2 - chance.y1)
			if ((cw ~= cw0) or (ch ~= ch0)) then
				cw0 = cw
				ch0 = ch
			end
			advance(t)
			local s = st
			local lo = (if tv then cw else Math.min(cw, LEAD_FRAME_MIN_W))
			local glideAt = (if lead.offside then lead.durS else (lockTime(chance) - SETTLE))
			local endFade = (1 - smooth(((t - (glideAt - LEAD_WIDE_OUT_S)) / LEAD_WIDE_OUT_S)))
			local hi = (if tv then (cw * LEAD_TV_MAX_RATIO) else (cw * (1 + (((LEAD_WIDE_MAX - 1) * wideAt(t, cw)) * endFade))))
			local w = Math.min(hi, Math.max(lo, s.sx, ((s.sy * cw) / ch)))
			local h = ((w * ch) / cw)
			local cx = clampC(s.cx, (w / 2), -4, 72)
			local cy = clampC(s.cy, (h / 2), -7, 112)
			local raw = Js.O({ x1 = (cx - (w / 2)), x2 = (cx + (w / 2)), y1 = (cy - (h / 2)), y2 = (cy + (h / 2)) }, { "x1", "x2", "y1", "y2" })
			local own = (if tv then keepSafe(raw, lead.ballAt(t)) else keepBall(raw, lead.ballAt(t)))
			local mix = function(a, b)
				return (a + ((b - a) * f))
			end
			if tv then
				local ow = (own.x2 - own.x1)
				local oh = (own.y2 - own.y1)
				local zw = (ow * Math.pow((cw / ow), f))
				local zh = (oh * Math.pow((ch / oh), f))
				local zx = mix(((own.x1 + own.x2) / 2), ((chance.x1 + chance.x2) / 2))
				local zy = mix(((own.y1 + own.y2) / 2), ((chance.y1 + chance.y2) / 2))
				local z = Js.O({ x1 = (zx - (zw / 2)), x2 = (zx + (zw / 2)), y1 = (zy - (zh / 2)), y2 = (zy + (zh / 2)) }, { "x1", "x2", "y1", "y2" })
				do return keepSafe(z, lead.ballAt(t), (1 - f)) end
			end
			do return Js.O({ x1 = mix(own.x1, chance.x1), x2 = mix(own.x2, chance.x2), y1 = mix(own.y1, chance.y1), y2 = mix(own.y2, chance.y2) }, { "x1", "x2", "y1", "y2" }) end
		end }, { "lockTime", "lockAt", "at" }) end
	end
	exports.leadInCamera = leadInCamera
	gaussSmooth = function(v, sigma)
		if ((not (sigma > 0)) or (Js.alen(v) < 2)) then
			do return Js.aspread(v) end
		end
		local R = math.ceil((3 * sigma))
		local k = Js.alit()
		do
			local j = (-R)
			local _first8 = true
			while true do
				if not _first8 then
					j += 1
				end
				_first8 = false
				if not (j <= R) then break end
				A.push(k, Math.exp(((-(j * j)) / ((2 * sigma) * sigma))))
			end
		end
		local n = Js.alen(v)
		do return A.map(v, function(_, i)
			local s = 0
			local w = 0
			do
				local j = (-R)
				local _first9 = true
				while true do
					if not _first9 then
						j += 1
					end
					_first9 = false
					if not (j <= R) then break end
					local q = v[Math.min((n - 1), Math.max(0, (i + j))) + 1]
					s += (q * k[(j + R) + 1])
					w += k[(j + R) + 1]
				end
			end
			do return (s / w) end
		end) end
	end
	glideCamera = function(lead)
		local STEP = (1 / 60)
		local SETTLE = LEAD_SETTLE_S
		local n = Math.max(1, math.ceil((lead.durS / STEP)))
		local tOf = function(i)
			return Math.min(lead.durS, (i * STEP))
		end
		local lockMemo = nil
		local lockTime = function(chance)
			local key = (Js.numstr(chance.x1) .. "," .. Js.numstr(chance.x2) .. "," .. Js.numstr(chance.y1) .. "," .. Js.numstr(chance.y2))
			if ((not lockMemo) or (lockMemo.key ~= key)) then
				lockMemo = Js.O({ key = key, t = leadLockTime(lead, chance) }, { "key", "t" })
			end
			do return lockMemo.t end
		end
		local followW = function(t, chance)
			if lead.offside then
				do return 1 end
			end
			local lt = lockTime(chance)
			if (lt <= 0) then
				do return 0 end
			end
			do return (1 - smoother(((t - (lt - SETTLE)) / SETTLE))) end
		end
		local plan = nil
		local planFor = function(chance)
			local key = (Js.numstr(chance.x1) .. "," .. Js.numstr(chance.x2) .. "," .. Js.numstr(chance.y1) .. "," .. Js.numstr(chance.y2))
			if (plan and (plan.key == key)) then
				do return plan end
			end
			local cw = (chance.x2 - chance.x1)
			local ch = (chance.y2 - chance.y1)
			local ex = ((chance.x1 + chance.x2) / 2)
			local ey = ((chance.y1 + chance.y2) / 2)
			local bx = Js.alit()
			local by = Js.alit()
			for i = 0, math.floor(n) do
				local b = lead.ballAt(tOf(i))
				A.push(bx, b.x)
				A.push(by, b.y)
			end
			local sig = (GLIDE_SIGMA_S / STEP)
			local fx = gaussSmooth(bx, sig)
			local fy = gaussSmooth(by, sig)
			local lt = (if lead.offside then lead.durS else Math.max(STEP, lockTime(chance)))
			local sx0 = fx[1]
			local sy0 = fy[1]
			local p0 = (if (lead.passEnd and Js.T(Js.alen(lead.passEnd))) then lead.ballAt(Math.min(lead.durS, lead.passEnd[1])) else lead.ballAt(Math.min(lead.durS, 1)))
			local b0 = lead.ballAt(0)
			local startW = Math.min(cw, Math.max(LEAD_FRAME_MIN_W, (math.abs((p0.x - b0.x)) + 14), (((math.abs((p0.y - b0.y)) + 14) * cw) / ch)))
			local z0 = (startW / cw)
			local rawX = Js.alit()
			local rawY = Js.alit()
			local zBase = Js.alit()
			for i = 0, math.floor(n) do
				local u = smoother((tOf(i) / lt))
				local gx = (sx0 + ((ex - sx0) * u))
				local gy = (sy0 + ((ey - sy0) * u))
				A.push(rawX, (gx + ((fx[i + 1] - gx) * GLIDE_FOLLOW)))
				A.push(rawY, (gy + ((fy[i + 1] - gy) * GLIDE_FOLLOW)))
				A.push(zBase, (z0 + ((1 - z0) * u)))
			end
			local cxs = gaussSmooth(A.map(rawX, function(x)
				return Math.min((72 - (cw / 2)), Math.max((-4 + (cw / 2)), x))
			end), (sig * 0.5))
			local cys = gaussSmooth(A.map(rawY, function(y)
				return Math.min((112 - (ch / 2)), Math.max((-7 + (ch / 2)), y))
			end), (sig * 0.5))
			local wOf = function(i)
				return followW(tOf(i), chance)
			end
			local need = A.map(cxs, function(x, i)
				local w = wOf(i)
				local fx2 = (ex + ((x - ex) * w))
				local fy2 = (ey + ((cys[i + 1] - ey) * w))
				do return Math.max(zBase[i + 1], ((2 * (math.abs((bx[i + 1] - fx2)) + GLIDE_BALL_ROOM)) / cw), ((2 * (math.abs((by[i + 1] - fy2)) + GLIDE_BALL_ROOM)) / ch)) end
			end)
			local H = Math.round((GLIDE_HOLD_S / STEP))
			local held = A.map(need, function(_, i)
				local m = 0
				do
					local j = Math.max(0, (i - H))
					local _first10 = true
					while true do
						if not _first10 then
							j += 1
						end
						_first10 = false
						if not (j <= Math.min(n, (i + H))) then break end
						m = Math.max(m, need[j + 1])
					end
				end
				do return m end
			end)
			local zs = A.map(gaussSmooth(held, (GLIDE_ZOOM_SIGMA_S / STEP)), function(z, i)
				local out = Math.min(GLIDE_WIDE_MAX, Math.max(zBase[i + 1], z))
				local fade = (if lead.offside then 1 else (1 - smoother(((tOf(i) - (lt - GLIDE_HOLD_S)) / GLIDE_HOLD_S))))
				do return (1 + ((out - 1) * fade)) end
			end)
			local fxs = A.map(cxs, function(x, i)
				return (ex + ((x - ex) * wOf(i)))
			end)
			local fys = A.map(cys, function(y, i)
				return (ey + ((y - ey) * wOf(i)))
			end)
			local past = function(b, c, half)
				local m = Math.min(1, (half / 4))
				do return (if (b > ((c + half) - m)) then (b - ((c + half) - m)) else (if (b < ((c - half) + m)) then (b - ((c - half) + m)) else 0)) end
			end
			local nudge = function(raw)
				local Hn = Math.round((GLIDE_NUDGE_HOLD_S / STEP))
				local held2 = A.map(raw, function(_, i)
					local m = 0
					do
						local j = Math.max(0, (i - Hn))
						local _first11 = true
						while true do
							if not _first11 then
								j += 1
							end
							_first11 = false
							if not (j <= Math.min(n, (i + Hn))) then break end
							if (math.abs(raw[j + 1]) > math.abs(m)) then
								m = raw[j + 1]
							end
						end
					end
					do return m end
				end)
				do return A.map(gaussSmooth(held2, (GLIDE_NUDGE_SIGMA_S / STEP)), function(d, i)
					return (d * smoother((2 * wOf(i))))
				end) end
			end
			local nx = nudge(A.map(fxs, function(x, i)
				return past(bx[i + 1], x, ((zs[i + 1] * cw) / 2))
			end))
			local ny = nudge(A.map(fys, function(y, i)
				return past(by[i + 1], y, ((zs[i + 1] * ch) / 2))
			end))
			plan = Js.O({ key = key, cx = A.map(fxs, function(x, i)
				return (x + nx[i + 1])
			end), cy = A.map(fys, function(y, i)
				return (y + ny[i + 1])
			end), w = A.map(zs, function(z)
				return (z * cw)
			end) }, { "key", "cx", "cy", "w" })
			do return plan end
		end
		local sample = function(a, t)
			local f = Math.min(n, Math.max(0, (t / STEP)))
			local i = math.floor(f)
			local g = (f - i)
			do return (a[i + 1] + ((a[Math.min(n, (i + 1)) + 1] - a[i + 1]) * g)) end
		end
		do return Js.O({ lockTime = lockTime, lockAt = function(t, chance)
			return (if lead.offside then 0 else (1 - followW(t, chance)))
		end, at = function(t, chance)
			local w = followW(t, chance)
			if (w <= 0) then
				do return Js.ospread(chance) end
			end
			local P = planFor(chance)
			local cw = (chance.x2 - chance.x1)
			local ch = (chance.y2 - chance.y1)
			local cx = sample(P.cx, t)
			local cy = sample(P.cy, t)
			local fw = sample(P.w, t)
			local fh = ((fw * ch) / cw)
			do return Js.O({ x1 = (cx - (fw / 2)), x2 = (cx + (fw / 2)), y1 = (cy - (fh / 2)), y2 = (cy + (fh / 2)) }, { "x1", "x2", "y1", "y2" }) end
		end }, { "lockTime", "lockAt", "at" }) end
	end
	alongKeys = function(keys, t, ease)
		if ease == nil then ease = true end
		if (t <= keys[1].t) then
			do return Js.ospread(keys[1].p) end
		end
		for i = 1, (Js.alen(keys)) - 1 do
			local a = keys[i]
			local b = keys[i + 1]
			if (t <= b.t) then
				local f = (if (b.t > a.t) then ((t - a.t) / (b.t - a.t)) else 1)
				local g = (if ease then smooth(f) else f)
				do return Js.O({ x = (a.p.x + ((b.p.x - a.p.x) * g)), y = (a.p.y + ((b.p.y - a.p.y) * g)) }, { "x", "y" }) end
			end
		end
		do return Js.ospread(keys[Js.alen(keys)].p) end
	end
	exports.alongKeys = alongKeys
	ballAlong = function(keys, t)
		if (t <= keys[1].t) then
			do return Js.ospread(keys[1].p, Js.O({ z = 0 }, { "z" })) end
		end
		for i = 1, (Js.alen(keys)) - 1 do
			local a = keys[i]
			local b = keys[i + 1]
			if (t <= b.t) then
				local f = (if (b.t > a.t) then ((t - a.t) / (b.t - a.t)) else 1)
				local g = (if b.pass then (f * (1.3 - (0.3 * f))) else f)
				local endZ = ((function() local _v = b.pass; if _v == nil then return nil end; _v = _v.endZ; return _v end)() or 0)
				local z = (if (b.pass and (b.pass.h > 0)) then ((endZ * f) + (((4 * Math.max(0, (b.pass.h - (endZ / 2)))) * f) * (1 - f))) else 0)
				do return Js.O({ x = (a.p.x + ((b.p.x - a.p.x) * g)), y = (a.p.y + ((b.p.y - a.p.y) * g)), z = z }, { "x", "y", "z" }) end
			end
		end
		local e = keys[Js.alen(keys)].p
		do return Js.O({ x = e.x, y = e.y, z = 0 }, { "x", "y", "z" }) end
	end
	exports.ballAlong = ballAlong
	LEAD_SETTLE_S = 1.5
	exports.LEAD_SETTLE_S = LEAD_SETTLE_S
	LEAD_FRAME_NEAR = 16
	exports.LEAD_FRAME_NEAR = LEAD_FRAME_NEAR
	LEAD_FOLLOW_OMEGA = 3
	exports.LEAD_FOLLOW_OMEGA = LEAD_FOLLOW_OMEGA
	LEAD_FOLLOW_TOP = 30
	exports.LEAD_FOLLOW_TOP = LEAD_FOLLOW_TOP
	LEAD_FRAME_MIN_W = 28
	exports.LEAD_FRAME_MIN_W = LEAD_FRAME_MIN_W
	LEAD_FOLLOW_SIZE_OMEGA = 0.8
	exports.LEAD_FOLLOW_SIZE_OMEGA = LEAD_FOLLOW_SIZE_OMEGA
	LEAD_FOLLOW_TOP_W = 1.2
	exports.LEAD_FOLLOW_TOP_W = LEAD_FOLLOW_TOP_W
	LEAD_ROOM = 0
	exports.LEAD_ROOM = LEAD_ROOM
	LEAD_LONG_PASS = 0.9
	exports.LEAD_LONG_PASS = LEAD_LONG_PASS
	LEAD_WIDE_MAX = 1.25
	exports.LEAD_WIDE_MAX = LEAD_WIDE_MAX
	LEAD_WIDE_IN_S = 1.5
	exports.LEAD_WIDE_IN_S = LEAD_WIDE_IN_S
	LEAD_WIDE_OUT_S = 2
	exports.LEAD_WIDE_OUT_S = LEAD_WIDE_OUT_S
	LEAD_TV_MAX_RATIO = 1.2
	exports.LEAD_TV_MAX_RATIO = LEAD_TV_MAX_RATIO
	LEAD_TV_MARGIN = 3
	exports.LEAD_TV_MARGIN = LEAD_TV_MARGIN
	LEAD_TV_AIM_S = 0.9
	exports.LEAD_TV_AIM_S = LEAD_TV_AIM_S
	LEAD_TV_LOOK_S = 1.2
	exports.LEAD_TV_LOOK_S = LEAD_TV_LOOK_S
	LEAD_TV_GOAL_Y = 42
	exports.LEAD_TV_GOAL_Y = LEAD_TV_GOAL_Y
	LEAD_TV_OMEGA = 2.4
	exports.LEAD_TV_OMEGA = LEAD_TV_OMEGA
	LEAD_TV_OMEGA_OUT = 1.6
	exports.LEAD_TV_OMEGA_OUT = LEAD_TV_OMEGA_OUT
	LEAD_TV_OMEGA_SIZE = 1
	exports.LEAD_TV_OMEGA_SIZE = LEAD_TV_OMEGA_SIZE
	LEAD_TV_TOP = 34
	exports.LEAD_TV_TOP = LEAD_TV_TOP
	LEAD_TV_SETTLE_S = 2.5
	exports.LEAD_TV_SETTLE_S = LEAD_TV_SETTLE_S
	LEAD_TV_SAFE = Js.O({ l = 0.15, r = 0.15, t = 0.1, b = 0.3 }, { "l", "r", "t", "b" })
	exports.LEAD_TV_SAFE = LEAD_TV_SAFE
	LEAD_LOCK_AREA = "six"
	exports.LEAD_LOCK_AREA = LEAD_LOCK_AREA
	LOCK_AREAS = Js.O({ six = Js.O({ depth = M_pitch.SIX_DEPTH, l = M_pitch.SIX_L, r = M_pitch.SIX_R }, { "depth", "l", "r" }), box = Js.O({ depth = M_pitch.BOX_DEPTH, l = M_pitch.BOX_L, r = M_pitch.BOX_R }, { "depth", "l", "r" }) }, { "six", "box" })
	smooth = function(f)
		local c = Math.min(1, Math.max(0, f))
		do return ((c * c) * (3 - (2 * c))) end
	end
	ballMargin = function(v)
		return Math.min(2.5, ((v.x2 - v.x1) / 5), ((v.y2 - v.y1) / 5))
	end
	GLIDE_FOLLOW = 0.7
	exports.GLIDE_FOLLOW = GLIDE_FOLLOW
	GLIDE_SIGMA_S = 0.5
	exports.GLIDE_SIGMA_S = GLIDE_SIGMA_S
	GLIDE_HOLD_S = 0.5
	exports.GLIDE_HOLD_S = GLIDE_HOLD_S
	GLIDE_ZOOM_SIGMA_S = 0.22
	exports.GLIDE_ZOOM_SIGMA_S = GLIDE_ZOOM_SIGMA_S
	GLIDE_WIDE_MAX = 1.5
	exports.GLIDE_WIDE_MAX = GLIDE_WIDE_MAX
	GLIDE_BALL_ROOM = 3
	exports.GLIDE_BALL_ROOM = GLIDE_BALL_ROOM
	GLIDE_NUDGE_HOLD_S = 0.45
	exports.GLIDE_NUDGE_HOLD_S = GLIDE_NUDGE_HOLD_S
	GLIDE_NUDGE_SIGMA_S = 0.25
	exports.GLIDE_NUDGE_SIGMA_S = GLIDE_NUDGE_SIGMA_S
	smoother = function(f)
		local c = Math.min(1, Math.max(0, f))
		do return (((c * c) * c) * ((c * ((c * 6) - 15)) + 10)) end
	end
	LEAD_MAX_RUN = 9
	exports.LEAD_MAX_RUN = LEAD_MAX_RUN
end
