--!nocheck
--!nolint
-- Generated from lib/star/aerial.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_hitbox = import("lib/star/hitbox")
	local AERIAL_START, aerialFromOld, aerialOf, AERIAL_HEADER_PACE_PER_PT, AERIAL_VOLLEY_PACE_PER_PT, aerialHeaderPace, aerialVolleyPace, HEADER_STAND_Z, AERIAL_JUMP_AT_40, AERIAL_JUMP_PER_PT, aerialJumpM, headerReachM, headerJump
	aerialFromOld = function(skills)
		local n = function(v)
			return (if ((type(v) == "number") and Js.NumberNS.isFinite(v)) then v else AERIAL_START)
		end
		local v = Math.round(((0.6 * n(skills.power)) + (0.4 * n(skills.technique))))
		do return Math.max(AERIAL_START, Math.min(100, v)) end
	end
	exports.aerialFromOld = aerialFromOld
	aerialOf = function(skills)
		do return (if ((type(skills.aerial) == "number") and Js.NumberNS.isFinite(skills.aerial)) then skills.aerial else aerialFromOld(skills)) end
	end
	exports.aerialOf = aerialOf
	aerialHeaderPace = function(aerial)
		if ((aerial == nil) or (not Js.NumberNS.isFinite(aerial))) then
			do return 1 end
		end
		do return Math.max(0.75, Math.min(1.25, (1 + ((aerial - 60) * AERIAL_HEADER_PACE_PER_PT)))) end
	end
	exports.aerialHeaderPace = aerialHeaderPace
	aerialVolleyPace = function(aerial)
		if ((aerial == nil) or (not Js.NumberNS.isFinite(aerial))) then
			do return 1 end
		end
		do return Math.max(0.85, Math.min(1.15, (1 + ((aerial - 60) * AERIAL_VOLLEY_PACE_PER_PT)))) end
	end
	exports.aerialVolleyPace = aerialVolleyPace
	aerialJumpM = function(aerial)
		local a = (if Js.NumberNS.isFinite(aerial) then aerial else 40)
		do return Math.max(0.3, Math.min(0.85, (AERIAL_JUMP_AT_40 + ((a - 40) * AERIAL_JUMP_PER_PT)))) end
	end
	exports.aerialJumpM = aerialJumpM
	headerReachM = function(aerial)
		do return (HEADER_STAND_Z + aerialJumpM(aerial)) end
	end
	exports.headerReachM = headerReachM
	headerJump = function(ballZ, aerial)
		local maxJumpM = aerialJumpM(aerial)
		local need = Math.max(0, (ballZ - HEADER_STAND_Z))
		do return Js.O({ jumpM = Math.min(need, maxJumpM), maxJumpM = maxJumpM, overM = Math.max(0, (need - maxJumpM)) }, { "jumpM", "maxJumpM", "overM" }) end
	end
	exports.headerJump = headerJump
	AERIAL_START = 40
	exports.AERIAL_START = AERIAL_START
	AERIAL_HEADER_PACE_PER_PT = (1 / 150)
	exports.AERIAL_HEADER_PACE_PER_PT = AERIAL_HEADER_PACE_PER_PT
	AERIAL_VOLLEY_PACE_PER_PT = (1 / 300)
	exports.AERIAL_VOLLEY_PACE_PER_PT = AERIAL_VOLLEY_PACE_PER_PT
	HEADER_STAND_Z = (M_hitbox.HITBOX_DEFAULTS.standHeight - 0.1)
	exports.HEADER_STAND_Z = HEADER_STAND_Z
	AERIAL_JUMP_AT_40 = 0.45
	exports.AERIAL_JUMP_AT_40 = AERIAL_JUMP_AT_40
	AERIAL_JUMP_PER_PT = 0.006
	exports.AERIAL_JUMP_PER_PT = AERIAL_JUMP_PER_PT
end
