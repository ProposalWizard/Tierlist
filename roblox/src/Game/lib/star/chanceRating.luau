--!nocheck
--!nolint
-- Generated from lib/star/chanceRating.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_pitch = import("lib/star/pitch")
	local M_tuningStore = import("lib/star/tuningStore")
	local goalZone, passGrade, ON_TARGET, missKind
	goalZone = function(kind, at)
		if (kind == "penalty") then
			do return "penalty" end
		end
		if (not at) then
			do return "box" end
		end
		if (((at.y <= M_pitch.SIX_DEPTH) and (at.x >= M_pitch.SIX_L)) and (at.x <= M_pitch.SIX_R)) then
			do return "tapIn" end
		end
		if (((at.y <= M_pitch.BOX_DEPTH) and (at.x >= M_pitch.BOX_L)) and (at.x <= M_pitch.BOX_R)) then
			do return "box" end
		end
		do return "outside" end
	end
	exports.goalZone = goalZone
	passGrade = function(difficulty, ambition)
		local a = Math.max((if difficulty ~= nil then difficulty else 0), (if ambition ~= nil then ambition else 0))
		if (a >= M_tuningStore.getTuning("rating.passAmbitiousFrom")) then
			do return "ambitious" end
		end
		if (a < M_tuningStore.getTuning("rating.passSafeBelow")) then
			do return "safe" end
		end
		do return "medium" end
	end
	exports.passGrade = passGrade
	missKind = function(kind, res)
		if (kind == "penalty") then
			do return "penalty" end
		end
		if (kind == "one_on_one") then
			do return "oneOnOne" end
		end
		do return (if ON_TARGET:has(res) then "on" else "off") end
	end
	exports.missKind = missKind
	ON_TARGET = Js.Set.new(Js.alit("saved", "caught", "tipped", "post", "blocked"))
end
