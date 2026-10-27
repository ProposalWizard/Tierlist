--!nocheck
--!nolint
-- Generated from lib/star/story.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_shopData = import("lib/star/shopData")
	local M_money = import("lib/star/money")
	local TRAINING_DAY, ORDER, isStory, games, trainingDayLeft, trainingDayOn, due, seenBeat, storyBeat, OPENS, ackBeat, recordTrainingDayDrill, firstCanDealPrice, STORY_BOOT_GAMES, storyBoots, beatText, teamMateName, storyLockHint, agentHello
	isStory = function(c)
		do return (not (not (function() local _v = c.unlocks; if _v == nil then return nil end; _v = _v.story; return _v end)())) end
	end
	exports.isStory = isStory
	games = function(c)
		do return Math.max(((function() local _v = c.careerStats; if _v == nil then return nil end; _v = _v.appearances; return _v end)() or 0), Js.alen(A.filter((if c.fixtures ~= nil then c.fixtures else Js.alit()), function(f)
			return f.played
		end))) end
	end
	trainingDayLeft = function(c)
		if (not isStory(c)) then
			do return Js.alit() end
		end
		local done = (if c.unlocks.trainingDay ~= nil then c.unlocks.trainingDay else Js.alit())
		do return A.filter(TRAINING_DAY, function(s)
			return (not A.includes(done, s))
		end) end
	end
	exports.trainingDayLeft = trainingDayLeft
	trainingDayOn = function(c)
		do return ((isStory(c) and A.includes(c.unlocks.open, "training")) and (Js.alen(trainingDayLeft(c)) > 0)) end
	end
	exports.trainingDayOn = trainingDayOn
	due = function(c, b, stars)
		local n = games(c)
		local _sw1 = b
		if _sw1 == "boots" then
			do return (n == 0) end
		elseif _sw1 == "boss" then
			do return ((n >= 1) and (not A.includes(c.achievements, "boss-meeting"))) end
		elseif _sw1 == "training" then
			do return (n >= 1) end
		elseif _sw1 == "candeal" then
			do return (seenBeat(c, "training") and (Js.alen(trainingDayLeft(c)) == 0)) end
		elseif _sw1 == "ready" then
			do return ((seenBeat(c, "training") and (Js.alen(trainingDayLeft(c)) == 0)) and (n < 2)) end
		elseif _sw1 == "starpass" then
			do return ((stars >= 2) and (n >= 1)) end
		elseif _sw1 == "can" then
			do return (n >= 2) end
		elseif _sw1 == "phone" then
			do return (n >= 2) end
		elseif _sw1 == "shop" then
			do return (n >= 3) end
		elseif _sw1 == "stats" then
			do return (((function() local _v = c.careerStats; if _v == nil then return nil end; _v = _v.goals; return _v end)() or 0) >= 1) end
		elseif _sw1 == "sponsor" then
			do return (seenBeat(c, "phone") and ((((function() local _v = c.brands; if _v == nil then return nil end; _v = _v.offers; _v = Js.len(_v); return _v end)() or 0) > 0) or (((function() local _v = c.brands; if _v == nil then return nil end; _v = _v.deals; _v = Js.len(_v); return _v end)() or 0) > 0))) end
		end
	end
	seenBeat = function(c, b)
		do return (not (not (function() local _r = (function() local _v = c.unlocks; if _v == nil then return nil end; _v = _v.seen; return _v end)(); if _r == nil then return nil end; return A.includes(_r, ("beat-" .. b)) end)())) end
	end
	exports.seenBeat = seenBeat
	storyBeat = function(c, stars)
		if (not isStory(c)) then
			do return nil end
		end
		do
			local _arr2 = ORDER
			local _i3 = 0
			while _i3 < Js.alen(_arr2) do
				_i3 += 1
				local b = _arr2[_i3]
				if ((not seenBeat(c, b)) and due(c, b, stars)) then
					do return b end
				end
			end
		end
		do return nil end
	end
	exports.storyBeat = storyBeat
	ackBeat = function(c, b)
		if (not c.unlocks) then
			do return c end
		end
		local opens = (if OPENS[b] ~= nil then OPENS[b] else Js.alit())
		local u = Js.ospread(c.unlocks, Js.O({ seen = Js.aspread(A.filter(c.unlocks.seen, function(k)
			return (k ~= ("beat-" .. b))
		end), Js.alit(("beat-" .. b)), (if (b == "phone") then Js.alit("phone-tour", "help-phone") else Js.alit()), (if (b == "stats") then Js.alit("help-stats") else Js.alit())), open = Js.aspread(c.unlocks.open, A.filter(opens, function(f)
			return (not A.includes(c.unlocks.open, f))
		end)) }, { "seen", "open" }))
		local out = Js.ospread(c, Js.O({ unlocks = u }, { "unlocks" }))
		if (b == "boots") then
			out = Js.ospread(out, Js.O({ currentBoot = storyBoots() }, { "currentBoot" }))
		end
		if (b == "candeal") then
			local price = Math.min(math.floor(out.money), firstCanDealPrice(out))
			out = Js.ospread(out, Js.O({ money = (out.money - price), kibCans = Js.ospread(out.kibCans, Js.O({ basic = (((function() local _v = out.kibCans; if _v == nil then return nil end; _v = _v.basic; return _v end)() or 0) + 1) }, { "basic" })) }, { "money", "kibCans" }))
		end
		if (b == "can") then
			out = Js.ospread(out, Js.O({ kibCans = Js.ospread(out.kibCans, Js.O({ basic = (((function() local _v = out.kibCans; if _v == nil then return nil end; _v = _v.basic; return _v end)() or 0) + 1) }, { "basic" })) }, { "kibCans" }))
		end
		if ((b == "phone") and (not A.includes(out.achievements, "buy-phone"))) then
			out = Js.ospread(out, Js.O({ achievements = Js.aspread(out.achievements, Js.alit("buy-phone")) }, { "achievements" }))
		end
		do return out end
	end
	exports.ackBeat = ackBeat
	recordTrainingDayDrill = function(c, skill)
		if ((not trainingDayOn(c)) or (not A.includes(TRAINING_DAY, skill))) then
			do return c end
		end
		local done = (if c.unlocks.trainingDay ~= nil then c.unlocks.trainingDay else Js.alit())
		if A.includes(done, skill) then
			do return c end
		end
		do return Js.ospread(c, Js.O({ unlocks = Js.ospread(c.unlocks, Js.O({ trainingDay = Js.aspread(done, Js.alit(skill)) }, { "trainingDay" })) }, { "unlocks" })) end
	end
	exports.recordTrainingDayDrill = recordTrainingDayDrill
	firstCanDealPrice = function(c)
		do return Math.max(1, Math.round((M_shopData.kibCanPrice(M_shopData.KIB_CANS[1], c.contract.wage) / 2))) end
	end
	exports.firstCanDealPrice = firstCanDealPrice
	storyBoots = function()
		do return Js.ospread(M_shopData.BOOTS_CATALOGUE[1], Js.O({ matches = STORY_BOOT_GAMES }, { "matches" })) end
	end
	exports.storyBoots = storyBoots
	beatText = function(c, b)
		local gaffer = (if Js.T((function() local _v = c.manager; if _v == nil then return nil end; _v = _v.name; return _v end)()) then ("The gaffer, " .. c.manager.name) else "The gaffer")
		local mate = teamMateName(c)
		local _sw4 = b
		local _ci5 = (if _sw4 == "boots" then 1 elseif _sw4 == "boss" then 2 elseif _sw4 == "training" then 3 elseif _sw4 == "candeal" then 4 elseif _sw4 == "ready" then 5 elseif _sw4 == "starpass" then 6 elseif _sw4 == "can" then 7 elseif _sw4 == "phone" then 8 elseif _sw4 == "shop" then 9 elseif _sw4 == "stats" then 10 elseif _sw4 == "sponsor" then 11 else 0)
		local _cont6 = false
		repeat
			if _ci5 ~= 0 and _ci5 <= 1 then
				do
					local b = storyBoots()
					local stats = A.filter(Js.alit((if Js.T(b.power) then ("Power +" .. Js.numstr(b.power)) else ""), (if Js.T(b.technique) then ("Technique +" .. Js.numstr(b.technique)) else "")), Js.Boolean)
					do return Js.O({ who = mate, icon = "👟", title = "Have my old boots", line = ("Your first game's coming up. Take my old boots. They've got " .. Js.numstr(STORY_BOOT_GAMES) .. " games left in them."), button = "Thanks!", boot = Js.O({ name = b.name, pic = ("/star/shop2d/items/boot-" .. (if b.baseId ~= nil then b.baseId else b.id) .. "-L" .. Js.numstr((if b.level ~= nil then b.level else 1)) .. ".webp"), stats = stats, games = STORY_BOOT_GAMES }, { "name", "pic", "stats", "games" }) }, { "who", "icon", "title", "line", "button", "boot" }) end
				end
			end
			if _ci5 ~= 0 and _ci5 <= 2 then
				do return Js.O({ who = gaffer, icon = "🧢", title = "Come and see me", line = "Good first game, son. Come to my office, I want a word.", button = "Go to his office" }, { "who", "icon", "title", "line", "button" }) end
			end
			if _ci5 ~= 0 and _ci5 <= 3 then
				do return Js.O({ who = gaffer, icon = "🧢", title = "Time to train", line = "Training's open. Do two drills for me now, Power and Technique, so I can see what you've got.", button = "Go to training" }, { "who", "icon", "title", "line", "button" }) end
			end
			if _ci5 ~= 0 and _ci5 <= 4 then
				do return Js.O({ who = "The club shop", icon = "🥫", title = "Half price for you", line = "Training's tiring. Your first KIB can is half price today. A KIB can tops your energy up.", button = ("Buy it for ★" .. M_money.formatMoney(firstCanDealPrice(c))) }, { "who", "icon", "title", "line", "button" }) end
			end
			if _ci5 ~= 0 and _ci5 <= 5 then
				do return Js.O({ who = gaffer, icon = "🧢", title = "You're ready", line = "Great work. You're ready for the next game.", button = "Play" }, { "who", "icon", "title", "line", "button" }) end
			end
			if _ci5 ~= 0 and _ci5 <= 6 then
				do return Js.O({ who = "Star Pass", icon = "⭐", title = "You levelled up", line = "", button = "Take a look" }, { "who", "icon", "title", "line", "button" }) end
			end
			if _ci5 ~= 0 and _ci5 <= 7 then
				do return Js.O({ who = "The physio", icon = "🩺", title = "Your energy's low", line = "Your energy is low. Here's a free KIB can. Drink it.", button = "Use the can" }, { "who", "icon", "title", "line", "button" }) end
			end
			if _ci5 ~= 0 and _ci5 <= 8 then
				do return Js.O({ who = mate, icon = "📱", title = "Have my old phone", line = (c.player.firstName .. ", I've just bought a new phone. Here, take my old one."), button = "Thanks!" }, { "who", "icon", "title", "line", "button" }) end
			end
			if _ci5 ~= 0 and _ci5 <= 9 then
				do return Js.O({ who = "The chairman", icon = "💷", title = "Wages are in", line = "Wages are in. The lads are off to the shop. Tag along with them.", button = "Tag along" }, { "who", "icon", "title", "line", "button" }) end
			end
			if _ci5 ~= 0 and _ci5 <= 10 then
				do return Js.O({ who = gaffer, icon = "⚽", title = "Your first goal", line = "Your first goal is on your card. Your stats, records and achievements are open now.", button = "Got it" }, { "who", "icon", "title", "line", "button" }) end
			end
			if _ci5 ~= 0 and _ci5 <= 11 then
				do
					local brand = ((function() local _v = c.brands; if _v == nil then return nil end; _v = _v.offers; _v = _v[1]; if _v == nil then return nil end; _v = _v.brand; return _v end)() or "A brand")
					do return Js.O({ who = "Your agent", icon = "💼", title = "A brand wants you", line = (brand .. " want to sponsor you. I've sent you the offer. It's in your messages."), button = "Open the phone" }, { "who", "icon", "title", "line", "button" }) end
				end
			end
		until true
	end
	exports.beatText = beatText
	teamMateName = function(c)
		local me = (c.player.firstName .. " " .. c.player.lastName)
		local mates = A.filter((if c.squad ~= nil then c.squad else Js.alit()), function(p)
			return (p.name ~= me)
		end)
		local m = (if Js.T(Js.alen(mates)) then mates[math.fmod(3, Js.alen(mates)) + 1] else nil)
		do return (if m then ((if Js.T(m.shortName) then m.shortName else m.name) .. ", your team-mate") else "A team-mate") end
	end
	storyLockHint = function(c, f)
		if (not isStory(c)) then
			do return nil end
		end
		local hints = Js.O({ training = "After your first game", phone = "After your second game", relations = "After your second game", shop = "After your third game", stats = "Score your first goal", achievements = "Score your first goal" }, { "training", "phone", "relations", "shop", "stats", "achievements" })
		do return (if hints[f] ~= nil then hints[f] else nil) end
	end
	exports.storyLockHint = storyLockHint
	agentHello = function(c)
		if ((not isStory(c)) or (not A.includes(c.unlocks.open, "phone"))) then
			do return nil end
		end
		do return (c.player.firstName .. ", I'm your agent. I look after your contract and your sponsors. Keep playing well and the offers will come.") end
	end
	exports.agentHello = agentHello
	TRAINING_DAY = Js.alit("power", "technique")
	exports.TRAINING_DAY = TRAINING_DAY
	ORDER = Js.alit("boots", "training", "candeal", "starpass", "can", "phone", "shop", "stats", "sponsor")
	OPENS = Js.O({ training = Js.alit("training"), phone = Js.alit("phone", "relations"), shop = Js.alit("shop"), stats = Js.alit("stats", "achievements"), sponsor = Js.alit("sponsors") }, { "training", "phone", "shop", "stats", "sponsor" })
	STORY_BOOT_GAMES = 5
	exports.STORY_BOOT_GAMES = STORY_BOOT_GAMES
end
