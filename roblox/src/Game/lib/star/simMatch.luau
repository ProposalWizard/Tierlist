--!nocheck
--!nolint
-- Generated from lib/star/simMatch.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_season = import("lib/star/season")
	local M_addedTime = import("lib/star/addedTime")
	local M_matchInputs = import("lib/star/matchInputs")
	local M_energy = import("lib/star/energy")
	local M_hiddenMatch = import("lib/star/hiddenMatch")
	local M_teamsheet = import("lib/star/teamsheet")
	local M_squadData = import("lib/star/squadData")
	local M_selection = import("lib/star/selection")
	local M_scenarioSelect = import("lib/star/scenarioSelect")
	local M_canvasEngine = import("lib/star/canvasEngine")
	local M_giveAndGo = import("lib/star/giveAndGo")
	local M_switchedOffKinds = import("lib/star/switchedOffKinds")
	local M_matchStats = import("lib/star/matchStats")
	local M_firstPersonDribble = import("lib/star/firstPersonDribble")
	local M_pitch = import("lib/star/pitch")
	local simOdds, SIM_RUN_CLEARED, simulateOwnMatch
	simOdds = function(kind, s, keeper)
		if keeper == nil then keeper = 83 end
		local shotQ = ((s.power + s.technique) / 200)
		local passQ = ((s.technique + s.vision) / 200)
		local k = Math.max(0.9, Math.min(1.1, (1 + ((83 - keeper) * 0.003))))
		local shot = function(goal, assist)
			return Js.O({ shot = true, goal = (goal * k), assist = (assist * k) }, { "shot", "goal", "assist" })
		end
		local _sw1 = kind
		if _sw1 == "penalty" then
			do return shot(0.65, 0.02) end
		elseif _sw1 == "one_on_one" then
			do return shot(0.38, 0.19) end
		elseif _sw1 == "tight_angle" then
			do return shot((0.1 + (0.08 * shotQ)), 0.13) end
		elseif _sw1 == "long_range" then
			do return shot((0.042 + (0.069 * shotQ)), (0.045 + (0.04 * shotQ))) end
		elseif _sw1 == "free_kick" then
			do return shot(Math.max(0.02, Math.min(0.2, (0.05 + (0.23 * (shotQ - 0.5))))), 0) end
		elseif _sw1 == "volley" then
			do return shot((0.1 + (0.2 * shotQ)), 0) end
		elseif _sw1 == "header" then
			do return shot((0.08 + (0.17 * shotQ)), 0) end
		elseif _sw1 == "cutback" then
			do return Js.O({ shot = false, find = (0.97 + (0.02 * passQ)), score = (0.36 * k) }, { "shot", "find", "score" }) end
		elseif _sw1 == "through_ball" then
			do return Js.O({ shot = false, find = (0.77 + (0.09 * passQ)), score = (0.31 * k) }, { "shot", "find", "score" }) end
		elseif _sw1 == "byline_cross" then
			do return Js.O({ shot = false, find = (0.72 + (0.18 * passQ)), score = (0.49 * k) }, { "shot", "find", "score" }) end
		elseif _sw1 == "corner" then
			do return Js.O({ shot = false, find = (0.51 + (0.23 * passQ)), score = (0.36 * k) }, { "shot", "find", "score" }) end
		else
			do return Js.O({ shot = false, find = (0.58 + (0.3 * passQ)), score = 0 }, { "shot", "find", "score" }) end
		end
	end
	exports.simOdds = simOdds
	simulateOwnMatch = function(career, fixture, o)
		local settle
		local seed = (if o.seed ~= nil then o.seed else ((career.season * 1000) + career.week))
		local rng = M_season.mulberry32(Js.ushr(Js.bxor(seed, 20973), 0))
		local added = M_addedTime.rollAddedTime(M_season.mulberry32(M_addedTime.addedTimeSeed(seed)))
		local whistle = (90 + added)
		local skills = Js.O({ power = ((function() local _v = o.skills; if _v == nil then return nil end; _v = _v.power; return _v end)() or career.skills.power), technique = ((function() local _v = o.skills; if _v == nil then return nil end; _v = _v.technique; return _v end)() or career.skills.technique), vision = career.skills.vision, pace = career.skills.pace }, { "power", "technique", "vision", "pace" })
		local position = (if career.playAs ~= nil then career.playAs else career.player.position)
		local baseStrength = ((if fixture.opponentStrength ~= nil then fixture.opponentStrength else (function() local _v = A.find(career.league, function(t)
			return (t.name == fixture.opponent)
		end); if _v == nil then return nil end; _v = _v.strength; return _v end)()) or 65)
		local oppStrength = M_matchInputs.opponentMatchStrength(baseStrength, fixture.home)
		local sub = ((o.selection.status == "Substitute") and (o.selection.onAt > 0))
		local factor = M_energy.energyFactorFor(career, fixture)
		local mode = (if o.energyMode ~= nil then o.energyMode else "medium")
		local perMin = M_energy.energyPerMinute(mode, factor)
		local startEnergy = career.energy
		local enteredAt = 0
		local energyAt = function(minute)
			return M_energy.clampEnergy((startEnergy - (Math.max(0, (minute - enteredAt)) * perMin)))
		end
		local subOn = false
		local subChances = 0
		local inputs = function()
			return M_matchInputs.matchInputsFor(M_matchInputs.careerMatchSpec(career, fixture, Js.O({ oppStrength = oppStrength, teamFallback = career.relationships.team, position = position, kick = Js.O({ power = skills.power, technique = skills.technique }, { "power", "technique" }), energy = energyAt(enteredAt), energyMode = mode, impactSub = sub, addedTime = added, lateSub = (if subOn then Js.O({ enteredAt = enteredAt, owed = Math.max(0, (M_hiddenMatch.lateSubQuota(enteredAt) - subChances)), fitness = energyAt(enteredAt) }, { "enteredAt", "owed", "fitness" }) else nil) }, { "oppStrength", "teamFallback", "position", "kick", "energy", "energyMode", "impactSub", "addedTime", "lateSub" })))
		end
		local startingXI = M_teamsheet.startingTeammateRoles(career, fixture)
		local onPitch = M_teamsheet.onPitchToday(M_teamsheet.fillMissingFromFullRoster((if career.squad ~= nil then career.squad else Js.alit()), startingXI, career), startingXI)
		local oppXI = M_teamsheet.opponentStartingXI(career, fixture)
		local keeper = Math.max(20, Math.min(99, ((function() local _v = oppXI; if _v == nil then return nil end; _v = A.find(_v, function(p)
			return (p.role == "GK")
		end); if _v == nil then return nil end; _v = _v.overall; return _v end)() or oppStrength)))
		local me = (career.player.firstName .. " " .. career.player.lastName)
		local goalEvents = Js.alit()
		local oppGoalEvents = Js.alit()
		local name = function(events)
			do
				local _arr2 = events
				local _i3 = 0
				while _i3 < Js.alen(_arr2) do
					_i3 += 1
					local e = _arr2[_i3]
					if (not e.isGoal) then
						do continue end
					end
					if e.teammateGoal then
						local scorer = M_squadData.pickSquadScorer(onPitch, rng)
						local assist = (if scorer then M_squadData.pickSquadAssist(onPitch, scorer.id, rng) else nil)
						A.push(goalEvents, Js.O({ minute = e.minute, scorer = ((function() local _v = scorer; if _v == nil then return nil end; _v = _v.name; return _v end)() or "Team-mate"), assist = (function() local _v = assist; if _v == nil then return nil end; _v = _v.name; return _v end)(), isUserGoal = false }, { "minute", "scorer", "assist", "isUserGoal" }))
					elseif oppXI then
						local cands = A.map(oppXI, function(p)
							return Js.O({ id = p.id, name = p.name, position = p.role }, { "id", "name", "position" })
						end)
						local scorer = (M_squadData.pickSquadScorer(cands, rng) or Js.O({ id = "unnamed", name = "Opponent", position = "ST" }, { "id", "name", "position" }))
						local assist = (if (scorer.id ~= "unnamed") then M_squadData.pickSquadAssist(cands, scorer.id, rng) else nil)
						A.push(oppGoalEvents, Js.O({ minute = e.minute, scorerId = scorer.id, scorer = scorer.name, assistId = (function() local _v = assist; if _v == nil then return nil end; _v = _v.id; return _v end)(), assist = (function() local _v = assist; if _v == nil then return nil end; _v = _v.name; return _v end)() }, { "minute", "scorerId", "scorer", "assistId", "assist" }))
					end
				end
			end
		end
		local st = M_hiddenMatch.newMatch(rng)
		if sub then
			local jitter = math.fmod(((career.week * 37) + (career.season * 11)), 5)
			local rung = o.selection.onAt
			name(M_hiddenMatch.advanceTo(st, inputs(), rng, 50))
			while ((st.minute < 88) and (not M_selection.subComesOnNow(st.minute, (st.userScore - st.oppScore), jitter, rung))) do
				name(M_hiddenMatch.advanceTo(st, inputs(), rng, (st.minute + 1)))
			end
			enteredAt = st.minute
			subOn = true
		end
		local t = Js.O({ attempts = 0, goals = 0, assists = 0, passes = 0, misses = 0, lost = 0, dribbles = 0 }, { "attempts", "goals", "assists", "passes", "misses", "lost", "dribbles" })
		local chances = Js.alit()
		local memory = M_scenarioSelect.newSelectionMemory()
		local hooked = nil
		local hookedAt = nil
		local mayTake = function(k)
			return ((not o.duties) or (if (k == "free_kick") then o.duties.freeKicks else (if (k == "penalty") then o.duties.penalties else true)))
		end
		settle = function(kind, minute, depth)
			if depth == nil then depth = 0 end
			t.attempts += 1
			local odds = simOdds(kind, M_energy.tiredKickSkills(skills, energyAt(minute)), keeper)
			if odds.shot then
				local u = rng()
				if (u < odds.goal) then
					t.goals += 1
					A.push(chances, Js.O({ minute = minute, kind = kind, outcome = "goal" }, { "minute", "kind", "outcome" }))
					A.push(goalEvents, Js.O({ minute = minute, scorer = me, isUserGoal = true, how = kind }, { "minute", "scorer", "isUserGoal", "how" }))
					do return "goal" end
				end
				if (u < (odds.goal + odds.assist)) then
					t.assists += 1
					t.passes += 1
					A.push(chances, Js.O({ minute = minute, kind = kind, outcome = "rebound" }, { "minute", "kind", "outcome" }))
					local fwd = A.filter(onPitch, function(p)
						return A.includes(Js.alit("ST", "CAM", "LW", "RW", "CM"), p.position)
					end)
					local scorer = M_squadData.pickSquadScorer((if Js.T(Js.alen(fwd)) then fwd else onPitch), rng)
					A.push(goalEvents, Js.O({ minute = minute, scorer = ((function() local _v = scorer; if _v == nil then return nil end; _v = _v.name; return _v end)() or "Team-mate"), assist = me, isUserGoal = false, how = kind }, { "minute", "scorer", "assist", "isUserGoal", "how" }))
					do return "goal" end
				end
				t.misses += 1
				A.push(chances, Js.O({ minute = minute, kind = kind, outcome = "miss" }, { "minute", "kind", "outcome" }))
				do return "saved" end
			end
			if (rng() >= odds.find) then
				t.lost += 1
				A.push(chances, Js.O({ minute = minute, kind = kind, outcome = "lost" }, { "minute", "kind", "outcome" }))
				do return "lost" end
			end
			t.passes += 1
			if ((odds.score > 0) and (rng() < odds.score)) then
				t.assists += 1
				A.push(chances, Js.O({ minute = minute, kind = kind, outcome = "assist" }, { "minute", "kind", "outcome" }))
				local fwd = A.filter(onPitch, function(p)
					return A.includes(Js.alit("ST", "CAM", "LW", "RW", "CM"), p.position)
				end)
				local scorer = M_squadData.pickSquadScorer((if Js.T(Js.alen(fwd)) then fwd else onPitch), rng)
				A.push(goalEvents, Js.O({ minute = minute, scorer = ((function() local _v = scorer; if _v == nil then return nil end; _v = _v.name; return _v end)() or "Team-mate"), assist = me, isUserGoal = false, how = kind }, { "minute", "scorer", "assist", "isUserGoal", "how" }))
				do return "goal" end
			end
			if (odds.score > 0) then
				A.push(chances, Js.O({ minute = minute, kind = kind, outcome = "setup" }, { "minute", "kind", "outcome" }))
				do return "saved" end
			end
			A.push(chances, Js.O({ minute = minute, kind = kind, outcome = "pass" }, { "minute", "kind", "outcome" }))
			if (depth < M_canvasEngine.CHAIN_MAX) then
				local sc = M_canvasEngine.buildScenario(kind, rng, keeper, career.relationships.team, skills.vision)
				local at = ((function() local _v = sc.runner; if _v == nil then return nil end; _v = _v.pos; return _v end)() or sc.passTarget)
				if at then
					local forward = (sc.ball.y - at.y)
					sc.passDifficulty = Math.max(0, Math.min(1, ((forward / 25) + (Math.hypot((at.x - sc.ball.x), (at.y - sc.ball.y)) / 45))))
					sc.passAmbition = (if ((forward > 2) and (sc.forwardMostY ~= nil)) then Math.max(0, Math.min(1, (1 - ((at.y - sc.forwardMostY) / 8)))) else 0)
				end
				if (at and (rng() < (if M_canvasEngine.goalInView(kind) then M_canvasEngine.chainReturnChance(sc) else M_giveAndGo.giveAndGoChance(sc, at)))) then
					M_hiddenMatch.resolveScenario(st, "delivered")
					local next_ = M_switchedOffKinds.playableKind(M_canvasEngine.chainKindFor(at, rng, Math.max(sc.passDifficulty, (if sc.passAmbition ~= nil then sc.passAmbition else 0))), rng)
					do return settle(next_, minute, (depth + 1)) end
				end
			end
			do return "delivered" end
		end
		for guard = 0, 59 do
			local offAt = math.huge
			if (subOn and (perMin > 0)) then
				local e = energyAt(st.minute)
				offAt = (if (e <= M_selection.SUB_OFF_ENERGY) then st.minute else (st.minute + math.ceil(((e - M_selection.SUB_OFF_ENERGY) / perMin))))
			end
			local end_ = Math.min(whistle, offAt)
			local step = M_hiddenMatch.advanceUntilInvolved(st, inputs(), rng, end_)
			for g = 0, 19 do
				local k = (if ((function() local _v = step.request; if _v == nil then return nil end; _v = _v.kinds; _v = Js.len(_v); return _v end)() == 1) then step.request.kinds[1] else nil)
				if (((not Js.T(k)) or mayTake(k)) or ((k ~= "free_kick") and (k ~= "penalty"))) then
					do break end
				end
				local scored = (rng() < (if (k == "penalty") then 0.76 else 0.09))
				if scored then
					A.push(step.events, Js.O({ minute = st.minute, text = "", isGoal = true, teammateGoal = true }, { "minute", "text", "isGoal", "teammateGoal" }))
				end
				M_hiddenMatch.resolveScenario(st, (if scored then "goal" else "saved"))
				local next_ = M_hiddenMatch.advanceUntilInvolved(st, inputs(), rng, end_)
				step = Js.ospread(next_, Js.O({ events = Js.aspread(step.events, next_.events) }, { "events" }))
			end
			name(step.events)
			local legsGone = (((not step.request) and (offAt < whistle)) and (st.minute >= offAt))
			if (legsGone or (step.request and (not step.fullTime))) then
				local ratingNow = M_matchStats.fairRating(Js.O({ goals = t.goals, assists = t.assists, passes = t.passes, dribbles = t.dribbles, misses = t.misses, lost = t.lost }, { "goals", "assists", "passes", "dribbles", "misses", "lost" }), st.userScore, st.oppScore).rating
				local d = (if legsGone then Js.O({ hooked = true, reason = "legs" }, { "hooked", "reason" }) else M_selection.hookCheck(Js.O({ minute = st.minute, startMinute = enteredAt, liveRating = ratingNow, scoreDiff = (st.userScore - st.oppScore), rng = rng, liveEnergy = energyAt(st.minute), cameo = subOn }, { "minute", "startMinute", "liveRating", "scoreDiff", "rng", "liveEnergy", "cameo" })))
				if d.hooked then
					hooked = d.reason
					hookedAt = st.minute
					name(M_hiddenMatch.advanceTo(st, inputs(), rng, whistle))
					do break end
				end
			end
			if (not step.request) then
				do break end
			end
			local req = step.request
			if subOn then
				subChances += 1
			end
			local minute = st.minute
			if req.dribble then
				t.attempts += 1
				local men = A.reduce(M_firstPersonDribble.pickWaveSizes(rng), function(a, b)
					return (a + b)
				end, 0)
				if (rng() < SIM_RUN_CLEARED) then
					t.dribbles += 1
					A.push(chances, Js.O({ minute = minute, kind = "dribble", outcome = "dribble" }, { "minute", "kind", "outcome" }))
					M_hiddenMatch.resolveScenario(st, "delivered")
					local at = (if (men >= 7) then Js.O({ x = (M_pitch.CX + ((rng() - 0.5) * 8)), y = ((M_pitch.PEN_SPOT_Y - 2) + (rng() * 4)) }, { "x", "y" }) else Js.O({ x = (M_pitch.CX + ((rng() - 0.5) * 12)), y = (28 + (rng() * 3)) }, { "x", "y" }))
					M_hiddenMatch.resolveScenario(st, settle(M_switchedOffKinds.playableKind(M_canvasEngine.chainKindFor(at, rng, 1), rng), minute))
				else
					t.lost += 1
					A.push(chances, Js.O({ minute = minute, kind = "dribble", outcome = "tackled" }, { "minute", "kind", "outcome" }))
					M_hiddenMatch.resolveScenario(st, "lost")
				end
				do continue end
			end
			local playable = Js.ospread(req, Js.O({ kinds = M_switchedOffKinds.withoutSwitchedOff(req.kinds) }, { "kinds" }))
			local plan = M_scenarioSelect.selectChance(Js.O({ request = playable, position = position, rng = rng, memory = memory }, { "request", "position", "rng", "memory" }))
			local kind = M_switchedOffKinds.playableKind((if plan then plan.kind else M_canvasEngine.pickScenarioKindFrom(position, rng, playable.kinds)), rng)
			M_hiddenMatch.noteServedKind(st, kind)
			M_hiddenMatch.resolveScenario(st, settle(kind, minute))
		end
		local minutes = Math.max(1, (Math.min(90, (if hookedAt ~= nil then hookedAt else 90)) - enteredAt))
		local stats = M_matchStats.finaliseMatch(t.attempts, t.goals, t.assists, t.passes, minutes, st.userScore, st.oppScore, career, goalEvents, hooked, oppGoalEvents, fixture, Js.O({ misses = t.misses, lost = t.lost, dribbles = t.dribbles }, { "misses", "lost", "dribbles" }))
		do return Js.ospread(stats, Js.O({ endEnergy = energyAt((if hookedAt ~= nil then hookedAt else whistle)) }, { "endEnergy" }), (if subOn then Js.O({ cameo = true, enteredAt = enteredAt }, { "cameo", "enteredAt" }) else Js.O({}, nil)), Js.O({ chanceLog = chances, simmed = true }, { "chanceLog", "simmed" })) end
	end
	exports.simulateOwnMatch = simulateOwnMatch
	SIM_RUN_CLEARED = 0.25
	exports.SIM_RUN_CLEARED = SIM_RUN_CLEARED
end
