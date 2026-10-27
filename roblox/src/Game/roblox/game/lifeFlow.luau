--!nocheck
--!nolint
-- Generated from roblox/game/lifeFlow.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_week = import("lib/star/week")
	local M_relationships = import("lib/star/relationships")
	local M_shopData = import("lib/star/shopData")
	local M_ruleBook = import("lib/star/ruleBook")
	local M_sponsorDeals = import("lib/star/sponsorDeals")
	local M_starPoints = import("lib/star/starPoints")
	local M_unlocks = import("lib/star/unlocks")
	local M_fame = import("lib/star/fame")
	local M_story = import("lib/star/story")
	local M_tuningStore = import("lib/star/tuningStore")
	local M_relationshipGame = import("lib/star/relationshipGame")
	local M_bossTalk = import("lib/star/bossTalk")
	local restGain, rest, cans, buyKib, useCan, boots, buyBoot, baseOf, ownedLevelOf, lifestyle, buyItem, REL_GAME_LABEL, relGame, relGameComplete, dayOffOptions, dayOff, startTalk, talkPick, talkOver, talkResult, sponsorAction
	restGain = function(c)
		do return (Math.min(100, Math.round((c.energy + (M_week.REST_ENERGY * M_relationships.happinessEnergyFactor(M_relationships.happinessOf(c)))))) - Math.round(c.energy)) end
	end
	exports.restGain = restGain
	rest = function(c)
		do return M_week.rest(c) end
	end
	exports.rest = rest
	cans = function(c)
		do return A.map(M_shopData.KIB_CANS, function(can)
			return Js.O({ can = can, price = M_shopData.kibCanPrice(can, (if c.contract.wage ~= nil then c.contract.wage else 0)), owned = ((function() local _v = c.kibCans; if _v == nil then return nil end; _v = _v[can.id]; return _v end)() or 0), label = M_shopData.kibCanEffectLabel(can) }, { "can", "price", "owned", "label" })
		end) end
	end
	exports.cans = cans
	buyKib = function(c, id)
		local can = A.find(M_shopData.KIB_CANS, function(k)
			return (k.id == id)
		end)
		if (not can) then
			do return nil end
		end
		local price = M_shopData.kibCanPrice(can, (if c.contract.wage ~= nil then c.contract.wage else 0))
		if (c.money < price) then
			do return nil end
		end
		do return Js.ospread(c, Js.O({ money = (c.money - price), kibCans = Js.ospread(c.kibCans, (function() local _o = Js.O({}, nil); _o[Js.key(can.id)] = (c.kibCans[can.id] + 1); return _o end)()) }, { "money", "kibCans" })) end
	end
	exports.buyKib = buyKib
	useCan = function(c, id)
		local can = A.find(M_shopData.KIB_CANS, function(k)
			return (k.id == id)
		end)
		if ((not can) or (c.kibCans[can.id] == 0)) then
			do return nil end
		end
		if (Js.T(can.effect) and (function() local _v = c.kibAbility; if _v == nil then return nil end; _v = _v[can.effect]; return _v end)()) then
			do return nil end
		end
		if ((not Js.T(can.effect)) and (c.energy >= 100)) then
			do return nil end
		end
		do return Js.ospread(c, Js.O({ kibCans = Js.ospread(c.kibCans, (function() local _o = Js.O({}, nil); _o[Js.key(can.id)] = (c.kibCans[can.id] - 1); return _o end)()) }, { "kibCans" }), (if Js.T(can.effect) then Js.O({ kibAbility = Js.ospread(c.kibAbility, (function() local _o = Js.O({}, nil); _o[Js.key(can.effect)] = true; return _o end)()) }, { "kibAbility" }) else Js.O({}, nil)), Js.O({ energy = Math.min(100, (c.energy + can.restore)) }, { "energy" })) end
	end
	exports.useCan = useCan
	boots = function(c)
		local banned = Js.Set.new(M_ruleBook.ruleBookFor(c, "FA").bannedItems)
		do return A.map(A.filter(M_shopData.BOOTS_ALL_LEVELS, function(b)
			return ((not banned:has(b.id)) and (not banned:has((if b.baseId ~= nil then b.baseId else b.id))))
		end), function(b)
			return Js.ospread(b, Js.O({ price = M_sponsorDeals.bootPrice(c, b.price) }, { "price" }))
		end) end
	end
	exports.boots = boots
	buyBoot = function(c, id)
		local boot = A.find(boots(c), function(b)
			return (b.id == id)
		end)
		if ((not boot) or (c.money < boot.price)) then
			do return nil end
		end
		local stacking = (c.currentBoot.id == boot.id)
		do return Js.ospread(c, Js.O({ money = (c.money - boot.price), currentBoot = (if stacking then Js.ospread(boot, Js.O({ matches = (c.currentBoot.matches + boot.matches) }, { "matches" })) else Js.ospread(boot)) }, { "money", "currentBoot" })) end
	end
	exports.buyBoot = buyBoot
	ownedLevelOf = function(c, base)
		local owned = A.find(c.ownedItems, function(o)
			return (baseOf(o) == base)
		end)
		do return Js.O({ owned = owned, level = (if owned then ((if owned.level ~= nil then owned.level else (function() local _v = A.find(M_shopData.LIFESTYLE_ALL_LEVELS, function(l)
			return (l.id == owned.id)
		end); if _v == nil then return nil end; _v = _v.level; return _v end)()) or 0) else 0) }, { "owned", "level" }) end
	end
	lifestyle = function(c)
		local stars = M_starPoints.starsNow(c)
		do return A.map(M_shopData.LIFESTYLE_ALL_LEVELS, function(item)
			local base = baseOf(item)
			local _d1 = ownedLevelOf(c, base)
			local owned = _d1.owned
			local level = _d1.level
			local need = (if c.unlocks then M_unlocks.styleUnlockStar(base) else 0)
			local status = "buy"
			if (stars < need) then
				status = "locked"
			elseif (owned and (owned.id == item.id)) then
				status = (if M_fame.isWornOut(owned) then "worn" else "owned")
			elseif (((owned and (not M_fame.isWornOut(owned))) and ((if item.level ~= nil then item.level else 0) <= level)) and (level > 0)) then
				status = "lower"
			end
			do return Js.O({ item = item, status = status, needStars = need }, { "item", "status", "needStars" }) end
		end) end
	end
	exports.lifestyle = lifestyle
	buyItem = function(c, id)
		local item = A.find(M_shopData.LIFESTYLE_ALL_LEVELS, function(i)
			return (i.id == id)
		end)
		if ((not item) or (c.money < item.price)) then
			do return nil end
		end
		local row = A.find(lifestyle(c), function(r)
			return (r.item.id == id)
		end)
		if ((not row) or (row.status == "locked")) then
			do return nil end
		end
		local base = baseOf(item)
		local _d2 = ownedLevelOf(c, base)
		local owned = _d2.owned
		local level = _d2.level
		if (((owned and (not M_fame.isWornOut(owned))) and ((if item.level ~= nil then item.level else 0) <= level)) and (level > 0)) then
			do return nil end
		end
		if ((owned and (not M_fame.isWornOut(owned))) and (owned.id == item.id)) then
			do return nil end
		end
		local bought = Js.ospread(c, Js.O({ money = (c.money - item.price), ownedItems = Js.aspread(A.filter(c.ownedItems, function(o)
			return (baseOf(o) ~= base)
		end), Js.alit(M_fame.freshItem(item))), happiness = Math.min(100, (c.happiness + math.floor((item.lifestyleValue / 3)))) }, { "money", "ownedItems", "happiness" }))
		if ((base == "phone") and (M_story.isStory(c) or (not M_unlocks.isOpen(c, "phone")))) then
			do return M_unlocks.recordPhoneBought(bought) end
		end
		do return bought end
	end
	exports.buyItem = buyItem
	relGame = function(c, kind)
		local cost = M_tuningStore.getTuning("energy.trainingCost")
		local tired = (c.energy < cost)
		local left = M_week.actionsLeft(c)
		local done = M_relationships.gamePlayedThisWeek(c.relGamesPlayed, c.season, c.week, kind)
		local canPlay = (((left > 0) and (not tired)) and (not done))
		do return Js.O({ done = done, canPlay = canPlay, why = (if done then "Done this week" else (if (left <= 0) then "No days left this week" else (if tired then "Not enough energy" else nil))) }, { "done", "canPlay", "why" }) end
	end
	exports.relGame = relGame
	relGameComplete = function(c, kind, res)
		local p = c.relGamesPlayed
		local same = ((p and (p.season == c.season)) and (p.week == c.week))
		local updated = Js.ospread(c, Js.O({ money = Math.max(0, (c.money - (if res.cost ~= nil then res.cost else 0))), energy = Math.max(0, (c.energy - M_tuningStore.getTuning("energy.trainingCost"))), relGamesPlayed = Js.O({ season = c.season, week = c.week, kinds = Js.aspread((if same then p.kinds else Js.alit()), Js.alit(kind)) }, { "season", "week", "kinds" }) }, { "money", "energy", "relGamesPlayed" }))
		if (kind == "happiness") then
			updated.happiness = M_relationshipGame.applyGameGain(c.happiness, res.gain)
		else
			updated.relationships = Js.ospread(c.relationships, (function() local _o = Js.O({}, nil); _o[Js.key(kind)] = M_relationshipGame.applyGameGain(c.relationships[kind], res.gain); return _o end)())
		end
		if (((kind == "boss") and c.unlocks) and (not A.includes(c.achievements, "boss-meeting"))) then
			updated = M_unlocks.recordBossMeeting(updated)
			if M_unlocks.gameFirst(c) then
				updated = M_unlocks.markAnnounced(updated, Js.alit("relations"))
			end
		end
		do return M_week.spendAction(updated) end
	end
	exports.relGameComplete = relGameComplete
	dayOffOptions = function(c)
		local wage = Math.max(1, ((function() local _v = c.contract; if _v == nil then return nil end; _v = _v.wage; return _v end)() or 0))
		local hasGarden = A.some((if c.ownedItems ~= nil then c.ownedItems else Js.alit()), function(i)
			return (i.category == "property")
		end)
		do return Js.alit(Js.O({ id = "home", icon = (if hasGarden then "🏡" else "🛋️"), name = (if hasGarden then "Chill in the garden" else "Put your feet up"), gain = (if hasGarden then 7 else 5), cost = 0 }, { "id", "icon", "name", "gain", "cost" }), Js.O({ id = "golf", icon = "⛳", name = "A round of golf", gain = 9, cost = Math.round((wage * 0.2)) }, { "id", "icon", "name", "gain", "cost" }), Js.O({ id = "trip", icon = "✈️", name = "A weekend away", gain = 14, cost = Math.round((wage * 0.6)) }, { "id", "icon", "name", "gain", "cost" })) end
	end
	exports.dayOffOptions = dayOffOptions
	dayOff = function(c, id)
		local o = A.find(dayOffOptions(c), function(x)
			return (x.id == id)
		end)
		if ((not o) or (c.money < o.cost)) then
			do return nil end
		end
		do return Js.O({ gain = Math.min(o.gain, (100 - c.happiness)), cost = o.cost, line = (o.name .. ". Just what you needed.") }, { "gain", "cost", "line" }) end
	end
	exports.dayOff = dayOff
	startTalk = function(c, salt)
		do return Js.O({ talk = M_bossTalk.talkFor(c, salt), round = 0, grades = Js.alit(), last = nil }, { "talk", "round", "grades", "last" }) end
	end
	exports.startTalk = startTalk
	talkPick = function(t, i)
		local r = t.talk.rounds[Math.min(t.round, (M_bossTalk.TALK_ROUNDS - 1)) + 1]
		local rep = r.replies[i + 1]
		if ((not rep) or (t.round >= M_bossTalk.TALK_ROUNDS)) then
			do return t end
		end
		do return Js.ospread(t, Js.O({ round = (t.round + 1), grades = Js.aspread(t.grades, Js.alit(rep.grade)), last = Js.O({ you = rep.text, him = rep.answer }, { "you", "him" }) }, { "round", "grades", "last" })) end
	end
	exports.talkPick = talkPick
	talkOver = function(t)
		do return (t.round >= M_bossTalk.TALK_ROUNDS) end
	end
	exports.talkOver = talkOver
	talkResult = function(t)
		local hits = M_bossTalk.talkHits(t.grades)
		do return Js.O({ gain = M_bossTalk.talkGain(t.grades), line = (if (hits == M_bossTalk.TALK_ROUNDS) then "He liked every answer." else (if (hits > 0) then "That went well enough." else "You didn't get through to him.")) }, { "gain", "line" }) end
	end
	exports.talkResult = talkResult
	sponsorAction = function(c, action, id, roll)
		local _sw3 = action
		local _ci4 = (if _sw3 == "sign" then 1 elseif _sw3 == "decline" then 2 elseif _sw3 == "longer" then 3 elseif _sw3 == "easier" then 4 elseif _sw3 == "counter" then 5 elseif _sw3 == "walk" then 6 else 0)
		local _cont5 = false
		repeat
			if _ci4 ~= 0 and _ci4 <= 1 then
				do
					local r = M_sponsorDeals.signOffer(c, id)
					do return (if r.ok then Js.O({ career = r.career, note = r.message }, { "career", "note" }) else Js.O({ career = c, note = r.reason }, { "career", "note" })) end
				end
			end
			if _ci4 ~= 0 and _ci4 <= 2 then
				do return Js.O({ career = M_sponsorDeals.declineOffer(c, id), note = "Declined." }, { "career", "note" }) end
			end
			if _ci4 ~= 0 and _ci4 <= 3 then
				do
					local r = M_sponsorDeals.askLonger(c, id, roll)
					do return Js.O({ career = r.career, note = (if r.yes then "They agreed: one more season." else "They said no to a longer deal.") }, { "career", "note" }) end
				end
			end
			if _ci4 ~= 0 and _ci4 <= 4 then
				do
					local r = M_sponsorDeals.askEasier(c, id, roll)
					do return Js.O({ career = r.career, note = (if r.yes then "They agreed: easier targets." else "They said no to easier targets.") }, { "career", "note" }) end
				end
			end
			if _ci4 ~= 0 and _ci4 <= 5 then
				do
					local r = M_sponsorDeals.counterPoach(c, id, roll)
					do return Js.O({ career = r.career, note = (if r.matched then "Your sponsor matched the offer." else "Your sponsor would not match it.") }, { "career", "note" }) end
				end
			end
			if _ci4 ~= 0 and _ci4 <= 6 then
				do
					local r = M_sponsorDeals.walkAway(c, id)
					do return (if r.ok then Js.O({ career = r.career, note = r.message }, { "career", "note" }) else Js.O({ career = c, note = r.reason }, { "career", "note" })) end
				end
			end
		until true
		do return Js.O({ career = c, note = "" }, { "career", "note" }) end
	end
	exports.sponsorAction = sponsorAction
	baseOf = function(i)
		return (if i.baseId ~= nil then i.baseId else i.id)
	end
	REL_GAME_LABEL = Js.O({ boss = "Office talk", team = "Woodwork challenge", fans = "Signing session", happiness = "Day off" }, { "boss", "team", "fans", "happiness" })
	exports.REL_GAME_LABEL = REL_GAME_LABEL
	exports.canAct = M_week.canAct
	exports.actionsLeft = M_week.actionsLeft
	exports.TALK_ROUNDS = M_bossTalk.TALK_ROUNDS
	exports.brandsOf = M_sponsorDeals.brandsOf
	exports.targetLabel = M_sponsorDeals.targetLabel
	exports.slotsFor = M_sponsorDeals.slotsFor
end
