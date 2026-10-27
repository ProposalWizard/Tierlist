--!nocheck
--!nolint
-- Generated from lib/star/chanceFraming.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_react = import("__pkg/react")
	local CHANCE_FRAMING_KEY, CHANCE_FRAMING_DEFAULT, stored, listeners, read, chanceFraming, setChanceFraming, useChanceFraming
	read = function()
		local _ok1, _err2, _rv3 = pcall(function()
			local v = (if (Js.localStorage ~= nil) then Js.localStorage.getItem(CHANCE_FRAMING_KEY) else nil)
			do return Js.RET, (if ((v == "zoom") or (v == "old")) then v else CHANCE_FRAMING_DEFAULT) end
		end)
		if not _ok1 then
			do return CHANCE_FRAMING_DEFAULT end
		elseif _err2 == Js.RET then
			return _rv3
		end
	end
	chanceFraming = function()
		do return "zoom" end
	end
	exports.chanceFraming = chanceFraming
	setChanceFraming = function(v)
		local _ok4, _err5, _rv6 = pcall(function()
			Js.localStorage.setItem(CHANCE_FRAMING_KEY, v)
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
	exports.setChanceFraming = setChanceFraming
	useChanceFraming = function()
		do return M_react.useSyncExternalStore(function(f)
			listeners:add(f)
			do return function()
				listeners:delete(f)
			end end
		end, chanceFraming, function()
			return CHANCE_FRAMING_DEFAULT
		end) end
	end
	exports.useChanceFraming = useChanceFraming
	CHANCE_FRAMING_KEY = "star-chance-framing"
	exports.CHANCE_FRAMING_KEY = CHANCE_FRAMING_KEY
	CHANCE_FRAMING_DEFAULT = "zoom"
	exports.CHANCE_FRAMING_DEFAULT = CHANCE_FRAMING_DEFAULT
	stored = nil
	listeners = Js.Set.new()
	if (Js.window ~= nil) then
		Js.window.addEventListener("storage", function(e)
			if (e.key == CHANCE_FRAMING_KEY) then
				stored = nil
				listeners:forEach(function(f)
					return f()
				end)
			end
		end)
	end
end
