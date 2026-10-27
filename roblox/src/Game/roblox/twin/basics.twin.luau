--!nocheck
--!nolint
-- Generated from roblox/twin/basics.twin.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M__out = import("roblox/twin/_out")
	local names, rows, o, parsed, arr, spliced, removed, total, m, s, counts, d, vals, maybe, kind, risky, Counter
	kind = function(n)
		local r = ""
		local _sw1 = n
		local _ci2 = (if _sw1 == 1 then 1 elseif _sw1 == 2 then 2 elseif _sw1 == 3 then 3 elseif _sw1 == 4 then 4 else 5)
		local _cont3 = false
		repeat
			if _ci2 ~= 0 and _ci2 <= 2 then
				r = r .. "low"
				do break end
			end
			if _ci2 ~= 0 and _ci2 <= 3 then
				r = r .. "three"
			end
			if _ci2 ~= 0 and _ci2 <= 4 then
				r = r .. "-four"
				do break end
			end
			if _ci2 ~= 0 and _ci2 <= 5 then
				r = r .. "other"
			end
		until true
		do return r end
	end
	risky = function(x)
		local _ok4, _err5, _rv6 = pcall(function()
			if (x > 1) then
				error(Js.Error(("too big " .. Js.numstr(x))), 0)
			end
			do return Js.RET, "fine" end
		end)
		local _cok7, _cerr8, _crv9 = true, nil, nil
		if not _ok4 then
			_cok7, _cerr8, _crv9 = pcall(function(_err5)
				local e = Js.caught(_err5)
				do return Js.RET, ("caught: " .. e.message) end
			end, _err5)
			_ok4 = true
			_err5, _rv6 = nil, nil
		end
		total += 1
		if not _ok4 then error(_err5, 0) end
		if not _cok7 then error(_cerr8, 0) end
		if _cerr8 == Js.RET then return _crv9 end
		if _err5 == Js.RET then return _rv6 end
	end
	M__out.out(1, 1.5, (0.1 + 0.2), (1 / 3), 1e+21, 1e-7, -0.000001, 123456789012, (2 ^ 53), math.fmod(-7, 3), math.fmod(7, -3), math.fmod(5.5, 2))
	M__out.out(N.toFixed(1.005, 2), N.toFixed(2.5, 0), N.toFixed(-1.5, 0), N.toFixed(0.000001234, 8), N.toString(255, 16), N.toString(35, 36))
	M__out.out(Math.round(2.5), Math.round(-2.5), Math.round(-0.4), Math.max(), Math.min(1, 2, -3), Math.trunc(-4.7), Math.sign(-3))
	M__out.out(Js.parseInt("42px"), Js.parseInt("0x1f"), Js.parseFloat("3.25abc"), Js.Number(""), Js.Number("12"), Js.Number("1e3"), Js.isNaN(Js.Number("x")))
	M__out.out(Js.numstr(12), Js.numstr(1.25), (Js.numstr(7) .. "-" .. "x" .. "-" .. Js.str(true)), (("a" .. Js.numstr(1)) .. Js.numstr(2)), (Js.numstr((1 + 2)) .. "a"))
	M__out.out(Js.bor(5, 0), Js.ushr(-5, 0), Js.shl(1, 31), Js.bor(Js.bxor(4294967295, 1), 0), Math.imul(1831565813, 1831565813), Js.bnot(5))
	names = Js.alit("Atlético Madrid", "Ødegaard", "Müller", "Kanté", "Zürich", "zebra", "apple", "Éclair", "eclair", "Æsir")
	M__out.out(A.map(names, function(n)
		return S.len(n)
	end))
	M__out.out(A.map(names, function(n)
		return S.toUpperCase(n)
	end))
	M__out.out(A.map(names, function(n)
		return S.replace(S.normalize(n, "NFD"), Js.re("[̀-ͯ]", "g"), "")
	end))
	M__out.out(A.sort(Js.aspread(names)))
	M__out.out(A.sort(Js.aspread(names), function(a, b)
		return S.localeCompare(a, b)
	end))
	M__out.out(S.slice("Bournemouth", -5), S.slice("Bournemouth", 2, 5), S.charCodeAt("abc", 1), S.charCodeAt("Kanté", 4), S.indexOf("hello", "l"), S.indexOf("Kanté x", "x"))
	M__out.out(S.split("a,b,,c", ","), S.split("one  two three", Js.re("\\s+", "")), S.padStart("x", 3, "ab"), S.padStart("7", 2, "0"), S.trim("  hi  "), S["repeat"]("ab", 3))
	M__out.out(S.replace("Manchester United", Js.re("^(\\w+)\\s+(\\w+)$", ""), "$2 $1"), S.replaceAll("a-b-c", "-", "+"), S.replace("aaa", Js.re("a", "g"), function(m)
		return S.toUpperCase(m)
	end))
	M__out.out((function() local _v = S.match("Matchday 12 of 38", Js.re("Matchday (\\d+)", "")); if _v == nil then return nil end; _v = _v[2]; return _v end)(), Js.re("^rg\\d+\\.", ""):test("rg12.x"), Js.re("^rg\\d+\\.", ""):test("x"), S.replace("AFC Wimbledon", Js.re("^(AFC|FC)\\s+", "i"), ""))
	M__out.out(A.join(A.map(S.split("The quick brown fox", " "), function(w)
		return S.idx(w, 0)
	end), ""), S.at("abc", -1), S.idx(("Hello"), 1))
	rows = Js.alit(Js.O({ club = "B", pts = 3 }, { "club", "pts" }), Js.O({ club = "A", pts = 3 }, { "club", "pts" }), Js.O({ club = "C", pts = 1 }, { "club", "pts" }), Js.O({ club = "D", pts = 3 }, { "club", "pts" }), Js.O({ club = "E", pts = 1 }, { "club", "pts" }))
	M__out.out(A.join(A.map(A.sort(A.slice(rows), function(a, b)
		return (b.pts - a.pts)
	end), function(r)
		return r.club
	end), ""))
	M__out.out(A.sort(Js.alit(10, 9, 1, 100, 25)), A.sort(Js.alit(3, 1, 2), function(a, b)
		return (a - b)
	end), A.sort(Js.alit(nil, 3, 1)))
	o = Js.O({ b = 1, a = 2 }, { "b", "a" })
	o["10"] = 3
	o["2"] = 4
	o.c = 5
	Js.del(o, "a")
	o.a = 6
	M__out.out(Js.Object.keys(o), Js.Object.values(o), Js.JSON.stringify(o))
	M__out.out(Js.Object.entries(Js.O({ x = 1, y = Js.alit(1, 2, Js.O({ z = nil }, { "z" })) }, { "x", "y" })))
	M__out.out(Js.JSON.stringify(Js.O({ a = nil, b = Js.alit(nil, 1), c = "q\"\n", d = 1.5e+300, e = (0/0) }, { "a", "b", "c", "d", "e" })))
	M__out.out(Js.JSON.stringify(Js.O({ a = 1, b = Js.O({ c = Js.alit(1, 2) }, { "c" }) }, { "a", "b" }), nil, 2))
	parsed = Js.JSON.parse("{\"z\":1,\"a\":[true,false,null,\"x\\u00e9\"],\"m\":{\"q\":2.5}}")
	M__out.out(Js.Object.keys(parsed), Js.idx(parsed, "a"), Js.idx(Js.idx(parsed, "m"), "q"))
	M__out.out(Js.ospread(Js.O({ a = 1, b = 2 }, { "a", "b" }), Js.O({ b = 3, c = 4 }, { "b", "c" })))
	arr = Js.alit(1, 2, 3, nil, nil)
	A.set(arr, 5, 6)
	M__out.out(Js.alen(arr), A.map(arr, function(x)
		return (if x ~= nil then x else 0)
	end), A.filter(arr, Js.Boolean), A.indexOf(arr, 3), A.includes(arr, nil))
	spliced = Js.alit(1, 2, 3, 4, 5)
	removed = A.splice(spliced, 1, 2, 9, 9, 9)
	M__out.out(spliced, removed, A.slice(spliced, -2), A.flat(Js.alit(1, Js.alit(2, Js.alit(3, Js.alit(4)))), 2), A.flatMap(Js.alit(Js.alit(1, 2), Js.alit(3)), function(x)
		return x
	end))
	M__out.out(A.reduce(Js.alit(1, 2, 3), function(s, x)
		return (s + x)
	end, 0), A.findIndex(Js.alit(1, 2, 3), function(x)
		return (x == 2)
	end), A.find(Js.alit(1, 2, 3), function(x)
		return (x > 5)
	end), Js.Array.from(Js.O({ length = 3 }, { "length" }), function(_, i)
		return (i * i)
	end))
	total = 0
	for i = 0, 4 do
		if (i == 2) then
			do continue end
		end
		total += i
	end
	for _ok10, _v11 in Js.iter(A.entries(Js.alit("a", "b"))) do
		local _e12 = _v11
		local i = _e12[1]
		local v = _e12[2]
		total += (i + S.len(v))
	end
	M__out.out(total)
	m = Js.Map.new(Js.alit(Js.alit("x", 1), Js.alit("y", 2)))
	m:set("a", 3)
	m:delete("x")
	m:set("x", 4)
	M__out.out(Js.aspread(m:keys()), Js.aspread(m:values()), m.size, m:get("y"), m:has("q"))
	s = Js.Set.new(Js.alit(3, 1, 3, 2))
	M__out.out(Js.aspread(s), s.size, s:has(2))
	counts = Js.Map.new()
	do
		local _arr13 = Js.alit(1, 2, 1, 3, 1)
		local _i14 = 0
		while _i14 < Js.alen(_arr13) do
			_i14 += 1
			local n = _arr13[_i14]
			counts:set(n, ((counts:get(n) or 0) + 1))
		end
	end
	M__out.out(Js.aspread(counts:entries()))
	d = Js.Date.new(Js.Date.UTC(2026, 7, 1))
	M__out.out(d:getUTCDay(), d:getUTCFullYear(), d:getUTCMonth(), d:toISOString(), Js.Date.new(Js.Date.UTC(2027, 1, 29)):toISOString())
	M__out.out(Js.Date.new("2026-10-27"):getTime(), Js.Date.UTC(2026, 13, 1), Js.Date.new((d:getTime() + (86400000 * 40))):getUTCDate())
	vals = Js.alit(0, "", "0", (0/0), nil, nil, Js.alit(), Js.O({}, nil), false, -1)
	M__out.out(A.join(A.map(vals, function(v)
		return (if Js.T(v) then "T" else "F")
	end), ""))
	maybe = nil
	M__out.out((if maybe ~= nil then maybe else 7), (if Js.T(0) then 0 else 9), (if 0 ~= nil then 0 else 9), (if Js.T("") then "" else "x"), (if Js.T("y") then "z" else "y"), (if nil ~= nil then nil else "n"))
	M__out.out(A.map(Js.alit(1, 2, 3, 4, 5), kind))
	M__out.out(risky(1), risky(5), total)
	Counter = {}
	Counter.__jsclass = true
	Counter.__getters = {}
	Counter.__index = function(t, k) local g = Counter.__getters[k]; if g then return g(t) end; return Counter[k] end
	Counter.new = function(step)
		local self = setmetatable({}, Counter)
		self.step = step
		self["n"] = 0
		return self
	end
	Counter["add"] = function(self)
		self.n += self.step
		do return self end
	end
	Counter.__getters["value"] = function(self)
		do return self.n end
	end
	M__out.out(Counter.new(3):add():add().value)
end
