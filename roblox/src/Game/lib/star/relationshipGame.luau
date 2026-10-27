--!nocheck
--!nolint
-- Generated from lib/star/relationshipGame.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local GAME_LOSS, GAME_EASY_BELOW, GAME_HARD_ABOVE, GAME_TOP_CHANCE, BOSS_WIN, BOSS_LOSS, relationshipGameGain, applyGameGain
	relationshipGameGain = function(won, current, roll, kind)
		if roll == nil then roll = Math.random() end
		if (kind == "boss") then
			do return (if won then BOSS_WIN else BOSS_LOSS) end
		end
		if (not won) then
			do return GAME_LOSS end
		end
		if (current < GAME_EASY_BELOW) then
			do return 2 end
		end
		if (current <= GAME_HARD_ABOVE) then
			do return 1 end
		end
		do return (if (roll < GAME_TOP_CHANCE) then 1 else 0) end
	end
	exports.relationshipGameGain = relationshipGameGain
	applyGameGain = function(current, gain)
		do return Math.max(0, Math.min(100, (current + gain))) end
	end
	exports.applyGameGain = applyGameGain
	GAME_LOSS = -4
	exports.GAME_LOSS = GAME_LOSS
	GAME_EASY_BELOW = 60
	exports.GAME_EASY_BELOW = GAME_EASY_BELOW
	GAME_HARD_ABOVE = 85
	exports.GAME_HARD_ABOVE = GAME_HARD_ABOVE
	GAME_TOP_CHANCE = 0.5
	exports.GAME_TOP_CHANCE = GAME_TOP_CHANCE
	BOSS_WIN = 3
	exports.BOSS_WIN = BOSS_WIN
	BOSS_LOSS = -2
	exports.BOSS_LOSS = BOSS_LOSS
end
