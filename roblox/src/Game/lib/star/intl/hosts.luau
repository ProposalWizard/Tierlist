--!nocheck
--!nolint
-- Generated from lib/star/intl/hosts.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_nations = import("lib/star/intl/nations")
	local M_engine = import("lib/star/intl/engine")
	local M_realData = import("lib/star/intl/realData")
	local pick, WC_ROTATION, worldCupHosts, euroHosts, afconHosts, asianCupHosts, copaHosts, ofcHosts, GOLD_CUP_HOSTS
	pick = function(conf, edition, exclude)
		if exclude == nil then exclude = Js.alit() end
		local top = A.slice(A.sort(A.filter(M_nations.NATIONS, function(n)
			return (((n.confederation == conf) and (not n.suspended)) and (not A.includes(exclude, n.name)))
		end), function(a, b)
			return (a.rank - b.rank)
		end), 0, 12)
		local r = M_engine.rngFor(("host|" .. edition))()
		do return top[math.floor((r * Js.alen(top))) + 1].name end
	end
	worldCupHosts = function(year)
		if M_realData.WORLD_CUP_HOSTS[Js.key(year)] then
			do return M_realData.WORLD_CUP_HOSTS[Js.key(year)] end
		end
		local conf = WC_ROTATION[math.fmod(Math.max(0, ((year - 2038) / 4)), Js.alen(WC_ROTATION)) + 1]
		do return Js.alit(pick(conf, ("WC-" .. Js.numstr(year)))) end
	end
	exports.worldCupHosts = worldCupHosts
	euroHosts = function(year)
		do return (if M_realData.EURO_HOSTS[Js.key(year)] ~= nil then M_realData.EURO_HOSTS[Js.key(year)] else Js.alit(pick("UEFA", ("EURO-" .. Js.numstr(year)), Js.alit("England", "Scotland", "Wales", "Republic of Ireland", "Italy", "Turkey")))) end
	end
	exports.euroHosts = euroHosts
	afconHosts = function(year)
		if (year == 2027) then
			do return M_realData.AFCON_2027_HOSTS end
		end
		do return Js.alit(pick("CAF", ("AFCON-" .. Js.numstr(year)))) end
	end
	exports.afconHosts = afconHosts
	asianCupHosts = function(year)
		if (year == 2027) then
			do return Js.alit() end
		end
		do return Js.alit(pick("AFC", ("AC-" .. Js.numstr(year)))) end
	end
	exports.asianCupHosts = asianCupHosts
	copaHosts = function(year)
		do return Js.alit(pick("CONMEBOL", ("COPA-" .. Js.numstr(year)))) end
	end
	exports.copaHosts = copaHosts
	ofcHosts = function(year)
		do return Js.alit(pick("OFC", ("OFCNC-" .. Js.numstr(year)))) end
	end
	exports.ofcHosts = ofcHosts
	WC_ROTATION = Js.alit("UEFA", "CONCACAF", "CAF", "CONMEBOL", "AFC")
	GOLD_CUP_HOSTS = Js.alit("United States")
	exports.GOLD_CUP_HOSTS = GOLD_CUP_HOSTS
end
