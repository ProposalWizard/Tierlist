--!nocheck
--!nolint
-- Generated from lib/star/starPoints.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_xpConfig = import("lib/star/xpConfig")
	local M_clubReputation = import("lib/star/clubReputation")
	local M_footballClubDatabase = import("lib/star/data/footballClubDatabase")
	local M_calendar = import("lib/star/calendar")
	local M_records = import("lib/star/records")
	local M_trainingLevels = import("lib/star/trainingLevels")
	local M_fame = import("lib/star/fame")
	local M_achievements = import("lib/star/achievements")
	local tierMult, SP_SCALE, S_, RATING_BONUS_FROM, EMPTY, ledgerOf, emptyLedger, clubStature, tierOfFixture, tallyFor, withEstimates, tallySp, matchStarPoints, ledgerAfterMatch, SKILLS, DIV_ORDER, count, ownsClub, topItems, ownsIsland, TIER_NAME, pointLines, livePoints, MAX_LEVEL, POINTS_CAP_LEVEL, STAR_CURVES, STAR_CURVE, EARLY_LEVEL_COST, CURVE_KNEE, twoFigures, levelCosts, LEVEL_COST, LEVEL_THRESHOLDS, levelFromPoints, pointsForLevel, STAR_TITLES, starTitle, MAX_RISE_PER_MATCH, matchesPlayed, POOR_MATCH_RATING, GOOD_MATCH_RATING, SLUMP_SHARE, SLUMP_MATCHES, slumpAfterMatch, GATE_GAMES, gamesAtOrAbove, MAJOR, STAR_GATES, LEGEND, LEGEND_TASKS, isOldStarScale, bestOf, starLevel, starStatus, starsNow, starGain, withStars, ledgerFromHistory
	tierMult = function(tier)
		local m = M_xpConfig.xp().mult
		if (tier == "europe") then
			do return m.champions_league end
		end
		if (tier == "europa") then
			do return m.europa_league end
		end
		if (tier == "conference") then
			do return m.conference_league end
		end
		if (tier == "intl") then
			do return m.intl end
		end
		if (tier == "cup") then
			do return 1 end
		end
		if S.startsWith(tier, "cup_") then
			do return (m[S.slice(tier, 4)] or 1) end
		end
		do return (if m[tier] ~= nil then m[tier] else 1) end
	end
	exports.tierMult = tierMult
	ledgerOf = function(career)
		do return (if career.starLedger ~= nil then career.starLedger else ledgerFromHistory(career)) end
	end
	exports.ledgerOf = ledgerOf
	clubStature = function(club)
		if (not Js.T(club)) then
			do return 0 end
		end
		do return Math.max(M_clubReputation.clubReputation(club), (((function() local _v = M_footballClubDatabase.CLUB_DATABASE[club]; if _v == nil then return nil end; _v = _v.currentReputation; return _v end)() or 0) * 10)) end
	end
	exports.clubStature = clubStature
	tierOfFixture = function(career, fixture)
		local kind = (if fixture.kind ~= nil then fixture.kind else "league")
		if (kind == "europe") then
			if (fixture.competition == "Europa League") then
				do return "europa" end
			end
			if (fixture.competition == "Conference League") then
				do return "conference" end
			end
			do return "europe" end
		end
		if (kind == "international") then
			do return "intl" end
		end
		if (kind == "cup") then
			do return ("cup_" .. M_calendar.divisionOf(career)) end
		end
		do return M_calendar.divisionOf(career) end
	end
	exports.tierOfFixture = tierOfFixture
	tallyFor = function(career, stats)
		local won = (stats.homeScore > stats.awayScore)
		local drew = (stats.homeScore == stats.awayScore)
		do return Js.O({ apps = 1, starts = (if (career.status == "Substitute") then 0 else 1), wins = (if won then 1 else 0), draws = (if drew then 1 else 0), goals = stats.goals, assists = stats.assists, hatTricks = (if (stats.goals >= 3) then 1 else 0), starMan = (if stats.starMan then 1 else 0), high = (if (stats.rating >= 8) then 1 else 0), minutes = Math.max(0, Math.min(120, (if stats.minutes ~= nil then stats.minutes else (if (career.status == "Substitute") then 25 else 90)))), ratingPts = Math.max(0, (stats.rating - RATING_BONUS_FROM)) }, { "apps", "starts", "wins", "draws", "goals", "assists", "hatTricks", "starMan", "high", "minutes", "ratingPts" }) end
	end
	withEstimates = function(t)
		do return Js.ospread(t, Js.O({ minutes = (if t.minutes ~= nil then t.minutes else ((t.starts * 90) + ((t.apps - t.starts) * 25))), ratingPts = (if t.ratingPts ~= nil then t.ratingPts else ((t.high * 2.5) + ((t.apps - t.high) * 0.8))) }, { "minutes", "ratingPts" })) end
	end
	tallySp = function(t)
		local m = M_xpConfig.xp().match
		local minutes = (if t.minutes ~= nil then t.minutes else ((t.starts * 90) + ((t.apps - t.starts) * 25)))
		local ratingPts = (if t.ratingPts ~= nil then t.ratingPts else ((t.high * 2.5) + ((t.apps - t.high) * 0.8)))
		do return Math.round(((((((minutes * m.perMinute) + (t.wins * m.win)) + (t.draws * m.draw)) + (t.goals * m.goal)) + (t.assists * m.assist)) + (ratingPts * m.ratingPerPoint))) end
	end
	matchStarPoints = function(career, fixture, stats)
		local tier = tierOfFixture(career, fixture)
		local base = tallySp(tallyFor(career, stats))
		do return Js.O({ base = base, mult = tierMult(tier), total = Math.round((base * tierMult(tier))), tier = tier }, { "base", "mult", "total", "tier" }) end
	end
	exports.matchStarPoints = matchStarPoints
	ledgerAfterMatch = function(career, fixture, stats)
		local led = ledgerOf(career)
		local tier = tierOfFixture(career, fixture)
		local add = tallyFor(career, stats)
		local was = withEstimates((if led.tiers[tier] ~= nil then led.tiers[tier] else EMPTY))
		local now = Js.Object.fromEntries(A.map(Js.Object.keys(EMPTY), function(k)
			return Js.alit(k, ((if was[k] ~= nil then was[k] else 0) + (if add[k] ~= nil then add[k] else 0)))
		end))
		do return Js.ospread(led, Js.O({ tiers = Js.ospread(led.tiers, (function() local _o = Js.O({}, nil); _o[Js.key(tier)] = now; return _o end)()), uclApps = (led.uclApps + (if (fixture.competition == "Champions League") then 1 else 0)) }, { "tiers", "uclApps" }), slumpAfterMatch(career, led, stats, Math.round((tallySp(add) * tierMult(tier))))) end
	end
	exports.ledgerAfterMatch = ledgerAfterMatch
	pointLines = function(career)
		local led = ledgerOf(career)
		local out = Js.alit()
		local add = function(key, cat, label, sp, n)
			if (sp > 0) then
				A.push(out, Js.O({ key = key, cat = cat, label = label, sp = sp, n = n }, { "key", "cat", "label", "sp", "n" }))
			end
		end
		do
			local _arr1 = Js.Object.entries(led.tiers)
			local _i2 = 0
			while _i2 < Js.alen(_arr1) do
				_i2 += 1
				local _e3 = _arr1[_i2]
				local tier = _e3[1]
				local t = _e3[2]
				add(("match:" .. tier), "match", ("Matches · " .. TIER_NAME[tier]), Math.round((tallySp(t) * tierMult(tier))), t.apps)
			end
		end
		local X = M_xpConfig.xp()
		local byComp = Js.Map.new()
		do
			local _arr4 = career.trophies
			local _i5 = 0
			while _i5 < Js.alen(_arr4) do
				_i5 += 1
				local t = _arr4[_i5]
				byComp:set(t.competition, ((byComp:get(t.competition) or 0) + 1))
			end
		end
		do
			local _arr6 = Js.Array.from(byComp)
			local _i7 = 0
			while _i7 < Js.alen(_arr6) do
				_i7 += 1
				local _e8 = _arr6[_i7]
				local comp = _e8[1]
				local n = _e8[2]
				add(("trophy:" .. comp), "trophies", comp, (n * (if X.trophies[comp] ~= nil then X.trophies[comp] else X.otherTrophy)), n)
			end
		end
		local ups = (if led.promotedFrom ~= nil then led.promotedFrom else Js.alit())
		add("promotion", "trophies", "Promotion", Math.round(A.reduce(ups, function(s, d)
			return (s + ((X.trophies[M_calendar.leagueNameFor(d)] or 0) * X.promotionShare))
		end, 0)), Js.alen(ups))
		local byAward = Js.Map.new()
		do
			local _arr9 = (if career.awards ~= nil then career.awards else Js.alit())
			local _i10 = 0
			while _i10 < Js.alen(_arr9) do
				_i10 += 1
				local a = _arr9[_i10]
				local row = X.awards[a.kind]
				if (not row) then
					do continue end
				end
				local was = (byAward:get(a.kind) or Js.O({ sp = 0, n = 0 }, { "sp", "n" }))
				byAward:set(a.kind, Js.O({ sp = (was.sp + (row[(if a.division ~= nil then a.division else "national_league")] or 0)), n = (was.n + 1) }, { "sp", "n" }))
			end
		end
		do
			local _arr11 = Js.Array.from(byAward)
			local _i12 = 0
			while _i12 < Js.alen(_arr11) do
				_i12 += 1
				local _e13 = _arr11[_i12]
				local kind = _e13[1]
				local v = _e13[2]
				add(("award:" .. kind), "awards", kind, v.sp, v.n)
			end
		end
		add("ballon", "awards", "Ballon d'Or placings", A.reduce(led.ballonRanks, function(s, r)
			return (s + (if (r == 1) then X.ballon.win else (if (r <= 3) then X.ballon.top3 else X.ballon.top10)))
		end, 0), Js.alen(led.ballonRanks))
		add("caps", "milestones", "First cap", (if ((if career.caps ~= nil then career.caps else 0) >= 1) then X.milestones.firstCap else 0))
		add("pl-debut", "milestones", "Premier League debut", (if (((function() local _v = led.tiers.premier; if _v == nil then return nil end; _v = _v.apps; return _v end)() or 0) > 0) then X.milestones.premierDebut else 0))
		local beaten = A.filter(M_records.RECORDS, function(r)
			return M_records.recordBeaten(career, r)
		end)
		add("records", "milestones", "Records broken", A.reduce(beaten, function(s, r)
			return (s + (if X.records[r.id] ~= nil then X.records[r.id] else 0))
		end, 0), Js.alen(beaten))
		local ach = career.achievements
		add("achievements", "milestones", "Achievements", A.reduce(ach, function(s, id)
			return (s + M_xpConfig.achievementXp(id, X))
		end, 0), Js.alen(A.filter(ach, function(id)
			return (M_xpConfig.achievementXp(id, X) > 0)
		end)))
		local tStars = A.reduce(SKILLS, function(s, k)
			return (s + M_trainingLevels.totalStars(M_trainingLevels.starsOf(career, k)))
		end, 0)
		add("training", "milestones", "Training stars", (tStars * X.trainingStar), tStars)
		local fame = M_fame.fameOf(career)
		add("fame", "status", "Fame", A.reduce(X.fame, function(s, _p14)
			local min = _p14[1]
			local sp = _p14[2]
			return (if (fame >= min) then sp else s)
		end, 0))
		add("owner", "status", "Owning a club", (if ownsClub(career) then X.clubOwner else 0))
		local top = topItems(career)
		add("items", "status", "Top-level things you own", A.reduce(top, function(s, i)
			return (s + (if ((if i.baseId ~= nil then i.baseId else i.id) == "island") then X.island else X.topItem))
		end, 0), Js.alen(top))
		add("president", "status", "A presidency", (if Js.T((function() local _v = career.governingBodyPresidencies; if _v == nil then return nil end; _v = Js.len(_v); return _v end)()) then X.president else 0))
		do return out end
	end
	exports.pointLines = pointLines
	livePoints = function(career)
		local b = Js.O({ match = 0, trophies = 0, awards = 0, milestones = 0, status = 0 }, { "match", "trophies", "awards", "milestones", "status" })
		do
			local _arr15 = pointLines(career)
			local _i16 = 0
			while _i16 < Js.alen(_arr15) do
				_i16 += 1
				local l = _arr15[_i16]
				b[l.cat] += l.sp
			end
		end
		do return b end
	end
	exports.livePoints = livePoints
	levelCosts = function(curve)
		if curve == nil then curve = STAR_CURVE end
		local _d17 = STAR_CURVES[curve]
		local start = _d17.start
		local grow = _d17.grow
		local growTop = _d17.growTop
		local out = Js.alit(0)
		for L = 1, POINTS_CAP_LEVEL - 1 do
			A.set(out, L, (if (L <= Js.alen(EARLY_LEVEL_COST)) then EARLY_LEVEL_COST[L] else twoFigures(((start * Math.pow(grow, (Math.min(L, CURVE_KNEE) - 4))) * Math.pow(growTop, Math.max(0, (L - CURVE_KNEE)))))))
		end
		do return out end
	end
	exports.levelCosts = levelCosts
	levelFromPoints = function(sp)
		for L = POINTS_CAP_LEVEL, 1, -1 do
			if (sp >= LEVEL_THRESHOLDS[L + 1]) then
				do return L end
			end
		end
		do return 1 end
	end
	exports.levelFromPoints = levelFromPoints
	pointsForLevel = function(level)
		do return LEVEL_THRESHOLDS[Math.max(1, Math.min(POINTS_CAP_LEVEL, math.floor(level))) + 1] end
	end
	exports.pointsForLevel = pointsForLevel
	starTitle = function(level)
		do return STAR_TITLES[Math.max(0, Math.min(10, math.floor((level / 10)))) + 1] end
	end
	exports.starTitle = starTitle
	matchesPlayed = function(led)
		do return A.reduce(Js.Object.values(led.tiers), function(s, t)
			return (s + ((function() local _v = t; if _v == nil then return nil end; _v = _v.apps; return _v end)() or 0))
		end, 0) end
	end
	exports.matchesPlayed = matchesPlayed
	slumpAfterMatch = function(career, led, stats, matchSp)
		local was = (if led.slump ~= nil then led.slump else Js.O({ debt = 0, streak = 0 }, { "debt", "streak" }))
		local level = starLevel(career)
		if ((stats.rating < POOR_MATCH_RATING) and (level < POINTS_CAP_LEVEL)) then
			local cost = LEVEL_COST[Math.max(1, Math.min((POINTS_CAP_LEVEL - 1), level)) + 1]
			do return Js.O({ slump = Js.O({ debt = ((was.debt + matchSp) + Math.round((cost * SLUMP_SHARE))), streak = (was.streak + 1) }, { "debt", "streak" }) }, { "slump" }) end
		end
		if ((stats.rating >= GOOD_MATCH_RATING) and (was.streak > 0)) then
			do return Js.O({ slump = Js.ospread(was, Js.O({ streak = 0 }, { "streak" })) }, { "slump" }) end
		end
		do return (if led.slump then Js.O({ slump = was }, { "slump" }) else nil) end
	end
	isOldStarScale = function(career)
		if career.starBest then
			do return (career.starBest.scale ~= MAX_LEVEL) end
		end
		do return (career.stars ~= nil) end
	end
	exports.isOldStarScale = isOldStarScale
	bestOf = function(career)
		local b = career.starBest
		if (not isOldStarScale(career)) then
			do return b end
		end
		local level = Math.max(1, Math.min(MAX_LEVEL, Math.round(((((function() local _v = b; if _v == nil then return nil end; _v = _v.stars; return _v end)() or career.stars) or 1) * 10))))
		do return Js.O({ match = (((function() local _v = b; if _v == nil then return nil end; _v = _v.match; return _v end)() or 0) * S_), trophies = (((function() local _v = b; if _v == nil then return nil end; _v = _v.trophies; return _v end)() or 0) * S_), awards = (((function() local _v = b; if _v == nil then return nil end; _v = _v.awards; return _v end)() or 0) * S_), milestones = (((function() local _v = b; if _v == nil then return nil end; _v = _v.milestones; return _v end)() or 0) * S_), status = (((function() local _v = b; if _v == nil then return nil end; _v = _v.status; return _v end)() or 0) * S_), stars = level, legend = ((function() local _v = b; if _v == nil then return nil end; _v = _v.legend; return _v end)() or Js.alit()), scale = MAX_LEVEL }, { "match", "trophies", "awards", "milestones", "status", "stars", "legend", "scale" }) end
	end
	exports.bestOf = bestOf
	starLevel = function(career)
		do return (if isOldStarScale(career) then bestOf(career).stars else (if career.stars ~= nil then career.stars else 1)) end
	end
	exports.starLevel = starLevel
	starStatus = function(career)
		local led = ledgerOf(career)
		local converting = isOldStarScale(career)
		local best = bestOf(career)
		local live = livePoints(career)
		local points = Js.O({ match = Math.max(live.match, ((function() local _v = best; if _v == nil then return nil end; _v = _v.match; return _v end)() or 0)), trophies = Math.max(live.trophies, ((function() local _v = best; if _v == nil then return nil end; _v = _v.trophies; return _v end)() or 0)), awards = Math.max(live.awards, ((function() local _v = best; if _v == nil then return nil end; _v = _v.awards; return _v end)() or 0)), milestones = Math.max(live.milestones, ((function() local _v = best; if _v == nil then return nil end; _v = _v.milestones; return _v end)() or 0)), status = Math.max(live.status, ((function() local _v = best; if _v == nil then return nil end; _v = _v.status; return _v end)() or 0)) }, { "match", "trophies", "awards", "milestones", "status" })
		local earned = ((((points.match + points.trophies) + points.awards) + points.milestones) + points.status)
		local carry = (if converting then Math.max(0, (pointsForLevel(Math.min(POINTS_CAP_LEVEL, ((function() local _v = best; if _v == nil then return nil end; _v = _v.stars; return _v end)() or 1))) - earned)) else ((function() local _v = best; if _v == nil then return nil end; _v = _v.carry; return _v end)() or 0))
		local total = Math.max(0, ((earned + carry) - ((function() local _v = led.slump; if _v == nil then return nil end; _v = _v.debt; return _v end)() or 0)))
		local ungated = levelFromPoints(total)
		local gate = (A.find(STAR_GATES, function(g)
			return (not g.open(career, led))
		end) or nil)
		local stars = (if gate then Math.min(ungated, gate.cap) else ungated)
		local legendDone = Js.Array.from(Js.Set.new(Js.aspread(((function() local _v = best; if _v == nil then return nil end; _v = _v.legend; return _v end)() or Js.alit()), A.map(A.filter(LEGEND_TASKS, function(t)
			return t.done(career, led)
		end), function(t)
			return t.id
		end))))
		if (stars >= POINTS_CAP_LEVEL) then
			stars = (POINTS_CAP_LEVEL + math.floor(((10 * Js.alen(legendDone)) / Js.alen(LEGEND_TASKS))))
		end
		stars = Math.min(MAX_LEVEL, stars)
		local apps = matchesPlayed(led)
		local achNow = ((function() local _v = A.find(pointLines(career), function(l)
			return (l.key == "achievements")
		end); if _v == nil then return nil end; _v = _v.sp; return _v end)() or 0)
		local newWindow = (not ((function() local _v = best; if _v == nil then return nil end; _v = _v.win; return _v end)() and (best.win.apps == apps)))
		local win = (if ((not newWindow) and (function() local _v = best; if _v == nil then return nil end; _v = _v.win; return _v end)()) then Js.ospread(best.win, Js.O({ ach = (if best.win.ach ~= nil then best.win.ach else achNow) }, { "ach" })) else Js.O({ apps = apps, base = ((function() local _v = best; if _v == nil then return nil end; _v = _v.stars; return _v end)() or stars), ach = achNow }, { "apps", "base", "ach" }))
		local reach = stars
		local achSince = Math.max(0, (achNow - (if win.ach ~= nil then win.ach else achNow)))
		local achBase = (if ((win.base < POINTS_CAP_LEVEL) and (achSince > 0)) then Math.max(win.base, levelFromPoints((pointsForLevel(win.base) + achSince))) else win.base)
		stars = Math.min(stars, (achBase + MAX_RISE_PER_MATCH))
		local banked = ((function() local _v = best; if _v == nil then return nil end; _v = _v.stars; return _v end)() or 1)
		local slipping = (((newWindow and (not converting)) and (banked < POINTS_CAP_LEVEL)) and (((function() local _v = led.slump; if _v == nil then return nil end; _v = _v.streak; return _v end)() or 0) >= SLUMP_MATCHES))
		stars = Math.min(MAX_LEVEL, Math.max(stars, Math.max(1, (banked - (if slipping then 1 else 0)))))
		local held = Math.max(0, (reach - stars))
		local toNext = 0
		local spToNext = 0
		local carried = 0
		if (held > 0) then
			toNext = 1
			carried = (if (stars < POINTS_CAP_LEVEL) then Math.max(0, (total - pointsForLevel((stars + 1)))) else 0)
		elseif (stars >= POINTS_CAP_LEVEL) then
			toNext = (if (stars >= MAX_LEVEL) then 1 else math.fmod(((10 * Js.alen(legendDone)) / Js.alen(LEGEND_TASKS)), 1))
		elseif (gate and (stars >= gate.cap)) then
			toNext = 1
		else
			local from = pointsForLevel(stars)
			local to = pointsForLevel((stars + 1))
			toNext = Math.max(0, Math.min(1, ((total - from) / Math.max(1, (to - from)))))
			spToNext = Math.max(0, (to - total))
		end
		do return Js.O({ stars = stars, points = points, total = total, ungated = ungated, gate = (if ((gate and (stars >= gate.cap)) and (not Js.T(held))) then gate else nil), toNext = toNext, spToNext = spToNext, legendDone = legendDone, carry = carry, held = held, carried = carried, win = win }, { "stars", "points", "total", "ungated", "gate", "toNext", "spToNext", "legendDone", "carry", "held", "carried", "win" }) end
	end
	exports.starStatus = starStatus
	starsNow = function(career)
		do return starStatus(career).stars end
	end
	exports.starsNow = starsNow
	starGain = function(before, after)
		local a = starStatus(before)
		local b = starStatus(after)
		local total = Math.max(0, (b.total - a.total))
		local was = Js.Map.new(A.map(pointLines(before), function(l)
			return Js.alit(l.key, l)
		end))
		local lines = Js.alit()
		do
			local _arr18 = pointLines(after)
			local _i19 = 0
			while _i19 < Js.alen(_arr18) do
				_i19 += 1
				local l = _arr18[_i19]
				if (b.points[l.cat] <= a.points[l.cat]) then
					do continue end
				end
				local prev = was:get(l.key)
				local sp = (l.sp - ((function() local _v = prev; if _v == nil then return nil end; _v = _v.sp; return _v end)() or 0))
				if (sp <= 0) then
					do continue end
				end
				local n = (if (l.n ~= nil) then (l.n - ((function() local _v = prev; if _v == nil then return nil end; _v = _v.n; return _v end)() or 0)) else nil)
				A.push(lines, Js.ospread(l, Js.O({ sp = sp, n = n }, { "sp", "n" })))
			end
		end
		do return Js.O({ total = total, lines = lines }, { "total", "lines" }) end
	end
	exports.starGain = starGain
	withStars = function(career)
		local led0 = ledgerOf(career)
		local rep = clubStature(career.player.club)
		local led = (if (rep > 0) then Js.ospread(led0, Js.O({ firstRep = (if led0.firstRep ~= nil then led0.firstRep else rep), maxRep = Math.max((if led0.maxRep ~= nil then led0.maxRep else 0), rep) }, { "firstRep", "maxRep" })) else led0)
		local div = (if Js.T(career.player.club) then M_calendar.divisionOf(career) else nil)
		local awards = (if ((function() local _r = career.awards; if _r == nil then return nil end; return A.some(_r, function(a)
			return (not Js.T(a.division))
		end) end)() and Js.T(div)) then A.map(career.awards, function(a)
			return (if Js.T(a.division) then a else Js.ospread(a, Js.O({ division = div }, { "division" })))
		end) else career.awards)
		local next_ = Js.ospread(career, Js.O({ starLedger = led, awards = awards }, { "starLedger", "awards" }))
		local st = starStatus(next_)
		local dropped = (st.stars < ((function() local _v = bestOf(career); if _v == nil then return nil end; _v = _v.stars; return _v end)() or st.stars))
		if (dropped and led.slump) then
			next_.starLedger = Js.ospread(led, Js.O({ slump = Js.ospread(led.slump, Js.O({ streak = 0 }, { "streak" })) }, { "slump" }))
		end
		do return Js.ospread(next_, Js.O({ stars = st.stars, starBest = Js.ospread(st.points, Js.O({ stars = st.stars, legend = st.legendDone, scale = MAX_LEVEL }, { "stars", "legend", "scale" }), (if (st.carry > 0) then Js.O({ carry = st.carry }, { "carry" }) else Js.O({}, nil)), Js.O({ win = st.win }, { "win" })) }, { "stars", "starBest" })) end
	end
	exports.withStars = withStars
	ledgerFromHistory = function(career)
		local cs = career.careerStats
		local led = emptyLedger()
		if ((cs.appearances > 0) and Js.T(career.player.club)) then
			local avg = (if (cs.ratingCount > 0) then (cs.totalRating / cs.ratingCount) else 6.5)
			led.tiers[M_calendar.divisionOf(career)] = Js.O({ apps = cs.appearances, starts = Math.round((cs.appearances * 0.8)), wins = Math.round((cs.appearances * 0.4)), draws = Math.round((cs.appearances * 0.25)), goals = cs.goals, assists = cs.assists, hatTricks = cs.hatTricks, starMan = cs.starMan, high = (if (avg >= 7.5) then Math.round((cs.appearances * 0.3)) else Math.round((cs.appearances * 0.1))) }, { "apps", "starts", "wins", "draws", "goals", "assists", "hatTricks", "starMan", "high" })
		end
		led.ballonRanks = Js.Array.from(Js.O({ length = career.ballonDorWins }, { "length" }), function()
			return 1
		end)
		if A.some(career.trophies, function(t)
			return (t.competition == "Champions League")
		end) then
			led.uclApps = 1
		end
		local reps = A.filter(Js.aspread(A.map((if career.seasonArchive ~= nil then career.seasonArchive else Js.alit()), function(r)
			return clubStature(r.club)
		end), Js.alit(clubStature(career.player.club))), function(r)
			return (r > 0)
		end)
		if Js.T(Js.alen(reps)) then
			led.firstRep = reps[1]
			led.maxRep = Math.max(Js.unpack(reps))
		end
		do return led end
	end
	exports.ledgerFromHistory = ledgerFromHistory
	Js.reexport(exports, M_xpConfig, { ["xp"] = "xp", ["setXpConfig"] = "setXpConfig", ["DEFAULT_XP"] = "DEFAULT_XP", ["achievementXp"] = "achievementXp" })
	SP_SCALE = 120
	exports.SP_SCALE = SP_SCALE
	S_ = SP_SCALE
	RATING_BONUS_FROM = 6
	exports.RATING_BONUS_FROM = RATING_BONUS_FROM
	EMPTY = Js.O({ apps = 0, starts = 0, wins = 0, draws = 0, goals = 0, assists = 0, hatTricks = 0, starMan = 0, high = 0, minutes = 0, ratingPts = 0 }, { "apps", "starts", "wins", "draws", "goals", "assists", "hatTricks", "starMan", "high", "minutes", "ratingPts" })
	emptyLedger = function()
		return Js.O({ tiers = Js.O({}, nil), uclApps = 0, promotions = 0, ballonRanks = Js.alit() }, { "tiers", "uclApps", "promotions", "ballonRanks" })
	end
	exports.emptyLedger = emptyLedger
	SKILLS = Js.alit("pace", "power", "technique", "vision", "freeKick")
	DIV_ORDER = Js.alit("national_league", "league_two", "league_one", "championship", "premier")
	count = function(career, competition)
		return Js.alen(A.filter(career.trophies, function(t)
			return (t.competition == competition)
		end))
	end
	ownsClub = function(career)
		return A.some((if career.investments ~= nil then career.investments else Js.alit()), function(i)
			return (i.percent >= 50.1)
		end)
	end
	topItems = function(career)
		return A.filter((if career.ownedItems ~= nil then career.ownedItems else Js.alit()), function(i)
			return (i.level == 5)
		end)
	end
	ownsIsland = function(career)
		return A.some(topItems(career), function(i)
			return ((if i.baseId ~= nil then i.baseId else i.id) == "island")
		end)
	end
	TIER_NAME = Js.O({ national_league_north = "National League North", national_league_south = "National League South", national_league = "National League", league_two = "League Two", league_one = "League One", championship = "Championship", premier = "Premier League", cup = "Cups", intl = "Internationals", europe = "Champions League", europa = "Europa League", conference = "Conference League", cup_national_league_north = "Cups (National League North)", cup_national_league_south = "Cups (National League South)", cup_national_league = "Cups (National League)", cup_league_two = "Cups (League Two)", cup_league_one = "Cups (League One)", cup_championship = "Cups (Championship)", cup_premier = "Cups (Premier League)" }, { "national_league_north", "national_league_south", "national_league", "league_two", "league_one", "championship", "premier", "cup", "intl", "europe", "europa", "conference", "cup_national_league_north", "cup_national_league_south", "cup_national_league", "cup_league_two", "cup_league_one", "cup_championship", "cup_premier" })
	MAX_LEVEL = 100
	exports.MAX_LEVEL = MAX_LEVEL
	POINTS_CAP_LEVEL = 90
	exports.POINTS_CAP_LEVEL = POINTS_CAP_LEVEL
	STAR_CURVES = Js.O({ gentle = Js.O({ start = 12000, grow = 1.065, growTop = 1.04 }, { "start", "grow", "growTop" }), recommended = Js.O({ start = 15000, grow = 1.075, growTop = 1.02 }, { "start", "grow", "growTop" }), brutal = Js.O({ start = 20000, grow = 1.085, growTop = 1.02 }, { "start", "grow", "growTop" }) }, { "gentle", "recommended", "brutal" })
	exports.STAR_CURVES = STAR_CURVES
	STAR_CURVE = "recommended"
	exports.STAR_CURVE = STAR_CURVE
	EARLY_LEVEL_COST = Js.alit()
	exports.EARLY_LEVEL_COST = EARLY_LEVEL_COST
	CURVE_KNEE = 60
	exports.CURVE_KNEE = CURVE_KNEE
	twoFigures = function(n)
		local p = Math.pow(10, (math.floor(Math.log10(n)) - 1))
		do return (Math.round((n / p)) * p) end
	end
	LEVEL_COST = levelCosts()
	exports.LEVEL_COST = LEVEL_COST
	LEVEL_THRESHOLDS = (function()
		local t = Js.alit(0, 0)
		for L = 2, POINTS_CAP_LEVEL do
			A.set(t, L, (t[L] + LEVEL_COST[L]))
		end
		do return t end
	end)()
	exports.LEVEL_THRESHOLDS = LEVEL_THRESHOLDS
	STAR_TITLES = Js.alit("Starting out", "Finding your feet", "Making a name", "Established", "Standout", "Star", "Big name", "Elite", "World class", "Legend in the making", "The Complete Career")
	exports.STAR_TITLES = STAR_TITLES
	MAX_RISE_PER_MATCH = 1
	exports.MAX_RISE_PER_MATCH = MAX_RISE_PER_MATCH
	POOR_MATCH_RATING = 5.5
	exports.POOR_MATCH_RATING = POOR_MATCH_RATING
	GOOD_MATCH_RATING = 6.5
	exports.GOOD_MATCH_RATING = GOOD_MATCH_RATING
	SLUMP_SHARE = 0.2
	exports.SLUMP_SHARE = SLUMP_SHARE
	SLUMP_MATCHES = 5
	exports.SLUMP_MATCHES = SLUMP_MATCHES
	GATE_GAMES = 10
	exports.GATE_GAMES = GATE_GAMES
	gamesAtOrAbove = function(led, div)
		return A.reduce(A.slice(DIV_ORDER, A.indexOf(DIV_ORDER, div)), function(s, d)
			return (s + ((function() local _v = led.tiers[d]; if _v == nil then return nil end; _v = _v.apps; return _v end)() or 0))
		end, 0)
	end
	MAJOR = Js.alit("Premier League", "FA Cup", "League Cup", "Champions League", "Europa League", "Conference League")
	STAR_GATES = Js.alit(Js.O({ cap = 29, need = ("Play " .. Js.numstr(GATE_GAMES) .. " league games in League Two or higher"), open = function(_c, l)
		return (gamesAtOrAbove(l, "league_two") >= GATE_GAMES)
	end }, { "cap", "need", "open" }), Js.O({ cap = 39, need = ("Play " .. Js.numstr(GATE_GAMES) .. " league games in League One or higher"), open = function(_c, l)
		return (gamesAtOrAbove(l, "league_one") >= GATE_GAMES)
	end }, { "cap", "need", "open" }), Js.O({ cap = 49, need = ("Play " .. Js.numstr(GATE_GAMES) .. " league games in the Championship or higher"), open = function(_c, l)
		return (gamesAtOrAbove(l, "championship") >= GATE_GAMES)
	end }, { "cap", "need", "open" }), Js.O({ cap = 59, need = ("Play " .. Js.numstr(GATE_GAMES) .. " Premier League games"), open = function(_c, l)
		return (gamesAtOrAbove(l, "premier") >= GATE_GAMES)
	end }, { "cap", "need", "open" }), Js.O({ cap = 69, need = "Win a major trophy, or play in the Champions League", open = function(c, l)
		return ((l.uclApps > 0) or A.some(c.trophies, function(t)
			return A.includes(MAJOR, t.competition)
		end))
	end }, { "cap", "need", "open" }), Js.O({ cap = 79, need = "Win the Premier League or Champions League, and finish top 10 in a Ballon d'Or", open = function(c, l)
		return (((count(c, "Premier League") + count(c, "Champions League")) > 0) and (Js.alen(l.ballonRanks) > 0))
	end }, { "cap", "need", "open" }), Js.O({ cap = 89, need = "Win the Ballon d'Or, or finish top 3 twice", open = function(c, l)
		return (((c.ballonDorWins > 0) or A.includes(l.ballonRanks, 1)) or (Js.alen(A.filter(l.ballonRanks, function(r)
			return (r <= 3)
		end)) >= 2))
	end }, { "cap", "need", "open" }))
	exports.STAR_GATES = STAR_GATES
	LEGEND = Js.O({ ballons = 4, ucl = 3, titles = 5, trophies = 20, clubStature = 95, goalsAssists = 500, reputation = 95, fame = 80 }, { "ballons", "ucl", "titles", "trophies", "clubStature", "goalsAssists", "reputation", "fame" })
	exports.LEGEND = LEGEND
	LEGEND_TASKS = Js.alit(Js.O({ id = "ballons", label = ("Win " .. Js.numstr(LEGEND.ballons) .. " Ballon d'Ors"), done = function(c)
		return (c.ballonDorWins >= LEGEND.ballons)
	end, progress = function(c)
		return (Js.numstr(c.ballonDorWins) .. " / " .. Js.numstr(LEGEND.ballons))
	end }, { "id", "label", "done", "progress" }), Js.O({ id = "ucl", label = ("Win " .. Js.numstr(LEGEND.ucl) .. " Champions Leagues"), done = function(c)
		return (count(c, "Champions League") >= LEGEND.ucl)
	end, progress = function(c)
		return (Js.numstr(count(c, "Champions League")) .. " / " .. Js.numstr(LEGEND.ucl))
	end }, { "id", "label", "done", "progress" }), Js.O({ id = "titles", label = ("Win " .. Js.numstr(LEGEND.titles) .. " Premier League titles"), done = function(c)
		return (count(c, "Premier League") >= LEGEND.titles)
	end, progress = function(c)
		return (Js.numstr(count(c, "Premier League")) .. " / " .. Js.numstr(LEGEND.titles))
	end }, { "id", "label", "done", "progress" }), Js.O({ id = "trophies", label = ("Win " .. Js.numstr(LEGEND.trophies) .. " trophies"), done = function(c)
		return (Js.alen(c.trophies) >= LEGEND.trophies)
	end, progress = function(c)
		return (Js.numstr(Js.alen(c.trophies)) .. " / " .. Js.numstr(LEGEND.trophies))
	end }, { "id", "label", "done", "progress" }), Js.O({ id = "club", label = "Play for one of the world's biggest clubs", done = function(_c, l)
		return ((if l.maxRep ~= nil then l.maxRep else 0) >= LEGEND.clubStature)
	end, progress = function(_c, l)
		return ("Biggest so far: " .. Js.numstr((if l.maxRep ~= nil then l.maxRep else 0)) .. " / " .. Js.numstr(LEGEND.clubStature))
	end }, { "id", "label", "done", "progress" }), Js.O({ id = "numbers", label = (Js.numstr(LEGEND.goalsAssists) .. " career goals and assists"), done = function(c)
		return ((c.careerStats.goals + c.careerStats.assists) >= LEGEND.goalsAssists)
	end, progress = function(c)
		return (Js.numstr((c.careerStats.goals + c.careerStats.assists)) .. " / " .. Js.numstr(LEGEND.goalsAssists))
	end }, { "id", "label", "done", "progress" }), Js.O({ id = "achievements", label = "Unlock every achievement", done = function(c)
		return A.every(M_achievements.ACHIEVEMENTS, function(a)
			return A.includes(c.achievements, a.id)
		end)
	end, progress = function(c)
		return (Js.numstr(Js.alen(A.filter(M_achievements.ACHIEVEMENTS, function(a)
			return A.includes(c.achievements, a.id)
		end))) .. " / " .. Js.numstr(Js.alen(M_achievements.ACHIEVEMENTS)))
	end }, { "id", "label", "done", "progress" }), Js.O({ id = "records", label = "Beat every record", done = function(c)
		return A.every(M_records.RECORDS, function(r)
			return M_records.recordBeaten(c, r)
		end)
	end, progress = function(c)
		return (Js.numstr(Js.alen(A.filter(M_records.RECORDS, function(r)
			return M_records.recordBeaten(c, r)
		end))) .. " / " .. Js.numstr(Js.alen(M_records.RECORDS)))
	end }, { "id", "label", "done", "progress" }), Js.O({ id = "icon", label = "Icon fame and 95 reputation", done = function(c)
		return ((M_fame.fameOf(c) >= LEGEND.fame) and (c.reputation >= LEGEND.reputation))
	end, progress = function(c)
		return ("Fame " .. Js.numstr(Math.round(M_fame.fameOf(c))) .. " / " .. Js.numstr(LEGEND.fame) .. " · Reputation " .. Js.numstr(Math.round(c.reputation)) .. " / " .. Js.numstr(LEGEND.reputation))
	end }, { "id", "label", "done", "progress" }), Js.O({ id = "owner", label = "Own a club and a level-5 Private Island", done = function(c)
		return (ownsClub(c) and ownsIsland(c))
	end, progress = function(c)
		return ("Club " .. (if ownsClub(c) then "✓" else "✗") .. " · Island " .. (if ownsIsland(c) then "✓" else "✗"))
	end }, { "id", "label", "done", "progress" }))
	exports.LEGEND_TASKS = LEGEND_TASKS
end
