--[[
  The Road to Ballon d'Or screens, on the player's device.

  A plain drawer: asks the server for the screen (Remotes.Career), draws it,
  and sends back the action of whatever is pressed. What a screen holds and
  what a button does is decided on the server (roblox/game/screens.ts).

  House style (.claude/skills/ui-house-style): taps go straight in, no menu
  animations; the heavy font only for titles and big numbers; the lighter
  green pitch; the main buttons always on screen.
  Roblox look (Mikey, 27 Oct 2026: "try and do Roblox-type menus"): chunky
  rounded buttons with a dark outline and a shine, the Fredoka font, icons,
  bold colour.
]]

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local HttpService = game:GetService("HttpService")
local StarterGui = game:GetService("StarterGui")

local player = Players.LocalPlayer
local remote = ReplicatedStorage:WaitForChild("Remotes"):WaitForChild("Career")
local matchRemote = ReplicatedStorage.Remotes:WaitForChild("Match")
local trialRemote = ReplicatedStorage.Remotes:WaitForChild("Trial")
local trainingRemote = ReplicatedStorage.Remotes:WaitForChild("Training")
local relRemote = ReplicatedStorage.Remotes:WaitForChild("Relgame")
local MatchClient = require(script.Parent:WaitForChild("Match"))

pcall(function()
	StarterGui:SetCoreGuiEnabled(Enum.CoreGuiType.PlayerList, false)
	StarterGui:SetCoreGuiEnabled(Enum.CoreGuiType.Backpack, false)
end)

-- ──────────────────────────────────────────────────────────────── the look ──
local C = {
	stripeA = Color3.fromHex("2c8a4b"),
	stripeB = Color3.fromHex("257a41"),
	panel = Color3.fromHex("0b1220"),
	panel2 = Color3.fromHex("111a2e"),
	line = Color3.fromHex("ffffff"),
	text = Color3.fromHex("ffffff"),
	dim = Color3.fromHex("b6c2d4"),
	good = Color3.fromHex("34d399"),
	bad = Color3.fromHex("f87171"),
	gold = Color3.fromHex("fde047"),
	primary = Color3.fromHex("22c55e"),
	primaryText = Color3.fromHex("ffffff"),
	secondary = Color3.fromHex("3b82f6"),
	danger = Color3.fromHex("ef4444"),
	outline = Color3.fromHex("0b1220"),
	field = Color3.fromHex("1e293b"),
	highlight = Color3.fromHex("fde047"),
}
local TITLE_FONT = Enum.Font.FredokaOne -- the round, heavy font Roblox games use
local BODY_FONT = Enum.Font.Gotham
local BODY_BOLD = Enum.Font.GothamBold
local MAX_WIDTH = 560

local function toneColor(tone)
	if tone == "good" then
		return C.good
	elseif tone == "bad" then
		return C.bad
	elseif tone == "gold" then
		return C.gold
	elseif tone == "dim" then
		return C.dim
	end
	return C.text
end

-- ─────────────────────────────────────────────────────────────── helpers ──
local function make(class, props, children)
	local o = Instance.new(class)
	for k, v in pairs(props or {}) do
		o[k] = v
	end
	for _, ch in ipairs(children or {}) do
		ch.Parent = o
	end
	return o
end

-- the Roblox look: round corners, a dark outline, a shine from the top
local function rounded(o, r)
	make("UICorner", { CornerRadius = UDim.new(0, r or 12) }).Parent = o
	return o
end
local function outline(o, col, thick)
	local st = make("UIStroke", { Color = col or C.outline, Thickness = thick or 3, ApplyStrokeMode = Enum.ApplyStrokeMode.Border })
	st.Parent = o
	return st
end
local function shine(o)
	make("UIGradient", {
		Rotation = 90,
		Color = ColorSequence.new(Color3.new(1, 1, 1), Color3.fromRGB(190, 190, 190)),
	}).Parent = o
	return o
end
local function textOutline(o)
	make("UIStroke", { Color = C.outline, Thickness = 2, ApplyStrokeMode = Enum.ApplyStrokeMode.Contextual }).Parent = o
	return o
end
local TAB_ICON = { home = "🏠", train = "🏋️", life = "🌴", league = "🏆", fixtures = "📅", stats = "📊" }

local function pad(px)
	return make("UIPadding", {
		PaddingLeft = UDim.new(0, px),
		PaddingRight = UDim.new(0, px),
		PaddingTop = UDim.new(0, px),
		PaddingBottom = UDim.new(0, px),
	})
end

local function label(text, size, color, font, props)
	local l = make("TextLabel", {
		BackgroundTransparency = 1,
		Text = text,
		TextSize = size,
		TextColor3 = color or C.text,
		Font = font or BODY_FONT,
		TextWrapped = true,
		TextXAlignment = Enum.TextXAlignment.Left,
		AutomaticSize = Enum.AutomaticSize.Y,
		Size = UDim2.new(1, 0, 0, 0),
	})
	for k, v in pairs(props or {}) do
		l[k] = v
	end
	return l
end

-- ─────────────────────────────────────────────────────────────── the frame ──
local gui = make("ScreenGui", {
	Name = "RoadToBallonDor",
	ResetOnSpawn = false,
	IgnoreGuiInset = true,
	ZIndexBehavior = Enum.ZIndexBehavior.Sibling,
	Parent = player:WaitForChild("PlayerGui"),
})

-- the pitch: lighter stripes, full screen
local pitch = make("Frame", { Size = UDim2.fromScale(1, 1), BackgroundColor3 = C.stripeA, BorderSizePixel = 0, Parent = gui })
for i = 0, 11 do
	if i % 2 == 1 then
		make("Frame", {
			Size = UDim2.new(1, 0, 1 / 12, 0),
			Position = UDim2.new(0, 0, i / 12, 0),
			BackgroundColor3 = C.stripeB,
			BorderSizePixel = 0,
			Parent = pitch,
		})
	end
end
make("Frame", { -- the vignette
	Size = UDim2.fromScale(1, 1),
	BackgroundColor3 = Color3.new(0, 0, 0),
	BackgroundTransparency = 0.82,
	BorderSizePixel = 0,
	Parent = pitch,
})

local column = make("Frame", {
	Size = UDim2.new(1, 0, 1, 0),
	Position = UDim2.new(0.5, 0, 0, 0),
	AnchorPoint = Vector2.new(0.5, 0),
	BackgroundTransparency = 1,
	Parent = gui,
}, { make("UISizeConstraint", { MaxSize = Vector2.new(MAX_WIDTH, math.huge) }) })

local topSafe = 36 -- room for Roblox's own top bar

-- HUD: name / club / league / season, money, star rating, energy bar
local hud = make("Frame", {
	Size = UDim2.new(1, -16, 0, 86),
	Position = UDim2.new(0, 8, 0, topSafe),
	BackgroundColor3 = C.panel,
	BackgroundTransparency = 0.08,
	BorderSizePixel = 0,
	Parent = column,
}, { pad(10) })
rounded(hud, 14)
outline(hud, Color3.fromHex("fde047"), 2)
local hudName = label("", 18, C.text, TITLE_FONT, { Size = UDim2.new(0.62, 0, 0, 24), AutomaticSize = Enum.AutomaticSize.None, TextTruncate = Enum.TextTruncate.AtEnd, TextWrapped = false, Parent = hud })
local hudClub = label("", 13, C.dim, BODY_FONT, { Position = UDim2.new(0, 0, 0, 24), Size = UDim2.new(0.62, 0, 0, 16), AutomaticSize = Enum.AutomaticSize.None, TextTruncate = Enum.TextTruncate.AtEnd, TextWrapped = false, Parent = hud })
local hudMoney = label("", 20, C.gold, TITLE_FONT, { Position = UDim2.new(0.62, 0, 0, 0), Size = UDim2.new(0.38, 0, 0, 24), AutomaticSize = Enum.AutomaticSize.None, TextXAlignment = Enum.TextXAlignment.Right, Parent = hud })
local hudStars = label("", 14, C.text, BODY_BOLD, { Position = UDim2.new(0.62, 0, 0, 24), Size = UDim2.new(0.38, 0, 0, 16), AutomaticSize = Enum.AutomaticSize.None, TextXAlignment = Enum.TextXAlignment.Right, Parent = hud })
-- the energy bar: smooth, rounded, glowing (LiquidBar on the website)
local energyBack = make("Frame", {
	Position = UDim2.new(0, 0, 0, 48),
	Size = UDim2.new(1, 0, 0, 14),
	BackgroundColor3 = Color3.fromHex("1e293b"),
	BorderSizePixel = 0,
	Parent = hud,
}, { make("UICorner", { CornerRadius = UDim.new(1, 0) }) })
local energyFill = make("Frame", {
	Size = UDim2.new(1, 0, 1, 0),
	BackgroundColor3 = C.good,
	BorderSizePixel = 0,
	Parent = energyBack,
}, {
	make("UICorner", { CornerRadius = UDim.new(1, 0) }),
	make("UIStroke", { Color = C.good, Thickness = 2, Transparency = 0.55 }),
})
local energyText = label("", 11, C.text, BODY_BOLD, { Size = UDim2.fromScale(1, 1), AutomaticSize = Enum.AutomaticSize.None, TextXAlignment = Enum.TextXAlignment.Center, ZIndex = 3, Parent = energyBack })

-- tabs
local tabsBar = make("Frame", {
	Size = UDim2.new(1, 0, 0, 46),
	BackgroundTransparency = 1,
	BorderSizePixel = 0,
	Parent = column,
}, {
	make("UIListLayout", { FillDirection = Enum.FillDirection.Horizontal, HorizontalAlignment = Enum.HorizontalAlignment.Center, VerticalAlignment = Enum.VerticalAlignment.Center, Padding = UDim.new(0, 6), SortOrder = Enum.SortOrder.LayoutOrder }),
	make("UIPadding", { PaddingLeft = UDim.new(0, 8), PaddingRight = UDim.new(0, 8) }),
})

-- the page
local page = make("ScrollingFrame", {
	BackgroundTransparency = 1,
	BorderSizePixel = 0,
	ScrollBarThickness = 4,
	ScrollBarImageColor3 = C.dim,
	AutomaticCanvasSize = Enum.AutomaticSize.Y,
	CanvasSize = UDim2.new(),
	ScrollingDirection = Enum.ScrollingDirection.Y,
	Parent = column,
}, {
	make("UIListLayout", { Padding = UDim.new(0, 8), SortOrder = Enum.SortOrder.LayoutOrder }),
	make("UIPadding", { PaddingLeft = UDim.new(0, 12), PaddingRight = UDim.new(0, 12), PaddingTop = UDim.new(0, 12), PaddingBottom = UDim.new(0, 16) }),
})

-- the buttons, pinned at the bottom
local BUTTON_H = 52
local buttonBar = make("Frame", {
	AnchorPoint = Vector2.new(0, 1),
	Position = UDim2.new(0, 0, 1, 0),
	Size = UDim2.new(1, 0, 0, 0),
	AutomaticSize = Enum.AutomaticSize.Y,
	BackgroundColor3 = C.panel,
	BackgroundTransparency = 0.05,
	BorderSizePixel = 0,
	Parent = column,
}, {
	make("UIListLayout", { Padding = UDim.new(0, 8), SortOrder = Enum.SortOrder.LayoutOrder }),
	make("UIPadding", { PaddingLeft = UDim.new(0, 12), PaddingRight = UDim.new(0, 12), PaddingTop = UDim.new(0, 10), PaddingBottom = UDim.new(0, 18) }),
})

-- a full-screen chooser (house rule: a chooser's list is a full page)
local chooser = make("Frame", {
	Size = UDim2.fromScale(1, 1),
	BackgroundColor3 = C.panel,
	BorderSizePixel = 0,
	Visible = false,
	ZIndex = 20,
	Parent = gui,
})

local busyCover = make("TextLabel", {
	Size = UDim2.fromScale(1, 1),
	BackgroundColor3 = Color3.new(0, 0, 0),
	BackgroundTransparency = 0.55,
	Text = "…",
	TextSize = 40,
	Font = TITLE_FONT,
	TextColor3 = C.gold,
	Visible = false,
	ZIndex = 30,
	Parent = gui,
})

-- ─────────────────────────────────────────────────────────────── drawing ──
local form = {} -- what's been typed and picked on this screen
local current -- the screen on show
local send -- forward

local function clear(frame)
	for _, ch in ipairs(frame:GetChildren()) do
		if not ch:IsA("UIListLayout") and not ch:IsA("UIPadding") and not ch:IsA("UISizeConstraint") then
			ch:Destroy()
		end
	end
end

local function button(b, order, parent)
	local style = b.style or "secondary"
	local bg = style == "primary" and C.primary or style == "danger" and C.danger or C.secondary
	local fg = style == "primary" and C.primaryText or C.text
	local btn = make("TextButton", {
		LayoutOrder = order,
		Size = UDim2.new(1, 0, 0, BUTTON_H),
		BackgroundColor3 = bg,
		BorderSizePixel = 0,
		AutoButtonColor = true, -- press feedback on the button itself
		Text = string.upper(b.label or ""),
		TextSize = 22,
		Font = TITLE_FONT,
		TextColor3 = fg,
		Parent = parent,
	})
	rounded(btn, 14)
	outline(btn, C.outline, 3)
	shine(btn)
	textOutline(btn)
	btn.Activated:Connect(function()
		send(b.action, b.arg)
	end)
	return btn
end

local function panel(order)
	local p = make("Frame", {
		LayoutOrder = order,
		Size = UDim2.new(1, 0, 0, 0),
		AutomaticSize = Enum.AutomaticSize.Y,
		BackgroundColor3 = C.panel,
		BackgroundTransparency = 0.12,
		BorderSizePixel = 0,
		Parent = page,
	}, { pad(12), make("UIListLayout", { Padding = UDim.new(0, 6), SortOrder = Enum.SortOrder.LayoutOrder }) })
	rounded(p, 12)
	outline(p, Color3.new(1, 1, 1), 1.5).Transparency = 0.8
	return p
end

local function openChooser(block, onPick)
	clear(chooser)
	chooser.Visible = true
	local top = make("Frame", { Size = UDim2.new(1, 0, 0, 56 + topSafe), BackgroundColor3 = C.panel2, BorderSizePixel = 0, ZIndex = 21, Parent = chooser })
	label(string.upper(block.label), 22, C.text, TITLE_FONT, { Position = UDim2.new(0, 16, 0, topSafe + 12), Size = UDim2.new(1, -80, 0, 30), AutomaticSize = Enum.AutomaticSize.None, ZIndex = 22, Parent = top })
	local close = make("TextButton", {
		Position = UDim2.new(1, -56, 0, topSafe + 6),
		Size = UDim2.new(0, 44, 0, 44),
		BackgroundTransparency = 1,
		Text = "✕",
		TextSize = 26,
		Font = BODY_BOLD,
		TextColor3 = C.text,
		ZIndex = 22,
		Parent = top,
	})
	close.Activated:Connect(function()
		chooser.Visible = false
	end)
	local search = make("TextBox", {
		Position = UDim2.new(0, 12, 0, 62 + topSafe),
		Size = UDim2.new(1, -24, 0, 40),
		BackgroundColor3 = C.field,
		BorderSizePixel = 0,
		PlaceholderText = "Search",
		Text = "",
		TextSize = 16,
		Font = BODY_FONT,
		TextColor3 = C.text,
		PlaceholderColor3 = C.dim,
		ClearTextOnFocus = false,
		ZIndex = 22,
		Parent = chooser,
	}, { pad(8) })
	local list = make("ScrollingFrame", {
		Position = UDim2.new(0, 0, 0, 110 + topSafe),
		Size = UDim2.new(1, 0, 1, -(110 + topSafe)),
		BackgroundTransparency = 1,
		BorderSizePixel = 0,
		AutomaticCanvasSize = Enum.AutomaticSize.Y,
		CanvasSize = UDim2.new(),
		ScrollBarThickness = 4,
		ZIndex = 21,
		Parent = chooser,
	}, { make("UIListLayout", { SortOrder = Enum.SortOrder.LayoutOrder }), make("UISizeConstraint", { MaxSize = Vector2.new(MAX_WIDTH, math.huge) }) })
	local function fill(filter)
		clear(list)
		local f = string.lower(filter or "")
		for i, opt in ipairs(block.options) do
			if f == "" or string.find(string.lower(opt), f, 1, true) then
				local row = make("TextButton", {
					LayoutOrder = i,
					Size = UDim2.new(1, 0, 0, 48),
					BackgroundColor3 = opt == block.value and C.field or C.panel,
					BorderSizePixel = 0,
					Text = "   " .. opt .. (opt == block.value and "  ✓" or ""),
					TextXAlignment = Enum.TextXAlignment.Left,
					TextSize = 17,
					Font = BODY_FONT,
					TextColor3 = C.text,
					ZIndex = 22,
					Parent = list,
				})
				row.Activated:Connect(function()
					chooser.Visible = false
					onPick(opt)
				end)
			end
		end
	end
	fill("")
	search:GetPropertyChangedSignal("Text"):Connect(function()
		fill(search.Text)
	end)
end

local drawBlock -- forward

local function drawScreen(s)
	current = s
	form = {}
	-- HUD
	if s.hud then
		hud.Visible = true
		hudName.Text = s.hud.name
		hudClub.Text = (s.hud.club ~= "" and (s.hud.club .. " · " .. s.hud.league) or "") .. " · " .. s.hud.season
		hudMoney.Text = s.hud.money
		hudStars.Text = "★ " .. tostring(s.hud.stars)
		local e = math.clamp((s.hud.energy or 0) / 100, 0, 1)
		energyFill.Size = UDim2.new(e, 0, 1, 0)
		local col = e < 0.35 and C.bad or e < 0.6 and C.gold or C.good
		energyFill.BackgroundColor3 = col
		energyFill:FindFirstChildOfClass("UIStroke").Color = col
		energyText.Text = "⚡ " .. tostring(s.hud.energy) .. "%"
	else
		hud.Visible = false
	end
	local y = topSafe + (s.hud and 86 or 0)
	-- tabs
	clear(tabsBar)
	if s.tabs and #s.tabs > 0 then
		tabsBar.Visible = true
		tabsBar.Position = UDim2.new(0, 0, 0, y)
		for i, t in ipairs(s.tabs) do
			local tb = make("TextButton", {
				LayoutOrder = i,
				Size = UDim2.new(1 / #s.tabs, -6, 1, -6),
				BackgroundColor3 = t.active and C.gold or C.panel2,
				BackgroundTransparency = 0,
				BorderSizePixel = 0,
				Text = (TAB_ICON[t.id] and (TAB_ICON[t.id] .. " ") or "") .. t.label,
				TextSize = 16,
				Font = TITLE_FONT,
				TextColor3 = t.active and C.outline or C.text,
				Parent = tabsBar,
			})
			rounded(tb, 12)
			outline(tb, C.outline, 2)
			-- six tabs on a phone: the label shrinks to fit
			tb.TextScaled = true
			make("UITextSizeConstraint", { MaxTextSize = 16, MinTextSize = 9 }).Parent = tb
			make("UIPadding", { PaddingLeft = UDim.new(0, 4), PaddingRight = UDim.new(0, 4) }).Parent = tb
			tb.Activated:Connect(function()
				send("tab", t.id)
			end)
		end
		y += 46
	else
		tabsBar.Visible = false
	end
	-- buttons
	clear(buttonBar)
	for i, b in ipairs(s.buttons or {}) do
		button(b, i, buttonBar)
	end
	local barH = #(s.buttons or {}) > 0 and (#s.buttons * (BUTTON_H + 8) + 20) or 0
	page.Position = UDim2.new(0, 0, 0, y)
	page.Size = UDim2.new(1, 0, 1, -(y + barH))
	page.CanvasPosition = Vector2.zero
	-- the page
	clear(page)
	if s.title and s.title ~= "" then
		textOutline(label(string.upper(s.title), 32, C.text, TITLE_FONT, { LayoutOrder = 0, Parent = page }))
	end
	for i, b in ipairs(s.blocks or {}) do
		drawBlock(b, i)
	end
end

drawBlock = function(b, order)
	local k = b.kind
	if k == "heading" then
		label(string.upper(b.text), 20, C.gold, TITLE_FONT, { LayoutOrder = order, Parent = page })
	elseif k == "text" then
		local p = panel(order)
		label(b.text, 16, toneColor(b.tone), b.tone == "gold" and BODY_BOLD or BODY_FONT, { Parent = p })
	elseif k == "stats" then
		local grid = make("Frame", {
			LayoutOrder = order,
			Size = UDim2.new(1, 0, 0, 0),
			AutomaticSize = Enum.AutomaticSize.Y,
			BackgroundTransparency = 1,
			Parent = page,
		}, { make("UIGridLayout", { CellSize = UDim2.new(0.5, -4, 0, 66), CellPadding = UDim2.new(0, 8, 0, 8), SortOrder = Enum.SortOrder.LayoutOrder }) })
		for i, it in ipairs(b.items or {}) do
			local cell = make("Frame", { LayoutOrder = i, BackgroundColor3 = C.panel, BackgroundTransparency = 0.12, BorderSizePixel = 0, Parent = grid }, { pad(8) })
			rounded(cell, 12)
			outline(cell, Color3.new(1, 1, 1), 1.5).Transparency = 0.8
			label(string.upper(it.label), 12, C.dim, BODY_BOLD, { Size = UDim2.new(1, 0, 0, 16), AutomaticSize = Enum.AutomaticSize.None, Parent = cell })
			label(it.value, 24, toneColor(it.tone), TITLE_FONT, { Position = UDim2.new(0, 0, 0, 18), Size = UDim2.new(1, 0, 0, 30), AutomaticSize = Enum.AutomaticSize.None, TextTruncate = Enum.TextTruncate.AtEnd, TextWrapped = false, Parent = cell })
		end
	elseif k == "table" then
		local p = panel(order)
		local cols = b.columns or {}
		-- the club column takes the room; the others are narrow
		local widths = {}
		local wide = 2
		local narrow = 0.09
		local nNarrow = #cols - 1
		for i = 1, #cols do
			widths[i] = (i == wide) and (1 - narrow * nNarrow) or narrow
		end
		local function row(cells, idx, isHead, hl)
			local r = make("Frame", {
				LayoutOrder = idx,
				Size = UDim2.new(1, 0, 0, 26),
				BackgroundColor3 = hl and C.highlight or C.panel,
				BackgroundTransparency = hl and 0.75 or 1,
				BorderSizePixel = 0,
				Parent = p,
			})
			local x = 0
			for i, text in ipairs(cells) do
				label(text, isHead and 12 or 14, isHead and C.dim or C.text, (isHead or hl) and BODY_BOLD or BODY_FONT, {
					Position = UDim2.new(x, 2, 0, 0),
					Size = UDim2.new(widths[i] or narrow, -4, 1, 0),
					AutomaticSize = Enum.AutomaticSize.None,
					TextWrapped = false,
					TextTruncate = Enum.TextTruncate.AtEnd,
					TextXAlignment = (i == wide) and Enum.TextXAlignment.Left or Enum.TextXAlignment.Center,
					Parent = r,
				})
				x += widths[i] or narrow
			end
		end
		row(cols, 0, true, false)
		for i, cells in ipairs(b.rows or {}) do
			row(cells, i, false, b.highlight ~= nil and (i - 1) == b.highlight)
		end
	elseif k == "list" then
		local p = panel(order)
		p:FindFirstChildOfClass("UIListLayout").Padding = UDim.new(0, 2)
		for i, it in ipairs(b.items or {}) do
			local holder
			if it.action then
				holder = make("TextButton", {
					LayoutOrder = i,
					Size = UDim2.new(1, 0, 0, 0),
					AutomaticSize = Enum.AutomaticSize.Y,
					BackgroundColor3 = C.field,
					BackgroundTransparency = 0.3,
					BorderSizePixel = 0,
					Text = "",
					Parent = p,
				})
				rounded(holder, 10)
				holder.Activated:Connect(function()
					send(it.action, it.arg)
				end)
			else
				holder = make("Frame", { LayoutOrder = i, Size = UDim2.new(1, 0, 0, 0), AutomaticSize = Enum.AutomaticSize.Y, BackgroundTransparency = 1, Parent = p })
			end
			pad(8).Parent = holder
			make("UIListLayout", { SortOrder = Enum.SortOrder.LayoutOrder, Padding = UDim.new(0, 2) }).Parent = holder
			label(it.text .. (it.action and "  ›" or ""), 16, toneColor(it.tone), it.action and BODY_BOLD or BODY_FONT, { LayoutOrder = 1, Parent = holder })
			if it.sub then
				label(it.sub, 13, C.dim, BODY_FONT, { LayoutOrder = 2, Parent = holder })
			end
		end
	elseif k == "input" then
		form[b.id] = b.value or ""
		local p = panel(order)
		label(string.upper(b.label), 12, C.dim, BODY_BOLD, { Parent = p })
		local box = make("TextBox", {
			LayoutOrder = 2,
			Size = UDim2.new(1, 0, 0, 40),
			BackgroundColor3 = C.field,
			BorderSizePixel = 0,
			Text = b.value or "",
			PlaceholderText = b.label,
			PlaceholderColor3 = C.dim,
			TextSize = 18,
			Font = BODY_FONT,
			TextColor3 = C.text,
			TextXAlignment = Enum.TextXAlignment.Left,
			ClearTextOnFocus = false,
			Parent = p,
		}, { pad(8) })
		rounded(box, 10)
		box:GetPropertyChangedSignal("Text"):Connect(function()
			form[b.id] = string.sub(box.Text, 1, 24)
		end)
	elseif k == "choice" then
		form[b.id] = b.value
		local p = panel(order)
		label(string.upper(b.label), 12, C.dim, BODY_BOLD, { Parent = p })
		local pick = make("TextButton", {
			LayoutOrder = 2,
			Size = UDim2.new(1, 0, 0, 40),
			BackgroundColor3 = C.field,
			BorderSizePixel = 0,
			Text = "  " .. tostring(b.value) .. "  ▾",
			TextXAlignment = Enum.TextXAlignment.Left,
			TextSize = 18,
			Font = BODY_BOLD,
			TextColor3 = C.text,
			Parent = p,
		})
		rounded(pick, 10)
		pick.Activated:Connect(function()
			openChooser({ label = b.label, options = b.options, value = form[b.id] }, function(v)
				form[b.id] = v
				pick.Text = "  " .. v .. "  ▾"
			end)
		end)
	end
end

-- ─────────────────────────────────────────────────────────────── talking ──
local sending = false
send = function(action, arg)
	if sending then
		return
	end
	sending = true
	busyCover.Visible = true
	local ok, json
	if action == "play-match" or action == "play-trial" or action == "play-training" or action == "play-relgame" then
		-- played here on the device; the menus wait underneath
		gui.Enabled = false
		if action == "play-match" then
			ok, json = pcall(MatchClient.play, matchRemote)
		elseif action == "play-training" then
			ok, json = pcall(MatchClient.playTraining, trainingRemote, arg)
		elseif action == "play-relgame" then
			ok, json = pcall(MatchClient.playRelGame, relRemote, arg)
		else
			ok, json = pcall(MatchClient.playTrial, trialRemote)
		end
		gui.Enabled = true
		if ok and json == nil then
			ok, json = pcall(function()
				return remote:InvokeServer("get", nil, form)
			end)
		end
	else
		ok, json = pcall(function()
			return remote:InvokeServer(action, arg, form)
		end)
	end
	busyCover.Visible = false
	sending = false
	if not ok then
		warn("Career call failed:", json)
		return
	end
	local decoded, s = pcall(function()
		return HttpService:JSONDecode(json)
	end)
	if decoded and s then
		drawScreen(s)
	end
end

send("get")
