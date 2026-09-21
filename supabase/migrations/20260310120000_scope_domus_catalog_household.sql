alter table public.domus_catalog_items
  add column if not exists household_id uuid references public.domus_households(id) on delete cascade;

create index if not exists domus_catalog_items_household_id_idx
  on public.domus_catalog_items(household_id);

drop policy if exists "domus_catalog_items_authenticated_read" on public.domus_catalog_items;
drop policy if exists "domus_catalog_items_authenticated_write" on public.domus_catalog_items;
drop policy if exists "domus_catalog_items_household_access" on public.domus_catalog_items;

create policy "domus_catalog_items_household_access"
on public.domus_catalog_items
for all
using (
  household_id is not null
  and public.domus_is_household_member(household_id)
)
with check (
  household_id is not null
  and public.domus_is_household_member(household_id)
);

comment on column public.domus_catalog_items.household_id is
  'Owning Domus household. Legacy rows with NULL remain unreadable until explicitly migrated.';
