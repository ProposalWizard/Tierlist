--!nocheck
--!nolint
-- Generated from lib/star/heroFigure.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_drawPlayerHead = import("lib/star/drawPlayerHead")
	local rgbOf, tint, rgba, luminance, compositeLit, HERO_W, HERO_H, HERO_TOP, HERO_FACE_H, HERO_CHIN_Y, HERO_CREST, along, limb, sleeve, boot, paintHeroShadow, paintHeroFigure
	rgbOf = function(c)
		local f = Js.re("^rgb\\((\\d+),\\s*(\\d+),\\s*(\\d+)\\)$", "i"):exec(S.trim(c))
		if f then
			do return Js.alit(Js.Number(f[2]), Js.Number(f[3]), Js.Number(f[4])) end
		end
		local m = Js.re("^#?([0-9a-f]{6})$", "i"):exec(S.trim(c))
		if (not m) then
			do return nil end
		end
		local n = Js.parseInt(m[2], 16)
		do return Js.alit(Js.band(Js.shr(n, 16), 255), Js.band(Js.shr(n, 8), 255), Js.band(n, 255)) end
	end
	tint = function(c, amt)
		local rgb = rgbOf(c)
		if (not rgb) then
			do return c end
		end
		local t = (if (amt > 0) then 255 else 0)
		local k = math.abs(amt)
		local _d1 = A.map(rgb, function(v)
			return Math.round((v + ((t - v) * k)))
		end)
		local r = _d1[1]
		local g = _d1[2]
		local b = _d1[3]
		do return ("rgb(" .. Js.numstr(r) .. "," .. Js.numstr(g) .. "," .. Js.numstr(b) .. ")") end
	end
	exports.tint = tint
	rgba = function(c, a)
		local rgb = rgbOf(c)
		do return (if rgb then ("rgba(" .. Js.numstr(rgb[1]) .. "," .. Js.numstr(rgb[2]) .. "," .. Js.numstr(rgb[3]) .. "," .. Js.numstr(a) .. ")") else c) end
	end
	exports.rgba = rgba
	luminance = function(c)
		local rgb = rgbOf(c)
		if (not rgb) then
			do return 0.5 end
		end
		do return ((((0.2126 * rgb[1]) + (0.7152 * rgb[2])) + (0.0722 * rgb[3])) / 255) end
	end
	exports.luminance = luminance
	compositeLit = function(dst, layer, _p2)
		local rim = _p2.rim
		local d = _p2.d
		local shade = _p2.shade
		if shade == nil then shade = true end
		local w = layer.width
		local h = layer.height
		local lctx = layer.getContext("2d")
		if (not lctx) then
			dst.drawImage(layer, 0, 0)
			do return end
		end
		if shade then
			lctx.save()
			lctx.globalCompositeOperation = "source-atop"
			local g = lctx.createLinearGradient(0, 0, w, (h * 0.35))
			g.addColorStop(0, "rgba(255,255,255,0.24)")
			g.addColorStop(0.45, "rgba(255,255,255,0)")
			g.addColorStop(1, "rgba(0,0,0,0.34)")
			lctx.fillStyle = g
			lctx.fillRect(0, 0, w, h)
			local v = lctx.createLinearGradient(0, 0, 0, h)
			v.addColorStop(0, "rgba(0,0,0,0)")
			v.addColorStop(0.6, "rgba(0,0,0,0.04)")
			v.addColorStop(1, "rgba(0,0,0,0.32)")
			lctx.fillStyle = v
			lctx.fillRect(0, 0, w, h)
			lctx.restore()
		end
		local edge = function(ox, oy, color)
			local c = Js.document.createElement("canvas")
			c.width = w
			c.height = h
			local x = c.getContext("2d")
			if (not x) then
				do return nil end
			end
			x.drawImage(layer, 0, 0)
			x.globalCompositeOperation = "source-in"
			x.fillStyle = color
			x.fillRect(0, 0, w, h)
			x.globalCompositeOperation = "destination-out"
			x.drawImage(layer, ox, oy)
			do return c end
		end
		local key = edge((-d), (d * 0.5), "rgba(255,244,214,1)")
		local fill = edge(d, (d * 0.5), rim)
		if fill then
			dst.save()
			dst.filter = ("blur(" .. Js.numstr(Math.max(2, d)) .. "px)")
			dst.globalAlpha = 0.9
			dst.drawImage(fill, ((-d) * 0.6), 0)
			dst.restore()
		end
		dst.drawImage(layer, 0, 0)
		dst.save()
		dst.globalAlpha = 1
		if key then
			dst.drawImage(key, 0, 0)
		end
		dst.globalAlpha = 0.85
		if fill then
			dst.drawImage(fill, 0, 0)
		end
		dst.restore()
	end
	exports.compositeLit = compositeLit
	limb = function(ctx, a, b, w0, w1, color)
		local dx = (b[1] - a[1])
		local dy = (b[2] - a[2])
		local L = (function() local _l = Math.hypot(dx, dy); if Js.T(_l) then return _l end; return 1 end)()
		local nx = ((-dy) / L)
		local ny = (dx / L)
		local g = ctx.createLinearGradient((a[1] + ((nx * w0) / 2)), (a[2] + ((ny * w0) / 2)), (a[1] - ((nx * w0) / 2)), (a[2] - ((ny * w0) / 2)))
		local litFirst = (nx < 0)
		g.addColorStop(0, (if litFirst then tint(color, 0.28) else tint(color, -0.32)))
		g.addColorStop(0.45, color)
		g.addColorStop(1, (if litFirst then tint(color, -0.32) else tint(color, 0.28)))
		ctx.fillStyle = g
		ctx.beginPath()
		ctx.moveTo((a[1] + ((nx * w0) / 2)), (a[2] + ((ny * w0) / 2)))
		ctx.lineTo((b[1] + ((nx * w1) / 2)), (b[2] + ((ny * w1) / 2)))
		ctx.arc(b[1], b[2], (w1 / 2), Math.atan2(ny, nx), (Math.atan2(ny, nx) + Math.PI), true)
		ctx.lineTo((a[1] - ((nx * w0) / 2)), (a[2] - ((ny * w0) / 2)))
		ctx.arc(a[1], a[2], (w0 / 2), Math.atan2((-ny), (-nx)), (Math.atan2((-ny), (-nx)) + Math.PI), true)
		ctx.closePath()
		ctx.fill()
	end
	exports.limb = limb
	sleeve = function(ctx, a, b, w0, w1, color, trim, u)
		if u == nil then u = 1 end
		local dx = (b[1] - a[1])
		local dy = (b[2] - a[2])
		local L = (function() local _l = Math.hypot(dx, dy); if Js.T(_l) then return _l end; return 1 end)()
		local ux = (dx / L)
		local uy = (dy / L)
		local nx = (-uy)
		local ny = ux
		local e = Js.alit((a[1] + (dx * 0.7)), (a[2] + (dy * 0.7)))
		local g = ctx.createLinearGradient((a[1] + ((nx * w0) / 2)), (a[2] + ((ny * w0) / 2)), (a[1] - ((nx * w0) / 2)), (a[2] - ((ny * w0) / 2)))
		local litFirst = (nx < 0)
		g.addColorStop(0, (if litFirst then tint(color, 0.26) else tint(color, -0.3)))
		g.addColorStop(0.45, color)
		g.addColorStop(1, (if litFirst then tint(color, -0.3) else tint(color, 0.26)))
		ctx.fillStyle = g
		ctx.beginPath()
		ctx.arc(a[1], a[2], (w0 / 2), Math.atan2((-ny), (-nx)), (Math.atan2((-ny), (-nx)) - Math.PI), true)
		ctx.lineTo((e[1] + ((nx * w1) / 2)), (e[2] + ((ny * w1) / 2)))
		ctx.lineTo((e[1] - ((nx * w1) / 2)), (e[2] - ((ny * w1) / 2)))
		ctx.closePath()
		ctx.fill()
		ctx.strokeStyle = rgba(tint(color, -0.55), 0.3)
		ctx.lineWidth = (1.2 * u)
		ctx.lineCap = "round"
		local f = Js.alit((a[1] + (dx * 0.42)), (a[2] + (dy * 0.42)))
		ctx.beginPath()
		ctx.moveTo((f[1] + ((nx * w1) * 0.3)), (f[2] + ((ny * w1) * 0.3)))
		ctx.quadraticCurveTo((f[1] + ((ux * 2) * u)), (f[2] + ((uy * 2) * u)), (f[1] - ((nx * w1) * 0.25)), (f[2] - ((ny * w1) * 0.25)))
		ctx.stroke()
		ctx.strokeStyle = trim
		ctx.lineWidth = (3 * u)
		ctx.lineCap = "butt"
		ctx.beginPath()
		ctx.moveTo(((e[1] + ((nx * w1) / 2)) - ((ux * 1.4) * u)), ((e[2] + ((ny * w1) / 2)) - ((uy * 1.4) * u)))
		ctx.lineTo(((e[1] - ((nx * w1) / 2)) - ((ux * 1.4) * u)), ((e[2] - ((ny * w1) / 2)) - ((uy * 1.4) * u)))
		ctx.stroke()
	end
	exports.sleeve = sleeve
	boot = function(ctx, x, y, dir, s, stripe)
		ctx.save()
		ctx.translate(x, y)
		ctx.scale((dir * s), s)
		local g = ctx.createLinearGradient(0, -8, 0, 7)
		g.addColorStop(0, "#3a3f4a")
		g.addColorStop(1, "#0b0d12")
		ctx.fillStyle = g
		ctx.beginPath()
		ctx.moveTo(-7, -7)
		ctx.quadraticCurveTo(4, -9, 14, -2)
		ctx.quadraticCurveTo(17, 3, 12, 5)
		ctx.lineTo(-8, 5)
		ctx.quadraticCurveTo(-11, 0, -7, -7)
		ctx.fill()
		ctx.strokeStyle = stripe
		ctx.lineWidth = 1.8
		ctx.lineCap = "round"
		ctx.beginPath()
		ctx.moveTo(-3, -3)
		ctx.quadraticCurveTo(4, -4, 9, 0)
		ctx.stroke()
		ctx.fillStyle = "rgba(255,255,255,0.35)"
		ctx.beginPath()
		ctx.ellipse(6, -5, 4, 1.3, -0.2, 0, (Math.PI * 2))
		ctx.fill()
		ctx.fillStyle = "#e5e7eb"
		ctx.fillRect(-7, 4, 20, 1.6)
		ctx.restore()
	end
	paintHeroShadow = function(ctx)
		local fs = ctx.createRadialGradient(100, 290, 2, 100, 290, 62)
		fs.addColorStop(0, "rgba(0,0,0,0.55)")
		fs.addColorStop(1, "rgba(0,0,0,0)")
		ctx.fillStyle = fs
		ctx.beginPath()
		ctx.ellipse(100, 290, 62, 11, 0, 0, (Math.PI * 2))
		ctx.fill()
	end
	exports.paintHeroShadow = paintHeroShadow
	paintHeroFigure = function(ctx, look, faceStyle, fakeFaceStyle, _p3)
		if _p3 == nil then _p3 = Js.O({}, nil) end
		local armsUp = _p3.armsUp
		if armsUp == nil then armsUp = false end
		local shadow = _p3.shadow
		if shadow == nil then shadow = true end
		local reach = _p3.reach
		local _d4 = look
		local shirt = _d4.shirt
		local shorts = _d4.shorts
		local trim = _d4.trim
		local skin = _d4.skin
		local sock = shirt
		local ink = (if (luminance(shorts) > 0.6) then tint(shirt, -0.2) else "#ffffff")
		if shadow then
			paintHeroShadow(ctx)
		end
		limb(ctx, Js.alit(117, 206), Js.alit(121, 244), 19, 14, skin)
		limb(ctx, Js.alit(121, 244), Js.alit(123, 276), 14, 10, skin)
		limb(ctx, Js.alit(121, 247), Js.alit(123, 276), 15, 11.5, sock)
		ctx.fillStyle = trim
		ctx.fillRect(113.5, 247, 15, 3)
		boot(ctx, 125, 281, 1, 0.95, trim)
		limb(ctx, Js.alit(84, 206), Js.alit(80, 243), 21, 15, skin)
		limb(ctx, Js.alit(80, 243), Js.alit(77, 277), 15, 10.5, skin)
		limb(ctx, Js.alit(80, 246), Js.alit(77, 277), 16, 12, sock)
		ctx.fillStyle = trim
		ctx.fillRect(71.5, 246, 16.5, 3)
		boot(ctx, 74, 283, -1, 1.05, trim)
		ctx.fillStyle = "rgba(255,255,255,0.18)"
		ctx.beginPath()
		ctx.ellipse(77, 240, 3, 5, 0, 0, (Math.PI * 2))
		ctx.fill()
		local farSh = Js.alit(140, 96)
		local nearSh = Js.alit(60, 97)
		local farElbow = (if reach then reach.elbow else (if armsUp then Js.alit(161, 60) else Js.alit(147, 140)))
		local farHand = (if reach then reach.hand else (if armsUp then Js.alit(171, 25) else Js.alit(150, 184)))
		local farInFront = (armsUp or (not (not reach)))
		local nearElbow = (if armsUp then Js.alit(39, 60) else Js.alit(52, 140))
		local nearHand = (if armsUp then Js.alit(29, 25) else Js.alit(49, 184))
		local farArm = function()
			limb(ctx, along(farSh, farElbow, 0.35), farElbow, 16, 14, skin)
			limb(ctx, farElbow, farHand, 14, 11, skin)
			ctx.fillStyle = tint(skin, -0.12)
			ctx.beginPath()
			ctx.arc(farHand[1], (farHand[2] + (if armsUp then -2 else (if reach then 0 else 2))), 6.5, 0, (Math.PI * 2))
			ctx.fill()
		end
		local nearArm = function()
			limb(ctx, along(nearSh, nearElbow, 0.35), nearElbow, 17, 15, skin)
			limb(ctx, nearElbow, nearHand, 15, 11.5, skin)
			ctx.fillStyle = skin
			ctx.beginPath()
			ctx.arc(nearHand[1], (nearHand[2] + (if armsUp then -2 else 2)), 7.2, 0, (Math.PI * 2))
			ctx.fill()
			if (not armsUp) then
				ctx.fillStyle = "rgba(255,255,255,0.18)"
				ctx.beginPath()
				ctx.ellipse(46.5, 160, 2, 9, 0.05, 0, (Math.PI * 2))
				ctx.fill()
			end
		end
		if (not farInFront) then
			farArm()
		end
		do
			local g = ctx.createLinearGradient(66, 0, 136, 0)
			g.addColorStop(0, tint(shorts, 0.18))
			g.addColorStop(0.5, shorts)
			g.addColorStop(1, tint(shorts, -0.3))
			ctx.fillStyle = g
			ctx.beginPath()
			ctx.moveTo(71, 164)
			ctx.lineTo(131, 164)
			ctx.lineTo(136, 208)
			ctx.quadraticCurveTo(118, 214, 103, 211)
			ctx.lineTo(100, 194)
			ctx.lineTo(97, 211)
			ctx.quadraticCurveTo(80, 214, 65, 208)
			ctx.closePath()
			ctx.fill()
			ctx.strokeStyle = rgba(tint(shorts, -0.5), 0.35)
			ctx.lineWidth = 1.4
			ctx.beginPath()
			ctx.moveTo(90, 176)
			ctx.quadraticCurveTo(94, 188, 92, 204)
			ctx.stroke()
			ctx.beginPath()
			ctx.moveTo(112, 178)
			ctx.quadraticCurveTo(110, 190, 115, 205)
			ctx.stroke()
			ctx.strokeStyle = shirt
			ctx.lineWidth = 2.4
			ctx.beginPath()
			ctx.moveTo(69, 172)
			ctx.lineTo(66.5, 206)
			ctx.stroke()
			if (look.number ~= nil) then
				ctx.save()
				ctx.font = "900 15px system-ui, -apple-system, 'Segoe UI', sans-serif"
				ctx.textAlign = "center"
				ctx.textBaseline = "middle"
				ctx.lineWidth = 2.5
				ctx.strokeStyle = rgba("#000000", 0.25)
				ctx.strokeText(Js.numstr(look.number), 82, 196)
				ctx.fillStyle = ink
				ctx.fillText(Js.numstr(look.number), 82, 196)
				ctx.restore()
			end
		end
		local torso = function()
			ctx.beginPath()
			ctx.moveTo(88, 82)
			ctx.lineTo(68, 86)
			ctx.quadraticCurveTo(57, 89, 55, 100)
			ctx.lineTo(66, 118)
			ctx.lineTo(70, 168)
			ctx.quadraticCurveTo(101, 176, 132, 168)
			ctx.lineTo(134, 118)
			ctx.lineTo(145, 99)
			ctx.quadraticCurveTo(143, 89, 133, 86)
			ctx.lineTo(113, 82)
			ctx.quadraticCurveTo(101, 90, 88, 82)
			ctx.closePath()
		end
		do
			local g = ctx.createLinearGradient(44, 70, 156, 120)
			g.addColorStop(0, tint(shirt, 0.3))
			g.addColorStop(0.42, shirt)
			g.addColorStop(1, tint(shirt, -0.38))
			ctx.fillStyle = g
			torso()
			ctx.fill()
			ctx.save()
			torso()
			ctx.clip()
			local v = ctx.createLinearGradient(0, 80, 0, 172)
			v.addColorStop(0, "rgba(255,255,255,0.10)")
			v.addColorStop(0.5, "rgba(0,0,0,0)")
			v.addColorStop(1, "rgba(0,0,0,0.22)")
			ctx.fillStyle = v
			ctx.fillRect(40, 78, 120, 100)
			ctx.strokeStyle = rgba(tint(shirt, -0.55), 0.38)
			ctx.lineCap = "round"
			ctx.lineWidth = 2.2
			ctx.beginPath()
			ctx.moveTo(78, 124)
			ctx.quadraticCurveTo(88, 144, 81, 166)
			ctx.stroke()
			ctx.lineWidth = 1.6
			ctx.beginPath()
			ctx.moveTo(122, 128)
			ctx.quadraticCurveTo(113, 148, 121, 166)
			ctx.stroke()
			ctx.beginPath()
			ctx.moveTo(90, 150)
			ctx.quadraticCurveTo(101, 156, 113, 149)
			ctx.stroke()
			ctx.lineWidth = 1.3
			ctx.beginPath()
			ctx.moveTo(56, 112)
			ctx.quadraticCurveTo(60, 120, 57, 129)
			ctx.stroke()
			ctx.strokeStyle = "rgba(255,255,255,0.32)"
			ctx.lineWidth = 3
			ctx.beginPath()
			ctx.moveTo(52, 104)
			ctx.quadraticCurveTo(58, 90, 76, 87)
			ctx.stroke()
			ctx.fillStyle = "rgba(255,255,255,0.10)"
			ctx.beginPath()
			ctx.ellipse(86, 112, 13, 18, -0.3, 0, (Math.PI * 2))
			ctx.fill()
			ctx.restore()
		end
		if farInFront then
			farArm()
		end
		nearArm()
		sleeve(ctx, farSh, farElbow, 21, 16.5, tint(shirt, -0.22), trim)
		sleeve(ctx, nearSh, nearElbow, 23, 19, shirt, trim)
		local fit = look.fitted
		if fit then
			local k = (HERO_FACE_H / fit.faceH)
			local dx = (101 - (fit.chinX * k))
			local dy = (HERO_CHIN_Y - (fit.chinY * k))
			ctx.strokeStyle = tint(trim, -0.25)
			ctx.lineWidth = 3.5
			ctx.lineCap = "round"
			ctx.beginPath()
			ctx.moveTo(90, 83)
			ctx.quadraticCurveTo(101, 77, 112, 83)
			ctx.stroke()
			limb(ctx, Js.alit(101, (HERO_CHIN_Y - 8)), Js.alit(101, 88), 16, 17, tint(skin, -0.2))
			ctx.drawImage(fit.canvas, dx, dy, (fit.canvas.width * k), (fit.canvas.height * k))
			local js = ctx.createRadialGradient(101, (HERO_CHIN_Y + 1), 1, 101, (HERO_CHIN_Y + 1), 10)
			js.addColorStop(0, "rgba(0,0,0,0.30)")
			js.addColorStop(1, "rgba(0,0,0,0)")
			ctx.fillStyle = js
			ctx.beginPath()
			ctx.ellipse(101, (HERO_CHIN_Y + 2), 9, 4, 0, 0, (Math.PI * 2))
			ctx.fill()
		else
			limb(ctx, Js.alit(101, 70), Js.alit(101, 88), 17, 17, skin)
			ctx.fillStyle = "rgba(0,0,0,0.28)"
			ctx.beginPath()
			ctx.ellipse(101, 76, 8.5, 3.5, 0, 0, (Math.PI * 2))
			ctx.fill()
		end
		ctx.strokeStyle = trim
		ctx.lineWidth = 4
		ctx.lineJoin = "round"
		ctx.lineCap = "round"
		ctx.beginPath()
		ctx.moveTo(89, 82)
		ctx.lineTo(102, 97)
		ctx.lineTo(113, 82)
		ctx.stroke()
		if (not fit) then
			local r = 104
			if look.drawHead then
				look.drawHead(ctx)
			else
				M_drawPlayerHead.drawPlayerHead(ctx, 101, (86 - (0.184 * r)), (0.114 * r), r, look.face, faceStyle, fakeFaceStyle)
			end
		end
	end
	exports.paintHeroFigure = paintHeroFigure
	HERO_W = 200
	exports.HERO_W = HERO_W
	HERO_H = 300
	exports.HERO_H = HERO_H
	HERO_TOP = 12
	exports.HERO_TOP = HERO_TOP
	HERO_FACE_H = 29
	exports.HERO_FACE_H = HERO_FACE_H
	HERO_CHIN_Y = 80
	exports.HERO_CHIN_Y = HERO_CHIN_Y
	HERO_CREST = Js.O({ x = (119 / HERO_W), y = (112 / HERO_H), size = (17 / HERO_W) }, { "x", "y", "size" })
	exports.HERO_CREST = HERO_CREST
	along = function(a, b, t)
		return Js.alit((a[1] + ((b[1] - a[1]) * t)), (a[2] + ((b[2] - a[2]) * t)))
	end
	exports.along = along
end
