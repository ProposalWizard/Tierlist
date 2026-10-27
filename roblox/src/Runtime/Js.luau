--!nocheck
--[[
  Js: the support layer that makes Roblox Luau behave like the website's
  JavaScript, so converted website code gives the same results.

  Every converted file (roblox/src/Game/**) calls into this. Rules it copies:
  - Lists count from 0 in the website; Luau tables count from 1. The converter
    adds the 1; this file keeps each list's true length (a list may hold gaps).
  - Objects keep the order their keys were first set (JavaScript does, Luau
    does not). Number-like keys come first, smallest first, as in JavaScript.
  - Text counts in UTF-16 units, like JavaScript ("é" is 1, "😀" is 2).
  - Numbers print like JavaScript (3 not 3.0, 0.1 not 0.10000000000000001).
  - Sorting is stable, like JavaScript.

  Known differences (none matter to the game's rules):
  - null and undefined are both nil, so {a: null} saves without `a`.
  - A true gap in a list (writing past its end) is an empty slot here.
  - Dates are UTC (Roblox servers run on UTC); the game only uses UTC.

  Hand-written. Tested by roblox/tools/twin (website vs Roblox, same output).
]]

local Js = {}

local bit32 = bit32
local floor, huge, fmod = math.floor, math.huge, math.fmod
local sbyte, schar, ssub, sfind, sformat, srep = string.byte, string.char, string.sub, string.find, string.format, string.rep
local tinsert, tconcat, tremove = table.insert, table.concat, table.remove
local rawget, rawset, setmetatable, getmetatable, type, select, tostring, tonumber, pairs =
	rawget, rawset, setmetatable, getmetatable, type, select, tostring, tonumber, pairs

local NULL_SENTINEL = {}

-- ─────────────────────────────────────────────────────────────── arrays ──

local LEN = setmetatable({}, { __mode = "k" })
local ARR_MT = { __jsarray = true }
Js.ARR_MT = ARR_MT

local function isArray(t)
	return type(t) == "table" and getmetatable(t) == ARR_MT
end
Js.isArray = isArray

local function mkarr(t, n)
	setmetatable(t, ARR_MT)
	LEN[t] = n or #t
	return t
end
Js.mkarr = mkarr

local function alen(a)
	local n = LEN[a]
	if n == nil then
		n = #a
		LEN[a] = n
	end
	return n
end
Js.alen = alen

-- An array literal: Js.alit(a, b, c) keeps nils (holes) and the true length.
function Js.alit(...)
	local n = select("#", ...)
	local t = { ... }
	setmetatable(t, ARR_MT)
	LEN[t] = n
	return t
end

-- ────────────────────────────────────────────────────────────── objects ──

local ORDER = setmetatable({}, { __mode = "k" })
local OBJ_MT = {}
OBJ_MT.__newindex = function(t, k, v)
	local o = ORDER[t]
	if o then
		o[#o + 1] = k
	end
	rawset(t, k, v)
end
Js.OBJ_MT = OBJ_MT

-- An object literal: Js.O({a = 1, b = 2}, {"a", "b"}).
local function O(t, keys)
	ORDER[t] = keys and table.clone(keys) or {}
	return setmetatable(t, OBJ_MT)
end
Js.O = O

local function isObj(t)
	return type(t) == "table" and getmetatable(t) == OBJ_MT
end
Js.isObj = isObj

local function isIndexKey(k)
	if type(k) == "number" then
		return k >= 0 and k == floor(k) and k < 4294967295
	end
	if type(k) == "string" then
		if k == "0" then
			return true
		end
		local b = sbyte(k, 1)
		if b == nil or b < 49 or b > 57 or #k > 10 then
			return false
		end
		if not sfind(k, "^%d+$") then
			return false
		end
		return tonumber(k) < 4294967295
	end
	return false
end

-- Object keys in JavaScript order, as strings.
local numstr -- forward
local function okeys(t)
	local out, ints, seen = {}, {}, {}
	local order = ORDER[t]
	if order then
		local strs = {}
		for _, k in order do
			if not seen[k] then
				seen[k] = true
				if isIndexKey(k) then
					ints[#ints + 1] = tonumber(k)
				else
					strs[#strs + 1] = k
				end
			end
		end
		-- keys set with rawset (or before ORDER existed) still count
		for k in pairs(t) do
			if not seen[k] then
				seen[k] = true
				if isIndexKey(k) then
					ints[#ints + 1] = tonumber(k)
				elseif type(k) == "string" then
					strs[#strs + 1] = k
				end
			end
		end
		table.sort(ints)
		for _, i in ints do
			out[#out + 1] = numstr(i)
		end
		for _, s in strs do
			out[#out + 1] = s
		end
	elseif isArray(t) then
		for i = 1, alen(t) do
			out[i] = numstr(i - 1)
		end
	else
		local strs = {}
		for k in pairs(t) do
			if isIndexKey(k) then
				ints[#ints + 1] = tonumber(k)
			elseif type(k) == "string" then
				strs[#strs + 1] = k
			end
		end
		table.sort(ints)
		table.sort(strs)
		for _, i in ints do
			out[#out + 1] = numstr(i)
		end
		for _, s in strs do
			out[#out + 1] = s
		end
	end
	return mkarr(out, #out)
end
Js.okeys = okeys

-- Reading a key that came back from Object.keys: number-like keys may be
-- stored as numbers (data tables) or strings.
local function oget(t, k)
	local v = rawget(t, k)
	if v == nil and type(k) == "string" and isIndexKey(k) then
		v = rawget(t, tonumber(k))
	end
	return v
end
Js.oget = oget

function Js.del(t, k)
	if isArray(t) then
		if type(k) == "number" then
			t[k + 1] = nil
		end
		return true
	end
	rawset(t, k, nil)
	local o = ORDER[t]
	if o then
		for i = #o, 1, -1 do
			if o[i] == k then
				tremove(o, i)
			end
		end
	end
	return true
end

-- ────────────────────────────────────────────────────────────── numbers ──

local function shortest(n)
	-- digits and exponent of the shortest form that reads back as n
	for p = 1, 17 do
		local s = sformat("%." .. (p - 1) .. "e", n)
		if tonumber(s) == n then
			return s
		end
	end
	return sformat("%.16e", n)
end

numstr = function(n)
	if n ~= n then
		return "NaN"
	end
	if n == huge then
		return "Infinity"
	end
	if n == -huge then
		return "-Infinity"
	end
	if n == 0 then
		return "0"
	end
	if n == floor(n) and n > -1e15 and n < 1e15 then
		return sformat("%d", n)
	end
	local neg = n < 0
	local s = shortest(neg and -n or n)
	local mant, ex = string.match(s, "^([%d%.]+)e([-+]%d+)$")
	local digits = string.gsub(mant, "%.", "")
	digits = string.gsub(digits, "0+$", "")
	if digits == "" then
		digits = "0"
	end
	local k = #digits
	local e = tonumber(ex) + 1 -- position of the decimal point
	local out
	if k <= e and e <= 21 then
		out = digits .. srep("0", e - k)
	elseif 0 < e and e <= 21 then
		out = ssub(digits, 1, e) .. "." .. ssub(digits, e + 1)
	elseif -6 < e and e <= 0 then
		out = "0." .. srep("0", -e) .. digits
	else
		local ee = e - 1
		local m = ssub(digits, 1, 1)
		if k > 1 then
			m = m .. "." .. ssub(digits, 2)
		end
		out = m .. "e" .. (ee >= 0 and "+" or "-") .. tostring(math.abs(ee))
	end
	return neg and ("-" .. out) or out
end
Js.numstr = numstr

-- String(x)
local function str(x)
	local t = type(x)
	if t == "string" then
		return x
	elseif t == "number" then
		return numstr(x)
	elseif t == "nil" then
		return "undefined"
	elseif t == "boolean" then
		return x and "true" or "false"
	elseif t == "table" then
		if isArray(x) then
			local parts = {}
			for i = 1, alen(x) do
				local v = x[i]
				parts[i] = (v == nil) and "" or str(v)
			end
			return tconcat(parts, ",")
		end
		local mt = getmetatable(x)
		if mt and mt.__tostring then
			return tostring(x)
		end
		return "[object Object]"
	elseif t == "function" then
		return "function"
	end
	return tostring(x)
end
Js.str = str
Js.String = function(x)
	return str(x)
end

-- JavaScript truthiness.
function Js.T(x)
	return x ~= nil and x ~= false and x ~= 0 and x ~= "" and x == x
end
Js.Boolean = Js.T

local function tonum(x)
	local t = type(x)
	if t == "number" then
		return x
	elseif t == "nil" then
		return 0 / 0
	elseif t == "boolean" then
		return x and 1 or 0
	elseif t == "string" then
		local s = string.match(x, "^%s*(.-)%s*$")
		if s == "" then
			return 0
		end
		if s == "Infinity" or s == "+Infinity" then
			return huge
		end
		if s == "-Infinity" then
			return -huge
		end
		if sfind(s, "^[-+]?%d+%.?%d*[eE]?[-+]?%d*$") or sfind(s, "^[-+]?%.%d+[eE]?[-+]?%d*$") or sfind(s, "^0[xX]%x+$") then
			local v = tonumber(s)
			if v then
				return v
			end
		end
		return 0 / 0
	elseif t == "table" then
		if isArray(x) then
			local n = alen(x)
			if n == 0 then
				return 0
			end
			if n == 1 then
				return tonum(str(x[1]))
			end
		end
		local mt = getmetatable(x)
		if mt and mt.__jsvalueOf then
			return mt.__jsvalueOf(x)
		end
		return 0 / 0
	end
	return 0 / 0
end
Js.tonum = tonum
Js.Number = function(x)
	if x == nil then
		return 0
	end
	return tonum(x)
end

-- a + b when the types are not known in advance
function Js.add(a, b)
	if type(a) == "number" and type(b) == "number" then
		return a + b
	end
	if type(a) == "string" or type(b) == "string" or type(a) == "table" or type(b) == "table" then
		return str(a) .. str(b)
	end
	return tonum(a) + tonum(b)
end

function Js.typeof(x)
	local t = type(x)
	if t == "nil" then
		return "undefined"
	elseif t == "table" then
		return "object"
	end
	return t -- number, string, boolean, function
end

-- JavaScript's % (sign follows the left side)
function Js.mod(a, b)
	return fmod(a, b)
end

local function toInt32(x)
	if x ~= x or x == huge or x == -huge then
		return 0
	end
	x = (x >= 0) and floor(x) or -floor(-x)
	x = x % 4294967296
	if x >= 2147483648 then
		x -= 4294967296
	end
	return x
end
local function toUint32(x)
	if x ~= x or x == huge or x == -huge then
		return 0
	end
	x = (x >= 0) and floor(x) or -floor(-x)
	return x % 4294967296
end
Js.toInt32, Js.toUint32 = toInt32, toUint32

function Js.bor(a, b)
	return toInt32(bit32.bor(toUint32(a), toUint32(b)))
end
function Js.band(a, b)
	return toInt32(bit32.band(toUint32(a), toUint32(b)))
end
function Js.bxor(a, b)
	return toInt32(bit32.bxor(toUint32(a), toUint32(b)))
end
function Js.bnot(a)
	return toInt32(bit32.bnot(toUint32(a)))
end
function Js.shl(a, b)
	return toInt32(bit32.lshift(toUint32(a), toUint32(b) % 32))
end
function Js.shr(a, b) -- >>
	return toInt32(bit32.arshift(toUint32(a), toUint32(b) % 32))
end
function Js.ushr(a, b) -- >>>
	return bit32.rshift(toUint32(a), toUint32(b) % 32)
end

-- ───────────────────────────────────────────────────────────────── Math ──

local JMath = {}
Js.Math = JMath
JMath.PI = math.pi
JMath.E = math.exp(1)
JMath.LN2 = math.log(2)
JMath.LN10 = math.log(10)
JMath.LOG2E = 1 / math.log(2)
JMath.LOG10E = 1 / math.log(10)
JMath.SQRT2 = math.sqrt(2)
JMath.SQRT1_2 = math.sqrt(0.5)
JMath.floor = function(x)
	return floor(x)
end
JMath.ceil = function(x)
	return math.ceil(x)
end
JMath.abs = function(x)
	return math.abs(x)
end
JMath.sqrt = function(x)
	if x < 0 then
		return 0 / 0
	end
	return math.sqrt(x)
end
JMath.cbrt = function(x)
	if x < 0 then
		return -((-x) ^ (1 / 3))
	end
	return x ^ (1 / 3)
end
JMath.pow = function(a, b)
	return a ^ b
end
JMath.exp = math.exp
JMath.log = function(x)
	if x < 0 then
		return 0 / 0
	end
	if x == 0 then
		return -huge
	end
	return math.log(x)
end
JMath.log2 = function(x)
	return JMath.log(x) / math.log(2)
end
JMath.log10 = function(x)
	if x <= 0 then
		return JMath.log(x)
	end
	return math.log10(x)
end
JMath.log1p = function(x)
	return JMath.log(1 + x)
end
JMath.sin, JMath.cos, JMath.tan = math.sin, math.cos, math.tan
JMath.asin, JMath.acos, JMath.atan = math.asin, math.acos, math.atan
JMath.atan2 = function(y, x)
	return math.atan2(y, x)
end
JMath.sinh, JMath.cosh, JMath.tanh = math.sinh, math.cosh, math.tanh
JMath.round = function(x)
	if x ~= x or x == huge or x == -huge then
		return x
	end
	local f = floor(x)
	if x - f >= 0.5 then
		return f + 1
	end
	return f
end
JMath.trunc = function(x)
	if x ~= x or x == huge or x == -huge then
		return x
	end
	return x >= 0 and floor(x) or -floor(-x)
end
JMath.sign = function(x)
	if x ~= x then
		return x
	end
	if x > 0 then
		return 1
	elseif x < 0 then
		return -1
	end
	return x
end
JMath.max = function(...)
	local n = select("#", ...)
	local m = -huge
	for i = 1, n do
		local v = select(i, ...)
		if v ~= v then
			return v
		end
		if v > m then
			m = v
		end
	end
	return m
end
JMath.min = function(...)
	local n = select("#", ...)
	local m = huge
	for i = 1, n do
		local v = select(i, ...)
		if v ~= v then
			return v
		end
		if v < m then
			m = v
		end
	end
	return m
end
JMath.hypot = function(...)
	local s = 0
	for i = 1, select("#", ...) do
		local v = select(i, ...)
		s += v * v
	end
	return math.sqrt(s)
end
JMath.random = function()
	return math.random()
end
JMath.imul = function(a, b)
	a, b = toUint32(a), toUint32(b)
	local ah, al = bit32.rshift(a, 16), bit32.band(a, 0xffff)
	local bh, bl = bit32.rshift(b, 16), bit32.band(b, 0xffff)
	local lo = al * bl
	local mid = bit32.band(ah * bl + al * bh, 0xffff)
	return toInt32((lo + mid * 65536) % 4294967296)
end
JMath.clz32 = function(x)
	return bit32.countlz(toUint32(x))
end
JMath.fround = function(x)
	return x
end

-- ─────────────────────────────────────────────────────────────── Number ──

local JNumber = {}
Js.NumberNS = JNumber
JNumber.EPSILON = 2.220446049250313e-16
JNumber.MAX_SAFE_INTEGER = 9007199254740991
JNumber.MIN_SAFE_INTEGER = -9007199254740991
JNumber.MAX_VALUE = 1.7976931348623157e308
JNumber.MIN_VALUE = 5e-324
JNumber.POSITIVE_INFINITY = huge
JNumber.NEGATIVE_INFINITY = -huge
JNumber.NaN = 0 / 0
JNumber.isFinite = function(x)
	return type(x) == "number" and x == x and x ~= huge and x ~= -huge
end
JNumber.isNaN = function(x)
	return type(x) == "number" and x ~= x
end
JNumber.isInteger = function(x)
	return JNumber.isFinite(x) and x == floor(x)
end
JNumber.isSafeInteger = function(x)
	return JNumber.isInteger(x) and math.abs(x) <= 9007199254740991
end

function Js.isNaN(x)
	x = tonum(x)
	return x ~= x
end
function Js.isFinite(x)
	x = tonum(x)
	return x == x and x ~= huge and x ~= -huge
end

function Js.parseFloat(s)
	s = str(s)
	local m = string.match(s, "^%s*([-+]?%d*%.?%d+[eE][-+]?%d+)") or string.match(s, "^%s*([-+]?%d+%.?%d*)")
		or string.match(s, "^%s*([-+]?%.%d+)")
	if m then
		return tonumber(m)
	end
	if string.match(s, "^%s*%+?Infinity") then
		return huge
	end
	if string.match(s, "^%s*%-Infinity") then
		return -huge
	end
	return 0 / 0
end
JNumber.parseFloat = Js.parseFloat

local DIGITS = "0123456789abcdefghijklmnopqrstuvwxyz"
function Js.parseInt(s, radix)
	s = str(s)
	s = string.match(s, "^%s*(.-)$")
	local sign = 1
	local c = ssub(s, 1, 1)
	if c == "-" then
		sign = -1
		s = ssub(s, 2)
	elseif c == "+" then
		s = ssub(s, 2)
	end
	radix = radix and toInt32(radix) or 0
	if radix == 0 then
		radix = 10
		if sfind(s, "^0[xX]") then
			radix = 16
			s = ssub(s, 3)
		end
	elseif radix == 16 and sfind(s, "^0[xX]") then
		s = ssub(s, 3)
	end
	if radix < 2 or radix > 36 then
		return 0 / 0
	end
	local v, any = 0, false
	for i = 1, #s do
		local d = sfind(DIGITS, string.lower(ssub(s, i, i)), 1, true)
		if not d or d > radix then
			break
		end
		v = v * radix + (d - 1)
		any = true
	end
	if not any then
		return 0 / 0
	end
	return sign * v
end
JNumber.parseInt = Js.parseInt

local N = {}
Js.N = N
function N.toFixed(x, d)
	d = d or 0
	if x ~= x then
		return "NaN"
	end
	if math.abs(x) >= 1e21 then
		return numstr(x)
	end
	local neg = x < 0
	local ax = neg and -x or x
	local s = sformat("%." .. d .. "f", ax)
	-- an exact tie rounds up (JavaScript), not to even (C)
	local long = sformat("%." .. (d + 30) .. "f", ax)
	local tail = ssub(long, #long - 29)
	if sfind(tail, "^50*$") then
		local trunc = ssub(long, 1, #long - 30)
		if ssub(trunc, -1) == "." then
			trunc = ssub(trunc, 1, -2)
		end
		-- add one in the last place
		local digits = {}
		for i = 1, #trunc do
			digits[i] = ssub(trunc, i, i)
		end
		local i = #digits
		while i >= 1 do
			local c = digits[i]
			if c ~= "." then
				if c == "9" then
					digits[i] = "0"
				else
					digits[i] = tostring(tonumber(c) + 1)
					break
				end
			end
			i -= 1
		end
		s = tconcat(digits)
		if i < 1 then
			s = "1" .. s
		end
	end
	if neg then
		s = "-" .. s
	end
	if sfind(s, "^%-0%.?0*$") then
		s = ssub(s, 2)
	end
	return s
end
function N.toString(x, radix)
	if radix == nil or radix == 10 then
		return numstr(x)
	end
	if x ~= x then
		return "NaN"
	end
	local neg = x < 0
	if neg then
		x = -x
	end
	local ip = floor(x)
	local fp = x - ip
	local out = {}
	if ip == 0 then
		out[1] = "0"
	end
	while ip > 0 do
		local d = ip % radix
		tinsert(out, 1, ssub(DIGITS, d + 1, d + 1))
		ip = floor(ip / radix)
	end
	local s = tconcat(out)
	if fp > 0 then
		local frac = {}
		for _ = 1, 20 do
			fp *= radix
			local d = floor(fp)
			frac[#frac + 1] = ssub(DIGITS, d + 1, d + 1)
			fp -= d
			if fp == 0 then
				break
			end
		end
		s = s .. "." .. tconcat(frac)
	end
	return neg and ("-" .. s) or s
end
function N.toPrecision(x, p)
	if p == nil then
		return numstr(x)
	end
	local e = (x == 0) and 0 or floor(math.log10(math.abs(x)))
	if e < -6 or e >= p then
		local s = sformat("%." .. (p - 1) .. "e", x)
		local m, ex = string.match(s, "^(.-)e([-+]%d+)$")
		return m .. "e" .. (tonumber(ex) >= 0 and "+" or "-") .. tostring(math.abs(tonumber(ex)))
	end
	return sformat("%." .. math.max(0, p - 1 - e) .. "f", x)
end
function N.toLocaleString(x, _locale, opts)
	-- en-GB grouping: 1,234,567.89
	local maxf = opts and opts.maximumFractionDigits
	local minf = opts and opts.minimumFractionDigits or 0
	if maxf == nil then
		maxf = math.max(minf, 3)
	end
	local s = N.toFixed(x, maxf)
	local neg = ssub(s, 1, 1) == "-"
	if neg then
		s = ssub(s, 2)
	end
	local ip, fp = string.match(s, "^(%d+)%.?(%d*)$")
	if fp then
		fp = string.gsub(fp, "0+$", "")
		while #fp < minf do
			fp = fp .. "0"
		end
	end
	ip = string.reverse((string.gsub(string.reverse(ip), "(%d%d%d)", "%1,")))
	if ssub(ip, 1, 1) == "," then
		ip = ssub(ip, 2)
	end
	local out = ip
	if fp and fp ~= "" then
		out = out .. "." .. fp
	end
	return neg and ("-" .. out) or out
end
function N.valueOf(x)
	return x
end

-- ──────────────────────────────────────────────────────────────── text ──

local S = {}
Js.S = S

local function isAscii(s)
	return not sfind(s, "[\128-\255]")
end

-- UTF-8 text -> list of UTF-16 code units
local UNITS_CACHE = setmetatable({}, { __mode = "k" })
local function units(s)
	local out, n = {}, 0
	for _, cp in utf8.codes(s) do
		if cp >= 0x10000 then
			cp -= 0x10000
			n += 1
			out[n] = 0xD800 + floor(cp / 0x400)
			n += 1
			out[n] = 0xDC00 + cp % 0x400
		else
			n += 1
			out[n] = cp
		end
	end
	return out, n
end
local function safeUnits(s)
	local ok, u, n = pcall(units, s)
	if ok then
		return u, n
	end
	-- not valid UTF-8: treat bytes as units
	local out = {}
	for i = 1, #s do
		out[i] = sbyte(s, i)
	end
	return out, #s
end
Js.units = safeUnits

-- UTF-16 code units -> UTF-8 text (units i..j, 1-based)
local function fromUnits(u, i, j)
	local parts, n = {}, 0
	local k = i
	while k <= j do
		local c = u[k]
		if c >= 0xD800 and c <= 0xDBFF and k < j and u[k + 1] >= 0xDC00 and u[k + 1] <= 0xDFFF then
			c = 0x10000 + (c - 0xD800) * 0x400 + (u[k + 1] - 0xDC00)
			k += 1
		elseif c >= 0xD800 and c <= 0xDFFF then
			c = 0xFFFD
		end
		n += 1
		parts[n] = utf8.char(c)
		k += 1
	end
	return tconcat(parts)
end
Js.fromUnits = fromUnits

local function slen(s)
	if isAscii(s) then
		return #s
	end
	local _, n = safeUnits(s)
	return n
end
S.len = slen

-- substring by UTF-16 unit positions [i, j) 0-based, already clamped
local function usub(s, i, j)
	if j <= i then
		return ""
	end
	if isAscii(s) then
		return ssub(s, i + 1, j)
	end
	local u = safeUnits(s)
	return fromUnits(u, i + 1, j)
end

-- byte offset (1-based) -> unit offset (0-based)
local function byteToUnit(s, b)
	if isAscii(s) then
		return b - 1
	end
	return slen(ssub(s, 1, b - 1))
end
-- unit offset (0-based) -> byte offset (1-based)
local function unitToByte(s, u)
	if isAscii(s) then
		return u + 1
	end
	return #usub(s, 0, u) + 1
end

local function relIndex(i, len, default)
	if i == nil then
		return default
	end
	i = tonum(i)
	if i ~= i then
		return 0
	end
	i = JMath.trunc(i)
	if i < 0 then
		i = math.max(0, len + i)
	end
	return math.min(i, len)
end

function S.slice(s, a, b)
	local n = slen(s)
	local i = relIndex(a, n, 0)
	local j = relIndex(b, n, n)
	return usub(s, i, j)
end
function S.substring(s, a, b)
	local n = slen(s)
	local function cl(x, d)
		if x == nil then
			return d
		end
		x = tonum(x)
		if x ~= x or x < 0 then
			return 0
		end
		return math.min(floor(x), n)
	end
	local i, j = cl(a, 0), cl(b, n)
	if i > j then
		i, j = j, i
	end
	return usub(s, i, j)
end
function S.substr(s, a, len)
	local n = slen(s)
	local i = relIndex(a, n, 0)
	local l = (len == nil) and (n - i) or math.max(0, math.min(floor(len), n - i))
	return usub(s, i, i + l)
end
function S.charAt(s, i)
	i = i or 0
	local n = slen(s)
	if i < 0 or i >= n then
		return ""
	end
	return usub(s, i, i + 1)
end
-- s[i]
function S.idx(s, i)
	if type(i) ~= "number" or i < 0 or i ~= floor(i) or i >= slen(s) then
		return nil
	end
	return usub(s, i, i + 1)
end
function S.at(s, i)
	local n = slen(s)
	i = JMath.trunc(i or 0)
	if i < 0 then
		i += n
	end
	if i < 0 or i >= n then
		return nil
	end
	return usub(s, i, i + 1)
end
function S.charCodeAt(s, i)
	i = i or 0
	if isAscii(s) then
		return sbyte(s, i + 1) or (0 / 0)
	end
	local u = safeUnits(s)
	return u[i + 1] or (0 / 0)
end
function S.codePointAt(s, i)
	i = i or 0
	local u, n = safeUnits(s)
	local c = u[i + 1]
	if c == nil then
		return nil
	end
	if c >= 0xD800 and c <= 0xDBFF and i + 2 <= n then
		local d = u[i + 2]
		if d >= 0xDC00 and d <= 0xDFFF then
			return 0x10000 + (c - 0xD800) * 0x400 + (d - 0xDC00)
		end
	end
	return c
end
function S.indexOf(s, sub, from)
	sub = str(sub)
	local n = slen(s)
	from = math.min(math.max(from and JMath.trunc(tonum(from)) or 0, 0), n)
	local b = sfind(s, sub, unitToByte(s, from), true)
	if not b then
		return -1
	end
	return byteToUnit(s, b)
end
function S.lastIndexOf(s, sub, from)
	sub = str(sub)
	local last = -1
	local start = 1
	local limit = from and unitToByte(s, math.max(0, from)) or huge
	while true do
		local b = sfind(s, sub, start, true)
		if not b or b > limit then
			break
		end
		last = b
		start = b + 1
	end
	if last == -1 then
		return -1
	end
	return byteToUnit(s, last)
end
function S.includes(s, sub, from)
	return S.indexOf(s, sub, from) ~= -1
end
function S.startsWith(s, sub, pos)
	sub = str(sub)
	if pos and pos > 0 then
		s = S.slice(s, pos)
	end
	return ssub(s, 1, #sub) == sub
end
function S.endsWith(s, sub, endPos)
	sub = str(sub)
	if endPos then
		s = S.slice(s, 0, endPos)
	end
	return sub == "" or ssub(s, -#sub) == sub
end

-- case maps for ASCII, Latin-1 and Latin Extended-A
local UPPER, LOWER = {}, {}
for c = 0xE0, 0xFE do
	if c ~= 0xF7 then
		UPPER[c] = c - 32
		LOWER[c - 32] = c
	end
end
UPPER[0xFF] = 0x178
LOWER[0x178] = 0xFF
UPPER[0xB5] = 0x39C
for c = 0x100, 0x137, 2 do
	UPPER[c + 1] = c
	LOWER[c] = c + 1
end
LOWER[0x130] = 0x69
UPPER[0x131] = 0x49
for c = 0x139, 0x148, 2 do
	UPPER[c + 1] = c
	LOWER[c] = c + 1
end
for c = 0x14A, 0x177, 2 do
	UPPER[c + 1] = c
	LOWER[c] = c + 1
end
for c = 0x179, 0x17E, 2 do
	UPPER[c + 1] = c
	LOWER[c] = c + 1
end
UPPER[0x17F] = 0x53

local function mapCase(s, upper)
	if isAscii(s) then
		return upper and string.upper(s) or string.lower(s)
	end
	local ok, res = pcall(function()
		local parts = {}
		for _, cp in utf8.codes(s) do
			local m
			if upper then
				if cp >= 97 and cp <= 122 then
					m = cp - 32
				elseif cp == 0xDF then
					parts[#parts + 1] = "SS"
					continue
				else
					m = UPPER[cp] or cp
				end
			else
				if cp >= 65 and cp <= 90 then
					m = cp + 32
				else
					m = LOWER[cp] or cp
				end
			end
			parts[#parts + 1] = utf8.char(m)
		end
		return tconcat(parts)
	end)
	if ok then
		return res
	end
	return upper and string.upper(s) or string.lower(s)
end
function S.toUpperCase(s)
	return mapCase(s, true)
end
function S.toLowerCase(s)
	return mapCase(s, false)
end
S.toLocaleUpperCase = S.toUpperCase
S.toLocaleLowerCase = S.toLowerCase

-- JavaScript whitespace (ASCII + NBSP + BOM + line separators)
local WS = "[ \t\n\r\v\f]"
local function trimStart(s)
	while true do
		local before = s
		s = string.gsub(s, "^" .. WS .. "+", "")
		s = string.gsub(s, "^\194\160", "")
		s = string.gsub(s, "^\239\187\191", "")
		s = string.gsub(s, "^\226\128[\168\169]", "")
		if s == before then
			return s
		end
	end
end
local function trimEnd(s)
	while true do
		local before = s
		s = string.gsub(s, WS .. "+$", "")
		s = string.gsub(s, "\194\160$", "")
		s = string.gsub(s, "\239\187\191$", "")
		s = string.gsub(s, "\226\128[\168\169]$", "")
		if s == before then
			return s
		end
	end
end
S.trimStart, S.trimEnd = trimStart, trimEnd
S.trimLeft, S.trimRight = trimStart, trimEnd
function S.trim(s)
	return trimEnd(trimStart(s))
end
function S.padStart(s, n, fill)
	fill = fill == nil and " " or str(fill)
	local l = slen(s)
	if n <= l or fill == "" then
		return s
	end
	local need = n - l
	local pad = srep(fill, math.ceil(need / slen(fill)))
	return S.slice(pad, 0, need) .. s
end
function S.padEnd(s, n, fill)
	fill = fill == nil and " " or str(fill)
	local l = slen(s)
	if n <= l or fill == "" then
		return s
	end
	local need = n - l
	local pad = srep(fill, math.ceil(need / slen(fill)))
	return s .. S.slice(pad, 0, need)
end
S["repeat"] = function(s, n)
	return srep(s, n)
end
function S.concat(s, ...)
	local out = s
	for i = 1, select("#", ...) do
		out = out .. str((select(i, ...)))
	end
	return out
end
function S.toString(s)
	return s
end
S.valueOf = S.toString

-- Unicode decomposition (NFD) for the Latin letters a football name can carry.
local DECOMP = {}
do
	local function add(base, list)
		-- list: precomposed code points in the order of marks below
		for mark, cp in pairs(list) do
			DECOMP[cp] = { base, mark }
		end
	end
	local GRAVE, ACUTE, CIRC, TILDE, DIAER, RING, CEDIL, CARON, MACRON, BREVE, OGONEK, DOTA, DACUTE =
		0x300, 0x301, 0x302, 0x303, 0x308, 0x30A, 0x327, 0x30C, 0x304, 0x306, 0x328, 0x307, 0x30B
	add(0x41, { [GRAVE] = 0xC0, [ACUTE] = 0xC1, [CIRC] = 0xC2, [TILDE] = 0xC3, [DIAER] = 0xC4, [RING] = 0xC5, [MACRON] = 0x100, [BREVE] = 0x102, [OGONEK] = 0x104 })
	add(0x61, { [GRAVE] = 0xE0, [ACUTE] = 0xE1, [CIRC] = 0xE2, [TILDE] = 0xE3, [DIAER] = 0xE4, [RING] = 0xE5, [MACRON] = 0x101, [BREVE] = 0x103, [OGONEK] = 0x105 })
	add(0x43, { [CEDIL] = 0xC7, [ACUTE] = 0x106, [CIRC] = 0x108, [DOTA] = 0x10A, [CARON] = 0x10C })
	add(0x63, { [CEDIL] = 0xE7, [ACUTE] = 0x107, [CIRC] = 0x109, [DOTA] = 0x10B, [CARON] = 0x10D })
	add(0x44, { [CARON] = 0x10E })
	add(0x64, { [CARON] = 0x10F })
	add(0x45, { [GRAVE] = 0xC8, [ACUTE] = 0xC9, [CIRC] = 0xCA, [DIAER] = 0xCB, [MACRON] = 0x112, [BREVE] = 0x114, [DOTA] = 0x116, [OGONEK] = 0x118, [CARON] = 0x11A })
	add(0x65, { [GRAVE] = 0xE8, [ACUTE] = 0xE9, [CIRC] = 0xEA, [DIAER] = 0xEB, [MACRON] = 0x113, [BREVE] = 0x115, [DOTA] = 0x117, [OGONEK] = 0x119, [CARON] = 0x11B })
	add(0x47, { [CIRC] = 0x11C, [BREVE] = 0x11E, [DOTA] = 0x120, [CEDIL] = 0x122 })
	add(0x67, { [CIRC] = 0x11D, [BREVE] = 0x11F, [DOTA] = 0x121, [CEDIL] = 0x123 })
	add(0x48, { [CIRC] = 0x124 })
	add(0x68, { [CIRC] = 0x125 })
	add(0x49, { [GRAVE] = 0xCC, [ACUTE] = 0xCD, [CIRC] = 0xCE, [DIAER] = 0xCF, [TILDE] = 0x128, [MACRON] = 0x12A, [BREVE] = 0x12C, [OGONEK] = 0x12E, [DOTA] = 0x130 })
	add(0x69, { [GRAVE] = 0xEC, [ACUTE] = 0xED, [CIRC] = 0xEE, [DIAER] = 0xEF, [TILDE] = 0x129, [MACRON] = 0x12B, [BREVE] = 0x12D, [OGONEK] = 0x12F })
	add(0x4A, { [CIRC] = 0x134 })
	add(0x6A, { [CIRC] = 0x135 })
	add(0x4B, { [CEDIL] = 0x136 })
	add(0x6B, { [CEDIL] = 0x137 })
	add(0x4C, { [ACUTE] = 0x139, [CEDIL] = 0x13B, [CARON] = 0x13D })
	add(0x6C, { [ACUTE] = 0x13A, [CEDIL] = 0x13C, [CARON] = 0x13E })
	add(0x4E, { [TILDE] = 0xD1, [ACUTE] = 0x143, [CEDIL] = 0x145, [CARON] = 0x147 })
	add(0x6E, { [TILDE] = 0xF1, [ACUTE] = 0x144, [CEDIL] = 0x146, [CARON] = 0x148 })
	add(0x4F, { [GRAVE] = 0xD2, [ACUTE] = 0xD3, [CIRC] = 0xD4, [TILDE] = 0xD5, [DIAER] = 0xD6, [MACRON] = 0x14C, [BREVE] = 0x14E, [DACUTE] = 0x150 })
	add(0x6F, { [GRAVE] = 0xF2, [ACUTE] = 0xF3, [CIRC] = 0xF4, [TILDE] = 0xF5, [DIAER] = 0xF6, [MACRON] = 0x14D, [BREVE] = 0x14F, [DACUTE] = 0x151 })
	add(0x52, { [ACUTE] = 0x154, [CEDIL] = 0x156, [CARON] = 0x158 })
	add(0x72, { [ACUTE] = 0x155, [CEDIL] = 0x157, [CARON] = 0x159 })
	add(0x53, { [ACUTE] = 0x15A, [CIRC] = 0x15C, [CEDIL] = 0x15E, [CARON] = 0x160 })
	add(0x73, { [ACUTE] = 0x15B, [CIRC] = 0x15D, [CEDIL] = 0x15F, [CARON] = 0x161 })
	add(0x54, { [CEDIL] = 0x162, [CARON] = 0x164 })
	add(0x74, { [CEDIL] = 0x163, [CARON] = 0x165 })
	add(0x55, { [GRAVE] = 0xD9, [ACUTE] = 0xDA, [CIRC] = 0xDB, [DIAER] = 0xDC, [TILDE] = 0x168, [MACRON] = 0x16A, [BREVE] = 0x16C, [RING] = 0x16E, [DACUTE] = 0x170, [OGONEK] = 0x172 })
	add(0x75, { [GRAVE] = 0xF9, [ACUTE] = 0xFA, [CIRC] = 0xFB, [DIAER] = 0xFC, [TILDE] = 0x169, [MACRON] = 0x16B, [BREVE] = 0x16D, [RING] = 0x16F, [DACUTE] = 0x171, [OGONEK] = 0x173 })
	add(0x57, { [CIRC] = 0x174 })
	add(0x77, { [CIRC] = 0x175 })
	add(0x59, { [ACUTE] = 0xDD, [CIRC] = 0x176, [DIAER] = 0x178 })
	add(0x79, { [ACUTE] = 0xFD, [DIAER] = 0xFF, [CIRC] = 0x177 })
	add(0x5A, { [ACUTE] = 0x179, [DOTA] = 0x17B, [CARON] = 0x17D })
	add(0x7A, { [ACUTE] = 0x17A, [DOTA] = 0x17C, [CARON] = 0x17E })
end
Js.DECOMP = DECOMP

function S.normalize(s, form)
	form = form or "NFC"
	if isAscii(s) then
		return s
	end
	local ok, res = pcall(function()
		local parts = {}
		if form == "NFD" or form == "NFKD" then
			for _, cp in utf8.codes(s) do
				local d = DECOMP[cp]
				if d then
					parts[#parts + 1] = utf8.char(d[1], d[2])
				else
					parts[#parts + 1] = utf8.char(cp)
				end
			end
		else
			-- NFC: recompose base + mark
			local COMP = Js._COMP
			if not COMP then
				COMP = {}
				for cp, d in pairs(DECOMP) do
					COMP[d[1] * 0x10000 + d[2]] = cp
				end
				Js._COMP = COMP
			end
			local prev
			for _, cp in utf8.codes(s) do
				if prev and COMP[prev * 0x10000 + cp] then
					prev = COMP[prev * 0x10000 + cp]
				else
					if prev then
						parts[#parts + 1] = utf8.char(prev)
					end
					prev = cp
				end
			end
			if prev then
				parts[#parts + 1] = utf8.char(prev)
			end
		end
		return tconcat(parts)
	end)
	return ok and res or s
end

-- localeCompare: an approximation of the browser's default (ICU root)
-- order: spaces and punctuation, then digits, then letters; letters compare
-- without accents and case first, then accents, then lower before upper.
-- letters that sort as other letters (browser order): Æ as AE, Ø as O...
local EXPAND = {
	[0xC6] = { 0x41, 0x45 }, [0xE6] = { 0x61, 0x65 }, [0x152] = { 0x4F, 0x45 }, [0x153] = { 0x6F, 0x65 },
	[0xDF] = { 0x73, 0x73 }, [0xDE] = { 0x54, 0x48 }, [0xFE] = { 0x74, 0x68 },
}
local VARIANT = { -- one letter with a mark of its own (secondary difference)
	[0xD8] = 0x4F, [0xF8] = 0x6F, [0x110] = 0x44, [0x111] = 0x64, [0xD0] = 0x44, [0xF0] = 0x64,
	[0x141] = 0x4C, [0x142] = 0x6C, [0x131] = 0x69, [0x126] = 0x48, [0x127] = 0x68,
}
local function collKey(s)
	local prim, sec, ter = {}, {}, {}
	local ok = pcall(function()
		local cps = {}
		for _, cp in utf8.codes(s) do
			local ex = EXPAND[cp]
			if ex then
				cps[#cps + 1] = ex[1]
				cps[#cps + 1] = -ex[2] -- negative: second letter of an expansion
			else
				cps[#cps + 1] = cp
			end
		end
		for _, cp0 in cps do
			local cp = cp0 < 0 and -cp0 or cp0
			local base, acc = cp, 0
			local d = DECOMP[cp]
			if d then
				base, acc = d[1], d[2]
			elseif VARIANT[cp] then
				base, acc = VARIANT[cp], 0x338
			end
			if cp0 < 0 then
				acc = 0x2FF
			end
			local lower = base
			local isUpper = false
			if base >= 65 and base <= 90 then
				lower = base + 32
				isUpper = true
			elseif LOWER[base] then
				lower = LOWER[base]
				isUpper = true
			end
			local w
			if lower == 32 or lower == 9 or lower == 10 or lower == 13 or lower == 0xA0 then
				w = 100 + lower
			elseif lower >= 48 and lower <= 57 then
				w = 1000 + lower
			elseif (lower >= 97 and lower <= 122) then
				w = 2000 + lower
			elseif lower >= 0x300 and lower <= 0x36F then
				continue -- a lone combining mark: accent only
			elseif lower < 128 then
				w = 500 + lower
			else
				w = 3000 + lower
			end
			prim[#prim + 1] = w
			sec[#sec + 1] = acc
			ter[#ter + 1] = isUpper and 1 or 0
		end
	end)
	if not ok then
		for i = 1, #s do
			prim[i] = sbyte(s, i)
			sec[i] = 0
			ter[i] = 0
		end
	end
	return prim, sec, ter
end
local function cmpLists(a, b)
	for i = 1, math.max(#a, #b) do
		local x, y = a[i], b[i]
		if x == nil then
			return -1
		end
		if y == nil then
			return 1
		end
		if x ~= y then
			return x < y and -1 or 1
		end
	end
	return 0
end
function S.localeCompare(a, b)
	b = str(b)
	if a == b then
		return 0
	end
	local p1, s1, t1 = collKey(a)
	local p2, s2, t2 = collKey(b)
	local c = cmpLists(p1, p2)
	if c ~= 0 then
		return c
	end
	c = cmpLists(s1, s2)
	if c ~= 0 then
		return c
	end
	c = cmpLists(t1, t2)
	if c ~= 0 then
		return c
	end
	return a < b and -1 or 1
end

function S.split(s, sep, limit)
	local out, n = {}, 0
	limit = limit or 4294967295
	if limit == 0 then
		return mkarr(out, 0)
	end
	if sep == nil then
		return Js.alit(s)
	end
	if type(sep) == "table" then
		return Js.RegExp.split(sep, s, limit)
	end
	sep = str(sep)
	if sep == "" then
		local u, un = safeUnits(s)
		for i = 1, math.min(un, limit) do
			out[i] = fromUnits(u, i, i)
		end
		return mkarr(out, math.min(un, limit))
	end
	local start = 1
	while true do
		local b, e = sfind(s, sep, start, true)
		if not b then
			break
		end
		n += 1
		out[n] = ssub(s, start, b - 1)
		if n >= limit then
			return mkarr(out, n)
		end
		start = e + 1
	end
	n += 1
	out[n] = ssub(s, start)
	return mkarr(out, math.min(n, limit))
end

local function expandReplacement(rep, matched, pos, s, groups)
	-- $& $1..$99 $$ $` $'
	local out = {}
	local i = 1
	while i <= #rep do
		local c = ssub(rep, i, i)
		if c == "$" and i < #rep then
			local nx = ssub(rep, i + 1, i + 1)
			if nx == "$" then
				out[#out + 1] = "$"
				i += 2
				continue
			elseif nx == "&" then
				out[#out + 1] = matched
				i += 2
				continue
			elseif nx == "`" then
				out[#out + 1] = S.slice(s, 0, pos)
				i += 2
				continue
			elseif nx == "'" then
				out[#out + 1] = S.slice(s, pos + slen(matched))
				i += 2
				continue
			elseif sfind(nx, "%d") then
				local two = ssub(rep, i + 1, i + 2)
				local g2 = tonumber(two)
				if #two == 2 and sfind(two, "^%d%d$") and groups and g2 >= 1 and g2 <= #groups then
					out[#out + 1] = groups[g2] or ""
					i += 3
					continue
				end
				local g = tonumber(nx)
				if groups and g >= 1 and g <= #groups then
					out[#out + 1] = groups[g] or ""
					i += 2
					continue
				end
			end
		end
		out[#out + 1] = c
		i += 1
	end
	return tconcat(out)
end
Js._expandReplacement = expandReplacement

function S.replace(s, pat, rep)
	if type(pat) == "table" then
		return Js.RegExp.replace(pat, s, rep, false)
	end
	pat = str(pat)
	local b, e = sfind(s, pat, 1, true)
	if not b then
		return s
	end
	local pos = byteToUnit(s, b)
	local r
	if type(rep) == "function" then
		r = str(rep(pat, pos, s))
	else
		r = expandReplacement(str(rep), pat, pos, s, {})
	end
	return ssub(s, 1, b - 1) .. r .. ssub(s, e + 1)
end
function S.replaceAll(s, pat, rep)
	if type(pat) == "table" then
		return Js.RegExp.replace(pat, s, rep, true)
	end
	pat = str(pat)
	if pat == "" then
		return s
	end
	local out = {}
	local start = 1
	while true do
		local b, e = sfind(s, pat, start, true)
		if not b then
			break
		end
		out[#out + 1] = ssub(s, start, b - 1)
		if type(rep) == "function" then
			out[#out + 1] = str(rep(pat, byteToUnit(s, b), s))
		else
			out[#out + 1] = expandReplacement(str(rep), pat, byteToUnit(s, b), s, {})
		end
		start = e + 1
	end
	out[#out + 1] = ssub(s, start)
	return tconcat(out)
end
function S.match(s, re)
	if type(re) ~= "table" then
		re = Js.RegExp.new(str(re), "")
	end
	return Js.RegExp.match(re, s)
end
function S.matchAll(s, re)
	return Js.RegExp.matchAll(re, s)
end
function S.search(s, re)
	if type(re) ~= "table" then
		re = Js.RegExp.new(str(re), "")
	end
	local m = Js.RegExp.execAt(re, s, 0)
	return m and m.index or -1
end

function Js.fromCharCode(...)
	local u = { ... }
	return fromUnits(u, 1, #u)
end
function Js.fromCodePoint(...)
	local parts = {}
	for i = 1, select("#", ...) do
		parts[i] = utf8.char((select(i, ...)))
	end
	return tconcat(parts)
end

-- ─────────────────────────────────────────────────────────────── arrays ──

local A = {}
Js.A = A

function A.new(n)
	local t = {}
	return mkarr(t, n or 0)
end

function A.set(a, i, v) -- a[i] = v (i is 0-based)
	a[i + 1] = v
	if i + 1 > alen(a) then
		LEN[a] = i + 1
	end
	return v
end
function A.setlen(a, n)
	local old = alen(a)
	for i = n + 1, old do
		a[i] = nil
	end
	LEN[a] = n
	return n
end
function A.push(a, ...)
	local n = alen(a)
	local k = select("#", ...)
	for i = 1, k do
		a[n + i] = (select(i, ...))
	end
	LEN[a] = n + k
	return n + k
end
function A.pop(a)
	local n = alen(a)
	if n == 0 then
		return nil
	end
	local v = a[n]
	a[n] = nil
	LEN[a] = n - 1
	return v
end
function A.shift(a)
	local n = alen(a)
	if n == 0 then
		return nil
	end
	local v = a[1]
	table.move(a, 2, n, 1)
	a[n] = nil
	LEN[a] = n - 1
	return v
end
function A.unshift(a, ...)
	local n = alen(a)
	local k = select("#", ...)
	if k == 0 then
		return n
	end
	table.move(a, 1, n, k + 1)
	for i = 1, k do
		a[i] = (select(i, ...))
	end
	LEN[a] = n + k
	return n + k
end
function A.slice(a, s, e)
	local n = alen(a)
	local i = relIndex(s, n, 0)
	local j = relIndex(e, n, n)
	local out = {}
	local m = 0
	for k = i + 1, j do
		m += 1
		out[m] = a[k]
	end
	return mkarr(out, math.max(0, j - i))
end
function A.splice(a, start, deleteCount, ...)
	local n = alen(a)
	local i = relIndex(start, n, 0)
	local dc
	if start == nil then
		dc = 0
	elseif deleteCount == nil then
		dc = n - i
	else
		dc = math.min(math.max(JMath.trunc(tonum(deleteCount)), 0), n - i)
	end
	local removed = {}
	for k = 1, dc do
		removed[k] = a[i + k]
	end
	local ins = select("#", ...)
	local newLen = n - dc + ins
	if ins ~= dc then
		table.move(a, i + dc + 1, n, i + ins + 1)
		for k = newLen + 1, n do
			a[k] = nil
		end
	end
	for k = 1, ins do
		a[i + k] = (select(k, ...))
	end
	LEN[a] = newLen
	return mkarr(removed, dc)
end
function A.concat(a, ...)
	local out = {}
	local n = alen(a)
	table.move(a, 1, n, 1, out)
	for i = 1, select("#", ...) do
		local b = select(i, ...)
		if isArray(b) then
			local m = alen(b)
			table.move(b, 1, m, n + 1, out)
			n += m
		else
			n += 1
			out[n] = b
		end
	end
	return mkarr(out, n)
end
function A.map(a, f)
	local out = {}
	local n = alen(a)
	for i = 1, n do
		out[i] = f(a[i], i - 1, a)
	end
	return mkarr(out, n)
end
function A.forEach(a, f)
	for i = 1, alen(a) do
		f(a[i], i - 1, a)
	end
end
function A.filter(a, f)
	local out, m = {}, 0
	for i = 1, alen(a) do
		local v = a[i]
		if Js.T(f(v, i - 1, a)) then
			m += 1
			out[m] = v
		end
	end
	return mkarr(out, m)
end
function A.reduce(a, f, ...)
	local n = alen(a)
	local i, acc = 1, nil
	if select("#", ...) > 0 then
		acc = (...)
	else
		if n == 0 then
			error(Js.TypeError("Reduce of empty array with no initial value"), 0)
		end
		acc = a[1]
		i = 2
	end
	for k = i, n do
		acc = f(acc, a[k], k - 1, a)
	end
	return acc
end
function A.reduceRight(a, f, ...)
	local n = alen(a)
	local i, acc = n, nil
	if select("#", ...) > 0 then
		acc = (...)
	else
		acc = a[n]
		i = n - 1
	end
	for k = i, 1, -1 do
		acc = f(acc, a[k], k - 1, a)
	end
	return acc
end
function A.find(a, f)
	for i = 1, alen(a) do
		local v = a[i]
		if Js.T(f(v, i - 1, a)) then
			return v
		end
	end
	return nil
end
function A.findIndex(a, f)
	for i = 1, alen(a) do
		if Js.T(f(a[i], i - 1, a)) then
			return i - 1
		end
	end
	return -1
end
function A.findLast(a, f)
	for i = alen(a), 1, -1 do
		local v = a[i]
		if Js.T(f(v, i - 1, a)) then
			return v
		end
	end
	return nil
end
function A.findLastIndex(a, f)
	for i = alen(a), 1, -1 do
		if Js.T(f(a[i], i - 1, a)) then
			return i - 1
		end
	end
	return -1
end
function A.some(a, f)
	for i = 1, alen(a) do
		if Js.T(f(a[i], i - 1, a)) then
			return true
		end
	end
	return false
end
function A.every(a, f)
	for i = 1, alen(a) do
		if not Js.T(f(a[i], i - 1, a)) then
			return false
		end
	end
	return true
end
local function sameValueZero(x, y)
	return x == y or (x ~= x and y ~= y)
end
function A.includes(a, v, from)
	local n = alen(a)
	local s = relIndex(from, n, 0)
	for i = s + 1, n do
		if sameValueZero(a[i], v) then
			return true
		end
	end
	return false
end
function A.indexOf(a, v, from)
	local n = alen(a)
	local s = relIndex(from, n, 0)
	for i = s + 1, n do
		if a[i] == v and v ~= nil then
			return i - 1
		end
	end
	return -1
end
function A.lastIndexOf(a, v)
	for i = alen(a), 1, -1 do
		if a[i] == v then
			return i - 1
		end
	end
	return -1
end
function A.join(a, sep)
	sep = (sep == nil) and "," or str(sep)
	local parts = {}
	for i = 1, alen(a) do
		local v = a[i]
		parts[i] = (v == nil) and "" or str(v)
	end
	return tconcat(parts, sep)
end
A.toString = function(a)
	return A.join(a, ",")
end
function A.reverse(a)
	local n = alen(a)
	for i = 1, floor(n / 2) do
		a[i], a[n - i + 1] = a[n - i + 1], a[i]
	end
	return a
end
function A.toReversed(a)
	return A.reverse(A.slice(a))
end

-- JavaScript's default sort order: as text, undefined last.
local function defaultCompare(x, y)
	local sx, sy = str(x), str(y)
	if sx == sy then
		return 0
	end
	if isAscii(sx) and isAscii(sy) then
		return sx < sy and -1 or 1
	end
	local ux, uy = safeUnits(sx), safeUnits(sy)
	return cmpLists(ux, uy)
end

-- Stable merge sort, like JavaScript's.
local function mergeSort(t, n, cmp)
	if n < 2 then
		return
	end
	-- insertion sort for small runs, then merge
	local RUN = 16
	for lo = 1, n, RUN do
		local hi = math.min(lo + RUN - 1, n)
		for i = lo + 1, hi do
			local v = t[i]
			local j = i - 1
			while j >= lo do
				local c = cmp(t[j], v)
				if c ~= c or c <= 0 then
					break
				end
				t[j + 1] = t[j]
				j -= 1
			end
			t[j + 1] = v
		end
	end
	local src, dst = t, {}
	local width = RUN
	while width < n do
		for lo = 1, n, 2 * width do
			local mid = math.min(lo + width, n + 1)
			local hi = math.min(lo + 2 * width, n + 1)
			local i, j, k = lo, mid, lo
			while i < mid and j < hi do
				local c = cmp(src[j], src[i])
				if c == c and c < 0 then
					dst[k] = src[j]
					j += 1
				else
					dst[k] = src[i]
					i += 1
				end
				k += 1
			end
			while i < mid do
				dst[k] = src[i]
				i += 1
				k += 1
			end
			while j < hi do
				dst[k] = src[j]
				j += 1
				k += 1
			end
		end
		src, dst = dst, src
		width *= 2
	end
	if src ~= t then
		table.move(src, 1, n, 1, t)
	end
end

function A.sort(a, cmp)
	local n = alen(a)
	-- undefined goes last and is never passed to the compare function
	local vals, m, undef = {}, 0, 0
	for i = 1, n do
		local v = a[i]
		if v == nil then
			undef += 1
		else
			m += 1
			vals[m] = v
		end
	end
	local c
	if cmp then
		c = function(x, y)
			local r = cmp(x, y)
			if type(r) ~= "number" then
				r = tonum(r)
			end
			return r
		end
	else
		c = defaultCompare
	end
	mergeSort(vals, m, c)
	for i = 1, m do
		a[i] = vals[i]
	end
	for i = m + 1, n do
		a[i] = nil
	end
	return a
end
function A.toSorted(a, cmp)
	return A.sort(A.slice(a), cmp)
end
function A.fill(a, v, s, e)
	local n = alen(a)
	local i = relIndex(s, n, 0)
	local j = relIndex(e, n, n)
	for k = i + 1, j do
		a[k] = v
	end
	return a
end
function A.flat(a, depth)
	depth = depth or 1
	local out, m = {}, 0
	local function go(x, d)
		for i = 1, alen(x) do
			local v = x[i]
			if d > 0 and isArray(v) then
				go(v, d - 1)
			else
				m += 1
				out[m] = v
			end
		end
	end
	go(a, depth)
	return mkarr(out, m)
end
function A.flatMap(a, f)
	local out, m = {}, 0
	for i = 1, alen(a) do
		local v = f(a[i], i - 1, a)
		if isArray(v) then
			for k = 1, alen(v) do
				m += 1
				out[m] = v[k]
			end
		else
			m += 1
			out[m] = v
		end
	end
	return mkarr(out, m)
end
function A.at(a, i)
	local n = alen(a)
	i = JMath.trunc(i or 0)
	if i < 0 then
		i += n
	end
	return a[i + 1]
end
function A.keys(a)
	local out = {}
	for i = 1, alen(a) do
		out[i] = i - 1
	end
	return mkarr(out, alen(a))
end
function A.values(a)
	return A.slice(a)
end
function A.entries(a)
	local out = {}
	for i = 1, alen(a) do
		out[i] = Js.alit(i - 1, a[i])
	end
	return mkarr(out, alen(a))
end
function A.with(a, i, v)
	local b = A.slice(a)
	if i < 0 then
		i += alen(a)
	end
	b[i + 1] = v
	return b
end

-- Array.from(x [, f]) and spreading: anything iterable becomes an array.
local function toArray(x)
	if isArray(x) then
		return A.slice(x)
	end
	if type(x) == "string" then
		local out, n = {}, 0
		local ok = pcall(function()
			for _, cp in utf8.codes(x) do
				n += 1
				out[n] = utf8.char(cp)
			end
		end)
		if not ok then
			out, n = {}, 0
			for i = 1, #x do
				n += 1
				out[n] = ssub(x, i, i)
			end
		end
		return mkarr(out, n)
	end
	if type(x) == "table" then
		local mt = getmetatable(x)
		if mt and mt.__jsiter then
			return mt.__jsiter(x)
		end
		-- array-like {length = n}
		if rawget(x, "length") ~= nil then
			local n = x.length
			local out = {}
			for i = 1, n do
				out[i] = x[i - 1]
			end
			return mkarr(out, n)
		end
	end
	if x == nil then
		error(Js.TypeError("undefined is not iterable"), 0)
	end
	return mkarr({}, 0)
end
Js.toArray = toArray

local JArray = {}
Js.Array = JArray
JArray.isArray = isArray
function JArray.from(x, f)
	local a = toArray(x)
	if f then
		return A.map(a, function(v, i)
			return f(v, i)
		end)
	end
	return a
end
function JArray.of(...)
	return Js.alit(...)
end
-- new Array(n) / Array(n)
function JArray.new(...)
	local k = select("#", ...)
	if k == 1 and type((...)) == "number" then
		return mkarr({}, (...))
	end
	return Js.alit(...)
end

-- [a, ...b, c]: each argument is a chunk (already an array)
function Js.aspread(...)
	local out, n = {}, 0
	for i = 1, select("#", ...) do
		local c = select(i, ...)
		local arr = isArray(c) and c or toArray(c)
		local m = alen(arr)
		table.move(arr, 1, m, n + 1, out)
		n += m
	end
	return mkarr(out, n)
end

-- f(...arr): unpack keeping nils
function Js.unpack(a)
	if not isArray(a) then
		a = toArray(a)
	end
	return table.unpack(a, 1, alen(a))
end

-- ──────────────────────────────────────────────────────────── object API ──

local JObject = {}
Js.Object = JObject
JObject.keys = function(t)
	if type(t) == "string" then
		local out = {}
		for i = 1, slen(t) do
			out[i] = numstr(i - 1)
		end
		return mkarr(out, #out)
	end
	return okeys(t)
end
JObject.values = function(t)
	local ks = okeys(t)
	local out = {}
	local n = alen(ks)
	if isArray(t) then
		for i = 1, n do
			out[i] = t[i]
		end
	else
		for i = 1, n do
			out[i] = oget(t, ks[i])
		end
	end
	return mkarr(out, n)
end
JObject.entries = function(t)
	local ks = okeys(t)
	local out = {}
	local n = alen(ks)
	for i = 1, n do
		local v
		if isArray(t) then
			v = t[i]
		else
			v = oget(t, ks[i])
		end
		out[i] = Js.alit(ks[i], v)
	end
	return mkarr(out, n)
end
JObject.assign = function(target, ...)
	for i = 1, select("#", ...) do
		local src = select(i, ...)
		if type(src) == "table" then
			if isArray(src) then
				for k = 1, alen(src) do
					target[numstr(k - 1)] = src[k]
				end
			else
				local ks = okeys(src)
				for k = 1, alen(ks) do
					local key = ks[k]
					local v = oget(src, key)
					if rawget(src, key) == nil and type(key) == "string" and isIndexKey(key) and rawget(src, tonumber(key)) ~= nil then
						target[tonumber(key)] = v
					else
						target[key] = v
					end
				end
			end
		elseif type(src) == "string" then
			local chars = toArray(src)
			for k = 1, alen(chars) do
				target[numstr(k - 1)] = chars[k]
			end
		end
	end
	return target
end
JObject.fromEntries = function(entries)
	local o = O({}, {})
	local arr = toArray(entries)
	for i = 1, alen(arr) do
		local e = arr[i]
		o[e[1]] = e[2]
	end
	return o
end
JObject.freeze = function(t)
	return t
end
JObject.isFrozen = function()
	return false
end
JObject.create = function()
	return O({}, {})
end
JObject.getOwnPropertyNames = JObject.keys
JObject.is = function(a, b)
	if a ~= a and b ~= b then
		return true
	end
	return a == b
end

-- {...a, b: 1, ...c}
function Js.ospread(...)
	local o = O({}, {})
	JObject.assign(o, ...)
	return o
end

-- hasOwnProperty / `k in obj`
function Js.has(t, k)
	if type(t) ~= "table" then
		return false
	end
	if isArray(t) then
		if k == "length" then
			return true
		end
		local i = tonumber(k)
		return i ~= nil and i >= 0 and i < alen(t)
	end
	if rawget(t, k) ~= nil then
		return true
	end
	if type(k) == "string" and isIndexKey(k) and rawget(t, tonumber(k)) ~= nil then
		return true
	end
	if type(k) == "number" and rawget(t, numstr(k)) ~= nil then
		return true
	end
	local order = ORDER[t]
	if order then
		for _, x in order do
			if x == k then
				return true
			end
		end
	end
	local mt = getmetatable(t)
	if mt and mt.__jshas then
		return mt.__jshas(t, k)
	end
	return false
end

-- A number used as an object key becomes its JavaScript text.
function Js.key(k)
	if type(k) == "number" then
		return numstr(k)
	end
	return k
end

-- o[k] when the converter cannot tell what o is
function Js.idx(o, k)
	if o == nil then
		error(Js.TypeError("Cannot read properties of undefined (reading '" .. str(k) .. "')"), 0)
	end
	local t = type(o)
	if t == "string" then
		if k == "length" then
			return slen(o)
		end
		if type(k) == "number" then
			return S.idx(o, k)
		end
		return nil
	end
	if t ~= "table" then
		return nil
	end
	if isArray(o) then
		if type(k) == "number" then
			return o[k + 1]
		end
		if k == "length" then
			return alen(o)
		end
		local i = tonumber(k)
		if i then
			return o[i + 1]
		end
		return nil
	end
	local v = o[k]
	if v == nil then
		if type(k) == "number" then
			v = o[numstr(k)]
		elseif isIndexKey(k) then
			v = rawget(o, tonumber(k))
		end
	end
	return v
end
function Js.setidx(o, k, v)
	if isArray(o) then
		if type(k) == "number" then
			return A.set(o, k, v)
		end
		if k == "length" then
			return A.setlen(o, v)
		end
		local i = tonumber(k)
		if i then
			return A.set(o, i, v)
		end
	end
	if type(k) == "number" then
		k = numstr(k)
	end
	o[k] = v
	return v
end

-- x.length when x's type is unknown
function Js.len(x)
	if type(x) == "string" then
		return slen(x)
	end
	if isArray(x) then
		return alen(x)
	end
	if type(x) == "table" then
		return x.length
	end
	return nil
end

-- A method call when the converter cannot tell the receiver's type.
local function methodTableFor(o)
	local t = type(o)
	if t == "string" then
		return S
	elseif t == "number" then
		return N
	elseif t == "table" then
		if isArray(o) then
			return A
		end
	end
	return nil
end
function Js.call(o, name, ...)
	local mt = methodTableFor(o)
	if mt then
		local f = mt[name]
		if f then
			return f(o, ...)
		end
		error(Js.TypeError("no method '" .. name .. "' on " .. Js.typeof(o)), 0)
	end
	if o == nil then
		error(Js.TypeError("Cannot read properties of undefined (reading '" .. name .. "')"), 0)
	end
	local f = o[name]
	if f == nil then
		if name == "toString" then
			return str(o)
		end
		if name == "hasOwnProperty" then
			return Js.has(o, (...))
		end
		error(Js.TypeError(name .. " is not a function"), 0)
	end
	local m = getmetatable(o)
	if m and m.__jsclass then
		return f(o, ...)
	end
	return f(...)
end

-- structuredClone
local function clone(v, seen)
	if type(v) ~= "table" then
		return v
	end
	seen = seen or {}
	if seen[v] then
		return seen[v]
	end
	local mt = getmetatable(v)
	if mt == ARR_MT then
		local out = {}
		seen[v] = out
		local n = alen(v)
		for i = 1, n do
			out[i] = clone(v[i], seen)
		end
		return mkarr(out, n)
	end
	if mt and mt.__jsclone then
		return mt.__jsclone(v, seen, clone)
	end
	local out = O({}, {})
	seen[v] = out
	local ks = okeys(v)
	for i = 1, alen(ks) do
		local k = ks[i]
		local val = oget(v, k)
		if rawget(v, k) == nil and isIndexKey(k) then
			out[tonumber(k)] = clone(val, seen)
		else
			out[k] = clone(val, seen)
		end
	end
	return out
end
Js.structuredClone = function(v)
	return clone(v)
end

-- ─────────────────────────────────────────────────────────── Map and Set ──

local Map = {}
Map.__index = Map
Map.__jsclass = true
Js.Map = Map

local function mapKey(k)
	if k == nil then
		return NULL_SENTINEL
	end
	if k ~= k then
		return Map
	end -- NaN
	return k
end
local function mapUnkey(k)
	if k == NULL_SENTINEL then
		return nil
	end
	if k == Map then
		return 0 / 0
	end
	return k
end

function Map.new(init)
	local m = setmetatable({ _k = {}, _v = {}, _i = {}, _n = 0, size = 0 }, Map)
	if init ~= nil then
		local arr = toArray(init)
		for i = 1, alen(arr) do
			local e = arr[i]
			m:set(e[1], e[2])
		end
	end
	return m
end
function Map:get(k)
	local i = self._i[mapKey(k)]
	if i then
		return self._v[i]
	end
	return nil
end
function Map:has(k)
	return self._i[mapKey(k)] ~= nil
end
function Map:set(k, v)
	local mk = mapKey(k)
	local i = self._i[mk]
	if i then
		self._v[i] = v
	else
		local n = self._n + 1
		self._n = n
		self._k[n] = mk
		self._v[n] = v
		self._i[mk] = n
		self.size += 1
	end
	return self
end
local TOMB = {}
function Map:delete(k)
	local mk = mapKey(k)
	local i = self._i[mk]
	if not i then
		return false
	end
	self._i[mk] = nil
	self._k[i] = TOMB
	self._v[i] = nil
	self.size -= 1
	if self._n > 32 and self.size < self._n / 2 then
		-- compact
		local nk, nv, ni, n = {}, {}, {}, 0
		for j = 1, self._n do
			local kk = self._k[j]
			if kk ~= TOMB then
				n += 1
				nk[n] = kk
				nv[n] = self._v[j]
				ni[kk] = n
			end
		end
		self._k, self._v, self._i, self._n = nk, nv, ni, n
	end
	return true
end
function Map:clear()
	self._k, self._v, self._i, self._n, self.size = {}, {}, {}, 0, 0
end
-- live iteration in insertion order: for k, v in m:iter() do
function Map:iter()
	local j = 0
	return function()
		while true do
			j += 1
			if j > self._n then
				return nil
			end
			local kk = self._k[j]
			if kk ~= TOMB then
				return mapUnkey(kk), self._v[j], true
			end
		end
	end
end
function Map:forEach(f)
	for k, v in self:iter() do
		f(v, k, self)
	end
end
function Map:keys()
	local out, n = {}, 0
	for k in self:iter() do
		n += 1
		out[n] = k
	end
	return mkarr(out, n)
end
function Map:values()
	local out, n = {}, 0
	for _, v in self:iter() do
		n += 1
		out[n] = v
	end
	return mkarr(out, n)
end
function Map:entries()
	local out, n = {}, 0
	for k, v in self:iter() do
		n += 1
		out[n] = Js.alit(k, v)
	end
	return mkarr(out, n)
end
Map.__jsiter = function(m)
	return m:entries()
end
Map.__jsclone = function(m, seen, cl)
	local out = Map.new()
	seen[m] = out
	for k, v in m:iter() do
		out:set(cl(k, seen), cl(v, seen))
	end
	return out
end

local Set = {}
Set.__index = Set
Set.__jsclass = true
Js.Set = Set
function Set.new(init)
	local s = setmetatable({ _m = Map.new(), size = 0 }, Set)
	if init ~= nil then
		local arr = toArray(init)
		for i = 1, alen(arr) do
			s:add(arr[i])
		end
	end
	return s
end
function Set:add(v)
	self._m:set(v, true)
	self.size = self._m.size
	return self
end
function Set:has(v)
	return self._m:has(v)
end
function Set:delete(v)
	local r = self._m:delete(v)
	self.size = self._m.size
	return r
end
function Set:clear()
	self._m:clear()
	self.size = 0
end
function Set:iter()
	local it = self._m:iter()
	return function()
		local k, _, ok = it()
		if ok then
			return k, k, true
		end
		return nil
	end
end
function Set:forEach(f)
	for v in self:iter() do
		f(v, v, self)
	end
end
function Set:values()
	return self._m:keys()
end
Set.keys = Set.values
function Set:entries()
	local out, n = {}, 0
	for v in self:iter() do
		n += 1
		out[n] = Js.alit(v, v)
	end
	return mkarr(out, n)
end
Set.__jsiter = function(s)
	return s:values()
end
Set.__jsclone = function(s, seen, cl)
	local out = Set.new()
	seen[s] = out
	for v in s:iter() do
		out:add(cl(v, seen))
	end
	return out
end

-- for-of over anything: returns an iterator giving (value)
function Js.iter(x)
	if isArray(x) then
		local i, n = 0, alen(x)
		return function()
			i += 1
			if i > alen(x) then
				return nil
			end
			return true, x[i]
		end
	end
	local mt = type(x) == "table" and getmetatable(x)
	if mt == Map then
		local it = x:iter()
		return function()
			local k, v, ok = it()
			if not ok then
				return nil
			end
			return true, Js.alit(k, v)
		end
	elseif mt == Set then
		local it = x:iter()
		return function()
			local v, _, ok = it()
			if not ok then
				return nil
			end
			return true, v
		end
	end
	local arr = toArray(x)
	local i = 0
	return function()
		i += 1
		if i > alen(arr) then
			return nil
		end
		return true, arr[i]
	end
end

-- ────────────────────────────────────────────────────────────── errors ──

local ErrorMT = {}
ErrorMT.__index = ErrorMT
ErrorMT.__tostring = function(e)
	return (e.name or "Error") .. ": " .. str(e.message)
end
local function mkError(name)
	return function(msg)
		return setmetatable(O({ name = name, message = msg == nil and "" or str(msg) }, { "name", "message" }), ErrorMT)
	end
end
Js.Error = mkError("Error")
Js.TypeError = mkError("TypeError")
Js.RangeError = mkError("RangeError")
Js.ErrorMT = ErrorMT

-- turn whatever pcall caught into a JavaScript-style error value
function Js.caught(e)
	if type(e) == "table" then
		return e
	end
	local msg = str(e)
	return setmetatable(O({ name = "Error", message = msg }, { "name", "message" }), ErrorMT)
end

-- ──────────────────────────────────────────────────────────────── Date ──

local Date = {}
Date.__index = Date
Date.__jsclass = true
Js.Date = Date

local DAY_MS = 86400000
local function daysFromCivil(y, m, d) -- m 1..12
	y = (m <= 2) and (y - 1) or y
	local era = floor(y / 400)
	local yoe = y - era * 400
	local mp = (m + 9) % 12
	local doy = floor((153 * mp + 2) / 5) + d - 1
	local doe = yoe * 365 + floor(yoe / 4) - floor(yoe / 100) + doy
	return era * 146097 + doe - 719468
end
local function civilFromDays(z)
	z += 719468
	local era = floor(z / 146097)
	local doe = z - era * 146097
	local yoe = floor((doe - floor(doe / 1460) + floor(doe / 36524) - floor(doe / 146096)) / 365)
	local y = yoe + era * 400
	local doy = doe - (365 * yoe + floor(yoe / 4) - floor(yoe / 100))
	local mp = floor((5 * doy + 2) / 153)
	local d = doy - floor((153 * mp + 2) / 5) + 1
	local m = mp < 10 and mp + 3 or mp - 9
	if m <= 2 then
		y += 1
	end
	return y, m, d
end

function Date.UTC(y, mon, d, h, mi, s, ms)
	mon = mon or 0
	-- months outside 0..11 roll into years, like JavaScript
	y += floor(mon / 12)
	mon = mon % 12
	local days = daysFromCivil(y, mon + 1, 1) + ((d or 1) - 1)
	return days * DAY_MS + (h or 0) * 3600000 + (mi or 0) * 60000 + (s or 0) * 1000 + (ms or 0)
end

local function nowMs()
	if DateTime then
		return DateTime.now().UnixTimestampMillis
	end
	return os.time() * 1000
end
Date.now = nowMs

local function parseDate(s)
	local y, mo, d, rest = string.match(s, "^(%d%d%d%d)%-(%d%d)%-(%d%d)(.*)$")
	if not y then
		return 0 / 0
	end
	local h, mi, sec, ms = 0, 0, 0, 0
	local hh, mm, tail = string.match(rest, "^[T ](%d%d):(%d%d)(.*)$")
	local tz = 0
	if hh then
		h, mi = tonumber(hh), tonumber(mm)
		local ss, tail2 = string.match(tail, "^:(%d%d)(.*)$")
		if ss then
			sec = tonumber(ss)
			tail = tail2
			local frac, tail3 = string.match(tail, "^%.(%d+)(.*)$")
			if frac then
				ms = floor(tonumber("0." .. frac) * 1000 + 0.5)
				tail = tail3
			end
		end
		local sign, th, tm = string.match(tail, "^([-+])(%d%d):?(%d%d)$")
		if sign then
			tz = (tonumber(th) * 60 + tonumber(tm)) * 60000 * (sign == "+" and 1 or -1)
		end
	end
	return Date.UTC(tonumber(y), tonumber(mo) - 1, tonumber(d), h, mi, sec, ms) - tz
end

function Date.new(...)
	local n = select("#", ...)
	local t
	if n == 0 then
		t = nowMs()
	elseif n == 1 then
		local v = (...)
		if type(v) == "table" and getmetatable(v) == Date then
			t = v._t
		elseif type(v) == "string" then
			t = parseDate(v)
		else
			t = tonum(v)
		end
	else
		-- local time = UTC here (Roblox servers run on UTC)
		t = Date.UTC(...)
	end
	return setmetatable({ _t = t }, Date)
end
Date.__jsvalueOf = function(d)
	return d._t
end
Date.__jsclone = function(d)
	return Date.new(d._t)
end
function Date:getTime()
	return self._t
end
Date.valueOf = Date.getTime
local function parts(self)
	local t = self._t
	local days = floor(t / DAY_MS)
	local msInDay = t - days * DAY_MS
	local y, m, d = civilFromDays(days)
	return y, m, d, days, msInDay
end
function Date:getUTCFullYear()
	return (select(1, parts(self)))
end
function Date:getUTCMonth()
	local _, m = parts(self)
	return m - 1
end
function Date:getUTCDate()
	local _, _, d = parts(self)
	return d
end
function Date:getUTCDay()
	local days = floor(self._t / DAY_MS)
	return (days + 4) % 7
end
function Date:getUTCHours()
	return floor((self._t % DAY_MS) / 3600000)
end
function Date:getUTCMinutes()
	return floor((self._t % 3600000) / 60000)
end
function Date:getUTCSeconds()
	return floor((self._t % 60000) / 1000)
end
function Date:getUTCMilliseconds()
	return self._t % 1000
end
Date.getFullYear = Date.getUTCFullYear
Date.getMonth = Date.getUTCMonth
Date.getDate = Date.getUTCDate
Date.getDay = Date.getUTCDay
Date.getHours = Date.getUTCHours
Date.getMinutes = Date.getUTCMinutes
Date.getSeconds = Date.getUTCSeconds
function Date:getTimezoneOffset()
	return 0
end
function Date:setUTCDate(d)
	local y, m, _, _, ms = parts(self)
	self._t = Date.UTC(y, m - 1, d) + ms
	return self._t
end
Date.setDate = Date.setUTCDate
function Date:setUTCHours(h, mi, s, ms)
	local days = floor(self._t / DAY_MS)
	self._t = days * DAY_MS + h * 3600000 + (mi or self:getUTCMinutes()) * 60000 + (s or self:getUTCSeconds()) * 1000 + (ms or 0)
	return self._t
end
Date.setHours = Date.setUTCHours
function Date:setTime(t)
	self._t = t
	return t
end
function Date:toISOString()
	local y, m, d = parts(self)
	return sformat(
		"%04d-%02d-%02dT%02d:%02d:%02d.%03dZ",
		y,
		m,
		d,
		self:getUTCHours(),
		self:getUTCMinutes(),
		self:getUTCSeconds(),
		self:getUTCMilliseconds()
	)
end
Date.toJSON = Date.toISOString
local MONTHS = { "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December" }
local DAYS = { "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday" }
function Date:toLocaleDateString(_locale, opts)
	local y, m, d = parts(self)
	opts = opts or {}
	local out = {}
	if opts.weekday then
		local w = DAYS[self:getUTCDay() + 1]
		out[#out + 1] = (opts.weekday == "short") and ssub(w, 1, 3) or w
	end
	if opts.day then
		out[#out + 1] = tostring(d)
	end
	if opts.month then
		local mn = MONTHS[m]
		if opts.month == "short" then
			mn = ssub(mn, 1, 3)
		elseif opts.month == "numeric" or opts.month == "2-digit" then
			mn = sformat("%02d", m)
		end
		out[#out + 1] = mn
	end
	if opts.year then
		out[#out + 1] = tostring(y)
	end
	if #out == 0 then
		return sformat("%02d/%02d/%04d", d, m, y)
	end
	return tconcat(out, " ")
end
Date.__tostring = function(self)
	return self:toISOString()
end

-- ──────────────────────────────────────────────────────────────── JSON ──

local JSON = {}
Js.JSON = JSON

local function jsonQuote(s)
	return '"'
		.. string.gsub(s, '[%c"\\]', function(c)
			if c == '"' then
				return '\\"'
			elseif c == "\\" then
				return "\\\\"
			elseif c == "\n" then
				return "\\n"
			elseif c == "\r" then
				return "\\r"
			elseif c == "\t" then
				return "\\t"
			elseif c == "\b" then
				return "\\b"
			elseif c == "\f" then
				return "\\f"
			end
			return sformat("\\u%04x", sbyte(c))
		end)
		.. '"'
end
Js.jsonQuote = jsonQuote

function JSON.stringify(v, replacer, indent)
	local gap = ""
	if type(indent) == "number" then
		gap = srep(" ", math.min(10, indent))
	elseif type(indent) == "string" then
		gap = ssub(indent, 1, 10)
	end
	local repFn = type(replacer) == "function" and replacer or nil
	local function ser(holderKey, val, ind)
		if type(val) == "table" then
			local mt = getmetatable(val)
			if mt and mt.toJSON then
				val = val:toJSON()
			end
		end
		if repFn then
			val = repFn(holderKey, val)
		end
		local t = type(val)
		if t == "nil" or t == "function" then
			return nil
		elseif t == "boolean" then
			return val and "true" or "false"
		elseif t == "number" then
			if val ~= val or val == huge or val == -huge then
				return "null"
			end
			return numstr(val)
		elseif t == "string" then
			return jsonQuote(val)
		elseif t == "table" then
			if val == Js.null then
				return "null"
			end
			local inner = ind .. gap
			local sep = gap ~= "" and (",\n" .. inner) or ","
			if isArray(val) then
				local n = alen(val)
				if n == 0 then
					return "[]"
				end
				local parts = {}
				for i = 1, n do
					parts[i] = ser(numstr(i - 1), val[i], inner) or "null"
				end
				if gap ~= "" then
					return "[\n" .. inner .. tconcat(parts, sep) .. "\n" .. ind .. "]"
				end
				return "[" .. tconcat(parts, ",") .. "]"
			end
			local mt = getmetatable(val)
			if mt == Map or mt == Set then
				return "{}"
			end
			local ks = okeys(val)
			local parts = {}
			for i = 1, alen(ks) do
				local k = ks[i]
				local s = ser(k, oget(val, k), inner)
				if s ~= nil then
					parts[#parts + 1] = jsonQuote(k) .. (gap ~= "" and ": " or ":") .. s
				end
			end
			if #parts == 0 then
				return "{}"
			end
			if gap ~= "" then
				return "{\n" .. inner .. tconcat(parts, sep) .. "\n" .. ind .. "}"
			end
			return "{" .. tconcat(parts, ",") .. "}"
		end
		return nil
	end
	return ser("", v, "")
end

function JSON.parse(s)
	local i = 1
	local n = #s
	local function ws()
		i = sfind(s, "[^ \t\r\n]", i) or (n + 1)
	end
	local parseValue
	local function err(msg)
		error(Js.Error("JSON.parse: " .. msg .. " at " .. i), 0)
	end
	local function parseString()
		i += 1
		local parts = {}
		while true do
			local j = sfind(s, '["\\]', i)
			if not j then
				err("unterminated string")
			end
			parts[#parts + 1] = ssub(s, i, j - 1)
			local c = ssub(s, j, j)
			if c == '"' then
				i = j + 1
				break
			end
			local e = ssub(s, j + 1, j + 1)
			if e == "u" then
				local cp = tonumber(ssub(s, j + 2, j + 5), 16)
				i = j + 6
				if cp >= 0xD800 and cp <= 0xDBFF and ssub(s, i, i + 1) == "\\u" then
					local lo = tonumber(ssub(s, i + 2, i + 5), 16)
					if lo and lo >= 0xDC00 and lo <= 0xDFFF then
						cp = 0x10000 + (cp - 0xD800) * 0x400 + (lo - 0xDC00)
						i += 6
					end
				end
				parts[#parts + 1] = utf8.char(cp)
			else
				local map = { b = "\b", f = "\f", n = "\n", r = "\r", t = "\t" }
				parts[#parts + 1] = map[e] or e
				i = j + 2
			end
		end
		return tconcat(parts)
	end
	parseValue = function()
		ws()
		local c = ssub(s, i, i)
		if c == "{" then
			i += 1
			local o = O({}, {})
			ws()
			if ssub(s, i, i) == "}" then
				i += 1
				return o
			end
			while true do
				ws()
				if ssub(s, i, i) ~= '"' then
					err("expected key")
				end
				local k = parseString()
				ws()
				if ssub(s, i, i) ~= ":" then
					err("expected ':'")
				end
				i += 1
				local v = parseValue()
				o[k] = v
				ws()
				local d = ssub(s, i, i)
				i += 1
				if d == "}" then
					return o
				end
				if d ~= "," then
					err("expected ',' or '}'")
				end
			end
		elseif c == "[" then
			i += 1
			local a, m = {}, 0
			ws()
			if ssub(s, i, i) == "]" then
				i += 1
				return mkarr(a, 0)
			end
			while true do
				m += 1
				a[m] = parseValue()
				ws()
				local d = ssub(s, i, i)
				i += 1
				if d == "]" then
					return mkarr(a, m)
				end
				if d ~= "," then
					err("expected ',' or ']'")
				end
			end
		elseif c == '"' then
			return parseString()
		elseif ssub(s, i, i + 3) == "true" then
			i += 4
			return true
		elseif ssub(s, i, i + 4) == "false" then
			i += 5
			return false
		elseif ssub(s, i, i + 3) == "null" then
			i += 4
			return nil
		else
			local num = string.match(s, "^-?%d+%.?%d*[eE]?[-+]?%d*", i)
			if not num or num == "" then
				err("unexpected character '" .. c .. "'")
			end
			i += #num
			return tonumber(num)
		end
	end
	local v = parseValue()
	ws()
	if i <= n then
		err("unexpected trailing text")
	end
	return v
end

-- ─────────────────────────────────────────────────────────────── RegExp ──
-- A small backtracking engine for the JavaScript patterns the game uses:
-- classes, escapes (\d \w \s \b), anchors, groups (capturing, (?:), (?=),
-- (?!)), alternation, greedy and lazy quantifiers; flags g, i, m, s, u, y.
-- It works on UTF-16 code units, like JavaScript.

local RegExp = {}
RegExp.__index = RegExp
RegExp.__jsclass = true
Js.RegExp = RegExp

local function isWord(c)
	return c and ((c >= 48 and c <= 57) or (c >= 65 and c <= 90) or (c >= 97 and c <= 122) or c == 95)
end
local function isDigit(c)
	return c and c >= 48 and c <= 57
end
local function isSpace(c)
	return c
		and (
			c == 32 or (c >= 9 and c <= 13) or c == 0xA0 or c == 0xFEFF or c == 0x1680 or (c >= 0x2000 and c <= 0x200A)
			or c == 0x2028 or c == 0x2029 or c == 0x202F or c == 0x205F or c == 0x3000
		)
end
local function foldCase(c)
	if c >= 65 and c <= 90 then
		return c + 32
	end
	return LOWER[c] or c
end

local function compileRegex(src)
	local u = safeUnits(src)
	local pos = 1
	local ngroups = 0
	local function peek()
		return u[pos]
	end
	local function eat()
		local c = u[pos]
		pos += 1
		return c
	end
	local parseAlt
	local function parseClassEscape()
		local c = eat()
		if c == 100 then
			return { kind = "fn", f = isDigit }
		elseif c == 68 then
			return { kind = "fn", f = function(x)
				return not isDigit(x)
			end }
		elseif c == 119 then
			return { kind = "fn", f = isWord }
		elseif c == 87 then
			return { kind = "fn", f = function(x)
				return not isWord(x)
			end }
		elseif c == 115 then
			return { kind = "fn", f = isSpace }
		elseif c == 83 then
			return { kind = "fn", f = function(x)
				return not isSpace(x)
			end }
		elseif c == 110 then
			return { kind = "ch", c = 10 }
		elseif c == 114 then
			return { kind = "ch", c = 13 }
		elseif c == 116 then
			return { kind = "ch", c = 9 }
		elseif c == 118 then
			return { kind = "ch", c = 11 }
		elseif c == 102 then
			return { kind = "ch", c = 12 }
		elseif c == 48 then
			return { kind = "ch", c = 0 }
		elseif c == 117 then -- \uXXXX or \u{X}
			if u[pos] == 123 then
				pos += 1
				local hex = {}
				while u[pos] ~= 125 do
					hex[#hex + 1] = schar(eat())
				end
				pos += 1
				return { kind = "ch", c = tonumber(tconcat(hex), 16) }
			end
			local hex = fromUnits(u, pos, pos + 3)
			pos += 4
			return { kind = "ch", c = tonumber(hex, 16) }
		elseif c == 120 then
			local hex = fromUnits(u, pos, pos + 1)
			pos += 2
			return { kind = "ch", c = tonumber(hex, 16) }
		end
		return { kind = "ch", c = c }
	end
	local function parseClass()
		-- after '['
		local neg = false
		if peek() == 94 then
			neg = true
			pos += 1
		end
		local items = {}
		local first = true
		while pos <= #u and (peek() ~= 93 or (first and false)) do
			first = false
			local lo
			local c = eat()
			if c == 92 then
				lo = parseClassEscape()
				if lo.c == 98 and lo.kind == "ch" then
					lo = { kind = "ch", c = 8 }
				end
			else
				lo = { kind = "ch", c = c }
			end
			if lo.kind == "ch" and peek() == 45 and u[pos + 1] ~= 93 and u[pos + 1] ~= nil then
				pos += 1
				local hc = eat()
				local hi
				if hc == 92 then
					hi = parseClassEscape()
				else
					hi = { kind = "ch", c = hc }
				end
				items[#items + 1] = { kind = "range", lo = lo.c, hi = hi.c }
			else
				items[#items + 1] = lo
			end
		end
		pos += 1 -- ']'
		return { t = "class", neg = neg, items = items }
	end
	local function parseAtom()
		local c = eat()
		if c == 40 then -- (
			if peek() == 63 then -- ?
				pos += 1
				local k = eat()
				if k == 58 then
					local alt = parseAlt()
					pos += 1
					return { t = "group", alt = alt }
				elseif k == 61 or k == 33 then
					local alt = parseAlt()
					pos += 1
					return { t = "look", alt = alt, neg = (k == 33) }
				elseif k == 60 then -- (?<name>
					while eat() ~= 62 do
					end
					ngroups += 1
					local idx = ngroups
					local alt = parseAlt()
					pos += 1
					return { t = "group", alt = alt, cap = idx }
				end
				error("regex: unsupported group")
			end
			ngroups += 1
			local idx = ngroups
			local alt = parseAlt()
			pos += 1
			return { t = "group", alt = alt, cap = idx }
		elseif c == 91 then
			return parseClass()
		elseif c == 46 then
			return { t = "any" }
		elseif c == 94 then
			return { t = "bol" }
		elseif c == 36 then
			return { t = "eol" }
		elseif c == 92 then
			local nx = peek()
			if nx == 98 then
				pos += 1
				return { t = "wordb", neg = false }
			elseif nx == 66 then
				pos += 1
				return { t = "wordb", neg = true }
			elseif nx and nx >= 49 and nx <= 57 then
				pos += 1
				return { t = "backref", n = nx - 48 }
			end
			local e = parseClassEscape()
			if e.kind == "fn" then
				return { t = "class", neg = false, items = { e } }
			end
			return { t = "char", c = e.c }
		end
		return { t = "char", c = c }
	end
	local function parseSeq()
		local seq = {}
		while pos <= #u and peek() ~= 124 and peek() ~= 41 do
			local atom = parseAtom()
			local q = peek()
			local mn, mx
			if q == 42 then
				mn, mx = 0, huge
				pos += 1
			elseif q == 43 then
				mn, mx = 1, huge
				pos += 1
			elseif q == 63 then
				mn, mx = 0, 1
				pos += 1
			elseif q == 123 then
				local save = pos
				pos += 1
				local a = {}
				while peek() and isDigit(peek()) do
					a[#a + 1] = schar(eat())
				end
				local b
				if peek() == 44 then
					pos += 1
					local bb = {}
					while peek() and isDigit(peek()) do
						bb[#bb + 1] = schar(eat())
					end
					b = (#bb > 0) and tonumber(tconcat(bb)) or huge
				end
				if peek() == 125 and #a > 0 then
					pos += 1
					mn = tonumber(tconcat(a))
					mx = b or mn
				else
					pos = save
					pos += 1
					atom = { t = "char", c = 123 }
				end
			end
			if mn then
				local lazy = false
				if peek() == 63 then
					lazy = true
					pos += 1
				end
				atom = { t = "rep", node = atom, min = mn, max = mx, lazy = lazy }
			end
			seq[#seq + 1] = atom
		end
		return seq
	end
	parseAlt = function()
		local alts = { parseSeq() }
		while peek() == 124 do
			pos += 1
			alts[#alts + 1] = parseSeq()
		end
		return alts
	end
	local ast = parseAlt()
	return ast, ngroups
end

local REGEX_CACHE = {}

function RegExp.new(source, flags)
	if type(source) == "table" and getmetatable(source) == RegExp then
		flags = flags or source.flags
		source = source.source
	end
	source = str(source)
	flags = flags or ""
	local key = source .. "/" .. flags
	local c = REGEX_CACHE[key]
	if not c then
		local ast, ng = compileRegex(source)
		c = { ast = ast, ng = ng }
		REGEX_CACHE[key] = c
	end
	return setmetatable({
		source = source,
		flags = flags,
		global = sfind(flags, "g", 1, true) ~= nil,
		ignoreCase = sfind(flags, "i", 1, true) ~= nil,
		multiline = sfind(flags, "m", 1, true) ~= nil,
		dotAll = sfind(flags, "s", 1, true) ~= nil,
		sticky = sfind(flags, "y", 1, true) ~= nil,
		lastIndex = 0,
		_ast = c.ast,
		_ng = c.ng,
	}, RegExp)
end

local function matchHere(re, u, n, startPos)
	local ic, ml, da = re.ignoreCase, re.multiline, re.dotAll
	local caps = {}
	local function classMatch(node, c)
		if c == nil then
			return false
		end
		local hit = false
		for _, it in node.items do
			if it.kind == "ch" then
				if it.c == c or (ic and foldCase(it.c) == foldCase(c)) then
					hit = true
					break
				end
			elseif it.kind == "range" then
				if (c >= it.lo and c <= it.hi) then
					hit = true
					break
				end
				if ic then
					local fc = foldCase(c)
					local uc = (fc >= 97 and fc <= 122) and fc - 32 or fc
					if (fc >= it.lo and fc <= it.hi) or (uc >= it.lo and uc <= it.hi) then
						hit = true
						break
					end
				end
			elseif it.kind == "fn" then
				if it.f(c) then
					hit = true
					break
				end
			end
		end
		if node.neg then
			return not hit
		end
		return hit
	end
	local matchSeq, matchAlt
	-- match node at i, then continuation k(i2)
	local function matchNode(node, i, k)
		local t = node.t
		if t == "char" then
			local c = u[i]
			if c ~= nil and (c == node.c or (ic and foldCase(c) == foldCase(node.c))) then
				return k(i + 1)
			end
			return nil
		elseif t == "any" then
			local c = u[i]
			if c ~= nil and (da or (c ~= 10 and c ~= 13 and c ~= 0x2028 and c ~= 0x2029)) then
				return k(i + 1)
			end
			return nil
		elseif t == "class" then
			if classMatch(node, u[i]) then
				return k(i + 1)
			end
			return nil
		elseif t == "bol" then
			if i == 1 or (ml and (u[i - 1] == 10 or u[i - 1] == 13)) then
				return k(i)
			end
			return nil
		elseif t == "eol" then
			if i == n + 1 or (ml and (u[i] == 10 or u[i] == 13)) then
				return k(i)
			end
			return nil
		elseif t == "wordb" then
			local a = isWord(u[i - 1]) and true or false
			local b = isWord(u[i]) and true or false
			if (a ~= b) ~= node.neg then
				return k(i)
			end
			return nil
		elseif t == "group" then
			if node.cap then
				local idx = node.cap
				local old = caps[idx]
				local r = matchAlt(node.alt, i, function(j)
					local prev = caps[idx]
					caps[idx] = { i, j }
					local r2 = k(j)
					if r2 == nil then
						caps[idx] = prev
					end
					return r2
				end)
				if r == nil then
					caps[idx] = old
				end
				return r
			end
			return matchAlt(node.alt, i, k)
		elseif t == "look" then
			local saved = table.clone(caps)
			local r = matchAlt(node.alt, i, function(j)
				return j
			end)
			if node.neg then
				caps = saved
				if r == nil then
					return k(i)
				end
				return nil
			end
			if r ~= nil then
				return k(i)
			end
			caps = saved
			return nil
		elseif t == "backref" then
			local cp = caps[node.n]
			if not cp then
				return k(i)
			end
			local len = cp[2] - cp[1]
			for d = 0, len - 1 do
				if u[i + d] ~= u[cp[1] + d] then
					return nil
				end
			end
			return k(i + len)
		elseif t == "rep" then
			local inner, mn, mx = node.node, node.min, node.max
			local function try(count, j)
				if node.lazy then
					if count >= mn then
						local r = k(j)
						if r ~= nil then
							return r
						end
					end
					if count < mx then
						return matchNode(inner, j, function(j2)
							if j2 == j and count >= mn then
								return nil
							end
							return try(count + 1, j2)
						end)
					end
					return nil
				end
				if count < mx then
					local r = matchNode(inner, j, function(j2)
						if j2 == j then
							return nil -- empty loop
						end
						return try(count + 1, j2)
					end)
					if r ~= nil then
						return r
					end
				end
				if count >= mn then
					return k(j)
				end
				return nil
			end
			-- fast path for simple single-unit nodes, greedy
			if not node.lazy and (inner.t == "char" or inner.t == "class" or inner.t == "any") then
				local j = i
				local count = 0
				while count < mx do
					local ok = matchNode(inner, j, function(j2)
						return j2
					end)
					if ok == nil then
						break
					end
					j = ok
					count += 1
				end
				while count >= mn do
					local r = k(j)
					if r ~= nil then
						return r
					end
					j -= 1
					count -= 1
				end
				return nil
			end
			return try(0, i)
		end
		error("regex: bad node")
	end
	matchSeq = function(seq, idx, i, k)
		if idx > #seq then
			return k(i)
		end
		return matchNode(seq[idx], i, function(j)
			return matchSeq(seq, idx + 1, j, k)
		end)
	end
	matchAlt = function(alts, i, k)
		for _, seq in alts do
			local r = matchSeq(seq, 1, i, k)
			if r ~= nil then
				return r
			end
		end
		return nil
	end
	local e = matchAlt(re._ast, startPos, function(j)
		return j
	end)
	if e == nil then
		return nil
	end
	return e, caps
end

-- Run the regex from unit position `from` (0-based). Returns a match array
-- (with .index and .input) or nil. Does not touch lastIndex.
function RegExp.execAt(re, s, from)
	local u, n = safeUnits(s)
	local start = from + 1
	local last = re.sticky and start or (n + 1)
	for p = start, last do
		local e, caps = matchHere(re, u, n, p)
		if e then
			local out = { fromUnits(u, p, e - 1) }
			for g = 1, re._ng do
				local c = caps[g]
				out[g + 1] = c and fromUnits(u, c[1], c[2] - 1) or nil
			end
			mkarr(out, re._ng + 1)
			rawset(out, "index", p - 1)
			rawset(out, "input", s)
			out._end = e - 1
			return out
		end
	end
	return nil
end

function RegExp.exec(re, s)
	s = str(s)
	local from = (re.global or re.sticky) and re.lastIndex or 0
	if from > slen(s) then
		re.lastIndex = 0
		return nil
	end
	local m = RegExp.execAt(re, s, from)
	if re.global or re.sticky then
		if m then
			local e = m._end
			if e == m.index then
				e += 0
			end
			re.lastIndex = e
		else
			re.lastIndex = 0
		end
	end
	return m
end
function RegExp.test(re, s)
	return RegExp.exec(re, s) ~= nil
end

function RegExp.match(re, s)
	if not re.global then
		return RegExp.exec(re, s)
	end
	local out, n = {}, 0
	local pos = 0
	local len = slen(s)
	while pos <= len do
		local m = RegExp.execAt(re, s, pos)
		if not m then
			break
		end
		n += 1
		out[n] = m[1]
		pos = (m._end > m.index) and m._end or (m.index + 1)
	end
	re.lastIndex = 0
	if n == 0 then
		return nil
	end
	return mkarr(out, n)
end

function RegExp.matchAll(re, s)
	local out, n = {}, 0
	local pos = 0
	local len = slen(s)
	while pos <= len do
		local m = RegExp.execAt(re, s, pos)
		if not m then
			break
		end
		n += 1
		out[n] = m
		pos = (m._end > m.index) and m._end or (m.index + 1)
		if not re.global then
			break
		end
	end
	return mkarr(out, n)
end

function RegExp.replace(re, s, rep, all)
	local len = slen(s)
	local parts = {}
	local pos = 0
	local cursor = 0
	local global = re.global or all
	while pos <= len do
		local m = RegExp.execAt(re, s, pos)
		if not m then
			break
		end
		parts[#parts + 1] = S.slice(s, cursor, m.index)
		local groups = {}
		for g = 2, alen(m) do
			groups[g - 1] = m[g]
		end
		if type(rep) == "function" then
			local args = { m[1] }
			for g = 2, alen(m) do
				args[g] = m[g]
			end
			args[alen(m) + 1] = m.index
			args[alen(m) + 2] = s
			parts[#parts + 1] = str(rep(table.unpack(args, 1, alen(m) + 2)))
		else
			parts[#parts + 1] = expandReplacement(str(rep), m[1], m.index, s, groups)
		end
		cursor = m._end
		if not global then
			break
		end
		pos = (m._end > m.index) and m._end or (m.index + 1)
		if m._end == m.index and m.index < len then
			-- an empty match: keep the character it skipped
			parts[#parts + 1] = S.slice(s, m.index, m.index + 1)
			cursor = m.index + 1
		end
	end
	parts[#parts + 1] = S.slice(s, cursor)
	if re.global then
		re.lastIndex = 0
	end
	return tconcat(parts)
end

function RegExp.split(re, s, limit)
	local out, n = {}, 0
	local u, len = safeUnits(s)
	if len == 0 then
		if matchHere(re, u, len, 1) then
			return mkarr({}, 0)
		end
		return Js.alit(s)
	end
	local p, q = 0, 0
	while q < len do
		local e, caps = matchHere(re, u, len, q + 1)
		if e == nil or (e - 1) == p then
			q += 1
		else
			n += 1
			out[n] = fromUnits(u, p + 1, q)
			if n >= limit then
				return mkarr(out, n)
			end
			for g = 1, re._ng do
				local c = caps[g]
				n += 1
				out[n] = c and fromUnits(u, c[1], c[2] - 1) or nil
				if n >= limit then
					return mkarr(out, n)
				end
			end
			p = e - 1
			q = p
		end
	end
	n += 1
	out[n] = fromUnits(u, p + 1, len)
	return mkarr(out, n)
end

-- regex literal: /src/flags
function Js.re(source, flags)
	return RegExp.new(source, flags)
end

-- ───────────────────────────────────────────────────────────── console ──

local console = {}
Js.console = console
local function logLine(...)
	local parts = {}
	for i = 1, select("#", ...) do
		local v = select(i, ...)
		if type(v) == "table" and getmetatable(v) ~= ErrorMT and getmetatable(v) ~= Date then
			local ok, s = pcall(JSON.stringify, v)
			parts[i] = ok and (s or "undefined") or str(v)
		else
			parts[i] = str(v)
		end
	end
	return tconcat(parts, " ")
end
console.log = function(...)
	print(logLine(...))
end
console.info = console.log
console.debug = function() end
console.warn = function(...)
	if warn then
		warn(logLine(...))
	else
		print(logLine(...))
	end
end
console.error = console.warn
console.table = console.log
console.time = function() end
console.timeEnd = function() end
console.assert = function(c, ...)
	if not c then
		console.warn("Assertion failed:", ...)
	end
end

-- ─────────────────────────────────────────────────────── module loading ──
-- Every converted file is `return function(exports, import, Js) ... end`.
-- import("lib/star/season") returns that file's exports, running it once.
-- A cycle gets the half-filled exports table, exactly as JavaScript does.

function Js.makeImporter(fetchModule)
	local cache = {}
	local function import(path)
		local ex = cache[path]
		if ex then
			return ex
		end
		ex = {}
		cache[path] = ex
		local fn = fetchModule(path)
		if fn == nil then
			error("Js.import: no module '" .. path .. "'", 2)
		end
		local ret = fn(ex, import, Js)
		if ret ~= nil then
			-- a module that returns a value replaces its exports (data files)
			for k, v in pairs(ret) do
				ex[k] = v
			end
		end
		return ex
	end
	return import
end

-- `export * from` and `export { a } from`: read lazily so cycles work
function Js.reexport(exports, fromExports, names)
	local mt = getmetatable(exports)
	if not mt then
		mt = { __from = {} }
		mt.__index = function(_, k)
			for _, src in mt.__from do
				if src.names == nil or src.names[k] then
					local v = src.ex[(src.names and src.names[k]) or k]
					if v ~= nil then
						return v
					end
				end
			end
			return nil
		end
		setmetatable(exports, mt)
	end
	table.insert(mt.__from, { ex = fromExports, names = names })
end

-- ──────────────────────────────────────────── comparisons, misc globals ──

-- a < b etc. when either side may be undefined (JavaScript gives false)
local function cmpPrep(a, b)
	if a == nil or b == nil then
		return nil
	end
	local ta, tb = type(a), type(b)
	if ta == "string" and tb == "string" then
		return a, b
	end
	a, b = tonum(a), tonum(b)
	if a ~= a or b ~= b then
		return nil
	end
	return a, b
end
function Js.lt(a, b)
	local x, y = cmpPrep(a, b)
	return x ~= nil and x < y
end
function Js.gt(a, b)
	local x, y = cmpPrep(a, b)
	return x ~= nil and x > y
end
function Js.le(a, b)
	local x, y = cmpPrep(a, b)
	return x ~= nil and x <= y
end
function Js.ge(a, b)
	local x, y = cmpPrep(a, b)
	return x ~= nil and x >= y
end

function Js.instanceof(x, cls)
	if type(x) ~= "table" then
		return false
	end
	if cls == Js.Array then
		return isArray(x)
	end
	if cls == Js.Error or cls == Js.TypeError or cls == Js.RangeError then
		return getmetatable(x) == ErrorMT
	end
	local mt = getmetatable(x)
	return mt ~= nil and (mt == cls or mt.__index == cls)
end

-- marks a `return` from inside a try block (the converter's pcall wrapper)
Js.RET = setmetatable({}, { __tostring = function()
	return "Js.RET"
end })

-- Promises resolve at once: Roblox calls that wait (HttpService) simply
-- yield, so `await` is a plain call and every Promise is already settled.
local Promise = {}
Promise.__index = Promise
Promise.__jsclass = true
Js.Promise = Promise
local function settled(ok, v)
	return setmetatable({ _ok = ok, _v = v }, Promise)
end
function Promise.resolve(v)
	if type(v) == "table" and getmetatable(v) == Promise then
		return v
	end
	return settled(true, v)
end
function Promise.reject(e)
	return settled(false, e)
end
function Promise.new(executor)
	local p = settled(true, nil)
	local done = false
	local ok, e = pcall(executor, function(v)
		if not done then
			done = true
			local r = Promise.resolve(v)
			p._ok, p._v = r._ok, r._v
		end
	end, function(e)
		if not done then
			done = true
			p._ok, p._v = false, e
		end
	end)
	if not ok and not done then
		p._ok, p._v = false, Js.caught(e)
	end
	return p
end
function Promise:andThen(onOk, onErr)
	local f = self._ok and onOk or onErr
	if f == nil then
		return self
	end
	local ok, r = pcall(f, self._v)
	if not ok then
		return settled(false, Js.caught(r))
	end
	return Promise.resolve(r)
end
Promise["then"] = Promise.andThen
function Promise:catch_(onErr)
	return self:andThen(nil, onErr)
end
Promise["catch"] = Promise.catch_
function Promise:finally_(f)
	f()
	return self
end
function Promise.all(list)
	local arr = toArray(list)
	local out = {}
	for i = 1, alen(arr) do
		local p = Promise.resolve(arr[i])
		if not p._ok then
			return p
		end
		out[i] = p._v
	end
	return settled(true, mkarr(out, alen(arr)))
end
function Promise.allSettled(list)
	local arr = toArray(list)
	local out = {}
	for i = 1, alen(arr) do
		local p = Promise.resolve(arr[i])
		out[i] = p._ok and O({ status = "fulfilled", value = p._v }, { "status", "value" })
			or O({ status = "rejected", reason = p._v }, { "status", "reason" })
	end
	return settled(true, mkarr(out, alen(arr)))
end
-- `await p`
function Js.await(p)
	if type(p) == "table" and getmetatable(p) == Promise then
		if p._ok then
			return p._v
		end
		error(p._v, 0)
	end
	return p
end

-- localStorage: kept in memory; the Roblox save (DataStore) loads and stores
-- it as one table per player.
local storage = { _items = {} }
Js.localStorage = storage
function storage.getItem(k)
	return storage._items[k]
end
function storage.setItem(k, v)
	storage._items[k] = str(v)
end
function storage.removeItem(k)
	storage._items[k] = nil
end
function storage.clear()
	storage._items = {}
end

-- fetch: set Js.fetchImpl on the server (HttpService). Without it, every
-- fetch fails and the game falls back to its invented players, as the
-- website does when it is offline.
Js.fetchBase = "https://knowitball.co.uk"
function Js.fetch(url, init)
	if Js.fetchImpl == nil then
		return Promise.reject(Js.Error("fetch is not available here"))
	end
	if ssub(url, 1, 1) == "/" then
		url = Js.fetchBase .. url
	end
	local ok, res = pcall(Js.fetchImpl, url, init)
	if not ok then
		return Promise.reject(Js.caught(res))
	end
	return Promise.resolve(res)
end

function Js.encodeURIComponent(s)
	s = str(s)
	return (string.gsub(s, "[^%w%-_%.!~%*'%(%)]", function(c)
		return sformat("%%%02X", sbyte(c))
	end))
end
function Js.decodeURIComponent(s)
	return (string.gsub(s, "%%(%x%x)", function(h)
		return schar(tonumber(h, 16))
	end))
end

Js.process = { env = {} }
Js.globalThis = {}
Js.window = nil
Js.performance = { now = function()
	return os.clock() * 1000
end }
function Js.setTimeout(f)
	if task then
		task.defer(f)
	end
	return 0
end
function Js.clearTimeout() end

Js.null = nil
Js.undefined = nil
Js.NaN = 0 / 0
Js.Infinity = huge

return Js
