--!nocheck
--!nolint
-- Generated from lib/star/intl/world.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_nations = import("lib/star/intl/nations")
	local M_engine = import("lib/star/intl/engine")
	local WORLD_START, DAY, REVERT, seasonOfDate, World, noon, dayAfter, isNation
	seasonOfDate = function(t, firstYear)
		local d = Js.Date.new(t)
		local y = (d:getUTCFullYear() - (if (d:getUTCMonth() < 7) then 1 else 0))
		do return ((y - firstYear) + 1) end
	end
	exports.seasonOfDate = seasonOfDate
	isNation = function(name)
		do return (not (not M_nations.nationFor(name))) end
	end
	exports.isNation = isNation
	WORLD_START = Js.Date.UTC(2026, 7, 1)
	exports.WORLD_START = WORLD_START
	DAY = 86400000
	REVERT = 0.15
	World = {}
	World.__jsclass = true
	World.__getters = {}
	World.__index = function(t, k) local g = World.__getters[k]; if g then return g(t) end; return World[k] end
	World.new = function(inputs)
		local self = setmetatable({}, World)
		self["points"] = Js.Map.new()
		self["matches"] = Js.alit()
		self["byId"] = Js.Map.new()
		self["byEdition"] = Js.Map.new()
		self["finals"] = Js.alit()
		self["facts"] = Js.Map.new()
		self["onDate"] = Js.Map.new()
		self["events"] = Js.alit()
		self["seq"] = 0
		self["queue"] = Js.alit()
		self["clock"] = WORLD_START
		self["rating"] = Js.Map.new()
		self["base"] = Js.Map.new()
		self["rankOf"] = function(nation)
			local pts = self.points:get(nation)
			if (pts == nil) then
				do return 999 end
			end
			local r = 1
			do
				local _arr1 = Js.Array.from(self.points:values())
				local _i2 = 0
				while _i2 < Js.alen(_arr1) do
					_i2 += 1
					local v = _arr1[_i2]
					if (v > pts) then
						r += 1
					end
				end
			end
			do return r end
		end
		self.inputs = inputs
		do
			local _arr3 = M_nations.NATIONS
			local _i4 = 0
			while _i4 < Js.alen(_arr3) do
				_i4 += 1
				local n = _arr3[_i4]
				self.points:set(n.name, n.points)
				self.rating:set(n.name, n.points)
				self.base:set(n.name, n.points)
			end
		end
		for y = 2027, 2060 do
			self:at(Js.Date.UTC(y, 6, 25), function()
				do
					local _arr5 = Js.Array.from(self.rating:entries())
					local _i6 = 0
					while _i6 < Js.alen(_arr5) do
						_i6 += 1
						local _e7 = _arr5[_i6]
						local n = _e7[1]
						local r = _e7[2]
						self.rating:set(n, (r + (REVERT * ((self.base:get(n) or r) - r))))
					end
				end
			end)
		end
		return self
	end
	World.__getters["now"] = function(self)
		do return self.clock end
	end
	World["at"] = function(self, at, fn)
		A.push(self.events, Js.O({ at = at, seq = (function() local _o = self.seq; self.seq = _o + 1; return _o end)(), run = fn }, { "at", "seq", "run" }))
	end
	World["add"] = function(self, m)
		if self.byId:has(m.id) then
			do return self.byId:get(m.id) end
		end
		A.push(self.matches, m)
		local day = (self.onDate:get(m.date) or Js.Set.new())
		day:add(m.home)
		day:add(m.away)
		self.onDate:set(m.date, day)
		local lo = 0
		local hi = Js.alen(self.queue)
		while (lo < hi) do
			local mid = Js.shr((lo + hi), 1)
			if (self.queue[mid + 1].date <= m.date) then
				lo = (mid + 1)
			else
				hi = mid
			end
		end
		A.splice(self.queue, lo, 0, m)
		self.byId:set(m.id, m)
		local list = (self.byEdition:get(m.edition) or Js.alit())
		A.push(list, m)
		self.byEdition:set(m.edition, list)
		do return m end
	end
	World["busyOn"] = function(self, date)
		do return (self.onDate:get(date) or Js.Set.new()) end
	end
	World["edition"] = function(self, id)
		do return (self.byEdition:get(id) or Js.alit()) end
	end
	World["strength"] = function(self, nation, t)
		if t == nil then t = self.clock end
		local pts = (self.rating:get(nation) or 1192)
		local season = seasonOfDate(t, self.inputs.firstYear)
		local xi = ((function() local _v = self.inputs.xi[Js.key(season)]; if _v == nil then return nil end; _v = _v[nation]; return _v end)() or self:latestXi(nation, season))
		do return Math.max(35, Math.min(95, (M_nations.rankingStrength(pts) + xi))) end
	end
	World["latestXi"] = function(self, nation, season)
		do
			local s = (season - 1)
			local _first8 = true
			while true do
				if not _first8 then
					s -= 1
				end
				_first8 = false
				if not (s >= 1) then break end
				local v = (function() local _v = self.inputs.xi[Js.key(s)]; if _v == nil then return nil end; _v = _v[nation]; return _v end)()
				if (v ~= nil) then
					do return v end
				end
			end
		end
		do return 0 end
	end
	World["ranking"] = function(self)
		do return A.map(A.sort(Js.Array.from(self.points:entries()), function(a, b)
			return (b[2] - a[2])
		end), function(_p9)
			local n = _p9[1]
			return n
		end) end
	end
	World["run"] = function(self, until_)
		A.sort(self.events, function(a, b)
			return (function() local _l = (a.at - b.at); if Js.T(_l) then return _l end; return (a.seq - b.seq) end)()
		end)
		local sorted = true
		for guard = 0, 4999999 do
			if (not sorted) then
				A.sort(self.events, function(a, b)
					return (function() local _l = (a.at - b.at); if Js.T(_l) then return _l end; return (a.seq - b.seq) end)()
				end)
				sorted = true
			end
			local nextEvent = self.events[1]
			local pending = self.queue[1]
			local evAt = (if nextEvent then nextEvent.at else math.huge)
			local mAt = (if pending then pending.date else math.huge)
			if ((not nextEvent) and (not pending)) then
				do break end
			end
			if (not (Math.min(evAt, mAt) <= until_)) then
				do break end
			end
			if ((pending and (function() local _f = self.hold; if _f == nil then return nil end; return _f(pending) end)()) and (evAt > mAt)) then
				do break end
			end
			if (evAt <= mAt) then
				A.shift(self.events)
				self.clock = Math.max(self.clock, evAt)
				local before = Js.alen(self.events)
				nextEvent.run()
				if (Js.alen(self.events) ~= before) then
					sorted = false
				end
			else
				A.shift(self.queue)
				self.clock = Math.max(self.clock, mAt)
				if (not M_engine.played(pending)) then
					self:play(pending)
				end
			end
		end
		self.clock = Math.max(self.clock, until_)
	end
	World["play"] = function(self, m)
		local rng = M_engine.rngFor(("m|" .. m.id))
		local t = m.date
		local hS = self:strength(m.home, t)
		local aS = self:strength(m.away, t)
		local neutral = ((not (not m.neutral)) and (not m.hostHome))
		local yours = self.inputs.played[m.id]
		local r = nil
		if yours then
			r = Js.ospread(yours)
			if (not r.pens) then
				local f = (if Js.T(m.firstLeg) then self.byId:get(m.firstLeg) else nil)
				local level = (if Js.T(m.firstLeg) then (((not (not f)) and M_engine.played(f)) and ((f.hs + r.as) == (f.as + r.hs))) else ((not (not Js.T(m.level))) and (r.hs == r.as)))
				if level then
					r.pens = M_engine.shootout(hS, aS, rng)
				end
			end
		else
			r = M_engine.ninety(hS, aS, neutral, rng)
			if Js.T(m.firstLeg) then
				local f = self.byId:get(m.firstLeg)
				if (f and M_engine.played(f)) then
					local aggA = (f.hs + r.as)
					local aggB = (f.as + r.hs)
					if (aggA == aggB) then
						local e = M_engine.extraTime(hS, aS, neutral, rng)
						r = Js.O({ hs = (r.hs + e.hs), as = (r.as + e.as), et = true }, { "hs", "as", "et" })
						if ((f.hs + r.as) == (f.as + r.hs)) then
							r.pens = M_engine.shootout(hS, aS, rng)
						end
					end
				end
			elseif (Js.T(m.level) and (r.hs == r.as)) then
				if (m.level == "et-pens") then
					local e = M_engine.extraTime(hS, aS, neutral, rng)
					r = Js.O({ hs = (r.hs + e.hs), as = (r.as + e.as), et = true }, { "hs", "as", "et" })
				end
				if (r.hs == r.as) then
					r.pens = M_engine.shootout(hS, aS, rng)
				end
			end
		end
		Js.Object.assign(m, r)
		self:rank(m, hS, aS)
	end
	World["rank"] = function(self, m, _hS, _aS)
		local ph = self.points:get(m.home)
		local pa = self.points:get(m.away)
		if ((ph == nil) or (pa == nil)) then
			do return end
		end
		local wh = nil
		local wa = nil
		if (m.hs > m.as) then
			wh = 1
			wa = 0
		elseif (m.hs < m.as) then
			wh = 0
			wa = 1
		elseif (m.pens and (not Js.T(m.firstLeg))) then
			wh = (if (m.pens.hs > m.pens.as) then 0.75 else 0.5)
			wa = (if (m.pens.hs > m.pens.as) then 0.5 else 0.75)
		else
			wh = 0.5
			wa = 0.5
		end
		local weH = (1 / (Math.pow(10, ((-(ph - pa)) / 600)) + 1))
		local dh = (m.importance * (wh - weH))
		local da = (m.importance * (wa - (1 - weH)))
		self.points:set(m.home, (ph + Math.max(dh, (if m.finalsKnockout then 0 else dh))))
		self.points:set(m.away, (pa + Math.max(da, (if m.finalsKnockout then 0 else da))))
		local rh = self.rating:get(m.home)
		local ra = self.rating:get(m.away)
		local reH = (1 / (Math.pow(10, ((-(rh - ra)) / 600)) + 1))
		self.rating:set(m.home, (rh + (m.importance * (wh - reH))))
		self.rating:set(m.away, (ra + (m.importance * (wa - (1 - reH)))))
	end
	World["final"] = function(self, edition, comp, m)
		local w = M_engine.winnerOf(m)
		local l = M_engine.loserOf(m)
		if ((not Js.T(w)) or (not Js.T(l))) then
			do return end
		end
		A.push(self.finals, Js.O({ edition = edition, comp = comp, year = Js.Date.new(m.date):getUTCFullYear(), winner = w, runnerUp = l, hs = m.hs, as = m.as, pens = m.pens, et = m.et, home = m.home }, { "edition", "comp", "year", "winner", "runnerUp", "hs", "as", "pens", "et", "home" }))
	end
	exports.World = World
	noon = function(d)
		local t = (if (type(d) == "number") then d else d:getTime())
		do return ((math.floor((t / DAY)) * DAY) + (12 * 3600000)) end
	end
	exports.noon = noon
	dayAfter = function(t, n)
		if n == nil then n = 1 end
		return ((math.floor((t / DAY)) * DAY) + (n * DAY))
	end
	exports.dayAfter = dayAfter
end
