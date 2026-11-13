create table if not exists public.cats (
    id text primary key,
    lat double precision not null check (lat between -90 and 90),
    lng double precision not null check (lng between -180 and 180),
    name text not null default '',
    note text not null default '',
    image text,
    approximate boolean not null default false,
    created_by uuid references auth.users(id) on delete set null,
    updated_by uuid references auth.users(id) on delete set null,
    updated_at timestamptz not null default now()
);

create table if not exists public.cat_editors (
    user_id uuid primary key references auth.users(id) on delete cascade,
    added_at timestamptz not null default now()
);

alter table public.cats enable row level security;
alter table public.cat_editors enable row level security;

create or replace function public.is_cat_editor()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1
        from public.cat_editors
        where user_id = (select auth.uid())
    );
$$;

create or replace function public.set_cat_audit_fields()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
    if tg_op = 'INSERT' then
        new.created_by := coalesce((select auth.uid()), new.created_by);
    end if;
    new.updated_by := coalesce((select auth.uid()), new.updated_by);
    new.updated_at := now();
    return new;
end;
$$;

drop trigger if exists set_cat_audit_fields on public.cats;
create trigger set_cat_audit_fields
before insert or update on public.cats
for each row execute function public.set_cat_audit_fields();

drop policy if exists "Anyone can view cats" on public.cats;
create policy "Anyone can view cats"
on public.cats for select
to anon, authenticated
using (true);

drop policy if exists "Invited editors can add cats" on public.cats;
create policy "Invited editors can add cats"
on public.cats for insert
to authenticated
with check (public.is_cat_editor());

drop policy if exists "Invited editors can update cats" on public.cats;
create policy "Invited editors can update cats"
on public.cats for update
to authenticated
using (public.is_cat_editor())
with check (public.is_cat_editor());

drop policy if exists "Invited editors can delete cats" on public.cats;
create policy "Invited editors can delete cats"
on public.cats for delete
to authenticated
using (public.is_cat_editor());

drop policy if exists "Editors can view own membership" on public.cat_editors;
create policy "Editors can view own membership"
on public.cat_editors for select
to authenticated
using (user_id = (select auth.uid()));

grant select on public.cats to anon, authenticated;
grant insert, update, delete on public.cats to authenticated;
grant select on public.cat_editors to authenticated;
grant execute on function public.is_cat_editor() to authenticated;

do $$
begin
    if not exists (
        select 1
        from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'cats'
    ) then
        alter publication supabase_realtime add table public.cats;
    end if;
end;
$$;
