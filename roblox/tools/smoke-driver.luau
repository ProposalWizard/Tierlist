-- Plays the server as a client would (smoke test only).
RUN_SERVER()
local remote = game:GetService("ReplicatedStorage")._children.Remotes._children.Career
local me = { UserId = 42, Name = "Tester" }
PLAYERS.PlayerAdded:Fire(me)

local function call(action, arg, form)
	local json = remote.OnServerInvoke(me, action, arg, form)
	local s = Js.JSON.parse(json)
	assert(type(s) == "table" and s.id, "not a screen: " .. tostring(json))
	if s.id == "error" then
		error("SERVER ERROR on " .. action .. ": " .. tostring(s.blocks[2].text))
	end
	return s
end

local s = call("get")
print("screen", s.id, s.title)
s = call("setup-clubs", nil, { firstName = "Smoke", lastName = "Test", nationality = "England", division = "League One" })
print("screen", s.id, s.title, Js.alen(s.blocks[1].items) .. " clubs")
local club = s.blocks[1].items[1].arg
s = call("start", club)
print("screen", s.id, s.title, s.hud.club, s.hud.league)

local counts = {}
for i = 1, PRESSES do
	local b
	for j = 1, Js.alen(s.buttons) do
		if s.buttons[j].style == "primary" then
			b = s.buttons[j]
			break
		end
	end
	b = b or s.buttons[1]
	if not b then
		-- a list to pick from (relegation move)
		for j = 1, Js.alen(s.blocks) do
			local bl = s.blocks[j]
			if bl.kind == "list" and bl.items[1] and bl.items[1].action then
				b = { action = bl.items[1].action, arg = bl.items[1].arg }
			end
		end
	end
	assert(b, "no button on " .. s.id)
	if s.id == "dashboard" and i % 30 == 0 then
		call("tab", "league")
		call("tab", "fixtures")
		call("tab", "stats")
		s = call("tab", "home")
	end
	s = call(b.action, b.arg)
	counts[s.id] = (counts[s.id] or 0) + 1
end
local seen = {}
for k, v in counts do
	table.insert(seen, k .. "×" .. v)
end
table.sort(seen)
print("screens seen:", table.concat(seen, ", "))
print("last screen", s.id, s.title, s.hud and s.hud.season, s.hud and s.hud.money)

-- leave (saves), rejoin (loads) and the screen must be the same
PLAYERS.PlayerRemoving:Fire(me)
print("saved", SAVED_BYTES, "bytes")
PLAYERS.PlayerAdded:Fire(me)
local again = call("get")
local a, b2 = Js.JSON.stringify(s), Js.JSON.stringify(again)
print(a == b2 and "rejoin: same screen" or ("rejoin: DIFFERENT\n" .. a .. "\n" .. b2))
print("internet calls tried:", HTTP_CALLS)
