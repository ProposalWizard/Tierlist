--!nocheck
--!nolint
-- Generated from lib/star/media/importance.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_memory = import("lib/star/media/memory")
	local COMPETITION_WEIGHT, scoreMatchEvents, scoreCareerEvents, NEVER_STALE, rarity, fameWeight, clamp, headlineEvent
	scoreMatchEvents = function(events, r, m)
		do return A.map(events, function(e)
			local w = (if COMPETITION_WEIGHT[r.kind] ~= nil then COMPETITION_WEIGHT[r.kind] else 1)
			if (r.round == "Final") then
				w *= 1.45
			elseif (r.round == "Semi-Final") then
				w *= 1.2
			end
			if r.derby then
				w *= 1.35
			end
			if ((r.kind == "league") and (r.table.matchesLeft <= 10)) then
				local tight = ((math.abs(r.table.leaderGap) <= 6) and (r.table.after.position <= 4))
				local scrap = ((r.table.relegationGap <= 5) and (r.table.after.position >= (r.table.clubs - 5)))
				if (tight or scrap) then
					w *= (1 + ((10 - r.table.matchesLeft) * 0.045))
				end
			end
			local minute = Js.Number((if e.facts.minute ~= nil then e.facts.minute else 0))
			if (minute >= 88) then
				w *= 1.3
			elseif (minute >= 80) then
				w *= 1.12
			end
			w *= rarity(e, m)
			w *= fameWeight(e, r.context.fame, r.context.starRating)
			do return Js.ospread(e, Js.O({ importance = clamp(Math.round((e.baseImportance * w))) }, { "importance" })) end
		end) end
	end
	exports.scoreMatchEvents = scoreMatchEvents
	scoreCareerEvents = function(events, m, fame)
		do return A.map(events, function(e)
			return Js.ospread(e, Js.O({ importance = clamp(Math.round(((e.baseImportance * rarity(e, m)) * (0.85 + (Math.min(1, (fame / 120)) * 0.35))))) }, { "importance" }))
		end) end
	end
	exports.scoreCareerEvents = scoreCareerEvents
	rarity = function(e, m)
		if NEVER_STALE:has(e.id) then
			do return 1 end
		end
		local n = M_memory.timesSeen(m, e.id)
		if (n == 0) then
			do return 1.45 end
		end
		if (n == 1) then
			do return 1.2 end
		end
		if (n <= 3) then
			do return 1 end
		end
		if (n <= 8) then
			do return 0.9 end
		end
		if (n <= 20) then
			do return 0.82 end
		end
		do return 0.74 end
	end
	fameWeight = function(e, fame, stars)
		local standing = Math.min(1, (((fame / 100) * 0.6) + ((stars / 5) * 0.4)))
		local personal = ((e.subject.kind == "you") or (e.subject.kind == "teammate"))
		if (not personal) then
			do return (0.95 + (standing * 0.15)) end
		end
		do return (0.62 + (standing * 0.5)) end
	end
	clamp = function(v)
		do return Math.max(1, Math.min(100, v)) end
	end
	headlineEvent = function(events)
		do return A.sort(Js.aspread(events), function(a, b)
			return ((if b.importance ~= nil then b.importance else 0) - (if a.importance ~= nil then a.importance else 0))
		end)[1] end
	end
	exports.headlineEvent = headlineEvent
	COMPETITION_WEIGHT = Js.O({ league = 1, cup = 1.12, europe = 1.28, international = 1.2 }, { "league", "cup", "europe", "international" })
	NEVER_STALE = Js.Set.new(Js.alit("goal-milestone", "assist-milestone", "appearance-milestone", "club-appearance-milestone", "trophy", "champions", "relegated", "ballon-dor", "retirement", "transfer-done", "into-the-final", "lost-the-final", "award-won", "hall-record"))
end
