--!nocheck
--!nolint
-- Generated from lib/star/world/clubRating.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_clubProfiles = import("lib/star/data/clubProfiles")
	local DIVISION_LEVEL, DATA_SLOPE, DATA_CAP, REAL_PLAYERS, isInventedPlayer, squadRating, dataScore, meanCache, meanScore, dataRating, rateClub
	isInventedPlayer = function(id)
		do return S.startsWith(id, "gen:") end
	end
	exports.isInventedPlayer = isInventedPlayer
	squadRating = function(squad)
		if ((not squad) or (Js.alen(squad.players) < REAL_PLAYERS)) then
			do return nil end
		end
		local real = Js.alen(A.filter(squad.players, function(p)
			return (not isInventedPlayer(p.id))
		end))
		if (real < REAL_PLAYERS) then
			do return nil end
		end
		local xi = A.slice(squad.players, 0, 11)
		do return (Math.round(((A.reduce(xi, function(s, p)
			return (s + p.overall)
		end, 0) / Js.alen(xi)) * 10)) / 10) end
	end
	exports.squadRating = squadRating
	dataScore = function(club)
		local p = M_clubProfiles.profileOf(club)
		local cur = ((function() local _v = p; if _v == nil then return nil end; _v = _v.currentRep; return _v end)() or 3)
		local hist = ((function() local _v = p; if _v == nil then return nil end; _v = _v.historicalRep; return _v end)() or cur)
		local spend = ((function() local _v = p; if _v == nil then return nil end; _v = _v.transferSpending; return _v end)() or cur)
		do return (((cur * 0.7) + (hist * 0.15)) + (spend * 0.15)) end
	end
	exports.dataScore = dataScore
	meanScore = function(peers)
		local key = A.join(peers, "|")
		local hit = meanCache:get(key)
		if (hit ~= nil) then
			do return hit end
		end
		local m = (if Js.T(Js.alen(peers)) then (A.reduce(peers, function(s, c)
			return (s + dataScore(c))
		end, 0) / Js.alen(peers)) else 3)
		if (meanCache.size > 64) then
			meanCache:clear()
		end
		meanCache:set(key, m)
		do return m end
	end
	dataRating = function(club, division, peers)
		local given = (function() local _v = M_clubProfiles.profileOf(club); if _v == nil then return nil end; _v = _v.avgRating; return _v end)()
		local regional = (((division == "national_league_north") or (division == "national_league_south")) or (division == "step3"))
		local base = ((if (regional and (given ~= nil)) then given else DIVISION_LEVEL[division]) or 60)
		local shift = Math.max((-DATA_CAP), Math.min(DATA_CAP, ((dataScore(club) - meanScore(peers)) * DATA_SLOPE)))
		do return (Math.round(((base + shift) * 10)) / 10) end
	end
	exports.dataRating = dataRating
	rateClub = function(club, squad, division, peers)
		do return (squadRating(squad) or dataRating(club, division, peers)) end
	end
	exports.rateClub = rateClub
	DIVISION_LEVEL = Js.O({ premier = 78, championship = 70, league_one = 63, league_two = 58, national_league = 55, national_league_north = 53, national_league_south = 53, step3 = 50 }, { "premier", "championship", "league_one", "league_two", "national_league", "national_league_north", "national_league_south", "step3" })
	exports.DIVISION_LEVEL = DIVISION_LEVEL
	DATA_SLOPE = 1.6
	DATA_CAP = 4
	REAL_PLAYERS = 11
	meanCache = Js.Map.new()
end
