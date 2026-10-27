--!nocheck
--!nolint
-- Generated from lib/star/fhr/toggle.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_react = import("__pkg/react")
	local FHR_KEY, FHR_DEFAULT, parseFhrMode, urlOverride, cached, listeners, FORCED_KEY, forced, fhrMode, fhrOn, setFhrMode, forceFhrMode, onFhrMode, useFhrMode
	parseFhrMode = function(v)
		do return (if ((v == "on") or (v == "off")) then v else nil) end
	end
	exports.parseFhrMode = parseFhrMode
	urlOverride = function()
		local _ok1, _err2, _rv3 = pcall(function()
			if (Js.location == nil) then
				do return Js.RET, nil end
			end
			do return Js.RET, parseFhrMode(Js.URLSearchParams.new(Js.location.search).get("fhr")) end
		end)
		if not _ok1 then
			do return nil end
		elseif _err2 == Js.RET then
			return _rv3
		end
	end
	fhrMode = function()
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
				v = (if (Js.localStorage == nil) then nil else Js.localStorage.getItem(FHR_KEY))
			end)
			if not _ok4 then
				v = nil
			elseif _err5 == Js.RET then
				return _rv6
			end
			cached = (parseFhrMode(v) or FHR_DEFAULT)
		end
		do return cached end
	end
	exports.fhrMode = fhrMode
	setFhrMode = function(v)
		local _ok7, _err8, _rv9 = pcall(function()
			Js.localStorage.setItem(FHR_KEY, v)
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
	exports.setFhrMode = setFhrMode
	forceFhrMode = function(v)
		Js.globalThis[FORCED_KEY] = v
		listeners:forEach(function(f)
			return f()
		end)
	end
	exports.forceFhrMode = forceFhrMode
	FHR_KEY = "star-fhr"
	exports.FHR_KEY = FHR_KEY
	FHR_DEFAULT = "on"
	exports.FHR_DEFAULT = FHR_DEFAULT
	cached = nil
	listeners = Js.Set.new()
	FORCED_KEY = "__starFhrForced"
	forced = function()
		return (if Js.globalThis[FORCED_KEY] ~= nil then Js.globalThis[FORCED_KEY] else nil)
	end
	fhrOn = function()
		return (fhrMode() == "on")
	end
	exports.fhrOn = fhrOn
	if (Js.window ~= nil) then
		Js.window.addEventListener("storage", function(e)
			if (e.key == FHR_KEY) then
				cached = nil
				listeners:forEach(function(f)
					return f()
				end)
			end
		end)
	end
	onFhrMode = function(f)
		listeners:add(f)
		do return function()
			listeners:delete(f)
		end end
	end
	exports.onFhrMode = onFhrMode
	useFhrMode = function()
		return M_react.useSyncExternalStore(onFhrMode, fhrMode, function()
			return FHR_DEFAULT
		end)
	end
	exports.useFhrMode = useFhrMode
end
