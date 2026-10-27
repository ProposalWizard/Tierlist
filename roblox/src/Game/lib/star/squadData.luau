--!nocheck
--!nolint
-- Generated from lib/star/squadData.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_season = import("lib/star/season")
	local M_fakeFaces = import("lib/star/fakeFaces")
	local FIRST_NAMES, LAST_NAMES, SQUAD_POSITIONS, generateSquad, clubNameSeed, pickSquadScorer, pickSquadAssist
	generateSquad = function(seed)
		local rng = M_season.mulberry32(seed)
		local usedNames = Js.Set.new()
		do return A.map(SQUAD_POSITIONS, function(pos, i)
			local full = ""
			local tries = 0
			while ((not Js.T(full)) or usedNames:has(full)) do
				local first = FIRST_NAMES[math.floor((rng() * Js.alen(FIRST_NAMES))) + 1]
				local last = LAST_NAMES[math.floor((rng() * Js.alen(LAST_NAMES))) + 1]
				full = (first .. " " .. last)
				if ((function() local _n = tries + 1; tries = _n; return _n end)() > 60) then
					full = (first .. Js.numstr(i))
					do break end
				end
			end
			usedNames:add(full)
			local id = ("sp_" .. Js.numstr(i))
			do return Js.O({ id = id, name = full, shortName = S.split(full, " ")[2], position = pos, seasonGoals = 0, seasonAssists = 0, careerGoals = 0, careerAssists = 0, imageUrl = M_fakeFaces.fakeFaceFor((Js.numstr(seed) .. ":" .. id)) }, { "id", "name", "shortName", "position", "seasonGoals", "seasonAssists", "careerGoals", "careerAssists", "imageUrl" }) end
		end) end
	end
	exports.generateSquad = generateSquad
	clubNameSeed = function(name)
		local h = 5381
		for i = 0, (S.len(name)) - 1 do
			h = Js.bor(Js.bxor((Js.shl(h, 5) + h), S.charCodeAt(name, i)), 0)
		end
		do return Js.ushr(h, 0) end
	end
	exports.clubNameSeed = clubNameSeed
	pickSquadScorer = function(squad, rng)
		local attackers = A.filter(squad, function(p)
			return A.includes(Js.alit("ST", "CAM", "LW", "RW"), p.position)
		end)
		local mids = A.filter(squad, function(p)
			return A.includes(Js.alit("CM", "CDM"), p.position)
		end)
		local r = rng()
		local pool = (if (r < 0.65) then attackers else (if (r < 0.9) then mids else A.filter(squad, function(p)
			return (p.position ~= "GK")
		end)))
		local from = (if (Js.alen(pool) > 0) then pool else A.filter(squad, function(p)
			return (p.position ~= "GK")
		end))
		if (Js.alen(from) == 0) then
			do return nil end
		end
		do return from[math.floor((rng() * Js.alen(from))) + 1] end
	end
	exports.pickSquadScorer = pickSquadScorer
	pickSquadAssist = function(squad, excludeId, rng)
		if (rng() < 0.35) then
			do return nil end
		end
		local eligible = function(p)
			return ((p.id ~= excludeId) and (p.position ~= "GK"))
		end
		local primary = A.filter(squad, function(p)
			return (eligible(p) and A.includes(Js.alit("CM", "CAM", "LW", "RW", "CDM"), p.position))
		end)
		local secondary = A.filter(squad, function(p)
			return (eligible(p) and A.includes(Js.alit("ST", "RB", "LB"), p.position))
		end)
		local rest = A.filter(squad, function(p)
			return (eligible(p) and (not A.includes(Js.alit("CM", "CAM", "LW", "RW", "CDM", "ST", "RB", "LB"), p.position)))
		end)
		local r = rng()
		local pool = (if (r < 0.7) then primary else (if (r < 0.95) then secondary else rest))
		local from = (if (Js.alen(pool) > 0) then pool else A.filter(squad, eligible))
		if (Js.alen(from) == 0) then
			do return nil end
		end
		do return from[math.floor((rng() * Js.alen(from))) + 1] end
	end
	exports.pickSquadAssist = pickSquadAssist
	FIRST_NAMES = Js.alit("Jack", "Harry", "Ryan", "Tom", "James", "Charlie", "Oliver", "Luke", "George", "Mason", "Marcus", "Jordan", "Theo", "Emre", "Kai", "Luca", "Bruno", "Fabio", "Carlos", "Diego", "Pablo", "Sergio", "Alexis", "Pierre", "Antoine", "Oumar", "Ibrahim", "Moussa", "Mamadou", "Mohamed", "Riyad", "Roberto", "Andres", "Kylian", "Vinicius", "Rodrygo", "Ivan", "Victor", "Christian", "Wilfried", "Ruben", "Diogo", "Bernardo", "Raphael", "Gabriel", "Eddie", "Callum", "Ben")
	exports.FIRST_NAMES = FIRST_NAMES
	LAST_NAMES = Js.alit("Smith", "Jones", "Williams", "Brown", "Taylor", "Anderson", "Wright", "Walker", "Clarke", "Mitchell", "Barrett", "Nkrumah", "Traore", "Diallo", "Ba", "Coulibaly", "Silva", "Santos", "Costa", "Ferreira", "Rodrigues", "Garcia", "Martinez", "Lopez", "Hernandez", "Moreno", "Suarez", "Gomez", "Mbappe", "Diop", "Konate", "Toure", "Savic", "Kovacic", "Perisic", "Modric", "Muller", "Werner", "Sterling", "Salah", "Firmino", "Mane", "Dias", "Cancelo", "Zaha", "Watkins", "Wilson", "Toney")
	exports.LAST_NAMES = LAST_NAMES
	SQUAD_POSITIONS = Js.alit("GK", "CB", "CB", "RB", "LB", "CDM", "CM", "CM", "RW", "LW", "CAM", "ST", "GK", "CB", "CDM", "CM", "RW", "LW", "CAM", "ST")
end
