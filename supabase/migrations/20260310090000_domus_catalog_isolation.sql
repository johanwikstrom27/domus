-- The catalog table predates household-scoped catalog state in
-- domus_household_states. Keep the table for compatibility, but make any
-- rows that remain in it tenant-bound before they can be read or written.
alter table public.domus_catalog_items
  add column if not exists household_id uuid references public.domus_households(id) on delete cascade;

create index if not exists domus_catalog_items_household_id_idx
  on public.domus_catalog_items(household_id);

drop policy if exists "domus_catalog_items_authenticated_read" on public.domus_catalog_items;
drop policy if exists "domus_catalog_items_authenticated_write" on public.domus_catalog_items;
drop policy if exists "domus_catalog_items_member_read" on public.domus_catalog_items;
drop policy if exists "domus_catalog_items_member_insert" on public.domus_catalog_items;
drop policy if exists "domus_catalog_items_member_update" on public.domus_catalog_items;
drop policy if exists "domus_catalog_items_member_delete" on public.domus_catalog_items;

create policy "domus_catalog_items_member_read"
on public.domus_catalog_items
for select
using (
  household_id is not null
  and public.domus_is_household_member(household_id)
);

create policy "domus_catalog_items_member_insert"
on public.domus_catalog_items
for insert
with check (
  household_id is not null
  and public.domus_is_household_member(household_id)
);

create policy "domus_catalog_items_member_update"
on public.domus_catalog_items
for update
using (
  household_id is not null
  and public.domus_is_household_member(household_id)
)
with check (
  household_id is not null
  and public.domus_is_household_member(household_id)
);

create policy "domus_catalog_items_member_delete"
on public.domus_catalog_items
for delete
using (
  household_id is not null
  and public.domus_is_household_member(household_id)
);
