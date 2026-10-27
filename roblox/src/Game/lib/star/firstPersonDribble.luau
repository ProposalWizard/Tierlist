--!nocheck
--!nolint
-- Generated from lib/star/firstPersonDribble.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_pitch = import("lib/star/pitch")
	local M_gait = import("lib/star/three3d/gait")
	local M_tuningStore = import("lib/star/tuningStore")
	local START_Y, FIRST_DUEL_DEPTH, DUEL_GAP, CLEAR_Y, CORRIDOR_HALF, BASE_SPEED, PACE_SPEED, STEER_SPEED, BURST_T, BURST_LATERAL, BURST_BOOST, BURST_LOCK, ENGAGE_D, COMMIT_D_BASE, TELL_BASE, LUNGE_T, PRESS_STEPS, PRESS_STEPS_BEFORE, LUNGE_REACH, TELE_SLOW, CONTACT_D, CLEAR_SEP, SHOW_SIDE, RUN_TIMEOUT, clamp, easeOutCubic, shuffle, runSpeed, waveSize, pickWaveSizes, placeWave, newRun, applySteer, STICK_LAT, STICK_WALK, STICK_JOG, STICK_SPRINT, STICK_UP_T, STICK_DOWN_T, STICK_BACK_ROOM, applyStick, stickSpeed, stickMotion, stickBallLead, nearestLiveInActiveRound, applyBurst, pickSide, stepDefender, stepRun, MATE_MIN_Y, MATE_SHIFT, PASS_EASY_BELOW, PASS_HARD_FROM, passBand, placeMate, passDifficulty, passSuccessChance, wavesBeaten, applyPass, runProgress
	local LIVELY_CAMERA, CALM_CAMERA, stepCameraLean, OWN_GAIT_M, CARRY, carryLead, DUEL, lerp01, duelEvent, qualityOf, initDuels, graceShare, biteChance, heavyTouchChance, startTell, leanFrom, sold, read, stepIn, stepDefenderDuel, COVER_DEPTH, WAVE_HOLD, stepCover, foul, lose, duelThreat, applyBurstDuel, applyFeint, resolveFeint, stepRunDuels, duelWaveSizes, KNOCK, knockWindow, initKnockOn, assignKnockRoles, knockTakerSpeed, knockTaker, knockOffset, knockRing, knockGradeNow, applyBurstKnock, knockSurgeBoost
	clamp = function(v, lo, hi)
		do return Math.max(lo, Math.min(hi, v)) end
	end
	easeOutCubic = function(t)
		local u = (1 - clamp(t, 0, 1))
		do return (1 - ((u * u) * u)) end
	end
	shuffle = function(arr, rng)
		local out = Js.aspread(arr)
		for i = (Js.alen(out) - 1), 1, -1 do
			local j = math.floor((rng() * (i + 1)))
			local _d1 = Js.alit(out[j + 1], out[i + 1])
			A.set(out, i, _d1[1])
			A.set(out, j, _d1[2])
		end
		do return out end
	end
	runSpeed = function(pace)
		do return (BASE_SPEED + ((clamp(pace, 0, 100) / 100) * PACE_SPEED)) end
	end
	exports.runSpeed = runSpeed
	waveSize = function(rng)
		do return (1 + math.floor((rng() * 4))) end
	end
	pickWaveSizes = function(rng, opts)
		local minRounds = ((function() local _v = opts; if _v == nil then return nil end; _v = _v.minRounds; return _v end)() or 2)
		local maxRounds = ((function() local _v = opts; if _v == nil then return nil end; _v = _v.maxRounds; return _v end)() or 4)
		local minSize = ((function() local _v = opts; if _v == nil then return nil end; _v = _v.minSize; return _v end)() or 1)
		local maxSize = ((function() local _v = opts; if _v == nil then return nil end; _v = _v.maxSize; return _v end)() or 4)
		local maxTotal = ((function() local _v = opts; if _v == nil then return nil end; _v = _v.maxTotal; return _v end)() or 10)
		local roundCount = (minRounds + math.floor((rng() * ((maxRounds - minRounds) + 1))))
		local sizes = Js.alit()
		local total = 0
		for r = 0, math.ceil(roundCount) - 1 do
			local remaining = (maxTotal - total)
			if (remaining < minSize) then
				do break end
			end
			local cap = Math.min(maxSize, remaining)
			local size = (minSize + math.floor((rng() * ((cap - minSize) + 1))))
			A.push(sizes, size)
			total += size
		end
		do return sizes end
	end
	exports.pickWaveSizes = pickWaveSizes
	placeWave = function(size, rng)
		local width = (CORRIDOR_HALF * 2)
		local minGap = Math.min(2.2, (width / (size + 1)))
		local xs = Js.alit()
		for i = 0, math.ceil(size) - 1 do
			local x = ((M_pitch.CX - CORRIDOR_HALF) + (rng() * width))
			do
				local tries = 0
				local _first2 = true
				while true do
					if not _first2 then
						tries += 1
					end
					_first2 = false
					if not ((tries < 20) and A.some(xs, function(o)
						return (math.abs((o - x)) < minGap)
					end)) then break end
					x = ((M_pitch.CX - CORRIDOR_HALF) + (rng() * width))
				end
			end
			A.push(xs, x)
		end
		do return xs end
	end
	newRun = function(opts)
		local _d3 = opts
		local rng = _d3.rng
		local classic = (if opts.classic ~= nil then opts.classic else false)
		local roundCount = (((function() local _v = opts.waveSizes; if _v == nil then return nil end; _v = Js.len(_v); return _v end)() or opts.rounds) or 3)
		local roster = (if (opts.roster and (Js.alen(opts.roster) > 0)) then shuffle(opts.roster, rng) else nil)
		local rosterIdx = 0
		local defenders = Js.alit()
		local roundSizes = Js.alit()
		for r = 0, math.ceil(roundCount) - 1 do
			local size = (if opts.waveSizes then opts.waveSizes[r + 1] else waveSize(rng))
			A.push(roundSizes, size)
			local factor = (if (roundCount > 1) then (0.85 + ((if classic then 0.15 else 0.23) * (r / (roundCount - 1)))) else 1)
			local y = ((START_Y - FIRST_DUEL_DEPTH) - (DUEL_GAP * r))
			local xs = placeWave(size, rng)
			local placed = (function() local _v = opts.lanes; if _v == nil then return nil end; _v = _v[r + 1]; return _v end)()
			if placed then
				A.forEach(placed, function(off, i)
					if ((i < Js.alen(xs)) and Js.NumberNS.isFinite(off)) then
						A.set(xs, i, clamp((M_pitch.CX + off), (M_pitch.CX - CORRIDOR_HALF), (M_pitch.CX + CORRIDOR_HALF)))
					end
				end)
			end
			local order = A.sort(A.map(xs, function(_, i)
				return i
			end), function(a, b)
				return (math.abs((xs[a + 1] - M_pitch.CX)) - math.abs((xs[b + 1] - M_pitch.CX)))
			end)
			local press = Js.Array.new(size)
			local steps = (if classic then PRESS_STEPS_BEFORE else PRESS_STEPS)
			A.forEach(order, function(i, rank)
				A.set(press, i, steps[Math.min(rank, (Js.alen(steps) - 1)) + 1])
			end)
			A.forEach(xs, function(x, i)
				local who = (if roster then roster[math.fmod((function() local _o = rosterIdx; rosterIdx = _o + 1; return _o end)(), Js.alen(roster)) + 1] else nil)
				local manQuality = (if who then clamp(((if who.defending ~= nil then who.defending else who.overall) or opts.oppStrength), 0, 100) else clamp(opts.oppStrength, 0, 100))
				local str = (manQuality * factor)
				A.push(defenders, Js.O({ x = x, y = y, phase = "waiting", read = x, mirrorSpeed = (2 + ((str / 100) * 1.6)), lagT = (0.32 - ((str / 100) * 0.14)), closeSpeed = (2.6 + ((str / 100) * 1.4)), commitD = (COMMIT_D_BASE * (0.85 + (rng() * 0.3))), tellT = (TELL_BASE * (1.25 - ((Math.min(100, str) / 100) * 0.5))), tell = 0, commitSide = 1, bias = (if (rng() < 0.5) then -1 else 1), lungeFrom = 0, lunge = 0, round = r, press = press[i + 1], who = who }, { "x", "y", "phase", "read", "mirrorSpeed", "lagT", "closeSpeed", "commitD", "tellT", "tell", "commitSide", "bias", "lungeFrom", "lunge", "round", "press", "who" }))
			end)
		end
		local mates = Js.alit()
		local mateCount = Math.max(0, Math.min(3, math.floor((if opts.mates ~= nil then opts.mates else 0))))
		for i = 0, math.ceil(mateCount) - 1 do
			local lane = (if (i == 0) then -1 else (if (i == 1) then 1 else 0))
			local central = (lane == 0)
			A.push(mates, Js.O({ x = 0, y = 0, lane = lane, baseOff = (if central then ((rng() - 0.5) * 3) else (lane * (5 + (rng() * 2.5)))), swayAmp = (if central then (1.5 + (rng() * 1.5)) else (1.2 + (rng() * 2))), baseLead = (if central then (16 + (rng() * 6)) else (7 + (rng() * 5))), leadAmp = (2 + (rng() * 3)), w = (0.9 + (rng() * 0.9)), phi = ((rng() * Math.PI) * 2), difficulty = 0, who = (if (opts.mateRoster and Js.T(Js.alen(opts.mateRoster))) then opts.mateRoster[math.fmod(i, Js.alen(opts.mateRoster)) + 1] else nil) }, { "x", "y", "lane", "baseOff", "swayAmp", "baseLead", "leadAmp", "w", "phi", "difficulty", "who" }))
		end
		local run = Js.O({ x = M_pitch.CX, y = START_Y, laneTarget = M_pitch.CX, speed = runSpeed(opts.pace), burst = nil, defenders = defenders, roundSizes = roundSizes, activeRound = (if (Js.alen(defenders) > 0) then 0 else -1), minX = (M_pitch.CX - CORRIDOR_HALF), maxX = (M_pitch.CX + CORRIDOR_HALF), startY = START_Y, clearY = CLEAR_Y, timeScale = 1, burstLock = 0, elapsed = 0, phase = "running", lostTo = nil, stride = 0, rng = rng, mates = mates, pass = nil }, { "x", "y", "laneTarget", "speed", "burst", "defenders", "roundSizes", "activeRound", "minX", "maxX", "startY", "clearY", "timeScale", "burstLock", "elapsed", "phase", "lostTo", "stride", "rng", "mates", "pass" })
		do
			local _arr4 = run.mates
			local _i5 = 0
			while _i5 < Js.alen(_arr4) do
				_i5 += 1
				local m = _arr4[_i5]
				placeMate(run, m, 0, true)
			end
		end
		if opts.duels then
			initDuels(run, opts.pace, (if opts.dribbling ~= nil then opts.dribbling else 55))
		elseif opts.knockOn then
			initKnockOn(run, opts.pace)
		end
		do return run end
	end
	exports.newRun = newRun
	applySteer = function(s, laneTarget)
		s.laneTarget = clamp(laneTarget, s.minX, s.maxX)
	end
	exports.applySteer = applySteer
	applyStick = function(s, x, y)
		local mx = (if Js.NumberNS.isFinite(x) then x else 0)
		local my = (if Js.NumberNS.isFinite(y) then y else 0)
		local m = Math.hypot(mx, my)
		if (m > 1) then
			mx /= m
			my /= m
		end
		s.stick = Js.O({ x = mx, y = my }, { "x", "y" })
		if (s.fwd == nil) then
			s.fwd = 0
		end
	end
	exports.applyStick = applyStick
	stickSpeed = function(mag, run)
		local m = clamp(mag, 0, 1)
		if (m < M_gait.STICK.dead) then
			do return 0 end
		end
		if (m >= M_gait.STICK.sprint) then
			do return (run * STICK_SPRINT) end
		end
		if (m < M_gait.STICK.walk) then
			do return ((run * STICK_WALK) * (0.5 + ((0.5 * (m - M_gait.STICK.dead)) / (M_gait.STICK.walk - M_gait.STICK.dead)))) end
		end
		if (m < M_gait.STICK.jog) then
			do return (run * (STICK_WALK + (((STICK_JOG - STICK_WALK) * (m - M_gait.STICK.walk)) / (M_gait.STICK.jog - M_gait.STICK.walk)))) end
		end
		do return (run * (STICK_JOG + (((1 - STICK_JOG) * (m - M_gait.STICK.jog)) / (M_gait.STICK.sprint - M_gait.STICK.jog)))) end
	end
	exports.stickSpeed = stickSpeed
	stickMotion = function(s, sdt)
		local st = s.stick
		local mag = Math.hypot(st.x, st.y)
		local want = stickSpeed(mag, s.speed)
		local ux = (if (mag > 0.000001) then (st.x / mag) else 0)
		local uy = (if (mag > 0.000001) then (st.y / mag) else 0)
		local wantFwd = (want * uy)
		local cur = (if s.fwd ~= nil then s.fwd else 0)
		local rate = ((if (wantFwd > cur) then (s.speed / STICK_UP_T) else (s.speed / STICK_DOWN_T)) * sdt)
		s.fwd = (cur + clamp((wantFwd - cur), (-rate), rate))
		s.x += (clamp((want * ux), (-STICK_LAT), STICK_LAT) * sdt)
		s.x = clamp(s.x, s.minX, s.maxX)
		s.laneTarget = s.x
		do return s.fwd end
	end
	stickBallLead = function(s, footSide, burst)
		if burst == nil then burst = 0 end
		local sp = Math.max(0, (if s.fwd ~= nil then s.fwd else 0))
		local k = clamp((sp / Math.max(0.1, s.speed)), 0, STICK_SPRINT)
		local step = (0.55 + (1.5 * (carryLead(s.stride, footSide, burst) - 0.42)))
		do return ((0.32 + ((step - 0.32) * Math.min(1, k))) + (Math.max(0, (k - 1)) * 2.2)) end
	end
	exports.stickBallLead = stickBallLead
	nearestLiveInActiveRound = function(s)
		local best = nil
		do
			local _arr6 = s.defenders
			local _i7 = 0
			while _i7 < Js.alen(_arr6) do
				_i7 += 1
				local d = _arr6[_i7]
				if (((d.round ~= s.activeRound) or (d.phase == "beaten")) or (d.phase == "won")) then
					do continue end
				end
				if ((not best) or ((s.y - d.y) < (s.y - best.y))) then
					best = d
				end
			end
		end
		do return best end
	end
	applyBurst = function(s, dir)
		if s.duels then
			do return applyBurstDuel(s, dir) end
		end
		if s.knockOn then
			do return applyBurstKnock(s, dir) end
		end
		if (((s.phase ~= "running") or s.burst) or (s.burstLock > 0)) then
			do return false end
		end
		local threat = nearestLiveInActiveRound(s)
		local power = (if ((function() local _v = threat; if _v == nil then return nil end; _v = _v.phase; return _v end)() == "committed") then 0.3 else 1)
		s.burst = Js.O({ dir = dir, t = 0, done = 0, power = power }, { "dir", "t", "done", "power" })
		s.burstLock = BURST_LOCK
		do return true end
	end
	exports.applyBurst = applyBurst
	pickSide = function(def, s)
		local drift = (s.x - def.x)
		do return (if (math.abs(drift) > SHOW_SIDE) then (if (drift > 0) then 1 else -1) else def.bias) end
	end
	stepDefender = function(idx, s, sdt)
		local def = s.defenders[idx + 1]
		local _sw8 = def.phase
		local _ci9 = (if _sw8 == "waiting" then 1 elseif _sw8 == "closing" then 2 elseif _sw8 == "telegraph" then 3 elseif _sw8 == "committed" then 4 else 5)
		local _cont10 = false
		repeat
			if _ci9 ~= 0 and _ci9 <= 1 then
				do
					local d = (s.y - def.y)
					if (d <= ENGAGE_D) then
						def.phase = "closing"
						if s.knockOn then
							assignKnockRoles(s, def.round)
						end
					end
					do return end
				end
			end
			if _ci9 ~= 0 and _ci9 <= 2 then
				do
					def.read += ((s.x - def.read) * Math.min(1, (sdt / def.lagT)))
					local mirror = (def.mirrorSpeed * def.press)
					if (def.role == "taker") then
						mirror = Math.max(mirror, knockTakerSpeed(s, def))
					end
					def.x += clamp((def.read - def.x), ((-mirror) * sdt), (mirror * sdt))
					def.y += (def.closeSpeed * sdt)
					if (((s.y - def.y) <= def.commitD) and (def.role ~= "cover")) then
						def.phase = "telegraph"
						def.commitSide = (if def.readDir ~= nil then def.readDir else pickSide(def, s))
						def.tell = def.tellT
					end
					do break end
				end
			end
			if _ci9 ~= 0 and _ci9 <= 3 then
				do
					def.tell -= sdt
					def.y += (def.closeSpeed * sdt)
					if (def.tell <= 0) then
						def.phase = "committed"
						def.lungeFrom = def.x
						def.lunge = 0
						if s.knockOn then
							def.commitAt = s.elapsed
						end
					end
					do break end
				end
			end
			if _ci9 ~= 0 and _ci9 <= 4 then
				do
					def.lunge = Math.min(1, (def.lunge + (sdt / LUNGE_T)))
					def.x = (def.lungeFrom + ((def.commitSide * LUNGE_REACH) * easeOutCubic(def.lunge)))
					def.y += (def.closeSpeed * sdt)
					do break end
				end
			end
			if _ci9 ~= 0 and _ci9 <= 5 then
				do return end
			end
		until true
		if ((s.y - def.y) <= CONTACT_D) then
			local sep = math.abs((s.x - def.x))
			def.sepAtContact = sep
			if (sep >= CLEAR_SEP) then
				def.phase = "beaten"
				s.speed *= 0.94
			else
				def.phase = "won"
				s.phase = "lost"
				s.lostTo = idx
			end
		end
	end
	stepRun = function(s, dt)
		if s.duels then
			do return stepRunDuels(s, dt) end
		end
		if (s.phase ~= "running") then
			do return s.phase end
		end
		local sdt = (dt * s.timeScale)
		s.elapsed += sdt
		s.burstLock = Math.max(0, (s.burstLock - sdt))
		local boost = 1
		if s.burst then
			local b = s.burst
			local T = (if b.dur ~= nil then b.dur else BURST_T)
			b.t += sdt
			local f = easeOutCubic((b.t / T))
			local target = (((if b.lat ~= nil then b.lat else BURST_LATERAL) * b.power) * f)
			s.x += (b.dir * (target - b.done))
			b.done = target
			boost = (1 + ((BURST_BOOST - 1) * (1 - clamp((b.t / T), 0, 1))))
			if (b.t >= T) then
				s.burst = nil
			end
		end
		local forward = nil
		if s.stick then
			forward = (stickMotion(s, sdt) * boost)
		else
			s.x += clamp((s.laneTarget - s.x), ((-STEER_SPEED) * sdt), (STEER_SPEED * sdt))
			s.x = clamp(s.x, s.minX, s.maxX)
			forward = (s.speed * boost)
		end
		if s.knockOn then
			forward *= knockSurgeBoost(s, sdt)
		end
		s.y -= (forward * sdt)
		if (s.y > (s.startY + STICK_BACK_ROOM)) then
			s.y = (s.startY + STICK_BACK_ROOM)
		end
		s.stride += (math.abs(forward) * sdt)
		do
			local _arr11 = s.mates
			local _i12 = 0
			while _i12 < Js.alen(_arr11) do
				_i12 += 1
				local m = _arr11[_i12]
				placeMate(s, m, sdt, false)
			end
		end
		local activeRound = -1
		do
			local _arr13 = s.defenders
			local _i14 = 0
			while _i14 < Js.alen(_arr13) do
				_i14 += 1
				local d = _arr13[_i14]
				if ((d.phase ~= "beaten") and (d.phase ~= "won")) then
					activeRound = d.round
					do break end
				end
			end
		end
		s.activeRound = activeRound
		if (activeRound >= 0) then
			do
				local i = 0
				local _first15 = true
				while true do
					if not _first15 then
						i += 1
					end
					_first15 = false
					if not (i < Js.alen(s.defenders)) then break end
					local d = s.defenders[i + 1]
					if (((d.round ~= activeRound) or (d.phase == "beaten")) or (d.phase == "won")) then
						do continue end
					end
					stepDefender(i, s, sdt)
					if (s.phase ~= "running") then
						do break end
					end
				end
			end
			s.timeScale = (if A.some(s.defenders, function(d)
				return ((d.round == activeRound) and (d.phase == "telegraph"))
			end) then TELE_SLOW else 1)
		else
			s.timeScale = 1
		end
		if (s.phase ~= "running") then
			do return s.phase end
		end
		local allBeaten = A.every(s.defenders, function(d)
			return (d.phase == "beaten")
		end)
		if (allBeaten and (s.y <= s.clearY)) then
			s.phase = "clear"
			do return s.phase end
		end
		if (s.elapsed > RUN_TIMEOUT) then
			s.phase = "lost"
			s.lostTo = nil
			do return s.phase end
		end
		do return "running" end
	end
	exports.stepRun = stepRun
	passBand = function(difficulty)
		do return (if (difficulty < PASS_EASY_BELOW) then "easy" else (if (difficulty < PASS_HARD_FROM) then "medium" else "hard")) end
	end
	exports.passBand = passBand
	placeMate = function(s, m, sdt, snap)
		local t = s.elapsed
		local targetX = clamp(((((0.5 * M_pitch.CX) + (0.5 * s.x)) + m.baseOff) + (m.swayAmp * Math.sin(((m.w * t) + m.phi)))), (s.minX - 1), (s.maxX + 1))
		local lead = (m.baseLead + (m.leadAmp * Math.sin((((0.7 * m.w) * t) + (2 * m.phi)))))
		if snap then
			m.x = targetX
		else
			m.x += clamp((targetX - m.x), ((-MATE_SHIFT) * sdt), (MATE_SHIFT * sdt))
		end
		m.y = Math.max(MATE_MIN_Y, (s.y - lead))
		m.difficulty = passDifficulty(s, m)
	end
	passDifficulty = function(s, m)
		local vx = (m.x - s.x)
		local vy = (m.y - s.y)
		local d2 = ((vx * vx) + (vy * vy))
		local d = (function() local _l = Math.sqrt(d2); if Js.T(_l) then return _l end; return 0.000001 end)()
		local distTerm = clamp(((d - 7) / 18), 0, 1)
		local block = 0
		local mark = 0
		do
			local _arr16 = s.defenders
			local _i17 = 0
			while _i17 < Js.alen(_arr16) do
				_i17 += 1
				local def = _arr16[_i17]
				if ((def.phase == "beaten") or (def.phase == "won")) then
					do continue end
				end
				local px = (def.x - s.x)
				local py = (def.y - s.y)
				local t = (((px * vx) + (py * vy)) / d2)
				if ((t > 0.08) and (t < 0.95)) then
					local perp = Math.hypot((px - (t * vx)), (py - (t * vy)))
					block = Math.max(block, clamp((1 - (perp / 2.4)), 0, 1))
				end
				local toMate = Math.hypot((def.x - m.x), (def.y - m.y))
				mark = Math.max(mark, clamp((1 - (toMate / 3)), 0, 1))
			end
		end
		local forward = clamp(((-vy) / d), 0, 1)
		do return clamp(((((0.08 + (0.35 * distTerm)) + (0.6 * block)) + (0.3 * mark)) + (0.12 * forward)), 0, 1) end
	end
	exports.passDifficulty = passDifficulty
	passSuccessChance = function(difficulty, vision)
		if vision == nil then vision = 55 end
		local d = clamp(difficulty, 0, 1)
		do return clamp((((M_tuningStore.getTuning("dribble.passBest") - (0.5 * d)) - ((0.9 * d) * d)) + (((clamp(vision, 0, 100) - 55) / 100) * M_tuningStore.getTuning("dribble.passVision"))), 0.05, 0.95) end
	end
	exports.passSuccessChance = passSuccessChance
	wavesBeaten = function(s)
		local n = 0
		for r = 0, (Js.alen(s.roundSizes)) - 1 do
			if A.every(A.filter(s.defenders, function(d)
				return (d.round == r)
			end), function(d)
				return (d.phase == "beaten")
			end) then
				n += 1
			end
		end
		do return n end
	end
	exports.wavesBeaten = wavesBeaten
	applyPass = function(s, idx, vision)
		if vision == nil then vision = 55 end
		if (s.phase ~= "running") then
			do return nil end
		end
		local m = s.mates[idx + 1]
		if (not m) then
			do return nil end
		end
		local difficulty = passDifficulty(s, m)
		local chance = passSuccessChance(difficulty, vision)
		local success = (s.rng() < chance)
		local result = Js.O({ to = idx, success = success, difficulty = difficulty, chance = chance, afterWaves = wavesBeaten(s), totalWaves = Js.alen(s.roundSizes), at = Js.O({ x = m.x, y = m.y }, { "x", "y" }) }, { "to", "success", "difficulty", "chance", "afterWaves", "totalWaves", "at" })
		s.pass = result
		s.phase = (if success then "passed" else "lost")
		if (not success) then
			s.lostTo = nil
		end
		s.timeScale = 1
		do return result end
	end
	exports.applyPass = applyPass
	runProgress = function(s)
		local total = (s.startY - s.clearY)
		if (total <= 0) then
			do return 1 end
		end
		do return clamp(((s.startY - s.y) / total), 0, 1) end
	end
	exports.runProgress = runProgress
	stepCameraLean = function(lean, ballOff, poseSide, feel, dt)
		local dir = lean.dir
		if (ballOff > feel.flipAt) then
			dir = 1
		elseif (ballOff < (-feel.flipAt)) then
			dir = -1
		end
		local side = (lean.side + ((((dir * poseSide) * feel.sideScale) - lean.side) * (1 - Math.exp(((-feel.sideRate) * dt)))))
		do return Js.O({ dir = dir, side = side }, { "dir", "side" }) end
	end
	exports.stepCameraLean = stepCameraLean
	carryLead = function(stride, footSide, burst)
		if burst == nil then burst = 0 end
		local phase = (((stride / OWN_GAIT_M) * Math.PI) * 2)
		local touchAt = (if (footSide > 0) then (Math.PI * 1.5) else (Math.PI * 0.5))
		local u = math.fmod(((phase - touchAt) / (Math.PI * 2)), 1)
		if (u < 0) then
			u += 1
		end
		local away = Math.sin((Math.PI * Math.pow(u, 0.6)))
		do return ((CARRY.leadMin + (CARRY.push * away)) + (CARRY.burstExtra * clamp(burst, 0, 1))) end
	end
	exports.carryLead = carryLead
	lerp01 = function(a, b, t)
		do return (a + ((b - a) * clamp(t, 0, 1))) end
	end
	duelEvent = function(s, text, tone)
		A.push((function() if s.events == nil then s.events = Js.alit() end; return s.events end)(), Js.O({ t = s.elapsed, text = text, tone = tone }, { "t", "text", "tone" }))
		if (Js.alen(s.events) > 12) then
			A.shift(s.events)
		end
	end
	qualityOf = function(d)
		do return clamp(((d.mirrorSpeed - 2) / 1.6), 0, 1.1) end
	end
	initDuels = function(s, pace, dribbling)
		local rng = s.rng
		s.duels = true
		s.dribbling = clamp(dribbling, 0, 100)
		s.paceStat = clamp(pace, 0, 100)
		s.feint = nil
		s.events = Js.alit()
		s.fouledBy = nil
		s.touchT = 0
		do
			local _arr18 = s.defenders
			local _i19 = 0
			while _i19 < Js.alen(_arr18) do
				_i19 += 1
				local d = _arr18[_i19]
				local q = qualityOf(d)
				d.q = q
				local outside = (if (d.x >= M_pitch.CX) then 1 else -1)
				d.show = (if (rng() < 0.8) then outside else (-outside))
				d.jockeyT = 0
				d.patience = (lerp01(DUEL.patience[1], DUEL.patience[2], q) * (0.8 + (rng() * 0.4)))
				d.commitD = (DUEL.stabD[1] + (rng() * (DUEL.stabD[2] - DUEL.stabD[1])))
				d.tellT = lerp01(DUEL.tell[1], DUEL.tell[2], q)
				d.feints = 0
			end
		end
	end
	graceShare = function(dribbling)
		do return lerp01(DUEL.grace[1], DUEL.grace[2], (dribbling / 100)) end
	end
	exports.graceShare = graceShare
	biteChance = function(kind, dribbling, defending01)
		do return clamp(((DUEL.feint[kind].bite + (0.7 * ((dribbling / 100) - 0.6))) - (0.5 * (defending01 - 0.6))), 0.05, 0.9) end
	end
	exports.biteChance = biteChance
	heavyTouchChance = function(dribbling)
		do return (DUEL.heavy * Math.pow((1 - (clamp(dribbling, 0, 100) / 100)), 1.3)) end
	end
	exports.heavyTouchChance = heavyTouchChance
	startTell = function(d, s, scramble)
		d.phase = "telegraph"
		local drift = (s.x - d.x)
		d.commitSide = (if (math.abs(drift) > SHOW_SIDE) then (if (drift > 0) then 1 else -1) else (if d.show ~= nil then d.show else d.bias))
		if (scramble and sold:has(d)) then
			d.commitSide = (if d.leanDir ~= nil then d.leanDir else d.commitSide)
		end
		d.tell = (d.tellT * (if scramble then DUEL.scramble else (if read:has(d) then DUEL.readTell else 1)))
	end
	stepDefenderDuel = function(idx, s, sdt, forward)
		local d = s.defenders[idx + 1]
		local gap = function()
			return (s.y - d.y)
		end
		local showOff = ((if d.show ~= nil then d.show else 1) * DUEL.showOff)
		local _sw20 = d.phase
		local _ci21 = (if _sw20 == "waiting" then 1 elseif _sw20 == "closing" then 2 elseif _sw20 == "jockey" then 3 elseif _sw20 == "bitten" then 4 elseif _sw20 == "telegraph" then 5 elseif _sw20 == "committed" then 6 else 7)
		local _cont22 = false
		repeat
			if _ci21 ~= 0 and _ci21 <= 1 then
				if (gap() <= DUEL.engageD) then
					d.phase = "closing"
				end
				do return end
			end
			if _ci21 ~= 0 and _ci21 <= 2 then
				do
					d.read += ((s.x - d.read) * Math.min(1, (sdt / d.lagT)))
					local mirror = d.mirrorSpeed
					d.x += clamp(((d.read - showOff) - d.x), ((-mirror) * sdt), (mirror * sdt))
					d.y += (d.closeSpeed * sdt)
					if (gap() <= DUEL.jockeyD) then
						d.phase = "jockey"
						d.jockeyT = 0
					end
					do break end
				end
			end
			if _ci21 ~= 0 and _ci21 <= 3 then
				do
					d.read += ((s.x - d.read) * Math.min(1, (sdt / d.lagT)))
					local mirror = d.mirrorSpeed
					d.x += clamp(((d.read - showOff) - d.x), ((-mirror) * sdt), (mirror * sdt))
					d.jockeyT = ((if d.jockeyT ~= nil then d.jockeyT else 0) + sdt)
					if (d.jockeyT >= (if d.patience ~= nil then d.patience else 1)) then
						stepIn:add(d)
					end
					if stepIn:has(d) then
						d.y += ((d.closeSpeed * 0.5) * sdt)
					else
						d.y -= ((forward * DUEL.give) * sdt)
					end
					if (gap() <= d.commitD) then
						startTell(d, s, false)
					end
					do break end
				end
			end
			if _ci21 ~= 0 and _ci21 <= 4 then
				do
					d.offBal = ((if d.offBal ~= nil then d.offBal else 0) - sdt)
					local from = (leanFrom:get(d) or d.x)
					local to = (from + ((if d.leanDir ~= nil then d.leanDir else 1) * DUEL.lean))
					d.x += clamp((to - d.x), (-5 * sdt), (5 * sdt))
					if (d.offBal <= 0) then
						startTell(d, s, true)
					end
					do break end
				end
			end
			if _ci21 ~= 0 and _ci21 <= 5 then
				do
					d.tell -= sdt
					if (d.tell <= 0) then
						d.phase = "committed"
						d.lungeFrom = d.x
						d.lunge = 0
					end
					do break end
				end
			end
			if _ci21 ~= 0 and _ci21 <= 6 then
				do
					d.lunge = Math.min(1, (d.lunge + (sdt / DUEL.lungeT)))
					d.x = (d.lungeFrom + ((d.commitSide * DUEL.lungeReach) * easeOutCubic(d.lunge)))
					d.y += (DUEL.lungeIn * sdt)
					do break end
				end
			end
			if _ci21 ~= 0 and _ci21 <= 7 then
				do return end
			end
		until true
		if (gap() > CONTACT_D) then
			do return end
		end
		local sep = math.abs((s.x - d.x))
		d.sepAtContact = sep
		local rng = s.rng
		local tackling = (d.phase == "committed")
		if (sep >= CLEAR_SEP) then
			if ((tackling and (sep < (CLEAR_SEP + DUEL.foulNear))) and (rng() < DUEL.foulBeaten)) then
				foul(s, idx)
				do return end
			end
			if (sep < (CLEAR_SEP + DUEL.recoverNear)) then
				local hisPace = (60 + (25 * ((if d.q ~= nil then d.q else 0.6) - 0.5)))
				local p = (DUEL.recover * clamp((1 + ((hisPace - (if s.paceStat ~= nil then s.paceStat else 60)) / 50)), 0.25, 1.8))
				if (rng() < p) then
					if (rng() < 0.5) then
						foul(s, idx)
						do return end
					end
					lose(s, idx, "He gets back and takes it")
					do return end
				end
			end
			d.phase = "beaten"
			s.speed *= 0.95
			duelEvent(s, "Past him!", "good")
			do return end
		end
		if ((sep > (CLEAR_SEP - DUEL.foulMiss)) and (rng() < DUEL.foulWon)) then
			foul(s, idx)
			do return end
		end
		lose(s, idx, (if tackling then "Tackled" else "He stands you up"))
	end
	stepCover = function(idx, s, sdt)
		local d = s.defenders[idx + 1]
		if (d.phase == "waiting") then
			if ((s.y - d.y) <= DUEL.engageD) then
				d.phase = "closing"
			end
			do return end
		end
		local p = (if (s.presser ~= nil) then s.defenders[s.presser + 1] else nil)
		local mirror = ((d.mirrorSpeed * d.press) * 0.7)
		d.read += ((s.x - d.read) * Math.min(1, (sdt / d.lagT)))
		local side = (if p then (if (d.x >= p.x) then 1 else -1) else 0)
		local wantX = (if p then clamp((d.read + (side * 2.4)), (s.minX - 1), (s.maxX + 1)) else d.read)
		d.x += clamp((wantX - d.x), ((-mirror) * sdt), (mirror * sdt))
		local wantY = (if p then Math.min((d.y + (d.closeSpeed * sdt)), (p.y - COVER_DEPTH)) else (d.y + (d.closeSpeed * sdt)))
		d.y = Math.max(Math.min(wantY, ((s.y - DUEL.jockeyD) - 0.5)), (d.y - (s.speed * sdt)))
		d.phase = "closing"
	end
	foul = function(s, idx)
		local d = s.defenders[idx + 1]
		d.phase = "beaten"
		d.fouled = true
		s.phase = "fouled"
		s.fouledBy = idx
		duelEvent(s, "Fouled — free kick", "good")
	end
	lose = function(s, idx, text)
		s.defenders[idx + 1].phase = "won"
		s.phase = "lost"
		s.lostTo = idx
		duelEvent(s, text, "bad")
	end
	duelThreat = function(s)
		do return nearestLiveInActiveRound(s) end
	end
	exports.duelThreat = duelThreat
	applyBurstDuel = function(s, dir)
		if ((((s.phase ~= "running") or s.burst) or (s.burstLock > 0)) or s.feint) then
			do return false end
		end
		local threat = nearestLiveInActiveRound(s)
		local drib = (if s.dribbling ~= nil then s.dribbling else 55)
		local power = 1
		if ((function() local _v = threat; if _v == nil then return nil end; _v = _v.phase; return _v end)() == "committed") then
			power = (if (threat.lunge <= graceShare(drib)) then 1 else 0.3)
		end
		local cut = ((math.abs((s.x - M_pitch.CX)) > 1.2) and (Math.sign((M_pitch.CX - s.x)) == dir))
		local lat = ((BURST_LATERAL * (0.9 + ((0.25 * (if s.paceStat ~= nil then s.paceStat else 60)) / 100))) * (if cut then 1.2 else 1))
		if (s.rng() < heavyTouchChance(drib)) then
			power *= 0.35
			duelEvent(s, "Heavy touch", "bad")
		else
			duelEvent(s, (if cut then "Cuts inside" else "Knocks it past"), "info")
		end
		if (((threat and (threat.phase == "bitten")) and (dir == (-(if threat.leanDir ~= nil then threat.leanDir else 0)))) and (power >= 1)) then
			sold:add(threat)
		end
		if (threat and (threat.phase == "jockey")) then
			threat.read = (s.x + ((dir * lat) * 0.5))
			stepIn:add(threat)
		end
		s.burst = Js.O({ dir = dir, t = 0, done = 0, power = power, lat = lat, move = (if cut then "cut" else "burst") }, { "dir", "t", "done", "power", "lat", "move" })
		s.burstLock = BURST_LOCK
		s.touchT = 0
		do return true end
	end
	applyFeint = function(s, kind, dir)
		if ((((not s.duels) or (s.phase ~= "running")) or s.feint) or s.burst) then
			do return false end
		end
		s.feint = Js.O({ kind = kind, dir = dir, t = 0, dur = DUEL.feint[kind].dur }, { "kind", "dir", "t", "dur" })
		if (kind == "shoulder") then
			s.laneTarget = clamp((s.x + (dir * 0.3)), s.minX, s.maxX)
		end
		do return true end
	end
	exports.applyFeint = applyFeint
	resolveFeint = function(s, f)
		local d = nearestLiveInActiveRound(s)
		local name = (if (f.kind == "stepover") then "Step-over" else "Shoulder drop")
		if (not d) then
			duelEvent(s, name, "info")
			do return end
		end
		local gap = (s.y - d.y)
		if ((d.phase == "telegraph") or (d.phase == "committed")) then
			duelEvent(s, (name .. " — too late"), "bad")
			do return end
		end
		if (d.phase == "bitten") then
			duelEvent(s, name, "info")
			do return end
		end
		if ((gap > DUEL.feint[f.kind].range) or ((d.phase ~= "jockey") and (d.phase ~= "closing"))) then
			duelEvent(s, (name .. " — too far out"), "info")
			do return end
		end
		local p = (biteChance(f.kind, (if s.dribbling ~= nil then s.dribbling else 55), (if d.q ~= nil then d.q else 0.6)) * Math.pow(0.5, (if d.feints ~= nil then d.feints else 0)))
		d.feints = ((if d.feints ~= nil then d.feints else 0) + 1)
		if (s.rng() < p) then
			d.phase = "bitten"
			d.leanDir = f.dir
			leanFrom:set(d, d.x)
			d.offBal = lerp01(DUEL.offBal[1], DUEL.offBal[2], (if d.q ~= nil then d.q else 0.6))
			duelEvent(s, (name .. " — he bites!"), "good")
		else
			stepIn:add(d)
			read:add(d)
			duelEvent(s, (name .. " — he reads it"), "bad")
		end
	end
	stepRunDuels = function(s, dt)
		if (s.phase ~= "running") then
			do return s.phase end
		end
		local sdt = (dt * s.timeScale)
		s.elapsed += sdt
		s.burstLock = Math.max(0, (s.burstLock - sdt))
		s.touchT = ((if s.touchT ~= nil then s.touchT else 0) + sdt)
		local boost = 1
		if s.burst then
			local b = s.burst
			b.t += sdt
			local f = easeOutCubic((b.t / BURST_T))
			local target = (((if b.lat ~= nil then b.lat else BURST_LATERAL) * b.power) * f)
			s.x += (b.dir * (target - b.done))
			b.done = target
			local peak = (if (b.move == "cut") then 1.12 else BURST_BOOST)
			boost = (1 + (((peak - 1) * b.power) * (1 - clamp((b.t / BURST_T), 0, 1))))
			if (b.t >= BURST_T) then
				s.burst = nil
				s.laneTarget = s.x
			end
		end
		local slow = 1
		if s.feint then
			local f = s.feint
			f.t += sdt
			slow = (if (f.kind == "stepover") then 0.8 else 0.92)
			if (f.t >= f.dur) then
				s.feint = nil
				resolveFeint(s, f)
			end
		end
		local forward = nil
		if s.stick then
			forward = ((stickMotion(s, sdt) * boost) * slow)
		else
			s.x += clamp((s.laneTarget - s.x), ((-STEER_SPEED) * sdt), (STEER_SPEED * sdt))
			s.x = clamp(s.x, s.minX, s.maxX)
			forward = ((s.speed * boost) * slow)
		end
		s.y -= (forward * sdt)
		if (s.y > (s.startY + STICK_BACK_ROOM)) then
			s.y = (s.startY + STICK_BACK_ROOM)
		end
		s.stride += (math.abs(forward) * sdt)
		do
			local _arr23 = s.mates
			local _i24 = 0
			while _i24 < Js.alen(_arr23) do
				_i24 += 1
				local m = _arr23[_i24]
				placeMate(s, m, sdt, false)
			end
		end
		local activeRound = -1
		do
			local _arr25 = s.defenders
			local _i26 = 0
			while _i26 < Js.alen(_arr25) do
				_i26 += 1
				local d = _arr25[_i26]
				if ((d.phase ~= "beaten") and (d.phase ~= "won")) then
					activeRound = d.round
					do break end
				end
			end
		end
		s.activeRound = activeRound
		if (activeRound >= 0) then
			local live = function(i)
				local d = s.defenders[i + 1]
				do return (((d and (d.round == activeRound)) and (d.phase ~= "beaten")) and (d.phase ~= "won")) end
			end
			if ((s.presser == nil) or (not live(s.presser))) then
				local best = -1
				local bestD = math.huge
				A.forEach(s.defenders, function(d, i)
					if (not live(i)) then
						do return end
					end
					local dist = ((s.y - d.y) + (0.6 * math.abs((s.x - d.x))))
					if (dist < bestD) then
						bestD = dist
						best = i
					end
				end)
				s.presser = (if (best >= 0) then best else nil)
			end
			do
				local i = 0
				local _first27 = true
				while true do
					if not _first27 then
						i += 1
					end
					_first27 = false
					if not (i < Js.alen(s.defenders)) then break end
					if (not live(i)) then
						do continue end
					end
					if (i == s.presser) then
						stepDefenderDuel(i, s, sdt, (s.speed * slow))
					else
						stepCover(i, s, sdt)
					end
					if (s.phase ~= "running") then
						do break end
					end
				end
			end
			s.timeScale = (if A.some(s.defenders, function(d)
				return ((d.round == activeRound) and ((d.phase == "telegraph") or (d.phase == "bitten")))
			end) then TELE_SLOW else 1)
			do
				local _arr28 = s.defenders
				local _i29 = 0
				while _i29 < Js.alen(_arr28) do
					_i29 += 1
					local d = _arr28[_i29]
					if ((d.round <= activeRound) or (d.phase ~= "waiting")) then
						do continue end
					end
					local ahead = (WAVE_HOLD + ((DUEL_GAP * 0.5) * ((d.round - activeRound) - 1)))
					if ((s.y - d.y) < ahead) then
						d.y = Math.max(1, (s.y - ahead))
					end
				end
			end
		else
			s.timeScale = 1
		end
		if (s.phase ~= "running") then
			s.timeScale = 1
			do return s.phase end
		end
		if (A.every(s.defenders, function(d)
			return (d.phase == "beaten")
		end) and (s.y <= s.clearY)) then
			s.phase = "clear"
			do return s.phase end
		end
		if (s.elapsed > RUN_TIMEOUT) then
			s.phase = "lost"
			s.lostTo = nil
			do return s.phase end
		end
		do return "running" end
	end
	duelWaveSizes = function(rng)
		do return pickWaveSizes(rng, Js.O({ minRounds = 2, maxRounds = 3, maxSize = 2, maxTotal = 5 }, { "minRounds", "maxRounds", "maxSize", "maxTotal" })) end
	end
	exports.duelWaveSizes = duelWaveSizes
	knockWindow = function(strength)
		do return lerp01(KNOCK.winEasy, KNOCK.winHard, Math.pow((clamp(strength, 0, 100) / 100), KNOCK.winCurve)) end
	end
	exports.knockWindow = knockWindow
	initKnockOn = function(s, pace)
		s.knockOn = true
		s.knockPace = clamp(pace, 0, 100)
		s.surge = 0
		s.knocks = Js.alit()
		s.events = Js.alit()
		do
			local _arr30 = s.defenders
			local _i31 = 0
			while _i31 < Js.alen(_arr30) do
				_i31 += 1
				local d = _arr30[_i31]
				local str = (clamp(((1.25 - (d.tellT / TELL_BASE)) / 0.5), 0, 1) * 100)
				d.goWin = knockWindow(str)
			end
		end
	end
	assignKnockRoles = function(s, round)
		local wave = A.filter(s.defenders, function(d)
			return (d.round == round)
		end)
		if ((Js.alen(wave) == 0) or A.some(wave, function(d)
			return d.role
		end)) then
			do return end
		end
		local taker = wave[1]
		do
			local _arr32 = wave
			local _i33 = 0
			while _i33 < Js.alen(_arr32) do
				_i33 += 1
				local d = _arr32[_i33]
				if (math.abs((d.x - s.x)) < math.abs((taker.x - s.x))) then
					taker = d
				end
			end
		end
		do
			local _arr34 = wave
			local _i35 = 0
			while _i35 < Js.alen(_arr34) do
				_i35 += 1
				local d = _arr34[_i35]
				d.role = (if (d == taker) then "taker" else "cover")
				if (d.role == "cover") then
					d.press = KNOCK.coverPress
				end
			end
		end
	end
	knockTakerSpeed = function(s, d)
		local depthLeft = Math.max(0.5, ((s.y - d.y) - d.commitD))
		local timeLeft = (depthLeft / Math.max(1, (s.speed + d.closeSpeed)))
		do return Math.min(KNOCK.takerCross, ((math.abs((d.read - d.x)) / timeLeft) * 1.2)) end
	end
	knockTaker = function(s)
		do return A.find(s.defenders, function(d)
			return ((((d.round == s.activeRound) and (d.role == "taker")) and (d.phase ~= "beaten")) and (d.phase ~= "won"))
		end) end
	end
	exports.knockTaker = knockTaker
	knockOffset = function(s, d)
		if (d.phase == "telegraph") then
			do return ((-d.tell) / TELE_SLOW) end
		end
		if ((d.phase == "committed") and (d.commitAt ~= nil)) then
			do return (s.elapsed - d.commitAt) end
		end
		do return nil end
	end
	exports.knockOffset = knockOffset
	knockRing = function(d, elapsed)
		if (d.role ~= "taker") then
			do return Js.O({ stage = "gone", t = 0 }, { "stage", "t" }) end
		end
		if (d.phase == "closing") then
			do return Js.O({ stage = "coming", t = 0 }, { "stage", "t" }) end
		end
		local w = (if d.goWin ~= nil then d.goWin else KNOCK.winEasy)
		local off = nil
		if (d.phase == "telegraph") then
			off = ((-d.tell) / TELE_SLOW)
		elseif ((d.phase == "committed") and (d.commitAt ~= nil)) then
			off = (elapsed - d.commitAt)
		end
		if (off == nil) then
			do return Js.O({ stage = "gone", t = 0 }, { "stage", "t" }) end
		end
		local start = ((-w) * KNOCK.before)
		if (off < start) then
			local tellWall = (d.tellT / TELE_SLOW)
			local waited = (tellWall + off)
			do return Js.O({ stage = "wait", t = clamp((waited / Math.max(0.01, (tellWall + start))), 0, 1) }, { "stage", "t" }) end
		end
		if (off <= (w * (1 - KNOCK.before))) then
			do return Js.O({ stage = "go", t = ((off - start) / Math.max(0.01, w)) }, { "stage", "t" }) end
		end
		do return Js.O({ stage = "gone", t = 0 }, { "stage", "t" }) end
	end
	exports.knockRing = knockRing
	knockGradeNow = function(s, d)
		local off = knockOffset(s, d)
		local w = (if d.goWin ~= nil then d.goWin else KNOCK.winEasy)
		if (off == nil) then
			do return (if ((d.phase == "closing") or (d.phase == "waiting")) then "early" else "late") end
		end
		if (off < ((-w) * KNOCK.before)) then
			do return "early" end
		end
		if (off > (w * (1 - KNOCK.before))) then
			do return "late" end
		end
		do return "perfect" end
	end
	exports.knockGradeNow = knockGradeNow
	applyBurstKnock = function(s, dir)
		if (((s.phase ~= "running") or s.burst) or (s.burstLock > 0)) then
			do return false end
		end
		local d = knockTaker(s)
		if (not d) then
			s.burst = Js.O({ dir = dir, t = 0, done = 0, power = 1 }, { "dir", "t", "done", "power" })
			s.burstLock = BURST_LOCK
			do return true end
		end
		local grade = knockGradeNow(s, d)
		local off = (knockOffset(s, d) or -1)
		A.push(s.knocks, Js.O({ grade = grade, man = A.indexOf(s.defenders, d), t = s.elapsed, off = off }, { "grade", "man", "t", "off" }))
		if (grade == "early") then
			if (d.phase == "telegraph") then
				d.commitSide = dir
			else
				d.readDir = dir
			end
			s.burst = Js.O({ dir = dir, t = 0, done = 0, power = KNOCK.earlyPower }, { "dir", "t", "done", "power" })
			s.burstLock = BURST_LOCK
			duelEvent(s, "Too early — he read it", "bad")
		elseif (grade == "late") then
			s.burst = Js.O({ dir = dir, t = 0, done = 0, power = 0.3 }, { "dir", "t", "done", "power" })
			s.burstLock = BURST_LOCK
			duelEvent(s, "Too late", "bad")
		else
			s.burst = Js.O({ dir = dir, t = 0, done = 0, power = 1, lat = KNOCK.lateral, dur = KNOCK.burstT }, { "dir", "t", "done", "power", "lat", "dur" })
			s.burstLock = KNOCK.lock
			s.surge = KNOCK.surgeT
			duelEvent(s, "Knocked it past him!", "good")
		end
		do return true end
	end
	knockSurgeBoost = function(s, sdt)
		if ((not Js.T(s.surge)) or (s.surge <= 0)) then
			do return 1 end
		end
		local k = (s.surge / KNOCK.surgeT)
		s.surge = Math.max(0, (s.surge - sdt))
		do return (1 + (lerp01(KNOCK.surgeLow, KNOCK.surgeHigh, ((if s.knockPace ~= nil then s.knockPace else 60) / 100)) * k)) end
	end
	START_Y = 48
	exports.START_Y = START_Y
	FIRST_DUEL_DEPTH = 16
	DUEL_GAP = 9
	CLEAR_Y = 12
	exports.CLEAR_Y = CLEAR_Y
	CORRIDOR_HALF = 9
	exports.CORRIDOR_HALF = CORRIDOR_HALF
	BASE_SPEED = 5.2
	exports.BASE_SPEED = BASE_SPEED
	PACE_SPEED = 2.2
	exports.PACE_SPEED = PACE_SPEED
	STEER_SPEED = 2
	exports.STEER_SPEED = STEER_SPEED
	BURST_T = 0.35
	exports.BURST_T = BURST_T
	BURST_LATERAL = 2.2
	exports.BURST_LATERAL = BURST_LATERAL
	BURST_BOOST = 1.25
	exports.BURST_BOOST = BURST_BOOST
	BURST_LOCK = 0.55
	exports.BURST_LOCK = BURST_LOCK
	ENGAGE_D = 12
	COMMIT_D_BASE = 5.2
	TELL_BASE = 0.3
	LUNGE_T = 0.22
	PRESS_STEPS = Js.alit(1, 0.72, 0.5, 0.32)
	PRESS_STEPS_BEFORE = Js.alit(1, 0.62, 0.4, 0.25)
	LUNGE_REACH = 1.1
	exports.LUNGE_REACH = LUNGE_REACH
	TELE_SLOW = 0.72
	exports.TELE_SLOW = TELE_SLOW
	CONTACT_D = 0.85
	exports.CONTACT_D = CONTACT_D
	CLEAR_SEP = 1.35
	exports.CLEAR_SEP = CLEAR_SEP
	SHOW_SIDE = 0.35
	RUN_TIMEOUT = 20
	exports.RUN_TIMEOUT = RUN_TIMEOUT
	STICK_LAT = 2.4
	exports.STICK_LAT = STICK_LAT
	STICK_WALK = 0.3
	exports.STICK_WALK = STICK_WALK
	STICK_JOG = 0.62
	exports.STICK_JOG = STICK_JOG
	STICK_SPRINT = 1.15
	exports.STICK_SPRINT = STICK_SPRINT
	STICK_UP_T = 0.28
	exports.STICK_UP_T = STICK_UP_T
	STICK_DOWN_T = 0.3
	exports.STICK_DOWN_T = STICK_DOWN_T
	STICK_BACK_ROOM = 3
	exports.STICK_BACK_ROOM = STICK_BACK_ROOM
	MATE_MIN_Y = 4
	MATE_SHIFT = 4.5
	PASS_EASY_BELOW = 0.33
	exports.PASS_EASY_BELOW = PASS_EASY_BELOW
	PASS_HARD_FROM = 0.6
	exports.PASS_HARD_FROM = PASS_HARD_FROM
	LIVELY_CAMERA = Js.O({ sideScale = 1, flipAt = 0.15, sideRate = 3, followRate = 5.5 }, { "sideScale", "flipAt", "sideRate", "followRate" })
	exports.LIVELY_CAMERA = LIVELY_CAMERA
	CALM_CAMERA = Js.O({ sideScale = 1, flipAt = 0.5, sideRate = 1.2, followRate = 3 }, { "sideScale", "flipAt", "sideRate", "followRate" })
	exports.CALM_CAMERA = CALM_CAMERA
	OWN_GAIT_M = 1.4
	exports.OWN_GAIT_M = OWN_GAIT_M
	CARRY = Js.O({ restFootX = 0.36, leadMin = 0.42, push = 0.34, burstExtra = 0.5 }, { "restFootX", "leadMin", "push", "burstExtra" })
	exports.CARRY = CARRY
	DUEL = Js.O({ engageD = 15, jockeyD = 6.4, give = 0.7, stabD = Js.alit(4.1, 4.9), patience = Js.alit(0.5, 1.2), showOff = 0.6, tell = Js.alit(0.23, 0.11), lungeT = 0.26, lungeIn = 3, lungeReach = 1.15, feint = Js.O({ shoulder = Js.O({ dur = 0.16, bite = 0.5, range = 6.8 }, { "dur", "bite", "range" }), stepover = Js.O({ dur = 0.32, bite = 0.64, range = 5.8 }, { "dur", "bite", "range" }) }, { "shoulder", "stepover" }), lean = 0.75, offBal = Js.alit(0.55, 0.3), scramble = 1.45, readTell = 0.85, heavy = 0.13, grace = Js.alit(0.05, 0.6), foulNear = 0.5, foulBeaten = 0.42, foulMiss = 0.45, foulWon = 0.42, recoverNear = 0.8, recover = 0.3 }, { "engageD", "jockeyD", "give", "stabD", "patience", "showOff", "tell", "lungeT", "lungeIn", "lungeReach", "feint", "lean", "offBal", "scramble", "readTell", "heavy", "grace", "foulNear", "foulBeaten", "foulMiss", "foulWon", "recoverNear", "recover" })
	exports.DUEL = DUEL
	leanFrom = Js.Map.new()
	sold = Js.Set.new()
	read = Js.Set.new()
	stepIn = Js.Set.new()
	COVER_DEPTH = 6.5
	WAVE_HOLD = 12
	KNOCK = Js.O({ winEasy = 0.3, winHard = 0.05, winCurve = 1.6, before = 0.7, burstT = 0.2, lateral = 2.5, coverPress = 0, earlyPower = 0.3, takerCross = 10, lock = 0.2, surgeLow = 0.1, surgeHigh = 0.35, surgeT = 0.55 }, { "winEasy", "winHard", "winCurve", "before", "burstT", "lateral", "coverPress", "earlyPower", "takerCross", "lock", "surgeLow", "surgeHigh", "surgeT" })
	exports.KNOCK = KNOCK
end
