--!nocheck
--!nolint
-- Generated from lib/star/portrait.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local PORTRAIT_SIZE, PORTRAIT_QUALITY, MAX_PORTRAIT_BYTES, coverScale, clampOffset, sourceRect, initialView, encodePortrait, portraitBytes
	coverScale = function(iw, ih, viewport)
		if ((iw <= 0) or (ih <= 0)) then
			do return 1 end
		end
		do return Math.max((viewport / iw), (viewport / ih)) end
	end
	exports.coverScale = coverScale
	clampOffset = function(v, iw, ih, viewport)
		local zoom = Math.max(0.01, v.zoom)
		local s = (coverScale(iw, ih, viewport) * zoom)
		local w = (iw * s)
		local h = (ih * s)
		do return Js.O({ zoom = zoom, x = (if (w <= viewport) then ((viewport - w) / 2) else Math.min(0, Math.max((viewport - w), v.x))), y = (if (h <= viewport) then ((viewport - h) / 2) else Math.min(0, Math.max((viewport - h), v.y))) }, { "zoom", "x", "y" }) end
	end
	exports.clampOffset = clampOffset
	sourceRect = function(v, iw, ih, viewport)
		local c = clampOffset(v, iw, ih, viewport)
		local s = (coverScale(iw, ih, viewport) * c.zoom)
		do return Js.O({ sx = ((-c.x) / s), sy = ((-c.y) / s), sw = (viewport / s), sh = (viewport / s) }, { "sx", "sy", "sw", "sh" }) end
	end
	exports.sourceRect = sourceRect
	initialView = function(iw, ih, viewport)
		local s = coverScale(iw, ih, viewport)
		do return Js.O({ zoom = 1, x = ((viewport - (iw * s)) / 2), y = ((viewport - (ih * s)) / 2) }, { "zoom", "x", "y" }) end
	end
	exports.initialView = initialView
	encodePortrait = function(source, rect, size)
		if size == nil then size = PORTRAIT_SIZE end
		if (Js.document == nil) then
			do return nil end
		end
		local canvas = Js.document.createElement("canvas")
		canvas.width = size
		canvas.height = size
		local ctx = canvas.getContext("2d")
		if (not ctx) then
			do return nil end
		end
		ctx.imageSmoothingQuality = "high"
		ctx.drawImage(source, rect.sx, rect.sy, rect.sw, rect.sh, 0, 0, size, size)
		local webp = canvas.toDataURL("image/webp", PORTRAIT_QUALITY)
		local out = (if S.startsWith(webp, "data:image/webp") then webp else canvas.toDataURL("image/jpeg", PORTRAIT_QUALITY))
		do return (if (S.len(out) > MAX_PORTRAIT_BYTES) then canvas.toDataURL("image/jpeg", 0.6) else out) end
	end
	exports.encodePortrait = encodePortrait
	portraitBytes = function(dataUri)
		local comma = S.indexOf(dataUri, ",")
		if (comma < 0) then
			do return S.len(dataUri) end
		end
		do return Math.round((((S.len(dataUri) - comma) - 1) * 0.75)) end
	end
	exports.portraitBytes = portraitBytes
	PORTRAIT_SIZE = 256
	exports.PORTRAIT_SIZE = PORTRAIT_SIZE
	PORTRAIT_QUALITY = 0.8
	exports.PORTRAIT_QUALITY = PORTRAIT_QUALITY
	MAX_PORTRAIT_BYTES = 120000
	exports.MAX_PORTRAIT_BYTES = MAX_PORTRAIT_BYTES
end
