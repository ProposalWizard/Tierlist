--!nocheck
--!nolint
-- Generated from lib/star/wideChances.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_react = import("__pkg/react")
	local WIDE_CHANCES_KEY, WIDE_CHANCES_DEFAULT, stored, override, listeners, read, wideChancesStored, wideChances, setWideChances, setWideChancesOverride, useWideChances
	read = function()
		local _ok1, _err2, _rv3 = pcall(function()
			local v = (if (Js.localStorage ~= nil) then Js.localStorage.getItem(WIDE_CHANCES_KEY) else nil)
			do return Js.RET, (if ((v == "new") or (v == "old")) then v else WIDE_CHANCES_DEFAULT) end
		end)
		if not _ok1 then
			do return WIDE_CHANCES_DEFAULT end
		elseif _err2 == Js.RET then
			return _rv3
		end
	end
	wideChancesStored = function()
		local _ok4, _err5, _rv6 = pcall(function()
			do return Js.RET, ((Js.localStorage ~= nil) and (Js.localStorage.getItem(WIDE_CHANCES_KEY) ~= nil)) end
		end)
		if not _ok4 then
			do return false end
		elseif _err5 == Js.RET then
			return _rv6
		end
	end
	exports.wideChancesStored = wideChancesStored
	wideChances = function()
		do return (if override ~= nil then override else "old") end
	end
	exports.wideChances = wideChances
	setWideChances = function(v)
		local _ok7, _err8, _rv9 = pcall(function()
			Js.localStorage.setItem(WIDE_CHANCES_KEY, v)
		end)
		if not _ok7 then
		elseif _err8 == Js.RET then
			return _rv9
		end
		stored = v
		listeners:forEach(function(f)
			return f()
		end)
	end
	exports.setWideChances = setWideChances
	setWideChancesOverride = function(v)
		override = v
	end
	exports.setWideChancesOverride = setWideChancesOverride
	useWideChances = function()
		do return M_react.useSyncExternalStore(function(f)
			listeners:add(f)
			do return function()
				listeners:delete(f)
			end end
		end, wideChances, function()
			return WIDE_CHANCES_DEFAULT
		end) end
	end
	exports.useWideChances = useWideChances
	WIDE_CHANCES_KEY = "star-wide-chances"
	exports.WIDE_CHANCES_KEY = WIDE_CHANCES_KEY
	WIDE_CHANCES_DEFAULT = "old"
	exports.WIDE_CHANCES_DEFAULT = WIDE_CHANCES_DEFAULT
	stored = nil
	override = nil
	listeners = Js.Set.new()
	if (Js.window ~= nil) then
		Js.window.addEventListener("storage", function(e)
			if (e.key == WIDE_CHANCES_KEY) then
				stored = nil
				listeners:forEach(function(f)
					return f()
				end)
			end
		end)
	end
end
