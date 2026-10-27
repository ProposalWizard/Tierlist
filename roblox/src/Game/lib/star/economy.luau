--!nocheck
--!nolint
-- Generated from lib/star/economy.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_clubReputation = import("lib/star/clubReputation")
	local M_calendar = import("lib/star/calendar")
	local WAGE_FLOOR, DIVISION_STEP, REPUTATION_PREMIUM_MAX, STANDING_BENCH, STANDING_STARTER, STANDING_STAR, STARTER_STANDING, TOTAL_INCOME_SHARES, TOTAL_INCOME_MULTIPLE, LADDER_UP, DIVISION_STEP_INTO, divisionStepInto, MIN_DIVISION_STEP, DIVISION_BASE_WAGE, divisionBaseWage, clubPremium, standingMultiplier, weeklyWageFor, PREMIER_WAGE_SPEND, premierClubFactor, PREMIER_HONOUR_MULT, PREMIER_WAGE_CAP, premierHonoursFactor, premierStarFactor, typicalWeeklyWage, typicalWeeklyIncome, GOAL_BONUS_WAGE_SHARE, ASSIST_BONUS_WAGE_SHARE, goalBonusFor, assistBonusFor, SPONSOR_MATCHES_PER_WEEK, SPONSOR_PAY_WEEKS_PER_MATCH, sponsorPayPerMatch, OFFER_STANDING_AT_ZERO_REPUTATION, OFFER_STANDING_AT_FULL_REPUTATION, OFFER_STANDING_STEP_WEIGHT, OFFER_STANDING_STEP_SPAN, offerStanding, offerWageFor, RENEWAL_RAISE_PER_WIN, RENEWAL_SOURED_CUT, renewalMultiplier, renewalWage, SIGNING_ON_WEEKS_MIN, SIGNING_ON_WEEKS_MAX, signingOnFee, PRICE_BANDS, SQUEEZE_STEP, SHOP_TIERS, SHOP_TIER_ORDER, tierOf, tierWeeklyIncome, tierAnchorWage, priceStep, tierPrice, bandPrice, weeksOfIncome, bandWeeks, priceIsInBand, RATING_CONVERTER_WEEKS
	local RATING_CONVERTER_TIERS, BOOT_WEEKS_PER_MATCH, BOOT_MATCHES_MIN, BOOT_MATCHES_MAX, bootMatchesFor, bootWeeksPerMatch, weeksOfWallet, KIB_CAN_WAGE_WEEKS, BOOT_PRICE_REF_WAGE, bootPriceForWage
	divisionStepInto = function(division)
		do return (if DIVISION_STEP_INTO[division] ~= nil then DIVISION_STEP_INTO[division] else DIVISION_STEP) end
	end
	exports.divisionStepInto = divisionStepInto
	divisionBaseWage = function(division)
		do return (if DIVISION_BASE_WAGE[division] ~= nil then DIVISION_BASE_WAGE[division] else DIVISION_BASE_WAGE.national_league) end
	end
	exports.divisionBaseWage = divisionBaseWage
	clubPremium = function(club, division)
		do return (1 + (REPUTATION_PREMIUM_MAX * M_clubReputation.clubStanding(club, division))) end
	end
	exports.clubPremium = clubPremium
	standingMultiplier = function(standing)
		local s = Math.max(0, Math.min(1, (if Js.NumberNS.isFinite(standing) then standing else STARTER_STANDING)))
		if (s <= STARTER_STANDING) then
			do return (STANDING_BENCH + ((s / STARTER_STANDING) * (STANDING_STARTER - STANDING_BENCH))) end
		end
		local t = ((s - STARTER_STANDING) / (1 - STARTER_STANDING))
		do return (STANDING_STARTER + (t * (STANDING_STAR - STANDING_STARTER))) end
	end
	exports.standingMultiplier = standingMultiplier
	weeklyWageFor = function(club, division, standing, career)
		if standing == nil then standing = STARTER_STANDING end
		if (division == "premier") then
			local wage = (((divisionBaseWage(division) * premierClubFactor(club)) * standingMultiplier(standing)) * (if career then (premierHonoursFactor(career) * premierStarFactor(career.starRating)) else 1))
			do return Math.max(1, Math.min(PREMIER_WAGE_CAP, Math.round(wage))) end
		end
		local wage = ((divisionBaseWage(division) * clubPremium(club, division)) * standingMultiplier(standing))
		do return Math.max(1, Math.round(wage)) end
	end
	exports.weeklyWageFor = weeklyWageFor
	premierClubFactor = function(club)
		do return Math.sqrt(Math.max(1, (if PREMIER_WAGE_SPEND[club] ~= nil then PREMIER_WAGE_SPEND[club] else 1))) end
	end
	exports.premierClubFactor = premierClubFactor
	premierHonoursFactor = function(career)
		local recent = function(comp)
			return A.some(career.trophies, function(t)
				return ((t.competition == comp) and (t.season >= (career.season - 1)))
			end)
		end
		local f = 1
		if recent("Premier League") then
			f *= PREMIER_HONOUR_MULT.league
		end
		if recent("Champions League") then
			f *= PREMIER_HONOUR_MULT.championsLeague
		end
		if (career.ballonDorWins > 0) then
			f *= PREMIER_HONOUR_MULT.ballonDor
		end
		do return f end
	end
	exports.premierHonoursFactor = premierHonoursFactor
	premierStarFactor = function(starRating)
		local s = (if Js.NumberNS.isFinite(starRating) then starRating else 0)
		do return (1 + (0.5 * Math.max(0, Math.min(1, (s - 4))))) end
	end
	exports.premierStarFactor = premierStarFactor
	typicalWeeklyWage = function(division)
		do return ((divisionBaseWage(division) * (1 + (REPUTATION_PREMIUM_MAX / 2))) * STANDING_STARTER) end
	end
	exports.typicalWeeklyWage = typicalWeeklyWage
	typicalWeeklyIncome = function(division)
		do return (typicalWeeklyWage(division) * TOTAL_INCOME_MULTIPLE) end
	end
	exports.typicalWeeklyIncome = typicalWeeklyIncome
	goalBonusFor = function(wage)
		do return Math.max(1, Math.round((wage * GOAL_BONUS_WAGE_SHARE))) end
	end
	exports.goalBonusFor = goalBonusFor
	assistBonusFor = function(wage)
		do return Math.max(1, Math.round((wage * ASSIST_BONUS_WAGE_SHARE))) end
	end
	exports.assistBonusFor = assistBonusFor
	sponsorPayPerMatch = function(wage, sponsorStanding)
		local standing = (Math.max(0, Math.min(100, (if Js.NumberNS.isFinite(sponsorStanding) then sponsorStanding else 0))) / 100)
		do return Math.max(0, Math.round(((Math.max(0, wage) * SPONSOR_PAY_WEEKS_PER_MATCH) * standing))) end
	end
	exports.sponsorPayPerMatch = sponsorPayPerMatch
	offerStanding = function(reputation, strengthStep)
		local rep = (Math.max(0, Math.min(100, (if Js.NumberNS.isFinite(reputation) then reputation else 0))) / 100)
		local base = (OFFER_STANDING_AT_ZERO_REPUTATION + (rep * (OFFER_STANDING_AT_FULL_REPUTATION - OFFER_STANDING_AT_ZERO_REPUTATION)))
		local step = Math.max(-1, Math.min(1, ((if Js.NumberNS.isFinite(strengthStep) then strengthStep else 0) / OFFER_STANDING_STEP_SPAN)))
		do return Math.max(0, Math.min(1, (base - (step * OFFER_STANDING_STEP_WEIGHT)))) end
	end
	exports.offerStanding = offerStanding
	offerWageFor = function(club, division, reputation, strengthStep, currentWage, career)
		local theirs = weeklyWageFor(club, division, offerStanding(reputation, strengthStep), career)
		do return Math.max(1, Math.round(Math.max(theirs, (if Js.T(currentWage) then currentWage else 0)))) end
	end
	exports.offerWageFor = offerWageFor
	renewalMultiplier = function(wins, soured)
		do return ((1 + (RENEWAL_RAISE_PER_WIN * Math.max(0, wins))) * (if soured then (1 - RENEWAL_SOURED_CUT) else 1)) end
	end
	exports.renewalMultiplier = renewalMultiplier
	renewalWage = function(currentWage, wins, soured)
		local raw = Math.round((currentWage * renewalMultiplier(wins, soured)))
		do return Math.min(raw, Math.max(currentWage, PREMIER_WAGE_CAP)) end
	end
	exports.renewalWage = renewalWage
	signingOnFee = function(club, wage)
		local rep = (Math.max(0, Math.min(100, M_clubReputation.clubReputation(club))) / 100)
		local weeks = (SIGNING_ON_WEEKS_MIN + (rep * (SIGNING_ON_WEEKS_MAX - SIGNING_ON_WEEKS_MIN)))
		do return Math.max(1, Math.round((wage * weeks))) end
	end
	exports.signingOnFee = signingOnFee
	tierOf = function(tier)
		do return (A.find(SHOP_TIERS, function(s)
			return (s.id == tier)
		end) or SHOP_TIERS[1]) end
	end
	tierWeeklyIncome = function(tier)
		do return typicalWeeklyIncome(tierOf(tier).anchor) end
	end
	exports.tierWeeklyIncome = tierWeeklyIncome
	tierAnchorWage = function(tier)
		do return typicalWeeklyWage(tierOf(tier).anchor) end
	end
	exports.tierAnchorWage = tierAnchorWage
	priceStep = function(raw)
		do return (if (raw < 20) then 1 else (if (raw < 100) then 5 else (if (raw < 1000) then 25 else (if (raw < 10000) then 100 else (if (raw < 100000) then 500 else 1000))))) end
	end
	exports.priceStep = priceStep
	tierPrice = function(tier, weeks)
		local raw = (tierWeeklyIncome(tier) * weeks)
		local step = priceStep(raw)
		do return Math.max(step, (Math.round((raw / step)) * step)) end
	end
	exports.tierPrice = tierPrice
	bandPrice = function(tier, band, at)
		if at == nil then at = 0.5 end
		local _d1 = bandWeeks(band, tier)
		local min = _d1.min
		local max = _d1.max
		local income = tierWeeklyIncome(tier)
		local lo = (min * income)
		local hi = (max * income)
		local t = Math.max(0, Math.min(1, (if Js.NumberNS.isFinite(at) then at else 0.5)))
		local raw = (lo + ((hi - lo) * t))
		local step = priceStep(raw)
		local price = Math.max(step, (Math.round((raw / step)) * step))
		if (price < lo) then
			price = (math.ceil((lo / step)) * step)
		end
		if (price > hi) then
			price = (math.floor((hi / step)) * step)
		end
		if ((price < lo) or (price > hi)) then
			price = Math.round(((lo + hi) / 2))
		end
		do return Math.max(1, Math.round(price)) end
	end
	exports.bandPrice = bandPrice
	weeksOfIncome = function(price, tier)
		do return (price / tierWeeklyIncome(tier)) end
	end
	exports.weeksOfIncome = weeksOfIncome
	bandWeeks = function(band, tier)
		local b = PRICE_BANDS[band]
		local squeeze = tierOf(tier).squeeze
		do return Js.O({ min = (b.min * squeeze), max = (b.max * squeeze) }, { "min", "max" }) end
	end
	exports.bandWeeks = bandWeeks
	priceIsInBand = function(price, tier, band)
		local w = weeksOfIncome(price, tier)
		local _d2 = bandWeeks(band, tier)
		local min = _d2.min
		local max = _d2.max
		do return ((w >= min) and (w <= max)) end
	end
	exports.priceIsInBand = priceIsInBand
	bootMatchesFor = function(price, tier)
		local weeks = weeksOfIncome(price, tier)
		local raw = (weeks / BOOT_WEEKS_PER_MATCH)
		local rounded = (if (raw < 20) then Math.round(raw) else (if (raw < 60) then (Math.round((raw / 2)) * 2) else (Math.round((raw / 5)) * 5)))
		do return Math.max(BOOT_MATCHES_MIN, Math.min(BOOT_MATCHES_MAX, rounded)) end
	end
	exports.bootMatchesFor = bootMatchesFor
	bootWeeksPerMatch = function(price, matches, tier)
		do return (weeksOfIncome(price, tier) / Math.max(1, matches)) end
	end
	exports.bootWeeksPerMatch = bootWeeksPerMatch
	weeksOfWallet = function(price, weeklyWage)
		local income = (Math.max(1, weeklyWage) * TOTAL_INCOME_MULTIPLE)
		do return (price / income) end
	end
	exports.weeksOfWallet = weeksOfWallet
	bootPriceForWage = function(listPrice, weeklyWage)
		local wage = Math.max(WAGE_FLOOR, (if Js.T(weeklyWage) then weeklyWage else 0))
		local raw = ((listPrice * wage) / BOOT_PRICE_REF_WAGE)
		local step = priceStep(raw)
		do return Math.max(1, (Math.round((raw / step)) * step)) end
	end
	exports.bootPriceForWage = bootPriceForWage
	WAGE_FLOOR = 20
	exports.WAGE_FLOOR = WAGE_FLOOR
	DIVISION_STEP = 3.2
	exports.DIVISION_STEP = DIVISION_STEP
	REPUTATION_PREMIUM_MAX = 0.5
	exports.REPUTATION_PREMIUM_MAX = REPUTATION_PREMIUM_MAX
	STANDING_BENCH = 0.5
	exports.STANDING_BENCH = STANDING_BENCH
	STANDING_STARTER = 1
	exports.STANDING_STARTER = STANDING_STARTER
	STANDING_STAR = 1.6
	exports.STANDING_STAR = STANDING_STAR
	STARTER_STANDING = 0.55
	exports.STARTER_STANDING = STARTER_STANDING
	TOTAL_INCOME_SHARES = Js.O({ bonuses = 0.1, sponsorPerMatch = 0.08, lumps = 0.22 }, { "bonuses", "sponsorPerMatch", "lumps" })
	exports.TOTAL_INCOME_SHARES = TOTAL_INCOME_SHARES
	TOTAL_INCOME_MULTIPLE = (((1 + TOTAL_INCOME_SHARES.bonuses) + TOTAL_INCOME_SHARES.sponsorPerMatch) + TOTAL_INCOME_SHARES.lumps)
	exports.TOTAL_INCOME_MULTIPLE = TOTAL_INCOME_MULTIPLE
	LADDER_UP = A.reverse(Js.aspread(M_calendar.DIVISION_ORDER))
	DIVISION_STEP_INTO = Js.O({ championship = 4.5, premier = 5.5 }, { "championship", "premier" })
	exports.DIVISION_STEP_INTO = DIVISION_STEP_INTO
	MIN_DIVISION_STEP = Math.min(Js.unpack(Js.aspread(Js.alit(DIVISION_STEP), A.filter(Js.Object.values(DIVISION_STEP_INTO), function(v)
		return (type(v) == "number")
	end))))
	exports.MIN_DIVISION_STEP = MIN_DIVISION_STEP
	DIVISION_BASE_WAGE = (function()
		local out = Js.O({}, nil)
		local base = WAGE_FLOOR
		A.forEach(LADDER_UP, function(division, i)
			if (i > 0) then
				base *= divisionStepInto(division)
			end
			out[division] = base
		end)
		out.national_league_north = out.national_league
		out.national_league_south = out.national_league
		do return out end
	end)()
	exports.DIVISION_BASE_WAGE = DIVISION_BASE_WAGE
	PREMIER_WAGE_SPEND = Js.O({ Liverpool = 13.53, ["Manchester City"] = 13.52, Arsenal = 11.75, ["Manchester United"] = 11.6, ["Tottenham Hotspur"] = 10.56, ["Aston Villa"] = 7.45, Chelsea = 7.41, ["Newcastle United"] = 5.18, ["Crystal Palace"] = 5.01, ["Nottingham Forest"] = 4.87, ["AFC Bournemouth"] = 4.78, Everton = 4.52, ["Fulham FC"] = 4.35, ["Leeds United"] = 4.08, ["Brighton & Hove Albion"] = 3.86, Sunderland = 3.82, Brentford = 3.71, ["Ipswich Town"] = 1.49, ["Hull City"] = 1.19, ["Coventry City"] = 1 }, { "Liverpool", "Manchester City", "Arsenal", "Manchester United", "Tottenham Hotspur", "Aston Villa", "Chelsea", "Newcastle United", "Crystal Palace", "Nottingham Forest", "AFC Bournemouth", "Everton", "Fulham FC", "Leeds United", "Brighton & Hove Albion", "Sunderland", "Brentford", "Ipswich Town", "Hull City", "Coventry City" })
	exports.PREMIER_WAGE_SPEND = PREMIER_WAGE_SPEND
	PREMIER_HONOUR_MULT = Js.O({ league = 1.2, championsLeague = 1.3, ballonDor = 1.5 }, { "league", "championsLeague", "ballonDor" })
	exports.PREMIER_HONOUR_MULT = PREMIER_HONOUR_MULT
	PREMIER_WAGE_CAP = 100000
	exports.PREMIER_WAGE_CAP = PREMIER_WAGE_CAP
	GOAL_BONUS_WAGE_SHARE = 0.1
	exports.GOAL_BONUS_WAGE_SHARE = GOAL_BONUS_WAGE_SHARE
	ASSIST_BONUS_WAGE_SHARE = 0.07
	exports.ASSIST_BONUS_WAGE_SHARE = ASSIST_BONUS_WAGE_SHARE
	SPONSOR_MATCHES_PER_WEEK = 0.8
	exports.SPONSOR_MATCHES_PER_WEEK = SPONSOR_MATCHES_PER_WEEK
	SPONSOR_PAY_WEEKS_PER_MATCH = (TOTAL_INCOME_SHARES.sponsorPerMatch / SPONSOR_MATCHES_PER_WEEK)
	exports.SPONSOR_PAY_WEEKS_PER_MATCH = SPONSOR_PAY_WEEKS_PER_MATCH
	OFFER_STANDING_AT_ZERO_REPUTATION = 0.3
	exports.OFFER_STANDING_AT_ZERO_REPUTATION = OFFER_STANDING_AT_ZERO_REPUTATION
	OFFER_STANDING_AT_FULL_REPUTATION = 1
	exports.OFFER_STANDING_AT_FULL_REPUTATION = OFFER_STANDING_AT_FULL_REPUTATION
	OFFER_STANDING_STEP_WEIGHT = 0.2
	exports.OFFER_STANDING_STEP_WEIGHT = OFFER_STANDING_STEP_WEIGHT
	OFFER_STANDING_STEP_SPAN = 25
	exports.OFFER_STANDING_STEP_SPAN = OFFER_STANDING_STEP_SPAN
	RENEWAL_RAISE_PER_WIN = 0.08
	exports.RENEWAL_RAISE_PER_WIN = RENEWAL_RAISE_PER_WIN
	RENEWAL_SOURED_CUT = 0.15
	exports.RENEWAL_SOURED_CUT = RENEWAL_SOURED_CUT
	SIGNING_ON_WEEKS_MIN = 2
	exports.SIGNING_ON_WEEKS_MIN = SIGNING_ON_WEEKS_MIN
	SIGNING_ON_WEEKS_MAX = 12
	exports.SIGNING_ON_WEEKS_MAX = SIGNING_ON_WEEKS_MAX
	PRICE_BANDS = Js.O({ consumable = Js.O({ id = "consumable", label = "Small consumable", min = 0.05, max = 0.1 }, { "id", "label", "min", "max" }), upgrade = Js.O({ id = "upgrade", label = "Meaningful upgrade", min = 2, max = 4 }, { "id", "label", "min", "max" }), aspirational = Js.O({ id = "aspirational", label = "Aspirational", min = 15, max = 25 }, { "id", "label", "min", "max" }), endgame = Js.O({ id = "endgame", label = "Endgame", min = 100, max = 150 }, { "id", "label", "min", "max" }) }, { "consumable", "upgrade", "aspirational", "endgame" })
	exports.PRICE_BANDS = PRICE_BANDS
	SQUEEZE_STEP = Math.sqrt(3)
	exports.SQUEEZE_STEP = SQUEEZE_STEP
	SHOP_TIERS = Js.alit(Js.O({ id = "starter", label = "Starter", anchor = "national_league", squeeze = 9, blurb = "Non-league money. Everything here is a season-long goal." }, { "id", "label", "anchor", "squeeze", "blurb" }), Js.O({ id = "semi_pro", label = "Semi-Pro", anchor = "league_two", squeeze = (3 * SQUEEZE_STEP), blurb = "League Two money. Still a real slog, but a shorter one." }, { "id", "label", "anchor", "squeeze", "blurb" }), Js.O({ id = "pro", label = "Pro", anchor = "league_one", squeeze = 3, blurb = "League One money. You can start choosing rather than saving." }, { "id", "label", "anchor", "squeeze", "blurb" }), Js.O({ id = "elite", label = "Elite", anchor = "championship", squeeze = SQUEEZE_STEP, blurb = "Championship money. The first time a good week buys something." }, { "id", "label", "anchor", "squeeze", "blurb" }), Js.O({ id = "world_class", label = "World Class", anchor = "premier", squeeze = 1, blurb = "Top-flight money. Price stops being the thing in your way." }, { "id", "label", "anchor", "squeeze", "blurb" }))
	exports.SHOP_TIERS = SHOP_TIERS
	SHOP_TIER_ORDER = A.map(SHOP_TIERS, function(t)
		return t.id
	end)
	exports.SHOP_TIER_ORDER = SHOP_TIER_ORDER
	RATING_CONVERTER_WEEKS = Js.O({ energy = Js.alit(0.45, 0.6, 1) }, { "energy" })
	exports.RATING_CONVERTER_WEEKS = RATING_CONVERTER_WEEKS
	RATING_CONVERTER_TIERS = Js.O({ energy = Js.alit("starter", "pro", "world_class") }, { "energy" })
	exports.RATING_CONVERTER_TIERS = RATING_CONVERTER_TIERS
	BOOT_WEEKS_PER_MATCH = 0.3
	exports.BOOT_WEEKS_PER_MATCH = BOOT_WEEKS_PER_MATCH
	BOOT_MATCHES_MIN = 4
	exports.BOOT_MATCHES_MIN = BOOT_MATCHES_MIN
	BOOT_MATCHES_MAX = 120
	exports.BOOT_MATCHES_MAX = BOOT_MATCHES_MAX
	KIB_CAN_WAGE_WEEKS = Js.O({ basic = 2, premium = 1, elite = 2 }, { "basic", "premium", "elite" })
	exports.KIB_CAN_WAGE_WEEKS = KIB_CAN_WAGE_WEEKS
	BOOT_PRICE_REF_WAGE = typicalWeeklyWage("championship")
	exports.BOOT_PRICE_REF_WAGE = BOOT_PRICE_REF_WAGE
end
