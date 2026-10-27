--!nocheck
--!nolint
-- Generated from lib/star/nationNames.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_squadData = import("lib/star/squadData")
	local M_season = import("lib/star/season")
	local M_nation_names_json = import("data/names/nation-names_json")
	local BANKS, SAME, namePoolFor, weight, pick, weightedDeck, madeUpNames, madeUpName
	namePoolFor = function(nation)
		local b = (if BANKS[nation] ~= nil then BANKS[nation] else BANKS[(if SAME[nation] ~= nil then SAME[nation] else "")])
		do return (if ((b and Js.T(Js.alen(b.f))) and Js.T(Js.alen(b.l))) then Js.O({ first = b.f, last = b.l }, { "first", "last" }) else Js.O({ first = M_squadData.FIRST_NAMES, last = M_squadData.LAST_NAMES }, { "first", "last" })) end
	end
	exports.namePoolFor = namePoolFor
	pick = function(list, rng)
		local total = 0
		for i = 0, (Js.alen(list)) - 1 do
			total += weight(i)
		end
		local r = (rng() * total)
		for i = 0, (Js.alen(list)) - 1 do
			r -= weight(i)
			if (r <= 0) then
				do return list[i + 1] end
			end
		end
		do return list[Js.alen(list)] end
	end
	weightedDeck = function(list, rng)
		do return A.map(A.sort(A.map(list, function(x, i)
			return Js.O({ x = x, k = Math.pow(rng(), (1 / weight(i))) }, { "x", "k" })
		end), function(a, b)
			return (b.k - a.k)
		end), function(e)
			return e.x
		end) end
	end
	madeUpNames = function(nation, count)
		local pool = namePoolFor(nation)
		local rng = M_season.mulberry32(M_squadData.clubNameSeed(("names|" .. nation)))
		local used = Js.Set.new()
		local deck = weightedDeck(pool.last, rng)
		local out = Js.alit()
		for i = 0, math.ceil(count) - 1 do
			local name = ""
			do
				local tries = 0
				local _first1 = true
				while true do
					if not _first1 then
						tries += 1
					end
					_first1 = false
					if not ((tries < 50) and ((not Js.T(name)) or used:has(name))) then break end
					local last = (if ((i < Js.alen(deck)) and (tries == 0)) then deck[i + 1] else pick(pool.last, rng))
					name = (pick(pool.first, rng) .. " " .. last)
				end
			end
			if used:has(name) then
				name = (name .. " " .. Js.numstr((i + 1)))
			end
			used:add(name)
			A.push(out, name)
		end
		do return out end
	end
	exports.madeUpNames = madeUpNames
	madeUpName = function(nation, key)
		local pool = namePoolFor(nation)
		local rng = M_season.mulberry32(M_squadData.clubNameSeed(("regen|" .. nation .. "|" .. key)))
		do return (pick(pool.first, rng) .. " " .. pick(pool.last, rng)) end
	end
	exports.madeUpName = madeUpName
	BANKS = M_nation_names_json.default
	SAME = Js.O({ USA = "United States", ["Cote d'Ivoire"] = "Ivory Coast", ["Côte d'Ivoire"] = "Ivory Coast", ["Türkiye"] = "Turkey", Czechia = "Czech Republic", Ireland = "Republic of Ireland", ["South Korea"] = "Korea Republic", ["North Korea"] = "Korea DPR", China = "China PR", ["IR Iran"] = "Iran", ["Cabo Verde"] = "Cape Verde", ["Curaçao"] = "Curacao" }, { "USA", "Cote d'Ivoire", "Côte d'Ivoire", "Türkiye", "Czechia", "Ireland", "South Korea", "North Korea", "China", "IR Iran", "Cabo Verde", "Curaçao" })
	weight = function(rank)
		return (1 / Math.pow((rank + 4), 0.7))
	end
end
