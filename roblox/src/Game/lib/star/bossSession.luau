--!nocheck
--!nolint
-- Generated from lib/star/bossSession.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_bossPenalties = import("lib/star/bossPenalties")
	local SESSION_REPS, SESSION_FIRST_LEVEL, sessionHits, sessionGain
	sessionHits = function(goals)
		local g = Math.max(0, Math.min(SESSION_REPS, Math.round(goals)))
		do return Math.round(((g * M_bossPenalties.BOSS_KICKS) / SESSION_REPS)) end
	end
	exports.sessionHits = sessionHits
	sessionGain = function(goals)
		do return M_bossPenalties.bossGain(sessionHits(goals)) end
	end
	exports.sessionGain = sessionGain
	SESSION_REPS = 4
	exports.SESSION_REPS = SESSION_REPS
	SESSION_FIRST_LEVEL = 3
	exports.SESSION_FIRST_LEVEL = SESSION_FIRST_LEVEL
end
