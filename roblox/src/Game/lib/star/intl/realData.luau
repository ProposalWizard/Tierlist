--!nocheck
--!nolint
-- Generated from lib/star/intl/realData.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_nations = import("lib/star/intl/nations")
	local realNation, realList, UNL_2026, AFCONQ_2027, AFCON_2027_HOSTS, ASIAN_CUP_2027, CNL_2026, EURO_HOSTS, WORLD_CUP_HOSTS
	realNation = function(name)
		do return ((function() local _v = M_nations.nationFor(name); if _v == nil then return nil end; _v = _v.name; return _v end)() or nil) end
	end
	exports.realNation = realNation
	realList = function(names)
		do return A.filter(A.map(names, realNation), function(n)
			return (not (not Js.T(n)))
		end) end
	end
	exports.realList = realList
	UNL_2026 = Js.O({ A1 = Js.alit("France", "Italy", "Belgium", "Turkey"), A2 = Js.alit("Netherlands", "Greece", "Germany", "Serbia"), A3 = Js.alit("Spain", "England", "Croatia", "Czech Republic"), A4 = Js.alit("Portugal", "Denmark", "Wales", "Norway"), B1 = Js.alit("Switzerland", "Slovenia", "Scotland", "North Macedonia"), B2 = Js.alit("Northern Ireland", "Hungary", "Ukraine", "Georgia"), B3 = Js.alit("Austria", "Kosovo", "Republic of Ireland", "Israel"), B4 = Js.alit("Sweden", "Bosnia and Herzegovina", "Poland", "Romania"), C1 = Js.alit("Albania", "Belarus", "Finland", "San Marino"), C2 = Js.alit("Montenegro", "Cyprus", "Armenia", "Latvia"), C3 = Js.alit("Slovakia", "Faroe Islands", "Moldova", "Kazakhstan"), C4 = Js.alit("Iceland", "Estonia", "Bulgaria", "Luxembourg"), D1 = Js.alit("Malta", "Gibraltar", "Andorra"), D2 = Js.alit("Azerbaijan", "Lithuania", "Liechtenstein") }, { "A1", "A2", "A3", "A4", "B1", "B2", "B3", "B4", "C1", "C2", "C3", "C4", "D1", "D2" })
	exports.UNL_2026 = UNL_2026
	AFCONQ_2027 = Js.O({ A = Js.alit("Morocco", "Gabon", "Niger", "Lesotho"), B = Js.alit("Egypt", "Angola", "Malawi", "South Sudan"), C = Js.alit("Ivory Coast", "Gambia", "Somalia", "Ghana"), D = Js.alit("South Africa", "Guinea", "Kenya", "Eritrea"), E = Js.alit("DR Congo", "Zimbabwe", "Equatorial Guinea", "Sierra Leone"), F = Js.alit("Benin", "Burkina Faso", "Mauritania", "Central African Republic"), G = Js.alit("Cameroon", "Comoros", "Namibia", "Congo"), H = Js.alit("Uganda", "Botswana", "Tunisia", "Libya"), I = Js.alit("Algeria", "Zambia", "Togo", "Burundi"), J = Js.alit("Mozambique", "Senegal", "Sudan", "Ethiopia"), K = Js.alit("Rwanda", "Mali", "Cape Verde", "Liberia"), L = Js.alit("Guinea-Bissau", "Nigeria", "Madagascar", "Tanzania") }, { "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L" })
	exports.AFCONQ_2027 = AFCONQ_2027
	AFCON_2027_HOSTS = Js.alit("Kenya", "Uganda", "Tanzania")
	exports.AFCON_2027_HOSTS = AFCON_2027_HOSTS
	ASIAN_CUP_2027 = Js.O({ A = Js.alit("Saudi Arabia", "Kuwait", "Oman", "Palestine"), B = Js.alit("Uzbekistan", "Bahrain", "North Korea", "Jordan"), C = Js.alit("Iran", "Syria", "Kyrgyzstan", "China"), D = Js.alit("Australia", "Tajikistan", "Iraq", "Singapore"), E = Js.alit("South Korea", "United Arab Emirates", "Vietnam", "Yemen"), F = Js.alit("Japan", "Qatar", "Thailand", "Indonesia") }, { "A", "B", "C", "D", "E", "F" })
	exports.ASIAN_CUP_2027 = ASIAN_CUP_2027
	CNL_2026 = Js.O({ A = Js.alit("Canada", "Costa Rica", "Curaçao", "Dominican Republic", "El Salvador", "Guatemala", "Haiti", "Honduras", "Jamaica", "Martinique", "Mexico", "Nicaragua", "Panama", "Suriname", "Trinidad and Tobago", "United States"), B = Js.alit("Barbados", "Belize", "Bermuda", "Bonaire", "Cayman Islands", "Cuba", "Dominica", "French Guiana", "Grenada", "Guadeloupe", "Guyana", "Puerto Rico", "Saint Kitts and Nevis", "Saint Lucia", "Saint Vincent and the Grenadines", "Sint Maarten"), C = Js.alit("Anguilla", "Antigua and Barbuda", "Aruba", "Bahamas", "British Virgin Islands", "Montserrat", "Saint Martin", "Turks and Caicos Islands", "US Virgin Islands") }, { "A", "B", "C" })
	exports.CNL_2026 = CNL_2026
	EURO_HOSTS = Js.O({ ["2028"] = Js.alit("England", "Scotland", "Wales", "Republic of Ireland"), ["2032"] = Js.alit("Italy", "Turkey") }, { "2028", "2032" })
	exports.EURO_HOSTS = EURO_HOSTS
	WORLD_CUP_HOSTS = Js.O({ ["2030"] = Js.alit("Morocco", "Portugal", "Spain", "Argentina", "Paraguay", "Uruguay"), ["2034"] = Js.alit("Saudi Arabia") }, { "2030", "2034" })
	exports.WORLD_CUP_HOSTS = WORLD_CUP_HOSTS
end
