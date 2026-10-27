--!nocheck
--!nolint
-- Generated from roblox/game/match.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_competitions = import("lib/star/competitions")
	local M_selection = import("lib/star/selection")
	local M_setPieces = import("lib/star/setPieces")
	local M_matchInputs = import("lib/star/matchInputs")
	local M_international = import("lib/star/international")
	local M_leoUpdate = import("lib/star/leoUpdate")
	local M_matchWeather = import("lib/star/matchWeather")
	local M_weather = import("lib/star/weather")
	local M_pressure = import("lib/star/pressure")
	local M_runupStyles = import("lib/star/runupStyles")
	local M_week = import("lib/star/week")
	local M_season = import("lib/star/season")
	local M_matchLog = import("lib/star/matchLog")
	local M_grammar = import("lib/star/media/grammar")
	local M_teamsheet = import("lib/star/teamsheet")
	local M_mechanics = import("lib/star/mechanics")
	local M_energy = import("lib/star/energy")
	local M_matchStats = import("lib/star/matchStats")
	local M_hiddenMatch = import("lib/star/hiddenMatch")
	local M_canvasEngine = import("lib/star/canvasEngine")
	local M_tuningStore = import("lib/star/tuningStore")
	local M_ballPhysics = import("lib/star/ballPhysics")
	local M_gameplayVersion = import("lib/star/gameplayVersion")
	local M_hitbox = import("lib/star/hitbox")
	local M_formationShape = import("lib/star/formationShape")
	local M_squadData = import("lib/star/squadData")
	local M_commentaryExtra = import("lib/star/commentaryExtra")
	local M_airborneChance = import("lib/star/airborneChance")
	local M_matchView = import("lib/star/matchView")
	local M_penaltyRunup = import("lib/star/penaltyRunup")
	local M_ruleBook = import("lib/star/ruleBook")
	local M_fakeFaces = import("lib/star/fakeFaces")
	local M_lineup = import("lib/star/lineup")
	local M_addedTime = import("lib/star/addedTime")
	local M_kits = import("lib/star/kits")
	local M_scenarioSelect = import("lib/star/scenarioSelect")
	local M_keeperBrain = import("lib/star/keeperBrain")
	local M_playOn = import("lib/star/playOn")
	local M_cameraTilt = import("lib/star/cameraTilt")
	local M_switchedOffKinds = import("lib/star/switchedOffKinds")
	local M_index = import("lib/star/kindRules/index")
	local M_goalFrame = import("lib/star/goalFrame")
	local M_scenePicture = import("lib/star/scenePicture")
	local M_penaltyTaking = import("lib/star/penaltyTaking")
	local M_penaltyKeeper = import("lib/star/penaltyKeeper")
	local M_shootout = import("lib/star/shootout")
	local M_euro = import("lib/star/euro")
	local M_stretchRun = import("lib/star/stretchRun")
	local M_newChances = import("lib/star/newChances")
	local M_dribbleDeal = import("lib/star/dribbleDeal")
	local M_calendar = import("lib/star/calendar")
	local M_firstPersonDribble = import("lib/star/firstPersonDribble")
	local M_chanceMaker = import("lib/star/chanceMaker")
	local M_spacing = import("lib/star/spacing")
	local M_matchCommentary = import("lib/star/matchCommentary")
	local M_airDrawings = import("lib/star/airDrawings")
	local M_airTap = import("lib/star/airTap")
	local M_shotModel = import("lib/star/shotModel")
	local M_shopData = import("lib/star/shopData")
	local M_pitch = import("lib/star/pitch")
	local M_aerial = import("lib/star/aerial")
	local M_aerialMoves = import("lib/star/aerialMoves")
	local M_shotFeel = import("lib/star/shotFeel")
	local M_compareSwitches = import("lib/star/compareSwitches")
	local M_strikePower = import("lib/star/strikePower")
	local M_afterPass = import("lib/star/afterPass")
	local M_credit = import("lib/star/credit")
	local M_chanceRating = import("lib/star/chanceRating")
	local M_giveAndGo = import("lib/star/giveAndGo")
	local M_dribbleReward = import("lib/star/dribbleReward")
	local M_legs = import("lib/star/legs")
	local M_deflection = import("lib/star/deflection")
	local M_defenderTouch = import("lib/star/defenderTouch")
	local BALL_GRAB_FRACTION, MIN_PULL, CAPTAIN_DRAG_MIN, DEFAULT_MATCH_DURATION, MINUTE_TICK_MS, QUICK_START_MAX, FOLLOWER_RUN_SPEED, PITCH_HW, SIM_COMMENTARY_USER, SIM_COMMENTARY_OPP, matchSetupFor, readyForMatch, matchCareer, newTally, countedRng, after, setPhase, showAction, pushLine, logMoment, playerLabel, attributeClub, onPitch, mayTake, mechOpen, displayScore, liveEnergyAt, chargeEnergyTo, setClock, tiredSkills, ratingSoFar, matchExtras, hiddenInputs, matchResultFor, applyClearanceRules, formationShapeFor, nameTeamGoals, variedLine, strikeMotion, contactMotion, frameScenario, tiltForChance, acrossM, screenPull, powerFromDrag, sameOnScreenM, startMatch, setUpKeeper, dressAutoKeeper, runupStyleFor, standBackForRunup, extraTimeEligibility, startSimulation, fullTime, finish, clearChance, loadScenario, momentLine, targetName, startTopDownDribble
	local loadTeammatePenalty, ourTakers, theirTakers, scheduleAutoKick, startShootout, nextShootoutKick, loadShootoutKick, finishShootout, pointerDown, pointerMove, pointerUp, armPowerShot, curveSwipe, runupNudge, contact, powerContact, contactTimeout, steerRun, callForBall, dribbleStick, dribbleBurst, dribblePass, continuePause, drinkKib, cycleSpeed, setEnergyMode, setPlaystyle, toggleTouchMode, captainPickAt, nearestCaptainCandidateDist, commitAim, loseChance, fouled, stepCommitted, startRunup, airAerialNow, handleContact, resolveOutcome, handOver, finishTopDownDribble, tick_, stepFeed, feedStep, showHalfTime, stepPlay, stepFlight, noteRunStep, energyNow, staminaNow, aimPreview, contactScreen, matchKits
	matchSetupFor = function(career)
		local nextFixture = M_competitions.nextFixtureFor(career)
		if (not nextFixture) then
			do return nil end
		end
		local selection = M_selection.selectionFor(career)
		local duties = M_setPieces.setPieceDuties(career, selection.status)
		local baseStrength = ((if nextFixture.opponentStrength ~= nil then nextFixture.opponentStrength else (function() local _v = A.find(career.league, function(t)
			return (t.name == nextFixture.opponent)
		end); if _v == nil then return nil end; _v = _v.strength; return _v end)()) or 65)
		local oppStrength = M_matchInputs.opponentMatchStrength(baseStrength, nextFixture.home)
		local bootMatchesLeft = (career.currentBoot.matches > 0)
		local effectivePower = Math.min(100, (career.skills.power + (if bootMatchesLeft then career.currentBoot.power else 0)))
		local effectiveTechnique = Math.min(100, (career.skills.technique + (if bootMatchesLeft then career.currentBoot.technique else 0)))
		local canCurve = ((bootMatchesLeft and (not (not career.currentBoot.curve))) or (not (not (function() local _v = career.kibAbility; if _v == nil then return nil end; _v = _v.curve; return _v end)())))
		local canExtraTouch = ((bootMatchesLeft and (not (not career.currentBoot.extraTouch))) or (not (not (function() local _v = career.kibAbility; if _v == nil then return nil end; _v = _v.extraTouch; return _v end)())))
		local intlMatchCareer = (if (nextFixture.kind == "international") then M_international.internationalCareer(career, nextFixture) else nil)
		do return Js.O({ career = (if intlMatchCareer ~= nil then intlMatchCareer else career), fixture = nextFixture, skills = Js.O({ power = effectivePower, technique = effectiveTechnique }, { "power", "technique" }), canCurve = canCurve, canExtraTouch = canExtraTouch, keeperStrength = oppStrength, oppStrength = oppStrength, position = (if career.playAs ~= nil then career.playAs else career.player.position), teamRelationship = career.relationships.team, startMinute = (if selection.onAt ~= nil then selection.onAt else 0), plannedOffAt = selection.offAt, duties = (if duties ~= nil then duties else nil), conditions = (if M_leoUpdate.leoUpdateOn("weather") then M_matchWeather.matchConditions(career, nextFixture) else M_weather.conditionsFor(career.season, nextFixture.week, career.homeCity)), seed = ((career.season * 1000) + career.week), pressure = M_pressure.pressureForDivision(career.division), penaltyRunup = M_runupStyles.careerPenaltyRunup(career), freeKickRunup = M_runupStyles.careerFreeKickRunup(career) }, { "career", "fixture", "skills", "canCurve", "canExtraTouch", "keeperStrength", "oppStrength", "position", "teamRelationship", "startMinute", "plannedOffAt", "duties", "conditions", "seed", "pressure", "penaltyRunup", "freeKickRunup" }) end
	end
	exports.matchSetupFor = matchSetupFor
	readyForMatch = function(career)
		do return Js.ospread(career, Js.O({ weekActions = 0, energy = M_week.projectedEnergy(career) }, { "weekActions", "energy" })) end
	end
	exports.readyForMatch = readyForMatch
	matchCareer = function(c)
		local out = Js.ospread(c)
		do
			local _arr1 = Js.alit("media", "world", "lastWorld", "externalSquads", "freeAgents", "lastSeasonAwardStats", "seasonHistory", "hallOfFame")
			local _i2 = 0
			while _i2 < Js.alen(_arr1) do
				_i2 += 1
				local k = _arr1[_i2]
				Js.del(out, k)
			end
		end
		do return out end
	end
	exports.matchCareer = matchCareer
	countedRng = function(m, seed)
		local raw = M_season.mulberry32(seed)
		m.rngCalls = 0
		do return function()
			m.rngCalls += 1
			do return raw() end
		end end
	end
	after = function(m, ms, fn, guard)
		if guard == nil then guard = true end
		A.push(m.timers, Js.O({ at = (m.now + (ms / 1000)), gen = (if guard then m.sceneGen else nil), fn = fn }, { "at", "gen", "fn" }))
	end
	setPhase = function(m, p)
		m.phase = p
	end
	showAction = function(m, text)
		m.banner = Js.O({ text = text, at = m.now }, { "text", "at" })
	end
	pushLine = function(m, line)
		m.feed = A.slice(Js.aspread(m.feed, Js.alit(line)), -4)
	end
	logMoment = function(m, text, tone, minute)
		local shown = (if (tone == "assist") then nil else (if minute ~= nil then minute else m.minute))
		m.log = Js.aspread(m.log, Js.alit(M_matchLog.line(text, tone, shown)))
	end
	playerLabel = function(m)
		do return (if Js.T(m.career.player.lastName) then m.career.player.lastName else "you") end
	end
	attributeClub = function(m, text, isOpponent)
		if (not S.includes(text, "{club}")) then
			do return text end
		end
		local club = (if isOpponent then M_grammar.shortClub(m.fixture.opponent) else M_grammar.shortClub(m.career.player.club))
		do return S.replaceAll(text, "{club}", club) end
	end
	onPitch = function(m, squad)
		do return M_teamsheet.onPitchToday(M_teamsheet.fillMissingFromFullRoster(squad, m.startingXI, m.career), m.startingXI) end
	end
	mayTake = function(m, kind)
		local d = m.setup.duties
		if (not d) then
			do return true end
		end
		if (kind == "free_kick") then
			do return d.freeKicks end
		end
		if (kind == "penalty") then
			do return d.penalties end
		end
		if (kind == "corner") then
			do return (if d.corners ~= nil then d.corners else true) end
		end
		do return true end
	end
	mechOpen = function(m, id)
		do return M_mechanics.mechanicOpen(m.career, id) end
	end
	displayScore = function(m)
		do return Js.O({ user = Js.alen(A.filter(m.log, function(l)
			return (l.tone == "goal")
		end)), opp = Js.alen(A.filter(m.log, function(l)
			return (l.tone == "oppGoal")
		end)) }, { "user", "opp" }) end
	end
	exports.displayScore = displayScore
	liveEnergyAt = function(m, minute)
		if Js.T(m.hooked) then
			do return m.energy end
		end
		local extra = (Math.max(0, (minute - m.energyClock)) * M_energy.energyPerMinute(m.energyMode, m.energyFactor))
		do return M_energy.clampEnergy((m.energy - extra)) end
	end
	chargeEnergyTo = function(m, minute)
		if (minute > m.energyClock) then
			m.energy = liveEnergyAt(m, minute)
			m.energyClock = minute
		end
	end
	setClock = function(m, minute)
		chargeEnergyTo(m, minute)
		m.minute = minute
	end
	tiredSkills = function(m)
		local t = M_energy.tiredKickSkills(m.setup.skills, liveEnergyAt(m, m.minute))
		do return Js.O({ power = t.power, technique = t.technique }, { "power", "technique" }) end
	end
	ratingSoFar = function(t, us, them)
		do return M_matchStats.fairRating(Js.ospread(t, Js.O({ passes = t.passesCompleted }, { "passes" })), us, them).rating end
	end
	matchExtras = function(m)
		local t = m.tally
		do return Js.O({ tally = Js.O({ misses = t.misses, lost = t.lost, dribbles = t.dribbles, goalsPen = t.goalsPen, goalsTap = t.goalsTap, goalsOut = t.goalsOut, passesSafe = t.passesSafe, passesAmb = t.passesAmb, missesOn = t.missesOn, missesPen = t.missesPen, misses1v1 = t.misses1v1 }, { "misses", "lost", "dribbles", "goalsPen", "goalsTap", "goalsOut", "passesSafe", "passesAmb", "missesOn", "missesPen", "misses1v1" }), extra = Js.ospread((if m.subOn then Js.O({ cameo = true, enteredAt = m.enteredAt }, { "cameo", "enteredAt" }) else Js.O({}, nil)), Js.O({ chanceLog = A.slice(m.chanceLog) }, { "chanceLog" })) }, { "tally", "extra" }) end
	end
	hiddenInputs = function(m)
		local car = m.career
		local live = Js.O({ oppStrength = m.setup.oppStrength, position = m.setup.position, kick = m.setup.skills, energy = liveEnergyAt(m, m.minute), energyMode = m.energyMode, impactSub = (m.setup.startMinute > 0), farewell = false, lateSub = (if m.subOn then Js.O({ enteredAt = m.enteredAt, owed = Math.max(0, (M_hiddenMatch.lateSubQuota(m.enteredAt) - m.subChances)), fitness = m.subFitness }, { "enteredAt", "owed", "fitness" }) else nil), addedTime = m.ADDED, fullTime = m.MATCH_DURATION }, { "oppStrength", "position", "kick", "energy", "energyMode", "impactSub", "farewell", "lateSub", "addedTime", "fullTime" })
		local inputs = M_matchInputs.matchInputsFor(M_matchInputs.careerMatchSpec(car, m.fixture, Js.ospread(live, Js.O({ teamFallback = m.setup.teamRelationship, playstyle = m.playstyle }, { "teamFallback", "playstyle" }))))
		local withCorners = (if ((function() local _v = m.setup.duties; if _v == nil then return nil end; _v = _v.corners; return _v end)() == false) then Js.ospread(inputs, Js.O({ canTakeCorners = false }, { "canTakeCorners" })) else inputs)
		do return (if (function() local _v = car.unlocks; if _v == nil then return nil end; _v = _v.story; return _v end)() then Js.ospread(withCorners, Js.O({ mechanics = Js.O({ air = M_mechanics.mechanicOpen(car, "aerial"), airIntro = M_mechanics.aerialIntroGame(car), dribble = M_mechanics.mechanicOpen(car, "dribble") }, { "air", "airIntro", "dribble" }) }, { "mechanics" })) else withCorners) end
	end
	matchResultFor = function(res)
		if (M_canvasEngine.OUTCOME_TEXT[res].kind == "goal") then
			do return "goal" end
		end
		if ((res == "delivered") or (res == "touchOn")) then
			do return "delivered" end
		end
		if ((res == "tackled") or (res == "blocked")) then
			do return "lost" end
		end
		do return "saved" end
	end
	applyClearanceRules = function()
		M_canvasEngine.setClearanceRules(Js.O({ speedMin = M_tuningStore.getTuning("clearance.speedMin"), speedMax = M_tuningStore.getTuning("clearance.speedMax"), maxAngleDeg = M_tuningStore.getTuning("clearance.maxAngle"), miscues = true, miscueWeak = M_tuningStore.getTuning("clearance.miscueWeak"), miscueStrong = M_tuningStore.getTuning("clearance.miscueStrong"), bodyLen = M_tuningStore.getTuning("clearance.bodyLen"), bodyWidth = M_tuningStore.getTuning("clearance.bodyWidth"), secondBalls = Math.round(M_tuningStore.getTuning("clearance.secondBalls")) }, { "speedMin", "speedMax", "maxAngleDeg", "miscues", "miscueWeak", "miscueStrong", "bodyLen", "bodyWidth", "secondBalls" }))
		M_ballPhysics.setBallPhysics((if M_gameplayVersion.oldBallPhysics() then "old" else "new"))
		M_hitbox.setHitboxes(M_gameplayVersion.gameplayVersion("hitboxes"))
	end
	formationShapeFor = function(m)
		local myStrength = ((function() local _v = A.find(m.career.league, function(t)
			return (t.name == m.career.player.club)
		end); if _v == nil then return nil end; _v = _v.strength; return _v end)() or 65)
		do return M_formationShape.formationShapeInput(m.fixture.opponent, myStrength, m.setup.oppStrength) end
	end
	nameTeamGoals = function(m, raw, squad, rng, announce)
		local attackers = A.filter(squad, function(p)
			return A.includes(Js.alit("ST", "CAM", "LW", "RW", "CM"), p.position)
		end)
		do return A.flatMap(raw, function(e)
			if (not e.isGoal) then
				do return Js.alit(Js.O({ minute = e.minute, text = attributeClub(m, e.text, e.isOpponent), isOpponent = e.isOpponent }, { "minute", "text", "isOpponent" })) end
			end
			if (not e.teammateGoal) then
				if (m.oppXI == nil) then
					do return Js.alit(Js.O({ minute = e.minute, text = ("⚽ " .. m.fixture.opponent .. " score!"), isGoal = true, isOpponent = true }, { "minute", "text", "isGoal", "isOpponent" })) end
				end
				local oppCandidates = A.map(m.oppXI, function(p)
					return Js.O({ id = p.id, name = p.name, shortName = p.short, position = p.role }, { "id", "name", "shortName", "position" })
				end)
				local oppScorer = (M_squadData.pickSquadScorer(oppCandidates, rng) or Js.O({ id = "unnamed", name = "Team-mate", shortName = "Team-mate" }, { "id", "name", "shortName" }))
				local oppAssister = (if (oppScorer.id ~= "unnamed") then M_squadData.pickSquadAssist(oppCandidates, oppScorer.id, rng) else nil)
				A.push(m.oppGoalEvents, Js.O({ minute = e.minute, scorerId = oppScorer.id, scorer = oppScorer.name, assistId = (function() local _v = oppAssister; if _v == nil then return nil end; _v = _v.id; return _v end)(), assist = (function() local _v = oppAssister; if _v == nil then return nil end; _v = _v.name; return _v end)() }, { "minute", "scorerId", "scorer", "assistId", "assist" }))
				local oppGoalLine = variedLine(M_commentaryExtra.GOAL_LINES, oppScorer.shortName, e.minute)
				if announce then
					pushLine(m, (Js.numstr(e.minute) .. "' " .. oppGoalLine .. (if oppAssister then (" (" .. oppAssister.shortName .. ")") else "")))
				end
				do return (if oppAssister then Js.alit(Js.O({ minute = e.minute, text = oppGoalLine, isGoal = true, isOpponent = true }, { "minute", "text", "isGoal", "isOpponent" }), Js.O({ minute = e.minute, text = variedLine(M_commentaryExtra.ASSIST_LINES, oppAssister.shortName, e.minute), tone = "assist", isOpponent = true }, { "minute", "text", "tone", "isOpponent" })) else Js.alit(Js.O({ minute = e.minute, text = oppGoalLine, isGoal = true, isOpponent = true }, { "minute", "text", "isGoal", "isOpponent" }))) end
			end
			local scorer = (M_squadData.pickSquadScorer((if (Js.alen(attackers) > 0) then attackers else squad), rng) or Js.O({ id = "unnamed", name = "Team-mate", shortName = "Team-mate" }, { "id", "name", "shortName" }))
			local assister = (if (scorer.id ~= "unnamed") then M_squadData.pickSquadAssist(squad, scorer.id, rng) else nil)
			A.push(m.goalEvents, Js.O({ minute = e.minute, scorer = scorer.name, assist = (function() local _v = assister; if _v == nil then return nil end; _v = _v.name; return _v end)(), isUserGoal = false }, { "minute", "scorer", "assist", "isUserGoal" }))
			local goalLine = variedLine(M_commentaryExtra.GOAL_LINES, scorer.shortName, e.minute)
			if announce then
				pushLine(m, (Js.numstr(e.minute) .. "' " .. goalLine .. (if assister then (" (" .. assister.shortName .. ")") else "")))
			end
			do return (if assister then Js.alit(Js.O({ minute = e.minute, text = goalLine, isGoal = true }, { "minute", "text", "isGoal" }), Js.O({ minute = e.minute, text = variedLine(M_commentaryExtra.ASSIST_LINES, assister.shortName, e.minute), tone = "assist" }, { "minute", "text", "tone" })) else Js.alit(Js.O({ minute = e.minute, text = goalLine, isGoal = true }, { "minute", "text", "isGoal" }))) end
		end) end
	end
	variedLine = function(pool, name, minute)
		local h = minute
		for _ok3, _v4 in Js.iter(name) do
			local ch = _v4
			h = Js.ushr(((h * 31) + S.charCodeAt(ch, 0)), 0)
		end
		do return S.replace(pool[math.fmod(h, Js.alen(pool)) + 1], "{name}", name) end
	end
	strikeMotion = function(kind, seed)
		do return (if M_airborneChance.airborneOn() then M_airborneChance.airborneMotion(kind, seed) else contactMotion(kind, seed)) end
	end
	exports.strikeMotion = strikeMotion
	contactMotion = function(kind, seed)
		if (kind == "header") then
			do return "float" end
		end
		if (kind == "volley") then
			do return "bounce" end
		end
		if (((kind == "one_on_one") or (kind == "tight_angle")) or (kind == "long_range")) then
			do return (if (math.fmod(Js.ushr(Math.imul(seed, 2654435761), 0), 100) < 35) then "bobble" else "still") end
		end
		do return "still" end
	end
	frameScenario = function(m, sc)
		M_matchView.turnWideChance(sc, (not M_penaltyRunup.hasRunup(sc.kind)), PITCH_HW)
		m.facing = (if sc.facing ~= nil then sc.facing else "up")
		m.tiltDeg = tiltForChance(m, sc)
		local wasFacing = (if sc.facing ~= nil then sc.facing else "up")
		local cam = M_matchView.frameForNewView(sc, PITCH_HW, false, m.tiltDeg)
		if ((if sc.facing ~= nil then sc.facing else "up") ~= wasFacing) then
			m.facing = (if sc.facing ~= nil then sc.facing else "up")
			m.tiltDeg = tiltForChance(m, sc)
		end
		m.camera = Js.ospread(cam)
	end
	tiltForChance = function(m, sc)
		do return (if (((sc.kind == "corner") or (sc.kind == "byline_cross")) or ((if sc.facing ~= nil then sc.facing else "up") ~= "up")) then 0 else m.tiltSetting) end
	end
	acrossM = function(m)
		local v = m.camera
		do return (if (m.facing == "up") then (v.x2 - v.x1) else (v.y2 - v.y1)) end
	end
	screenPull = function(m, drag, ball)
		do return ((Math.hypot((drag.x - ball.x), (drag.y - ball.y)) * M_canvasEngine.VIEW_ASPECT) / Math.max(0.000001, acrossM(m))) end
	end
	exports.screenPull = screenPull
	powerFromDrag = function(m, drag, ball)
		do return M_canvasEngine.clamp((screenPull(m, drag, ball) / M_canvasEngine.dragForFullPower(m.setup.skills.power)), 0, 1) end
	end
	exports.powerFromDrag = powerFromDrag
	sameOnScreenM = function(m, share)
		do return ((share * acrossM(m)) / M_canvasEngine.VIEW_ASPECT) end
	end
	startMatch = function(setup)
		local career = setup.career
		local fixture = setup.fixture
		local MATCH_DURATION = (M_ruleBook.ruleBookFor(career, "FA").matchLengthMinutes or DEFAULT_MATCH_DURATION)
		M_canvasEngine.setOffsideRuleEnabled((not M_ruleBook.ruleBookFor(career, "FA").offsideAbolished))
		applyClearanceRules()
		local startingXI = M_teamsheet.startingTeammateRoles(career, fixture)
		local oppXI = M_teamsheet.opponentStartingXI(career, fixture)
		local oppXIForCast = (if oppXI then A.map(oppXI, function(p)
			return Js.O({ id = p.id, name = p.name, shortName = p.short, position = p.role, overall = p.overall, face = (if p.face ~= nil then p.face else M_fakeFaces.fakeFaceFor(p.id)), isGK = (p.role == "GK"), y = p.y, defending = p.defending }, { "id", "name", "shortName", "position", "overall", "face", "isGK", "y", "defending" })
		end) else nil)
		local realKeeperOverall = (function() local _v = oppXIForCast; if _v == nil then return nil end; _v = A.find(_v, function(p)
			return p.isGK
		end); if _v == nil then return nil end; _v = _v.overall; return _v end)()
		local strength = (if (realKeeperOverall ~= nil) then Math.max(20, Math.min(99, realKeeperOverall)) else setup.keeperStrength)
		local fpRoster = (if oppXIForCast then A.map(M_lineup.orderDefensively(A.filter(oppXIForCast, function(p)
			return (not p.isGK)
		end)), function(p)
			return Js.O({ id = p.id, name = p.name, shortName = p.shortName, face = p.face, defending = p.defending, overall = p.overall }, { "id", "name", "shortName", "face", "defending", "overall" })
		end) else nil)
		local ADDED = M_addedTime.rollAddedTime(M_season.mulberry32(M_addedTime.addedTimeSeed(setup.seed)))
		local kits = (if fixture.home then M_kits.kitsFor(career.player.club, fixture.opponent, (function() local _v = career.clubKits; if _v == nil then return nil end; _v = _v[career.player.club]; return _v end)(), (function() local _v = career.clubKits; if _v == nil then return nil end; _v = _v[fixture.opponent]; return _v end)()) else M_kits.kitsFor(fixture.opponent, career.player.club, (function() local _v = career.clubKits; if _v == nil then return nil end; _v = _v[fixture.opponent]; return _v end)(), (function() local _v = career.clubKits; if _v == nil then return nil end; _v = _v[career.player.club]; return _v end)()))
		local ourKit = (if fixture.home then kits.home else kits.away)
		local vision = (if career.skills.vision ~= nil then career.skills.vision else 55)
		local m = Js.O({ setup = setup, career = career, fixture = fixture, now = 0, timers = Js.alit(), sceneGen = 0, phase = "aim", sc = nil, ball = nil, rng = Math.random, rngCalls = 0, seed = setup.seed, MATCH_DURATION = MATCH_DURATION, ADDED = ADDED, matchCeiling = (MATCH_DURATION + ADDED), extraTimeStage = 0, wentToExtraTime = false, shootoutResult = nil, st = M_hiddenMatch.newMatch(M_season.mulberry32(setup.seed)), pendingRequest = nil, chain = nil, chanceMemory = M_scenarioSelect.newSelectionMemory(), lastDeal = nil, dribbleDeal = nil, setPieceNext = nil, handover = nil, tally = newTally(), attempts = 0, userScore = 0, oppScore = 0, goalEvents = Js.alit(), oppGoalEvents = Js.alit(), chanceLog = Js.alit(), cheekyStrike = nil, cheekyMisses = Js.alit(), strikeAt = nil, matePlays = Js.alit(), deflections = 0, minute = 0, log = Js.alit(), queue = Js.alit(), feed = Js.alit(), speed = 1, pause = nil, halfTimeShown = false, simContinue = nil, feedWait = nil, quickStart = false, boardShown = false, stretch = nil, energy = (if career.energy ~= nil then career.energy else 100), energyClock = 0, energyMode = "medium", energyFactor = M_energy.energyFactorFor(career, fixture), playstyle = (if career.playstyle ~= nil then career.playstyle else "balanced"), playstyleChanges = Js.alit(), kibUsed = 0, enteredAt = setup.startMinute, subOn = false, subChances = 0, subFitness = 100, hooked = nil, hookedAt = nil, aim = nil, drag = nil, thumbOrigin = nil, dragging = false, aimCommitAt = nil, presser = nil, presserBehind = false, captainDrag = nil, runup = nil, contactTimerS = nil, windUp = nil, powerArmed = false, powerStrike = false, strikeRule = nil, outcome = nil, banner = nil, keeperSalt = M_keeperBrain.keeperSaltFor(false), physAcc = 0, airWait = nil, airOpened = nil, aerial = nil, playOn = nil, playOnRng = Math.random, layOffsLeft = M_playOn.MAX_LAY_OFFS, playOnCaught = false, bar = 1, steer = nil, touchModeOn = false, bootWait = nil, td = nil, tdReady = false, fpDribble = nil, liveShootout = nil, shootoutKick = nil, camera = Js.O({ x1 = -5, x2 = 105, y1 = -5, y2 = 100 }, { "x1", "x2", "y1", "y2" }), facing = "up", tiltSetting = (if (M_matchView.matchView() == "new") then M_cameraTilt.cameraTilt() else 0), tiltDeg = 0, strength = strength, vision = vision, kits = kits, ourKeeperKit = M_kits.keeperKit(ourKit.shirt, kits.keeper.shirt), startingXI = startingXI, oppXIForCast = oppXIForCast, oppXI = oppXI, fpRoster = fpRoster, result = nil }, { "setup", "career", "fixture", "now", "timers", "sceneGen", "phase", "sc", "ball", "rng", "rngCalls", "seed", "MATCH_DURATION", "ADDED", "matchCeiling", "extraTimeStage", "wentToExtraTime", "shootoutResult", "st", "pendingRequest", "chain", "chanceMemory", "lastDeal", "dribbleDeal", "setPieceNext", "handover", "tally", "attempts", "userScore", "oppScore", "goalEvents", "oppGoalEvents", "chanceLog", "cheekyStrike", "cheekyMisses", "strikeAt", "matePlays", "deflections", "minute", "log", "queue", "feed", "speed", "pause", "halfTimeShown", "simContinue", "feedWait", "quickStart", "boardShown", "stretch", "energy", "energyClock", "energyMode", "energyFactor", "playstyle", "playstyleChanges", "kibUsed", "enteredAt", "subOn", "subChances", "subFitness", "hooked", "hookedAt", "aim", "drag", "thumbOrigin", "dragging", "aimCommitAt", "presser", "presserBehind", "captainDrag", "runup", "contactTimerS", "windUp", "powerArmed", "powerStrike", "strikeRule", "outcome", "banner", "keeperSalt", "physAcc", "airWait", "airOpened", "aerial", "playOn", "playOnRng", "layOffsLeft", "playOnCaught", "bar", "steer", "touchModeOn", "bootWait", "td", "tdReady", "fpDribble", "liveShootout", "shootoutKick", "camera", "facing", "tiltSetting", "tiltDeg", "strength", "vision", "kits", "ourKeeperKit", "startingXI", "oppXIForCast", "oppXI", "fpRoster", "result" })
		m.rng = countedRng(m, setup.seed)
		local sc = M_canvasEngine.buildWeightedScenario(M_season.mulberry32(setup.seed), setup.position, strength, setup.teamRelationship, vision)
		if M_switchedOffKinds.isSwitchedOff(sc.kind) then
			local r = M_season.mulberry32(Js.bxor(setup.seed, 20983))
			sc = M_canvasEngine.buildScenario(M_switchedOffKinds.playableKind(sc.kind, r), r, strength, setup.teamRelationship, vision)
		end
		M_index.setupKind(sc, M_season.mulberry32(Js.bxor(setup.seed, 32273)), Js.O({ appliedAuthored = false, appliedPlan = false, keeperStrength = strength }, { "appliedAuthored", "appliedPlan", "keeperStrength" }))
		M_index.enforceHardRules(sc)
		M_goalFrame.finishServedFrame(sc)
		M_scenePicture.stageScene(sc, nil)
		m.sc = sc
		sc.conditions = setup.conditions
		M_lineup.castScenario(sc, onPitch(m, (if career.squad ~= nil then career.squad else Js.alit())))
		M_canvasEngine.initDefenders(sc, m.rng)
		M_lineup.castDefence(sc, oppXIForCast)
		dressAutoKeeper(sc)
		standBackForRunup(m, sc)
		setUpKeeper(m, sc, Js.ushr(Js.bxor(setup.seed, 19326), 0))
		frameScenario(m, sc)
		if (setup.startMinute > 0) then
			m.seed += 1
			local rng = countedRng(m, m.seed)
			m.rng = rng
			local st = m.st
			local jitter = math.fmod((((if career.week ~= nil then career.week else 0) * 37) + ((if career.season ~= nil then career.season else 0) * 11)), 5)
			local rung = setup.startMinute
			local before = M_hiddenMatch.advanceTo(st, hiddenInputs(m), rng, 50)
			while ((st.minute < 88) and (not M_selection.subComesOnNow(st.minute, (st.userScore - st.oppScore), jitter, rung))) do
				A.push(before, Js.unpack(M_hiddenMatch.advanceTo(st, hiddenInputs(m), rng, (st.minute + 1))))
			end
			m.enteredAt = st.minute
			m.subOn = true
			m.subChances = 0
			m.userScore = st.userScore
			m.oppScore = st.oppScore
			m.energyClock = st.minute
			m.subFitness = liveEnergyAt(m, st.minute)
			m.minute = st.minute
			m.halfTimeShown = (st.minute > M_matchLog.HALF_TIME_MINUTE)
			local named = nameTeamGoals(m, before, onPitch(m, (if career.squad ~= nil then career.squad else Js.alit())), rng, false)
			local early = A.filter(A.slice(named, 0, Math.max(0, (Js.alen(named) - 14))), function(e)
				return e.isGoal
			end)
			m.log = Js.aspread(Js.alit(M_matchLog.line("Kick Off", "period", 0)), M_matchLog.linesFrom(Js.aspread(early, A.slice(named, -14))), Js.alit(M_matchLog.line("You are coming on.", "you", st.minute)))
			setPhase(m, "feed")
			m.pause = Js.O({ label = "You are going on", cta = "Get out there →", go = function()
				m.pause = nil
				m.quickStart = true
				startSimulation(m)
			end }, { "label", "cta", "go" })
			do return m end
		end
		m.enteredAt = 0
		m.log = Js.alit(M_matchLog.line("Kick Off", "period", 0))
		m.quickStart = true
		startSimulation(m)
		do return m end
	end
	exports.startMatch = startMatch
	setUpKeeper = function(m, sc, seed)
		seed = Js.ushr(Js.bxor(seed, m.keeperSalt), 0)
		local opts = M_keeperBrain.brainOptionsHere()
		local facing = ((function() local _v = M_penaltyTaking.autoKickOf(sc); if _v == nil then return nil end; _v = _v.keeper; if _v == nil then return nil end; _v = _v.strength; return _v end)() or m.strength)
		opts.penalty = M_penaltyKeeper.penaltyReadFor(facing, nil)
		M_keeperBrain.brainSetup(sc, seed, sc.keeperStrength, opts)
	end
	dressAutoKeeper = function(sc)
		local k = (function() local _v = M_penaltyTaking.autoKickOf(sc); if _v == nil then return nil end; _v = _v.keeper; return _v end)()
		if (not k) then
			do return end
		end
		sc.keeperStrength = k.strength
		if Js.T(k.name) then
			sc.keeper.who = Js.O({ id = (if k.id ~= nil then k.id else "gk"), name = k.name, shortName = (if k.shortName ~= nil then k.shortName else k.name), position = "GK", face = k.face }, { "id", "name", "shortName", "position", "face" })
		end
	end
	runupStyleFor = function(m, sc)
		local auto = M_penaltyTaking.autoKickOf(sc)
		do return (if auto then M_runupStyles.takerRunupFor(sc.kind, (if Js.T(auto.taker.id) then auto.taker.id else auto.taker.name)) else M_runupStyles.yourRunupFor(sc.kind, M_runupStyles.penaltyRunupOf(m.setup.penaltyRunup), M_runupStyles.freeKickRunupOf(m.setup.freeKickRunup))) end
	end
	standBackForRunup = function(m, sc)
		if M_penaltyRunup.hasRunup(sc.kind) then
			sc.player = M_runupStyles.standBackFor(runupStyleFor(m, sc), sc.ball, sc.player, sc.viewport)
		end
	end
	extraTimeEligibility = function(m)
		local fixture = m.fixture
		if (not Js.T((function() local _v = fixture; if _v == nil then return nil end; _v = _v.competition; return _v end)())) then
			do return nil end
		end
		local comp = fixture.competition
		if ((comp == "Community Shield") or (comp == "Super Cup")) then
			do return Js.O({ extraTime = false, isLevelNow = function()
				return (m.userScore == m.oppScore)
			end }, { "extraTime", "isLevelNow" }) end
		end
		if (fixture.kind == "cup") then
			if (fixture.leg == 1) then
				do return nil end
			end
			local firstUs = 0
			local firstThem = 0
			if (fixture.leg == 2) then
				local you = m.career.player.club
				local st = (function() local _r = m.career.cupState; if _r == nil then return nil end; return A.find(_r, function(c)
					return ((c.competition == comp) and (not Js.T(c.winner)))
				end) end)()
				local tie = (function() local _r = (function() local _v = st; if _v == nil then return nil end; _v = _v.rounds; _v = _v[Js.alen(st.rounds)]; if _v == nil then return nil end; _v = _v.ties; return _v end)(); if _r == nil then return nil end; return A.find(_r, function(t)
					return ((t.home == you) or (t.away == you))
				end) end)()
				local l1 = (function() local _v = tie; if _v == nil then return nil end; _v = _v.legs; if _v == nil then return nil end; _v = _v[1]; return _v end)()
				if (tie and l1) then
					firstUs = (if (tie.home == you) then l1.hs else l1.as)
					firstThem = (if (tie.home == you) then l1.as else l1.hs)
				end
			end
			do return Js.O({ extraTime = M_shootout.hasExtraTime(comp, (if fixture.round ~= nil then fixture.round else "Final")), isLevelNow = function()
				return ((firstUs + m.userScore) == (firstThem + m.oppScore))
			end }, { "extraTime", "isLevelNow" }) end
		end
		if (fixture.kind == "europe") then
			local state = m.career.euroState
			if ((not state) or (comp ~= state.competition)) then
				do return nil end
			end
			local tie = M_euro.currentTie(state)
			if (not tie) then
				do return nil end
			end
			local legIdx = (M_euro.currentLeg(state) or 0)
			if ((Js.alen(tie.legs) > 1) and (legIdx == 0)) then
				do return nil end
			end
			local firstLeg = tie.legs[1]
			local firstUs = ((function() local _v = firstLeg; if _v == nil then return nil end; _v = _v.us; return _v end)() or 0)
			local firstThem = ((function() local _v = firstLeg; if _v == nil then return nil end; _v = _v.them; return _v end)() or 0)
			do return Js.O({ extraTime = true, isLevelNow = function()
				return ((firstUs + m.userScore) == (firstThem + m.oppScore))
			end }, { "extraTime", "isLevelNow" }) end
		end
		if fixture.intlKo then
			local ko = fixture.intlKo
			if ko.firstLeg then
				local f = ko.firstLeg
				do return Js.O({ extraTime = true, isLevelNow = function()
					return ((f.us + m.userScore) == (f.them + m.oppScore))
				end }, { "extraTime", "isLevelNow" }) end
			end
			do return Js.O({ extraTime = (ko.level == "et-pens"), isLevelNow = function()
				return (m.userScore == m.oppScore)
			end }, { "extraTime", "isLevelNow" }) end
		end
		if ((((fixture.kind == "international") and Js.T(fixture.round)) and (not S.startsWith(fixture.round, "Group"))) and ((function() local _v = m.career.tournament; if _v == nil then return nil end; _v = _v.season; return _v end)() == m.career.season)) then
			do return Js.O({ extraTime = true, isLevelNow = function()
				return (m.userScore == m.oppScore)
			end }, { "extraTime", "isLevelNow" }) end
		end
		do return nil end
	end
	startSimulation = function(m, resim)
		if resim == nil then resim = false end
		m.sceneGen += 1
		local prior = (if resim then m.stretch else nil)
		if prior then
			m.st = Js.ospread(prior.snapshot)
			m.userScore = prior.userScore
			m.oppScore = prior.oppScore
			A.setlen(m.goalEvents, prior.goalEvents)
			A.setlen(m.oppGoalEvents, prior.oppGoalEvents)
			m.hooked = prior.hooked
			m.hookedAt = prior.hookedAt
			m.feed = prior.feed
		else
			m.seed += 1
		end
		local stretchSeed = (if prior then prior.seed else m.seed)
		local rng = countedRng(m, stretchSeed)
		m.rng = rng
		local st = m.st
		st.userScore = m.userScore
		st.oppScore = m.oppScore
		if (not prior) then
			m.playstyleChanges = Js.alit()
		end
		local baseInputs = (if prior then Js.ospread(prior.inputs, Js.O({ energyModeChanges = prior.changes, context = Js.ospread(prior.inputs.context, Js.O({ playstyleChanges = m.playstyleChanges }, { "playstyleChanges" })) }, { "energyModeChanges", "context" })) else hiddenInputs(m))
		if (not prior) then
			m.stretch = Js.O({ snapshot = Js.ospread(st), seed = stretchSeed, inputs = baseInputs, userScore = m.userScore, oppScore = m.oppScore, goalEvents = Js.alen(m.goalEvents), oppGoalEvents = Js.alen(m.oppGoalEvents), hooked = m.hooked, hookedAt = m.hookedAt, feed = m.feed, changes = Js.alit(), queued = 0 }, { "snapshot", "seed", "inputs", "userScore", "oppScore", "goalEvents", "oppGoalEvents", "hooked", "hookedAt", "feed", "changes", "queued" })
		end
		local offAt = math.huge
		if (m.subOn and (not Js.T(m.hooked))) then
			local perMin = M_energy.energyPerMinute(m.energyMode, m.energyFactor)
			local e = liveEnergyAt(m, st.minute)
			if (perMin > 0) then
				offAt = (if (e <= M_selection.SUB_OFF_ENERGY) then st.minute else (st.minute + math.ceil(((e - M_selection.SUB_OFF_ENERGY) / perMin))))
			end
		end
		local plannedOff = false
		local po = m.setup.plannedOffAt
		if ((Js.T(po) and (not Js.T(m.hooked))) and (po < offAt)) then
			offAt = Math.max(st.minute, po)
			plannedOff = true
		end
		local stretchEnd = Math.min(m.matchCeiling, offAt)
		local handedOver = Js.alit()
		local handover = (if prior then (if prior.handover ~= nil then prior.handover else nil) else m.handover)
		m.handover = nil
		if ((not prior) and m.stretch) then
			m.stretch.handover = handover
		end
		if Js.T(handover) then
			local label = (if (handover == "penalty") then "penalty" else "free kick")
			local scored = (rng() < (if (handover == "penalty") then 0.76 else 0.09))
			A.push(handedOver, (if scored then Js.O({ minute = st.minute, text = ("⚽ Your side score the " .. label .. "!"), isGoal = true, teammateGoal = true }, { "minute", "text", "isGoal", "teammateGoal" }) else Js.O({ minute = st.minute, text = ("A " .. label .. " — someone else steps up, and it comes to nothing."), isOpponent = false }, { "minute", "text", "isOpponent" })))
			M_hiddenMatch.resolveScenario(st, (if scored then "goal" else "saved"))
		end
		local step = (if Js.T(m.hooked) then Js.O({ events = Js.aspread(handedOver, M_hiddenMatch.advanceTo(st, baseInputs, rng, m.matchCeiling)), request = nil, fullTime = true }, { "events", "request", "fullTime" }) else M_stretchRun.runStretch(st, baseInputs, rng, stretchEnd, function(k)
			return mayTake(m, k)
		end, handedOver))
		local legsGone = (((not step.request) and (offAt < m.matchCeiling)) and (st.minute >= offAt))
		if legsGone then
			step = Js.ospread(step, Js.O({ fullTime = false }, { "fullTime" }))
		end
		local squad = onPitch(m, (if m.career.squad ~= nil then m.career.squad else Js.alit()))
		local events = nameTeamGoals(m, step.events, squad, M_season.mulberry32(((stretchSeed * 31) + 7)), true)
		m.userScore = st.userScore
		m.oppScore = st.oppScore
		if (Js.alen(events) == 0) then
			local isOpponent = (st.possession ~= "user")
			local bank = (if isOpponent then SIM_COMMENTARY_OPP else SIM_COMMENTARY_USER)
			A.push(events, Js.O({ minute = st.minute, text = attributeClub(m, bank[math.floor((rng() * Js.alen(bank))) + 1], isOpponent), isOpponent = isOpponent }, { "minute", "text", "isOpponent" }))
		end
		if ((not Js.T(m.hooked)) and (not step.fullTime)) then
			local t = m.tally
			local decision = (if (legsGone and plannedOff) then Js.O({ hooked = true, reason = "rested", message = (Js.numstr(st.minute) .. "' — a planned change. The manager wants a look at someone else; you come off.") }, { "hooked", "reason", "message" }) else (if legsGone then Js.O({ hooked = true, reason = "legs", message = ("Out on your feet at " .. Js.numstr(Math.round(liveEnergyAt(m, st.minute))) .. "% energy — you are taken off.") }, { "hooked", "reason", "message" }) else M_selection.hookCheck(Js.O({ minute = st.minute, startMinute = m.enteredAt, liveRating = ratingSoFar(t, st.userScore, st.oppScore), scoreDiff = (st.userScore - st.oppScore), rng = rng, liveEnergy = liveEnergyAt(m, st.minute), cameo = m.subOn }, { "minute", "startMinute", "liveRating", "scoreDiff", "rng", "liveEnergy", "cameo" }))))
			if decision.hooked then
				chargeEnergyTo(m, st.minute)
				m.hooked = decision.reason
				m.hookedAt = st.minute
				A.push(events, Js.O({ minute = st.minute, text = decision.message }, { "minute", "text" }))
				local after2 = M_hiddenMatch.advanceTo(st, baseInputs, rng, m.matchCeiling)
				A.push(events, Js.unpack(nameTeamGoals(m, after2, onPitch(m, (if m.career.squad ~= nil then m.career.squad else Js.alit())), rng, false)))
				m.userScore = st.userScore
				m.oppScore = st.oppScore
				step = Js.ospread(step, Js.O({ request = nil, fullTime = true }, { "request", "fullTime" }))
			end
		end
		m.pendingRequest = step.request
		if (step.request and m.subOn) then
			m.subChances += 1
		end
		local board = (if prior then (not (not prior.board)) else ((((m.ADDED > 0) and (not m.boardShown)) and (m.extraTimeStage == 0)) and (st.minute > m.MATCH_DURATION)))
		if board then
			m.boardShown = true
			if m.stretch then
				m.stretch.board = true
			end
			local at = A.findIndex(events, function(e)
				return (e.minute > m.MATCH_DURATION)
			end)
			A.splice(events, (if (at < 0) then Js.alen(events) else at), 0, Js.O({ minute = m.MATCH_DURATION, tone = "period", text = ("+" .. Js.numstr(m.ADDED) .. " minute" .. (if (m.ADDED == 1) then "" else "s") .. " added") }, { "minute", "tone", "text" }))
		end
		local shown = (if prior then Math.max(0, (prior.queued - Js.alen(m.queue))) else 0)
		if m.stretch then
			m.stretch.queued = Js.alen(events)
		end
		local quick = (((((m.quickStart and (not prior)) and (not (not step.request))) and (not step.fullTime)) and (st.minute <= QUICK_START_MAX)) and ((st.minute <= M_matchLog.HALF_TIME_MINUTE) or m.halfTimeShown))
		m.quickStart = false
		if quick then
			m.log = Js.aspread(m.log, M_matchLog.linesFrom(events, m.minute))
			m.queue = Js.alit()
			setClock(m, st.minute)
		else
			m.queue = M_matchLog.linesFrom(A.slice(events, shown), m.minute)
		end
		setPhase(m, "feed")
		m.feedWait = nil
		m.simContinue = function()
			if step.fullTime then
				fullTime(m)
			else
				loadScenario(m, false)
			end
		end
		if quick then
			after(m, 0, function()
				local go = m.simContinue
				m.simContinue = nil
				m.stretch = nil;
				(function() local _f = go; if _f == nil then return nil end; return _f() end)()
			end)
		end
	end
	fullTime = function(m)
		local finalize = function()
			m.pause = nil
			finish(m)
		end
		if (m.extraTimeStage == 1) then
			m.log = Js.aspread(m.log, Js.alit(M_matchLog.line("End of the first half of extra time.", "period", m.matchCeiling)))
			m.pause = Js.O({ cta = "Second half (extra time) →", go = function()
				m.pause = nil
				m.extraTimeStage = 2
				m.matchCeiling = ((m.MATCH_DURATION + m.ADDED) + 30)
				m.log = Js.aspread(m.log, Js.alit(M_matchLog.line("Second half of extra time.", "period", m.matchCeiling)))
				startSimulation(m)
			end }, { "cta", "go" })
			do return end
		end
		if (m.extraTimeStage == 2) then
			local el = extraTimeEligibility(m)
			if (el and el.isLevelNow()) then
				startShootout(m)
			else
				local home = m.fixture.home
				m.log = Js.aspread(m.log, Js.alit(M_matchLog.line(("After Extra Time  " .. Js.numstr((if home then m.userScore else m.oppScore)) .. " - " .. Js.numstr((if home then m.oppScore else m.userScore))), "period", m.matchCeiling)))
				m.pause = Js.O({ cta = "Full time →", go = finalize }, { "cta", "go" })
			end
			do return end
		end
		local ds = displayScore(m)
		local home = m.fixture.home
		m.log = Js.aspread(m.log, Js.alit(M_matchLog.line(("Full Time  " .. Js.numstr((if home then ds.user else ds.opp)) .. " - " .. Js.numstr((if home then ds.opp else ds.user))), "period", (m.MATCH_DURATION + m.ADDED))))
		m.minute = (m.MATCH_DURATION + m.ADDED)
		local eligibility = extraTimeEligibility(m)
		if (not (eligibility and eligibility.isLevelNow())) then
			m.pause = Js.O({ cta = "Full time →", go = finalize }, { "cta", "go" })
			do return end
		end
		if (not eligibility.extraTime) then
			m.pause = Js.O({ cta = "Penalties →", go = function()
				m.pause = nil
				startShootout(m)
			end }, { "cta", "go" })
			do return end
		end
		m.pause = Js.O({ cta = "Extra time →", go = function()
			m.pause = nil
			m.wentToExtraTime = true
			m.extraTimeStage = 1
			m.matchCeiling = ((m.MATCH_DURATION + m.ADDED) + 15)
			m.log = Js.aspread(m.log, Js.alit(M_matchLog.line("Extra time — first half.", "period", (m.MATCH_DURATION + m.ADDED))))
			startSimulation(m)
		end }, { "cta", "go" })
	end
	finish = function(m, shootout)
		local t = m.tally
		local stats = Js.ospread(M_matchStats.finaliseMatch(m.attempts, t.goals, t.assists, t.passesCompleted, Math.max(1, ((if m.hookedAt ~= nil then m.hookedAt else m.minute) - m.enteredAt)), m.userScore, m.oppScore, m.career, m.goalEvents, m.hooked, m.oppGoalEvents, m.fixture, matchExtras(m).tally), matchExtras(m).extra, Js.O({ endEnergy = liveEnergyAt(m, (if m.hookedAt ~= nil then m.hookedAt else m.minute)), kibCansUsed = m.kibUsed, playstyle = m.playstyle }, { "endEnergy", "kibCansUsed", "playstyle" }), (if shootout then Js.O({ wentToExtraTime = m.wentToExtraTime, shootout = shootout }, { "wentToExtraTime", "shootout" }) else (if m.wentToExtraTime then Js.O({ wentToExtraTime = true }, { "wentToExtraTime" }) else Js.O({}, nil))), (if Js.T(Js.alen(m.cheekyMisses)) then Js.O({ cheekyMisses = Js.aspread(m.cheekyMisses) }, { "cheekyMisses" }) else Js.O({}, nil)))
		m.result = stats
		setPhase(m, "postmatch")
	end
	clearChance = function(m)
		m.ball = nil
		m.aim = nil
		m.runup = nil
		m.contactTimerS = nil
		m.airWait = nil
		m.airOpened = nil
		m.aerial = nil
		m.outcome = nil
		m.drag = nil
		m.dragging = false
		m.captainDrag = nil
		m.aimCommitAt = nil
		m.presser = nil
		m.thumbOrigin = nil
	end
	loadScenario = function(m, attacking)
		m.sceneGen += 1
		m.bootWait = nil
		applyClearanceRules()
		m.seed += 1
		m.rng = countedRng(m, m.seed)
		local rng = m.rng
		local rawRequest = (if attacking then nil else m.pendingRequest)
		m.pendingRequest = nil
		local chain = m.chain
		m.chain = nil
		local request = rawRequest
		if ((rawRequest and (not chain)) and M_newChances.newChancesOn()) then
			local d = (function() if m.dribbleDeal == nil then m.dribbleDeal = Js.O({ deal = M_dribbleDeal.newDribbleDeal(), rng = M_season.mulberry32(Js.ushr(Js.bxor(m.setup.seed, 220314398), 0)) }, { "deal", "rng" }) end; return m.dribbleDeal end)()
			request = M_dribbleDeal.dealDribble(rawRequest, M_dribbleDeal.dribbleLevelFor(M_calendar.divisionOf(m.career), m.fixture.competition), d.deal, d.rng)
		end
		local setPiece = (if chain then nil else m.setPieceNext)
		m.setPieceNext = nil
		m.td = nil
		m.fpDribble = nil
		if ((((not attacking) and (not chain)) and (function() local _v = request; if _v == nil then return nil end; _v = _v.penaltyWon; return _v end)()) and (not mayTake(m, "penalty"))) then
			if loadTeammatePenalty(m, request, rng) then
				do return end
			end
		end
		if ((not attacking) and (function() local _v = request; if _v == nil then return nil end; _v = _v.dribble; return _v end)()) then
			m.fpDribble = Js.O({ waveSizes = M_firstPersonDribble.pickWaveSizes(rng, Js.O({ minRounds = 3 }, { "minRounds" })), seed = math.floor((rng() * 1000000000)) }, { "waveSizes", "seed" })
			clearChance(m)
			m.facing = "up"
			setPhase(m, startTopDownDribble(m))
			logMoment(m, momentLine(m), "you")
			pushLine(m, request.reason)
			pushLine(m, "Beat your man to win the ball forward.")
			do return end
		end
		local isTouchContinuation = ((chain ~= nil) and (chain.touchTouches ~= nil))
		local legsWas = (function() local _v = m.playOn; if _v == nil then return nil end; _v = _v.stick; if _v == nil then return nil end; _v = _v.legs; return _v end)()
		m.bar = (if (isTouchContinuation and legsWas) then legsWas.stamina.v else 1)
		m.playOn = nil
		m.steer = nil
		if (not isTouchContinuation) then
			m.layOffsLeft = M_playOn.MAX_LAY_OFFS
		end
		if (chain and isTouchContinuation) then
			M_canvasEngine.resetForTouchOn(m.sc, chain.pos)
		else
			if request then
				m.lastDeal = request.deal
			end
			local made = M_chanceMaker.makeChance(Js.O({ deal = m.lastDeal, source = (if Js.T((function() local _v = chain; if _v == nil then return nil end; _v = _v.kind; return _v end)()) then Js.O({ from = "kind", kind = chain.kind }, { "from", "kind" }) else (if chain then Js.O({ from = "chain", pos = chain.pos, ambition = chain.ambition, position = m.setup.position }, { "from", "pos", "ambition", "position" }) else (if Js.T(setPiece) then Js.O({ from = "kind", kind = setPiece }, { "from", "kind" }) else (if attacking then Js.O({ from = "attacking" }, { "from" }) else (if request then Js.O({ from = "request", request = request, position = m.setup.position }, { "from", "request", "position" }) else Js.O({ from = "weighted", position = m.setup.position }, { "from", "position" })))))), rng = rng, strength = Js.O({ keeper = m.strength, team = m.setup.teamRelationship, vision = m.vision }, { "keeper", "team", "vision" }), memory = (if m.setup.pictures ~= nil then m.setup.pictures else M_chanceMaker.pictureMemory("game")), selection = m.chanceMemory, formation = formationShapeFor(m) }, { "deal", "source", "rng", "strength", "memory", "selection", "formation" }))
			m.sc = made.sc
			M_hiddenMatch.noteServedKind(m.st, made.sc.kind)
		end
		if chain then
			m.sc.chainDepth = chain.depth
			m.sc.touchTouches = chain.touchTouches
		end
		m.sc.conditions = m.setup.conditions
		if (not isTouchContinuation) then
			M_lineup.castScenario(m.sc, onPitch(m, (if m.career.squad ~= nil then m.career.squad else Js.alit())))
		end
		m.strikeRule = nil
		M_canvasEngine.initDefenders(m.sc, rng)
		M_lineup.castDefence(m.sc, m.oppXIForCast)
		setUpKeeper(m, m.sc, Js.ushr(Js.bxor(m.seed, 19326), 0))
		local heavyTouch = 0
		if (chain and (not isTouchContinuation)) then
			local sc = m.sc
			local stance = Js.O({ x = (sc.player.x - sc.ball.x), y = (sc.player.y - sc.ball.y) }, { "x", "y" })
			heavyTouch = M_canvasEngine.applyFirstTouch(sc, tiredSkills(m).technique, rng)
			local vp = sc.viewport
			local inset = 1.4
			sc.player = Js.O({ x = Math.min(Math.max((sc.ball.x + stance.x), (vp.x1 + inset)), (vp.x2 - inset)), y = Math.min(Math.max((sc.ball.y + stance.y), Math.max((vp.y1 + inset), 0.3)), (vp.y2 - inset)) }, { "x", "y" })
			M_spacing.separateBodies(sc)
		end
		standBackForRunup(m, m.sc)
		frameScenario(m, m.sc)
		clearChance(m)
		setPhase(m, "aim")
		logMoment(m, (if (function() local _v = request; if _v == nil then return nil end; _v = _v.lateCharge; return _v end)() then ("Everyone's forward — it's launched into the box for " .. playerLabel(m) .. ".") else momentLine(m)), "you")
		if request then
			pushLine(m, request.reason)
		end
		if (heavyTouch > 0.55) then
			pushLine(m, "Heavy touch — it has got away from you.")
		end
		pushLine(m, (if isTouchContinuation then "Still got it — looks up again." else M_matchCommentary.commentaryBuildup(m.sc.kind, m.rng, targetName(m.sc))))
	end
	momentLine = function(m)
		local you = playerLabel(m)
		local pool = Js.alit(("The move works its way to " .. you .. "."), ("It breaks for " .. you .. "."), ("The ball is worked through to " .. you .. "."), ("It's picked out for " .. you .. "."), ("The move reaches " .. you .. "."), ("It comes to " .. you .. "."), ("A gap opens up for " .. you .. "."), ("The ball finds its way to " .. you .. "."))
		do return pool[math.floor((m.rng() * Js.alen(pool))) + 1] end
	end
	targetName = function(sc)
		if (not sc) then
			do return nil end
		end
		if ((sc.kind == "volley") or (sc.kind == "header")) then
			do return (function() local _v = sc.crosser; if _v == nil then return nil end; _v = _v.shortName; return _v end)() end
		end
		do return ((function() local _v = sc.runner; if _v == nil then return nil end; _v = _v.who; if _v == nil then return nil end; _v = _v.shortName; return _v end)() or (function() local _v = A.find(sc.secondaryRunners, function(r)
			return (r.role == "target")
		end); if _v == nil then return nil end; _v = _v.who; if _v == nil then return nil end; _v = _v.shortName; return _v end)()) end
	end
	startTopDownDribble = function(m)
		local fp = m.fpDribble
		if (not fp) then
			do return "tdDribble" end
		end
		local car = m.career
		local run = M_firstPersonDribble.newRun(Js.ospread(Js.O({ pace = (if fp.duels then (if car.skills.pace ~= nil then car.skills.pace else 60) else 100), oppStrength = (if fp.duels then Math.round((if m.setup.oppStrength ~= nil then m.setup.oppStrength else 70)) else 100), waveSizes = fp.waveSizes, roster = m.fpRoster, rng = M_season.mulberry32(fp.seed), mates = Math.round(M_tuningStore.getTuning("dribble.mates")) }, { "pace", "oppStrength", "waveSizes", "roster", "rng", "mates" }), (if fp.duels then Js.O({ duels = true, dribbling = (if car.skills.technique ~= nil then car.skills.technique else 55) }, { "duels", "dribbling" }) else Js.O({}, nil))))
		M_firstPersonDribble.applyStick(run, 0, 0)
		m.td = run
		m.tdReady = true
		do return "tdDribble" end
	end
	loadTeammatePenalty = function(m, request, rng)
		local us = ourTakers(m)
		local taker = M_penaltyTaking.designatedTaker(us.outfield)
		if (not taker) then
			do return false end
		end
		local sc = M_canvasEngine.buildScenario("penalty", rng, m.strength, m.setup.teamRelationship, m.vision)
		M_index.enforceHardRules(sc)
		sc.conditions = m.setup.conditions
		M_lineup.castScenario(sc, A.filter(onPitch(m, (if m.career.squad ~= nil then m.career.squad else Js.alit())), function(p)
			return (p.id ~= taker.id)
		end))
		M_canvasEngine.initDefenders(sc, rng)
		M_lineup.castDefence(sc, m.oppXIForCast)
		local kw = sc.keeper.who
		local plan = M_penaltyTaking.planPenalty(taker.rating, M_season.mulberry32(Js.ushr(Js.bxor(m.seed, 499996), 0)))
		M_penaltyTaking.attachAutoKick(sc, Js.O({ side = "us", taker = taker, plan = plan, context = "match", keeper = Js.O({ strength = m.strength, id = (function() local _v = kw; if _v == nil then return nil end; _v = _v.id; return _v end)(), name = (function() local _v = kw; if _v == nil then return nil end; _v = _v.name; return _v end)(), shortName = (function() local _v = kw; if _v == nil then return nil end; _v = _v.shortName; return _v end)(), face = (function() local _v = kw; if _v == nil then return nil end; _v = _v.face; return _v end)() }, { "strength", "id", "name", "shortName", "face" }) }, { "side", "taker", "plan", "context", "keeper" }))
		standBackForRunup(m, sc)
		setUpKeeper(m, sc, Js.ushr(Js.bxor(m.seed, 19326), 0))
		m.sc = sc
		frameScenario(m, sc)
		clearChance(m)
		setPhase(m, "aim")
		logMoment(m, ("Penalty! " .. taker.shortName .. " to take it."), "you")
		pushLine(m, request.reason)
		scheduleAutoKick(m)
		do return true end
	end
	ourTakers = function(m)
		local squad = onPitch(m, (if m.career.squad ~= nil then m.career.squad else Js.alit()))
		local all = A.map(squad, function(p)
			return Js.O({ id = p.id, name = p.name, shortName = p.shortName, face = (if p.imageUrl ~= nil then p.imageUrl else M_fakeFaces.fakeFaceFor(p.id)), rating = M_penaltyTaking.takerRating(p), isGK = (p.position == "GK"), overall = p.overall }, { "id", "name", "shortName", "face", "rating", "isGK", "overall" })
		end)
		local outfield = A.filter(all, function(t)
			return (not t.isGK)
		end)
		for i = Js.alen(outfield), 4 do
			A.push(outfield, Js.O({ id = ("mate-" .. Js.numstr(i)), name = ("Team-mate " .. Js.numstr((i + 1))), shortName = ("No. " .. Js.numstr((i + 7))), face = M_fakeFaces.fakeFaceFor(("mate-" .. Js.numstr(i))), rating = 62, isGK = false, overall = nil }, { "id", "name", "shortName", "face", "rating", "isGK", "overall" }))
		end
		do return Js.O({ outfield = outfield, keeper = (A.find(all, function(t)
			return t.isGK
		end) or nil) }, { "outfield", "keeper" }) end
	end
	theirTakers = function(m)
		local all = A.map((if m.oppXIForCast ~= nil then m.oppXIForCast else Js.alit()), function(p)
			return Js.O({ id = p.id, name = p.name, shortName = p.shortName, face = (if p.face ~= nil then p.face else M_fakeFaces.fakeFaceFor(p.id)), rating = M_penaltyTaking.takerRating(Js.O({ overall = p.overall }, { "overall" })), isGK = p.isGK }, { "id", "name", "shortName", "face", "rating", "isGK" })
		end)
		local outfield = A.filter(all, function(t)
			return (not t.isGK)
		end)
		for i = Js.alen(outfield), 4 do
			A.push(outfield, Js.O({ id = ("opp-" .. Js.numstr(i)), name = ("Their No. " .. Js.numstr((i + 7))), shortName = ("No. " .. Js.numstr((i + 7))), face = M_fakeFaces.fakeFaceFor(("opp-" .. Js.numstr(i))), rating = 62 }, { "id", "name", "shortName", "face", "rating" }))
		end
		do return Js.O({ outfield = outfield, keeper = (A.find(all, function(t)
			return t.isGK
		end) or nil) }, { "outfield", "keeper" }) end
	end
	scheduleAutoKick = function(m)
		if (not M_penaltyTaking.autoKickOf(m.sc)) then
			do return end
		end
		after(m, M_penaltyTaking.AUTO_STAND_MS, function()
			if (m.phase ~= "aim") then
				do return end
			end
			local sc = m.sc
			local k = M_penaltyTaking.autoKickOf(sc)
			if (not k) then
				do return end
			end
			local a = M_penaltyTaking.aimFor(sc, k.plan)
			startRunup(m, a.dir, a.power, Js.O({ contact = a.contact, skills = M_penaltyTaking.takerSkills(k.taker.rating) }, { "contact", "skills" }))
		end)
	end
	startShootout = function(m)
		local home = m.fixture.home
		local yourSide = (if home then "home" else "away")
		local car = m.career
		local us = ourTakers(m)
		local them = theirTakers(m)
		local you = (if Js.T(m.hooked) then nil else Js.O({ id = "you", name = (car.player.firstName .. " " .. car.player.lastName), shortName = playerLabel(m), face = (if car.player.portrait ~= nil then car.player.portrait else ""), rating = M_penaltyTaking.yourPenaltyRating(Js.O({ technique = m.setup.skills.technique, freeKick = (if car.skills.freeKick ~= nil then car.skills.freeKick else m.setup.skills.technique) }, { "technique", "freeKick" }), (if car.starRating ~= nil then car.starRating else 0)), you = true }, { "id", "name", "shortName", "face", "rating", "you" }))
		local ourOrder = M_penaltyTaking.shootoutOrder(Js.aspread(us.outfield, (if us.keeper then Js.alit(us.keeper) else Js.alit())), you)
		local theirOrder = M_penaltyTaking.shootoutOrder(Js.aspread(them.outfield, (if them.keeper then Js.alit(them.keeper) else Js.alit())))
		local ourClubStrength = ((function() local _v = A.find(car.league, function(t)
			return (t.name == car.player.club)
		end); if _v == nil then return nil end; _v = _v.strength; return _v end)() or m.setup.teamRelationship)
		local ourKeeper = Js.O({ strength = Math.max(20, Math.min(99, ((function() local _v = us.keeper; if _v == nil then return nil end; _v = _v.overall; return _v end)() or ourClubStrength))), id = (function() local _v = us.keeper; if _v == nil then return nil end; _v = _v.id; return _v end)(), name = (function() local _v = us.keeper; if _v == nil then return nil end; _v = _v.name; return _v end)(), shortName = (function() local _v = us.keeper; if _v == nil then return nil end; _v = _v.shortName; return _v end)(), face = (function() local _v = us.keeper; if _v == nil then return nil end; _v = _v.face; return _v end)() }, { "strength", "id", "name", "shortName", "face" })
		local theirKeeper = Js.O({ strength = m.strength, id = (function() local _v = them.keeper; if _v == nil then return nil end; _v = _v.id; return _v end)(), name = (function() local _v = them.keeper; if _v == nil then return nil end; _v = _v.name; return _v end)(), shortName = (function() local _v = them.keeper; if _v == nil then return nil end; _v = _v.shortName; return _v end)(), face = (function() local _v = them.keeper; if _v == nil then return nil end; _v = _v.face; return _v end)() }, { "strength", "id", "name", "shortName", "face" })
		m.liveShootout = Js.O({ homeClub = (if home then car.player.club else m.fixture.opponent), awayClub = (if home then m.fixture.opponent else car.player.club), yourSide = yourSide, home = (if home then ourOrder else theirOrder), away = (if home then theirOrder else ourOrder), homeKeeper = (if home then ourKeeper else theirKeeper), awayKeeper = (if home then theirKeeper else ourKeeper), state = M_shootout.createShootout(), handed = -1 }, { "homeClub", "awayClub", "yourSide", "home", "away", "homeKeeper", "awayKeeper", "state", "handed" })
		logMoment(m, "Penalties.", "period")
		nextShootoutKick(m)
	end
	nextShootoutKick = function(m)
		local info = m.liveShootout
		if (not info) then
			do return end
		end
		local state = info.state
		if state.over then
			after(m, 2600, function()
				return finishShootout(m, Js.O({ home = state.homeScore, away = state.awayScore }, { "home", "away" }))
			end, false)
			do return end
		end
		local side = M_shootout.nextShootoutSide(state)
		local order = (if (side == "home") then info.home else info.away)
		local idx = M_shootout.nextTakerIndex(state, side, Math.max(1, Js.alen(order)))
		local taker = order[idx + 1]
		local n = Js.alen(state.kicks)
		if ((info.handed == n) or (not taker)) then
			do return end
		end
		info.handed = n
		loadShootoutKick(m, Js.O({ side = side, taker = taker }, { "side", "taker" }), function(scored)
			if (Js.alen(info.state.kicks) == n) then
				info.state = M_shootout.takeNextKick(info.state, scored, Math.max(1, Js.alen(order)))
			end
			nextShootoutKick(m)
		end)
	end
	loadShootoutKick = function(m, kick, submit)
		local info = m.liveShootout
		m.sceneGen += 1
		m.seed += 1
		m.rng = countedRng(m, m.seed)
		local rng = m.rng
		m.chain = nil
		m.td = nil
		m.fpDribble = nil
		local ours = (kick.side == info.yourSide)
		local keeper = (if (kick.side == "home") then info.awayKeeper else info.homeKeeper)
		local sc = M_canvasEngine.buildScenario("penalty", rng, keeper.strength, m.setup.teamRelationship, m.vision)
		M_index.enforceHardRules(sc)
		sc.conditions = m.setup.conditions
		M_canvasEngine.initDefenders(sc, rng)
		M_scenePicture.stageScene(sc, Js.O({ teammates = false }, { "teammates" }))
		M_penaltyTaking.clearForShootout(sc)
		if Js.T(keeper.name) then
			sc.keeper.who = Js.O({ id = (if keeper.id ~= nil then keeper.id else "gk"), name = keeper.name, shortName = (if keeper.shortName ~= nil then keeper.shortName else keeper.name), position = "GK", face = keeper.face }, { "id", "name", "shortName", "position", "face" })
		end
		if (not kick.taker.you) then
			local plan = M_penaltyTaking.planPenalty(kick.taker.rating, M_season.mulberry32(Js.ushr(Js.bxor(m.seed, 499996), 0)))
			M_penaltyTaking.attachAutoKick(sc, Js.O({ side = (if ours then "us" else "them"), taker = kick.taker, plan = plan, keeper = keeper, context = "shootout" }, { "side", "taker", "plan", "keeper", "context" }))
		end
		standBackForRunup(m, sc)
		setUpKeeper(m, sc, Js.ushr(Js.bxor(m.seed, 19326), 0))
		m.sc = sc
		frameScenario(m, sc)
		clearChance(m)
		m.shootoutKick = Js.O({ resolve = submit }, { "resolve" })
		setPhase(m, "aim")
		logMoment(m, (if kick.taker.you then "Your penalty — up to you." else (kick.taker.shortName .. " steps up…")), "you")
		if (not kick.taker.you) then
			scheduleAutoKick(m)
		end
	end
	finishShootout = function(m, result)
		m.shootoutResult = result
		m.liveShootout = nil
		finish(m, result)
	end
	pointerDown = function(m, p)
		if ((m.phase == "aim") and M_penaltyTaking.autoKickOf(m.sc)) then
			do return end
		end
		if (((m.phase == "aim") and M_airDrawings.isAirKind(m.sc.kind)) and M_airTap.airTapOn()) then
			do return end
		end
		if (m.phase == "tdDribble") then
			if m.tdReady then
				m.tdReady = false
			end
			do return end
		end
		if ((m.phase ~= "aim") or (m.windUp ~= nil)) then
			do return end
		end
		local b = m.sc.ball
		local r = captainPickAt(m, p)
		if Js.T(r) then
			m.captainDrag = Js.O({ target = r, from = p, to = p }, { "target", "from", "to" })
			do return end
		end
		local ballD = Math.hypot((p.x - b.x), (p.y - b.y))
		if (ballD >= nearestCaptainCandidateDist(m, p)) then
			do return end
		end
		if (ballD > sameOnScreenM(m, BALL_GRAB_FRACTION)) then
			do return end
		end
		m.dragging = true
		m.thumbOrigin = p
		m.drag = Js.O({ x = b.x, y = b.y }, { "x", "y" })
	end
	exports.pointerDown = pointerDown
	pointerMove = function(m, p)
		if m.captainDrag then
			m.captainDrag.to = p
			do return end
		end
		if (not m.dragging) then
			do return end
		end
		local o = m.thumbOrigin
		local bb = m.sc.ball
		m.drag = (if o then Js.O({ x = (bb.x + (p.x - o.x)), y = (bb.y + (p.y - o.y)) }, { "x", "y" }) else p)
		if ((((m.aimCommitAt == nil) and (m.phase == "aim")) and M_canvasEngine.acceptsCaptainOrders(m.sc.kind)) and (screenPull(m, m.drag, bb) >= MIN_PULL)) then
			commitAim(m)
		end
	end
	exports.pointerMove = pointerMove
	pointerUp = function(m)
		if m.captainDrag then
			local _d5 = m.captainDrag
			local target = _d5.target
			local from = _d5.from
			local to = _d5.to
			m.captainDrag = nil
			local sc = m.sc
			local isTap = (Math.hypot((to.x - from.x), (to.y - from.y)) < CAPTAIN_DRAG_MIN)
			if (target == "follower") then
				if isTap then
					sc.relayToFollower = (not sc.relayToFollower)
					if sc.relayToFollower then
						sc.relayTo = nil
					end
				else
					sc.follower.commandedTo = Js.O({ x = to.x, y = to.y }, { "x", "y" })
				end
			elseif isTap then
				sc.relayTo = (if (sc.relayTo == target) then nil else target)
				if sc.relayTo then
					sc.relayToFollower = false
				end
			else
				target.commandedTo = Js.O({ x = to.x, y = to.y }, { "x", "y" })
			end
			do return end
		end
		if (not m.dragging) then
			do return end
		end
		m.dragging = false
		local d = m.drag
		m.drag = nil
		m.thumbOrigin = nil
		if (not d) then
			do return end
		end
		local b = m.sc.ball
		local power = powerFromDrag(m, d, b)
		if ((m.aimCommitAt ~= nil) and ((screenPull(m, d, b) < MIN_PULL) or (power < 0.02))) then
			loseChance(m, "letgo")
			do return end
		end
		if (screenPull(m, d, b) < MIN_PULL) then
			do return end
		end
		if (power < 0.02) then
			do return end
		end
		local dir = Js.O({ x = (b.x - d.x), y = (b.y - d.y) }, { "x", "y" })
		if M_penaltyRunup.hasRunup(m.sc.kind) then
			startRunup(m, dir, power)
			do return end
		end
		m.aim = Js.O({ dir = dir, power = power }, { "dir", "power" })
		if (((m.powerArmed and M_shotModel.knucklePowerOn()) and mechOpen(m, "powerShot")) and M_shotModel.aimedAtGoal(m.sc, dir)) then
			m.powerStrike = true
			m.powerArmed = false
			m.windUp = M_shotModel.POWER_SHOT_WINDUP_S
			pushLine(m, "He pulls the leg right back…")
			do return end
		end
		m.powerStrike = false
		setPhase(m, "contact")
	end
	exports.pointerUp = pointerUp
	armPowerShot = function(m, on)
		m.powerArmed = on
	end
	exports.armPowerShot = armPowerShot
	curveSwipe = function(m, lateral, other)
		if (((m.phase ~= "flight") or (not m.setup.canCurve)) or (not m.ball)) then
			do return end
		end
		local dir = M_canvasEngine.curveDirFromSwipe(lateral, other)
		if Js.T(dir) then
			M_canvasEngine.applyCurveSwipe(m.ball, dir)
		end
	end
	exports.curveSwipe = curveSwipe
	runupNudge = function(m, alongShareOfWidth, base)
		local ru = m.runup
		if (((not ru) or ru.arrived) or (not ru.nudge)) then
			do return end
		end
		local vp = m.camera
		local width = (if (m.facing == "up") then (vp.x2 - vp.x1) else (vp.y2 - vp.y1))
		local mm = M_penaltyRunup.nudgeFromDrag(alongShareOfWidth, 1, width)
		ru.nudgeM = Math.max((-M_penaltyRunup.RUNUP.nudgeMaxM), Math.min(M_penaltyRunup.RUNUP.nudgeMaxM, (base + mm)))
	end
	exports.runupNudge = runupNudge
	contact = function(m, c)
		if (m.phase ~= "contact") then
			do return end
		end
		local sc = m.sc
		if m.powerStrike then
			m.powerStrike = false
			do return end
		end
		if (M_airDrawings.isAirKind(sc.kind) and M_airTap.airTapOn()) then
			local st = M_airTap.airTapStrike(sc.kind, sc.ball, c, airAerialNow(m))
			handleContact(m, Js.ospread(st.contact, Js.O({ aim = st.aim }, { "aim" })))
		else
			handleContact(m, c)
		end
	end
	exports.contact = contact
	powerContact = function(m, q)
		if ((m.phase ~= "contact") or (not m.powerStrike)) then
			do return end
		end
		local r = M_season.mulberry32(M_shotModel.shotSeedFor(Js.bxor(m.seed, 36979), m.rngCalls))
		m.powerStrike = false
		handleContact(m, M_shotModel.POWER_SHOT_CONTACT, nil, Js.ospread(M_shotModel.powerShotStrike(q, r), Js.O({ noKnuckle = true }, { "noKnuckle" })))
	end
	exports.powerContact = powerContact
	contactTimeout = function(m)
		if ((m.phase ~= "contact") or (not m.aim)) then
			do return end
		end
		local r = M_season.mulberry32(Js.ushr(Js.bxor(Js.bxor(m.seed, Math.imul((m.rngCalls + 1), 668265261)), 23567), 0))
		local s = M_penaltyRunup.scuffStrike(m.aim.dir, m.aim.power, r)
		showAction(m, "SCUFFED")
		handleContact(m, s.contact, Js.O({ dir = s.dir, power = s.power }, { "dir", "power" }))
	end
	exports.contactTimeout = contactTimeout
	steerRun = function(m, x, y, sprint)
		m.steer = Js.O({ x = x, y = y, sprint = sprint }, { "x", "y", "sprint" })
	end
	exports.steerRun = steerRun
	callForBall = function(m)
		local po = m.playOn
		if ((not (function() local _v = po; if _v == nil then return nil end; _v = _v.stick; return _v end)()) or (m.phase ~= "flight")) then
			do return nil end
		end
		local r = M_playOn.callForIt(po, m.sc)
		if (r == "late") then
			do return "Too late, he's shooting" end
		end
		if (r == "coming") then
			do return "It's coming!" end
		end
		pushLine(m, (playerLabel(m) .. " calls for it…"))
		do return "Calling for it!" end
	end
	exports.callForBall = callForBall
	dribbleStick = function(m, x, y)
		local run = m.td
		if ((not run) or (m.phase ~= "tdDribble")) then
			do return end
		end
		if (m.tdReady and (Math.hypot(x, y) > 0.08)) then
			m.tdReady = false
		end
		M_firstPersonDribble.applyStick(run, x, y)
	end
	exports.dribbleStick = dribbleStick
	dribbleBurst = function(m, dir)
		local run = m.td
		if (((not run) or (m.phase ~= "tdDribble")) or (run.phase ~= "running")) then
			do return false end
		end
		if m.tdReady then
			m.tdReady = false
		end
		do return M_firstPersonDribble.applyBurst(run, dir) end
	end
	exports.dribbleBurst = dribbleBurst
	dribblePass = function(m, p)
		local run = m.td
		if (((not run) or (m.phase ~= "tdDribble")) or (run.phase ~= "running")) then
			do return false end
		end
		local mi = A.findIndex(run.mates, function(mm)
			return (Math.hypot((mm.x - p.x), (mm.y - p.y)) < 3)
		end)
		if (mi < 0) then
			do return false end
		end
		M_firstPersonDribble.applyPass(run, mi, m.vision)
		do return true end
	end
	exports.dribblePass = dribblePass
	continuePause = function(m)
		local p = m.pause
		if (not p) then
			do return end
		end
		p.go()
	end
	exports.continuePause = continuePause
	drinkKib = function(m)
		local restore = ((function() local _v = A.find(M_shopData.KIB_CANS, function(c)
			return (c.id == "basic")
		end); if _v == nil then return nil end; _v = _v.restore; return _v end)() or 65)
		local owned = (((function() local _v = m.career.kibCans; if _v == nil then return nil end; _v = _v.basic; return _v end)() or 0) - m.kibUsed)
		if ((owned <= 0) or (m.energy >= 100)) then
			do return end
		end
		m.kibUsed += 1
		m.energy = M_energy.clampEnergy((m.energy + restore))
	end
	exports.drinkKib = drinkKib
	cycleSpeed = function(m)
		m.speed = (if (m.speed == 1) then 2 else (if (m.speed == 2) then 4 else (if (m.speed == 4) then 8 else 1)))
		m.feedWait = nil
	end
	exports.cycleSpeed = cycleSpeed
	setEnergyMode = function(m, mode)
		if (mode == m.energyMode) then
			do return end
		end
		chargeEnergyTo(m, m.minute)
		m.energyMode = mode
		local stretch = m.stretch
		if ((stretch and (m.phase == "feed")) and (not Js.T(m.hooked))) then
			A.push(stretch.changes, Js.O({ minute = (m.minute + 1), mode = mode }, { "minute", "mode" }))
			startSimulation(m, true)
		end
	end
	exports.setEnergyMode = setEnergyMode
	setPlaystyle = function(m, ps)
		if (ps == m.playstyle) then
			do return end
		end
		m.playstyle = ps
		local stretch = m.stretch
		if ((stretch and (m.phase == "feed")) and (not Js.T(m.hooked))) then
			m.playstyleChanges = Js.aspread(m.playstyleChanges, Js.alit(Js.O({ minute = (m.minute + 1), playstyle = ps }, { "minute", "playstyle" })))
			startSimulation(m, true)
		end
	end
	exports.setPlaystyle = setPlaystyle
	toggleTouchMode = function(m)
		m.touchModeOn = (not m.touchModeOn)
	end
	exports.toggleTouchMode = toggleTouchMode
	captainPickAt = function(m, p)
		if (not m.career.captain) then
			do return nil end
		end
		local sc = m.sc
		if (not M_canvasEngine.acceptsCaptainOrders(sc.kind)) then
			do return nil end
		end
		local grab = Math.max(sameOnScreenM(m, (2.2 / 42)), sameOnScreenM(m, 0.09))
		local best = nil
		local bestD = grab
		do
			local _arr6 = M_canvasEngine.orderableRunners(sc)
			local _i7 = 0
			while _i7 < Js.alen(_arr6) do
				_i7 += 1
				local r = _arr6[_i7]
				local d = Math.hypot((p.x - r.pos.x), (p.y - r.pos.y))
				if (d < bestD) then
					bestD = d
					best = r
				end
			end
		end
		if M_canvasEngine.goalInView(sc.kind) then
			local d = Math.hypot((p.x - sc.follower.x), (p.y - sc.follower.y))
			if (d < bestD) then
				bestD = d
				best = "follower"
			end
		end
		do return best end
	end
	nearestCaptainCandidateDist = function(m, p)
		if (not m.career.captain) then
			do return math.huge end
		end
		local sc = m.sc
		if (not M_canvasEngine.acceptsCaptainOrders(sc.kind)) then
			do return math.huge end
		end
		local best = math.huge
		do
			local _arr8 = M_canvasEngine.orderableRunners(sc)
			local _i9 = 0
			while _i9 < Js.alen(_arr8) do
				_i9 += 1
				local r = _arr8[_i9]
				best = Math.min(best, Math.hypot((p.x - r.pos.x), (p.y - r.pos.y)))
			end
		end
		if M_canvasEngine.goalInView(sc.kind) then
			best = Math.min(best, Math.hypot((p.x - sc.follower.x), (p.y - sc.follower.y)))
		end
		do return best end
	end
	commitAim = function(m)
		m.aimCommitAt = m.now
		local sc = m.sc
		m.presser = nil
		if (m.setup.pressure > 0) then
			local best = nil
			local bestD = math.huge
			do
				local _arr10 = sc.defenders
				local _i11 = 0
				while _i11 < Js.alen(_arr10) do
					_i11 += 1
					local d = _arr10[_i11]
					local dist = Math.hypot((d.x - sc.ball.x), (d.y - sc.ball.y))
					if (dist < bestD) then
						bestD = dist
						best = d
					end
				end
			end
			m.presser = best
			m.presserBehind = ((not (not best)) and M_pressure.pressFromBehind(best, sc.ball, sc.player))
		end
		if (m.career.captain and (A.some(M_canvasEngine.orderableRunners(sc), function(r)
			return (not (not r.commandedTo))
		end) or (not (not sc.follower.commandedTo)))) then
			pushLine(m, "He's off — play it before he's past the last man.")
		end
	end
	loseChance = function(m, why)
		if ((m.phase ~= "aim") and (m.phase ~= "contact")) then
			do return end
		end
		m.aimCommitAt = nil
		m.presser = nil
		m.dragging = false
		m.drag = nil
		m.thumbOrigin = nil
		m.aim = nil
		if ((why == "pressed") and (M_season.mulberry32(Js.ushr(Js.bxor(m.seed, 15778213), 0))() < M_pressure.foulShareFor(m.presserBehind))) then
			fouled(m)
			do return end
		end
		resolveOutcome(m, "tackled")
		showAction(m, (if (why == "letgo") then "CHANCE GONE" else "CLOSED DOWN"))
		pushLine(m, (if (why == "letgo") then "Hesitates, lets it go — and the chance is gone." else "Closed down before he could play it!"))
	end
	fouled = function(m)
		local b = m.sc.ball
		local inBox = (((b.y <= M_pitch.BOX_DEPTH) and (b.x >= M_pitch.BOX_L)) and (b.x <= M_pitch.BOX_R))
		local kind = (if inBox then "penalty" else "free_kick")
		m.outcome = nil
		setPhase(m, "result")
		showAction(m, (if inBox then "PENALTY" else "FOUL"))
		pushLine(m, (if inBox then "Brought down in the box — penalty!" else "Chopped down as he pulls back — free kick."))
		if mayTake(m, kind) then
			m.setPieceNext = kind
			M_hiddenMatch.resolveScenario(m.st, "delivered")
			after(m, 1600, function()
				return loadScenario(m, true)
			end)
		else
			m.handover = kind
			after(m, 1800, function()
				return startSimulation(m)
			end)
		end
	end
	stepCommitted = function(m, dt)
		local sc = m.sc
		local since = (m.now - (if m.aimCommitAt ~= nil then m.aimCommitAt else m.now))
		do
			local _arr12 = M_canvasEngine.orderableRunners(sc)
			local _i13 = 0
			while _i13 < Js.alen(_arr12) do
				_i13 += 1
				local r = _arr12[_i13]
				local to = r.commandedTo
				if (not to) then
					do continue end
				end
				local dx = (to.x - r.pos.x)
				local dy = (to.y - r.pos.y)
				local togo = Math.hypot(dx, dy)
				if (togo < 0.6) then
					r.heldAt = Js.O({ x = to.x, y = to.y }, { "x", "y" })
					r.commandedTo = nil
					r.moving = false
					do continue end
				end
				local step = Math.min(togo, (r.speed * dt))
				r.pos.x += ((dx / togo) * step)
				r.pos.y += ((dy / togo) * step)
				r.moving = true
				r.sprint = true
			end
		end
		local f = sc.follower
		if f.commandedTo then
			local dx = (f.commandedTo.x - f.x)
			local dy = (f.commandedTo.y - f.y)
			local togo = Math.hypot(dx, dy)
			if (togo < 0.6) then
				f.heldAt = Js.O({ x = f.commandedTo.x, y = f.commandedTo.y }, { "x", "y" })
				f.commandedTo = nil
				f.active = false
			else
				local step = Math.min(togo, (FOLLOWER_RUN_SPEED * dt))
				f.x += ((dx / togo) * step)
				f.y += ((dy / togo) * step)
				f.active = true
			end
		end
		local d = m.presser
		if (d and (since > M_pressure.PRESS_REACT_S)) then
			local b = sc.ball
			if (Math.hypot((b.x - d.x), (b.y - d.y)) <= M_pressure.PRESS_WIN_R) then
				loseChance(m, "pressed")
				do return end
			end
			M_pressure.pressStep(d, b, sc.player, (M_pressure.pressSpeedFor(m.setup.pressure) * dt))
		end
	end
	startRunup = function(m, rawDir, power, auto)
		local sc = m.sc
		local L = (function() local _l = Math.hypot(rawDir.x, rawDir.y); if Js.T(_l) then return _l end; return 1 end)()
		local dir0 = Js.O({ x = (rawDir.x / L), y = (rawDir.y / L) }, { "x", "y" })
		local styleId = runupStyleFor(m, sc)
		local styled = M_runupStyles.planRunup(styleId, sc.ball, sc.player)
		local _ = M_penaltyRunup.plantBeside
		m.runup = Js.ospread(Js.O({ t = 0, dir0 = dir0, power = power, nudgeM = 0, nudge = ((not auto) and M_penaltyRunup.canNudge(sc.kind)), arrived = false, styled = styled, runS = M_runupStyles.RUNUP_MOTION[styleId].runS }, { "t", "dir0", "power", "nudgeM", "nudge", "arrived", "styled", "runS" }), (if auto then Js.O({ auto = auto }, { "auto" }) else Js.O({}, nil)))
		if auto then
			setPhase(m, "runup")
			do return end
		end
		m.aim = Js.O({ dir = dir0, power = power }, { "dir", "power" })
		setPhase(m, "runup")
		pushLine(m, "He runs up…")
	end
	airAerialNow = function(m)
		do return Math.round((M_aerial.aerialOf(m.career.skills) * (1 - M_energy.fatigueCut(liveEnergyAt(m, m.minute))))) end
	end
	handleContact = function(m, tapped, over, extras)
		local a = (if over then Js.O({ dir = over.dir, power = over.power }, { "dir", "power" }) else (if tapped.aim ~= nil then tapped.aim else m.aim))
		if (not a) then
			do return end
		end
		local aerNow = (if (((not over) and ((function() local _v = m.aerial; if _v == nil then return nil end; _v = _v.sc; return _v end)() == m.sc)) and m.aerial.opened) then m.aerial else nil)
		if aerNow then
			a = M_aerialMoves.aerialStrikeTint(aerNow.move, a.dir, a.power, Js.ushr(Js.bxor(m.seed, Math.imul((m.rngCalls + 1), 668265261)), 0))
		end
		local ct = Js.O({ cx = tapped.cx, cy = tapped.cy }, { "cx", "cy" })
		if (((not over) and (tapped.lift ~= nil)) and (M_airborneChance.airborneOn() or M_airDrawings.isAirKind(m.sc.kind))) then
			local mo = strikeMotion(m.sc.kind, m.seed)
			if ((mo == "float") or (mo == "bounce")) then
				ct = Js.ospread(ct, Js.O({ air = Js.O({ kind = (if (mo == "float") then "header" else "volley"), lift = tapped.lift, cx = tapped.cx, cy = tapped.cy }, { "kind", "lift", "cx", "cy" }) }, { "air" }))
			end
		end
		local auto = (if (function() local _v = over; if _v == nil then return nil end; _v = _v.skills; return _v end)() then Js.O({ skills = over.skills }, { "skills" }) else nil)
		m.contactTimerS = nil
		local tired = tiredSkills(m)
		local fkRaw = m.career.skills.freeKick
		local strikeWith = (if auto then auto.skills else M_setPieces.setPieceSkills(tired, (if (fkRaw == nil) then tired.technique else (fkRaw * (1 - M_energy.fatigueCut(liveEnergyAt(m, m.minute))))), m.sc.kind))
		local feelPow = (((not auto) and M_shotFeel.shotPowerOn()) and M_shotFeel.struckAtGoal(m.sc, a.dir, ct.cx))
		local launchWith = (if feelPow then Js.ospread(strikeWith, Js.O({ power = M_shotFeel.feelPower(strikeWith.power) }, { "power" })) else (if M_compareSwitches.switchOn("powerCurve") then Js.ospread(strikeWith, Js.O({ power = M_strikePower.strikingPower(strikeWith.power) }, { "power" })) else strikeWith))
		if ct.air then
			ct = Js.ospread(ct, Js.O({ air = Js.ospread(ct.air, Js.O({ tech = launchWith.technique, aerial = Math.round((M_aerial.aerialOf(m.career.skills) * (1 - M_energy.fatigueCut(liveEnergyAt(m, m.minute))))) }, { "tech", "aerial" })) }, { "air" }))
		end
		local shotPro = ((not auto) and M_shotModel.shotsPro())
		local shotKnuckle = (((not auto) and M_shotModel.knucklePowerOn()) and mechOpen(m, "knuckle"))
		local shotField = ((not auto) and M_shotFeel.contactFieldOn())
		local shotLift = (if feelPow then M_shotFeel.feelLift(strikeWith.power) else 1)
		local shotRec = (if ((((shotPro or shotKnuckle) or extras) or shotField) or (shotLift ~= 1)) then Js.O({ seed = M_shotModel.shotSeedFor(m.seed, m.rngCalls), extras = extras, pro = shotPro, knuckle = shotKnuckle, field = shotField, lift = shotLift }, { "seed", "extras", "pro", "knuckle", "field", "lift" }) else nil)
		m.physAcc = 0
		m.deflections = 0
		m.matePlays = Js.alit()
		m.strikeAt = Js.O({ x = m.sc.ball.x, y = m.sc.ball.y }, { "x", "y" })
		if shotRec then
			m.ball = M_shotModel.launchShot(m.sc, a.dir, a.power, ct, launchWith, m.rng, shotRec, shotRec, M_canvasEngine.launch).ball
		else
			m.ball = M_canvasEngine.launch(m.sc, a.dir, a.power, ct, launchWith, m.rng)
		end
		M_airborneChance.applyAirborne(m.ball, m.sc, ct.air)
		if M_keeperBrain.hasBrain(m.sc) then
			local bs = Js.ushr(Js.bxor(Js.bxor(Js.bxor(m.seed, Math.imul((m.rngCalls + 1), 3266489909)), 19327), m.keeperSalt), 0)
			M_keeperBrain.brainStrike(m.sc, m.ball, bs)
		elseif (m.sc.kind == "penalty") then
			local facing = ((function() local _v = M_penaltyTaking.autoKickOf(m.sc); if _v == nil then return nil end; _v = _v.keeper; if _v == nil then return nil end; _v = _v.strength; return _v end)() or m.strength)
			local read = M_penaltyKeeper.penaltyReadFor(facing, nil)
			local r = M_season.mulberry32(Js.ushr(Js.bxor(Js.bxor(Js.bxor(m.seed, Math.imul((m.rngCalls + 1), 2654435761)), 24301), m.keeperSalt), 0))
			M_penaltyKeeper.applyPenaltyRead(m.sc, M_penaltyKeeper.decidePenaltyRead(m.sc, m.ball, read, Js.alit(r(), r())))
		end
		m.runup = nil
		m.cheekyStrike = (if auto then nil else M_penaltyRunup.cheekyStrike(m.sc.kind, m.ball, ((m.sc.goal.x1 + m.sc.goal.x2) / 2), (m.ball.youStruckAtGoal == true)))
		do
			local r = M_season.mulberry32(Js.ushr(Js.bxor(Js.bxor(m.seed, Math.imul((m.rngCalls + 1), 2246822507)), 27421), 0))
			m.strikeRule = M_index.strikeKind(m.sc, m.ball, r, Js.ospread(Js.O({ keeperStrength = m.strength, setPieceSkill = nil, power = strikeWith.power, technique = strikeWith.technique }, { "keeperStrength", "setPieceSkill", "power", "technique" }), (if ((not auto) and (runupStyleFor(m, m.sc) == M_runupStyles.LEAF_RUNUP)) then Js.O({ runup = M_runupStyles.LEAF_RUNUP }, { "runup" }) else Js.O({}, nil))))
		end
		if ((m.touchModeOn and m.setup.canExtraTouch) and (not auto)) then
			m.sc.player = Js.O({ x = m.ball.pos.x, y = m.ball.pos.y }, { "x", "y" })
		end
		m.playOn = nil
		m.playOnCaught = false
		do
			local sc = m.sc
			Js.del(sc, "matePace")
			local touchOn = (m.touchModeOn and m.setup.canExtraTouch)
			if (((not touchOn) and (not m.shootoutKick)) and M_playOn.runAfterWanted(Js.O({ kind = sc.kind, youShotAtGoal = (m.ball.youStruckAtGoal == true), auto = (not (not auto)) }, { "kind", "youShotAtGoal", "auto" }))) then
				m.playOnRng = M_season.mulberry32(Js.ushr(Js.bxor(Js.bxor(m.seed, Math.imul((m.rngCalls + 1), 2654435761)), 24999), 0))
				local bl = m.ball
				local stick = (M_afterPass.afterPassStickOn() and mechOpen(m, "steer"))
				m.playOn = M_playOn.startPlayOnRun(sc, m.playOnRng, Js.O({ x = (bl.pos.x + (bl.vel.x * 0.8)), y = (bl.pos.y + (bl.vel.y * 0.8)) }, { "x", "y" }), Js.O({ stick = stick, pace = m.career.skills.pace, energy = liveEnergyAt(m, m.minute), bar = m.bar }, { "stick", "pace", "energy", "bar" }))
				m.steer = nil
			end
		end
		setPhase(m, "flight")
		if ((m.sc.kind == "header") and (m.ball.lastTouch == "defence")) then
			pushLine(m, "He gets up highest and heads it clear!")
		else
			pushLine(m, M_matchCommentary.commentaryStrike(m.sc.kind, m.rng, targetName(m.sc)))
		end
	end
	resolveOutcome = function(m, res)
		m.outcome = res
		setPhase(m, "result")
		do
			local b = m.ball
			m.bootWait = (if ((function() local _v = b; if _v == nil then return nil end; _v = _v.cleared; return _v end)() and (not b.inNet)) then Js.O({ t = m.now, stopT = nil, ["then"] = nil }, { "t", "stopT", "then" }) else nil)
		end
		local sc = m.sc
		local receiverShot = (sc.receiverShot == true)
		local auto = M_penaltyTaking.autoKickOf(sc)
		local youShot = (((not auto) and ((function() local _v = m.ball; if _v == nil then return nil end; _v = _v.youStruckAtGoal; return _v end)() == true)) and (not receiverShot))
		local isSimplePass = (((not youShot) and (not receiverShot)) and (sc.passTarget ~= nil))
		local kind = M_canvasEngine.OUTCOME_TEXT[res].kind
		local yourFinish = (function()
			if auto then
				do return nil end
			end
			if (m.cheekyStrike == "chip") then
				do return "chip" end
			end
			local log = ((function() local _v = m.ball; if _v == nil then return nil end; _v = _v.actionLog; return _v end)() or Js.alit())
			local last = A.find(A.reverse(Js.aspread(log)), function(x)
				return ((x.kind == "shot") and (x.actor == "you"))
			end)
			do return (if ((function() local _v = last; if _v == nil then return nil end; _v = _v.mode; return _v end)() == "curl") then "curl" else nil) end
		end)()
		do
			local ch = m.cheekyStrike
			m.cheekyStrike = nil
			if (((Js.T(ch) and (not auto)) and ((sc.kind == "penalty") or youShot)) and M_penaltyRunup.isCheekyMiss(res)) then
				A.push(m.cheekyMisses, Js.O({ kind = ch, minute = m.minute }, { "kind", "minute" }))
			end
		end
		local isShootoutKick = (m.shootoutKick ~= nil)
		local assist = M_credit.assistFor(m.matePlays)
		local d = M_credit.creditChance(res, Js.O({ youShot = youShot, receiverShot = receiverShot, isSimplePass = isSimplePass, assistYours = assist.yours }, { "youShot", "receiverShot", "isSimplePass", "assistYours" }))
		local t = m.tally
		if ((not isShootoutKick) and (not auto)) then
			t.shots += d.shots
			t.goals += d.goals
			t.passes += d.passes
			t.passesCompleted += d.passesCompleted
			t.chances += d.chances
			t.assists += d.assists
			if ((((kind ~= "goal") and (res ~= "delivered")) and (res ~= "touchOn")) and (not receiverShot)) then
				if youShot then
					t.misses += 1
					local mk = M_chanceRating.missKind(sc.kind, res)
					if (mk == "penalty") then
						t.missesPen += 1
					elseif (mk == "oneOnOne") then
						t.misses1v1 += 1
					elseif (mk == "on") then
						t.missesOn += 1
					end
				else
					t.lost += 1
				end
			end
			if (d.goals > 0) then
				local z = M_chanceRating.goalZone(sc.kind, m.strikeAt)
				if (z == "penalty") then
					t.goalsPen += d.goals
				elseif (z == "tapIn") then
					t.goalsTap += d.goals
				elseif (z == "outside") then
					t.goalsOut += d.goals
				end
			end
			if (d.passesCompleted > 0) then
				local pg = M_chanceRating.passGrade(sc.passDifficulty, sc.passAmbition)
				if (pg == "safe") then
					t.passesSafe += d.passesCompleted
				elseif (pg == "ambitious") then
					t.passesAmb += d.passesCompleted
				end
			end
			m.strikeAt = nil
			if (res ~= "touchOn") then
				local out = (if (kind == "goal") then (if (d.goals > 0) then "goal" else (if (d.assists > 0) then "assist" else "pass")) else (if (res == "delivered") then "pass" else (if (res == "offside") then "offside" else (if receiverShot then "setup" else (if youShot then "miss" else (if (res == "tackled") then "tackled" else "lost"))))))
				A.push(m.chanceLog, Js.O({ minute = m.minute, kind = sc.kind, outcome = out }, { "minute", "kind", "outcome" }))
			end
		end
		if (((not isShootoutKick) and (not auto)) and (kind == "goal")) then
			m.userScore += 1
		end
		if ((not isShootoutKick) and (not auto)) then
			M_hiddenMatch.resolveScenario(m.st, matchResultFor(res))
		end
		if ((function() local _v = auto; if _v == nil then return nil end; _v = _v.side; return _v end)() == "them") then
			showAction(m, (if (kind == "goal") then "SCORED" else (if (((res == "saved") or (res == "caught")) or (res == "tipped")) then "SAVED!" else "MISSED!")))
		elseif (auto and (kind ~= "goal")) then
			showAction(m, (if (((res == "saved") or (res == "caught")) or (res == "tipped")) then "SAVED" else "MISSED"))
		elseif (kind == "goal") then
			showAction(m, "GOAL")
		elseif ((res == "tackled") or (res == "blocked")) then
			showAction(m, (if (res == "blocked") then "BLOCKED" else "INTERCEPTED"))
		elseif (res == "offside") then
			showAction(m, "OFFSIDE")
		elseif (res == "delivered") then
			showAction(m, (if (m.deflections > 0) then (if (sc.kind == "free_kick") then "OFF THE WALL" else "DEFLECTED") else "PASS"))
		elseif (res == "touchOn") then
			showAction(m, "TOUCH ON")
		elseif ((((res == "out") or (res == "wide")) or (res == "over")) or (res == "short")) then
			showAction(m, (if (res == "wide") then "WIDE" else (if (res == "over") then "OVER" else (if (res == "short") then "NOBODY THERE" else "OUT OF PLAY"))))
		elseif (res == "post") then
			showAction(m, "POST")
		elseif (((res == "saved") or (res == "caught")) or (res == "tipped")) then
			showAction(m, "SAVED")
		end
		local roleLabel = (function() local _v = sc.receiver; if _v == nil then return nil end; _v = _v.roleLabel; return _v end)()
		if (((not isShootoutKick) and (not auto)) and (kind == "goal")) then
			local squad = onPitch(m, (if m.career.squad ~= nil then m.career.squad else Js.alit()))
			local playerName = (m.career.player.firstName .. " " .. m.career.player.lastName)
			local rng = m.rng
			local how = (if (res == "rebound") then "rebound" else sc.kind)
			local distance = Math.hypot((sc.ball.x - ((sc.goal.x1 + sc.goal.x2) / 2)), sc.ball.y)
			local mateGoal = ((d.assists == 1) or (receiverShot and (not assist.yours)))
			if (mateGoal and sc.receiver) then
				local scorer = (if sc.receiver.who ~= nil then sc.receiver.who else (function()
					local forwards = A.filter(squad, function(p)
						return A.includes(Js.alit("ST", "CAM", "LW", "RW", "CM"), p.position)
					end)
					do return (M_squadData.pickSquadScorer((if (Js.alen(forwards) > 0) then forwards else squad), rng) or nil) end
				end)())
				if scorer then
					roleLabel = scorer.shortName
				end
				local scorerLabel = (((function() local _v = scorer; if _v == nil then return nil end; _v = _v.shortName; return _v end)() or sc.receiver.roleLabel) or "Team-mate")
				local mateAssist = (if assist.yours then nil else (function() local _v = assist.by; if _v == nil then return nil end; _v = _v.who; return _v end)())
				A.push(m.goalEvents, Js.ospread(Js.O({ minute = m.minute, scorer = (((function() local _v = scorer; if _v == nil then return nil end; _v = _v.name; return _v end)() or sc.receiver.roleLabel) or "Team-mate"), assist = (if assist.yours then playerName else (function() local _v = mateAssist; if _v == nil then return nil end; _v = _v.name; return _v end)()), isUserGoal = false, how = how, distance = Math.round(distance) }, { "minute", "scorer", "assist", "isUserGoal", "how", "distance" }), (if (assist.yours and sc.receivedAt) then Js.O({ passLength = Math.round(Math.hypot((sc.receivedAt.x - sc.ball.x), (sc.receivedAt.y - sc.ball.y))) }, { "passLength" }) else Js.O({}, nil))))
				logMoment(m, ("⚽ " .. scorerLabel .. " scores!"), "goal")
				if assist.yours then
					logMoment(m, ("🎯 " .. playerLabel(m) .. " assists!"), "assist")
				elseif mateAssist then
					logMoment(m, ("🎯 " .. mateAssist.shortName .. " assists!"), "assist")
				end
			elseif (d.goals == 1) then
				local assister = (if (res == "rebound") then nil else M_lineup.creatorOf(sc, squad, rng))
				A.push(m.goalEvents, Js.ospread(Js.O({ minute = m.minute, scorer = playerName, assist = (function() local _v = assister; if _v == nil then return nil end; _v = _v.name; return _v end)(), isUserGoal = true, how = how, distance = Math.round(distance) }, { "minute", "scorer", "assist", "isUserGoal", "how", "distance" }), (if Js.T(yourFinish) then Js.O({ finish = yourFinish }, { "finish" }) else Js.O({}, nil))))
				logMoment(m, ("⚽ " .. playerLabel(m) .. " scores!"), "goal")
				if assister then
					logMoment(m, ("🎯 " .. assister.shortName .. " assists!"), "assist")
				end
			else
				A.push(m.goalEvents, Js.ospread(Js.O({ minute = m.minute, scorer = playerName, isUserGoal = true, how = how, distance = Math.round(distance) }, { "minute", "scorer", "isUserGoal", "how", "distance" }), (if Js.T(yourFinish) then Js.O({ finish = yourFinish }, { "finish" }) else Js.O({}, nil))))
				logMoment(m, ("⚽ " .. playerLabel(m) .. " scores!"), "goal")
			end
		end
		pushLine(m, M_matchCommentary.commentaryResult(res, m.rng, Js.O({ chain = (sc.receiver ~= nil), receiverReached = (sc.receiverReached == true), roleLabel = roleLabel, isPass = isSimplePass }, { "chain", "receiverReached", "roleLabel", "isPass" })))
		if isShootoutKick then
			local cb = m.shootoutKick
			m.shootoutKick = nil
			local scored = (kind == "goal")
			after(m, 1400, function()
				return (function() local _r = cb; if _r == nil then return nil end; return _r.resolve(scored) end)()
			end)
			do return end
		end
		if (auto and (auto.context == "match")) then
			local saved = (((res == "saved") or (res == "caught")) or (res == "tipped"))
			if (kind == "goal") then
				m.userScore += 1
				A.push(m.goalEvents, Js.O({ minute = m.minute, scorer = auto.taker.name, isUserGoal = false, how = "penalty", distance = 11 }, { "minute", "scorer", "isUserGoal", "how", "distance" }))
				logMoment(m, ("⚽ " .. auto.taker.shortName .. " scores the penalty!"), "goal")
			else
				logMoment(m, (auto.taker.shortName .. "'s penalty is " .. (if saved then "saved" else "missed") .. "."), "chance")
			end
			M_hiddenMatch.resolveScenario(m.st, (if (kind == "goal") then "goal" else "saved"))
			after(m, 1800, function()
				return startSimulation(m)
			end)
			do return end
		end
		if auto then
			after(m, 1600, function()
				return loadScenario(m, false)
			end)
			do return end
		end
		local quickOn = false
		if ((res == "delivered") and m.playOnCaught) then
			m.playOnCaught = false
			local b = m.ball
			if b then
				m.chain = Js.O({ pos = Js.O({ x = b.pos.x, y = b.pos.y }, { "x", "y" }), depth = (if sc.chainDepth ~= nil then sc.chainDepth else 0), ambition = Math.max(sc.passDifficulty, (if sc.passAmbition ~= nil then sc.passAmbition else 0)), touchTouches = (if sc.touchTouches ~= nil then sc.touchTouches else 0) }, { "pos", "depth", "ambition", "touchTouches" })
				logMoment(m, (((function() local _v = sc.receivedBy; if _v == nil then return nil end; _v = _v.who; if _v == nil then return nil end; _v = _v.shortName; return _v end)() or "He") .. " lays it back to " .. playerLabel(m) .. "."), "chance")
				quickOn = true
			end
		elseif (res == "delivered") then
			local depth = (if sc.chainDepth ~= nil then sc.chainDepth else 0)
			local at = ((if sc.receivedAt ~= nil then sc.receivedAt else (function() local _v = sc.runner; if _v == nil then return nil end; _v = _v.pos; return _v end)()) or sc.passTarget)
			local onlyPlay = (not M_canvasEngine.goalInView(sc.kind))
			local who = ((function() local _v = sc.receivedBy; if _v == nil then return nil end; _v = _v.who; if _v == nil then return nil end; _v = _v.shortName; return _v end)() or targetName(sc))
			local returnChance = (if (onlyPlay and at) then M_giveAndGo.giveAndGoChance(sc, at) else M_canvasEngine.chainReturnChance(sc))
			if ((at and (depth < M_canvasEngine.CHAIN_MAX)) and (m.rng() < returnChance)) then
				local ambition = Math.max(sc.passDifficulty, (if sc.passAmbition ~= nil then sc.passAmbition else 0))
				m.chain = Js.O({ pos = Js.O({ x = at.x, y = at.y }, { "x", "y" }), depth = (depth + 1), ambition = ambition }, { "pos", "depth", "ambition" })
				pushLine(m, (if (at.y < 25) then "It comes straight back to you, higher up…" else "He lays it off — the move keeps going…"))
				logMoment(m, ((if who ~= nil then who else "He") .. " plays it back to " .. playerLabel(m) .. "."), "chance")
				if (M_newChances.newChancesOn() and (not M_canvasEngine.goalInView(sc.kind))) then
					quickOn = true
				else
					after(m, 900, function()
						return showAction(m, "BACK TO YOU")
					end)
				end
			else
				logMoment(m, ((if who ~= nil then who else "He") .. " keeps it — the move goes on without " .. playerLabel(m) .. "."), "chance")
			end
		elseif (res == "touchOn") then
			local touches = (if sc.touchTouches ~= nil then sc.touchTouches else 0)
			local b = m.ball
			if (b and (touches < M_canvasEngine.TOUCH_CHAIN_MAX)) then
				m.chain = Js.O({ pos = Js.O({ x = b.pos.x, y = b.pos.y }, { "x", "y" }), depth = (if sc.chainDepth ~= nil then sc.chainDepth else 0), ambition = Math.max(0.3, (if sc.passDifficulty ~= nil then sc.passDifficulty else 0)), touchTouches = (touches + 1) }, { "pos", "depth", "ambition", "touchTouches" })
			end
		end
		m.attempts += 1
		if m.chain then
			after(m, (if quickOn then 250 else 1600), function()
				return loadScenario(m, true)
			end)
			do return end
		end
		handOver(m, function()
			return startSimulation(m)
		end, 1800)
	end
	handOver = function(m, fn, ms)
		if m.bootWait then
			local gen = m.sceneGen
			m.bootWait["then"] = function()
				if (m.sceneGen == gen) then
					fn()
				end
			end
		else
			after(m, ms, fn)
		end
	end
	finishTopDownDribble = function(m, out)
		local run = m.td
		if ((not run) or (m.phase ~= "tdDribble")) then
			do return end
		end
		local pass = run.pass
		setPhase(m, "result")
		m.fpDribble = nil
		m.attempts += 1
		local rng = m.rng
		local cleared = (out == "clear")
		local beaten = Js.alen(A.filter(run.defenders, function(d)
			return (d.phase == "beaten")
		end))
		local fouledOut = (out == "fouled")
		if fouledOut then
			if (beaten > 0) then
				m.tally.dribbles += 1
			end
			A.push(m.chanceLog, Js.O({ minute = m.minute, kind = "dribble", outcome = "dribble" }, { "minute", "kind", "outcome" }))
			showAction(m, "FOUL")
			pushLine(m, "Brought down as he goes past him — free kick.")
			if mayTake(m, "free_kick") then
				m.setPieceNext = "free_kick"
				M_hiddenMatch.resolveScenario(m.st, "delivered")
				after(m, 1600, function()
					return loadScenario(m, true)
				end)
			else
				m.handover = "free_kick"
				after(m, 1800, function()
					return startSimulation(m)
				end)
			end
			do return end
		end
		local passed = ((not (not pass)) and pass.success)
		if (cleared or passed) then
			local t = m.tally
			if passed then
				t.passes += 1
				t.passesCompleted += 1
			end
			if ((beaten > 0) or cleared) then
				t.dribbles += 1
			end
			A.push(m.chanceLog, Js.O({ minute = m.minute, kind = "dribble", outcome = "dribble" }, { "minute", "kind", "outcome" }))
			local reward = M_dribbleReward.dribbleReward(Js.ospread(Js.O({ cleared = cleared, menBeaten = beaten, wavesBeaten = (M_firstPersonDribble.wavesBeaten(run) or (if cleared then 1 else 0)), totalWaves = (if Js.alen(run.roundSizes) ~= nil then Js.alen(run.roundSizes) else 1), mateX = (if passed then pass.at.x else nil) }, { "cleared", "menBeaten", "wavesBeaten", "totalWaves", "mateX" }), (if run.duels then Js.O({ bonusMen = 4 }, { "bonusMen" }) else Js.O({}, nil))), rng)
			if passed then
				pushLine(m, (if (reward.tier >= 3) then "Picks out the free man — and he's in." else (if (reward.tier >= 2) then "Draws them in and slips it wide." else "Lays it off early.")))
				showAction(m, "PASS")
			else
				pushLine(m, (if (reward.tier >= 4) then "Clean through — you've beaten the lot of them." else "You are through — and the chance is on."))
				showAction(m, "BEAT HIM")
			end
			m.chain = Js.O({ pos = reward.pos, depth = 0, ambition = reward.ambition, kind = reward.kind }, { "pos", "depth", "ambition", "kind" })
			M_hiddenMatch.resolveScenario(m.st, "delivered")
			after(m, 1200, function()
				return loadScenario(m, true)
			end)
			do return end
		end
		local passFailed = ((not (not pass)) and (not pass.success))
		pushLine(m, (if passFailed then "The pass is cut out." else "Taken off you."))
		m.outcome = "tackled"
		M_hiddenMatch.resolveScenario(m.st, "lost")
		local t = m.tally
		t.chances += 1
		t.lost += 1
		if passFailed then
			t.passes += 1
		end
		A.push(m.chanceLog, Js.O({ minute = m.minute, kind = "dribble", outcome = "tackled" }, { "minute", "kind", "outcome" }))
		after(m, 1600, function()
			return startSimulation(m)
		end)
	end
	tick_ = function(m, dt)
		dt = Math.min(Math.max(0, dt), 0.05)
		m.now += dt
		do
			local _first14 = true
			while true do
				_first14 = false
				local idx = -1
				for i = 0, (Js.alen(m.timers)) - 1 do
					local t = m.timers[i + 1]
					if ((t.at <= m.now) and ((idx < 0) or (t.at < m.timers[idx + 1].at))) then
						idx = i
					end
				end
				if (idx < 0) then
					do break end
				end
				local t = A.splice(m.timers, idx, 1)[1]
				if ((t.gen == nil) or (t.gen == m.sceneGen)) then
					t.fn()
				end
			end
		end
		if (m.phase == "feed") then
			stepFeed(m, dt)
		elseif (m.phase ~= "postmatch") then
			stepPlay(m, dt)
		end
	end
	exports.tick = tick_
	stepFeed = function(m, dt)
		if m.pause then
			do return end
		end
		local speed = Math.max(1, m.speed)
		if (m.feedWait ~= nil) then
			m.feedWait -= (dt * 1000)
			if (m.feedWait > 0) then
				do return end
			end
			m.feedWait = nil
			feedStep(m)
			do return end
		end
		if (Js.alen(m.queue) > 0) then
			local next_ = m.queue[1]
			m.feedWait = (if ((next_.minute ~= nil) and (next_.minute > m.minute)) then Math.round((MINUTE_TICK_MS / speed)) else M_matchLog.dwellFor(next_.tone, speed))
		elseif m.simContinue then
			m.feedWait = (if (m.st.minute > m.minute) then Math.round((MINUTE_TICK_MS / speed)) else Math.round((700 / speed)))
		end
	end
	feedStep = function(m)
		if (Js.alen(m.queue) > 0) then
			local next_ = m.queue[1]
			local cur = m.minute
			if ((next_.minute ~= nil) and (next_.minute > cur)) then
				local target = (cur + 1)
				if (((not m.halfTimeShown) and (target > M_matchLog.HALF_TIME_MINUTE)) and (cur >= M_matchLog.HALF_TIME_MINUTE)) then
					m.halfTimeShown = true
					showHalfTime(m)
					do return end
				end
				setClock(m, target)
				do return end
			end
			m.log = Js.aspread(m.log, Js.alit(next_))
			m.queue = A.slice(m.queue, 1)
			if (next_.minute ~= nil) then
				setClock(m, next_.minute)
			end
			if (((not m.halfTimeShown) and (next_.minute ~= nil)) and (next_.minute > M_matchLog.HALF_TIME_MINUTE)) then
				m.halfTimeShown = true
				showHalfTime(m)
			end
			do return end
		end
		local go = m.simContinue
		if (not go) then
			do return end
		end
		if (m.st.minute > m.minute) then
			local cur = m.minute
			local target = (cur + 1)
			if (((not m.halfTimeShown) and (target > M_matchLog.HALF_TIME_MINUTE)) and (cur >= M_matchLog.HALF_TIME_MINUTE)) then
				m.halfTimeShown = true
				showHalfTime(m)
				do return end
			end
			setClock(m, target)
			do return end
		end
		m.simContinue = nil
		m.stretch = nil
		go()
	end
	showHalfTime = function(m)
		m.halfTimeShown = true
		local ds = displayScore(m)
		local home = m.fixture.home
		m.log = Js.aspread(m.log, Js.alit(M_matchLog.line(("Half Time  " .. Js.numstr((if home then ds.user else ds.opp)) .. " - " .. Js.numstr((if home then ds.opp else ds.user))), "period", M_matchLog.HALF_TIME_MINUTE)))
		m.pause = Js.O({ cta = "Second half →", halfTime = true, go = function()
			m.pause = nil
		end }, { "cta", "halfTime", "go" })
	end
	stepPlay = function(m, dt)
		local sc = m.sc
		if (((m.phase == "tdDribble") and m.td) and (not m.tdReady)) then
			local out = M_firstPersonDribble.stepRun(m.td, dt)
			if (out ~= "running") then
				finishTopDownDribble(m, out)
			end
			do return end
		end
		if (m.phase == "aim") then
			M_canvasEngine.stepKeeper(sc, dt)
			M_keeperBrain.brainAim(sc, dt)
		end
		if ((m.phase == "aim") and (m.windUp ~= nil)) then
			M_shotModel.stepWindUp(sc, dt)
			m.windUp -= dt
			if (m.windUp <= 0) then
				m.windUp = nil
				setPhase(m, "contact")
			end
		end
		if ((((((((m.phase == "aim") and (not m.playOn)) and (not m.ball)) and M_airDrawings.isAirKind(sc.kind)) and M_airTap.airTapOn()) and (not M_penaltyTaking.autoKickOf(sc))) and (m.windUp == nil)) and (not m.dragging)) then
			if M_aerialMoves.aerialMovesOn() then
				local ar = m.aerial
				if ((not ar) or (ar.sc ~= sc)) then
					local kind = sc.kind
					local mate = sc.teammates[1]
					local move = (M_aerialMoves.forcedAerialMove(kind) or M_aerialMoves.pickAerialMove(Js.O({ kind = kind, ballZ = M_airDrawings.airZOf(sc), inDir = (if mate then Js.O({ x = (sc.ball.x - mate.x), y = (sc.ball.y - mate.y) }, { "x", "y" }) else Js.O({ x = 0, y = -1 }, { "x", "y" })), toGoal = Js.O({ x = (M_pitch.CX - sc.ball.x), y = (-sc.ball.y) }, { "x", "y" }), aerial = (airAerialNow(m) or 60), flair = (if m.career.skills.technique ~= nil then m.career.skills.technique else 50), seed = Js.ushr(Js.bxor(Js.bxor(m.seed, Math.imul(Math.round((sc.ball.x * 100)), 31)), Math.round((sc.ball.y * 100))), 0) }, { "kind", "ballZ", "inDir", "toGoal", "aerial", "flair", "seed" })))
					m.aerial = Js.O({ sc = sc, move = move, e = 0, preS = (M_airTap.AIR_TAP_OPEN_NO_LEAD_S - M_airTap.AIR_TAP_OPEN_S), opened = false }, { "sc", "move", "e", "preS", "opened" })
					ar = m.aerial
				else
					ar.e += dt
				end
				if ((not ar.opened) and (ar.e >= ((ar.preS + M_aerialMoves.AERIAL_SPECS[ar.move].riseS) + M_aerialMoves.CONTACT_SHOW_S))) then
					ar.opened = true
					m.airOpened = sc
					m.aim = M_airTap.airTapAim(sc.kind, sc.ball, 0)
					m.powerStrike = false
					setPhase(m, "contact")
				end
			else
				local w = m.airWait
				local t = (if (w and (w.sc == sc)) then (w.t + dt) else 0)
				m.airWait = Js.O({ sc = sc, t = t }, { "sc", "t" })
				if ((t >= M_airTap.AIR_TAP_OPEN_NO_LEAD_S) and (m.airOpened ~= sc)) then
					m.airOpened = sc
					m.aim = M_airTap.airTapAim(sc.kind, sc.ball, 0)
					m.powerStrike = false
					setPhase(m, "contact")
				end
			end
		end
		if ((m.phase == "aim") and (m.aimCommitAt ~= nil)) then
			stepCommitted(m, dt)
		end
		if (m.phase == "runup") then
			local ru = m.runup
			M_canvasEngine.stepKeeper(sc, dt)
			if (ru and (not ru.arrived)) then
				ru.t += dt
				local dirNow = (if ru.nudge then M_penaltyRunup.nudgedDir(sc.ball, ru.dir0, ru.nudgeM) else ru.dir0)
				M_keeperBrain.brainRunUp(sc, dt, ru.t, M_penaltyRunup.goalLineX(sc.ball, dirNow))
				sc.player = M_runupStyles.runupPositionAt(ru.styled, ru.t)
				if ((ru.t >= ru.runS) and ru.auto) then
					ru.arrived = true
					handleContact(m, ru.auto.contact, Js.O({ dir = dirNow, power = ru.power, skills = ru.auto.skills }, { "dir", "power", "skills" }))
				elseif (ru.t >= ru.runS) then
					ru.arrived = true
					m.aim = Js.O({ dir = dirNow, power = ru.power }, { "dir", "power" })
					m.contactTimerS = M_penaltyRunup.strikeTimerFor(sc.kind)
					setPhase(m, "contact")
				end
			end
		end
		if (m.ball and (m.facing ~= "up")) then
			local at = (if sc.crossSwitchY ~= nil then sc.crossSwitchY else 0)
			local view = (if sc.crossSwitchView then M_matchView.crossCutCamera(sc.crossSwitchView, PITCH_HW, m.ball.pos, m.tiltDeg) else sc.crossSwitchView)
			local withinX = (if view then ((m.ball.pos.x > (view.x1 - 1)) and (m.ball.pos.x < (view.x2 + 1))) else false)
			if ((view and (m.ball.pos.y < at)) and withinX) then
				m.facing = "up"
				m.camera = Js.ospread(view)
				sc.viewport = Js.ospread(view)
				local _ = M_matchView.figureShrinkFor
			end
		end
		if ((m.phase == "flight") and m.ball) then
			stepFlight(m, dt)
		end
		if ((m.phase == "result") and m.ball) then
			local b = m.ball
			if b.inNet then
				M_canvasEngine.stepBallInNet(b, dt)
			end
			if b.settling then
				M_canvasEngine.settleBall(b, dt, sc)
			end
			if b.overBar then
				M_canvasEngine.stepBallPastBar(b, dt)
			end
			if b.cleared then
				M_canvasEngine.stepBallCleared(b, dt, sc)
				local boot = m.bootWait
				if boot then
					if (b.resting and (boot.stopT == nil)) then
						boot.stopT = m.now
					end
					local off = ((((b.pos.x < (m.camera.x1 - 2)) or (b.pos.x > (m.camera.x2 + 2))) or (b.pos.y < (m.camera.y1 - 2))) or (b.pos.y > (m.camera.y2 + 2)))
					local done = ((off or ((boot.stopT ~= nil) and ((m.now - boot.stopT) >= M_tuningStore.getTuning("clearance.handOverAfterStop")))) or ((m.now - boot.t) >= M_tuningStore.getTuning("clearance.handOverMax")))
					if done then
						m.bootWait = nil;
						(function() local _f = boot["then"]; if _f == nil then return nil end; return _f() end)()
					end
				end
			end
		end
		if ((m.phase == "result") and (not sc.keeper.done)) then
			M_canvasEngine.stepKeeper(sc, dt)
			M_keeperBrain.brainStep(sc, m.ball, dt)
		end
		if ((m.phase == "result") and M_hitbox.hitboxesOn()) then
			M_canvasEngine.settleJumps(sc, dt)
		end
	end
	stepFlight = function(m, dt)
		local sc = m.sc
		local fixed = M_ballPhysics.realBallOn()
		local steps = 3
		if fixed then
			m.physAcc += dt
			steps = math.floor(((m.physAcc * 180) + 0.000001))
			m.physAcc = Math.max(0, (m.physAcc - (steps / 180)))
		end
		local po0 = m.playOn
		if (((function() local _v = po0; if _v == nil then return nil end; _v = _v.stick; return _v end)() and mechOpen(m, "steer")) and m.steer) then
			M_playOn.sprintPlayOn(po0, (m.steer.sprint and mechOpen(m, "sprint")))
			local l = Math.hypot(m.steer.x, m.steer.y)
			if (l > 0.000001) then
				M_playOn.steerPlayOn(po0, ((m.steer.x / Math.max(1, l)) * M_legs.KEY_PUSH), ((m.steer.y / Math.max(1, l)) * M_legs.KEY_PUSH))
			else
				M_playOn.steerPlayOn(po0, 0, 0)
			end
		end
		for i = 0, steps - 1 do
			local ball = m.ball
			local h = (if fixed then (1 / 180) else (dt / steps))
			M_canvasEngine.stepDefenders(sc, h, ball.pos, false, ball)
			M_canvasEngine.stepKeeper(sc, h)
			M_canvasEngine.stepReactions(sc, ball, h, m.rng)
			M_index.stepKind(sc, ball, h, m.strikeRule)
			M_keeperBrain.brainStep(sc, ball, h)
			local touchLive = ((((m.touchModeOn and m.setup.canExtraTouch) and (ball.owner == "you")) and (ball.lastTouch ~= "keeper")) and M_canvasEngine.acceptsCaptainOrders(sc.kind))
			local caughtUp = (touchLive and M_canvasEngine.stepTouchChase(sc, ball, h, M_canvasEngine.touchChaseSpeed(m.career.skills.pace)))
			local incoming = Js.O({ vx = ball.vel.x, vy = ball.vel.y, vz = ball.vz, z = ball.z, spin = ball.spin }, { "vx", "vy", "vz", "z", "spin" })
			local mateProbe = M_credit.probeMatePlays(sc)
			M_shotModel.stepKnuckle(ball, h)
			local po = m.playOn
			if (po and (not touchLive)) then
				local wasLive = po.layOffLive
				if po.stick then
					po.stick.kicking = false
				end
				local caughtIt = (M_playOn.stepPlayOn(po, sc, ball, h, m.playOnRng, m.layOffsLeft) == "caught")
				noteRunStep(m, po)
				if caughtIt then
					m.playOnCaught = true
					resolveOutcome(m, "delivered")
					do break end
				end
				if (po.layOffLive and (not wasLive)) then
					m.layOffsLeft -= 1
					pushLine(m, (if ((function() local _v = po.stick; if _v == nil then return nil end; _v = _v.choice; return _v end)() == "through") then "Through ball, into your run!" else (if po.stick then "He plays it back to your feet…" else "He lays it back into your run…")))
				end
				if Js.T((function() local _v = po.stick; if _v == nil then return nil end; _v = _v.note; return _v end)()) then
					po.stick.note = nil
				end
			end
			local res = M_canvasEngine.stepBall(ball, sc, m.rng, h)
			M_credit.noteMatePlays(m.matePlays, mateProbe, sc)
			local clr = M_canvasEngine.getClearanceRules()
			local secondLeft = ((not clr.miscues) or ((if sc.secondBalls ~= nil then sc.secondBalls else 0) < clr.secondBalls))
			if (((res == "blocked") and (m.deflections < 1)) and secondLeft) then
				m.deflections += 1
				if clr.miscues then
					sc.secondBalls = ((if sc.secondBalls ~= nil then sc.secondBalls else 0) + 1)
				end
				local r = M_season.mulberry32(Js.ushr(Js.bxor(Js.bxor(m.seed, Math.imul((m.rngCalls + 1), 668265261)), 57073), 0))
				M_deflection.deflectBlock(ball, sc, incoming, r)
				M_defenderTouch.steerDeflectionFromOwnGoal(ball, sc)
				res = nil
				showAction(m, "DEFLECTED")
				pushLine(m, "Blocked — and it's come off him loose!")
			end
			if ((not Js.T(res)) and caughtUp) then
				res = "touchOn"
			end
			if (res == "short") then
				M_defenderTouch.clearLooseWin(ball, sc)
			end
			if Js.T(res) then
				resolveOutcome(m, res)
				do break end
			end
		end
		local ev = (function() local _v = m.ball; if _v == nil then return nil end; _v = _v.event; return _v end)()
		local receiver = sc.receiver
		if (ev == "miscue") then
			pushLine(m, "He's miscued it — it's loose!")
			showAction(m, "MISCUED")
		end
		if (ev == "clearHit") then
			pushLine(m, "Cleared — but it cannons off a body and it's loose!")
			showAction(m, "DEFLECTED")
		end
		if (ev == "post") then
			pushLine(m, "Off the woodwork — and it's still live!")
			showAction(m, "POST")
		end
		if (Js.T(ev) and receiver) then
			local label = ((function() local _v = receiver.who; if _v == nil then return nil end; _v = _v.shortName; return _v end)() or receiver.roleLabel)
			if (ev == "received") then
				pushLine(m, M_matchCommentary.commentaryReceived(label, m.rng))
				showAction(m, (if (m.deflections > 0) then (if (sc.kind == "free_kick") then "OFF THE WALL" else "DEFLECTED") else "PASS"))
			elseif (ev == "receiverShot") then
				pushLine(m, M_matchCommentary.commentaryReceiverShot(label, m.rng))
			elseif (ev == "relay") then
				pushLine(m, (label .. " leaves it — the captain wanted it moved on."))
				showAction(m, "PASS")
			end
		end
		if m.ball then
			m.ball.event = nil
		end
	end
	noteRunStep = function(m, po)
		local legs = (function() local _v = po.stick; if _v == nil then return nil end; _v = _v.legs; return _v end)()
		if (not legs) then
			do return end
		end
		local spent = M_legs.takeEnergySpent(legs)
		if ((spent > 0) and (not Js.T(m.hooked))) then
			m.energy = M_energy.clampEnergy((m.energy - spent))
		end
		M_legs.setLegsEnergy(legs, liveEnergyAt(m, m.minute))
	end
	energyNow = function(m)
		do return liveEnergyAt(m, m.minute) end
	end
	exports.energyNow = energyNow
	staminaNow = function(m)
		local legs = (function() local _v = m.playOn; if _v == nil then return nil end; _v = _v.stick; if _v == nil then return nil end; _v = _v.legs; return _v end)()
		if legs then
			do return Js.O({ v = legs.stamina.v, cap = legs.cap, sprint = legs.sprinting }, { "v", "cap", "sprint" }) end
		end
		if (m.phase == "aim") then
			local cap = M_legs.barCap(energyNow(m))
			do return Js.O({ v = Math.min(m.bar, cap), cap = cap, sprint = false }, { "v", "cap", "sprint" }) end
		end
		do return nil end
	end
	exports.staminaNow = staminaNow
	aimPreview = function(m)
		if ((not m.dragging) or (not m.drag)) then
			do return nil end
		end
		local b = m.sc.ball
		do return Js.O({ dir = Js.O({ x = (b.x - m.drag.x), y = (b.y - m.drag.y) }, { "x", "y" }), power = powerFromDrag(m, m.drag, b) }, { "dir", "power" }) end
	end
	exports.aimPreview = aimPreview
	contactScreen = function(m)
		if ((m.phase ~= "contact") or (not m.aim)) then
			do return nil end
		end
		local motion = strikeMotion(m.sc.kind, m.seed)
		do return Js.O({ motion = motion, timerS = m.contactTimerS, power = m.aim.power, power2 = m.powerStrike, aimFromTap = (M_airDrawings.isAirKind(m.sc.kind) and M_airTap.airTapOn()), ballZ = (if (motion == "float") then (if (m.sc.kind == "header") then M_airDrawings.airZOf(m.sc) else M_airDrawings.HEADER_Z) else nil) }, { "motion", "timerS", "power", "power2", "aimFromTap", "ballZ" }) end
	end
	exports.contactScreen = contactScreen
	matchKits = function(m)
		do return Js.O({ us = (if m.fixture.home then m.kits.home else m.kits.away), them = (if m.fixture.home then m.kits.away else m.kits.home), keeper = m.kits.keeper, ourKeeper = m.ourKeeperKit }, { "us", "them", "keeper", "ourKeeper" }) end
	end
	exports.matchKits = matchKits
	BALL_GRAB_FRACTION = 0.18
	MIN_PULL = 0.008
	CAPTAIN_DRAG_MIN = 3
	DEFAULT_MATCH_DURATION = 90
	MINUTE_TICK_MS = 700
	QUICK_START_MAX = 12
	FOLLOWER_RUN_SPEED = 7
	PITCH_HW = (83 / 38)
	exports.PITCH_HW = PITCH_HW
	SIM_COMMENTARY_USER = Js.alit("{club} share the ball around patiently in midfield.", "{club}'s defence holds firm under pressure.", "{club}'s counter-attack breaks down in the final third.", "A tidy passing move from {club} comes to nothing.", "The ball is recycled patiently at the back for {club}.", "A promising run down the wing for {club} is halted by a strong tackle.", "{club}'s keeper comes out to claim a hopeful cross.", "A long ball forward for {club} finds nobody — easily dealt with.", "Neat footwork from {club} in the middle of the park creates some space.", "{club}'s fans are starting to get restless.", "A crunching challenge from {club} draws a free kick — nothing comes of it.", "The tempo drops as {club} look to regroup.", "A lovely piece of skill from {club} on the touchline, but the final ball lets them down.", "Chances have been at a premium for {club} here.")
	SIM_COMMENTARY_OPP = Js.alit("They share the ball around patiently in midfield.", "Their defence holds firm under pressure.", "Their counter-attack breaks down in the final third.", "A tidy passing move from them comes to nothing.", "The ball is recycled patiently at the back for them.", "A promising run down the wing for them is halted by a strong tackle.", "Their keeper comes out to claim a hopeful cross.", "A long ball forward for them finds nobody — easily dealt with.", "Neat footwork from them in the middle of the park creates some space.", "Their fans are starting to get restless.", "A crunching challenge from them draws a free kick — nothing comes of it.", "The tempo drops as they look to regroup.", "A lovely piece of skill from them on the touchline, but the final ball lets them down.", "Chances have been at a premium for them here.")
	newTally = function()
		return Js.O({ shots = 0, goals = 0, passes = 0, passesCompleted = 0, chances = 0, assists = 0, misses = 0, lost = 0, dribbles = 0, goalsPen = 0, goalsTap = 0, goalsOut = 0, passesSafe = 0, passesAmb = 0, missesOn = 0, missesPen = 0, misses1v1 = 0 }, { "shots", "goals", "passes", "passesCompleted", "chances", "assists", "misses", "lost", "dribbles", "goalsPen", "goalsTap", "goalsOut", "passesSafe", "passesAmb", "missesOn", "missesPen", "misses1v1" })
	end
	exports.POST_L = POST_L
	exports.POST_R = POST_R
end
