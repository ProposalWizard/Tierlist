--!nocheck
--!nolint
-- Generated from lib/star/media/updateFlags.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_leoUpdate = import("lib/star/leoUpdate")
	local G, flags, setMediaUpdate, labelFixesOn, goalOfMonthOn, yourGoalVideoOn
	setMediaUpdate = function(f)
		G.__kibMediaFlags = Js.ospread(flags(), f)
	end
	exports.setMediaUpdate = setMediaUpdate
	G = Js.globalThis
	if (not G.__kibMediaFlags) then
		G.__kibMediaFlags = (if (Js.window == nil) then Js.O({ labelFixes = true, goalOfMonth = true, yourGoalVideo = false }, { "labelFixes", "goalOfMonth", "yourGoalVideo" }) else Js.O({ labelFixes = M_leoUpdate.leoUpdateOn("bugFixes"), goalOfMonth = M_leoUpdate.leoUpdateOn("goalOfMonth"), yourGoalVideo = M_leoUpdate.leoUpdateOn("goalVideoNow") }, { "labelFixes", "goalOfMonth", "yourGoalVideo" }))
	end
	flags = function()
		return G.__kibMediaFlags
	end
	labelFixesOn = function()
		return flags().labelFixes
	end
	exports.labelFixesOn = labelFixesOn
	goalOfMonthOn = function()
		return flags().goalOfMonth
	end
	exports.goalOfMonthOn = goalOfMonthOn
	yourGoalVideoOn = function()
		return flags().yourGoalVideo
	end
	exports.yourGoalVideoOn = yourGoalVideoOn
end
