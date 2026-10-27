--!nocheck
--!nolint
-- Generated from lib/star/media/trending.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_grammar = import("lib/star/media/grammar")
	local MIN_TRENDS, TAG_LABEL, buildTrends, formatVolume
	buildTrends = function(events, posts, cycleId, fame)
		local rng = M_grammar.rngFor("trend", cycleId)
		local scores = Js.Map.new()
		local bump = function(label, tag, importance, reach)
			local cur = (scores:get(label) or Js.O({ volume = 0, tag = tag, importance = 0 }, { "volume", "tag", "importance" }))
			cur.volume += reach
			cur.importance = Math.max(cur.importance, importance)
			scores:set(label, cur)
		end
		do
			local _arr1 = events
			local _i2 = 0
			while _i2 < Js.alen(_arr1) do
				_i2 += 1
				local e = _arr1[_i2]
				local importance = (if e.importance ~= nil then e.importance else e.baseImportance)
				if (importance < 25) then
					do continue end
				end
				local reach = A.reduce(A.filter(posts, function(p)
					return (p.eventId == e.id)
				end), function(s, p)
					return (s + p.metrics.likes)
				end, 0)
				local weight = Math.max(reach, (importance * 40))
				local name = (if ((e.subject.kind == "you") or (e.subject.kind == "teammate")) then M_grammar.surname(e.subject.name) else e.subject.name)
				bump(name, (if e.tags[1] ~= nil then e.tags[1] else "table"), importance, weight)
				do
					local _arr3 = e.tags
					local _i4 = 0
					while _i4 < Js.alen(_arr3) do
						_i4 += 1
						local t = _arr3[_i4]
						local label = TAG_LABEL[t]
						if Js.T(label) then
							bump(label, t, importance, (weight * 0.6))
						end
					end
				end
			end
		end
		local out = A.slice(A.sort(A.map(Js.Array.from(scores:entries()), function(_p5)
			local label = _p5[1]
			local v = _p5[2]
			return Js.O({ label = label, tag = v.tag, hot = (v.importance >= 70), volume = Math.round(((v.volume * (0.5 + Math.min(1.6, (fame / 60)))) * (0.8 + (rng() * 0.5)))) }, { "label", "tag", "hot", "volume" })
		end), function(a, b)
			return (b.volume - a.volume)
		end), 0, MIN_TRENDS)
		if (Js.alen(out) < MIN_TRENDS) then
			local used = Js.Set.new(A.map(out, function(t)
				return t.label
			end))
			do
				local _arr6 = Js.Object.entries(TAG_LABEL)
				local _i7 = 0
				while _i7 < Js.alen(_arr6) do
					_i7 += 1
					local _e8 = _arr6[_i7]
					local tag = _e8[1]
					local label = _e8[2]
					if (Js.alen(out) >= MIN_TRENDS) then
						do break end
					end
					if ((not Js.T(label)) or used:has(label)) then
						do continue end
					end
					A.push(out, Js.O({ label = label, tag = tag, hot = false, volume = Math.round(((300 + (rng() * 900)) * (0.5 + Math.min(1.6, (fame / 60))))) }, { "label", "tag", "hot", "volume" }))
					used:add(label)
				end
			end
			A.sort(out, function(a, b)
				return (b.volume - a.volume)
			end)
		end
		do return out end
	end
	exports.buildTrends = buildTrends
	formatVolume = function(n)
		if (n >= 1000000) then
			do return (N.toFixed((n / 1000000), 1) .. "M posts") end
		end
		if (n >= 1000) then
			do return (N.toFixed((n / 1000), 1) .. "K posts") end
		end
		do return (Js.numstr(Math.max(1, n)) .. " posts") end
	end
	exports.formatVolume = formatVolume
	MIN_TRENDS = 10
	TAG_LABEL = Js.O({ derby = "Derby Day", title = "Title Race", relegation = "Relegation", transfer = "Transfer News", trophy = "Trophy", manager = "Manager", record = "Records", streak = "The Run", europe = "European Nights", cup = "Cup Football", form = "Form Table", table = "League Table", contract = "Contract Talk", award = "Awards", international = "Internationals", rumour = "Transfer Rumours", debut = "Debuts", stat = "Stat of the Day", milestone = "Milestone Watch", drama = "Talking Points" }, { "derby", "title", "relegation", "transfer", "trophy", "manager", "record", "streak", "europe", "cup", "form", "table", "contract", "award", "international", "rumour", "debut", "stat", "milestone", "drama" })
end
