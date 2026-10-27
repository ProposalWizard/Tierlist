--!nocheck
--!nolint
-- Generated from lib/star/newChances.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_toggle = import("lib/star/fhr/toggle")
	local M_react = import("__pkg/react")
	local CHANCES_KEY, CHANCES_DEFAULT, VALUES, CHANCES_NAMES, parseChancesMode, urlOverride, cached, listeners, FORCED_KEY, forcedMode, chancesMode, newChancesOn, setChancesMode, forceChancesMode, onChancesMode, useChancesMode
	parseChancesMode = function(v)
		do return (if (Js.T(v) and A.includes(VALUES, v)) then v else nil) end
	end
	exports.parseChancesMode = parseChancesMode
	urlOverride = function()
		local _ok1, _err2, _rv3 = pcall(function()
			if (Js.location == nil) then
				do return Js.RET, nil end
			end
			do return Js.RET, parseChancesMode(Js.URLSearchParams.new(Js.location.search).get("chances")) end
		end)
		if not _ok1 then
			do return nil end
		elseif _err2 == Js.RET then
			return _rv3
		end
	end
	chancesMode = function()
		local forced = forcedMode()
		if Js.T(forced) then
			do return forced end
		end
		if M_toggle.fhrOn() then
			do return "new" end
		end
		local u = urlOverride()
		if Js.T(u) then
			do return u end
		end
		if (cached == nil) then
			local v = nil
			local _ok4, _err5, _rv6 = pcall(function()
				v = (if (Js.localStorage == nil) then nil else Js.localStorage.getItem(CHANCES_KEY))
			end)
			if not _ok4 then
				v = nil
			elseif _err5 == Js.RET then
				return _rv6
			end
			cached = (parseChancesMode(v) or CHANCES_DEFAULT)
		end
		do return cached end
	end
	exports.chancesMode = chancesMode
	setChancesMode = function(v)
		local _ok7, _err8, _rv9 = pcall(function()
			Js.localStorage.setItem(CHANCES_KEY, v)
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
	exports.setChancesMode = setChancesMode
	forceChancesMode = function(v)
		Js.globalThis[FORCED_KEY] = v
		listeners:forEach(function(f)
			return f()
		end)
	end
	exports.forceChancesMode = forceChancesMode
	CHANCES_KEY = "star-chances-mode"
	exports.CHANCES_KEY = CHANCES_KEY
	CHANCES_DEFAULT = "old"
	exports.CHANCES_DEFAULT = CHANCES_DEFAULT
	VALUES = Js.alit("old", "new")
	CHANCES_NAMES = Js.O({ old = "Old", new = "New" }, { "old", "new" })
	exports.CHANCES_NAMES = CHANCES_NAMES
	cached = nil
	listeners = Js.Set.new()
	FORCED_KEY = "__starChancesForced"
	forcedMode = function()
		return (if Js.globalThis[FORCED_KEY] ~= nil then Js.globalThis[FORCED_KEY] else nil)
	end
	newChancesOn = function()
		return (chancesMode() == "new")
	end
	exports.newChancesOn = newChancesOn
	if (Js.window ~= nil) then
		Js.window.addEventListener("storage", function(e)
			if (e.key == CHANCES_KEY) then
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
	onChancesMode = function(f)
		listeners:add(f)
		do return function()
			listeners:delete(f)
		end end
	end
	exports.onChancesMode = onChancesMode
	useChancesMode = function()
		return M_react.useSyncExternalStore(onChancesMode, chancesMode, function()
			return CHANCES_DEFAULT
		end)
	end
	exports.useChancesMode = useChancesMode
end
