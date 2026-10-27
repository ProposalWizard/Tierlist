--!nocheck
--!nolint
-- Generated from lib/star/teamsheet.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_lineupStore = import("lib/star/lineupStore")
	local M_realSquad = import("lib/star/realSquad")
	local M_formations = import("lib/star/formations")
	local M_clubFormation = import("lib/star/clubFormation")
	local M_rating = import("lib/star/rating")
	local M_incumbency = import("lib/star/incumbency")
	local M_season = import("lib/star/season")
	local resolveLineupFor, fromSquad, fromLeagueSquad, rotationChanceFor, rotationSeedFor, applyRotation, fillGaps, bareSofifaId, withFullRosterFallback, resolveSavedId, build, forceIntoXI, pinDevStarters, forceOntoBench, matchdayFor, sheetReady, OFFERABLE_ROLES, alternatePositions, SEAT_CHAIN, seatSlotFor, offeredPositions, POSITION_NAMES, startingTeammateRoles, opponentStartingXI, onPitchToday, fillMissingFromFullRoster
	resolveLineupFor = function(career, club)
		do return ((function() local _v = career.ownedLineups; if _v == nil then return nil end; _v = _v[club]; return _v end)() or M_lineupStore.loadLineup(club)) end
	end
	fromSquad = function(squad, you)
		do return A.map(squad, function(p)
			return Js.O({ id = p.id, name = p.name, short = (if Js.T(p.shortName) then p.shortName else M_realSquad.shortNameOf(p.name)), position = p.position, positions = p.positions, overall = (if p.overall ~= nil then p.overall else 68), face = p.imageUrl, nation = p.nationality, defending = p.defending, isYou = ((not (not you)) and (p.id == you.id)) }, { "id", "name", "short", "position", "positions", "overall", "face", "nation", "defending", "isYou" })
		end) end
	end
	fromLeagueSquad = function(squad)
		do return A.map(((function() local _v = squad; if _v == nil then return nil end; _v = _v.players; return _v end)() or Js.alit()), function(p)
			return Js.O({ id = p.id, name = p.name, short = M_realSquad.shortNameOf(p.name), position = p.position, positions = p.positions, overall = p.overall, face = p.image, nation = p.nation, defending = p.defending }, { "id", "name", "short", "position", "positions", "overall", "face", "nation", "defending" })
		end) end
	end
	rotationChanceFor = function(fixture)
		local isDomesticCup = (((fixture.competition == "FA Cup") or (fixture.competition == "League Cup")) or (fixture.competition == "Lower League Trophy"))
		local isEarlyRound = A.includes(Js.alit("Round 1", "Round of 64", "Round of 32", "Round of 16", "Third Round", "Fourth Round"), (if fixture.round ~= nil then fixture.round else ""))
		if (isDomesticCup and isEarlyRound) then
			do return 0.28 end
		end
		if isDomesticCup then
			do return 0.14 end
		end
		if ((not Js.T(fixture.kind)) or (fixture.kind == "league")) then
			do return 0.06 end
		end
		do return 0.03 end
	end
	rotationSeedFor = function(club, fixture, season)
		local key = (club .. "|" .. fixture.opponent .. "|" .. Js.numstr(fixture.week) .. "|" .. (if fixture.kind ~= nil then fixture.kind else "league") .. "|" .. (if fixture.round ~= nil then fixture.round else "") .. "|" .. Js.numstr(season))
		local h = 2166136261
		for i = 0, (S.len(key)) - 1 do
			h = Js.bxor(h, S.charCodeAt(key, i))
			h = Math.imul(h, 16777619)
		end
		do return Js.ushr(h, 0) end
	end
	applyRotation = function(picked, pool, formation, plan)
		if (plan.rng() >= plan.chance) then
			do return picked end
		end
		local swapCount = (if (plan.rng() < 0.8) then 1 else 2)
		local result = Js.aspread(picked)
		local rotatedSlots = Js.Set.new()
		for s = 0, math.ceil(swapCount) - 1 do
			local slotOptions = A.filter(A.map(formation.slots, function(_, i)
				return i
			end), function(i)
				return (if Js.T(result[i + 1]) then (not rotatedSlots:has(i)) else result[i + 1])
			end)
			if (Js.alen(slotOptions) == 0) then
				do break end
			end
			local slotIdx = slotOptions[math.floor((plan.rng() * Js.alen(slotOptions))) + 1]
			local role = formation.slots[slotIdx + 1].role
			local inXI = Js.Set.new(A.filter(result, function(id)
				return (not (not Js.T(id)))
			end))
			local alternates = A.sort(A.filter(pool, function(p)
				return ((p.position == role) and (not inXI:has(p.id)))
			end), function(a, b)
				return ((if b.overall ~= nil then b.overall else 0) - (if a.overall ~= nil then a.overall else 0))
			end)
			if (Js.alen(alternates) == 0) then
				do continue end
			end
			local shortlist = A.slice(alternates, 0, Math.min(3, Js.alen(alternates)))
			local chosen = shortlist[math.floor((plan.rng() * Js.alen(shortlist))) + 1]
			A.set(result, slotIdx, chosen.id)
			rotatedSlots:add(slotIdx)
		end
		do return result end
	end
	fillGaps = function(pool, formation, chosen)
		local taken = Js.Set.new(A.filter(chosen, function(id)
			return (not (not Js.T(id)))
		end))
		local spare = A.filter(pool, function(p)
			return (not taken:has(p.id))
		end)
		local gapIndices = A.filter(A.map(chosen, function(id, i)
			return (if Js.T(id) then -1 else i)
		end), function(i)
			return (i >= 0)
		end)
		if (Js.alen(gapIndices) == 0) then
			do return chosen end
		end
		local gapFormation = Js.ospread(formation, Js.O({ slots = A.map(gapIndices, function(i)
			return formation.slots[i + 1]
		end) }, { "slots" }))
		local picks = M_formations.autoPick(spare, gapFormation)
		local result = Js.aspread(chosen)
		A.forEach(gapIndices, function(slotIdx, k)
			A.set(result, slotIdx, (if picks[k + 1] ~= nil then picks[k + 1] else nil))
		end)
		do return result end
	end
	bareSofifaId = function(id)
		do return (if S.startsWith(id, "sf_") then S.slice(id, 3) else id) end
	end
	withFullRosterFallback = function(squadPool, fullRoster)
		local known = Js.Set.new(A.map(squadPool, function(p)
			return bareSofifaId(p.id)
		end))
		local missing = A.filter(fullRoster, function(p)
			return (not known:has(bareSofifaId(p.id)))
		end)
		do return Js.aspread(squadPool, missing) end
	end
	resolveSavedId = function(byId, id)
		if (not Js.T(id)) then
			do return nil end
		end
		if byId:has(id) then
			do return id end
		end
		local prefixed = ("sf_" .. id)
		do return (if byId:has(prefixed) then prefixed else nil) end
	end
	build = function(club, pool, yours, savedBenchIds, saved, rotation)
		local byId = Js.Map.new(A.map(pool, function(p)
			return Js.alit(p.id, p)
		end))
		local formation = ((function() local _v = saved; if _v == nil then return nil end; _v = _v.formation; return _v end)() or M_clubFormation.formationForClub(club))
		local picked = (if saved then fillGaps(pool, formation, A.map(formation.slots, function(_, i)
			return resolveSavedId(byId, saved.xi[i + 1])
		end)) else (if rotation then applyRotation(M_formations.autoPick(pool, formation), pool, formation, rotation) else M_formations.autoPick(pool, formation)))
		local xi = Js.alit()
		A.forEach(formation.slots, function(slot, i)
			local p = (if Js.T(picked[i + 1]) then byId:get(picked[i + 1]) else nil)
			if (not p) then
				do return end
			end
			A.push(xi, Js.O({ id = p.id, name = p.name, short = p.short, role = slot.role, slot = (if slot.label ~= nil then slot.label else slot.role), overall = p.overall, face = p.face, nation = p.nation, defending = p.defending, isYou = p.isYou, x = slot.x, y = slot.y }, { "id", "name", "short", "role", "slot", "overall", "face", "nation", "defending", "isYou", "x", "y" }))
		end)
		local started = Js.Set.new(A.map(xi, function(p)
			return p.id
		end))
		local bench = nil
		if (savedBenchIds and (Js.alen(savedBenchIds) > 0)) then
			local savedPicks = A.slice(A.filter(A.map(A.filter(A.map(savedBenchIds, function(id)
				return resolveSavedId(byId, id)
			end), function(id)
				return ((not (not Js.T(id))) and (not started:has(id)))
			end), function(id)
				return byId:get(id)
			end), function(p)
				return (not (not p))
			end), 0, 9)
			local onBench = Js.Set.new(A.map(savedPicks, function(p)
				return p.id
			end))
			local topUp = (if (Js.alen(savedPicks) < 9) then A.slice(A.sort(A.filter(pool, function(p)
				return ((not started:has(p.id)) and (not onBench:has(p.id)))
			end), function(a, b)
				return ((if b.overall ~= nil then b.overall else 0) - (if a.overall ~= nil then a.overall else 0))
			end), 0, (9 - Js.alen(savedPicks))) else Js.alit())
			bench = A.map(Js.aspread(savedPicks, topUp), function(p)
				return Js.O({ id = p.id, name = p.name, short = p.short, role = p.position, slot = p.position, overall = p.overall, face = p.face, nation = p.nation, defending = p.defending, isYou = p.isYou, x = 0, y = 0 }, { "id", "name", "short", "role", "slot", "overall", "face", "nation", "defending", "isYou", "x", "y" })
			end)
		else
			bench = A.map(A.slice(A.sort(A.filter(pool, function(p)
				return (not started:has(p.id))
			end), function(a, b)
				return ((if b.overall ~= nil then b.overall else 0) - (if a.overall ~= nil then a.overall else 0))
			end), 0, 9), function(p)
				return Js.O({ id = p.id, name = p.name, short = p.short, role = p.position, slot = p.position, overall = p.overall, face = p.face, nation = p.nation, defending = p.defending, isYou = p.isYou, x = 0, y = 0 }, { "id", "name", "short", "role", "slot", "overall", "face", "nation", "defending", "isYou", "x", "y" })
			end)
		end
		if (Js.alen(bench) < 9) then
			local onBenchAlready = Js.Set.new(A.map(bench, function(p)
				return p.id
			end))
			local extra = A.map(A.slice(A.sort(A.filter(pool, function(p)
				return ((not started:has(p.id)) and (not onBenchAlready:has(p.id)))
			end), function(a, b)
				return ((if b.overall ~= nil then b.overall else 0) - (if a.overall ~= nil then a.overall else 0))
			end), 0, (9 - Js.alen(bench))), function(p)
				return Js.O({ id = p.id, name = p.name, short = p.short, role = p.position, slot = p.position, overall = p.overall, face = p.face, nation = p.nation, defending = p.defending, isYou = p.isYou, x = 0, y = 0 }, { "id", "name", "short", "role", "slot", "overall", "face", "nation", "defending", "isYou", "x", "y" })
			end)
			bench = Js.aspread(bench, extra)
		end
		do return Js.O({ club = club, formation = formation, xi = xi, bench = bench, yours = yours }, { "club", "formation", "xi", "bench", "yours" }) end
	end
	forceIntoXI = function(sheet, me)
		if A.some(sheet.xi, function(p)
			return p.isYou
		end) then
			do return sheet end
		end
		local filled = Js.Set.new(A.map(sheet.xi, function(p)
			return (Js.numstr(p.x) .. "," .. Js.numstr(p.y))
		end))
		local chain = (if SEAT_CHAIN[me.position] ~= nil then SEAT_CHAIN[me.position] else Js.alit(me.position))
		local vacantSlot = nil
		do
			local _arr1 = chain
			local _i2 = 0
			while _i2 < Js.alen(_arr1) do
				_i2 += 1
				local r = _arr1[_i2]
				vacantSlot = A.find(sheet.formation.slots, function(s)
					return ((s.role == r) and (not filled:has((Js.numstr(s.x) .. "," .. Js.numstr(s.y)))))
				end)
				if vacantSlot then
					do break end
				end
			end
		end
		if vacantSlot then
			do return Js.ospread(sheet, Js.O({ xi = Js.aspread(sheet.xi, Js.alit(Js.O({ id = me.id, name = me.name, short = me.short, role = vacantSlot.role, slot = (if vacantSlot.label ~= nil then vacantSlot.label else vacantSlot.role), overall = me.overall, face = me.face, nation = me.nation, defending = me.defending, isYou = true, x = vacantSlot.x, y = vacantSlot.y }, { "id", "name", "short", "role", "slot", "overall", "face", "nation", "defending", "isYou", "x", "y" }))) }, { "xi" })) end
		end
		local target = -1
		do
			local _arr3 = chain
			local _i4 = 0
			while _i4 < Js.alen(_arr3) do
				_i4 += 1
				local r = _arr3[_i4]
				target = A.findIndex(sheet.xi, function(p)
					return (p.role == r)
				end)
				if (target >= 0) then
					do break end
				end
			end
		end
		local at = (if (target >= 0) then target else A.reduce(sheet.xi, function(worst, p, i, all)
			return (if ((p.role ~= "GK") and ((if p.overall ~= nil then p.overall else 0) < (if all[worst + 1].overall ~= nil then all[worst + 1].overall else 999))) then i else worst)
		end, A.findIndex(sheet.xi, function(p)
			return (p.role ~= "GK")
		end)))
		if (at < 0) then
			do return sheet end
		end
		local dropped = sheet.xi[at + 1]
		local slot = (sheet.formation.slots[A.findIndex(sheet.formation.slots, function(s)
			return (s.role == dropped.role)
		end) + 1] or Js.O({ x = dropped.x, y = dropped.y, role = dropped.role, label = dropped.slot }, { "x", "y", "role", "label" }))
		local xi = A.map(sheet.xi, function(p, i)
			return (if (i == at) then Js.O({ id = me.id, name = me.name, short = me.short, role = dropped.role, slot = dropped.slot, overall = me.overall, face = me.face, nation = me.nation, defending = me.defending, isYou = true, x = slot.x, y = slot.y }, { "id", "name", "short", "role", "slot", "overall", "face", "nation", "defending", "isYou", "x", "y" }) else p)
		end)
		do return Js.ospread(sheet, Js.O({ xi = xi, bench = A.slice(Js.aspread(Js.alit(Js.ospread(dropped, Js.O({ isYou = false }, { "isYou" }))), A.filter(sheet.bench, function(p)
			return (p.id ~= me.id)
		end)), 0, 9) }, { "xi", "bench" })) end
	end
	pinDevStarters = function(sheet, pinned)
		if (Js.alen(pinned) == 0) then
			do return sheet end
		end
		local protectedIds = Js.Set.new(A.map(pinned, function(p)
			return p.id
		end))
		local xi = Js.aspread(sheet.xi)
		local bench = Js.aspread(sheet.bench)
		do
			local _arr5 = pinned
			local _i6 = 0
			while _i6 < Js.alen(_arr5) do
				_i6 += 1
				local p = _arr5[_i6]
				if A.some(xi, function(x)
					return (x.id == p.id)
				end) then
					do continue end
				end
				bench = A.filter(bench, function(b)
					return (b.id ~= p.id)
				end)
				local fixed = function(x)
					return ((not (not x.isYou)) or protectedIds:has(x.id))
				end
				local chain = (if SEAT_CHAIN[p.role] ~= nil then SEAT_CHAIN[p.role] else Js.alit(p.role))
				local filled = Js.Set.new(A.map(xi, function(x)
					return (Js.numstr(x.x) .. "," .. Js.numstr(x.y))
				end))
				local vacant = nil
				do
					local _arr7 = chain
					local _i8 = 0
					while _i8 < Js.alen(_arr7) do
						_i8 += 1
						local r = _arr7[_i8]
						vacant = A.find(sheet.formation.slots, function(s)
							return ((s.role == r) and (not filled:has((Js.numstr(s.x) .. "," .. Js.numstr(s.y)))))
						end)
						if vacant then
							do break end
						end
					end
				end
				if (vacant and (Js.alen(xi) < 11)) then
					A.push(xi, Js.ospread(p, Js.O({ role = vacant.role, slot = (if vacant.label ~= nil then vacant.label else vacant.role), x = vacant.x, y = vacant.y, isYou = false }, { "role", "slot", "x", "y", "isYou" })))
					do continue end
				end
				local weakestAt = function(test)
					local at = -1
					A.forEach(xi, function(x, i)
						if (fixed(x) or (not test(x))) then
							do return end
						end
						if ((at < 0) or ((if x.overall ~= nil then x.overall else 0) < (if xi[at + 1].overall ~= nil then xi[at + 1].overall else 0))) then
							at = i
						end
					end)
					do return at end
				end
				local at = -1
				if (p.role == "GK") then
					at = weakestAt(function(x)
						return (x.role == "GK")
					end)
				else
					at = weakestAt(function(x)
						return (x.role == p.role)
					end)
					do
						local k = 0
						local _first9 = true
						while true do
							if not _first9 then
								k += 1
							end
							_first9 = false
							if not ((at < 0) and (k < Js.alen(chain))) then break end
							at = weakestAt(function(x)
								return (x.role == chain[k + 1])
							end)
						end
					end
					if (at < 0) then
						at = weakestAt(function(x)
							return (x.role ~= "GK")
						end)
					end
				end
				if (at < 0) then
					do continue end
				end
				local out = xi[at + 1]
				xi = A.map(xi, function(x, i)
					return (if (i == at) then Js.ospread(p, Js.O({ role = out.role, slot = out.slot, x = out.x, y = out.y, isYou = false }, { "role", "slot", "x", "y", "isYou" })) else x)
				end)
				bench = A.slice(Js.aspread(Js.alit(Js.ospread(out, Js.O({ isYou = false }, { "isYou" }))), bench), 0, 9)
			end
		end
		do return Js.ospread(sheet, Js.O({ xi = xi, bench = bench }, { "xi", "bench" })) end
	end
	exports.pinDevStarters = pinDevStarters
	forceOntoBench = function(sheet, me)
		if (A.some(sheet.xi, function(p)
			return p.isYou
		end) or A.some(sheet.bench, function(p)
			return p.isYou
		end)) then
			do return sheet end
		end
		local meSheet = Js.O({ id = me.id, name = me.name, short = me.short, role = me.position, slot = me.position, overall = me.overall, face = me.face, nation = me.nation, defending = me.defending, isYou = true, x = 0, y = 0 }, { "id", "name", "short", "role", "slot", "overall", "face", "nation", "defending", "isYou", "x", "y" })
		if (Js.alen(sheet.bench) < 9) then
			do return Js.ospread(sheet, Js.O({ bench = Js.aspread(sheet.bench, Js.alit(meSheet)) }, { "bench" })) end
		end
		local weakest = A.reduce(sheet.bench, function(worst, p, i, all)
			return (if ((if p.overall ~= nil then p.overall else 0) < (if all[worst + 1].overall ~= nil then all[worst + 1].overall else 999)) then i else worst)
		end, 0)
		do return Js.ospread(sheet, Js.O({ bench = A.map(sheet.bench, function(p, i)
			return (if (i == weakest) then meSheet else p)
		end) }, { "bench" })) end
	end
	matchdayFor = function(career, fixture, starting, playAs, savedBench, savedXI, onBench)
		local mine = career.player.club
		local theirs = fixture.opponent
		local you = Js.O({ id = "you", name = (career.player.firstName .. " " .. career.player.lastName), short = career.player.lastName, position = ((if playAs ~= nil then playAs else career.player.position) or "ST"), overall = M_rating.displayOverall((if career.starRating ~= nil then career.starRating else 2.5)), face = career.player.portrait, nation = career.player.nationality, isYou = true }, { "id", "name", "short", "position", "overall", "face", "nation", "isYou" })
		local ownPool = A.filter(fromSquad((if career.squad ~= nil then career.squad else Js.alit())), function(p)
			return (p.short ~= you.short)
		end)
		local ownFullRoster = fromLeagueSquad(A.find((if career.leagueSquads ~= nil then career.leagueSquads else Js.alit()), function(s)
			return (s.club == mine)
		end))
		ownPool = withFullRosterFallback(ownPool, ownFullRoster)
		local ours = build(mine, (if starting then Js.aspread(ownPool, Js.alit(you)) else ownPool), true, savedBench, savedXI)
		if starting then
			ours = forceIntoXI(ours, you)
		elseif onBench then
			ours = forceOntoBench(ours, you)
		end
		local devPinned = A.map(A.filter((if career.squad ~= nil then career.squad else Js.alit()), function(p)
			return p.devStart
		end), function(p)
			return p.id
		end)
		if (Js.alen(devPinned) > 0) then
			local ids = Js.Set.new(devPinned)
			local pins = A.map(A.filter(ownPool, function(c)
				return ids:has(c.id)
			end), function(c)
				return Js.O({ id = c.id, name = c.name, short = c.short, role = c.position, slot = c.position, overall = c.overall, face = c.face, nation = c.nation, defending = c.defending, x = 0, y = 0 }, { "id", "name", "short", "role", "slot", "overall", "face", "nation", "defending", "x", "y" })
			end)
			ours = pinDevStarters(ours, pins)
		end
		local oppSquad = (A.find((if career.leagueSquads ~= nil then career.leagueSquads else Js.alit()), function(s)
			return (s.club == theirs)
		end) or A.find((if career.externalSquads ~= nil then career.externalSquads else Js.alit()), function(s)
			return (s.club == theirs)
		end))
		local oppSaved = resolveLineupFor(career, theirs)
		local oppSavedXI = (if (oppSaved and A.some(oppSaved.xi, Js.Boolean)) then Js.O({ formation = M_formations.formationOf(oppSaved.formation), xi = oppSaved.xi }, { "formation", "xi" }) else nil)
		local effectiveOppSaved = oppSaved
		local effectiveOppSavedXI = oppSavedXI
		if (oppSaved and oppSavedXI) then
			local rivalries = A.filter(M_incumbency.incumbencyRecordsFor(career, theirs), function(r)
				return r.previousStarterId
			end)
			if (Js.alen(rivalries) > 0) then
				local forCup = (fixture.kind == "cup")
				local xi = Js.aspread(oppSavedXI.xi)
				local bench = Js.aspread((if oppSaved.bench ~= nil then oppSaved.bench else Js.alit()))
				do
					local _arr10 = rivalries
					local _i11 = 0
					while _i11 < Js.alen(_arr10) do
						_i11 += 1
						local r = _arr10[_i11]
						local preferId = (if forCup then r.previousStarterId else r.starterId)
						local otherId = (if forCup then r.starterId else r.previousStarterId)
						local xiIdx = A.findIndex(xi, function(id)
							return (id == otherId)
						end)
						local benchIdx = A.findIndex(bench, function(id)
							return (id == preferId)
						end)
						if ((xiIdx >= 0) and (benchIdx >= 0)) then
							A.set(xi, xiIdx, preferId)
							A.set(bench, benchIdx, otherId)
						end
					end
				end
				effectiveOppSaved = Js.ospread(oppSaved, Js.O({ bench = bench }, { "bench" }))
				effectiveOppSavedXI = Js.ospread(oppSavedXI, Js.O({ xi = xi }, { "xi" }))
			end
		end
		local rotation = Js.O({ rng = M_season.mulberry32(rotationSeedFor(theirs, fixture, career.season)), chance = rotationChanceFor(fixture) }, { "rng", "chance" })
		local oppPool = fromLeagueSquad(oppSquad)
		if (Js.alen(oppPool) < Js.alen(M_clubFormation.formationForClub(theirs).slots)) then
			oppPool = withFullRosterFallback(oppPool, fromLeagueSquad(Js.O({ club = theirs, players = (if career.freeAgents ~= nil then career.freeAgents else Js.alit()) }, { "club", "players" })))
		end
		local them = build(theirs, oppPool, false, (function() local _v = effectiveOppSaved; if _v == nil then return nil end; _v = _v.bench; return _v end)(), effectiveOppSavedXI, rotation)
		do return (if fixture.home then Js.O({ home = ours, away = them, fixture = fixture }, { "home", "away", "fixture" }) else Js.O({ home = them, away = ours, fixture = fixture }, { "home", "away", "fixture" })) end
	end
	exports.matchdayFor = matchdayFor
	sheetReady = function(m)
		do return ((Js.alen(m.home.xi) >= 9) and (Js.alen(m.away.xi) >= 9)) end
	end
	exports.sheetReady = sheetReady
	alternatePositions = function(realPosition)
		if (not A.includes(OFFERABLE_ROLES, realPosition)) then
			do return Js.alit() end
		end
		do return A.filter(OFFERABLE_ROLES, function(r)
			return (r ~= realPosition)
		end) end
	end
	exports.alternatePositions = alternatePositions
	seatSlotFor = function(role, formation)
		do
			local _arr12 = (if SEAT_CHAIN[role] ~= nil then SEAT_CHAIN[role] else Js.alit(role))
			local _i13 = 0
			while _i13 < Js.alen(_arr12) do
				_i13 += 1
				local r = _arr12[_i13]
				local slot = A.find(formation.slots, function(s)
					return (s.role == r)
				end)
				if slot then
					do return slot end
				end
			end
		end
		do return nil end
	end
	exports.seatSlotFor = seatSlotFor
	offeredPositions = function(realPosition, formation)
		do return A.flatMap(alternatePositions(realPosition), function(role)
			return (if seatSlotFor(role, formation) then Js.alit(Js.O({ role = role, label = POSITION_NAMES[role] }, { "role", "label" })) else Js.alit())
		end) end
	end
	exports.offeredPositions = offeredPositions
	startingTeammateRoles = function(career, fixture)
		if ((fixture.kind == "international") and (not A.some((if career.externalSquads ~= nil then career.externalSquads else Js.alit()), function(s)
			return (s.club == fixture.opponent)
		end))) then
			do return nil end
		end
		local _ok14, _err15, _rv16 = pcall(function()
			local saved = resolveLineupFor(career, career.player.club)
			local savedXI = (if (saved and A.some(saved.xi, Js.Boolean)) then Js.O({ formation = M_formations.formationOf(saved.formation), xi = saved.xi }, { "formation", "xi" }) else nil)
			local md = matchdayFor(career, fixture, true, nil, (function() local _v = saved; if _v == nil then return nil end; _v = _v.bench; return _v end)(), savedXI)
			local mine = (if md.home.yours then md.home else md.away)
			if ((not sheetReady(md)) and (Js.alen(mine.xi) < 9)) then
				do return Js.RET, nil end
			end
			local roles = Js.Map.new()
			do
				local _arr17 = mine.xi
				local _i18 = 0
				while _i18 < Js.alen(_arr17) do
					_i18 += 1
					local p = _arr17[_i18]
					if p.isYou then
						do continue end
					end
					roles:set(p.id, p.role)
				end
			end
			do return Js.RET, roles end
		end)
		if not _ok14 then
			do return nil end
		elseif _err15 == Js.RET then
			return _rv16
		end
	end
	exports.startingTeammateRoles = startingTeammateRoles
	opponentStartingXI = function(career, fixture)
		if ((fixture.kind == "international") and (not A.some((if career.externalSquads ~= nil then career.externalSquads else Js.alit()), function(s)
			return (s.club == fixture.opponent)
		end))) then
			do return nil end
		end
		local _ok19, _err20, _rv21 = pcall(function()
			local saved = resolveLineupFor(career, career.player.club)
			local savedXI = (if (saved and A.some(saved.xi, Js.Boolean)) then Js.O({ formation = M_formations.formationOf(saved.formation), xi = saved.xi }, { "formation", "xi" }) else nil)
			local md = matchdayFor(career, fixture, true, nil, (function() local _v = saved; if _v == nil then return nil end; _v = _v.bench; return _v end)(), savedXI)
			local theirs = (if md.home.yours then md.away else md.home)
			do return Js.RET, (if (Js.alen(theirs.xi) >= 9) then theirs.xi else nil) end
		end)
		if not _ok19 then
			do return nil end
		elseif _err20 == Js.RET then
			return _rv21
		end
	end
	exports.opponentStartingXI = opponentStartingXI
	onPitchToday = function(squad, roles)
		if (not roles) then
			do return squad end
		end
		local byBareId = Js.Map.new()
		do
			local _arr22 = Js.Array.from(roles:entries())
			local _i23 = 0
			while _i23 < Js.alen(_arr22) do
				_i23 += 1
				local _e24 = _arr22[_i23]
				local id = _e24[1]
				local role = _e24[2]
				byBareId:set(bareSofifaId(id), role)
			end
		end
		do return A.map(A.filter(squad, function(p)
			return byBareId:has(bareSofifaId(p.id))
		end), function(p)
			local role = byBareId:get(bareSofifaId(p.id))
			do return (if (role == p.position) then p else Js.ospread(p, Js.O({ position = role }, { "position" }))) end
		end) end
	end
	exports.onPitchToday = onPitchToday
	fillMissingFromFullRoster = function(squad, roles, career)
		if ((not roles) or (not career)) then
			do return squad end
		end
		local known = Js.Set.new(A.map(squad, function(p)
			return bareSofifaId(p.id)
		end))
		local missingIds = A.filter(Js.Array.from(roles:keys()), function(id)
			return (not known:has(bareSofifaId(id)))
		end)
		if (Js.alen(missingIds) == 0) then
			do return squad end
		end
		local ownRoster = ((function() local _v = A.find((if career.leagueSquads ~= nil then career.leagueSquads else Js.alit()), function(s)
			return (s.club == career.player.club)
		end); if _v == nil then return nil end; _v = _v.players; return _v end)() or Js.alit())
		local additions = Js.alit()
		do
			local _arr25 = missingIds
			local _i26 = 0
			while _i26 < Js.alen(_arr25) do
				_i26 += 1
				local id = _arr25[_i26]
				local lp = A.find(ownRoster, function(p)
					return (bareSofifaId(p.id) == bareSofifaId(id))
				end)
				if (not lp) then
					do continue end
				end
				A.push(additions, Js.O({ id = ("sf_" .. bareSofifaId(lp.id)), name = lp.name, shortName = M_realSquad.shortNameOf(lp.name), position = lp.position, positions = lp.positions, seasonGoals = lp.goals, seasonAssists = lp.assists, careerGoals = 0, careerAssists = 0, leagueGoals = lp.goals, leagueAssists = lp.assists, sofifaId = lp.id, overall = lp.overall, imageUrl = lp.image, nationality = lp.nation, age = lp.age }, { "id", "name", "shortName", "position", "positions", "seasonGoals", "seasonAssists", "careerGoals", "careerAssists", "leagueGoals", "leagueAssists", "sofifaId", "overall", "imageUrl", "nationality", "age" }))
			end
		end
		do return (if (Js.alen(additions) > 0) then Js.aspread(squad, additions) else squad) end
	end
	exports.fillMissingFromFullRoster = fillMissingFromFullRoster
	Js.reexport(exports, M_clubFormation, { ["formationForClub"] = "formationForClub" })
	OFFERABLE_ROLES = Js.alit("ST", "CAM", "LW", "RW")
	SEAT_CHAIN = Js.O({ ST = Js.alit("ST", "CAM", "CM"), CAM = Js.alit("CAM", "CM", "ST", "CDM"), LW = Js.alit("LW", "CAM", "ST", "CM"), RW = Js.alit("RW", "CAM", "ST", "CM") }, { "ST", "CAM", "LW", "RW" })
	POSITION_NAMES = Js.O({ GK = "Goalkeeper", CB = "Centre Back", LB = "Left Back", RB = "Right Back", CDM = "Defensive Mid", CM = "Central Mid", CAM = "Attacking Mid", LW = "Left Wing", RW = "Right Wing", ST = "Striker" }, { "GK", "CB", "LB", "RB", "CDM", "CM", "CAM", "LW", "RW", "ST" })
	exports.POSITION_NAMES = POSITION_NAMES
end
