--!nocheck
--!nolint
-- Generated from lib/star/giveAndGo.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local GIVE_AND_GO_FORWARD, GIVE_AND_GO_SAFE, FORWARD_M, wasForwardPass, giveAndGoChance
	wasForwardPass = function(sc, at)
		do return ((sc.ball.y - at.y) > FORWARD_M) end
	end
	exports.wasForwardPass = wasForwardPass
	giveAndGoChance = function(sc, at)
		do return (if wasForwardPass(sc, at) then GIVE_AND_GO_FORWARD else GIVE_AND_GO_SAFE) end
	end
	exports.giveAndGoChance = giveAndGoChance
	GIVE_AND_GO_FORWARD = 0.92
	exports.GIVE_AND_GO_FORWARD = GIVE_AND_GO_FORWARD
	GIVE_AND_GO_SAFE = 0.6
	exports.GIVE_AND_GO_SAFE = GIVE_AND_GO_SAFE
	FORWARD_M = 2
	exports.FORWARD_M = FORWARD_M
end
