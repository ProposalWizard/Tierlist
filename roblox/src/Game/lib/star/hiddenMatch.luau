--!nocheck
--!nolint
-- Generated from lib/star/hiddenMatch.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_commentaryExtra = import("lib/star/commentaryExtra")
	local M_penaltyTaking = import("lib/star/penaltyTaking")
	local M_tuningStore = import("lib/star/tuningStore")
	local HIGH_MODE_CHANCES, LOW_MODE_CHANCES, HIGH_MODE_EXTRA, TALISMAN_CHANCES, FAREWELL_INVOLVEMENT, LATE_SUB_GUARANTEE_FROM, lateSubQuota, lateness, fitnessScale, LATE_SUB_INVOLVEMENT, LATE_SUB_EXTRA, lateSubInvolvement, lateSubExtra, LATE_SUB_FORCE_GAP, ZONE_ORDER, USER_DANGER, OPP_DANGER, playstyleAt, GAP_REGAIN, GAP_KEEP, TEAM_REL_INVOLVE, FAN_INVOLVE, FAN_REGAIN, PLAYSTYLE_CONCEDE, PLAYSTYLE_REGAIN, PLAYSTYLE_PULL, DEF_UNDERDOG, DEF_DROP_RATE, ATT_STARVE, PLAYSTYLE_KIND, RECEIVED_KINDS, RECENT_KINDS, KIND_REPEAT_WEIGHT, KIND_RES, clampN, lean, noteServedKind, relationshipInvolvement, playstylePull, gapKindWeight, skillKindWeight, weightKinds, PENALTY_WON_IN_BOX, HOME_EDGE, LATE_FROM, CHASE_EDGE, FERGIE_EDGE, FERGIE_PUSH, FERGIE_CHANCES, FERGIE_BOX, FERGIE_COUNTER, FERGIE_EXPOSED, COUNTER_OPP, TURNOVER, TURNOVER_EDGE, DRIVE, RETREAT, ENTRY, CHANCE_DEEP, CHANCE_BOX
	local STARVED_MIN, DEEP_TOUCH, DEEP_TOUCH_GAP, DEEP_TOUCH_PULL, DRIBBLE_CHANCE, POSITION_PULL, POSITION_LANE, positionPull, POSITION_DRIBBLE, lanePull, CONVERT_DEEP, CONVERT_BOX, QUALITY_CHANCE, QUALITY_CONVERT, convertRate, QUIET_USER, QUIET_OPP, MISS_USER, MISS_OPP, QUIET_USER_ALL, QUIET_OPP_ALL, MISS_USER_ALL, MISS_OPP_ALL, freshLine, CHANCE_LINES, benchConversion, FLOW_TURNOVER_EDGE, FLOW_EARLY_CHASE, FLOW_LATE_FROM, FLOW_LATE_SPAN, flowLate, FLOW_SPEC_DEEP, FLOW_SPEC_BOX, FLOW_SPEC_CONVERT_DEEP, FLOW_SPEC_CONVERT_BOX, FLOW_CORNER_FROM_SHOT, FLOW_CORNER_SHOT, FLOW_CORNER_CONVERT, FLOW_SPEC_KEEP, FLOW_RECYCLE, FLOW_RECYCLE_EDGE, FLOW_CORNER_OPEN, FLOW_CONVERT_SCALE, SPEC_USER, SPEC_OPP, CORNER_USER, CORNER_OPP, CORNER_SHOT_USER, CORNER_SHOT_OPP, flowCorner, flowEndOfMove, newMatch, stepLane, kindsForZone, shift, clamp1, modeAt, tick_, radarTickOf, tickMinute
	local contextRegain, endOfMove, buildRequest, resolveScenario, advanceTo, AIR_KINDS, SET_PIECES, AIR_INTRO_BY, gateMechanics, advanceUntilInvolved, halfOf, HALF_GUARANTEE_AT, halfGuaranteeChance, lateSubChance
	lateSubQuota = function(enteredAt)
		do return (if (enteredAt >= LATE_SUB_GUARANTEE_FROM) then 1 else 0) end
	end
	exports.lateSubQuota = lateSubQuota
	lateness = function(enteredAt)
		do return Math.max(0, Math.min(1, ((enteredAt - 55) / 25))) end
	end
	fitnessScale = function(sub)
		local f = Math.max(0, Math.min(100, (if sub.fitness ~= nil then sub.fitness else 100)))
		do return (0.6 + (0.4 * (f / 100))) end
	end
	lateSubInvolvement = function(sub)
		do return (1.5 + ((LATE_SUB_INVOLVEMENT * lateness(sub.enteredAt)) * fitnessScale(sub))) end
	end
	exports.lateSubInvolvement = lateSubInvolvement
	lateSubExtra = function(sub)
		do return ((LATE_SUB_EXTRA * lateness(sub.enteredAt)) * fitnessScale(sub)) end
	end
	exports.lateSubExtra = lateSubExtra
	playstyleAt = function(ctx, minute)
		local ps = ((function() local _v = ctx; if _v == nil then return nil end; _v = _v.playstyle; return _v end)() or "balanced")
		local at = (-math.huge)
		do
			local _arr1 = ((function() local _v = ctx; if _v == nil then return nil end; _v = _v.playstyleChanges; return _v end)() or Js.alit())
			local _i2 = 0
			while _i2 < Js.alen(_arr1) do
				_i2 += 1
				local c = _arr1[_i2]
				if ((c.minute <= minute) and (c.minute >= at)) then
					ps = c.playstyle
					at = c.minute
				end
			end
		end
		do return ps end
	end
	exports.playstyleAt = playstyleAt
	noteServedKind = function(state, kind)
		state.recentKinds = A.slice(Js.aspread((if state.recentKinds ~= nil then state.recentKinds else Js.alit()), Js.alit(kind)), (-RECENT_KINDS))
	end
	exports.noteServedKind = noteServedKind
	relationshipInvolvement = function(ctx, home)
		if (not ctx) then
			do return 1 end
		end
		local m = 1
		if (ctx.teamRelationship ~= nil) then
			m *= clampN((1 + ((ctx.teamRelationship - 60) * TEAM_REL_INVOLVE)), 0.6, 1.3)
		end
		if (ctx.fanRelationship ~= nil) then
			m *= (1 + (lean(ctx.fanRelationship) * (if (home == true) then FAN_INVOLVE else (if (home == false) then (FAN_INVOLVE / 3) else (FAN_INVOLVE / 2)))))
		end
		do return m end
	end
	exports.relationshipInvolvement = relationshipInvolvement
	playstylePull = function(ps, zone, quality)
		local base = PLAYSTYLE_PULL[ps][zone]
		if ((ps == "defensive") and (((zone == "own_box") or (zone == "defensive")) or (zone == "middle"))) then
			do return (base * (1 + (DEF_UNDERDOG * Math.max(0, (-quality))))) end
		end
		do return base end
	end
	exports.playstylePull = playstylePull
	gapKindWeight = function(kind, quality)
		local u = Math.max(0, (-quality))
		local f = Math.max(0, quality)
		local _sw3 = kind
		if _sw3 == "one_on_one" then
			do return ((1 + (0.5 * u)) * (1 - (0.3 * f))) end
		elseif _sw3 == "through_ball" then
			do return ((1 + (0.4 * u)) * (1 - (0.3 * f))) end
		elseif _sw3 == "long_range" then
			do return ((1 + (0.3 * u)) * (1 + (0.15 * f))) end
		elseif _sw3 == "cutback" then
			do return ((1 - (0.3 * u)) * (1 + (0.4 * f))) end
		elseif _sw3 == "byline_cross" then
			do return ((1 - (0.3 * u)) * (1 + (0.4 * f))) end
		elseif _sw3 == "tight_angle" then
			do return (1 - (0.2 * u)) end
		else
			do return 1 end
		end
	end
	exports.gapKindWeight = gapKindWeight
	skillKindWeight = function(kind, sk)
		if (not sk) then
			do return 1 end
		end
		local shooting = (if ((sk.power == nil) and (sk.technique == nil)) then nil else (((if sk.power ~= nil then sk.power else 50) + (if sk.technique ~= nil then sk.technique else 50)) / 2))
		local _sw4 = kind
		if _sw4 == "one_on_one" then
			do return (1 + (0.45 * lean(sk.pace))) end
		elseif _sw4 == "long_range" then
			do return (1 + (0.45 * lean(shooting))) end
		elseif _sw4 == "tight_angle" then
			do return (1 + (0.12 * lean(sk.technique))) end
		elseif _sw4 == "through_ball" then
			do return (1 + (0.4 * lean(sk.vision))) end
		elseif _sw4 == "midfield_pass" then
			do return (1 + (0.25 * lean(sk.vision))) end
		elseif _sw4 == "cutback" then
			do return (1 + (0.2 * lean(sk.vision))) end
		elseif _sw4 == "byline_cross" then
			do return (1 + (0.15 * lean(sk.vision))) end
		else
			do return 1 end
		end
	end
	exports.skillKindWeight = skillKindWeight
	weightKinds = function(kinds, state, inputs)
		local ctx = inputs.context
		local recent = state.recentKinds
		if ((not ctx) and (not (recent and Js.T(Js.alen(recent))))) then
			do return kinds end
		end
		local counts = Js.Map.new()
		do
			local _arr5 = kinds
			local _i6 = 0
			while _i6 < Js.alen(_arr5) do
				_i6 += 1
				local k = _arr5[_i6]
				counts:set(k, ((counts:get(k) or 0) + 1))
			end
		end
		if (counts.size <= 1) then
			do return kinds end
		end
		local quality = clamp1(((inputs.teamStrength - inputs.oppStrength) / 40))
		local ps = playstyleAt(ctx, state.minute)
		local rel = (function() local _v = ctx; if _v == nil then return nil end; _v = _v.teamRelationship; return _v end)()
		local out = Js.alit()
		counts:forEach(function(c, k)
			local w = 1
			if ctx then
				w *= (if PLAYSTYLE_KIND[ps][k] ~= nil then PLAYSTYLE_KIND[ps][k] else 1)
				w *= gapKindWeight(k, quality)
				w *= skillKindWeight(k, ctx.skills)
				if ((rel ~= nil) and A.includes(RECEIVED_KINDS, k)) then
					w *= clampN((1 + ((rel - 60) * 0.008)), 0.7, 1.32)
				end
			end
			if recent then
				do
					local i = 0
					local _first7 = true
					while true do
						if not _first7 then
							i += 1
						end
						_first7 = false
						if not ((i < Js.alen(recent)) and (i < Js.alen(KIND_REPEAT_WEIGHT))) then break end
						if (recent[((Js.alen(recent) - 1) - i) + 1] == k) then
							w *= KIND_REPEAT_WEIGHT[i + 1]
							do break end
						end
					end
				end
			end
			local n = Math.max(1, Math.round(((c * w) * KIND_RES)))
			for i = 0, math.ceil(n) - 1 do
				A.push(out, k)
			end
		end)
		do return out end
	end
	exports.weightKinds = weightKinds
	positionPull = function(position, zone)
		if (not Js.T(position)) then
			do return 1 end
		end
		do return ((function() local _v = POSITION_PULL[position]; if _v == nil then return nil end; _v = _v[zone]; return _v end)() or 1) end
	end
	exports.positionPull = positionPull
	lanePull = function(position, lane)
		if (not Js.T(position)) then
			do return 1 end
		end
		do return ((function() local _v = POSITION_LANE[position]; if _v == nil then return nil end; _v = _v[lane]; return _v end)() or 1) end
	end
	exports.lanePull = lanePull
	freshLine = function(state, bank, rng)
		if (not state.usedLines) then
			state.usedLines = Js.alit()
		end
		do return M_commentaryExtra.pickFresh(bank, rng, state.usedLines) end
	end
	benchConversion = function(zone)
		do return (if (zone == "box") then CONVERT_BOX else CONVERT_DEEP) end
	end
	exports.benchConversion = benchConversion
	flowCorner = function(state, attacker, rng, events, won)
		if won == nil then won = false end
		if ((not won) and (rng() >= FLOW_CORNER_FROM_SHOT)) then
			do return false end
		end
		local opp = (attacker == "opponent")
		A.push(events, Js.O({ minute = state.minute, text = freshLine(state, (if opp then CORNER_OPP else CORNER_USER), rng), isOpponent = opp, corner = true }, { "minute", "text", "isOpponent", "corner" }))
		if (rng() >= FLOW_CORNER_SHOT) then
			do return false end
		end
		if (rng() < FLOW_CORNER_CONVERT) then
			if opp then
				state.oppScore += 1
				state.momentum = clamp1((state.momentum - 0.3))
				A.push(events, Js.O({ minute = state.minute, text = "⚽ They score!", isGoal = true, shot = true }, { "minute", "text", "isGoal", "shot" }))
			else
				state.userScore += 1
				state.momentum = clamp1((state.momentum + 0.3))
				A.push(events, Js.O({ minute = state.minute, text = "⚽ Your side score!", isGoal = true, teammateGoal = true, shot = true }, { "minute", "text", "isGoal", "teammateGoal", "shot" }))
			end
			do return true end
		end
		A.push(events, Js.O({ minute = state.minute, text = freshLine(state, (if opp then CORNER_SHOT_OPP else CORNER_SHOT_USER), rng), isOpponent = opp, shot = true }, { "minute", "text", "isOpponent", "shot" }))
		do return false end
	end
	flowEndOfMove = function(state, scored, attacker, edge, rng)
		local own = (if (attacker == "user") then edge else (-edge))
		if ((not scored) and (rng() < Math.max(0.05, Math.min(0.6, (FLOW_RECYCLE + (FLOW_RECYCLE_EDGE * own)))))) then
			state.possession = attacker
			state.zone = shift(state.zone, (if (attacker == "user") then -1 else 1))
			do return end
		end
		endOfMove(state, scored, attacker)
	end
	newMatch = function(rng)
		if rng == nil then rng = Math.random end
		do return Js.O({ minute = 0, possession = (if (rng() < 0.5) then "user" else "opponent"), zone = "middle", momentum = 0, userScore = 0, oppScore = 0, sinceInvolved = 14, lane = "centre", sinceTurnover = 99, turnoverZone = "middle" }, { "minute", "possession", "zone", "momentum", "userScore", "oppScore", "sinceInvolved", "lane", "sinceTurnover", "turnoverZone" }) end
	end
	exports.newMatch = newMatch
	stepLane = function(lane, rng)
		local r = rng()
		if (r < 0.6) then
			do return lane end
		end
		local order = Js.alit("left", "centre", "right")
		local i = A.indexOf(order, lane)
		local to = (if (r < 0.8) then (i - 1) else (i + 1))
		do return order[Math.max(0, Math.min(2, to)) + 1] end
	end
	exports.stepLane = stepLane
	kindsForZone = function(zone, lane)
		if lane == nil then lane = "centre" end
		local wide = (lane ~= "centre")
		local _sw8 = zone
		if _sw8 == "box" then
			do return (if wide then Js.alit("cutback", "byline_cross", "tight_angle", "header", "volley") else Js.alit("one_on_one", "volley", "header", "tight_angle")) end
		elseif _sw8 == "attacking" then
			do return (if wide then Js.alit("byline_cross", "cutback", "through_ball", "long_range") else Js.alit("through_ball", "long_range", "one_on_one", "cutback")) end
		elseif _sw8 == "middle" then
			do return Js.alit("through_ball", "midfield_pass", "buildup", "long_range") end
		elseif _sw8 == "defensive" then
			do return Js.alit("midfield_pass", "buildup") end
		elseif _sw8 == "own_box" then
			do return Js.alit("buildup") end
		end
	end
	exports.kindsForZone = kindsForZone
	modeAt = function(inputs, minute)
		local mode = inputs.energyMode
		local at = (-math.huge)
		do
			local _arr9 = (if inputs.energyModeChanges ~= nil then inputs.energyModeChanges else Js.alit())
			local _i10 = 0
			while _i10 < Js.alen(_arr9) do
				_i10 += 1
				local c = _arr9[_i10]
				if ((c.minute <= minute) and (c.minute >= at)) then
					mode = c.mode
					at = c.minute
				end
			end
		end
		do return mode end
	end
	exports.modeAt = modeAt
	tick_ = function(state, inputs, rng)
		local u0 = state.userScore
		local o0 = state.oppScore
		local out = tickMinute(state, inputs, rng)
		if state.radarTrace then
			state.radarTrace:set(state.minute, radarTickOf(state, out.events, (not (not out.request)), u0, o0))
		end
		do return out end
	end
	exports.tick = tick_
	radarTickOf = function(state, events, yours, u0, o0)
		local t = Js.O({ minute = state.minute, possession = state.possession, zone = state.zone, lane = (if state.lane ~= nil then state.lane else "centre"), momentum = state.momentum }, { "minute", "possession", "zone", "lane", "momentum" })
		if (state.userScore > u0) then
			t.goal = "user"
		elseif (state.oppScore > o0) then
			t.goal = "opponent"
		end
		do
			local _arr11 = events
			local _i12 = 0
			while _i12 < Js.alen(_arr11) do
				_i12 += 1
				local e = _arr11[_i12]
				local side = (if e.isGoal then (if e.teammateGoal then "user" else "opponent") else (if e.isOpponent then "opponent" else "user"))
				if e.corner then
					t.corner = side
				end
				if ((e.isGoal or e.shot) or CHANCE_LINES:has(e.text)) then
					t.shot = side
				end
			end
		end
		if Js.T(t.goal) then
			t.shot = t.goal
		end
		if yours then
			t.yours = true
		end
		do return t end
	end
	tickMinute = function(state, inputs, rng)
		local events = Js.alit()
		state.minute += 1
		state.sinceInvolved += 1
		if state.missedMove then
			state.missedMove = false
			if inputs.matchFlow then
				local q = clamp1(((inputs.teamStrength - inputs.oppStrength) / 40))
				local h = (if (inputs.home == false) then (-HOME_EDGE) else (if (inputs.home == true) then HOME_EDGE else 0))
				local cornerGoal = flowCorner(state, "user", rng, events)
				state.possession = "user"
				flowEndOfMove(state, cornerGoal, "user", clamp1((q + h)), rng)
				if (state.possession == "user") then
					state.zone = "attacking"
				end
			end
		end
		state.lane = stepLane((if state.lane ~= nil then state.lane else "centre"), rng)
		state.sinceTurnover = ((if state.sinceTurnover ~= nil then state.sinceTurnover else 99) + 1)
		local quality = clamp1(((inputs.teamStrength - inputs.oppStrength) / 40))
		local home = (if (inputs.home == false) then (-HOME_EDGE) else (if (inputs.home == true) then HOME_EDGE else 0))
		local urgency = (if (state.minute < LATE_FROM) then 0 else Math.min(1, ((state.minute - LATE_FROM) / (90 - LATE_FROM))))
		local behindBy = (state.oppScore - state.userScore)
		local flow = (not (not inputs.matchFlow))
		local chase = (((if flow then (FLOW_EARLY_CHASE + ((1 - FLOW_EARLY_CHASE) * urgency)) else urgency) * clamp1((behindBy / 2))) * CHASE_EDGE)
		local lateCharge = ((((not (not inputs.fergie)) and (state.minute > inputs.fergie.from)) and (state.minute <= inputs.fergie.to)) and (((behindBy >= 1) and (behindBy <= 2)) or (((behindBy == 0) and (not (not inputs.home))) and (inputs.teamStrength > inputs.oppStrength))))
		local edge = clamp1((((quality + home) + chase) + (if lateCharge then FERGIE_EDGE else 0)))
		if (lateCharge and (not state.chargeAnnounced)) then
			state.chargeAnnounced = true
			A.push(events, Js.O({ minute = state.minute, text = "{club} throw everyone forward — even the keeper wants to go up.", isOpponent = false }, { "minute", "text", "isOpponent" }))
		end
		if (rng() < TURNOVER) then
			local userWins = (rng() < (((0.5 + (edge * (if flow then FLOW_TURNOVER_EDGE else TURNOVER_EDGE))) + (state.momentum * 0.1)) + contextRegain(state, inputs, quality)))
			local next_ = (if userWins then "user" else "opponent")
			if (next_ ~= state.possession) then
				state.possession = next_
				if (next_ == "user") then
					state.sinceTurnover = 0
					state.turnoverZone = state.zone
					state.turnoverMoved = false
				end
				if ((lateCharge and (next_ == "opponent")) and (rng() < FERGIE_COUNTER)) then
					state.zone = shift(state.zone, -2)
					if (rng() < 0.5) then
						A.push(events, Js.O({ minute = state.minute, text = COUNTER_OPP[math.floor((rng() * Js.alen(COUNTER_OPP))) + 1], isOpponent = true }, { "minute", "text", "isOpponent" }))
					end
				elseif (rng() < 0.5) then
					state.zone = shift(state.zone, (if (next_ == "user") then 1 else -1))
					if (next_ == "user") then
						state.turnoverMoved = true
					end
				end
			end
		end
		local userHasIt = (state.possession == "user")
		local dir = (if userHasIt then 1 else -1)
		local drive = (((DRIVE + ((if userHasIt then edge else (-edge)) * 0.03)) + ((if userHasIt then state.momentum else (-state.momentum)) * 0.06)) * ENTRY[shift(state.zone, dir)])
		local pushing = (lateCharge and userHasIt)
		if (rng() < (drive * (if pushing then FERGIE_PUSH else 1))) then
			state.zone = shift(state.zone, dir)
		elseif (rng() < (RETREAT * (if pushing then 0.35 else 1))) then
			state.zone = shift(state.zone, (-dir))
		end
		local attackerDanger = (if userHasIt then USER_DANGER else OPP_DANGER)
		if A.includes(attackerDanger, state.zone) then
			state.momentum += ((if ((state.zone == "box") or (state.zone == "own_box")) then 0.08 else 0.05) * dir)
		end
		state.momentum = clamp1((state.momentum * 0.94))
		local inBox = ((state.zone == "box") or (state.zone == "own_box"))
		local danger = A.includes(attackerDanger, state.zone)
		if danger then
			local rate = ((((((if inBox then CHANCE_BOX else CHANCE_DEEP) * (1 + ((if userHasIt then edge else (-edge)) * 0.1))) * (1 + (Math.max(0, (if userHasIt then state.momentum else (-state.momentum))) * 0.2))) * (if lateCharge then (if userHasIt then FERGIE_CHANCES else FERGIE_EXPOSED) else 1)) * (if ((not userHasIt) and inputs.context) then PLAYSTYLE_CONCEDE[playstyleAt(inputs.context, state.minute)] else 1)) * (if flow then flowLate(state.minute) else 1))
			local chanceRoll = rng()
			local highExtra = (if (userHasIt and ((modeAt(inputs, state.minute) == "high") or inputs.farewell)) then (rate * (HIGH_MODE_EXTRA - 1)) else 0)
			local subExtra = (if (userHasIt and inputs.lateSub) then (rate * lateSubExtra(inputs.lateSub)) else 0)
			if ((chanceRoll >= rate) and (chanceRoll < ((rate + highExtra) + subExtra))) then
				local req = buildRequest(state, rng, inputs, lateCharge)
				if req then
					state.sinceInvolved = 0
					do return Js.O({ events = events, request = req }, { "events", "request" }) end
				end
			end
			if (chanceRoll < rate) then
				if (((userHasIt and inputs.livePenalties) and (state.zone == "box")) and (rng() < PENALTY_WON_IN_BOX)) then
					do return Js.O({ events = events, request = Js.O({ zone = "box", kinds = Js.alit("penalty"), lane = "centre", pattern = "set_piece", reason = "Penalty! Brought down in the box", penaltyWon = true }, { "zone", "kinds", "lane", "pattern", "reason", "penaltyWon" }) }, { "events", "request" }) end
				end
				if userHasIt then
					local mode = modeAt(inputs, state.minute)
					local modeScale = ((if (mode == "high") then HIGH_MODE_CHANCES else (if (mode == "low") then LOW_MODE_CHANCES else 1)) * (if inputs.talisman then TALISMAN_CHANCES else 1))
					local baseInvolvement = ((((0.36 + ((inputs.playerSkill / 100) * 0.26)) + 0.08) + Math.min(0.3, (Math.max(0, (state.sinceInvolved - 10)) * 0.025))) * modeScale)
					local pulled = (((baseInvolvement * positionPull(inputs.position, state.zone)) * lanePull(inputs.position, state.lane)) * (if inputs.context then (relationshipInvolvement(inputs.context, inputs.home) * playstylePull(playstyleAt(inputs.context, state.minute), state.zone, quality)) else 1))
					local involvement = (if inputs.farewell then FAREWELL_INVOLVEMENT else (if inputs.lateSub then Math.min(0.95, (pulled * lateSubInvolvement(inputs.lateSub))) else (if inputs.impactSub then Math.min(0.92, (pulled * 1.5)) else Math.min(0.95, pulled))))
					if (rng() < involvement) then
						local req = buildRequest(state, rng, inputs, lateCharge)
						if req then
							state.sinceInvolved = 0
							do return Js.O({ events = events, request = req }, { "events", "request" }) end
						end
					end
					local scored = (rng() < (convertRate((if inBox then CONVERT_BOX else CONVERT_DEEP), rng) * (if flow then FLOW_CONVERT_SCALE else 1)))
					if scored then
						state.userScore += 1
						state.momentum = clamp1((state.momentum + 0.3))
						A.push(events, Js.ospread(Js.O({ minute = state.minute, text = "⚽ Your side score!", isGoal = true, teammateGoal = true }, { "minute", "text", "isGoal", "teammateGoal" }), (if flow then Js.O({ shot = true }, { "shot" }) else Js.O({}, nil))))
					else
						A.push(events, Js.ospread(Js.O({ minute = state.minute, text = freshLine(state, MISS_USER_ALL, rng), isOpponent = false }, { "minute", "text", "isOpponent" }), (if flow then Js.O({ shot = true }, { "shot" }) else Js.O({}, nil))))
					end
					local cornerGoal = (((not scored) and flow) and flowCorner(state, "user", rng, events))
					if flow then
						flowEndOfMove(state, (scored or cornerGoal), "user", edge, rng)
					else
						endOfMove(state, scored, "user")
					end
				else
					local scored = (rng() < (convertRate((if inBox then CONVERT_BOX else CONVERT_DEEP), rng) * (if flow then FLOW_CONVERT_SCALE else 1)))
					if scored then
						state.oppScore += 1
						state.momentum = clamp1((state.momentum - 0.3))
						A.push(events, Js.ospread(Js.O({ minute = state.minute, text = "⚽ They score!", isGoal = true }, { "minute", "text", "isGoal" }), (if flow then Js.O({ shot = true }, { "shot" }) else Js.O({}, nil))))
					else
						A.push(events, Js.ospread(Js.O({ minute = state.minute, text = freshLine(state, MISS_OPP_ALL, rng), isOpponent = true }, { "minute", "text", "isOpponent" }), (if flow then Js.O({ shot = true }, { "shot" }) else Js.O({}, nil))))
					end
					local cornerGoal = (((not scored) and flow) and flowCorner(state, "opponent", rng, events))
					if flow then
						flowEndOfMove(state, (scored or cornerGoal), "opponent", edge, rng)
					else
						endOfMove(state, scored, "opponent")
					end
				end
				do return Js.O({ events = events, request = nil }, { "events", "request" }) end
			end
			if (flow and (rng() < ((if inBox then FLOW_SPEC_BOX else FLOW_SPEC_DEEP) * flowLate(state.minute)))) then
				local attacker = (if userHasIt then "user" else "opponent")
				local opp = (not userHasIt)
				if (rng() < (if inBox then FLOW_SPEC_CONVERT_BOX else FLOW_SPEC_CONVERT_DEEP)) then
					if opp then
						state.oppScore += 1
						state.momentum = clamp1((state.momentum - 0.3))
						A.push(events, Js.O({ minute = state.minute, text = "⚽ They score!", isGoal = true, shot = true }, { "minute", "text", "isGoal", "shot" }))
					else
						state.userScore += 1
						state.momentum = clamp1((state.momentum + 0.3))
						A.push(events, Js.O({ minute = state.minute, text = "⚽ Your side score!", isGoal = true, teammateGoal = true, shot = true }, { "minute", "text", "isGoal", "teammateGoal", "shot" }))
					end
					endOfMove(state, true, attacker)
					do return Js.O({ events = events, request = nil }, { "events", "request" }) end
				end
				A.push(events, Js.O({ minute = state.minute, text = freshLine(state, (if opp then SPEC_OPP else SPEC_USER), rng), isOpponent = opp, shot = true }, { "minute", "text", "isOpponent", "shot" }))
				local cornerGoal = flowCorner(state, attacker, rng, events)
				if (cornerGoal or (rng() >= FLOW_SPEC_KEEP)) then
					flowEndOfMove(state, cornerGoal, attacker, edge, rng)
				end
				do return Js.O({ events = events, request = nil }, { "events", "request" }) end
			end
			if (flow and (rng() < FLOW_CORNER_OPEN)) then
				local attacker = (if userHasIt then "user" else "opponent")
				local cornerGoal = flowCorner(state, attacker, rng, events, true)
				flowEndOfMove(state, cornerGoal, attacker, edge, rng)
				do return Js.O({ events = events, request = nil }, { "events", "request" }) end
			end
		end
		if ((((inputs.deepTouches and userHasIt) and ((state.zone == "middle") or (state.zone == "attacking"))) and (state.sinceInvolved >= DEEP_TOUCH_GAP)) and (rng() < (DEEP_TOUCH * (DEEP_TOUCH_PULL[(if inputs.position ~= nil then inputs.position else "")] or 1)))) then
			state.sinceInvolved = 0
			local lane = (if state.lane ~= nil then state.lane else "centre")
			do return Js.O({ events = events, request = Js.O({ zone = state.zone, kinds = weightKinds(kindsForZone(state.zone, lane), state, inputs), lane = lane, pattern = "settled", reason = (if (state.zone == "middle") then "You drop off into midfield and get on the ball" else "You find a pocket and the ball comes to you") }, { "zone", "kinds", "lane", "pattern", "reason" }) }, { "events", "request" }) end
		end
		local style = (if inputs.context then playstyleAt(inputs.context, state.minute) else "balanced")
		if ((((style == "defensive") and userHasIt) and ((state.zone == "middle") or (state.zone == "defensive"))) and (rng() < ((DEF_DROP_RATE * (1 + (DEF_UNDERDOG * Math.max(0, (-quality))))) * relationshipInvolvement(inputs.context, inputs.home)))) then
			state.sinceInvolved = 0
			local lane = (if state.lane ~= nil then state.lane else "centre")
			do return Js.O({ events = events, request = Js.O({ zone = state.zone, kinds = weightKinds(kindsForZone(state.zone, lane), state, inputs), lane = lane, pattern = "settled", reason = "You drop deep and get on the ball" }, { "zone", "kinds", "lane", "pattern", "reason" }) }, { "events", "request" }) end
		end
		if (((userHasIt and (state.sinceInvolved >= STARVED_MIN)) and (state.zone ~= "own_box")) and (rng() < ((0.45 * positionPull(inputs.position, state.zone)) * (if (style == "attacking") then ATT_STARVE else 1)))) then
			state.sinceInvolved = 0
			do return Js.O({ events = events, request = Js.O({ zone = state.zone, kinds = weightKinds(kindsForZone(state.zone), state, inputs), reason = "You drop in and demand the ball" }, { "zone", "kinds", "reason" }) }, { "events", "request" }) end
		end
		if (rng() < 0.22) then
			local bank = (if userHasIt then QUIET_USER_ALL else QUIET_OPP_ALL)
			A.push(events, Js.O({ minute = state.minute, text = freshLine(state, bank, rng), isOpponent = (not userHasIt) }, { "minute", "text", "isOpponent" }))
		end
		do return Js.O({ events = events, request = nil }, { "events", "request" }) end
	end
	contextRegain = function(state, inputs, quality)
		local ctx = inputs.context
		if (not ctx) then
			do return 0 end
		end
		local regaining = (state.possession == "opponent")
		local t = (quality * (if regaining then GAP_REGAIN else GAP_KEEP))
		if regaining then
			t += PLAYSTYLE_REGAIN[playstyleAt(ctx, state.minute)]
			if ((inputs.home == true) and (ctx.fanRelationship ~= nil)) then
				t += (lean(ctx.fanRelationship) * FAN_REGAIN)
			end
		end
		do return t end
	end
	endOfMove = function(state, scored, attacker)
		state.possession = (if (attacker == "user") then "opponent" else "user")
		if scored then
			state.zone = "middle"
		end
	end
	buildRequest = function(state, rng, inputs, lateCharge)
		if lateCharge == nil then lateCharge = false end
		if ((state.zone == "middle") or (state.zone == "attacking")) then
			local quick = Math.max(0, Math.min(1, ((if inputs.pace ~= nil then inputs.pace else 50) / 100)))
			local dribbleBias = (if Js.T(inputs.position) then (if POSITION_DRIBBLE[inputs.position] ~= nil then POSITION_DRIBBLE[inputs.position] else 1) else 1)
			if (rng() < ((DRIBBLE_CHANCE * (0.7 + (quick * 0.6))) * dribbleBias)) then
				do return Js.O({ zone = state.zone, kinds = Js.alit("one_on_one"), dribble = true, reason = "You pick it up with space to run into" }, { "zone", "kinds", "dribble", "reason" }) end
			end
		end
		local SET_PIECE_DUTY = Js.O({ ST = Js.O({ penalty = 5, free_kick = 3, corner = 2 }, { "penalty", "free_kick", "corner" }), CAM = Js.O({ penalty = 3, free_kick = 5, corner = 2 }, { "penalty", "free_kick", "corner" }), LW = Js.O({ penalty = 2, free_kick = 3, corner = 6 }, { "penalty", "free_kick", "corner" }), RW = Js.O({ penalty = 2, free_kick = 3, corner = 6 }, { "penalty", "free_kick", "corner" }), CM = Js.O({ penalty = 2, free_kick = 6, corner = 4 }, { "penalty", "free_kick", "corner" }), LM = Js.O({ penalty = 2, free_kick = 4, corner = 6 }, { "penalty", "free_kick", "corner" }), RM = Js.O({ penalty = 2, free_kick = 4, corner = 6 }, { "penalty", "free_kick", "corner" }), CDM = Js.O({ penalty = 2, free_kick = 6, corner = 3 }, { "penalty", "free_kick", "corner" }), CB = Js.O({ penalty = 1, free_kick = 3, corner = 8 }, { "penalty", "free_kick", "corner" }), LB = Js.O({ penalty = 1, free_kick = 3, corner = 8 }, { "penalty", "free_kick", "corner" }), RB = Js.O({ penalty = 1, free_kick = 3, corner = 8 }, { "penalty", "free_kick", "corner" }), GK = Js.O({ penalty = 0, free_kick = 0, corner = 1 }, { "penalty", "free_kick", "corner" }) }, { "ST", "CAM", "LW", "RW", "CM", "LM", "RM", "CDM", "CB", "LB", "RB", "GK" })
		local DEFAULT_DUTY = Js.O({ penalty = 3, free_kick = 5, corner = 6 }, { "penalty", "free_kick", "corner" })
		local takesIt = function(kind)
			if ((kind == "corner") and (inputs.canTakeCorners == false)) then
				do return false end
			end
			if (not Js.T(inputs.position)) then
				do return true end
			end
			if inputs.farewell then
				do return true end
			end
			local w = (if SET_PIECE_DUTY[inputs.position] ~= nil then SET_PIECE_DUTY[inputs.position] else DEFAULT_DUTY)[kind]
			local fk = inputs.freeKick
			local taker = (if ((kind == "penalty") or (fk == nil)) then 1 else Math.max(0.7, (1 + (((Math.min(100, Math.max(0, fk)) - 40) / 60) * 0.5))))
			do return (rng() < Math.max(0.15, Math.min(0.9, ((w / 8) * taker)))) end
		end
		local lane = (if state.lane ~= nil then state.lane else "centre")
		if (((not inputs.livePenalties) and (state.zone == "box")) and (rng() < 0.085)) then
			do return (if takesIt("penalty") then Js.O({ zone = state.zone, kinds = Js.alit("penalty"), lane = "centre", pattern = "set_piece", reason = "You are brought down in the box — penalty" }, { "zone", "kinds", "lane", "pattern", "reason" }) else nil) end
		end
		if ((state.zone == "attacking") and (rng() < 0.215)) then
			do return (if takesIt("free_kick") then Js.O({ zone = state.zone, kinds = Js.alit("free_kick"), lane = lane, pattern = "set_piece", reason = "Fouled on the edge of the area" }, { "zone", "kinds", "lane", "pattern", "reason" }) else nil) end
		end
		if (((state.zone == "attacking") or (state.zone == "box")) and (rng() < 0.16)) then
			do return (if takesIt("corner") then Js.O({ zone = state.zone, kinds = Js.alit("corner"), lane = lane, pattern = "set_piece", reason = "The cross is turned behind — corner" }, { "zone", "kinds", "lane", "pattern", "reason" }) else nil) end
		end
		local advanced = (A.indexOf(ZONE_ORDER, state.zone) - A.indexOf(ZONE_ORDER, (if state.turnoverZone ~= nil then state.turnoverZone else state.zone)))
		local pattern = (if ((((if state.sinceTurnover ~= nil then state.sinceTurnover else 99) <= 2) and (advanced >= 1)) and (rng() < 0.55)) then "transition" else "settled")
		local launched = ((lateCharge and (state.zone ~= "box")) and (rng() < FERGIE_BOX))
		local kinds = kindsForZone((if launched then shift(state.zone, 1) else state.zone), lane)
		local chasing = ((state.minute >= 60) and (state.userScore < state.oppScore))
		local lowBlock = ((inputs.teamStrength - inputs.oppStrength) >= 15)
		if ((chasing or lowBlock) and A.includes(kinds, "long_range")) then
			A.push(kinds, "long_range")
		end
		do return Js.ospread(Js.O({ zone = state.zone, kinds = weightKinds(kinds, state, inputs), lane = lane, pattern = pattern, regain = Js.O({ zone = (if state.turnoverZone ~= nil then state.turnoverZone else state.zone), ago = (if state.sinceTurnover ~= nil then state.sinceTurnover else 99), moved = (not (not state.turnoverMoved)) }, { "zone", "ago", "moved" }) }, { "zone", "kinds", "lane", "pattern", "regain" }), (if lateCharge then Js.O({ lateCharge = true }, { "lateCharge" }) else Js.O({}, nil)), Js.O({ reason = (if lateCharge then "Everyone forward — it's launched into the box" else (if (pattern == "transition") then "They lose it — you break on them" else (if (state.momentum > 0.35) then "Sustained pressure — you find space" else (if (state.zone == "box") then "The ball breaks to you in the area" else "The move works its way to you")))) }, { "reason" })) end
	end
	resolveScenario = function(state, result)
		if (result == "goal") then
			state.userScore += 1
			state.momentum = clamp1((state.momentum + 0.3))
			endOfMove(state, true, "user")
		elseif (result == "delivered") then
			state.momentum = clamp1((state.momentum + 0.08))
			state.zone = shift(state.zone, 1)
		else
			state.momentum = clamp1((state.momentum - (if (result == "lost") then 0.1 else 0.05)))
			endOfMove(state, false, "user")
			if A.includes(USER_DANGER, state.zone) then
				state.missedMove = true
			end
		end
		local t = (function() local _r = state.radarTrace; if _r == nil then return nil end; return _r:get(state.minute) end)()
		if t then
			t.possession = state.possession
			t.zone = state.zone
			t.momentum = state.momentum
			if (result == "goal") then
				t.goal = "user"
				t.shot = "user"
			elseif ((result == "saved") and (not Js.T(t.shot))) then
				t.shot = "user"
			end
		end
	end
	exports.resolveScenario = resolveScenario
	advanceTo = function(state, inputs, rng, minute)
		local events = Js.alit()
		while (state.minute < minute) do
			local step = tick_(state, inputs, rng)
			A.push(events, Js.unpack(step.events))
			if step.request then
				if step.request.penaltyWon then
					local scored = (rng() < M_penaltyTaking.OFF_PITCH_PEN_CONVERT)
					A.push(events, (if scored then Js.O({ minute = state.minute, text = "⚽ Your side score the penalty!", isGoal = true, teammateGoal = true }, { "minute", "text", "isGoal", "teammateGoal" }) else Js.O({ minute = state.minute, text = "A penalty for your side — saved!", isOpponent = false }, { "minute", "text", "isOpponent" })))
					resolveScenario(state, (if scored then "goal" else "saved"))
					do continue end
				end
				local inBox = (step.request.zone == "box")
				local scored = (rng() < (if inBox then CONVERT_BOX else CONVERT_DEEP))
				if scored then
					A.push(events, Js.O({ minute = state.minute, text = "⚽ Your side score!", isGoal = true, teammateGoal = true }, { "minute", "text", "isGoal", "teammateGoal" }))
				end
				resolveScenario(state, (if scored then "goal" else "saved"))
			end
		end
		do return events end
	end
	exports.advanceTo = advanceTo
	gateMechanics = function(state, inputs, req)
		local m = inputs.mechanics
		local style = (if inputs.context then playstyleAt(inputs.context, state.minute) else nil)
		if (Js.T(style) or (m and (not m.air))) then
			req = Js.ospread(req, Js.O({ deal = Js.O({ style = style, exclude = (if (m and (not m.air)) then AIR_KINDS else nil) }, { "style", "exclude" }) }, { "deal" }))
		end
		if (not m) then
			do return req end
		end
		local out = req
		if ((not m.dribble) and out.dribble) then
			out = Js.ospread(out, Js.O({ dribble = false }, { "dribble" }))
		end
		local setPiece = ((Js.alen(out.kinds) > 0) and A.every(out.kinds, function(k)
			return A.includes(SET_PIECES, k)
		end))
		if (not m.air) then
			if A.some(out.kinds, function(k)
				return A.includes(AIR_KINDS, k)
			end) then
				local rest = A.filter(out.kinds, function(k)
					return (not A.includes(AIR_KINDS, k))
				end)
				out = Js.ospread(out, Js.O({ kinds = (if Js.T(Js.alen(rest)) then rest else Js.alit("one_on_one")) }, { "kinds" }))
			end
			do return out end
		end
		if (m.airIntro and (not setPiece)) then
			local served = (if state.airServed ~= nil then state.airServed else Js.O({}, nil))
			local next_ = (if (not served.header) then "header" else (if (not served.volley) then "volley" else nil))
			local nearGoal = ((out.zone == "box") or (out.zone == "attacking"))
			local late = (if (next_ == "header") then (state.minute >= AIR_INTRO_BY[1]) else (state.minute >= AIR_INTRO_BY[2]))
			if (Js.T(next_) and (nearGoal or late)) then
				state.airServed = Js.ospread(served, (function() local _o = Js.O({}, nil); _o[Js.key(next_)] = true; return _o end)())
				out = Js.ospread(out, Js.O({ zone = "box", kinds = Js.alit(next_), dribble = false }, { "zone", "kinds", "dribble" }))
			end
		end
		do return out end
	end
	advanceUntilInvolved = function(state, inputs, rng, fullTime)
		local events = Js.alit()
		local counted = function(request)
			local h = halfOf(state.minute)
			if (h ~= nil) then
				local hc = (if state.halfChances ~= nil then state.halfChances else Js.alit(0, 0))
				A.set(hc, h, hc[h + 1] + 1)
				state.halfChances = hc
			end
			do return gateMechanics(state, inputs, request) end
		end
		while (state.minute < fullTime) do
			local step = tick_(state, inputs, rng)
			A.push(events, Js.unpack(step.events))
			if step.request then
				do return Js.O({ events = events, request = counted(step.request), fullTime = false }, { "events", "request", "fullTime" }) end
			end
			local h = halfOf(state.minute)
			local mode = (modeAt(inputs, state.minute) or "medium")
			if ((((((h ~= nil) and (mode ~= "low")) and (not inputs.farewell)) and ((if state.halfChances ~= nil then state.halfChances else Js.alit(0, 0))[h + 1] == 0)) and (state.minute >= HALF_GUARANTEE_AT[h + 1])) and (fullTime > state.minute)) then
				local request = halfGuaranteeChance(state, rng)
				local t = (function() local _r = state.radarTrace; if _r == nil then return nil end; return _r:get(state.minute) end)()
				if t then
					Js.Object.assign(t, Js.O({ yours = true, possession = state.possession, zone = state.zone }, { "yours", "possession", "zone" }))
				end
				do return Js.O({ events = events, request = counted(request), fullTime = false }, { "events", "request", "fullTime" }) end
			end
			if (((function() local _v = inputs.mechanics; if _v == nil then return nil end; _v = _v.air; return _v end)() and inputs.mechanics.airIntro) and (h ~= nil)) then
				local served = (if state.airServed ~= nil then state.airServed else Js.O({}, nil))
				local due = (if (not served.header) then AIR_INTRO_BY[1] else (if (not served.volley) then AIR_INTRO_BY[2] else math.huge))
				if ((state.minute >= due) and (fullTime > state.minute)) then
					local request = halfGuaranteeChance(state, rng)
					local t = (function() local _r = state.radarTrace; if _r == nil then return nil end; return _r:get(state.minute) end)()
					if t then
						Js.Object.assign(t, Js.O({ yours = true, possession = state.possession, zone = state.zone }, { "yours", "possession", "zone" }))
					end
					do return Js.O({ events = events, request = counted(request), fullTime = false }, { "events", "request", "fullTime" }) end
				end
			end
			local owed = ((function() local _v = inputs.lateSub; if _v == nil then return nil end; _v = _v.owed; return _v end)() or 0)
			if ((owed > 0) and ((fullTime - state.minute) < (owed * LATE_SUB_FORCE_GAP))) then
				local request = lateSubChance(state, rng)
				local t = (function() local _r = state.radarTrace; if _r == nil then return nil end; return _r:get(state.minute) end)()
				if t then
					Js.Object.assign(t, Js.O({ yours = true, possession = state.possession, zone = state.zone }, { "yours", "possession", "zone" }))
				end
				do return Js.O({ events = events, request = counted(request), fullTime = false }, { "events", "request", "fullTime" }) end
			end
		end
		do return Js.O({ events = events, request = nil, fullTime = true }, { "events", "request", "fullTime" }) end
	end
	exports.advanceUntilInvolved = advanceUntilInvolved
	halfOf = function(minute)
		do return (if (minute < 45) then 0 else (if (minute < 90) then 1 else nil)) end
	end
	halfGuaranteeChance = function(state, rng)
		state.possession = "user"
		local zone = (if (rng() < 0.5) then "box" else "attacking")
		state.zone = zone
		state.sinceInvolved = 0
		local lane = (if state.lane ~= nil then state.lane else "centre")
		do return Js.O({ zone = zone, kinds = kindsForZone(zone, lane), lane = lane, pattern = "transition", reason = "The ball finally breaks your way" }, { "zone", "kinds", "lane", "pattern", "reason" }) end
	end
	lateSubChance = function(state, rng)
		state.possession = "user"
		local zone = (if (rng() < 0.6) then "box" else "attacking")
		state.zone = zone
		state.sinceInvolved = 0
		local lane = (if state.lane ~= nil then state.lane else "centre")
		do return Js.O({ zone = zone, kinds = kindsForZone(zone, lane), lane = lane, pattern = "transition", reason = "Fresh legs — the sub finds space late on" }, { "zone", "kinds", "lane", "pattern", "reason" }) end
	end
	HIGH_MODE_CHANCES = M_tuningStore.getTuning("energy.highModeChances")
	LOW_MODE_CHANCES = M_tuningStore.getTuning("energy.lowModeChances")
	HIGH_MODE_EXTRA = M_tuningStore.getTuning("energy.highModeExtraChances")
	TALISMAN_CHANCES = 2.2
	FAREWELL_INVOLVEMENT = 0.97
	exports.FAREWELL_INVOLVEMENT = FAREWELL_INVOLVEMENT
	LATE_SUB_GUARANTEE_FROM = 70
	exports.LATE_SUB_GUARANTEE_FROM = LATE_SUB_GUARANTEE_FROM
	LATE_SUB_INVOLVEMENT = 1.6
	exports.LATE_SUB_INVOLVEMENT = LATE_SUB_INVOLVEMENT
	LATE_SUB_EXTRA = 2.5
	exports.LATE_SUB_EXTRA = LATE_SUB_EXTRA
	LATE_SUB_FORCE_GAP = 2
	exports.LATE_SUB_FORCE_GAP = LATE_SUB_FORCE_GAP
	ZONE_ORDER = Js.alit("own_box", "defensive", "middle", "attacking", "box")
	USER_DANGER = Js.alit("attacking", "box")
	OPP_DANGER = Js.alit("defensive", "own_box")
	GAP_REGAIN = M_tuningStore.getTuning("context.gapRegain")
	exports.GAP_REGAIN = GAP_REGAIN
	GAP_KEEP = 0.04
	TEAM_REL_INVOLVE = M_tuningStore.getTuning("context.teamRelInvolve")
	exports.TEAM_REL_INVOLVE = TEAM_REL_INVOLVE
	FAN_INVOLVE = 0.06
	exports.FAN_INVOLVE = FAN_INVOLVE
	FAN_REGAIN = 0.02
	PLAYSTYLE_CONCEDE = Js.O({ defensive = M_tuningStore.getTuning("context.defensiveConcede"), balanced = 1, attacking = M_tuningStore.getTuning("context.attackingConcede") }, { "defensive", "balanced", "attacking" })
	exports.PLAYSTYLE_CONCEDE = PLAYSTYLE_CONCEDE
	PLAYSTYLE_REGAIN = Js.O({ defensive = 0.03, balanced = 0, attacking = -0.02 }, { "defensive", "balanced", "attacking" })
	PLAYSTYLE_PULL = Js.O({ defensive = Js.O({ own_box = 1.3, defensive = 1.3, middle = 1.3, attacking = 0.95, box = 0.72 }, { "own_box", "defensive", "middle", "attacking", "box" }), balanced = Js.O({ own_box = 1, defensive = 1, middle = 1, attacking = 1, box = 1 }, { "own_box", "defensive", "middle", "attacking", "box" }), attacking = Js.O({ own_box = 0.5, defensive = 0.5, middle = 0.7, attacking = 1.08, box = 1.3 }, { "own_box", "defensive", "middle", "attacking", "box" }) }, { "defensive", "balanced", "attacking" })
	DEF_UNDERDOG = 0.8
	DEF_DROP_RATE = M_tuningStore.getTuning("context.defensiveDropRate")
	exports.DEF_DROP_RATE = DEF_DROP_RATE
	ATT_STARVE = 0.6
	PLAYSTYLE_KIND = Js.O({ defensive = Js.O({ buildup = 1.6, midfield_pass = 1.8, through_ball = 1.5, long_range = 1.5, one_on_one = 0.6, tight_angle = 0.55, cutback = 0.8, byline_cross = 1.6 }, { "buildup", "midfield_pass", "through_ball", "long_range", "one_on_one", "tight_angle", "cutback", "byline_cross" }), balanced = Js.O({}, nil), attacking = Js.O({ one_on_one = 1.7, cutback = 1.5, byline_cross = 0.3, tight_angle = 1.1, buildup = 0.45, midfield_pass = 0.45, long_range = 0.7, through_ball = 0.75 }, { "one_on_one", "cutback", "byline_cross", "tight_angle", "buildup", "midfield_pass", "long_range", "through_ball" }) }, { "defensive", "balanced", "attacking" })
	exports.PLAYSTYLE_KIND = PLAYSTYLE_KIND
	RECEIVED_KINDS = Js.alit("one_on_one", "tight_angle")
	RECENT_KINDS = 2
	exports.RECENT_KINDS = RECENT_KINDS
	KIND_REPEAT_WEIGHT = Js.alit(0.3, 0.7)
	exports.KIND_REPEAT_WEIGHT = KIND_REPEAT_WEIGHT
	KIND_RES = 8
	clampN = function(n, lo, hi)
		return Math.max(lo, Math.min(hi, n))
	end
	lean = function(v)
		return (if (v == nil) then 0 else clampN(((v - 50) / 50), -1, 1))
	end
	PENALTY_WON_IN_BOX = 0.029
	exports.PENALTY_WON_IN_BOX = PENALTY_WON_IN_BOX
	HOME_EDGE = 0.16
	LATE_FROM = 62
	CHASE_EDGE = 0.3
	FERGIE_EDGE = 0.25
	FERGIE_PUSH = 1.6
	FERGIE_CHANCES = 1.7
	FERGIE_BOX = 0.6
	FERGIE_COUNTER = 0.6
	FERGIE_EXPOSED = 1.8
	COUNTER_OPP = Js.alit("They break — too many men caught up the pitch!", "A counter! Three on two, and nobody back.", "Caught with everyone forward — they're away.")
	TURNOVER = 0.55
	TURNOVER_EDGE = 0.3
	DRIVE = 0.46
	RETREAT = 0.28
	ENTRY = Js.O({ own_box = 0.35, defensive = 0.75, middle = 1, attacking = 0.75, box = 0.35 }, { "own_box", "defensive", "middle", "attacking", "box" })
	CHANCE_DEEP = 0.26
	CHANCE_BOX = 0.55
	STARVED_MIN = 20
	DEEP_TOUCH = 0.24
	exports.DEEP_TOUCH = DEEP_TOUCH
	DEEP_TOUCH_GAP = 3
	DEEP_TOUCH_PULL = Js.O({ ST = 1, CAM = 1.2, LW = 1.05, RW = 1.05 }, { "ST", "CAM", "LW", "RW" })
	DRIBBLE_CHANCE = 0.26
	POSITION_PULL = Js.O({ ST = Js.O({ own_box = 0.15, defensive = 0.25, middle = 0.45, attacking = 1.05, box = 1.35 }, { "own_box", "defensive", "middle", "attacking", "box" }), CAM = Js.O({ own_box = 0.35, defensive = 0.6, middle = 1, attacking = 1.15, box = 1 }, { "own_box", "defensive", "middle", "attacking", "box" }), LW = Js.O({ own_box = 0.3, defensive = 0.55, middle = 0.85, attacking = 1.2, box = 1 }, { "own_box", "defensive", "middle", "attacking", "box" }), RW = Js.O({ own_box = 0.3, defensive = 0.55, middle = 0.85, attacking = 1.2, box = 1 }, { "own_box", "defensive", "middle", "attacking", "box" }) }, { "ST", "CAM", "LW", "RW" })
	exports.POSITION_PULL = POSITION_PULL
	POSITION_LANE = Js.O({ ST = Js.O({ left = 0.7, centre = 1.5, right = 0.7 }, { "left", "centre", "right" }), CAM = Js.O({ left = 0.8, centre = 1.4, right = 0.8 }, { "left", "centre", "right" }), LW = Js.O({ left = 1.65, centre = 0.8, right = 0.35 }, { "left", "centre", "right" }), RW = Js.O({ left = 0.35, centre = 0.8, right = 1.65 }, { "left", "centre", "right" }) }, { "ST", "CAM", "LW", "RW" })
	exports.POSITION_LANE = POSITION_LANE
	POSITION_DRIBBLE = Js.O({ ST = 0.6, CAM = 0.95, LW = 1.5, RW = 1.5 }, { "ST", "CAM", "LW", "RW" })
	exports.POSITION_DRIBBLE = POSITION_DRIBBLE
	CONVERT_DEEP = 0.09
	CONVERT_BOX = 0.16
	QUALITY_CHANCE = 0.16
	QUALITY_CONVERT = 0.36
	convertRate = function(base, rng)
		return (if (rng() < QUALITY_CHANCE) then QUALITY_CONVERT else base)
	end
	QUIET_USER = Js.alit("{club} work it patiently across the back.", "A good spell of possession for {club}.", "Play is switched to {club}'s far side, still looking for the gap.", "The tempo drops, but {club} keep the ball moving.", "A long ball forward for {club} is headed clear.", "{club} have the better of this spell.", "A promising move for {club} breaks down in the middle.", "{club}'s fans try to lift the team.")
	QUIET_OPP = Js.alit("They work it patiently across the back.", "A good spell of possession for them.", "Play is switched to their far side, still looking for the gap.", "The tempo drops, but they keep the ball moving.", "A long ball forward for them is headed clear.", "They have the better of this spell.", "A promising move for them breaks down in the middle.", "Their fans try to lift the team.")
	MISS_USER = Js.alit("A chance at the far post for {club} — headed over.", "A shot from the edge for {club} is blocked.", "{club} force a smart save from the keeper.", "An effort from {club} flies wide of the far post.", "{club} crash a shot back off the crossbar.", "A goal-bound effort from {club} is cleared off the line.", "{club} can't quite direct a header on target.", "The keeper gets down well to smother {club}'s effort.")
	MISS_OPP = Js.alit("They work a chance — the keeper holds it.", "A shot from distance flies wide.", "They force a good save from your keeper.", "An effort from the edge of the box drifts just wide.", "They crash a shot back off the crossbar.", "A goal-bound effort is cleared off the line.", "They can't quite direct a header on target.", "Your keeper gets down well to smother their effort.")
	QUIET_USER_ALL = Js.aspread(QUIET_USER, M_commentaryExtra.EXTRA_QUIET_USER)
	QUIET_OPP_ALL = Js.aspread(QUIET_OPP, M_commentaryExtra.EXTRA_QUIET_OPP)
	MISS_USER_ALL = Js.aspread(MISS_USER, M_commentaryExtra.EXTRA_MISS_USER)
	MISS_OPP_ALL = Js.aspread(MISS_OPP, M_commentaryExtra.EXTRA_MISS_OPP)
	CHANCE_LINES = Js.Set.new(Js.aspread(MISS_USER_ALL, MISS_OPP_ALL))
	exports.CHANCE_LINES = CHANCE_LINES
	FLOW_TURNOVER_EDGE = 0.3
	exports.FLOW_TURNOVER_EDGE = FLOW_TURNOVER_EDGE
	FLOW_EARLY_CHASE = 0.4
	exports.FLOW_EARLY_CHASE = FLOW_EARLY_CHASE
	FLOW_LATE_FROM = 0.7
	exports.FLOW_LATE_FROM = FLOW_LATE_FROM
	FLOW_LATE_SPAN = 0.6
	exports.FLOW_LATE_SPAN = FLOW_LATE_SPAN
	flowLate = function(minute)
		return (FLOW_LATE_FROM + (FLOW_LATE_SPAN * Math.min(1, (minute / 90))))
	end
	exports.flowLate = flowLate
	FLOW_SPEC_DEEP = 0.4
	exports.FLOW_SPEC_DEEP = FLOW_SPEC_DEEP
	FLOW_SPEC_BOX = 0.55
	exports.FLOW_SPEC_BOX = FLOW_SPEC_BOX
	FLOW_SPEC_CONVERT_DEEP = 0.03
	exports.FLOW_SPEC_CONVERT_DEEP = FLOW_SPEC_CONVERT_DEEP
	FLOW_SPEC_CONVERT_BOX = 0.07
	exports.FLOW_SPEC_CONVERT_BOX = FLOW_SPEC_CONVERT_BOX
	FLOW_CORNER_FROM_SHOT = 0.45
	exports.FLOW_CORNER_FROM_SHOT = FLOW_CORNER_FROM_SHOT
	FLOW_CORNER_SHOT = 0.3
	exports.FLOW_CORNER_SHOT = FLOW_CORNER_SHOT
	FLOW_CORNER_CONVERT = 0.09
	exports.FLOW_CORNER_CONVERT = FLOW_CORNER_CONVERT
	FLOW_SPEC_KEEP = 0.6
	exports.FLOW_SPEC_KEEP = FLOW_SPEC_KEEP
	FLOW_RECYCLE = 0.3
	exports.FLOW_RECYCLE = FLOW_RECYCLE
	FLOW_RECYCLE_EDGE = 0.3
	exports.FLOW_RECYCLE_EDGE = FLOW_RECYCLE_EDGE
	FLOW_CORNER_OPEN = 0.16
	exports.FLOW_CORNER_OPEN = FLOW_CORNER_OPEN
	FLOW_CONVERT_SCALE = 0.92
	exports.FLOW_CONVERT_SCALE = FLOW_CONVERT_SCALE
	SPEC_USER = Js.alit("{club} try their luck from 25 yards — over the bar.", "A low drive from {club} is blocked.", "{club} shoot from distance — straight at the keeper.", "A snap-shot from {club} skews wide.", "{club} get a shot away, but it's charged down.", "A curler from {club} drifts past the post.")
	SPEC_OPP = Js.alit("They try their luck from 25 yards — over the bar.", "A low drive from them is blocked.", "They shoot from distance — straight at your keeper.", "A snap-shot from them skews wide.", "They get a shot away, but it's charged down.", "A curler from them drifts past the post.")
	CORNER_USER = Js.alit("Corner to {club}.", "{club} win a corner.", "Turned behind — {club} have a corner.")
	CORNER_OPP = Js.alit("Corner to them.", "They win a corner.", "Turned behind — a corner to them.")
	CORNER_SHOT_USER = Js.alit("{club}'s corner is met — headed over.", "A flick-on from {club}'s corner drifts wide.", "{club} get a head to the corner — the keeper gathers.")
	CORNER_SHOT_OPP = Js.alit("Their corner is met — headed over.", "A flick-on from their corner drifts wide.", "They get a head to the corner — your keeper gathers.")
	shift = function(zone, by)
		local i = A.indexOf(ZONE_ORDER, zone)
		do return ZONE_ORDER[Math.max(0, Math.min((Js.alen(ZONE_ORDER) - 1), (i + by))) + 1] end
	end
	clamp1 = function(n)
		return Math.max(-1, Math.min(1, n))
	end
	AIR_KINDS = Js.alit("header", "volley")
	SET_PIECES = Js.alit("penalty", "free_kick", "corner")
	AIR_INTRO_BY = Js.alit(60, 80)
	HALF_GUARANTEE_AT = Js.alit(43, 88)
end
