create table if not exists public.cats (
    id text primary key,
    lat double precision not null check (lat between -90 and 90),
    lng double precision not null check (lng between -180 and 180),
    name text not null default '',
    location_name text not null default '' check (char_length(location_name) <= 120),
    note text not null default '',
    image text,
    approximate boolean not null default false,
    created_by uuid references auth.users(id) on delete set null,
    updated_by uuid references auth.users(id) on delete set null,
    updated_at timestamptz not null default now()
);

alter table public.cats
    add column if not exists location_name text not null default '' check (char_length(location_name) <= 120);

create table if not exists public.cat_editors (
    user_id uuid primary key references auth.users(id) on delete cascade,
    added_at timestamptz not null default now(),
    is_admin boolean not null default false
);

alter table public.cat_editors
    add column if not exists is_admin boolean not null default false;

create table if not exists public.cat_submissions (
    id text primary key,
    lat double precision not null check (lat between -90 and 90),
    lng double precision not null check (lng between -180 and 180),
    name text not null default '' check (char_length(name) <= 40),
    note text not null default '' check (char_length(note) <= 2000),
    image text check (image is null or char_length(image) <= 3000000),
    approximate boolean not null default false,
    submitted_at timestamptz not null default now()
);

alter table public.cats enable row level security;
alter table public.cat_editors enable row level security;
alter table public.cat_submissions enable row level security;

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

create or replace function public.is_cat_admin()
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
          and is_admin
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
drop policy if exists "Authenticated users can add cats" on public.cats;
create policy "Authenticated users can add cats"
on public.cats for insert
to authenticated
with check (created_by = (select auth.uid()));

drop policy if exists "Invited editors can update cats" on public.cats;
drop policy if exists "Owners and admins can update cats" on public.cats;
create policy "Owners and admins can update cats"
on public.cats for update
to authenticated
using (created_by = (select auth.uid()) or public.is_cat_admin())
with check (created_by = (select auth.uid()) or public.is_cat_admin());

drop policy if exists "Invited editors can delete cats" on public.cats;
drop policy if exists "Owners and admins can delete cats" on public.cats;
create policy "Owners and admins can delete cats"
on public.cats for delete
to authenticated
using (created_by = (select auth.uid()) or public.is_cat_admin());

drop policy if exists "Editors can view own membership" on public.cat_editors;
create policy "Editors can view own membership"
on public.cat_editors for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "Anyone can submit cats for review" on public.cat_submissions;
create policy "Anyone can submit cats for review"
on public.cat_submissions for insert
to anon, authenticated
with check (true);

drop policy if exists "Admins can view submissions" on public.cat_submissions;
create policy "Admins can view submissions"
on public.cat_submissions for select
to authenticated
using (public.is_cat_admin());

drop policy if exists "Admins can delete submissions" on public.cat_submissions;
create policy "Admins can delete submissions"
on public.cat_submissions for delete
to authenticated
using (public.is_cat_admin());

create or replace function public.approve_cat_submission(p_submission_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    submission public.cat_submissions%rowtype;
begin
    if not public.is_cat_admin() then
        raise exception 'Only a cat map administrator can approve submissions.';
    end if;

    select * into submission
    from public.cat_submissions
    where id = p_submission_id
    for update;

    if not found then
        raise exception 'Submission not found.';
    end if;

    insert into public.cats (id, lat, lng, name, note, image, approximate, created_by)
    values (
        submission.id,
        submission.lat,
        submission.lng,
        submission.name,
        submission.note,
        submission.image,
        submission.approximate,
        (select auth.uid())
    );

    delete from public.cat_submissions where id = p_submission_id;
end;
$$;

create or replace function public.reject_cat_submission(p_submission_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
    if not public.is_cat_admin() then
        raise exception 'Only a cat map administrator can reject submissions.';
    end if;

    delete from public.cat_submissions where id = p_submission_id;
    if not found then
        raise exception 'Submission not found.';
    end if;
end;
$$;

grant select on public.cats to anon, authenticated;
grant insert, update, delete on public.cats to authenticated;
grant select on public.cat_editors to authenticated;
grant insert on public.cat_submissions to anon, authenticated;
grant select, delete on public.cat_submissions to authenticated;
revoke all on function public.is_cat_admin() from public, anon;
revoke all on function public.approve_cat_submission(text) from public, anon;
revoke all on function public.reject_cat_submission(text) from public, anon;
grant execute on function public.is_cat_editor() to authenticated;
grant execute on function public.is_cat_admin() to authenticated;
grant execute on function public.approve_cat_submission(text) to authenticated;
grant execute on function public.reject_cat_submission(text) to authenticated;

insert into public.cat_editors (user_id, is_admin)
values ('642005de-39c8-4930-abbb-92c6169b67a1', true)
on conflict (user_id) do update set is_admin = true;

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
    if not exists (
        select 1
        from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'cat_submissions'
    ) then
        alter publication supabase_realtime add table public.cat_submissions;
    end if;
end;
$$;
