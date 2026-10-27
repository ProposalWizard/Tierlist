--!nocheck
--!nolint
-- Generated from lib/star/trainingLevelData.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_pitch = import("lib/star/pitch")
	local M_trainingLevels = import("lib/star/trainingLevels")
	local M_trainingDrills = import("lib/star/trainingDrills")
	local M_trainingLevels_json = import("lib/star/data/trainingLevels_json")
	local TRAINING_SKILLS, TOP_FROM, VISION_KICK_FROM, VISION_TOP_FROM, VISION_TOP_WINDOW, LEVEL_FIELDS, isOldVisionRow, round2, sanitizeLevel, cleanSpot, MAX_MEN, PACE_LANE_HALF, withPositions, withoutPositions, hasPositions, topT, lerp, defaultLevel, visionDefault, aerialDefault, defaultTable, tableFromFile, FILE_NOTE, fileText, mergeTrainingFile, levelId, parseLevelId, FILE_TABLE, overlay, setTrainingOverlay, trainingOverlay, committedLevel, levelConfig, levelSeedOf, POWER_EASE_SHARE, easePowerLevel, carryMen
	isOldVisionRow = function(raw)
		if (((not Js.T(raw)) or (type(raw) ~= "table")) or Js.Array.isArray(raw)) then
			do return false end
		end
		local o = raw
		do return ((not Js.has(o, "kick")) and (((Js.has(o, "tapRadius") or Js.has(o, "lineGap")) or Js.has(o, "offsideShare")) or Js.has(o, "markers"))) end
	end
	exports.isOldVisionRow = isOldVisionRow
	sanitizeLevel = function(skill, level, raw)
		local base = defaultLevel(skill, level)
		if ((skill == "vision") and isOldVisionRow(raw)) then
			do return base end
		end
		local src = (if ((Js.T(raw) and (type(raw) == "table")) and (not Js.Array.isArray(raw))) then raw else Js.O({}, nil))
		local out = Js.O({}, nil)
		do
			local _arr1 = LEVEL_FIELDS[skill]
			local _i2 = 0
			while _i2 < Js.alen(_arr1) do
				_i2 += 1
				local f = _arr1[_i2]
				local v = src[f.key]
				if f.toggle then
					out[f.key] = (if (type(v) == "boolean") then v else Js.T(base[f.key]))
					do continue end
				end
				local n = (if ((type(v) == "number") and Js.NumberNS.isFinite(v)) then v else Js.Number(base[f.key]))
				n = Math.max(f.min, Math.min(f.max, n))
				out[f.key] = (if f.int then Math.round(n) else round2(n))
			end
		end
		if ((type(src.seed) == "number") and Js.NumberNS.isFinite(src.seed)) then
			out.seed = Js.ushr(math.abs(Math.round(src.seed)), 0)
		end
		do return withPositions(skill, out, src) end
	end
	exports.sanitizeLevel = sanitizeLevel
	cleanSpot = function(v)
		if ((not Js.T(v)) or (type(v) ~= "table")) then
			do return nil end
		end
		local _d3 = v
		local x = _d3.x
		local y = _d3.y
		if ((((type(x) ~= "number") or (type(y) ~= "number")) or (not Js.NumberNS.isFinite(x))) or (not Js.NumberNS.isFinite(y))) then
			do return nil end
		end
		do return Js.O({ x = round2(Math.max(0.5, Math.min((M_pitch.PITCH_W - 0.5), x))), y = round2(Math.max(0.5, Math.min(52, y))) }, { "x", "y" }) end
	end
	withPositions = function(skill, out, src)
		if ((skill == "power") or (skill == "freeKick")) then
			if Js.Array.isArray(src.men) then
				local men = A.slice(A.filter(A.map(src.men, cleanSpot), function(m)
					return (not (not m))
				end), 0, MAX_MEN)
				if Js.T(Js.alen(men)) then
					out.men = men
				end
			end
		elseif (skill == "technique") then
			local ball = cleanSpot(src.ball)
			if ball then
				out.ball = ball
			end
		elseif (skill == "pace") then
			if Js.Array.isArray(src.lanes) then
				local lanes = A.map(A.slice(src.lanes, 0, 12), function(w)
					return A.map(A.slice(A.filter((if Js.Array.isArray(w) then w else Js.alit()), function(x)
						return ((type(x) == "number") and Js.NumberNS.isFinite(x))
					end), 0, 4), function(x)
						return round2(Math.max((-PACE_LANE_HALF), Math.min(PACE_LANE_HALF, x)))
					end)
				end)
				if A.some(lanes, function(w)
					return Js.alen(w)
				end) then
					out.lanes = lanes
				end
			end
		end
		do return out end
	end
	withoutPositions = function(row)
		local r = Js.ospread(row)
		Js.del(r, "men")
		Js.del(r, "ball")
		Js.del(r, "lanes")
		do return r end
	end
	exports.withoutPositions = withoutPositions
	hasPositions = function(row)
		local r = row
		do return (((r.men ~= nil) or (r.ball ~= nil)) or (r.lanes ~= nil)) end
	end
	exports.hasPositions = hasPositions
	topT = function(level)
		do return Math.max(0, Math.min(1, ((level - TOP_FROM) / (M_trainingLevels.TRAINING_LEVELS - TOP_FROM)))) end
	end
	defaultLevel = function(skill, level)
		local n = Math.max(1, Math.min(M_trainingLevels.TRAINING_LEVELS, Math.round(level)))
		local d = M_trainingLevels.levelDifficulty(n)
		local t = topT(n)
		local at20 = M_trainingLevels.levelDifficulty(TOP_FROM)
		local row = nil
		if (skill == "power") then
			local c = M_trainingDrills.powerDrillForLevel(n, 0)
			local c20 = M_trainingDrills.powerDrillForLevel(TOP_FROM, 0)
			row = Js.O({ distance = (if (t > 0) then lerp(c20.distance, 35, t) else c.distance), offset = (if (t > 0) then lerp(c20.offset, -5.5, t) else c.offset), blockers = (if (t > 0) then Math.round(lerp(c20.blockers, 5, t)) else c.blockers), keeper = c.keeper, keeperStrength = (if (t > 0) then lerp(c20.keeperStrength, 96, t) else (if c.keeper then c.keeperStrength else (25 + (70 * ((n - 1) / (M_trainingLevels.TRAINING_LEVELS - 1)))))), pass = (if (n >= 28) then lerp(0.6, 0.75, ((n - 28) / 2)) else 0.5) }, { "distance", "offset", "blockers", "keeper", "keeperStrength", "pass" })
		elseif (skill == "technique") then
			local c = M_trainingDrills.techniqueDrill(d, 0)
			local c20 = M_trainingDrills.techniqueDrill(at20, 0)
			row = Js.O({ gateDistance = (if (t > 0) then lerp(c20.gateDistance, 33, t) else c.gateDistance), gateWidth = (if (t > 0) then lerp(c20.gateWidth, 1.6, t) else c.gateWidth), gateOffset = (if (t > 0) then lerp(c20.gateOffset, 8, t) else c.gateOffset), maxHeight = c.maxHeight, pass = 0.25 }, { "gateDistance", "gateWidth", "gateOffset", "maxHeight", "pass" })
		elseif (skill == "freeKick") then
			local c = M_trainingDrills.freeKickDrill(d, 0)
			local c20 = M_trainingDrills.freeKickDrill(at20, 0)
			row = Js.O({ distance = (if (t > 0) then lerp(c20.distance, 31, t) else c.distance), offset = (if (t > 0) then lerp(c20.offset, -8.5, t) else c.offset), wall = (if (t > 0) then Math.round(lerp(c20.wall, 6, t)) else c.wall), keeperStrength = (if (t > 0) then lerp(c20.keeperStrength, 96, t) else c.keeperStrength), pass = (if (n >= 28) then lerp(0.6, 0.7, ((n - 28) / 2)) else 0.5) }, { "distance", "offset", "wall", "keeperStrength", "pass" })
		elseif (skill == "pace") then
			local c = M_trainingDrills.paceDrill(d, 0)
			local c20 = M_trainingDrills.paceDrill(at20, 0)
			row = Js.O({ chasers = (if (t > 0) then Math.round(lerp(c20.chasers, 11, t)) else c.chasers), waveMax = 3, oppStrength = (if (t > 0) then lerp(c20.oppStrength, 99, t) else c.oppStrength), runPace = (if (t > 0) then lerp(at20, 85, t) else d) }, { "chasers", "waveMax", "oppStrength", "runPace" })
		elseif (skill == "aerial") then
			row = aerialDefault(n)
		else
			row = visionDefault(n)
		end
		local out = Js.O({}, nil)
		local ints = Js.Set.new(A.map(A.filter(LEVEL_FIELDS[skill], function(f)
			return f.int
		end), function(f)
			return f.key
		end))
		do
			local _arr4 = Js.Object.entries(row)
			local _i5 = 0
			while _i5 < Js.alen(_arr4) do
				_i5 += 1
				local _e6 = _arr4[_i5]
				local k = _e6[1]
				local v = _e6[2]
				out[k] = (if (type(v) == "number") then (if ints:has(k) then Math.round(v) else round2(v)) else v)
			end
		end
		do return out end
	end
	exports.defaultLevel = defaultLevel
	visionDefault = function(n)
		local kick = (n >= VISION_KICK_FROM)
		local tapT = ((n - 1) / (VISION_KICK_FROM - 2))
		local kickT = ((n - VISION_KICK_FROM) / (M_trainingLevels.TRAINING_LEVELS - VISION_KICK_FROM))
		local window = (if (not kick) then lerp(4, 1.3, tapT) else (1.8 * Math.pow((VISION_TOP_WINDOW / 1.8), Math.min(1, ((n - VISION_KICK_FROM) / (VISION_TOP_FROM - VISION_KICK_FROM))))))
		local letGo = (if kick then lerp(2, 0.7, kickT) else 2)
		local climb = (if (not kick) then (tapT * 0.45) else (0.25 + (kickT * 0.75)))
		local options = (if (n <= 2) then 2 else (if (n == VISION_KICK_FROM) then 2 else Math.round(lerp(3, 6, Math.min(1, (climb / 0.85))))))
		local traps = (if ((n <= 3) or (n == VISION_KICK_FROM)) then 0 else Math.min((options - 1), Math.round(lerp(1, 3, Math.max(0, ((climb - 0.1) / 0.9))))))
		local margin = (if (n == VISION_KICK_FROM) then 0.3 else lerp(0.4, 0.03, Math.pow(Math.min(1, climb), 0.8)))
		local offside = ((n >= 5) and (math.fmod(n, 2) == 1))
		local real = (not ((n <= 2) or (n == VISION_KICK_FROM)))
		do return Js.O({ kick = kick, window = window, letGo = letGo, options = options, traps = traps, margin = margin, offside = offside, real = real }, { "kick", "window", "letGo", "options", "traps", "margin", "offside", "real" }) end
	end
	aerialDefault = function(n)
		do return Js.O({ volley = (math.fmod(n, 2) == 0), keeperStrength = lerp(20, 96, ((n - 1) / (M_trainingLevels.TRAINING_LEVELS - 1))), marker = (n >= 7), pass = (if (n >= 28) then lerp(0.6, 0.7, ((n - 28) / 2)) else 0.5), ballZ = lerp(1.75, 2.55, ((n - 1) / (M_trainingLevels.TRAINING_LEVELS - 1))) }, { "volley", "keeperStrength", "marker", "pass", "ballZ" }) end
	end
	defaultTable = function()
		local t = Js.O({}, nil)
		do
			local _arr7 = TRAINING_SKILLS
			local _i8 = 0
			while _i8 < Js.alen(_arr7) do
				_i8 += 1
				local s = _arr7[_i8]
				t[s] = Js.Array.from(Js.O({ length = M_trainingLevels.TRAINING_LEVELS }, { "length" }), function(_, i)
					return defaultLevel(s, (i + 1))
				end)
			end
		end
		do return t end
	end
	exports.defaultTable = defaultTable
	tableFromFile = function(file)
		local levels = ((if (Js.T(file) and (type(file) == "table")) then file.levels else nil) or Js.O({}, nil))
		local t = Js.O({}, nil)
		do
			local _arr9 = TRAINING_SKILLS
			local _i10 = 0
			while _i10 < Js.alen(_arr9) do
				_i10 += 1
				local s = _arr9[_i10]
				local rows = (if Js.Array.isArray(levels[s]) then levels[s] else Js.alit())
				t[s] = Js.Array.from(Js.O({ length = M_trainingLevels.TRAINING_LEVELS }, { "length" }), function(_, i)
					return (if Js.T(rows[i + 1]) then sanitizeLevel(s, (i + 1), rows[i + 1]) else defaultLevel(s, (i + 1)))
				end)
			end
		end
		do return t end
	end
	exports.tableFromFile = tableFromFile
	fileText = function(table_)
		local lines = Js.alit("{", ("  \"note\": " .. Js.JSON.stringify(FILE_NOTE) .. ","), "  \"levels\": {")
		A.forEach(TRAINING_SKILLS, function(s, si)
			A.push(lines, ("    " .. Js.JSON.stringify(s) .. ": ["))
			A.forEach(table_[s], function(row, i)
				A.push(lines, ("      " .. Js.JSON.stringify(row) .. (if Js.lt(i, (Js.alen(table_[s]) - 1)) then "," else "")))
			end)
			A.push(lines, ("    ]" .. (if (si < (Js.alen(TRAINING_SKILLS) - 1)) then "," else "")))
		end)
		A.push(lines, "  }", "}", "")
		do return A.join(lines, "\n") end
	end
	exports.fileText = fileText
	mergeTrainingFile = function(text, edits)
		local parsed = nil
		local _ok11, _err12, _rv13 = pcall(function()
			parsed = (if Js.T(S.trim(text)) then Js.JSON.parse(text) else nil)
		end)
		if not _ok11 then
			parsed = nil
		elseif _err12 == Js.RET then
			return _rv13
		end
		local table_ = tableFromFile(parsed)
		local ids = Js.alit()
		do
			local _arr14 = edits
			local _i15 = 0
			while _i15 < Js.alen(_arr14) do
				_i15 += 1
				local e = _arr14[_i15]
				if (not A.includes(TRAINING_SKILLS, e.skill)) then
					do continue end
				end
				local n = Math.round(e.level)
				if (not ((n >= 1) and (n <= M_trainingLevels.TRAINING_LEVELS))) then
					do continue end
				end
				A.set(table_[e.skill], (n - 1), sanitizeLevel(e.skill, n, e.config))
				A.push(ids, levelId(e.skill, n))
			end
		end
		do return Js.O({ text = fileText(table_), ids = ids }, { "text", "ids" }) end
	end
	exports.mergeTrainingFile = mergeTrainingFile
	levelId = function(skill, level)
		do return (skill .. ":" .. Js.numstr(level)) end
	end
	exports.levelId = levelId
	parseLevelId = function(id)
		local _d16 = S.split(id, ":")
		local s = _d16[1]
		local l = _d16[2]
		local n = Js.Number(l)
		if ((((not A.includes(TRAINING_SKILLS, s)) or (not Js.NumberNS.isInteger(n))) or (n < 1)) or (n > M_trainingLevels.TRAINING_LEVELS)) then
			do return nil end
		end
		do return Js.O({ skill = s, level = n }, { "skill", "level" }) end
	end
	exports.parseLevelId = parseLevelId
	setTrainingOverlay = function(next_)
		overlay = Js.ospread(next_)
	end
	exports.setTrainingOverlay = setTrainingOverlay
	trainingOverlay = function()
		do return overlay end
	end
	exports.trainingOverlay = trainingOverlay
	committedLevel = function(skill, level)
		local n = Math.max(1, Math.min(M_trainingLevels.TRAINING_LEVELS, Math.round(level)))
		do return FILE_TABLE[skill][n] end
	end
	exports.committedLevel = committedLevel
	levelConfig = function(skill, level, edits)
		if edits == nil then edits = overlay end
		local n = Math.max(1, Math.min(M_trainingLevels.TRAINING_LEVELS, Math.round(level)))
		local saved = edits[levelId(skill, n)]
		if ((skill == "vision") and isOldVisionRow(saved)) then
			do return committedLevel(skill, n) end
		end
		do return (if Js.T(saved) then sanitizeLevel(skill, n, saved) else committedLevel(skill, n)) end
	end
	exports.levelConfig = levelConfig
	levelSeedOf = function(skill, level, cfg)
		do return (if (type(cfg.seed) == "number") then Js.ushr(cfg.seed, 0) else M_trainingLevels.levelSeed(skill, level)) end
	end
	exports.levelSeedOf = levelSeedOf
	easePowerLevel = function(level, power, rowAt)
		local n = Math.max(1, Math.min(M_trainingLevels.TRAINING_LEVELS, Math.round(level)))
		local own = rowAt(n)
		if ((power == nil) or (not Js.NumberNS.isFinite(power))) then
			do return own end
		end
		local atPower = (1 + (Math.max(0, Math.min(1, ((power - 40) / 60))) * (M_trainingLevels.TRAINING_LEVELS - 1)))
		if (atPower >= n) then
			do return own end
		end
		local target = (n - (POWER_EASE_SHARE * (n - atPower)))
		local lo = Math.max(1, math.floor(target))
		local hi = Math.min(M_trainingLevels.TRAINING_LEVELS, (lo + 1))
		local f = (target - lo)
		local a = rowAt(lo)
		local b = rowAt(hi)
		local mix = function(x, y)
			return (x + ((y - x) * f))
		end
		local easedBlockers = Math.round(mix(a.blockers, b.blockers))
		local eased = Js.ospread(own, Js.O({ distance = round2(mix(a.distance, b.distance)), offset = round2(mix(a.offset, b.offset)), blockers = (if (own.blockers > 0) then Math.max(1, Math.min(own.blockers, easedBlockers)) else 0), keeperStrength = round2(Math.min(own.keeperStrength, mix(a.keeperStrength, b.keeperStrength))) }, { "distance", "offset", "blockers", "keeperStrength" }))
		if Js.T((function() local _v = own.men; if _v == nil then return nil end; _v = Js.len(_v); return _v end)()) then
			eased.men = carryMen(own.men, own, eased)
		end
		do return eased end
	end
	exports.easePowerLevel = easePowerLevel
	carryMen = function(men, from, to)
		local fx = from.offset
		local fy = Math.max(6, from.distance)
		local tx = to.offset
		local ty = Math.max(6, to.distance)
		local fl = (function() local _l = Math.hypot(fx, fy); if Js.T(_l) then return _l end; return 1 end)()
		local tl = (function() local _l = Math.hypot(tx, ty); if Js.T(_l) then return _l end; return 1 end)()
		local k = (tl / fl)
		local ang = (Math.atan2(ty, tx) - Math.atan2(fy, fx))
		local c = Math.cos(ang)
		local sn = Math.sin(ang)
		local goalX = (M_pitch.PITCH_W / 2)
		do return A.map(men, function(m)
			local rx = (m.x - goalX)
			local ry = m.y
			do return Js.O({ x = round2((goalX + (k * ((c * rx) - (sn * ry))))), y = round2(Math.max(0.5, (k * ((sn * rx) + (c * ry))))) }, { "x", "y" }) end
		end) end
	end
	TRAINING_SKILLS = Js.alit("power", "technique", "freeKick", "pace", "vision", "aerial")
	exports.TRAINING_SKILLS = TRAINING_SKILLS
	TOP_FROM = 20
	exports.TOP_FROM = TOP_FROM
	VISION_KICK_FROM = 10
	exports.VISION_KICK_FROM = VISION_KICK_FROM
	VISION_TOP_FROM = 28
	exports.VISION_TOP_FROM = VISION_TOP_FROM
	VISION_TOP_WINDOW = 0.3
	exports.VISION_TOP_WINDOW = VISION_TOP_WINDOW
	LEVEL_FIELDS = Js.O({ power = Js.alit(Js.O({ key = "distance", label = "Distance", min = 6, max = 40, step = 0.5, unit = "m" }, { "key", "label", "min", "max", "step", "unit" }), Js.O({ key = "offset", label = "Off centre", min = -20, max = 20, step = 0.5, unit = "m" }, { "key", "label", "min", "max", "step", "unit" }), Js.O({ key = "blockers", label = "Men in the way", min = 0, max = 6, step = 1, int = true }, { "key", "label", "min", "max", "step", "int" }), Js.O({ key = "keeper", label = "Keeper", min = 0, max = 1, step = 1, toggle = true }, { "key", "label", "min", "max", "step", "toggle" }), Js.O({ key = "keeperStrength", label = "Keeper strength", min = 0, max = 99, step = 1, int = true }, { "key", "label", "min", "max", "step", "int" }), Js.O({ key = "pass", label = "Score to pass", min = 0.5, max = 0.95, step = 0.05 }, { "key", "label", "min", "max", "step" })), technique = Js.alit(Js.O({ key = "gateDistance", label = "Gate distance", min = 6, max = 40, step = 0.5, unit = "m" }, { "key", "label", "min", "max", "step", "unit" }), Js.O({ key = "gateWidth", label = "Gate width", min = 0.8, max = 8, step = 0.1, unit = "m" }, { "key", "label", "min", "max", "step", "unit" }), Js.O({ key = "gateOffset", label = "Gate off line", min = -14, max = 14, step = 0.5, unit = "m" }, { "key", "label", "min", "max", "step", "unit" }), Js.O({ key = "maxHeight", label = "Max height", min = 0.5, max = 3, step = 0.1, unit = "m" }, { "key", "label", "min", "max", "step", "unit" }), Js.O({ key = "pass", label = "Score to pass", min = 0.25, max = 0.95, step = 0.05 }, { "key", "label", "min", "max", "step" })), freeKick = Js.alit(Js.O({ key = "distance", label = "Distance", min = 12, max = 38, step = 0.5, unit = "m" }, { "key", "label", "min", "max", "step", "unit" }), Js.O({ key = "offset", label = "Off centre", min = -22, max = 22, step = 0.5, unit = "m" }, { "key", "label", "min", "max", "step", "unit" }), Js.O({ key = "wall", label = "Men in the wall", min = 0, max = 7, step = 1, int = true }, { "key", "label", "min", "max", "step", "int" }), Js.O({ key = "keeperStrength", label = "Keeper strength", min = 0, max = 99, step = 1, int = true }, { "key", "label", "min", "max", "step", "int" }), Js.O({ key = "pass", label = "Score to pass", min = 0.5, max = 0.95, step = 0.05 }, { "key", "label", "min", "max", "step" })), pace = Js.alit(Js.O({ key = "chasers", label = "Men to beat", min = 1, max = 12, step = 1, int = true }, { "key", "label", "min", "max", "step", "int" }), Js.O({ key = "waveMax", label = "Most in one wave", min = 1, max = 4, step = 1, int = true }, { "key", "label", "min", "max", "step", "int" }), Js.O({ key = "oppStrength", label = "Their speed", min = 20, max = 100, step = 1, int = true }, { "key", "label", "min", "max", "step", "int" }), Js.O({ key = "runPace", label = "Your speed", min = 20, max = 100, step = 1, int = true }, { "key", "label", "min", "max", "step", "int" })), vision = Js.alit(Js.O({ key = "kick", label = "Kick the pass (off: tap him)", min = 0, max = 1, step = 1, toggle = true }, { "key", "label", "min", "max", "step", "toggle" }), Js.O({ key = "window", label = "Seconds to tap / start the kick", min = 0.2, max = 5, step = 0.05, unit = "s" }, { "key", "label", "min", "max", "step", "unit" }), Js.O({ key = "letGo", label = "Seconds to let go of the pull", min = 0.3, max = 3, step = 0.05, unit = "s" }, { "key", "label", "min", "max", "step", "unit" }), Js.O({ key = "options", label = "Team-mates", min = 2, max = 6, step = 1, int = true }, { "key", "label", "min", "max", "step", "int" }), Js.O({ key = "traps", label = "Traps (offside, cut out, marked)", min = 0, max = 4, step = 1, int = true }, { "key", "label", "min", "max", "step", "int" }), Js.O({ key = "margin", label = "How clear the right ball is", min = 0.02, max = 0.5, step = 0.01 }, { "key", "label", "min", "max", "step" }), Js.O({ key = "offside", label = "Someone offside", min = 0, max = 1, step = 1, toggle = true }, { "key", "label", "min", "max", "step", "toggle" }), Js.O({ key = "real", label = "Real match moments (off: drawn)", min = 0, max = 1, step = 1, toggle = true }, { "key", "label", "min", "max", "step", "toggle" })), aerial = Js.alit(Js.O({ key = "volley", label = "Volley (off: header)", min = 0, max = 1, step = 1, toggle = true }, { "key", "label", "min", "max", "step", "toggle" }), Js.O({ key = "keeperStrength", label = "Keeper strength", min = 0, max = 99, step = 1, int = true }, { "key", "label", "min", "max", "step", "int" }), Js.O({ key = "marker", label = "Marker", min = 0, max = 1, step = 1, toggle = true }, { "key", "label", "min", "max", "step", "toggle" }), Js.O({ key = "pass", label = "Score to pass", min = 0.5, max = 0.95, step = 0.05 }, { "key", "label", "min", "max", "step" }), Js.O({ key = "ballZ", label = "Header: ball height (m)", min = 1.5, max = 2.6, step = 0.05 }, { "key", "label", "min", "max", "step" })) }, { "power", "technique", "freeKick", "pace", "vision", "aerial" })
	exports.LEVEL_FIELDS = LEVEL_FIELDS
	round2 = function(v)
		return (Math.round((v * 100)) / 100)
	end
	MAX_MEN = 8
	PACE_LANE_HALF = 9
	exports.PACE_LANE_HALF = PACE_LANE_HALF
	lerp = function(a, b, t)
		return (a + ((b - a) * t))
	end
	FILE_NOTE = ("Training levels: one row per level, 30 per game. Edited on /star-training-dev (Edit level → Commit). " .. "Saved edits in the star_training_levels table sit on top of this file.")
	exports.FILE_NOTE = FILE_NOTE
	FILE_TABLE = tableFromFile(M_trainingLevels_json.default)
	overlay = Js.O({}, nil)
	POWER_EASE_SHARE = 0.75
	exports.POWER_EASE_SHARE = POWER_EASE_SHARE
	exports.levelDifficulty = M_trainingLevels.levelDifficulty
end
