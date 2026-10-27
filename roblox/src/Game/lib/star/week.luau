--!nocheck
--!nolint
-- Generated from lib/star/week.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_relationships = import("lib/star/relationships")
	local M_tuningStore = import("lib/star/tuningStore")
	local WEEK_ACTIONS, REST_HAPPINESS, REST_ENERGY, actionsLeft, canAct, spendAction, rest, projectedEnergy, startNewWeek, TRAINING_SESSIONS_PER_WEEK, trainingLeft, spendTrainingSession, sessionsAfterMatch
	actionsLeft = function(career)
		do return (if career.weekActions ~= nil then career.weekActions else WEEK_ACTIONS) end
	end
	exports.actionsLeft = actionsLeft
	canAct = function(career)
		do return (actionsLeft(career) > 0) end
	end
	exports.canAct = canAct
	spendAction = function(career)
		local left = actionsLeft(career)
		if (left <= 0) then
			do return career end
		end
		do return Js.ospread(career, Js.O({ weekActions = (left - 1) }, { "weekActions" })) end
	end
	exports.spendAction = spendAction
	rest = function(career)
		if (not canAct(career)) then
			do return career end
		end
		do return Js.ospread(spendAction(career), Js.O({ energy = Math.min(100, Math.round((career.energy + (REST_ENERGY * M_relationships.happinessEnergyFactor(M_relationships.happinessOf(career)))))) }, { "energy" })) end
	end
	exports.rest = rest
	projectedEnergy = function(career)
		do return Math.min(100, career.energy) end
	end
	exports.projectedEnergy = projectedEnergy
	startNewWeek = function()
		do return Js.O({ weekActions = WEEK_ACTIONS }, { "weekActions" }) end
	end
	exports.startNewWeek = startNewWeek
	trainingLeft = function(career)
		do return (if career.trainingSessions ~= nil then career.trainingSessions else TRAINING_SESSIONS_PER_WEEK) end
	end
	exports.trainingLeft = trainingLeft
	spendTrainingSession = function(career)
		local left = trainingLeft(career)
		if (left <= 0) then
			do return career end
		end
		do return Js.ospread(career, Js.O({ trainingSessions = (left - 1) }, { "trainingSessions" })) end
	end
	exports.spendTrainingSession = spendTrainingSession
	sessionsAfterMatch = function(career, matchDay)
		do return Js.O({ trainingSessions = (if (matchDay == "saturday") then TRAINING_SESSIONS_PER_WEEK else trainingLeft(career)) }, { "trainingSessions" }) end
	end
	exports.sessionsAfterMatch = sessionsAfterMatch
	WEEK_ACTIONS = M_tuningStore.getTuning("energy.weekActions")
	exports.WEEK_ACTIONS = WEEK_ACTIONS
	REST_HAPPINESS = M_tuningStore.getTuning("energy.restHappiness")
	exports.REST_HAPPINESS = REST_HAPPINESS
	REST_ENERGY = M_tuningStore.getTuning("energy.restEnergy")
	exports.REST_ENERGY = REST_ENERGY
	TRAINING_SESSIONS_PER_WEEK = 2
	exports.TRAINING_SESSIONS_PER_WEEK = TRAINING_SESSIONS_PER_WEEK
end
