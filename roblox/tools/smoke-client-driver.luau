-- Plays a whole match through the client script (roblox/src/Client/Match.luau)
-- as a robot with a mouse and keyboard, against the real server (smoke test only).
RUN_SERVER()
local rs = game:GetService("ReplicatedStorage")
local careerRemote = rs._children.Remotes._children.Career
local matchRemote = rs._children.Remotes._children.Match
local trialRemote = rs._children.Remotes._children.Trial
local me = { UserId = 42, Name = "Tester" }
ME = me
local clientPlayer = CLIENT_PLAYER(me)
PLAYERS.LocalPlayer = clientPlayer
local oldGet = game.GetService
game.GetService = function(self, n)
	if n == "Players" then
		return PLAYERS
	end
	return CLIENT_SERVICES[n] or oldGet(self, n)
end
PLAYERS.PlayerAdded:Fire(me)

local function call(action, arg, form)
	local json = careerRemote.OnServerInvoke(me, action, arg, form)
	local s = Js.JSON.parse(json)
	if s.id == "error" then
		error("SERVER ERROR on " .. action .. ": " .. tostring(s.blocks[2].text))
	end
	return s
end
local s = call("setup-clubs", nil, { firstName = "Client", lastName = "Robot", nationality = "England", division = DIVISION })
s = call("start", s.blocks[1].items[CLUB_PICK].arg)
print("screen", s.id, s.title)

local MatchClient = MATCH_CLIENT()
MATCH_MODULE = MatchClient
local UIS = CLIENT_SERVICES.UserInputService
local SCALE = 3

local function mouse(x, y, kind)
	return { UserInputType = kind or Enum.UserInputType.MouseButton1, Position = Vector2.new(x * SCALE, y * SCALE), KeyCode = Enum.KeyCode.Unknown }
end
local function key(k)
	return { UserInputType = Enum.UserInputType.Keyboard, Position = Vector2.new(0, 0), KeyCode = Enum.KeyCode[k] }
end

-- the trial, played through the client script
local function tapScreen(hud, x, y)
	hud.strike.InputBegan:Fire({ UserInputType = Enum.UserInputType.MouseButton1, Position = Vector2.new(x, y), KeyCode = Enum.KeyCode.Unknown })
end
if s.id == "trial" then
	local co = coroutine.create(function()
		return MatchClient.playTrial(trialRemote)
	end)
	task.wait = function()
		coroutine.yield()
	end
	local frames, pf, lastKey, lastPhase, chance = 0, 0, "", "", 0
	local result
	while true do
		local ok, r = coroutine.resume(co)
		if not ok then
			error("trial client crashed: " .. tostring(r))
		end
		if coroutine.status(co) == "dead" then
			result = r
			break
		end
		frames += 1
		assert(frames < 200000, "the trial never ended: stage " .. tostring(MatchClient.trial and MatchClient.trial.stage))
		local tp, hud, m = MatchClient.trial, MatchClient.hud, MatchClient.current
		if frames % 3000 == 1 then
			print("  dbg", frames, tp and tp.stage, tp and tp.card and tp.card.kind, m and m.phase, hud and hud.tapStart.Visible, tp and tp.clock)
		end
		if tp and hud then
			local stateKey = tostring(tp.stage) .. (tp.card and tp.card.kind or "") .. (m and m.phase or "")
			if stateKey ~= lastKey then
				lastKey = stateKey
				pf = 0
				if tp.card then
					print("  trial card", tp.card.kind, tostring(tp.card.label))
				end
			end
			pf += 1
			MOVE = Vector3.new(0, 0, 0)
			if hud.trialCardGo.Visible and pf == 20 then
				hud.trialCardGo.Activated:Fire()
			elseif hud.tapStart.Visible and pf == 20 then
				hud.tapStart.Activated:Fire()
			elseif m then
				if m.phase ~= lastPhase then
					if m.phase == "result" then
						print("  " .. tostring(tp.stage) .. " " .. tostring(m.sc.kind) .. " -> " .. tostring(m.outcome))
					end
					if m.phase == "aim" then
						chance += 1
					end
					lastPhase = m.phase
				end
				if m.phase == "aim" and pf == 25 then
					local b = m.sc.ball
					local gx, gy = (m.sc.goal.x1 + m.sc.goal.x2) / 2, 0
					local cones = tp.strike and tp.strike.gate
					if cones then
						gx, gy = cones.gate.centre.x, cones.gate.centre.y
					end
					local dx, dy = gx - b.x, gy - b.y
					local n = math.sqrt(dx * dx + dy * dy)
					local pull = (m.camera.x2 - m.camera.x1) * 0.18
					local down = mouse(b.x, b.y)
					UIS.InputBegan:Fire(down, false)
					UIS.InputChanged:Fire(mouse(b.x - dx / n * pull, b.y - dy / n * pull, Enum.UserInputType.MouseMovement))
					UIS.InputEnded:Fire(down)
				elseif m.phase == "contact" and hud.strike.Visible and pf == 15 then
					local c = hud.ball.AbsolutePosition + hud.ball.AbsoluteSize / 2
					tapScreen(hud, c.X, c.Y + hud.ball.AbsoluteSize.Y * 0.1)
				end
			elseif tp.dribble and tp.dribble.started then
				MOVE = Vector3.new(math.sin(pf / 40) * 0.8, 0, -1)
				if pf % 70 == 35 then
					UIS.InputBegan:Fire(key(pf % 140 == 35 and "Q" or "E"), false)
				end
			elseif tp.vision and tp.vision.phase == "live" and pf % 15 == 0 then
				local v = tp.vision
				local man = v.layout.men[v.setup.correct + 1]
				UIS.InputBegan:Fire(mouse(man.x, man.y), false)
			end
		end
		RENDER:Fire(1 / 60)
	end
	for _, r in ipairs(Match_back_results or {}) do
		print(r)
	end
	s = Js.JSON.parse(result)
	print(string.format("  trial done in %d frames -> %s (%s)", frames, s.id, s.title))
	for i = 1, Js.alen(s.blocks) do
		local b = s.blocks[i]
		if b.kind == "text" then
			print("   ", b.text)
		end
	end
	s = call("trial-sign")
	print("screen", s.id, s.title)
	s = call("trial-reward-done")
	print("career", s.hud.club, s.hud.league, s.id)
end

-- training: a level of each skill, played through the client script
local trainingRemote = rs._children.Remotes._children.Training
for _, skill in ipairs({ "power", "vision" }) do
	local co = coroutine.create(function()
		return MatchClient.playTraining(trainingRemote, skill .. ":1")
	end)
	task.wait = function()
		coroutine.yield()
	end
	local frames, pf, last, tryNo = 0, 0, "", 0
	local result
	while true do
		local ok, r = coroutine.resume(co)
		if not ok then
			error("training client crashed: " .. tostring(r))
		end
		if coroutine.status(co) == "dead" then
			result = r
			break
		end
		frames += 1
		assert(frames < 100000, "the training level never ended: " .. skill)
		local tp, hud, m = MatchClient.training, MatchClient.hud, MatchClient.current
		if tp and hud then
			local key = (m and m.phase or "none") .. tostring(tp.results and #tp.results)
			if key ~= last then
				last = key
				pf = 0
			end
			pf += 1
			MOVE = Vector3.new(0, 0, 0)
			if hud.tapStart.Visible and pf == 15 then
				hud.tapStart.Activated:Fire()
			elseif m then
				if m.phase == "aim" and pf % 90 == 25 then
					tryNo += 1
					local b = m.sc.ball
					local gx, gy = (m.sc.goal.x1 + m.sc.goal.x2) / 2 + (tryNo % 3 - 1) * 2, 0
					local g = tp.strike and tp.strike.setup and tp.strike.setup.gate
					if g then
						gx, gy = g.centre.x, g.centre.y
					end
					local dx, dy = gx - b.x, gy - b.y
					local n = math.sqrt(dx * dx + dy * dy)
					local pull = (m.camera.x2 - m.camera.x1) * 0.18
					local down = mouse(b.x, b.y)
					UIS.InputBegan:Fire(down, false)
					UIS.InputChanged:Fire(mouse(b.x - dx / n * pull, b.y - dy / n * pull, Enum.UserInputType.MouseMovement))
					UIS.InputEnded:Fire(down)
				elseif m.phase == "contact" and hud.strike.Visible and pf == 15 then
					local c = hud.ball.AbsolutePosition + hud.ball.AbsoluteSize / 2
					tapScreen(hud, c.X, c.Y + hud.ball.AbsoluteSize.Y * 0.1)
				end
			elseif tp.pace and tp.pace.started then
				MOVE = Vector3.new(math.sin(pf / 35) * 0.7, 0, -1)
				if pf % 50 == 20 then
					UIS.InputBegan:Fire(key(pf % 100 == 20 and "Q" or "E"), false)
				end
			elseif tp.vision and tp.vision.phase == "play" and pf % 20 == 0 then
				local v = tp.vision
				local pic = v.pics[math.min(v.tryIdx, Js.alen(v.pics) - 1) + 1]
				local man = pic.options[pic.best + 1]
				UIS.InputBegan:Fire(mouse(man.x, man.y), false)
			end
		end
		RENDER:Fire(1 / 60)
	end
	local after = Js.JSON.parse(result)
	print(string.format("  training %s level 1 in %d frames -> %s", skill, frames, tostring(after.blocks[1] and after.blocks[1].text)))
	s = after
end
-- relationship games, played through the client script
local relRemote = rs._children.Remotes._children.Relgame
for _, game in ipairs({ "signing", "woodwork" }) do
	local co = coroutine.create(function()
		return MatchClient.playRelGame(relRemote, game)
	end)
	task.wait = function()
		coroutine.yield()
	end
	local frames, pf, last, shotNo = 0, 0, "", 0
	local result
	while true do
		local ok, r = coroutine.resume(co)
		if not ok then
			error("relationship game client crashed: " .. tostring(r))
		end
		if coroutine.status(co) == "dead" then
			result = r
			break
		end
		frames += 1
		assert(frames < 60000, "the relationship game never ended: " .. game)
		local rp, hud, m = MatchClient.rel, MatchClient.hud, MatchClient.current
		if rp and hud then
			local k = (m and m.phase or "none") .. tostring(rp.shot)
			if k ~= last then
				last = k
				pf = 0
			end
			pf += 1
			if hud.tapStart.Visible and pf == 10 then
				hud.tapStart.Activated:Fire()
			elseif m and m.phase == "aim" and pf % 90 == 25 then
				shotNo += 1
				local b = m.sc.ball
				local tx = shotNo % 2 == 1 and 30.5 or 37.5
				local dx, dy = tx - b.x, -b.y
				local n = math.sqrt(dx * dx + dy * dy)
				local pull = (m.camera.x2 - m.camera.x1) * 0.16
				local down = mouse(b.x, b.y)
				UIS.InputBegan:Fire(down, false)
				UIS.InputChanged:Fire(mouse(b.x - dx / n * pull, b.y - dy / n * pull, Enum.UserInputType.MouseMovement))
				UIS.InputEnded:Fire(down)
			elseif m and m.phase == "contact" and hud.strike.Visible and pf == 15 then
				local c = hud.ball.AbsolutePosition + hud.ball.AbsoluteSize / 2
				tapScreen(hud, c.X, c.Y + hud.ball.AbsoluteSize.Y * 0.2)
			elseif game == "signing" and rp.fan and frames % 25 == 0 and hud.signing.Visible then
				local want = rp.fan.want[rp.fan.got + 1]
				for i = 1, 4 do
					if rp.order[i] == want then
						hud.signBtns[i].Activated:Fire()
					end
				end
			end
		end
		RENDER:Fire(1 / 60)
	end
	if result == nil then
		print("  " .. game .. ": refused (as it should be when there is no energy or day left)")
		s = call("get")
	else
		local after = Js.JSON.parse(result)
		print(string.format("  %s in %d frames -> %s", game, frames, tostring(after.blocks[1] and after.blocks[1].text)))
		s = after
	end
end
s = call("tab", "home")

local played = 0
local presses = 0
while played < MATCHES and presses < 300 do
	presses += 1
	local play = nil
	for j = 1, Js.alen(s.buttons) do
		if s.buttons[j].action == "play-match" then
			play = s.buttons[j]
		end
	end
	if not play then
		local b
		for j = 1, Js.alen(s.buttons) do
			if s.buttons[j].style == "primary" then
				b = s.buttons[j]
				break
			end
		end
		b = b or s.buttons[1]
		s = call(b.action, b.arg)
		continue
	end
	played += 1
	print(string.format("match %d (%s)", played, s.blocks[3] and s.blocks[3].text or "?"))
	local co = coroutine.create(function()
		return MatchClient.play(matchRemote)
	end)
	task.wait = function()
		coroutine.yield()
	end
	local frames, lastPhase, pf, chance = 0, "", 0, 0
	local result
	while true do
		local ok, r = coroutine.resume(co)
		if not ok then
			error("client crashed: " .. tostring(r))
		end
		if coroutine.status(co) == "dead" then
			result = r
			break
		end
		frames += 1
		if frames >= 300000 then
			local m = MatchClient.current
			error(string.format("the match never ended: phase %s, minute %s, %d frames in that phase, pause %s, strike %s, sc %s, runup %s, powerStrike %s",
				tostring(m and m.phase), tostring(m and m.minute), pf, tostring(m and m.pause and m.pause.cta), tostring(MatchClient.hud and MatchClient.hud.strike.Visible),
				tostring(m and m.sc and m.sc.kind), tostring(m and m.runup ~= nil), tostring(m and m.powerStrike)))
		end
		local m, hud = MatchClient.current, MatchClient.hud
		if m and hud then
			if m.phase ~= lastPhase then
				if lastPhase == "flight" or lastPhase == "tdDribble" then
					print(string.format("  c%d %d' %s %s -> %s %s %d-%d", chance, m.minute, m.sc and m.sc.kind or "-", lastPhase, m.phase, tostring(m.outcome or "-"), m.userScore, m.oppScore))
				end
				if m.phase == "aim" or m.phase == "tdDribble" then
					chance += 1
				end
				lastPhase = m.phase
				pf = 0
				MOVE = Vector3.new(0, 0, 0)
			end
			pf += 1
			if hud.final.Visible then
				hud.finalGo.Activated:Fire()
			elseif hud.pause.Visible then
				if hud.kib.Visible then
					hud.kib.Activated:Fire()
				end
				print("  pause: " .. hud.pauseGo.Text)
				hud.pauseGo.Activated:Fire()
			elseif m.phase == "feed" and pf == 30 then
				hud.modes.high.Activated:Fire()
				hud.speed.Activated:Fire()
				hud.speed.Activated:Fire()
			elseif m.phase == "aim" and pf % 90 == 20 then
				if pf > 20 then print("  retry aim", tostring(m.sc.kind), pf) end
				local b = m.sc.ball
				local gx = (m.sc.goal.x1 + m.sc.goal.x2) / 2 + ((chance * 37) % 7 - 3) * 0.6
				local dx, dy = gx - b.x, -b.y
				local n = math.sqrt(dx * dx + dy * dy)
				local pull = (m.camera.x2 - m.camera.x1) * (0.12 + (chance % 4) * 0.04)
				if chance % 5 == 3 and hud.power.Visible then
					hud.power.Activated:Fire()
				end
				local down = mouse(b.x, b.y)
				UIS.InputBegan:Fire(down, false)
				UIS.InputChanged:Fire(mouse(b.x - dx / n * pull, b.y - dy / n * pull, Enum.UserInputType.MouseMovement))
				UIS.InputEnded:Fire(down)
			elseif m.phase == "contact" and hud.strike.Visible and pf == 15 then
				local c = hud.ball.AbsolutePosition + hud.ball.AbsoluteSize / 2
				local r = hud.ball.AbsoluteSize.X / 2
				local spot = hud.spot.Visible and hud.spot or nil
				local ox, oy = ((chance * 13) % 5 - 2) * 0.22, ((chance * 7) % 5 - 2) * 0.22
				hud.strike.InputBegan:Fire({ UserInputType = Enum.UserInputType.MouseButton1, Position = Vector2.new(c.X + ox * r, c.Y + oy * r), KeyCode = Enum.KeyCode.Unknown })
			elseif m.phase == "contact" and hud.strike.Visible and pf == 70 then
				-- the power shot's green circle shows late: tap the middle
				local c = hud.ball.AbsolutePosition + hud.ball.AbsoluteSize / 2
				hud.strike.InputBegan:Fire({ UserInputType = Enum.UserInputType.MouseButton1, Position = Vector2.new(c.X, c.Y), KeyCode = Enum.KeyCode.Unknown })
			elseif m.phase == "runup" and pf == 4 then
				local b = m.sc.ball
				local down = mouse(b.x, b.y + 3)
				UIS.InputBegan:Fire(down, false)
				UIS.InputChanged:Fire(mouse(b.x + 1.5, b.y + 3, Enum.UserInputType.MouseMovement))
				UIS.InputEnded:Fire(down)
			elseif m.phase == "flight" then
				if hud.sprint.Visible or (m.playOn and m.playOn.stick) then
					MOVE = Vector3.new(((pf // 30) % 3 - 1) * 0.6, 0, -1)
					if pf == 2 then
						UIS.InputBegan:Fire(key("LeftShift"), false)
					end
				end
			elseif m.phase == "tdDribble" then
				MOVE = Vector3.new(((pf // 20) % 3 - 1) * 0.5, 0, -1)
				if pf % 90 == 45 then
					UIS.InputBegan:Fire(key(pf % 180 == 45 and "Q" or "E"), false)
				end
			end
		end
		local before = MatchClient.current and MatchClient.current.phase
		local t0 = os.clock()
		RENDER:Fire(1 / 60)
		local ms = (os.clock() - t0) * 1000
		if ms > 40 then
			local mm = MatchClient.current
			print(string.format("  SLOW %.0f ms: %s -> %s, minute %s, kind %s", ms, tostring(before), tostring(mm and mm.phase), tostring(mm and mm.minute), tostring(mm and mm.sc and mm.sc.kind)))
		end
		FRAME_MS = FRAME_MS or {}
		table.insert(FRAME_MS, ms)
	end
	local after = Js.JSON.parse(result)
	print(string.format("  back to %s (%s) after %d frames; parts made %d, moved %d", after.id, after.title, frames, PARTS or 0, MOVED or 0))
	s = after
	if s.id == "error" then
		error("server refused: " .. tostring(s.blocks[2].text))
	end
end
print("matches played on the client:", played)
if FRAME_MS and #FRAME_MS > 0 then
	table.sort(FRAME_MS)
	local sum = 0
	for _, v in ipairs(FRAME_MS) do
		sum += v
	end
	local function pct(p)
		return FRAME_MS[math.max(1, math.floor(#FRAME_MS * p))]
	end
	print(string.format("frame time (ms): mean %.2f, median %.2f, 99%% %.2f, 99.9%% %.2f, worst %.2f over %d frames",
		sum / #FRAME_MS, pct(0.5), pct(0.99), pct(0.999), FRAME_MS[#FRAME_MS], #FRAME_MS))
end
