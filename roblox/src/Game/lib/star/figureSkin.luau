--!nocheck
--!nolint
-- Generated from lib/star/figureSkin.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local FIGURE_SKIN_DEFAULT, FIGURE_SKIN_KEY, override, stored, listeners, readStored, figureSkin, setStoredFigureSkin, storedFigureSkin, setFigureSkinOverride, onFigureSkinChange
	readStored = function()
		local _ok1, _err2, _rv3 = pcall(function()
			if (Js.localStorage == nil) then
				do return Js.RET, nil end
			end
			local v = Js.localStorage.getItem(FIGURE_SKIN_KEY)
			do return Js.RET, (if ((v == "3d") or (v == "classic")) then v else nil) end
		end)
		if not _ok1 then
			do return nil end
		elseif _err2 == Js.RET then
			return _rv3
		end
	end
	figureSkin = function()
		do return (if override ~= nil then override else FIGURE_SKIN_DEFAULT) end
	end
	exports.figureSkin = figureSkin
	setStoredFigureSkin = function(skin)
		local _ok4, _err5, _rv6 = pcall(function()
			if Js.T(skin) then
				Js.localStorage.setItem(FIGURE_SKIN_KEY, skin)
			else
				Js.localStorage.removeItem(FIGURE_SKIN_KEY)
			end
		end)
		if not _ok4 then
		elseif _err5 == Js.RET then
			return _rv6
		end
		stored = skin
		listeners:forEach(function(f)
			return f()
		end)
	end
	exports.setStoredFigureSkin = setStoredFigureSkin
	storedFigureSkin = function()
		do return "3d" end
	end
	exports.storedFigureSkin = storedFigureSkin
	setFigureSkinOverride = function(skin)
		local before = override
		override = skin
		listeners:forEach(function(f)
			return f()
		end)
		do return function()
			override = before
			listeners:forEach(function(f)
				return f()
			end)
		end end
	end
	exports.setFigureSkinOverride = setFigureSkinOverride
	onFigureSkinChange = function(f)
		listeners:add(f)
		do return function()
			listeners:delete(f)
		end end
	end
	exports.onFigureSkinChange = onFigureSkinChange
	FIGURE_SKIN_DEFAULT = "3d"
	exports.FIGURE_SKIN_DEFAULT = FIGURE_SKIN_DEFAULT
	FIGURE_SKIN_KEY = "star-figure-skin"
	exports.FIGURE_SKIN_KEY = FIGURE_SKIN_KEY
	override = nil
	stored = nil
	listeners = Js.Set.new()
	if (Js.window ~= nil) then
		Js.window.addEventListener("storage", function(e)
			if (e.key == FIGURE_SKIN_KEY) then
				stored = nil
				listeners:forEach(function(f)
					return f()
				end)
			end
		end)
	end
end
