--!nocheck
--!nolint
-- Generated from lib/star/chanceLog.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local CHANCE_KIND_LABEL, CHANCE_OUTCOME_LABEL, chanceOutcomeGood
	chanceOutcomeGood = function(o)
		do return (((((((o == "goal") or (o == "assist")) or (o == "rebound")) or (o == "pass")) or (o == "setup")) or (o == "dribble")) or (o == "touch")) end
	end
	exports.chanceOutcomeGood = chanceOutcomeGood
	CHANCE_KIND_LABEL = Js.O({ one_on_one = "One-on-one", tight_angle = "Tight angle", long_range = "Long shot", cutback = "Cutback", through_ball = "Through ball", byline_cross = "Cross from the byline", corner = "Corner", free_kick = "Free kick", penalty = "Penalty", buildup = "Build-up pass", midfield_pass = "Midfield pass", volley = "Volley", header = "Header", dribble = "Run at them" }, { "one_on_one", "tight_angle", "long_range", "cutback", "through_ball", "byline_cross", "corner", "free_kick", "penalty", "buildup", "midfield_pass", "volley", "header", "dribble" })
	exports.CHANCE_KIND_LABEL = CHANCE_KIND_LABEL
	CHANCE_OUTCOME_LABEL = Js.O({ goal = "⚽ Goal", assist = "🎯 Assist", rebound = "🎯 Assist (rebound)", pass = "✓ Pass found", setup = "✓ Found him — he missed", miss = "✗ Missed", lost = "✗ Lost it", dribble = "✓ Beat his man", tackled = "✗ Tackled", offside = "✗ Offside", touch = "✓ Kept it" }, { "goal", "assist", "rebound", "pass", "setup", "miss", "lost", "dribble", "tackled", "offside", "touch" })
	exports.CHANCE_OUTCOME_LABEL = CHANCE_OUTCOME_LABEL
end
