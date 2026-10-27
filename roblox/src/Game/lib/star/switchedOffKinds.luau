--!nocheck
--!nolint
-- Generated from lib/star/switchedOffKinds.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local SWITCHED_OFF_KINDS, isSwitchedOff, withoutSwitchedOff, playableKind
	withoutSwitchedOff = function(kinds)
		local kept = A.filter(kinds, function(k)
			return (not isSwitchedOff(k))
		end)
		do return (if Js.T(Js.alen(kept)) then kept else Js.aspread(kinds)) end
	end
	exports.withoutSwitchedOff = withoutSwitchedOff
	playableKind = function(kind, rng)
		if (not isSwitchedOff(kind)) then
			do return kind end
		end
		if (kind == "volley") then
			do return (if (rng() < 0.6) then "one_on_one" else "tight_angle") end
		end
		do return (if (rng() < 0.6) then "cutback" else "tight_angle") end
	end
	exports.playableKind = playableKind
	SWITCHED_OFF_KINDS = Js.Set.new(Js.alit())
	exports.SWITCHED_OFF_KINDS = SWITCHED_OFF_KINDS
	isSwitchedOff = function(k)
		return SWITCHED_OFF_KINDS:has(k)
	end
	exports.isSwitchedOff = isSwitchedOff
end
