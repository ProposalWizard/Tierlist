--!nocheck
--!nolint
-- Generated from lib/star/media/grammar.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_season = import("lib/star/season")
	local M_clubs = import("lib/star/clubs")
	local hashSeed, rngFor, pick, pickWeighted, shuffle, fromPool, GOAL_COUNT, LATE, WIN_VERB, LOSS_VERB, BIG_WIN, BIG_LOSS, GREAT_GOAL, HOW, RATING_WORD, POOR_WORD, resolve, slotValue, applyFilter, surname, groupedGoalLines, initialsOf, ordinal, CLUB_SUFFIXES, shortClub, COLOURS, nickname, num, EMOJI_BY_TAG, ENDS_IN_EMOJI, speak, metricsFor
	hashSeed = function(s)
		local h = Js.ushr(2166136261, 0)
		for i = 0, (S.len(s)) - 1 do
			h = Js.bxor(h, S.charCodeAt(s, i))
			h = Js.ushr(Math.imul(h, 16777619), 0)
		end
		do return Js.ushr(h, 0) end
	end
	exports.hashSeed = hashSeed
	rngFor = function(...)
		local parts = Js.alit(...)
		do return M_season.mulberry32(hashSeed(A.join(parts, "|"))) end
	end
	exports.rngFor = rngFor
	pick = function(pool, rng)
		do return pool[math.fmod(math.floor((rng() * Js.alen(pool))), Js.alen(pool)) + 1] end
	end
	exports.pick = pick
	pickWeighted = function(pool, rng)
		local total = A.reduce(pool, function(s, p)
			return (s + (if p.weight ~= nil then p.weight else 1))
		end, 0)
		local r = (rng() * total)
		do
			local _arr1 = pool
			local _i2 = 0
			while _i2 < Js.alen(_arr1) do
				_i2 += 1
				local p = _arr1[_i2]
				r -= (if p.weight ~= nil then p.weight else 1)
				if (r <= 0) then
					do return p end
				end
			end
		end
		do return pool[Js.alen(pool)] end
	end
	exports.pickWeighted = pickWeighted
	shuffle = function(items, rng)
		local out = Js.aspread(items)
		for i = (Js.alen(out) - 1), 1, -1 do
			local j = math.floor((rng() * (i + 1)))
			local _d3 = Js.alit(out[j + 1], out[i + 1])
			A.set(out, i, _d3[1])
			A.set(out, j, _d3[2])
		end
		do return out end
	end
	exports.shuffle = shuffle
	fromPool = function(p, reg, rng)
		do return pick((if p[reg] ~= nil then p[reg] else p.any), rng) end
	end
	resolve = function(body, facts, voice, rng)
		do return S.replace(body, Js.re("\\{([^}]+)\\}", "g"), function(_, expr)
			local _d4 = S.split(expr, "|")
			local key = _d4[1]
			local filters = A.slice(_d4, 1)
			local out = slotValue(S.trim(key), facts, voice, rng)
			do
				local _arr5 = filters
				local _i6 = 0
				while _i6 < Js.alen(_arr5) do
					_i6 += 1
					local f = _arr5[_i6]
					out = applyFilter(out, S.trim(f), rng)
				end
			end
			do return out end
		end) end
	end
	exports.resolve = resolve
	slotValue = function(key, facts, voice, rng)
		local reg = voice.register
		local v = facts[key]
		local _sw7 = key
		local _ci8 = (if _sw7 == "goals" then 1 elseif _sw7 == "late" then 2 elseif _sw7 == "winVerb" then 3 elseif _sw7 == "lossVerb" then 4 elseif _sw7 == "bigWin" then 5 elseif _sw7 == "bigLoss" then 6 elseif _sw7 == "greatGoal" then 7 elseif _sw7 == "ratingWord" then 8 elseif _sw7 == "poorWord" then 9 elseif _sw7 == "how" then 10 else 11)
		local _cont9 = false
		repeat
			if _ci8 ~= 0 and _ci8 <= 1 then
				do
					local n = num(v)
					local pool = GOAL_COUNT[Js.key(n)]
					do return (if pool then fromPool(pool, reg, rng) else (Js.numstr(n) .. " goals")) end
				end
			end
			if _ci8 ~= 0 and _ci8 <= 2 then
				do return fromPool(LATE, reg, rng) end
			end
			if _ci8 ~= 0 and _ci8 <= 3 then
				do return fromPool(WIN_VERB, reg, rng) end
			end
			if _ci8 ~= 0 and _ci8 <= 4 then
				do return fromPool(LOSS_VERB, reg, rng) end
			end
			if _ci8 ~= 0 and _ci8 <= 5 then
				do return fromPool(BIG_WIN, reg, rng) end
			end
			if _ci8 ~= 0 and _ci8 <= 6 then
				do return fromPool(BIG_LOSS, reg, rng) end
			end
			if _ci8 ~= 0 and _ci8 <= 7 then
				do return fromPool(GREAT_GOAL, reg, rng) end
			end
			if _ci8 ~= 0 and _ci8 <= 8 then
				do return fromPool(RATING_WORD, reg, rng) end
			end
			if _ci8 ~= 0 and _ci8 <= 9 then
				do return fromPool(POOR_WORD, reg, rng) end
			end
			if _ci8 ~= 0 and _ci8 <= 10 then
				do
					local pool = HOW[Js.str((if v ~= nil then v else ""))]
					do return (if pool then fromPool(pool, reg, rng) else "") end
				end
			end
			if _ci8 ~= 0 and _ci8 <= 11 then
				if ((v == nil) or (v == nil)) then
					do return "" end
				end
				do return Js.str(v) end
			end
		until true
	end
	applyFilter = function(s, filter, rng)
		local _sw10 = filter
		if _sw10 == "caps" then
			do return S.toUpperCase(s) end
		elseif _sw10 == "lower" then
			do return S.toLowerCase(s) end
		elseif _sw10 == "title" then
			do return S.replace(s, Js.re("\\b\\w", "g"), function(c)
				return S.toUpperCase(c)
			end) end
		elseif _sw10 == "sentence" then
			do return (S.toUpperCase(S.charAt(s, 0)) .. S.slice(s, 1)) end
		elseif _sw10 == "short" then
			do return surname(s) end
		elseif _sw10 == "possessive" then
			do return (if S.endsWith(s, "s") then (s .. "'") else (s .. "'s")) end
		elseif _sw10 == "ordinal" then
			do return ordinal(Js.Number(s)) end
		elseif _sw10 == "plural" then
			do return (if (Js.Number(s) == 1) then "" else "s") end
		elseif _sw10 == "was" then
			do return (if (Js.Number(s) == 1) then "was" else "were") end
		elseif _sw10 == "abs" then
			do return Js.numstr(math.abs(Js.Number(s))) end
		elseif _sw10 == "nick" then
			do return nickname(s, rng) end
		else
			do return s end
		end
	end
	surname = function(full)
		local parts = S.split(S.trim(full), Js.re("\\s+", ""))
		do return (if (Js.alen(parts) > 1) then parts[Js.alen(parts)] else full) end
	end
	exports.surname = surname
	groupedGoalLines = function(goals, scorerOf, minuteOf)
		local order = Js.alit()
		local byScorer = Js.Map.new()
		do
			local _arr11 = goals
			local _i12 = 0
			while _i12 < Js.alen(_arr11) do
				_i12 += 1
				local g = _arr11[_i12]
				local s = scorerOf(g)
				if (not byScorer:has(s)) then
					byScorer:set(s, Js.alit())
					A.push(order, s)
				end
				A.push(byScorer:get(s), minuteOf(g))
			end
		end
		do return A.map(order, function(s)
			return Js.O({ scorer = s, minutes = byScorer:get(s) }, { "scorer", "minutes" })
		end) end
	end
	exports.groupedGoalLines = groupedGoalLines
	initialsOf = function(name)
		local parts = A.filter(S.split(S.replace(name, Js.re("^@", ""), ""), Js.re("[\\s_]+", "")), Js.Boolean)
		if (Js.alen(parts) == 1) then
			do return S.toUpperCase(S.slice(parts[1], 0, 2)) end
		end
		do return S.toUpperCase((S.idx(parts[1], 0) .. S.idx(parts[Js.alen(parts)], 0))) end
	end
	exports.initialsOf = initialsOf
	ordinal = function(n)
		local s = Js.alit("th", "st", "nd", "rd")
		local v = math.fmod(n, 100)
		do return (Js.numstr(n) .. (function() local _l = (function() local _l = s[math.fmod((v - 20), 10) + 1]; if Js.T(_l) then return _l end; return s[v + 1] end)(); if Js.T(_l) then return _l end; return s[1] end)()) end
	end
	exports.ordinal = ordinal
	shortClub = function(club)
		local trimmed = S.trim(club)
		local given = M_clubs.CLUB_SHORT_NAMES[trimmed]
		if Js.T(given) then
			do return given end
		end
		local name = S.split(trimmed, Js.re("\\s*&\\s*", ""))[1]
		name = S.replace(S.replace(name, Js.re("^(AFC|FC)\\s+", "i"), ""), Js.re("\\s+(AFC|FC)$", "i"), "")
		local parts = S.split(name, Js.re("\\s+", ""))
		if ((Js.alen(parts) > 1) and CLUB_SUFFIXES:has(S.toLowerCase(parts[Js.alen(parts)]))) then
			local without = A.join(A.slice(parts, 0, -1), " ")
			if (S.len(without) >= 4) then
				do return without end
			end
		end
		do return name end
	end
	exports.shortClub = shortClub
	nickname = function(club, rng)
		local parts = S.split(club, Js.re("\\s+", ""))
		if (Js.alen(parts) > 1) then
			local tail = parts[Js.alen(parts)]
			if (not A.includes(Js.alit("FC", "United", "City", "Town", "Rovers", "Albion", "Wanderers", "County"), tail)) then
				do return tail end
			end
			if A.includes(Js.alit("United", "City", "Town", "Rovers", "Albion", "Wanderers", "County"), tail) then
				do return tail end
			end
		end
		do return (if (rng() < 0.5) then club else pick(COLOURS, rng)) end
	end
	exports.nickname = nickname
	num = function(v)
		do return (if (type(v) == "number") then v else Js.Number((if v ~= nil then v else 0))) end
	end
	speak = function(text, voice, tags, rng, hashtag)
		local out = S.replace(S.replace(S.trim(text), Js.re("\\s+", "g"), " "), Js.re("\\s+([,.!?])", "g"), "$1")
		if (rng() < voice.lowercase) then
			out = S.toLowerCase(out)
		end
		out = (S.toUpperCase(S.charAt(out, 0)) .. S.slice(out, 1))
		if (voice.punctuation == "none") then
			out = S.replace(out, Js.re("[.]$", ""), "")
		end
		local decorated = ENDS_IN_EMOJI:test(out)
		if (((not decorated) and (voice.exclaim > 0)) and (rng() < voice.exclaim)) then
			out = S.replace(out, Js.re("[.]?$", ""), "!")
		end
		if (((not decorated) and (voice.emoji > 0)) and (rng() < voice.emoji)) then
			local bag = A.flatMap(tags, function(t)
				return (if EMOJI_BY_TAG[t] ~= nil then EMOJI_BY_TAG[t] else Js.alit())
			end)
			if Js.T(Js.alen(bag)) then
				out = (out .. " " .. pick(bag, rng))
			end
		end
		if ((Js.T(hashtag) and (voice.hashtags > 0)) and (rng() < voice.hashtags)) then
			out = (out .. " " .. hashtag)
		end
		do return S.trim(out) end
	end
	exports.speak = speak
	metricsFor = function(followers, importance, rng)
		local base = (Math.sqrt(followers) * (0.4 + (importance / 100)))
		local likes = Math.max(3, Math.round((base * (0.7 + (rng() * 0.9)))))
		do return Js.O({ likes = likes, reposts = Math.max(0, Math.round((likes * (0.08 + (rng() * 0.22))))), replies = Math.max(0, Math.round((likes * (0.04 + (rng() * 0.16))))) }, { "likes", "reposts", "replies" }) end
	end
	exports.metricsFor = metricsFor
	GOAL_COUNT = Js.O({ ["1"] = Js.O({ any = Js.alit("a goal", "one", "the goal"), formal = Js.alit("a goal", "the only goal of his afternoon"), raw = Js.alit("a goal", "one") }, { "any", "formal", "raw" }), ["2"] = Js.O({ any = Js.alit("a brace", "two", "a double"), formal = Js.alit("a brace", "two goals"), casual = Js.alit("a brace", "two", "a double"), raw = Js.alit("two", "a brace") }, { "any", "formal", "casual", "raw" }), ["3"] = Js.O({ any = Js.alit("a hat-trick", "three", "the matchball"), formal = Js.alit("a hat-trick", "three goals"), casual = Js.alit("a hat-trick", "the matchball", "three"), raw = Js.alit("a HAT-TRICK", "three", "the matchball") }, { "any", "formal", "casual", "raw" }), ["4"] = Js.O({ any = Js.alit("four", "four goals", "an unthinkable four") }, { "any" }), ["5"] = Js.O({ any = Js.alit("five", "FIVE", "five goals in one afternoon") }, { "any" }) }, { "1", "2", "3", "4", "5" })
	LATE = Js.O({ any = Js.alit("at the death", "with a minute left", "deep into the second half", "right at the end"), formal = Js.alit("deep into stoppage time", "with the clock all but gone"), raw = Js.alit("AT THE DEATH", "with seconds left", "in the last minute") }, { "any", "formal", "raw" })
	WIN_VERB = Js.O({ any = Js.alit("won it", "took it", "got the job done", "found a way"), formal = Js.alit("edged it", "prevailed", "saw it out"), casual = Js.alit("won it", "nicked it", "took all three"), raw = Js.alit("WON IT", "nicked it", "smashed them") }, { "any", "formal", "casual", "raw" })
	LOSS_VERB = Js.O({ any = Js.alit("lost it", "came up short", "were beaten"), formal = Js.alit("were undone", "could not find an answer"), casual = Js.alit("lost it", "threw it away", "fell short"), raw = Js.alit("bottled it", "lost", "were awful") }, { "any", "formal", "casual", "raw" })
	BIG_WIN = Js.O({ any = Js.alit("took them apart", "ran riot", "were ruthless"), formal = Js.alit("were utterly dominant", "swept them aside"), raw = Js.alit("DESTROYED them", "battered them", "ran riot") }, { "any", "formal", "raw" })
	BIG_LOSS = Js.O({ any = Js.alit("were taken apart", "were run over", "had no answer"), formal = Js.alit("were comprehensively beaten", "were outclassed"), raw = Js.alit("got battered", "were embarrassing", "got destroyed") }, { "any", "formal", "raw" })
	GREAT_GOAL = Js.O({ any = Js.alit("a wonderful finish", "a superb goal", "a brilliant strike"), formal = Js.alit("a finish of real quality", "an excellent strike"), casual = Js.alit("an unbelievable goal", "a worldie", "a special one"), raw = Js.alit("A WORLDIE", "an absolute rocket", "unreal") }, { "any", "formal", "casual", "raw" })
	HOW = Js.O({ long_range = Js.O({ any = Js.alit("from distance", "from range", "from outside the box"), raw = Js.alit("FROM MILES OUT", "from range") }, { "any", "raw" }), volley = Js.O({ any = Js.alit("on the volley", "first time", "without letting it drop"), raw = Js.alit("ON THE VOLLEY", "first time") }, { "any", "raw" }), header = Js.O({ any = Js.alit("with his head", "with a header", "in the air"), formal = Js.alit("with a well-timed header") }, { "any", "formal" }), free_kick = Js.O({ any = Js.alit("from a free kick", "over the wall", "from a set piece"), raw = Js.alit("FROM A FREE KICK", "over the wall") }, { "any", "raw" }), penalty = Js.O({ any = Js.alit("from the spot", "from twelve yards", "with a penalty") }, { "any" }), one_on_one = Js.O({ any = Js.alit("one on one", "through on goal", "clean through") }, { "any" }), tight_angle = Js.O({ any = Js.alit("from an impossible angle", "off the near post", "from nothing") }, { "any" }), cutback = Js.O({ any = Js.alit("from the cutback", "from a square ball") }, { "any" }), through_ball = Js.O({ any = Js.alit("after being picked out", "on the shoulder", "in behind") }, { "any" }), byline_cross = Js.O({ any = Js.alit("from the byline", "from a whipped cross") }, { "any" }), corner = Js.O({ any = Js.alit("from the corner", "from a set piece") }, { "any" }), rebound = Js.O({ any = Js.alit("from the rebound", "following it in", "on the follow-up") }, { "any" }), solo = Js.O({ any = Js.alit("on his own", "after carrying it", "from nothing") }, { "any" }) }, { "long_range", "volley", "header", "free_kick", "penalty", "one_on_one", "tight_angle", "cutback", "through_ball", "byline_cross", "corner", "rebound", "solo" })
	RATING_WORD = Js.O({ any = Js.alit("outstanding", "excellent", "very good", "unplayable"), formal = Js.alit("outstanding", "exceptional", "of the highest order"), raw = Js.alit("UNPLAYABLE", "different class", "unreal") }, { "any", "formal", "raw" })
	POOR_WORD = Js.O({ any = Js.alit("quiet", "anonymous", "off the pace"), formal = Js.alit("subdued", "peripheral"), raw = Js.alit("hiding", "invisible", "shocking") }, { "any", "formal", "raw" })
	CLUB_SUFFIXES = Js.Set.new(Js.alit("united", "city", "town", "rovers", "albion", "wanderers", "county", "hotspur"))
	COLOURS = Js.alit("the Reds", "the Blues", "the Whites", "the City", "the Town", "the Lads")
	EMOJI_BY_TAG = Js.O({ goal = Js.alit("⚽", "🎯", "🔥"), trophy = Js.alit("🏆", "🥇"), record = Js.alit("📈", "🔢"), drama = Js.alit("😱", "🤯", "🚨"), shame = Js.alit("😩", "💀", "🫠"), transfer = Js.alit("🚨", "✍️", "🔴"), award = Js.alit("🏅", "👏"), table = Js.alit("📊", "⬆️"), stat = Js.alit("🔢", "📊") }, { "goal", "trophy", "record", "drama", "shame", "transfer", "award", "table", "stat" })
	ENDS_IN_EMOJI = Js.re("(?:[\\uD800-\\uDBFF][\\uDC00-\\uDFFF]|[\\u2600-\\u27BF\\uFE0F\\u2B00-\\u2BFF])\\s*$", "")
end
