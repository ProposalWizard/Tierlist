-- Stand-ins for the Roblox services the server uses (smoke test only).
local function signal()
	local s = { _fns = {} }
	function s:Connect(f)
		table.insert(self._fns, f)
		return { Disconnect = function() end }
	end
	function s:Fire(...)
		for _, f in self._fns do
			f(...)
		end
	end
	return s
end
local Instances = {}
Instance = {
	new = function(class)
		local o = { ClassName = class, Name = class, _children = {} }
		setmetatable(o, {
			__newindex = function(t, k, v)
				if k == "Parent" and v then
					v._children[t.Name] = t
				end
				rawset(t, k, v)
			end,
		})
		return o
	end,
}
local ReplicatedStorage = { _children = {} }
function ReplicatedStorage:WaitForChild(n)
	return self._children[n]
end
local players = {}
PLAYERS = {
	PlayerAdded = signal(),
	PlayerRemoving = signal(),
	GetPlayers = function()
		return players
	end,
}
local store = { data = {} }
function store:GetAsync(k)
	return self.data[k]
end
function store:SetAsync(k, v)
	-- a DataStore keeps a copy
	if type(v) == "table" then
		self.data[k] = { v = v.v, parts = v.parts, game = v.game }
		SAVED_BYTES = (SAVED_BYTES_PARTS or 0) + (v.game and #v.game or 0)
		SAVED_BYTES_PARTS = 0
	else
		assert(#v <= 3000000, "a piece over 3 MB")
		self.data[k] = v
		SAVED_BYTES_PARTS = (SAVED_BYTES_PARTS or 0) + #v
	end
end
SAVED = store
HTTP_CALLS = 0
local services = {
	Players = PLAYERS,
	ReplicatedStorage = ReplicatedStorage,
	HttpService = {
		RequestAsync = function(_, req)
			HTTP_CALLS += 1
			error("HttpService is not enabled (smoke test: no internet)")
		end,
	},
	DataStoreService = {
		GetDataStore = function()
			return store
		end,
	},
	RunService = {
		IsStudio = function()
			return false
		end,
	},
}
game = {
	GetService = function(_, n)
		return services[n]
	end,
	BindToClose = function() end,
}
task = {
	wait = function() end,
	spawn = function(f, ...)
		-- the save loop never returns: skip it
		local info = debug.info(f, "s")
		if string.find(tostring(info), "smoke") and select("#", ...) == 0 then
			return
		end
		f(...)
	end,
	defer = function() end,
}
warn = function(...)
	print("WARN", ...)
end
