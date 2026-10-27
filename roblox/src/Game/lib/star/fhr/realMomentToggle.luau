--!nocheck
--!nolint
-- Generated from lib/star/fhr/realMomentToggle.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_toggle = import("lib/star/fhr/toggle")
	local M_react = import("__pkg/react")
	local REAL_MOMENTS_KEY, REAL_MOMENTS_DEFAULT, parseRealMomentsMode, urlValue, urlOverride, realMomentsEvery, cached, listeners, FORCED_KEY, forced, realMomentsMode, realMomentsOn, setRealMomentsMode, forceRealMomentsMode, onRealMomentsMode, useRealMomentsMode
	parseRealMomentsMode = function(v)
		do return (if ((v == "on") or (v == "off")) then v else nil) end
	end
	exports.parseRealMomentsMode = parseRealMomentsMode
	urlValue = function()
		local _ok1, _err2, _rv3 = pcall(function()
			if (Js.location == nil) then
				do return Js.RET, nil end
			end
			do return Js.RET, Js.URLSearchParams.new(Js.location.search).get("realmoments") end
		end)
		if not _ok1 then
			do return nil end
		elseif _err2 == Js.RET then
			return _rv3
		end
	end
	urlOverride = function()
		local v = urlValue()
		do return (if (v == "every") then "on" else parseRealMomentsMode(v)) end
	end
	realMomentsMode = function()
		local f = forced()
		if Js.T(f) then
			do return f end
		end
		local u = urlOverride()
		if Js.T(u) then
			do return u end
		end
		if (cached == nil) then
			local v = nil
			local _ok4, _err5, _rv6 = pcall(function()
				v = (if (Js.localStorage == nil) then nil else Js.localStorage.getItem(REAL_MOMENTS_KEY))
			end)
			if not _ok4 then
				v = nil
			elseif _err5 == Js.RET then
				return _rv6
			end
			cached = (parseRealMomentsMode(v) or REAL_MOMENTS_DEFAULT)
		end
		do return cached end
	end
	exports.realMomentsMode = realMomentsMode
	setRealMomentsMode = function(v)
		local _ok7, _err8, _rv9 = pcall(function()
			Js.localStorage.setItem(REAL_MOMENTS_KEY, v)
		end)
		if not _ok7 then
		elseif _err8 == Js.RET then
			return _rv9
		end
		cached = v
		listeners:forEach(function(f)
			return f()
		end)
	end
	exports.setRealMomentsMode = setRealMomentsMode
	forceRealMomentsMode = function(v)
		Js.globalThis[FORCED_KEY] = v
		listeners:forEach(function(f)
			return f()
		end)
	end
	exports.forceRealMomentsMode = forceRealMomentsMode
	REAL_MOMENTS_KEY = "star-real-moment-highlights"
	exports.REAL_MOMENTS_KEY = REAL_MOMENTS_KEY
	REAL_MOMENTS_DEFAULT = "off"
	exports.REAL_MOMENTS_DEFAULT = REAL_MOMENTS_DEFAULT
	realMomentsEvery = function()
		return (urlValue() == "every")
	end
	exports.realMomentsEvery = realMomentsEvery
	cached = nil
	listeners = Js.Set.new()
	FORCED_KEY = "__starRealMomentsForced"
	forced = function()
		return (if Js.globalThis[FORCED_KEY] ~= nil then Js.globalThis[FORCED_KEY] else nil)
	end
	realMomentsOn = function()
		return (M_toggle.fhrOn() and (realMomentsMode() == "on"))
	end
	exports.realMomentsOn = realMomentsOn
	if (Js.window ~= nil) then
		Js.window.addEventListener("storage", function(e)
			if (e.key == REAL_MOMENTS_KEY) then
				cached = nil
				listeners:forEach(function(f)
					return f()
				end)
			end
		end)
	end
	M_toggle.onFhrMode(function()
		return listeners:forEach(function(f)
			return f()
		end)
	end)
	onRealMomentsMode = function(f)
		listeners:add(f)
		do return function()
			listeners:delete(f)
		end end
	end
	exports.onRealMomentsMode = onRealMomentsMode
	useRealMomentsMode = function()
		return M_react.useSyncExternalStore(onRealMomentsMode, realMomentsMode, function()
			return REAL_MOMENTS_DEFAULT
		end)
	end
	exports.useRealMomentsMode = useRealMomentsMode
end
