--!nocheck
--!nolint
-- Generated from lib/star/airDrawings.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_pitch = import("lib/star/pitch")
	local AIR_FROM, isAirKind, RECEIVER_LABELS, AIR_STANCE_M, AIR_DEPTH, AIR_LATERAL, BALL_CLEAR_M, SAME_SPOT_M, hyp, derivedAirDrawings, CROSSER_MATE_INDEX, CROSSER_IN_M, HEADER_Z, VOLLEY_MAX_Z, arriveZ, AIR_HEADER_MIN_Z, AIR_HEADER_MAX_Z, AIR_VOLLEY_MIN_Z, AIR_HEIGHT_VARIES, OVERRIDE_KEY, setAirHeightVariesOverride, airHeightVaries, HEADER_Z_RANGE, VOLLEY_TOP_RANGE, REAL_HEADER_Z_DECILES, clampZ, airZOf, setAirZ, headerZFromSpread, pictureKey, VOLLEY_BOUNCE_S, airWaitZ, airArrival
	derivedAirDrawings = function(kind, source)
		local from = AIR_FROM[kind]
		if (not from) then
			do return Js.alit() end
		end
		local _d1 = AIR_DEPTH[kind]
		local dMin = _d1[1]
		local dMax = _d1[2]
		local latMax = AIR_LATERAL[kind]
		local out = Js.alit()
		do
			local _arr2 = from
			local _i3 = 0
			while _i3 < Js.alen(_arr2) do
				_i3 += 1
				local srcKind = _arr2[_i3]
				do
					local _arr4 = source(srcKind)
					local _i5 = 0
					while _i5 < Js.alen(_arr4) do
						_i5 += 1
						local ms = _arr4[_i5]
						local gk = A.find(ms.players, function(p)
							return (p.label == "GK")
						end)
						local crosser = A.find(ms.players, function(p)
							return (p.side == "you")
						end)
						if ((not gk) or (not crosser)) then
							do continue end
						end
						local defs = A.filter(ms.players, function(p)
							return ((p.side == "opponent") and (p.label ~= "GK"))
						end)
						if A.some(defs, function(d)
							return (d.y < gk.y)
						end) then
							do continue end
						end
						local mates = A.filter(ms.players, function(p)
							return (p.side == "teammate")
						end)
						local ys = A.sort(Js.aspread(A.map(defs, function(d)
							return d.y
						end), Js.alit(gk.y)), function(a, b)
							return (a - b)
						end)
						local line = (if (Js.alen(ys) >= 2) then ys[2] else (-math.huge))
						do
							local _arr6 = mates
							local _i7 = 0
							while _i7 < Js.alen(_arr6) do
								_i7 += 1
								local man = _arr6[_i7]
								if (not RECEIVER_LABELS:has(S.toUpperCase((if man.label ~= nil then man.label else "")))) then
									do continue end
								end
								local toC = Js.O({ x = (crosser.x - man.x), y = (crosser.y - man.y) }, { "x", "y" })
								local nC = (function() local _l = Math.hypot(toC.x, toC.y); if Js.T(_l) then return _l end; return 1 end)()
								local ball = Js.O({ x = (man.x + ((toC.x / nC) * AIR_STANCE_M)), y = (man.y + ((toC.y / nC) * AIR_STANCE_M)) }, { "x", "y" })
								if ((ball.y < dMin) or (ball.y > dMax)) then
									do continue end
								end
								if (math.abs((ball.x - M_pitch.CX)) > latMax) then
									do continue end
								end
								if (not (gk.y < ball.y)) then
									do continue end
								end
								if A.some(Js.aspread(defs, Js.alit(gk, crosser), A.filter(mates, function(m)
									return (m ~= man)
								end)), function(p)
									return (hyp(p, ball) < BALL_CLEAR_M)
								end) then
									do continue end
								end
								local others = A.filter(mates, function(m)
									return (m ~= man)
								end)
								if A.some(others, function(m)
									return ((m.y < (line - 0.01)) and (m.y < (ball.y - 0.01)))
								end) then
									do continue end
								end
								local listed = Js.aspread(Js.alit(Js.O({ id = "you", side = "you", x = man.x, y = man.y, label = "YOU" }, { "id", "side", "x", "y", "label" }), Js.O({ id = "crosser", side = "teammate", x = Math.min(Math.max(crosser.x, CROSSER_IN_M), (68 - CROSSER_IN_M)), y = Math.max(crosser.y, CROSSER_IN_M), label = "CROSSER" }, { "id", "side", "x", "y", "label" })), A.map(others, function(m)
									return Js.ospread(m)
								end), A.map(defs, function(d)
									return Js.ospread(d)
								end), Js.alit(Js.ospread(gk)))
								local players = A.filter(listed, function(p, i)
									return (not A.some(A.slice(listed, 0, i), function(q)
										return (hyp(p, q) < SAME_SPOT_M)
									end))
								end)
								A.push(out, Js.O({ id = ("air-" .. kind .. "-" .. ms.id .. "-" .. man.id), name = (kind .. " off " .. (if Js.T(ms.name) then ms.name else ms.id)), kind = ms.kind, camera = Js.ospread(ms.camera, Js.O({ centerX = Math.min(Math.max(ball.x, 14), 54) }, { "centerX" })), ball = ball, players = players, updatedAt = ms.updatedAt, source = Js.O({ tool = "gallery", kind = kind, seed = nil, derivedFrom = ms.id }, { "tool", "kind", "seed", "derivedFrom" }) }, { "id", "name", "kind", "camera", "ball", "players", "updatedAt", "source" }))
							end
						end
					end
				end
			end
		end
		do return A.sort(out, function(a, b)
			return S.localeCompare(a.id, b.id)
		end) end
	end
	exports.derivedAirDrawings = derivedAirDrawings
	arriveZ = function(kind)
		do return (if (kind == "header") then HEADER_Z else (if (kind == "volley") then VOLLEY_MAX_Z else 0)) end
	end
	exports.arriveZ = arriveZ
	setAirHeightVariesOverride = function(v)
		Js.globalThis[OVERRIDE_KEY] = v
	end
	exports.setAirHeightVariesOverride = setAirHeightVariesOverride
	airHeightVaries = function()
		local v = Js.globalThis[OVERRIDE_KEY]
		do return (if (type(v) == "boolean") then v else AIR_HEIGHT_VARIES) end
	end
	exports.airHeightVaries = airHeightVaries
	airZOf = function(sc)
		local base = arriveZ(sc.kind)
		if ((not airHeightVaries()) or (not isAirKind(sc.kind))) then
			do return base end
		end
		local z = sc.airZ
		if ((type(z) ~= "number") or (not Js.NumberNS.isFinite(z))) then
			do return base end
		end
		do return clampZ(z, (if (sc.kind == "header") then HEADER_Z_RANGE else VOLLEY_TOP_RANGE)) end
	end
	exports.airZOf = airZOf
	setAirZ = function(sc, z)
		if ((not isAirKind(sc.kind)) or (not Js.NumberNS.isFinite(z))) then
			do return end
		end
		sc.airZ = (Math.round((clampZ(z, (if (sc.kind == "header") then HEADER_Z_RANGE else VOLLEY_TOP_RANGE)) * 100)) / 100)
	end
	exports.setAirZ = setAirZ
	headerZFromSpread = function(key)
		local u = (math.fmod(Js.ushr(Math.imul(Js.ushr(Js.bxor(key, 2654435769), 0), 2654435761), 0), 10000) / 10000)
		local d = REAL_HEADER_Z_DECILES
		local f = (u * (Js.alen(d) - 1))
		local i = Math.min((Js.alen(d) - 2), math.floor(f))
		do return (Math.round(((d[i + 1] + ((d[(i + 1) + 1] - d[i + 1]) * (f - i))) * 100)) / 100) end
	end
	exports.headerZFromSpread = headerZFromSpread
	pictureKey = function(sc)
		local h = 17
		do
			local _arr8 = Js.aspread(Js.alit(sc.ball, sc.player), sc.defenders)
			local _i9 = 0
			while _i9 < Js.alen(_arr8) do
				_i9 += 1
				local p = _arr8[_i9]
				h = Js.bor(((Math.imul(h, 31) + (Math.round((p.x * 100)) * 7)) + Math.round((p.y * 100))), 0)
			end
		end
		do return Js.ushr(h, 0) end
	end
	exports.pictureKey = pictureKey
	airWaitZ = function(kind, t, sc)
		local top = (if sc then airZOf(sc) else arriveZ(kind))
		if (kind == "header") then
			do return (top + (0.05 * Math.sin((t * 2.6)))) end
		end
		if (kind == "volley") then
			do return (top * math.abs(Math.cos(((Math.PI * Math.max(0, t)) / VOLLEY_BOUNCE_S)))) end
		end
		do return 0 end
	end
	exports.airWaitZ = airWaitZ
	airArrival = function(sc)
		if (not isAirKind(sc.kind)) then
			do return nil end
		end
		local c = sc.teammates[1]
		if (((((not c) or (c.x < -1)) or (c.x > 69)) or (c.y < -1)) or (c.y > 104)) then
			do return nil end
		end
		local L = hyp(c, sc.ball)
		if (L < 6) then
			do return nil end
		end
		do return Js.O({ from = Js.O({ x = c.x, y = c.y }, { "x", "y" }), apex = Math.min(4.6, Math.max(3, (2.6 + (L * 0.06)))), endZ = airZOf(sc) }, { "from", "apex", "endZ" }) end
	end
	exports.airArrival = airArrival
	AIR_FROM = Js.O({ header = Js.alit("byline_cross", "corner"), volley = Js.alit("byline_cross", "corner", "cutback") }, { "header", "volley" })
	exports.AIR_FROM = AIR_FROM
	isAirKind = function(k)
		return ((k == "header") or (k == "volley"))
	end
	exports.isAirKind = isAirKind
	RECEIVER_LABELS = Js.Set.new(Js.alit("TARGET", "POACH"))
	AIR_STANCE_M = 1
	exports.AIR_STANCE_M = AIR_STANCE_M
	AIR_DEPTH = Js.O({ header = Js.alit(2.5, 8), volley = Js.alit(8.5, 18) }, { "header", "volley" })
	exports.AIR_DEPTH = AIR_DEPTH
	AIR_LATERAL = Js.O({ header = 10, volley = 15 }, { "header", "volley" })
	exports.AIR_LATERAL = AIR_LATERAL
	BALL_CLEAR_M = 1
	exports.BALL_CLEAR_M = BALL_CLEAR_M
	SAME_SPOT_M = 0.3
	exports.SAME_SPOT_M = SAME_SPOT_M
	hyp = function(a, b)
		return Math.hypot((a.x - b.x), (a.y - b.y))
	end
	CROSSER_MATE_INDEX = 0
	exports.CROSSER_MATE_INDEX = CROSSER_MATE_INDEX
	CROSSER_IN_M = 0.6
	exports.CROSSER_IN_M = CROSSER_IN_M
	HEADER_Z = 1.85
	exports.HEADER_Z = HEADER_Z
	VOLLEY_MAX_Z = 0.95
	exports.VOLLEY_MAX_Z = VOLLEY_MAX_Z
	AIR_HEADER_MIN_Z = 1.3
	exports.AIR_HEADER_MIN_Z = AIR_HEADER_MIN_Z
	AIR_HEADER_MAX_Z = 2.6
	exports.AIR_HEADER_MAX_Z = AIR_HEADER_MAX_Z
	AIR_VOLLEY_MIN_Z = 0.35
	exports.AIR_VOLLEY_MIN_Z = AIR_VOLLEY_MIN_Z
	AIR_HEIGHT_VARIES = true
	exports.AIR_HEIGHT_VARIES = AIR_HEIGHT_VARIES
	OVERRIDE_KEY = "__knowitballAirHeightVaries"
	HEADER_Z_RANGE = Js.alit(1.5, AIR_HEADER_MAX_Z)
	exports.HEADER_Z_RANGE = HEADER_Z_RANGE
	VOLLEY_TOP_RANGE = Js.alit(0.6, AIR_HEADER_MIN_Z)
	exports.VOLLEY_TOP_RANGE = VOLLEY_TOP_RANGE
	REAL_HEADER_Z_DECILES = Js.alit(1.5, 1.5, 1.7, 1.9, 2, 2.1, 2.1, 2.2, 2.4, 2.5, 2.6)
	exports.REAL_HEADER_Z_DECILES = REAL_HEADER_Z_DECILES
	clampZ = function(z, r)
		return Math.min(r[2], Math.max(r[1], z))
	end
	VOLLEY_BOUNCE_S = 0.9
	exports.VOLLEY_BOUNCE_S = VOLLEY_BOUNCE_S
end
