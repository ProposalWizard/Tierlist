--!nocheck
--!nolint
-- Generated from lib/star/trainingRender.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_pitch = import("lib/star/pitch")
	local M_render = import("lib/star/fiveASide/render")
	local M_faceStyle = import("lib/star/faceStyle")
	local M_fakeFaceStyle = import("lib/star/fakeFaceStyle")
	local M_goalFrame = import("lib/star/goalFrame")
	local C, GRASS_TILE, cachedGrass, grassTile, clamp, renderTrainingScene, MATCH_FRAME_H, strikeViewport, gateViewport
	grassTile = function()
		if cachedGrass then
			do return cachedGrass end
		end
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
		local img = g.createImageData(GRASS_TILE, GRASS_TILE)
		local seed = 3108651
		do
			local i = 0
			local _first1 = true
			while true do
				if not _first1 then
					i += 4
				end
				_first1 = false
				if not (i < img.data.length) then break end
				seed = Js.ushr(((seed * 1664525) + 1013904223), 0)
				local n = (Js.band(Js.ushr(seed, 16), 255) / 255)
				local light = (n > 0.5)
				img.data[Js.key(i)] = (if light then 255 else 0)
				img.data[Js.key((i + 1))] = (if light then 255 else 0)
				img.data[Js.key((i + 2))] = (if light then 255 else 0)
				img.data[Js.key((i + 3))] = Math.round(((math.abs((n - 0.5)) * 2) * 16))
			end
		end
		g.putImageData(img, 0, 0)
		cachedGrass = c
		do return c end
	end
	clamp = function(v, lo, hi)
		do return Math.max(lo, Math.min(hi, v)) end
	end
	renderTrainingScene = function(canvas, opts)
		local ctx = canvas.getContext("2d")
		if (not ctx) then
			do return end
		end
		local W = canvas.width
		local H = canvas.height
		local vp = opts.viewport
		local sx = (W / (vp.x2 - vp.x1))
		local sy = (H / (vp.y2 - vp.y1))
		local unit = Math.min(sx, sy)
		local px = function(x)
			return ((x - vp.x1) * sx)
		end
		local py = function(y)
			return ((y - vp.y1) * sy)
		end
		ctx.fillStyle = C.pitch
		ctx.fillRect(0, 0, W, H)
		local grass = grassTile()
		if grass then
			local pat = ctx.createPattern(grass, "repeat")
			if pat then
				ctx.save()
				ctx.translate(math.fmod(px(0), GRASS_TILE), math.fmod(py(0), GRASS_TILE))
				ctx.fillStyle = pat
				ctx.fillRect((-GRASS_TILE), (-GRASS_TILE), (W + (GRASS_TILE * 2)), (H + (GRASS_TILE * 2)))
				ctx.restore()
			end
		end
		do
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
				ctx.fillRect((cx - ((rx * unit) * 1.2)), (cy - ((rx * unit) * 1.2)), ((rx * unit) * 2.4), ((rx * unit) * 2.4))
				ctx.restore()
			end
			if opts.goal then
				wear(M_pitch.CX, 1.9, 6.2, 2.4, 0.22)
				wear(M_pitch.CX, M_pitch.PEN_SPOT_Y, 3.2, 2.2, 0.16)
			end
		end
		local line = function(x1, y1, x2, y2)
			ctx.beginPath()
			ctx.moveTo(px(x1), py(y1))
			ctx.lineTo(px(x2), py(y2))
			ctx.stroke()
		end
		ctx.strokeStyle = C.line
		ctx.lineWidth = Math.max(1.4, (unit * 0.12))
		if opts.goal then
			line(vp.x1, 0, vp.x2, 0)
			ctx.strokeRect(px(M_pitch.SIX_L), py(0), ((M_pitch.SIX_R - M_pitch.SIX_L) * sx), (M_pitch.SIX_DEPTH * sy))
			ctx.strokeRect(px(M_pitch.BOX_L), py(0), ((M_pitch.BOX_R - M_pitch.BOX_L) * sx), (M_pitch.BOX_DEPTH * sy))
			ctx.strokeStyle = C.lineFaint
			ctx.beginPath()
			local halfD = Math.acos(clamp(((M_pitch.BOX_DEPTH - M_pitch.PEN_SPOT_Y) / M_pitch.ARC_R), -1, 1))
			ctx.arc(px(M_pitch.CX), py(M_pitch.PEN_SPOT_Y), (M_pitch.ARC_R * unit), ((Math.PI / 2) - halfD), ((Math.PI / 2) + halfD))
			ctx.stroke()
			ctx.beginPath()
			ctx.arc(px(M_pitch.CX), py(M_pitch.PEN_SPOT_Y), Math.max(2, (unit * 0.16)), 0, (Math.PI * 2))
			ctx.fillStyle = C.line
			ctx.fill()
		else
			ctx.strokeStyle = C.lineFaint
			line(0, vp.y1, 0, vp.y2)
			line(M_pitch.PITCH_W, vp.y1, M_pitch.PITCH_W, vp.y2)
			ctx.save()
			ctx.globalAlpha = 0.1
			local band = 5
			local first = (math.floor((vp.y1 / band)) * band)
			do
				local y = first
				local _first2 = true
				while true do
					if not _first2 then
						y += (band * 2)
					end
					_first2 = false
					if not (y < (vp.y2 + band)) then break end
					ctx.fillStyle = "#0d5c04"
					ctx.fillRect(0, py(y), W, (band * sy))
				end
			end
			ctx.restore()
		end
		if (opts.offsideLine ~= nil) then
			ctx.save()
			ctx.strokeStyle = "rgba(250,204,21,0.55)"
			ctx.lineWidth = Math.max(1.5, (unit * 0.09))
			ctx.setLineDash(Js.alit((unit * 0.9), (unit * 0.6)))
			line(vp.x1, opts.offsideLine, vp.x2, opts.offsideLine)
			ctx.setLineDash(Js.alit())
			ctx.restore()
		end
		if opts.goal then
			local hpx = (M_pitch.GOAL_H * sy)
			local bl = Js.O({ px = px(M_pitch.POST_L), py = py(0) }, { "px", "py" })
			local br = Js.O({ px = px(M_pitch.POST_R), py = py(0) }, { "px", "py" })
			local tl = Js.O({ px = bl.px, py = (bl.py - hpx) }, { "px", "py" })
			local tr = Js.O({ px = br.px, py = (br.py - hpx) }, { "px", "py" })
			local rl = Js.O({ px = px(M_pitch.POST_L), py = py((-M_pitch.NET_DEPTH)) }, { "px", "py" })
			local rr = Js.O({ px = px(M_pitch.POST_R), py = py((-M_pitch.NET_DEPTH)) }, { "px", "py" })
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
			ctx.strokeStyle = "#f6faf7"
			ctx.lineWidth = Math.max(1.8, (unit * 0.12))
			seg(bl, tl)
			seg(br, tr)
			ctx.lineWidth = Math.max(2, (unit * 0.16))
			seg(tl, tr)
			ctx.lineCap = "butt"
			ctx.strokeStyle = "rgba(255,255,255,0.9)"
			ctx.lineWidth = Math.max(1.5, (unit * 0.11))
			line(M_pitch.POST_L, 0, M_pitch.POST_R, 0)
		end
		local proj = Js.O({ px = px, py = py, unit = unit, W = W, H = H }, { "px", "py", "unit", "W", "H" })
		local FIG = M_render.sameSizeScale(unit, W)
		local footballer = function(x, y, shirt, rim, o)
			if o == nil then o = Js.O({}, nil) end
			ctx.save()
			if o.dim then
				ctx.globalAlpha = 0.55
			end
			if Js.T(o.ring) then
				local r = Math.max(5, ((unit * 1) * FIG))
				ctx.beginPath()
				ctx.arc(px(x), py(y), (r * 1.5), 0, (Math.PI * 2))
				ctx.strokeStyle = o.ring
				ctx.lineWidth = Math.max(1.6, (r * 0.16))
				ctx.stroke()
			end
			M_render.drawFigure(ctx, proj, Js.O({ x = x, y = y }, { "x", "y" }), Js.O({ shirt = shirt, shorts = rim, trim = rim, skin = C.skin, star = o.star, lift = o.z, face = o.face }, { "shirt", "shorts", "trim", "skin", "star", "lift", "face" }), M_faceStyle.DEFAULT_FACE_STYLE, M_fakeFaceStyle.DEFAULT_FAKE_FACE_STYLE, Js.O({ pose = o.pose, scale = FIG }, { "pose", "scale" }))
			ctx.restore()
		end
		do
			local _arr3 = (if opts.defenders ~= nil then opts.defenders else Js.alit())
			local _i4 = 0
			while _i4 < Js.alen(_arr3) do
				_i4 += 1
				local d = _arr3[_i4]
				footballer(d.x, d.y, (if (d.awake == false) then "#7a8a8f" else C.opp), (if (d.awake == false) then "#3f4a4e" else C.oppRim), Js.O({ z = d.z, pose = d.pose, face = d.face }, { "z", "pose", "face" }))
			end
		end
		do
			local _arr5 = (if opts.mates ~= nil then opts.mates else Js.alit())
			local _i6 = 0
			while _i6 < Js.alen(_arr5) do
				_i6 += 1
				local m = _arr5[_i6]
				footballer(m.x, m.y, "#3b82f6", "#1e3a5f", Js.O({ dim = m.dim, ring = (if m.highlight then "#facc15" else nil), face = m.face }, { "dim", "ring", "face" }))
			end
		end
		if opts.gate then
			local cone = function(x, y)
				local cx = px(x)
				local cy = py(y)
				local h = Math.max(6, (unit * 0.85))
				local w = Math.max(5, (unit * 0.7))
				ctx.beginPath()
				ctx.ellipse(cx, cy, (w * 0.62), (w * 0.24), 0, 0, (Math.PI * 2))
				ctx.fillStyle = "rgba(0,0,0,0.32)"
				ctx.fill()
				ctx.beginPath()
				ctx.moveTo(cx, (cy - h))
				ctx.lineTo((cx + (w * 0.55)), cy)
				ctx.lineTo((cx - (w * 0.55)), cy)
				ctx.closePath()
				ctx.fillStyle = C.cone
				ctx.fill()
				ctx.strokeStyle = C.coneRim
				ctx.lineWidth = Math.max(1, (unit * 0.07))
				ctx.stroke()
				ctx.beginPath()
				ctx.moveTo((cx - (w * 0.34)), (cy - (h * 0.38)))
				ctx.lineTo((cx + (w * 0.34)), (cy - (h * 0.38)))
				ctx.strokeStyle = "rgba(255,255,255,0.85)"
				ctx.lineWidth = Math.max(1, (unit * 0.11))
				ctx.stroke()
			end
			ctx.save()
			ctx.strokeStyle = "rgba(250,204,21,0.35)"
			ctx.lineWidth = Math.max(1, (unit * 0.07))
			ctx.setLineDash(Js.alit((unit * 0.4), (unit * 0.35)))
			line(opts.gate.left.x, opts.gate.left.y, opts.gate.right.x, opts.gate.right.y)
			ctx.setLineDash(Js.alit())
			ctx.restore()
			cone(opts.gate.left.x, opts.gate.left.y)
			cone(opts.gate.right.x, opts.gate.right.y)
		end
		if opts.keeper then
			local k = opts.keeper
			M_render.drawKeeper(ctx, proj, Js.O({ x = k.x, y = k.y }, { "x", "y" }), Js.O({ shirt = C.gk, shorts = C.gkRim, trim = C.gkRim, skin = C.skin, face = k.face }, { "shirt", "shorts", "trim", "skin", "face" }), Js.O({ dive = Math.max(-1, Math.min(1, (if k.dive ~= nil then k.dive else 0))), lunge = Math.max(0, Math.min(1, (if k.lunge ~= nil then k.lunge else 0))) }, { "dive", "lunge" }), M_faceStyle.DEFAULT_FACE_STYLE, M_fakeFaceStyle.DEFAULT_FAKE_FACE_STYLE, Js.O({ scale = (FIG * M_render.MATCH_KEEPER_R_SHARE) }, { "scale" }))
		end
		if opts.you then
			footballer(opts.you.x, opts.you.y, C.you, C.youRim, Js.O({ star = true, pose = opts.you.pose, face = opts.you.face }, { "star", "pose", "face" }))
		end
		if (opts.trail and (Js.alen(opts.trail) > 1)) then
			ctx.save()
			ctx.strokeStyle = "rgba(255,255,255,0.35)"
			ctx.lineWidth = Math.max(1, (unit * 0.09))
			ctx.setLineDash(Js.alit((unit * 0.35), (unit * 0.3)))
			ctx.beginPath()
			ctx.moveTo(px(opts.trail[1].x), py(opts.trail[1].y))
			do
				local i = 1
				local _first7 = true
				while true do
					if not _first7 then
						i += 1
					end
					_first7 = false
					if not (i < Js.alen(opts.trail)) then break end
					ctx.lineTo(px(opts.trail[i + 1].x), py(opts.trail[i + 1].y))
				end
			end
			ctx.stroke()
			ctx.setLineDash(Js.alit())
			ctx.restore()
		end
		if opts.ball then
			local b = opts.ball
			local img = opts.ballImage
			if ((img and img.complete) and (img.naturalWidth > 0)) then
				local lift = Math.max(0, b.z)
				local br = Math.max(2.5, ((unit * 0.286) * (1 + (lift * 0.06))))
				local bx = px(b.x)
				local by = py(b.y)
				ctx.fillStyle = "rgba(0,0,0,0.32)"
				ctx.beginPath()
				ctx.ellipse(bx, by, (br * (1 - Math.min(0.4, (lift * 0.05)))), (br * 0.5), 0, 0, (Math.PI * 2))
				ctx.fill()
				ctx.drawImage(img, (bx - br), ((by - ((lift * unit) * 0.5)) - br), (br * 2), (br * 2))
			else
				M_render.drawBall(ctx, proj, Js.O({ x = b.x, y = b.y }, { "x", "y" }), Math.max(0, b.z), FIG)
			end
		end
		if opts.aim then
			local a = opts.aim
			M_render.drawAim(ctx, proj, a.from, a.dir, a.power)
		end
	end
	exports.renderTrainingScene = renderTrainingScene
	strikeViewport = function(ball)
		local y1 = M_goalFrame.FRAME_TOP_FOR_GOAL
		local height = Math.max(MATCH_FRAME_H, ((ball.y - y1) / (1 - M_goalFrame.roomShare())), (((ball.y + 0.8) + 1.4) - y1))
		local width = (height * (5 / 8))
		local cx = clamp(((ball.x + M_pitch.CX) / 2), (width / 2), (M_pitch.PITCH_W - (width / 2)))
		do return Js.O({ x1 = (cx - (width / 2)), x2 = (cx + (width / 2)), y1 = y1, y2 = (y1 + height) }, { "x1", "x2", "y1", "y2" }) end
	end
	exports.strikeViewport = strikeViewport
	gateViewport = function(ball, gate)
		local y2 = (ball.y + 5)
		local y1 = (Math.min(gate.left.y, gate.right.y) - 6)
		local height = (y2 - y1)
		local width = (height * (5 / 8))
		local spanCx = ((ball.x + ((gate.left.x + gate.right.x) / 2)) / 2)
		local needed = ((math.abs((gate.right.x - ball.x)) + math.abs((gate.left.x - ball.x))) + 6)
		local w = Math.max(width, needed, (MATCH_FRAME_H * (5 / 8)))
		local h = (w / (5 / 8))
		local cy = ((y1 + y2) / 2)
		do return Js.O({ x1 = (spanCx - (w / 2)), x2 = (spanCx + (w / 2)), y1 = (cy - (h / 2)), y2 = (cy + (h / 2)) }, { "x1", "x2", "y1", "y2" }) end
	end
	exports.gateViewport = gateViewport
	C = Js.O({ pitch = "#1f9006", line = "rgba(255,255,250,0.85)", lineFaint = "rgba(255,255,250,0.5)", you = M_render.ROLE_KIT.you, youRim = M_render.ROLE_KIT.youRim, opp = M_render.ROLE_KIT.opp, oppRim = M_render.ROLE_KIT.oppRim, gk = M_render.ROLE_KIT.gk, gkRim = M_render.ROLE_KIT.gkRim, cone = "#f97316", coneRim = "#7c2d12", skin = "#c68642" }, { "pitch", "line", "lineFaint", "you", "youRim", "opp", "oppRim", "gk", "gkRim", "cone", "coneRim", "skin" })
	GRASS_TILE = 96
	cachedGrass = nil
	MATCH_FRAME_H = 42
	exports.MATCH_FRAME_H = MATCH_FRAME_H
end
