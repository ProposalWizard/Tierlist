--!nocheck
--!nolint
-- Generated from lib/star/squadSaveCodec.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local fetched, rememberFetchedSquads, forgetFetchedSquads, CORE, same, STATS, shiftOf, statShift, encodePlayer, decodePlayer, encodeSquads, decodeSquads, hydrateSquads, toSavedForm, fromSavedForm
	rememberFetchedSquads = function(squads)
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
						fetched:set(p.id, p)
					end
				end
			end
		end
	end
	exports.rememberFetchedSquads = rememberFetchedSquads
	forgetFetchedSquads = function()
		fetched:clear()
	end
	exports.forgetFetchedSquads = forgetFetchedSquads
	same = function(a, b)
		if (a == b) then
			do return true end
		end
		do return (Js.JSON.stringify(a) == Js.JSON.stringify(b)) end
	end
	shiftOf = function(k, sd)
		do return (sd[1] + (if (k == "pace") then sd[2] else (if (k == "physical") then sd[3] else 0))) end
	end
	statShift = function(p, base)
		local ref = A.find(Js.alit("shooting", "passing", "dribbling", "defending"), function(k)
			return ((type(p[k]) == "number") and (type(base[k]) == "number"))
		end)
		if (not Js.T(ref)) then
			do return nil end
		end
		local all = (p[ref] - base[ref])
		local pe = (if ((type(p.pace) == "number") and (type(base.pace) == "number")) then ((p.pace - base.pace) - all) else 0)
		local pf = (if ((type(p.physical) == "number") and (type(base.physical) == "number")) then ((p.physical - base.physical) - all) else 0)
		do return (if ((Js.T(all) or Js.T(pe)) or Js.T(pf)) then Js.alit(all, pe, pf) else nil) end
	end
	encodePlayer = function(p)
		local base = fetched:get(p.id)
		local rest = Js.O({}, nil)
		local any = false
		local held = p.sd
		local sd = ((if base then statShift(p, base) else nil) or (if Js.Array.isArray(held) then held else nil))
		if sd then
			rest.sd = sd
			any = true
		end
		do
			local _arr5 = Js.Object.keys(p)
			local _i6 = 0
			while _i6 < Js.alen(_arr5) do
				_i6 += 1
				local k = _arr5[_i6]
				if CORE:has(k) then
					do continue end
				end
				if (k == "sd") then
					do continue end
				end
				if ((((sd and base) and A.includes(STATS, k)) and (type(base[k]) == "number")) and (p[k] == (base[k] + shiftOf(k, sd)))) then
					do continue end
				end
				local v = p[k]
				if (v == nil) then
					do continue end
				end
				if ((base and Js.has(base, k)) and same(v, base[k])) then
					do continue end
				end
				rest[k] = v
				any = true
			end
		end
		local core = Js.alit(p.id, p.name, p.position, p.overall, p.goals, p.assists)
		do return (if any then Js.aspread(core, Js.alit(rest)) else core) end
	end
	exports.encodePlayer = encodePlayer
	decodePlayer = function(t)
		if ((not Js.Array.isArray(t)) or (type(t[1]) ~= "string")) then
			do return nil end
		end
		local _d7 = t
		local id = _d7[1]
		local name = _d7[2]
		local position = _d7[3]
		local overall = _d7[4]
		local goals = _d7[5]
		local assists = _d7[6]
		local rest = _d7[7]
		local extra = (if (rest and (type(rest) == "table")) then rest else Js.O({}, nil))
		do return Js.ospread(extra, Js.O({ id = id, name = (if (type(name) == "string") then name else id), position = position, overall = (if (type(overall) == "number") then overall else 60), goals = (if (type(goals) == "number") then goals else 0), assists = (if (type(assists) == "number") then assists else 0) }, { "id", "name", "position", "overall", "goals", "assists" })) end
	end
	exports.decodePlayer = decodePlayer
	encodeSquads = function(squads)
		do return A.map(squads, function(s)
			return Js.alit(s.club, A.map(s.players, encodePlayer))
		end) end
	end
	exports.encodeSquads = encodeSquads
	decodeSquads = function(saved)
		if (not Js.Array.isArray(saved)) then
			do return Js.alit() end
		end
		local out = Js.alit()
		do
			local _arr8 = saved
			local _i9 = 0
			while _i9 < Js.alen(_arr8) do
				_i9 += 1
				local entry = _arr8[_i9]
				if (((not Js.Array.isArray(entry)) or (type(entry[1]) ~= "string")) or (not Js.Array.isArray(entry[2]))) then
					do continue end
				end
				local players = Js.alit()
				do
					local _arr10 = entry[2]
					local _i11 = 0
					while _i11 < Js.alen(_arr10) do
						_i11 += 1
						local t = _arr10[_i11]
						local p = decodePlayer(t)
						if p then
							A.push(players, p)
						end
					end
				end
				A.push(out, Js.O({ club = entry[1], players = players }, { "club", "players" }))
			end
		end
		do return out end
	end
	exports.decodeSquads = decodeSquads
	hydrateSquads = function(squads)
		if (not Js.T(fetched.size)) then
			do return squads end
		end
		local changed = false
		local out = A.map(squads, function(s)
			local clubChanged = false
			local players = A.map(s.players, function(p)
				local base = fetched:get(p.id)
				if (not base) then
					do return p end
				end
				local next_ = nil
				local sd = p.sd
				do
					local _arr12 = Js.Object.keys(base)
					local _i13 = 0
					while _i13 < Js.alen(_arr12) do
						_i13 += 1
						local k = _arr12[_i13]
						if CORE:has(k) then
							do continue end
						end
						if (p[k] ~= nil) then
							do continue end
						end
						local v = base[k]
						if (v == nil) then
							do continue end
						end
						if ((Js.Array.isArray(sd) and (type(v) == "number")) and A.includes(STATS, k)) then
							v = (v + shiftOf(k, sd))
						end
						if (not next_) then
							next_ = Js.ospread(p)
						end
						next_[k] = v
					end
				end
				if Js.Array.isArray(sd) then
					if (not next_) then
						next_ = Js.ospread(p)
					end
					Js.del(next_, "sd")
				end
				if (not next_) then
					do return p end
				end
				clubChanged = true
				do return next_ end
			end)
			if (not clubChanged) then
				do return s end
			end
			changed = true
			do return Js.ospread(s, Js.O({ players = players }, { "players" })) end
		end)
		do return (if changed then out else squads) end
	end
	exports.hydrateSquads = hydrateSquads
	toSavedForm = function(career)
		local _d14 = career
		local leagueSquads = _d14.leagueSquads
		local externalSquads = _d14.externalSquads
		local rest = Js.ospread(_d14)
		Js.del(rest, "leagueSquads")
		Js.del(rest, "externalSquads")
		if ((not leagueSquads) and (not externalSquads)) then
			do return career end
		end
		local savedSquads = Js.O({ v = 1 }, { "v" })
		if leagueSquads then
			savedSquads.league = encodeSquads(leagueSquads)
		end
		if externalSquads then
			savedSquads.external = encodeSquads(externalSquads)
		end
		do return Js.ospread(rest, Js.O({ savedSquads = savedSquads }, { "savedSquads" })) end
	end
	exports.toSavedForm = toSavedForm
	fromSavedForm = function(raw)
		local saved = raw.savedSquads
		if ((not saved) or (type(saved) ~= "table")) then
			do return raw end
		end
		local _d15 = raw
		local _drop = _d15.savedSquads
		local rest = Js.ospread(_d15)
		Js.del(rest, "savedSquads")
		local _ = _drop
		local out = Js.ospread(rest)
		if (saved.league ~= nil) then
			out.leagueSquads = decodeSquads(saved.league)
		end
		if (saved.external ~= nil) then
			out.externalSquads = decodeSquads(saved.external)
		end
		do return out end
	end
	exports.fromSavedForm = fromSavedForm
	fetched = Js.Map.new()
	CORE = Js.Set.new(Js.alit("id", "name", "position", "overall", "goals", "assists"))
	STATS = Js.alit("pace", "shooting", "passing", "dribbling", "defending", "physical")
end
