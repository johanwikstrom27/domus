create or replace function public.domus_is_household_member(target_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.domus_household_members member
    where member.household_id = target_household_id
      and member.user_id = auth.uid()
  );
$$;

create or replace function public.domus_can_read_profile(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select target_user_id = auth.uid()
    or exists (
      select 1
      from public.domus_household_members mine
      join public.domus_household_members theirs
        on theirs.household_id = mine.household_id
      where mine.user_id = auth.uid()
        and theirs.user_id = target_user_id
    );
$$;

grant execute on function public.domus_is_household_member(uuid) to authenticated;
grant execute on function public.domus_can_read_profile(uuid) to authenticated;

drop policy if exists "domus_profiles_select" on public.domus_profiles;
create policy "domus_profiles_select"
on public.domus_profiles
for select
using (public.domus_can_read_profile(id));

drop policy if exists "domus_household_members_read" on public.domus_household_members;
create policy "domus_household_members_read"
on public.domus_household_members
for select
using (public.domus_is_household_member(household_id));

drop policy if exists "domus_household_members_write" on public.domus_household_members;
drop policy if exists "domus_household_members_insert" on public.domus_household_members;
drop policy if exists "domus_household_members_update" on public.domus_household_members;
drop policy if exists "domus_household_members_delete" on public.domus_household_members;

create policy "domus_household_members_insert"
on public.domus_household_members
for insert
with check (
  public.domus_is_household_member(household_id)
  or exists (
    select 1
    from public.domus_households household
    where household.id = domus_household_members.household_id
      and household.created_by = auth.uid()
  )
);

create policy "domus_household_members_update"
on public.domus_household_members
for update
using (public.domus_is_household_member(household_id))
with check (public.domus_is_household_member(household_id));

create policy "domus_household_members_delete"
on public.domus_household_members
for delete
using (public.domus_is_household_member(household_id));
