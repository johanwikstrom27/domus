create extension if not exists pgcrypto;

create table if not exists public.domus_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  first_name text not null,
  last_name text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.domus_households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default timezone('utc', now()),
  created_by uuid not null references public.domus_profiles(id) on delete cascade
);

create table if not exists public.domus_household_members (
  household_id uuid not null references public.domus_households(id) on delete cascade,
  user_id uuid not null references public.domus_profiles(id) on delete cascade,
  joined_at timestamptz not null default timezone('utc', now()),
  primary key (household_id, user_id)
);

create table if not exists public.domus_household_invites (
  token text primary key,
  household_id uuid not null references public.domus_households(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  expires_at timestamptz not null,
  created_by uuid not null references public.domus_profiles(id) on delete cascade,
  used_by uuid references public.domus_profiles(id) on delete set null,
  used_at timestamptz
);

create table if not exists public.domus_household_states (
  household_id uuid primary key references public.domus_households(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default timezone('utc', now()),
  updated_by uuid not null references public.domus_profiles(id) on delete cascade
);

create table if not exists public.domus_catalog_items (
  id text primary key,
  name text not null,
  category text not null,
  default_quantity numeric not null,
  default_unit text not null,
  units jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  updated_by uuid references public.domus_profiles(id) on delete set null
);

create table if not exists public.domus_user_settings (
  user_id uuid primary key references public.domus_profiles(id) on delete cascade,
  daily_summary_enabled boolean not null default true,
  last_summary_date text,
  category_overrides jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default timezone('utc', now())
);

create or replace function public.domus_is_household_member(target_household_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.domus_household_members member
    where member.household_id = target_household_id
      and member.user_id = auth.uid()
  );
$$;

create or replace function public.domus_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists domus_household_states_touch_updated_at on public.domus_household_states;
create trigger domus_household_states_touch_updated_at
before update on public.domus_household_states
for each row
execute function public.domus_touch_updated_at();

drop trigger if exists domus_catalog_items_touch_updated_at on public.domus_catalog_items;
create trigger domus_catalog_items_touch_updated_at
before update on public.domus_catalog_items
for each row
execute function public.domus_touch_updated_at();

drop trigger if exists domus_user_settings_touch_updated_at on public.domus_user_settings;
create trigger domus_user_settings_touch_updated_at
before update on public.domus_user_settings
for each row
execute function public.domus_touch_updated_at();

alter table public.domus_profiles enable row level security;
alter table public.domus_households enable row level security;
alter table public.domus_household_members enable row level security;
alter table public.domus_household_invites enable row level security;
alter table public.domus_household_states enable row level security;
alter table public.domus_catalog_items enable row level security;
alter table public.domus_user_settings enable row level security;

drop policy if exists "domus_profiles_select" on public.domus_profiles;
create policy "domus_profiles_select"
on public.domus_profiles
for select
using (
  id = auth.uid()
  or exists (
    select 1
    from public.domus_household_members mine
    join public.domus_household_members theirs
      on theirs.household_id = mine.household_id
    where mine.user_id = auth.uid()
      and theirs.user_id = domus_profiles.id
  )
);

drop policy if exists "domus_profiles_insert" on public.domus_profiles;
create policy "domus_profiles_insert"
on public.domus_profiles
for insert
with check (id = auth.uid());

drop policy if exists "domus_profiles_update" on public.domus_profiles;
create policy "domus_profiles_update"
on public.domus_profiles
for update
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "domus_households_member_read" on public.domus_households;
create policy "domus_households_member_read"
on public.domus_households
for select
using (public.domus_is_household_member(id));

drop policy if exists "domus_households_member_write" on public.domus_households;
create policy "domus_households_member_write"
on public.domus_households
for all
using (public.domus_is_household_member(id) or created_by = auth.uid())
with check (public.domus_is_household_member(id) or created_by = auth.uid());

drop policy if exists "domus_household_members_read" on public.domus_household_members;
create policy "domus_household_members_read"
on public.domus_household_members
for select
using (public.domus_is_household_member(household_id));

drop policy if exists "domus_household_members_write" on public.domus_household_members;
create policy "domus_household_members_write"
on public.domus_household_members
for all
using (public.domus_is_household_member(household_id) or user_id = auth.uid())
with check (public.domus_is_household_member(household_id) or user_id = auth.uid());

drop policy if exists "domus_household_invites_member_access" on public.domus_household_invites;
create policy "domus_household_invites_member_access"
on public.domus_household_invites
for all
using (public.domus_is_household_member(household_id))
with check (public.domus_is_household_member(household_id));

drop policy if exists "domus_household_states_member_access" on public.domus_household_states;
create policy "domus_household_states_member_access"
on public.domus_household_states
for all
using (public.domus_is_household_member(household_id))
with check (public.domus_is_household_member(household_id));

drop policy if exists "domus_catalog_items_authenticated_read" on public.domus_catalog_items;
create policy "domus_catalog_items_authenticated_read"
on public.domus_catalog_items
for select
using (auth.role() = 'authenticated');

drop policy if exists "domus_catalog_items_authenticated_write" on public.domus_catalog_items;
create policy "domus_catalog_items_authenticated_write"
on public.domus_catalog_items
for all
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

drop policy if exists "domus_user_settings_owner_access" on public.domus_user_settings;
create policy "domus_user_settings_owner_access"
on public.domus_user_settings
for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

alter publication supabase_realtime add table public.domus_households;
alter publication supabase_realtime add table public.domus_household_members;
alter publication supabase_realtime add table public.domus_household_invites;
alter publication supabase_realtime add table public.domus_household_states;
alter publication supabase_realtime add table public.domus_catalog_items;
alter publication supabase_realtime add table public.domus_user_settings;
