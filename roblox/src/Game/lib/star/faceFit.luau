--!nocheck
--!nolint
-- Generated from lib/star/faceFit.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_faceScanLayout = import("lib/star/faceScanLayout")
	local FACE_FIT, hex2, rgbHex, looksLikeSkin, medianColour, hasCutout, guessFaceBox, centredFaceBox, sampleSkin, backgroundMask, smoothRGB, fitFace, fitted, images, fitImage, getFittedHead
	looksLikeSkin = function(r, g, b)
		local max = Math.max(r, g, b)
		local min = Math.min(r, g, b)
		if ((max < 35) or (max > 250)) then
			do return false end
		end
		if (not ((r >= g) and (g >= (b * 0.85)))) then
			do return false end
		end
		local sat = ((max - min) / max)
		do return ((sat > 0.08) and (sat < 0.72)) end
	end
	exports.looksLikeSkin = looksLikeSkin
	medianColour = function(px)
		if (not Js.T(Js.alen(px))) then
			do return nil end
		end
		local ch = function(i)
			local v = A.sort(A.map(px, function(p)
				return p[i + 1]
			end), function(a, b)
				return (a - b)
			end)
			do return v[Js.shr(Js.alen(v), 1) + 1] end
		end
		do return Js.alit(ch(0), ch(1), ch(2)) end
	end
	exports.medianColour = medianColour
	hasCutout = function(data, w, h)
		local clear = 0
		local n = 0
		do
			local x = 0
			local _first1 = true
			while true do
				if not _first1 then
					x += Math.max(1, Js.shr(w, 5))
				end
				_first1 = false
				if not (x < w) then break end
				do
					local _arr2 = Js.alit(0, 1, math.floor((h * 0.05)))
					local _i3 = 0
					while _i3 < Js.alen(_arr2) do
						_i3 += 1
						local y = _arr2[_i3]
						n += 1
						if (data[Js.key(((((y * w) + x) * 4) + 3))] < 40) then
							clear += 1
						end
					end
				end
			end
		end
		do return ((clear / n) > 0.6) end
	end
	exports.hasCutout = hasCutout
	guessFaceBox = function(data, w, h)
		local width = Js.alit()
		local mid = Js.alit()
		for y = 0, math.ceil(h) - 1 do
			local n = 0
			local sx = 0
			for x = 0, math.ceil(w) - 1 do
				if (data[Js.key(((((y * w) + x) * 4) + 3))] > 128) then
					n += 1
					sx += x
				end
			end
			A.push(width, n)
			A.push(mid, (if Js.T(n) then (sx / n) else (w / 2)))
		end
		local top = A.findIndex(width, function(n)
			return (n > (w * 0.03))
		end)
		if (top < 0) then
			top = 0
		end
		local shoulders = (h - 1)
		do
			local y = (top + math.floor(((h - top) * 0.45)))
			local _first4 = true
			while true do
				if not _first4 then
					y += 1
				end
				_first4 = false
				if not (y < h) then break end
				if (width[y + 1] > (w * 0.9)) then
					shoulders = y
					do break end
				end
			end
		end
		local neck = shoulders
		local neckW = math.huge
		do
			local y = (top + math.floor(((shoulders - top) * 0.5)))
			local _first5 = true
			while true do
				if not _first5 then
					y += 1
				end
				_first5 = false
				if not (y < shoulders) then break end
				if ((width[y + 1] > 0) and (width[y + 1] < neckW)) then
					neckW = width[y + 1]
					neck = y
				end
			end
		end
		local ear = math.floor((top + ((neck - top) * 0.7)))
		do
			local y = neck
			local _first6 = true
			while true do
				if not _first6 then
					y -= 1
				end
				_first6 = false
				if not (y > top) then break end
				if (width[y + 1] > (neckW * 1.1)) then
					ear = y
					do break end
				end
			end
		end
		local span = Math.max(8, (ear - top))
		local chin = Math.min(shoulders, (ear + (span * 0.27)))
		local headW = Math.max(Js.unpack(A.slice(width, top, (ear + 1))))
		local bh = ((chin - top) * 0.6)
		local bw = (headW * 0.78)
		local cx = (mid[math.floor((top + ((chin - top) * 0.55))) + 1] or (w / 2))
		do return Js.O({ x = (cx - (bw / 2)), y = (chin - bh), width = bw, height = bh }, { "x", "y", "width", "height" }) end
	end
	exports.guessFaceBox = guessFaceBox
	centredFaceBox = function(w, h)
		local bw = (w * 0.44)
		local bh = (h * 0.46)
		do return Js.O({ x = ((w - bw) / 2), y = (h * 0.3), width = bw, height = bh }, { "x", "y", "width", "height" }) end
	end
	exports.centredFaceBox = centredFaceBox
	sampleSkin = function(data, w, h, box)
		local spots = Js.alit(Js.alit(0.24, 0.6), Js.alit(0.76, 0.6), Js.alit(0.5, 0.48), Js.alit(0.3, 0.72), Js.alit(0.7, 0.72))
		local px = Js.alit()
		local rad = Math.max(1, Math.round((box.width * 0.07)))
		do
			local _arr7 = spots
			local _i8 = 0
			while _i8 < Js.alen(_arr7) do
				_i8 += 1
				local _e9 = _arr7[_i8]
				local fx = _e9[1]
				local fy = _e9[2]
				local cx = Math.round((box.x + (box.width * fx)))
				local cy = Math.round((box.y + (box.height * fy)))
				do
					local y = (cy - rad)
					local _first10 = true
					while true do
						if not _first10 then
							y += 1
						end
						_first10 = false
						if not (y <= (cy + rad)) then break end
						do
							local x = (cx - rad)
							local _first11 = true
							while true do
								if not _first11 then
									x += 1
								end
								_first11 = false
								if not (x <= (cx + rad)) then break end
								if ((((x < 0) or (y < 0)) or (x >= w)) or (y >= h)) then
									do continue end
								end
								local i = (((y * w) + x) * 4)
								if (data[Js.key((i + 3))] < 200) then
									do continue end
								end
								if looksLikeSkin(data[Js.key(i)], data[Js.key((i + 1))], data[Js.key((i + 2))]) then
									A.push(px, Js.alit(data[Js.key(i)], data[Js.key((i + 1))], data[Js.key((i + 2))]))
								end
							end
						end
					end
				end
			end
		end
		do return medianColour(px) end
	end
	exports.sampleSkin = sampleSkin
	backgroundMask = function(d, w, h, keep)
		local bg = Js.typedArray((w * h))
		local mr = 0
		local mg = 0
		local mb = 0
		local n = 0
		local edge = Js.alit()
		for x = 0, math.ceil(w) - 1 do
			A.push(edge, x, (((h - 1) * w) + x))
		end
		for y = 0, math.ceil(h) - 1 do
			A.push(edge, (y * w), (((y * w) + w) - 1))
		end
		do
			local _arr12 = edge
			local _i13 = 0
			while _i13 < Js.alen(_arr12) do
				_i13 += 1
				local p = _arr12[_i13]
				mr += d[Js.key((p * 4))]
				mg += d[Js.key(((p * 4) + 1))]
				mb += d[Js.key(((p * 4) + 2))]
				n += 1
			end
		end
		mr /= n
		mg /= n
		mb /= n
		local dist = function(a, r, g, b)
			return Math.hypot((d[Js.key((a * 4))] - r), (d[Js.key(((a * 4) + 1))] - g), (d[Js.key(((a * 4) + 2))] - b))
		end
		local stack = Js.alit()
		do
			local _arr14 = edge
			local _i15 = 0
			while _i15 < Js.alen(_arr14) do
				_i15 += 1
				local p = _arr14[_i15]
				if (dist(p, mr, mg, mb) < 70) then
					bg[Js.key(p)] = 1
					A.push(stack, p)
				end
			end
		end
		while Js.T(Js.alen(stack)) do
			local p = A.pop(stack)
			local x = math.fmod(p, w)
			local y = Js.bor((p / w), 0)
			do
				local _arr16 = Js.alit(Js.alit((x + 1), y), Js.alit((x - 1), y), Js.alit(x, (y + 1)), Js.alit(x, (y - 1)))
				local _i17 = 0
				while _i17 < Js.alen(_arr16) do
					_i17 += 1
					local _e18 = _arr16[_i17]
					local nx = _e18[1]
					local ny = _e18[2]
					if ((((nx < 0) or (ny < 0)) or (nx >= w)) or (ny >= h)) then
						do continue end
					end
					local q = ((ny * w) + nx)
					if (Js.T(bg[Js.key(q)]) or keep(nx, ny)) then
						do continue end
					end
					if ((dist(q, d[Js.key((p * 4))], d[Js.key(((p * 4) + 1))], d[Js.key(((p * 4) + 2))]) < 22) and (dist(q, mr, mg, mb) < 80)) then
						bg[Js.key(q)] = 1
						A.push(stack, q)
					end
				end
			end
		end
		do return bg end
	end
	smoothRGB = function(d, w, h, rad)
		if (rad <= 0) then
			do return end
		end
		local src = Js.typedArray(d)
		local sc = ((2 * 26) * 26)
		local ss = ((2 * rad) * rad)
		for y = 0, math.ceil(h) - 1 do
			for x = 0, math.ceil(w) - 1 do
				local i = (((y * w) + x) * 4)
				if (src[Js.key((i + 3))] == 0) then
					do continue end
				end
				local r = 0
				local g = 0
				local b = 0
				local tw = 0
				do
					local dy = (-rad)
					local _first19 = true
					while true do
						if not _first19 then
							dy += 1
						end
						_first19 = false
						if not (dy <= rad) then break end
						do
							local dx = (-rad)
							local _first20 = true
							while true do
								if not _first20 then
									dx += 1
								end
								_first20 = false
								if not (dx <= rad) then break end
								local xx = (x + dx)
								local yy = (y + dy)
								if ((((xx < 0) or (yy < 0)) or (xx >= w)) or (yy >= h)) then
									do continue end
								end
								local j = (((yy * w) + xx) * 4)
								if (src[Js.key((j + 3))] < 30) then
									do continue end
								end
								local dc = ((((src[Js.key(j)] - src[Js.key(i)]) ^ 2) + ((src[Js.key((j + 1))] - src[Js.key((i + 1))]) ^ 2)) + ((src[Js.key((j + 2))] - src[Js.key((i + 2))]) ^ 2))
								local wt = Math.exp((((-((dx * dx) + (dy * dy))) / ss) - (dc / sc)))
								r += (src[Js.key(j)] * wt)
								g += (src[Js.key((j + 1))] * wt)
								b += (src[Js.key((j + 2))] * wt)
								tw += wt
							end
						end
					end
				end
				if (tw > 0) then
					d[Js.key(i)] = (r / tw)
					d[Js.key((i + 1))] = (g / tw)
					d[Js.key((i + 2))] = (b / tw)
				end
			end
		end
	end
	fitFace = function(img, maxSide, srcHint)
		if (Js.document == nil) then
			do return nil end
		end
		local w0 = (if Js.has(img, "naturalWidth") then (if img.complete then img.naturalWidth else 0) else img.width)
		local h0 = (if Js.has(img, "naturalHeight") then img.naturalHeight else img.height)
		if ((not Js.T(w0)) or (not Js.T(h0))) then
			do return nil end
		end
		local k0 = (if Js.T(maxSide) then Math.min(1, (maxSide / Math.max(w0, h0))) else 1)
		local W = Math.max(1, Math.round((w0 * k0)))
		local H = Math.max(1, Math.round((h0 * k0)))
		local src = Js.document.createElement("canvas")
		src.width = W
		src.height = H
		local sx = src.getContext("2d", Js.O({ willReadFrequently = true }, { "willReadFrequently" }))
		if (not sx) then
			do return nil end
		end
		sx.drawImage(img, 0, 0, W, H)
		local full = nil
		local _ok21, _err22, _rv23 = pcall(function()
			full = sx.getImageData(0, 0, W, H)
		end)
		if not _ok21 then
			do return nil end
		elseif _err22 == Js.RET then
			return _rv23
		end
		local cutout = hasCutout(full.data, W, H)
		local px = function(x, y)
			return full.data[Js.key(((((y * W) + x) * 4) + 3))]
		end
		local srcUrl = (if Js.has(img, "src") then img.src else (if srcHint ~= nil then srcHint else ""))
		local scanned = M_faceScanLayout.looksScanned(srcUrl, W, H, Js.alit(px(0, 0), px((W - 1), 0), px(0, (H - 1)), px((W - 1), (H - 1))))
		if ((not cutout) and (not scanned)) then
			local keepMid = function(x, y)
				return (((((x - (W * 0.5)) / (W * 0.22)) ^ 2) + (((y - (H * 0.45)) / (H * 0.3)) ^ 2)) < 1)
			end
			local bg = backgroundMask(full.data, W, H, keepMid)
			local n = 0
			for i = 0, bg.length - 1 do
				if Js.T(bg[Js.key(i)]) then
					full.data[Js.key(((i * 4) + 3))] = 0
					n += 1
				end
			end
			if (n > (bg.length * 0.12)) then
				sx.putImageData(full, 0, 0)
				cutout = true
			end
		end
		local scanD = (M_faceScanLayout.SCAN_EYE_TO_CHIN * W)
		local box = (if scanned then Js.O({ x = ((M_faceScanLayout.SCAN_LAYOUT.cx * W) - ((FACE_FIT.scanBoxW * scanD) / 2)), y = ((M_faceScanLayout.SCAN_LAYOUT.chinY * H) - (FACE_FIT.scanBoxH * scanD)), width = (FACE_FIT.scanBoxW * scanD), height = (FACE_FIT.scanBoxH * scanD) }, { "x", "y", "width", "height" }) else (if cutout then guessFaceBox(full.data, W, H) else centredFaceBox(W, H)))
		if scanned then
			cutout = true
		end
		local skinRGB = (sampleSkin(full.data, W, H, box) or Js.alit(198, 150, 118))
		local chinY = (box.y + box.height)
		local cx = (box.x + (box.width / 2))
		local cropTop = (if scanned then 0 else Math.max(0, (box.y - (box.height * 0.95))))
		local cropBot = Math.min(H, (chinY + (box.height * (FACE_FIT.neckKeep + 0.02))))
		local cropHalfW = (if scanned then (W / 2) else (box.width * 0.95))
		local cropL = Math.max(0, (cx - cropHalfW))
		local cropR = Math.min(W, (cx + cropHalfW))
		local k = (FACE_FIT.workH / Math.max(1, (cropBot - cropTop)))
		local ow = Math.max(8, Math.round(((cropR - cropL) * k)))
		local oh = Math.max(8, Math.round(((cropBot - cropTop) * k)))
		local out = Js.document.createElement("canvas")
		out.width = ow
		out.height = oh
		local ox = out.getContext("2d", Js.O({ willReadFrequently = true }, { "willReadFrequently" }))
		if (not ox) then
			do return nil end
		end
		ox.imageSmoothingQuality = "high"
		ox.drawImage(src, cropL, cropTop, (cropR - cropL), (cropBot - cropTop), 0, 0, ow, oh)
		local id = ox.getImageData(0, 0, ow, oh)
		local d = id.data
		local b = Js.O({ x = ((box.x - cropL) * k), y = ((box.y - cropTop) * k), w = (box.width * k), h = (box.height * k) }, { "x", "y", "w", "h" })
		local ocx = (b.x + (b.w / 2))
		local ochin = (b.y + b.h)
		local ovalCy = (b.y + (b.h * 0.2))
		local ovalRy = (b.h * 1.08)
		local ovalRx = (b.w * 0.84)
		local inOval = function(x, y)
			return ((((x - ocx) / ovalRx) ^ 2) + (((y - ovalCy) / ovalRy) ^ 2))
		end
		local neckEnd = (ochin + (b.h * FACE_FIT.neckKeep))
		local fade = (b.h * FACE_FIT.neckFade)
		local neckHalf = (b.w * 0.36)
		for y = 0, math.ceil(oh) - 1 do
			for x = 0, math.ceil(ow) - 1 do
				local i = (((y * ow) + x) * 4)
				local a = (d[Js.key((i + 3))] / 255)
				if (not cutout) then
					local o = inOval(x, y)
					a *= (if (o < 0.86) then 1 else (if (o > 1) then 0 else ((1 - o) / 0.14)))
				end
				if (y > (ochin - (b.h * 0.12))) then
					local side = (math.abs((x - ocx)) - neckHalf)
					if ((y > ochin) and (side > 0)) then
						a *= Math.max(0, (1 - (side / (b.w * 0.08))))
					end
					if (y > (neckEnd - fade)) then
						a *= Math.max(0, ((neckEnd - y) / fade))
					end
				end
				d[Js.key((i + 3))] = Math.round((a * 255))
			end
		end
		smoothRGB(d, ow, oh, FACE_FIT.smooth)
		do
			local i = 0
			local _first24 = true
			while true do
				if not _first24 then
					i += 4
				end
				_first24 = false
				if not (i < d.length) then break end
				if (not Js.T(d[Js.key((i + 3))])) then
					do continue end
				end
				local r = d[Js.key(i)]
				local g = d[Js.key((i + 1))]
				local bl = d[Js.key((i + 2))]
				local l = (((0.299 * r) + (0.587 * g)) + (0.114 * bl))
				r = (l + ((r - l) * FACE_FIT.saturation))
				g = (l + ((g - l) * FACE_FIT.saturation))
				bl = (l + ((bl - l) * FACE_FIT.saturation))
				r = (128 + ((r - 128) * FACE_FIT.contrast))
				g = (128 + ((g - 128) * FACE_FIT.contrast))
				bl = (128 + ((bl - 128) * FACE_FIT.contrast))
				d[Js.key(i)] = r
				d[Js.key((i + 1))] = g
				d[Js.key((i + 2))] = bl
			end
		end
		for y = 0, math.ceil(oh) - 1 do
			for x = 0, math.ceil(ow) - 1 do
				local i = (((y * ow) + x) * 4)
				if (not Js.T(d[Js.key((i + 3))])) then
					do continue end
				end
				local u = Math.max(-1, Math.min(1, ((x - ocx) / (b.w * 0.75))))
				local f = ((1 + (FACE_FIT.keyLight * Math.max(0, (-u)))) - (FACE_FIT.shadowSide * (Math.max(0, u) ^ 1.5)))
				local under = ((y - (ochin - (b.h * 0.05))) / (b.h * 0.18))
				if (under > 0) then
					f *= (1 - (0.26 * Math.min(1, under)))
				end
				d[Js.key(i)] = ((d[Js.key(i)] * f) + (if (u < 0) then (6 * (-u)) else 0))
				d[Js.key((i + 1))] = (d[Js.key((i + 1))] * f)
				d[Js.key((i + 2))] = ((d[Js.key((i + 2))] * f) * (if (u > 0) then 1.02 else 1))
			end
		end
		ox.putImageData(id, 0, 0)
		do return Js.O({ canvas = out, chinX = ocx, chinY = ochin, faceH = b.h, skin = rgbHex(skinRGB[1], skinRGB[2], skinRGB[3]) }, { "canvas", "chinX", "chinY", "faceH", "skin" }) end
	end
	exports.fitFace = fitFace
	fitImage = function(url)
		local img = images:get(url)
		if (not img) then
			img = Js.O({}, {})
			if (not S.startsWith(url, "data:")) then
				img.crossOrigin = "anonymous"
			end
			img.src = url
			images:set(url, img)
		end
		do return img end
	end
	exports.fitImage = fitImage
	getFittedHead = function(url)
		local hit = fitted:get(url)
		if hit then
			do return hit end
		end
		local img = fitImage(url)
		if ((not img.complete) or (not Js.T(img.naturalWidth))) then
			do return nil end
		end
		local f = fitFace(img)
		if f then
			fitted:set(url, f)
		end
		do return f end
	end
	exports.getFittedHead = getFittedHead
	FACE_FIT = Js.O({ workH = 180, neckKeep = 0.2, neckFade = 0.22, keyLight = 0.1, shadowSide = 0.16, smooth = 2, saturation = 1.1, contrast = 1.06, scanBoxH = 1.17, scanBoxW = 1.12 }, { "workH", "neckKeep", "neckFade", "keyLight", "shadowSide", "smooth", "saturation", "contrast", "scanBoxH", "scanBoxW" })
	exports.FACE_FIT = FACE_FIT
	hex2 = function(v)
		return S.padStart(N.toString(Math.max(0, Math.min(255, Math.round(v))), 16), 2, "0")
	end
	rgbHex = function(r, g, b)
		return ("#" .. hex2(r) .. hex2(g) .. hex2(b))
	end
	exports.rgbHex = rgbHex
	fitted = Js.Map.new()
	images = Js.Map.new()
end
