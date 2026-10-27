--!nocheck
--!nolint
-- Generated from lib/star/facilities.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_clubs = import("lib/star/clubs")
	local M_footballClubDatabase = import("lib/star/data/footballClubDatabase")
	local M_clubProfiles = import("lib/star/data/clubProfiles")
	local M_investments = import("lib/star/investments")
	local hash, baseCapacityFor, tierFromRating, defaultFacilities, facilitiesFor, withFacilities, RENAME_STADIUM_COST, CAPACITY_UPGRADE_STEP, perSeatCost, buildSeasonsFor, TRAINING_UPGRADE_COST, YOUTH_UPGRADE_COST, spendFromClubBudget, renameStadium, upgradeStadiumCapacity, progressStadiumBuilds, upgradeTrainingGround, upgradeYouthAcademy, REVENUE_PER_SEAT, creditStadiumRevenue
	hash = function(seed, salt)
		local h = Js.bxor(2166136261, salt)
		for i = 0, (S.len(seed)) - 1 do
			h = Js.bxor(h, S.charCodeAt(seed, i))
			h = Math.imul(h, 16777619)
		end
		do return (Js.ushr(h, 0) / 4294967295) end
	end
	baseCapacityFor = function(club)
		if A.includes(M_clubs.PREMIER_LEAGUE_CLUBS, club) then
			do return 42000 end
		end
		if A.includes(M_clubs.CHAMPIONSHIP_CLUBS, club) then
			do return 24000 end
		end
		do return 16000 end
	end
	tierFromRating = function(rating)
		if (rating >= 9) then
			do return 3 end
		end
		if (rating >= 7) then
			do return 2 end
		end
		do return 1 end
	end
	defaultFacilities = function(club)
		local real = M_footballClubDatabase.CLUB_DATABASE[club]
		if real then
			do return Js.O({ stadiumName = real.stadium, stadiumCapacity = real.capacity, trainingGroundTier = tierFromRating(real.trainingRating), youthAcademyTier = tierFromRating(real.youthRating) }, { "stadiumName", "stadiumCapacity", "trainingGroundTier", "youthAcademyTier" }) end
		end
		local given = M_clubProfiles.profileOf(club)
		local capacityNoise = hash(club, 1)
		local trainingNoise = hash(club, 2)
		local youthNoise = hash(club, 3)
		do return Js.O({ stadiumName = ((function() local _v = given; if _v == nil then return nil end; _v = _v.stadium; return _v end)() or (club .. " Stadium")), stadiumCapacity = ((function() local _v = given; if _v == nil then return nil end; _v = _v.capacity; return _v end)() or Math.round((baseCapacityFor(club) * (0.75 + (capacityNoise * 0.6))))), trainingGroundTier = (if ((function() local _v = given; if _v == nil then return nil end; _v = _v.training; return _v end)() ~= nil) then tierFromRating(given.training) else (1 + math.floor((trainingNoise * 3)))), youthAcademyTier = (if ((function() local _v = given; if _v == nil then return nil end; _v = _v.youth; return _v end)() ~= nil) then tierFromRating(given.youth) else (1 + math.floor((youthNoise * 3)))) }, { "stadiumName", "stadiumCapacity", "trainingGroundTier", "youthAcademyTier" }) end
	end
	facilitiesFor = function(career, club)
		do return ((function() local _v = career.facilities; if _v == nil then return nil end; _v = _v[club]; return _v end)() or defaultFacilities(club)) end
	end
	exports.facilitiesFor = facilitiesFor
	withFacilities = function(career, club, patch)
		local current = facilitiesFor(career, club)
		do return Js.ospread(career, Js.O({ facilities = Js.ospread((if career.facilities ~= nil then career.facilities else Js.O({}, nil)), (function() local _o = Js.O({}, nil); _o[Js.key(club)] = Js.ospread(current, patch); return _o end)()) }, { "facilities" })) end
	end
	perSeatCost = function(existingCapacity)
		do return (3000 * Math.pow((1 + (existingCapacity / 20000)), 1.6)) end
	end
	buildSeasonsFor = function(seatsAdded)
		do return Math.max(1, Math.round((seatsAdded / 5000))) end
	end
	spendFromClubBudget = function(career, club, cost)
		if (not M_investments.isMajorityOwner(career, club)) then
			do return Js.O({ ok = false, reason = "Not the majority shareholder" }, { "ok", "reason" }) end
		end
		local state = M_investments.ownedClubState(career, club)
		if (state.budget < cost) then
			do return Js.O({ ok = false, reason = "Not enough in the club's own budget" }, { "ok", "reason" }) end
		end
		do return Js.ospread(career, Js.O({ ownedClubs = Js.ospread((if career.ownedClubs ~= nil then career.ownedClubs else Js.O({}, nil)), (function() local _o = Js.O({}, nil); _o[Js.key(club)] = Js.ospread(state, Js.O({ budget = (state.budget - cost) }, { "budget" })); return _o end)()) }, { "ownedClubs" })) end
	end
	renameStadium = function(career, club, name)
		local spent = spendFromClubBudget(career, club, RENAME_STADIUM_COST)
		if Js.has(spent, "ok") then
			do return Js.O({ career = career, ok = false, reason = spent.reason }, { "career", "ok", "reason" }) end
		end
		do return Js.O({ career = withFacilities(spent, club, Js.O({ stadiumName = name }, { "stadiumName" })), ok = true }, { "career", "ok" }) end
	end
	exports.renameStadium = renameStadium
	upgradeStadiumCapacity = function(career, club)
		local current = facilitiesFor(career, club)
		if current.stadiumBuild then
			do return Js.O({ career = career, ok = false, reason = "Already expanding — one project at a time" }, { "career", "ok", "reason" }) end
		end
		local cost = Math.round((CAPACITY_UPGRADE_STEP * perSeatCost(current.stadiumCapacity)))
		local spent = spendFromClubBudget(career, club, cost)
		if Js.has(spent, "ok") then
			do return Js.O({ career = career, ok = false, reason = spent.reason }, { "career", "ok", "reason" }) end
		end
		local seasons = buildSeasonsFor(CAPACITY_UPGRADE_STEP)
		do return Js.O({ career = withFacilities(spent, club, Js.O({ stadiumBuild = Js.O({ targetCapacity = (current.stadiumCapacity + CAPACITY_UPGRADE_STEP), seasonsRemaining = seasons }, { "targetCapacity", "seasonsRemaining" }) }, { "stadiumBuild" })), ok = true }, { "career", "ok" }) end
	end
	exports.upgradeStadiumCapacity = upgradeStadiumCapacity
	progressStadiumBuilds = function(career)
		local clubs = Js.Object.keys((if career.facilities ~= nil then career.facilities else Js.O({}, nil)))
		if (Js.alen(clubs) == 0) then
			do return career end
		end
		local changed = false
		local next_ = Js.ospread((if career.facilities ~= nil then career.facilities else Js.O({}, nil)))
		do
			local _arr1 = clubs
			local _i2 = 0
			while _i2 < Js.alen(_arr1) do
				_i2 += 1
				local club = _arr1[_i2]
				local f = next_[club]
				if (not (function() local _v = f; if _v == nil then return nil end; _v = _v.stadiumBuild; return _v end)()) then
					do continue end
				end
				local seasonsRemaining = (f.stadiumBuild.seasonsRemaining - 1)
				changed = true
				next_[club] = (if (seasonsRemaining <= 0) then Js.ospread(f, Js.O({ stadiumCapacity = f.stadiumBuild.targetCapacity, stadiumBuild = nil }, { "stadiumCapacity", "stadiumBuild" })) else Js.ospread(f, Js.O({ stadiumBuild = Js.ospread(f.stadiumBuild, Js.O({ seasonsRemaining = seasonsRemaining }, { "seasonsRemaining" })) }, { "stadiumBuild" })))
			end
		end
		do return (if changed then Js.ospread(career, Js.O({ facilities = next_ }, { "facilities" })) else career) end
	end
	exports.progressStadiumBuilds = progressStadiumBuilds
	upgradeTrainingGround = function(career, club)
		local current = facilitiesFor(career, club)
		if (current.trainingGroundTier >= 3) then
			do return Js.O({ career = career, ok = false, reason = "Already at the top tier" }, { "career", "ok", "reason" }) end
		end
		local cost = TRAINING_UPGRADE_COST[Js.key(current.trainingGroundTier)]
		local spent = spendFromClubBudget(career, club, cost)
		if Js.has(spent, "ok") then
			do return Js.O({ career = career, ok = false, reason = spent.reason }, { "career", "ok", "reason" }) end
		end
		do return Js.O({ career = withFacilities(spent, club, Js.O({ trainingGroundTier = (current.trainingGroundTier + 1) }, { "trainingGroundTier" })), ok = true }, { "career", "ok" }) end
	end
	exports.upgradeTrainingGround = upgradeTrainingGround
	upgradeYouthAcademy = function(career, club)
		local current = facilitiesFor(career, club)
		if (current.youthAcademyTier >= 3) then
			do return Js.O({ career = career, ok = false, reason = "Already at the top tier" }, { "career", "ok", "reason" }) end
		end
		local cost = YOUTH_UPGRADE_COST[Js.key(current.youthAcademyTier)]
		local spent = spendFromClubBudget(career, club, cost)
		if Js.has(spent, "ok") then
			do return Js.O({ career = career, ok = false, reason = spent.reason }, { "career", "ok", "reason" }) end
		end
		do return Js.O({ career = withFacilities(spent, club, Js.O({ youthAcademyTier = (current.youthAcademyTier + 1) }, { "youthAcademyTier" })), ok = true }, { "career", "ok" }) end
	end
	exports.upgradeYouthAcademy = upgradeYouthAcademy
	creditStadiumRevenue = function(career)
		local clubs = A.filter(A.map((if career.investments ~= nil then career.investments else Js.alit()), function(i)
			return i.club
		end), function(club)
			return M_investments.isMajorityOwner(career, club)
		end)
		if (Js.alen(clubs) == 0) then
			do return career end
		end
		local changed = false
		local nextOwned = Js.ospread((if career.ownedClubs ~= nil then career.ownedClubs else Js.O({}, nil)))
		do
			local _arr3 = clubs
			local _i4 = 0
			while _i4 < Js.alen(_arr3) do
				_i4 += 1
				local club = _arr3[_i4]
				local revenue = Math.round((facilitiesFor(career, club).stadiumCapacity * REVENUE_PER_SEAT))
				if (revenue <= 0) then
					do continue end
				end
				local current = M_investments.ownedClubState(career, club)
				nextOwned[club] = Js.ospread(current, Js.O({ budget = (current.budget + revenue) }, { "budget" }))
				changed = true
			end
		end
		do return (if changed then Js.ospread(career, Js.O({ ownedClubs = nextOwned }, { "ownedClubs" })) else career) end
	end
	exports.creditStadiumRevenue = creditStadiumRevenue
	RENAME_STADIUM_COST = 500000
	CAPACITY_UPGRADE_STEP = 5000
	TRAINING_UPGRADE_COST = Js.O({ ["1"] = 8000000, ["2"] = 60000000 }, { "1", "2" })
	YOUTH_UPGRADE_COST = Js.O({ ["1"] = 8000000, ["2"] = 60000000 }, { "1", "2" })
	REVENUE_PER_SEAT = 800
end
