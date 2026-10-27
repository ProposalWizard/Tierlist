--!nocheck
--!nolint
-- Generated from lib/star/manager.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_season = import("lib/star/season")
	local M_squadData = import("lib/star/squadData")
	local M_expectations = import("lib/star/expectations")
	local M_lineupStore = import("lib/star/lineupStore")
	local M_managerPool = import("lib/star/managerPool")
	local FIRST, LAST, STYLE_BLURB, REPUTATION_TIERS, reputationTier, reputationBlurb, REPUTATION_RANGE, STYLE_SELECTION, makeManager, styleBlurb, hireReplacementManager, bossOnArrival, sackCheck
	reputationTier = function(reputation)
		do return (A.find(REPUTATION_TIERS, function(t)
			return (reputation >= t.min)
		end) or REPUTATION_TIERS[Js.alen(REPUTATION_TIERS)]).tier end
	end
	exports.reputationTier = reputationTier
	reputationBlurb = function(reputation)
		do return (A.find(REPUTATION_TIERS, function(t)
			return (reputation >= t.min)
		end) or REPUTATION_TIERS[Js.alen(REPUTATION_TIERS)]).blurb end
	end
	exports.reputationBlurb = reputationBlurb
	makeManager = function(career, club, season)
		local rng = M_season.mulberry32(((M_squadData.clubNameSeed(club) + (season * 7717)) + Math.round((career.starRating * 7))))
		local generatedName = (FIRST[math.floor((rng() * Js.alen(FIRST))) + 1] .. " " .. LAST[math.floor((rng() * Js.alen(LAST))) + 1])
		local roll = rng()
		local style = (if (roll < 0.38) then "trusting" else (if (roll < 0.72) then "demanding" else "rotational"))
		local range = REPUTATION_RANGE[M_expectations.clubExpectation(Js.ospread(career, Js.O({ player = Js.ospread(career.player, Js.O({ club = club }, { "club" })) }, { "player" }))).ambition]
		local reputation = Math.round((range.min + (rng() * (range.max - range.min))))
		local real = (function() local _r = (function() local _v = M_lineupStore.loadLineup(club); if _v == nil then return nil end; _v = _v.manager; return _v end)(); if _r == nil then return nil end; return S.trim(_r) end)()
		do return Js.O({ name = (if Js.T(real) then real else generatedName), style = style, since = season, arrival = STYLE_BLURB[style], reputation = reputation }, { "name", "style", "since", "arrival", "reputation" }) end
	end
	exports.makeManager = makeManager
	styleBlurb = function(style)
		do return STYLE_BLURB[style] end
	end
	exports.styleBlurb = styleBlurb
	hireReplacementManager = function(career, club, season, availableManagers)
		local rng = M_managerPool.managerRng(career, club, season)
		local ambition = M_managerPool.clubAmbition(career, club)
		local pick = M_managerPool.rollReplacementManager(availableManagers, club, ambition, rng)
		local styleRoll = rng()
		local style = (if (styleRoll < 0.38) then "trusting" else (if (styleRoll < 0.72) then "demanding" else "rotational"))
		if pick then
			local range = M_managerPool.TIER_REPUTATION_RANGE[Js.key(pick.tier)]
			local reputation = Math.round((range.min + (rng() * (range.max - range.min))))
			do return Js.O({ manager = Js.O({ name = pick.name, style = style, since = season, arrival = STYLE_BLURB[style], reputation = reputation, poolTier = pick.tier }, { "name", "style", "since", "arrival", "reputation", "poolTier" }), availableManagers = A.filter(availableManagers, function(n)
				return (n ~= pick.name)
			end) }, { "manager", "availableManagers" }) end
		end
		local generatedName = (FIRST[math.floor((rng() * Js.alen(FIRST))) + 1] .. " " .. LAST[math.floor((rng() * Js.alen(LAST))) + 1])
		local range = REPUTATION_RANGE[ambition]
		local reputation = Math.round((range.min + (rng() * (range.max - range.min))))
		do return Js.O({ manager = Js.O({ name = generatedName, style = style, since = season, arrival = STYLE_BLURB[style], reputation = reputation }, { "name", "style", "since", "arrival", "reputation" }), availableManagers = availableManagers }, { "manager", "availableManagers" }) end
	end
	exports.hireReplacementManager = hireReplacementManager
	bossOnArrival = function(career)
		do return Math.round(Math.max(35, Math.min(68, (42 + (career.starRating * 5))))) end
	end
	exports.bossOnArrival = bossOnArrival
	sackCheck = function(career, seasonScore, promoted)
		if promoted == nil then promoted = false end
		local m = career.manager
		if (not m) then
			do return Js.O({ sacked = false, reason = "" }, { "sacked", "reason" }) end
		end
		if promoted then
			do return Js.O({ sacked = false, reason = "" }, { "sacked", "reason" }) end
		end
		local firstSeason = ((career.season - m.since) < 1)
		local reputationAdjust = (if firstSeason then ((((if m.reputation ~= nil then m.reputation else 50) - 50) / 100) * 0.3) else 0)
		local bar = ((if firstSeason then -0.72 else -0.45) + reputationAdjust)
		if (seasonScore <= bar) then
			do return Js.O({ sacked = true, reason = (if (seasonScore <= -0.8) then (m.name .. " is sacked. The board had seen enough long before the end.") else (m.name .. " is sacked after a season below what the board wanted.")) }, { "sacked", "reason" }) end
		end
		do return Js.O({ sacked = false, reason = "" }, { "sacked", "reason" }) end
	end
	exports.sackCheck = sackCheck
	FIRST = Js.alit("Alan", "Roberto", "Klaus", "Diego", "Sean", "Marcelo", "Henrik", "Paul", "Gianluca", "Owen", "Bruno", "Terry")
	LAST = Js.alit("Whitfield", "Marchetti", "Voss", "Almeida", "Doherty", "Ferreira", "Lindberg", "Ashcroft", "Bianchi", "Pryce", "Salgado", "Hobbs")
	STYLE_BLURB = Js.O({ trusting = "Picks a side and sticks with it. Slow to drop you, slow to bring you back.", demanding = "Expects a lot, every week. Form is the only currency with him.", rotational = "Rotates freely. Nobody is guaranteed, and nobody is frozen out." }, { "trusting", "demanding", "rotational" })
	REPUTATION_TIERS = Js.alit(Js.O({ tier = "Elite", min = 80, blurb = "A genuine box-office name — the kind of appointment that makes the back pages." }, { "tier", "min", "blurb" }), Js.O({ tier = "Proven", min = 55, blurb = "Has done this before, somewhere that mattered." }, { "tier", "min", "blurb" }), Js.O({ tier = "Rising", min = 30, blurb = "Making a name for himself. This could be the job that does it." }, { "tier", "min", "blurb" }), Js.O({ tier = "Journeyman", min = 0, blurb = "Not a name anyone outside the game would know. Everyone starts somewhere." }, { "tier", "min", "blurb" }))
	REPUTATION_RANGE = Js.O({ Title = Js.O({ min = 55, max = 100 }, { "min", "max" }), Europe = Js.O({ min = 35, max = 90 }, { "min", "max" }), ["Mid-table"] = Js.O({ min = 15, max = 75 }, { "min", "max" }), Survival = Js.O({ min = 0, max = 55 }, { "min", "max" }) }, { "Title", "Europe", "Mid-table", "Survival" })
	STYLE_SELECTION = Js.O({ trusting = Js.O({ start = -4, bench = -4 }, { "start", "bench" }), demanding = Js.O({ start = Js.Number(5), bench = Js.Number(2) }, { "start", "bench" }), rotational = Js.O({ start = 0, bench = -6 }, { "start", "bench" }) }, { "trusting", "demanding", "rotational" })
	exports.STYLE_SELECTION = STYLE_SELECTION
end
