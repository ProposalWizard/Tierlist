--!nocheck
--!nolint
-- Generated from lib/star/unlocks.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_story = import("lib/star/story")
	local M_shopData = import("lib/star/shopData")
	local gameFirst, SHOP_AFTER_GAMES, hasSponsorOffer, DRILLS_TO_UNLOCK, DRILLS_TO_OPEN_SHOP, drillsNeeded, UNLOCK_ACHIEVEMENTS, LOCK_HINT, FEATURE_INFO, freshUnlocks, lockHint, isOpen, gamesPlayed, inChain, hasSeen, withU, addTo, openFeatures, grant, markSeen, recordDrill, drillMessageDue, recordLeagueVisit, recordMatchPlayed, recordFirstMatch, managerTalkDue, recordBossMeeting, recordPhoneBought, pendingAnnouncements, markAnnounced, FIRST_STEPS, FIRST_STEPS_GAME_FIRST, stepsFor, phonePrice, phoneShortfall, phoneStepLine, stepDone, nextStep, firstStepsDone, bottomLeft, slotQuestionDue, setBottomLeft, styleUnlockStar, valueOf, styleLock, STARTER_APPS, APP_STORE, STORY_STARTER_APPS, NEW_PHONE_APPS, appInstalled, appIsNew, newAppCount, markAppOpened, installApp
	gameFirst = function(c)
		do return (not (not (function() local _v = c.unlocks; if _v == nil then return nil end; _v = _v.gameFirst; return _v end)())) end
	end
	exports.gameFirst = gameFirst
	hasSponsorOffer = function(c)
		do return ((((function() local _v = c.brands; if _v == nil then return nil end; _v = _v.offers; _v = Js.len(_v); return _v end)() or 0) > 0) or (((function() local _v = c.brands; if _v == nil then return nil end; _v = _v.deals; _v = Js.len(_v); return _v end)() or 0) > 0)) end
	end
	exports.hasSponsorOffer = hasSponsorOffer
	drillsNeeded = function(c)
		do return (if (function() local _v = c.unlocks; if _v == nil then return nil end; _v = _v.gameFirst; return _v end)() then DRILLS_TO_OPEN_SHOP else DRILLS_TO_UNLOCK) end
	end
	exports.drillsNeeded = drillsNeeded
	freshUnlocks = function(points)
		if points == nil then points = 0 end
		do return Js.O({ open = Js.alit("league", "play"), seen = Js.alit(), drills = 0, pointsAtStart = points, apps = Js.alit(), gameFirst = true, story = true, trainingDay = Js.alit() }, { "open", "seen", "drills", "pointsAtStart", "apps", "gameFirst", "story", "trainingDay" }) end
	end
	exports.freshUnlocks = freshUnlocks
	lockHint = function(c, f)
		do return (M_story.storyLockHint(c, f) or LOCK_HINT[f]) end
	end
	exports.lockHint = lockHint
	isOpen = function(c, f)
		if (not c.unlocks) then
			do return true end
		end
		if ((f == "training") and (not c.unlocks.gameFirst)) then
			do return true end
		end
		if ((((f == "shop") and c.unlocks.gameFirst) and (not c.unlocks.story)) and (c.unlocks.drills >= DRILLS_TO_OPEN_SHOP)) then
			do return true end
		end
		do return A.includes(c.unlocks.open, f) end
	end
	exports.isOpen = isOpen
	gamesPlayed = function(c)
		do return Math.max(((function() local _v = c.careerStats; if _v == nil then return nil end; _v = _v.appearances; return _v end)() or 0), Js.alen(A.filter((if c.fixtures ~= nil then c.fixtures else Js.alit()), function(f)
			return f.played
		end))) end
	end
	exports.gamesPlayed = gamesPlayed
	inChain = function(c)
		do return (not (not c.unlocks)) end
	end
	exports.inChain = inChain
	hasSeen = function(c, key)
		do return ((not c.unlocks) or A.includes(c.unlocks.seen, key)) end
	end
	exports.hasSeen = hasSeen
	withU = function(c, u)
		do return Js.ospread(c, Js.O({ unlocks = u }, { "unlocks" })) end
	end
	addTo = function(list, ...)
		local items = Js.alit(...)
		local out = Js.aspread(list)
		do
			local _arr1 = items
			local _i2 = 0
			while _i2 < Js.alen(_arr1) do
				_i2 += 1
				local i = _arr1[_i2]
				if (not A.includes(out, i)) then
					A.push(out, i)
				end
			end
		end
		do return out end
	end
	openFeatures = function(u, features, announce)
		if announce == nil then announce = Js.alit() end
		local fresh = A.filter(features, function(f)
			return (not A.includes(u.open, f))
		end)
		if (Js.alen(fresh) == 0) then
			do return u end
		end
		local queue = A.filter(fresh, function(f)
			return A.includes(announce, f)
		end)
		do return Js.ospread(u, Js.O({ open = addTo(Js.unpack(Js.aspread(Js.alit(u.open), fresh))) }, { "open" }), (if Js.T(Js.alen(queue)) then Js.O({ announce = addTo(Js.unpack(Js.aspread(Js.alit((if u.announce ~= nil then u.announce else Js.alit())), queue))) }, { "announce" }) else Js.O({}, nil))) end
	end
	grant = function(c, id)
		do return (if A.includes(c.achievements, id) then c.achievements else Js.aspread(c.achievements, Js.alit(id))) end
	end
	markSeen = function(c, key)
		if ((not c.unlocks) or A.includes(c.unlocks.seen, key)) then
			do return c end
		end
		do return withU(c, Js.ospread(c.unlocks, Js.O({ seen = addTo(c.unlocks.seen, key) }, { "seen" }))) end
	end
	exports.markSeen = markSeen
	recordDrill = function(c, pointsBefore, starsBefore)
		if (not c.unlocks) then
			do return c end
		end
		local drills = (c.unlocks.drills + 1)
		local pointsAtStart = (if ((c.unlocks.drills == 0) and (pointsBefore ~= nil)) then pointsBefore else c.unlocks.pointsAtStart)
		local starsAtStart = (if ((c.unlocks.drills == 0) and (starsBefore ~= nil)) then starsBefore else c.unlocks.starsAtStart)
		if c.unlocks.gameFirst then
			local u = Js.ospread(c.unlocks, Js.O({ drills = drills, pointsAtStart = pointsAtStart, starsAtStart = starsAtStart }, { "drills", "pointsAtStart", "starsAtStart" }))
			if ((drills >= DRILLS_TO_OPEN_SHOP) and (not u.story)) then
				u = openFeatures(u, Js.alit("shop"), Js.alit("shop"))
			end
			do return Js.ospread(withU(c, u), Js.O({ achievements = (if (drills >= DRILLS_TO_OPEN_SHOP) then grant(c, "first-two-sessions") else c.achievements) }, { "achievements" })) end
		end
		local open = (if (drills >= DRILLS_TO_UNLOCK) then addTo(c.unlocks.open, "league", "stats", "play") else c.unlocks.open)
		do return withU(c, Js.ospread(c.unlocks, Js.O({ drills = drills, open = open, pointsAtStart = pointsAtStart, starsAtStart = starsAtStart }, { "drills", "open", "pointsAtStart", "starsAtStart" }))) end
	end
	exports.recordDrill = recordDrill
	drillMessageDue = function(c)
		do return ((((not (not c.unlocks)) and (not c.unlocks.gameFirst)) and (c.unlocks.drills >= DRILLS_TO_UNLOCK)) and (not A.includes(c.unlocks.seen, "drills-msg"))) end
	end
	exports.drillMessageDue = drillMessageDue
	recordLeagueVisit = function(c)
		if ((((not c.unlocks) or c.unlocks.gameFirst) or (not isOpen(c, "league"))) or A.includes(c.unlocks.open, "achievements")) then
			do return c end
		end
		do return Js.ospread(withU(c, Js.ospread(c.unlocks, Js.O({ open = addTo(c.unlocks.open, "achievements") }, { "open" }))), Js.O({ achievements = grant(c, "first-two-sessions") }, { "achievements" })) end
	end
	exports.recordLeagueVisit = recordLeagueVisit
	recordMatchPlayed = function(c)
		if (not c.unlocks) then
			do return c end
		end
		local games = gamesPlayed(c)
		local u = c.unlocks
		if u.story then
		elseif u.gameFirst then
			if (games >= 1) then
				u = openFeatures(u, Js.alit("training", "achievements"), Js.alit("training", "achievements"))
			end
			if ((games >= SHOP_AFTER_GAMES) or (u.drills >= DRILLS_TO_OPEN_SHOP)) then
				u = openFeatures(u, Js.alit("shop"), Js.alit("shop"))
			end
		elseif ((games >= 1) or A.includes(u.open, "shop")) then
			u = openFeatures(u, Js.alit("relations", "shop"), Js.alit("relations", "shop"))
		end
		if (hasSponsorOffer(c) and (not u.story)) then
			u = openFeatures(u, Js.alit("sponsors"), Js.alit("sponsors"))
		end
		local owed = (((not (not u.gameFirst)) and (u.drills >= DRILLS_TO_OPEN_SHOP)) and (not A.includes(c.achievements, "first-two-sessions")))
		if owed then
			do return Js.ospread(withU(c, u), Js.O({ achievements = grant(c, "first-two-sessions") }, { "achievements" })) end
		end
		do return (if (u == c.unlocks) then c else withU(c, u)) end
	end
	exports.recordMatchPlayed = recordMatchPlayed
	recordFirstMatch = function(c)
		if (not c.unlocks) then
			do return c end
		end
		if c.unlocks.story then
			do return recordMatchPlayed(c) end
		end
		local u = (if c.unlocks.gameFirst then openFeatures(c.unlocks, Js.alit("training", "achievements"), Js.alit("training", "achievements")) else openFeatures(c.unlocks, Js.alit("relations", "shop"), Js.alit("relations", "shop")))
		local after = (if (u == c.unlocks) then c else withU(c, u))
		do return recordMatchPlayed(after) end
	end
	exports.recordFirstMatch = recordFirstMatch
	managerTalkDue = function(c)
		do return ((((not (not (function() local _v = c.unlocks; if _v == nil then return nil end; _v = _v.gameFirst; return _v end)())) and (not c.unlocks.story)) and (gamesPlayed(c) >= 1)) and (not A.includes(c.achievements, "boss-meeting"))) end
	end
	exports.managerTalkDue = managerTalkDue
	recordBossMeeting = function(c)
		if ((not c.unlocks) or A.includes(c.achievements, "boss-meeting")) then
			do return c end
		end
		if c.unlocks.story then
			do return Js.ospread(c, Js.O({ achievements = grant(c, "boss-meeting") }, { "achievements" })) end
		end
		do return Js.ospread(withU(c, openFeatures(c.unlocks, Js.alit("relations"), (if c.unlocks.gameFirst then Js.alit("relations") else Js.alit()))), Js.O({ achievements = grant(c, "boss-meeting") }, { "achievements" })) end
	end
	exports.recordBossMeeting = recordBossMeeting
	recordPhoneBought = function(c)
		if (function() local _v = c.unlocks; if _v == nil then return nil end; _v = _v.story; return _v end)() then
			local extra = A.filter(NEW_PHONE_APPS, function(a)
				return (not A.includes(c.unlocks.apps, a))
			end)
			local u = Js.ospread(c.unlocks, Js.O({ open = addTo(c.unlocks.open, "phone", "relations"), apps = Js.aspread(c.unlocks.apps, extra) }, { "open", "apps" }))
			do return Js.ospread(withU(c, u), Js.O({ achievements = grant(c, "buy-phone") }, { "achievements" })) end
		end
		if ((not c.unlocks) or A.includes(c.unlocks.open, "phone")) then
			do return c end
		end
		do return Js.ospread(withU(c, Js.ospread(c.unlocks, Js.O({ open = addTo(c.unlocks.open, "phone") }, { "open" }))), Js.O({ achievements = grant(c, "buy-phone") }, { "achievements" })) end
	end
	exports.recordPhoneBought = recordPhoneBought
	pendingAnnouncements = function(c)
		do return ((function() local _v = c.unlocks; if _v == nil then return nil end; _v = _v.announce; return _v end)() or Js.alit()) end
	end
	exports.pendingAnnouncements = pendingAnnouncements
	markAnnounced = function(c, features)
		if features == nil then features = pendingAnnouncements(c) end
		if (not Js.T((function() local _v = c.unlocks; if _v == nil then return nil end; _v = _v.announce; if _v == nil then return nil end; _v = Js.len(_v); return _v end)())) then
			do return c end
		end
		local left = A.filter(c.unlocks.announce, function(f)
			return (not A.includes(features, f))
		end)
		do return withU(c, Js.ospread(c.unlocks, Js.O({ announce = left }, { "announce" }))) end
	end
	exports.markAnnounced = markAnnounced
	stepsFor = function(c)
		if (function() local _v = c.unlocks; if _v == nil then return nil end; _v = _v.story; return _v end)() then
			do return Js.alit() end
		end
		do return (if (function() local _v = c.unlocks; if _v == nil then return nil end; _v = _v.gameFirst; return _v end)() then FIRST_STEPS_GAME_FIRST else FIRST_STEPS) end
	end
	exports.stepsFor = stepsFor
	phonePrice = function()
		local lv = A.sort(A.filter(M_shopData.LIFESTYLE_ALL_LEVELS, function(i)
			return ((if i.baseId ~= nil then i.baseId else i.id) == "phone")
		end), function(a, b)
			return ((if a.level ~= nil then a.level else 0) - (if b.level ~= nil then b.level else 0))
		end)[1]
		do return (((function() local _v = lv; if _v == nil then return nil end; _v = _v.price; return _v end)() or (function() local _v = A.find(M_shopData.LIFESTYLE_ITEMS, function(i)
			return (i.id == "phone")
		end); if _v == nil then return nil end; _v = _v.price; return _v end)()) or 0) end
	end
	exports.phonePrice = phonePrice
	phoneShortfall = function(c)
		do return Math.max(0, (phonePrice() - math.floor(c.money))) end
	end
	exports.phoneShortfall = phoneShortfall
	phoneStepLine = function(c)
		local need = phoneShortfall(c)
		do return (if (need > 0) then ("A phone costs ★" .. Js.numstr(phonePrice()) .. ". You need ★" .. Js.numstr(need) .. " more. Matches pay you") else ("A phone costs ★" .. Js.numstr(phonePrice()) .. ". You can buy it now")) end
	end
	exports.phoneStepLine = phoneStepLine
	stepDone = function(c, id)
		if (not c.unlocks) then
			do return true end
		end
		if (id == "first-game") then
			do return ((((function() local _v = c.careerStats; if _v == nil then return nil end; _v = _v.appearances; return _v end)() or 0) >= 1) or A.some(c.fixtures, function(f)
				return f.played
			end)) end
		end
		if (id == "first-two-sessions") then
			do return (A.includes(c.achievements, id) or (c.unlocks.drills >= drillsNeeded(c))) end
		end
		do return A.includes(c.achievements, id) end
	end
	exports.stepDone = stepDone
	nextStep = function(c)
		if (not c.unlocks) then
			do return nil end
		end
		do return (A.find(stepsFor(c), function(s)
			return (not stepDone(c, s.id))
		end) or nil) end
	end
	exports.nextStep = nextStep
	firstStepsDone = function(c)
		do return (nextStep(c) == nil) end
	end
	exports.firstStepsDone = firstStepsDone
	bottomLeft = function(c)
		if ((not c.unlocks) or (not A.includes(c.unlocks.open, "achievements"))) then
			do return "league" end
		end
		do return (if firstStepsDone(c) then "league" else "achievements") end
	end
	exports.bottomLeft = bottomLeft
	slotQuestionDue = function(_c)
		do return false end
	end
	exports.slotQuestionDue = slotQuestionDue
	setBottomLeft = function(c, slot)
		if (not c.unlocks) then
			do return c end
		end
		do return withU(c, Js.ospread(c.unlocks, Js.O({ slot = slot }, { "slot" }))) end
	end
	exports.setBottomLeft = setBottomLeft
	styleUnlockStar = function(base, lifestyleValue)
		if lifestyleValue == nil then lifestyleValue = valueOf(base) end
		if (base == "phone") then
			do return 0 end
		end
		if (lifestyleValue <= 5) then
			do return 4 end
		end
		if (lifestyleValue <= 10) then
			do return 6 end
		end
		if (lifestyleValue <= 20) then
			do return 8 end
		end
		if (lifestyleValue <= 45) then
			do return 10 end
		end
		if (lifestyleValue <= 100) then
			do return 15 end
		end
		do return 30 end
	end
	exports.styleUnlockStar = styleUnlockStar
	valueOf = function(base)
		do return ((function() local _v = A.find(M_shopData.LIFESTYLE_ITEMS, function(i)
			return (i.id == base)
		end); if _v == nil then return nil end; _v = _v.lifestyleValue; return _v end)() or 0) end
	end
	styleLock = function(c, base, stars)
		if (not c.unlocks) then
			do return nil end
		end
		local need = styleUnlockStar(base)
		do return (if (stars >= need) then nil else need) end
	end
	exports.styleLock = styleLock
	appInstalled = function(c, id)
		if (not c.unlocks) then
			do return true end
		end
		if c.unlocks.story then
			do return (A.includes(STORY_STARTER_APPS, id) or A.includes(c.unlocks.apps, id)) end
		end
		do return (A.includes(STARTER_APPS, id) or A.includes(c.unlocks.apps, id)) end
	end
	exports.appInstalled = appInstalled
	appIsNew = function(c, id)
		do return (((not (not c.unlocks)) and A.includes(c.unlocks.apps, id)) and (not A.includes(c.unlocks.seen, ("app-new-" .. id)))) end
	end
	exports.appIsNew = appIsNew
	newAppCount = function(c)
		do return (if c.unlocks then Js.alen(A.filter(c.unlocks.apps, function(id)
			return appIsNew(c, id)
		end)) else 0) end
	end
	exports.newAppCount = newAppCount
	markAppOpened = function(c, id)
		do return (if appIsNew(c, id) then markSeen(c, ("app-new-" .. id)) else c) end
	end
	exports.markAppOpened = markAppOpened
	installApp = function(c, id)
		if ((not c.unlocks) or A.includes(c.unlocks.apps, id)) then
			do return c end
		end
		local price = ((function() local _v = A.find(APP_STORE, function(a)
			return (a.id == id)
		end); if _v == nil then return nil end; _v = _v.price; return _v end)() or 0)
		if (c.money < price) then
			do return c end
		end
		do return Js.ospread(withU(c, Js.ospread(c.unlocks, Js.O({ apps = Js.aspread(c.unlocks.apps, Js.alit(id)) }, { "apps" }))), Js.O({ money = (c.money - price) }, { "money" })) end
	end
	exports.installApp = installApp
	SHOP_AFTER_GAMES = 3
	exports.SHOP_AFTER_GAMES = SHOP_AFTER_GAMES
	DRILLS_TO_UNLOCK = 2
	exports.DRILLS_TO_UNLOCK = DRILLS_TO_UNLOCK
	DRILLS_TO_OPEN_SHOP = 1
	exports.DRILLS_TO_OPEN_SHOP = DRILLS_TO_OPEN_SHOP
	UNLOCK_ACHIEVEMENTS = Js.alit(Js.O({ id = "first-two-sessions", label = "First Two Sessions", description = "Complete your first two training sessions" }, { "id", "label", "description" }), Js.O({ id = "boss-meeting", label = "Face to Face", description = "Have a meeting with your boss" }, { "id", "label", "description" }), Js.O({ id = "buy-phone", label = "Connected", description = "Buy a phone" }, { "id", "label", "description" }))
	exports.UNLOCK_ACHIEVEMENTS = UNLOCK_ACHIEVEMENTS
	LOCK_HINT = Js.O({ league = "Finish 2 training drills", stats = "Finish 2 training drills", play = "Finish 2 training drills", shop = "Finish a training drill, or play 3 games", achievements = "Play your first game", relations = "Talk to your manager after your first game", phone = "Buy a phone in Style", sponsors = "Play well and a brand will get in touch", training = "Play your first game" }, { "league", "stats", "play", "shop", "achievements", "relations", "phone", "sponsors", "training" })
	exports.LOCK_HINT = LOCK_HINT
	FEATURE_INFO = Js.O({ league = Js.O({ name = "League", icon = "🏆", line = "The table, results and fixtures" }, { "name", "icon", "line" }), stats = Js.O({ name = "Stats", icon = "📊", line = "Your numbers and records" }, { "name", "icon", "line" }), play = Js.O({ name = "Play", icon = "▶️", line = "Play your matches" }, { "name", "icon", "line" }), shop = Js.O({ name = "Shop", icon = "🛍️", line = "Energy cans, boots and style" }, { "name", "icon", "line" }), achievements = Js.O({ name = "Achievements", icon = "⭐", line = "Your first steps and everything you earn" }, { "name", "icon", "line" }), relations = Js.O({ name = "Relations", icon = "❤️", line = "Your boss, your team-mates and the fans" }, { "name", "icon", "line" }), phone = Js.O({ name = "Phone", icon = "📱", line = "Messages, social media and an App Store" }, { "name", "icon", "line" }), sponsors = Js.O({ name = "Sponsors", icon = "🤝", line = "Brands pay you every week to wear their name" }, { "name", "icon", "line" }), training = Js.O({ name = "Training", icon = "⚽", line = "Drills make your skills better" }, { "name", "icon", "line" }) }, { "league", "stats", "play", "shop", "achievements", "relations", "phone", "sponsors", "training" })
	exports.FEATURE_INFO = FEATURE_INFO
	FIRST_STEPS = Js.alit(Js.O({ id = "first-two-sessions", label = "First Two Sessions", todo = "Complete your first two training sessions", prompt = "Go to training", opens = "Opens the League" }, { "id", "label", "todo", "prompt", "opens" }), Js.O({ id = "first-game", label = "Debut", todo = "Play your first game", prompt = "Time to play your first game", opens = "Opens Relations and the Shop" }, { "id", "label", "todo", "prompt", "opens" }), Js.O({ id = "boss-meeting", label = "Face to Face", todo = "Have a meeting with your boss", prompt = "Time to meet your boss", opens = "Your boss picks you more when he likes you" }, { "id", "label", "todo", "prompt", "opens" }), Js.O({ id = "buy-phone", label = "Connected", todo = "Buy a phone", prompt = "Buy your first phone in the Shop", opens = "Opens the Phone" }, { "id", "label", "todo", "prompt", "opens" }))
	exports.FIRST_STEPS = FIRST_STEPS
	FIRST_STEPS_GAME_FIRST = Js.alit(Js.O({ id = "first-game", label = "Debut", todo = "Play your first game", prompt = "You've got a game today", opens = "Opens Training and Achievements" }, { "id", "label", "todo", "prompt", "opens" }), Js.O({ id = "boss-meeting", label = "Face to Face", todo = "Talk to your manager", prompt = "Your manager wants a word", opens = "Opens Relations" }, { "id", "label", "todo", "prompt", "opens" }), Js.O({ id = "first-two-sessions", label = "First Session", todo = "Complete a training drill", prompt = "Go to training", opens = "Opens the Shop" }, { "id", "label", "todo", "prompt", "opens" }), Js.O({ id = "buy-phone", label = "Connected", todo = "Buy a phone", prompt = "Buy your first phone in the Shop", opens = "Opens the Phone" }, { "id", "label", "todo", "prompt", "opens" }))
	exports.FIRST_STEPS_GAME_FIRST = FIRST_STEPS_GAME_FIRST
	STARTER_APPS = Js.alit("league", "relations", "squad", "settings", "social", "kickabout", "fixtures", "messages", "home-3d")
	exports.STARTER_APPS = STARTER_APPS
	APP_STORE = Js.alit(Js.O({ id = "achievements", label = "Awards", icon = "⭐", note = "Achievements and records", price = 1000 }, { "id", "label", "icon", "note", "price" }), Js.O({ id = "store", label = "Store", icon = "🛒", note = "Daily specials and Coins", price = 1500 }, { "id", "label", "icon", "note", "price" }), Js.O({ id = "shop-kib", label = "Shop", icon = "🛍️", note = "Cans, boots and style", price = 2000 }, { "id", "label", "icon", "note", "price" }), Js.O({ id = "sponsors", label = "Sponsors", icon = "🤝", note = "Deals and offers", price = 2500 }, { "id", "label", "icon", "note", "price" }), Js.O({ id = "casino-menu", label = "Casino", icon = "🎰", note = "Slots, cards, racing", price = 3500 }, { "id", "label", "icon", "note", "price" }), Js.O({ id = "garden", label = "Garden", icon = "🌳", note = "Your garden and horse", price = 5000 }, { "id", "label", "icon", "note", "price" }), Js.O({ id = "ownership", label = "Owner", icon = "🏛️", note = "Buy into clubs", price = 15000 }, { "id", "label", "icon", "note", "price" }))
	exports.APP_STORE = APP_STORE
	STORY_STARTER_APPS = Js.alit("messages", "fixtures", "squad", "relations", "settings", "league", "social")
	exports.STORY_STARTER_APPS = STORY_STARTER_APPS
	NEW_PHONE_APPS = Js.alit("kickabout", "home-3d")
	exports.NEW_PHONE_APPS = NEW_PHONE_APPS
end
