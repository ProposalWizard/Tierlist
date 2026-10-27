--!nocheck
--!nolint
-- Generated from lib/star/devMode.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local offlineDevPlayEnabled
	offlineDevPlayEnabled = function()
		local flag = Js.idx(Js.process.env, "NEXT_PUBLIC_STAR_OFFLINE_DEV")
		if (flag == "1") then
			do return true end
		end
		if (flag == "0") then
			do return false end
		end
		do return (Js.idx(Js.process.env, "NODE_ENV") == "development") end
	end
	exports.offlineDevPlayEnabled = offlineDevPlayEnabled
end
