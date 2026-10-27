--!nocheck
--!nolint
-- Generated from lib/star/sponsorDeals.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_fame = import("lib/star/fame")
	local M_economy = import("lib/star/economy")
	local M_starPoints = import("lib/star/starPoints")
	local M_wages = import("lib/star/wages")
	local M_calendar = import("lib/star/calendar")
	local M_season = import("lib/star/season")
	local M_expectations = import("lib/star/expectations")
	local emptyBrands, brandsOf, ownsWorking, BRAND_CATEGORIES, categoryOf, STARTER_FAME, fameNeeded, slotsFor, WEEKS_PER_SEASON, SIGNING_ON_WEEKS, BOOT_DEAL_DISCOUNT, TAPER_FROM, TAPER_POWER, clamp, pick, roundMoney, fairWeekly, weeklySponsorTotal, sponsorPayFor, hasBootDeal, bootPrice, targetLabel, makeTarget, makeTargets, OFFER_WEEKS, nextId, expiry, expired, buildOffer, openCategories, categoryStatus, recentForm, offerChance, push, maybeOffer, potmCount, MILESTONES, milestoneOffers, HAPPY, progressTargets, brandsAfterMatch, brandsAfterSeason, withBrands, signOffer, declineOffer, patchOffer, SPONSOR_NEGOTIATION, settleNegotiation, askLonger, askEasier, counterPoach, walkAway, brandScandal, moodOf, changeDealHappiness
	fameNeeded = function(c)
		do return (if (c.fame <= STARTER_FAME) then 0 else c.fame) end
	end
	exports.fameNeeded = fameNeeded
	slotsFor = function(career)
		local f = M_fame.fameOf(career)
		do return (if (f >= 80) then 5 else (if (f >= 60) then 4 else (if (f >= 40) then 3 else (if (f >= 25) then 2 else 1)))) end
	end
	exports.slotsFor = slotsFor
	fairWeekly = function(career, category, rng)
		local cat = categoryOf(category)
		if (not cat) then
			do return 0 end
		end
		local wage = Math.max(M_economy.WAGE_FLOOR, ((function() local _v = career.contract; if _v == nil then return nil end; _v = _v.wage; return _v end)() or 0))
		local taper = (if (wage > TAPER_FROM) then Math.pow((TAPER_FROM / wage), TAPER_POWER) else 1)
		local stars = (M_starPoints.starLevel(career) / 10)
		do return roundMoney(((((wage * cat.share) * taper) * (0.9 + (rng() * 0.3))) * (1 + (stars * 0.02)))) end
	end
	exports.fairWeekly = fairWeekly
	weeklySponsorTotal = function(career)
		do return A.reduce(brandsOf(career).deals, function(s, d)
			return (s + d.weekly)
		end, 0) end
	end
	exports.weeklySponsorTotal = weeklySponsorTotal
	sponsorPayFor = function(career, fixture)
		local total = weeklySponsorTotal(career)
		if (not Js.T(total)) then
			do return 0 end
		end
		do return Math.round((total * (if fixture then M_wages.wageShareFor(career, fixture) else 1))) end
	end
	exports.sponsorPayFor = sponsorPayFor
	hasBootDeal = function(career)
		do return A.some(brandsOf(career).deals, function(d)
			return (d.category == "Boots")
		end) end
	end
	exports.hasBootDeal = hasBootDeal
	bootPrice = function(career, price)
		local p = M_economy.bootPriceForWage(price, ((function() local _v = career.contract; if _v == nil then return nil end; _v = _v.wage; return _v end)() or 0))
		do return (if hasBootDeal(career) then Math.max(1, (Math.round(((p * (1 - BOOT_DEAL_DISCOUNT)) / 5)) * 5)) else p) end
	end
	exports.bootPrice = bootPrice
	targetLabel = function(t)
		local when = (if (t.period == "season") then " this season" else " before the deal ends")
		local _sw1 = t.kind
		if _sw1 == "goals" then
			do return ("Score " .. Js.numstr(t.target) .. " goals" .. when) end
		elseif _sw1 == "assists" then
			do return ("Get " .. Js.numstr(t.target) .. " assists" .. when) end
		elseif _sw1 == "involvements" then
			do return (Js.numstr(t.target) .. " goals and assists" .. when) end
		elseif _sw1 == "appearances" then
			do return ("Play " .. Js.numstr(t.target) .. " matches" .. when) end
		elseif _sw1 == "starMan" then
			do return ("Win " .. Js.numstr(t.target) .. " Star Man award" .. (if (t.target == 1) then "" else "s") .. when) end
		elseif _sw1 == "rating" then
			do return ("Average " .. N.toFixed((t.target / 10), 1) .. " or better this season") end
		elseif _sw1 == "goalStreak" then
			do return ("Score in " .. Js.numstr(t.target) .. " appearances in a row") end
		elseif _sw1 == "potm" then
			do return ("Win Player of the Month" .. when) end
		elseif _sw1 == "promotion" then
			do return "Get promoted" end
		elseif _sw1 == "trophy" then
			do return ("Win a trophy" .. when) end
		end
	end
	exports.targetLabel = targetLabel
	makeTarget = function(career, kind, weekly, rng)
		local seasons = Math.max(1, career.season)
		local perSeason = function(total, floor)
			return Math.max(floor, Math.round((total / seasons)))
		end
		local g = Math.max(6, career.seasonStats.goals, perSeason(career.careerStats.goals, 6))
		local a = Math.max(4, career.seasonStats.assists, perSeason(career.careerStats.assists, 4))
		local stretch = (1 + (rng() * 0.4))
		local mk = function(target, period, weeks)
			return Js.O({ kind = kind, target = target, progress = 0, period = period, bonus = roundMoney((weekly * weeks)), done = false }, { "kind", "target", "progress", "period", "bonus", "done" })
		end
		local _sw2 = kind
		if _sw2 == "goals" then
			do return mk(Math.round((g * stretch)), "season", 8) end
		elseif _sw2 == "assists" then
			do return mk(Math.round((a * stretch)), "season", 7) end
		elseif _sw2 == "involvements" then
			do return mk(Math.round(((g + a) * stretch)), "season", 9) end
		elseif _sw2 == "appearances" then
			do return mk((24 + math.floor((rng() * 12))), "season", 4) end
		elseif _sw2 == "starMan" then
			do return mk((3 + math.floor((rng() * 5))), "season", 8) end
		elseif _sw2 == "rating" then
			do return mk((68 + math.floor((rng() * 7))), "season", 7) end
		elseif _sw2 == "goalStreak" then
			do return mk((3 + math.floor((rng() * 3))), "deal", 10) end
		elseif _sw2 == "potm" then
			do return mk(1, "season", 10) end
		elseif _sw2 == "promotion" then
			do return mk(1, "deal", 12) end
		elseif _sw2 == "trophy" then
			do return mk(1, "deal", 12) end
		end
	end
	makeTargets = function(career, category, weekly, rng)
		local cat = categoryOf(category)
		local n = (if (cat.share >= 0.15) then 2 else 1)
		local pool = Js.aspread(cat.targets)
		if ((M_calendar.divisionOf(career) ~= "premier") and (rng() < 0.25)) then
			A.push(pool, "promotion")
		end
		local out = Js.alit()
		while ((Js.alen(out) < n) and Js.T(Js.alen(pool))) do
			local k = A.splice(pool, math.floor((rng() * Js.alen(pool))), 1)[1]
			A.push(out, makeTarget(career, k, weekly, rng))
		end
		do return out end
	end
	expiry = function(career, weeks)
		if weeks == nil then weeks = OFFER_WEEKS end
		do return Js.O({ season = career.season, week = (career.week + weeks) }, { "season", "week" }) end
	end
	buildOffer = function(career, s, category, brand, kind, rng, weeklyMult)
		if weeklyMult == nil then weeklyMult = 1 end
		local cat = categoryOf(category)
		local weekly = roundMoney((fairWeekly(career, category, rng) * weeklyMult))
		do return Js.O({ id = nextId(s, "o"), kind = kind, brand = brand[1], color = brand[2], category = category, weekly = weekly, seasons = (1 + math.floor((rng() * 3))), targets = makeTargets(career, category, weekly, rng), clause = cat.clause, signingOn = (weekly * SIGNING_ON_WEEKS), expires = expiry(career), note = "" }, { "id", "kind", "brand", "color", "category", "weekly", "seasons", "targets", "clause", "signingOn", "expires", "note" }) end
	end
	openCategories = function(career)
		local s = brandsOf(career)
		local fame = M_fame.fameOf(career)
		do return A.filter(BRAND_CATEGORIES, function(c)
			return ((((fame >= fameNeeded(c)) and c.fits(career)) and (not A.some(s.deals, function(d)
				return (d.category == c.category)
			end))) and (not A.some(s.offers, function(o)
				return ((o.category == c.category) and (o.kind ~= "milestone"))
			end)))
		end) end
	end
	exports.openCategories = openCategories
	categoryStatus = function(career, c)
		if (M_fame.fameOf(career) < fameNeeded(c)) then
			do return ("Needs " .. M_fame.fameLevel(c.fame).name .. " (" .. Js.numstr(c.fame) .. " fame)") end
		end
		if (not c.fits(career)) then
			do return ("Wants " .. c.wants) end
		end
		do return "Could send an offer" end
	end
	exports.categoryStatus = categoryStatus
	offerChance = function(career)
		if ((career.status == "Squad") or (career.status == "Injured")) then
			do return 0 end
		end
		local form = recentForm(career)
		if ((form < 6.2) or (career.seasonStats.appearances < 1)) then
			do return 0 end
		end
		do return clamp((((0.06 + (M_fame.fameOf(career) / 500)) + ((form - 6.2) * 0.12)) + ((M_starPoints.starLevel(career) / 10) * 0.008)), 0, 0.45) end
	end
	exports.offerChance = offerChance
	maybeOffer = function(career, s0, rng)
		local s = s0
		local chance = offerChance(career)
		if (chance <= 0) then
			do return s end
		end
		local free = (slotsFor(career) - Js.alen(s.deals))
		local pendingNew = Js.alen(A.filter(s.offers, function(o)
			return ((o.kind == "new") or (o.kind == "bid"))
		end))
		if (((free > 0) and (pendingNew == 0)) and (rng() < chance)) then
			local open = openCategories(career)
			if Js.T(Js.alen(open)) then
				local cat = pick(open, rng)
				local war = ((Js.alen(cat.brands) >= 2) and (rng() < 0.25))
				if war then
					local i = math.floor((rng() * Js.alen(cat.brands)))
					local a = buildOffer(career, s, cat.category, cat.brands[i + 1], "bid", rng)
					s = Js.ospread(s, Js.O({ seq = (s.seq + 1) }, { "seq" }))
					local b = buildOffer(career, s, cat.category, cat.brands[math.fmod((i + 1), Js.alen(cat.brands)) + 1], "bid", rng, (0.9 + (rng() * 0.25)))
					s = Js.ospread(s, Js.O({ seq = (s.seq + 1) }, { "seq" }))
					a.rival = b.id
					b.rival = a.id
					b.note = ("Two " .. S.toLowerCase(cat.category) .. " brands want you. Sign one and the other walks.")
					a.note = b.note
					do return Js.ospread(s, Js.O({ offers = Js.aspread(s.offers, Js.alit(a, b)), news = push(s, ("Bidding war: " .. a.brand .. " and " .. b.brand .. " both want you.")) }, { "offers", "news" })) end
				end
				local o = buildOffer(career, s, cat.category, pick(cat.brands, rng), "new", rng)
				o.note = "A new offer."
				do return Js.ospread(s, Js.O({ seq = (s.seq + 1), offers = Js.aspread(s.offers, Js.alit(o)), news = push(s, (o.brand .. " have made you an offer.")) }, { "seq", "offers", "news" })) end
			end
		end
		local poachable = A.filter(s.deals, function(d)
			return ((d.seasonsLeft >= 1) and (not A.some(s.offers, function(o)
				return (o.replaces == d.id)
			end)))
		end)
		if (Js.T(Js.alen(poachable)) and (rng() < (chance * 0.15))) then
			local d = pick(poachable, rng)
			local cat = categoryOf(d.category)
			local rivals = A.filter(((function() local _v = cat; if _v == nil then return nil end; _v = _v.brands; return _v end)() or Js.alit()), function(b)
				return (b[1] ~= d.brand)
			end)
			if (cat and Js.T(Js.alen(rivals))) then
				local o = buildOffer(career, s, d.category, pick(rivals, rng), "poach", rng)
				o.weekly = roundMoney(Math.max(o.weekly, (d.weekly * (1.2 + (rng() * 0.25)))))
				o.signingOn = (o.weekly * SIGNING_ON_WEEKS)
				o.replaces = d.id
				o.note = (o.brand .. " will buy you out of your " .. d.brand .. " deal. It costs you nothing.")
				do return Js.ospread(s, Js.O({ seq = (s.seq + 1), offers = Js.aspread(s.offers, Js.alit(o)), news = push(s, (o.brand .. " want to take you from " .. d.brand .. ".")) }, { "seq", "offers", "news" })) end
			end
		end
		do return s end
	end
	milestoneOffers = function(before, after, s0, rng)
		local s = s0
		if (M_fame.fameOf(after) < 10) then
			do return s end
		end
		do
			local _arr4 = MILESTONES
			local _i5 = 0
			while _i5 < Js.alen(_arr4) do
				_i5 += 1
				local m = _arr4[_i5]
				if ((A.includes(s.paid, m.id) or A.some(s.offers, function(o)
					return (o.id == ("m-" .. m.id))
				end)) or (not m.hit(before, after))) then
					do continue end
				end
				local cat = pick(A.filter(BRAND_CATEGORIES, function(c)
					return (c.fame <= Math.max(10, M_fame.fameOf(after)))
				end), rng)
				local brand = pick(cat.brands, rng)
				local lump = roundMoney(((Math.max(M_economy.WAGE_FLOOR, ((function() local _v = after.contract; if _v == nil then return nil end; _v = _v.wage; return _v end)() or 0)) * 0.15) * m.weeks))
				local o = Js.O({ id = ("m-" .. m.id), kind = "milestone", brand = brand[1], color = brand[2], category = cat.category, weekly = 0, seasons = 0, targets = Js.alit(), signingOn = lump, expires = expiry(after), note = ("A one-off advert to mark " .. m.label .. ". It doesn't use a deal slot.") }, { "id", "kind", "brand", "color", "category", "weekly", "seasons", "targets", "signingOn", "expires", "note" })
				s = Js.ospread(s, Js.O({ offers = Js.aspread(s.offers, Js.alit(o)), news = push(s, (o.brand .. " want a one-off advert for " .. m.label .. ".")) }, { "offers", "news" }))
			end
		end
		do return s end
	end
	progressTargets = function(d, before, after, stats)
		local bonus = 0
		local hit = Js.alit()
		local wonPotm = (potmCount(after) > potmCount(before))
		local wonTrophy = (Js.alen(after.trophies) > Js.alen(before.trophies))
		local targets = A.map(d.targets, function(t)
			if t.done then
				do return t end
			end
			local progress = t.progress
			local run = t.run
			local _sw6 = t.kind
			if _sw6 == "goals" then
				progress += stats.goals
			elseif _sw6 == "assists" then
				progress += stats.assists
			elseif _sw6 == "involvements" then
				progress += (stats.goals + stats.assists)
			elseif _sw6 == "appearances" then
				progress += 1
			elseif _sw6 == "starMan" then
				progress += (if stats.starMan then 1 else 0)
			elseif _sw6 == "goalStreak" then
				run = (if (stats.goals > 0) then ((if run ~= nil then run else 0) + 1) else 0)
				progress = Math.max(progress, run)
			elseif _sw6 == "potm" then
				progress += (if wonPotm then 1 else 0)
			elseif _sw6 == "trophy" then
				progress += (if wonTrophy then 1 else 0)
			elseif _sw6 == "rating" or _sw6 == "promotion" then
			end
			local done = (((t.kind ~= "rating") and (t.kind ~= "promotion")) and (progress >= t.target))
			if done then
				bonus += t.bonus
				A.push(hit, (d.brand .. ": " .. targetLabel(t) .. " — bonus ★" .. N.toLocaleString(t.bonus, "en-GB")))
			end
			do return Js.ospread(t, Js.O({ progress = progress, run = run, done = done }, { "progress", "run", "done" })) end
		end)
		local mood = (((if (stats.rating >= 7.5) then 1 else (if (stats.rating <= 5.5) then -1 else 0)) + (if wonTrophy then HAPPY.trophy else 0)) + (Js.alen(hit) * HAPPY.hit))
		do return Js.O({ deal = Js.ospread(d, Js.O({ targets = targets, happiness = clamp((d.happiness + mood), 0, 100) }, { "targets", "happiness" })), bonus = bonus, hit = hit }, { "deal", "bonus", "hit" }) end
	end
	brandsAfterMatch = function(before, after, _fixture, stats)
		local s = brandsOf(before)
		local rng = M_season.mulberry32(((((before.season * 7919) + (before.week * 131)) + (s.seq * 17)) + 5))
		local bonus = 0
		local lines = Js.alit()
		local deals = A.map(s.deals, function(d)
			local r = progressTargets(d, before, after, stats)
			bonus += r.bonus
			A.push(lines, Js.unpack(r.hit))
			do return r.deal end
		end)
		s = Js.ospread(s, Js.O({ deals = deals, offers = A.filter(s.offers, function(o)
			return (not expired(o, after))
		end) }, { "deals", "offers" }))
		do
			local _arr7 = lines
			local _i8 = 0
			while _i8 < Js.alen(_arr7) do
				_i8 += 1
				local l = _arr7[_i8]
				s = Js.ospread(s, Js.O({ news = push(s, l) }, { "news" }))
			end
		end
		s = milestoneOffers(before, after, s, rng)
		s = maybeOffer(after, s, rng)
		do return Js.O({ brands = s, bonus = bonus }, { "brands", "bonus" }) end
	end
	exports.brandsAfterMatch = brandsAfterMatch
	brandsAfterSeason = function(before, after, promoted)
		local s = brandsOf(before)
		local rng = M_season.mulberry32((((before.season * 104729) + (s.seq * 31)) + 11))
		local bonus = 0
		local avg10 = (if (before.seasonStats.ratingCount > 0) then Math.round(((before.seasonStats.totalRating / before.seasonStats.ratingCount) * 10)) else 0)
		local kept = Js.alit()
		local offers = A.filter(s.offers, function(o)
			return (((not expired(o, after)) and (o.kind ~= "bid")) and (o.kind ~= "new"))
		end)
		local news = s.news
		local seq = s.seq
		local say = function(l)
			news = A.slice(Js.aspread(Js.alit(l), news), 0, 12)
		end
		do
			local _arr9 = s.deals
			local _i10 = 0
			while _i10 < Js.alen(_arr9) do
				_i10 += 1
				local d = _arr9[_i10]
				local happiness = d.happiness
				local targets = Js.alit()
				do
					local _arr11 = d.targets
					local _i12 = 0
					while _i12 < Js.alen(_arr11) do
						_i12 += 1
						local t0 = _arr11[_i12]
						local t = t0
						if ((not t.done) and (t.kind == "rating")) then
							t = Js.ospread(t, Js.O({ progress = avg10, done = (avg10 >= t.target) }, { "progress", "done" }))
						end
						if (((not t.done) and (t.kind == "promotion")) and promoted) then
							t = Js.ospread(t, Js.O({ progress = 1, done = true }, { "progress", "done" }))
						end
						if (t.done and (not t0.done)) then
							bonus += t.bonus
							happiness += HAPPY.hit
							say((d.brand .. ": " .. targetLabel(t) .. " — bonus ★" .. N.toLocaleString(t.bonus, "en-GB")))
						end
						local over = ((t.period == "season") or (d.seasonsLeft <= 1))
						if ((not t.done) and over) then
							happiness += HAPPY.miss
							say((d.brand .. ": you missed \"" .. targetLabel(t) .. "\". No money lost; they are a little less happy."))
						end
						A.push(targets, t)
					end
				end
				happiness = clamp(happiness, 0, 100)
				local left = (d.seasonsLeft - 1)
				if (left > 0) then
					local next_ = A.map(targets, function(t)
						return (if (t.period == "season") then makeTarget(after, t.kind, d.weekly, rng) else t)
					end)
					A.push(kept, Js.ospread(d, Js.O({ seasonsLeft = left, happiness = happiness, targets = next_ }, { "seasonsLeft", "happiness", "targets" })))
					do continue end
				end
				local cat = categoryOf(d.category)
				if ((happiness < HAPPY.wheel) or (not cat)) then
					say((d.brand .. " have not renewed. The deal is over."))
					do continue end
				end
				local roll = rng()
				local mult = (if (happiness >= HAPPY.renew) then (1.15 + (rng() * 0.15)) else (if (roll < 0.4) then 1.1 else (if (roll < 0.75) then 1 else 0.85)))
				local weekly = roundMoney((d.weekly * mult))
				seq += 1
				A.push(offers, Js.O({ id = ("o" .. Js.numstr(seq)), kind = "renewal", brand = d.brand, color = d.color, category = d.category, weekly = weekly, seasons = (1 + math.floor((rng() * 3))), targets = makeTargets(after, d.category, weekly, rng), clause = d.clause, signingOn = (weekly * SIGNING_ON_WEEKS), expires = Js.O({ season = after.season, week = ((after.week + OFFER_WEEKS) + 1) }, { "season", "week" }), note = (if (happiness >= HAPPY.renew) then (d.brand .. " are happy and want to renew, with a raise.") else (if (mult > 1) then (d.brand .. " were on the fence. They came back with a small raise.") else (if (mult == 1) then (d.brand .. " were on the fence. Same money to stay.") else (d.brand .. " were on the fence. They will renew, for less.")))) }, { "id", "kind", "brand", "color", "category", "weekly", "seasons", "targets", "clause", "signingOn", "expires", "note" }))
				say(("Your " .. d.brand .. " deal has ended. A renewal offer is on your phone."))
			end
		end
		do return Js.O({ brands = Js.ospread(s, Js.O({ deals = kept, offers = offers, news = news, seq = seq }, { "deals", "offers", "news", "seq" })), bonus = bonus }, { "brands", "bonus" }) end
	end
	exports.brandsAfterSeason = brandsAfterSeason
	signOffer = function(career, offerId)
		local s = brandsOf(career)
		local o = A.find(s.offers, function(x)
			return (x.id == offerId)
		end)
		if (not o) then
			do return Js.O({ ok = false, reason = "That offer has gone." }, { "ok", "reason" }) end
		end
		local rest = A.filter(s.offers, function(x)
			return ((x.id ~= o.id) and (x.id ~= o.rival))
		end)
		if (o.kind == "milestone") then
			local brands = Js.ospread(s, Js.O({ offers = rest, paid = Js.aspread(s.paid, Js.alit(S.replace(o.id, Js.re("^m-", ""), ""))), news = push(s, (o.brand .. " paid ★" .. N.toLocaleString(o.signingOn, "en-GB") .. " for a one-off advert.")) }, { "offers", "paid", "news" }))
			do return Js.O({ ok = true, career = withBrands(career, brands, (career.money + o.signingOn)), message = (o.brand .. " paid you ★" .. N.toLocaleString(o.signingOn, "en-GB") .. ".") }, { "ok", "career", "message" }) end
		end
		local replaced = (if Js.T(o.replaces) then A.find(s.deals, function(d)
			return (d.id == o.replaces)
		end) else nil)
		local others = A.filter(s.deals, function(d)
			return (d.id ~= o.replaces)
		end)
		if A.some(others, function(d)
			return (d.category == o.category)
		end) then
			do return Js.O({ ok = false, reason = ("You already have a " .. S.toLowerCase(o.category) .. " deal.") }, { "ok", "reason" }) end
		end
		if (Js.alen(others) >= slotsFor(career)) then
			do return Js.O({ ok = false, reason = "No free deal slot. More open as your fame grows." }, { "ok", "reason" }) end
		end
		local deal = Js.O({ id = ("d" .. Js.numstr((s.seq + 1))), brand = o.brand, category = o.category, color = o.color, weekly = o.weekly, seasonsLeft = o.seasons, seasonsTotal = o.seasons, guaranteed = ((o.weekly * WEEKS_PER_SEASON) * o.seasons), happiness = (if (o.kind == "renewal") then Math.max(HAPPY.start, ((function() local _v = replaced; if _v == nil then return nil end; _v = _v.happiness; return _v end)() or HAPPY.start)) else HAPPY.start), targets = A.map(o.targets, function(t)
			return Js.ospread(t, Js.O({ progress = 0, done = false, run = 0 }, { "progress", "done", "run" }))
		end), clause = o.clause }, { "id", "brand", "category", "color", "weekly", "seasonsLeft", "seasonsTotal", "guaranteed", "happiness", "targets", "clause" })
		local news = push(s, ("Signed with " .. o.brand .. ": ★" .. N.toLocaleString(o.weekly, "en-GB") .. " a week for " .. Js.numstr(o.seasons) .. " season" .. (if (o.seasons == 1) then "" else "s") .. ". Signing-on payment ★" .. N.toLocaleString(o.signingOn, "en-GB") .. "."))
		if (replaced and (o.kind == "poach")) then
			news = A.slice(Js.aspread(Js.alit((o.brand .. " bought you out of your " .. replaced.brand .. " deal.")), news), 0, 12)
		end
		local brands = Js.ospread(s, Js.O({ seq = (s.seq + 1), deals = Js.aspread(others, Js.alit(deal)), offers = rest, news = news }, { "seq", "deals", "offers", "news" }))
		do return Js.O({ ok = true, career = withBrands(career, brands, (career.money + o.signingOn)), message = ("Here's your signing-on payment: ★" .. N.toLocaleString(o.signingOn, "en-GB") .. ".") }, { "ok", "career", "message" }) end
	end
	exports.signOffer = signOffer
	declineOffer = function(career, offerId)
		local s = brandsOf(career)
		do return withBrands(career, Js.ospread(s, Js.O({ offers = A.filter(s.offers, function(o)
			return (o.id ~= offerId)
		end) }, { "offers" }))) end
	end
	exports.declineOffer = declineOffer
	settleNegotiation = function(career, offerId, weekly)
		if (weekly == nil) then
			local s = brandsOf(career)
			local o = A.find(s.offers, function(x)
				return (x.id == offerId)
			end)
			do return withBrands(career, Js.ospread(s, Js.O({ offers = A.filter(s.offers, function(x)
				return (x.id ~= offerId)
			end), news = (if o then push(s, (o.brand .. " walked away from the table.")) else s.news) }, { "offers", "news" }))) end
		end
		do return patchOffer(career, offerId, function(o)
			local w = roundMoney(weekly)
			local k = (w / Math.max(1, o.weekly))
			do return Js.ospread(o, Js.O({ weekly = w, signingOn = (w * SIGNING_ON_WEEKS), negotiated = true, targets = A.map(o.targets, function(t)
				return Js.ospread(t, Js.O({ bonus = roundMoney((t.bonus * k)) }, { "bonus" }))
			end) }, { "weekly", "signingOn", "negotiated", "targets" })) end
		end) end
	end
	exports.settleNegotiation = settleNegotiation
	askLonger = function(career, offerId, roll)
		local o = A.find(brandsOf(career).offers, function(x)
			return (x.id == offerId)
		end)
		if ((((not o) or o.askedLonger) or (o.seasons >= 3)) or (o.kind == "milestone")) then
			do return Js.O({ career = career, yes = false }, { "career", "yes" }) end
		end
		local yes = (roll < 0.65)
		do return Js.O({ yes = yes, career = patchOffer(career, offerId, function(x)
			return Js.ospread(x, Js.O({ askedLonger = true, seasons = (if yes then (x.seasons + 1) else x.seasons) }, { "askedLonger", "seasons" }))
		end) }, { "yes", "career" }) end
	end
	exports.askLonger = askLonger
	askEasier = function(career, offerId, roll)
		local o = A.find(brandsOf(career).offers, function(x)
			return (x.id == offerId)
		end)
		if ((((not o) or o.askedEasier) or (not A.some(o.targets, function(t)
			return (t.target > 1)
		end))) or (o.kind == "milestone")) then
			do return Js.O({ career = career, yes = false }, { "career", "yes" }) end
		end
		local yes = (roll < 0.55)
		do return Js.O({ yes = yes, career = patchOffer(career, offerId, function(x)
			return Js.ospread(x, Js.O({ askedEasier = true, targets = (if yes then A.map(x.targets, function(t)
				return (if ((t.target > 1) and (t.kind ~= "rating")) then Js.ospread(t, Js.O({ target = Math.max(1, Math.round((t.target * 0.8))) }, { "target" })) else (if (t.kind == "rating") then Js.ospread(t, Js.O({ target = (t.target - 2) }, { "target" })) else t))
			end) else x.targets) }, { "askedEasier", "targets" }))
		end) }, { "yes", "career" }) end
	end
	exports.askEasier = askEasier
	counterPoach = function(career, offerId, roll)
		local s = brandsOf(career)
		local o = A.find(s.offers, function(x)
			return (x.id == offerId)
		end)
		local d = (if Js.T((function() local _v = o; if _v == nil then return nil end; _v = _v.replaces; return _v end)()) then A.find(s.deals, function(x)
			return (x.id == o.replaces)
		end) else nil)
		if (((not o) or (not d)) or (o.kind ~= "poach")) then
			do return Js.O({ career = career, matched = false }, { "career", "matched" }) end
		end
		local matched = (roll < clamp(((d.happiness / 100) + 0.1), 0.2, 0.9))
		local deals = A.map(s.deals, function(x)
			return (if ((x.id == d.id) and matched) then Js.ospread(x, Js.O({ weekly = Math.max(x.weekly, o.weekly), guaranteed = ((Math.max(x.weekly, o.weekly) * WEEKS_PER_SEASON) * x.seasonsTotal) }, { "weekly", "guaranteed" })) else x)
		end)
		local news = push(s, (if matched then (d.brand .. " matched " .. o.brand .. "'s offer: ★" .. N.toLocaleString(o.weekly, "en-GB") .. " a week.") else (d.brand .. " would not match " .. o.brand .. "'s offer. It is still on the table.")))
		do return Js.O({ matched = matched, career = withBrands(career, Js.ospread(s, Js.O({ deals = deals, news = news, offers = (if matched then A.filter(s.offers, function(x)
			return (x.id ~= o.id)
		end) else s.offers) }, { "deals", "news", "offers" }))) }, { "matched", "career" }) end
	end
	exports.counterPoach = counterPoach
	walkAway = function(career, dealId)
		local s = brandsOf(career)
		local d = A.find(s.deals, function(x)
			return (x.id == dealId)
		end)
		if (not d) then
			do return Js.O({ ok = false, reason = "That deal has gone." }, { "ok", "reason" }) end
		end
		if (career.money < d.guaranteed) then
			do return Js.O({ ok = false, reason = ("Walking away costs ★" .. N.toLocaleString(d.guaranteed, "en-GB") .. ". You can't afford it.") }, { "ok", "reason" }) end
		end
		local brands = Js.ospread(s, Js.O({ deals = A.filter(s.deals, function(x)
			return (x.id ~= dealId)
		end), news = push(s, ("You bought yourself out of the " .. d.brand .. " deal for ★" .. N.toLocaleString(d.guaranteed, "en-GB") .. ".")) }, { "deals", "news" }))
		do return Js.O({ ok = true, career = withBrands(career, brands, (career.money - d.guaranteed)), message = ("You paid ★" .. N.toLocaleString(d.guaranteed, "en-GB") .. " to leave " .. d.brand .. ".") }, { "ok", "career", "message" }) end
	end
	exports.walkAway = walkAway
	brandScandal = function(career, what)
		local s = brandsOf(career)
		if (not Js.T(Js.alen(s.deals))) then
			do return career end
		end
		local news = s.news
		local deals = Js.alit()
		do
			local _arr13 = s.deals
			local _i14 = 0
			while _i14 < Js.alen(_arr13) do
				_i14 += 1
				local d = _arr13[_i14]
				if (d.clause == "behaviour") then
					news = A.slice(Js.aspread(Js.alit((d.brand .. " ended your deal over " .. what .. ".")), news), 0, 12)
					do continue end
				end
				A.push(deals, Js.ospread(d, Js.O({ happiness = clamp((d.happiness + HAPPY.scandal), 0, 100) }, { "happiness" })))
			end
		end
		if Js.T(Js.alen(deals)) then
			news = A.slice(Js.aspread(Js.alit(("Your sponsors are unhappy about " .. what .. ".")), news), 0, 12)
		end
		do return withBrands(career, Js.ospread(s, Js.O({ deals = deals, news = news }, { "deals", "news" }))) end
	end
	exports.brandScandal = brandScandal
	changeDealHappiness = function(career, dealId, change)
		local b = brandsOf(career)
		do return Js.ospread(career, Js.O({ brands = Js.ospread(b, Js.O({ deals = A.map(b.deals, function(d)
			return (if (d.id == dealId) then Js.ospread(d, Js.O({ happiness = clamp((d.happiness + change), 0, 100) }, { "happiness" })) else d)
		end) }, { "deals" })) }, { "brands" })) end
	end
	exports.changeDealHappiness = changeDealHappiness
	emptyBrands = function()
		return Js.O({ deals = Js.alit(), offers = Js.alit(), news = Js.alit(), paid = Js.alit(), seq = 0 }, { "deals", "offers", "news", "paid", "seq" })
	end
	exports.emptyBrands = emptyBrands
	brandsOf = function(career)
		return (if career.brands ~= nil then career.brands else emptyBrands())
	end
	exports.brandsOf = brandsOf
	ownsWorking = function(c, category)
		return A.some((if c.ownedItems ~= nil then c.ownedItems else Js.alit()), function(i)
			return ((i.category == category) and (not M_fame.isWornOut(i)))
		end)
	end
	BRAND_CATEGORIES = Js.alit(Js.O({ category = "Boots", icon = "👟", fame = 10, share = 0.16, clause = "exclusive", fits = function(c)
		return (((c.seasonStats.goals + c.seasonStats.assists) >= 3) or ((c.careerStats.goals + c.careerStats.assists) >= 10))
	end, wants = "3 goals or assists this season (or 10 in your career)", brands = Js.alit(Js.alit("STRYDE", "#f59e0b"), Js.alit("Velo", "#22d3ee"), Js.alit("Kestrel", "#ef4444")), targets = Js.alit("goals", "goalStreak", "involvements") }, { "category", "icon", "fame", "share", "clause", "fits", "wants", "brands", "targets" }), Js.O({ category = "Sports Drink", icon = "⚡", fame = 10, share = 0.12, clause = "exclusive", fits = function(c)
		return ((c.seasonStats.appearances >= 6) or (c.careerStats.appearances >= 20))
	end, wants = "6 appearances this season", brands = Js.alit(Js.alit("VOLTA Energy", "#a78bfa"), Js.alit("Hydra8", "#38bdf8"), Js.alit("Surge", "#84cc16")), targets = Js.alit("appearances", "rating", "starMan") }, { "category", "icon", "fame", "share", "clause", "fits", "wants", "brands", "targets" }), Js.O({ category = "Food", icon = "🍔", fame = 10, share = 0.1, clause = "behaviour", fits = function(c)
		return (c.happiness >= 45)
	end, wants = "45 happiness", brands = Js.alit(Js.alit("Crunchwell", "#fb923c"), Js.alit("Big Oven", "#f87171"), Js.alit("Fuel Bowl", "#4ade80")), targets = Js.alit("appearances", "goals", "assists") }, { "category", "icon", "fame", "share", "clause", "fits", "wants", "brands", "targets" }), Js.O({ category = "Headphones", icon = "🎧", fame = 10, share = 0.1, fits = function(c)
		return (c.relationships.fans >= 40)
	end, wants = "40 with the fans", brands = Js.alit(Js.alit("Loudline", "#f472b6"), Js.alit("Pulse Audio", "#60a5fa")), targets = Js.alit("starMan", "assists", "appearances") }, { "category", "icon", "fame", "share", "fits", "wants", "brands", "targets" }), Js.O({ category = "Sports Clothing", icon = "🎽", fame = 25, share = 0.15, fits = function(c)
		return (c.relationships.fans >= 45)
	end, wants = "45 with the fans", brands = Js.alit(Js.alit("Kinetic", "#34d399"), Js.alit("Arrow Athletic", "#f97316")), targets = Js.alit("goals", "involvements", "rating") }, { "category", "icon", "fame", "share", "fits", "wants", "brands", "targets" }), Js.O({ category = "Casual Clothing", icon = "🧥", fame = 25, share = 0.14, clause = "behaviour", fits = function(c)
		return (c.relationships.fans >= 55)
	end, wants = "55 with the fans", brands = Js.alit(Js.alit("Northside", "#94a3b8"), Js.alit("Harbour & Co", "#fbbf24")), targets = Js.alit("starMan", "potm", "appearances") }, { "category", "icon", "fame", "share", "clause", "fits", "wants", "brands", "targets" }), Js.O({ category = "Video Game", icon = "🎮", fame = 25, share = 0.15, fits = function(c)
		return ((c.seasonStats.starMan >= 2) or (c.careerStats.starMan >= 5))
	end, wants = "2 Star Man awards this season (or 5 in your career)", brands = Js.alit(Js.alit("Kickoff League", "#818cf8"), Js.alit("Pixel Pitch", "#2dd4bf")), targets = Js.alit("starMan", "goals", "potm") }, { "category", "icon", "fame", "share", "fits", "wants", "brands", "targets" }), Js.O({ category = "Electronics", icon = "📱", fame = 40, share = 0.17, fits = function(c)
		return (Js.alen(c.trophies) >= 1)
	end, wants = "a trophy in the cabinet", brands = Js.alit(Js.alit("Novatek", "#38bdf8"), Js.alit("Orbit", "#c084fc")), targets = Js.alit("trophy", "rating", "involvements") }, { "category", "icon", "fame", "share", "fits", "wants", "brands", "targets" }), Js.O({ category = "Cosmetics", icon = "🧴", fame = 40, share = 0.15, clause = "behaviour", fits = function(c)
		return (c.relationships.fans >= 50)
	end, wants = "50 with the fans", brands = Js.alit(Js.alit("Solace", "#f9a8d4"), Js.alit("Clean Cut", "#67e8f9")), targets = Js.alit("starMan", "potm", "rating") }, { "category", "icon", "fame", "share", "clause", "fits", "wants", "brands", "targets" }), Js.O({ category = "Watch", icon = "⌚", fame = 60, share = 0.2, clause = "exclusive", fits = function(c)
		return ownsWorking(c, "vehicle")
	end, wants = "a car of your own", brands = Js.alit(Js.alit("Chronos", "#fcd34d"), Js.alit("Meridian Time", "#e5e7eb")), targets = Js.alit("starMan", "trophy", "goals") }, { "category", "icon", "fame", "share", "clause", "fits", "wants", "brands", "targets" }), Js.O({ category = "Jewellery", icon = "💎", fame = 60, share = 0.2, fits = function(c)
		return ownsWorking(c, "property")
	end, wants = "a home of your own", brands = Js.alit(Js.alit("Aurum", "#fde047"), Js.alit("Lustre", "#a5b4fc")), targets = Js.alit("trophy", "potm", "involvements") }, { "category", "icon", "fame", "share", "fits", "wants", "brands", "targets" }), Js.O({ category = "Car", icon = "🚗", fame = 80, share = 0.24, clause = "behaviour", fits = function(c)
		local a = M_expectations.clubExpectation(c).ambition
		do return ((a == "Title") or (a == "Europe")) end
	end, wants = "a club chasing the title or Europe", brands = Js.alit(Js.alit("Vanta Motors", "#f43f5e"), Js.alit("Apex Automotive", "#93c5fd")), targets = Js.alit("trophy", "goals", "rating") }, { "category", "icon", "fame", "share", "clause", "fits", "wants", "brands", "targets" }), Js.O({ category = "Home Nation", icon = "🏳️", fame = 25, share = 0.15, clause = "behaviour", fits = function(c)
		return ((if c.caps ~= nil then c.caps else 0) >= 1)
	end, wants = "a cap for your country", brands = Js.alit(Js.alit("Pride of the Nation", "#f87171"), Js.alit("National Rail", "#60a5fa")), targets = Js.alit("appearances", "goals", "starMan") }, { "category", "icon", "fame", "share", "clause", "fits", "wants", "brands", "targets" }))
	exports.BRAND_CATEGORIES = BRAND_CATEGORIES
	categoryOf = function(category)
		return A.find(BRAND_CATEGORIES, function(c)
			return (c.category == category)
		end)
	end
	STARTER_FAME = 10
	exports.STARTER_FAME = STARTER_FAME
	WEEKS_PER_SEASON = 40
	exports.WEEKS_PER_SEASON = WEEKS_PER_SEASON
	SIGNING_ON_WEEKS = 2
	exports.SIGNING_ON_WEEKS = SIGNING_ON_WEEKS
	BOOT_DEAL_DISCOUNT = 0.25
	exports.BOOT_DEAL_DISCOUNT = BOOT_DEAL_DISCOUNT
	TAPER_FROM = 8000
	TAPER_POWER = 0.35
	clamp = function(n, lo, hi)
		return Math.max(lo, Math.min(hi, n))
	end
	pick = function(xs, rng)
		return xs[Math.min((Js.alen(xs) - 1), math.floor((rng() * Js.alen(xs)))) + 1]
	end
	roundMoney = function(n)
		return (if (n >= 1000) then (Math.round((n / 50)) * 50) else (if (n >= 100) then (Math.round((n / 5)) * 5) else Math.max(1, Math.round(n))))
	end
	OFFER_WEEKS = 2
	exports.OFFER_WEEKS = OFFER_WEEKS
	nextId = function(s, tag)
		return (tag .. Js.numstr((s.seq + 1)))
	end
	expired = function(o, career)
		return ((career.season > o.expires.season) or ((career.season == o.expires.season) and (career.week > o.expires.week)))
	end
	recentForm = function(career)
		local f = ((if Js.T((function() local _v = career.rawForm; if _v == nil then return nil end; _v = Js.len(_v); return _v end)()) then career.rawForm else career.form) or Js.alit())
		do return (if Js.T(Js.alen(f)) then (A.reduce(f, function(x, y)
			return (x + y)
		end, 0) / Js.alen(f)) else 6.5) end
	end
	push = function(s, line)
		return A.slice(Js.aspread(Js.alit(line), s.news), 0, 12)
	end
	potmCount = function(c)
		return Js.alen(A.filter((if c.awards ~= nil then c.awards else Js.alit()), function(a)
			return (a.kind == "Player of the Month")
		end))
	end
	MILESTONES = Js.alit(Js.O({ id = "first-goal", label = "your first goal", weeks = 2, hit = function(b, a)
		return ((b.careerStats.goals == 0) and (a.careerStats.goals > 0))
	end }, { "id", "label", "weeks", "hit" }), Js.O({ id = "goals-50", label = "50 career goals", weeks = 5, hit = function(b, a)
		return ((b.careerStats.goals < 50) and (a.careerStats.goals >= 50))
	end }, { "id", "label", "weeks", "hit" }), Js.O({ id = "goals-100", label = "100 career goals", weeks = 8, hit = function(b, a)
		return ((b.careerStats.goals < 100) and (a.careerStats.goals >= 100))
	end }, { "id", "label", "weeks", "hit" }), Js.O({ id = "first-hat-trick", label = "your first hat-trick", weeks = 4, hit = function(b, a)
		return ((b.careerStats.hatTricks == 0) and (a.careerStats.hatTricks > 0))
	end }, { "id", "label", "weeks", "hit" }), Js.O({ id = "first-potm", label = "your first Player of the Month", weeks = 5, hit = function(b, a)
		return ((potmCount(b) == 0) and (potmCount(a) > 0))
	end }, { "id", "label", "weeks", "hit" }), Js.O({ id = "first-trophy", label = "your first trophy", weeks = 8, hit = function(b, a)
		return ((Js.alen(b.trophies) == 0) and (Js.alen(a.trophies) > 0))
	end }, { "id", "label", "weeks", "hit" }), Js.O({ id = "first-cap", label = "your first cap", weeks = 6, hit = function(b, a)
		return (((if b.caps ~= nil then b.caps else 0) == 0) and ((if a.caps ~= nil then a.caps else 0) > 0))
	end }, { "id", "label", "weeks", "hit" }))
	HAPPY = Js.O({ start = 60, hit = 15, miss = -8, trophy = 10, scandal = -25, renew = 60, wheel = 40 }, { "start", "hit", "miss", "trophy", "scandal", "renew", "wheel" })
	exports.HAPPY = HAPPY
	withBrands = function(career, brands, money)
		if money == nil then money = career.money end
		return Js.ospread(career, Js.O({ brands = brands, money = money }, { "brands", "money" }))
	end
	patchOffer = function(career, offerId, f)
		local s = brandsOf(career)
		do return withBrands(career, Js.ospread(s, Js.O({ offers = A.map(s.offers, function(o)
			return (if (o.id == offerId) then f(o) else o)
		end) }, { "offers" }))) end
	end
	SPONSOR_NEGOTIATION = false
	exports.SPONSOR_NEGOTIATION = SPONSOR_NEGOTIATION
	moodOf = function(happiness)
		return (if (happiness >= HAPPY.renew) then "happy" else (if (happiness >= HAPPY.wheel) then "neutral" else "angry"))
	end
	exports.moodOf = moodOf
end
