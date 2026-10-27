--!nocheck
--!nolint
-- Generated from lib/star/fiveASide/render.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_pitch = import("lib/star/pitch")
	local M_figure3d = import("lib/star/figure3d")
	local M_drawPlayerHead = import("lib/star/drawPlayerHead")
	local M_figureSkin = import("lib/star/figureSkin")
	local TC, ROLE_KIT, GRASS_TILE, grassTile, makeGrassTile, cameraFor, cameraContaining, projectionFor, drawPitch, drawRaisedGoal, drawGoal, FIGURE_R, FEET_Y, HIP_Y, SHOULDER_Y, NECK_Y, HEAD_BASE_R, HEAD_ANCHOR, ANATOMY, FIGURE_HEIGHT_R, FIGURE_HEAD_R, runPhase, poseFor, bodyPoseFor, feetFor, paintBody, drawFigure, figureRForHeight, MATCH_FIGURE_HEIGHT_R, MATCH_FIGURE_R_MULT, MATCH_SCALE, MATCH_KEEPER_R_SHARE, MATCH_KEEPER_SCALE, MATCH_FRAME_W_M, sameSizeScale, MAX_KEEPER_LEAN, drawFigureAt, drawKeeper, drawKeeperAt, BALL_MIN_R, drawBall, AIM_ARROW_LENGTH, drawAim
	makeGrassTile = function()
		if (Js.document == nil) then
			do return nil end
		end
		local c = Js.document.createElement("canvas")
		c.width = GRASS_TILE
		c.height = GRASS_TILE
		local g = c.getContext("2d")
		if (not g) then
			do return nil end
		end
		g.fillStyle = "rgba(0,0,0,0)"
		g.fillRect(0, 0, GRASS_TILE, GRASS_TILE)
		local s = 1234567
		local rnd = function()
			s = Js.band(((s * 1103515245) + 12345), 2147483647)
			do return (s / 2147483647) end
		end
		for i = 0, 899 do
			local x = (rnd() * GRASS_TILE)
			local y = (rnd() * GRASS_TILE)
			g.fillStyle = (if (rnd() < 0.5) then "rgba(255,255,255,0.022)" else "rgba(0,0,0,0.028)")
			g.fillRect(x, y, 1, 1)
		end
		do return c end
	end
	cameraFor = function(rules, on, W, H, prev, ease)
		if ease == nil then ease = 0.1 end
		local full = rules.view
		local fullW = (full.x2 - full.x1)
		local fullH = (full.y2 - full.y1)
		local h = Math.min(fullH, (if (W > 0) then ((fullW * H) / W) else fullH))
		local cy = Math.max((full.y1 + (h / 2)), Math.min((full.y2 - (h / 2)), on.y))
		local want = Js.O({ x1 = full.x1, x2 = full.x2, y1 = (cy - (h / 2)), y2 = (cy + (h / 2)) }, { "x1", "x2", "y1", "y2" })
		if (not prev) then
			do return want end
		end
		if (math.abs(((prev.y2 - prev.y1) - h)) > 0.01) then
			do return want end
		end
		local lerp = function(a, b)
			return (a + ((b - a) * Math.max(0, Math.min(1, ease))))
		end
		do return Js.O({ x1 = want.x1, x2 = want.x2, y1 = lerp(prev.y1, want.y1), y2 = lerp(prev.y2, want.y2) }, { "x1", "x2", "y1", "y2" }) end
	end
	exports.cameraFor = cameraFor
	cameraContaining = function(must, W, H)
		local mw = Math.max(0.001, (must.x2 - must.x1))
		local mh = Math.max(0.001, (must.y2 - must.y1))
		local aspect = (if ((W > 0) and (H > 0)) then (W / H) else (mw / mh))
		local w = mw
		local h = mh
		if ((mw / mh) < aspect) then
			w = (mh * aspect)
		else
			h = (mw / aspect)
		end
		local cx = ((must.x1 + must.x2) / 2)
		local cy = ((must.y1 + must.y2) / 2)
		do return Js.O({ x1 = (cx - (w / 2)), x2 = (cx + (w / 2)), y1 = (cy - (h / 2)), y2 = (cy + (h / 2)) }, { "x1", "x2", "y1", "y2" }) end
	end
	exports.cameraContaining = cameraContaining
	projectionFor = function(rules, W, H, camera)
		local vp = (if camera ~= nil then camera else rules.view)
		local sx = (W / (vp.x2 - vp.x1))
		local sy = (H / (vp.y2 - vp.y1))
		do return Js.O({ px = function(x)
			return ((x - vp.x1) * sx)
		end, py = function(y)
			return ((y - vp.y1) * sy)
		end, unit = Math.min(sx, sy), W = W, H = H }, { "px", "py", "unit", "W", "H" }) end
	end
	exports.projectionFor = projectionFor
	drawPitch = function(ctx, rules, p)
		local _d1 = p
		local px = _d1.px
		local py = _d1.py
		local unit = _d1.unit
		local W = _d1.W
		local H = _d1.H
		local _d2 = rules
		local pitch = _d2.pitch
		ctx.fillStyle = TC.pitch
		ctx.fillRect(0, 0, W, H)
		if (grassTile == nil) then
			grassTile = makeGrassTile()
		end
		if grassTile then
			local pat = ctx.createPattern(grassTile, "repeat")
			if pat then
				ctx.save()
				ctx.translate(math.fmod(px(0), GRASS_TILE), math.fmod(py(0), GRASS_TILE))
				ctx.fillStyle = pat
				ctx.fillRect((-GRASS_TILE), (-GRASS_TILE), (W + (GRASS_TILE * 2)), (H + (GRASS_TILE * 2)))
				ctx.restore()
			end
		end
		local wear = function(x, y, rx, ry, alpha)
			local cx = px(x)
			local cy = py(y)
			local g = ctx.createRadialGradient(cx, cy, 0, cx, cy, (Math.max(rx, ry) * unit))
			g.addColorStop(0, ("rgba(120,132,26," .. Js.numstr(alpha) .. ")"))
			g.addColorStop(1, "rgba(120,132,26,0)")
			ctx.save()
			ctx.translate(cx, cy)
			ctx.scale(1, (ry / rx))
			ctx.translate((-cx), (-cy))
			ctx.fillStyle = g
			ctx.fillRect((cx - ((rx * unit) * 1.3)), (cy - ((rx * unit) * 1.3)), ((rx * unit) * 2.6), ((rx * unit) * 2.6))
			ctx.restore()
		end
		local goalMid = ((rules.goal.x1 + rules.goal.x2) / 2)
		if (rules.markings == "penalty-area") then
			wear(goalMid, (pitch.y1 + 1.9), 6.2, 2.4, 0.22)
			wear(goalMid, M_pitch.PEN_SPOT_Y, 3.2, 2.2, 0.16)
			ctx.strokeStyle = TC.line
			ctx.lineWidth = Math.max(1.5, (unit * 0.11))
			ctx.beginPath()
			ctx.moveTo(px(pitch.x1), py(pitch.y1))
			ctx.lineTo(px(pitch.x2), py(pitch.y1))
			ctx.stroke()
			ctx.strokeRect(px(M_pitch.SIX_L), py(pitch.y1), ((M_pitch.SIX_R - M_pitch.SIX_L) * unit), (M_pitch.SIX_DEPTH * unit))
			ctx.strokeRect(px(M_pitch.BOX_L), py(pitch.y1), ((M_pitch.BOX_R - M_pitch.BOX_L) * unit), (M_pitch.BOX_DEPTH * unit))
			local half = Math.acos(Math.max(-1, Math.min(1, ((M_pitch.BOX_DEPTH - M_pitch.PEN_SPOT_Y) / M_pitch.ARC_R))))
			ctx.strokeStyle = TC.lineFaint
			ctx.beginPath()
			ctx.arc(px(M_pitch.CX), py(M_pitch.PEN_SPOT_Y), (M_pitch.ARC_R * unit), ((Math.PI / 2) - half), ((Math.PI / 2) + half))
			ctx.stroke()
			ctx.fillStyle = TC.line
			ctx.beginPath()
			ctx.arc(px(M_pitch.CX), py(M_pitch.PEN_SPOT_Y), Math.max(2, (unit * 0.16)), 0, (Math.PI * 2))
			ctx.fill()
			ctx.strokeStyle = TC.line
			ctx.lineWidth = Math.max(1.5, (unit * 0.11))
			do
				local _arr3 = Js.alit(pitch.x1, pitch.x2)
				local _i4 = 0
				while _i4 < Js.alen(_arr3) do
					_i4 += 1
					local x = _arr3[_i4]
					ctx.beginPath()
					ctx.moveTo(px(x), py(pitch.y1))
					ctx.lineTo(px(x), py(pitch.y2))
					ctx.stroke()
				end
			end
			ctx.beginPath()
			ctx.arc(px(pitch.x1), py(pitch.y1), (M_pitch.CORNER_R * unit), 0, (Math.PI / 2))
			ctx.stroke()
			ctx.beginPath()
			ctx.arc(px(pitch.x2), py(pitch.y1), (M_pitch.CORNER_R * unit), (Math.PI / 2), Math.PI)
			ctx.stroke()
			do return end
		end
		wear(goalMid, (pitch.y1 + 1.6), 4.2, 1.8, 0.2)
		wear(goalMid, (pitch.y2 - 1.6), 4.2, 1.8, 0.2)
		ctx.strokeStyle = TC.line
		ctx.lineWidth = Math.max(1.5, (unit * 0.1))
		ctx.strokeRect(px(pitch.x1), py(pitch.y1), ((pitch.x2 - pitch.x1) * unit), ((pitch.y2 - pitch.y1) * unit))
		local mid = ((pitch.y1 + pitch.y2) / 2)
		ctx.beginPath()
		ctx.moveTo(px(pitch.x1), py(mid))
		ctx.lineTo(px(pitch.x2), py(mid))
		ctx.stroke()
		ctx.beginPath()
		ctx.arc(px(((pitch.x1 + pitch.x2) / 2)), py(mid), (unit * 0.35), 0, (Math.PI * 2))
		ctx.fillStyle = TC.line
		ctx.fill()
		local dR = Math.min(6, ((pitch.x2 - pitch.x1) / 4))
		ctx.strokeStyle = TC.lineFaint
		do
			local _arr5 = Js.alit(Js.alit(pitch.y1, 0, Math.PI), Js.alit(pitch.y2, Math.PI, (Math.PI * 2)))
			local _i6 = 0
			while _i6 < Js.alen(_arr5) do
				_i6 += 1
				local _e7 = _arr5[_i6]
				local y = _e7[1]
				local from = _e7[2]
				local to = _e7[3]
				ctx.beginPath()
				ctx.arc(px(goalMid), py(y), (dR * unit), from, to)
				ctx.stroke()
			end
		end
	end
	exports.drawPitch = drawPitch
	drawRaisedGoal = function(ctx, p, goal, atY, depth, height)
		local _d8 = p
		local px = _d8.px
		local py = _d8.py
		local unit = _d8.unit
		local hpx = (height * unit)
		local bl = Js.O({ px = px(goal.x1), py = py(atY) }, { "px", "py" })
		local br = Js.O({ px = px(goal.x2), py = py(atY) }, { "px", "py" })
		local tl = Js.O({ px = bl.px, py = (bl.py - hpx) }, { "px", "py" })
		local tr = Js.O({ px = br.px, py = (br.py - hpx) }, { "px", "py" })
		local rl = Js.O({ px = bl.px, py = py((atY - depth)) }, { "px", "py" })
		local rr = Js.O({ px = br.px, py = py((atY - depth)) }, { "px", "py" })
		local ul = Js.O({ px = rl.px, py = (rl.py - hpx) }, { "px", "py" })
		local ur = Js.O({ px = rr.px, py = (rr.py - hpx) }, { "px", "py" })
		local path = function(q)
			ctx.beginPath()
			ctx.moveTo(q[1].px, q[1].py)
			for i = 1, (Js.alen(q)) - 1 do
				ctx.lineTo(q[i + 1].px, q[i + 1].py)
			end
			ctx.closePath()
		end
		local quad = function(q, fill)
			path(q)
			ctx.fillStyle = fill
			ctx.fill()
		end
		local seg = function(a, b)
			ctx.beginPath()
			ctx.moveTo(a.px, a.py)
			ctx.lineTo(b.px, b.py)
			ctx.stroke()
		end
		local lerp = function(a, b, f)
			return Js.O({ px = (a.px + ((b.px - a.px) * f)), py = (a.py + ((b.py - a.py) * f)) }, { "px", "py" })
		end
		local netting = function(q, cols, rows, alpha)
			ctx.save()
			path(q)
			ctx.clip()
			ctx.strokeStyle = ("rgba(255,255,255," .. Js.numstr(alpha) .. ")")
			ctx.lineWidth = Math.max(0.7, (unit * 0.028))
			for i = 0, math.floor(cols) do
				local f = (i / cols)
				seg(lerp(q[1], q[2], f), lerp(q[4], q[3], f))
			end
			for j = 0, math.floor(rows) do
				local f = (j / rows)
				seg(lerp(q[1], q[4], f), lerp(q[2], q[3], f))
			end
			ctx.restore()
		end
		local sh = (unit * 0.5)
		quad(A.map(Js.alit(rl, rr, br, bl), function(q)
			return Js.O({ px = (q.px + sh), py = (q.py + (sh * 0.3)) }, { "px", "py" })
		end), "rgba(0,0,0,0.09)")
		quad(Js.alit(bl, br, rr, rl), "rgba(20,50,32,0.05)")
		quad(Js.alit(rl, rr, ur, ul), "rgba(22,52,34,0.16)")
		netting(Js.alit(rl, rr, ur, ul), 34, 10, 0.42)
		ctx.strokeStyle = "#0f1a14"
		ctx.lineWidth = Math.max(1.8, (unit * 0.15))
		seg(rl, ul)
		seg(rr, ur)
		seg(ul, ur)
		quad(Js.alit(tl, tr, ur, ul), "rgba(236,245,239,0.30)")
		netting(Js.alit(tl, tr, ur, ul), 34, 5, 0.8)
		ctx.lineCap = "round"
		ctx.strokeStyle = TC.post
		ctx.lineWidth = Math.max(1.8, (unit * 0.12))
		seg(bl, tl)
		seg(br, tr)
		ctx.lineWidth = Math.max(2, (unit * 0.16))
		seg(tl, tr)
		ctx.lineCap = "butt"
		ctx.strokeStyle = "rgba(255,255,255,0.9)"
		ctx.lineWidth = Math.max(1.5, (unit * 0.11))
		seg(bl, br)
	end
	drawGoal = function(ctx, rules, p, atY, depth, opts)
		if depth == nil then depth = (if rules.netDepth ~= nil then rules.netDepth else 1.2) end
		local _d9 = p
		local px = _d9.px
		local py = _d9.py
		local unit = _d9.unit
		local _d10 = rules
		local goal = _d10.goal
		local behind = (if (atY == rules.pitch.y1) then -1 else 1)
		if (Js.T((function() local _v = opts; if _v == nil then return nil end; _v = _v.height; return _v end)()) and (opts.height > 0)) then
			drawRaisedGoal(ctx, p, goal, atY, depth, opts.height)
			do return end
		end
		ctx.save()
		ctx.beginPath()
		ctx.rect(px(goal.x1), py((atY + (if (behind < 0) then (-depth) else 0))), ((goal.x2 - goal.x1) * unit), (depth * unit))
		ctx.clip()
		ctx.fillStyle = "rgba(255,255,255,0.06)"
		ctx.fillRect(px(goal.x1), py((atY - depth)), ((goal.x2 - goal.x1) * unit), ((depth * 2) * unit))
		ctx.strokeStyle = TC.net
		ctx.lineWidth = 1
		local step = Math.max(4, (unit * 0.32))
		do
			local x = px(goal.x1)
			local _first11 = true
			while true do
				if not _first11 then
					x += step
				end
				_first11 = false
				if not (x <= px(goal.x2)) then break end
				ctx.beginPath()
				ctx.moveTo(x, py((atY - depth)))
				ctx.lineTo(x, py((atY + depth)))
				ctx.stroke()
			end
		end
		do
			local y = py((atY - depth))
			local _first12 = true
			while true do
				if not _first12 then
					y += step
				end
				_first12 = false
				if not (y <= py((atY + depth))) then break end
				ctx.beginPath()
				ctx.moveTo(px(goal.x1), y)
				ctx.lineTo(px(goal.x2), y)
				ctx.stroke()
			end
		end
		ctx.restore()
		ctx.strokeStyle = TC.post
		ctx.lineWidth = Math.max(2, (unit * 0.16))
		ctx.lineCap = "round"
		ctx.beginPath()
		ctx.moveTo(px(goal.x1), py(atY))
		ctx.lineTo(px(goal.x1), py((atY + (behind * depth))))
		ctx.moveTo(px(goal.x2), py(atY))
		ctx.lineTo(px(goal.x2), py((atY + (behind * depth))))
		ctx.moveTo(px(goal.x1), py(atY))
		ctx.lineTo(px(goal.x2), py(atY))
		ctx.stroke()
		ctx.lineCap = "butt"
	end
	exports.drawGoal = drawGoal
	runPhase = function(now, seedX)
		do return ((now * 9) + (seedX * 1.7)) end
	end
	exports.runPhase = runPhase
	poseFor = function(motion, id, x, y)
		local prev = motion:get(id)
		motion:set(id, Js.O({ x = x, y = y }, { "x", "y" }))
		if (not prev) then
			do return "idle" end
		end
		do return (if (Math.hypot((x - prev.x), (y - prev.y)) > 0.02) then "run" else "idle") end
	end
	exports.poseFor = poseFor
	bodyPoseFor = function(pose, phase, kickFoot)
		local swing = (if (pose == "run") then Math.sin(phase) else 0)
		local kick = (if (pose == "kick") then 1 else 0)
		local open = (if (pose == "receive") then 1 else 0)
		do return Js.ospread(Js.O({ legSwing = swing, kick = kick, armSpread = ((open * 0.5) + (kick * 0.3)), armLift = (-0.55 + (open * 0.5)) }, { "legSwing", "kick", "armSpread", "armLift" }), (if (Js.T(kick) and Js.T(kickFoot)) then Js.O({ kickFoot = Math.sign(kickFoot) }, { "kickFoot" }) else Js.O({}, nil))) end
	end
	exports.bodyPoseFor = bodyPoseFor
	feetFor = function(r, pose)
		local swing = ((function() local _v = pose; if _v == nil then return nil end; _v = _v.legSwing; return _v end)() or 0)
		local kick = ((function() local _v = pose; if _v == nil then return nil end; _v = _v.kick; return _v end)() or 0)
		local kf = Math.sign(((function() local _v = pose; if _v == nil then return nil end; _v = _v.kickFoot; return _v end)() or 0))
		if ((kick > 0) and (kf ~= 0)) then
			do return M_figure3d.oneFootKickFeet(r, FEET_Y, kick, kf, (function() local _v = pose; if _v == nil then return nil end; _v = _v.swingAmp; return _v end)(), (function() local _v = pose; if _v == nil then return nil end; _v = _v.swingCross; return _v end)(), (function() local _v = pose; if _v == nil then return nil end; _v = _v.plantBend; return _v end)()) end
		end
		local stride = (((swing * 0.42) + (kick * 0.55)) * r)
		local footY = ((FEET_Y * r) - (math.abs(stride) * 0.15))
		do return Js.O({ lx = (((-r) * 0.19) - (stride * 0.35)), ly = footY, rx = ((r * 0.19) + (stride * 0.35)), ry = footY }, { "lx", "ly", "rx", "ry" }) end
	end
	exports.feetFor = feetFor
	paintBody = function(ctx, r, look, faceStyle, fakeFaceStyle, pose, edge)
		if edge == nil then edge = 1 end
		local skin = (if look.skin ~= nil then look.skin else TC.skin)
		local spread = ((function() local _v = pose; if _v == nil then return nil end; _v = _v.armSpread; return _v end)() or 0)
		local lift = ((function() local _v = pose; if _v == nil then return nil end; _v = _v.armLift; return _v end)() or -0.55)
		local crouch = ((function() local _v = pose; if _v == nil then return nil end; _v = _v.crouch; return _v end)() or 0)
		local swing = ((function() local _v = pose; if _v == nil then return nil end; _v = _v.legSwing; return _v end)() or 0)
		local sink = ((crouch * r) * 0.16)
		local feet = feetFor(r, pose)
		ctx.lineCap = "round"
		ctx.strokeStyle = skin
		ctx.lineWidth = Math.max(1.4, (r * 0.15))
		ctx.beginPath()
		local plant = (if ((((function() local _v = pose; if _v == nil then return nil end; _v = _v.kick; return _v end)() or 0) > 0) and Js.T((function() local _v = pose; if _v == nil then return nil end; _v = _v.kickFoot; return _v end)())) then ((function() local _v = pose; if _v == nil then return nil end; _v = _v.plantBend; return _v end)() or 0) else 0)
		local plantSide = (-(Math.sign(((function() local _v = pose; if _v == nil then return nil end; _v = _v.kickFoot; return _v end)() or 0))))
		do
			local _arr13 = Js.alit(Js.alit(((-r) * 0.16), feet.lx, feet.ly), Js.alit((r * 0.16), feet.rx, feet.ry))
			local _i14 = 0
			while _i14 < Js.alen(_arr13) do
				_i14 += 1
				local _e15 = _arr13[_i14]
				local hx = _e15[1]
				local fx = _e15[2]
				local fy = _e15[3]
				ctx.moveTo(hx, ((HIP_Y * r) + sink))
				if ((plant > 0) and (Math.sign(hx) == plantSide)) then
					ctx.lineTo((((hx + fx) / 2) + (((plantSide * r) * 0.1) * plant)), ((((HIP_Y * r) + sink) + fy) / 2))
				end
				ctx.lineTo(fx, fy)
			end
		end
		ctx.stroke()
		ctx.fillStyle = TC.boot
		do
			local _arr16 = Js.alit(Js.alit(feet.lx, feet.ly), Js.alit(feet.rx, feet.ry))
			local _i17 = 0
			while _i17 < Js.alen(_arr16) do
				_i17 += 1
				local _e18 = _arr16[_i17]
				local fx = _e18[1]
				local fy = _e18[2]
				ctx.beginPath()
				ctx.ellipse(fx, fy, (r * 0.11), (r * 0.06), 0, 0, (Math.PI * 2))
				ctx.fill()
			end
		end
		ctx.fillStyle = look.shorts
		local shortsTop = (((HIP_Y - 0.1) * r) + sink)
		local shortsH = (r * 0.3)
		ctx.beginPath()
		if ctx.roundRect then
			ctx.roundRect(((-r) * 0.31), shortsTop, (r * 0.62), shortsH, (r * 0.1))
		else
			ctx.rect(((-r) * 0.31), shortsTop, (r * 0.62), shortsH)
		end
		ctx.fill()
		local shY = ((SHOULDER_Y * r) + sink)
		local waistY = (((HIP_Y - 0.04) * r) + sink)
		local shW = (r * 0.42)
		local waistW = (r * 0.29)
		ctx.beginPath()
		ctx.moveTo((-waistW), waistY)
		ctx.lineTo((-shW), (shY + (r * 0.1)))
		ctx.quadraticCurveTo((-shW), (shY - (r * 0.04)), ((-shW) * 0.6), (shY - (r * 0.07)))
		ctx.lineTo((shW * 0.6), (shY - (r * 0.07)))
		ctx.quadraticCurveTo(shW, (shY - (r * 0.04)), shW, (shY + (r * 0.1)))
		ctx.lineTo(waistW, waistY)
		ctx.closePath()
		ctx.fillStyle = look.shirt
		ctx.fill()
		ctx.strokeStyle = look.trim
		ctx.lineWidth = Math.max(1, ((r * 0.06) * edge))
		ctx.stroke()
		local armFromY = (shY + (r * 0.02))
		local armLen = (r * (0.42 + (spread * 0.5)))
		local outX = ((r * 0.3) + (armLen * (0.35 + (spread * 0.65))))
		local handY = (armFromY + ((armLen * (0.62 - (lift * 0.85))) * (1 - (spread * 0.45))))
		local handYFor = function(s)
			return (handY - (((s * swing) * r) * 0.22))
		end
		local lead = ((function() local _v = pose; if _v == nil then return nil end; _v = _v.armLead; return _v end)() or (if ((((function() local _v = pose; if _v == nil then return nil end; _v = _v.kick; return _v end)() or 0) > 0) and Js.T((function() local _v = pose; if _v == nil then return nil end; _v = _v.kickFoot; return _v end)())) then (-(Math.sign(pose.kickFoot))) else 0))
		local handX0 = function(s)
			return ((s * outX) * (if ((lead == 0) or (Math.sign(s) == Math.sign(lead))) then 1 else 0.62))
		end
		local handY0 = handYFor
		local tDrop = ((function() local _v = pose; if _v == nil then return nil end; _v = _v.trailDrop; return _v end)() or 0)
		local hIn = ((function() local _v = pose; if _v == nil then return nil end; _v = _v.handsIn; return _v end)() or 0)
		local shaped = ((tDrop > 0) or (hIn > 0))
		local handXFor = (if shaped then function(s)
			return M_figure3d.shapeHand(r, s, handX0(s), handY0(s), armFromY, lead, tDrop, hIn)[1]
		end else handX0)
		local handYForS = (if shaped then function(s)
			return M_figure3d.shapeHand(r, s, handX0(s), handY0(s), armFromY, lead, tDrop, hIn)[2]
		end else handY0)
		ctx.strokeStyle = skin
		ctx.lineWidth = Math.max(1.2, (r * 0.115))
		ctx.beginPath()
		do
			local _arr19 = Js.alit(-1, 1)
			local _i20 = 0
			while _i20 < Js.alen(_arr19) do
				_i20 += 1
				local s = _arr19[_i20]
				ctx.moveTo(((s * shW) * 0.82), armFromY)
				ctx.lineTo(handXFor(s), handYForS(s))
			end
		end
		ctx.stroke()
		ctx.strokeStyle = look.shirt
		ctx.lineWidth = Math.max(1.4, (r * 0.145))
		ctx.beginPath()
		do
			local _arr21 = Js.alit(-1, 1)
			local _i22 = 0
			while _i22 < Js.alen(_arr21) do
				_i22 += 1
				local s = _arr21[_i22]
				ctx.moveTo(((s * shW) * 0.82), armFromY)
				ctx.lineTo((((s * shW) * 0.82) + ((handXFor(s) - ((s * shW) * 0.82)) * 0.42)), (armFromY + ((handYForS(s) - armFromY) * 0.42)))
			end
		end
		ctx.stroke()
		if (function() local _v = pose; if _v == nil then return nil end; _v = _v.gloves; return _v end)() then
			ctx.fillStyle = "#f8fafc"
			ctx.strokeStyle = look.trim
			ctx.lineWidth = Math.max(1, (r * 0.05))
			do
				local _arr23 = Js.alit(-1, 1)
				local _i24 = 0
				while _i24 < Js.alen(_arr23) do
					_i24 += 1
					local s = _arr23[_i24]
					ctx.beginPath()
					ctx.arc(handXFor(s), handYForS(s), (r * 0.14), 0, (Math.PI * 2))
					ctx.fill()
					ctx.stroke()
				end
			end
		end
		M_drawPlayerHead.drawPlayerHead(ctx, 0, ((HEAD_ANCHOR * r) + sink), (HEAD_BASE_R * r), r, look.face, faceStyle, fakeFaceStyle)
		ctx.strokeStyle = look.trim
		ctx.lineWidth = Math.max(1, ((r * 0.07) * edge))
		ctx.beginPath()
		ctx.moveTo(((-r) * 0.12), ((NECK_Y * r) + sink))
		ctx.lineTo((r * 0.12), ((NECK_Y * r) + sink))
		ctx.stroke()
	end
	drawFigure = function(ctx, p, at, look, faceStyle, fakeFaceStyle, opts)
		local _d25 = p
		local px = _d25.px
		local py = _d25.py
		local unit = _d25.unit
		local r = Math.max(7, ((unit * FIGURE_R) * ((function() local _v = opts; if _v == nil then return nil end; _v = _v.scale; return _v end)() or 1)))
		local lift = Math.max(0, (if look.lift ~= nil then look.lift else 0))
		drawFigureAt(ctx, px(at.x), (py(at.y) + (r * FEET_Y)), r, look, faceStyle, fakeFaceStyle, Js.O({ liftPx = ((lift * unit) * 0.55), shadowR = ((r * 0.34) * (1 - Math.min(0.35, (lift * 0.12)))), label = look.label, star = look.star, pose = (function() local _v = opts; if _v == nil then return nil end; _v = _v.pose; return _v end)(), facing = (function() local _v = opts; if _v == nil then return nil end; _v = _v.facing; return _v end)() }, { "liftPx", "shadowR", "label", "star", "pose", "facing" }))
	end
	exports.drawFigure = drawFigure
	figureRForHeight = function(heightPx)
		do return Math.max(6, (heightPx / FIGURE_HEIGHT_R)) end
	end
	exports.figureRForHeight = figureRForHeight
	sameSizeScale = function(unit, widthPx)
		if ((not (unit > 0)) or (not (widthPx > 0))) then
			do return MATCH_SCALE end
		end
		do return (MATCH_SCALE * Math.max(1, ((widthPx / MATCH_FRAME_W_M) / unit))) end
	end
	exports.sameSizeScale = sameSizeScale
	drawFigureAt = function(ctx, x, groundY, r, look, faceStyle, fakeFaceStyle, opts)
		if opts == nil then opts = Js.O({}, nil) end
		local up = (if opts.liftPx ~= nil then opts.liftPx else 0)
		local is3d = ((if opts.skin ~= nil then opts.skin else M_figureSkin.figureSkin()) == "3d")
		if is3d then
			M_figure3d.drawSoftShadow(ctx, x, groundY, (if opts.shadowR ~= nil then opts.shadowR else (r * 0.34)), (r * 0.13))
		else
			ctx.fillStyle = TC.shadow
			ctx.beginPath()
			ctx.ellipse(x, groundY, (if opts.shadowR ~= nil then opts.shadowR else (r * 0.34)), (r * 0.13), 0, 0, (Math.PI * 2))
			ctx.fill()
		end
		ctx.save()
		ctx.translate(x, ((groundY - (r * FEET_Y)) - up))
		if Js.T(opts.facing) then
			ctx.rotate(opts.facing)
		end
		if is3d then
			M_figure3d.paintBody3d(ctx, r, look, faceStyle, fakeFaceStyle, opts.pose, ANATOMY, TC.skin)
		else
			paintBody(ctx, r, look, faceStyle, fakeFaceStyle, opts.pose, (if opts.edge ~= nil then opts.edge else 1))
		end
		ctx.restore()
		local crown = ((groundY - up) - (r * FIGURE_HEIGHT_R))
		if opts.star then
			ctx.save()
			ctx.beginPath()
			local sr = (r * 0.22)
			local sy = (crown - (sr * 1.3))
			for i = 0, 9 do
				local a = (((-Math.PI) / 2) + ((i * Math.PI) / 5))
				local rad = (if (math.fmod(i, 2) == 0) then sr else (sr * 0.45))
				local fx = (x + (Math.cos(a) * rad))
				local fy = (sy + (Math.sin(a) * rad))
				if (i == 0) then
					ctx.moveTo(fx, fy)
				else
					ctx.lineTo(fx, fy)
				end
			end
			ctx.closePath()
			if Js.T(opts.starRim) then
				ctx.lineJoin = "round"
				ctx.lineWidth = Math.max(1.5, (sr * 0.34))
				ctx.strokeStyle = opts.starRim
				ctx.stroke()
			end
			ctx.fillStyle = "#fde68a"
			ctx.fill()
			ctx.restore()
		end
		if Js.T(opts.label) then
			ctx.font = (if opts.labelBig then ("800 " .. Js.numstr(Math.max(15, (r * 0.6))) .. "px system-ui, sans-serif") else ("700 " .. Js.numstr(Math.max(8, (r * 0.3))) .. "px system-ui, sans-serif"))
			ctx.textAlign = "center"
			ctx.textBaseline = "alphabetic"
			ctx.lineWidth = (if opts.labelBig then Math.max(3.5, (r * 0.18)) else Math.max(2, (r * 0.1)))
			ctx.strokeStyle = (if opts.labelBig then "rgba(0,0,0,0.85)" else "rgba(0,0,0,0.65)")
			local ly = ((crown - (r * (if opts.star then 0.78 else 0.16))) - (if opts.labelBig then 4 else 0))
			ctx.strokeText(opts.label, x, ly)
			ctx.fillStyle = (if opts.labelColor ~= nil then opts.labelColor else "#ffffff")
			ctx.fillText(opts.label, x, ly)
			ctx.textAlign = "start"
		end
	end
	exports.drawFigureAt = drawFigureAt
	drawKeeper = function(ctx, p, at, look, pose, faceStyle, fakeFaceStyle, opts)
		local _d26 = p
		local px = _d26.px
		local py = _d26.py
		local unit = _d26.unit
		local r = Math.max(7, ((unit * FIGURE_R) * ((function() local _v = opts; if _v == nil then return nil end; _v = _v.scale; return _v end)() or 1)))
		drawKeeperAt(ctx, px(at.x), (py(at.y) + (r * FEET_Y)), r, look, pose, faceStyle, fakeFaceStyle)
	end
	exports.drawKeeper = drawKeeper
	drawKeeperAt = function(ctx, x, groundY, r, look, pose, faceStyle, fakeFaceStyle, opts)
		if opts == nil then opts = Js.O({}, nil) end
		local dive = Math.max(-1, Math.min(1, pose.dive))
		local lunge = Math.max(0, Math.min(1, pose.lunge))
		local lean = (dive * (0.25 + (lunge * 0.95)))
		drawFigureAt(ctx, x, groundY, r, look, faceStyle, fakeFaceStyle, Js.ospread(opts, Js.O({ facing = (lean + (if opts.facing ~= nil then opts.facing else 0)), shadowR = (if opts.shadowR ~= nil then opts.shadowR else (r * (0.34 + (lunge * 0.5)))), pose = Js.ospread(Js.O({ armSpread = (0.75 + (lunge * 0.25)), armLift = (0.15 + (lunge * 0.9)), gloves = true, crouch = (0.55 - (lunge * 0.55)) }, { "armSpread", "armLift", "gloves", "crouch" }), opts.pose) }, { "facing", "shadowR", "pose" })))
	end
	exports.drawKeeperAt = drawKeeperAt
	drawBall = function(ctx, p, at, z, scale)
		if z == nil then z = 0 end
		if scale == nil then scale = 1 end
		local _d27 = p
		local px = _d27.px
		local py = _d27.py
		local unit = _d27.unit
		local x = px(at.x)
		local y = py(at.y)
		local lift = ((z * unit) * 0.5)
		local r = Math.max(BALL_MIN_R, ((((unit * M_pitch.BALL_R) * 2.6) * (1 + (z * 0.06))) * scale))
		ctx.fillStyle = TC.shadow
		ctx.beginPath()
		ctx.ellipse(x, y, (r * (1 - Math.min(0.4, (z * 0.05)))), (r * 0.5), 0, 0, (Math.PI * 2))
		ctx.fill()
		ctx.fillStyle = TC.ballEdge
		ctx.beginPath()
		ctx.arc(x, (y - lift), (r + Math.max(1, (r * 0.18))), 0, (Math.PI * 2))
		ctx.fill()
		ctx.fillStyle = TC.ball
		ctx.beginPath()
		ctx.arc(x, (y - lift), r, 0, (Math.PI * 2))
		ctx.fill()
		ctx.fillStyle = TC.ballSeam
		ctx.beginPath()
		ctx.arc(x, (y - lift), (r * 0.34), 0, (Math.PI * 2))
		ctx.fill()
	end
	exports.drawBall = drawBall
	drawAim = function(ctx, p, from, dir, power)
		local _d28 = p
		local px = _d28.px
		local py = _d28.py
		local unit = _d28.unit
		local W = _d28.W
		local H = _d28.H
		local n = (function() local _l = Math.hypot(dir.x, dir.y); if Js.T(_l) then return _l end; return 1 end)()
		local heightSpan = (H / unit)
		local shown = ((power * heightSpan) * AIM_ARROW_LENGTH)
		local ax = px(from.x)
		local ay = py(from.y)
		local bx = px((from.x + ((dir.x / n) * shown)))
		local by = py((from.y + ((dir.y / n) * shown)))
		local ang = Math.atan2((by - ay), (bx - ax))
		local ux = Math.cos(ang)
		local uy = Math.sin(ang)
		local nx = (-uy)
		local ny = ux
		local arrowLen = (function() local _l = Math.hypot((bx - ax), (by - ay)); if Js.T(_l) then return _l end; return 1 end)()
		local headLen = Math.max((W * 0.02), Math.min((W * 0.045), (arrowLen * 0.45)))
		local headHalf = (W * 0.022)
		local shaftW = (W * 0.014)
		local hbx = (bx - (ux * headLen))
		local hby = (by - (uy * headLen))
		local shaftGrad = ctx.createLinearGradient(ax, ay, bx, by)
		shaftGrad.addColorStop(0, "#fb923c")
		shaftGrad.addColorStop(1, "#ea580c")
		ctx.strokeStyle = shaftGrad
		ctx.lineWidth = shaftW
		ctx.lineCap = "round"
		ctx.beginPath()
		ctx.moveTo(ax, ay)
		ctx.lineTo(hbx, hby)
		ctx.stroke()
		ctx.lineCap = "butt"
		ctx.beginPath()
		ctx.moveTo(bx, by)
		ctx.lineTo((hbx + (nx * headHalf)), (hby + (ny * headHalf)))
		ctx.lineTo((hbx - (nx * headHalf)), (hby - (ny * headHalf)))
		ctx.closePath()
		ctx.fillStyle = "#f97316"
		ctx.fill()
		ctx.lineJoin = "round"
		ctx.lineWidth = Math.max(1, (unit * 0.22))
		ctx.strokeStyle = "rgba(124,45,18,0.6)"
		ctx.stroke()
	end
	exports.drawAim = drawAim
	TC = Js.O({ pitch = "#1f9006", line = "rgba(255,255,250,0.85)", lineFaint = "rgba(255,255,250,0.5)", post = "#f8fafc", net = "rgba(255,255,255,0.30)", ball = "#ffffff", ballSeam = "rgba(20,20,20,0.55)", ballEdge = "rgba(12,16,12,0.9)", shadow = "rgba(0,0,0,0.28)", skin = "#c68642", boot = "#1f2937" }, { "pitch", "line", "lineFaint", "post", "net", "ball", "ballSeam", "ballEdge", "shadow", "skin", "boot" })
	ROLE_KIT = Js.O({ you = "#10b981", youRim = "#065f46", mate = "#3b82f6", mateRim = "#1e3a5f", opp = "#dc2626", oppRim = "#7f1d1d", gk = "#fbbf24", gkRim = "#92400e" }, { "you", "youRim", "mate", "mateRim", "opp", "oppRim", "gk", "gkRim" })
	exports.ROLE_KIT = ROLE_KIT
	GRASS_TILE = 96
	grassTile = nil
	FIGURE_R = 1.05
	FEET_Y = 0.26
	exports.FEET_Y = FEET_Y
	HIP_Y = -0.34
	SHOULDER_Y = -1
	NECK_Y = -1.1
	HEAD_BASE_R = 0.114
	HEAD_ANCHOR = -1.184
	ANATOMY = Js.O({ FEET_Y = FEET_Y, HIP_Y = HIP_Y, SHOULDER_Y = SHOULDER_Y, NECK_Y = NECK_Y, HEAD_BASE_R = HEAD_BASE_R, HEAD_ANCHOR = HEAD_ANCHOR }, { "FEET_Y", "HIP_Y", "SHOULDER_Y", "NECK_Y", "HEAD_BASE_R", "HEAD_ANCHOR" })
	FIGURE_HEIGHT_R = 1.863
	exports.FIGURE_HEIGHT_R = FIGURE_HEIGHT_R
	FIGURE_HEAD_R = 0.503
	exports.FIGURE_HEAD_R = FIGURE_HEAD_R
	MATCH_FIGURE_HEIGHT_R = 2.509
	exports.MATCH_FIGURE_HEIGHT_R = MATCH_FIGURE_HEIGHT_R
	MATCH_FIGURE_R_MULT = 1.15
	exports.MATCH_FIGURE_R_MULT = MATCH_FIGURE_R_MULT
	MATCH_SCALE = ((MATCH_FIGURE_R_MULT * MATCH_FIGURE_HEIGHT_R) / (FIGURE_R * FIGURE_HEIGHT_R))
	exports.MATCH_SCALE = MATCH_SCALE
	MATCH_KEEPER_R_SHARE = 0.82
	exports.MATCH_KEEPER_R_SHARE = MATCH_KEEPER_R_SHARE
	MATCH_KEEPER_SCALE = (MATCH_SCALE * MATCH_KEEPER_R_SHARE)
	exports.MATCH_KEEPER_SCALE = MATCH_KEEPER_SCALE
	MATCH_FRAME_W_M = (42 * (5 / 8))
	exports.MATCH_FRAME_W_M = MATCH_FRAME_W_M
	MAX_KEEPER_LEAN = 1.75
	exports.MAX_KEEPER_LEAN = MAX_KEEPER_LEAN
	BALL_MIN_R = 6
	exports.BALL_MIN_R = BALL_MIN_R
	AIM_ARROW_LENGTH = 0.132
	exports.AIM_ARROW_LENGTH = AIM_ARROW_LENGTH
	exports.FIVE_COLOURS = TC
	exports.FIVE_HALFWAY_Y = FIVE_HALFWAY_Y
end
