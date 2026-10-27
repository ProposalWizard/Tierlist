--!nocheck
--!nolint
-- Generated from lib/star/incumbency.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_formations = import("lib/star/formations")
	local M_clubFormation = import("lib/star/clubFormation")
	local ATTACKING_ROLES, graceGamesFor, isAttacking, wonOrDrew, starterAndChallenger, advanceIncumbencyWeek, incumbencyRecordsFor
	graceGamesFor = function(gap)
		do return Math.max(0, (3 - math.floor((gap / 2)))) end
	end
	exports.graceGamesFor = graceGamesFor
	isAttacking = function(role)
		do return A.includes(ATTACKING_ROLES, role) end
	end
	wonOrDrew = function(club, results)
		local r = A.find(results, function(res)
			return ((res.home == club) or (res.away == club))
		end)
		if (not r) then
			do return true end
		end
		do return ((r.hs == r.as) or (if (r.home == club) then (r.hs >= r.as) else (r.as >= r.hs))) end
	end
	starterAndChallenger = function(squad, role, trackedStarterId)
		local fits = A.filter(A.map(squad.players, function(p, i)
			return Js.O({ p = p, i = i, fit = M_formations.bestFitness(role, p) }, { "p", "i", "fit" })
		end), function(x)
			return (x.fit >= 82)
		end)
		local startingFits = A.sort(A.filter(fits, function(x)
			return (x.i < 11)
		end), function(a, b)
			return (b.p.overall - a.p.overall)
		end)
		local benchFits = A.sort(A.filter(fits, function(x)
			return (x.i >= 11)
		end), function(a, b)
			return (b.p.overall - a.p.overall)
		end)
		if (Js.alen(startingFits) == 0) then
			do return Js.O({ starter = nil, starterIndex = -1, challenger = nil, challengerIndex = -1 }, { "starter", "starterIndex", "challenger", "challengerIndex" }) end
		end
		local tracked = (if Js.T(trackedStarterId) then A.find(fits, function(x)
			return (x.p.id == trackedStarterId)
		end) else nil)
		local best = (if tracked ~= nil then tracked else startingFits[1])
		local rival = A.find(benchFits, function(x)
			return (x.p.overall > best.p.overall)
		end)
		do return Js.O({ starter = best.p, starterIndex = best.i, challenger = (function() local _v = rival; if _v == nil then return nil end; _v = _v.p; return _v end)(), challengerIndex = ((function() local _v = rival; if _v == nil then return nil end; _v = _v.i; return _v end)() or -1) }, { "starter", "starterIndex", "challenger", "challengerIndex" }) end
	end
	advanceIncumbencyWeek = function(career, results)
		local squads = (if career.leagueSquads ~= nil then career.leagueSquads else Js.alit())
		if (Js.alen(squads) == 0) then
			do return career end
		end
		local records = Js.aspread((if career.incumbents ~= nil then career.incumbents else Js.alit()))
		local changedSquads = false
		local nextSquads = A.map(squads, function(sq)
			if (sq.club == career.player.club) then
				do return sq end
			end
			local formation = M_clubFormation.formationForClub(sq.club)
			local roles = Js.Array.from(Js.Set.new(A.map(formation.slots, function(s)
				return s.role
			end)))
			local players = sq.players
			local mutated = false
			do
				local _arr1 = roles
				local _i2 = 0
				while _i2 < Js.alen(_arr1) do
					_i2 += 1
					local role = _arr1[_i2]
					local idx = A.findIndex(records, function(r)
						return ((r.club == sq.club) and (r.position == role))
					end)
					local existing = (if (idx >= 0) then records[idx + 1] else nil)
					local _d3 = starterAndChallenger(Js.ospread(sq, Js.O({ players = players }, { "players" })), role, (function() local _v = existing; if _v == nil then return nil end; _v = _v.starterId; return _v end)())
					local starter = _d3.starter
					local starterIndex = _d3.starterIndex
					local challenger = _d3.challenger
					local challengerIndex = _d3.challengerIndex
					if (not starter) then
						do continue end
					end
					if (not challenger) then
						if (idx >= 0) then
							A.splice(records, idx, 1)
						end
						do continue end
					end
					local gap = (challenger.overall - starter.overall)
					local grace = graceGamesFor(gap)
					local isFreshRivalry = ((not existing) or (existing.starterId ~= starter.id))
					local doSwap = function()
						if (players == sq.players) then
							players = Js.aspread(sq.players)
						end
						local _d4 = Js.alit(players[challengerIndex + 1], players[starterIndex + 1])
						A.set(players, starterIndex, _d4[1])
						A.set(players, challengerIndex, _d4[2])
						mutated = true
						do return Js.O({ club = sq.club, position = role, starterId = challenger.id, previousStarterId = starter.id, graceRemaining = graceGamesFor(0), lastGoalsPlusAssists = (challenger.goals + challenger.assists) }, { "club", "position", "starterId", "previousStarterId", "graceRemaining", "lastGoalsPlusAssists" }) end
					end
					local record = nil
					if isFreshRivalry then
						record = (if (grace == 0) then doSwap() else Js.O({ club = sq.club, position = role, starterId = starter.id, graceRemaining = grace, lastGoalsPlusAssists = (starter.goals + starter.assists) }, { "club", "position", "starterId", "graceRemaining", "lastGoalsPlusAssists" }))
					else
						local currentTotal = (starter.goals + starter.assists)
						local passed = (if isAttacking(role) then (currentTotal > existing.lastGoalsPlusAssists) else wonOrDrew(sq.club, results))
						record = (if passed then Js.ospread(existing, Js.O({ graceRemaining = grace, lastGoalsPlusAssists = currentTotal }, { "graceRemaining", "lastGoalsPlusAssists" })) else (if (existing.graceRemaining <= 0) then doSwap() else Js.ospread(existing, Js.O({ graceRemaining = (existing.graceRemaining - 1), lastGoalsPlusAssists = currentTotal }, { "graceRemaining", "lastGoalsPlusAssists" }))))
					end
					if (idx >= 0) then
						A.set(records, idx, record)
					else
						A.push(records, record)
					end
				end
			end
			if mutated then
				changedSquads = true
			end
			do return (if mutated then Js.ospread(sq, Js.O({ players = players }, { "players" })) else sq) end
		end)
		do return Js.ospread(career, Js.O({ incumbents = records }, { "incumbents" }), (if changedSquads then Js.O({ leagueSquads = nextSquads }, { "leagueSquads" }) else Js.O({}, nil))) end
	end
	exports.advanceIncumbencyWeek = advanceIncumbencyWeek
	incumbencyRecordsFor = function(career, club)
		do return A.filter((if career.incumbents ~= nil then career.incumbents else Js.alit()), function(r)
			return (r.club == club)
		end) end
	end
	exports.incumbencyRecordsFor = incumbencyRecordsFor
	ATTACKING_ROLES = Js.alit("ST", "LW", "RW", "CAM")
end
