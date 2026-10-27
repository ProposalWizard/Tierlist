--!nocheck
--!nolint
-- Generated from lib/star/media/detect/wonderkids.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_kit = import("lib/star/media/detect/kit")
	local MAX_PICKS_PER_WEEK, clubSubject, detectWonderkidHype
	clubSubject = function(name)
		do return Js.O({ kind = "club", name = name }, { "kind", "name" }) end
	end
	detectWonderkidHype = function(squads, week, season, rng, chance)
		if (rng() >= chance) then
			do return Js.alit() end
		end
		local pool = Js.alit()
		do
			local _arr1 = squads
			local _i2 = 0
			while _i2 < Js.alen(_arr1) do
				_i2 += 1
				local s = _arr1[_i2]
				do
					local _arr3 = s.players
					local _i4 = 0
					while _i4 < Js.alen(_arr3) do
						_i4 += 1
						local p = _arr3[_i4]
						if (not p.highPotential) then
							do continue end
						end
						A.push(pool, Js.O({ club = s.club, id = p.id, name = p.name, overall = p.overall, age = p.age }, { "club", "id", "name", "overall", "age" }))
					end
				end
			end
		end
		if (Js.alen(pool) == 0) then
			do return Js.alit() end
		end
		local pick = pool[math.fmod(math.floor((rng() * Js.alen(pool))), Js.alen(pool)) + 1]
		do return A.slice(Js.alit(M_kit.ev("wonderkid-hype", clubSubject(pick.club), 30, Js.alit("rumour"), Js.ospread(Js.O({ club = pick.club, player = pick.name, overall = pick.overall, season = season, week = week }, { "club", "player", "overall", "season", "week" }), (if (pick.age ~= nil) then Js.O({ age = pick.age }, { "age" }) else Js.O({}, nil))), "weekly")), 0, MAX_PICKS_PER_WEEK) end
	end
	exports.detectWonderkidHype = detectWonderkidHype
	MAX_PICKS_PER_WEEK = 1
end
