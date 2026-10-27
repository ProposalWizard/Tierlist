--!nocheck
--!nolint
-- Generated from lib/star/money.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local MONEY_SCALE, niceMoneyStep, formatMoneyPrecise, formatMoney
	niceMoneyStep = function(amount)
		local a = math.abs(amount)
		if (a < 50) then
			do return 1 end
		end
		if (a < 200) then
			do return 5 end
		end
		if (a < 1000) then
			do return 10 end
		end
		if (a < 2500) then
			do return 25 end
		end
		if (a < 10000) then
			do return 100 end
		end
		if (a < 100000) then
			do return 5000 end
		end
		if (a < 1000000) then
			do return 25000 end
		end
		if (a < 10000000) then
			do return 250000 end
		end
		if (a < 100000000) then
			do return 1000000 end
		end
		if (a < 1000000000) then
			do return 5000000 end
		end
		do return 25000000 end
	end
	exports.niceMoneyStep = niceMoneyStep
	formatMoneyPrecise = function(n)
		local negative = (n < 0)
		local value = math.abs(n)
		local UNITS = Js.alit(Js.O({ div = 1000000000, suffix = "b" }, { "div", "suffix" }), Js.O({ div = 1000000, suffix = "m" }, { "div", "suffix" }), Js.O({ div = 1000, suffix = "k" }, { "div", "suffix" }))
		do
			local _arr1 = UNITS
			local _i2 = 0
			while _i2 < Js.alen(_arr1) do
				_i2 += 1
				local u = _arr1[_i2]
				if (value >= u.div) then
					local str = N.toFixed((value / u.div), 1)
					if S.endsWith(str, ".0") then
						str = S.slice(str, 0, -2)
					end
					do return ((if negative then "-" else "") .. str .. u.suffix) end
				end
			end
		end
		do return ((if negative then "-" else "") .. Js.numstr(Math.round(value))) end
	end
	exports.formatMoneyPrecise = formatMoneyPrecise
	formatMoney = function(n)
		local negative = (n < 0)
		local value = Math.round(math.abs(n))
		local UNITS = Js.alit(Js.O({ div = 1000000000, suffix = "b" }, { "div", "suffix" }), Js.O({ div = 1000000, suffix = "m" }, { "div", "suffix" }), Js.O({ div = 1000, suffix = "k" }, { "div", "suffix" }))
		do
			local _arr3 = UNITS
			local _i4 = 0
			while _i4 < Js.alen(_arr3) do
				_i4 += 1
				local u = _arr3[_i4]
				if (value >= u.div) then
					local whole = math.floor((value / u.div))
					do return ((if negative then "-" else "") .. Js.numstr(whole) .. u.suffix) end
				end
			end
		end
		do return ((if negative then "-" else "") .. Js.numstr(value)) end
	end
	exports.formatMoney = formatMoney
	MONEY_SCALE = 2000
	exports.MONEY_SCALE = MONEY_SCALE
end
