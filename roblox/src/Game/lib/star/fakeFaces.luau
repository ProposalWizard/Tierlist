--!nocheck
--!nolint
-- Generated from lib/star/fakeFaces.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local FAKE_FACES, DEFAULT_FAKE_FACE, hashKey, fakeFaceFor, faceOrFake
	hashKey = function(key)
		local h = 5381
		for i = 0, (S.len(key)) - 1 do
			h = Js.bor(Js.bxor((Js.shl(h, 5) + h), S.charCodeAt(key, i)), 0)
		end
		do return Js.ushr(h, 0) end
	end
	fakeFaceFor = function(key)
		do return FAKE_FACES[math.fmod(hashKey(key), Js.alen(FAKE_FACES)) + 1] end
	end
	exports.fakeFaceFor = fakeFaceFor
	faceOrFake = function(url, key)
		do return (if Js.T(url) then url else fakeFaceFor(key)) end
	end
	exports.faceOrFake = faceOrFake
	FAKE_FACES = Js.alit("/ChatGPT Image Sep 15, 2026, 11_23_12 PM.png", "/ChatGPT Image Sep 15, 2026, 11_23_25 PM.png", "/ChatGPT Image Sep 15, 2026, 11_23_33 PM.png", "/ChatGPT Image Sep 15, 2026, 11_23_40 PM.png", "/ChatGPT Image Sep 15, 2026, 11_23_47 PM.png", "/ChatGPT Image Sep 15, 2026, 11_24_29 PM.png", "/ChatGPT Image Sep 15, 2026, 11_24_37 PM.png")
	exports.FAKE_FACES = FAKE_FACES
	DEFAULT_FAKE_FACE = FAKE_FACES[1]
	exports.DEFAULT_FAKE_FACE = DEFAULT_FAKE_FACE
end
