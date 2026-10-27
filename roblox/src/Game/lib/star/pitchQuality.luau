--!nocheck
--!nolint
-- Generated from lib/star/pitchQuality.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_clubs = import("lib/star/clubs")
	local M_footballClubDatabase = import("lib/star/data/footballClubDatabase")
	local M_clubProfiles = import("lib/star/data/clubProfiles")
	local BASE, wobble, pitchWord, clubPitch, groundFor, pitchLabel
	wobble = function(club)
		local h = 2166136261
		for i = 0, (S.len(club)) - 1 do
			h = Js.bxor(h, S.charCodeAt(club, i))
			h = Math.imul(h, 16777619)
		end
		do return (((Js.ushr(h, 0) / 4294967295) - 0.5) * 0.1) end
	end
	pitchWord = function(q)
		if (q >= 0.95) then
			do return "perfect" end
		end
		if (q >= 0.8) then
			do return "good" end
		end
		if (q >= 0.62) then
			do return "fair" end
		end
		if (q >= 0.45) then
			do return "poor" end
		end
		do return "very poor" end
	end
	exports.pitchWord = pitchWord
	clubPitch = function(club)
		local division = (if A.includes(M_clubs.PREMIER_LEAGUE_CLUBS, club) then "premier" else M_clubs.divisionOf(club))
		local real = M_footballClubDatabase.CLUB_DATABASE[club]
		local sheet = (if real then nil else M_clubProfiles.profileOf(club))
		local capacity = (((function() local _v = real; if _v == nil then return nil end; _v = _v.capacity; return _v end)() or (function() local _v = sheet; if _v == nil then return nil end; _v = _v.capacity; return _v end)()) or nil)
		local training = ((function() local _v = real; if _v == nil then return nil end; _v = _v.trainingRating; return _v end)() or (function() local _v = sheet; if _v == nil then return nil end; _v = _v.training; return _v end)())
		if (division == "premier") then
			do return Js.O({ club = club, division = division, capacity = capacity, quality = 1, word = "perfect" }, { "club", "division", "capacity", "quality", "word" }) end
		end
		local q = (if Js.T(division) then BASE[division] else 0.65)
		if (capacity ~= nil) then
			if (capacity < 3000) then
				q -= 0.08
			elseif (capacity < 6000) then
				q -= 0.04
			elseif (capacity > 30000) then
				q += 0.06
			elseif (capacity > 20000) then
				q += 0.04
			end
		end
		if (training ~= nil) then
			q += Math.max(-0.04, Math.min(0.06, ((training - 3) * 0.02)))
		end
		q += wobble(club)
		q = (Math.round((Math.max(0.25, Math.min(0.99, q)) * 100)) / 100)
		do return Js.O({ club = club, division = division, capacity = capacity, quality = q, word = pitchWord(q) }, { "club", "division", "capacity", "quality", "word" }) end
	end
	exports.clubPitch = clubPitch
	groundFor = function(season, week, raining)
		if raining then
			do return "wet" end
		end
		local edge = ((week <= 6) or (week >= 34))
		if (not edge) then
			do return "normal" end
		end
		local h = Js.ushr(Math.imul((((season * 7307) + (week * 131)) + 17), 2654435761), 0)
		h = Js.bxor(h, Js.ushr(h, 15))
		do return (if (math.fmod(h, 100) < 35) then "dry" else "normal") end
	end
	exports.groundFor = groundFor
	pitchLabel = function(quality, ground)
		local w = pitchWord(quality)
		do return (if ((ground == "normal") or ((ground == "dry") and (w == "perfect"))) then ("Pitch: " .. w) else ("Pitch: " .. w .. ", " .. ground)) end
	end
	exports.pitchLabel = pitchLabel
	BASE = Js.O({ premier = 1, champions = 0.98, europa = 0.96, championship = 0.9, pool = 0.85, league_one = 0.8, league_two = 0.7, national_league = 0.6, national_league_north = 0.5, national_league_south = 0.5, step3_north = 0.4, step3_south = 0.4 }, { "premier", "champions", "europa", "championship", "pool", "league_one", "league_two", "national_league", "national_league_north", "national_league_south", "step3_north", "step3_south" })
end
