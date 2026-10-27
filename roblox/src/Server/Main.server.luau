--[[
  The Road to Ballon d'Or server.

  Each player's career lives here, runs on the website's own code (converted,
  in ReplicatedStorage.Game) and is saved to a DataStore. The client only
  draws screens: it calls Remotes.Career with a button's action and gets back
  the next screen, as JSON (roblox/game/screens.ts decides both).

  Needs, in Game Settings → Security: "Allow HTTP Requests" (real squads from
  knowitball.co.uk) and "Enable Studio Access to API Services" (saving, in
  Studio). Without them the game still plays: invented players, no saving.
]]

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local HttpService = game:GetService("HttpService")
local DataStoreService = game:GetService("DataStoreService")
local RunService = game:GetService("RunService")

local Loader = require(ReplicatedStorage:WaitForChild("Runtime"):WaitForChild("Loader"))
local Js = Loader.Js
local Screens = Loader.import("roblox/game/screens")
local Flow = Loader.import("roblox/game/flow")
local Match = Loader.import("roblox/game/match")
local TrialFlow = Loader.import("roblox/game/trialFlow")
local TrainingFlow = Loader.import("roblox/game/trainingFlow")
local LifeFlow = Loader.import("roblox/game/lifeFlow")

local SAVE_VERSION = 1
-- A DataStore key holds at most 4 MB (counted after Roblox escapes the text),
-- so a long career is split over several keys of 3 MB.
local CHUNK = 3000000
local MAX_CHUNKS = 8

-- ───────────────────────────────────────────── the website's internet calls ──
-- The converted code calls fetch("/api/..."); Js.fetch adds knowitball.co.uk.
Js.fetchImpl = function(url, init)
	local headers = {}
	if init and init.headers then
		for k, v in pairs(init.headers) do
			if type(k) == "string" then
				headers[k] = tostring(v)
			end
		end
	end
	local res = HttpService:RequestAsync({
		Url = url,
		Method = (init and init.method) or "GET",
		Headers = headers,
		Body = init and init.body or nil,
	})
	local body = res.Body
	return Js.O({
		ok = res.Success,
		status = res.StatusCode,
		json = function()
			return Js.Promise.resolve(Js.JSON.parse(body))
		end,
		text = function()
			return Js.Promise.resolve(body)
		end,
	}, { "ok", "status", "json", "text" })
end

-- ──────────────────────────────────────────────────────────────── saving ──
local store
do
	local ok, s = pcall(function()
		return DataStoreService:GetDataStore("RoadToBallonDor")
	end)
	store = ok and s or nil
end

local games = {} -- [Player] = RobloxGame
local drafts = {} -- [Player] = the new-career form
local dirty = {} -- [Player] = true when unsaved changes
local busy = {} -- [Player] = true while an action runs
local loaded = {} -- [Player] = true once the save has been read
local pendingMatch = {} -- [Player] = the match being played on the device

local function keyFor(player)
	return "career_" .. player.UserId
end

local function save(player)
	if not store or not dirty[player] then
		return
	end
	local g = games[player]
	local text = nil
	if g then
		-- the website's save form: thin squads, star rating banked (flow.ts forSave)
		local ok, json = pcall(function()
			return Js.JSON.stringify(Flow.forSave(g))
		end)
		if not ok then
			warn("save: could not write the career:", json)
			return
		end
		text = json
	end
	local parts = text and math.max(1, math.ceil(#text / CHUNK)) or 0
	if parts > MAX_CHUNKS then
		warn(("save: career is %d bytes, too big to save"):format(#text))
		return
	end
	local ok, err = pcall(function()
		for i = 2, parts do
			store:SetAsync(keyFor(player) .. "_p" .. i, string.sub(text, (i - 1) * CHUNK + 1, i * CHUNK), { player.UserId })
		end
		store:SetAsync(keyFor(player), {
			v = SAVE_VERSION,
			parts = parts,
			game = text and string.sub(text, 1, CHUNK) or nil,
		}, { player.UserId })
	end)
	if ok then
		dirty[player] = nil
	else
		warn("save failed:", err)
	end
end

local function load(player)
	if not store then
		return nil
	end
	local ok, text = pcall(function()
		local head = store:GetAsync(keyFor(player))
		if type(head) ~= "table" or type(head.game) ~= "string" then
			return nil
		end
		local pieces = { head.game }
		for i = 2, (head.parts or 1) do
			local piece = store:GetAsync(keyFor(player) .. "_p" .. i)
			if type(piece) ~= "string" then
				error("a piece of the save is missing")
			end
			pieces[i] = piece
		end
		return table.concat(pieces)
	end)
	if not ok then
		warn("load failed:", text)
		return nil
	end
	if not text then
		return nil
	end
	local parsed, g = pcall(function()
		return Flow.fromSave(Js.JSON.parse(text))
	end)
	if not parsed then
		warn("load: could not read the saved career:", g)
		return nil
	end
	-- the other clubs' squads are filled back in, as on the website
	local fresh, withSquads = pcall(Flow.resumeSquads, g)
	if fresh and withSquads then
		withSquads.ui = g.ui
		g = withSquads
	else
		warn("load: squads not refreshed:", withSquads)
	end
	return g
end

-- ────────────────────────────────────────────────────────────── screens ──
local function errorScreen(message)
	return {
		id = "error",
		title = "Something went wrong",
		blocks = Js.alit(
			Js.O({ kind = "text", text = "The game hit an error. Your career is safe; press Continue to go back.", tone = "bad" }, { "kind", "text", "tone" }),
			Js.O({ kind = "text", text = tostring(message), tone = "dim" }, { "kind", "text", "tone" })
		),
		buttons = Js.alit(Js.O({ label = "Continue", action = "home", style = "primary" }, { "label", "action", "style" })),
	}
end

local function encode(screen)
	return Js.JSON.stringify(screen)
end

local function currentScreen(player)
	local g = games[player]
	if not g then
		local s = Screens.setupScreen()
		-- keep what was typed last time
		local d = drafts[player]
		if d then
			for i = 1, Js.alen(s.blocks) do
				local b = s.blocks[i]
				if b.id and d[b.id] then
					b.value = d[b.id]
				end
			end
		end
		return s
	end
	return Screens.screen(g)
end

local function handle(player, action, arg, form)
	-- the new-career screens (no game yet)
	if action == "setup-clubs" then
		drafts[player] = form or {}
		return Screens.clubScreen(drafts[player].division or "League Two")
	elseif action == "setup" then
		return currentScreen(player)
	elseif action == "start" then
		local d = drafts[player] or {}
		local g = Screens.startGame(Js.O({
			firstName = d.firstName or "",
			lastName = d.lastName or "",
			nationality = d.nationality or "England",
			division = d.division or "League Two",
			club = arg,
		}, { "firstName", "lastName", "nationality", "division", "club" }))
		-- a new career starts on its trial; the real players come at the signing
		games[player] = g
		dirty[player] = true
		save(player)
		return Screens.screen(g)
	elseif action == "new-career" then
		games[player] = nil
		dirty[player] = true
		save(player)
		return currentScreen(player)
	end

	local g = games[player]
	if not g then
		return currentScreen(player)
	end
	if action ~= "get" then
		pendingMatch[player] = nil
		local before = g
		local nextGame = Screens.act(g, action, arg)
		-- the trial's signing: the real players, as the website loads them then
		if action == "trial-sign" and before.phase == "manager-talk" and nextGame.phase ~= "manager-talk" then
			local ok, withReal = pcall(Flow.loadRealSquads, nextGame)
			if ok and withReal then
				withReal.ui = nextGame.ui
				nextGame = withReal
			else
				warn("real squads not loaded (is Allow HTTP Requests on?):", withReal)
			end
		end
		-- a move to a new club: its real dressing room
		if action == "sign" and nextGame.career.player.club ~= before.career.player.club then
			local ok, withSquad = pcall(Flow.loadNewClubSquad, nextGame)
			if ok and withSquad then
				withSquad.ui = nextGame.ui
				nextGame = withSquad
			end
		end
		games[player] = nextGame
		dirty[player] = true
		-- save at the big moments straight away; otherwise the timer below does
		if action == "end-season" or action == "sign" or action == "stay" or action == "retire" or action == "awards-continue" or action == "trial-sign" then
			save(player)
		end
	end
	return Screens.screen(games[player])
end

-- ────────────────────────────────────────────────────────────── remotes ──
local remotes = Instance.new("Folder")
remotes.Name = "Remotes"
remotes.Parent = ReplicatedStorage
local career = Instance.new("RemoteFunction")
career.Name = "Career"
career.Parent = remotes

career.OnServerInvoke = function(player, action, arg, form)
	if type(action) ~= "string" then
		return encode(errorScreen("no action"))
	end
	if arg ~= nil and type(arg) ~= "string" then
		arg = tostring(arg)
	end
	if form ~= nil and type(form) ~= "table" then
		form = nil
	end
	-- wait for the save to be read, then one action at a time per player
	local waited = 0
	while not loaded[player] and waited < 15 do
		task.wait(0.1)
		waited += 0.1
	end
	waited = 0
	while busy[player] and waited < 30 do
		task.wait(0.1)
		waited += 0.1
	end
	busy[player] = true
	local ok, screen = xpcall(handle, debug.traceback, player, action, arg, form)
	busy[player] = nil
	if not ok then
		warn("Career action '" .. action .. "' failed:", screen)
		return encode(errorScreen(screen))
	end
	return encode(screen)
end

-- The match is played on the device (roblox/src/Client/Match.luau): "start"
-- sends it the setup, "done" takes the stats back into the career, "abandon"
-- sims the match instead (the device could not play it).
local function matchAction(player, action, json)
	local g = games[player]
	if not g then
		error("no career")
	end
	if action == "start" then
		if g.phase ~= "dashboard" then
			error("there is no match to play now")
		end
		local day = Flow.matchday(g)
		if not day.canPlay then
			error("you are not playing this week")
		end
		local readied = Match.readyForMatch(g.career)
		local setup = Match.matchSetupFor(readied)
		if not setup then
			error("no fixture")
		end
		pendingMatch[player] = { readied = readied, fixture = setup.fixture, career = g.career }
		return Js.JSON.stringify(Match.deviceSetup(setup))
	end
	local p = pendingMatch[player]
	pendingMatch[player] = nil
	local nextGame
	if action == "done" and p and g.career == p.career then
		local ok, raw = pcall(Js.JSON.parse, json)
		local stats = ok and Match.checkedStats(raw) or nil
		if stats then
			nextGame = Flow.matchComplete(g, stats, p.readied, p.fixture)
		else
			warn("match: the result from the device was refused; simming it")
		end
	end
	if not nextGame then
		nextGame = Flow.simMatch(g)
	end
	nextGame.ui = g.ui
	games[player] = nextGame
	dirty[player] = true
	return encode(Screens.screen(nextGame))
end

local matchRemote = Instance.new("RemoteFunction")
matchRemote.Name = "Match"
matchRemote.Parent = remotes

matchRemote.OnServerInvoke = function(player, action, json)
	if type(action) ~= "string" or (json ~= nil and type(json) ~= "string") then
		return nil
	end
	local waited = 0
	while busy[player] and waited < 30 do
		task.wait(0.1)
		waited += 0.1
	end
	busy[player] = true
	local ok, res = xpcall(matchAction, debug.traceback, player, action, json)
	busy[player] = nil
	if not ok then
		warn("Match '" .. action .. "' failed:", res)
		if action == "start" then
			return nil
		end
		return encode(errorScreen(res))
	end
	return res
end

-- The trial is played on the device too (roblox/game/trialPlay.ts): "start"
-- sends the career, "done" takes the five results back (checked), "abandon"
-- leaves the trial to be started again.
local function trialAction(player, action, json)
	local g = games[player]
	if not g or g.phase ~= "trial" then
		error("there is no trial to play now")
	end
	if action == "start" then
		return Js.JSON.stringify(Match.matchCareer(g.career))
	end
	if action == "done" then
		local ok, back = pcall(Js.JSON.parse, json)
		local nextGame = ok and Screens.trialDone(g, back) or nil
		if nextGame then
			games[player] = nextGame
			dirty[player] = true
			save(player)
			return encode(Screens.screen(nextGame))
		end
		warn("trial: the results from the device were refused")
	end
	return encode(Screens.screen(g))
end

local trialRemote = Instance.new("RemoteFunction")
trialRemote.Name = "Trial"
trialRemote.Parent = remotes

trialRemote.OnServerInvoke = function(player, action, json)
	if type(action) ~= "string" or (json ~= nil and type(json) ~= "string") then
		return nil
	end
	local waited = 0
	while busy[player] and waited < 30 do
		task.wait(0.1)
		waited += 0.1
	end
	busy[player] = true
	local ok, res = xpcall(trialAction, debug.traceback, player, action, json)
	busy[player] = nil
	if not ok then
		warn("Trial '" .. action .. "' failed:", res)
		if action == "start" then
			return nil
		end
		return encode(errorScreen(res))
	end
	return res
end

-- Training is played on the device (roblox/game/trainingPlay.ts): "start"
-- checks the level may be played and sends it, "done" banks the stars.
local pendingTraining = {} -- [Player] = { skill, level, career }
local function trainingAction(player, action, arg)
	local g = games[player]
	if not g then
		error("no career")
	end
	if action == "start" then
		local skill, level = string.match(arg or "", "^(%a+):(%d+)$")
		level = tonumber(level)
		if not skill or not level or (g.phase ~= "dashboard" and g.phase ~= "youth") or not TrainingFlow.mayPlayLevel(g.career, skill, level) then
			error("that level cannot be played now")
		end
		pendingTraining[player] = { skill = skill, level = level, career = g.career }
		return Js.JSON.stringify(Js.O({
			career = Match.matchCareer(g.career),
			skill = skill,
			level = level,
			overlay = TrainingFlow.levelOverlay(),
		}, { "career", "skill", "level", "overlay" }))
	end
	local p = pendingTraining[player]
	pendingTraining[player] = nil
	if action == "done" and p and g.career == p.career then
		local ok, back = pcall(Js.JSON.parse, arg)
		local nextGame = ok and type(back) == "table" and Screens.trainingDone(g, p.skill, p.level, back.stars) or nil
		if nextGame then
			games[player] = nextGame
			dirty[player] = true
			return encode(Screens.screen(nextGame))
		end
		warn("training: the stars from the device were refused")
	end
	return encode(Screens.screen(g))
end

local trainingRemote = Instance.new("RemoteFunction")
trainingRemote.Name = "Training"
trainingRemote.Parent = remotes

trainingRemote.OnServerInvoke = function(player, action, arg)
	if type(action) ~= "string" or (arg ~= nil and type(arg) ~= "string") then
		return nil
	end
	local waited = 0
	while busy[player] and waited < 30 do
		task.wait(0.1)
		waited += 0.1
	end
	busy[player] = true
	local ok, res = xpcall(trainingAction, debug.traceback, player, action, arg)
	busy[player] = nil
	if not ok then
		warn("Training '" .. action .. "' failed:", res)
		if action == "start" then
			return nil
		end
		return encode(errorScreen(res))
	end
	return res
end

-- The relationship games that are played (roblox/game/relgamePlay.ts): "start"
-- checks the game may be played and sends the career, "done" takes the count.
local pendingRel = {} -- [Player] = { game, career }
local function relAction(player, action, arg)
	local g = games[player]
	if not g then
		error("no career")
	end
	if action == "start" then
		local kinds = { woodwork = "team", penalties = "boss", session = "boss", signing = "fans" }
		local kind = kinds[arg or ""]
		if not kind or g.phase ~= "dashboard" or not LifeFlow.relGame(g.career, kind).canPlay then
			error("that game cannot be played now")
		end
		pendingRel[player] = { game = arg, career = g.career }
		return Js.JSON.stringify(Js.O({ career = Match.matchCareer(g.career), game = arg }, { "career", "game" }))
	end
	local p = pendingRel[player]
	pendingRel[player] = nil
	if action == "done" and p and g.career == p.career then
		local ok, back = pcall(Js.JSON.parse, arg)
		local nextGame = ok and type(back) == "table" and Screens.relgameDone(g, p.game, back.count, math.random()) or nil
		if nextGame then
			games[player] = nextGame
			dirty[player] = true
			return encode(Screens.screen(nextGame))
		end
		warn("relationship game: the count from the device was refused")
	end
	return encode(Screens.screen(g))
end

local relRemote = Instance.new("RemoteFunction")
relRemote.Name = "Relgame"
relRemote.Parent = remotes

relRemote.OnServerInvoke = function(player, action, arg)
	if type(action) ~= "string" or (arg ~= nil and type(arg) ~= "string") then
		return nil
	end
	local waited = 0
	while busy[player] and waited < 30 do
		task.wait(0.1)
		waited += 0.1
	end
	busy[player] = true
	local ok, res = xpcall(relAction, debug.traceback, player, action, arg)
	busy[player] = nil
	if not ok then
		warn("Relgame '" .. action .. "' failed:", res)
		if action == "start" then
			return nil
		end
		return encode(errorScreen(res))
	end
	return res
end

-- the website's shared training levels (its level editor's saved rows)
task.spawn(function()
	local ok, err = pcall(TrainingFlow.fetchSharedTrainingLevels)
	if not ok then
		warn("training levels: using the built-in rows:", err)
	end
end)

-- ─────────────────────────────────────────────────────────── join / leave ──
local function onJoin(player)
	local g = load(player)
	if g then
		games[player] = g
	end
	loaded[player] = true
end
Players.PlayerAdded:Connect(onJoin)
for _, player in Players:GetPlayers() do
	task.spawn(onJoin, player)
end

Players.PlayerRemoving:Connect(function(player)
	save(player)
	games[player] = nil
	drafts[player] = nil
	dirty[player] = nil
	busy[player] = nil
	loaded[player] = nil
	pendingMatch[player] = nil
	pendingTraining[player] = nil
	pendingRel[player] = nil
end)

game:BindToClose(function()
	for _, player in Players:GetPlayers() do
		save(player)
	end
end)

task.spawn(function()
	while true do
		task.wait(45)
		for _, player in Players:GetPlayers() do
			if dirty[player] and not busy[player] then
				save(player)
			end
		end
	end
end)

if RunService:IsStudio() and not store then
	warn("Road to Ballon d'Or: saving is off (Game Settings → Security → Enable Studio Access to API Services).")
end
