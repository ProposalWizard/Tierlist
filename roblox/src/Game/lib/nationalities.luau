--!nocheck
--!nolint
-- Generated from lib/nationalities.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local isoToFlagEmoji, SUBDIVISION_FLAGS, NATIONALITY_ISO, NOT_FIFA, ALL_NATIONALITIES, nationalityKey, canonNat, SUBDIVISION_FLAGS_LC, NATIONALITY_ISO_LC, nationalityFlag, FLAGCDN_SUBDIVISIONS, FLAGCDN_SUBDIVISIONS_LC, getFlagUrl
	isoToFlagEmoji = function(iso2)
		local upper = S.toUpperCase(iso2)
		do return (Js.String.fromCodePoint((127462 + (S.charCodeAt(upper, 0) - 65))) .. Js.String.fromCodePoint((127462 + (S.charCodeAt(upper, 1) - 65)))) end
	end
	nationalityKey = function(nationality)
		if (not Js.T(nationality)) then
			do return nil end
		end
		local n = canonNat(nationality)
		if Js.T(SUBDIVISION_FLAGS_LC[n]) then
			do return ("sub:" .. n) end
		end
		do return (if NATIONALITY_ISO_LC[n] ~= nil then NATIONALITY_ISO_LC[n] else (if (S.len(n) == 2) then S.toUpperCase(n) else nil)) end
	end
	exports.nationalityKey = nationalityKey
	canonNat = function(nationality)
		do return S.replace(S.replace(S.normalize(S.toLowerCase(S.trim(nationality)), "NFD"), Js.re("[̀-ͯ]", "g"), ""), Js.re("[‘’`´]", "g"), "'") end
	end
	nationalityFlag = function(nationality)
		if (not Js.T(nationality)) then
			do return "" end
		end
		local n = canonNat(nationality)
		if Js.T(SUBDIVISION_FLAGS_LC[n]) then
			do return SUBDIVISION_FLAGS_LC[n] end
		end
		local iso = NATIONALITY_ISO_LC[n]
		if Js.T(iso) then
			do return isoToFlagEmoji(iso) end
		end
		if (S.len(n) == 2) then
			do return isoToFlagEmoji(S.toUpperCase(n)) end
		end
		do return "" end
	end
	exports.nationalityFlag = nationalityFlag
	getFlagUrl = function(nationality)
		if (not Js.T(nationality)) then
			do return nil end
		end
		local n = canonNat(nationality)
		local sub = FLAGCDN_SUBDIVISIONS_LC[n]
		if Js.T(sub) then
			do return ("https://flagcdn.com/20x15/" .. sub .. ".png") end
		end
		local iso = NATIONALITY_ISO_LC[n]
		if Js.T(iso) then
			do return ("https://flagcdn.com/20x15/" .. S.toLowerCase(iso) .. ".png") end
		end
		if (S.len(n) == 2) then
			do return ("https://flagcdn.com/20x15/" .. S.toLowerCase(n) .. ".png") end
		end
		do return nil end
	end
	exports.getFlagUrl = getFlagUrl
	SUBDIVISION_FLAGS = Js.O({ England = "🏴󠁧󠁢󠁥󠁮󠁧󠁿", Scotland = "🏴󠁧󠁢󠁳󠁣󠁴󠁿", Wales = "🏴󠁧󠁢󠁷󠁬󠁳󠁿", ["Northern Ireland"] = "🏴󠁧󠁢󠁮󠁩󠁲󠁿" }, { "England", "Scotland", "Wales", "Northern Ireland" })
	NATIONALITY_ISO = Js.O({ ["Republic of Ireland"] = "IE", Ireland = "IE", ["Great Britain"] = "GB", France = "FR", Germany = "DE", Spain = "ES", Italy = "IT", Portugal = "PT", Netherlands = "NL", Belgium = "BE", Switzerland = "CH", Austria = "AT", Poland = "PL", Sweden = "SE", Norway = "NO", Denmark = "DK", Finland = "FI", Iceland = "IS", Russia = "RU", Ukraine = "UA", ["Czech Republic"] = "CZ", Czechia = "CZ", Slovakia = "SK", Hungary = "HU", Romania = "RO", Croatia = "HR", Serbia = "RS", Slovenia = "SI", ["Bosnia and Herzegovina"] = "BA", ["Bosnia Herzegovina"] = "BA", ["Bosnia & Herzegovina"] = "BA", ["Bosnia-Herzegovina"] = "BA", Montenegro = "ME", ["North Macedonia"] = "MK", ["FYR Macedonia"] = "MK", Macedonia = "MK", Albania = "AL", Greece = "GR", Bulgaria = "BG", Cyprus = "CY", Luxembourg = "LU", Malta = "MT", Andorra = "AD", ["San Marino"] = "SM", Monaco = "MC", Liechtenstein = "LI", Kosovo = "XK", Moldova = "MD", Belarus = "BY", Georgia = "GE", Armenia = "AM", Azerbaijan = "AZ", Turkey = "TR", ["Türkiye"] = "TR", Israel = "IL", Estonia = "EE", Latvia = "LV", Lithuania = "LT", ["Faroe Islands"] = "FO", Gibraltar = "GI", Nigeria = "NG", Ghana = "GH", Senegal = "SN", ["Ivory Coast"] = "CI", ["Cote d'Ivoire"] = "CI", ["Côte d'Ivoire"] = "CI", Cameroon = "CM", Mali = "ML", Algeria = "DZ", Morocco = "MA", Tunisia = "TN", Egypt = "EG", ["South Africa"] = "ZA", ["DR Congo"] = "CD", ["Congo DR"] = "CD", ["Democratic Republic of the Congo"] = "CD", Congo = "CG", ["Congo Republic"] = "CG", Zambia = "ZM", Zimbabwe = "ZW", Kenya = "KE", Uganda = "UG", Tanzania = "TZ", Ethiopia = "ET", Angola = "AO", Mozambique = "MZ", Guinea = "GN", ["Guinea-Bissau"] = "GW", ["Burkina Faso"] = "BF", Benin = "BJ", Togo = "TG", Niger = "NE", Chad = "TD", Gabon = "GA", Gambia = "GM", ["Sierra Leone"] = "SL", Liberia = "LR", Mauritania = "MR", Namibia = "NA", Botswana = "BW", Malawi = "MW", Rwanda = "RW", Burundi = "BI", Sudan = "SD", ["South Sudan"] = "SS", Libya = "LY", ["Equatorial Guinea"] = "GQ", ["Central African Republic"] = "CF", ["Cape Verde"] = "CV", ["Cabo Verde"] = "CV", Comoros = "KM", Madagascar = "MG", Mauritius = "MU", Eswatini = "SZ", Swaziland = "SZ", Lesotho = "LS", Somalia = "SO", Eritrea = "ER", Djibouti = "DJ", Seychelles = "SC", Reunion = "RE", ["Réunion"] = "RE", ["São Tomé and Príncipe"] = "ST", ["São Tomé e Príncipe"] = "ST", ["Sao Tome and Principe"] = "ST", ["São Tomé & Príncipe"] = "ST", Argentina = "AR", Brazil = "BR", Chile = "CL", Uruguay = "UY", Paraguay = "PY", Bolivia = "BO", Peru = "PE", Ecuador = "EC", Colombia = "CO", Venezuela = "VE", Guyana = "GY", Suriname = "SR", ["French Guiana"] = "GF", ["United States"] = "US", USA = "US", Canada = "CA", Mexico = "MX", ["Costa Rica"] = "CR", Honduras = "HN", Panama = "PA", Jamaica = "JM", Guatemala = "GT", ["El Salvador"] = "SV", Nicaragua = "NI", ["Trinidad and Tobago"] = "TT", ["Trinidad & Tobago"] = "TT", Haiti = "HT", Cuba = "CU", ["Dominican Republic"] = "DO", Belize = "BZ", Bahamas = "BS", Barbados = "BB", Curacao = "CW", ["Curaçao"] = "CW", ["Antigua and Barbuda"] = "AG", ["Antigua & Barbuda"] = "AG", Grenada = "GD", ["Saint Kitts and Nevis"] = "KN", ["St Kitts & Nevis"] = "KN", ["St. Kitts & Nevis"] = "KN", ["Saint Lucia"] = "LC", ["St Lucia"] = "LC", ["St. Lucia"] = "LC", ["Saint Vincent and the Grenadines"] = "VC", ["St Vincent & the Grenadines"] = "VC", ["St. Vincent & the Grenadines"] = "VC", Bermuda = "BM", ["Puerto Rico"] = "PR", Guadeloupe = "GP", Martinique = "MQ", Bonaire = "BQ", ["Sint Maarten"] = "SX", Aruba = "AW", ["Cayman Islands"] = "KY", Montserrat = "MS", Anguilla = "AI", ["Turks and Caicos Islands"] = "TC", Dominica = "DM", ["Saint Barthelemy"] = "BL", Japan = "JP", ["Korea Republic"] = "KR", ["South Korea"] = "KR", ["Korea DPR"] = "KP", ["North Korea"] = "KP", ["China PR"] = "CN", China = "CN", ["Saudi Arabia"] = "SA", Iran = "IR", Iraq = "IQ", Qatar = "QA", ["United Arab Emirates"] = "AE", UAE = "AE", Jordan = "JO", Lebanon = "LB", Syria = "SY", Kuwait = "KW", Bahrain = "BH", Oman = "OM", Yemen = "YE", Uzbekistan = "UZ", Kazakhstan = "KZ", Kyrgyzstan = "KG", ["Kyrgyz Republic"] = "KG", Tajikistan = "TJ", Turkmenistan = "TM", Afghanistan = "AF", Pakistan = "PK", India = "IN", Bangladesh = "BD", ["Sri Lanka"] = "LK", Nepal = "NP", Maldives = "MV", Bhutan = "BT", Thailand = "TH", Vietnam = "VN", Indonesia = "ID", Malaysia = "MY", Philippines = "PH", Singapore = "SG", Myanmar = "MM", Cambodia = "KH", Laos = "LA", Brunei = "BN", ["Brunei Darussalam"] = "BN", ["Timor-Leste"] = "TL", ["East Timor"] = "TL", Mongolia = "MN", ["Hong Kong"] = "HK", ["Chinese Taipei"] = "TW", Taiwan = "TW", Palestine = "PS", Macau = "MO", Australia = "AU", ["New Zealand"] = "NZ", Fiji = "FJ", ["Papua New Guinea"] = "PG", ["Solomon Islands"] = "SB", Vanuatu = "VU", Samoa = "WS", ["American Samoa"] = "AS", Tonga = "TO", ["Cook Islands"] = "CK", ["New Caledonia"] = "NC", Tahiti = "PF", Guam = "GU", ["US Virgin Islands"] = "VI", ["British Virgin Islands"] = "VG", ["IR Iran"] = "IR", ["The Gambia"] = "GM", ["DPR Korea"] = "KP", ["St Kitts and Nevis"] = "KN", ["Hong Kong, China"] = "HK", ["St Vincent and the Grenadines"] = "VC" }, { "Republic of Ireland", "Ireland", "Great Britain", "France", "Germany", "Spain", "Italy", "Portugal", "Netherlands", "Belgium", "Switzerland", "Austria", "Poland", "Sweden", "Norway", "Denmark", "Finland", "Iceland", "Russia", "Ukraine", "Czech Republic", "Czechia", "Slovakia", "Hungary", "Romania", "Croatia", "Serbia", "Slovenia", "Bosnia and Herzegovina", "Bosnia Herzegovina", "Bosnia & Herzegovina", "Bosnia-Herzegovina", "Montenegro", "North Macedonia", "FYR Macedonia", "Macedonia", "Albania", "Greece", "Bulgaria", "Cyprus", "Luxembourg", "Malta", "Andorra", "San Marino", "Monaco", "Liechtenstein", "Kosovo", "Moldova", "Belarus", "Georgia", "Armenia", "Azerbaijan", "Turkey", "Türkiye", "Israel", "Estonia", "Latvia", "Lithuania", "Faroe Islands", "Gibraltar", "Nigeria", "Ghana", "Senegal", "Ivory Coast", "Cote d'Ivoire", "Côte d'Ivoire", "Cameroon", "Mali", "Algeria", "Morocco", "Tunisia", "Egypt", "South Africa", "DR Congo", "Congo DR", "Democratic Republic of the Congo", "Congo", "Congo Republic", "Zambia", "Zimbabwe", "Kenya", "Uganda", "Tanzania", "Ethiopia", "Angola", "Mozambique", "Guinea", "Guinea-Bissau", "Burkina Faso", "Benin", "Togo", "Niger", "Chad", "Gabon", "Gambia", "Sierra Leone", "Liberia", "Mauritania", "Namibia", "Botswana", "Malawi", "Rwanda", "Burundi", "Sudan", "South Sudan", "Libya", "Equatorial Guinea", "Central African Republic", "Cape Verde", "Cabo Verde", "Comoros", "Madagascar", "Mauritius", "Eswatini", "Swaziland", "Lesotho", "Somalia", "Eritrea", "Djibouti", "Seychelles", "Reunion", "Réunion", "São Tomé and Príncipe", "São Tomé e Príncipe", "Sao Tome and Principe", "São Tomé & Príncipe", "Argentina", "Brazil", "Chile", "Uruguay", "Paraguay", "Bolivia", "Peru", "Ecuador", "Colombia", "Venezuela", "Guyana", "Suriname", "French Guiana", "United States", "USA", "Canada", "Mexico", "Costa Rica", "Honduras", "Panama", "Jamaica", "Guatemala", "El Salvador", "Nicaragua", "Trinidad and Tobago", "Trinidad & Tobago", "Haiti", "Cuba", "Dominican Republic", "Belize", "Bahamas", "Barbados", "Curacao", "Curaçao", "Antigua and Barbuda", "Antigua & Barbuda", "Grenada", "Saint Kitts and Nevis", "St Kitts & Nevis", "St. Kitts & Nevis", "Saint Lucia", "St Lucia", "St. Lucia", "Saint Vincent and the Grenadines", "St Vincent & the Grenadines", "St. Vincent & the Grenadines", "Bermuda", "Puerto Rico", "Guadeloupe", "Martinique", "Bonaire", "Sint Maarten", "Aruba", "Cayman Islands", "Montserrat", "Anguilla", "Turks and Caicos Islands", "Dominica", "Saint Barthelemy", "Japan", "Korea Republic", "South Korea", "Korea DPR", "North Korea", "China PR", "China", "Saudi Arabia", "Iran", "Iraq", "Qatar", "United Arab Emirates", "UAE", "Jordan", "Lebanon", "Syria", "Kuwait", "Bahrain", "Oman", "Yemen", "Uzbekistan", "Kazakhstan", "Kyrgyzstan", "Kyrgyz Republic", "Tajikistan", "Turkmenistan", "Afghanistan", "Pakistan", "India", "Bangladesh", "Sri Lanka", "Nepal", "Maldives", "Bhutan", "Thailand", "Vietnam", "Indonesia", "Malaysia", "Philippines", "Singapore", "Myanmar", "Cambodia", "Laos", "Brunei", "Brunei Darussalam", "Timor-Leste", "East Timor", "Mongolia", "Hong Kong", "Chinese Taipei", "Taiwan", "Palestine", "Macau", "Australia", "New Zealand", "Fiji", "Papua New Guinea", "Solomon Islands", "Vanuatu", "Samoa", "American Samoa", "Tonga", "Cook Islands", "New Caledonia", "Tahiti", "Guam", "US Virgin Islands", "British Virgin Islands", "IR Iran", "The Gambia", "DPR Korea", "St Kitts and Nevis", "Hong Kong, China", "St Vincent and the Grenadines" })
	NOT_FIFA = Js.Set.new(Js.alit("Great Britain", "Monaco", "Bonaire", "French Guiana", "Guadeloupe", "Martinique", "Reunion", "Saint Barthelemy", "Sint Maarten"))
	ALL_NATIONALITIES = (function()
		local seen = Js.Set.new()
		local out = Js.alit()
		do
			local _arr1 = Js.aspread(Js.Object.keys(SUBDIVISION_FLAGS), Js.Object.keys(NATIONALITY_ISO))
			local _i2 = 0
			while _i2 < Js.alen(_arr1) do
				_i2 += 1
				local name = _arr1[_i2]
				local key = (if Js.T(SUBDIVISION_FLAGS[name]) then ("sub:" .. name) else NATIONALITY_ISO[name])
				if seen:has(key) then
					do continue end
				end
				seen:add(key)
				if (not NOT_FIFA:has(name)) then
					A.push(out, name)
				end
			end
		end
		do return A.sort(out, function(a, b)
			return S.localeCompare(a, b)
		end) end
	end)()
	exports.ALL_NATIONALITIES = ALL_NATIONALITIES
	SUBDIVISION_FLAGS_LC = Js.Object.fromEntries(A.map(Js.Object.entries(SUBDIVISION_FLAGS), function(_p3)
		local k = _p3[1]
		local v = _p3[2]
		return Js.alit(canonNat(k), v)
	end))
	NATIONALITY_ISO_LC = Js.Object.fromEntries(A.map(Js.Object.entries(NATIONALITY_ISO), function(_p4)
		local k = _p4[1]
		local v = _p4[2]
		return Js.alit(canonNat(k), v)
	end))
	FLAGCDN_SUBDIVISIONS = Js.O({ England = "gb-eng", Scotland = "gb-sct", Wales = "gb-wls", ["Northern Ireland"] = "gb-nir" }, { "England", "Scotland", "Wales", "Northern Ireland" })
	FLAGCDN_SUBDIVISIONS_LC = Js.Object.fromEntries(A.map(Js.Object.entries(FLAGCDN_SUBDIVISIONS), function(_p5)
		local k = _p5[1]
		local v = _p5[2]
		return Js.alit(canonNat(k), v)
	end))
end
