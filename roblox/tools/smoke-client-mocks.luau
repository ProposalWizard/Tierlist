-- Stand-ins for the Roblox pieces the match client uses (client smoke test only).
-- Loaded after smoke-mocks.luau (the server's stand-ins), and replaces Instance.

-- ───────────────────────────────────────────── Vector3, Vector2, CFrame ──
local V3 = {}
V3.__index = V3
local function v3(x, y, z)
	return setmetatable({ X = x or 0, Y = y or 0, Z = z or 0 }, V3)
end
V3.__add = function(a, b)
	return v3(a.X + b.X, a.Y + b.Y, a.Z + b.Z)
end
V3.__sub = function(a, b)
	return v3(a.X - b.X, a.Y - b.Y, a.Z - b.Z)
end
V3.__mul = function(a, b)
	if type(a) == "number" then
		return v3(b.X * a, b.Y * a, b.Z * a)
	elseif type(b) == "number" then
		return v3(a.X * b, a.Y * b, a.Z * b)
	end
	return v3(a.X * b.X, a.Y * b.Y, a.Z * b.Z)
end
V3.__div = function(a, b)
	return v3(a.X / b, a.Y / b, a.Z / b)
end
V3.__unm = function(a)
	return v3(-a.X, -a.Y, -a.Z)
end
V3.__index = function(t, k)
	if k == "Magnitude" then
		return math.sqrt(t.X * t.X + t.Y * t.Y + t.Z * t.Z)
	elseif k == "Unit" then
		local m = math.sqrt(t.X * t.X + t.Y * t.Y + t.Z * t.Z)
		return m > 0 and v3(t.X / m, t.Y / m, t.Z / m) or v3(0, 0, 0)
	end
	return rawget(V3, k)
end
function V3.Dot(a, b)
	return a.X * b.X + a.Y * b.Y + a.Z * b.Z
end
function V3.Cross(a, b)
	return v3(a.Y * b.Z - a.Z * b.Y, a.Z * b.X - a.X * b.Z, a.X * b.Y - a.Y * b.X)
end
Vector3 = { new = v3 }

local V2 = {}
V2.__index = V2
local function v2(x, y)
	return setmetatable({ X = x or 0, Y = y or 0 }, V2)
end
V2.__add = function(a, b)
	return v2(a.X + b.X, a.Y + b.Y)
end
V2.__sub = function(a, b)
	return v2(a.X - b.X, a.Y - b.Y)
end
V2.__mul = function(a, b)
	if type(b) == "number" then
		return v2(a.X * b, a.Y * b)
	end
	return v2(a.X * b.X, a.Y * b.Y)
end
V2.__div = function(a, b)
	return v2(a.X / b, a.Y / b)
end
Vector2 = { new = v2 }

-- CFrame: a position and three columns (right, up, back), as in Roblox
local CF = {}
local function cf(p, r, u, b)
	return setmetatable({ p = p, r = r, u = u, b = b }, CF)
end
local function rot(c, v)
	return c.r * v.X + c.u * v.Y + c.b * v.Z
end
CF.__mul = function(a, b)
	if getmetatable(b) == CF then
		return cf(a.p + rot(a, b.p), rot(a, b.r), rot(a, b.u), rot(a, b.b))
	end
	return a.p + rot(a, b)
end
CF.__index = function(t, k)
	if k == "Position" then
		return t.p
	elseif k == "LookVector" then
		return -t.b
	elseif k == "RightVector" then
		return t.r
	elseif k == "UpVector" then
		return t.u
	end
	return rawget(CF, k)
end
function CF.Lerp(a, b, t)
	return cf(a.p + (b.p - a.p) * t, (a.r + (b.r - a.r) * t).Unit, (a.u + (b.u - a.u) * t).Unit, (a.b + (b.b - a.b) * t).Unit)
end
local I = { r = v3(1, 0, 0), u = v3(0, 1, 0), b = v3(0, 0, 1) }
CFrame = {
	new = function(x, y, z)
		local p = type(x) == "table" and x or v3(x, y, z)
		return cf(p, I.r, I.u, I.b)
	end,
	Angles = function(rx, ry, rz)
		local function rX(a)
			local c, s = math.cos(a), math.sin(a)
			return cf(v3(), v3(1, 0, 0), v3(0, c, s), v3(0, -s, c))
		end
		local function rY(a)
			local c, s = math.cos(a), math.sin(a)
			return cf(v3(), v3(c, 0, -s), v3(0, 1, 0), v3(s, 0, c))
		end
		local function rZ(a)
			local c, s = math.cos(a), math.sin(a)
			return cf(v3(), v3(c, s, 0), v3(-s, c, 0), v3(0, 0, 1))
		end
		return rX(rx) * rY(ry) * rZ(rz)
	end,
	lookAt = function(at, target)
		local f = (target - at).Unit
		local r = f:Cross(v3(0, 1, 0)).Unit
		local u = r:Cross(f)
		return cf(at, r, u, -f)
	end,
}

-- ─────────────────────────────────────────── colours, sizes, enums ──
local C3 = {}
C3.__index = C3
local function c3(r, g, b)
	return setmetatable({ R = r, G = g, B = b }, C3)
end
function C3.Lerp(a, b, t)
	return c3(a.R + (b.R - a.R) * t, a.G + (b.G - a.G) * t, a.B + (b.B - a.B) * t)
end
Color3 = {
	new = c3,
	fromRGB = function(r, g, b)
		return c3(r / 255, g / 255, b / 255)
	end,
	fromHSV = function(h, s, v)
		return c3(v, v, v)
	end,
	fromHex = function(h)
		h = string.gsub(h, "^#", "")
		assert(#h == 6, "bad hex " .. h)
		return c3(tonumber(string.sub(h, 1, 2), 16) / 255, tonumber(string.sub(h, 3, 4), 16) / 255, tonumber(string.sub(h, 5, 6), 16) / 255)
	end,
}
ColorSequence = { new = function(...)
	return { ... }
end }
UDim = { new = function(s, o)
	return { Scale = s, Offset = o }
end }
local function udim2(xs, xo, ys, yo)
	return { X = { Scale = xs, Offset = xo }, Y = { Scale = ys, Offset = yo } }
end
UDim2 = {
	new = udim2,
	fromScale = function(x, y)
		return udim2(x, 0, y, 0)
	end,
	fromOffset = function(x, y)
		return udim2(0, x, 0, y)
	end,
}
Random = { new = function(seed)
	local r = Js and nil
	local s = (seed or 1) % 2147483647
	local function nxt()
		s = (s * 16807) % 2147483647
		return s / 2147483647
	end
	return {
		NextNumber = function(_, a, b)
			a, b = a or 0, b or 1
			return a + (b - a) * nxt()
		end,
		NextInteger = function(_, a, b)
			return a + math.floor(nxt() * (b - a + 1))
		end,
	}
end }
local function enumPath(path)
	return setmetatable({ _p = path }, {
		__index = function(t, k)
			return enumPath(path .. "." .. k)
		end,
		__tostring = function()
			return path
		end,
		__eq = function(a, b)
			return rawget(a, "_p") == rawget(b, "_p")
		end,
	})
end
local enumCache = {}
Enum = setmetatable({}, {
	__index = function(_, k)
		enumCache[k] = enumCache[k] or setmetatable({}, {
			__index = function(t, v)
				local e = rawget(t, v)
				if not e then
					e = { _p = "Enum." .. k .. "." .. v }
					rawset(t, v, e)
				end
				return e
			end,
		})
		return enumCache[k]
	end,
})

-- ─────────────────────────────────────────────────────────── instances ──
local function signal()
	local s = { _fns = {} }
	function s:Connect(f)
		local entry = { f = f }
		table.insert(self._fns, entry)
		return { Disconnect = function()
			entry.dead = true
		end }
	end
	function s:Fire(...)
		for _, e in ipairs(self._fns) do
			if not e.dead then
				e.f(...)
			end
		end
	end
	return s
end
SIGNAL = signal

VIEWPORT = v2(1280, 720)
ME = nil -- the client's player, set by the driver

local SIGNALS = { Activated = true, InputBegan = true, InputChanged = true, InputEnded = true, MouseButton1Down = true, MouseButton1Up = true }
local GUI_CLASSES = { Frame = true, TextLabel = true, TextButton = true, ScrollingFrame = true, ImageLabel = true, ScreenGui = true }

local function absSize(o)
	if o.ClassName == "ScreenGui" or not o.Size then
		return VIEWPORT
	end
	local ps = o.Parent and absSize(o.Parent) or VIEWPORT
	return v2(o.Size.X.Scale * ps.X + o.Size.X.Offset, o.Size.Y.Scale * ps.Y + o.Size.Y.Offset)
end
local function absPos(o)
	if o.ClassName == "ScreenGui" or not o.Parent then
		return v2(0, 0)
	end
	local pp = absPos(o.Parent)
	local ps = absSize(o.Parent)
	local pos = o.Position or udim2(0, 0, 0, 0)
	local anchor = o.AnchorPoint or v2(0, 0)
	local size = absSize(o)
	return v2(pp.X + pos.X.Scale * ps.X + pos.X.Offset - anchor.X * size.X, pp.Y + pos.Y.Scale * ps.Y + pos.Y.Offset - anchor.Y * size.Y)
end

local Obj = {}
local function newObj(class)
	local o = { ClassName = class, Name = class, _children = {}, _props = {} }
	return setmetatable(o, Obj)
end
Obj.__index = function(t, k)
	if k == "AbsoluteSize" then
		return absSize(t)
	elseif k == "AbsolutePosition" then
		return absPos(t)
	end
	local p = rawget(t, "_props")[k]
	if p ~= nil then
		return p
	end
	if SIGNALS[k] then
		local s = signal()
		rawget(t, "_props")[k] = s
		return s
	end
	return Obj[k]
end
Obj.__newindex = function(t, k, v)
	if k == "Parent" then
		local old = rawget(t, "_props").Parent
		if old then
			old._children[t.Name] = nil
		end
		if v then
			v._children[t.Name] = t
		end
	end
	rawget(t, "_props")[k] = v
end
function Obj:WaitForChild(n)
	return self._children[n] or error("WaitForChild: no " .. n .. " in " .. self.Name)
end
function Obj:FindFirstChild(n)
	return self._children[n]
end
function Obj:GetChildren()
	local out = {}
	for _, c in pairs(self._children) do
		table.insert(out, c)
	end
	return out
end
function Obj:IsA(c)
	return self.ClassName == c
end
function Obj:Destroy()
	self.Parent = nil
	DESTROYED = (DESTROYED or 0) + 1
end
function Obj:InvokeServer(...)
	return self.OnServerInvoke(ME, ...)
end
Instance = { new = function(class)
	local o = newObj(class)
	if class == "Part" then
		o.Size = v3(4, 1, 2)
		o.CFrame = CFrame.new(0, 0, 0)
		PARTS = (PARTS or 0) + 1
	end
	return o
end }
INSTANCE_OBJ = newObj

-- the workspace, the camera, the client's services
local camera = newObj("Camera")
camera.CFrame = CFrame.new(0, 50, 50)
camera.FieldOfView = 70
camera.ViewportSize = VIEWPORT
-- the test camera looks straight down: a screen point IS the grass point under it (studs)
function camera:ScreenPointToRay(x, y)
	return { Origin = v3(x, 100, y), Direction = v3(0, -1, 0) }
end
workspace = newObj("Workspace")
workspace.CurrentCamera = camera
function workspace:BulkMoveTo(parts, cfs)
	assert(#parts == #cfs, "BulkMoveTo: lists differ")
	for i, p in ipairs(parts) do
		p.CFrame = cfs[i]
	end
	MOVED = (MOVED or 0) + #parts
end
RENDER = signal()
MOVE = v3(0, 0, 0)
local controls = { GetMoveVector = function()
	return MOVE
end }
local playerModule = newObj("ModuleScript")
playerModule._module = { GetControls = function()
	return controls
end }
local realRequire = require
require = function(x)
	if type(x) == "table" and rawget(x, "_props") and x._module then
		return x._module
	end
	if type(x) == "table" and x.Name == "Match" and MATCH_MODULE then
		return MATCH_MODULE
	end
	return realRequire(x)
end
CLIENT_PLAYER = function(p)
	local o = newObj("Player")
	o.UserId = p.UserId
	o.Name = p.Name
	local pg = newObj("PlayerGui")
	pg.Name = "PlayerGui"
	pg.Parent = o
	local ps = newObj("PlayerScripts")
	ps.Name = "PlayerScripts"
	ps.Parent = o
	playerModule.Name = "PlayerModule"
	playerModule.Parent = ps
	return o
end
CLIENT_SERVICES = {
	RunService = { RenderStepped = RENDER, IsStudio = function()
		return false
	end },
	UserInputService = { InputBegan = signal(), InputChanged = signal(), InputEnded = signal(), TouchEnabled = true },
	GuiService = { GetGuiInset = function()
		return v2(0, 0), v2(0, 0)
	end },
	Lighting = { ClockTime = 12, Brightness = 1 },
}
