--!nocheck
--!nolint
-- Generated from lib/star/horse.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_tuningStore = import("lib/star/tuningStore")
	local horseRating, horseRacePrize, horseUpkeep, renameHorse
	horseRating = function(horse)
		do return Math.round(((horse.speed + horse.stamina) / 2)) end
	end
	exports.horseRating = horseRating
	horseRacePrize = function(finish, horse)
		local win = (M_tuningStore.getTuning("horseRacing.winPrizeBase") + (horseRating(horse) * M_tuningStore.getTuning("horseRacing.winPrizePerRating")))
		if (finish == 1) then
			do return Math.round(win) end
		end
		if (finish == 2) then
			do return Math.round((win * M_tuningStore.getTuning("horseRacing.placeShare"))) end
		end
		if (finish == 3) then
			do return Math.round((win * M_tuningStore.getTuning("horseRacing.showShare"))) end
		end
		do return 0 end
	end
	exports.horseRacePrize = horseRacePrize
	horseUpkeep = function(horse)
		do return Math.round((M_tuningStore.getTuning("horseRacing.upkeepBase") + (horseRating(horse) * M_tuningStore.getTuning("horseRacing.upkeepPerRating")))) end
	end
	exports.horseUpkeep = horseUpkeep
	renameHorse = function(career, name)
		local trimmed = S.slice(S.trim(name), 0, 24)
		if ((not career.horse) or (not Js.T(trimmed))) then
			do return career end
		end
		do return Js.ospread(career, Js.O({ horse = Js.ospread(career.horse, Js.O({ name = trimmed }, { "name" })) }, { "horse" })) end
	end
	exports.renameHorse = renameHorse
end
