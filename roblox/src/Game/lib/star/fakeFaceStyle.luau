--!nocheck
--!nolint
-- Generated from lib/star/fakeFaceStyle.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_faceStyle = import("lib/star/faceStyle")
	local DEFAULT_FAKE_FACE_STYLE, KEY, numberOr, clamp, sanitizeFakeFaceStyle, loadFakeFaceStyle, saveFakeFaceStyle
	numberOr = function(n, fallback)
		do return (if ((type(n) == "number") and Js.NumberNS.isFinite(n)) then n else fallback) end
	end
	clamp = function(n, min, max)
		do return Math.min(max, Math.max(min, n)) end
	end
	sanitizeFakeFaceStyle = function(partial)
		local s = Js.ospread(DEFAULT_FAKE_FACE_STYLE, partial)
		do return Js.O({ scale = clamp(Js.unpack(Js.aspread(Js.alit(numberOr(s.scale, DEFAULT_FAKE_FACE_STYLE.scale)), M_faceStyle.FACE_SCALE_RANGE))), offsetX = clamp(Js.unpack(Js.aspread(Js.alit(numberOr(s.offsetX, 0)), M_faceStyle.FACE_OFFSET_RANGE))), offsetY = clamp(Js.unpack(Js.aspread(Js.alit(numberOr(s.offsetY, 0)), M_faceStyle.FACE_OFFSET_RANGE))), crop = Js.O({ zoom = clamp(Js.unpack(Js.aspread(Js.alit(numberOr((function() local _v = s.crop; if _v == nil then return nil end; _v = _v.zoom; return _v end)(), 1)), M_faceStyle.CROP_ZOOM_RANGE))), x = clamp(numberOr((function() local _v = s.crop; if _v == nil then return nil end; _v = _v.x; return _v end)(), 0), -4000, 4000), y = clamp(numberOr((function() local _v = s.crop; if _v == nil then return nil end; _v = _v.y; return _v end)(), 0), -4000, 4000) }, { "zoom", "x", "y" }) }, { "scale", "offsetX", "offsetY", "crop" }) end
	end
	exports.sanitizeFakeFaceStyle = sanitizeFakeFaceStyle
	loadFakeFaceStyle = function()
		local _ok1, _err2, _rv3 = pcall(function()
			local raw = Js.localStorage.getItem(KEY)
			if Js.T(raw) then
				do return Js.RET, sanitizeFakeFaceStyle(Js.JSON.parse(raw)) end
			end
		end)
		if not _ok1 then
		elseif _err2 == Js.RET then
			return _rv3
		end
		do return DEFAULT_FAKE_FACE_STYLE end
	end
	exports.loadFakeFaceStyle = loadFakeFaceStyle
	saveFakeFaceStyle = function(style)
		local _ok4, _err5, _rv6 = pcall(function()
			Js.localStorage.setItem(KEY, Js.JSON.stringify(sanitizeFakeFaceStyle(style)))
		end)
		if not _ok4 then
		elseif _err5 == Js.RET then
			return _rv6
		end
	end
	exports.saveFakeFaceStyle = saveFakeFaceStyle
	local _ = "use client"
	DEFAULT_FAKE_FACE_STYLE = Js.O({ scale = 2, offsetX = -0.06, offsetY = -1.19, crop = Js.O({ zoom = 0.75, x = 32, y = 1.1 }, { "zoom", "x", "y" }) }, { "scale", "offsetX", "offsetY", "crop" })
	exports.DEFAULT_FAKE_FACE_STYLE = DEFAULT_FAKE_FACE_STYLE
	KEY = "star-fake-face-style"
end
