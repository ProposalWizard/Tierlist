--!nocheck
--!nolint
-- Generated from roblox/twin/screens.twin.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_season = import("lib/star/season")
	local M__out = import("roblox/twin/_out")
	local M_screens = import("roblox/game/screens")
	local STEPS = Js.Number((if Js.process.env.TWIN_SCREEN_STEPS ~= nil then Js.process.env.TWIN_SCREEN_STEPS else 160))
	local rng = M_season.mulberry32(2026)
	Js.console.log(M__out.show(M_screens.setupScreen()))
	Js.console.log(M__out.show(M_screens.clubScreen("League Two")))
	local g = M_screens.startGame(Js.O({ firstName = "Robo", lastName = "Striker", nationality = "Wales", division = "League Two", club = "Bristol Rovers" }, { "firstName", "lastName", "nationality", "division", "club" }))
	local talked = 0
	for i = 0, math.ceil(STEPS) - 1 do
		local s = M_screens.screen(g)
		Js.console.log(("#" .. Js.numstr(i) .. " " .. M__out.show(s)))
		if ((s.id == "dashboard") and (math.fmod(i, 25) == 0)) then
			do
				local _arr1 = Js.alit("league", "fixtures", "stats")
				local _i2 = 0
				while _i2 < Js.alen(_arr1) do
					_i2 += 1
					local t = _arr1[_i2]
					g = M_screens.act(g, "tab", t, rng)
					Js.console.log(("#" .. Js.numstr(i) .. t .. " " .. M__out.show(M_screens.screen(g))))
				end
			end
			g = M_screens.act(g, "tab", "home", rng)
		end
		local b = (A.find(s.buttons, function(x)
			return (x.style == "primary")
		end) or s.buttons[1])
		if ((s.id == "contract-renewal") and A.some(s.buttons, function(x)
			return (x.action == "renewal-start")
		end)) then
			b = A.find(s.buttons, function(x)
				return (x.action == "renewal-start")
			end)
		end
		if ((s.id == "contract-renewal") and A.some(s.buttons, function(x)
			return (x.action == "renewal-guess")
		end)) then
			b = Js.O({ label = "", action = "renewal-guess", arg = (if Js.T(math.fmod(i, 2)) then "higher" else "lower") }, { "label", "action", "arg" })
		end
		if ((s.id == "season-transfer") and (talked < 1)) then
			local item = A.find(A.flatMap(s.blocks, function(x)
				return (if (x.kind == "list") then x.items else Js.alit())
			end), function(x)
				return (x.action == "window-talk")
			end)
			if item then
				talked += 1
				b = Js.O({ label = "", action = "window-talk", arg = item.arg }, { "label", "action", "arg" })
			end
		end
		if ((s.id == "transfer-request-talk") and A.some(s.buttons, function(x)
			return (x.action == "talk-offer")
		end)) then
			b = Js.O({ label = "", action = (if Js.T(math.fmod(i, 3)) then "talk-offer" else "talk-nudge"), arg = "-1" }, { "label", "action", "arg" })
		end
		if (s.id == "relegation-move") then
			local item = A.find(A.flatMap(s.blocks, function(x)
				return (if (x.kind == "list") then x.items else Js.alit())
			end), function(x)
				return x.action
			end)
			if item then
				b = Js.O({ label = "", action = item.action, arg = item.arg }, { "label", "action", "arg" })
			end
		end
		if (not b) then
			Js.console.log("no button")
			do break end
		end
		Js.console.log(("press " .. b.action .. " " .. (if b.arg ~= nil then b.arg else "")))
		g = M_screens.act(g, b.action, b.arg, rng)
	end
end
