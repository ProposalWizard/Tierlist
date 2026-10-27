--!nocheck
--!nolint
-- Generated from lib/star/faceScanLayout.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local SCAN_LAYOUT, SCAN_EYE_TO_CHIN, looksScanned
	looksScanned = function(url, w, h, cornerAlpha)
		if (not S.startsWith(url, "data:")) then
			do return false end
		end
		if ((w ~= h) or (w < 128)) then
			do return false end
		end
		do return ((Js.alen(cornerAlpha) == 4) and A.every(cornerAlpha, function(a)
			return (a < 8)
		end)) end
	end
	exports.looksScanned = looksScanned
	SCAN_LAYOUT = Js.O({ size = 320, cx = 0.5, eyeY = 0.44, chinY = 0.74 }, { "size", "cx", "eyeY", "chinY" })
	exports.SCAN_LAYOUT = SCAN_LAYOUT
	SCAN_EYE_TO_CHIN = (SCAN_LAYOUT.chinY - SCAN_LAYOUT.eyeY)
	exports.SCAN_EYE_TO_CHIN = SCAN_EYE_TO_CHIN
end
