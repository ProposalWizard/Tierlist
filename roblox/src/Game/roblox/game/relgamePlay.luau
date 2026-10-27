--!nocheck
--!nolint
-- Generated from roblox/game/relgamePlay.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_season = import("lib/star/season")
	local M_relationships = import("lib/star/relationships")
	local M_bossPenalties = import("lib/star/bossPenalties")
	local M_bossSession = import("lib/star/bossSession")
	local M_trainingPlay = import("roblox/game/trainingPlay")
	local M_trainingDrills = import("lib/star/trainingDrills")
	local M_pitch = import("lib/star/pitch")
	local M_goalFrame = import("lib/star/goalFrame")
	local M_match = import("roblox/game/match")
	local M_runupStyles = import("lib/star/runupStyles")
	local M_matchView = import("roblox/game/matchView")
	local REL_GAME_TITLE, SHOTS, woodworkMates, relgameGain, SIGNING_ITEMS, SIGNING_QUEUE, SIGNING_PAR, signingGain, signingPatience, PRESS_CHANCE, PRESS_MS, NEXT_FAN_MS, BLINK_MS, itemsWanted, FIXTURE, startRelGame, shotSeed, openShot, tick_, shuffled, nextFan, blink, tickSigning, signingStart, signingTap, pitchMatch, relView, KITS, relFrame
	woodworkMates = function(c)
		local rng = M_season.mulberry32(((c.season * 991) + (c.week * 37)))
		local pool = A.filter((if c.squad ~= nil then c.squad else Js.alit()), function(p)
			return (p.position ~= "GK")
		end)
		local pick = A.filter(Js.alit(pool[math.floor((rng() * Js.alen(pool))) + 1], pool[math.floor((rng() * Js.alen(pool))) + 1]), Js.Boolean)
		do return A.map(A.slice(pick, 0, 2), function(p)
			local chance = (0.16 + (Math.min(99, (if p.overall ~= nil then p.overall else 60)) / 600))
			local hits = 0
			do
				local s = 0
				local _first1 = true
				while true do
					if not _first1 then
						s += 1
					end
					_first1 = false
					if not (s < SHOTS.woodwork) then break end
					if (rng() < chance) then
						hits += 1
					end
				end
			end
			do return Js.O({ name = A.slice(S.split(p.name, " "), -1)[1], hits = hits }, { "name", "hits" }) end
		end) end
	end
	exports.woodworkMates = woodworkMates
	relgameGain = function(c, game_, count, roll)
		if ((not Js.NumberNS.isInteger(count)) or (count < 0)) then
			do return nil end
		end
		if (game_ == "woodwork") then
			if (count > SHOTS.woodwork) then
				do return nil end
			end
			local best = Math.max(Js.unpack(Js.aspread(Js.alit(1), A.map(woodworkMates(c), function(m)
				return m.hits
			end))))
			local won = (count >= best)
			do return Js.O({ won = won, gain = M_relationships.gameReward(won, c.relationships.team, roll, "team"), line = ("You hit the frame " .. Js.numstr(count) .. " of " .. Js.numstr(SHOTS.woodwork) .. ". Best of the lads: " .. Js.numstr(best) .. ".") }, { "won", "gain", "line" }) end
		end
		if (game_ == "penalties") then
			if (count > M_bossPenalties.BOSS_KICKS) then
				do return nil end
			end
			do return Js.O({ won = (count > 0), gain = M_bossPenalties.bossGain(count), line = (if (count == M_bossPenalties.BOSS_KICKS) then "Every one. He's impressed." else (if (count > 0) then (Js.numstr(count) .. " of " .. Js.numstr(M_bossPenalties.BOSS_KICKS) .. " where he asked.") else "None where he asked. He walks off.")) }, { "won", "gain", "line" }) end
		end
		if (game_ == "session") then
			if (count > M_bossSession.SESSION_REPS) then
				do return nil end
			end
			do return Js.O({ won = (count > 0), gain = M_bossSession.sessionGain(count), line = (if (count == M_bossSession.SESSION_REPS) then "Every one in. He nods and writes something down." else (if (count > 0) then (Js.numstr(count) .. " of " .. Js.numstr(M_bossSession.SESSION_REPS) .. " in.") else "Not one in. He walks off before you finish.")) }, { "won", "gain", "line" }) end
		end
		if (count > SIGNING_QUEUE) then
			do return nil end
		end
		local gain = signingGain(count)
		do return Js.O({ won = (gain > 0), gain = gain, line = (Js.numstr(count) .. " of " .. Js.numstr(SIGNING_QUEUE) .. " done right.") }, { "won", "gain", "line" }) end
	end
	exports.relgameGain = relgameGain
	itemsWanted = function(n, roll)
		if (n < 2) then
			do return 1 end
		end
		local three = Math.min(0.3, (0.04 * (n - 1)))
		local two = Math.min(0.45, (0.07 * (n - 1)))
		do return (if (roll < three) then 3 else (if (roll < (three + two)) then 2 else 1)) end
	end
	exports.itemsWanted = itemsWanted
	startRelGame = function(career, game_)
		local rp = Js.O({ game = game_, career = career, clock = 0, shot = 0, count = 0, flash = nil, nextAt = nil, done = false, m = nil, hit = false, cross = nil, spots = Js.alit(), lines = Js.alit(), mates = (if (game_ == "woodwork") then woodworkMates(career) else Js.alit()), started = false, fan = nil, order = A.map(SIGNING_ITEMS, function(i)
			return i.id
		end), missed = 0, served = 0, fanAt = nil }, { "game", "career", "clock", "shot", "count", "flash", "nextAt", "done", "m", "hit", "cross", "spots", "lines", "mates", "started", "fan", "order", "missed", "served", "fanAt" })
		if (game_ == "penalties") then
			local rng = M_season.mulberry32((((career.season * 7307) + (career.week * 131)) + math.floor((Math.random() * 100000))))
			rp.spots = M_bossPenalties.pickSpots(rng)
			rp.lines = A.map(rp.spots, function(sp, i)
				return M_bossPenalties.askLine(sp, i, rng)
			end)
		end
		if (game_ ~= "signing") then
			openShot(rp)
		end
		do return rp end
	end
	exports.startRelGame = startRelGame
	shotSeed = function(rp)
		local c = rp.career
		do return (if (rp.game == "woodwork") then (((c.season * 131) + (c.week * 17)) + rp.shot) else (if (rp.game == "penalties") then ((c.season * 7307) + (c.week * 131)) else ((c.season * 5113) + (c.week * 173)))) end
	end
	openShot = function(rp)
		local c = rp.career
		local seed = shotSeed(rp)
		rp.hit = false
		rp.cross = nil
		local openOn = function()
			if (rp.game == "penalties") then
				local setup = M_trainingPlay.buildStrikeFrom("power", Js.ospread(M_trainingDrills.powerDrillForLevel(1, rp.shot, c.skills.power), Js.O({ pass = 0.5 }, { "pass" })), M_season.mulberry32((seed + (rp.shot * 977))))
				local sc = setup.scenario
				sc.ball = Js.O({ x = M_pitch.CX, y = M_pitch.PEN_SPOT_Y }, { "x", "y" })
				sc.player = Js.O({ x = M_pitch.CX, y = (M_pitch.PEN_SPOT_Y + 1.2) }, { "x", "y" })
				sc.defenders = Js.alit()
				local h = 22
				local w = (h * (5 / 8))
				local cx = Math.max((w / 2), Math.min((M_pitch.PITCH_W - (w / 2)), M_pitch.CX))
				sc.viewport = Js.O({ x1 = (cx - (w / 2)), x2 = (cx + (w / 2)), y1 = M_goalFrame.FRAME_TOP_FOR_GOAL, y2 = (M_goalFrame.FRAME_TOP_FOR_GOAL + h) }, { "x1", "x2", "y1", "y2" })
				rp.cross = nil
				do return sc end
			end
			local level = (if (rp.game == "session") then (M_bossSession.SESSION_FIRST_LEVEL + rp.shot) else 1)
			local rng = (if (rp.game == "session") then M_season.mulberry32((seed + (rp.shot * 911))) else M_season.mulberry32(seed))
			local setup = M_trainingPlay.buildStrikeFrom("power", Js.ospread(M_trainingDrills.powerDrillForLevel(level, rp.shot, c.skills.power), Js.O({ pass = 0.5 }, { "pass" })), rng)
			local ball = setup.scenario.ball
			local h = Math.max(22, (ball.y + 10))
			local w = (h * (5 / 8))
			local cx = Math.max((w / 2), Math.min((M_pitch.PITCH_W - (w / 2)), ((ball.x + M_pitch.CX) / 2)))
			setup.scenario.viewport = Js.O({ x1 = (cx - (w / 2)), x2 = (cx + (w / 2)), y1 = M_goalFrame.FRAME_TOP_FOR_GOAL, y2 = (M_goalFrame.FRAME_TOP_FOR_GOAL + h) }, { "x1", "x2", "y1", "y2" })
			rp.hit = false
			do return setup.scenario end
		end
		local sessionDrill = (if (rp.game == "session") then M_trainingDrills.powerDrillForLevel((M_bossSession.SESSION_FIRST_LEVEL + rp.shot), rp.shot, c.skills.power) else nil)
		local drill = Js.O({ openOn = openOn, scene = (if (function() local _v = sessionDrill; if _v == nil then return nil end; _v = _v.keeper; return _v end)() then Js.O({ teammates = false, banners = false, ownFrame = true }, { "teammates", "banners", "ownFrame" }) else Js.O({ teammates = false, banners = false, ownFrame = true, keeper = false }, { "teammates", "banners", "ownFrame", "keeper" })), onBallStep = function(b)
			if (((rp.game == "woodwork") and (not rp.hit)) and M_relationships.touchingFrame(b)) then
				rp.hit = true
			end
			if (((rp.game == "penalties") and (not rp.cross)) and (b.y <= 0)) then
				rp.cross = Js.O({ x = b.x, z = b.z }, { "x", "z" })
			end
		end, onChanceResolved = function(info)
			if ((rp.nextAt ~= nil) or rp.done) then
				do return end
			end
			local good = nil
			local text = nil
			if (rp.game == "woodwork") then
				good = rp.hit
				text = (if good then "OFF THE WOODWORK!" else "MISSED THE FRAME")
			elseif (rp.game == "penalties") then
				local at = (if rp.cross ~= nil then rp.cross else (if (info.ball and (info.ball.y <= 0.5)) then Js.O({ x = info.ball.x, z = info.ball.z }, { "x", "z" }) else nil))
				local target = rp.spots[Math.min(rp.shot, (M_bossPenalties.BOSS_KICKS - 1)) + 1]
				good = ((not (not at)) and (M_bossPenalties.spotOf(at.x, at.z) == target))
				text = (if good then "BANG ON!" else (if (at and Js.T(M_bossPenalties.spotOf(at.x, at.z))) then "WRONG SPOT" else "MISSED THE GOAL"))
			else
				local o = (if info.teammateShot then "saved" else info.outcome)
				good = ((o == "goal") or (o == "rebound"))
				text = (if good then "GOAL!" else (if (((o == "saved") or (o == "tipped")) or (o == "caught")) then "SAVED" else (if ((o == "blocked") or (o == "tackled")) then "BLOCKED" else (if (o == "post") then "OFF THE POST" else (if (o == "over") then "OVER" else "WIDE")))))
			end
			if good then
				rp.count += 1
			end
			rp.flash = Js.O({ text = text, good = good, at = rp.clock }, { "text", "good", "at" })
			rp.nextAt = (rp.clock + (if (rp.game == "woodwork") then 0.9 else 1.1))
		end }, { "openOn", "scene", "onBallStep", "onChanceResolved" })
		local shotsSeed = (if (rp.game == "woodwork") then seed else (seed + rp.shot))
		rp.m = M_match.startMatch(Js.ospread(Js.O({ career = c, fixture = FIXTURE, skills = Js.O({ power = c.skills.power, technique = c.skills.technique }, { "power", "technique" }), canCurve = false, canExtraTouch = false, keeperStrength = (if sessionDrill then sessionDrill.keeperStrength else 0), oppStrength = 70, position = c.player.position, teamRelationship = 60, startMinute = 0, conditions = nil, seed = shotsSeed, pressure = 0 }, { "career", "fixture", "skills", "canCurve", "canExtraTouch", "keeperStrength", "oppStrength", "position", "teamRelationship", "startMinute", "conditions", "seed", "pressure" }), (if (rp.game == "penalties") then Js.O({ penaltyRunup = M_runupStyles.careerPenaltyRunup(c) }, { "penaltyRunup" }) else Js.O({}, nil)), Js.O({ drill = drill }, { "drill" })))
	end
	tick_ = function(rp, dt)
		dt = Math.min(Math.max(0, dt), 0.05)
		rp.clock += dt
		if (rp.flash and ((rp.clock - rp.flash.at) > 1)) then
			rp.flash = nil
		end
		if (rp.game == "signing") then
			tickSigning(rp)
			do return end
		end
		if rp.m then
			M_match.tick(rp.m, dt)
		end
		if ((rp.nextAt ~= nil) and (rp.clock >= rp.nextAt)) then
			rp.nextAt = nil
			rp.shot += 1
			if (rp.shot >= SHOTS[rp.game]) then
				rp.done = true
				rp.m = nil
			else
				openShot(rp)
			end
		end
	end
	exports.tick = tick_
	shuffled = function(xs)
		local a = Js.aspread(xs)
		for i = (Js.alen(a) - 1), 1, -1 do
			local j = math.floor((Math.random() * (i + 1)))
			local _d2 = Js.alit(a[j + 1], a[i + 1])
			A.set(a, i, _d2[1])
			A.set(a, j, _d2[2])
		end
		do return a end
	end
	nextFan = function(rp)
		local n = (function() local _o = rp.served; rp.served = _o + 1; return _o end)()
		local press = ((n >= 2) and (Math.random() < PRESS_CHANCE))
		local k = (if press then 0 else itemsWanted(n, Math.random()))
		local pick = function()
			return SIGNING_ITEMS[math.floor((Math.random() * Js.alen(SIGNING_ITEMS))) + 1].id
		end
		local want = Js.Array.from(Js.O({ length = k }, { "length" }), pick)
		local total = (if press then PRESS_MS else Math.round((signingPatience(n) * (1 + (0.6 * (k - 1))))))
		rp.order = shuffled(A.map(SIGNING_ITEMS, function(i)
			return i.id
		end))
		rp.fan = Js.O({ n = n, press = press, want = want, got = 0, ["until"] = ((rp.clock * 1000) + total), total = total }, { "n", "press", "want", "got", "until", "total" })
	end
	blink = function(rp, good)
		rp.flash = Js.O({ text = (if good then "✓" else "✕"), good = good, at = ((rp.clock - 1) + (BLINK_MS / 1000)) }, { "text", "good", "at" })
	end
	tickSigning = function(rp)
		if ((not rp.started) or rp.done) then
			do return end
		end
		local t = (rp.clock * 1000)
		local f = rp.fan
		if (f and (t > f["until"])) then
			if f.press then
				rp.count += 1
				blink(rp, true)
			else
				rp.missed += 1
				blink(rp, false)
			end
			rp.fan = nil
			rp.fanAt = nil
		end
		if (not rp.fan) then
			if ((rp.count + rp.missed) >= SIGNING_QUEUE) then
				rp.done = true
				do return end
			end
			if (rp.fanAt == nil) then
				rp.fanAt = (t + NEXT_FAN_MS)
			elseif (t >= rp.fanAt) then
				rp.fanAt = nil
				nextFan(rp)
			end
		end
	end
	signingStart = function(rp)
		rp.started = true
	end
	exports.signingStart = signingStart
	signingTap = function(rp, id)
		local fan = rp.fan
		if ((not fan) or rp.done) then
			do return end
		end
		if (fan.press or (id ~= fan.want[fan.got + 1])) then
			rp.missed += 1
			blink(rp, false)
			rp.fan = nil
			do return end
		end
		if ((fan.got + 1) < Js.alen(fan.want)) then
			rp.fan = Js.ospread(fan, Js.O({ got = (fan.got + 1) }, { "got" }))
			blink(rp, true)
			do return end
		end
		rp.count += 1
		blink(rp, true)
		rp.fan = nil
	end
	exports.signingTap = signingTap
	pitchMatch = function(rp)
		do return rp.m end
	end
	exports.pitchMatch = pitchMatch
	relView = function(rp)
		local shots = (if (rp.game == "signing") then SIGNING_QUEUE else SHOTS[rp.game])
		local view = Js.O({ title = REL_GAME_TITLE[rp.game], progress = (if (rp.game == "signing") then ("Done " .. Js.numstr(rp.count) .. " / " .. Js.numstr(SIGNING_QUEUE)) else ((if (rp.game == "penalties") then "Kick" else "Shot") .. " " .. Js.numstr(Math.min((rp.shot + 1), shots)) .. " / " .. Js.numstr(shots) .. " · " .. Js.numstr(rp.count) .. " " .. (if (rp.game == "woodwork") then "on the frame" else (if (rp.game == "penalties") then "on the spot" else "in")))), line = (if (rp.game == "woodwork") then ("Hit the post or the bar. Beat the lads: " .. A.join(A.map(rp.mates, function(m)
			return (m.name .. " " .. Js.numstr(m.hits))
		end), ", ") .. ".") else (if (rp.game == "penalties") then "Hit the spot he names." else (if (rp.game == "session") then "The manager is watching. Score as many as you can." else "Tap what each fan holds, in order, before they give up. Never sign for a journalist 🎤."))), ask = (if (rp.game == "penalties") then ((rp.lines[Math.min(rp.shot, (M_bossPenalties.BOSS_KICKS - 1)) + 1] or "") .. " (" .. (M_bossPenalties.SPOT_LABEL[rp.spots[Math.min(rp.shot, (M_bossPenalties.BOSS_KICKS - 1)) + 1]] or "") .. ")") else ""), flash = (if rp.flash then Js.O({ text = rp.flash.text, good = rp.flash.good }, { "text", "good" }) else nil), signing = nil }, { "title", "progress", "line", "ask", "flash", "signing" })
		if (rp.game == "signing") then
			local f = rp.fan
			local icon = function(id)
				return ((function() local _v = A.find(SIGNING_ITEMS, function(i)
					return (i.id == id)
				end); if _v == nil then return nil end; _v = _v.icon; return _v end)() or "?")
			end
			view.signing = Js.O({ started = rp.started, done = rp.count, missed = rp.missed, fanIcon = (if f then (if f.press then "🎤" else "🙋") else ""), wants = (if f then A.map(f.want, function(w, i)
				return Js.O({ icon = icon(w), got = (i < f.got) }, { "icon", "got" })
			end) else Js.alit()), left = (if f then Math.max(0, ((f["until"] - (rp.clock * 1000)) / f.total)) else 0), order = A.map(rp.order, function(id)
				local it = A.find(SIGNING_ITEMS, function(i)
					return (i.id == id)
				end)
				do return Js.O({ id = id, icon = it.icon, label = it.label }, { "id", "icon", "label" }) end
			end) }, { "started", "done", "missed", "fanIcon", "wants", "left", "order" })
		end
		do return view end
	end
	exports.relView = relView
	relFrame = function(rp)
		local rel = relView(rp)
		if rp.m then
			local f = M_matchView.frameOf(rp.m)
			do return Js.ospread(f, Js.O({ kits = KITS, score = Js.ospread(f.score, Js.O({ usName = rel.title, themName = "" }, { "usName", "themName" })), mode = "pitch", trial = nil, training = nil, rel = rel }, { "kits", "score", "mode", "trial", "training", "rel" })) end
		end
		do return Js.O({ phase = "relgame", cameraMode = "broadcast", minute = 0, score = Js.O({ us = 0, them = 0, usName = rel.title, themName = "", home = true }, { "us", "them", "usName", "themName", "home" }), kits = KITS, bodies = Js.alit(), ball = nil, camera = Js.O({ x1 = 10, x2 = 58, y1 = -5, y2 = 40, facing = "up", tilt = 0 }, { "x1", "x2", "y1", "y2", "facing", "tilt" }), goal = Js.O({ x1 = 30.34, x2 = 37.66, crossbar = 2.44 }, { "x1", "x2", "crossbar" }), aim = nil, passTarget = nil, feed = Js.alit(), log = Js.alit(), banner = nil, pause = nil, energy = 100, stamina = nil, speed = 1, energyMode = "medium", playstyle = "balanced", controls = Js.O({ powerShot = false, powerArmed = false, curve = false, steer = false, callForIt = false, nudge = false, dribble = false, touchMode = false }, { "powerShot", "powerArmed", "curve", "steer", "callForIt", "nudge", "dribble", "touchMode" }), shootout = nil, mode = "signing", trial = nil, training = nil, rel = rel }, { "phase", "cameraMode", "minute", "score", "kits", "bodies", "ball", "camera", "goal", "aim", "passTarget", "feed", "log", "banner", "pause", "energy", "stamina", "speed", "energyMode", "playstyle", "controls", "shootout", "mode", "trial", "training", "rel" }) end
	end
	exports.relFrame = relFrame
	REL_GAME_TITLE = Js.O({ woodwork = "Woodwork challenge", penalties = "The manager's penalties", session = "Extra session", signing = "Signing session" }, { "woodwork", "penalties", "session", "signing" })
	exports.REL_GAME_TITLE = REL_GAME_TITLE
	SHOTS = Js.O({ woodwork = 5, penalties = M_bossPenalties.BOSS_KICKS, session = M_bossSession.SESSION_REPS }, { "woodwork", "penalties", "session" })
	SIGNING_ITEMS = Js.alit(Js.O({ id = "shirt", icon = "👕", label = "Shirt" }, { "id", "icon", "label" }), Js.O({ id = "ball", icon = "⚽", label = "Ball" }, { "id", "icon", "label" }), Js.O({ id = "photo", icon = "📸", label = "Photo" }, { "id", "icon", "label" }), Js.O({ id = "boot", icon = "👟", label = "Boot" }, { "id", "icon", "label" }))
	exports.SIGNING_ITEMS = SIGNING_ITEMS
	SIGNING_QUEUE = 10
	exports.SIGNING_QUEUE = SIGNING_QUEUE
	SIGNING_PAR = 5
	exports.SIGNING_PAR = SIGNING_PAR
	signingGain = function(done)
		return (done - SIGNING_PAR)
	end
	exports.signingGain = signingGain
	signingPatience = function(n)
		return Math.max(800, (1700 - (n * 75)))
	end
	exports.signingPatience = signingPatience
	PRESS_CHANCE = 0.15
	PRESS_MS = 1300
	NEXT_FAN_MS = 260
	BLINK_MS = 250
	FIXTURE = Js.O({ opponent = "Training", home = true, week = 0, competition = "Training", kind = "league" }, { "opponent", "home", "week", "competition", "kind" })
	KITS = Js.O({ us = Js.O({ shirt = "#2563eb", trim = "#f8fafc" }, { "shirt", "trim" }), them = Js.O({ shirt = "#dc2626", trim = "#111827" }, { "shirt", "trim" }), keeper = Js.O({ shirt = "#16a34a", trim = "#052e16" }, { "shirt", "trim" }), ourKeeper = Js.O({ shirt = "#f59e0b", trim = "#111827" }, { "shirt", "trim" }) }, { "us", "them", "keeper", "ourKeeper" })
end
