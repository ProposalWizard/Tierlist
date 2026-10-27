--!nocheck
--!nolint
-- Generated from roblox/game/trialPlay.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_pitch = import("lib/star/pitch")
	local M_canvasEngine = import("lib/star/canvasEngine")
	local M_trialStages = import("lib/star/trialStages")
	local M_trainingDrills = import("lib/star/trainingDrills")
	local M_trainingRender = import("lib/star/trainingRender")
	local M_season = import("lib/star/season")
	local M_trialShootoutRig = import("lib/star/trialShootoutRig")
	local M_squadData = import("lib/star/squadData")
	local M_fakeFaces = import("lib/star/fakeFaces")
	local M_runupStyles = import("lib/star/runupStyles")
	local M_trial = import("lib/star/trial")
	local M_match = import("roblox/game/match")
	local M_firstPersonDribble = import("lib/star/firstPersonDribble")
	local M_penaltyTaking = import("lib/star/penaltyTaking")
	local M_matchView = import("roblox/game/matchView")
	local BEHIND_BALL, SIDE_PAD, BASE_VIEW_H, freeKickView, freeKickWall, buildFreeKickScenario, buildGate, VISION_YOU, AREA, MARKER_BOX, BASE_SPACE, MIN_SPACE, REQUIRED_GAP_FRACTION, LAYOUT_ATTEMPTS, dist, oneLayout, layoutVision, US, THEM, MATE_KICKS, takersFor, LAST_RESULT_HOLD_S, FINAL_HOLD_S, COUNTDOWN_FROM, COUNTDOWN_STEP_S, VISION_WAIT_S, VISION_COUNT_S, VISION_REVEAL_S, VISION_PICK_M, DRIBBLE_HOLD_S, DRILL_FIXTURE, drillSetup, startTrialPlay, openStage, finishStage, openStrike, openDribble, visionRep, openVision, openShootout, tick_, settleVision, tapToGo, visionTap, dribbleSteer, dribbleKnock, pitchMatch, HINTS, trialView, TRIAL_KITS, VISION_CAMERA, trialFrame
	freeKickView = function(ball)
		local back = (M_pitch.NET_DEPTH + 2.5)
		local needH = ((ball.y + BEHIND_BALL) + back)
		local nx1 = (Math.min(M_pitch.POST_L, ball.x) - SIDE_PAD)
		local nx2 = (Math.max(M_pitch.POST_R, ball.x) + SIDE_PAD)
		local h = Math.max(BASE_VIEW_H, needH, ((nx2 - nx1) / M_canvasEngine.VIEW_ASPECT))
		local w = (h * M_canvasEngine.VIEW_ASPECT)
		local cx = ((nx1 + nx2) / 2)
		cx = M_canvasEngine.clamp(cx, (-5 + (w / 2)), ((M_pitch.PITCH_W + 5) - (w / 2)))
		cx = M_canvasEngine.clamp(cx, (nx2 - (w / 2)), (nx1 + (w / 2)))
		do return Js.O({ x1 = (cx - (w / 2)), x2 = (cx + (w / 2)), y1 = (-back), y2 = ((-back) + h) }, { "x1", "x2", "y1", "y2" }) end
	end
	exports.freeKickView = freeKickView
	freeKickWall = function(setup)
		local dx = (M_pitch.CX - setup.ball.x)
		local dy = (-setup.ball.y)
		local len = (function() local _l = Math.hypot(dx, dy); if Js.T(_l) then return _l end; return 1 end)()
		local to = Js.O({ x = (dx / len), y = (dy / len) }, { "x", "y" })
		local across = Js.O({ x = (-to.y), y = to.x }, { "x", "y" })
		local wallCx = (setup.ball.x + (to.x * 9.15))
		local wallCy = (setup.ball.y + (to.y * 9.15))
		local n = Math.max(1, Math.round(setup.wall))
		local men = Js.alit()
		for i = 0, math.ceil(n) - 1 do
			local off = ((i - ((n - 1) / 2)) * 1.15)
			A.push(men, Js.O({ x = M_canvasEngine.clamp((wallCx + (across.x * off)), 4, (M_pitch.PITCH_W - 4)), y = M_canvasEngine.clamp((wallCy + (across.y * off)), 2, M_pitch.HALF_LEN) }, { "x", "y" }))
		end
		do return men end
	end
	exports.freeKickWall = freeKickWall
	buildFreeKickScenario = function(trial, rep, rng)
		local setup = M_trialStages.freeKickSetup(trial, rep)
		local sc = M_canvasEngine.buildScenario("free_kick", rng, setup.keeperStrength, 60, 55)
		sc.ball = Js.ospread(setup.ball)
		sc.player = Js.O({ x = setup.ball.x, y = (setup.ball.y + 2) }, { "x", "y" })
		sc.defenders = freeKickWall(setup)
		sc.keeperStrength = setup.keeperStrength
		M_canvasEngine.initDefenders(sc, rng)
		sc.viewport = freeKickView(setup.ball)
		do return sc end
	end
	exports.buildFreeKickScenario = buildFreeKickScenario
	buildGate = function(level, rep, rng)
		local cfg = Js.ospread(M_trainingDrills.techniqueDrill(level, rep), Js.O({ pass = 0.25 }, { "pass" }))
		local ball = M_trainingDrills.techniqueBallSpot(cfg)
		local gate = M_trainingDrills.conePositions(ball, cfg)
		local sc = M_canvasEngine.buildScenario("long_range", rng, 40, 60, 55)
		sc.ball = Js.O({ x = ball.x, y = ball.y }, { "x", "y" })
		sc.player = Js.O({ x = ball.x, y = (ball.y + 0.8) }, { "x", "y" })
		sc.defenders = Js.alit()
		sc.teammates = Js.alit()
		sc.runner = nil
		sc.passTarget = nil
		sc.receiver = nil
		sc.secondaryRunners = Js.alit()
		M_canvasEngine.initDefenders(sc, rng)
		sc.defenders = Js.alit()
		sc.viewport = Js.ospread(M_trainingRender.gateViewport(ball, gate))
		sc.player = Js.O({ x = (sc.ball.x + 1.2), y = (sc.ball.y + 1.8) }, { "x", "y" })
		do return Js.O({ scenario = sc, gate = gate, gateCfg = cfg }, { "scenario", "gate", "gateCfg" }) end
	end
	exports.buildGate = buildGate
	oneLayout = function(setup, rng)
		local n = Math.max(2, Math.round(setup.options))
		local cols = math.ceil(Math.sqrt(n))
		local rows = math.ceil((n / cols))
		local cw = ((AREA.x2 - AREA.x1) / cols)
		local ch = ((AREA.y2 - AREA.y1) / rows)
		local pos = Js.alit()
		for i = 0, math.ceil(n) - 1 do
			local c = math.fmod(i, cols)
			local r = math.floor((i / cols))
			A.push(pos, Js.O({ x = ((AREA.x1 + (cw * (c + 0.5))) + (((rng() - 0.5) * cw) * 0.5)), y = ((AREA.y1 + (ch * (r + 0.5))) + (((rng() - 0.5) * ch) * 0.5)) }, { "x", "y" }))
		end
		local best = (BASE_SPACE + setup.margin)
		local markers = Js.alit()
		for i = 0, math.ceil(n) - 1 do
			local want = (if (i == setup.correct) then best else Math.max(MIN_SPACE, (best - (setup.margin * (0.85 + (rng() * 0.3))))))
			local a0 = ((rng() * Math.PI) * 2)
			local placed = nil
			do
				local k = 0
				local _first1 = true
				while true do
					if not _first1 then
						k += 1
					end
					_first1 = false
					if not ((k < 8) and (not placed)) then break end
					local a = (a0 + ((k * Math.PI) / 4))
					local m = Js.O({ x = (pos[i + 1].x + (Math.cos(a) * want)), y = (pos[i + 1].y + (Math.sin(a) * want)) }, { "x", "y" })
					if ((((m.x >= MARKER_BOX.x1) and (m.x <= MARKER_BOX.x2)) and (m.y >= MARKER_BOX.y1)) and (m.y <= MARKER_BOX.y2)) then
						placed = m
					end
				end
			end
			A.push(markers, (if placed ~= nil then placed else Js.O({ x = Math.min(MARKER_BOX.x2, Math.max(MARKER_BOX.x1, (pos[i + 1].x + want))), y = Math.min(MARKER_BOX.y2, Math.max(MARKER_BOX.y1, pos[i + 1].y)) }, { "x", "y" })))
		end
		local men = A.map(pos, function(p, i)
			return Js.O({ x = p.x, y = p.y, marker = markers[i + 1], space = Math.min(Js.unpack(A.map(markers, function(m)
				return dist(p, m)
			end))) }, { "x", "y", "marker", "space" })
		end)
		local others = A.map(A.filter(men, function(_, i)
			return (i ~= setup.correct)
		end), function(m)
			return m.space
		end)
		local gap = (men[setup.correct + 1].space - Math.max(Js.unpack(others)))
		do return Js.O({ you = Js.ospread(VISION_YOU), men = men, gap = gap }, { "you", "men", "gap" }) end
	end
	layoutVision = function(setup, seed, rep)
		local need = (setup.margin * REQUIRED_GAP_FRACTION)
		local bestLayout = nil
		for a = 0, LAYOUT_ATTEMPTS - 1 do
			local rng = M_season.mulberry32(Js.ushr(Js.bxor(Js.bxor(seed, ((rep + 1) * 668265261)), ((a + 1) * 374761393)), 0))
			local l = oneLayout(setup, rng)
			if (l.gap >= need) then
				do return l end
			end
			if ((not bestLayout) or (l.gap > bestLayout.gap)) then
				bestLayout = l
			end
		end
		do return bestLayout end
	end
	exports.layoutVision = layoutVision
	takersFor = function(trial, seed)
		local rating = M_trialStages.shootoutTheirRating(trial)
		local runups = M_trialShootoutRig.pickRunups(seed, (M_trialShootoutRig.SHOOTOUT_KICKS + MATE_KICKS))
		local rng = M_season.mulberry32(Js.ushr(Js.bxor(trial.seed, 31262), 0))
		local side = function(squadSeed, n, base, runupFrom)
			return A.map(A.slice(A.filter(M_squadData.generateSquad(squadSeed), function(p)
				return (p.position ~= "GK")
			end), 0, n), function(p, i)
				return Js.O({ id = M_trialShootoutRig.idForRunup((base .. "-" .. Js.numstr(i)), runups[(runupFrom + i) + 1]), name = p.name, shortName = p.shortName, face = (if p.imageUrl ~= nil then p.imageUrl else M_fakeFaces.fakeFaceFor((base .. "-" .. Js.numstr(i)))), rating = Math.max(30, Math.min(95, Math.round((rating + ((rng() - 0.5) * 10))))) }, { "id", "name", "shortName", "face", "rating" })
			end)
		end
		do return Js.O({ them = side(Js.ushr(Js.bxor(trial.seed, 20974), 0), M_trialShootoutRig.SHOOTOUT_KICKS, "academy", 0), mates = side(Js.ushr(Js.bxor(trial.seed, 14974), 0), MATE_KICKS, "trialist", M_trialShootoutRig.SHOOTOUT_KICKS) }, { "them", "mates" }) end
	end
	drillSetup = function(tp, seed, keeperStrength, drill)
		local c = tp.career
		do return Js.O({ career = c, fixture = DRILL_FIXTURE, skills = Js.O({ power = c.skills.power, technique = c.skills.technique }, { "power", "technique" }), canCurve = false, canExtraTouch = false, keeperStrength = keeperStrength, oppStrength = 70, position = c.player.position, teamRelationship = 60, startMinute = 0, conditions = nil, seed = seed, pressure = 0, penaltyRunup = M_runupStyles.careerPenaltyRunup(c), freeKickRunup = M_runupStyles.careerFreeKickRunup(c), drill = drill }, { "career", "fixture", "skills", "canCurve", "canExtraTouch", "keeperStrength", "oppStrength", "position", "teamRelationship", "startMinute", "conditions", "seed", "pressure", "penaltyRunup", "freeKickRunup", "drill" }) end
	end
	startTrialPlay = function(career)
		local tp = Js.O({ career = career, trial = career.trial, stage = nil, clock = 0, card = nil, strike = nil, dribble = nil, vision = nil, shootout = nil, back = Js.O({ results = Js.alit(), finalPenScored = false }, { "results", "finalPenScored" }), done = false }, { "career", "trial", "stage", "clock", "card", "strike", "dribble", "vision", "shootout", "back", "done" })
		openStage(tp)
		do return tp end
	end
	exports.startTrialPlay = startTrialPlay
	openStage = function(tp)
		local stage = M_trial.nextStage(tp.trial)
		tp.stage = stage
		tp.shootout = nil
		tp.vision = tp.shootout
		tp.dribble = tp.vision
		tp.strike = tp.dribble
		if (not Js.T(stage)) then
			tp.card = Js.O({ kind = "scout" }, { "kind" })
			do return end
		end
		tp.trial = M_trial.beginStage(tp.trial, stage)
		if (stage == "freeKicks") then
			openStrike(tp, "freeKicks")
		elseif (stage == "technique") then
			openStrike(tp, "technique")
		elseif (stage == "dribbling") then
			openDribble(tp)
		elseif (stage == "vision") then
			openVision(tp)
		elseif (stage == "shootout") then
			openShootout(tp)
		else
			finishStage(tp, stage, 0)
		end
	end
	finishStage = function(tp, stage, q, finalPenScored)
		tp.trial = M_trial.recordStage(tp.trial, stage, q)
		if (finalPenScored ~= nil) then
			tp.trial = Js.ospread(tp.trial, Js.O({ finalPenScored = finalPenScored }, { "finalPenScored" }))
			tp.back.finalPenScored = finalPenScored
		end
		A.push(tp.back.results, Js.O({ stage = stage, quality = Math.max(0, Math.min(1, q)) }, { "stage", "quality" }))
		local next_ = M_trial.nextStage(tp.trial)
		if (not Js.T(next_)) then
			tp.card = Js.O({ kind = "scout" }, { "kind" })
			tp.shootout = nil
			tp.vision = tp.shootout
			tp.dribble = tp.vision
			tp.strike = tp.dribble
			do return end
		end
		tp.card = Js.O({ kind = "countdown", at = tp.clock, label = M_trial.STAGE_LABEL[next_] }, { "kind", "at", "label" })
	end
	openStrike = function(tp, kind)
		local trial = tp.trial
		local seed = Js.ushr(Js.bxor(trial.seed, (if (kind == "freeKicks") then 24414 else 32332)), 0)
		local st = Js.O({ kind = kind, reps = M_trialStages.REPS[kind], rep = 0, points = Js.alit(), text = "", doneAt = nil, gate = nil, crossed = nil, prev = nil }, { "kind", "reps", "rep", "points", "text", "doneAt", "gate", "crossed", "prev" })
		local level = M_trialStages.ladderLevel(M_trial.difficultyFor(trial, "technique"))
		local openOn = function()
			local r = st.rep
			local rng = M_season.mulberry32(Js.ushr(Js.bxor(seed, ((r + 1) * 2654435761)), 0))
			if (kind == "freeKicks") then
				if st.m then
					st.m.strength = M_trialStages.freeKickSetup(tp.trial, r).keeperStrength
				end
				do return buildFreeKickScenario(tp.trial, r, rng) end
			end
			local g = buildGate(level, r, rng)
			st.gate = g
			st.prev = nil
			st.crossed = nil
			do return g.scenario end
		end
		local drill = Js.O({ openOn = openOn, setPieceSkill = M_trialStages.trialInvisibleStats().setPieceSkill, scene = (if (kind == "technique") then Js.O({ keeper = false, goal = false, teammates = false, banners = false, you = false, box = false }, { "keeper", "goal", "teammates", "banners", "you", "box" }) else Js.O({ teammates = false }, { "teammates" })), onBallStep = (if (kind == "technique") then function(b)
			if ((not st.gate) or st.crossed) then
				do return end
			end
			local prev = st.prev
			if prev then
				local c = M_trainingDrills.gateCrossing(prev, b, st.gate.gate.centre.y)
				if c then
					st.crossed = c
				end
			end
			st.prev = Js.ospread(b)
		end else nil), onChanceResolved = function(info)
			if (st.doneAt ~= nil) then
				do return end
			end
			local pts = nil
			if (kind == "technique") then
				local g = st.gate
				pts = (if g then M_trainingDrills.gateQuality(st.crossed, g.gateCfg, g.gate.centre.x) else 0)
				st.text = (if (pts >= 0.9) then "Threaded it!" else (if (pts >= 0.45) then "Through." else (if (pts > 0) then "Clipped it." else "Missed the gate.")))
			else
				local yours = (not info.teammateShot)
				pts = (if (not yours) then 0 else (if ((info.outcome == "goal") or (info.outcome == "rebound")) then 1 else (if ((info.outcome == "saved") or (info.outcome == "tipped")) then 0.5 else 0)))
				st.text = (if (not yours) then "A team-mate gets on the end of it." else (if (pts == 1) then "Goal!" else (if (pts == 0.5) then "Saved." else "Missed.")))
			end
			A.push(st.points, pts)
			local next_ = (st.rep + 1)
			if (next_ >= st.reps) then
				st.doneAt = (tp.clock + LAST_RESULT_HOLD_S)
			else
				st.rep = next_
			end
		end }, { "openOn", "setPieceSkill", "scene", "onBallStep", "onChanceResolved" })
		local keeper = (if (kind == "freeKicks") then M_trialStages.freeKickSetup(trial, 0).keeperStrength else 62)
		st.m = M_match.startMatch(drillSetup(tp, seed, keeper, drill))
		tp.strike = st
	end
	openDribble = function(tp)
		local setup = M_trialStages.dribbleSetup(tp.trial)
		local run = M_firstPersonDribble.newRun(Js.O({ pace = (if tp.career.skills.pace ~= nil then tp.career.skills.pace else 60), oppStrength = setup.oppStrength, rounds = 3, waveSizes = setup.waveSizes, rng = M_season.mulberry32(M_trialStages.attemptSeed(tp.trial)), mates = 0 }, { "pace", "oppStrength", "rounds", "waveSizes", "rng", "mates" }))
		tp.dribble = Js.O({ setup = setup, run = run, started = false, endAt = nil, result = nil }, { "setup", "run", "started", "endAt", "result" })
	end
	visionRep = function(tp, rep, qualities)
		local setup = M_trialStages.visionSetup(tp.trial, rep)
		local layout = layoutVision(setup, M_trialStages.attemptSeed(tp.trial), rep)
		do return Js.O({ rep = rep, setup = setup, layout = layout, phase = (if (rep == 0) then "ready" else "count"), at = tp.clock, startedAt = 0, picked = nil, qualities = qualities }, { "rep", "setup", "layout", "phase", "at", "startedAt", "picked", "qualities" }) end
	end
	openVision = function(tp)
		tp.vision = visionRep(tp, 0, Js.alit())
	end
	openShootout = function(tp)
		local drill
		local trial = tp.trial
		local seed = M_trialStages.attemptSeed(trial)
		local _d8 = takersFor(trial, seed)
		local them = _d8.them
		local mates = _d8.mates
		local st = Js.O({ seed = seed, rig = M_trialShootoutRig.createRig(), script = M_trialShootoutRig.createRigScript(seed), takers = them, mates = mates, yourKicks = Js.alit(), line = "", doneAt = nil }, { "seed", "rig", "script", "takers", "mates", "yourKicks", "line", "doneAt" })
		local takerNow = function(s)
			if (s.over or M_trialShootoutRig.isYourKick(s)) then
				do return nil end
			end
			local side = M_trialShootoutRig.rigNextSide(s.kicks)
			local list = (if (side == "them") then st.takers else st.mates)
			do return list[Math.min(M_trialShootoutRig.rigKicksTaken(s.kicks, side), (Js.alen(list) - 1)) + 1] end
		end
		local dial = function(drill)
			local s = st.rig
			local side = M_trialShootoutRig.rigNextSide(s.kicks)
			local theirKeeper = M_trialStages.shootoutKeeperFor(trial, M_trialShootoutRig.rigKicksTaken(s.kicks, "you"))
			local ourKeeper = M_trialStages.shootoutOurKeeperFor(M_trialShootoutRig.rigKicksTaken(s.kicks, "them"))
			local yours = M_trialShootoutRig.isYourKick(s)
			local intent = (if (s.over or yours) then false else M_trialShootoutRig.rigIntent(s, st.script))
			drill.penaltyRead = (if yours then theirKeeper.read else (if (side == "them") then M_trialShootoutRig.rigKeeperRead(intent, ourKeeper.read) else M_trialShootoutRig.rigKeeperRead(intent, theirKeeper.read)))
			if st.m then
				st.m.strength = theirKeeper.keeperStrength
			end
			do return theirKeeper.keeperStrength end
		end
		drill = Js.O({ scene = Js.O({ teammates = false }, { "teammates" }), setPieceSkill = M_trialStages.trialInvisibleStats().setPieceSkill, openOn = function()
			local s = st.rig
			local side = M_trialShootoutRig.rigNextSide(s.kicks)
			local n = Js.alen(s.kicks)
			local rng = M_season.mulberry32(Js.ushr(((seed * 7919) + (n * 2654435761)), 0))
			local ourNo = M_trialShootoutRig.rigKicksTaken(s.kicks, "you")
			if (s.over or ((side == "you") and M_trialShootoutRig.isYourKick(s))) then
				local k = M_trialStages.shootoutKeeperFor(trial, ourNo)
				local sc = M_canvasEngine.buildScenario("penalty", rng, k.keeperStrength, 60, 55)
				M_canvasEngine.initDefenders(sc, rng)
				sc.ball = Js.O({ x = M_pitch.CX, y = M_pitch.PEN_SPOT_Y }, { "x", "y" })
				M_penaltyTaking.clearForShootout(sc)
				do return sc end
			end
			local taker = takerNow(s)
			local sc0 = (if (side == "them") then M_canvasEngine.buildScenario("penalty", rng, M_trialStages.shootoutOurKeeperFor(M_trialShootoutRig.rigKicksTaken(s.kicks, "them")).keeperStrength, 60, 55) else M_canvasEngine.buildScenario("penalty", rng, M_trialStages.shootoutKeeperFor(trial, ourNo).keeperStrength, 60, 55))
			M_canvasEngine.initDefenders(sc0, rng)
			sc0.ball = Js.O({ x = M_pitch.CX, y = M_pitch.PEN_SPOT_Y }, { "x", "y" })
			M_penaltyTaking.clearForShootout(sc0)
			local goes = M_trialShootoutRig.rigIntent(s, st.script)
			M_penaltyTaking.attachAutoKick(sc0, Js.O({ side = (if (side == "them") then "them" else "us"), taker = taker, plan = M_trialShootoutRig.rigPlanFor(goes, (if st.script.sides[n + 1] ~= nil then st.script.sides[n + 1] else 1), taker.rating, (if st.script.misses[n + 1] ~= nil then st.script.misses[n + 1] else "wide")), keeper = (if (side == "them") then Js.O({ strength = M_trialStages.shootoutOurKeeperFor(M_trialShootoutRig.rigKicksTaken(s.kicks, "them")).keeperStrength, name = "Trialist keeper", shortName = "Your keeper" }, { "strength", "name", "shortName" }) else Js.O({ strength = M_trialStages.shootoutKeeperFor(trial, ourNo).keeperStrength, name = "Academy keeper", shortName = "Their keeper" }, { "strength", "name", "shortName" })), context = "shootout" }, { "side", "taker", "plan", "keeper", "context" }))
			do return sc0 end
		end, onChanceResolved = function(info)
			if ((st.doneAt ~= nil) or st.rig.over) then
				do return end
			end
			local s = st.rig
			local n = Js.alen(s.kicks)
			local scored = (((info.outcome == "goal") or (info.outcome == "rebound")) and (not info.teammateShot))
			if M_trialShootoutRig.isYourKick(s) then
				A.push(st.yourKicks, scored)
				st.line = (if scored then "Scored!" else (if (((info.outcome == "saved") or (info.outcome == "tipped")) or (info.outcome == "caught")) then "Saved." else (if (info.outcome == "post") then "Off the post!" else "Missed.")))
			else
				local who = takerNow(s)
				local miss = (if st.script.misses[n + 1] ~= nil then st.script.misses[n + 1] else "wide")
				local how = (if (((info.outcome == "saved") or (info.outcome == "caught")) or (info.outcome == "tipped")) then "Saved!" else M_trialShootoutRig.MISS_LINE[miss])
				if (M_trialShootoutRig.rigNextSide(s.kicks) == "them") then
					st.line = (if scored then "They score." else (((function() local _v = who; if _v == nil then return nil end; _v = _v.shortName; return _v end)() or "Their man") .. ": " .. how))
				else
					st.line = (if scored then (((function() local _v = who; if _v == nil then return nil end; _v = _v.shortName; return _v end)() or "He") .. " scores!") else (((function() local _v = who; if _v == nil then return nil end; _v = _v.shortName; return _v end)() or "He") .. ": " .. how))
				end
			end
			st.rig = M_trialShootoutRig.rigApply(s, scored)
			dial(drill)
			if st.rig.over then
				st.doneAt = (tp.clock + FINAL_HOLD_S)
			end
		end }, { "scene", "setPieceSkill", "openOn", "onChanceResolved" })
		local keeper = dial(drill)
		st.m = M_match.startMatch(drillSetup(tp, seed, keeper, drill))
		dial(drill)
		tp.shootout = st
	end
	tick_ = function(tp, dt)
		dt = Math.min(Math.max(0, dt), 0.05)
		tp.clock += dt
		local card = tp.card
		if card then
			if ((card.kind == "countdown") and ((tp.clock - card.at) >= (COUNTDOWN_FROM * COUNTDOWN_STEP_S))) then
				tp.card = nil
				openStage(tp)
			end
			do return end
		end
		local s = tp.strike
		if s then
			M_match.tick(s.m, dt)
			if ((s.doneAt ~= nil) and (tp.clock >= s.doneAt)) then
				local q = (A.reduce(s.points, function(a, b)
					return (a + b)
				end, 0) / Math.max(1, Js.alen(s.points)))
				finishStage(tp, s.kind, q)
			end
			do return end
		end
		local d = tp.dribble
		if d then
			if (not d.started) then
				do return end
			end
			if (d.endAt == nil) then
				local ph = M_firstPersonDribble.stepRun(d.run, dt)
				if (ph ~= "running") then
					d.result = Js.O({ cleared = (ph == "clear"), beaten = Js.alen(A.filter(d.run.defenders, function(x)
						return (x.phase == "beaten")
					end)) }, { "cleared", "beaten" })
					d.endAt = (tp.clock + DRIBBLE_HOLD_S)
				end
			elseif (tp.clock >= d.endAt) then
				finishStage(tp, "dribbling", M_trialStages.dribbleQuality(d.result, d.setup))
			end
			do return end
		end
		local v = tp.vision
		if v then
			if ((v.phase == "count") and ((tp.clock - v.at) >= (if (v.rep == 0) then (3 * VISION_COUNT_S) else VISION_WAIT_S))) then
				v.phase = "live"
				v.startedAt = tp.clock
			elseif ((v.phase == "live") and ((tp.clock - v.startedAt) >= v.setup.window)) then
				settleVision(tp, v, nil, v.setup.window)
			elseif ((v.phase == "reveal") and ((tp.clock - v.at) >= VISION_REVEAL_S)) then
				if ((v.rep + 1) >= M_trialStages.REPS.vision) then
					finishStage(tp, "vision", M_trialStages.weightedQuality(v.qualities))
				else
					tp.vision = visionRep(tp, (v.rep + 1), v.qualities)
				end
			end
			do return end
		end
		local so = tp.shootout
		if so then
			M_match.tick(so.m, dt)
			if ((so.doneAt ~= nil) and (tp.clock >= so.doneAt)) then
				finishStage(tp, "shootout", M_trialStages.shootoutQuality(so.yourKicks), M_trialShootoutRig.winningPenaltyScored(so.rig))
			end
		end
	end
	exports.tick = tick_
	settleVision = function(tp, v, picked, took)
		v.picked = picked
		v.qualities = Js.aspread(v.qualities, Js.alit(M_trialStages.visionQuality(picked, v.setup, took)))
		v.phase = "reveal"
		v.at = tp.clock
	end
	tapToGo = function(tp)
		if ((function() local _v = tp.card; if _v == nil then return nil end; _v = _v.kind; return _v end)() == "scout") then
			tp.done = true
			do return end
		end
		if (tp.dribble and (not tp.dribble.started)) then
			tp.dribble.started = true
		end
		if (tp.vision and (tp.vision.phase == "ready")) then
			tp.vision.phase = "count"
			tp.vision.at = tp.clock
		end
	end
	exports.tapToGo = tapToGo
	visionTap = function(tp, p)
		local v = tp.vision
		if ((not v) or (v.phase ~= "live")) then
			do return false end
		end
		local best = -1
		local bestD = VISION_PICK_M
		A.forEach(v.layout.men, function(mm, i)
			local d = dist(mm, p)
			if (d < bestD) then
				bestD = d
				best = i
			end
		end)
		if (best < 0) then
			do return false end
		end
		settleVision(tp, v, best, (tp.clock - v.startedAt))
		do return true end
	end
	exports.visionTap = visionTap
	dribbleSteer = function(tp, x)
		local d = tp.dribble
		if (((not d) or (not d.started)) or (d.endAt ~= nil)) then
			do return end
		end
		if (math.abs(x) < 0.08) then
			do return end
		end
		M_firstPersonDribble.applySteer(d.run, (d.run.x + (x * 3)))
	end
	exports.dribbleSteer = dribbleSteer
	dribbleKnock = function(tp, dir)
		local d = tp.dribble
		if (((not d) or (not d.started)) or (d.endAt ~= nil)) then
			do return false end
		end
		do return M_firstPersonDribble.applyBurst(d.run, dir) end
	end
	exports.dribbleKnock = dribbleKnock
	pitchMatch = function(tp)
		if tp.card then
			do return nil end
		end
		do return (((function() local _v = tp.strike; if _v == nil then return nil end; _v = _v.m; return _v end)() or (function() local _v = tp.shootout; if _v == nil then return nil end; _v = _v.m; return _v end)()) or nil) end
	end
	exports.pitchMatch = pitchMatch
	trialView = function(tp)
		local stages = Js.alen(M_trial.TRIAL_STAGES)
		local stage = tp.stage
		local stageNo = (if Js.T(stage) then (A.indexOf(M_trial.TRIAL_STAGES, stage) + 1) else stages)
		local card = tp.card
		local out = Js.O({ stage = stage, stageNo = stageNo, stages = stages, title = (if Js.T(stage) then M_trial.STAGE_LABEL[stage] else "Trial over"), hint = (if Js.T(stage) then (if HINTS[stage] ~= nil then HINTS[stage] else "") else ""), line = (((function() local _v = tp.strike; if _v == nil then return nil end; _v = _v.text; return _v end)() or (function() local _v = tp.shootout; if _v == nil then return nil end; _v = _v.line; return _v end)()) or ""), card = (if card then (if (card.kind == "countdown") then Js.O({ kind = "countdown", label = card.label, n = Math.max(1, (COUNTDOWN_FROM - math.floor(((tp.clock - card.at) / COUNTDOWN_STEP_S)))) }, { "kind", "label", "n" }) else Js.O({ kind = "scout" }, { "kind" })) else nil), cones = (if (function() local _v = tp.strike; if _v == nil then return nil end; _v = _v.gate; return _v end)() then Js.alit(tp.strike.gate.gate.left, tp.strike.gate.gate.right) else Js.alit()), dribble = nil, vision = nil, shootout = nil }, { "stage", "stageNo", "stages", "title", "hint", "line", "card", "cones", "dribble", "vision", "shootout" })
		local d = tp.dribble
		if d then
			out.dribble = Js.O({ you = Js.O({ x = d.run.x, y = d.run.y }, { "x", "y" }), opp = A.map(d.run.defenders, function(x)
				return Js.O({ x = x.x, y = x.y, phase = x.phase }, { "x", "y", "phase" })
			end), started = d.started, waves = Js.alen(d.setup.waveSizes) }, { "you", "opp", "started", "waves" })
			if d.result then
				out.line = (if d.result.cleared then "Through!" else ("Beat " .. Js.numstr(d.result.beaten) .. " of " .. Js.numstr(d.setup.defenders) .. "."))
			end
		end
		local v = tp.vision
		if v then
			local count = (if ((v.phase == "count") and (v.rep == 0)) then Math.max(1, (3 - math.floor(((tp.clock - v.at) / VISION_COUNT_S)))) else 0)
			out.vision = Js.O({ you = v.layout.you, men = A.map(v.layout.men, function(mm)
				return Js.O({ x = mm.x, y = mm.y, marker = mm.marker }, { "x", "y", "marker" })
			end), phase = v.phase, count = count, left = (if (v.phase == "live") then (Math.max(0, (v.setup.window - (tp.clock - v.startedAt))) / v.setup.window) else (if (v.phase == "reveal") then 0 else 1)), picked = v.picked, correct = (if (v.phase == "reveal") then v.setup.correct else nil), rep = v.rep, reps = M_trialStages.REPS.vision }, { "you", "men", "phase", "count", "left", "picked", "correct", "rep", "reps" })
			if (v.phase == "reveal") then
				out.line = (if (v.picked == nil) then "Too slow." else (if (v.picked == v.setup.correct) then "Found him!" else "Not him."))
			end
		end
		local so = tp.shootout
		if so then
			local s = so.rig
			local side = M_trialShootoutRig.rigNextSide(s.kicks)
			out.shootout = Js.O({ us = M_trialShootoutRig.rigGoals(s.kicks, "you"), them = M_trialShootoutRig.rigGoals(s.kicks, "them"), kicks = A.map(s.kicks, function(k)
				return Js.O({ side = k.side, scored = k.scored }, { "side", "scored" })
			end), next = (if s.over then "" else (if M_trialShootoutRig.isYourKick(s) then "You" else (if (side == "them") then THEM else US))) }, { "us", "them", "kicks", "next" })
		end
		do return out end
	end
	exports.trialView = trialView
	trialFrame = function(tp)
		local tv = trialView(tp)
		local m = pitchMatch(tp)
		if m then
			local f = M_matchView.frameOf(m)
			do return Js.ospread(f, Js.O({ mode = "pitch", trial = tv, score = Js.ospread(f.score, Js.O({ usName = US, themName = THEM }, { "usName", "themName" })) }, { "mode", "trial", "score" })) end
		end
		local base = Js.O({ phase = "trial", cameraMode = "chance", minute = 0, score = Js.O({ us = 0, them = 0, usName = US, themName = THEM, home = true }, { "us", "them", "usName", "themName", "home" }), kits = TRIAL_KITS, bodies = Js.alit(), ball = nil, camera = Js.ospread(VISION_CAMERA, Js.O({ facing = "up", tilt = 0 }, { "facing", "tilt" })), goal = Js.O({ x1 = M_pitch.POST_L, x2 = M_pitch.POST_R, crossbar = 2.44 }, { "x1", "x2", "crossbar" }), aim = nil, passTarget = nil, feed = Js.alit(), log = Js.alit(), banner = nil, pause = nil, energy = 100, stamina = nil, speed = 1, energyMode = "medium", playstyle = "balanced", controls = Js.O({ powerShot = false, powerArmed = false, curve = false, steer = false, callForIt = false, nudge = false, dribble = false, touchMode = false }, { "powerShot", "powerArmed", "curve", "steer", "callForIt", "nudge", "dribble", "touchMode" }), shootout = nil }, { "phase", "cameraMode", "minute", "score", "kits", "bodies", "ball", "camera", "goal", "aim", "passTarget", "feed", "log", "banner", "pause", "energy", "stamina", "speed", "energyMode", "playstyle", "controls", "shootout" })
		local d = tv.dribble
		if (d and tp.dribble) then
			A.push(base.bodies, Js.O({ id = "you", side = "you", x = d.you.x, y = d.you.y, name = tp.career.player.lastName }, { "id", "side", "x", "y", "name" }))
			A.forEach(d.opp, function(o, i)
				return A.push(base.bodies, Js.O({ id = ("fd" .. Js.numstr(i)), side = "opp", x = o.x, y = o.y }, { "id", "side", "x", "y" }))
			end)
			A.push(base.bodies, Js.O({ id = "keeper", side = "keeper", x = M_pitch.CX, y = 0.6 }, { "id", "side", "x", "y" }))
			base.ball = Js.O({ x = d.you.x, y = (d.you.y - 0.6), z = 0 }, { "x", "y", "z" })
			base.cameraMode = "chase"
			base.phase = "trialDribble"
			base.controls = Js.ospread(base.controls, Js.O({ dribble = (d.started and (tp.dribble.endAt == nil)) }, { "dribble" }))
			do return Js.ospread(base, Js.O({ mode = "dribble", trial = tv }, { "mode", "trial" })) end
		end
		local v = tv.vision
		if v then
			A.push(base.bodies, Js.O({ id = "you", side = "you", x = v.you.x, y = v.you.y, name = tp.career.player.lastName }, { "id", "side", "x", "y", "name" }))
			A.forEach(v.men, function(mm, i)
				A.push(base.bodies, Js.O({ id = ("vm" .. Js.numstr(i)), side = "mate", x = mm.x, y = mm.y, option = true, name = (if (v.correct == i) then "FREE" else (if (v.picked == i) then "✗" else nil)) }, { "id", "side", "x", "y", "option", "name" }))
				A.push(base.bodies, Js.O({ id = ("vk" .. Js.numstr(i)), side = "opp", x = mm.marker.x, y = mm.marker.y }, { "id", "side", "x", "y" }))
			end)
			A.push(base.bodies, Js.O({ id = "keeper", side = "keeper", x = M_pitch.CX, y = 0.6 }, { "id", "side", "x", "y" }))
			base.ball = Js.O({ x = v.you.x, y = (v.you.y - 0.6), z = 0 }, { "x", "y", "z" })
			base.phase = "trialVision"
			do return Js.ospread(base, Js.O({ mode = "vision", trial = tv }, { "mode", "trial" })) end
		end
		base.phase = "trialCard"
		do return Js.ospread(base, Js.O({ mode = "card", trial = tv }, { "mode", "trial" })) end
	end
	exports.trialFrame = trialFrame
	BEHIND_BALL = 7
	SIDE_PAD = 2.5
	BASE_VIEW_H = 42
	VISION_YOU = Js.O({ x = M_pitch.CX, y = 36 }, { "x", "y" })
	AREA = Js.O({ x1 = 20, x2 = 48, y1 = 4.5, y2 = 30 }, { "x1", "x2", "y1", "y2" })
	MARKER_BOX = Js.O({ x1 = 18.5, x2 = 49.5, y1 = 1.5, y2 = 33.5 }, { "x1", "x2", "y1", "y2" })
	BASE_SPACE = 2.4
	MIN_SPACE = 1.1
	REQUIRED_GAP_FRACTION = 0.6
	LAYOUT_ATTEMPTS = 24
	dist = function(a, b)
		return Math.hypot((a.x - b.x), (a.y - b.y))
	end
	US = "Trialists"
	THEM = "Academy"
	MATE_KICKS = (M_trialShootoutRig.SHOOTOUT_KICKS - 1)
	LAST_RESULT_HOLD_S = 1.4
	FINAL_HOLD_S = 1.5
	COUNTDOWN_FROM = 3
	COUNTDOWN_STEP_S = 0.55
	VISION_WAIT_S = 0.65
	VISION_COUNT_S = 0.6
	VISION_REVEAL_S = 1.2
	VISION_PICK_M = 3.4
	DRIBBLE_HOLD_S = 1.2
	DRILL_FIXTURE = Js.O({ opponent = "Academy", home = true, week = 0, competition = "Trial", kind = "league" }, { "opponent", "home", "week", "competition", "kind" })
	HINTS = Js.O({ freeKicks = "Bend it round the wall or lift it over: the sides of the ball curl it, the bottom lifts it.", technique = "Put it through the cones: strike the side of the ball to bend it in.", dribbling = "Move with W A S D or the stick. Knock it past him with Q / E or the buttons.", vision = "Tap the man in the most space before the time runs out.", shootout = "Three kicks each. Yours is the last one." }, { "freeKicks", "technique", "dribbling", "vision", "shootout" })
	TRIAL_KITS = Js.O({ us = Js.O({ shirt = "#2563eb", trim = "#f8fafc" }, { "shirt", "trim" }), them = Js.O({ shirt = "#dc2626", trim = "#111827" }, { "shirt", "trim" }), keeper = Js.O({ shirt = "#16a34a", trim = "#052e16" }, { "shirt", "trim" }), ourKeeper = Js.O({ shirt = "#f59e0b", trim = "#111827" }, { "shirt", "trim" }) }, { "us", "them", "keeper", "ourKeeper" })
	VISION_CAMERA = Js.O({ x1 = 16.5, x2 = 51.5, y1 = ((-M_pitch.NET_DEPTH) - 1), y2 = (36 + 1.6) }, { "x1", "x2", "y1", "y2" })
end
