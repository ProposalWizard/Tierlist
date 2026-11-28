/** Every story file in this folder except the kit man's (arcBook.ts imports that one itself).
 *  One line per file; tests/star/lifeArcs.mts fails if a JSON file here is missing from this list.
 *  The order is the start order (one new story a moment, first come): the few stories that can only
 *  start in your first seasons (age<=19) come first, then the rest A to Z. */
import type { LifeArc } from "../../types";
import a_his_boots from "./his-boots.json";
import a_the_highlighter from "./the-highlighter.json";
import a_the_first_wage from "./the-first-wage.json";
import a_the_scout from "./the-scout.json";
import a_after_the_casino from "./after-the-casino.json";
import a_bar_for_breakfast from "./bar-for-breakfast.json";
import a_brothers_trial from "./brothers-trial.json";
import a_chairmans_dinner from "./chairmans-dinner.json";
import a_dads_last_shift from "./dads-last-shift.json";
import a_dads_notes from "./dads-notes.json";
import a_deadline_day from "./deadline-day.json";
import a_derby_week from "./derby-week.json";
import a_dont_post_me from "./dont-post-me.json";
import a_free_kick_duty from "./free-kick-duty.json";
import a_head_tennis from "./head-tennis.json";
import a_her_birthday from "./her-birthday.json";
import a_her_job from "./her-job.json";
import a_her_shop from "./her-shop.json";
import a_her_sisters_wedding from "./her-sisters-wedding.json";
import a_her_song from "./her-song.json";
import a_his_last_season from "./his-last-season.json";
import a_his_mates_tickets from "./his-mates-tickets.json";
import a_his_old_club from "./his-old-club.json";
import a_keep_ups from "./keep-ups.json";
import a_kid_in_digs from "./kid-in-digs.json";
import a_left_back from "./left-back.json";
import a_legends_boots from "./legends-boots.json";
import a_next_door from "./next-door.json";
import a_number_nine from "./number-nine.json";
import a_on_commentary from "./on-commentary.json";
import a_pe_teacher from "./pe-teacher.json";
import a_play_through_it from "./play-through-it.json";
import a_players_player from "./players-player.json";
import a_released from "./released.json";
import a_roommates_phone from "./roommates-phone.json";
import a_she_grows_up from "./she-grows-up.json";
import a_ten_minutes from "./ten-minutes.json";
import a_the_advert from "./the-advert.json";
import a_the_alibi from "./the-alibi.json";
import a_the_ankle from "./the-ankle.json";
import a_the_armband from "./the-armband.json";
import a_the_assembly from "./the-assembly.json";
import a_the_bad_car from "./the-bad-car.json";
import a_the_ball_girl from "./the-ball-girl.json";
import a_the_balls_in_the_car from "./the-balls-in-the-car.json";
import a_the_best_man from "./the-best-man.json";
import a_the_big_screen from "./the-big-screen.json";
import a_the_bins from "./the-bins.json";
import a_the_birthday_card from "./the-birthday-card.json";
import a_the_cafe from "./the-cafe.json";
import a_the_call_up from "./the-call-up.json";
import a_the_car_park from "./the-car-park.json";
import a_the_caretaker from "./the-caretaker.json";
import a_the_chairmans_car from "./the-chairmans-car.json";
import a_the_chairmans_son from "./the-chairmans-son.json";
import a_the_charity_match from "./the-charity-match.json";
import a_the_christening from "./the-christening.json";
import a_the_christmas_lights from "./the-christmas-lights.json";
import a_the_coach_leaves from "./the-coach-leaves.json";
import a_the_coach_retires from "./the-coach-retires.json";
import a_the_coin from "./the-coin.json";
import a_the_column from "./the-column.json";
import a_the_crumble from "./the-crumble.json";
import a_the_cup_final_boot from "./the-cup-final-boot.json";
import a_the_dark_week from "./the-dark-week.json";
import a_the_delay from "./the-delay.json";
import a_the_documentary from "./the-documentary.json";
import a_the_envelope from "./the-envelope.json";
import a_the_fake_you from "./the-fake-you.json";
import a_the_fines_book from "./the-fines-book.json";
import a_the_fire_alarm from "./the-fire-alarm.json";
import a_the_food_bank from "./the-food-bank.json";
import a_the_gaffers_word from "./the-gaffers-word.json";
import a_the_grass from "./the-grass.json";
import a_the_groundsmans_dog from "./the-groundsmans-dog.json";
import a_the_groundsmans_goal from "./the-groundsmans-goal.json";
import a_the_group_chat from "./the-group-chat.json";
import a_the_gym_board from "./the-gym-board.json";
import a_the_haircut from "./the-haircut.json";
import a_the_hard_shoulder from "./the-hard-shoulder.json";
import a_the_head_shave from "./the-head-shave.json";
import a_the_heckler from "./the-heckler.json";
import a_the_hill from "./the-hill.json";
import a_the_ice_bath from "./the-ice-bath.json";
import a_the_investment from "./the-investment.json";
import a_the_karting from "./the-karting.json";
import a_the_kit_row from "./the-kit-row.json";
import a_the_knees from "./the-knees.json";
import a_the_lantern from "./the-lantern.json";
import a_the_last_contract from "./the-last-contract.json";
import a_the_last_year from "./the-last-year.json";
import a_the_lift from "./the-lift.json";
import a_the_loan_abroad from "./the-loan-abroad.json";
import a_the_loan_lad from "./the-loan-lad.json";
import a_the_long_read from "./the-long-read.json";
import a_the_long_way_back from "./the-long-way-back.json";
import a_the_lucky_scarf from "./the-lucky-scarf.json";
import a_the_mascot from "./the-mascot.json";
import a_the_nemesis from "./the-nemesis.json";
import a_the_new_boots from "./the-new-boots.json";
import a_the_new_menu from "./the-new-menu.json";
import a_the_new_signing from "./the-new-signing.json";
import a_the_night_out from "./the-night-out.json";
import a_the_number from "./the-number.json";
import a_the_other_agent from "./the-other-agent.json";
import a_the_penalty_taker from "./the-penalty-taker.json";
import a_the_petrol_station from "./the-petrol-station.json";
import a_the_phone_in from "./the-phone-in.json";
import a_the_photo from "./the-photo.json";
import a_the_pile_on from "./the-pile-on.json";
import a_the_podcast from "./the-podcast.json";
import a_the_quiet_lad from "./the-quiet-lad.json";
import a_the_race from "./the-race.json";
import a_the_reality_show from "./the-reality-show.json";
import a_the_rec from "./the-rec.json";
import a_the_red_card from "./the-red-card.json";
import a_the_ref_remembers from "./the-ref-remembers.json";
import a_the_referee from "./the-referee.json";
import a_the_referees_son from "./the-referees-son.json";
import a_the_scout_who_said_no from "./the-scout-who-said-no.json";
import a_the_shirt_swap from "./the-shirt-swap.json";
import a_the_shoot_at_mums from "./the-shoot-at-mums.json";
import a_the_sign from "./the-sign.json";
import a_the_signs from "./the-signs.json";
import a_the_snorer from "./the-snorer.json";
import a_the_stag_do from "./the-stag-do.json";
import a_the_standby_list from "./the-standby-list.json";
import a_the_statue from "./the-statue.json";
import a_the_superfan from "./the-superfan.json";
import a_the_tablets from "./the-tablets.json";
import a_the_tackle from "./the-tackle.json";
import a_the_tattoo from "./the-tattoo.json";
import a_the_team_photo from "./the-team-photo.json";
import a_the_team_sheet from "./the-team-sheet.json";
import a_the_tunnel from "./the-tunnel.json";
import a_the_under_nines from "./the-under-nines.json";
import a_the_van from "./the-van.json";
import a_the_wages from "./the-wages.json";
import a_the_walkout from "./the-walkout.json";
import a_the_wall from "./the-wall.json";
import a_the_watch from "./the-watch.json";
import a_the_whip_round from "./the-whip-round.json";
import a_the_wrong_like from "./the-wrong-like.json";
import a_the_young_lad from "./the-young-lad.json";
import a_tickets_for_the_street from "./tickets-for-the-street.json";
import a_unknown_number from "./unknown-number.json";
import a_unsettled from "./unsettled.json";
import a_wednesday_fives from "./wednesday-fives.json";
import a_your_first_coach from "./your-first-coach.json";
import a_your_grandad from "./your-grandad.json";

export const STORY_ARCS: LifeArc[] = [
  a_his_boots as unknown as LifeArc,
  a_the_highlighter as unknown as LifeArc,
  a_the_first_wage as unknown as LifeArc,
  a_the_scout as unknown as LifeArc,
  a_after_the_casino as unknown as LifeArc,
  a_bar_for_breakfast as unknown as LifeArc,
  a_brothers_trial as unknown as LifeArc,
  a_chairmans_dinner as unknown as LifeArc,
  a_dads_last_shift as unknown as LifeArc,
  a_dads_notes as unknown as LifeArc,
  a_deadline_day as unknown as LifeArc,
  a_derby_week as unknown as LifeArc,
  a_dont_post_me as unknown as LifeArc,
  a_free_kick_duty as unknown as LifeArc,
  a_head_tennis as unknown as LifeArc,
  a_her_birthday as unknown as LifeArc,
  a_her_job as unknown as LifeArc,
  a_her_shop as unknown as LifeArc,
  a_her_sisters_wedding as unknown as LifeArc,
  a_her_song as unknown as LifeArc,
  a_his_last_season as unknown as LifeArc,
  a_his_mates_tickets as unknown as LifeArc,
  a_his_old_club as unknown as LifeArc,
  a_keep_ups as unknown as LifeArc,
  a_kid_in_digs as unknown as LifeArc,
  a_left_back as unknown as LifeArc,
  a_legends_boots as unknown as LifeArc,
  a_next_door as unknown as LifeArc,
  a_number_nine as unknown as LifeArc,
  a_on_commentary as unknown as LifeArc,
  a_pe_teacher as unknown as LifeArc,
  a_play_through_it as unknown as LifeArc,
  a_players_player as unknown as LifeArc,
  a_released as unknown as LifeArc,
  a_roommates_phone as unknown as LifeArc,
  a_she_grows_up as unknown as LifeArc,
  a_ten_minutes as unknown as LifeArc,
  a_the_advert as unknown as LifeArc,
  a_the_alibi as unknown as LifeArc,
  a_the_ankle as unknown as LifeArc,
  a_the_armband as unknown as LifeArc,
  a_the_assembly as unknown as LifeArc,
  a_the_bad_car as unknown as LifeArc,
  a_the_ball_girl as unknown as LifeArc,
  a_the_balls_in_the_car as unknown as LifeArc,
  a_the_best_man as unknown as LifeArc,
  a_the_big_screen as unknown as LifeArc,
  a_the_bins as unknown as LifeArc,
  a_the_birthday_card as unknown as LifeArc,
  a_the_cafe as unknown as LifeArc,
  a_the_call_up as unknown as LifeArc,
  a_the_car_park as unknown as LifeArc,
  a_the_caretaker as unknown as LifeArc,
  a_the_chairmans_car as unknown as LifeArc,
  a_the_chairmans_son as unknown as LifeArc,
  a_the_charity_match as unknown as LifeArc,
  a_the_christening as unknown as LifeArc,
  a_the_christmas_lights as unknown as LifeArc,
  a_the_coach_leaves as unknown as LifeArc,
  a_the_coach_retires as unknown as LifeArc,
  a_the_coin as unknown as LifeArc,
  a_the_column as unknown as LifeArc,
  a_the_crumble as unknown as LifeArc,
  a_the_cup_final_boot as unknown as LifeArc,
  a_the_dark_week as unknown as LifeArc,
  a_the_delay as unknown as LifeArc,
  a_the_documentary as unknown as LifeArc,
  a_the_envelope as unknown as LifeArc,
  a_the_fake_you as unknown as LifeArc,
  a_the_fines_book as unknown as LifeArc,
  a_the_fire_alarm as unknown as LifeArc,
  a_the_food_bank as unknown as LifeArc,
  a_the_gaffers_word as unknown as LifeArc,
  a_the_grass as unknown as LifeArc,
  a_the_groundsmans_dog as unknown as LifeArc,
  a_the_groundsmans_goal as unknown as LifeArc,
  a_the_group_chat as unknown as LifeArc,
  a_the_gym_board as unknown as LifeArc,
  a_the_haircut as unknown as LifeArc,
  a_the_hard_shoulder as unknown as LifeArc,
  a_the_head_shave as unknown as LifeArc,
  a_the_heckler as unknown as LifeArc,
  a_the_hill as unknown as LifeArc,
  a_the_ice_bath as unknown as LifeArc,
  a_the_investment as unknown as LifeArc,
  a_the_karting as unknown as LifeArc,
  a_the_kit_row as unknown as LifeArc,
  a_the_knees as unknown as LifeArc,
  a_the_lantern as unknown as LifeArc,
  a_the_last_contract as unknown as LifeArc,
  a_the_last_year as unknown as LifeArc,
  a_the_lift as unknown as LifeArc,
  a_the_loan_abroad as unknown as LifeArc,
  a_the_loan_lad as unknown as LifeArc,
  a_the_long_read as unknown as LifeArc,
  a_the_long_way_back as unknown as LifeArc,
  a_the_lucky_scarf as unknown as LifeArc,
  a_the_mascot as unknown as LifeArc,
  a_the_nemesis as unknown as LifeArc,
  a_the_new_boots as unknown as LifeArc,
  a_the_new_menu as unknown as LifeArc,
  a_the_new_signing as unknown as LifeArc,
  a_the_night_out as unknown as LifeArc,
  a_the_number as unknown as LifeArc,
  a_the_other_agent as unknown as LifeArc,
  a_the_penalty_taker as unknown as LifeArc,
  a_the_petrol_station as unknown as LifeArc,
  a_the_phone_in as unknown as LifeArc,
  a_the_photo as unknown as LifeArc,
  a_the_pile_on as unknown as LifeArc,
  a_the_podcast as unknown as LifeArc,
  a_the_quiet_lad as unknown as LifeArc,
  a_the_race as unknown as LifeArc,
  a_the_reality_show as unknown as LifeArc,
  a_the_rec as unknown as LifeArc,
  a_the_red_card as unknown as LifeArc,
  a_the_ref_remembers as unknown as LifeArc,
  a_the_referee as unknown as LifeArc,
  a_the_referees_son as unknown as LifeArc,
  a_the_scout_who_said_no as unknown as LifeArc,
  a_the_shirt_swap as unknown as LifeArc,
  a_the_shoot_at_mums as unknown as LifeArc,
  a_the_sign as unknown as LifeArc,
  a_the_signs as unknown as LifeArc,
  a_the_snorer as unknown as LifeArc,
  a_the_stag_do as unknown as LifeArc,
  a_the_standby_list as unknown as LifeArc,
  a_the_statue as unknown as LifeArc,
  a_the_superfan as unknown as LifeArc,
  a_the_tablets as unknown as LifeArc,
  a_the_tackle as unknown as LifeArc,
  a_the_tattoo as unknown as LifeArc,
  a_the_team_photo as unknown as LifeArc,
  a_the_team_sheet as unknown as LifeArc,
  a_the_tunnel as unknown as LifeArc,
  a_the_under_nines as unknown as LifeArc,
  a_the_van as unknown as LifeArc,
  a_the_wages as unknown as LifeArc,
  a_the_walkout as unknown as LifeArc,
  a_the_wall as unknown as LifeArc,
  a_the_watch as unknown as LifeArc,
  a_the_whip_round as unknown as LifeArc,
  a_the_wrong_like as unknown as LifeArc,
  a_the_young_lad as unknown as LifeArc,
  a_tickets_for_the_street as unknown as LifeArc,
  a_unknown_number as unknown as LifeArc,
  a_unsettled as unknown as LifeArc,
  a_wednesday_fives as unknown as LifeArc,
  a_your_first_coach as unknown as LifeArc,
  a_your_grandad as unknown as LifeArc,
];
