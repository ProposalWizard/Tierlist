--!strict
--[[
  Loader: connects the converted website files inside Roblox.
  Each file in ReplicatedStorage.Game is `return function(exports, import, Js)`.
  Loader.import("lib/star/careerFlow") runs it (once) and returns its exports.
]]
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Js = require(script.Parent.Js)

local Loader = {}
Loader.Js = Js

local function find(path: string): ModuleScript?
	local node: Instance = ReplicatedStorage:WaitForChild("Game")
	for part in string.gmatch(path, "[^/]+") do
		local child = node:FindFirstChild(part)
		if not child then
			return nil
		end
		node = child
	end
	return if node:IsA("ModuleScript") then node else nil
end

Loader.import = Js.makeImporter(function(path)
	local m = find(path)
	if m == nil then
		return nil
	end
	return (require :: any)(m)
end)

return Loader
