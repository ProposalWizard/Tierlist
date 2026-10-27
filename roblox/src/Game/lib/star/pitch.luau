--!nocheck
--!nolint
-- Generated from lib/star/pitch.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local PITCH_W, HALF_LEN, CX, GOAL_W, GOAL_H, POST_L, POST_R, NET_DEPTH, SIX_DEPTH, SIX_L, SIX_R, BOX_DEPTH, BOX_L, BOX_R, PEN_SPOT_Y, ARC_R, CENTRE_R, CORNER_R, BALL_R, insideGoalMouth, hitsPost, insideBox
	insideGoalMouth = function(x, l, r)
		if l == nil then l = POST_L end
		if r == nil then r = POST_R end
		do return ((x >= l) and (x <= r)) end
	end
	exports.insideGoalMouth = insideGoalMouth
	hitsPost = function(x, l, r)
		if l == nil then l = POST_L end
		if r == nil then r = POST_R end
		do return (((x >= (l - (BALL_R * 2))) and (x < l)) or ((x > r) and (x <= (r + (BALL_R * 2))))) end
	end
	exports.hitsPost = hitsPost
	insideBox = function(x, y)
		do return ((((x >= BOX_L) and (x <= BOX_R)) and (y >= 0)) and (y <= BOX_DEPTH)) end
	end
	exports.insideBox = insideBox
	PITCH_W = 68
	exports.PITCH_W = PITCH_W
	HALF_LEN = 52.5
	exports.HALF_LEN = HALF_LEN
	CX = (PITCH_W / 2)
	exports.CX = CX
	GOAL_W = 7.32
	exports.GOAL_W = GOAL_W
	GOAL_H = 2.44
	exports.GOAL_H = GOAL_H
	POST_L = (CX - (GOAL_W / 2))
	exports.POST_L = POST_L
	POST_R = (CX + (GOAL_W / 2))
	exports.POST_R = POST_R
	NET_DEPTH = 1.2
	exports.NET_DEPTH = NET_DEPTH
	SIX_DEPTH = 5.5
	exports.SIX_DEPTH = SIX_DEPTH
	SIX_L = (POST_L - 5.5)
	exports.SIX_L = SIX_L
	SIX_R = (POST_R + 5.5)
	exports.SIX_R = SIX_R
	BOX_DEPTH = 16.5
	exports.BOX_DEPTH = BOX_DEPTH
	BOX_L = (POST_L - 16.5)
	exports.BOX_L = BOX_L
	BOX_R = (POST_R + 16.5)
	exports.BOX_R = BOX_R
	PEN_SPOT_Y = 11
	exports.PEN_SPOT_Y = PEN_SPOT_Y
	ARC_R = 9.15
	exports.ARC_R = ARC_R
	CENTRE_R = 9.15
	exports.CENTRE_R = CENTRE_R
	CORNER_R = 1
	exports.CORNER_R = CORNER_R
	BALL_R = 0.11
	exports.BALL_R = BALL_R
end
