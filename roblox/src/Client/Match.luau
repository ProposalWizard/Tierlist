--[[
  The match, played on the player's device.

  The rules are the website's (roblox/game/match.ts, converted): this file
  only draws what roblox/game/matchView.ts says is on the pitch, and passes
  your input in. Nothing about the football is decided here.

  Controls, as on the website:
    - drag back from the ball and let go: aim and power;
    - the strike screen: tap where on the ball to hit it;
    - a swipe while the ball flies: curve (curve boots);
    - the penalty run-up: drag sideways to change where you aim.
  Moving more (Mikey, 27 Oct 2026): after a pass you run your own man with
  W A S D or the thumb stick (Shift / the Sprint button to sprint), and the
  top-down dribble is played the same way (Q / E or the buttons to knock it
  past your man, tap a team-mate to pass).
]]

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")
local UserInputService = game:GetService("UserInputService")
local GuiService = game:GetService("GuiService")
local Lighting = game:GetService("Lighting")

local player = Players.LocalPlayer

local Match = {}

-- ─────────────────────────────────────────────────────────── the code ──
local Loader, Js, M, V, S
local function loadCode()
	if Loader then
		return
	end
	Loader = require(ReplicatedStorage:WaitForChild("Runtime"):WaitForChild("Loader"))
	Js = Loader.Js
	M = Loader.import("roblox/game/match")
	V = Loader.import("roblox/game/matchView")
	S = Loader.import("roblox/game/strikeScreen")
end

-- ─────────────────────────────────────────────────────────── the look ──
local SCALE = 3 -- studs per metre (a Roblox figure is about 5.5 studs, a man 1.83 m)
local PITCH_W, PITCH_Y1, PITCH_Y2 = 68, -8, 105
local TITLE_FONT = Enum.Font.FredokaOne
local BODY_FONT = Enum.Font.Gotham
local BODY_BOLD = Enum.Font.GothamBold
local SKIN = {
	Color3.fromRGB(241, 194, 158),
	Color3.fromRGB(198, 140, 100),
	Color3.fromRGB(141, 85, 54),
	Color3.fromRGB(92, 58, 38),
}
local GRASS_A = Color3.fromHex("3f9b55")
local GRASS_B = Color3.fromHex("37904d")

local function w(x, y, z)
	return Vector3.new(x * SCALE, (z or 0) * SCALE, y * SCALE)
end

local function color(hex, fallback)
	if type(hex) == "string" then
		local ok, c = pcall(Color3.fromHex, (string.gsub(hex, "^#", "")))
		if ok then
			return c
		end
	end
	return fallback or Color3.fromRGB(200, 200, 200)
end

local function part(props)
	local p = Instance.new("Part")
	p.Anchored = true
	p.CanCollide = false
	p.CanQuery = false
	p.CanTouch = false
	p.TopSurface = Enum.SurfaceType.Smooth
	p.BottomSurface = Enum.SurfaceType.Smooth
	p.Material = Enum.Material.SmoothPlastic
	for k, v in pairs(props) do
		p[k] = v
	end
	return p
end

local function make(class, props, children)
	local o = Instance.new(class)
	for k, v in pairs(props or {}) do
		if k ~= "Parent" then
			o[k] = v
		end
	end
	for _, ch in ipairs(children or {}) do
		ch.Parent = o
	end
	if props and props.Parent then
		o.Parent = props.Parent
	end
	return o
end

local function label(text, size, col, font, props)
	local l = make("TextLabel", {
		BackgroundTransparency = 1,
		Text = text,
		TextSize = size,
		TextColor3 = col,
		Font = font,
		TextWrapped = true,
	})
	for k, v in pairs(props or {}) do
		l[k] = v
	end
	return l
end

-- ─────────────────────────────────────────────────────────── the stadium ──
local function line(folder, x1, y1, x2, y2)
	local len = math.sqrt((x2 - x1) ^ 2 + (y2 - y1) ^ 2)
	local mid = w((x1 + x2) / 2, (y1 + y2) / 2, 0.012)
	part({
		Size = Vector3.new(0.12 * SCALE, 0.05, len * SCALE + 0.12 * SCALE),
		CFrame = CFrame.lookAt(mid, mid + Vector3.new((x2 - x1), 0, (y2 - y1))),
		Color = Color3.new(1, 1, 1),
		Material = Enum.Material.SmoothPlastic,
		Parent = folder,
	})
end

local function arc(folder, cx, cy, r, a1, a2)
	local n = 24
	for i = 0, n - 1 do
		local t1 = a1 + (a2 - a1) * i / n
		local t2 = a1 + (a2 - a1) * (i + 1) / n
		line(folder, cx + r * math.cos(t1), cy + r * math.sin(t1), cx + r * math.cos(t2), cy + r * math.sin(t2))
	end
end

local function buildStadium(kitUs, kitThem)
	local folder = Instance.new("Folder")
	folder.Name = "MatchWorld"
	-- the grass, in stripes
	local stripe = 5.5
	local y = PITCH_Y1
	local i = 0
	while y < PITCH_Y2 do
		local y2 = math.min(PITCH_Y2, y + stripe)
		part({
			Size = Vector3.new((PITCH_W + 16) * SCALE, 1, (y2 - y) * SCALE),
			Position = w(PITCH_W / 2, (y + y2) / 2, 0) - Vector3.new(0, 0.5, 0),
			Color = i % 2 == 0 and GRASS_A or GRASS_B,
			Material = Enum.Material.Grass,
			Parent = folder,
		})
		y = y2
		i += 1
	end
	-- the lines (IFAB sizes)
	local CXm = PITCH_W / 2
	line(folder, 0, 0, PITCH_W, 0)
	line(folder, 0, 0, 0, PITCH_Y2 - 0.5)
	line(folder, PITCH_W, 0, PITCH_W, PITCH_Y2 - 0.5)
	line(folder, 0, 52.5, PITCH_W, 52.5)
	arc(folder, CXm, 52.5, 9.15, math.pi, 2 * math.pi)
	arc(folder, CXm, 52.5, 9.15, 0, math.pi)
	line(folder, CXm - 20.16, 0, CXm - 20.16, 16.5)
	line(folder, CXm + 20.16, 0, CXm + 20.16, 16.5)
	line(folder, CXm - 20.16, 16.5, CXm + 20.16, 16.5)
	line(folder, CXm - 9.16, 0, CXm - 9.16, 5.5)
	line(folder, CXm + 9.16, 0, CXm + 9.16, 5.5)
	line(folder, CXm - 9.16, 5.5, CXm + 9.16, 5.5)
	local dA = math.acos(5.5 / 9.15)
	arc(folder, CXm, 11, 9.15, math.pi / 2 - dA, math.pi / 2 + dA)
	part({ Shape = Enum.PartType.Cylinder, Size = Vector3.new(0.05, 0.3 * SCALE, 0.3 * SCALE), CFrame = CFrame.new(w(CXm, 11, 0.015)) * CFrame.Angles(0, 0, math.pi / 2), Color = Color3.new(1, 1, 1), Parent = folder })
	arc(folder, 0, 0, 1, 0, math.pi / 2)
	arc(folder, PITCH_W, 0, 1, math.pi / 2, math.pi)
	-- the goal: posts, bar and net
	local POST_L, POST_R, BAR = 30.34, 37.66, 2.44
	local postR = 0.06
	local white = Color3.new(1, 1, 1)
	for _, px in ipairs({ POST_L - postR, POST_R + postR }) do
		part({ Size = Vector3.new(postR * 2 * SCALE, (BAR + postR) * SCALE, postR * 2 * SCALE), Position = w(px, -postR, (BAR + postR) / 2), Color = white, Material = Enum.Material.Metal, Parent = folder })
	end
	part({ Size = Vector3.new((POST_R - POST_L + postR * 4) * SCALE, postR * 2 * SCALE, postR * 2 * SCALE), Position = w(CXm, -postR, BAR + postR), Color = white, Material = Enum.Material.Metal, Parent = folder })
	local net = { Color = Color3.fromRGB(235, 235, 235), Transparency = 0.72, Material = Enum.Material.ForceField, Parent = folder }
	local depth = 2
	local function netPart(size, pos)
		local t = table.clone(net)
		t.Size = size
		t.Position = pos
		part(t)
	end
	netPart(Vector3.new((POST_R - POST_L) * SCALE, BAR * SCALE, 0.1), w(CXm, -depth, BAR / 2))
	netPart(Vector3.new((POST_R - POST_L) * SCALE, 0.1, depth * SCALE), w(CXm, -depth / 2, BAR))
	netPart(Vector3.new(0.1, BAR * SCALE, depth * SCALE), w(POST_L, -depth / 2, BAR / 2))
	netPart(Vector3.new(0.1, BAR * SCALE, depth * SCALE), w(POST_R, -depth / 2, BAR / 2))
	-- advertising boards and the stands, in both teams' colours
	local boardCol = { color(kitUs.shirt), Color3.fromHex("0b1220"), color(kitThem.shirt), Color3.fromHex("0b1220") }
	local bi = 0
	for x = 0, PITCH_W - 8, 8 do
		bi += 1
		part({ Size = Vector3.new(8 * SCALE, 0.9 * SCALE, 0.2 * SCALE), Position = w(x + 4, -5, 0.45), Color = boardCol[bi % 4 + 1], Material = Enum.Material.Neon, Parent = folder })
	end
	local function stand(cx, cy, sx, sy, facingX, facingY)
		for row = 0, 7 do
			local step = row * 1.2
			part({
				Size = Vector3.new((sx + (facingX ~= 0 and step * 2 or 0)) * SCALE, 1.1 * SCALE, (sy + (facingY ~= 0 and step * 2 or 0)) * SCALE),
				Position = w(cx - facingX * step, cy - facingY * step, 0.55 + row * 1.1),
				Color = row % 2 == 0 and Color3.fromHex("1e293b") or Color3.fromHex("334155"),
				Parent = folder,
			})
		end
		-- the crowd: dots of colour on the rows
		local rng = Random.new(cx * 1000 + cy)
		for k = 1, 90 do
			local row = rng:NextInteger(0, 7)
			local along = rng:NextNumber(-0.5, 0.5)
			local px = cx - facingX * row * 1.2 + (facingX == 0 and along * sx or 0)
			local py = cy - facingY * row * 1.2 + (facingY == 0 and along * sy or 0)
			local col = rng:NextNumber() < 0.45 and color(kitUs.shirt) or rng:NextNumber() < 0.5 and color(kitThem.shirt) or Color3.fromHSV(rng:NextNumber(), 0.3, 0.9)
			part({ Size = Vector3.new(0.5 * SCALE, 0.7 * SCALE, 0.5 * SCALE), Position = w(px, py, 1.45 + row * 1.1), Color = col, Parent = folder })
		end
	end
	stand(CXm, -9, PITCH_W + 10, 3, 0, 1)
	stand(-7, 50, 3, 120, 1, 0)
	stand(PITCH_W + 7, 50, 3, 120, -1, 0)
	folder.Parent = workspace
	return folder
end

-- ─────────────────────────────────────────────────────────── the figures ──
-- A man in kit: legs, shorts, shirt, arms, head. Blocky, Roblox-style.
local LEG_H, HIP_Y, SHORTS_H, TORSO_H, HEAD_R = 0.86, 0.86, 0.26, 0.6, 0.14

local function newFigure(folder)
	local f = { parts = {} }
	local function add(name, size, shape)
		local p = part({ Name = name, Size = size * SCALE, Parent = folder })
		if shape then
			p.Shape = shape
		end
		f.parts[name] = p
		return p
	end
	add("legL", Vector3.new(0.17, LEG_H, 0.17))
	add("legR", Vector3.new(0.17, LEG_H, 0.17))
	add("shorts", Vector3.new(0.44, SHORTS_H, 0.26))
	add("torso", Vector3.new(0.46, TORSO_H, 0.26))
	add("armL", Vector3.new(0.13, 0.6, 0.13))
	add("armR", Vector3.new(0.13, 0.6, 0.13))
	add("head", Vector3.new(HEAD_R * 2, HEAD_R * 2, HEAD_R * 2), Enum.PartType.Ball)
	add("hair", Vector3.new(HEAD_R * 2.05, HEAD_R * 0.9, HEAD_R * 2.05))
	f.parts.hair.Color = Color3.fromRGB(40, 28, 20)
	local tag = make("BillboardGui", {
		Size = UDim2.fromOffset(120, 20),
		StudsOffset = Vector3.new(0, 1.6, 0),
		AlwaysOnTop = true,
		MaxDistance = 160,
		LightInfluence = 0,
		Parent = f.parts.head,
	})
	f.tag = label("", 14, Color3.new(1, 1, 1), BODY_BOLD, { Size = UDim2.fromScale(1, 1), TextStrokeTransparency = 0.4, Parent = tag })
	f.pos = nil
	f.yaw = 0
	f.stride = 0
	f.side = nil
	return f
end

local function dress(f, kit, shorts, skin)
	local shirt = color(kit.shirt)
	local trim = color(kit.trim, shirt)
	f.parts.torso.Color = shirt
	f.parts.armL.Color = shirt
	f.parts.armR.Color = shirt
	f.parts.shorts.Color = shorts or trim
	f.parts.legL.Color = shirt:Lerp(Color3.new(1, 1, 1), 0.15)
	f.parts.legR.Color = shirt:Lerp(Color3.new(1, 1, 1), 0.15)
	f.parts.head.Color = skin
end

local function hideFigure(f)
	for _, p in pairs(f.parts) do
		p.Transparency = 1
	end
	f.tag.Visible = false
	f.hidden = true
end

local function showFigure(f)
	for name, p in pairs(f.parts) do
		p.Transparency = 0
	end
	f.tag.Visible = true
	f.hidden = false
end

-- Pose a figure: feet at `pos` (world), facing `yaw`, legs by `stride`, `roll` to dive.
local function pose(f, pos, yaw, k, roll, list, cfs)
	local root = CFrame.new(pos) * CFrame.Angles(0, yaw, 0) * CFrame.Angles(0, 0, roll)
	local swing = math.sin(f.stride) * 0.75 * k
	local function put(name, cf)
		table.insert(list, f.parts[name])
		table.insert(cfs, cf)
	end
	local s = SCALE
	put("legL", root * CFrame.new(-0.11 * s, HIP_Y * s, 0) * CFrame.Angles(swing, 0, 0) * CFrame.new(0, -LEG_H / 2 * s, 0))
	put("legR", root * CFrame.new(0.11 * s, HIP_Y * s, 0) * CFrame.Angles(-swing, 0, 0) * CFrame.new(0, -LEG_H / 2 * s, 0))
	put("shorts", root * CFrame.new(0, (HIP_Y + 0.02) * s, 0))
	local torsoY = HIP_Y + SHORTS_H / 2 + TORSO_H / 2
	put("torso", root * CFrame.new(0, torsoY * s, 0))
	local shoulderY = torsoY + TORSO_H / 2 - 0.05
	put("armL", root * CFrame.new(-0.3 * s, shoulderY * s, 0) * CFrame.Angles(-swing * 0.8, 0, -0.08) * CFrame.new(0, -0.3 * s, 0))
	put("armR", root * CFrame.new(0.3 * s, shoulderY * s, 0) * CFrame.Angles(swing * 0.8, 0, 0.08) * CFrame.new(0, -0.3 * s, 0))
	local headY = torsoY + TORSO_H / 2 + HEAD_R + 0.02
	put("head", root * CFrame.new(0, headY * s, 0))
	put("hair", root * CFrame.new(0, (headY + HEAD_R * 0.55) * s, 0.02 * s))
end

-- ─────────────────────────────────────────────────────────── the camera ──
local function chanceCamera(f, aspect, vfov)
	local cam = f.camera
	local facing = cam.facing or "up"
	local cx, cy = (cam.x1 + cam.x2) / 2, (cam.y1 + cam.y2) / 2
	local across = facing == "up" and (cam.x2 - cam.x1) or (cam.y2 - cam.y1)
	local down = facing == "up" and (cam.y2 - cam.y1) or (cam.x2 - cam.x1)
	local look = facing == "up" and Vector3.new(0, 0, -1) or facing == "right" and Vector3.new(-1, 0, 0) or Vector3.new(1, 0, 0)
	local elev = math.rad(52)
	local hfov = 2 * math.atan(math.tan(math.rad(vfov) / 2) * aspect)
	local dist = math.max((across * 0.5) / math.tan(hfov / 2), (down * 0.5 * math.sin(elev)) / math.tan(math.rad(vfov) / 2))
	dist = math.max(dist * 1.08, 9)
	local target = w(cx, cy, 0)
	local pos = target - look * (dist * math.cos(elev) * SCALE) + Vector3.new(0, dist * math.sin(elev) * SCALE, 0)
	return CFrame.lookAt(pos, target)
end

local function dribbleCamera(you)
	local target = w(you.x, you.y - 9, 0)
	local pos = w(you.x, you.y + 9, 7.5)
	return CFrame.lookAt(pos, target)
end

local function broadcastCamera(t)
	local target = w(PITCH_W / 2 + math.sin(t * 0.07) * 10, 35, 0)
	local pos = w(PITCH_W + 30, 45 + math.sin(t * 0.05) * 6, 24)
	return CFrame.lookAt(pos, target)
end

-- ─────────────────────────────────────────────────────────── the screen ──
local C = {
	panel = Color3.fromHex("0b1220"),
	panel2 = Color3.fromHex("111a2e"),
	text = Color3.new(1, 1, 1),
	dim = Color3.fromHex("b6c2d4"),
	good = Color3.fromHex("34d399"),
	bad = Color3.fromHex("f87171"),
	gold = Color3.fromHex("fde047"),
	ink = Color3.fromHex("0b1220"),
	button = Color3.fromHex("1e293b"),
}

local function bigButton(text, parent, props)
	local b = make("TextButton", {
		Size = UDim2.fromOffset(150, 52),
		BackgroundColor3 = C.gold,
		BorderSizePixel = 0,
		AutoButtonColor = true,
		Text = text,
		TextSize = 20,
		Font = TITLE_FONT,
		TextColor3 = C.ink,
		Parent = parent,
	}, {
		make("UICorner", { CornerRadius = UDim.new(0, 12) }),
		make("UIStroke", { Color = C.ink, Thickness = 3, ApplyStrokeMode = Enum.ApplyStrokeMode.Border }),
		make("UIGradient", { Rotation = 90, Color = ColorSequence.new(Color3.new(1, 1, 1), Color3.fromRGB(190, 190, 190)) }),
	})
	for k, v in pairs(props or {}) do
		b[k] = v
	end
	return b
end

local function buildHud()
	local gui = make("ScreenGui", { Name = "MatchHud", ResetOnSpawn = false, IgnoreGuiInset = true, DisplayOrder = 5, Parent = player:WaitForChild("PlayerGui") })
	local h = { gui = gui }
	-- the score
	local bar = make("Frame", { AnchorPoint = Vector2.new(0.5, 0), Position = UDim2.new(0.5, 0, 0, 44), Size = UDim2.fromOffset(300, 40), BackgroundColor3 = C.panel, BackgroundTransparency = 0.1, BorderSizePixel = 0, Parent = gui }, { make("UICorner", { CornerRadius = UDim.new(0, 8) }) })
	h.score = label("", 22, C.text, TITLE_FONT, { Size = UDim2.new(1, -64, 1, 0), Position = UDim2.fromOffset(8, 0), Parent = bar })
	h.minute = label("", 20, C.gold, TITLE_FONT, { AnchorPoint = Vector2.new(1, 0), Position = UDim2.new(1, -8, 0, 0), Size = UDim2.new(0, 56, 1, 0), TextXAlignment = Enum.TextXAlignment.Right, Parent = bar })
	local eBack = make("Frame", { AnchorPoint = Vector2.new(0.5, 0), Position = UDim2.new(0.5, 0, 0, 88), Size = UDim2.fromOffset(220, 10), BackgroundColor3 = Color3.fromHex("1e293b"), BorderSizePixel = 0, Parent = gui }, { make("UICorner", { CornerRadius = UDim.new(1, 0) }) })
	h.energy = make("Frame", { Size = UDim2.fromScale(1, 1), BackgroundColor3 = C.good, BorderSizePixel = 0, Parent = eBack }, { make("UICorner", { CornerRadius = UDim.new(1, 0) }) })
	-- the big word (GOAL!, SAVED)
	h.banner = label("", 64, C.gold, TITLE_FONT, { AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.fromScale(0.5, 0.36), Size = UDim2.new(1, 0, 0, 80), TextStrokeTransparency = 0.2, Visible = false, Parent = gui })
	-- the chance's commentary
	h.feed = make("Frame", { AnchorPoint = Vector2.new(0, 1), Position = UDim2.new(0, 12, 1, -12), Size = UDim2.new(0.6, 0, 0, 84), BackgroundTransparency = 1, Parent = gui }, {
		make("UIListLayout", { VerticalAlignment = Enum.VerticalAlignment.Bottom, SortOrder = Enum.SortOrder.LayoutOrder, Padding = UDim.new(0, 2) }),
	})
	h.feedLines = {}
	for i = 1, 3 do
		h.feedLines[i] = label("", 16, C.text, BODY_BOLD, { LayoutOrder = i, Size = UDim2.new(1, 0, 0, 24), TextXAlignment = Enum.TextXAlignment.Left, TextStrokeTransparency = 0.35, Parent = h.feed })
	end
	-- the buttons on the right
	h.side = make("Frame", { AnchorPoint = Vector2.new(1, 1), Position = UDim2.new(1, -12, 1, -12), Size = UDim2.fromOffset(150, 260), BackgroundTransparency = 1, Parent = gui }, {
		make("UIListLayout", { VerticalAlignment = Enum.VerticalAlignment.Bottom, HorizontalAlignment = Enum.HorizontalAlignment.Right, SortOrder = Enum.SortOrder.LayoutOrder, Padding = UDim.new(0, 8) }),
	})
	h.power = bigButton("⚡ POWER", h.side, { LayoutOrder = 1 })
	h.call = bigButton("CALL FOR IT", h.side, { LayoutOrder = 2 })
	h.sprint = bigButton("SPRINT", h.side, { LayoutOrder = 3 })
	local knocks = make("Frame", { LayoutOrder = 4, Size = UDim2.fromOffset(150, 52), BackgroundTransparency = 1, Parent = h.side })
	h.knocks = knocks
	h.knockL = bigButton("◀ KNOCK", knocks, { Size = UDim2.new(0.5, -4, 1, 0) })
	h.knockR = bigButton("KNOCK ▶", knocks, { Size = UDim2.new(0.5, -4, 1, 0), Position = UDim2.new(0.5, 4, 0, 0) })
	-- the ninety minutes: the commentary panel
	h.sim = make("Frame", { AnchorPoint = Vector2.new(0.5, 0), Position = UDim2.new(0.5, 0, 0, 108), Size = UDim2.new(1, -24, 1, -120), BackgroundTransparency = 1, Visible = false, Parent = gui }, {
		make("UISizeConstraint", { MaxSize = Vector2.new(560, math.huge) }),
	})
	local logBox = make("Frame", { Size = UDim2.new(1, 0, 1, -136), BackgroundColor3 = C.panel, BackgroundTransparency = 0.12, BorderSizePixel = 0, Parent = h.sim }, {
		make("UICorner", { CornerRadius = UDim.new(0, 10) }),
		make("UIPadding", { PaddingLeft = UDim.new(0, 12), PaddingRight = UDim.new(0, 12), PaddingTop = UDim.new(0, 10), PaddingBottom = UDim.new(0, 10) }),
		make("UIListLayout", { VerticalAlignment = Enum.VerticalAlignment.Bottom, SortOrder = Enum.SortOrder.LayoutOrder, Padding = UDim.new(0, 4) }),
	})
	h.logLines = {}
	for i = 1, 8 do
		h.logLines[i] = label("", 16, C.text, BODY_FONT, { LayoutOrder = i, Size = UDim2.new(1, 0, 0, 0), AutomaticSize = Enum.AutomaticSize.Y, TextXAlignment = Enum.TextXAlignment.Left, Parent = logBox })
	end
	local controls = make("Frame", { AnchorPoint = Vector2.new(0, 1), Position = UDim2.new(0, 0, 1, 0), Size = UDim2.new(1, 0, 0, 128), BackgroundTransparency = 1, Parent = h.sim }, {
		make("UIListLayout", { SortOrder = Enum.SortOrder.LayoutOrder, Padding = UDim.new(0, 6) }),
	})
	local function row(order)
		return make("Frame", { LayoutOrder = order, Size = UDim2.new(1, 0, 0, 38), BackgroundTransparency = 1, Parent = controls }, {
			make("UIListLayout", { FillDirection = Enum.FillDirection.Horizontal, SortOrder = Enum.SortOrder.LayoutOrder, Padding = UDim.new(0, 6) }),
		})
	end
	local function chip(parent, text, order)
		return make("TextButton", { LayoutOrder = order, Size = UDim2.new(0.25, -6, 1, 0), BackgroundColor3 = C.button, BorderSizePixel = 0, AutoButtonColor = true, Text = text, TextSize = 15, Font = BODY_BOLD, TextColor3 = C.text, Parent = parent }, {
			make("UICorner", { CornerRadius = UDim.new(0, 8) }),
		})
	end
	local r1 = row(1)
	label("Energy", 14, C.dim, BODY_BOLD, { LayoutOrder = 0, Size = UDim2.new(0.25, -6, 1, 0), TextXAlignment = Enum.TextXAlignment.Left, Parent = r1 })
	h.modes = { low = chip(r1, "Low", 1), medium = chip(r1, "Medium", 2), high = chip(r1, "High", 3) }
	local r2 = row(2)
	label("Style", 14, C.dim, BODY_BOLD, { LayoutOrder = 0, Size = UDim2.new(0.25, -6, 1, 0), TextXAlignment = Enum.TextXAlignment.Left, Parent = r2 })
	h.styles = { defensive = chip(r2, "Defend", 1), balanced = chip(r2, "Balanced", 2), attacking = chip(r2, "Attack", 3) }
	local r3 = row(3)
	label("Speed", 14, C.dim, BODY_BOLD, { LayoutOrder = 0, Size = UDim2.new(0.25, -6, 1, 0), TextXAlignment = Enum.TextXAlignment.Left, Parent = r3 })
	h.speed = chip(r3, "1×", 1)
	-- the pause card (half time, full time, coming on)
	h.pause = make("Frame", { AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.fromScale(0.5, 0.5), Size = UDim2.fromOffset(320, 190), BackgroundColor3 = C.panel2, BorderSizePixel = 0, Visible = false, ZIndex = 5, Parent = gui }, {
		make("UICorner", { CornerRadius = UDim.new(0, 12) }),
		make("UIStroke", { Color = C.gold, Thickness = 2 }),
	})
	h.pauseLabel = label("", 26, C.text, TITLE_FONT, { Position = UDim2.fromOffset(0, 14), Size = UDim2.new(1, 0, 0, 34), ZIndex = 6, Parent = h.pause })
	h.pauseGo = bigButton("", h.pause, { AnchorPoint = Vector2.new(0.5, 0), Position = UDim2.new(0.5, 0, 0, 62), Size = UDim2.new(1, -40, 0, 52), ZIndex = 6 })
	h.kib = bigButton("", h.pause, { AnchorPoint = Vector2.new(0.5, 0), Position = UDim2.new(0.5, 0, 0, 122), Size = UDim2.new(1, -40, 0, 44), BackgroundColor3 = C.button, TextColor3 = C.text, ZIndex = 6 })
	-- the strike screen
	h.strike = make("TextButton", { Size = UDim2.fromScale(1, 1), BackgroundColor3 = Color3.fromHex("4a71b8"), AutoButtonColor = false, Text = "", Visible = false, ZIndex = 10, Parent = gui }, {
		make("UIGradient", { Rotation = 90, Color = ColorSequence.new(Color3.fromHex("4a71b8"), Color3.fromHex("a8c4e8")) }),
	})
	make("Frame", { AnchorPoint = Vector2.new(0, 1), Position = UDim2.fromScale(0, 1), Size = UDim2.fromScale(1, 0.3), BackgroundColor3 = GRASS_A, BorderSizePixel = 0, ZIndex = 10, Parent = h.strike })
	h.strikeHead = label("", 34, C.text, TITLE_FONT, { Position = UDim2.fromOffset(0, 50), Size = UDim2.new(1, 0, 0, 40), ZIndex = 12, TextStrokeTransparency = 0.5, Parent = h.strike })
	h.strikeSub = label("Tap where you want to strike the ball", 16, C.text, BODY_BOLD, { Position = UDim2.fromOffset(0, 90), Size = UDim2.new(1, 0, 0, 22), ZIndex = 12, Parent = h.strike })
	h.shadow = make("Frame", { AnchorPoint = Vector2.new(0.5, 0.5), BackgroundColor3 = Color3.new(0, 0, 0), BackgroundTransparency = 0.6, BorderSizePixel = 0, ZIndex = 11, Parent = h.strike }, { make("UICorner", { CornerRadius = UDim.new(1, 0) }) })
	h.ball = make("Frame", { AnchorPoint = Vector2.new(0.5, 0.5), BackgroundColor3 = Color3.new(1, 1, 1), BorderSizePixel = 0, ZIndex = 12, Parent = h.strike }, {
		make("UICorner", { CornerRadius = UDim.new(1, 0) }),
		make("UIStroke", { Color = Color3.fromHex("111827"), Thickness = 3 }),
	})
	h.ballFace = label("⚽", 10, C.text, BODY_FONT, { Size = UDim2.fromScale(1.12, 1.12), Position = UDim2.fromScale(-0.06, -0.06), TextScaled = true, ZIndex = 13, Parent = h.ball })
	h.spark = make("Frame", { AnchorPoint = Vector2.new(0.5, 0.5), Size = UDim2.fromOffset(18, 18), BackgroundColor3 = C.gold, BorderSizePixel = 0, Visible = false, ZIndex = 15, Parent = h.ball }, { make("UICorner", { CornerRadius = UDim.new(1, 0) }) })
	h.spot = make("Frame", { AnchorPoint = Vector2.new(0.5, 0.5), BackgroundColor3 = C.good, BorderSizePixel = 0, Visible = false, ZIndex = 15, Parent = h.ball }, { make("UICorner", { CornerRadius = UDim.new(1, 0) }) })
	local ringBack = make("Frame", { AnchorPoint = Vector2.new(0.5, 0), Position = UDim2.new(0.5, 0, 1, -70), Size = UDim2.fromOffset(240, 12), BackgroundColor3 = Color3.fromHex("1e293b"), BorderSizePixel = 0, ZIndex = 12, Parent = h.strike }, { make("UICorner", { CornerRadius = UDim.new(1, 0) }) })
	h.ringBack = ringBack
	h.ring = make("Frame", { Size = UDim2.fromScale(1, 1), BackgroundColor3 = C.gold, BorderSizePixel = 0, ZIndex = 13, Parent = ringBack }, { make("UICorner", { CornerRadius = UDim.new(1, 0) }) })
	local powBack = make("Frame", { AnchorPoint = Vector2.new(1, 0.5), Position = UDim2.new(1, -24, 0.5, 0), Size = UDim2.fromOffset(18, 220), BackgroundColor3 = Color3.fromHex("1e293b"), BorderSizePixel = 0, ZIndex = 12, Parent = h.strike }, { make("UICorner", { CornerRadius = UDim.new(1, 0) }) })
	h.pow = make("Frame", { AnchorPoint = Vector2.new(0, 1), Position = UDim2.fromScale(0, 1), Size = UDim2.fromScale(1, 0.5), BorderSizePixel = 0, ZIndex = 13, Parent = powBack }, { make("UICorner", { CornerRadius = UDim.new(1, 0) }) })
	h.powText = label("", 16, C.text, TITLE_FONT, { AnchorPoint = Vector2.new(0.5, 1), Position = UDim2.new(0.5, 0, 0, -6), Size = UDim2.fromOffset(60, 20), ZIndex = 13, Parent = powBack })
	h.verdict = label("", 40, C.gold, TITLE_FONT, { AnchorPoint = Vector2.new(0.5, 0), Position = UDim2.new(0.5, 0, 1, -130), Size = UDim2.new(1, 0, 0, 46), ZIndex = 14, TextStrokeTransparency = 0.3, Parent = h.strike })
	-- full time
	h.final = make("Frame", { AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.fromScale(0.5, 0.5), Size = UDim2.fromOffset(340, 230), BackgroundColor3 = C.panel2, BorderSizePixel = 0, Visible = false, ZIndex = 20, Parent = gui }, {
		make("UICorner", { CornerRadius = UDim.new(0, 12) }),
		make("UIStroke", { Color = C.gold, Thickness = 2 }),
	})
	h.finalTitle = label("FULL TIME", 30, C.gold, TITLE_FONT, { Position = UDim2.fromOffset(0, 12), Size = UDim2.new(1, 0, 0, 36), ZIndex = 21, Parent = h.final })
	h.finalScore = label("", 30, C.text, TITLE_FONT, { Position = UDim2.fromOffset(0, 50), Size = UDim2.new(1, 0, 0, 36), ZIndex = 21, Parent = h.final })
	h.finalLine = label("", 16, C.dim, BODY_BOLD, { Position = UDim2.fromOffset(12, 92), Size = UDim2.new(1, -24, 0, 44), ZIndex = 21, Parent = h.final })
	h.finalGo = bigButton("CONTINUE", h.final, { AnchorPoint = Vector2.new(0.5, 0), Position = UDim2.new(0.5, 0, 0, 156), Size = UDim2.new(1, -40, 0, 52), ZIndex = 21 })
	-- the trial: which test, what to do, the cards between tests
	h.trialTop = label("", 20, C.gold, TITLE_FONT, { AnchorPoint = Vector2.new(0.5, 0), Position = UDim2.new(0.5, 0, 0, 104), Size = UDim2.new(1, -24, 0, 26), TextStrokeTransparency = 0.3, Visible = false, Parent = gui })
	h.trialHint = label("", 16, C.text, BODY_BOLD, { AnchorPoint = Vector2.new(0.5, 1), Position = UDim2.new(0.5, 0, 1, -96), Size = UDim2.new(1, -40, 0, 48), TextStrokeTransparency = 0.35, Visible = false, Parent = gui })
	h.tapStart = bigButton("TAP TO START", gui, { AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.fromScale(0.5, 0.55), Size = UDim2.fromOffset(240, 64), TextSize = 26, Visible = false, ZIndex = 8 })
	h.trialCard = make("Frame", { AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.fromScale(0.5, 0.5), Size = UDim2.fromOffset(340, 220), BackgroundColor3 = C.panel2, BorderSizePixel = 0, Visible = false, ZIndex = 18, Parent = gui }, {
		make("UICorner", { CornerRadius = UDim.new(0, 14) }),
		make("UIStroke", { Color = C.gold, Thickness = 3 }),
	})
	h.trialCardTitle = label("", 40, C.gold, TITLE_FONT, { Position = UDim2.fromOffset(10, 18), Size = UDim2.new(1, -20, 0, 70), ZIndex = 19, Parent = h.trialCard })
	h.trialCardSub = label("", 17, C.text, BODY_BOLD, { Position = UDim2.fromOffset(16, 94), Size = UDim2.new(1, -32, 0, 44), ZIndex = 19, Parent = h.trialCard })
	h.trialCardGo = bigButton("CONTINUE", h.trialCard, { AnchorPoint = Vector2.new(0.5, 0), Position = UDim2.new(0.5, 0, 0, 148), Size = UDim2.new(1, -40, 0, 52), ZIndex = 19, Visible = false })
	-- the signing session: the fan, what he holds, his patience, your four buttons
	h.signing = make("Frame", { AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.fromScale(0.5, 0.55), Size = UDim2.fromOffset(340, 300), BackgroundColor3 = C.panel, BackgroundTransparency = 0.05, BorderSizePixel = 0, Visible = false, ZIndex = 9, Parent = gui }, {
		make("UICorner", { CornerRadius = UDim.new(0, 14) }),
		make("UIStroke", { Color = Color3.fromHex("f472b6"), Thickness = 3 }),
	})
	h.fanIcon = label("", 56, C.text, BODY_FONT, { Position = UDim2.fromOffset(0, 10), Size = UDim2.new(1, 0, 0, 64), ZIndex = 10, Parent = h.signing })
	h.wants = label("", 36, C.text, BODY_FONT, { Position = UDim2.fromOffset(0, 78), Size = UDim2.new(1, 0, 0, 44), ZIndex = 10, Parent = h.signing })
	local patBack = make("Frame", { Position = UDim2.new(0, 20, 0, 130), Size = UDim2.new(1, -40, 0, 10), BackgroundColor3 = Color3.fromHex("1e293b"), BorderSizePixel = 0, ZIndex = 10, Parent = h.signing }, { make("UICorner", { CornerRadius = UDim.new(1, 0) }) })
	h.patience = make("Frame", { Size = UDim2.fromScale(1, 1), BackgroundColor3 = Color3.fromHex("f472b6"), BorderSizePixel = 0, ZIndex = 11, Parent = patBack }, { make("UICorner", { CornerRadius = UDim.new(1, 0) }) })
	h.signBtns = {}
	for i = 1, 4 do
		h.signBtns[i] = bigButton("", h.signing, {
			Position = UDim2.new(((i - 1) % 2) * 0.5, ((i - 1) % 2 == 0) and 16 or 4, 0, 156 + math.floor((i - 1) / 2) * 66),
			Size = UDim2.new(0.5, -20, 0, 56), TextSize = 22, ZIndex = 10,
		})
	end
	-- getting ready
	h.cover = make("Frame", { Size = UDim2.fromScale(1, 1), BackgroundColor3 = C.panel, ZIndex = 30, Parent = gui })
	h.coverText = label("Getting the pitch ready…", 26, C.text, TITLE_FONT, { Size = UDim2.fromScale(1, 1), ZIndex = 31, Parent = h.cover })
	return h
end

-- ─────────────────────────────────────────────────────────── the match ──
local function int(n)
	return math.floor((tonumber(n) or 0) + 0.5)
end

local function obj(t, keys)
	return Js.O(t, keys)
end

local function vec(x, y)
	return obj({ x = x, y = y }, { "x", "y" })
end

-- Where a point on the screen lands on the grass, in pitch metres.
local function groundAt(camera, sx, sy)
	local ray = camera:ScreenPointToRay(sx, sy)
	if math.abs(ray.Direction.Y) < 1e-4 then
		return nil
	end
	local t = -ray.Origin.Y / ray.Direction.Y
	if t < 0 then
		return nil
	end
	local p = ray.Origin + ray.Direction * t
	return p.X / SCALE, p.Z / SCALE
end

--[[
  The pitch, the people, the camera and your input, for whatever `driver`
  plays: one match (Match.play) or the trial (Match.playTrial).
    driver.match()      the match state on the pitch now, or nil (the trial's dribble and pass stages, its cards)
    driver.step(dt)     moves it on
    driver.frame()      what to draw (roblox/game/matchView.ts's Frame; the trial's adds `trial`)
    driver.done()       true when it is over
    driver.tapGround(x, y), driver.stick(x, z), driver.knock(dir), driver.tapToGo()   (no match on the pitch)
  Returns an error message if it stopped on one.
]]
local function runPitch(hud, driver)
	local camera = workspace.CurrentCamera
	local m = driver.match()
	-- for the smoke test's robot (roblox/tools/smoke-client.mjs); nothing reads it in the game
	Match.current, Match.hud = m, hud
	local kits = driver.frame().kits
	local world = buildStadium(kits.us, kits.them)
	local figFolder = Instance.new("Folder")
	figFolder.Name = "Figures"
	figFolder.Parent = world
	local ball = part({ Shape = Enum.PartType.Ball, Size = Vector3.new(0.34, 0.34, 0.34) * SCALE, Color = Color3.new(1, 1, 1), Material = Enum.Material.SmoothPlastic, Parent = world })
	local ballShadow = part({ Shape = Enum.PartType.Cylinder, Size = Vector3.new(0.04, 0.4 * SCALE, 0.4 * SCALE), Color = Color3.new(0, 0, 0), Transparency = 0.55, Parent = world })
	local arrow = part({ Size = Vector3.new(0.3 * SCALE, 0.05, 1), Color = Color3.fromHex("fde047"), Material = Enum.Material.Neon, Transparency = 1, Parent = world })
	local youRing = part({ Shape = Enum.PartType.Cylinder, Size = Vector3.new(0.05, 1.3 * SCALE, 1.3 * SCALE), Color = Color3.fromHex("fde047"), Material = Enum.Material.Neon, Transparency = 0.35, Parent = world })
	local cones = {}
	for i = 1, 2 do
		cones[i] = part({ Shape = Enum.PartType.Ball, Size = Vector3.new(0.5, 0.7, 0.5) * SCALE, Color = Color3.fromHex("f97316"), Material = Enum.Material.Neon, Transparency = 1, Parent = world })
	end
	local targetRing = part({ Shape = Enum.PartType.Cylinder, Size = Vector3.new(0.05, 1.6 * SCALE, 1.6 * SCALE), Color = Color3.fromHex("34d399"), Material = Enum.Material.Neon, Transparency = 1, Parent = world })

	-- the sky and light of a match day (put back afterwards)
	local saved = { ClockTime = Lighting.ClockTime, Brightness = Lighting.Brightness }
	Lighting.ClockTime = 15
	Lighting.Brightness = 2.2
	local camSaved = { type = camera.CameraType, fov = camera.FieldOfView }
	camera.CameraType = Enum.CameraType.Scriptable
	camera.FieldOfView = 50
	-- your own Roblox character waits off the pitch
	local char = player.Character
	local hrp = char and char:FindFirstChild("HumanoidRootPart")
	local wasAnchored = hrp and hrp.Anchored
	if hrp then
		hrp.Anchored = true
	end
	local controls
	pcall(function()
		controls = require(player:WaitForChild("PlayerScripts"):WaitForChild("PlayerModule")):GetControls()
	end)

	local figures = {}
	local skinFor = {}
	local function skinOf(id)
		if not skinFor[id] then
			local h = 0
			for i = 1, #id do
				h = (h * 31 + string.byte(id, i)) % 9973
			end
			skinFor[id] = SKIN[h % #SKIN + 1]
		end
		return skinFor[id]
	end

	-- input state
	local sprintHeld, sprintButton = false, false
	local pointer = nil -- { kind, start = Vector2, startPitch = {x,y}, base }
	local strike = nil
	local lastPhase = ""
	local finished = false
	local failure = nil
	local clock = 0

	local function safe(fn)
		local ok, e = pcall(fn)
		if not ok then
			failure = e
		end
	end

	-- the strike screen's taps
	hud.strike.InputBegan:Connect(function(input)
		if input.UserInputType ~= Enum.UserInputType.MouseButton1 and input.UserInputType ~= Enum.UserInputType.Touch then
			return
		end
		if not strike then
			return
		end
		local inset = GuiService:GetGuiInset()
		local px, py = input.Position.X + inset.X, input.Position.Y + inset.Y
		local c = hud.ball.AbsolutePosition + hud.ball.AbsoluteSize / 2
		local r = hud.ball.AbsoluteSize.X / 2
		if r <= 0 then
			return
		end
		safe(function()
			S.strikeTap(strike, (px - c.X) / r, (py - c.Y) / r)
		end)
	end)

	-- the pitch: drag to aim, drag to nudge the run-up, swipe to curve, tap a team-mate
	local inputConns = {}
	table.insert(inputConns, UserInputService.InputBegan:Connect(function(input, processed)
		if input.KeyCode == Enum.KeyCode.LeftShift or input.KeyCode == Enum.KeyCode.RightShift then
			sprintHeld = true
		end
		if input.KeyCode == Enum.KeyCode.Q or input.KeyCode == Enum.KeyCode.E then
			safe(function()
				local dir = input.KeyCode == Enum.KeyCode.Q and -1 or 1
				if m then
					M.dribbleBurst(m, dir)
				elseif driver.knock then
					driver.knock(dir)
				end
			end)
		end
		if processed or finished then
			return
		end
		if input.UserInputType ~= Enum.UserInputType.MouseButton1 and input.UserInputType ~= Enum.UserInputType.Touch then
			return
		end
		if pointer then
			return
		end
		local x, y = groundAt(camera, input.Position.X, input.Position.Y)
		if not x then
			return
		end
		if not m then
			safe(function()
				if driver.tapGround then
					driver.tapGround(x, y)
				end
			end)
			return
		end
		pointer = { input = input, sx = input.Position.X, sy = input.Position.Y, x = x, y = y, phase = m.phase }
		safe(function()
			if m.phase == "aim" then
				M.pointerDown(m, vec(x, y))
			elseif m.phase == "runup" and m.runup then
				pointer.base = m.runup.nudgeM
			elseif m.phase == "tdDribble" then
				M.dribblePass(m, vec(x, y))
			end
		end)
	end))
	table.insert(inputConns, UserInputService.InputChanged:Connect(function(input)
		if not pointer or not m then
			return
		end
		if input.UserInputType ~= Enum.UserInputType.MouseMovement and input ~= pointer.input then
			return
		end
		local x, y = groundAt(camera, input.Position.X, input.Position.Y)
		if not x then
			return
		end
		pointer.lx, pointer.ly = x, y
		safe(function()
			if m.phase == "aim" then
				M.pointerMove(m, vec(x, y))
			elseif m.phase == "runup" and pointer.base ~= nil then
				local cam = m.camera
				local width = (m.facing == "up") and (cam.x2 - cam.x1) or (cam.y2 - cam.y1)
				local along = (m.facing == "up") and (x - pointer.x) or (y - pointer.y)
				M.runupNudge(m, along / math.max(1, width), pointer.base)
			end
		end)
	end))
	table.insert(inputConns, UserInputService.InputEnded:Connect(function(input)
		if input.KeyCode == Enum.KeyCode.LeftShift or input.KeyCode == Enum.KeyCode.RightShift then
			sprintHeld = false
		end
		if not pointer or (input ~= pointer.input and input.UserInputType ~= Enum.UserInputType.MouseButton1) then
			return
		end
		local p = pointer
		pointer = nil
		if not m then
			return
		end
		safe(function()
			if m.phase == "aim" then
				M.pointerUp(m)
			elseif m.phase == "flight" and p.lx then
				local dx, dy = p.lx - p.x, p.ly - p.y
				if math.abs(dx) + math.abs(dy) > 0.8 then
					M.curveSwipe(m, dx, dy)
				end
			end
		end)
	end))

	-- the buttons
	hud.power.Activated:Connect(function()
		safe(function()
			if not m then
				return
			end
			M.armPowerShot(m, not m.powerArmed)
		end)
	end)
	hud.call.Activated:Connect(function()
		safe(function()
			if not m then
				return
			end
			local said = M.callForBall(m)
			if said then
				hud.banner.Text = said
			end
		end)
	end)
	hud.sprint.MouseButton1Down:Connect(function()
		sprintButton = true
	end)
	hud.sprint.MouseButton1Up:Connect(function()
		sprintButton = false
	end)
	local function knock(dir)
		safe(function()
			if m then
				M.dribbleBurst(m, dir)
			elseif driver.knock then
				driver.knock(dir)
			end
		end)
	end
	hud.knockL.Activated:Connect(function()
		knock(-1)
	end)
	hud.knockR.Activated:Connect(function()
		knock(1)
	end)
	hud.tapStart.Activated:Connect(function()
		safe(function()
			if driver.tapToGo then
				driver.tapToGo()
			end
		end)
	end)
	for mode, b in pairs(hud.modes) do
		b.Activated:Connect(function()
			safe(function()
				if m then M.setEnergyMode(m, mode) end
			end)
		end)
	end
	for style, b in pairs(hud.styles) do
		b.Activated:Connect(function()
			safe(function()
				if m then M.setPlaystyle(m, style) end
			end)
		end)
	end
	hud.speed.Activated:Connect(function()
		safe(function()
			if m then M.cycleSpeed(m) end
		end)
	end)
	hud.pauseGo.Activated:Connect(function()
		safe(function()
			if m then M.continuePause(m) end
		end)
	end)
	hud.kib.Activated:Connect(function()
		safe(function()
			if m then M.drinkKib(m) end
		end)
	end)

	-- ─────────────────────────────────────────── one frame ──
	local function moveDir()
		if not controls then
			return 0, 0
		end
		local mv = controls:GetMoveVector()
		return mv.X, mv.Z
	end

	local function stepInput()
		local mx, mz = moveDir()
		if not m then
			if driver.stick then
				driver.stick(mx, mz)
			end
			return
		end
		local ctl = M.controlsOf(m)
		if ctl.steer then
			-- the stick, turned into pitch directions by where the camera looks
			local look = camera.CFrame.LookVector
			local fwd = Vector3.new(look.X, 0, look.Z)
			if fwd.Magnitude < 1e-3 then
				fwd = Vector3.new(0, 0, -1)
			end
			fwd = fwd.Unit
			local right = Vector3.new(-fwd.Z, 0, fwd.X)
			local d = right * mx + fwd * (-mz)
			M.steerRun(m, d.X, d.Z, sprintHeld or sprintButton)
		elseif ctl.dribble then
			M.dribbleStick(m, mx, -mz)
		end
	end

	local function drawFrame(f, dt)
		local aspect = camera.ViewportSize.X / math.max(1, camera.ViewportSize.Y)
		-- the camera
		local want
		if f.cameraMode == "broadcast" then
			want = broadcastCamera(clock)
		elseif f.cameraMode == "chase" then
			local you = f.bodies[1]
			want = dribbleCamera(you)
		else
			want = chanceCamera(f, aspect, camera.FieldOfView)
		end
		local a = 1 - math.exp(-5 * dt)
		if lastPhase ~= f.phase and (f.phase == "aim" or f.phase == "tdDribble" or f.phase == "trialDribble" or f.phase == "trialVision") then
			a = 1 -- a new chance: cut, as the website does
		end
		camera.CFrame = camera.CFrame:Lerp(want, a)

		-- the people
		local seen = {}
		local parts, cfs = {}, {}
		local n = Js.alen(f.bodies)
		local ballPos = f.ball
		for i = 1, n do
			local b = f.bodies[i]
			seen[b.id] = true
			local fig = figures[b.id]
			if not fig then
				fig = newFigure(figFolder)
				figures[b.id] = fig
			end
			local kit = (b.side == "you" or b.side == "mate") and f.kits.us or b.side == "keeper" and f.kits.keeper or f.kits.them
			if fig.side ~= b.side or fig.kit ~= kit.shirt then
				fig.side = b.side
				fig.kit = kit.shirt
				dress(fig, kit, nil, skinOf(b.id))
			end
			if fig.hidden then
				showFigure(fig)
			end
			fig.tag.Text = b.side == "you" and "YOU" or (b.name or (b.option and f.trial and "•" or ""))
			fig.tag.TextColor3 = b.side == "you" and C.gold or Color3.new(1, 1, 1)
			local pos = w(b.x, b.y, 0)
			local speed = 0
			if fig.pos then
				local d = (pos - fig.pos)
				speed = d.Magnitude / SCALE / math.max(dt, 1e-3)
				if d.Magnitude > 0.02 and speed < 20 then
					fig.yaw = math.atan2(-d.X, -d.Z)
				elseif ballPos and speed < 0.3 then
					local to = w(ballPos.x, ballPos.y, 0) - pos
					if to.Magnitude > 0.5 then
						local want2 = math.atan2(-to.X, -to.Z)
						fig.yaw = fig.yaw + math.atan2(math.sin(want2 - fig.yaw), math.cos(want2 - fig.yaw)) * math.min(1, dt * 6)
					end
				end
				if speed > 20 then
					speed = 0 -- a new chance put him somewhere else
				end
			end
			fig.pos = pos
			local k = math.clamp(speed / 6, 0, 1)
			fig.stride += dt * (4 + speed * 1.6) * (k > 0.05 and 1 or 0)
			local roll = 0
			if b.side == "keeper" and b.dive then
				roll = -math.clamp(b.dive / 1.6, -1, 1) * 1.25
			end
			pose(fig, pos, fig.yaw, k, roll, parts, cfs)
			if b.side == "you" then
				youRing.CFrame = CFrame.new(w(b.x, b.y, 0.02)) * CFrame.Angles(0, 0, math.pi / 2)
			end
		end
		for id, fig in pairs(figures) do
			if not seen[id] and not fig.hidden then
				hideFigure(fig)
			end
		end
		if #parts > 0 then
			workspace:BulkMoveTo(parts, cfs, Enum.BulkMoveMode.FireCFrameChanged)
		end
		-- the ball
		if ballPos then
			ball.Transparency = 0
			ball.CFrame = CFrame.new(w(ballPos.x, ballPos.y, 0.17 + (ballPos.z or 0)))
			ballShadow.Transparency = 0.55
			ballShadow.CFrame = CFrame.new(w(ballPos.x, ballPos.y, 0.015)) * CFrame.Angles(0, 0, math.pi / 2)
		else
			ball.Transparency = 1
			ballShadow.Transparency = 1
		end
		-- the aim arrow while you drag
		if f.aim and ballPos then
			local d = f.aim.dir
			local len = math.sqrt(d.x * d.x + d.y * d.y)
			if len > 1e-3 then
				local L = 2 + f.aim.power * 14
				local ux, uy = d.x / len, d.y / len
				local from = w(ballPos.x, ballPos.y, 0.03)
				local to = w(ballPos.x + ux * L, ballPos.y + uy * L, 0.03)
				arrow.Size = Vector3.new(0.3 * SCALE, 0.05, L * SCALE)
				arrow.CFrame = CFrame.lookAt((from + to) / 2, to)
				arrow.Color = f.aim.power < 0.4 and C.good or f.aim.power < 0.75 and C.gold or C.bad
				arrow.Transparency = 0.1
			end
		else
			arrow.Transparency = 1
		end
		if f.passTarget and f.phase == "aim" then
			targetRing.Transparency = 0.4
			targetRing.CFrame = CFrame.new(w(f.passTarget.x, f.passTarget.y, 0.02)) * CFrame.Angles(0, 0, math.pi / 2)
		else
			targetRing.Transparency = 1
		end

		-- the screen
		local sc = f.score
		local home = sc.home
		hud.score.Text = home and string.format("%s  %d – %d  %s", sc.usName, int(sc.us), int(sc.them), sc.themName) or string.format("%s  %d – %d  %s", sc.themName, int(sc.them), int(sc.us), sc.usName)
		if f.shootout then
			hud.minute.Text = string.format("P %d–%d", int(f.shootout.us), int(f.shootout.them))
		else
			hud.minute.Text = tostring(f.minute) .. "'"
		end
		hud.energy.Size = UDim2.fromScale(math.clamp(f.energy / 100, 0, 1), 1)
		hud.energy.BackgroundColor3 = f.energy < 35 and C.bad or f.energy < 65 and C.gold or C.good
		hud.banner.Visible = f.banner ~= nil
		if f.banner then
			hud.banner.Text = f.banner
		end
		local feedN = Js.alen(f.feed)
		for i = 1, 3 do
			local idx = feedN - 3 + i
			hud.feedLines[i].Text = idx >= 1 and f.feed[idx] or ""
		end
		hud.feed.Visible = f.phase ~= "feed"
		local ctl = f.controls
		hud.power.Visible = ctl.powerShot
		hud.power.BackgroundColor3 = ctl.powerArmed and C.bad or C.gold
		hud.call.Visible = ctl.callForIt
		hud.sprint.Visible = ctl.steer and UserInputService.TouchEnabled
		hud.knocks.Visible = ctl.dribble
		-- the ninety minutes
		hud.sim.Visible = f.phase == "feed"
		if f.phase == "feed" then
			local logN = Js.alen(f.log)
			for i = 1, 8 do
				local idx = logN - 8 + i
				local l = idx >= 1 and f.log[idx] or nil
				local t = hud.logLines[i]
				if l then
					t.Text = (l.minute and (tostring(l.minute) .. "'  ") or "      ") .. l.text
					t.TextColor3 = (l.tone == "goal" and C.good) or (l.tone == "oppGoal" and C.bad) or (l.tone == "you" and C.gold) or (l.tone == "period" and C.dim) or C.text
					t.Font = (l.tone == "goal" or l.tone == "oppGoal") and BODY_BOLD or BODY_FONT
				else
					t.Text = ""
				end
			end
			for mode, b in pairs(hud.modes) do
				b.BackgroundColor3 = f.energyMode == mode and C.gold or C.button
				b.TextColor3 = f.energyMode == mode and C.ink or C.text
			end
			for style, b in pairs(hud.styles) do
				b.BackgroundColor3 = f.playstyle == style and C.gold or C.button
				b.TextColor3 = f.playstyle == style and C.ink or C.text
			end
			hud.speed.Text = tostring(f.speed) .. "×"
		end
		hud.pause.Visible = f.pause ~= nil
		if f.pause then
			hud.pauseLabel.Text = f.pause.label or (f.pause.halfTime and "Half time" or "")
			hud.pauseGo.Text = string.upper(f.pause.cta)
			hud.kib.Visible = f.pause.halfTime and f.pause.kib > 0 and f.energy < 100
			hud.kib.Text = string.format("DRINK A KIB CAN (%d LEFT)", int(f.pause.kib))
		end
		-- the trial's cones, words and cards
		local tv = f.trial
		local coneN = tv and Js.alen(tv.cones) or 0
		for i = 1, 2 do
			if i <= coneN then
				local c = tv.cones[i]
				cones[i].Transparency = 0
				cones[i].CFrame = CFrame.new(w(c.x, c.y, 0.35))
			else
				cones[i].Transparency = 1
			end
		end
		hud.trialTop.Visible = tv ~= nil
		hud.trialHint.Visible = tv ~= nil and tv.card == nil
		hud.trialCard.Visible = tv ~= nil and tv.card ~= nil
		hud.tapStart.Visible = false
		if tv then
			hud.trialTop.Text = string.format("TRIAL %d/%d · %s", int(tv.stageNo), int(tv.stages), string.upper(tv.title))
			hud.trialHint.Text = (tv.line ~= "" and (tv.line .. "\n") or "") .. tv.hint
			if tv.card then
				if tv.card.kind == "countdown" then
					hud.trialCardTitle.Text = tostring(int(tv.card.n))
					hud.trialCardSub.Text = "Next: " .. tostring(tv.card.label)
					hud.trialCardGo.Visible = false
				else
					hud.trialCardTitle.Text = "A SCOUT HAS SPOTTED YOU"
					hud.trialCardSub.Text = "He has seen enough. Time to hear what the club thinks."
					hud.trialCardGo.Visible = true
				end
			end
			local d, v = tv.dribble, tv.vision
			if d and not d.started then
				hud.tapStart.Visible = true
				hud.tapStart.Text = "TAP TO START"
			elseif v and v.phase == "ready" then
				hud.tapStart.Visible = true
				hud.tapStart.Text = "TAP TO START"
			end
			if v and v.phase == "count" and v.count > 0 then
				hud.banner.Visible = true
				hud.banner.Text = tostring(int(v.count))
			end
			if tv.shootout then
				hud.minute.Text = ""
				hud.score.Text = string.format("TRIALISTS  %d – %d  ACADEMY", int(tv.shootout.us), int(tv.shootout.them))
			end
		end

		-- a training level: which, the tries, what to do
		local tr = f.training
		if tr then
			hud.trialTop.Visible = true
			hud.trialHint.Visible = true
			local pips = ""
			for i = 1, int(tr.tries.total) do
				local r = tr.tries.results[i]
				pips ..= (r == nil and "○" or r and "✓" or "✗")
			end
			hud.trialTop.Text = string.format("%s · LEVEL %d   %s", string.upper(tr.title), int(tr.level), pips)
			hud.trialHint.Text = (tr.line ~= "" and (tr.line .. "\n") or "") .. (tr.brief ~= "" and (tr.brief .. " · ") or "") .. tr.instruction
			hud.score.Text = "TRAINING"
			hud.minute.Text = ""
			if tr.flash then
				hud.banner.Visible = true
				hud.banner.Text = tr.flash.text
				hud.banner.TextColor3 = tr.flash.good and C.good or C.bad
			elseif tr.count > 0 then
				hud.banner.Visible = true
				hud.banner.Text = tostring(int(tr.count))
				hud.banner.TextColor3 = C.gold
			else
				hud.banner.TextColor3 = C.gold
			end
			if tr.stars ~= nil then
				hud.banner.Visible = true
				hud.banner.Text = string.rep("★", int(tr.stars)) .. string.rep("☆", 3 - int(tr.stars))
				hud.banner.TextColor3 = C.gold
			end
			if tr.tapToStart then
				hud.tapStart.Visible = true
				hud.tapStart.Text = "TAP TO START"
			end
		end

		-- a relationship game: which, how it's going, what he asks
		local rv = f.rel
		hud.signing.Visible = false
		if rv then
			hud.trialTop.Visible = true
			hud.trialHint.Visible = true
			hud.trialTop.Text = string.upper(rv.title) .. " · " .. rv.progress
			hud.trialHint.Text = (rv.ask ~= "" and (rv.ask .. "\n") or "") .. rv.line
			hud.score.Text = string.upper(rv.title)
			hud.minute.Text = ""
			if rv.flash then
				hud.banner.Visible = true
				hud.banner.Text = rv.flash.text
				hud.banner.TextColor3 = rv.flash.good and C.good or C.bad
			else
				hud.banner.TextColor3 = C.gold
			end
			local sg = rv.signing
			if sg then
				if not sg.started then
					hud.tapStart.Visible = true
					hud.tapStart.Text = "START"
				else
					hud.signing.Visible = true
					hud.fanIcon.Text = sg.fanIcon
					local w = ""
					for i = 1, Js.alen(sg.wants) do
						local it = sg.wants[i]
						w ..= (it.got and "✅" or it.icon) .. " "
					end
					hud.wants.Text = w
					hud.patience.Size = UDim2.fromScale(math.clamp(sg.left, 0, 1), 1)
					for i = 1, 4 do
						local o = sg.order[i]
						hud.signBtns[i].Text = o and (o.icon .. " " .. string.upper(o.label)) or ""
					end
				end
			end
		end

		-- the strike screen
		hud.strike.Visible = strike ~= nil
		if strike then
			local v = S.strikeView(strike)
			local size = hud.strike.AbsoluteSize
			local A = math.min(size.X, size.Y) * 0.7
			local r = A * 0.26
			local cx = size.X / 2 + v.ballX * A
			local cy = size.Y * 0.52 + v.ballY * A
			hud.ball.Size = UDim2.fromOffset(r * 2, r * 2)
			hud.ball.Position = UDim2.fromOffset(cx, cy)
			hud.shadow.Size = UDim2.fromOffset(r * 1.6 * (1 - 0.45 * v.lift), r * 0.35)
			hud.shadow.Position = UDim2.fromOffset(cx, size.Y * 0.52 + r + 10)
			hud.strikeHead.Text = v.heading
			hud.ringBack.Visible = v.ring ~= nil
			if v.ring then
				hud.ring.Size = UDim2.fromScale(v.ring, 1)
				hud.ring.BackgroundColor3 = v.ring < 0.3 and C.bad or C.gold
			end
			hud.pow.Size = UDim2.fromScale(1, math.clamp(v.powerPct / 100, 0, 1))
			hud.pow.BackgroundColor3 = color(v.powerColor)
			hud.powText.Text = tostring(v.powerPct) .. "%"
			hud.verdict.Text = v.verdict and v.verdict.label or (v.timedOut and "TOO SLOW!" or "")
			hud.verdict.TextColor3 = (v.verdict and v.verdict.good) and C.good or (v.verdict or v.timedOut) and C.bad or C.gold
			hud.spark.Visible = v.spark ~= nil
			if v.spark then
				hud.spark.Position = UDim2.fromScale(0.5 + v.spark.cx / 2, 0.5 + v.spark.cy / 2)
			end
			hud.spot.Visible = v.powerSpot ~= nil
			if v.powerSpot then
				hud.spot.Size = UDim2.fromScale(0.3, 0.3)
				hud.spot.Position = UDim2.fromScale(0.5 + v.powerSpot.x / 2, 0.5 + v.powerSpot.y / 2)
			end
		end
	end

	local conn
	conn = RunService.RenderStepped:Connect(function(dt)
		if finished then
			return
		end
		clock += dt
		safe(function()
			-- the match on the pitch can change (the trial's stages): start its input afresh
			local now = driver.match()
			if now ~= m then
				m = now
				Match.current = m
				strike = nil
				pointer = nil
				lastPhase = ""
			end
			stepInput()
			if m then
				-- the strike screen opens whenever the phase is "contact" (a run-up gets there mid-frame)
				if m.phase == "contact" and strike == nil then
					strike = S.openStrike(m)
				elseif m.phase ~= "contact" then
					strike = nil
				end
				if strike then
					S.strikeStep(strike, m, dt)
				end
			end
			driver.step(dt)
			local f = driver.frame()
			drawFrame(f, dt)
			lastPhase = f.phase
			if driver.done() then
				finished = true
			end
		end)
		if failure then
			finished = true
		end
	end)
	hud.cover.Visible = false

	while not finished do
		task.wait()
	end
	conn:Disconnect()
	for _, c in ipairs(inputConns) do
		c:Disconnect()
	end

	-- put everything back
	world:Destroy()
	Lighting.ClockTime = saved.ClockTime
	Lighting.Brightness = saved.Brightness
	camera.CameraType = camSaved.type
	camera.FieldOfView = camSaved.fov
	if hrp then
		hrp.Anchored = wasAnchored
	end
	return failure
end

--[[
  Plays one match. `remote` is ReplicatedStorage.Remotes.Match.
  Returns the next screen's JSON from the server (or nil if it failed).
]]
function Match.play(remote)
	loadCode()
	local hud = buildHud()
	local okStart, setupJson = pcall(function()
		return remote:InvokeServer("start")
	end)
	if not okStart or type(setupJson) ~= "string" then
		hud.gui:Destroy()
		warn("match: could not start:", setupJson)
		return nil
	end
	local m
	local okMount, err = pcall(function()
		m = M.startMatch(Js.JSON.parse(setupJson))
	end)
	if not okMount then
		hud.gui:Destroy()
		warn("match: could not mount:", err)
		return remote:InvokeServer("abandon")
	end
	local failure = runPitch(hud, {
		match = function()
			return m
		end,
		step = function(dt)
			M.tick(m, dt)
		end,
		frame = function()
			return V.frameOf(m)
		end,
		done = function()
			return m.result ~= nil
		end,
	})
	local nextScreen
	if failure then
		warn("match: stopped by an error:", failure)
		hud.cover.Visible = true
		hud.coverText.Text = "The match hit a problem. It will be simmed instead."
		task.wait(1.5)
		nextScreen = remote:InvokeServer("abandon")
	else
		-- full time
		local r = m.result
		hud.final.Visible = true
		hud.sim.Visible = false
		hud.pause.Visible = false
		local sc = V.frameOf(m).score
		hud.finalScore.Text = sc.home and string.format("%s %d – %d %s", sc.usName, int(r.homeScore), int(r.awayScore), sc.themName)
			or string.format("%s %d – %d %s", sc.themName, int(r.homeScore), int(r.awayScore), sc.usName)
		hud.finalLine.Text = string.format("Goals %d · Assists %d · Rating %.1f%s", int(r.goals), int(r.assists), r.rating, r.starMan and " · Star man ⭐" or "")
		local go = false
		local c = hud.finalGo.Activated:Connect(function()
			go = true
		end)
		while not go do
			task.wait()
		end
		c:Disconnect()
		hud.cover.Visible = true
		hud.coverText.Text = "…"
		local ok, res = pcall(function()
			return remote:InvokeServer("done", Js.JSON.stringify(r))
		end)
		nextScreen = ok and res or nil
	end
	hud.gui:Destroy()
	Match.current, Match.hud = nil, nil
	return nextScreen
end

--[[
  Plays the trial (roblox/game/trialPlay.ts): the five stages, on the same
  pitch. `remote` is ReplicatedStorage.Remotes.Trial. Returns the next
  screen's JSON from the server (or nil if it failed).
]]
function Match.playTrial(remote)
	loadCode()
	local T = Loader.import("roblox/game/trialPlay")
	local hud = buildHud()
	local okStart, json = pcall(function()
		return remote:InvokeServer("start")
	end)
	if not okStart or type(json) ~= "string" then
		hud.gui:Destroy()
		warn("trial: could not start:", json)
		return nil
	end
	local tp
	local okMount, err = pcall(function()
		tp = T.startTrialPlay(Js.JSON.parse(json))
	end)
	if not okMount then
		hud.gui:Destroy()
		warn("trial: could not mount:", err)
		return nil
	end
	Match.trial = tp
	hud.trialCardGo.Activated:Connect(function()
		T.tapToGo(tp)
	end)
	local failure = runPitch(hud, {
		match = function()
			return T.pitchMatch(tp)
		end,
		step = function(dt)
			T.tick(tp, dt)
		end,
		frame = function()
			return T.trialFrame(tp)
		end,
		done = function()
			return tp.done
		end,
		tapGround = function(x, y)
			T.visionTap(tp, vec(x, y))
		end,
		stick = function(mx, _mz)
			T.dribbleSteer(tp, mx)
		end,
		knock = function(dir)
			T.dribbleKnock(tp, dir)
		end,
		tapToGo = function()
			T.tapToGo(tp)
		end,
	})
	local nextScreen
	if failure then
		warn("trial: stopped by an error:", failure)
		hud.cover.Visible = true
		hud.coverText.Text = "The trial hit a problem. Try it again from the menu."
		task.wait(1.5)
		nextScreen = remote:InvokeServer("abandon")
	else
		hud.cover.Visible = true
		hud.coverText.Text = "…"
		local ok, res = pcall(function()
			return remote:InvokeServer("done", Js.JSON.stringify(tp.back))
		end)
		nextScreen = ok and res or nil
	end
	hud.gui:Destroy()
	Match.current, Match.hud, Match.trial = nil, nil, nil
	return nextScreen
end

--[[
  Plays one training level (roblox/game/trainingPlay.ts) on the same pitch.
  `remote` is ReplicatedStorage.Remotes.Training, `arg` "skill:level".
  Returns the next screen's JSON from the server (or nil if it failed).
]]
function Match.playTraining(remote, arg)
	loadCode()
	local T = Loader.import("roblox/game/trainingPlay")
	local hud = buildHud()
	local okStart, json = pcall(function()
		return remote:InvokeServer("start", arg)
	end)
	if not okStart or type(json) ~= "string" then
		hud.gui:Destroy()
		warn("training: could not start:", json)
		return nil
	end
	local tp
	local okMount, err = pcall(function()
		local s = Js.JSON.parse(json)
		tp = T.startTraining(s.career, s.skill, s.level, s.overlay)
	end)
	if not okMount then
		hud.gui:Destroy()
		warn("training: could not mount:", err)
		return remote:InvokeServer("abandon")
	end
	Match.training = tp
	local failure = runPitch(hud, {
		match = function()
			return T.pitchMatch(tp)
		end,
		step = function(dt)
			T.tick(tp, dt)
		end,
		frame = function()
			return T.trainingFrame(tp)
		end,
		done = function()
			return tp.done
		end,
		tapGround = function(x, y)
			T.visionTap(tp, vec(x, y))
		end,
		stick = function(mx, _mz)
			T.paceSteer(tp, mx)
		end,
		knock = function(dir)
			T.paceKnock(tp, dir)
		end,
		tapToGo = function()
			T.tapToGo(tp)
		end,
	})
	local nextScreen
	hud.cover.Visible = true
	hud.coverText.Text = "…"
	if failure then
		warn("training: stopped by an error:", failure)
		nextScreen = remote:InvokeServer("abandon")
	else
		local ok, res = pcall(function()
			return remote:InvokeServer("done", Js.JSON.stringify(Js.O({ stars = tp.stars or 0 }, { "stars" })))
		end)
		nextScreen = ok and res or nil
	end
	hud.gui:Destroy()
	Match.current, Match.hud, Match.training = nil, nil, nil
	return nextScreen
end

--[[
  Plays one relationship game (roblox/game/relgamePlay.ts): the woodwork
  challenge, the manager's penalties or extra session on the pitch, or the
  signing session. `remote` is ReplicatedStorage.Remotes.Relgame.
]]
function Match.playRelGame(remote, game)
	loadCode()
	local R = Loader.import("roblox/game/relgamePlay")
	local hud = buildHud()
	local okStart, json = pcall(function()
		return remote:InvokeServer("start", game)
	end)
	if not okStart or type(json) ~= "string" then
		hud.gui:Destroy()
		warn("relationship game: could not start:", json)
		return nil
	end
	local rp
	local okMount, err = pcall(function()
		local s = Js.JSON.parse(json)
		rp = R.startRelGame(s.career, s.game)
	end)
	if not okMount then
		hud.gui:Destroy()
		warn("relationship game: could not mount:", err)
		return remote:InvokeServer("abandon")
	end
	Match.rel = rp
	for i = 1, 4 do
		hud.signBtns[i].Activated:Connect(function()
			local id = rp.order[i]
			if id then
				R.signingTap(rp, id)
			end
		end)
	end
	local failure = runPitch(hud, {
		match = function()
			return R.pitchMatch(rp)
		end,
		step = function(dt)
			R.tick(rp, dt)
		end,
		frame = function()
			return R.relFrame(rp)
		end,
		done = function()
			return rp.done
		end,
		tapToGo = function()
			R.signingStart(rp)
		end,
	})
	local nextScreen
	hud.cover.Visible = true
	hud.coverText.Text = "…"
	if failure then
		warn("relationship game: stopped by an error:", failure)
		nextScreen = remote:InvokeServer("abandon")
	else
		local ok, res = pcall(function()
			return remote:InvokeServer("done", Js.JSON.stringify(Js.O({ count = rp.count }, { "count" })))
		end)
		nextScreen = ok and res or nil
	end
	hud.gui:Destroy()
	Match.current, Match.hud, Match.rel = nil, nil, nil
	return nextScreen
end

return Match
