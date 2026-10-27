--!nocheck
--!nolint
-- Generated from lib/star/faceStyle.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local HEAD_SKIN, CROP_VIEWPORT, PHOTO_FACES, DEFAULT_FACE_STYLE, KEY, LEGACY_SCALE_KEY, FACE_SCALE_RANGE, FACE_OFFSET_RANGE, CROP_ZOOM_RANGE, sanitize, numberOr, clamp, loadFaceStyle, saveFaceStyle
	sanitize = function(partial)
		local s = Js.ospread(DEFAULT_FACE_STYLE, partial)
		do return Js.O({ scale = clamp(Js.unpack(Js.aspread(Js.alit(numberOr(s.scale, DEFAULT_FACE_STYLE.scale)), FACE_SCALE_RANGE))), offsetX = clamp(Js.unpack(Js.aspread(Js.alit(numberOr(s.offsetX, 0)), FACE_OFFSET_RANGE))), offsetY = clamp(Js.unpack(Js.aspread(Js.alit(numberOr(s.offsetY, 0)), FACE_OFFSET_RANGE))), showBacking = (not (not s.showBacking)), backingColor = (if ((type(s.backingColor) == "string") and Js.T(s.backingColor)) then s.backingColor else HEAD_SKIN), outlineEnabled = (not (not s.outlineEnabled)), outlineColor = (if ((type(s.outlineColor) == "string") and Js.T(s.outlineColor)) then s.outlineColor else DEFAULT_FACE_STYLE.outlineColor), outlineWidth = clamp(numberOr(s.outlineWidth, 1), 0, 4), crop = Js.O({ zoom = clamp(Js.unpack(Js.aspread(Js.alit(numberOr((function() local _v = s.crop; if _v == nil then return nil end; _v = _v.zoom; return _v end)(), 1)), CROP_ZOOM_RANGE))), x = clamp(numberOr((function() local _v = s.crop; if _v == nil then return nil end; _v = _v.x; return _v end)(), 0), -4000, 4000), y = clamp(numberOr((function() local _v = s.crop; if _v == nil then return nil end; _v = _v.y; return _v end)(), 0), -4000, 4000) }, { "zoom", "x", "y" }), facesEnabled = (PHOTO_FACES and (not (not s.facesEnabled))), namesEnabled = (not (not s.namesEnabled)) }, { "scale", "offsetX", "offsetY", "showBacking", "backingColor", "outlineEnabled", "outlineColor", "outlineWidth", "crop", "facesEnabled", "namesEnabled" }) end
	end
	exports.sanitize = sanitize
	numberOr = function(n, fallback)
		do return (if ((type(n) == "number") and Js.NumberNS.isFinite(n)) then n else fallback) end
	end
	clamp = function(n, min, max)
		do return Math.min(max, Math.max(min, n)) end
	end
	loadFaceStyle = function()
		local _ok1, _err2, _rv3 = pcall(function()
			local raw = Js.localStorage.getItem(KEY)
			if Js.T(raw) then
				do return Js.RET, sanitize(Js.JSON.parse(raw)) end
			end
			local legacyScale = Js.Number(Js.localStorage.getItem(LEGACY_SCALE_KEY))
			if (Js.NumberNS.isFinite(legacyScale) and (legacyScale > 0)) then
				do return Js.RET, sanitize(Js.O({ scale = legacyScale }, { "scale" })) end
			end
		end)
		if not _ok1 then
		elseif _err2 == Js.RET then
			return _rv3
		end
		do return DEFAULT_FACE_STYLE end
	end
	exports.loadFaceStyle = loadFaceStyle
	saveFaceStyle = function(style)
		local _ok4, _err5, _rv6 = pcall(function()
			Js.localStorage.setItem(KEY, Js.JSON.stringify(sanitize(style)))
		end)
		if not _ok4 then
		elseif _err5 == Js.RET then
			return _rv6
		end
	end
	exports.saveFaceStyle = saveFaceStyle
	local _ = "use client"
	HEAD_SKIN = "#c68642"
	exports.HEAD_SKIN = HEAD_SKIN
	CROP_VIEWPORT = 256
	exports.CROP_VIEWPORT = CROP_VIEWPORT
	PHOTO_FACES = false
	exports.PHOTO_FACES = PHOTO_FACES
	DEFAULT_FACE_STYLE = Js.O({ scale = 2.2, offsetX = 0, offsetY = -1.45, showBacking = false, backingColor = HEAD_SKIN, outlineEnabled = true, outlineColor = "#ffffff", outlineWidth = 0.5, crop = Js.O({ zoom = 1.3, x = -38, y = -38 }, { "zoom", "x", "y" }), facesEnabled = PHOTO_FACES, namesEnabled = false }, { "scale", "offsetX", "offsetY", "showBacking", "backingColor", "outlineEnabled", "outlineColor", "outlineWidth", "crop", "facesEnabled", "namesEnabled" })
	exports.DEFAULT_FACE_STYLE = DEFAULT_FACE_STYLE
	KEY = "star-face-style"
	LEGACY_SCALE_KEY = "star-face-scale"
	FACE_SCALE_RANGE = Js.alit(0.5, 5)
	exports.FACE_SCALE_RANGE = FACE_SCALE_RANGE
	FACE_OFFSET_RANGE = Js.alit(-3, 3)
	exports.FACE_OFFSET_RANGE = FACE_OFFSET_RANGE
	CROP_ZOOM_RANGE = Js.alit(0.5, 4)
	exports.CROP_ZOOM_RANGE = CROP_ZOOM_RANGE
end
