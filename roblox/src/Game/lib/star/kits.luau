--!nocheck
--!nolint
-- Generated from lib/star/kits.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_clubProfiles = import("lib/star/data/clubProfiles")
	local NAMED, k, kits, LOWER_LEAGUE_KITS, legibleGivenKits, CLUB_KITS, NEUTRAL, normalise, BY_LOOSE, kitsOf, hexToHsl, hueGap, chroma, clashes, kitClashes, awayFallback, kitsFor, KEEPER_OPTIONS, keeperKit, labelInk, hslToHex, kitLabelOnDark
	legibleGivenKits = function()
		local contrast = function(shirt)
			return (if clashes(shirt, "#F2F4F7") then "#17181A" else "#F2F4F7")
		end
		local out = Js.O({}, nil)
		do
			local _arr1 = Js.Object.values(M_clubProfiles.CLUB_PROFILES)
			local _i2 = 0
			while _i2 < Js.alen(_arr1) do
				_i2 += 1
				local p = _arr1[_i2]
				if ((not Js.T((function() local _v = p.homeKit; if _v == nil then return nil end; _v = _v.shirtHex; return _v end)())) or (not Js.T((function() local _v = p.awayKit; if _v == nil then return nil end; _v = _v.shirtHex; return _v end)()))) then
					do continue end
				end
				local home = Js.O({ shirt = p.homeKit.shirtHex, trim = p.homeKit.trimHex }, { "shirt", "trim" })
				if clashes(home.shirt, home.trim) then
					home.trim = contrast(home.shirt)
				end
				local away = Js.O({ shirt = p.awayKit.shirtHex, trim = p.awayKit.trimHex }, { "shirt", "trim" })
				if clashes(home.shirt, away.shirt) then
					local alt = (if ((not clashes(home.shirt, home.trim)) and (not clashes(home.trim, home.shirt))) then home.trim else contrast(home.shirt))
					away = Js.O({ shirt = alt, trim = home.shirt }, { "shirt", "trim" })
					if clashes(home.shirt, away.shirt) then
						away = Js.O({ shirt = contrast(home.shirt), trim = home.shirt }, { "shirt", "trim" })
					end
				end
				if clashes(away.shirt, away.trim) then
					away.trim = contrast(away.shirt)
				end
				out[p.club] = Js.O({ home = home, away = away }, { "home", "away" })
			end
		end
		do return out end
	end
	normalise = function(name)
		do return S.replace(S.toLowerCase(name), Js.re("[^a-z]", "g"), "") end
	end
	kitsOf = function(club, override)
		do return (((if override ~= nil then override else CLUB_KITS[club]) or BY_LOOSE[normalise(club)]) or NEUTRAL) end
	end
	exports.kitsOf = kitsOf
	hexToHsl = function(hex)
		local m = S.replace(hex, "#", "")
		local r = (Js.parseInt(S.slice(m, 0, 2), 16) / 255)
		local g = (Js.parseInt(S.slice(m, 2, 4), 16) / 255)
		local b = (Js.parseInt(S.slice(m, 4, 6), 16) / 255)
		local max = Math.max(r, g, b)
		local min = Math.min(r, g, b)
		local l = ((max + min) / 2)
		local d = (max - min)
		if (d == 0) then
			do return Js.O({ h = 0, s = 0, l = l }, { "h", "s", "l" }) end
		end
		local s = (if (l > 0.5) then (d / ((2 - max) - min)) else (d / (max + min)))
		local h = nil
		if (max == r) then
			h = ((((g - b) / d) + (if (g < b) then 6 else 0)) * 60)
		elseif (max == g) then
			h = ((((b - r) / d) + 2) * 60)
		else
			h = ((((r - g) / d) + 4) * 60)
		end
		do return Js.O({ h = h, s = s, l = l }, { "h", "s", "l" }) end
	end
	exports.hexToHsl = hexToHsl
	chroma = function(hex)
		local m = S.replace(hex, "#", "")
		local r = (Js.parseInt(S.slice(m, 0, 2), 16) / 255)
		local g = (Js.parseInt(S.slice(m, 2, 4), 16) / 255)
		local b = (Js.parseInt(S.slice(m, 4, 6), 16) / 255)
		do return (Math.max(r, g, b) - Math.min(r, g, b)) end
	end
	clashes = function(a, b)
		local A_ = hexToHsl(a)
		local B = hexToHsl(b)
		local aFlat = (chroma(a) < 0.1)
		local bFlat = (chroma(b) < 0.1)
		if (aFlat and bFlat) then
			do return (math.abs((A_.l - B.l)) < 0.35) end
		end
		if (aFlat ~= bFlat) then
			do return (math.abs((A_.l - B.l)) < 0.2) end
		end
		if (hueGap(A_.h, B.h) > 35) then
			do return false end
		end
		do return (math.abs((A_.l - B.l)) < 0.4) end
	end
	exports.clashes = clashes
	kitClashes = function(a, b)
		if clashes(a.shirt, b.shirt) then
			do return true end
		end
		do return (clashes(a.shirt, b.trim) and clashes(a.trim, b.shirt)) end
	end
	exports.kitClashes = kitClashes
	awayFallback = function(home, away)
		local plain = Js.alit("#17181A", "#F2F4F7", "#6B7280", "#001F5B", "#0057B8", "#159C56")
		local tries = Js.alit()
		do
			local _arr3 = Js.aspread(Js.alit(away.away.shirt, away.away.trim), plain)
			local _i4 = 0
			while _i4 < Js.alen(_arr3) do
				_i4 += 1
				local t = _arr3[_i4]
				A.push(tries, Js.O({ shirt = away.home.shirt, trim = t }, { "shirt", "trim" }))
			end
		end
		do
			local _arr5 = Js.aspread(Js.alit(away.home.shirt, away.home.trim), plain)
			local _i6 = 0
			while _i6 < Js.alen(_arr5) do
				_i6 += 1
				local t = _arr5[_i6]
				A.push(tries, Js.O({ shirt = away.away.shirt, trim = t }, { "shirt", "trim" }))
			end
		end
		local dark = (hexToHsl(home.shirt).l < 0.5)
		local last = (if dark then Js.alit("#F2F4F7", "#17181A") else Js.alit("#17181A", "#F2F4F7"))
		do
			local _arr7 = last
			local _i8 = 0
			while _i8 < Js.alen(_arr7) do
				_i8 += 1
				local shirt = _arr7[_i8]
				do
					local _arr9 = Js.aspread(Js.alit(away.away.trim, away.home.trim, away.home.shirt), plain)
					local _i10 = 0
					while _i10 < Js.alen(_arr9) do
						_i10 += 1
						local t = _arr9[_i10]
						A.push(tries, Js.O({ shirt = shirt, trim = t }, { "shirt", "trim" }))
					end
				end
			end
		end
		do
			local _arr11 = tries
			local _i12 = 0
			while _i12 < Js.alen(_arr11) do
				_i12 += 1
				local kit = _arr11[_i12]
				if ((not clashes(kit.shirt, kit.trim)) and (not kitClashes(home, kit))) then
					do return kit end
				end
			end
		end
		do return Js.O({ shirt = last[1], trim = away.away.trim }, { "shirt", "trim" }) end
	end
	kitsFor = function(homeClub, awayClub, homeOverride, awayOverride)
		local home = kitsOf(homeClub, homeOverride).home
		local away = kitsOf(awayClub, awayOverride)
		local chosen = (if (not kitClashes(home, away.home)) then away.home else (if (not kitClashes(home, away.away)) then away.away else awayFallback(home, away)))
		do return Js.O({ home = home, away = chosen, keeper = keeperKit(home.shirt, chosen.shirt) }, { "home", "away", "keeper" }) end
	end
	exports.kitsFor = kitsFor
	keeperKit = function(homeShirt, awayShirt)
		do
			local _arr13 = KEEPER_OPTIONS
			local _i14 = 0
			while _i14 < Js.alen(_arr13) do
				_i14 += 1
				local k = _arr13[_i14]
				if ((not clashes(homeShirt, k.shirt)) and (not clashes(awayShirt, k.shirt))) then
					do return k end
				end
			end
		end
		do return KEEPER_OPTIONS[Js.alen(KEEPER_OPTIONS)] end
	end
	exports.keeperKit = keeperKit
	labelInk = function(shirt)
		do return (if (hexToHsl(shirt).l > 0.62) then "#111827" else "#FFFFFF") end
	end
	exports.labelInk = labelInk
	hslToHex = function(_p15)
		local h = _p15.h
		local s = _p15.s
		local l = _p15.l
		local c = ((1 - math.abs(((2 * l) - 1))) * s)
		local x = (c * (1 - math.abs((math.fmod((h / 60), 2) - 1))))
		local m = (l - (c / 2))
		local _d16 = (if (h < 60) then Js.alit(c, x, 0) else (if (h < 120) then Js.alit(x, c, 0) else (if (h < 180) then Js.alit(0, c, x) else (if (h < 240) then Js.alit(0, x, c) else (if (h < 300) then Js.alit(x, 0, c) else Js.alit(c, 0, x))))))
		local r = _d16[1]
		local g = _d16[2]
		local b = _d16[3]
		local toHex = function(v)
			return S.padStart(N.toString(Math.round(((v + m) * 255)), 16), 2, "0")
		end
		do return ("#" .. toHex(r) .. toHex(g) .. toHex(b)) end
	end
	kitLabelOnDark = function(shirt, trim)
		local hsl = hexToHsl(shirt)
		if (hsl.l >= 0.5) then
			do return shirt end
		end
		if (chroma(shirt) >= 0.12) then
			do return hslToHex(Js.O({ h = hsl.h, s = Math.max(hsl.s, 0.45), l = 0.6 }, { "h", "s", "l" })) end
		end
		local trimHsl = hexToHsl(trim)
		do return (if (trimHsl.l >= 0.5) then trim else "#E5E7EB") end
	end
	exports.kitLabelOnDark = kitLabelOnDark
	NAMED = Js.O({ red = "#D71920", blue = "#0057B8", navy = "#001F5B", lightblue = "#6CABDD", white = "#F2F4F7", offwhite = "#F2F0E6", black = "#17181A", yellow = "#FBF000", amber = "#F2A900", gold = "#FDB913", orange = "#F78F1E", claret = "#6C1D45", green = "#159C56", maroon = "#7A263A" }, { "red", "blue", "navy", "lightblue", "white", "offwhite", "black", "yellow", "amber", "gold", "orange", "claret", "green", "maroon" })
	k = function(shirt, trim)
		return Js.O({ shirt = NAMED[shirt], trim = NAMED[trim] }, { "shirt", "trim" })
	end
	kits = function(home, away)
		return Js.O({ home = home, away = away }, { "home", "away" })
	end
	LOWER_LEAGUE_KITS = Js.O({ ["AFC Wimbledon"] = kits(k("blue", "white"), k("yellow", "blue")), Barnsley = kits(k("red", "white"), k("white", "blue")), Blackpool = kits(k("orange", "white"), k("white", "orange")), ["Bradford City"] = kits(k("claret", "amber"), k("white", "claret")), Bromley = kits(k("red", "black"), k("white", "black")), ["Burton Albion"] = kits(k("black", "yellow"), k("white", "black")), ["Cambridge United"] = kits(k("amber", "black"), k("black", "amber")), ["Doncaster Rovers"] = kits(k("red", "white"), k("white", "red")), ["Leyton Orient"] = kits(k("red", "white"), k("white", "red")), ["Mansfield Town"] = kits(k("yellow", "blue"), k("blue", "yellow")), ["Milton Keynes Dons"] = kits(k("white", "red"), k("red", "black")), ["Notts County"] = kits(k("black", "white"), k("white", "black")), ["Oxford United"] = kits(k("yellow", "blue"), k("blue", "yellow")), ["Peterborough United"] = kits(k("blue", "white"), k("white", "blue")), ["Plymouth Argyle"] = kits(k("green", "black"), k("white", "green")), ["Sheffield Wednesday"] = kits(k("blue", "white"), k("black", "blue")), Stevenage = kits(k("red", "white"), k("white", "red")), ["Stockport County"] = kits(k("blue", "white"), k("white", "blue")), ["Wycombe Wanderers"] = kits(k("blue", "white"), k("yellow", "navy")), ["Accrington Stanley"] = kits(k("red", "white"), k("white", "red")), Barnet = kits(k("orange", "black"), k("white", "orange")), ["Bristol Rovers"] = kits(k("blue", "white"), k("white", "blue")), ["Cheltenham Town"] = kits(k("red", "white"), k("white", "red")), Chesterfield = kits(k("blue", "white"), k("white", "blue")), ["Colchester United"] = kits(k("blue", "white"), k("yellow", "blue")), ["Crawley Town"] = kits(k("red", "white"), k("white", "red")), ["Crewe Alexandra"] = kits(k("red", "white"), k("white", "red")), ["Exeter City"] = kits(k("red", "black"), k("white", "red")), ["Fleetwood Town"] = kits(k("red", "white"), k("white", "red")), Gillingham = kits(k("blue", "white"), k("white", "blue")), ["Grimsby Town"] = kits(k("black", "white"), k("white", "black")), ["Newport County"] = kits(k("amber", "black"), k("white", "amber")), ["Northampton Town"] = kits(k("claret", "white"), k("white", "claret")), ["Oldham Athletic"] = kits(k("blue", "white"), k("white", "blue")), ["Port Vale"] = kits(k("black", "white"), k("white", "black")), Rochdale = kits(k("blue", "black"), k("white", "blue")), ["Rotherham United"] = kits(k("red", "white"), k("white", "red")), ["Salford City"] = kits(k("red", "white"), k("white", "red")), ["Shrewsbury Town"] = kits(k("navy", "lightblue"), k("amber", "navy")), ["Swindon Town"] = kits(k("red", "white"), k("white", "red")), ["Tranmere Rovers"] = kits(k("white", "blue"), k("black", "white")), Walsall = kits(k("red", "white"), k("white", "red")), ["York City"] = kits(k("red", "white"), k("white", "red")), ["AFC Fylde"] = kits(k("red", "blue"), k("blue", "white")), ["Aldershot Town"] = kits(k("red", "blue"), k("white", "red")), Altrincham = kits(k("red", "white"), k("white", "red")), Barrow = kits(k("blue", "white"), k("white", "blue")), ["Boreham Wood"] = kits(k("black", "white"), k("white", "black")), ["Boston United"] = kits(k("yellow", "black"), k("white", "yellow")), ["Carlisle United"] = kits(k("blue", "white"), k("white", "blue")), Eastleigh = kits(k("blue", "white"), k("white", "blue")), ["FC Halifax Town"] = kits(k("blue", "white"), k("yellow", "blue")), ["Forest Green Rovers"] = kits(k("green", "black"), k("white", "green")), Gateshead = kits(k("red", "black"), k("white", "red")), ["Harrogate Town"] = kits(k("black", "yellow"), k("white", "black")), ["Hartlepool United"] = kits(k("blue", "white"), k("yellow", "blue")), Hornchurch = kits(k("red", "blue"), k("white", "red")), ["Kidderminster Harriers"] = kits(k("red", "white"), k("black", "yellow")), ["Scunthorpe United"] = kits(k("red", "white"), k("blue", "white")), ["Solihull Moors"] = kits(k("black", "yellow"), k("yellow", "black")), ["Southend United"] = kits(k("blue", "white"), k("white", "blue")), ["Sutton United"] = kits(k("amber", "maroon"), k("white", "amber")), Tamworth = kits(k("red", "white"), k("offwhite", "maroon")), Wealdstone = kits(k("blue", "white"), k("white", "blue")), Woking = kits(k("red", "white"), k("yellow", "navy")), Worthing = kits(k("red", "blue"), k("blue", "red")), ["Yeovil Town"] = kits(k("green", "white"), k("white", "green")), ["AFC Telford United"] = kits(k("white", "black"), k("navy", "white")), ["Alfreton Town"] = kits(k("red", "white"), k("white", "red")), ["Bedford Town"] = kits(k("blue", "white"), k("white", "blue")), ["Brackley Town"] = kits(k("red", "white"), k("navy", "white")), Buxton = kits(k("blue", "white"), k("white", "blue")), Chester = kits(k("blue", "white"), k("white", "blue")), Chorley = kits(k("black", "white"), k("yellow", "black")), ["Curzon Ashton"] = kits(k("blue", "white"), k("amber", "black")), Darlington = kits(k("black", "white"), k("red", "white")), ["Hednesford Town"] = kits(k("white", "black"), k("red", "white")), Hereford = kits(k("white", "black"), k("blue", "white")), ["King's Lynn Town"] = kits(k("yellow", "blue"), k("blue", "yellow")), Leamington = kits(k("gold", "black"), k("white", "black")), Macclesfield = kits(k("blue", "white"), k("white", "blue")), Marine = kits(k("white", "black"), k("gold", "black")), ["Merthyr Town"] = kits(k("white", "black"), k("black", "white")), Morecambe = kits(k("red", "white"), k("white", "black")), ["Peterborough Sports"] = kits(k("blue", "white"), k("white", "blue")), Radcliffe = kits(k("blue", "white"), k("white", "blue")), ["Scarborough Athletic"] = kits(k("red", "white"), k("white", "red")), ["South Shields"] = kits(k("claret", "lightblue"), k("white", "claret")), Southport = kits(k("yellow", "black"), k("black", "yellow")), ["Spennymoor Town"] = kits(k("black", "white"), k("white", "black")), ["Worksop Town"] = kits(k("amber", "black"), k("white", "black")), ["AFC Totton"] = kits(k("blue", "white"), k("white", "blue")), ["Bath City"] = kits(k("black", "white"), k("white", "black")), ["Braintree Town"] = kits(k("orange", "blue"), k("blue", "orange")), ["Chelmsford City"] = kits(k("claret", "white"), k("white", "claret")), ["Chesham United"] = kits(k("claret", "lightblue"), k("white", "claret")), ["Chippenham Town"] = kits(k("blue", "white"), k("white", "blue")), ["Dagenham & Redbridge"] = kits(k("red", "blue"), k("blue", "white")), ["Dorking Wanderers"] = kits(k("red", "blue"), k("black", "yellow")), ["Eastbourne Borough"] = kits(k("red", "black"), k("white", "red")), ["Ebbsfleet United"] = kits(k("red", "white"), k("white", "red")), ["Enfield Town"] = kits(k("white", "blue"), k("blue", "white")), Farnborough = kits(k("yellow", "blue"), k("blue", "yellow")), ["Hampton & Richmond Borough"] = kits(k("red", "blue"), k("white", "red")), ["Hemel Hempstead Town"] = kits(k("red", "white"), k("white", "red")), Horsham = kits(k("yellow", "green"), k("green", "yellow")), ["Maidenhead United"] = kits(k("black", "white"), k("white", "black")), ["Maidstone United"] = kits(k("amber", "black"), k("white", "black")), ["St Albans City"] = kits(k("yellow", "blue"), k("blue", "yellow")), Salisbury = kits(k("white", "black"), k("black", "white")), ["Slough Town"] = kits(k("amber", "navy"), k("navy", "amber")), ["Tonbridge Angels"] = kits(k("blue", "white"), k("white", "blue")), ["Torquay United"] = kits(k("yellow", "navy"), k("blue", "yellow")), ["Truro City"] = kits(k("white", "black"), k("black", "white")), ["Weston-super-Mare"] = kits(k("white", "black"), k("black", "white")) }, { "AFC Wimbledon", "Barnsley", "Blackpool", "Bradford City", "Bromley", "Burton Albion", "Cambridge United", "Doncaster Rovers", "Leyton Orient", "Mansfield Town", "Milton Keynes Dons", "Notts County", "Oxford United", "Peterborough United", "Plymouth Argyle", "Sheffield Wednesday", "Stevenage", "Stockport County", "Wycombe Wanderers", "Accrington Stanley", "Barnet", "Bristol Rovers", "Cheltenham Town", "Chesterfield", "Colchester United", "Crawley Town", "Crewe Alexandra", "Exeter City", "Fleetwood Town", "Gillingham", "Grimsby Town", "Newport County", "Northampton Town", "Oldham Athletic", "Port Vale", "Rochdale", "Rotherham United", "Salford City", "Shrewsbury Town", "Swindon Town", "Tranmere Rovers", "Walsall", "York City", "AFC Fylde", "Aldershot Town", "Altrincham", "Barrow", "Boreham Wood", "Boston United", "Carlisle United", "Eastleigh", "FC Halifax Town", "Forest Green Rovers", "Gateshead", "Harrogate Town", "Hartlepool United", "Hornchurch", "Kidderminster Harriers", "Scunthorpe United", "Solihull Moors", "Southend United", "Sutton United", "Tamworth", "Wealdstone", "Woking", "Worthing", "Yeovil Town", "AFC Telford United", "Alfreton Town", "Bedford Town", "Brackley Town", "Buxton", "Chester", "Chorley", "Curzon Ashton", "Darlington", "Hednesford Town", "Hereford", "King's Lynn Town", "Leamington", "Macclesfield", "Marine", "Merthyr Town", "Morecambe", "Peterborough Sports", "Radcliffe", "Scarborough Athletic", "South Shields", "Southport", "Spennymoor Town", "Worksop Town", "AFC Totton", "Bath City", "Braintree Town", "Chelmsford City", "Chesham United", "Chippenham Town", "Dagenham & Redbridge", "Dorking Wanderers", "Eastbourne Borough", "Ebbsfleet United", "Enfield Town", "Farnborough", "Hampton & Richmond Borough", "Hemel Hempstead Town", "Horsham", "Maidenhead United", "Maidstone United", "St Albans City", "Salisbury", "Slough Town", "Tonbridge Angels", "Torquay United", "Truro City", "Weston-super-Mare" })
	CLUB_KITS = Js.ospread(Js.O({ Arsenal = Js.O({ home = Js.O({ shirt = "#EF0107", trim = "#FFFFFF" }, { "shirt", "trim" }), away = Js.O({ shirt = "#F2D65C", trim = "#0B3B72" }, { "shirt", "trim" }) }, { "home", "away" }), ["Aston Villa"] = Js.O({ home = Js.O({ shirt = "#670E36", trim = "#95BFE5" }, { "shirt", "trim" }), away = Js.O({ shirt = "#F2F4F7", trim = "#670E36" }, { "shirt", "trim" }) }, { "home", "away" }), ["AFC Bournemouth"] = Js.O({ home = Js.O({ shirt = "#DA291C", trim = "#111111" }, { "shirt", "trim" }), away = Js.O({ shirt = "#F2F4F7", trim = "#DA291C" }, { "shirt", "trim" }) }, { "home", "away" }), Brentford = Js.O({ home = Js.O({ shirt = "#E30613", trim = "#FFFFFF" }, { "shirt", "trim" }), away = Js.O({ shirt = "#17181A", trim = "#E30613" }, { "shirt", "trim" }) }, { "home", "away" }), ["Brighton & Hove Albion"] = Js.O({ home = Js.O({ shirt = "#0057B8", trim = "#FFFFFF" }, { "shirt", "trim" }), away = Js.O({ shirt = "#F5E14C", trim = "#0057B8" }, { "shirt", "trim" }) }, { "home", "away" }), Burnley = Js.O({ home = Js.O({ shirt = "#6C1D45", trim = "#99D6EA" }, { "shirt", "trim" }), away = Js.O({ shirt = "#99D6EA", trim = "#6C1D45" }, { "shirt", "trim" }) }, { "home", "away" }), Chelsea = Js.O({ home = Js.O({ shirt = "#034694", trim = "#FFFFFF" }, { "shirt", "trim" }), away = Js.O({ shirt = "#F5E14C", trim = "#034694" }, { "shirt", "trim" }) }, { "home", "away" }), ["Crystal Palace"] = Js.O({ home = Js.O({ shirt = "#1B458F", trim = "#C4122E" }, { "shirt", "trim" }), away = Js.O({ shirt = "#F2F4F7", trim = "#1B458F" }, { "shirt", "trim" }) }, { "home", "away" }), Everton = Js.O({ home = Js.O({ shirt = "#003399", trim = "#FFFFFF" }, { "shirt", "trim" }), away = Js.O({ shirt = "#EAB308", trim = "#003399" }, { "shirt", "trim" }) }, { "home", "away" }), ["Fulham FC"] = Js.O({ home = Js.O({ shirt = "#FFFFFF", trim = "#111111" }, { "shirt", "trim" }), away = Js.O({ shirt = "#17181A", trim = "#CC0000" }, { "shirt", "trim" }) }, { "home", "away" }), ["Hull City"] = Js.O({ home = Js.O({ shirt = "#F2A900", trim = "#111111" }, { "shirt", "trim" }), away = Js.O({ shirt = "#FFFFFF", trim = "#F2A900" }, { "shirt", "trim" }) }, { "home", "away" }), ["Ipswich Town"] = Js.O({ home = Js.O({ shirt = "#0044A9", trim = "#FFFFFF" }, { "shirt", "trim" }), away = Js.O({ shirt = "#E8D8B8", trim = "#C8102E" }, { "shirt", "trim" }) }, { "home", "away" }), ["Coventry City"] = Js.O({ home = Js.O({ shirt = "#6CACE4", trim = "#041E42" }, { "shirt", "trim" }), away = Js.O({ shirt = "#F2F0E6", trim = "#FF6B5A" }, { "shirt", "trim" }) }, { "home", "away" }), ["Leeds United"] = Js.O({ home = Js.O({ shirt = "#FFFFFF", trim = "#1D428A" }, { "shirt", "trim" }), away = Js.O({ shirt = "#1D428A", trim = "#FFCD00" }, { "shirt", "trim" }) }, { "home", "away" }), Liverpool = Js.O({ home = Js.O({ shirt = "#C8102E", trim = "#FFFFFF" }, { "shirt", "trim" }), away = Js.O({ shirt = "#F2F4F7", trim = "#C8102E" }, { "shirt", "trim" }) }, { "home", "away" }), ["Manchester City"] = Js.O({ home = Js.O({ shirt = "#6CABDD", trim = "#1C2C5B" }, { "shirt", "trim" }), away = Js.O({ shirt = "#F2F4F7", trim = "#1C2C5B" }, { "shirt", "trim" }) }, { "home", "away" }), ["Manchester United"] = Js.O({ home = Js.O({ shirt = "#DA291C", trim = "#FFFFFF" }, { "shirt", "trim" }), away = Js.O({ shirt = "#17181A", trim = "#DA291C" }, { "shirt", "trim" }) }, { "home", "away" }), ["Newcastle United"] = Js.O({ home = Js.O({ shirt = "#241F20", trim = "#FFFFFF" }, { "shirt", "trim" }), away = Js.O({ shirt = "#F2F4F7", trim = "#241F20" }, { "shirt", "trim" }) }, { "home", "away" }), ["Nottingham Forest"] = Js.O({ home = Js.O({ shirt = "#DD0000", trim = "#FFFFFF" }, { "shirt", "trim" }), away = Js.O({ shirt = "#F2F4F7", trim = "#DD0000" }, { "shirt", "trim" }) }, { "home", "away" }), Sunderland = Js.O({ home = Js.O({ shirt = "#EB172B", trim = "#FFFFFF" }, { "shirt", "trim" }), away = Js.O({ shirt = "#17181A", trim = "#EB172B" }, { "shirt", "trim" }) }, { "home", "away" }), ["Tottenham Hotspur"] = Js.O({ home = Js.O({ shirt = "#FFFFFF", trim = "#132257" }, { "shirt", "trim" }), away = Js.O({ shirt = "#132257", trim = "#FFFFFF" }, { "shirt", "trim" }) }, { "home", "away" }), ["West Ham United"] = Js.O({ home = Js.O({ shirt = "#7A263A", trim = "#1BB1E7" }, { "shirt", "trim" }), away = Js.O({ shirt = "#F2F4F7", trim = "#7A263A" }, { "shirt", "trim" }) }, { "home", "away" }), ["Wolverhampton Wanderers"] = Js.O({ home = Js.O({ shirt = "#FDB913", trim = "#231F20" }, { "shirt", "trim" }), away = Js.O({ shirt = "#17181A", trim = "#FDB913" }, { "shirt", "trim" }) }, { "home", "away" }), ["Queens Park Rangers"] = Js.O({ home = Js.O({ shirt = "#0057B8", trim = "#F2C94C" }, { "shirt", "trim" }), away = Js.O({ shirt = "#B8A9D9", trim = "#0057B8" }, { "shirt", "trim" }) }, { "home", "away" }), ["Millwall FC"] = Js.O({ home = Js.O({ shirt = "#001F5B", trim = "#D4AF37" }, { "shirt", "trim" }), away = Js.O({ shirt = "#FFFFFF", trim = "#001F5B" }, { "shirt", "trim" }) }, { "home", "away" }), ["Bolton Wanderers"] = Js.O({ home = Js.O({ shirt = "#FFFFFF", trim = "#001F3F" }, { "shirt", "trim" }), away = Js.O({ shirt = "#7A263A", trim = "#D4AF37" }, { "shirt", "trim" }) }, { "home", "away" }), Watford = Js.O({ home = Js.O({ shirt = "#FBF000", trim = "#111111" }, { "shirt", "trim" }), away = Js.O({ shirt = "#D71920", trim = "#FBF000" }, { "shirt", "trim" }) }, { "home", "away" }), Middlesbrough = Js.O({ home = Js.O({ shirt = "#E31B23", trim = "#FFFFFF" }, { "shirt", "trim" }), away = Js.O({ shirt = "#FFFFFF", trim = "#E31B23" }, { "shirt", "trim" }) }, { "home", "away" }), ["Charlton Athletic"] = Js.O({ home = Js.O({ shirt = "#D71920", trim = "#FFFFFF" }, { "shirt", "trim" }), away = Js.O({ shirt = "#111111", trim = "#D71920" }, { "shirt", "trim" }) }, { "home", "away" }), ["Swansea City"] = Js.O({ home = Js.O({ shirt = "#FFFFFF", trim = "#B87333" }, { "shirt", "trim" }), away = Js.O({ shirt = "#111111", trim = "#B87333" }, { "shirt", "trim" }) }, { "home", "away" }), ["West Bromwich Albion"] = Js.O({ home = Js.O({ shirt = "#122F67", trim = "#FFFFFF" }, { "shirt", "trim" }), away = Js.O({ shirt = "#9CA3AF", trim = "#122F67" }, { "shirt", "trim" }) }, { "home", "away" }), ["Blackburn Rovers"] = Js.O({ home = Js.O({ shirt = "#009FE3", trim = "#FFFFFF" }, { "shirt", "trim" }), away = Js.O({ shirt = "#111111", trim = "#FFFFFF" }, { "shirt", "trim" }) }, { "home", "away" }), ["Cardiff City"] = Js.O({ home = Js.O({ shirt = "#0070B8", trim = "#FFFFFF" }, { "shirt", "trim" }), away = Js.O({ shirt = "#FFFFFF", trim = "#0070B8" }, { "shirt", "trim" }) }, { "home", "away" }), Wrexham = Js.O({ home = Js.O({ shirt = "#E31B23", trim = "#FFFFFF" }, { "shirt", "trim" }), away = Js.O({ shirt = "#FFFFFF", trim = "#E31B23" }, { "shirt", "trim" }) }, { "home", "away" }), ["Birmingham City"] = Js.O({ home = Js.O({ shirt = "#0057B8", trim = "#FFFFFF" }, { "shirt", "trim" }), away = Js.O({ shirt = "#FFD500", trim = "#0057B8" }, { "shirt", "trim" }) }, { "home", "away" }), ["Sheffield United"] = Js.O({ home = Js.O({ shirt = "#EE2737", trim = "#111111" }, { "shirt", "trim" }), away = Js.O({ shirt = "#111111", trim = "#EE2737" }, { "shirt", "trim" }) }, { "home", "away" }), ["Lincoln City"] = Js.O({ home = Js.O({ shirt = "#E30613", trim = "#111111" }, { "shirt", "trim" }), away = Js.O({ shirt = "#111111", trim = "#F5D547" }, { "shirt", "trim" }) }, { "home", "away" }), ["Preston North End"] = Js.O({ home = Js.O({ shirt = "#FFFFFF", trim = "#001F5B" }, { "shirt", "trim" }), away = Js.O({ shirt = "#0057B8", trim = "#F2C500" }, { "shirt", "trim" }) }, { "home", "away" }), ["Norwich City"] = Js.O({ home = Js.O({ shirt = "#FFF200", trim = "#00A650" }, { "shirt", "trim" }), away = Js.O({ shirt = "#111111", trim = "#FFF200" }, { "shirt", "trim" }) }, { "home", "away" }), ["Stoke City"] = Js.O({ home = Js.O({ shirt = "#E03A3E", trim = "#FFFFFF" }, { "shirt", "trim" }), away = Js.O({ shirt = "#FFFFFF", trim = "#E03A3E" }, { "shirt", "trim" }) }, { "home", "away" }), ["Derby County"] = Js.O({ home = Js.O({ shirt = "#FFFFFF", trim = "#111111" }, { "shirt", "trim" }), away = Js.O({ shirt = "#111111", trim = "#FFFFFF" }, { "shirt", "trim" }) }, { "home", "away" }), Portsmouth = Js.O({ home = Js.O({ shirt = "#001F5B", trim = "#FFFFFF" }, { "shirt", "trim" }), away = Js.O({ shirt = "#FFFFFF", trim = "#001F5B" }, { "shirt", "trim" }) }, { "home", "away" }), ["Bristol City"] = Js.O({ home = Js.O({ shirt = "#E30613", trim = "#FFFFFF" }, { "shirt", "trim" }), away = Js.O({ shirt = "#C9CDD1", trim = "#1F2937" }, { "shirt", "trim" }) }, { "home", "away" }), Southampton = Js.O({ home = Js.O({ shirt = "#D71920", trim = "#111111" }, { "shirt", "trim" }), away = Js.O({ shirt = "#6FA8DC", trim = "#E8A9C2" }, { "shirt", "trim" }) }, { "home", "away" }), ["Luton Town"] = Js.O({ home = Js.O({ shirt = "#F78F1E", trim = "#002D62" }, { "shirt", "trim" }), away = Js.O({ shirt = "#002D62", trim = "#F78F1E" }, { "shirt", "trim" }) }, { "home", "away" }), ["Huddersfield Town"] = Js.O({ home = Js.O({ shirt = "#0044A3", trim = "#FFFFFF" }, { "shirt", "trim" }), away = Js.O({ shirt = "#FFFFFF", trim = "#0044A3" }, { "shirt", "trim" }) }, { "home", "away" }), ["Leicester City"] = Js.O({ home = Js.O({ shirt = "#003090", trim = "#FDBE11" }, { "shirt", "trim" }), away = Js.O({ shirt = "#FFFFFF", trim = "#003090" }, { "shirt", "trim" }) }, { "home", "away" }), ["Reading FC"] = Js.O({ home = Js.O({ shirt = "#004494", trim = "#FFFFFF" }, { "shirt", "trim" }), away = Js.O({ shirt = "#FFFFFF", trim = "#004494" }, { "shirt", "trim" }) }, { "home", "away" }), ["Wigan Athletic"] = Js.O({ home = Js.O({ shirt = "#1B458F", trim = "#FFFFFF" }, { "shirt", "trim" }), away = Js.O({ shirt = "#FFFFFF", trim = "#1B458F" }, { "shirt", "trim" }) }, { "home", "away" }) }, { "Arsenal", "Aston Villa", "AFC Bournemouth", "Brentford", "Brighton & Hove Albion", "Burnley", "Chelsea", "Crystal Palace", "Everton", "Fulham FC", "Hull City", "Ipswich Town", "Coventry City", "Leeds United", "Liverpool", "Manchester City", "Manchester United", "Newcastle United", "Nottingham Forest", "Sunderland", "Tottenham Hotspur", "West Ham United", "Wolverhampton Wanderers", "Queens Park Rangers", "Millwall FC", "Bolton Wanderers", "Watford", "Middlesbrough", "Charlton Athletic", "Swansea City", "West Bromwich Albion", "Blackburn Rovers", "Cardiff City", "Wrexham", "Birmingham City", "Sheffield United", "Lincoln City", "Preston North End", "Norwich City", "Stoke City", "Derby County", "Portsmouth", "Bristol City", "Southampton", "Luton Town", "Huddersfield Town", "Leicester City", "Reading FC", "Wigan Athletic" }), LOWER_LEAGUE_KITS)
	exports.CLUB_KITS = CLUB_KITS
	NEUTRAL = Js.O({ home = Js.O({ shirt = "#2F6F4E", trim = "#F2F4F7" }, { "shirt", "trim" }), away = Js.O({ shirt = "#F2F4F7", trim = "#2F6F4E" }, { "shirt", "trim" }) }, { "home", "away" })
	BY_LOOSE = (function()
		local out = Js.O({}, nil)
		do
			local _arr17 = Js.Object.entries(CLUB_KITS)
			local _i18 = 0
			while _i18 < Js.alen(_arr17) do
				_i18 += 1
				local _e19 = _arr17[_i18]
				local k = _e19[1]
				local v = _e19[2]
				out[normalise(k)] = v
			end
		end
		local alias = Js.O({ wolves = "Wolverhampton Wanderers", wolverhampton = "Wolverhampton Wanderers", spurs = "Tottenham Hotspur", tottenham = "Tottenham Hotspur", manutd = "Manchester United", manunited = "Manchester United", mancity = "Manchester City", city = "Manchester City", fulham = "Fulham FC", bournemouth = "AFC Bournemouth", brighton = "Brighton & Hove Albion", palace = "Crystal Palace", newcastle = "Newcastle United", forest = "Nottingham Forest", nottmforest = "Nottingham Forest", leeds = "Leeds United", westham = "West Ham United", villa = "Aston Villa" }, { "wolves", "wolverhampton", "spurs", "tottenham", "manutd", "manunited", "mancity", "city", "fulham", "bournemouth", "brighton", "palace", "newcastle", "forest", "nottmforest", "leeds", "westham", "villa" })
		do
			local _arr20 = Js.Object.entries(alias)
			local _i21 = 0
			while _i21 < Js.alen(_arr20) do
				_i21 += 1
				local _e22 = _arr20[_i21]
				local a = _e22[1]
				local real = _e22[2]
				out[a] = CLUB_KITS[real]
			end
		end
		do return out end
	end)()
	hueGap = function(a, b)
		local d = math.fmod(math.abs((a - b)), 360)
		do return (if (d > 180) then (360 - d) else d) end
	end
	KEEPER_OPTIONS = Js.alit(Js.O({ shirt = "#FBBF24", trim = "#92400E" }, { "shirt", "trim" }), Js.O({ shirt = "#84CC16", trim = "#3F6212" }, { "shirt", "trim" }), Js.O({ shirt = "#E879F9", trim = "#86198F" }, { "shirt", "trim" }), Js.O({ shirt = "#2DD4BF", trim = "#115E59" }, { "shirt", "trim" }), Js.O({ shirt = "#1F2937", trim = "#9CA3AF" }, { "shirt", "trim" }))
	Js.Object.assign(CLUB_KITS, legibleGivenKits())
end
