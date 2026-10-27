--!nocheck
--!nolint
-- Generated from lib/star/afterPass.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_react = import("__pkg/react")
	local AFTER_PASS_KEY, AFTER_PASS_DEFAULT, VALUES, AFTER_PASS_NAMES, parseAfterPassMode, urlOverride, cached, listeners, FORCED_KEY, forcedMode, afterPassMode, afterPassStickOn, setAfterPassMode, forceAfterPassMode, onAfterPassMode, useAfterPassMode
	parseAfterPassMode = function(v)
		do return (if (Js.T(v) and A.includes(VALUES, v)) then v else nil) end
	end
	exports.parseAfterPassMode = parseAfterPassMode
	urlOverride = function()
		local _ok1, _err2, _rv3 = pcall(function()
			if (Js.location == nil) then
				do return Js.RET, nil end
			end
			do return Js.RET, parseAfterPassMode(Js.URLSearchParams.new(Js.location.search).get("afterpass")) end
		end)
		if not _ok1 then
			do return nil end
		elseif _err2 == Js.RET then
			return _rv3
		end
	end
	afterPassMode = function()
		local forced = forcedMode()
		if Js.T(forced) then
			do return forced end
		end
		local u = urlOverride()
		if Js.T(u) then
			do return u end
		end
		if (cached == nil) then
			local v = nil
			local _ok4, _err5, _rv6 = pcall(function()
				v = (if (Js.localStorage == nil) then nil else Js.localStorage.getItem(AFTER_PASS_KEY))
			end)
			if not _ok4 then
				v = nil
			elseif _err5 == Js.RET then
				return _rv6
			end
			cached = (parseAfterPassMode(v) or AFTER_PASS_DEFAULT)
		end
		do return cached end
	end
	exports.afterPassMode = afterPassMode
	setAfterPassMode = function(v)
		local _ok7, _err8, _rv9 = pcall(function()
			Js.localStorage.setItem(AFTER_PASS_KEY, v)
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
	exports.setAfterPassMode = setAfterPassMode
	forceAfterPassMode = function(v)
		Js.globalThis[FORCED_KEY] = v
		listeners:forEach(function(f)
			return f()
		end)
	end
	exports.forceAfterPassMode = forceAfterPassMode
	AFTER_PASS_KEY = "star-after-pass"
	exports.AFTER_PASS_KEY = AFTER_PASS_KEY
	AFTER_PASS_DEFAULT = "auto"
	exports.AFTER_PASS_DEFAULT = AFTER_PASS_DEFAULT
	VALUES = Js.alit("auto", "stick")
	AFTER_PASS_NAMES = Js.O({ auto = "Auto run", stick = "Joystick" }, { "auto", "stick" })
	exports.AFTER_PASS_NAMES = AFTER_PASS_NAMES
	cached = nil
	listeners = Js.Set.new()
	FORCED_KEY = "__starAfterPassForced"
	forcedMode = function()
		return (if Js.globalThis[FORCED_KEY] ~= nil then Js.globalThis[FORCED_KEY] else nil)
	end
	afterPassStickOn = function()
		return (afterPassMode() == "stick")
	end
	exports.afterPassStickOn = afterPassStickOn
	if (Js.window ~= nil) then
		Js.window.addEventListener("storage", function(e)
			if (e.key == AFTER_PASS_KEY) then
				cached = nil
				listeners:forEach(function(f)
					return f()
				end)
			end
		end)
	end
	onAfterPassMode = function(f)
		listeners:add(f)
		do return function()
			listeners:delete(f)
		end end
	end
	exports.onAfterPassMode = onAfterPassMode
	useAfterPassMode = function()
		return M_react.useSyncExternalStore(onAfterPassMode, afterPassMode, function()
			return AFTER_PASS_DEFAULT
		end)
	end
	exports.useAfterPassMode = useAfterPassMode
end
