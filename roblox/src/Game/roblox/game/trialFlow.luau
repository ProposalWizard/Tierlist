--!nocheck
--!nolint
-- Generated from roblox/game/trialFlow.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_careerFlow = import("lib/star/careerFlow")
	local M_trial = import("lib/star/trial")
	local M_scoutedPlacement = import("lib/star/scoutedPlacement")
	local M_scoutOffers = import("lib/star/scoutOffers")
	local M_season = import("lib/star/season")
	local M_signingTalk = import("lib/star/signingTalk")
	local M_leoUpdate = import("lib/star/leoUpdate")
	local M_story = import("lib/star/story")
	local M_economy = import("lib/star/economy")
	local M_youth = import("lib/star/youth")
	local M_career = import("lib/star/intl/career")
	local newTrialCareer, recordTrialReturn, offersForTrial, talkingClubFor, managerTalk, offersWithAgreedTerms, acceptManagerOffer, signTrialOffer, youthAfterTrial, trialSummary
	newTrialCareer = function(player, division, seed)
		do return Js.ospread(M_careerFlow.makeIdentity(player, division), Js.O({ trial = (if (seed == nil) then M_trial.startTrial() else M_trial.startTrial(seed)) }, { "trial" })) end
	end
	exports.newTrialCareer = newTrialCareer
	recordTrialReturn = function(career, back)
		local trial = career.trial
		if (((not trial) or (not back)) or (not Js.Array.isArray(back.results))) then
			do return nil end
		end
		do
			local _arr1 = back.results
			local _i2 = 0
			while _i2 < Js.alen(_arr1) do
				_i2 += 1
				local r = _arr1[_i2]
				local want = M_trial.nextStage(trial)
				if ((not Js.T(want)) or (r.stage ~= want)) then
					do return nil end
				end
				if ((((type(r.quality) ~= "number") or (not Js.NumberNS.isFinite(r.quality))) or (r.quality < 0)) or (r.quality > 1)) then
					do return nil end
				end
				trial = M_trial.recordStage(trial, want, r.quality)
				if (want == "shootout") then
					trial = Js.ospread(trial, Js.O({ finalPenScored = (not (not back.finalPenScored)) }, { "finalPenScored" }))
				end
			end
		end
		if (not M_trial.trialComplete(trial)) then
			do return nil end
		end
		do return Js.ospread(career, Js.O({ trial = trial }, { "trial" })) end
	end
	exports.recordTrialReturn = recordTrialReturn
	offersForTrial = function(career)
		if (not career.trial) then
			do return Js.alit() end
		end
		if ((if career.trialsTaken ~= nil then career.trialsTaken else 1) <= 1) then
			do return Js.alit(M_scoutedPlacement.scoutedOfferForTrial(career.trial)) end
		end
		do return M_scoutOffers.trialOffers(M_trial.trialScore(career.trial), M_season.mulberry32(Js.bxor(career.trial.seed, 376999)), Js.O({ retrial = ((if career.trialsTaken ~= nil then career.trialsTaken else 1) > 1) }, { "retrial" })) end
	end
	exports.offersForTrial = offersForTrial
	talkingClubFor = function(career, offers)
		if (not Js.T(Js.alen(offers))) then
			do return nil end
		end
		do return (A.find(offers, function(o)
			return (o.club == career.player.club)
		end) or offers[1]) end
	end
	exports.talkingClubFor = talkingClubFor
	managerTalk = function(career)
		local offers = offersForTrial(career)
		local talking = talkingClubFor(career, offers)
		if ((not talking) or (not career.trial)) then
			do return nil end
		end
		local talk = M_signingTalk.managerTalkFor(Js.O({ trial = career.trial, club = talking.club, division = talking.division, clubStrength = talking.strength, playerFirstName = career.player.firstName, scoutNouns = M_leoUpdate.leoUpdateOn("bugFixes"), rng = M_season.mulberry32(Js.bxor(career.trial.seed, 108979)) }, { "trial", "club", "division", "clubStrength", "playerFirstName", "scoutNouns", "rng" }))
		local firstContract = M_story.isStory(career)
		do return Js.O({ talk = (if firstContract then Js.ospread(talk, Js.O({ openingWeekly = M_scoutedPlacement.FIRST_CONTRACT_WAGE }, { "openingWeekly" })) else talk), offer = talking, firstContract = firstContract }, { "talk", "offer", "firstContract" }) end
	end
	exports.managerTalk = managerTalk
	offersWithAgreedTerms = function(career, offers)
		local agreed = career.agreedTerms
		if (not agreed) then
			do return offers end
		end
		if (agreed.wage <= 0) then
			local rest = A.filter(offers, function(o)
				return (o.club ~= agreed.club)
			end)
			do return (if Js.T(Js.alen(rest)) then rest else offers) end
		end
		do return A.map(offers, function(o)
			return (if (o.club == agreed.club) then Js.ospread(o, Js.O({ wage = agreed.wage, goalBonus = M_economy.goalBonusFor(agreed.wage), assistBonus = M_economy.assistBonusFor(agreed.wage) }, { "wage", "goalBonus", "assistBonus" })) else o)
		end) end
	end
	acceptManagerOffer = function(career)
		local mt = managerTalk(career)
		if (not mt) then
			do return nil end
		end
		local agreed = Js.ospread(career, Js.O({ agreedTerms = Js.O({ club = mt.offer.club, wage = mt.talk.openingWeekly }, { "club", "wage" }) }, { "agreedTerms" }))
		local offer = A.find(offersWithAgreedTerms(agreed, offersForTrial(agreed)), function(o)
			return (o.club == mt.offer.club)
		end)
		do return (if offer then signTrialOffer(agreed, offer) else nil) end
	end
	exports.acceptManagerOffer = acceptManagerOffer
	signTrialOffer = function(career, offer)
		local loan = M_youth.rollLoanWildcard(offer.club, offer.division, offer.seasons, M_season.mulberry32(Js.bxor(Js.bxor(((function() local _v = career.trial; if _v == nil then return nil end; _v = _v.seed; return _v end)() or 1), 28834), S.len(offer.club))))
		local homeClub = (if loan then loan.hostClub else offer.club)
		local homeDivision = (if loan then loan.hostDivision else offer.division)
		local wage = (if loan then loan.wage else offer.wage)
		local clubs = (if loan then loan.hostClubs else M_scoutOffers.clubsForDivision(offer.division))
		local signed = M_careerFlow.attachClub(career, homeClub, clubs, homeDivision, wage)
		local out = Js.ospread(signed, Js.O({ contract = Js.O({ club = (if loan then loan.parentClub else offer.club), wage = wage, goalBonus = (if loan then M_economy.goalBonusFor(wage) else offer.goalBonus), assistBonus = (if loan then M_economy.assistBonusFor(wage) else offer.assistBonus), seasonsRemaining = offer.seasons }, { "club", "wage", "goalBonus", "assistBonus", "seasonsRemaining" }), agreedTerms = nil }, { "contract", "agreedTerms" }), (if loan then Js.O({ placement = M_youth.startLoanSpell(loan, signed.seasonStats.goals) }, { "placement" }) else nil))
		if (Js.T((function() local _v = out.fixtures; if _v == nil then return nil end; _v = Js.len(_v); return _v end)()) and (not (function() local _v = out.intl; if _v == nil then return nil end; _v = _v.xi; if _v == nil then return nil end; _v = _v[Js.key(out.season)]; return _v end)())) then
			out = M_career.syncIntl(out)
		end
		do return out end
	end
	exports.signTrialOffer = signTrialOffer
	youthAfterTrial = function(career)
		if (not career.trial) then
			do return nil end
		end
		local taker = M_youth.youthTakerFor(M_trial.trialScore(career.trial), M_season.mulberry32(Js.bxor(career.trial.seed, 40465)))
		if (not taker) then
			do return nil end
		end
		local wage = M_youth.youthWage(taker.club, taker.division)
		local signed = M_careerFlow.attachClub(career, taker.club, taker.clubs, taker.division, wage)
		do return Js.ospread(signed, Js.O({ contract = Js.O({ club = taker.club, wage = wage, goalBonus = M_economy.goalBonusFor(wage), assistBonus = M_economy.assistBonusFor(wage), seasonsRemaining = 2 }, { "club", "wage", "goalBonus", "assistBonus", "seasonsRemaining" }), agreedTerms = nil, placement = M_youth.startYouthSpell(taker.club, taker.division, "trial") }, { "contract", "agreedTerms", "placement" })) end
	end
	exports.youthAfterTrial = youthAfterTrial
	trialSummary = function(trial)
		do return A.map(M_trial.trialStagesFor(trial), function(s)
			return Js.O({ stage = s, score = ((function() local _v = trial.results[s]; if _v == nil then return nil end; _v = _v.score; return _v end)() or nil) }, { "stage", "score" })
		end) end
	end
	exports.trialSummary = trialSummary
end
