--!nocheck
--!nolint
-- Generated from lib/star/media/select.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_grammar = import("lib/star/media/grammar")
	local M_chants = import("lib/star/media/chants")
	local M_updateFlags = import("lib/star/media/updateFlags")
	local budgetFor, MAX_PER_ACCOUNT, MAX_PER_EVENT, selectPairings, ownCompetition, interest, allegiance, reach
	budgetFor = function(topImportance)
		if (topImportance >= 90) then
			do return 25 end
		end
		if (topImportance >= 75) then
			do return 20 end
		end
		if (topImportance >= 55) then
			do return 15 end
		end
		if (topImportance >= 35) then
			do return 11 end
		end
		do return 7 end
	end
	selectPairings = function(events, accounts, cycleId, yourClub)
		local scored = Js.alit()
		do
			local _arr1 = events
			local _i2 = 0
			while _i2 < Js.alen(_arr1) do
				_i2 += 1
				local e = _arr1[_i2]
				local importance = (if e.importance ~= nil then e.importance else e.baseImportance)
				do
					local _arr3 = accounts
					local _i4 = 0
					while _i4 < Js.alen(_arr3) do
						_i4 += 1
						local a = _arr3[_i4]
						local s = (((interest(a, e) * allegiance(a, e, yourClub)) * reach(a, importance)) * ownCompetition(a, e))
						if (s <= 0) then
							do continue end
						end
						local rng = M_grammar.rngFor("sel", cycleId, e.id, a.id)
						A.push(scored, Js.O({ event = e, account = a, score = ((s * importance) * (0.75 + (rng() * 0.5))) }, { "event", "account", "score" }))
					end
				end
			end
		end
		A.sort(scored, function(a, b)
			return (b.score - a.score)
		end)
		local top = Math.max(Js.unpack(Js.aspread(A.map(events, function(e)
			return (if e.importance ~= nil then e.importance else e.baseImportance)
		end), Js.alit(0))))
		local budget = budgetFor(top)
		local perAccount = Js.Map.new()
		local perEvent = Js.Map.new()
		local out = Js.alit()
		do
			local _arr5 = scored
			local _i6 = 0
			while _i6 < Js.alen(_arr5) do
				_i6 += 1
				local p = _arr5[_i6]
				if (Js.alen(out) >= budget) then
					do break end
				end
				local a = (perAccount:get(p.account.id) or 0)
				local e = (perEvent:get(p.event.id) or 0)
				if ((a >= MAX_PER_ACCOUNT) or (e >= MAX_PER_EVENT)) then
					do continue end
				end
				perAccount:set(p.account.id, (a + 1))
				perEvent:set(p.event.id, (e + 1))
				A.push(out, p)
			end
		end
		if ((Js.alen(out) == 0) and Js.T(Js.alen(events))) then
			local rng = M_grammar.rngFor("fallback", cycleId)
			local clubAcct = A.find(accounts, function(a)
				return ((a.archetype == "club") and ((function() local _v = a.allegiance; if _v == nil then return nil end; _v = _v.club; return _v end)() == yourClub))
			end)
			local any = (if clubAcct ~= nil then clubAcct else M_grammar.shuffle(accounts, rng)[1])
			if any then
				A.push(out, Js.O({ event = events[1], account = any, score = 1 }, { "event", "account", "score" }))
			end
		end
		local chantAcct = (A.find(accounts, function(a)
			return (a.handle == "@GroundNoise")
		end) or A.find(accounts, function(a)
			return ((a.archetype == "fan") and (not a.allegiance))
		end))
		if chantAcct then
			do
				local _arr7 = events
				local _i8 = 0
				while _i8 < Js.alen(_arr7) do
					_i8 += 1
					local e = _arr7[_i8]
					if (e.id ~= "teammate-goal") then
						do continue end
					end
					local scorer = e.facts.scorer
					if ((not Js.T(scorer)) or (not M_chants.PLAYER_GOAL_CHANTS[scorer])) then
						do continue end
					end
					if A.some(out, function(p)
						return (((p.event.id == e.id) and (p.account.id == chantAcct.id)) and (p.event.facts.scorer == scorer))
					end) then
						do continue end
					end
					A.push(out, Js.O({ event = e, account = chantAcct, score = Js.NumberNS.POSITIVE_INFINITY }, { "event", "account", "score" }))
				end
			end
		end
		do return out end
	end
	exports.selectPairings = selectPairings
	ownCompetition = function(a, e)
		if (not M_updateFlags.labelFixesOn()) then
			do return 1 end
		end
		if ((a.archetype ~= "league") and (a.archetype ~= "competition")) then
			do return 1 end
		end
		local comp = e.facts.competition
		if ((type(comp) ~= "string") or (not Js.T(comp))) then
			do return 1 end
		end
		do return (if ((comp == a.name) or S.startsWith(comp, (a.name .. " "))) then 1 else 0) end
	end
	exports.ownCompetition = ownCompetition
	interest = function(a, e)
		local best = 0
		do
			local _arr9 = e.tags
			local _i10 = 0
			while _i10 < Js.alen(_arr9) do
				_i10 += 1
				local t = _arr9[_i10]
				best = Math.max(best, (if a.interests[t] ~= nil then a.interests[t] else 0))
			end
		end
		do return best end
	end
	allegiance = function(a, e, yourClub)
		if (not a.allegiance) then
			do return 1 end
		end
		local eventClub = e.facts.club
		local negative = (((((((((((((A.includes(e.tags, "shame") or A.includes(e.tags, "relegation")) or S.startsWith(e.id, "derby-loss")) or (e.id == "hammered")) or (e.id == "collapse")) or (e.id == "losing-run")) or (e.id == "drought")) or (e.id == "hooked")) or (e.id == "anonymous")) or (e.id == "knocked-out")) or (e.id == "lost-top")) or (e.id == "embarrassed")) or (e.id == "into-the-drop")) or (e.id == "out-of-form"))
		if (a.allegiance.polarity == -1) then
			if (eventClub ~= yourClub) then
				do return 0 end
			end
			do return (if negative then 1.6 else 0.12) end
		end
		if ((eventClub ~= nil) and (eventClub ~= a.allegiance.club)) then
			do return (if (a.archetype == "club") then 0 else 0.05) end
		end
		do return (if negative then 0.45 else 1) end
	end
	exports.allegiance = allegiance
	reach = function(a, importance)
		if (a.followers > 2000000) then
			do return (if (importance >= 55) then 1.15 else (if (importance >= 40) then 0.5 else 0)) end
		end
		if (a.followers > 500000) then
			do return (if (importance >= 40) then 1.1 else (if (importance >= 28) then 0.6 else 0.05)) end
		end
		if (a.followers > 50000) then
			do return (if (importance >= 25) then 1 else 0.4) end
		end
		do return 1 end
	end
	MAX_PER_ACCOUNT = 2
	MAX_PER_EVENT = 5
end
