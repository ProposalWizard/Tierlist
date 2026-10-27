--!nocheck
--!nolint
-- Generated from lib/star/media/accounts.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_kits = import("lib/star/kits")
	local M_grammar = import("lib/star/media/grammar")
	local M_calendar = import("lib/star/calendar")
	local M_rivalries = import("lib/star/rivalries")
	local M_season = import("lib/star/season")
	local M_fame = import("lib/star/fame")
	local VOICES, INTERESTS, TINTS, NATIONAL, FAN_HANDLES, FAN_NAMES, GLYPHS, hexToRgb, rgbToHex, rgbToHsl, hslToRgb, shade, towardWhite, hueRotate, gradientPartner, pickUnused, avatarFor, account, clubHandle, LEAGUE_FOLLOWERS, leagueAccountSeed, buildRoster, nationalTeamAccount, selfAccount
	hexToRgb = function(hex)
		local n = Js.parseInt(S.replace(hex, "#", ""), 16)
		do return Js.alit(Js.band(Js.shr(n, 16), 255), Js.band(Js.shr(n, 8), 255), Js.band(n, 255)) end
	end
	rgbToHex = function(r, g, b)
		local c = function(v)
			return Math.max(0, Math.min(255, Math.round(v)))
		end
		do return ("#" .. S.padStart(N.toString(Js.bor(Js.bor(Js.shl(c(r), 16), Js.shl(c(g), 8)), c(b)), 16), 6, "0")) end
	end
	rgbToHsl = function(r, g, b)
		r /= 255
		g /= 255
		b /= 255
		local max = Math.max(r, g, b)
		local min = Math.min(r, g, b)
		local l = ((max + min) / 2)
		if (max == min) then
			do return Js.alit(0, 0, l) end
		end
		local d = (max - min)
		local s = (if (l > 0.5) then (d / ((2 - max) - min)) else (d / (max + min)))
		local h = nil
		if (max == r) then
			h = (((g - b) / d) + (if (g < b) then 6 else 0))
		elseif (max == g) then
			h = (((b - r) / d) + 2)
		else
			h = (((r - g) / d) + 4)
		end
		do return Js.alit((h * 60), s, l) end
	end
	hslToRgb = function(h, s, l)
		h = (math.fmod((math.fmod(h, 360) + 360), 360) / 360)
		if (s == 0) then
			do return Js.alit((l * 255), (l * 255), (l * 255)) end
		end
		local q = (if (l < 0.5) then (l * (1 + s)) else ((l + s) - (l * s)))
		local p = ((2 * l) - q)
		local hue2rgb = function(t)
			if (t < 0) then
				t += 1
			end
			if (t > 1) then
				t -= 1
			end
			if (t < (1 / 6)) then
				do return (p + (((q - p) * 6) * t)) end
			end
			if (t < (1 / 2)) then
				do return q end
			end
			if (t < (2 / 3)) then
				do return (p + (((q - p) * ((2 / 3) - t)) * 6)) end
			end
			do return p end
		end
		do return Js.alit((hue2rgb((h + (1 / 3))) * 255), (hue2rgb(h) * 255), (hue2rgb((h - (1 / 3))) * 255)) end
	end
	shade = function(hex, by)
		local _d1 = hexToRgb(hex)
		local r = _d1[1]
		local g = _d1[2]
		local b = _d1[3]
		do return rgbToHex((r * by), (g * by), (b * by)) end
	end
	towardWhite = function(hex, by)
		local _d2 = hexToRgb(hex)
		local r = _d2[1]
		local g = _d2[2]
		local b = _d2[3]
		do return rgbToHex((r + ((255 - r) * by)), (g + ((255 - g) * by)), (b + ((255 - b) * by))) end
	end
	hueRotate = function(hex, degrees)
		local _d3 = rgbToHsl(Js.unpack(hexToRgb(hex)))
		local h = _d3[1]
		local s = _d3[2]
		local l = _d3[3]
		do return rgbToHex(Js.unpack(hslToRgb((h + degrees), s, l))) end
	end
	gradientPartner = function(tint, rng)
		local roll = rng()
		if (roll < 0.4) then
			do return shade(tint, (0.5 + (rng() * 0.2))) end
		end
		if (roll < 0.75) then
			do return towardWhite(tint, (0.45 + (rng() * 0.3))) end
		end
		do return hueRotate(tint, ((if (rng() < 0.5) then -1 else 1) * (24 + (rng() * 40)))) end
	end
	pickUnused = function(pool, rng, used)
		local glyph = pool[1]
		local tintIndex = 0
		for attempt = 0, 59 do
			glyph = pool[math.floor((rng() * Js.alen(pool))) + 1]
			tintIndex = math.floor((rng() * Js.alen(TINTS)))
			local key = (glyph .. "|" .. Js.numstr(tintIndex))
			if (not used:has(key)) then
				used:add(key)
				do return Js.O({ glyph = glyph, tintIndex = tintIndex }, { "glyph", "tintIndex" }) end
			end
		end
		do return Js.O({ glyph = glyph, tintIndex = tintIndex }, { "glyph", "tintIndex" }) end
	end
	avatarFor = function(s, rng, used)
		local pool = GLYPHS[s.archetype]
		local kit = (if Js.T(s.club) then M_kits.kitsOf(s.club).home else nil)
		if kit then
			do return Js.O({ initials = M_grammar.initialsOf(s.name), tint = kit.shirt, tint2 = kit.trim, glyph = pool[math.floor((rng() * Js.alen(pool))) + 1] }, { "initials", "tint", "tint2", "glyph" }) end
		end
		local _d4 = pickUnused(pool, rng, used)
		local glyph = _d4.glyph
		local tintIndex = _d4.tintIndex
		local tint = TINTS[tintIndex + 1]
		do return Js.O({ initials = M_grammar.initialsOf(s.name), tint = tint, tint2 = gradientPartner(tint, rng), glyph = glyph }, { "initials", "tint", "tint2", "glyph" }) end
	end
	account = function(s, rngSeed, used)
		local rng = M_grammar.rngFor("acct", rngSeed, s.handle)
		do return Js.O({ id = s.handle, handle = s.handle, name = s.name, archetype = s.archetype, platform = (if s.platform ~= nil then s.platform else "x"), verified = (if s.verified ~= nil then s.verified else false), followers = s.followers, avatar = avatarFor(s, rng, used), voice = VOICES[s.archetype], interests = INTERESTS[s.archetype] }, { "id", "handle", "name", "archetype", "platform", "verified", "followers", "avatar", "voice", "interests" }) end
	end
	clubHandle = function(club)
		do return ("@" .. S.replace(club, Js.re("[^A-Za-z]", "g"), "")) end
	end
	leagueAccountSeed = function(career)
		local division = M_calendar.divisionOf(career)
		local name = M_calendar.leagueNameFor(division)
		do return Js.O({ handle = ("@" .. S.replace(name, Js.re("[^A-Za-z]", "g"), "")), name = name, archetype = "league", verified = true, followers = (if LEAGUE_FOLLOWERS[division] ~= nil then LEAGUE_FOLLOWERS[division] else 100000) }, { "handle", "name", "archetype", "verified", "followers" }) end
	end
	exports.leagueAccountSeed = leagueAccountSeed
	buildRoster = function(career)
		local clubs = A.map(career.league, function(t)
			return t.name
		end)
		local me = career.player.club
		local rival = M_rivalries.primaryRivalOf(me)
		local leader = (function() local _v = M_season.sortLeague(career.league)[1]; if _v == nil then return nil end; _v = _v.name; return _v end)()
		local seedKey = (me .. "|" .. Js.numstr(Js.alen(clubs)) .. "|" .. Js.numstr(career.season))
		local out = Js.alit()
		local used = Js.Set.new()
		do
			local _arr5 = career.league
			local _i6 = 0
			while _i6 < Js.alen(_arr5) do
				_i6 += 1
				local c = _arr5[_i6]
				local strength = c.strength
				A.push(out, Js.ospread(account(Js.O({ handle = clubHandle(c.name), name = (if Js.re("\\bA?FC\\b", ""):test(c.name) then c.name else (c.name .. " FC")), archetype = "club", verified = true, followers = Math.round((200000 + ((strength / 100) * 8000000))), club = c.name }, { "handle", "name", "archetype", "verified", "followers", "club" }), seedKey, used), Js.O({ allegiance = Js.O({ club = c.name, polarity = 1 }, { "club", "polarity" }) }, { "allegiance" })))
			end
		end
		A.push(out, account(leagueAccountSeed(career), seedKey, used))
		local comps = Js.aspread(Js.alit("FA Cup", "Champions League", "Europa League"), (if M_calendar.inLowerLeagueTrophy(M_calendar.divisionOf(career)) then Js.alit("Lower League Trophy") else Js.alit()))
		do
			local _arr7 = comps
			local _i8 = 0
			while _i8 < Js.alen(_arr7) do
				_i8 += 1
				local comp = _arr7[_i8]
				A.push(out, account(Js.O({ handle = ("@" .. S.replace(comp, Js.re("\\s+", "g"), "")), name = comp, archetype = "competition", verified = true, followers = (if (comp == "Champions League") then 9000000 else (if (comp == "Lower League Trophy") then 60000 else 1400000)) }, { "handle", "name", "archetype", "verified", "followers" }), seedKey, used))
			end
		end
		do
			local _arr9 = NATIONAL
			local _i10 = 0
			while _i10 < Js.alen(_arr9) do
				_i10 += 1
				local s = _arr9[_i10]
				A.push(out, account(s, seedKey, used))
			end
		end
		local rng = M_grammar.rngFor("fans", seedKey)
		for i = 0, 4 do
			local h = FAN_HANDLES[math.fmod((M_grammar.hashSeed(me) + (i * 7)), Js.alen(FAN_HANDLES)) + 1]
			A.push(out, Js.ospread(account(Js.O({ handle = ("@" .. h), name = FAN_NAMES[math.fmod((M_grammar.hashSeed(me) + (i * 7)), Js.alen(FAN_NAMES)) + 1], archetype = "fan", followers = (200 + math.floor((rng() * 9000))) }, { "handle", "name", "archetype", "followers" }), (seedKey .. Js.numstr(i)), used), Js.O({ allegiance = Js.O({ club = me, polarity = 1 }, { "club", "polarity" }) }, { "allegiance" })))
		end
		local hostile = A.filter(Js.alit(rival, leader), function(c)
			return ((not (not Js.T(c))) and (c ~= me))
		end)
		do
			local _arr11 = Js.Array.from(Js.Set.new(hostile))
			local _i12 = 0
			while _i12 < Js.alen(_arr11) do
				_i12 += 1
				local c = _arr11[_i12]
				A.push(out, Js.ospread(account(Js.O({ handle = ("@" .. S.toLowerCase(S.slice(S.replace(c, Js.re("[^A-Za-z]", "g"), ""), 0, 10)) .. "_til_i_die"), name = (c .. " 'til I die"), archetype = "rivalFan", followers = (1500 + math.floor((rng() * 20000))) }, { "handle", "name", "archetype", "followers" }), (seedKey .. c), used), Js.O({ allegiance = Js.O({ club = c, polarity = -1 }, { "club", "polarity" }) }, { "allegiance" })))
			end
		end
		A.push(out, account(Js.O({ handle = "@GroundNoise", name = "Ground Noise", archetype = "fan", verified = false, followers = 38000 }, { "handle", "name", "archetype", "verified", "followers" }), seedKey, used))
		do return out end
	end
	exports.buildRoster = buildRoster
	nationalTeamAccount = function(nation, kit, strength)
		if strength == nil then strength = 75 end
		local acc = account(Js.O({ handle = ("@" .. S.replace(nation, Js.re("[^A-Za-z]", "g"), "")), name = nation, archetype = "club", verified = true, followers = Math.round((1000000 + (Math.max(0, (strength - 50)) * 250000))) }, { "handle", "name", "archetype", "verified", "followers" }), ("nation|" .. nation), Js.Set.new())
		do return Js.ospread(acc, Js.O({ avatar = Js.ospread(acc.avatar, Js.O({ initials = M_grammar.initialsOf(nation), tint = kit.shirt, tint2 = kit.trim }, { "initials", "tint", "tint2" })), allegiance = Js.O({ club = nation, polarity = 1 }, { "club", "polarity" }) }, { "avatar", "allegiance" })) end
	end
	exports.nationalTeamAccount = nationalTeamAccount
	selfAccount = function(career)
		local name = (career.player.firstName .. " " .. career.player.lastName)
		local rng = M_grammar.rngFor("self", name)
		do return Js.O({ id = "@self", handle = ("@" .. ((function() local _r = S.idx(career.player.firstName, 0); if _r == nil then return nil end; return S.toLowerCase(_r) end)() or "x") .. S.replace(S.toLowerCase(M_grammar.surname(name)), Js.re("[^a-z]", "g"), "") .. Js.str((if career.squadNumber ~= nil then career.squadNumber else ""))), name = name, archetype = "teammate", platform = "instagram", verified = (M_fame.fameOf(career) >= 25), followers = Math.round(((5000 + (M_fame.fameOf(career) * 24000)) + (career.starRating * 180000))), avatar = Js.O({ initials = M_grammar.initialsOf(name), tint = M_kits.kitsOf(career.player.club).home.shirt, tint2 = M_kits.kitsOf(career.player.club).home.trim, glyph = "shirt" }, { "initials", "tint", "tint2", "glyph" }), voice = Js.ospread(VOICES.teammate, Js.O({ firstPerson = true }, { "firstPerson" })), interests = Js.O({ goal = 1, assist = 0.9, trophy = 1, milestone = 1, award = 1, debut = 1, table = 0.5, transfer = 1 }, { "goal", "assist", "trophy", "milestone", "award", "debut", "table", "transfer" }), allegiance = Js.O({ club = career.player.club, polarity = 1 }, { "club", "polarity" }) }, { "id", "handle", "name", "archetype", "platform", "verified", "followers", "avatar", "voice", "interests", "allegiance" }) end
	end
	exports.selfAccount = selfAccount
	VOICES = Js.O({ club = Js.O({ register = "neutral", lowercase = 0, caps = 0.55, emoji = 0.8, hashtags = 0.7, length = "short", punctuation = "clean", exclaim = 0.4, firstPerson = false }, { "register", "lowercase", "caps", "emoji", "hashtags", "length", "punctuation", "exclaim", "firstPerson" }), league = Js.O({ register = "formal", lowercase = 0, caps = 0.2, emoji = 0.5, hashtags = 0.2, length = "short", punctuation = "clean", exclaim = 0.05, firstPerson = false }, { "register", "lowercase", "caps", "emoji", "hashtags", "length", "punctuation", "exclaim", "firstPerson" }), competition = Js.O({ register = "formal", lowercase = 0, caps = 0.3, emoji = 0.6, hashtags = 0.4, length = "short", punctuation = "clean", exclaim = 0.15, firstPerson = false }, { "register", "lowercase", "caps", "emoji", "hashtags", "length", "punctuation", "exclaim", "firstPerson" }), broadsheet = Js.O({ register = "formal", lowercase = 0, caps = 0.02, emoji = 0.05, hashtags = 0, length = "long", punctuation = "clean", exclaim = 0, firstPerson = false }, { "register", "lowercase", "caps", "emoji", "hashtags", "length", "punctuation", "exclaim", "firstPerson" }), tabloid = Js.O({ register = "raw", lowercase = 0, caps = 0.8, emoji = 0.2, hashtags = 0.1, length = "short", punctuation = "clean", exclaim = 0.5, firstPerson = false }, { "register", "lowercase", "caps", "emoji", "hashtags", "length", "punctuation", "exclaim", "firstPerson" }), insider = Js.O({ register = "neutral", lowercase = 0, caps = 0.35, emoji = 0.85, hashtags = 0.1, length = "medium", punctuation = "clean", exclaim = 0.05, firstPerson = false }, { "register", "lowercase", "caps", "emoji", "hashtags", "length", "punctuation", "exclaim", "firstPerson" }), stats = Js.O({ register = "neutral", lowercase = 0, caps = 0.05, emoji = 0.4, hashtags = 0.05, length = "short", punctuation = "clean", exclaim = 0, firstPerson = false }, { "register", "lowercase", "caps", "emoji", "hashtags", "length", "punctuation", "exclaim", "firstPerson" }), aggregator = Js.O({ register = "casual", lowercase = 0, caps = 0.4, emoji = 0.7, hashtags = 0.3, length = "short", punctuation = "clean", exclaim = 0.2, firstPerson = false }, { "register", "lowercase", "caps", "emoji", "hashtags", "length", "punctuation", "exclaim", "firstPerson" }), pundit = Js.O({ register = "casual", lowercase = 0, caps = 0.1, emoji = 0.1, hashtags = 0, length = "long", punctuation = "clean", exclaim = 0.1, firstPerson = true }, { "register", "lowercase", "caps", "emoji", "hashtags", "length", "punctuation", "exclaim", "firstPerson" }), fan = Js.O({ register = "raw", lowercase = 0.75, caps = 0.25, emoji = 0.55, hashtags = 0.15, length = "short", punctuation = "none", exclaim = 0.35, firstPerson = true }, { "register", "lowercase", "caps", "emoji", "hashtags", "length", "punctuation", "exclaim", "firstPerson" }), rivalFan = Js.O({ register = "raw", lowercase = 0.85, caps = 0.15, emoji = 0.35, hashtags = 0.05, length = "short", punctuation = "none", exclaim = 0.15, firstPerson = true }, { "register", "lowercase", "caps", "emoji", "hashtags", "length", "punctuation", "exclaim", "firstPerson" }), teammate = Js.O({ register = "casual", lowercase = 0.15, caps = 0.2, emoji = 0.9, hashtags = 0.35, length = "short", punctuation = "loose", exclaim = 0.3, firstPerson = true }, { "register", "lowercase", "caps", "emoji", "hashtags", "length", "punctuation", "exclaim", "firstPerson" }), meme = Js.O({ register = "casual", lowercase = 0.6, caps = 0.3, emoji = 0.6, hashtags = 0.1, length = "short", punctuation = "loose", exclaim = 0.15, firstPerson = false }, { "register", "lowercase", "caps", "emoji", "hashtags", "length", "punctuation", "exclaim", "firstPerson" }) }, { "club", "league", "competition", "broadsheet", "tabloid", "insider", "stats", "aggregator", "pundit", "fan", "rivalFan", "teammate", "meme" })
	INTERESTS = Js.O({ club = Js.O({ goal = 1, assist = 0.8, trophy = 1, table = 0.9, cup = 1, europe = 1, debut = 0.9, transfer = 0.9, contract = 0.9, award = 1, milestone = 0.9, international = 0.6, title = 1 }, { "goal", "assist", "trophy", "table", "cup", "europe", "debut", "transfer", "contract", "award", "milestone", "international", "title" }), league = Js.O({ goal = 0.7, table = 1, title = 1, relegation = 1, record = 0.9, milestone = 0.7, stat = 0.8, trophy = 1 }, { "goal", "table", "title", "relegation", "record", "milestone", "stat", "trophy" }), competition = Js.O({ cup = 1, europe = 1, trophy = 1, drama = 0.6, goal = 0.5 }, { "cup", "europe", "trophy", "drama", "goal" }), broadsheet = Js.O({ table = 0.9, title = 1, relegation = 1, drama = 0.8, manager = 1, opinion = 0.9, cup = 0.8, transfer = 0.8, europe = 0.9, goal = 0.5, form = 0.6 }, { "table", "title", "relegation", "drama", "manager", "opinion", "cup", "transfer", "europe", "goal", "form" }), tabloid = Js.O({ drama = 1, shame = 1, goal = 0.9, derby = 1, manager = 1, transfer = 1, rumour = 1, title = 0.8, relegation = 0.9, opinion = 0.7 }, { "drama", "shame", "goal", "derby", "manager", "transfer", "rumour", "title", "relegation", "opinion" }), insider = Js.O({ transfer = 1, rumour = 1, contract = 1, manager = 0.9, international = 0.5 }, { "transfer", "rumour", "contract", "manager", "international" }), stats = Js.O({ stat = 1, record = 1, streak = 1, milestone = 1, goal = 0.8, assist = 0.9, keeper = 0.8, form = 0.7, table = 0.6 }, { "stat", "record", "streak", "milestone", "goal", "assist", "keeper", "form", "table" }), aggregator = Js.O({ goal = 0.9, drama = 0.9, derby = 0.8, trophy = 0.8, shame = 0.6, cup = 0.6 }, { "goal", "drama", "derby", "trophy", "shame", "cup" }), pundit = Js.O({ opinion = 1, form = 0.9, manager = 0.9, drama = 0.7, shame = 0.8, title = 0.8, award = 0.7, table = 0.5 }, { "opinion", "form", "manager", "drama", "shame", "title", "award", "table" }), fan = Js.O({ goal = 1, drama = 1, derby = 1, shame = 0.9, table = 0.8, trophy = 1, form = 0.8, manager = 0.7, transfer = 0.8, debut = 0.7, milestone = 0.7 }, { "goal", "drama", "derby", "shame", "table", "trophy", "form", "manager", "transfer", "debut", "milestone" }), rivalFan = Js.O({ shame = 1, drama = 0.9, derby = 1, relegation = 0.9, opinion = 0.5, table = 0.5, title = 0.6 }, { "shame", "drama", "derby", "relegation", "opinion", "table", "title" }), teammate = Js.O({ goal = 0.9, trophy = 1, debut = 0.9, milestone = 0.8, award = 0.9, table = 0.5 }, { "goal", "trophy", "debut", "milestone", "award", "table" }), meme = Js.O({ drama = 0.9, shame = 1, derby = 0.8, goal = 0.6, opinion = 0.6, manager = 0.7 }, { "drama", "shame", "derby", "goal", "opinion", "manager" }) }, { "club", "league", "competition", "broadsheet", "tabloid", "insider", "stats", "aggregator", "pundit", "fan", "rivalFan", "teammate", "meme" })
	TINTS = Js.alit("#dc2626", "#ea580c", "#d97706", "#ca8a04", "#65a30d", "#16a34a", "#059669", "#0d9488", "#0891b2", "#0284c7", "#2563eb", "#4f46e5", "#7c3aed", "#9333ea", "#c026d3", "#db2777", "#e11d48", "#78350f")
	NATIONAL = Js.alit(Js.O({ handle = "@TheDailyPost", name = "The Daily Post", archetype = "broadsheet", platform = "news", verified = true, followers = 2400000 }, { "handle", "name", "archetype", "platform", "verified", "followers" }), Js.O({ handle = "@ChronicleSport", name = "Chronicle Sport", archetype = "broadsheet", platform = "news", verified = true, followers = 1600000 }, { "handle", "name", "archetype", "platform", "verified", "followers" }), Js.O({ handle = "@TheStarBack", name = "The Star — Back Page", archetype = "tabloid", platform = "news", verified = true, followers = 3100000 }, { "handle", "name", "archetype", "platform", "verified", "followers" }), Js.O({ handle = "@MatchdayMirror", name = "Matchday Mirror", archetype = "tabloid", platform = "news", verified = true, followers = 2200000 }, { "handle", "name", "archetype", "platform", "verified", "followers" }), Js.O({ handle = "@RomanoWatch", name = "Fabio Marchetti", archetype = "insider", verified = true, followers = 4800000 }, { "handle", "name", "archetype", "verified", "followers" }), Js.O({ handle = "@DealsheetFC", name = "Dealsheet", archetype = "insider", verified = true, followers = 890000 }, { "handle", "name", "archetype", "verified", "followers" }), Js.O({ handle = "@OptaLeague", name = "Numbers FC", archetype = "stats", verified = true, followers = 1900000 }, { "handle", "name", "archetype", "verified", "followers" }), Js.O({ handle = "@SquawkaStyle", name = "The Data Room", archetype = "stats", verified = false, followers = 620000 }, { "handle", "name", "archetype", "verified", "followers" }), Js.O({ handle = "@FootballDaily_", name = "Football Daily", archetype = "aggregator", verified = true, followers = 5200000 }, { "handle", "name", "archetype", "verified", "followers" }), Js.O({ handle = "@GaryOnTheBox", name = "Gary Wilkes", archetype = "pundit", verified = true, followers = 1400000 }, { "handle", "name", "archetype", "verified", "followers" }), Js.O({ handle = "@RoyKeanTakes", name = "Ronan Keane", archetype = "pundit", verified = true, followers = 980000 }, { "handle", "name", "archetype", "verified", "followers" }), Js.O({ handle = "@TerraceMemes", name = "Terrace Memes", archetype = "meme", verified = false, followers = 1100000 }, { "handle", "name", "archetype", "verified", "followers" }), Js.O({ handle = "@GoalCamHD", name = "GoalCam", archetype = "aggregator", platform = "youtube", verified = true, followers = 3300000 }, { "handle", "name", "archetype", "platform", "verified", "followers" }), Js.O({ handle = "@pitchside.edits", name = "pitchside edits", archetype = "meme", platform = "tiktok", verified = false, followers = 2700000 }, { "handle", "name", "archetype", "platform", "verified", "followers" }), Js.O({ handle = "@footyloops", name = "footy loops", archetype = "meme", platform = "tiktok", verified = false, followers = 860000 }, { "handle", "name", "archetype", "platform", "verified", "followers" }))
	FAN_HANDLES = Js.alit("terrace_tom", "northbank_nia", "ninetyminutes", "matchday_mo", "stand_side", "awaydays_al", "programme_pat", "halfway_line", "boxtobox_bea", "endofseason_ed")
	FAN_NAMES = Js.alit("Tom", "Nia", "Ninety Minutes", "Mo", "Standside", "Al", "Pat", "Halfway", "Bea", "Ed")
	GLYPHS = Js.O({ club = Js.alit("crest"), league = Js.alit("trophy"), competition = Js.alit("cup", "trophy", "ball"), broadsheet = Js.alit("newspaper", "quote"), tabloid = Js.alit("megaphone", "flag"), insider = Js.alit("scoop", "quote"), stats = Js.alit("chart", "grid"), aggregator = Js.alit("play"), pundit = Js.alit("mic", "quote"), fan = Js.alit("scarf", "flag", "drum", "ball"), rivalFan = Js.alit("scarf", "flag", "drum"), teammate = Js.alit("shirt", "boot"), meme = Js.alit("grin") }, { "club", "league", "competition", "broadsheet", "tabloid", "insider", "stats", "aggregator", "pundit", "fan", "rivalFan", "teammate", "meme" })
	LEAGUE_FOLLOWERS = Js.O({ premier = 12000000, championship = 1300000, league_one = 420000, league_two = 260000, national_league = 95000, national_league_north = 28000, national_league_south = 26000 }, { "premier", "championship", "league_one", "league_two", "national_league", "national_league_north", "national_league_south" })
end
