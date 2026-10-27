-- Plays a whole match through the client script (roblox/src/Client/Match.luau)
-- as a robot with a mouse and keyboard, against the real server (smoke test only).
RUN_SERVER()
local rs = game:GetService("ReplicatedStorage")
local careerRemote = rs._children.Remotes._children.Career
local matchRemote = rs._children.Remotes._children.Match
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
print("career", s.hud.club, s.hud.league)

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
		assert(frames < 300000, "the match never ended")
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
			elseif m.phase == "aim" and pf == 20 then
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
		RENDER:Fire(1 / 60)
	end
	local after = Js.JSON.parse(result)
	print(string.format("  back to %s (%s) after %d frames; parts made %d, moved %d", after.id, after.title, frames, PARTS or 0, MOVED or 0))
	s = after
	if s.id == "error" then
		error("server refused: " .. tostring(s.blocks[2].text))
	end
end
print("matches played on the client:", played)
