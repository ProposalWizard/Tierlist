--!nocheck
--!nolint
-- Generated from lib/star/cameraTilt.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_react = import("__pkg/react")
	local CAMERA_TILTS, CAMERA_TILT_DEFAULT, CAMERA_TILT_KEY, TILT_DISTANCE_H, stored, listeners, readStored, cameraTilt, setCameraTilt, subscribe, useCameraTilt, tiltFor, tiltCss, canvasToScreen, screenToCanvas, visibleOnScreen
	readStored = function()
		local _ok1, _err2, _rv3 = pcall(function()
			if (Js.localStorage == nil) then
				do return Js.RET, CAMERA_TILT_DEFAULT end
			end
			local v = Js.Number(Js.localStorage.getItem(CAMERA_TILT_KEY))
			do return Js.RET, (if ((Js.localStorage.getItem(CAMERA_TILT_KEY) ~= nil) and (((v == 0) or (v == 20)) or (v == 30))) then v else CAMERA_TILT_DEFAULT) end
		end)
		if not _ok1 then
			do return CAMERA_TILT_DEFAULT end
		elseif _err2 == Js.RET then
			return _rv3
		end
	end
	cameraTilt = function()
		do return 20 end
	end
	exports.cameraTilt = cameraTilt
	setCameraTilt = function(v)
		local _ok4, _err5, _rv6 = pcall(function()
			Js.localStorage.setItem(CAMERA_TILT_KEY, Js.numstr(v))
		end)
		if not _ok4 then
		elseif _err5 == Js.RET then
			return _rv6
		end
		stored = v
		listeners:forEach(function(f)
			return f()
		end)
	end
	exports.setCameraTilt = setCameraTilt
	subscribe = function(f)
		listeners:add(f)
		do return function()
			listeners:delete(f)
		end end
	end
	useCameraTilt = function()
		do return M_react.useSyncExternalStore(subscribe, cameraTilt, function()
			return CAMERA_TILT_DEFAULT
		end) end
	end
	exports.useCameraTilt = useCameraTilt
	tiltFor = function(deg, W, H)
		if (((not (deg > 0)) or (not (W > 0))) or (not (H > 0))) then
			do return nil end
		end
		local th = ((deg * Math.PI) / 180)
		local sin = Math.sin(th)
		local cos = Math.cos(th)
		local d = (TILT_DISTANCE_H * H)
		local m = (((H / 2) * sin) / d)
		local s = Math.max(1, (1 / (cos - m)), (1 / (1 - m)))
		do return Js.O({ deg = deg, W = W, H = H, d = d, s = s, sin = sin, cos = cos }, { "deg", "W", "H", "d", "s", "sin", "cos" }) end
	end
	exports.tiltFor = tiltFor
	tiltCss = function(t)
		do return (if t then ("perspective(" .. N.toFixed(t.d, 1) .. "px) rotateX(" .. Js.numstr(t.deg) .. "deg) scale(" .. N.toFixed(t.s, 4) .. ")") else "") end
	end
	exports.tiltCss = tiltCss
	canvasToScreen = function(t, sx, sy, W, H)
		if (not t) then
			do return Js.O({ X = (sx * W), Y = (sy * H) }, { "X", "Y" }) end
		end
		local x = ((sx - 0.5) * t.W)
		local y = ((sy - 0.5) * t.H)
		local w = (1 - (((t.s * y) * t.sin) / t.d))
		do return Js.O({ X = ((t.W / 2) + ((t.s * x) / w)), Y = ((t.H / 2) + (((t.s * y) * t.cos) / w)) }, { "X", "Y" }) end
	end
	exports.canvasToScreen = canvasToScreen
	screenToCanvas = function(t, X, Y, W, H)
		if (not t) then
			do return Js.O({ sx = (X / W), sy = (Y / H) }, { "sx", "sy" }) end
		end
		local Xc = (X - (t.W / 2))
		local Yc = (Y - (t.H / 2))
		local y = (Yc / (t.s * (t.cos + ((Yc * t.sin) / t.d))))
		local w = (1 - (((t.s * y) * t.sin) / t.d))
		local x = ((Xc * w) / t.s)
		do return Js.O({ sx = ((x / t.W) + 0.5), sy = ((y / t.H) + 0.5) }, { "sx", "sy" }) end
	end
	exports.screenToCanvas = screenToCanvas
	visibleOnScreen = function(t, sx, sy, marginPx)
		if marginPx == nil then marginPx = 0 end
		if (not t) then
			do return ((((sx >= 0) and (sx <= 1)) and (sy >= 0)) and (sy <= 1)) end
		end
		local p = canvasToScreen(t, sx, sy, t.W, t.H)
		do return ((((p.X >= marginPx) and (p.X <= (t.W - marginPx))) and (p.Y >= marginPx)) and (p.Y <= (t.H - marginPx))) end
	end
	exports.visibleOnScreen = visibleOnScreen
	CAMERA_TILTS = Js.alit(20, 30, 0)
	exports.CAMERA_TILTS = CAMERA_TILTS
	CAMERA_TILT_DEFAULT = 20
	exports.CAMERA_TILT_DEFAULT = CAMERA_TILT_DEFAULT
	CAMERA_TILT_KEY = "star-camera-tilt"
	exports.CAMERA_TILT_KEY = CAMERA_TILT_KEY
	TILT_DISTANCE_H = 1.4
	exports.TILT_DISTANCE_H = TILT_DISTANCE_H
	stored = nil
	listeners = Js.Set.new()
	if (Js.window ~= nil) then
		Js.window.addEventListener("storage", function(e)
			if (e.key == CAMERA_TILT_KEY) then
				stored = nil
				listeners:forEach(function(f)
					return f()
				end)
			end
		end)
	end
end
