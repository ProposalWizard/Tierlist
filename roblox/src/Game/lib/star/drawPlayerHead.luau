--!nocheck
--!nolint
-- Generated from lib/star/drawPlayerHead.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_fakeFaces = import("lib/star/fakeFaces")
	local M_faceStyle = import("lib/star/faceStyle")
	local M_fakeFaceStyle = import("lib/star/fakeFaceStyle")
	local M_portrait = import("lib/star/portrait")
	local isFakeFaceImage, fakeCheck, drawPlayerHead, silhouetteCache, silhouetteFor, headSprites, headOrder, HEAD_SPRITE_LIMIT, headSpriteFor, RING_POINTS, stampOutline
	isFakeFaceImage = function(face)
		local known = fakeCheck:get(face)
		if (known and (known.src == face.src)) then
			do return known.fake end
		end
		local fake = false
		local _ok1, _err2, _rv3 = pcall(function()
			local path = Js.decodeURIComponent(Js.URL.new(face.src).pathname)
			fake = A.includes(M_fakeFaces.FAKE_FACES, path)
		end)
		if not _ok1 then
			fake = false
		elseif _err2 == Js.RET then
			return _rv3
		end
		fakeCheck:set(face, Js.O({ src = face.src, fake = fake }, { "src", "fake" }))
		do return fake end
	end
	exports.isFakeFaceImage = isFakeFaceImage
	drawPlayerHead = function(ctx, cx0, cy0, headBaseR, figureR, face, style, fakeStyle)
		if style == nil then style = M_faceStyle.DEFAULT_FACE_STYLE end
		if fakeStyle == nil then fakeStyle = M_fakeFaceStyle.DEFAULT_FAKE_FACE_STYLE end
		local usingFake = ((not (not face)) and isFakeFaceImage(face))
		local effective = (if usingFake then Js.ospread(style, Js.O({ scale = fakeStyle.scale, offsetX = fakeStyle.offsetX, offsetY = fakeStyle.offsetY, crop = fakeStyle.crop }, { "scale", "offsetX", "offsetY", "crop" })) else style)
		local r = (headBaseR * effective.scale)
		local cx = (cx0 + (effective.offsetX * headBaseR))
		local cy = (cy0 + (effective.offsetY * headBaseR))
		local hasPhoto = (((effective.facesEnabled and (not (not face))) and face.complete) and (face.naturalWidth > 0))
		if (effective.showBacking or (not hasPhoto)) then
			ctx.beginPath()
			ctx.arc(cx, cy, r, 0, (Math.PI * 2))
			ctx.fillStyle = effective.backingColor
			ctx.fill()
		end
		local rect = (if hasPhoto then M_portrait.sourceRect(effective.crop, face.naturalWidth, face.naturalHeight, M_faceStyle.CROP_VIEWPORT) else nil)
		if ((hasPhoto and rect) and (Js.document ~= nil)) then
			local pad = (if effective.outlineEnabled then Math.max(1, ((figureR * 0.1) * effective.outlineWidth)) else 0)
			local outer = (r + pad)
			local t = ctx.getTransform()
			local k = (function() local _l = Math.hypot(t.a, t.b); if Js.T(_l) then return _l end; return 1 end)()
			local devSize = ((outer * 2) * k)
			if (devSize <= 400) then
				local px = Math.max(4, (Math.round((devSize / 2)) * 2))
				local key = A.join(Js.alit(N.toFixed(rect.sx, 1), N.toFixed(rect.sy, 1), N.toFixed(rect.sw, 1), N.toFixed(rect.sh, 1), (if effective.outlineEnabled then effective.outlineColor else "-"), N.toFixed((pad / r), 3), px), "|")
				local sprite = headSpriteFor(face, key, px, function(g, scale)
					g.setTransform(scale, 0, 0, scale, (px / 2), (px / 2))
					g.imageSmoothingQuality = "high"
					if effective.outlineEnabled then
						stampOutline(g, face, rect, (-r), (-r), (r * 2), pad, effective.outlineColor)
					end
					g.drawImage(face, rect.sx, rect.sy, rect.sw, rect.sh, (-r), (-r), (r * 2), (r * 2))
				end, outer)
				if sprite then
					ctx.drawImage(sprite, (cx - outer), (cy - outer), (outer * 2), (outer * 2))
					do return end
				end
			end
		end
		if ((effective.outlineEnabled and hasPhoto) and rect) then
			local dilate = Math.max(1, ((figureR * 0.1) * effective.outlineWidth))
			stampOutline(ctx, face, rect, (cx - r), (cy - r), (r * 2), dilate, effective.outlineColor)
		end
		if (hasPhoto and rect) then
			ctx.drawImage(face, rect.sx, rect.sy, rect.sw, rect.sh, (cx - r), (cy - r), (r * 2), (r * 2))
		end
		if (effective.outlineEnabled and (not (hasPhoto and rect))) then
			ctx.beginPath()
			ctx.arc(cx, cy, r, 0, (Math.PI * 2))
			ctx.lineWidth = Math.max(1, ((figureR * 0.1) * effective.outlineWidth))
			ctx.strokeStyle = effective.outlineColor
			ctx.stroke()
		end
	end
	exports.drawPlayerHead = drawPlayerHead
	silhouetteFor = function(face, color)
		local byColor = silhouetteCache:get(face)
		if (not byColor) then
			byColor = Js.Map.new()
			silhouetteCache:set(face, byColor)
		end
		local cached = byColor:get(color)
		if cached then
			do return cached end
		end
		local canvas = Js.document.createElement("canvas")
		canvas.width = face.naturalWidth
		canvas.height = face.naturalHeight
		local sctx = canvas.getContext("2d")
		if (not sctx) then
			do return nil end
		end
		sctx.drawImage(face, 0, 0)
		sctx.globalCompositeOperation = "source-in"
		sctx.fillStyle = color
		sctx.fillRect(0, 0, canvas.width, canvas.height)
		byColor:set(color, canvas)
		do return canvas end
	end
	headSpriteFor = function(face, key, px, paint, outer)
		local byKey = headSprites:get(face)
		if (not byKey) then
			byKey = Js.Map.new()
			headSprites:set(face, byKey)
		end
		local hit = byKey:get(key)
		if hit then
			do return hit end
		end
		local c = Js.document.createElement("canvas")
		c.width = px
		c.height = px
		local g = c.getContext("2d")
		if (not g) then
			do return nil end
		end
		paint(g, (px / (outer * 2)))
		byKey:set(key, c)
		A.push(headOrder, Js.O({ face = face, key = key }, { "face", "key" }))
		if (Js.alen(headOrder) > HEAD_SPRITE_LIMIT) then
			local old = A.shift(headOrder);
			(function() local _r = headSprites:get(old.face); if _r == nil then return nil end; return _r:delete(old.key) end)()
		end
		do return c end
	end
	stampOutline = function(ctx, face, rect, dx, dy, size, dilate, color)
		local silhouette = silhouetteFor(face, color)
		if (not silhouette) then
			do return end
		end
		for i = 0, RING_POINTS - 1 do
			local angle = (((i / RING_POINTS) * Math.PI) * 2)
			local ox = (Math.cos(angle) * dilate)
			local oy = (Math.sin(angle) * dilate)
			ctx.drawImage(silhouette, rect.sx, rect.sy, rect.sw, rect.sh, (dx + ox), (dy + oy), size, size)
		end
	end
	fakeCheck = Js.Map.new()
	silhouetteCache = Js.Map.new()
	headSprites = Js.Map.new()
	headOrder = Js.alit()
	HEAD_SPRITE_LIMIT = 600
	RING_POINTS = 12
end
