--!nocheck
--!nolint
-- Generated from lib/star/injurySwitch.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local INJURIES_ON, isRolledInjury
	isRolledInjury = function(i)
		do return ((not (not i)) and Js.re("^(Knock|Injury|Serious injury) —", ""):test(i.note)) end
	end
	exports.isRolledInjury = isRolledInjury
	INJURIES_ON = false
	exports.INJURIES_ON = INJURIES_ON
end
