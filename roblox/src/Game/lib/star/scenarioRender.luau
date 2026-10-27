--!nocheck
--!nolint
-- Generated from lib/star/scenarioRender.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_pitch = import("lib/star/pitch")
	local C, SIDE_KIT, GRASS_TILE, cachedGrassTile, grassTile, clamp, renderScenario, VIEW_ASPECT, viewportFor, pitchFromPx, pxFromPitch
	grassTile = function()
		if cachedGrassTile then
			do return cachedGrassTile end
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
		cachedGrassTile = c
		do return c end
	end
	clamp = function(x, lo, hi)
		do return Math.max(lo, Math.min(hi, x)) end
	end
	renderScenario = function(canvas, opts)
		local ctx = canvas.getContext("2d")
		if (not ctx) then
			do return end
		end
		local W = canvas.width
		local H = canvas.height
		local vp = opts.viewport
		local facing = opts.facing
		local turned = (facing ~= "up")
		local unit = (if turned then (H / (vp.x2 - vp.x1)) else (W / (vp.x2 - vp.x1)))
		local uy = (if turned then (W / (vp.y2 - vp.y1)) else (H / (vp.y2 - vp.y1)))
		local heightScale = uy
		local toPx = function(x, y)
			local fx = ((x - vp.x1) / (vp.x2 - vp.x1))
			local fy = ((y - vp.y1) / (vp.y2 - vp.y1))
			if (facing == "right") then
				do return Js.O({ px = ((1 - fy) * W), py = (fx * H), scale = 1 }, { "px", "py", "scale" }) end
			end
			if (facing == "left") then
				do return Js.O({ px = (fy * W), py = ((1 - fx) * H), scale = 1 }, { "px", "py", "scale" }) end
			end
			do return Js.O({ px = (fx * W), py = (fy * H), scale = 1 }, { "px", "py", "scale" }) end
		end
		local P = toPx
		local pLine = function(x1, y1, x2, y2)
			local a = P(x1, y1)
			local b = P(x2, y2)
			ctx.beginPath()
			ctx.moveTo(a.px, a.py)
			ctx.lineTo(b.px, b.py)
			ctx.stroke()
		end
		local pRect = function(x1, y1, x2, y2)
			local a = P(x1, y1)
			local b = P(x2, y2)
			ctx.strokeRect(a.px, a.py, (b.px - a.px), (b.py - a.py))
		end
		ctx.fillStyle = C.pitch
		ctx.fillRect(0, 0, W, H)
		local grass = grassTile()
		if grass then
			local pat = ctx.createPattern(grass, "repeat")
			if pat then
				local o = P(0, 0)
				ctx.save()
				ctx.translate(math.fmod(o.px, GRASS_TILE), math.fmod(o.py, GRASS_TILE))
				ctx.fillStyle = pat
				ctx.fillRect((-GRASS_TILE), (-GRASS_TILE), (W + (GRASS_TILE * 2)), (H + (GRASS_TILE * 2)))
				ctx.restore()
			end
		end
		do
			local wear = function(x, y, rx, ry, alpha)
				local c = P(x, y)
				local g = ctx.createRadialGradient(c.px, c.py, 0, c.px, c.py, (Math.max(rx, ry) * unit))
				g.addColorStop(0, ("rgba(120,132,26," .. Js.numstr(alpha) .. ")"))
				g.addColorStop(1, "rgba(120,132,26,0)")
				ctx.save()
				ctx.translate(c.px, c.py)
				ctx.scale(1, (ry / rx))
				ctx.translate((-c.px), (-c.py))
				ctx.fillStyle = g
				ctx.fillRect((c.px - ((rx * unit) * 1.2)), (c.py - ((rx * unit) * 1.2)), ((rx * unit) * 2.4), ((rx * unit) * 2.4))
				ctx.restore()
			end
			wear(M_pitch.CX, 1.9, 6.2, 2.4, 0.22)
			wear(M_pitch.CX, M_pitch.PEN_SPOT_Y, 3.2, 2.2, 0.16)
			wear(M_pitch.CX, M_pitch.HALF_LEN, 3.4, 2.4, 0.14)
		end
		local arcAngle = function(pitchAngle)
			return (pitchAngle + (if (facing == "right") then (Math.PI / 2) else (if (facing == "left") then ((-Math.PI) / 2) else 0)))
		end
		local lw = Math.max(1, (unit * 0.12))
		ctx.lineWidth = lw
		ctx.strokeStyle = C.line
		pLine(0, 0, M_pitch.PITCH_W, 0)
		pLine(0, 0, 0, M_pitch.HALF_LEN)
		pLine(M_pitch.PITCH_W, 0, M_pitch.PITCH_W, M_pitch.HALF_LEN)
		pRect(M_pitch.BOX_L, 0, M_pitch.BOX_R, M_pitch.BOX_DEPTH)
		pRect(M_pitch.SIX_L, 0, M_pitch.SIX_R, M_pitch.SIX_DEPTH)
		do
			local spot = P(M_pitch.CX, M_pitch.PEN_SPOT_Y)
			ctx.beginPath()
			ctx.arc(spot.px, spot.py, Math.max(1.5, (unit * 0.11)), 0, (Math.PI * 2))
			ctx.fillStyle = C.line
			ctx.fill()
			local half = Math.acos(clamp(((M_pitch.BOX_DEPTH - M_pitch.PEN_SPOT_Y) / M_pitch.ARC_R), -1, 1))
			ctx.beginPath()
			ctx.arc(spot.px, spot.py, (unit * M_pitch.ARC_R), arcAngle(((Math.PI / 2) - half)), arcAngle(((Math.PI / 2) + half)))
			ctx.stroke()
		end
		do
			local c1 = P(0, 0)
			local c2 = P(M_pitch.PITCH_W, 0)
			ctx.beginPath()
			ctx.arc(c1.px, c1.py, (unit * M_pitch.CORNER_R), arcAngle(0), arcAngle((Math.PI / 2)))
			ctx.stroke()
			ctx.beginPath()
			ctx.arc(c2.px, c2.py, (unit * M_pitch.CORNER_R), arcAngle((Math.PI / 2)), arcAngle(Math.PI))
			ctx.stroke()
		end
		ctx.strokeStyle = C.lineFaint
		pLine(0, M_pitch.HALF_LEN, M_pitch.PITCH_W, M_pitch.HALF_LEN)
		do
			local cc = P(M_pitch.CX, M_pitch.HALF_LEN)
			ctx.beginPath()
			ctx.arc(cc.px, cc.py, (unit * M_pitch.CENTRE_R), 0, (Math.PI * 2))
			ctx.stroke()
		end
		do
			local hpx = (M_pitch.GOAL_H * heightScale)
			local bl = P(M_pitch.POST_L, 0)
			local br = P(M_pitch.POST_R, 0)
			local tl = Js.O({ px = bl.px, py = (bl.py - hpx) }, { "px", "py" })
			local tr = Js.O({ px = br.px, py = (br.py - hpx) }, { "px", "py" })
			local rl = P(M_pitch.POST_L, (-M_pitch.NET_DEPTH))
			local rr = P(M_pitch.POST_R, (-M_pitch.NET_DEPTH))
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
			local seg = function(a2, b2)
				ctx.beginPath()
				ctx.moveTo(a2.px, a2.py)
				ctx.lineTo(b2.px, b2.py)
				ctx.stroke()
			end
			local lerp = function(a2, b2, f)
				return Js.O({ px = (a2.px + ((b2.px - a2.px) * f)), py = (a2.py + ((b2.py - a2.py) * f)) }, { "px", "py" })
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
			local shOff = (unit * 0.5)
			quad(A.map(Js.alit(rl, rr, br, bl), function(q)
				return Js.O({ px = (q.px + shOff), py = (q.py + (shOff * 0.3)) }, { "px", "py" })
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
			pLine(M_pitch.POST_L, 0, M_pitch.POST_R, 0)
		end
		local SKIN = "#c68642"
		local footballer = function(x, y, rBase, shirt, rim, opts)
			if opts == nil then opts = Js.O({}, nil) end
			local _d2 = toPx(x, y)
			local px = _d2.px
			local py = _d2.py
			local scale = _d2.scale
			local r = (rBase * scale)
			local shorts = (if opts.shorts ~= nil then opts.shorts else rim)
			local lwLimb = Math.max(1.3, (r * 0.24))
			ctx.beginPath()
			ctx.ellipse(px, py, (r * 0.78), (r * 0.3), 0, 0, (Math.PI * 2))
			ctx.fillStyle = "rgba(0,0,0,0.34)"
			ctx.fill()
			ctx.save()
			ctx.translate(px, (py - (r * 0.8)))
			ctx.lineCap = "round"
			ctx.lineWidth = lwLimb
			ctx.strokeStyle = SKIN
			local hipY = (r * 0.18)
			local legL = (r * 0.62)
			ctx.beginPath()
			ctx.moveTo(((-r) * 0.24), hipY)
			ctx.lineTo(((-r) * 0.24), (hipY + legL))
			ctx.stroke()
			ctx.beginPath()
			ctx.moveTo((r * 0.24), hipY)
			ctx.lineTo((r * 0.24), (hipY + legL))
			ctx.stroke()
			ctx.fillStyle = shorts
			ctx.beginPath();
			(function() local _f = ctx.roundRect; if _f == nil then return nil end; return _f(((-r) * 0.46), ((-r) * 0.02), (r * 0.92), (r * 0.36), (r * 0.12)) end)()
			if (not ctx.roundRect) then
				ctx.rect(((-r) * 0.46), ((-r) * 0.02), (r * 0.92), (r * 0.36))
			end
			ctx.fill()
			ctx.strokeStyle = SKIN
			ctx.lineWidth = (lwLimb * 0.85)
			local armOut = (r * 0.52)
			local armDrop = (r * 0.24)
			ctx.beginPath()
			ctx.moveTo(((-r) * 0.34), ((-r) * 0.3))
			ctx.lineTo((-armOut), armDrop)
			ctx.stroke()
			ctx.beginPath()
			ctx.moveTo((r * 0.34), ((-r) * 0.3))
			ctx.lineTo(armOut, armDrop)
			ctx.stroke()
			ctx.fillStyle = shirt
			ctx.beginPath();
			(function() local _f = ctx.roundRect; if _f == nil then return nil end; return _f(((-r) * 0.52), ((-r) * 0.56), (r * 1.04), (r * 0.72), (r * 0.17)) end)()
			if (not ctx.roundRect) then
				ctx.rect(((-r) * 0.52), ((-r) * 0.56), (r * 1.04), (r * 0.72))
			end
			ctx.fill()
			ctx.lineWidth = Math.max(1, (r * 0.12))
			ctx.strokeStyle = rim
			ctx.stroke()
			ctx.beginPath()
			ctx.arc(0, ((-r) * 0.76), (r * 0.26), 0, (Math.PI * 2))
			ctx.fillStyle = SKIN
			ctx.fill()
			ctx.lineWidth = Math.max(1, (r * 0.1))
			ctx.strokeStyle = "rgba(0,0,0,0.35)"
			ctx.stroke()
			ctx.restore()
			if opts.star then
				local sr = (r * 0.23)
				local cx = px
				local cy = (py - (r * 2.15))
				ctx.save()
				ctx.beginPath()
				for i = 0, 9 do
					local ang = (((-Math.PI) / 2) + ((i * Math.PI) / 5))
					local rad = (if (math.fmod(i, 2) == 0) then sr else (sr * 0.44))
					local sx = (cx + (Math.cos(ang) * rad))
					local sy = (cy + (Math.sin(ang) * rad))
					if (i == 0) then
						ctx.moveTo(sx, sy)
					else
						ctx.lineTo(sx, sy)
					end
				end
				ctx.closePath()
				ctx.lineJoin = "round"
				ctx.lineWidth = Math.max(1.5, (sr * 0.34))
				ctx.strokeStyle = "rgba(0,0,0,0.55)"
				ctx.stroke()
				ctx.fillStyle = "#fbbf24"
				ctx.fill()
				ctx.restore()
			end
		end
		local rBase = Math.max(6, (unit * 1))
		local byDepth = A.map(A.sort(A.map(opts.players, function(p, i)
			return Js.O({ p = p, i = i, py = toPx(p.x, p.y).py }, { "p", "i", "py" })
		end), function(a, b)
			return (function() local _l = (a.py - b.py); if Js.T(_l) then return _l end; return (a.i - b.i) end)()
		end), function(e)
			return e.p
		end)
		local drawBall = function()
			local _d3 = toPx(opts.ball.x, opts.ball.y)
			local px = _d3.px
			local py = _d3.py
			local scale = _d3.scale
			local bScale = (Math.max(4.5, (unit * 0.5)) * scale)
			ctx.beginPath()
			ctx.ellipse(px, py, (bScale * 1.05), (bScale * 0.5), 0, 0, (Math.PI * 2))
			ctx.fillStyle = "rgba(0,0,0,0.34)"
			ctx.fill()
			local img = opts.ballImage
			if ((img and img.complete) and (img.naturalWidth > 0)) then
				ctx.drawImage(img, (px - bScale), (py - bScale), (bScale * 2), (bScale * 2))
			else
				ctx.beginPath()
				ctx.arc(px, py, bScale, 0, (Math.PI * 2))
				ctx.fillStyle = "#fefefe"
				ctx.fill()
				ctx.lineWidth = Math.max(1, (2 * scale))
				ctx.strokeStyle = "#0f172a"
				ctx.stroke()
			end
		end
		local ballPy = toPx(opts.ball.x, opts.ball.y).py
		local ballDrawn = false
		do
			local _arr4 = byDepth
			local _i5 = 0
			while _i5 < Js.alen(_arr4) do
				_i5 += 1
				local p = _arr4[_i5]
				if ((not ballDrawn) and (toPx(p.x, p.y).py > ballPy)) then
					drawBall()
					ballDrawn = true
				end
				local kit = SIDE_KIT[p.side]
				footballer(p.x, p.y, rBase, kit.shirt, kit.rim, Js.O({ star = (p.side == "you") }, { "star" }))
				if p.selected then
					local _d6 = toPx(p.x, p.y)
					local px = _d6.px
					local py = _d6.py
					local scale = _d6.scale
					ctx.beginPath()
					ctx.arc(px, py, ((rBase * scale) * 1.35), 0, (Math.PI * 2))
					ctx.strokeStyle = "#facc15"
					ctx.lineWidth = Math.max(1.5, ((rBase * scale) * 0.1))
					ctx.setLineDash(Js.alit(((rBase * scale) * 0.25), ((rBase * scale) * 0.2)))
					ctx.stroke()
					ctx.setLineDash(Js.alit())
				end
			end
		end
		if (not ballDrawn) then
			drawBall()
		end
		if opts.frameOverlay then
			local ov = opts.frameOverlay
			local a = toPx(ov.x1, ov.y1)
			local b = toPx(ov.x2, ov.y2)
			ctx.save()
			ctx.strokeStyle = "#facc15"
			ctx.lineWidth = Math.max(2, (unit * 0.15))
			ctx.setLineDash(Js.alit((unit * 0.6), (unit * 0.35)))
			ctx.strokeRect(Math.min(a.px, b.px), Math.min(a.py, b.py), math.abs((b.px - a.px)), math.abs((b.py - a.py)))
			ctx.setLineDash(Js.alit())
			ctx.fillStyle = "rgba(250,204,21,0.10)"
			ctx.fillRect(Math.min(a.px, b.px), Math.min(a.py, b.py), math.abs((b.px - a.px)), math.abs((b.py - a.py)))
			ctx.restore()
		end
	end
	exports.renderScenario = renderScenario
	viewportFor = function(centerX, centerY, viewHeight, facing)
		if facing == nil then facing = "up" end
		local w = (if (facing == "up") then (viewHeight * VIEW_ASPECT) else (viewHeight / VIEW_ASPECT))
		do return Js.O({ x1 = (centerX - (w / 2)), x2 = (centerX + (w / 2)), y1 = (centerY - (viewHeight / 2)), y2 = (centerY + (viewHeight / 2)) }, { "x1", "x2", "y1", "y2" }) end
	end
	exports.viewportFor = viewportFor
	pitchFromPx = function(px, py, W, H, vp, facing)
		local fx0 = (px / W)
		local fy0 = (py / H)
		local fx = nil
		local fy = nil
		if (facing == "right") then
			fx = fy0
			fy = (1 - fx0)
		elseif (facing == "left") then
			fx = (1 - fy0)
			fy = fx0
		else
			fx = fx0
			fy = fy0
		end
		do return Js.O({ x = clamp(((fx * (vp.x2 - vp.x1)) + vp.x1), 0, M_pitch.PITCH_W), y = clamp(((fy * (vp.y2 - vp.y1)) + vp.y1), 0, (M_pitch.HALF_LEN * 2)) }, { "x", "y" }) end
	end
	exports.pitchFromPx = pitchFromPx
	pxFromPitch = function(x, y, W, H, vp, facing)
		local fx = ((x - vp.x1) / (vp.x2 - vp.x1))
		local fy = ((y - vp.y1) / (vp.y2 - vp.y1))
		if (facing == "right") then
			do return Js.O({ px = ((1 - fy) * W), py = (fx * H) }, { "px", "py" }) end
		end
		if (facing == "left") then
			do return Js.O({ px = (fy * W), py = ((1 - fx) * H) }, { "px", "py" }) end
		end
		do return Js.O({ px = (fx * W), py = (fy * H) }, { "px", "py" }) end
	end
	exports.pxFromPitch = pxFromPitch
	C = Js.O({ pitch = "#1f9006", line = "rgba(255,255,250,0.85)", lineFaint = "rgba(255,255,250,0.5)", you = "#10b981", youRim = "#065f46", mate = "#3b82f6", mateRim = "#1e3a5f", opp = "#dc2626", oppRim = "#7f1d1d" }, { "pitch", "line", "lineFaint", "you", "youRim", "mate", "mateRim", "opp", "oppRim" })
	SIDE_KIT = Js.O({ you = Js.O({ shirt = C.you, rim = C.youRim }, { "shirt", "rim" }), teammate = Js.O({ shirt = C.mate, rim = C.mateRim }, { "shirt", "rim" }), opponent = Js.O({ shirt = C.opp, rim = C.oppRim }, { "shirt", "rim" }) }, { "you", "teammate", "opponent" })
	GRASS_TILE = 96
	cachedGrassTile = nil
	VIEW_ASPECT = (5 / 8)
	exports.VIEW_ASPECT = VIEW_ASPECT
end
