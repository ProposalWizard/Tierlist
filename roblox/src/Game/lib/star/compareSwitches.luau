--!nocheck
--!nolint
-- Generated from lib/star/compareSwitches.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local COMPARE_SWITCHES, keyFor, inRealGame, testAreaSetting, switchOn, setSwitch, resetSwitches
	inRealGame = function()
		if (Js.window == nil) then
			do return true end
		end
		local _ok1, _err2, _rv3 = pcall(function()
			local p = S.replace(Js.window.location.pathname, Js.re("\\/+$", ""), "")
			do return Js.RET, (p == "/star-dev") end
		end)
		if not _ok1 then
			do return true end
		elseif _err2 == Js.RET then
			return _rv3
		end
	end
	exports.inRealGame = inRealGame
	testAreaSetting = function(key)
		if ((Js.window == nil) or inRealGame()) then
			do return nil end
		end
		local _ok4, _err5, _rv6 = pcall(function()
			do return Js.RET, Js.window.localStorage.getItem(key) end
		end)
		if not _ok4 then
			do return nil end
		elseif _err5 == Js.RET then
			return _rv6
		end
	end
	exports.testAreaSetting = testAreaSetting
	switchOn = function(name)
		do return (testAreaSetting(keyFor(name)) ~= "off") end
	end
	exports.switchOn = switchOn
	setSwitch = function(name, on)
		if (Js.window == nil) then
			do return end
		end
		local _ok7, _err8, _rv9 = pcall(function()
			if on then
				Js.window.localStorage.removeItem(keyFor(name))
			else
				Js.window.localStorage.setItem(keyFor(name), "off")
			end
		end)
		if not _ok7 then
		elseif _err8 == Js.RET then
			return _rv9
		end
	end
	exports.setSwitch = setSwitch
	resetSwitches = function()
		if (Js.window == nil) then
			do return end
		end
		local _ok10, _err11, _rv12 = pcall(function()
			do
				local _arr13 = COMPARE_SWITCHES
				local _i14 = 0
				while _i14 < Js.alen(_arr13) do
					_i14 += 1
					local c = _arr13[_i14]
					Js.window.localStorage.removeItem(keyFor(c.id))
				end
			end
			Js.window.localStorage.removeItem("star-compare-goalOnLine")
			Js.window.localStorage.removeItem("star-compare-keeperOneDive")
		end)
		if not _ok10 then
		elseif _err11 == Js.RET then
			return _rv12
		end
	end
	exports.resetSwitches = resetSwitches
	COMPARE_SWITCHES = Js.alit(Js.O({ id = "penaltyRules", label = "Penalty rules", hint = "New: keeper central on his line, ball on the spot, you behind it, others on the box edge, one camera. Test screens only." }, { "id", "label", "hint" }), Js.O({ id = "powerCurve", label = "Shot power", hint = "New: the Power curve below (40 hits about 66 km/h, 99 about 103). Old: the straight line (40 about 79, 99 about 113). Test screens only." }, { "id", "label", "hint" }))
	exports.COMPARE_SWITCHES = COMPARE_SWITCHES
	keyFor = function(name)
		return ("star-compare-" .. name)
	end
end
