--!nocheck
--!nolint
-- Generated from lib/star/figure3d.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_faceFit = import("lib/star/faceFit")
	local M_heroFigure = import("lib/star/heroFigure")
	local M_drawPlayerHead = import("lib/star/drawPlayerHead")
	local shapeHand, oneFootKickFeet, FIG3D, shadowSprite, softShadow, drawSoftShadow, fits, queued, queue, pumping, FIT_MAX_SIDE, halve, pump, fittedHeadFor, mipFor, HAIR_STYLES, HAIR_COLOURS, hashKey, SKIN_TONES, skinFor, hairFor, drawStyledHead, paintBody3d, sprites, SPRITE_LIMIT, SPRITE_X, SPRITE_UP, SPRITE_DOWN, drawBody3d, headKey
	shapeHand = function(r, s, x, y, armFromY, lead, trailDrop, handsIn)
		local isLead = ((lead ~= 0) and (Math.sign(s) == Math.sign(lead)))
		local trail = (if ((lead ~= 0) and (not isLead)) then trailDrop else 0)
		local reach = (if isLead then (trailDrop * 0.85) else 0)
		local x1 = ((x + ((((s * r) * 0.3) - x) * trail)) + ((((s * r) * 0.16) - x) * reach))
		local y1 = ((y + (((armFromY + (r * 0.5)) - y) * trail)) + (((armFromY - (r * 0.92)) - y) * reach))
		do return Js.alit((x1 + ((((s * r) * 0.13) - x1) * handsIn)), (y1 + (((armFromY + (r * 0.3)) - y1) * handsIn))) end
	end
	exports.shapeHand = shapeHand
	oneFootKickFeet = function(r, feetY, kick, kickFoot, amp, cross, plant)
		if amp == nil then amp = 1 end
		if cross == nil then cross = 0 end
		if plant == nil then plant = 0 end
		local kf = (function() local _l = Math.sign(kickFoot); if Js.T(_l) then return _l end; return 1 end)()
		local strikeX = (((kf * r) * (0.19 + ((kick * 0.24) * amp))) - ((((kf * r) * cross) * 0.5) * kick))
		local strikeY = ((feetY * r) - (((kick * r) * 0.3) * amp))
		local plantX = (((-kf) * r) * (0.12 + (0.07 * plant)))
		local plantY = (feetY * r)
		do return (if (kf > 0) then Js.O({ lx = plantX, ly = plantY, rx = strikeX, ry = strikeY }, { "lx", "ly", "rx", "ry" }) else Js.O({ lx = strikeX, ly = strikeY, rx = plantX, ry = plantY }, { "lx", "ly", "rx", "ry" })) end
	end
	exports.oneFootKickFeet = oneFootKickFeet
	softShadow = function()
		if shadowSprite then
			do return shadowSprite end
		end
		if (Js.document == nil) then
			do return nil end
		end
		local c = Js.document.createElement("canvas")
		c.width = 64
		c.height = 64
		local g = c.getContext("2d")
		if (not g) then
			do return nil end
		end
		local rg = g.createRadialGradient(32, 32, 0, 32, 32, 32)
		rg.addColorStop(0, "rgba(0,0,0,1)")
		rg.addColorStop(0.45, "rgba(0,0,0,0.75)")
		rg.addColorStop(1, "rgba(0,0,0,0)")
		g.fillStyle = rg
		g.fillRect(0, 0, 64, 64)
		shadowSprite = c
		do return c end
	end
	drawSoftShadow = function(ctx, x, groundY, rx, ry)
		local s = softShadow()
		if (not s) then
			do return end
		end
		local w = (rx * FIG3D.shadowGrow)
		local h = ((ry * FIG3D.shadowGrow) * 1.1)
		local a = ctx.globalAlpha
		ctx.globalAlpha = (a * FIG3D.shadowAlpha)
		ctx.drawImage(s, (x - w), (groundY - h), (w * 2), (h * 2))
		ctx.globalAlpha = a
	end
	exports.drawSoftShadow = drawSoftShadow
	halve = function(c)
		local w = Math.max(4, Math.round((c.width / 2)))
		local h = Math.max(4, Math.round((c.height / 2)))
		local o = Js.document.createElement("canvas")
		o.width = w
		o.height = h
		local g = o.getContext("2d")
		if (not g) then
			do return nil end
		end
		g.imageSmoothingQuality = "high"
		g.drawImage(c, 0, 0, w, h)
		do return o end
	end
	pump = function()
		local step
		if pumping then
			do return end
		end
		pumping = true
		local later = function(f)
			local w = Js.window
			if w.requestIdleCallback then
				w.requestIdleCallback(f, Js.O({ timeout = 1000 }, { "timeout" }))
			else
				Js.window.setTimeout(f, 30)
			end
		end
		local store = function(url, fit)
			if fit then
				local mips = Js.alit(fit.canvas)
				local c = fit.canvas
				while (c and (c.height > 24)) do
					c = halve(c)
					if c then
						A.push(mips, c)
					end
				end
				fits:set(url, Js.O({ fit = fit, mips = mips }, { "fit", "mips" }))
			else
				fits:set(url, nil)
			end
			queued:delete(url)
		end
		step = function()
			local url = A.shift(queue)
			if (url == nil) then
				pumping = false
				do return end
			end
			local decoded = (if (type(Js.createImageBitmap) == "function") then Js.fetch(url, Js.O({ mode = "cors" }, { "mode" })):andThen(function(r)
				return (if r.ok then r.blob() else nil)
			end):andThen(function(b)
				return (if b then Js.createImageBitmap(b, Js.O({ resizeHeight = FIT_MAX_SIDE, resizeQuality = "medium" }, { "resizeHeight", "resizeQuality" })) else nil)
			end):catch_(function()
				return nil
			end) else Js.Promise.resolve(nil))
			decoded:andThen(function(bmp)
				later(function()
					if bmp then
						store(url, M_faceFit.fitFace(bmp, FIT_MAX_SIDE, url))
						bmp.close()
					else
						local img = M_faceFit.fitImage(url)
						if (img.complete and Js.T(img.naturalWidth)) then
							store(url, M_faceFit.fitFace(img, FIT_MAX_SIDE))
						elseif img.complete then
							store(url, nil)
						else
							A.push(queue, url)
						end
					end
					if Js.T(Js.alen(queue)) then
						later(step)
					else
						pumping = false
					end
				end)
			end)
		end
		later(step)
	end
	fittedHeadFor = function(face)
		if ((not face) or (Js.document == nil)) then
			do return nil end
		end
		local url = face.src
		if (not Js.T(url)) then
			do return nil end
		end
		local hit = fits:get(url)
		if (hit ~= nil) then
			do return hit end
		end
		if (not queued:has(url)) then
			queued:add(url)
			A.push(queue, url)
			pump()
		end
		do return nil end
	end
	exports.fittedHeadFor = fittedHeadFor
	mipFor = function(f, px)
		local best = f.mips[1]
		do
			local _arr1 = f.mips
			local _i2 = 0
			while _i2 < Js.alen(_arr1) do
				_i2 += 1
				local m = _arr1[_i2]
				if (m.height >= px) then
					best = m
				end
			end
		end
		do return best end
	end
	exports.mipFor = mipFor
	hashKey = function(key)
		local h = 5381
		for i = 0, (S.len(key)) - 1 do
			h = Js.ushr(Js.bxor((h * 33), S.charCodeAt(key, i)), 0)
		end
		h = Js.bxor(h, Js.ushr(h, 16))
		h = Js.ushr(Math.imul(h, 2246822507), 0)
		h = Js.bxor(h, Js.ushr(h, 13))
		h = Js.ushr(Math.imul(h, 3266489909), 0)
		h = Js.bxor(h, Js.ushr(h, 16))
		do return Js.ushr(h, 0) end
	end
	skinFor = function(key)
		do return SKIN_TONES[math.fmod(Js.ushr(hashKey(key), 16), Js.alen(SKIN_TONES)) + 1] end
	end
	exports.skinFor = skinFor
	hairFor = function(key)
		local h = hashKey(key)
		do return Js.O({ style = HAIR_STYLES[math.fmod(h, Js.alen(HAIR_STYLES)) + 1], colour = HAIR_COLOURS[math.fmod(Js.ushr(h, 8), Js.alen(HAIR_COLOURS)) + 1] }, { "style", "colour" }) end
	end
	exports.hairFor = hairFor
	drawStyledHead = function(ctx, cx, chinY, faceH, skin, key, back)
		if back == nil then back = false end
		local picked = hairFor(key)
		local style = picked.style
		local close = (math.abs((M_heroFigure.luminance(picked.colour) - M_heroFigure.luminance(skin))) < 0.22)
		local colour = (if ((style == "buzz") or close) then M_heroFigure.tint(picked.colour, -0.45) else picked.colour)
		local rx = (faceH * 0.68)
		local ry = (faceH * 0.93)
		local cy = (chinY - ry)
		local hairLit = M_heroFigure.tint(colour, 0.28)
		local hairDark = M_heroFigure.tint(colour, -0.35)
		if (style == "long") then
			local g = ctx.createLinearGradient((cx - rx), 0, (cx + rx), 0)
			g.addColorStop(0, hairLit)
			g.addColorStop(0.5, colour)
			g.addColorStop(1, hairDark)
			ctx.fillStyle = g
			ctx.beginPath()
			ctx.moveTo((cx - (rx * 1.08)), (cy - (ry * 0.1)))
			ctx.quadraticCurveTo((cx - (rx * 1.2)), (chinY + (ry * 0.35)), (cx - (rx * 0.55)), (chinY + (ry * 0.42)))
			ctx.lineTo((cx + (rx * 0.55)), (chinY + (ry * 0.42)))
			ctx.quadraticCurveTo((cx + (rx * 1.2)), (chinY + (ry * 0.35)), (cx + (rx * 1.08)), (cy - (ry * 0.1)))
			ctx.closePath()
			ctx.fill()
		end
		ctx.fillStyle = M_heroFigure.tint(skin, -0.12)
		ctx.beginPath()
		ctx.ellipse((cx - (rx * 0.97)), (cy + (ry * 0.12)), (rx * 0.17), (ry * 0.2), 0, 0, (Math.PI * 2))
		ctx.fill()
		ctx.beginPath()
		ctx.ellipse((cx + (rx * 0.97)), (cy + (ry * 0.12)), (rx * 0.17), (ry * 0.2), 0, 0, (Math.PI * 2))
		ctx.fill()
		local fg = ctx.createLinearGradient((cx - rx), (cy - (ry * 0.3)), (cx + rx), (cy + (ry * 0.3)))
		fg.addColorStop(0, M_heroFigure.tint(skin, 0.16))
		fg.addColorStop(0.5, skin)
		fg.addColorStop(1, M_heroFigure.tint(skin, -0.26))
		ctx.fillStyle = fg
		ctx.beginPath()
		ctx.moveTo(cx, chinY)
		ctx.bezierCurveTo((cx - (rx * 0.75)), chinY, (cx - rx), (cy + (ry * 0.45)), (cx - rx), cy)
		ctx.bezierCurveTo((cx - rx), (cy - (ry * 0.62)), (cx - (rx * 0.55)), (cy - ry), cx, (cy - ry))
		ctx.bezierCurveTo((cx + (rx * 0.55)), (cy - ry), (cx + rx), (cy - (ry * 0.62)), (cx + rx), cy)
		ctx.bezierCurveTo((cx + rx), (cy + (ry * 0.45)), (cx + (rx * 0.75)), chinY, cx, chinY)
		ctx.closePath()
		ctx.fill()
		if (not back) then
			local eyeY = (cy + (ry * 0.12))
			local ex = (rx * 0.38)
			ctx.fillStyle = "#1a1210"
			ctx.beginPath()
			ctx.ellipse((cx - ex), eyeY, (rx * 0.1), (ry * 0.07), 0, 0, (Math.PI * 2))
			ctx.fill()
			ctx.beginPath()
			ctx.ellipse((cx + ex), eyeY, (rx * 0.1), (ry * 0.07), 0, 0, (Math.PI * 2))
			ctx.fill()
			ctx.strokeStyle = hairDark
			ctx.lineCap = "round"
			ctx.lineWidth = Math.max(0.6, (ry * 0.07))
			ctx.beginPath()
			ctx.moveTo(((cx - ex) - (rx * 0.16)), (eyeY - (ry * 0.16)))
			ctx.lineTo(((cx - ex) + (rx * 0.14)), (eyeY - (ry * 0.19)))
			ctx.stroke()
			ctx.beginPath()
			ctx.moveTo(((cx + ex) - (rx * 0.14)), (eyeY - (ry * 0.19)))
			ctx.lineTo(((cx + ex) + (rx * 0.16)), (eyeY - (ry * 0.16)))
			ctx.stroke()
			ctx.fillStyle = M_heroFigure.rgba(M_heroFigure.tint(skin, -0.5), 0.35)
			ctx.beginPath()
			ctx.ellipse((cx + (rx * 0.06)), (eyeY + (ry * 0.3)), (rx * 0.08), (ry * 0.12), 0, 0, (Math.PI * 2))
			ctx.fill()
			ctx.strokeStyle = M_heroFigure.rgba(M_heroFigure.tint(skin, -0.55), 0.55)
			ctx.lineWidth = Math.max(0.5, (ry * 0.05))
			ctx.beginPath()
			ctx.moveTo((cx - (rx * 0.2)), (eyeY + (ry * 0.58)))
			ctx.quadraticCurveTo(cx, (eyeY + (ry * 0.64)), (cx + (rx * 0.2)), (eyeY + (ry * 0.58)))
			ctx.stroke()
		end
		local hg = ctx.createLinearGradient((cx - rx), (cy - ry), (cx + rx), cy)
		hg.addColorStop(0, hairLit)
		hg.addColorStop(0.5, colour)
		hg.addColorStop(1, hairDark)
		ctx.fillStyle = hg
		local line = (if (style == "buzz") then 0.62 else (if (style == "quiff") then 0.5 else 0.42))
		local top = (if (style == "quiff") then 1.24 else (if (style == "curly") then 1.12 else (if (style == "buzz") then 1.01 else 1.07)))
		local alpha = ctx.globalAlpha
		if (style == "buzz") then
			ctx.globalAlpha = (alpha * 0.85)
		end
		ctx.beginPath()
		ctx.moveTo((cx - (rx * 1.02)), (cy + (ry * (if back then 0.55 else 0.05))))
		ctx.bezierCurveTo((cx - (rx * 1.06)), (cy - (ry * 0.8)), (cx - (rx * 0.6)), (cy - (ry * top)), cx, (cy - (ry * top)))
		ctx.bezierCurveTo((cx + (rx * 0.6)), (cy - (ry * top)), (cx + (rx * 1.06)), (cy - (ry * 0.8)), (cx + (rx * 1.02)), (cy + (ry * (if back then 0.55 else 0.05))))
		if back then
			ctx.quadraticCurveTo(cx, (cy + (ry * 0.75)), (cx - (rx * 1.02)), (cy + (ry * 0.55)))
		else
			ctx.quadraticCurveTo((cx + (rx * 0.7)), (cy - (ry * line)), (cx + (rx * 0.2)), (cy - (ry * line)))
			ctx.quadraticCurveTo((cx - (rx * 0.25)), (cy - (ry * (line - 0.08))), (cx - (rx * 0.75)), (cy - (ry * (line - 0.1))))
			ctx.quadraticCurveTo((cx - (rx * 0.95)), (cy - (ry * 0.15)), (cx - (rx * 1.02)), (cy + (ry * 0.05)))
		end
		ctx.closePath()
		ctx.fill()
		if (style == "curly") then
			for i = 0, 5 do
				local a = (Math.PI * (1.17 + (i * 0.132)))
				ctx.beginPath()
				ctx.arc((cx + ((Math.cos(a) * rx) * 0.92)), (cy + ((Math.sin(a) * ry) * 0.95)), (rx * 0.24), 0, (Math.PI * 2))
				ctx.fill()
			end
		end
		ctx.globalAlpha = alpha
		ctx.strokeStyle = "rgba(255,255,255,0.22)"
		ctx.lineWidth = Math.max(0.6, (ry * 0.08))
		ctx.lineCap = "round"
		ctx.beginPath()
		ctx.arc((cx - (rx * 0.1)), (cy - (ry * 0.1)), (ry * 0.78), (Math.PI * 1.2), (Math.PI * 1.45))
		ctx.stroke()
	end
	exports.drawStyledHead = drawStyledHead
	paintBody3d = function(ctx, r, look, faceStyle, fakeFaceStyle, pose, A_, fallbackSkin)
		local photoShown = (((faceStyle.facesEnabled and (not (not look.face))) and look.face.complete) and (look.face.naturalWidth > 0))
		local fitted = (if photoShown then fittedHeadFor(look.face) else nil)
		local hk = headKey(look)
		local skin = ((function() local _v = fitted; if _v == nil then return nil end; _v = _v.fit; _v = _v.skin; return _v end)() or (if photoShown then (if look.skin ~= nil then look.skin else fallbackSkin) else skinFor(hk)))
		local mode = (if fitted then "fit" else (if photoShown then "photo" else "drawn"))
		local q = function(v, d, st)
			return (Math.round(((if v ~= nil then v else d) / st)) * st)
		end
		local qp = Js.O({ armSpread = q((function() local _v = pose; if _v == nil then return nil end; _v = _v.armSpread; return _v end)(), 0, 0.05), armLift = q((function() local _v = pose; if _v == nil then return nil end; _v = _v.armLift; return _v end)(), -0.55, 0.05), crouch = q((function() local _v = pose; if _v == nil then return nil end; _v = _v.crouch; return _v end)(), 0, 0.05), legSwing = q((function() local _v = pose; if _v == nil then return nil end; _v = _v.legSwing; return _v end)(), 0, 0.125), kick = q((function() local _v = pose; if _v == nil then return nil end; _v = _v.kick; return _v end)(), 0, 0.0625), armLead = Math.sign(((function() local _v = pose; if _v == nil then return nil end; _v = _v.armLead; return _v end)() or (if ((((function() local _v = pose; if _v == nil then return nil end; _v = _v.kick; return _v end)() or 0) > 0) and Js.T((function() local _v = pose; if _v == nil then return nil end; _v = _v.kickFoot; return _v end)())) then (-pose.kickFoot) else 0))), gloves = (not (not (function() local _v = pose; if _v == nil then return nil end; _v = _v.gloves; return _v end)())), kickFoot = (if (((function() local _v = pose; if _v == nil then return nil end; _v = _v.kick; return _v end)() or 0) > 0) then Math.sign(((function() local _v = pose; if _v == nil then return nil end; _v = _v.kickFoot; return _v end)() or 0)) else 0), trailDrop = q((function() local _v = pose; if _v == nil then return nil end; _v = _v.trailDrop; return _v end)(), 0, 0.125), handsIn = q((function() local _v = pose; if _v == nil then return nil end; _v = _v.handsIn; return _v end)(), 0, 0.125), swingAmp = q((function() local _v = pose; if _v == nil then return nil end; _v = _v.swingAmp; return _v end)(), 1, 0.0625), swingCross = q((function() local _v = pose; if _v == nil then return nil end; _v = _v.swingCross; return _v end)(), 0, 0.0625), plantBend = q((function() local _v = pose; if _v == nil then return nil end; _v = _v.plantBend; return _v end)(), 0, 0.125) }, { "armSpread", "armLift", "crouch", "legSwing", "kick", "armLead", "gloves", "kickFoot", "trailDrop", "handsIn", "swingAmp", "swingCross", "plantBend" })
		local t = ctx.getTransform()
		local k = (function() local _l = Math.hypot(t.a, t.b); if Js.T(_l) then return _l end; return 1 end)()
		local rDev = (r * k)
		if ((rDev <= 160) and (Js.document ~= nil)) then
			local rq = (Math.max(2, (Math.round((rDev / 2)) * 2)) / k)
			local key = A.join(Js.aspread(Js.alit(look.shirt, look.shorts, look.trim, skin, mode, (if (mode == "drawn") then hk else ""), qp.armSpread, qp.armLift, qp.crouch, qp.legSwing, qp.kick, qp.armLead, qp.kickFoot, (if qp.gloves then 1 else 0), Math.round((rq * k))), (if (Js.T(qp.trailDrop) or Js.T(qp.handsIn)) then Js.alit(qp.trailDrop, qp.handsIn) else Js.alit()), (if (((qp.swingAmp ~= 1) or Js.T(qp.swingCross)) or Js.T(qp.plantBend)) then Js.alit("s", qp.swingAmp, qp.swingCross, qp.plantBend) else Js.alit())), "|")
			local sp = sprites:get(key)
			if sp then
				sprites:delete(key)
				sprites:set(key, sp)
			else
				local ox = (SPRITE_X * rq)
				local oy = (SPRITE_UP * rq)
				local c = Js.document.createElement("canvas")
				c.width = math.ceil(((2 * ox) * k))
				c.height = math.ceil((((SPRITE_UP + SPRITE_DOWN) * rq) * k))
				local g = c.getContext("2d")
				if g then
					g.setTransform(k, 0, 0, k, (ox * k), (oy * k))
					drawBody3d(g, rq, look, skin, qp, A_, mode, hk)
				end
				sp = Js.O({ c = c, ox = (ox * k), oy = (oy * k) }, { "c", "ox", "oy" })
				sprites:set(key, sp)
				if (sprites.size > SPRITE_LIMIT) then
					sprites:delete(sprites:keys().next().value)
				end
			end
			local f = (r / rq)
			ctx.drawImage(sp.c, ((-(sp.ox / k)) * f), ((-(sp.oy / k)) * f), ((sp.c.width / k) * f), ((sp.c.height / k) * f))
		else
			drawBody3d(ctx, r, look, skin, qp, A_, mode, hk)
		end
		local sink = (((if qp.crouch ~= nil then qp.crouch else 0) * r) * 0.16)
		local neckY = ((A_.NECK_Y * r) + sink)
		if fitted then
			local chinY = (neckY - (FIG3D.chinAboveNeck * r))
			local kk = ((FIG3D.faceH * r) / fitted.fit.faceH)
			local hw = (fitted.fit.canvas.width * kk)
			local hh = (fitted.fit.canvas.height * kk)
			local img = mipFor(fitted, (hh * k))
			ctx.drawImage(img, ((-fitted.fit.chinX) * kk), (chinY - (fitted.fit.chinY * kk)), hw, hh)
		elseif photoShown then
			M_drawPlayerHead.drawPlayerHead(ctx, 0, ((A_.HEAD_ANCHOR * r) + sink), (A_.HEAD_BASE_R * r), r, look.face, faceStyle, fakeFaceStyle)
		end
	end
	exports.paintBody3d = paintBody3d
	drawBody3d = function(ctx, r, look, skin, pose, A_, mode, hk)
		local _d3 = look
		local shirt = _d3.shirt
		local shorts = _d3.shorts
		local trim = _d3.trim
		local sock = shirt
		local u = (r / 107)
		local spread = ((function() local _v = pose; if _v == nil then return nil end; _v = _v.armSpread; return _v end)() or 0)
		local lift = ((function() local _v = pose; if _v == nil then return nil end; _v = _v.armLift; return _v end)() or -0.55)
		local crouch = ((function() local _v = pose; if _v == nil then return nil end; _v = _v.crouch; return _v end)() or 0)
		local swing = ((function() local _v = pose; if _v == nil then return nil end; _v = _v.legSwing; return _v end)() or 0)
		local kick = ((function() local _v = pose; if _v == nil then return nil end; _v = _v.kick; return _v end)() or 0)
		local sink = ((crouch * r) * 0.16)
		local stride = (((swing * 0.42) + (kick * 0.55)) * r)
		local footRise = (math.abs(stride) * 0.15)
		local one = (if ((kick > 0) and Js.T((function() local _v = pose; if _v == nil then return nil end; _v = _v.kickFoot; return _v end)())) then oneFootKickFeet(r, A_.FEET_Y, kick, pose.kickFoot, pose.swingAmp, pose.swingCross, pose.plantBend) else nil)
		local plant3d = (if one then ((function() local _v = pose; if _v == nil then return nil end; _v = _v.plantBend; return _v end)() or 0) else 0)
		local plantSide3d = (-(Math.sign(((function() local _v = pose; if _v == nil then return nil end; _v = _v.kickFoot; return _v end)() or 0))))
		local footL = (if one then one.lx else (((-r) * 0.19) - (stride * 0.35)))
		local footR = (if one then one.rx else ((r * 0.19) + (stride * 0.35)))
		local footYL = (if one then one.ly else ((A_.FEET_Y * r) - footRise))
		local footYR = (if one then one.ry else ((A_.FEET_Y * r) - footRise))
		local hipY = ((A_.HIP_Y * r) + sink)
		do
			local _arr4 = Js.alit(Js.alit(((-r) * 0.16), footL, footYL), Js.alit((r * 0.16), footR, footYR))
			local _i5 = 0
			while _i5 < Js.alen(_arr4) do
				_i5 += 1
				local _e6 = _arr4[_i5]
				local hx = _e6[1]
				local fx = _e6[2]
				local footY = _e6[3]
				local hip = Js.alit(hx, hipY)
				local ankle = Js.alit(fx, (footY - (r * 0.07)))
				local knee = Js.alit((((hx + fx) / 2) + ((Math.sign(hx) * r) * (0.025 + (if (Math.sign(hx) == plantSide3d) then (0.09 * plant3d) else 0)))), ((hipY + ankle[2]) / 2))
				M_heroFigure.limb(ctx, hip, knee, (r * 0.2), (r * 0.155), skin)
				M_heroFigure.limb(ctx, knee, ankle, (r * 0.155), (r * 0.11), skin)
				local sockTop = M_heroFigure.along(knee, ankle, 0.22)
				M_heroFigure.limb(ctx, sockTop, ankle, (r * 0.165), (r * 0.125), sock)
				ctx.strokeStyle = trim
				ctx.lineWidth = Math.max(0.8, (r * 0.035))
				ctx.lineCap = "butt"
				local dx = (ankle[1] - knee[1])
				local dy = (ankle[2] - knee[2])
				local L = (function() local _l = Math.hypot(dx, dy); if Js.T(_l) then return _l end; return 1 end)()
				local nx = ((-dy) / L)
				local ny = (dx / L)
				local w = (r * 0.085)
				ctx.beginPath()
				ctx.moveTo((sockTop[1] + (nx * w)), (sockTop[2] + (ny * w)))
				ctx.lineTo((sockTop[1] - (nx * w)), (sockTop[2] - (ny * w)))
				ctx.stroke()
				local bx = fx
				local by = footY
				local bg = ctx.createLinearGradient(bx, (by - (r * 0.08)), bx, (by + (r * 0.07)))
				bg.addColorStop(0, "#474d5a")
				bg.addColorStop(1, "#07090d")
				ctx.fillStyle = bg
				ctx.beginPath()
				ctx.ellipse(bx, by, (r * 0.12), (r * 0.075), 0, 0, (Math.PI * 2))
				ctx.fill()
				ctx.fillStyle = "rgba(255,255,255,0.4)"
				ctx.beginPath()
				ctx.ellipse((bx - (r * 0.035)), (by - (r * 0.03)), (r * 0.045), (r * 0.017), -0.2, 0, (Math.PI * 2))
				ctx.fill()
				ctx.strokeStyle = trim
				ctx.lineWidth = Math.max(0.6, (r * 0.022))
				ctx.lineCap = "round"
				ctx.beginPath()
				ctx.moveTo((bx - (r * 0.06)), (by + (r * 0.01)))
				ctx.lineTo((bx + (r * 0.06)), (by + (r * 0.01)))
				ctx.stroke()
			end
		end
		do
			local top = (((A_.HIP_Y - 0.1) * r) + sink)
			local h = (r * 0.31)
			local g = ctx.createLinearGradient(((-r) * 0.33), 0, (r * 0.33), 0)
			g.addColorStop(0, M_heroFigure.tint(shorts, 0.2))
			g.addColorStop(0.5, shorts)
			g.addColorStop(1, M_heroFigure.tint(shorts, -0.32))
			ctx.fillStyle = g
			ctx.beginPath()
			ctx.moveTo(((-r) * 0.3), top)
			ctx.lineTo((r * 0.3), top)
			ctx.lineTo((r * 0.34), (top + h))
			ctx.quadraticCurveTo((r * 0.17), (top + (h * 1.07)), (r * 0.03), (top + h))
			ctx.lineTo(0, (top + (h * 0.62)))
			ctx.lineTo(((-r) * 0.03), (top + h))
			ctx.quadraticCurveTo(((-r) * 0.17), (top + (h * 1.07)), ((-r) * 0.34), (top + h))
			ctx.closePath()
			ctx.fill()
			ctx.strokeStyle = M_heroFigure.rgba(M_heroFigure.tint(shorts, -0.55), 0.4)
			ctx.lineWidth = Math.max(0.6, (r * 0.025))
			ctx.lineCap = "round"
			ctx.beginPath()
			ctx.moveTo(((-r) * 0.13), (top + (h * 0.25)))
			ctx.quadraticCurveTo(((-r) * 0.1), (top + (h * 0.6)), ((-r) * 0.13), (top + (h * 0.95)))
			ctx.stroke()
			ctx.strokeStyle = sock
			ctx.lineWidth = Math.max(0.7, (r * 0.035))
			ctx.beginPath()
			ctx.moveTo(((-r) * 0.3), (top + (h * 0.1)))
			ctx.lineTo(((-r) * 0.33), (top + (h * 0.92)))
			ctx.stroke()
		end
		local shY = ((A_.SHOULDER_Y * r) + sink)
		local waistY = (((A_.HIP_Y - 0.04) * r) + sink)
		local shW = (r * 0.42)
		local waistW = (r * 0.29)
		local armFromY = (shY + (r * 0.02))
		local armLen = (r * (0.42 + (spread * 0.5)))
		local outX = ((r * 0.3) + (armLen * (0.35 + (spread * 0.65))))
		local handY = (armFromY + ((armLen * (0.62 - (lift * 0.85))) * (1 - (spread * 0.45))))
		local handYFor = function(s)
			return (handY - (((s * swing) * r) * 0.22))
		end
		local lead = ((function() local _v = pose; if _v == nil then return nil end; _v = _v.armLead; return _v end)() or 0)
		local handXFor = function(s)
			return ((s * outX) * (if ((lead == 0) or (Math.sign(s) == Math.sign(lead))) then 1 else 0.62))
		end
		local tDrop = ((function() local _v = pose; if _v == nil then return nil end; _v = _v.trailDrop; return _v end)() or 0)
		local hIn = ((function() local _v = pose; if _v == nil then return nil end; _v = _v.handsIn; return _v end)() or 0)
		local arm = function(s)
			local sh = Js.alit(((s * shW) * 0.82), armFromY)
			local hand = (if ((tDrop > 0) or (hIn > 0)) then shapeHand(r, s, handXFor(s), handYFor(s), armFromY, lead, tDrop, hIn) else Js.alit(handXFor(s), handYFor(s)))
			local elbow = Js.alit((((sh[1] + hand[1]) / 2) + ((s * r) * 0.035)), ((sh[2] + hand[2]) / 2))
			do return Js.O({ sh = sh, elbow = elbow, hand = hand }, { "sh", "elbow", "hand" }) end
		end
		local arms = Js.alit(arm(-1), arm(1))
		do
			local _arr7 = arms
			local _i8 = 0
			while _i8 < Js.alen(_arr7) do
				_i8 += 1
				local _e9 = _arr7[_i8]
				local sh = _e9.sh
				local elbow = _e9.elbow
				local hand = _e9.hand
				M_heroFigure.limb(ctx, M_heroFigure.along(sh, elbow, 0.3), elbow, (r * 0.13), (r * 0.115), skin)
				M_heroFigure.limb(ctx, elbow, hand, (r * 0.115), (r * 0.09), skin)
				if (not (function() local _v = pose; if _v == nil then return nil end; _v = _v.gloves; return _v end)()) then
					ctx.fillStyle = M_heroFigure.tint(skin, -0.12)
					ctx.beginPath()
					ctx.arc(hand[1], hand[2], (r * 0.065), 0, (Math.PI * 2))
					ctx.fill()
				end
			end
		end
		local torso = function()
			ctx.beginPath()
			ctx.moveTo((-waistW), waistY)
			ctx.lineTo((-shW), (shY + (r * 0.1)))
			ctx.quadraticCurveTo((-shW), (shY - (r * 0.04)), ((-shW) * 0.6), (shY - (r * 0.07)))
			ctx.lineTo((shW * 0.6), (shY - (r * 0.07)))
			ctx.quadraticCurveTo(shW, (shY - (r * 0.04)), shW, (shY + (r * 0.1)))
			ctx.lineTo(waistW, waistY)
			ctx.closePath()
		end
		do
			local g = ctx.createLinearGradient((-shW), shY, shW, waistY)
			g.addColorStop(0, M_heroFigure.tint(shirt, 0.32))
			g.addColorStop(0.45, shirt)
			g.addColorStop(1, M_heroFigure.tint(shirt, -0.4))
			ctx.fillStyle = g
			torso()
			ctx.fill()
			ctx.save()
			torso()
			ctx.clip()
			local v = ctx.createLinearGradient(0, shY, 0, waistY)
			v.addColorStop(0, "rgba(255,255,255,0.10)")
			v.addColorStop(0.5, "rgba(0,0,0,0)")
			v.addColorStop(1, "rgba(0,0,0,0.24)")
			ctx.fillStyle = v
			ctx.fillRect((-shW), (shY - (r * 0.1)), (shW * 2), ((waistY - shY) + (r * 0.2)))
			ctx.strokeStyle = M_heroFigure.rgba(M_heroFigure.tint(shirt, -0.55), 0.42)
			ctx.lineCap = "round"
			ctx.lineWidth = Math.max(0.6, (r * 0.028))
			ctx.beginPath()
			ctx.moveTo(((-r) * 0.2), (shY + (r * 0.2)))
			ctx.quadraticCurveTo(((-r) * 0.1), (shY + (r * 0.42)), ((-r) * 0.17), (waistY - (r * 0.02)))
			ctx.stroke()
			ctx.beginPath()
			ctx.moveTo((r * 0.22), (shY + (r * 0.24)))
			ctx.quadraticCurveTo((r * 0.12), (shY + (r * 0.44)), (r * 0.19), (waistY - (r * 0.02)))
			ctx.stroke()
			ctx.strokeStyle = "rgba(255,255,255,0.34)"
			ctx.lineWidth = Math.max(0.8, (r * 0.04))
			ctx.beginPath()
			ctx.moveTo(((-shW) * 0.95), (shY + (r * 0.08)))
			ctx.quadraticCurveTo(((-shW) * 0.85), (shY - (r * 0.04)), ((-shW) * 0.35), (shY - (r * 0.05)))
			ctx.stroke()
			ctx.strokeStyle = FIG3D.rim
			ctx.lineWidth = Math.max(0.8, (r * 0.05))
			ctx.beginPath()
			ctx.moveTo((shW * 0.98), (shY + (r * 0.1)))
			ctx.lineTo((waistW * 0.98), waistY)
			ctx.stroke()
			ctx.restore()
			ctx.strokeStyle = "rgba(0,0,0,0.35)"
			ctx.lineWidth = Math.max(0.6, (r * 0.03))
			ctx.lineJoin = "round"
			torso()
			ctx.stroke()
		end
		A.forEach(arms, function(_p10, i)
			local sh = _p10.sh
			local elbow = _p10.elbow
			M_heroFigure.sleeve(ctx, sh, elbow, (r * 0.19), (r * 0.155), (if (i == 0) then shirt else M_heroFigure.tint(shirt, -0.2)), trim, u)
		end)
		if (function() local _v = pose; if _v == nil then return nil end; _v = _v.gloves; return _v end)() then
			do
				local _arr11 = arms
				local _i12 = 0
				while _i12 < Js.alen(_arr11) do
					_i12 += 1
					local _e13 = _arr11[_i12]
					local hand = _e13.hand
					local gg = ctx.createRadialGradient((hand[1] - (r * 0.05)), (hand[2] - (r * 0.05)), (r * 0.02), hand[1], hand[2], (r * 0.15))
					gg.addColorStop(0, "#ffffff")
					gg.addColorStop(1, "#b8c2d0")
					ctx.fillStyle = gg
					ctx.strokeStyle = trim
					ctx.lineWidth = Math.max(0.8, (r * 0.04))
					ctx.beginPath()
					ctx.arc(hand[1], hand[2], (r * 0.14), 0, (Math.PI * 2))
					ctx.fill()
					ctx.stroke()
				end
			end
		end
		local neckY = ((A_.NECK_Y * r) + sink)
		ctx.strokeStyle = trim
		ctx.lineWidth = Math.max(0.8, (r * 0.05))
		ctx.lineCap = "round"
		ctx.beginPath()
		ctx.moveTo(((-r) * 0.15), (neckY + (r * 0.035)))
		ctx.quadraticCurveTo(0, (neckY + (r * 0.1)), (r * 0.15), (neckY + (r * 0.035)))
		ctx.stroke()
		if (mode == "fit") then
			local chinY = (neckY - (FIG3D.chinAboveNeck * r))
			M_heroFigure.limb(ctx, Js.alit(0, chinY), Js.alit(0, (neckY + (r * 0.06))), (r * 0.14), (r * 0.16), M_heroFigure.tint(skin, -0.22))
		elseif (mode == "drawn") then
			M_heroFigure.limb(ctx, Js.alit(0, (neckY - (r * 0.02))), Js.alit(0, (neckY + (r * 0.06))), (r * 0.14), (r * 0.16), M_heroFigure.tint(skin, -0.22))
			drawStyledHead(ctx, 0, (neckY - (FIG3D.chinAboveNeck * r)), (FIG3D.faceH * r), skin, hk)
		end
	end
	headKey = function(look)
		do return (((if look.id ~= nil then look.id else (function() local _v = look.face; if _v == nil then return nil end; _v = _v.src; return _v end)()) or look.label) or (look.shirt .. look.trim)) end
	end
	exports.headKey = headKey
	FIG3D = Js.O({ faceH = 0.27, chinAboveNeck = 0, shadowGrow = 1.25, shadowAlpha = 0.5, rim = "rgba(255,240,205,0.75)" }, { "faceH", "chinAboveNeck", "shadowGrow", "shadowAlpha", "rim" })
	exports.FIG3D = FIG3D
	shadowSprite = nil
	fits = Js.Map.new()
	queued = Js.Set.new()
	queue = Js.alit()
	pumping = false
	FIT_MAX_SIDE = 260
	HAIR_STYLES = Js.alit("short", "curly", "short", "long", "buzz", "quiff", "curly", "short")
	HAIR_COLOURS = Js.alit("#17110d", "#2b1b12", "#3d2616", "#5a3a22", "#7a4e2c", "#b88a4a", "#d7b26a", "#9c4a22", "#101010")
	SKIN_TONES = Js.alit("#f1c7a5", "#e0ac86", "#c68642", "#a8703f", "#8d5524", "#6b3e1f", "#d9a077")
	sprites = Js.Map.new()
	SPRITE_LIMIT = 320
	SPRITE_X = 1.5
	SPRITE_UP = 1.75
	SPRITE_DOWN = 0.5
end
