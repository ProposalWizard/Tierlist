--!nocheck
--!nolint
-- Generated from lib/star/dribbleDeal.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_kindMix = import("lib/star/kindMix")
	local M_hiddenMatch = import("lib/star/hiddenMatch")
	local DRIBBLE_SHARE_BY_LEVEL, FIT_SHARE, EUROPE, dribbleLevelFor, isOpenPlay, dribbleMomentFits, newDribbleDeal, dribbleGuardAllows, dealDribble
	dribbleLevelFor = function(division, competition)
		if (Js.T(competition) and EUROPE:has(competition)) then
			do return "europe" end
		end
		local _sw1 = division
		if _sw1 == "national_league" or _sw1 == "national_league_north" or _sw1 == "national_league_south" then
			do return "national" end
		elseif _sw1 == "league_two" then
			do return "league_two" end
		elseif _sw1 == "league_one" then
			do return "league_one" end
		elseif _sw1 == "championship" then
			do return "championship" end
		else
			do return "premier" end
		end
	end
	exports.dribbleLevelFor = dribbleLevelFor
	dribbleMomentFits = function(r)
		if ((not isOpenPlay(r)) or r.lateCharge) then
			do return false end
		end
		if ((r.zone ~= "middle") and (r.zone ~= "attacking")) then
			do return false end
		end
		do return ((not (not r.dribble)) or (r.pattern == "transition")) end
	end
	exports.dribbleMomentFits = dribbleMomentFits
	dribbleGuardAllows = function(deal)
		local s = deal.served
		if (Js.T(Js.alen(s)) and s[Js.alen(s)]) then
			do return false end
		end
		do return (Js.alen(A.filter(A.slice(s, (-(M_kindMix.GUARD_WINDOW - 1))), Js.Boolean)) < M_kindMix.GUARD_MAX_IN_WINDOW) end
	end
	exports.dribbleGuardAllows = dribbleGuardAllows
	dealDribble = function(req, level, deal, rng)
		local out = req
		if dribbleMomentFits(req) then
			local p = Math.min(1, (DRIBBLE_SHARE_BY_LEVEL[level] / FIT_SHARE))
			local roll = rng()
			if (dribbleGuardAllows(deal) and (roll < p)) then
				out = (if req.dribble then req else Js.ospread(req, Js.O({ dribble = true, kinds = Js.alit("one_on_one"), reason = "You pick it up on the break with space to run into" }, { "dribble", "kinds", "reason" })))
			elseif req.dribble then
				out = Js.ospread(req, Js.O({ dribble = false, kinds = M_hiddenMatch.kindsForZone(req.zone, (if req.lane ~= nil then req.lane else "centre")), pattern = "transition" }, { "dribble", "kinds", "pattern" }))
			end
		elseif req.dribble then
			out = Js.ospread(req, Js.O({ dribble = false, kinds = M_hiddenMatch.kindsForZone(req.zone, (if req.lane ~= nil then req.lane else "centre")), pattern = "transition" }, { "dribble", "kinds", "pattern" }))
		end
		if isOpenPlay(out) then
			A.push(deal.served, (not (not out.dribble)))
		end
		do return out end
	end
	exports.dealDribble = dealDribble
	DRIBBLE_SHARE_BY_LEVEL = Js.O({ national = 0.03, league_two = 0.045, league_one = 0.06, championship = 0.08, premier = 0.1, europe = 0.1 }, { "national", "league_two", "league_one", "championship", "premier", "europe" })
	exports.DRIBBLE_SHARE_BY_LEVEL = DRIBBLE_SHARE_BY_LEVEL
	FIT_SHARE = 0.16
	exports.FIT_SHARE = FIT_SHARE
	EUROPE = Js.Set.new(Js.alit("Champions League", "Europa League", "Conference League", "Super Cup"))
	isOpenPlay = function(r)
		return ((r.pattern ~= "set_piece") and (not r.penaltyWon))
	end
	exports.isOpenPlay = isOpenPlay
	newDribbleDeal = function()
		return Js.O({ served = Js.alit() }, { "served" })
	end
	exports.newDribbleDeal = newDribbleDeal
end
