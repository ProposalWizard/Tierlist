--!nocheck
--!nolint
-- Generated from roblox/game/trainingPlay.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_canvasEngine = import("lib/star/canvasEngine")
	local M_airDrawings = import("lib/star/airDrawings")
	local M_trainingRender = import("lib/star/trainingRender")
	local M_trainingDrills = import("lib/star/trainingDrills")
	local M_trainingLevels = import("lib/star/trainingLevels")
	local M_trainingLevelData = import("lib/star/trainingLevelData")
	local M_season = import("lib/star/season")
	local M_match = import("roblox/game/match")
	local M_firstPersonDribble = import("lib/star/firstPersonDribble")
	local M_visionRound = import("lib/star/visionRound")
	local M_visionMoments_json = import("lib/star/data/visionMoments_json")
	local M_visionChecks_json = import("lib/star/data/visionChecks_json")
	local M_matchView = import("roblox/game/matchView")
	local M_pitch = import("lib/star/pitch")
	local TRIES, SKILL_TITLES, DRILL_SCENE, buildStrikeFrom, FINISH_HOLD_S, FLASH_S, VISION_COUNT_S, VISION_NEXT_S, VISION_PICK_M, DRILL_FIXTURE, drillSetup, attempt, flash, startTraining, openStrike, openPace, newPaceRun, visionLoaded, openVision, visionPic, openVisionTry, finishVision, tick_, pitchMatch, tapToGo, visionTap, paceSteer, paceKnock, KITS, trainingFrame
	buildStrikeFrom = function(kind, row, rng)
		if (kind == "aerial") then
			local cfg = row
			local sc = M_canvasEngine.buildScenario((if cfg.volley then "volley" else "header"), rng, cfg.keeperStrength, 60, 55)
			sc.keeperStrength = cfg.keeperStrength
			if (not cfg.marker) then
				sc.defenders = Js.alit()
			end
			sc.runner = nil
			sc.passTarget = nil
			sc.receiver = nil
			sc.secondaryRunners = Js.alit()
			if ((not cfg.volley) and Js.NumberNS.isFinite(cfg.ballZ)) then
				M_airDrawings.setAirZ(sc, cfg.ballZ)
			end
			do return Js.O({ scenario = sc, viewport = M_trainingRender.strikeViewport(sc.ball), gate = nil, gateCfg = nil, brief = (((if cfg.volley then "Volley" else ("Header " .. N.toFixed((if Js.NumberNS.isFinite(cfg.ballZ) then cfg.ballZ else 1.85), 2) .. " m")) .. (if cfg.marker then " · marked" else "")) .. (if (cfg.pass > 0.5) then " · near a post" else "")), pass = cfg.pass }, { "scenario", "viewport", "gate", "gateCfg", "brief", "pass" }) end
		end
		if (kind == "technique") then
			local cfg = row
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
			do return Js.O({ scenario = sc, viewport = M_trainingRender.gateViewport(ball, gate), gate = gate, gateCfg = cfg, brief = (N.toFixed(cfg.gateDistance, 0) .. "m · " .. N.toFixed(cfg.gateWidth, 1) .. "m gate"), pass = cfg.pass }, { "scenario", "viewport", "gate", "gateCfg", "brief", "pass" }) end
		end
		if (kind == "freeKick") then
			local cfg = row
			local ball = M_trainingDrills.strikeSpot(cfg.distance, cfg.offset)
			local sc = M_canvasEngine.buildScenario("free_kick", rng, cfg.keeperStrength, 60, 55)
			sc.ball = Js.O({ x = ball.x, y = ball.y }, { "x", "y" })
			sc.player = Js.O({ x = ball.x, y = (ball.y + 0.8) }, { "x", "y" })
			sc.keeperStrength = cfg.keeperStrength
			M_canvasEngine.initDefenders(sc, rng)
			sc.defenders = A.map(M_trainingDrills.placedMen(M_trainingDrills.wallSpots(ball, cfg.wall), cfg.men, cfg.wall), function(at)
				return Js.O({ x = at.x, y = at.y, role = "hold", baseRole = "hold", speed = 0, z = 0, vz = 0 }, { "x", "y", "role", "baseRole", "speed", "z", "vz" })
			end)
			do return Js.O({ scenario = sc, viewport = M_trainingRender.strikeViewport(ball), gate = nil, gateCfg = nil, brief = (N.toFixed(cfg.distance, 0) .. "m · " .. Js.numstr(cfg.wall) .. "-man wall"), pass = cfg.pass }, { "scenario", "viewport", "gate", "gateCfg", "brief", "pass" }) end
		end
		local cfg = row
		local ball = M_trainingDrills.strikeSpot(cfg.distance, cfg.offset)
		local sc = M_canvasEngine.buildScenario("long_range", rng, cfg.keeperStrength, 60, 55)
		sc.ball = Js.O({ x = ball.x, y = ball.y }, { "x", "y" })
		sc.player = Js.O({ x = ball.x, y = (ball.y + 0.8) }, { "x", "y" })
		sc.keeperStrength = cfg.keeperStrength
		M_canvasEngine.initDefenders(sc, rng)
		sc.defenders = A.map(M_trainingDrills.placedMen(M_trainingDrills.powerManSpots(ball, cfg.blockers), cfg.men, cfg.blockers), function(at)
			return Js.O({ x = at.x, y = at.y, role = "hold", baseRole = "hold", speed = 0.9, z = 0, vz = 0 }, { "x", "y", "role", "baseRole", "speed", "z", "vz" })
		end)
		do return Js.O({ scenario = sc, viewport = M_trainingRender.strikeViewport(ball), gate = nil, gateCfg = nil, brief = ((if cfg.keeper then (N.toFixed(cfg.distance, 0) .. "m · " .. Js.numstr(cfg.blockers) .. " in the way") else (N.toFixed(cfg.distance, 0) .. "m · open goal")) .. (if (cfg.pass > 0.5) then " · near a post" else "")), openGoal = (not cfg.keeper), pass = cfg.pass }, { "scenario", "viewport", "gate", "gateCfg", "brief", "openGoal", "pass" }) end
	end
	exports.buildStrikeFrom = buildStrikeFrom
	drillSetup = function(career, seed, keeperStrength, drill, skills)
		do return Js.O({ career = career, fixture = DRILL_FIXTURE, skills = skills, canCurve = false, canExtraTouch = false, keeperStrength = keeperStrength, oppStrength = 70, position = career.player.position, teamRelationship = 60, startMinute = 0, conditions = nil, seed = seed, pressure = 0, drill = drill }, { "career", "fixture", "skills", "canCurve", "canExtraTouch", "keeperStrength", "oppStrength", "position", "teamRelationship", "startMinute", "conditions", "seed", "pressure", "drill" }) end
	end
	attempt = function(tp, ok)
		if (tp.stars ~= nil) then
			do return end
		end
		if ((Js.alen(tp.results) >= TRIES) or A.includes(tp.results, true)) then
			do return end
		end
		A.push(tp.results, ok)
		local hit = A.indexOf(tp.results, true)
		if ((hit < 0) and (Js.alen(tp.results) < TRIES)) then
			do return end
		end
		tp.stars = (if (hit < 0) then 0 else M_trainingLevels.starsForTry(hit))
		tp.finishAt = (tp.clock + FINISH_HOLD_S)
	end
	flash = function(tp, text, good)
		tp.flash = Js.O({ text = text, good = good, at = tp.clock }, { "text", "good", "at" })
	end
	startTraining = function(career, skill, level, overlay)
		if overlay then
			M_trainingLevelData.setTrainingOverlay(overlay)
		end
		local tp = Js.O({ career = career, skill = skill, level = level, clock = 0, results = Js.alit(), stars = nil, finishAt = nil, done = false, flash = nil, brief = "", instruction = "", strike = nil, pace = nil, vision = nil }, { "career", "skill", "level", "clock", "results", "stars", "finishAt", "done", "flash", "brief", "instruction", "strike", "pace", "vision" })
		if (skill == "pace") then
			openPace(tp)
		elseif (skill == "vision") then
			openVision(tp)
		else
			openStrike(tp, skill)
		end
		do return tp end
	end
	exports.startTraining = startTraining
	openStrike = function(tp, kind)
		local skills = tp.career.skills
		local row = (if (kind ~= "power") then M_trainingLevelData.levelConfig(kind, tp.level) else M_trainingLevelData.easePowerLevel(tp.level, skills.power, function(n)
			return M_trainingLevelData.levelConfig("power", n)
		end))
		local seed = M_trainingLevelData.levelSeedOf(kind, tp.level, row)
		local view = buildStrikeFrom(kind, row, M_season.mulberry32(seed))
		tp.brief = view.brief
		tp.instruction = (if (kind == "aerial") then "The cross comes in and you meet it: tap the ball before the ring runs out. Hit its left side to send it right." else (if (kind == "technique") then "Drag back to aim and set power. Pick a spot on the ball to bend it through the cones." else (if (kind == "freeKick") then "Drag back to aim and set power, then strike it over the wall or round it." else "Drag back to aim and set power, then pick your spot on the ball.")))
		local st = Js.O({ m = nil, setup = nil, crossed = nil, prev = nil }, { "m", "setup", "crossed", "prev" })
		local drill = Js.O({ openOn = function()
			local setup = buildStrikeFrom(kind, row, M_season.mulberry32(seed))
			setup.scenario.viewport = Js.ospread(setup.viewport)
			st.setup = setup
			st.prev = nil
			st.crossed = nil
			do return setup.scenario end
		end, setPieceSkill = skills.freeKick, scene = (if view.openGoal then Js.ospread(DRILL_SCENE.power, Js.O({ keeper = false }, { "keeper" })) else DRILL_SCENE[kind]), onBallStep = function(b)
			local setup = st.setup
			if ((not (function() local _v = setup; if _v == nil then return nil end; _v = _v.gate; return _v end)()) or st.crossed) then
				do return end
			end
			local prev = st.prev
			if prev then
				local c = M_trainingDrills.gateCrossing(prev, b, setup.gate.centre.y)
				if c then
					st.crossed = c
				end
			end
			st.prev = Js.ospread(b)
		end, onChanceResolved = function(info)
			local setup = st.setup
			if (not setup) then
				do return end
			end
			local q = nil
			local text = nil
			if (setup.gate and setup.gateCfg) then
				q = M_trainingDrills.gateQuality(st.crossed, setup.gateCfg, setup.gate.centre.x)
				text = (if (q >= 0.9) then "THREADED!" else (if (q >= 0.45) then "THROUGH" else (if (q > 0) then "CLIPPED IT" else "MISSED THE GATE")))
			else
				local o = (if info.teammateShot then "saved" else info.outcome)
				local reached = (((((o == "goal") or (o == "rebound")) or (o == "wide")) or (o == "over")) or (o == "post"))
				q = M_trainingDrills.shotQuality(o, (if (reached and info.ball) then info.ball.x else nil))
				text = (if ((o == "goal") or (o == "rebound")) then (if (q < setup.pass) then "TOO CENTRAL" else (if (q > 0.85) then "TOP CORNER!" else "GOAL!")) else (if ((o == "saved") or (o == "tipped")) then "SAVED" else (if (o == "caught") then "CAUGHT" else (if (o == "post") then "OFF THE POST" else (if ((o == "blocked") or (o == "tackled")) then "BLOCKED" else (if (o == "over") then "OVER" else "WIDE"))))))
			end
			local ok = (q >= setup.pass)
			flash(tp, text, ok)
			attempt(tp, ok)
		end }, { "openOn", "setPieceSkill", "scene", "onBallStep", "onChanceResolved" })
		local keeperStrength = (if (kind == "technique") then 40 else row.keeperStrength)
		st.m = M_match.startMatch(drillSetup(tp.career, seed, keeperStrength, drill, Js.O({ power = skills.power, technique = skills.technique, aerial = skills.aerial }, { "power", "technique", "aerial" })))
		tp.strike = st
	end
	openPace = function(tp)
		local cfg = M_trainingLevelData.levelConfig("pace", tp.level)
		local out = Js.alit()
		local max = Math.max(1, cfg.waveMax)
		do
			local left = cfg.chasers
			local _first1 = true
			while true do
				if not _first1 then
					left -= max
				end
				_first1 = false
				if not (left > 0) then break end
				A.push(out, Math.min(max, left))
			end
		end
		tp.pace = Js.O({ cfg = cfg, waveSizes = out, total = A.reduce(out, function(a, b)
			return (a + b)
		end, 0), run = nil, started = false, resetAt = nil }, { "cfg", "waveSizes", "total", "run", "started", "resetAt" })
		tp.instruction = "One man comes for the ball. Pick the gap, wait for his shoulder, and knock it the other way as his ring turns green."
		tp.brief = (Js.numstr(cfg.chasers) .. " " .. (if (cfg.chasers == 1) then "man" else "men") .. " to beat")
		newPaceRun(tp)
	end
	newPaceRun = function(tp)
		local p = tp.pace
		p.run = M_firstPersonDribble.newRun(Js.ospread(Js.O({ pace = p.cfg.runPace, oppStrength = p.cfg.oppStrength, rounds = 3, waveSizes = p.waveSizes, rng = M_season.mulberry32(M_trainingLevelData.levelSeedOf("pace", tp.level, p.cfg)), mates = 0, knockOn = true }, { "pace", "oppStrength", "rounds", "waveSizes", "rng", "mates", "knockOn" }), (if p.cfg.lanes then Js.O({ lanes = p.cfg.lanes }, { "lanes" }) else Js.O({}, nil))))
		p.started = false
		p.resetAt = nil
	end
	openVision = function(tp)
		if ((not visionLoaded) and (not M_visionRound.visionMomentsReady())) then
			M_visionRound.setVisionMoments(M_visionMoments_json.default)
			M_visionRound.setVisionChecks(M_visionChecks_json.default)
			visionLoaded = true
		end
		local cfg = M_trainingLevelData.levelConfig("vision", tp.level)
		local seed = M_trainingLevelData.levelSeedOf("vision", tp.level, cfg)
		local levelOf = function(n)
			if (n == tp.level) then
				do return Js.O({ ask = M_visionRound.visionAsk(cfg), seed = seed }, { "ask", "seed" }) end
			end
			local c = M_trainingLevelData.levelConfig("vision", n)
			do return Js.O({ ask = M_visionRound.visionAsk(c), seed = M_trainingLevelData.levelSeedOf("vision", n, c) }, { "ask", "seed" }) end
		end
		local pics = M_visionRound.visionLevelPictures(tp.level, levelOf, TRIES)
		tp.vision = Js.O({ cfg = cfg, seed = seed, pics = pics, tryIdx = 0, phase = "count", count = 3, at = 0, goAt = 0, verdict = nil, tapped = nil, m = nil, sc = nil, pullAt = nil, letGoAt = nil, aimed = nil, strikeOff = nil }, { "cfg", "seed", "pics", "tryIdx", "phase", "count", "at", "goAt", "verdict", "tapped", "m", "sc", "pullAt", "letGoAt", "aimed", "strikeOff" })
		tp.instruction = (if cfg.kick then ("Play the pass: drag back from the ball to aim at him, then strike it. Start inside " .. N.toFixed(cfg.window, 1) .. "s.") else "Tap the team-mate you'd pass to. Not offside, not marked, nobody in the way.")
		openVisionTry(tp)
	end
	visionPic = function(tp)
		local v = tp.vision
		do return v.pics[Math.min(v.tryIdx, (Js.alen(v.pics) - 1)) + 1] end
	end
	openVisionTry = function(tp)
		local v = tp.vision
		v.phase = "count"
		v.count = 3
		v.at = tp.clock
		v.verdict = nil
		v.tapped = nil
		v.pullAt = nil
		v.letGoAt = nil
		v.aimed = nil
		v.strikeOff = nil
		v.sc = nil
		local p = visionPic(tp)
		if (not p) then
			v.m = nil
			do return end
		end
		local drill = Js.O({ openOn = function()
			local sc = M_visionRound.visionScenario(p, Js.ushr((v.seed + (v.tryIdx * 7919)), 0))
			v.sc = sc
			do return sc end
		end, scene = Js.O({ banners = false }, { "banners" }), onBallStep = function()
			local sc = v.sc
			if ((not sc) or (v.phase ~= "play")) then
				do return end
			end
			if (not v.strikeOff) then
				v.strikeOff = A.map(sc.secondaryRunners, function(r)
					return (not (not r.offside))
				end)
			end
			local verdict = M_visionRound.judgeKick(p, sc, nil, v.aimed, v.strikeOff)
			if verdict then
				finishVision(tp, verdict, (if sc.receivedBy then A.indexOf(sc.secondaryRunners, sc.receivedBy) else v.aimed))
			end
		end, onChanceResolved = function(info)
			local sc = v.sc
			if ((not sc) or (v.phase == "result")) then
				do return end
			end
			local verdict = M_visionRound.judgeKick(p, sc, info.outcome, v.aimed, (if v.strikeOff ~= nil then v.strikeOff else nil))
			if verdict then
				finishVision(tp, verdict, (if sc.receivedBy then A.indexOf(sc.secondaryRunners, sc.receivedBy) else v.aimed))
			end
		end }, { "openOn", "scene", "onBallStep", "onChanceResolved" })
		local skills = tp.career.skills
		v.m = M_match.startMatch(drillSetup(tp.career, Js.ushr((v.seed + v.tryIdx), 0), 62, drill, Js.O({ power = skills.power, technique = skills.technique }, { "power", "technique" })))
	end
	finishVision = function(tp, verdict, picked)
		local v = tp.vision
		if (v.phase == "result") then
			do return end
		end
		v.phase = "result"
		v.verdict = verdict
		v.tapped = picked
		v.at = tp.clock
		flash(tp, (if verdict.ok then "RIGHT MAN" else "NOT HIM"), verdict.ok)
		attempt(tp, verdict.ok)
	end
	tick_ = function(tp, dt)
		dt = Math.min(Math.max(0, dt), 0.05)
		tp.clock += dt
		if (tp.flash and ((tp.clock - tp.flash.at) > FLASH_S)) then
			tp.flash = nil
		end
		if (tp.finishAt ~= nil) then
			if (tp.clock >= tp.finishAt) then
				tp.done = true
			end
			if tp.strike then
				M_match.tick(tp.strike.m, dt)
			end
			do return end
		end
		if tp.strike then
			M_match.tick(tp.strike.m, dt)
			do return end
		end
		local p = tp.pace
		if (p and p.run) then
			if (not p.started) then
				do return end
			end
			if (p.resetAt ~= nil) then
				if (tp.clock >= p.resetAt) then
					newPaceRun(tp)
				end
				do return end
			end
			local ph = M_firstPersonDribble.stepRun(p.run, dt)
			if (ph ~= "running") then
				local cleared = (ph == "clear")
				local beaten = Js.alen(A.filter(p.run.defenders, function(d)
					return (d.phase == "beaten")
				end))
				flash(tp, (if cleared then (if (beaten >= p.total) then "GONE!" else "THROUGH") else "TACKLED"), cleared)
				attempt(tp, cleared)
				p.resetAt = (tp.clock + 1)
			end
			do return end
		end
		local v = tp.vision
		if v then
			local pic = visionPic(tp)
			if v.m then
				M_match.tick(v.m, dt)
			end
			if (not pic) then
				attempt(tp, false)
				do return end
			end
			if (v.phase == "count") then
				if ((tp.clock - v.at) >= VISION_COUNT_S) then
					v.at = tp.clock
					if (v.count > 1) then
						v.count -= 1
					else
						v.phase = "play"
						v.goAt = tp.clock
					end
				end
			elseif (v.phase == "play") then
				local m = v.m
				if (v.cfg.kick and m) then
					local aim = M_match.aimPreview(m)
					if ((v.pullAt == nil) and (aim or (m.phase ~= "aim"))) then
						v.pullAt = tp.clock
					end
					if aim then
						v.aimed = M_visionRound.aimedMan(pic, aim.dir)
					end
					if ((v.letGoAt == nil) and (m.phase ~= "aim")) then
						v.letGoAt = tp.clock
					end
				end
				if ((not v.cfg.kick) or (v.pullAt == nil)) then
					if ((tp.clock - v.goAt) > v.cfg.window) then
						finishVision(tp, M_visionRound.judgeTap(pic, nil), nil)
					end
				elseif (v.letGoAt == nil) then
					if ((tp.clock - v.pullAt) > v.cfg.letGo) then
						finishVision(tp, M_visionRound.judgeTap(pic, nil), nil)
					end
				end
			elseif (v.phase == "result") then
				if (((not (function() local _v = v.verdict; if _v == nil then return nil end; _v = _v.ok; return _v end)()) and (v.tryIdx < (TRIES - 1))) and ((tp.clock - v.at) >= VISION_NEXT_S)) then
					v.tryIdx += 1
					openVisionTry(tp)
				end
			end
		end
	end
	exports.tick = tick_
	pitchMatch = function(tp)
		if tp.strike then
			do return tp.strike.m end
		end
		local v = tp.vision
		if ((v and v.cfg.kick) and (v.phase == "play")) then
			do return v.m end
		end
		do return nil end
	end
	exports.pitchMatch = pitchMatch
	tapToGo = function(tp)
		if (tp.pace and (not tp.pace.started)) then
			tp.pace.started = true
		end
	end
	exports.tapToGo = tapToGo
	visionTap = function(tp, at)
		local v = tp.vision
		local pic = (if v then visionPic(tp) else nil)
		if ((((not v) or (not pic)) or v.cfg.kick) or (v.phase ~= "play")) then
			do return false end
		end
		local best = -1
		local bestD = VISION_PICK_M
		A.forEach(pic.options, function(o, i)
			local d = Math.hypot((o.x - at.x), (o.y - at.y))
			if (d < bestD) then
				bestD = d
				best = i
			end
		end)
		if (best < 0) then
			do return false end
		end
		finishVision(tp, M_visionRound.judgeTap(pic, best), best)
		do return true end
	end
	exports.visionTap = visionTap
	paceSteer = function(tp, x)
		local p = tp.pace
		if ((((not (function() local _v = p; if _v == nil then return nil end; _v = _v.run; return _v end)()) or (not p.started)) or (p.resetAt ~= nil)) or (math.abs(x) < 0.08)) then
			do return end
		end
		M_firstPersonDribble.applySteer(p.run, (p.run.x + (x * 3)))
	end
	exports.paceSteer = paceSteer
	paceKnock = function(tp, dir)
		local p = tp.pace
		if (((not (function() local _v = p; if _v == nil then return nil end; _v = _v.run; return _v end)()) or (not p.started)) or (p.resetAt ~= nil)) then
			do return false end
		end
		do return M_firstPersonDribble.applyBurst(p.run, dir) end
	end
	exports.paceKnock = paceKnock
	trainingFrame = function(tp)
		local tv = Js.O({ title = SKILL_TITLES[tp.skill], level = tp.level, brief = tp.brief, instruction = tp.instruction, tries = Js.O({ done = Js.alen(tp.results), results = A.slice(tp.results), total = TRIES }, { "done", "results", "total" }), flash = (if tp.flash then Js.O({ text = tp.flash.text, good = tp.flash.good }, { "text", "good" }) else nil), stars = tp.stars, tapToStart = ((not (not tp.pace)) and (not tp.pace.started)), count = 0, left = nil, line = "", cones = (if (function() local _v = tp.strike; if _v == nil then return nil end; _v = _v.setup; if _v == nil then return nil end; _v = _v.gate; return _v end)() then Js.alit(tp.strike.setup.gate.left, tp.strike.setup.gate.right) else Js.alit()) }, { "title", "level", "brief", "instruction", "tries", "flash", "stars", "tapToStart", "count", "left", "line", "cones" })
		local v = tp.vision
		if v then
			tv.count = (if (v.phase == "count") then v.count else 0)
			tv.left = (if (v.phase == "play") then Math.max(0, (1 - ((tp.clock - (if (v.cfg.kick and (v.pullAt ~= nil)) then v.pullAt else v.goAt)) / (if (v.cfg.kick and (v.pullAt ~= nil)) then v.cfg.letGo else v.cfg.window)))) else nil)
			tv.line = ((function() local _v = v.verdict; if _v == nil then return nil end; _v = _v.line; return _v end)() or "")
		end
		local m = ((function() local _v = tp.strike; if _v == nil then return nil end; _v = _v.m; return _v end)() or (if v then v.m else nil))
		if m then
			local f = M_matchView.frameOf(m)
			local mode = (if (v and (not v.cfg.kick)) then "vision" else "pitch")
			local out = Js.ospread(f, Js.O({ kits = KITS, score = Js.ospread(f.score, Js.O({ usName = "Training", themName = "" }, { "usName", "themName" })), mode = mode, trial = nil, training = tv }, { "kits", "score", "mode", "trial", "training" }))
			if v then
				out.cameraMode = "chance"
			end
			do return out end
		end
		local base = Js.O({ phase = "trainingDribble", cameraMode = "chase", minute = 0, score = Js.O({ us = 0, them = 0, usName = "Training", themName = "", home = true }, { "us", "them", "usName", "themName", "home" }), kits = KITS, bodies = Js.alit(), ball = nil, camera = Js.O({ x1 = 16.5, x2 = 51.5, y1 = ((-M_pitch.NET_DEPTH) - 1), y2 = 40, facing = "up", tilt = 0 }, { "x1", "x2", "y1", "y2", "facing", "tilt" }), goal = Js.O({ x1 = M_pitch.POST_L, x2 = M_pitch.POST_R, crossbar = 2.44 }, { "x1", "x2", "crossbar" }), aim = nil, passTarget = nil, feed = Js.alit(), log = Js.alit(), banner = nil, pause = nil, energy = 100, stamina = nil, speed = 1, energyMode = "medium", playstyle = "balanced", controls = Js.O({ powerShot = false, powerArmed = false, curve = false, steer = false, callForIt = false, nudge = false, dribble = false, touchMode = false }, { "powerShot", "powerArmed", "curve", "steer", "callForIt", "nudge", "dribble", "touchMode" }), shootout = nil }, { "phase", "cameraMode", "minute", "score", "kits", "bodies", "ball", "camera", "goal", "aim", "passTarget", "feed", "log", "banner", "pause", "energy", "stamina", "speed", "energyMode", "playstyle", "controls", "shootout" })
		local p = tp.pace
		if (p and p.run) then
			local run = p.run
			A.push(base.bodies, Js.O({ id = "you", side = "you", x = run.x, y = run.y, name = tp.career.player.lastName }, { "id", "side", "x", "y", "name" }))
			A.forEach(run.defenders, function(d, i)
				return A.push(base.bodies, Js.O({ id = ("fd" .. Js.numstr(i)), side = "opp", x = d.x, y = d.y }, { "id", "side", "x", "y" }))
			end)
			A.push(base.bodies, Js.O({ id = "keeper", side = "keeper", x = M_pitch.CX, y = 0.6 }, { "id", "side", "x", "y" }))
			base.ball = Js.O({ x = run.x, y = (run.y - 0.6), z = 0 }, { "x", "y", "z" })
			base.controls = Js.ospread(base.controls, Js.O({ dribble = (p.started and (p.resetAt == nil)) }, { "dribble" }))
		end
		do return Js.ospread(base, Js.O({ mode = "dribble", trial = nil, training = tv }, { "mode", "trial", "training" })) end
	end
	exports.trainingFrame = trainingFrame
	TRIES = 3
	exports.TRIES = TRIES
	SKILL_TITLES = Js.O({ pace = "Pace", power = "Power", technique = "Technique", vision = "Vision", freeKick = "Free Kick", aerial = "Aerial & Acrobatics" }, { "pace", "power", "technique", "vision", "freeKick", "aerial" })
	exports.SKILL_TITLES = SKILL_TITLES
	DRILL_SCENE = Js.O({ technique = Js.O({ keeper = false, goal = false, teammates = false, banners = false }, { "keeper", "goal", "teammates", "banners" }), power = Js.O({ teammates = false, banners = false, ownFrame = true }, { "teammates", "banners", "ownFrame" }), freeKick = Js.O({ teammates = false, banners = false }, { "teammates", "banners" }), aerial = Js.O({ banners = false, ownFrame = true }, { "banners", "ownFrame" }) }, { "technique", "power", "freeKick", "aerial" })
	exports.DRILL_SCENE = DRILL_SCENE
	FINISH_HOLD_S = 0.85
	FLASH_S = 1
	VISION_COUNT_S = 0.65
	VISION_NEXT_S = 2.3
	VISION_PICK_M = 2.6
	DRILL_FIXTURE = Js.O({ opponent = "Training", home = true, week = 0, competition = "Training", kind = "league" }, { "opponent", "home", "week", "competition", "kind" })
	visionLoaded = false
	KITS = Js.O({ us = Js.O({ shirt = "#2563eb", trim = "#f8fafc" }, { "shirt", "trim" }), them = Js.O({ shirt = "#dc2626", trim = "#111827" }, { "shirt", "trim" }), keeper = Js.O({ shirt = "#16a34a", trim = "#052e16" }, { "shirt", "trim" }), ourKeeper = Js.O({ shirt = "#f59e0b", trim = "#111827" }, { "shirt", "trim" }) }, { "us", "them", "keeper", "ourKeeper" })
end
