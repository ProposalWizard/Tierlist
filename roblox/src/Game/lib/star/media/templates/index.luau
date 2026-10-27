--!nocheck
--!nolint
-- Generated from lib/star/media/templates/index.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_grammar = import("lib/star/media/grammar")
	local M_club = import("lib/star/media/templates/club")
	local M_press = import("lib/star/media/templates/press")
	local M_social = import("lib/star/media/templates/social")
	local M_data = import("lib/star/media/templates/data")
	local M_chants = import("lib/star/media/templates/chants")
	local M_cheeky = import("lib/star/media/templates/cheeky")
	local M_casino = import("lib/star/media/templates/casino")
	local M_retirements = import("lib/star/media/templates/retirements")
	local M_international = import("lib/star/media/templates/international")
	local normName, sameName, ALL, BY_ARCHETYPE, templateCount, POOL_SLOTS, slotsFilled, has, chooseTemplate
	normName = function(n)
		do return S.toLowerCase(S.trim(S.replace(S.replace(S.replace(S.normalize(n, "NFD"), Js.re("[\\u0300-\\u036f]", "g"), ""), Js.re("[-'’.]", "g"), " "), Js.re("\\s+", "g"), " "))) end
	end
	sameName = function(a, b)
		do return ((type(a) == "string") and (normName(a) == normName(b))) end
	end
	templateCount = function()
		do return Js.alen(ALL) end
	end
	exports.templateCount = templateCount
	slotsFilled = function(e, body)
		if (not Js.T(body)) then
			do return true end
		end
		do
			local _arr1 = Js.Array.from(S.matchAll(body, Js.re("\\{([^}|]+)", "g")))
			local _i2 = 0
			while _i2 < Js.alen(_arr1) do
				_i2 += 1
				local m = _arr1[_i2]
				local k = S.trim(m[2])
				if POOL_SLOTS:has(k) then
					do continue end
				end
				local v = (if S.startsWith(k, "thread.") then (function() local _v = e.thread; if _v == nil then return nil end; _v = _v.facts; _v = _v[S.slice(k, 7)]; return _v end)() else e.facts[k])
				if (((v == nil) or (v == nil)) or (v == "")) then
					do return false end
				end
			end
		end
		do return true end
	end
	has = function(e, keys)
		if (not keys) then
			do return true end
		end
		do return A.every(keys, function(k)
			local v = e.facts[k]
			do return (((v ~= nil) and (v ~= nil)) and (v ~= "")) end
		end) end
	end
	chooseTemplate = function(event, archetype, frame, memory, rng, wantThread, usedThisCycle)
		if usedThisCycle == nil then usedThisCycle = Js.Set.new() end
		local pool = (BY_ARCHETYPE:get(archetype) or Js.alit())
		local usable = A.filter(pool, function(t)
			return (((((((((has(event, t.requires) and slotsFilled(event, (if (wantThread and Js.T(t.threadBody)) then t.threadBody else t.body))) and (not A.some((if t.excludes ~= nil then t.excludes else Js.alit()), function(k)
				return (event.facts[k] ~= nil)
			end))) and ((not t.frames) or A.includes(t.frames, frame))) and (((not wantThread) or (not (not Js.T(t.threadBody)))) or S.endsWith(t.id, "-generic"))) and ((t.club == nil) or (event.facts.club == t.club))) and ((t.score == nil) or (event.facts.score == t.score))) and ((t.player == nil) or sameName(event.facts.scorer, t.player))) and ((t.result == nil) or (event.facts.result == t.result))) and ((t.subject == nil) or (event.subject.kind == t.subject)))
		end)
		local exact = A.filter(usable, function(t)
			return (function() local _r = t.events; if _r == nil then return nil end; return A.includes(_r, event.id) end)()
		end)
		local tagged = A.filter(usable, function(t)
			return ((not t.events) and (function() local _r = t.tags; if _r == nil then return nil end; return A.some(_r, function(tag)
				return A.includes(event.tags, tag)
			end) end)())
		end)
		local generic = A.filter(usable, function(t)
			return ((not t.events) and (not t.tags))
		end)
		do
			local _arr3 = Js.alit(exact, tagged, generic)
			local _i4 = 0
			while _i4 < Js.alen(_arr3) do
				_i4 += 1
				local tier = _arr3[_i4]
				if (not Js.T(Js.alen(tier))) then
					do continue end
				end
				local unused = A.filter(tier, function(t)
					return (not usedThisCycle:has(t.id))
				end)
				if (not Js.T(Js.alen(unused))) then
					do continue end
				end
				local fresh = A.filter(unused, function(t)
					return (not A.includes(memory.saidRecently, t.id))
				end)
				do return M_grammar.pickWeighted((if Js.T(Js.alen(fresh)) then fresh else unused), rng) end
			end
		end
		do return nil end
	end
	exports.chooseTemplate = chooseTemplate
	ALL = Js.aspread(M_club.CLUB_TEMPLATES, M_press.PRESS_TEMPLATES, M_social.SOCIAL_TEMPLATES, M_data.DATA_TEMPLATES, M_chants.CHANT_TEMPLATES, M_cheeky.CHEEKY_TEMPLATES, M_casino.CASINO_TEMPLATES, M_retirements.RETIREMENT_TEMPLATES, M_international.INTERNATIONAL_TEMPLATES)
	BY_ARCHETYPE = Js.Map.new()
	do
		local _arr5 = ALL
		local _i6 = 0
		while _i6 < Js.alen(_arr5) do
			_i6 += 1
			local t = _arr5[_i6]
			local list = (BY_ARCHETYPE:get(t.archetype) or Js.alit())
			A.push(list, t)
			BY_ARCHETYPE:set(t.archetype, list)
		end
	end
	POOL_SLOTS = Js.Set.new(Js.alit("late", "winVerb", "lossVerb", "bigWin", "bigLoss", "greatGoal", "ratingWord", "poorWord"))
end
