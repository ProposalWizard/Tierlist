--!nocheck
-- Stand-in for the "react" package. Game logic files only import its hooks
-- for their screen helpers, which Roblox never calls; these keep them loadable.
return function(exports, import, Js)
	exports.useState = function(v)
		return Js.alit(v, function() end)
	end
	exports.useEffect = function() end
	exports.useMemo = function(f)
		return f()
	end
	exports.useCallback = function(f)
		return f
	end
	exports.useRef = function(v)
		return Js.O({ current = v }, { "current" })
	end
end
