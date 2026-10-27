--!nocheck
--!nolint
-- Generated from lib/star/sponsors.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_fame = import("lib/star/fame")
	local M_economy = import("lib/star/economy")
	local M_tuningStore = import("lib/star/tuningStore")
	local M_expectations = import("lib/star/expectations")
	local M_season = import("lib/star/season")
	local M_squadData = import("lib/star/squadData")
	local ownsWorking, SPONSOR_REQUIREMENTS, sponsorRequirementText, sponsorEligible, AMBITION_FEE_MULT, moneyFromRaw, sponsorFee, signSponsor, LABEL, objectiveLabel, makeObjective, progressObjectives, LONG_TERM_SPONSORS, sponsorTerm, rollSponsorSeason, attachObjective
	ownsWorking = function(career, category)
		do return A.some((if career.ownedItems ~= nil then career.ownedItems else Js.alit()), function(i)
			return ((i.category == category) and (not M_fame.isWornOut(i)))
		end) end
	end
	sponsorRequirementText = function(category)
		local r = SPONSOR_REQUIREMENTS[category]
		if (not r) then
			do return "" end
		end
		do return (M_fame.fameLevel(r.fame).name .. " (" .. Js.numstr(r.fame) .. " fame), " .. r.describe) end
	end
	exports.sponsorRequirementText = sponsorRequirementText
	sponsorEligible = function(category, career)
		local r = SPONSOR_REQUIREMENTS[category]
		if (not r) then
			do return false end
		end
		do return ((M_fame.fameOf(career) >= r.fame) and r.extra(career)) end
	end
	exports.sponsorEligible = sponsorEligible
	moneyFromRaw = function(raw, career)
		local wage = Math.max(M_economy.WAGE_FLOOR, ((function() local _v = career.contract; if _v == nil then return nil end; _v = _v.wage; return _v end)() or 0))
		do return Math.max(1, Math.round(((raw * M_tuningStore.getTuning("sponsors.feeWageWeeksPerUnit")) * wage))) end
	end
	sponsorFee = function(category, career)
		local r = SPONSOR_REQUIREMENTS[category]
		if (not r) then
			do return 0 end
		end
		local mult = (AMBITION_FEE_MULT[M_expectations.clubExpectation(career).ambition] or 1)
		local level = Math.min(((function() local _v = A.find(career.sponsors, function(s)
			return (s.category == category)
		end); if _v == nil then return nil end; _v = _v.level; return _v end)() or 1), M_tuningStore.getTuning("sponsors.upgradeMaxLevel"))
		local upgrade = Math.pow((1 + M_tuningStore.getTuning("sponsors.upgradeFeeMultiplier")), Math.max(0, (level - 1)))
		local raw = Math.max(1, Math.round((((r.baseFee + (M_fame.fameOf(career) / M_tuningStore.getTuning("sponsors.fameDivisor"))) * mult) * upgrade)))
		do return moneyFromRaw(raw, career) end
	end
	exports.sponsorFee = sponsorFee
	signSponsor = function(career, category)
		local idx = A.findIndex(career.sponsors, function(s)
			return (s.category == category)
		end)
		if (((idx < 0) or career.sponsors[idx + 1].active) or (not sponsorEligible(category, career))) then
			do return career end
		end
		local activated = A.map(career.sponsors, function(s, i)
			return (if (i == idx) then Js.ospread(s, Js.O({ active = true, level = (if s.level ~= nil then s.level else 1), termLeft = sponsorTerm(category) }, { "active", "level", "termLeft" })) else s)
		end)
		local sponsors = attachObjective(career, activated)
		do return Js.ospread(career, Js.O({ sponsors = sponsors, money = (career.money + sponsorFee(category, career)) }, { "sponsors", "money" })) end
	end
	exports.signSponsor = signSponsor
	objectiveLabel = function(o)
		do return LABEL[o.kind](o.target) end
	end
	exports.objectiveLabel = objectiveLabel
	makeObjective = function(career, index, rng, category)
		local kinds = Js.alit("goals", "assists", "appearances", "starMan", "rating", "goalStreak", "startStreak", "cleanSheets")
		local kind = kinds[math.floor((rng() * Js.alen(kinds))) + 1]
		local rep = Math.max(0.4, (career.starRating / 3))
		local seasonsMin = M_tuningStore.getTuning("sponsors.objectiveSeasonsMin")
		local seasonsMax = Math.max(seasonsMin, M_tuningStore.getTuning("sponsors.objectiveSeasonsMax"))
		local seasons = (seasonsMin + math.floor((rng() * ((seasonsMax - seasonsMin) + 1))))
		local baseFee = ((if Js.T(category) then (function() local _v = SPONSOR_REQUIREMENTS[category]; if _v == nil then return nil end; _v = _v.baseFee; return _v end)() else nil) or 12)
		local difficulty = (1 + (baseFee * M_tuningStore.getTuning("sponsors.objectiveDifficultyPerFee")))
		local streakDifficulty = Math.sqrt(difficulty)
		local target = (if (kind == "goals") then Math.max(4, Math.round((((M_tuningStore.getTuning("sponsors.objectiveGoalsBase") * rep) * seasons) * difficulty))) else (if (kind == "assists") then Math.max(3, Math.round((((M_tuningStore.getTuning("sponsors.objectiveAssistsBase") * rep) * seasons) * difficulty))) else (if (kind == "appearances") then Math.max(8, Math.round(((M_tuningStore.getTuning("sponsors.objectiveAppearancesBase") * seasons) * difficulty))) else (if (kind == "starMan") then Math.max(2, Math.round((((M_tuningStore.getTuning("sponsors.objectiveStarManBase") * rep) * seasons) * difficulty))) else (if (kind == "goalStreak") then Math.max(3, Math.round((M_tuningStore.getTuning("sponsors.objectiveGoalStreakBase") * streakDifficulty))) else (if (kind == "startStreak") then Math.max(5, Math.round((M_tuningStore.getTuning("sponsors.objectiveStartStreakBase") * streakDifficulty))) else (if (kind == "cleanSheets") then Math.max(3, Math.round(((M_tuningStore.getTuning("sponsors.objectiveCleanSheetsBase") * seasons) * streakDifficulty))) else (M_tuningStore.getTuning("sponsors.objectiveRatingBase") + Math.round((rng() * M_tuningStore.getTuning("sponsors.objectiveRatingSpread")))))))))))
		local rawBonus = Math.max(3, Math.round(((((M_tuningStore.getTuning("sponsors.objectiveBonusBase") + (index * M_tuningStore.getTuning("sponsors.objectiveBonusPerIndex"))) * rep) * seasons) * difficulty)))
		do return Js.O({ kind = kind, target = target, progress = 0, seasonsLeft = seasons, bonus = moneyFromRaw(rawBonus, career), done = false }, { "kind", "target", "progress", "seasonsLeft", "bonus", "done" }) end
	end
	exports.makeObjective = makeObjective
	progressObjectives = function(sponsors, stats, seasonStats, match)
		local earned = 0
		local completed = Js.alit()
		local startThreshold = M_tuningStore.getTuning("sponsors.startThresholdMinutes")
		local minutes = (if stats.minutes ~= nil then stats.minutes else 90)
		local started = (minutes >= startThreshold)
		local conceded = (if match then (if match.home then stats.awayScore else stats.homeScore) else nil)
		local next_ = A.map(sponsors, function(s)
			local o = s.objective
			if (((not s.active) or (not o)) or o.done) then
				do return s end
			end
			local progress = (if (o.kind == "goals") then (o.progress + stats.goals) else (if (o.kind == "assists") then (o.progress + stats.assists) else (if (o.kind == "appearances") then (o.progress + 1) else (if (o.kind == "starMan") then (o.progress + (if stats.starMan then 1 else 0)) else (if (o.kind == "rating") then Math.round(((if (seasonStats.ratingCount > 0) then (seasonStats.totalRating / seasonStats.ratingCount) else 0) * 10)) else (if (o.kind == "goalStreak") then (if (stats.goals > 0) then (o.progress + 1) else 0) else (if (o.kind == "startStreak") then (if started then (o.progress + 1) else 0) else (if (o.kind == "cleanSheets") then (if (conceded == 0) then (o.progress + 1) else o.progress) else o.progress))))))))
			if (progress >= o.target) then
				earned += o.bonus
				A.push(completed, (s.category .. ": " .. objectiveLabel(o) .. " — ★" .. Js.numstr(o.bonus)))
				local level = Math.min(M_tuningStore.getTuning("sponsors.upgradeMaxLevel"), ((if s.level ~= nil then s.level else 1) + 1))
				do return Js.ospread(s, Js.O({ level = level, objective = Js.ospread(o, Js.O({ progress = progress, done = true }, { "progress", "done" })) }, { "level", "objective" })) end
			end
			do return Js.ospread(s, Js.O({ objective = Js.ospread(o, Js.O({ progress = progress }, { "progress" })) }, { "objective" })) end
		end)
		do return Js.O({ sponsors = next_, earned = earned, completed = completed }, { "sponsors", "earned", "completed" }) end
	end
	exports.progressObjectives = progressObjectives
	sponsorTerm = function(category)
		do return (if A.includes(LONG_TERM_SPONSORS, category) then 2 else 1) end
	end
	exports.sponsorTerm = sponsorTerm
	rollSponsorSeason = function(career)
		local lapsed = Js.alit()
		local ended = Js.alit()
		local sponsors = A.map((if career.sponsors ~= nil then career.sponsors else Js.alit()), function(s)
			if (s.active and ((if s.termLeft ~= nil then s.termLeft else 1) <= 1)) then
				A.push(ended, (s.category .. ": deal ended — re-sign if you still qualify"))
				do return Js.ospread(s, Js.O({ active = false, objective = nil, termLeft = nil }, { "active", "objective", "termLeft" })) end
			end
			if (s.active and (type(s.termLeft) == "number")) then
				s = Js.ospread(s, Js.O({ termLeft = (s.termLeft - 1) }, { "termLeft" }))
			end
			local o = s.objective
			if ((not s.active) or (not o)) then
				do return s end
			end
			if o.done then
				do return Js.ospread(s, Js.O({ objective = nil }, { "objective" })) end
			end
			local seasonsLeft = (o.seasonsLeft - 1)
			if (seasonsLeft > 0) then
				do return Js.ospread(s, Js.O({ objective = Js.ospread(o, Js.O({ seasonsLeft = seasonsLeft }, { "seasonsLeft" })) }, { "objective" })) end
			end
			A.push(lapsed, (s.category .. ": " .. objectiveLabel(o) .. " — not delivered"))
			do return Js.ospread(s, Js.O({ active = false, objective = nil }, { "active", "objective" })) end
		end)
		local seasonFees = A.map(A.filter(sponsors, function(s)
			return s.active
		end), function(s)
			return Js.O({ category = s.category, fee = sponsorFee(s.category, career) }, { "category", "fee" })
		end)
		do return Js.O({ sponsors = sponsors, lapsed = Js.aspread(lapsed, ended), standingHit = (Js.alen(lapsed) * M_tuningStore.getTuning("sponsors.lapsedStandingHit")), seasonFees = seasonFees }, { "sponsors", "lapsed", "standingHit", "seasonFees" }) end
	end
	exports.rollSponsorSeason = rollSponsorSeason
	attachObjective = function(career, sponsors)
		do return A.map(sponsors, function(s, i)
			if ((not s.active) or s.objective) then
				do return s end
			end
			local rng = M_season.mulberry32((((career.season * 4211) + (career.week * 17)) + M_squadData.clubNameSeed(s.category)))
			do return Js.ospread(s, Js.O({ objective = makeObjective(career, i, rng, s.category) }, { "objective" })) end
		end) end
	end
	exports.attachObjective = attachObjective
	SPONSOR_REQUIREMENTS = Js.O({ Boots = Js.O({ fame = 10, baseFee = 6, extra = function(c)
		return (((c.seasonStats.goals + c.seasonStats.assists) >= 3) or ((c.careerStats.goals + c.careerStats.assists) >= 10))
	end, describe = "3 goal involvements this season (or 10 for your career)" }, { "fame", "baseFee", "extra", "describe" }), ["Sports Drink"] = Js.O({ fame = 10, baseFee = 7, extra = function(c)
		return (c.seasonStats.appearances >= 6)
	end, describe = "6 appearances this season" }, { "fame", "baseFee", "extra", "describe" }), Food = Js.O({ fame = 10, baseFee = 8, extra = function(c)
		return (c.happiness >= 45)
	end, describe = "45 happiness — a face people like seeing" }, { "fame", "baseFee", "extra", "describe" }), ["Sports Clothing"] = Js.O({ fame = 25, baseFee = 10, extra = function(c)
		return (c.relationships.fans >= 45)
	end, describe = "45 Fans relationship" }, { "fame", "baseFee", "extra", "describe" }), ["Casual Clothing"] = Js.O({ fame = 25, baseFee = 12, extra = function(c)
		return (c.relationships.fans >= 55)
	end, describe = "55 Fans relationship" }, { "fame", "baseFee", "extra", "describe" }), Electronics = Js.O({ fame = 40, baseFee = 16, extra = function(c)
		return (Js.alen(c.trophies) >= 1)
	end, describe = "a trophy on the cabinet" }, { "fame", "baseFee", "extra", "describe" }), Cosmetics = Js.O({ fame = 40, baseFee = 14, extra = function(c)
		return (c.relationships.fans >= 50)
	end, describe = "50 Fans relationship" }, { "fame", "baseFee", "extra", "describe" }), Watch = Js.O({ fame = 60, baseFee = 20, extra = function(c)
		return ownsWorking(c, "vehicle")
	end, describe = "a car (or better) in working order" }, { "fame", "baseFee", "extra", "describe" }), Jewelry = Js.O({ fame = 60, baseFee = 26, extra = function(c)
		return ownsWorking(c, "property")
	end, describe = "a property of your own" }, { "fame", "baseFee", "extra", "describe" }), Car = Js.O({ fame = 80, baseFee = 34, extra = function(c)
		local amb = M_expectations.clubExpectation(c).ambition
		do return ((amb == "Title") or (amb == "Europe")) end
	end, describe = "playing for a club chasing the title or Europe" }, { "fame", "baseFee", "extra", "describe" }) }, { "Boots", "Sports Drink", "Food", "Sports Clothing", "Casual Clothing", "Electronics", "Cosmetics", "Watch", "Jewelry", "Car" })
	AMBITION_FEE_MULT = Js.O({ Title = M_tuningStore.getTuning("sponsors.ambitionTitle"), Europe = M_tuningStore.getTuning("sponsors.ambitionEurope"), ["Mid-table"] = M_tuningStore.getTuning("sponsors.ambitionMidTable"), Survival = M_tuningStore.getTuning("sponsors.ambitionSurvival") }, { "Title", "Europe", "Mid-table", "Survival" })
	LABEL = Js.O({ goals = function(n)
		return ("Score " .. Js.numstr(n) .. " goals")
	end, assists = function(n)
		return ("Register " .. Js.numstr(n) .. " assists")
	end, appearances = function(n)
		return ("Play " .. Js.numstr(n) .. " matches")
	end, starMan = function(n)
		return ("Win " .. Js.numstr(n) .. " Star Man awards")
	end, rating = function(n)
		return ("Average " .. N.toFixed((n / 10), 1) .. " across the season")
	end, goalStreak = function(n)
		return ("Score in " .. Js.numstr(n) .. " consecutive appearances")
	end, startStreak = function(n)
		return ("Start " .. Js.numstr(n) .. " matches in a row")
	end, cleanSheets = function(n)
		return ("Keep " .. Js.numstr(n) .. " clean sheets while you're on the pitch")
	end }, { "goals", "assists", "appearances", "starMan", "rating", "goalStreak", "startStreak", "cleanSheets" })
	LONG_TERM_SPONSORS = Js.alit("Watch", "Jewelry", "Car")
	exports.LONG_TERM_SPONSORS = LONG_TERM_SPONSORS
end
