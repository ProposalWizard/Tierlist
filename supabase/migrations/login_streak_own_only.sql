-- Login streak: own streak only (23 Oct 2026, run by Claude via the Supabase connector after Harry's yes).
-- Before, anyone could call update_login_streak with any player's id and reset their streak
-- (Supabase safety check). Now it only updates the signed-in player's own streak, and signed-out
-- callers can't run it. app/profile/page.tsx already calls it for the signed-in player. Safe to re-run.
create or replace function public.update_login_streak(p_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_last date; v_streak int; v_longest int;
begin
  if p_user_id is null or p_user_id is distinct from auth.uid() then return; end if;
  select last_active_date, current_streak, longest_streak into v_last, v_streak, v_longest
    from user_profiles where user_id = p_user_id;
  if not found then return; end if;
  if v_last = current_date then return; end if;
  if v_last = current_date - 1 then
    update user_profiles set current_streak = v_streak + 1, longest_streak = greatest(v_longest, v_streak + 1),
      last_active_date = current_date, updated_at = now() where user_id = p_user_id;
  else
    update user_profiles set current_streak = 1, last_active_date = current_date, updated_at = now() where user_id = p_user_id;
  end if;
end; $$;
revoke execute on function public.update_login_streak(uuid) from anon, public;
grant execute on function public.update_login_streak(uuid) to authenticated;
