--!nocheck
--!nolint
-- Generated from lib/star/data/clubProfiles.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_clubProfileData = import("lib/star/data/clubProfileData")
	local M_researched_2026_10_json = import("lib/star/data/sources/researched_2026-10_json")
	local M_claude_ratings_2026_10_json = import("lib/star/data/sources/claude_ratings_2026-10_json")
	local COLOUR_WORDS, MISSING, str, num, hex, kit, tier, fromClubSheet, fromRegionalSheet, merge, fillResearched, CLUB_PROFILES, profileOf, PROFILE_FIELDS
	fromClubSheet = function(r)
		do return Js.O({ club = r["Club"], sources = Js.alit("Club sheet, 14 Sep 2026"), founded = str(r["Founded"]), country = str(r["Country"]), stadium = str(r["Stadium"]), capacity = num(r["Capacity"]), training = num(r["Training Facilities /10"]), youth = num(r["Youth Facilities /10"]), currentRep = num(r["Current World Reputation /10"]), historicalRep = num(r["Historical World Reputation /10"]), transferSpending = num(r["Transfer Spending /10"]), leagueTitles = (function() local _l = (function() local _r = str(r["League Titles"]); if _r == nil then return nil end; return S.replace(_r, Js.re("^Not yet entered$", "i"), "") end)(); if Js.T(_l) then return _l end; return nil end)(), domesticCups = (function() local _l = (function() local _r = str(r["Domestic Cup Wins"]); if _r == nil then return nil end; return S.replace(_r, Js.re("^Not yet entered$", "i"), "") end)(); if Js.T(_l) then return _l end; return nil end)(), europeanTrophies = (function() local _l = (function() local _r = str(r["European Trophies"]); if _r == nil then return nil end; return S.replace(_r, Js.re("^Not yet entered$", "i"), "") end)(); if Js.T(_l) then return _l end; return nil end)(), ballonDor = str(r["Ballon d'Or Winners Played For Club"]), transferStrategy = str(r["Transfer Strategy"]) }, { "club", "sources", "founded", "country", "stadium", "capacity", "training", "youth", "currentRep", "historicalRep", "transferSpending", "leagueTitles", "domesticCups", "europeanTrophies", "ballonDor", "transferStrategy" }) end
	end
	fromRegionalSheet = function(r)
		local rivals = Js.alit()
		do
			local _arr1 = Js.alit(1, 2, 3)
			local _i2 = 0
			while _i2 < Js.alen(_arr1) do
				_i2 += 1
				local i = _arr1[_i2]
				local club = str(r[("rival" .. Js.numstr(i))])
				if Js.T(club) then
					A.push(rivals, Js.O({ club = club, tier = tier(r[("rival" .. Js.numstr(i) .. "Tier")]), derby = Js.re("^yes$", "i"):test((r[("rival" .. Js.numstr(i) .. "Derby")] or "")) }, { "club", "tier", "derby" }))
				end
			end
		end
		local badge = A.filter(A.map(Js.alit(r.badge1, r.badge2, r.badge3), str), function(b)
			return (not (not Js.T(b)))
		end)
		local chant = function(v)
			return (if (Js.T(str(v)) and (not Js.re("none confidently verified", "i"):test(v))) then str(v) else nil)
		end
		do return Js.O({ club = r.club, sources = Js.alit("North/South sheet, 2 Oct 2026"), nickname = str(r.nickname), founded = str(r.founded), country = str(r.country), homeKit = kit(r.homeShirt, r.homeTrim, r.homePattern), awayKit = kit(r.awayShirt, r.awayTrim, r.awayPattern), badgeColours = (if Js.T(Js.alen(badge)) then badge else nil), badgeStyle = str(r.badgeStyle), stadium = str(r.stadium), capacity = num(r.capacity), training = num(r.training), youth = num(r.youth), leagueTitles = str(r.leagueTitles), domesticCups = str(r.domesticCups), europeanTrophies = str(r.europeanTrophies), currentRep = num(r.currentRep), historicalRep = num(r.historicalRep), ballonDor = str(r.ballonDor), transferSpending = num(r.transferSpending), transferStrategy = str(r.transferStrategy), clubSize = num(r.clubSize), avgRating = num(r.avgRating), rivals = (if Js.T(Js.alen(rivals)) then rivals else nil), winChant = chant(r.winChant), playerChant = chant(r.playerChant), manager = str(r.manager), formation = str(r.formation), notes = str(r.notes) }, { "club", "sources", "nickname", "founded", "country", "homeKit", "awayKit", "badgeColours", "badgeStyle", "stadium", "capacity", "training", "youth", "leagueTitles", "domesticCups", "europeanTrophies", "currentRep", "historicalRep", "ballonDor", "transferSpending", "transferStrategy", "clubSize", "avgRating", "rivals", "winChant", "playerChant", "manager", "formation", "notes" }) end
	end
	merge = function(a, b)
		if (not a) then
			do return b end
		end
		local out = Js.ospread(a, Js.O({ sources = Js.aspread(a.sources, b.sources) }, { "sources" }))
		do
			local _arr3 = Js.Object.entries(b)
			local _i4 = 0
			while _i4 < Js.alen(_arr3) do
				_i4 += 1
				local _e5 = _arr3[_i4]
				local k = _e5[1]
				local v = _e5[2]
				if (((k == "sources") or (k == "club")) or (v == nil)) then
					do continue end
				end
				out[k] = v
			end
		end
		do return out end
	end
	fillResearched = function(a, club, r)
		local out = (if a then Js.ospread(a) else Js.O({ club = club, sources = Js.alit() }, { "club", "sources" }))
		local v = r.values
		local used = Js.O({}, nil)
		local fill = function(key, val, auditKey)
			if ((val == nil) or (out[key] ~= nil)) then
				do return end
			end
			out[key] = val
			used[auditKey] = (if r.sources[auditKey] ~= nil then r.sources[auditKey] else "")
		end
		fill("nickname", v.nickname, "nickname")
		fill("founded", v.founded, "founded")
		fill("country", v.country, "country")
		fill("stadium", v.stadium, "stadium")
		fill("capacity", v.capacity, "capacity")
		fill("manager", v.manager, "manager")
		fill("leagueTitles", v.leagueTitles, "leagueTitles")
		fill("domesticCups", v.domesticCups, "domesticCups")
		fill("europeanTrophies", v.europeanTrophies, "europeanTrophies")
		fill("badgeColours", v.badge, "badge")
		fill("badgeStyle", v.badgeStyle, "badgeStyle")
		if (v.ballonDor ~= nil) then
			out.ballonDor = v.ballonDor
			used.ballonDor = (if r.sources.ballonDor ~= nil then r.sources.ballonDor else "")
		end
		if (v.kits and (not out.homeKit)) then
			out.homeKit = Js.O({ shirtHex = v.kits.home.shirtHex, trimHex = v.kits.home.trimHex, pattern = v.kits.home.pattern }, { "shirtHex", "trimHex", "pattern" })
			if v.kits.away then
				out.awayKit = Js.O({ shirtHex = v.kits.away.shirtHex, trimHex = v.kits.away.trimHex }, { "shirtHex", "trimHex" })
			end
			used.kits = (if r.sources.kits ~= nil then r.sources.kits else "")
		end
		if (Js.T(v.kitPattern) and (not Js.T((function() local _v = out.homeKit; if _v == nil then return nil end; _v = _v.pattern; return _v end)()))) then
			out.homeKit = Js.ospread((if out.homeKit ~= nil then out.homeKit else Js.O({}, nil)), Js.O({ pattern = v.kitPattern }, { "pattern" }))
			used.kitPattern = (if r.sources.kitPattern ~= nil then r.sources.kitPattern else "")
		end
		if Js.T(Js.alen(Js.Object.keys(used))) then
			out.researched = Js.ospread((if out.researched ~= nil then out.researched else Js.O({}, nil)), used)
			out.sources = Js.aspread(out.sources, Js.alit("Research, 2 Oct 2026"))
		end
		do return out end
	end
	profileOf = function(club)
		do return CLUB_PROFILES[club] end
	end
	exports.profileOf = profileOf
	COLOUR_WORDS = Js.O({ white = "#F2F4F7", black = "#17181A", red = "#D71920", blue = "#0057B8", ["royal blue"] = "#1F4FB5", navy = "#001F5B", ["sky blue"] = "#6CABDD", yellow = "#FBE300", amber = "#F2A900", gold = "#D4A72C", orange = "#F78F1E", ["dark orange"] = "#C85A12", claret = "#6C1D45", maroon = "#7A263A", purple = "#5B2A86", grey = "#8A8F98", green = "#159C56", turquoise = "#1CC7C1", ["dark turquoise"] = "#0F8C8A", teal = "#0B7A75" }, { "white", "black", "red", "blue", "royal blue", "navy", "sky blue", "yellow", "amber", "gold", "orange", "dark orange", "claret", "maroon", "purple", "grey", "green", "turquoise", "dark turquoise", "teal" })
	exports.COLOUR_WORDS = COLOUR_WORDS
	MISSING = Js.re("^(verify|your call|tbc|unknown|-|n\\/a)?$", "i")
	str = function(v)
		local t = S.trim((if v ~= nil then v else ""))
		do return (if MISSING:test(t) then nil else t) end
	end
	num = function(v)
		local t = str(v)
		if (t == nil) then
			do return nil end
		end
		local n = Js.Number(S.replace(t, Js.re(",", "g"), ""))
		do return (if Js.NumberNS.isFinite(n) then n else nil) end
	end
	hex = function(word)
		return (if Js.T(word) then COLOUR_WORDS[S.toLowerCase(word)] else nil)
	end
	kit = function(shirt, trim, pattern)
		local s = str(shirt)
		local t = str(trim)
		local p = str(pattern)
		if (((not Js.T(s)) and (not Js.T(t))) and (not Js.T(p))) then
			do return nil end
		end
		local trimWord = (if (Js.T(t) and (S.toLowerCase(t) ~= "none")) then t else nil)
		local shirtHex = hex(s)
		do return Js.O({ shirt = s, trim = t, pattern = p, shirtHex = shirtHex, trimHex = (hex(trimWord) or (if (shirtHex == COLOUR_WORDS.white) then COLOUR_WORDS.black else COLOUR_WORDS.white)) }, { "shirt", "trim", "pattern", "shirtHex", "trimHex" }) end
	end
	tier = function(v)
		return (if (((v == "R1") or (v == "R2")) or (v == "R3")) then v else nil)
	end
	CLUB_PROFILES = (function()
		local all = Js.O({}, nil)
		do
			local _arr6 = M_clubProfileData.CLUB_SHEET_2026_09
			local _i7 = 0
			while _i7 < Js.alen(_arr6) do
				_i7 += 1
				local r = _arr6[_i7]
				if Js.T(r["Club"]) then
					all[r["Club"]] = merge(all[r["Club"]], fromClubSheet(r))
				end
			end
		end
		do
			local _arr8 = M_clubProfileData.REGIONAL_SHEET_2026_10
			local _i9 = 0
			while _i9 < Js.alen(_arr8) do
				_i9 += 1
				local r = _arr8[_i9]
				if Js.T(r.club) then
					all[r.club] = merge(all[r.club], fromRegionalSheet(r))
				end
			end
		end
		local researched = M_researched_2026_10_json.default.clubs
		do
			local _arr10 = Js.Object.entries(researched)
			local _i11 = 0
			while _i11 < Js.alen(_arr10) do
				_i11 += 1
				local _e12 = _arr10[_i11]
				local club = _e12[1]
				local r = _e12[2]
				all[club] = fillResearched(all[club], club, r)
			end
		end
		local ratings = M_claude_ratings_2026_10_json.default.clubs
		local RATING_NOTE = "Claude's rating (2 Oct 2026), not a fact — check and change"
		do
			local _arr13 = Js.Object.entries(ratings)
			local _i14 = 0
			while _i14 < Js.alen(_arr13) do
				_i14 += 1
				local _e15 = _arr13[_i14]
				local club = _e15[1]
				local v = _e15[2]
				local p = (if all[club] ~= nil then all[club] else Js.O({ club = club, sources = Js.alit() }, { "club", "sources" }))
				local used = Js.O({}, nil)
				do
					local _arr16 = Js.alit("training", "youth", "currentRep", "historicalRep", "transferSpending", "transferStrategy")
					local _i17 = 0
					while _i17 < Js.alen(_arr16) do
						_i17 += 1
						local k = _arr16[_i17]
						if ((p[k] == nil) and (v[k] ~= nil)) then
							p[k] = v[k]
							used[k] = RATING_NOTE
						end
					end
				end
				if Js.T(Js.alen(Js.Object.keys(used))) then
					p.researched = Js.ospread((if p.researched ~= nil then p.researched else Js.O({}, nil)), used)
				end
				all[club] = p
			end
		end
		do return all end
	end)()
	exports.CLUB_PROFILES = CLUB_PROFILES
	PROFILE_FIELDS = Js.alit(Js.O({ key = "nickname", label = "Nickname" }, { "key", "label" }), Js.O({ key = "founded", label = "Founded" }, { "key", "label" }), Js.O({ key = "country", label = "Country" }, { "key", "label" }), Js.O({ key = "homeKit", label = "Home kit" }, { "key", "label" }), Js.O({ key = "awayKit", label = "Away kit" }, { "key", "label" }), Js.O({ key = "badgeColours", label = "Badge colours" }, { "key", "label" }), Js.O({ key = "badgeStyle", label = "Badge style" }, { "key", "label" }), Js.O({ key = "stadium", label = "Stadium" }, { "key", "label" }), Js.O({ key = "capacity", label = "Capacity" }, { "key", "label" }), Js.O({ key = "training", label = "Training /10" }, { "key", "label" }), Js.O({ key = "youth", label = "Youth /10" }, { "key", "label" }), Js.O({ key = "currentRep", label = "Current rep /10" }, { "key", "label" }), Js.O({ key = "historicalRep", label = "Historical rep /10" }, { "key", "label" }), Js.O({ key = "transferSpending", label = "Transfer spending /10" }, { "key", "label" }), Js.O({ key = "transferStrategy", label = "Transfer strategy" }, { "key", "label" }), Js.O({ key = "leagueTitles", label = "League titles" }, { "key", "label" }), Js.O({ key = "domesticCups", label = "Domestic cups" }, { "key", "label" }), Js.O({ key = "europeanTrophies", label = "European trophies" }, { "key", "label" }), Js.O({ key = "ballonDor", label = "Ballon d'Or winners" }, { "key", "label" }), Js.O({ key = "avgRating", label = "Avg player rating" }, { "key", "label" }), Js.O({ key = "rivals", label = "Rivals" }, { "key", "label" }), Js.O({ key = "winChant", label = "Win chant" }, { "key", "label" }), Js.O({ key = "playerChant", label = "Player chant" }, { "key", "label" }), Js.O({ key = "manager", label = "Manager" }, { "key", "label" }), Js.O({ key = "formation", label = "Formation" }, { "key", "label" }))
	exports.PROFILE_FIELDS = PROFILE_FIELDS
end
