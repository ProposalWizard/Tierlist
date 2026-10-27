--!nocheck
--!nolint
-- Generated from roblox/twin/_out.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local show, out
	show = function(x)
		do return (if (type(x) == "string") then x else (Js.JSON.stringify(x, function(_k, v)
			return (if (v == nil) then nil else v)
		end) or "undefined")) end
	end
	exports.show = show
	out = function(...)
		local xs = Js.alit(...)
		return Js.console.log(A.join(A.map(xs, show), " | "))
	end
	exports.out = out
end
