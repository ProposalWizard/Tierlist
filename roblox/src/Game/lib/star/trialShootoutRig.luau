--!nocheck
--!nolint
-- Generated from lib/star/trialShootoutRig.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_season = import("lib/star/season")
	local M_penaltyTaking = import("lib/star/penaltyTaking")
	local M_runupStyles = import("lib/star/runupStyles")
	local SHOOTOUT_KICKS, SHOOTOUT_TOTAL, MISS_STYLES, createRig, rigNextSide, rigGoals, rigKicksTaken, isYourKick, isWinningPenalty, isTeamMateKick, choose, RIG_LEVEL, MATE_KICK_INDEX, createRigScript, rigIntent, rigApply, winningPenaltyScored, RIG_GOAL_OFF, RIG_GOAL_POWER, RIG_GOAL_CONTACT, RIG_MISS, RIG_MISS_OFF, RIG_MISS_POWER, rigPlanFor, rigKeeperRead, MISS_LINE, pickRunups, idForRunup
	createRig = function()
		do return Js.O({ kicks = Js.alit(), over = false, winner = nil }, { "kicks", "over", "winner" }) end
	end
	exports.createRig = createRig
	rigNextSide = function(kicks)
		do return (if (math.fmod(Js.alen(kicks), 2) == 0) then "them" else "you") end
	end
	exports.rigNextSide = rigNextSide
	rigGoals = function(kicks, side)
		do return Js.alen(A.filter(kicks, function(k)
			return ((k.side == side) and k.scored)
		end)) end
	end
	exports.rigGoals = rigGoals
	rigKicksTaken = function(kicks, side)
		do return Js.alen(A.filter(kicks, function(k)
			return (k.side == side)
		end)) end
	end
	exports.rigKicksTaken = rigKicksTaken
	isYourKick = function(state)
		do return (((not state.over) and (rigNextSide(state.kicks) == "you")) and (rigKicksTaken(state.kicks, "you") == (SHOOTOUT_KICKS - 1))) end
	end
	exports.isYourKick = isYourKick
	isTeamMateKick = function(state)
		do return (((not state.over) and (rigNextSide(state.kicks) == "you")) and (not isYourKick(state))) end
	end
	exports.isTeamMateKick = isTeamMateKick
	choose = function(n, k, rng)
		local idx = Js.Array.from(Js.O({ length = n }, { "length" }), function(_, i)
			return i
		end)
		do
			local i = (n - 1)
			local _first1 = true
			while true do
				if not _first1 then
					i -= 1
				end
				_first1 = false
				if not (i > 0) then break end
				local j = math.floor((rng() * (i + 1)))
				local _d2 = Js.alit(idx[j + 1], idx[i + 1])
				A.set(idx, i, _d2[1])
				A.set(idx, j, _d2[2])
			end
		end
		do return Js.Set.new(A.slice(idx, 0, k)) end
	end
	createRigScript = function(seed)
		local rng = M_season.mulberry32(Js.ushr(Js.bxor(seed, 372743), 0))
		rng()
		local level = RIG_LEVEL
		local theirs = choose(SHOOTOUT_KICKS, level, rng)
		local ours = choose((SHOOTOUT_KICKS - 1), level, rng)
		local intents = Js.alit()
		for i = 0, (SHOOTOUT_TOTAL - 1) - 1 do
			local round = math.floor((i / 2))
			A.push(intents, (if (math.fmod(i, 2) == 0) then theirs:has(round) else ours:has(round)))
		end
		local misses = Js.alit()
		local bag = Js.alit()
		for i = 0, (SHOOTOUT_TOTAL - 1) - 1 do
			if (Js.alen(bag) == 0) then
				bag = Js.aspread(MISS_STYLES)
				for a = (Js.alen(bag) - 1), 1, -1 do
					local b = math.floor((rng() * (a + 1)))
					local _d3 = Js.alit(bag[b + 1], bag[a + 1])
					A.set(bag, a, _d3[1])
					A.set(bag, b, _d3[2])
				end
				local last = A.find(A.reverse(Js.aspread(misses)), function(_, k)
					return (not intents[((Js.alen(misses) - 1) - k) + 1])
				end)
				if (Js.T(last) and (bag[Js.alen(bag)] == last)) then
					local _d4 = Js.alit(bag[Js.alen(bag)], bag[1])
					A.set(bag, 0, _d4[1])
					A.set(bag, (Js.alen(bag) - 1), _d4[2])
				end
			end
			A.push(misses, (if intents[i + 1] then "wide" else A.pop(bag)))
		end
		local sides = A.map(intents, function()
			return (if (rng() < 0.5) then -1 else 1)
		end)
		local _d5 = MATE_KICK_INDEX
		local m1 = _d5[1]
		local m2 = _d5[2]
		local other = function(...)
			local not_ = Js.alit(...)
			return (A.find(MISS_STYLES, function(m)
				return (not A.includes(not_, m))
			end) or MISS_STYLES[1])
		end
		if (((not intents[m1 + 1]) and (not intents[m2 + 1])) and (misses[m1 + 1] == misses[m2 + 1])) then
			A.set(misses, m2, other(misses[m1 + 1], (if intents[m2] then nil else misses[m2])))
			local after = (m2 + 1)
			if (((after < Js.alen(misses)) and (not intents[after + 1])) and (misses[after + 1] == misses[m2 + 1])) then
				A.set(misses, after, other(misses[m2 + 1], (if intents[m2] then nil else misses[m2])))
			end
		end
		do
			local i = 0
			local _first6 = true
			while true do
				if not _first6 then
					i += 1
				end
				_first6 = false
				if not (i < Js.alen(misses)) then break end
				if (not intents[i + 1]) then
					do continue end
				end
				local mate = A.indexOf(MATE_KICK_INDEX, i)
				A.set(misses, i, other((if (mate >= 0) then misses[MATE_KICK_INDEX[(1 - mate) + 1] + 1] else nil), (if (i > 0) then misses[i] else nil)))
			end
		end
		A.set(sides, m2, (-(sides[m1 + 1])))
		do return Js.O({ intents = intents, sides = sides, misses = misses, level = level }, { "intents", "sides", "misses", "level" }) end
	end
	exports.createRigScript = createRigScript
	rigIntent = function(state, script_)
		local i = Js.alen(state.kicks)
		if (i >= (SHOOTOUT_TOTAL - 1)) then
			do return false end
		end
		local planned = script_.intents[i + 1]
		local theirs = rigGoals(state.kicks, "them")
		local ours = rigGoals(state.kicks, "you")
		local side = rigNextSide(state.kicks)
		local restThem = 0
		local restUs = 0
		local leftThem = 0
		local leftUs = 0
		for j = (i + 1), (SHOOTOUT_TOTAL - 1) - 1 do
			if (math.fmod(j, 2) == 0) then
				leftThem += 1
				if script_.intents[j + 1] then
					restThem += 1
				end
			else
				leftUs += 1
				if script_.intents[j + 1] then
					restUs += 1
				end
			end
		end
		local endsLevel = function(scores)
			local t = ((theirs + (if ((side == "them") and scores) then 1 else 0)) + restThem)
			local u = ((ours + (if ((side == "you") and scores) then 1 else 0)) + restUs)
			do return (t == u) end
		end
		if endsLevel(planned) then
			do return planned end
		end
		local reachable = function(scores)
			local d = ((theirs + (if ((side == "them") and scores) then 1 else 0)) - (ours + (if ((side == "you") and scores) then 1 else 0)))
			do return ((d >= (-leftThem)) and (d <= leftUs)) end
		end
		if reachable(planned) then
			do return planned end
		end
		do return (not planned) end
	end
	exports.rigIntent = rigIntent
	rigApply = function(state, scored)
		if state.over then
			do return state end
		end
		local side = rigNextSide(state.kicks)
		local kicks = Js.aspread(state.kicks, Js.alit(Js.O({ side = side, scored = scored }, { "side", "scored" })))
		local over = (Js.alen(kicks) >= SHOOTOUT_TOTAL)
		local yours = rigGoals(kicks, "you")
		local theirs = rigGoals(kicks, "them")
		do return Js.O({ kicks = kicks, over = over, winner = (if over then (if (yours > theirs) then "you" else (if (theirs > yours) then "them" else nil)) else nil) }, { "kicks", "over", "winner" }) end
	end
	exports.rigApply = rigApply
	winningPenaltyScored = function(state)
		if (not state.over) then
			do return false end
		end
		local last = state.kicks[Js.alen(state.kicks)]
		do return (((not (not last)) and (last.side == "you")) and last.scored) end
	end
	exports.winningPenaltyScored = winningPenaltyScored
	rigPlanFor = function(scores, side, techniqueOfTaker, miss)
		if miss == nil then miss = "wide" end
		if scores then
			do return Js.O({ style = "placed", off = (side * RIG_GOAL_OFF), power = RIG_GOAL_POWER, cy = M_penaltyTaking.sameHeight(RIG_GOAL_CONTACT, techniqueOfTaker) }, { "style", "off", "power", "cy" }) end
		end
		local m = RIG_MISS[miss]
		do return Js.O({ style = "placed", off = (side * m.off), power = m.power, cy = M_penaltyTaking.sameHeight(m.cy, techniqueOfTaker) }, { "style", "off", "power", "cy" }) end
	end
	exports.rigPlanFor = rigPlanFor
	rigKeeperRead = function(scores, read)
		do return (if scores then Js.ospread(read, Js.O({ readChance = 0 }, { "readChance" })) else read) end
	end
	exports.rigKeeperRead = rigKeeperRead
	pickRunups = function(seed, n)
		local rng = M_season.mulberry32(Js.ushr(Js.bxor(seed, 10769), 0))
		local all = A.map(A.filter(M_runupStyles.PENALTY_RUNUPS, function(s)
			return (not M_runupStyles.REWARD_RUNUPS:has(s.id))
		end), function(s)
			return s.id
		end)
		for i = (Js.alen(all) - 1), 1, -1 do
			local j = math.floor((rng() * (i + 1)))
			local _d7 = Js.alit(all[j + 1], all[i + 1])
			A.set(all, i, _d7[1])
			A.set(all, j, _d7[2])
		end
		do return A.slice(all, 0, Math.max(0, Math.min(Js.alen(all), n))) end
	end
	exports.pickRunups = pickRunups
	idForRunup = function(base, wanted)
		for i = 0, 499 do
			local id = (base .. "-" .. Js.numstr(i))
			if (M_runupStyles.takerPenaltyRunup(id) == wanted) then
				do return id end
			end
		end
		do return base end
	end
	exports.idForRunup = idForRunup
	SHOOTOUT_KICKS = 3
	exports.SHOOTOUT_KICKS = SHOOTOUT_KICKS
	SHOOTOUT_TOTAL = (SHOOTOUT_KICKS * 2)
	exports.SHOOTOUT_TOTAL = SHOOTOUT_TOTAL
	MISS_STYLES = Js.alit("wide", "skied", "over")
	exports.MISS_STYLES = MISS_STYLES
	isWinningPenalty = isYourKick
	exports.isWinningPenalty = isWinningPenalty
	RIG_LEVEL = 2
	exports.RIG_LEVEL = RIG_LEVEL
	MATE_KICK_INDEX = Js.alit(1, 3)
	exports.MATE_KICK_INDEX = MATE_KICK_INDEX
	RIG_GOAL_OFF = 3.3
	exports.RIG_GOAL_OFF = RIG_GOAL_OFF
	RIG_GOAL_POWER = 0.94
	exports.RIG_GOAL_POWER = RIG_GOAL_POWER
	RIG_GOAL_CONTACT = -0.8
	exports.RIG_GOAL_CONTACT = RIG_GOAL_CONTACT
	RIG_MISS = Js.O({ wide = Js.O({ off = 5.2, power = 0.75, cy = 0 }, { "off", "power", "cy" }), skied = Js.O({ off = 4.4, power = 0.85, cy = 0.6 }, { "off", "power", "cy" }), over = Js.O({ off = 3.3, power = 1, cy = 1 }, { "off", "power", "cy" }) }, { "wide", "skied", "over" })
	exports.RIG_MISS = RIG_MISS
	RIG_MISS_OFF = RIG_MISS.wide.off
	exports.RIG_MISS_OFF = RIG_MISS_OFF
	RIG_MISS_POWER = RIG_MISS.wide.power
	exports.RIG_MISS_POWER = RIG_MISS_POWER
	MISS_LINE = Js.O({ wide = "Dragged wide!", skied = "Skied it, high and wide!", over = "Over the bar!" }, { "wide", "skied", "over" })
	exports.MISS_LINE = MISS_LINE
end
